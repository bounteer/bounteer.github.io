"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import type { JobDescriptionFormData } from "@/types/models";
import { enrichAndValidateCallUrl } from "@/types/models";
import { createOrbitCallRequest } from "@/lib/utils";
import { get_orbit_job_description_enrichment_session_by_request_id, type OrbitJobDescriptionEnrichmentSession } from "@/client_side/fetch/orbit_call_session";
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
  sessionId?: string;
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

  // State for candidates data
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchError, setSearchError] = useState<string>("");
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [currentSearchRequestId, setCurrentSearchRequestId] = useState<string>("");
  const [currentSearchRequestStatus, setCurrentSearchRequestStatus] = useState<string>("");

  /**
   * Get session ID from URL query parameter
   */
  const getSessionId = (): string | null => {
    // First check if sessionId was passed as prop
    if (propSessionId) return propSessionId;
    
    // Parse from query parameter: /orbit-call/company?session=123
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
   * Load existing session data if sessionId is available
   */
  useEffect(() => {
    const sessionId = getSessionId();
    if (sessionId) {
      loadExistingSession(sessionId);
    } else {
      // No session ID - show not_linked state for new deployments
      setJdStage("not_linked");
    }
  }, [propSessionId]);

  /**
   * Skip not-linked UI when session ID is present - go directly to enrichment
   */
  useEffect(() => {
    const sessionId = getSessionId();
    if (sessionId && jdStage === "not_linked") {
      // If we have a session ID but are still in not_linked state, move to manual_enrichment
      // (the loadExistingSession will handle setting the proper stage)
      setJdStage("manual_enrichment");
    }
  }, [jdStage]);

  /**
   * Load existing session data
   */
  const loadExistingSession = async (enrichmentSessionId: string) => {
    try {
      console.log("Loading session with ID:", enrichmentSessionId);
      
      // Fetch the enrichment session directly by ID
      const response = await fetch(
        `${EXTERNAL.directus_url}/items/orbit_job_description_enrichment_session/${enrichmentSessionId}?fields=*`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EXTERNAL.directus_key}`
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        const session = result.data;
        console.log("Loaded session data:", session);
        
        if (session) {
          setOrbitJobDescriptionEnrichmentSession(session);
          setRequestId(session.orbit_call_request);
          
          // Load the orbit call request data
          const orbitCallResponse = await fetch(
            `${EXTERNAL.directus_url}/items/orbit_call_request/${session.orbit_call_request}?fields=*`,
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
            }
          }

          // Load job description data if it exists
          if (session.job_description) {
            setJobDescriptionId(session.job_description);
            
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
            
            // Set stage to manual enrichment
            setJdStage("manual_enrichment");
          } else {
            // If no job description yet, set to ai_enrichment
            setJdStage("ai_enrichment");
          }
        } else {
          console.log("No session data found");
          // Session not found, show manual enrichment mode for new session
          setJdStage("manual_enrichment");
        }
      } else {
        console.log("Failed to fetch session, status:", response.status);
        // If session doesn't exist or can't be loaded, show manual enrichment
        setJdStage("manual_enrichment");
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
            searchComponent={orbitJobDescriptionEnrichmentSession?.id ? (
              <CandidateSearch
                request={{
                  job_description_enrichment_session: orbitJobDescriptionEnrichmentSession.id,
                  jobDescription: jobData
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