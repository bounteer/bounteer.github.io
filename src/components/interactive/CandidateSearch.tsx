"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { createOrbitCandidateSearchRequest, getUserProfile } from "@/lib/utils";
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
}

interface CandidateSearchProps {
  request: SearchRequest | null;
  onResults: (candidates: Candidate[]) => void;
  onError: (error: string) => void;
  onSearchingChange?: (isSearching: boolean) => void;
  onRequestCreated?: (requestId: string) => void;
}

export default function CandidateSearch({ request, onResults, onError, onSearchingChange, onRequestCreated }: CandidateSearchProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchRequestId, setSearchRequestId] = useState<string>("");
  const [searchRequestStatus, setSearchRequestStatus] = useState<string>("");
  const [candidatesListed, setCandidatesListed] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);


  /**
   * Check search request status via polling
   */
  const checkSearchRequestStatus = async (requestId: string) => {
    try {
      await getUserProfile(EXTERNAL.directus_url);
      const response = await fetch(`${EXTERNAL.directus_url}/items/orbit_candidate_search_request/${requestId}?fields=id,status`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        }
      });

      if (!response.ok) {
        console.error('Failed to check search request status:', response.status, response.statusText);
        return;
      }

      const result = await response.json();
      const searchRequest = result.data;

      console.log("Search request status check:", searchRequest);

      if (searchRequest && searchRequest.status) {
        setSearchRequestStatus(searchRequest.status);

        if (searchRequest.status === "listed") {
          console.log("Candidates listed! Status reached:", searchRequest.status);
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
        }
      }
    } catch (error) {
      console.error('Error checking search request status:', error);
    }
  };

  /**
   * Start polling for search request status
   */
  const startPolling = (requestId: string) => {
    console.log("Starting polling for search request:", requestId);

    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    // Initial check
    checkSearchRequestStatus(requestId);

    // Set up polling every 1 second
    pollingRef.current = setInterval(() => {
      if (!candidatesListed) {
        checkSearchRequestStatus(requestId);
      } else {
        // Stop polling if candidates are already listed
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    }, 1000);
  };

  /**
   * Fetch candidate search results from Directus
   */
  const fetchCandidateSearchResults = async (searchRequestId: string) => {
    try {
      console.log("Fetching candidate search results for request ID:", searchRequestId);

      await getUserProfile(EXTERNAL.directus_url);
      const fetchUrl = `${EXTERNAL.directus_url}/items/orbit_candidate_search_result?filter[request][_eq]=${searchRequestId}&fields=*,candidate_profile.id,candidate_profile.name,candidate_profile.job_title,candidate_profile.year_of_experience,candidate_profile.location,candidate_profile.skills,pros,cons`;
      console.log("Fetch URL:", fetchUrl);
      
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

      console.log("Full API response:", result);
      console.log("Candidate results array:", candidateResults);
      console.log("Number of candidates found:", candidateResults?.length || 0);

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
        console.log("Calling onResults with candidates:", transformedCandidates);
        onResults(transformedCandidates);
      } else {
        console.log("No candidate search results found - empty or null array");
        console.log("Calling onResults with empty array");
        onResults([]);
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

    setIsSearching(true);
    onSearchingChange?.(true);
    onError("");

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
        skill: request.jobDescription.skill
      };

      const result = await createOrbitCandidateSearchRequest(
        request.job_description_enrichment_session,
        jobDescriptionSnapshot,
        EXTERNAL.directus_url
      );

      if (!result.success) {
        onError(result.error || "Failed to create search request");
        setIsSearching(false);
        onSearchingChange?.(false);
        return;
      }

      console.log("Orbit candidate search request created with ID:", result.id);

      if (result.id) {
        setSearchRequestId(result.id);
        console.log("Search request ID stored:", result.id);
        console.log("Waiting for status to become 'listed'...");
        onRequestCreated?.(result.id);
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
    if (searchRequestId && !candidatesListed) {
      console.log("Starting polling for search request:", searchRequestId);
      startPolling(searchRequestId);
    }

    return () => {
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
    };
  }, []);

  // Reset state when request changes
  useEffect(() => {
    if (request) {
      setSearchRequestId("");
      setSearchRequestStatus("");
      setCandidatesListed(false);
      setIsSearching(false);
      onSearchingChange?.(false);

      // Clear any existing polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [request]);

  return (
    <div className="flex items-center gap-2">
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
      {searchRequestStatus && (
        <span className="text-sm text-gray-600">Status: {searchRequestStatus}</span>
      )}
    </div>
  );
}