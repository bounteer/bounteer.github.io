"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Briefcase, MapPin, DollarSign, Calendar } from "lucide-react";
import { EXTERNAL } from '@/constant';

type CandidateProfile = {
  id: number;
  name: string;
  job_title?: string;
  year_of_experience?: string;
  employment_type?: string;
  company_size?: string;
  location?: string;
  salary_range?: string;
  skills?: string[];
  context?: string;
  source?: string;
  source_item_id?: number;
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

export default function CandidateProfileCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);

  useEffect(() => {
    // Ensure we're in the browser environment
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    setCandidateId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchCandidateProfile = async () => {
      setLoading(true);
      try {
        const url = `${EXTERNAL.directus_url}/items/candidate_profile/${encodeURIComponent(id)}?fields=*`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${EXTERNAL.directus_key}` },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.errors?.[0]?.message || `Fetch failed (${res.status})`);
        }
        console.log(json);
        setCandidate(json.data ?? null);
      } catch (e: any) {
        setError(e.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    fetchCandidateProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p>Loading…</p>
      </div>
    );
  }

  if (!candidateId) {
    return (
      <div className="text-center py-12 text-gray-500">
        No <code>id</code> provided. Visit as{" "}
        <code>/role-fit-index/candidate-profile?id=1</code>.
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

  if (!candidate) {
    return (
      <div className="text-center py-12 text-gray-500">No candidate profile found.</div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center">Candidate Profile Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="h-10 w-10 text-primary-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">
              {candidate.name || "Name Not Available"}
            </h2>
            {candidate.job_title && (
              <p className="text-lg text-gray-700 flex items-center justify-center gap-2">
                <Briefcase className="h-5 w-5" />
                {candidate.job_title}
              </p>
            )}
          </div>

          <p className="text-sm text-gray-500">
            Profile ID: {candidateId} · Created: {fmtMinutes(candidate.date_created)} ·
            Updated: {fmtMinutes(candidate.date_updated)}
          </p>
        </div>

        {/* Basic Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {candidate.year_of_experience && (
            <div className="rounded-lg bg-gray-50 p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold">Experience</h3>
              </div>
              <p className="text-3xl font-bold">{candidate.year_of_experience}</p>
            </div>
          )}

          {candidate.location && (
            <div className="rounded-lg bg-gray-50 p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold">Location</h3>
              </div>
              <p className="text-3xl font-bold">{candidate.location}</p>
            </div>
          )}

          {candidate.salary_range && (
            <div className="rounded-lg bg-gray-50 p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold">Salary Range</h3>
              </div>
              <p className="text-3xl font-bold">{candidate.salary_range}</p>
            </div>
          )}

          {candidate.employment_type && (
            <div className="rounded-lg bg-gray-50 p-5 text-center">
              <h3 className="text-lg font-semibold mb-2">Employment Type</h3>
              <p className="text-3xl font-bold">{candidate.employment_type}</p>
            </div>
          )}
        </div>

        {/* Company Size */}
        {candidate.company_size && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Company Size Preference</h3>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{candidate.company_size}</p>
            </div>
          </div>
        )}

        {/* Skills */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Skills</h3>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1 text-sm">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Context */}
        {candidate.context && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Additional Context</h3>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-gray-900 whitespace-pre-wrap">{candidate.context}</p>
            </div>
          </div>
        )}

        {/* Source Information */}
        {(candidate.source || candidate.source_item_id) && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Source Information</h3>
            <div className="rounded-lg bg-gray-50 p-4">
              {candidate.source && (
                <p className="text-gray-900 mb-2">
                  <span className="font-semibold">Source:</span> {candidate.source}
                </p>
              )}
              {candidate.source_item_id && (
                <p className="text-gray-900">
                  <span className="font-semibold">Source Item ID:</span> {candidate.source_item_id}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
