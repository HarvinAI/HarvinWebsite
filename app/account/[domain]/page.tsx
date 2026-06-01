'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import {
  Search, Satellite, Star, Target, Swords, Briefcase,
  Settings2, Link2, LogOut, ExternalLink, Globe, MapPin,
  Building2, TrendingUp, Shield, ChevronRight, Plus,
  Store, Users, ShoppingCart, Code, Loader2, Radar, Smartphone,
  X, Check, Layers, Filter, Activity, Cpu, Box, LayoutGrid
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

/* ── Custom Styles for Animations & Scrollbars ────────────────────────── */
const injectStyles = () => (
  <style>{`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.3); border-radius: 10px; }
    .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.5); }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
    .dark .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }
    
    .fade-in-up { 
      animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
      opacity: 0; 
      transform: translateY(12px); 
    }
    @keyframes fadeInUp { 
      to { opacity: 1; transform: translateY(0); } 
    }
    .delay-100 { animation-delay: 100ms; }
    .delay-200 { animation-delay: 200ms; }
    .delay-300 { animation-delay: 300ms; }
  `}</style>
);

/* ── Types ─────────────────────────────────────────────────────────────── */
interface AccountData {
  normalizedDomain: string;
  name: string;
  category: string;
  subCategory: string;
  region: string;
  state: string | null;
  city: string | null;
  displayLocation: string;
  locationLevel: string;
  offlineStores: string;
  storeRawCount: number;
  businessModel: string | null;
  aiStoreCount: number;
  storeConfidence: { level?: string; score?: number } | null;
  monthlyVisits: number | null;
  monthlyVisitsFormatted: string | null;
  scaleBand: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  appPresence: string;
  iosAppUrl: string | null;
  androidAppUrl: string | null;
  score: number;
  harvinScore: number;
  similar: { normalizedDomain: string; name: string; category: string; subCategory: string }[];
  found: boolean;
}

interface Tech {
  name: string;
  category: string;
  color: string;
}

interface ScanResult {
  technologies: Tech[];
  count: number;
  blocked?: boolean;
  message?: string;
  companyMeta?: {
    category: string;
    subCategory: string;
    region: string;
    offlineStores: string;
  };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupByCategory(techs: Tech[]): Record<string, Tech[]> {
  return techs.reduce<Record<string, Tech[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});
}

const TECH_DISPLAY_PRIORITY = [
  'Ecommerce Platform', 'Ecommerce', 'CMS',
  'Payments & Checkout - Gateway', 'Payment processors', 'Payments',
  'Analytics & Optimization Platform', 'Analytics', 'Analytics & Behavior',
  'Marketing automation', 'Customer Engagement / CRM',
  'Advertising', 'Live chat', 'CDN & Infrastructure',
  'Search', 'Personalisation', 'Reviews',
];

function getTopTechsByCategory(techs: Tech[]): { label: string; value: string }[] {
  const grouped = groupByCategory(techs);
  const result: { label: string; value: string }[] = [];
  const labelMap: Record<string, string> = {
    'Ecommerce Platform': 'Ecommerce',
    'Payments & Checkout - Gateway': 'Payments',
    'Payment processors': 'Payments',
    'Analytics & Optimization Platform': 'Analytics',
    'Analytics & Behavior': 'Analytics',
    'Marketing automation': 'Marketing',
    'Customer Engagement / CRM': 'CRM',
    'CDN & Infrastructure': 'CDN',
    'Live chat': 'Live Chat',
  };
  const seen = new Set<string>();
  for (const cat of TECH_DISPLAY_PRIORITY) {
    if (!grouped[cat]) continue;
    const label = labelMap[cat] || cat;
    if (seen.has(label)) continue;
    seen.add(label);
    const names = grouped[cat].map(t => t.name).slice(0, 2).join(', ');
    result.push({ label, value: names });
    if (result.length >= 8) break;
  }
  for (const [cat, items] of Object.entries(grouped)) {
    if (result.length >= 8) break;
    const label = labelMap[cat] || cat;
    if (seen.has(label)) continue;
    seen.add(label);
    result.push({ label, value: items.map(t => t.name).slice(0, 2).join(', ') });
  }
  return result;
}

function detectPlatform(techs: Tech[]): string {
  const names = techs.map(t => t.name.toLowerCase());
  if (names.some(n => n.includes('shopify'))) return 'Shopify';
  if (names.some(n => n.includes('woocommerce'))) return 'WooCommerce';
  if (names.some(n => n.includes('magento'))) return 'Magento';
  if (names.some(n => n.includes('bigcommerce'))) return 'BigCommerce';
  if (names.some(n => n.includes('wordpress'))) return 'WordPress';
  return 'Custom';
}

function formatStores(band: string, rawCount?: number): string {
  if (!band || band === 'Online' || band === 'Online Only' || band === 'Unknown') return band || 'Unknown';
  if (rawCount && rawCount > 0) return `${band} (${rawCount} stores)`;
  return band;
}

function computeConfidenceLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'High', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' };
  if (score >= 50) return { label: 'Medium', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' };
  return { label: 'Low', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' };
}

function scoreColor(s: number): string {
  if (s >= 70) return 'text-emerald-600 dark:text-emerald-400 border-emerald-500';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400 border-amber-500';
  return 'text-slate-500 dark:text-neutral-400 border-slate-400';
}

function priorityBadge(s: number): { label: string; cls: string } | null {
  if (s >= 70) return { label: 'High Priority', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' };
  if (s >= 50) return { label: 'Medium Priority', cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' };
  return null;
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isDark, toggle: onToggleTheme } = useTheme();
  
  // Handle case where params.domain might not be immediately available
  const domain = params?.domain ? decodeURIComponent(params.domain as string) : '';

  const [account, setAccount] = useState<AccountData | null>(null);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [techCount, setTechCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [techLoading, setTechLoading] = useState(true);
  const [techBlocked, setTechBlocked] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // User
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Similar modal
  const [similarModalOpen, setSimilarModalOpen] = useState(false);

  // Watchlist state
  const [wlOpen, setWlOpen] = useState(false);
  const [watchlists, setWatchlists] = useState<{ _id: string; name: string; domains: string[] }[]>([]);
  const [wlCreating, setWlCreating] = useState(false);
  const [wlNewName, setWlNewName] = useState('');
  const [wlAdded, setWlAdded] = useState<string | null>(null);

  // Auth
  useEffect(() => {
    if (status === 'loading') return;
    const u = typeof window !== 'undefined' ? localStorage.getItem('harvin_user') : null;
    if (u) {
      try {
        const parsed = JSON.parse(u);
        setUserName(parsed.name || '');
        setUserEmail(parsed.email || '');
      } catch { /* */ }
    } else if (session?.user) {
      setUserName(session.user.name ?? '');
      setUserEmail(session.user.email ?? '');
    }
  }, [session, status]);

  useEffect(() => {
    if (!domain) return;
    let stale = false;
    const TECH_CACHE_KEY = 'harvin_account_tech_cache';
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    function getCachedTech(d: string): ScanResult | null {
      try {
        const cache = JSON.parse(localStorage.getItem(TECH_CACHE_KEY) || '{}');
        const entry = cache[d];
        if (entry && Date.now() - entry.ts < CACHE_TTL && entry.data?.count > 0) return entry.data;
      } catch {}
      return null;
    }

    function setCachedTech(d: string, data: ScanResult) {
      if (!data.count) return;
      try {
        const cache = JSON.parse(localStorage.getItem(TECH_CACHE_KEY) || '{}');
        cache[d] = { data, ts: Date.now() };
        const keys = Object.keys(cache);
        if (keys.length > 100) {
          keys.sort((a, b) => cache[a].ts - cache[b].ts);
          for (let i = 0; i < keys.length - 100; i++) delete cache[keys[i]];
        }
        localStorage.setItem(TECH_CACHE_KEY, JSON.stringify(cache));
      } catch {}
    }

    const cachedTech = getCachedTech(domain);
    if (cachedTech) {
      setTechs(cachedTech.technologies || []);
      setTechCount(cachedTech.count || 0);
      setTechLoading(false);
    }

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    if (!cachedTech) {
      setScanProgress(0);
      progressInterval = setInterval(() => {
        setScanProgress(p => {
          if (p >= 90) return 90;
          return p + (90 - p) * 0.08;
        });
      }, 200);
    }

    async function load() {
      try {
        const res = await fetch(`/api/account/${encodeURIComponent(domain)}`);
        const data = await res.json();
        if (stale) return;
        setAccount(data);
        setLoading(false);
        if (!cachedTech) setScanProgress(p => Math.max(p, 30));
      } catch {
        setLoading(false);
      }

      try {
        if (!cachedTech) setScanProgress(p => Math.max(p, 50));
        const scanRes = await fetch(`/api/detect?url=https://${encodeURIComponent(domain)}`);
        const scanData = await scanRes.json();
        if (stale) return;
        setTechs(scanData.technologies || []);
        setTechCount(scanData.count || 0);
        if (scanData.blocked) setTechBlocked(true);
        if (scanData.count > 0) setCachedTech(domain, scanData);
      } catch {}

      if (!stale) {
        setScanProgress(100);
        setTechLoading(false);
        if (progressInterval) clearInterval(progressInterval);
      }
    }

    load();
    return () => {
      stale = true;
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [domain]);

  useEffect(() => {
    if (!wlOpen) return;
    fetch('/api/watchlists').then(r => r.json()).then(d => setWatchlists(d.watchlists || [])).catch(() => {});
  }, [wlOpen]);

  const addToWatchlist = async (wlId: string) => {
    try {
      await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wlId, domain }),
      });
      setWlAdded(wlId);
      setTimeout(() => setWlAdded(null), 2000);
    } catch {}
  };

  const createAndAdd = async () => {
    if (!wlNewName.trim()) return;
    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wlNewName.trim() }),
      });
      const data = await res.json();
      if (data.watchlist?._id) {
        setWatchlists([...watchlists, data.watchlist]);
        setWlNewName('');
        setWlCreating(false);
        await addToWatchlist(data.watchlist._id);
      }
    } catch {}
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      ['harvin_user', 'harvin_onboarding', 'harvin_dashboard_filters'].forEach(k => localStorage.removeItem(k));
    }
    signOut({ callbackUrl: '/' });
  };

  const score = account?.harvinScore || account?.score || 0;
  const confidence = computeConfidenceLabel(
    account?.found ? (score > 70 ? 94 : score > 50 ? 72 : 45) : 30
  );
  const badge = priorityBadge(score);
  const platform = detectPlatform(techs);
  const topTechs = account ? getTopTechsByCategory(techs) : [];
  const firstName = userName?.split(' ')[0] || 'User';

  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] dark:bg-[#0a0a0a] font-sans text-slate-900 dark:text-white overflow-hidden selection:bg-[#C94C1E]/20">
      {injectStyles()}

      {/* ── Nav Sidebar (same as dashboard) ── */}
      <aside className="hidden md:flex flex-col bg-white dark:bg-[#141414] border-r border-slate-100 dark:border-white/[0.06] flex-shrink-0 w-[220px]">
        <div className="flex items-center gap-2.5 flex-shrink-0 px-5 py-4">
          <a href="/" className="flex items-center gap-0.5">
            <div className="h-7 w-8 overflow-hidden flex-shrink-0">
              <img src="/logo.svg" alt="" aria-hidden="true" className="h-7 w-auto max-w-none" />
            </div>
            <span className="font-bricolage font-bold text-[18px] tracking-normal text-slate-900 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div className="space-y-4 px-3">
            <div>
              <h3 className="px-3 mb-1 text-[11px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Intelligence</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Satellite size={18} />} label="Intelligence Hub" onClick={() => router.push('/dashboard?tab=market-intelligence')} />
                <NavBtn icon={<Globe size={18} />} label="My Universe" onClick={() => router.push('/dashboard?tab=my-universe')} />
              </div>
            </div>

            <div>
              <h3 className="px-3 mb-1 text-[11px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Discover</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Search size={18} />} label="Account Explorer" active onClick={() => router.push('/dashboard')} />
                <NavBtn icon={<Radar size={18} />} label="Tech Scanner" onClick={() => router.push('/dashboard?tab=tech-scanner')} />
                <NavBtn icon={<Target size={18} />} label="LookALike" onClick={() => router.push('/dashboard?tab=lookalike-brands')} />
              </div>
            </div>

            <div>
              <h3 className="px-3 mb-1 text-[11px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Watchlists</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Star size={18} />} label="My Watchlists" onClick={() => router.push('/dashboard?tab=my-watchlists')} />
                <NavBtn icon={<Target size={18} />} label="Recently Funded" onClick={() => router.push('/dashboard?tab=recently-funded')} />
                <NavBtn icon={<Briefcase size={18} />} label="Current Clients" locked />
              </div>
            </div>

            <div>
              <h3 className="px-3 mb-1 text-[11px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Settings</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Settings2 size={18} />} label="ICP & Preferences" onClick={() => router.push('/dashboard?tab=icp-preferences')} />
                <NavBtn icon={<Link2 size={18} />} label="Integrations" onClick={() => router.push('/dashboard?tab=integrations')} />
              </div>
            </div>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="px-3 pb-2">
          <button onClick={onToggleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
            {isDark
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>

        {/* User */}
        <div className="border-t border-slate-100 dark:border-white/[0.06] flex-shrink-0 p-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-600 dark:text-neutral-300 text-[12px] font-bold flex-shrink-0">
              {firstName[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-700 dark:text-neutral-200 truncate">{userName || 'User'}</p>
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{userEmail || ''}</p>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F8F9FA] dark:bg-[#0a0a0a] relative">
        
        {loading ? (
           <PageSkeleton />
        ) : !account ? (
           <div className="flex-1 flex items-center justify-center">
             <p className="text-slate-500">Account not found.</p>
           </div>
        ) : (
          <>
            {/* Header bar */}
            <header className="h-[68px] border-b border-slate-200/60 dark:border-white/[0.05] bg-white/80 dark:bg-[#111111]/80 backdrop-blur-md px-6 lg:px-10 flex items-center justify-between flex-shrink-0 z-10 sticky top-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.length > 1 ? router.back() : router.push('/dashboard')}
                  className="group flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all"
                >
                  <ChevronRight size={18} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1" />
                <span className="text-[15px] font-semibold text-slate-800 dark:text-white tracking-tight">{account.name}</span>
                {badge && (
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border ${badge.cls} ml-2`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://${account.normalizedDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-600 dark:text-neutral-300 hover:text-[#C94C1E] dark:hover:text-[#E86335] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-[#C94C1E]/30 bg-white dark:bg-white/[0.02] shadow-sm transition-all"
                >
                  <ExternalLink size={14} />
                  Visit Website
                </a>
                <button
                  onClick={() => router.push(`/dashboard?tab=tech-scanner&scan=${encodeURIComponent(domain)}`)}
                  className="hidden sm:inline-flex text-[13px] font-semibold text-white px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-white dark:text-black dark:hover:bg-slate-200 shadow-sm transition-all"
                >
                  Full Tech Scan
                </button>
              </div>
            </header>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              <div className="max-w-[1140px] mx-auto px-6 lg:px-10 py-8">

                {/* ── Account Header ──────────────────────────────────── */}
                <div className="fade-in-up bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] rounded-2xl p-6 lg:p-8 mb-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-5 lg:gap-6">
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-[#C94C1E]/10 to-orange-50 dark:from-[#C94C1E]/20 dark:to-transparent border border-[#C94C1E]/20 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${account.normalizedDomain}&sz=128`}
                          alt={`${account.name} logo`}
                          className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl dark:bg-white dark:p-1 object-contain"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement;
                            t.style.display = 'none';
                            t.parentElement!.innerHTML = `<span class="text-[#C94C1E] text-[32px] font-bold">${account.name[0]}</span>`;
                          }}
                        />
                      </div>
                      <div className="pt-1">
                        <h1 className="text-[26px] lg:text-[30px] font-bold text-slate-900 dark:text-white tracking-tight mb-3 leading-none">
                          {account.name}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          {account.category === 'Not Required' ? (
                            <Badge icon={<ShoppingCart size={12} />} text="Non D2C Brand" bg="bg-red-50 dark:bg-red-500/10" textCol="text-red-700 dark:text-red-400" border="border-red-200 dark:border-red-500/20" />
                          ) : account.category !== 'Unknown' ? (
                            <Badge icon={<ShoppingCart size={12} />} text={account.category} bg="bg-slate-100 dark:bg-white/[0.05]" textCol="text-slate-600 dark:text-neutral-300" />
                          ) : null}
                          {account.category !== 'Not Required' && account.subCategory !== 'General' && account.subCategory !== account.category && (
                            <Badge text={account.subCategory} bg="bg-slate-100 dark:bg-white/[0.05]" textCol="text-slate-600 dark:text-neutral-300" />
                          )}
                          {account.region !== 'Global' && (
                            <Badge icon={<MapPin size={12} />} text={account.region} bg="bg-blue-50 dark:bg-blue-500/10" textCol="text-blue-700 dark:text-blue-400" border="border-blue-200 dark:border-blue-500/20" />
                          )}
                          {account.category !== 'Not Required' && (
                            <Badge icon={<Store size={12} />} text={account.businessModel || 'Pure D2C'} bg="bg-violet-50 dark:bg-violet-500/10" textCol="text-violet-700 dark:text-violet-400" border="border-violet-200 dark:border-violet-500/20" />
                          )}
                          {!techLoading && platform !== 'Custom' && (
                            <Badge icon={<Code size={12} />} text={platform} bg="bg-orange-50 dark:bg-[#C94C1E]/10" textCol="text-orange-700 dark:text-[#E86335]" border="border-orange-200 dark:border-[#C94C1E]/20" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[13px]">
                          <a
                            href={`https://${account.normalizedDomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-slate-500 dark:text-neutral-400 hover:text-[#C94C1E] dark:hover:text-[#E86335] transition-colors font-medium"
                          >
                            <Globe size={14} />
                            {account.normalizedDomain}
                          </a>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-neutral-600" />
                          {account.updatedAt && (
                            <span className="text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
                              <Activity size={14} /> Updated {formatDate(account.updatedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Circular Score Badge */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className="relative w-[84px] h-[84px] flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle cx="42" cy="42" r="38" fill="none" stroke="#e5e7eb" className="dark:stroke-white/[0.08]" strokeWidth="5" />
                          <circle cx="42" cy="42" r="38" fill="none" stroke={score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#94a3b8'} strokeWidth="5" strokeDasharray="238" strokeDashoffset={238 - (238 * score) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
                        </svg>
                        <div className="text-center">
                          <span className={`block text-[24px] font-bold leading-none ${score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-white'}`}>{score}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-widest mt-2">Score</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-3 mt-8 pt-5 border-t border-slate-100 dark:border-white/[0.05]">
                    <div className="relative">
                      <button
                        onClick={() => setWlOpen(!wlOpen)}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#C94C1E] to-[#b5431a] text-white text-[13px] font-semibold hover:from-[#d1582a] hover:to-[#c24b1f] transition-all shadow-sm shadow-[#C94C1E]/20 flex items-center gap-2"
                      >
                        <Plus size={16} />
                        Add to Watchlist
                      </button>
                      {wlOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => { setWlOpen(false); setWlCreating(false); }} />
                          <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-xl z-40 overflow-hidden fade-in-up" style={{ animationDuration: '0.2s' }}>
                            <div className="p-3.5 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                              <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Select Watchlist</p>
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                              {watchlists.length === 0 && !wlCreating && (
                                <p className="px-4 py-6 text-center text-[13px] text-slate-500 dark:text-neutral-400">No watchlists yet.</p>
                              )}
                              {watchlists.map(wl => {
                                const alreadyIn = wl.domains?.includes(domain);
                                return (
                                  <button
                                    key={wl._id}
                                    onClick={() => !alreadyIn && addToWatchlist(wl._id)}
                                    className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors border-b border-slate-50 dark:border-white/[0.02] last:border-0 ${alreadyIn ? 'opacity-50 cursor-default' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer'}`}
                                  >
                                    <span className="text-[13px] text-slate-700 dark:text-neutral-200 font-semibold truncate">{wl.name}</span>
                                    {wlAdded === wl._id ? (
                                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex-shrink-0 flex items-center gap-1"><Check size={12}/> Added</span>
                                    ) : alreadyIn ? (
                                      <span className="text-[11px] text-slate-400 dark:text-neutral-500 flex-shrink-0">Already inside</span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 dark:text-neutral-500 flex-shrink-0 bg-slate-100 dark:bg-white/[0.05] px-2 py-0.5 rounded-md">{wl.domains?.length || 0}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="p-3 border-t border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                              {wlCreating ? (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Name..."
                                    value={wlNewName}
                                    onChange={e => setWlNewName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') createAndAdd(); if (e.key === 'Escape') setWlCreating(false); }}
                                    className="flex-1 px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/[0.1] rounded-xl text-[13px] text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-[#C94C1E] focus:ring-1 focus:ring-[#C94C1E]/20 transition-all"
                                    autoFocus
                                  />
                                  <button onClick={createAndAdd} className="px-4 py-2 rounded-xl bg-slate-800 text-white dark:bg-white dark:text-black text-[12px] font-bold hover:opacity-90 transition-opacity">
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setWlCreating(true)}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[#C94C1E] hover:bg-orange-50 dark:hover:bg-[#C94C1E]/10 transition-colors"
                                >
                                  <Plus size={16} />
                                  Create new watchlist
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <button className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-neutral-300 text-[13px] font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all bg-white dark:bg-transparent shadow-sm">
                      Push to CRM
                    </button>
                    <button className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-neutral-300 text-[13px] font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all bg-white dark:bg-transparent shadow-sm">
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* ── Key Facts Strip ──────────────────────────────── */}
                <div className="fade-in-up delay-100 bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] rounded-2xl overflow-hidden mb-6 shadow-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-white/[0.05]">
                    {[
                      { icon: <Building2 size={14}/>, label: 'Model', value: account.businessModel || 'Pure D2C' },
                      { icon: <Globe size={14}/>, label: 'Region', value: account.displayLocation || account.region || 'Global' },
                      { icon: <Store size={14}/>, label: 'Stores', value: account.offlineStores === 'Unknown' ? '\u2014' : formatStores(account.offlineStores, account.storeRawCount) },
                      { icon: <Smartphone size={14}/>, label: 'Apps', value: account.appPresence === 'Both iOS & Android' ? 'iOS + Android' : account.appPresence },
                      { icon: <Users size={14}/>, label: 'Traffic', value: account.monthlyVisitsFormatted || '\u2014' },
                    ].map((item, i) => (
                      <div key={i} className="px-4 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-neutral-500 mb-1.5">
                            {item.icon}
                            <p className="text-[10px] font-bold uppercase tracking-wider">{item.label}</p>
                        </div>
                        <p className="text-[14px] font-bold text-slate-800 dark:text-white leading-tight truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Content: Two columns ─────────────────────────── */}
                <div className="flex flex-col lg:flex-row gap-6">

                  {/* ── Left: Main content ────────────────────────── */}
                  <div className="flex-1 min-w-0 space-y-6">

                    {/* Technology Stack */}
                    <div className="fade-in-up delay-200 bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.01]">
                        <h2 className="text-[16px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <Cpu className="text-[#C94C1E] dark:text-[#E86335]" size={18} />
                          Technology Stack
                          {techCount > 0 && <span className="text-[12px] font-semibold text-slate-500 bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-full ml-1">{techCount}</span>}
                        </h2>
                        {techCount > 0 && (
                          <button onClick={() => router.push(`/dashboard?tab=tech-scanner&scan=${encodeURIComponent(domain)}`)}
                            className="text-[13px] font-semibold text-[#C94C1E] dark:text-[#E86335] hover:opacity-80 transition-opacity flex items-center gap-1">
                            Full scan <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                      <div className="p-6">
                        {techLoading ? (
                          <div className="flex flex-col gap-4 py-6 max-w-md mx-auto">
                            <div className="flex items-center justify-between text-[13px] font-semibold text-slate-700 dark:text-neutral-300">
                                <span>{scanProgress < 30 ? 'Connecting to site...' : scanProgress < 60 ? 'Analyzing source code...' : scanProgress < 90 ? 'Detecting frameworks...' : 'Finalizing...'}</span>
                                <span className="text-[#C94C1E]">{Math.round(scanProgress)}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#C94C1E] to-[#E86335] transition-all duration-300 ease-out relative" style={{ width: `${scanProgress}%` }}>
                                <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
                              </div>
                            </div>
                          </div>
                        ) : topTechs.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-1">
                            {topTechs.map(({ label, value }) => (
                              <div key={label} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-slate-50 dark:border-white/[0.02] last:border-0 group">
                                <span className="text-[13px] text-slate-500 dark:text-neutral-400 font-medium mb-1 sm:mb-0 group-hover:text-slate-700 dark:group-hover:text-neutral-300 transition-colors">{label}</span>
                                <span className="text-[14px] font-bold text-slate-800 dark:text-neutral-100 sm:text-right">{value}</span>
                              </div>
                            ))}
                          </div>
                        ) : techBlocked ? (
                          <div className="py-10 text-center bg-amber-50/30 dark:bg-amber-500/5 rounded-xl border border-amber-100 dark:border-amber-500/10">
                            <Shield size={32} className="mx-auto text-amber-500 mb-4" />
                            <p className="text-[15px] font-bold text-slate-800 dark:text-white mb-2">Advanced Bot Protection Detected</p>
                            <p className="text-[13px] text-slate-500 dark:text-neutral-400 mb-6 max-w-sm mx-auto leading-relaxed">This site blocks automated scanners. Use our Chrome extension to bypass protections and reveal the full tech stack.</p>
                            <a href="https://chromewebstore.google.com" target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-sm">
                              Get Harvin Extension <ExternalLink size={14}/>
                            </a>
                          </div>
                        ) : (
                          <div className="py-10 text-center">
                            <p className="text-[14px] text-slate-500 dark:text-neutral-400 font-medium">No recognizable technologies found on the homepage.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Signals */}
                    <div className="fade-in-up delay-300 bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.01]">
                        <h2 className="text-[16px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Activity className="text-emerald-500" size={18} />
                            Active Signals
                        </h2>
                      </div>
                      <div className="p-6 space-y-3">
                        <SignalCard
                            active={techCount > 0}
                            blocked={techBlocked}
                            loading={techLoading}
                            icon={<Code size={16} />}
                            text={techCount > 0 ? `${techCount} enterprise technologies detected` : techBlocked ? 'Bot protection limits external scanning' : techLoading ? 'Scanning in progress...' : 'No tech signals found'}
                            date={formatDate(account.updatedAt)}
                        />
                        {account.offlineStores && account.offlineStores !== 'Unknown' && account.offlineStores !== 'Online' && (
                          <SignalCard active icon={<Store size={16}/>} color="blue"
                            text={`${formatStores(account.offlineStores, account.storeRawCount)} offline retail locations mapped across ${account.displayLocation || account.region}`} />
                        )}
                        {!techLoading && platform !== 'Custom' && (
                          <SignalCard active icon={<ShoppingCart size={16}/>} color="orange"
                            text={`E-commerce operations powered by ${platform}`} />
                        )}
                        {account.appPresence !== 'No App' && (
                          <SignalCard active icon={<Smartphone size={16}/>} color="violet"
                            text={`Active mobile strategy with ${account.appPresence} applications`} />
                        )}
                      </div>
                    </div>

                  </div>

                  {/* ── Right: Sidebar ─────────────────────────────── */}
                  <div className="w-full lg:w-[320px] flex-shrink-0 space-y-6">

                    {/* Firmographics */}
                    <div className="fade-in-up delay-200 bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.01]">
                        <h3 className="text-[14px] font-bold text-slate-800 dark:text-white">Firmographics</h3>
                      </div>
                      <div className="p-2">
                        {[
                          { label: 'Domain', value: account.normalizedDomain },
                          { label: 'Category', value: account.category !== 'Unknown' ? account.category : '\u2014' },
                          { label: 'Sub-category', value: account.subCategory !== 'General' ? account.subCategory : '\u2014' },
                          { label: 'Location', value: account.displayLocation || account.region || 'Global' },
                          { label: 'Business Model', value: account.businessModel || 'Pure D2C' },
                          { label: 'Stores', value: account.offlineStores === 'Unknown' ? '\u2014' : formatStores(account.offlineStores, account.storeRawCount) },
                          { label: 'Traffic', value: account.monthlyVisitsFormatted || '\u2014' },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] rounded-lg transition-colors">
                            <span className="text-[12px] font-medium text-slate-500 dark:text-neutral-400">{row.label}</span>
                            <span className="text-[13px] font-bold text-slate-800 dark:text-neutral-200 text-right max-w-[60%] truncate">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Data Confidence */}
                    <div className="fade-in-up delay-300 bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.01]">
                        <h3 className="text-[14px] font-bold text-slate-800 dark:text-white">Data Confidence</h3>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${confidence.bg} ${confidence.color} uppercase tracking-wider`}>
                          {confidence.label}
                        </span>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[13px] font-medium text-slate-500 dark:text-neutral-400">Match Score</span>
                          <span className="text-[15px] font-bold text-slate-800 dark:text-white">{account.found ? (score > 70 ? 94 : score > 50 ? 72 : 45) : 30}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.05] overflow-hidden mb-4">
                          <div className={`h-full rounded-full transition-all duration-1000 ${score > 70 ? 'bg-emerald-500' : score > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${account.found ? (score > 70 ? 94 : score > 50 ? 72 : 45) : 30}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            {account.updatedAt && <p className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">Last verified {formatDate(account.updatedAt)}</p>}
                            <button className="text-[11px] font-bold text-slate-500 hover:text-[#C94C1E] transition-colors">Report Issue</button>
                        </div>
                      </div>
                    </div>

                    {/* External Links */}
                    <div className="fade-in-up delay-[400ms] bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.01]">
                        <h3 className="text-[14px] font-bold text-slate-800 dark:text-white">External Links</h3>
                      </div>
                      <div className="flex flex-col p-2">
                        <a href={`https://${account.normalizedDomain}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-500 group-hover:text-[#C94C1E] group-hover:bg-orange-50 dark:group-hover:bg-[#C94C1E]/10 transition-colors">
                              <Globe size={16} />
                          </div>
                          <span className="text-[13px] font-semibold text-slate-700 dark:text-neutral-200 flex-1">Company Website</span>
                          <ExternalLink size={14} className="text-slate-300 dark:text-neutral-600 group-hover:text-[#C94C1E] transition-colors" />
                        </a>
                        {account.iosAppUrl && !['deep-link-detected','badge-detected','text-detected','section-detected'].includes(account.iosAppUrl) && (
                          <a href={account.iosAppUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-500 group-hover:text-violet-600 group-hover:bg-violet-50 dark:group-hover:bg-violet-500/10 transition-colors">
                              <Smartphone size={16} />
                            </div>
                            <span className="text-[13px] font-semibold text-slate-700 dark:text-neutral-200 flex-1">App Store</span>
                            <ExternalLink size={14} className="text-slate-300 dark:text-neutral-600 group-hover:text-violet-600 transition-colors" />
                          </a>
                        )}
                        {account.androidAppUrl && !['deep-link-detected','badge-detected','text-detected','section-detected'].includes(account.androidAppUrl) && (
                          <a href={account.androidAppUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-500 group-hover:text-emerald-600 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10 transition-colors">
                                <Smartphone size={16} />
                            </div>
                            <span className="text-[13px] font-semibold text-slate-700 dark:text-neutral-200 flex-1">Google Play</span>
                            <ExternalLink size={14} className="text-slate-300 dark:text-neutral-600 group-hover:text-emerald-600 transition-colors" />
                          </a>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Similar Accounts Bottom Section */}
                <div className="mt-6 fade-in-up delay-[500ms] bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.01]">
                    <h2 className="text-[16px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Layers className="text-blue-500" size={18} /> Similar Accounts
                    </h2>
                    {account.similar.length > 0 && (
                      <button onClick={() => router.push(`/dashboard?tab=lookalike-brands&domain=${encodeURIComponent(account.normalizedDomain)}`)} className="text-[13px] font-semibold text-[#C94C1E] dark:text-[#E86335] hover:opacity-80 transition-opacity flex items-center gap-1">
                        Explore all <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                  {account.similar.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-white/[0.05]">
                      {account.similar.slice(0, 3).map(s => (
                        <button key={s.normalizedDomain} onClick={() => router.push(`/account/${s.normalizedDomain}`)}
                          className="w-full flex items-center gap-4 px-6 py-5 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group text-left">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] flex items-center justify-center text-[16px] font-bold text-slate-500 dark:text-neutral-400 flex-shrink-0 group-hover:bg-orange-50 group-hover:text-[#C94C1E] dark:group-hover:bg-[#C94C1E]/10 transition-colors shadow-sm">{s.name[0]}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-bold text-slate-800 dark:text-neutral-100 truncate group-hover:text-[#C94C1E] dark:group-hover:text-[#E86335] transition-colors mb-0.5">{s.name}</p>
                            <p className="text-[12px] font-medium text-slate-500 dark:text-neutral-400 truncate">{s.category}{s.subCategory && s.subCategory !== s.category ? ` · ${s.subCategory}` : ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-10 text-center">
                      <p className="text-[14px] font-medium text-slate-500 dark:text-neutral-400">No similar accounts found in our database.</p>
                    </div>
                  )}
                </div>

                <SimilarAccountsModal domain={account.normalizedDomain} brandName={account.name} open={similarModalOpen} onClose={() => setSimilarModalOpen(false)} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function Badge({ icon, text, bg, textCol, border = "border-transparent" }: { icon?: React.ReactNode, text: string, bg: string, textCol: string, border?: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${bg} ${border} ${textCol} text-[12px] font-semibold`}>
            {icon} {text}
        </span>
    )
}

function SignalCard({ active, blocked, loading, icon, text, date, color = "emerald" }: { active: boolean, blocked?: boolean, loading?: boolean, icon: React.ReactNode, text: string, date?: string, color?: "emerald" | "blue" | "orange" | "violet" }) {
    
    let bgCol = "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.05]";
    let dotCol = "bg-slate-300";
    
    if (active) {
        if (color === "emerald") { bgCol = "bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"; dotCol = "bg-emerald-500"; }
        if (color === "blue") { bgCol = "bg-blue-50/50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20"; dotCol = "bg-blue-500"; }
        if (color === "orange") { bgCol = "bg-orange-50/50 dark:bg-[#C94C1E]/10 border-orange-100 dark:border-[#C94C1E]/20"; dotCol = "bg-[#C94C1E]"; }
        if (color === "violet") { bgCol = "bg-violet-50/50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20"; dotCol = "bg-violet-500"; }
    } else if (blocked) {
        bgCol = "bg-amber-50/50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20";
        dotCol = "bg-amber-500";
    }

    if (loading) dotCol = "bg-slate-400 animate-pulse";

    return (
        <div className={`flex items-start sm:items-center gap-3.5 rounded-xl px-4 py-3.5 border ${bgCol} transition-colors`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-black/20 shadow-sm flex-shrink-0 relative`}>
                <div className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#111111] ${dotCol} -mt-1 -mr-1`} />
                <span className="text-slate-600 dark:text-neutral-300">{icon}</span>
            </div>
            <div className="flex-1">
                <p className="text-[14px] font-semibold text-slate-800 dark:text-neutral-200 leading-snug">{text}</p>
                {date && <p className="text-[11px] font-medium text-slate-500 dark:text-neutral-500 mt-0.5">{date}</p>}
            </div>
        </div>
    )
}

function NavBtn({ icon, label, active, locked, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; locked?: boolean; onClick?: () => void;
}) {
  if (locked) {
    return (
      <div className="flex items-center justify-between rounded-lg text-slate-400 dark:text-neutral-500 cursor-not-allowed transition-all px-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-300 dark:text-neutral-600 flex-shrink-0">{icon}</span>
          <span className="text-[13px] font-bold">{label}</span>
        </div>
        <span className="text-[8px] bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-neutral-500 px-1 py-0.5 rounded font-bold uppercase">Soon</span>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-lg transition-all px-3 py-2 ${
        active
          ? 'bg-orange-50 dark:bg-[#C94C1E]/10 text-[#C94C1E]'
          : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className={`text-[13px] ${active ? 'font-extrabold' : 'font-bold'}`}>{label}</span>
    </button>
  );
}

/* ── Page Skeleton Loader ──────────────────────────────────────────────── */
function PageSkeleton() {
    return (
        <div className="flex-1 flex flex-col w-full h-full">
            <header className="h-[68px] border-b border-slate-200/60 dark:border-white/[0.05] bg-white dark:bg-[#111111] px-6 lg:px-10 flex items-center justify-between flex-shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                    <div className="w-48 h-6 rounded-md bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                </div>
                <div className="flex gap-3">
                    <div className="w-32 h-9 rounded-xl bg-slate-200 dark:bg-white/[0.05] animate-pulse hidden sm:block" />
                    <div className="w-32 h-9 rounded-xl bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                </div>
            </header>
            
            <div className="flex-1 overflow-hidden p-6 lg:p-10 max-w-[1140px] mx-auto w-full">
                {/* Header card skeleton */}
                <div className="w-full h-[220px] rounded-2xl bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] mb-6 p-8 flex flex-col justify-between">
                    <div className="flex justify-between">
                        <div className="flex gap-6">
                            <div className="w-20 h-20 rounded-2xl bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                            <div className="space-y-4 pt-1">
                                <div className="w-64 h-8 rounded-lg bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                                <div className="flex gap-2">
                                    <div className="w-20 h-6 rounded-md bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                                    <div className="w-24 h-6 rounded-md bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                                    <div className="w-20 h-6 rounded-md bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                                </div>
                            </div>
                        </div>
                        <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.05]">
                         <div className="w-36 h-10 rounded-xl bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                         <div className="w-32 h-10 rounded-xl bg-slate-200 dark:bg-white/[0.05] animate-pulse" />
                    </div>
                </div>

                {/* Grid strip skeleton */}
                <div className="w-full h-20 rounded-2xl bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] mb-6 animate-pulse" />

                {/* 2 Cols skeleton */}
                <div className="flex gap-6">
                    <div className="flex-1 space-y-6">
                        <div className="w-full h-80 rounded-2xl bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] animate-pulse" />
                        <div className="w-full h-60 rounded-2xl bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] animate-pulse" />
                    </div>
                    <div className="w-[320px] space-y-6 hidden lg:block">
                        <div className="w-full h-64 rounded-2xl bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] animate-pulse" />
                        <div className="w-full h-48 rounded-2xl bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.05] animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Similar Accounts Modal ────────────────────────────────────────────── */
type SimilarAccount = {
  normalizedDomain: string;
  name: string;
  category: string;
  subCategory: string;
  region: string;
  offlineStores: string;
  businessModel: string | null;
  appPresence: string;
  monthlyVisitsFormatted: string | null;
  topTech: string[];
};

const SIMILARITY_BASES = [
  { key: 'category', label: 'Category', icon: <Layers size={14} /> },
  { key: 'tech', label: 'Tech Stack', icon: <Code size={14} /> },
  { key: 'appPresence', label: 'App Presence', icon: <Smartphone size={14} /> },
  { key: 'offlineStores', label: 'Offline Stores', icon: <Store size={14} /> },
  { key: 'businessModel', label: 'Business Model', icon: <Building2 size={14} /> },
  { key: 'region', label: 'Region', icon: <Globe size={14} /> },
];

function SimilarAccountsModal({ domain, brandName, open, onClose }: {
  domain: string; brandName: string; open: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [activeBases, setActiveBases] = useState<Set<string>>(new Set(['category']));
  const [accounts, setAccounts] = useState<SimilarAccount[]>([]);
  const [basisLabel, setBasisLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Watchlist
  const [watchlists, setWatchlists] = useState<{ _id: string; name: string; domains: string[] }[]>([]);
  const [wlDropdown, setWlDropdown] = useState(false);
  const [wlNewName, setWlNewName] = useState('');

  // For badge highlighting — use first active basis
  const basis = [...activeBases][0] || 'category';

  const toggleBasis = (key: string) => {
    setActiveBases(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (next.size === 0) next.add('category'); // always keep at least one
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const fetchSimilar = useCallback(async (bases: Set<string>) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const basesParam = [...bases].join(',');
      const res = await fetch(`/api/account/${domain}/similar?basis=${basesParam}&limit=500`);
      const data = await res.json();
      setAccounts(data.accounts || []);
      setBasisLabel(data.basisLabel || '');
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (open) {
      fetchSimilar(activeBases);
      fetch('/api/watchlists').then(r => r.json()).then(d => setWatchlists(d.watchlists || [])).catch(() => {});
    }
  }, [open, activeBases, fetchSimilar]);

  const toggleSelect = (d: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === accounts.length) setSelected(new Set());
    else setSelected(new Set(accounts.map(a => a.normalizedDomain)));
  };

  const addToWatchlist = async (wlId: string) => {
    let targetId = wlId;
    // Create new watchlist if prefixed with "new:"
    if (wlId.startsWith('new:')) {
      try {
        const res = await fetch('/api/watchlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: wlId.slice(4) }),
        });
        const data = await res.json();
        if (data.watchlist?._id) {
          targetId = data.watchlist._id;
          setWatchlists(prev => [...prev, data.watchlist]);
        } else return;
      } catch { return; }
    }
    for (const d of selected) {
      await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId, domain: d }),
      }).catch(() => {});
    }
    setWlDropdown(false);
    setSelected(new Set());
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-[#111111] border border-slate-200/60 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-[840px] max-h-[80vh] flex flex-col overflow-hidden" style={{ margin: 'auto' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.01]">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900 dark:text-white">Similar to {brandName}</h2>
            <p className="text-[13px] text-slate-500 dark:text-neutral-400 mt-1 font-medium">{basisLabel || 'Discover related accounts'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-500 hover:bg-slate-200 dark:hover:bg-white/[0.1] hover:text-slate-800 dark:hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Basis Tabs */}
        <div className="px-4 py-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center gap-1.5 overflow-x-auto custom-scrollbar overflow-y-visible">
          <Filter size={12} className="text-slate-400 dark:text-neutral-500 flex-shrink-0 mr-1" />
          {SIMILARITY_BASES.map(b => {
            const isActive = activeBases.has(b.key);
            return (
              <button
                key={b.key}
                onClick={() => toggleBasis(b.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 border ${
                  isActive
                    ? 'bg-[#C94C1E] text-white border-transparent shadow-sm'
                    : 'bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-white/[0.1] hover:border-[#C94C1E]/30 hover:text-[#C94C1E]'
                }`}
              >
                {isActive && <Check size={12} className="stroke-[3]" />}
                {b.icon}
                {b.label}
              </button>
            );
          })}
        </div>

        {/* Select bar — always visible, combines select all + count + add to watchlist */}
        <div className="px-5 py-2.5 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between bg-white dark:bg-[#111111] sticky top-0 z-10">
          {/* Left: select/deselect */}
          <button onClick={selectAll} className="flex items-center gap-2.5 text-[12px] font-semibold text-slate-600 dark:text-neutral-300 hover:text-slate-800 dark:hover:text-white transition-colors">
            <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all ${
              selected.size > 0 && selected.size === accounts.length ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15]'
            }`}>
              {selected.size > 0 && selected.size === accounts.length && <Check size={11} className="text-white stroke-[3]" />}
            </div>
            {selected.size > 0 && selected.size === accounts.length ? 'Deselect all' : `Select all (${accounts.length})`}
          </button>

          {/* Right: count + add to watchlist + close */}
          <div className="flex items-center gap-3">
            {selected.size > 0 && <span className="text-[13px] font-bold text-[#C94C1E]">{selected.size} selected</span>}
            {selected.size > 0 && (
              <div className="relative">
                <button onClick={() => setWlDropdown(!wlDropdown)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C94C1E] text-white text-[13px] font-semibold hover:bg-[#b5431a] transition-all shadow-sm">
                  <Plus size={14} /> Add to Watchlist
                </button>
                {wlDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-2xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Add {selected.size} accounts to</p>
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                      {watchlists.length > 0 ? watchlists.map(wl => (
                        <button key={wl._id} onClick={() => addToWatchlist(wl._id)}
                          className="w-full text-left px-4 py-3 text-[13px] font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] border-b border-slate-50 dark:border-white/[0.02] last:border-0 transition-colors flex items-center justify-between">
                          <span>{wl.name}</span>
                          <span className="text-[11px] text-slate-400 font-medium">{wl.domains?.length || 0}</span>
                        </button>
                      )) : (
                        <p className="px-4 py-4 text-[12px] text-slate-400 text-center">No watchlists yet</p>
                      )}
                    </div>
                    <div className="p-3 border-t border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                      <div className="flex gap-2">
                        <input type="text" placeholder="New watchlist name..." value={wlNewName} onChange={e => setWlNewName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && wlNewName.trim()) { addToWatchlist('new:' + wlNewName.trim()); setWlNewName(''); } }}
                          className="flex-1 px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/[0.1] rounded-lg text-[12px] text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-[#C94C1E] transition-colors" />
                        <button onClick={() => { if (wlNewName.trim()) { addToWatchlist('new:' + wlNewName.trim()); setWlNewName(''); } }}
                          className="px-4 py-2 rounded-lg bg-[#C94C1E]/80 hover:bg-[#C94C1E] text-white text-[12px] font-bold transition-colors">Create</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-transparent">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={28} className="animate-spin text-[#C94C1E]" />
              <p className="text-[14px] font-medium text-slate-500">Finding matches...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Search size={24}/>
              </div>
              <p className="text-[16px] font-bold text-slate-800 dark:text-white">No exact matches found</p>
              <p className="text-[14px] text-slate-500 dark:text-neutral-400 mt-2">Try selecting a different filter above.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">

              {accounts.map(a => (
                <div key={a.normalizedDomain}
                  className={`flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group ${
                    selected.has(a.normalizedDomain) ? 'bg-orange-50/50 dark:bg-[#C94C1E]/5' : 'bg-white dark:bg-transparent'
                  }`}>
                  {/* Checkbox */}
                  <button onClick={() => toggleSelect(a.normalizedDomain)}
                    className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      selected.has(a.normalizedDomain) ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15] group-hover:border-[#C94C1E]/50'
                    }`}>
                    {selected.has(a.normalizedDomain) && <Check size={11} className="text-white stroke-[3]" />}
                  </button>

                  {/* Favicon */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://www.google.com/s2/favicons?domain=${a.normalizedDomain}&sz=64`} alt="" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] flex-shrink-0 bg-white dark:bg-white/[0.04] p-0.5" />

                  {/* Name + meta */}
                  <button onClick={() => { onClose(); router.push(`/account/${a.normalizedDomain}`); }}
                    className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors truncate">{a.name}</span>
                      {a.topTech && a.topTech.length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded-full flex-shrink-0">{a.topTech.length} tech</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-neutral-400">
                      <span>{a.category}</span>
                      <span className="text-slate-300 dark:text-neutral-600">·</span>
                      <span>{a.region}</span>
                    </div>
                  </button>

                  {/* Badges — all active filters */}
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    {activeBases.has('category') && (
                      <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.category}</span>
                    )}
                    {activeBases.has('appPresence') && (
                      <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.appPresence === 'Both iOS & Android' ? 'iOS+Android' : a.appPresence}</span>
                    )}
                    {activeBases.has('offlineStores') && (
                      <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.offlineStores} stores</span>
                    )}
                    {activeBases.has('businessModel') && (
                      <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.businessModel || 'Pure D2C'}</span>
                    )}
                    {activeBases.has('tech') && a.topTech && a.topTech.length > 0 && (
                      <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.topTech.join(', ')}</span>
                    )}
                    {activeBases.has('region') && (
                      <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.region}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.01] flex items-center justify-between">
          <span className="text-[13px] font-medium text-slate-500 dark:text-neutral-400">{accounts.length} potential matches</span>
          <button onClick={onClose} className="text-[13px] font-bold text-slate-600 dark:text-neutral-300 px-4 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-all">Close Window</button>
        </div>
      </div>
    </div>
  );
}