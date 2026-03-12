'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';

import ThemeToggle from '@/components/ThemeToggle';

export default function ThankYouPage() {
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      const u = localStorage.getItem('harvin_user');
      if (u) {
        const parsed = JSON.parse(u);
        setName(parsed.name?.split(' ')[0] || '');
      }
    } catch {}
  }, []);

  const handleLogout = () => {
    ['harvin_user', 'harvin_onboarding', 'harvin_dashboard_filters'].forEach(k => localStorage.removeItem(k));
    signOut({ callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-[#f5f3f0] relative overflow-hidden flex items-center justify-center p-4">
      <ThemeToggle />
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-[#C94C1E]/[0.04] blur-[80px]" />
        <div className="absolute bottom-[-150px] left-[-100px] w-[400px] h-[400px] rounded-full bg-[#C94C1E]/[0.03] blur-[60px]" />
        <div className="absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(circle, #c4beb6 0.8px, transparent 0.8px)', backgroundSize: '32px 32px' }}
        />
      </div>

      <div className="relative z-10 max-w-[520px] w-full">
        <div className="bg-white rounded-[28px] shadow-[0_20px_70px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] p-10 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-0.5 mb-8">
            <div className="h-8 w-9 overflow-hidden flex-shrink-0">
              <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-auto max-w-none" />
            </div>
            <span className="font-bricolage font-bold text-[24px] tracking-normal text-slate-900 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
          </div>

          {/* Checkmark */}
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Message */}
          <h1 className="text-[28px] font-extrabold text-slate-900 tracking-[-0.03em] leading-tight mb-3">
            Thank you{name ? `, ${name}` : ''}!
          </h1>
          <p className="text-[15px] text-slate-500 leading-relaxed mb-2">
            We appreciate your interest in HarvinAI.
          </p>
          <p className="text-[14px] text-slate-400 leading-relaxed mb-8 max-w-[380px] mx-auto">
            Our platform is currently in early access. We&apos;ll review your account and notify you as soon as access is available for you.
          </p>

          {/* What to expect */}
          <div className="bg-slate-50 rounded-2xl p-6 mb-8 text-left">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">What to expect</p>
            <div className="space-y-3.5">
              {[
                { icon: '1', text: 'Your account is being reviewed by our team' },
                { icon: '2', text: 'You\'ll receive an email once your access is approved' },
                { icon: '3', text: 'Full access to brand intelligence, tech detection & more' },
              ].map(item => (
                <div key={item.icon} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[11px] font-bold text-[#C94C1E]">{item.icon}</span>
                  </div>
                  <p className="text-[13px] text-slate-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <p className="text-[13px] text-slate-400 mb-6">
            Questions? Reach us at{' '}
            <a href="mailto:admin@harvin.ai" className="text-[#C94C1E] font-semibold hover:underline">admin@harvin.ai</a>
          </p>

          <a href="/"
            className="inline-block px-6 py-2.5 bg-[#C94C1E] text-white text-[14px] font-semibold rounded-xl hover:bg-[#b3421a] transition-colors mb-4">
            Back to Homepage
          </a>

          <br />
          <button onClick={handleLogout}
            className="text-[13px] font-medium text-slate-400 hover:text-slate-600 transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
