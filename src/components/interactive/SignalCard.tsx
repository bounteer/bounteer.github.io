import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import type { HiringIntent } from "@/lib/utils";

interface SignalCardProps {
  intent: HiringIntent;
  onAddToActions: (intentId: number) => void;
  onSkip: (intentId: number) => void;
  showActionButtons?: boolean;
  isHidden?: boolean;
}

export function SignalCard({
  intent,
  onAddToActions,
  onSkip,
  showActionButtons = true,
  isHidden = false
}: SignalCardProps) {
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

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "bg-gray-100 text-gray-800";
    if (confidence >= 80) return "bg-green-100 text-green-800";
    if (confidence >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
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

  const hasActionStatus = (status: 'completed' | 'skipped'): boolean => {
    return intent.actions?.some(action => action.status === status) || false;
  };

  return (
    <div className={`space-y-1.5 w-full ${isHidden ? 'opacity-50' : ''}`}>
      {/* Header with company name and category */}
      <div className="flex items-start justify-between gap-2">
        {intent.company_profile?.reference?.website_url || intent.company_profile?.url || intent.company_profile?.website ? (
          <a
            href={intent.company_profile.reference?.website_url || intent.company_profile.url || intent.company_profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm font-semibold line-clamp-1 flex-1 flex items-center gap-1 ${
              isHidden ? 'text-gray-500 hover:text-gray-600' : 'text-gray-900 hover:text-blue-600'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {intent.company_profile?.name || "Unknown Company"}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          <h3 className={`text-sm font-semibold line-clamp-1 flex-1 ${
            isHidden ? 'text-gray-500' : 'text-gray-900'
          }`}>
            {intent.company_profile?.name || "Unknown Company"}
          </h3>
        )}
        {intent.category && (
          <Badge className={`${getCategoryColor(intent.category)} flex-shrink-0 text-xs py-0 px-1.5 ${
            isHidden ? 'opacity-70' : ''
          }`}>
            {intent.category}
          </Badge>
        )}
      </div>

      {/* Source Link and Date */}
      {(intent.url || intent.source) && (
        <div className="flex items-center gap-2">
          <a
            href={intent.url || intent.source}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs hover:underline flex items-center gap-1 ${
              isHidden ? 'text-gray-400 hover:text-gray-500' : 'text-blue-600 hover:text-blue-800'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {intent.source || "Source"}
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className={`text-xs ${isHidden ? 'text-gray-400' : 'text-gray-400'}`}>
            {formatDate(intent.date_created)}
          </span>
        </div>
      )}

      {/* Reason */}
      {intent.reason && (
        <p className={`text-xs line-clamp-2 ${isHidden ? 'text-gray-500' : 'text-gray-600'}`}>
          {intent.reason}
        </p>
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
            <Badge key={index} variant="outline" className={`text-xs py-0 px-1.5 ${
              isHidden
                ? 'bg-gray-50 text-gray-600 border-gray-200'
                : 'bg-purple-50 text-purple-700 border-purple-200'
            }`}>
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
            <Badge key={index} variant="outline" className={`text-xs py-0 px-1.5 ${
              isHidden
                ? 'bg-gray-50 text-gray-600 border-gray-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {skill}
            </Badge>
          ))}
        </div>
      )}

      {/* Confidence Score */}
      {intent.confidence !== undefined && intent.confidence !== null && (
        <div className="flex items-center justify-between pt-1">
          <span className={`text-xs ${isHidden ? 'text-gray-400' : 'text-gray-500'}`}>Confidence</span>
          <Badge className={`${getConfidenceColor(intent.confidence)} text-xs py-0 px-1.5 ${
            isHidden ? 'opacity-70' : ''
          }`}>
            {intent.confidence}%
          </Badge>
        </div>
      )}

      {/* Action Buttons */}
      {showActionButtons && !hasActionStatus('completed') && !hasActionStatus('skipped') && (
        <div className="pt-1.5 flex gap-1.5">
          <div
            role="button"
            tabIndex={0}
            className="flex-1 h-7 text-xs inline-flex items-center justify-center rounded-md bg-green-600 hover:bg-green-700 text-white font-medium cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onAddToActions(intent.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onAddToActions(intent.id);
              }
            }}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Add
          </div>
          <div
            role="button"
            tabIndex={0}
            className="flex-1 h-7 text-xs inline-flex items-center justify-center rounded-md border border-red-300 text-red-600 hover:bg-red-50 font-medium cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onSkip(intent.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onSkip(intent.id);
              }
            }}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Skip
          </div>
        </div>
      )}
    </div>
  );
}
