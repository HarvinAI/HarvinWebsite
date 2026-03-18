#!/usr/bin/env node

/**
 * Re-scan domains from Accounts.txt that are missing from company_meta.
 * Used after a cleanup to restore deleted consumer-facing accounts.
 *
 * Usage:
 *   node scripts/rescan-missing.js              # full run
 *   node scripts/rescan-missing.js --limit 1000 # first 1000 missing
 *   node scripts/rescan-missing.js --dry-run    # just count missing
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
const { fetchWithAxios, extractMetaMap } = require('../lib/scan/fetch');
const { extractCompanyMeta } = require('../lib/scan/companyMeta');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;
const CONCURRENCY = 10;
const ACCOUNTS_FILE = path.resolve(__dirname, '..', 'Accounts.txt');

function normalizeDomain(raw) {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
}

async function main() {
  const startTime = Date.now();
  console.log(`[rescan] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const db = await getDb();
  const col = db.collection('company_meta');

  // Load all domains from Accounts.txt
  const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
  const allDomains = [...new Set(raw.split('\n').map(normalizeDomain).filter(Boolean))];
  console.log(`[rescan] Accounts.txt: ${allDomains.length} domains`);

  // Find which ones are missing from company_meta
  const existing = new Set(
    (await col.find({}).project({ normalizedDomain: 1 }).toArray()).map(d => d.normalizedDomain)
  );
  console.log(`[rescan] Already in DB: ${existing.size}`);

  let missing = allDomains.filter(d => !existing.has(d));
  console.log(`[rescan] Missing: ${missing.length}`);

  if (LIMIT > 0) missing = missing.slice(0, LIMIT);
  console.log(`[rescan] Will process: ${missing.length}`);

  if (DRY_RUN) {
    console.log('[rescan] Dry run — exiting');
    process.exit(0);
  }

  let ok = 0, fail = 0, skipped = 0;

  // Process in batches
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);

    await Promise.allSettled(batch.map(async (domain) => {
      const url = `https://${domain}`;
      try {
        let html = '', headers = {};
        try {
          const resp = await Promise.race([
            fetchWithAxios(url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
          ]);
          html = typeof resp.data === 'string' ? resp.data : '';
          headers = resp.headers || {};
        } catch {
          // fetch failed — try without www
        }

        if (!html || html.length < 500) {
          skipped++;
          return;
        }

        const metaMap = extractMetaMap(html);
        await extractCompanyMeta({
          url, html, headers, metaMap,
          technologies: [],
          fetchPage: fetchWithAxios,
          browserFetch: null,
          forceRefresh: true,
        });
        ok++;
      } catch {
        fail++;
      }
    }));

    // Progress
    const done = Math.min(i + CONCURRENCY, missing.length);
    if (done % 100 === 0 || done === missing.length) {
      const pct = ((done / missing.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`[rescan] ${done}/${missing.length} (${pct}%) — ok:${ok} fail:${fail} skip:${skipped} — ${elapsed}s`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const finalCount = await col.countDocuments({});
  console.log(`\n[rescan] Done in ${elapsed}s — ok:${ok} fail:${fail} skip:${skipped}`);
  console.log(`[rescan] Total accounts in DB now: ${finalCount}`);

  process.exit(0);
}

main().catch(err => {
  console.error('[rescan] Fatal:', err);
  process.exit(1);
});
