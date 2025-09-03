"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, X } from "lucide-react";

const DIRECTUS_URL = "https://directus.bounteer.com";
const READ_TOKEN = "dZtMfEuzhzUS0YATh0pOZfBAdOYlhowE";

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
  concern_tags: string[];
  date_created: string;
  user_created?: { first_name?: string; last_name?: string };
  submission?: {
    job_description?: {
      role_name?: string;
      company_name?: string;
      backfill_status?: string;
    };
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

export default function ReportCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  const blacklist = ["Bounteer Production", ""];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    setReportId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      try {
        const url =
          `${DIRECTUS_URL}/items/role_fit_index_report/${encodeURIComponent(
            id
          )}` +
          `?fields=*,user_created.first_name,user_created.last_name,` +
          `submission.job_description.role_name,submission.job_description.company_name,` +
          `submission.job_description.backfill_status`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${READ_TOKEN}` },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.errors?.[0]?.message || `Fetch failed (${res.status})`);
        }
        setReport(json.data ?? null);
      } catch (e: any) {
        setError(e.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

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

  const candidateName = () => {
    const c = report?.user_created;
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center">Role Fit Index Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-sm text-gray-700">
            Candidate: {candidateName()} · Role: {roleName} @ {companyName}
          </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg bg-gray-50 p-5 text-center">
            <h2 className="text-lg font-semibold">Role Fit Index</h2>
            <p className="text-3xl font-bold">{report.index}/100</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-5 text-center">
            <h2 className="text-lg font-semibold">Weighted Role Fit Index</h2>
            <p className="text-3xl font-bold">{report.weighted_index}/100</p>
          </div>
        </div>

        {/* Breakdown scores */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Breakdown Scores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            ].map(({ label, score, confidence }) => (
              <div key={label} className="rounded-lg bg-gray-50 p-5">
                <h3 className="font-semibold text-base mb-2">{label}</h3>
                <p className="text-sm">
                  Score: <span className="font-medium">{score}/100</span>
                </p>
                <Progress value={score} className="my-2" />
                <p className="text-xs text-gray-500">
                  Confidence: {confidence}%
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Concern Tags */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Concern Tags</h2>
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
        </div>

        {/* Pros */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Pros</h2>
          <ul className="space-y-1">
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
        </div>

        {/* Cons */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Cons</h2>
          <ul className="space-y-1">
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
        </div>

        {/* Footer link */}
        <div className="text-center">
          <a
            href="/role-fit-index"
            className="text-primary-600 underline hover:text-primary-800"
          >
            &larr; New analysis
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
