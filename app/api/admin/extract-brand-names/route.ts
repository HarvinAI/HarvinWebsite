import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminAuth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

const BATCH_MAX = 500;
const SCRAPE_TIMEOUT_MS = 15000;       // was 7s — too aggressive for slow Indian D2C SPAs
const SCRAPE_CONCURRENCY = 20;          // was 30 — reduces local-socket contention
const SCRAPE_MAX_ATTEMPTS = 2;          // 1 retry on timeout/error; recovers most slow first-bytes

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function normalizeDomain(raw: string): string {
  return raw.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\d*\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
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

async function fetchHomepageBrand(domain: string): Promise<{ name: string | null; source: string }> {
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

  if (!html) return { name: null, source: lastStatus };

  // 1. og:site_name
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1]
              || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1];
  if (ogSite && ogSite.trim().length >= 2) {
    return { name: cleanScrapedTitle(ogSite, domain), source: 'og:site_name' };
  }

  // 2. application-name meta
  const appName = html.match(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (appName && appName.trim().length >= 2) {
    return { name: cleanScrapedTitle(appName, domain), source: 'application-name' };
  }

  // 3. og:title
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
               || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
  if (ogTitle && ogTitle.trim().length >= 2) {
    return { name: cleanScrapedTitle(ogTitle, domain), source: 'og:title' };
  }

  // 4. <title>
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (titleTag && titleTag.trim().length >= 2) {
    return { name: cleanScrapedTitle(titleTag, domain), source: 'title' };
  }

  return { name: null, source: 'no-meta' };
}

type ExtractRow = {
  domain: string;
  brandName: string;
  source: string;          // og:site_name | og:title | title | application-name | cached | fallback | timeout | error | http-XYZ
  cached: boolean;
};

async function processOne(domain: string, cacheMap: Map<string, string>): Promise<ExtractRow> {
  // 1. If we already have a clean brandName in company_meta, return it
  const cached = cacheMap.get(domain);
  if (cached && cached.length >= 2 && cached !== 'undefined' && !cached.startsWith('http')) {
    return { domain, brandName: cached, source: 'cached', cached: true };
  }

  // 2. Scrape the homepage
  const scraped = await fetchHomepageBrand(domain);
  if (scraped.name && scraped.name.length >= 2) {
    return { domain, brandName: scraped.name, source: scraped.source, cached: false };
  }

  // 3. Fall back to title-case of domain stem
  return { domain, brandName: domainStemTitleCase(domain), source: `fallback (${scraped.source})`, cached: false };
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

  const normalized = [...new Set(
    raw
      .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
      .map(normalizeDomain)
      .filter((d) => d.length > 0 && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d))
  )];

  // Preload existing brandNames from company_meta in one query
  const db = await getDb();
  const existing = await db.collection('company_meta')
    .find({ normalizedDomain: { $in: normalized } })
    .project({ _id: 0, normalizedDomain: 1, brandName: 1 })
    .toArray();
  const cacheMap = new Map<string, string>();
  for (const e of existing as Array<{ normalizedDomain: string; brandName?: string }>) {
    if (e.brandName) cacheMap.set(e.normalizedDomain, e.brandName);
  }

  const startedAt = Date.now();
  const rows = await pMap(normalized, (d) => processOne(d, cacheMap), SCRAPE_CONCURRENCY);

  const stats = {
    total: rows.length,
    cached: rows.filter(r => r.source === 'cached').length,
    scraped: rows.filter(r => !r.cached && !r.source.startsWith('fallback')).length,
    fallback: rows.filter(r => r.source.startsWith('fallback')).length,
    elapsedMs: Date.now() - startedAt,
  };

  return NextResponse.json({ results: rows, stats }, { headers: corsHeaders });
}
