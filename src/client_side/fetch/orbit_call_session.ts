import { getUserProfile, getAuthHeaders } from "@/lib/utils";

// Orbit Call Session types
export type OrbitCallSession = {
  id: string;
  request: string;
  job_description?: string;
  status?: 'pending' | 'active' | 'completed' | 'failed';
  created_at?: string;
  updated_at?: string;
}

// Get orbit call session by request ID
export async function get_orbit_call_session_by_request_id(
  requestId: string,
  directusUrl: string
): Promise<{ success: boolean; session?: OrbitCallSession; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    const response = await fetch(`${directusUrl}/items/orbit_call_session?filter[request][_eq]=${encodeURIComponent(requestId)}&limit=1`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
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
    const session = result.data?.[0];

    if (!session) {
      return {
        success: false,
        error: 'No orbit call session found for this request ID'
      };
    }

    return {
      success: true,
      session
    };
  } catch (error) {
    console.error('Error fetching orbit call session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}