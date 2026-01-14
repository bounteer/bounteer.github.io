import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, ChevronDown, ChevronRight, Plus, GripVertical, X, Check, Circle } from "lucide-react";
import type { HiringIntent, HiringIntentAction } from "@/lib/utils";
import { getUserProfile, updateHiringIntentAction, createHiringIntentAction, deleteHiringIntentAction, updateHiringIntentUserState, createHiringIntentEvent } from "@/lib/utils";
import { EXTERNAL } from "@/constant";
import { AbortReasonDialog } from "./AbortReasonDialog";
import {
  LinkedinOutreachAction,
  OrbitCompanyCallScheduleAction,
  OrbitCompanyCallReviewAction,
  EmailAction,
  ManualAction,
  parsePayload,
  extractTextFromPayload,
} from "./ActionTypes";
import { LocationAndCoverage } from "./LocationAndCoverage";
import { HiringWindow } from "./HiringWindow";
import { IntentMetaRow } from "./IntentMetaRow";
import { IntentRoles } from "./IntentRoles";
import { IntentSource } from "./IntentSource";
import { IntentCompanyLinks } from "./IntentCompanyLinks";

interface ActionCardProps {
  intent: HiringIntent;
  onActionUpdate?: () => void;
  onMoveToCompleted?: (intentId: number) => Promise<void>;
  onMoveToAborted?: (intentId: number, reason?: string) => Promise<void>;
  columnType?: 'actions' | 'completed' | 'aborted' | 'hidden';
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const getCountryName = (code?: string) =>
  code ? regionNames.of(code.toUpperCase()) ?? code : undefined;

const getCategoryColor = (category?: string) => {
  switch (category) {
    case "funding":
      return "bg-blue-50 text-blue-600";
    case "growth":
      return "bg-green-50 text-green-600";
    case "replacement":
      return "bg-amber-50 text-amber-600";
    default:
      return "bg-gray-50 text-gray-600";
  }
};

const getConfidenceLevel = (confidence?: number) => {
  if (!confidence) return { label: "N/A", color: "bg-gray-50 text-gray-600" };
  if (confidence >= 85) return { label: "High", color: "bg-green-50 text-green-700" };
  if (confidence >= 70) return { label: "Mid", color: "bg-yellow-50 text-yellow-700" };
  if (confidence >= 50) return { label: "Low", color: "bg-orange-50 text-orange-700" };
  return { label: "Very Low", color: "bg-red-50 text-red-700" };
};

const getUrgency = (windowStart?: string, windowEnd?: string) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize to start of day

  if (!windowStart || !windowEnd) {
    return null;
  }

  const startDate = new Date(windowStart);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(windowEnd);
  endDate.setHours(0, 0, 0, 0);

  const daysToStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysToEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Before hiring window
  if (daysToStart > 0) {
    return {
      label: `${daysToStart}d to start`,
      color: "bg-gray-100 text-gray-600",
    };
  }

  // During hiring window
  if (daysToEnd > 0) {
    // Window ends in less than 2 weeks (14 days)
    if (daysToEnd <= 14) {
      return {
        label: `${daysToEnd}d left`,
        color: "bg-yellow-50 text-yellow-700",
      };
    }
    // Window active with more time
    return {
      label: `${daysToEnd}d left`,
      color: "bg-green-50 text-green-700",
    };
  }

  // Window has ended
  return {
    label: "Expired",
    color: "bg-red-50 text-red-700",
  };
};



export function ActionCard({ intent, onActionUpdate, onMoveToCompleted, onMoveToAborted, columnType = 'actions' }: ActionCardProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userActions, setUserActions] = useState<HiringIntentAction[]>([]);
  const [updatingActionIds, setUpdatingActionIds] = useState<Set<number>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [isCompletingCard, setIsCompletingCard] = useState(false);
  const [isAbortingCard, setIsAbortingCard] = useState(false);
  const [showAbortDialog, setShowAbortDialog] = useState(false);

  // Get current card status - prefer columnType prop over user_state
  const currentStatus = columnType === 'actions' ? 'actioned' :
                        columnType === 'completed' ? 'completed' :
                        columnType === 'aborted' ? 'aborted' :
                        intent.user_state?.[0]?.status || 'actioned';

  // Render action based on category
  const renderActionContent = (action: HiringIntentAction) => {
    const category = action.category;
    const payload = parsePayload(action.payload);
    const isCompleted = action.status === 'completed';
    const isEditing = !isReadOnly && editingActionId === action.id;

    // Debug logging
    console.log('Rendering action:', {
      id: action.id,
      category,
      payload,
      hasScheduleUrl: !!payload?.orbit_company_call_create_url,
      hasReviewUrl: !!payload?.review_url
    });

    const commonProps = {
      isCompleted,
      isEditing,
      editingText,
      onEditChange: setEditingText,
      onSave: () => handleSaveEdit(action),
      onCancel: handleCancelEdit,
      onStartEdit: isReadOnly ? () => {} : () => handleStartEdit(action),
    };

    // LinkedIn Outreach
    if (category === 'linkedin_outreach' && payload?.linkedin_search_url) {
      return <LinkedinOutreachAction {...commonProps} payload={payload} />;
    }

    // Orbit Call Schedule
    if (category === 'orbit_company_call_schedule' && payload?.orbit_company_call_create_url) {
      return <OrbitCompanyCallScheduleAction {...commonProps} payload={payload} />;
    }

    // Orbit Call Review
    if (category === 'orbit_company_call_review' && payload?.review_url) {
      return <OrbitCompanyCallReviewAction {...commonProps} payload={payload} />;
    }

    // Email / Follow-up
    if ((category === 'email' || category === 'email_outreach') && payload?.email) {
      return <EmailAction {...commonProps} payload={payload} />;
    }

    // Default: Manual Action
    console.log('Falling back to ManualAction for:', category);
    return (
      <ManualAction
        {...commonProps}
        text={extractTextFromPayload(action.payload)}
        isReadOnly={isReadOnly}
      />
    );
  };

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getUserProfile(EXTERNAL.directus_url);
      if (user) {
        setCurrentUserId(user.id);
        // Filter actions for current user and sort by lexical_order
        const filtered = (intent.actions || [])
          .filter(action => action.user === user.id || action.user_created === user.id)
          .sort((a, b) => {
            // Sort by lexical_order if available, otherwise maintain original order
            if (a.lexical_order && b.lexical_order) {
              return a.lexical_order.localeCompare(b.lexical_order);
            }
            return 0;
          });
        setUserActions(filtered);
      }
    };
    fetchUser();
  }, [intent.actions]);

  const handleActionToggle = async (action: HiringIntentAction) => {
    if (!action.id || updatingActionIds.has(action.id)) return;

    setUpdatingActionIds(prev => new Set(prev).add(action.id!));

    const newStatus = action.status === 'completed' ? 'processing' : 'completed';
    const oldStatus = action.status;

    // Optimistically update UI
    setUserActions(prev =>
      prev.map(a => (a.id === action.id ? { ...a, status: newStatus } : a))
    );

    try {
      const result = await updateHiringIntentAction(action.id, newStatus, EXTERNAL.directus_url);

      if (result.success) {
        onActionUpdate?.();
      } else {
        // Rollback on failure
        setUserActions(prev =>
          prev.map(a => (a.id === action.id ? { ...a, status: oldStatus } : a))
        );
      }
    } catch (error) {
      console.error('Error toggling action:', error);
      // Rollback on error
      setUserActions(prev =>
        prev.map(a => (a.id === action.id ? { ...a, status: oldStatus } : a))
      );
    } finally {
      setUpdatingActionIds(prev => {
        const next = new Set(prev);
        next.delete(action.id!);
        return next;
      });
    }
  };

  // Generate lexical order between two items
  const generateLexicalOrder = (before?: string, after?: string): string => {
    if (!before && !after) return "a0";
    if (!before) {
      // Insert at the beginning
      const afterVal = after || "a0";
      return afterVal.slice(0, -1) + String.fromCharCode(afterVal.charCodeAt(afterVal.length - 1) - 1);
    }
    if (!after) {
      // Insert at the end
      return before + "0";
    }
    // Insert between
    return before + "5";
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newActions = [...userActions];
    const [draggedItem] = newActions.splice(draggedIndex, 1);
    newActions.splice(dropIndex, 0, draggedItem);

    // Update lexical orders for all items
    const updatedActions = newActions.map((action, idx) => {
      const before = idx > 0 ? newActions[idx - 1].lexical_order : undefined;
      const after = idx < newActions.length - 1 ? newActions[idx + 1].lexical_order : undefined;
      return {
        ...action,
        lexical_order: generateLexicalOrder(before, after)
      };
    });

    // Optimistically update UI
    setUserActions(updatedActions);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Save to backend
    try {
      for (const action of updatedActions) {
        if (action.id) {
          await fetch(`${EXTERNAL.directus_url}/items/hiring_intent_action/${action.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lexical_order: action.lexical_order }),
          });
        }
      }
      onActionUpdate?.();
    } catch (error) {
      console.error('Error updating lexical orders:', error);
    }
  };

  const handleAddAction = async () => {
    if (isAdding) return;
    setIsAdding(true);

    // Generate lexical order for the new item (append to end)
    const lastOrder = userActions.length > 0 ? userActions[userActions.length - 1].lexical_order : undefined;
    const newOrder = generateLexicalOrder(lastOrder, undefined);

    // Create temporary action for optimistic UI update
    const tempId = -Date.now(); // Use negative timestamp as temporary ID
    const initialPayload = { text: "" };
    const tempAction: HiringIntentAction = {
      id: tempId,
      hiring_intent: intent.id,
      status: 'processing',
      category: 'manual',
      lexical_order: newOrder,
      payload: initialPayload,
      user: currentUserId || undefined,
      user_created: currentUserId || undefined,
    };

    // Optimistically add to UI
    setUserActions(prev => [...prev, tempAction]);
    setEditingActionId(tempId);
    setEditingText("");

    try {
      const result = await createHiringIntentAction(
        intent.id,
        'processing',
        'manual',
        EXTERNAL.directus_url
      );

      if (result.success && result.action && result.action.id) {
        // Update the action with the lexical order and initialize payload
        await fetch(`${EXTERNAL.directus_url}/items/hiring_intent_action/${result.action.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lexical_order: newOrder,
            payload: initialPayload
          }),
        });

        // Replace temp action with real one
        const newAction = { ...result.action, lexical_order: newOrder, payload: initialPayload };
        setUserActions(prev => prev.map(a => a.id === tempId ? newAction : a));

        // Update editing ID to the real ID
        if (editingActionId === tempId) {
          setEditingActionId(newAction.id!);
        }

        onActionUpdate?.();
      } else {
        // Remove temp action if creation failed
        setUserActions(prev => prev.filter(a => a.id !== tempId));
        if (editingActionId === tempId) {
          setEditingActionId(null);
        }
      }
    } catch (error) {
      console.error('Error adding action:', error);
      // Remove temp action on error
      setUserActions(prev => prev.filter(a => a.id !== tempId));
      if (editingActionId === tempId) {
        setEditingActionId(null);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (action: HiringIntentAction) => {
    setEditingActionId(action.id!);
    setEditingText(extractTextFromPayload(action.payload));
  };

  const handleSaveEdit = async (action: HiringIntentAction) => {
    if (!action.id) return;

    try {
      // Preserve existing payload structure for special action types
      const existingPayload = parsePayload(action.payload);
      const isSpecialType = action.category && action.category !== 'manual';

      let updatedCategory = action.category;
      let updatedPayload: any;

      if (isSpecialType && existingPayload) {
        // For special action types, preserve the category and merge text into existing payload
        updatedCategory = action.category;
        updatedPayload = {
          ...existingPayload,
          text: editingText
        };
      } else {
        // For manual actions, just update text
        updatedCategory = "manual";
        updatedPayload = {
          text: editingText
        };
      }

      const response = await fetch(`${EXTERNAL.directus_url}/items/hiring_intent_action/${action.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: updatedCategory,
          payload: updatedPayload
        }),
      });

      if (!response.ok) {
        console.error('Failed to save action:', response.status);
        return;
      }

      // Update local state only if save was successful
      setUserActions(prev =>
        prev.map(a => (a.id === action.id ? { ...a, category: updatedCategory, payload: updatedPayload } : a))
      );

      setEditingActionId(null);
      setEditingText("");
      onActionUpdate?.();
    } catch (error) {
      console.error('Error saving action text:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingActionId(null);
    setEditingText("");
  };

  const handleDeleteAction = async (actionId: number) => {
    if (!actionId) return;

    // Store the action for potential rollback
    const deletedAction = userActions.find(a => a.id === actionId);
    if (!deletedAction) return;

    // Optimistically remove from UI
    setUserActions(prev => prev.filter(a => a.id !== actionId));

    try {
      const result = await deleteHiringIntentAction(actionId, EXTERNAL.directus_url);

      if (result.success) {
        onActionUpdate?.();
      } else {
        console.error('Failed to delete action:', result.error);
        // Rollback: restore the action
        setUserActions(prev => {
          const newActions = [...prev, deletedAction];
          // Sort by lexical order to restore correct position
          return newActions.sort((a, b) => {
            if (a.lexical_order && b.lexical_order) {
              return a.lexical_order.localeCompare(b.lexical_order);
            }
            return 0;
          });
        });
      }
    } catch (error) {
      console.error('Error deleting action:', error);
      // Rollback: restore the action
      setUserActions(prev => {
        const newActions = [...prev, deletedAction];
        // Sort by lexical order to restore correct position
        return newActions.sort((a, b) => {
          if (a.lexical_order && b.lexical_order) {
            return a.lexical_order.localeCompare(b.lexical_order);
          }
          return 0;
        });
      });
    }
  };

  const handleMarkAsCompleted = async () => {
    if (isCompletingCard || isAbortingCard) return;

    // Use optimistic update if handler is provided
    if (onMoveToCompleted) {
      await onMoveToCompleted(intent.id);
      return;
    }

    // Fallback to direct API call
    setIsCompletingCard(true);
    try {
      const result = await updateHiringIntentUserState(intent.id, 'completed', EXTERNAL.directus_url);
      if (result.success) {
        onActionUpdate?.(); // Refresh the dashboard
      } else {
        console.error('Failed to update card status:', result.error);
      }
    } catch (error) {
      console.error('Error updating card status:', error);
    } finally {
      setIsCompletingCard(false);
    }
  };
  const handleMarkAsAborted = () => {
    setShowAbortDialog(true);
  };

  const handleConfirmAbort = async (reason: string) => {
    if (isCompletingCard || isAbortingCard) return;

    // Use optimistic update if handler is provided
    if (onMoveToAborted) {
      // First create the abort event for the reason
      try {
        const eventResult = await createHiringIntentEvent(
          intent.id,
          'aborted',
          reason,
          EXTERNAL.directus_url
        );

        if (!eventResult.success) {
          console.error('Failed to create abort event:', eventResult.error);
          alert('Failed to record abort reason. Please try again.');
          return;
        }

        // Then use optimistic update
        await onMoveToAborted(intent.id, reason);
      } catch (error) {
        console.error('Error aborting card:', error);
        alert('An error occurred. Please try again.');
      }
      return;
    }

    // Fallback to direct API call
    setIsAbortingCard(true);
    try {
      // First, create the hiring_intent_event with the abort reason
      const eventResult = await createHiringIntentEvent(
        intent.id,
        'aborted',
        reason,
        EXTERNAL.directus_url
      );

      if (!eventResult.success) {
        console.error('Failed to create abort event:', eventResult.error);
        alert('Failed to record abort reason. Please try again.');
        setIsAbortingCard(false);
        return;
      }

      // Only proceed to update the card status if the event was successfully created
      const result = await updateHiringIntentUserState(intent.id, 'aborted', EXTERNAL.directus_url);
      if (result.success) {
        onActionUpdate?.(); // Refresh the dashboard
      } else {
        console.error('Failed to update card status:', result.error);
        alert('Failed to move card to aborted. Please try again.');
      }
    } catch (error) {
      console.error('Error aborting card:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsAbortingCard(false);
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "funding":
        return "bg-blue-100 text-blue-800";
      case "growth":
        return "bg-green-100 text-green-800";
      case "replacement":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const hasActionStatus = (status: "completed" | "skipped") =>
    intent.actions?.some((a) => a.status === status) || false;

  const companyWebsite = intent.company_profile?.reference?.website_url;
  const companyEmail = intent.company_profile?.reference?.email;
  const sourceUrl = intent.source?.url;

  // Handle source name - it could be a string or need to extract from nested structure
  const getSourceName = () => {
    if (typeof intent.source?.source === 'string') {
      return intent.source.source;
    }
    if (intent.source?.url) {
      try {
        return new URL(intent.source.url).hostname;
      } catch {
        return 'Source';
      }
    }
    return 'Source';
  };
  const sourceName = getSourceName();

  // Check if there are pending updates for visual indicator
  const hasPendingUpdate = false; // TODO: implement this based on your logic

  const isReadOnly = currentStatus === 'completed' || currentStatus === 'aborted';

  return (
    <>
      <div
        className={`w-full space-y-2 cursor-pointer transition relative ${currentStatus === 'aborted' || currentStatus === 'completed' ? "opacity-50" : ""
          } ${hasPendingUpdate ? "ring-2 ring-blue-200" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Pending Update Indicator - subtle, fits original design */}
        {hasPendingUpdate && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" title="Updating..." />
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate text-gray-900">
              {intent.company_profile?.name || "Unknown Company"}
            </div>

            {intent.company_profile?.industry && (
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className="text-[11px] px-2 py-0.5 bg-slate-50 text-slate-600 border-slate-200"
                >
                  {Array.isArray(intent.company_profile.industry)
                    ? intent.company_profile.industry[0]
                    : intent.company_profile.industry}
                </Badge>
              </div>
          )}
          </div>

          {intent.category && (
              <Badge
                className={`${getCategoryColor(intent.category)} text-xs py-0 px-1.5`}
              >
              {intent.category}
            </Badge>
          )}
        </div>

        {/* Reason */}
      {intent.reason && (
        <p
          className={`text-xs leading-relaxed text-gray-500 ${isExpanded ? "line-clamp-3" : "line-clamp-1"
            }`}
        >
          {intent.reason}
          {!isExpanded && <span className="text-gray-400"> … more</span>}
        </p>
      )}

      {/* Expanded inspection panel */}
      {isExpanded && (
        <>
          <div
            className="
              mt-2
              pl-3
              pr-2
              py-2
              space-y-3
              text-[11px]
              text-gray-400
              bg-gray-50
              border-l-2
              border-gray-200
              rounded-sm
            "
            onClick={(e) => e.stopPropagation()}
          >
            <LocationAndCoverage intent={intent} />
            <IntentRoles intent={intent} />
            <HiringWindow intent={intent} />
            <IntentSource intent={intent} />
            <IntentCompanyLinks intent={intent} />
          </div>

          {/* Actions Section - outside grey panel */}
          <div
            className="mt-2 pt-2 border-t border-gray-200 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1 w-full"
            >
              <span>Actions ({userActions.length})</span>
            </div>
            <div className="space-y-1">
              {userActions.length > 0 ? (
                userActions.map((action, index) => (
                  <div
                    key={action.id}
                    draggable={!isReadOnly}
                    onDragStart={() => !isReadOnly && handleDragStart(index)}
                    onDragOver={(e) => !isReadOnly && handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => !isReadOnly && handleDrop(e, index)}
                    className={`flex items-center gap-2 p-2 rounded hover:bg-gray-100 transition-colors ${!isReadOnly ? 'cursor-move' : ''} ${
                      dragOverIndex === index ? 'border-t-2 border-blue-500 pt-2' : ''
                    } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  >
                    {!isReadOnly && <GripVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                    <Checkbox
                      checked={action.status === 'completed'}
                      disabled={isReadOnly || updatingActionIds.has(action.id!)}
                      onCheckedChange={() => handleActionToggle(action)}
                    />
                    <div className="flex-1 min-w-0">
                      {renderActionContent(action)}
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAction(action.id!);
                        }}
                        className="opacity-60 transition-opacity p-0.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 flex-shrink-0"
                        title="Delete action"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-400 italic p-2">No actions yet</div>
              )}
            </div>

            {/* Action Controls */}
            <div className="pt-2 space-y-2">
              {/* Add Action Button */}
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddAction();
                  }}
                  className="w-full h-8 text-sm inline-flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-medium transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Action
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Meta row - only when not expanded */}
      {!isExpanded && <IntentMetaRow intent={intent} />}

      {/* Actions Header - when not expanded */}
      {!isExpanded && (
        <div className="pt-2 border-t border-gray-100">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1 w-full cursor-pointer hover:text-gray-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Actions ({userActions.length})</span>
          </div>
        </div>
      )}

      {/* Control Buttons - Always visible */}
      {!isReadOnly && columnType === 'actions' && (
        <div className="pt-2 flex gap-2">
          <button
            className="flex-1 h-7 text-xs inline-flex items-center justify-center rounded-md bg-green-500 hover:bg-green-600 text-white font-medium transition disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              handleMarkAsCompleted();
            }}
            disabled={isCompletingCard || isAbortingCard}
          >
            {isCompletingCard ? (
              <>
                <div className="w-3 h-3 mr-1 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <Check className="w-3 h-3 mr-1" />
                Move to Completed
              </>
            )}
          </button>
          <button
            className="flex-1 h-7 text-xs inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              setShowAbortDialog(true);
            }}
            disabled={isCompletingCard || isAbortingCard}
          >
            {isAbortingCard ? (
              <>
                <div className="w-3 h-3 mr-1 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Hiding...
              </>
            ) : (
              <>
                <X className="w-3 h-3 mr-1 opacity-70" />
                Move to Aborted
              </>
            )}
          </button>
        </div>
      )}

      </div>

      {/* Abort Reason Dialog */}
      <AbortReasonDialog
        open={showAbortDialog}
        onOpenChange={setShowAbortDialog}
        onConfirm={handleConfirmAbort}
        companyName={intent.company_profile?.name}
      />
    </>
  );
}
