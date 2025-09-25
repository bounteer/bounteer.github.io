"use client";

import { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Check, X, Download, Shield, LogIn } from "lucide-react";
import { EXTERNAL } from '@/constant';
import { getUserProfile, getLoginUrl, type UserProfile } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import LoginMask from './LoginMask';
import PrintableReport from './PrintableReport';

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
  opt_in_talent_pool?: boolean;
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

function fmtMinutes(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

function prettifyStatus(raw: string) {
  if (!raw) return "—";
  if (raw === "failed_parse_jd") return "Job description parsing failed";
  return raw.replace(/_/g, " ");
}

function getExpressionLevel(score: number): { level: string; color: string; imagePath: string } {
  if (score >= 80) {
    return { level: "High", color: "text-green-600", imagePath: "/expression_high.png" };
  } else if (score >= 60) {
    return { level: "Mid", color: "text-yellow-600", imagePath: "/expression_mid.png" };
  } else {
    return { level: "Low", color: "text-red-600", imagePath: "/expression_low.png" };
  }
}

export default function ReportCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [talentPoolOptIn, setTalentPoolOptIn] = useState(false);
  const [talentPoolSubmitting, setTalentPoolSubmitting] = useState(false);
  const [reportType, setReportType] = useState<"concise" | "full">("concise");
  const printRef = useRef<HTMLDivElement>(null);

  const blacklist = ["Bounteer Production", ""];

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Role-Fit-Report-${reportId || 'unknown'}`,
  });

  const generateCoverLetterPDF = () => {
    if (!report?.cover_letter) return;

    // Create a temporary div for the cover letter content
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '210mm';
    tempDiv.style.padding = '20mm';
    tempDiv.style.fontFamily = 'Arial, sans-serif';
    tempDiv.style.fontSize = '12px';
    tempDiv.style.lineHeight = '1.6';
    tempDiv.style.color = 'black';
    tempDiv.style.backgroundColor = 'white';

    tempDiv.innerHTML = `
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Cover Letter</h1>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">${candidateName()} - ${roleName} @ ${companyName}</p>
      </div>
      <div style="white-space: pre-wrap; text-align: justify;">${report.cover_letter}</div>
    `;

    document.body.appendChild(tempDiv);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cover Letter - ${candidateName()}</title>
            <style>
              @media print {
                body { margin: 0; }
                @page { margin: 20mm; }
              }
            </style>
          </head>
          <body>
            ${tempDiv.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }

    // Clean up
    document.body.removeChild(tempDiv);
  };

  const handleTalentPoolOptIn = async () => {
    if (!report || !currentUser) return;

    setTalentPoolSubmitting(true);
    try {
      const response = await fetch(`${EXTERNAL.directus_url}/items/role_fit_index_report/${report.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        },
        body: JSON.stringify({
          opt_in_talent_pool: talentPoolOptIn
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update talent pool preference');
      }

      // Show success message
      alert(talentPoolOptIn ? 'Successfully opted in to Bounteer Talent Pool!' : 'Successfully opted out of Bounteer Talent Pool.');

    } catch (error) {
      console.error('Error updating talent pool preference:', error);
      alert('Failed to update talent pool preference. Please try again.');
    } finally {
      setTalentPoolSubmitting(false);
    }
  };

  const downloadCV = async (fileId: string) => {
    try {
      // First get file info to get the filename
      const fileInfoRes = await fetch(`${EXTERNAL.directus_url}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${EXTERNAL.directus_key}` },
      });

      let filename = 'cv.pdf';
      if (fileInfoRes.ok) {
        const fileInfo = await fileInfoRes.json();
        filename = fileInfo?.data?.filename_download || fileInfo?.data?.title || 'cv.pdf';
      }

      // Fetch the file
      const fileRes = await fetch(`${EXTERNAL.directus_url}/assets/${fileId}`, {
        headers: { Authorization: `Bearer ${EXTERNAL.directus_key}` },
      });

      if (!fileRes.ok) {
        throw new Error('Failed to download CV');
      }

      // Create blob and download
      const blob = await fileRes.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CV:', error);
      alert('Failed to download CV. Please try again.');
    }
  };

  useEffect(() => {
    async function checkAuth() {
      const profile = await getUserProfile(EXTERNAL.directus_url);
      setCurrentUser(profile);
      setAuthChecked(true);
    }
    checkAuth();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    setReportId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    if (!authChecked) {
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      try {
        const url =
          `${EXTERNAL.directus_url}/items/role_fit_index_report/${encodeURIComponent(
            id
          )}` +
          `?fields=*,` +
          `submission.job_description.id,` +
          `submission.job_description.role_name,` +
          `submission.job_description.company_name,` +
          `submission.job_description.backfill_status,` +
          `submission.user_created.id,` +
          `submission.user_created.first_name,` +
          `submission.user_created.last_name,` +
          `submission.cv_file`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${EXTERNAL.directus_key}` },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.errors?.[0]?.message || `Fetch failed (${res.status})`);
        }

        const reportData = json.data ?? null;

        // Check access control: only allow the creator of the submission to view the report
        // Exception: reports generated by guests (EXTERNAL.guest_user_id) are publicly viewable
        if (reportData) {
          const submissionUserId = reportData.submission?.user_created?.id;
          const isGuestReport = submissionUserId === EXTERNAL.guest_user_id;

          if (!isGuestReport) {
            // For non-guest reports, enforce strict access control
            if (!currentUser) {
              throw new Error("Please log in to view this report.");
            }
            if (submissionUserId && submissionUserId !== currentUser.id) {
              throw new Error("Access denied. You can only view reports for your own submissions.");
            }
          }
          // Guest reports are accessible to everyone, no additional checks needed
        }

        setReport(reportData);

        // Set talent pool opt-in state from report data
        if (reportData?.opt_in_talent_pool !== undefined) {
          setTalentPoolOptIn(reportData.opt_in_talent_pool);
        }
      } catch (e: any) {
        setError(e.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [authChecked]);

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

  const candidateName = () => {
    const c = report?.submission?.user_created;
    const first = c?.first_name?.trim() || "";
    const last = c?.last_name?.trim() || "";
    const combined = [first, last].filter(Boolean).join(" ") || "—";
    return blacklist.includes(combined) ? "Guest" : combined;
  };

  const roleName = report?.submission?.job_description?.role_name ?? "—";
  const companyName = report?.submission?.job_description?.company_name ?? "—";
  const backfillStatus = prettifyStatus(
    report?.submission?.job_description?.backfill_status ?? ""
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p>Loading…</p>
      </div>
    );
  }

  if (!reportId) {
    return (
      <div className="text-center py-12 text-gray-500">
        No <code>id</code> provided. Visit as{" "}
        <code>/role-fit-index/report?id=10</code>.
      </div>
    );
  }

  if (error) {
    // Check if it's an access denied error
    const isAccessDenied = error.includes("Access denied") || error.includes("Please log in");
    const isLoginRequired = error.includes("Please log in");

    if (isAccessDenied) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            {isLoginRequired ? (
              <LogIn className="w-8 h-8 text-red-600" />
            ) : (
              <Shield className="w-8 h-8 text-red-600" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {isLoginRequired ? "Authentication Required" : "Access Denied"}
          </h2>
          <p className="text-gray-600 text-center mb-4 max-w-md">
            {error}
          </p>
          {isLoginRequired && (
            <Button
              onClick={() => {
                const nextPath = window.location.pathname + window.location.search;
                window.location.href = getLoginUrl(EXTERNAL.directus_url, EXTERNAL.auth_idp_key, nextPath);
              }}
              className="flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              Login to View Report
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="mb-6 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-gray-500">No report found.</div>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center">
            Role Fit Index Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="flex flex-col md:flex-row md:justify-center md:items-center gap-1 md:gap-2">
              <p className="text-sm text-gray-700">
                Candidate: {report.submission?.cv_file ? (
                  <button
                    onClick={() => downloadCV(report.submission!.cv_file!)}
                    className="text-primary-600 underline hover:text-primary-800 cursor-pointer"
                  >
                    {candidateName()}
                  </button>
                ) : (
                  candidateName()
                )}
              </p>
              <span className="hidden md:inline text-gray-400">·</span>
              <p className="text-sm text-gray-700">
                Role: {report.submission?.job_description?.id ? (
                  <a
                    href={`/role-fit-index/job-description?id=${report.submission.job_description.id}`}
                    className="text-primary-600 underline hover:text-primary-800"
                  >
                    {roleName} @ {companyName}
                  </a>
                ) : (
                  `${roleName} @ ${companyName}`
                )}
              </p>
            </div>
            {backfillStatus &&
              backfillStatus.toLowerCase() !== "success" && (
                <p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-1 text-xs font-medium">
                    {backfillStatus}
                  </span>
                </p>
              )}
            <p className="text-sm text-gray-500">
              Report ID: {reportId} · Created: {fmtMinutes(report.date_created)}
            </p>
          </div>

          {/* Indexes */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="rounded-lg bg-gray-50 p-5 text-center flex-1">
              <h2 className="text-lg font-semibold">Role Fit Index</h2>
              <p className="text-3xl font-bold">{report.index}/100</p>
              <p className="text-xs text-gray-600 mt-2">40% Technical + 30% Domain + 20% Career + 10% Cultural</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-5 text-center flex-1">
              <h2 className="text-lg font-semibold">Weighted Role Fit Index</h2>
              <p className="text-3xl font-bold">{report.weighted_index}/100</p>
              <p className="text-xs text-gray-600 mt-0.5">40% Technical + 30% Domain + 20% Career + 10% Cultural<br />(each score × confidence)</p>
            </div>
          </div>

          {/* Summary & Immediate Fix with Expression Image */}
          {(report.summary || report.immediate_fix) && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Summary & Immediate Actions</h2>
              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                <div
                  className="rounded-lg bg-cover bg-center bg-no-repeat p-5 text-center flex flex-col justify-center items-center flex-shrink-0 mx-auto md:mx-0 w-[120px] md:w-[180px]"
                  style={{
                    backgroundImage: `url(${getExpressionLevel(report.index).imagePath})`,
                    backgroundSize: 'cover',
                    aspectRatio: '832 / 1248'
                  }}
                >
                </div>
                <div className="rounded-lg bg-gray-50 p-5 flex-1">
                  <LoginMask>
                    <div className="text-gray-800 break-words whitespace-pre-wrap">
                      {[report.summary, report.immediate_fix]
                        .filter(Boolean)
                        .join('\n\n')}
                    </div>
                  </LoginMask>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-3">Breakdown Scores</h2>
            <div className="rounded-lg bg-gray-50 p-5 space-y-4">
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
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{label}</span>
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <span>{score}/100 · {confidence}% confidence</span>
                        <span className={`font-semibold ${expression.color}`}>
                          {expression.level}
                        </span>
                      </div>
                    </div>
                    <Progress value={score} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Concern Tags */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Concern Tags</h2>
            <div className="rounded-lg bg-gray-50 p-5">
              <LoginMask>
                <div className="flex flex-wrap gap-2">
                  {report.concern_tags?.length ? (
                    report.concern_tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm">None.</span>
                  )}
                </div>
              </LoginMask>
            </div>
          </div>

          {/* Pros */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Pros</h2>
            <div className="rounded-lg bg-gray-50 p-5">
              <LoginMask>
                <ul className="space-y-2">
                  {prosList.length ? (
                    prosList.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-gray-800 break-words"
                      >
                        <Check className="h-4 w-4 text-green-600 mt-0.5" />
                        {p}
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500">No pros listed.</li>
                  )}
                </ul>
              </LoginMask>
            </div>
          </div>

          {/* Cons */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Cons</h2>
            <div className="rounded-lg bg-gray-50 p-5">
              <LoginMask>
                <ul className="space-y-2">
                  {consList.length ? (
                    consList.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-gray-800 break-words"
                      >
                        <X className="h-4 w-4 text-red-600 mt-0.5" />
                        {c}
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500">No cons listed.</li>
                  )}
                </ul>
              </LoginMask>
            </div>
          </div>

          {/* Hiring Advices */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Hiring Advices</h2>
            <div className="rounded-lg bg-gray-50 p-5">
              <LoginMask>
                <ul className="space-y-2">
                  {hiring_advices.length ? (
                    hiring_advices.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-gray-800 break-words"
                      >
                        - {c}
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500">No advice listed.</li>
                  )}
                </ul>
              </LoginMask>
            </div>
          </div>

          {/* Candidate Advices */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Candidate Advices</h2>
            <div className="rounded-lg bg-gray-50 p-5">
              <LoginMask>
                <ul className="space-y-2">
                  {candidate_advices.length ? (
                    candidate_advices.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-gray-800 break-words"
                      >
                        - {c}
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500">No advice listed.</li>
                  )}
                </ul>
              </LoginMask>
            </div>
          </div>

          {/* Talent Pool Opt-in - Only show if role fit index > 75 and user is authenticated */}
          {report.index > 75 && currentUser && (
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-3">🎯 Join Bounteer Talent Pool</h2>
              <div className="rounded-lg bg-green-50 border border-green-200 p-5">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="talentPoolOptIn"
                    checked={talentPoolOptIn}
                    onCheckedChange={setTalentPoolOptIn}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="talentPoolOptIn"
                      className="font-medium text-green-900 cursor-pointer"
                    >
                      Get matched with relevant job opportunities
                    </label>
                    <p className="text-sm text-green-700 mt-1">
                      With a {report.index}/100 Role Fit Index, you're a great candidate!
                      Join our talent pool to get matched with hiring partners looking for candidates like you.
                      Your profile and report data will only be shared when there's a strong match.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleTalentPoolOptIn}
                    disabled={talentPoolSubmitting}
                    variant="default"
                    size="sm"
                  >
                    {talentPoolSubmitting ? "Saving..." : "Save Preference"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Report Downloads */}
          <div className="border-t pt-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3 text-center">Download Report</h3>
              <div className="flex flex-col md:flex-row justify-center items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReportType("concise");
                    setTimeout(handlePrint, 100);
                  }}
                  className="flex items-center gap-2 w-full md:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Concise Report PDF
                  <span className="text-xs text-gray-500 ml-1">(RFI + WRFI + Scores)</span>
                </Button>
                <Button
                  onClick={() => {
                    setReportType("full");
                    setTimeout(handlePrint, 100);
                  }}
                  className="flex items-center gap-2 w-full md:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Full Report PDF
                  <span className="text-xs text-gray-500 ml-1">(Complete Report)</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cover Letter Card - Separate from report */}
      {report.cover_letter && (
        <Card className="w-full mt-6">
          <CardHeader>
            <CardTitle className="text-center text-lg">
              Cover Letter
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Personalized cover letter generated based on your profile and the job requirements.
            </p>
            <Button
              onClick={generateCoverLetterPDF}
              className="flex items-center gap-2 mx-auto"
            >
              <Download className="h-4 w-4" />
              Download Cover Letter PDF
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Hidden printable component */}
      <div style={{ display: 'none' }}>
        <PrintableReport
          ref={printRef}
          report={report}
          reportId={reportId}
          candidateName={candidateName()}
          roleName={roleName}
          companyName={companyName}
          backfillStatus={backfillStatus}
          reportType={reportType}
        />
      </div>
    </>
  );
}
