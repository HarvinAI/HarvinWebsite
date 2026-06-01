'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Tech {
  name: string;
  category: string;
  color: string;
  version?: string;
}

interface CompanyMeta {
  category: string;
  subCategory: string;
  region: string;
  offlineStores: string;
  storeRawCount?: number;
  businessModel?: string;
  appPresence?: string;
  monthlyVisitsFormatted?: string;
}

interface ScanResult {
  url: string;
  technologies: Tech[];
  count: number;
  companyMeta?: CompanyMeta;
  blocked?: boolean;
  message?: string;
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

const TECH_DOMAIN_MAP: Record<string, string> = {
  // Google
  'google analytics': 'https://www.google.com/s2/favicons?domain=analytics.google.com&sz=64', 'google tag manager': 'https://www.google.com/s2/favicons?domain=tagmanager.google.com&sz=64',
  'google ads': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64', 'google adsense': 'https://www.google.com/s2/favicons?domain=adsense.google.com&sz=64',
  'google fonts': 'https://www.google.com/s2/favicons?domain=fonts.google.com&sz=64', 'google maps': 'https://www.google.com/s2/favicons?domain=maps.google.com&sz=64',
  'google optimize': 'https://www.google.com/s2/favicons?domain=optimize.google.com&sz=64', 'google search console': 'https://www.google.com/s2/favicons?domain=search.google.com&sz=64',
  'google ad manager': 'https://www.google.com/s2/favicons?domain=admob.google.com&sz=64', 'google remarketing': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'google pay': 'https://www.google.com/s2/favicons?domain=pay.google.com&sz=64', 'google sign-in': 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
  'google cloud cdn': 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64', 'google sites': 'https://www.google.com/s2/favicons?domain=sites.google.com&sz=64',
  'google cloud': 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64',
  // Facebook / Meta
  'facebook pixel': 'facebook.com', 'meta pixel': 'meta.com',
  'facebook retargeting': 'facebook.com', 'facebook ads': 'facebook.com',
  'facebook login': 'facebook.com',
  // Microsoft
  'microsoft clarity': 'https://www.google.com/s2/favicons?domain=clarity.microsoft.com&sz=64', 'microsoft advertising': 'microsoft.com',
  'microsoft dynamics 365': 'microsoft.com', 'bing uet': 'bing.com',
  'bing webmaster': 'bing.com', 'msvalidate.01': 'bing.com',
  // Adobe
  'adobe analytics': 'adobe.com', 'adobe experience manager': 'adobe.com',
  'adobe experience cloud': 'adobe.com', 'adobe target': 'adobe.com',
  'adobe launch': 'adobe.com', 'adobe fonts': 'fonts.adobe.com',
  // AWS / Amazon
  'aws': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64', 'aws cloudfront': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'amazon cloudfront': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64', 'amazon s3': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'amazon ses': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64', 'amazon advertising': 'amazon.com',
  'amazon pay': 'pay.amazon.com',
  // Others
  'salesforce': 'salesforce.com', 'salesforce commerce cloud': 'salesforce.com',
  'salesforce live agent': 'salesforce.com', 'salesforce marketing cloud': 'salesforce.com',
  'firebase': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64', 'firebase analytics': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'firebase auth': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'twitter cards': 'twitter.com', 'twitter pixel': 'twitter.com',
  'open graph': 'ogp.me', 'json-ld schema': 'schema.org',
  'core-js': 'github.com', 'apple pay': 'apple.com',
  'hubspot': 'hubspot.com', 'hubspot cms hub': 'hubspot.com',
  'zoho crm': 'zoho.com', 'zoho salesiq': 'zoho.com', 'zoho desk': 'zoho.com', 'zoho campaigns': 'zoho.com',
  'pardot': 'pardot.com', 'eloqua': 'oracle.com', 'responsys': 'oracle.com',
  'akamai': 'akamai.com', 'akamai cdn': 'akamai.com', 'akamai bot manager': 'akamai.com',
  'zendesk chat': 'zendesk.com', 'freshmarketer': 'freshworks.com', 'freshsales': 'freshworks.com',
  'recaptcha': 'google.com', 'turnstile': 'cloudflare.com',
  'shopify': 'cdn.shopify.com', 'shopify checkout': 'cdn.shopify.com', 'shopify payments': 'shopify.com', 'shop pay': 'shop.app',
  'wordpress': 'wordpress.org', 'wp rocket': 'wp-rocket.me', 'wp super cache': 'wordpress.org',
  'w3 total cache': 'wordpress.org', 'jetpack': 'jetpack.com',
  'next.js': 'nextjs.org', 'vue.js': 'vuejs.org', 'nuxt.js': 'nuxt.com',
  'react': 'react.dev', 'angular': 'angular.io', 'svelte': 'svelte.dev',
  'jquery': 'jquery.com', 'bootstrap': 'getbootstrap.com', 'tailwind css': 'tailwindcss.com',
  'node.js': 'nodejs.org', 'nginx': 'nginx.org', 'apache': 'apache.org',
  'litespeed': 'litespeedtech.com', 'litespeed cache': 'litespeedtech.com',
  'font awesome': 'fontawesome.com', 'lottie': 'airbnb.io',
  'stripe': 'stripe.com', 'razorpay': 'razorpay.com', 'paypal': 'paypal.com',
  'klaviyo': 'klaviyo.com', 'mailchimp': 'mailchimp.com',
  'intercom': 'intercom.com', 'zendesk': 'zendesk.com', 'tawk.to': 'tawk.to',
  'hotjar': 'hotjar.com', 'mixpanel': 'mixpanel.com', 'segment': 'segment.com',
  'sentry': 'sentry.io', 'cloudflare': 'cloudflare.com',
  'vercel': 'vercel.com', 'netlify': 'netlify.com',
  'algolia': 'algolia.com', 'elasticsearch': 'elastic.co',
  'supabase': 'supabase.com', 'auth0': 'auth0.com',
  // Icons that need icon.horse (Google favicons return blank for these)
  'ant design': 'ant.design',
  'prism': 'prismjs.com',
  'lazysizes': 'github.com',
  'magento': 'magento.com',
  'knockout.js': 'knockoutjs.com',
  'hsts': 'hstspreload.org',
  'requirejs': 'requirejs.org',
  'youtube': 'youtube.com',
  'youtube embed': 'youtube.com',
  'helpscout beacon': 'https://www.google.com/s2/favicons?domain=helpscout.com&sz=64',
  'vue storefront': 'vuestorefront.io',
};

function guessTechDomain(name: string): string {
  const key = name.toLowerCase();
  if (TECH_DOMAIN_MAP[key]) return TECH_DOMAIN_MAP[key];
  const cleaned = key.replace(/\s+/g, '').replace(/\.js$/i, '');
  if (cleaned.length >= 3 && !/^(open|json|twitter|google|facebook|the|core)/.test(cleaned)) {
    return `${cleaned}.com`;
  }
  return 'harvin.ai';
}

function formatStores(band: string, rawCount?: number): string {
  if (rawCount && rawCount > 0) return `${rawCount} stores`;
  return band;
}

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
            storeRawCount: metaJson.data.storeRawCount || metaJson.data.aiStoreCount || 0,
            businessModel: metaJson.data.businessModel || '',
            appPresence: metaJson.data.appPresence || '',
            monthlyVisitsFormatted: metaJson.data.monthlyVisitsFormatted || '',
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

  const dedupedTechs = result ? result.technologies : [];
  const grouped = groupByCategory(dedupedTechs);
  const categories = sortedCategories(grouped);
  const filteredCategories = activeFilter ? categories.filter(c => c === activeFilter) : categories;
  const allTechs = filteredCategories.flatMap(cat => grouped[cat]);

  const meta = result?.companyMeta;
  const metaTags = meta ? [
    meta.category,
    meta.subCategory && meta.subCategory !== 'General' ? meta.subCategory : null,
    meta.region,
    meta.offlineStores !== 'Online' && meta.offlineStores !== 'Unknown' ? formatStores(meta.offlineStores, meta.storeRawCount) : null,
    meta.businessModel,
    meta.appPresence !== 'No App' ? meta.appPresence : null,
    meta.monthlyVisitsFormatted ? `${meta.monthlyVisitsFormatted}/mo` : null,
  ].filter(Boolean) as string[] : [];

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
          <button onClick={() => router.push('/')} className="text-[13px] font-medium text-[#C94C1E] hover:underline">
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
            <p className="text-[13px] text-slate-500 dark:text-slate-400">Detecting technologies and company info&hellip;</p>
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

            {dedupedTechs.length === 0 ? (
              <div className="text-center py-12">
                {result.blocked ? (
                  <div className="max-w-md mx-auto">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                    </div>
                    <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white mb-2">This site has bot protection</h3>
                    <p className="text-[14px] text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                      {result.message || 'We couldn\'t scan this site from our servers. Use the HarvinAI Chrome extension to scan from your real browser.'}
                    </p>
                    <a href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] transition-all">
                      Get Chrome Extension
                    </a>
                  </div>
                ) : (
                  <p className="text-[14px] text-slate-500">No technologies detected on this site.</p>
                )}
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
                        {dedupedTechs.length}
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

                {/* Tech tile grid */}
                <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 dark:border-white/[0.05]">
                    <span className="text-[13px] font-bold text-slate-700 dark:text-neutral-200">
                      {activeFilter || 'All Technologies'} <span className="font-normal text-slate-400 dark:text-neutral-500 ml-1">{allTechs.length}</span>
                    </span>
                  </div>
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[1px] bg-slate-100 dark:bg-white/[0.04] rounded-b-xl overflow-hidden">
                    {allTechs.map((tech, idx) => {
                      const iconVal = guessTechDomain(tech.name);
                      const src = iconVal.startsWith('http') ? iconVal : `https://icon.horse/icon/${iconVal}`;
                      return (
                        <div key={`${tech.name}-${tech.category}-${idx}`}
                          className="relative flex items-center gap-3 px-4 py-4 bg-white dark:bg-[#0a0a1a] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                          <div className="w-[36px] h-[36px] min-w-[36px] rounded-full flex items-center justify-center flex-shrink-0 bg-slate-50 dark:bg-white/[0.05]">
                            <img src={src} alt="" className="w-[20px] h-[20px] object-contain rounded"
                              onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-slate-800 dark:text-neutral-100 truncate">{tech.name}</div>
                            <div className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">{tech.category}</div>
                          </div>
                          {tech.version && <span className="text-[10px] px-1.5 py-[1px] rounded bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-neutral-500 font-medium flex-shrink-0">{tech.version}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
            <h1 className="text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] leading-tight">{brandName}</h1>
            <p className="text-[14px] text-slate-500 dark:text-slate-400 font-mono">{domain}</p>
          </div>
          {dedupedTechs.length > 0 && (
            <div className="ml-auto hidden sm:block text-right">
              <p className="text-[28px] font-bold text-[#C94C1E] leading-none">{dedupedTechs.length}</p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">technologies</p>
            </div>
          )}
        </div>

        {/* Company meta tags */}
        {metaTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metaTags.map(v => (
              <span key={v} className="text-[13px] font-semibold text-slate-600 dark:text-neutral-300 bg-white dark:bg-white/[0.04] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.06]">{v}</span>
            ))}
          </div>
        )}
      </div>
    );
  }
}
