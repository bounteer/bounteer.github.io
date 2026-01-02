/**
 * Google Calendar API integration for creating events with Google Meet
 * This uses the Google Calendar API v3
 */

import { EXTERNAL } from "@/constant";

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: {
        type: string;
      };
    };
  };
}

export interface CreateEventResult {
  success: boolean;
  meetLink?: string;
  eventId?: string;
  error?: string;
}

/**
 * Initialize Google Calendar API with OAuth 2.0
 * This should be called on page load to set up the Google API client
 * Only requires client ID (no API key or client secret needed for client-side auth)
 */
export async function initGoogleCalendar(): Promise<boolean> {
  // Check if client ID is configured
  if (!EXTERNAL.google_client_id) {
    console.warn('Google Client ID not configured. Please add it to src/constant.ts');
    return false;
  }

  return new Promise((resolve) => {
    // Load the Google API client library
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('client:auth2', async () => {
        try {
          await window.gapi.client.init({
            clientId: EXTERNAL.google_client_id,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            scope: 'https://www.googleapis.com/auth/calendar.events',
          });
          resolve(true);
        } catch (error) {
          console.error('Error initializing Google Calendar API:', error);
          resolve(false);
        }
      });
    };
    script.onerror = () => {
      console.error('Failed to load Google API script');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Sign in to Google Account
 */
export async function signInToGoogle(): Promise<boolean> {
  try {
    const auth = window.gapi.auth2.getAuthInstance();
    if (!auth.isSignedIn.get()) {
      await auth.signIn();
    }
    return auth.isSignedIn.get();
  } catch (error) {
    console.error('Error signing in to Google:', error);
    return false;
  }
}

/**
 * Check if user is signed in
 */
export function isSignedIn(): boolean {
  try {
    const auth = window.gapi.auth2.getAuthInstance();
    return auth?.isSignedIn.get() || false;
  } catch {
    return false;
  }
}

/**
 * Create a Google Calendar event with Google Meet conference
 */
export async function createCalendarEventWithMeet(
  date: Date,
  duration: number, // in minutes
  summary: string = "Orbit Call Interview",
  description: string = "AI-powered interview session via Bounteer Orbit Call"
): Promise<CreateEventResult> {
  try {
    // Ensure user is signed in
    const signedIn = await signInToGoogle();
    if (!signedIn) {
      return {
        success: false,
        error: 'Please sign in to Google to schedule meetings',
      };
    }

    // Calculate end time
    const endDate = new Date(date);
    endDate.setMinutes(endDate.getMinutes() + duration);

    // Create event with conference data
    const event: CalendarEvent = {
      summary,
      description,
      start: {
        dateTime: date.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      conferenceData: {
        createRequest: {
          requestId: `orbit-call-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    // Create the event
    const response = await window.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      resource: event,
    });

    // Extract Google Meet link from response
    const meetLink = response.result.conferenceData?.entryPoints?.find(
      (entry: any) => entry.entryPointType === 'video'
    )?.uri;

    if (!meetLink) {
      return {
        success: false,
        error: 'Failed to generate Google Meet link',
      };
    }

    return {
      success: true,
      meetLink,
      eventId: response.result.id,
    };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create calendar event',
    };
  }
}

/**
 * Type definitions for Google API
 */
declare global {
  interface Window {
    gapi: any;
  }
}
