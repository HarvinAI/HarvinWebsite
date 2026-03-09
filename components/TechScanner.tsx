'use client';

import { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const DEMO_BRANDS = [
  { name: 'Mamaearth', url: 'mamaearth.in' },
  { name: 'boAt', url: 'boat-lifestyle.com' },
  { name: 'Sugar Cosmetics', url: 'sugarcosmetics.com' },
  { name: 'Lenskart', url: 'lenskart.com' },
];

const SCAN_STORAGE_KEY = 'harvin_free_scan_used';

export default function TechScanner() {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState('');
  const [scanGated, setScanGated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function isFreeScanUsed(): boolean {
    try { return localStorage.getItem(SCAN_STORAGE_KEY) === '1'; } catch { return false; }
  }

  function isLoggedIn(): boolean {
    try { return !!localStorage.getItem('harvin_user'); } catch { return false; }
  }

  function navigateToScan(url: string) {
    if (!url.trim()) return;

    // Gate: if free scan already used and not logged in, block
    if (isFreeScanUsed() && !isLoggedIn()) {
      setScanGated(true);
      return;
    }

    // Clean up the domain for URL
    const domain = url.trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');

    router.push(`/scan/${encodeURIComponent(domain)}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    navigateToScan(inputUrl);
  }

  function handleDemo(url: string) {
    setInputUrl(url);
    navigateToScan(url);
  }

  return (
    <section id="scanner" className="py-12 px-6 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">

        {/* Highlighted scanner card */}
        <div className="relative max-w-3xl mx-auto mb-8">
          {/* Animated glow behind card */}
          <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-r from-[#C94C1E]/20 via-amber-500/10 to-[#C94C1E]/20 blur-2xl opacity-60 pointer-events-none" />

          {/* Running glowing border */}
          <div className="glow-border rounded-[20px] p-[2px] shadow-[0_8px_40px_rgba(201,76,30,0.08),0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="glow-border-inner rounded-[18px] p-6 sm:p-8">

              {/* Scanner header */}
              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C94C1E]/10 text-[#C94C1E] text-[12px] font-semibold mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C94C1E] animate-pulse" />
                  Free Scan
                </div>
                <h3 className="text-[20px] sm:text-[24px] font-semibold text-slate-900 dark:text-slate-100 tracking-[-0.02em] mb-1.5">
                  Scan any D2C Brand instantly
                </h3>
                <p className="text-[13px] sm:text-[14px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Enter any URL and map its entire tech stack, Store count and more.
                </p>
              </div>

              {/* Search form */}
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus-within:border-[#C94C1E]/60 focus-within:shadow-[0_0_0_3px_rgba(201,76,30,0.1)] focus-within:bg-white dark:focus-within:bg-slate-800 transition-all duration-200"
              >
                <div className="pl-2 flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 2c-2 2-3 5-3 8s1 6 3 8M10 2c2 2 3 5 3 8s-1 6-3 8M2 10h16" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputUrl}
                  onChange={e => setInputUrl(e.target.value)}
                  placeholder="e.g. mamaearth.in or https://boat-lifestyle.com"
                  className="flex-1 bg-transparent outline-none text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-0"
                />
                <button
                  type="submit"
                  disabled={!inputUrl.trim()}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[14px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_2px_8px_rgba(201,76,30,0.3)]"
                >
                  Scan
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h9M8 4l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>

              {/* Demo brands */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="text-[12px] text-slate-400 dark:text-slate-500">Try:</span>
                {DEMO_BRANDS.map(b => (
                  <button
                    key={b.url}
                    type="button"
                    onClick={() => handleDemo(b.url)}
                    className="text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-[#C94C1E] dark:hover:text-[#C94C1E] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#C94C1E]/5 transition-all"
                  >
                    {b.name}
                  </button>
                ))}
              </div>

              {/* Sign-up gate */}
              {scanGated && (
                <div className="mt-6 text-center">
                  <div className="bg-gradient-to-br from-orange-50 to-white dark:from-slate-800 dark:to-slate-900 border border-orange-200 dark:border-orange-900/40 rounded-2xl p-8">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-[#C94C1E]/10 flex items-center justify-center">
                      <svg className="w-7 h-7 text-[#C94C1E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </div>
                    <h3 className="text-[20px] font-bold text-slate-900 dark:text-slate-100 mb-2">
                      Free scan used
                    </h3>
                    <p className="text-[14px] text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                      Sign up with Google to unlock unlimited scans, saved results, and full dashboard access.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={() => router.push('/signin')}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px] font-bold text-white bg-[#C94C1E] hover:bg-[#b5431a] shadow-lg shadow-orange-500/20 transition-all"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Sign up with Google
                      </button>
                      <button
                        onClick={() => router.push('/signin')}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                      >
                        Sign up with email
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
