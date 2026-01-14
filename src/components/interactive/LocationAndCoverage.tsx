import { Badge } from "@/components/ui/badge";
import type { HiringIntent } from "@/lib/utils";

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const getCountryName = (code?: string) =>
  code ? regionNames.of(code.toUpperCase()) ?? code : undefined;

interface LocationAndCoverageProps {
  intent: HiringIntent;
}

export function LocationAndCoverage({ intent }: LocationAndCoverageProps) {
  return (
    <div className="flex gap-4">
      {/* Location */}
      <div className="flex-1">
        <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
          Location
        </div>
        <div className="space-y-1.5">
          {intent.work_location ? (
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
              >
                {intent.work_location.city && intent.work_location.country_code
                  ? `${intent.work_location.city}, ${getCountryName(intent.work_location.country_code)}`
                  : intent.work_location.city ||
                    getCountryName(intent.work_location.country_code) ||
                    'Unknown'}
              </Badge>
            </div>
          ) : intent.commercial_region ? (
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(intent.commercial_region)
                ? intent.commercial_region
                : [intent.commercial_region]
              ).map((region, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[11px] px-2 py-0.5 bg-gray-50 text-gray-600 border-gray-200"
                >
                  {region}
                </Badge>
              ))}
            </div>
          ) : intent.location ? (
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(intent.location)
                ? intent.location
                : [intent.location]
              ).map((loc, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                >
                  {loc}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="italic text-gray-400">not found</span>
          )}
        </div>
      </div>

      {/* Coverage */}
      {intent.work_location && intent.commercial_region && (
        <div className="flex-1">
          <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
            Coverage
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(intent.commercial_region)
              ? intent.commercial_region
              : [intent.commercial_region]
            ).map((region, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[11px] px-2 py-0.5 bg-gray-50 text-gray-600 border-gray-200"
              >
                {region}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}