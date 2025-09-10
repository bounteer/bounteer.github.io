import React, { useEffect, useState } from 'react';
import { EXTERNAL } from '@/constant';
import { getUserProfile, type UserProfile } from '@/lib/utils';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const profile = await getUserProfile(EXTERNAL.directus_url);
      if (profile) {
        setUserProfile(profile);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        // Get the next path from URL params or current path
        const urlParams = new URLSearchParams(window.location.search);
        const nextPath = urlParams.get('next') || window.location.pathname + window.location.search;

        const callbackUrl = `${window.location.origin}/?next=${encodeURIComponent(nextPath)}`;
        window.location.href = `${EXTERNAL.directus_url}/auth/login/authentik?redirect=${encodeURIComponent(callbackUrl)}`;
      }
    }

    checkAuth();
  }, []);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show children if authenticated
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // This shouldn't render as we redirect above, but just in case
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p>Redirecting to login...</p>
      </div>
    </div>
  );
}