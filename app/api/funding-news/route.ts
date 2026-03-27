import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PERIOD_MAP: Record<string, number> = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const period = sp.get('period') || '7d';
  const sector = sp.get('sector') || 'all';
  const round = sp.get('round') || 'all';
  const country = sp.get('country') || 'all';
  const search = sp.get('search') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '30', 10)));
  const skip = (page - 1) * limit;

  const days = PERIOD_MAP[period] || 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const db = await getDb();
    const col = db.collection('funding_news');

    const query: Record<string, unknown> = {
      publishedAt: { $gte: since },
      confidence: { $gte: 0.5 },
    };

    if (sector !== 'all') query.sector = sector;
    if (round !== 'all') query.round = { $regex: round, $options: 'i' };
    if (country !== 'all') query.country = country;
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
      ];
    }

    const [articles, total] = await Promise.all([
      col.find(query)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .project({ _id: 0, titleHash: 0 })
        .toArray(),
      col.countDocuments(query),
    ]);

    // Get available filter options + stats
    const allSince = { publishedAt: { $gte: since }, confidence: { $gte: 0.5 } };

    let stats: { sectors: Record<string, number>; rounds: Record<string, number>; countries: Record<string, number>; totalAmount: number } = {
      sectors: {},
      rounds: {},
      countries: {},
      totalAmount: 0,
    };

    try {
      const [sectorAgg, roundAgg, countryAgg, amountAgg] = await Promise.all([
        col.aggregate([
          { $match: allSince },
          { $group: { _id: '$sector', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray(),
        col.aggregate([
          { $match: allSince },
          { $group: { _id: '$round', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray(),
        col.aggregate([
          { $match: allSince },
          { $group: { _id: '$country', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray(),
        col.aggregate([
          { $match: { ...allSince, amountUSD: { $gt: 0 } } },
          { $group: { _id: null, total: { $sum: '$amountUSD' } } },
        ]).toArray(),
      ]);

      for (const r of sectorAgg) if (r._id) stats.sectors[r._id as string] = r.count as number;
      for (const r of roundAgg) if (r._id) stats.rounds[r._id as string] = r.count as number;
      for (const r of countryAgg) if (r._id) stats.countries[r._id as string] = r.count as number;
      stats.totalAmount = (amountAgg[0]?.total as number) || 0;
    } catch {
      // Fallback for in-memory DB (no aggregate support)
      const allDocs = await col.find(allSince)
        .project({ sector: 1, round: 1, country: 1, amountUSD: 1 })
        .toArray();
      for (const d of allDocs) {
        if (d.sector) stats.sectors[d.sector] = (stats.sectors[d.sector] || 0) + 1;
        if (d.round) stats.rounds[d.round] = (stats.rounds[d.round] || 0) + 1;
        if (d.country) stats.countries[d.country] = (stats.countries[d.country] || 0) + 1;
        if (d.amountUSD) stats.totalAmount += d.amountUSD;
      }
    }

    return NextResponse.json({
      articles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[funding-news API] error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch funding news' },
      { status: 500, headers: corsHeaders }
    );
  }
}
