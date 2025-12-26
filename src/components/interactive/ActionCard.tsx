import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import type { HiringIntent } from "@/lib/utils";

interface ActionCardProps {
  intent: HiringIntent;
}

export function ActionCard({ intent }: ActionCardProps) {
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500 w-full">
      <CardContent className="pt-4 px-3 md:px-6">
        <div className="flex items-start gap-2 md:gap-3">
          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="font-semibold text-sm md:text-base text-gray-900 line-clamp-2">
                {intent.company_profile?.name || "Unknown Company"}
              </h3>
              {intent.category && (
                <Badge className={getCategoryColor(intent.category)} variant="secondary">
                  {intent.category}
                </Badge>
              )}
            </div>

            {/* Potential Role */}
            {intent.potential_role && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">Role</p>
                <div className="flex flex-wrap gap-1">
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

            {/* Reason */}
            {intent.reason && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Reason</p>
                <p className="text-sm text-gray-600 line-clamp-2">{intent.reason}</p>
              </div>
            )}

            {/* Skills */}
            {intent.skill && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">Skills</p>
                <div className="flex flex-wrap gap-1">
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

            {/* Actions metadata */}
            {intent.actions && intent.actions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Added {formatDate(intent.actions[0].date_created)}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
