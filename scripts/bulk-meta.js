#!/usr/bin/env node

// Catch TLS/SSL crashes (Node v24 bug with certain domains)
process.on('uncaughtException', (err) => {
  if (err.message?.includes('TLS') || err.code === 'ERR_SSL_WRONG_VERSION_NUMBER' || err.stack?.includes('TLSWrap')) {
    console.warn('[warn] TLS crash caught, continuing...');
    return;
  }
  console.error('[fatal] Uncaught exception:', err.message);
  try { saveProgress(); } catch {}
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.warn('[warn] Unhandled rejection:', err?.message || err);
});

/**
 * Bulk domain processing script for company_meta collection.
 * Reads domains from Accounts.txt, processes each through extractCompanyMeta(),
 * and stores results in MongoDB.
 *
 * Usage:
 *   node scripts/bulk-meta.js              # full run
 *   node scripts/bulk-meta.js --limit 100  # process first 100 only
 *   node scripts/bulk-meta.js --dry-run    # report stats without processing
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
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn('[env] Could not load .env.local — ensure MONGO_URI is set');
}

const { getDb } = require('../lib/scan/db');
const { fetchWithAxios, extractMetaMap } = require('../lib/scan/fetch');
const { extractCompanyMeta } = require('../lib/scan/companyMeta');

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;

// ── Config ────────────────────────────────────────────────────────────────
const CONCURRENCY = 20;
const PROGRESS_FILE = path.resolve(__dirname, 'bulk-meta-progress.json');
const ACCOUNTS_FILE = path.resolve(__dirname, '..', 'Accounts.txt');
const SAVE_EVERY = 100;
const PER_DOMAIN_TIMEOUT = 10_000;

// ── Progress state ────────────────────────────────────────────────────────
let stats = { ok: 0, skip: 0, fail: 0 };
let resumeIndex = 0;
let startedAt = Date.now();
let shuttingDown = false;

function loadProgress() {
  try {
    const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    // Support both old format (processedDomains array) and new format (resumeIndex number)
    if (typeof raw.resumeIndex === 'number') {
      resumeIndex = raw.resumeIndex;
    } else if (Array.isArray(raw.processedDomains)) {
      resumeIndex = raw.processedDomains.length;
    }
    stats = raw.stats || { ok: 0, skip: 0, fail: 0 };
    startedAt = raw.startedAt || Date.now();
    console.log(`[resume] Resuming from index ${resumeIndex}`);
  } catch {
    console.log('[start] No progress file found, starting fresh');
  }
}

function saveProgress() {
  const data = { resumeIndex, stats, startedAt };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data));
}

// ── Domain normalization ──────────────────────────────────────────────────
function normalizeDomain(raw) {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

// ── Read & deduplicate domains ────────────────────────────────────────────
function loadDomains() {
  const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const seen = new Set();
  const domains = [];
  for (const line of lines) {
    const d = normalizeDomain(line);
    if (d && !seen.has(d)) {
      seen.add(d);
      domains.push(d);
    }
  }
  return domains;
}

// ── Semaphore for concurrency control ─────────────────────────────────────
class Semaphore {
  constructor(max) {
    this.max = max;
    this.count = 0;
    this.queue = [];
  }
  async acquire() {
    if (this.count < this.max) {
      this.count++;
      return;
    }
    await new Promise(resolve => this.queue.push(resolve));
    this.count++;
  }
  release() {
    this.count--;
    if (this.queue.length > 0) {
      this.queue.shift()();
    }
  }
}

// ── ETA calculation ───────────────────────────────────────────────────────
function formatETA(processed, total) {
  const elapsed = Date.now() - startedAt;
  if (processed === 0) return '?';
  const msPerDomain = elapsed / processed;
  const remaining = (total - processed) * msPerDomain;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// ── Process a single domain ───────────────────────────────────────────────
async function processDomain(domain, db) {
  // Check if already in DB with full data
  const existing = await db.collection('company_meta').findOne({
    normalizedDomain: domain,
  });
  if (existing && existing.category && existing.subCategory && existing.region) {
    stats.skip++;
    return;
  }

  // Fetch HTML
  let html = '';
  let headers = {};
  try {
    const res = await fetchWithAxios('https://' + domain);
    html = typeof res.data === 'string' ? res.data : '';
    headers = res.headers || {};
  } catch {
    // Try http if https fails
    try {
      const res = await fetchWithAxios('http://' + domain);
      html = typeof res.data === 'string' ? res.data : '';
      headers = res.headers || {};
    } catch {
      // No HTML available — still try extractCompanyMeta (known brands work without HTML)
    }
  }

  const metaMap = html ? extractMetaMap(html) : {};

  // Pass null for fetchPage and browserFetch to skip store detection (too slow for bulk)
  // Store detection can be backfilled later
  await extractCompanyMeta({
    url: 'https://' + domain,
    html,
    headers,
    metaMap,
    technologies: [],
    fetchPage: null,
    browserFetch: null,
  });

  stats.ok++;
}

// ── Timeout wrapper ───────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const allDomains = loadDomains();
  console.log(`[info] Loaded ${allDomains.length} unique domains from Accounts.txt`);

  const domains = LIMIT > 0 ? allDomains.slice(0, LIMIT) : allDomains;
  console.log(`[info] Will process ${domains.length} domains${LIMIT > 0 ? ` (limited to ${LIMIT})` : ''}`);

  loadProgress();

  // Skip already processed domains (by index)
  const todo = domains.slice(resumeIndex);
  console.log(`[info] ${todo.length} domains remaining (${resumeIndex} already processed)`);

  if (DRY_RUN) {
    // Check how many are already in DB
    const db = await getDb();
    const dbCount = await db.collection('company_meta').countDocuments
      ? await db.collection('company_meta').countDocuments({})
      : 0;
    console.log(`[dry-run] Total domains in file: ${allDomains.length}`);
    console.log(`[dry-run] Already processed (progress file): ${resumeIndex}`);
    console.log(`[dry-run] Documents in company_meta collection: ${dbCount}`);
    console.log(`[dry-run] Domains to process: ${todo.length}`);
    process.exit(0);
  }

  if (todo.length === 0) {
    console.log('[done] All domains already processed!');
    process.exit(0);
  }

  // Ensure index
  const db = await getDb();
  try {
    await db.collection('company_meta').createIndex(
      { normalizedDomain: 1 },
      { unique: true }
    );
    console.log('[db] Ensured normalizedDomain unique index');
  } catch {
    console.log('[db] Index already exists or in-memory mode');
  }

  const sem = new Semaphore(CONCURRENCY);
  let processed = 0;
  const totalTodo = todo.length;
  const totalAll = domains.length;

  // Graceful shutdown
  let inflightCount = 0;
  function handleShutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n[shutdown] Finishing in-flight requests...');
    const waitForInflight = setInterval(() => {
      if (inflightCount === 0) {
        clearInterval(waitForInflight);
        saveProgress();
        console.log(`[shutdown] Progress saved. ${resumeIndex} domains processed total.`);
        process.exit(0);
      }
    }, 200);
  }
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  // Process in batches
  const promises = [];
  for (const domain of todo) {
    if (shuttingDown) break;

    await sem.acquire();
    if (shuttingDown) { sem.release(); break; }

    inflightCount++;
    const p = withTimeout(processDomain(domain, db), PER_DOMAIN_TIMEOUT)
      .catch(err => {
        stats.fail++;
        // Only log errors occasionally to avoid spam
        if (stats.fail <= 10 || stats.fail % 100 === 0) {
          console.error(`[fail] ${domain}: ${err.message}`);
        }
      })
      .finally(() => {
        inflightCount--;
        sem.release();
        processed++;

        resumeIndex++;

        // Progress log
        if (processed % 10 === 0 || processed === totalTodo) {
          const total = resumeIndex;
          const pct = ((total / totalAll) * 100).toFixed(1);
          const eta = formatETA(processed, totalTodo);
          console.log(
            `[${total}/${totalAll}] ${pct}% | ok:${stats.ok} skip:${stats.skip} fail:${stats.fail} | ETA: ${eta}`
          );
        }

        // Save progress periodically
        if (processed % SAVE_EVERY === 0) {
          saveProgress();
        }
      });
    promises.push(p);
  }

  await Promise.all(promises);
  saveProgress();

  console.log(`\n[done] Processed ${resumeIndex} domains total`);
  console.log(`  ok: ${stats.ok} | skip: ${stats.skip} | fail: ${stats.fail}`);
  console.log(`  Duration: ${((Date.now() - startedAt) / 60_000).toFixed(1)} minutes`);
  process.exit(0);
}

main().catch(err => {
  console.error('[fatal]', err);
  saveProgress();
  process.exit(1);
});
