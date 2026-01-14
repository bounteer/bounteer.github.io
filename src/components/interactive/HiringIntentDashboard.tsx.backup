"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
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

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  useEffect(() => {
    fetchHiringIntents();
  }, [selectedSpaceId, selectedCategory]);

  const fetchHiringIntents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const spaceIdNumber =
        selectedSpaceId && selectedSpaceId !== "all"
          ? parseInt(selectedSpaceId)
          : null;

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
      } else {
        setError("Failed to fetch orbit signals");
      }
    } catch (err) {
      setError("Error fetching orbit signals");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToActions = async (intentId: number) => {
    // Check if we've reached the quota limit
    if (actionIntents.length >= ACTION_QUOTA_LIMIT) {
      setShowQuotaDialog(true);
      return;
    }

    try {
      const result = await updateHiringIntentUserState(
        intentId,
        "actioned",
        EXTERNAL.directus_url
      );

      if (result.success) {
        await fetchHiringIntents();
      } else {
        console.error("Failed to move to actions:", result.error);
      }
    } catch (err) {
      console.error("Failed to move to actions:", err);
    }
  };

  const handleSkip = async (intentId: number) => {
    try {
      const result = await updateHiringIntentUserState(
        intentId,
        "hidden",
        EXTERNAL.directus_url
      );

      if (result.success) {
        await fetchHiringIntents();
      } else {
        console.error("Failed to skip:", result.error);
      }
    } catch (err) {
      console.error("Failed to skip:", err);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* MOBILE TABS */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        {([
          ["signals", "Signals", signalIntents.length],
          ["actions", "Actions", actionIntents.length],
          ["completed", "Completed", completedIntents.length],
          ["aborted", "Aborted", abortedIntents.length],
          ["hidden", "Hidden", hiddenIntents.length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setMobileTab(key)}
            className={`px-3 py-1.5 rounded-full text-sm border whitespace-nowrap
              ${mobileTab === key
                ? "bg-black text-white border-black"
                : "bg-white text-gray-600 border-gray-300"
              }`}
          >
            {label} <span className="ml-1 text-xs">({count})</span>
          </button>
        ))}
      </div>

      {!isLoading && !error && (
        <KanbanBoardProvider>
          <div className="overflow-x-auto pb-4">
            <KanbanBoard className="flex-col md:flex-row gap-4 md:min-w-max">
            {/* SIGNALS */}
            <KanbanBoardColumn
              columnId="signals"
                className={`w-full md:w-[30vw] md:flex-shrink-0 min-h-[1200px]
                ${mobileTab !== "signals" ? "hidden" : ""}
                ${visibleColumns.signals ? "md:block" : "md:hidden"}`}
            >
              <KanbanBoardColumnHeader>
                <KanbanBoardColumnTitle columnId="signals">
                  <KanbanColorCircle color="blue" /> Signals
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList>
                {signalIntents.map((intent) => (
                  <KanbanBoardColumnListItem key={intent.id}>
                    <KanbanBoardCard
                      data={{ id: intent.id.toString(), columnId: "signals" }}
                    >
                      <SignalCard
                        intent={intent}
                        onAddToActions={handleAddToActions}
                        onSkip={handleSkip}
                      />
                    </KanbanBoardCard>
                  </KanbanBoardColumnListItem>
                ))}
              </KanbanBoardColumnList>
              <div className="mt-4 px-3 py-2 text-sm text-gray-500 text-center italic">
                To see more hiring signals, move signals to actions or hide them. Increased quota available with upgraded plan.
              </div>
              <ContactCard />
            </KanbanBoardColumn>

            {/* ACTIONS */}
            <KanbanBoardColumn
              columnId="actions"
                className={`w-full md:w-[40vw] md:flex-shrink-0 min-h-[1200px]
                ${mobileTab !== "actions" ? "hidden" : ""}
                ${visibleColumns.actions ? "md:block" : "md:hidden"}`}
            >
              <KanbanBoardColumnHeader>
                <KanbanBoardColumnTitle columnId="actions">
                  <KanbanColorCircle color="green" /> Actions
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList>
                {actionIntents.map((intent) => (
                  <KanbanBoardColumnListItem key={intent.id}>
                    <KanbanBoardCard
                      data={{ id: intent.id.toString(), columnId: "actions" }}
                    >
                      <ActionCard
                        intent={intent}
                        onActionUpdate={fetchHiringIntents}
                        columnType="actions"
                      />
                    </KanbanBoardCard>
                  </KanbanBoardColumnListItem>
                ))}
              </KanbanBoardColumnList>
              <div className="mt-4 px-3 py-2 text-sm text-gray-500 text-center italic">
                To have more than 10 actions, move actions to completed or aborted. Increased quota available with upgraded plan.
              </div>
              <ContactCard />
            </KanbanBoardColumn>

            {/* COMPLETED */}
            <KanbanBoardColumn
              columnId="completed"
                className={`w-full md:w-[40vw] md:flex-shrink-0 min-h-[1200px]
                ${mobileTab !== "completed" ? "hidden" : ""}
                ${visibleColumns.completed ? "md:block" : "md:hidden"}`}
            >
              <KanbanBoardColumnHeader>
                <KanbanBoardColumnTitle columnId="completed">
                  <KanbanColorCircle color="purple" /> Completed
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList>
                {completedIntents.map((intent) => (
                  <KanbanBoardColumnListItem key={intent.id}>
                    <KanbanBoardCard
                      data={{
                        id: intent.id.toString(),
                        columnId: "completed",
                      }}
                    >
                      <ActionCard
                        intent={intent}
                        onActionUpdate={fetchHiringIntents}
                        columnType="completed"
                      />
                    </KanbanBoardCard>
                  </KanbanBoardColumnListItem>
                ))}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>

            {/* ABORTED */}
            <KanbanBoardColumn
              columnId="aborted"
                className={`w-full md:w-[40vw] md:flex-shrink-0 min-h-[1200px]
                ${mobileTab !== "aborted" ? "hidden" : ""}
                ${visibleColumns.aborted ? "md:block" : "md:hidden"}`}
            >
              <KanbanBoardColumnHeader>
                <KanbanBoardColumnTitle columnId="aborted">
                  <KanbanColorCircle color="orange" /> Aborted
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList>
                {abortedIntents.map((intent) => (
                  <KanbanBoardColumnListItem key={intent.id}>
                    <KanbanBoardCard
                      data={{
                        id: intent.id.toString(),
                        columnId: "aborted",
                      }}
                    >
                      <ActionCard
                        intent={intent}
                        onActionUpdate={fetchHiringIntents}
                        columnType="aborted"
                      />
                    </KanbanBoardCard>
                  </KanbanBoardColumnListItem>
                ))}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>

            {/* HIDDEN */}
            <KanbanBoardColumn
              columnId="hidden"
                className={`w-full md:w-[30vw] md:flex-shrink-0 min-h-[1200px]
                ${mobileTab !== "hidden" ? "hidden" : ""}
                ${visibleColumns.hidden ? "md:block" : "md:hidden"}`}
            >
              <KanbanBoardColumnHeader>
                <KanbanBoardColumnTitle columnId="hidden">
                  <KanbanColorCircle color="gray" /> Hidden
                </KanbanBoardColumnTitle>
              </KanbanBoardColumnHeader>
              <KanbanBoardColumnList>
                {hiddenIntents.map((intent) => (
                  <KanbanBoardColumnListItem key={intent.id}>
                    <KanbanBoardCard
                      data={{ id: intent.id.toString(), columnId: "hidden" }}
                    >
                      <SignalCard
                        intent={intent}
                        onAddToActions={handleAddToActions}
                        onSkip={handleSkip}
                        isHidden
                        showActionButtons={false}
                      />
                    </KanbanBoardCard>
                  </KanbanBoardColumnListItem>
                ))}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>
          </KanbanBoard>
          </div>
        </KanbanBoardProvider>
      )}

      {/* Quota Limit Dialog */}
      <Dialog open={showQuotaDialog} onOpenChange={setShowQuotaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Action Quota Exceeded</DialogTitle>
            <DialogDescription>
              You have exceeded the maximum of {ACTION_QUOTA_LIMIT} actions. Please complete or abort existing actions first before adding new ones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowQuotaDialog(false)}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
