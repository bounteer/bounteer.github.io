import React, { useEffect, useState } from 'react';
import { EXTERNAL } from '@/constant';
import { getLoginUrl, getUserProfile, type UserProfile } from '@/lib/utils';

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
        window.location.href = getLoginUrl(EXTERNAL.directus_url, EXTERNAL.auth_idp_key, encodeURIComponent(nextPath));
      }
    }

    checkAuth();
  }, []);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img
            src="/auth_check.png"
            alt="Authentication check"
            className="mx-auto mb-4 w-64 lg:w-72"
          />
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