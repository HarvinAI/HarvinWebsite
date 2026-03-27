#!/usr/bin/env node

/**
 * Market Intelligence News Scanner — ZERO API version
 *
 * Fetches ALL market-relevant news from Google News RSS + Bing News RSS
 * and extracts structured data using pure regex (no LLM, no API keys).
 *
 * Covers: Funding, Hiring (CEO → fresher), Acquisition, Product Launch,
 *         Shutdown/Layoff, Regulatory, Partnership, Expansion
 *
 * Speed: Processes 500+ articles in ~2 minutes (vs 8+ hours with LLM)
 *
 * Usage:
 *   node scripts/market-news-scan.js                     # full run
 *   node scripts/market-news-scan.js --dry-run           # don't write to DB
 *   node scripts/market-news-scan.js --limit 50          # limit articles
 *   node scripts/market-news-scan.js --cluster 3         # specific cluster
 *   node scripts/market-news-scan.js --type hiring       # only hiring queries
 *   node scripts/market-news-scan.js --verbose           # print every extraction
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Load .env.local (only for MONGO_URI — no other API keys needed!)
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
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0; // 0 = no limit
const clusterIdx = args.indexOf('--cluster');
const ONLY_CLUSTER = clusterIdx !== -1 ? parseInt(args[clusterIdx + 1], 10) : null;
const typeIdx = args.indexOf('--type');
const ONLY_TYPE = typeIdx !== -1 ? args[typeIdx + 1] : null;

const PROGRESS_FILE = path.resolve(__dirname, 'market-news-progress.json');

// ── Category clusters with search queries ─────────────────────────────────

const CATEGORY_CLUSTERS = [
  { name: 'Fintech & Banking', queryTerms: ['fintech', 'banking startup', 'neobank', 'payments startup', 'lending startup', 'crypto', 'insurance startup'] },
  { name: 'Ecommerce & Retail', queryTerms: ['ecommerce startup', 'D2C brand', 'online retail', 'quick commerce', 'grocery startup', 'FMCG brand'] },
  { name: 'Fashion & Beauty', queryTerms: ['fashion brand', 'D2C fashion', 'beauty startup', 'skincare brand', 'jewelry brand', 'luxury brand India'] },
  { name: 'Food & Beverage', queryTerms: ['food startup', 'food delivery', 'cloud kitchen', 'restaurant chain', 'QSR India', 'beverage brand'] },
  { name: 'Health & Pharma', queryTerms: ['healthtech startup', 'pharma company', 'biotech startup', 'telemedicine', 'wellness brand', 'hospital chain'] },
  { name: 'EdTech', queryTerms: ['edtech startup', 'online learning', 'ed-tech India', 'skill development startup'] },
  { name: 'SaaS & Enterprise', queryTerms: ['SaaS startup', 'B2B SaaS', 'enterprise software', 'cybersecurity startup', 'cloud platform'] },
  { name: 'AI & Deep Tech', queryTerms: ['AI startup', 'artificial intelligence company', 'generative AI', 'robotics startup', 'semiconductor company', 'deeptech'] },
  { name: 'Logistics & Mobility', queryTerms: ['logistics startup', 'EV startup', 'electric vehicle', 'mobility startup', 'supply chain', 'fleet management'] },
  { name: 'Real Estate & Infra', queryTerms: ['proptech startup', 'real estate startup', 'construction tech', 'coworking startup', 'home services'] },
  { name: 'Media & Entertainment', queryTerms: ['gaming startup', 'OTT platform', 'media company India', 'creator economy', 'esports', 'entertainment startup'] },
  { name: 'Travel & Hospitality', queryTerms: ['travel tech', 'hotel chain', 'tourism startup', 'booking platform', 'hospitality startup'] },
  { name: 'HR & Services', queryTerms: ['HR tech startup', 'recruitment platform', 'staffing startup', 'legal tech'] },
  { name: 'Energy & Climate', queryTerms: ['cleantech startup', 'renewable energy startup', 'solar company', 'EV charging', 'climate tech startup', 'green energy'] },
  { name: 'Home & Lifestyle', queryTerms: ['home decor brand', 'pet care startup', 'fitness brand', 'baby care D2C', 'lifestyle brand India'] },
  { name: 'Agriculture', queryTerms: ['agritech startup', 'agriculture technology India', 'farm tech startup'] },
  { name: 'Manufacturing', queryTerms: ['manufacturing startup India', 'industrial tech', 'packaging company', 'smart manufacturing'] },
  { name: 'Telecom & Defense', queryTerms: ['telecom company India', '5G startup', 'defense tech startup', 'space tech startup India'] },
  { name: 'Social & Community', queryTerms: ['social media startup', 'dating app India', 'community platform startup'] },
  { name: 'General Startup', queryTerms: ['startup India funding', 'Indian startup news', 'startup raises', 'startup acquisition', 'startup layoffs India', 'startup IPO India'] },
];

// ── News type query suffixes ──────────────────────────────────────────────

const NEWS_TYPES = [
  { type: 'funding',     suffix: 'funding OR raised OR investment OR series OR venture capital' },
  { type: 'hiring',      suffix: 'appoints OR hires OR new CEO OR new CTO OR recruits OR hiring OR layoffs' },
  { type: 'acquisition', suffix: 'acquires OR acquisition OR merger OR takeover OR buyout' },
  { type: 'launch',      suffix: 'launches OR new product OR new service OR expands OR IPO' },
  { type: 'shutdown',    suffix: 'shuts down OR layoffs OR closes OR bankruptcy OR downsizing' },
  { type: 'regulatory',  suffix: 'regulation OR ban OR policy OR RBI OR SEBI OR government order' },
  { type: 'partnership', suffix: 'partners with OR collaboration OR joint venture OR tie-up' },
  { type: 'expansion',   suffix: 'expands to OR new store OR new market OR international expansion' },
];

// ── HTTP helpers ──────────────────────────────────────────────────────────

function httpGet(url, timeout = 12000) {
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
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
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
    if (title) {
      items.push({
        title: decodeEntities(title),
        snippet: decodeEntities(description || ''),
        url: link || '',
        pubDate: pubDate || '',
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = regex.exec(xml);
  return m ? m[1].trim() : '';
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '');
}

// ── News fetchers (RSS only — no API keys!) ───────────────────────────────

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

// ── Dedup ─────────────────────────────────────────────────────────────────

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`\n[market-scan] Starting (ZERO-API mode)${DRY_RUN ? ' — DRY RUN' : ''}...`);
  console.log(`[market-scan] No API keys required — pure RSS + regex extraction\n`);

  const db = await getDb();
  const col = db.collection('market_news');

  // Ensure indexes
  if (!DRY_RUN) {
    col.createIndex({ publishedAt: -1 }).catch(() => {});
    col.createIndex({ titleHash: 1 }, { unique: true }).catch(() => {});
    col.createIndex({ newsType: 1, publishedAt: -1 }).catch(() => {});
    col.createIndex({ category: 1, publishedAt: -1 }).catch(() => {});
    col.createIndex({ country: 1, publishedAt: -1 }).catch(() => {});
    col.createIndex({ companyName: 1 }).catch(() => {});
    col.createIndex({ marketImpact: 1, publishedAt: -1 }).catch(() => {});
    col.createIndex({ publishedAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 }).catch(() => {});
  }

  // Load existing title hashes for dedup
  const seenTitles = new Set();
  if (!DRY_RUN) {
    try {
      const existing = await col.find({}).sort({ publishedAt: -1 }).limit(15000)
        .project({ titleHash: 1 }).toArray();
      for (const e of existing) seenTitles.add(e.titleHash);
      console.log(`[market-scan] ${seenTitles.size} existing articles in DB (dedup)\n`);
    } catch {}
  }

  // Build query list
  const clusters = ONLY_CLUSTER !== null
    ? [CATEGORY_CLUSTERS[ONLY_CLUSTER]].filter(Boolean)
    : CATEGORY_CLUSTERS;

  const newsTypes = ONLY_TYPE
    ? NEWS_TYPES.filter(t => t.type === ONLY_TYPE)
    : NEWS_TYPES;

  // Build queries: each cluster term × each news type
  const queries = [];
  for (const cluster of clusters) {
    for (const nt of newsTypes) {
      // Use up to 2 terms per query to keep results focused
      for (let ti = 0; ti < cluster.queryTerms.length; ti += 2) {
        const terms = cluster.queryTerms.slice(ti, ti + 2).join(' OR ');
        queries.push({
          query: `(${terms}) ${nt.suffix}`,
          clusterName: cluster.name,
          newsType: nt.type,
        });
      }
    }
  }

  console.log(`[market-scan] ${queries.length} queries to fetch\n`);

  // ── Step 1: Fetch all articles from RSS ─────────────────────────────────
  const allArticles = [];
  const fetchedTitles = new Set();

  for (let i = 0; i < queries.length; i++) {
    const { query, clusterName, newsType } = queries[i];
    const pct = ((i / queries.length) * 100).toFixed(0);
    process.stdout.write(`\r  [${pct}%] Fetching: ${clusterName} / ${newsType}...                         `);

    // Google News RSS
    try {
      const articles = await fetchGoogleNewsRSS(query);
      for (const a of articles) {
        const norm = normalizeTitle(a.title);
        if (!fetchedTitles.has(norm) && !seenTitles.has(norm)) {
          fetchedTitles.add(norm);
          allArticles.push(a);
        }
      }
    } catch {}

    // Bing News RSS (for high-priority types)
    if (['funding', 'hiring', 'acquisition', 'shutdown'].includes(newsType)) {
      try {
        const articles = await fetchBingNewsRSS(query);
        for (const a of articles) {
          const norm = normalizeTitle(a.title);
          if (!fetchedTitles.has(norm) && !seenTitles.has(norm)) {
            fetchedTitles.add(norm);
            allArticles.push(a);
          }
        }
      } catch {}
    }

    // Small delay to avoid rate limiting from RSS feeds
    await sleep(300);
  }

  console.log(`\n\n[market-scan] Fetched ${allArticles.length} new unique articles`);

  // Filter old articles (> 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let articlesToProcess = allArticles.filter(a => {
    if (!a.pubDate) return true;
    return new Date(a.pubDate) > thirtyDaysAgo;
  });

  console.log(`[market-scan] ${articlesToProcess.length} from last 30 days`);

  if (LIMIT > 0 && articlesToProcess.length > LIMIT) {
    articlesToProcess = articlesToProcess.slice(0, LIMIT);
    console.log(`[market-scan] Limited to ${LIMIT}`);
  }

  // ── Step 2: Extract data using regex (INSTANT — no API calls) ───────────
  console.log(`\n[market-scan] Extracting data (regex — no API calls)...\n`);

  let extracted = 0;
  let skipped = 0;
  let written = 0;
  const typeCounts = {};

  for (let i = 0; i < articlesToProcess.length; i++) {
    const article = articlesToProcess[i];

    // Run regex extraction — instant, no network call
    const data = extractMarketNews(article);

    if (!data) {
      skipped++;
      continue;
    }

    extracted++;
    typeCounts[data.newsType] = (typeCounts[data.newsType] || 0) + 1;

    if (VERBOSE || DRY_RUN) {
      console.log(`  ${data.newsType.toUpperCase().padEnd(12)} | ${(data.companyName || '?').padEnd(20)} | ${(data.category || '?').padEnd(20)} | ${data.headline?.slice(0, 70)}`);
      if (data.details.amount) console.log(`${''.padEnd(16)}Amount: ${data.details.amount} (${data.details.round || '?'})`);
      if (data.details.person) console.log(`${''.padEnd(16)}Person: ${data.details.person} — ${data.details.role || '?'}`);
      if (data.details.investors?.length) console.log(`${''.padEnd(16)}Investors: ${data.details.investors.join(', ')}`);
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
        companyName: data.companyName,
        category: data.category,
        headline: data.headline,
        summary: data.summary,
        country: data.country,
        marketImpact: data.marketImpact,
        confidence: data.confidence,
        details: data.details,
        fetchedAt: new Date(),
      };

      try {
        await col.updateOne(
          { titleHash: doc.titleHash },
          { $set: doc, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
        written++;
      } catch (err) {
        if (err.code !== 11000) console.warn(`  Write error: ${err.message}`);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[market-scan] Done in ${elapsed}s`);
  console.log(`  Total fetched:  ${allArticles.length}`);
  console.log(`  Processed:      ${articlesToProcess.length}`);
  console.log(`  Extracted:      ${extracted}`);
  console.log(`  Not relevant:   ${skipped}`);
  console.log(`  Written to DB:  ${written}`);
  console.log(`  By type:`, typeCounts);
  console.log(`\n  No API keys used. Zero cost.\n`);

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    status: 'completed',
    lastRunDate: new Date().toISOString(),
    totalFetched: allArticles.length,
    processed: articlesToProcess.length,
    extracted, skipped, written, typeCounts,
    elapsedSeconds: parseFloat(elapsed),
    mode: 'zero-api',
  }, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('[market-scan] Fatal error:', err);
  process.exit(1);
});
