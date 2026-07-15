import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanSingleUrl } = require('@/lib/scan/scan');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { lookupKnownBrand } = require('@/lib/scan/companyMeta');

export const maxDuration = 120;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

/* ── Shared scan handler ─────────────────────────────────────────────── */
async function handleScan(req: NextRequest, pageData?: Record<string, unknown>) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url query param required' }, { status: 400, headers: corsHeaders });
  }

  const domain = url.replace(/^https?:\/\//i, '')
    .replace(/^www\d*\./i, '')
    .replace(/^(?:en|ar|fr|de|es|it|pt|ja|ko|zh|ru|hi|th|vi|m|mobile|shop|store|app|my|web|online|buy)[-_.]/i, '')
    .replace(/\/.*$/, '').toLowerCase();
  const source = detectSource(req);
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';
  // Lightweight mode (Category Finder): classify only — skip store scraping,
  // app-store lookups and traffic estimation so bulk scans are fast.
  const metaOnly = req.nextUrl.searchParams.get('metaOnly') === '1';

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
    const result = await scanSingleUrl(url, { forceRefresh, pageData, metaOnly });
    logScan(req, domain, source, result, null);

    // scanSingleUrl (lib/scan/scan.js) already persisted tech_cache, the real
    // tech diff, and the tech_changes feed. We must NOT re-diff and re-write
    // tech_cache here — doing so compared against the just-written stack and
    // clobbered techChanges back to empty. Surface scan.js's diff on the
    // response and keep company_meta's tech summary in sync.
    if (result.count > 0) {
      try {
        const db = await getDb();
        const techNames = (result.technologies || []).map((t: { name: string }) => t.name);
        const now = new Date();

        // Prefer the fresh diff scan.js just computed; else fall back to the last
        // known migration stored in tech_cache (so the response still shows it).
        let techChanges = (result as Record<string, unknown>).techChanges as
          | { added?: string[]; removed?: string[] } | undefined;
        if (!techChanges) {
          const tcDoc = await db.collection('tech_cache').findOne(
            { domain }, { projection: { techChanges: 1 } },
          );
          const known = tcDoc?.techChanges as { added?: string[]; removed?: string[] } | undefined;
          if (known && ((known.added?.length || 0) > 0 || (known.removed?.length || 0) > 0)) {
            (result as Record<string, unknown>).techChanges = known;
          }
        }

        await db.collection('company_meta').updateOne(
          { normalizedDomain: domain },
          {
            $set: {
              techStack: techNames.slice(0, 20),
              techCount: result.count,
              lastTechScan: now,
              updatedAt: now,
              ...(result.companyMeta?.appPresence && result.companyMeta.appPresence !== 'No App'
                ? { appPresence: result.companyMeta.appPresence }
                : {}),
            },
            $setOnInsert: { normalizedDomain: domain, createdAt: now },
          },
          { upsert: true },
        );
      } catch {}
    }

    // Enrich with MAU / traffic data from DB, or estimate for new domains
    // (skipped in metaOnly mode — the CrUX/Tranco estimation is a slow network hop).
    if (!metaOnly) try {
      const db = await getDb();
      const doc = await db.collection('company_meta').findOne(
        { normalizedDomain: domain },
        { projection: { monthlyVisits: 1, monthlyVisitsFormatted: 1, trafficSource: 1 } },
      );
      if (doc && result.companyMeta && (doc.monthlyVisits || 0) > 0) {
        result.companyMeta.monthlyVisits = doc.monthlyVisits;
        result.companyMeta.monthlyVisitsFormatted = doc.monthlyVisitsFormatted;
      } else if (result.companyMeta && (!result.companyMeta.monthlyVisits || result.companyMeta.monthlyVisits === 0)) {
        // New domain not in DB — estimate traffic via CrUX API, then Tranco fallback
        let estimated = false;
        // ── Attempt 1: CrUX API ──
        try {
          const https = await import('https');
          const cruxKey = process.env.GOOGLE_API_KEY;
          if (cruxKey) {
            const cruxResult = await new Promise<{estimate: number; source: string} | null>((resolve) => {
              const postData = JSON.stringify({ origin: `https://${domain}` });
              const req = https.default.request({
                hostname: 'chromeuxreport.googleapis.com',
                path: `/v1/records:queryRecord?key=${cruxKey}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
                timeout: 5000,
              }, (res: import('http').IncomingMessage) => {
                let data = '';
                res.on('data', (chunk: string) => data += chunk);
                res.on('end', () => {
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.error || !parsed.record) { resolve(null); return; }
                    const phone = parsed.record.metrics?.form_factors?.fractions?.phone || 0;
                    let est = 5000;
                    if (phone > 0.7) est = 50000;
                    else if (phone > 0.5) est = 20000;
                    else if (phone > 0.3) est = 10000;
                    resolve({ estimate: est, source: 'crux' });
                  } catch { resolve(null); }
                });
              });
              req.on('error', () => resolve(null));
              req.on('timeout', () => { req.destroy(); resolve(null); });
              req.write(postData);
              req.end();
            });
            if (cruxResult) {
              const mv = cruxResult.estimate;
              const fmt = mv >= 1000000 ? `${(mv / 1000000).toFixed(1)}M` : mv >= 1000 ? `${(mv / 1000).toFixed(1)}K` : String(mv);
              result.companyMeta.monthlyVisits = mv;
              result.companyMeta.monthlyVisitsFormatted = fmt;
              estimated = true;
              await db.collection('company_meta').updateOne(
                { normalizedDomain: domain },
                { $set: { monthlyVisits: mv, monthlyVisitsFormatted: fmt, trafficSource: 'crux', trafficUpdatedAt: new Date() } },
                { upsert: true },
              ).catch(() => {});
            }
          }
        } catch { /* CrUX estimation is best-effort */ }

        // ── Attempt 2: Tranco rank-based estimation (fallback when CrUX has no data) ──
        if (!estimated) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fs = require('fs') as typeof import('fs');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pathMod = require('path') as typeof import('path');
            const trancoPath = pathMod.resolve(process.cwd(), 'scripts', 'tranco-list.csv');
            if (fs.existsSync(trancoPath)) {
              // Search for the domain in the Tranco CSV (format: "rank,domain")
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const readline = require('readline') as typeof import('readline');
              const stream = fs.createReadStream(trancoPath, { encoding: 'utf-8' });
              const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
              let trancoRank = 0;
              for await (const line of rl) {
                const comma = line.indexOf(',');
                if (comma === -1) continue;
                const csvDomain = line.slice(comma + 1).trim();
                if (csvDomain === domain) {
                  trancoRank = parseInt(line.slice(0, comma), 10);
                  break;
                }
              }
              stream.destroy();

              if (trancoRank > 0) {
                // Rank → visits model (same as scripts/estimate-traffic.js)
                const RANK_A = 8.86e10, RANK_B = 1.068;
                const CORRECTIONS = [
                  { max: 100, factor: 0.68 }, { max: 500, factor: 0.32 },
                  { max: 1000, factor: 0.95 }, { max: 5000, factor: 1.33 },
                  { max: 10000, factor: 1.97 }, { max: 50000, factor: 1.23 },
                  { max: 100000, factor: 1.44 }, { max: 500000, factor: 1.06 },
                  { max: Infinity, factor: 1.02 },
                ];
                const base = RANK_A / Math.pow(trancoRank, RANK_B);
                const corr = CORRECTIONS.find(c => trancoRank <= c.max);
                const mv = Math.round(base * (corr?.factor || 1));
                const fmt = mv >= 1_000_000 ? `${(mv / 1_000_000).toFixed(1)}M`
                          : mv >= 1_000 ? `${(mv / 1_000).toFixed(1)}K`
                          : String(mv);
                result.companyMeta.monthlyVisits = mv;
                result.companyMeta.monthlyVisitsFormatted = fmt;
                await db.collection('company_meta').updateOne(
                  { normalizedDomain: domain },
                  { $set: { monthlyVisits: mv, monthlyVisitsFormatted: fmt, trafficSource: 'tranco', trafficRank: trancoRank, trafficUpdatedAt: new Date() } },
                  { upsert: true },
                ).catch(() => {});
              }
            }
          } catch { /* Tranco fallback is best-effort */ }
        }
      }
    } catch { /* non-critical — skip if DB unavailable */ }

    // Category resolution. Non-D2C flagging is removed — every site gets a real
    // category + sub-category. KNOWN_BRANDS remains authoritative.
    if (result.companyMeta) {
      const knownBrand = lookupKnownBrand(domain);
      if (knownBrand?.category) {
        result.companyMeta.category = knownBrand.category;
        result.companyMeta.subCategory = knownBrand.subCategory || result.companyMeta.subCategory || 'General';
      }
      // Never surface a Non-D2C flag to callers.
      delete result.companyMeta.isNonD2C;
      delete result.companyMeta.nonD2CReason;
    }

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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/* GET — server-side fetch (dashboard, API callers, old extension versions) */
export async function GET(req: NextRequest) {
  return handleScan(req);
}

/* POST — extension sends pre-captured page data, server skips re-fetching */
export async function POST(req: NextRequest) {
  let pageData;
  try {
    const body = await req.json();
    pageData = body.pageData;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  return handleScan(req, pageData);
}
