import React, { useEffect } from 'react';
import { EXTERNAL } from '@/constant';
import { getUserProfile } from '@/lib/utils';

interface ReferralHandlerProps {
  children?: React.ReactNode;
}

async function storeReferralCodeFromUrl(): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  if (refCode) {
    localStorage.setItem('ref_code', refCode);
  }
}

async function checkIfUserAlreadyClaimed(refCode: string, userId: string): Promise<boolean> {
  const checkUrl = `${EXTERNAL.directus_url}/items/referral_code?filter[code][_eq]=${encodeURIComponent(refCode)}&filter[user_claimed][directus_users_id][_eq]=${userId}&limit=1`;
  
  const response = await fetch(checkUrl, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Failed to check existing claims');
  }

  const result = await response.json();
  return result.data && result.data.length > 0;
}

async function getReferralCodeDetails(refCode: string): Promise<any> {
  const url = `${EXTERNAL.directus_url}/items/referral_code?filter[code][_eq]=${encodeURIComponent(refCode)}&limit=1`;
  
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Failed to get referral code details');
  }

  const result = await response.json();
  return result.data && result.data.length > 0 ? result.data[0] : null;
}

async function claimReferralCode(referralCodeId: string, userId: string): Promise<void> {
  const url = `${EXTERNAL.directus_url}/items/referral_code_directus_users`;
  
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      referral_code_id: referralCodeId,
      directus_users_id: userId
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`Failed to claim referral code: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`);
  }
}

async function processReferralCode(refCode: string, userId: string): Promise<void> {
  const alreadyClaimed = await checkIfUserAlreadyClaimed(refCode, userId);
  
  if (alreadyClaimed) {
    console.log('user already claimed ref code before');
    localStorage.removeItem('ref_code');
    return;
  }

  const referralCode = await getReferralCodeDetails(refCode);
  
  if (!referralCode) {
    console.log('referral code not found');
    localStorage.removeItem('ref_code');
    return;
  }

  await claimReferralCode(referralCode.id, userId);
  console.log('User successfully added to referral code claims');
  localStorage.removeItem('ref_code');
}

export default function ReferralHandler({ children }: ReferralHandlerProps) {
  useEffect(() => {
    async function handleReferralCode() {
      try {
        await storeReferralCodeFromUrl();
        
        const user = await getUserProfile(EXTERNAL.directus_url);
        if (!user) return;

        const storedRefCode = localStorage.getItem('ref_code');
        if (!storedRefCode) return;

        console.log('Referral code handling initiated.');
        await processReferralCode(storedRefCode, user.id);
        
      } catch (error) {
        console.error('Error handling referral code:', error);
      }
    }

    handleReferralCode();
  }, []);

  return children ? <>{children}</> : null;
}