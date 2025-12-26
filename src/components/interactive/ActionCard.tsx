import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ExternalLink } from "lucide-react";
import type { HiringIntent, HiringIntentAction } from "@/lib/utils";
import { getUserProfile, updateHiringIntentAction } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

interface ActionCardProps {
  intent: HiringIntent;
  onActionUpdate?: () => void;
}

export function ActionCard({ intent, onActionUpdate }: ActionCardProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userActions, setUserActions] = useState<HiringIntentAction[]>([]);
  const [updatingActionIds, setUpdatingActionIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getUserProfile(EXTERNAL.directus_url);
      if (user) {
        setCurrentUserId(user.id);
        // Filter actions for current user
        const filtered = (intent.actions || []).filter(
          action => action.user === user.id || action.user_created === user.id
        );
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

        {/* Source Link */}
        {(intent.url || intent.source) && (
          <a
            href={intent.url || intent.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            Source
            <ExternalLink className="w-3 h-3" />
          </a>
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

        {/* Todo List - User Actions */}
        {userActions.length > 0 && (
          <div className="pt-1.5 border-t border-gray-100 space-y-1">
            <p className="text-xs font-medium text-gray-500 mb-1">Actions:</p>
            {userActions.map((action) => (
              <div
                key={action.id}
                className="flex items-start gap-2 group"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={action.status === 'completed'}
                  disabled={updatingActionIds.has(action.id!)}
                  onCheckedChange={() => handleActionToggle(action)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${
                    action.status === 'completed'
                      ? 'text-gray-400 line-through'
                      : 'text-gray-700'
                  }`}>
                    {action.category === 'user_action' ? 'Follow up' : action.category}
                    {action.payload && ` - ${action.payload}`}
                  </p>
                  {action.status === 'processing' && (
                    <Badge variant="outline" className="text-xs py-0 px-1 mt-0.5 bg-yellow-50 text-yellow-700 border-yellow-200">
                      In Progress
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

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
