"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import type { JobDescriptionFormData } from "@/types/models";
import { enrichAndValidateCallUrl } from "@/types/models";
import { createOrbitCallRequest, getUserProfile } from "@/lib/utils";
import { get_orbit_job_description_enrichment_session_by_request_id, get_orbit_job_description_enrichment_session_by_public_key, type OrbitJobDescriptionEnrichmentSession } from "@/client_side/fetch/orbit_call_session";
import { createGenericSaveRequestOnUnload } from "@/client_side/fetch/generic_request";
import { EXTERNAL } from "@/constant";
import JobDescriptionEnrichment, { type JDStage } from "./JobDescriptionEnrichment";
import CandidateSearch from "./CandidateSearch";
import CandidateList from "./CandidateList";

type InputMode = "meeting" | "testing";

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

interface CompanyOrbitCallEnrichmentProps {
  sessionId?: string; // Now expects public_key instead of database ID
}

export default function CompanyOrbitCallEnrichment({ sessionId: propSessionId }: CompanyOrbitCallEnrichmentProps) {
  const [callUrl, setCallUrl] = useState("");
  const [callUrlError, setCallUrlError] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("meeting");
  const [isDeploying, setIsDeploying] = useState(false);

  // State management for the 3-stage JD enrichment flow
  const [jdStage, setJdStage] = useState<JDStage>("not_linked");

  // Job data state for passing to candidate search and webhook
  const [jobData, setJobData] = useState<JobDescriptionFormData>({
    company_name: "",
    role_name: "",
    location: "",
    salary_range: "",
    responsibility: "",
    minimum_requirement: "",
    preferred_requirement: "",
    perk: "",
    skill: [],
    skill_core: [],
    skill_plus: [],
    skill_bonus: []
  });

  // State for orbit call request and enrichment sessions
  const [requestId, setRequestId] = useState<string>("");
  const [orbitJobDescriptionEnrichmentSession, setOrbitJobDescriptionEnrichmentSession] = useState<OrbitJobDescriptionEnrichmentSession | null>(null);
  const [jobDescriptionId, setJobDescriptionId] = useState<string | null>(null);
  // Space management - these are kept separate to avoid conflicts:
  // - sessionSpace: The space ID from the original orbit call request (used by Job Description Enrichment)
  // - spaceIds: The space IDs selected by user in the candidate search interface (used by Candidate Search)
  const [spaceIds, setSpaceIds] = useState<number[]>([]); // For candidate search space selection
  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [sessionSpace, setSessionSpace] = useState<number | null>(null); // For job description enrichment from request.space

  // State for candidates data
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchError, setSearchError] = useState<string>("");
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [currentSearchRequestId, setCurrentSearchRequestId] = useState<string>("");
  const [currentSearchRequestStatus, setCurrentSearchRequestStatus] = useState<string>("");

  /**
   * Fetch session space name by space ID (for Job Description Enrichment display only)
   */
  const fetchSessionSpaceName = async (spaceId: number) => {
    try {
      const response = await fetch(`${EXTERNAL.directus_url}/items/space/${spaceId}?fields=id,name`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data?.name) {
          setSpaceName(result.data.name);
        }
      }
    } catch (error) {
      console.error('Error fetching session space name:', error);
    }
  };

  /**
   * Get session public key from URL query parameter
   */
  const getSessionPublicKey = (): string | null => {
    // First check if sessionId was passed as prop (now expects public_key)
    if (propSessionId) return propSessionId;
    
    // Parse from query parameter: /orbit-call/company?session=public_key
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionFromQuery = urlParams.get('session');
      if (sessionFromQuery) {
        return sessionFromQuery;
      }
    }
    
    return null;
  };

  /**
   * Fetch session space name when sessionSpace changes
   */
  useEffect(() => {
    if (sessionSpace) {
      fetchSessionSpaceName(sessionSpace);
    } else {
      setSpaceName(null);
    }
  }, [sessionSpace]);

  /**
   * Load existing session data if sessionId is available
   */
  useEffect(() => {
    const publicKey = getSessionPublicKey();
    if (publicKey) {
      loadExistingSession(publicKey);
    } else {
      // No session ID - show not_linked state for new deployments
      setJdStage("not_linked");
    }
  }, [propSessionId]);

  /**
   * Skip not-linked UI when session ID is present - go directly to enrichment
   */
  useEffect(() => {
    const publicKey = getSessionPublicKey();
    if (publicKey && jdStage === "not_linked") {
      // If we have a session ID but are still in not_linked state, move to manual_enrichment
      // (the loadExistingSession will handle setting the proper stage)
      setJdStage("manual_enrichment");
    }
  }, [jdStage]);

  /**
   * Fetch the last candidate search for a job description enrichment session
   */
  const fetchLastCandidateSearch = async (sessionId: string) => {
    try {
      console.log("Fetching last candidate search for session:", sessionId);
      
      // First, get the candidate search request for this session
      const searchUrl = `${EXTERNAL.directus_url}/items/orbit_candidate_search_request?filter[job_description_enrichment_session][_eq]=${encodeURIComponent(sessionId)}&sort=-date_created&limit=1&fields=id,date_created`;
      console.log("Searching for candidate requests with URL:", searchUrl);
      
      const searchRequestResponse = await fetch(searchUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        }
      });

      console.log("Search request response status:", searchRequestResponse.status);
      
      if (!searchRequestResponse.ok) {
        const errorText = await searchRequestResponse.text();
        console.log("Search request failed:", errorText);
        return;
      }

      const searchRequestResult = await searchRequestResponse.json();
      console.log("Search request response data:", searchRequestResult);
      const searchRequest = searchRequestResult.data?.[0];
      
      if (!searchRequest) {
        console.log("No candidate search request data found");
        return;
      }

      console.log("Found candidate search request:", searchRequest.id);
      setCurrentSearchRequestId(searchRequest.id.toString());

      // Now fetch the candidate search results for this request
      const searchResultsResponse = await fetch(
        `${EXTERNAL.directus_url}/items/orbit_candidate_search_result?filter[request][_eq]=${encodeURIComponent(searchRequest.id)}&fields=id,name,title,year_of_experience,rag_score,skills,company,pros,cons`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EXTERNAL.directus_key}`
          }
        }
      );

      if (!searchResultsResponse.ok) {
        console.log("No candidate search results found");
        return;
      }

      const searchResultsData = await searchResultsResponse.json();
      const results = searchResultsData.data || [];
      
      console.log(`Found ${results.length} candidate search results`);

      // Transform results to match the Candidate interface
      const transformedCandidates: Candidate[] = results.map((result: any) => ({
        id: result.id.toString(),
        name: result.name || "Unknown",
        title: result.title || "Unknown Title",
        experience: result.year_of_experience ? `${result.year_of_experience} years` : "Unknown",
        ragScore: result.rag_score || 0,
        skills: Array.isArray(result.skills) ? result.skills : (result.skills ? JSON.parse(result.skills) : []),
        company: result.company || undefined,
        pros: Array.isArray(result.pros) ? result.pros : (result.pros ? JSON.parse(result.pros) : []),
        cons: Array.isArray(result.cons) ? result.cons : (result.cons ? JSON.parse(result.cons) : [])
      }));

      setCandidates(transformedCandidates);
      console.log("Loaded previous candidate search results:", transformedCandidates.length);

    } catch (error) {
      console.error("Error fetching last candidate search:", error);
      // Try alternative approach: search by session public_key if available
      if (sessionId) {
        await fetchCandidateSearchBySessionPublicKey(sessionId);
      }
    }
  };

  /**
   * Fetch candidates by search request ID
   */
  const fetchCandidatesByRequestId = async (requestId: string) => {
    try {
      console.log("Fetching candidates for request ID:", requestId);

      // Ensure user is authenticated first
      await getUserProfile(EXTERNAL.directus_url);

      const searchResultsResponse = await fetch(
        `${EXTERNAL.directus_url}/items/orbit_candidate_search_result?filter[request][_eq]=${encodeURIComponent(requestId)}&fields=*,candidate_profile.id,candidate_profile.name,candidate_profile.job_title,candidate_profile.year_of_experience,candidate_profile.location,candidate_profile.skills,pros,cons`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EXTERNAL.directus_key}`
          }
        }
      );

      if (!searchResultsResponse.ok) {
        console.log("No candidate search results found for request:", requestId);
        return;
      }

      const searchResultsData = await searchResultsResponse.json();
      const candidateResults = searchResultsData.data || [];

      console.log(`Found ${candidateResults.length} candidate search results for request ${requestId}`);

      // Transform results to match the Candidate interface (same as CandidateSearch.tsx)
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

      setCandidates(transformedCandidates);
      console.log("Loaded candidate search results:", transformedCandidates.length);
    } catch (error) {
      console.error("Error fetching candidates by request ID:", error);
    }
  };

  /**
   * Alternative method to fetch candidate search using session data directly
   */
  const fetchCandidateSearchBySessionPublicKey = async (sessionId: string) => {
    try {
      console.log("Trying alternative approach for session:", sessionId);
      
      // Try to find candidate search results that might reference the session directly
      const directSearchUrl = `${EXTERNAL.directus_url}/items/orbit_candidate_search_result?sort=-date_created&limit=20&fields=id,name,title,year_of_experience,rag_score,skills,company,pros,cons,request`;
      console.log("Direct search URL:", directSearchUrl);
      
      const directResponse = await fetch(directSearchUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        }
      });

      if (directResponse.ok) {
        const directResult = await directResponse.json();
        console.log("Direct search results:", directResult);
        
        if (directResult.data && directResult.data.length > 0) {
          // For now, just take the most recent results as a fallback
          const results = directResult.data.slice(0, 10); // Take first 10 results
          
          const transformedCandidates: Candidate[] = results.map((result: any) => ({
            id: result.id.toString(),
            name: result.name || "Unknown",
            title: result.title || "Unknown Title", 
            experience: result.year_of_experience ? `${result.year_of_experience} years` : "Unknown",
            ragScore: result.rag_score || 0,
            skills: Array.isArray(result.skills) ? result.skills : (result.skills ? JSON.parse(result.skills) : []),
            company: result.company || undefined,
            pros: Array.isArray(result.pros) ? result.pros : (result.pros ? JSON.parse(result.pros) : []),
            cons: Array.isArray(result.cons) ? result.cons : (result.cons ? JSON.parse(result.cons) : [])
          }));

          setCandidates(transformedCandidates);
          console.log("Loaded candidate results using alternative method:", transformedCandidates.length);
        }
      }
    } catch (error) {
      console.error("Alternative candidate search method also failed:", error);
    }
  };

  /**
   * Load existing session data
   */
  const loadExistingSession = async (publicKey: string) => {
    try {
      console.log("Loading session with public key:", publicKey);
      
      // Fetch the enrichment session by public key using the API helper
      const sessionResult = await get_orbit_job_description_enrichment_session_by_public_key(publicKey, EXTERNAL.directus_url);
      
      if (!sessionResult.success || !sessionResult.session) {
        console.error("Failed to load session:", sessionResult.error);
        setJdStage("not_linked");
        return;
      }

      const session = sessionResult.session;
      console.log("Loaded session data:", session);
      console.log("Session ID for candidate search:", session.id);
      console.log("Session public_key:", session.public_key);

      // Set the session data
      setOrbitJobDescriptionEnrichmentSession(session);
      
      if (session.request) {
        setRequestId(session.request.toString());
        
        // Load the orbit call request data
        const orbitCallResponse = await fetch(
          `${EXTERNAL.directus_url}/items/orbit_call_request/${session.request}?fields=*`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${EXTERNAL.directus_key}`
            }
          }
        );

        if (orbitCallResponse.ok) {
          const orbitCallResult = await orbitCallResponse.json();
          const orbitCall = orbitCallResult.data;

          if (orbitCall) {
            if (orbitCall.meeting_url) {
              setCallUrl(orbitCall.meeting_url);
              setInputMode("meeting");
            } else if (orbitCall.testing_filename) {
              setCallUrl(orbitCall.testing_filename);
              setInputMode("testing");
            }

            // Load space ID if available
            if (orbitCall.space) {
              const spaceId = typeof orbitCall.space === 'object' ? orbitCall.space.id : orbitCall.space;
              // Don't set spaceIds from existing session - let CandidateList initialize with all spaces
              // Set the session space for Job Description Enrichment (separate from candidate search spaces)
              setSessionSpace(spaceId);
              // The useEffect will handle fetching the space name when sessionSpace changes
            }
          }
        }
      }

      // Load job description data if it exists
      if (session.job_description) {
        setJobDescriptionId(session.job_description.toString());
        
        const jobDescResponse = await fetch(
          `${EXTERNAL.directus_url}/items/job_description/${session.job_description}?fields=*`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${EXTERNAL.directus_key}`
            }
          }
        );
        
        if (jobDescResponse.ok) {
          const jobDescResult = await jobDescResponse.json();
          const jd = jobDescResult.data;
          
          if (jd) {
            const loadedJobData: JobDescriptionFormData = {
              company_name: jd.company_name || "",
              role_name: jd.role_name || "",
              location: jd.location || "",
              salary_range: jd.salary_range || "",
              responsibility: jd.responsibility || "",
              minimum_requirement: jd.minimum_requirement || "",
              preferred_requirement: jd.preferred_requirement || "",
              perk: jd.perk || "",
              skill: Array.isArray(jd.skill) ? jd.skill : (jd.skill ? JSON.parse(jd.skill) : []),
              skill_core: Array.isArray(jd.skill_core) ? jd.skill_core : (jd.skill_core ? JSON.parse(jd.skill_core) : []),
              skill_plus: Array.isArray(jd.skill_plus) ? jd.skill_plus : (jd.skill_plus ? JSON.parse(jd.skill_plus) : []),
              skill_bonus: Array.isArray(jd.skill_bonus) ? jd.skill_bonus : (jd.skill_bonus ? JSON.parse(jd.skill_bonus) : [])
            };
            
            setJobData(loadedJobData);
          }
        }

        // Fetch the last candidate search for this session
        await fetchLastCandidateSearch(session.id);
        
        // Set stage to manual enrichment
        setJdStage("manual_enrichment");
      } else {
        // If no job description yet, still try to fetch any previous candidate search
        await fetchLastCandidateSearch(session.id);
        
        // Set to ai_enrichment
        setJdStage("ai_enrichment");
      }
    } catch (error) {
      console.error("Error loading existing session:", error);
      // On error, default to manual enrichment mode
      setJdStage("manual_enrichment");
    }
  };

  /**
   * Handle job data changes from JobDescriptionEnrichment component
   */
  const handleJobDataChange = (newJobData: JobDescriptionFormData) => {
    setJobData(newJobData);
  };

  /**
   * Handle JD stage changes with proper reset when going back
   */
  const handleJdStageChange = (newStage: JDStage) => {
    if (newStage === "not_linked") {
      resetEnrichmentState();
    }
    setJdStage(newStage);
  };

  /**
   * Reset enrichment state when going back to setup (keeps call URL)
   */
  const resetEnrichmentState = () => {
    setRequestId("");
    setJobData({
      company_name: "",
      role_name: "",
      location: "",
      salary_range: "",
      responsibility: "",
      minimum_requirement: "",
      preferred_requirement: "",
      perk: "",
      skill: [],
      skill_core: [],
      skill_plus: [],
      skill_bonus: []
    });
    setOrbitJobDescriptionEnrichmentSession(null);
    setJobDescriptionId(null);
    setSpaceIds([]); // Reset candidate search space selection
    setSessionSpace(null); // Reset job description enrichment space
    setCandidates([]);
    setSearchError("");
    setIsSearchingCandidates(false);
    setCurrentSearchRequestId("");
    setCurrentSearchRequestStatus("");
  };

  /**
   * Handle candidate search results
   */
  const handleCandidateResults = (candidateResults: Candidate[]) => {
    setCandidates(candidateResults);
  };

  /**
   * Handle candidate search errors
   */
  const handleCandidateError = (error: string) => {
    setSearchError(error);
  };

  /**
   * Handles URL/filename changes with real-time validation
   */
  const handleCallUrlChange = (value: string) => {
    setCallUrl(value);

    if (value.trim()) {
      if (inputMode === "meeting") {
        const validation = enrichAndValidateCallUrl(value);
        if (validation.error) {
          setCallUrlError(validation.error);
        } else {
          setCallUrlError("");
          // Use the enriched URL
          if (validation.enrichedUrl && validation.enrichedUrl !== value) {
            setCallUrl(validation.enrichedUrl);
          }
        }
      } else {
        // Testing mode validation
        if (value.trim().includes("testing_filename")) {
          setCallUrlError("");
        } else {
          const isValidFilename = /^[a-zA-Z0-9._-]+\.(json|txt|csv)$/.test(value.trim());
          if (!isValidFilename) {
            setCallUrlError("Please enter a valid test filename (e.g., test-call-001.json)");
          } else {
            setCallUrlError("");
          }
        }
      }
    } else {
      setCallUrlError("");
    }
  };

  /**
   * Handles sending the bot to the call or loading test file
   */
  const handleSendBot = async () => {
    setIsDeploying(true);

    try {
      let requestData: { meeting_url?: string; testing_filename?: string; mode?: 'company_call' | 'candidate_call' } = {};

      if (inputMode === "meeting") {
        const validation = enrichAndValidateCallUrl(callUrl);

        if (!validation.isValid) {
          setCallUrlError(validation.error || "Invalid URL");
          setIsDeploying(false);
          return;
        }

        setCallUrlError("");
        const finalUrl = validation.enrichedUrl || callUrl;
        if (validation.enrichedUrl) {
          setCallUrl(validation.enrichedUrl);
        }

        requestData.meeting_url = finalUrl;
        console.log("Sending bot to call:", finalUrl);
      } else {
        // Testing mode validation
        if (!callUrl.trim().includes("testing_filename")) {
          const isValidFilename = /^[a-zA-Z0-9._-]+\.(json|txt|csv)$/.test(callUrl.trim());
          if (!isValidFilename) {
            setCallUrlError("Please enter a valid test filename (e.g., test-call-001.json)");
            setIsDeploying(false);
            return;
          }
        }

        setCallUrlError("");
        requestData.testing_filename = callUrl.trim();
        console.log("Loading test file:", callUrl);
      }

      requestData.mode = "company_call";

      // Create orbit call request in Directus
      const result = await createOrbitCallRequest(requestData, EXTERNAL.directus_url);

      if (!result.success) {
        setCallUrlError(result.error || "Failed to create orbit call request");
        setIsDeploying(false);
        return;
      }

      console.log("Orbit call request created with ID:", result.id);

      if (result.id) {
        setRequestId(result.id);

        // Attempt to fetch the orbit job description enrichment session
        try {
          const sessionResult = await get_orbit_job_description_enrichment_session_by_request_id(result.id, EXTERNAL.directus_url);
          if (sessionResult.success && sessionResult.session) {
            setOrbitJobDescriptionEnrichmentSession(sessionResult.session);
            if (sessionResult.session.job_description) {
              setJobDescriptionId(sessionResult.session.job_description);
            }
          }
        } catch (sessionError) {
          console.log("Error fetching orbit job description enrichment session:", sessionError);
        }
      }

      // Transition to AI enrichment stage
      setJdStage("ai_enrichment");

    } catch (error) {
      console.error("Error in handleSendBot:", error);
      setCallUrlError("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeploying(false);
    }
  };

  /**
   * Periodically check for orbit job description enrichment session
   */
  useEffect(() => {
    if (!requestId || orbitJobDescriptionEnrichmentSession) return;

    const pollForSession = async () => {
      try {
        const sessionResult = await get_orbit_job_description_enrichment_session_by_request_id(requestId, EXTERNAL.directus_url);
        if (sessionResult.success && sessionResult.session) {
          setOrbitJobDescriptionEnrichmentSession(sessionResult.session);
          if (sessionResult.session.job_description) {
            setJobDescriptionId(sessionResult.session.job_description);
          }
        }
      } catch (error) {
        console.log("Error polling for orbit job description enrichment session:", error);
      }
    };

    const pollInterval = setInterval(pollForSession, 5000);
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
    }, 120000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [requestId, orbitJobDescriptionEnrichmentSession]);

  /**
   * Auto-load candidates when request status changes to processing or completed states
   */
  useEffect(() => {
    console.log('[Auto-load] useEffect triggered:', { currentSearchRequestId, currentSearchRequestStatus });

    if (!currentSearchRequestId || !currentSearchRequestStatus) {
      console.log('[Auto-load] Missing required data, skipping');
      return;
    }

    // Check for statuses that should trigger candidate loading:
    // - "processing(8)", "processing(16)", etc. - candidates are being generated
    // - "completed", "listed", "finished", "done" - final states
    const statusLower = currentSearchRequestStatus.toLowerCase();
    console.log('[Auto-load] Status (lowercase):', statusLower);
    console.log('[Auto-load] Starts with "processing("?', statusLower.startsWith("processing("));

    const shouldLoadCandidates =
      statusLower.startsWith("processing(") ||
      ["completed", "listed", "finished", "done"].includes(statusLower);

    console.log('[Auto-load] Should load candidates?', shouldLoadCandidates);

    if (shouldLoadCandidates) {
      console.log(`[Auto-load] ✅ Status changed to ${currentSearchRequestStatus} - fetching candidates for request ${currentSearchRequestId}`);
      fetchCandidatesByRequestId(currentSearchRequestId);
    } else {
      console.log('[Auto-load] ❌ Status does not match criteria for loading candidates');
    }
  }, [currentSearchRequestStatus, currentSearchRequestId]);

  /**
   * Save session data when user exits tab or shuts down browser
   * Creates a new generic_request with action="save" each time
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only save if we have job data to save
      if (orbitJobDescriptionEnrichmentSession?.id && jobData) {
        // Create payload with session context and current job data
        const payload = {
          session_id: orbitJobDescriptionEnrichmentSession.id,
          session_type: "job_description_enrichment",
          job_description_id: jobDescriptionId,
          job_data: jobData,
          space_ids: spaceIds, // Candidate search space selection (user-selected)
          session_space: sessionSpace, // Job description enrichment space (from request.space)
          timestamp: new Date().toISOString()
        };

        // Create a generic request with action="save_job_description"
        createGenericSaveRequestOnUnload(
          "save_job_description",
          payload,
          EXTERNAL.directus_url,
          EXTERNAL.directus_key,
          spaceIds[0] || undefined
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [orbitJobDescriptionEnrichmentSession, jobDescriptionId, jobData, spaceIds, sessionSpace]);

  const renderNotLinkedStage = () => (
    <BackgroundGradientAnimation
      containerClassName="h-full w-full rounded-3xl"
      gradientBackgroundStart="rgb(255, 154, 0)"
      gradientBackgroundEnd="rgb(255, 87, 34)"
      firstColor="255, 183, 77"
      secondColor="255, 152, 0"
      thirdColor="255, 87, 34"
      fourthColor="255, 193, 7"
      fifthColor="255, 111, 0"
      pointerColor="255, 167, 38"
      interactive={true}
    >
      <div className="relative z-10 p-6 text-white">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Set Up Company Orbit Call</h3>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            {/* Input Mode Segmented Control */}
            <div className="inline-flex rounded-full bg-white/20 backdrop-blur-sm p-1 border border-white/40">
              <button
                onClick={() => setInputMode("meeting")}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  inputMode === "meeting"
                    ? "bg-white text-black shadow-md"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Meeting
              </button>
              <button
                onClick={() => setInputMode("testing")}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  inputMode === "testing"
                    ? "bg-white text-black shadow-md"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Testing
              </button>
            </div>
            
            {/* URL input and Deploy button */}
            <div className="flex gap-2 flex-1">
              <Input
                id="callUrl"
                type={inputMode === "meeting" ? "url" : "text"}
                placeholder={inputMode === "meeting" ? "Paste meeting link (Google Meet, Teams, or Zoom)" : "Enter test filename (e.g., test-call-001.json)"}
                value={callUrl}
                onChange={(e) => handleCallUrlChange(e.target.value)}
                className={`flex-1 text-sm bg-white/20 border-white/40 text-white placeholder-white/70 focus-visible:ring-white/50 backdrop-blur-sm ${callUrlError ? 'border-red-300' : ''}`}
              />
              <Button
                onClick={handleSendBot}
                size="sm"
                disabled={!!callUrlError || !callUrl.trim() || isDeploying}
                className="flex items-center justify-center gap-1 px-3 bg-white text-black hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isDeploying ? (
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
                    Deploying...
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
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    Deploy
                  </>
                )}
              </Button>
            </div>
          </div>
          {callUrlError && (
            <p className="text-sm text-red-300">{callUrlError}</p>
          )}
        </div>
      </div>
    </BackgroundGradientAnimation>
  );

  return (
    <div>
      {/* Stage 1: not_linked - Only shows URL input */}
      {jdStage === "not_linked" && (
        <div className="rounded-3xl overflow-hidden w-full">
          {renderNotLinkedStage()}
        </div>
      )}

      {/* Stage 2 & 3: ai_enrichment / manual_enrichment - JobDescriptionEnrichment Component */}
      {(jdStage === "ai_enrichment" || jdStage === "manual_enrichment") && (
        <JobDescriptionEnrichment
          jobDescriptionId={jobDescriptionId}
          callUrl={callUrl}
          inputMode={inputMode}
          stage={jdStage}
          jobData={jobData}
          onStageChange={handleJdStageChange}
          onJobDataChange={handleJobDataChange}
          spaceId={sessionSpace}
          spaceName={spaceName}
        />
      )}

      {/* Candidates List Section */}
      {(jdStage === "ai_enrichment" || jdStage === "manual_enrichment") && (
        <div className="mt-6">
          <CandidateList
            candidates={candidates}
            isSearching={isSearchingCandidates}
            debugInfo={{
              requestId: currentSearchRequestId || undefined,
              requestStatus: currentSearchRequestStatus || undefined
            }}
            selectedSpaceIds={spaceIds}
            onSpaceChange={setSpaceIds}
            searchComponent={orbitJobDescriptionEnrichmentSession?.id ? (
              <CandidateSearch
                request={{
                  job_description_enrichment_session: orbitJobDescriptionEnrichmentSession.id,
                  jobDescription: jobData,
                  spaceIds: spaceIds // Pass the selected space IDs
                }}
                onResults={handleCandidateResults}
                onError={handleCandidateError}
                onSearchingChange={setIsSearchingCandidates}
                onRequestCreated={setCurrentSearchRequestId}
                onStatusChange={setCurrentSearchRequestStatus}
              />
            ) : null}
          />
          {searchError && (
            <p className="text-sm text-red-500 mt-2 ml-6">{searchError}</p>
          )}
        </div>
      )}
    </div>
  );
}