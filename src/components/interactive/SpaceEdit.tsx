"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getUserSpaces, getUserProfile, createSpace, addUserToSpace, updateSpace, getSpaceCounts, getJobDescriptionsBySpace, getCandidateProfilesBySpace, getUserPermissionInSpace, searchUserByEmail, getSpaceUsers, updateUserPermissionInSpace, deleteSpace, type Space, type JobDescription, type CandidateProfile, type SpaceUserDetail } from "@/lib/utils";
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
  
  // User permission state
  const [currentUserPermission, setCurrentUserPermission] = useState<string | null>(null);
  const [loadingPermission, setLoadingPermission] = useState(false);
  const [spacePermissions, setSpacePermissions] = useState<{ [spaceId: number]: string }>({});

  // Add user state
  const [searchEmail, setSearchEmail] = useState("");
  const [searchingUser, setSearchingUser] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchSuccess, setSearchSuccess] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);

  // Space users state
  const [spaceUsers, setSpaceUsers] = useState<SpaceUserDetail[]>([]);
  const [loadingSpaceUsers, setLoadingSpaceUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [updatingPermission, setUpdatingPermission] = useState(false);

  // Delete space state
  const [deletingSpace, setDeletingSpace] = useState(false);
  const [spaceToDelete, setSpaceToDelete] = useState<Space | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const result = await getUserSpaces(EXTERNAL.directus_url);

      if (result.success && result.spaces) {
        // Fetch counts and permissions for each space
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

        // Fetch permissions for all spaces
        const permissionsMap: { [spaceId: number]: string } = {};
        await Promise.all(
          spacesWithCounts.map(async (space) => {
            const permissionResult = await getUserPermissionInSpace(space.id, EXTERNAL.directus_url);
            if (permissionResult.success && permissionResult.permission) {
              permissionsMap[space.id] = permissionResult.permission;
            }
          })
        );
        setSpacePermissions(permissionsMap);

        setSpaces(spacesWithCounts);

        // If spaceId provided, select that space
        if (spaceId) {
          const space = spacesWithCounts.find(s => s.id.toString() === spaceId);
          if (space) {
            setSelectedSpace(space);
            // Fetch table data, user permission, and space users for the selected space
            fetchTableData(space.id);
            fetchUserPermission(space.id);
            fetchSpaceUsers(space.id);
          }
        } else if (spacesWithCounts.length > 0) {
          // Default to first space
          setSelectedSpace(spacesWithCounts[0]);
          // Fetch table data, user permission, and space users for the first space
          fetchTableData(spacesWithCounts[0].id);
          fetchUserPermission(spacesWithCounts[0].id);
          fetchSpaceUsers(spacesWithCounts[0].id);
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

  const fetchUserPermission = async (spaceId: number) => {
    setLoadingPermission(true);
    try {
      const permissionResult = await getUserPermissionInSpace(spaceId, EXTERNAL.directus_url);
      if (permissionResult.success) {
        setCurrentUserPermission(permissionResult.permission || null);
      }
    } catch (err) {
      console.error('Error fetching user permission:', err);
    } finally {
      setLoadingPermission(false);
    }
  };

  const fetchSpaceUsers = async (spaceId: number) => {
    setLoadingSpaceUsers(true);
    try {
      const result = await getSpaceUsers(spaceId, EXTERNAL.directus_url);
      if (result.success && result.users) {
        setSpaceUsers(result.users);
      }
    } catch (err) {
      console.error('Error fetching space users:', err);
    } finally {
      setLoadingSpaceUsers(false);
    }
  };

  // Permission hierarchy: admin, readwritedelete, and readwritedeleteadmin have full access
  const hasAdminPermissions = () => {
    const adminPermissions = ['admin', 'readwritedelete', 'readwritedeleteadmin'];
    return adminPermissions.includes(currentUserPermission || '');
  };

  // Helper function to parse permissions into individual capabilities
  const getPermissionCapabilities = (permission: string | null) => {
    if (!permission) return [];
    
    // Handle special combined permissions for new spaces
    if (permission === 'readwritedeleteadmin') {
      return ['Read', 'Write', 'Delete', 'Admin'];
    }
    
    const capabilities = [];
    if (permission.includes('read')) capabilities.push('Read');
    if (permission.includes('write')) capabilities.push('Write');
    if (permission.includes('delete')) capabilities.push('Delete');
    
    // Handle special cases
    if (permission === 'admin') return ['Admin'];
    
    return capabilities;
  };

  // Helper function to get user-friendly permission display
  const getPermissionDisplayName = (permission: string | null) => {
    const capabilities = getPermissionCapabilities(permission);
    return capabilities.length > 0 ? capabilities.join(' • ') : 'Unknown';
  };

  const handleSpaceSelect = (space: Space) => {
    setSelectedSpace(space);
    // Cancel any ongoing edits when selecting a different space
    setEditingSpaceId(null);
    setEditingUserId(null);
    // Fetch table data, user permission, and space users for the selected space
    fetchTableData(space.id);
    fetchUserPermission(space.id);
    fetchSpaceUsers(space.id);
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

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) return;

    setSearchingUser(true);
    setSearchError("");
    setSearchSuccess("");
    setFoundUser(null);

    try {
      const result = await searchUserByEmail(searchEmail.trim(), EXTERNAL.directus_url);

      if (!result.success || !result.user) {
        setSearchError(result.error || "User does not exist");
        return;
      }

      setFoundUser(result.user);
      setSearchSuccess(`Found user: ${result.user.first_name || ''} ${result.user.last_name || ''} (${result.user.email})`);
    } catch (err) {
      console.error('Error searching user:', err);
      setSearchError("Failed to search for user");
    } finally {
      setSearchingUser(false);
    }
  };

  const handleAddUserToSpace = async () => {
    if (!foundUser || !selectedSpace) return;

    setAddingUser(true);
    setSearchError("");

    try {
      const result = await addUserToSpace(
        selectedSpace.id,
        foundUser.id,
        EXTERNAL.directus_url
      );

      if (!result.success) {
        setSearchError(result.error || "Failed to add user to space");
        return;
      }

      setSearchSuccess(`Successfully added ${foundUser.first_name || ''} ${foundUser.last_name || ''} to the space!`);
      setSearchEmail("");
      setFoundUser(null);

      // Refresh spaces to update user count and space users list
      await fetchSpaces();
      if (selectedSpace) {
        await fetchSpaceUsers(selectedSpace.id);
      }
    } catch (err) {
      console.error('Error adding user to space:', err);
      setSearchError("Failed to add user to space");
    } finally {
      setAddingUser(false);
    }
  };

  const handleUpdateUserPermission = async (spaceUserId: number, permissions: string[]) => {
    // Check if we're removing admin permission
    const currentUser = spaceUsers.find(u => u.id === spaceUserId);
    const removingAdmin = currentUser?.permission.includes('admin') && !permissions.includes('admin');

    if (removingAdmin) {
      // Count how many admins are in the space
      const adminCount = spaceUsers.filter(u => u.permission.includes('admin')).length;

      if (adminCount <= 1) {
        setError("Cannot remove admin permission. Space must have at least one admin.");
        return;
      }
    }

    setUpdatingPermission(true);
    try {
      const result = await updateUserPermissionInSpace(spaceUserId, permissions, EXTERNAL.directus_url);

      if (!result.success) {
        setError(result.error || "Failed to update user permission");
        return;
      }

      // Refresh space users list
      if (selectedSpace) {
        await fetchSpaceUsers(selectedSpace.id);
        await fetchSpaces(); // Also refresh to update user counts
      }

      setEditingUserId(null);
    } catch (err) {
      console.error('Error updating user permission:', err);
      setError("Failed to update user permission");
    } finally {
      setUpdatingPermission(false);
    }
  };

  const handleDeleteSpace = async () => {
    if (!spaceToDelete) return;

    // Verify the user typed the correct confirmation text
    if (deleteConfirmationText !== spaceToDelete.name) {
      setError("Space name doesn't match. Deletion cancelled.");
      return;
    }

    setDeletingSpace(true);
    try {
      const result = await deleteSpace(spaceToDelete.id, EXTERNAL.directus_url);

      if (!result.success) {
        setError(result.error || "Failed to delete space");
        return;
      }

      // Clear deletion state
      setSpaceToDelete(null);
      setDeleteConfirmationText("");

      // If we deleted the currently selected space, clear selection
      if (selectedSpace?.id === spaceToDelete.id) {
        setSelectedSpace(null);
      }

      // Refresh spaces list
      await fetchSpaces();
    } catch (err) {
      console.error('Error deleting space:', err);
      setError("Failed to delete space");
    } finally {
      setDeletingSpace(false);
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

      console.log("Creating space-user relationship:", {
        spaceId: spaceResult.space.id,
        userId: user.id,
        permission: ["read", "write", "delete", "admin"]
      });

      // Add current user to the space as admin
      const spaceUserResult = await addUserToSpace(
        spaceResult.space.id,
        user.id,
        EXTERNAL.directus_url
      );
      
      if (!spaceUserResult.success) {
        console.error("Failed to add user to space:", spaceUserResult.error);
        setError(`Space created but failed to set user permissions: ${spaceUserResult.error}`);
        // Don't continue since this is critical for space functionality
        return;
      }

      // Add permissions to the map for immediate display
      const newPermissionsMap = {
        ...spacePermissions,
        [spaceResult.space.id]: 'readwritedeleteadmin'
      };
      setSpacePermissions(newPermissionsMap);

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
                        
                        {/* Permission badges */}
                        <div className="flex items-center gap-1 mt-3">
                          <span className="text-xs text-gray-500 mr-1">Your access:</span>
                          {spacePermissions[space.id] ? (
                            getPermissionCapabilities(spacePermissions[space.id]).map((capability, index) => (
                              <span 
                                key={index}
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  capability === 'Read' ? 'bg-green-100 text-green-600' :
                                  capability === 'Write' ? 'bg-blue-100 text-blue-600' :
                                  capability === 'Delete' ? 'bg-red-100 text-red-600' :
                                  'bg-purple-100 text-purple-600'
                                }`}
                              >
                                {capability}
                              </span>
                            ))
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                              Loading...
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSpace(space);
                          }}
                          variant="ghost"
                          size="sm"
                          className="p-1 h-auto text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                        {/* Only show delete button if user has admin permissions for this space */}
                        {spacePermissions[space.id]?.includes('admin') && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSpaceToDelete(space);
                            }}
                            variant="ghost"
                            size="sm"
                            className="p-1 h-auto text-red-400 hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        )}
                      </div>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Space Data</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => setTableView('job_descriptions')}
                  variant={tableView === 'job_descriptions' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Job Descriptions ({jobDescriptions.length})</span>
                  <span className="sm:hidden">Jobs ({jobDescriptions.length})</span>
                </Button>
                <Button
                  onClick={() => setTableView('candidate_profiles')}
                  variant={tableView === 'candidate_profiles' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="hidden sm:inline">Candidate Profiles ({candidateProfiles.length})</span>
                  <span className="sm:hidden">Candidates ({candidateProfiles.length})</span>
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
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700">ID</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700">Title</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700 hidden sm:table-cell">Company</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700 hidden md:table-cell">Location</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700 hidden lg:table-cell">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobDescriptions.map((jd) => (
                            <tr key={jd.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm">#{jd.id}</td>
                              <td className="py-2 px-2 md:py-3 md:px-4">
                                <a
                                  href={`/role-fit-index/job-description?id=${jd.id}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs md:text-sm line-clamp-2"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {jd.role_name || jd.title || 'Untitled'}
                                </a>
                              </td>
                              <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm hidden sm:table-cell">{jd.company_name || jd.company || '-'}</td>
                              <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm hidden md:table-cell">{jd.location || '-'}</td>
                              <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm hidden lg:table-cell">
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
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700">ID</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700">Name</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700 hidden sm:table-cell">Email</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700 hidden md:table-cell">Phone</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700 hidden lg:table-cell">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidateProfiles.map((cp) => (
                            <tr key={cp.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm">#{cp.id}</td>
                              <td className="py-2 px-2 md:py-3 md:px-4">
                                <a
                                  href={`/role-fit-index/candidate-profile?id=${cp.id}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs md:text-sm"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {cp.name || 'Unknown'}
                                </a>
                              </td>
                              <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm hidden sm:table-cell">{cp.email || '-'}</td>
                              <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm hidden md:table-cell">{cp.phone || '-'}</td>
                              <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm hidden lg:table-cell">
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

      {/* Admin Dashboard - Only visible to admins */}
      {selectedSpace && hasAdminPermissions() && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <CardTitle>Admin Dashboard</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Admin Welcome Section */}
              <div className="p-3 md:p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-purple-100 rounded-full flex-shrink-0">
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">Administrator Access</h3>
                    <p className="text-xs md:text-sm text-gray-600">You have full administrative permissions for this space. You can manage settings, view analytics, and control access.</p>
                  </div>
                </div>
              </div>

              {/* Add User to Space Section */}
              <div className="p-4 md:p-6 border-2 border-green-200 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-green-100 rounded-full">
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm md:text-base">Add User to Space</h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">Search for a user by email and add them to this space.</p>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter user email"
                      value={searchEmail}
                      onChange={(e) => {
                        setSearchEmail(e.target.value);
                        setSearchError("");
                        setSearchSuccess("");
                        setFoundUser(null);
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchUser();
                        }
                      }}
                      className="flex-1"
                      disabled={searchingUser || addingUser}
                    />
                    <Button
                      onClick={handleSearchUser}
                      disabled={!searchEmail.trim() || searchingUser || addingUser}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {searchingUser ? (
                        <>
                          <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Searching...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Search
                        </>
                      )}
                    </Button>
                  </div>

                  {searchError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-700">{searchError}</p>
                    </div>
                  )}

                  {searchSuccess && !foundUser && (
                    <div className="p-3 bg-green-100 border border-green-200 rounded-lg flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-700">{searchSuccess}</p>
                    </div>
                  )}

                  {foundUser && (
                    <div className="p-4 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-white">
                              {foundUser.first_name?.[0] || foundUser.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {foundUser.first_name || foundUser.last_name
                                ? `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim()
                                : 'No name set'}
                            </p>
                            <p className="text-sm text-gray-500">{foundUser.email}</p>
                          </div>
                        </div>
                        <Button
                          onClick={handleAddUserToSpace}
                          disabled={addingUser}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {addingUser ? (
                            <>
                              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Adding...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Add to Space
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {/* Space Settings */}
                <div className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-colors">
                  <div className="flex items-start gap-2 md:gap-3">
                    <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg flex-shrink-0">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1 text-sm md:text-base">Space Settings</h4>
                      <p className="text-xs md:text-sm text-gray-500 mb-2 md:mb-3">Configure space preferences, visibility, and general settings</p>
                      <Button variant="outline" size="sm" className="w-full text-xs md:text-sm" disabled>
                        Manage Settings
                      </Button>
                    </div>
                  </div>
                </div>

                {/* User Permissions */}
                <div className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-colors">
                  <div className="flex items-start gap-2 md:gap-3">
                    <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-green-100 rounded-lg flex-shrink-0">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1 text-sm md:text-base">User Permissions</h4>
                      <p className="text-xs md:text-sm text-gray-500 mb-2 md:mb-3">Manage user roles, access levels, and permissions</p>
                      <Button variant="outline" size="sm" className="w-full text-xs md:text-sm" disabled>
                        Manage Permissions
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Space Analytics */}
                <div className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-colors">
                  <div className="flex items-start gap-2 md:gap-3">
                    <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-amber-100 rounded-lg flex-shrink-0">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1 text-sm md:text-base">Analytics & Reports</h4>
                      <p className="text-xs md:text-sm text-gray-500 mb-2 md:mb-3">View usage statistics, activity logs, and insights</p>
                      <Button variant="outline" size="sm" className="w-full text-xs md:text-sm" disabled>
                        View Analytics
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Integrations */}
                <div className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50/50 transition-colors">
                  <div className="flex items-start gap-2 md:gap-3">
                    <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-indigo-100 rounded-lg flex-shrink-0">
                      <svg className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1 text-sm md:text-base">Integrations</h4>
                      <p className="text-xs md:text-sm text-gray-500 mb-2 md:mb-3">Connect with external tools and services</p>
                      <Button variant="outline" size="sm" className="w-full text-xs md:text-sm" disabled>
                        Manage Integrations
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-3">Quick Stats</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center p-3 bg-white rounded-lg sm:bg-transparent sm:p-0">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedSpace.job_description_count || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">Job Descriptions</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg sm:bg-transparent sm:p-0">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedSpace.candidate_profile_count || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">Candidates</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg sm:bg-transparent sm:p-0">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedSpace.user_count || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">Team Members</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Space Users Table - Always visible */}
      {selectedSpace && (
        <Card>
          <CardHeader>
            <CardTitle>Space Members</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSpaceUsers ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading members...
                </div>
              </div>
            ) : spaceUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-600">No members found</p>
                <p className="text-sm text-gray-500">Add members to this space to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700">Member</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700 hidden sm:table-cell">Email</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700">Permissions</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700 hidden md:table-cell">Joined</th>
                      {hasAdminPermissions() && (
                        <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-700">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {spaceUsers.map((spaceUser) => (
                      <tr key={spaceUser.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 md:py-3 md:px-4">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-white">
                                {spaceUser.user.first_name?.[0] || spaceUser.user.email[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900 text-xs md:text-sm">
                                {spaceUser.user.first_name || spaceUser.user.last_name
                                  ? `${spaceUser.user.first_name || ''} ${spaceUser.user.last_name || ''}`.trim()
                                  : 'No name set'}
                              </span>
                              <span className="text-xs text-gray-500 sm:hidden">{spaceUser.user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm hidden sm:table-cell">{spaceUser.user.email}</td>
                        <td className="py-2 px-2 md:py-3 md:px-4">
                          {editingUserId === spaceUser.id && hasAdminPermissions() ? (
                            <div className="flex items-center gap-2">
                              <div className="flex flex-wrap gap-1">
                                {['read', 'write', 'delete', 'admin'].map((perm) => {
                                  // Check if this is the last admin trying to remove admin permission
                                  const adminCount = spaceUsers.filter(u => u.permission.includes('admin')).length;
                                  const isLastAdmin = perm === 'admin' && spaceUser.permission.includes('admin') && adminCount <= 1;
                                  const isLastPermission = spaceUser.permission.length === 1 && spaceUser.permission.includes(perm);
                                  const isDisabled = isLastAdmin || isLastPermission;

                                  return (
                                    <label
                                      key={perm}
                                      className={`flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 bg-gray-100 rounded text-xs ${
                                        isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-200'
                                      }`}
                                      title={isLastAdmin ? 'Space must have at least one admin' : isLastPermission ? 'User must have at least one permission' : ''}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={spaceUser.permission.includes(perm)}
                                        onChange={(e) => {
                                          const newPermissions = e.target.checked
                                            ? [...spaceUser.permission, perm]
                                            : spaceUser.permission.filter(p => p !== perm);

                                          // Ensure at least one permission is selected
                                          if (newPermissions.length === 0) {
                                            return; // Don't allow unchecking if it's the last permission
                                          }

                                          // Update locally for immediate feedback
                                          setSpaceUsers(users => users.map(u =>
                                            u.id === spaceUser.id ? { ...u, permission: newPermissions } : u
                                          ));
                                        }}
                                        className="w-3 h-3"
                                        disabled={isDisabled}
                                      />
                                      <span className="text-xs capitalize">{perm}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {spaceUser.permission.map((perm, idx) => (
                                <span
                                  key={idx}
                                  className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded-full ${
                                    perm === 'read' ? 'bg-green-100 text-green-700' :
                                    perm === 'write' ? 'bg-blue-100 text-blue-700' :
                                    perm === 'delete' ? 'bg-red-100 text-red-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 md:py-3 md:px-4 text-gray-600 text-xs md:text-sm hidden md:table-cell">
                          {spaceUser.date_created ? new Date(spaceUser.date_created).toLocaleDateString() : '-'}
                        </td>
                        {hasAdminPermissions() && (
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            {editingUserId === spaceUser.id ? (
                              <div className="flex flex-col gap-1 md:flex-row md:gap-2">
                                <Button
                                  onClick={() => handleUpdateUserPermission(spaceUser.id, spaceUser.permission)}
                                  disabled={updatingPermission}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1"
                                >
                                  {updatingPermission ? (
                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                  ) : (
                                    'Save'
                                  )}
                                </Button>
                                <Button
                                  onClick={() => {
                                    setEditingUserId(null);
                                    // Refresh to revert changes
                                    if (selectedSpace) {
                                      fetchSpaceUsers(selectedSpace.id);
                                    }
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs px-2 py-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                onClick={() => setEditingUserId(spaceUser.id)}
                                variant="ghost"
                                size="sm"
                                className="text-gray-600 hover:text-gray-900 p-1"
                              >
                                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Space Confirmation Dialog */}
      {spaceToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Space</h3>
                <p className="text-sm text-gray-600 mb-4">
                  You are about to permanently delete the space <strong>"{spaceToDelete.name}"</strong> and all its associated data, including:
                </p>
                <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
                  <li>{spaceToDelete.job_description_count || 0} job description{spaceToDelete.job_description_count !== 1 ? 's' : ''}</li>
                  <li>{spaceToDelete.candidate_profile_count || 0} candidate profile{spaceToDelete.candidate_profile_count !== 1 ? 's' : ''}</li>
                  <li>{spaceToDelete.user_count || 0} user relationship{spaceToDelete.user_count !== 1 ? 's' : ''}</li>
                </ul>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800 font-medium">
                    ⚠️ This action cannot be undone!
                  </p>
                </div>
                <div className="mb-4">
                  <Label htmlFor="deleteConfirmation" className="text-sm font-medium text-gray-700">
                    Type <span className="font-bold">"{spaceToDelete.name}"</span> to confirm:
                  </Label>
                  <Input
                    id="deleteConfirmation"
                    type="text"
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder="Enter space name"
                    className="mt-1"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleDeleteSpace}
                    disabled={deleteConfirmationText !== spaceToDelete.name || deletingSpace}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {deletingSpace ? (
                      <>
                        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      'Delete Space'
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setSpaceToDelete(null);
                      setDeleteConfirmationText("");
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={deletingSpace}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}