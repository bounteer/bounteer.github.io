import { Badge } from "@/components/ui/badge";
import type { HiringIntent } from "@/lib/utils";

interface IntentRolesProps {
  intent: HiringIntent;
}

export function IntentRoles({ intent }: IntentRolesProps) {
  return (
    <div>
      <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
        Roles
      </div>
      {intent.potential_role ? (
        <div className="flex flex-wrap gap-1.5">
          {(Array.isArray(intent.potential_role)
            ? intent.potential_role
            : [intent.potential_role]
          ).map((role, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-[11px] px-2 py-0.5 bg-violet-50 text-violet-700 border-violet-200"
            >
              {role}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="italic text-gray-400">not found</span>
      )}
    </div>
  );
}