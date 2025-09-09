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
