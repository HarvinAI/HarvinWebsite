import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PERIOD_MAP: Record<string, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const type = sp.get('type') || 'all'; // funding, key_hire, all
  const period = sp.get('period') || '7d';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '50', 10)));
  const skip = (page - 1) * limit;

  const days = PERIOD_MAP[period] || 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const db = await getDb();
    const col = db.collection('signals');

    const query: Record<string, unknown> = {
      signalDate: { $gte: since },
    };
    if (type !== 'all') {
      query.signalType = type;
    }

    const [signals, total] = await Promise.all([
      col.find(query)
        .sort({ signalDate: -1 })
        .skip(skip)
        .limit(limit)
        .project({ _id: 0 })
        .toArray(),
      col.countDocuments(query),
    ]);

    // Compute stats by signal type
    const statsPipeline = [
      { $match: { signalDate: { $gte: since } } },
      { $group: { _id: '$signalType', count: { $sum: 1 } } },
    ];

    let stats: Record<string, number> = {};
    try {
      const aggResult = await col.aggregate(statsPipeline).toArray();
      for (const r of aggResult) {
        stats[r._id as string] = r.count as number;
      }
    } catch {
      // Fallback: count manually if aggregate not available (in-memory DB)
      const allSignals = await col.find({ signalDate: { $gte: since } })
        .project({ signalType: 1 })
        .toArray();
      for (const s of allSignals) {
        const st = s.signalType as string;
        stats[st] = (stats[st] || 0) + 1;
      }
    }

    return NextResponse.json({
      signals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[signals API] error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch signals' },
      { status: 500, headers: corsHeaders }
    );
  }
}
