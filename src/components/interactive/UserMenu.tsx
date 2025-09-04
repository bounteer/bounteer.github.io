// src/components/UserMenu.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Props = { directusUrl: string; provider?: string };

export default function UserMenu({ directusUrl, provider = "authentik" }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);

  const currentUrl = typeof window !== "undefined" ? window.location.href : "/";

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${directusUrl}/users/me`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("not authed");
        const json = await res.json();
        const u = json?.data ?? json;
        const first = u?.first_name?.trim();
        const last = u?.last_name?.trim();
        const display = [first, last].filter(Boolean).join(" ") || u?.email || "Account";
        if (!cancelled) {
          setName(display);
          setEmail(u?.email ?? null);
        }
      } catch {
        if (!cancelled) {
          setName(null);
          setEmail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [directusUrl]);

  const initials = React.useMemo(() => {
    const src = name || email || "";
    const parts = src.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (src.includes("@")) return src[0]?.toUpperCase() || "?";
    return src.slice(0, 2).toUpperCase() || "?";
  }, [name, email]);

  if (loading) {
    return <div className="hidden md:flex w-28 h-9 rounded-full bg-secondary-100 animate-pulse" />;
  }

  // Logged out → show Login button
  if (!name) {
    const u = new URL(currentUrl);
    const loginHref = `${directusUrl}/auth/login/${provider}?redirect=${encodeURIComponent(u.origin)}`;
    return (
      <Button asChild variant="secondary" className="hidden md:inline-flex">
        <a href={loginHref}>Login</a>
      </Button>
    );
  }

  // Logged in → POST /auth/logout, then redirect back
  const onLogout = async () => {
    try {
      const res = await fetch(`${directusUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",              // <-- REQUIRED for cookies
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "session" })
      });

      // Directus often returns 204 No Content on success
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Logout failed:", res.status, txt);
        return;
      }

      // clear any app-side state and bounce
      // window.location.replace(currentUrl);
    } catch (e) {
      console.error("Logout error:", e);
    }

  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="items-center gap-2 rounded-full">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="max-w-[12rem] truncate">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onLogout();
          }}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
