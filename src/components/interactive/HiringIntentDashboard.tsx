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
import { getHiringIntentsBySpace, getUserHiringIntentStates, updateHiringIntentUserState, deleteHiringIntentUserState, getUserProfile, type HiringIntent } from "@/lib/utils";
import { createGenericSaveRequest } from "@/client_side/fetch/generic_request";
import { EXTERNAL } from "@/constant";

export default function HiringIntentDashboard() {
  const [signalIntents, setSignalIntents] = useState<HiringIntent[]>([]);
  const [actionIntents, setActionIntents] = useState<HiringIntent[]>([]);
  const [completedIntents, setCompletedIntents] = useState<HiringIntent[]>([]);
  const [hiddenIntents, setHiddenIntents] = useState<HiringIntent[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchHiringIntents();
  }, [selectedSpaceId, selectedCategory, selectedUser, currentPage, itemsPerPage]);

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

      // Now fetch all four columns in parallel, reusing the categorized IDs
      const [signalsResult, actionsResult, completedResult, hiddenResult] = await Promise.all([
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
          columnType: 'completed',
          categorizedIds: userStatesResult.categories
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: itemsPerPage,
          offset: offset,
          columnType: 'hidden',
          categorizedIds: userStatesResult.categories
        })
      ]);

      if (signalsResult.success && actionsResult.success && completedResult.success && hiddenResult.success) {
        // Apply client-side filters
        let filteredSignals = signalsResult.hiringIntents || [];
        let filteredActions = actionsResult.hiringIntents || [];
        let filteredCompleted = completedResult.hiringIntents || [];
        let filteredHidden = hiddenResult.hiringIntents || [];

        // Filter by category
        if (selectedCategory !== "all") {
          filteredSignals = filteredSignals.filter(intent => intent.category === selectedCategory);
          filteredActions = filteredActions.filter(intent => intent.category === selectedCategory);
          filteredCompleted = filteredCompleted.filter(intent => intent.category === selectedCategory);
          filteredHidden = filteredHidden.filter(intent => intent.category === selectedCategory);
        }

        // Filter by user
        if (selectedUser !== "all") {
          filteredSignals = filteredSignals.filter(intent => intent.user_created === selectedUser);
          filteredActions = filteredActions.filter(intent => intent.user_created === selectedUser);
          filteredCompleted = filteredCompleted.filter(intent => intent.user_created === selectedUser);
          filteredHidden = filteredHidden.filter(intent => intent.user_created === selectedUser);
        }

        setSignalIntents(filteredSignals);
        setActionIntents(filteredActions);
        setCompletedIntents(filteredCompleted);
        setHiddenIntents(filteredHidden);
        // Total count is sum of all four columns after filtering
        setTotalCount(
          filteredSignals.length +
          filteredActions.length +
          filteredCompleted.length +
          filteredHidden.length
        );
      } else {
        setError(
          signalsResult.error || actionsResult.error || completedResult.error || hiddenResult.error ||
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

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleUserChange = (user: string) => {
    setSelectedUser(user);
    setCurrentPage(1);
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
      // Moving from Actions to Completed
      else if (fromColumn === "actions" && columnId === "completed") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'completed', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = actionIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent && result.userState) {
            // Update the intent's user_state with the new completed state
            const updatedIntent = {
              ...movedIntent,
              user_state: [result.userState]
            };
            setActionIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setCompletedIntents(prev => [...prev, updatedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move action to completed');
        }
      }
      // Moving from Completed to Actions
      else if (fromColumn === "completed" && columnId === "actions") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'actioned', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = completedIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent && result.userState) {
            // Update the intent's user_state to actioned
            const updatedIntent = {
              ...movedIntent,
              user_state: [result.userState]
            };
            setCompletedIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setActionIntents(prev => [...prev, updatedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move completed to actions');
        }
      }
      // Moving from Completed to Signals
      else if (fromColumn === "completed" && columnId === "signals") {
        const result = await deleteHiringIntentUserState(hiringIntentId, EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = completedIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent) {
            // Remove user_state when moving back to signals
            const updatedIntent = {
              ...movedIntent,
              user_state: []
            };
            setCompletedIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setSignalIntents(prev => [...prev, updatedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move completed to signals');
        }
      }
      // Moving from Completed to Hidden
      else if (fromColumn === "completed" && columnId === "hidden") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'hidden', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = completedIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent && result.userState) {
            // Update the intent's user_state to hidden
            const updatedIntent = {
              ...movedIntent,
              user_state: [result.userState]
            };
            setCompletedIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setHiddenIntents(prev => [...prev, updatedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move completed to hidden');
        }
      }
      // Moving from Signals to Completed
      else if (fromColumn === "signals" && columnId === "completed") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'completed', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = signalIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent && result.userState) {
            // Update the intent's user_state with the new completed state
            const updatedIntent = {
              ...movedIntent,
              user_state: [result.userState]
            };
            setSignalIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setCompletedIntents(prev => [...prev, updatedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move signal to completed');
        }
      }
      // Moving from Hidden to Completed
      else if (fromColumn === "hidden" && columnId === "completed") {
        const result = await updateHiringIntentUserState(hiringIntentId, 'completed', EXTERNAL.directus_url);
        if (result.success) {
          const movedIntent = hiddenIntents.find(intent => intent.id === hiringIntentId);
          if (movedIntent && result.userState) {
            // Update the intent's user_state with the new completed state
            const updatedIntent = {
              ...movedIntent,
              user_state: [result.userState]
            };
            setHiddenIntents(prev => prev.filter(intent => intent.id !== hiringIntentId));
            setCompletedIntents(prev => [...prev, updatedIntent]);
          }
        } else {
          setError(result.error || 'Failed to move hidden to completed');
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

  // Get unique categories and users from all intents
  const allIntents = [...signalIntents, ...actionIntents, ...hiddenIntents];
  const uniqueCategories = Array.from(new Set(allIntents.map(i => i.category).filter(Boolean)));
  const uniqueUsers = Array.from(new Set(allIntents.map(i => i.user_created).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Space:</label>
          <SpaceSelector
            onSpaceChange={handleSpaceChange}
            selectedSpaceId={selectedSpaceId}
            showAllOption={true}
            className="w-auto"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All</option>
            <option value="funding">Funding</option>
            <option value="growth">Growth</option>
            <option value="replacement">Replacement</option>
            <option value="hiring">Hiring</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">User:</label>
          <select
            value={selectedUser}
            onChange={(e) => handleUserChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All Users</option>
            {uniqueUsers.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>
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
      {!isLoading && !error && signalIntents.length === 0 && actionIntents.length === 0 && completedIntents.length === 0 && hiddenIntents.length === 0 && (
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
      {!isLoading && !error && (signalIntents.length > 0 || actionIntents.length > 0 || completedIntents.length > 0 || hiddenIntents.length > 0) && (
        <KanbanBoardProvider>
          <KanbanBoard className="min-h-[1200px] h-auto gap-4 flex-col md:flex-row">
            {/* Signals Column */}
            <KanbanBoardColumn
              columnId="signals"
              onDropOverColumn={(data) => handleDropOverColumn("signals", data)}
              className="w-full md:flex-1 md:min-w-0 min-h-[1200px] max-h-none"
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
              className="w-full md:flex-1 md:min-w-0 min-h-[1200px] max-h-none"
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
                          <ActionCard
                            intent={intent}
                            onHide={async (intentId) => {
                              await handleDropOverColumn("hidden", JSON.stringify({ id: intentId, columnId: "actions" }));
                            }}
                            onComplete={async (intentId) => {
                              await handleDropOverColumn("completed", JSON.stringify({ id: intentId, columnId: "actions" }));
                            }}
                          />
                        </KanbanBoardCard>
                      </KanbanBoardColumnListItem>
                    );
                  })
                )}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>

            {/* Completed Column */}
            <KanbanBoardColumn
              columnId="completed"
              onDropOverColumn={(data) => handleDropOverColumn("completed", data)}
              className="w-full md:flex-1 md:min-w-0 min-h-[1200px] max-h-none"
            >
              <KanbanBoardColumnHeader className="px-3 py-2">
                <KanbanBoardColumnTitle columnId="completed" className="text-base md:text-sm">
                  <KanbanColorCircle color="purple" />
                  Completed
                  <Badge className="ml-2 bg-purple-100 text-purple-800 text-xs">
                    {completedIntents.length}
                  </Badge>
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList className="px-1 md:px-0">
                {completedIntents.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <p className="text-sm text-gray-500">
                      No completed actions. Drag actions here to mark them as completed.
                    </p>
                  </div>
                ) : (
                  completedIntents.map((intent) => {
                    const cardData = { id: intent.id.toString(), columnId: "completed" };
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
              className="w-full md:flex-1 md:min-w-0 min-h-[1200px] max-h-none"
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
                            isHidden={true}
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
