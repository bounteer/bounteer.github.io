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
  space?: number[] | null; // Array of space IDs - Directus handles junction table automatically
  custom_prompt?: string; // Custom prompt for candidate search
}

// Create orbit candidate search request in Directus
export async function createOrbitCandidateSearchRequest(
  jobEnrichmentSessionId: string,
  jobDescriptionSnapshot: any,
  directusUrl: string,
  spaceIds?: number[],
  customPrompt?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    // If no spaceIds provided or empty array, fetch all available spaces
    let finalSpaceIds = spaceIds && spaceIds.length > 0 ? spaceIds : null;

    if (!finalSpaceIds || finalSpaceIds.length === 0) {
      const spacesResult = await getUserSpaces(directusUrl);
      if (spacesResult.success && spacesResult.spaces && spacesResult.spaces.length > 0) {
        finalSpaceIds = spacesResult.spaces.map(s => s.id);
        console.log("No spaces selected, using all available spaces:", finalSpaceIds);
      }
    }

    const requestData: OrbitCandidateSearchRequest = {
      job_enrichment_session: jobEnrichmentSessionId,
      job_description_snapshot: jobDescriptionSnapshot,
      status: 'pending',
      space: finalSpaceIds,
      custom_prompt: customPrompt || undefined
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
  hiring_intent_count?: number;
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

          // Fetch hiring intent count
          const hiringIntentResponse = await fetch(
            `${directusUrl}/items/hiring_intent?filter[space][_eq]=${space.id}&aggregate[count]=id`,
            {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            }
          );

          if (hiringIntentResponse.ok) {
            const hiringIntentResult = await hiringIntentResponse.json();

            // Extract count from aggregate response - try different possible structures
            let count = 0;
            if (hiringIntentResult.data?.[0]?.count !== undefined) {
              const countValue = hiringIntentResult.data[0].count;
              // Handle case where count is an object with id property
              if (typeof countValue === 'object' && countValue.id !== undefined) {
                count = parseInt(countValue.id) || 0;
              } else {
                count = parseInt(countValue) || 0;
              }
            } else if (hiringIntentResult.data?.length !== undefined) {
              count = hiringIntentResult.data.length;
            } else if (typeof hiringIntentResult.data === 'number') {
              count = hiringIntentResult.data;
            }

            space.hiring_intent_count = count;
          } else {
            space.hiring_intent_count = 0;
          }
        } catch (error) {
          space.candidate_profile_count = 0;
          space.job_description_count = 0;
          space.hiring_intent_count = 0;
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

          // Fetch hiring intent count
          const hiringIntentResponse = await fetch(
            `${directusUrl}/items/hiring_intent?filter[space][_eq]=${space.id}&aggregate[count]=id`,
            {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            }
          );

          if (hiringIntentResponse.ok) {
            const hiringIntentResult = await hiringIntentResponse.json();

            // Extract count from aggregate response - try different possible structures
            let count = 0;
            if (hiringIntentResult.data?.[0]?.count !== undefined) {
              const countValue = hiringIntentResult.data[0].count;
              // Handle case where count is an object with id property
              if (typeof countValue === 'object' && countValue.id !== undefined) {
                count = parseInt(countValue.id) || 0;
              } else {
                count = parseInt(countValue) || 0;
              }
            } else if (hiringIntentResult.data?.length !== undefined) {
              count = hiringIntentResult.data.length;
            } else if (typeof hiringIntentResult.data === 'number') {
              count = hiringIntentResult.data;
            }

            space.hiring_intent_count = count;
          } else {
            space.hiring_intent_count = 0;
          }
        } catch (error) {
          space.candidate_profile_count = 0;
          space.job_description_count = 0;
          space.hiring_intent_count = 0;
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

// Search for a user by email
export async function searchUserByEmail(
  email: string,
  directusUrl: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const response = await fetch(`${directusUrl}/users?filter[email][_eq]=${encodeURIComponent(email)}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('searchUserByEmail: Error response:', errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    const users = result.data || [];

    if (users.length === 0) {
      return {
        success: false,
        error: 'User does not exist'
      };
    }

    return {
      success: true,
      user: users[0]
    };
  } catch (error) {
    console.error('Error searching user by email:', error);
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

// Get all users in a space with their details
export type SpaceUserDetail = {
  id: number;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  permission: string[];
  date_created: string;
};

export async function getSpaceUsers(
  spaceId: number,
  directusUrl: string
): Promise<{ success: boolean; users?: SpaceUserDetail[]; error?: string }> {
  try {
    const response = await fetch(
      `${directusUrl}/items/space_user?filter[space][_eq]=${spaceId}&fields=id,user.id,user.first_name,user.last_name,user.email,permission,date_created`,
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
    const users = result.data || [];

    return {
      success: true,
      users
    };
  } catch (error) {
    console.error('Error fetching space users:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Update user permission in a space
export async function updateUserPermissionInSpace(
  spaceUserId: number,
  permissions: string[],
  directusUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${directusUrl}/items/space_user/${spaceUserId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          permission: permissions
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error updating user permission:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Delete a space and all its associated space_user records
export async function deleteSpace(
  spaceId: number,
  directusUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, delete all space_user records for this space
    const spaceUsersResponse = await fetch(
      `${directusUrl}/items/space_user?filter[space][_eq]=${spaceId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Note: Directus may return 204 No Content for successful deletions
    if (!spaceUsersResponse.ok && spaceUsersResponse.status !== 204) {
      console.warn('Failed to delete space_user records, continuing with space deletion');
    }

    // Then delete the space itself
    const spaceResponse = await fetch(
      `${directusUrl}/items/space/${spaceId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!spaceResponse.ok && spaceResponse.status !== 204) {
      const errorText = await spaceResponse.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Failed to delete space: HTTP ${spaceResponse.status}: ${errorText}`
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting space:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Hiring Intent Action types
export type HiringIntentAction = {
  id?: number;
  intent?: number;
  category?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  date_created?: string;
  user_created?: string;
  user?: string;
  payload?: any; // Can be string or JSON object
  lexical_order?: string;
}

// Hiring Intent User State types
export type HiringIntentUserState = {
  id?: number;
  user_created?: string;
  date_created?: string;
  user_updated?: string;
  date_updated?: string;
  intent?: number;
  status?: 'actioned' | 'hidden' | 'completed';
}

// Hiring Intent types
export type HiringIntent = {
  id: number;
  user_created?: string;
  date_created?: string;
  user_updated?: string;
  date_updated?: string;
  company_profile?: any;
  reason?: string;
  potential_role?: any;
  skill?: any;
  category?: 'funding' | 'growth' | 'replacement';
  space?: number;
  confidence?: number;
  predicted_window_start?: string;
  predicted_window_end?: string;
  source?: { url?: string; [key: string]: any };
  actions?: HiringIntentAction[];
  user_state?: HiringIntentUserState[];
}

// Helper type for categorized intent IDs
type CategorizedIntentIds = {
  actionedIds: number[];
  hiddenIds: number[];
  completedIds: number[];
  allIds: number[];
};

// Fetch user's hiring intent states (to be called once and reused)
export async function getUserHiringIntentStates(
  directusUrl: string
): Promise<{ success: boolean; categories?: CategorizedIntentIds; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const userStateUrl = `${directusUrl}/items/hiring_intent_user_state?filter[user_created][_eq]=${encodeURIComponent(user.id)}&fields=intent,status&limit=1000`;
    const userStateResponse = await fetch(userStateUrl, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!userStateResponse.ok) {
      const errorText = await userStateResponse.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Failed to fetch user states: ${errorText}`
      };
    }

    const userStateResult = await userStateResponse.json();
    const userStates = userStateResult.data || [];

    // Categorize intent IDs by status
    const actionedIds = userStates
      .filter((state: any) => state.status === 'actioned')
      .map((state: any) => state.intent);
    const hiddenIds = userStates
      .filter((state: any) => state.status === 'hidden')
      .map((state: any) => state.intent);
    const completedIds = userStates
      .filter((state: any) => state.status === 'completed')
      .map((state: any) => state.intent);
    const allIds = [...actionedIds, ...hiddenIds, ...completedIds];

    return {
      success: true,
      categories: {
        actionedIds,
        hiddenIds,
        completedIds,
        allIds
      }
    };
  } catch (error) {
    console.error('Error fetching user hiring intent states:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Fetch hiring intents by space and column type (signals, actions, hidden)
// If categorizedIds is provided, it will be used instead of fetching user states again
export async function getHiringIntentsBySpace(
  spaceId: number | null,
  directusUrl: string,
  options?: {
    limit?: number;
    offset?: number;
    columnType?: 'signals' | 'actions' | 'hidden' | 'completed';
    categorizedIds?: CategorizedIntentIds; // Reuse categorized IDs to avoid redundant queries
  }
): Promise<{
  success: boolean;
  hiringIntents?: HiringIntent[];
  totalCount?: number;
  error?: string;
}> {
  try {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const columnType = options?.columnType || 'signals';

    // Use provided categorizedIds or fetch them
    let categorizedIds = options?.categorizedIds;
    if (!categorizedIds) {
      const statesResult = await getUserHiringIntentStates(directusUrl);
      if (!statesResult.success || !statesResult.categories) {
        return {
          success: false,
          error: statesResult.error || 'Failed to fetch user states'
        };
      }
      categorizedIds = statesResult.categories;
    }

    const { actionedIds, hiddenIds, completedIds, allIds } = categorizedIds;

    // Build base URL with fields (excluding actions - will be fetched separately)
    let url = `${directusUrl}/items/hiring_intent?sort[]=-date_created&limit=${limit}&offset=${offset}&meta=filter_count&fields=id,date_created,date_updated,company_profile.*,company_profile.reference.*,reason,potential_role,skill,category,space,confidence,predicted_window_start,predicted_window_end,source.*`;

    // Add space filter if provided
    if (spaceId) {
      url += `&filter[space][_eq]=${spaceId}`;
    }

    // Add intent ID filters based on column type
    if (columnType === 'actions') {
      // For Actions: fetch intents where ID is in actionedIds
      if (actionedIds.length === 0) {
        return {
          success: true,
          hiringIntents: [],
          totalCount: 0
        };
      }
      url += `&filter[id][_in]=${actionedIds.join(',')}`;
    } else if (columnType === 'hidden') {
      // For Hidden: fetch intents where ID is in hiddenIds
      if (hiddenIds.length === 0) {
        return {
          success: true,
          hiringIntents: [],
          totalCount: 0
        };
      }
      url += `&filter[id][_in]=${hiddenIds.join(',')}`;
    } else if (columnType === 'completed') {
      // For Completed: fetch intents where ID is in completedIds
      if (completedIds.length === 0) {
        return {
          success: true,
          hiringIntents: [],
          totalCount: 0
        };
      }
      url += `&filter[id][_in]=${completedIds.join(',')}`;
    } else {
      // For Signals: fetch intents where ID is NOT in allIds
      if (allIds.length > 0) {
        url += `&filter[id][_nin]=${allIds.join(',')}`;
      }
      // If no user states exist, all intents are signals (no additional filter needed)
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    const intents = result.data || [];

    // Fetch actions separately for all intents
    if (intents.length > 0) {
      const intentIds = intents.map((intent: HiringIntent) => intent.id);
      const actionsResult = await getHiringIntentActions(intentIds, directusUrl);

      if (actionsResult.success && actionsResult.actions) {
        // Group actions by intent ID
        const actionsByIntent: { [key: number]: HiringIntentAction[] } = {};
        actionsResult.actions.forEach(action => {
          if (action.intent) {
            if (!actionsByIntent[action.intent]) {
              actionsByIntent[action.intent] = [];
            }
            actionsByIntent[action.intent].push(action);
          }
        });

        // Merge actions into intents
        intents.forEach((intent: HiringIntent) => {
          intent.actions = actionsByIntent[intent.id] || [];
        });
      }
    }

    return {
      success: true,
      hiringIntents: intents,
      totalCount: result.meta?.filter_count ?? 0
    };
  } catch (error) {
    console.error('Error fetching hiring intents:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Create or update hiring intent user state
export async function updateHiringIntentUserState(
  hiringIntentId: number,
  status: 'actioned' | 'hidden' | 'completed',
  directusUrl: string
): Promise<{ success: boolean; userState?: HiringIntentUserState; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    // First, check if a user state already exists for this intent and user
    const checkUrl = `${directusUrl}/items/hiring_intent_user_state?filter[intent][_eq]=${hiringIntentId}&filter[user_created][_eq]=${encodeURIComponent(user.id)}&limit=1`;

    const checkResponse = await fetch(checkUrl, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!checkResponse.ok) {
      console.warn('Failed to check existing user state, will create new one');
    }

    const checkResult = await checkResponse.json();
    const existingState = checkResult.data?.[0];

    let response: Response;
    const stateData = {
      intent: hiringIntentId,
      status: status
    };

    if (existingState) {
      // Update existing state
      response = await fetch(
        `${directusUrl}/items/hiring_intent_user_state/${existingState.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        }
      );
    } else {
      // Create new state
      response = await fetch(
        `${directusUrl}/items/hiring_intent_user_state`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(stateData)
        }
      );
    }

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
      userState: result.data || result
    };
  } catch (error) {
    console.error('Error updating hiring intent user state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Delete hiring intent user state (to move back to signals)
export async function deleteHiringIntentUserState(
  hiringIntentId: number,
  directusUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    // Find the user state for this intent and user
    const findUrl = `${directusUrl}/items/hiring_intent_user_state?filter[intent][_eq]=${hiringIntentId}&filter[user_created][_eq]=${encodeURIComponent(user.id)}&limit=1`;

    const findResponse = await fetch(findUrl, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!findResponse.ok) {
      return {
        success: false,
        error: 'Failed to find user state'
      };
    }

    const findResult = await findResponse.json();
    const userState = findResult.data?.[0];

    if (!userState) {
      return {
        success: true // Already deleted or doesn't exist
      };
    }

    // Delete the user state
    const deleteResponse = await fetch(
      `${directusUrl}/items/hiring_intent_user_state/${userState.id}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      const errorText = await deleteResponse.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${deleteResponse.status}: ${errorText}`
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting hiring intent user state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Fetch hiring intent actions for specific intent IDs
export async function getHiringIntentActions(
  intentIds: number[],
  directusUrl: string
): Promise<{ success: boolean; actions?: HiringIntentAction[]; error?: string }> {
  try {
    if (intentIds.length === 0) {
      return {
        success: true,
        actions: []
      };
    }

    const url = `${directusUrl}/items/hiring_intent_action?filter[intent][_in]=${intentIds.join(',')}&fields=id,intent,status,category,date_created,user,user_created,payload,lexical_order&limit=1000`;

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
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
      actions: result.data || []
    };
  } catch (error) {
    console.error('Error fetching hiring intent actions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Create hiring intent action
export async function createHiringIntentAction(
  hiringIntentId: number,
  actionStatus: 'pending' | 'processing' | 'completed' | 'skipped' | 'failed',
  category: string = 'user_action',
  directusUrl: string
): Promise<{ success: boolean; action?: HiringIntentAction; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const actionData = {
      intent: hiringIntentId,
      category: category,
      status: actionStatus
    };

    const response = await fetch(
      `${directusUrl}/items/hiring_intent_action`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(actionData)
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
      action: result.data || result
    };
  } catch (error) {
    console.error('Error creating hiring intent action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Delete hiring intent action
export async function deleteHiringIntentAction(
  actionId: number,
  directusUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const response = await fetch(
      `${directusUrl}/items/hiring_intent_action/${actionId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting hiring intent action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Update hiring intent action status
export async function updateHiringIntentAction(
  actionId: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  directusUrl: string
): Promise<{ success: boolean; action?: HiringIntentAction; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const response = await fetch(
      `${directusUrl}/items/hiring_intent_action/${actionId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
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
      action: result.data || result
    };
  } catch (error) {
    console.error('Error updating hiring intent action:', error);
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

// Setting types
export type SettingItem = {
  id: number;
  key: string;
  scope?: string;
  scope_id?: string;
  value_type?: string;
  value_boolean?: boolean;
  value_number?: number;
  value_text?: string;
  value_json?: any;
}

// Fetch a setting by key from the setting_item table
export async function getSetting(
  key: string,
  directusUrl: string,
  scope?: string,
  scope_id?: string
): Promise<{ success: boolean; setting?: SettingItem; value?: any; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    // Build filter based on key and optional scope
    let filter = `filter[key][_eq]=${encodeURIComponent(key)}`;
    if (scope) {
      filter += `&filter[scope][_eq]=${encodeURIComponent(scope)}`;
    }
    if (scope_id !== undefined && scope_id !== null) {
      filter += `&filter[scope_id][_eq]=${encodeURIComponent(scope_id)}`;
    }

    const fullUrl = `${directusUrl}/items/setting_item?${filter}&limit=1&fields=*`;
    console.log('[getSetting] Fetching:', fullUrl);
    console.log('[getSetting] Parameters:', { key, scope, scope_id });

    const response = await fetch(
      fullUrl,
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
      console.error('[getSetting] HTTP error:', response.status, errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    console.log('[getSetting] Response:', result);
    const setting = result.data?.[0];

    if (!setting) {
      console.log('[getSetting] No setting found with filter:', filter);
      return {
        success: false,
        error: `Setting with key '${key}' not found`
      };
    }

    console.log('[getSetting] Found setting:', setting);

    // Extract the actual value based on value_type
    let value = null;
    switch (setting.value_type) {
      case 'boolean':
        value = setting.value_boolean;
        break;
      case 'number':
        value = setting.value_number;
        break;
      case 'text':
        value = setting.value_text;
        break;
      case 'json':
        value = setting.value_json;
        break;
      default:
        // If no value_type specified, try to determine the appropriate value
        if (setting.value_boolean !== null) value = setting.value_boolean;
        else if (setting.value_number !== null) value = setting.value_number;
        else if (setting.value_text !== null) value = setting.value_text;
        else if (setting.value_json !== null) value = setting.value_json;
        break;
    }

    return {
      success: true,
      setting,
      value
    };
  } catch (error) {
    console.error('Error fetching setting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Create or update a setting by key
export async function setSetting(
  key: string,
  value: any,
  directusUrl: string,
  scope?: string,
  scope_id?: string,
  value_type?: 'text' | 'number' | 'boolean' | 'json'
): Promise<{ success: boolean; setting?: SettingItem; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    // Determine value_type if not specified
    if (!value_type) {
      if (typeof value === 'boolean') {
        value_type = 'boolean';
      } else if (typeof value === 'number') {
        value_type = 'number';
      } else if (typeof value === 'object') {
        value_type = 'json';
      } else {
        value_type = 'text';
      }
    }

    // Prepare the setting data
    const settingData: any = {
      key,
      value_type,
      scope,
      scope_id
    };

    // Set the appropriate value field based on type
    switch (value_type) {
      case 'boolean':
        settingData.value_boolean = value;
        break;
      case 'number':
        settingData.value_number = value;
        break;
      case 'json':
        settingData.value_json = value;
        break;
      case 'text':
        settingData.value_text = value;
        break;
    }

    // First, try to find existing setting with same key, scope, and scope_id
    let filter = `filter[key][_eq]=${encodeURIComponent(key)}`;
    if (scope) {
      filter += `&filter[scope][_eq]=${encodeURIComponent(scope)}`;
    }
    if (scope_id !== undefined && scope_id !== null) {
      filter += `&filter[scope_id][_eq]=${encodeURIComponent(scope_id)}`;
    }

    const existingResponse = await fetch(
      `${directusUrl}/items/setting_item?${filter}&limit=1&fields=id`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        }
      }
    );

    let response: Response;

    if (existingResponse.ok) {
      const existingResult = await existingResponse.json();
      const existingSetting = existingResult.data?.[0];

      if (existingSetting) {
        // Update existing setting
        response = await fetch(
          `${directusUrl}/items/setting_item/${existingSetting.id}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            },
            body: JSON.stringify(settingData)
          }
        );
      } else {
        // No existing setting found, create new one
        response = await fetch(
          `${directusUrl}/items/setting_item`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            },
            body: JSON.stringify(settingData)
          }
        );
      }
    } else {
      // Create new setting if existingResponse was not ok
      response = await fetch(
        `${directusUrl}/items/setting_item`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify(settingData)
        }
      );
    }

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
      setting: result.data || result
    };
  } catch (error) {
    console.error('Error saving setting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
