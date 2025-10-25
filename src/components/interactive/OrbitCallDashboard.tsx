"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import RainbowGlowWrapper from "./RainbowGlowWrapper";
import type { JobDescriptionFormData, JobDescriptionFormErrors } from "@/types/models";
import { enrichAndValidateCallUrl } from "@/types/models";

// TODO use framer-motion to link up the 3 states
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
type JDStage = "not_linked" | "ai_enrichment" | "manual_enrichment";

export default function OrbitCallDashboard() {
  const [callUrl, setCallUrl] = useState("");
  const [callUrlError, setCallUrlError] = useState<string>("");
  const [jobData, setJobData] = useState<JobDescriptionFormData>({
    company_name: "",
    role_name: "",
    location: "",
    salary_range: "",
    responsibility: "",
    minimum_requirement: "",
    preferred_requirement: "",
    perk: ""
  });
  const [jobErrors, setJobErrors] = useState<JobDescriptionFormErrors>({});

  // State management for the 3-stage JD enrichment flow
  const [jdStage, setJdStage] = useState<JDStage>("not_linked");
  const [aiEnrichmentEnabled, setAiEnrichmentEnabled] = useState(true);

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

  const handleJobDataChange = (name: keyof JobDescriptionFormData, value: string) => {
    const newData = { ...jobData, [name]: value };
    setJobData(newData);

    // Validate the field
    const error = validateField(name, value);
    const newErrors = { ...jobErrors };

    if (error) {
      newErrors[name] = error;
    } else {
      delete newErrors[name];
    }

    setJobErrors(newErrors);
  };

  /**
   * Handles URL changes with real-time validation
   */
  const handleCallUrlChange = (value: string) => {
    setCallUrl(value);

    if (value.trim()) {
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
      setCallUrlError("");
    }
  };

  /**
   * Handles sending the bot to the call
   * Validates URL and transitions from not_linked to ai_enrichment stage
   */
  const handleSendBot = () => {
    const validation = enrichAndValidateCallUrl(callUrl);

    if (!validation.isValid) {
      setCallUrlError(validation.error || "Invalid URL");
      return;
    }

    // Clear any errors and use the enriched URL
    setCallUrlError("");
    if (validation.enrichedUrl) {
      setCallUrl(validation.enrichedUrl);
    }

    // Transition to AI enrichment stage first
    console.log("Transitioning from", jdStage, "to ai_enrichment");
    setJdStage("ai_enrichment");

    console.log("Sending bot to call:", validation.enrichedUrl || callUrl);
    console.log("Detected platform:", validation.platform);
    console.log("Job data:", jobData);
  };

  /**
   * Handles toggling between AI and manual enrichment
   * @param enabled - true for ai_enrichment, false for manual_enrichment
   */
  const handleAiToggle = (enabled: boolean) => {
    setAiEnrichmentEnabled(enabled);
    setJdStage(enabled ? "ai_enrichment" : "manual_enrichment");
  };

  return (
    <div className="space-y-6">
      {/* Main Card - Job Description Enrichment */}
      <RainbowGlowWrapper
        glowState={jdStage === "ai_enrichment" ? "processing" : "idle"}
        className="w-full"
      >
        <Card className="w-full shadow-lg overflow-hidden p-0">
          {/* Stage 1: not_linked - Only shows URL input */}
          {jdStage === "not_linked" && (
            <>
              <div className="bg-black text-white rounded-xl p-6 border border-gray-800 w-full">
                <h3 className="text-lg font-semibold mb-1">Set Up New Orbit Call</h3>
                <p className="text-gray-400 text-sm mb-5">
                  Enter your call URL to get started
                </p>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      id="callUrl"
                      type="url"
                      placeholder="Paste meeting link (Google Meet, Teams, or Zoom)"
                      value={callUrl}
                      onChange={(e) => handleCallUrlChange(e.target.value)}
                      className={`flex-1 text-sm bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus-visible:ring-gray-500 ${callUrlError ? 'border-red-500' : ''}`}
                    />
                    <Button
                      onClick={handleSendBot}
                      size="sm"
                      disabled={!!callUrlError || !callUrl.trim()}
                      className="flex items-center gap-1 px-3 bg-white text-black hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      Deploy
                    </Button>
                  </div>
                  {callUrlError && (
                    <p className="text-sm text-red-400">{callUrlError}</p>
                  )}
                </div>
              </div>

            </>
          )}

          {/* Stage 2 & 3: ai_enrichment / manual_enrichment - Full UI with gradient header */}
          {(jdStage === "ai_enrichment" || jdStage === "manual_enrichment") && (
            <>
              {/* Header with black background and toggle */}
              <div className="bg-black text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Job Description Enrichment</h3>
                    <p className="text-gray-300 text-sm mt-1">
                      {jdStage === "ai_enrichment" ? "Bounteer AI will join the call, and enrich the job description asynchronously" : "Manual editing mode"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={() => window.open(callUrl, '_blank')}
                      variant="outline"
                      size="sm"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                    >
                      Go to Meeting
                    </Button>
                    <div className="flex items-center space-x-3">
                      <Label htmlFor="ai-toggle" className="text-sm font-medium text-white">
                        AI Enrichment
                      </Label>
                      <Switch
                        id="ai-toggle"
                        checked={aiEnrichmentEnabled}
                        onCheckedChange={handleAiToggle}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Job Description Form */}
              <div className="p-8">
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
                        disabled={jdStage === "ai_enrichment"}
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
                        disabled={jdStage === "ai_enrichment"}
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
                        disabled={jdStage === "ai_enrichment"}
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
                        disabled={jdStage === "ai_enrichment"}
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
                        disabled={jdStage === "ai_enrichment"}
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
                        disabled={jdStage === "ai_enrichment"}
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
                        disabled={jdStage === "ai_enrichment"}
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
                        disabled={jdStage === "ai_enrichment"}
                      />
                      {jobErrors.perk && (
                        <p className="text-sm text-red-500">{jobErrors.perk}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </RainbowGlowWrapper>

      {/* Candidates Section - Only show when not in not_linked state */}
      {jdStage !== "not_linked" && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Potential Candidates</h2>

          <div className="flex space-x-4 overflow-x-auto">
            {/* Candidate 1 */}
            <div className="bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow min-w-[280px] flex-shrink-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-sm text-gray-900">Sarah Chen</h3>
                  <p className="text-xs text-gray-600">Senior Software Engineer</p>
                  <p className="text-xs text-gray-500 mt-1">5 years experience</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Role Fit</div>
                    <div className="text-sm font-bold text-green-600">92%</div>
                  </div>
                  <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">React</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">TypeScript</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Node.js</span>
              </div>
            </div>

            {/* Candidate 2 */}
            <div className="bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow min-w-[280px] flex-shrink-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-sm text-gray-900">Marcus Johnson</h3>
                  <p className="text-xs text-gray-600">Full Stack Developer</p>
                  <p className="text-xs text-gray-500 mt-1">3 years experience</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Role Fit</div>
                    <div className="text-sm font-bold text-yellow-600">78%</div>
                  </div>
                  <div className="w-2 h-8 bg-yellow-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Python</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Django</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">PostgreSQL</span>
              </div>
            </div>

            {/* Candidate 3 */}
            <div className="bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow min-w-[280px] flex-shrink-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-sm text-gray-900">Emily Rodriguez</h3>
                  <p className="text-xs text-gray-600">Frontend Developer</p>
                  <p className="text-xs text-gray-500 mt-1">4 years experience</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Role Fit</div>
                    <div className="text-sm font-bold text-orange-600">65%</div>
                  </div>
                  <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Vue.js</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">JavaScript</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">CSS</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
