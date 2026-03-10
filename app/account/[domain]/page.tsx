'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import {
  Search, Satellite, Star, Target, Swords, Briefcase,
  Settings2, Link2, LogOut, ExternalLink, Globe, MapPin,
  Building2, TrendingUp, Shield, ChevronRight, Plus,
  Store, Users, ShoppingCart, Code, Loader2,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface AccountData {
  normalizedDomain: string;
  name: string;
  category: string;
  subCategory: string;
  region: string;
  offlineStores: string;
  aiStoreCount: number;
  storeConfidence: { level?: string; score?: number } | null;
  updatedAt: string | null;
  createdAt: string | null;
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
  if (score >= 80) return { label: 'High', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 50) return { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { label: 'Low', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
}

function scoreColor(s: number): string {
  if (s >= 70) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (s >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-slate-500 bg-slate-50 border-slate-200';
}

function priorityBadge(s: number): { label: string; cls: string } | null {
  if (s >= 70) return { label: 'High Priority', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (s >= 50) return { label: 'Medium Priority', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return null;
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const domain = decodeURIComponent(params.domain as string);

  const [account, setAccount] = useState<AccountData | null>(null);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [techCount, setTechCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [techLoading, setTechLoading] = useState(true);

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

    async function load() {
      try {
        const res = await fetch(`/api/account/${encodeURIComponent(domain)}`);
        if (stale) return;
        const data: AccountData = await res.json();
        setAccount(data);
        setLoading(false);
      } catch {
        setLoading(false);
      }

      try {
        const res = await fetch(`/api/detect?url=${encodeURIComponent(domain)}`);
        if (stale) return;
        const text = await res.text();
        if (!text) return;
        const data: ScanResult = JSON.parse(text);
        if (data.technologies) {
          setTechs(data.technologies);
          setTechCount(data.count || data.technologies.length);
        }
      } catch {}
      if (!stale) setTechLoading(false);
    }

    load();
    return () => { stale = true; };
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
      <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#C94C1E] animate-spin" />
          <p className="text-slate-500 text-[14px]">Loading account&hellip;</p>
        </div>
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] font-sans text-slate-900 overflow-hidden">

      {/* ── Left Sidebar (mirrors dashboard) ──────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[260px] bg-white border-r border-slate-100 flex-shrink-0">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <Image src="/logo.svg" alt="HarvinAI" width={40} height={40} className="rounded-xl shadow-lg shadow-orange-500/10" />
            <span className="text-2xl font-bold tracking-tight text-slate-800">HarvinAI</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-8 custom-scrollbar">
          <div>
            <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Intelligence</h3>
            <div className="space-y-1">
              <SidebarBtn icon={<Satellite size={18} />} label="Market Intelligence" onClick={() => router.push('/dashboard')} />
              <SidebarBtn icon={<Search size={18} />} label="Account Explorer" active onClick={() => router.push('/dashboard')} />
            </div>
          </div>

          <div>
            <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Watchlists</h3>
            <div className="space-y-1">
              <SidebarBtn icon={<Star size={18} />} label="My Watchlists" onClick={() => router.push('/dashboard')} />
              <SidebarBtnLocked icon={<Target size={18} />} label="Recently Funded" />
              <SidebarBtnLocked icon={<Swords size={18} />} label="Competitor Clients" />
              <SidebarBtnLocked icon={<Briefcase size={18} />} label="Current Clients" />
            </div>
          </div>

          <div>
            <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Settings</h3>
            <div className="space-y-1">
              <SidebarBtn icon={<Settings2 size={18} />} label="ICP & Preferences" onClick={() => router.push('/dashboard')} />
              <SidebarBtn icon={<Link2 size={18} />} label="Integrations" onClick={() => router.push('/dashboard')} />
            </div>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C94C1E] to-[#e07040] flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
              {firstName[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-700 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 truncate">{userEmail}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="mt-0.5 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 w-full transition-colors">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9] relative">

        {/* Header bar */}
        <header className="h-[64px] border-b border-slate-100 bg-white px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.length > 1 ? router.back() : router.push('/dashboard')}
              className="text-[13px] text-slate-400 hover:text-slate-700 transition-colors font-medium"
            >
              &larr; Back
            </button>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="text-[14px] font-semibold text-slate-800">{account.name}</span>
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
              className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-[#C94C1E] transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#C94C1E]/30 bg-white"
            >
              <ExternalLink size={12} />
              Visit Website
            </a>
            <button
              onClick={() => router.push(`/scan/${domain}`)}
              className="text-[12px] font-medium text-slate-500 hover:text-[#C94C1E] px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#C94C1E]/30 bg-white transition-all"
            >
              Full Tech Scan
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto px-8 py-6">

            {/* ── Account Header ──────────────────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C94C1E]/10 to-orange-50 border border-[#C94C1E]/15 flex items-center justify-center text-[#C94C1E] text-[22px] font-bold flex-shrink-0">
                    {account.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-[22px] font-bold text-slate-900 tracking-[-0.02em]">{account.name}</h1>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[13px] text-slate-500">
                      {account.category !== 'Unknown' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-[12px] font-medium">
                          <ShoppingCart size={11} /> {account.category}
                        </span>
                      )}
                      {account.subCategory !== 'General' && account.subCategory !== account.category && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-[12px] font-medium">
                          {account.subCategory}
                        </span>
                      )}
                      {account.region !== 'Global' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-medium">
                          <MapPin size={11} /> {account.region}
                        </span>
                      )}
                      {channelType(account.offlineStores) !== 'Unknown' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-violet-700 text-[12px] font-medium">
                          <Store size={11} /> {channelType(account.offlineStores)}
                        </span>
                      )}
                      {!techLoading && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[12px] font-medium">
                          <Code size={11} /> {platform}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <a
                        href={`https://${account.normalizedDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-[#C94C1E] transition-colors"
                      >
                        <Globe size={12} />
                        {account.normalizedDomain}
                      </a>
                      {account.updatedAt && (
                        <span className="text-[11px] text-slate-400">
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
                  <span className="text-[10px] text-slate-400 font-medium">Score</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
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
                      <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden">
                        <div className="p-3 border-b border-slate-100">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Add to watchlist</p>
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {watchlists.length === 0 && !wlCreating && (
                            <p className="px-4 py-3 text-[12px] text-slate-400 italic">No watchlists yet</p>
                          )}
                          {watchlists.map(wl => {
                            const alreadyIn = wl.domains?.includes(domain);
                            return (
                              <button
                                key={wl._id}
                                onClick={() => !alreadyIn && addToWatchlist(wl._id)}
                                className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors ${alreadyIn ? 'opacity-50 cursor-default' : 'hover:bg-slate-50 cursor-pointer'}`}
                              >
                                <span className="text-[13px] text-slate-700 font-medium truncate">{wl.name}</span>
                                {wlAdded === wl._id ? (
                                  <span className="text-[11px] text-emerald-600 font-semibold flex-shrink-0">Added!</span>
                                ) : alreadyIn ? (
                                  <span className="text-[11px] text-slate-400 flex-shrink-0">Already added</span>
                                ) : (
                                  <span className="text-[11px] text-slate-400 flex-shrink-0">{wl.domains?.length || 0} accounts</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="p-2 border-t border-slate-100">
                          {wlCreating ? (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="Watchlist name..."
                                value={wlNewName}
                                onChange={e => setWlNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') createAndAdd(); if (e.key === 'Escape') setWlCreating(false); }}
                                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 placeholder-slate-400 outline-none focus:border-[#C94C1E]/50 focus:ring-1 focus:ring-[#C94C1E]/20"
                                autoFocus
                              />
                              <button onClick={createAndAdd} className="px-3 py-1.5 rounded-lg bg-[#C94C1E] text-white text-[11px] font-bold hover:bg-[#b5431a]">
                                Create
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setWlCreating(true)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-[#C94C1E] hover:bg-orange-50 transition-colors"
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
                <button className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors">
                  Push to CRM
                </button>
                <button className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors">
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
                  <MetricCard icon={<MapPin size={16} className="text-emerald-500" />} label="Region" value={account.region !== 'Global' ? account.region : 'Global'} />
                  <MetricCard icon={<Users size={16} className="text-amber-500" />} label="MAU" value="\u2014" sub="Coming soon" muted />
                </div>

                {/* Active Signals */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-[15px] font-bold text-slate-800 mb-4">Active Signals</h2>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-[13px] text-slate-700">{techCount > 0 ? `${techCount} technologies detected` : 'Tech scan in progress'}</span>
                      <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">{formatDate(account.updatedAt)}</span>
                    </div>
                    {account.offlineStores && account.offlineStores !== 'Unknown' && account.offlineStores !== 'Online' && (
                      <div className="flex items-center gap-3 bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="text-[13px] text-slate-700">{account.offlineStores} offline stores across {account.region}</span>
                      </div>
                    )}
                    {!techLoading && platform !== 'Custom' && (
                      <div className="flex items-center gap-3 bg-orange-50/50 border border-orange-100 rounded-xl px-4 py-3">
                        <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                        <span className="text-[13px] text-slate-700">Powered by {platform} ecommerce platform</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tech Stack */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-bold text-slate-800">Technology Stack</h2>
                    {techCount > 0 && (
                      <button
                        onClick={() => router.push(`/scan/${domain}`)}
                        className="text-[12px] font-medium text-[#C94C1E] hover:text-[#b5431a] transition-colors"
                      >
                        View all {techCount} &rarr;
                      </button>
                    )}
                  </div>

                  {techLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 text-[#C94C1E] animate-spin" />
                      <span className="text-[13px] text-slate-400 ml-3">Scanning technologies&hellip;</span>
                    </div>
                  ) : topTechs.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                      {topTechs.map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                          <span className="text-[13px] text-slate-400 font-medium">{label}</span>
                          <span className="text-[13px] font-semibold text-slate-700 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-slate-400 py-4">No technologies detected yet.</p>
                  )}
                </div>

                {/* Scale & Presence (expanded) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-[15px] font-bold text-slate-800 mb-4">Scale &amp; Presence</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <MetricCard icon={<TrendingUp size={16} className="text-slate-400" />} label="Employees" value="\u2014" sub="Coming soon" muted />
                    <MetricCard icon={<Globe size={16} className="text-slate-400" />} label="App Presence" value="\u2014" sub="Coming soon" muted />
                    <MetricCard icon={<Shield size={16} className="text-slate-400" />} label="Security Score" value="\u2014" sub="Coming soon" muted />
                  </div>
                </div>
              </div>

              {/* ── Right Sidebar ────────────────────────────────── */}
              <div className="space-y-6">

                {/* Quick Info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-[14px] font-bold text-slate-800 mb-4">Quick Info</h3>
                  <div className="space-y-3">
                    <InfoRow label="Domain" value={account.normalizedDomain} />
                    <InfoRow label="Category" value={account.category !== 'Unknown' ? account.category : '\u2014'} />
                    <InfoRow label="Sub-category" value={account.subCategory !== 'General' ? account.subCategory : '\u2014'} />
                    <InfoRow label="Region" value={account.region} />
                    <InfoRow label="Channel" value={channelType(account.offlineStores)} />
                    {!techLoading && <InfoRow label="Platform" value={platform} />}
                    <InfoRow label="Store Count" value={account.offlineStores === 'Unknown' ? '\u2014' : account.offlineStores} />
                  </div>
                </div>

                {/* Data Confidence */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-bold text-slate-800">Data Confidence</h3>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${confidence.bg} ${confidence.color}`}>
                      {confidence.label} ({account.found ? (score > 70 ? 94 : score > 50 ? 72 : 45) : 30}%)
                    </span>
                  </div>
                  {account.updatedAt && (
                    <p className="text-[11px] text-slate-400">Last verified: {formatDate(account.updatedAt)}</p>
                  )}
                  <button className="text-[12px] text-[#C94C1E] hover:text-[#b5431a] font-medium mt-2 transition-colors">
                    Report incorrect data &rarr;
                  </button>
                </div>

                {/* Funding */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-[14px] font-bold text-slate-800 mb-4">Funding History</h3>
                  <div className="text-center py-4">
                    <p className="text-[24px] font-bold text-slate-300">&mdash;</p>
                    <p className="text-[12px] text-slate-400 mt-1">Total Raised</p>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[12px] text-slate-400 italic text-center">Coming soon</p>
                  </div>
                </div>

                {/* Similar Accounts */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-[14px] font-bold text-slate-800 mb-4">Similar Accounts</h3>
                  {account.similar.length > 0 ? (
                    <div className="space-y-1">
                      {account.similar.map(s => (
                        <button
                          key={s.normalizedDomain}
                          onClick={() => router.push(`/account/${s.normalizedDomain}`)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[12px] font-bold text-slate-500 flex-shrink-0">
                            {s.name[0]}
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-[13px] font-semibold text-slate-700 truncate group-hover:text-slate-900 transition-colors">{s.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{s.category}{s.subCategory && s.subCategory !== s.category ? ` · ${s.subCategory}` : ''}</p>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400 italic text-center py-3">No similar accounts found</p>
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-[18px] font-bold leading-tight ${muted ? 'text-slate-300' : 'text-slate-800'}`}>{value}</p>
      {sub && (
        <p className={`text-[11px] mt-1 ${muted ? 'text-slate-400' : 'text-emerald-600'}`}>{sub}</p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-[12px] text-slate-400 font-medium">{label}</span>
      <span className="text-[12px] font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function SidebarBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all ${
        active ? 'bg-orange-50 text-[#C94C1E] font-semibold' : 'text-slate-500 hover:bg-slate-50'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function SidebarBtnLocked({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-slate-400 cursor-not-allowed">
      <div className="flex items-center gap-3 font-medium text-[14px]">
        <span className="text-slate-300">{icon}</span> {label}
      </div>
      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">Soon</span>
    </div>
  );
}
