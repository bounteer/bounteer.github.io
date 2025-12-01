"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GlowCard } from "./GlowCard";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import type { CandidateProfileFormData, CandidateProfileFormErrors } from "@/types/models";
import { getUserProfile } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

// Configuration: Change this to enable/disable polling mode
const USE_POLLING_MODE = false; // Set to false to use WebSocket mode

/**
 * Candidate Profile enrichment flow - mirrors Job Description enrichment
 */
export type CPStage = "not_linked" | "ai_enrichment" | "manual_enrichment";

export interface CandidateProfileEnrichmentProps {
  candidateProfileId: string | null;
  callUrl: string;
  inputMode: "meeting" | "testing";
  stage: CPStage;
  candidateData: CandidateProfileFormData;
  onStageChange: (stage: CPStage) => void;
  onCandidateDataChange: (candidateData: CandidateProfileFormData) => void;
}

export default function CandidateProfileEnrichment({
  candidateProfileId,
  callUrl,
  inputMode,
  stage,
  candidateData,
  onStageChange,
  onCandidateDataChange
}: CandidateProfileEnrichmentProps) {
  const [candidateErrors, setCandidateErrors] = useState<CandidateProfileFormErrors>({});
  const [aiEnrichmentEnabled, setAiEnrichmentEnabled] = useState(stage === "ai_enrichment");
  const [originalCandidateData, setOriginalCandidateData] = useState<CandidateProfileFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // WebSocket reference for real-time updates
  const wsRef = useRef<WebSocket | null>(null);

  // Polling reference for candidate profile updates
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Heartbeat reference for WebSocket keep-alive
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const validateField = (name: keyof CandidateProfileFormData, value: string): string | undefined => {
    switch (name) {
      case 'name':
        return value.trim().length < 2 ? 'Name must be at least 2 characters' : undefined;
      case 'job_title':
        return value.trim().length < 2 ? 'Job title must be at least 2 characters' : undefined;
      case 'location':
        return value.trim().length < 2 ? 'Location must be at least 2 characters' : undefined;
      default:
        return undefined;
    }
  };

  const handleCandidateDataChange = (name: keyof CandidateProfileFormData, value: string | string[]) => {
    const newData = { ...candidateData, [name]: value };
    onCandidateDataChange(newData);

    // Validate the field if it's a string
    if (typeof value === 'string') {
      const error = validateField(name, value);
      setCandidateErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };

  /**
   * Sync AI enrichment toggle with stage prop changes
   */
  useEffect(() => {
    const shouldBeEnabled = stage === "ai_enrichment";
    if (aiEnrichmentEnabled !== shouldBeEnabled) {
      console.log("Syncing AI enrichment toggle with stage:", stage, "-> enabled:", shouldBeEnabled);
      setAiEnrichmentEnabled(shouldBeEnabled);
      
      // When loading into manual mode, set original data for change tracking
      if (stage === "manual_enrichment" && !originalCandidateData) {
        setOriginalCandidateData({ ...candidateData });
      }
    }
  }, [stage, aiEnrichmentEnabled, originalCandidateData, candidateData]);

  /**
   * Handle AI Enrichment toggle
   */
  const handleAiToggle = (enabled: boolean) => {
    setAiEnrichmentEnabled(enabled);
    onStageChange(enabled ? "ai_enrichment" : "manual_enrichment");

    // When switching to manual mode, save the current state as original data for change tracking
    if (!enabled) {
      setOriginalCandidateData({ ...candidateData });
      setSaveError("");
      setSaveSuccess(false);
    }
  };

  /**
   * Check if there are changes between original and current candidate data
   */
  const hasCandidateDataChanges = (): boolean => {
    if (!originalCandidateData) return false;

    // Compare each field including skills array
    const fieldsToCompare: (keyof CandidateProfileFormData)[] = [
      'name', 'job_title', 'location', 'year_of_experience',
      'employment_type', 'company_size', 'salary_range', 'raw', 'context'
    ];

    // Check string fields
    for (const field of fieldsToCompare) {
      if (originalCandidateData[field] !== candidateData[field]) {
        return true;
      }
    }

    // Check skills array separately
    const originalSkills = originalCandidateData.skills || [];
    const currentSkills = candidateData.skills || [];

    if (originalSkills.length !== currentSkills.length) {
      return true;
    }

    for (let i = 0; i < originalSkills.length; i++) {
      if (originalSkills[i] !== currentSkills[i]) {
        return true;
      }
    }

    return false;
  };

  /**
   * Handle saving candidate profile to Directus
   */
  const handleSaveCandidateProfile = async () => {
    if (!candidateProfileId) {
      setSaveError("Missing candidate profile ID");
      return;
    }
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const user = await getUserProfile(EXTERNAL.directus_url);

      // Prepare the data to save
      const dataToSave = {
        name: candidateData.name,
        year_of_experience: candidateData.year_of_experience,
        job_title: candidateData.job_title,
        employment_type: candidateData.employment_type,
        company_size: candidateData.company_size,
        location: candidateData.location,
        salary_range: candidateData.salary_range,
        skills: JSON.stringify(candidateData.skills), // Convert array to JSON string for Directus
        raw: candidateData.raw,
        context: candidateData.context
      };

      const response = await fetch(`${EXTERNAL.directus_url}/items/candidate_profile/${candidateProfileId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to save candidate profile:', response.status, response.statusText, errorText);
        setSaveError(`Failed to save: ${response.status} ${response.statusText}`);
        return;
      }

      const result = await response.json();
      console.log("Candidate profile saved successfully:", result);

      // Update original data to current data since it's now saved
      setOriginalCandidateData({ ...candidateData });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Clear success message after 3 seconds

    } catch (error) {
      console.error('Error saving candidate profile:', error);
      setSaveError("An unexpected error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Fetch candidate profile data from Directus
   */
  const fetchCandidateProfile = async () => {
    if (!candidateProfileId) return;

    try {
      const user = await getUserProfile(EXTERNAL.directus_url);
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (user) {
        authHeaders['Authorization'] = `Bearer ${user.access_token}`;
      } else {
        authHeaders['Authorization'] = `Bearer ${EXTERNAL.directus_key}`;
      }

      const response = await fetch(
        `${EXTERNAL.directus_url}/items/candidate_profile/${candidateProfileId}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: authHeaders
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch candidate profile:', response.status);
        return;
      }

      const result = await response.json();
      const profile = result.data;

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

        const updatedData: CandidateProfileFormData = {
          name: profile.name || '',
          year_of_experience: profile.year_of_experience || '',
          job_title: profile.job_title || '',
          employment_type: profile.employment_type || '',
          company_size: profile.company_size || '',
          location: profile.location || '',
          salary_range: profile.salary_range || '',
          skills: skillsArray,
          raw: profile.raw || '',
          context: profile.context || ''
        };

        onCandidateDataChange(updatedData);
      }
    } catch (error) {
      console.error('Error fetching candidate profile:', error);
    }
  };

  /**
   * Set up WebSocket subscription for candidate profile updates
   */
  const setupCandidateProfileWebSocket = async (cpId: string) => {
    try {
      // Clean up existing WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      await getUserProfile(EXTERNAL.directus_url);
      const u = new URL(EXTERNAL.directus_url);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      u.pathname = "/websocket";
      u.search = "";

      const ws = new WebSocket(u.toString());
      wsRef.current = ws;

      const timeout = setTimeout(() => {
        try { ws.close(); } catch { }
        console.log("WebSocket timeout for candidate profile subscription");
      }, 300_000); // 5 minute timeout

      ws.onopen = () => {
        console.log("WebSocket connected for candidate profile updates");
        const authPayload = JSON.stringify({
          type: "auth",
          access_token: EXTERNAL.directus_key
        });
        ws.send(authPayload);

        // Start heartbeat to keep connection alive
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000); // Send ping every 30 seconds
      };

      ws.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data);

          if (msg.type === "auth" && msg.status === "ok") {
            console.log("WebSocket authenticated, subscribing to candidate_profile updates");
            const subscriptionPayload = JSON.stringify({
              type: "subscribe",
              collection: "candidate_profile",
              query: {
                fields: ["id", "name", "year_of_experience", "job_title", "employment_type", "company_size", "location", "salary_range", "skills", "raw", "context"]
              },
            });
            ws.send(subscriptionPayload);
          } else if (msg.type === "subscription") {
            const rec = Array.isArray(msg.data) ? msg.data[0] : msg.data?.payload ?? msg.data?.item ?? msg.data;

            if (msg.event === "update" && rec && String(rec.id) === String(cpId)) {
              console.log("Candidate profile updated via WebSocket:", rec);

              // Parse skills if it's a JSON string
              let skillsArray: string[] = [];
              if (rec.skills) {
                try {
                  skillsArray = typeof rec.skills === 'string'
                    ? JSON.parse(rec.skills)
                    : rec.skills;
                } catch (e) {
                  console.warn('Failed to parse skills:', e);
                  skillsArray = [];
                }
              }

              const updatedData: CandidateProfileFormData = {
                name: rec.name || '',
                year_of_experience: rec.year_of_experience || '',
                job_title: rec.job_title || '',
                employment_type: rec.employment_type || '',
                company_size: rec.company_size || '',
                location: rec.location || '',
                salary_range: rec.salary_range || '',
                skills: skillsArray,
                raw: rec.raw || '',
                context: rec.context || ''
              };

              onCandidateDataChange(updatedData);
              
              // Update original data when data comes from API (not user edits)
              if (stage === "ai_enrichment") {
                setOriginalCandidateData({ ...updatedData });
              }
            }
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        clearTimeout(timeout);
        
        // Clear heartbeat interval on error
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        clearTimeout(timeout);

        // Clear heartbeat interval
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Attempt to reconnect after 5 seconds if not manually closed
        if (event.code !== 1000) {
          setTimeout(() => {
            if (candidateProfileId) {
              console.log("Attempting to reconnect WebSocket for candidate profile updates");
              setupCandidateProfileWebSocket(candidateProfileId);
            }
          }, 5000);
        }
      };
    } catch (error) {
      console.error("Error setting up WebSocket:", error);
    }
  };

  /**
   * Setup polling for candidate profile updates
   */
  useEffect(() => {
    if (candidateProfileId && stage === "ai_enrichment") {
      if (USE_POLLING_MODE) {
        console.log("Setting up polling for candidate profile:", candidateProfileId);
        fetchCandidateProfile();

        pollingRef.current = setInterval(() => {
          fetchCandidateProfile();
        }, 5000);
      } else {
        console.log("Setting up WebSocket subscription for candidate profile:", candidateProfileId);
        setupCandidateProfileWebSocket(candidateProfileId);
      }
    }

    // Cleanup when stage changes or component unmounts
    return () => {
      // Clear polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      // Clear heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [candidateProfileId, stage]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Clear polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      // Clear heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const renderEnrichmentForm = () => (
    <>
      {/* Header with gradient background and toggle */}
      <BackgroundGradientAnimation
        containerClassName="h-full w-full"
        gradientBackgroundStart={stage === "manual_enrichment" ? "rgb(75, 85, 99)" : "rgb(16, 185, 129)"}
        gradientBackgroundEnd={stage === "manual_enrichment" ? "rgb(55, 65, 81)" : "rgb(5, 150, 105)"}
        firstColor={stage === "manual_enrichment" ? "107, 114, 128" : "34, 197, 94"}
        secondColor={stage === "manual_enrichment" ? "75, 85, 99" : "16, 185, 129"}
        thirdColor={stage === "manual_enrichment" ? "55, 65, 81" : "5, 150, 105"}
        fourthColor={stage === "manual_enrichment" ? "107, 114, 128" : "6, 182, 212"}
        fifthColor={stage === "manual_enrichment" ? "75, 85, 99" : "14, 165, 233"}
        pointerColor={stage === "manual_enrichment" ? "107, 114, 128" : "20, 184, 166"}
        interactive={stage !== "manual_enrichment"}
      >
        <div className="relative p-6 h-full flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => onStageChange("not_linked")}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white p-2 h-8 w-8"
                title="Back to setup"
              >
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Button>
              <div>
                <h3 className="text-lg font-semibold text-white">Candidate Profile Enrichment</h3>
                <p className="text-white/90 text-sm mt-1 mb-0">
                  {stage === "ai_enrichment" ? "Bounteer AI will join the call, and enrich the candidate profile asynchronously" : "Manual editing mode"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {inputMode === "meeting" && (
                <Button
                  onClick={() => window.open(callUrl, '_blank')}
                  variant="outline"
                  size="sm"
                  className="bg-white/25 border-white/40 text-white hover:bg-white/35 hover:text-white backdrop-blur-sm"
                >
                  Go to Meeting
                </Button>
              )}
              <div className="flex items-center space-x-3">
                <Label htmlFor="ai-toggle" className="text-sm font-medium text-white">
                  AI Enrichment
                </Label>
                <Switch
                  id="ai-toggle"
                  checked={aiEnrichmentEnabled}
                  onCheckedChange={handleAiToggle}
                />
                {stage === "manual_enrichment" && candidateProfileId && (
                  <Button
                    onClick={handleSaveCandidateProfile}
                    disabled={isSaving || !hasCandidateDataChanges()}
                    size="sm"
                    className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {isSaving ? (
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
                        Saving...
                      </>
                    ) : saveSuccess ? (
                      <>
                        <svg
                          className="w-4 h-4 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Saved
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
                            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        Save
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </BackgroundGradientAnimation>

      {/* Candidate Profile Form */}
      <div className="p-6">
        <div className="space-y-4">

          {/* Input Fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={candidateData.name}
                onChange={(e) => handleCandidateDataChange('name', e.target.value)}
                placeholder="John Doe"
                className={candidateErrors.name ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.name && (
                <p className="text-sm text-red-500">{candidateErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_title">
                Current Job Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="job_title"
                value={candidateData.job_title}
                onChange={(e) => handleCandidateDataChange('job_title', e.target.value)}
                placeholder="Senior Software Engineer"
                className={candidateErrors.job_title ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.job_title && (
                <p className="text-sm text-red-500">{candidateErrors.job_title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="year_of_experience">
                Years of Experience
              </Label>
              <Input
                id="year_of_experience"
                value={candidateData.year_of_experience}
                onChange={(e) => handleCandidateDataChange('year_of_experience', e.target.value)}
                placeholder="5"
                className={candidateErrors.year_of_experience ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.year_of_experience && (
                <p className="text-sm text-red-500">{candidateErrors.year_of_experience}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">
                Location <span className="text-red-500">*</span>
              </Label>
              <Input
                id="location"
                value={candidateData.location}
                onChange={(e) => handleCandidateDataChange('location', e.target.value)}
                placeholder="San Francisco, CA"
                className={candidateErrors.location ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.location && (
                <p className="text-sm text-red-500">{candidateErrors.location}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="employment_type">
                Preferred Employment Type
              </Label>
              <Input
                id="employment_type"
                value={candidateData.employment_type}
                onChange={(e) => handleCandidateDataChange('employment_type', e.target.value)}
                placeholder="Full-time"
                className={candidateErrors.employment_type ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.employment_type && (
                <p className="text-sm text-red-500">{candidateErrors.employment_type}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_range">
                Expected Salary Range
              </Label>
              <Input
                id="salary_range"
                value={candidateData.salary_range}
                onChange={(e) => handleCandidateDataChange('salary_range', e.target.value)}
                placeholder="$120k - $180k"
                className={candidateErrors.salary_range ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.salary_range && (
                <p className="text-sm text-red-500">{candidateErrors.salary_range}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_size">
                Company Size Preference
              </Label>
              <Input
                id="company_size"
                value={candidateData.company_size}
                onChange={(e) => handleCandidateDataChange('company_size', e.target.value)}
                placeholder="Startup, Mid-size, Enterprise"
                className={candidateErrors.company_size ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.company_size && (
                <p className="text-sm text-red-500">{candidateErrors.company_size}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">
                Skills (comma-separated)
              </Label>
              <Input
                id="skills"
                value={candidateData.skills.join(', ')}
                onChange={(e) => handleCandidateDataChange('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="React, TypeScript, Node.js"
                className={candidateErrors.skills ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.skills && (
                <p className="text-sm text-red-500">{candidateErrors.skills}</p>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="raw">
                Raw Resume Data
              </Label>
              <Textarea
                id="raw"
                value={candidateData.raw}
                onChange={(e) => handleCandidateDataChange('raw', e.target.value)}
                placeholder="Raw extracted resume text..."
                className={`h-[120px] resize-none overflow-y-auto ${candidateErrors.raw ? 'border-red-500' : ''}`}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.raw && (
                <p className="text-sm text-red-500">{candidateErrors.raw}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">
                Additional Context
              </Label>
              <Textarea
                id="context"
                value={candidateData.context}
                onChange={(e) => handleCandidateDataChange('context', e.target.value)}
                placeholder="Additional context or notes..."
                className={`h-[120px] resize-none overflow-y-auto ${candidateErrors.context ? 'border-red-500' : ''}`}
                disabled={stage === "ai_enrichment"}
              />
              {candidateErrors.context && (
                <p className="text-sm text-red-500">{candidateErrors.context}</p>
              )}
            </div>
          </div>

          {/* Save Error Display */}
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{saveError}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Only render the form when stage is ai_enrichment or manual_enrichment
  if (stage === "not_linked") {
    return null;
  }

  return (
    <GlowCard
      glowState={stage === "ai_enrichment" ? "processing" : "idle"}
      color="#10b981"
      className="w-full shadow-lg overflow-hidden p-0 rounded-3xl"
      padding={false}
    >
      {renderEnrichmentForm()}
    </GlowCard>
  );
}
