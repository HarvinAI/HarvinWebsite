import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

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
  const offlineStores = sp.get('offlineStores')?.split(',').filter(Boolean) || [];
  const search = sp.get('search')?.trim() || '';
  const sortBy = sp.get('sortBy') || 'updatedAt';
  const sortDir = sp.get('sortDir') === 'asc' ? 1 : -1;

  // Apply label mappings
  const categories = mapValues(rawCategories, CATEGORY_MAP);
  const regions = mapValues(rawRegions, REGION_MAP);

  try {
    const db = await getDb();
    const col = db.collection('company_meta');

    // Build query — only include docs that have category + region (complete entries)
    const query: Record<string, unknown> = {
      category: { $exists: true, $nin: [null, ''] },
      region: { $exists: true, $nin: [null, ''] },
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

    if (offlineStores.length > 0) {
      query.offlineStores = { $in: offlineStores };
    }

    if (search) {
      query.$or = [
        { normalizedDomain: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { subCategory: { $regex: search, $options: 'i' } },
      ];
    }

    // Sort mapping
    const sortMap: Record<string, string> = {
      domain: 'normalizedDomain',
      category: 'category',
      region: 'region',
      offlineStores: 'aiStoreCount',
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
          offlineStores: 1,
          aiStoreCount: 1,
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
        offlineStores: overrides.offlineStores || a.offlineStores,
        aiStoreCount: a.aiStoreCount,
        updatedAt: a.updatedAt,
      };
    });

    // Get distinct values for filter options
    const [allCategories, allRegions] = await Promise.all([
      col.distinct('category', { category: { $exists: true, $nin: [null, ''] } }),
      col.distinct('region', { region: { $exists: true, $nin: [null, ''] } }),
    ]);

    return NextResponse.json({
      accounts: processed,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      filterOptions: {
        categories: allCategories.filter(Boolean).sort(),
        regions: allRegions.filter(Boolean).sort(),
        offlineStores: ['Online', '1-10', '11-20', '21-50', '51-100', '100+'],
      },
    }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('[accounts API]', error.message);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500, headers: corsHeaders });
  }
}
