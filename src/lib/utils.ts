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

export function getLoginUrl(directusUrl: string, provider: string = "authentik", redirectPath: string = "/"): string {
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

    // logout authentik
    window.location.href =
      "https://authentik.bounteer.com/if/flow/default-invalidation-flow/?next=https://bounteer.com";
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
