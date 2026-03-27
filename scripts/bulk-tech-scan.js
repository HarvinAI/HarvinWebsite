#!/usr/bin/env node
/**
 * Bulk Tech Stack Scanner
 * Scans all accounts in company_meta that don't have techStack data yet.
 * Tech results are saved to both company_meta.techStack and tech_cache.
 *
 * Usage:
 *   node scripts/bulk-tech-scan.js                  # scan all missing
 *   node scripts/bulk-tech-scan.js --limit 500      # scan first 500
 *   node scripts/bulk-tech-scan.js --force           # rescan all (even those with tech)
 *   node scripts/bulk-tech-scan.js --concurrency 10  # 10 parallel scans (default: 5)
 *   node scripts/bulk-tech-scan.js --resume           # resume from last progress
 */

// Load env from .env.local (Next.js convention)
const dotenvPath = require('path').join(__dirname, '..', '.env.local');
require('fs').existsSync(dotenvPath) && require('dotenv').config({ path: dotenvPath });

const { getDb } = require('../lib/scan/db');
const { scanSingleUrl } = require('../lib/scan/scan');
const { closeBrowser } = require('../lib/scan/fetch');
const fs = require('fs');
const path = require('path');

const PROGRESS_FILE = path.join(__dirname, 'bulk-tech-progress.json');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const LIMIT = parseInt(getArg('limit') || '0', 10);        // 0 = no limit
const CONCURRENCY = parseInt(getArg('concurrency') || '5', 10);
const FORCE = hasFlag('force');
const RESUME = hasFlag('resume');
const DRY_RUN = hasFlag('dry-run');

let stats = { total: 0, scanned: 0, skipped: 0, failed: 0, alreadyHasTech: 0 };
let startTime = Date.now();

function saveProgress(index) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ index, stats, timestamp: new Date().toISOString() }));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function formatElapsed() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

async function scanDomain(domain) {
  try {
    await scanSingleUrl(`https://${domain}`, { forceRefresh: false });
    return 'ok';
  } catch (err) {
    // Retry once with www
    try {
      await scanSingleUrl(`https://www.${domain}`, { forceRefresh: false });
      return 'ok';
    } catch {
      return 'fail';
    }
  }
}

async function main() {
  const db = await getDb();
  const col = db.collection('company_meta');

  // Get domains to scan
  const query = FORCE
    ? {}
    : { $or: [
        { techStack: { $exists: false } },
        { techStack: { $size: 0 } },
        { techStack: null },
        { techCount: { $exists: false } },
        { techCount: 0 },
        { techCount: null },
      ]};

  const totalCount = await col.countDocuments(query);
  console.log(`\n🔍 Found ${totalCount} accounts ${FORCE ? '(force rescan all)' : 'without tech data'}`);

  if (totalCount === 0) {
    console.log('✅ All accounts already have tech data!');
    process.exit(0);
  }

  // Note: skip sort to avoid exceeding Atlas 32MB sort memory limit on 50k+ docs
  const cursor = col.find(query)
    .project({ normalizedDomain: 1, _id: 0 });

  const domains = (await cursor.toArray()).map(d => d.normalizedDomain);

  let startIndex = 0;
  if (RESUME) {
    const progress = loadProgress();
    if (progress) {
      startIndex = progress.index;
      stats = progress.stats;
      console.log(`📌 Resuming from index ${startIndex} (${stats.scanned} already scanned)`);
    }
  }

  const toScan = LIMIT > 0 ? domains.slice(startIndex, startIndex + LIMIT) : domains.slice(startIndex);
  stats.total = toScan.length;

  console.log(`📊 Will scan ${toScan.length} domains (concurrency: ${CONCURRENCY})`);
  if (DRY_RUN) {
    console.log('🏃 DRY RUN — listing first 20:');
    toScan.slice(0, 20).forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
    process.exit(0);
  }

  console.log(`⏱️  Starting scan...\n`);
  startTime = Date.now();

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toScan.length; i += CONCURRENCY) {
    const batch = toScan.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (domain) => {
        const result = await scanDomain(domain);
        return { domain, result };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.result === 'ok') {
          stats.scanned++;
        } else {
          stats.failed++;
        }
      } else {
        stats.failed++;
      }
    }

    // Progress log every batch
    const pct = ((i + batch.length) / toScan.length * 100).toFixed(1);
    const rate = (stats.scanned / ((Date.now() - startTime) / 1000)).toFixed(1);
    const eta = rate > 0 ? Math.ceil((toScan.length - i - batch.length) / rate / 60) : '?';

    process.stdout.write(
      `\r  [${pct}%] ${stats.scanned} scanned, ${stats.failed} failed | ${formatElapsed()} elapsed | ${rate}/s | ETA: ${eta}m    `
    );

    // Save progress every 10 batches
    if ((i / CONCURRENCY) % 10 === 0) {
      saveProgress(startIndex + i + batch.length);
    }

    // Small delay between batches to avoid overwhelming servers
    if (i + CONCURRENCY < toScan.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  saveProgress(startIndex + toScan.length);

  console.log(`\n\n✅ Bulk tech scan complete!`);
  console.log(`   Scanned: ${stats.scanned}`);
  console.log(`   Failed:  ${stats.failed}`);
  console.log(`   Time:    ${formatElapsed()}`);

  // Verify results
  const withTech = await col.countDocuments({ techStack: { $exists: true, $not: { $size: 0 } }, techCount: { $gt: 0 } });
  const totalAccounts = await col.countDocuments({});
  console.log(`\n📊 DB Status: ${withTech}/${totalAccounts} accounts now have tech data (${(withTech/totalAccounts*100).toFixed(1)}%)`);

  await closeBrowser();
  process.exit(0);
}

// Handle crashes gracefully
process.on('uncaughtException', async (err) => {
  console.error('\n❌ Crash:', err.message);
  saveProgress(stats.scanned);
  await closeBrowser();
  console.log('💾 Progress saved. Run with --resume to continue.');
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n\n⏸️  Interrupted. Saving progress...');
  saveProgress(stats.scanned);
  await closeBrowser();
  console.log('💾 Run with --resume to continue.');
  process.exit(0);
});

main().catch(err => {
  console.error('Fatal error:', err);
  saveProgress(stats.scanned);
  process.exit(1);
});
