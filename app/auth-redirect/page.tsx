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

    // Store user info
    if (session.user) {
      localStorage.setItem('harvin_user', JSON.stringify({
        type: 'google',
        name: session.user.name ?? '',
        email: session.user.email ?? '',
      }));
    }

    const isAdmin = (session as unknown as Record<string, unknown>).isAdmin === true;

    if (!isAdmin) {
      router.replace('/thankyou');
      return;
    }

    // Admin: check if onboarding already completed (localStorage first, then DB)
    const saved = localStorage.getItem('harvin_onboarding');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.completed) {
          router.replace('/dashboard');
          return;
        }
      } catch {}
    }

    // Check DB for onboarding status (handles cross-browser/device)
    const email = session.user?.email;
    if (email) {
      fetch(`/api/onboarding?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(data => {
          if (data.completed) {
            // Sync to localStorage so future checks are instant
            localStorage.setItem('harvin_onboarding', JSON.stringify({ completed: true }));
            router.replace('/dashboard');
          } else {
            router.replace('/onboarding');
          }
        })
        .catch(() => {
          router.replace('/onboarding');
        });
    } else {
      router.replace('/onboarding');
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
