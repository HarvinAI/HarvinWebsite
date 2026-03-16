const https = require('https');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Fetch Google News RSS for a set of brand names.
 * Rate-limits to 1 request per second.
 *
 * @param {Array<{domain: string, brandName: string}>} brands
 * @returns {Promise<Array<{domain: string, articles: Array<{title: string, snippet: string, url: string, pubDate: string}>}>>}
 */
async function fetchNewsRSS(brands) {
  const results = [];

  for (const { domain, brandName } of brands) {
    const q = encodeURIComponent(
      `"${brandName}" funding OR raised OR series OR appoints OR hires OR CTO OR VP`
    );
    const url = `https://news.google.com/rss/search?q=${q}&hl=en&gl=IN&ceid=IN:en`;

    try {
      const xml = await httpGet(url);
      const articles = parseRSSItems(xml);
      results.push({ domain, articles });
    } catch (err) {
      console.warn(`[newsRSS] failed for ${brandName}: ${err.message}`);
      results.push({ domain, articles: [] });
    }

    // Rate limit: 1 req/sec
    await sleep(1000);
  }

  return results;
}

/**
 * Fetch Google News RSS for a batch of brand names in a single query (up to 10).
 * Returns articles with the matched brand info.
 *
 * @param {Array<{domain: string, brandName: string}>} batch - up to 10 brands
 * @returns {Promise<Array<{domain: string, brandName: string, articles: Array<{title: string, snippet: string, url: string, pubDate: string}>}>>}
 */
async function fetchBatchNewsRSS(batch) {
  if (batch.length === 0) return [];

  // Build OR query: "Brand1" OR "Brand2" OR ... + signal keywords
  const brandParts = batch.map(b => `"${b.brandName}"`).join(' OR ');
  const q = encodeURIComponent(
    `(${brandParts}) (funding OR raised OR series OR appoints OR hires OR CTO OR VP)`
  );
  const url = `https://news.google.com/rss/search?q=${q}&hl=en&gl=IN&ceid=IN:en`;

  let allArticles = [];
  try {
    const xml = await httpGet(url);
    allArticles = parseRSSItems(xml);
  } catch (err) {
    console.warn(`[newsRSS] batch fetch failed: ${err.message}`);
    return batch.map(b => ({ domain: b.domain, brandName: b.brandName, articles: [] }));
  }

  // Match articles to brands by checking if brand name appears in title or snippet
  const results = batch.map(b => {
    const nameLower = b.brandName.toLowerCase();
    const matched = allArticles.filter(a =>
      a.title.toLowerCase().includes(nameLower) ||
      a.snippet.toLowerCase().includes(nameLower)
    );
    return { domain: b.domain, brandName: b.brandName, articles: matched };
  });

  return results;
}

/**
 * Simple HTTPS GET that returns the response body as a string.
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location).then(resolve).catch(reject);
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

/**
 * Parse RSS XML items using regex (no external dependency).
 * Extracts title, description (snippet), link, and pubDate from each <item>.
 */
function parseRSSItems(xml) {
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

/**
 * Extract text content of an XML tag.
 */
function extractTag(xml, tag) {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = regex.exec(xml);
  return m ? m[1].trim() : '';
}

/**
 * Decode basic HTML entities.
 */
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ''); // strip any HTML tags in description
}

module.exports = { fetchNewsRSS, fetchBatchNewsRSS };
