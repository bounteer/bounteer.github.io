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
export function getGuestCredits(): Credits {
  if (typeof window === 'undefined') {
    // Server-side rendering, return default
    return { used: 0, remaining: 2 };
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

  // No stored credits or invalid format, assign default 2 credits
  const defaultCredits: Credits = { used: 0, remaining: 2 };
  localStorage.setItem('role-fit-index-credits', JSON.stringify(defaultCredits));
  return defaultCredits;
}

// Save guest credits to localStorage
export function saveGuestCredits(credits: Credits): void {
  localStorage.setItem('role-fit-index-credits', JSON.stringify(credits));
}

// Consume one credit for guests
export function consumeGuestCredit(): Credits {
  const currentCredits = getGuestCredits();
  if (currentCredits.remaining > 0) {
    const updatedCredits = {
      used: currentCredits.used + 1,
      remaining: currentCredits.remaining - 1
    };
    saveGuestCredits(updatedCredits);
    return updatedCredits;
  }
  return currentCredits;
}

// Fetch user credits from Directus for authenticated users
export async function getUserCredits(userId: string, directusUrl: string): Promise<Credits | null> {
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
export async function consumeUserCredit(userId: string, directusUrl: string): Promise<Credits | null> {
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
      const updatedCredits = consumeGuestCredit();
      return {
        user: null,
        isAuthenticated: false,
        credits: updatedCredits,
        success: true
      };
    }

    // User is logged in, consume credit from Directus
    const updatedCredits = await consumeUserCredit(user.id, directusUrl);
    if (updatedCredits) {
      return {
        user,
        isAuthenticated: true,
        credits: updatedCredits,
        success: true
      };
    } else {
      // Failed to consume user credit, fallback to current credits
      const currentCredits = await getUserCredits(user.id, directusUrl);
      return {
        user,
        isAuthenticated: true,
        credits: currentCredits || { used: 0, remaining: 0 },
        success: false
      };
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
      const guestCredits = getGuestCredits();
      return {
        user: null,
        isAuthenticated: false,
        credits: guestCredits
      };
    }

    // User is logged in, fetch credits from Directus
    const userCredits = await getUserCredits(user.id, directusUrl);
    return {
      user,
      isAuthenticated: true,
      credits: userCredits || { used: 0, remaining: 0 } // Fallback if API fails
    };
  } catch {
    // Fallback to guest credits on error
    const guestCredits = getGuestCredits();
    return {
      user: null,
      isAuthenticated: false,
      credits: guestCredits
    };
  }
}
