"use client";

import { useState, useEffect } from "react";
import {
  getUserSpaces,
  getUserSpacesWithWriteAccess,
  type Space,
} from "@/lib/utils";
import { EXTERNAL } from "@/constant";
import { cn } from "@/lib/utils";

type CountTag = "job" | "candidate" | "hiring_intent";
type SpaceSelectorVariant = "default" | "glass";

interface SpaceSelectorProps {
  onSpaceChange: (spaceId: string | null) => void;
  selectedSpaceId?: string | null;
  className?: string;
  showAllOption?: boolean;
  requireWriteAccess?: boolean;
  variant?: SpaceSelectorVariant;
  label?: string;
  countTags?: CountTag[];
}

export default function SpaceSelector({
  onSpaceChange,
  selectedSpaceId,
  className = "",
  showAllOption = false,
  requireWriteAccess = false,
  variant = "default",
  label,
  countTags = ["job", "candidate"],
}: SpaceSelectorProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSpaces() {
      setIsLoading(true);
      setError(null);

      try {
        const result = requireWriteAccess
          ? await getUserSpacesWithWriteAccess(EXTERNAL.directus_url)
          : await getUserSpaces(EXTERNAL.directus_url);

        if (result.success && result.spaces) {
          setSpaces(result.spaces);

          if (!selectedSpaceId && showAllOption) {
            onSpaceChange("all");
          }

          if (
            !selectedSpaceId &&
            !showAllOption &&
            result.spaces.length > 0
          ) {
            onSpaceChange(result.spaces[0].id.toString());
          }
        } else {
          setError(result.error || "Failed to fetch spaces");
        }
      } catch (err) {
        setError("An error occurred while fetching spaces");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSpaces();
  }, [selectedSpaceId, onSpaceChange, requireWriteAccess, showAllOption]);

  const renderCounts = (space: Space) => {
    const parts: string[] = [];

    countTags.forEach((tag) => {
      if (tag === "job") parts.push(`${space.job_description_count || 0} jobs`);
      if (tag === "candidate")
        parts.push(`${space.candidate_profile_count || 0} candidates`);
      if (tag === "hiring_intent")
        parts.push(`${space.hiring_intent_count || 0} signals`);
    });

    return parts.length ? ` (${parts.join(", ")})` : "";
  };

  if (isLoading) {
    return <div className={cn("text-sm text-white/70", className)}>Loading…</div>;
  }

  if (error) {
    return <div className={cn("text-sm text-red-500", className)}>{error}</div>;
  }

  if (spaces.length === 0) {
    return (
      <div className={cn("text-sm text-white/70", className)}>
        No spaces available
      </div>
    );
  }

  const baseClass =
    "h-9 w-full rounded-md px-3 text-sm focus:outline-none appearance-none bg-transparent";

  const variantClass: Record<SpaceSelectorVariant, string> = {
    default:
      "border border-input bg-background text-foreground focus:ring-2 focus:ring-ring",
    glass:
      "bg-white/5 backdrop-blur-sm border border-white/20 text-white " +
      "focus:ring-2 focus:ring-white/40 placeholder:text-white/70",
  };

  const labelClass: Record<SpaceSelectorVariant, string> = {
    default: "text-sm font-medium text-foreground mb-2 block",
    glass: "text-sm font-medium text-white mb-2 block",
  };

  const selectId = "space-selector";

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className={labelClass[variant]}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={selectedSpaceId ?? "all"}
        onChange={(e) => onSpaceChange(e.target.value)}
        className={cn(baseClass, variantClass[variant])}
        aria-label={label || "Select a space"}
      >
        {showAllOption && <option value="all">All Spaces</option>}

        {spaces.map((space) => (
          <option
            key={space.id}
            value={space.id.toString()}
            className="text-black"
          >
            {space.name}
            {renderCounts(space)}
          </option>
        ))}
      </select>
    </div>
  );
}
