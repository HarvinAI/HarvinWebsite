import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminAuth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runNewsDrivenScan, BROAD_QUERIES, PUBLISHER_FEEDS } = require('@/lib/signals/newsDrivenScan');

// Full scan takes ~165s. Cap at 300 because Vercel Hobby's hard limit is 300.
// (Pro: 800, Enterprise: no cap. Railway: no cap.) If your plan supports more,
// bump this — otherwise the run fits comfortably under 300.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/admin/news-scan
 *
 * Triggers the full news-driven scan. Invoked by Cloud Scheduler / Railway
 * cron / curl. Captures the lib's log stream and returns it with run stats.
 *
 * Headers:
 *   x-admin-token: <ADMIN_API_TOKEN env var>
 *
 * Optional body (JSON):
 *   { dryRun?: boolean, verbose?: boolean,
 *     limitQueries?: number, query?: string, skipFeeds?: boolean }
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return new NextResponse(denied.body, { status: denied.status, headers: corsHeaders });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const dryRun = body.dryRun === true;
  const verbose = body.verbose === true;
  const limitQueries = typeof body.limitQueries === 'number' ? body.limitQueries : 0;
  const singleQuery = typeof body.query === 'string' ? body.query : '';
  const skipFeeds = body.skipFeeds === true;

  const queries: string[] = singleQuery
    ? [singleQuery]
    : limitQueries > 0
      ? BROAD_QUERIES.slice(0, limitQueries)
      : BROAD_QUERIES;
  const publisherFeeds = skipFeeds || singleQuery ? [] : PUBLISHER_FEEDS;

  const logLines: string[] = [];
  const log = (line: string) => { logLines.push(line); };

  try {
    const db = await getDb();
    const stats = await runNewsDrivenScan({
      db,
      queries,
      publisherFeeds,
      dryRun,
      verbose,
      log,
    });

    return NextResponse.json({
      ok: true,
      stats,
      logTail: logLines.slice(-200),
    }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[admin/news-scan] error:', error?.message);
    return NextResponse.json(
      { ok: false, error: error?.message || 'scan failed', logTail: logLines.slice(-200) },
      { status: 500, headers: corsHeaders },
    );
  }
}

/**
 * GET /api/admin/news-scan
 *
 * Lightweight status: counts of market_news (news-driven) and discovered_brands.
 * Same admin-token gate.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return new NextResponse(denied.body, { status: denied.status, headers: corsHeaders });

  try {
    const db = await getDb();
    const [totalNews, newsDriven, discovered] = await Promise.all([
      db.collection('market_news').countDocuments(),
      db.collection('market_news').countDocuments({ discoveredVia: 'news-driven' }),
      db.collection('discovered_brands').countDocuments(),
    ]);
    return NextResponse.json(
      { ok: true, marketNewsTotal: totalNews, newsDrivenAttributed: newsDriven, discoveredBrandsPending: discovered },
      { headers: corsHeaders },
    );
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500, headers: corsHeaders });
  }
}
