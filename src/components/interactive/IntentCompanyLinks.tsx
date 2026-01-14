import type { HiringIntent } from "@/lib/utils";

interface IntentCompanyLinksProps {
  intent: HiringIntent;
}

export function IntentCompanyLinks({ intent }: IntentCompanyLinksProps) {
  const companyWebsite = intent.company_profile?.reference?.website_url;
  const companyEmail = intent.company_profile?.reference?.email;

  return (
    <div>
      <div className="uppercase tracking-wide text-[10px] text-gray-400 mb-0.5">
        Company links
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {companyWebsite ? (
          <a
            href={companyWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600"
            onClick={(e) => e.stopPropagation()}
          >
            {companyWebsite} ↗
          </a>
        ) : (
          <span className="italic text-gray-400">Website — not found</span>
        )}

        {companyEmail ? (
          <a
            href={`mailto:${companyEmail}`}
            className="hover:text-blue-600"
            onClick={(e) => e.stopPropagation()}
          >
            {companyEmail}
          </a>
        ) : (
          <span className="italic text-gray-400">Email — not found</span>
        )}
      </div>
    </div>
  );
}