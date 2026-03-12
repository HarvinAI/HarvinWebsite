'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, ArrowLeft, ShieldCheck, ChevronDown } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const JOB_ROLES = ['Owner/Founder', 'Marketing', 'Sales', 'Growth', 'Other'];
const HEARD_FROM = [
  'LinkedIn', 'Twitter / X', 'Google Search', 'Friend / Colleague',
  'Product Hunt', 'Newsletter', 'YouTube', 'Podcast', 'Other',
];

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLink, setCompanyLink] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [heardFrom, setHeardFrom] = useState<string[]>([]);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState<'google' | 'credentials' | 'otp' | 'resend' | null>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const toggleHeardFrom = (value: string) => {
    setHeardFrom(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleGoogle = async () => {
    setLoading('google');
    setError('');
    try { await signIn('google', { callbackUrl: '/auth-redirect' }); }
    catch { setError('Google sign-up failed.'); setLoading(null); }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setLoading('credentials');
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send code'); setLoading(null); return; }
      setStep('otp');
      setCountdown(60);
      setLoading(null);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch { setError('Something went wrong.'); setLoading(null); }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading('resend');
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to resend'); setLoading(null); return; }
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      setLoading(null);
    } catch { setError('Something went wrong.'); setLoading(null); }
  };

  const handleVerifyOtp = async (otpValue?: string) => {
    const code = otpValue || otp.join('');
    if (code.length !== 6) return;
    setLoading('otp');
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code, name: name.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Verification failed'); setLoading(null); return; }
      const signInRes = await signIn('credentials', { email: email.trim(), password, redirect: false });
      if (signInRes?.error) { router.push('/signin'); return; }
      localStorage.setItem('harvin_user', JSON.stringify({ type: 'credentials', name: name.trim(), email: email.trim() }));
      const onboardingData = {
        step: 0,
        answers: {
          fullName: name.trim(),
          email: email.trim(),
          ...(companyName.trim() && { companyName: companyName.trim() }),
          ...(companyLink.trim() && { companyLink: companyLink.trim() }),
          ...(jobRole && { jobRole }),
          ...(heardFrom.length > 0 && { heardFrom }),
        },
      };
      localStorage.setItem('harvin_onboarding', JSON.stringify(onboardingData));
      router.push('/auth-redirect');
    } catch { setError('Something went wrong.'); setLoading(null); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    const full = newOtp.join('');
    if (full.length === 6) handleVerifyOtp(full);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) newOtp[i] = pasted[i] || '';
    setOtp(newOtp);
    if (pasted.length === 6) handleVerifyOtp(pasted);
    else inputRefs.current[pasted.length]?.focus();
  };

  const Spinner = ({ className = '' }: { className?: string }) => (
    <span className={`w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin inline-block ${className}`} />
  );

  const pwStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pwColors = ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400'];
  const pwLabels = ['', 'Weak', 'Good', 'Strong'];

  const inputCls = `w-full h-[40px] px-3.5 rounded-[10px] border border-gray-200 bg-white
                     text-[13px] text-gray-900 placeholder:text-gray-300
                     focus:border-gray-400 focus:ring-[2px] focus:ring-gray-100
                     outline-none transition-all`;

  return (
    <div className="min-h-screen bg-[#f5f3f0] relative overflow-hidden flex items-center justify-center p-3 sm:p-6">
      <ThemeToggle />
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-[#C94C1E]/[0.04] blur-[80px]" />
        <div className="absolute bottom-[-150px] left-[-100px] w-[400px] h-[400px] rounded-full bg-[#C94C1E]/[0.03] blur-[60px]" />
        <div className="absolute top-[30%] left-[10%] w-[300px] h-[300px] rounded-full bg-amber-500/[0.02] blur-[60px]" />
        <div className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(circle, #c4beb6 0.8px, transparent 0.8px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[1140px] max-h-[calc(100vh-48px)] grid lg:grid-cols-[1fr_1.15fr] rounded-[28px] overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] bg-white">

        {/* ── Left ── */}
        <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[#1a1520] via-[#1e1028] to-[#0f1a2e]">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[60%] rounded-full bg-[#C94C1E]/30 blur-[90px]" />
          <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/15 blur-[80px]" />
          <div className="absolute bottom-[-10%] left-[10%] w-[80%] h-[50%] rounded-full bg-violet-600/20 blur-[100px]" />
          <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-sky-500/10 blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 50%)`,
            }}
          />

          <div className="relative z-10 flex flex-col justify-between p-11 w-full min-h-[640px]">
            <div className="flex items-center gap-0.5">
              <div className="h-8 w-9 overflow-hidden flex-shrink-0">
                <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
              </div>
              <span className="font-bricolage font-bold text-[24px] tracking-normal text-white leading-none">
                Harvin<span className="font-semibold opacity-40">AI</span>
              </span>
            </div>

            <div className="space-y-7">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#C94C1E] mb-4">Get Started Free</p>
                <h2 className="text-[44px] font-extrabold text-white leading-[1.05] tracking-[-0.04em]">
                  Start Finding<br />Your Best<br />Customers
                </h2>
                <p className="text-[14px] text-white/30 leading-[1.75] mt-5 max-w-[340px]">
                  Join sales teams who close faster with tech stack intelligence and real-time buying signals.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { num: '01', text: 'Create your free account' },
                  { num: '02', text: 'Verify your email' },
                  { num: '03', text: 'Start discovering brands' },
                ].map(s => (
                  <div key={s.num} className="bg-white/[0.04] rounded-xl px-3.5 py-3 border border-white/[0.05]">
                    <p className="text-[10px] font-bold text-[#C94C1E]/80 mb-1">STEP {s.num}</p>
                    <p className="text-[11px] text-white/40 font-medium leading-snug">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex -space-x-1.5">
                {['S', 'A', 'R', 'M'].map((l, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-[1.5px] border-[#1a1520] bg-gradient-to-br from-white/15 to-white/5 flex items-center justify-center text-[10px] font-bold text-white/50">
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/25">Trusted by <span className="text-white/45 font-medium">2,400+</span> teams</p>
            </div>
          </div>
        </div>

        {/* ── Right ── */}
        <div className="bg-white flex flex-col min-h-[640px] max-h-[calc(100vh-48px)]">
          {/* Sticky header */}
          <div className="flex justify-between items-center px-8 pt-6 pb-0 lg:px-10 flex-shrink-0">
            <Link href="/" className="flex items-center gap-0.5 lg:hidden">
              <div className="h-8 w-9 overflow-hidden flex-shrink-0">
                <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
              </div>
              <span className="font-bricolage font-bold text-[24px] tracking-normal text-slate-900 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
            </Link>
            <div className="hidden lg:block" />
            <Link href="/signin" className="text-[12px] font-medium text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 px-3.5 py-1.5 rounded-lg border border-gray-100">
              Sign in
            </Link>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-8 py-5 lg:px-10">
            <div className="w-full max-w-[420px] mx-auto">

              {step === 'form' ? (
                <>
                  <div className="mb-6">
                    <h1 className="text-[26px] font-extrabold text-gray-900 tracking-[-0.03em] leading-tight">
                      Create account
                    </h1>
                    <p className="text-[13px] text-gray-400 mt-1">
                      Get started with free brand intelligence
                    </p>
                  </div>

                  {/* Google */}
                  <button type="button" onClick={handleGoogle} disabled={loading !== null}
                    className="w-full flex items-center justify-center gap-2.5 h-[42px] rounded-[10px]
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

                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[11px] font-medium text-gray-300 uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  <form onSubmit={handleSendOtp} className="space-y-3">
                    {/* Name & Email — side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[12px] font-semibold text-gray-700 mb-1">Full Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                          placeholder="John Doe" required autoComplete="name"
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[12px] font-semibold text-gray-700 mb-1">Work Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="name@company.com" required autoComplete="email"
                          className={inputCls} />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[12px] font-semibold text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="Min. 6 characters" required minLength={6} autoComplete="new-password"
                          className={`${inputCls} !pr-10`} />
                        <button type="button" onClick={() => setShowPw(!showPw)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {password.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex gap-1 flex-1">
                            {[1, 2, 3].map(i => (
                              <div key={i} className={`h-[2.5px] flex-1 rounded-full transition-colors ${i <= pwStrength ? pwColors[pwStrength] : 'bg-gray-100'}`} />
                            ))}
                          </div>
                          <span className={`text-[10px] font-medium ${pwStrength === 1 ? 'text-red-500' : pwStrength === 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {pwLabels[pwStrength]}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Divider — About You */}
                    <div className="pt-1">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-[0.1em]">About you</span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>
                    </div>

                    {/* Company Name & Website — side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                          Company <span className="font-normal text-gray-300">(optional)</span>
                        </label>
                        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                          placeholder="Acme Inc." autoComplete="organization"
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                          Website <span className="font-normal text-gray-300">(optional)</span>
                        </label>
                        <input type="text" value={companyLink} onChange={e => setCompanyLink(e.target.value)}
                          placeholder="yourcompany.com" autoComplete="url"
                          className={inputCls} />
                      </div>
                    </div>

                    {/* Job Function */}
                    <div>
                      <label className="block text-[12px] font-semibold text-gray-700 mb-1">
                        Job Function <span className="font-normal text-gray-300">(optional)</span>
                      </label>
                      <div className="relative">
                        <select value={jobRole} onChange={e => setJobRole(e.target.value)}
                          className={`w-full h-[40px] px-3.5 pr-10 rounded-[10px] border border-gray-200 bg-white
                                     text-[13px] appearance-none cursor-pointer
                                     focus:border-gray-400 focus:ring-[2px] focus:ring-gray-100
                                     outline-none transition-all ${jobRole ? 'text-gray-900' : 'text-gray-300'}`}>
                          <option value="" disabled>Select your role...</option>
                          {JOB_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* How Did You Hear */}
                    <div>
                      <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                        How did you hear about us? <span className="font-normal text-gray-300">(optional)</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {HEARD_FROM.map(s => (
                          <button key={s} type="button" onClick={() => toggleHeardFrom(s)}
                            className={`rounded-full border px-2.5 py-[3px] text-[11px] font-medium transition-all duration-150 ${
                              heardFrom.includes(s)
                                ? 'border-[#C94C1E] bg-[#C94C1E] text-white'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                            }`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-red-50 border border-red-100">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                          <circle cx="8" cy="8" r="8" fill="#FEE2E2"/>
                          <path d="M8 5v3M8 10h.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <p className="text-[12px] text-red-600 font-medium">{error}</p>
                      </div>
                    )}

                    <button type="submit" disabled={loading !== null || !name || !email || password.length < 6}
                      className="w-full h-[42px] rounded-[10px] bg-[#C94C1E] text-white text-[13px] font-semibold
                                 flex items-center justify-center gap-2
                                 hover:bg-[#b5431a] active:scale-[0.995]
                                 shadow-[0_1px_3px_rgba(201,76,30,0.2),0_4px_12px_rgba(201,76,30,0.15)]
                                 disabled:opacity-40 disabled:cursor-not-allowed
                                 transition-all duration-150">
                      {loading === 'credentials' ? <Spinner className="text-white" /> : 'Create Account'}
                    </button>
                  </form>

                  <p className="text-center text-[11px] text-gray-300 mt-3 leading-relaxed">
                    By creating an account, you agree to our{' '}
                    <span className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">Terms</span>
                    {' '}and{' '}
                    <span className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">Privacy Policy</span>
                  </p>
                </>
              ) : (
                /* ── OTP Step ── */
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                  <button onClick={() => { setStep('form'); setError(''); setOtp(['', '', '', '', '', '']); }}
                    className="self-start flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 font-medium mb-8 transition-colors">
                    <ArrowLeft size={14} /> Back
                  </button>

                  <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-[#C94C1E]/[0.06] border border-[#C94C1E]/10 flex items-center justify-center mb-5 mx-auto">
                      <ShieldCheck size={26} className="text-[#C94C1E]" />
                    </div>
                    <h1 className="text-[26px] font-extrabold text-gray-900 tracking-[-0.03em] mb-2">
                      Verify your email
                    </h1>
                    <p className="text-[14px] text-gray-400">
                      We sent a 6-digit code to{' '}
                      <span className="text-gray-700 font-semibold">{email}</span>
                    </p>
                  </div>

                  <div className="flex gap-2.5 justify-center mb-6" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className={`w-[46px] h-[52px] rounded-[10px] border-2 bg-white
                                   text-center text-[20px] font-bold text-gray-900
                                   outline-none transition-all
                                   ${digit ? 'border-[#C94C1E] ring-2 ring-[#C94C1E]/10' : 'border-gray-200'}
                                   focus:border-[#C94C1E] focus:ring-2 focus:ring-[#C94C1E]/10`}
                      />
                    ))}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-red-50 border border-red-100 mb-4 w-full">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <circle cx="8" cy="8" r="8" fill="#FEE2E2"/>
                        <path d="M8 5v3M8 10h.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <p className="text-[13px] text-red-600 font-medium">{error}</p>
                    </div>
                  )}

                  <button onClick={() => handleVerifyOtp()} disabled={loading === 'otp' || otp.join('').length !== 6}
                    className="w-full h-[42px] rounded-[10px] bg-[#C94C1E] text-white text-[14px] font-semibold
                               flex items-center justify-center gap-2
                               hover:bg-[#b5431a] active:scale-[0.995]
                               shadow-[0_1px_3px_rgba(201,76,30,0.2),0_4px_12px_rgba(201,76,30,0.15)]
                               disabled:opacity-40 disabled:cursor-not-allowed
                               transition-all duration-150">
                    {loading === 'otp' ? <Spinner className="text-white" /> : 'Verify & Create Account'}
                  </button>

                  <div className="mt-5 text-center">
                    <p className="text-[13px] text-gray-400">
                      Didn&apos;t receive the code?{' '}
                      {countdown > 0 ? (
                        <span className="text-gray-300">Resend in {countdown}s</span>
                      ) : (
                        <button onClick={handleResend} disabled={loading === 'resend'}
                          className="font-semibold text-[#C94C1E] hover:underline transition-colors disabled:opacity-50">
                          {loading === 'resend' ? 'Sending...' : 'Resend code'}
                        </button>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="px-8 pb-5 lg:px-10 text-center flex-shrink-0">
            <p className="text-[12px] text-gray-400">
              Already have an account?{' '}
              <Link href="/signin" className="font-semibold text-[#C94C1E] hover:underline transition-colors">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
