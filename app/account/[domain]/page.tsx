'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import {
  Search, Satellite, Star, Target, Swords, Briefcase,
  Settings2, Link2, LogOut, ExternalLink, Globe, MapPin,
  Building2, TrendingUp, Shield, ChevronRight, Plus,
  Store, Users, ShoppingCart, Code, Loader2, Radar, Smartphone,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';


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

type SidebarTab = 'market-intelligence' | 'account-explorer' | 'my-watchlists' | 'recently-funded' | 'competitor-clients' | 'current-clients' | 'icp-preferences' | 'integrations';

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

function channelType(stores: string): string {
  if (!stores || stores === 'Unknown') return 'Unknown';
  if (stores === 'Online') return 'Online Only';
  return 'Omnichannel';
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

function computeConfidenceLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'High', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' };
  if (score >= 50) return { label: 'Medium', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-white/[0.08]' };
  return { label: 'Low', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-white/[0.08]' };
}

function scoreColor(s: number): string {
  if (s >= 70) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-white/[0.08]';
  return 'text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08]';
}

function priorityBadge(s: number): { label: string; cls: string } | null {
  if (s >= 70) return { label: 'High Priority', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' };
  if (s >= 50) return { label: 'Medium Priority', cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-white/[0.08]' };
  return null;
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isDark, toggle: onToggleTheme } = useTheme();
  const domain = decodeURIComponent(params.domain as string);

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

  // Watchlist state
  const [wlOpen, setWlOpen] = useState(false);
  const [watchlists, setWatchlists] = useState<{ _id: string; name: string; domains: string[] }[]>([]);
  const [wlCreating, setWlCreating] = useState(false);
  const [wlNewName, setWlNewName] = useState('');
  const [wlAdded, setWlAdded] = useState<string | null>(null);

  // Auth
  useEffect(() => {
    if (status === 'loading') return;
    const u = localStorage.getItem('harvin_user');
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
    let stale = false;
    const TECH_CACHE_KEY = 'harvin_account_tech_cache';
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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

    // Show cached tech instantly
    const cachedTech = getCachedTech(domain);
    if (cachedTech) {
      setTechs(cachedTech.technologies || []);
      setTechCount(cachedTech.count || 0);
      setTechLoading(false);
    }

    // Animate progress bar while loading
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    if (!cachedTech) {
      setScanProgress(0);
      progressInterval = setInterval(() => {
        setScanProgress(p => {
          if (p >= 90) return 90; // Stall at 90 until real response
          return p + (90 - p) * 0.08; // Ease-out curve
        });
      }, 200);
    }

    async function load() {
      // Phase 1: Account meta (fast, from DB)
      try {
        const res = await fetch(`/api/account/${encodeURIComponent(domain)}`);
        if (stale) return;
        const data: AccountData = await res.json();
        setAccount(data);
        setLoading(false);
        if (!cachedTech) setScanProgress(p => Math.max(p, 30));
      } catch {
        setLoading(false);
      }

      // Phase 2: Tech scan (may be slow for bot-protected sites)
      try {
        if (!cachedTech) setScanProgress(p => Math.max(p, 50));
        const res = await fetch(`/api/detect?url=${encodeURIComponent(domain)}`);
        if (stale) return;
        const text = await res.text();
        if (!text) return;
        const data: ScanResult = JSON.parse(text);
        if (data.technologies && data.technologies.length > 0) {
          setTechs(data.technologies);
          setTechCount(data.count || data.technologies.length);
          setCachedTech(domain, data);
        }
        if (data.blocked) {
          setTechBlocked(true);
        }
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

  // Fetch watchlists when dropdown opens
  useEffect(() => {
    if (!wlOpen) return;
    fetch('/api/watchlists')
      .then(r => r.json())
      .then(d => setWatchlists(d.watchlists || []))
      .catch(() => {});
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
      const r = await fetch('/api/watchlists');
      const d = await r.json();
      setWatchlists(d.watchlists || []);
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
      const wl = await res.json();
      setWlNewName('');
      setWlCreating(false);
      await addToWatchlist(wl._id);
    } catch {}
  };

  const handleLogout = () => {
    ['harvin_user', 'harvin_onboarding', 'harvin_dashboard_filters'].forEach(k => localStorage.removeItem(k));
    signOut({ callbackUrl: '/' });
  };

  // Computed
  const score = account
    ? Math.min((account.score || 40) + Math.min(techCount * 2, 20), 99)
    : 0;
  const confidence = computeConfidenceLabel(
    account?.found ? (score > 70 ? 94 : score > 50 ? 72 : 45) : 30
  );
  const badge = priorityBadge(score);
  const platform = detectPlatform(techs);
  const topTechs = account ? getTopTechsByCategory(techs) : [];
  const firstName = userName?.split(' ')[0] || 'User';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#C94C1E] animate-spin" />
          <p className="text-slate-500 dark:text-neutral-400 text-[14px]">Loading account&hellip;</p>
        </div>
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] dark:bg-[#0a0a0a] font-sans text-slate-900 dark:text-white overflow-hidden">

      {/* ── Left Sidebar (mirrors dashboard) ──────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[220px] bg-white dark:bg-[#141414] border-r border-slate-100 dark:border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-shrink-0 px-5 py-4">
          <div className="flex items-center gap-0.5 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <div className="h-7 w-8 overflow-hidden flex-shrink-0">
              <img src="/logo.svg" alt="" aria-hidden="true" className="h-7 w-auto max-w-none" />
            </div>
            <span className="font-bricolage font-bold text-[18px] tracking-normal text-slate-900 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div className="space-y-4 px-3">
          <div>
            <h3 className="px-3 mb-1 text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Intelligence</h3>
            <div className="space-y-0.5">
              <SidebarBtn icon={<Satellite size={18} />} label="Market Intelligence" onClick={() => router.push('/dashboard?tab=market-intelligence')} />
              <SidebarBtn icon={<Search size={18} />} label="Account Explorer" active onClick={() => router.push('/dashboard')} />
              <SidebarBtn icon={<Radar size={18} />} label="Tech Scanner" onClick={() => router.push('/dashboard?tab=tech-scanner')} />
            </div>
          </div>

          <div>
            <h3 className="px-3 mb-1 text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Watchlists</h3>
            <div className="space-y-0.5">
              <SidebarBtn icon={<Star size={18} />} label="My Watchlists" onClick={() => router.push('/dashboard?tab=my-watchlists')} />
              <SidebarBtnLocked icon={<Target size={18} />} label="Recently Funded" />
              <SidebarBtnLocked icon={<Swords size={18} />} label="Competitor Clients" />
              <SidebarBtnLocked icon={<Briefcase size={18} />} label="Current Clients" />
            </div>
          </div>

          <div>
            <h3 className="px-3 mb-1 text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Settings</h3>
            <div className="space-y-0.5">
              <SidebarBtn icon={<Settings2 size={18} />} label="ICP & Preferences" onClick={() => router.push('/dashboard?tab=icp-preferences')} />
              <SidebarBtn icon={<Link2 size={18} />} label="Integrations" onClick={() => router.push('/dashboard?tab=integrations')} />
            </div>
          </div>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="px-3 pb-2">
          <button
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
          >
            {isDark ? (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                <path d="M17.5 11.5A7.5 7.5 0 1 1 8.5 2.5a5.5 5.5 0 0 0 9 9z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>

        {/* User */}
        <div className="border-t border-slate-100 dark:border-white/[0.06] flex-shrink-0 px-3 py-2.5">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C94C1E] to-[#e07040] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {firstName[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-700 dark:text-neutral-200 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{userEmail}</p>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9] dark:bg-[#0a0a0a] relative">

        {/* Header bar */}
        <header className="h-[64px] border-b border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#141414] px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.length > 1 ? router.back() : router.push('/dashboard')}
              className="text-[13px] text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors font-medium"
            >
              &larr; Back
            </button>
            <ChevronRight size={14} className="text-slate-300 dark:text-neutral-600" />
            <span className="text-[14px] font-semibold text-slate-800 dark:text-white">{account.name}</span>
            {badge && (
              <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full border ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://${account.normalizedDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-neutral-400 hover:text-[#C94C1E] transition-colors px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:border-[#C94C1E]/30 bg-white dark:bg-[#141414]/60"
            >
              <ExternalLink size={12} />
              Visit Website
            </a>
            <button
              onClick={() => router.push(`/dashboard?tab=tech-scanner&scan=${encodeURIComponent(domain)}`)}
              className="text-[12px] font-medium text-slate-500 dark:text-neutral-400 hover:text-[#C94C1E] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:border-[#C94C1E]/30 bg-white dark:bg-[#141414]/60 transition-all"
            >
              Full Tech Scan
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto px-8 py-6">

            {/* ── Account Header ──────────────────────────────────── */}
            <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 mb-6 shadow-sm dark:shadow-none">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C94C1E]/10 to-orange-50 dark:to-[#C94C1E]/5 border border-[#C94C1E]/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${account.normalizedDomain}&sz=64`}
                      alt=""
                      width={32}
                      height={32}
                      className="rounded-lg dark:bg-white dark:p-[3px]"
                      onError={(e) => {
                        const t = e.target as HTMLImageElement;
                        t.style.display = 'none';
                        t.parentElement!.innerHTML = `<span class="text-[#C94C1E] text-[22px] font-bold">${account.name[0]}</span>`;
                      }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-[22px] font-bold text-slate-900 dark:text-white tracking-[-0.02em]">{account.name}</h1>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[13px] text-slate-500 dark:text-neutral-400">
                      {account.category !== 'Unknown' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-neutral-300 text-[12px] font-medium">
                          <ShoppingCart size={11} /> {account.category}
                        </span>
                      )}
                      {account.subCategory !== 'General' && account.subCategory !== account.category && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-neutral-300 text-[12px] font-medium">
                          {account.subCategory}
                        </span>
                      )}
                      {account.region !== 'Global' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-white/[0.08] text-blue-700 dark:text-blue-400 text-[12px] font-medium">
                          <MapPin size={11} /> {account.region}
                        </span>
                      )}
                      {channelType(account.offlineStores) !== 'Unknown' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-400 text-[12px] font-medium">
                          <Store size={11} /> {channelType(account.offlineStores)}
                        </span>
                      )}
                      {!techLoading && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 dark:bg-[#C94C1E]/10 border border-orange-200 dark:border-[#C94C1E]/30 text-orange-700 dark:text-[#C94C1E] text-[12px] font-medium">
                          <Code size={11} /> {platform}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <a
                        href={`https://${account.normalizedDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 dark:text-neutral-500 hover:text-[#C94C1E] transition-colors"
                      >
                        <Globe size={12} />
                        {account.normalizedDomain}
                      </a>
                      {account.updatedAt && (
                        <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                          Updated {formatDate(account.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-[24px] font-bold ${scoreColor(score)}`}>
                    {score}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium">Score</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                <div className="relative">
                  <button
                    onClick={() => setWlOpen(!wlOpen)}
                    className="px-4 py-2 rounded-xl bg-[#C94C1E] text-white text-[13px] font-semibold hover:bg-[#b5431a] transition-colors shadow-sm"
                  >
                    <Plus size={14} className="inline mr-1.5 -mt-0.5" />
                    Add to Watchlist
                  </button>
                  {wlOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => { setWlOpen(false); setWlCreating(false); }} />
                      <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-xl dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] z-40 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 dark:border-white/[0.06]">
                          <p className="text-[11px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Add to watchlist</p>
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {watchlists.length === 0 && !wlCreating && (
                            <p className="px-4 py-3 text-[12px] text-slate-400 dark:text-neutral-500 italic">No watchlists yet</p>
                          )}
                          {watchlists.map(wl => {
                            const alreadyIn = wl.domains?.includes(domain);
                            return (
                              <button
                                key={wl._id}
                                onClick={() => !alreadyIn && addToWatchlist(wl._id)}
                                className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors ${alreadyIn ? 'opacity-50 cursor-default' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer'}`}
                              >
                                <span className="text-[13px] text-slate-700 dark:text-neutral-200 font-medium truncate">{wl.name}</span>
                                {wlAdded === wl._id ? (
                                  <span className="text-[11px] text-emerald-600 font-semibold flex-shrink-0">Added!</span>
                                ) : alreadyIn ? (
                                  <span className="text-[11px] text-slate-400 dark:text-neutral-500 flex-shrink-0">Already added</span>
                                ) : (
                                  <span className="text-[11px] text-slate-400 dark:text-neutral-500 flex-shrink-0">{wl.domains?.length || 0} accounts</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="p-2 border-t border-slate-100 dark:border-white/[0.06]">
                          {wlCreating ? (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="Watchlist name..."
                                value={wlNewName}
                                onChange={e => setWlNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') createAndAdd(); if (e.key === 'Escape') setWlCreating(false); }}
                                className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-[12px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-[#C94C1E]/50 focus:ring-1 focus:ring-[#C94C1E]/20 dark:focus:ring-[#C94C1E]/20"
                                autoFocus
                              />
                              <button onClick={createAndAdd} className="px-3 py-1.5 rounded-lg bg-[#C94C1E] text-white text-[11px] font-bold hover:bg-[#b5431a]">
                                Create
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setWlCreating(true)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-[#C94C1E] hover:bg-orange-50 dark:hover:bg-[#C94C1E]/10 transition-colors"
                            >
                              <Plus size={14} />
                              Create new watchlist
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-neutral-400 text-[13px] font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                  Push to CRM
                </button>
                <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-neutral-400 text-[13px] font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                  Export
                </button>
              </div>
            </div>

            {/* ── Main Grid ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              {/* Left Column */}
              <div className="space-y-6">

                {/* Overview Cards Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <MetricCard icon={<Store size={16} className="text-violet-500" />} label="Offline Stores" value={account.offlineStores === 'Unknown' ? '\u2014' : account.offlineStores || 'Online'} sub={account.aiStoreCount > 0 ? `${account.aiStoreCount} AI-detected` : null} />
                  <MetricCard icon={<Building2 size={16} className="text-blue-500" />} label="Channel" value={channelType(account.offlineStores)} />
                  <MetricCard icon={<MapPin size={16} className="text-emerald-500" />} label="Location" value={account.displayLocation || account.region || 'Global'} sub={account.locationLevel === 'city' || account.locationLevel === 'state' ? account.region : null} />
                  <MetricCard icon={<Users size={16} className="text-amber-500" />} label="Est. Traffic" value={account.monthlyVisitsFormatted || account.scaleBand || '\u2014'} sub={account.monthlyVisitsFormatted && account.scaleBand ? account.scaleBand : (account.monthlyVisits ? null : 'No data yet')} muted={!account.monthlyVisits} />
                </div>

                {/* Active Signals */}
                <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm dark:shadow-none">
                  <h2 className="text-[15px] font-bold text-slate-800 dark:text-white mb-4">Active Signals</h2>
                  <div className="space-y-3">
                    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                      techCount > 0
                        ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/30'
                        : techBlocked
                          ? 'bg-amber-50/50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/30'
                          : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]'
                    }`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        techCount > 0 ? 'bg-emerald-500' : techBlocked ? 'bg-amber-500' : 'bg-slate-400 animate-pulse'
                      }`} />
                      <span className="text-[13px] text-slate-700 dark:text-neutral-200">
                        {techCount > 0
                          ? `${techCount} technologies detected`
                          : techBlocked
                            ? 'Site has bot protection — use Chrome extension for full scan'
                            : techLoading
                              ? 'Scanning tech stack...'
                              : 'No technologies detected'}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-neutral-500 ml-auto flex-shrink-0">{formatDate(account.updatedAt)}</span>
                    </div>
                    {account.offlineStores && account.offlineStores !== 'Unknown' && account.offlineStores !== 'Online' && (
                      <div className="flex items-center gap-3 bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/30 rounded-xl px-4 py-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="text-[13px] text-slate-700 dark:text-neutral-200">{account.offlineStores} offline stores across {account.displayLocation || account.region}</span>
                      </div>
                    )}
                    {!techLoading && platform !== 'Custom' && (
                      <div className="flex items-center gap-3 bg-orange-50/50 dark:bg-[#C94C1E]/10 border border-orange-100 dark:border-[#C94C1E]/30 rounded-xl px-4 py-3">
                        <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                        <span className="text-[13px] text-slate-700 dark:text-neutral-200">Powered by {platform} ecommerce platform</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tech Stack */}
                <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-bold text-slate-800 dark:text-white">Technology Stack</h2>
                    {techCount > 0 && (
                      <button
                        onClick={() => router.push(`/dashboard?tab=tech-scanner&scan=${encodeURIComponent(domain)}`)}
                        className="text-[12px] font-medium text-[#C94C1E] hover:text-[#b5431a] transition-colors"
                      >
                        View all {techCount} &rarr;
                      </button>
                    )}
                  </div>

                  {techLoading ? (
                    <div className="py-8">
                      <div className="flex items-center gap-3 mb-4">
                        <Loader2 className="w-5 h-5 text-[#C94C1E] animate-spin flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-slate-700 dark:text-neutral-200 mb-1">
                            {scanProgress < 30 ? 'Connecting to site...' : scanProgress < 60 ? 'Analyzing page content...' : scanProgress < 90 ? 'Detecting technologies...' : 'Finishing up...'}
                          </p>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#C94C1E] transition-all duration-500 ease-out"
                              style={{ width: `${scanProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-neutral-600 text-center">
                        This usually takes 5–15 seconds
                      </p>
                    </div>
                  ) : topTechs.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                      {topTechs.map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/[0.06] last:border-0">
                          <span className="text-[13px] text-slate-400 dark:text-neutral-500 font-medium">{label}</span>
                          <span className="text-[13px] font-semibold text-slate-700 dark:text-neutral-200 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : techBlocked ? (
                    <div className="py-6 text-center">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                      </div>
                      <p className="text-[13px] font-medium text-slate-700 dark:text-neutral-300 mb-1">
                        Bot protection detected
                      </p>
                      <p className="text-[12px] text-slate-400 dark:text-neutral-500 mb-4 max-w-xs mx-auto">
                        This site blocks automated scans. Use our Chrome extension to scan from your browser.
                      </p>
                      <a
                        href="https://chromewebstore.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] transition-all"
                      >
                        Get Extension
                      </a>
                    </div>
                  ) : (
                    <p className="text-[13px] text-slate-400 dark:text-neutral-500 py-4">No technologies detected.</p>
                  )}
                </div>

                {/* Scale & Presence (expanded) */}
                <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm dark:shadow-none">
                  <h2 className="text-[15px] font-bold text-slate-800 dark:text-white mb-4">Scale &amp; Presence</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <MetricCard icon={<TrendingUp size={16} className="text-slate-400 dark:text-neutral-500" />} label="Employees" value="\u2014" sub="Coming soon" muted />
                    <MetricCard
                      icon={<Smartphone size={16} className={account.appPresence !== 'No App' ? 'text-violet-500' : 'text-slate-400 dark:text-neutral-500'} />}
                      label="App Presence"
                      value={account.appPresence}
                      sub={account.appPresence === 'No App' ? 'No mobile app detected' : (
                        [account.iosAppUrl ? 'App Store' : '', account.androidAppUrl ? 'Play Store' : ''].filter(Boolean).join(' + ')
                      ) || null}
                      muted={account.appPresence === 'No App'}
                    />
                    <MetricCard icon={<Shield size={16} className="text-slate-400 dark:text-neutral-500" />} label="Security Score" value="\u2014" sub="Coming soon" muted />
                  </div>
                </div>
              </div>

              {/* ── Right Sidebar ────────────────────────────────── */}
              <div className="space-y-6">

                {/* Quick Info */}
                <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm dark:shadow-none">
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white mb-4">Quick Info</h3>
                  <div className="space-y-3">
                    <InfoRow label="Domain" value={account.normalizedDomain} />
                    <InfoRow label="Category" value={account.category !== 'Unknown' ? account.category : '\u2014'} />
                    <InfoRow label="Sub-category" value={account.subCategory !== 'General' ? account.subCategory : '\u2014'} />
                    <InfoRow label="Location" value={account.displayLocation || account.region} />
                    <InfoRow label="Channel" value={channelType(account.offlineStores)} />
                    {!techLoading && <InfoRow label="Platform" value={platform} />}
                    <InfoRow label="Store Count" value={account.offlineStores === 'Unknown' ? '\u2014' : account.offlineStores} />
                  </div>
                </div>

                {/* Data Confidence */}
                <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm dark:shadow-none">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-bold text-slate-800 dark:text-white">Data Confidence</h3>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${confidence.bg} ${confidence.color}`}>
                      {confidence.label} ({account.found ? (score > 70 ? 94 : score > 50 ? 72 : 45) : 30}%)
                    </span>
                  </div>
                  {account.updatedAt && (
                    <p className="text-[11px] text-slate-400 dark:text-neutral-500">Last verified: {formatDate(account.updatedAt)}</p>
                  )}
                  <button className="text-[12px] text-[#C94C1E] hover:text-[#b5431a] font-medium mt-2 transition-colors">
                    Report incorrect data &rarr;
                  </button>
                </div>

                {/* Funding */}
                <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm dark:shadow-none">
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white mb-4">Funding History</h3>
                  <div className="text-center py-4">
                    <p className="text-[24px] font-bold text-slate-300 dark:text-neutral-600">&mdash;</p>
                    <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-1">Total Raised</p>
                  </div>
                  <div className="border-t border-slate-100 dark:border-white/[0.06] pt-3">
                    <p className="text-[12px] text-slate-400 dark:text-neutral-500 italic text-center">Coming soon</p>
                  </div>
                </div>

                {/* Similar Accounts */}
                <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm dark:shadow-none">
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-white mb-4">Similar Accounts</h3>
                  {account.similar.length > 0 ? (
                    <div className="space-y-1">
                      {account.similar.map(s => (
                        <button
                          key={s.normalizedDomain}
                          onClick={() => router.push(`/account/${s.normalizedDomain}`)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-[12px] font-bold text-slate-500 dark:text-neutral-400 flex-shrink-0">
                            {s.name[0]}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-[13px] font-semibold text-slate-700 dark:text-neutral-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{s.name}</p>
                            <p className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">{s.category}{s.subCategory && s.subCategory !== s.category ? ` · ${s.subCategory}` : ''}</p>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 dark:text-neutral-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400 dark:text-neutral-500 italic text-center py-3">No similar accounts found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function MetricCard({
  icon,
  label,
  value,
  sub,
  muted,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
  muted?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 shadow-sm dark:shadow-none">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[11px] font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-[18px] font-bold leading-tight ${muted ? 'text-slate-300 dark:text-neutral-600' : 'text-slate-800 dark:text-white'}`}>{value}</p>
      {sub && (
        <p className={`text-[11px] mt-1 ${muted ? 'text-slate-400 dark:text-neutral-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{sub}</p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-white/[0.04] last:border-0">
      <span className="text-[12px] text-slate-400 dark:text-neutral-500 font-medium">{label}</span>
      <span className="text-[12px] font-semibold text-slate-700 dark:text-neutral-200">{value}</span>
    </div>
  );
}

function SidebarBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-lg transition-all px-3 py-2 ${
        active ? 'bg-orange-50 dark:bg-[#C94C1E]/10 text-[#C94C1E] font-semibold' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

function SidebarBtnLocked({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg text-slate-400 dark:text-neutral-500 cursor-not-allowed transition-all px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="text-slate-300 dark:text-neutral-600 flex-shrink-0">{icon}</span>
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <span className="text-[8px] bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-neutral-500 px-1 py-0.5 rounded font-bold uppercase">Soon</span>
    </div>
  );
}
