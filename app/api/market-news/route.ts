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
  const newsType = sp.get('newsType') || 'all'; // funding, hiring, acquisition, launch, shutdown, regulatory, partnership, expansion
  const category = sp.get('category') || 'all';
  const country = sp.get('country') || 'all';
  const impact = sp.get('impact') || 'all'; // high, medium, low
  const search = sp.get('search') || '';
  const domain = sp.get('domain') || ''; // filter by specific brand domain
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '30', 10)));
  const skip = (page - 1) * limit;

  const days = PERIOD_MAP[period] || 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const db = await getDb();
    const col = db.collection('market_news');

    const query: Record<string, unknown> = {
      publishedAt: { $gte: since },
      confidence: { $gte: 0.4 },
    };

    if (newsType !== 'all') query.newsType = newsType;
    if (category !== 'all') query.category = category;
    if (country !== 'all') query.country = country;
    if (impact !== 'all') query.marketImpact = impact;
    if (domain) query.domain = domain;
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { headline: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
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

    // Stats
    const baseQuery = { publishedAt: { $gte: since }, confidence: { $gte: 0.4 } };

    type StatsType = {
      newsTypes: Record<string, number>;
      categories: Record<string, number>;
      countries: Record<string, number>;
      totalFundingUSD: number;
      highImpact: number;
    };

    let stats: StatsType = {
      newsTypes: {},
      categories: {},
      countries: {},
      totalFundingUSD: 0,
      highImpact: 0,
    };

    try {
      const [typeAgg, catAgg, countryAgg, fundingAgg, impactAgg] = await Promise.all([
        col.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$newsType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray(),
        col.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 30 },
        ]).toArray(),
        col.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$country', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray(),
        col.aggregate([
          { $match: { ...baseQuery, newsType: 'funding', 'details.amountUSD': { $gt: 0 } } },
          { $group: { _id: null, total: { $sum: '$details.amountUSD' } } },
        ]).toArray(),
        col.aggregate([
          { $match: { ...baseQuery, marketImpact: 'high' } },
          { $group: { _id: null, count: { $sum: 1 } } },
        ]).toArray(),
      ]);

      for (const r of typeAgg) if (r._id) stats.newsTypes[r._id as string] = r.count as number;
      for (const r of catAgg) if (r._id) stats.categories[r._id as string] = r.count as number;
      for (const r of countryAgg) if (r._id) stats.countries[r._id as string] = r.count as number;
      stats.totalFundingUSD = (fundingAgg[0]?.total as number) || 0;
      stats.highImpact = (impactAgg[0]?.count as number) || 0;
    } catch {
      // Fallback for in-memory DB
      const allDocs = await col.find(baseQuery)
        .project({ newsType: 1, category: 1, country: 1, marketImpact: 1, details: 1 })
        .toArray();
      for (const d of allDocs) {
        if (d.newsType) stats.newsTypes[d.newsType] = (stats.newsTypes[d.newsType] || 0) + 1;
        if (d.category) stats.categories[d.category] = (stats.categories[d.category] || 0) + 1;
        if (d.country) stats.countries[d.country] = (stats.countries[d.country] || 0) + 1;
        if (d.newsType === 'funding' && d.details?.amountUSD) stats.totalFundingUSD += d.details.amountUSD;
        if (d.marketImpact === 'high') stats.highImpact++;
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
    console.error('[market-news API] error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch market news' },
      { status: 500, headers: corsHeaders }
    );
  }
}
