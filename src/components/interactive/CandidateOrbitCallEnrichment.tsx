"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import type { CandidateProfileFormData, Job } from "@/types/models";
import { DEFAULT_CANDIDATE_PROFILE, enrichAndValidateCallUrl } from "@/types/models";
import { createOrbitCallRequest } from "@/lib/utils";
import { get_orbit_candidate_profile_enrichment_session_by_request_id, get_orbit_candidate_profile_enrichment_session_by_public_key, type OrbitCandidateProfileEnrichmentSession } from "@/client_side/fetch/orbit_call_session";
import { createGenericSaveRequestOnUnload } from "@/client_side/fetch/generic_request";
import { EXTERNAL } from "@/constant";
import CandidateProfileEnrichment, { type CPStage } from "./CandidateProfileEnrichment";
import JobList from "./JobList";

type InputMode = "meeting" | "testing";

interface CandidateOrbitCallEnrichmentProps {
  sessionId?: string; // Now expects public_key instead of database ID
}

export default function CandidateOrbitCallEnrichment({ sessionId: propSessionId }: CandidateOrbitCallEnrichmentProps) {
  const [callUrl, setCallUrl] = useState("");
  const [callUrlError, setCallUrlError] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("meeting");
  const [isDeploying, setIsDeploying] = useState(false);

  // State management for candidate call flow
  const [cpStage, setCpStage] = useState<CPStage>("not_linked");

  // Candidate profile data state
  const [candidateData, setCandidateData] = useState<CandidateProfileFormData>(DEFAULT_CANDIDATE_PROFILE);

  // State for orbit call request and enrichment sessions
  const [requestId, setRequestId] = useState<string>("");
  const [orbitCandidateProfileEnrichmentSession, setOrbitCandidateProfileEnrichmentSession] = useState<OrbitCandidateProfileEnrichmentSession | null>(null);
  const [candidateProfileId, setCandidateProfileId] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<number | null>(null);

  // State for jobs data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobSearchError, setJobSearchError] = useState<string>("");
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);

  /**
   * Get session public key from URL query parameter
   */
  const getSessionPublicKey = (): string | null => {
    // First check if sessionId was passed as prop (now expects public_key)
    if (propSessionId) return propSessionId;
    
    // Parse from query parameter: /orbit-call/candidate?session=public_key
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
    const publicKey = getSessionPublicKey();
    if (publicKey) {
      loadExistingSession(publicKey);
    } else {
      // No session ID - show not_linked state for new deployments
      setCpStage("not_linked");
    }
  }, [propSessionId]);

  /**
   * Skip not-linked UI when session ID is present - go directly to enrichment
   */
  useEffect(() => {
    const publicKey = getSessionPublicKey();
    if (publicKey && cpStage === "not_linked") {
      // If we have a session ID but are still in not_linked state, move to manual_enrichment
      // (the loadExistingSession will handle setting the proper stage)
      setCpStage("manual_enrichment");
    }
  }, [cpStage]);

  /**
   * Load existing session data
   */
  const loadExistingSession = async (publicKey: string) => {
    try {
      console.log("Loading candidate session with public key:", publicKey);
      
      // Fetch the enrichment session by public key using the API helper
      const sessionResult = await get_orbit_candidate_profile_enrichment_session_by_public_key(publicKey, EXTERNAL.directus_url);
      
      if (!sessionResult.success || !sessionResult.session) {
        console.error("Failed to load candidate session:", sessionResult.error);
        setCpStage("not_linked");
        return;
      }

      const session = sessionResult.session;
      console.log("Loaded candidate session:", session);

      // Set the session data
      setOrbitCandidateProfileEnrichmentSession(session);
      
      if (session.request) {
        setRequestId(session.request.toString());
      }

      if (session.candidate_profile) {
        setCandidateProfileId(session.candidate_profile.toString());
        
        // Load the orbit call request data
        if (session.request) {
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
                setSpaceId(typeof orbitCall.space === 'object' ? orbitCall.space.id : orbitCall.space);
              }
            }
          }
        }

        // Fetch the candidate profile data
        const profileResponse = await fetch(
          `${EXTERNAL.directus_url}/items/candidate_profile/${session.candidate_profile}?fields=*`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${EXTERNAL.directus_key}`
            }
          }
        );

        if (profileResponse.ok) {
          const candidateProfileResult = await profileResponse.json();
          const profile = candidateProfileResult.data;
          
          if (profile) {
            // Parse skills if it's a JSON string
            let skillsArray: string[] = [];
            if (profile.skills) {
              try {
                skillsArray = typeof profile.skills === 'string'
                  ? JSON.parse(profile.skills)
                  : profile.skills;
              } catch (e) {
                console.warn('Failed to parse skills:', e);
                skillsArray = [];
              }
            }
            
            const loadedCandidateData: CandidateProfileFormData = {
              name: profile.name || "",
              year_of_experience: profile.year_of_experience || "",
              job_title: profile.job_title || "",
              employment_type: profile.employment_type || "",
              company_size: profile.company_size || "",
              location: profile.location || "",
              salary_range: profile.salary_range || "",
              skills: skillsArray,
              raw: profile.raw || "",
              context: profile.context || ""
            };
            
            setCandidateData(loadedCandidateData);
            
            // Set stage to manual enrichment since we have profile data
            setCpStage("manual_enrichment");
          } else {
            // If no candidate profile yet, set to ai_enrichment
            setCpStage("ai_enrichment");
          }
        } else {
          // If candidate profile can't be loaded, set to ai_enrichment
          setCpStage("ai_enrichment");
        }
      }
    } catch (error) {
      console.error("Error loading existing candidate session:", error);
      // On error, default to manual enrichment mode
      setCpStage("manual_enrichment");
    }
  };

  /**
   * Handle candidate data changes from CandidateProfileEnrichment component
   */
  const handleCandidateDataChange = (newCandidateData: CandidateProfileFormData) => {
    setCandidateData(newCandidateData);
  };

  /**
   * Handle candidate profile stage changes with proper reset when going back
   */
  const handleCpStageChange = (newStage: CPStage) => {
    if (newStage === "not_linked") {
      resetEnrichmentState();
    }
    setCpStage(newStage);
  };

  /**
   * Reset enrichment state when going back to setup (keeps call URL)
   */
  const resetEnrichmentState = () => {
    setRequestId("");
    setCandidateData(DEFAULT_CANDIDATE_PROFILE);
    setOrbitCandidateProfileEnrichmentSession(null);
    setCandidateProfileId(null);
    setJobs([]);
    setJobSearchError("");
    setIsSearchingJobs(false);
  };

  /**
   * Handle job search results
   */
  const handleJobResults = (jobResults: Job[]) => {
    setJobs(jobResults);
  };

  /**
   * Handle job search errors
   */
  const handleJobError = (error: string) => {
    setJobSearchError(error);
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

      requestData.mode = "candidate_call";

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

        // Attempt to fetch the orbit candidate profile enrichment session
        try {
          const sessionResult = await get_orbit_candidate_profile_enrichment_session_by_request_id(result.id, EXTERNAL.directus_url);
          if (sessionResult.success && sessionResult.session) {
            setOrbitCandidateProfileEnrichmentSession(sessionResult.session);
            if (sessionResult.session.candidate_profile) {
              setCandidateProfileId(sessionResult.session.candidate_profile);
            }
          }
        } catch (sessionError) {
          console.log("Error fetching orbit candidate profile enrichment session:", sessionError);
        }
      }

      // Transition to AI enrichment stage
      setCpStage("ai_enrichment");

    } catch (error) {
      console.error("Error in handleSendBot:", error);
      setCallUrlError("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeploying(false);
    }
  };

  /**
   * Periodically check for orbit candidate profile enrichment session
   */
  useEffect(() => {
    if (!requestId || orbitCandidateProfileEnrichmentSession) return;

    const pollForCandidateSession = async () => {
      try {
        const sessionResult = await get_orbit_candidate_profile_enrichment_session_by_request_id(requestId, EXTERNAL.directus_url);
        if (sessionResult.success && sessionResult.session) {
          setOrbitCandidateProfileEnrichmentSession(sessionResult.session);
          if (sessionResult.session.candidate_profile) {
            setCandidateProfileId(sessionResult.session.candidate_profile);
          }
        }
      } catch (error) {
        console.log("Error polling for orbit candidate profile enrichment session:", error);
      }
    };

    const pollInterval = setInterval(pollForCandidateSession, 5000);
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
    }, 120000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [requestId, orbitCandidateProfileEnrichmentSession]);

  /**
   * Save session data when user exits tab or shuts down browser
   * Creates a new generic_request with action="save" each time
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only save if we have candidate data to save
      if (orbitCandidateProfileEnrichmentSession?.id && candidateData) {
        // Create payload with session context and current candidate data
        const payload = {
          session_id: orbitCandidateProfileEnrichmentSession.id,
          session_type: "candidate_profile_enrichment",
          candidate_profile_id: candidateProfileId,
          candidate_data: candidateData,
          space_id: spaceId,
          timestamp: new Date().toISOString()
        };

        // Create a generic request with action="save" and category="candidate_profile"
        createGenericSaveRequestOnUnload(
          "candidate_profile",
          payload,
          EXTERNAL.directus_url,
          EXTERNAL.directus_key,
          spaceId || undefined
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [orbitCandidateProfileEnrichmentSession, candidateProfileId, candidateData, spaceId]);

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
          <h3 className="text-lg font-semibold">Set Up Candidate Orbit Call</h3>
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
      {cpStage === "not_linked" && (
        <div className="rounded-3xl overflow-hidden w-full">
          {renderNotLinkedStage()}
        </div>
      )}

      {/* Stage 2 & 3: ai_enrichment / manual_enrichment - CandidateProfileEnrichment Component */}
      {(cpStage === "ai_enrichment" || cpStage === "manual_enrichment") && (
        <CandidateProfileEnrichment
          candidateProfileId={candidateProfileId}
          callUrl={callUrl}
          inputMode={inputMode}
          stage={cpStage}
          candidateData={candidateData}
          onStageChange={handleCpStageChange}
          onCandidateDataChange={handleCandidateDataChange}
        />
      )}

      {/* Jobs List Section */}
      {(cpStage === "ai_enrichment" || cpStage === "manual_enrichment") && (
        <div className="mt-6">
          <JobList
            jobs={jobs}
            isSearching={isSearchingJobs}
          />
          {jobSearchError && (
            <p className="text-sm text-red-500 mt-2 ml-6">{jobSearchError}</p>
          )}
        </div>
      )}
    </div>
  );
}