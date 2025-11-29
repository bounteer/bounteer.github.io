import { EXTERNAL } from "@/constant";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
}

// Create orbit call request in Directus
export async function createOrbitCallRequest(
  data: { meeting_url?: string; testing_filename?: string; mode?: 'company_call' | 'candidate_call' },
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
  session: string;
  job_description_snapshot: any;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'listed';
}

// Create orbit candidate search request in Directus
export async function createOrbitCandidateSearchRequest(
  sessionId: string,
  jobDescriptionSnapshot: any,
  directusUrl: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    const requestData: OrbitCandidateSearchRequest = {
      session: sessionId,
      job_description_snapshot: jobDescriptionSnapshot,
      status: 'pending'
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
