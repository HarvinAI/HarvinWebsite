import { NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const db = await getDb();
    const scoresCol = db.collection('signal_scores');
    const metaCol = db.collection('company_meta');

    // Get top 100 recommended accounts
    const scores = await scoresCol.find({ recommended: true })
      .sort({ totalScore: -1 })
      .limit(100)
      .project({ _id: 0 })
      .toArray();

    if (scores.length === 0) {
      return NextResponse.json({ accounts: [] }, { headers: corsHeaders });
    }

    // Join with company_meta for category, region, traffic
    const domains = scores.map((s: Record<string, unknown>) => s.domain as string);
    const metaDocs = await metaCol.find(
      { normalizedDomain: { $in: domains } }
    ).project({
      _id: 0,
      normalizedDomain: 1,
      category: 1,
      region: 1,
      monthlyVisits: 1,
      monthlyVisitsFormatted: 1,
    }).toArray();

    const metaMap: Record<string, Record<string, unknown>> = {};
    for (const doc of metaDocs) {
      metaMap[doc.normalizedDomain as string] = doc;
    }

    const accounts = scores.map((score: Record<string, unknown>) => {
      const domain = score.domain as string;
      const meta = metaMap[domain] || {};
      return {
        domain,
        name: domainToBrand(domain),
        category: meta.category || null,
        region: meta.region || null,
        monthlyVisits: meta.monthlyVisits || null,
        monthlyVisitsFormatted: meta.monthlyVisitsFormatted || null,
        score: score.totalScore,
        signalCount: score.signalCount,
        signals: score.signals || [],
        topSignal: score.topSignal,
        reason: score.recommendedReason,
        lastSignalDate: score.lastSignalDate,
      };
    });

    return NextResponse.json({ accounts }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[recommendations API] error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch recommendations' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/** Extract brand name from domain */
function domainToBrand(domain: string): string {
  return domain
    .replace(/^www\d*\./, '')
    .replace(/\.(com|in|co|io|net|org|co\.in|com\.au|co\.uk)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
