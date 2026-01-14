"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getUserHiringIntentStates } from "@/lib/utils";
import { EXTERNAL } from "@/constant";
import type { CategorizedIntentIds } from "@/lib/utils";

interface SyncQueueItem {
  id: string;
  intentId: number;
  fromColumn: string;
  toColumn: string;
  timestamp: number;
  retries: number;
}

interface UseBackgroundSyncReturn {
  isOnline: boolean;
  pendingSyncItems: SyncQueueItem[];
  lastSyncTime: number | null;
  syncInProgress: boolean;
  performBackgroundSync: () => Promise<void>;
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>) => void;
  performFinalSync: () => boolean;
}

const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes
const MAX_RETRIES = 3;
const SYNC_QUEUE_KEY = "orbit-signal-sync-queue";

export function useBackgroundSync(
  spaceId: string | null,
  onSyncComplete?: (hasConflicts: boolean) => void
): UseBackgroundSyncReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncItems, setPendingSyncItems] = useState<SyncQueueItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncInProgressRef = useRef(false);

  // Load sync queue from localStorage on mount
  useEffect(() => {
    try {
      const storedQueue = localStorage.getItem(SYNC_QUEUE_KEY);
      if (storedQueue) {
        const queue = JSON.parse(storedQueue) as SyncQueueItem[];
        setPendingSyncItems(queue);
      }
    } catch (error) {
      console.warn("Failed to load sync queue:", error);
      localStorage.removeItem(SYNC_QUEUE_KEY);
    }
  }, []);

  // Save sync queue to localStorage whenever it changes
  useEffect(() => {
    if (pendingSyncItems.length > 0) {
      try {
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(pendingSyncItems));
      } catch (error) {
        console.warn("Failed to save sync queue:", error);
      }
    } else {
      localStorage.removeItem(SYNC_QUEUE_KEY);
    }
  }, [pendingSyncItems]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process sync queue when coming back online
  useEffect(() => {
    if (isOnline && pendingSyncItems.length > 0 && !syncInProgressRef.current) {
      performBackgroundSync();
    }
  }, [isOnline, pendingSyncItems.length]);

  // Background sync interval
  useEffect(() => {
    if (isOnline) {
      syncIntervalRef.current = setInterval(() => {
        if (!syncInProgressRef.current) {
          performBackgroundSync();
        }
      }, SYNC_INTERVAL);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [isOnline, spaceId]);

  // Tab close final sync ⭐
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSyncItems.length > 0) {
        // Try to sync using Beacon API for synchronous request
        const syncSuccess = performFinalSync();
        
        if (!syncSuccess) {
          // Show warning if we couldn't sync
          e.preventDefault();
          e.returnValue = 'Changes may not be saved. Stay on page to complete sync.';
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingSyncItems.length > 0) {
        performFinalSync();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Cleanup sync on unmount
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [pendingSyncItems.length]);

  const performBackgroundSync = useCallback(async () => {
    if (!isOnline || syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    setSyncInProgress(true);

    try {
      // Fetch latest user states from server
      const statesResult = await getUserHiringIntentStates(EXTERNAL.directus_url);
      
      if (statesResult.success && statesResult.categories) {
        // Compare with cached states and detect conflicts
        const hasConflicts = await detectAndResolveConflicts(statesResult.categories);
        
        setLastSyncTime(Date.now());
        
        if (onSyncComplete) {
          onSyncComplete(hasConflicts);
        }
      }

      // Process sync queue
      await processSyncQueue();
    } catch (error) {
      console.error("Background sync failed:", error);
    } finally {
      syncInProgressRef.current = false;
      setSyncInProgress(false);
    }
  }, [isOnline, onSyncComplete]);

  const detectAndResolveConflicts = async (serverStates: CategorizedIntentIds): Promise<boolean> => {
    try {
      // Get cached states for comparison
      const cachedStates = localStorage.getItem('orbit-signal-cache');
      if (!cachedStates) return false;

      const cache = JSON.parse(cachedStates);
      const clientStates = cache.userStates;

      // Simple conflict detection: check if any IDs have different states
      const conflicts: Array<{ intentId: number; clientState: string; serverState: string }> = [];

      // Check each state category
      const categories: Array<{ key: keyof CategorizedIntentIds; status: string }> = [
        { key: 'actionedIds', status: 'actioned' },
        { key: 'hiddenIds', status: 'hidden' },
        { key: 'completedIds', status: 'completed' },
        { key: 'abortedIds', status: 'aborted' },
      ];

      for (const category of categories) {
        const clientIds = clientStates[category.key] as number[];
        const serverIds = serverStates[category.key];

        // Find IDs that exist on both sides but might be in different categories
        for (const id of clientIds) {
          const serverCategory = categories.find(c => serverStates[c.key].includes(id));
          if (serverCategory && serverCategory.status !== category.status) {
            conflicts.push({
              intentId: id,
              clientState: category.status,
              serverState: serverCategory.status
            });
          }
        }
      }

      return conflicts.length > 0;
    } catch (error) {
      console.error("Conflict detection failed:", error);
      return false;
    }
  };

  const processSyncQueue = async () => {
    if (pendingSyncItems.length === 0) return;

    const itemsToProcess = [...pendingSyncItems];
    const successfulItems: string[] = [];
    const failedItems: SyncQueueItem[] = [];

    for (const item of itemsToProcess) {
      try {
        // Import updateHiringIntentUserState dynamically to avoid circular dependencies
        const { updateHiringIntentUserState } = await import("@/lib/utils");
        
        const statusMap: Record<string, 'actioned' | 'hidden' | 'completed' | 'aborted'> = {
          'actions': 'actioned',
          'hidden': 'hidden',
          'completed': 'completed',
          'aborted': 'aborted'
        };

        const serverStatus = statusMap[item.toColumn];
        if (!serverStatus) continue;

        const result = await updateHiringIntentUserState(
          item.intentId,
          serverStatus,
          EXTERNAL.directus_url
        );

        if (result.success) {
          successfulItems.push(item.id);
        } else {
          if (item.retries < MAX_RETRIES) {
            // Retry later
            failedItems.push({ ...item, retries: item.retries + 1 });
          } else {
            console.error(`Sync failed after ${MAX_RETRIES} retries:`, item);
          }
        }
      } catch (error) {
        console.error("Sync item failed:", item, error);
        
        if (item.retries < MAX_RETRIES) {
          failedItems.push({ ...item, retries: item.retries + 1 });
        }
      }
    }

    // Update sync queue
    setPendingSyncItems(prev => {
      const remaining = prev.filter(item => !successfulItems.includes(item.id));
      return [...remaining, ...failedItems];
    });
  };

  const addToSyncQueue = useCallback((item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>) => {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `${item.intentId}-${Date.now()}`,
      timestamp: Date.now(),
      retries: 0,
    };

    setPendingSyncItems(prev => [...prev, queueItem]);
  }, []);

  const performFinalSync = useCallback((): boolean => {
    if (pendingSyncItems.length === 0) return true;

    try {
      // Use Beacon API for synchronous request during page unload
      const syncData = {
        items: pendingSyncItems,
        timestamp: Date.now(),
      };

      const success = navigator.sendBeacon(
        '/api/sync-orbit-signal',
        JSON.stringify(syncData)
      );

      if (success) {
        // Clear queue after successful beacon
        setPendingSyncItems([]);
        localStorage.removeItem(SYNC_QUEUE_KEY);
      }

      return success;
    } catch (error) {
      console.error("Final sync failed:", error);
      return false;
    }
  }, [pendingSyncItems]);

  return {
    isOnline,
    pendingSyncItems,
    lastSyncTime,
    syncInProgress,
    performBackgroundSync,
    addToSyncQueue,
    performFinalSync,
  };
}