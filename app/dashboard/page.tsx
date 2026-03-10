'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import {
  Search, ChevronDown, ChevronUp, X,
  ChevronLeft, ChevronRight,
  Filter, Check, Satellite,
  Briefcase, Settings2, Link2, LogOut, Loader2,
  Target, Swords, Lock, Plus, Star, Trash2, Pencil,
  Store, MapPin, Cpu, ExternalLink, CheckSquare, Square,
  DollarSign, Smartphone, Users, TrendingUp, Layers,
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
  techCount: number;
  updatedAt: string;
};
type Filters = { category: string[]; region: string[]; businessModel: string[]; scale: string[]; offlinePresence: string[]; appPresence: string[]; techStack: string[]; activeSignals: string[]; funding: string[] };
type SortKey = 'domain' | 'category' | 'region' | 'offlineStores' | 'updatedAt';
type FilterOptions = { categories: string[]; regions: string[]; offlineStores: string[] };
type Watchlist = { _id: string; name: string; domains: string[]; createdAt: string; updatedAt: string };
type WatchlistAccount = Account & { normalizedDomain: string };
type SidebarTab = 'market-intelligence' | 'account-explorer' | 'my-watchlists' | 'recently-funded' | 'competitor-clients' | 'current-clients' | 'icp-preferences' | 'integrations';

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20;
const CAT_SHOW = 5;

const TAB_TITLES: Record<SidebarTab, string> = {
  'market-intelligence': 'Market Intelligence',
  'account-explorer': 'Account Explorer',
  'my-watchlists': 'My Watchlists',
  'recently-funded': 'Recently Funded',
  'competitor-clients': 'Competitor Clients',
  'current-clients': 'Current Clients',
  'icp-preferences': 'ICP & Preferences',
  'integrations': 'Integrations',
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
const emptyFilters = (): Filters => ({ category: [], region: [], businessModel: [], scale: [], offlinePresence: [], appPresence: [], techStack: [], activeSignals: [], funding: [] });

function domainToName(domain: string): string {
  const base = domain.replace(/^www\./, '').split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function storeLabel(val: string): string {
  if (!val || val === 'Unknown') return 'Online Only';
  if (val === 'Online') return 'Online Only';
  return `${val} Stores`;
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

/* Onboarding label → DB value mappings (mirrors API CATEGORY_MAP / REGION_MAP) */
const ONBOARD_CAT_MAP: Record<string, string> = {
  'Beauty & Skincare': 'Beauty & Personal Care',
  'Electronics & Gadgets': 'Electronics & Tech',
  'Jewelry & Accessories': 'Jewelry',
  'Fitness & Sports': 'Outdoor & Sports',
};
const ONBOARD_REGION_MAP: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'UK',
};

function syncFromOnboarding(a: OnboardingAnswers, allCategories: string[]): Filters {
  const f = emptyFilters();
  if (a.categories?.length) {
    if (a.categories.includes('All Categories')) {
      f.category = [...allCategories];
    } else {
      f.category = a.categories.map(c => ONBOARD_CAT_MAP[c] || c);
    }
  }
  if (a.geoFocus?.length) {
    if (a.geoFocus.includes('Global')) {
      // Global means no region filter needed
    } else {
      f.region = a.geoFocus.map(r => ONBOARD_REGION_MAP[r] || r);
    }
  }
  if (a.channelMix?.length) {
    if (a.channelMix.includes('offline_retail')) {
      f.offlinePresence = ['1-10 stores', '10-50 stores', '50+ stores'];
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
          <span className="text-[12px] font-extrabold text-slate-600 uppercase tracking-widest">{title}</span>
          {count !== undefined && count > 0 && <span className="text-[10px] bg-orange-100 text-[#C94C1E] px-1.5 rounded-full font-bold">{count}</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
      </button>
      {open && <div className="mt-1 flex flex-col gap-0.5">{children}</div>}
    </div>
  );
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
const [sortKey] = useState<SortKey>('updatedAt');
  const [sortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [moreCats, setMoreCats] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('account-explorer');
  // filtersOpen removed — filters always visible, nav always collapsed

  // Data from API
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ categories: [], regions: [], offlineStores: [] });
  const [loading, setLoading] = useState(false);
  const fetchRef = useRef(0);

  // Watchlist state
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlist, setActiveWatchlist] = useState<Watchlist | null>(null);
  const [watchlistAccounts, setWatchlistAccounts] = useState<WatchlistAccount[]>([]);
  const [wlLoading, setWlLoading] = useState(false);
  const [showCreateWl, setShowCreateWl] = useState(false);
  const [newWlName, setNewWlName] = useState('');
  const [renamingWl, setRenamingWl] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingOnboardingSync, setPendingOnboardingSync] = useState(false);

  // Multi-select state
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [showBulkWlDropdown, setShowBulkWlDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [bulkNewWlName, setBulkNewWlName] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);
  const bulkDropdownRef = useRef<HTMLDivElement>(null);

  /* ── Auth + admin gate + onboarding sync ──────────────────────────── */
  useEffect(() => {
    if (status === 'loading') return;

    // Admin gate: redirect non-admins to thank-you page
    if (session && (session as unknown as Record<string, unknown>).isAdmin === false) {
      router.replace('/thankyou');
      return;
    }

    const u = localStorage.getItem('harvin_user');
    const o = localStorage.getItem('harvin_onboarding');
    if (u) { try { setUser(JSON.parse(u)); } catch { /* */ } }
    else if (session?.user) {
      const su: User = { type: 'google', name: session.user.name ?? '', email: session.user.email ?? '' };
      localStorage.setItem('harvin_user', JSON.stringify(su));
      setUser(su);
    } else { router.replace('/signin'); return; }

    // Restore saved filters, or flag for onboarding sync once filterOptions load
    const saved = localStorage.getItem('harvin_dashboard_filters');
    if (saved) {
      try { const parsed = JSON.parse(saved); setFilters({ ...emptyFilters(), ...parsed }); } catch { /* */ }
    } else if (o) {
      // No saved filters but onboarding exists — need to sync once we have filterOptions
      setPendingOnboardingSync(true);
    }
    setReady(true);
  }, [router, session, status]);

  // Auto-apply onboarding choices once filterOptions are loaded (first visit from onboarding)
  useEffect(() => {
    if (!pendingOnboardingSync || filterOptions.categories.length === 0) return;
    const o = localStorage.getItem('harvin_onboarding');
    if (o) {
      try {
        const ans: OnboardingAnswers = JSON.parse(o).answers ?? {};
        setFilters(syncFromOnboarding(ans, filterOptions.categories));
      } catch { /* */ }
    }
    setPendingOnboardingSync(false);
  }, [pendingOnboardingSync, filterOptions.categories]);

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
    if (filters.offlinePresence.length) params.set('offlinePresence', filters.offlinePresence.join(','));
    if (filters.businessModel.length) params.set('businessModel', filters.businessModel.join(','));
    if (filters.scale.length) params.set('scale', filters.scale.join(','));
    if (filters.appPresence.length) params.set('appPresence', filters.appPresence.join(','));
    if (filters.techStack.length) params.set('techStack', filters.techStack.join(','));
    if (filters.activeSignals.length) params.set('activeSignals', filters.activeSignals.join(','));
    if (filters.funding.length) params.set('funding', filters.funding.join(','));
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

  /* ── Watchlist CRUD ──────────────────────────────────────────────── */
  const fetchWatchlists = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlists');
      if (!res.ok) return;
      const data = await res.json();
      setWatchlists(data.watchlists || []);
    } catch {}
  }, []);

  const fetchWatchlistDetail = useCallback(async (id: string) => {
    setWlLoading(true);
    try {
      const res = await fetch(`/api/watchlists?id=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveWatchlist(data);
      setWatchlistAccounts(data.accounts || []);
    } catch {}
    setWlLoading(false);
  }, []);

  // Load watchlists when tab is opened
  useEffect(() => {
    if (activeTab === 'my-watchlists' && ready) fetchWatchlists();
  }, [activeTab, ready, fetchWatchlists]);

  const createWatchlist = async () => {
    if (!newWlName.trim()) return;
    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWlName.trim() }),
      });
      if (res.ok) {
        setNewWlName('');
        setShowCreateWl(false);
        fetchWatchlists();
      }
    } catch {}
  };

  const deleteWatchlist = async (id: string) => {
    try {
      await fetch(`/api/watchlists?id=${id}`, { method: 'DELETE' });
      if (activeWatchlist?._id === id) { setActiveWatchlist(null); setWatchlistAccounts([]); }
      fetchWatchlists();
    } catch {}
  };

  const renameWatchlist = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await fetch('/api/watchlists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: renameValue.trim() }),
      });
      setRenamingWl(null);
      setRenameValue('');
      fetchWatchlists();
      if (activeWatchlist?._id === id) fetchWatchlistDetail(id);
    } catch {}
  };

  const removeFromWatchlist = async (wlId: string, domain: string) => {
    try {
      await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wlId, domain, remove: true }),
      });
      fetchWatchlistDetail(wlId);
      fetchWatchlists();
    } catch {}
  };

  /* ── Handlers ──────────────────────────────────────────────────────── */
  const toggle = (k: keyof Filters, v: string) => setFilters(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));
  const clearAll = () => setFilters(emptyFilters());
  const resyncOnboarding = () => {
    const o = localStorage.getItem('harvin_onboarding');
    if (o) { try { setFilters(syncFromOnboarding(JSON.parse(o).answers ?? {}, filterOptions.categories)); } catch { /* */ } }
  };
  const handleLogout = () => {
    ['harvin_user', 'harvin_onboarding', 'harvin_dashboard_filters'].forEach(k => localStorage.removeItem(k));
    signOut({ callbackUrl: '/' });
  };

  // Multi-select handlers
  const toggleSelect = (domain: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain); else next.add(domain);
      return next;
    });
  };
  const selectAll = () => {
    if (selectedAccounts.size === accounts.length) setSelectedAccounts(new Set());
    else setSelectedAccounts(new Set(accounts.map(a => a.normalizedDomain)));
  };
  const clearSelection = () => setSelectedAccounts(new Set());

  const addSelectedToWatchlist = async (wlId: string) => {
    setBulkAdding(true);
    try {
      await Promise.all(
        Array.from(selectedAccounts).map(domain =>
          fetch('/api/watchlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: wlId, domain }),
          })
        )
      );
      setShowBulkWlDropdown(false);
      clearSelection();
      fetchWatchlists();
    } catch {}
    setBulkAdding(false);
  };

  const createAndAddToWatchlist = async () => {
    if (!bulkNewWlName.trim()) return;
    setBulkAdding(true);
    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bulkNewWlName.trim() }),
      });
      if (res.ok) {
        const wl = await res.json();
        await addSelectedToWatchlist(wl._id);
        setBulkNewWlName('');
      }
    } catch {}
    setBulkAdding(false);
  };

  // Close bulk dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bulkDropdownRef.current && !bulkDropdownRef.current.contains(e.target as Node)) {
        setShowBulkWlDropdown(false);
      }
    };
    if (showBulkWlDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBulkWlDropdown]);

  // Close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.user-menu-area')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  // Clear selection when page/filters change
  useEffect(() => { clearSelection(); }, [page, filters, debouncedSearch]);

  // Load watchlists for bulk-add dropdown when in account-explorer
  useEffect(() => {
    if (activeTab === 'account-explorer' && ready) fetchWatchlists();
  }, [activeTab, ready, fetchWatchlists]);

  const activeCount = countFilters(filters);

  if (!ready) return null;
  const firstName = user?.name?.split(' ')[0] || 'there';

  const visCats = moreCats ? filterOptions.categories : filterOptions.categories.slice(0, CAT_SHOW);
  const hiddenCats = filterOptions.categories.length - CAT_SHOW;

  const isSettingsTab = activeTab === 'icp-preferences' || activeTab === 'integrations';
  const isComingSoonTab = activeTab === 'recently-funded' || activeTab === 'competitor-clients' || activeTab === 'current-clients';
  const isWatchlistTab = activeTab === 'my-watchlists';
  const isMarketIntelTab = activeTab === 'market-intelligence';


  /* ── RENDER ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] font-sans text-slate-900 overflow-hidden">

      {/* ── Nav Rail (always collapsed icon-only) ── */}
      <aside className="hidden md:flex flex-col bg-white border-r border-slate-100 flex-shrink-0 w-[64px]">
        <div className="flex items-center gap-3 flex-shrink-0 px-0 py-4 justify-center">
          <a href="/">
            <Image src="/logo.svg" alt="HarvinAI" width={32} height={32} className="rounded-xl shadow-lg shadow-orange-500/10 flex-shrink-0 hover:scale-105 transition-transform" />
          </a>
        </div>

        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div className="space-y-4 px-2">
            <div className="space-y-0.5">
              <NavBtn icon={<Satellite size={18} />} label="Market Intelligence" active={activeTab === 'market-intelligence'} onClick={() => setActiveTab('market-intelligence')} />
              <NavBtn icon={<Search size={18} />} label="Account Explorer" active={activeTab === 'account-explorer'} onClick={() => setActiveTab('account-explorer')} />
            </div>

            <div className="space-y-0.5">
              <NavBtn icon={<Star size={18} />} label="My Watchlists" active={activeTab === 'my-watchlists'} onClick={() => setActiveTab('my-watchlists')}
                badge={watchlists.length > 0 ? String(watchlists.length) : undefined} />
              <NavBtn icon={<Target size={18} />} label="Recently Funded" locked />
              <NavBtn icon={<Swords size={18} />} label="Competitor Clients" locked />
              <NavBtn icon={<Briefcase size={18} />} label="Current Clients" locked />
            </div>

            <div className="space-y-0.5">
              <NavBtn icon={<Settings2 size={18} />} label="ICP & Preferences" active={activeTab === 'icp-preferences'} onClick={() => setActiveTab('icp-preferences')} />
              <NavBtn icon={<Link2 size={18} />} label="Integrations" active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} />
            </div>
          </div>
        </div>

        {/* User */}
        <div className="user-menu-area border-t border-slate-100 flex-shrink-0 px-2 py-3 flex flex-col items-center relative">
          <button onClick={() => setShowUserMenu(p => !p)}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C94C1E] to-[#e07040] flex items-center justify-center text-white text-[11px] font-bold cursor-pointer hover:ring-2 hover:ring-orange-200 transition-all"
            title={user?.name || ''}>
            {firstName[0]?.toUpperCase() || 'U'}
          </button>
          {showUserMenu && (
            <div className="absolute bottom-full left-full mb-1 -ml-2 bg-white border border-slate-200 rounded-xl shadow-lg py-2 px-1 w-[180px] z-50">
              <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                <p className="text-[11px] font-semibold text-slate-700 truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                <LogOut size={13} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Filter Panel (slides in from left, next to nav rail) ──────── */}
      {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && (
        <aside className="hidden md:flex flex-col bg-white border-r border-slate-100 flex-shrink-0 w-[280px]">
          <div className="h-[56px] px-5 flex items-center border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-[#C94C1E]" />
              <h2 className="font-bold text-slate-800 text-[14px]">Filters</h2>
              {activeCount > 0 && <span className="text-[10px] bg-orange-100 text-[#C94C1E] px-1.5 py-0.5 rounded-full font-bold">{activeCount}</span>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <FilterSection title="Category" count={filters.category.length}>
              <FilterItem
                label="All Categories"
                on={filterOptions.categories.length > 0 && filters.category.length === filterOptions.categories.length}
                onClick={() => {
                  const allSelected = filters.category.length === filterOptions.categories.length;
                  setFilters(p => ({ ...p, category: allSelected ? [] : [...filterOptions.categories] }));
                }}
              />
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

            <FilterSection title="D2C Profile" count={filters.businessModel.length + filters.scale.length + filters.offlinePresence.length + filters.appPresence.length} defaultOpen={false}>
              <p className="px-3 text-[10px] font-medium text-slate-400/70 uppercase tracking-wide mt-1 mb-1">Business Model</p>
              {['Pure D2C', 'Omnichannel', 'D2C + Marketplace', 'D2C + B2B'].map(v => (
                <FilterItem key={v} label={v} on={filters.businessModel.includes(v)} onClick={() => toggle('businessModel', v)} />
              ))}

              <p className="px-3 text-[10px] font-medium text-slate-400/70 uppercase tracking-wide mt-3 mb-1">Scale (Est. Traffic)</p>
              {['Emerging (<100K)', 'Growing (100K-500K)', 'Scaling (500K-2M)', 'Established (2M+)'].map(v => (
                <FilterItem key={v} label={v} on={filters.scale.includes(v)} onClick={() => toggle('scale', v)} />
              ))}

              <p className="px-3 text-[10px] font-medium text-slate-400/70 uppercase tracking-wide mt-3 mb-1">Offline Presence</p>
              {['Online Only', '1-10 stores', '10-50 stores', '50+ stores'].map(v => (
                <FilterItem key={v} label={v} on={filters.offlinePresence.includes(v)} onClick={() => toggle('offlinePresence', v)} />
              ))}

              <p className="px-3 text-[10px] font-medium text-slate-400/70 uppercase tracking-wide mt-3 mb-1">App Presence</p>
              {['No App', 'iOS Only', 'Android Only', 'Both iOS & Android'].map(v => (
                <FilterItem key={v} label={v} on={filters.appPresence.includes(v)} onClick={() => toggle('appPresence', v)} />
              ))}
            </FilterSection>

            <FilterSection title="Tech Stack" count={filters.techStack.length} defaultOpen={false}>
              <p className="px-3 text-[10px] font-medium text-slate-400/70 uppercase tracking-wide mt-1 mb-1">Ecommerce Platform</p>
              {['Shopify', 'WooCommerce', 'Magento', 'Custom-built'].map(v => (
                <FilterItem key={v} label={v} on={filters.techStack.includes(v)} onClick={() => toggle('techStack', v)} />
              ))}

              <div className="flex items-center gap-2 px-3 mt-3 mb-1">
                <p className="text-[10px] font-medium text-slate-400/70 uppercase tracking-wide">Engagement / CRM</p>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Key</span>
              </div>
              {['CleverTap', 'MoEngage', 'WebEngage', 'Braze', 'Klaviyo', 'Mailchimp', 'None detected'].map(v => (
                <FilterItem key={v} label={v} on={filters.techStack.includes(v)} onClick={() => toggle('techStack', v)} />
              ))}

              <p className="px-3 text-[10px] font-medium text-slate-400/70 uppercase tracking-wide mt-3 mb-1">Payments</p>
              {['Razorpay', 'Stripe', 'PayU', 'Cashfree'].map(v => (
                <FilterItem key={v} label={v} on={filters.techStack.includes(v)} onClick={() => toggle('techStack', v)} />
              ))}
            </FilterSection>

            <FilterSection title="Active Signals" count={filters.activeSignals.length} defaultOpen={false}>
              {['Recently Funded', 'Store Expansion', 'App Launched', 'Key Hiring', 'Marketplace Expansion', 'High Growth'].map(v => (
                <FilterItem key={v} label={v} on={filters.activeSignals.includes(v)} onClick={() => toggle('activeSignals', v)} />
              ))}
            </FilterSection>

            <FilterSection title="Funding" count={filters.funding.length} defaultOpen={false}>
              {['Bootstrapped', 'Seed / Angel', 'Series A+', 'Late Stage'].map(v => (
                <FilterItem key={v} label={v} on={filters.funding.includes(v)} onClick={() => toggle('funding', v)} />
              ))}
            </FilterSection>
          </div>

          <div className="p-4 border-t border-slate-100 space-y-2 flex-shrink-0">
            <button onClick={resyncOnboarding} className="w-full flex items-center justify-center gap-2 bg-[#C94C1E] hover:bg-[#b5431a] text-white px-4 py-2.5 rounded-xl text-[12px] font-bold shadow-sm transition-all">
              Re-sync from Onboarding
            </button>
            {activeCount > 0 && (
              <button onClick={clearAll} className="w-full text-center text-[12px] text-slate-400 hover:text-slate-600 font-medium py-1 transition-colors">
                Clear All Filters
              </button>
            )}
          </div>
        </aside>
      )}

      {/* ── Main Area ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9] relative">

        {/* Header */}
        <header className="h-[64px] border-b border-slate-100 bg-white px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-[#C94C1E]" />
            <h1 className="text-[18px] font-bold text-slate-800">{TAB_TITLES[activeTab]}</h1>
            {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{total} results</span>}
            {isWatchlistTab && activeWatchlist && <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{activeWatchlist.domains?.length || 0} accounts</span>}
          </div>
          {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && (
            <div className="flex items-center gap-3">
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-slate-400" size={16} />
                <input type="text" placeholder="Search brands or categories..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 border-transparent border focus:border-orange-200 focus:bg-white focus:ring-4 focus:ring-orange-100 rounded-xl text-[13px] w-[300px] transition-all outline-none" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
              </div>
            </div>
          )}
        </header>

        {/* Active filter chips */}
        {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && activeCount > 0 && (
          <div className="bg-white border-b border-slate-100 px-8 py-2.5 flex items-center gap-3 overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Filter size={12} className="text-slate-400" />
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Active</span>
            </div>
            <div className="h-4 w-px bg-slate-200 flex-shrink-0" />
            {(Object.keys(filters) as (keyof Filters)[]).map(k => {
              if (filters[k].length === 0) return null;
              const label: Record<string, string> = { category: 'Category', region: 'Region', businessModel: 'Business Model', scale: 'Scale', offlinePresence: 'Offline', appPresence: 'App', techStack: 'Tech', activeSignals: 'Signals', funding: 'Funding' };
              return (
                <div key={k} className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label[k] || k}:</span>
                  {filters[k].map(v => (
                    <button key={`${k}-${v}`} onClick={() => toggle(k, v)}
                      className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all group">
                      {v}
                      <X size={10} strokeWidth={2.5} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                    </button>
                  ))}
                </div>
              );
            })}
            <div className="h-4 w-px bg-slate-200 flex-shrink-0" />
            <button onClick={clearAll} className="flex-shrink-0 text-[11px] text-[#C94C1E] font-bold hover:text-[#b5431a] transition-colors">
              Clear all
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto custom-scrollbar p-8">
          {isMarketIntelTab ? (
            /* ── Market Intelligence ─────────────────────────────── */
            <MarketIntelligenceView />
          ) : isWatchlistTab ? (
            /* ── Watchlists View ───────────────────────────────────── */
            <div className="max-w-5xl mx-auto">
              {!activeWatchlist ? (
                /* Watchlist list */
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[14px] text-slate-500">{watchlists.length} watchlist{watchlists.length !== 1 ? 's' : ''}</p>
                    <button onClick={() => setShowCreateWl(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20">
                      <Plus size={16} /> New Watchlist
                    </button>
                  </div>

                  {/* Create modal */}
                  {showCreateWl && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                      <h3 className="text-[14px] font-bold text-slate-800 mb-3">Create Watchlist</h3>
                      <div className="flex gap-2">
                        <input
                          type="text" placeholder="e.g. Top D2C Brands, Competitor Tracking..."
                          value={newWlName} onChange={e => setNewWlName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && createWatchlist()}
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-100 rounded-xl text-[13px] outline-none transition-all"
                          autoFocus
                        />
                        <button onClick={createWatchlist}
                          className="px-5 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors">
                          Create
                        </button>
                        <button onClick={() => { setShowCreateWl(false); setNewWlName(''); }}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {watchlists.length === 0 && !showCreateWl ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                        <Star size={24} className="text-slate-300" />
                      </div>
                      <p className="text-[15px] font-semibold text-slate-600 mb-1">No watchlists yet</p>
                      <p className="text-[12px] text-slate-400 mb-5 max-w-sm">Create a watchlist to save and track brands you&apos;re interested in. Add accounts from the Account Explorer or individual account pages.</p>
                      <button onClick={() => setShowCreateWl(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20">
                        <Plus size={16} /> Create your first watchlist
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {watchlists.map(wl => (
                        <div key={wl._id}
                          className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
                          onClick={() => fetchWatchlistDetail(wl._id)}>
                          <div className="flex items-start justify-between mb-3">
                            {renamingWl === wl._id ? (
                              <input type="text" value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') renameWatchlist(wl._id); if (e.key === 'Escape') setRenamingWl(null); }}
                                onBlur={() => setRenamingWl(null)}
                                className="text-[16px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-orange-300 w-full"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <h3 className="text-[16px] font-bold text-slate-800 group-hover:text-[#C94C1E] transition-colors">{wl.name}</h3>
                            )}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setRenamingWl(wl._id); setRenameValue(wl.name); }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => { if (confirm('Delete this watchlist?')) deleteWatchlist(wl._id); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[12px] text-slate-400">
                            <span className="font-semibold text-slate-600">{wl.domains?.length || 0} accounts</span>
                            <span className="text-slate-200">&bull;</span>
                            <span>Updated {formatDate(wl.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Watchlist detail */
                <div>
                  <button onClick={() => { setActiveWatchlist(null); setWatchlistAccounts([]); }}
                    className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-400 hover:text-slate-600 mb-4 transition-colors">
                    <ChevronLeft size={16} /> Back to Watchlists
                  </button>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-[20px] font-bold text-slate-800">{activeWatchlist.name}</h2>
                      <p className="text-[12px] text-slate-400 mt-0.5">{activeWatchlist.domains?.length || 0} accounts &middot; Updated {formatDate(activeWatchlist.updatedAt)}</p>
                    </div>
                  </div>

                  {wlLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 size={28} className="text-[#C94C1E] animate-spin" />
                    </div>
                  ) : watchlistAccounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3"><Star size={20} className="text-slate-300" /></div>
                      <p className="text-[14px] font-semibold text-slate-600 mb-1">This watchlist is empty</p>
                      <p className="text-[12px] text-slate-400 mb-4">Add accounts from the Account Explorer or individual account pages.</p>
                      <button onClick={() => setActiveTab('account-explorer')}
                        className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#C94C1E] border border-orange-200 hover:bg-orange-50 transition-colors">
                        Browse accounts
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {watchlistAccounts.map(a => (
                        <div key={a.normalizedDomain}
                          className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all group">
                          <div className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-serif text-slate-400 text-lg flex-shrink-0 cursor-pointer"
                              onClick={() => router.push(`/account/${a.normalizedDomain}`)}>
                              {domainToName(a.normalizedDomain)[0]}
                            </div>
                            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/account/${a.normalizedDomain}`)}>
                              <div className="flex items-center gap-2">
                                <h3 className="text-[15px] font-bold text-slate-800 group-hover:text-[#C94C1E] transition-colors">{domainToName(a.normalizedDomain)}</h3>
                                <span className="text-[11px] text-slate-400">{a.normalizedDomain}</span>
                              </div>
                              <p className="text-[12px] text-slate-400 mt-0.5">
                                {a.category}{a.subCategory && a.subCategory !== a.category ? ` · ${a.subCategory}` : ''}{a.region ? ` · ${a.region}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {a.category && a.category !== 'Unknown' && (
                                <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">{a.category}</span>
                              )}
                              {a.offlineStores && a.offlineStores !== 'Unknown' && a.offlineStores !== 'Online' && (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">{a.offlineStores} stores</span>
                              )}
                              <button onClick={() => removeFromWatchlist(activeWatchlist._id, a.normalizedDomain)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove from watchlist">
                                <X size={14} strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isSettingsTab ? (
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
                        { label: 'Offline Presence', values: filters.offlinePresence },
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
          ) : (
            /* ── Selection Bar ─────────────────────────────────────── */
            <div className="max-w-6xl mx-auto space-y-4">
              {/* Select all / selection actions bar */}
              <div className="flex items-center justify-between">
                <button onClick={selectAll}
                  className="flex items-center gap-2 text-[12px] font-medium text-slate-500 hover:text-slate-700 transition-colors">
                  {selectedAccounts.size === accounts.length && accounts.length > 0
                    ? <CheckSquare size={16} className="text-[#C94C1E]" />
                    : <Square size={16} />}
                  <span>{selectedAccounts.size === accounts.length && accounts.length > 0 ? 'Deselect all' : 'Select all'}</span>
                </button>

                {selectedAccounts.size > 0 && (
                  <div className="flex items-center gap-3" ref={bulkDropdownRef}>
                    <span className="text-[12px] font-bold text-[#C94C1E]">{selectedAccounts.size} selected</span>
                    <div className="relative">
                      <button onClick={() => setShowBulkWlDropdown(!showBulkWlDropdown)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C94C1E] text-white text-[12px] font-bold hover:bg-[#b5431a] transition-colors shadow-lg shadow-orange-500/20">
                        <Plus size={14} /> Add to Watchlist
                      </button>
                      {showBulkWlDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                          <div className="p-3 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Add {selectedAccounts.size} account{selectedAccounts.size > 1 ? 's' : ''} to</p>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                            {watchlists.map(wl => (
                              <button key={wl._id} onClick={() => addSelectedToWatchlist(wl._id)} disabled={bulkAdding}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left disabled:opacity-50">
                                <Star size={14} className="text-slate-300 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-medium text-slate-700 truncate">{wl.name}</p>
                                  <p className="text-[11px] text-slate-400">{wl.domains?.length || 0} accounts</p>
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="p-3 border-t border-slate-100">
                            <div className="flex gap-2">
                              <input type="text" placeholder="New watchlist name..." value={bulkNewWlName}
                                onChange={e => setBulkNewWlName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createAndAddToWatchlist()}
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all" />
                              <button onClick={createAndAddToWatchlist} disabled={!bulkNewWlName.trim() || bulkAdding}
                                className="px-3 py-2 rounded-lg bg-[#C94C1E] text-white text-[11px] font-bold hover:bg-[#b5431a] disabled:opacity-40 transition-colors">
                                Create
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={clearSelection}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Account Cards Grid ──────────────────────────────── */}
              <div className="space-y-2">
                {accounts.map(a => {
                  const isSelected = selectedAccounts.has(a.normalizedDomain);
                  const name = domainToName(a.normalizedDomain);
                  return (
                    <div key={a.normalizedDomain}
                      className={`bg-white border rounded-xl overflow-hidden transition-all group ${isSelected ? 'border-[#C94C1E]/40 ring-2 ring-[#C94C1E]/10' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
                      <div className="flex items-center gap-0">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(a.normalizedDomain); }}
                          className={`flex-shrink-0 w-11 flex items-center justify-center self-stretch border-r transition-colors ${
                            isSelected ? 'bg-[#C94C1E]/5 border-[#C94C1E]/10' : 'border-slate-100 hover:bg-slate-50'
                          }`}>
                          <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 group-hover:border-slate-400'
                          }`}>
                            {isSelected && <Check size={11} className="text-white stroke-[3]" />}
                          </div>
                        </button>

                        {/* Main clickable area */}
                        <div className="flex-1 flex items-center gap-4 px-4 py-3 cursor-pointer min-w-0"
                          onClick={() => router.push(`/account/${a.normalizedDomain}`)}>

                          {/* Favicon */}
                          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={faviconUrl(a.normalizedDomain)} alt="" width={22} height={22} className="rounded"
                              onError={(e) => {
                                const t = e.target as HTMLImageElement;
                                t.style.display = 'none';
                                t.parentElement!.innerHTML = `<span class="font-serif text-slate-400 text-[15px]">${name[0]}</span>`;
                              }} />
                          </div>

                          {/* Name + Domain */}
                          <div className="min-w-0 w-[180px] flex-shrink-0">
                            <h3 className="text-[14px] font-bold text-slate-800 leading-tight group-hover:text-[#C94C1E] transition-colors truncate">{name}</h3>
                            <span className="text-[11px] text-slate-400 truncate block">{a.normalizedDomain}</span>
                          </div>

                          {/* Category + Sub */}
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {a.category && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 whitespace-nowrap">
                                {a.category}
                              </span>
                            )}
                            {a.subCategory && a.subCategory !== a.category && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-100 whitespace-nowrap truncate max-w-[140px]">
                                {a.subCategory}
                              </span>
                            )}
                          </div>

                          {/* Region */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 w-[90px]">
                            <MapPin size={12} className="text-blue-400 flex-shrink-0" />
                            <span className="text-[12px] font-medium text-slate-600 truncate">{a.region || 'Global'}</span>
                          </div>

                          {/* Stores */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 w-[100px]">
                            <Store size={12} className="text-emerald-400 flex-shrink-0" />
                            <span className="text-[12px] font-medium text-slate-600 truncate">{storeLabel(a.offlineStores)}</span>
                          </div>

                          {/* Techs */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 w-[80px]">
                            <Cpu size={12} className="text-violet-400 flex-shrink-0" />
                            <span className="text-[12px] font-medium text-slate-600">{a.techCount ? `${a.techCount}+` : '—'}</span>
                          </div>
                        </div>

                        {/* Visit button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`https://${a.normalizedDomain}`, '_blank'); }}
                          className="flex-shrink-0 w-10 flex items-center justify-center self-stretch border-l border-slate-100 text-slate-300 hover:text-[#C94C1E] hover:bg-orange-50/50 transition-colors"
                          title="Visit website">
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && (
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


      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #F1F1F1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #E2E2E2; }

      `}</style>
    </div>
  );
}

/* ── NavBtn (sidebar navigation button, always collapsed icon-only with tooltip) ── */
function NavBtn({ icon, label, active, locked, onClick, badge }: {
  icon: React.ReactNode; label: string; active?: boolean; locked?: boolean; onClick?: () => void; badge?: string;
}) {
  const tooltipText = locked ? `${label} — Coming Soon` : label;
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTip = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    timerRef.current = setTimeout(() => {
      setTip({ x: rect.right + 12, y: rect.top + rect.height / 2 });
    }, 300);
  };
  const hideTip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTip(null);
  };

  const tooltip = tip && (
    <div className="fixed z-[9999] pointer-events-none" style={{ left: tip.x, top: tip.y, transform: 'translateY(-50%)' }}>
      <div className="bg-slate-800 text-white text-[12px] font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap relative">
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
        {tooltipText}
      </div>
    </div>
  );

  if (locked) {
    return (
      <div className="flex items-center justify-center rounded-lg text-slate-400 cursor-not-allowed transition-all p-2.5 relative"
        onMouseEnter={showTip} onMouseLeave={hideTip}>
        <span className="text-slate-300 flex-shrink-0">{icon}</span>
        {tooltip}
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      onMouseEnter={showTip} onMouseLeave={hideTip}
      className={`w-full flex items-center justify-center rounded-lg transition-all p-2.5 relative ${
        active
          ? 'bg-orange-50 text-[#C94C1E]'
          : 'text-slate-500 hover:bg-slate-50'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      {badge && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[8px] font-bold flex items-center justify-center">{badge}</span>}
      {tooltip}
    </button>
  );
}

/* ── Market Intelligence View ─────────────────────────────────────────── */
const SIGNAL_SECTIONS = [
  { key: 'funding', label: 'Funding Activity', icon: <DollarSign size={18} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  { key: 'stores', label: 'Store Expansion', icon: <Store size={18} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { key: 'apps', label: 'App Launches', icon: <Smartphone size={18} />, color: 'text-violet-400', bg: 'bg-violet-400/10' },
  { key: 'hiring', label: 'Key Hiring', icon: <Users size={18} />, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  { key: 'marketplace', label: 'Marketplace Expansion', icon: <Layers size={18} />, color: 'text-rose-400', bg: 'bg-rose-400/10' },
  { key: 'growth', label: 'High Growth', icon: <TrendingUp size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
] as const;

const STAT_CARDS = [
  { label: 'FUNDING ROUNDS', value: '7', sub: '+3 vs last week', icon: <DollarSign size={16} /> },
  { label: 'STORE OPENINGS', value: '18', sub: 'across 5 brands', icon: <Store size={16} /> },
  { label: 'APP LAUNCHES', value: '4', sub: '3 iOS-first', icon: <Smartphone size={16} /> },
  { label: 'KEY HIRES', value: '11', sub: 'VP+ level roles', icon: <Users size={16} /> },
  { label: 'HIGH GROWTH', value: '9', sub: '>30% QoQ', icon: <TrendingUp size={16} /> },
];

const MOCK_SIGNALS: Record<string, { brand: string; domain: string; headline: string; date: string }[]> = {
  funding: [
    { brand: 'Mamaearth', domain: 'mamaearth.in', headline: 'Raised $30M Series D led by Sequoia Capital', date: '2 days ago' },
    { brand: 'boAt', domain: 'boat-lifestyle.com', headline: 'IPO filing — valued at $1.5B', date: '3 days ago' },
    { brand: 'Lenskart', domain: 'lenskart.com', headline: 'Raised $100M from Abu Dhabi Investment Authority', date: '5 days ago' },
  ],
  stores: [
    { brand: 'Nykaa', domain: 'nykaa.com', headline: 'Opened 12 new Nykaa On-Trend stores across Tier-2 cities', date: '1 day ago' },
    { brand: 'Licious', domain: 'licious.in', headline: 'Expanded to 6 new dark stores in Bangalore', date: '4 days ago' },
  ],
  apps: [
    { brand: 'Sugar Cosmetics', domain: 'sugarcosmetics.com', headline: 'Launched iOS app with AR try-on feature', date: '2 days ago' },
    { brand: 'Bewakoof', domain: 'bewakoof.com', headline: 'Released redesigned Android app with AI recommendations', date: '6 days ago' },
  ],
  hiring: [
    { brand: 'Zepto', domain: 'zepto.co', headline: 'Hired ex-Amazon VP as Chief Supply Chain Officer', date: '1 day ago' },
    { brand: 'Meesho', domain: 'meesho.com', headline: 'Appointed new CTO from Google India leadership', date: '3 days ago' },
  ],
  marketplace: [
    { brand: 'Mokobara', domain: 'mokobara.com', headline: 'Listed on Amazon US — international expansion begins', date: '2 days ago' },
    { brand: 'Noise', domain: 'gonoise.com', headline: 'Expanded to Flipkart and Myntra channels', date: '5 days ago' },
  ],
  growth: [
    { brand: 'Perfora', domain: 'perfora.in', headline: 'Monthly traffic up 42% QoQ — oral care breakout', date: '1 day ago' },
  ],
};

function MarketIntelligenceView() {
  const [period, setPeriod] = useState<'week' | '2weeks' | 'month'>('week');
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleSection = (key: string) => setExpanded(prev => prev === key ? null : key);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-slate-400">Signals filtered by your ICP — Beauty, Fashion, Food &amp; Bev · India</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {([['week', 'This Week'], ['2weeks', 'Last 2 Weeks'], ['month', 'Last Month']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                period === key
                  ? 'bg-[#C94C1E] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        {STAT_CARDS.map(card => (
          <div key={card.label}
            className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</span>
              <span className="text-slate-300">{card.icon}</span>
            </div>
            <p className="text-[28px] font-extrabold leading-none text-slate-800 mb-1">{card.value}</p>
            <p className="text-[11px] text-slate-400 font-medium">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Signal accordion sections */}
      <div className="space-y-3">
        {SIGNAL_SECTIONS.map(section => {
          const signals = MOCK_SIGNALS[section.key] || [];
          const isOpen = expanded === section.key;
          return (
            <div key={section.key}
              className={`bg-white border rounded-2xl transition-all ${isOpen ? 'border-slate-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
              <button onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${section.bg} flex items-center justify-center ${section.color}`}>
                    {section.icon}
                  </div>
                  <span className="text-[15px] font-bold text-slate-800">{section.label}</span>
                  <span className="w-6 h-6 rounded-full bg-[#C94C1E]/10 text-[#C94C1E] text-[11px] font-bold flex items-center justify-center">
                    {signals.length}
                  </span>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="px-6 pb-5 space-y-3 border-t border-slate-100 pt-4">
                  {signals.map((s, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 bg-slate-50/70 rounded-xl hover:bg-slate-50 transition-colors group/card">
                      <img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=64`} alt="" className="w-9 h-9 rounded-lg border border-slate-200 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-bold text-slate-800">{s.brand}</span>
                          <span className="text-[11px] text-slate-400">{s.domain}</span>
                        </div>
                        <p className="text-[13px] text-slate-600 leading-snug">{s.headline}</p>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium flex-shrink-0 mt-1">{s.date}</span>
                      <button className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1.5 hover:bg-white rounded-lg flex-shrink-0 mt-0.5">
                        <ExternalLink size={14} className="text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
