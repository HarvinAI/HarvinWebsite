#!/usr/bin/env node

/**
 * Standalone signal scorer — recomputes all signal scores.
 * Reads signals from last 90 days, groups by domain, computes composite score.
 *
 * Usage:
 *   node scripts/signal-score.js
 */

const path = require('path');
const fs = require('fs');

// Load .env.local manually
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
  // .env.local not found
}

const { getDb } = require('../lib/scan/db');
const { scoreAllDomains } = require('../lib/signals/scorer');

async function main() {
  const startTime = Date.now();
  console.log('[signal-score] Recomputing all signal scores...');

  const db = await getDb();

  // Ensure indexes
  const scoresCol = db.collection('signal_scores');
  scoresCol.createIndex({ domain: 1 }, { unique: true }).catch(() => {});
  scoresCol.createIndex({ recommended: 1, totalScore: -1 }).catch(() => {});

  const scored = await scoreAllDomains(db);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[signal-score] Done in ${elapsed}s — scored ${scored} domains`);

  process.exit(0);
}

main().catch(err => {
  console.error('[signal-score] Fatal error:', err);
  process.exit(1);
});
