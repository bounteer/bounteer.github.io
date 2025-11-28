"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchOrbitCandidateSearchRequests, type OrbitCandidateSearchRequest } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

interface SearchRequestHistoryProps {
  sessionId: string | null;
  onRequestSelect?: (request: OrbitCandidateSearchRequest) => void;
  currentRequestId?: string;
}

export default function SearchRequestHistory({ 
  sessionId, 
  onRequestSelect,
  currentRequestId 
}: SearchRequestHistoryProps) {
  const [requests, setRequests] = useState<OrbitCandidateSearchRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Load search request history when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadSearchRequests();
    } else {
      setRequests([]);
    }
  }, [sessionId]);

  const loadSearchRequests = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await fetchOrbitCandidateSearchRequests(sessionId, EXTERNAL.directus_url);
      
      if (result.success && result.requests) {
        // Store in deque-like structure (most recent first, limit to 10)
        const sortedRequests = result.requests
          .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
          .slice(0, 10);
        
        setRequests(sortedRequests);
        console.log("Loaded search request history:", sortedRequests);
      } else {
        setError(result.error || "Failed to load search request history");
      }
    } catch (err) {
      console.error("Error loading search requests:", err);
      setError("An unexpected error occurred while loading search history");
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new request to the deque (called when a new search is initiated)
  const addRequestToHistory = (newRequest: OrbitCandidateSearchRequest) => {
    setRequests(prev => {
      // Add to front, remove oldest if we exceed 10
      const updated = [newRequest, ...prev.filter(r => r.id !== newRequest.id)];
      return updated.slice(0, 10);
    });
  };

  // Update request status in the deque
  const updateRequestStatus = (requestId: string, status: string) => {
    setRequests(prev => prev.map(req => 
      req.id === requestId ? { ...req, status: status as any } : req
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'listed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Unknown time';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return 'Invalid time';
    }
  };

  const getJobSummary = (jobSnapshot: any) => {
    if (!jobSnapshot) return "No job details";
    const role = jobSnapshot.role_name || "Unknown Role";
    const company = jobSnapshot.company_name || "Unknown Company";
    return `${role} at ${company}`;
  };

  // Expose methods for parent components to use
  useEffect(() => {
    // Attach methods to a global reference if needed
    (window as any).__searchRequestHistory = {
      addRequestToHistory,
      updateRequestStatus,
      refreshHistory: loadSearchRequests
    };
  }, []);

  if (!sessionId) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Search Request History</CardTitle>
          <Button 
            onClick={loadSearchRequests} 
            size="sm" 
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm">Loading search history...</p>
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No search requests found for this session.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {requests.map((request, index) => (
              <div
                key={request.id || index}
                className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                  currentRequestId === request.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                }`}
                onClick={() => onRequestSelect?.(request)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 truncate">
                      {getJobSummary(request.job_description_snapshot)}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {formatTimestamp(request.created_at)}
                    </p>
                  </div>
                  <Badge className={`text-xs ${getStatusColor(request.status || 'pending')}`}>
                    {request.status || 'pending'}
                  </Badge>
                </div>
                
                {request.job_description_snapshot?.skill && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(Array.isArray(request.job_description_snapshot.skill) 
                      ? request.job_description_snapshot.skill 
                      : request.job_description_snapshot.skill.split(',')
                    ).slice(0, 3).map((skill: string, skillIndex: number) => (
                      <span key={skillIndex} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {skill.trim()}
                      </span>
                    ))}
                    {(Array.isArray(request.job_description_snapshot.skill) 
                      ? request.job_description_snapshot.skill.length 
                      : request.job_description_snapshot.skill.split(',').length
                    ) > 3 && (
                      <span className="text-xs text-gray-500 px-2 py-1">
                        +{(Array.isArray(request.job_description_snapshot.skill) 
                          ? request.job_description_snapshot.skill.length 
                          : request.job_description_snapshot.skill.split(',').length
                        ) - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}