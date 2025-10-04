"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { EXTERNAL } from '@/constant';
import { getAuthHeaders, type UserProfile } from '@/lib/utils';
import RainbowGlowWrapper from './RainbowGlowWrapper';

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
  isNewlyGenerated?: boolean;
}

export default function ReportPreview({ reportId, currentUser, isNewlyGenerated = false }: ReportPreviewProps) {
  const [fullReportData, setFullReportData] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
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
    <RainbowGlowWrapper
      isActive={isNewlyGenerated}
      duration={10000}
      intensity="subtle"
      animationSpeed={3}
      borderRadius="rounded-lg"
    >
      <div className="border rounded-lg bg-white max-h-96 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h4 className="font-semibold text-lg">Report #{fullReportData.id}</h4>
            <p className="text-sm text-gray-600">{formatDate(fullReportData.date_created)}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getRFIScoreColor(fullReportData.index)}`}>
              {formatRFIScore(fullReportData.index)}
            </div>
            <p className="text-xs text-gray-500">Role Fit Index</p>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span>Technical:</span>
            <span className={getRFIScoreColor(fullReportData.technical_score)}>
              {formatRFIScore(fullReportData.technical_score)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Domain:</span>
            <span className={getRFIScoreColor(fullReportData.domain_score)}>
              {formatRFIScore(fullReportData.domain_score)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Career:</span>
            <span className={getRFIScoreColor(fullReportData.career_score)}>
              {formatRFIScore(fullReportData.career_score)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Cultural:</span>
            <span className={getRFIScoreColor(fullReportData.cultural_score)}>
              {formatRFIScore(fullReportData.cultural_score)}
            </span>
          </div>
        </div>

        {/* Immediate Fix */}
        {fullReportData.immediate_fix && (
          <div>
            <h5 className="font-medium text-sm text-orange-700 mb-1">Immediate Fix</h5>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {fullReportData.immediate_fix}
            </p>
          </div>
        )}


        {/* View Full Report Button */}
        <div className="pt-3 border-t">
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
      </div>
    </RainbowGlowWrapper>
  );
}