#!/usr/bin/env node

/**
 * Daily signal scanner — fetches news from Google News RSS,
 * extracts funding & hiring signals via Groq LLM, writes to MongoDB.
 *
 * Usage:
 *   node scripts/signal-news-scan.js                    # full run (top 5000)
 *   node scripts/signal-news-scan.js --limit 50         # process 50 domains
 *   node scripts/signal-news-scan.js --dry-run          # extract but don't write to DB
 *   node scripts/signal-news-scan.js --domain nykaa.com # single domain
 */

const path = require('path');
const fs = require('fs');

// Load .env.local manually (no dotenv dependency)
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
} catch {
  // .env.local not found — rely on environment variables
}

const { getDb } = require('../lib/scan/db');
const { fetchBatchNewsRSS } = require('../lib/signals/newsRSS');
const { extractSignal, signalExists } = require('../lib/signals/groqExtractor');
const { scoreAllDomains } = require('../lib/signals/scorer');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 5000;
const domainIdx = args.indexOf('--domain');
const SINGLE_DOMAIN = domainIdx !== -1 ? args[domainIdx + 1] : null;

const BATCH_SIZE = 10; // brands per RSS query
const PROGRESS_FILE = path.resolve(__dirname, 'signal-progress.json');

/**
 * Extract brand name from domain: strip TLD, capitalize.
 * e.g. mamaearth.in → Mamaearth, boat-lifestyle.com → Boat Lifestyle
 */
function domainToBrand(domain) {
  const name = domain
    .replace(/^www\d*\./, '')
    .replace(/\.(com|in|co|io|net|org|co\.in|com\.au|co\.uk)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return name;
}

/**
 * Load progress to resume from where we left off.
 */
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { lastProcessedIndex: 0, lastRunDate: null };
  }
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  const startTime = Date.now();
  console.log(`[signal-scan] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const db = await getDb();
  const metaCol = db.collection('company_meta');
  const signalsCol = db.collection('signals');

  // Ensure indexes (fire-and-forget)
  if (!DRY_RUN) {
    signalsCol.createIndex({ domain: 1, signalType: 1, detectedAt: -1 }).catch(() => {});
    signalsCol.createIndex({ signalType: 1, detectedAt: -1 }).catch(() => {});
    signalsCol.createIndex({ detectedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }).catch(() => {});
    signalsCol.createIndex({ domain: 1, headline: 1 }, { unique: true }).catch(() => {});

    const scoresCol = db.collection('signal_scores');
    scoresCol.createIndex({ domain: 1 }, { unique: true }).catch(() => {});
    scoresCol.createIndex({ recommended: 1, totalScore: -1 }).catch(() => {});
  }

  // Get domains to process
  let domains;
  if (SINGLE_DOMAIN) {
    domains = [{ normalizedDomain: SINGLE_DOMAIN }];
  } else {
    domains = await metaCol.find(
      { category: { $exists: true, $nin: [null, ''] } }
    )
      .sort({ monthlyVisits: -1 })
      .project({ normalizedDomain: 1 })
      .limit(LIMIT)
      .toArray();
  }

  console.log(`[signal-scan] Processing ${domains.length} domains`);

  const brands = domains.map(d => ({
    domain: d.normalizedDomain,
    brandName: domainToBrand(d.normalizedDomain),
  }));

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('[signal-scan] GROQ_API_KEY not set — cannot extract signals');
    process.exit(1);
  }

  let totalArticles = 0;
  let totalSignals = 0;
  let totalSkipped = 0;
  const domainsWithNewSignals = new Set();

  // Process in batches
  for (let i = 0; i < brands.length; i += BATCH_SIZE) {
    const batch = brands.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(brands.length / BATCH_SIZE);

    console.log(`[signal-scan] Batch ${batchNum}/${totalBatches}: ${batch.map(b => b.brandName).join(', ')}`);

    // Fetch RSS for batch
    const rssResults = await fetchBatchNewsRSS(batch);

    // Rate limit between batches
    await sleep(1000);

    // Process each brand's articles
    for (const result of rssResults) {
      if (result.articles.length === 0) continue;
      totalArticles += result.articles.length;

      for (const article of result.articles) {
        // Check dedup
        if (!DRY_RUN) {
          const exists = await signalExists(db, result.domain, article.title);
          if (exists) {
            totalSkipped++;
            continue;
          }
        }

        // Skip old articles (older than 90 days)
        if (article.pubDate) {
          const articleDate = new Date(article.pubDate);
          const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          if (articleDate < ninetyDaysAgo) {
            continue;
          }
        }

        // Extract signal via LLM
        const signal = await extractSignal(article, result.brandName, apiKey);
        if (!signal || !signal.signalType) continue;

        const signalDoc = {
          domain: result.domain,
          signalType: signal.signalType,
          headline: article.title,
          details: {
            amount: signal.amount,
            round: signal.round,
            investors: signal.investors,
            person: signal.person,
            title: signal.title,
          },
          source: 'google_news',
          sourceUrl: article.url,
          confidence: signal.confidence,
          detectedAt: new Date(),
          signalDate: article.pubDate ? new Date(article.pubDate) : new Date(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        };

        if (DRY_RUN) {
          console.log(`  [DRY] ${result.domain} | ${signal.signalType} | ${article.title}`);
          if (signal.amount) console.log(`        Amount: ${signal.amount}, Round: ${signal.round}`);
          if (signal.person) console.log(`        Person: ${signal.person}, Title: ${signal.title}`);
        } else {
          try {
            await signalsCol.updateOne(
              { domain: result.domain, headline: article.title },
              { $set: signalDoc, $setOnInsert: { createdAt: new Date() } },
              { upsert: true }
            );
            domainsWithNewSignals.add(result.domain);
          } catch (err) {
            // Duplicate key error is fine (concurrent dedup)
            if (err.code !== 11000) {
              console.warn(`[signal-scan] write error: ${err.message}`);
            }
          }
        }
        totalSignals++;
      }
    }

    // Save progress
    saveProgress({
      lastProcessedIndex: i + BATCH_SIZE,
      lastRunDate: new Date().toISOString(),
      totalArticles,
      totalSignals,
    });
  }

  // Run scorer for domains with new signals
  if (!DRY_RUN && domainsWithNewSignals.size > 0) {
    console.log(`[signal-scan] Scoring ${domainsWithNewSignals.size} domains with new signals...`);
    await scoreAllDomains(db, [...domainsWithNewSignals]);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[signal-scan] Done in ${elapsed}s`);
  console.log(`  Articles found: ${totalArticles}`);
  console.log(`  Signals extracted: ${totalSignals}`);
  console.log(`  Skipped (dedup): ${totalSkipped}`);
  console.log(`  Domains with new signals: ${domainsWithNewSignals.size}`);

  process.exit(0);
}

main().catch(err => {
  console.error('[signal-scan] Fatal error:', err);
  process.exit(1);
});
