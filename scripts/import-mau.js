#!/usr/bin/env node

/**
 * Import real MAU data from a TSV file into company_meta collection.
 * File format: domain\tMAU (tab-separated, one per line)
 *
 * Usage:
 *   node scripts/import-mau.js docs/unknown-accounts.csv
 *   node scripts/import-mau.js docs/unknown-accounts.csv --dry-run
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
} catch {}

const { getDb } = require('../lib/scan/db');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const filePath = args.find(a => !a.startsWith('--'));

if (!filePath) {
  console.error('Usage: node scripts/import-mau.js <file.csv> [--dry-run]');
  process.exit(1);
}

function formatVisits(visits) {
  if (visits >= 1_000_000_000) return (visits / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (visits >= 1_000_000) return (visits / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (visits >= 1_000) return (visits / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return visits.toString();
}

function visitsToBand(visits) {
  if (visits >= 20_000_000) return '20M+';
  if (visits >= 5_000_000) return '5M-20M';
  if (visits >= 1_000_000) return '1M-5M';
  if (visits >= 500_000) return '500K-1M';
  if (visits >= 200_000) return '200K-500K';
  if (visits >= 50_000) return '50K-200K';
  return '<50K';
}

async function main() {
  const startTime = Date.now();
  console.log(`[import-mau] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  // Parse file
  const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  const mauData = [];
  let naCount = 0;
  for (const line of lines) {
    const parts = line.split('\t');
    const domain = parts[0]?.trim().toLowerCase();
    const mauStr = parts[1]?.trim();
    if (!domain) continue;
    if (mauStr === 'NA' || !mauStr) { naCount++; continue; }
    const mau = parseInt(mauStr, 10);
    if (isNaN(mau) || mau < 0) continue;
    mauData.push({ domain, mau });
  }

  console.log(`[import-mau] Parsed ${lines.length} lines: ${mauData.length} with MAU, ${naCount} NA`);

  if (DRY_RUN) {
    console.log('[import-mau] Dry run — sample:');
    mauData.slice(0, 10).forEach(d => console.log(`  ${d.domain} → ${formatVisits(d.mau)} (${visitsToBand(d.mau)})`));
    process.exit(0);
  }

  const db = await getDb();
  const col = db.collection('company_meta');

  let updated = 0, notFound = 0, errors = 0;

  // Batch update
  const BATCH = 100;
  for (let i = 0; i < mauData.length; i += BATCH) {
    const batch = mauData.slice(i, i + BATCH);

    await Promise.all(batch.map(async ({ domain, mau }) => {
      try {
        const result = await col.updateOne(
          { normalizedDomain: domain },
          {
            $set: {
              monthlyVisits: mau,
              monthlyVisitsFormatted: formatVisits(mau),
              trafficBand: visitsToBand(mau),
              trafficSource: 'real_data',
              trafficUpdatedAt: new Date(),
            },
          }
        );
        if (result.matchedCount > 0) updated++;
        else notFound++;
      } catch { errors++; }
    }));

    if ((i + BATCH) % 5000 === 0 || i + BATCH >= mauData.length) {
      const done = Math.min(i + BATCH, mauData.length);
      console.log(`[import-mau] ${done}/${mauData.length} — updated: ${updated}, not in DB: ${notFound}, errors: ${errors}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[import-mau] Done in ${elapsed}s`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Not in DB: ${notFound}`);
  console.log(`  Errors: ${errors}`);

  process.exit(0);
}

main().catch(err => {
  console.error('[import-mau] Fatal:', err);
  process.exit(1);
});
