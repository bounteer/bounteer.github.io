import type { HiringIntent } from "@/lib/utils";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  });
};

interface HiringWindowProps {
  intent: HiringIntent;
}

export function HiringWindow({ intent }: HiringWindowProps) {
  return (
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
  );
}