import React from "react";
import { Check, X } from "lucide-react";

type Report = {
  id: string;
  index: number;
  weighted_index: number;
  technical_score: number;
  domain_score: number;
  career_score: number;
  cultural_score: number;
  technical_confidence: number;
  domain_confidence: number;
  career_confidence: number;
  cultural_confidence: number;
  pros: string;
  cons: string;
  hiring_advice: string;
  candidate_advice: string;
  concern_tags: string[];
  date_created: string;
  summary?: string;
  immediate_fix?: string;
  cover_letter?: string;
  submission?: {
    job_description?: {
      id: string;
      role_name?: string;
      company_name?: string;
      backfill_status?: string;
    };
    cv_file?: string;
    user_created?: { first_name?: string; last_name?: string };
  };
};

interface PrintableReportProps {
  report: Report;
  reportId: string;
  candidateName: string;
  roleName: string;
  companyName: string;
  backfillStatus: string;
  reportType?: "concise" | "full";
}

function fmtMinutes(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

function getExpressionLevel(score: number): { level: string; color: string; imagePath: string } {
  if (score >= 80) return { level: "High", color: "text-green-600", imagePath: "/expression_high.png" };
  if (score >= 60) return { level: "Mid", color: "text-yellow-600", imagePath: "/expression_mid.png" };
  return { level: "Low", color: "text-red-600", imagePath: "/expression_low.png" };
}

const PrintableReport = React.forwardRef<HTMLDivElement, PrintableReportProps>(
  ({ report, reportId, candidateName, roleName, companyName, backfillStatus, reportType = "full" }, ref) => {
    const prosList =
      report?.pros
        ?.split("\n")
        .map((l) => l.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean) || [];

    const consList =
      report?.cons
        ?.split("\n")
        .map((l) => l.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean) || [];

    const hiring_advices =
      report?.hiring_advice
        ?.split("\n")
        .map((l) => l.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean) || [];

    const candidate_advices =
      report?.candidate_advice
        ?.split("\n")
        .map((l) => l.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean) || [];

    const ProgressBar = ({ value }: { value: number }) => (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-black h-2 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    );

    return (
      <div ref={ref} className="max-w-4xl mx-auto p-4 bg-white text-black">
        <style>
          {`
            @media print {
              body { print-color-adjust: exact; }
              .page-break { page-break-before: always; }
              .no-break { break-inside: avoid; }
            }
            .print-grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1.5rem;
            }
          `}
        </style>

        {/* Header */}
        <div className="text-center mb-4 border-b pb-3">
          <div className="flex items-center justify-center mb-2">
            <img src="/apple-icon.png" alt="Bounteer Logo" className="h-6 w-auto mr-2" />
            <span className="font-bold text-gray-800" style={{ fontSize: '14px' }}>Bounteer</span>
          </div>
          <h1 className="font-bold mb-2" style={{ fontSize: '20px' }}>Role Fit Index Report</h1>
          <div className="space-y-1">
            <p style={{ fontSize: '11px' }}>
              <strong>Candidate:</strong> {candidateName} · <strong>Role:</strong> {roleName} @ {companyName}
            </p>
            {backfillStatus && backfillStatus.toLowerCase() !== "success" && (
              <p className="text-red-600 font-medium" style={{ fontSize: '11px' }}>
                Status: {backfillStatus}
              </p>
            )}
            <p className="text-gray-600" style={{ fontSize: '9px' }}>
              Report ID: {reportId} · Created: {fmtMinutes(report.date_created)}
            </p>
          </div>
        </div>

        {/* Indexes */}
        <div className="print-grid-2 mb-4 no-break">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <h2 className="font-semibold mb-1" style={{ fontSize: '14px' }}>Role Fit Index</h2>
            <p className="font-bold text-black" style={{ fontSize: '20px' }}>{report.index}/100</p>
            <p className="text-gray-600 mt-1" style={{ fontSize: '9px' }}>40% Technical + 30% Domain + 20% Career + 10% Cultural</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <h2 className="font-semibold mb-1" style={{ fontSize: '14px' }}>Weighted Role Fit Index</h2>
            <p className="font-bold text-black" style={{ fontSize: '20px' }}>{report.weighted_index}/100</p>
            <p className="text-gray-600 mt-0.5" style={{ fontSize: '9px' }}>40% Technical + 30% Domain + 20% Career + 10% Cultural<br />(each score × confidence)</p>
          </div>
        </div>

        {/* Expression & Summary - Show in concise and full reports */}
        {(report.summary || report.immediate_fix) && (
          <div className="mb-4 no-break">
            <h2 className="font-semibold mb-2" style={{ fontSize: '16px' }}>Summary & Immediate Actions</h2>
            <div className="flex gap-4">
              {/* Expression Image Card */}
              <div
                className="rounded-lg bg-cover bg-center bg-no-repeat flex-shrink-0"
                style={{
                  backgroundImage: `url(${getExpressionLevel(report.index).imagePath})`,
                  backgroundSize: 'cover',
                  width: '120px',
                  aspectRatio: '832 / 1248'
                }}
              >
              </div>
              {/* Summary Text Card */}
              <div className="bg-gray-50 rounded-lg p-3 flex-1">
                <div className="text-black" style={{ fontSize: '11px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                  {[report.summary, report.immediate_fix]
                    .filter(Boolean)
                    .join('\n\n')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown Scores */}
        <div className="mb-4 no-break">
          <h2 className="font-semibold mb-2" style={{ fontSize: '16px' }}>Breakdown Scores</h2>
          <div className="rounded-lg bg-gray-50 p-3 space-y-2">
            {[
              {
                label: "Technical Proficiency",
                score: report.technical_score,
                confidence: report.technical_confidence,
              },
              {
                label: "Domain Expertise",
                score: report.domain_score,
                confidence: report.domain_confidence,
              },
              {
                label: "Career Progression",
                score: report.career_score,
                confidence: report.career_confidence,
              },
              {
                label: "Cultural Alignment",
                score: report.cultural_score,
                confidence: report.cultural_confidence,
              },
            ].map(({ label, score, confidence }) => {
              const expression = getExpressionLevel(score);
              return (
                <div key={label} className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold" style={{ fontSize: '11px' }}>{label}</span>
                    <div className="text-gray-600 flex items-center gap-2" style={{ fontSize: '9px' }}>
                      <span>{score}/100 · {confidence}% confidence</span>
                      <span className={`font-bold ${expression.color}`}>
                        {expression.level}
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={score} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Concern Tags - Show in concise and full reports */}
        <div className="mb-4 no-break">
          <h2 className="font-semibold mb-2" style={{ fontSize: '16px' }}>Concern Tags</h2>
          <div className="bg-gray-50 rounded-lg px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {report.concern_tags?.length ? (
                report.concern_tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full font-medium border-2 border-amber-300 bg-amber-50"
                    style={{ fontSize: '10px' }}
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-gray-500" style={{ fontSize: '11px' }}>None.</span>
              )}
            </div>
          </div>
        </div>

        {/* Full Report Sections - Only show if reportType is "full" */}
        {reportType === "full" && (
          <>
            {/* Pros - Start new page for full report detailed sections */}
            <div className="mb-3 no-break page-break pt-8">
              <h2 className="font-semibold mb-2" style={{ fontSize: '16px' }}>Pros</h2>
              <div className="bg-gray-50 rounded-lg px-5 py-3">
                <ul className="space-y-1">
                  {prosList.length ? (
                    prosList.map((p, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="leading-normal" style={{ fontSize: '12px' }}>{p}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500" style={{ fontSize: '12px' }}>No pros listed.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Cons */}
            <div className="mb-3 no-break">
              <h2 className="font-semibold mb-2" style={{ fontSize: '16px' }}>Cons</h2>
              <div className="bg-gray-50 rounded-lg px-5 py-3">
                <ul className="space-y-1">
                  {consList.length ? (
                    consList.map((c, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span className="leading-normal" style={{ fontSize: '12px' }}>{c}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500" style={{ fontSize: '12px' }}>No cons listed.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Hiring Advice */}
            <div className="mb-3 no-break">
              <h2 className="font-semibold mb-2" style={{ fontSize: '16px' }}>Hiring Advice</h2>
              <div className="bg-gray-50 rounded-lg px-5 py-3">
                <ul className="space-y-0.5">
                  {hiring_advices.length ? (
                    hiring_advices.map((c, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-black font-bold mt-0.5">•</span>
                        <span className="leading-normal" style={{ fontSize: '12px' }}>{c}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500" style={{ fontSize: '12px' }}>No advice listed.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Candidate Advice */}
            <div className="mb-3 no-break">
              <h2 className="font-semibold mb-2" style={{ fontSize: '16px' }}>Candidate Advice</h2>
              <div className="bg-gray-50 rounded-lg px-5 py-3">
                <ul className="space-y-0.5">
                  {candidate_advices.length ? (
                    candidate_advices.map((c, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-black font-bold mt-0.5">•</span>
                        <span className="leading-normal" style={{ fontSize: '12px' }}>{c}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500" style={{ fontSize: '12px' }}>No advice listed.</li>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}

      </div>
    );
  }
);

PrintableReport.displayName = "PrintableReport";

export default PrintableReport;