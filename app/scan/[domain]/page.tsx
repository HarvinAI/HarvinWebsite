'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

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

const COLLAPSE_THRESHOLD = 12;
const INITIAL_SHOW = 9;

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const domain = decodeURIComponent(params.domain as string);
  const brandName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

  const [loading, setLoading] = useState(true);
  const [techLoading, setTechLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const CACHE_KEY = 'harvin_scan_cache';
    const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

    function getCached(d: string) {
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const entry = cache[d];
        if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as ScanResult;
      } catch {}
      return null;
    }

    function setCache(d: string, data: ScanResult) {
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cache[d] = { data, ts: Date.now() };
        const keys = Object.keys(cache);
        if (keys.length > 200) {
          keys.sort((a, b) => cache[a].ts - cache[b].ts);
          for (let i = 0; i < keys.length - 200; i++) delete cache[keys[i]];
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch {}
    }

    const cached = getCached(domain);
    if (cached) {
      setResult(cached);
      setLoading(false);
    }

    let stale = false;

    async function runScan() {
      let dbMeta: CompanyMeta | null = null;
      try {
        const metaRes = await fetch(`/api/company-meta?domain=${encodeURIComponent(domain)}`);
        if (stale) return;
        const metaJson = await metaRes.json();
        if (metaJson.found && metaJson.data) {
          dbMeta = {
            category: metaJson.data.category || '',
            subCategory: metaJson.data.subCategory || '',
            region: metaJson.data.region || '',
            offlineStores: metaJson.data.offlineStores || '',
          };
          if (!cached) {
            setResult({ url: domain, technologies: [], count: 0, companyMeta: dbMeta });
            setLoading(false);
            setTechLoading(true);
          }
        }
      } catch {}

      if (stale) return;

      if (!cached && !dbMeta) { setLoading(true); setError(null); }
      try {
        const res = await fetch(`/api/detect?url=${encodeURIComponent(domain)}`);
        if (stale) return;
        const text = await res.text();
        if (!text) throw new Error('No response from server');
        let data: ScanResult;
        try { data = JSON.parse(text); } catch { throw new Error('Unexpected response — please try again'); }
        if (!res.ok) throw new Error((data as unknown as { error: string }).error || 'Detection failed');
        if (!data.companyMeta && dbMeta) data.companyMeta = dbMeta;
        if (cached && cached.count > 0 && data.count === 0) {
          if (data.companyMeta) setResult({ ...cached, companyMeta: data.companyMeta });
        } else {
          setResult(data);
          setCache(domain, data);
        }
        try {
          if (!localStorage.getItem('harvin_user')) localStorage.setItem('harvin_free_scan_used', '1');
        } catch {}
      } catch (err: unknown) {
        if (!cached && !dbMeta) setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        if (!stale) { setLoading(false); setTechLoading(false); }
      }
    }
    runScan();
    return () => { stale = true; };
  }, [domain]);

  const grouped = result ? groupByCategory(result.technologies) : {};
  const categories = sortedCategories(grouped);
  const filteredCategories = activeFilter ? categories.filter(c => c === activeFilter) : categories;
  const shouldCollapse = !activeFilter && filteredCategories.length > COLLAPSE_THRESHOLD && !expanded;
  const visibleCategories = shouldCollapse ? filteredCategories.slice(0, INITIAL_SHOW) : filteredCategories;
  const hiddenCount = filteredCategories.length - INITIAL_SHOW;

  const meta = result?.companyMeta;
  const metaItems = meta ? [
    { label: 'Category', value: meta.category },
    { label: 'Sub-Category', value: meta.subCategory },
    { label: 'Region', value: meta.region },
    { label: 'Stores', value: meta.offlineStores },
  ].filter(m => m.value && m.value !== 'Unknown' && m.value !== 'General') : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a1a] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0a0a1a]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => window.history.length > 1 ? router.back() : router.push('/')}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <button
            onClick={() => router.push('/')}
            className="text-[13px] font-medium text-[#C94C1E] hover:underline"
          >
            Scan another
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative w-14 h-14 mb-5">
              <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-white/[0.08]" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#C94C1E] animate-spin" />
            </div>
            <h2 className="text-[18px] font-semibold mb-1">Scanning {domain}</h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              Detecting technologies and company info&hellip;
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h2 className="text-[18px] font-semibold mb-1">Scan failed</h2>
            <p className="text-[14px] text-slate-500 dark:text-slate-400 mb-5 max-w-md text-center">{error}</p>
            <div className="flex gap-3">
              <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-lg text-[14px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] transition-all">Retry</button>
              <button onClick={() => router.push('/')} className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all">Go back</button>
            </div>
          </div>
        )}

        {/* Phase 1: Company meta while tech loads */}
        {result && !loading && techLoading && (
          <div className="animate-[fadeUp_0.4s_ease-out_forwards]">
            {renderHeader()}
            <div className="flex flex-col items-center py-12">
              <div className="relative w-10 h-10 mb-3">
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-white/[0.08]" />
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#C94C1E] animate-spin" />
              </div>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">Scanning tech stack&hellip;</p>
            </div>
          </div>
        )}

        {/* Full results */}
        {result && !loading && !techLoading && (
          <div className="animate-[fadeUp_0.4s_ease-out_forwards]">
            {renderHeader()}

            {result.count === 0 ? (
              <div className="text-center py-16">
                <p className="text-[14px] text-slate-500">
                  No technologies detected — the site may block automated scanning.
                </p>
              </div>
            ) : (
              <>
                {/* Category filter pills */}
                <div className="mb-6 -mx-1 overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
                  <div className="flex gap-1.5 px-1 w-max">
                    <button
                      onClick={() => setActiveFilter(null)}
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                        !activeFilter
                          ? 'bg-[#C94C1E] text-white shadow-sm'
                          : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      All
                      <span className={`text-[11px] font-bold px-1.5 rounded ${!activeFilter ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500'}`}>
                        {result.count}
                      </span>
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                          activeFilter === cat
                            ? 'bg-[#C94C1E] text-white shadow-sm'
                            : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        {cat}
                        <span className={`text-[11px] font-bold px-1.5 rounded ${activeFilter === cat ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500'}`}>
                          {grouped[cat].length}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tech grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleCategories.map(cat => (
                    <div key={cat} className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 hover:shadow-md dark:hover:bg-white/[0.05] transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-200">{cat}</h3>
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded">
                          {grouped[cat].length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {grouped[cat].map(tech => (
                          <span key={tech.name} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.05] border border-slate-100 dark:border-white/[0.04] text-[13px] font-medium text-slate-700 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tech.color }} />
                            {tech.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show more */}
                {shouldCollapse && hiddenCount > 0 && (
                  <div className="mt-5 text-center">
                    <button
                      onClick={() => setExpanded(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:bg-white/[0.08] transition-all"
                    >
                      Show {hiddenCount} more {hiddenCount === 1 ? 'category' : 'categories'}
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                        <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );

  function renderHeader() {
    return (
      <div className="mb-8">
        {/* Brand identity */}
        <div className="flex items-center gap-4 mb-5">
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
            alt=""
            className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/[0.06] p-0.5"
          />
          <div>
            <h1 className="text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] leading-tight">
              {brandName}
            </h1>
            <p className="text-[14px] text-slate-500 dark:text-slate-400 font-mono">
              {domain}
            </p>
          </div>
          {result && result.count > 0 && (
            <div className="ml-auto hidden sm:block text-right">
              <p className="text-[28px] font-bold text-[#C94C1E] leading-none">{result.count}</p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">technologies</p>
            </div>
          )}
        </div>

        {/* Company meta pills */}
        {metaItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metaItems.map(m => (
              <div key={m.label} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{m.label}</span>
                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}
