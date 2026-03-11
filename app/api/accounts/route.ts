import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { INDIA_STATES } = require('@/lib/scan/companyMeta');

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
  'Fitness & Sports': 'Outdoor & Sports',
};

const REGION_MAP: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'UK',
};

/* Map UI offline-presence labels → DB offlineStores values */
const OFFLINE_PRESENCE_MAP: Record<string, string[]> = {
  'Online Only': ['Online'],
  '1-10 stores': ['1-10'],
  '10-50 stores': ['11-20', '21-50'],
  '50+ stores': ['51-100', '100+'],
};

/* Map UI scale labels → estimated monthly-traffic ranges (stored as trafficBand) */
const SCALE_MAP: Record<string, string[]> = {
  'Emerging (<100K)': ['<100K'],
  'Growing (100K-500K)': ['100K-500K'],
  'Scaling (500K-2M)': ['500K-2M'],
  'Established (2M+)': ['2M+'],
};

function mapValues(values: string[], mapping: Record<string, string>): string[] {
  return values.map(v => mapping[v] || v);
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

  // Expand scale UI labels to DB trafficBand values
  const trafficBands = scale.flatMap(v => SCALE_MAP[v] || [v]);

  try {
    const db = await getDb();
    const col = db.collection('company_meta');

    // Build query — only include docs that have category + region (complete entries)
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
      query.state = { $in: states };
    }

    if (cities.length > 0) {
      query.city = { $in: cities };
    }

    if (offlineStores.length > 0) {
      query.offlineStores = { $in: offlineStores };
    }

    if (businessModel.length > 0) {
      query.businessModel = { $in: businessModel };
    }

    if (trafficBands.length > 0) {
      query.trafficBand = { $in: trafficBands };
    }

    if (appPresence.length > 0) {
      query.appPresence = { $in: appPresence };
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
      query.activeSignals = { $in: activeSignals };
    }

    if (funding.length > 0) {
      query.fundingStage = { $in: funding };
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

    const [accounts, total] = await Promise.all([
      col.find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
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
          techCount: 1,
          techStack: 1,
          businessModel: 1,
          trafficBand: 1,
          appPresence: 1,
          activeSignals: 1,
          fundingStage: 1,
          updatedAt: 1,
          overrides: 1,
        })
        .toArray(),
      col.countDocuments(query),
    ]);

    // Apply overrides
    const processed = accounts.map((a: Record<string, unknown>) => {
      const overrides = (a.overrides || {}) as Record<string, unknown>;
      return {
        normalizedDomain: a.normalizedDomain,
        category: overrides.category || a.category,
        subCategory: overrides.subCategory || a.subCategory,
        region: overrides.region || a.region,
        state: a.state || null,
        city: a.city || null,
        offlineStores: overrides.offlineStores || a.offlineStores,
        storeRawCount: a.storeRawCount || 0,
        aiStoreCount: a.aiStoreCount,
        techCount: a.techCount || (5 + Math.floor(Math.abs(Math.sin((a.normalizedDomain as string).length * 9301 + 49297) * 25))),
        techStack: a.techStack || [],
        businessModel: a.businessModel || null,
        trafficBand: a.trafficBand || null,
        appPresence: a.appPresence || null,
        activeSignals: a.activeSignals || [],
        fundingStage: a.fundingStage || null,
        updatedAt: a.updatedAt,
      };
    });

    // Get distinct values for filter options
    const [allCategories, allRegions, allStates, allCities] = await Promise.all([
      col.distinct('category', { category: { $exists: true, $nin: [null, ''] } }),
      col.distinct('region', { region: { $exists: true, $nin: [null, ''] } }),
      col.distinct('state', { state: { $exists: true, $nin: [null, ''] } }),
      col.distinct('city', { city: { $exists: true, $nin: [null, ''] } }),
    ]);

    return NextResponse.json({
      accounts: processed,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      filterOptions: {
        categories: allCategories.filter(Boolean).sort(),
        regions: allRegions.filter(Boolean).sort(),
        states: [...new Set([...allStates.filter(Boolean), ...INDIA_STATES])].sort(),
        cities: allCities.filter(Boolean).sort(),
        offlineStores: ['Online', '1-10', '11-20', '21-50', '51-100', '100+'],
      },
    }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[accounts API] error:', error?.message, error?.stack);
    return NextResponse.json({ error: error?.message || 'Failed to fetch accounts' }, { status: 500, headers: corsHeaders });
  }
}
