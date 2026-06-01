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
    const result = await scanSingleUrl(url, { forceRefresh, pageData });
    logScan(req, domain, source, result, null);

    // Persist tech scan results to DB (tech_cache + company_meta)
    // Also compute tech diff (added/removed) by comparing with previous scan
    if (result.count > 0) {
      try {
        const db = await getDb();
        const techs = result.technologies || [];
        const techNames = techs.map((t: { name: string }) => t.name);
        const now = new Date();

        // Fetch previous scan to compute diff
        const prevCache = await db.collection('tech_cache').findOne(
          { domain },
          { projection: { technologies: 1, updatedAt: 1, techChanges: 1 } },
        );
        const prevNamesList: string[] = (prevCache?.technologies || []).map((t: { name: string }) => t.name);
        const prevNames = new Set(prevNamesList);
        const currNames = new Set(techNames as string[]);
        const addedTechs = (techNames as string[]).filter(n => !prevNames.has(n));
        const removedTechs = prevNamesList.filter(n => !currNames.has(n));

        // Attach diff to result so the frontend can display badges
        if (prevCache && (addedTechs.length > 0 || removedTechs.length > 0)) {
          // Fresh changes detected in this scan
          (result as Record<string, unknown>).techChanges = {
            added: addedTechs,
            removed: removedTechs,
            previousScanAt: prevCache.updatedAt || null,
          };
        } else if (prevCache?.techChanges && ((prevCache.techChanges as Record<string, unknown[]>).added?.length > 0 || (prevCache.techChanges as Record<string, unknown[]>).removed?.length > 0)) {
          // No new changes, but return the last known changes from DB
          (result as Record<string, unknown>).techChanges = prevCache.techChanges;
        }

        // Build category lookup for changed techs
        const techCategoryMap: Record<string, string> = {};
        const techColorMap: Record<string, string> = {};
        for (const t of techs as { name: string; category: string; color: string }[]) {
          techCategoryMap[t.name] = t.category;
          techColorMap[t.name] = t.color;
        }
        // Also include removed techs from previous cache
        if (prevCache?.technologies) {
          for (const t of prevCache.technologies as { name: string; category: string; color: string }[]) {
            if (!techCategoryMap[t.name]) techCategoryMap[t.name] = t.category;
            if (!techColorMap[t.name]) techColorMap[t.name] = t.color;
          }
        }

        const writes: Promise<unknown>[] = [
          // Full tech objects + diff in tech_cache
          db.collection('tech_cache').updateOne(
            { domain },
            {
              $set: {
                domain, technologies: techs, count: result.count, updatedAt: now,
                ...(prevCache ? { techChanges: { added: addedTechs, removed: removedTechs, previousScanAt: prevCache.updatedAt } } : {}),
              },
            },
            { upsert: true },
          ),
          // Tech names + count + app presence in company_meta
          db.collection('company_meta').updateOne(
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
          ),
        ];

        // Log individual tech changes to tech_changes collection (feed)
        if (prevCache && (addedTechs.length > 0 || removedTechs.length > 0)) {
          const changeDocs: Record<string, unknown>[] = [];
          for (const name of addedTechs) {
            changeDocs.push({
              domain, techName: name, changeType: 'installed',
              category: techCategoryMap[name] || 'Other',
              color: techColorMap[name] || '#6B7280',
              detectedAt: now,
            });
          }
          for (const name of removedTechs) {
            changeDocs.push({
              domain, techName: name, changeType: 'uninstalled',
              category: techCategoryMap[name] || 'Other',
              color: techColorMap[name] || '#6B7280',
              detectedAt: now,
            });
          }
          if (changeDocs.length > 0) {
            writes.push(db.collection('tech_changes').insertMany(changeDocs));
          }
        }

        await Promise.all(writes);
      } catch {}
    }

    // Enrich with MAU / traffic data from DB, or estimate for new domains
    try {
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

    // D2C vs Non-D2C determination
    // Priority: KNOWN_BRANDS (authoritative) > DB validation > DB category > scan result category
    if (result.companyMeta) {
      // Known brands are curated truth — they override any stale DB classification
      // (e.g. Canon misread as "News & Media") and are never treated as Non-D2C here.
      const knownBrand = lookupKnownBrand(domain);
      if (knownBrand?.category) {
        result.companyMeta.category = knownBrand.category;
        result.companyMeta.subCategory = knownBrand.subCategory || result.companyMeta.subCategory || 'General';
        result.companyMeta.isNonD2C = false;
        delete result.companyMeta.nonD2CReason;
        return NextResponse.json(result, { headers: corsHeaders });
      }

      const NON_D2C_CATS = new Set([
        'SaaS & B2B', 'Professional Services', 'Manufacturing', 'Wholesale & Distribution',
        'Cloud & DevTools', 'Data Center & Infrastructure', 'Web Hosting & Domains',
        'Staffing & Workforce Solutions', 'Government & Public Sector',
        'NGO & Non-Profit', 'International & Diplomatic Organizations', 'Professional & Trade Associations',
        'Schools & Universities', 'Railways & Metro', 'Nuclear & Atomic Energy', 'Aerospace & Defense',
        'Mining & Quarrying', 'Chemicals & Petrochemicals', 'Rubber, Plastics & Composites',
        'Glass, Ceramics & Nonmetallic Minerals', 'Wire, Cable & Electrical', 'Semiconductor & Chips',
        'Conglomerates & Holding Companies', 'Private Equity & Venture Capital',
        'Import/Export & Trade', 'Social Services & Welfare',
        'Robotics & Automation', 'IoT & Connected Devices',
        'Quantum Computing', 'AI & Data Science', 'Printing & Packaging', 'Construction & Building Materials',
        'Forestry & Timber', 'Aquaculture & Fisheries', 'Plantation & Cash Crops',
        'Marine & Shipping', 'Outdoor Advertising & Signage',
      ]);

      try {
        const db2 = await getDb();
        const metaDoc = await db2.collection('company_meta').findOne(
          { normalizedDomain: domain },
          { projection: { category: 1, subCategory: 1, d2cValidation: 1, techStack: 1, appPresence: 1 } },
        );

        if (metaDoc) {
          const dbCat = metaDoc.category;
          const dbValidation = metaDoc.d2cValidation;

          // Case 1: Explicitly validated as D2C — trust DB, use DB category
          if (dbValidation?.isD2C === true) {
            if (dbCat && dbCat !== 'Unknown' && dbCat !== 'Not Required' && dbCat !== '') {
              result.companyMeta.category = dbCat;
              result.companyMeta.subCategory = metaDoc.subCategory || result.companyMeta.subCategory;
            }
            // NOT Non-D2C — skip all Non-D2C checks
          }
          // Case 2: Explicitly validated as Non-D2C
          else if (dbCat === 'Not Required' || dbValidation?.isD2C === false) {
            result.companyMeta.category = 'Not Required';
            result.companyMeta.subCategory = 'Non D2C Brand';
            result.companyMeta.isNonD2C = true;
            result.companyMeta.nonD2CReason = dbValidation?.reason || 'This is not a D2C brand';
          }
          // Case 3: DB has a valid D2C category but scan returned Unknown
          else if (dbCat && dbCat !== 'Unknown' && dbCat !== '' && !NON_D2C_CATS.has(dbCat)) {
            const scanCat = result.companyMeta.category;
            if (!scanCat || scanCat === 'Unknown' || scanCat === '') {
              // Scan couldn't classify — use DB category instead
              result.companyMeta.category = dbCat;
              result.companyMeta.subCategory = metaDoc.subCategory || 'General';
            }
          }
          // Case 4: Both scan and DB have Non-D2C/Unknown category
          else {
            const finalCat = result.companyMeta.category || dbCat;
            // Check if has ecommerce tech or app — then it's likely D2C despite unknown category
            const ecomPlatforms = ['Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'PrestaShop', 'Salesforce Commerce Cloud'];
            const hasEcom = (metaDoc.techStack || []).some((t: string) => ecomPlatforms.some(p => t.includes(p)));
            const hasApp = metaDoc.appPresence && metaDoc.appPresence !== 'No App';

            if (hasEcom || hasApp) {
              // Has ecommerce or app — likely D2C, don't flag
            } else if (!finalCat || finalCat === 'Unknown' || finalCat === '' || NON_D2C_CATS.has(finalCat)) {
              result.companyMeta.isNonD2C = true;
              result.companyMeta.nonD2CReason = !finalCat || finalCat === 'Unknown' || finalCat === ''
                ? 'Could not identify as a D2C brand — no consumer checkout or product catalog detected'
                : `Non-D2C industry: ${finalCat}`;
            }
          }
        }
      } catch { /* non-critical */ }
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
