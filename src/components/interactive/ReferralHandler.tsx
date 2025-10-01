import React, { useEffect } from 'react';
import { EXTERNAL } from '@/constant';
import { getUserProfile } from '@/lib/utils';

interface ReferralHandlerProps {
  children?: React.ReactNode;
}

export default function ReferralHandler({ children }: ReferralHandlerProps) {
  useEffect(() => {
    async function handleReferralCode() {
      try {
        // Check for ref parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');

        if (refCode) {
          // Store referral code in localStorage
          localStorage.setItem('ref_code', refCode);
        }


        // Check if user is logged in and handle claimed referral codes
        const user = await getUserProfile(EXTERNAL.directus_url);

        if (user) {
          const storedRefCode = localStorage.getItem('ref_code');

          if (storedRefCode) {
            console.log('Referral code handling initiated.');

            // get data if currently passed ref code
            const checkUrl = `${EXTERNAL.directus_url}/items/referral_code?filter[code][_eq]=${encodeURIComponent(storedRefCode)}&fields=*,user_claimed&limit=1`;

            const response = await fetch(checkUrl, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
              const result = await response.json();
              console.log(result);

              // Check if the current user is in the user_claimed many-to-many relationship
              if (result.data && result.data.length > 0) {
                const referralCode = result.data[0];
                const isAlreadyClaimed = referralCode.user_claimed?.some((userId: string) => userId === user.id);

                if (isAlreadyClaimed) {
                  console.log('user already claimed ref code before');

                  localStorage.removeItem('ref_code');
                }
                // TODO
              }
            }
          }
        }
      } catch (error) {
        console.error('Error handling referral code:', error);
      }
    }

    handleReferralCode();
  }, []);

  // Just render children if provided, otherwise render nothing
  return children ? <>{children}</> : null;
}