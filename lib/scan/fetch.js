const axios = require('axios');
const https = require('https');
const http  = require('http');

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
const httpAgent  = new http.Agent({ keepAlive: false });

let _browser = null;

// ── Stealth browser launch ──────────────────────────────────────────────
// Uses puppeteer-extra + stealth plugin to bypass Vercel, Cloudflare, etc.

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  // Try 1: puppeteer-extra with stealth (best for bypassing bot protection)
  try {
    const puppeteerExtra = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteerExtra.use(StealthPlugin());
    _browser = await puppeteerExtra.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });
    return _browser;
  } catch {}

  // Try 2: plain puppeteer (local dev)
  try {
    const puppeteer = require('puppeteer');
    _browser = await puppeteer.launch({ headless: true });
    return _browser;
  } catch {}

  // Try 3: puppeteer-core + @sparticuz/chromium (serverless)
  try {
    const chromium  = require('@sparticuz/chromium');
    const puppeteer = require('puppeteer-core');
    _browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    return _browser;
  } catch {}

  throw new Error('No Puppeteer runtime available');
}

// ── Standard page fetch (for main page scanning) ────────────────────────

async function fetchWithBrowser(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });

  let responseHeaders = {};
  page.on('response', (resp) => {
    if (resp.url() === url || resp.url() === url + '/') {
      try { responseHeaders = resp.headers(); } catch {}
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));

    const html = await page.content();
    const scriptSrcs = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')].map(s => s.src)
    );

    return { html, headers: responseHeaders, scriptSrcs };
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Deep store scraper (for store locator pages behind bot protection) ──
// Waits for SPA content to render, intercepts XHR store API calls,
// and extracts store data from the fully-rendered page.

async function scrapeStoreLocatorPage(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture XHR/fetch responses that look like store data
  const capturedApiData = [];
  page.on('response', async (response) => {
    const resUrl = response.url();
    const status = response.status();
    if (status !== 200) return;

    // Skip non-data responses
    if (/google-analytics|googletagmanager|facebook\.com|hotjar|clarity\.ms|doubleclick|sentry\.io/i.test(resUrl)) return;
    if (/\.css|\.png|\.jpg|\.gif|\.svg|\.webp|\.woff|\.ttf|\.eot/i.test(resUrl)) return;

    // Check if it looks like a store/location API
    if (/store|location|branch|outlet|locator|dealer|find.*store/i.test(resUrl)) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json') || contentType.includes('text')) {
          const text = await response.text();
          try {
            const parsed = JSON.parse(text);
            capturedApiData.push({ url: resUrl, data: parsed, size: text.length });
          } catch {}
        }
      } catch {}
    }
  });

  try {
    // Navigate with networkidle0 for SPAs — wait until all requests settle
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });

    // Extra wait for lazy-loaded content
    await new Promise(r => setTimeout(r, 1000));

    // Try to trigger "View All" / "Show All" / "Load More" if present
    await tryLoadAllStores(page);

    const html = await page.content();

    return {
      html,
      capturedApiData,
      page, // caller must close
    };
  } catch (err) {
    await page.close().catch(() => {});
    throw err;
  }
}

// ── Try to load all stores on a SPA page ────────────────────────────────

async function tryLoadAllStores(page) {
  // Strategy 1: Click "View All" / "Show All" buttons
  const viewAllTexts = ['View All', 'Show All', 'All Stores', 'See All', 'All Locations', 'View all stores', 'Show all stores'];
  for (const text of viewAllTexts) {
    try {
      const el = await page.$(`xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | .//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`);
      if (el) {
        await el.click();
        await new Promise(r => setTimeout(r, 1000));
        return;
      }
    } catch {}
  }

  // Strategy 2: Click "Load More" repeatedly
  let loadMoreClicked = 0;
  while (loadMoreClicked < 30) {
    try {
      const btn = await page.$(`xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'load more')] | .//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'show more')] | .//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'load more')]`);
      if (!btn) break;
      await btn.click();
      await new Promise(r => setTimeout(r, 1000));
      loadMoreClicked++;
    } catch { break; }
  }

  // Strategy 3: Search with broad term if search input exists
  const searchSelectors = [
    'input[placeholder*="search" i]',
    'input[placeholder*="city" i]',
    'input[placeholder*="location" i]',
    'input[placeholder*="pincode" i]',
    'input[placeholder*="zip" i]',
    'input[type="search"]',
  ];
  for (const selector of searchSelectors) {
    try {
      const input = await page.$(selector);
      if (input) {
        await input.click({ clickCount: 3 }); // select all existing text
        await input.type('India', { delay: 30 });
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 1000));
        return;
      }
    } catch {}
  }
}

// ── Axios fetch ─────────────────────────────────────────────────────────

async function fetchWithAxios(url) {
  const opts = {
    timeout: 5000,
    maxRedirects: 5,
    httpsAgent,
    httpAgent,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'close',
      'Upgrade-Insecure-Requests': '1',
    },
    responseType: 'text',
  };

  try {
    return await axios.get(url, opts);
  } catch (firstErr) {
    const isConnErr = ['ECONNRESET', 'ECONNREFUSED', 'EPROTO',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED',
      'ERR_TLS_CERT_ALTNAME_INVALID'].includes(firstErr.code);

    if (isConnErr && url.startsWith('https://')) {
      const httpUrl = url.replace(/^https:\/\//, 'http://');
      return await axios.get(httpUrl, { ...opts, httpsAgent: undefined });
    }
    throw firstErr;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function extractScriptSrcs(html) {
  const srcs = [];
  const rx = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = rx.exec(html)) !== null) srcs.push(m[1]);
  return srcs;
}

function extractMetaMap(html) {
  const map = {};
  const rx = /<meta[^>]+>/gi;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const tag  = m[0];
    const name = /name=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const val  = /content=["']([^"']+)["']/i.exec(tag)?.[1];
    if (name && val) map[name] = val;
  }
  return map;
}

function normalizeUrl(url) {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
}

module.exports = {
  getBrowser,
  fetchWithBrowser,
  fetchWithAxios,
  scrapeStoreLocatorPage,
  extractScriptSrcs,
  extractMetaMap,
  normalizeUrl,
};
