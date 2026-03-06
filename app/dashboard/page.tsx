'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import {
  Zap, Search, ChevronDown, ChevronUp, X,
  ChevronLeft, ChevronRight, LayoutGrid, List,
  Filter, Check, ShieldCheck, Satellite, Target, Swords,
  Briefcase, Settings2, Link2, Lock, LogOut, ArrowUpDown,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
type User = { type: string; name: string; email: string };
type OnboardingAnswers = {
  geoFocus?: string[]; techCategories?: string[];
  brandTypes?: string[]; channelMix?: string[];
  companySize?: string[]; revenueRange?: string[];
  jobRole?: string; companyName?: string; persona?: string;
};
type Account = {
  id: string; name: string; category: string; geography: string;
  businessModel: string; scale: string; offlinePresence: string;
  appPresence: string; funding: string; ecommercePlatform: string;
  engagementCRM: string; payments: string; activeSignals: string[];
  description?: string; score: number; timeAgo: string;
  signalText: string; persona: { name: string; title: string; bio: string };
};
type Filters = {
  geography: string[]; category: string[]; businessModel: string[];
  scale: string[]; offlinePresence: string[]; appPresence: string[];
  funding: string[]; ecommercePlatform: string[]; engagementCRM: string[];
  payments: string[]; activeSignals: string[];
};
type SortKey = 'name' | 'category' | 'scale' | 'funding' | 'signals' | 'score';
type SidebarTab = 'market-intelligence' | 'account-explorer' | 'recently-funded' | 'competitor-clients' | 'current-clients' | 'icp-preferences' | 'integrations';

/* ── Constants ─────────────────────────────────────────────────────────── */
const FILTER_OPTIONS = {
  geography: ['India', 'Singapore', 'UAE', 'Indonesia'],
  category: ['Fashion & Apparel', 'Beauty & Personal Care', 'Food & Beverage', 'Health & Wellness', 'Home & Living', 'Electronics & Gadgets', 'Baby & Kids', 'Pet Care', 'Sports & Fitness', 'Jewellery & Accessories', 'Stationery & Gifting', 'Automotive Accessories'],
  businessModel: ['Pure D2C', 'Omnichannel', 'D2C + Marketplace', 'D2C + B2B'],
  scale: ['Emerging (<100K)', 'Growing (100K–500K)', 'Scaling (500K–2M)', 'Established (2M+)'],
  offlinePresence: ['Online Only', '1–10 stores', '10–50 stores', '50+ stores'],
  appPresence: ['No App', 'iOS Only', 'Android Only', 'Both iOS & Android'],
  funding: ['Bootstrapped', 'Seed / Angel', 'Series A+', 'Late Stage'],
  ecommercePlatform: ['Shopify', 'WooCommerce', 'Magento', 'Custom-built'],
  engagementCRM: ['CleverTap', 'MoEngage', 'WebEngage', 'Braze', 'Klaviyo', 'Mailchimp', 'None detected'],
  payments: ['Razorpay', 'Stripe', 'PayU', 'Cashfree'],
  activeSignals: ['Recently Funded', 'Store Expansion', 'App Launched', 'Key Hiring', 'Marketplace Expansion', 'High Growth'],
};
const CAT_SHOW = 5;
const PAGE_SIZE = 10;
const SCALE_ORDER = ['Emerging (<100K)', 'Growing (100K–500K)', 'Scaling (500K–2M)', 'Established (2M+)'];
const FUNDING_ORDER = ['Bootstrapped', 'Seed / Angel', 'Series A+', 'Late Stage'];

const TAB_TITLES: Record<SidebarTab, string> = {
  'market-intelligence': 'Market Intelligence',
  'account-explorer': 'Account Explorer',
  'recently-funded': 'Recently Funded',
  'competitor-clients': 'Competitor Clients',
  'current-clients': 'Current Clients',
  'icp-preferences': 'ICP & Preferences',
  'integrations': 'Integrations',
};

const DEMO_ACCOUNTS: Account[] = [
  { id: '1', name: 'Sugar Cosmetics', category: 'Beauty & Personal Care', geography: 'India', businessModel: 'D2C + Marketplace', scale: 'Scaling (500K–2M)', offlinePresence: '10–50 stores', appPresence: 'Both iOS & Android', funding: 'Series A+', ecommercePlatform: 'Shopify', engagementCRM: 'CleverTap', payments: 'Razorpay', activeSignals: ['Recently Funded'], score: 60, timeAgo: '2d ago', signalText: 'Raised $50M Series D from L Catterton', persona: { name: 'Vineeta Singh', title: 'CEO & Co-founder', bio: 'Post-funding decision maker — budget unlocked' }, description: 'Bold beauty for Indian millennials' },
  { id: '2', name: 'mCaffeine', category: 'Beauty & Personal Care', geography: 'India', businessModel: 'D2C + Marketplace', scale: 'Growing (100K–500K)', offlinePresence: '1–10 stores', appPresence: 'No App', funding: 'Seed / Angel', ecommercePlatform: 'Shopify', engagementCRM: 'MoEngage', payments: 'Razorpay', activeSignals: ['Key Hiring'], score: 64, timeAgo: '3d ago', signalText: 'Expanded to Blinkit & Zepto quick commerce', persona: { name: 'Tarun Sharma', title: 'Head of Ecommerce', bio: 'Driving quick commerce expansion — needs marketplace optimization' }, description: 'Caffeine-powered personal care' },
  { id: '3', name: 'Plum Goodness', category: 'Beauty & Personal Care', geography: 'India', businessModel: 'Pure D2C', scale: 'Established (2M+)', offlinePresence: '50+ stores', appPresence: 'Both iOS & Android', funding: 'Late Stage', ecommercePlatform: 'Custom-built', engagementCRM: 'CleverTap', payments: 'Razorpay', activeSignals: ['App Launched'], score: 58, timeAgo: '5d ago', signalText: 'Launched 10 new SKU in sustainable packaging', persona: { name: 'Shankar Prasad', title: 'Founder', bio: 'Focusing on high-margin vegan beauty segments' }, description: 'Toxin-free personal care' },
  { id: '4', name: 'Mokobara', category: 'Fashion & Apparel', geography: 'India', businessModel: 'Omnichannel', scale: 'Growing (100K–500K)', offlinePresence: '1–10 stores', appPresence: 'No App', funding: 'Seed / Angel', ecommercePlatform: 'Shopify', engagementCRM: 'MoEngage', payments: 'Razorpay', activeSignals: ['Key Hiring', 'Store Expansion'], score: 72, timeAgo: '1d ago', signalText: 'Hired VP of Growth from Myntra', persona: { name: 'Sangeet Agrawal', title: 'Co-founder', bio: 'Scaling offline retail rapidly — open to tech partnerships' }, description: 'Premium travel luggage & bags' },
  { id: '5', name: 'Mamaearth', category: 'Beauty & Personal Care', geography: 'India', businessModel: 'Omnichannel', scale: 'Established (2M+)', offlinePresence: '50+ stores', appPresence: 'Both iOS & Android', funding: 'Late Stage', ecommercePlatform: 'Custom-built', engagementCRM: 'MoEngage', payments: 'Razorpay', activeSignals: ['High Growth', 'Marketplace Expansion'], score: 88, timeAgo: '1d ago', signalText: 'Crossed $300M ARR — fastest in beauty category', persona: { name: 'Ghazal Alagh', title: 'Co-founder & CIO', bio: 'Post-IPO growth mode — evaluating new martech stack' }, description: 'Toxin-free personal care' },
  { id: '6', name: 'boAt', category: 'Electronics & Gadgets', geography: 'India', businessModel: 'D2C + Marketplace', scale: 'Established (2M+)', offlinePresence: 'Online Only', appPresence: 'Both iOS & Android', funding: 'Late Stage', ecommercePlatform: 'Shopify', engagementCRM: 'CleverTap', payments: 'Razorpay', activeSignals: ['High Growth'], score: 81, timeAgo: '4d ago', signalText: 'Launched new wearables vertical with 12 SKUs', persona: { name: 'Aman Gupta', title: 'Co-founder & CMO', bio: 'Aggressively expanding wearables — needs supply chain solutions' }, description: 'Audio wearables & lifestyle' },
  { id: '7', name: 'Licious', category: 'Food & Beverage', geography: 'India', businessModel: 'Pure D2C', scale: 'Scaling (500K–2M)', offlinePresence: '1–10 stores', appPresence: 'Both iOS & Android', funding: 'Series A+', ecommercePlatform: 'Custom-built', engagementCRM: 'MoEngage', payments: 'Razorpay', activeSignals: ['Recently Funded', 'App Launched'], score: 76, timeAgo: '2d ago', signalText: 'Raised $150M Series G — expanding to 25 new cities', persona: { name: 'Vivek Gupta', title: 'Co-founder & CEO', bio: 'City expansion requires cold-chain & logistics partners' }, description: 'Fresh meat & seafood delivery' },
  { id: '8', name: 'Wakefit', category: 'Home & Living', geography: 'India', businessModel: 'D2C + Marketplace', scale: 'Scaling (500K–2M)', offlinePresence: '10–50 stores', appPresence: 'No App', funding: 'Series A+', ecommercePlatform: 'WooCommerce', engagementCRM: 'WebEngage', payments: 'Razorpay', activeSignals: ['Store Expansion'], score: 55, timeAgo: '6d ago', signalText: 'Opened 15 new experience centers across Tier-2 cities', persona: { name: 'Ankit Garg', title: 'CEO', bio: 'Offline expansion — evaluating POS and store analytics tools' }, description: 'Sleep solutions & home furniture' },
  { id: '9', name: 'The Whole Truth', category: 'Food & Beverage', geography: 'India', businessModel: 'Pure D2C', scale: 'Growing (100K–500K)', offlinePresence: 'Online Only', appPresence: 'No App', funding: 'Seed / Angel', ecommercePlatform: 'Shopify', engagementCRM: 'Klaviyo', payments: 'Stripe', activeSignals: ['Recently Funded'], score: 67, timeAgo: '3d ago', signalText: 'Secured $15M Series B from Sequoia', persona: { name: 'Shashank Mehta', title: 'Founder & CEO', bio: 'Post-funding — scaling production and D2C channel' }, description: 'Clean-label protein bars & snacks' },
  { id: '10', name: 'Noise', category: 'Electronics & Gadgets', geography: 'India', businessModel: 'D2C + Marketplace', scale: 'Established (2M+)', offlinePresence: '1–10 stores', appPresence: 'Both iOS & Android', funding: 'Series A+', ecommercePlatform: 'Shopify', engagementCRM: 'CleverTap', payments: 'Razorpay', activeSignals: ['High Growth', 'Key Hiring'], score: 79, timeAgo: '2d ago', signalText: 'Hired 3 senior engineering leads from Samsung', persona: { name: 'Amit Khatri', title: 'Co-founder', bio: 'Building in-house R&D — needs talent acquisition tools' }, description: 'Smart wearables & audio devices' },
  { id: '11', name: 'Country Delight', category: 'Food & Beverage', geography: 'India', businessModel: 'Pure D2C', scale: 'Scaling (500K–2M)', offlinePresence: 'Online Only', appPresence: 'Both iOS & Android', funding: 'Late Stage', ecommercePlatform: 'Custom-built', engagementCRM: 'CleverTap', payments: 'PayU', activeSignals: ['High Growth', 'Key Hiring'], score: 83, timeAgo: '1d ago', signalText: 'Expanded to 15 new cities — 2x delivery fleet', persona: { name: 'Chakradhar Gade', title: 'Co-founder & CEO', bio: 'Hyper-growth phase — needs logistics and CRM solutions' }, description: 'Farm-fresh milk & dairy delivery' },
  { id: '12', name: 'Bewakoof', category: 'Fashion & Apparel', geography: 'India', businessModel: 'D2C + Marketplace', scale: 'Established (2M+)', offlinePresence: 'Online Only', appPresence: 'Both iOS & Android', funding: 'Series A+', ecommercePlatform: 'Custom-built', engagementCRM: 'MoEngage', payments: 'Razorpay', activeSignals: ['App Launched'], score: 62, timeAgo: '5d ago', signalText: 'Revamped mobile app with AI recommendations', persona: { name: 'Prabhkiran Singh', title: 'Co-founder & CEO', bio: 'Investing in AI personalization — evaluating ML platforms' }, description: 'Youth fashion & casual wear' },
  { id: '13', name: 'Kapiva', category: 'Health & Wellness', geography: 'India', businessModel: 'D2C + Marketplace', scale: 'Growing (100K–500K)', offlinePresence: 'Online Only', appPresence: 'No App', funding: 'Series A+', ecommercePlatform: 'Shopify', engagementCRM: 'None detected', payments: 'Razorpay', activeSignals: ['Recently Funded'], score: 59, timeAgo: '4d ago', signalText: 'Raised $25M Series C — entering international markets', persona: { name: 'Ameve Sharma', title: 'Co-founder & CEO', bio: 'International expansion — needs cross-border logistics' }, description: 'Modern Ayurveda health products' },
  { id: '14', name: 'Healthify', category: 'Health & Wellness', geography: 'India', businessModel: 'Pure D2C', scale: 'Established (2M+)', offlinePresence: 'Online Only', appPresence: 'Both iOS & Android', funding: 'Late Stage', ecommercePlatform: 'Custom-built', engagementCRM: 'CleverTap', payments: 'Stripe', activeSignals: ['High Growth', 'Key Hiring'], score: 91, timeAgo: '1d ago', signalText: 'Crossed 30M downloads — launching AI health coach', persona: { name: 'Tushar Vashisht', title: 'Co-founder & CEO', bio: 'AI-first approach — evaluating LLM providers' }, description: 'AI-powered health & fitness app' },
  { id: '15', name: 'BlissClub', category: 'Fashion & Apparel', geography: 'India', businessModel: 'Pure D2C', scale: 'Growing (100K–500K)', offlinePresence: 'Online Only', appPresence: 'No App', funding: 'Seed / Angel', ecommercePlatform: 'Shopify', engagementCRM: 'Klaviyo', payments: 'Stripe', activeSignals: ['Recently Funded'], score: 65, timeAgo: '3d ago', signalText: 'Raised $18M Series B — community-led growth', persona: { name: 'Minu Margeret', title: 'Founder & CEO', bio: 'Community-first brand — open to ambassador tools' }, description: "Women's activewear" },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */
const emptyFilters = (): Filters => ({
  geography: [], category: [], businessModel: [], scale: [],
  offlinePresence: [], appPresence: [], funding: [],
  ecommercePlatform: [], engagementCRM: [], payments: [], activeSignals: [],
});

function syncFromOnboarding(a: OnboardingAnswers): Filters {
  const f = emptyFilters();
  if (a.geoFocus?.length) {
    const map: Record<string, string[]> = {
      'India': ['India'], 'Southeast Asia': ['Singapore', 'Indonesia'], 'Middle East': ['UAE'],
    };
    a.geoFocus.forEach(g => { map[g]?.forEach(t => { if (!f.geography.includes(t)) f.geography.push(t); }); });
  }
  if (a.techCategories?.length) {
    a.techCategories.forEach(t => { if (FILTER_OPTIONS.ecommercePlatform.includes(t)) f.ecommercePlatform.push(t); });
  }
  if (a.channelMix?.length) {
    a.channelMix.forEach(ch => {
      if (ch === 'website_only' && !f.businessModel.includes('Pure D2C')) f.businessModel.push('Pure D2C');
      if (ch === 'marketplace_only' && !f.businessModel.includes('D2C + Marketplace')) f.businessModel.push('D2C + Marketplace');
      if (ch === 'omnichannel' && !f.businessModel.includes('Omnichannel')) f.businessModel.push('Omnichannel');
      if (ch === 'offline_retail') ['1–10 stores', '10–50 stores', '50+ stores'].forEach(s => { if (!f.offlinePresence.includes(s)) f.offlinePresence.push(s); });
    });
  }
  return f;
}

function applyFilters(accounts: Account[], f: Filters): Account[] {
  return accounts.filter(a => {
    for (const k of Object.keys(f) as (keyof Filters)[]) {
      if (!f[k].length) continue;
      if (k === 'activeSignals') { if (!f[k].some(s => a.activeSignals.includes(s))) return false; }
      else if (!f[k].includes(a[k] as string)) return false;
    }
    return true;
  });
}

function sortList(list: Account[], key: SortKey, asc: boolean): Account[] {
  const s = [...list].sort((a, b) => {
    if (key === 'name') return a.name.localeCompare(b.name);
    if (key === 'category') return a.category.localeCompare(b.category);
    if (key === 'scale') return SCALE_ORDER.indexOf(a.scale) - SCALE_ORDER.indexOf(b.scale);
    if (key === 'funding') return FUNDING_ORDER.indexOf(a.funding) - FUNDING_ORDER.indexOf(b.funding);
    if (key === 'score') return a.score - b.score;
    return b.activeSignals.length - a.activeSignals.length;
  });
  return asc ? s : s.reverse();
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

const SubLabel = ({ label, badge }: { label: string; badge?: string }) => (
  <div className="flex items-center gap-2 px-3 pb-1 pt-2">
    <span className="text-[10px] font-bold text-slate-300 uppercase">{label}</span>
    {badge && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 rounded uppercase">{badge}</span>}
  </div>
);

/* Signal colors */
const SIG_C: Record<string, string> = {
  'Recently Funded': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Store Expansion': 'text-blue-700 bg-blue-50 border-blue-200',
  'App Launched': 'text-violet-700 bg-violet-50 border-violet-200',
  'Key Hiring': 'text-amber-700 bg-amber-50 border-amber-200',
  'Marketplace Expansion': 'text-teal-700 bg-teal-50 border-teal-200',
  'High Growth': 'text-rose-700 bg-rose-50 border-rose-200',
};

/* Score badge color */
const scoreColor = (s: number) => s >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : s >= 60 ? 'text-orange-700 bg-orange-50 border-orange-200' : 'text-slate-500 bg-slate-50 border-slate-200';

/* ═══════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'table' | 'card'>('card');
  const [sortKey, setSortKey] = useState<SortKey>('signals');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [moreCats, setMoreCats] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('market-intelligence');

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
        if (saved) { try { setFilters(JSON.parse(saved)); } catch { setFilters(syncFromOnboarding(ans)); } }
        else setFilters(syncFromOnboarding(ans));
      } catch { /* */ }
    }
    setReady(true);
  }, [router, session, status]);

  // Persist filters
  useEffect(() => { if (ready) localStorage.setItem('harvin_dashboard_filters', JSON.stringify(filters)); }, [filters, ready]);
  // Reset page on filter/search change
  useEffect(() => { setPage(1); }, [filters, search]);

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

  /* ── Tab-specific filtering (watchlists) ────────────────────────── */
  const getTabAccounts = (accounts: Account[]): Account[] => {
    switch (activeTab) {
      case 'recently-funded':
        return accounts.filter(a => a.activeSignals.includes('Recently Funded'));
      case 'competitor-clients':
        return accounts.filter(a => ['boAt', 'Noise', 'Mamaearth'].includes(a.name));
      case 'current-clients':
        return accounts.filter(a => ['Sugar Cosmetics'].includes(a.name));
      default:
        return accounts;
    }
  };

  /* ── Derived data ──────────────────────────────────────────────────── */
  const list = useMemo(() => {
    let r = applyFilters(DEMO_ACCOUNTS, filters);
    r = getTabAccounts(r);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(a => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q));
    }
    return sortList(r, sortKey, sortAsc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search, sortKey, sortAsc, activeTab]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeCount = countFilters(filters);

  if (!ready) return null;
  const firstName = user?.name?.split(' ')[0] || 'there';
  const visCats = moreCats ? FILTER_OPTIONS.category : FILTER_OPTIONS.category.slice(0, CAT_SHOW);
  const hiddenCats = FILTER_OPTIONS.category.length - CAT_SHOW;

  /* ── Watchlist counts ──────────────────────────────────────────────── */
  const recentlyFundedCount = DEMO_ACCOUNTS.filter(a => a.activeSignals.includes('Recently Funded')).length;
  const competitorCount = DEMO_ACCOUNTS.filter(a => ['boAt', 'Noise', 'Mamaearth'].includes(a.name)).length;
  const currentCount = DEMO_ACCOUNTS.filter(a => ['Sugar Cosmetics'].includes(a.name)).length;

  /* Is current tab a settings tab? */
  const isSettingsTab = activeTab === 'icp-preferences' || activeTab === 'integrations';

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
                className={`w-full flex items-center justify-between px-4 py-2 rounded-xl cursor-pointer transition-all ${activeTab === 'recently-funded' ? 'bg-orange-50 text-[#C94C1E]' : 'text-slate-600 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3 font-medium text-[14px]"><Target size={18} className={activeTab === 'recently-funded' ? 'text-[#C94C1E]' : 'text-rose-500'} /> Recently Funded</div>
                <span className="w-5 h-5 flex items-center justify-center bg-orange-100 text-[#C94C1E] rounded-full text-[10px] font-bold">{recentlyFundedCount}</span>
              </button>
              <button onClick={() => setActiveTab('competitor-clients')}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-xl cursor-pointer transition-all ${activeTab === 'competitor-clients' ? 'bg-orange-50 text-[#C94C1E]' : 'text-slate-600 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3 font-medium text-[14px]"><Swords size={18} className={activeTab === 'competitor-clients' ? 'text-[#C94C1E]' : 'text-slate-400'} /> Competitor Clients</div>
                <span className="w-5 h-5 flex items-center justify-center bg-orange-100 text-[#C94C1E] rounded-full text-[10px] font-bold">{competitorCount}</span>
              </button>
              <button onClick={() => setActiveTab('current-clients')}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-xl cursor-pointer transition-all ${activeTab === 'current-clients' ? 'bg-orange-50 text-[#C94C1E]' : 'text-slate-600 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3 font-medium text-[14px]"><Briefcase size={18} className={activeTab === 'current-clients' ? 'text-[#C94C1E]' : 'text-amber-700'} /> Current Clients</div>
                <span className="w-5 h-5 flex items-center justify-center bg-orange-100 text-[#C94C1E] rounded-full text-[10px] font-bold">{currentCount}</span>
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
            {!isSettingsTab && <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{list.length} results</span>}
          </div>
          {!isSettingsTab && (
            <div className="flex items-center gap-4">
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-slate-400" size={16} />
                <input type="text" placeholder="Search brands or people..." value={search} onChange={e => setSearch(e.target.value)}
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
        {!isSettingsTab && activeCount > 0 && (
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
                        { label: 'Geographies', values: filters.geography },
                        { label: 'Categories', values: filters.category },
                        { label: 'Business Models', values: filters.businessModel },
                        { label: 'Scale', values: filters.scale },
                        { label: 'Platforms', values: filters.ecommercePlatform },
                        { label: 'Engagement/CRM', values: filters.engagementCRM },
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
          ) : list.length === 0 ? (
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
            <div className="max-w-6xl mx-auto space-y-6">
              {pageItems.map(a => (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-serif text-slate-400 text-xl shadow-inner">
                          {a.name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[17px] font-bold text-slate-800 leading-tight">{a.name}</h3>
                            <div className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${scoreColor(a.score)}`}>{a.score}</div>
                          </div>
                          <p className="text-[12px] text-slate-400 font-medium mt-0.5">
                            {a.category} &bull; {a.geography} &bull; {a.businessModel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.activeSignals.map(s => (
                          <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${SIG_C[s] || 'text-slate-500 bg-slate-50 border-slate-200'}`}>
                            <span className="w-[4px] h-[4px] rounded-full bg-current opacity-60" /> {s}
                          </span>
                        ))}
                        <div className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-1 rounded border border-rose-100 uppercase tracking-tighter ml-1">{a.timeAgo}</div>
                      </div>
                    </div>

                    <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center gap-2">
                      <Zap size={14} className="text-orange-700 fill-orange-700" />
                      <span className="text-[13px] font-bold text-orange-900">{a.signalText}</span>
                    </div>

                    <div className="bg-[#F9F9F9] border border-slate-100 rounded-xl p-4 flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck size={20} className="text-white fill-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[14px]">
                          <span className="font-bold text-slate-800">{a.persona.name}</span>
                          <span className="text-slate-400 font-medium">&bull; {a.persona.title}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 italic mt-1 font-medium">{a.persona.bio}</p>
                        <div className="mt-4 flex items-center gap-4">
                          <button className="bg-white border border-slate-200 px-4 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-2 text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
                            <Lock size={12} className="text-orange-700" /> Reveal details <span className="text-slate-400 font-normal">1 credit</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium border-t border-slate-100 pt-3">
                      <span>{a.scale}</span>
                      <span className="text-slate-200">&bull;</span>
                      <span>{a.funding}</span>
                      <span className="text-slate-200">&bull;</span>
                      <span>{a.ecommercePlatform}</span>
                      <span className="text-slate-200">&bull;</span>
                      <span>{a.engagementCRM}</span>
                      <span className="text-slate-200">&bull;</span>
                      <span>{a.offlinePresence}</span>
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
                      <th className="text-left px-5 py-3"><SortHeader label="Brand" sortKeyVal="name" /></th>
                      <th className="text-left px-4 py-3"><SortHeader label="Category" sortKeyVal="category" /></th>
                      <th className="text-left px-4 py-3"><SortHeader label="Scale" sortKeyVal="scale" /></th>
                      <th className="text-left px-4 py-3"><SortHeader label="Funding" sortKeyVal="funding" /></th>
                      <th className="text-left px-4 py-3"><SortHeader label="Score" sortKeyVal="score" /></th>
                      <th className="text-left px-4 py-3"><SortHeader label="Signals" sortKeyVal="signals" /></th>
                      <th className="text-left px-4 py-3"><span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Platform</span></th>
                      <th className="text-right px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">When</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map(a => (
                      <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-serif text-slate-400 text-[15px] flex-shrink-0">
                              {a.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-slate-800 truncate">{a.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{a.geography} &bull; {a.businessModel}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-slate-600">{a.category}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-slate-600">{a.scale.split(' (')[0]}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-slate-600">{a.funding}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-bold ${scoreColor(a.score)}`}>{a.score}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {a.activeSignals.map(s => (
                              <span key={s} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold ${SIG_C[s] || 'text-slate-500 bg-slate-50 border-slate-200'}`}>
                                <span className="w-[3px] h-[3px] rounded-full bg-current opacity-60" /> {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[11px] text-slate-400">{a.ecommercePlatform}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 uppercase">{a.timeAgo}</span>
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
        {!isSettingsTab && (
          <footer className="h-[64px] border-t border-slate-100 bg-white px-8 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4 text-[12px] text-slate-400 font-medium">
              <span>Showing <span className="text-slate-800 font-bold">{Math.min(((page - 1) * PAGE_SIZE) + 1, list.length)}&ndash;{Math.min(page * PAGE_SIZE, list.length)}</span> of <span className="text-slate-800 font-bold">{list.length}</span></span>
              <span className="inline-flex items-center gap-1"><span className="w-[5px] h-[5px] rounded-full bg-emerald-500 animate-pulse inline-block" /> 500K+ brands tracked</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border hover:bg-slate-50 text-slate-400 transition-all disabled:opacity-25"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors ${p === page ? 'bg-[#C94C1E] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border hover:bg-slate-50 text-slate-400 transition-all disabled:opacity-25"><ChevronRight size={16} /></button>
            </div>
          </footer>
        )}
      </main>

      {/* ── Filter Sidebar (Right, White, Collapsible) ────────────────── */}
      {!isSettingsTab && (
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
            <FilterSection title="Basics" count={filters.geography.length + filters.category.length}>
              <SubLabel label="Geography" />
              {FILTER_OPTIONS.geography.map(v => <FilterItem key={v} label={v} on={filters.geography.includes(v)} onClick={() => toggle('geography', v)} />)}
              <SubLabel label="Category" />
              {visCats.map(v => <FilterItem key={v} label={v} on={filters.category.includes(v)} onClick={() => toggle('category', v)} />)}
              {hiddenCats > 0 && (
                <button onClick={() => setMoreCats(!moreCats)} className="px-3 mt-1 text-[11px] text-[#C94C1E] font-medium hover:underline">
                  {moreCats ? 'Show less' : `+ ${hiddenCats} more`}
                </button>
              )}
            </FilterSection>

            <FilterSection title="D2C Profile" count={filters.businessModel.length + filters.scale.length + filters.offlinePresence.length + filters.appPresence.length}>
              <SubLabel label="Business Model" />
              {FILTER_OPTIONS.businessModel.map(v => <FilterItem key={v} label={v} on={filters.businessModel.includes(v)} onClick={() => toggle('businessModel', v)} />)}
              <SubLabel label="Scale (Est. Traffic)" />
              {FILTER_OPTIONS.scale.map(v => <FilterItem key={v} label={v} on={filters.scale.includes(v)} onClick={() => toggle('scale', v)} />)}
              <SubLabel label="Offline Presence" />
              {FILTER_OPTIONS.offlinePresence.map(v => <FilterItem key={v} label={v} on={filters.offlinePresence.includes(v)} onClick={() => toggle('offlinePresence', v)} />)}
              <SubLabel label="App Presence" />
              {FILTER_OPTIONS.appPresence.map(v => <FilterItem key={v} label={v} on={filters.appPresence.includes(v)} onClick={() => toggle('appPresence', v)} />)}
            </FilterSection>

            <FilterSection title="Funding" count={filters.funding.length}>
              {FILTER_OPTIONS.funding.map(v => <FilterItem key={v} label={v} on={filters.funding.includes(v)} onClick={() => toggle('funding', v)} />)}
            </FilterSection>

            <FilterSection title="Tech Stack" count={filters.ecommercePlatform.length + filters.engagementCRM.length + filters.payments.length}>
              <SubLabel label="Ecommerce Platform" />
              {FILTER_OPTIONS.ecommercePlatform.map(v => <FilterItem key={v} label={v} on={filters.ecommercePlatform.includes(v)} onClick={() => toggle('ecommercePlatform', v)} />)}
              <SubLabel label="Engagement / CRM" badge="KEY" />
              {FILTER_OPTIONS.engagementCRM.map(v => <FilterItem key={v} label={v} on={filters.engagementCRM.includes(v)} onClick={() => toggle('engagementCRM', v)} />)}
              <SubLabel label="Payments" />
              {FILTER_OPTIONS.payments.map(v => <FilterItem key={v} label={v} on={filters.payments.includes(v)} onClick={() => toggle('payments', v)} />)}
            </FilterSection>

            <FilterSection title="Active Signals" count={filters.activeSignals.length}>
              {FILTER_OPTIONS.activeSignals.map(v => <FilterItem key={v} label={v} on={filters.activeSignals.includes(v)} onClick={() => toggle('activeSignals', v)} />)}
              <p className="px-3 text-[10px] text-slate-400 italic mt-2">Signals within last 90 days</p>
            </FilterSection>
          </div>

          <div className="p-4 border-t border-slate-100 space-y-2 flex-shrink-0">
            <button onClick={resyncOnboarding} className="w-full flex items-center justify-center gap-2 bg-[#C94C1E] hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-[13px] font-bold shadow-lg shadow-orange-500/20 transition-all">
              Save as Watchlist
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
