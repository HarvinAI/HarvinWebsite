#!/usr/bin/env node
/**
 * Extension Bot — Automated Tech Scanner using Chrome Extension
 *
 * Launches a real Chrome browser with the HarvinAI extension loaded,
 * navigates to each website, captures the same live page data the extension
 * captures (rendered DOM, JS globals, network requests), and POSTs it to
 * the /api/detect endpoint — identical to clicking the extension manually.
 *
 * Results are saved to:
 *   - scripts/scan-results.csv  (spreadsheet-friendly)
 *   - scripts/scan-results.json (full detailed data)
 *
 * Usage:
 *   node scripts/extension-bot.js                     # scan all with no tech data
 *   node scripts/extension-bot.js --limit 50          # scan first 50
 *   node scripts/extension-bot.js --concurrency 3     # 3 tabs at once (default: 1)
 *   node scripts/extension-bot.js --force              # rescan ALL accounts
 *   node scripts/extension-bot.js --resume             # resume from last run
 *   node scripts/extension-bot.js --category "Fashion & Apparel"  # filter by category
 *   node scripts/extension-bot.js --headless           # run headless (faster but less accurate)
 *   node scripts/extension-bot.js --dry-run            # just list domains, don't scan
 *   node scripts/extension-bot.js --api-base http://localhost:3000  # custom API base
 *   node scripts/extension-bot.js --output my-scan     # custom output filename prefix
 */

const dotenvPath = require('path').join(__dirname, '..', '.env.local');
require('fs').existsSync(dotenvPath) && require('dotenv').config({ path: dotenvPath });

const { getDb } = require('../lib/scan/db');
const fs = require('fs');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..', 'extension');
const PROGRESS_FILE = path.join(__dirname, 'extension-bot-progress.json');

// ── Parse CLI args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const LIMIT = parseInt(getArg('limit') || '0', 10);
const CONCURRENCY = parseInt(getArg('concurrency') || '1', 10);
const FORCE = hasFlag('force');
const RESUME = hasFlag('resume');
const DRY_RUN = hasFlag('dry-run');
const HEADLESS = hasFlag('headless');
const CATEGORY_FILTER = getArg('category');
const API_BASE = getArg('api-base') || 'http://localhost:3000';
const DELAY_BETWEEN = parseInt(getArg('delay') || '1000', 10);
const OUTPUT_PREFIX = getArg('output') || 'scan-results';

const RESULTS_JSON = path.join(__dirname, `${OUTPUT_PREFIX}.json`);
const RESULTS_CSV = path.join(__dirname, `${OUTPUT_PREFIX}.csv`);

let stats = { total: 0, scanned: 0, skipped: 0, failed: 0, updated: 0 };
let startTime = Date.now();

// ── Scan results collector ──────────────────────────────────────────────
const scanResults = [];

function appendResult(result) {
  scanResults.push(result);

  // Append to JSON file incrementally (write full array each time for safety)
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(scanResults, null, 2));

  // Append to CSV
  const csvLine = resultToCsvLine(result);
  if (scanResults.length === 1) {
    // Write header + first line
    fs.writeFileSync(RESULTS_CSV, CSV_HEADER + '\n' + csvLine + '\n');
  } else {
    fs.appendFileSync(RESULTS_CSV, csvLine + '\n');
  }
}

const CSV_HEADER = [
  'Domain', 'Status', 'Category', 'Sub-Category', 'Region', 'Offline Stores',
  'Business Model', 'App Presence', 'Tech Count', 'Tech Stack',
  'Monthly Visits', 'Scanned At', 'Error'
].join(',');

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function resultToCsvLine(r) {
  return [
    escapeCsv(r.domain),
    escapeCsv(r.status),
    escapeCsv(r.category),
    escapeCsv(r.subCategory),
    escapeCsv(r.region),
    escapeCsv(r.offlineStores),
    escapeCsv(r.businessModel),
    escapeCsv(r.appPresence),
    escapeCsv(r.techCount),
    escapeCsv((r.techStack || []).join(' | ')),
    escapeCsv(r.monthlyVisits),
    escapeCsv(r.scannedAt),
    escapeCsv(r.error),
  ].join(',');
}

// ── Progress persistence ────────────────────────────────────────────────
function saveProgress(index) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    index, stats, timestamp: new Date().toISOString()
  }));
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

// ── Page data capture (mirrors extension's capturePageData exactly) ──────
async function capturePageData(page) {
  return await page.evaluate(() => {
    let html = document.documentElement.outerHTML;
    html = html.replace(/<script(?![^>]*\bsrc\b)[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.slice(0, 800_000);

    const scriptSrcs = [...document.querySelectorAll('script[src]')].map(s => s.src);

    const metaMap = {};
    document.querySelectorAll('meta[content]').forEach(m => {
      const key = (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase();
      if (key) metaMap[key] = m.getAttribute('content');
    });

    const jsGlobals = {};
    const checks = [
      ['dataLayer', () => window.dataLayer],
      ['nextjs', () => window.__NEXT_DATA__],
      ['nuxt', () => window.__NUXT__],
      ['shopify', () => window.Shopify],
      ['webflow', () => window.Webflow],
      ['wix', () => window.wixDeveloperAnalytics],
      ['angular', () => window.angular || document.querySelector('[ng-version]')],
      ['gatsby', () => window.__GATSBY],
      ['remix', () => window.__remixContext],
      ['sentry', () => window.Sentry || window.Raven],
      ['facebookPixel', () => window.fbq],
      ['gtm', () => window.gtag || window.google_tag_manager],
      ['hotjar', () => window.hj || window._hjSettings],
      ['intercom', () => window.Intercom],
      ['drift', () => window.drift],
      ['zendesk', () => window.zE || window.zESettings],
      ['hubspot', () => window.HubSpotConversations || window._hsq],
      ['stripe', () => window.Stripe],
      ['klaviyo', () => window.klpiframe || document.querySelector('[class*="klaviyo"]')],
      ['svelte', () => window.__svelte_meta],
      ['react', () => window.React || document.querySelector('[data-reactroot]') || document.querySelector('#__next')],
      ['vue', () => window.__VUE__ || document.querySelector('[data-v-]')],
      ['akamai', () => window.Akamai || window.BOOMR],
      ['optimizely', () => window.optimizely],
      ['amplitude', () => window.amplitude],
      ['mixpanel', () => window.mixpanel],
      ['fullstory', () => window.FS || window._fs_namespace],
      ['datadog', () => window.DD_RUM],
      ['newrelic', () => window.newrelic || window.NREUM],
      ['logrocket', () => window.LogRocket],
      ['segment', () => window.analytics?.identify],
      ['clarity', () => window.clarity],
      ['tiktokPixel', () => window.ttq],
      ['pinterest', () => window.pintrk],
      ['linkedin', () => window._linkedin_data_partner_ids],
    ];
    for (const [key, check] of checks) {
      try { if (check()) jsGlobals[key] = true; } catch {}
    }

    const networkUrls = performance.getEntriesByType('resource').map(e => e.name);

    return { html, scriptSrcs, metaMap, jsGlobals, networkUrls };
  });
}

// ── Scan a single domain ────────────────────────────────────────────────
async function scanDomain(browser, domain) {
  let page;
  try {
    page = await browser.newPage();

    // ── Auto-dismiss all permission dialogs, alerts, confirms, prompts ──
    page.on('dialog', async (dialog) => {
      try { await dialog.accept(); } catch {}
    });

    // Grant all permissions to avoid "wants to access" popups
    const context = browser.defaultBrowserContext();
    try {
      await context.overridePermissions(`https://${domain}`, [
        'geolocation', 'midi', 'notifications', 'camera', 'microphone',
        'clipboard-read', 'clipboard-write', 'payment-handler',
        'idle-detection', 'background-sync', 'ambient-light-sensor',
        'accelerometer', 'gyroscope', 'magnetometer',
      ]);
    } catch {}

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    // Hide automation signals
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    // Navigate to the website
    const url = `https://${domain}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      try {
        await page.goto(`https://www.${domain}`, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch {
        throw new Error(`Failed to load ${domain}`);
      }
    }

    // Wait for dynamic content to render
    await new Promise(r => setTimeout(r, 2000));

    // Dismiss any popups/modals/overlays that appeared after page load
    await page.evaluate(() => {
      // Close common cookie/notification popups by clicking dismiss buttons
      const dismissSelectors = [
        '[class*="cookie"] button', '[id*="cookie"] button',
        '[class*="consent"] button', '[class*="popup"] .close',
        '[class*="modal"] .close', '[class*="overlay"] .close',
        'button[aria-label="Close"]', 'button[aria-label="Dismiss"]',
      ];
      for (const sel of dismissSelectors) {
        try { document.querySelector(sel)?.click(); } catch {}
      }
    }).catch(() => {});

    // Capture page data (same as extension)
    const pageData = await capturePageData(page);
    if (!pageData || !pageData.html || pageData.html.length < 500) {
      throw new Error(`Empty or blocked page for ${domain}`);
    }

    // POST to /api/detect — try from page context first, fallback to Node fetch
    const apiUrl = `${API_BASE}/api/detect?url=${encodeURIComponent(domain)}&refresh=1`;

    let data;
    const response = await page.evaluate(async (apiUrl, pageData) => {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageData }),
        });
        const text = await res.text();
        return { ok: res.ok, status: res.status, body: text };
      } catch (err) {
        return { ok: false, status: 0, body: err.message };
      }
    }, apiUrl, pageData);

    if (response.ok) {
      data = JSON.parse(response.body);
    } else {
      // Fallback to Node native fetch
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageData }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 100)}`);
      }
      data = await res.json();
    }

    // Extract full result for file output
    const meta = data.companyMeta || {};
    const techs = (data.technologies || []).map(t => t.name);

    const result = {
      domain,
      status: 'ok',
      category: meta.category || 'Unknown',
      subCategory: meta.subCategory || 'General',
      region: meta.region || 'Unknown',
      offlineStores: meta.offlineStores || 'Unknown',
      businessModel: meta.businessModel || 'Unknown',
      appPresence: meta.appPresence || 'Unknown',
      techCount: data.count || 0,
      techStack: techs,
      monthlyVisits: meta.monthlyVisitsFormatted || null,
      scannedAt: new Date().toISOString(),
      error: null,
    };

    appendResult(result);
    return result;
  } catch (err) {
    const result = {
      domain,
      status: 'fail',
      category: null,
      subCategory: null,
      region: null,
      offlineStores: null,
      businessModel: null,
      appPresence: null,
      techCount: 0,
      techStack: [],
      monthlyVisits: null,
      scannedAt: new Date().toISOString(),
      error: err.message,
    };
    appendResult(result);
    return result;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== HarvinAI Extension Bot ===\n');

  // ── 1. Get domains from DB ──
  const db = await getDb();
  const col = db.collection('company_meta');

  const conditions = [];

  if (!FORCE) {
    conditions.push({
      $or: [
        { techStack: { $exists: false } },
        { techStack: { $size: 0 } },
        { techStack: null },
        { techCount: { $exists: false } },
        { techCount: 0 },
        { techCount: null },
      ]
    });
  }

  if (CATEGORY_FILTER) {
    conditions.push({ category: CATEGORY_FILTER });
  }

  const finalQuery = conditions.length > 0
    ? conditions.length === 1 ? conditions[0] : { $and: conditions }
    : {};

  const totalCount = await col.countDocuments(finalQuery);
  console.log(`Found ${totalCount} accounts ${FORCE ? '(force rescan)' : 'without tech data'}${CATEGORY_FILTER ? ` in "${CATEGORY_FILTER}"` : ''}`);

  if (totalCount === 0) {
    console.log('All accounts already have tech data!');
    process.exit(0);
  }

  const cursor = col.find(finalQuery).project({ normalizedDomain: 1, _id: 0 });
  const domains = (await cursor.toArray()).map(d => d.normalizedDomain).filter(Boolean);

  let startIndex = 0;
  if (RESUME) {
    const progress = loadProgress();
    if (progress) {
      startIndex = progress.index;
      stats = progress.stats;
      console.log(`Resuming from index ${startIndex} (${stats.scanned} already scanned)`);
    }
    // Load existing results file to continue appending
    if (fs.existsSync(RESULTS_JSON)) {
      try {
        const existing = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf8'));
        scanResults.push(...existing);
        console.log(`Loaded ${existing.length} previous results from ${OUTPUT_PREFIX}.json`);
      } catch {}
    }
  }

  const toScan = LIMIT > 0 ? domains.slice(startIndex, startIndex + LIMIT) : domains.slice(startIndex);
  stats.total = toScan.length;

  console.log(`Will scan ${toScan.length} domains (concurrency: ${CONCURRENCY}, delay: ${DELAY_BETWEEN}ms)`);
  console.log(`API: ${API_BASE}`);
  console.log(`Extension: ${EXTENSION_PATH}`);
  console.log(`Output: ${RESULTS_CSV} + ${RESULTS_JSON}\n`);

  if (DRY_RUN) {
    console.log('DRY RUN — first 30 domains:');
    toScan.slice(0, 30).forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
    if (toScan.length > 30) console.log(`  ... and ${toScan.length - 30} more`);
    process.exit(0);
  }

  // ── 2. Launch Chrome with extension ──
  let puppeteer;
  try {
    puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
  } catch {
    try {
      puppeteer = require('puppeteer');
    } catch {
      console.error('Error: puppeteer not installed. Run: npm install puppeteer');
      process.exit(1);
    }
  }

  console.log(`Launching Chrome ${HEADLESS ? '(headless)' : '(visible)'}...`);

  const browser = await puppeteer.launch({
    headless: HEADLESS ? 'new' : false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      // ── Auto-dismiss permission & notification dialogs ──
      '--disable-notifications',
      '--disable-popup-blocking',
      '--disable-features=ExternalProtocolDialog,PermissionChip,PermissionQuietChip',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-translate',
      '--disable-background-networking',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--deny-permission-prompts',
    ],
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Grant permissions globally for the browser context
  const context = browser.defaultBrowserContext();
  try {
    await context.overridePermissions('https://*', [
      'geolocation', 'midi', 'notifications', 'camera', 'microphone',
      'clipboard-read', 'clipboard-write',
    ]);
  } catch {}

  console.log('Chrome launched with HarvinAI extension loaded');
  console.log('All permission dialogs will be auto-dismissed\n');
  console.log('Starting scan...\n');
  startTime = Date.now();

  // ── 3. Scan each domain ──
  for (let i = 0; i < toScan.length; i += CONCURRENCY) {
    const batch = toScan.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map((domain) => scanDomain(browser, domain))
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const res = r.value;
        if (res.status === 'ok') {
          stats.scanned++;
          if (res.techCount > 0) stats.updated++;
          const techLabel = res.techCount > 0 ? `${res.techCount} techs` : 'no tech';
          process.stdout.write(
            `  [${i + 1}/${toScan.length}] ${res.domain} => ${res.category} | ${res.subCategory} | ${techLabel}\n`
          );
        } else {
          stats.failed++;
          process.stdout.write(
            `  [${i + 1}/${toScan.length}] ${res.domain} => FAILED: ${res.error}\n`
          );
        }
      } else {
        stats.failed++;
      }
    }

    // Progress summary
    const pct = ((i + batch.length) / toScan.length * 100).toFixed(1);
    const rate = stats.scanned > 0
      ? (stats.scanned / ((Date.now() - startTime) / 1000)).toFixed(2)
      : '0';
    const remaining = toScan.length - i - batch.length;
    const eta = parseFloat(rate) > 0 ? Math.ceil(remaining / parseFloat(rate) / 60) : '?';

    process.stdout.write(
      `  --- ${pct}% | ${stats.scanned} ok, ${stats.failed} fail | ${formatElapsed()} | ~${eta}m left ---\n\n`
    );

    // Save progress every 5 batches
    if ((i / CONCURRENCY) % 5 === 0) {
      saveProgress(startIndex + i + batch.length);
    }

    if (i + CONCURRENCY < toScan.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN));
    }
  }

  // ── 4. Cleanup ──
  saveProgress(startIndex + toScan.length);
  await browser.close();

  console.log(`\n=== Scan Complete ===`);
  console.log(`  Total:   ${stats.total}`);
  console.log(`  Scanned: ${stats.scanned}`);
  console.log(`  Updated: ${stats.updated} (found tech)`);
  console.log(`  Failed:  ${stats.failed}`);
  console.log(`  Time:    ${formatElapsed()}`);
  console.log(`\n  Results saved to:`);
  console.log(`    ${RESULTS_CSV}`);
  console.log(`    ${RESULTS_JSON}`);
  console.log('');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
