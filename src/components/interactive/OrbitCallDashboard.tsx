"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { enrichAndValidateCallUrl } from "@/types/models";
import { createOrbitCallRequest } from "@/lib/utils";
import { get_orbit_job_description_enrichment_session_by_request_id, get_orbit_candidate_profile_enrichment_session_by_request_id } from "@/client_side/fetch/orbit_call_session";
import { EXTERNAL } from "@/constant";
import PreviousOrbitCalls from "./PreviousOrbitCalls";

type InputMode = "meeting" | "testing";
type CallType = "company" | "candidate";

export default function OrbitCallDashboard() {
  const [callUrl, setCallUrl] = useState("");
  const [callUrlError, setCallUrlError] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("meeting");
  const [callType, setCallType] = useState<CallType>("company");
  const [isDeploying, setIsDeploying] = useState(false);

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
   * Handles creating orbit call request and redirecting to enrichment page
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

      // Redirect to the appropriate enrichment page with polling for session
      if (callType === "company") {
        // Poll for the job description enrichment session
        const pollForSession = async (attempts = 0, maxAttempts = 12) => {
          try {
            console.log(`Polling for company session, attempt ${attempts + 1}/${maxAttempts}`);
            const sessionResult = await get_orbit_job_description_enrichment_session_by_request_id(result.id, EXTERNAL.directus_url);
            
            if (sessionResult.success && sessionResult.session) {
              const sessionId = sessionResult.session.id;
              console.log("Found company session ID:", sessionId);
              window.location.href = `/orbit-call/company?session=${sessionId}`;
              return;
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
              const sessionId = sessionResult.session.id;
              console.log("Found candidate session ID:", sessionId);
              window.location.href = `/orbit-call/candidate?session=${sessionId}`;
              return;
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
      console.error("Error in handleSendBot:", error);
      setCallUrlError("An unexpected error occurred. Please try again.");
      setIsDeploying(false);
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
      {/* Only show the not-linked setup UI */}
      <div className="rounded-3xl overflow-hidden w-full">
        {renderNotLinkedStage()}
      </div>
      
      {/* Show previous orbit calls for navigation */}
      <PreviousOrbitCalls />
    </div>
  );
}