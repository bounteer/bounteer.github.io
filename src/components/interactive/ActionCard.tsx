import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ExternalLink, ChevronDown, ChevronRight, Plus, GripVertical } from "lucide-react";
import type { HiringIntent, HiringIntentAction } from "@/lib/utils";
import { getUserProfile, updateHiringIntentAction, createHiringIntentAction } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

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

    try {
      // Generate lexical order for the new item (append to end)
      const lastOrder = userActions.length > 0 ? userActions[userActions.length - 1].lexical_order : undefined;
      const newOrder = generateLexicalOrder(lastOrder, undefined);

      const result = await createHiringIntentAction(
        intent.id,
        'processing',
        'user_action',
        EXTERNAL.directus_url
      );

      if (result.success && result.action) {
        // Update the action with the lexical order
        if (result.action.id) {
          await fetch(`${EXTERNAL.directus_url}/items/hiring_intent_action/${result.action.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lexical_order: newOrder }),
          });

          // Add to local state
          const newAction = { ...result.action!, lexical_order: newOrder };
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
    setEditingText(action.payload || "");
  };

  const handleSaveEdit = async (action: HiringIntentAction) => {
    if (!action.id) return;

    try {
      await fetch(`${EXTERNAL.directus_url}/items/hiring_intent_action/${action.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload: editingText }),
      });

      // Update local state
      setUserActions(prev =>
        prev.map(a => (a.id === action.id ? { ...a, payload: editingText } : a))
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
    <div className="flex items-start gap-2 w-full border-l-2 border-l-green-500 pl-2">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
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
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(intent.potential_role)
              ? intent.potential_role
              : typeof intent.potential_role === "string"
                ? [intent.potential_role]
                : []
            ).map((role, index) => (
              <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs py-0 px-1.5">
                {role}
              </Badge>
            ))}
          </div>
        )}

        {/* Skills */}
        {intent.skill && (
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(intent.skill)
              ? intent.skill
              : typeof intent.skill === "string"
                ? [intent.skill]
                : []
            ).map((skill, index) => (
              <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs py-0 px-1.5">
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
                    className={`flex items-start gap-2 group cursor-move ${
                      dragOverIndex === index ? 'border-t-2 border-blue-500 pt-2' : ''
                    } ${draggedIndex === index ? 'opacity-50' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <Checkbox
                      checked={action.status === 'completed'}
                      disabled={updatingActionIds.has(action.id!)}
                      onCheckedChange={() => handleActionToggle(action)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      {editingActionId === action.id ? (
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveEdit(action)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit(action);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          placeholder="Enter action description..."
                          className="w-full text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p
                          className={`text-xs cursor-text ${
                            action.status === 'completed'
                              ? 'text-gray-400 line-through'
                              : 'text-gray-700'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(action);
                          }}
                        >
                          {action.payload || (
                            <span className="text-gray-400 italic">Click to add description...</span>
                          )}
                        </p>
                      )}
                    </div>
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
