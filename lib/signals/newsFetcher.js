const https = require('https');
const http = require('http');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Track GNews usage to stay within daily limit
let gnewsCallsToday = 0;
let gnewsResetDate = new Date().toDateString();
const GNEWS_DAILY_LIMIT = 90; // keep 10 buffer from 100 limit

/**
 * Multi-source news fetcher — uses free sources in priority order:
 * 1. GNews.io API (if key set — 100 req/day free, used sparingly)
 * 2. Google News RSS (free, rate limited)
 * 3. Bing News RSS (free fallback)
 *
 * @param {string} brandName
 * @param {string} domain
 * @param {object} options
 * @param {boolean} options.useGNews - whether to use the GNews API (for high-priority brands)
 * @returns {Promise<Array<{title: string, snippet: string, url: string, pubDate: string, source: string}>>}
 */
async function fetchNews(brandName, domain, { useGNews = false } = {}) {
  const articles = [];

  // Reset daily counter
  const today = new Date().toDateString();
  if (today !== gnewsResetDate) { gnewsCallsToday = 0; gnewsResetDate = today; }

  // Source 1: GNews.io (only for high-priority brands, within daily limit)
  const gnewsKey = process.env.GNEWS_API_KEY;
  if (gnewsKey && useGNews && gnewsCallsToday < GNEWS_DAILY_LIMIT) {
    try {
      const gnewsArticles = await fetchGNews(brandName, gnewsKey);
      gnewsCallsToday++;
      articles.push(...gnewsArticles);
    } catch (err) {
      console.warn(`[newsFetcher] GNews failed for ${brandName}:`, err.message);
    }
  }

  // Source 2: Google News RSS (always try)
  try {
    const googleArticles = await fetchGoogleNewsRSS(brandName);
    // Dedup by title
    const existing = new Set(articles.map(a => a.title.toLowerCase().slice(0, 50)));
    for (const a of googleArticles) {
      if (!existing.has(a.title.toLowerCase().slice(0, 50))) {
        articles.push(a);
        existing.add(a.title.toLowerCase().slice(0, 50));
      }
    }
  } catch (err) {
    console.warn(`[newsFetcher] Google RSS failed for ${brandName}:`, err.message);
  }

  // Source 3: Bing News RSS (fallback if we have < 5 articles)
  if (articles.length < 5) {
    try {
      const bingArticles = await fetchBingNewsRSS(brandName);
      const existing = new Set(articles.map(a => a.title.toLowerCase().slice(0, 50)));
      for (const a of bingArticles) {
        if (!existing.has(a.title.toLowerCase().slice(0, 50))) {
          articles.push(a);
          existing.add(a.title.toLowerCase().slice(0, 50));
        }
      }
    } catch (err) {
      console.warn(`[newsFetcher] Bing RSS failed for ${brandName}:`, err.message);
    }
  }

  return articles;
}

/**
 * Batch fetch news for multiple brands.
 * @param {Array<{domain: string, brandName: string, tier?: number}>} brands
 * @returns {Promise<Array<{domain: string, brandName: string, articles: Array}>>}
 */
async function fetchNewsBatch(brands) {
  const results = [];

  for (const { domain, brandName, tier } of brands) {
    // Use GNews API only for tier 1 (previous signals) and tier 2 (high traffic)
    const useGNews = (tier || 3) <= 2;
    const articles = await fetchNews(brandName, domain, { useGNews });
    results.push({ domain, brandName, articles });
    // Rate limit between brands
    await sleep(500);
  }

  return results;
}

// ── GNews.io API ─────────────────────────────────────────────────────────
// Free tier: 100 requests/day, 10 articles/request
// https://gnews.io/docs/v4

async function fetchGNews(brandName, apiKey) {
  const q = encodeURIComponent(`"${brandName}" AND (funding OR raised OR series OR hires OR appoints OR CTO OR VP)`);
  const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=10&apikey=${apiKey}`;

  const data = await httpGetJSON(url);
  if (!data || !data.articles) return [];

  return data.articles.map(a => ({
    title: a.title || '',
    snippet: a.description || '',
    url: a.url || '',
    pubDate: a.publishedAt || '',
    source: 'gnews',
  }));
}

// ── Google News RSS ──────────────────────────────────────────────────────

async function fetchGoogleNewsRSS(brandName) {
  const q = encodeURIComponent(
    `"${brandName}" funding OR raised OR series OR appoints OR hires OR CTO OR VP`
  );
  const url = `https://news.google.com/rss/search?q=${q}&hl=en&gl=IN&ceid=IN:en`;

  const xml = await httpGet(url);
  return parseRSSItems(xml).map(a => ({ ...a, source: 'google_news' }));
}

// ── Bing News RSS ────────────────────────────────────────────────────────

async function fetchBingNewsRSS(brandName) {
  const q = encodeURIComponent(`"${brandName}" funding OR hiring OR series OR CTO`);
  const url = `https://www.bing.com/news/search?q=${q}&format=rss`;

  const xml = await httpGet(url);
  return parseRSSItems(xml).map(a => ({ ...a, source: 'bing_news' }));
}

// ── HTTP helpers ─────────────────────────────────────────────────────────

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

function httpGetJSON(url, timeout = 10000) {
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

// ── RSS parser ───────────────────────────────────────────────────────────

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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '');
}

module.exports = { fetchNews, fetchNewsBatch };
