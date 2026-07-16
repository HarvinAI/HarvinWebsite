'use client';

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import DashboardTour from '@/components/DashboardTour';
import ChatBot from '@/components/ChatBot';
import BrandNameExtractorView from '@/components/BrandNameExtractorView';
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
  Upload, FileSpreadsheet, AlertCircle, Building2,
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
  displayLocation: string;
  locationLevel: string;
  offlineStores: string;
  aiStoreCount: number;
  storeRawCount: number;
  techCount: number;
  techStack: string[];
  businessModel: string | null;
  monthlyVisits: number | null;
  monthlyVisitsFormatted: string | null;
  scaleBand: string | null;
  appPresence: string | null;
  activeSignals: string[];
  techMigration: { added: string[]; removed: string[] } | null;
  techSignals: { label: string; detail: string; tone: 'ent' | 'ad' | 'sub' | 'sms' | 'cdp' | 'loyalty' }[];
  fundingStage: string | null;
  brandName: string | null;
  updatedAt: string;
  harvinScore: number;
};
type Filters = { category: string[]; region: string[]; state: string[]; city: string[]; businessModel: string[]; scale: string[]; offlinePresence: string[]; appPresence: string[]; techStack: string[]; activeSignals: string[]; funding: string[] };
type SortKey = 'domain' | 'category' | 'region' | 'offlineStores' | 'updatedAt' | 'techCount' | 'monthlyVisits' | 'harvinScore';
type FilterOptions = { categories: string[]; regions: string[]; states: string[]; cities: string[]; offlineStores: string[]; techStackOptions: Record<string, string[]> };
type WatchlistContact = { name: string; email: string; title: string; department: string };
type Watchlist = { _id: string; name: string; domains: string[]; contactCount?: number; createdAt: string; updatedAt: string };
type WatchlistAccount = { normalizedDomain: string; category: string; subCategory: string; region: string; state: string; offlineStores: string; businessModel: string; monthlyVisitsFormatted: string; appPresence: string; techCount: number; harvinScore: number; brandName: string; updatedAt: string; contacts: WatchlistContact[] };
type SidebarTab = 'market-intelligence' | 'my-universe' | 'account-explorer' | 'tech-scanner' | 'category-finder' | 'lookalike-brands' | 'my-watchlists' | 'recently-funded' | 'competitor-clients' | 'current-clients' | 'icp-preferences' | 'integrations' | 'admin-accounts' | 'brand-name-extractor';
type UniverseStatus = 'all' | 'in-conversation' | 'active-client' | 'churned-client';

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20;
const CAT_SHOW = 5;



type ScanTech = { name: string; category: string; color: string; version?: string; changeTag?: 'added' | 'removed' };
type ScanCompanyMeta = { category: string; subCategory: string; region: string; offlineStores: string; storeRawCount?: number; businessModel?: string; appPresence?: string; monthlyVisitsFormatted?: string; isNonD2C?: boolean; nonD2CReason?: string };
type TechChanges = { added: string[]; removed: string[]; previousScanAt?: string };
type ScanResult = { url: string; technologies: ScanTech[]; count: number; companyMeta?: ScanCompanyMeta; techChanges?: TechChanges };

const TAB_TITLES: Record<SidebarTab, string> = {
  'market-intelligence': 'Intelligence Hub',
  'my-universe': 'My Universe',
  'account-explorer': 'Account Explorer',
  'tech-scanner': 'Tech Scanner',
  'category-finder': 'Category Finder',
  'lookalike-brands': 'LookALike Brands',
  'my-watchlists': 'My Watchlists',
  'recently-funded': 'Market News',
  'competitor-clients': 'Competitor Clients',
  'current-clients': 'Current Clients',
  'icp-preferences': 'ICP & Preferences',
  'integrations': 'Integrations',
  'admin-accounts': 'Admin: Accounts',
  'brand-name-extractor': 'Admin: Brand Name Extractor',
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
const emptyFilters = (): Filters => ({ category: [], region: [], state: [], city: [], businessModel: [], scale: [], offlinePresence: [], appPresence: [], techStack: [], activeSignals: [], funding: [] });

/** Pick up to 3 priority techs for pill display: Ecommerce Platform first, then CRM */
const PILL_PRIORITY_CATS = ['Ecommerce Platform', 'Customer Engagement / CRM'];
function pickPriorityTech(techStack: string[], categoryLookup: Record<string, string>): string[] {
  const unique = [...new Set(techStack)];
  const picked: string[] = [];
  // First pass: pick from priority categories in order
  for (const cat of PILL_PRIORITY_CATS) {
    for (const t of unique) {
      if (picked.length >= 3) break;
      if (categoryLookup[t] === cat && !picked.includes(t)) picked.push(t);
    }
    if (picked.length >= 3) break;
  }
  // Fill remaining slots with other techs
  if (picked.length < 3) {
    for (const t of unique) {
      if (picked.length >= 3) break;
      if (!picked.includes(t)) picked.push(t);
    }
  }
  return picked;
}

function safeBrandName(raw: unknown): string | null {
  if (!raw) return null;
  let name: string | null = null;
  if (typeof raw === 'string') name = raw;
  else if (typeof raw === 'object' && raw !== null && 'name' in raw) name = String((raw as Record<string, unknown>).name);
  if (!name) return null;
  name = name.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').trim();
  // Strip leading/trailing separator junk that leaked from og:title (e.g. "3i Infotech |").
  name = name.replace(/^[\s|\-–—·:»«/]+/, '').replace(/[\s|\-–—·:»«/]+$/, '').trim();
  // Reject stored names that leaked the domain (e.g. "zoak.co.in") → caller
  // falls back to domainToName(), which prettifies the domain instead.
  if (!name || (!/\s/.test(name) && /\.[a-z]{2,4}(\.[a-z]{2,4})?$/i.test(name))) return null;
  return name;
}

function domainToName(domain: string): string {
  let base = domain.replace(/^www\d*\./, '').split('.')[0];
  // Strip common domain prefixes that aren't part of brand name
  const PREFIX_RE = /^(with|get|try|use|go|hey|the|my|our|join|meet|hello)(?=[a-z]{3,})/i;
  const prefixMatch = PREFIX_RE.exec(base);
  if (prefixMatch && base.length > prefixMatch[1].length + 2) {
    base = base.slice(prefixMatch[1].length);
  }
  // Right-side suffixes that can be split off (generic descriptors, not brand names)
  const SUFFIXES = new Set(['shop','store','mart','hub','club','box','lab','labs','studio','house','home','world','zone','tech','digital','online','global','india','express','market','fashion','style','wear','clothing','couture','beauty','skin','care','hair','health','wellness','fitness','food','foods','kitchen','cafe','coffee','organic','fresh','farm','baby','kids','pet','life','lifestyle','living','decor','gold','silver','jewel','diamond','auto','car','bike','travel','pay','money','capital','bank','learn','academy','game','play','sport','media','news','basket','cart','bag','trunk','earth','nature','eco','kart','shoes','campus','cosmetics','goods','ware','garden','water','tools','objects','beans','baker','works','craft','crafts','bazar','bazaar','direct','brand','brands','point','centre','center','space','place','lane','street','corner','wagon','tales','tales','way','base','desk','nest','den','pad','room','yard','land','field','creek','deal','deals','finds','picks','select','choice','spot','stop','dock','dock','fleet','bites','eats','sips','glow','vine','leaf','root','bloom','berry','mint','sage','luxe','loom','thread','stitch','weave','fiber','fibre','print','prints','wrap','pack','packs']);
  // Left-side prefixes that can be split off (generic adjectives)
  const PREFIXES = new Set(['smart','fast','easy','quick','super','big','new','first','best','top','pro','blue','green','red','black','white','star','sun','urban','city','royal','king','queen','daily','fresh','happy','little','tiny','mini','mega','pure','true','real','open','free','clean','clear','fine','flat','cool','wild','bold','brave','ever','lucky','golden','silver','country','native','modern','classic','vintage','pocket','simple']);
  // Known brand names that should NEVER be split (exact domain match only)
  const NO = new Set(['nykaa','myntra','meesho','zepto','swiggy','zomato','flipkart','snapdeal','paytm','razorpay','phonepe','groww','cred','pepperfry','lenskart','bewakoof','ajio','mamaearth','mokobara','caratlane','healthandglow','shopclues','getepic','thegoatlife','pureit','oneplus','realme','urbanclap','urbancompany','makemytrip','policybazaar','ixigo','rapido','dunzo','bigbasket','blinkit','instamart','jiomart','jiocinema','jiosaavn','hotstar','unacademy','vedantu','byjus','whitehat','curefit','cultfit','milkbasket','dailyhunt','sharechat','practo','pharmeasy','netmeds','tatacliq','faasos','eatfit','sleepycat','wakefit','atomberg','boatlifestyle','noisefit','fireboltt','portronics','ambrane','zebronics','furlenco','bluestone','caratlane','pepperflow','sugarbox','honeywell','minimalist','supersmelly','probase','fineshine','topgear','boldfit']);
  const l = base.toLowerCase();
  if (base.includes('-') || base.includes('_')) return base.split(/[-_]/).filter(Boolean).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  if (NO.has(l) || base.length <= 6) return base.charAt(0).toUpperCase() + base.slice(1);
  // Find best split — only split on suffix (right side) or prefix (left side), not arbitrary words
  let bestSplit: [string, string] | null = null;
  let bestScore = 0;
  for (let i = 3; i < l.length - 2; i++) {
    const left = l.slice(0, i), right = l.slice(i);
    const rightIsSuffix = SUFFIXES.has(right);
    const leftIsPrefix = PREFIXES.has(left);
    if (!rightIsSuffix && !leftIsPrefix) continue;
    // Score: prefer longer right-side suffix matches, then left-side prefix matches
    const score = (rightIsSuffix ? right.length * 3 : 0) + (leftIsPrefix ? left.length : 0);
    if (score > bestScore) { bestScore = score; bestSplit = [left, right]; }
  }
  if (bestSplit) return bestSplit.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Format store band with count: "51-100 (54 stores)" or "Online" */
function formatStores(band: string, rawCount?: number): string {
  if (!band || band === 'Online' || band === 'Online Only' || band === 'Unknown') return band || 'Unknown';
  if (rawCount && rawCount > 0) return `${band} (${rawCount} stores)`;
  return band;
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}


/* Deterministic hash for demo fallbacks (consistent per domain) */

// Pass accounts through untouched — every field shown on a card must be REAL
// data from the scan/signals pipeline. We do not fabricate signals, funding,
// business model, scale or app presence. Missing values simply don't render.
function demoFill(a: Account): Account {
  return a;
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

/* Ecommerce/CMS platform a brand runs on — universal at-a-glance context,
 * derived from the detected tech stack (first match wins, most specific first). */
const PLATFORM_MATCHERS: [RegExp, string][] = [
  [/shopify plus/i, 'Shopify Plus'],
  [/shopify/i, 'Shopify'],
  [/woocommerce/i, 'WooCommerce'],
  [/adobe commerce|magento/i, 'Magento'],
  [/bigcommerce/i, 'BigCommerce'],
  [/salesforce commerce|demandware/i, 'Salesforce'],
  [/commercetools/i, 'commercetools'],
  [/prestashop/i, 'PrestaShop'],
  [/opencart/i, 'OpenCart'],
  [/wix stores|\bwix\b/i, 'Wix'],
  [/squarespace/i, 'Squarespace'],
  [/webflow/i, 'Webflow'],
  [/\bshopware\b/i, 'Shopware'],
  [/wordpress/i, 'WordPress'],
  [/drupal/i, 'Drupal'],
];
function detectPlatform(techStack: string[] | undefined): string | null {
  const names = techStack || [];
  for (const [re, label] of PLATFORM_MATCHERS) {
    if (names.some(n => typeof n === 'string' && re.test(n))) return label;
  }
  return null;
}

/* Onboarding label → DB value mappings (mirrors API CATEGORY_MAP / REGION_MAP) */
const ONBOARD_CAT_MAP: Record<string, string> = {
  'Beauty & Skincare': 'Beauty & Personal Care',
  'Electronics & Gadgets': 'Electronics & Tech',
  'Jewelry & Accessories': 'Jewelry',
  'Fitness & Sports': 'Sports & Outdoor',
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
    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${on ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.12] group-hover:border-slate-400'}`}>
      {on && <Check size={9} className="text-white stroke-[3]" />}
    </div>
    <span className={`text-[11.5px] transition-colors ${on ? 'text-[#C94C1E] font-medium' : 'text-slate-500 dark:text-neutral-400 group-hover:text-slate-800 dark:group-hover:text-white'}`}>{label}</span>
  </button>
);

const FilterSection = ({ title, count, children, defaultOpen = true }: {
  title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors group">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-[#C94C1E] uppercase tracking-[0.08em]" style={{ fontWeight: 900, WebkitTextStroke: '0.3px' }}>{title}</span>
          {count !== undefined && count > 0 && <span className="text-[10px] bg-[#C94C1E]/10 text-[#C94C1E] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">{count}</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300 transition-colors" /> : <ChevronDown size={14} className="text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300 transition-colors" />}
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  );
};

/* ── Tech category group — dropdown with search, like LocationSubFilter */
const TechCategoryGroup = ({ category, techs, filters, toggle }: {
  category: string; techs: string[]; filters: Filters; toggle: (key: keyof Filters, value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedInCat = techs.filter(t => filters.techStack.includes(t));

  const visible = q.trim()
    ? techs.filter(t => t.toLowerCase().includes(q.toLowerCase()))
    : techs;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  if (techs.length === 0) return null;

  return (
    <div className="mt-2.5 mb-1 px-3 relative" ref={containerRef}>
      <p className="text-[12.5px] font-extrabold text-slate-700 dark:text-neutral-200 tracking-[0.02em] mb-1.5">{category}</p>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-[8px] rounded-lg border text-[12px] transition-all ${
          open
            ? 'border-[#C94C1E]/50 shadow-[0_0_0_2px_rgba(201,76,30,0.08)] bg-white dark:bg-[#1a1a1a]'
            : selectedInCat.length > 0
              ? 'border-[#C94C1E]/40 bg-orange-50/50 dark:bg-[#C94C1E]/15 dark:border-[#C94C1E]/50'
              : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141414] hover:border-slate-300 dark:hover:border-white/[0.15]'
        }`}
      >
        <span className={`truncate ${selectedInCat.length > 0 ? 'text-[#C94C1E] dark:text-[#f0a070] font-medium' : 'text-slate-400 dark:text-neutral-500'}`}>
          {selectedInCat.length > 0 ? `${selectedInCat.length} selected` : `Select ${category.toLowerCase()}...`}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-medium text-slate-400 dark:text-neutral-500">{techs.length}</span>
          <svg className={`w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none">
            <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {/* Selected chips */}
      {selectedInCat.length > 0 && !open && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedInCat.map(v => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#C94C1E]/10 dark:bg-[#C94C1E]/20 text-[10px] font-medium text-[#C94C1E] dark:text-[#f0a070]">
              {v}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle('techStack', v); }} className="hover:text-[#b5431a] dark:hover:text-white">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/[0.1] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-200 dark:border-white/[0.12]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" size={12} />
              <input
                ref={inputRef}
                type="text" value={q}
                onChange={e => setQ(e.target.value)}
                placeholder={`Search ${category.toLowerCase()}...`}
                className="w-full pl-8 pr-3 py-[7px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-[12px] outline-none focus:border-[#C94C1E]/50 transition-all placeholder:text-slate-400 dark:placeholder:text-neutral-500 dark:text-white"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar py-1">
            {visible.length === 0 && <p className="px-3 py-3 text-[11px] text-slate-400 dark:text-neutral-500 text-center">No matches</p>}
            {visible.map(v => {
              const isOn = filters.techStack.includes(v);
              return (
                <button key={v} onClick={() => toggle('techStack', v)}
                  className={`w-full flex items-center gap-2.5 px-3 py-[7px] text-left transition-colors ${
                    isOn ? 'bg-orange-50/70 dark:bg-[#C94C1E]/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                  }`}>
                  <div className={`w-4 h-4 rounded flex-shrink-0 border-[1.5px] flex items-center justify-center transition-colors ${
                    isOn ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-neutral-600'
                  }`}>
                    {isOn && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-[12px] ${isOn ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-neutral-300'}`}>{v}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Location Sub-filter (Sales Navigator style — search + always-visible list) */
const LocationSubFilter = ({ label, options, selected, onToggle }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = q.trim()
    ? options.filter(o => o.toLowerCase().includes(q.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  if (options.length === 0) return null;

  return (
    <div className="mt-2.5 mb-1 px-3 relative" ref={containerRef}>
      <p className="text-[12.5px] font-extrabold text-slate-700 dark:text-neutral-200 tracking-[0.02em] mb-1.5">{label}</p>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-[8px] rounded-lg border text-[12px] transition-all ${
          open
            ? 'border-[#C94C1E]/50 shadow-[0_0_0_2px_rgba(201,76,30,0.08)] bg-white dark:bg-[#1a1a1a]'
            : selected.length > 0
              ? 'border-[#C94C1E]/40 bg-orange-50/50 dark:bg-[#C94C1E]/15 dark:border-[#C94C1E]/50'
              : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141414] hover:border-slate-300 dark:hover:border-white/[0.15]'
        }`}
      >
        <span className={`truncate ${selected.length > 0 ? 'text-[#C94C1E] dark:text-[#f0a070] font-medium' : 'text-slate-400 dark:text-neutral-500'}`}>
          {selected.length > 0 ? `${selected.length} selected` : `Select ${label.toLowerCase()}...`}
        </span>
        <svg className={`w-3.5 h-3.5 flex-shrink-0 text-slate-400 dark:text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none">
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Selected chips */}
      {selected.length > 0 && !open && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(v => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#C94C1E]/10 dark:bg-[#C94C1E]/20 text-[10px] font-medium text-[#C94C1E] dark:text-[#f0a070]">
              {v}
              <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(v); }} className="hover:text-[#b5431a] dark:hover:text-white">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/[0.1] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-200 dark:border-white/[0.12]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" size={12} />
              <input
                ref={inputRef}
                type="text" value={q}
                onChange={e => setQ(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full pl-8 pr-3 py-[7px] bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-[12px] outline-none focus:border-[#C94C1E]/50 transition-all placeholder:text-slate-400 dark:placeholder:text-neutral-500 dark:text-white"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-[220px] overflow-y-auto custom-scrollbar py-1">
            {visible.length === 0 && <p className="px-3 py-3 text-[11px] text-slate-400 dark:text-neutral-500 text-center">No matches</p>}
            {visible.map(v => {
              const isOn = selected.includes(v);
              return (
                <button key={v} onClick={() => onToggle(v)}
                  className={`w-full flex items-center gap-2.5 px-3 py-[7px] text-left transition-colors ${
                    isOn ? 'bg-orange-50/70 dark:bg-[#C94C1E]/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                  }`}>
                  {/* Checkbox */}
                  <div className={`w-4 h-4 rounded flex-shrink-0 border-[1.5px] flex items-center justify-center transition-colors ${
                    isOn ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-neutral-600'
                  }`}>
                    {isOn && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-[12px] ${isOn ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-neutral-300'}`}>{v}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
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
      <div className="bg-white dark:bg-[#141414] rounded-2xl shadow-2xl dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] w-[560px] max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.12] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">Select Categories</h3>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">{selected.length} of {categories.length} selected</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-200 dark:border-white/[0.12]">
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
              <span className={`text-[15px] font-bold ${allSelected ? 'text-[#C94C1E]' : 'text-slate-800 dark:text-white'}`}>All Categories</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-1">
            {filtered.map(v => (
              <button key={v} onClick={() => onToggle(v)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${selected.includes(v) ? 'bg-orange-50 dark:bg-[#C94C1E]/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${selected.includes(v) ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15]'}`}>
                  {selected.includes(v) && <Check size={12} className="text-white stroke-[3]" />}
                </div>
                <span className={`text-[14px] ${selected.includes(v) ? 'text-[#C94C1E] font-bold' : 'text-slate-700 dark:text-neutral-200 font-semibold'}`}>{v}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 && <p className="text-center py-6 text-[13px] text-slate-400 dark:text-neutral-500">No categories match &ldquo;{q}&rdquo;</p>}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 dark:border-white/[0.12] flex items-center justify-between">
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
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'rahul@harvin.ai,admin@harvin.ai,bharath@thyleads.com,mridul@thyleads.com,naman@thyleads.com').split(',').map(e => e.trim().toLowerCase());
  const isAdmin = session?.user?.email && adminEmails.includes(session.user.email.toLowerCase());

  // Global toast
  const [globalToast, setGlobalToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showGlobalToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setGlobalToast({ msg, type });
    setTimeout(() => setGlobalToast(null), 3000);
  };
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
  const paramDomain = searchParams.get('domain');
  const [activeTab, setActiveTab] = useState<SidebarTab>(paramTab && paramTab in TAB_TITLES ? paramTab : 'account-explorer');
  const [initialScanDomain] = useState(paramScan || '');
  const [initialLookalikeDomain] = useState(paramDomain || '');
  const { mode: themeMode, toggle: onToggleTheme } = useTheme();

  // Filter panel collapse + resize
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [filterWidth, setFilterWidth] = useState(280);
  const filterResizing = useRef(false);

  // Data from API
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ categories: [], regions: [], states: [], cities: [], offlineStores: [], techStackOptions: {} });
  // techSearch removed — each TechCategoryGroup now has its own search
  // Reverse lookup: tech name → category (for pill priority)
  const techCategoryLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [cat, techs] of Object.entries(filterOptions.techStackOptions)) {
      for (const t of techs) map[t] = cat;
    }
    return map;
  }, [filterOptions.techStackOptions]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fetchRef = useRef(0);

  // My Universe state
  const [universeAccounts, setUniverseAccounts] = useState<Account[]>([]);
  const [universeLoading, setUniverseLoading] = useState(false);
  const [universeUploading, setUniverseUploading] = useState(false);
  const [universeScanning, setUniverseScanning] = useState(false);
  const [universePendingScan, setUniversePendingScan] = useState(0);
  const [universeScanProgress, setUniverseScanProgress] = useState('');
  const [universeStatusFilter, setUniverseStatusFilter] = useState<UniverseStatus>('all');
  const [universeStatuses, setUniverseStatuses] = useState<Record<string, string>>({});
  const [universeSelected, setUniverseSelected] = useState<Set<string>>(new Set());
  const universeFileRef = useRef<HTMLInputElement>(null);

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
  const [selectingAll, setSelectingAll] = useState(false);
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
      if (!res.ok) { console.error(`[accounts] HTTP ${res.status}`); return; }
      let data;
      try { data = await res.json(); } catch { console.error('[accounts] invalid JSON'); return; }
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
        techStackOptions: data.filterOptions.techStackOptions || {},
      });
    } catch (err) {
      console.error('Failed to fetch accounts', err);
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, [ready, filters, debouncedSearch, sortKey, sortAsc, page]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  /* ── CSV export of all filtered accounts (paginated fetch) ───────── */
  const buildAccountsParams = useCallback(() => {
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
    return params;
  }, [filters, debouncedSearch, sortKey, sortAsc]);

  const handleExportAll = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const FILTER_LABELS: Record<keyof Filters, string> = {
        category: 'Category', region: 'Country', state: 'State', city: 'City',
        businessModel: 'Business Model', scale: 'Scale', offlinePresence: 'Offline Presence',
        appPresence: 'App Presence', techStack: 'Tech Stack', activeSignals: 'Active Signals',
        funding: 'Funding',
      };
      const activeFilterPairs = (Object.keys(filters) as (keyof Filters)[])
        .filter(k => filters[k].length > 0)
        .map(k => `${FILTER_LABELS[k]}: ${filters[k].join('|')}`);
      const filtersSummary = activeFilterPairs.length > 0 ? activeFilterPairs.join('; ') : 'None';

      // Larger batches + skip the per-request filter-option scans = far fewer, cheaper calls.
      const PAGE_LIMIT = 500;
      const CONCURRENCY = 6;
      const exportParams = (p: number, withCount: boolean) => {
        const pp = buildAccountsParams();
        pp.set('limit', String(PAGE_LIMIT));
        pp.set('page', String(p));
        pp.set('skipFilterOptions', '1');
        if (!withCount) pp.set('skipCount', '1');
        return pp;
      };

      // First page carries the count so we know how many pages remain.
      const firstRes = await fetch(`/api/accounts?${exportParams(1, true).toString()}`);
      if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
      const firstData = await firstRes.json();
      if (firstData.error) throw new Error(firstData.error);

      const totalPgs: number = firstData.totalPages || 1;
      // Index 0 = page 1; remaining pages fetched in parallel and slotted in order.
      const pageResults: Account[][] = new Array(totalPgs).fill(null).map(() => []);
      pageResults[0] = firstData.accounts || [];

      const remaining = Array.from({ length: totalPgs - 1 }, (_, i) => i + 2);
      let cursor = 0;
      const worker = async () => {
        while (cursor < remaining.length) {
          const p = remaining[cursor++];
          try {
            const r = await fetch(`/api/accounts?${exportParams(p, false).toString()}`);
            if (!r.ok) continue;
            const d = await r.json();
            if (d.accounts) pageResults[p - 1] = d.accounts;
          } catch { /* skip failed page */ }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, remaining.length) }, worker));

      const allAccounts: Account[] = pageResults.flat();

      const esc = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const exportedAt = new Date().toISOString();
      const metaLines = [
        `# Account Explorer Export`,
        `# Exported At: ${exportedAt}`,
        `# Total Results: ${allAccounts.length}`,
        `# Search: ${debouncedSearch || 'None'}`,
        `# Sort: ${sortKey} ${sortAsc ? 'asc' : 'desc'}`,
        `# Filters Applied: ${filtersSummary}`,
        ``,
      ];

      const headers = [
        'Domain', 'Brand Name', 'Category', 'SubCategory', 'Region', 'State', 'City',
        'Display Location', 'Business Model', 'Offline Stores', 'Store Count',
        'Monthly Visits', 'Scale Band', 'App Presence', 'Tech Count', 'Tech Stack',
        'Active Signals', 'Funding Stage', 'Harvin Score', 'Updated At', 'Filters Applied',
      ];

      const rows = allAccounts.map(a => [
        a.normalizedDomain, a.brandName || '', a.category, a.subCategory, a.region,
        (a as Account & { state?: string }).state || '',
        (a as Account & { city?: string }).city || '',
        a.displayLocation || '', a.businessModel || '',
        formatStores(a.offlineStores, a.storeRawCount),
        a.storeRawCount || a.aiStoreCount || '',
        a.monthlyVisitsFormatted || a.monthlyVisits || '',
        a.scaleBand || '', a.appPresence || '', a.techCount,
        (a.techStack || []).join('|'),
        (a.activeSignals || []).join('|'),
        a.fundingStage || '', a.harvinScore, a.updatedAt, filtersSummary,
      ].map(esc).join(','));

      const csv = [...metaLines, headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = exportedAt.replace(/[:.]/g, '-');
      link.href = url;
      link.download = `accounts-export-${stamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      showGlobalToast(`Exported ${allAccounts.length} accounts`, 'success');
    } catch (err) {
      console.error('[export] failed', err);
      showGlobalToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }, [exporting, filters, debouncedSearch, sortKey, sortAsc, buildAccountsParams]);

  /* ── My Universe ─────────────────────────────────────────────────── */
  const fetchUniverse = useCallback(async () => {
    const email = user?.email;
    if (!email) return;
    setUniverseLoading(true);
    try {
      const res = await fetch(`/api/universe?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setUniverseAccounts(data.accounts || []);
      setUniversePendingScan(data.pendingScan || 0);
      setUniverseStatuses(data.statuses || {});
    } catch (err) {
      console.error('Failed to fetch universe', err);
    } finally {
      setUniverseLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (activeTab === 'my-universe' && user?.email) fetchUniverse();
  }, [activeTab, user?.email, fetchUniverse]);

  const handleUniverseUpload = async (file: File) => {
    if (!user?.email) return;
    setUniverseUploading(true);
    try {
      const text = await file.text();
      const lines = text.split(/[\r\n]+/).filter(Boolean);
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes('domain') || header.includes('url') || header.includes('website') || header.includes('company');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      let colIndex = 0;
      if (hasHeader) {
        const cols = lines[0].split(/[,\t;|]/);
        colIndex = cols.findIndex(c => /domain|url|website|link/i.test(c));
        if (colIndex === -1) colIndex = 0;
      }
      const domains: string[] = [];
      for (const line of dataLines) {
        const cols = line.split(/[,\t;|]/);
        const raw = (cols[colIndex] || '').trim().replace(/^["']|["']$/g, '');
        if (!raw) continue;
        const domain = raw.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/.*$/, '').toLowerCase();
        if (domain && domain.includes('.') && domain.length > 3) domains.push(domain);
      }
      const unique = [...new Set(domains)];
      if (unique.length === 0) {
        showGlobalToast('No valid domains found in CSV', 'error');
        setUniverseUploading(false);
        return;
      }
      const res = await fetch('/api/universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, domains: unique }),
      });
      const data = await res.json();
      showGlobalToast(`Added ${data.added} brands to My Universe`, 'success');
      await fetchUniverse();
      if (data.needsScan > 0) scanUniverseDomains(unique);
    } catch (err) {
      console.error('Upload error:', err);
      showGlobalToast('Failed to upload CSV', 'error');
    } finally {
      setUniverseUploading(false);
    }
  };

  const scanUniverseDomains = async (domains: string[]) => {
    setUniverseScanning(true);
    const batchSize = 5;
    let scanned = 0;
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      setUniverseScanProgress(`Scanning ${Math.min(i + batchSize, domains.length)} / ${domains.length}...`);
      try {
        await fetch('/api/universe/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: batch }),
        });
        scanned += batch.length;
      } catch {}
    }
    setUniverseScanning(false);
    setUniverseScanProgress('');
    showGlobalToast(`Scanned ${scanned} brands successfully`, 'success');
    fetchUniverse();
  };

  const removeFromUniverse = async (domain: string) => {
    if (!user?.email) return;
    try {
      await fetch('/api/universe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, domains: [domain] }),
      });
      setUniverseAccounts(prev => prev.filter(a => a.normalizedDomain !== domain));
    } catch {}
  };

  const addToUniverse = async (domains: string[]) => {
    if (!user?.email || domains.length === 0) return;
    try {
      await fetch('/api/universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, domains }),
      });
      // Refresh universe count for sidebar badge
      const res = await fetch(`/api/universe?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      setUniverseAccounts(data.accounts || []);
      showGlobalToast(`${domains.length > 1 ? domains.length + ' brands' : domainToName(domains[0])} added to TAL`, 'success');
    } catch {}
  };

  const clearUniverse = async () => {
    if (!user?.email) return;
    try {
      await fetch('/api/universe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email }),
      });
      setUniverseAccounts([]);
      setUniverseStatuses({});
      showGlobalToast('Universe cleared', 'success');
    } catch {}
  };

  const updateUniverseStatus = async (domain: string, status: string) => {
    if (!user?.email) return;
    setUniverseStatuses(prev => {
      const next = { ...prev };
      if (status) next[domain] = status;
      else delete next[domain];
      return next;
    });
    try {
      await fetch('/api/universe', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, domain, status }),
      });
    } catch {}
  };

  const bulkUpdateUniverseStatus = async (status: string) => {
    if (!user?.email || universeSelected.size === 0) return;
    const domains = [...universeSelected];
    setUniverseStatuses(prev => {
      const next = { ...prev };
      for (const d of domains) {
        if (status) next[d] = status;
        else delete next[d];
      }
      return next;
    });
    setUniverseSelected(new Set());
    // Fire off updates in parallel
    await Promise.all(domains.map(domain =>
      fetch('/api/universe', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, domain, status }),
      }).catch(() => {})
    ));
  };

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
    const name = newWlName.trim();
    setNewWlName('');
    setShowCreateWl(false);
    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlists(prev => [data.watchlist, ...prev]);
      }
    } catch {}
  };

  const deleteWatchlist = async (id: string) => {
    // Optimistic: remove from UI immediately
    if (activeWatchlist?._id === id) { setActiveWatchlist(null); setWatchlistAccounts([]); }
    setWatchlists(prev => prev.filter(w => w._id !== id));
    showGlobalToast('Watchlist deleted', 'success');
    try {
      await fetch(`/api/watchlists?id=${id}`, { method: 'DELETE' });
    } catch {
      fetchWatchlists(); // Revert on failure
    }
  };

  const renameWatchlist = async (id: string) => {
    if (!renameValue.trim()) return;
    const newName = renameValue.trim();
    // Optimistic: update UI immediately
    setRenamingWl(null);
    setRenameValue('');
    setWatchlists(prev => prev.map(w => w._id === id ? { ...w, name: newName } : w));
    if (activeWatchlist?._id === id) setActiveWatchlist({ ...activeWatchlist, name: newName });
    try {
      await fetch('/api/watchlists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newName }),
      });
    } catch {}
  };

  const removeFromWatchlist = async (wlId: string, domain: string) => {
    // Optimistic: remove from UI immediately
    setWatchlistAccounts(prev => prev.filter(a => a.normalizedDomain !== domain));
    setWatchlists(prev => prev.map(w => w._id === wlId ? { ...w, domains: w.domains.filter(d => d !== domain) } : w));
    if (activeWatchlist?._id === wlId) {
      setActiveWatchlist(prev => prev ? { ...prev, domains: prev.domains.filter(d => d !== domain) } : prev);
    }
    try {
      await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wlId, domain, remove: true }),
      });
    } catch {}
  };

  /* ── Handlers ──────────────────────────────────────────────────────── */
  const toggle = (k: keyof Filters, v: string) => setFilters(p => {
    const newVal = p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v];
    const updated = { ...p, [k]: newVal };
    // Cascade: when region changes, clear state & city selections that may no longer be valid
    if (k === 'region') { updated.state = []; updated.city = []; }
    // When state changes, clear city selections
    if (k === 'state') { updated.city = []; }
    return updated;
  });
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
  // Select every account matching the current filters (across all pages), not just
  // the accounts visible on the current page. Fetches the full domain list from the API.
  const selectAll = async () => {
    if (selectingAll) return;
    // Already everything selected → deselect all
    if (total > 0 && selectedAccounts.size >= total) { setSelectedAccounts(new Set()); return; }
    setSelectingAll(true);
    try {
      const params = buildAccountsParams();
      params.set('domainsOnly', '1');
      const res = await fetch(`/api/accounts?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const domains: string[] = data.domains || [];
      setSelectedAccounts(new Set(domains));
    } catch (err) {
      console.error('Failed to select all accounts', err);
      // Fallback: select the current page so the action isn't a no-op
      setSelectedAccounts(new Set(accounts.map(a => a.normalizedDomain)));
    } finally {
      setSelectingAll(false);
    }
  };
  const clearSelection = () => setSelectedAccounts(new Set());

  const addSelectedToWatchlist = async (wlId: string) => {
    setBulkAdding(true);
    const domains = Array.from(selectedAccounts);
    // Optimistic: update local watchlist count
    setWatchlists(prev => prev.map(w => w._id === wlId ? { ...w, domains: [...new Set([...w.domains, ...domains])] } : w));
    setShowBulkWlDropdown(false);
    clearSelection();
    try {
      // Single bulk API call instead of N separate requests
      await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wlId, domains }),
      });
    } catch {}
    setBulkAdding(false);
  };

  const createAndAddToWatchlist = async () => {
    if (!bulkNewWlName.trim()) return;
    const name = bulkNewWlName.trim();
    setBulkAdding(true);
    setBulkNewWlName('');
    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        const wl = data.watchlist;
        if (wl?._id) {
          setWatchlists(prev => [wl, ...prev]);
          await addSelectedToWatchlist(wl._id);
        }
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

  // Close sort menu on outside click (use 'click' not 'mousedown' to avoid
  // race condition where menu unmounts before button onClick fires)
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e: MouseEvent) => {
      // Don't close if click is inside the sort menu
      const target = e.target as HTMLElement;
      if (target.closest('[data-sort-menu]')) return;
      setShowSortMenu(false);
    };
    // Use setTimeout to avoid closing immediately from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('click', handler);
    }, 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [showSortMenu]);

  // Clear selection when the filtered set changes (but NOT on page change — an
  // overall "select all" selection persists while paging through results).
  useEffect(() => { clearSelection(); }, [filters, debouncedSearch]);

  // Load watchlists for bulk-add dropdown when in account-explorer
  useEffect(() => {
    if (activeTab === 'account-explorer' && ready) fetchWatchlists();
  }, [activeTab, ready, fetchWatchlists]);

  const activeCount = countFilters(filters);

  // Filter panel resize handlers
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    filterResizing.current = true;
    const startX = e.clientX;
    const startW = filterWidth;
    const onMove = (ev: MouseEvent) => {
      if (!filterResizing.current) return;
      const newW = Math.min(480, Math.max(220, startW + (ev.clientX - startX)));
      setFilterWidth(newW);
    };
    const onUp = () => {
      filterResizing.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [filterWidth]);

  if (!ready) return null;
  const firstName = user?.name?.split(' ')[0] || 'there';


  const isSettingsTab = activeTab === 'icp-preferences' || activeTab === 'integrations';
  const isComingSoonTab = activeTab === 'competitor-clients' || activeTab === 'current-clients';
  const isRecentlyFundedTab = activeTab === 'recently-funded';
  const isAdminTab = activeTab === 'admin-accounts' || activeTab === 'brand-name-extractor';
  const isWatchlistTab = activeTab === 'my-watchlists';
  const isMarketIntelTab = activeTab === 'market-intelligence';
  const isTechScannerTab = activeTab === 'tech-scanner';
  const isCategoryFinderTab = activeTab === 'category-finder';
  const isLookalikeTab = activeTab === 'lookalike-brands';


  /* ── RENDER ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen w-full bg-[#FDFDFD] dark:bg-[#0a0a0a] font-sans text-slate-900 dark:text-white overflow-hidden">

      {/* ── Nav Sidebar (expanded with labels) ── */}
      <aside className="hidden md:flex flex-col bg-white dark:bg-[#141414] border-r border-slate-200 dark:border-white/[0.12] flex-shrink-0 w-[210px]">
        <div className="flex items-center gap-2.5 flex-shrink-0 px-5 py-4">
          <a href="/" className="flex items-center gap-0.5">
            <div className="h-7 w-8 overflow-hidden flex-shrink-0">
              <img src="/logo.svg" alt="" aria-hidden="true" className="h-7 w-auto max-w-none" />
            </div>
            <span className="font-bricolage font-bold text-[18px] tracking-normal text-slate-900 dark:text-white leading-none">Harvin<span className="font-semibold opacity-40">AI</span></span>
          </a>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-2.5 px-3 divide-y divide-slate-100 dark:divide-white/[0.06] [&>*]:pt-2.5 [&>*:first-child]:pt-0">
            <div>
              <h3 className="px-3 mb-1 text-[11px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Intelligence</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Zap size={18} />} label="Intelligence Hub" active={activeTab === 'market-intelligence'} onClick={() => setActiveTab('market-intelligence')} />
                <NavBtn icon={<Globe size={18} />} label="My Universe" active={activeTab === 'my-universe'} onClick={() => setActiveTab('my-universe')}
                  badge={universeAccounts.length > 0 ? String(universeAccounts.length) : undefined} />
              </div>
            </div>

            <div>
              <h3 className="px-3 mb-1 text-[11px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Discover</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Search size={18} />} label="Account Explorer" active={activeTab === 'account-explorer'} onClick={() => setActiveTab('account-explorer')} />
                <span data-tour="tech-scanner"><NavBtn icon={<Radar size={18} />} label="Tech Scanner" active={activeTab === 'tech-scanner'} onClick={() => setActiveTab('tech-scanner')} /></span>
                <NavBtn icon={<Layers size={18} />} label="Category Finder" active={activeTab === 'category-finder'} onClick={() => setActiveTab('category-finder')} />
                <NavBtn icon={<Target size={18} />} label="LookALike" active={activeTab === 'lookalike-brands'} onClick={() => setActiveTab('lookalike-brands')} />
              </div>
            </div>

            <div>
              <h3 className="px-3 mb-1 text-[11px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Watchlists</h3>
              <div className="space-y-0.5" data-tour="watchlists">
                <NavBtn icon={<Star size={18} />} label="My Watchlists" active={activeTab === 'my-watchlists'} onClick={() => setActiveTab('my-watchlists')}
                  badge={watchlists.length > 0 ? String(watchlists.length) : undefined} />
                <NavBtn icon={<Zap size={18} />} label="Market News" active={activeTab === 'recently-funded'} onClick={() => setActiveTab('recently-funded')} />
                <NavBtn icon={<Briefcase size={18} />} label="Current Clients" locked />
              </div>
            </div>

            <div>
              <h3 className="px-3 mb-1 text-[11px] font-black text-slate-500 dark:text-neutral-400 uppercase tracking-widest">Settings</h3>
              <div className="space-y-0.5">
                <NavBtn icon={<Settings2 size={18} />} label="ICP & Preferences" active={activeTab === 'icp-preferences'} onClick={() => setActiveTab('icp-preferences')} />
                <NavBtn icon={<Link2 size={18} />} label="Integrations" active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} />
              </div>
            </div>

            {isAdmin && (
              <div>
                <h3 className="px-3 mb-1 text-[11px] font-black text-red-500 dark:text-red-400 uppercase tracking-widest">Admin</h3>
                <div className="space-y-0.5">
                  <NavBtn icon={<Shield size={18} />} label="Manage Accounts" active={activeTab === 'admin-accounts'} onClick={() => setActiveTab('admin-accounts')} />
                  <NavBtn icon={<Tag size={18} />} label="Brand Name Extractor" active={activeTab === 'brand-name-extractor'} onClick={() => setActiveTab('brand-name-extractor')} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Theme toggle — cycles: Light → Dark → System */}
        <div className="px-3 pb-2 mt-auto flex-shrink-0">
          <button
            onClick={onToggleTheme}
            aria-label={`Switch theme (current: ${themeMode})`}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
          >
            {themeMode === 'light' ? (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : themeMode === 'dark' ? (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                <path d="M17.5 11.5A7.5 7.5 0 1 1 8.5 2.5a5.5 5.5 0 0 0 9 9z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 18h8M10 15v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            {themeMode === 'light' ? 'Light mode' : themeMode === 'dark' ? 'Dark mode' : 'System'}
          </button>
        </div>

        {/* User */}
        <div className="border-t border-slate-200 dark:border-white/[0.12] flex-shrink-0 px-3 py-2.5">
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

      {/* ── Filter Panel (Account Explorer + My Universe) ──────── */}
      {(activeTab === 'account-explorer' || activeTab === 'my-universe') && (
        <aside
          className="hidden md:flex flex-col bg-white dark:bg-[#141414] border-r border-slate-200 dark:border-white/[0.12] flex-shrink-0 relative transition-[width] duration-200 ease-out"
          style={{ width: filterCollapsed ? 0 : filterWidth, minWidth: filterCollapsed ? 0 : 220, overflow: filterCollapsed ? 'hidden' : undefined }}
        >
          {/* Collapse toggle */}
          <button
            onClick={() => setFilterCollapsed(!filterCollapsed)}
            className="absolute -right-3 top-[18px] z-20 w-6 h-6 rounded-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/[0.1] shadow-sm flex items-center justify-center text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/[0.2] transition-colors"
            title={filterCollapsed ? 'Show filters' : 'Hide filters'}
          >
            <svg className={`w-3 h-3 transition-transform ${filterCollapsed ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Resize handle */}
          {!filterCollapsed && (
            <div
              onMouseDown={onResizeStart}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-[#C94C1E]/20 active:bg-[#C94C1E]/30 transition-colors"
            />
          )}

          <div className="h-[56px] px-5 flex items-center border-b border-slate-200 dark:border-white/[0.12] flex-shrink-0" data-tour="filters">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-[#C94C1E]" />
              <h2 className="font-bold text-slate-800 dark:text-white text-[14px]">Filters</h2>
              {activeCount > 0 && <span className="text-[10px] bg-orange-100 dark:bg-[#C94C1E]/10 text-[#C94C1E] px-1.5 py-0.5 rounded-full font-bold">{activeCount}</span>}
            </div>
          </div>

          <div className="px-4 pt-3 pb-2" data-tour="search">
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
              <p className="px-3 text-[12.5px] font-extrabold text-slate-700 dark:text-neutral-200 tracking-[0.02em] mt-1 mb-1.5">Category</p>
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
              <p className="px-3 text-[12.5px] font-extrabold text-slate-700 dark:text-neutral-200 tracking-[0.02em] mt-1 mb-1.5">Business Model</p>
              {['Pure D2C', 'Omnichannel', 'D2C + Marketplace', 'D2C + B2B'].map(v => (
                <FilterItem key={v} label={v} on={filters.businessModel.includes(v)} onClick={() => toggle('businessModel', v)} />
              ))}

              <p className="px-3 text-[12.5px] font-extrabold text-slate-700 dark:text-neutral-200 tracking-[0.02em] mt-3 mb-1.5">Scale (Est. Traffic)</p>
              {['<50K', '50K-200K', '200K-500K', '500K-1M', '1M-5M', '5M-20M', '20M+'].map(v => (
                <FilterItem key={v} label={v} on={filters.scale.includes(v)} onClick={() => toggle('scale', v)} />
              ))}

              <p className="px-3 text-[12.5px] font-extrabold text-slate-700 dark:text-neutral-200 tracking-[0.02em] mt-3 mb-1.5">Offline Presence</p>
              {['Online Only', '1-10 stores', '11-20 stores', '21-50 stores', '51-100 stores', '100+ stores'].map(v => (
                <FilterItem key={v} label={v} on={filters.offlinePresence.includes(v)} onClick={() => toggle('offlinePresence', v)} />
              ))}

              <p className="px-3 text-[12.5px] font-extrabold text-slate-700 dark:text-neutral-200 tracking-[0.02em] mt-3 mb-1.5">App Presence</p>
              {['No App', 'iOS Only', 'Android Only', 'Both iOS & Android'].map(v => (
                <FilterItem key={v} label={v} on={filters.appPresence.includes(v)} onClick={() => toggle('appPresence', v)} />
              ))}
            </FilterSection>

            <FilterSection title="Tech Stack" count={filters.techStack.length} defaultOpen={false}>
              <FilterItem label="None detected" on={filters.techStack.includes('None detected')} onClick={() => toggle('techStack', 'None detected')} />
              {/* Tech categories — each with its own search + dropdown */}
              {(() => {
                const TECH_FILTER_CATS: [string[], string][] = [
                  [['Ecommerce', 'Ecommerce Platform'], 'Ecommerce'],
                  [['Marketing automation'], 'Marketing Automation'],
                  [['Analytics', 'Analytics & Behavior', 'Analytics & Optimization Platform'], 'Analytics'],
                  [['Live chat', 'Customer Support'], 'Live Chat'],
                  [['Buy now pay later', 'Buy Now Pay Later', 'Payments & Checkout - Checkout / BNPL'], 'BNPL'],
                  [['Payment processors', 'Payments & Checkout - Gateway', 'Payments & Checkout Platform'], 'Payment Processors'],
                  [['CRM', 'Customer Engagement / CRM'], 'CRM'],
                  [['Advertising', 'Retargeting'], 'Advertising & Retargeting'],
                  [['Shipping', 'Shipping & Logistics'], 'Shipping Carriers'],
                  [['Loyalty & rewards', 'Loyalty & Rewards'], 'Loyalty & Rewards'],
                ];
                return (
                  <>
                    {TECH_FILTER_CATS.map(([dbCats, displayName]) => {
                      const techs = [...new Set(dbCats.flatMap(c => filterOptions.techStackOptions[c] || []))].sort();
                      if (techs.length === 0) return null;
                      return (
                        <TechCategoryGroup key={displayName} category={displayName} techs={techs} filters={filters} toggle={toggle} />
                      );
                    })}
                  </>
                );
              })()}
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

          {activeCount > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-200 dark:border-white/[0.12] flex-shrink-0">
              <button onClick={clearAll}
                className="w-full py-1.5 rounded-lg text-[11px] font-semibold text-[#C94C1E] border border-[#C94C1E]/20 hover:bg-[#C94C1E]/5 dark:hover:bg-[#C94C1E]/10 transition-colors">
                Clear All Filters
              </button>
            </div>
          )}
        </aside>
      )}

      {/* ── Main Area ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F9F9F9] dark:bg-[#0a0a0a] relative">

        {/* Header */}
        <header className="h-[64px] border-b border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#141414] px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            {filterCollapsed && (activeTab === 'account-explorer' || activeTab === 'my-universe') && (
              <button
                onClick={() => setFilterCollapsed(false)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold
                           bg-[#C94C1E] text-white shadow-[0_2px_8px_rgba(201,76,30,0.3)] hover:bg-[#b5431a] transition-all"
              >
                <Filter size={14} />
                Show Filters
                {activeCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white">{activeCount}</span>
                )}
              </button>
            )}
            <div className="h-2 w-2 rounded-full bg-[#C94C1E]" />
            <h1 className="text-[18px] font-bold text-slate-800 dark:text-white">{TAB_TITLES[activeTab]}</h1>
            {activeTab === 'account-explorer' && <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">{total} results</span>}
            {activeTab === 'my-universe' && universeAccounts.length > 0 && <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">{universeAccounts.length} brands</span>}
            {activeTab !== 'account-explorer' && activeTab !== 'my-universe' && !isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && !isTechScannerTab && !isCategoryFinderTab && !isLookalikeTab && !isRecentlyFundedTab && <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">{total} results</span>}
            {isWatchlistTab && activeWatchlist && <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">{activeWatchlist.domains?.length || 0} accounts</span>}
          </div>

          {!isSettingsTab && !isComingSoonTab && !isMarketIntelTab && !isTechScannerTab && !isCategoryFinderTab && !isLookalikeTab && !isRecentlyFundedTab && !isAdminTab && !isWatchlistTab && activeTab !== 'my-universe' && (
            <div className="flex items-center gap-2" data-tour="sort-export">
              {/* Sort */}
              <div className="relative">
                <button onClick={() => setShowSortMenu(p => !p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all">
                  <ArrowUpDown size={14} className="text-slate-400 dark:text-neutral-500" />
                  Sort
                </button>
                {showSortMenu && (
                  <div data-sort-menu className="absolute right-0 top-full mt-1 bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] py-1 w-[220px] z-50">
                    {/* Recommended */}
                    <div className="px-3 pt-1.5 pb-1 text-[9px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest">Recommended</div>
                    {([
                      { key: 'harvinScore', label: 'Harvin Score (High → Low)', asc: false },
                      { key: 'monthlyVisits', label: 'Traffic (High → Low)', asc: false },
                      { key: 'techCount', label: 'Tech Stack (Most → Least)', asc: false },
                      { key: 'offlineStores', label: 'Stores (Most → Least)', asc: false },
                    ] as { key: SortKey; label: string; asc: boolean }[]).map(opt => (
                      <button key={opt.label} onClick={() => { setSortKey(opt.key); setSortAsc(opt.asc); setPage(1); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${sortKey === opt.key && sortAsc === opt.asc ? 'text-[#C94C1E] font-semibold bg-orange-50 dark:bg-[#C94C1E]/10' : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
                        {opt.label}
                      </button>
                    ))}
                    {/* Alphabetical */}
                    <div className="px-3 pt-2.5 pb-1 text-[9px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest border-t border-slate-200 dark:border-white/[0.12] mt-1">Alphabetical</div>
                    {([
                      { key: 'domain', label: 'Name (A → Z)', asc: true },
                      { key: 'domain', label: 'Name (Z → A)', asc: false },
                      { key: 'category', label: 'Category (A → Z)', asc: true },
                      { key: 'region', label: 'Region (A → Z)', asc: true },
                    ] as { key: SortKey; label: string; asc: boolean }[]).map(opt => (
                      <button key={opt.label} onClick={() => { setSortKey(opt.key); setSortAsc(opt.asc); setPage(1); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${sortKey === opt.key && sortAsc === opt.asc ? 'text-[#C94C1E] font-semibold bg-orange-50 dark:bg-[#C94C1E]/10' : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
                        {opt.label}
                      </button>
                    ))}
                    {/* Other */}
                    <div className="px-3 pt-2.5 pb-1 text-[9px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest border-t border-slate-200 dark:border-white/[0.12] mt-1">Other</div>
                    {([
                      { key: 'updatedAt', label: 'Last Updated', asc: false },
                      { key: 'monthlyVisits', label: 'Traffic (Low → High)', asc: true },
                      { key: 'techCount', label: 'Tech Stack (Least → Most)', asc: true },
                      { key: 'offlineStores', label: 'Stores (Least → Most)', asc: true },
                      { key: 'harvinScore', label: 'Harvin Score (Low → High)', asc: true },
                    ] as { key: SortKey; label: string; asc: boolean }[]).map(opt => (
                      <button key={opt.label} onClick={() => { setSortKey(opt.key); setSortAsc(opt.asc); setPage(1); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${sortKey === opt.key && sortAsc === opt.asc ? 'text-[#C94C1E] font-semibold bg-orange-50 dark:bg-[#C94C1E]/10' : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Export */}
              <button
                onClick={handleExportAll}
                disabled={exporting || total === 0}
                title={exporting ? 'Exporting…' : `Export all ${total} filtered results`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Download size={14} className={`text-slate-400 dark:text-neutral-500 ${exporting ? 'animate-pulse' : ''}`} />
                {exporting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          )}
        </header>

        {/* Active filter chips */}
        {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && !isTechScannerTab && !isCategoryFinderTab && activeCount > 0 && (
          <div className="bg-white dark:bg-[#141414] border-b border-slate-200 dark:border-white/[0.12] px-8 py-2.5 flex items-center gap-3 overflow-x-auto custom-scrollbar">
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
          ) : isAdminTab ? (
            activeTab === 'brand-name-extractor'
              ? <BrandNameExtractorView showToast={showGlobalToast} />
              : <AdminAccountsView showToast={showGlobalToast} />
          ) : isRecentlyFundedTab ? (
            /* ── Recently Funded ─────────────────────────────────── */
            <RecentlyFundedView />
          ) : isLookalikeTab ? (
            /* ── LookALike Brands ────────────────────────────────── */
            <LookALikeBrandsView initialDomain={initialLookalikeDomain} />
          ) : isCategoryFinderTab ? (
            /* ── Category Finder ─────────────────────────────────── */
            <CategoryFinderView />
          ) : isTechScannerTab ? (
            /* ── Tech Scanner ────────────────────────────────────── */
            <TechScannerView initialDomain={initialScanDomain} />
          ) : isWatchlistTab ? (
            /* ── Watchlists View (Lead Intelligence) ───────────────── */
            <WatchlistView
              watchlists={watchlists} activeWatchlist={activeWatchlist} watchlistAccounts={watchlistAccounts as WatchlistAccount[]}
              wlLoading={wlLoading} showCreateWl={showCreateWl} newWlName={newWlName}
              renamingWl={renamingWl} renameValue={renameValue}
              setShowCreateWl={setShowCreateWl} setNewWlName={setNewWlName}
              setRenamingWl={setRenamingWl} setRenameValue={setRenameValue}
              createWatchlist={createWatchlist} deleteWatchlist={deleteWatchlist}
              renameWatchlist={renameWatchlist} fetchWatchlistDetail={fetchWatchlistDetail}
              removeFromWatchlist={removeFromWatchlist} setActiveWatchlist={setActiveWatchlist}
              setWatchlistAccounts={setWatchlistAccounts} setActiveTab={setActiveTab}
              formatDate={formatDate} domainToName={domainToName}
            />
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
                        <div key={int.name} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-white/[0.12] hover:border-slate-200 dark:hover:border-white/[0.08] transition-colors">
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
          ) : activeTab === 'my-universe' ? (
            /* ── My Universe View ───────────────────────────────────── */
            <div className="max-w-6xl mx-auto space-y-5">
              <input ref={universeFileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUniverseUpload(f); e.target.value = ''; }} />

              {/* Top bar: Import button + status tabs + actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => universeFileRef.current?.click()} disabled={universeUploading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-[#b5431a] transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50">
                    {universeUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    {universeUploading ? 'Uploading...' : 'Import CSV'}
                  </button>
                  {universeAccounts.length > 0 && (
                    <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] rounded-lg p-0.5">
                      {([
                        { key: 'all', label: 'All' },
                        { key: 'in-conversation', label: 'In Conversation' },
                        { key: 'active-client', label: 'Active Client' },
                        { key: 'churned-client', label: 'Churned' },
                      ] as { key: UniverseStatus; label: string }[]).map(tab => {
                        const count = tab.key === 'all' ? universeAccounts.length : universeAccounts.filter(a => universeStatuses[a.normalizedDomain] === tab.key).length;
                        return (
                          <button key={tab.key} onClick={() => setUniverseStatusFilter(tab.key)}
                            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${universeStatusFilter === tab.key ? 'bg-white dark:bg-[#1a1a1a] text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700'}`}>
                            {tab.label}{count > 0 && tab.key !== 'all' ? ` (${count})` : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {universeAccounts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { const csv = ['Domain,Category,SubCategory,Region,BusinessModel,Traffic,Store Count,Tech Count,Tech Stack,Status', ...universeAccounts.map(a => [a.normalizedDomain, a.category, a.subCategory, a.region, a.businessModel || '', a.monthlyVisitsFormatted || '', `"${formatStores(a.offlineStores, a.storeRawCount)}"`, a.techCount || (a.techStack || []).length || '', `"${(a.techStack || []).join('|')}"`, universeStatuses[a.normalizedDomain] || ''].join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'my-universe.csv'; link.click(); URL.revokeObjectURL(url); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all">
                      <Download size={14} /> Export
                    </button>
                    <button onClick={clearUniverse}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-[12px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                      <Trash2 size={14} /> Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Scanning Progress */}
              {universeScanning && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <Loader2 size={16} className="text-amber-600 dark:text-amber-400 animate-spin flex-shrink-0" />
                  <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-300">{universeScanProgress || 'Scanning brands...'}</p>
                </div>
              )}

              {/* Universe Account List */}
              {universeLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 size={32} className="text-[#C94C1E] animate-spin mb-4" />
                  <p className="text-[13px] text-slate-400 dark:text-neutral-500">Loading your universe...</p>
                </div>
              ) : universeAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-4">
                    <Globe size={24} className="text-slate-300 dark:text-neutral-600" />
                  </div>
                  <p className="text-[15px] font-semibold text-slate-600 dark:text-neutral-300 mb-1">Your Universe is empty</p>
                  <p className="text-[12px] text-slate-400 dark:text-neutral-500 max-w-sm mb-4">Upload a CSV with company URLs/domains to get started. We&apos;ll enrich each brand with category, tech stack, traffic, and more.</p>
                  <button onClick={() => universeFileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-[#b5431a] transition-colors shadow-lg shadow-orange-500/20">
                    <FileSpreadsheet size={16} /> Choose CSV File
                  </button>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-3">Supports .csv, .tsv — columns: domain, url, or website</p>
                </div>
              ) : (() => {
                const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
                  'in-conversation': { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/30' },
                  'active-client': { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30' },
                  'churned-client': { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-500/30' },
                };
                const STATUS_LABELS: Record<string, string> = { 'in-conversation': 'In Conversation', 'active-client': 'Active Client', 'churned-client': 'Churned' };
                // Apply sidebar filters + search + status filter
                const applyFilters = (list: Account[]) => {
                  return list.filter(a => {
                    if (search && !a.normalizedDomain.toLowerCase().includes(search.toLowerCase())) return false;
                    if (filters.category.length > 0 && !filters.category.includes(a.category)) return false;
                    if (filters.region.length > 0 && !filters.region.includes(a.region)) return false;
                    if (filters.state.length > 0) {
                      const loc = a.displayLocation || '';
                      if (!filters.state.some(s => loc.includes(s))) return false;
                    }
                    if (filters.city.length > 0) {
                      const loc = a.displayLocation || '';
                      if (!filters.city.some(c => loc.includes(c))) return false;
                    }
                    if (filters.businessModel.length > 0 && (!a.businessModel || !filters.businessModel.includes(a.businessModel))) return false;
                    if (filters.scale.length > 0 && (!a.scaleBand || !filters.scale.includes(a.scaleBand))) return false;
                    if (filters.offlinePresence.length > 0 && !filters.offlinePresence.includes(a.offlineStores)) return false;
                    if (filters.appPresence.length > 0 && (!a.appPresence || !filters.appPresence.includes(a.appPresence))) return false;
                    if (filters.techStack.length > 0 && !filters.techStack.some(t => (a.techStack || []).includes(t))) return false;
                    if (filters.activeSignals.length > 0 && !filters.activeSignals.some(s => (a.activeSignals || []).includes(s))) return false;
                    if (filters.funding.length > 0 && (!a.fundingStage || !filters.funding.includes(a.fundingStage))) return false;
                    return true;
                  });
                };
                const statusFiltered = universeStatusFilter === 'all'
                  ? universeAccounts
                  : universeAccounts.filter(a => universeStatuses[a.normalizedDomain] === universeStatusFilter);
                const filtered = applyFilters(statusFiltered);

                return filtered.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-[14px] text-slate-500 dark:text-neutral-400">{activeCount > 0 || search ? 'No accounts match the current filters.' : 'No accounts with this status.'}</p>
                    {(activeCount > 0 || search) && <button onClick={() => { clearAll(); setSearch(''); }} className="mt-2 text-[12px] text-[#C94C1E] font-semibold hover:text-[#b5431a]">Clear filters</button>}
                  </div>
                ) : (
                  <>
                    {/* Bulk action bar */}
                    {universeSelected.size > 0 && (
                      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#C94C1E]/5 dark:bg-[#C94C1E]/10 border border-[#C94C1E]/20">
                        <span className="text-[12px] font-bold text-[#C94C1E]">{universeSelected.size} selected</span>
                        <div className="h-4 w-px bg-[#C94C1E]/20" />
                        <button onClick={() => bulkUpdateUniverseStatus('in-conversation')}
                          className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                          In Conversation
                        </button>
                        <button onClick={() => bulkUpdateUniverseStatus('active-client')}
                          className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                          Active Client
                        </button>
                        <button onClick={() => bulkUpdateUniverseStatus('churned-client')}
                          className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                          Churned
                        </button>
                        <button onClick={() => bulkUpdateUniverseStatus('')}
                          className="px-3 py-1 rounded-lg text-[11px] font-semibold text-slate-500 dark:text-neutral-400 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                          Clear Status
                        </button>
                        <button onClick={() => setUniverseSelected(new Set())}
                          className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Table */}
                    <div className="bg-white dark:bg-[#141414]/60 border border-slate-200/80 dark:border-white/[0.06] rounded-xl overflow-hidden">
                      {/* Table header */}
                      <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_minmax(200px,280px)_70px_90px_140px_68px] items-center px-4 py-3 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/60 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                        <div className="flex items-center gap-3">
                          <button onClick={() => {
                            if (universeSelected.size === filtered.length) setUniverseSelected(new Set());
                            else setUniverseSelected(new Set(filtered.map(a => a.normalizedDomain)));
                          }} className="flex items-center justify-center ml-1">
                            <div className={`w-[16px] h-[16px] rounded border-2 flex items-center justify-center transition-all ${
                              universeSelected.size === filtered.length && filtered.length > 0 ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15]'
                            }`}>
                              {universeSelected.size === filtered.length && filtered.length > 0 && <Check size={10} className="text-white stroke-[3]" />}
                            </div>
                          </button>
                          <span>Company</span>
                        </div>
                        <span>Tech Stack</span>
                        <span className="text-center">Score</span>
                        <span className="text-right">Traffic</span>
                        <span className="text-center">Status</span>
                        <span></span>
                      </div>

                      {/* Table rows */}
                      <div className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
                        {filtered.map(a => {
                          const name = safeBrandName(a.brandName) || domainToName(a.normalizedDomain);
                          const topTech = pickPriorityTech((a.techStack || []) as string[], techCategoryLookup);
                          const scanned = (a as Record<string, unknown>).scanned !== false;
                          const status = universeStatuses[a.normalizedDomain] || '';
                          const sc = STATUS_COLORS[status];
                          const isSelected = universeSelected.has(a.normalizedDomain);
                          return (
                            <div key={a.normalizedDomain}
                              className={`grid grid-cols-1 lg:grid-cols-[44px_minmax(0,1fr)_minmax(200px,280px)_70px_90px_140px_68px] items-center transition-colors group cursor-pointer ${
                                isSelected ? 'bg-[#C94C1E]/[0.03] dark:bg-[#C94C1E]/[0.06]' : 'hover:bg-slate-50/60 dark:hover:bg-white/[0.02]'
                              }`}
                              onClick={() => router.push(`/account/${a.normalizedDomain}`)}>

                              {/* Checkbox */}
                              <div className="hidden lg:flex items-center justify-center py-4" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setUniverseSelected(prev => {
                                  const next = new Set(prev);
                                  if (next.has(a.normalizedDomain)) next.delete(a.normalizedDomain);
                                  else next.add(a.normalizedDomain);
                                  return next;
                                })}>
                                  <div className={`w-[16px] h-[16px] rounded border-2 flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.12] group-hover:border-slate-400'
                                  }`}>
                                    {isSelected && <Check size={10} className="text-white stroke-[3]" />}
                                  </div>
                                </button>
                              </div>

                              {/* Company */}
                              <div className="flex items-center gap-3 px-4 lg:px-2 py-3.5 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.12] flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={`https://www.google.com/s2/favicons?domain=${a.normalizedDomain}&sz=64`} alt="" width={20} height={20} className="rounded dark:bg-white dark:p-[2px] dark:rounded-md"
                                    onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; t.parentElement!.innerHTML = `<span class="font-serif text-slate-400 text-[14px]">${name[0]}</span>`; }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="text-[13px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors truncate">{name}</h3>
                                    {!scanned && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[9px] font-bold flex-shrink-0">
                                        <Loader2 size={9} className="animate-spin" /> Scanning
                                      </span>
                                    )}
                                    {sc && (
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold flex-shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                        {STATUS_LABELS[status]}
                                      </span>
                                    )}
                                    {(!a.offlineStores || a.offlineStores === 'Online' || a.offlineStores === 'Online Only') ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 text-[9px] font-bold flex-shrink-0">
                                        <Globe size={9} /> Online
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[9px] font-bold flex-shrink-0">
                                        {formatStores(a.offlineStores, a.storeRawCount)} stores
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                                    {[a.category !== 'Unknown' && a.category, a.region !== 'Global' && a.region, a.businessModel].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                              </div>

                              {/* Tech pills */}
                              <div className="hidden lg:flex items-center gap-1.5 px-2 flex-wrap">
                                {topTech.length > 0 ? topTech.map(t => {
                                  // Shorten long names for pills
                                  const short = t.replace('Google Analytics', 'GA4').replace('Google Tag Manager', 'GTM').replace('Google Ads', 'GAds').replace('Facebook Pixel', 'FB Pixel').replace('WooCommerce', 'WooCommerce').replace('JavaScript Libraries', 'JS Libs');
                                  return (
                                    <span key={t} title={t} className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-[10px] font-medium text-slate-600 dark:text-neutral-300 whitespace-nowrap">{short}</span>
                                  );
                                }) : (
                                  <span className="text-[11px] text-slate-300 dark:text-neutral-600">—</span>
                                )}
                                {(a.techStack || []).length > 3 && (
                                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium whitespace-nowrap">+{(a.techStack || []).length - 3}</span>
                                )}
                              </div>

                              {/* Harvin Score */}
                              <div className="hidden lg:flex items-center justify-center px-2">
                                {(() => {
                                  const s = a.harvinScore || 0;
                                  const color = s >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                                    : s >= 45 ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30'
                                    : s >= 25 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-white/[0.04] dark:text-neutral-400 dark:border-white/[0.08]';
                                  return (
                                    <span className={`inline-flex items-center justify-center w-[38px] h-[24px] rounded-lg border text-[11px] font-bold ${color}`}>
                                      {s}
                                    </span>
                                  );
                                })()}
                              </div>

                              {/* Traffic */}
                              <div className="hidden lg:flex items-center justify-end px-2">
                                {a.monthlyVisitsFormatted ? (
                                  <span className="text-[12px] font-semibold text-slate-700 dark:text-neutral-300">{a.monthlyVisitsFormatted}</span>
                                ) : (
                                  <span className="text-[11px] text-slate-300 dark:text-neutral-600">—</span>
                                )}
                              </div>

                              {/* Status dropdown */}
                              <div className="hidden lg:flex items-center justify-center px-2" onClick={e => e.stopPropagation()}>
                                <select
                                  value={status}
                                  onChange={e => updateUniverseStatus(a.normalizedDomain, e.target.value)}
                                  className={`w-full text-[11px] font-semibold rounded-lg border px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#C94C1E]/20 focus:border-[#C94C1E] cursor-pointer transition-colors ${
                                    status
                                      ? `${sc?.bg || ''} ${sc?.text || ''} ${sc?.border || 'border-slate-200'}`
                                      : 'bg-transparent text-slate-400 dark:text-neutral-500 border-slate-200 dark:border-white/[0.08]'
                                  }`}
                                >
                                  <option value="">Set status</option>
                                  <option value="in-conversation">In Conversation</option>
                                  <option value="active-client">Active Client</option>
                                  <option value="churned-client">Churned</option>
                                </select>
                              </div>

                              {/* Actions */}
                              <div className="hidden lg:flex items-center justify-center gap-0.5" onClick={e => e.stopPropagation()}>
                                <a href={`https://${a.normalizedDomain}`} target="_blank" rel="noopener noreferrer"
                                  className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-neutral-500 hover:text-[#C94C1E] hover:bg-orange-50 dark:hover:bg-[#C94C1E]/10 transition-all" title="Visit website">
                                  <ExternalLink size={13} />
                                </a>
                                <button onClick={() => removeFromUniverse(a.normalizedDomain)}
                                  className="w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="Remove">
                                  <Trash2 size={13} />
                                </button>
                              </div>

                              {/* Mobile row */}
                              <div className="flex lg:hidden items-center gap-2 px-4 pb-3">
                                {a.monthlyVisitsFormatted && (
                                  <span className="text-[10px] font-semibold text-slate-500">{a.monthlyVisitsFormatted}</span>
                                )}
                                {topTech.slice(0, 2).map(t => (
                                  <span key={t} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-[10px] font-medium text-slate-500">{t}</span>
                                ))}
                                <div className="ml-auto" onClick={e => e.stopPropagation()}>
                                  <select value={status} onChange={e => updateUniverseStatus(a.normalizedDomain, e.target.value)}
                                    className="text-[10px] font-semibold rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#1a1a1a] text-slate-500 dark:text-neutral-400 px-2 py-1 outline-none cursor-pointer">
                                    <option value="">Status</option>
                                    <option value="in-conversation">In Conversation</option>
                                    <option value="active-client">Active Client</option>
                                    <option value="churned-client">Churned</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
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
                <button onClick={selectAll} disabled={selectingAll}
                  className="flex items-center gap-2 text-[12px] font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors disabled:opacity-60">
                  {total > 0 && selectedAccounts.size >= total
                    ? <CheckSquare size={16} className="text-[#C94C1E]" />
                    : <Square size={16} />}
                  <span>
                    {selectingAll
                      ? 'Selecting…'
                      : total > 0 && selectedAccounts.size >= total
                        ? 'Deselect all'
                        : `Select all${total > 0 ? ` ${total.toLocaleString()}` : ''}`}
                  </span>
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
                          <div className="p-3 border-b border-slate-200 dark:border-white/[0.12]">
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
                          <div className="p-3 border-t border-slate-200 dark:border-white/[0.12]">
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
              <div className="space-y-3" data-tour="account-list">
                {accounts.map(raw => {
                  const a = demoFill(raw);
                  const isSelected = selectedAccounts.has(a.normalizedDomain);
                  const name = safeBrandName(a.brandName) || domainToName(a.normalizedDomain);
                  const signalCount = (a.activeSignals || []).length + (a.techSignals || []).length;
                  const topTech = [...new Set((a.techStack || []) as string[])].slice(0, 3);
                  return (
                    <div key={a.normalizedDomain}
                      className={`bg-white dark:bg-[#141414]/60 border rounded-xl overflow-hidden transition-all group ${isSelected ? 'border-[#C94C1E]/40 ring-2 ring-[#C94C1E]/10' : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.12] hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]'}`}>
                      <div className="flex gap-0 min-h-[152px]">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(a.normalizedDomain); }}
                          className={`flex-shrink-0 w-11 flex items-start pt-5 justify-center self-stretch border-r transition-colors ${
                            isSelected ? 'bg-[#C94C1E]/5 border-[#C94C1E]/10' : 'border-slate-200 dark:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.04]'
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
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.12] flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={faviconUrl(a.normalizedDomain)} alt="" width={24} height={24} className="rounded dark:bg-white dark:p-[2px] dark:rounded-md"
                                onError={(e) => {
                                  const t = e.target as HTMLImageElement;
                                  t.style.display = 'none';
                                  t.parentElement!.innerHTML = `<span class="font-serif text-slate-400 text-[16px]">${name[0]}</span>`;
                                }} />
                            </div>

                            {/* Name + badges */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <h3 className="text-[15px] font-extrabold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors truncate">{name}</h3>
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
                                <span key={t} className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[11px] font-semibold text-slate-600 dark:text-neutral-300">{t}</span>
                              ))}
                              {(a.techStack || []).length > 3 && (
                                <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium">+{(a.techStack || []).length - 3}</span>
                              )}
                            </div>
                          </div>

                          {/* Row 2-4 wrapper: left content + Harvin Score on right */}
                          <div className="flex items-stretch">
                            {/* Left: Category, pills, signals */}
                            <div className="flex-1 min-w-0">
                              {/* Row 2: Category · Location · Business Model */}
                              <div className="px-4 pb-2 flex items-center gap-3 text-[12px] text-slate-600 dark:text-neutral-300 font-semibold">
                                {a.category && <span className="font-bold">{a.category}</span>}
                                {a.displayLocation && <><span className="text-slate-300 dark:text-neutral-600">·</span><span>{a.displayLocation}</span></>}
                                {a.businessModel && <><span className="text-slate-300 dark:text-neutral-600">·</span><span>{a.businessModel}</span></>}
                              </div>

                              {/* Row 3: Detail pills */}
                              <div className="px-4 pb-2.5 flex items-center gap-2 flex-wrap">
                                {a.scaleBand && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-[10px] font-bold text-slate-600 dark:text-neutral-300">
                                    <TrendingUp size={10} className="text-blue-400" />{a.scaleBand}{a.monthlyVisitsFormatted ? ` (${a.monthlyVisitsFormatted})` : ''}
                                  </span>
                                )}
                                {a.appPresence && a.appPresence !== 'No App' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-[10px] font-bold text-slate-600 dark:text-neutral-300">
                                    <Smartphone size={10} className="text-violet-400" />{a.appPresence}
                                  </span>
                                )}
                                {a.offlineStores && a.offlineStores !== 'Online' && a.offlineStores !== 'Online Only' && a.offlineStores !== 'Unknown' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <Store size={10} />{formatStores(a.offlineStores, a.storeRawCount)} stores
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                                    <Globe size={10} /> Online
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right: Harvin Score */}
                            <div className="flex items-center justify-center px-5 flex-shrink-0">
                              {(() => {
                                const s = a.harvinScore || 0;
                                const scoreColor = s >= 70
                                  ? 'border-[#C94C1E] text-[#C94C1E] bg-[#C94C1E]/5'
                                  : s >= 45
                                  ? 'border-blue-400 text-blue-600 bg-blue-50 dark:border-blue-500/40 dark:text-blue-400 dark:bg-blue-500/10'
                                  : s >= 25
                                  ? 'border-amber-400 text-amber-600 bg-amber-50 dark:border-amber-500/40 dark:text-amber-400 dark:bg-amber-500/10'
                                  : 'border-slate-300 text-slate-400 bg-slate-50 dark:border-white/[0.1] dark:text-neutral-500 dark:bg-white/[0.04]';
                                return (
                                  <div className={`flex flex-col items-center justify-center w-[58px] h-[58px] rounded-xl border-2 ${scoreColor}`} title={`Harvin Score: ${s}/100`}>
                                    <span className="text-[20px] font-black leading-none">{s}</span>
                                    <span className="text-[8px] font-bold uppercase tracking-wider opacity-60 mt-0.5">Score</span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Row 4: Buying signals — tech-derived intelligence, tech migration, funding */}
                          {(() => {
                            const tm = a.techMigration;
                            const hasTm = !!tm && ((tm.added?.length || 0) > 0 || (tm.removed?.length || 0) > 0);
                            const techSignals = (a.techSignals || []).slice(0, 3);
                            const otherSignals = (a.activeSignals || []).filter(s => !(hasTm && s === 'Tech Migration'));
                            const platform = detectPlatform(a.techStack);
                            const SIG_STYLE: Record<string, { cls: string; Icon: typeof Megaphone }> = {
                              ent:     { cls: 'text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/25', Icon: Building2 },
                              ad:      { cls: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/25', Icon: Megaphone },
                              sub:     { cls: 'text-violet-700 dark:text-violet-300 bg-violet-100/70 dark:bg-violet-500/15 border-violet-200 dark:border-violet-500/25', Icon: Repeat },
                              sms:     { cls: 'text-sky-700 dark:text-sky-300 bg-sky-100/70 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/25', Icon: MessageCircle },
                              cdp:     { cls: 'text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/25', Icon: Database },
                              loyalty: { cls: 'text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/25', Icon: Gift },
                            };
                            return (
                              <div className="px-4 pb-3 flex items-center flex-wrap gap-x-2.5 gap-y-1.5">
                                {techSignals.map((sig, i) => {
                                  const st = SIG_STYLE[sig.tone] || SIG_STYLE.cdp;
                                  const Ic = st.Icon;
                                  return (
                                    <span key={`ts-${i}`}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10.5px] font-bold ${st.cls}`}
                                      title={sig.detail ? `${sig.label} — ${sig.detail}` : sig.label}>
                                      <Ic size={11} />{sig.label}{sig.detail ? <span className="font-semibold opacity-70">· {sig.detail}</span> : null}
                                    </span>
                                  );
                                })}
                                {hasTm && (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                                        title="Tech stack changed since the previous scan">
                                    <Repeat size={11} className="text-sky-500" />
                                    {(tm!.added?.length || 0) > 0 && (
                                      <span className="text-emerald-600 dark:text-emerald-400">now {tm!.added.join(', ')}</span>
                                    )}
                                    {(tm!.removed?.length || 0) > 0 && (
                                      <span className="text-slate-400 dark:text-neutral-500 line-through decoration-1">was {tm!.removed.join(', ')}</span>
                                    )}
                                  </span>
                                )}
                                {a.fundingStage && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600">
                                    <DollarSign size={12} className="text-green-500" />{a.fundingStage}
                                  </span>
                                )}
                                {otherSignals.map(s => (
                                  <span key={s} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
                                    <Target size={10} className="text-amber-400" />{s}
                                  </span>
                                ))}
                                {/* Universal meta — present on every card so Row 4 is always
                                    populated and left-aligned, keeping every card consistent
                                    whether or not the account has buying signals. */}
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-neutral-500">
                                  {platform && (
                                    <>
                                      <ShoppingCart size={11} className="opacity-70" />
                                      <span className="font-semibold text-slate-500 dark:text-neutral-400">{platform}</span>
                                      <span className="opacity-40">·</span>
                                    </>
                                  )}
                                  <span>Updated {formatDate(a.updatedAt)}</span>
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Visit button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`https://${a.normalizedDomain}`, '_blank'); }}
                          className="flex-shrink-0 w-10 flex items-start pt-5 justify-center self-stretch border-l border-slate-200 dark:border-white/[0.12] text-slate-300 dark:text-neutral-600 hover:text-[#C94C1E] hover:bg-orange-50/50 dark:hover:bg-[#C94C1E]/10 transition-colors"
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
        {!isSettingsTab && !isComingSoonTab && !isWatchlistTab && !isMarketIntelTab && !isTechScannerTab && !isCategoryFinderTab && !isLookalikeTab && !isRecentlyFundedTab && !isAdminTab && activeTab !== 'my-universe' && (
          <footer className="h-[52px] border-t border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#141414] px-6 flex items-center justify-between flex-shrink-0">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="h-8 px-4 rounded-full text-[11px] font-semibold bg-[#C94C1E]/10 dark:bg-[#C94C1E]/15 text-[#C94C1E] dark:text-[#e8754d] hover:bg-[#C94C1E]/20 dark:hover:bg-[#C94C1E]/25 transition-colors disabled:opacity-30 disabled:hover:bg-[#C94C1E]/10 flex items-center gap-1">
              <ChevronLeft size={13} /> Previous
            </button>
            <div className="flex items-center gap-1">
              {(() => {
                const pages: (number | string)[] = [];
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else if (page <= 3) {
                  pages.push(1, 2, 3, 4, 5, '...', totalPages);
                } else if (page >= totalPages - 2) {
                  pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                } else {
                  pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
                }
                return pages.map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} className="w-8 text-center text-[12px] text-slate-300 dark:text-neutral-600 select-none">...</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p as number)}
                      className={`w-8 h-8 rounded-full text-[12px] font-semibold transition-all ${
                        p === page
                          ? 'bg-[#C94C1E] text-white shadow-sm'
                          : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                      }`}>{p}</button>
                  )
                );
              })()}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="h-8 px-4 rounded-full text-[11px] font-semibold bg-[#C94C1E]/10 dark:bg-[#C94C1E]/15 text-[#C94C1E] dark:text-[#e8754d] hover:bg-[#C94C1E]/20 dark:hover:bg-[#C94C1E]/25 transition-colors disabled:opacity-30 disabled:hover:bg-[#C94C1E]/10 flex items-center gap-1">
              Next <ChevronRight size={13} />
            </button>
            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-slate-200 dark:border-white/[0.12]">
              <span className="text-[11px] text-slate-400 dark:text-neutral-500 whitespace-nowrap">Go to</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                placeholder="#"
                className="w-12 h-8 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] text-center text-[12px] font-semibold text-slate-700 dark:text-neutral-200 outline-none focus:border-[#C94C1E] focus:ring-1 focus:ring-[#C94C1E]/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    if (val >= 1 && val <= totalPages) { setPage(val); (e.target as HTMLInputElement).value = ''; }
                  }
                }}
              />
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

      {/* Guided tour for new users */}
      <DashboardTour />

      {/* AI Chatbot */}
      <ChatBot />

      {/* Global toast — top right */}
      {globalToast && (
        <div className={`fixed top-5 right-5 z-[200] px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 max-w-[400px] ${
          globalToast.type === 'success' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-red-600 text-white'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            globalToast.type === 'success' ? 'bg-emerald-500' : 'bg-white/20'
          }`}>
            {globalToast.type === 'success' ? <Check size={14} className="text-white stroke-[3]" /> : <X size={14} className="text-white" />}
          </div>
          <p className="text-[13px] font-semibold flex-1">{globalToast.msg}</p>
          <button onClick={() => setGlobalToast(null)} className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-2">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── NavBtn (sidebar navigation button, expanded with labels) ── */
function NavBtn({ icon, label, active, locked, onClick, badge }: {
  icon: React.ReactNode; label: string; active?: boolean; locked?: boolean; onClick?: () => void; badge?: string;
}) {
  if (locked) {
    return (
      <div className="flex items-center justify-between rounded-lg text-slate-400 dark:text-neutral-500 cursor-not-allowed transition-all px-3 py-1.5">
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
      className={`w-full flex items-center gap-2.5 rounded-lg transition-all px-3 py-1.5 ${
        active
          ? 'bg-orange-50 dark:bg-[#C94C1E]/10 text-[#C94C1E]'
          : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className={`text-[13px] ${active ? 'font-extrabold' : 'font-bold'}`}>{label}</span>
      {badge && <span className="ml-auto text-[9px] bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-neutral-400 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
    </button>
  );
}

/* ── Market Intelligence View ─────────────────────────────────────────── */
const SIGNAL_SECTIONS = [
  { key: 'funding', label: 'Funding Activity', icon: <DollarSign size={18} />, color: 'text-amber-400', bg: 'bg-amber-400/10', apiType: 'funding' },
  { key: 'hiring', label: 'Key Hiring', icon: <Users size={18} />, color: 'text-cyan-400', bg: 'bg-cyan-400/10', apiType: 'key_hire' },
  { key: 'stores', label: 'Store Expansion', icon: <Store size={18} />, color: 'text-blue-400', bg: 'bg-blue-400/10', apiType: 'store_expansion' },
  { key: 'apps', label: 'App Launches', icon: <Smartphone size={18} />, color: 'text-violet-400', bg: 'bg-violet-400/10', apiType: 'app_launch' },
  { key: 'marketplace', label: 'Marketplace Expansion', icon: <Layers size={18} />, color: 'text-rose-400', bg: 'bg-rose-400/10', apiType: 'marketplace' },
  { key: 'growth', label: 'High Growth', icon: <TrendingUp size={18} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10', apiType: 'traffic_growth' },
] as const;

/* ── Market News Views ─────────────────────────────────────────────────── */
type MarketNewsArticle = {
  title: string;
  snippet: string;
  url: string;
  source: string;
  sourceName: string;
  imageUrl: string;
  publishedAt: string;
  newsType: string;
  companyName: string;
  category: string;
  headline: string;
  summary: string;
  country: string | null;
  marketImpact: string;
  confidence: number;
  details: {
    // Funding
    amount?: string | null;
    amountUSD?: number | null;
    round?: string | null;
    investors?: string[];
    // Hiring
    person?: string | null;
    role?: string | null;
    roleLevel?: string | null;
    hiringCount?: number | null;
    // Acquisition
    acquirer?: string | null;
    target?: string | null;
    dealAmount?: string | null;
    // Launch
    productName?: string | null;
    market?: string | null;
    // Shutdown
    reason?: string | null;
    impactedCount?: number | null;
    // Regulatory
    regulator?: string | null;
    impact?: string | null;
    // Partnership
    partner?: string | null;
  };
};

type MarketNewsStats = {
  newsTypes: Record<string, number>;
  categories: Record<string, number>;
  countries: Record<string, number>;
  totalFundingUSD: number;
  highImpact: number;
};

const NEWS_PERIODS = [
  { key: '24h', label: '24h' },
  { key: '3d', label: '3 Days' },
  { key: '7d', label: '7 Days' },
  { key: '14d', label: '14 Days' },
  { key: '30d', label: '30 Days' },
];

const NEWS_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; badgeClass: string }> = {
  funding:     { label: 'Funding',     icon: '$',  color: '#10b981', badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  hiring:      { label: 'Hiring',      icon: '+',  color: '#3b82f6', badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  acquisition: { label: 'Acquisition', icon: 'M',  color: '#8b5cf6', badgeClass: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400' },
  launch:      { label: 'Launch',      icon: '!',  color: '#f59e0b', badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  shutdown:    { label: 'Shutdown',    icon: 'x',  color: '#ef4444', badgeClass: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  regulatory:  { label: 'Regulatory',  icon: 'R',  color: '#6366f1', badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' },
  partnership: { label: 'Partnership', icon: 'P',  color: '#14b8a6', badgeClass: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400' },
  expansion:   { label: 'Expansion',   icon: 'E',  color: '#f97316', badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
  other:       { label: 'Other',       icon: '?',  color: '#94a3b8', badgeClass: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-neutral-300' },
};

const ROUND_COLORS: Record<string, string> = {
  'Pre-Seed': 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
  'Seed': 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  'Pre-Series A': 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  'Series A': 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  'Series B': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  'Series C': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  'Series D': 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  'Debt': 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-neutral-300',
  'Bridge': 'bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400',
  'IPO': 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatUSD(m: number) {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  if (m >= 1) return `$${m.toFixed(0)}M`;
  return `$${(m * 1000).toFixed(0)}K`;
}

function NewsDetailBadge({ article }: { article: MarketNewsArticle }) {
  const d = article.details;
  switch (article.newsType) {
    case 'funding':
      return d.amount ? (
        <span className="inline-block text-[13px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg">
          {d.amount}
        </span>
      ) : null;
    case 'hiring':
      return d.role ? (
        <span className="inline-block text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg">
          {d.roleLevel === 'mass-hiring' ? `${d.hiringCount || ''}+ hiring` : d.roleLevel === 'layoff' ? `${d.impactedCount || ''} layoffs` : d.role}
        </span>
      ) : null;
    case 'acquisition':
      return d.dealAmount ? (
        <span className="inline-block text-[11px] font-bold text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2.5 py-1 rounded-lg">
          {d.dealAmount}
        </span>
      ) : null;
    case 'shutdown':
      return d.impactedCount ? (
        <span className="inline-block text-[11px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg">
          {d.impactedCount} affected
        </span>
      ) : null;
    default:
      return null;
  }
}

function NewsSubDetail({ article }: { article: MarketNewsArticle }) {
  const d = article.details;
  switch (article.newsType) {
    case 'funding':
      return d.investors && d.investors.length > 0 ? (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <Users size={12} className="text-slate-400 dark:text-neutral-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">
            {d.investors.slice(0, 4).join(', ')}{d.investors.length > 4 && ` +${d.investors.length - 4} more`}
          </span>
        </div>
      ) : null;
    case 'hiring':
      return d.person ? (
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={12} className="text-blue-400 dark:text-blue-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">
            {d.person}{d.role ? ` as ${d.role}` : ''}
          </span>
        </div>
      ) : null;
    case 'acquisition':
      return d.acquirer && d.target ? (
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp size={12} className="text-violet-400 dark:text-violet-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">
            {d.acquirer} acquires {d.target}
          </span>
        </div>
      ) : null;
    case 'partnership':
      return d.partner ? (
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={12} className="text-teal-400 dark:text-teal-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">
            Partnership with {d.partner}
          </span>
        </div>
      ) : null;
    case 'launch':
      return d.productName ? (
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={12} className="text-amber-400 dark:text-amber-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">
            {d.productName}{d.market ? ` in ${d.market}` : ''}
          </span>
        </div>
      ) : null;
    case 'regulatory':
      return d.regulator ? (
        <div className="flex items-center gap-1.5 mb-2">
          <Shield size={12} className="text-indigo-400 dark:text-indigo-500 flex-shrink-0" />
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">
            {d.regulator}{d.impact ? ` (${d.impact})` : ''}
          </span>
        </div>
      ) : null;
    default:
      return null;
  }
}

function RecentlyFundedView() {
  const [articles, setArticles] = useState<MarketNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MarketNewsStats>({ newsTypes: {}, categories: {}, countries: {}, totalFundingUSD: 0, highImpact: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [period, setPeriod] = useState('7d');
  const [newsType, setNewsType] = useState('all');
  const [category, setCategory] = useState('all');
  const [country, setCountry] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period, page: String(page), limit: '30' });
    if (newsType !== 'all') params.set('newsType', newsType);
    if (category !== 'all') params.set('category', category);
    if (country !== 'all') params.set('country', country);
    if (debouncedSearch) params.set('search', debouncedSearch);

    fetch(`/api/market-news?${params}`)
      .then(r => r.json())
      .then(data => {
        setArticles(data.articles || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.stats) setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period, newsType, category, country, debouncedSearch, page]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [period, newsType, category, country, debouncedSearch]);

  const topCategories = Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topCountries = Object.entries(stats.countries).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const totalNews = Object.values(stats.newsTypes).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Total News</p>
          <p className="text-[22px] font-bold text-slate-800 dark:text-white mt-0.5">{totalNews}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Funding</p>
          <p className="text-[22px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.totalFundingUSD > 0 ? formatUSD(stats.totalFundingUSD) : (stats.newsTypes.funding || 0)}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Hiring</p>
          <p className="text-[22px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">{stats.newsTypes.hiring || 0}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">High Impact</p>
          <p className="text-[22px] font-bold text-red-600 dark:text-red-400 mt-0.5">{stats.highImpact}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Categories</p>
          <p className="text-[22px] font-bold text-slate-800 dark:text-white mt-0.5">{Object.keys(stats.categories).length}</p>
        </div>
      </div>

      {/* News type tabs */}
      <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={() => setNewsType('all')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${newsType === 'all' ? 'bg-[#C94C1E] text-white shadow-sm' : 'bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-white'}`}>
            All {totalNews > 0 && `(${totalNews})`}
          </button>
          {Object.entries(NEWS_TYPE_CONFIG).map(([key, cfg]) => {
            const count = stats.newsTypes[key] || 0;
            if (count === 0 && key !== newsType) return null;
            return (
              <button key={key} onClick={() => setNewsType(key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${newsType === key ? cfg.badgeClass + ' ring-1 ring-current/20' : 'bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-white'}`}>
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period pills */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-white/[0.04] rounded-lg p-0.5">
            {NEWS_PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${period === p.key ? 'bg-white dark:bg-white/[0.1] text-[#C94C1E] shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a1a] text-[11px] font-semibold text-slate-700 dark:text-neutral-300 outline-none focus:border-[#C94C1E] transition-colors">
            <option value="all">All Categories</option>
            {topCategories.map(([c, n]) => (
              <option key={c} value={c}>{c} ({n})</option>
            ))}
          </select>

          {/* Country filter */}
          <select value={country} onChange={e => setCountry(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a1a] text-[11px] font-semibold text-slate-700 dark:text-neutral-300 outline-none focus:border-[#C94C1E] transition-colors">
            <option value="all">All Countries</option>
            {topCountries.map(([c, n]) => (
              <option key={c} value={c}>{c} ({n})</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" size={13} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search company, category, news..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a1a] text-[11px] font-medium text-slate-700 dark:text-neutral-300 placeholder-slate-400 dark:placeholder-neutral-500 outline-none focus:border-[#C94C1E] transition-colors" />
          </div>
        </div>
      </div>

      {/* News feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#C94C1E]" />
          <span className="ml-3 text-[13px] text-slate-400 dark:text-neutral-500">Loading market news...</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-12 text-center">
          <Zap size={40} className="mx-auto text-slate-200 dark:text-neutral-700 mb-3" />
          <p className="text-[15px] font-semibold text-slate-500 dark:text-neutral-400">No market news found</p>
          <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-1.5 max-w-md mx-auto">
            {debouncedSearch || newsType !== 'all' || category !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Run the market news scanner: node scripts/market-news-scan.js'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a, idx) => {
            const ntCfg = NEWS_TYPE_CONFIG[a.newsType] || NEWS_TYPE_CONFIG.other;
            return (
              <a key={`${a.companyName}-${idx}`} href={a.url} target="_blank" rel="noopener noreferrer"
                className="block bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:border-[#C94C1E]/30 hover:shadow-md hover:shadow-orange-500/5 transition-all group">
                <div className="flex items-start gap-4 p-5">
                  {/* News type icon */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-[16px] font-black border"
                    style={{ backgroundColor: ntCfg.color + '12', borderColor: ntCfg.color + '25', color: ntCfg.color }}>
                    {ntCfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[15px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors">
                        {a.companyName || 'Unknown'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ntCfg.badgeClass}`}>
                        {ntCfg.label}
                      </span>
                      {a.newsType === 'funding' && a.details?.round && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ROUND_COLORS[a.details.round] || 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-neutral-300'}`}>
                          {a.details.round}
                        </span>
                      )}
                      {a.category && (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 bg-slate-50 dark:bg-white/[0.04] px-2 py-0.5 rounded-md">
                          {a.category}
                        </span>
                      )}
                      {a.marketImpact === 'high' && (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md">
                          HIGH IMPACT
                        </span>
                      )}
                    </div>

                    <p className="text-[13px] text-slate-600 dark:text-neutral-300 leading-relaxed mb-2 line-clamp-2">
                      {a.summary || a.headline || a.title}
                    </p>

                    {/* Type-specific sub-detail */}
                    <NewsSubDetail article={a} />

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-neutral-500">
                      {a.country && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {a.country}
                        </span>
                      )}
                      {a.sourceName && <span>{a.sourceName}</span>}
                      <span>{timeAgo(a.publishedAt)}</span>
                      <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* Right badge */}
                  <div className="flex-shrink-0">
                    <NewsDetailBadge article={a} />
                  </div>
                </div>
              </a>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[12px] text-slate-400 dark:text-neutral-500">
                Showing {(page - 1) * 30 + 1}-{Math.min(page * 30, total)} of {total} news
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-semibold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[12px] font-bold text-slate-600 dark:text-neutral-300">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[12px] font-semibold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Competitor Clients View ──────────────────────────────────────────── */
function CompetitorClientsView() {
  const router = useRouter();
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [sourceDomain, setSourceDomain] = useState('');
  const [accounts, setAccounts] = useState<LookAlikeAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    const d = competitorDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (d) setSourceDomain(d);
  };

  useEffect(() => {
    if (!sourceDomain) return;
    setLoading(true);
    fetch(`/api/account/${encodeURIComponent(sourceDomain)}/similar?basis=category,tech&limit=500`)
      .then(r => r.json())
      .then(data => {
        setAccounts(data.accounts || []);
        setLoading(false);
        setSearched(true);
      })
      .catch(() => { setLoading(false); setSearched(true); });
  }, [sourceDomain]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm dark:shadow-none">
        <h2 className="text-[16px] font-bold text-slate-800 dark:text-white mb-1">Find Competitor Clients</h2>
        <p className="text-[13px] text-slate-400 dark:text-neutral-500 mb-4">Enter a competitor&apos;s domain to find brands similar to them — potential clients who may switch.</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={competitorDomain}
            onChange={e => setCompetitorDomain(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Enter competitor domain (e.g. clevertap.com)"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-[14px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 outline-none focus:border-[#C94C1E] focus:ring-2 focus:ring-[#C94C1E]/10 transition-all"
          />
          <button onClick={handleSearch}
            className="px-6 py-3 rounded-xl bg-[#C94C1E] text-white text-[14px] font-semibold hover:bg-[#b5431a] transition-colors shadow-sm">
            Find Clients
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[#C94C1E]" />
          <span className="ml-3 text-[13px] text-slate-400">Finding competitor clients...</span>
        </div>
      ) : accounts.length > 0 ? (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.12] flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">Brands similar to {sourceDomain}</h3>
            <span className="text-[12px] text-slate-400 dark:text-neutral-500">{accounts.length} results</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.04] max-h-[60vh] overflow-y-auto custom-scrollbar">
            {accounts.map(a => (
              <button key={a.normalizedDomain} onClick={() => router.push(`/account/${a.normalizedDomain}`)}
                className="w-full flex items-center gap-3.5 px-6 py-3.5 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://www.google.com/s2/favicons?domain=${a.normalizedDomain}&sz=64`} alt="" className="w-9 h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] flex-shrink-0 bg-white dark:bg-white/[0.04] p-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors truncate block">{a.name}</span>
                  <span className="text-[12px] text-slate-500 dark:text-neutral-400">{a.category} · {a.region}</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                  {a.monthlyVisitsFormatted && <span className="text-[10px] font-bold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded">{a.monthlyVisitsFormatted}</span>}
                  {a.businessModel && <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 px-2 py-0.5 rounded">{a.businessModel}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : searched ? (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-12 text-center">
          <Swords size={36} className="mx-auto text-slate-200 dark:text-neutral-700 mb-3" />
          <p className="text-[14px] font-semibold text-slate-500 dark:text-neutral-400">No similar brands found</p>
          <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-1">Try a different competitor domain</p>
        </div>
      ) : !sourceDomain ? (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-12 text-center">
          <Swords size={36} className="mx-auto text-slate-200 dark:text-neutral-700 mb-3" />
          <p className="text-[14px] font-semibold text-slate-600 dark:text-neutral-300">Enter a competitor domain to get started</p>
          <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-1">We&apos;ll find brands with similar category and tech stack</p>
        </div>
      ) : null}
    </div>
  );
}

/* ── LookALike Brands View ─────────────────────────────────────────────── */
type LookAlikeAccount = {
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

const LOOKALIKE_BASES = [
  { key: 'category', label: 'Category', icon: <Layers size={14} /> },
  { key: 'tech', label: 'Tech Stack', icon: <Code size={14} /> },
  { key: 'appPresence', label: 'App Presence', icon: <Smartphone size={14} /> },
  { key: 'offlineStores', label: 'Stores', icon: <Store size={14} /> },
  { key: 'businessModel', label: 'Business Model', icon: <Briefcase size={14} /> },
  { key: 'region', label: 'Region', icon: <Globe size={14} /> },
];

function LookALikeBrandsView({ initialDomain = '' }: { initialDomain?: string }) {
  const router = useRouter();
  const [searchDomain, setSearchDomain] = useState(initialDomain);
  const [sourceDomain, setSourceDomain] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [activeBases, setActiveBases] = useState<Set<string>>(new Set(['category']));
  const [accounts, setAccounts] = useState<LookAlikeAccount[]>([]);
  const [basisLabel, setBasisLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [sourceCategory, setSourceCategory] = useState('');

  // Filters for narrowing results
  const [filterRegion, setFilterRegion] = useState('');
  const [filterBizModel, setFilterBizModel] = useState('');
  const [filterAppPresence, setFilterAppPresence] = useState('');
  const [filterStores, setFilterStores] = useState('');

  // Auto-search if initialDomain provided
  useEffect(() => {
    if (initialDomain) {
      const d = initialDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
      setSourceDomain(d);
      setSearchDomain(d);
    }
  }, [initialDomain]);

  // Watchlist
  const [watchlists, setWatchlists] = useState<{_id: string; name: string; domains: string[]}[]>([]);
  const [wlDropdown, setWlDropdown] = useState(false);
  const [wlNewName, setWlNewName] = useState('');
  const [wlAdded, setWlAdded] = useState(false);

  useEffect(() => {
    fetch('/api/watchlists').then(r => r.json()).then(d => setWatchlists(d.watchlists || [])).catch(() => {});
  }, []);

  const addSelectedToWatchlist = async (wlId: string) => {
    let targetId = wlId;
    if (wlId.startsWith('new:')) {
      try {
        const res = await fetch('/api/watchlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: wlId.slice(4) }) });
        const data = await res.json();
        if (data.watchlist?._id) { targetId = data.watchlist._id; setWatchlists(prev => [...prev, data.watchlist]); }
        else return;
      } catch { return; }
    }
    for (const d of selected) {
      await fetch('/api/watchlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: targetId, domain: d }) }).catch(() => {});
    }
    setWlDropdown(false);
    setWlAdded(true);
    setTimeout(() => { setWlAdded(false); setSelected(new Set()); }, 1500);
  };

  const toggleBasis = (key: string) => {
    setActiveBases(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); if (next.size === 0) next.add('category'); }
      else next.add(key);
      return next;
    });
  };

  const fetchLookalikes = useCallback(async () => {
    if (!sourceDomain) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const basesParam = [...activeBases].join(',');
      const res = await fetch(`/api/account/${encodeURIComponent(sourceDomain)}/similar?basis=${basesParam}&limit=500`);
      const data = await res.json();
      setAccounts(data.accounts || []);
      setBasisLabel(data.basisLabel || '');
      if (data.source?.name) setSourceName(data.source.name);
      if (data.source?.category) setSourceCategory(data.source.category);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [sourceDomain, activeBases]);

  useEffect(() => {
    if (sourceDomain) fetchLookalikes();
  }, [sourceDomain, activeBases, fetchLookalikes]);

  const handleSearch = () => {
    const d = searchDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (d) setSourceDomain(d);
  };

  const selectAll = () => {
    if (selected.size === filteredAccounts.length) setSelected(new Set());
    else setSelected(new Set(filteredAccounts.map(a => a.normalizedDomain)));
  };

  // Client-side filter
  const filteredAccounts = accounts.filter(a => {
    if (filterRegion && a.region !== filterRegion) return false;
    if (filterBizModel && (a.businessModel || 'Pure D2C') !== filterBizModel) return false;
    if (filterAppPresence && a.appPresence !== filterAppPresence) return false;
    if (filterStores && a.offlineStores !== filterStores) return false;
    return true;
  });

  // Extract unique values for filter dropdowns
  const uniqueRegions = [...new Set(accounts.map(a => a.region).filter(Boolean))].sort();
  const uniqueBizModels = [...new Set(accounts.map(a => a.businessModel || 'Pure D2C').filter(Boolean))].sort();
  const uniqueAppPresence = [...new Set(accounts.map(a => a.appPresence).filter(Boolean))].sort();
  const uniqueStores = [...new Set(accounts.map(a => a.offlineStores).filter(Boolean))].sort();
  const activeFilterCount = [filterRegion, filterBizModel, filterAppPresence, filterStores].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm dark:shadow-none">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchDomain}
            onChange={e => setSearchDomain(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Enter domain (e.g. nykaa.com)"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] text-[14px] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 outline-none focus:border-[#C94C1E] focus:ring-2 focus:ring-[#C94C1E]/10 transition-all"
          />
          <button onClick={handleSearch}
            className="px-6 py-3 rounded-xl bg-[#C94C1E] text-white text-[14px] font-semibold hover:bg-[#b5431a] transition-colors shadow-sm">
            Find LookAlikes
          </button>
        </div>
      </div>

      {/* Results with filter sidebar */}
      {sourceDomain && (
        <div className="flex gap-6">
          {/* Filter sidebar */}
          <div className="hidden lg:block w-[240px] flex-shrink-0 space-y-4">
            <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-slate-800 dark:text-white">Filters</h3>
                {activeFilterCount > 0 && (
                  <button onClick={() => { setFilterRegion(''); setFilterBizModel(''); setFilterAppPresence(''); setFilterStores(''); }}
                    className="text-[11px] text-[#C94C1E] font-semibold">Clear all</button>
                )}
              </div>

              {/* Category (fixed) */}
              <div className="mb-4">
                <p className="text-[10px] font-extrabold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Category</p>
                <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-[12px] font-semibold text-slate-700 dark:text-neutral-200">
                  {sourceCategory || 'All'}
                </div>
              </div>

              {/* Region */}
              {uniqueRegions.length > 1 && (
                <div className="mb-4">
                  <p className="text-[10px] font-extrabold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Region</p>
                  <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[12px] font-medium text-slate-700 dark:text-neutral-200 outline-none focus:border-[#C94C1E]">
                    <option value="">All Regions</option>
                    {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* Business Model */}
              {uniqueBizModels.length > 1 && (
                <div className="mb-4">
                  <p className="text-[10px] font-extrabold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Business Model</p>
                  <select value={filterBizModel} onChange={e => setFilterBizModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[12px] font-medium text-slate-700 dark:text-neutral-200 outline-none focus:border-[#C94C1E]">
                    <option value="">All Models</option>
                    {uniqueBizModels.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}

              {/* App Presence */}
              {uniqueAppPresence.length > 1 && (
                <div className="mb-4">
                  <p className="text-[10px] font-extrabold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">App Presence</p>
                  <select value={filterAppPresence} onChange={e => setFilterAppPresence(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[12px] font-medium text-slate-700 dark:text-neutral-200 outline-none focus:border-[#C94C1E]">
                    <option value="">All</option>
                    {uniqueAppPresence.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              )}

              {/* Offline Stores */}
              {uniqueStores.length > 1 && (
                <div className="mb-4">
                  <p className="text-[10px] font-extrabold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Offline Stores</p>
                  <select value={filterStores} onChange={e => setFilterStores(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[12px] font-medium text-slate-700 dark:text-neutral-200 outline-none focus:border-[#C94C1E]">
                    <option value="">All</option>
                    {uniqueStores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Similarity basis */}
              <div>
                <p className="text-[10px] font-extrabold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Similar By</p>
                <div className="space-y-1">
                  {LOOKALIKE_BASES.map(b => {
                    const isActive = activeBases.has(b.key);
                    return (
                      <button key={b.key} onClick={() => toggleBasis(b.key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all text-left ${
                          isActive ? 'bg-[#C94C1E]/10 text-[#C94C1E]' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                        }`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15]'
                        }`}>
                          {isActive && <Check size={10} className="text-white stroke-[3]" />}
                        </div>
                        {b.icon}
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.12] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">Similar to {sourceName || sourceDomain}</h3>
                {sourceCategory && <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-0.5">{sourceCategory}{basisLabel ? ` · ${basisLabel}` : ''}</p>}
              </div>
              <div className="flex items-center gap-3">
                {wlAdded && <span className="text-[12px] font-bold text-emerald-600">Added!</span>}
                {selected.size > 0 && !wlAdded && (
                  <div className="relative">
                    <button onClick={() => setWlDropdown(!wlDropdown)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C94C1E] text-white text-[13px] font-semibold hover:bg-[#b5431a] transition-all shadow-sm">
                      <Plus size={14} /> Add {selected.size} to Watchlist
                    </button>
                    {wlDropdown && (
                      <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-2xl z-20 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                          <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Add {selected.size} accounts to</p>
                        </div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar">
                          {watchlists.map(wl => (
                            <button key={wl._id} onClick={() => addSelectedToWatchlist(wl._id)}
                              className="w-full text-left px-4 py-3 text-[13px] font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] border-b border-slate-50 dark:border-white/[0.02] last:border-0 transition-colors flex items-center justify-between">
                              <span>{wl.name}</span>
                              <span className="text-[11px] text-slate-400 font-medium">{wl.domains?.length || 0}</span>
                            </button>
                          ))}
                          {watchlists.length === 0 && <p className="px-4 py-4 text-[12px] text-slate-400 text-center">No watchlists yet</p>}
                        </div>
                        <div className="p-3 border-t border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                          <div className="flex gap-2">
                            <input type="text" placeholder="New watchlist name..." value={wlNewName} onChange={e => setWlNewName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && wlNewName.trim()) { addSelectedToWatchlist('new:' + wlNewName.trim()); setWlNewName(''); } }}
                              className="flex-1 px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/[0.1] rounded-lg text-[12px] text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-[#C94C1E] transition-colors" />
                            <button onClick={() => { if (wlNewName.trim()) { addSelectedToWatchlist('new:' + wlNewName.trim()); setWlNewName(''); } }}
                              className="px-4 py-2 rounded-lg bg-[#C94C1E] hover:bg-[#b5431a] text-white text-[12px] font-bold transition-colors">Create</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selected.size > 0 && !wlAdded && <span className="text-[13px] font-bold text-[#C94C1E]">{selected.size} selected</span>}
                {!loading && <span className="text-[12px] text-slate-400 dark:text-neutral-500">{filteredAccounts.length} of {accounts.length} results{activeFilterCount > 0 ? ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''})` : ''}</span>}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="px-5 py-3 border-b border-slate-200 dark:border-white/[0.12] flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              <Filter size={13} className="text-slate-400 dark:text-neutral-500 flex-shrink-0 mr-1" />
              {LOOKALIKE_BASES.map(b => {
                const isActive = activeBases.has(b.key);
                return (
                  <button key={b.key} onClick={() => toggleBasis(b.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 border ${
                      isActive
                        ? 'bg-[#C94C1E] text-white border-transparent shadow-sm'
                        : 'bg-white dark:bg-white/[0.04] text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-white/[0.08] hover:border-[#C94C1E]/30 hover:text-[#C94C1E]'
                    }`}>
                    {isActive && <Check size={11} className="stroke-[3]" />}
                    {b.icon}
                    {b.label}
                  </button>
                );
              })}
            </div>

            {/* Select bar */}
            {accounts.length > 0 && (
              <div className="px-5 py-2.5 border-b border-slate-200 dark:border-white/[0.12] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.01]">
                <button onClick={selectAll} className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-neutral-300 hover:text-slate-800 dark:hover:text-white transition-colors">
                  <div className={`w-[16px] h-[16px] rounded border-2 flex items-center justify-center transition-all ${
                    selected.size > 0 && selected.size === accounts.length ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15]'
                  }`}>
                    {selected.size > 0 && selected.size === accounts.length && <Check size={10} className="text-white stroke-[3]" />}
                  </div>
                  {selected.size > 0 && selected.size === accounts.length ? 'Deselect all' : `Select all (${accounts.length})`}
                </button>
              </div>
            )}

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-[#C94C1E]" />
                  <span className="ml-3 text-[13px] text-slate-400 dark:text-neutral-500">Finding lookalikes...</span>
                </div>
              ) : accounts.length === 0 && searched ? (
                <div className="text-center py-16">
                  <Radar size={36} className="mx-auto text-slate-200 dark:text-neutral-700 mb-3" />
                  <p className="text-[14px] font-semibold text-slate-500 dark:text-neutral-400">No lookalikes found</p>
                  <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-1">Try different filter combinations</p>
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[14px] font-semibold text-slate-400 dark:text-neutral-500">No accounts match the current filters</p>
                  <button onClick={() => { setFilterRegion(''); setFilterBizModel(''); setFilterAppPresence(''); setFilterStores(''); }}
                    className="text-[12px] text-[#C94C1E] font-semibold mt-2">Clear filters</button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {filteredAccounts.map(a => (
                    <div key={a.normalizedDomain}
                      className={`flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group ${
                        selected.has(a.normalizedDomain) ? 'bg-orange-50/40 dark:bg-[#C94C1E]/5' : ''
                      }`}>
                      {/* Checkbox */}
                      <button onClick={() => {
                        setSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(a.normalizedDomain)) next.delete(a.normalizedDomain); else next.add(a.normalizedDomain);
                          return next;
                        });
                      }}
                        className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          selected.has(a.normalizedDomain) ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15] group-hover:border-[#C94C1E]/50'
                        }`}>
                        {selected.has(a.normalizedDomain) && <Check size={11} className="text-white stroke-[3]" />}
                      </button>

                      {/* Favicon */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://www.google.com/s2/favicons?domain=${a.normalizedDomain}&sz=64`} alt="" className="w-9 h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] flex-shrink-0 bg-white dark:bg-white/[0.04] p-0.5" />

                      {/* Info */}
                      <button onClick={() => router.push(`/account/${a.normalizedDomain}`)}
                        className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[14px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors truncate">{a.name}</span>
                          <span className="text-[11px] text-slate-400 dark:text-neutral-500 truncate hidden sm:inline">{a.normalizedDomain}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-neutral-400">
                          <span>{a.category}</span>
                          <span className="text-slate-300 dark:text-neutral-600">·</span>
                          <span>{a.region}</span>
                        </div>
                      </button>

                      {/* Badges — only selected filters shown */}
                      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                        {activeBases.has('category') && (
                          <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.category}</span>
                        )}
                        {activeBases.has('businessModel') && (
                          <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.businessModel || 'Pure D2C'}</span>
                        )}
                        {activeBases.has('appPresence') && (
                          <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.appPresence === 'Both iOS & Android' ? 'iOS+Android' : a.appPresence}</span>
                        )}
                        {activeBases.has('offlineStores') && (
                          <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{formatStores(a.offlineStores, (a as Record<string, unknown>).storeRawCount as number) || 'Online'}</span>
                        )}
                        {activeBases.has('tech') && (
                          <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 ring-1 ring-[#C94C1E]/30 px-2 py-0.5 rounded">{a.topTech?.length > 0 ? a.topTech.join(', ') : 'No tech'}</span>
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
          </div>
          </div>
        </div>
      )}

      {/* Empty state — before search */}
      {!sourceDomain && !searched && (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-12 text-center shadow-sm dark:shadow-none">
          <Layers size={40} className="mx-auto text-slate-200 dark:text-neutral-700 mb-4" />
          <p className="text-[16px] font-bold text-slate-600 dark:text-neutral-300 mb-2">Discover LookALike Brands</p>
          <p className="text-[13px] text-slate-400 dark:text-neutral-500 max-w-md mx-auto">Enter any brand domain above to find similar accounts based on category, tech stack, business model, app presence, store count, or region.</p>
        </div>
      )}
    </div>
  );
}

/* ── Category Finder View (bulk) ───────────────────────────────────────── */
/* Paste many domains → detect each one's category & sub-category using the SAME
 * engine as the extension (the /api/detect endpoint → scanSingleUrl → companyMeta).
 * Runs a small client-side concurrency pool; the detect route caps at 5 in-flight. */
type FinderRow = {
  domain: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  category?: string; subCategory?: string; region?: string;
  businessModel?: string; categoryConfidence?: string; isNonD2C?: boolean; error?: string;
};

const BULK_CONCURRENCY = 2;

function parseBulkDomains(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of text.split(/[\s,;]+/)) {
    const d = tok.trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\d*\./, '').replace(/\/.*$/, '').trim();
    if (d && d.includes('.') && !seen.has(d)) { seen.add(d); out.push(d); }
  }
  return out;
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function CategoryFinderView() {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<FinderRow[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState('');
  const cancelRef = useRef(false);

  const parsedCount = parseBulkDomains(input).length;
  const doneCount = rows.filter(r => r.status === 'done' || r.status === 'error').length;
  const total = rows.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const runBulk = async (domains: string[]) => {
    cancelRef.current = false;
    setRunning(true);
    let cursor = 0;
    const worker = async () => {
      while (!cancelRef.current) {
        const i = cursor++;
        if (i >= domains.length) return;
        setRows(prev => { const n = [...prev]; n[i] = { ...n[i], status: 'loading' }; return n; });
        try {
          // metaOnly=1 → classify only (skips the slow store/app/traffic enrichment),
          // so bulk scans are fast. AbortSignal.timeout is a clean per-request cap so
          // one pathologically slow domain can't stall the batch.
          // Cloud Run can return a plain-text 502/503/504 ("Service Unavailable")
          // while an instance is scaling under the concurrent bulk load, so we
          // read the body as text, parse JSON defensively, and transparently
          // retry those transient infra errors instead of surfacing a cryptic
          // "Unexpected token 'S'" JSON error.
          const data = await (async () => {
            const url = `/api/detect?url=${encodeURIComponent(domains[i])}&metaOnly=1`;
            for (let attempt = 0; ; attempt++) {
              const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
              const text = await res.text();
              if (res.ok) {
                try { return JSON.parse(text); }
                catch { throw new Error('Bad response from server'); }
              }
              if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < 2) {
                await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
                continue;
              }
              let serverMsg = '';
              try { serverMsg = (JSON.parse(text) as { error?: string })?.error || ''; } catch { /* non-JSON body */ }
              throw new Error(serverMsg || (res.status === 503 ? 'Server busy — please retry' : `Server error (${res.status})`));
            }
          })();
          const m = data.companyMeta || {};
          setRows(prev => { const n = [...prev]; n[i] = {
            domain: domains[i], status: 'done',
            category: m.category || 'Unknown', subCategory: m.subCategory || 'General',
            region: m.region || 'Global', businessModel: m.businessModel || '—',
            categoryConfidence: m.categoryConfidence || '', isNonD2C: !!m.isNonD2C,
          }; return n; });
        } catch (e) {
          const nm = (e as Error)?.name;
          const msg = (nm === 'TimeoutError' || nm === 'AbortError')
            ? 'Timed out (site too slow to fetch)'
            : ((e as Error)?.message || 'Failed');
          setRows(prev => { const n = [...prev]; n[i] = {
            domain: domains[i], status: 'error', error: msg,
          }; return n; });
        }
      }
    };
    await Promise.all(Array.from({ length: BULK_CONCURRENCY }, worker));
    setRunning(false);
  };

  const start = () => {
    const domains = parseBulkDomains(input);
    if (!domains.length) { setNote('Paste at least one valid domain (one per line).'); return; }
    setNote('');
    setRows(domains.map(d => ({ domain: d, status: 'pending' as const })));
    runBulk(domains);
  };

  const stop = () => { cancelRef.current = true; setRunning(false); };
  const reset = () => { cancelRef.current = true; setRows([]); setNote(''); };

  const exportCsv = () => {
    const header = ['Domain', 'Category', 'Sub-Category', 'Region', 'Business Model', 'Confidence', 'Status'];
    const lines = [header.join(',')];
    for (const r of rows) lines.push([r.domain, r.category, r.subCategory, r.region, r.businessModel, r.categoryConfidence, r.status].map(csvCell).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `categories-${rows.length}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const copyTsv = async () => {
    const lines = [['Domain', 'Category', 'Sub-Category', 'Region', 'Business Model'].join('\t')];
    for (const r of rows) if (r.status === 'done') lines.push([r.domain, r.category, r.subCategory, r.region, r.businessModel].join('\t'));
    try { await navigator.clipboard.writeText(lines.join('\n')); setNote('Copied to clipboard.'); }
    catch { setNote('Copy failed — your browser blocked clipboard access.'); }
  };

  const confColor = (c?: string) => c === 'high' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10'
    : c === 'medium' ? 'text-amber-600 bg-amber-50 dark:bg-amber-500/10'
    : 'text-slate-500 bg-slate-100 dark:bg-white/[0.06]';

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Intro */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-orange-50 dark:bg-[#C94C1E]/10 flex-shrink-0">
          <Layers size={22} className="text-[#C94C1E]" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold text-slate-800 dark:text-white">Category Finder — Bulk</h2>
          <p className="text-[12.5px] text-slate-400 dark:text-neutral-500">Paste domains (one per line). Same engine as the extension.</p>
        </div>
      </div>

      {/* Input */}
      {total === 0 || !running ? (
        <div className="space-y-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={"allbirds.com\ngymshark.com\nhttps://www.curology.com\n…"}
            rows={7}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[13px] leading-relaxed font-mono text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-[#C94C1E] transition-all resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={start}
              disabled={running || parsedCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13.5px] font-semibold text-white bg-[#C94C1E] hover:bg-[#E56B2C] disabled:opacity-50 transition-colors"
            >
              <Search size={15} /> Find Categories{parsedCount > 0 ? ` (${parsedCount})` : ''}
            </button>
            {total > 0 && (
              <button onClick={reset} className="px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors">Clear</button>
            )}
            <span className="text-[11.5px] text-slate-400 dark:text-neutral-500">No limit · duplicates removed</span>
          </div>
        </div>
      ) : null}

      {note && <div className="text-[12px] text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2">{note}</div>}

      {/* Progress + actions */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="font-semibold text-slate-600 dark:text-neutral-300">{doneCount} / {total} done{running ? '…' : ''}</span>
              <span className="text-slate-400 dark:text-neutral-500">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
              <div className="h-full bg-[#C94C1E] transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {running ? (
              <button onClick={stop} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 transition-colors"><X size={13} /> Stop</button>
            ) : (
              <>
                <button onClick={copyTsv} disabled={doneCount === 0} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-slate-600 dark:text-neutral-300 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors"><ClipboardList size={13} /> Copy</button>
                <button onClick={exportCsv} disabled={doneCount === 0} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white bg-[#C94C1E] hover:bg-[#E56B2C] disabled:opacity-40 transition-colors"><Download size={13} /> Export CSV</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Results table */}
      {total > 0 && (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08]">
                  {['#', 'Domain', 'Category', 'Sub-Category', 'Region', 'Business Model', ''].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-[10.5px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.domain} className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-[12px] text-slate-400 dark:text-neutral-600 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=64`} alt="" className="w-5 h-5 rounded border border-slate-200 dark:border-white/[0.08] bg-white flex-shrink-0" />
                        <span className="text-[12.5px] font-semibold text-slate-800 dark:text-white truncate max-w-[180px]">{r.domain}</span>
                      </div>
                    </td>
                    {r.status === 'done' ? (
                      <>
                        <td className="px-4 py-2.5">
                          <span className="text-[12.5px] font-semibold text-slate-700 dark:text-neutral-200">{r.isNonD2C ? 'Non-D2C' : r.category}</span>
                          {r.categoryConfidence && <span className={`ml-1.5 text-[9px] font-bold uppercase px-1 py-0.5 rounded ${confColor(r.categoryConfidence)}`}>{r.categoryConfidence}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[12.5px] text-slate-600 dark:text-neutral-300">{r.isNonD2C ? '—' : r.subCategory}</td>
                        <td className="px-4 py-2.5 text-[12.5px] text-slate-600 dark:text-neutral-300">{r.region}</td>
                        <td className="px-4 py-2.5 text-[12.5px] text-slate-600 dark:text-neutral-300">{r.businessModel}</td>
                        <td className="px-4 py-2.5"><Check size={14} className="text-emerald-500" /></td>
                      </>
                    ) : r.status === 'error' ? (
                      <>
                        <td colSpan={4} className="px-4 py-2.5 text-[12px] text-red-500" title={r.error}>Couldn&apos;t analyze — {r.error}</td>
                        <td className="px-4 py-2.5"><AlertCircle size={14} className="text-red-500" /></td>
                      </>
                    ) : r.status === 'loading' ? (
                      <td colSpan={5} className="px-4 py-2.5 text-[12px] text-slate-400"><span className="inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Analyzing…</span></td>
                    ) : (
                      <td colSpan={5} className="px-4 py-2.5 text-[12px] text-slate-300 dark:text-neutral-600">Queued</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Admin Accounts View ───────────────────────────────────────────────── */
function AdminAccountsView({ showToast }: { showToast: (msg: string, type: 'success' | 'error') => void }) {
  const [accounts, setAccounts] = useState<{normalizedDomain: string; category: string; subCategory: string; region: string; monthlyVisitsFormatted: string | null; adminHidden: boolean; adminApproved: boolean; adminNote: string; createdAt: string; updatedAt: string}[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [stats, setStats] = useState<{total: number; approved: number; pending: number; unknown: number; hidden: number}>({ total: 0, approved: 0, pending: 0, unknown: 0, hidden: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('updatedAt'); // updatedAt | createdAt | domain | category
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // Multi-select + bulk delete
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts?search=${encodeURIComponent(search)}&status=${statusFilter}&page=${page}&limit=50&sortBy=${sortBy}&sortDir=${sortDir}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setAccounts(data.accounts || []);
      setTotal(data.total || 0);
      setStats(data.stats || { total: 0, approved: 0, pending: 0, unknown: 0, hidden: 0 });
    } catch {}
    setLoading(false);
  }, [search, statusFilter, page, sortBy, sortDir]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  // Reset selection whenever the visible page/filter/search changes
  useEffect(() => { setSelected(new Set()); }, [page, statusFilter, search]);

  const pageDomains = accounts.map(a => a.normalizedDomain);
  const allOnPageSelected = pageDomains.length > 0 && pageDomains.every(d => selected.has(d));
  const toggleOne = (domain: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(domain)) next.delete(domain); else next.add(domain);
    return next;
  });
  const toggleSelectAllOnPage = () => setSelected(prev => {
    const next = new Set(prev);
    if (pageDomains.every(d => next.has(d))) pageDomains.forEach(d => next.delete(d));
    else pageDomains.forEach(d => next.add(d));
    return next;
  });
  const clearSelection = () => setSelected(new Set());

  const bulkApprove = async () => {
    if (selected.size === 0 || approving) return;
    const n = selected.size;
    setApproving(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: Array.from(selected), action: 'approve' }),
      });
      if (!res.ok) { showToast('Bulk approve failed', 'error'); setApproving(false); return; }
      const data = await res.json();
      showToast(`Approved ${data.count ?? n} account${(data.count ?? n) !== 1 ? 's' : ''} — now visible in Account Explorer`, 'success');
      setSelected(new Set());
      fetchAccounts();
    } catch {
      showToast('Bulk approve failed', 'error');
    }
    setApproving(false);
  };

  const bulkDelete = async () => {
    if (selected.size === 0 || deleting) return;
    const n = selected.size;
    if (!confirm(`Delete ${n} account${n > 1 ? 's' : ''} permanently? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: Array.from(selected) }),
      });
      if (!res.ok) { showToast('Bulk delete failed', 'error'); setDeleting(false); return; }
      const data = await res.json();
      showToast(`Deleted ${data.deleted} account${data.deleted !== 1 ? 's' : ''}`, 'success');
      setSelected(new Set());
      fetchAccounts();
    } catch {
      showToast('Bulk delete failed', 'error');
    }
    setDeleting(false);
  };

  const doAction = async (domain: string, action: string, extra?: Record<string, string>) => {
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, action, ...extra }),
      });
      if (!res.ok) { showToast('Action failed', 'error'); return; }
      const data = await res.json();
      showToast(`${domain} ${data.action}`, 'success');
      fetchAccounts();
    } catch {
      showToast('Action failed', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Stats — click a card to filter to that bucket */}
      <div className="grid grid-cols-5 gap-4">
        {([
          { key: 'all', label: 'Total', value: stats.total, color: 'text-slate-800 dark:text-white' },
          { key: 'approved', label: 'Approved', value: stats.approved, color: 'text-emerald-600' },
          { key: 'pending', label: 'Pending', value: stats.pending, color: 'text-amber-500' },
          { key: 'unknown', label: 'Unknown', value: stats.unknown, color: 'text-slate-400' },
          { key: 'hidden', label: 'Hidden', value: stats.hidden, color: 'text-red-500' },
        ] as { key: string; label: string; value: number; color: string }[]).map(s => (
          <button key={s.label} onClick={() => { setStatusFilter(s.key); setPage(1); }}
            className={`text-left rounded-xl p-4 border transition-all ${statusFilter === s.key ? 'border-[#C94C1E] ring-1 ring-[#C94C1E]/30 bg-white dark:bg-[#141414]' : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141414] hover:border-slate-300 dark:hover:border-white/[0.16]'}`}>
            <p className="text-[11px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-[24px] font-extrabold ${s.color}`}>{s.value.toLocaleString()}</p>
          </button>
        ))}
      </div>

      {/* Search + Filter + Sort */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by domain or category..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[13px] text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-[#C94C1E] transition-all"
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[13px] font-medium text-slate-700 dark:text-neutral-200 outline-none">
          <option value="all">All Accounts</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="unknown">Unknown</option>
          <option value="hidden">Hidden</option>
        </select>
        <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[13px] font-medium text-slate-700 dark:text-neutral-200 outline-none">
          <option value="updatedAt">Sort: Last updated</option>
          <option value="createdAt">Sort: Date listed</option>
          <option value="domain">Sort: Name</option>
          <option value="category">Sort: Category</option>
        </select>
        <button onClick={() => { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); setPage(1); }}
          title="Toggle sort direction"
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[12px] font-semibold text-slate-600 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-white/[0.16] transition-all">
          <ArrowUpDown size={14} className="text-slate-400" />{sortDir === 'asc' ? 'Asc' : 'Desc'}
        </button>
      </div>

      {/* Account list */}
      <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-200 dark:border-white/[0.12] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.01]">
          <div className="flex items-center gap-3">
            {/* Select-all-on-page checkbox */}
            <button
              onClick={toggleSelectAllOnPage}
              disabled={accounts.length === 0}
              title={allOnPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
              className="flex-shrink-0 disabled:opacity-40"
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${allOnPageSelected ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15]'}`}>
                {allOnPageSelected && <Check size={10} className="text-white stroke-[3]" />}
              </span>
            </button>
            {selected.size > 0 ? (
              <>
                <span className="text-[12px] font-bold text-[#C94C1E]">{selected.size} selected</span>
                <button onClick={clearSelection} className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors">Clear</button>
                <button
                  onClick={bulkApprove}
                  disabled={approving}
                  title="Approve selected — make them visible in Account Explorer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {approving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} className="stroke-[3]" />}
                  Approve selected
                </button>
                <button
                  onClick={bulkDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete selected
                </button>
              </>
            ) : (
              <span className="text-[12px] font-bold text-slate-500 dark:text-neutral-400">{total} accounts</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-white/[0.08] disabled:opacity-30">Prev</button>
            <span className="text-[11px] text-slate-400">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={accounts.length < 50} className="px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-white/[0.08] disabled:opacity-30">Next</button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-slate-300" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[13px] text-slate-400">No accounts found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {accounts.map(a => (
              <div key={a.normalizedDomain} className={`flex items-center gap-4 px-6 py-3 transition-colors ${selected.has(a.normalizedDomain) ? 'bg-[#C94C1E]/[0.04] dark:bg-[#C94C1E]/[0.06]' : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'}`}>
                {/* Row select checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleOne(a.normalizedDomain); }}
                  title="Select account"
                  className="flex-shrink-0"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected.has(a.normalizedDomain) ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-white/[0.15]'}`}>
                    {selected.has(a.normalizedDomain) && <Check size={10} className="text-white stroke-[3]" />}
                  </span>
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://www.google.com/s2/favicons?domain=${a.normalizedDomain}&sz=64`} alt="" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-white/[0.08] flex-shrink-0 bg-white p-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-800 dark:text-white truncate">{a.normalizedDomain}</span>
                    {a.adminApproved && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">Approved</span>}
                    {a.adminHidden && <span className="text-[9px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded uppercase">Hidden</span>}
                    {!a.adminApproved && !a.adminHidden && a.category !== 'Unknown' && <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded uppercase">New</span>}
                    {a.category === 'Unknown' && <span className="text-[9px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded uppercase">Pending</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">
                    {typeof a.category === 'string' ? a.category : 'Unknown'} · {typeof a.region === 'string' ? a.region : 'Global'}{a.monthlyVisitsFormatted && typeof a.monthlyVisitsFormatted === 'string' ? ` · ${a.monthlyVisitsFormatted}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a href={`https://${a.normalizedDomain}`} target="_blank" rel="noopener noreferrer"
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 dark:bg-white/[0.04] rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                    title="Visit website">
                    <ExternalLink size={13} />
                  </a>
                  {!a.adminApproved && !a.adminHidden && (
                    <button onClick={() => doAction(a.normalizedDomain, 'approve')}
                      className="px-3 py-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                      Approve
                    </button>
                  )}
                  {a.adminApproved && (
                    <span className="px-3 py-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
                      ✓ Approved
                    </span>
                  )}
                  {a.adminHidden ? (
                    <button onClick={() => doAction(a.normalizedDomain, 'unhide')}
                      className="px-3 py-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-500/10 rounded-lg hover:bg-blue-100 transition-colors">
                      Unhide
                    </button>
                  ) : (
                    <button onClick={() => doAction(a.normalizedDomain, 'hide')}
                      className="px-3 py-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-500/10 rounded-lg hover:bg-amber-100 transition-colors">
                      Hide
                    </button>
                  )}
                  <button onClick={() => { if (confirm(`Delete ${a.normalizedDomain} permanently?`)) doAction(a.normalizedDomain, 'delete'); }}
                    className="px-3 py-1.5 text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MarketNewsFeed() {
  const [articles, setArticles] = useState<MarketNewsArticle[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedStats, setFeedStats] = useState<MarketNewsStats>({ newsTypes: {}, categories: {}, countries: {}, totalFundingUSD: 0, highImpact: 0 });
  const [feedTotal, setFeedTotal] = useState(0);
  const [feedPage, setFeedPage] = useState(1);
  const [feedTotalPages, setFeedTotalPages] = useState(1);
  const [feedType, setFeedType] = useState('all');
  const [feedCategory, setFeedCategory] = useState('all');
  const [feedSearch, setFeedSearch] = useState('');
  const [debouncedFeedSearch, setDebouncedFeedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFeedSearch(feedSearch), 400);
    return () => clearTimeout(t);
  }, [feedSearch]);

  useEffect(() => {
    setFeedLoading(true);
    const params = new URLSearchParams({ period: '14d', page: String(feedPage), limit: '20' });
    if (feedType !== 'all') params.set('newsType', feedType);
    if (feedCategory !== 'all') params.set('category', feedCategory);
    if (debouncedFeedSearch) params.set('search', debouncedFeedSearch);

    fetch(`/api/market-news?${params}`)
      .then(r => r.json())
      .then(data => {
        setArticles(data.articles || []);
        setFeedTotal(data.total || 0);
        setFeedTotalPages(data.totalPages || 1);
        if (data.stats) setFeedStats(data.stats);
        setFeedLoading(false);
      })
      .catch(() => setFeedLoading(false));
  }, [feedType, feedCategory, debouncedFeedSearch, feedPage]);

  useEffect(() => { setFeedPage(1); }, [feedType, feedCategory, debouncedFeedSearch]);

  const topCategories = Object.entries(feedStats.categories).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const totalNews = Object.values(feedStats.newsTypes).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#C94C1E]" />
            <span className="text-[14px] font-bold text-slate-800 dark:text-white">Market News</span>
            {totalNews > 0 && <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 px-2 py-0.5 rounded-full">{totalNews}</span>}
          </div>

          {/* Category filter + Search */}
          <div className="flex items-center gap-2">
            <select value={feedCategory} onChange={e => setFeedCategory(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a1a] text-[10px] font-semibold text-slate-600 dark:text-neutral-300 outline-none focus:border-[#C94C1E] transition-colors">
              <option value="all">All Categories</option>
              {topCategories.map(([c, n]) => (
                <option key={c} value={c}>{c} ({n})</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" size={12} />
              <input type="text" value={feedSearch} onChange={e => setFeedSearch(e.target.value)}
                placeholder="Search..."
                className="w-[140px] pl-7 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a1a] text-[10px] font-medium text-slate-700 dark:text-neutral-300 placeholder-slate-400 dark:placeholder-neutral-500 outline-none focus:border-[#C94C1E] transition-colors" />
            </div>
          </div>
        </div>

        {/* News type pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setFeedType('all')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${feedType === 'all' ? 'bg-[#C94C1E] text-white' : 'bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-white'}`}>
            All
          </button>
          {Object.entries(NEWS_TYPE_CONFIG).map(([key, cfg]) => {
            const count = feedStats.newsTypes[key] || 0;
            if (count === 0 && key !== feedType) return null;
            return (
              <button key={key} onClick={() => setFeedType(key)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${feedType === key ? cfg.badgeClass + ' ring-1 ring-current/20' : 'bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-white'}`}>
                {cfg.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* News list */}
      <div className="max-h-[520px] overflow-y-auto">
        {feedLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-slate-300 dark:text-neutral-600" />
            <span className="ml-3 text-[13px] text-slate-400 dark:text-neutral-500">Loading market news...</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <Zap size={32} className="mx-auto text-slate-200 dark:text-neutral-700 mb-2" />
            <p className="text-[13px] text-slate-400 dark:text-neutral-500">
              {debouncedFeedSearch || feedType !== 'all' || feedCategory !== 'all'
                ? 'No news matching your filters'
                : 'No market news yet — run: node scripts/market-news-scan.js'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {articles.map((a, idx) => {
              const ntCfg = NEWS_TYPE_CONFIG[a.newsType] || NEWS_TYPE_CONFIG.other;
              return (
                <a key={`${a.companyName}-${idx}`} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-white/[0.04] transition-colors group/row">
                  {/* Type icon */}
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-black mt-0.5"
                    style={{ backgroundColor: ntCfg.color + '12', color: ntCfg.color }}>
                    {ntCfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[13px] font-bold text-slate-800 dark:text-white group-hover/row:text-[#C94C1E] transition-colors">
                        {a.companyName || 'Unknown'}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ntCfg.badgeClass}`}>
                        {ntCfg.label}
                      </span>
                      {a.newsType === 'funding' && a.details?.round && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ROUND_COLORS[a.details.round] || 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-neutral-300'}`}>
                          {a.details.round}
                        </span>
                      )}
                      {a.category && (
                        <span className="text-[9px] font-semibold text-slate-400 dark:text-neutral-500 bg-slate-50 dark:bg-white/[0.04] px-1.5 py-0.5 rounded">
                          {a.category}
                        </span>
                      )}
                      {a.marketImpact === 'high' && (
                        <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                          HIGH
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-slate-600 dark:text-neutral-300 leading-relaxed line-clamp-2">
                      {a.summary || a.headline || a.title}
                    </p>
                    {/* Sub-details inline */}
                    {a.newsType === 'funding' && a.details?.investors && a.details.investors.length > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5 block truncate">
                        Investors: {a.details.investors.slice(0, 3).join(', ')}
                      </span>
                    )}
                    {a.newsType === 'hiring' && a.details?.person && (
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5 block">
                        {a.details.person}{a.details.role ? ` — ${a.details.role}` : ''}
                      </span>
                    )}
                    {a.newsType === 'acquisition' && a.details?.acquirer && a.details?.target && (
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5 block">
                        {a.details.acquirer} acquires {a.details.target}
                      </span>
                    )}
                    {a.newsType === 'partnership' && a.details?.partner && (
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5 block">
                        Partnership with {a.details.partner}
                      </span>
                    )}
                    <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-400 dark:text-neutral-500">
                      {a.country && <span className="flex items-center gap-0.5"><MapPin size={10} /> {a.country}</span>}
                      {a.sourceName && <span>{a.sourceName}</span>}
                      <span>{timeAgo(a.publishedAt)}</span>
                    </div>
                  </div>

                  {/* Right badge */}
                  <div className="flex-shrink-0 mt-1">
                    <NewsDetailBadge article={a} />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {feedTotalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-white/[0.12]">
          <p className="text-[11px] text-slate-400 dark:text-neutral-500">
            {(feedPage - 1) * 20 + 1}-{Math.min(feedPage * 20, feedTotal)} of {feedTotal}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setFeedPage(p => Math.max(1, p - 1))} disabled={feedPage === 1}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[11px] font-semibold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft size={13} />
            </button>
            <span className="text-[11px] font-bold text-slate-600 dark:text-neutral-300">{feedPage}/{feedTotalPages}</span>
            <button onClick={() => setFeedPage(p => Math.min(feedTotalPages, p + 1))} disabled={feedPage === feedTotalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08] text-[11px] font-semibold text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketIntelligenceView() {
  const [period, setPeriod] = useState<'week' | '2weeks' | 'month'>('week');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [allNews, setAllNews] = useState<MarketNewsArticle[]>([]);
  const [newsStats, setNewsStats] = useState<MarketNewsStats>({ newsTypes: {}, categories: {}, countries: {}, totalFundingUSD: 0, highImpact: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const periodMap = { week: '7d', '2weeks': '14d', month: '30d' } as const;

  // Fetch all news from market_news collection
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/market-news?period=${periodMap[period]}&limit=100`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setAllNews(data.articles || []);
        if (data.stats) setNewsStats(data.stats);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setAllNews([]); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [period]);

  // Derive card data from market_news
  const highImpactNews = allNews.filter(a => a.marketImpact === 'high');
  const fundingNews = allNews.filter(a => a.newsType === 'funding');
  const hiringNews = allNews.filter(a => a.newsType === 'hiring');
  const acqShutdownNews = allNews.filter(a => ['acquisition', 'shutdown', 'regulatory'].includes(a.newsType));

  const totalNews = Object.values(newsStats.newsTypes).reduce((a, b) => a + b, 0);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const ntCfg = (type: string) => NEWS_TYPE_CONFIG[type] || NEWS_TYPE_CONFIG.other;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold text-slate-800 dark:text-white tracking-tight">Intelligence Hub</h2>
          <p className="text-[13px] text-slate-400 dark:text-neutral-500 mt-0.5">
            {dateStr} &middot;{' '}
            <span className="text-[#C94C1E] font-semibold">{totalNews} market signals</span> &middot;{' '}
            <span className="text-red-500 font-semibold">{newsStats.highImpact} high impact</span>
          </p>
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

      {/* 5 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Total News</p>
          <p className="text-[20px] font-bold text-slate-800 dark:text-white mt-0.5">{totalNews}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Funding</p>
          <p className="text-[20px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{newsStats.totalFundingUSD > 0 ? formatUSD(newsStats.totalFundingUSD) : (newsStats.newsTypes.funding || 0)}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Hiring</p>
          <p className="text-[20px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">{newsStats.newsTypes.hiring || 0}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide">M&A</p>
          <p className="text-[20px] font-bold text-violet-600 dark:text-violet-400 mt-0.5">{newsStats.newsTypes.acquisition || 0}</p>
        </div>
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">High Impact</p>
          <p className="text-[20px] font-bold text-red-600 dark:text-red-400 mt-0.5">{newsStats.highImpact}</p>
        </div>
      </div>

      {/* 2x2 Card Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-300 dark:text-neutral-600" />
          <span className="ml-3 text-[13px] text-slate-400 dark:text-neutral-500">Loading intelligence...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: High Impact News */}
          <div className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="border-l-[3px] border-l-red-500 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-red-500" />
                <span className="text-[14px] font-bold text-slate-800 dark:text-white">High Impact</span>
                <span className="ml-auto w-5 h-5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold flex items-center justify-center">{highImpactNews.length}</span>
              </div>
              {highImpactNews.length === 0 ? (
                <p className="text-[12px] text-slate-400 dark:text-neutral-500 py-4 text-center">No high impact news this period</p>
              ) : (
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {(expandedCard === 'high' ? highImpactNews : highImpactNews.slice(0, 4)).map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 bg-slate-50/70 dark:bg-white/[0.04] rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[12px] font-black"
                        style={{ backgroundColor: ntCfg(a.newsType).color + '12', color: ntCfg(a.newsType).color }}>
                        {ntCfg(a.newsType).icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] font-bold text-slate-800 dark:text-white">{a.companyName || 'Unknown'}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ntCfg(a.newsType).badgeClass}`}>{ntCfg(a.newsType).label}</span>
                          {a.category && <span className="text-[9px] text-slate-400 dark:text-neutral-500 bg-slate-50 dark:bg-white/[0.04] px-1.5 py-0.5 rounded">{a.category}</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{a.headline}</p>
                      </div>
                      <div className="flex-shrink-0"><NewsDetailBadge article={a} /></div>
                    </a>
                  ))}
                </div>
              )}
              {highImpactNews.length > 4 && (
                <button onClick={() => setExpandedCard(expandedCard === 'high' ? null : 'high')} className="text-[12px] font-semibold text-[#C94C1E] hover:text-[#a83d16] mt-3 transition-colors">
                  {expandedCard === 'high' ? 'Show less' : `View all ${highImpactNews.length}`} &rarr;
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Acquisitions, Shutdowns & Regulatory */}
          <div className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-violet-500" />
              <span className="text-[14px] font-bold text-slate-800 dark:text-white">M&A, Shutdowns & Regulatory</span>
              <span className="ml-auto w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-[10px] font-bold flex items-center justify-center">{acqShutdownNews.length}</span>
            </div>
            {acqShutdownNews.length === 0 ? (
              <p className="text-[12px] text-slate-400 dark:text-neutral-500 py-4 text-center">No M&A or regulatory news this period</p>
            ) : (
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                {(expandedCard === 'acq' ? acqShutdownNews : acqShutdownNews.slice(0, 4)).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 bg-slate-50/70 dark:bg-white/[0.04] rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[12px] font-black"
                      style={{ backgroundColor: ntCfg(a.newsType).color + '12', color: ntCfg(a.newsType).color }}>
                      {ntCfg(a.newsType).icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-bold text-slate-800 dark:text-white">{a.companyName || 'Unknown'}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ntCfg(a.newsType).badgeClass}`}>{ntCfg(a.newsType).label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{a.headline}</p>
                      {a.newsType === 'acquisition' && a.details?.acquirer && a.details?.target && (
                        <span className="text-[10px] text-violet-500 dark:text-violet-400 mt-0.5 block">{a.details.acquirer} → {a.details.target}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 flex-shrink-0 mt-1">{timeAgo(a.publishedAt)}</span>
                  </a>
                ))}
              </div>
            )}
            {acqShutdownNews.length > 4 && (
              <button onClick={() => setExpandedCard(expandedCard === 'acq' ? null : 'acq')} className="text-[12px] font-semibold text-[#C94C1E] hover:text-[#a83d16] mt-3 transition-colors">
                {expandedCard === 'acq' ? 'Show less' : `View all ${acqShutdownNews.length}`} &rarr;
              </button>
            )}
          </div>

          {/* Card 3: Funding Rounds */}
          <div className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={16} className="text-emerald-500" />
              <span className="text-[14px] font-bold text-slate-800 dark:text-white">Funding Rounds</span>
              <span className="ml-auto w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center">{fundingNews.length}</span>
            </div>
            {fundingNews.length === 0 ? (
              <p className="text-[12px] text-slate-400 dark:text-neutral-500 py-4 text-center">No funding news this period</p>
            ) : (
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                {(expandedCard === 'fund' ? fundingNews : fundingNews.slice(0, 4)).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 bg-slate-50/70 dark:bg-white/[0.04] rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-[13px] font-black text-emerald-600 dark:text-emerald-400">$</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-bold text-slate-800 dark:text-white">{a.companyName || 'Unknown'}</span>
                        {a.details?.round && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ROUND_COLORS[a.details.round] || 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-neutral-300'}`}>
                            {a.details.round}
                          </span>
                        )}
                        {a.category && <span className="text-[9px] text-slate-400 dark:text-neutral-500 bg-slate-50 dark:bg-white/[0.04] px-1.5 py-0.5 rounded">{a.category}</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 line-clamp-1">{a.headline}</p>
                      {a.details?.investors && a.details.investors.length > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5 block truncate">Led by {a.details.investors.slice(0, 3).join(', ')}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {a.details?.amount && (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg">{a.details.amount}</span>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500">{timeAgo(a.publishedAt)}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
            {fundingNews.length > 4 && (
              <button onClick={() => setExpandedCard(expandedCard === 'fund' ? null : 'fund')} className="text-[12px] font-semibold text-[#C94C1E] hover:text-[#a83d16] mt-3 transition-colors">
                {expandedCard === 'fund' ? 'Show less' : `View all ${fundingNews.length}`} &rarr;
              </button>
            )}
          </div>

          {/* Card 4: Hiring & Leadership */}
          <div className="bg-white dark:bg-[#141414]/60 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-blue-500" />
              <span className="text-[14px] font-bold text-slate-800 dark:text-white">Hiring & Leadership</span>
              <span className="ml-auto w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center">{hiringNews.length}</span>
            </div>
            {hiringNews.length === 0 ? (
              <p className="text-[12px] text-slate-400 dark:text-neutral-500 py-4 text-center">No hiring news this period</p>
            ) : (
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                {(expandedCard === 'hire' ? hiringNews : hiringNews.slice(0, 4)).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 bg-slate-50/70 dark:bg-white/[0.04] rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-[13px] font-black text-blue-600 dark:text-blue-400">+</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-bold text-slate-800 dark:text-white">{a.companyName || 'Unknown'}</span>
                        {a.details?.roleLevel && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            a.details.roleLevel === 'c-suite' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                            : a.details.roleLevel === 'layoff' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                            : a.details.roleLevel === 'mass-hiring' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-neutral-300'
                          }`}>
                            {a.details.roleLevel === 'c-suite' ? 'C-Suite' : a.details.roleLevel === 'mass-hiring' ? 'Mass Hiring' : a.details.roleLevel === 'layoff' ? 'Layoff' : String(a.details.roleLevel).toUpperCase()}
                          </span>
                        )}
                        {a.category && <span className="text-[9px] text-slate-400 dark:text-neutral-500 bg-slate-50 dark:bg-white/[0.04] px-1.5 py-0.5 rounded">{a.category}</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 line-clamp-1">{a.headline}</p>
                      {a.details?.person && (
                        <span className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5 block">{a.details.person}{a.details.role ? ` — ${a.details.role}` : ''}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 flex-shrink-0 mt-1">{timeAgo(a.publishedAt)}</span>
                  </a>
                ))}
              </div>
            )}
            {hiringNews.length > 4 && (
              <button onClick={() => setExpandedCard(expandedCard === 'hire' ? null : 'hire')} className="text-[12px] font-semibold text-[#C94C1E] hover:text-[#a83d16] mt-3 transition-colors">
                {expandedCard === 'hire' ? 'Show less' : `View all ${hiringNews.length}`} &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Section: Full Market News Feed */}
      <MarketNewsFeed />

      {/* Toast notification — top right */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[200] px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 max-w-[400px] ${
          toast.type === 'success' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-red-600 text-white'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-500' : 'bg-white/20'
          }`}>
            {toast.type === 'success' ? <Check size={14} className="text-white stroke-[3]" /> : <X size={14} className="text-white" />}
          </div>
          <p className="text-[13px] font-semibold flex-1">{toast.msg}</p>
          <button onClick={() => setToast(null)} className="text-white/40 hover:text-white transition-colors flex-shrink-0 ml-2">
            <X size={14} />
          </button>
        </div>
      )}
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
  const logoVal = TECH_LOGO_MAP[tech.name];
  const fallbackDomain = !logoVal ? guessTechDomain(tech.name) : null;
  // If the map value starts with http, use it as a direct icon URL;
  // otherwise, treat it as a domain for Google's favicon API.
  const iconUrl = logoVal
    ? (logoVal.startsWith('http') ? logoVal : `https://icon.horse/icon/${logoVal}`)
    : `https://icon.horse/icon/${fallbackDomain}`;

  const isAdded = tech.changeTag === 'added';
  const isRemoved = tech.changeTag === 'removed';

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
      isAdded ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
      : isRemoved ? 'bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-500 dark:text-red-400 line-through opacity-70'
      : 'bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-neutral-200 hover:border-slate-300 dark:hover:border-white/[0.12]'
    }`}>
      {!imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          className="w-4 h-4 rounded-sm flex-shrink-0 dark:bg-white dark:p-[1px] dark:rounded"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="w-3.5 h-3.5 rounded flex-shrink-0" style={{ backgroundColor: tech.color }} />
      )}
      {tech.name}
      {isAdded && <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full leading-none">NEW</span>}
      {isRemoved && <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">REMOVED</span>}
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
  'Shift4Shop': 'shift4shop.com', 'Vue Storefront': 'vuestorefront.io',
  'Salesforce Commerce Cloud': 'salesforce.com',
  'SAP Commerce Cloud': 'sap.com', 'Commercetools': 'commercetools.com',
  // CMS
  'WordPress': 'wordpress.org', 'Drupal': 'drupal.org', 'Joomla': 'joomla.org',
  'Contentful': 'contentful.com', 'Strapi': 'strapi.io', 'Ghost': 'ghost.org',
  'Webflow': 'webflow.com', 'Gatsby': 'gatsbyjs.com', 'Hugo': 'gohugo.io',
  'Sanity': 'sanity.io', 'Prismic': 'prismic.io', 'Storyblok': 'storyblok.com',
  'DatoCMS': 'datocms.com', 'Sitecore': 'sitecore.com', 'Kentico': 'kentico.com',
  'Adobe Experience Manager': 'adobe.com',
  'HubSpot CMS Hub': 'hubspot.com',
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
  'Google Analytics': 'https://www.google.com/s2/favicons?domain=analytics.google.com&sz=64',
  'Google Tag Manager': 'https://www.google.com/s2/favicons?domain=tagmanager.google.com&sz=64',
  'Mixpanel': 'mixpanel.com', 'Amplitude': 'amplitude.com', 'Heap': 'heap.io',
  'Hotjar': 'hotjar.com', 'Microsoft Clarity': 'https://www.google.com/s2/favicons?domain=clarity.microsoft.com&sz=64',
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
  'Google Pay': 'https://www.google.com/s2/favicons?domain=pay.google.com&sz=64',
  'Apple Pay': 'apple.com',
  'Amazon Pay': 'pay.amazon.com',
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
  'HelpScout Beacon': 'https://www.google.com/s2/favicons?domain=helpscout.com&sz=64', 'JivoChat': 'jivochat.com',
  'Chatwoot': 'chatwoot.com', 'Pure Chat': 'purechat.com',
  'Yellow.ai': 'yellow.ai', 'Haptik': 'haptik.ai', 'Verloop': 'verloop.io',
  // Customer Engagement & CRM
  'CleverTap': 'clevertap.com', 'MoEngage': 'moengage.com', 'WebEngage': 'webengage.com',
  'HubSpot': 'hubspot.com',
  'Salesforce': 'salesforce.com', 'Braze': 'braze.com',
  'Insider': 'useinsider.com', 'Iterable': 'iterable.com', 'Customer.io': 'customer.io',
  'Drip': 'drip.com', 'ActiveCampaign': 'activecampaign.com',
  'Zoho CRM': 'zoho.com', 'Pipedrive': 'pipedrive.com',
  // CDN
  'Cloudflare': 'cloudflare.com', 'Fastly': 'fastly.com', 'Akamai': 'akamai.com',
  'AWS CloudFront': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'Bunny CDN': 'bunny.net',
  'KeyCDN': 'keycdn.com', 'StackPath': 'stackpath.com', 'Imgix': 'imgix.com',
  // SEO
  'Yoast SEO': 'yoast.com', 'Rank Math': 'rankmath.com',
  'All in One SEO': 'aioseo.com', 'SEOPress': 'seopress.org',
  // Tag Managers
  'Adobe Launch': 'adobe.com',
  'Tealium': 'tealium.com', 'Ensighten': 'ensighten.com',
  // Marketing Automation
  'Klaviyo': 'klaviyo.com', 'Mailchimp': 'mailchimp.com', 'Marketo': 'marketo.com',
  'Pardot': 'pardot.com', 'Brevo': 'brevo.com', 'SendGrid': 'sendgrid.com',
  'ConvertKit': 'convertkit.com', 'Omnisend': 'omnisend.com',
  'GetResponse': 'getresponse.com', 'AWeber': 'aweber.com',
  'Constant Contact': 'constantcontact.com', 'MailerLite': 'mailerlite.com',
  'Campaign Monitor': 'campaignmonitor.com', 'Postscript': 'postscript.io',
  'Attentive': 'attentive.com', 'Dotdigital': 'dotdigital.com',
  // Advertising
  'Google Ads': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'Meta Pixel': 'meta.com',
  'Facebook Pixel': 'facebook.com',
  'TikTok Pixel': 'tiktok.com', 'Snapchat Pixel': 'snapchat.com',
  'Pinterest Tag': 'pinterest.com', 'Twitter Pixel': 'twitter.com',
  'LinkedIn Insight Tag': 'linkedin.com', 'Criteo': 'criteo.com',
  'Taboola': 'taboola.com', 'Outbrain': 'outbrain.com', 'AdRoll': 'adroll.com',
  'Reddit Pixel': 'reddit.com', 'Quora Pixel': 'quora.com',
  // A/B Testing
  'Optimizely': 'optimizely.com', 'VWO': 'vwo.com', 'LaunchDarkly': 'launchdarkly.com',
  'AB Tasty': 'abtasty.com', 'Convert Experiences': 'convert.com',
  'Google Optimize': 'https://www.google.com/s2/favicons?domain=optimize.google.com&sz=64',
  'Dynamic Yield': 'dynamicyield.com',
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
  'reCAPTCHA': 'https://www.gstatic.com/recaptcha/api2/logo_48.png', 'hCaptcha': 'hcaptcha.com',
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
  'DigitalOcean': 'digitalocean.com',
  'AWS': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'Google Cloud': 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64', 'Fly.io': 'fly.io',
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
  'Auth0': 'auth0.com', 'Okta': 'okta.com',
  'Firebase': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'Google Sign-In': 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
  'Facebook Login': 'facebook.com',
  // Video
  'Vimeo': 'vimeo.com', 'Wistia': 'wistia.com', 'Brightcove': 'brightcove.com',
  'JW Player': 'jwplayer.com', 'Vidyard': 'vidyard.com',
  // Maps
  'Google Maps': 'https://www.google.com/s2/favicons?domain=maps.google.com&sz=64',
  'Mapbox': 'mapbox.com',
  'Leaflet': 'leafletjs.com', 'HERE Maps': 'here.com',
  // Fonts
  'Google Fonts': 'https://www.google.com/s2/favicons?domain=fonts.google.com&sz=64',
  'Adobe Fonts': 'fonts.adobe.com',
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
  'Google Remarketing': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'Google Search Console': 'https://www.google.com/s2/favicons?domain=search.google.com&sz=64',
  'Google AdSense': 'https://www.google.com/s2/favicons?domain=adsense.google.com&sz=64',
  'Google Ad Manager': 'https://www.google.com/s2/favicons?domain=admob.google.com&sz=64',
  'Google Cloud CDN': 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64',
  'Google Sites': 'https://www.google.com/s2/favicons?domain=sites.google.com&sz=64',
  'Shopify Checkout': 'cdn.shopify.com',
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
  'WP Rocket': 'wp-rocket.me',
  'WP Super Cache': 'wordpress.org',
  'W3 Total Cache': 'wordpress.org',
  'LiteSpeed Cache': 'litespeedtech.com',
  'Jetpack': 'jetpack.com', 'Elementor': 'elementor.com',
  'WPBakery': 'wpbakery.com', 'Divi Builder': 'elegantthemes.com',
  'Advanced Custom Fields': 'advancedcustomfields.com',
  'Contact Form 7': 'contactform7.com', 'WPForms': 'wpforms.com',
  'Gravity Forms': 'gravityforms.com',
  'Akamai CDN': 'akamai.com',
  'Akamai Bot Manager': 'akamai.com',
  'Azure CDN': 'microsoft.com', 'PerimeterX': 'perimeterx.com',
  'VWO Engage': 'vwo.com', 'Yotpo SMSBump': 'yotpo.com',
  'Salesforce Live Agent': 'salesforce.com',
  'Salesforce Marketing Cloud': 'salesforce.com',
  'Zendesk Chat': 'zendesk.com',
  'Zoho SalesIQ': 'zoho.com',
  'Zoho Desk': 'zoho.com',
  'Zoho Campaigns': 'zoho.com',
  'Freshmarketer': 'freshworks.com',
  'Freshsales': 'freshworks.com',
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
  // ── Missing techs (previously relying on guessTechDomain fallback) ──
  // Payments & Financial
  '2Checkout (Verifone)': 'verifone.com', 'Airpay': 'airpay.co.in', 'Alma': 'getalma.eu',
  'American Express': 'americanexpress.com', 'Atome': 'atome.sg', 'Authorize.Net': 'authorize.net',
  'Axis Bank Payment Gateway': 'axisbank.com', 'BlueSnap': 'bluesnap.com', 'Clearpay': 'clearpay.com',
  'Decentro': 'decentro.tech', 'DirecPay': 'direcpay.com', 'Flutterwave': 'flutterwave.com',
  'HDFC Payment Gateway': 'hdfcbank.com', 'ICICI Eazypay': 'icicibank.com',
  'Kredivo': 'kredivo.com', 'Laybuy': 'laybuy.com', 'Mangopay': 'mangopay.com',
  'Mastercard': 'mastercard.com', 'Paddle': 'paddle.com', 'PayFast': 'payfast.co.za',
  'PayKun': 'paykun.com', 'Paynimo': 'paynimo.com', 'Payoneer': 'payoneer.com',
  'Paystack': 'paystack.com', 'Paytm PG': 'paytm.com', 'PhonePe PG': 'phonepe.com',
  'PhonePe Switch': 'phonepe.com', 'Pine Labs': 'pinelabs.com', 'PostPe': 'postpe.com',
  'Scalapay': 'scalapay.com', 'Tamara': 'tamara.co', 'UPI': 'npci.org.in',
  'Uni Cards': 'uni.cards', 'Visa': 'visa.com', 'WePay': 'wepay.com',
  'Worldpay': 'worldpay.com', 'Zaakpay': 'zaakpay.com', 'Zip': 'zip.co',
  'ePayLater': 'epaylater.in', 'Kiwi Checkout': 'kiwi.com',
  // Analytics & Data
  'Adobe Analytics': 'adobe.com',
  'Adobe Experience Cloud': 'adobe.com',
  'Adobe Target': 'adobe.com',
  'Akamai mPulse': 'akamai.com',
  'Amazon Advertising': 'amazon.com',
  'Bing UET': 'bing.com',
  'Bing Webmaster': 'bing.com', 'Blue Triangle': 'bluetriangle.com',
  'Chartbeat': 'chartbeat.com', 'Clicky': 'clicky.com', 'Comscore': 'comscore.com',
  'comScore': 'comscore.com', 'ContentSquare': 'contentsquare.com',
  'Countly': 'count.ly', 'Decibel Insight': 'decibelinsight.com',
  'DoubleClick': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'DoubleClick Floodlight': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'Fathom Analytics': 'usefathom.com',
  'Firebase Analytics': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'Flurry': 'flurry.com', 'GoSquared': 'gosquared.com',
  'Google Publisher Tag': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64', 'Hightouch': 'hightouch.com',
  'Indicative': 'indicative.com', 'Inspectlet': 'inspectlet.com',
  'Kochava': 'kochava.com', 'Localytics': 'localytics.com',
  'Lytics': 'lytics.com', 'MediaMath': 'mediamath.com', 'mParticle': 'mparticle.com',
  'Microsoft Advertising': 'microsoft.com', 'MonsterInsights': 'monsterinsights.com',
  'Nextdoor Ads': 'nextdoor.com', 'Oribi': 'oribi.io',
  'Parse.ly': 'parsely.com', 'Pirsch': 'pirsch.io',
  'Piwik Tag Manager': 'matomo.org', 'PixelYourSite': 'pixelyoursite.com',
  'Plausible Analytics': 'plausible.io', 'Quantum Metric': 'quantummetric.com',
  'RudderStack': 'rudderstack.com', 'Sailthru': 'sailthru.com',
  'SessionCam': 'glassbox.com', 'Simple Analytics': 'simpleanalytics.com',
  'Singular': 'singular.net', 'SiteSpect': 'sitespect.com',
  'Snowplow': 'snowplow.io', 'StatCounter': 'statcounter.com',
  'Statsig': 'statsig.com', 'The Trade Desk': 'thetradedesk.com',
  'Treasure Data': 'treasuredata.com', 'Umami': 'umami.is',
  'UXCam': 'uxcam.com', 'Woopra': 'woopra.com',
  // Marketing & Engagement
  'Acoustic': 'acoustic.com', 'Agile CRM': 'agilecrm.com', 'Airship': 'airship.com',
  'Annex Cloud': 'annexcloud.com', 'Apollo.io': 'apollo.io', 'Appier': 'appier.com',
  'Attio': 'attio.com', 'Autopilot': 'autopilothq.com', 'Birdeye': 'birdeye.com',
  'Bloomreach': 'bloomreach.com', 'Bloomreach Engagement': 'bloomreach.com',
  'BlueConic': 'blueconic.com', 'Bluecore': 'bluecore.com',
  'BON Loyalty': 'bonloyalty.com', 'Census': 'getcensus.com',
  'Clerk': 'clerk.io', 'Clerk.io': 'clerk.io', 'Close CRM': 'close.com',
  'Copper': 'copper.com', 'Cordial': 'cordial.com',
  'Elastic Email': 'elasticemail.com',
  'Eloqua': 'oracle.com',
  'Emarsys': 'emarsys.com', 'Engage360': 'engage360.com',
  'Evergage': 'salesforce.com', 'Folk CRM': 'folk.app',
  'Glood.AI': 'glood.ai', 'Intercom Marketing': 'intercom.com',
  'Insightly': 'insightly.com', 'Joy Loyalty': 'joy.so',
  'Kangaroo Rewards': 'kangaroorewards.com', 'Keap': 'keap.com',
  'Leanplum': 'leanplum.com', 'Leadsquared': 'leadsquared.com',
  'LimeSpot': 'limespot.com', 'Listrak': 'listrak.com',
  'Loyalty Gator': 'loyaltygator.com', 'Mailgun': 'mailgun.com',
  'Mailjet': 'mailjet.com', 'Mailmodo': 'mailmodo.com',
  'Marsello': 'marsello.com', 'Medallia': 'medallia.com',
  'Monday CRM': 'monday.com', 'Moosend': 'moosend.com',
  'NETCORE': 'netcorecloud.com', 'Nimble': 'nimble.com', 'Nutshell': 'nutshell.com',
  'Ometria': 'ometria.com', 'Open Loyalty': 'openloyalty.io',
  'Ortto': 'ortto.com', 'Responsys': 'oracle.com',
  'Retention.com': 'retention.com', 'RevLifter': 'revlifter.com',
  'Rise.ai': 'rise.ai', 'SaleCycle': 'salecycle.com',
  'Salesforce DMP (Krux)': 'salesforce.com',
  'Salesforce Einstein': 'salesforce.com',
  'SendPulse': 'sendpulse.com', 'Sendinblue': 'brevo.com',
  'SharpSpring': 'sharpspring.com', 'Simon Data': 'simondata.com',
  'Sprig': 'sprig.com', 'Streak': 'streak.com',
  'Subscribers': 'subscribers.com', 'SugarCRM': 'sugarcrm.com',
  'Talon.One': 'talon.one', 'Taplytics': 'taplytics.com',
  'Trengo': 'trengo.com', 'Usabilla': 'usabilla.com',
  'UserTesting': 'usertesting.com', 'UserVoice': 'uservoice.com',
  'Userlike': 'userlike.com', 'Wunderkind': 'wunderkind.co',
  'Yalo': 'yalo.com', 'Yext': 'yext.com',
  // CRM & Chat
  'Bitrix24': 'bitrix24.com', 'Chatra': 'chatra.com', 'Customerly': 'customerly.io',
  'Dixa': 'dixa.com', 'Genesys Cloud': 'genesys.com', 'GetButton': 'getbutton.io',
  'HelpCrunch': 'helpcrunch.com', 'Kayako': 'kayako.com',
  'Kommunicate': 'kommunicate.io',
  'Microsoft Dynamics 365': 'microsoft.com',
  'SnapEngage': 'snapengage.com',
  // Reviews & Social Proof
  'Baremetrics': 'baremetrics.com', 'Fera.ai': 'fera.ai',
  'Reviews.io': 'reviews.io', 'Shopper Approved': 'shopperapproved.com',
  'Trusted Shops': 'trustedshops.com', 'WPLoyalty': 'wployalty.net',
  // A/B Testing & Feature Flags
  'Flagsmith': 'flagsmith.com', 'GrowthBook': 'growthbook.io',
  'Kameleoon': 'kameleoon.com', 'Quantcast Choice': 'quantcast.com',
  'Split.io': 'split.io', 'Unleash': 'getunleash.io',
  // Ecommerce & Store tools
  'Bagisto': 'bagisto.com', 'Bold Commerce': 'boldcommerce.com',
  'CartStack': 'cartstack.com', 'CS-Cart': 'cs-cart.com',
  'Duda': 'duda.co', 'Fynd': 'fynd.com',
  'Gift Reggie': 'giftreggie.com', 'Jimdo': 'jimdo.com',
  'nopCommerce': 'nopcommerce.com', 'Odoo': 'odoo.com',
  'Ordergroove': 'ordergroove.com', 'Recharge': 'rechargepayments.com',
  'Shiprocket Checkout': 'shiprocket.in', 'Signifyd': 'signifyd.com',
  'Strikingly': 'strikingly.com', 'Weebly': 'weebly.com', 'Zen Cart': 'zen-cart.com',
  'Progus Commerce Locator': 'progus.io', 'Secomapp Store Locator': 'secomapp.com',
  'Store Locator Plus': 'storelocatorplus.com', 'Storemapper': 'storemapper.com',
  'Wishlist King': 'wishlistking.com', 'Wishlist Plus': 'swymcorp.com',
  // JS Frameworks & Libraries
  'Apollo Client': 'apollographql.com', 'Apollo GraphQL': 'apollographql.com',
  'Aurelia': 'aurelia.io', 'Babel': 'babeljs.io', 'Bun': 'bun.sh',
  'Deno': 'deno.land', 'Ext JS': 'sencha.com', 'Framer Motion': 'framer.com',
  'GraphQL': 'graphql.org', 'Handlebars': 'handlebarsjs.com',
  'Hotwire': 'hotwired.dev', 'Lit': 'lit.dev', 'Marko': 'markojs.com',
  'Meteor': 'meteor.com', 'Mithril': 'mithril.js.org', 'MobX': 'mobx.js.org',
  'Petite Vue': 'vuejs.org', 'Pinia': 'pinia.vuejs.org', 'Polymer': 'polymer-project.org',
  'Redux': 'redux.js.org', 'Relay': 'relay.dev', 'RxJS': 'rxjs.dev',
  'Stimulus': 'stimulus.hotwired.dev', 'Stencil': 'stenciljs.com',
  'Turbo': 'turbo.hotwired.dev', 'Turbolinks': 'github.com',
  'TypeScript': 'typescriptlang.org', 'Zustand': 'zustand-demo.pmnd.rs',
  'tRPC': 'trpc.io', 'Loadable-Components': 'loadable-components.com',
  // UI Frameworks & CSS
  'Carbon Design System': 'carbondesignsystem.com', 'Element UI': 'element-plus.org',
  'Fluent UI': 'microsoft.com', 'Headless UI': 'headlessui.com',
  'Materialize': 'materializecss.com', 'PrimeNG': 'primeng.org',
  'PrimeReact': 'primereact.org', 'PrimeVue': 'primevue.org',
  'Primer CSS': 'primer.style', 'Quasar': 'quasar.dev', 'Radix UI': 'radix-ui.com',
  'Semantic UI': 'semantic-ui.com', 'Tachyons': 'tachyons.io',
  'UIkit': 'getuikit.com', 'Vuetify': 'vuetifyjs.com',
  'shadcn/ui': 'ui.shadcn.com', 'styled-components': 'styled-components.com',
  'DataTables': 'datatables.net', 'Vuex': 'vuex.vuejs.org',
  // CMS & Static Site Generators
  'Blogger': 'blogger.com', 'Concrete CMS': 'concretecms.com',
  'Contao': 'contao.org', 'Craft CMS': 'craftcms.com', 'Directus': 'directus.io',
  'Docusaurus': 'docusaurus.io', 'Eleventy': '11ty.dev', 'Grav': 'getgrav.org',
  'Hexo': 'hexo.io', 'Hygraph': 'hygraph.com', 'Jekyll': 'jekyllrb.com',
  'KeystoneJS': 'keystonejs.com', 'Liferay': 'liferay.com', 'Magnolia': 'magnolia-cms.com',
  'Medium': 'medium.com', 'Notion': 'notion.so', 'October CMS': 'octobercms.com',
  'Pimcore': 'pimcore.com', 'Plone': 'plone.org', 'ProcessWire': 'processwire.com',
  'SilverStripe': 'silverstripe.org', 'Statamic': 'statamic.com',
  'TYPO3': 'typo3.org', 'Tilda': 'tilda.cc', 'Tumblr': 'tumblr.com',
  'Umbraco': 'umbraco.com', 'Wagtail': 'wagtail.org',
  // Hosting & Infrastructure
  'Azure': 'microsoft.com',
  'BunnyCDN': 'bunny.net', 'Caddy': 'caddyserver.com',
  'Cloudinary': 'cloudinary.com', 'Envoy': 'envoyproxy.io',
  'IIS': 'iis.net', 'ImageKit': 'imagekit.io', 'Neon': 'neon.tech',
  'PlanetScale': 'planetscale.com', 'Supabase Auth': 'supabase.com',
  'Uploadcare': 'uploadcare.com', 'Upstash': 'upstash.com',
  'Vercel AI SDK': 'vercel.com',
  // CDN & Performance
  'jsDelivr CDN': 'jsdelivr.com', 'unpkg': 'unpkg.com',
  'Autoptimize': 'autoptimize.com', 'Boomerang': 'akamai.com',
  'Polyfill.io': 'polyfill.io', 'Smush': 'wpmudev.com',
  // Security & Compliance
  'Cloudflare Turnstile': 'cloudflare.com', 'Didomi': 'didomi.io',
  'OneTrust CookiePro': 'onetrust.com',
  'Usercentrics': 'usercentrics.com',
  // Auth & Identity
  'Firebase Auth': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'Keycloak': 'keycloak.org',
  // Push & Messaging
  'Amazon SES': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'Firebase Cloud Messaging': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'MessageBird': 'messagebird.com', 'Postmark': 'postmarkapp.com',
  'Pusher': 'pusher.com', 'cm.com': 'cm.com',
  // Video & Media
  'Firework': 'firework.com', 'YouTube': 'youtube.com', 'YouTube Embed': 'youtube.com',
  // Maps & Geo
  'OpenStreetMap': 'openstreetmap.org',
  // Surveys & Forms
  'Cal.com': 'cal.com', 'JotForm': 'jotform.com', 'Tally': 'tally.so',
  // Accessibility
  'Localize': 'localizejs.com', 'Polylang': 'polylang.pro',
  'Transifex': 'transifex.com', 'Weglot': 'weglot.com', 'WPML': 'wpml.org',
  // Subscription & Commerce
  'ProfitWell': 'profitwell.com',
  // Monitoring & Error Tracking
  'AppDynamics': 'appdynamics.com', 'Bugsnag': 'bugsnag.com',
  'Rollbar': 'rollbar.com',
  // Advertising & Retargeting
  'Carbon Ads': 'carbonads.net', 'Ezoic': 'ezoic.com',
  'iGoDigital': 'salesforce.com', 'Inmobi': 'inmobi.com',
  'LiveIntent': 'liveintent.com', 'Mediavine': 'mediavine.com',
  'RTB House': 'rtbhouse.com', 'Visenze': 'visenze.com',
  // Search
  'Algolia AI': 'algolia.com', 'Algolia Recommend': 'algolia.com',
  'MeiliSearch': 'meilisearch.com', 'Searchanise': 'searchanise.com',
  'SearchSpring': 'searchspring.com',
  // Personalization & Recommendations
  'Builder.io': 'builder.io',
  // Shipping & Logistics
  'Route': 'route.com',
  // Misc tools & meta
  'ChatBot (AI)': 'chatbot.com', 'Chatbot (AI)': 'chatbot.com',
  'Discord Widget': 'discord.com', 'Fresh': 'fresh.deno.dev',
  'Glassbox': 'glassbox.com', 'Grprogram': 'grprogram.com',
  'HSTS': 'hstspreload.org', 'IndexNow': 'indexnow.org',
  'Java': 'java.com', 'JSON-LD Schema': 'schema.org',
  'Open Graph': 'ogp.me', 'Priority Hints': 'web.dev',
  'Schema Pro': 'wpschema.com', 'SuperAGI': 'superagi.com',
  'Twitter Cards': 'twitter.com', 'Rapchat': 'rapchat.com',
  'Mesoka': 'mesoka.com', 'Pinnacle': 'pinnacle.com',
  'generator': 'wordpress.org',
  'google-site-verification': 'https://www.google.com/s2/favicons?domain=search.google.com&sz=64',
  'msvalidate.01': 'bing.com', 'Impact': 'impact.com',
  'Popupsmart': 'popupsmart.com', 'Lander': 'landerapp.com',
  'Landingi': 'landingi.com', 'TagCommander': 'commandersact.com',
  'Beaver Builder': 'wpbeaverbuilder.com',
  'Adobe Fonts (Typekit)': 'fonts.adobe.com', 'Fonts.com': 'fonts.com',
  'Juspay Express Checkout': 'juspay.in', 'OptinMonster': 'optinmonster.com',
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

/* ── Watchlist View (Lead Intelligence & Prospecting) ───────────────── */
function WatchlistView({ watchlists, activeWatchlist, watchlistAccounts, wlLoading, showCreateWl, newWlName, renamingWl, renameValue, setShowCreateWl, setNewWlName, setRenamingWl, setRenameValue, createWatchlist, deleteWatchlist, renameWatchlist, fetchWatchlistDetail, removeFromWatchlist, setActiveWatchlist, setWatchlistAccounts, setActiveTab, formatDate, domainToName }: {
  watchlists: Watchlist[]; activeWatchlist: Watchlist | null; watchlistAccounts: WatchlistAccount[];
  wlLoading: boolean; showCreateWl: boolean; newWlName: string; renamingWl: string | null; renameValue: string;
  setShowCreateWl: (v: boolean) => void; setNewWlName: (v: string) => void;
  setRenamingWl: (v: string | null) => void; setRenameValue: (v: string) => void;
  createWatchlist: () => void; deleteWatchlist: (id: string) => void;
  renameWatchlist: (id: string) => void; fetchWatchlistDetail: (id: string) => void;
  removeFromWatchlist: (wlId: string, domain: string) => void;
  setActiveWatchlist: (v: Watchlist | null) => void; setWatchlistAccounts: (v: WatchlistAccount[]) => void;
  setActiveTab: (v: SidebarTab) => void; formatDate: (d: string) => string; domainToName: (d: string) => string;
}) {
  // Wizard step: 0 = dashboard, 1 = ICP setup, 2 = enrichment confirm, 3 = processing, 4 = enriched contacts
  // -1 = simple account list view (non-wizard)
  const [wizardStep, setWizardStep] = useState(0);
  const [enrichingWl, setEnrichingWl] = useState<string | null>(null); // watchlist ID being enriched
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [wlSearch, setWlSearch] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [step4Tab, setStep4Tab] = useState<'contacts' | 'accounts'>('contacts');
  // ICP role selections
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set(['CMO', 'VP Marketing', 'Head of Growth', 'Founder', 'Co-founder']));

  // Auto-select all accounts when entering step 2 ONLY if none were pre-selected from the list view
  const step2Initialized = useRef(false);
  useEffect(() => {
    if (wizardStep === 2 && !step2Initialized.current && watchlistAccounts.length > 0) {
      step2Initialized.current = true;
      // If user already selected specific accounts from the list view, keep that selection
      // Only auto-select all if nothing was pre-selected
      if (selectedCompanies.size === 0) {
        setSelectedCompanies(new Set(watchlistAccounts.map(a => a.normalizedDomain)));
      }
    }
    if (wizardStep !== 2) step2Initialized.current = false;
  }, [wizardStep, watchlistAccounts, selectedCompanies.size]);

  const ROLE_FILTERS = ['All Roles', 'Founder', 'C-Suite', 'Marketing', 'Sales', 'Product', 'Operations', 'Engineering'];

  const ICP_CATEGORIES = [
    { icon: '📣', title: 'Marketing & Growth', roles: ['CMO', 'VP Marketing', 'Head of Growth', 'Director of Marketing', 'Head of Performance', 'Head of Brand', 'Growth Manager', 'Head of Digital'] },
    { icon: '👑', title: 'Leadership', roles: ['Founder', 'Co-founder', 'CEO', 'COO', 'Managing Director'] },
    { icon: '💻', title: 'Technology', roles: ['CTO', 'VP Engineering', 'Head of Ecommerce', 'Head of Product', 'Director of Technology'] },
    { icon: '💰', title: 'Finance & Operations', roles: ['CFO', 'VP Finance', 'Head of Supply Chain', 'Director of Operations'] },
    { icon: '🛒', title: 'Sales', roles: ['VP Sales', 'Head of Sales', 'Director of Sales', 'Sales Manager', 'Head of Partnerships'] },
  ];

  const STEP_LABELS = ['Watchlist Dashboard', 'Decision-Maker ICP Setup', 'Enrichment Confirmation', 'Processing', 'Enriched Contacts'];

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => { const n = new Set(prev); if (n.has(role)) n.delete(role); else n.add(role); return n; });
  };
  const selectAllInCategory = (roles: string[]) => {
    setSelectedRoles(prev => { const n = new Set(prev); roles.forEach(r => n.add(r)); return n; });
  };

  // Start enrichment wizard for a specific watchlist
  const startEnrichment = async (wlId: string) => {
    setEnrichingWl(wlId);
    setWizardStep(1);
    await fetchWatchlistDetail(wlId);
  };

  // Simulate enrichment processing
  const runEnrichment = () => {
    setWizardStep(3);
    setEnrichProgress(0);
    const interval = setInterval(() => {
      setEnrichProgress(p => {
        if (p >= 100) { clearInterval(interval); setTimeout(() => setWizardStep(4), 500); return 100; }
        return p + Math.random() * 15 + 5;
      });
    }, 400);
  };

  // Filter accounts by search
  const filteredAccounts = watchlistAccounts.filter(a => {
    if (!wlSearch) return true;
    const q = wlSearch.toLowerCase();
    return a.normalizedDomain.includes(q) || (safeBrandName(a.brandName) || domainToName(a.normalizedDomain)).toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
  });

  // Filter contacts by role
  const filterContacts = (contacts: WatchlistContact[]) => {
    if (!roleFilter || roleFilter === 'All Roles') return contacts;
    return contacts.filter(c => c.department === roleFilter || c.title.toLowerCase().includes(roleFilter.toLowerCase()));
  };

  // Toggle company selection
  const toggleCompany = (domain: string) => {
    setSelectedCompanies(prev => { const n = new Set(prev); if (n.has(domain)) n.delete(domain); else n.add(domain); return n; });
  };
  const toggleAll = () => {
    if (selectedCompanies.size === filteredAccounts.length) setSelectedCompanies(new Set());
    else setSelectedCompanies(new Set(filteredAccounts.map(a => a.normalizedDomain)));
  };

  // CSV export
  const exportCSV = (onlySelected: boolean) => {
    const rows = [['Company', 'Domain', 'Category', 'Contact Name', 'Email', 'Job Title', 'Department'].join(',')];
    const accs = onlySelected ? filteredAccounts.filter(a => selectedCompanies.has(a.normalizedDomain)) : filteredAccounts;
    for (const a of accs) {
      const name = safeBrandName(a.brandName) || domainToName(a.normalizedDomain);
      const contacts = filterContacts(a.contacts);
      if (contacts.length === 0) {
        rows.push([name, a.normalizedDomain, a.category, '', '', '', ''].join(','));
      } else {
        for (const c of contacts) {
          rows.push([name, a.normalizedDomain, a.category, c.name, c.email, c.title, c.department].join(','));
        }
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeWatchlist?.name || 'watchlist'}-contacts.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalContacts = filteredAccounts.reduce((s, a) => s + filterContacts(a.contacts).length, 0);

  // ── Step indicator bar ──
  const StepBar = ({ current }: { current: number }) => (
    <div className="flex items-center gap-1 mb-6 bg-white dark:bg-[#161616] border border-slate-200 dark:border-white/[0.08] rounded-lg p-1">
      {STEP_LABELS.map((label, i) => (
        <button key={label} onClick={() => { if (i === 0) { setWizardStep(0); setActiveWatchlist(null); setWatchlistAccounts([]); } else if (i <= current) setWizardStep(i); }}
          disabled={i > current}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[11px] font-semibold transition-all ${
            i === current ? 'bg-[#C94C1E] text-white shadow-sm'
            : i < current ? 'text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer'
            : 'text-slate-400 dark:text-neutral-500'
          }`}>
          <span className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
            i === current ? 'bg-white/20 text-white'
            : i < current ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-neutral-500'
          }`}>{i < current ? '✓' : i + 1}</span>
          <span className="hidden lg:inline truncate">{label}</span>
        </button>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // SIMPLE ACCOUNT LIST VIEW (non-wizard, from "View Accounts")
  // ══════════════════════════════════════════════════════════════════════
  if (wizardStep === -1 && activeWatchlist) {
    const allSelected = selectedCompanies.size === watchlistAccounts.length && watchlistAccounts.length > 0;
    const someSelected = selectedCompanies.size > 0;
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { setWizardStep(0); setActiveWatchlist(null); setWatchlistAccounts([]); setSelectedCompanies(new Set()); }}
            className="p-1.5 rounded-lg text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-slate-800 dark:text-white">{activeWatchlist.name}</h2>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500">
              {watchlistAccounts.length} accounts{someSelected ? ` · ${selectedCompanies.size} selected` : ''}
            </p>
          </div>
          <button onClick={() => {
            // Pre-select the checked accounts for enrichment (or all if none selected)
            if (!someSelected) setSelectedCompanies(new Set(watchlistAccounts.map(a => a.normalizedDomain)));
            startEnrichment(activeWatchlist._id);
          }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[#C94C1E] text-white hover:bg-[#b5431a] transition-colors">
            <Zap size={11} /> Enrich {someSelected ? `${selectedCompanies.size} Selected` : 'All Contacts'}
          </button>
        </div>

        {wlLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="text-[#C94C1E] animate-spin" /></div>
        ) : watchlistAccounts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[13px] text-slate-400 dark:text-neutral-500 mb-3">This watchlist is empty</p>
            <button onClick={() => setActiveTab('account-explorer' as SidebarTab)} className="text-[12px] font-semibold text-[#C94C1E] hover:text-[#b5431a]">Browse accounts →</button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.12] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider bg-slate-50 dark:bg-white/[0.02]">
                  <th className="text-left px-4 py-2.5 w-[36px]">
                    <button onClick={() => {
                      if (allSelected) setSelectedCompanies(new Set());
                      else setSelectedCompanies(new Set(watchlistAccounts.map(a => a.normalizedDomain)));
                    }} className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors ${allSelected ? 'bg-[#C94C1E] border-[#C94C1E]' : someSelected ? 'bg-[#C94C1E]/30 border-[#C94C1E]' : 'border-slate-300 dark:border-neutral-600'}`}>
                      {allSelected && <Check size={10} className="text-white stroke-[3]" />}
                      {!allSelected && someSelected && <span className="w-1.5 h-0.5 bg-white rounded-full" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5">Company</th>
                  <th className="text-left px-4 py-2.5">Category</th>
                  <th className="text-left px-4 py-2.5">Region</th>
                  <th className="text-left px-4 py-2.5">Score</th>
                  <th className="text-left px-4 py-2.5">Traffic</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {watchlistAccounts.map(a => {
                  const name = safeBrandName(a.brandName) || domainToName(a.normalizedDomain);
                  const isChecked = selectedCompanies.has(a.normalizedDomain);
                  return (
                    <tr key={a.normalizedDomain} className={`border-t border-slate-100 dark:border-white/[0.06] hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group ${isChecked ? 'bg-[#C94C1E]/[0.03] dark:bg-[#C94C1E]/[0.05]' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleCompany(a.normalizedDomain)}
                          className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors ${isChecked ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-neutral-600 hover:border-slate-400'}`}>
                          {isChecked && <Check size={10} className="text-white stroke-[3]" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://www.google.com/s2/favicons?domain=${a.normalizedDomain}&sz=64`} alt="" className="w-7 h-7 rounded-md border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[12px] font-semibold text-slate-800 dark:text-white">{name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono">{a.normalizedDomain}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-[11px] text-slate-600 dark:text-neutral-300">{a.category}</span></td>
                      <td className="px-4 py-3"><span className="text-[11px] text-slate-500 dark:text-neutral-400">{a.region}</span></td>
                      <td className="px-4 py-3">
                        {a.harvinScore > 0 && <span className={`text-[11px] font-bold ${a.harvinScore >= 45 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-neutral-400'}`}>{a.harvinScore}</span>}
                      </td>
                      <td className="px-4 py-3"><span className="text-[11px] text-slate-500 dark:text-neutral-400">{a.monthlyVisitsFormatted || '—'}</span></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removeFromWatchlist(activeWatchlist._id, a.normalizedDomain)}
                          className="p-1 rounded text-slate-300 dark:text-neutral-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STEP 0: WATCHLIST DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  if (wizardStep === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <StepBar current={0} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-bold text-slate-800 dark:text-white">Watchlists</h2>
            <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-0.5">{watchlists.length} watchlist{watchlists.length !== 1 ? 's' : ''} · Track leads and discover decision makers</p>
          </div>
          <button onClick={() => setShowCreateWl(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C94C1E] text-white text-[12px] font-semibold hover:bg-[#b5431a] transition-colors">
            <Plus size={14} /> New Watchlist
          </button>
        </div>

        {showCreateWl && (
          <div className="bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.12] p-5 mb-5">
            <h3 className="text-[14px] font-bold text-slate-800 dark:text-white mb-3">Create Watchlist</h3>
            <div className="flex gap-2">
              <input type="text" placeholder="e.g. Top D2C Brands, Competitor Tracking..." value={newWlName} onChange={e => setNewWlName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createWatchlist()}
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] focus:border-[#C94C1E]/40 focus:ring-2 focus:ring-[#C94C1E]/10 rounded-xl text-[13px] outline-none transition-all dark:text-white dark:placeholder:text-neutral-500" autoFocus />
              <button onClick={createWatchlist} className="px-5 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors">Create</button>
              <button onClick={() => { setShowCreateWl(false); setNewWlName(''); }} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-neutral-400 text-[13px] font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {watchlists.length === 0 && !showCreateWl ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-[#C94C1E]/10 dark:to-[#C94C1E]/5 flex items-center justify-center mb-4">
              <Star size={28} className="text-[#C94C1E]" />
            </div>
            <p className="text-[16px] font-bold text-slate-700 dark:text-neutral-200 mb-1">No watchlists yet</p>
            <p className="text-[13px] text-slate-400 dark:text-neutral-500 mb-5 max-w-md">Create watchlists to track brands, discover decision makers, and export contacts for outbound sales.</p>
            <button onClick={() => setShowCreateWl(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20">
              <Plus size={16} /> Create your first watchlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {watchlists.map(wl => {
              const accCount = wl.domains?.length || 0;
              const contactCount = wl.contactCount || 0;
              // Deterministic mock signal stats from domain count
              const h = accCount * 7 + (wl._id?.charCodeAt(3) || 0);
              const hotSignals = Math.min(accCount, Math.max(0, (h % 6)));
              const warmSignals = Math.min(accCount, Math.max(0, ((h >> 2) % 8)));
              const enriched = contactCount;
              // Mock signal tags
              const tags: { label: string; color: string }[] = [];
              if (hotSignals > 0) tags.push({ label: `${hotSignals} Funded`, color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' });
              if (warmSignals > 1) tags.push({ label: `${Math.ceil(warmSignals / 2)} Store Expansion`, color: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' });
              if (accCount > 3) tags.push({ label: `${Math.min(accCount, (h % 4) + 1)} Key Hires`, color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' });

              return (
                <div key={wl._id} className="bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.12] hover:border-slate-300 dark:hover:border-white/[0.15] transition-colors group cursor-pointer overflow-hidden" onClick={() => { fetchWatchlistDetail(wl._id); setWizardStep(-1); }}>
                  {/* Top section */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      {renamingWl === wl._id ? (
                        <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renameWatchlist(wl._id); if (e.key === 'Escape') setRenamingWl(null); }}
                          onBlur={() => setRenamingWl(null)}
                          className="text-[13px] font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-md px-2 py-1 outline-none focus:border-[#C94C1E]/40"
                          autoFocus onClick={e => e.stopPropagation()} />
                      ) : (
                        <h3 className="text-[13px] font-bold text-slate-800 dark:text-white group-hover:text-[#C94C1E] transition-colors truncate">{wl.name}</h3>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setRenamingWl(wl._id); setRenameValue(wl.name); }} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 opacity-0 group-hover:opacity-100 transition-all"><Pencil size={11} /></button>
                        <button onClick={() => { if (confirm('Delete this watchlist?')) deleteWatchlist(wl._id); }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={11} /></button>
                      </div>
                    </div>

                    {/* Stats as mini cards */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-slate-50 dark:bg-white/[0.04] rounded-lg px-2.5 py-2 text-center">
                        <p className="text-[14px] font-bold text-slate-800 dark:text-white">{accCount}</p>
                        <p className="text-[9px] text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Accounts</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-white/[0.04] rounded-lg px-2.5 py-2 text-center">
                        <p className="text-[14px] font-bold text-slate-800 dark:text-white">{contactCount}</p>
                        <p className="text-[9px] text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Contacts</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-white/[0.04] rounded-lg px-2.5 py-2 text-center">
                        <p className="text-[14px] font-bold text-[#C94C1E]">{hotSignals + warmSignals}</p>
                        <p className="text-[9px] text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Signals</p>
                      </div>
                    </div>

                    {/* Signal tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map(t => (
                          <span key={t.label} className={`text-[10px] font-medium px-2 py-0.5 rounded border ${t.color}`}>{t.label}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom actions bar */}
                  <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => startEnrichment(wl._id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold bg-[#C94C1E] text-white hover:bg-[#b5431a] transition-colors">
                      <Zap size={10} /> Enrich
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-white/[0.06] transition-colors">
                      <Download size={10} /> Export
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-white/[0.06] transition-colors">
                      <ExternalLink size={10} /> CRM
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STEP 1: DECISION-MAKER ICP SETUP
  // ══════════════════════════════════════════════════════════════════════
  if (wizardStep === 1) {
    return (
      <div className="max-w-5xl mx-auto">
        <StepBar current={1} />
        <h2 className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight mb-1">Decision-Maker Profile Setup</h2>
        <p className="text-[13px] text-slate-500 dark:text-neutral-400 mb-6">Select the roles you want to target. Harvin will search for these titles when enriching contacts.</p>
        {wlLoading && (
          <div className="flex items-center justify-center py-10 mb-4">
            <Loader2 size={24} className="text-[#C94C1E] animate-spin mr-2" />
            <span className="text-[13px] text-slate-400 dark:text-neutral-500">Loading watchlist data...</span>
          </div>
        )}
        <div className="flex gap-6">
          {/* Left: Role categories */}
          <div className="flex-1 bg-white dark:bg-[#161616] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-6 shadow-sm dark:shadow-none">
            {ICP_CATEGORIES.map(cat => (
              <div key={cat.title} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-black text-slate-800 dark:text-neutral-100 uppercase tracking-wide flex items-center gap-2">{cat.icon} {cat.title}</h3>
                  <button onClick={() => selectAllInCategory(cat.roles)} className="text-[10px] font-semibold text-[#C94C1E] hover:text-[#b5431a] transition-colors">Select all</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cat.roles.map(role => {
                    const on = selectedRoles.has(role);
                    return (
                      <button key={role} onClick={() => toggleRole(role)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${on ? 'bg-[#C94C1E] text-white border-[#C94C1E]' : 'border-slate-200 dark:border-white/[0.1] text-slate-500 dark:text-neutral-400 hover:border-[#C94C1E]/40 hover:text-[#C94C1E]'}`}>
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-white/[0.08]">
              <button onClick={() => { setWizardStep(0); setActiveWatchlist(null); setWatchlistAccounts([]); }} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-neutral-400 text-[13px] font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">Cancel</button>
              <button onClick={() => setWizardStep(2)} disabled={selectedRoles.size === 0}
                className="px-5 py-2.5 rounded-xl bg-[#C94C1E] text-white text-[13px] font-bold hover:bg-orange-700 transition-colors disabled:opacity-40">
                Save Profile & Continue
              </button>
            </div>
          </div>
          {/* Right: Summary */}
          <div className="w-[280px] flex-shrink-0">
            <div className="bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.12] p-5 sticky top-4">
              <h4 className="text-[12px] font-black text-slate-700 dark:text-neutral-200 uppercase tracking-wide mb-3">Your Decision-Maker Profile</h4>
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 mb-3">Harvin will search for these titles when you enrich accounts</p>
              <div className="space-y-1.5 mb-4">
                {[...selectedRoles].map(r => (
                  <div key={r} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-white/[0.04] rounded-lg">
                    <span className="text-[11px] font-medium text-slate-700 dark:text-neutral-200">{r}</span>
                    <button onClick={() => toggleRole(r)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
                  </div>
                ))}
              </div>
              {selectedRoles.size === 0 && <p className="text-[11px] text-slate-400 italic text-center py-4">No roles selected</p>}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                <p className="text-[10px] text-blue-700 dark:text-blue-400">Based on your profile, Harvin will return <strong>1-3 contacts per account</strong> on average. Enrichment uses <strong>1 credit per contact</strong> found.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: ENRICHMENT CONFIRMATION
  // ══════════════════════════════════════════════════════════════════════
  if (wizardStep === 2) {
    const enrichAccounts = filteredAccounts;
    const enrichSelected = selectedCompanies.size > 0 ? filteredAccounts.filter(a => selectedCompanies.has(a.normalizedDomain)) : filteredAccounts;
    const estCreditsMin = enrichSelected.length;
    const estCreditsMax = enrichSelected.length * 3;
    return (
      <div className="max-w-5xl mx-auto">
        <StepBar current={2} />
        <h2 className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight mb-1">Enrichment Confirmation</h2>
        <p className="text-[13px] text-slate-500 dark:text-neutral-400 mb-6">Select accounts to enrich. Credits are consumed per contact found, not per account searched.</p>
        <div className="flex gap-6">
          {/* Left: Account selection */}
          <div className="flex-1 bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.12] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold text-slate-800 dark:text-white">Select Accounts to Enrich</h3>
              <span className="text-[11px] text-slate-400 dark:text-neutral-500">{enrichAccounts.length} accounts in watchlist</span>
            </div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <button onClick={() => {
                  if (selectedCompanies.size === enrichAccounts.length) setSelectedCompanies(new Set());
                  else setSelectedCompanies(new Set(enrichAccounts.map(a => a.normalizedDomain)));
                }} className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors ${selectedCompanies.size === enrichAccounts.length ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-neutral-600'}`}>
                  {selectedCompanies.size === enrichAccounts.length && <Check size={10} className="text-white stroke-[3]" />}
                </button>
                <span className="text-[11px] font-medium text-slate-600 dark:text-neutral-300">{selectedCompanies.size} of {enrichAccounts.length} selected</span>
              </div>
              <button onClick={() => {
                if (selectedCompanies.size === enrichAccounts.length) setSelectedCompanies(new Set());
                else setSelectedCompanies(new Set(enrichAccounts.map(a => a.normalizedDomain)));
              }} className="text-[10px] font-semibold text-[#C94C1E] hover:text-[#b5431a] transition-colors">
                {selectedCompanies.size === enrichAccounts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
              {enrichAccounts.map(a => {
                const name = safeBrandName(a.brandName) || domainToName(a.normalizedDomain);
                const isOn = selectedCompanies.has(a.normalizedDomain);
                return (
                  <div key={a.normalizedDomain} onClick={() => toggleCompany(a.normalizedDomain)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${isOn ? 'bg-slate-50 dark:bg-white/[0.04]' : 'opacity-50'}`}>
                    <button className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors ${isOn ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-neutral-600'}`}>
                      {isOn && <Check size={10} className="text-white stroke-[3]" />}
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://www.google.com/s2/favicons?domain=${a.normalizedDomain}&sz=64`} alt="" className="w-7 h-7 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{a.category}{a.region && a.region !== 'Global' ? ` · ${a.region}` : ''}</p>
                    </div>
                    {a.harvinScore > 0 && <span className="text-[10px] font-bold text-[#C94C1E] bg-[#C94C1E]/10 px-2 py-0.5 rounded-full">{a.harvinScore}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Right: Summary */}
          <div className="w-[300px] flex-shrink-0 space-y-4">
            <div className="bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.12] p-5">
              <h4 className="text-[13px] font-bold text-slate-800 dark:text-white mb-4">Enrichment Summary</h4>
              <div className="space-y-2.5 text-[12px]">
                <div className="flex justify-between"><span className="text-slate-400 dark:text-neutral-500">Watchlist</span><span className="font-semibold text-slate-700 dark:text-neutral-200">{activeWatchlist?.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400 dark:text-neutral-500">Accounts to enrich</span><span className="font-semibold text-slate-700 dark:text-neutral-200">{enrichSelected.length} of {enrichAccounts.length}</span></div>
                <div className="flex justify-between"><span className="text-slate-400 dark:text-neutral-500">Data includes</span><span className="font-semibold text-slate-700 dark:text-neutral-200 text-right">Name, Title, Email,<br/>Phone, LinkedIn</span></div>
              </div>
              <div className="mt-4 p-3 bg-slate-50 dark:bg-white/[0.04] rounded-lg">
                <p className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Your Decision-Maker Profile</p>
                <div className="flex flex-wrap gap-1">{[...selectedRoles].slice(0, 5).map(r => <span key={r} className="text-[10px] font-semibold text-[#C94C1E] bg-[#C94C1E]/10 px-2 py-0.5 rounded-full">{r}</span>)}</div>
                <button onClick={() => setWizardStep(1)} className="text-[10px] font-semibold text-[#C94C1E] mt-1.5 hover:text-[#b5431a]">Edit profile →</button>
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#C94C1E]/5 to-orange-50 dark:from-[#C94C1E]/10 dark:to-[#C94C1E]/5 rounded-xl border border-[#C94C1E]/20 p-5">
              <p className="text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Estimated Credits</p>
              <p className="text-[28px] font-black text-[#C94C1E]">{estCreditsMin} – {estCreditsMax}</p>
              <p className="text-[10px] text-slate-400 dark:text-neutral-500">1-3 contacts per account · billed per contact found</p>
            </div>
            <button onClick={runEnrichment} className="w-full py-3 rounded-xl bg-[#C94C1E] text-white text-[14px] font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
              <Zap size={16} /> Enrich {enrichSelected.length} Accounts
            </button>
            <p className="text-[10px] text-slate-400 dark:text-neutral-500 text-center">Credits are charged per contact found, not per account searched.</p>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STEP 3: PROCESSING STATE
  // ══════════════════════════════════════════════════════════════════════
  if (wizardStep === 3) {
    const pct = Math.min(100, Math.round(enrichProgress));
    return (
      <div className="max-w-5xl mx-auto">
        <StepBar current={3} />
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full border-[3px] border-slate-200 dark:border-white/[0.08]" />
            <div className="absolute inset-0 w-24 h-24 rounded-full border-[3px] border-transparent border-t-[#C94C1E] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[22px] font-black text-[#C94C1E]">{pct}%</span>
            </div>
          </div>
          <h2 className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight mb-2">Enriching Contacts</h2>
          <p className="text-[13px] text-slate-500 dark:text-neutral-400 mb-10 max-w-md text-center">Searching for decision makers across {selectedCompanies.size || watchlistAccounts.length} accounts</p>
          <div className="w-full max-w-lg">
            <div className="w-full h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#C94C1E] via-orange-400 to-amber-400 rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[12px] font-medium text-slate-500 dark:text-neutral-400 mt-4 text-center">{pct < 30 ? 'Querying enrichment APIs...' : pct < 70 ? 'Matching decision makers...' : pct < 100 ? 'Finalizing results...' : '✓ Complete!'}</p>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: ENRICHED CONTACTS TAB (flat table view)
  // ══════════════════════════════════════════════════════════════════════
  if (wizardStep === 4) {
    // Only show accounts the user selected in Step 2
    const enrichedAccounts = selectedCompanies.size > 0
      ? filteredAccounts.filter(a => selectedCompanies.has(a.normalizedDomain))
      : filteredAccounts;

    // Filter contacts by ICP roles selected in Step 1, then by runtime role filter
    const filterByICP = (contacts: WatchlistContact[]) => {
      let result = contacts;
      // First filter by ICP roles from Step 1
      if (selectedRoles.size > 0) {
        result = result.filter(c =>
          [...selectedRoles].some(role => c.title.toLowerCase().includes(role.toLowerCase()) || c.department.toLowerCase().includes(role.toLowerCase()))
        );
      }
      // Then apply runtime role filter pills
      if (roleFilter && roleFilter !== 'All Roles') {
        result = result.filter(c => c.department === roleFilter || c.title.toLowerCase().includes(roleFilter.toLowerCase()));
      }
      return result;
    };

    const allContacts = enrichedAccounts.flatMap(a => filterByICP(a.contacts).map(c => ({ ...c, company: safeBrandName(a.brandName) || domainToName(a.normalizedDomain), domain: a.normalizedDomain })));
    const verified = allContacts.filter((_, i) => i % 3 !== 2).length;
    const likelyValid = allContacts.length - verified;

    return (
      <div className="max-w-6xl mx-auto">
        {wizardStep === 4 && <StepBar current={4} />}
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { setWizardStep(0); setActiveWatchlist(null); setWatchlistAccounts([]); setSelectedCompanies(new Set()); setRoleFilter(''); setWlSearch(''); }}
            className="p-1.5 rounded-lg text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-slate-800 dark:text-white">{activeWatchlist?.name}</h2>
          </div>
          <button onClick={() => exportCSV(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold text-white bg-[#C94C1E] hover:bg-orange-700 transition-colors">
            <Download size={14} /> Download CSV
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-slate-200 dark:border-white/[0.12] mb-5">
          <button onClick={() => setStep4Tab('accounts')}
            className={`pb-2.5 text-[13px] font-semibold transition-colors ${step4Tab === 'accounts' ? 'text-[#C94C1E] border-b-2 border-[#C94C1E] font-bold' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300'}`}>
            Accounts <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${step4Tab === 'accounts' ? 'bg-[#C94C1E]/10 text-[#C94C1E]' : 'bg-slate-100 dark:bg-white/[0.06]'}`}>{enrichedAccounts.length}</span>
          </button>
          <button onClick={() => setStep4Tab('contacts')}
            className={`pb-2.5 text-[13px] font-semibold transition-colors ${step4Tab === 'contacts' ? 'text-[#C94C1E] border-b-2 border-[#C94C1E] font-bold' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300'}`}>
            Enriched Contacts <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${step4Tab === 'contacts' ? 'bg-[#C94C1E]/10 text-[#C94C1E]' : 'bg-slate-100 dark:bg-white/[0.06]'}`}>{allContacts.length}</span>
          </button>
        </div>

        {/* ── Accounts Sub-Tab ── */}
        {step4Tab === 'accounts' && (
          <div className="space-y-2">
            {enrichedAccounts.map(a => {
              const name = safeBrandName(a.brandName) || domainToName(a.normalizedDomain);
              const contactCount = filterByICP(a.contacts).length;
              return (
                <div key={a.normalizedDomain} className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#141414] rounded-xl border border-slate-200 dark:border-white/[0.12] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://www.google.com/s2/favicons?domain=${a.normalizedDomain}&sz=64`} alt="" className="w-9 h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-bold text-slate-800 dark:text-white">{name}</h3>
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono">{a.normalizedDomain}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-neutral-500">{a.category}{a.region && a.region !== 'Global' ? ` · ${a.region}` : ''}{a.businessModel ? ` · ${a.businessModel}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-full">{contactCount} contacts</span>
                    {a.harvinScore > 0 && <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${a.harvinScore >= 45 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-white/[0.06]'}`}>{a.harvinScore} score</span>}
                    {a.monthlyVisitsFormatted && <span className="text-[10px] font-medium text-slate-500 dark:text-neutral-400">{a.monthlyVisitsFormatted}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Contacts Sub-Tab ── */}
        {step4Tab === 'contacts' && (<>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-4 px-5 py-4 bg-white dark:bg-[#161616] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm dark:shadow-none">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center"><Users size={18} className="text-blue-500" /></div>
            <div><p className="text-[22px] font-black text-slate-900 dark:text-white leading-none">{allContacts.length}</p><p className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mt-1">Total Contacts</p></div>
          </div>
          <div className="flex items-center gap-4 px-5 py-4 bg-white dark:bg-[#161616] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm dark:shadow-none">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center"><Check size={18} className="text-emerald-500" /></div>
            <div><p className="text-[22px] font-black text-slate-900 dark:text-white leading-none">{verified}</p><p className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mt-1">Verified Emails</p></div>
          </div>
          <div className="flex items-center gap-4 px-5 py-4 bg-white dark:bg-[#161616] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm dark:shadow-none">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center"><Zap size={18} className="text-amber-500" /></div>
            <div><p className="text-[22px] font-black text-slate-900 dark:text-white leading-none">{likelyValid}</p><p className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mt-1">Likely Valid</p></div>
          </div>
        </div>

        {/* Search + Role filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" size={14} />
            <input type="text" placeholder="Search contacts or companies..." value={wlSearch} onChange={e => setWlSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.12] rounded-lg text-[12px] outline-none focus:border-[#C94C1E]/40 focus:ring-2 focus:ring-[#C94C1E]/10 transition-all dark:text-white dark:placeholder:text-neutral-500" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {ROLE_FILTERS.map(r => (
              <button key={r} onClick={() => setRoleFilter(r === 'All Roles' ? '' : r)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${(!roleFilter && r === 'All Roles') || roleFilter === r ? 'bg-[#C94C1E] text-white' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-white/[0.1]'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Contacts table */}
        {wlLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="text-[#C94C1E] animate-spin" /></div>
        ) : (
          <div className="bg-white dark:bg-[#161616] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-sm dark:shadow-none">
            {/* Select all / deselect bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <button onClick={() => {
                  const visibleKeys = allContacts.slice(0, 50).map((c, i) => `${c.domain}-${i}`);
                  if (selectedContacts.size === visibleKeys.length) setSelectedContacts(new Set());
                  else setSelectedContacts(new Set(visibleKeys));
                }} className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors ${selectedContacts.size > 0 ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-neutral-600'}`}>
                  {selectedContacts.size > 0 && <Check size={10} className="text-white stroke-[3]" />}
                </button>
                <span className="text-[11px] font-medium text-slate-600 dark:text-neutral-300">{selectedContacts.size > 0 ? `${selectedContacts.size} selected` : 'Select all'}</span>
              </div>
              <button onClick={() => {
                const visibleKeys = allContacts.slice(0, 50).map((c, i) => `${c.domain}-${i}`);
                if (selectedContacts.size === visibleKeys.length) setSelectedContacts(new Set());
                else setSelectedContacts(new Set(visibleKeys));
              }} className="text-[10px] font-semibold text-[#C94C1E] hover:text-[#b5431a] transition-colors">
                {selectedContacts.size > 0 ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider bg-slate-50/50 dark:bg-white/[0.01]">
                  <th className="text-left px-4 py-3 w-8"></th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">LinkedIn</th>
                  <th className="text-left px-4 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {allContacts.slice(0, 50).map((c, i) => {
                  const isVerified = i % 3 !== 2;
                  const contactKey = `${c.domain}-${i}`;
                  const isContactSelected = selectedContacts.has(contactKey);
                  return (
                    <tr key={contactKey} className={`border-t border-slate-100 dark:border-white/[0.06] hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors ${isContactSelected ? 'bg-orange-50/50 dark:bg-[#C94C1E]/5' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedContacts(prev => { const n = new Set(prev); if (n.has(contactKey)) n.delete(contactKey); else n.add(contactKey); return n; })}
                          className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors ${isContactSelected ? 'bg-[#C94C1E] border-[#C94C1E]' : 'border-slate-300 dark:border-neutral-600'}`}>
                          {isContactSelected && <Check size={10} className="text-white stroke-[3]" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: `hsl(${(c.name.charCodeAt(0) * 47 + c.name.charCodeAt(1) * 13) % 360}, 55%, 50%)` }}>
                            {c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-[12px] font-semibold text-slate-800 dark:text-white">{c.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-neutral-500">{c.title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=32`} alt="" className="w-5 h-5 rounded border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] flex-shrink-0" />
                          <span className="text-[12px] font-medium text-slate-700 dark:text-neutral-200">{c.company}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-slate-600 dark:text-neutral-300 font-mono">{c.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium cursor-pointer hover:underline">Profile</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${isVerified ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'}`}>
                          {isVerified ? '✓ Verified' : '⚠ Likely valid'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {allContacts.length > 50 && (
              <div className="px-4 py-3 text-center border-t border-slate-100 dark:border-white/[0.06]">
                <p className="text-[11px] text-slate-400 dark:text-neutral-500">Showing 50 of {allContacts.length} contacts · <button className="text-[#C94C1E] font-semibold hover:underline">Load more</button></p>
              </div>
            )}
          </div>
        )}
        </>)}

      </div>
    );
  }

  return null;
}

/* ── Tech Change helpers ───────────────────────────────────────────────── */

function TechChangeIcon({ techName, color }: { techName: string; color: string }) {
  const [failed, setFailed] = useState(false);
  const logoVal = TECH_LOGO_MAP[techName];
  const fallbackDomain = !logoVal ? guessTechDomain(techName) : null;
  const iconUrl = logoVal
    ? (logoVal.startsWith('http') ? logoVal : `https://icon.horse/icon/${logoVal}`)
    : `https://icon.horse/icon/${fallbackDomain}`;
  return (
    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-white dark:bg-[#1a1a1e] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
      {!failed ? (
        <img src={iconUrl} alt={techName} className="w-[22px] h-[22px] object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[10px] font-extrabold" style={{ color }}>{techName.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

const CAT_COLORS: Record<string, string> = {
  'Marketing automation': '#8B5CF6', 'Email Marketing': '#8B5CF6', 'Email': '#8B5CF6',
  'Analytics & Optimization Platform': '#3B82F6', 'Analytics': '#3B82F6',
  'Payment processors': '#F59E0B', 'Payments & Checkout - Gateway': '#F59E0B',
  'Customer Support': '#10B981', 'Live chat': '#10B981',
  'Ecommerce Platform': '#EC4899', 'Ecommerce': '#EC4899',
  'A/B Testing': '#6366F1', 'A/B Testing & Personalization': '#6366F1',
  'CRM': '#0EA5E9', 'Customer Engagement / CRM': '#0EA5E9',
  'Site Search': '#F97316', 'Customer Data Platform': '#14B8A6',
  'Reviews & UGC': '#A855F7', 'Push notifications': '#EF4444',
};

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

  // Bulk Lookup state
  type BulkRow = {
    domain: string;
    category: string | null;
    subCategory: string | null;
    businessModel: string | null;
    appPresence: string | null;
    source: 'company_meta' | 'scan' | 'failed';
    error?: string;
  };
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, phase: '' });
  const [bulkSummary, setBulkSummary] = useState<{ total: number; fromMeta: number; scanned: number; failed: number; ts: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

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
    const clean = domain.trim().replace(/^https?:\/\//, '').replace(/^www\d*\./, '').replace(/\/+$/, '');
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
            storeRawCount: metaJson.data.storeRawCount || metaJson.data.aiStoreCount || 0,
            businessModel: metaJson.data.businessModel || '',
            appPresence: metaJson.data.appPresence || '',
            monthlyVisitsFormatted: metaJson.data.monthlyVisitsFormatted || '',
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
        // Tag techs with added/removed based on techChanges from API
        if (data.techChanges) {
          const addedSet = new Set(data.techChanges.added || []);
          const removedSet = new Set(data.techChanges.removed || []);
          data.technologies = data.technologies.map(t => ({
            ...t,
            changeTag: addedSet.has(t.name) ? 'added' as const : undefined,
          }));
          // Append removed techs so they show in the list with a "removed" tag
          for (const name of removedSet) {
            if (!data.technologies.some(t => t.name === name)) {
              data.technologies.push({ name, category: 'Removed', color: '#ef4444', changeTag: 'removed' });
            }
          }
        }
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

  /* ── Bulk lookup: company_meta → fallback to /api/detect ────────── */
  const downloadBulkCsv = (rows: BulkRow[]) => {
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['Domain', 'Category', 'SubCategory', 'Business Model', 'App Presence', 'Source', 'Error'];
    const lines = [
      headers.join(','),
      ...rows.map(r => [r.domain, r.category, r.subCategory, r.businessModel, r.appPresence, r.source, r.error || ''].map(esc).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `bulk-lookup-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async (file: File) => {
    if (bulkRunning) return;
    setBulkError(null);
    setBulkSummary(null);

    let domains: string[];
    try {
      const text = await file.text();
      const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) { setBulkError('CSV is empty'); return; }
      const header = lines[0].toLowerCase();
      const hasHeader = /domain|url|website|company/.test(header);
      const dataLines = hasHeader ? lines.slice(1) : lines;
      let colIndex = 0;
      if (hasHeader) {
        const cols = lines[0].split(',').map(c => c.trim().toLowerCase());
        const idx = cols.findIndex(c => c.includes('domain') || c.includes('url') || c.includes('website'));
        if (idx >= 0) colIndex = idx;
      }
      const raw = dataLines
        .map(l => (l.split(',')[colIndex] || '').trim())
        .filter(Boolean)
        .map(d => d.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/.*$/, '').toLowerCase())
        .filter(d => /\./.test(d));
      domains = [...new Set(raw)];
      if (domains.length === 0) { setBulkError('No valid domains found'); return; }
      if (domains.length > 5000) { setBulkError('Max 5,000 domains per upload'); return; }
    } catch {
      setBulkError('Failed to read CSV');
      return;
    }

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: domains.length, phase: 'Looking up known brands...' });

    const results: BulkRow[] = [];
    let fromMeta = 0;
    let scanned = 0;
    let failed = 0;

    try {
      // Phase 1: bulk DB lookup
      const lookupRes = await fetch('/api/bulk-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains }),
      });
      if (!lookupRes.ok) throw new Error(`Lookup failed (HTTP ${lookupRes.status})`);
      const lookup = await lookupRes.json();
      if (lookup.error) throw new Error(lookup.error);

      for (const f of (lookup.found || []) as Omit<BulkRow, 'source'>[]) {
        results.push({ ...f, source: 'company_meta' });
      }
      fromMeta = (lookup.found || []).length;
      const notFound: string[] = lookup.notFound || [];

      setBulkProgress({ done: fromMeta, total: domains.length, phase: `Scanning ${notFound.length} unknown domain${notFound.length === 1 ? '' : 's'}...` });

      // Phase 2: concurrency-limited scan for unknowns
      const CONCURRENCY = 4;
      let cursor = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, notFound.length) }, async () => {
        while (cursor < notFound.length) {
          const i = cursor++;
          const dom = notFound[i];
          try {
            const r = await fetch(`/api/detect?url=${encodeURIComponent(dom)}`);
            const j = await r.json();
            if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
            const meta = (j.companyMeta || {}) as Record<string, unknown>;
            results.push({
              domain: dom,
              category: (meta.category as string) || null,
              subCategory: (meta.subCategory as string) || null,
              businessModel: (meta.businessModel as string) || null,
              appPresence: (meta.appPresence as string) || null,
              source: 'scan',
            });
            scanned++;
          } catch (err) {
            results.push({
              domain: dom,
              category: null, subCategory: null, businessModel: null, appPresence: null,
              source: 'failed',
              error: (err as Error).message || 'Scan failed',
            });
            failed++;
          }
          setBulkProgress(p => ({ ...p, done: fromMeta + scanned + failed }));
        }
      });
      await Promise.all(workers);

      // Re-order results to match original input order
      const order = new Map(domains.map((d, i) => [d, i]));
      results.sort((a, b) => (order.get(a.domain) ?? 0) - (order.get(b.domain) ?? 0));

      downloadBulkCsv(results);
      setBulkSummary({ total: domains.length, fromMeta, scanned, failed, ts: Date.now() });
    } catch (err) {
      setBulkError((err as Error).message || 'Bulk lookup failed');
    } finally {
      setBulkRunning(false);
      setBulkProgress({ done: 0, total: 0, phase: '' });
    }
  };

  const visibleTechs = scanResult ? scanResult.technologies.filter(t => t.changeTag !== 'removed') : [];
  const grouped = visibleTechs.reduce<Record<string, ScanTech[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});
  const categories = scanSortCategories(grouped);
  const filteredCats = activeCat ? categories.filter(c => c === activeCat) : categories;

  return (
    <div className="space-y-5">
      {/* Scanner input */}
      <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
        <form onSubmit={e => { e.preventDefault(); runScan(scanInput); }}
          className="flex items-center gap-3">
          <div className="flex-shrink-0 text-slate-400 dark:text-neutral-500">
            <Globe size={18} />
          </div>
          <input type="text" value={scanInput} onChange={e => setScanInput(e.target.value)}
            placeholder="Enter domain — e.g. mamaearth.in"
            className="flex-1 bg-transparent outline-none text-[14px] text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 min-w-0" />
          <button type="submit" disabled={!scanInput.trim() || scanning}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </form>
        {!scanResult && !scanning && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
            <span className="text-[11px] text-slate-400 dark:text-neutral-600">Quick scan:</span>
            {SCAN_DEMO_BRANDS.map(b => (
              <button key={b.url} type="button" onClick={() => { setScanInput(b.url); runScan(b.url); }}
                className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 hover:text-[#C94C1E] px-2 py-0.5 rounded-md bg-slate-50 dark:bg-white/[0.04] hover:bg-[#C94C1E]/5 transition-colors">
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Bulk Lookup card ──────────────────────────────────── */}
      {!scanning && !scanResult && (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#C94C1E]/10 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet size={17} className="text-[#C94C1E]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white">Bulk Lookup</h3>
              <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-0.5">
                Upload a CSV of domains to get category, sub-category, business model, and app presence. We&apos;ll look up known brands instantly and scan unknown domains.
              </p>
            </div>
          </div>

          <input
            ref={bulkFileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleBulkUpload(f);
              e.target.value = '';
            }}
          />

          {!bulkRunning && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => bulkFileRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] transition-colors">
                <Upload size={15} /> Choose CSV File
              </button>
              <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                Supports .csv, .tsv — needs a <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06]">domain</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06]">url</code>, or <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06]">website</code> column. Max 5,000 rows.
              </span>
            </div>
          )}

          {bulkRunning && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-[#C94C1E]" />
                <span className="text-[12px] font-semibold text-slate-700 dark:text-neutral-200">{bulkProgress.phase}</span>
                <span className="ml-auto text-[12px] tabular-nums text-slate-500 dark:text-neutral-400">{bulkProgress.done}/{bulkProgress.total}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-[#C94C1E] transition-all duration-300"
                  style={{ width: `${bulkProgress.total > 0 ? Math.min(100, (bulkProgress.done / bulkProgress.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {bulkError && !bulkRunning && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-600 dark:text-red-400">{bulkError}</p>
            </div>
          )}

          {bulkSummary && !bulkRunning && !bulkError && (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
              <Check size={14} className="text-emerald-600" />
              <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                Exported {bulkSummary.total} rows
              </span>
              <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                ({bulkSummary.fromMeta} from DB
                {bulkSummary.scanned > 0 ? ` · ${bulkSummary.scanned} scanned` : ''}
                {bulkSummary.failed > 0 ? ` · ${bulkSummary.failed} failed` : ''})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Scanning state */}
      {scanning && !scanResult && (
        <div className="flex flex-col items-center py-16">
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 rounded-full border-[2.5px] border-slate-200 dark:border-white/[0.08]" />
            <div className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-[#C94C1E] animate-spin" />
          </div>
          <p className="text-[14px] font-semibold text-slate-700 dark:text-neutral-200">Scanning {scanDomain}</p>
          <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-1">Detecting technologies and company info...</p>
        </div>
      )}

      {/* Meta loading state */}
      {scanResult && metaLoading && scanResult.companyMeta && (
        <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <img src={faviconUrl(scanDomain)} alt="" className="w-8 h-8 rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">{domainToName(scanDomain)}</h3>
              <p className="text-[12px] text-slate-400 dark:text-neutral-500">{scanDomain}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {[scanResult.companyMeta.category, scanResult.companyMeta.region, scanResult.companyMeta.offlineStores].filter(Boolean).map(v => (
              <span key={v} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-neutral-400">{v}</span>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 py-6">
            <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-white/[0.08] border-t-[#C94C1E] animate-spin" />
            <span className="text-[12px] text-slate-400 dark:text-neutral-500">Loading technologies...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {scanError && !scanning && (
        <div className="text-center py-12">
          <p className="text-[14px] font-semibold text-slate-700 dark:text-neutral-200 mb-1">Scan failed</p>
          <p className="text-[12px] text-slate-400 dark:text-neutral-500 mb-4">{scanError}</p>
          <button onClick={() => runScan(scanDomain)} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[#C94C1E] hover:bg-[#b5431a] transition-colors">Retry</button>
        </div>
      )}

      {/* ── Full results — Tech DNA Report ──────────────────── */}
      {scanResult && !scanning && !metaLoading && scanResult.count > 0 && (() => {
        const addedCount = scanResult.techChanges?.added?.length || 0;
        const removedCount = scanResult.techChanges?.removed?.length || 0;
        const hasChanges = addedCount > 0 || removedCount > 0;
        const allTechs = filteredCats.flatMap(cat => grouped[cat]);
        const totalTech = visibleTechs.length;
        // Donut chart data
        const RING_COLORS = ['#C94C1E', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#0EA5E9', '#F97316', '#14B8A6', '#A855F7', '#EF4444', '#64748B', '#84CC16', '#06B6D4'];
        const donutData = categories.map((cat, i) => ({ name: cat, count: grouped[cat].length, color: RING_COLORS[i % RING_COLORS.length] }));
        const circumference = 2 * Math.PI * 54;
        let donutOffset = 0;

        return (
        <div className="space-y-5">

          {/* ── Hero card: brand + donut + stats ──────────── */}
          <div className="bg-white dark:bg-[#131316] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="flex flex-col sm:flex-row">

              {/* Left: donut visualization */}
              <div className="sm:w-[220px] flex-shrink-0 flex flex-col items-center justify-center py-6 px-4 bg-slate-50/50 dark:bg-white/[0.015] border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-white/[0.05]">
                <div className="relative w-[130px] h-[130px]">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    {donutData.map(seg => {
                      const segLen = (seg.count / totalTech) * circumference;
                      const gap = 2;
                      const d = <circle key={seg.name} cx="60" cy="60" r="54" fill="none" stroke={activeCat === seg.name ? seg.color : seg.color} strokeWidth={activeCat && activeCat !== seg.name ? '6' : '10'}
                        strokeDasharray={`${Math.max(0, segLen - gap)} ${circumference - segLen + gap}`} strokeDashoffset={-donutOffset} strokeLinecap="round"
                        className="transition-all duration-300 cursor-pointer" style={{ opacity: activeCat && activeCat !== seg.name ? 0.2 : 1 }}
                        onClick={() => setActiveCat(activeCat === seg.name ? null : seg.name)} />;
                      donutOffset += segLen;
                      return d;
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[28px] font-black text-slate-800 dark:text-white tabular-nums leading-none">{totalTech}</span>
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-widest mt-1">Techs</span>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-widest">{categories.length} categories</p>
                </div>
              </div>

              {/* Right: brand info + meta + changes summary */}
              <div className="flex-1 p-5">
                {/* Brand row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={faviconUrl(scanDomain)} alt="" className="w-9 h-9 rounded-xl border border-slate-200/60 dark:border-white/[0.06]"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div>
                      <h3 className="text-[16px] font-bold text-slate-800 dark:text-white leading-tight">{domainToName(scanDomain)}</h3>
                      <p className="text-[11px] text-slate-400 dark:text-neutral-500">{scanDomain}</p>
                    </div>
                  </div>
                  <button onClick={() => { setScanResult(null); setScanDomain(''); setScanInput(''); }}
                    className="text-[11px] font-medium text-slate-400 hover:text-[#C94C1E] flex items-center gap-1 transition-colors">
                    <Radar size={12} /> New scan
                  </button>
                </div>

                {/* Meta tags */}
                {scanResult.companyMeta && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      scanResult.companyMeta.category, scanResult.companyMeta.subCategory,
                      scanResult.companyMeta.region,
                      scanResult.companyMeta.offlineStores !== 'Online' && scanResult.companyMeta.offlineStores !== 'Unknown' ? `${formatStores(scanResult.companyMeta.offlineStores, scanResult.companyMeta.storeRawCount)} stores` : null,
                      scanResult.companyMeta.businessModel, scanResult.companyMeta.appPresence !== 'No App' ? scanResult.companyMeta.appPresence : null,
                      scanResult.companyMeta.monthlyVisitsFormatted ? `${scanResult.companyMeta.monthlyVisitsFormatted}/mo` : null,
                    ].filter(Boolean).map(v => (
                      <span key={v} className="text-[13px] font-semibold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-white/[0.06] px-3 py-1 rounded-lg border border-slate-200/60 dark:border-white/[0.08]">{v}</span>
                    ))}
                  </div>
                )}

                {/* Changes highlight */}
                {hasChanges && (
                  <div className="flex gap-3 mb-3">
                    {addedCount > 0 && (
                      <div className="flex-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/[0.06] border border-emerald-200/50 dark:border-emerald-500/10 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Plus size={13} className="text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Installed</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(scanResult.techChanges?.added || []).map(n => (
                            <span key={n} className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-md">{n}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {removedCount > 0 && (
                      <div className="flex-1 rounded-xl bg-red-50 dark:bg-red-500/[0.05] border border-red-200/50 dark:border-red-500/10 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <X size={13} className="text-red-500 dark:text-red-400" strokeWidth={2.5} />
                          <span className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider">Removed</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(scanResult.techChanges?.removed || []).map(n => (
                            <span key={n} className="text-[11px] font-semibold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-500/12 px-2 py-0.5 rounded-md line-through">{n}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Donut legend (top 8) */}
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {donutData.slice(0, 8).map(seg => (
                    <button key={seg.name} onClick={() => setActiveCat(activeCat === seg.name ? null : seg.name)}
                      className={`inline-flex items-center gap-1.5 text-[10px] transition-all ${activeCat === seg.name ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'}`}>
                      <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: seg.color, opacity: activeCat && activeCat !== seg.name ? 0.3 : 1 }} />
                      {seg.name} <span className="opacity-50">{seg.count}</span>
                    </button>
                  ))}
                  {donutData.length > 8 && <span className="text-[10px] text-slate-400 dark:text-neutral-500">+{donutData.length - 8} more</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── All Technologies grid ──────────────────────────── */}
          <div className="bg-white dark:bg-[#131316] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-700 dark:text-neutral-200">
                {activeCat || 'All Technologies'} <span className="font-normal text-slate-400 dark:text-neutral-500 ml-1">{allTechs.length}</span>
              </span>
              {activeCat && (
                <button onClick={() => setActiveCat(null)} className="text-[10px] font-medium text-slate-400 hover:text-[#C94C1E] dark:text-neutral-500 transition-colors">Clear filter</button>
              )}
            </div>

            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[1px] bg-slate-100 dark:bg-white/[0.04] rounded-b-xl overflow-hidden">
              {allTechs.map((tech, idx) => {
                const lv = TECH_LOGO_MAP[tech.name];
                const fb = !lv ? guessTechDomain(tech.name) : null;
                const src = lv ? (lv.startsWith('http') ? lv : `https://icon.horse/icon/${lv}`) : `https://icon.horse/icon/${fb}`;
                const isA = tech.changeTag === 'added', isR = tech.changeTag === 'removed';
                return (
                  <div key={`${tech.name}-${tech.category}-${idx}`}
                    className={`relative flex items-center gap-3 px-4 py-4 transition-colors ${
                      isA ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-[3px] border-l-emerald-500'
                      : isR ? 'bg-red-50 dark:bg-red-950/30 border-l-[3px] border-l-red-500'
                      : 'bg-white dark:bg-[#131316] border-l-[3px] border-l-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                    }`}>
                    <div className="w-[36px] h-[36px] min-w-[36px] rounded-full flex items-center justify-center flex-shrink-0 bg-slate-50 dark:bg-white/[0.05]">
                      <img src={src} alt="" className="w-[20px] h-[20px] object-contain rounded"
                        onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[13px] font-semibold truncate ${isR ? 'line-through text-slate-400 dark:text-neutral-600' : 'text-slate-800 dark:text-neutral-100'}`}>{tech.name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">{tech.category}</div>
                    </div>
                    {isA && <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-200/80 dark:bg-emerald-500/20 px-1.5 py-[2px] rounded leading-none uppercase flex-shrink-0">New</span>}
                    {isR && <span className="text-[8px] font-bold text-red-600 dark:text-red-400 bg-red-200/80 dark:bg-red-500/20 px-1.5 py-[2px] rounded leading-none uppercase flex-shrink-0">Removed</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}

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
                <img src={`https://www.google.com/s2/favicons?domain=${h.domain}&sz=64`} alt="" className="w-7 h-7 rounded-lg flex-shrink-0 dark:bg-white dark:p-[2px]"
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
