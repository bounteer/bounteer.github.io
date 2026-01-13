import { useState } from "react";
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
  isHidden = false,
}: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "funding":
        return "bg-blue-50 text-blue-700";
      case "growth":
        return "bg-green-50 text-green-700";
      case "replacement":
        return "bg-amber-50 text-amber-700";
      default:
        return "bg-gray-50 text-gray-700";
    }
  };

  const getConfidenceLevel = (confidence?: number) => {
    if (!confidence) return { label: "N/A", color: "bg-gray-50 text-gray-600" };
    if (confidence >= 85) return { label: "High", color: "bg-green-50 text-green-700" };
    if (confidence >= 70) return { label: "Mid", color: "bg-yellow-50 text-yellow-700" };
    if (confidence >= 50) return { label: "Low", color: "bg-orange-50 text-orange-700" };
    return { label: "Very Low", color: "bg-gray-100 text-gray-600" };
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

  return (
    <div
      className={`w-full space-y-2 cursor-pointer transition ${isHidden ? "opacity-50" : ""
        }`}
      onClick={() => setExpanded((v) => !v)}
    >
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
            className={`${getCategoryColor(intent.category)} text-[11px] px-2 py-0.5`}
          >
            {intent.category}
          </Badge>
        )}
      </div>

      {/* Reason */}
      {intent.reason && (
        <p
          className={`text-xs leading-relaxed text-gray-600 ${expanded ? "line-clamp-3" : "line-clamp-1"
            }`}
        >
          {intent.reason}
          {!expanded && <span className="text-gray-400"> … more</span>}
        </p>
      )}

      {/* Expanded inspection panel */}
      {expanded && (
        <div
          className="
            mt-2
            pl-3
            pr-2
            py-2
            space-y-2
            text-[11px]
            text-gray-500
            bg-gray-50
            border-l-2
            border-gray-200
            rounded-sm
          "
        >
          {/* Location */}
          <div>
            <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
              Location
            </div>
            {intent.location ? (
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(intent.location)
                  ? intent.location
                  : [intent.location]
                ).map((loc, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {loc}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="italic text-gray-400">not found</span>
            )}
          </div>

          {/* Roles */}
          <div>
            <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
              Roles
            </div>
            {intent.potential_role ? (
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(intent.potential_role)
                  ? intent.potential_role
                  : [intent.potential_role]
                ).map((role, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[11px] px-2 py-0.5 bg-violet-50 text-violet-700 border-violet-200"
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="italic text-gray-400">not found</span>
            )}
          </div>

          {/* Hiring window */}
          <div>
            <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
              Hiring window
            </div>
            {(intent.predicted_window_start || intent.predicted_window_end) ? (
              <span>
                {intent.predicted_window_start
                  ? formatDate(intent.predicted_window_start)
                  : "?"}
                {" → "}
                {intent.predicted_window_end
                  ? formatDate(intent.predicted_window_end)
                  : "?"}
              </span>
            ) : (
              <span className="italic text-gray-400">not found</span>
            )}
          </div>

          {/* Source */}
          <div>
            <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
              Source
            </div>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-blue-600"
              onClick={(e) => e.stopPropagation()}
            >
              {sourceName}
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>

          {/* Company links */}
          <div>
            <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
              Company links
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {companyWebsite ? (
                <a
                  href={companyWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  {companyWebsite} ↗
                </a>
              ) : (
                <span className="italic text-gray-400">Website — not found</span>
              )}

              {companyEmail ? (
                <a
                  href={`mailto:${companyEmail}`}
                  className="hover:text-blue-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  {companyEmail}
                </a>
              ) : (
                <span className="italic text-gray-400">Email — not found</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
        <span>{intent.date_created && formatDate(intent.date_created)}</span>

        <div className="flex items-center gap-1.5">
          {intent.confidence !== undefined && intent.confidence !== null && (
            <Badge
              className={`${getConfidenceLevel(intent.confidence).color} text-[11px] px-2 py-0.5`}
            >
              {getConfidenceLevel(intent.confidence).label}
            </Badge>
          )}

          {(() => {
            const urgency = getUrgency(intent.predicted_window_start, intent.predicted_window_end);
            return urgency ? (
              <Badge
                className={`${urgency.color} text-[11px] px-2 py-0.5`}
              >
                {urgency.label}
              </Badge>
            ) : null;
          })()}
        </div>
      </div>

      {/* Actions */}
      {showActionButtons &&
        !hasActionStatus("completed") &&
        !hasActionStatus("skipped") && (
          <div className="pt-2 flex gap-2">
            <button
              className="flex-1 h-7 text-xs inline-flex items-center justify-center rounded-md bg-green-500 hover:bg-green-600 text-white font-medium transition"
              onClick={(e) => {
                e.stopPropagation();
                onAddToActions(intent.id);
            }}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Move to Actions
          </button>

          <button
            className="flex-1 h-7 text-xs inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition"
            onClick={(e) => {
                e.stopPropagation();
                onSkip(intent.id);
            }}
          >
              <XCircle className="w-3 h-3 mr-1 opacity-70" />
              Hide
            </button>
          </div>
        )}
    </div>
  );
}
