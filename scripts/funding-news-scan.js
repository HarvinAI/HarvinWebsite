#!/usr/bin/env node

/**
 * Funding News Aggregator — fetches ALL startup/business funding news
 * from multiple sources (Google News RSS, GNews, Bing News RSS),
 * extracts structured funding data via Groq LLM, stores in MongoDB.
 *
 * Unlike signal-news-scan.js which searches per-brand, this script
 * uses broad funding queries to catch ALL funding news — like Groww.
 *
 * Usage:
 *   node scripts/funding-news-scan.js                 # full run
 *   node scripts/funding-news-scan.js --dry-run       # extract but don't write
 *   node scripts/funding-news-scan.js --limit 20      # limit articles processed
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 200;

const PROGRESS_FILE = path.resolve(__dirname, 'funding-news-progress.json');

// ── Broad funding search queries ──────────────────────────────────────────
// These queries catch funding news across the entire startup ecosystem
const FUNDING_QUERIES = [
  // Indian startup ecosystem
  'startup funding raised India 2026',
  'series A B C funding India startup',
  'seed round funding Indian startup',
  'pre-series funding raised crore',
  'D2C brand funding India',
  'startup raises million India',
  'venture capital investment India startup',
  'funding round announced India',
  // Global funding
  'startup funding round raised million',
  'series A funding announced',
  'series B funding raised',
  'series C D funding startup',
  'seed funding startup raised',
  'pre-seed seed round startup',
  'venture capital startup investment 2026',
  // Sector-specific
  'fintech funding raised',
  'edtech startup funding',
  'healthtech funding round',
  'ecommerce D2C funding raised',
  'SaaS startup funding',
  'AI startup funding raised',
  'climate tech green startup funding',
  'deeptech startup funding raised',
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

function httpGetJSON(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
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

async function fetchGNews(query, apiKey) {
  const q = encodeURIComponent(query);
  const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&country=in&max=10&apikey=${apiKey}`;
  const data = await httpGetJSON(url);
  if (!data || !data.articles) return [];
  return data.articles.map(a => ({
    title: a.title || '',
    snippet: a.description || '',
    url: a.url || '',
    pubDate: a.publishedAt || '',
    source: 'gnews',
    imageUrl: a.image || '',
    sourceName: a.source?.name || '',
  }));
}

// ── Groq LLM extraction ──────────────────────────────────────────────────

function callGroq(body, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject({ code: res.statusCode, message: parsed.error.message || 'API error' });
            return;
          }
          resolve(parsed.choices?.[0]?.message?.content?.trim() || '');
        } catch { resolve(''); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

async function extractFundingData(article, apiKey) {
  const prompt = `Extract structured funding data from this news article.

Title: ${article.title}
Snippet: ${article.snippet}

Return ONLY a valid JSON object:
{
  "isFundingNews": boolean (true ONLY if this article is about a company raising funding/investment),
  "companyName": string (the company that raised funding),
  "amount": string or null (e.g. "$30M", "Rs 100 crore", "$5 million"),
  "amountUSD": number or null (estimated amount in USD millions, e.g. 30 for "$30M"),
  "round": string or null (e.g. "Series A", "Series B", "Seed", "Pre-Seed", "Pre-Series A", "Series C", "Series D", "Debt", "Bridge"),
  "investors": string[] (lead investor names, max 5),
  "sector": string or null (e.g. "Fintech", "Edtech", "D2C", "SaaS", "Healthtech", "Ecommerce", "AI/ML", "Logistics", "Foodtech", "Gaming", "Cleantech", "Agritech", "Deeptech", "Media", "Real Estate"),
  "country": string or null (country of the company, e.g. "India", "US", "UK"),
  "summary": string (1-2 sentence summary of the funding news),
  "confidence": number (0.0 to 1.0)
}

Rules:
- isFundingNews=false if this is NOT about a specific company raising money
- Do NOT include news about stock markets, mutual funds, government budgets, or general financial news
- Extract the EXACT amount mentioned in the article
- For Indian amounts in crores, also estimate amountUSD (1 crore ≈ $120K)
- Return ONLY the JSON, no explanation`;

  const body = {
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 400,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await callGroq(body, apiKey);
      let parsed = null;

      try { parsed = JSON.parse(result.trim()); } catch {}

      if (!parsed) {
        const start = result.indexOf('{');
        if (start !== -1) {
          let depth = 0, end = -1;
          for (let i = start; i < result.length; i++) {
            if (result[i] === '{') depth++;
            else if (result[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
          }
          if (end > start) {
            try { parsed = JSON.parse(result.slice(start, end)); } catch {}
          }
        }
      }

      if (!parsed) return null;
      if (!parsed.isFundingNews) return null;

      return {
        companyName: parsed.companyName || null,
        amount: parsed.amount || null,
        amountUSD: parsed.amountUSD || null,
        round: parsed.round || null,
        investors: parsed.investors || [],
        sector: parsed.sector || null,
        country: parsed.country || null,
        summary: parsed.summary || '',
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      };
    } catch (err) {
      if (err.code === 429 && attempt < 2) {
        const wait = (attempt + 1) * 15000;
        console.warn(`  [groq] rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (attempt === 2 || (err.code && err.code !== 429)) {
        console.warn(`  [groq] failed: ${err.message || err}`);
        return null;
      }
    }
  }
  return null;
}

// ── Dedup helper ──────────────────────────────────────────────────────────

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`[funding-scan] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const db = await getDb();
  const col = db.collection('funding_news');

  // Ensure indexes
  if (!DRY_RUN) {
    col.createIndex({ publishedAt: -1 }).catch(() => {});
    col.createIndex({ titleHash: 1 }, { unique: true }).catch(() => {});
    col.createIndex({ sector: 1, publishedAt: -1 }).catch(() => {});
    col.createIndex({ round: 1, publishedAt: -1 }).catch(() => {});
    col.createIndex({ country: 1, publishedAt: -1 }).catch(() => {});
    col.createIndex({ companyName: 1 }).catch(() => {});
    col.createIndex(
      { publishedAt: 1 },
      { expireAfterSeconds: 180 * 24 * 3600 } // auto-delete after 180 days
    ).catch(() => {});
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('[funding-scan] GROQ_API_KEY not set');
    process.exit(1);
  }

  const gnewsKey = process.env.GNEWS_API_KEY;

  // Step 1: Fetch articles from all sources for all queries
  console.log(`[funding-scan] Fetching news from ${FUNDING_QUERIES.length} queries...`);

  const allArticles = [];
  const seenTitles = new Set();

  for (let i = 0; i < FUNDING_QUERIES.length; i++) {
    const query = FUNDING_QUERIES[i];
    console.log(`  [${i + 1}/${FUNDING_QUERIES.length}] "${query}"`);

    // Google News RSS
    try {
      const articles = await fetchGoogleNewsRSS(query);
      for (const a of articles) {
        const norm = normalizeTitle(a.title);
        if (!seenTitles.has(norm)) {
          seenTitles.add(norm);
          allArticles.push(a);
        }
      }
    } catch (err) {
      console.warn(`    Google RSS failed: ${err.message}`);
    }

    // Bing News RSS
    try {
      const articles = await fetchBingNewsRSS(query);
      for (const a of articles) {
        const norm = normalizeTitle(a.title);
        if (!seenTitles.has(norm)) {
          seenTitles.add(norm);
          allArticles.push(a);
        }
      }
    } catch (err) {
      console.warn(`    Bing RSS failed: ${err.message}`);
    }

    // GNews (use sparingly — 100/day limit)
    if (gnewsKey && i < 5) { // only first 5 queries use GNews
      try {
        const articles = await fetchGNews(query, gnewsKey);
        for (const a of articles) {
          const norm = normalizeTitle(a.title);
          if (!seenTitles.has(norm)) {
            seenTitles.add(norm);
            allArticles.push(a);
          }
        }
      } catch (err) {
        console.warn(`    GNews failed: ${err.message}`);
      }
    }

    await sleep(800); // rate limit between queries
  }

  console.log(`[funding-scan] Fetched ${allArticles.length} unique articles`);

  // Filter out old articles (> 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentArticles = allArticles.filter(a => {
    if (!a.pubDate) return true; // include if no date
    const d = new Date(a.pubDate);
    return d > thirtyDaysAgo;
  });

  console.log(`[funding-scan] ${recentArticles.length} articles from last 30 days`);

  // Step 2: Check DB for existing articles (dedup)
  let articlesToProcess = recentArticles;
  if (!DRY_RUN) {
    const existingHashes = new Set();
    try {
      const existing = await col.find({}).sort({ publishedAt: -1 }).limit(5000)
        .project({ titleHash: 1 }).toArray();
      for (const e of existing) existingHashes.add(e.titleHash);
    } catch {}

    articlesToProcess = recentArticles.filter(a => {
      const hash = normalizeTitle(a.title);
      return !existingHashes.has(hash);
    });
    console.log(`[funding-scan] ${articlesToProcess.length} new articles to process (${recentArticles.length - articlesToProcess.length} already in DB)`);
  }

  // Limit
  if (LIMIT > 0 && articlesToProcess.length > LIMIT) {
    articlesToProcess = articlesToProcess.slice(0, LIMIT);
    console.log(`[funding-scan] Limited to ${LIMIT} articles`);
  }

  // Step 3: Extract funding data via LLM
  let extracted = 0;
  let skipped = 0;
  let written = 0;

  for (let i = 0; i < articlesToProcess.length; i++) {
    const article = articlesToProcess[i];
    const pct = ((i / articlesToProcess.length) * 100).toFixed(0);
    process.stdout.write(`\r  [${pct}%] Processing ${i + 1}/${articlesToProcess.length}...`);

    const data = await extractFundingData(article, apiKey);

    if (!data) {
      skipped++;
      await sleep(10000); // Groq free tier rate limit
      continue;
    }

    extracted++;

    const doc = {
      titleHash: normalizeTitle(article.title),
      title: article.title,
      snippet: article.snippet,
      url: article.url,
      source: article.source,
      sourceName: article.sourceName || '',
      imageUrl: article.imageUrl || '',
      publishedAt: article.pubDate ? new Date(article.pubDate) : new Date(),
      companyName: data.companyName,
      amount: data.amount,
      amountUSD: data.amountUSD,
      round: data.round,
      investors: data.investors,
      sector: data.sector,
      country: data.country,
      summary: data.summary,
      confidence: data.confidence,
      fetchedAt: new Date(),
    };

    if (DRY_RUN) {
      console.log(`\n  [DRY] ${data.companyName} | ${data.round || '?'} | ${data.amount || '?'} | ${data.sector || '?'}`);
      if (data.investors.length) console.log(`        Investors: ${data.investors.join(', ')}`);
    } else {
      try {
        await col.updateOne(
          { titleHash: doc.titleHash },
          { $set: doc, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
        written++;
      } catch (err) {
        if (err.code !== 11000) {
          console.warn(`\n  Write error: ${err.message}`);
        }
      }
    }

    // Groq rate limit (free tier: ~30 req/min)
    await sleep(10000);

    // Save progress periodically
    if (i % 10 === 0) {
      const progress = {
        lastRunDate: new Date().toISOString(),
        articlesProcessed: i + 1,
        totalArticles: articlesToProcess.length,
        extracted,
        skipped,
        written,
      };
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n[funding-scan] Done in ${elapsed}s`);
  console.log(`  Total articles fetched: ${allArticles.length}`);
  console.log(`  Articles processed: ${articlesToProcess.length}`);
  console.log(`  Funding news extracted: ${extracted}`);
  console.log(`  Not funding (skipped): ${skipped}`);
  console.log(`  Written to DB: ${written}`);

  // Save final progress
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    lastRunDate: new Date().toISOString(),
    totalFetched: allArticles.length,
    processed: articlesToProcess.length,
    extracted,
    skipped,
    written,
    elapsedSeconds: parseFloat(elapsed),
  }, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('[funding-scan] Fatal error:', err);
  process.exit(1);
});
