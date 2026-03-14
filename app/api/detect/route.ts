import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanSingleUrl } = require('@/lib/scan/scan');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

export const maxDuration = 120;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/* ── Concurrency gate ────────────────────────────────────────────────────
 * Limits how many heavy scans (puppeteer + network) run in parallel.
 * Extra requests wait in a FIFO queue; if the queue is full they get 429.
 */
const MAX_CONCURRENT = 5;
const MAX_QUEUE = 20;
let running = 0;
const queue: Array<{ resolve: () => void }> = [];

function acquireSlot(): Promise<boolean> {
  if (running < MAX_CONCURRENT) {
    running++;
    return Promise.resolve(true);
  }
  if (queue.length >= MAX_QUEUE) {
    return Promise.resolve(false); // queue full → reject
  }
  return new Promise<boolean>((resolve) => {
    queue.push({ resolve: () => resolve(true) });
  });
}

function releaseSlot() {
  if (queue.length > 0) {
    const next = queue.shift()!;
    next.resolve(); // hand the slot to the next waiter
  } else {
    running--;
  }
}

/* ── Scan logging ────────────────────────────────────────────────────────
 * Fire-and-forget: logs every scan to `scan_logs` collection.
 * Never blocks the response, never throws.
 */
function logScan(req: NextRequest, domain: string, source: string, result: Record<string, unknown> | null, error: string | null) {
  (async () => {
    try {
      const db = await getDb();
      await db.collection('scan_logs').insertOne({
        domain,
        scannedUrl: req.nextUrl.searchParams.get('url'),
        source,              // 'dashboard' | 'extension' | 'api' | 'unknown'
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || null,
        userAgent: req.headers.get('user-agent') || null,
        referer: req.headers.get('referer') || null,
        category: (result?.companyMeta as Record<string, unknown>)?.category || null,
        subCategory: (result?.companyMeta as Record<string, unknown>)?.subCategory || null,
        techCount: result?.count || 0,
        error,
        ts: new Date(),
      });
    } catch {}
  })();
}

/* Infer where the request came from */
function detectSource(req: NextRequest): string {
  const referer = req.headers.get('referer') || '';
  const ua = req.headers.get('user-agent') || '';
  const origin = req.headers.get('origin') || '';

  // Chrome extension sends origin like chrome-extension://...
  if (origin.startsWith('chrome-extension://') || ua.includes('TechScanner')) return 'extension';
  // Dashboard / web app
  if (referer.includes('harvin.ai') || referer.includes('localhost')) return 'dashboard';
  // Direct API call
  if (!referer && !origin) return 'api';
  return 'unknown';
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url query param required' }, { status: 400, headers: corsHeaders });
  }

  const domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
  const source = detectSource(req);
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';

  // Acquire a concurrency slot (wait in queue or get rejected)
  const acquired = await acquireSlot();
  if (!acquired) {
    logScan(req, domain, source, null, 'rate_limited');
    return NextResponse.json(
      { error: 'Server is busy — too many scans in progress. Please try again in a few seconds.' },
      { status: 429, headers: { ...corsHeaders, 'Retry-After': '5' } },
    );
  }

  try {
    const result = await scanSingleUrl(url, { forceRefresh });
    logScan(req, domain, source, result, null);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as { message?: string };
    const msg = error.message || 'Failed to scan this website';
    // Safety net: never expose internal infrastructure errors to users
    const safeMsg = /puppeteer|chromium|browser engine|runtime/i.test(msg)
      ? 'Could not fully scan this site — try again later'
      : msg;
    logScan(req, domain, source, null, msg);
    return NextResponse.json({ error: safeMsg }, { status: 502, headers: corsHeaders });
  } finally {
    releaseSlot();
  }
}
