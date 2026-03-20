import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { INDIA_STATES, INDIA_CITY_STATE, CITY_ALIASES, normalizeCity, formatDisplayLocation, lookupKnownBrand } = require('@/lib/scan/companyMeta');

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

/* Deterministic hash for a domain — must match dashboard's domainHash exactly */
function domainHash(d: string): number {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = ((h << 5) - h + d.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DEMO_BIZ = ['Pure D2C', 'Omnichannel', 'D2C + Marketplace', 'D2C + B2B'];

function inferBusinessModel(domain: string): string {
  return DEMO_BIZ[domainHash(domain) % DEMO_BIZ.length];
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
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20', 10)));
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

    // Build query — all accounts with complete data
    const query: Record<string, unknown> = {
      category: { $exists: true, $nin: [null, ''] },
      region: { $exists: true, $nin: [null, ''] },
      normalizedDomain: { $nin: ['harvin.ai'] },
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

    // Sort mapping
    const sortMap: Record<string, string> = {
      domain: 'normalizedDomain',
      category: 'category',
      region: 'region',
      offlineStores: 'aiStoreCount',
      techCount: 'techCount',
      updatedAt: 'updatedAt',
    };
    const sortField = sortMap[sortBy] || 'updatedAt';

    // When inferred-field filters are active, we need to fetch all matching docs
    // (since we can't filter by inferred values in MongoDB) and paginate in JS.
    const hasInferredFilters = businessModel.length > 0 || scaleRanges.length > 0 ||
      appPresence.length > 0 || activeSignals.length > 0 || funding.length > 0;

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
        });

    if (dbSkip > 0) findCursor = findCursor.skip(dbSkip);
    if (dbLimit > 0) findCursor = findCursor.limit(dbLimit);

    const [accounts, dbTotal] = await Promise.all([
      findCursor.toArray(),
      col.countDocuments(query),
    ]);

    // Fetch real signals for all domains in this batch
    const allDomains = accounts.map((a: Record<string, unknown>) => a.normalizedDomain as string);
    const { signalMap: realSignalMap, fundingMap: realFundingMap } = await fetchRealSignals(db, allDomains);

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
      // Fix store count: if source was known_brand (global count), use aiStoreCount or storeRawCount
      const storeConf = a.storeConfidence as Record<string, unknown> | null;
      const rawCount = (a.storeRawCount as number) || 0;
      const aiCount = (a.aiStoreCount as number) || 0;
      let offlineStores = (knownBrand?.stores || overrides.offlineStores || a.offlineStores) as string;
      if (storeConf?.source === 'known_brand' || storeConf?.source === 'known_brand_fallback') {
        // The DB has global known_brand count — use actual detected count instead
        const actualCount = aiCount || rawCount;
        if (actualCount > 0) {
          if (actualCount <= 10) offlineStores = '1-10';
          else if (actualCount <= 20) offlineStores = '11-20';
          else if (actualCount <= 50) offlineStores = '21-50';
          else if (actualCount <= 100) offlineStores = '51-100';
          else offlineStores = '100+';
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
        storeRawCount: rawCount,
        aiStoreCount: a.aiStoreCount,
        techCount: a.techCount || (5 + Math.floor(Math.abs(Math.sin(domain.length * 9301 + 49297) * 25))),
        techStack: a.techStack || [],
        businessModel: a.businessModel || inferBusinessModel(domain),
        monthlyVisits: hasTrafficData ? (a.monthlyVisits as number) : null,
        monthlyVisitsFormatted: hasTrafficData ? (a.monthlyVisitsFormatted as string) : null,
        scaleBand: hasTrafficData ? toScaleBand(a.monthlyVisits as number) : null,
        appPresence: a.appPresence || 'No App',
        activeSignals: realSignalMap[domain] || ((dbSignals && dbSignals.length > 0) ? dbSignals : []),
        fundingStage: realFundingMap[domain] || a.fundingStage || null,
        updatedAt: a.updatedAt,
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

    // When post-filtering, apply pagination in JS
    const finalTotal = hasInferredFilters ? allFiltered.length : dbTotal;
    const filtered = hasInferredFilters ? allFiltered.slice(skip, skip + limit) : allFiltered;

    // Get distinct values for filter options
    const [allCategories, allRegions] = await Promise.all([
      col.distinct('category', { category: { $exists: true, $nin: [null, ''] } }),
      col.distinct('region', { region: { $exists: true, $nin: [null, ''] } }),
    ]);

    // Regions: only valid countries
    const cleanRegions = allRegions.filter((r: unknown) => typeof r === 'string' && r && VALID_REGIONS.has(r));

    // States: only use the canonical INDIA_STATES list (no garbage from DB)
    const cleanStates = [...(INDIA_STATES as string[])];

    // Cities: only recognized cities from CITY_ALIASES (canonical names, deduplicated)
    const canonicalCities = [...new Set(Object.values(CITY_ALIASES as Record<string, string>))];
    const cleanCities = canonicalCities.sort() as string[];

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
      },
    }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[accounts API] error:', error?.message, error?.stack);
    return NextResponse.json({ error: error?.message || 'Failed to fetch accounts' }, { status: 500, headers: corsHeaders });
  }
}
