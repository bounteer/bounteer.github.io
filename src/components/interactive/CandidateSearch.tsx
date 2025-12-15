"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { createOrbitCandidateSearchRequest, getUserProfile, getSetting } from "@/lib/utils";
import { EXTERNAL } from "@/constant";
import type { JobDescriptionFormData } from "@/types/models";

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


interface SearchRequest {
  job_description_enrichment_session: string; // orbit_job_description_enrichment_session ID
  jobDescription: JobDescriptionFormData;
  spaceIds?: number[]; // Selected space IDs
}

interface CandidateSearchProps {
  request: SearchRequest | null;
  onResults: (candidates: Candidate[]) => void;
  onError: (error: string) => void;
  onSearchingChange?: (isSearching: boolean) => void;
  onRequestCreated?: (requestId: string) => void;
  onStatusChange?: (status: string) => void;
}

export default function CandidateSearch({ request, onResults, onError, onSearchingChange, onRequestCreated, onStatusChange }: CandidateSearchProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchRequestId, setSearchRequestId] = useState<string>("");
  const [searchRequestStatus, setSearchRequestStatus] = useState<string>("");
  const [candidatesListed, setCandidatesListed] = useState(false);

  // Polling mode state - enabled by default
  const [isPollingMode, setIsPollingMode] = useState(true);
  const lastSearchedJDHash = useRef<number>(0);
  const [hasPendingSearch, setHasPendingSearch] = useState(false); // Track if there's a pending search after JD change

  // Custom prompt from settings
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [customPromptLoading, setCustomPromptLoading] = useState(true);
  const [customPromptError, setCustomPromptError] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const jdPollingRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch the custom candidate search prompt from settings
   */
  const fetchCustomPrompt = async () => {
    try {
      setCustomPromptLoading(true);
      setCustomPromptError(null);
      
      const result = await getSetting("candidate_search_prompt", EXTERNAL.directus_url);
      if (result.success && result.value) {
        setCustomPrompt(result.value);
        console.log("Loaded custom candidate search prompt:", result.value);
      } else {
        console.log("No custom candidate search prompt found, using default");
        setCustomPrompt(null);
        if (!result.success && result.error) {
          setCustomPromptError(result.error);
        }
      }
    } catch (error) {
      console.error("Error fetching custom prompt:", error);
      setCustomPrompt(null);
      setCustomPromptError("Failed to fetch custom prompt");
    } finally {
      setCustomPromptLoading(false);
    }
  };

  /**
   * Simple hash function for JD comparison
   */
  const hashJD = (jd: any): number => {
    const str = JSON.stringify(jd);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  };

  /**
   * Check search request status via polling
   */
  const checkSearchRequestStatus = async (requestId: string) => {
    console.log("=== CHECKING SEARCH REQUEST STATUS ===");
    console.log("requestId:", requestId);

    try {
      await getUserProfile(EXTERNAL.directus_url);
      const statusUrl = `${EXTERNAL.directus_url}/items/orbit_candidate_search_request/${requestId}?fields=id,status`;
      console.log("Status check URL:", statusUrl);

      const response = await fetch(statusUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        }
      });

      console.log("Status check response status:", response.status, response.statusText);

      if (!response.ok) {
        console.error('Failed to check search request status:', response.status, response.statusText);
        const responseText = await response.text();
        console.error('Response body:', responseText);
        return;
      }

      const result = await response.json();
      console.log("Status check API response:", result);
      const searchRequest = result.data;

      console.log("Search request object:", searchRequest);
      console.log("Search request keys:", Object.keys(searchRequest || {}));

      if (searchRequest) {
        console.log("Search request status field:", searchRequest.status);
        console.log("Search request id:", searchRequest.id);
        console.log("All search request fields:", searchRequest);
      }

      if (searchRequest && searchRequest.status) {
        console.log("🟡 CURRENT STATUS:", searchRequest.status);
        setSearchRequestStatus(searchRequest.status);
        onStatusChange?.(searchRequest.status);

        // Check if search is completed (any final status)
        const completedStatuses = ["listed", "completed", "finished", "done", "failed"];
        const isCompleted = completedStatuses.includes(searchRequest.status);

        if (isCompleted) {
          // Mark search as no longer processing
          setIsSearching(false);
          onSearchingChange?.(false);

          // If there's a pending search due to JD changes, trigger it
          if (hasPendingSearch && searchRequest.status === "listed") {
            console.log("🚀 Current search completed and JD has changed - triggering new search");
            setHasPendingSearch(false);
            // Small delay to avoid race conditions
            setTimeout(() => {
              handleSearchCandidate();
            }, 500);
          }
        }

        if (searchRequest.status === "listed") {
          console.log("✅ STATUS REACHED LISTED ===");
          console.log("Candidates listed! Status reached:", searchRequest.status);
          console.log("About to call fetchCandidateSearchResults with requestId:", requestId);
          console.log("🚨 SETTING candidatesListed to TRUE - this will STOP polling");
          setCandidatesListed(true);
          setIsSearching(false);
          onSearchingChange?.(false);

          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          // Fetch the candidate search results
          fetchCandidateSearchResults(requestId);
          console.log("fetchCandidateSearchResults called");
        } else {
          console.log("⏳ Status is not 'listed' yet, current status:", searchRequest.status);
          
          // Check if it's a different final status that we should handle
          if (searchRequest.status === "completed" || searchRequest.status === "finished" || searchRequest.status === "done") {
            console.log("🔍 Found alternative final status, trying to fetch results anyway:", searchRequest.status);
            console.log("🚨 SETTING candidatesListed to TRUE for alternative status - this will STOP polling");
            setCandidatesListed(true);
            setIsSearching(false);
            onSearchingChange?.(false);
            fetchCandidateSearchResults(requestId);
          }
        }
      } else {
        console.log("❌ No status field found in search request");
      }
    } catch (error) {
      console.error('=== ERROR IN STATUS CHECK ===');
      console.error('Error checking search request status:', error);
      console.error('Error details:', error);
    }
  };

  /**
   * Start polling for search request status
   */
  const startPolling = (requestId: string) => {
    console.log("=== STARTING POLLING ===");
    console.log("Starting polling for search request:", requestId);
    console.log("candidatesListed state:", candidatesListed);

    // Clear any existing polling
    if (pollingRef.current) {
      console.log("Clearing existing polling interval");
      clearInterval(pollingRef.current);
    }

    // Initial check
    console.log("Performing initial status check");
    checkSearchRequestStatus(requestId);

    // Set up polling every 3 seconds
    pollingRef.current = setInterval(() => {
      const now = new Date().toISOString();
      console.log(`🔄 [${now}] POLLING INTERVAL TICK - candidatesListed:`, candidatesListed);
      
      if (!candidatesListed) {
        console.log("📡 Candidates not listed yet, checking status...");
        checkSearchRequestStatus(requestId);
      } else {
        console.log("✅ Candidates already listed, stopping polling");
        // Stop polling if candidates are already listed
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    }, 3000); // Changed to 3 seconds as you requested
    console.log("Polling interval set up with ID:", pollingRef.current);
  };

  /**
   * Fetch candidate search results from Directus
   */
  const fetchCandidateSearchResults = async (searchRequestId: string) => {
    console.log("=== FETCH CANDIDATE SEARCH RESULTS CALLED ===");
    console.log("searchRequestId parameter:", searchRequestId);

    try {
      console.log("Fetching candidate search results for request ID:", searchRequestId);

      await getUserProfile(EXTERNAL.directus_url);

      const fetchUrl = `${EXTERNAL.directus_url}/items/orbit_candidate_search_result?filter[request][_eq]=${searchRequestId}&fields=*,candidate_profile.id,candidate_profile.name,candidate_profile.job_title,candidate_profile.year_of_experience,candidate_profile.location,candidate_profile.skills,pros,cons`;

      console.log("=== EXACT URL THAT SHOULD WORK ===");
      console.log("Fetch URL:", fetchUrl);
      console.log("Expected working URL: https://directus.bounteer.com/items/orbit_candidate_search_result?filter[request][_eq]=93");
      console.log("URLs match?", fetchUrl.includes(`filter[request][_eq]=${searchRequestId}`));
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch candidate search results:', response.status, response.statusText);
        console.error('Response body:', await response.text());
        return;
      }

      const result = await response.json();
      const candidateResults = result.data;

      console.log("=== CANDIDATE SEARCH RESULTS DEBUG ===");
      console.log("Full API response:", result);
      console.log("Candidate results array:", candidateResults);
      console.log("Number of candidates found:", candidateResults?.length || 0);
      console.log("Type of candidateResults:", typeof candidateResults);
      console.log("Is candidateResults an array?", Array.isArray(candidateResults));

      // Additional debugging for why results might be empty
      if (!candidateResults || candidateResults.length === 0) {
        console.log("=== DEBUGGING EMPTY RESULTS ===");
        console.log("Response status was OK, but no results found");
        console.log("searchRequestId used in query:", searchRequestId);
        console.log("Type of searchRequestId:", typeof searchRequestId);
        console.log("Is searchRequestId truthy?", !!searchRequestId);

        // Test the URL manually without the fields parameter to see if that's the issue
        const simpleUrl = `${EXTERNAL.directus_url}/items/orbit_candidate_search_result?filter[request][_eq]=${searchRequestId}`;
        console.log("Trying simplified URL:", simpleUrl);

        const simpleResponse = await fetch(simpleUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EXTERNAL.directus_key}`
          }
        });

        if (simpleResponse.ok) {
          const simpleResult = await simpleResponse.json();
          console.log("Simplified URL response:", simpleResult);
        } else {
          console.log("Simplified URL failed:", simpleResponse.status, simpleResponse.statusText);
        }
      }

      if (candidateResults && candidateResults.length > 0) {
        const transformedCandidates: Candidate[] = candidateResults.map((result: any, index: number) => {
          const candidateProfile = result.candidate_profile;
          const name = candidateProfile?.name || `Candidate ${index + 1}`;

          // Parse skills from candidate profile
          let skills: string[] = [];
          if (candidateProfile?.skills) {
            try {
              skills = Array.isArray(candidateProfile.skills)
                ? candidateProfile.skills
                : JSON.parse(candidateProfile.skills);
            } catch (e) {
              console.warn('Failed to parse candidate skills:', e);
              skills = [];
            }
          }

          // Parse pros and cons
          let pros: string[] = [];
          let cons: string[] = [];
          
          if (result.pros) {
            try {
              pros = Array.isArray(result.pros) ? result.pros : JSON.parse(result.pros);
            } catch (e) {
              console.warn('Failed to parse candidate pros:', e);
              pros = [];
            }
          }
          
          if (result.cons) {
            try {
              cons = Array.isArray(result.cons) ? result.cons : JSON.parse(result.cons);
            } catch (e) {
              console.warn('Failed to parse candidate cons:', e);
              cons = [];
            }
          }

          return {
            id: candidateProfile?.id || result.id || `candidate_${index}`,
            name: name,
            title: candidateProfile?.job_title || "Unknown Title",
            experience: candidateProfile?.year_of_experience ? `${candidateProfile.year_of_experience} years experience` : "Experience not specified",
            ragScore: result.rag_score || 0,
            skills: skills,
            company: candidateProfile?.location || "Unknown Location",
            pros: pros,
            cons: cons
          };
        });

        console.log("Transformed candidates:", transformedCandidates);
        console.log("About to call onResults with candidates:", transformedCandidates);
        console.log("onResults function:", onResults);
        onResults(transformedCandidates);
        console.log("onResults called successfully");
      } else {
        console.log("No candidate search results found - empty or null array");
        console.log("candidateResults value:", candidateResults);
        console.log("About to call onResults with empty array");
        onResults([]);
        console.log("onResults called successfully with empty array");
      }
    } catch (error) {
      console.error('Error fetching candidate search results:', error);
      onError("Failed to fetch candidate results. Please try again.");
    }
  };

  /**
   * Handle search candidate request using provided request data
   */
  const handleSearchCandidate = async () => {
    if (!request?.job_description_enrichment_session) {
      onError("Missing job description enrichment session ID");
      return;
    }

    console.log("=== STARTING NEW SEARCH ===");
    console.log("Resetting search state for new search request");
    
    // Reset all search-related state
    setSearchRequestId("");
    setSearchRequestStatus("");
    setCandidatesListed(false);
    setIsSearching(true);
    onSearchingChange?.(true);
    onError("");
    
    // Reset parent component tracking
    onStatusChange?.("");
    onRequestCreated?.("");
    
    // Clear any existing polling
    if (pollingRef.current) {
      console.log("🛑 Clearing existing polling for new search");
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      const jobDescriptionSnapshot = {
        company_name: request.jobDescription.company_name,
        role_name: request.jobDescription.role_name,
        location: request.jobDescription.location,
        salary_range: request.jobDescription.salary_range,
        responsibility: request.jobDescription.responsibility,
        minimum_requirement: request.jobDescription.minimum_requirement,
        preferred_requirement: request.jobDescription.preferred_requirement,
        perk: request.jobDescription.perk,
        skill: request.jobDescription.skill,
        // Include the categorized skills for accurate search requests
        skill_core: request.jobDescription.skill_core,
        skill_plus: request.jobDescription.skill_plus,
        skill_bonus: request.jobDescription.skill_bonus
      };

      const result = await createOrbitCandidateSearchRequest(
        request.job_description_enrichment_session,
        jobDescriptionSnapshot,
        EXTERNAL.directus_url,
        request.spaceIds,
        customPrompt || undefined
      );

      if (!result.success) {
        onError(result.error || "Failed to create search request");
        setIsSearching(false);
        onSearchingChange?.(false);
        return;
      }

      console.log("=== SEARCH REQUEST CREATED ===");
      console.log("Orbit candidate search request created with ID:", result.id);
      console.log("Full result object:", result);

      if (result.id) {
        console.log("Setting searchRequestId to:", result.id);
        setSearchRequestId(result.id);
        console.log("searchRequestId state updated. Waiting for status to become 'listed'...");
        onRequestCreated?.(result.id);
        console.log("onRequestCreated callback called");

        // Save the JD hash after successful search creation
        const jdHash = hashJD(jobDescriptionSnapshot);
        lastSearchedJDHash.current = jdHash;
        console.log("💾 Saved JD hash for polling comparison:", jdHash);
      } else {
        console.error("No ID returned from search request creation");
      }

      onError("");

    } catch (error) {
      console.error("Error in handleSearchCandidate:", error);
      onError("An unexpected error occurred. Please try again.");
      setIsSearching(false);
      onSearchingChange?.(false);
    }
  };

  /**
   * Effect to start polling when searchRequestId is available
   */
  useEffect(() => {
    console.log("=== POLLING USEEFFECT TRIGGERED ===");
    console.log("searchRequestId:", searchRequestId);
    console.log("candidatesListed:", candidatesListed);
    console.log("Should start polling?", !!(searchRequestId && !candidatesListed));

    if (searchRequestId && !candidatesListed) {
      console.log("Conditions met, starting polling for search request:", searchRequestId);
      startPolling(searchRequestId);
    } else {
      console.log("Conditions not met for polling:");
      console.log("  - searchRequestId exists:", !!searchRequestId);
      console.log("  - candidatesListed is false:", !candidatesListed);
    }

    return () => {
      console.log("Polling useEffect cleanup");
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [searchRequestId, candidatesListed]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (jdPollingRef.current) {
        clearInterval(jdPollingRef.current);
        jdPollingRef.current = null;
      }
    };
  }, []);

  // Fetch custom prompt on component mount
  useEffect(() => {
    fetchCustomPrompt();
  }, []);

  /**
   * Poll for JD changes when polling mode is enabled
   * Only trigger search when JD has changed since last search
   * Implements smart queuing - if search is in progress, queue the next search
   */
  useEffect(() => {
    if (!isPollingMode || !request?.jobDescription) {
      // Clear polling when disabled or no request
      if (jdPollingRef.current) {
        console.log("🛑 Stopping JD polling - polling mode disabled or no request");
        clearInterval(jdPollingRef.current);
        jdPollingRef.current = null;
      }
      // Clear pending search when polling is disabled
      setHasPendingSearch(false);
      return;
    }

    console.log("🟢 Starting JD change detection - checking every 1 second for changes");

    // Clear any existing polling
    if (jdPollingRef.current) {
      clearInterval(jdPollingRef.current);
      jdPollingRef.current = null;
    }

    // Helper function to check if JD has changed
    const checkJDChange = () => {
      if (!request?.jobDescription) return;

      const currentJD = {
        company_name: request.jobDescription.company_name,
        role_name: request.jobDescription.role_name,
        location: request.jobDescription.location,
        salary_range: request.jobDescription.salary_range,
        responsibility: request.jobDescription.responsibility,
        minimum_requirement: request.jobDescription.minimum_requirement,
        preferred_requirement: request.jobDescription.preferred_requirement,
        perk: request.jobDescription.perk,
        skill: request.jobDescription.skill,
        // Include the categorized skills that are used in the three-tier system
        skill_core: request.jobDescription.skill_core,
        skill_plus: request.jobDescription.skill_plus,
        skill_bonus: request.jobDescription.skill_bonus
      };

      const currentHash = hashJD(currentJD);

      // Initialize hash on first poll
      if (lastSearchedJDHash.current === 0) {
        console.log("📝 Initializing JD hash (first poll):", currentHash);
        lastSearchedJDHash.current = currentHash;
        return;
      }

      // Check if JD has changed since last search (compare hashes)
      if (currentHash !== lastSearchedJDHash.current) {
        console.log("🔄 JD CHANGED detected");

        if (isSearching) {
          // If currently searching, mark as pending instead of starting immediately
          console.log("⏳ Search in progress - marking as pending search");
          setHasPendingSearch(true);
        } else {
          // No search in progress, start immediately
          console.log("🚀 No search in progress - starting search immediately");
          handleSearchCandidate();
        }
      } 
    };

    // Initial check
    checkJDChange();

    // Set up polling every 1 second for faster JD change detection
    jdPollingRef.current = setInterval(() => {
      checkJDChange();
    }, 1000);

    return () => {
      if (jdPollingRef.current) {
        console.log("🧹 Cleanup: clearing JD polling interval");
        clearInterval(jdPollingRef.current);
        jdPollingRef.current = null;
      }
    };
  }, [isPollingMode, request?.jobDescription]);

  // Reset state when request changes (but be more selective)
  useEffect(() => {
    console.log("📝 Request useEffect triggered, request:", request);
    console.log("📝 Current searchRequestId:", searchRequestId);
    
    // Only reset if this is truly a new request (different session ID)
    if (request && request.job_description_enrichment_session) {
      const isNewSession = searchRequestId === "";
      console.log("📝 Is this a new session?", isNewSession);
      
      if (isNewSession) {
        console.log("📝 RESETTING STATE for truly new request");
        setSearchRequestId("");
        setSearchRequestStatus("");
        console.log("🔄 SETTING candidatesListed to FALSE - polling can start again");
        setCandidatesListed(false);
        setIsSearching(false);
        onSearchingChange?.(false);

        // Clear any existing polling
        if (pollingRef.current) {
          console.log("🛑 Clearing existing polling interval");
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else {
        console.log("📝 Same session, not resetting state - keeping polling alive");
      }
    }
  }, [request?.job_description_enrichment_session]); // Only depend on session ID, not entire request object

  return (
    <div className="space-y-4">
      {/* Search Controls */}
      <div className="flex items-center gap-4">
        {/* Hide search button when realtime search is enabled */}
        {!isPollingMode && (
          <Button
            onClick={handleSearchCandidate}
            disabled={isSearching || !request?.job_description_enrichment_session}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700"
            size="sm"
          >
        {isSearching ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Searching...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Search Candidate (Current JD)
          </>
        )}
        </Button>
      )}

      {/* Polling Mode Toggle */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
        <Switch
          id="polling-mode"
          checked={isPollingMode}
          onCheckedChange={setIsPollingMode}
          disabled={!request?.job_description_enrichment_session}
        />
        <Label
          htmlFor="polling-mode"
          className="text-sm font-medium cursor-pointer flex items-center gap-2"
        >
          <span>Realtime candidate search</span>
          {isPollingMode && (
            <span className="inline-flex items-center justify-center w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
          {hasPendingSearch && (
            <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              Pending
            </span>
          )}
        </Label>
      </div>
      </div>
    </div>
  );
}