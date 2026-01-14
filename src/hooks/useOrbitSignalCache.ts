"use client";

import { useState, useEffect, useCallback } from "react";
import type { HiringIntent, CategorizedIntentIds } from "@/lib/utils";

interface OrbitSignalCache {
  version: string;
  timestamp: number;
  spaceId: string | null;
  userStates: CategorizedIntentIds;
  columns: {
    signals: HiringIntent[];
    actions: HiringIntent[];
    completed: HiringIntent[];
    aborted: HiringIntent[];
    hidden: HiringIntent[];
  };
  lastFetchTimes: Record<string, number>;
  buffer: {
    [column: string]: HiringIntent[];
  };
}

interface UseOrbitSignalCacheReturn {
  cache: OrbitSignalCache | null;
  getCachedData: (spaceId: string | null) => {
    columns: OrbitSignalCache['columns'];
    userStates: CategorizedIntentIds;
    fromCache: boolean;
  };
  setCachedData: (spaceId: string | null, data: {
    columns: OrbitSignalCache['columns'];
    userStates: CategorizedIntentIds;
  }) => void;
  invalidateCache: (spaceId?: string | null) => void;
  getBufferedItems: (columnType: string, count: number) => HiringIntent[];
  addToBuffer: (columnType: string, items: HiringIntent[]) => void;
  isCacheValid: (timestamp: number) => boolean;
}

const CACHE_KEY = "orbit-signal-cache";
const CACHE_VERSION = "1.0.0";
const CACHE_DURATION = 60 * 1000; // 1 minute
const BUFFER_SIZE = 10;

export function useOrbitSignalCache(): UseOrbitSignalCacheReturn {
  const [cache, setCache] = useState<OrbitSignalCache | null>(null);

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const storedCache = localStorage.getItem(CACHE_KEY);
      if (storedCache) {
        const parsedCache = JSON.parse(storedCache) as OrbitSignalCache;
        
        // Validate cache version and delete if incompatible
        if (parsedCache.version !== CACHE_VERSION) {
          localStorage.removeItem(CACHE_KEY);
          return;
        }
        
        setCache(parsedCache);
      }
    } catch (error) {
      console.warn("Failed to load Orbit Signal cache:", error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    if (cache) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (error) {
        console.warn("Failed to save Orbit Signal cache:", error);
      }
    }
  }, [cache]);

  const isCacheValid = useCallback((timestamp: number): boolean => {
    return Date.now() - timestamp < CACHE_DURATION;
  }, []);

  const getCachedData = useCallback((spaceId: string | null) => {
    if (!cache || cache.spaceId !== spaceId) {
      return {
        columns: {
          signals: [],
          actions: [],
          completed: [],
          aborted: [],
          hidden: [],
        },
        userStates: {
          actionedIds: [],
          hiddenIds: [],
          completedIds: [],
          abortedIds: [],
          allIds: [],
        },
        fromCache: false,
      };
    }

    const cacheValid = isCacheValid(cache.timestamp);
    
    if (!cacheValid) {
      return {
        columns: {
          signals: [],
          actions: [],
          completed: [],
          aborted: [],
          hidden: [],
        },
        userStates: cache.userStates, // User states can be stale longer
        fromCache: false,
      };
    }

    return {
      columns: cache.columns,
      userStates: cache.userStates,
      fromCache: true,
    };
  }, [cache, isCacheValid]);

  const setCachedData = useCallback((
    spaceId: string | null, 
    data: {
      columns: OrbitSignalCache['columns'];
      userStates: CategorizedIntentIds;
    }
  ) => {
    const newCache: OrbitSignalCache = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      spaceId,
      userStates: data.userStates,
      columns: data.columns,
      lastFetchTimes: {
        signals: Date.now(),
        actions: Date.now(),
        completed: Date.now(),
        aborted: Date.now(),
        hidden: Date.now(),
      },
      buffer: cache?.buffer || {
        signals: [],
        actions: [],
        completed: [],
        aborted: [],
        hidden: [],
      },
    };

    setCache(newCache);
  }, [cache?.buffer]);

  const invalidateCache = useCallback((spaceId?: string | null) => {
    if (!spaceId || (cache && cache.spaceId === spaceId)) {
      setCache(null);
      localStorage.removeItem(CACHE_KEY);
    }
  }, [cache]);

  const getBufferedItems = useCallback((columnType: string, count: number) => {
    if (!cache?.buffer[columnType]) return [];
    return cache.buffer[columnType].slice(0, count);
  }, [cache?.buffer]);

  const addToBuffer = useCallback((columnType: string, items: HiringIntent[]) => {
    if (!cache) return;

    const existingBuffer = cache.buffer[columnType] || [];
    const newBuffer = [...existingBuffer, ...items].slice(-BUFFER_SIZE * 2); // Keep buffer size reasonable

    setCache({
      ...cache,
      buffer: {
        ...cache.buffer,
        [columnType]: newBuffer,
      },
    });
  }, [cache]);

  return {
    cache,
    getCachedData,
    setCachedData,
    invalidateCache,
    getBufferedItems,
    addToBuffer,
    isCacheValid,
  };
}

// Utility function for manual cache management
export const clearOrbitSignalCache = () => {
  localStorage.removeItem(CACHE_KEY);
};