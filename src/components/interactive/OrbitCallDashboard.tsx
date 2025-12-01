"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import type { JobDescriptionFormData, CandidateProfileFormData, Job } from "@/types/models";
import { DEFAULT_CANDIDATE_PROFILE } from "@/types/models";
import JobDescriptionEnrichment, { type JDStage } from "./JobDescriptionEnrichment";
import CandidateProfileEnrichment, { type CPStage } from "./CandidateProfileEnrichment";
import { enrichAndValidateCallUrl } from "@/types/models";
import { createOrbitCallRequest, getUserProfile } from "@/lib/utils";
import { get_orbit_job_description_enrichment_session_by_request_id, type OrbitJobDescriptionEnrichmentSession, get_orbit_candidate_profile_enrichment_session_by_request_id, type OrbitCandidateProfileEnrichmentSession } from "@/client_side/fetch/orbit_call_session";
import { EXTERNAL } from "@/constant";
import CandidateSearch from "./CandidateSearch";
import CandidateList from "./CandidateList";
import JobList from "./JobList";
import PreviousOrbitCalls from "./PreviousOrbitCalls";

type InputMode = "meeting" | "testing";
type CallType = "company" | "candidate";

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

export default function OrbitCallDashboard() {
  const [callUrl, setCallUrl] = useState("");
  const [callUrlError, setCallUrlError] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("meeting");
  const [callType, setCallType] = useState<CallType>("company");
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
  const [orbitCandidateProfileEnrichmentSession, setOrbitCandidateProfileEnrichmentSession] = useState<OrbitCandidateProfileEnrichmentSession | null>(null);

  // State for candidates data (Company call flow)
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchError, setSearchError] = useState<string>("");
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [currentSearchRequestId, setCurrentSearchRequestId] = useState<string>("");
  const [currentSearchRequestStatus, setCurrentSearchRequestStatus] = useState<string>("");

  // State management for candidate call flow
  const [cpStage, setCpStage] = useState<CPStage>("not_linked");

  // Candidate profile data state
  const [candidateData, setCandidateData] = useState<CandidateProfileFormData>(DEFAULT_CANDIDATE_PROFILE);

  // State for candidate profile enrichment session
  const [candidateProfileId, setCandidateProfileId] = useState<string | null>(null);

  // State for jobs data (Candidate call flow)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobSearchError, setJobSearchError] = useState<string>("");
  const [isSearchingJobs, setIsSearchingJobs] = useState(false);

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
   * Handle candidate profile stage changes with proper reset when going back
   */
  const handleCpStageChange = (newStage: CPStage) => {
    if (newStage === "not_linked") {
      resetEnrichmentState();
    }
    setCpStage(newStage);
  };

  /**
   * Reset all state when switching between call types
   */
  const resetAllState = () => {
    // Reset common state
    setCallUrl("");
    setCallUrlError("");
    setRequestId("");

    // Reset company call state
    setJdStage("not_linked");
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

    // Reset candidate call state
    setCpStage("not_linked");
    setCandidateData(DEFAULT_CANDIDATE_PROFILE);
    setOrbitCandidateProfileEnrichmentSession(null);
    setCandidateProfileId(null);
    setJobs([]);
    setJobSearchError("");
    setIsSearchingJobs(false);
  };

  /**
   * Handle call type switching with proper state reset
   */
  const handleCallTypeChange = (newCallType: CallType) => {
    if (newCallType !== callType) {
      console.log(`Switching call type from ${callType} to ${newCallType}`);
      resetAllState();
      setCallType(newCallType);
    }
  };

  /**
   * Reset enrichment state when going back to setup (keeps call URL)
   */
  const resetEnrichmentState = () => {
    // Reset request and session state
    setRequestId("");
    
    // Reset company call state
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

    // Reset candidate call state
    setCandidateData(DEFAULT_CANDIDATE_PROFILE);
    setOrbitCandidateProfileEnrichmentSession(null);
    setCandidateProfileId(null);
    setJobs([]);
    setJobSearchError("");
    setIsSearchingJobs(false);
  };

  /**
   * Ensure state consistency - called when component mounts or call type changes
   */
  const ensureStateConsistency = () => {
    // Ensure that stages match the current call type
    if (callType === "company" && cpStage !== "not_linked") {
      setCpStage("not_linked");
    }
    if (callType === "candidate" && jdStage !== "not_linked") {
      setJdStage("not_linked");
    }
  };

  /**
   * Handle selection of a previous orbit call
   */
  const handleCallSelection = async (call: any) => {
    console.log("Selected orbit call:", call);
    
    try {
      // Reset state first to ensure clean transition
      resetAllState();
      
      // Set common properties
      if (call.meeting_url) {
        setCallUrl(call.meeting_url);
        setInputMode("meeting");
      } else if (call.testing_filename) {
        setCallUrl(call.testing_filename);
        setInputMode("testing");
      }
      
      setRequestId(call.id);
      
      if (call.mode === 'company_call') {
        console.log("Loading company call data...");
        setCallType("company");
        
        // Try to fetch the associated job description enrichment session
        try {
          const sessionResult = await get_orbit_job_description_enrichment_session_by_request_id(call.id, EXTERNAL.directus_url);
          if (sessionResult.success && sessionResult.session) {
            setOrbitJobDescriptionEnrichmentSession(sessionResult.session);
            console.log("Found job description enrichment session:", sessionResult.session);
            
            if (sessionResult.session.job_description) {
              setJobDescriptionId(sessionResult.session.job_description);
              
              // Fetch and load the job description data
              const jobDescResponse = await fetch(
                `${EXTERNAL.directus_url}/items/job_description/${sessionResult.session.job_description}?fields=id,company_name,role_name,location,salary_range,responsibility,minimum_requirement,preferred_requirement,perk,skill,skill_core,skill_plus,skill_bonus`,
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
                  console.log("Loaded job description data:", loadedJobData);
                }
              }
            }
          }
        } catch (sessionError) {
          console.log("No job description enrichment session found:", sessionError);
        }
        
        // Transition to manual enrichment mode
        console.log("Transitioning to manual_enrichment mode");
        setJdStage("manual_enrichment");
        
      } else if (call.mode === 'candidate_call') {
        console.log("Loading candidate call data...");
        setCallType("candidate");
        
        // Try to fetch the associated candidate profile enrichment session
        try {
          const sessionResult = await get_orbit_candidate_profile_enrichment_session_by_request_id(call.id, EXTERNAL.directus_url);
          if (sessionResult.success && sessionResult.session) {
            setOrbitCandidateProfileEnrichmentSession(sessionResult.session);
            console.log("Found candidate profile enrichment session:", sessionResult.session);
            
            if (sessionResult.session.candidate_profile) {
              setCandidateProfileId(sessionResult.session.candidate_profile);
              
              // Fetch and load the candidate profile data
              const candidateProfileResponse = await fetch(
                `${EXTERNAL.directus_url}/items/candidate_profile/${sessionResult.session.candidate_profile}?fields=id,name,year_of_experience,job_title,employment_type,company_size,location,salary_range,skills,raw,context`,
                {
                  method: 'GET',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${EXTERNAL.directus_key}`
                  }
                }
              );
              
              if (candidateProfileResponse.ok) {
                const candidateProfileResult = await candidateProfileResponse.json();
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
                  console.log("Loaded candidate profile data:", loadedCandidateData);
                }
              }
            }
          }
        } catch (sessionError) {
          console.log("No candidate profile enrichment session found:", sessionError);
        }
        
        // Transition to manual enrichment mode
        console.log("Transitioning to manual_enrichment mode");
        setCpStage("manual_enrichment");
      }
      
    } catch (error) {
      console.error("Error loading selected call:", error);
    }
  };

  /**
   * Handle candidate search results
   */
  const handleCandidateResults = (candidateResults: Candidate[]) => {
    console.log("OrbitCallDashboard - handleCandidateResults called with:", candidateResults);
    console.log("OrbitCallDashboard - Number of candidates received:", candidateResults?.length || 0);
    setCandidates(candidateResults);
    console.log("OrbitCallDashboard - setCandidates called, current candidates length will be:", candidateResults?.length || 0);
  };

  /**
   * Handle candidate search errors
   */
  const handleCandidateError = (error: string) => {
    setSearchError(error);
  };

  /**
   * Handle candidate data changes from CandidateProfileEnrichment component
   */
  const handleCandidateDataChange = (newCandidateData: CandidateProfileFormData) => {
    setCandidateData(newCandidateData);
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
      let requestData: { meeting_url?: string; testing_filename?: string; mode?: 'company_call' | 'candidate_call' } = {};

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

      // Add mode based on callType
      requestData.mode = callType === "company" ? "company_call" : "candidate_call";

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

        if (callType === "company") {
          // Attempt to fetch the orbit job description enrichment session (may not exist yet)
          try {
            const sessionResult = await get_orbit_job_description_enrichment_session_by_request_id(result.id, EXTERNAL.directus_url);
            if (sessionResult.success && sessionResult.session) {
              setOrbitJobDescriptionEnrichmentSession(sessionResult.session);
              console.log("Orbit job description enrichment session found:", sessionResult.session);
              console.log("Session job_description field:", sessionResult.session.job_description);
              if (sessionResult.session.job_description) {
                console.log("Job description ID found, setting:", sessionResult.session.job_description);
                setJobDescriptionId(sessionResult.session.job_description);
              } else {
                console.log("No job_description field in session yet");
              }
            } else {
              console.log("Orbit job description enrichment session not yet created:", sessionResult.error);
            }
          } catch (sessionError) {
            console.log("Error fetching orbit job description enrichment session:", sessionError);
          }
        } else if (callType === "candidate") {
          // Attempt to fetch the orbit candidate profile enrichment session (may not exist yet)
          try {
            const sessionResult = await get_orbit_candidate_profile_enrichment_session_by_request_id(result.id, EXTERNAL.directus_url);
            if (sessionResult.success && sessionResult.session) {
              setOrbitCandidateProfileEnrichmentSession(sessionResult.session);
              console.log("Orbit candidate profile enrichment session found:", sessionResult.session);
              console.log("Session candidate_profile field:", sessionResult.session.candidate_profile);
              if (sessionResult.session.candidate_profile) {
                console.log("Candidate profile ID found, setting:", sessionResult.session.candidate_profile);
                setCandidateProfileId(sessionResult.session.candidate_profile);
              } else {
                console.log("No candidate_profile field in session yet");
              }
            } else {
              console.log("Orbit candidate profile enrichment session not yet created:", sessionResult.error);
            }
          } catch (sessionError) {
            console.log("Error fetching orbit candidate profile enrichment session:", sessionError);
          }
        }
      }

      // Transition to AI enrichment stage based on call type
      if (callType === "company") {
        console.log("Transitioning from", jdStage, "to ai_enrichment");
        setJdStage("ai_enrichment");
        console.log("Job data:", jobData);
      } else {
        console.log("Transitioning from", cpStage, "to ai_enrichment");
        setCpStage("ai_enrichment");
        console.log("Candidate data:", candidateData);
      }

    } catch (error) {
      console.error("Error in handleSendBot:", error);
      setCallUrlError("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeploying(false);
    }
  };


  /**
   * Periodically check for orbit job description enrichment session if we have a request ID but no session yet
   */
  useEffect(() => {
    if (!requestId || orbitJobDescriptionEnrichmentSession || callType !== "company") return;

    const pollForSession = async () => {
      try {
        const sessionResult = await get_orbit_job_description_enrichment_session_by_request_id(requestId, EXTERNAL.directus_url);
        if (sessionResult.success && sessionResult.session) {
          setOrbitJobDescriptionEnrichmentSession(sessionResult.session);
          console.log("Orbit job description enrichment session found via polling:", sessionResult.session);
          console.log("Polling - Session job_description field:", sessionResult.session.job_description);
          if (sessionResult.session.job_description) {
            console.log("Polling - Job description ID found, setting:", sessionResult.session.job_description);
            setJobDescriptionId(sessionResult.session.job_description);
          } else {
            console.log("Polling - No job_description field in session yet");
          }
        }
      } catch (error) {
        console.log("Error polling for orbit job description enrichment session:", error);
      }
    };

    // Poll every 5 seconds for up to 2 minutes
    const pollInterval = setInterval(pollForSession, 5000);
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      console.log("Stopped polling for orbit job description enrichment session after 2 minutes");
    }, 120000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [requestId, orbitJobDescriptionEnrichmentSession, callType]);

  /**
   * Periodically check for orbit candidate profile enrichment session if we have a request ID but no session yet
   */
  useEffect(() => {
    if (!requestId || orbitCandidateProfileEnrichmentSession || callType !== "candidate") return;

    const pollForCandidateSession = async () => {
      try {
        const sessionResult = await get_orbit_candidate_profile_enrichment_session_by_request_id(requestId, EXTERNAL.directus_url);
        if (sessionResult.success && sessionResult.session) {
          setOrbitCandidateProfileEnrichmentSession(sessionResult.session);
          console.log("Orbit candidate profile enrichment session found via polling:", sessionResult.session);
          console.log("Polling - Session candidate_profile field:", sessionResult.session.candidate_profile);
          if (sessionResult.session.candidate_profile) {
            console.log("Polling - Candidate profile ID found, setting:", sessionResult.session.candidate_profile);
            setCandidateProfileId(sessionResult.session.candidate_profile);
          } else {
            console.log("Polling - No candidate_profile field in session yet");
          }
        }
      } catch (error) {
        console.log("Error polling for orbit candidate profile enrichment session:", error);
      }
    };

    // Poll every 5 seconds for up to 2 minutes
    const pollInterval = setInterval(pollForCandidateSession, 5000);
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      console.log("Stopped polling for orbit candidate profile enrichment session after 2 minutes");
    }, 120000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [requestId, orbitCandidateProfileEnrichmentSession, callType]);



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

        {/* Call Type Segmented Control */}
        <div className="mb-4">
          <div className="inline-flex rounded-full bg-white/20 backdrop-blur-sm p-1 border border-white/40">
            <button
              onClick={() => handleCallTypeChange("company")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                callType === "company"
                  ? "bg-white text-black shadow-md"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Company Call
            </button>
            <button
              onClick={() => handleCallTypeChange("candidate")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                callType === "candidate"
                  ? "bg-white text-black shadow-md"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Candidate Call
            </button>
          </div>
        </div>

        {/* Row 2 & 3: Responsive layout - stacked on small screens, single row on md+ */}
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
      {/* COMPANY CALL FLOW */}
      {callType === "company" && (
        <>
          {/* Stage 1: not_linked - Only shows URL input (no GlowCard) */}
          {jdStage === "not_linked" && (
            <>
              <div className="rounded-3xl overflow-hidden w-full">
                {renderNotLinkedStage()}
              </div>
              <PreviousOrbitCalls onCallSelect={handleCallSelection} />
            </>
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

          {/* Candidates List Section - Show when JD enrichment is active */}
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
        </>
      )}

      {/* CANDIDATE CALL FLOW */}
      {callType === "candidate" && (
        <>
          {/* Stage 1: not_linked - Only shows URL input (no GlowCard) */}
          {cpStage === "not_linked" && (
            <>
              <div className="rounded-3xl overflow-hidden w-full">
                {renderNotLinkedStage()}
              </div>
              <PreviousOrbitCalls onCallSelect={handleCallSelection} />
            </>
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

          {/* Jobs List Section - Show when candidate profile enrichment is active */}
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
        </>
      )}

    </div>
  );
}
