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
  const [aiEnrichmentEnabled, setAiEnrichmentEnabled] = useState(true);
  const [originalCandidateData, setOriginalCandidateData] = useState<CandidateProfileFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // WebSocket reference for real-time updates
  const wsRef = useRef<WebSocket | null>(null);

  // Polling reference for candidate profile updates
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
   * Handle AI Enrichment toggle
   */
  const handleAiEnrichmentToggle = (enabled: boolean) => {
    setAiEnrichmentEnabled(enabled);
    onStageChange(enabled ? "ai_enrichment" : "manual_enrichment");

    if (!enabled && !originalCandidateData) {
      setOriginalCandidateData({ ...candidateData });
    }
  };

  /**
   * Save candidate profile to Directus
   */
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

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

      const endpoint = candidateProfileId
        ? `${EXTERNAL.directus_url}/items/candidate_profile/${candidateProfileId}`
        : `${EXTERNAL.directus_url}/items/candidate_profile`;

      const method = candidateProfileId ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: authHeaders,
        body: JSON.stringify({
          ...candidateData,
          skills: JSON.stringify(candidateData.skills)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to save candidate profile`);
      }

      const result = await response.json();
      console.log("Candidate profile saved:", result);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving candidate profile:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to save");
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
   * Setup polling for candidate profile updates
   */
  useEffect(() => {
    if (USE_POLLING_MODE && candidateProfileId && aiEnrichmentEnabled) {
      fetchCandidateProfile();

      pollingRef.current = setInterval(() => {
        fetchCandidateProfile();
      }, 5000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [candidateProfileId, aiEnrichmentEnabled]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  return (
    <GlowCard className="w-full">
      <BackgroundGradientAnimation
        containerClassName="h-full w-full rounded-3xl"
        gradientBackgroundStart="rgb(16, 185, 129)"
        gradientBackgroundEnd="rgb(5, 150, 105)"
        firstColor="34, 197, 94"
        secondColor="16, 185, 129"
        thirdColor="5, 150, 105"
        fourthColor="6, 182, 212"
        fifthColor="14, 165, 233"
        pointerColor="20, 184, 166"
        interactive={true}
      >
        <div className="relative z-10 p-6 text-white">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Candidate Profile Enrichment</h3>
              <p className="text-sm text-white/80">
                {inputMode === "meeting" ? `Call URL: ${callUrl}` : `Test file: ${callUrl}`}
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40">
              <Label htmlFor="ai-enrichment" className="text-sm font-medium cursor-pointer">
                AI Enrichment
              </Label>
              <Switch
                id="ai-enrichment"
                checked={aiEnrichmentEnabled}
                onCheckedChange={handleAiEnrichmentToggle}
                className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/30"
              />
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Name */}
            <div>
              <Label htmlFor="name" className="text-sm font-medium mb-1.5 block">
                Full Name <span className="text-red-300">*</span>
              </Label>
              <Input
                id="name"
                value={candidateData.name}
                onChange={(e) => handleCandidateDataChange('name', e.target.value)}
                placeholder="John Doe"
                disabled={aiEnrichmentEnabled}
                className="bg-white/20 border-white/40 text-white placeholder-white/60 disabled:opacity-60"
              />
              {candidateErrors.name && (
                <p className="text-xs text-red-300 mt-1">{candidateErrors.name}</p>
              )}
            </div>

            {/* Job Title */}
            <div>
              <Label htmlFor="job_title" className="text-sm font-medium mb-1.5 block">
                Current Job Title <span className="text-red-300">*</span>
              </Label>
              <Input
                id="job_title"
                value={candidateData.job_title}
                onChange={(e) => handleCandidateDataChange('job_title', e.target.value)}
                placeholder="Senior Software Engineer"
                disabled={aiEnrichmentEnabled}
                className="bg-white/20 border-white/40 text-white placeholder-white/60 disabled:opacity-60"
              />
            </div>

            {/* Years of Experience */}
            <div>
              <Label htmlFor="year_of_experience" className="text-sm font-medium mb-1.5 block">
                Years of Experience
              </Label>
              <Input
                id="year_of_experience"
                value={candidateData.year_of_experience}
                onChange={(e) => handleCandidateDataChange('year_of_experience', e.target.value)}
                placeholder="5"
                disabled={aiEnrichmentEnabled}
                className="bg-white/20 border-white/40 text-white placeholder-white/60 disabled:opacity-60"
              />
            </div>

            {/* Location */}
            <div>
              <Label htmlFor="location" className="text-sm font-medium mb-1.5 block">
                Location <span className="text-red-300">*</span>
              </Label>
              <Input
                id="location"
                value={candidateData.location}
                onChange={(e) => handleCandidateDataChange('location', e.target.value)}
                placeholder="San Francisco, CA"
                disabled={aiEnrichmentEnabled}
                className="bg-white/20 border-white/40 text-white placeholder-white/60 disabled:opacity-60"
              />
            </div>

            {/* Employment Type */}
            <div>
              <Label htmlFor="employment_type" className="text-sm font-medium mb-1.5 block">
                Preferred Employment Type
              </Label>
              <Input
                id="employment_type"
                value={candidateData.employment_type}
                onChange={(e) => handleCandidateDataChange('employment_type', e.target.value)}
                placeholder="Full-time"
                disabled={aiEnrichmentEnabled}
                className="bg-white/20 border-white/40 text-white placeholder-white/60 disabled:opacity-60"
              />
            </div>

            {/* Salary Range */}
            <div>
              <Label htmlFor="salary_range" className="text-sm font-medium mb-1.5 block">
                Expected Salary Range
              </Label>
              <Input
                id="salary_range"
                value={candidateData.salary_range}
                onChange={(e) => handleCandidateDataChange('salary_range', e.target.value)}
                placeholder="$120k - $180k"
                disabled={aiEnrichmentEnabled}
                className="bg-white/20 border-white/40 text-white placeholder-white/60 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Skills */}
          <div className="mb-4">
            <Label htmlFor="skills" className="text-sm font-medium mb-1.5 block">
              Skills (comma-separated)
            </Label>
            <Input
              id="skills"
              value={candidateData.skills.join(', ')}
              onChange={(e) => handleCandidateDataChange('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="React, TypeScript, Node.js"
              disabled={aiEnrichmentEnabled}
              className="bg-white/20 border-white/40 text-white placeholder-white/60 disabled:opacity-60"
            />
          </div>

          {/* Save Button */}
          {!aiEnrichmentEnabled && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-white text-green-700 hover:bg-gray-100 font-semibold"
              >
                {isSaving ? "Saving..." : "Save Profile"}
              </Button>
              {saveSuccess && (
                <span className="text-sm text-white">✓ Saved successfully</span>
              )}
              {saveError && (
                <span className="text-sm text-red-300">{saveError}</span>
              )}
            </div>
          )}
        </div>
      </BackgroundGradientAnimation>
    </GlowCard>
  );
}
