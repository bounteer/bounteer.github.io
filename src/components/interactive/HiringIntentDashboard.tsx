"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Loader2, Wifi, WifiOff } from "lucide-react";
import SpaceSelector from "@/components/interactive/SpaceSelector";
import { SignalCard } from "@/components/interactive/SignalCard";
import { ActionCard } from "@/components/interactive/ActionCard";
import { ContactCard } from "@/components/interactive/ContactCard";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KanbanBoard,
  KanbanBoardProvider,
  KanbanBoardColumn,
  KanbanBoardColumnHeader,
  KanbanBoardColumnTitle,
  KanbanBoardColumnList,
  KanbanBoardColumnListItem,
  KanbanBoardCard,
  KanbanColorCircle,
} from "@/components/ui/kanban";
import {
  getHiringIntentsBySpace,
  getUserHiringIntentStates,
  updateHiringIntentUserState,
  getHiringIntentActions,
  type HiringIntent,
} from "@/lib/utils";
import { EXTERNAL } from "@/constant";

// Import new optimization hooks
import { useOrbitSignalCache } from "@/hooks/useOrbitSignalCache";
import { useOptimisticUpdates } from "@/hooks/useOptimisticUpdates";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { useBufferPreloading, createScrollHandler } from "@/hooks/useBufferPreloading";

type MobileTab = "signals" | "actions" | "completed" | "aborted" | "hidden";

export default function HiringIntentDashboard() {
  const [signalIntents, setSignalIntents] = useState<HiringIntent[]>([]);
  const [actionIntents, setActionIntents] = useState<HiringIntent[]>([]);
  const [completedIntents, setCompletedIntents] = useState<HiringIntent[]>([]);
  const [abortedIntents, setAbortedIntents] = useState<HiringIntent[]>([]);
  const [hiddenIntents, setHiddenIntents] = useState<HiringIntent[]>([]);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const ITEMS_LIMIT = 20;

  // Mobile-only
  const [mobileTab, setMobileTab] = useState<MobileTab>("signals");

  // Quota limit dialog
  const [showQuotaDialog, setShowQuotaDialog] = useState(false);
  const ACTION_QUOTA_LIMIT = 10;

  // Desktop-only - which columns to show
  const [visibleColumns, setVisibleColumns] = useState<{
    signals: boolean;
    actions: boolean;
    completed: boolean;
    aborted: boolean;
    hidden: boolean;
  }>({
    signals: true,
    actions: true,
    completed: false,
    aborted: false,
    hidden: false,
  });

  // 🚀 New optimization hooks
  const { getCachedData, setCachedData, invalidateCache, getBufferedItems, addToBuffer, isCacheValid } = useOrbitSignalCache();
  const { pendingUpdates, handleOptimisticMove, rollbackUpdate, isUpdating } = useOptimisticUpdates();
  const { isOnline, pendingSyncItems, lastSyncTime, syncInProgress, performBackgroundSync, addToSyncQueue } = useBackgroundSync(
    selectedSpaceId,
    (hasConflicts) => {
      if (hasConflicts) {
        console.warn("Data conflicts detected during sync");
        // Could show a toast notification here
      }
    }
  );
  const { bufferSizes, isPreloading, loadMoreItems, handleScroll, getVisibleItems } = useBufferPreloading();

  // Refs for scroll elements
  const scrollElementsRef = useRef<Record<string, HTMLElement | null>>({});

  // Column items helper
  const getColumnItems = useCallback(() => ({
    signals: signalIntents,
    actions: actionIntents,
    completed: completedIntents,
    aborted: abortedIntents,
    hidden: hiddenIntents,
  }), [signalIntents, actionIntents, completedIntents, abortedIntents, hiddenIntents]);

  const setColumnItems = useCallback((updates: Partial<Record<string, HiringIntent[]>>) => {
    if (updates.signals !== undefined) setSignalIntents(updates.signals);
    if (updates.actions !== undefined) setActionIntents(updates.actions);
    if (updates.completed !== undefined) setCompletedIntents(updates.completed);
    if (updates.aborted !== undefined) setAbortedIntents(updates.aborted);
    if (updates.hidden !== undefined) setHiddenIntents(updates.hidden);
  }, []);

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  // Emit space change event for buffer management
  const emitSpaceChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent('orbit-signal-space-changed'));
  }, []);

  useEffect(() => {
    emitSpaceChange();
  }, [selectedSpaceId, selectedCategory, emitSpaceChange]);

  // 🚀 Optimized fetch with caching
  const fetchHiringIntents = useCallback(async (forceRefresh = false) => {
    // Don't show loading spinner for background refreshes
    if (initialLoad) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const spaceIdNumber =
        selectedSpaceId && selectedSpaceId !== "all"
          ? parseInt(selectedSpaceId)
          : null;

      // Check cache first (unless force refresh)
      if (!forceRefresh && !initialLoad) {
        const cachedData = getCachedData(selectedSpaceId);
        if (cachedData.fromCache) {
          const filterByCategory = (list: HiringIntent[]) =>
            selectedCategory === "all"
              ? list
              : list.filter((i) => i.category === selectedCategory);

          setSignalIntents(filterByCategory(cachedData.columns.signals));
          setActionIntents(filterByCategory(cachedData.columns.actions));
          setCompletedIntents(filterByCategory(cachedData.columns.completed));
          setAbortedIntents(filterByCategory(cachedData.columns.aborted));
          setHiddenIntents(filterByCategory(cachedData.columns.hidden));

          if (initialLoad) {
            setIsLoading(false);
            setInitialLoad(false);
          }
          return;
        }

        // Use cached user states even if column data is stale
        if (cachedData.userStates) {
          // Only fetch fresh column data
        }
      }

      // Fetch fresh data
      const userStatesResult = await getUserHiringIntentStates(
        EXTERNAL.directus_url
      );

      if (!userStatesResult.success || !userStatesResult.categories) {
        setError("Failed to fetch user states");
        return;
      }

      const [signals, actions, completed, aborted, hidden] = await Promise.all([
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: ITEMS_LIMIT,
          offset: 0,
          columnType: "signals",
          categorizedIds: userStatesResult.categories,
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: ITEMS_LIMIT,
          offset: 0,
          columnType: "actions",
          categorizedIds: userStatesResult.categories,
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: ITEMS_LIMIT,
          offset: 0,
          columnType: "completed",
          categorizedIds: userStatesResult.categories,
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: ITEMS_LIMIT,
          offset: 0,
          columnType: "aborted",
          categorizedIds: userStatesResult.categories,
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: ITEMS_LIMIT,
          offset: 0,
          columnType: "hidden",
          categorizedIds: userStatesResult.categories,
        }),
      ]);

      if (signals.success && actions.success && completed.success && aborted.success && hidden.success) {
        const filterByCategory = (list: HiringIntent[]) =>
          selectedCategory === "all"
            ? list
            : list.filter((i) => i.category === selectedCategory);

        const s = filterByCategory(signals.hiringIntents || []);
        const a = filterByCategory(actions.hiringIntents || []);
        const c = filterByCategory(completed.hiringIntents || []);
        const ab = filterByCategory(aborted.hiringIntents || []);
        const h = filterByCategory(hidden.hiringIntents || []);

        setSignalIntents(s);
        setActionIntents(a);
        setCompletedIntents(c);
        setAbortedIntents(ab);
        setHiddenIntents(h);

        // Cache the results
        setCachedData(selectedSpaceId, {
          columns: {
            signals: s,
            actions: a,
            completed: c,
            aborted: ab,
            hidden: h,
          },
          userStates: userStatesResult.categories,
        });
      } else {
        setError("Failed to fetch orbit signals");
      }
    } catch (err) {
      setError("Error fetching orbit signals");
      console.error(err);
    } finally {
      if (initialLoad) {
        setIsLoading(false);
        setInitialLoad(false);
      }
    }
  }, [selectedSpaceId, selectedCategory, getCachedData, setCachedData, initialLoad]);

  // 🚀 Optimized action handlers with optimistic updates
  const handleAddToActions = useCallback(async (intentId: number) => {
    // Check if we've reached the quota limit
    if (actionIntents.length >= ACTION_QUOTA_LIMIT) {
      setShowQuotaDialog(true);
      return;
    }

    const currentItems = getColumnItems();
    const success = await handleOptimisticMove(
      intentId,
      'signals',
      'actions',
      currentItems,
      setColumnItems
    );

    if (!success) {
      // Error is already handled in the hook
      return;
    }

    // Add to sync queue for backup
    addToSyncQueue({
      intentId,
      fromColumn: 'signals',
      toColumn: 'actions',
    });

    // Invalidate cache to force refresh on next load
    invalidateCache(selectedSpaceId);
  }, [actionIntents.length, getColumnItems, handleOptimisticMove, setColumnItems, addToSyncQueue, invalidateCache, selectedSpaceId]);

  const handleSkip = useCallback(async (intentId: number) => {
    const currentItems = getColumnItems();
    const success = await handleOptimisticMove(
      intentId,
      'signals',
      'hidden',
      currentItems,
      setColumnItems
    );

    if (!success) {
      return;
    }

    // Add to sync queue for backup
    addToSyncQueue({
      intentId,
      fromColumn: 'signals',
      toColumn: 'hidden',
    });

    // Invalidate cache to force refresh on next load
    invalidateCache(selectedSpaceId);
  }, [getColumnItems, handleOptimisticMove, setColumnItems, addToSyncQueue, invalidateCache, selectedSpaceId]);

  const handleMoveToCompleted = useCallback(async (intentId: number) => {
    const currentItems = getColumnItems();
    const success = await handleOptimisticMove(
      intentId,
      'actions',
      'completed',
      currentItems,
      setColumnItems
    );

    if (!success) {
      return;
    }

    // Add to sync queue for backup
    addToSyncQueue({
      intentId,
      fromColumn: 'actions',
      toColumn: 'completed',
    });

    // Invalidate cache to force refresh on next load
    invalidateCache(selectedSpaceId);
  }, [getColumnItems, handleOptimisticMove, setColumnItems, addToSyncQueue, invalidateCache, selectedSpaceId]);

  const handleMoveToAborted = useCallback(async (intentId: number, reason?: string) => {
    const currentItems = getColumnItems();
    const success = await handleOptimisticMove(
      intentId,
      'actions',
      'aborted',
      currentItems,
      setColumnItems
    );

    if (!success) {
      return;
    }

    // Add to sync queue for backup
    addToSyncQueue({
      intentId,
      fromColumn: 'actions',
      toColumn: 'aborted',
      metadata: reason ? { abortReason: reason } : undefined,
    });

    // Invalidate cache to force refresh on next load
    invalidateCache(selectedSpaceId);
  }, [getColumnItems, handleOptimisticMove, setColumnItems, addToSyncQueue, invalidateCache, selectedSpaceId]);

  // 🚀 Buffer loading listeners
  useEffect(() => {
    const handleBufferLoaded = (e: CustomEvent) => {
      const { columnType, items } = e.detail;
      addToBuffer(columnType, items);
    };

    const handlePreloadRequested = (e: CustomEvent) => {
      const { columnType } = e.detail;
      const currentItems = getColumnItems();
      
      loadMoreItems(
        columnType,
        currentItems[columnType as keyof typeof currentItems],
        selectedSpaceId && selectedSpaceId !== "all" ? parseInt(selectedSpaceId) : null,
        {} // User states would need to be passed here
      );
    };

    window.addEventListener('orbit-signal-buffer-loaded', handleBufferLoaded as EventListener);
    window.addEventListener('orbit-signal-preload-requested', handlePreloadRequested as EventListener);

    return () => {
      window.removeEventListener('orbit-signal-buffer-loaded', handleBufferLoaded as EventListener);
      window.removeEventListener('orbit-signal-preload-requested', handlePreloadRequested as EventListener);
    };
  }, [addToBuffer, getColumnItems, loadMoreItems, selectedSpaceId]);

  // Scroll handler setup
  const setupScrollHandler = useCallback((columnType: string) => {
    return (element: HTMLElement | null) => {
      if (element) {
        scrollElementsRef.current[columnType] = element;
        createScrollHandler(columnType, handleScroll)(element);
      }
    };
  }, [handleScroll]);

  // Initial fetch
  useEffect(() => {
    fetchHiringIntents();
  }, [selectedSpaceId, selectedCategory, fetchHiringIntents]);

  return (
    <div className="space-y-6">
      {/* Page Header with Status */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Orbit Signal
          </h1>
          {/* Combined status indicator */}
          <div className="flex items-center gap-2 text-sm">
            {syncInProgress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-blue-600">Syncing...</span>
              </>
            ) : isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-gray-600">Offline</span>
              </>
            )}
          </div>
        </div>
        <p className="text-xs md:text-sm text-muted-foreground">
          Manage and review orbit signals from your organization.
        </p>
      </div>

      {/* Filters + Desktop toggle */}
      <div className="flex flex-wrap items-center gap-4">
        <SpaceSelector
          onSpaceChange={setSelectedSpaceId}
          selectedSpaceId={selectedSpaceId}
          showAllOption
          countTags={["hiring_intent"]}
        />

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All categories</option>
          <option value="funding">Funding</option>
          <option value="growth">Growth</option>
          <option value="replacement">Replacement</option>
          <option value="hiring">Hiring</option>
          <option value="other">Other</option>
        </select>

        {/* Desktop-only column visibility dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden md:inline-flex items-center gap-2 text-sm text-gray-600 border px-3 py-1.5 rounded-md hover:bg-gray-100">
              Show Columns
              <ChevronDown className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={visibleColumns.signals}
              onCheckedChange={() => toggleColumn('signals')}
            >
              Signals ({signalIntents.length})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.actions}
              onCheckedChange={() => toggleColumn('actions')}
            >
              Actions ({actionIntents.length})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.completed}
              onCheckedChange={() => toggleColumn('completed')}
            >
              Completed ({completedIntents.length})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.aborted}
              onCheckedChange={() => toggleColumn('aborted')}
            >
              Aborted ({abortedIntents.length})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.hidden}
              onCheckedChange={() => toggleColumn('hidden')}
            >
              Hidden ({hiddenIntents.length})
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Loading state */}
      {isLoading && initialLoad && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-lg">Loading Orbit Signals...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <span className="font-medium">Error:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main content - only show after initial load */}
      {!isLoading && !error && (
        <>
          {/* DESKTOP KANBAN BOARD */}
          <KanbanBoardProvider>
            <div className="hidden md:block">
              <KanbanBoard>
                {/* Signals Column */}
                {visibleColumns.signals && (
                  <KanbanBoardColumn columnId="signals" className="w-96">
                    <KanbanBoardColumnHeader>
                      <KanbanBoardColumnTitle columnId="signals">
                        Signals ({getVisibleItems('signals', signalIntents, ITEMS_LIMIT).length})
                        {isPreloading.signals && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                      </KanbanBoardColumnTitle>
                    </KanbanBoardColumnHeader>
                    <KanbanBoardColumnList ref={setupScrollHandler('signals')}>
                      {getVisibleItems('signals', signalIntents, ITEMS_LIMIT).map((intent) => (
                        <KanbanBoardColumnListItem key={intent.id} cardId={`${intent.id}`}>
                          <KanbanBoardCard data={{ id: intent.id.toString() }}>
                            <SignalCard
                              intent={intent}
                              onAddToActions={handleAddToActions}
                              onSkip={handleSkip}
                              isUpdating={isUpdating(intent.id)}
                              hasPendingUpdate={pendingUpdates.some(u => u.intentId === intent.id && u.status === 'pending')}
                            />
                          </KanbanBoardCard>
                        </KanbanBoardColumnListItem>
                      ))}
                    </KanbanBoardColumnList>
                  </KanbanBoardColumn>
                )}

                {/* Actions Column */}
                {visibleColumns.actions && (
                  <KanbanBoardColumn columnId="actions" className="w-[520px]">
                    <KanbanBoardColumnHeader>
                      <KanbanBoardColumnTitle columnId="actions">
                        Actions ({getVisibleItems('actions', actionIntents, ITEMS_LIMIT).length})
                        {isPreloading.actions && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                      </KanbanBoardColumnTitle>
                    </KanbanBoardColumnHeader>
                    <KanbanBoardColumnList ref={setupScrollHandler('actions')}>
                      {getVisibleItems('actions', actionIntents, ITEMS_LIMIT).map((intent) => (
                         <KanbanBoardColumnListItem key={intent.id} cardId={`${intent.id}`}>
                           <KanbanBoardCard data={{ id: intent.id.toString() }} className="p-4">
                             <ActionCard
                               intent={intent}
                               columnType="actions"
                               onMoveToCompleted={handleMoveToCompleted}
                               onMoveToAborted={handleMoveToAborted}
                             />
                           </KanbanBoardCard>
                         </KanbanBoardColumnListItem>
                      ))}
                    </KanbanBoardColumnList>
                  </KanbanBoardColumn>
                )}

                {/* Completed Column */}
                {visibleColumns.completed && (
                  <KanbanBoardColumn columnId="completed" className="w-72">
                    <KanbanBoardColumnHeader>
                      <KanbanBoardColumnTitle columnId="completed">
                        Completed ({getVisibleItems('completed', completedIntents, ITEMS_LIMIT).length})
                      </KanbanBoardColumnTitle>
                    </KanbanBoardColumnHeader>
                    <KanbanBoardColumnList ref={setupScrollHandler('completed')}>
                      {getVisibleItems('completed', completedIntents, ITEMS_LIMIT).map((intent) => (
                        <KanbanBoardColumnListItem key={intent.id} cardId={`${intent.id}`}>
                          <KanbanBoardCard data={{ id: intent.id.toString() }} className="p-4">
                            <ActionCard
                              intent={intent}
                              columnType="completed"
                            />
                          </KanbanBoardCard>
                        </KanbanBoardColumnListItem>
                      ))}
                    </KanbanBoardColumnList>
                  </KanbanBoardColumn>
                )}

                {/* Aborted Column */}
                {visibleColumns.aborted && (
                  <KanbanBoardColumn columnId="aborted" className="w-72">
                    <KanbanBoardColumnHeader>
                      <KanbanBoardColumnTitle columnId="aborted">
                        Aborted ({getVisibleItems('aborted', abortedIntents, ITEMS_LIMIT).length})
                      </KanbanBoardColumnTitle>
                    </KanbanBoardColumnHeader>
                    <KanbanBoardColumnList ref={setupScrollHandler('aborted')}>
                      {getVisibleItems('aborted', abortedIntents, ITEMS_LIMIT).map((intent) => (
                        <KanbanBoardColumnListItem key={intent.id} cardId={`${intent.id}`}>
                          <KanbanBoardCard data={{ id: intent.id.toString() }} className="p-4">
                            <ActionCard
                              intent={intent}
                              columnType="aborted"
                            />
                          </KanbanBoardCard>
                        </KanbanBoardColumnListItem>
                      ))}
                    </KanbanBoardColumnList>
                  </KanbanBoardColumn>
                )}

                {/* Hidden Column */}
                {visibleColumns.hidden && (
                  <KanbanBoardColumn columnId="hidden" className="w-72">
                    <KanbanBoardColumnHeader>
                      <KanbanBoardColumnTitle columnId="hidden">
                        Hidden ({getVisibleItems('hidden', hiddenIntents, ITEMS_LIMIT).length})
                      </KanbanBoardColumnTitle>
                    </KanbanBoardColumnHeader>
                    <KanbanBoardColumnList ref={setupScrollHandler('hidden')}>
                      {getVisibleItems('hidden', hiddenIntents, ITEMS_LIMIT).map((intent) => (
                        <KanbanBoardColumnListItem key={intent.id} cardId={`${intent.id}`}>
                          <KanbanBoardCard data={{ id: intent.id.toString() }}>
                            <SignalCard
                              intent={intent}
                              onAddToActions={() => {}}
                              onSkip={() => {}}
                              showActionButtons={false}
                              isHidden={true}
                            />
                          </KanbanBoardCard>
                        </KanbanBoardColumnListItem>
                      ))}
                    </KanbanBoardColumnList>
                  </KanbanBoardColumn>
                )}
              </KanbanBoard>
            </div>
          </KanbanBoardProvider>

          {/* MOBILE VIEW */}
          <div className="md:hidden">
            {/* Mobile Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {([
                ["signals", "Signals", getVisibleItems('signals', signalIntents, ITEMS_LIMIT).length],
                ["actions", "Actions", getVisibleItems('actions', actionIntents, ITEMS_LIMIT).length],
                ["completed", "Completed", getVisibleItems('completed', completedIntents, ITEMS_LIMIT).length],
                ["aborted", "Aborted", getVisibleItems('aborted', abortedIntents, ITEMS_LIMIT).length],
                ["hidden", "Hidden", getVisibleItems('hidden', hiddenIntents, ITEMS_LIMIT).length],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setMobileTab(key)}
                  className={`px-3 py-1.5 rounded-full text-sm border whitespace-nowrap
                    ${mobileTab === key
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            {/* Mobile Content */}
            <div className="space-y-3 mt-4">
              {mobileTab === 'signals' && (
                <div className="space-y-3">
                  {getVisibleItems('signals', signalIntents, ITEMS_LIMIT).map((intent) => (
                    <div key={intent.id} className="w-full rounded-2xl border border-border bg-background p-3 text-start text-foreground shadow-sm">
                      <SignalCard
                        intent={intent}
                        onAddToActions={handleAddToActions}
                        onSkip={handleSkip}
                        isUpdating={isUpdating(intent.id)}
                        hasPendingUpdate={pendingUpdates.some(u => u.intentId === intent.id && u.status === 'pending')}
                      />
                    </div>
                  ))}
                </div>
              )}



              {mobileTab === 'actions' && (
                <div className="space-y-3">
                  {getVisibleItems('actions', actionIntents, ITEMS_LIMIT).map((intent) => (
                    <div key={intent.id} className="w-full rounded-2xl border border-border bg-background p-3 text-start text-foreground shadow-sm">
                      <ActionCard
                        intent={intent}
                        columnType="actions"
                        onMoveToCompleted={handleMoveToCompleted}
                        onMoveToAborted={handleMoveToAborted}
                      />
                    </div>
                  ))}
                </div>
              )}

              {mobileTab === 'completed' && (
                <div className="space-y-3">
                  {getVisibleItems('completed', completedIntents, ITEMS_LIMIT).map((intent) => (
                    <div key={intent.id} className="w-full rounded-2xl border border-border bg-background p-3 text-start text-foreground shadow-sm">
                      <ActionCard
                        intent={intent}
                        columnType="completed"
                      />
                    </div>
                  ))}
                </div>
              )}

              {mobileTab === 'aborted' && (
                <div className="space-y-3">
                  {getVisibleItems('aborted', abortedIntents, ITEMS_LIMIT).map((intent) => (
                    <div key={intent.id} className="w-full rounded-2xl border border-border bg-background p-3 text-start text-foreground shadow-sm">
                      <ActionCard
                        intent={intent}
                        columnType="aborted"
                      />
                    </div>
                  ))}
                </div>
              )}

              {mobileTab === 'hidden' && (
                <div className="space-y-3">
                  {getVisibleItems('hidden', hiddenIntents, ITEMS_LIMIT).map((intent) => (
                    <div key={intent.id} className="w-full rounded-2xl border border-border bg-background p-3 text-start text-foreground shadow-sm">
                      <SignalCard
                        intent={intent}
                        onAddToActions={() => {}}
                        onSkip={() => {}}
                        showActionButtons={false}
                        isHidden={true}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Quota Limit Dialog */}
      <Dialog open={showQuotaDialog} onOpenChange={setShowQuotaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Action Limit Reached</DialogTitle>
            <DialogDescription>
              You've reached the maximum of {ACTION_QUOTA_LIMIT} actions. Please complete or abort existing actions before adding new ones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowQuotaDialog(false)}
              className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
            >
              Got it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}