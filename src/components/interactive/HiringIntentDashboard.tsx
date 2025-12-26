"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SpaceSelector from "@/components/interactive/SpaceSelector";
import { SignalCard } from "@/components/interactive/SignalCard";
import { ActionCard } from "@/components/interactive/ActionCard";
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
import { getHiringIntentsBySpace, createHiringIntentAction, type HiringIntent, type HiringIntentAction } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

export default function HiringIntentDashboard() {
  const [hiringIntents, setHiringIntents] = useState<HiringIntent[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHiringIntents();
  }, [selectedSpaceId]);

  const fetchHiringIntents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const spaceIdNumber = selectedSpaceId && selectedSpaceId !== "all" ? parseInt(selectedSpaceId) : null;
      const result = await getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url);

      if (result.success && result.hiringIntents) {
        setHiringIntents(result.hiringIntents);
      } else {
        setError(result.error || "Failed to fetch orbit signals");
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
  };

  const handleDropOverColumn = async (columnId: string, dataTransferData: string) => {
    try {
      const data = JSON.parse(dataTransferData);
      const hiringIntentId = parseInt(data.id);
      const fromColumn = data.columnId;

      // Moving from Signals to Actions
      if (fromColumn === "signals" && columnId === "actions") {
        await handleActionStatusUpdate(hiringIntentId, 'completed');
      }
      // Moving from Actions back to Signals (undo)
      else if (fromColumn === "actions" && columnId === "signals") {
        // Remove the completed action to move it back to signals
        setHiringIntents(prevIntents =>
          prevIntents.map(intent =>
            intent.id === hiringIntentId
              ? {
                  ...intent,
                  actions: intent.actions?.filter(action => action.status !== 'completed') || []
                }
              : intent
          )
        );
      }
    } catch (err) {
      console.error('Error handling drop:', err);
    }
  };

  const handleActionStatusUpdate = async (
    hiringIntentId: number,
    actionType: 'completed' | 'skipped'
  ) => {
    try {
      const result = await createHiringIntentAction(
        hiringIntentId,
        actionType,
        'user_action',
        EXTERNAL.directus_url
      );

      if (result.success && result.action) {
        // Update local state to add the new action to the intent
        setHiringIntents(prevIntents =>
          prevIntents.map(intent =>
            intent.id === hiringIntentId
              ? {
                  ...intent,
                  actions: [...(intent.actions || []), result.action!]
                }
              : intent
          )
        );
      } else {
        console.error('Failed to create action:', result.error);
        setError(result.error || 'Failed to create action');
      }
    } catch (err) {
      console.error('Error creating action:', err);
      setError('An error occurred while creating action');
    }
  };

  // Helper function to check if intent has a specific action status
  const hasActionStatus = (intent: HiringIntent, status: 'completed' | 'skipped'): boolean => {
    return intent.actions?.some(action => action.status === status) || false;
  };

  // Filter intents into different categories
  const pendingIntents = hiringIntents.filter(
    intent => !hasActionStatus(intent, 'completed') && !hasActionStatus(intent, 'skipped')
  );
  const actionIntents = hiringIntents.filter(
    intent => hasActionStatus(intent, 'completed')
  );
  // Skipped intents are not displayed

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
      {!isLoading && !error && hiringIntents.length === 0 && (
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
      {!isLoading && !error && hiringIntents.length > 0 && (
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
                    {pendingIntents.length}
                  </Badge>
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList className="px-1 md:px-0">
                {pendingIntents.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <p className="text-sm text-gray-500">
                      No pending signals. All signals have been processed.
                    </p>
                  </div>
                ) : (
                  pendingIntents.map((intent) => (
                    <KanbanBoardColumnListItem key={intent.id} cardId={intent.id.toString()}>
                      <KanbanBoardCard
                        data={{ id: intent.id.toString(), columnId: "signals" }}
                      >
                        <SignalCard
                          intent={intent}
                          onAddToActions={(id) => handleActionStatusUpdate(id, 'completed')}
                          onSkip={(id) => handleActionStatusUpdate(id, 'skipped')}
                          showActionButtons={true}
                        />
                      </KanbanBoardCard>
                    </KanbanBoardColumnListItem>
                  ))
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
                  actionIntents.map((intent) => (
                    <KanbanBoardColumnListItem key={intent.id} cardId={intent.id.toString()}>
                      <KanbanBoardCard
                        data={{ id: intent.id.toString(), columnId: "actions" }}
                      >
                        <ActionCard intent={intent} />
                      </KanbanBoardCard>
                    </KanbanBoardColumnListItem>
                  ))
                )}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>
          </KanbanBoard>
        </KanbanBoardProvider>
      )}
    </div>
  );
}
