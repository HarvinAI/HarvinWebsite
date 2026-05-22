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
const SCRAPE_TIMEOUT_MS = 7000;
const SCRAPE_CONCURRENCY = 30;

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

// Strip common publisher/site suffixes from a title.
// "Hotstar - Watch Live TV …" → "Hotstar"
// "TV9 Telugu Live | Latest News" → "TV9 Telugu"
function cleanScrapedTitle(raw: string, domain: string): string {
  if (!raw) return '';
  let s = raw.trim();
  // Decode common HTML entities
  s = s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
  // Cut on the first " - ", " | ", " — ", " :: ", " · " separator (publishers' tagline format)
  const splitMatch = s.split(/\s+(?:[-|—·]|::)\s+/)[0];
  if (splitMatch && splitMatch.length >= 2) s = splitMatch;
  // Remove trailing words that are obviously not part of the name
  s = s.replace(/\s+(?:official(?:\s+(?:site|website|store|page))?|home(?:page)?|live|online|india|in|app)$/i, '');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  // If the scrape collapsed to something tiny but the domain hints at multi-word, prefer the domain
  if (s.length < 3) return domainStemTitleCase(domain);
  return s;
}

async function fetchHomepageBrand(domain: string): Promise<{ name: string | null; source: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${domain}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 HarvinAI-BrandExtractor/1.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return { name: null, source: `http-${res.status}` };
    const html = (await res.text()).slice(0, 200_000);

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
  } catch (err) {
    clearTimeout(timer);
    const msg = (err as Error).message || 'fetch-error';
    return { name: null, source: msg.includes('abort') ? 'timeout' : 'error' };
  }
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
