import { Badge } from "@/components/ui/badge";
import type { HiringIntent } from "@/lib/utils";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  });
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

interface IntentMetaRowProps {
  intent: HiringIntent;
}

export function IntentMetaRow({ intent }: IntentMetaRowProps) {
  return (
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
  );
}