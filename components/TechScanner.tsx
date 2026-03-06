'use client';

import { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface Tech {
  name: string;
  category: string;
  color: string;
}

interface CompanyMeta {
  category: string;
  subCategory: string;
  region: string;
  offlineStores: string;
}

interface ScanResult {
  url: string;
  technologies: Tech[];
  count: number;
  companyMeta?: CompanyMeta;
}

const DEMO_BRANDS = [
  { name: 'Mamaearth', url: 'mamaearth.in' },
  { name: 'boAt', url: 'boat-lifestyle.com' },
  { name: 'Sugar Cosmetics', url: 'sugarcosmetics.com' },
  { name: 'Lenskart', url: 'lenskart.com' },
];

const CATEGORY_PRIORITY = [
  'Ecommerce', 'Ecommerce Platform', 'CMS', 'JavaScript frameworks', 'UI frameworks',
  'JavaScript libraries', 'Analytics', 'Payment processors', 'Live chat',
  'Customer support', 'Customer engagement', 'WordPress plugins',
  'Shopify apps', 'Reviews', 'Loyalty & rewards', 'Buy now, pay later',
  'CDN', 'Web servers', 'SEO', 'Tag managers', 'Marketing automation',
  'Advertising', 'Retargeting', 'A/B testing', 'Cart abandonment',
  'Personalisation', 'Push notifications', 'Email', 'Surveys',
  'Booking & scheduling', 'Accessibility', 'Cookie compliance',
  'Security', 'SSL/TLS certificate authorities', 'Performance',
  'Hosting', 'Font scripts', 'Maps', 'Video players', 'Search engines',
  'Caching', 'Programming languages', 'Databases', 'Operating systems',
];

const CATEGORY_PRIORITY_SET = new Set(CATEGORY_PRIORITY.map(c => c.toLowerCase()));

function groupByCategory(techs: Tech[]): Record<string, Tech[]> {
  return techs.reduce<Record<string, Tech[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});
}

function sortedCategories(grouped: Record<string, Tech[]>): string[] {
  const all = Object.keys(grouped);
  const allLower = new Map(all.map(c => [c.toLowerCase(), c]));
  const priority: string[] = [];
  for (const p of CATEGORY_PRIORITY) {
    const actual = allLower.get(p.toLowerCase());
    if (actual) priority.push(actual);
  }
  const rest = all
    .filter(c => !CATEGORY_PRIORITY_SET.has(c.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return [...priority, ...rest];
}

const SCAN_STORAGE_KEY = 'harvin_free_scan_used';
const COLLAPSE_THRESHOLD = 12;
const INITIAL_SHOW = 9;

export default function TechScanner() {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [scanGated, setScanGated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function isFreeScanUsed(): boolean {
    try { return localStorage.getItem(SCAN_STORAGE_KEY) === '1'; } catch { return false; }
  }

  function markFreeScanUsed() {
    try { localStorage.setItem(SCAN_STORAGE_KEY, '1'); } catch { /* */ }
  }

  function isLoggedIn(): boolean {
    try { return !!localStorage.getItem('harvin_user'); } catch { return false; }
  }

  async function scan(url: string) {
    if (!url.trim()) return;

    // Gate: if free scan already used and not logged in, block
    if (isFreeScanUsed() && !isLoggedIn()) {
      setScanGated(true);
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setActiveFilter(null);
    setExpanded(false);
    setScanGated(false);

    try {
      const res = await fetch(`/api/detect?url=${encodeURIComponent(url.trim())}`);
      const text = await res.text();
      if (!text) throw new Error('No response from server');

      let data: ScanResult;
      try { data = JSON.parse(text); } catch { throw new Error('Unexpected response — please try again'); }
      if (!res.ok) throw new Error((data as unknown as { error: string }).error || 'Detection failed');

      setResult(data);

      // Mark free scan as used (only if not logged in)
      if (!isLoggedIn()) {
        markFreeScanUsed();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    scan(inputUrl);
  }

  function handleDemo(url: string) {
    setInputUrl(url);
    scan(url);
  }

  const grouped = result ? groupByCategory(result.technologies) : {};
  const categories = sortedCategories(grouped);
  const filteredCategories = activeFilter ? categories.filter(c => c === activeFilter) : categories;
  const shouldCollapse = !activeFilter && filteredCategories.length > COLLAPSE_THRESHOLD && !expanded;
  const visibleCategories = shouldCollapse ? filteredCategories.slice(0, INITIAL_SHOW) : filteredCategories;
  const hiddenCount = filteredCategories.length - INITIAL_SHOW;

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
                  disabled={!inputUrl.trim() || loading}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[14px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_2px_8px_rgba(201,76,30,0.3)]"
                >
                  {loading ? (
                    <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      Scan
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h9M8 4l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Loading bar */}
              {loading && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-[#C94C1E] animate-[scan_1.8s_ease-in-out_infinite] w-1/3" />
                  </div>
                  <p className="text-[13px] font-mono text-slate-400 dark:text-slate-500 tracking-wide">
                    Scanning tech stack&hellip;
                  </p>
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
                  <svg className="w-4 h-4 flex-shrink-0 text-red-500" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Sign-up gate */}
              {scanGated && !loading && (
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

        {/* Results */}
        {result && !loading && (
          <div className="mt-8 animate-[fadeUp_0.4s_ease-out_forwards]">

            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-[14px] text-slate-500 dark:text-slate-400">
                Found{' '}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {result.count} {result.count === 1 ? 'technology' : 'technologies'}
                </span>
                {' '}across{' '}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {categories.length} {categories.length === 1 ? 'category' : 'categories'}
                </span>
                {' '}on{' '}
                <span className="font-mono text-[#C94C1E] text-[13px]">
                  {result.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </span>
              </p>
            </div>

            {/* Company meta */}
            {result.companyMeta && (
              <div className="mb-5 p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-[12px] font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="14" height="14" rx="2" />
                    <path d="M7 4V2M13 4V2M7 10h6M7 14h4" strokeLinecap="round" />
                  </svg>
                  Company Info
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { key: 'category' as const, label: 'Category' },
                    { key: 'subCategory' as const, label: 'Sub-Category' },
                    { key: 'region' as const, label: 'Region' },
                    { key: 'offlineStores' as const, label: 'Stores' },
                  ]).map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C94C1E] mb-1">{label}</p>
                      <p className="text-[14px] font-medium text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                        {result.companyMeta![key] || '\u2014'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.count === 0 ? (
              <div className="text-center py-12">
                <p className="text-[14px] text-slate-400 dark:text-slate-500">
                  No recognisable technologies detected — the site may block bots or require JavaScript to load.
                </p>
              </div>
            ) : (
              <>
                {/* Category filter pills */}
                <div className="mb-5 -mx-1 overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
                  <div className="flex gap-1.5 px-1 w-max">
                    <button
                      onClick={() => setActiveFilter(null)}
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 ${!activeFilter ? 'bg-[#C94C1E] text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                    >
                      All
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${!activeFilter ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                        {result.count}
                      </span>
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 ${activeFilter === cat ? 'bg-[#C94C1E] text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                      >
                        {cat}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeFilter === cat ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          {grouped[cat].length}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tech grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleCategories.map(cat => (
                    <div key={cat} className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400 leading-none">{cat}</h3>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500">{grouped[cat].length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {grouped[cat].map(tech => (
                          <span key={tech.name} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 dark:bg-slate-700/50 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tech.color }} />
                            {tech.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show more */}
                {shouldCollapse && hiddenCount > 0 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setExpanded(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-150"
                    >
                      Show {hiddenCount} more {hiddenCount === 1 ? 'category' : 'categories'}
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                        <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* CTA after results */}
                {!isLoggedIn() && (
                  <div className="mt-8 text-center p-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-[14px] text-slate-500 dark:text-slate-400 mb-3">
                      Want to scan more companies and access the full dashboard?
                    </p>
                    <button
                      onClick={() => router.push('/signin')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#C94C1E] hover:bg-[#b5431a] shadow-lg shadow-orange-500/20 transition-all"
                    >
                      Sign up free
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h9M8 4l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
