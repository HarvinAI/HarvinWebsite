'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import {
  Search, ChevronDown, ChevronUp, X,
  ChevronLeft, ChevronRight, LayoutGrid, List,
  Filter, Check, Satellite,
  Briefcase, Settings2, Link2, LogOut, ArrowUpDown, Loader2,
  Target, Swords, Lock,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
type User = { type: string; name: string; email: string };
type OnboardingAnswers = {
  geoFocus?: string[]; categories?: string[];
  brandTypes?: string[]; channelMix?: string[];
  companySize?: string[]; revenueRange?: string[];
  jobRole?: string; companyName?: string; persona?: string;
  techCategories?: string[];
};
type Account = {
  normalizedDomain: string;
  category: string;
  subCategory: string;
  region: string;
  offlineStores: string;
  aiStoreCount: number;
  updatedAt: string;
};
type Filters = { category: string[]; region: string[]; offlineStores: string[] };
type SortKey = 'domain' | 'category' | 'region' | 'offlineStores' | 'updatedAt';
type FilterOptions = { categories: string[]; regions: string[]; offlineStores: string[] };
type SidebarTab = 'market-intelligence' | 'account-explorer' | 'recently-funded' | 'competitor-clients' | 'current-clients' | 'icp-preferences' | 'integrations';

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20;
const CAT_SHOW = 5;

const TAB_TITLES: Record<SidebarTab, string> = {
  'market-intelligence': 'Market Intelligence',
  'account-explorer': 'Account Explorer',
  'recently-funded': 'Recently Funded',
  'competitor-clients': 'Competitor Clients',
  'current-clients': 'Current Clients',
  'icp-preferences': 'ICP & Preferences',
  'integrations': 'Integrations',
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
const emptyFilters = (): Filters => ({ category: [], region: [], offlineStores: [] });

function domainToName(domain: string): string {
  const base = domain.replace(/^www\./, '').split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function syncFromOnboarding(a: OnboardingAnswers): Filters {
  const f = emptyFilters();
  if (a.categories?.length) {
    f.category = [...a.categories];
  }
  if (a.geoFocus?.length) {
    f.region = [...a.geoFocus];
  }
  if (a.channelMix?.length) {
    if (a.channelMix.includes('offline_retail')) {
      f.offlineStores = ['1-10', '11-20', '21-50', '51-100', '100+'];
    }
  }
  return f;
}

const countFilters = (f: Filters) => Object.values(f).reduce((s, a) => s + a.length, 0);

/* ── UI Components ─────────────────────────────────────────────────────── */
const FilterItem = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all text-left w-full group ${on ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${on ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 group-hover:border-slate-400'}`}>
      {on && <Check size={10} className="text-white stroke-[3]" />}
    </div>
    <span className={`text-[13px] transition-colors ${on ? 'text-[#C94C1E] font-medium' : 'text-slate-600 group-hover:text-slate-900'}`}>{label}</span>
  </button>
);

const FilterSection = ({ title, count, children, defaultOpen = true }: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{title}</span>
          {count !== undefined && count > 0 && <span className="text-[10px] bg-orange-100 text-[#C94C1E] px-1.5 rounded-full font-bold">{count}</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
      </button>
      {open && <div className="mt-1 flex flex-col gap-0.5">{children}</div>}
    </div>
  );
};

/* Category / Region badge colors */
const REGION_COLORS: Record<string, string> = {
  US: 'text-blue-700 bg-blue-50 border-blue-200',
  UK: 'text-violet-700 bg-violet-50 border-violet-200',
  India: 'text-orange-700 bg-orange-50 border-orange-200',
  EU: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

/* ═══════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setView] = useState<'table' | 'card'>('card');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [moreCats, setMoreCats] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('account-explorer');

  // Data from API
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ categories: [], regions: [], offlineStores: [] });
  const [loading, setLoading] = useState(false);
  const fetchRef = useRef(0);

  /* ── Auth + onboarding sync ────────────────────────────────────────── */
  useEffect(() => {
    if (status === 'loading') return;
    const u = localStorage.getItem('harvin_user');
    const o = localStorage.getItem('harvin_onboarding');
    if (u) { try { setUser(JSON.parse(u)); } catch { /* */ } }
    else if (session?.user) {
      const su: User = { type: 'google', name: session.user.name ?? '', email: session.user.email ?? '' };
      localStorage.setItem('harvin_user', JSON.stringify(su));
      setUser(su);
    } else { router.replace('/signin'); return; }

    if (o) {
      try {
        const parsed = JSON.parse(o);
        const ans: OnboardingAnswers = parsed.answers ?? {};
        const saved = localStorage.getItem('harvin_dashboard_filters');
        if (saved) { try { const parsed = JSON.parse(saved); setFilters({ ...emptyFilters(), ...parsed }); } catch { setFilters(syncFromOnboarding(ans)); } }
        else setFilters(syncFromOnboarding(ans));
      } catch { /* */ }
    }
    setReady(true);
  }, [router, session, status]);

  // Persist filters
  useEffect(() => { if (ready) localStorage.setItem('harvin_dashboard_filters', JSON.stringify(filters)); }, [filters, ready]);

  // Reset page on filter/search change
  useEffect(() => { setPage(1); }, [filters, debouncedSearch]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Fetch accounts from API ─────────────────────────────────────── */
  const fetchAccounts = useCallback(async () => {
    if (!ready) return;
    const id = ++fetchRef.current;
    setLoading(true);

    const params = new URLSearchParams();
    if (filters.category.length) params.set('categories', filters.category.join(','));
    if (filters.region.length) params.set('regions', filters.region.join(','));
    if (filters.offlineStores.length) params.set('offlineStores', filters.offlineStores.join(','));
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('sortBy', sortKey);
    params.set('sortDir', sortAsc ? 'asc' : 'desc');
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));

    try {
      const res = await fetch(`/api/accounts?${params.toString()}`);
      if (id !== fetchRef.current) return; // stale
      const data = await res.json();
      if (data.error) { console.error(data.error); return; }
      setAccounts(data.accounts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (data.filterOptions) setFilterOptions({
        categories: data.filterOptions.categories || [],
        regions: data.filterOptions.regions || [],
        offlineStores: data.filterOptions.offlineStores || [],
      });
    } catch (err) {
      console.error('Failed to fetch accounts', err);
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, [ready, filters, debouncedSearch, sortKey, sortAsc, page]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  /* ── Handlers ──────────────────────────────────────────────────────── */
  const toggle = (k: keyof Filters, v: string) => setFilters(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));
  const clearAll = () => setFilters(emptyFilters());
  const resyncOnboarding = () => {
    const o = localStorage.getItem('harvin_onboarding');
    if (o) { try { setFilters(syncFromOnboarding(JSON.parse(o).answers ?? {})); } catch { /* */ } }
  };
  const handleLogout = () => {
    ['harvin_user', 'harvin_onboarding', 'harvin_dashboard_filters'].forEach(k => localStorage.removeItem(k));
    signOut({ callbackUrl: '/' });
  };
  const doSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const activeCount = countFilters(filters);

  if (!ready) return null;
  const firstName = user?.name?.split(' ')[0] || 'there';

  const visCats = moreCats ? filterOptions.categories : filterOptions.categories.slice(0, CAT_SHOW);
  const hiddenCats = filterOptions.categories.length - CAT_SHOW;

  const isSettingsTab = activeTab === 'icp-preferences' || activeTab === 'integrations';
  const isComingSoonTab = activeTab === 'recently-funded' || activeTab === 'competitor-clients' || activeTab === 'current-clients';

  /* ── Table header sort button ───────────────────────────────────── */
  const SortHeader = ({ label, sortKeyVal, className = '' }: { label: string; sortKeyVal: SortKey; className?: string }) => (
    <button onClick={() => doSort(sortKeyVal)}
      className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors ${className}`}>
      {label}
      <ArrowUpDown size={11} className={sortKey === sortKeyVal ? 'text-[#C94C1E]' : 'opacity-30'} />
    </button>
  );

  /* ── RENDER ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] font-sans text-slate-900 overflow-hidden">

      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[260px] bg-white border-r border-slate-100 flex-shrink-0">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="HarvinAI" width={40} height={40} className="rounded-xl shadow-lg shadow-orange-500/10" />
            <span className="text-2xl font-bold tracking-tight text-slate-800">HarvinAI</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-8 custom-scrollbar">
          <div>
            <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Intelligence</h3>
            <div className="space-y-1">
              <button onClick={() => setActiveTab('market-intelligence')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-semibold transition-all ${activeTab === 'market-intelligence' ? 'bg-orange-50 text-[#C94C1E]' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Satellite size={18} /> Market Intelligence
              </button>
              <button onClick={() => setActiveTab('account-explorer')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all ${activeTab === 'account-explorer' ? 'bg-orange-50 text-[#C94C1E] font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Search size={18} /> Account Explorer
              </button>
            </div>
          </div>

          <div>
            <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Watchlists</h3>
            <div className="space-y-1">
              <button onClick={() => setActiveTab('recently-funded')}
                className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-slate-400 cursor-not-allowed">
                <div className="flex items-center gap-3 font-medium text-[14px]"><Target size={18} className="text-slate-300" /> Recently Funded</div>
                <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">Soon</span>
              </button>
              <button onClick={() => setActiveTab('competitor-clients')}
                className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-slate-400 cursor-not-allowed">
                <div className="flex items-center gap-3 font-medium text-[14px]"><Swords size={18} className="text-slate-300" /> Competitor Clients</div>
                <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">Soon</span>
              </button>
              <button onClick={() => setActiveTab('current-clients')}
                className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-slate-400 cursor-not-allowed">
                <div className="flex items-center gap-3 font-medium text-[14px]"><Briefcase size={18} className="text-slate-300" /> Current Clients</div>
                <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">Soon</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Settings</h3>
            <div className="space-y-1">
              <button onClick={() => setActiveTab('icp-preferences')}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-[14px] font-medium transition-all text-left ${activeTab === 'icp-preferences' ? 'bg-orange-50 text-[#C94C1E] font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Settings2 size={18} /> ICP & Preferences
              </button>
              <button onClick={() => setActiveTab('integrations')}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-[14px] font-medium transition-all text-left ${activeTab === 'integrations' ? 'bg-orange-50 text-[#C94C1E] font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Link2 size={18} /> Integrations
              </button>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C94C1E] to-[#e07040] flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
              {firstName[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-700 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="mt-0.5 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 w-full transition-colors">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Area ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9] relative">

        {/* Header */}
        <header className="h-[64px] border-b border-slate-100 bg-white px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-[#C94C1E]" />
            <h1 className="text-[18px] font-bold text-slate-800">{TAB_TITLES[activeTab]}</h1>
            {!isSettingsTab && !isComingSoonTab && <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{total} results</span>}
          </div>
          {!isSettingsTab && !isComingSoonTab && (
            <div className="flex items-center gap-4">
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-slate-400" size={16} />
                <input type="text" placeholder="Search brands or categories..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 border-transparent border focus:border-orange-200 focus:bg-white focus:ring-4 focus:ring-orange-100 rounded-xl text-[13px] w-[300px] transition-all outline-none" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
              </div>
              <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                <button onClick={() => setView('table')} className={`p-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-white shadow-sm text-[#C94C1E]' : 'text-slate-400'}`}><List size={16} /></button>
                <button onClick={() => setView('card')} className={`p-1.5 rounded-md transition-colors ${view === 'card' ? 'bg-white shadow-sm text-[#C94C1E]' : 'text-slate-400'}`}><LayoutGrid size={16} /></button>
              </div>
              <button onClick={() => setIsFilterVisible(!isFilterVisible)}
                className={`p-2 px-4 rounded-xl border transition-all flex items-center gap-2 ${isFilterVisible ? 'bg-orange-50 border-orange-200 text-[#C94C1E]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <Filter size={18} />
                <span className="text-[13px] font-bold">Filters</span>
                {activeCount > 0 && <span className="w-5 h-5 rounded-full bg-[#C94C1E] text-white text-[10px] font-bold flex items-center justify-center">{activeCount}</span>}
              </button>
            </div>
          )}
        </header>

        {/* Active filter chips */}
        {!isSettingsTab && !isComingSoonTab && activeCount > 0 && (
          <div className="bg-white border-b border-slate-100 px-8 py-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 font-medium mr-0.5">Filtered by</span>
            {(Object.keys(filters) as (keyof Filters)[]).flatMap(k =>
              filters[k].map(v => (
                <button key={`${k}-${v}`} onClick={() => toggle(k, v)}
                  className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md bg-slate-100 text-[10.5px] font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">
                  {v} <X size={9} strokeWidth={3} className="opacity-60" />
                </button>
              ))
            )}
            <button onClick={clearAll} className="text-[10.5px] text-[#C94C1E] font-semibold ml-1">Clear all</button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto custom-scrollbar p-8">
          {isSettingsTab ? (
            /* ── Settings Pages ────────────────────────────────────── */
            <div className="max-w-3xl mx-auto">
              {activeTab === 'icp-preferences' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-[16px] font-bold text-slate-800 mb-1">Ideal Customer Profile</h2>
                    <p className="text-[13px] text-slate-400 mb-6">Your ICP is synced from onboarding. Adjust filters on any intelligence page to refine.</p>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Categories', values: filters.category },
                        { label: 'Regions', values: filters.region },
                        { label: 'Offline Stores', values: filters.offlineStores },
                      ].map(item => (
                        <div key={item.label} className="bg-slate-50 rounded-lg p-4">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{item.label}</p>
                          {item.values.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {item.values.map(v => <span key={v} className="text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600 font-medium">{v}</span>)}
                            </div>
                          ) : (
                            <p className="text-[12px] text-slate-300 italic">No preference set</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex gap-3">
                      <button onClick={resyncOnboarding} className="bg-[#C94C1E] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20">
                        Re-sync from Onboarding
                      </button>
                      <button onClick={clearAll} className="border border-slate-200 px-5 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                        Clear All Preferences
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-[16px] font-bold text-slate-800 mb-1">Integrations</h2>
                    <p className="text-[13px] text-slate-400 mb-6">Connect your tools to enrich account data and automate workflows.</p>
                    <div className="space-y-3">
                      {[
                        { name: 'Salesforce', desc: 'Sync accounts & contacts', connected: false },
                        { name: 'HubSpot', desc: 'CRM integration', connected: false },
                        { name: 'Slack', desc: 'Signal alerts & notifications', connected: false },
                        { name: 'Google Sheets', desc: 'Export watchlists', connected: false },
                      ].map(int => (
                        <div key={int.name} className="flex items-center justify-between p-4 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                          <div>
                            <p className="text-[14px] font-semibold text-slate-700">{int.name}</p>
                            <p className="text-[12px] text-slate-400">{int.desc}</p>
                          </div>
                          <button className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
                            Connect
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : isComingSoonTab ? (
            /* ── Coming Soon Watchlists ───────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                <Lock size={24} className="text-slate-300" />
              </div>
              <p className="text-[15px] font-semibold text-slate-600 mb-1">Coming Soon</p>
              <p className="text-[12px] text-slate-400 max-w-sm">This watchlist feature is under development. Switch to Account Explorer to browse real accounts.</p>
            </div>
          ) : loading ? (
            /* ── Loading ──────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Loader2 size={32} className="text-[#C94C1E] animate-spin mb-4" />
              <p className="text-[13px] text-slate-400 font-medium">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            /* ── Empty state ──────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-4"><Search size={24} className="text-slate-300" /></div>
              <p className="text-[15px] font-semibold text-slate-600 mb-1">No brands match</p>
              <p className="text-[12px] text-slate-400 mb-4">Try adjusting your filters or search</p>
              <div className="flex gap-2">
                <button onClick={clearAll} className="h-8 px-4 rounded-lg text-[12px] font-semibold text-white bg-[#C94C1E] hover:bg-orange-700 transition-colors">Clear filters</button>
                <button onClick={resyncOnboarding} className="h-8 px-4 rounded-lg text-[12px] font-semibold text-[#C94C1E] border border-orange-200 hover:bg-orange-50 transition-colors">Reset to preferences</button>
              </div>
            </div>
          ) : view === 'card' ? (
            /* ── Card View ─────────────────────────────────────────── */
            <div className="max-w-6xl mx-auto space-y-4">
              {accounts.map(a => (
                <div key={a.normalizedDomain}
                  onClick={() => router.push(`/scan/${a.normalizedDomain}`)}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-serif text-slate-400 text-xl shadow-inner">
                          {domainToName(a.normalizedDomain)[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[17px] font-bold text-slate-800 leading-tight group-hover:text-[#C94C1E] transition-colors">{domainToName(a.normalizedDomain)}</h3>
                            <span className="text-[11px] text-slate-400 font-medium">{a.normalizedDomain}</span>
                          </div>
                          <p className="text-[12px] text-slate-400 font-medium mt-0.5">
                            {a.subCategory || a.category} &bull; {a.region}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.category && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold text-orange-700 bg-orange-50 border-orange-200">
                            {a.category}
                          </span>
                        )}
                        {a.region && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${REGION_COLORS[a.region] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                            {a.region}
                          </span>
                        )}
                        {a.offlineStores && a.offlineStores !== 'Online' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold text-emerald-700 bg-emerald-50 border-emerald-200">
                            {a.offlineStores} stores
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium border-t border-slate-100 pt-3">
                      <span>{a.offlineStores || 'Online'}</span>
                      <span className="text-slate-200">&bull;</span>
                      <span>{a.aiStoreCount ?? 0} AI stores</span>
                      <span className="text-slate-200">&bull;</span>
                      <span>Updated {formatDate(a.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Table / List View ─────────────────────────────────── */
            <div className="max-w-6xl mx-auto">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3"><SortHeader label="Brand" sortKeyVal="domain" /></th>
                      <th className="text-left px-4 py-3"><SortHeader label="Category" sortKeyVal="category" /></th>
                      <th className="text-left px-4 py-3"><span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sub-Category</span></th>
                      <th className="text-left px-4 py-3"><SortHeader label="Region" sortKeyVal="region" /></th>
                      <th className="text-left px-4 py-3"><SortHeader label="Stores" sortKeyVal="offlineStores" /></th>
                      <th className="text-right px-5 py-3"><SortHeader label="Updated" sortKeyVal="updatedAt" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.normalizedDomain}
                        onClick={() => router.push(`/scan/${a.normalizedDomain}`)}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-serif text-slate-400 text-[15px] flex-shrink-0">
                              {domainToName(a.normalizedDomain)[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-slate-800 truncate group-hover:text-[#C94C1E] transition-colors">{domainToName(a.normalizedDomain)}</p>
                              <p className="text-[11px] text-slate-400 truncate">{a.normalizedDomain}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-slate-600">{a.category}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-slate-500">{a.subCategory || '—'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${REGION_COLORS[a.region] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>{a.region}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-slate-600">{a.offlineStores || 'Online'}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-[11px] text-slate-400">{formatDate(a.updatedAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isSettingsTab && !isComingSoonTab && (
          <footer className="h-[64px] border-t border-slate-100 bg-white px-8 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4 text-[12px] text-slate-400 font-medium">
              <span>Showing <span className="text-slate-800 font-bold">{total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1}&ndash;{Math.min(page * PAGE_SIZE, total)}</span> of <span className="text-slate-800 font-bold">{total}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border hover:bg-slate-50 text-slate-400 transition-all disabled:opacity-25"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) {
                  p = i + 1;
                } else if (page <= 4) {
                  p = i + 1;
                } else if (page >= totalPages - 3) {
                  p = totalPages - 6 + i;
                } else {
                  p = page - 3 + i;
                }
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors ${p === page ? 'bg-[#C94C1E] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border hover:bg-slate-50 text-slate-400 transition-all disabled:opacity-25"><ChevronRight size={16} /></button>
            </div>
          </footer>
        )}
      </main>

      {/* ── Filter Sidebar (Right, White, Collapsible) ────────────────── */}
      {!isSettingsTab && !isComingSoonTab && (
        <aside className={`flex-shrink-0 border-l border-slate-100 bg-white flex flex-col transition-all duration-300 ease-in-out ${isFilterVisible ? 'w-[300px]' : 'w-0 overflow-hidden'}`}>
          <div className="h-[64px] px-6 flex items-center justify-between border-b border-slate-50 bg-white sticky top-0 z-10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <h2 className="font-bold text-slate-800 text-[14px]">Filters</h2>
              {activeCount > 0 && <span className="text-[10px] bg-orange-100 text-[#C94C1E] px-1.5 rounded-full font-bold">{activeCount}</span>}
            </div>
            <button onClick={() => setIsFilterVisible(false)} className="p-1 hover:bg-slate-50 rounded-lg text-slate-400"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <FilterSection title="Category" count={filters.category.length}>
              {visCats.map(v => <FilterItem key={v} label={v} on={filters.category.includes(v)} onClick={() => toggle('category', v)} />)}
              {hiddenCats > 0 && (
                <button onClick={() => setMoreCats(!moreCats)} className="px-3 mt-1 text-[11px] text-[#C94C1E] font-medium hover:underline">
                  {moreCats ? 'Show less' : `+ ${hiddenCats} more`}
                </button>
              )}
            </FilterSection>

            <FilterSection title="Region" count={filters.region.length}>
              {filterOptions.regions.map(v => <FilterItem key={v} label={v} on={filters.region.includes(v)} onClick={() => toggle('region', v)} />)}
            </FilterSection>

            <FilterSection title="Offline Stores" count={filters.offlineStores.length}>
              {filterOptions.offlineStores.map(v => <FilterItem key={v} label={v} on={filters.offlineStores.includes(v)} onClick={() => toggle('offlineStores', v)} />)}
            </FilterSection>
          </div>

          <div className="p-4 border-t border-slate-100 space-y-2 flex-shrink-0">
            <button onClick={resyncOnboarding} className="w-full flex items-center justify-center gap-2 bg-[#C94C1E] hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold shadow-lg shadow-orange-500/20 transition-all">
              Re-sync from Onboarding
            </button>
            <button onClick={clearAll} className="w-full text-center text-[12px] text-slate-400 hover:text-slate-600 font-medium py-1.5 transition-colors">
              Clear All Filters
            </button>
          </div>
        </aside>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #F1F1F1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #E2E2E2; }
      `}</style>
    </div>
  );
}
