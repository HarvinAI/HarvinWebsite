import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanSingleUrl } = require('@/lib/scan/scan');

export const maxDuration = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/universe/scan
 * Body: { domains: string[] }
 * Scans up to 5 domains at a time via scanSingleUrl (which triggers extractCompanyMeta internally)
 */
export async function POST(req: NextRequest) {
  try {
    const { domains } = await req.json();
    if (!domains?.length) {
      return NextResponse.json({ error: 'No domains provided' }, { status: 400, headers: corsHeaders });
    }

    const batch = (domains as string[]).slice(0, 5);

    const db = await getDb();
    const metaCol = db.collection('company_meta');

    // Check which ones actually need scanning
    const existing = await metaCol.find(
      { normalizedDomain: { $in: batch } },
      { projection: { normalizedDomain: 1 } },
    ).toArray();
    const existingSet = new Set(existing.map((d: Record<string, unknown>) => d.normalizedDomain));
    const toScan = batch.filter(d => !existingSet.has(d));

    const results: { domain: string; status: string }[] = [];

    for (const domain of toScan) {
      try {
        // scanSingleUrl calls extractCompanyMeta which writes to company_meta
        await scanSingleUrl(`https://${domain}`, { forceRefresh: true });
        results.push({ domain, status: 'scanned' });
      } catch {
        results.push({ domain, status: 'failed' });
      }
    }

    for (const d of batch) {
      if (existingSet.has(d)) {
        results.push({ domain: d, status: 'exists' });
      }
    }

    return NextResponse.json({
      scanned: results.filter(r => r.status === 'scanned').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'exists').length,
      results,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error('[universe/scan] error:', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500, headers: corsHeaders });
  }
}
