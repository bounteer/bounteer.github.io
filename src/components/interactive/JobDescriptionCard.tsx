"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertTriangle } from "lucide-react";
import { EXTERNAL } from '@/constant';

type JobDescription = {
  id: string;
  raw_input: string;
  role_name?: string;
  company_name?: string;
  location?: string;
  salary_range?: string;
  responsibility?: string;
  minimum_requirement?: string;
  preferred_requirement?: string;
  perk?: string;
  backfill_status?: string;
  date_created: string;
  date_updated: string;
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
  if (!raw) return "Unknown";
  if (raw === "success") return "Successfully Processed";
  if (raw === "failed_parsing_jd") return "Failed to Parse";
  return raw.replace(/_/g, " ");
}

function getStatusIcon(status: string) {
  if (status === "success") return <Check className="h-4 w-4 text-green-600" />;
  if (status?.startsWith("failed")) return <X className="h-4 w-4 text-red-600" />;
  return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
}

function getStatusColor(status: string) {
  if (status === "success") return "bg-green-100 text-green-800";
  if (status?.startsWith("failed")) return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}

export default function JobDescriptionCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobDescription, setJobDescription] = useState<JobDescription | null>(null);
  const [jdId, setJdId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    setJdId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchJobDescription = async () => {
      setLoading(true);
      try {
        const url = `${EXTERNAL.directus_url}/items/job_description/${encodeURIComponent(id)}?fields=*`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${EXTERNAL.directus_key}` },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.errors?.[0]?.message || `Fetch failed (${res.status})`);
        }
        console.log(json);
        setJobDescription(json.data ?? null);
      } catch (e: any) {
        setError(e.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    fetchJobDescription();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p>Loading…</p>
      </div>
    );
  }

  if (!jdId) {
    return (
      <div className="text-center py-12 text-gray-500">
        No <code>id</code> provided. Visit as{" "}
        <code>/role-fit-index/job-description?id=10</code>.
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

  if (!jobDescription) {
    return (
      <div className="text-center py-12 text-gray-500">No job description found.</div>
    );
  }

  const status = jobDescription.backfill_status || "";
  const statusText = prettifyStatus(status);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center">Job Description Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">
              {jobDescription.role_name || "Role Name Not Available"}
            </h2>
            {jobDescription.company_name && (
              <p className="text-lg text-gray-700">
                @ {jobDescription.company_name}
              </p>
            )}
          </div>

          {/* Status Badge */}
          <div className="flex justify-center items-center gap-2">
            <Badge className={`flex items-center gap-1 ${getStatusColor(status)}`}>
              {getStatusIcon(status)}
              {statusText}
            </Badge>
          </div>

          <p className="text-sm text-gray-500">
            JD ID: {jdId} · Created: {fmtMinutes(jobDescription.date_created)} ·
            Updated: {fmtMinutes(jobDescription.date_updated)}
          </p>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobDescription.location && (
            <div className="rounded-lg bg-gray-50 p-5 text-center">
              <h3 className="text-lg font-semibold">Location</h3>
              <p className="text-3xl font-bold">{jobDescription.location}</p>
            </div>
          )}

          {jobDescription.salary_range && (
            <div className="rounded-lg bg-gray-50 p-5 text-center">
              <h3 className="text-lg font-semibold">Salary Range</h3>
              <p className="text-3xl font-bold">{jobDescription.salary_range}</p>
            </div>
          )}
        </div>

        {/* Responsibilities */}
        {jobDescription.responsibility && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Responsibilities</h3>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-gray-900 whitespace-pre-wrap">{jobDescription.responsibility}</p>
            </div>
          </div>
        )}

        {/* Minimum Requirements */}
        {jobDescription.minimum_requirement && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Minimum Requirements</h3>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-gray-900 whitespace-pre-wrap">{jobDescription.minimum_requirement}</p>
            </div>
          </div>
        )}

        {/* Preferred Requirements */}
        {jobDescription.preferred_requirement && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Preferred Requirements</h3>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-gray-900 whitespace-pre-wrap">{jobDescription.preferred_requirement}</p>
            </div>
          </div>
        )}

        {/* perk */}
        {jobDescription.perk && (
          <div>
            <h3 className="text-lg font-semibold mb-3">perk</h3>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-gray-900 whitespace-pre-wrap">{jobDescription.perk}</p>
            </div>
          </div>
        )}

        {/* Original Input */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Original Input</h3>
          <div className="rounded-lg bg-gray-50 p-4">
            {jobDescription.raw_input.startsWith('http') ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">Job Description URL:</p>
                <a
                  href={jobDescription.raw_input}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 underline hover:text-primary-800 break-all"
                >
                  {jobDescription.raw_input}
                </a>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-2">Job Description Text:</p>
                <p className="whitespace-pre-wrap text-gray-900">
                  {jobDescription.raw_input}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}