/**
 * News-Driven D2C Market-News Scan — shared implementation used by both the
 * CLI (`scripts/news-driven-scan.js`) and the admin API route
 * (`app/api/admin/news-scan/route.ts`).
 *
 * Pipeline:
 *   broad Google News queries + publisher RSS feeds
 *     → parse RSS items
 *     → extractMarketNews (regex)
 *     → cleanSubject (strip "Indian D2C nutrition brand …" preamble)
 *     → look up subject in company_meta brand index
 *         · match  → upsert into market_news  (deduped per brand/newsType/14d)
 *         · no match → upsert into discovered_brands
 */

const https = require('https');
const http = require('http');
const { extractMarketNews } = require('./regexExtractor');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Query set ────────────────────────────────────────────────────────────
// Each entry runs through Google News RSS with India locale (gl=IN&ceid=IN:en).
// The regex extractor classifies the resulting article into one of:
//   funding | hiring | acquisition | launch | shutdown | partnership |
//   expansion | regulatory

const BROAD_QUERIES = [
  // Funding (highest signal value)
  'Indian D2C startup funding',
  'India D2C brand raises',
  '"D2C" India funding round',
  'Indian consumer brand raises series',
  'Indian startup seed funding D2C',
  'India direct-to-consumer brand investment',
  'Indian D2C funding crore',
  'Indian D2C funding million',
  // Category-anchored funding
  'India beauty brand raises funding',
  'India skincare brand raises funding',
  'India personal care startup raises',
  'India fashion D2C brand raises',
  'India apparel brand raises funding',
  'India food brand raises funding',
  'India snacks brand raises funding',
  'India beverage brand raises funding',
  'India wellness brand raises funding',
  'India fitness brand raises funding',
  'India home decor brand raises funding',
  'India kitchen brand raises funding',
  'India pet care brand raises funding',
  'India baby brand raises funding',
  'India toys brand raises funding',
  'India electronics D2C brand raises',
  'India jewellery brand raises funding',
  'India eyewear brand raises funding',
  'India footwear brand raises funding',
  // M&A and exits
  'Indian D2C brand acquired',
  'Indian consumer brand acquisition',
  'Indian D2C IPO',
  'Indian D2C merger',
  'Indian consumer brand IPO files',
  // Hiring / leadership changes
  'Indian D2C brand appoints CEO',
  'Indian D2C startup hires CTO',
  'Indian consumer brand new CEO',
  'Indian D2C brand new CMO',
  'Indian D2C brand appoints CFO',
  'Indian D2C brand head of marketing',
  'Indian consumer brand VP appointment',
  'Indian D2C founder steps down',
  'Indian D2C brand leadership change',
  // Hiring drives / open roles
  'Indian D2C brand hiring spree',
  'Indian D2C startup hiring drive',
  'Indian D2C brand plans to hire',
  // Layoffs / firings / shutdowns
  'Indian D2C startup layoffs',
  'Indian D2C brand fires employees',
  'Indian D2C startup shuts down',
  'Indian D2C brand closes operations',
  'Indian consumer brand layoffs',
  'Indian D2C startup bankruptcy',
  // Store openings / offline expansion
  'Indian D2C brand opens store',
  'Indian D2C brand offline retail',
  'Indian D2C brand new outlet',
  'Indian D2C brand expansion stores',
  'Indian D2C brand experience centre',
  'Indian consumer brand physical retail',
  'Indian D2C brand tier-2 cities',
  // Product launches / category expansion
  'Indian D2C brand launches product',
  'Indian D2C brand new product line',
  'Indian D2C brand unveils',
  'Indian D2C brand launches app',
  'Indian D2C brand international launch',
  'Indian D2C brand enters US market',
  // Partnerships / collaborations
  'Indian D2C brand partners with',
  'Indian D2C brand collaboration',
  'Indian D2C brand ties up',
  'Indian D2C brand MoU',
  // Regulatory / compliance
  'Indian D2C brand FSSAI',
  'Indian D2C brand BIS approval',
  'CCPA notice D2C brand',
  'Indian consumer brand recall',
  'Indian D2C brand regulatory action',
];

// Publisher-direct RSS feeds. These give 10–30 D2C-dense items each per fetch,
// catching news that Google News indexed too sparsely. Only feeds we've
// verified return XML are listed — add more here as they're confirmed.
const PUBLISHER_FEEDS = [
  { name: 'Inc42 buzz', url: 'https://inc42.com/buzz/feed/' },
  { name: 'YourStory',  url: 'https://yourstory.com/feed' },
];

// ── Brand-name guards ────────────────────────────────────────────────────

const BRAND_DENYLIST = new Set([
  'undefined', 'null', 'nan', 'none',
  'india', 'china', 'usa', 'america', 'europe', 'asia', 'global', 'world',
  'bharat', 'delhi', 'mumbai', 'bangalore', 'bengaluru', 'chennai', 'kolkata',
  'hyderabad', 'pune', 'noida', 'gurgaon', 'gurugram',
  'best', 'good', 'home', 'life', 'live', 'love', 'mama', 'plus', 'star',
  'shop', 'store', 'club', 'tech', 'brand', 'group',
  'company', 'studio', 'works', 'house', 'farm', 'crew', 'kids',
  'wear', 'edge', 'mind', 'body', 'glow', 'pure', 'wild', 'true', 'main',
  'next', 'time', 'spot', 'fast', 'high', 'real', 'open', 'gold', 'soul',
  'self', 'team', 'plan', 'food', 'care', 'made', 'kart', 'mart', 'pick',
  'easy', 'free', 'mini', 'maxi', 'baby', 'cool', 'warm', 'fine', 'safe',
]);

function domainToBrand(domain) {
  if (!domain || typeof domain !== 'string') return '';
  return domain
    .replace(/^www\d*\./, '')
    .replace(/\.(com|in|co|io|net|org|co\.in|com\.au|co\.uk|xyz|app|club|life|store|shop|online|tech|ai)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function isValidBrandName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 4) return false;
  if (trimmed.startsWith('http')) return false;
  if (/^[\d\s]+$/.test(trimmed)) return false;
  if (BRAND_DENYLIST.has(trimmed.toLowerCase())) return false;
  return true;
}

function normalizeName(s) {
  if (!s || typeof s !== 'string') return '';
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// extractCompanyName grabs the entire headline preamble before the verb, so
// "D2C nutrition brand BeastLife Raises…" → "D2C nutrition brand BeastLife".
// Iteratively strip location / D2C / vertical / entity-type prefixes.
function cleanSubject(name) {
  if (!name || typeof name !== 'string') return '';
  let s = name.trim();
  s = s.replace(/^(?:Mumbai|Delhi|Bengaluru|Bangalore|Pune|Gurugram|Gurgaon|Chennai|Hyderabad|Noida|Kolkata|Ahmedabad|Jaipur|Kochi|Surat)[-\s]based\s+/i, '');
  let prev;
  do {
    prev = s;
    s = s.replace(/^(?:Indian|Indian's|Global|New|The|Exclusive:?)\s+/i, '');
    s = s.replace(/^(?:D2C|Direct[- ]to[- ]consumer|DTC)\s+/i, '');
    s = s.replace(/^(?:nutrition|beauty|skincare|skin\s*care|personal\s*care|fashion|apparel|food|snacks?|beverage|wellness|fitness|home\s*decor|kitchen|pet\s*care|baby|toys?|electronics|jewellery|jewelry|eyewear|footwear|fragrance|haircare|hair\s*care|grooming|fmcg|edtech|proptech|fintech|healthtech|agritech|cleantech|insurtech|gaming|mobility|logistics|consumer)\s+/i, '');
    s = s.replace(/^(?:brand|startup|company|firm|platform|app|business|venture|maker|chain)\s+/i, '');
  } while (s !== prev && s.length > 0);
  s = s.replace(/\s+(?:funding|raises|hires|appoints|launches|expands|secures|acquires)$/i, '');
  return s.trim();
}

// ── HTTP + RSS helpers ───────────────────────────────────────────────────

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
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); res.resume(); return; }
      let data = '';
      res.on('data', chunk => { data += chunk; if (data.length > 1_000_000) res.destroy(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseRSSItems(xml) {
  if (!xml) return [];
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
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
  const c = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i').exec(xml);
  if (c) return c[1].trim();
  const p = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return p ? p[1].trim() : '';
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '');
}

async function fetchGoogleNewsRSS(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=IN&ceid=IN:en`;
  const xml = await httpGet(url);
  return parseRSSItems(xml).map(a => ({ ...a, source: 'google_news' }));
}

async function fetchPublisherFeed(feed) {
  const xml = await httpGet(feed.url);
  return parseRSSItems(xml).map(a => ({ ...a, source: feed.name }));
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}

// 14-day bucket key for "one row per brand/newsType/window" dedup.
function dedupBucketKey(domain, newsType, pubDate) {
  const t = pubDate ? new Date(pubDate).getTime() : Date.now();
  const bucket = Math.floor(t / (14 * 86400000));
  return `${domain}|${newsType}|${bucket}`;
}

// ── Main entry point ─────────────────────────────────────────────────────

/**
 * Run the full news-driven scan.
 *
 * @param {object} opts
 * @param {object} opts.db        - mongodb Db handle (required)
 * @param {string[]} [opts.queries]      - override BROAD_QUERIES
 * @param {Array}   [opts.publisherFeeds] - override PUBLISHER_FEEDS
 * @param {boolean} [opts.dryRun]        - don't write to mongo
 * @param {boolean} [opts.verbose]       - log per-article details
 * @param {(line:string)=>void} [opts.log] - logger; defaults to console.log
 * @param {number}  [opts.maxAgeDays]    - reject articles older than this; default 60
 * @param {number}  [opts.brandLimit]    - restrict catalog to top-N brands by harvinScore (0 = all)
 * @param {string[]} [opts.brandDomains] - restrict catalog to these exact normalizedDomain values (takes precedence over brandLimit)
 * @returns {Promise<object>} stats summary
 */
async function runNewsDrivenScan(opts = {}) {
  const {
    db,
    queries = BROAD_QUERIES,
    publisherFeeds = PUBLISHER_FEEDS,
    dryRun = false,
    verbose = false,
    log = (line) => console.log(line),
    maxAgeDays = 60,
    brandLimit = 0,
    brandDomains = null,
  } = opts;

  if (!db) throw new Error('runNewsDrivenScan: db is required');

  const startTime = Date.now();
  const metaCol = db.collection('company_meta');
  const newsCol = db.collection('market_news');
  const discoveredCol = db.collection('discovered_brands');

  if (!dryRun) {
    newsCol.createIndex({ publishedAt: -1 }).catch(() => {});
    newsCol.createIndex({ titleHash: 1 }, { unique: true }).catch(() => {});
    newsCol.createIndex({ newsType: 1, publishedAt: -1 }).catch(() => {});
    newsCol.createIndex({ domain: 1, publishedAt: -1 }).catch(() => {});
    newsCol.createIndex({ publishedAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 }).catch(() => {});
    discoveredCol.createIndex({ normalizedName: 1 }, { unique: true }).catch(() => {});
    discoveredCol.createIndex({ status: 1, mentionCount: -1 }).catch(() => {});
    discoveredCol.createIndex({ lastSeenAt: -1 }).catch(() => {});
  }

  // Build brand index
  const useDomainList = Array.isArray(brandDomains) && brandDomains.length > 0;
  log(`[news-driven] Loading brand catalog from company_meta${
    useDomainList ? ` (${brandDomains.length} specific domains)` :
    brandLimit ? ` (top ${brandLimit} by harvinScore)` : ''}…`);
  const brandFilter = {
    category: { $nin: [null, '', 'Unknown', 'Not Required'] },
  };
  if (useDomainList) brandFilter.normalizedDomain = { $in: brandDomains };
  let brandCursor = metaCol.find(brandFilter).project({
    normalizedDomain: 1, brandName: 1, category: 1, harvinScore: 1,
  });
  if (!useDomainList && brandLimit > 0) {
    brandCursor = brandCursor.sort({ harvinScore: -1 }).limit(brandLimit);
  }
  const brandDocs = await brandCursor.toArray();

  const byNorm = new Map();
  let fellbackToDomain = 0;
  for (const b of brandDocs) {
    let resolvedName = isValidBrandName(b.brandName) ? b.brandName.trim() : null;
    if (!resolvedName) {
      const stem = domainToBrand(b.normalizedDomain);
      if (isValidBrandName(stem)) { resolvedName = stem; fellbackToDomain++; }
    }
    if (!resolvedName) continue;
    const rec = {
      domain: b.normalizedDomain,
      brandName: resolvedName,
      category: b.category,
      harvinScore: b.harvinScore || 0,
    };
    const forms = new Set([
      normalizeName(resolvedName),
      normalizeName(b.normalizedDomain.replace(/\.[a-z.]+$/i, '')),
    ]);
    for (const form of forms) {
      if (form && form.length >= 4) byNorm.set(form, rec);
    }
  }
  log(`[news-driven] Indexed ${byNorm.size} normalized keys → ${brandDocs.length} D2C records (${fellbackToDomain} via domain-stem fallback)`);

  // Preload existing dedup state:
  //  - titleHashes  → avoids writing the same article twice
  //  - bucketKeys   → "one row per brand/newsType/14d" guard
  const seenHashes = new Set();
  const seenBuckets = new Set();
  if (!dryRun) {
    try {
      const existing = await newsCol.find({}).sort({ publishedAt: -1 }).limit(50000)
        .project({ titleHash: 1, domain: 1, newsType: 1, publishedAt: 1 }).toArray();
      for (const e of existing) {
        if (e.titleHash) seenHashes.add(e.titleHash);
        if (e.domain && e.newsType) seenBuckets.add(dedupBucketKey(e.domain, e.newsType, e.publishedAt));
      }
      log(`[news-driven] Preloaded ${seenHashes.size} titleHashes, ${seenBuckets.size} (brand,type,14d) buckets`);
    } catch (e) {
      log(`[news-driven] dedup preload error: ${e.message}`);
    }
  }

  // Build the unified source list: [{kind, label, fetcher}]
  const sources = [
    ...queries.map((q) => ({ kind: 'query', label: q, fetch: () => fetchGoogleNewsRSS(q) })),
    ...publisherFeeds.map((f) => ({ kind: 'feed', label: f.name, fetch: () => fetchPublisherFeed(f) })),
  ];

  const stats = {
    sourcesRun: 0,
    totalArticles: 0,
    totalMatched: 0,
    totalExtracted: 0,
    totalWritten: 0,
    totalSkippedNoBrand: 0,
    totalSkippedNotRelevant: 0,
    totalSkippedBucketDup: 0,
    totalDiscovered: 0,
    totalDiscoveredWritten: 0,
    typeCounts: {},
    brandHits: {},
    discoveredHits: {},
  };

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    log(`\n  [${i + 1}/${sources.length}] ${src.kind === 'feed' ? 'feed: ' : ''}${src.label}`);
    let articles = [];
    try {
      articles = await src.fetch();
    } catch (err) {
      log(`    ✗ fetch failed: ${err.message}`);
      await sleep(1500);
      continue;
    }
    stats.sourcesRun++;
    stats.totalArticles += articles.length;
    log(`    ${articles.length} articles fetched`);

    let sMatched = 0;
    let sWritten = 0;

    for (const article of articles) {
      const hash = normalizeTitle(article.title);
      if (!hash) continue;

      // Age filter
      if (article.pubDate) {
        const ageDays = (Date.now() - new Date(article.pubDate).getTime()) / 86400000;
        if (ageDays > maxAgeDays) continue;
      }

      const data = extractMarketNews(article);
      if (!data) { stats.totalSkippedNotRelevant++; continue; }

      const cleanedName = cleanSubject(data.companyName);
      const subject = cleanedName ? normalizeName(cleanedName) : '';
      if (!subject || subject.length < 4 || !isValidBrandName(cleanedName)) {
        stats.totalSkippedNoBrand++;
        continue;
      }
      if (cleanedName.split(/\s+/).length > 6) {
        stats.totalSkippedNoBrand++;
        continue;
      }

      const brand = byNorm.get(subject);
      if (!brand) {
        // Discovery path
        stats.totalSkippedNoBrand++;
        stats.totalDiscovered++;
        if (!dryRun) {
          const pubAt = article.pubDate ? new Date(article.pubDate) : new Date();
          const fundingUSD = data.details?.amountUSD || 0;
          try {
            await discoveredCol.updateOne(
              { normalizedName: subject },
              {
                $setOnInsert: {
                  normalizedName: subject,
                  companyName: cleanedName,
                  status: 'pending',
                  firstSeenAt: pubAt,
                  createdAt: new Date(),
                },
                $set: {
                  lastSeenAt: pubAt,
                  latestHeadline: data.headline,
                  latestUrl: article.url,
                  latestSource: article.source,
                  latestPublishedAt: pubAt,
                  latestNewsType: data.newsType,
                  categoryHint: data.category || null,
                  country: data.country || null,
                  marketImpact: data.marketImpact,
                  updatedAt: new Date(),
                },
                $inc: {
                  mentionCount: 1,
                  [`newsTypeCounts.${data.newsType}`]: 1,
                  totalFundingUSD: fundingUSD,
                },
                $addToSet: { discoveryQueries: src.label },
              },
              { upsert: true },
            );
            stats.totalDiscoveredWritten++;
            stats.discoveredHits[subject] = (stats.discoveredHits[subject] || 0) + 1;
          } catch (err) {
            if (err.code !== 11000) log(`    Discover write error: ${err.message}`);
          }
        }
        continue;
      }

      // Brand matched. Now apply the 14d bucket dedup.
      const pubAt = article.pubDate ? new Date(article.pubDate) : new Date();
      const bucketKey = dedupBucketKey(brand.domain, data.newsType, pubAt);
      if (seenBuckets.has(bucketKey)) {
        stats.totalSkippedBucketDup++;
        continue;
      }
      seenBuckets.add(bucketKey);

      stats.totalMatched++;
      stats.totalExtracted++;
      sMatched++;
      stats.typeCounts[data.newsType] = (stats.typeCounts[data.newsType] || 0) + 1;

      const compoundHash = `${hash}__${brand.domain}`;
      if (seenHashes.has(compoundHash)) continue;
      seenHashes.add(compoundHash);
      stats.brandHits[brand.domain] = (stats.brandHits[brand.domain] || 0) + 1;

      if (verbose) {
        log(`    ${data.newsType.toUpperCase().padEnd(12)} → ${brand.brandName.padEnd(22)} ${article.title.slice(0, 70)}`);
      }

      if (dryRun) continue;

      const doc = {
        titleHash: compoundHash,
        title: article.title,
        snippet: article.snippet,
        url: article.url,
        source: article.source,
        sourceName: '',
        imageUrl: '',
        publishedAt: pubAt,
        newsType: data.newsType,
        companyName: brand.brandName,
        category: data.category || brand.category,
        headline: data.headline,
        summary: data.summary,
        country: data.country,
        marketImpact: data.marketImpact,
        confidence: data.confidence,
        details: data.details,
        domain: brand.domain,
        harvinScore: brand.harvinScore,
        discoveredVia: 'news-driven',
        discoverySource: src.label,
        fetchedAt: new Date(),
      };

      try {
        await newsCol.updateOne(
          { titleHash: compoundHash },
          { $set: doc, $setOnInsert: { createdAt: new Date() } },
          { upsert: true },
        );
        stats.totalWritten++;
        sWritten++;
      } catch (err) {
        if (err.code !== 11000) log(`    Write error: ${err.message}`);
      }
    }

    log(`    ${sMatched} matched, ${sWritten} written`);
    await sleep(1500);
  }

  stats.elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
  stats.brandsHit = Object.keys(stats.brandHits).length;
  return stats;
}

module.exports = {
  runNewsDrivenScan,
  BROAD_QUERIES,
  PUBLISHER_FEEDS,
  // Exposed for unit testing / reuse
  cleanSubject,
  normalizeName,
  isValidBrandName,
  domainToBrand,
};
