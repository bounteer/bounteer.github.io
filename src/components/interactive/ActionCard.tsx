import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, ChevronDown, ChevronRight, Plus, GripVertical, Check, Ban } from "lucide-react";
import type { HiringIntent, HiringIntentAction } from "@/lib/utils";
import { getUserProfile, updateHiringIntentAction, createHiringIntentAction } from "@/lib/utils";
import { EXTERNAL } from "@/constant";
import {
  LinkedinOutreachAction,
  OrbitCompanyCallScheduleAction,
  OrbitCompanyCallReviewAction,
  EmailAction,
  ManualAction,
  parsePayload,
  extractTextFromPayload,
} from "./ActionTypes";

interface ActionCardProps {
  intent: HiringIntent;
  onActionUpdate?: () => void;
}

export function ActionCard({ intent, onActionUpdate }: ActionCardProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userActions, setUserActions] = useState<HiringIntentAction[]>([]);
  const [updatingActionIds, setUpdatingActionIds] = useState<Set<number>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [isDoneZoneActive, setIsDoneZoneActive] = useState(false);
  const [isAbortedZoneActive, setIsAbortedZoneActive] = useState(false);

  // Render action based on category
  const renderActionContent = (action: HiringIntentAction) => {
    const category = action.category;
    const payload = parsePayload(action.payload);
    const isCompleted = action.status === 'completed';
    const isEditing = editingActionId === action.id;

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
      onStartEdit: () => handleStartEdit(action),
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
    const result = await updateHiringIntentAction(action.id, newStatus, EXTERNAL.directus_url);

    if (result.success) {
      setUserActions(prev =>
        prev.map(a => (a.id === action.id ? { ...a, status: newStatus } : a))
      );
      onActionUpdate?.();
    }

    setUpdatingActionIds(prev => {
      const next = new Set(prev);
      next.delete(action.id!);
      return next;
    });
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
    setIsDoneZoneActive(true);
    setIsAbortedZoneActive(true);
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
      setIsDoneZoneActive(false);
      setIsAbortedZoneActive(false);
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
    setIsDoneZoneActive(false);
    setIsAbortedZoneActive(false);

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

  const handleDropOnDone = async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const draggedAction = userActions[draggedIndex];
    await handleMarkAsDone(draggedAction);

    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDoneZoneActive(false);
    setIsAbortedZoneActive(false);
  };

  const handleDropOnAborted = async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const draggedAction = userActions[draggedIndex];
    await handleMarkAsAborted(draggedAction);

    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDoneZoneActive(false);
    setIsAbortedZoneActive(false);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDoneZoneActive(false);
    setIsAbortedZoneActive(false);
  };

  const handleAddAction = async () => {
    if (isAdding) return;
    setIsAdding(true);

    try {
      // Generate lexical order for the new item (append to end)
      const lastOrder = userActions.length > 0 ? userActions[userActions.length - 1].lexical_order : undefined;
      const newOrder = generateLexicalOrder(lastOrder, undefined);

      const result = await createHiringIntentAction(
        intent.id,
        'processing',
        'manual',
        EXTERNAL.directus_url
      );

      if (result.success && result.action) {
        // Update the action with the lexical order and initialize payload
        if (result.action.id) {
          const initialPayload = { text: "" };

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

          // Add to local state
          const newAction = { ...result.action!, lexical_order: newOrder, payload: initialPayload };
          setUserActions(prev => [...prev, newAction]);

          // Automatically start editing the new action
          setEditingActionId(newAction.id!);
          setEditingText("");

          onActionUpdate?.();
        }
      }
    } catch (error) {
      console.error('Error adding action:', error);
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

  const handleMarkAsDone = async (action: HiringIntentAction) => {
    if (action.status !== 'completed') {
      await handleActionToggle(action);
    }
  };

  const handleMarkAsAborted = async (action: HiringIntentAction) => {
    if (!action.id || updatingActionIds.has(action.id)) return;

    setUpdatingActionIds(prev => new Set(prev).add(action.id!));

    const result = await updateHiringIntentAction(action.id, 'aborted', EXTERNAL.directus_url);

    if (result.success) {
      setUserActions(prev =>
        prev.map(a => (a.id === action.id ? { ...a, status: 'aborted' } : a))
      );
      onActionUpdate?.();
    }

    setUpdatingActionIds(prev => {
      const next = new Set(prev);
      next.delete(action.id!);
      return next;
    });
  };

  const handleStatusChange = async (action: HiringIntentAction, newStatus: string) => {
    if (!action.id || updatingActionIds.has(action.id)) return;

    setUpdatingActionIds(prev => new Set(prev).add(action.id!));

    const result = await updateHiringIntentAction(action.id, newStatus, EXTERNAL.directus_url);

    if (result.success) {
      setUserActions(prev =>
        prev.map(a => (a.id === action.id ? { ...a, status: newStatus } : a))
      );
      onActionUpdate?.();
    }

    setUpdatingActionIds(prev => {
      const next = new Set(prev);
      next.delete(action.id!);
      return next;
    });
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
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Extract source URL and name safely
  const sourceUrl = typeof intent.source === 'object' ? intent.source?.url : intent.source;
  const getSourceName = () => {
    if (typeof intent.source === 'string') {
      return intent.source;
    }
    if (typeof intent.source === 'object' && intent.source?.source) {
      return typeof intent.source.source === 'string' ? intent.source.source : 'Source';
    }
    if (typeof intent.source === 'object' && intent.source?.url) {
      try {
        return new URL(intent.source.url).hostname;
      } catch {
        return 'Source';
      }
    }
    return 'Source';
  };
  const sourceName = getSourceName();

  return (
    <div className="flex items-start gap-2 w-full">
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header with company name and category */}
        <div className="flex items-start justify-between gap-2">
          {intent.company_profile?.url || intent.company_profile?.website ? (
            <a
              href={intent.company_profile.url || intent.company_profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-gray-900 hover:text-blue-600 line-clamp-1 flex-1 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {intent.company_profile?.name || "Unknown Company"}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          ) : (
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 flex-1">
              {intent.company_profile?.name || "Unknown Company"}
            </h3>
          )}
          {intent.category && (
            <Badge className={`${getCategoryColor(intent.category)} flex-shrink-0 text-xs py-0 px-1.5`}>
              {intent.category}
            </Badge>
          )}
        </div>

        {/* Source Link and Date */}
        {(intent.url || sourceUrl) && (
          <div className="flex items-center gap-2">
            <a
              href={intent.url || sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {sourceName}
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-xs text-gray-400">
              {formatDate(intent.date_created)}
            </span>
          </div>
        )}

        {/* Reason */}
        {intent.reason && (
          <p className="text-xs text-gray-600 line-clamp-2">{intent.reason}</p>
        )}

        {/* Potential Role */}
        {intent.potential_role && (
          <div className="flex gap-1 overflow-x-auto whitespace-nowrap">
            {(Array.isArray(intent.potential_role)
              ? intent.potential_role
              : typeof intent.potential_role === "string"
                ? [intent.potential_role]
                : []
            ).map((role, index) => (
              <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs py-0 px-1.5 whitespace-nowrap">
                {role}
              </Badge>
            ))}
          </div>
        )}

        {/* Skills */}
        {intent.skill && (
          <div className="flex gap-1 overflow-x-auto whitespace-nowrap">
            {(Array.isArray(intent.skill)
              ? intent.skill
              : typeof intent.skill === "string"
                ? [intent.skill]
                : []
            ).map((skill, index) => (
              <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs py-0 px-1.5 whitespace-nowrap">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {/* Todo List - User Actions (Collapsible) */}
        <div className="pt-1.5 border-t border-gray-100">
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }
            }}
            className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 mb-1 w-full cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>Actions ({userActions.length})</span>
          </div>
          {isExpanded && (
            <div className="space-y-1">
              {userActions.length > 0 ? (
                userActions.map((action, index) => (
                  <div
                    key={action.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-start gap-2 action-item cursor-move ${
                      dragOverIndex === index ? 'border-t-2 border-blue-500 pt-2' : ''
                    } ${draggedIndex === index ? 'opacity-50' : ''} ${
                      action.status === 'aborted' ? 'opacity-60' : ''
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <Checkbox
                      checked={action.status === 'completed'}
                      disabled={updatingActionIds.has(action.id!) || action.status === 'aborted'}
                      onCheckedChange={() => handleActionToggle(action)}
                      className="mt-0.5"
                    />
                    <div className={`flex-1 min-w-0 ${action.status === 'aborted' ? 'line-through text-gray-400' : ''}`}>
                      {renderActionContent(action)}
                    </div>

                    {/* Mobile Status Selector - visible on small screens */}
                    <div className="md:hidden flex-shrink-0">
                      <Select
                        value={action.status || 'processing'}
                        onValueChange={(value) => handleStatusChange(action, value)}
                        disabled={updatingActionIds.has(action.id!)}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="processing">To Do</SelectItem>
                          <SelectItem value="completed">Done</SelectItem>
                          <SelectItem value="aborted">Aborted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Desktop Action Buttons - visible on medium+ screens */}
                    {action.status !== 'completed' && action.status !== 'aborted' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsDone(action);
                        }}
                        className="hidden md:block action-btn opacity-0 transition-opacity p-0.5 hover:bg-green-100 rounded text-gray-400 hover:text-green-600 flex-shrink-0"
                        title="Mark as done"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {action.status !== 'completed' && action.status !== 'aborted' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsAborted(action);
                        }}
                        className="hidden md:block action-btn opacity-0 transition-opacity p-0.5 hover:bg-orange-100 rounded text-gray-400 hover:text-orange-600 flex-shrink-0"
                        title="Mark as aborted"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <style>{`
                      .action-item:hover .action-btn {
                        opacity: 1;
                      }
                    `}</style>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 py-2">No actions yet. Add one to get started.</p>
              )}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isAdding) handleAddAction();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isAdding) handleAddAction();
                  }
                }}
                className={`w-full mt-2 h-7 text-xs inline-flex items-center justify-center rounded-md border border-dashed text-gray-600 hover:text-gray-900 hover:border-gray-400 font-medium transition-colors ${
                  isAdding ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {isAdding ? 'Adding...' : 'Add Action'}
              </div>
              {(isDoneZoneActive || isAbortedZoneActive) && (
                <div className="flex gap-2 mt-2">
                  {isDoneZoneActive && (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDropOnDone}
                      className="flex-1 h-12 text-xs inline-flex items-center justify-center rounded-md border-2 border-dashed border-green-400 bg-green-50 text-green-700 font-medium transition-all"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Drop to Done
                    </div>
                  )}
                  {isAbortedZoneActive && (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDropOnAborted}
                      className="flex-1 h-12 text-xs inline-flex items-center justify-center rounded-md border-2 border-dashed border-orange-400 bg-orange-50 text-orange-700 font-medium transition-all"
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Drop to Abort
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date Added */}
        {intent.actions && intent.actions.length > 0 && (
          <div className="pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Added {formatDate(intent.actions[0].date_created)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
