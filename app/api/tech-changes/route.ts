import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/scan/db';
import { TECH_CATEGORY_MAP } from '@/lib/scan/detect';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const sp = req.nextUrl.searchParams;

    const changeType = sp.get('type') || 'all'; // 'installed' | 'uninstalled' | 'all'
    const category = sp.get('category') || '';
    const search = sp.get('search') || '';
    const domainFilter = sp.get('domain') || ''; // exact domain match
    const period = sp.get('period') || '30d';
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    // Calculate date range
    const periodDays: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '60d': 60, '90d': 90 };
    const days = periodDays[period] || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Build query
    const query: Record<string, unknown> = { detectedAt: { $gte: since } };
    if (changeType !== 'all') query.changeType = changeType;
    if (category) query.category = category;
    if (domainFilter) query.domain = domainFilter;
    if (search) {
      query.$or = [
        { domain: { $regex: search, $options: 'i' } },
        { techName: { $regex: search, $options: 'i' } },
      ];
    }

    // Fetch changes + count in parallel
    const [changes, total, categoryStats, typeStats] = await Promise.all([
      db.collection('tech_changes')
        .find(query)
        .sort({ detectedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('tech_changes').countDocuments(query),
      // Category breakdown
      db.collection('tech_changes').aggregate([
        { $match: { detectedAt: { $gte: since } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]).toArray(),
      // Type breakdown
      db.collection('tech_changes').aggregate([
        { $match: { detectedAt: { $gte: since } } },
        { $group: { _id: '$changeType', count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    // Enrich with brand info from company_meta
    const domains = [...new Set(changes.map((c: { domain: string }) => c.domain))];
    const metaDocs = await db.collection('company_meta')
      .find({ normalizedDomain: { $in: domains } })
      .project({ normalizedDomain: 1, category: 1, brandName: 1, monthlyVisitsFormatted: 1 })
      .toArray();

    const metaMap: Record<string, Record<string, unknown>> = {};
    for (const doc of metaDocs) {
      metaMap[doc.normalizedDomain] = doc;
    }

    // Format response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = changes.map((c: any) => ({
      domain: c.domain,
      techName: c.techName,
      changeType: c.changeType,
      category: c.category,
      color: c.color,
      detectedAt: c.detectedAt,
      brandCategory: metaMap[c.domain]?.category || '',
      brandName: metaMap[c.domain]?.brandName || null,
      traffic: metaMap[c.domain]?.monthlyVisitsFormatted || null,
    }));

    const installed = typeStats.find((t: { _id: string; count: number }) => t._id === 'installed')?.count || 0;
    const uninstalled = typeStats.find((t: { _id: string; count: number }) => t._id === 'uninstalled')?.count || 0;

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        installed,
        uninstalled,
        total: installed + uninstalled,
        categories: categoryStats.map((c: { _id: string; count: number }) => ({ name: c._id, count: c.count })),
      },
    }, { headers: corsHeaders });
  } catch (err) {
    console.error('[tech-changes] error:', err);
    return NextResponse.json({ error: 'Failed to fetch tech changes' }, { status: 500, headers: corsHeaders });
  }
}

/**
 * POST: Backfill tech_changes from existing tech_cache.techChanges data.
 * Run once to seed historical data.
 */
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();

    // Find all tech_cache docs with techChanges
    const caches = await db.collection('tech_cache')
      .find({
        $or: [
          { 'techChanges.added': { $exists: true, $not: { $size: 0 } } },
          { 'techChanges.removed': { $exists: true, $not: { $size: 0 } } },
        ],
      })
      .project({ domain: 1, techChanges: 1, technologies: 1, updatedAt: 1 })
      .toArray();

    let inserted = 0;
    const bulkDocs: Record<string, unknown>[] = [];

    for (const cache of caches) {
      const domain = cache.domain;
      const changes = cache.techChanges || {};
      const detectedAt = cache.updatedAt || new Date();

      // Build category/color lookup from current technologies
      const catMap: Record<string, string> = {};
      const colorMap: Record<string, string> = {};
      for (const t of (cache.technologies || []) as { name: string; category: string; color: string }[]) {
        catMap[t.name] = t.category;
        colorMap[t.name] = t.color;
      }

      for (const name of (changes.added || [])) {
        bulkDocs.push({
          domain, techName: name, changeType: 'installed',
          category: catMap[name] || (TECH_CATEGORY_MAP as Record<string, string>)[name] || 'Other',
          color: colorMap[name] || '#6B7280',
          detectedAt,
        });
      }
      for (const name of (changes.removed || [])) {
        bulkDocs.push({
          domain, techName: name, changeType: 'uninstalled',
          category: (TECH_CATEGORY_MAP as Record<string, string>)[name] || 'Other',
          color: '#ef4444',
          detectedAt,
        });
      }
    }

    if (bulkDocs.length > 0) {
      const result = await db.collection('tech_changes').insertMany(bulkDocs);
      inserted = result.insertedCount;
    }

    // Create indexes
    await Promise.all([
      db.collection('tech_changes').createIndex({ detectedAt: -1 }),
      db.collection('tech_changes').createIndex({ domain: 1, detectedAt: -1 }),
      db.collection('tech_changes').createIndex({ changeType: 1, detectedAt: -1 }),
      db.collection('tech_changes').createIndex({ category: 1, detectedAt: -1 }),
      db.collection('tech_changes').createIndex({ techName: 1 }),
    ]);

    return NextResponse.json({
      message: `Backfilled ${inserted} tech changes from ${caches.length} domains`,
      inserted,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error('[tech-changes] backfill error:', err);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500, headers: corsHeaders });
  }
}
