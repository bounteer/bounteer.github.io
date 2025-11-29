"use client";

import { useState, useEffect } from "react";
import { GlowCard } from "./GlowCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Job } from "@/types/models";

interface JobListProps {
  jobs: Job[];
  searchComponent?: React.ReactNode;
  isSearching?: boolean;
}

export default function JobList({ jobs, searchComponent, isSearching = false }: JobListProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Sort jobs by Job Fit Score in descending order (highest first)
  const sortedJobs = [...jobs].sort((a, b) => b.jobFitScore - a.jobFitScore);

  // Auto-select first job when jobs change
  useEffect(() => {
    if (sortedJobs.length > 0 && !selectedJob) {
      setSelectedJob(sortedJobs[0]);
    }
  }, [sortedJobs, selectedJob]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return { text: 'text-green-600', bg: 'bg-green-500' };
    if (score >= 75) return { text: 'text-yellow-600', bg: 'bg-yellow-500' };
    if (score >= 60) return { text: 'text-orange-600', bg: 'bg-orange-500' };
    return { text: 'text-red-600', bg: 'bg-red-500' };
  };

  const getSkillColorClasses = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700',
      'bg-green-100 text-green-700',
      'bg-yellow-100 text-yellow-700',
      'bg-indigo-100 text-indigo-700',
      'bg-pink-100 text-pink-700'
    ];
    return colors[index % colors.length];
  };

  const renderJobListItem = (job: Job) => {
    const scoreColors = getScoreColor(job.jobFitScore);
    const isSelected = selectedJob?.id === job.id;

    return (
      <div
        key={job.id}
        onClick={() => setSelectedJob(job)}
        className={`p-3 border rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium text-sm truncate ${
              isSelected ? 'text-primary-900' : 'text-gray-900'
            }`}>
              {job.title}
            </h3>
            <p className={`text-xs truncate ${
              isSelected ? 'text-primary-700' : 'text-gray-600'
            }`}>
              {job.company}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`text-xs font-bold ${scoreColors.text}`}>
              {job.jobFitScore}
            </div>
            <div className={`w-2 h-6 ${scoreColors.bg} rounded-full`}></div>
          </div>
        </div>
      </div>
    );
  };

  const renderJobDetail = () => {
    if (!selectedJob) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-500">
          <div className="text-center">
            <div className="mb-3">
              <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">Select a job to view details</p>
          </div>
        </div>
      );
    }

    const scoreColors = getScoreColor(selectedJob.jobFitScore);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="pb-3 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 mb-1">{selectedJob.title}</h3>
              <p className="text-sm text-gray-600">{selectedJob.company}</p>
              <p className="text-sm text-gray-500 mt-1">{selectedJob.location}</p>
              {selectedJob.salary_range && (
                <p className="text-sm text-gray-500">{selectedJob.salary_range}</p>
              )}
              {selectedJob.experience && (
                <p className="text-sm text-gray-500">{selectedJob.experience}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Job Fit Score</div>
              <div className={`text-xl font-bold ${scoreColors.text}`}>
                {selectedJob.jobFitScore}
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        {selectedJob.skills && selectedJob.skills.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Required Skills</h4>
            <div className="flex flex-wrap gap-2">
              {selectedJob.skills.map((skill, index) => (
                <span key={skill} className={`px-3 py-1 ${getSkillColorClasses(index)} text-sm rounded-full`}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pros */}
        {selectedJob.pros && selectedJob.pros.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Why You're a Great Fit</h4>
            <div className="space-y-2">
              {selectedJob.pros.map((pro, index) => (
                <div key={index} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm text-gray-700">{pro}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cons */}
        {selectedJob.cons && selectedJob.cons.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Areas to Consider</h4>
            <div className="space-y-2">
              {selectedJob.cons.map((con, index) => (
                <div key={index} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-gray-700">{con}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <GlowCard>
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              {isSearching ? "Searching for Jobs..." : jobs.length > 0 ? `Matching Jobs (${jobs.length})` : "No Jobs Yet"}
            </CardTitle>
            {searchComponent}
          </div>
        </CardHeader>
        <CardContent>
          {isSearching ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <svg className="w-10 h-10 mx-auto mb-3 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-gray-500">Finding matching jobs...</p>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">No job matches yet</p>
                <p className="text-xs text-gray-400 mt-1">Start by enriching your profile and clicking Search Jobs</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left: Job List */}
              <div className="space-y-2 md:col-span-1 max-h-96 overflow-y-auto pr-2">
                {sortedJobs.map(renderJobListItem)}
              </div>

              {/* Right: Job Details */}
              <div className="md:col-span-2 border-l pl-4">
                {renderJobDetail()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </GlowCard>
  );
}
