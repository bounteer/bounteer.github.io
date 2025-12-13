"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUserProfile, getUserSpaces, type Space } from "@/lib/utils";
import { get_orbit_job_description_enrichment_session_by_request_id, get_orbit_candidate_profile_enrichment_session_by_request_id } from "@/client_side/fetch/orbit_call_session";
import { EXTERNAL } from "@/constant";

interface OrbitCallRequest {
  id: string;
  meeting_url?: string;
  testing_filename?: string;
  mode: 'company_call' | 'candidate_call';
  date_created: string;
  date_updated: string;
  space?: string; // Optional field for space filtering
}

interface OrbitCallSession {
  id: string;
  public_key?: string;
  request: {
    id: string;
    space?: string;
  };
}

interface PreviousOrbitCallsProps {
  onCallSelect?: (call: OrbitCallRequest) => void;
}

export default function PreviousOrbitCalls({ onCallSelect }: PreviousOrbitCallsProps) {
  const [calls, setCalls] = useState<OrbitCallRequest[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<OrbitCallRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>("all");
  const [selectedCallType, setSelectedCallType] = useState<string>("all");
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [sessions, setSessions] = useState<{[requestId: string]: OrbitCallSession}>({});

  /**
   * Fetch previous orbit call from Directus
   */
  const fetchPreviousCalls = async () => {
    try {
      setLoading(true);
      await getUserProfile(EXTERNAL.directus_url);

      const response = await fetch(
        `${EXTERNAL.directus_url}/items/orbit_call_request?sort=-date_created&limit=10&fields=id,meeting_url,testing_filename,mode,date_created,date_updated,space`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EXTERNAL.directus_key}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch previous calls: ${response.status}`);
      }

      const result = await response.json();
      const callsData = result.data || [];
      setCalls(callsData);
      
      // Fetch sessions for each call to get space information
      await fetchSessionsWithSpace(callsData);
      
      setFilteredCalls(callsData);
      setError("");
    } catch (err) {
      console.error('Error fetching previous calls:', err);
      setError(err instanceof Error ? err.message : "Failed to load previous calls");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch sessions with expanded request information for space filtering
   */
  const fetchSessionsWithSpace = async (calls: OrbitCallRequest[]) => {
    try {
      const sessionsMap: {[requestId: string]: OrbitCallSession} = {};
      
      // Fetch company call sessions
      const companySessionsResponse = await fetch(
        `${EXTERNAL.directus_url}/items/orbit_job_description_enrichment_session?fields=id,public_key,request.id,request.space&limit=100`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EXTERNAL.directus_key}`
          }
        }
      );

      if (companySessionsResponse.ok) {
        const companyResult = await companySessionsResponse.json();
        const companySessions = companyResult.data || [];
        companySessions.forEach((session: any) => {
          if (session.request?.id) {
            sessionsMap[session.request.id] = session;
          }
        });
      }

      // Fetch candidate call sessions  
      const candidateSessionsResponse = await fetch(
        `${EXTERNAL.directus_url}/items/orbit_candidate_profile_enrichment_session?fields=id,public_key,request.id,request.space&limit=100`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EXTERNAL.directus_key}`
          }
        }
      );

      if (candidateSessionsResponse.ok) {
        const candidateResult = await candidateSessionsResponse.json();
        const candidateSessions = candidateResult.data || [];
        candidateSessions.forEach((session: any) => {
          if (session.request?.id) {
            sessionsMap[session.request.id] = session;
          }
        });
      }

      console.log('[DEBUG] Sessions fetched:', sessionsMap);
      setSessions(sessionsMap);
    } catch (err) {
      console.error('Error fetching sessions with space information:', err);
    }
  };

  /**
   * Fetch spaces from Directus
   */
  const fetchSpaces = async () => {
    try {
      setSpacesLoading(true);
      const result = await getUserSpaces(EXTERNAL.directus_url);
      
      if (result.success && result.spaces) {
        console.log('[DEBUG] Spaces fetched:', result.spaces);
        setSpaces(result.spaces);
      }
    } catch (err) {
      console.error('Error fetching spaces:', err);
    } finally {
      setSpacesLoading(false);
    }
  };

  useEffect(() => {
    fetchPreviousCalls();
    fetchSpaces();
  }, []);

  // Filter calls based on space and call type
  useEffect(() => {
    let filtered = [...calls];

    // Filter by space - use session.request.space or fall back to call.space
    if (selectedSpaceId && selectedSpaceId !== "all") {
      filtered = filtered.filter(call => {
        const session = sessions[call.id];
        const spaceId = session?.request?.space || call.space;
        console.log(`[DEBUG] Call ID: ${call.id}, Session space: ${session?.request?.space}, Call space: ${call.space}, Selected: ${selectedSpaceId}, Match: ${spaceId === selectedSpaceId}`);
        // Convert both to string for comparison since IDs might be stored as numbers
        return String(spaceId) === String(selectedSpaceId);
      });
    }

    console.log(`[DEBUG] Total calls: ${calls.length}, Filtered calls: ${filtered.length}, Selected space: ${selectedSpaceId}`);

    // Filter by call type
    if (selectedCallType !== "all") {
      filtered = filtered.filter(call => call.mode === selectedCallType);
    }

    setFilteredCalls(filtered);
  }, [calls, selectedSpaceId, selectedCallType, sessions]);

  const handleSpaceChange = (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
  };

  const handleCallTypeChange = (callType: string) => {
    setSelectedCallType(callType);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCallDisplayText = (call: OrbitCallRequest) => {
    if (call.meeting_url) {
      const url = new URL(call.meeting_url);
      return `Meeting: ${url.hostname}`;
    }
    if (call.testing_filename) {
      return `Test: ${call.testing_filename}`;
    }
    return "Unknown call";
  };

  const getCallTypeDisplayText = (mode: string) => {
    return mode === 'company_call' ? 'Company Call' : 'Candidate Call';
  };

  const getCallTypeColor = (mode: string) => {
    return mode === 'company_call' ? 'bg-primary-100 text-primary-700' : 'bg-orange-100 text-orange-700';
  };

  /**
   * Handle clicking on a previous call - redirect directly to appropriate page
   */
  const handleCallClick = async (call: OrbitCallRequest) => {
    console.log("PreviousOrbitCalls - Redirecting to orbit call:", call);

    try {
      if (call.mode === 'company_call') {
        console.log("PreviousOrbitCalls - Fetching company session for request ID:", call.id);

        // Use the existing API helper function
        const sessionResult = await get_orbit_job_description_enrichment_session_by_request_id(call.id, EXTERNAL.directus_url);
        console.log("PreviousOrbitCalls - Session result:", sessionResult);

        if (sessionResult.success && sessionResult.session) {
          const publicKey = sessionResult.session.public_key;
          if (publicKey) {
            console.log("PreviousOrbitCalls - Found company session public key:", publicKey);
            window.location.href = `/orbit-call/company?session=${publicKey}`;
            return;
          } else {
            console.log("PreviousOrbitCalls - Company session found but no public key available");
          }
        } else {
          console.log("PreviousOrbitCalls - No company session found:", sessionResult.error);
        }

        // Fallback if no session found
        console.log("PreviousOrbitCalls - Redirecting to company page without session");
        window.location.href = `/orbit-call/company`;

      } else if (call.mode === 'candidate_call') {
        console.log("PreviousOrbitCalls - Fetching candidate session for request ID:", call.id);

        // Use the existing API helper function
        const sessionResult = await get_orbit_candidate_profile_enrichment_session_by_request_id(call.id, EXTERNAL.directus_url);
        console.log("PreviousOrbitCalls - Candidate session result:", sessionResult);

        if (sessionResult.success && sessionResult.session) {
          const publicKey = sessionResult.session.public_key;
          if (publicKey) {
            console.log("PreviousOrbitCalls - Found candidate session public key:", publicKey);
            window.location.href = `/orbit-call/candidate?session=${publicKey}`;
            return;
          } else {
            console.log("PreviousOrbitCalls - Candidate session found but no public key available");
          }
        } else {
          console.log("PreviousOrbitCalls - No candidate session found:", sessionResult.error);
        }

        // Fallback if no session found
        console.log("PreviousOrbitCalls - Redirecting to candidate page without session");
        window.location.href = `/orbit-call/candidate`;
      }

    } catch (error) {
      console.error("PreviousOrbitCalls - Error redirecting to orbit call:", error);
      // Still redirect on error, just without session ID
      if (call.mode === 'company_call') {
        window.location.href = `/orbit-call/company`;
      } else {
        window.location.href = `/orbit-call/candidate`;
      }
    }
  };

  if (loading) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Previous Orbit Call</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading previous calls...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Previous Orbit Call</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-600 mb-2">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{error}</p>
            <Button
              onClick={fetchPreviousCalls}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (calls.length === 0) {
    return (
      <Card className="w-full mt-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Previous Orbit Call</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <div className="mb-3">
              <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-600">No previous calls found</p>
            <p className="text-sm text-gray-500">Your orbit call history will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full mt-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Previous Orbit Call</CardTitle>
          <Button
            onClick={fetchPreviousCalls}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        </div>

        {/* Filter Section */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Space:</span>
            <select
              value={selectedSpaceId || "all"}
              onChange={(e) => handleSpaceChange(e.target.value === "all" ? "all" : e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={spacesLoading}
            >
              <option value="all">All</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id.toString()}>
                  {space.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Call type:</span>
            <select
              value={selectedCallType}
              onChange={(e) => handleCallTypeChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="company_call">Company Call</option>
              <option value="candidate_call">Candidate Call</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {filteredCalls.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-3">
              <svg className="w-8 h-8 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">No calls match the current filters</p>
            <p className="text-xs text-gray-500">Try adjusting your filter criteria</p>
          </div>
        ) : (
            <div className="space-y-3">
              {filteredCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCallTypeColor(call.mode)}`}>
                        {getCallTypeDisplayText(call.mode)}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {getCallDisplayText(call)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Created: {formatDate(call.date_created)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleCallClick(call)}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Open Session
                    </Button>
                  </div>
                </div>
              ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}