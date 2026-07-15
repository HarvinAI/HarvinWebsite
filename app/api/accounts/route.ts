import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { INDIA_STATES, INDIA_CITY_STATE, CITY_ALIASES, normalizeCity, formatDisplayLocation, lookupKnownBrand } = require('@/lib/scan/companyMeta');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TECH_CATEGORY_MAP } = require('@/lib/scan/detect');

/* Set of known city names (lowercase) for validation */
const KNOWN_CITIES = new Set<string>(Object.keys(INDIA_CITY_STATE as Record<string, string>));

/* Valid region values — countries and special values only */
const VALID_REGIONS = new Set([
  'India', 'US', 'UK', 'Australia', 'Germany', 'France', 'Canada', 'Japan',
  'South Korea', 'Brazil', 'Mexico', 'Italy', 'Spain', 'Netherlands', 'Sweden',
  'Singapore', 'UAE', 'Saudi Arabia', 'Indonesia', 'Thailand', 'Malaysia',
  'Vietnam', 'Philippines', 'New Zealand', 'South Africa', 'Nigeria', 'Kenya',
  'Egypt', 'Turkey', 'Poland', 'Switzerland', 'Belgium', 'Austria', 'Denmark',
  'Norway', 'Finland', 'Ireland', 'Portugal', 'Czech Republic', 'Romania',
  'Hungary', 'Israel', 'China', 'Taiwan', 'Hong Kong', 'Bangladesh', 'Pakistan',
  'Sri Lanka', 'Nepal', 'Global',
]);

/* Valid state values */
const VALID_STATES = new Set<string>(INDIA_STATES as string[]);

/**
 * Fix misclassified location fields:
 * - If region is actually a city name → move to city, set region to country
 * - If state is actually a city name → move to city, derive correct state
 */
function fixLocationFields(region: unknown, state: unknown, city: unknown): {
  region: string | null; state: string | null; city: string | null;
} {
  let r = (typeof region === 'string' && region) ? region : null;
  let s = (typeof state === 'string' && state) ? state : null;
  let c = (typeof city === 'string' && city) ? city : null;

  // Check if region is actually a city
  if (r && !VALID_REGIONS.has(r)) {
    const rLower = r.toLowerCase().trim();
    if (KNOWN_CITIES.has(rLower)) {
      // Region is a city — fix it
      if (!c) c = r; // preserve the city
      s = s || (INDIA_CITY_STATE as Record<string, string>)[rLower] || null;
      r = 'India'; // Most entries in INDIA_CITY_STATE are Indian cities
    }
  }

  // Check if state is actually a city
  if (s && !VALID_STATES.has(s)) {
    const sLower = s.toLowerCase().trim();
    if (KNOWN_CITIES.has(sLower)) {
      if (!c) c = s;
      s = (INDIA_CITY_STATE as Record<string, string>)[sLower] || null;
    }
  }

  return { region: r, state: s, city: c };
}

export const maxDuration = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/* ── Label → DB value mappings ─────────────────────────────────────────── */
const CATEGORY_MAP: Record<string, string> = {
  'Beauty & Skincare': 'Beauty & Personal Care',
  'Electronics & Gadgets': 'Electronics & Tech',
  'Jewelry & Accessories': 'Jewelry',
  'Fitness & Sports': 'Sports & Outdoor',
};

const REGION_MAP: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'UK',
};

/* Map UI offline-presence labels → DB offlineStores values */
const OFFLINE_PRESENCE_MAP: Record<string, string[]> = {
  'Online Only': ['Online'],
  '1-10 stores': ['1-10'],
  '11-20 stores': ['11-20'],
  '21-50 stores': ['21-50'],
  '51-100 stores': ['51-100'],
  '100+ stores': ['100+'],
};

/* Map UI scale labels → monthlyVisits numeric ranges */
const SCALE_BANDS = [
  { label: '<50K',      min: 0,        max: 50000 },
  { label: '50K-200K',  min: 50000,    max: 200000 },
  { label: '200K-500K', min: 200000,   max: 500000 },
  { label: '500K-1M',   min: 500000,   max: 1000000 },
  { label: '1M-5M',     min: 1000000,  max: 5000000 },
  { label: '5M-20M',    min: 5000000,  max: 20000000 },
  { label: '20M+',      min: 20000000, max: Infinity },
];
const SCALE_RANGE_MAP: Record<string, { min: number; max: number }> = Object.fromEntries(
  SCALE_BANDS.map(b => [b.label, { min: b.min, max: b.max }])
);

/** Map a monthlyVisits number to the matching scale band label */
function toScaleBand(mv: number | null | undefined): string | null {
  if (!mv || mv <= 0) return null;
  for (const b of SCALE_BANDS) {
    if (mv >= b.min && (b.max === Infinity || mv < b.max)) return b.label;
  }
  return null;
}

function mapValues(values: string[], mapping: Record<string, string>): string[] {
  return values.map(v => mapping[v] || v);
}

/* Deterministic business-model fallback derived from real store data
 * (previously a random domainHash pick, which was incorrect). */
function inferBusinessModel(offlineStores: string | null | undefined): string {
  const hasPhysicalStores = !!offlineStores && !['Online', 'Online Only', 'Unknown', ''].includes(offlineStores);
  return hasPhysicalStores ? 'Omnichannel' : 'Pure D2C';
}

/* Non-sales-relevant tech: front-end libraries, frameworks, hosting/CDN, error
 * monitoring, schema/markup, build tooling. Changes to these are detection
 * variance between page loads, not a meaningful stack migration, so we exclude
 * them from the "Tech Migration" signal. (Ecommerce platforms, analytics,
 * marketing/ads, CDP/engagement and CRM tools are all kept.) */
const TECH_MIGRATION_NOISE = [
  'material ui', 'material-ui', 'json-ld', 'schema', 'lazysizes', 'three.js', 'jquery',
  'modernizr', 'core-js', 'requirejs', 'webpack', 'vite', 'babel', 'bootstrap',
  'font awesome', 'google font', 'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt',
  'rollbar', 'sentry', 'new relic', 'datadog', 'bugsnag', 'raygun',
  'google cloud', 'amazon web services', 'aws', 'cloudflare', 'fastly', 'akamai',
  'nginx', 'apache', 'litespeed', 'openssl', 'hsts', 'http/', 'gzip', 'brotli',
  'php', 'node.js', 'polyfill', 'gsap', 'lodash', 'moment', 'axios',
];
function isNoiseTech(nameLower: string): boolean {
  return TECH_MIGRATION_NOISE.some(n => nameLower.includes(n));
}

/* ── Tech-derived buying signals ─────────────────────────────────────────
 * Interpreted, sales-relevant intelligence read straight from the detected
 * tech stack (presence-based, so high-confidence). Each is selective enough to
 * be meaningful: what a brand invests in tells you how to sell to them. */
type TechSignal = { label: string; detail: string; tone: 'ent' | 'ad' | 'sub' | 'sms' | 'cdp' | 'loyalty' };

const AD_CHANNELS: [RegExp, string][] = [
  [/facebook pixel|facebook ads|meta pixel|meta ads|pixelyoursite/i, 'Meta'],
  [/google ads|doubleclick|floodlight/i, 'Google'],
  [/tiktok/i, 'TikTok'],
  [/pinterest/i, 'Pinterest'],
  [/snapchat|snap pixel/i, 'Snapchat'],
  [/twitter pixel|reddit pixel/i, 'Social'],
  [/criteo/i, 'Criteo'],
  [/taboola/i, 'Taboola'],
  [/outbrain/i, 'Outbrain'],
  [/linkedin insight/i, 'LinkedIn'],
];

function deriveTechSignals(stack: unknown): TechSignal[] {
  const names = (Array.isArray(stack) ? stack : []).filter((s): s is string => typeof s === 'string');
  if (names.length === 0) return [];
  const has = (re: RegExp) => names.some(n => re.test(n));
  const out: TechSignal[] = [];

  // Enterprise-grade martech → big budget (rare, high-value account).
  if (has(/adobe experience|adobe target|adobe launch|salesforce (commerce|marketing|live agent)|sap commerce|oracle commerce|commercetools|magento|demandware/i)) {
    out.push({ label: 'Enterprise martech', detail: 'Adobe / Salesforce-class', tone: 'ent' });
  }
  // Active multi-channel paid acquisition → spending on growth right now.
  const channels: string[] = [];
  for (const [re, label] of AD_CHANNELS) if (has(re) && !channels.includes(label)) channels.push(label);
  if (channels.length >= 2) out.push({ label: 'Runs paid ads', detail: channels.slice(0, 4).join(', '), tone: 'ad' });
  // Subscription commerce → recurring revenue, higher LTV (rare).
  if (has(/recharge|ordergroove|\bskio\b|smartrr|bold subscriptions|appstle|seal subscriptions|stay ai|paywhirl/i)) {
    out.push({ label: 'Subscription revenue', detail: 'recurring D2C', tone: 'sub' });
  }
  // SMS marketing → invests beyond email (retention sophistication).
  if (has(/attentive|postscript|smsbump|yotpo sms|klaviyo sms/i)) {
    out.push({ label: 'SMS marketing', detail: '', tone: 'sms' });
  }
  // Customer Data Platform → data-mature, integration-hungry. (Bare "Segment"
  // is over-detected and near-ubiquitous, so we require an enterprise CDP whose
  // presence is both reliable and rare.)
  if (has(/mparticle|rudderstack|tealium|blueconic|\blytics\b/i)) {
    out.push({ label: 'Has a CDP', detail: '', tone: 'cdp' });
  }
  // Loyalty program → mature retention motion.
  if (has(/yotpo loyalty|okendo|loyaltylion|smile\.io|swell rewards|\bstamped\b/i)) {
    out.push({ label: 'Loyalty program', detail: '', tone: 'loyalty' });
  }
  return out;
}

/* Signal type → display label mapping */
const SIGNAL_LABEL_MAP: Record<string, string> = {
  funding: 'Recently Funded',
  key_hire: 'Hiring Surge',
  app_launch: 'New Product Launch',
  store_expansion: 'International Expansion',
  marketplace: 'Marketplace Expansion',
  traffic_growth: 'High Growth',
};

/* Funding round → stage mapping */
function mapFundingStage(round: string | null): string {
  if (!round) return 'Unknown';
  const r = round.toLowerCase();
  if (r.includes('seed') || r.includes('angel') || r.includes('pre-')) return 'Seed / Angel';
  if (r.includes('series a') || r.includes('series b') || r.includes('series c')) return 'Series A+';
  if (r.includes('series d') || r.includes('series e') || r.includes('series f') ||
      r.includes('ipo') || r.includes('late') || r.includes('pre-ipo')) return 'Late Stage';
  return 'Series A+';
}

/**
 * Batch-fetch real signals for a list of domains from the signals collection.
 * Returns maps for activeSignals and fundingStage per domain.
 */
async function fetchRealSignals(db: ReturnType<typeof Object>, domains: string[]): Promise<{
  signalMap: Record<string, string[]>;
  fundingMap: Record<string, string>;
}> {
  const signalMap: Record<string, string[]> = {};
  const fundingMap: Record<string, string> = {};

  if (domains.length === 0) return { signalMap, fundingMap };

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const signals = await db.collection('signals').find({
      domain: { $in: domains },
      detectedAt: { $gte: ninetyDaysAgo },
    }).project({
      domain: 1, signalType: 1, details: 1,
    }).toArray();

    for (const sig of signals) {
      const domain = sig.domain as string;
      const sigType = sig.signalType as string;
      const label = SIGNAL_LABEL_MAP[sigType] || sigType;

      if (!signalMap[domain]) signalMap[domain] = [];
      if (!signalMap[domain].includes(label)) {
        signalMap[domain].push(label);
      }

      // Extract funding stage from the first funding signal
      if (sigType === 'funding' && !fundingMap[domain]) {
        const details = sig.details as Record<string, unknown> | null;
        fundingMap[domain] = mapFundingStage((details?.round as string) || null);
      }
    }
  } catch (err) {
    console.warn('[accounts] failed to fetch real signals:', (err as Error).message);
  }

  return { signalMap, fundingMap };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // Pagination
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  // Cap at 100 for normal browsing; allow larger batches for bulk export only.
  const limitCap = sp.get('skipFilterOptions') === '1' ? 1000 : 100;
  const limit = Math.min(limitCap, Math.max(1, parseInt(sp.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // Filters (comma-separated)
  const rawCategories = sp.get('categories')?.split(',').filter(Boolean) || [];
  const rawRegions = sp.get('regions')?.split(',').filter(Boolean) || [];
  const states = sp.get('states')?.split(',').filter(Boolean) || [];
  const cities = sp.get('cities')?.split(',').filter(Boolean) || [];
  const offlinePresence = sp.get('offlinePresence')?.split(',').filter(Boolean) || [];
  const businessModel = sp.get('businessModel')?.split(',').filter(Boolean) || [];
  const scale = sp.get('scale')?.split(',').filter(Boolean) || [];
  const appPresence = sp.get('appPresence')?.split(',').filter(Boolean) || [];
  const techStack = sp.get('techStack')?.split(',').filter(Boolean) || [];
  const activeSignals = sp.get('activeSignals')?.split(',').filter(Boolean) || [];
  const funding = sp.get('funding')?.split(',').filter(Boolean) || [];
  const search = sp.get('search')?.trim() || '';
  const sortBy = sp.get('sortBy') || 'updatedAt';
  const sortDir = sp.get('sortDir') === 'asc' ? 1 : -1;
  // "Select all": return only the full list of matching domains (no enrichment/pagination)
  const domainsOnly = sp.get('domainsOnly') === '1';
  // Export fast-paths: the filter-option dropdowns require 3 full-collection distinct()
  // scans, and the count is only needed once. Bulk export skips both so each page is cheap.
  const skipFilterOptions = sp.get('skipFilterOptions') === '1';
  const skipCount = sp.get('skipCount') === '1';

  // Apply label mappings
  const categories = mapValues(rawCategories, CATEGORY_MAP);
  const regions = mapValues(rawRegions, REGION_MAP);

  // Expand offline-presence UI labels to DB offlineStores values
  const offlineStores = offlinePresence.flatMap(v => OFFLINE_PRESENCE_MAP[v] || [v]);

  // Expand scale UI labels to monthlyVisits numeric ranges
  const scaleRanges = scale.map(v => SCALE_RANGE_MAP[v]).filter(Boolean);

  try {
    const db = await getDb();
    const col = db.collection('company_meta');

    // Build query — only admin-APPROVED accounts are visible in Account Explorer.
    // Nothing shows until an admin explicitly approves it in Manage Accounts.
    const query: Record<string, unknown> = {
      adminApproved: true,
      category: { $exists: true, $nin: [null, '', 'Not Required', 'Unknown'] },
      region: { $exists: true, $nin: [null, ''] },
      normalizedDomain: { $nin: ['harvin.ai'] },
      adminHidden: { $ne: true },
    };

    if (categories.length > 0) {
      if (!categories.includes('All Categories')) {
        query.category = { $in: categories };
      }
    }

    if (regions.length > 0) {
      if (!regions.includes('Global')) {
        query.region = { $in: regions };
      }
    }

    if (states.length > 0) {
      // Expand state names to include common DB variants (case variants, abbreviations)
      const expandedStates = new Set<string>();
      for (const s of states) {
        expandedStates.add(s);
        expandedStates.add(s.toUpperCase());
        expandedStates.add(s.toLowerCase());
      }
      query.state = { $in: [...expandedStates] };
    }

    if (cities.length > 0) {
      // Expand canonical city names to all DB variants (e.g. "Bangalore" → ["Bangalore","BANGALORE","bangalore","Bengaluru","bengaluru"])
      const cityAliases = CITY_ALIASES as Record<string, string>;
      const expandedCities = new Set<string>();
      for (const canonical of cities) {
        expandedCities.add(canonical);
        // Add all alias keys that map to this canonical name
        for (const [alias, canon] of Object.entries(cityAliases)) {
          if (canon === canonical) {
            // Add common casing variants of the alias
            expandedCities.add(alias);
            expandedCities.add(alias.charAt(0).toUpperCase() + alias.slice(1));
            expandedCities.add(alias.toUpperCase());
          }
        }
      }
      query.city = { $in: [...expandedCities] };
    }

    if (offlineStores.length > 0) {
      query.offlineStores = { $in: offlineStores };
    }

    // For fields that can be null (inferred via deterministic hash on dashboard),
    // include null/missing docs so we can post-filter after applying the same inference.
    if (businessModel.length > 0) {
      query.$and = query.$and || [];
      (query.$and as unknown[]).push({
        $or: [
          { businessModel: { $in: businessModel } },
          { businessModel: { $in: [null, ''] } },
          { businessModel: { $exists: false } },
        ],
      });
    }

    if (scaleRanges.length > 0) {
      const rangeConditions = scaleRanges.map((r: { min: number; max: number }) => {
        const cond: Record<string, unknown> = { monthlyVisits: { $gte: r.min } };
        if (r.max !== Infinity) (cond.monthlyVisits as Record<string, unknown>).$lt = r.max;
        return cond;
      });
      query.$and = query.$and || [];
      (query.$and as unknown[]).push({
        $or: [
          ...rangeConditions,
          // Include docs without monthlyVisits so we can post-filter by inferred trafficBand
          { monthlyVisits: { $in: [null, 0] } },
          { monthlyVisits: { $exists: false } },
        ],
      });
    }

    if (appPresence.length > 0) {
      query.$and = query.$and || [];
      (query.$and as unknown[]).push({
        $or: [
          { appPresence: { $in: appPresence } },
          { appPresence: { $in: [null, ''] } },
          { appPresence: { $exists: false } },
        ],
      });
    }

    if (techStack.length > 0) {
      // "None detected" means no tech stack data
      const hasTech = techStack.filter(t => t !== 'None detected');
      const hasNone = techStack.includes('None detected');
      const techConditions: Record<string, unknown>[] = [];
      if (hasTech.length > 0) techConditions.push({ techStack: { $in: hasTech } });
      if (hasNone) techConditions.push({ techStack: { $exists: false } }, { techStack: { $size: 0 } });
      if (techConditions.length > 0) {
        query.$and = query.$and || [];
        (query.$and as unknown[]).push({ $or: techConditions });
      }
    }

    if (activeSignals.length > 0) {
      query.$and = query.$and || [];
      (query.$and as unknown[]).push({
        $or: [
          { activeSignals: { $in: activeSignals } },
          { activeSignals: { $in: [null, []] } },
          { activeSignals: { $exists: false } },
          { activeSignals: { $size: 0 } },
        ],
      });
    }

    if (funding.length > 0) {
      query.$and = query.$and || [];
      (query.$and as unknown[]).push({
        $or: [
          { fundingStage: { $in: funding } },
          { fundingStage: { $in: [null, ''] } },
          { fundingStage: { $exists: false } },
        ],
      });
    }

    if (search) {
      query.$and = query.$and || [];
      (query.$and as unknown[]).push({
        $or: [
          { normalizedDomain: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { subCategory: { $regex: search, $options: 'i' } },
        ],
      });
    }

    // Sort mapping — all server-side via MongoDB indexes
    const sortMap: Record<string, string> = {
      domain: 'normalizedDomain',
      category: 'category',
      region: 'region',
      offlineStores: 'aiStoreCount',
      techCount: 'techCount',
      updatedAt: 'updatedAt',
      monthlyVisits: 'monthlyVisits',
      harvinScore: 'harvinScore',
    };
    const sortField = sortMap[sortBy] || 'updatedAt';

    // When sorting by stores, exclude online-only brands (they have no physical stores)
    const sortByStores = sortBy === 'offlineStores';
    if (sortByStores && !query.offlineStores) {
      query.offlineStores = { $exists: true, $nin: ['Online', 'Online Only', '', null] };
    }

    // When inferred-field filters are active, we need to fetch all matching docs
    // (since we can't filter by inferred values in MongoDB) and paginate in JS.
    // Also force JS-side sort for stores (offlineStores is a string band, not numeric)
    const hasInferredFilters = sortByStores || businessModel.length > 0 || scaleRanges.length > 0 ||
      appPresence.length > 0 || activeSignals.length > 0 || funding.length > 0;

    // Fast path for "Select all": when no inferred filters are active, the DB query
    // is exact, so we can return every matching domain directly without enrichment.
    if (domainsOnly && !hasInferredFilters) {
      const docs = await col.find(query).project({ normalizedDomain: 1, _id: 0 }).toArray();
      const seen = new Set<string>();
      const domains: string[] = [];
      for (const d of docs as { normalizedDomain?: string }[]) {
        const nd = d.normalizedDomain;
        if (nd && !seen.has(nd)) { seen.add(nd); domains.push(nd); }
      }
      return NextResponse.json({ domains, total: domains.length }, { headers: corsHeaders });
    }

    const dbLimit = hasInferredFilters ? 0 : limit; // 0 = no limit (fetch all)
    const dbSkip = hasInferredFilters ? 0 : skip;

    let findCursor = col.find(query)
      .sort({ [sortField]: sortDir })
      .project({
          _id: 0,
          normalizedDomain: 1,
          category: 1,
          subCategory: 1,
          region: 1,
          state: 1,
          city: 1,
          offlineStores: 1,
          storeRawCount: 1,
          aiStoreCount: 1,
          storeConfidence: 1,
          techCount: 1,
          techStack: 1,
          businessModel: 1,
          trafficBand: 1,
          monthlyVisits: 1,
          monthlyVisitsFormatted: 1,
          trafficSource: 1,
          appPresence: 1,
          activeSignals: 1,
          fundingStage: 1,
          updatedAt: 1,
          overrides: 1,
          brandName: 1,
          categoryConfidence: 1,
          harvinScore: 1,
          harvinScoreBreakdown: 1,
          harvinScoreReasons: 1,
          harvinMaturity: 1,
        });

    if (dbSkip > 0) findCursor = findCursor.skip(dbSkip);
    if (dbLimit > 0) findCursor = findCursor.limit(dbLimit);

    const [rawAccounts, dbTotal] = await Promise.all([
      findCursor.toArray(),
      skipCount ? Promise.resolve(0) : col.countDocuments(query),
    ]);

    // Deduplicate by normalizedDomain (keep first/most recent occurrence)
    const seenDomains = new Set<string>();
    const accounts = rawAccounts.filter((a: Record<string, unknown>) => {
      const d = a.normalizedDomain as string;
      if (seenDomains.has(d)) return false;
      seenDomains.add(d);
      return true;
    });

    // Fetch real signals + tech cache for all domains in this batch
    const allDomains = accounts.map((a: Record<string, unknown>) => a.normalizedDomain as string);
    const { signalMap: realSignalMap, fundingMap: realFundingMap } = await fetchRealSignals(db, allDomains);

    // Fetch real tech from tech_cache for domains that lack techStack in company_meta,
    // plus the real tech-migration diff (added/removed tech between the last two scans).
    const techCacheMap: Record<string, { names: string[]; count: number }> = {};
    const techMigrationMap: Record<string, { added: string[]; removed: string[] }> = {};
    const techSignalsMap: Record<string, TechSignal[]> = {};
    try {
      const techDocs = await db.collection('tech_cache').find(
        { domain: { $in: allDomains } }
      ).project({ domain: 1, technologies: 1, count: 1, techChanges: 1, _id: 0 }).toArray();
      for (const td of techDocs) {
        const techs = (td.technologies || []) as { name: string }[];
        const domain = td.domain as string;
        const allTechNames = techs.map((t: { name: string }) => t.name);
        techCacheMap[domain] = {
          names: allTechNames.slice(0, 10),
          count: (td.count as number) || techs.length,
        };
        // Derive buying signals from the FULL detected stack (best coverage).
        const sigs = deriveTechSignals(allTechNames);
        if (sigs.length) techSignalsMap[domain] = sigs;
        const tc = td.techChanges as { added?: string[]; removed?: string[] } | null;
        // Dedupe, drop fragments, ignore non-sales-relevant infra/UI churn, and
        // remove anything that appears on both sides.
        const clean = (arr: unknown): string[] => {
          const seen = new Set<string>();
          const out: string[] = [];
          for (const v of Array.isArray(arr) ? arr : []) {
            const s = typeof v === 'string' ? v.trim() : '';
            const key = s.toLowerCase();
            if (s.length < 3 || key === 'manager' || seen.has(key) || isNoiseTech(key)) continue;
            seen.add(key); out.push(s);
          }
          return out;
        };
        let added = clean(tc?.added);
        const removed = clean(tc?.removed);
        const removedSet = new Set(removed.map(r => r.toLowerCase()));
        added = added.filter(a => !removedSet.has(a.toLowerCase()));
        // Only a genuine migration (a sales-relevant tool was actually dropped) is
        // worth flagging — pure additions/infra churn are just detection variance.
        if (removed.length > 0) techMigrationMap[domain] = { added: added.slice(0, 4), removed: removed.slice(0, 4) };
      }
    } catch {}

    // Apply overrides + infer missing fields + fix misclassified locations
    const processed = accounts.map((a: Record<string, unknown>) => {
      const overrides = (a.overrides || {}) as Record<string, unknown>;
      const domain = a.normalizedDomain as string;
      const knownBrand = lookupKnownBrand(domain);
      const dbSignals = a.activeSignals as string[] | null;
      const loc = fixLocationFields(
        (knownBrand?.region || overrides.region || a.region) as string | null,
        (a.state as string | null) || null,
        (a.city as string | null) || null,
      );
      // Fix store count: KNOWN_BRANDS is authoritative; only use aiStoreCount if no KNOWN_BRANDS entry
      const storeConf = a.storeConfidence as Record<string, unknown> | null;
      const rawCount = (a.storeRawCount as number) || 0;
      const aiCount = (a.aiStoreCount as number) || 0;
      let offlineStores: string;
      if (knownBrand?.stores) {
        // KNOWN_BRANDS has the correct store count — trust it
        offlineStores = knownBrand.stores as string;
      } else if (knownBrand?.onlineOnly) {
        offlineStores = 'Online';
      } else if (overrides.offlineStores) {
        offlineStores = overrides.offlineStores as string;
      } else {
        offlineStores = (a.offlineStores as string) || 'Online';
        // If DB store count came from known_brand source but brand is no longer in KNOWN_BRANDS,
        // use the AI-detected count instead
        if (storeConf?.source === 'known_brand' || storeConf?.source === 'known_brand_fallback') {
          const actualCount = aiCount || rawCount;
          if (actualCount > 0) {
            if (actualCount <= 10) offlineStores = '1-10';
            else if (actualCount <= 20) offlineStores = '11-20';
            else if (actualCount <= 50) offlineStores = '21-50';
            else if (actualCount <= 100) offlineStores = '51-100';
            else offlineStores = '100+';
          }
        }
      }

      // Show traffic data from all sources (tranco, crux, tranco+crux)
      // Skip only if monthlyVisits is 0/null (no data at all)
      const hasTrafficData = (a.monthlyVisits as number) > 0;

      // Normalize city and compute smart display location
      const normCity = normalizeCity(loc.city) as string | null;
      const { displayLocation, locationLevel } = formatDisplayLocation({
        region: loc.region, state: loc.state, city: normCity, offlineStores,
      }) as { displayLocation: string; locationLevel: string };

      const techCountFinal = (a.techCount as number) || (a.techStack as string[] || []).length || techCacheMap[domain]?.count || 0;
      const app = (knownBrand?.appPresence as string) || (a.appPresence as string) || 'No App';
      const bm = (a.businessModel as string) || inferBusinessModel(offlineStores);

      // Use DB-stored harvinScore for consistency across all pages
      const harvinScore = (a as Record<string, unknown>).harvinScore as number || 0;

      // Real signals only: start from the signals/news collection, then add a
      // genuine "Tech Migration" signal when the tech stack actually changed
      // between scans (e.g. dropped CleverTap, added WooCommerce).
      const techMigration = techMigrationMap[domain] || null;
      const realSignals = [...(realSignalMap[domain] || ((dbSignals && dbSignals.length > 0) ? dbSignals : []))];
      if (techMigration && !realSignals.includes('Tech Migration')) realSignals.push('Tech Migration');
      // Tech-derived buying signals (from tech_cache full stack; fall back to
      // the company_meta techStack summary so it shows even without a cache doc).
      const techSignals = techSignalsMap[domain] || deriveTechSignals(a.techStack);

      return {
        normalizedDomain: domain,
        category: knownBrand?.category || overrides.category || a.category,
        subCategory: knownBrand?.subCategory || overrides.subCategory || a.subCategory,
        region: loc.region,
        state: loc.state,
        city: normCity,
        displayLocation,
        locationLevel,
        offlineStores,
        storeRawCount: rawCount || aiCount || 0,
        aiStoreCount: a.aiStoreCount,
        techCount: techCountFinal,
        techStack: (a.techStack as string[] || []).length > 0 ? a.techStack : (techCacheMap[domain]?.names || []),
        businessModel: bm,
        monthlyVisits: hasTrafficData ? (a.monthlyVisits as number) : null,
        monthlyVisitsFormatted: hasTrafficData ? (a.monthlyVisitsFormatted as string) : null,
        scaleBand: hasTrafficData ? toScaleBand(a.monthlyVisits as number) : null,
        appPresence: app,
        activeSignals: realSignals,
        techMigration,
        techSignals,
        fundingStage: realFundingMap[domain] || (a.fundingStage as string) || null,
        brandName: (typeof a.brandName === 'string' ? a.brandName : (a.brandName && typeof a.brandName === 'object' && 'name' in (a.brandName as Record<string, unknown>) ? String((a.brandName as Record<string, unknown>).name) : null)),
        updatedAt: a.updatedAt,
        harvinScore,
      };
    });

    // Post-filter: since we included null entries in the DB query, filter them by inferred values
    const allFiltered = hasInferredFilters
      ? processed.filter((a: Record<string, unknown>) => {
          if (businessModel.length > 0 && !businessModel.includes(a.businessModel as string)) return false;
          if (scaleRanges.length > 0) {
            const mv = (a.monthlyVisits as number) || 0;
            if (!scaleRanges.some((r: { min: number; max: number }) => mv >= r.min && (r.max === Infinity || mv < r.max))) return false;
          }
          if (appPresence.length > 0 && !appPresence.includes(a.appPresence as string)) return false;
          if (funding.length > 0 && !funding.includes(a.fundingStage as string)) return false;
          if (activeSignals.length > 0) {
            const sigs = a.activeSignals as string[];
            if (!sigs.some(s => activeSignals.includes(s))) return false;
          }
          return true;
        })
      : processed;

    // When sorting by stores, remove online-only brands and sort by numeric store value
    if (sortByStores) {
      const STORE_ORDER: Record<string, number> = {
        '100+': 6, '51-100': 5, '21-50': 4, '11-20': 3, '1-10': 2, '1': 1,
      };
      // Remove brands with no physical stores after processing
      const onlineValues = new Set(['Online', 'Online Only', '', null, undefined]);
      for (let i = allFiltered.length - 1; i >= 0; i--) {
        const stores = allFiltered[i].offlineStores as string;
        if (!stores || onlineValues.has(stores) || !STORE_ORDER[stores]) {
          allFiltered.splice(i, 1);
        }
      }
      allFiltered.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aVal = STORE_ORDER[a.offlineStores as string] || 0;
        const bVal = STORE_ORDER[b.offlineStores as string] || 0;
        return sortDir === -1 ? bVal - aVal : aVal - bVal;
      });
    }

    // "Select all" with inferred filters: the full matching set is already computed
    // (and post-filtered) in allFiltered — return just the domains.
    if (domainsOnly) {
      return NextResponse.json({
        domains: allFiltered.map((a: Record<string, unknown>) => a.normalizedDomain as string),
        total: allFiltered.length,
      }, { headers: corsHeaders });
    }

    // When post-filtering, apply pagination in JS
    const finalTotal = hasInferredFilters ? allFiltered.length : dbTotal;
    const filtered = hasInferredFilters ? allFiltered.slice(skip, skip + limit) : allFiltered;

    // Bulk export: skip the expensive filter-option distinct() scans entirely.
    if (skipFilterOptions) {
      return NextResponse.json({
        accounts: filtered,
        total: finalTotal,
        page,
        totalPages: skipCount ? page : Math.ceil(finalTotal / limit),
      }, { headers: corsHeaders });
    }

    // Get distinct values for filter options
    const [allCategories, allRegions, allTechNames] = await Promise.all([
      col.distinct('category', { category: { $exists: true, $nin: [null, '', 'Not Required', 'Unknown'] } }),
      col.distinct('region', { region: { $exists: true, $nin: [null, ''] } }),
      col.distinct('techStack', { techStack: { $exists: true, $not: { $size: 0 } } }),
    ]);

    // Group tech names by their category from detect.js
    const techByCategory: Record<string, string[]> = {};
    for (const name of allTechNames as string[]) {
      const cat = (TECH_CATEGORY_MAP as Record<string, string>)[name] || 'Other';
      if (!techByCategory[cat]) techByCategory[cat] = [];
      techByCategory[cat].push(name);
    }
    // Sort techs within each category
    for (const cat of Object.keys(techByCategory)) {
      techByCategory[cat].sort();
    }

    // Regions: only valid countries
    const cleanRegions = allRegions.filter((r: unknown) => typeof r === 'string' && r && VALID_REGIONS.has(r));

    // Build reverse map: state → cities
    const cityStateMap = INDIA_CITY_STATE as Record<string, string>;
    const stateToCities: Record<string, Set<string>> = {};
    const cityAliasMap = CITY_ALIASES as Record<string, string>;
    for (const [cityLower, state] of Object.entries(cityStateMap)) {
      if (!stateToCities[state]) stateToCities[state] = new Set();
      // Use canonical city name from aliases, or capitalize the key
      const canonical = cityAliasMap[cityLower] || cityLower.charAt(0).toUpperCase() + cityLower.slice(1);
      stateToCities[state].add(canonical);
    }

    // States: if a region is selected, only show states for that region
    // Currently only India has states — other regions show no states
    const selectedRegions = regions;
    let cleanStates: string[];
    if (selectedRegions.length > 0) {
      if (selectedRegions.includes('India')) {
        cleanStates = [...(INDIA_STATES as string[])];
      } else {
        cleanStates = []; // No states for non-India regions
      }
    } else {
      cleanStates = [...(INDIA_STATES as string[])];
    }

    // Cities: if states are selected, only show cities in those states
    const selectedStates = states;
    let cleanCities: string[];
    if (selectedStates.length > 0) {
      const citySet = new Set<string>();
      for (const st of selectedStates) {
        const cities = stateToCities[st];
        if (cities) cities.forEach(c => citySet.add(c));
      }
      cleanCities = [...citySet].sort();
    } else if (selectedRegions.length > 0 && !selectedRegions.includes('India')) {
      cleanCities = []; // Non-India regions: no cities
    } else {
      // No state filter: show all canonical cities
      const allCities = new Set<string>();
      for (const cities of Object.values(stateToCities)) {
        cities.forEach(c => allCities.add(c));
      }
      cleanCities = [...allCities].sort();
    }

    return NextResponse.json({
      accounts: filtered,
      total: finalTotal,
      page,
      totalPages: Math.ceil(finalTotal / limit),
      filterOptions: {
        categories: allCategories.filter(Boolean).sort(),
        regions: cleanRegions.sort(),
        states: cleanStates.sort(),
        cities: cleanCities.sort(),
        offlineStores: ['Online', '1-10', '11-20', '21-50', '51-100', '100+'],
        techStackOptions: techByCategory,
      },
    }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[accounts API] error:', error?.message, error?.stack);
    return NextResponse.json({ error: error?.message || 'Failed to fetch accounts' }, { status: 500, headers: corsHeaders });
  }
}
