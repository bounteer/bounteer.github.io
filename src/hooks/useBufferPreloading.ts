"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getHiringIntentsBySpace, type HiringIntent } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

interface UseBufferPreloadingReturn {
  bufferSizes: Record<string, number>;
  isPreloading: Record<string, boolean>;
  loadMoreItems: (columnType: string, currentItems: HiringIntent[], spaceId: number | null, userStates: any) => Promise<void>;
  handleScroll: (columnType: string, scrollElement: HTMLElement) => void;
  getVisibleItems: (columnType: string, allItems: HiringIntent[], visibleCount: number) => HiringIntent[];
  preloadThreshold: number;
}

const VISIBLE_ITEMS = 20;
const BUFFER_SIZE = 10;
const PRELOAD_THRESHOLD = 0.8; // Load more when 80% scrolled

export function useBufferPreloading(): UseBufferPreloadingReturn {
  const [bufferSizes, setBufferSizes] = useState<Record<string, number>>({
    signals: 0,
    actions: 0,
    completed: 0,
    aborted: 0,
    hidden: 0,
  });

  const [isPreloading, setIsPreloading] = useState<Record<string, boolean>>({
    signals: false,
    actions: false,
    completed: false,
    aborted: false,
    hidden: false,
  });

  const preloadingRef = useRef<Record<string, boolean>>({
    signals: false,
    actions: false,
    completed: false,
    aborted: false,
    hidden: false,
  });

  const offsetRef = useRef<Record<string, number>>({
    signals: VISIBLE_ITEMS,
    actions: VISIBLE_ITEMS,
    completed: VISIBLE_ITEMS,
    aborted: VISIBLE_ITEMS,
    hidden: VISIBLE_ITEMS,
  });

  const loadMoreItems = useCallback(async (
    columnType: string,
    currentItems: HiringIntent[],
    spaceId: number | null,
    userStates: any
  ) => {
    // Prevent duplicate preload requests
    if (preloadingRef.current[columnType]) {
      return;
    }

    preloadingRef.current[columnType] = true;
    setIsPreloading(prev => ({ ...prev, [columnType]: true }));

    try {
      const currentOffset = offsetRef.current[columnType];
      
      const result = await getHiringIntentsBySpace(spaceId, EXTERNAL.directus_url, {
        limit: BUFFER_SIZE,
        offset: currentOffset,
        columnType: columnType as any,
        categorizedIds: userStates,
      });

      if (result.success && result.hiringIntents && result.hiringIntents.length > 0) {
        // Update buffer size
        setBufferSizes(prev => ({
          ...prev,
          [columnType]: result.hiringIntents!.length,
        }));

        // Update offset for next request
        offsetRef.current[columnType] += BUFFER_SIZE;

        // Emit custom event for the dashboard to handle
        window.dispatchEvent(new CustomEvent('orbit-signal-buffer-loaded', {
          detail: {
            columnType,
            items: result.hiringIntents,
          }
        }));
      } else {
        // No more items available
        setBufferSizes(prev => ({
          ...prev,
          [columnType]: 0,
        }));
      }
    } catch (error) {
      console.error(`Failed to preload ${columnType}:`, error);
    } finally {
      preloadingRef.current[columnType] = false;
      setIsPreloading(prev => ({ ...prev, [columnType]: false }));
    }
  }, []);

  const handleScroll = useCallback((columnType: string, scrollElement: HTMLElement) => {
    const scrollTop = scrollElement.scrollTop;
    const scrollHeight = scrollElement.scrollHeight;
    const clientHeight = scrollElement.clientHeight;

    if (scrollHeight <= clientHeight) return; // No scrollable content

    const scrollPercentage = scrollTop / (scrollHeight - clientHeight);

    // Trigger preload when threshold is reached
    if (scrollPercentage >= PRELOAD_THRESHOLD && !preloadingRef.current[columnType]) {
      // Emit event to trigger preload
      window.dispatchEvent(new CustomEvent('orbit-signal-preload-requested', {
        detail: { columnType }
      }));
    }
  }, []);

  const getVisibleItems = useCallback((
    columnType: string, 
    allItems: HiringIntent[], 
    visibleCount: number = VISIBLE_ITEMS
  ): HiringIntent[] => {
    return allItems.slice(0, visibleCount + bufferSizes[columnType]);
  }, [bufferSizes]);

  // Reset offsets and buffers when space changes
  const resetBuffers = useCallback(() => {
    offsetRef.current = {
      signals: VISIBLE_ITEMS,
      actions: VISIBLE_ITEMS,
      completed: VISIBLE_ITEMS,
      aborted: VISIBLE_ITEMS,
      hidden: VISIBLE_ITEMS,
    };

    setBufferSizes({
      signals: 0,
      actions: 0,
      completed: 0,
      aborted: 0,
      hidden: 0,
    });

    preloadingRef.current = {
      signals: false,
      actions: false,
      completed: false,
      aborted: false,
      hidden: false,
    };
  }, []);

  // Listen for space changes to reset buffers
  useEffect(() => {
    const handleSpaceChange = () => {
      resetBuffers();
    };

    window.addEventListener('orbit-signal-space-changed', handleSpaceChange);
    return () => {
      window.removeEventListener('orbit-signal-space-changed', handleSpaceChange);
    };
  }, [resetBuffers]);

  return {
    bufferSizes,
    isPreloading,
    loadMoreItems,
    handleScroll,
    getVisibleItems,
    preloadThreshold: PRELOAD_THRESHOLD,
  };
}

// Utility function to create scroll handlers for Kanban columns
export const createScrollHandler = (
  columnType: string,
  handleScroll: (columnType: string, element: HTMLElement) => void
) => {
  return (element: HTMLElement | null) => {
    if (!element) return;

    // Remove existing listener
    const existingHandler = (element as any)._orbitScrollHandler;
    if (existingHandler) {
      element.removeEventListener('scroll', existingHandler);
    }

    // Create new handler
    const handler = () => handleScroll(columnType, element);
    (element as any)._orbitScrollHandler = handler;

    // Add listener
    element.addEventListener('scroll', handler, { passive: true });

    // Initial preload check
    requestAnimationFrame(() => {
      handler();
    });
  };
};

// Utility function to check if more items need preloading
export const shouldPreloadMore = (
  currentItems: HiringIntent[],
  visibleCount: number,
  bufferSize: number,
  isPreloading: boolean
): boolean => {
  const totalAvailable = currentItems.length;
  const needed = visibleCount + bufferSize;
  return totalAvailable < needed && !isPreloading;
};