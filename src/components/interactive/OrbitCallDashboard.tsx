"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { enrichAndValidateCallUrl } from "@/types/models";
import { createOrbitCallRequest } from "@/lib/utils";
import { get_orbit_job_description_enrichment_session_by_request_id, get_orbit_candidate_profile_enrichment_session_by_request_id } from "@/client_side/fetch/orbit_call_session";
import { EXTERNAL } from "@/constant";
import PreviousOrbitCalls from "./PreviousOrbitCalls";
import SpaceSelector from "./SpaceSelector";
import MeetingScheduler from "./MeetingScheduler";

type ManualInputType = "meeting" | "testing";
type CallType = "company" | "candidate";

export default function OrbitCallDashboard() {
  const [callUrl, setCallUrl] = useState("");
  const [callUrlError, setCallUrlError] = useState<string>("");
  const [inputMode] = useState<"schedule">("schedule");
  const [manualInputType, setManualInputType] = useState<ManualInputType>("meeting");
  const [callType, setCallType] = useState<CallType>("company");
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  /**
   * Handle call type switching with state reset
   */
  const handleCallTypeChange = (newCallType: CallType) => {
    if (newCallType !== callType) {
      console.log(`Switching call type from ${callType} to ${newCallType}`);
      setCallUrl("");
      setCallUrlError("");
      setCallType(newCallType);
    }
  };

  /**
   * Handle meeting scheduled from MeetingScheduler component
   */
  const handleMeetingScheduled = (meetLink: string) => {
    console.log("Meeting scheduled with link:", meetLink);
    setCallUrl(meetLink);
    setCallUrlError("");
    // Automatically trigger the send bot with the new meeting link
    handleSendBotWithUrl(meetLink);
  };

  /**
   * Handle error from MeetingScheduler component
   */
  const handleSchedulerError = (error: string) => {
    console.error("Scheduler error:", error);
    setCallUrlError(error);
  };


  /**
   * Handles URL/filename changes with real-time validation
   */
  const handleCallUrlChange = (value: string) => {
    setCallUrl(value);

    if (value.trim()) {
      if (manualInputType === "meeting") {
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
   * Handles creating orbit call request and redirecting to enrichment page
   * with a specific URL (used by both manual input and scheduler)
   */
  const handleSendBotWithUrl = async (url: string) => {
    setIsDeploying(true);

    try {
      let requestData: { meeting_url?: string; testing_filename?: string; mode?: 'company_call' | 'candidate_call'; space?: number } = {};

      // Validate and use the provided URL
      const validation = enrichAndValidateCallUrl(url);

      if (!validation.isValid) {
        setCallUrlError(validation.error || "Invalid URL");
        setIsDeploying(false);
        return;
      }

      // Clear any errors and use the enriched URL
      setCallUrlError("");
      const finalUrl = validation.enrichedUrl || url;
      if (validation.enrichedUrl) {
        setCallUrl(validation.enrichedUrl);
      }

      requestData.meeting_url = finalUrl;
      console.log("Sending bot to call:", finalUrl);

      // Add mode based on callType
      requestData.mode = callType === "company" ? "company_call" : "candidate_call";

      // Add selected space if available
      if (selectedSpaceId) {
        requestData.space = parseInt(selectedSpaceId);
      }

      // Create orbit call request in Directus
      const result = await createOrbitCallRequest(requestData, EXTERNAL.directus_url);

      if (!result.success) {
        setCallUrlError(result.error || "Failed to create orbit call request");
        setIsDeploying(false);
        return;
      }

      console.log("Orbit call request created with ID:", result.id);

      // Redirect to the appropriate enrichment page with polling for session
      if (callType === "company") {
        // Poll for the job description enrichment session
        const pollForSession = async (attempts = 0, maxAttempts = 12) => {
          try {
            console.log(`Polling for company session, attempt ${attempts + 1}/${maxAttempts}`);
            const sessionResult = await get_orbit_job_description_enrichment_session_by_request_id(result.id, EXTERNAL.directus_url);

            if (sessionResult.success && sessionResult.session) {
              const publicKey = sessionResult.session.public_key;
              console.log("Session data:", {
                id: sessionResult.session.id,
                public_key: sessionResult.session.public_key,
                request: sessionResult.session.request
              });

              if (publicKey) {
                console.log("Found company session public key:", publicKey);
                window.location.href = `/orbit-call/company?session=${publicKey}`;
                return;
              } else {
                console.log("Company session found but no public key available yet, continuing to poll...");
              }
            }

            // Retry if session not found and we haven't exceeded max attempts
            if (attempts < maxAttempts - 1) {
              setTimeout(() => pollForSession(attempts + 1, maxAttempts), 2000);
            } else {
              // Max attempts reached, redirect without session (page will handle polling)
              console.log("Max polling attempts reached, redirecting without session");
              window.location.href = `/orbit-call/company`;
            }
          } catch (error) {
            console.error("Error polling for company session:", error);
            window.location.href = `/orbit-call/company`;
          }
        };

        // Start polling immediately
        pollForSession();

      } else {
        // Poll for the candidate profile enrichment session
        const pollForSession = async (attempts = 0, maxAttempts = 12) => {
          try {
            console.log(`Polling for candidate session, attempt ${attempts + 1}/${maxAttempts}`);
            const sessionResult = await get_orbit_candidate_profile_enrichment_session_by_request_id(result.id, EXTERNAL.directus_url);

            if (sessionResult.success && sessionResult.session) {
              const publicKey = sessionResult.session.public_key;
              console.log("Session data:", {
                id: sessionResult.session.id,
                public_key: sessionResult.session.public_key,
                request: sessionResult.session.request
              });

              if (publicKey) {
                console.log("Found candidate session public key:", publicKey);
                window.location.href = `/orbit-call/candidate?session=${publicKey}`;
                return;
              } else {
                console.log("Candidate session found but no public key available yet, continuing to poll...");
              }
            }

            // Retry if session not found and we haven't exceeded max attempts
            if (attempts < maxAttempts - 1) {
              setTimeout(() => pollForSession(attempts + 1, maxAttempts), 2000);
            } else {
              // Max attempts reached, redirect without session (page will handle polling)
              console.log("Max polling attempts reached, redirecting without session");
              window.location.href = `/orbit-call/candidate`;
            }
          } catch (error) {
            console.error("Error polling for candidate session:", error);
            window.location.href = `/orbit-call/candidate`;
          }
        };

        // Start polling immediately
        pollForSession();
      }

    } catch (error) {
      console.error("Error in handleSendBotWithUrl:", error);
      setCallUrlError("An unexpected error occurred. Please try again.");
      setIsDeploying(false);
    }
  };

  /**
   * Handles creating orbit call request from manual input or testing mode
   */
  const handleSendBot = async () => {
    if (manualInputType === "meeting") {
      // Manual meeting URL input
      await handleSendBotWithUrl(callUrl);
    } else if (manualInputType === "testing") {
      // Testing mode validation
      setIsDeploying(true);
      try {
        let requestData: { testing_filename?: string; mode?: 'company_call' | 'candidate_call'; space?: number } = {};

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
        requestData.mode = callType === "company" ? "company_call" : "candidate_call";

        if (selectedSpaceId) {
          requestData.space = parseInt(selectedSpaceId);
        }

        console.log("Loading test file:", callUrl);

        // Create orbit call request in Directus
        const result = await createOrbitCallRequest(requestData, EXTERNAL.directus_url);

        if (!result.success) {
          setCallUrlError(result.error || "Failed to create orbit call request");
          setIsDeploying(false);
          return;
        }

        console.log("Orbit call request created with ID:", result.id);

        // Redirect based on call type (same as meeting mode)
        if (callType === "company") {
          window.location.href = `/orbit-call/company`;
        } else {
          window.location.href = `/orbit-call/candidate`;
        }
      } catch (error) {
        console.error("Error in testing mode:", error);
        setCallUrlError("An unexpected error occurred. Please try again.");
        setIsDeploying(false);
      }
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
        {/* Row 1: Title and Space Selector */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Set Up New Orbit Call</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70">Space:</span>
            <div className="rounded-md bg-white/10 backdrop-blur-sm border border-white/20">

              <SpaceSelector
                onSpaceChange={setSelectedSpaceId}
                selectedSpaceId={selectedSpaceId}
                requireWriteAccess={true}
                variant="glass"
              />
            </div>
          </div>
        </div>

        {/* Call Type Segmented Control */}
        <div className="mb-4">
          <div className="inline-flex rounded-full bg-white/20 backdrop-blur-sm p-1 border border-white/40">
            <button
              onClick={() => handleCallTypeChange("company")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${callType === "company"
                ? "bg-white text-black shadow-md"
                : "text-white hover:bg-white/10"
                }`}
            >
              Company Call
            </button>
            <button
              onClick={() => handleCallTypeChange("candidate")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${callType === "candidate"
                ? "bg-white text-black shadow-md"
                : "text-white hover:bg-white/10"
                }`}
            >
              Candidate Call
            </button>
          </div>
        </div>

        {/* Scheduling Mode or Manual Input */}
        <div className="space-y-4">
          {inputMode === "schedule" ? (
            <>
              {/* Meeting Scheduler Component */}
              <MeetingScheduler
                onMeetingScheduled={handleMeetingScheduled}
                onError={handleSchedulerError}
                callType={callType}
              />

              {/* Expandable Manual Input Section */}
              <Collapsible open={showManualInput} onOpenChange={setShowManualInput}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-center gap-2 text-white/80 hover:text-white hover:bg-white/10"
                    size="sm"
                  >
                    <span className="text-sm">Manual URL Input</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showManualInput ? "rotate-180" : ""
                        }`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  {/* Input Mode Segmented Control */}
                  <div className="inline-flex rounded-full bg-white/20 backdrop-blur-sm p-1 border border-white/40">
                    <button
                      onClick={() => setManualInputType("meeting")}
                      className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${manualInputType === "meeting"
                        ? "bg-white text-black shadow-md"
                        : "text-white hover:bg-white/10"
                        }`}
                    >
                      Meeting URL
                    </button>
                    <button
                      onClick={() => setManualInputType("testing")}
                      className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${manualInputType === "testing"
                        ? "bg-white text-black shadow-md"
                        : "text-white hover:bg-white/10"
                        }`}
                    >
                      Testing
                    </button>
                  </div>

                  {/* URL input and Deploy button */}
                  <div className="flex gap-2">
                    <Input
                      id="callUrl"
                      type={manualInputType === "meeting" ? "url" : "text"}
                      placeholder={manualInputType === "meeting" ? "Paste meeting link (Google Meet, Teams, or Zoom)" : "Enter test filename (e.g., test-call-001.json)"}
                      value={callUrl}
                      onChange={(e) => handleCallUrlChange(e.target.value)}
                      className={`flex-1 text-sm bg-white/20 border-white/40 text-white placeholder-white/70 focus-visible:ring-white/50 backdrop-blur-sm ${callUrlError ? 'border-red-300' : ''}`}
                    />
                    <Button
                      onClick={handleSendBot}
                      size="sm"
                      disabled={!!callUrlError || !callUrl.trim() || isDeploying || !selectedSpaceId}
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
                  {callUrlError && (
                    <p className="text-sm text-red-300">{callUrlError}</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Space selection reminder */}
              {!selectedSpaceId && (
                <p className="text-sm text-yellow-300">Please select a space to proceed</p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </BackgroundGradientAnimation>
  );

  return (
    <div>
      {/* Only show the not-linked setup UI */}
      <div className="rounded-3xl overflow-hidden w-full">
        {renderNotLinkedStage()}
      </div>

      {/* Show previous orbit call for navigation */}
      <PreviousOrbitCalls />
    </div>
  );
}