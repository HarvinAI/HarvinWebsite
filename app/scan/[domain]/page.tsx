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

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function runScan() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/detect?url=${encodeURIComponent(domain)}`);
        const text = await res.text();
        if (!text) throw new Error('No response from server');

        let data: ScanResult;
        try { data = JSON.parse(text); } catch { throw new Error('Unexpected response — please try again'); }
        if (!res.ok) throw new Error((data as unknown as { error: string }).error || 'Detection failed');

        setResult(data);

        // Mark free scan as used (only if not logged in)
        try {
          if (!localStorage.getItem('harvin_user')) {
            localStorage.setItem('harvin_free_scan_used', '1');
          }
        } catch {}
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }
    runScan();
  }, [domain]);

  const grouped = result ? groupByCategory(result.technologies) : {};
  const categories = sortedCategories(grouped);
  const filteredCategories = activeFilter ? categories.filter(c => c === activeFilter) : categories;
  const shouldCollapse = !activeFilter && filteredCategories.length > COLLAPSE_THRESHOLD && !expanded;
  const visibleCategories = shouldCollapse ? filteredCategories.slice(0, INITIAL_SHOW) : filteredCategories;
  const hiddenCount = filteredCategories.length - INITIAL_SHOW;

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-100 transition-colors duration-300">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#0a0a1a]/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Scanner
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono text-[#C94C1E] bg-[#C94C1E]/10 px-2.5 py-1 rounded-lg">
              {domain}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-[3px] border-white/[0.08]" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#C94C1E] animate-spin" />
            </div>
            <h2 className="text-[18px] font-semibold text-slate-100 mb-2">
              Scanning {domain}
            </h2>
            <p className="text-[13px] text-slate-400">
              Detecting technologies, store data, and company info&hellip;
            </p>
            <div className="mt-6 w-64 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-[#C94C1E] animate-[scan_1.8s_ease-in-out_infinite] w-1/3" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 mb-4 rounded-xl bg-red-900/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h2 className="text-[18px] font-semibold text-slate-100 mb-2">
              Scan failed
            </h2>
            <p className="text-[14px] text-slate-400 mb-6 max-w-md text-center">
              {error}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] transition-all shadow-sm"
              >
                Retry scan
              </button>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium text-slate-300 border border-white/[0.1] hover:bg-white/[0.05] transition-all"
              >
                Go back
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="animate-[fadeUp_0.4s_ease-out_forwards]">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-[22px] sm:text-[26px] font-bold text-slate-100 tracking-[-0.02em] mb-1">
                Scan Results
              </h1>
              <p className="text-[14px] text-slate-400">
                Found{' '}
                <span className="font-bold text-slate-100">
                  {result.count} {result.count === 1 ? 'technology' : 'technologies'}
                </span>
                {' '}across{' '}
                <span className="font-bold text-slate-100">
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
              <div className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] shadow-sm">
                <h3 className="text-[12px] font-semibold tracking-wide uppercase text-slate-400 flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="14" height="14" rx="2" />
                    <path d="M7 4V2M13 4V2M7 10h6M7 14h4" strokeLinecap="round" />
                  </svg>
                  Company Info
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {([
                    { key: 'category' as const, label: 'Category' },
                    { key: 'subCategory' as const, label: 'Sub-Category' },
                    { key: 'region' as const, label: 'Region' },
                    { key: 'offlineStores' as const, label: 'Stores' },
                  ]).map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#C94C1E] mb-1">{label}</p>
                      <p className="text-[14px] font-medium text-slate-200 px-3 py-2 rounded-lg bg-white/[0.04]">
                        {result.companyMeta![key] || '\u2014'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.count === 0 ? (
              <div className="text-center py-16">
                <p className="text-[14px] text-slate-500">
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
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 ${!activeFilter ? 'bg-[#C94C1E] text-white shadow-sm' : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] border border-white/[0.08]'}`}
                    >
                      All
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${!activeFilter ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-500'}`}>
                        {result.count}
                      </span>
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 ${activeFilter === cat ? 'bg-[#C94C1E] text-white shadow-sm' : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] border border-white/[0.08]'}`}
                      >
                        {cat}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeFilter === cat ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-500'}`}>
                          {grouped[cat].length}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tech grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleCategories.map(cat => (
                    <div key={cat} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-[11px] font-semibold tracking-wide uppercase text-slate-400 leading-none">{cat}</h3>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-500">{grouped[cat].length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {grouped[cat].map(tech => (
                          <span key={tech.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] text-[12px] font-medium text-slate-300">
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
                  <div className="mt-5 text-center">
                    <button
                      onClick={() => setExpanded(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-slate-400 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all duration-150"
                    >
                      Show {hiddenCount} more {hiddenCount === 1 ? 'category' : 'categories'}
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                        <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Scan another CTA */}
                <div className="mt-8 text-center">
                  <button
                    onClick={() => router.push('/')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-[#C94C1E] border border-[#C94C1E]/30 hover:bg-[#C94C1E]/10 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Scan another brand
                  </button>
                </div>
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
    </div>
  );
}
