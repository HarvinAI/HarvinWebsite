'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function SignInPage() {
  const router   = useRouter();
  const [loading, setLoading] = useState<'google' | 'demo' | null>(null);
  const [error,   setError]   = useState('');

  const handleGoogle = async () => {
    setLoading('google');
    setError('');
    try {
      await signIn('google', { callbackUrl: '/onboarding' });
    } catch {
      setError('Google sign-in failed. Please try again.');
      setLoading(null);
    }
  };

  const handleDemo = () => {
    setLoading('demo');
    localStorage.setItem('harvin_user', JSON.stringify({
      type:  'demo',
      name:  'Demo User',
      email: 'demo@harvinai.com',
    }));
    router.push('/onboarding');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">

      {/* Card */}
      <div className="w-full max-w-[420px]">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-9 w-9" />
            <span className="font-jakarta font-bold text-[26px] tracking-[-0.02em] text-slate-900 leading-none">
              Harvin<span className="font-normal opacity-35">AI</span>
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-8 py-9">

          <div className="text-center mb-8">
            <h1 className="text-[22px] font-semibold text-slate-900 tracking-[-0.02em] mb-2">
              Welcome to HarvinAI
            </h1>
            <p className="text-[14px] text-slate-500">
              Sign in to access D2C brand intelligence
            </p>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl
                       border border-slate-200 bg-white text-slate-700
                       text-[14px] font-semibold
                       hover:bg-slate-50 hover:border-slate-300
                       shadow-sm hover:shadow-md
                       transition-all duration-200
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading === 'google' ? (
              <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[12px] font-medium text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Demo */}
          <button
            onClick={handleDemo}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2.5 h-12 rounded-xl
                       border border-dashed border-ember-300 bg-ember-50
                       text-[14px] font-semibold text-ember-700
                       hover:bg-ember-100 hover:border-ember-400
                       transition-all duration-200
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading === 'demo' ? (
              <span className="w-4 h-4 rounded-full border-2 border-ember-300 border-t-ember-600 animate-spin" />
            ) : (
              <span className="text-[16px]">🚀</span>
            )}
            Try Demo — No login required
          </button>

          {error && (
            <p className="mt-4 text-center text-[13px] text-red-500">{error}</p>
          )}

          {/* Note */}
          <p className="mt-6 text-center text-[12px] text-slate-400 leading-relaxed">
            By continuing, you agree to our{' '}
            <span className="text-slate-500 cursor-default">Terms of Service</span>
            {' '}and{' '}
            <span className="text-slate-500 cursor-default">Privacy Policy</span>
          </p>
        </div>

        <p className="text-center text-[12px] text-slate-400 mt-5">
          Early access ·{' '}
          <Link href="/" className="hover:text-slate-600 transition-colors">
            Back to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
