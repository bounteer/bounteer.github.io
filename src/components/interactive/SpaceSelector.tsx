"use client";

import { useState, useEffect } from "react";
import {
  getUserSpaces,
  getUserSpacesWithWriteAccess,
  type Space,
} from "@/lib/utils";
import { EXTERNAL } from "@/constant";

type CountTag = "job" | "candidate" | "hiring_intent";

interface SpaceSelectorProps {
  onSpaceChange: (spaceId: string | null) => void;
  selectedSpaceId?: string | null;
  className?: string;
  showAllOption?: boolean;
  requireWriteAccess?: boolean;

  /**
   * Which counts to show next to space name
   * Default: ["job", "candidate"]
   */
  countTags?: CountTag[];
}

export default function SpaceSelector({
  onSpaceChange,
  selectedSpaceId,
  className = "",
  showAllOption = false,
  requireWriteAccess = false,
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

          // Default to "all" if allowed
          if (!selectedSpaceId && showAllOption) {
            onSpaceChange("all");
          }

          // Otherwise auto-select first space
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
        console.error("Error fetching spaces:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSpaces();
  }, [selectedSpaceId, onSpaceChange, requireWriteAccess, showAllOption]);

  const renderCounts = (space: Space) => {
    const parts: string[] = [];

    countTags.forEach((tag) => {
      switch (tag) {
        case "job":
          parts.push(`${space.job_description_count || 0} jobs`);
          break;
        case "candidate":
          parts.push(`${space.candidate_profile_count || 0} candidates`);
          break;
        case "hiring_intent":
          parts.push(`${space.hiring_intent_count || 0} signals`);
          break;
        default:
          break;
      }
    });

    return parts.length > 0 ? ` (${parts.join(", ")})` : "";
  };

  if (isLoading) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Loading spaces…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-sm text-red-600 ${className}`}>
        {error}
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No spaces available
      </div>
    );
  }

  return (
    <div className={className}>
      <select
        value={selectedSpaceId ?? "all"}
        onChange={(e) => onSpaceChange(e.target.value)}
        className="
          h-9 w-64 rounded-md border border-input bg-background px-3
          text-sm shadow-sm focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-ring
        "
      >
        {showAllOption && (
          <option value="all">All Spaces</option>
        )}

        {spaces.map((space) => (
          <option key={space.id} value={space.id.toString()}>
            {space.name}
            {renderCounts(space)}
          </option>
        ))}
      </select>
    </div>
  );
}
