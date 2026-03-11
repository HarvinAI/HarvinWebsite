'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import {
  Search, ChevronDown, ChevronUp, X,
  ChevronLeft, ChevronRight,
  Filter, Check, Satellite, Radar,
  Briefcase, Settings2, Link2, LogOut, Loader2,
  Target, Swords, Lock, Plus, Star, Trash2, Pencil,
  Store, ExternalLink, CheckSquare, Square,
  DollarSign, Smartphone, Users, TrendingUp, Layers, Download, ArrowUpDown,
  ShoppingCart, Code, Globe, MapPin, Tag, Zap, Megaphone, Shield, Gauge,
  FlaskConical, Sparkles, Bell, Mail, Gift, Eye, Server, Type, Play,
  ClipboardList, MessageCircle, Package, Truck, RotateCcw, Calendar,
  Database, KeyRound, Repeat, CreditCard, MousePointerClick, Hash,
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
  techStack: string[];
  businessModel: string | null;
  trafficBand: string | null;
  appPresence: string | null;
  activeSignals: string[];
  fundingStage: string | null;
  updatedAt: string;
};
type Filters = { category: string[]; region: string[]; state: string[]; city: string[]; businessModel: string[]; scale: string[]; offlinePresence: string[]; appPresence: string[]; techStack: string[]; activeSignals: string[]; funding: string[] };
type SortKey = 'domain' | 'category' | 'region' | 'offlineStores' | 'updatedAt' | 'techCount';
type FilterOptions = { categories: string[]; regions: string[]; states: string[]; cities: string[]; offlineStores: string[] };
type Watchlist = { _id: string; name: string; domains: string[]; createdAt: string; updatedAt: string };
type WatchlistAccount = Account & { normalizedDomain: string };
type SidebarTab = 'market-intelligence' | 'account-explorer' | 'tech-scanner' | 'my-watchlists' | 'recently-funded' | 'competitor-clients' | 'current-clients' | 'icp-preferences' | 'integrations';

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20;
const CAT_SHOW = 5;



type ScanTech = { name: string; category: string; color: string };
type ScanCompanyMeta = { category: string; subCategory: string; region: string; offlineStores: string };
type ScanResult = { url: string; technologies: ScanTech[]; count: number; companyMeta?: ScanCompanyMeta };

const TAB_TITLES: Record<SidebarTab, string> = {
  'market-intelligence': 'Market Intelligence',
  'account-explorer': 'Account Explorer',
  'tech-scanner': 'Tech Scanner',
  'my-watchlists': 'My Watchlists',
  'recently-funded': 'Recently Funded',
  'competitor-clients': 'Competitor Clients',
  'current-clients': 'Current Clients',
  'icp-preferences': 'ICP & Preferences',
  'integrations': 'Integrations',
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
const emptyFilters = (): Filters => ({ category: [], region: [], state: [], city: [], businessModel: [], scale: [], offlinePresence: [], appPresence: [], techStack: [], activeSignals: [], funding: [] });

function domainToName(domain: string): string {
  const base = domain.replace(/^www\./, '').split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}


/* Deterministic hash for demo fallbacks (consistent per domain) */
function domainHash(d: string): number {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = ((h << 5) - h + d.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DEMO_TECH = ['Shopify', 'Klaviyo', 'CleverTap', 'Razorpay', 'Google Analytics', 'Meta Pixel', 'Segment', 'Freshdesk', 'Shiprocket', 'Magento', 'WooCommerce', 'Stripe', 'Hotjar', 'Zendesk', 'Mailchimp'];
const DEMO_BIZ = ['Pure D2C', 'Omnichannel', 'D2C + Marketplace', 'D2C + B2B'];
const DEMO_TRAFFIC = ['<100K', '100K-500K', '500K-2M', '2M+'];
const DEMO_APP = ['No App', 'iOS Only', 'Android Only', 'Both iOS & Android'];
const DEMO_SIGNALS = ['Recently Funded', 'Hiring Surge', 'New Product Launch', 'International Expansion', 'Tech Migration'];
const DEMO_FUNDING = ['Bootstrapped', 'Seed / Angel', 'Series A+', 'Late Stage'];

function demoFill(a: Account): Account {
  const h = domainHash(a.normalizedDomain);
  const pick = <T,>(arr: T[], seed: number): T => arr[seed % arr.length];
  const pickN = <T,>(arr: T[], seed: number, n: number): T[] => {
    const out: T[] = [];
    for (let i = 0; i < n; i++) out.push(arr[(seed + i * 7) % arr.length]);
    return [...new Set(out)];
  };
  return {
    ...a,
    techStack: a.techStack?.length ? a.techStack : pickN(DEMO_TECH, h, 3 + (h % 3)),
    businessModel: a.businessModel || pick(DEMO_BIZ, h),
    trafficBand: a.trafficBand || pick(DEMO_TRAFFIC, h + 3),
    appPresence: a.appPresence || pick(DEMO_APP, h + 5),
    activeSignals: a.activeSignals?.length ? a.activeSignals : pickN(DEMO_SIGNALS, h + 2, 1 + (h % 2)),
    fundingStage: a.fundingStage || pick(DEMO_FUNDING, h + 7),
  };
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
    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all text-left w-full group ${on ? 'bg-orange-50 dark:bg-[#C94C1E]/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${on ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.12] group-hover:border-slate-400'}`}>
      {on && <Check size={10} className="text-white stroke-[3]" />}
    </div>
    <span className={`text-[13px] transition-colors ${on ? 'text-[#C94C1E] font-medium' : 'text-slate-600 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>{label}</span>
  </button>
);

const FilterSection = ({ title, count, children, defaultOpen = true }: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-extrabold text-slate-600 dark:text-neutral-300 uppercase tracking-widest">{title}</span>
          {count !== undefined && count > 0 && <span className="text-[10px] bg-orange-100 dark:bg-[#C94C1E]/10 text-[#C94C1E] px-1.5 rounded-full font-bold">{count}</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-300 dark:text-neutral-600" /> : <ChevronDown size={14} className="text-slate-300 dark:text-neutral-600" />}
      </button>
      {open && <div className="mt-1 flex flex-col gap-0.5">{children}</div>}
    </div>
  );
};

/* ── Location Sub-filter (Sales Navigator style — search + always-visible list) */
const LocationSubFilter = ({ label, options, selected, onToggle }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void;
}) => {
  const [q, setQ] = useState('');
  const visible = q.trim()
    ? options.filter(o => o.toLowerCase().includes(q.toLowerCase()))
    : options;

  // Don't render the filter section at all if there are no options
  if (options.length === 0) return null;

  return (
    <div className="mt-2.5 mb-1">
      <p className="px-3 text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide mb-1.5">{label}</p>

      {/* Search input */}
      <div className="mx-3 mb-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" size={12} />
          <input
            type="text" value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="w-full pl-8 pr-3 py-[7px] bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-md text-[12px] outline-none focus:border-[#C94C1E]/50 focus:shadow-[0_0_0_2px_rgba(201,76,30,0.08)] transition-all placeholder:text-slate-400 dark:placeholder:text-neutral-500 dark:text-white"
          />
        </div>
      </div>

      {/* Scrollable list — always visible */}
      <div className="max-h-[140px] overflow-y-auto custom-scrollbar">
        {visible.length === 0 && <p className="px-3 py-2 text-[11px] text-slate-400 dark:text-neutral-500 text-center">No matches</p>}
        {visible.map(v => {
          const isOn = selected.includes(v);
          return (
            <button key={v} onClick={() => onToggle(v)}
              className={`w-full flex items-center justify-between px-3 py-[6px] text-left transition-colors ${isOn ? 'bg-orange-50/70 dark:bg-[#C94C1E]/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
              <span className={`text-[12px] ${isOn ? 'text-[#C94C1E] font-medium' : 'text-slate-600 dark:text-neutral-300'}`}>{v}</span>
              <span className={`text-[10px] font-medium ${isOn ? 'text-[#C94C1E]' : 'text-slate-400 dark:text-neutral-500'}`}>
                {isOn ? 'Included' : 'Include'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ── Category Picker Modal ──────────────────────────────────────────── */
const CategoryPickerModal = ({ categories, selected, onToggle, onSelectAll, onClose }: {
  categories: string[]; selected: string[]; onToggle: (v: string) => void; onSelectAll: () => void; onClose: () => void;
}) => {
  const [q, setQ] = useState('');
  const filtered = q ? categories.filter(c => c.toLowerCase().includes(q.toLowerCase())) : categories;
  const allSelected = categories.length > 0 && selected.length === categories.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#141414] rounded-2xl shadow-2xl dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">Select Categories</h3>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">{selected.length} of {categories.length} selected</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" size={14} />
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search categories..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-[13px] outline-none focus:border-orange-200 dark:focus:border-[#C94C1E]/40 focus:ring-2 focus:ring-orange-100 dark:focus:ring-[#C94C1E]/20 transition-all dark:text-white dark:placeholder:text-neutral-500" autoFocus />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {!q && (
            <button onClick={onSelectAll}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-left w-full mb-1 ${allSelected ? 'bg-orange-50 dark:bg-[#C94C1E]/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${allSelected ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.12]'}`}>
                {allSelected && <Check size={10} className="text-white stroke-[3]" />}
              </div>
              <span className={`text-[13px] font-medium ${allSelected ? 'text-[#C94C1E]' : 'text-slate-600 dark:text-neutral-300'}`}>All Categories</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-0.5">
            {filtered.map(v => (
              <button key={v} onClick={() => onToggle(v)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-left ${selected.includes(v) ? 'bg-orange-50 dark:bg-[#C94C1E]/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${selected.includes(v) ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.12]'}`}>
                  {selected.includes(v) && <Check size={10} className="text-white stroke-[3]" />}
                </div>
                <span className={`text-[12px] ${selected.includes(v) ? 'text-[#C94C1E] font-medium' : 'text-slate-600 dark:text-neutral-300'}`}>{v}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 && <p className="text-center py-6 text-[13px] text-slate-400 dark:text-neutral-500">No categories match &ldquo;{q}&rdquo;</p>}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <button onClick={() => { selected.forEach(v => onToggle(v)); }} className="text-[12px] text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 font-medium transition-colors">
            Clear all
          </button>
          <button onClick={onClose} className="px-5 py-2 bg-[#C94C1E] text-white text-[12px] font-bold rounded-lg hover:bg-[#b5431a] transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#FDFDFD] dark:bg-[#0a0a0a]"><Loader2 size={32} className="text-[#C94C1E] animate-spin" /></div>}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [showCatPicker, setShowCatPicker] = useState(false);

  // Read initial tab & scan domain from URL params
  const paramTab = searchParams.get('tab') as SidebarTab | null;
  const paramScan = searchParams.get('scan');
  const [activeTab, setActiveTab] = useState<SidebarTab>(paramTab && paramTab in TAB_TITLES ? paramTab : 'account-explorer');
  const [initialScanDomain] = useState(paramScan || '');
  const { isDark, toggle: onToggleTheme } = useTheme();
  // filtersOpen removed — filters always visible, nav always collapsed

  // Data from API
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ categories: [], regions: [], states: [], cities: [], offlineStores: [] });
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
    if (filters.state.length) params.set('states', filters.state.join(','));
    if (filters.city.length) params.set('cities', filters.city.join(','));
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
        states: data.filterOptions.states || [],
        cities: data.filterOptions.cities || [],
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

  // Close sort menu on outside click
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = () => setShowSortMenu(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  // Clear selection when page/filters change
  useEffect(() => { clearSelection(); }, [page, filters, debouncedSearch]);

  // Load watchlists for bulk-add dropdown when in account-explorer
  useEffect(() => {
    if (activeTab === 'account-explorer' && ready) fetchWatchlists();
  }, [activeTab, ready, fetchWatchlists]);

  const activeCount = countFilters(filters);

  if (!ready) return null;
  const firstName = user?.name?.split(' ')[0] || 'there';


  const isSettingsTab = activeTab === 'icp-preferences' || activeTab === 'integrations';
  const isComingSoonTab = activeTab === 'recently-funded' || activeTab === 'competitor-clients' || activeTab === 'current-clients';
  const isWatchlistTab = activeTab === 'my-watchlists';
  const isMarketIntelTab = activeTab === 'market-intelligence';
  const isTechScannerTab = activeTab === 'tech-scanner';


  /* ── RENDER ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] dark:bg-[#0a0a0a] font-sans text-slate-900 dark:text-white overflow-hidden">

      {/* ── Nav Sidebar (expanded with labels) ── */}
      <aside className="hidden md:flex flex-col bg-white dark:bg-[#141414] border-r border-slate-100 dark:border-white/[0.06] flex-shrink-0 w-[220px]">
        <div className="flex items-center gap-2.5 flex-shrink-0 px-5 py-4">
          <a href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="HarvinAI" width={28} height={28} className="rounded-xl shadow-lg shadow-orange-500/10 flex-shrink-0 hover:scale-105 transition-transform" />
            <span className="font-bricolage font-bold text-[16px] tracking-normal text-slate-800 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div className="space-y-4 px-3">
            <div>
              <h3 className="px-3 mb-1 text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Intelligence</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Satellite size={18} />} label="Market Intelligence" active={activeTab === 'market-intelligence'} onClick={() => setActiveTab('market-intelligence')} />
                <NavBtn icon={<Search size={18} />} label="Account Explorer" active={activeTab === 'account-explorer'} onClick={() => setActiveTab('account-explorer')} />
                <NavBtn icon={<Radar size={18} />} label="Tech Scanner" active={activeTab === 'tech-scanner'} onClick={() => setActiveTab('tech-scanner')} />
              </div>
            </div>

            <div>
              <h3 className="px-3 mb-1 text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Watchlists</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Star size={18} />} label="My Watchlists" active={activeTab === 'my-watchlists'} onClick={() => setActiveTab('my-watchlists')}
                  badge={watchlists.length > 0 ? String(watchlists.length) : undefined} />
                <NavBtn icon={<Target size={18} />} label="Recently Funded" locked />
                <NavBtn icon={<Swords size={18} />} label="Competitor Clients" locked />
                <NavBtn icon={<Briefcase size={18} />} label="Current Clients" locked />
              </div>
            </div>

            <div>
              <h3 className="px-3 mb-1 text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Settings</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Settings2 size={18} />} label="ICP & Preferences" active={activeTab === 'icp-preferences'} onClick={() => setActiveTab('icp-preferences')} />
                <NavBtn icon={<Link2 size={18} />} label="Integrations" active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} />
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
              <p className="text-[11px] font-semibold text-slate-700 dark:text-neutral-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Filter Panel (Account Explorer only) ──────── */}
      {activeTab === 'account-explorer' && (
        <aside className="hidden md:flex flex-col bg-white dark:bg-[#141414] border-r border-slate-100 dark:border-white/[0.06] flex-shrink-0 w-[280px]">
          <div className="h-[56px] px-5 flex items-center border-b border-slate-100 dark:border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-[#C94C1E]" />
              <h2 className="font-bold text-slate-800 dark:text-white text-[14px]">Filters</h2>
              {activeCount > 0 && <span className="text-[10px] bg-orange-100 dark:bg-[#C94C1E]/10 text-[#C94C1E] px-1.5 py-0.5 rounded-full font-bold">{activeCount}</span>}
            </div>
          </div>

          <div className="px-4 pt-3 pb-2">
            <div className="relative flex items-center">
              <Search className="absolute left-3 text-slate-400 dark:text-neutral-500" size={14} />
              <input type="text" placeholder="Search brands..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus:border-orange-200 dark:focus:border-[#C94C1E]/40 focus:bg-white dark:focus:bg-[#1a1a1a] focus:ring-2 focus:ring-orange-100 dark:focus:ring-[#C94C1E]/20 rounded-lg text-[12px] transition-all outline-none dark:text-white dark:placeholder:text-neutral-500" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300"><X size={12} /></button>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pt-2 custom-scrollbar">
            <FilterSection title="Basics" count={filters.category.length + filters.region.length + filters.state.length + filters.city.length}>
              {/* Category — compact display + picker button */}
              <p className="px-3 text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide mt-1 mb-1">Category</p>
              <button onClick={() => setShowCatPicker(true)}
                className="mx-3 mb-2 w-[calc(100%-24px)] flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[11px] font-medium text-slate-500 dark:text-neutral-400 hover:border-[#C94C1E] hover:text-[#C94C1E] hover:bg-orange-50/50 dark:hover:bg-[#C94C1E]/10 transition-all">
                {filters.category.length === 0 ? (
                  <><Plus size={12} /> Select Categories</>
                ) : filters.category.length === filterOptions.categories.length ? (
                  <><Check size={12} className="text-[#C94C1E]" /> <span className="text-[#C94C1E]">All Categories</span></>
                ) : (
                  <>
                    <span className="text-[#C94C1E] truncate flex-1 text-left">{filters.category.slice(0, 2).join(', ')}{filters.category.length > 2 ? ` +${filters.category.length - 2}` : ''}</span>
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 dark:bg-[#C94C1E]/10 text-[#C94C1E] text-[10px] font-bold flex items-center justify-center">{filters.category.length}</span>
                  </>
                )}
              </button>

              {/* Location — separate Country / State / City sections */}
              <LocationSubFilter label="Country" options={filterOptions.regions} selected={filters.region} onToggle={(v) => toggle('region', v)} />
              <LocationSubFilter label="State" options={filterOptions.states || []} selected={filters.state} onToggle={(v) => toggle('state', v)} />
              <LocationSubFilter label="City" options={filterOptions.cities || []} selected={filters.city} onToggle={(v) => toggle('city', v)} />
            </FilterSection>

            <FilterSection title="D2C Profile" count={filters.businessModel.length + filters.scale.length + filters.offlinePresence.length + filters.appPresence.length} defaultOpen={false}>
              <p className="px-3 text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide mt-1 mb-1">Business Model</p>
              {['Pure D2C', 'Omnichannel', 'D2C + Marketplace', 'D2C + B2B'].map(v => (
                <FilterItem key={v} label={v} on={filters.businessModel.includes(v)} onClick={() => toggle('businessModel', v)} />
              ))}

              <p className="px-3 text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide mt-3 mb-1">Scale (Est. Traffic)</p>
              {['Emerging (<100K)', 'Growing (100K-500K)', 'Scaling (500K-2M)', 'Established (2M+)'].map(v => (
                <FilterItem key={v} label={v} on={filters.scale.includes(v)} onClick={() => toggle('scale', v)} />
              ))}

              <p className="px-3 text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide mt-3 mb-1">Offline Presence</p>
              {['Online Only', '1-10 stores', '10-50 stores', '50+ stores'].map(v => (
                <FilterItem key={v} label={v} on={filters.offlinePresence.includes(v)} onClick={() => toggle('offlinePresence', v)} />
              ))}

              <p className="px-3 text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide mt-3 mb-1">App Presence</p>
              {['No App', 'iOS Only', 'Android Only', 'Both iOS & Android'].map(v => (
                <FilterItem key={v} label={v} on={filters.appPresence.includes(v)} onClick={() => toggle('appPresence', v)} />
              ))}
            </FilterSection>

            <FilterSection title="Tech Stack" count={filters.techStack.length} defaultOpen={false}>
              <p className="px-3 text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide mt-1 mb-1">Ecommerce Platform</p>
              {['Shopify', 'WooCommerce', 'Magento', 'Custom-built'].map(v => (
                <FilterItem key={v} label={v} on={filters.techStack.includes(v)} onClick={() => toggle('techStack', v)} />
              ))}

              <div className="flex items-center gap-2 px-3 mt-3 mb-1">
                <p className="text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide">Engagement / CRM</p>
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Key</span>
              </div>
              {['CleverTap', 'MoEngage', 'WebEngage', 'Braze', 'Klaviyo', 'Mailchimp', 'None detected'].map(v => (
                <FilterItem key={v} label={v} on={filters.techStack.includes(v)} onClick={() => toggle('techStack', v)} />
              ))}

              <p className="px-3 text-[10px] font-medium text-slate-400/70 dark:text-neutral-500 uppercase tracking-wide mt-3 mb-1">Payments</p>
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

          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] flex-shrink-0">
            <button onClick={clearAll} className={`w-full text-center text-[12px] font-medium py-1 transition-colors ${activeCount > 0 ? 'text-[#C94C1E] hover:text-[#b5431a]' : 'text-slate-300 dark:text-neutral-600 cursor-default'}`} disabled={activeCount === 0}>
              Clear All Filters
            </button>
          </div>
        </aside>
      )}

      {/* ── Main Area ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9] dark:bg-[#0a0a0a] relative">

        {/* Header */}
        <header className="h-[64px] border-b border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#141414] px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-[#C94C1E]" />
            <h1 className="text-[18px] font-bold text-slate-800 dark:text-white">{TAB_TITLES[activeTab]}</h1>
            {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && !isTechScannerTab && <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">{total} results</span>}
            {isWatchlistTab && activeWatchlist && <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">{activeWatchlist.domains?.length || 0} accounts</span>}
          </div>

          {!isSettingsTab && !isComingSoonTab && !isMarketIntelTab && !isTechScannerTab && (
            <div className="flex items-center gap-2">
              {/* Sort */}
              <div className="relative">
                <button onClick={() => setShowSortMenu(p => !p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all">
                  <ArrowUpDown size={14} className="text-slate-400 dark:text-neutral-500" />
                  Sort
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] py-1 w-[200px] z-50" onMouseDown={e => e.stopPropagation()}>
                    {([
                      { key: 'updatedAt', label: 'Last Updated', asc: false },
                      { key: 'domain', label: 'Name (A-Z)', asc: true },
                      { key: 'domain', label: 'Name (Z-A)', asc: false },
                      { key: 'offlineStores', label: 'Most Stores', asc: false },
                      { key: 'offlineStores', label: 'Fewest Stores', asc: true },
                      { key: 'techCount', label: 'Most Techs', asc: false },
                      { key: 'techCount', label: 'Fewest Techs', asc: true },
                      { key: 'category', label: 'Category (A-Z)', asc: true },
                      { key: 'region', label: 'Region (A-Z)', asc: true },
                    ] as { key: SortKey; label: string; asc: boolean }[]).map(opt => (
                      <button key={opt.label} onClick={() => { setSortKey(opt.key); setSortAsc(opt.asc); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${sortKey === opt.key && sortAsc === opt.asc ? 'text-[#C94C1E] font-semibold bg-orange-50 dark:bg-[#C94C1E]/10' : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Export */}
              <button onClick={() => {
                const rows = accounts.map(a => [a.normalizedDomain, a.category, a.subCategory, a.region, a.offlineStores, a.techCount, a.updatedAt].join(','));
                const csv = ['Domain,Category,SubCategory,Region,OfflineStores,TechCount,UpdatedAt', ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = 'accounts-export.csv'; link.click();
                URL.revokeObjectURL(url);
              }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all">
                <Download size={14} className="text-slate-400 dark:text-neutral-500" />
                Export
              </button>
            </div>
          )}
        </header>

        {/* Active filter chips */}
        {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && !isTechScannerTab && activeCount > 0 && (
          <div className="bg-white dark:bg-[#141414] border-b border-slate-100 dark:border-white/[0.06] px-8 py-2.5 flex items-center gap-3 overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Filter size={12} className="text-slate-400 dark:text-neutral-500" />
              <span className="text-[11px] text-slate-400 dark:text-neutral-500 font-semibold uppercase tracking-wider">Active</span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/[0.08] flex-shrink-0" />
            {(Object.keys(filters) as (keyof Filters)[]).map(k => {
              if (filters[k].length === 0) return null;
              const label: Record<string, string> = { category: 'Category', region: 'Country', state: 'State', city: 'City', businessModel: 'Business Model', scale: 'Scale', offlinePresence: 'Offline', appPresence: 'App', techStack: 'Tech', activeSignals: 'Signals', funding: 'Funding' };
              return (
                <div key={k} className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">{label[k] || k}:</span>
                  {filters[k].map(v => (
                    <button key={`${k}-${v}`} onClick={() => toggle(k, v)}
                      className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[11px] font-medium text-slate-600 dark:text-neutral-300 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-all group">
                      {v}
                      <X size={10} strokeWidth={2.5} className="text-slate-400 dark:text-neutral-500 group-hover:text-red-500 transition-colors" />
                    </button>
                  ))}
                </div>
              );
            })}
            <div className="h-4 w-px bg-slate-200 dark:bg-white/[0.08] flex-shrink-0" />
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
          ) : isTechScannerTab ? (
            /* ── Tech Scanner ────────────────────────────────────── */
            <TechScannerView initialDomain={initialScanDomain} />
          ) : isWatchlistTab ? (
            /* ── Watchlists View ───────────────────────────────────── */
            <div className="max-w-5xl mx-auto">
              {!activeWatchlist ? (
                /* Watchlist list */
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[14px] text-slate-500 dark:text-neutral-400">{watchlists.length} watchlist{watchlists.length !== 1 ? 's' : ''}</p>
                    <button onClick={() => setShowCreateWl(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20">
                      <Plus size={16} /> New Watchlist
                    </button>
                  </div>

                  {/* Create modal */}
                  {showCreateWl && (
                    <div className="bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 shadow-sm dark:shadow-none">
                      <h3 className="text-[14px] font-bold text-slate-800 dark:text-white mb-3">Create Watchlist</h3>
                      <div className="flex gap-2">
                        <input
                          type="text" placeholder="e.g. Top D2C Brands, Competitor Tracking..."
                          value={newWlName} onChange={e => setNewWlName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && createWatchlist()}
                          className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus:border-orange-300 dark:focus:border-[#C94C1E]/40 focus:ring-4 focus:ring-orange-100 dark:focus:ring-[#C94C1E]/20 rounded-xl text-[13px] outline-none transition-all dark:text-white dark:placeholder:text-neutral-500"
                          autoFocus
                        />
                        <button onClick={createWatchlist}
                          className="px-5 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors">
                          Create
                        </button>
                        <button onClick={() => { setShowCreateWl(false); setNewWlName(''); }}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-neutral-400 text-[13px] font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {watchlists.length === 0 && !showCreateWl ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-4">
                        <Star size={24} className="text-slate-300 dark:text-neutral-600" />
                      </div>
                      <p className="text-[15px] font-semibold text-slate-600 dark:text-neutral-300 mb-1">No watchlists yet</p>
                      <p className="text-[12px] text-slate-400 dark:text-neutral-500 mb-5 max-w-sm">Create a watchlist to save and track brands you&apos;re interested in. Add accounts from the Account Explorer or individual account pages.</p>
                      <button onClick={() => setShowCreateWl(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20">
                        <Plus size={16} /> Create your first watchlist
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {watchlists.map(wl => (
                        <div key={wl._id}
                          className="bg-white dark:bg-[#141414]/60 rounded-xl border border-slate-200 dark:border-white/[0.08] p-5 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-slate-300 dark:hover:border-white/[0.12] transition-all cursor-pointer group"
                          onClick={() => fetchWatchlistDetail(wl._id)}>
                          <div className="flex items-start justify-between mb-3">
                            {renamingWl === wl._id ? (
                              <input type="text" value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') renameWatchlist(wl._id); if (e.key === 'Escape') setRenamingWl(null); }}
                                onBlur={() => setRenamingWl(null)}
                                className="text-[16px] font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg px-2 py-1 outline-none focus:border-orange-300 dark:focus:border-[#C94C1E]/40 w-full"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <h3 className="text-[16px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors">{wl.name}</h3>
                            )}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setRenamingWl(wl._id); setRenameValue(wl.name); }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 dark:text-neutral-500 transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => { if (confirm('Delete this watchlist?')) deleteWatchlist(wl._id); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 dark:text-neutral-500 hover:text-red-500 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[12px] text-slate-400 dark:text-neutral-500">
                            <span className="font-semibold text-slate-600 dark:text-neutral-300">{wl.domains?.length || 0} accounts</span>
                            <span className="text-slate-200 dark:text-white/10">&bull;</span>
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
                    className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 mb-4 transition-colors">
                    <ChevronLeft size={16} /> Back to Watchlists
                  </button>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-[20px] font-bold text-slate-800 dark:text-white">{activeWatchlist.name}</h2>
                      <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-0.5">{activeWatchlist.domains?.length || 0} accounts &middot; Updated {formatDate(activeWatchlist.updatedAt)}</p>
                    </div>
                  </div>

                  {wlLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 size={28} className="text-[#C94C1E] animate-spin" />
                    </div>
                  ) : watchlistAccounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-3"><Star size={20} className="text-slate-300 dark:text-neutral-600" /></div>
                      <p className="text-[14px] font-semibold text-slate-600 dark:text-neutral-300 mb-1">This watchlist is empty</p>
                      <p className="text-[12px] text-slate-400 dark:text-neutral-500 mb-4">Add accounts from the Account Explorer or individual account pages.</p>
                      <button onClick={() => setActiveTab('account-explorer')}
                        className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#C94C1E] border border-orange-200 dark:border-[#C94C1E]/30 hover:bg-orange-50 dark:hover:bg-[#C94C1E]/10 transition-colors">
                        Browse accounts
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {watchlistAccounts.map(a => (
                        <div key={a.normalizedDomain}
                          className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-slate-300 dark:hover:border-white/[0.12] transition-all group">
                          <div className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] flex items-center justify-center font-serif text-slate-400 dark:text-neutral-500 text-lg flex-shrink-0 cursor-pointer"
                              onClick={() => router.push(`/account/${a.normalizedDomain}`)}>
                              {domainToName(a.normalizedDomain)[0]}
                            </div>
                            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/account/${a.normalizedDomain}`)}>
                              <div className="flex items-center gap-2">
                                <h3 className="text-[15px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors">{domainToName(a.normalizedDomain)}</h3>
                                <span className="text-[11px] text-slate-400 dark:text-neutral-500">{a.normalizedDomain}</span>
                              </div>
                              <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-0.5">
                                {a.category}{a.subCategory && a.subCategory !== a.category ? ` · ${a.subCategory}` : ''}{a.region ? ` · ${a.region}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {a.category && a.category !== 'Unknown' && (
                                <span className="text-[10px] font-semibold text-orange-700 dark:text-[#C94C1E] bg-orange-50 dark:bg-[#C94C1E]/10 border border-orange-200 dark:border-[#C94C1E]/30 px-2 py-0.5 rounded">{a.category}</span>
                              )}
                              {a.offlineStores && a.offlineStores !== 'Unknown' && a.offlineStores !== 'Online' && (
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded">{a.offlineStores} stores</span>
                              )}
                              <button onClick={() => removeFromWatchlist(activeWatchlist._id, a.normalizedDomain)}
                                className="p-1.5 rounded-lg text-slate-300 dark:text-neutral-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
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
                  <div className="bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6">
                    <h2 className="text-[16px] font-bold text-slate-800 dark:text-white mb-1">Ideal Customer Profile</h2>
                    <p className="text-[13px] text-slate-400 dark:text-neutral-500 mb-6">Your ICP is synced from onboarding. Adjust filters on any intelligence page to refine.</p>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Categories', values: filters.category },
                        { label: 'Regions', values: filters.region },
                        { label: 'Offline Presence', values: filters.offlinePresence },
                      ].map(item => (
                        <div key={item.label} className="bg-slate-50 dark:bg-white/[0.04] rounded-lg p-4">
                          <p className="text-[11px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-2">{item.label}</p>
                          {item.values.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {item.values.map(v => <span key={v} className="text-[11px] bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] px-2 py-0.5 rounded-md text-slate-600 dark:text-neutral-300 font-medium">{v}</span>)}
                            </div>
                          ) : (
                            <p className="text-[12px] text-slate-300 dark:text-neutral-600 italic">No preference set</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-6">
                      <button onClick={clearAll} className="border border-slate-200 dark:border-white/[0.08] px-5 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                        Clear All Preferences
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.08] p-6">
                    <h2 className="text-[16px] font-bold text-slate-800 dark:text-white mb-1">Integrations</h2>
                    <p className="text-[13px] text-slate-400 dark:text-neutral-500 mb-6">Connect your tools to enrich account data and automate workflows.</p>
                    <div className="space-y-3">
                      {[
                        { name: 'Salesforce', desc: 'Sync accounts & contacts', connected: false },
                        { name: 'HubSpot', desc: 'CRM integration', connected: false },
                        { name: 'Slack', desc: 'Signal alerts & notifications', connected: false },
                        { name: 'Google Sheets', desc: 'Export watchlists', connected: false },
                      ].map(int => (
                        <div key={int.name} className="flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-white/[0.06] hover:border-slate-200 dark:hover:border-white/[0.08] transition-colors">
                          <div>
                            <p className="text-[14px] font-semibold text-slate-700 dark:text-neutral-200">{int.name}</p>
                            <p className="text-[12px] text-slate-400 dark:text-neutral-500">{int.desc}</p>
                          </div>
                          <button className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-semibold text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
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
              <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-4">
                <Lock size={24} className="text-slate-300 dark:text-neutral-600" />
              </div>
              <p className="text-[15px] font-semibold text-slate-600 dark:text-neutral-300 mb-1">Coming Soon</p>
              <p className="text-[12px] text-slate-400 dark:text-neutral-500 max-w-sm">This watchlist feature is under development. Switch to Account Explorer to browse real accounts.</p>
            </div>
          ) : loading ? (
            /* ── Loading ──────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Loader2 size={32} className="text-[#C94C1E] animate-spin mb-4" />
              <p className="text-[13px] text-slate-400 dark:text-neutral-500 font-medium">Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            /* ── Empty state ──────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-4"><Search size={24} className="text-slate-300 dark:text-neutral-600" /></div>
              <p className="text-[15px] font-semibold text-slate-600 dark:text-neutral-300 mb-1">No brands match</p>
              <p className="text-[12px] text-slate-400 dark:text-neutral-500 mb-4">Try adjusting your filters or search</p>
              <div className="flex gap-2">
                <button onClick={clearAll} className="h-8 px-4 rounded-lg text-[12px] font-semibold text-white bg-[#C94C1E] hover:bg-orange-700 transition-colors">Clear filters</button>
                <button onClick={clearAll} className="h-8 px-4 rounded-lg text-[12px] font-semibold text-[#C94C1E] border border-orange-200 dark:border-[#C94C1E]/30 hover:bg-orange-50 dark:hover:bg-[#C94C1E]/10 transition-colors">Clear filters</button>
              </div>
            </div>
          ) : (
            /* ── Selection Bar ─────────────────────────────────────── */
            <div className="max-w-6xl mx-auto space-y-4">
              {/* Select all / selection actions bar */}
              <div className="flex items-center justify-between">
                <button onClick={selectAll}
                  className="flex items-center gap-2 text-[12px] font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors">
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
                        <div className="absolute right-0 top-full mt-2 w-[280px] bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-xl dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] z-50 overflow-hidden">
                          <div className="p-3 border-b border-slate-100 dark:border-white/[0.06]">
                            <p className="text-[11px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Add {selectedAccounts.size} account{selectedAccounts.size > 1 ? 's' : ''} to</p>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                            {watchlists.map(wl => (
                              <button key={wl._id} onClick={() => addSelectedToWatchlist(wl._id)} disabled={bulkAdding}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50">
                                <Star size={14} className="text-slate-300 dark:text-neutral-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-medium text-slate-700 dark:text-neutral-200 truncate">{wl.name}</p>
                                  <p className="text-[11px] text-slate-400 dark:text-neutral-500">{wl.domains?.length || 0} accounts</p>
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="p-3 border-t border-slate-100 dark:border-white/[0.06]">
                            <div className="flex gap-2">
                              <input type="text" placeholder="New watchlist name..." value={bulkNewWlName}
                                onChange={e => setBulkNewWlName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createAndAddToWatchlist()}
                                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-[12px] outline-none focus:border-orange-300 dark:focus:border-[#C94C1E]/40 focus:ring-2 focus:ring-orange-100 dark:focus:ring-[#C94C1E]/20 transition-all dark:text-white dark:placeholder:text-neutral-500" />
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
                      className="p-2 rounded-lg text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Account Cards Grid ──────────────────────────────── */}
              <div className="space-y-3">
                {accounts.map(raw => {
                  const a = demoFill(raw);
                  const isSelected = selectedAccounts.has(a.normalizedDomain);
                  const name = domainToName(a.normalizedDomain);
                  const signalCount = (a.activeSignals || []).length;
                  const topTech = (a.techStack || []).slice(0, 3);
                  return (
                    <div key={a.normalizedDomain}
                      className={`bg-white dark:bg-[#141414]/60 border rounded-xl overflow-hidden transition-all group ${isSelected ? 'border-[#C94C1E]/40 ring-2 ring-[#C94C1E]/10' : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.12] hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]'}`}>
                      <div className="flex gap-0">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(a.normalizedDomain); }}
                          className={`flex-shrink-0 w-11 flex items-start pt-5 justify-center self-stretch border-r transition-colors ${
                            isSelected ? 'bg-[#C94C1E]/5 border-[#C94C1E]/10' : 'border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                          }`}>
                          <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.12] group-hover:border-slate-400'
                          }`}>
                            {isSelected && <Check size={11} className="text-white stroke-[3]" />}
                          </div>
                        </button>

                        {/* Card content */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/account/${a.normalizedDomain}`)}>
                          {/* Row 1: Brand identity + tech stack badges */}
                          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                            {/* Favicon */}
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={faviconUrl(a.normalizedDomain)} alt="" width={24} height={24} className="rounded"
                                onError={(e) => {
                                  const t = e.target as HTMLImageElement;
                                  t.style.display = 'none';
                                  t.parentElement!.innerHTML = `<span class="font-serif text-slate-400 text-[16px]">${name[0]}</span>`;
                                }} />
                            </div>

                            {/* Name + score + signals */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <h3 className="text-[15px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors truncate">{name}</h3>
                              {a.techCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex-shrink-0">
                                  <Layers size={10} />{a.techCount} tech
                                </span>
                              )}
                              {signalCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex-shrink-0">{signalCount} signal{signalCount > 1 ? 's' : ''}</span>
                              )}
                            </div>

                            {/* Tech stack badges (right side) */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {topTech.map(t => (
                                <span key={t} className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[10px] font-semibold text-slate-600 dark:text-neutral-300">{t}</span>
                              ))}
                              {(a.techStack || []).length > 3 && (
                                <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium">+{(a.techStack || []).length - 3}</span>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Category · Location · Business Model */}
                          <div className="px-4 pb-2 flex items-center gap-3 text-[12px] text-slate-500 dark:text-neutral-400">
                            {a.category && <span className="font-medium">{a.category}</span>}
                            {a.region && <><span className="text-slate-300 dark:text-neutral-600">·</span><span>{a.region}</span></>}
                            {a.businessModel && <><span className="text-slate-300 dark:text-neutral-600">·</span><span>{a.businessModel}</span></>}
                          </div>

                          {/* Row 3: Detail pills */}
                          <div className="px-4 pb-2.5 flex items-center gap-2 flex-wrap">
                            {a.trafficBand && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-[10px] font-medium text-slate-600 dark:text-neutral-300">
                                <TrendingUp size={10} className="text-blue-400" />{a.trafficBand} MAU
                              </span>
                            )}
                            {a.appPresence && a.appPresence !== 'No App' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-[10px] font-medium text-slate-600 dark:text-neutral-300">
                                <Smartphone size={10} className="text-violet-400" />{a.appPresence}
                              </span>
                            )}
                            {a.offlineStores && a.offlineStores !== 'Online' && a.offlineStores !== 'Unknown' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-[10px] font-medium text-slate-600 dark:text-neutral-300">
                                <Store size={10} className="text-emerald-400" />{a.offlineStores} stores
                              </span>
                            )}
                          </div>

                          {/* Row 4: Funding & active signals */}
                          {(a.fundingStage || signalCount > 0) && (
                            <div className="px-4 pb-3 flex items-center gap-3">
                              {a.fundingStage && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">
                                  <DollarSign size={12} className="text-green-500" />{a.fundingStage}
                                </span>
                              )}
                              {(a.activeSignals || []).map(s => (
                                <span key={s} className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400">
                                  <Target size={10} className="text-amber-400" />{s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Visit button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`https://${a.normalizedDomain}`, '_blank'); }}
                          className="flex-shrink-0 w-10 flex items-start pt-5 justify-center self-stretch border-l border-slate-100 dark:border-white/[0.06] text-slate-300 dark:text-neutral-600 hover:text-[#C94C1E] hover:bg-orange-50/50 dark:hover:bg-[#C94C1E]/10 transition-colors"
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
          <footer className="h-[64px] border-t border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#141414] px-8 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4 text-[12px] text-slate-400 dark:text-neutral-500 font-medium">
              <span>Showing <span className="text-slate-800 dark:text-white font-bold">{total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1}&ndash;{Math.min(page * PAGE_SIZE, total)}</span> of <span className="text-slate-800 dark:text-white font-bold">{total}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-400 dark:text-neutral-500 transition-all disabled:opacity-25"><ChevronLeft size={16} /></button>
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
                    className={`w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors ${p === page ? 'bg-[#C94C1E] text-white' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'}`}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-400 dark:text-neutral-500 transition-all disabled:opacity-25"><ChevronRight size={16} /></button>
            </div>
          </footer>
        )}
      </main>


      {showCatPicker && (
        <CategoryPickerModal
          categories={filterOptions.categories}
          selected={filters.category}
          onToggle={(v) => toggle('category', v)}
          onSelectAll={() => {
            const allSelected = filters.category.length === filterOptions.categories.length;
            setFilters(p => ({ ...p, category: allSelected ? [] : [...filterOptions.categories] }));
          }}
          onClose={() => setShowCatPicker(false)}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #F1F1F1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #E2E2E2; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
      `}</style>
    </div>
  );
}

/* ── NavBtn (sidebar navigation button, expanded with labels) ── */
function NavBtn({ icon, label, active, locked, onClick, badge }: {
  icon: React.ReactNode; label: string; active?: boolean; locked?: boolean; onClick?: () => void; badge?: string;
}) {
  if (locked) {
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
      <span className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      {badge && <span className="ml-auto text-[9px] bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-neutral-400 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
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
          <p className="text-[13px] text-slate-400 dark:text-neutral-500">Signals filtered by your ICP — Beauty, Fashion, Food &amp; Bev · India</p>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl p-1">
          {([['week', 'This Week'], ['2weeks', 'Last 2 Weeks'], ['month', 'Last Month']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                period === key
                  ? 'bg-[#C94C1E] text-white shadow-sm'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
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
            className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 hover:border-slate-300 dark:hover:border-white/[0.12] hover:shadow-sm dark:hover:shadow-none transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">{card.label}</span>
              <span className="text-slate-300 dark:text-neutral-600">{card.icon}</span>
            </div>
            <p className="text-[28px] font-extrabold leading-none text-slate-800 dark:text-white mb-1">{card.value}</p>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 font-medium">{card.sub}</p>
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
              className={`bg-white dark:bg-[#141414]/60 border rounded-2xl transition-all ${isOpen ? 'border-slate-300 dark:border-white/[0.12] shadow-sm dark:shadow-none' : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.12]'}`}>
              <button onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${section.bg} flex items-center justify-center ${section.color}`}>
                    {section.icon}
                  </div>
                  <span className="text-[15px] font-bold text-slate-800 dark:text-white">{section.label}</span>
                  <span className="w-6 h-6 rounded-full bg-[#C94C1E]/10 text-[#C94C1E] text-[11px] font-bold flex items-center justify-center">
                    {signals.length}
                  </span>
                </div>
                <ChevronDown size={18} className={`text-slate-300 dark:text-neutral-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="px-6 pb-5 space-y-3 border-t border-slate-100 dark:border-white/[0.06] pt-4">
                  {signals.map((s, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 bg-slate-50/70 dark:bg-white/[0.04] rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors group/card">
                      <img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=64`} alt="" className="w-9 h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-bold text-slate-800 dark:text-white">{s.brand}</span>
                          <span className="text-[11px] text-slate-400 dark:text-neutral-500">{s.domain}</span>
                        </div>
                        <p className="text-[13px] text-slate-600 dark:text-neutral-300 leading-snug">{s.headline}</p>
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-neutral-500 font-medium flex-shrink-0 mt-1">{s.date}</span>
                      <button className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1.5 hover:bg-white dark:hover:bg-white/[0.06] rounded-lg flex-shrink-0 mt-0.5">
                        <ExternalLink size={14} className="text-slate-400 dark:text-neutral-500" />
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

/* ── Tech Scanner View ────────────────────────────────────────────────── */
const SCAN_DEMO_BRANDS = [
  { name: 'Mamaearth', url: 'mamaearth.in' },
  { name: 'boAt', url: 'boat-lifestyle.com' },
  { name: 'Sugar Cosmetics', url: 'sugarcosmetics.com' },
  { name: 'Lenskart', url: 'lenskart.com' },
  { name: 'Nykaa', url: 'nykaa.com' },
  { name: 'Mokobara', url: 'mokobara.com' },
];

const SCAN_CAT_PRIORITY = [
  'Ecommerce', 'Ecommerce Platform', 'CMS', 'JavaScript frameworks', 'UI frameworks',
  'JavaScript libraries', 'Analytics', 'Payment processors', 'Live chat',
  'Customer support', 'Customer engagement', 'CDN', 'SEO', 'Tag managers',
  'Marketing automation', 'Advertising', 'Security', 'Performance',
  'Retargeting', 'A/B testing', 'Cart abandonment', 'Personalisation',
  'Push notifications', 'Email', 'Reviews', 'Loyalty & rewards',
  'Buy now, pay later', 'Cookie compliance', 'Accessibility',
  'Hosting', 'Font scripts', 'Maps', 'Video players',
];
const SCAN_CAT_SET = new Set(SCAN_CAT_PRIORITY.map(c => c.toLowerCase()));

/* Category → icon SVG + color mapping */
const CAT_ICON_MAP: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  'ecommerce':            { icon: <ShoppingCart size={15} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'ecommerce platform':   { icon: <Store size={15} />,         color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'cms':                  { icon: <Layers size={15} />,         color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'javascript frameworks':{ icon: <Code size={15} />,           color: 'text-yellow-500',  bg: 'bg-yellow-500/10' },
  'ui frameworks':        { icon: <Code size={15} />,           color: 'text-violet-500',  bg: 'bg-violet-500/10' },
  'javascript libraries': { icon: <Code size={15} />,           color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  'analytics':            { icon: <TrendingUp size={15} />,     color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'payment processors':   { icon: <DollarSign size={15} />,     color: 'text-green-500',   bg: 'bg-green-500/10' },
  'live chat':            { icon: <MessageCircle size={15} />,  color: 'text-cyan-500',    bg: 'bg-cyan-500/10' },
  'customer support':     { icon: <MessageCircle size={15} />,  color: 'text-cyan-500',    bg: 'bg-cyan-500/10' },
  'customer engagement':  { icon: <Users size={15} />,          color: 'text-pink-500',    bg: 'bg-pink-500/10' },
  'cdn':                  { icon: <Globe size={15} />,          color: 'text-sky-500',     bg: 'bg-sky-500/10' },
  'seo':                  { icon: <Search size={15} />,         color: 'text-lime-500',    bg: 'bg-lime-500/10' },
  'tag managers':         { icon: <Tag size={15} />,            color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  'marketing automation': { icon: <Zap size={15} />,            color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10' },
  'advertising':          { icon: <Megaphone size={15} />,      color: 'text-rose-500',    bg: 'bg-rose-500/10' },
  'security':             { icon: <Shield size={15} />,         color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'performance':          { icon: <Gauge size={15} />,          color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  'retargeting':          { icon: <Target size={15} />,         color: 'text-rose-500',    bg: 'bg-rose-500/10' },
  'a/b testing':          { icon: <FlaskConical size={15} />,   color: 'text-violet-500',  bg: 'bg-violet-500/10' },
  'cart abandonment':     { icon: <ShoppingCart size={15} />,    color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  'personalisation':      { icon: <Sparkles size={15} />,       color: 'text-purple-500',  bg: 'bg-purple-500/10' },
  'push notifications':   { icon: <Bell size={15} />,           color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  'email':                { icon: <Mail size={15} />,           color: 'text-sky-500',     bg: 'bg-sky-500/10' },
  'reviews':              { icon: <Star size={15} />,           color: 'text-yellow-500',  bg: 'bg-yellow-500/10' },
  'loyalty & rewards':    { icon: <Gift size={15} />,           color: 'text-pink-500',    bg: 'bg-pink-500/10' },
  'buy now, pay later':   { icon: <DollarSign size={15} />,     color: 'text-teal-500',    bg: 'bg-teal-500/10' },
  'cookie compliance':    { icon: <Shield size={15} />,         color: 'text-slate-500',   bg: 'bg-slate-500/10' },
  'accessibility':        { icon: <Eye size={15} />,            color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  'hosting':              { icon: <Server size={15} />,         color: 'text-gray-500',    bg: 'bg-gray-500/10' },
  'font scripts':         { icon: <Type size={15} />,           color: 'text-neutral-500', bg: 'bg-neutral-500/10' },
  'maps':                 { icon: <MapPin size={15} />,         color: 'text-red-500',     bg: 'bg-red-500/10' },
  'video players':        { icon: <Play size={15} />,           color: 'text-red-500',     bg: 'bg-red-500/10' },
  'ssl/tls certificate authorities': { icon: <Shield size={15} />, color: 'text-green-500', bg: 'bg-green-500/10' },
  'web servers':          { icon: <Server size={15} />,         color: 'text-slate-500',   bg: 'bg-slate-500/10' },
  'wordpress plugins':    { icon: <Layers size={15} />,         color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'shopify apps':         { icon: <Store size={15} />,          color: 'text-green-500',   bg: 'bg-green-500/10' },
  'surveys':              { icon: <ClipboardList size={15} />,  color: 'text-teal-500',    bg: 'bg-teal-500/10' },
  // Additional categories from detection catalog
  'analytics & behavior':  { icon: <TrendingUp size={15} />,    color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'analytics & optimization platform': { icon: <TrendingUp size={15} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  'authentication':       { icon: <KeyRound size={15} />,       color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  'booking & scheduling': { icon: <Calendar size={15} />,       color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  'buy now pay later':    { icon: <CreditCard size={15} />,     color: 'text-teal-500',    bg: 'bg-teal-500/10' },
  'cdn & infrastructure': { icon: <Globe size={15} />,          color: 'text-sky-500',     bg: 'bg-sky-500/10' },
  'customer engagement / crm': { icon: <Users size={15} />,     color: 'text-pink-500',    bg: 'bg-pink-500/10' },
  'databases':            { icon: <Database size={15} />,       color: 'text-slate-500',   bg: 'bg-slate-500/10' },
  'payments & checkout - checkout / bnpl': { icon: <CreditCard size={15} />, color: 'text-green-500', bg: 'bg-green-500/10' },
  'payments & checkout - gateway': { icon: <DollarSign size={15} />, color: 'text-green-500', bg: 'bg-green-500/10' },
  'returns':              { icon: <RotateCcw size={15} />,      color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  'search':               { icon: <Search size={15} />,         color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'shipping':             { icon: <Truck size={15} />,          color: 'text-sky-500',     bg: 'bg-sky-500/10' },
  'social proof':         { icon: <MousePointerClick size={15} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  'store locator':        { icon: <MapPin size={15} />,         color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'subscription':         { icon: <Repeat size={15} />,         color: 'text-violet-500',  bg: 'bg-violet-500/10' },
  'tag manager':          { icon: <Tag size={15} />,            color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  'web servers & runtime':{ icon: <Server size={15} />,         color: 'text-slate-500',   bg: 'bg-slate-500/10' },
  'programming languages':{ icon: <Code size={15} />,           color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  'operating systems':    { icon: <Server size={15} />,         color: 'text-gray-500',    bg: 'bg-gray-500/10' },
  'caching':              { icon: <Gauge size={15} />,          color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  'search engines':       { icon: <Search size={15} />,         color: 'text-blue-500',    bg: 'bg-blue-500/10' },
};

const DEFAULT_CAT_ICON = { icon: <Code size={15} />, color: 'text-neutral-500', bg: 'bg-neutral-500/10' };

function getCatIcon(category: string) {
  return CAT_ICON_MAP[category.toLowerCase()] || DEFAULT_CAT_ICON;
}

/* Derive a plausible domain for any tech name (fallback for unknown techs) */
function guessTechDomain(name: string): string {
  const n = name.toLowerCase()
    .replace(/\s*\(.*\)$/, '')          // Remove parenthetical
    .replace(/\./g, '')                 // Remove dots (e.g. "D3.js" → "d3js")
    .replace(/\s+/g, '')               // Remove spaces
    .replace(/[^a-z0-9]/g, '');        // Remove special chars
  return `${n}.com`;
}

/* TechPill: renders a single technology with its favicon icon */
function TechPill({ tech }: { tech: ScanTech }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoDomain = TECH_LOGO_MAP[tech.name];
  const fallbackDomain = !logoDomain ? guessTechDomain(tech.name) : null;
  const iconUrl = logoDomain
    ? `https://www.google.com/s2/favicons?domain=${logoDomain}&sz=32`
    : `https://www.google.com/s2/favicons?domain=${fallbackDomain}&sz=32`;

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[12px] font-medium text-slate-700 dark:text-neutral-200 hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors">
      {!imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          className="w-4 h-4 rounded-sm flex-shrink-0"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="w-3.5 h-3.5 rounded flex-shrink-0" style={{ backgroundColor: tech.color }} />
      )}
      {tech.name}
    </span>
  );
}

/* Known tech → logo URL (favicon from known domains) */
const TECH_LOGO_MAP: Record<string, string> = {
  // Ecommerce Platforms
  'Shopify': 'cdn.shopify.com', 'WooCommerce': 'woocommerce.com', 'Magento': 'magento.com',
  'BigCommerce': 'bigcommerce.com', 'VTEX': 'vtex.com', 'Wix': 'wix.com',
  'Squarespace': 'squarespace.com', 'PrestaShop': 'prestashop.com', 'OpenCart': 'opencart.com',
  'Shopware': 'shopware.com', 'Ecwid': 'ecwid.com', 'Volusion': 'volusion.com',
  'Shopline': 'shoplineapp.com', 'Dukaan': 'mydukaan.io', 'Nuvemshop': 'nuvemshop.com',
  'Shift4Shop': 'shift4shop.com', 'Salesforce Commerce Cloud': 'salesforce.com',
  'SAP Commerce Cloud': 'sap.com', 'Commercetools': 'commercetools.com',
  // CMS
  'WordPress': 'wordpress.org', 'Drupal': 'drupal.org', 'Joomla': 'joomla.org',
  'Contentful': 'contentful.com', 'Strapi': 'strapi.io', 'Ghost': 'ghost.org',
  'Webflow': 'webflow.com', 'Gatsby': 'gatsbyjs.com', 'Hugo': 'gohugo.io',
  'Sanity': 'sanity.io', 'Prismic': 'prismic.io', 'Storyblok': 'storyblok.com',
  'DatoCMS': 'datocms.com', 'Sitecore': 'sitecore.com', 'Kentico': 'kentico.com',
  'Adobe Experience Manager': 'adobe.com', 'HubSpot CMS Hub': 'hubspot.com',
  // JS Frameworks
  'React': 'react.dev', 'Next.js': 'nextjs.org', 'Vue.js': 'vuejs.org',
  'Angular': 'angular.io', 'Svelte': 'svelte.dev', 'Nuxt.js': 'nuxt.com',
  'Remix': 'remix.run', 'Astro': 'astro.build', 'Ember.js': 'emberjs.com',
  'Solid.js': 'solidjs.com', 'Qwik': 'qwik.builder.io', 'Preact': 'preactjs.com',
  'Alpine.js': 'alpinejs.dev', 'HTMX': 'htmx.org', 'SvelteKit': 'kit.svelte.dev',
  // UI Frameworks
  'Bootstrap': 'getbootstrap.com', 'Tailwind CSS': 'tailwindcss.com',
  'Material UI': 'mui.com', 'Chakra UI': 'chakra-ui.com', 'Ant Design': 'ant.design',
  'Bulma': 'bulma.io', 'Foundation': 'get.foundation', 'Mantine': 'mantine.dev',
  'DaisyUI': 'daisyui.com', 'Flowbite': 'flowbite.com', 'Shoelace': 'shoelace.style',
  // JS Libraries
  'jQuery': 'jquery.com', 'Lodash': 'lodash.com', 'D3.js': 'd3js.org',
  'GSAP': 'gsap.com', 'Axios': 'axios-http.com', 'Chart.js': 'chartjs.org',
  'Moment.js': 'momentjs.com', 'Three.js': 'threejs.org', 'Socket.io': 'socket.io',
  // Analytics
  'Google Analytics': 'analytics.google.com', 'Google Tag Manager': 'tagmanager.google.com',
  'Mixpanel': 'mixpanel.com', 'Amplitude': 'amplitude.com', 'Heap': 'heap.io',
  'Hotjar': 'hotjar.com', 'Microsoft Clarity': 'clarity.microsoft.com',
  'Segment': 'segment.com', 'PostHog': 'posthog.com', 'Plausible': 'plausible.io',
  'Matomo': 'matomo.org', 'Crazy Egg': 'crazyegg.com', 'Fathom': 'usefathom.com',
  'Contentsquare': 'contentsquare.com', 'FullStory': 'fullstory.com',
  'Lucky Orange': 'luckyorange.com', 'Mouseflow': 'mouseflow.com',
  'LogRocket': 'logrocket.com', 'Smartlook': 'smartlook.com',
  'Kissmetrics': 'kissmetrics.io', 'Pendo': 'pendo.io',
  // Payments
  'Stripe': 'stripe.com', 'Razorpay': 'razorpay.com', 'PayPal': 'paypal.com',
  'Adyen': 'adyen.com', 'Braintree': 'braintreepayments.com', 'Square': 'squareup.com',
  'Cashfree': 'cashfree.com', 'Paytm': 'paytm.com', 'PhonePe': 'phonepe.com',
  'Google Pay': 'pay.google.com', 'Apple Pay': 'apple.com', 'Amazon Pay': 'pay.amazon.com',
  'Mollie': 'mollie.com', 'CCAvenue': 'ccavenue.com', 'PayU': 'payu.in',
  'Juspay': 'juspay.in', 'Instamojo': 'instamojo.com', 'BillDesk': 'billdesk.com',
  'Checkout.com': 'checkout.com', 'Shop Pay': 'shop.app', 'Shopify Payments': 'shopify.com',
  // BNPL
  'Klarna': 'klarna.com', 'Afterpay': 'afterpay.com', 'Affirm': 'affirm.com',
  'Sezzle': 'sezzle.com', 'Splitit': 'splitit.com', 'Tabby': 'tabby.ai',
  'Simpl': 'getsimpl.com', 'LazyPay': 'lazypay.in', 'ZestMoney': 'zestmoney.in',
  // Live Chat & Support
  'Intercom': 'intercom.com', 'Zendesk': 'zendesk.com', 'Freshdesk': 'freshdesk.com',
  'Tawk.to': 'tawk.to', 'Drift': 'drift.com', 'LiveChat': 'livechat.com',
  'Crisp': 'crisp.chat', 'Tidio': 'tidio.com', 'Freshchat': 'freshworks.com',
  'Gorgias': 'gorgias.com', 'Olark': 'olark.com', 'Smartsupp': 'smartsupp.com',
  'HelpScout Beacon': 'helpscout.com', 'JivoChat': 'jivochat.com',
  'Chatwoot': 'chatwoot.com', 'Pure Chat': 'purechat.com',
  'Yellow.ai': 'yellow.ai', 'Haptik': 'haptik.ai', 'Verloop': 'verloop.io',
  // Customer Engagement & CRM
  'CleverTap': 'clevertap.com', 'MoEngage': 'moengage.com', 'WebEngage': 'webengage.com',
  'HubSpot': 'hubspot.com', 'Salesforce': 'salesforce.com', 'Braze': 'braze.com',
  'Insider': 'useinsider.com', 'Iterable': 'iterable.com', 'Customer.io': 'customer.io',
  'Drip': 'drip.com', 'ActiveCampaign': 'activecampaign.com',
  'Zoho CRM': 'zoho.com', 'Pipedrive': 'pipedrive.com',
  // CDN
  'Cloudflare': 'cloudflare.com', 'Fastly': 'fastly.com', 'Akamai': 'akamai.com',
  'AWS CloudFront': 'aws.amazon.com', 'Bunny CDN': 'bunny.net',
  'KeyCDN': 'keycdn.com', 'StackPath': 'stackpath.com', 'Imgix': 'imgix.com',
  // SEO
  'Yoast SEO': 'yoast.com', 'Rank Math': 'rankmath.com',
  'All in One SEO': 'aioseo.com', 'SEOPress': 'seopress.org',
  // Tag Managers
  'Adobe Launch': 'adobe.com', 'Tealium': 'tealium.com', 'Ensighten': 'ensighten.com',
  // Marketing Automation
  'Klaviyo': 'klaviyo.com', 'Mailchimp': 'mailchimp.com', 'Marketo': 'marketo.com',
  'Pardot': 'pardot.com', 'Brevo': 'brevo.com', 'SendGrid': 'sendgrid.com',
  'ConvertKit': 'convertkit.com', 'Omnisend': 'omnisend.com',
  'GetResponse': 'getresponse.com', 'AWeber': 'aweber.com',
  'Constant Contact': 'constantcontact.com', 'MailerLite': 'mailerlite.com',
  'Campaign Monitor': 'campaignmonitor.com', 'Postscript': 'postscript.io',
  'Attentive': 'attentive.com', 'Dotdigital': 'dotdigital.com',
  // Advertising
  'Google Ads': 'ads.google.com', 'Meta Pixel': 'facebook.com', 'Facebook Pixel': 'facebook.com',
  'TikTok Pixel': 'tiktok.com', 'Snapchat Pixel': 'snapchat.com',
  'Pinterest Tag': 'pinterest.com', 'Twitter Pixel': 'twitter.com',
  'LinkedIn Insight Tag': 'linkedin.com', 'Criteo': 'criteo.com',
  'Taboola': 'taboola.com', 'Outbrain': 'outbrain.com', 'AdRoll': 'adroll.com',
  'Reddit Pixel': 'reddit.com', 'Quora Pixel': 'quora.com',
  // A/B Testing
  'Optimizely': 'optimizely.com', 'VWO': 'vwo.com', 'LaunchDarkly': 'launchdarkly.com',
  'AB Tasty': 'abtasty.com', 'Convert Experiences': 'convert.com',
  'Google Optimize': 'optimize.google.com', 'Dynamic Yield': 'dynamicyield.com',
  // Reviews
  'Yotpo': 'yotpo.com', 'Judge.me': 'judge.me', 'Loox': 'loox.app',
  'Trustpilot': 'trustpilot.com', 'Bazaarvoice': 'bazaarvoice.com',
  'Stamped.io': 'stamped.io', 'PowerReviews': 'powerreviews.com',
  'Feefo': 'feefo.com', 'Okendo': 'okendo.io', 'Junip': 'junip.co',
  // Loyalty
  'Smile.io': 'smile.io', 'LoyaltyLion': 'loyaltylion.com',
  'Yotpo Loyalty': 'yotpo.com', 'Growave': 'growave.io',
  'Zinrelo': 'zinrelo.com', 'Antavo': 'antavo.com',
  // Push Notifications
  'OneSignal': 'onesignal.com', 'PushOwl': 'pushowl.com',
  'PushEngage': 'pushengage.com', 'Pushwoosh': 'pushwoosh.com',
  'iZooto': 'izooto.com',
  // Security
  'reCAPTCHA': 'google.com', 'hCaptcha': 'hcaptcha.com',
  'Sucuri': 'sucuri.net', 'Wordfence': 'wordfence.com',
  'Imperva': 'imperva.com', 'Turnstile': 'cloudflare.com',
  // Performance & Monitoring
  'Sentry': 'sentry.io', 'Datadog RUM': 'datadoghq.com', 'New Relic': 'newrelic.com',
  'Dynatrace': 'dynatrace.com', 'SpeedCurve': 'speedcurve.com',
  'Pingdom': 'pingdom.com', 'Raygun': 'raygun.com',
  // Shipping
  'Shiprocket': 'shiprocket.in', 'AfterShip': 'aftership.com',
  'ShipStation': 'shipstation.com', 'Delhivery': 'delhivery.com',
  'Narvar': 'narvar.com', 'EasyPost': 'easypost.com', 'Shippo': 'goshippo.com',
  'Nimbuspost': 'nimbuspost.com', 'Clickpost': 'clickpost.ai',
  // Returns
  'Loop Returns': 'loopreturns.com', 'Returnly': 'returnly.com',
  'Happy Returns': 'happyreturns.com', 'AfterShip Returns': 'aftership.com',
  // Search
  'Algolia': 'algolia.com', 'Elasticsearch': 'elastic.co',
  'Searchspring': 'searchspring.com', 'Klevu': 'klevu.com',
  'Constructor.io': 'constructor.io', 'Doofinder': 'doofinder.com',
  'Typesense': 'typesense.org', 'Swiftype': 'swiftype.com',
  // Personalization
  'Nosto': 'nosto.com',
  'Monetate': 'monetate.com', 'Fresh Relevance': 'freshrelevance.com',
  // Hosting & Infrastructure
  'Vercel': 'vercel.com', 'Netlify': 'netlify.com', 'Heroku': 'heroku.com',
  'DigitalOcean': 'digitalocean.com', 'AWS': 'aws.amazon.com',
  'Google Cloud': 'cloud.google.com', 'Fly.io': 'fly.io',
  'Railway': 'railway.app', 'Render': 'render.com',
  // Servers
  'Nginx': 'nginx.org', 'Apache': 'apache.org', 'LiteSpeed': 'litespeedtech.com',
  'Node.js': 'nodejs.org', 'OpenResty': 'openresty.org',
  // Cookie & Compliance
  'OneTrust': 'onetrust.com', 'CookieYes': 'cookieyes.com',
  'Cookiebot': 'cookiebot.com', 'Iubenda': 'iubenda.com',
  'Osano': 'osano.com', 'Termly': 'termly.io', 'TrustArc': 'trustarc.com',
  // Subscription
  'ReCharge': 'rechargepayments.com', 'Chargebee': 'chargebee.com',
  'Recurly': 'recurly.com', 'Zuora': 'zuora.com', 'Bold Subscriptions': 'boldcommerce.com',
  // Social Proof
  'FOMO': 'fomo.com', 'ProveSource': 'provesource.com', 'Nudgify': 'nudgify.com',
  'TrustPulse': 'trustpulse.com',
  // Booking
  'Calendly': 'calendly.com', 'Acuity Scheduling': 'acuityscheduling.com',
  'SimplyBook.me': 'simplybook.me',
  // Auth
  'Auth0': 'auth0.com', 'Okta': 'okta.com', 'Firebase': 'firebase.google.com',
  'Google Sign-In': 'google.com', 'Facebook Login': 'facebook.com',
  // Video
  'Vimeo': 'vimeo.com', 'Wistia': 'wistia.com', 'Brightcove': 'brightcove.com',
  'JW Player': 'jwplayer.com', 'Vidyard': 'vidyard.com',
  // Maps
  'Google Maps': 'maps.google.com', 'Mapbox': 'mapbox.com',
  'Leaflet': 'leafletjs.com', 'HERE Maps': 'here.com',
  // Fonts
  'Google Fonts': 'fonts.google.com', 'Adobe Fonts': 'fonts.adobe.com',
  'Font Awesome': 'fontawesome.com',
  // Surveys
  'Typeform': 'typeform.com', 'SurveyMonkey': 'surveymonkey.com',
  'Qualtrics': 'qualtrics.com', 'Hotjar Surveys': 'hotjar.com',
  // Accessibility
  'AccessiBe': 'accessibe.com', 'UserWay': 'userway.org',
  'AudioEye': 'audioeye.com', 'EqualWeb': 'equalweb.com',
  // Misc popular
  'WhatsApp Business Chat': 'whatsapp.com', 'WhatsApp Chat Widget': 'whatsapp.com',
  'Twilio': 'twilio.com', 'Sprinklr': 'sprinklr.com',
  // Indian D2C / India-specific
  'GoKwik': 'gokwik.co', 'BiteSpeed': 'bitespeed.co', 'Contlo': 'contlo.com',
  'Wigzo': 'wigzo.com', 'Aisensy': 'aisensy.com', 'Wati': 'wati.io',
  'Gupshup': 'gupshup.io', 'Interakt': 'interakt.shop', 'Route Mobile': 'routemobile.com',
  'MSG91': 'msg91.com', 'Exotel': 'exotel.com', 'Kaleyra': 'kaleyra.com',
  'Knowlarity': 'knowlarity.com', 'Zoko': 'zoko.io', 'DelightChat': 'delightchat.io',
  'Gallabox': 'gallabox.com', 'Shopflo': 'shopflo.com', 'Unicommerce': 'unicommerce.com',
  'Vinculum': 'vinculum.in', 'Lemnisk': 'lemnisk.co',
  'Mobikwik PG': 'mobikwik.com', 'Cred Pay': 'cred.club', 'MagicPin Pay': 'magicpin.com',
  'Easebuzz': 'easebuzz.in', 'Open Financial': 'open.money',
  'Capital Float': 'capitalfloat.com', 'Kissht': 'kissht.com',
  'Snapmint': 'snapmint.com', 'FlexiPay': 'flexipay.com',
  // Alternate spellings / variants
  'Clevertap': 'clevertap.com', 'Moengage': 'moengage.com',
  'Facebook Ads': 'facebook.com',
  'Facebook Retargeting': 'facebook.com',
  'Google Remarketing': 'google.com', 'Google Search Console': 'search.google.com',
  'Google AdSense': 'adsense.google.com', 'Google Ad Manager': 'admanager.google.com',
  'Google Cloud CDN': 'cloud.google.com',
  'Google Sites': 'sites.google.com',
  'Shopify Checkout': 'shopify.com',
  'Criteo Retargeting': 'criteo.com', 'Barilliance Recommendations': 'barilliance.com',
  'Barilliance': 'barilliance.com',
  'Datadog': 'datadoghq.com',
  'AngularJS': 'angularjs.org', 'Backbone.js': 'backbonejs.org',
  'Knockout.js': 'knockoutjs.com', 'Inferno': 'infernojs.org',
  'Popper.js': 'popper.js.org', 'RequireJS': 'requirejs.org',
  'Lottie': 'airbnb.io', 'Particles.js': 'vincentgarreau.com',
  'core-js': 'github.com', 'Modernizr': 'modernizr.com',
  'Underscore.js': 'underscorejs.org', 'Hammer.js': 'hammerjs.github.io',
  'AOS': 'michalsnik.github.io', 'Anime.js': 'animejs.com',
  'Highlight.js': 'highlightjs.org', 'KaTeX': 'katex.org', 'MathJax': 'mathjax.org',
  'Prism': 'prismjs.com', 'PDF.js': 'mozilla.github.io',
  'WP Rocket': 'wp-rocket.me', 'WP Super Cache': 'wordpress.org',
  'W3 Total Cache': 'wordpress.org', 'LiteSpeed Cache': 'litespeedtech.com',
  'Jetpack': 'jetpack.com', 'Elementor': 'elementor.com',
  'WPBakery': 'wpbakery.com', 'Divi Builder': 'elegantthemes.com',
  'Advanced Custom Fields': 'advancedcustomfields.com',
  'Contact Form 7': 'contactform7.com', 'WPForms': 'wpforms.com',
  'Gravity Forms': 'gravityforms.com',
  'Akamai CDN': 'akamai.com', 'Akamai Bot Manager': 'akamai.com',
  'Azure CDN': 'azure.microsoft.com', 'PerimeterX': 'perimeterx.com',
  'VWO Engage': 'vwo.com', 'Yotpo SMSBump': 'yotpo.com',
  'Salesforce Live Agent': 'salesforce.com', 'Salesforce Marketing Cloud': 'salesforce.com',
  'Zendesk Chat': 'zendesk.com', 'Zoho SalesIQ': 'zoho.com',
  'Zoho Desk': 'zoho.com', 'Zoho Campaigns': 'zoho.com',
  'Freshmarketer': 'freshworks.com', 'Freshsales': 'freshworks.com',
  'Freshservice': 'freshworks.com',
  'Supabase': 'supabase.com', 'Medusa': 'medusajs.com',
  'three.js': 'threejs.org', 'PixiJS': 'pixijs.com',
  'Swiper': 'swiperjs.com', 'Slick': 'kenwheeler.github.io',
  'Masonry': 'masonry.desandro.com', 'Isotope': 'isotope.metafizzy.co',
  'Lazysizes': 'github.com', 'Dropzone.js': 'dropzone.dev',
  'SweetAlert': 'sweetalert.js.org', 'Tippy.js': 'atomiks.github.io',
  'Typed.js': 'mattboldt.com', 'ScrollMagic': 'scrollmagic.io',
  'FullPage.js': 'alvarotrigo.com', 'Fancybox': 'fancyapps.com',
  'Flickity': 'flickity.metafizzy.co', 'Clipboard.js': 'clipboardjs.com',
  'Howler.js': 'howlerjs.com',
  // Store locators
  'Bold Store Locator': 'boldcommerce.com', 'Stockist': 'stockist.co',
  'Locally.io': 'locally.io', 'Bullseye Locations': 'bullseyelocations.com',
  'Storepoint': 'storepoint.co', 'StoreRocket': 'storerocket.io',
  // Misc
  'Unbounce': 'unbounce.com', 'Instapage': 'instapage.com',
  'Leadpages': 'leadpages.com', 'ClickFunnels': 'clickfunnels.com',
  'OptiMonk': 'optimonk.com', 'Privy': 'privy.com', 'Justuno': 'justuno.com',
  'Sumo': 'sumo.com', 'Hello Bar': 'hellobar.com', 'Wisepops': 'wisepops.com',
  'ConvertFlow': 'convertflow.com', 'Sleeknote': 'sleeknote.com',
  'Recart': 'recart.com', 'Extole': 'extole.com', 'ReferralCandy': 'referralcandy.com',
  'Talkable': 'talkable.com', 'Friendbuy': 'friendbuy.com',
  'Impact.com': 'impact.com', 'AppsFlyer': 'appsflyer.com',
  'Branch': 'branch.io', 'Adjust': 'adjust.com',
  'Rebuy': 'rebuy.com', 'ReConvert': 'reconvert.io',
  'GemPages': 'gempages.net', 'PageFly': 'pagefly.io', 'Shogun': 'getshogun.com',
  'Vitals': 'vitals.co',
};

function scanSortCategories(grouped: Record<string, ScanTech[]>): string[] {
  const all = Object.keys(grouped);
  const lower = new Map(all.map(c => [c.toLowerCase(), c]));
  const priority: string[] = [];
  for (const p of SCAN_CAT_PRIORITY) {
    const actual = lower.get(p.toLowerCase());
    if (actual) priority.push(actual);
  }
  const rest = all.filter(c => !SCAN_CAT_SET.has(c.toLowerCase())).sort((a, b) => a.localeCompare(b));
  return [...priority, ...rest];
}

function TechScannerView({ initialDomain = '' }: { initialDomain?: string }) {
  const [scanInput, setScanInput] = useState(initialDomain);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanDomain, setScanDomain] = useState('');
  const [metaLoading, setMetaLoading] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<{ domain: string; techCount: number; category: string; ts: number }[]>([]);
  const autoScanned = useRef(false);

  // Load scan history from localStorage
  useEffect(() => {
    try {
      const h = localStorage.getItem('harvin_scan_history');
      if (h) setScanHistory(JSON.parse(h));
    } catch {}
  }, []);

  // Auto-scan if initialDomain is provided (from URL param or deep link)
  useEffect(() => {
    if (initialDomain && !autoScanned.current) {
      autoScanned.current = true;
      runScan(initialDomain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDomain]);

  const saveScanHistory = (domain: string, result: ScanResult) => {
    const entry = {
      domain,
      techCount: result.count,
      category: result.companyMeta?.category || 'Unknown',
      ts: Date.now(),
    };
    setScanHistory(prev => {
      const filtered = prev.filter(h => h.domain !== domain);
      const next = [entry, ...filtered].slice(0, 10);
      try { localStorage.setItem('harvin_scan_history', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const runScan = async (domain: string) => {
    if (!domain.trim()) return;
    const clean = domain.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
    setScanDomain(clean);
    setScanResult(null);
    setScanError(null);
    setScanning(true);
    setMetaLoading(false);
    setActiveCat(null);

    // Phase 1: Quick company meta lookup
    try {
      const metaRes = await fetch(`/api/company-meta?domain=${encodeURIComponent(clean)}`);
      const metaJson = await metaRes.json();
      if (metaJson.found && metaJson.data) {
        setScanResult({
          url: clean,
          technologies: [],
          count: 0,
          companyMeta: {
            category: metaJson.data.category || '',
            subCategory: metaJson.data.subCategory || '',
            region: metaJson.data.region || '',
            offlineStores: metaJson.data.offlineStores || '',
          },
        });
        setMetaLoading(true);
      }
    } catch {}

    // Phase 2: Full tech scan
    try {
      const res = await fetch(`/api/detect?url=${encodeURIComponent(clean)}`);
      const text = await res.text();
      if (!text) throw new Error('No response from server');
      let data: ScanResult;
      try { data = JSON.parse(text); } catch { throw new Error('Unexpected response'); }
      if (!res.ok) throw new Error((data as unknown as { error: string }).error || 'Detection failed');

      setScanResult(prev => {
        if (!data.companyMeta && prev?.companyMeta) data.companyMeta = prev.companyMeta;
        return data;
      });
      saveScanHistory(clean, data);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setScanning(false);
      setMetaLoading(false);
    }
  };

  const grouped = scanResult ? scanResult.technologies.reduce<Record<string, ScanTech[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {}) : {};
  const categories = scanSortCategories(grouped);
  const filteredCats = activeCat ? categories.filter(c => c === activeCat) : categories;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Scanner input card */}
      <div className="relative">
        <div className="absolute -inset-2 rounded-[24px] bg-gradient-to-r from-[#C94C1E]/10 via-amber-500/5 to-[#C94C1E]/10 blur-xl opacity-60 pointer-events-none" />
        <div className="relative bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm dark:shadow-none">
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C94C1E]/10 text-[#C94C1E] text-[12px] font-semibold mb-3">
              <Radar size={14} />
              Tech Scanner
            </div>
            <h2 className="text-[20px] font-bold text-slate-800 dark:text-white tracking-[-0.02em] mb-1">
              Scan any D2C brand instantly
            </h2>
            <p className="text-[13px] text-slate-400 dark:text-neutral-500 max-w-md mx-auto">
              Enter a domain to detect its full tech stack, company info, store count and more.
            </p>
          </div>

          {/* Search form */}
          <form onSubmit={e => { e.preventDefault(); runScan(scanInput); }}
            className="flex items-center gap-3 p-2 max-w-2xl mx-auto rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus-within:border-[#C94C1E]/60 focus-within:shadow-[0_0_0_3px_rgba(201,76,30,0.1)] focus-within:bg-white dark:focus-within:bg-[#1a1a1a] transition-all duration-200">
            <div className="pl-2 flex-shrink-0">
              <svg className="w-5 h-5 text-slate-400 dark:text-neutral-500" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 2c-2 2-3 5-3 8s1 6 3 8M10 2c2 2 3 5 3 8s-1 6-3 8M2 10h16" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <input
              type="text"
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder="e.g. mamaearth.in or boat-lifestyle.com"
              className="flex-1 bg-transparent outline-none text-[15px] text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 min-w-0"
            />
            <button type="submit" disabled={!scanInput.trim() || scanning}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[14px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_2px_8px_rgba(201,76,30,0.3)]">
              {scanning ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
              {scanning ? 'Scanning...' : 'Scan'}
            </button>
          </form>

          {/* Quick scan buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[12px] text-slate-400 dark:text-neutral-500">Try:</span>
            {SCAN_DEMO_BRANDS.map(b => (
              <button key={b.url} type="button"
                onClick={() => { setScanInput(b.url); runScan(b.url); }}
                className="text-[12px] font-medium text-slate-500 dark:text-neutral-400 hover:text-[#C94C1E] dark:hover:text-[#C94C1E] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-[#C94C1E]/5 dark:hover:bg-[#C94C1E]/10 transition-all">
                {b.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scanning animation */}
      {scanning && !scanResult && (
        <div className="flex flex-col items-center py-16">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-white/[0.08]" />
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#C94C1E] animate-spin" />
          </div>
          <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white mb-2">
            Scanning {scanDomain}
          </h3>
          <p className="text-[13px] text-slate-400 dark:text-neutral-500">
            Detecting technologies, store data, and company info...
          </p>
          <div className="mt-5 w-64 h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-[#C94C1E] animate-[scan_1.8s_ease-in-out_infinite] w-1/3" />
          </div>
        </div>
      )}

      {/* Company meta while tech loads */}
      {scanResult && metaLoading && scanResult.companyMeta && (
        <div>
          <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <img src={`https://www.google.com/s2/favicons?domain=${scanDomain}&sz=64`} alt="" className="w-8 h-8 rounded-lg"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">{domainToName(scanDomain)}</h3>
                <p className="text-[12px] text-slate-400 dark:text-neutral-500 font-mono">{scanDomain}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { key: 'category' as const, label: 'Category' },
                { key: 'subCategory' as const, label: 'Sub-Category' },
                { key: 'region' as const, label: 'Region' },
                { key: 'offlineStores' as const, label: 'Stores' },
              ]).map(({ key, label }) => (
                <div key={key} className="bg-slate-50 dark:bg-white/[0.04] rounded-lg p-3">
                  <p className="text-[10px] font-bold text-[#C94C1E] uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-[13px] font-medium text-slate-700 dark:text-neutral-200">{scanResult.companyMeta![key] || '\u2014'}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center py-8">
            <div className="relative w-10 h-10 mb-3">
              <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 dark:border-white/[0.08]" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#C94C1E] animate-spin" />
            </div>
            <p className="text-[13px] text-slate-400 dark:text-neutral-500">Loading technologies...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {scanError && !scanning && (
        <div className="flex flex-col items-center py-12">
          <div className="w-14 h-14 mb-4 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <X size={24} className="text-red-400" />
          </div>
          <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white mb-2">Scan failed</h3>
          <p className="text-[13px] text-slate-400 dark:text-neutral-500 mb-4 max-w-md text-center">{scanError}</p>
          <button onClick={() => runScan(scanDomain)}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] transition-all">
            Retry scan
          </button>
        </div>
      )}

      {/* Full results */}
      {scanResult && !scanning && !metaLoading && scanResult.count > 0 && (
        <div className="space-y-5">
          {/* Results header */}
          <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={`https://www.google.com/s2/favicons?domain=${scanDomain}&sz=64`} alt="" className="w-10 h-10 rounded-lg border border-slate-200 dark:border-white/[0.08]"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div>
                  <h3 className="text-[17px] font-bold text-slate-800 dark:text-white">{domainToName(scanDomain)}</h3>
                  <p className="text-[12px] text-slate-400 dark:text-neutral-500">
                    <span className="font-mono text-[#C94C1E]">{scanDomain}</span>
                    {' '}&middot; <span className="font-semibold text-slate-600 dark:text-neutral-300">{scanResult.count} technologies</span> across <span className="font-semibold text-slate-600 dark:text-neutral-300">{categories.length} categories</span>
                  </p>
                </div>
              </div>
              <button onClick={() => { setScanResult(null); setScanDomain(''); setScanInput(''); }}
                className="text-[12px] font-medium text-slate-400 dark:text-neutral-500 hover:text-[#C94C1E] transition-colors flex items-center gap-1.5">
                <Radar size={14} /> New scan
              </button>
            </div>

            {/* Company meta */}
            {scanResult.companyMeta && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  { key: 'category' as const, label: 'Category' },
                  { key: 'subCategory' as const, label: 'Sub-Category' },
                  { key: 'region' as const, label: 'Region' },
                  { key: 'offlineStores' as const, label: 'Stores' },
                ]).map(({ key, label }) => (
                  <div key={key} className="bg-slate-50 dark:bg-white/[0.04] rounded-lg p-3">
                    <p className="text-[10px] font-bold text-[#C94C1E] uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-[13px] font-medium text-slate-700 dark:text-neutral-200">{scanResult.companyMeta![key] || '\u2014'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category filter pills with icons */}
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
            <div className="flex gap-2 w-max">
              <button onClick={() => setActiveCat(null)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all ${!activeCat ? 'bg-[#C94C1E] text-white shadow-sm shadow-[#C94C1E]/20' : 'bg-white dark:bg-white/[0.04] text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08]'}`}>
                <Layers size={14} />
                All
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${!activeCat ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-neutral-500'}`}>{scanResult.count}</span>
              </button>
              {categories.map(cat => {
                const ci = getCatIcon(cat);
                return (
                  <button key={cat} onClick={() => setActiveCat(activeCat === cat ? null : cat)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all ${activeCat === cat ? 'bg-[#C94C1E] text-white shadow-sm shadow-[#C94C1E]/20' : 'bg-white dark:bg-white/[0.04] text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08]'}`}>
                    <span className={activeCat === cat ? 'text-white' : ci.color}>{ci.icon}</span>
                    {cat}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${activeCat === cat ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-neutral-500'}`}>{grouped[cat].length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tech grid — category cards with icons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredCats.map(cat => {
              const ci = getCatIcon(cat);
              return (
                <div key={cat} className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden hover:border-slate-300 dark:hover:border-white/[0.12] hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all">
                  {/* Category header */}
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className={`w-8 h-8 rounded-lg ${ci.bg} flex items-center justify-center ${ci.color} flex-shrink-0`}>
                      {ci.icon}
                    </div>
                    <h4 className="text-[13px] font-bold text-slate-700 dark:text-neutral-200 leading-none">{cat}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-neutral-500">{grouped[cat].length}</span>
                  </div>
                  {/* Tech list */}
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {grouped[cat].map(tech => (
                        <TechPill key={tech.name} tech={tech} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty scan result */}
      {scanResult && !scanning && !metaLoading && scanResult.count === 0 && !scanError && scanResult.technologies.length === 0 && !metaLoading && (
        <div className="text-center py-12">
          <p className="text-[14px] text-slate-400 dark:text-neutral-500">
            No technologies detected — the site may block bots or require JavaScript to load.
          </p>
          <button onClick={() => runScan(scanDomain)}
            className="mt-4 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[#C94C1E] border border-[#C94C1E]/30 hover:bg-[#C94C1E]/5 transition-all">
            Retry scan
          </button>
        </div>
      )}

      {/* Recent scans (shown when no active scan) */}
      {!scanResult && !scanning && scanHistory.length > 0 && (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-[13px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest mb-4">Recent Scans</h3>
          <div className="space-y-1">
            {scanHistory.map(h => (
              <button key={h.domain} onClick={() => { setScanInput(h.domain); runScan(h.domain); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors text-left group">
                <img src={`https://www.google.com/s2/favicons?domain=${h.domain}&sz=64`} alt="" className="w-7 h-7 rounded-lg flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-700 dark:text-neutral-200 group-hover:text-[#C94C1E] transition-colors truncate">{h.domain}</p>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500">{h.category} &middot; {h.techCount} tech{h.techCount !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-[11px] text-slate-300 dark:text-neutral-600 flex-shrink-0">
                  {new Date(h.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <ExternalLink size={14} className="text-slate-300 dark:text-neutral-600 group-hover:text-[#C94C1E] transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
