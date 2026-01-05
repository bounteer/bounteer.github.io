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
import {
  getHiringIntentsBySpace,
  getUserHiringIntentStates,
  updateHiringIntentUserState,
  getHiringIntentActions,
  type HiringIntent,
} from "@/lib/utils";
import { EXTERNAL } from "@/constant";

type MobileTab = "signals" | "actions" | "completed" | "hidden";

export default function HiringIntentDashboard() {
  const [signalIntents, setSignalIntents] = useState<HiringIntent[]>([]);
  const [actionIntents, setActionIntents] = useState<HiringIntent[]>([]);
  const [completedIntents, setCompletedIntents] = useState<HiringIntent[]>([]);
  const [hiddenIntents, setHiddenIntents] = useState<HiringIntent[]>([]);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Mobile-only
  const [mobileTab, setMobileTab] = useState<MobileTab>("signals");

  // Desktop-only
  const [showHiddenDesktop, setShowHiddenDesktop] = useState(false);

  useEffect(() => {
    fetchHiringIntents();
  }, [selectedSpaceId, selectedCategory, currentPage, itemsPerPage]);

  const fetchHiringIntents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const spaceIdNumber =
        selectedSpaceId && selectedSpaceId !== "all"
          ? parseInt(selectedSpaceId)
          : null;

      const offset = (currentPage - 1) * itemsPerPage;

      const userStatesResult = await getUserHiringIntentStates(
        EXTERNAL.directus_url
      );

      if (!userStatesResult.success || !userStatesResult.categories) {
        setError("Failed to fetch user states");
        return;
      }

      const [signals, actions, completed, hidden] = await Promise.all([
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: itemsPerPage,
          offset,
          columnType: "signals",
          categorizedIds: userStatesResult.categories,
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: itemsPerPage,
          offset,
          columnType: "actions",
          categorizedIds: userStatesResult.categories,
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: itemsPerPage,
          offset,
          columnType: "completed",
          categorizedIds: userStatesResult.categories,
        }),
        getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url, {
          limit: itemsPerPage,
          offset,
          columnType: "hidden",
          categorizedIds: userStatesResult.categories,
        }),
      ]);

      if (signals.success && actions.success && completed.success && hidden.success) {
        const filterByCategory = (list: HiringIntent[]) =>
          selectedCategory === "all"
            ? list
            : list.filter((i) => i.category === selectedCategory);

        const s = filterByCategory(signals.hiringIntents || []);
        const a = filterByCategory(actions.hiringIntents || []);
        const c = filterByCategory(completed.hiringIntents || []);
        const h = filterByCategory(hidden.hiringIntents || []);

        setSignalIntents(s);
        setActionIntents(a);
        setCompletedIntents(c);
        setHiddenIntents(h);

        setTotalCount(s.length + a.length + c.length + h.length);
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
    try {
      const result = await updateHiringIntentUserState(
        intentId,
        "actioned",
        EXTERNAL.directus_url
      );

      if (result.success) {
        await fetchHiringIntents();
      } else {
        console.error("Failed to add to actions:", result.error);
      }
    } catch (err) {
      console.error("Failed to add to actions:", err);
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
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setCurrentPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All categories</option>
          <option value="funding">Funding</option>
          <option value="growth">Growth</option>
          <option value="replacement">Replacement</option>
          <option value="hiring">Hiring</option>
          <option value="other">Other</option>
        </select>

        {/* Desktop-only hidden toggle */}
        <button
          onClick={() => setShowHiddenDesktop((v) => !v)}
          className="hidden md:inline-flex items-center text-sm text-gray-600 border px-3 py-1.5 rounded-md hover:bg-gray-100"
        >
          {showHiddenDesktop ? "Hide hidden" : "Show hidden"}
          <span className="ml-2 text-xs text-gray-400">
            ({hiddenIntents.length})
          </span>
        </button>
      </div>

      {/* MOBILE TABS */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        {([
          ["signals", "Signals", signalIntents.length],
          ["actions", "Actions", actionIntents.length],
          ["completed", "Completed", completedIntents.length],
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
          <KanbanBoard className="flex-col md:flex-row gap-4">
            {/* SIGNALS */}
            <KanbanBoardColumn
              columnId="signals"
              className={`w-full md:flex-1 md:min-w-0 min-h-[1200px]
                ${mobileTab !== "signals" ? "hidden md:block" : ""}`}
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
            </KanbanBoardColumn>

            {/* ACTIONS */}
            <KanbanBoardColumn
              columnId="actions"
              className={`w-full md:flex-1 md:min-w-0 min-h-[1200px]
                ${mobileTab !== "actions" ? "hidden md:block" : ""}`}
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
                      <ActionCard intent={intent} />
                    </KanbanBoardCard>
                  </KanbanBoardColumnListItem>
                ))}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>

            {/* COMPLETED */}
            <KanbanBoardColumn
              columnId="completed"
              className={`w-full md:flex-1 md:min-w-0 min-h-[1200px]
                ${mobileTab !== "completed" ? "hidden md:block" : ""}`}
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
                      <ActionCard intent={intent} />
                    </KanbanBoardCard>
                  </KanbanBoardColumnListItem>
                ))}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>

            {/* HIDDEN */}
            <KanbanBoardColumn
              columnId="hidden"
              className={`w-full md:flex-1 md:min-w-0 min-h-[1200px]
                ${mobileTab === "hidden" ? "block" : "hidden"}
                ${showHiddenDesktop ? "md:block" : "md:hidden"}`}
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
                      />
                    </KanbanBoardCard>
                  </KanbanBoardColumnListItem>
                ))}
              </KanbanBoardColumnList>
            </KanbanBoardColumn>
          </KanbanBoard>

          <PaginationControls
            currentPage={currentPage}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(n) => {
              setItemsPerPage(n);
              setCurrentPage(1);
            }}
          />
        </KanbanBoardProvider>
      )}
    </div>
  );
}
