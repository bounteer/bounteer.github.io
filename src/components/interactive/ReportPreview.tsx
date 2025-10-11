"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { EXTERNAL, SPEC } from '@/constant';
import { getAuthHeaders, type UserProfile } from '@/lib/utils';

type FullReport = {
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

interface ReportPreviewProps {
  reportId: string | null;
  currentUser: UserProfile | null;
}

export default function ReportPreview({ reportId, currentUser }: ReportPreviewProps) {
  const [fullReportData, setFullReportData] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<{
    strengths: boolean;
    improvements: boolean;
    advice: boolean;
  }>({
    strengths: false,
    improvements: false,
    advice: false,
  });

  const DIRECTUS_URL = EXTERNAL.directus_url;

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  // Helper function to format RFI score
  const formatRFIScore = (score?: number) => {
    if (score === undefined || score === null) return "—";
    return `${Math.round(score)}%`;
  };

  // Helper function to get RFI score color
  const getRFIScoreColor = (score?: number) => {
    if (score === undefined || score === null) return "text-gray-500";
    if (score >= SPEC.high_threshold) return "text-green-600";
    if (score >= SPEC.mid_threshold) return "text-yellow-600";
    return "text-red-600";
  };

  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fetch full report data
  const fetchFullReport = async (id: string): Promise<FullReport | null> => {
    try {
      const fields = `id,index,weighted_index,technical_score,domain_score,career_score,cultural_score,technical_confidence,domain_confidence,career_confidence,cultural_confidence,pros,cons,hiring_advice,candidate_advice,concern_tags,date_created,summary,immediate_fix,cover_letter,submission.job_description.id,submission.job_description.role_name,submission.job_description.company_name,submission.job_description.backfill_status,submission.cv_file,submission.user_created.first_name,submission.user_created.last_name`;
      const url = `${DIRECTUS_URL}/items/role_fit_index_report/${id}?fields=${fields}`;

      const res = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders(currentUser),
      });

      if (!res.ok) throw new Error(`Failed to fetch report: ${res.statusText}`);
      const json = await res.json();
      return json.data as FullReport;
    } catch (error: any) {
      console.error("Error fetching full report:", error);
      throw error;
    }
  };

  // Effect to fetch report when reportId changes
  useEffect(() => {
    if (!reportId) {
      setFullReportData(null);
      setError(null);
      return;
    }

    const loadReport = async () => {
      setLoading(true);
      setError(null);

      try {
        const report = await fetchFullReport(reportId);
        setFullReportData(report);
      } catch (err: any) {
        setError(err.message || 'Failed to load report details');
        setFullReportData(null);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [reportId, currentUser]);

  if (!reportId) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-sm">Select a report from the previous reports to view its content here</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading report details...</span>
      </div>
    );
  }

  if (error || !fullReportData) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="text-sm">{error || 'Failed to load report details'}</div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-white h-full flex flex-col">
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h4 className="font-semibold text-xl">Report #{fullReportData.id}</h4>
            <p className="text-sm text-gray-600">{formatDate(fullReportData.date_created)}</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getRFIScoreColor(fullReportData.index)}`}>
              {formatRFIScore(fullReportData.index)}
            </div>
            <p className="text-sm text-gray-500">Role Fit Index</p>
          </div>
        </div>

        {/* Score Breakdown */}
        <div>
          <h5 className="font-medium text-lg mb-2">Full Scores</h5>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className={`text-lg font-bold ${getRFIScoreColor(fullReportData.technical_score)}`}>
                {formatRFIScore(fullReportData.technical_score)}
              </div>
              <div className="font-medium text-sm">Technical</div>
              <div className="text-xs text-gray-500">{Math.round(fullReportData.technical_confidence)}% conf.</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className={`text-lg font-bold ${getRFIScoreColor(fullReportData.domain_score)}`}>
                {formatRFIScore(fullReportData.domain_score)}
              </div>
              <div className="font-medium text-sm">Domain</div>
              <div className="text-xs text-gray-500">{Math.round(fullReportData.domain_confidence)}% conf.</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className={`text-lg font-bold ${getRFIScoreColor(fullReportData.career_score)}`}>
                {formatRFIScore(fullReportData.career_score)}
              </div>
              <div className="font-medium text-sm">Career</div>
              <div className="text-xs text-gray-500">{Math.round(fullReportData.career_confidence)}% conf.</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className={`text-lg font-bold ${getRFIScoreColor(fullReportData.cultural_score)}`}>
                {formatRFIScore(fullReportData.cultural_score)}
              </div>
              <div className="font-medium text-sm">Cultural</div>
              <div className="text-xs text-gray-500">{Math.round(fullReportData.cultural_confidence)}% conf.</div>
            </div>
          </div>
        </div>

        {/* Immediate Fix */}
        {fullReportData.immediate_fix && (
          <div>
            <h5 className="font-medium text-lg text-orange-700 mb-2">Immediate Fixes</h5>
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {fullReportData.immediate_fix}
              </p>
            </div>
          </div>
        )}

        {/* Insights */}
        <div className="space-y-3">
          <h5 className="font-medium text-lg text-blue-700 mb-2">Insights</h5>

          {fullReportData.pros && (
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('strengths')}
                className="w-full p-3 bg-green-50 hover:bg-green-100 transition-colors flex items-center justify-between"
              >
                <h6 className="font-medium text-green-800">Strengths</h6>
                {expandedSections.strengths ? (
                  <ChevronDown className="h-4 w-4 text-green-700" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-green-700" />
                )}
              </button>
              {expandedSections.strengths && (
                <div className="p-4 bg-white border-t border-green-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {fullReportData.pros}
                  </p>
                </div>
              )}
            </div>
          )}

          {fullReportData.cons && (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('improvements')}
                className="w-full p-3 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-between"
              >
                <h6 className="font-medium text-red-800">Areas for Improvement</h6>
                {expandedSections.improvements ? (
                  <ChevronDown className="h-4 w-4 text-red-700" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-red-700" />
                )}
              </button>
              {expandedSections.improvements && (
                <div className="p-4 bg-white border-t border-red-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {fullReportData.cons}
                  </p>
                </div>
              )}
            </div>
          )}

          {fullReportData.candidate_advice && (
            <div className="border border-blue-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('advice')}
                className="w-full p-3 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between"
              >
                <h6 className="font-medium text-blue-800">Candidate Advice</h6>
                {expandedSections.advice ? (
                  <ChevronDown className="h-4 w-4 text-blue-700" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-blue-700" />
                )}
              </button>
              {expandedSections.advice && (
                <div className="p-4 bg-white border-t border-blue-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {fullReportData.candidate_advice}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* View Full Report Button */}
      <div className="p-6">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            window.open(`/role-fit-index/report?id=${fullReportData.id}`, '_blank');
          }}
        >
          View Full Report
        </Button>
      </div>
    </div>
  );
}