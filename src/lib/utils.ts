import { EXTERNAL } from "@/constant";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { GlowState } from "@/components/interactive/GlowCard";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Maps API status values to GlowCard glow states
 * @param status - The status from the API ('pending' | 'processing' | 'completed' | 'failed' | etc.)
 * @returns The corresponding glow state ('idle' | 'listening' | 'processing')
 * 
 * Usage example:
 * ```tsx
 * <GlowCard glowState={mapStatusToGlowState(request.status)} />
 * ```
 * 
 * Mapping:
 * - 'pending' → 'listening' (waiting for processing to start)
 * - 'processing' → 'processing' (actively being processed)
 * - 'completed', 'complete', 'finished', 'done', 'listed' → 'idle' (finished processing)
 * - all other values → 'idle' (default/fallback state)
 */
export function mapStatusToGlowState(status?: string): GlowState {
  if (!status) return "idle";
  
  switch (status) {
    case "pending":
      return "listening";
    case "processing":
      return "processing";
    case "completed":
    case "complete":
    case "finished":
    case "done":
    case "listed":
      return "idle";
    default:
      return "idle";
  }
}

export type UserProfile = {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  [key: string]: any;
}


export async function getUserProfile(directusUrl: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${directusUrl}/users/me`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json?.data ?? json;
  } catch {
    return null;
  }
}

export function getLoginUrl(directusUrl: string, provider: string = EXTERNAL.auth_idp_key, redirectPath: string = "/"): string {
  const currentUrl = typeof window !== "undefined" ? window.location.origin : "";
  const redirectUrl = `${currentUrl}?next=${encodeURIComponent(redirectPath)}`;
  return `${directusUrl}/auth/login/${provider}?redirect=${encodeURIComponent(redirectUrl)}`;
}

export async function logout(directusUrl: string): Promise<void> {
  try {
    const res = await fetch(`${directusUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "session" }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("Logout failed:", res.status, txt);
      return;
    }

    // reload to clear user data
    window.location.reload();

    // logout idp
    window.location.href = EXTERNAL.auth_idp_logput_url;
  } catch (e) {
    console.error("Logout error:", e);
  }
}

export function getUserDisplayName(user: UserProfile | null): string {
  if (!user) return "";
  const first = user.first_name?.trim();
  const last = user.last_name?.trim();
  return [first, last].filter(Boolean).join(" ") || user.email || "Account";
}

export function getUserInitials(name: string | null, email: string | null): string {
  const src = name || email || "";
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (src.includes("@")) return src[0]?.toUpperCase() || "?";
  return src.slice(0, 2).toUpperCase() || "?";
}

// Credit management types
export type Credits = {
  used: number;
  remaining: number;
}

export type BalanceRow = {
  id: number;
  user: string;
  quota_remaining: number;
  quota_used: number;
};

// Load guest credits from localStorage
export function _getGuestCredits(): Credits {
  if (typeof window === 'undefined') {
    // Server-side rendering, return default
    return { used: 0, remaining: 5 };
  }

  try {
    const storedCredits = localStorage.getItem('role-fit-index-credits');
    if (storedCredits) {
      const credits = JSON.parse(storedCredits);
      // Validate the structure
      if (typeof credits.used === 'number' && typeof credits.remaining === 'number') {
        return {
          used: Number(credits.used),
          remaining: Number(credits.remaining)
        };
      }
    }
  } catch {
    // Invalid stored credits, will set default below
  }

  // No stored credits or invalid format, assign default 5 credits
  const defaultCredits: Credits = { used: 0, remaining: 5 };
  localStorage.setItem('role-fit-index-credits', JSON.stringify(defaultCredits));
  return defaultCredits;
}

// Save guest credits to localStorage
export function _saveGuestCredits(credits: Credits): void {
  localStorage.setItem('role-fit-index-credits', JSON.stringify(credits));
}

// Consume one credit for guests
export function _consumeGuestCredit(): Credits {
  const currentCredits = _getGuestCredits();
  if (currentCredits.remaining > 0) {
    const updatedCredits = {
      used: currentCredits.used + 1,
      remaining: currentCredits.remaining - 1
    };
    _saveGuestCredits(updatedCredits);
    return updatedCredits;
  }
  return currentCredits;
}

// Fetch user credits from Directus for authenticated users
export async function _getUserCredits(userId: string, directusUrl: string): Promise<Credits | null> {
  try {
    const balUrl =
      `${directusUrl}/items/role_fit_index_balance` +
      `?filter[user][_eq]=${encodeURIComponent(userId)}` +
      `&fields=id,user,quota_remaining,quota_used` +
      `&sort[]=-date_created` +
      `&limit=1`;

    const balRes = await fetch(balUrl, { credentials: "include" });
    if (!balRes.ok) {
      return null;
    }

    const balJson = await balRes.json();
    const row: BalanceRow | undefined = balJson?.data?.[0];

    if (row) {
      return {
        used: Number(row.quota_used ?? 0),
        remaining: Number(row.quota_remaining ?? 0)
      };
    } else {
      return { used: 0, remaining: 0 };
    }
  } catch {
    return null;
  }
}

// Update user credits in Directus after consuming one credit
export async function _consumeUserCredit(userId: string, directusUrl: string): Promise<Credits | null> {
  try {
    // First get the current balance record
    const balUrl =
      `${directusUrl}/items/role_fit_index_balance` +
      `?filter[user][_eq]=${encodeURIComponent(userId)}` +
      `&fields=id,user,quota_remaining,quota_used` +
      `&sort[]=-date_created` +
      `&limit=1`;

    const balRes = await fetch(balUrl, { credentials: "include" });
    if (!balRes.ok) {
      return null;
    }

    const balJson = await balRes.json();
    const row: BalanceRow | undefined = balJson?.data?.[0];

    if (!row || row.quota_remaining <= 0) {
      return null; // No credits to consume
    }

    // Update the balance record
    const updatedCredits = {
      quota_used: row.quota_used + 1,
      quota_remaining: row.quota_remaining - 1
    };

    const updateRes = await fetch(`${directusUrl}/items/role_fit_index_balance/${row.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedCredits),
    });

    if (!updateRes.ok) {
      return null;
    }

    return {
      used: updatedCredits.quota_used,
      remaining: updatedCredits.quota_remaining
    };
  } catch {
    return null;
  }
}

// Consume one credit based on authentication status
export async function consumeCredit(directusUrl: string): Promise<{
  user: UserProfile | null;
  isAuthenticated: boolean;
  credits: Credits;
  success: boolean;
}> {
  try {
    // Check if user is logged in
    const user = await getUserProfile(directusUrl);

    if (!user) {
      // User is not logged in, consume guest credit from localStorage
      const updatedCredits = _consumeGuestCredit();
      return {
        user: null,
        isAuthenticated: false,
        credits: updatedCredits,
        success: true
      };
    } else {

      // User is logged in, consume credit from Directus
      const updatedCredits = await _consumeUserCredit(user.id, directusUrl);
      if (updatedCredits) {
        return {
          user,
          isAuthenticated: true,
          credits: updatedCredits,
          success: true
        };
      } else {
      // Failed to consume user credit, fallback to current credits
        const currentCredits = await _getUserCredits(user.id, directusUrl);
        return {
          user,
          isAuthenticated: true,
          credits: currentCredits || { used: 0, remaining: 0 },
          success: false
        };
      }
    }

  } catch {
    // On error, try to load current credits without consuming
    const result = await loadCredits(directusUrl);
    return {
      ...result,
      success: false
    };
  }
}

// Load credits based on authentication status
export async function loadCredits(directusUrl: string): Promise<{
  user: UserProfile | null;
  isAuthenticated: boolean;
  credits: Credits;
}> {
  try {
    // Check if user is logged in
    const user = await getUserProfile(directusUrl);

    if (!user) {
      // User is not logged in, load guest credits from localStorage
      const guestCredits = _getGuestCredits();
      return {
        user: null,
        isAuthenticated: false,
        credits: guestCredits
      };
    }

    // User is logged in, fetch credits from Directus
    const userCredits = await _getUserCredits(user.id, directusUrl);
    return {
      user,
      isAuthenticated: true,
      credits: userCredits || { used: 0, remaining: 0 } // Fallback if API fails
    };
  } catch {
    // Fallback to guest credits on error
    const guestCredits = _getGuestCredits();
    return {
      user: null,
      isAuthenticated: false,
      credits: guestCredits
    };
  }
}

// TODO check if we are ussing the logged in user's session or a generic guest token
// Helper function to get authorization headers
export function getAuthHeaders(user: UserProfile | null = null): Record<string, string> {
  return user !== null
    ? {} // No auth header needed for authenticated users (using session cookies)
    : { Authorization: `Bearer ${EXTERNAL.directus_key}` }; // Guest token for unauthenticated users
}

// Orbit Call Request types
export type OrbitCallRequest = {
  meeting_url?: string;
  testing_filename?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  mode?: 'company_call' | 'candidate_call';
  space?: number;
}

// Create orbit call request in Directus
export async function createOrbitCallRequest(
  data: { meeting_url?: string; testing_filename?: string; mode?: 'company_call' | 'candidate_call'; space?: number },
  directusUrl: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    const requestData: OrbitCallRequest = {
      ...data,
      status: 'pending'
    };

    const response = await fetch(`${directusUrl}/items/orbit_call_request`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      id: result.data?.id || result.id
    };
  } catch (error) {
    console.error('Error creating orbit call request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}


// Orbit Search Request types
export type OrbitSearchRequest = {
  jd: string;
  call: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

// Create orbit search request in Directus
export async function createOrbitSearchRequest(
  jdId: string,
  callId: string,
  directusUrl: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);
    
    const requestData: OrbitSearchRequest = {
      jd: jdId,
      call: callId,
      status: 'pending'
    };

    const response = await fetch(`${directusUrl}/items/orbit_search_request`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      id: result.data?.id || result.id
    };
  } catch (error) {
    console.error('Error creating orbit search request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Orbit Candidate Search Request types
export type OrbitCandidateSearchRequest = {
  id?: string;
  job_enrichment_session: string; // Renamed from 'session' - references orbit_job_description_enrichment_session
  job_description_snapshot: any;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'listed';
  space?: number | null; // Reference to space table
}

// Create orbit candidate search request in Directus
export async function createOrbitCandidateSearchRequest(
  jobEnrichmentSessionId: string,
  jobDescriptionSnapshot: any,
  directusUrl: string,
  spaceId?: number | null
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    const requestData: OrbitCandidateSearchRequest = {
      job_enrichment_session: jobEnrichmentSessionId,
      job_description_snapshot: jobDescriptionSnapshot,
      status: 'pending',
      space: spaceId || null
    };

    const response = await fetch(`${directusUrl}/items/orbit_candidate_search_request`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      id: result.data?.id || result.id
    };
  } catch (error) {
    console.error('Error creating orbit candidate search request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Fetch all candidate search requests for a session (stateless approach)
export async function fetchOrbitCandidateSearchRequests(
  sessionId: string,
  directusUrl: string
): Promise<{ success: boolean; requests?: OrbitCandidateSearchRequest[]; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    const response = await fetch(
      `${directusUrl}/items/orbit_candidate_search_request?filter[session][_eq]=${sessionId}&limit=50&fields=id,session,job_description_snapshot,status`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Failed to fetch orbit candidate search requests:', response.status, errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      requests: result.data || []
    };
  } catch (error) {
    console.error('Error fetching orbit candidate search requests:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Space types
export type Space = {
  id: number;
  name: string;
  description?: string;
  date_created?: string;
  date_updated?: string;
  job_description_count?: number;
  candidate_profile_count?: number;
  user_count?: number;
}

export type SpaceUser = {
  id: number;
  space: Space;
  user: string;
  permission?: string;
}

// Fetch user spaces from Directus
export async function getUserSpaces(directusUrl: string): Promise<{ success: boolean; spaces?: Space[]; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const response = await fetch(
      `${directusUrl}/items/space_user?filter[user][_eq]=${encodeURIComponent(user.id)}&fields=id,space.id,space.name,space.description,permission`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    
    
    // Filter spaces where user has 'read' access or higher permissions
    const spacesWithReadAccess = result.data?.filter((item: any) => {
      const permission = item.permission;
      
      // If no permission is set, deny access
      if (!permission) {
        return false;
      }
      
      // Handle array of permissions
      if (Array.isArray(permission)) {
        return permission.some(perm => 
          typeof perm === 'string' && ['read', 'write', 'admin'].includes(perm.toLowerCase())
        );
      }
      
      // Handle single string permission
      if (typeof permission === 'string') {
        return ['read', 'write', 'admin'].includes(permission.toLowerCase());
      }
      
      return false;
    }).map((item: any) => item.space).filter(Boolean) || [];
    
    // Fetch candidate and job description counts for each space separately
    const spacesWithCounts = await Promise.all(
      spacesWithReadAccess.map(async (space: any) => {
        try {
          // Fetch candidate profile count
          const candidateResponse = await fetch(
            `${directusUrl}/items/candidate_profile?filter[space][_eq]=${space.id}&aggregate[count]=id`,
            {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            }
          );
          
          if (candidateResponse.ok) {
            const candidateResult = await candidateResponse.json();
            
            // Extract count from aggregate response - try different possible structures
            let count = 0;
            if (candidateResult.data?.[0]?.count !== undefined) {
              const countValue = candidateResult.data[0].count;
              // Handle case where count is an object with id property
              if (typeof countValue === 'object' && countValue.id !== undefined) {
                count = parseInt(countValue.id) || 0;
              } else {
                count = parseInt(countValue) || 0;
              }
            } else if (candidateResult.data?.length !== undefined) {
              count = candidateResult.data.length;
            } else if (typeof candidateResult.data === 'number') {
              count = candidateResult.data;
            }
            
            space.candidate_profile_count = count;
          } else {
            space.candidate_profile_count = 0;
          }

          // Fetch job description count
          const jdResponse = await fetch(
            `${directusUrl}/items/job_description?filter[space][_eq]=${space.id}&aggregate[count]=id`,
            {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            }
          );
          
          if (jdResponse.ok) {
            const jdResult = await jdResponse.json();
            
            // Extract count from aggregate response - try different possible structures
            let count = 0;
            if (jdResult.data?.[0]?.count !== undefined) {
              const countValue = jdResult.data[0].count;
              // Handle case where count is an object with id property
              if (typeof countValue === 'object' && countValue.id !== undefined) {
                count = parseInt(countValue.id) || 0;
              } else {
                count = parseInt(countValue) || 0;
              }
            } else if (jdResult.data?.length !== undefined) {
              count = jdResult.data.length;
            } else if (typeof jdResult.data === 'number') {
              count = jdResult.data;
            }
            
            space.job_description_count = count;
          } else {
            space.job_description_count = 0;
          }
        } catch (error) {
          space.candidate_profile_count = 0;
          space.job_description_count = 0;
        }
        return space;
      })
    );
    
    return {
      success: true,
      spaces: spacesWithCounts
    };
  } catch (error) {
    console.error('Error fetching user spaces:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Fetch user spaces with write access only (for orbit call creation)
export async function getUserSpacesWithWriteAccess(directusUrl: string): Promise<{ success: boolean; spaces?: Space[]; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const response = await fetch(
      `${directusUrl}/items/space_user?filter[user][_eq]=${encodeURIComponent(user.id)}&fields=id,space.id,space.name,space.description,permission`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    
    // Filter spaces where user has 'write' access or higher permissions (for orbit call creation)
    const spacesWithWriteAccess = result.data?.filter((item: any) => {
      const permission = item.permission;
      
      // If no permission is set, deny access
      if (!permission) {
        return false;
      }
      
      // Handle array of permissions
      if (Array.isArray(permission)) {
        return permission.some(perm => 
          typeof perm === 'string' && ['write', 'admin'].includes(perm.toLowerCase())
        );
      }
      
      // Handle single string permission
      if (typeof permission === 'string') {
        return ['write', 'admin'].includes(permission.toLowerCase());
      }
      
      return false;
    }).map((item: any) => item.space).filter(Boolean) || [];
    
    // Fetch candidate and job description counts for each space separately
    const spacesWithCounts = await Promise.all(
      spacesWithWriteAccess.map(async (space: any) => {
        try {
          // Fetch candidate profile count
          const candidateResponse = await fetch(
            `${directusUrl}/items/candidate_profile?filter[space][_eq]=${space.id}&aggregate[count]=id`,
            {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            }
          );
          
          if (candidateResponse.ok) {
            const candidateResult = await candidateResponse.json();
            
            // Extract count from aggregate response - try different possible structures
            let count = 0;
            if (candidateResult.data?.[0]?.count !== undefined) {
              const countValue = candidateResult.data[0].count;
              // Handle case where count is an object with id property
              if (typeof countValue === 'object' && countValue.id !== undefined) {
                count = parseInt(countValue.id) || 0;
              } else {
                count = parseInt(countValue) || 0;
              }
            } else if (candidateResult.data?.length !== undefined) {
              count = candidateResult.data.length;
            } else if (typeof candidateResult.data === 'number') {
              count = candidateResult.data;
            }
            
            space.candidate_profile_count = count;
          } else {
            space.candidate_profile_count = 0;
          }

          // Fetch job description count
          const jdResponse = await fetch(
            `${directusUrl}/items/job_description?filter[space][_eq]=${space.id}&aggregate[count]=id`,
            {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            }
          );
          
          if (jdResponse.ok) {
            const jdResult = await jdResponse.json();
            
            // Extract count from aggregate response - try different possible structures
            let count = 0;
            if (jdResult.data?.[0]?.count !== undefined) {
              const countValue = jdResult.data[0].count;
              // Handle case where count is an object with id property
              if (typeof countValue === 'object' && countValue.id !== undefined) {
                count = parseInt(countValue.id) || 0;
              } else {
                count = parseInt(countValue) || 0;
              }
            } else if (jdResult.data?.length !== undefined) {
              count = jdResult.data.length;
            } else if (typeof jdResult.data === 'number') {
              count = jdResult.data;
            }
            
            space.job_description_count = count;
          } else {
            space.job_description_count = 0;
          }
        } catch (error) {
          space.candidate_profile_count = 0;
          space.job_description_count = 0;
        }
        return space;
      })
    );
    
    return {
      success: true,
      spaces: spacesWithCounts
    };
  } catch (error) {
    console.error('Error fetching user spaces with write access:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Create a new space in Directus
export async function createSpace(
  name: string, 
  directusUrl: string,
  description?: string
): Promise<{ success: boolean; space?: Space; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const spaceData = {
      name: name.trim(),
      description: description?.trim() || null
    };

    const response = await fetch(`${directusUrl}/items/space`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(spaceData)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    const space = result.data || result;

    return {
      success: true,
      space
    };
  } catch (error) {
    console.error('Error creating space:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Add user to space (create space_user record)
export async function addUserToSpace(
  spaceId: number, 
  userId: string, 
  permission: string = 'admin',
  directusUrl: string
): Promise<{ success: boolean; spaceUser?: SpaceUser; error?: string }> {
  try {
    const spaceUserData = {
      space: spaceId,
      user: userId,
      permission: ["read", "write", "delete", "admin"]
    };

    console.log('addUserToSpace: Sending request with data:', spaceUserData);

    const response = await fetch(`${directusUrl}/items/space_user`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(spaceUserData)
    });

    console.log('addUserToSpace: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('addUserToSpace: Error response:', errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    console.log('addUserToSpace: Success response:', result);
    const spaceUser = result.data || result;

    return {
      success: true,
      spaceUser
    };
  } catch (error) {
    console.error('Error adding user to space:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Job Description type
export type JobDescription = {
  id: number;
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  date_created?: string;
  date_updated?: string;
  space?: number;
  [key: string]: any;
}

// Candidate Profile type
export type CandidateProfile = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  resume_url?: string;
  date_created?: string;
  date_updated?: string;
  space?: number;
  [key: string]: any;
}

// Fetch job descriptions by space
export async function getJobDescriptionsBySpace(
  spaceId: number,
  directusUrl: string
): Promise<{ success: boolean; jobDescriptions?: JobDescription[]; error?: string }> {
  try {
    const response = await fetch(
      `${directusUrl}/items/job_description?filter[space][_eq]=${spaceId}&sort[]=-date_created&limit=100`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      jobDescriptions: result.data || []
    };
  } catch (error) {
    console.error('Error fetching job descriptions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Fetch candidate profiles by space
export async function getCandidateProfilesBySpace(
  spaceId: number,
  directusUrl: string
): Promise<{ success: boolean; candidateProfiles?: CandidateProfile[]; error?: string }> {
  try {
    const response = await fetch(
      `${directusUrl}/items/candidate_profile?filter[space][_eq]=${spaceId}&sort[]=-date_created&limit=100`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      candidateProfiles: result.data || []
    };
  } catch (error) {
    console.error('Error fetching candidate profiles:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Fetch counts for job descriptions, candidate profiles and users by space
export async function getSpaceCounts(
  spaceId: number,
  directusUrl: string
): Promise<{ success: boolean; job_description_count?: number; candidate_profile_count?: number; user_count?: number; error?: string }> {
  try {
    // Fetch job descriptions count
    const jdResponse = await fetch(
      `${directusUrl}/items/job_description?filter[space][_eq]=${spaceId}&aggregate[count]=id`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    // Fetch candidate profiles count
    const cpResponse = await fetch(
      `${directusUrl}/items/candidate_profile?filter[space][_eq]=${spaceId}&aggregate[count]=id`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    // Fetch users count for this space
    const usersResponse = await fetch(
      `${directusUrl}/items/space_user?filter[space][_eq]=${spaceId}&aggregate[count]=id`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!jdResponse.ok || !cpResponse.ok || !usersResponse.ok) {
      return {
        success: false,
        error: 'Failed to fetch counts'
      };
    }

    const jdResult = await jdResponse.json();
    const cpResult = await cpResponse.json();
    const usersResult = await usersResponse.json();

    return {
      success: true,
      job_description_count: jdResult.data?.[0]?.count?.id || 0,
      candidate_profile_count: cpResult.data?.[0]?.count?.id || 0,
      user_count: usersResult.data?.[0]?.count?.id || 0
    };
  } catch (error) {
    console.error('Error fetching space counts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Update space details
export async function updateSpace(
  spaceId: number,
  name: string,
  directusUrl: string,
  description?: string
): Promise<{ success: boolean; space?: Space; error?: string }> {
  try {
    const spaceData = {
      name: name.trim(),
      description: description?.trim() || null
    };

    const response = await fetch(`${directusUrl}/items/space/${spaceId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(spaceData)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    const space = result.data || result;

    return {
      success: true,
      space
    };
  } catch (error) {
    console.error('Error updating space:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Get current user's permission in a specific space
export async function getUserPermissionInSpace(spaceId: number, directusUrl: string): Promise<{ success: boolean; permission?: string; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const response = await fetch(
      `${directusUrl}/items/space_user?filter[user][_eq]=${encodeURIComponent(user.id)}&filter[space][_eq]=${spaceId}&fields=permission`,
      {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    const spaceUser = result.data?.[0];
    
    // Convert JSON permission array to string format for display
    let permissionString = null;
    if (spaceUser?.permission && Array.isArray(spaceUser.permission)) {
      const permissions = spaceUser.permission;
      if (permissions.includes('admin')) {
        permissionString = 'readwritedeleteadmin';
      } else {
        permissionString = permissions.join('');
      }
    }
    
    return {
      success: true,
      permission: permissionString
    };
  } catch (error) {
    console.error('Error fetching user permission in space:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Get package version from package.json
export async function getPackageVersion(): Promise<string> {
  try {
    const packageJson = await import("../../package.json", { assert: { type: "json" } });
    return packageJson.default.version;
  } catch (error) {
    console.error("Error reading package.json version:", error);
    return "0.0.0";
  }
}
