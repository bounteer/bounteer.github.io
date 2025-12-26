import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import type { HiringIntent } from "@/lib/utils";

interface SignalCardProps {
  intent: HiringIntent;
  onAddToActions: (intentId: number) => void;
  onSkip: (intentId: number) => void;
  showActionButtons?: boolean;
}

export function SignalCard({
  intent,
  onAddToActions,
  onSkip,
  showActionButtons = true
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
    <Card className="hover:shadow-lg transition-shadow w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base md:text-lg line-clamp-2 flex-1">
            {intent.company_profile?.name || "Unknown Company"}
          </CardTitle>
          {intent.category && (
            <Badge className={`${getCategoryColor(intent.category)} flex-shrink-0`}>
              {intent.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 md:space-y-3">
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
            <p className="text-xs font-medium text-gray-500 mb-1.5">Potential Role</p>
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(intent.potential_role)
                ? intent.potential_role
                : typeof intent.potential_role === "string"
                  ? [intent.potential_role]
                  : []
              ).map((role, index) => (
                <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {intent.skill && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(intent.skill)
                ? intent.skill
                : typeof intent.skill === "string"
                  ? [intent.skill]
                  : []
              ).map((skill, index) => (
                <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
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
        {showActionButtons && !hasActionStatus('completed') && !hasActionStatus('skipped') && (
          <div className="pt-3 border-t border-gray-100 flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => onAddToActions(intent.id)}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Add to Actions
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => onSkip(intent.id)}
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
}
