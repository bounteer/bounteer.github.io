import { getUserProfile, getAuthHeaders } from "@/lib/utils";

// Generic Request types
export type GenericRequestCategory = "job_description" | "candidate_profile";
export type GenericRequestAction = "save";
export type GenericRequestStatus = "pending" | "processing" | "completed" | "failed";

export interface GenericRequest {
  id?: number;
  space?: number;
  user?: string;
  category: GenericRequestCategory;
  action: GenericRequestAction;
  payload: any;
  status?: GenericRequestStatus;
  date_created?: string;
  date_updated?: string;
}

/**
 * Create a generic request with save action
 * This is used to save session data (JD/CP) when user exits the page
 */
export async function createGenericSaveRequest(
  category: GenericRequestCategory,
  payload: any,
  directusUrl: string,
  space?: number
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const user = await getUserProfile(directusUrl);
    const authHeaders = getAuthHeaders(user);

    const requestData: Partial<GenericRequest> = {
      category,
      action: "save",
      payload,
      status: "pending"
    };

    // Add space if provided
    if (space) {
      requestData.space = space;
    }

    // Add user if authenticated
    if (user) {
      requestData.user = user.id;
    }

    const response = await fetch(`${directusUrl}/items/generic_request`, {
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
    const createdRequest = result.data;

    return {
      success: true,
      id: createdRequest?.id
    };
  } catch (error) {
    console.error('Error creating generic save request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Create a generic save request with keepalive for page unload scenarios
 * This version doesn't return a promise and is optimized for beforeunload events
 */
export function createGenericSaveRequestOnUnload(
  category: GenericRequestCategory,
  payload: any,
  directusUrl: string,
  directusKey: string,
  space?: number
): void {
  try {
    const requestData: Partial<GenericRequest> = {
      category,
      action: "save",
      payload,
      status: "pending"
    };

    // Add space if provided
    if (space) {
      requestData.space = space;
    }

    // Use fetch with keepalive for reliable transmission during page unload
    fetch(`${directusUrl}/items/generic_request`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true, // Critical: allows request to complete after page unload
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${directusKey}` // Use token for reliability during unload
      },
      body: JSON.stringify(requestData)
    }).catch(error => {
      console.error('Error creating generic save request on unload:', error);
    });
  } catch (error) {
    console.error('Error initiating generic save request on unload:', error);
  }
}
