"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import type { JobDescriptionFormData } from "@/types/models";
import JobDescriptionEnrichment, { type JDStage } from "./JobDescriptionEnrichment";
import { enrichAndValidateCallUrl } from "@/types/models";
import { createOrbitCallRequest, createOrbitCandidateSearchRequest, getUserProfile } from "@/lib/utils";
import { get_orbit_call_session_by_request_id, type OrbitCallSession } from "@/client_side/fetch/orbit_call_session";
import { EXTERNAL } from "@/constant";

type InputMode = "meeting" | "testing";

interface Candidate {
  id: string;
  name: string;
  title: string;
  experience: string;
  roleFitPercentage: number;
  skills: string[];
  company?: string;
}

interface CandidateSkill {
  name: string;
  color: 'blue' | 'purple' | 'green' | 'yellow' | 'red' | 'indigo' | 'pink' | 'gray';
}

export default function OrbitCallDashboard() {
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
    skill: []
  });

  // State for orbit call request and session
  const [requestId, setRequestId] = useState<string>("");
  const [orbitCallSession, setOrbitCallSession] = useState<OrbitCallSession | null>(null);
  const [jobDescriptionId, setJobDescriptionId] = useState<string | null>(null);

  // State for candidates data
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // State for search functionality
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>("");
  const [searchRequestId, setSearchRequestId] = useState<string>("");
  const [searchRequestStatus, setSearchRequestStatus] = useState<string>("");
  const [candidatesListed, setCandidatesListed] = useState(false);

  // WebSocket reference for search request monitoring
  const searchWsRef = useRef<WebSocket | null>(null);

  /**
   * Handle job data changes from JobDescriptionEnrichment component
   */
  const handleJobDataChange = (newJobData: JobDescriptionFormData) => {
    setJobData(newJobData);
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
        // Testing mode validation - check for valid filename
        // Skip validation if filename contains "testing_filename"
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
   * Validates URL/filename, creates Directus record, and transitions from not_linked to ai_enrichment stage
   */
  const handleSendBot = async () => {
    setIsDeploying(true);

    try {
      let requestData: { meeting_url?: string; testing_filename?: string } = {};

      if (inputMode === "meeting") {
        const validation = enrichAndValidateCallUrl(callUrl);

        if (!validation.isValid) {
          setCallUrlError(validation.error || "Invalid URL");
          setIsDeploying(false);
          return;
        }

        // Clear any errors and use the enriched URL
        setCallUrlError("");
        const finalUrl = validation.enrichedUrl || callUrl;
        if (validation.enrichedUrl) {
          setCallUrl(validation.enrichedUrl);
        }

        requestData.meeting_url = finalUrl;
        console.log("Sending bot to call:", finalUrl);
        console.log("Detected platform:", validation.platform);
      } else {
        // Testing mode validation
        // Skip validation if filename contains "testing_filename"
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

      // Create orbit call request in Directus
      const result = await createOrbitCallRequest(requestData, EXTERNAL.directus_url);

      if (!result.success) {
        setCallUrlError(result.error || "Failed to create orbit call request");
        setIsDeploying(false);
        return;
      }

      console.log("Orbit call request created with ID:", result.id);

      // Store the request ID
      if (result.id) {
        setRequestId(result.id);

        // Attempt to fetch the orbit call session (may not exist yet)
        try {
          const sessionResult = await get_orbit_call_session_by_request_id(result.id, EXTERNAL.directus_url);
          if (sessionResult.success && sessionResult.session) {
            setOrbitCallSession(sessionResult.session);
            console.log("Orbit call session found:", sessionResult.session);
            console.log("Session job_description field:", sessionResult.session.job_description);
            if (sessionResult.session.job_description) {
              console.log("Job description ID found, setting:", sessionResult.session.job_description);
              setJobDescriptionId(sessionResult.session.job_description);
            } else {
              console.log("No job_description field in session yet");
            }
          } else {
            console.log("Orbit call session not yet created:", sessionResult.error);
          }
        } catch (sessionError) {
          console.log("Error fetching orbit call session:", sessionError);
        }
      }

      // Transition to AI enrichment stage
      console.log("Transitioning from", jdStage, "to ai_enrichment");
      setJdStage("ai_enrichment");
      console.log("Job data:", jobData);

    } catch (error) {
      console.error("Error in handleSendBot:", error);
      setCallUrlError("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeploying(false);
    }
  };


  /**
   * Periodically check for orbit call session if we have a request ID but no session yet
   */
  useEffect(() => {
    if (!requestId || orbitCallSession) return;

    const pollForSession = async () => {
      try {
        const sessionResult = await get_orbit_call_session_by_request_id(requestId, EXTERNAL.directus_url);
        if (sessionResult.success && sessionResult.session) {
          setOrbitCallSession(sessionResult.session);
          console.log("Orbit call session found via polling:", sessionResult.session);
          console.log("Polling - Session job_description field:", sessionResult.session.job_description);
          if (sessionResult.session.job_description) {
            console.log("Polling - Job description ID found, setting:", sessionResult.session.job_description);
            setJobDescriptionId(sessionResult.session.job_description);
          } else {
            console.log("Polling - No job_description field in session yet");
          }
        }
      } catch (error) {
        console.log("Error polling for orbit call session:", error);
      }
    };

    // Poll every 5 seconds for up to 2 minutes
    const pollInterval = setInterval(pollForSession, 5000);
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      console.log("Stopped polling for orbit call session after 2 minutes");
    }, 120000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [requestId, orbitCallSession]);


  /**
   * Set up WebSocket subscription for search request status updates
   */
  const setupCandidateSearchRequestWebSocket = async (requestId: string) => {
    try {
      // Clean up existing WebSocket connection
      if (searchWsRef.current) {
        searchWsRef.current.close();
        searchWsRef.current = null;
      }

      await getUserProfile(EXTERNAL.directus_url);
      const u = new URL(EXTERNAL.directus_url);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      u.pathname = "/websocket";
      u.search = "";

      const ws = new WebSocket(u.toString());
      searchWsRef.current = ws;

      const timeout = setTimeout(() => {
        try { ws.close(); } catch { }
        console.log("WebSocket timeout for search request subscription");
      }, 300_000); // 5 minute timeout

      ws.onopen = () => {
        console.log("WebSocket connected for search request updates");
        const authPayload = JSON.stringify({
          type: "auth",
          access_token: EXTERNAL.directus_key
        });
        ws.send(authPayload);
      };

      ws.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data);

          if (msg.type === "auth" && msg.status === "ok") {
            console.log("WebSocket authenticated, subscribing to orbit_candidate_search_request updates");
            const subscriptionPayload = JSON.stringify({
              type: "subscribe",
              collection: "orbit_candidate_search_request",
              query: {
                fields: ["id", "status", "session", "job_description_snapshot"]
              },
            });
            ws.send(subscriptionPayload);
          } else if (msg.type === "subscription") {
            const rec = Array.isArray(msg.data) ? msg.data[0] : msg.data?.payload ?? msg.data?.item ?? msg.data;

            // Filter for updates to our specific search request
            if (msg.event === "update" && rec && String(rec.id) === String(requestId)) {
              console.log("Search request updated via WebSocket:", rec);
              console.log("Current status:", rec.status);

              // Update the status state
              if (rec.status) {
                setSearchRequestStatus(rec.status);
              }

              // Check if status is "listed"
              if (rec.status === "listed") {
                console.log("Candidates listed! Status reached:", rec.status);
                setCandidatesListed(true);
                setIsSearching(false);

                // Fetch the candidate search results
                if (searchRequestId) {
                  fetchCandidateSearchResults(searchRequestId);
                }

                // Close the WebSocket since we've reached the target status
                if (searchWsRef.current) {
                  searchWsRef.current.close();
                  searchWsRef.current = null;
                }
              }
            }
          }
        } catch (error) {
          console.error("Error processing search request WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("Search request WebSocket error:", error);
        clearTimeout(timeout);
      };

      ws.onclose = (event) => {
        console.log("Search request WebSocket closed:", event.code, event.reason);
        clearTimeout(timeout);

        // Attempt to reconnect after 5 seconds if not manually closed and not yet listed
        if (event.code !== 1000 && !candidatesListed) {
          setTimeout(() => {
            if (searchRequestId && !candidatesListed) {
              console.log("Attempting to reconnect WebSocket for search request updates");
              setupCandidateSearchRequestWebSocket(searchRequestId);
            }
          }, 5000);
        }
      };
    } catch (error) {
      console.error("Error setting up search request WebSocket:", error);
    }
  };


  /**
   * Effect to set up WebSocket subscription for search request when searchRequestId is available
   */
  useEffect(() => {
    if (searchRequestId && !candidatesListed) {
      console.log("Setting up WebSocket subscription for search request:", searchRequestId);
      setupCandidateSearchRequestWebSocket(searchRequestId);
    }

    // Cleanup when searchRequestId changes or component unmounts
    return () => {
      if (searchWsRef.current) {
        searchWsRef.current.close();
        searchWsRef.current = null;
      }
    };
  }, [searchRequestId, candidatesListed]);

  /**
   * Cleanup search WebSocket on component unmount
   */
  useEffect(() => {
    return () => {
      // Close search WebSocket
      if (searchWsRef.current) {
        searchWsRef.current.close();
        searchWsRef.current = null;
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

  const getRoleFitColor = (percentage: number) => {
    if (percentage >= 90) return { text: 'text-green-600', bg: 'bg-green-500' };
    if (percentage >= 75) return { text: 'text-yellow-600', bg: 'bg-yellow-500' };
    if (percentage >= 60) return { text: 'text-orange-600', bg: 'bg-orange-500' };
    return { text: 'text-red-600', bg: 'bg-red-500' };
  };

  const renderCandidateCard = (candidate: Candidate) => {
    const fitColors = getRoleFitColor(candidate.roleFitPercentage);

    return (
      <div key={candidate.id} className="bg-gray-50 rounded-3xl p-4 border hover:shadow-md transition-shadow min-w-[280px] flex-shrink-0">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="font-medium text-sm text-gray-900">{candidate.name}</h3>
            <p className="text-xs text-gray-600">{candidate.title}</p>
            {candidate.company && (
              <p className="text-xs text-gray-500 mt-0.5">{candidate.company}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{candidate.experience}</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <div className="text-xs text-gray-500">Role Fit</div>
              <div className={`text-sm font-bold ${fitColors.text}`}>{candidate.roleFitPercentage}%</div>
            </div>
            <div className={`w-2 h-8 ${fitColors.bg} rounded-full`}></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {candidate.skills.map((skill, index) => {
            const skillColor = index % 2 === 0 ? 'blue' : index % 3 === 0 ? 'purple' : 'green';
            const colorClasses = getSkillColorClasses(skillColor);
            return (
              <span key={skill} className={`px-2 py-1 ${colorClasses} text-xs rounded-full`}>
                {skill}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCandidatesSection = () => {
    if (candidates.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No candidates found. Load candidate data to see potential matches.</p>
        </div>
      );
    }

    return (
      <div className="flex space-x-4 overflow-x-auto">
        {candidates.map(renderCandidateCard)}
      </div>
    );
  };

  const loadMockCandidates = () => {
    const mockCandidates: Candidate[] = [
      {
        id: '1',
        name: 'Sarah Chen',
        title: 'Senior Software Engineer',
        experience: '5 years experience',
        roleFitPercentage: 92,
        skills: ['React', 'TypeScript', 'Node.js'],
        company: 'TechCorp Inc.'
      },
      {
        id: '2',
        name: 'Marcus Johnson',
        title: 'Full Stack Developer',
        experience: '3 years experience',
        roleFitPercentage: 78,
        skills: ['Python', 'Django', 'PostgreSQL'],
        company: 'DataSoft Solutions'
      },
      {
        id: '3',
        name: 'Emily Rodriguez',
        title: 'Frontend Developer',
        experience: '4 years experience',
        roleFitPercentage: 65,
        skills: ['Vue.js', 'JavaScript', 'CSS'],
        company: 'Creative Studios'
      }
    ];
    setCandidates(mockCandidates);
  };

  const clearCandidates = () => {
    setCandidates([]);
  };


  /**
   * Fetch candidate search results from Directus
   */
  const fetchCandidateSearchResults = async (searchRequestId: string) => {
    try {
      console.log("Fetching candidate search results for request ID:", searchRequestId);
      
      const user = await getUserProfile(EXTERNAL.directus_url);
      const response = await fetch(`${EXTERNAL.directus_url}/items/orbit_candidate_search_result?filter[request][_eq]=${searchRequestId}&fields=*,candidate_profile.id,candidate_profile.first_name,candidate_profile.last_name,candidate_profile.year_of_experience,candidate_profile.company_name`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch candidate search results:', response.status, response.statusText);
        return;
      }

      const result = await response.json();
      const candidateResults = result.data;

      console.log("Received candidate search results from API:", candidateResults);

      if (candidateResults && candidateResults.length > 0) {
        // Transform the results to match our Candidate interface
        const transformedCandidates: Candidate[] = candidateResults.map((result: any, index: number) => {
          const candidateProfile = result.candidate_profile;
          const firstName = candidateProfile?.first_name || '';
          const lastName = candidateProfile?.last_name || '';
          const fullName = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || `Candidate ${index + 1}`);
          
          return {
            id: candidateProfile?.id || result.id || `candidate_${index}`,
            name: fullName,
            title: result.candidate_title || "Unknown Title",
            experience: candidateProfile?.year_of_experience ? `${candidateProfile.year_of_experience} years experience` : "Experience not specified",
            roleFitPercentage: result.rfi_score || 0,
            skills: result.candidate_skills ? (Array.isArray(result.candidate_skills) ? result.candidate_skills : JSON.parse(result.candidate_skills)) : [],
            company: candidateProfile?.company_name || "Unknown Company"
          };
        });

        console.log("Transformed candidates:", transformedCandidates);
        setCandidates(transformedCandidates);
      } else {
        console.log("No candidate search results found");
        setCandidates([]);
      }
    } catch (error) {
      console.error('Error fetching candidate search results:', error);
      setSearchError("Failed to fetch candidate results. Please try again.");
    }
  };

  /**
   * Handle search people request using current JD
   */
  const handleSearchPeople = async () => {
    if (!orbitCallSession?.id) {
      setSearchError("Missing call session ID");
      return;
    }

    setIsSearching(true);
    setSearchError("");

    try {
      // Prepare job description snapshot
      const jobDescriptionSnapshot = {
        company_name: jobData.company_name,
        role_name: jobData.role_name,
        location: jobData.location,
        salary_range: jobData.salary_range,
        responsibility: jobData.responsibility,
        minimum_requirement: jobData.minimum_requirement,
        preferred_requirement: jobData.preferred_requirement,
        perk: jobData.perk,
        skill: jobData.skill
      };

      const result = await createOrbitCandidateSearchRequest(
        orbitCallSession.id,
        jobDescriptionSnapshot,
        EXTERNAL.directus_url
      );

      if (!result.success) {
        setSearchError(result.error || "Failed to create search request");
        return;
      }

      console.log("Orbit candidate search request created with ID:", result.id);

      // Store the request ID and keep searching state active
      if (result.id) {
        setSearchRequestId(result.id);
        console.log("Search request ID stored:", result.id);
        console.log("Waiting for status to become 'candidate_listed'...");
        // Note: isSearching will be set to false by WebSocket when status becomes "candidate_listed"
      }

      // Clear any existing error
      setSearchError("");

    } catch (error) {
      console.error("Error in handleSearchPeople:", error);
      setSearchError("An unexpected error occurred. Please try again.");
      setIsSearching(false); // Only set to false on error
    }
  };

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
        {/* Row 1: Title */}
        <div className="mb-4">
            <h3 className="text-lg font-semibold">Set Up New Orbit Call</h3>
          </div>

        {/* Row 2 & 3: Responsive layout - stacked on small screens, single row on md+ */}
        <div className="space-y-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            {/* Toggle buttons */}
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setInputMode("meeting")}
                variant={inputMode === "meeting" ? "default" : "outline"}
                size="sm"
                className={inputMode === "meeting" ? "bg-white text-black hover:bg-gray-200" : "bg-white/20 border-white/40 text-white hover:bg-white/30 backdrop-blur-sm"}
              >
                Meeting
              </Button>
              <Button
                onClick={() => setInputMode("testing")}
                variant={inputMode === "testing" ? "default" : "outline"}
                size="sm"
                className={inputMode === "testing" ? "bg-white text-black hover:bg-gray-200" : "bg-white/20 border-white/40 text-white hover:bg-white/30 backdrop-blur-sm"}
              >
                Testing
              </Button>
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
      {/* Stage 1: not_linked - Only shows URL input (no GlowCard) */}
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
          onStageChange={setJdStage}
          onJobDataChange={handleJobDataChange}
        />
      )}

      {/* Action Buttons - Outside the orbit call JD enrichment card */}
      {jdStage !== "not_linked" && orbitCallSession?.id && (
        <div className="mt-6 mb-6 space-y-4">
          {/* Search People Button */}
          <div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">People Search</h4>
                <p className="text-sm text-gray-500">Search for candidates matching this job description</p>
              </div>
              <Button
                onClick={handleSearchPeople}
                disabled={isSearching || !orbitCallSession?.id}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
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
                      Search People
                    </>
                  )}
                </Button>
              </div>
              {searchError && (
                <p className="text-sm text-red-500 mt-2 ml-4">{searchError}</p>
              )}
            </div>
          </div>
        )}

      {/* Candidates Section - Only show when not in not_linked state */}
      {jdStage !== "not_linked" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Potential Candidates</h2>
            <div className="flex gap-2">
              <Button
                onClick={loadMockCandidates}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Load Mock Data
              </Button>
              <Button
                onClick={clearCandidates}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
          {renderCandidatesSection()}
        </div>
      )}
    </div>
  );
}
