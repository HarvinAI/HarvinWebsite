'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AuthRedirectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.replace('/signin');
      return;
    }

    const isAdmin = (session as unknown as Record<string, unknown>).isAdmin === true;

    if (isAdmin) {
      // Store user info for admin
      if (session.user) {
        localStorage.setItem('harvin_user', JSON.stringify({
          type: 'google',
          name: session.user.name ?? '',
          email: session.user.email ?? '',
        }));
      }
      router.replace('/onboarding');
    } else {
      // Store user info for non-admin
      if (session.user) {
        localStorage.setItem('harvin_user', JSON.stringify({
          type: 'google',
          name: session.user.name ?? '',
          email: session.user.email ?? '',
        }));
      }
      router.replace('/thankyou');
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen bg-[#f5f3f0] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-[3px] border-slate-200 border-t-[#C94C1E] animate-spin" />
        <p className="text-[14px] text-slate-400 font-medium">Setting up your account...</p>
      </div>
    </div>
  );
}
