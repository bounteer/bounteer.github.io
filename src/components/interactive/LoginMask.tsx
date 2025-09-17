import React, { useEffect, useState } from 'react';
import { EXTERNAL } from '@/constant';
import { getLoginUrl, getUserProfile } from '@/lib/utils';
import { LogIn, EyeOff } from 'lucide-react';

interface LoginMaskProps {
  children: React.ReactNode;
  blurContent?: boolean;
}

export default function LoginMask({ children, blurContent = true }: LoginMaskProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const profile = await getUserProfile(EXTERNAL.directus_url);
      setIsAuthenticated(!!profile);
    }
    checkAuth();
  }, []);

  const handleLogin = () => {
    const nextPath = window.location.pathname + window.location.search;
    window.location.href = getLoginUrl(EXTERNAL.directus_url, EXTERNAL.auth_idp_key, encodeURIComponent(nextPath));
  };

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Show content if authenticated
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Show login prompt instead of content
  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200">
      <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
        <EyeOff className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        Login Required to view
      </h3>
      <button
        onClick={handleLogin}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        <LogIn className="w-3 h-3" />
        Login to View
      </button>
    </div>
  );
}