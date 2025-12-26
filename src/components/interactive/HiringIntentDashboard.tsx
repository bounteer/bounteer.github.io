"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SpaceSelector from "@/components/interactive/SpaceSelector";
import { SignalCard } from "@/components/interactive/SignalCard";
import { ActionCard } from "@/components/interactive/ActionCard";
import { PaginationControls } from "@/components/interactive/PaginationControls";
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
import { getHiringIntentsBySpace, getUserHiringIntentStates, updateHiringIntentUserState, deleteHiringIntentUserState, createHiringIntentAction, getUserProfile, type HiringIntent, type HiringIntentAction } from "@/lib/utils";
import { createGenericSaveRequest } from "@/client_side/fetch/generic_request";
import { EXTERNAL } from "@/constant";

export default function HiringIntentDashboard() {
  const [signalIntents, setSignalIntents] = useState<HiringIntent[]>([]);
  const [actionIntents, setActionIntents] = useState<HiringIntent[]>([]);
  const [hiddenIntents, setHiddenIntents] = useState<HiringIntent[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchHiringIntents();
  }, [selectedSpaceId, currentPage, itemsPerPage]);

  const fetchHiringIntents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const spaceIdNumber = selectedSpaceId && selectedSpaceId !== "all" ? parseInt(selectedSpaceId) : null;
      const offset = (currentPage - 1) * itemsPerPage;

      // First, fetch user states ONCE
      const userStatesResult = await getUserHiringIntentStates(EXTERNAL.directus_url);
      if (!userStatesResult.success || !userStatesResult.categories) {
        setError(userStatesResult.error || "Failed to fetch user states");
        return;
      }

      // Now fetch all three columns in parallel, reusing the categorized IDs
      const [signalsResult, actionsResult, hiddenResult] = await Promise.all([
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: itemsPerPage,
          offset: offset,
          columnType: 'signals',
          categorizedIds: userStatesResult.categories
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: itemsPerPage,
          offset: offset,
          columnType: 'actions',
          categorizedIds: userStatesResult.categories
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: itemsPerPage,
          offset: offset,
          columnType: 'hidden',
          categorizedIds: userStatesResult.categories
        })
      ]);

      if (signalsResult.success && actionsResult.success && hiddenResult.success) {
        setSignalIntents(signalsResult.hiringIntents || []);
        setActionIntents(actionsResult.hiringIntents || []);
        setHiddenIntents(hiddenResult.hiringIntents || []);
        // Total count is sum of all three columns
        setTotalCount(
          (signalsResult.totalCount || 0) +
          (actionsResult.totalCount || 0) +
          (hiddenResult.totalCount || 0)
        );
      } else {
        setError(
          signalsResult.error || actionsResult.error || hiddenResult.error ||
          "Failed to fetch orbit signals"
        );
      }
    } catch (err) {
      setError("An error occurred while fetching orbit signals");
      console.error("Error fetching orbit signals:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpaceChange = (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
    setCurrentPage(1); // Reset to first page when changing space
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleDropOverColumn = async (columnId: string, dataTransferData: string) => {
    try {
      const data = JSON.parse(dataTransferData);
      const hiringIntentId = parseInt(data.id);
      const fromColumn = data.columnId;

      // Moving from Signals to Actions
      if (fromColumn === "signals" && columnId === "actions") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'actioned', EXTERNAL.directus_url);
        if (result.success) {
          // Optimistically update the UI
          const movedIntent = signalIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            setSignalIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setActionIntents(prev => [...prev, movedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move signal to actions');
        }
      }
      // Moving from Signals to Hidden
      else if (fromColumn === "signals" && columnId === "hidden") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'hidden', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = signalIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            setSignalIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setHiddenIntents(prev => [...prev, movedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move signal to hidden');
        }
      }
      // Moving from Actions to Signals
      else if (fromColumn === "actions" && columnId === "signals") {
        const result = await deleteHiringIntentUserState(hiringIntentId, EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = actionIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            setActionIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setSignalIntents(prev => [...prev, movedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move action to signals');
        }
      }
      // Moving from Actions to Hidden
      else if (fromColumn === "actions" && columnId === "hidden") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'hidden', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = actionIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            setActionIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setHiddenIntents(prev => [...prev, movedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move action to hidden');
        }
      }
      // Moving from Hidden to Signals
      else if (fromColumn === "hidden" && columnId === "signals") {
        const result = await deleteHiringIntentUserState(hiringIntentId, EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = hiddenIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            setHiddenIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setSignalIntents(prev => [...prev, movedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move hidden to signals');
        }
      }
      // Moving from Hidden to Actions
      else if (fromColumn === "hidden" && columnId === "actions") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'actioned', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = hiddenIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            setHiddenIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setActionIntents(prev => [...prev, movedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move hidden to actions');
        }
      }
    } catch (err) {
      console.error('Error handling drop:', err);
      setError('An error occurred while moving the signal');
    }
  };

  const handleActionStatusUpdate = async (
    hiringIntentId: number,
    actionType: 'completed' | 'skipped'
  ) => {
    try {
      // Update user state based on action type
      if (actionType === 'completed') {
        // Move to Actions column
        const result = await updateHiringIntentUserState(hiringIntentId, 'actioned', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = signalIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            setSignalIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setActionIntents(prev => [...prev, movedIntent]);
          }

          // Get current user profile for generic request
          const user = await getUserProfile(EXTERNAL.directus_url);
          if (user) {
            const payload = {
              intent: hiringIntentId,
              user: user.id
            };

            // Send generic request in the background (don't await)
            createGenericSaveRequest(
              "create_hiring_intent_action",
              payload,
              EXTERNAL.directus_url
            ).catch(err => {
              console.error('Error creating generic request:', err);
            });
          }
        } else {
          setError(result.error || 'Failed to mark as actioned');
        }
      } else if (actionType === 'skipped') {
        // Move to Hidden column
        const result = await updateHiringIntentUserState(hiringIntentId, 'hidden', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = signalIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            setSignalIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setHiddenIntents(prev => [...prev, movedIntent]);
          }
        } else {
          setError(result.error || 'Failed to mark as hidden');
        }
      }
    } catch (err) {
      console.error('Error updating action status:', err);
      setError('An error occurred while updating action status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Space Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Filter by Space:</label>
          <SpaceSelector
            onSpaceChange={handleSpaceChange}
            selectedSpaceId={selectedSpaceId}
            showAllOption={true}
            className="w-auto"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
            <span className="text-gray-600">Loading orbit signals...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && signalIntents.length === 0 && actionIntents.length === 0 && hiddenIntents.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">No orbit signals found</p>
              <p className="text-gray-400 text-sm mt-2">
                {selectedSpaceId && selectedSpaceId !== "all"
                  ? "Try selecting a different space or 'All' to see all orbit signals."
                  : "Orbit signals will appear here once they are created."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      {!isLoading && !error && (signalIntents.length > 0 || actionIntents.length > 0 || hiddenIntents.length > 0) && (
        <KanbanBoardProvider>
          <KanbanBoard className="min-h-[500px] md:h-[calc(100vh-250px)] gap-4 flex-col md:flex-row">
            {/* Signals Column */}
            <KanbanBoardColumn
              columnId="signals"
              onDropOverColumn={(data) => handleDropOverColumn("signals", data)}
              className="w-full md:flex-1 md:min-w-0"
            >
              <KanbanBoardColumnHeader className="px-3 py-2">
                <KanbanBoardColumnTitle columnId="signals" className="text-base md:text-sm">
                  <KanbanColorCircle color="blue" />
                  Signals
                  <Badge className="ml-2 bg-blue-100 text-blue-800 text-xs">
                    {signalIntents.length}
                  </Badge>
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList className="px-1 md:px-0">
                {signalIntents.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <p className="text-sm text-gray-500">
                      No pending signals. All signals have been processed.
                    </p>
                  </div>
                ) : (
                  signalIntents.map((intent) => {
                    const cardData = { id: intent.id.toString(), columnId: "signals" };
                    return (
                      <KanbanBoardColumnListItem key={intent.id} cardId={intent.id.toString()}>
                        <KanbanBoardCard data={cardData}>
                          <SignalCard
                            intent={intent}
                            onAddToActions={(id) => handleActionStatusUpdate(id, 'completed')}
                            onSkip={(id) => handleActionStatusUpdate(id, 'skipped')}
                            showActionButtons={true}
                          />
                        </KanbanBoardCard>
                      </KanbanBoardColumnListItem>
                    );
                  })
                )}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>

            {/* Actions Column */}
            <KanbanBoardColumn
              columnId="actions"
              onDropOverColumn={(data) => handleDropOverColumn("actions", data)}
              className="w-full md:flex-1 md:min-w-0"
            >
              <KanbanBoardColumnHeader className="px-3 py-2">
                <KanbanBoardColumnTitle columnId="actions" className="text-base md:text-sm">
                  <KanbanColorCircle color="green" />
                  Actions
                  <Badge className="ml-2 bg-green-100 text-green-800 text-xs">
                    {actionIntents.length}
                  </Badge>
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList className="px-1 md:px-0">
                {actionIntents.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <p className="text-sm text-gray-500">
                      No actions yet. Drag signals here to add them to actions.
                    </p>
                  </div>
                ) : (
                  actionIntents.map((intent) => {
                    const cardData = { id: intent.id.toString(), columnId: "actions" };
                    return (
                      <KanbanBoardColumnListItem key={intent.id} cardId={intent.id.toString()}>
                        <KanbanBoardCard data={cardData}>
                          <ActionCard intent={intent} />
                        </KanbanBoardCard>
                      </KanbanBoardColumnListItem>
                    );
                  })
                )}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>

            {/* Hidden Column */}
            <KanbanBoardColumn
              columnId="hidden"
              onDropOverColumn={(data) => handleDropOverColumn("hidden", data)}
              className="w-full md:flex-1 md:min-w-0"
            >
              <KanbanBoardColumnHeader className="px-3 py-2">
                <KanbanBoardColumnTitle columnId="hidden" className="text-base md:text-sm">
                  <KanbanColorCircle color="gray" />
                  Hidden
                  <Badge className="ml-2 bg-gray-100 text-gray-800 text-xs">
                    {hiddenIntents.length}
                  </Badge>
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList className="px-1 md:px-0">
                {hiddenIntents.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <p className="text-sm text-gray-500">
                      No hidden signals. Drag signals here to hide them.
                    </p>
                  </div>
                ) : (
                  hiddenIntents.map((intent) => {
                    const cardData = { id: intent.id.toString(), columnId: "hidden" };
                    return (
                      <KanbanBoardColumnListItem key={intent.id} cardId={intent.id.toString()}>
                        <KanbanBoardCard data={cardData}>
                          <SignalCard
                            intent={intent}
                            onAddToActions={(id) => handleActionStatusUpdate(id, 'completed')}
                            onSkip={(id) => handleActionStatusUpdate(id, 'skipped')}
                            showActionButtons={false}
                          />
                        </KanbanBoardCard>
                      </KanbanBoardColumnListItem>
                    );
                  })
                )}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>
          </KanbanBoard>

          {/* Pagination Controls */}
          <PaginationControls
            currentPage={currentPage}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </KanbanBoardProvider>
      )}
    </div>
  );
}
