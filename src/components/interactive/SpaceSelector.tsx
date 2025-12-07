"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUserSpaces, type Space } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

interface SpaceSelectorProps {
  onSpaceChange: (spaceId: string | null) => void;
  selectedSpaceId?: string | null;
  className?: string;
  showAllOption?: boolean;
}

export default function SpaceSelector({ onSpaceChange, selectedSpaceId, className = "", showAllOption = false }: SpaceSelectorProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSpaces() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getUserSpaces(EXTERNAL.directus_url);
        
        if (result.success && result.spaces) {
          setSpaces(result.spaces);
          // Auto-select first space if no space is selected and there are spaces available (only if not showing "All" option)
          if (!selectedSpaceId && result.spaces.length > 0 && !showAllOption) {
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
  }, [selectedSpaceId, onSpaceChange]);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
        <span className="text-sm text-white/70">Loading spaces...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-sm text-red-300 ${className}`}>
        {error}
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className={`text-sm text-white/70 ${className}`}>
        No spaces available
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <Select 
        value={selectedSpaceId || undefined} 
        onValueChange={onSpaceChange}
      >
        <SelectTrigger className="w-48 bg-white/20 border-white/40 text-white backdrop-blur-sm [&_svg]:text-white/70 focus-visible:ring-white/50">
          <SelectValue placeholder="Select a space" />
        </SelectTrigger>
        <SelectContent className="bg-white border border-gray-200 shadow-lg">
          {showAllOption && (
            <SelectItem 
              value="all"
              className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100"
            >
              All
            </SelectItem>
          )}
          {spaces.map((space) => (
            <SelectItem 
              key={space.id} 
              value={space.id.toString()}
              className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100"
            >
              {space.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}