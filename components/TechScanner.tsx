'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const DEMO_BRANDS = [
  { name: 'Mamaearth', url: 'mamaearth.in' },
  { name: 'boAt', url: 'boat-lifestyle.com' },
  { name: 'Sugar Cosmetics', url: 'sugarcosmetics.com' },
  { name: 'Lenskart', url: 'lenskart.com' },
];

const TYPEWRITER_TEXTS = ['nike.com', 'zara.com', 'mamaearth.in', 'boat-lifestyle.com'];
const SCAN_STORAGE_KEY = 'harvin_free_scan_used';

export default function TechScanner() {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState('');
  const [scanGated, setScanGated] = useState(false);
  const [placeholder, setPlaceholder] = useState('nike.com');
  const inputRef = useRef<HTMLInputElement>(null);
  const userTypedRef = useRef(false);

  // Cycle placeholder text to show it's a live tool
  useEffect(() => {
    if (userTypedRef.current) return;
    let idx = 0;
    const interval = setInterval(() => {
      if (userTypedRef.current) { clearInterval(interval); return; }
      idx = (idx + 1) % TYPEWRITER_TEXTS.length;
      setPlaceholder(TYPEWRITER_TEXTS[idx]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Auto-focus the input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  function isFreeScanUsed(): boolean {
    try { return localStorage.getItem(SCAN_STORAGE_KEY) === '1'; } catch { return false; }
  }

  function isLoggedIn(): boolean {
    try { return !!localStorage.getItem('harvin_user'); } catch { return false; }
  }

  function navigateToScan(url: string) {
    if (!url.trim()) return;
    if (isFreeScanUsed() && !isLoggedIn()) { setScanGated(true); return; }
    const domain = url.trim().replace(/^https?:\/\//, '').replace(/^www\d*\./, '').replace(/\/+$/, '');
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

  function handleInputChange(val: string) {
    userTypedRef.current = true;
    setInputUrl(val);
  }

  if (scanGated) {
    return (
      <div className="text-center">
        <p className="text-[14px] font-medium text-slate-700 dark:text-slate-300 mb-3">
          Sign up to unlock unlimited scans
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            onClick={() => router.push('/signin')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign up with Google
          </button>
          <button
            onClick={() => router.push('/signin')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Use email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2 rounded-2xl
                   bg-white dark:bg-slate-900
                   border-2 border-slate-200 dark:border-slate-700
                   shadow-[0_4px_20px_rgba(0,0,0,0.08)]
                   dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]
                   hover:border-[#C94C1E]/40
                   focus-within:border-[#C94C1E] focus-within:shadow-[0_4px_24px_rgba(201,76,30,0.15)]
                   transition-all duration-200"
      >
        <div className="pl-3 flex-shrink-0">
          <svg className="w-5 h-5 text-[#C94C1E]" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 2c-2 2-3 5-3 8s1 6 3 8M10 2c2 2 3 5 3 8s-1 6-3 8M2 10h16" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputUrl}
          onChange={e => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[16px]
                     text-slate-900 dark:text-slate-100
                     placeholder:text-slate-400 dark:placeholder:text-slate-500
                     min-w-0 py-2"
        />
        <button
          type="submit"
          disabled={!inputUrl.trim()}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-6 py-3 rounded-xl
                     text-[15px] font-bold text-white
                     bg-[#C94C1E]
                     hover:bg-[#b5431a]
                     shadow-[0_2px_8px_rgba(201,76,30,0.35)]
                     hover:shadow-[0_4px_16px_rgba(201,76,30,0.45)]
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all duration-150"
        >
          Scan now
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h9M8 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>

      {/* Demo brands — styled as clickable chips */}
      <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {DEMO_BRANDS.map(b => (
          <button
            key={b.url}
            type="button"
            onClick={() => handleDemo(b.url)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium
                       text-slate-600 dark:text-slate-400
                       px-3 py-1.5 rounded-full
                       bg-white dark:bg-white/[0.05]
                       border border-slate-200 dark:border-white/[0.08]
                       shadow-sm
                       hover:border-[#C94C1E]/40 hover:text-[#C94C1E]
                       hover:shadow-[0_2px_8px_rgba(201,76,30,0.1)]
                       active:scale-95
                       transition-all duration-150"
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${b.url}&sz=32`}
              alt=""
              className="w-4 h-4 rounded-sm"
            />
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
