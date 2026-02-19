"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import SpaceSelector from "./SpaceSelector";
import { Loader2, Upload } from "lucide-react";
import { EXTERNAL } from "@/constant";
import { getUserProfile, getAuthHeaders } from "@/lib/utils";

type CandidateSerpRequest = {
  id: number;
  space: number;
  limit: number;
  period: string;
  mode: string;
  category: string;
  date_created: string | null;
};

export default function OrbitPulseDashboard() {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [limit, setLimit] = useState<string>("100");
  const [period, setPeriod] = useState<string>("7d");
  const [mode, setMode] = useState<string>("data");
  const [category, setCategory] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<CandidateSerpRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const fetchRequests = async (spaceId: string) => {
    setIsLoadingRequests(true);
    try {
      const user = await getUserProfile(EXTERNAL.directus_url);
      const authHeaders = getAuthHeaders(user);
      const response = await fetch(
        `${EXTERNAL.directus_url}/items/candidate_serp_request?filter[space][_eq]=${spaceId}&sort=-date_created&limit=50`,
        {
          credentials: "include",
          headers: { ...authHeaders },
        }
      );
      if (response.ok) {
        const json = await response.json();
        setRequests(json.data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch serp requests", err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleSpaceChange = (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
    setRequests([]);
    if (spaceId) {
      fetchRequests(spaceId);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSpaceId) return;
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum <= 0) {
      alert("Please enter a valid limit");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await getUserProfile(EXTERNAL.directus_url);
      const authHeaders = getAuthHeaders(user);
      const response = await fetch(
        `${EXTERNAL.directus_url}/items/candidate_serp_request`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            space: parseInt(selectedSpaceId),
            limit: limitNum,
            period,
            mode,
            category,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      await fetchRequests(selectedSpaceId);
    } catch (err) {
      console.error("Failed to create serp request", err);
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orbit Pulse</h1>
          <p className="text-muted-foreground mt-2">
            Request candidate SERP scans and track career movement signals
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/experiment/orbit-pulse/upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Candidates
          </a>
        </Button>
      </div>

      {/* Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>New SERP Request</CardTitle>
          <CardDescription>
            Send a scan request to collect candidate SERP data for your space
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Space</Label>
            <SpaceSelector
              onSpaceChange={handleSpaceChange}
              selectedSpaceId={selectedSpaceId}
              requireWriteAccess={true}
              variant="default"
              label="Workspace"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="period">Period</Label>
              <Input
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="7d"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="mode">Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger id="mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data">data</SelectItem>
                  <SelectItem value="event">event</SelectItem>
                  <SelectItem value="signal">signal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all</SelectItem>
                  <SelectItem value="missing_subtitle">missing_subtitle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} disabled={!selectedSpaceId || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                "Send Request"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      {selectedSpaceId && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>SERP scan requests for the selected space</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRequests ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading requests...
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No requests found for this space.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Limit</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-sm">{req.id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{req.mode}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{req.category}</Badge>
                        </TableCell>
                        <TableCell>{req.limit}</TableCell>
                        <TableCell>{req.period}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {req.date_created
                            ? new Date(req.date_created).toLocaleString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
