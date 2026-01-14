import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import type { HiringIntent } from "@/lib/utils";
import { LocationAndCoverage } from "./LocationAndCoverage";
import { HiringWindow } from "./HiringWindow";
import { IntentMetaRow } from "./IntentMetaRow";
import { IntentRoles } from "./IntentRoles";
import { IntentSource } from "./IntentSource";
import { IntentCompanyLinks } from "./IntentCompanyLinks";

interface SignalCardProps {
  intent: HiringIntent;
  onAddToActions: (intentId: number) => void;
  onSkip: (intentId: number) => void;
  showActionButtons?: boolean;
  isHidden?: boolean;
  isUpdating?: boolean;
  hasPendingUpdate?: boolean;
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const getCountryName = (code?: string) =>
  code ? regionNames.of(code.toUpperCase()) ?? code : undefined;


export function SignalCard({
  intent,
  onAddToActions,
  onSkip,
  showActionButtons = true,
  isHidden = false,
  isUpdating = false,
  hasPendingUpdate = false,
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
      className={`w-full space-y-2 cursor-pointer transition relative ${isHidden ? "opacity-50" : ""
        } ${hasPendingUpdate ? "ring-2 ring-blue-200" : ""}`}
      onClick={() => setExpanded((v) => !v)}
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
          {/* Location & Coverage */}
          <LocationAndCoverage intent={intent} />

          {/* Roles */}
          <IntentRoles intent={intent} />

          {/* Hiring window */}
          <HiringWindow intent={intent} />

          {/* Source */}
          <IntentSource intent={intent} />

          {/* Company links */}
          <IntentCompanyLinks intent={intent} />
        </div>
      )}

      {/* Meta row */}
      <IntentMetaRow intent={intent} />

      {/* Actions */}
      {showActionButtons &&
        !hasActionStatus("completed") &&
        !hasActionStatus("skipped") && (
          <div className="pt-2 flex gap-2">
            <button
              className="flex-1 h-7 text-xs inline-flex items-center justify-center rounded-md bg-green-500 hover:bg-green-600 text-white font-medium transition disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                onAddToActions(intent.id);
              }}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <div className="w-3 h-3 mr-1 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Moving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Move to Actions
                </>
              )}
            </button>

            <button
              className="flex-1 h-7 text-xs inline-flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                onSkip(intent.id);
              }}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <div className="w-3 h-3 mr-1 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  Hiding...
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1 opacity-70" />
                  Hide
                </>
              )}
            </button>
          </div>
        )}
    </div>
  );
}
