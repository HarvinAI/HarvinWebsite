#!/usr/bin/env node

/**
 * Market News Scanner — D2C Brand-Specific
 *
 * Fetches news ONLY for D2C brands in the database.
 * Searches Google News RSS + Bing RSS for each brand by name,
 * extracts structured data using pure regex (no LLM, no API keys).
 *
 * Priority: scans highest Harvin Score brands first.
 *
 * Usage:
 *   node scripts/market-news-scan.js                     # full run (top 500 brands)
 *   node scripts/market-news-scan.js --dry-run           # preview
 *   node scripts/market-news-scan.js --limit 50          # limit brands
 *   node scripts/market-news-scan.js --domain nykaa.com  # single brand
 *   node scripts/market-news-scan.js --min-score 40      # only brands with score >= 40
 *   node scripts/market-news-scan.js --verbose           # print every extraction
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Load .env.local
try {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const { getDb } = require('../lib/scan/db');
const { extractMarketNews } = require('../lib/signals/regexExtractor');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 500;
const domainIdx = args.indexOf('--domain');
const SINGLE_DOMAIN = domainIdx !== -1 ? args[domainIdx + 1] : null;
const minScoreIdx = args.indexOf('--min-score');
const MIN_SCORE = minScoreIdx !== -1 ? parseInt(args[minScoreIdx + 1], 10) : 0;

const PROGRESS_FILE = path.resolve(__dirname, 'market-news-progress.json');

// ── Domain → Brand name ──────────────────────────────────────────────────

function domainToBrand(domain) {
  return domain
    .replace(/^www\d*\./, '')
    .replace(/\.(com|in|co|io|net|org|co\.in|com\.au|co\.uk|xyz|app|club|life|store|shop|online|tech|ai)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── HTTP helpers ──────────────────────────────────────────────────────────

function httpGet(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); res.resume(); return; }
      let data = '';
      res.on('data', chunk => { data += chunk; if (data.length > 100000) res.destroy(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── RSS parser ────────────────────────────────────────────────────────────

function parseRSSItems(xml) {
  if (!xml) return [];
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');
    if (title) items.push({ title: decodeEntities(title), snippet: decodeEntities(description || ''), url: link || '', pubDate: pubDate || '' });
  }
  return items;
}

function extractTag(xml, tag) {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const m = cdataRegex.exec(xml);
  if (m) return m[1].trim();
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m2 = regex.exec(xml);
  return m2 ? m2[1].trim() : '';
}

function decodeEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '');
}

// ── News fetchers ─────────────────────────────────────────────────────────

async function fetchGoogleNewsRSS(query) {
  const q = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en&gl=IN&ceid=IN:en`;
  const xml = await httpGet(url);
  return parseRSSItems(xml).map(a => ({ ...a, source: 'google_news' }));
}

async function fetchBingNewsRSS(query) {
  const q = encodeURIComponent(query);
  const url = `https://www.bing.com/news/search?q=${q}&format=rss`;
  const xml = await httpGet(url);
  return parseRSSItems(xml).map(a => ({ ...a, source: 'bing_news' }));
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

// ── News query templates per brand ────────────────────────────────────────
// For each brand, we search multiple query types

const QUERY_TEMPLATES = [
  { suffix: 'funding OR raised OR investment OR series', type: 'funding' },
  { suffix: 'appoints OR hires OR new CEO OR CTO OR layoffs', type: 'hiring' },
  { suffix: 'acquires OR acquisition OR merger', type: 'acquisition' },
  { suffix: 'launches OR new product OR expands OR IPO', type: 'launch' },
  { suffix: 'shuts down OR closes OR layoffs OR bankruptcy', type: 'shutdown' },
  { suffix: 'partners OR collaboration OR tie-up', type: 'partnership' },
];

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`\n[market-scan] D2C Brand-Specific News Scanner`);
  console.log(`[market-scan] Zero API keys — RSS + regex only${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  const db = await getDb();
  const metaCol = db.collection('company_meta');
  const newsCol = db.collection('market_news');

  // Ensure indexes
  if (!DRY_RUN) {
    newsCol.createIndex({ publishedAt: -1 }).catch(() => {});
    newsCol.createIndex({ titleHash: 1 }, { unique: true }).catch(() => {});
    newsCol.createIndex({ newsType: 1, publishedAt: -1 }).catch(() => {});
    newsCol.createIndex({ category: 1, publishedAt: -1 }).catch(() => {});
    newsCol.createIndex({ companyName: 1 }).catch(() => {});
    newsCol.createIndex({ domain: 1, publishedAt: -1 }).catch(() => {});
    newsCol.createIndex({ publishedAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 }).catch(() => {});
  }

  // ── Step 1: Get D2C brands from DB ──────────────────────────────────────
  let brandQuery;
  if (SINGLE_DOMAIN) {
    brandQuery = { normalizedDomain: SINGLE_DOMAIN };
  } else {
    brandQuery = {
      category: { $nin: [null, '', 'Unknown', 'Not Required'] },
    };
    if (MIN_SCORE > 0) brandQuery.harvinScore = { $gte: MIN_SCORE };
  }

  let brands = await metaCol.find(brandQuery)
    .sort({ harvinScore: -1 })
    .project({ normalizedDomain: 1, brandName: 1, category: 1, harvinScore: 1 })
    .limit(LIMIT)
    .toArray();

  console.log(`[market-scan] ${brands.length} D2C brands to scan (sorted by Harvin Score)\n`);

  // Load existing title hashes for dedup
  const seenTitles = new Set();
  if (!DRY_RUN) {
    try {
      const existing = await newsCol.find({}).sort({ publishedAt: -1 }).limit(20000)
        .project({ titleHash: 1 }).toArray();
      for (const e of existing) seenTitles.add(e.titleHash);
      console.log(`[market-scan] ${seenTitles.size} existing articles (dedup)\n`);
    } catch {}
  }

  // ── Step 2: Fetch news for each brand ───────────────────────────────────
  let totalFetched = 0;
  let totalExtracted = 0;
  let totalWritten = 0;
  let totalSkipped = 0;
  const typeCounts = {};
  const brandHits = {};

  for (let bi = 0; bi < brands.length; bi++) {
    const brand = brands[bi];
    const domain = brand.normalizedDomain;
    const brandName = brand.brandName && !brand.brandName.startsWith('http')
      ? brand.brandName
      : domainToBrand(domain);
    const category = brand.category;
    const score = brand.harvinScore || 0;

    const pct = ((bi / brands.length) * 100).toFixed(0);
    process.stdout.write(`\r  [${pct}%] ${bi + 1}/${brands.length} — ${brandName.padEnd(25)} (score:${score})`);

    // Search news for this brand with different query types
    const brandArticles = [];

    for (const tmpl of QUERY_TEMPLATES) {
      const query = `"${brandName}" ${tmpl.suffix}`;

      // Google News RSS
      try {
        const articles = await fetchGoogleNewsRSS(query);
        for (const a of articles) {
          const norm = normalizeTitle(a.title);
          if (!seenTitles.has(norm)) {
            seenTitles.add(norm);
            brandArticles.push(a);
          }
        }
      } catch {}

      // Bing RSS (only for funding, hiring, acquisition — highest value)
      if (['funding', 'hiring', 'acquisition'].includes(tmpl.type)) {
        try {
          const articles = await fetchBingNewsRSS(query);
          for (const a of articles) {
            const norm = normalizeTitle(a.title);
            if (!seenTitles.has(norm)) {
              seenTitles.add(norm);
              brandArticles.push(a);
            }
          }
        } catch {}
      }

      await sleep(200); // rate limit between queries
    }

    totalFetched += brandArticles.length;

    // Filter to last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentArticles = brandArticles.filter(a => {
      if (!a.pubDate) return true;
      return new Date(a.pubDate) > thirtyDaysAgo;
    });

    // ── Step 3: Extract data using regex ───────────────────────────────────
    for (const article of recentArticles) {
      const data = extractMarketNews(article);
      if (!data) { totalSkipped++; continue; }

      totalExtracted++;
      typeCounts[data.newsType] = (typeCounts[data.newsType] || 0) + 1;
      brandHits[domain] = (brandHits[domain] || 0) + 1;

      // Use the brand's DB category instead of regex-guessed category
      if (!data.category) data.category = category;

      if (VERBOSE || DRY_RUN) {
        console.log(`\n    ${data.newsType.toUpperCase().padEnd(12)} ${data.headline?.slice(0, 80)}`);
        if (data.details.amount) console.log(`${''.padEnd(16)}Amount: ${data.details.amount}`);
        if (data.details.person) console.log(`${''.padEnd(16)}Person: ${data.details.person} — ${data.details.role || '?'}`);
      }

      if (!DRY_RUN) {
        const doc = {
          titleHash: normalizeTitle(article.title),
          title: article.title,
          snippet: article.snippet,
          url: article.url,
          source: article.source,
          sourceName: '',
          imageUrl: '',
          publishedAt: article.pubDate ? new Date(article.pubDate) : new Date(),
          newsType: data.newsType,
          companyName: data.companyName || brandName,
          category: data.category || category,
          headline: data.headline,
          summary: data.summary,
          country: data.country,
          marketImpact: data.marketImpact,
          confidence: data.confidence,
          details: data.details,
          // Link to DB account
          domain: domain,
          harvinScore: score,
          fetchedAt: new Date(),
        };

        try {
          await newsCol.updateOne(
            { titleHash: doc.titleHash },
            { $set: doc, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
          );
          totalWritten++;
        } catch (err) {
          if (err.code !== 11000) console.warn(`\n  Write error: ${err.message}`);
        }
      }
    }

    // Save progress every 50 brands
    if (bi % 50 === 0 && bi > 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        status: 'running', brandsProcessed: bi + 1, totalBrands: brands.length,
        totalFetched, totalExtracted, totalWritten, totalSkipped, typeCounts,
      }, null, 2));
    }

    await sleep(300); // rate limit between brands
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const brandsWithNews = Object.keys(brandHits).length;

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`  D2C BRAND NEWS SCAN REPORT${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  Brands scanned:      ${brands.length}`);
  console.log(`  Brands with news:    ${brandsWithNews}`);
  console.log(`  Articles fetched:    ${totalFetched}`);
  console.log(`  News extracted:      ${totalExtracted}`);
  console.log(`  Not relevant:        ${totalSkipped}`);
  console.log(`  Written to DB:       ${totalWritten}`);
  console.log(`  Time:                ${elapsed}s`);
  console.log(`\n  By news type:`);
  for (const [t, c] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(c).padStart(5)}  ${t}`);
  }
  if (brandsWithNews > 0) {
    console.log(`\n  Top brands with most news:`);
    const topBrands = Object.entries(brandHits).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [d, c] of topBrands) {
      console.log(`    ${String(c).padStart(5)}  ${d}`);
    }
  }
  console.log(`\n  Zero API keys. Zero cost.`);
  console.log(`${'═'.repeat(60)}\n`);

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    status: 'completed', lastRunDate: new Date().toISOString(),
    brandsScanned: brands.length, brandsWithNews,
    totalFetched, totalExtracted, totalWritten, totalSkipped, typeCounts,
    elapsedSeconds: parseFloat(elapsed), mode: 'brand-specific',
  }, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('[market-scan] Fatal error:', err);
  process.exit(1);
});
