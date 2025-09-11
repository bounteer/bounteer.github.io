// src/components/UserMenu.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUserProfile, getUserDisplayName, getUserInitials, getLoginUrl, logout, type UserProfile } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

type Props = { directusUrl: string; provider?: string };

export default function UserMenu({ directusUrl, provider = EXTERNAL.auth_idp_key }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const userProfile = await getUserProfile(directusUrl);
      if (!cancelled) {
        setUser(userProfile);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [directusUrl]);

  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(displayName, user?.email ?? null);

  if (loading) {
    return <div className="flex w-28 h-9 rounded-full bg-secondary-100 animate-pulse" />;
  }

  // Logged out → show Login button
  if (!user) {
    const loginHref = getLoginUrl(directusUrl, provider, "/dashboard");
    return (
      <Button asChild variant="secondary" className="inline-flex">
        <a href={loginHref}>Login</a>
      </Button>
    );
  }

  const onLogout = () => logout(directusUrl);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="items-center gap-2 rounded-full">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="max-w-[12rem] truncate">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {/* Dashboard button */}
        <DropdownMenuItem asChild>
          <a href="/dashboard">Dashboard</a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout (red) */}
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
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
