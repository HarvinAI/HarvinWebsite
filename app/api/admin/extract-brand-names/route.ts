import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminAuth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { lookupKnownBrand, analyzeKeywords, extractFromMeta } = require('@/lib/scan/companyMeta');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classifyWithAI } = require('@/lib/scan/aiClassifier');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractMetaMap } = require('@/lib/scan/fetch');

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

const BATCH_MAX = 500;
const SCRAPE_TIMEOUT_MS = 10000;       // tightened from 15s — front-end retries the batch on failure, so a single slow site shouldn't blow the 300s function timeout
const SCRAPE_CONCURRENCY = 20;          // single homepage fetch + sync keyword analysis per domain
const SCRAPE_MAX_ATTEMPTS = 1;          // batch-level retry handles transient failures; per-domain retry inside a batch just eats time

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function normalizeDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Strip surrounding quotes / brackets from CSV cells
  s = s.replace(/^[<"'(\[]+|[>"')\]]+$/g, '');
  s = s.replace(/^https?:\/\//i, '');
  s = s.replace(/^(?:www\d*|m|mobile)\./i, '');
  s = s.split(/[/?#]/)[0];                 // strip path / query / hash
  s = s.replace(/:\d+$/, '');               // strip port
  s = s.replace(/\.+$/, '');                // strip trailing dots
  return s;
}

// "tv9telugu.com" → "Tv9telugu" — the dumb-fallback baseline
function domainStemTitleCase(domain: string): string {
  return domain
    .replace(/^www\d*\./, '')
    .replace(/\.(com|in|co|io|net|org|co\.in|com\.au|co\.uk|xyz|app|club|life|store|shop|online|tech|ai|asia|bike|me)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"').replace(/&#x22;/gi, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/gi, '/');
}

// Strip common publisher/tagline trail from a scraped title.
// Handles three common patterns:
//   "Brand - Tagline"           → "Brand"
//   "Tagline | … | Brand"       → "Brand"    ← was previously broken
//   "Brand: Tagline"            → "Brand"
// Strategy: split on common separators; pick the segment whose normalized
// form matches the domain stem. If none matches, fall back to the first.
function cleanScrapedTitle(raw: string, domain: string): string {
  if (!raw) return '';
  let s = decodeEntities(raw.trim());

  // Split into segments. Supported separators (each surrounded by whitespace,
  // except `:` which is allowed to be tight on the left — "Paytm: …"):
  //   " - "  " | "  " — "  " · "  " :: "  ": "
  const segments = s.split(/\s+(?:[-|—·]|::)\s+|:\s+/).map((seg) => seg.trim()).filter(Boolean);

  if (segments.length > 1) {
    const stem = domain.replace(/\.[a-z.]+$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    let matched: string | null = null;
    for (const seg of segments) {
      const normSeg = seg.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (!normSeg) continue;
      // Strong match: segment exactly equals the stem, OR is a superstring
      // of the stem with length >= stem (catches "MagicBricks" → "magicbricks",
      // "Shaadi.com" → "shaadicom" containing "shaadi"). Prevents weak matches
      // like "Pay" matching stem "paypal".
      if (normSeg === stem || (normSeg.length >= stem.length && normSeg.includes(stem))) {
        matched = seg;
        break;
      }
    }
    s = matched || segments[0];
  }

  // Strip trailing tagline words even after segment selection
  s = s.replace(/\s+(?:official(?:\s+(?:site|website|store|page))?|home(?:page)?|live|online|india|in|app)$/i, '');
  s = s.replace(/\s+/g, ' ').trim();

  if (s.length < 3) return domainStemTitleCase(domain);
  return s;
}

// Real Chrome UA. Sites that throttle non-browser traffic stop throttling.
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchOnce(domain: string, timeoutMs: number): Promise<{ html: string | null; status: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://${domain}/`, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return { html: null, status: `http-${res.status}` };
    const html = (await res.text()).slice(0, 200_000);
    return { html, status: 'ok' };
  } catch (err) {
    clearTimeout(timer);
    const msg = (err as Error).message || 'fetch-error';
    return { html: null, status: msg.includes('abort') ? 'timeout' : 'error' };
  }
}

async function fetchHomepageBrand(domain: string): Promise<{ name: string | null; source: string; html: string | null }> {
  let lastStatus = 'unknown';
  let html: string | null = null;

  // Retry once on timeout/error; many cold TLS handshakes complete on the 2nd try.
  for (let attempt = 1; attempt <= SCRAPE_MAX_ATTEMPTS; attempt++) {
    const result = await fetchOnce(domain, SCRAPE_TIMEOUT_MS);
    lastStatus = result.status;
    if (result.html) { html = result.html; break; }
    // Don't waste a retry on a definite client error (404 / 410)
    if (result.status.startsWith('http-4')) break;
  }

  if (!html) return { name: null, source: lastStatus, html: null };

  // 1. og:site_name
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]
              || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1];
  if (ogSite && ogSite.trim().length >= 2) {
    return { name: cleanScrapedTitle(ogSite, domain), source: 'og:site_name', html };
  }

  // 2. application-name meta
  const appName = html.match(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (appName && appName.trim().length >= 2) {
    return { name: cleanScrapedTitle(appName, domain), source: 'application-name', html };
  }

  // 3. og:title
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
               || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
  if (ogTitle && ogTitle.trim().length >= 2) {
    return { name: cleanScrapedTitle(ogTitle, domain), source: 'og:title', html };
  }

  // 4. <title>
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (titleTag && titleTag.trim().length >= 2) {
    return { name: cleanScrapedTitle(titleTag, domain), source: 'title', html };
  }

  return { name: null, source: 'no-meta', html };
}

type ExtractRow = {
  domain: string;
  brandName: string;
  source: string;          // og:site_name | og:title | title | application-name | cached | fallback | timeout | error | http-XYZ
  cached: boolean;
  category?: string | null;
  subCategory?: string | null;
  categorySource?: string; // cached | known-brand | ai | none
};

type CacheEntry = {
  brandName?: string;
  category?: string;
  subCategory?: string;
};

function isUsableBrandName(name: string | undefined | null): name is string {
  return !!name && name.length >= 2 && name !== 'undefined' && !name.startsWith('http');
}

function isUsableCategory(c: string | null | undefined): c is string {
  return !!c && c !== 'Unknown' && c !== 'Not Required' && c.length >= 2;
}

// Lightweight category resolver. No sub-fetches — works on whatever HTML we
// already scraped for the brand name. Matches the same classification logic
// the extension uses (extractFromMeta + analyzeKeywords), minus the heavy
// store/region/app-presence detection that extractCompanyMeta layers on top.
async function resolveCategory(
  domain: string,
  cached: CacheEntry | undefined,
  html: string | null,
): Promise<{ category: string | null; subCategory: string | null; categorySource: string }> {
  // 1. Cached value — skip "Unknown"
  if (isUsableCategory(cached?.category)) {
    return {
      category: cached!.category!,
      subCategory: cached?.subCategory ?? null,
      categorySource: 'cached',
    };
  }

  // 2. Known-brand registry (in-memory)
  const known = lookupKnownBrand(domain);
  if (isUsableCategory(known?.category)) {
    return {
      category: known.category,
      subCategory: known.subCategory ?? null,
      categorySource: 'known-brand',
    };
  }

  // 3. Sync keyword engine — same as the extension's analyzer
  if (html) {
    try {
      const url = `https://${domain}/`;
      const metaMap = extractMetaMap(html);
      const metaResults = extractFromMeta(html, metaMap);
      const kw = analyzeKeywords(html, url, metaResults);
      if (isUsableCategory(kw?.category)) {
        return {
          category: kw.category,
          subCategory: kw.subCategory || 'General',
          categorySource: 'heuristic',
        };
      }
      // og:type=product → ecommerce, even when analyzeKeywords stays silent
      if (isUsableCategory(metaResults?.category)) {
        return {
          category: metaResults.category,
          subCategory: 'General',
          categorySource: 'heuristic',
        };
      }
    } catch {
      // fall through to AI
    }
  }

  // 4. Groq AI last resort. classifyWithAI works on empty HTML too — it
  // classifies from the domain name alone when no page content is available.
  const ai = await classifyWithAI(domain, html || '');
  if (isUsableCategory(ai?.category)) {
    return {
      category: ai.category,
      subCategory: ai.subCategory ?? null,
      categorySource: 'ai',
    };
  }

  return { category: null, subCategory: null, categorySource: 'none' };
}

async function processOne(
  domain: string,
  cacheMap: Map<string, CacheEntry>,
): Promise<ExtractRow> {
  const cached = cacheMap.get(domain);
  const haveBrand = isUsableBrandName(cached?.brandName);
  const haveCategory = isUsableCategory(cached?.category);

  // Fast path: nothing to do — both brand and category in cache.
  if (haveBrand && haveCategory) {
    return {
      domain,
      brandName: cached!.brandName!,
      source: 'cached',
      cached: true,
      category: cached!.category!,
      subCategory: cached?.subCategory ?? null,
      categorySource: 'cached',
    };
  }

  // Need to scrape (for brand or category or both) — single fetch, reused.
  const scraped = await fetchHomepageBrand(domain);
  const html = scraped.html;

  // Brand name
  const brandName = haveBrand
    ? cached!.brandName!
    : (scraped.name && scraped.name.length >= 2 ? scraped.name : domainStemTitleCase(domain));
  const brandSource = haveBrand
    ? 'cached'
    : (scraped.name && scraped.name.length >= 2 ? scraped.source : `fallback (${scraped.source})`);

  // Category
  const cat = await resolveCategory(domain, cached, html);

  return {
    domain,
    brandName,
    source: brandSource,
    cached: haveBrand,
    category: cat.category,
    subCategory: cat.subCategory,
    categorySource: cat.categorySource,
  };
}

// Best-effort upsert of newly-resolved categories so subsequent runs hit
// the cache path. Skips low-confidence sources ('ai' from domain alone with
// no HTML is too unreliable to persist).
async function persistCategoryUpdates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  rows: ExtractRow[],
): Promise<void> {
  const ops = rows
    .filter(r => r.categorySource === 'heuristic' || r.categorySource === 'known-brand')
    .filter(r => r.category)
    .map(r => ({
      updateOne: {
        filter: { normalizedDomain: r.domain },
        update: {
          $set: {
            category: r.category,
            subCategory: r.subCategory,
            categorySource: r.categorySource,
            categoryUpdatedAt: new Date(),
          },
          $setOnInsert: { normalizedDomain: r.domain, createdAt: new Date() },
        },
        upsert: true,
      },
    }));
  if (ops.length === 0) return;
  try {
    await db.collection('company_meta').bulkWrite(ops, { ordered: false });
  } catch {
    // best effort — don't fail the request
  }
}

// Concurrency-bounded map (k workers)
async function pMap<T, R>(items: T[], worker: (t: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let k = 0; k < Math.min(concurrency, items.length); k++) {
    workers.push((async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await worker(items[i]);
      }
    })());
  }
  await Promise.all(workers);
  return results;
}

/**
 * POST /api/admin/extract-brand-names
 *
 * Body: { domains: string[] }   (max 500 per request)
 * Auth: x-admin-token header
 *
 * Returns: { results: ExtractRow[], stats: {...} }
 *
 * Strategy:
 *   1. Look up existing company_meta.brandName — return cached if it looks clean.
 *   2. Otherwise scrape the homepage for og:site_name → og:title → <title>.
 *   3. Fall back to title-case of the domain stem.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return new NextResponse(denied.body, { status: denied.status, headers: corsHeaders });

  let body: { domains?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400, headers: corsHeaders }); }

  const raw = Array.isArray(body.domains) ? body.domains : [];
  if (raw.length === 0) {
    return NextResponse.json({ error: 'domains array required' }, { status: 400, headers: corsHeaders });
  }
  if (raw.length > BATCH_MAX) {
    return NextResponse.json({ error: `max ${BATCH_MAX} domains per request — chunk client-side` }, { status: 400, headers: corsHeaders });
  }

  // Keep every input slot (including duplicates) for the output.
  // Dedupe only the work — one fetch per unique domain — so duplicates don't
  // hammer the same site twice but still produce their own output row.
  const all = raw
    .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    .map(normalizeDomain)
    .filter((d) => d.length > 0 && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d));
  const unique = [...new Set(all)];

  // Preload brandName + category/subCategory from company_meta in one query.
  // `overrides.*` takes precedence over the base fields (same rule as bulk-enrich).
  const db = await getDb();
  const existing = await db.collection('company_meta')
    .find({ normalizedDomain: { $in: unique } })
    .project({
      _id: 0,
      normalizedDomain: 1,
      brandName: 1,
      category: 1,
      subCategory: 1,
      overrides: 1,
    })
    .toArray();
  const cacheMap = new Map<string, CacheEntry>();
  for (const e of existing as Array<{
    normalizedDomain: string;
    brandName?: string;
    category?: string;
    subCategory?: string;
    overrides?: { category?: string; subCategory?: string };
  }>) {
    const entry: CacheEntry = {};
    if (e.brandName) entry.brandName = e.brandName;
    const cat = e.overrides?.category || e.category;
    const sub = e.overrides?.subCategory || e.subCategory;
    if (cat) entry.category = cat;
    if (sub) entry.subCategory = sub;
    if (Object.keys(entry).length > 0) cacheMap.set(e.normalizedDomain, entry);
  }

  const startedAt = Date.now();
  const uniqueRows = await pMap(unique, (d) => processOne(d, cacheMap), SCRAPE_CONCURRENCY);

  // Expand back: one output row per input slot. Duplicates share the same result.
  const byDomain = new Map(uniqueRows.map(r => [r.domain, r]));
  const rows = all.map(d => byDomain.get(d)!).filter(Boolean);

  // Persist newly-resolved categories back so the next run is an instant cache hit.
  // Fire-and-forget — don't block the response on Mongo writes.
  persistCategoryUpdates(db, uniqueRows).catch(() => {});

  const stats = {
    total: rows.length,
    cached: rows.filter(r => r.source === 'cached').length,
    scraped: rows.filter(r => !r.cached && !r.source.startsWith('fallback')).length,
    fallback: rows.filter(r => r.source.startsWith('fallback')).length,
    elapsedMs: Date.now() - startedAt,
  };

  return NextResponse.json({ results: rows, stats }, { headers: corsHeaders });
}
