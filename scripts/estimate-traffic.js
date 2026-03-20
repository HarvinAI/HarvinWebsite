#!/usr/bin/env node

/**
 * Estimate monthly traffic (MAU) for domains using:
 *   1. Tranco top-sites list (free, updated daily, ranks 1M+ domains)
 *   2. Google CrUX API (free, real Chrome usage data — needs GOOGLE_API_KEY)
 *
 * Rank → traffic estimation uses a logarithmic model calibrated against
 * known SimilarWeb data points.
 *
 * Usage:
 *   node scripts/estimate-traffic.js                # full run
 *   node scripts/estimate-traffic.js --limit 500    # process first 500
 *   node scripts/estimate-traffic.js --dry-run      # report stats only
 *   node scripts/estimate-traffic.js --refresh       # re-estimate all (ignore cache)
 *
 * Stores results in MongoDB company_meta collection:
 *   - monthlyVisits: number (estimated monthly visits)
 *   - monthlyVisitsFormatted: string (e.g. "2.8M", "340K")
 *   - trafficBand: string ("<100K", "100K-500K", "500K-2M", "2M+")
 *   - trafficSource: string ("tranco+crux", "tranco", "crux", "estimate")
 *   - trafficRank: number (Tranco rank, null if not ranked)
 *   - trafficUpdatedAt: Date
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { createGunzip } = require('zlib');

// ── Load .env.local ──────────────────────────────────────────────────────
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

// ── CLI args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const REFRESH = args.includes('--refresh');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const CRUX_ENABLED = !!GOOGLE_API_KEY;

// ── Config ───────────────────────────────────────────────────────────────
const TRANCO_CSV_URL = 'https://tranco-list.eu/top-1m.csv.zip'; // zip of latest list
const TRANCO_API_URL = 'https://tranco-list.eu/api/lists/date/latest'; // get latest list ID
const TRANCO_CACHE = path.resolve(__dirname, 'tranco-list.csv');
const TRANCO_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // refresh weekly
const CRUX_API = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
const CRUX_CONCURRENCY = 5;
const CRUX_DELAY = 200; // ms between batches to respect rate limits
const PROGRESS_FILE = path.resolve(__dirname, 'traffic-progress.json');
const SAVE_EVERY = 100;

// ── Rank → Monthly Visits estimation model ───────────────────────────────
// Recalibrated March 2026 against 16,204 real MAU data points.
// Old model was 3-8x inflated for mid-range ranks.
//
// New calibration:
//   Rank 1 ≈ 88B     Rank 100 ≈ 650M    Rank 1,000 ≈ 55M
//   Rank 10,000 ≈ 4.7M  Rank 100,000 ≈ 400K  Rank 500,000 ≈ 72K
//   Rank 1,000,000 ≈ 35K
//
// Model: visits ≈ A / (rank ^ B)
// Fitted via log-log regression on real data: A ≈ 8.86e10, B ≈ 1.068
// Then corrected per rank band using median correction factors from 16K real data points
const RANK_COEFF_A = 8.86e10;
const RANK_COEFF_B = 1.068;

// Correction factors by rank band (median of real/estimated ratio)
// Derived from comparing Tranco estimates against 16,241 real SimilarWeb MAU values
const RANK_CORRECTIONS = [
  { max: 100,     factor: 0.68 },
  { max: 500,     factor: 0.32 },
  { max: 1000,    factor: 0.95 },
  { max: 5000,    factor: 1.33 },
  { max: 10000,   factor: 1.97 },
  { max: 50000,   factor: 1.23 },
  { max: 100000,  factor: 1.44 },
  { max: 500000,  factor: 1.06 },
  { max: Infinity, factor: 1.02 },
];

function rankToVisits(rank) {
  if (!rank || rank <= 0) return 0;
  const base = RANK_COEFF_A / Math.pow(rank, RANK_COEFF_B);
  // Apply rank-band correction factor
  const correction = RANK_CORRECTIONS.find(c => rank <= c.max);
  return Math.round(base * (correction?.factor || 1));
}

function visitsToBand(visits) {
  if (visits >= 2_000_000) return '2M+';
  if (visits >= 500_000) return '500K-2M';
  if (visits >= 100_000) return '100K-500K';
  return '<100K';
}

function formatVisits(visits) {
  if (visits >= 1_000_000_000) return (visits / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (visits >= 1_000_000) return (visits / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (visits >= 1_000) return (visits / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return visits.toString();
}

// ── Download Tranco list ─────────────────────────────────────────────────
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const doGet = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const mod = u.startsWith('https') ? https : http;
      mod.get(u, { timeout: 30000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doGet(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    };
    doGet(url);
  });
}

async function loadTrancoList() {
  // Check if cached and fresh
  try {
    const stat = fs.statSync(TRANCO_CACHE);
    if (Date.now() - stat.mtimeMs < TRANCO_MAX_AGE) {
      console.log('[tranco] Using cached list');
      const csv = fs.readFileSync(TRANCO_CACHE, 'utf-8');
      return parseTrancoCSV(csv);
    }
  } catch {}

  console.log('[tranco] Downloading fresh top-1M list...');
  try {
    // Get latest list ID from API
    const apiResp = await downloadFile(TRANCO_API_URL);
    const listData = JSON.parse(apiResp);
    const listId = listData.list_id;
    console.log(`[tranco] Latest list ID: ${listId}`);
    const csvUrl = `https://tranco-list.eu/download/${listId}/1000000`;
    const csv = await downloadFile(csvUrl);
    fs.writeFileSync(TRANCO_CACHE, csv);
    console.log('[tranco] Downloaded and cached');
    return parseTrancoCSV(csv);
  } catch (err) {
    console.error(`[tranco] Download failed: ${err.message}`);
    // Try cached even if stale
    try {
      const csv = fs.readFileSync(TRANCO_CACHE, 'utf-8');
      console.log('[tranco] Using stale cache as fallback');
      return parseTrancoCSV(csv);
    } catch {
      console.error('[tranco] No cached list available');
      return new Map();
    }
  }
}

function parseTrancoCSV(csv) {
  const map = new Map();
  const lines = csv.split('\n');
  for (const line of lines) {
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) continue;
    const rank = parseInt(line.slice(0, commaIdx), 10);
    const domain = line.slice(commaIdx + 1).trim().toLowerCase();
    if (rank && domain) {
      map.set(domain, rank);
    }
  }
  console.log(`[tranco] Loaded ${map.size.toLocaleString()} domain rankings`);
  return map;
}

// ── CrUX API ─────────────────────────────────────────────────────────────
function cruxQuery(domain) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      origin: `https://${domain}`,
      metrics: ['largest_contentful_paint', 'cumulative_layout_shift'],
    });

    const url = `${CRUX_API}?key=${GOOGLE_API_KEY}`;
    const parsed = new URL(url);

    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch { resolve(null); }
        } else if (res.statusCode === 404) {
          // Domain not in CrUX = very low traffic
          resolve(null);
        } else {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

/**
 * CrUX doesn't give exact visit counts, but being IN CrUX means
 * the domain has enough Chrome users to be tracked.
 * We use CrUX presence as a signal:
 *   - In CrUX → at least ~10K monthly visits (Chrome tracks popular origins)
 *   - Not in CrUX → likely < 10K monthly visits
 *
 * For CrUX-present domains without Tranco rank, we estimate ~5K-15K visits
 * (CrUX includes sites with as few as ~1K Chrome users/month).
 * Previous flat 50K was too high — recalibrated against SimilarWeb spot checks.
 */
const CRUX_FALLBACK_VISITS = 10_000;
const NO_DATA_VISITS = 0; // not in Tranco, not in CrUX — don't guess

// ── Progress management ──────────────────────────────────────────────────
let processedSet = new Set();
let stats = { tranco: 0, crux: 0, both: 0, noData: 0, skip: 0, fail: 0 };

function loadProgress() {
  try {
    const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    processedSet = new Set(raw.processedDomains || []);
    stats = raw.stats || stats;
    console.log(`[resume] ${processedSet.size} domains already processed`);
  } catch {
    console.log('[start] Starting fresh');
  }
}

function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    processedDomains: [...processedSet],
    stats,
    updatedAt: new Date().toISOString(),
  }));
}

// ── Semaphore ────────────────────────────────────────────────────────────
class Semaphore {
  constructor(max) { this.max = max; this.count = 0; this.queue = []; }
  async acquire() {
    if (this.count < this.max) { this.count++; return; }
    await new Promise(r => this.queue.push(r));
    this.count++;
  }
  release() {
    this.count--;
    if (this.queue.length > 0) this.queue.shift()();
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[config] CrUX API: ${CRUX_ENABLED ? 'enabled' : 'disabled (set GOOGLE_API_KEY in .env.local)'}`);

  // Load Tranco rankings
  const trancoMap = await loadTrancoList();

  // Connect to DB
  const db = await getDb();
  const metaCol = db.collection('company_meta');

  // Get all domains from company_meta
  const allDocs = await metaCol.find(
    { normalizedDomain: { $exists: true, $nin: [null, ''] } },
  ).project({ normalizedDomain: 1, trafficUpdatedAt: 1 }).toArray();

  let domains = allDocs.map(d => d.normalizedDomain).filter(Boolean);
  console.log(`[info] ${domains.length} domains in company_meta`);

  if (LIMIT > 0) {
    domains = domains.slice(0, LIMIT);
    console.log(`[info] Limited to ${LIMIT} domains`);
  }

  if (!REFRESH) {
    loadProgress();
    domains = domains.filter(d => !processedSet.has(d));
  }

  console.log(`[info] ${domains.length} domains to process`);

  if (DRY_RUN) {
    // Count how many are in Tranco
    let inTranco = 0;
    for (const d of domains) {
      // Try both with and without www
      if (trancoMap.has(d) || trancoMap.has('www.' + d) || trancoMap.has(d.replace(/^www\./, ''))) {
        inTranco++;
      }
    }
    console.log(`[dry-run] Domains in Tranco top 1M: ${inTranco}`);
    console.log(`[dry-run] Domains NOT in Tranco: ${domains.length - inTranco}`);
    console.log(`[dry-run] CrUX will be queried for: ${CRUX_ENABLED ? domains.length - inTranco : 0} domains`);
    process.exit(0);
  }

  if (domains.length === 0) {
    console.log('[done] All domains already processed');
    process.exit(0);
  }

  // Ensure index
  try {
    await metaCol.createIndex({ normalizedDomain: 1 }, { unique: true });
  } catch {}

  const sem = new Semaphore(CRUX_CONCURRENCY);
  let processed = 0;
  const startedAt = Date.now();

  function formatETA() {
    const elapsed = Date.now() - startedAt;
    if (processed === 0) return '?';
    const remaining = ((domains.length - processed) * elapsed) / processed;
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${m}m ${s}s`;
  }

  // Process domains
  const promises = [];

  for (const domain of domains) {
    await sem.acquire();

    const p = (async () => {
      try {
        // 1. Check Tranco rank
        const rank = trancoMap.get(domain)
          || trancoMap.get('www.' + domain)
          || trancoMap.get(domain.replace(/^www\./, ''))
          || null;

        let monthlyVisits = 0;
        let source = 'estimate';

        if (rank) {
          monthlyVisits = rankToVisits(rank);
          source = 'tranco';
        }

        // 2. If no Tranco rank and CrUX enabled, query CrUX
        if (!rank && CRUX_ENABLED) {
          const cruxData = await cruxQuery(domain);
          if (cruxData && cruxData.record) {
            // Domain is in CrUX → has meaningful traffic
            monthlyVisits = CRUX_FALLBACK_VISITS;
            source = 'crux';
            stats.crux++;
          } else {
            monthlyVisits = NO_DATA_VISITS;
            source = 'estimate';
            stats.noData++;
          }
        } else if (rank) {
          // Check CrUX for Tranco-ranked domains too (to validate)
          if (CRUX_ENABLED && rank > 100000) {
            const cruxData = await cruxQuery(domain);
            if (cruxData && cruxData.record) {
              // Both sources confirm traffic
              source = 'tranco+crux';
              stats.both++;
            } else {
              stats.tranco++;
            }
          } else {
            stats.tranco++;
          }
        } else {
          monthlyVisits = NO_DATA_VISITS;
          stats.noData++;
        }

        const trafficBand = visitsToBand(monthlyVisits);
        const formatted = formatVisits(monthlyVisits);

        // 3. Update DB
        await metaCol.updateOne(
          { normalizedDomain: domain },
          {
            $set: {
              monthlyVisits,
              monthlyVisitsFormatted: formatted,
              trafficBand,
              trafficSource: source,
              trafficRank: rank,
              trafficUpdatedAt: new Date(),
            },
          },
        );

        processedSet.add(domain);
      } catch (err) {
        stats.fail++;
        processedSet.add(domain);
        if (stats.fail <= 5 || stats.fail % 100 === 0) {
          console.error(`[fail] ${domain}: ${err.message}`);
        }
      }
    })().finally(() => {
      sem.release();
      processed++;

      if (processed % 50 === 0 || processed === domains.length) {
        const pct = ((processed / domains.length) * 100).toFixed(1);
        console.log(
          `[${processed}/${domains.length}] ${pct}% | tranco:${stats.tranco} crux:${stats.crux} both:${stats.both} noData:${stats.noData} fail:${stats.fail} | ETA: ${formatETA()}`
        );
      }

      if (processed % SAVE_EVERY === 0) saveProgress();
    });

    promises.push(p);

    // Small delay between CrUX requests for non-Tranco domains
    const hasRank = trancoMap.has(domain) || trancoMap.has('www.' + domain) || trancoMap.has(domain.replace(/^www\./, ''));
    if (!hasRank && CRUX_ENABLED) await sleep(CRUX_DELAY);
  }

  await Promise.all(promises);
  saveProgress();

  console.log(`\n[done] Processed ${processedSet.size} domains`);
  console.log(`  tranco: ${stats.tranco} | crux: ${stats.crux} | both: ${stats.both} | noData: ${stats.noData} | fail: ${stats.fail}`);
  console.log(`  Duration: ${((Date.now() - startedAt) / 60000).toFixed(1)} minutes`);
  process.exit(0);
}

main().catch(err => {
  console.error('[fatal]', err);
  saveProgress();
  process.exit(1);
});
