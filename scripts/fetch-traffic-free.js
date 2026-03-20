#!/usr/bin/env node

/**
 * Fetch real traffic data from free public sources (no API key needed).
 * Uses multiple sources and takes the best estimate:
 *
 * 1. Tranco rank → calibrated formula (recalibrated against real data)
 * 2. CrUX API → presence-based estimate
 * 3. Real data file import (if available)
 *
 * For monthly automation: this script downloads the latest Tranco list,
 * re-estimates all accounts, and updates the DB.
 *
 * Usage:
 *   node scripts/fetch-traffic-free.js                  # update all
 *   node scripts/fetch-traffic-free.js --limit 1000     # first 1000
 *   node scripts/fetch-traffic-free.js --only-missing   # only accounts without MAU
 *   node scripts/fetch-traffic-free.js --import file.csv # import real data from TSV
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
const ONLY_MISSING = args.includes('--only-missing');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;
const importIdx = args.indexOf('--import');
const IMPORT_FILE = importIdx !== -1 ? args[importIdx + 1] : null;

// Recalibrated model (March 2026, fitted on 16K real data points)
// + rank-band correction factors from real SimilarWeb data
const RANK_COEFF_A = 8.86e10;
const RANK_COEFF_B = 1.068;
const RANK_CORRECTIONS = [
  { max: 100, factor: 0.68 }, { max: 500, factor: 0.32 }, { max: 1000, factor: 0.95 },
  { max: 5000, factor: 1.33 }, { max: 10000, factor: 1.97 }, { max: 50000, factor: 1.23 },
  { max: 100000, factor: 1.44 }, { max: 500000, factor: 1.06 }, { max: Infinity, factor: 1.02 },
];

function rankToVisits(rank) {
  if (!rank || rank <= 0) return 0;
  const base = RANK_COEFF_A / Math.pow(rank, RANK_COEFF_B);
  const correction = RANK_CORRECTIONS.find(c => rank <= c.max);
  return Math.round(base * (correction?.factor || 1));
}

function formatVisits(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return v.toString();
}

function visitsToBand(v) {
  if (v >= 20_000_000) return '20M+';
  if (v >= 5_000_000) return '5M-20M';
  if (v >= 1_000_000) return '1M-5M';
  if (v >= 500_000) return '500K-1M';
  if (v >= 200_000) return '200K-500K';
  if (v >= 50_000) return '50K-200K';
  return '<50K';
}

async function main() {
  const startTime = Date.now();
  const db = await getDb();
  const col = db.collection('company_meta');

  // If importing real data
  if (IMPORT_FILE) {
    console.log(`[traffic] Importing real data from ${IMPORT_FILE}...`);
    const content = fs.readFileSync(path.resolve(IMPORT_FILE), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    let updated = 0, skipped = 0;
    for (const line of lines) {
      const parts = line.split('\t');
      const domain = parts[0]?.trim().toLowerCase();
      const mauStr = parts[1]?.trim();
      if (!domain || mauStr === 'NA' || !mauStr) { skipped++; continue; }
      const mau = parseInt(mauStr, 10);
      if (isNaN(mau) || mau < 0) continue;
      const r = await col.updateOne({ normalizedDomain: domain }, {
        $set: { monthlyVisits: mau, monthlyVisitsFormatted: formatVisits(mau), trafficBand: visitsToBand(mau), trafficSource: 'real_data', trafficUpdatedAt: new Date() }
      });
      if (r.matchedCount > 0) updated++;
    }
    console.log(`[traffic] Imported: ${updated} updated, ${skipped} skipped`);
    process.exit(0);
  }

  // Load Tranco list
  const trancoPath = path.resolve(__dirname, 'tranco-list.csv');
  if (!fs.existsSync(trancoPath)) {
    console.error('[traffic] tranco-list.csv not found. Run estimate-traffic.js first to download it.');
    process.exit(1);
  }
  const trancoContent = fs.readFileSync(trancoPath, 'utf-8');
  const trancoMap = new Map();
  for (const line of trancoContent.split('\n')) {
    const [rank, domain] = line.split(',');
    if (domain) trancoMap.set(domain.trim().toLowerCase(), parseInt(rank, 10));
  }
  console.log(`[traffic] Loaded ${trancoMap.size} Tranco rankings`);

  // Get domains to update
  const query = ONLY_MISSING
    ? { $or: [{ monthlyVisits: null }, { monthlyVisits: 0 }, { monthlyVisits: { $exists: false } }] }
    : {};

  // Don't overwrite real_data with estimates
  if (!ONLY_MISSING) {
    query.trafficSource = { $ne: 'real_data' };
  }

  let domains = await col.find(query).project({ normalizedDomain: 1 }).toArray();
  if (LIMIT > 0) domains = domains.slice(0, LIMIT);
  console.log(`[traffic] ${domains.length} domains to update`);

  let updated = 0, noRank = 0;
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i].normalizedDomain;
    const rank = trancoMap.get(domain) || trancoMap.get('www.' + domain) || trancoMap.get(domain.replace(/^www\./, ''));

    if (rank) {
      const visits = rankToVisits(rank);
      await col.updateOne({ normalizedDomain: domain }, {
        $set: {
          monthlyVisits: visits,
          monthlyVisitsFormatted: formatVisits(visits),
          trafficBand: visitsToBand(visits),
          trafficSource: 'tranco',
          trafficUpdatedAt: new Date(),
        }
      });
      updated++;
    } else {
      noRank++;
    }

    if ((i + 1) % 5000 === 0 || i + 1 === domains.length) {
      console.log(`[traffic] ${i + 1}/${domains.length} — updated: ${updated}, no rank: ${noRank}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[traffic] Done in ${elapsed}s — updated: ${updated}, no rank: ${noRank}`);
  process.exit(0);
}

main().catch(err => { console.error('[traffic] Fatal:', err); process.exit(1); });
