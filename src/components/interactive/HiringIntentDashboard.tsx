"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SpaceSelector from "@/components/interactive/SpaceSelector";
import { getHiringIntentsBySpace, createHiringIntentAction, type HiringIntent, type HiringIntentAction } from "@/lib/utils";
import { EXTERNAL } from "@/constant";
import { CheckCircle2, XCircle } from "lucide-react";

export default function HiringIntentDashboard() {
  const [hiringIntents, setHiringIntents] = useState<HiringIntent[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHiringIntents();
  }, [selectedSpaceId]);

  const fetchHiringIntents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const spaceIdNumber = selectedSpaceId && selectedSpaceId !== "all" ? parseInt(selectedSpaceId) : null;
      const result = await getHiringIntentsBySpace(spaceIdNumber, EXTERNAL.directus_url);

      if (result.success && result.hiringIntents) {
        setHiringIntents(result.hiringIntents);
      } else {
        setError(result.error || "Failed to fetch orbit signals");
      }
    } catch (err) {
      setError("An error occurred while fetching orbit signals");
      console.error("Error fetching orbit signals:", err);
    } finally {
      setIsLoading(false);
    }
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

  const handleSpaceChange = (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
  };

  const handleActionStatusUpdate = async (
    hiringIntentId: number,
    actionType: 'completed' | 'skipped'
  ) => {
    try {
      const result = await createHiringIntentAction(
        hiringIntentId,
        actionType,
        'user_action',
        EXTERNAL.directus_url
      );

      if (result.success && result.action) {
        // Update local state to add the new action to the intent
        setHiringIntents(prevIntents =>
          prevIntents.map(intent =>
            intent.id === hiringIntentId
              ? {
                  ...intent,
                  actions: [...(intent.actions || []), result.action!]
                }
              : intent
          )
        );
      } else {
        console.error('Failed to create action:', result.error);
        setError(result.error || 'Failed to create action');
      }
    } catch (err) {
      console.error('Error creating action:', err);
      setError('An error occurred while creating action');
    }
  };

  // Helper function to check if intent has a specific action status
  const hasActionStatus = (intent: HiringIntent, status: 'completed' | 'skipped'): boolean => {
    return intent.actions?.some(action => action.status === status) || false;
  };

  // Filter intents into different categories
  const pendingIntents = hiringIntents.filter(
    intent => !hasActionStatus(intent, 'completed') && !hasActionStatus(intent, 'skipped')
  );
  const actionIntents = hiringIntents.filter(
    intent => hasActionStatus(intent, 'completed')
  );
  // Skipped intents are not displayed

  const renderIntentCard = (intent: HiringIntent, showActions: boolean = true) => (
    <Card key={intent.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">
            {intent.company_profile?.name || "Unknown Company"}
          </CardTitle>
          {intent.category && (
            <Badge className={getCategoryColor(intent.category)}>
              {intent.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Reason */}
        {intent.reason && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Reason</p>
            <p className="text-sm text-gray-700 line-clamp-3">{intent.reason}</p>
          </div>
        )}

        {/* Potential Role */}
        {intent.potential_role && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Potential Role</p>
            <p className="text-sm text-gray-700">
              {typeof intent.potential_role === "string"
                ? intent.potential_role
                : JSON.stringify(intent.potential_role)}
            </p>
          </div>
        )}

        {/* Skills */}
        {intent.skill && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Skills</p>
            <p className="text-sm text-gray-700">
              {typeof intent.skill === "string"
                ? intent.skill
                : JSON.stringify(intent.skill)}
            </p>
          </div>
        )}

        {/* Confidence Score */}
        {intent.confidence !== undefined && intent.confidence !== null && (
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Confidence</p>
            <Badge className={getConfidenceColor(intent.confidence)}>
              {intent.confidence}%
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
        {showActions && !hasActionStatus(intent, 'completed') && !hasActionStatus(intent, 'skipped') && (
          <div className="pt-3 border-t border-gray-100 flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleActionStatusUpdate(intent.id, 'completed')}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Add to Actions
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => handleActionStatusUpdate(intent.id, 'skipped')}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Skip
            </Button>
          </div>
        )}

        {/* Date Created */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Created {formatDate(intent.date_created)}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Space Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Filter by Space:</label>
          <SpaceSelector
            onSpaceChange={handleSpaceChange}
            selectedSpaceId={selectedSpaceId}
            showAllOption={true}
            className="w-auto"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
            <span className="text-gray-600">Loading orbit signals...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && hiringIntents.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">No orbit signals found</p>
              <p className="text-gray-400 text-sm mt-2">
                {selectedSpaceId && selectedSpaceId !== "all"
                  ? "Try selecting a different space or 'All' to see all orbit signals."
                  : "Orbit signals will appear here once they are created."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Section */}
      {!isLoading && !error && actionIntents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Actions</h2>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {actionIntents.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {actionIntents.map((intent) => renderIntentCard(intent, false))}
          </div>
        </div>
      )}

      {/* Orbit Signals Grid */}
      {!isLoading && !error && pendingIntents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Orbit Signals</h2>
            <Badge variant="secondary">
              {pendingIntents.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingIntents.map((intent) => renderIntentCard(intent, true))}
          </div>
        </div>
      )}
    </div>
  );
}
