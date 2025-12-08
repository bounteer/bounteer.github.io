"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getUserSpaces, getUserProfile, createSpace, addUserToSpace, updateSpace, getSpaceCounts, getJobDescriptionsBySpace, getCandidateProfilesBySpace, type Space, type JobDescription, type CandidateProfile } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

interface SpaceEditProps {
  spaceId?: string;
}

export default function SpaceEdit({ spaceId }: SpaceEditProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  // Form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState("");
  const [editingSpaceDescription, setEditingSpaceDescription] = useState("");

  // New space creation state
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDescription, setNewSpaceDescription] = useState("");
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);

  // Table view state
  const [tableView, setTableView] = useState<'job_descriptions' | 'candidate_profiles'>('job_descriptions');
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [candidateProfiles, setCandidateProfiles] = useState<CandidateProfile[]>([]);
  const [loadingTable, setLoadingTable] = useState(false);

  // Mock member data for UI placeholder
  const mockMembers = [
    {
      id: "1",
      email: "john.doe@company.com",
      name: "John Doe",
      role: "Admin",
      status: "Active",
      joinedAt: "2024-01-15"
    },
    {
      id: "2", 
      email: "jane.smith@company.com",
      name: "Jane Smith",
      role: "Member",
      status: "Active",
      joinedAt: "2024-02-01"
    },
    {
      id: "3",
      email: "bob.wilson@company.com", 
      name: "Bob Wilson",
      role: "Member",
      status: "Pending",
      joinedAt: "2024-12-06"
    }
  ];

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const result = await getUserSpaces(EXTERNAL.directus_url);

      if (result.success && result.spaces) {
        // Fetch counts for each space
        const spacesWithCounts = await Promise.all(
          result.spaces.map(async (space) => {
            const counts = await getSpaceCounts(space.id, EXTERNAL.directus_url);
            return {
              ...space,
              job_description_count: counts.job_description_count || 0,
              candidate_profile_count: counts.candidate_profile_count || 0,
              user_count: counts.user_count || 0
            };
          })
        );

        setSpaces(spacesWithCounts);

        // If spaceId provided, select that space
        if (spaceId) {
          const space = spacesWithCounts.find(s => s.id.toString() === spaceId);
          if (space) {
            setSelectedSpace(space);
            // Fetch table data for the selected space
            fetchTableData(space.id);
          }
        } else if (spacesWithCounts.length > 0) {
          // Default to first space
          setSelectedSpace(spacesWithCounts[0]);
          // Fetch table data for the first space
          fetchTableData(spacesWithCounts[0].id);
        }
      } else {
        setError(result.error || "Failed to fetch spaces");
      }
    } catch (err) {
      console.error('Error fetching spaces:', err);
      setError("An error occurred while fetching spaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [spaceId]);

  const fetchTableData = async (spaceId: number) => {
    setLoadingTable(true);
    try {
      const [jdResult, cpResult] = await Promise.all([
        getJobDescriptionsBySpace(spaceId, EXTERNAL.directus_url),
        getCandidateProfilesBySpace(spaceId, EXTERNAL.directus_url)
      ]);

      if (jdResult.success && jdResult.jobDescriptions) {
        setJobDescriptions(jdResult.jobDescriptions);
      }

      if (cpResult.success && cpResult.candidateProfiles) {
        setCandidateProfiles(cpResult.candidateProfiles);
      }
    } catch (err) {
      console.error('Error fetching table data:', err);
    } finally {
      setLoadingTable(false);
    }
  };

  const handleSpaceSelect = (space: Space) => {
    setSelectedSpace(space);
    // Cancel any ongoing edits when selecting a different space
    setEditingSpaceId(null);
    // Fetch table data for the selected space
    fetchTableData(space.id);
  };

  const handleEditSpace = (space: Space) => {
    setEditingSpaceId(space.id);
    setEditingSpaceName(space.name);
    setEditingSpaceDescription(space.description || "");
  };

  const handleCancelEdit = () => {
    setEditingSpaceId(null);
    setEditingSpaceName("");
    setEditingSpaceDescription("");
  };

  const handleSaveSpace = async (spaceId: number) => {
    if (!editingSpaceName.trim()) return;
    
    setSaving(true);
    try {
      // Update space via API
      const result = await updateSpace(spaceId, editingSpaceName, EXTERNAL.directus_url, editingSpaceDescription);
      
      if (!result.success || !result.space) {
        setError(result.error || "Failed to save space changes");
        return;
      }
      
      // Update local state with the response from API
      const updatedSpaces = spaces.map(s => 
        s.id === spaceId ? result.space! : s
      );
      setSpaces(updatedSpaces);
      
      // Update selected space if it's the one being edited
      if (selectedSpace?.id === spaceId) {
        setSelectedSpace(result.space);
      }
      
      // Exit edit mode
      setEditingSpaceId(null);
      setEditingSpaceName("");
      setEditingSpaceDescription("");
      
    } catch (err) {
      console.error('Error saving space:', err);
      setError("Failed to save space changes");
    } finally {
      setSaving(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;
    
    try {
      // TODO: Implement actual API call to invite member
      console.log("Inviting member:", inviteEmail, "to space:", selectedSpace?.id);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setInviteEmail("");
      // Show success message or update member list
      
    } catch (err) {
      console.error('Error inviting member:', err);
      setError("Failed to send invitation");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      // TODO: Implement actual API call to remove member
      console.log("Removing member:", memberId, "from space:", selectedSpace?.id);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.error('Error removing member:', err);
      setError("Failed to remove member");
    }
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    
    setIsCreatingSpace(true);
    try {
      // Create the space
      const spaceResult = await createSpace(newSpaceName, EXTERNAL.directus_url, newSpaceDescription);
      
      if (!spaceResult.success || !spaceResult.space) {
        setError(spaceResult.error || "Failed to create space");
        return;
      }

      // Get current user
      const user = await getUserProfile(EXTERNAL.directus_url);
      if (!user) {
        setError("User not authenticated");
        return;
      }

      // Add current user to the space as admin
      const spaceUserResult = await addUserToSpace(
        spaceResult.space.id, 
        user.id, 
        'admin', 
        EXTERNAL.directus_url
      );
      
      if (!spaceUserResult.success) {
        console.warn("Space created but failed to add user:", spaceUserResult.error);
        // Continue anyway since space was created
      }

      // Add to spaces list and select it
      const updatedSpaces = [...spaces, spaceResult.space];
      setSpaces(updatedSpaces);
      setSelectedSpace(spaceResult.space);
      
      // Reset new space form
      setNewSpaceName("");
      setNewSpaceDescription("");
      
    } catch (err) {
      console.error('Error creating space:', err);
      setError("Failed to create new space");
    } finally {
      setIsCreatingSpace(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-600">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading spaces...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="text-red-600 mb-2">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{error}</p>
            <Button onClick={fetchSpaces} variant="outline" size="sm" className="mt-3">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (spaces.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Space Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <div className="mb-3">
              <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-600">No spaces found</p>
            <p className="text-sm text-gray-500">Create a space to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Space Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Space to Edit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Existing Spaces */}
            {spaces.map((space) => (
              <div
                key={space.id}
                className={`p-4 border rounded-lg transition-colors ${
                  selectedSpace?.id === space.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {editingSpaceId === space.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <Input
                      value={editingSpaceName}
                      onChange={(e) => setEditingSpaceName(e.target.value)}
                      placeholder="Space name"
                      className="text-sm font-medium"
                    />
                    <Input
                      value={editingSpaceDescription}
                      onChange={(e) => setEditingSpaceDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSaveSpace(space.id)}
                        disabled={!editingSpaceName.trim() || saving}
                        size="sm"
                        className="flex-1"
                      >
                        {saving ? (
                          <>
                            <svg className="w-3 h-3 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Saving...
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1" onClick={() => handleSpaceSelect(space)} style={{ cursor: 'pointer' }}>
                        <h4 className="font-medium text-gray-900">{space.name}</h4>
                        {space.description && (
                          <p className="text-sm text-gray-500 mt-1">{space.description}</p>
                        )}
                        {/* Space counts */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>{space.job_description_count || 0} Job{space.job_description_count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{space.candidate_profile_count || 0} Candidate{space.candidate_profile_count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>{space.user_count || 0} User{space.user_count !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSpace(space);
                        }}
                        variant="ghost"
                        size="sm"
                        className="ml-2 p-1 h-auto text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Create New Space Card */}
            <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <h4 className="font-medium text-gray-700">Create New Space</h4>
                </div>
                
                <div>
                  <Input
                    placeholder="Space name"
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    className="text-sm"
                  />
                </div>
                
                <div>
                  <Input
                    placeholder="Description (optional)"
                    value={newSpaceDescription}
                    onChange={(e) => setNewSpaceDescription(e.target.value)}
                    className="text-sm"
                  />
                </div>
                
                <Button
                  onClick={handleCreateSpace}
                  disabled={!newSpaceName.trim() || isCreatingSpace}
                  size="sm"
                  className="w-full"
                >
                  {isCreatingSpace ? (
                    <>
                      <svg className="w-4 h-4 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    "Create Space"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Space Data Table */}
      {selectedSpace && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Space Data</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => setTableView('job_descriptions')}
                  variant={tableView === 'job_descriptions' ? 'default' : 'outline'}
                  size="sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Job Descriptions ({jobDescriptions.length})
                </Button>
                <Button
                  onClick={() => setTableView('candidate_profiles')}
                  variant={tableView === 'candidate_profiles' ? 'default' : 'outline'}
                  size="sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Candidate Profiles ({candidateProfiles.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTable ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading data...
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {tableView === 'job_descriptions' && (
                  <>
                    {jobDescriptions.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-600">No job descriptions found</p>
                        <p className="text-sm text-gray-500">Job descriptions will appear here once added to this space</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-700">ID</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Title</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Company</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Location</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobDescriptions.map((jd) => (
                            <tr key={jd.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4 text-gray-600">#{jd.id}</td>
                              <td className="py-3 px-4">
                                <a 
                                  href={`http://localhost:4321/role-fit-index/job-description?id=${jd.id}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {jd.role_name || jd.title || 'Untitled'}
                                </a>
                              </td>
                              <td className="py-3 px-4 text-gray-600">{jd.company_name || jd.company || '-'}</td>
                              <td className="py-3 px-4 text-gray-600">{jd.location || '-'}</td>
                              <td className="py-3 px-4 text-gray-600">
                                {jd.date_created ? new Date(jd.date_created).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                {tableView === 'candidate_profiles' && (
                  <>
                    {candidateProfiles.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-600">No candidate profiles found</p>
                        <p className="text-sm text-gray-500">Candidate profiles will appear here once added to this space</p>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-700">ID</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidateProfiles.map((cp) => (
                            <tr key={cp.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4 text-gray-600">#{cp.id}</td>
                              <td className="py-3 px-4 text-gray-900">{cp.name || 'Unknown'}</td>
                              <td className="py-3 px-4 text-gray-600">{cp.email || '-'}</td>
                              <td className="py-3 px-4 text-gray-600">{cp.phone || '-'}</td>
                              <td className="py-3 px-4 text-gray-600">
                                {cp.date_created ? new Date(cp.date_created).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Member Management */}
      {selectedSpace && (
        <Card>
          <CardHeader>
            <CardTitle>Manage Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invite New Member */}
            <div>
              <Label htmlFor="inviteEmail">Invite New Member</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1"
                />
                <Button
                  onClick={handleInviteMember}
                  disabled={!inviteEmail.trim()}
                >
                  Send Invite
                </Button>
              </div>
            </div>

            <Separator />

            {/* Member List */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Current Members</h4>
              <div className="space-y-3">
                {mockMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        member.status === "Active" 
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {member.status}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        member.role === "Admin"
                          ? "bg-blue-100 text-blue-700" 
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {member.role}
                      </span>
                      {member.role !== "Admin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Placeholder for future features */}
            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Additional Settings</h4>
              
              {/* Permission Settings Placeholder */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h5 className="font-medium text-gray-700 mb-2">Permission Settings</h5>
                <p className="text-sm text-gray-500 mb-3">Configure member permissions and access levels</p>
                <Button variant="outline" disabled className="opacity-50">
                  Configure Permissions (Coming Soon)
                </Button>
              </div>

              {/* Space Analytics Placeholder */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h5 className="font-medium text-gray-700 mb-2">Space Analytics</h5>
                <p className="text-sm text-gray-500 mb-3">View usage statistics and member activity</p>
                <Button variant="outline" disabled className="opacity-50">
                  View Analytics (Coming Soon)
                </Button>
              </div>

              {/* Integration Settings Placeholder */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h5 className="font-medium text-gray-700 mb-2">Integrations</h5>
                <p className="text-sm text-gray-500 mb-3">Connect with Slack, Microsoft Teams, and other tools</p>
                <Button variant="outline" disabled className="opacity-50">
                  Manage Integrations (Coming Soon)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}