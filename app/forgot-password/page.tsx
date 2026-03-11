'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, ArrowLeft, KeyRound, ShieldCheck, CheckCircle2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp' | 'newpass' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send code'); setLoading(false); return; }
      setStep('otp');
      setCountdown(60);
      setLoading(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch { setError('Something went wrong.'); setLoading(false); }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to resend'); setLoading(false); return; }
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      setLoading(false);
    } catch { setError('Something went wrong.'); setLoading(false); }
  };

  const handleVerifyOtp = async (otpValue?: string) => {
    const code = otpValue || otp.join('');
    if (code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid code'); setLoading(false); return; }
      setStep('newpass');
      setLoading(false);
    } catch { setError('Something went wrong.'); setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.join(''), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Reset failed'); setLoading(false); return; }
      setStep('done');
      setLoading(false);
    } catch { setError('Something went wrong.'); setLoading(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
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
    if (pasted.length < 6) inputRefs.current[pasted.length]?.focus();
  };

  const Spinner = ({ className = '' }: { className?: string }) => (
    <span className={`w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin inline-block ${className}`} />
  );

  const pwStrength = newPassword.length === 0 ? 0 : newPassword.length < 6 ? 1 : newPassword.length < 10 ? 2 : 3;
  const pwColors = ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400'];
  const pwLabels = ['', 'Weak', 'Good', 'Strong'];

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

      <div className="relative z-10 w-full max-w-[1060px] grid lg:grid-cols-[1.05fr_1fr] rounded-[28px] overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] bg-white">

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
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#C94C1E] mb-4">Account Recovery</p>
                <h2 className="text-[44px] font-extrabold text-white leading-[1.05] tracking-[-0.04em]">
                  Secure Your<br />Account<br />Access
                </h2>
                <p className="text-[14px] text-white/30 leading-[1.75] mt-5 max-w-[340px]">
                  Reset your password quickly and get back to discovering brand intelligence.
                </p>
              </div>
            </div>

            <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white/50">Secure reset process</p>
                  <p className="text-[11px] text-white/25 mt-0.5">Encrypted & OTP verified</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right ── */}
        <div className="bg-white flex flex-col min-h-[640px]">
          <div className="flex justify-between items-center px-8 pt-8 lg:px-10 lg:pt-9">
            <Link href="/" className="flex items-center gap-0.5 lg:hidden">
              <div className="h-8 w-9 overflow-hidden flex-shrink-0">
                <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
              </div>
              <span className="font-bricolage font-bold text-[24px] tracking-normal text-slate-900 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
            </Link>
            <div className="hidden lg:block" />
            <Link href="/signin" className="text-[12px] font-medium text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 px-3.5 py-1.5 rounded-lg border border-gray-100">
              Back to Sign in
            </Link>
          </div>

          <div className="flex-1 flex items-center justify-center px-8 py-6 lg:px-10">
            <div className="w-full max-w-[340px]">

              {/* ── Step: Email ── */}
              {step === 'email' && (
                <>
                  <Link href="/signin" className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 font-medium mb-8 transition-colors">
                    <ArrowLeft size={14} /> Back to Sign In
                  </Link>

                  <div className="mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-[#C94C1E]/[0.06] border border-[#C94C1E]/10 flex items-center justify-center mb-5">
                      <KeyRound size={22} className="text-[#C94C1E]" />
                    </div>
                    <h1 className="text-[26px] font-extrabold text-gray-900 tracking-[-0.03em] leading-tight">
                      Reset password
                    </h1>
                    <p className="text-[14px] text-gray-400 mt-1.5">
                      Enter your email and we&apos;ll send a reset code
                    </p>
                  </div>

                  <form onSubmit={handleSendCode} className="space-y-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="name@company.com" required autoComplete="email" autoFocus
                        className="w-full h-[42px] px-3.5 rounded-[10px] border border-gray-200 bg-white
                                   text-[14px] text-gray-900 placeholder:text-gray-300
                                   focus:border-gray-400 focus:ring-[2px] focus:ring-gray-100
                                   outline-none transition-all" />
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

                    <button type="submit" disabled={loading || !email}
                      className="w-full h-[42px] rounded-[10px] bg-[#C94C1E] text-white text-[14px] font-semibold
                                 flex items-center justify-center gap-2
                                 hover:bg-[#b5431a] active:scale-[0.995]
                                 shadow-[0_1px_3px_rgba(201,76,30,0.2),0_4px_12px_rgba(201,76,30,0.15)]
                                 disabled:opacity-40 disabled:cursor-not-allowed
                                 transition-all duration-150">
                      {loading ? <Spinner className="text-white" /> : 'Send Reset Code'}
                    </button>
                  </form>
                </>
              )}

              {/* ── Step: OTP ── */}
              {step === 'otp' && (
                <>
                  <button onClick={() => { setStep('email'); setError(''); setOtp(['', '', '', '', '', '']); }}
                    className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 font-medium mb-8 transition-colors">
                    <ArrowLeft size={14} /> Back
                  </button>

                  <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-[#C94C1E]/[0.06] border border-[#C94C1E]/10 flex items-center justify-center mb-5 mx-auto">
                      <ShieldCheck size={26} className="text-[#C94C1E]" />
                    </div>
                    <h1 className="text-[26px] font-extrabold text-gray-900 tracking-[-0.03em] mb-2">
                      Enter code
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
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-red-50 border border-red-100 mb-4">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <circle cx="8" cy="8" r="8" fill="#FEE2E2"/>
                        <path d="M8 5v3M8 10h.01" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <p className="text-[13px] text-red-600 font-medium">{error}</p>
                    </div>
                  )}

                  <button onClick={() => handleVerifyOtp()} disabled={loading || otp.join('').length !== 6}
                    className="w-full h-[42px] rounded-[10px] bg-[#C94C1E] text-white text-[14px] font-semibold
                               flex items-center justify-center gap-2
                               hover:bg-[#b5431a] active:scale-[0.995]
                               shadow-[0_1px_3px_rgba(201,76,30,0.2),0_4px_12px_rgba(201,76,30,0.15)]
                               disabled:opacity-40 disabled:cursor-not-allowed
                               transition-all duration-150">
                    {loading ? <Spinner className="text-white" /> : 'Verify Code'}
                  </button>

                  <div className="mt-5 text-center">
                    <p className="text-[13px] text-gray-400">
                      Didn&apos;t receive the code?{' '}
                      {countdown > 0 ? (
                        <span className="text-gray-300">Resend in {countdown}s</span>
                      ) : (
                        <button onClick={handleResend} disabled={loading}
                          className="font-semibold text-[#C94C1E] hover:underline transition-colors disabled:opacity-50">
                          {loading ? 'Sending...' : 'Resend code'}
                        </button>
                      )}
                    </p>
                  </div>
                </>
              )}

              {/* ── Step: New Password ── */}
              {step === 'newpass' && (
                <>
                  <button onClick={() => { setStep('otp'); setError(''); }}
                    className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 font-medium mb-8 transition-colors">
                    <ArrowLeft size={14} /> Back
                  </button>

                  <div className="mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-[#C94C1E]/[0.06] border border-[#C94C1E]/10 flex items-center justify-center mb-5">
                      <KeyRound size={22} className="text-[#C94C1E]" />
                    </div>
                    <h1 className="text-[26px] font-extrabold text-gray-900 tracking-[-0.03em] leading-tight">
                      New password
                    </h1>
                    <p className="text-[14px] text-gray-400 mt-1.5">
                      Choose a strong password for your account
                    </p>
                  </div>

                  <form onSubmit={handleResetPassword} className="space-y-3.5">
                    <div>
                      <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">New Password</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                          placeholder="Min. 6 characters" required minLength={6} autoComplete="new-password" autoFocus
                          className="w-full h-[42px] px-3.5 pr-11 rounded-[10px] border border-gray-200 bg-white
                                     text-[14px] text-gray-900 placeholder:text-gray-300
                                     focus:border-gray-400 focus:ring-[2px] focus:ring-gray-100
                                     outline-none transition-all" />
                        <button type="button" onClick={() => setShowPw(!showPw)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {newPassword.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex gap-1 flex-1">
                            {[1, 2, 3].map(i => (
                              <div key={i} className={`h-[3px] flex-1 rounded-full transition-colors ${i <= pwStrength ? pwColors[pwStrength] : 'bg-gray-100'}`} />
                            ))}
                          </div>
                          <span className={`text-[11px] font-medium ${pwStrength === 1 ? 'text-red-500' : pwStrength === 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {pwLabels[pwStrength]}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password" required minLength={6} autoComplete="new-password"
                        className="w-full h-[42px] px-3.5 rounded-[10px] border border-gray-200 bg-white
                                   text-[14px] text-gray-900 placeholder:text-gray-300
                                   focus:border-gray-400 focus:ring-[2px] focus:ring-gray-100
                                   outline-none transition-all" />
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

                    <button type="submit" disabled={loading || newPassword.length < 6 || !confirmPassword}
                      className="w-full h-[42px] rounded-[10px] bg-[#C94C1E] text-white text-[14px] font-semibold
                                 flex items-center justify-center gap-2
                                 hover:bg-[#b5431a] active:scale-[0.995]
                                 shadow-[0_1px_3px_rgba(201,76,30,0.2),0_4px_12px_rgba(201,76,30,0.15)]
                                 disabled:opacity-40 disabled:cursor-not-allowed
                                 transition-all duration-150">
                      {loading ? <Spinner className="text-white" /> : 'Reset Password'}
                    </button>
                  </form>
                </>
              )}

              {/* ── Step: Done ── */}
              {step === 'done' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6 mx-auto">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                  </div>
                  <h1 className="text-[26px] font-extrabold text-gray-900 tracking-[-0.03em] mb-2">
                    Password reset
                  </h1>
                  <p className="text-[14px] text-gray-400 mb-8 max-w-[280px] mx-auto">
                    Your password has been successfully updated. Sign in with your new password.
                  </p>
                  <button onClick={() => router.push('/signin')}
                    className="w-full h-[42px] rounded-[10px] bg-[#C94C1E] text-white text-[14px] font-semibold
                               flex items-center justify-center gap-2
                               hover:bg-[#b5431a] active:scale-[0.995]
                               shadow-[0_1px_3px_rgba(201,76,30,0.2),0_4px_12px_rgba(201,76,30,0.15)]
                               transition-all duration-150">
                    Go to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>

          {step !== 'done' && (
            <div className="px-8 pb-7 lg:px-10 text-center">
              <p className="text-[13px] text-gray-400">
                Remember your password?{' '}
                <Link href="/signin" className="font-semibold text-[#C94C1E] hover:underline transition-colors">Sign In</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
