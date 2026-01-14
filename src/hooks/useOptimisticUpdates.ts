"use client";

import { useState, useCallback, useRef } from "react";
import { updateHiringIntentUserState, type HiringIntent } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

interface OptimisticUpdate {
  intentId: number;
  fromColumn: string;
  toColumn: string;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
}

interface UseOptimisticUpdatesReturn {
  pendingUpdates: OptimisticUpdate[];
  handleOptimisticMove: (
    intentId: number, 
    fromColumn: string, 
    toColumn: string,
    currentItems: Record<string, HiringIntent[]>,
    updateItems: (items: Record<string, HiringIntent[]>) => void
  ) => Promise<boolean>;
  rollbackUpdate: (
    intentId: number, 
    fromColumn: string, 
    toColumn: string,
    originalItems: Record<string, HiringIntent[]>,
    updateItems: (items: Record<string, HiringIntent[]>) => void
  ) => void;
  isUpdating: (intentId: number) => boolean;
}

export function useOptimisticUpdates(): UseOptimisticUpdatesReturn {
  const [pendingUpdates, setPendingUpdates] = useState<OptimisticUpdate[]>([]);
  const originalItemsRef = useRef<Record<string, HiringIntent[]>>({});

  const handleOptimisticMove = useCallback(async (
    intentId: number,
    fromColumn: string,
    toColumn: string,
    currentItems: Record<string, HiringIntent[]>,
    updateItems: (items: Record<string, HiringIntent[]>) => void
  ): Promise<boolean> => {
    // Store original items for potential rollback
    originalItemsRef.current = { ...currentItems };

    // Find the item being moved
    const sourceItems = currentItems[fromColumn] || [];
    const movedItem = sourceItems.find(item => item.id === intentId);
    
    if (!movedItem) {
      console.error(`Item with ID ${intentId} not found in ${fromColumn}`);
      return false;
    }

    // Create optimistic update
    const optimisticUpdate: OptimisticUpdate = {
      intentId,
      fromColumn,
      toColumn,
      timestamp: Date.now(),
      status: 'pending'
    };

    setPendingUpdates(prev => [...prev, optimisticUpdate]);

    // Perform optimistic UI update
    const updatedItems = { ...currentItems };
    updatedItems[fromColumn] = sourceItems.filter(item => item.id !== intentId);
    updatedItems[toColumn] = [...(updatedItems[toColumn] || []), movedItem];
    
    updateItems(updatedItems);

    // Sync with server in background
    try {
      const statusMap: Record<string, 'actioned' | 'hidden' | 'completed' | 'aborted'> = {
        'actions': 'actioned',
        'hidden': 'hidden',
        'completed': 'completed',
        'aborted': 'aborted'
      };

      const serverStatus = statusMap[toColumn];
      if (!serverStatus) {
        throw new Error(`Unknown target column: ${toColumn}`);
      }

      const result = await updateHiringIntentUserState(
        intentId,
        serverStatus,
        EXTERNAL.directus_url
      );

      if (result.success) {
        // Mark update as successful
        setPendingUpdates(prev => 
          prev.map(update => 
            update.intentId === intentId 
              ? { ...update, status: 'success' }
              : update
          )
        );

        // Remove successful update after a delay
        setTimeout(() => {
          setPendingUpdates(prev => 
            prev.filter(update => 
              !(update.intentId === intentId && update.status === 'success')
            )
          );
        }, 1000);

        return true;
      } else {
        throw new Error(result.error || 'Server update failed');
      }
    } catch (error) {
      console.error('Failed to sync with server:', error);
      
      // Mark update as failed
      setPendingUpdates(prev => 
        prev.map(update => 
          update.intentId === intentId 
            ? { ...update, status: 'error' }
            : update
        )
      );

      // Rollback the optimistic update
      updateItems(originalItemsRef.current);

      // Remove failed update after a delay
      setTimeout(() => {
        setPendingUpdates(prev => 
          prev.filter(update => 
            !(update.intentId === intentId && update.status === 'error')
          )
        );
      }, 3000);

      return false;
    }
  }, []);

  const rollbackUpdate = useCallback((
    intentId: number,
    fromColumn: string,
    toColumn: string,
    originalItems: Record<string, HiringIntent[]>,
    updateItems: (items: Record<string, HiringIntent[]>) => void
  ) => {
    // Restore original items
    updateItems(originalItems);

    // Remove from pending updates
    setPendingUpdates(prev => 
      prev.filter(update => update.intentId !== intentId)
    );
  }, []);

  const isUpdating = useCallback((intentId: number) => {
    return pendingUpdates.some(update => 
      update.intentId === intentId && update.status === 'pending'
    );
  }, [pendingUpdates]);

  return {
    pendingUpdates,
    handleOptimisticMove,
    rollbackUpdate,
    isUpdating,
  };
}