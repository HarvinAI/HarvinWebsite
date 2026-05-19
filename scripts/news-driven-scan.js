#!/usr/bin/env node

/**
 * News-Driven D2C Market-News Scanner — CLI wrapper.
 *
 * The pipeline lives in `lib/signals/newsDrivenScan.js` and is shared with
 * the admin API route (`app/api/admin/news-scan/route.ts`). This script just
 * wires CLI flags, loads .env.local, and prints a summary.
 *
 * Usage:
 *   node scripts/news-driven-scan.js                       # full run
 *   node scripts/news-driven-scan.js --dry-run             # no DB writes
 *   node scripts/news-driven-scan.js --limit-queries 5     # first N broad queries
 *   node scripts/news-driven-scan.js --query "…"           # single ad-hoc query
 *   node scripts/news-driven-scan.js --no-feeds            # skip publisher RSS feeds
 *   node scripts/news-driven-scan.js --queries-only        # list sources and exit
 *   node scripts/news-driven-scan.js --verbose             # per-article logs
 */

const path = require('path');
const fs = require('fs');

// Load .env.local
try {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i === -1) continue;
    const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const { getDb } = require('../lib/scan/db');
const { runNewsDrivenScan, BROAD_QUERIES, PUBLISHER_FEEDS } = require('../lib/signals/newsDrivenScan');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const QUERIES_ONLY = args.includes('--queries-only');
const NO_FEEDS = args.includes('--no-feeds');
const limitIdx = args.indexOf('--limit-queries');
const LIMIT_QUERIES = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;
const queryIdx = args.indexOf('--query');
const SINGLE_QUERY = queryIdx !== -1 ? args[queryIdx + 1] : null;
const topIdx = args.indexOf('--top-brands');
const TOP_BRANDS = topIdx !== -1 ? parseInt(args[topIdx + 1], 10) : 0;

const PROGRESS_FILE = path.resolve(__dirname, 'news-driven-progress.json');

async function main() {
  const queries = SINGLE_QUERY
    ? [SINGLE_QUERY]
    : LIMIT_QUERIES > 0
      ? BROAD_QUERIES.slice(0, LIMIT_QUERIES)
      : BROAD_QUERIES;
  const publisherFeeds = NO_FEEDS || SINGLE_QUERY ? [] : PUBLISHER_FEEDS;

  if (QUERIES_ONLY) {
    console.log(`\n[news-driven] ${queries.length} broad queries + ${publisherFeeds.length} publisher feeds:`);
    for (const q of queries) console.log(`  query  ${q}`);
    for (const f of publisherFeeds) console.log(`  feed   ${f.name}  (${f.url})`);
    console.log();
    process.exit(0);
  }

  console.log(`\n[news-driven] D2C Market-News Scanner`);
  console.log(`[news-driven] ${queries.length} broad queries + ${publisherFeeds.length} publisher feeds${DRY_RUN ? '  (DRY RUN)' : ''}\n`);

  const db = await getDb();
  const stats = await runNewsDrivenScan({
    db,
    queries,
    publisherFeeds,
    dryRun: DRY_RUN,
    verbose: VERBOSE,
    brandLimit: TOP_BRANDS,
    log: (line) => console.log(line),
  });

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  NEWS-DRIVEN D2C SCAN REPORT${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  Sources run:           ${stats.sourcesRun}`);
  console.log(`  Articles fetched:      ${stats.totalArticles}`);
  console.log(`  Articles matched:      ${stats.totalMatched}`);
  console.log(`  News extracted:        ${stats.totalExtracted}`);
  console.log(`  Skipped (not news):    ${stats.totalSkippedNotRelevant}`);
  console.log(`  Skipped (bucket dup):  ${stats.totalSkippedBucketDup}`);
  console.log(`  Subject not in catalog:${stats.totalSkippedNoBrand}  →  discovered: ${stats.totalDiscovered}, written: ${stats.totalDiscoveredWritten}`);
  console.log(`  Written to market_news:${stats.totalWritten}`);
  console.log(`  Brands with new news:  ${stats.brandsHit}`);
  console.log(`  Elapsed:               ${stats.elapsedSeconds}s`);

  if (Object.keys(stats.typeCounts).length) {
    console.log(`\n  By news type:`);
    for (const [t, c] of Object.entries(stats.typeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(c).padStart(5)}  ${t}`);
    }
  }
  if (stats.brandsHit > 0) {
    console.log(`\n  Top brands with most matches (catalog):`);
    const top = Object.entries(stats.brandHits).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [d, c] of top) console.log(`    ${String(c).padStart(5)}  ${d}`);
  }
  if (Object.keys(stats.discoveredHits).length > 0) {
    console.log(`\n  Top discovered brands (NOT in catalog — review for adding):`);
    const top = Object.entries(stats.discoveredHits).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [norm, c] of top) console.log(`    ${String(c).padStart(5)}  ${norm}`);
  }
  console.log(`\n${'═'.repeat(60)}\n`);

  if (!DRY_RUN) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
      status: 'completed',
      lastRunDate: new Date().toISOString(),
      ...stats,
    }, null, 2));
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[news-driven] Fatal error:', err);
  process.exit(1);
});
