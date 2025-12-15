"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { GlowCard } from "./GlowCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDownIcon, SettingsIcon, ChevronUpIcon } from "lucide-react";
import { getUserSpaces, getSetting, setSetting, getUserProfile, type Space } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

interface Candidate {
  profile_id: number;
  candidate_name: string;
  rag_match_score: number;
  source: string;
  source_item_id: number;
  pros: string[];
  cons: string[];
  // Optional backward compatibility fields
  id?: string;
  name?: string;
  title?: string;
  experience?: string;
  ragScore?: number;
  skills?: string[];
  company?: string;
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
  searchRound?: number; // For tracking re-ranking rounds
  selectedSpaceIds?: number[];
  onSpaceChange?: (spaceIds: number[]) => void;
}

export default function CandidateList({ candidates, searchComponent, isSearching = false, debugInfo, searchRound, selectedSpaceIds = [], onSpaceChange }: CandidateListProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isReranking, setIsReranking] = useState(false);
  const previousCandidatesRef = useRef<Candidate[]>([]);
  const rankingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Space management
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);

  // Settings collapse state
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  // Custom prompt from settings
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [customPromptLoading, setCustomPromptLoading] = useState(false);
  const [customPromptError, setCustomPromptError] = useState<string | null>(null);
  const [promptScope, setPromptScope] = useState<'global' | 'user' | null>(null); // Track which scope was found
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Helper function to get candidate score (backward compatibility)
  const getCandidateScore = (candidate: Candidate): number => {
    return candidate.rag_match_score ?? candidate.ragScore ?? 0;
  };

  // Helper function to get candidate name (backward compatibility)
  const getCandidateName = (candidate: Candidate): string => {
    return candidate.candidate_name ?? candidate.name ?? 'Unknown';
  };

  // Helper function to get candidate ID (using profile_id as primary)
  const getCandidateId = (candidate: Candidate): string => {
    return candidate.profile_id?.toString() ?? candidate.id ?? '0';
  };

  /**
   * Fetch the custom candidate search prompt from settings
   * Priority: user scope -> global scope -> default
   */
  const fetchCustomPrompt = async () => {
    try {
      setCustomPromptLoading(true);
      setCustomPromptError(null);
      setPromptScope(null);
      
      // Get current user for scope checking
      const user = await getUserProfile(EXTERNAL.directus_url);
      
      let foundPrompt = null;
      let foundScope: 'global' | 'user' | null = null;
      
      // First, try to get user-specific setting
      if (user?.id) {
        console.log("Checking for user-specific prompt for user:", user.id);
        // For user scope, pass scope as "user" and scope_id as the user's UUID
        const userResult = await getSetting("candidate_search_prompt", EXTERNAL.directus_url, "user", user.id);
        if (userResult.success && userResult.value) {
          foundPrompt = userResult.value;
          foundScope = 'user';
          console.log("Found user-specific prompt:", foundPrompt);
        }
      }
      
      // If no user-specific setting, try global setting
      if (!foundPrompt) {
        console.log("Checking for global prompt");
        const globalResult = await getSetting("candidate_search_prompt", EXTERNAL.directus_url, "global");
        if (globalResult.success && globalResult.value) {
          foundPrompt = globalResult.value;
          foundScope = 'global';
          console.log("Found global prompt:", foundPrompt);
        }
      }
      
      if (foundPrompt) {
        setCustomPrompt(foundPrompt);
        setPromptScope(foundScope);
        setEditPrompt(foundPrompt); // Initialize edit state with current value
        console.log(`Loaded ${foundScope} candidate search prompt:`, foundPrompt);
      } else {
        console.log("No custom candidate search prompt found, using default");
        setCustomPrompt(null);
        setPromptScope(null);
        setEditPrompt(''); // Initialize with empty for new creation
      }
    } catch (error) {
      console.error("Error fetching custom prompt:", error);
      setCustomPrompt(null);
      setPromptScope(null);
      setCustomPromptError("Failed to fetch custom prompt");
    } finally {
      setCustomPromptLoading(false);
    }
  };

  /**
   * Save the custom prompt (always saves as user scope)
   */
  const saveCustomPrompt = async () => {
    try {
      setIsSaving(true);
      
      const user = await getUserProfile(EXTERNAL.directus_url);
      if (!user?.id) {
        setCustomPromptError("User not authenticated");
        return;
      }

      const result = await setSetting(
        "candidate_search_prompt",
        editPrompt.trim(),
        EXTERNAL.directus_url,
        "user",
        user.id, // Pass user ID as scope_id (now supports string type)
        "string"
      );

      if (result.success) {
        setCustomPrompt(editPrompt.trim());
        setPromptScope('user');
        setIsEditMode(false);
        setCustomPromptError(null);
        console.log("Successfully saved user-specific prompt");
      } else {
        setCustomPromptError(result.error || "Failed to save prompt");
      }
    } catch (error) {
      console.error("Error saving prompt:", error);
      setCustomPromptError("Failed to save prompt");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Cancel edit mode and revert changes
   */
  const cancelEdit = () => {
    setEditPrompt(customPrompt || '');
    setIsEditMode(false);
  };

  /**
   * Start edit mode
   */
  const startEdit = () => {
    setEditPrompt(customPrompt || '');
    setIsEditMode(true);
  };

  // Sort candidates by RAG score in descending order (highest first)
  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => getCandidateScore(b) - getCandidateScore(a));
  }, [candidates]);

  // Detect ranking changes and trigger re-ranking indicator
  useEffect(() => {
    if (previousCandidatesRef.current.length > 0 && sortedCandidates.length > 0) {
      const prevOrder = previousCandidatesRef.current.map(c => getCandidateId(c));
      const currentOrder = sortedCandidates.map(c => getCandidateId(c));
      
      // Check if order changed
      const orderChanged = prevOrder.some((id, index) => id !== currentOrder[index]);
      
      if (orderChanged) {
        setIsReranking(true);
        
        // Clear existing timeout
        if (rankingTimeoutRef.current) {
          clearTimeout(rankingTimeoutRef.current);
        }
        
        // Hide re-ranking indicator after animation completes
        rankingTimeoutRef.current = setTimeout(() => {
          setIsReranking(false);
        }, 2500);
      }
    }
    
    previousCandidatesRef.current = sortedCandidates;
  }, [sortedCandidates]);


  // Auto-select first candidate when candidates change
  useEffect(() => {
    if (sortedCandidates.length > 0 && !selectedCandidate) {
      setSelectedCandidate(sortedCandidates[0]);
    }
  }, [sortedCandidates, selectedCandidate]);

  // Fetch user spaces when component mounts
  useEffect(() => {
    if (onSpaceChange) {
      setIsLoadingSpaces(true);
      getUserSpaces(EXTERNAL.directus_url)
        .then((result) => {
          if (result.success && result.spaces) {
            setSpaces(result.spaces);
          }
        })
        .catch((error) => {
          console.error("Error fetching spaces:", error);
        })
        .finally(() => {
          setIsLoadingSpaces(false);
        });
    }
  }, [onSpaceChange]);

  // Initialize with all spaces selected when spaces are loaded and none are selected
  useEffect(() => {
    if (spaces.length > 0 && selectedSpaceIds.length === 0 && onSpaceChange) {
      onSpaceChange(spaces.map(s => s.id));
    }
  }, [spaces, selectedSpaceIds.length, onSpaceChange]);

  // Fetch custom prompt when settings are first expanded
  useEffect(() => {
    if (isSettingsExpanded && !customPrompt && !customPromptLoading && !customPromptError) {
      fetchCustomPrompt();
    }
  }, [isSettingsExpanded, customPrompt, customPromptLoading, customPromptError]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (rankingTimeoutRef.current) {
        clearTimeout(rankingTimeoutRef.current);
      }
    };
  }, []);

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

  const renderCandidateListItem = (candidate: Candidate, index: number) => {
    const score = getCandidateScore(candidate);
    const name = getCandidateName(candidate);
    const candidateId = getCandidateId(candidate);
    const scoreColors = getRagScoreColor(score);
    const isSelected = selectedCandidate && getCandidateId(selectedCandidate) === candidateId;

    return (
      <motion.div
        key={candidateId}
        layout="position"
        initial={{ opacity: 0, y: 30, scale: 0.9, rotateX: -10 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1,
          rotateX: 0,
          transition: {
            type: "spring",
            stiffness: 200,
            damping: 25,
            delay: index * 0.05 // More staggered animation
          }
        }}
        exit={{ 
          opacity: 0, 
          y: -30, 
          scale: 0.9,
          rotateX: 10,
          transition: {
            duration: 0.4,
            ease: "easeInOut"
          }
        }}
        whileHover={{ 
          scale: 1.03,
          y: -2,
          transition: { duration: 0.2, ease: "easeOut" }
        }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setSelectedCandidate(candidate)}
        className={`p-3 mx-1 my-1 border rounded-lg cursor-pointer transition-colors duration-300 ${isSelected
          ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        style={{
          boxShadow: isReranking ? '0 4px 16px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)' : 'none',
          transformOrigin: 'center',
        }}
        transition={{
          layout: {
            type: "spring",
            stiffness: 150,
            damping: 20,
            duration: 0.8
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium text-sm truncate ${isSelected ? 'text-primary-900' : 'text-gray-900'
              }`}>
              {name}
            </h3>
            <p className={`text-xs truncate ${isSelected ? 'text-primary-700' : 'text-gray-600'
              }`}>
              {candidate.title || candidate.source || 'Candidate'}
            </p>
            {/* Show rank indicator during reordering */}
            {isReranking && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-gray-400 mt-1"
              >
                #{index + 1}
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <motion.div 
              className={`text-xs font-bold ${scoreColors.text} px-2 py-1 rounded-full`}
              animate={{ 
                scale: isReranking ? [1, 1.2, 1.1, 1] : 1,
                backgroundColor: isReranking ? ['rgba(0,0,0,0)', 'rgba(59,130,246,0.1)', 'rgba(0,0,0,0)'] : 'rgba(0,0,0,0)'
              }}
              transition={{ 
                duration: 0.8,
                ease: "easeInOut",
                repeat: isReranking ? 2 : 0
              }}
            >
              {Math.round(score)}
            </motion.div>
            <div className={`w-2 h-6 ${scoreColors.bg} rounded-full`}></div>
          </div>
        </div>
      </motion.div>
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

    const score = getCandidateScore(selectedCandidate);
    const name = getCandidateName(selectedCandidate);
    const scoreColors = getRagScoreColor(score);

    return (
      <motion.div 
        key={getCandidateId(selectedCandidate)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="pb-3 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <a
                href={`/role-fit-index/candidate-profile?id=${selectedCandidate.profile_id}`}
                className="text-base font-semibold text-primary-600 hover:text-primary-800 underline mb-1 inline-block transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                {name}
              </a>
              <p className="text-sm text-gray-600">{selectedCandidate.title || selectedCandidate.source || 'Candidate'}</p>
              {selectedCandidate.company && (
                <p className="text-sm text-gray-500 mt-1">{selectedCandidate.company}</p>
              )}
              <p className="text-sm text-gray-500">{selectedCandidate.experience || `Source: ${selectedCandidate.source}`}</p>
              {selectedCandidate.source_item_id && (
                <p className="text-xs text-gray-400 mt-1">ID: {selectedCandidate.source_item_id}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">RAG Score</div>
              <div className={`text-xl font-bold ${scoreColors.text}`}>
                {Math.round(score)}
              </div>
            </div>
          </div>
        </div>

        {/* Skills - only show if available */}
        {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
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
        )}

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
      </motion.div>
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
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Potential Candidates ({sortedCandidates.length})
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                className="text-gray-500 hover:text-gray-700"
              >
                <SettingsIcon className="w-4 h-4 mr-1" />
                Settings
                {isSettingsExpanded ? (
                  <ChevronUpIcon className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 ml-1" />
                )}
              </Button>
              {/* Re-ranking indicator */}
              <AnimatePresence>
                {isReranking && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: -10 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1, 
                      y: 0,
                      boxShadow: [
                        '0 0 0 rgba(59,130,246,0)',
                        '0 0 20px rgba(59,130,246,0.3)', 
                        '0 0 0 rgba(59,130,246,0)'
                      ]
                    }}
                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                    transition={{ 
                      duration: 0.4,
                      boxShadow: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }
                    }}
                    className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 px-4 py-2 rounded-full font-medium"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4"
                    >
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </motion.div>
                    <motion.span
                      animate={{ opacity: [1, 0.7, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      Re-ranking candidates
                    </motion.span>
                    {searchRound && (
                      <motion.span 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.8 }}
                        className="text-xs bg-blue-100 px-2 py-0.5 rounded-full"
                      >
                        Round #{searchRound}
                      </motion.span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-4">
              {/* Space Selector */}
              {onSpaceChange && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Spaces:</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-60 h-8 text-sm bg-white border-gray-300 focus-visible:ring-primary-500 justify-between"
                        disabled={isLoadingSpaces}
                      >
                        <span className="truncate">
                          {isLoadingSpaces 
                            ? "Loading..." 
                            : selectedSpaceIds.length === 0 || selectedSpaceIds.length === spaces.length
                              ? "All Spaces"
                              : selectedSpaceIds.length === 1
                                ? spaces.find(s => s.id === selectedSpaceIds[0])?.name || "1 space selected"
                                : `${selectedSpaceIds.length} spaces selected`
                          }
                        </span>
                        <ChevronDownIcon className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-60 bg-white border border-gray-200 shadow-lg">
                      <DropdownMenuCheckboxItem
                        checked={selectedSpaceIds.length === 0 || selectedSpaceIds.length === spaces.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            // Select all spaces
                            onSpaceChange(spaces.map(s => s.id));
                          } else {
                            // Cannot deselect all - enforce at least one space selected
                            // Keep the first space selected
                            if (spaces.length > 0) {
                              onSpaceChange([spaces[0].id]);
                            }
                          }
                        }}
                        className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100 font-medium"
                      >
                        All Spaces
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {spaces.map((space) => (
                        <DropdownMenuCheckboxItem
                          key={space.id}
                          checked={selectedSpaceIds.length === 0 || selectedSpaceIds.includes(space.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              // Add space to selection
                              if (selectedSpaceIds.length === 0) {
                                // If no spaces selected (empty array means "all"), explicitly select this one
                                onSpaceChange([space.id]);
                              } else {
                                // Add to existing selection
                                onSpaceChange([...selectedSpaceIds, space.id]);
                              }
                            } else {
                              // Remove space from selection, but enforce at least one remains
                              const newSelection = selectedSpaceIds.filter(id => id !== space.id);
                              if (newSelection.length === 0) {
                                // Don't allow empty selection - keep at least one other space
                                const otherSpaces = spaces.filter(s => s.id !== space.id);
                                if (otherSpaces.length > 0) {
                                  onSpaceChange([otherSpaces[0].id]);
                                } else {
                                  // Only one space exists, can't deselect it
                                  return;
                                }
                              } else {
                                onSpaceChange(newSelection);
                              }
                            }
                          }}
                          className="text-gray-900 hover:bg-gray-100 focus:bg-gray-100"
                        >
                          {`${space.name}${space.candidate_profile_count !== undefined ? ` (${space.candidate_profile_count} candidates)` : ''}`}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {/* Search Component */}
              {searchComponent && (
                <div className="flex items-center">
                  {searchComponent}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Settings Section */}
        <AnimatePresence>
          {isSettingsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="border-b border-gray-200 overflow-hidden"
            >
              <div className="px-6 py-4 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Search Configuration</h3>
                
                {/* Custom Prompt Configuration */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Custom Search Prompt</h4>
                    {customPromptLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                        Loading custom search prompt...
                      </div>
                    ) : customPromptError ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0">
                            <svg className="w-4 h-4 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-yellow-800">
                              Using default search prompt
                            </div>
                            <div className="text-xs text-yellow-600 mt-1">
                              {customPromptError}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : customPrompt || isEditMode ? (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0">
                            <svg className="w-4 h-4 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-medium text-blue-800">
                                {customPrompt ? 'Custom prompt active' : 'Create custom prompt'}
                              </div>
                              {!isEditMode && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={startEdit}
                                  className="h-6 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-100"
                                >
                                  Edit
                                </Button>
                              )}
                            </div>
                            <div className="text-xs text-blue-600 mb-2">
                              Scope: <span className="font-medium">{promptScope || 'user'}</span> | 
                              Key: <code className="bg-blue-100 text-blue-800 px-1 rounded text-xs">candidate_search_prompt</code>
                            </div>
                            
                            {isEditMode ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editPrompt}
                                  onChange={(e) => setEditPrompt(e.target.value)}
                                  placeholder="Enter your custom candidate search prompt..."
                                  className="text-xs font-mono resize-none"
                                  rows={4}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={saveCustomPrompt}
                                    disabled={isSaving || editPrompt.trim() === (customPrompt || '')}
                                    className="h-6 px-3 text-xs"
                                  >
                                    {isSaving ? 'Saving...' : 'Save'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    disabled={isSaving}
                                    className="h-6 px-3 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : customPrompt && (
                              <div className="bg-white border border-blue-200 rounded p-2 max-h-24 overflow-y-auto">
                                <div className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words">
                                  {customPrompt}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-100 border border-gray-300 rounded p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-medium text-gray-700">
                                Using default search prompt
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={startEdit}
                                className="h-6 px-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200"
                              >
                                Create Custom
                              </Button>
                            </div>
                            <div className="text-xs text-gray-600 mb-2">
                              No custom prompt configured. The system uses default search behavior.
                            </div>
                            <div className="text-xs text-gray-500">
                              Key: <code className="bg-white border border-gray-300 rounded px-1 text-gray-700 font-mono">candidate_search_prompt</code>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[900px]">
            {/* Left panel - Candidate list */}
            <div className="lg:col-span-1 overflow-hidden">
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
                <LayoutGroup>
                  <div className="space-y-3 max-h-[900px] overflow-y-auto pr-3 pl-2 py-2">
                    <AnimatePresence mode="popLayout">
                      {sortedCandidates.map((candidate, index) => 
                        renderCandidateListItem(candidate, index)
                      )}
                    </AnimatePresence>
                  </div>
                </LayoutGroup>
              )}
            </div>

            {/* Right panel - Candidate details */}
            <div className="lg:col-span-2">
              <Card className="h-full max-h-[1100px]">
                <CardContent className="pt-0 max-h-[1030px] overflow-y-auto">
                  {renderCandidateDetail()}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Debug Info Section - Always show when debugInfo prop is provided */}
        {debugInfo && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-600">
              <h4 className="font-semibold mb-2">Debug Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">Request ID:</span>
                  <span className="ml-1 font-mono text-gray-800">{debugInfo.requestId || 'Not set'}</span>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-1 px-2 py-1 rounded text-xs font-medium ${debugInfo.requestStatus === 'listed' ? 'bg-green-100 text-green-700' :
                      debugInfo.requestStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      debugInfo.requestStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                    }`}>
                    {debugInfo.requestStatus || 'Not set'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GlowCard>
  );
}