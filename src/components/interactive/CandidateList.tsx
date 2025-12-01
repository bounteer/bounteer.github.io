"use client";

import { useState, useEffect } from "react";
import { GlowCard } from "./GlowCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Candidate {
  id: string;
  name: string;
  title: string;
  experience: string;
  ragScore: number;
  skills: string[];
  company?: string;
  pros?: string[];
  cons?: string[];
}

interface CandidateSkill {
  name: string;
  color: 'blue' | 'purple' | 'green' | 'yellow' | 'red' | 'indigo' | 'pink' | 'gray';
}

interface CandidateListProps {
  candidates: Candidate[];
  searchComponent?: React.ReactNode;
  isSearching?: boolean;
  debugInfo?: {
    requestId?: string;
    requestStatus?: string;
  };
}

export default function CandidateList({ candidates, searchComponent, isSearching = false, debugInfo }: CandidateListProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Debug logging
  console.log("CandidateList - candidates prop:", candidates);
  console.log("CandidateList - candidates length:", candidates?.length || 0);
  console.log("CandidateList - isSearching:", isSearching);

  // Sort candidates by RAG score in descending order (highest first)
  const sortedCandidates = [...candidates].sort((a, b) => b.ragScore - a.ragScore);

  // Auto-select first candidate when candidates change
  useEffect(() => {
    if (sortedCandidates.length > 0 && !selectedCandidate) {
      setSelectedCandidate(sortedCandidates[0]);
    }
  }, [sortedCandidates, selectedCandidate]);

  const getSkillColorClasses = (color: CandidateSkill['color']) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-700',
      purple: 'bg-purple-100 text-purple-700',
      green: 'bg-green-100 text-green-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      red: 'bg-red-100 text-red-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      pink: 'bg-pink-100 text-pink-700',
      gray: 'bg-gray-100 text-gray-700'
    };
    return colorMap[color];
  };

  const getRagScoreColor = (score: number) => {
    if (score >= 85) return { text: 'text-green-600', bg: 'bg-green-500' };
    if (score >= 75) return { text: 'text-yellow-600', bg: 'bg-yellow-500' };
    if (score >= 60) return { text: 'text-orange-600', bg: 'bg-orange-500' };
    return { text: 'text-red-600', bg: 'bg-red-500' };
  };

  const renderCandidateListItem = (candidate: Candidate) => {
    const scoreColors = getRagScoreColor(candidate.ragScore);
    const isSelected = selectedCandidate?.id === candidate.id;

    return (
      <div
        key={candidate.id}
        onClick={() => setSelectedCandidate(candidate)}
        className={`p-3 border rounded-lg cursor-pointer transition-all ${isSelected
          ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium text-sm truncate ${isSelected ? 'text-primary-900' : 'text-gray-900'
              }`}>
              {candidate.name}
            </h3>
            <p className={`text-xs truncate ${isSelected ? 'text-primary-700' : 'text-gray-600'
              }`}>
              {candidate.title}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`text-xs font-bold ${scoreColors.text}`}>
              {candidate.ragScore}
            </div>
            <div className={`w-2 h-6 ${scoreColors.bg} rounded-full`}></div>
          </div>
        </div>
      </div>
    );
  };

  const renderCandidateDetail = () => {
    if (!selectedCandidate) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-500">
          <div className="text-center">
            <div className="mb-3">
              <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">Select a candidate to view details</p>
          </div>
        </div>
      );
    }

    const scoreColors = getRagScoreColor(selectedCandidate.ragScore);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="pb-3 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 mb-1">{selectedCandidate.name}</h3>
              <p className="text-sm text-gray-600">{selectedCandidate.title}</p>
              {selectedCandidate.company && (
                <p className="text-sm text-gray-500 mt-1">{selectedCandidate.company}</p>
              )}
              <p className="text-sm text-gray-500">{selectedCandidate.experience}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">RAG Score</div>
              <div className={`text-xl font-bold ${scoreColors.text}`}>
                {selectedCandidate.ragScore}
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Skills</h4>
          <div className="flex flex-wrap gap-2">
            {selectedCandidate.skills.map((skill, index) => {
              const skillColor = index % 2 === 0 ? 'blue' : index % 3 === 0 ? 'purple' : 'green';
              const colorClasses = getSkillColorClasses(skillColor);
              return (
                <span key={skill} className={`px-3 py-1 ${colorClasses} text-sm rounded-full`}>
                  {skill}
                </span>
              );
            })}
          </div>
        </div>

        {/* Pros and Cons */}
        {(selectedCandidate.pros && selectedCandidate.pros.length > 0) ||
          (selectedCandidate.cons && selectedCandidate.cons.length > 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pros */}
            {selectedCandidate.pros && selectedCandidate.pros.length > 0 && (
              <div>
                  <h4 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Strengths
                  </h4>
                <ul className="space-y-2">
                  {selectedCandidate.pros.map((pro, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-500 mt-1 text-xs">●</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cons */}
            {selectedCandidate.cons && selectedCandidate.cons.length > 0 && (
              <div>
                  <h4 className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Areas of Concern
                  </h4>
                <ul className="space-y-2">
                  {selectedCandidate.cons.map((con, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-red-500 mt-1 text-xs">●</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="text-center py-12 text-gray-500">
      <div className="mb-3">
        <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <p className="text-lg font-medium text-gray-600 mb-1">No candidates found</p>
      <p className="text-sm text-gray-500">
        {searchComponent ? "Click 'Search Candidate (Current JD)' above to find potential matches." : "Search for candidates to see potential matches here."}
      </p>
    </div>
  );

  return (
    <GlowCard
      glowState={isSearching ? "processing" : "idle"}
      color="#ff6b35"
      className="w-full shadow-lg overflow-hidden rounded-3xl"
      padding={false}
    >
      <div className="bg-white rounded-3xl border-0 shadow-sm">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Potential Candidates ({sortedCandidates.length})
            </h2>
            {searchComponent && (
              <div className="flex items-center">
                {searchComponent}
              </div>
            )}
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
            {/* Left panel - Candidate list */}
            <div className="lg:col-span-1">
              {sortedCandidates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="mb-3">
                    <svg className="w-10 h-10 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 font-medium mb-1">No candidates</p>
                  <p className="text-xs text-gray-500">
                    {searchComponent ? "Click 'Search Candidate' to find matches" : "Search for candidates to see them here"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {sortedCandidates.map(renderCandidateListItem)}
                </div>
              )}
            </div>

            {/* Right panel - Candidate details */}
            <div className="lg:col-span-2">
              <Card className="h-full max-h-[700px]">
                <CardContent className="pt-0 max-h-[630px] overflow-y-auto">
                  {renderCandidateDetail()}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Debug Info Section */}
        {debugInfo && (debugInfo.requestId || debugInfo.requestStatus) && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-600">
              <h4 className="font-semibold mb-2">Debug Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {debugInfo.requestId && (
                  <div>
                    <span className="font-medium">Request ID:</span>
                    <span className="ml-1 font-mono text-gray-800">{debugInfo.requestId}</span>
                  </div>
                )}
                {debugInfo.requestStatus && (
                  <div>
                    <span className="font-medium">Status:</span>
                    <span className={`ml-1 px-2 py-1 rounded text-xs font-medium ${debugInfo.requestStatus === 'listed' ? 'bg-green-100 text-green-700' :
                        debugInfo.requestStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                      }`}>
                      {debugInfo.requestStatus}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </GlowCard>
  );
}