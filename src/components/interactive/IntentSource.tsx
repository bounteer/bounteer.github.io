import { ExternalLink } from "lucide-react";
import type { HiringIntent } from "@/lib/utils";

interface IntentSourceProps {
  intent: HiringIntent;
}

export function IntentSource({ intent }: IntentSourceProps) {
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
  );
}