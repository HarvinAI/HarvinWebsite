#!/usr/bin/env node

/**
 * Backfill app presence for all domains in company_meta.
 * Fetches each website and detects App Store / Play Store links.
 *
 * Usage:
 *   node scripts/backfill-app-presence.js              # full run
 *   node scripts/backfill-app-presence.js --limit 100  # process 100 domains
 *   node scripts/backfill-app-presence.js --dry-run    # detect without writing
 *   node scripts/backfill-app-presence.js --skip-existing  # skip domains that already have appPresence
 */

const path = require('path');
const fs = require('fs');

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
} catch {
  console.warn('[env] Could not load .env.local');
}

const { getDb } = require('../lib/scan/db');
const { detectAppPresence } = require('../lib/scan/appPresence');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_EXISTING = args.includes('--skip-existing');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;

const CONCURRENCY = 5;
const PROGRESS_FILE = path.resolve(__dirname, 'app-presence-progress.json');

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { lastIndex: 0 };
  }
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  const startTime = Date.now();
  console.log(`[app-presence] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const db = await getDb();
  const col = db.collection('company_meta');

  // Build query
  const query = {
    category: { $exists: true, $nin: [null, ''] },
  };
  if (SKIP_EXISTING) {
    query.appPresence = { $in: [null, ''], };
    query.$or = [
      { appPresence: { $in: [null, ''] } },
      { appPresence: { $exists: false } },
    ];
    delete query.appPresence;
  }

  const domains = await col.find(SKIP_EXISTING ? {
    category: { $exists: true, $nin: [null, ''] },
    $or: [
      { appPresence: { $in: [null, ''] } },
      { appPresence: { $exists: false } },
    ],
  } : {
    category: { $exists: true, $nin: [null, ''] },
  })
    .sort({ monthlyVisits: -1 })
    .project({ normalizedDomain: 1 })
    .limit(LIMIT || 0)
    .toArray();

  console.log(`[app-presence] Processing ${domains.length} domains (concurrency: ${CONCURRENCY})`);

  let processed = 0;
  let updated = 0;
  let errors = 0;
  const stats = { 'Both iOS & Android': 0, 'iOS Only': 0, 'Android Only': 0, 'No App': 0 };

  // Process in batches
  for (let i = 0; i < domains.length; i += CONCURRENCY) {
    const batch = domains.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (doc) => {
        const domain = doc.normalizedDomain;
        try {
          const result = await detectAppPresence(domain);
          return { domain, ...result };
        } catch (err) {
          return { domain, appPresence: 'No App', iosUrl: null, androidUrl: null, error: err.message };
        }
      })
    );

    for (const r of results) {
      processed++;
      if (r.status === 'rejected') {
        errors++;
        continue;
      }
      const { domain, appPresence, iosUrl, androidUrl, error } = r.value;

      if (error) {
        errors++;
        continue;
      }

      stats[appPresence] = (stats[appPresence] || 0) + 1;

      if (appPresence !== 'No App') {
        console.log(`  ${domain} → ${appPresence}${iosUrl ? ` [iOS: ${iosUrl.substring(0, 60)}]` : ''}${androidUrl ? ` [Android: ${androidUrl.substring(0, 60)}]` : ''}`);
      }

      if (!DRY_RUN) {
        try {
          await col.updateOne(
            { normalizedDomain: domain },
            {
              $set: {
                appPresence,
                ...(iosUrl ? { iosAppUrl: iosUrl } : {}),
                ...(androidUrl ? { androidAppUrl: androidUrl } : {}),
              },
            }
          );
          updated++;
        } catch (err) {
          console.warn(`  [error] ${domain}: ${err.message}`);
        }
      }
    }

    // Progress log
    if (processed % 50 === 0 || i + CONCURRENCY >= domains.length) {
      const pct = ((processed / domains.length) * 100).toFixed(1);
      console.log(`[app-presence] ${processed}/${domains.length} (${pct}%) — iOS: ${stats['iOS Only'] + stats['Both iOS & Android']}, Android: ${stats['Android Only'] + stats['Both iOS & Android']}, Both: ${stats['Both iOS & Android']}, No App: ${stats['No App']}`);
      saveProgress({ lastIndex: i + CONCURRENCY, processed, updated, stats });
    }

    // Small delay between batches to be polite
    await sleep(200);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[app-presence] Done in ${elapsed}s`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Results:`, stats);

  process.exit(0);
}

main().catch(err => {
  console.error('[app-presence] Fatal error:', err);
  process.exit(1);
});
