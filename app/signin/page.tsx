'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState<'google' | 'credentials' | null>(null);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setLoading('google');
    setError('');
    try { await signIn('google', { callbackUrl: '/auth-redirect' }); }
    catch { setError('Google sign-in failed.'); setLoading(null); }
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading('credentials');
    setError('');
    const res = await signIn('credentials', { email: email.trim(), password, redirect: false });
    if (res?.error) { setError('Invalid email or password'); setLoading(null); }
    else {
      localStorage.setItem('harvin_user', JSON.stringify({ type: 'credentials', name: email.split('@')[0], email: email.trim() }));
      router.push('/auth-redirect');
    }
  };

  const Spinner = ({ className = '' }: { className?: string }) => (
    <span className={`w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin inline-block ${className}`} />
  );

  return (
    <div className="min-h-screen bg-[#f5f3f0] relative overflow-hidden flex items-center justify-center p-3 sm:p-6">
      <ThemeToggle />
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-[#C94C1E]/[0.04] blur-[80px]" />
        <div className="absolute bottom-[-150px] left-[-100px] w-[400px] h-[400px] rounded-full bg-[#C94C1E]/[0.03] blur-[60px]" />
        <div className="absolute top-[30%] left-[10%] w-[300px] h-[300px] rounded-full bg-amber-500/[0.02] blur-[60px]" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(circle, #c4beb6 0.8px, transparent 0.8px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[1060px] grid lg:grid-cols-[1.05fr_1fr] rounded-[28px] overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] bg-white">

        {/* ── Left ── */}
        <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[#1a1520] via-[#1e1028] to-[#0f1a2e]">
          {/* Warm amber/orange glow */}
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[60%] rounded-full bg-[#C94C1E]/30 blur-[90px]" />
          <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/15 blur-[80px]" />
          {/* Cool accent */}
          <div className="absolute bottom-[-10%] left-[10%] w-[80%] h-[50%] rounded-full bg-violet-600/20 blur-[100px]" />
          <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-sky-500/10 blur-[80px]" />
          {/* Soft mesh */}
          <div className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 50%)`,
            }}
          />

          <div className="relative z-10 flex flex-col justify-between p-11 w-full min-h-[640px]">
            {/* Top */}
            <div className="flex items-center gap-0.5">
              <div className="h-8 w-9 overflow-hidden flex-shrink-0">
                <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
              </div>
              <span className="font-bricolage font-bold text-[24px] tracking-normal text-white leading-none">
                Harvin<span className="font-semibold opacity-40">AI</span>
              </span>
            </div>

            {/* Center */}
            <div className="space-y-7">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#C94C1E] mb-4">Brand Intelligence Platform</p>
                <h2 className="text-[44px] font-extrabold text-white leading-[1.05] tracking-[-0.04em]">
                  Know Every<br />Brand Before<br />They Know You
                </h2>
                <p className="text-[14px] text-white/30 leading-[1.75] mt-5 max-w-[340px]">
                  Tech stack detection, buying signals, and decision-maker insights — all in one powerful platform.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { val: '500K+', label: 'Brands tracked' },
                  { val: '100+', label: 'Tech signals' },
                  { val: '<30s', label: 'Scan time' },
                ].map(s => (
                  <div key={s.label} className="bg-white/[0.04] rounded-xl px-4 py-3 border border-white/[0.05]">
                    <p className="text-[20px] font-bold text-white/90 tracking-tight">{s.val}</p>
                    <p className="text-[10px] text-white/25 font-medium mt-0.5 uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom testimonial */}
            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
              <p className="text-[13px] text-white/40 leading-[1.7] italic">
                &ldquo;HarvinAI helped us identify 3x more qualified D2C leads in the first month. The tech stack intelligence is a game-changer.&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C94C1E]/80 to-amber-500/80 flex items-center justify-center text-[11px] font-bold text-white">
                  SR
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white/60">Sarah R.</p>
                  <p className="text-[11px] text-white/25">Head of Sales, TechCorp</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right ── */}
        <div className="bg-white flex flex-col min-h-[640px]">
          {/* Top bar */}
          <div className="flex justify-between items-center px-8 pt-8 lg:px-10 lg:pt-9">
            <Link href="/" className="flex items-center gap-0.5 lg:hidden">
              <div className="h-8 w-9 overflow-hidden flex-shrink-0">
                <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
              </div>
              <span className="font-bricolage font-bold text-[24px] tracking-normal text-slate-900 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
            </Link>
            <div className="hidden lg:block" />
            <Link href="/signup" className="text-[12px] font-medium text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 px-3.5 py-1.5 rounded-lg border border-gray-100">
              Create account
            </Link>
          </div>

          {/* Form area */}
          <div className="flex-1 flex items-center justify-center px-8 py-6 lg:px-10">
            <div className="w-full max-w-[340px]">

              <div className="mb-8">
                <h1 className="text-[28px] font-extrabold text-gray-900 tracking-[-0.03em] leading-tight">
                  Welcome back
                </h1>
                <p className="text-[14px] text-gray-400 mt-1.5">
                  Enter your credentials to continue
                </p>
              </div>

              {/* Google */}
              <button type="button" onClick={handleGoogle} disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2.5 h-[44px] rounded-[10px]
                           border border-gray-200 bg-white text-gray-700
                           text-[13px] font-semibold
                           hover:bg-gray-50 hover:border-gray-300
                           active:scale-[0.995]
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all duration-150">
                {loading === 'google' ? <Spinner /> : (
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] font-medium text-gray-300 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Form */}
              <form onSubmit={handleCredentials} className="space-y-3.5">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="name@company.com" required autoComplete="email"
                    className="w-full h-[42px] px-3.5 rounded-[10px] border border-gray-200 bg-white
                               text-[14px] text-gray-900 placeholder:text-gray-300
                               focus:border-gray-400 focus:ring-[2px] focus:ring-gray-100
                               outline-none transition-all" />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password" required minLength={6} autoComplete="current-password"
                      className="w-full h-[42px] px-3.5 pr-11 rounded-[10px] border border-gray-200 bg-white
                                 text-[14px] text-gray-900 placeholder:text-gray-300
                                 focus:border-gray-400 focus:ring-[2px] focus:ring-gray-100
                                 outline-none transition-all" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <div className={`w-[16px] h-[16px] rounded-[4px] border-2 flex items-center justify-center transition-all cursor-pointer
                      ${remember ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-400'}`}
                      onClick={() => setRemember(!remember)}>
                      {remember && (
                        <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-[12px] text-gray-500">Remember me</span>
                  </label>
                  <Link href="/forgot-password" className="text-[12px] font-semibold text-[#C94C1E] hover:underline transition-colors">
                    Forgot Password?
                  </Link>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-red-50 border border-red-100">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                      <circle cx="8" cy="8" r="8" fill="#FEE2E2"/>
                      <path d="M8 5v3M8 10h.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p className="text-[13px] text-red-600 font-medium">{error}</p>
                  </div>
                )}

                {/* Sign In */}
                <button type="submit" disabled={loading !== null || !email || !password}
                  className="w-full h-[42px] rounded-[10px] bg-[#C94C1E] text-white text-[14px] font-semibold
                             flex items-center justify-center gap-2
                             hover:bg-[#b5431a] active:scale-[0.995]
                             shadow-[0_1px_3px_rgba(201,76,30,0.2),0_4px_12px_rgba(201,76,30,0.15)]
                             disabled:opacity-40 disabled:cursor-not-allowed
                             transition-all duration-150">
                  {loading === 'credentials' ? <Spinner className="text-white" /> : 'Sign In'}
                </button>
              </form>

            </div>
          </div>

          {/* Bottom */}
          <div className="px-8 pb-7 lg:px-10 text-center">
            <p className="text-[13px] text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold text-[#C94C1E] hover:underline transition-colors">Sign Up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
