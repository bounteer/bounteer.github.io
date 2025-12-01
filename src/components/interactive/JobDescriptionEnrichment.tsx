"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GlowCard } from "./GlowCard";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { DraggableThreeTierSkills, type ThreeTierSkills } from "./DraggableThreeTierSkills";
import type { JobDescriptionFormData, JobDescriptionFormErrors } from "@/types/models";
import { getUserProfile } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

// Configuration: Change this to enable/disable polling mode
const USE_POLLING_MODE = false; // Set to false to use WebSocket mode

/**
 * Job Description enrichment flow has 3 stages:
 *
 * 1. not_linked:
 *    - Shows only the URL input field
 *    - User enters call URL and clicks "Send Bot"
 *    - Transitions to ai_enrichment stage when bot is sent
 *
 * 2. ai_enrichment:
 *    - Shows full UI with gradient blue background header
 *    - Contains "AI Enrichment" toggle (default: ON)
 *    - Job description fields are read-only/uneditable
 *    - AI populates the job description automatically
 *
 * 3. manual_enrichment:
 *    - Activated when AI Enrichment toggle is turned OFF
 *    - Job description fields become editable
 *    - User can manually modify the job description
 *    - Header maintains the same gradient background
 */
export type JDStage = "not_linked" | "ai_enrichment" | "manual_enrichment";

export interface JobDescriptionEnrichmentProps {
  jobDescriptionId: string | null;
  callUrl: string;
  inputMode: "meeting" | "testing";
  stage: JDStage;
  jobData: JobDescriptionFormData;
  onStageChange: (stage: JDStage) => void;
  onJobDataChange: (jobData: JobDescriptionFormData) => void;
}

export default function JobDescriptionEnrichment({
  jobDescriptionId,
  callUrl,
  inputMode,
  stage,
  jobData,
  onStageChange,
  onJobDataChange
}: JobDescriptionEnrichmentProps) {
  const [jobErrors, setJobErrors] = useState<JobDescriptionFormErrors>({});
  const [aiEnrichmentEnabled, setAiEnrichmentEnabled] = useState(stage === "ai_enrichment");
  const [originalJobData, setOriginalJobData] = useState<JobDescriptionFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // WebSocket reference for real-time updates
  const wsRef = useRef<WebSocket | null>(null);

  // Polling reference for job description updates
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Heartbeat reference for WebSocket keep-alive
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const validateField = (name: keyof JobDescriptionFormData, value: string): string | undefined => {
    switch (name) {
      case 'company_name':
        return value.trim().length < 2 ? 'Company name must be at least 2 characters' : undefined;
      case 'role_name':
        return value.trim().length < 3 ? 'Role name must be at least 3 characters' : undefined;
      case 'location':
        return value.trim().length < 2 ? 'Location must be at least 2 characters' : undefined;
      case 'responsibility':
        return value.trim().length < 10 ? 'Responsibilities must be at least 10 characters' : undefined;
      case 'minimum_requirement':
        return value.trim().length < 10 ? 'Minimum requirements must be at least 10 characters' : undefined;
      default:
        return undefined;
    }
  };

  const handleJobDataChange = (name: keyof JobDescriptionFormData | 'skills', value: string | string[] | ThreeTierSkills) => {
    let newData;
    
    if (name === 'skills' && typeof value === 'object' && !Array.isArray(value)) {
      // Handle 3-tier skills update
      newData = { 
        ...jobData, 
        skill_core: value.skill_core,
        skill_plus: value.skill_plus,
        skill_bonus: value.skill_bonus
      };
    } else {
      newData = { ...jobData, [name]: value };
    }

    // Notify parent of changes (parent manages the state)
    onJobDataChange(newData);

    // Validate the field (only for string fields)
    if (typeof value === 'string') {
      const error = validateField(name, value);
      const newErrors = { ...jobErrors };

      if (error) {
        newErrors[name] = error;
      } else {
        delete newErrors[name];
      }

      setJobErrors(newErrors);
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
      if (stage === "manual_enrichment" && !originalJobData) {
        setOriginalJobData({ ...jobData });
      }
    }
  }, [stage, aiEnrichmentEnabled, originalJobData, jobData]);

  /**
   * Handles toggling between AI and manual enrichment
   * @param enabled - true for ai_enrichment, false for manual_enrichment
   */
  const handleAiToggle = (enabled: boolean) => {
    setAiEnrichmentEnabled(enabled);
    onStageChange(enabled ? "ai_enrichment" : "manual_enrichment");

    // When switching to manual mode, save the current state as original data for change tracking
    if (!enabled) {
      setOriginalJobData({ ...jobData });
      setSaveError("");
      setSaveSuccess(false);
    }
  };

  /**
   * Fetch job description data from Directus
   */
  const fetchJobDescription = async (jdId: string) => {
    try {
      const user = await getUserProfile(EXTERNAL.directus_url);
      const response = await fetch(`${EXTERNAL.directus_url}/items/job_description/${jdId}?fields=id,company_name,role_name,location,salary_range,responsibility,minimum_requirement,preferred_requirement,perk,skill,skill_core,skill_plus,skill_bonus`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EXTERNAL.directus_key}`
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch job description:', response.status, response.statusText);
        return;
      }

      const result = await response.json();
      const jd = result.data;

      console.log("Received job description from API:", jd);

      if (jd) {
        const updatedJobData: JobDescriptionFormData = {
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

        // Only update if data has changed
        const hasChanged = Object.keys(updatedJobData).some(key => {
          const oldValue = jobData[key as keyof JobDescriptionFormData];
          const newValue = updatedJobData[key as keyof JobDescriptionFormData];

          // Handle array comparison for skill field
          if (key === 'skill' && Array.isArray(oldValue) && Array.isArray(newValue)) {
            return JSON.stringify(oldValue) !== JSON.stringify(newValue);
          }

          return oldValue !== newValue;
        });

        if (hasChanged) {
          console.log("Job description updated via polling:", updatedJobData);
          // Notify parent of changes (parent manages the state)
          onJobDataChange(updatedJobData);
          // Update original data when data comes from API (not user edits)
          if (stage === "ai_enrichment") {
            setOriginalJobData({ ...updatedJobData });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching job description:', error);
    }
  };

  /**
   * Set up WebSocket subscription for job description updates
   */
  const setupJobDescriptionWebSocket = async (jdId: string) => {
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
        console.log("WebSocket timeout for job description subscription");
      }, 300_000); // 5 minute timeout

      ws.onopen = () => {
        console.log("WebSocket connected for job description updates");
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
            console.log("WebSocket authenticated, subscribing to job_description updates");
            const subscriptionPayload = JSON.stringify({
              type: "subscribe",
              collection: "job_description",
              query: {
                fields: ["id", "company_name", "role_name", "location", "salary_range", "responsibility", "minimum_requirement", "preferred_requirement", "perk", "skill", "skill_core", "skill_plus", "skill_bonus"]
              },
            });
            ws.send(subscriptionPayload);
          } else if (msg.type === "subscription") {
            const rec = Array.isArray(msg.data) ? msg.data[0] : msg.data?.payload ?? msg.data?.item ?? msg.data;

            if (msg.event === "update" && rec && String(rec.id) === String(jdId)) {
              // console.log("Job description updated via WebSocket:", rec);

              // Update the job description form data with the new values
              const updatedJobData: JobDescriptionFormData = {
                company_name: rec.company_name || "",
                role_name: rec.role_name || "",
                location: rec.location || "",
                salary_range: rec.salary_range || "",
                responsibility: rec.responsibility || "",
                minimum_requirement: rec.minimum_requirement || "",
                preferred_requirement: rec.preferred_requirement || "",
                perk: rec.perk || "",
                skill: Array.isArray(rec.skill) ? rec.skill : (rec.skill ? JSON.parse(rec.skill) : []),
                skill_core: Array.isArray(rec.skill_core) ? rec.skill_core : (rec.skill_core ? JSON.parse(rec.skill_core) : []),
                skill_plus: Array.isArray(rec.skill_plus) ? rec.skill_plus : (rec.skill_plus ? JSON.parse(rec.skill_plus) : []),
                skill_bonus: Array.isArray(rec.skill_bonus) ? rec.skill_bonus : (rec.skill_bonus ? JSON.parse(rec.skill_bonus) : [])
              };

              // console.log("Job description form updated with real-time data:", updatedJobData);
              // Notify parent of changes (parent manages the state)
              onJobDataChange(updatedJobData);
              // Update original data when data comes from API (not user edits)
              if (stage === "ai_enrichment") {
                setOriginalJobData({ ...updatedJobData });
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
            if (jobDescriptionId) {
              console.log("Attempting to reconnect WebSocket for job description updates");
              setupJobDescriptionWebSocket(jobDescriptionId);
            }
          }, 5000);
        }
      };
    } catch (error) {
      console.error("Error setting up WebSocket:", error);
    }
  };

  /**
   * Setup polling for job description updates
   */
  const setupJobDescriptionPolling = (jdId: string) => {
    console.log("Setting up polling for job description:", jdId);

    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    // Initial fetch
    fetchJobDescription(jdId);

    // Set up polling every 3 seconds
    pollingRef.current = setInterval(() => {
      fetchJobDescription(jdId);
    }, 3000);
  };

  /**
   * Effect to set up real-time updates (WebSocket or Polling) when job description ID is available
   */
  useEffect(() => {
    console.log("Real-time updates effect - jobDescriptionId:", jobDescriptionId, "stage:", stage, "usePolling:", USE_POLLING_MODE);

    if (jobDescriptionId && stage === "ai_enrichment") {
      if (USE_POLLING_MODE) {
        console.log("Setting up polling for job description:", jobDescriptionId);
        setupJobDescriptionPolling(jobDescriptionId);
      } else {
        console.log("Setting up WebSocket subscription for job description:", jobDescriptionId);
        setupJobDescriptionWebSocket(jobDescriptionId);
      }
    } else {
      console.log("NOT setting up real-time updates - conditions not met:", {
        hasJobDescriptionId: !!jobDescriptionId,
        isAiEnrichment: stage === "ai_enrichment",
        currentStage: stage,
        usePolling: USE_POLLING_MODE
      });
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
  }, [jobDescriptionId, stage]);

  /**
   * Cleanup WebSocket and polling on component unmount
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

  /**
   * Check if there are changes between original and current job data
   */
  const hasJobDataChanges = (): boolean => {
    if (!originalJobData) return false;

    // Compare each field including skills arrays
    const fieldsToCompare: (keyof JobDescriptionFormData)[] = [
      'company_name', 'role_name', 'location', 'salary_range',
      'responsibility', 'minimum_requirement', 'preferred_requirement', 'perk'
    ];

    // Check string fields
    for (const field of fieldsToCompare) {
      if (originalJobData[field] !== jobData[field]) {
        return true;
      }
    }

    // Check skills arrays separately
    const skillArraysToCompare: (keyof JobDescriptionFormData)[] = ['skill', 'skill_core', 'skill_plus', 'skill_bonus'];
    
    for (const skillField of skillArraysToCompare) {
      const originalSkills = (originalJobData[skillField] as string[]) || [];
      const currentSkills = (jobData[skillField] as string[]) || [];

      if (originalSkills.length !== currentSkills.length) {
        return true;
      }

      for (let i = 0; i < originalSkills.length; i++) {
        if (originalSkills[i] !== currentSkills[i]) {
          return true;
        }
      }
    }

    return false;
  };

  /**
   * Handle saving job description to Directus
   */
  const handleSaveJobDescription = async () => {
    if (!jobDescriptionId) {
      setSaveError("Missing job description ID");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const user = await getUserProfile(EXTERNAL.directus_url);

      // Prepare the data to save
      const dataToSave = {
        company_name: jobData.company_name,
        role_name: jobData.role_name,
        location: jobData.location,
        salary_range: jobData.salary_range,
        responsibility: jobData.responsibility,
        minimum_requirement: jobData.minimum_requirement,
        preferred_requirement: jobData.preferred_requirement,
        perk: jobData.perk,
        skill: JSON.stringify(jobData.skill), // Convert array to JSON string for Directus
        skill_core: JSON.stringify(jobData.skill_core),
        skill_plus: JSON.stringify(jobData.skill_plus),
        skill_bonus: JSON.stringify(jobData.skill_bonus)
      };

      const response = await fetch(`${EXTERNAL.directus_url}/items/job_description/${jobDescriptionId}`, {
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
        console.error('Failed to save job description:', response.status, response.statusText, errorText);
        setSaveError(`Failed to save: ${response.status} ${response.statusText}`);
        return;
      }

      const result = await response.json();
      console.log("Job description saved successfully:", result);

      // Update original data to current data since it's now saved
      setOriginalJobData({ ...jobData });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Clear success message after 3 seconds

    } catch (error) {
      console.error('Error saving job description:', error);
      setSaveError("An unexpected error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderEnrichmentForm = () => (
    <>
      {/* Header with gradient background and toggle */}
      <BackgroundGradientAnimation
        containerClassName="h-full w-full"
        gradientBackgroundStart={stage === "manual_enrichment" ? "rgb(75, 85, 99)" : "rgb(255, 154, 0)"}
        gradientBackgroundEnd={stage === "manual_enrichment" ? "rgb(55, 65, 81)" : "rgb(255, 87, 34)"}
        firstColor={stage === "manual_enrichment" ? "107, 114, 128" : "255, 183, 77"}
        secondColor={stage === "manual_enrichment" ? "75, 85, 99" : "255, 152, 0"}
        thirdColor={stage === "manual_enrichment" ? "55, 65, 81" : "255, 87, 34"}
        fourthColor={stage === "manual_enrichment" ? "107, 114, 128" : "255, 193, 7"}
        fifthColor={stage === "manual_enrichment" ? "75, 85, 99" : "255, 111, 0"}
        pointerColor={stage === "manual_enrichment" ? "107, 114, 128" : "255, 167, 38"}
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
                <h3 className="text-lg font-semibold text-white">Job Description Enrichment</h3>
                <p className="text-white/90 text-sm mt-1 mb-0">
                  {stage === "ai_enrichment" ? "Bounteer AI will join the call, and enrich the job description asynchronously" : "Manual editing mode"}
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
                {stage === "manual_enrichment" && jobDescriptionId && (
                  <Button
                    onClick={handleSaveJobDescription}
                    disabled={isSaving || !hasJobDataChanges()}
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

      {/* Job Description Form */}
      <div className="p-6">
        <div className="space-y-4">
          {/* Input Fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company_name"
                value={jobData.company_name}
                onChange={(e) => handleJobDataChange('company_name', e.target.value)}
                placeholder="Enter company name"
                className={jobErrors.company_name ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {jobErrors.company_name && (
                <p className="text-sm text-red-500">{jobErrors.company_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role_name">
                Role Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="role_name"
                value={jobData.role_name}
                onChange={(e) => handleJobDataChange('role_name', e.target.value)}
                placeholder="Enter role title"
                className={jobErrors.role_name ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {jobErrors.role_name && (
                <p className="text-sm text-red-500">{jobErrors.role_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">
                Location <span className="text-red-500">*</span>
              </Label>
              <Input
                id="location"
                value={jobData.location}
                onChange={(e) => handleJobDataChange('location', e.target.value)}
                placeholder="e.g., Remote, New York, NY, San Francisco, CA"
                className={jobErrors.location ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {jobErrors.location && (
                <p className="text-sm text-red-500">{jobErrors.location}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_range">
                Salary Range
              </Label>
              <Input
                id="salary_range"
                value={jobData.salary_range}
                onChange={(e) => handleJobDataChange('salary_range', e.target.value)}
                placeholder="e.g., $80,000 - $120,000 USD annually"
                className={jobErrors.salary_range ? 'border-red-500' : ''}
                disabled={stage === "ai_enrichment"}
              />
              {jobErrors.salary_range && (
                <p className="text-sm text-red-500">{jobErrors.salary_range}</p>
              )}
            </div>
          </div>

          {/* Textarea Fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsibility">
                Responsibilities <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="responsibility"
                value={jobData.responsibility}
                onChange={(e) => handleJobDataChange('responsibility', e.target.value)}
                placeholder="Describe the key responsibilities for this role..."
                className={`h-[120px] resize-none overflow-y-auto ${jobErrors.responsibility ? 'border-red-500' : ''}`}
                disabled={stage === "ai_enrichment"}
              />
              {jobErrors.responsibility && (
                <p className="text-sm text-red-500">{jobErrors.responsibility}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_requirement">
                Minimum Requirements <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="minimum_requirement"
                value={jobData.minimum_requirement}
                onChange={(e) => handleJobDataChange('minimum_requirement', e.target.value)}
                placeholder="List the essential requirements for this position..."
                className={`h-[120px] resize-none overflow-y-auto ${jobErrors.minimum_requirement ? 'border-red-500' : ''}`}
                disabled={stage === "ai_enrichment"}
              />
              {jobErrors.minimum_requirement && (
                <p className="text-sm text-red-500">{jobErrors.minimum_requirement}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_requirement">
                Preferred Requirements
              </Label>
              <Textarea
                id="preferred_requirement"
                value={jobData.preferred_requirement}
                onChange={(e) => handleJobDataChange('preferred_requirement', e.target.value)}
                placeholder="List the nice-to-have requirements..."
                className={`h-[120px] resize-none overflow-y-auto ${jobErrors.preferred_requirement ? 'border-red-500' : ''}`}
                disabled={stage === "ai_enrichment"}
              />
              {jobErrors.preferred_requirement && (
                <p className="text-sm text-red-500">{jobErrors.preferred_requirement}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="perk">
                Perks & Benefits
              </Label>
              <Textarea
                id="perk"
                value={jobData.perk}
                onChange={(e) => handleJobDataChange('perk', e.target.value)}
                placeholder="Describe the benefits and perks offered..."
                className={`h-[120px] resize-none overflow-y-auto ${jobErrors.perk ? 'border-red-500' : ''}`}
                disabled={stage === "ai_enrichment"}
              />
              {jobErrors.perk && (
                <p className="text-sm text-red-500">{jobErrors.perk}</p>
              )}
            </div>
          </div>

          {/* Skills Section */}
          <div>
            <DraggableThreeTierSkills
              skills={{
                skill_core: jobData.skill_core,
                skill_plus: jobData.skill_plus,
                skill_bonus: jobData.skill_bonus
              }}
              onChange={(skills) => handleJobDataChange('skills', skills)}
              disabled={stage === "ai_enrichment"}
            />
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
      color="#ff6b35"
      className="w-full shadow-lg overflow-hidden p-0 rounded-3xl"
      padding={false}
    >
      {renderEnrichmentForm()}
    </GlowCard>
  );
}
