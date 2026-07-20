const axios = require('axios');
const https = require('https');
const http  = require('http');

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
const httpAgent  = new http.Agent({ keepAlive: false });

let _browser = null;
let _browserLaunchFailed = false; // true only if puppeteer is not installed at all
let _browserPageCount = 0;
let _stealthConfigured = false;
const BROWSER_MAX_PAGES = 50; // restart browser every N pages to prevent memory leaks

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--single-process',
  '--no-zygote',
  '--window-size=1920,1080',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
];

// ── Stealth browser launch ──────────────────────────────────────────────
// Detects environment and picks the right Puppeteer strategy.

async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch {}
    _browser = null;
    _browserPageCount = 0;
    console.log('[browser] closed');
  }
}

async function getBrowser() {
  // Restart browser periodically to prevent memory leaks and stale connections
  if (_browser && _browserPageCount >= BROWSER_MAX_PAGES) {
    await closeBrowser();
  }
  if (_browser && _browser.isConnected()) return _browser;
  // If browser exists but disconnected, clean it up
  if (_browser) {
    try { await _browser.close(); } catch {}
    _browser = null;
    _browserPageCount = 0;
  }
  if (_browserLaunchFailed) throw new Error('Browser engine unavailable');

  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

  // ── Serverless (Vercel/Lambda): puppeteer-core + @sparticuz/chromium + stealth ──
  if (isServerless) {
    try {
      const chromium  = require('@sparticuz/chromium');
      const puppeteerCore = require('puppeteer-core');
      chromium.setHeadlessMode = true;
      chromium.setGraphicsMode = false;
      const execPath = await chromium.executablePath();

      // Wrap puppeteer-core with stealth plugin for better bot bypass
      let launcher = puppeteerCore;
      try {
        const { addExtra } = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        launcher = addExtra(puppeteerCore);
        launcher.use(StealthPlugin());
      } catch (stealthErr) {
        console.warn('[getBrowser] stealth plugin unavailable on serverless:', stealthErr.message);
      }

      _browser = await launcher.launch({
        args: [...chromium.args, ...BROWSER_ARGS],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: execPath,
        headless: chromium.headless,
      });
      return _browser;
    } catch (e) {
      console.warn('[getBrowser] serverless chromium failed:', e.message);
    }
  }

  // ── Local/Dev: puppeteer-extra with stealth (best for bypassing bot protection) ──
  try {
    const puppeteerExtra = require('puppeteer-extra');
    if (!_stealthConfigured) {
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      puppeteerExtra.use(StealthPlugin());
      _stealthConfigured = true;
    }
    _browser = await puppeteerExtra.launch({
      headless: 'new',
      args: BROWSER_ARGS,
    });
    return _browser;
  } catch {}

  // ── Fallback: plain puppeteer ──
  try {
    const puppeteer = require('puppeteer');
    _browser = await puppeteer.launch({ headless: true, args: BROWSER_ARGS });
    return _browser;
  } catch {}

  // ── Last resort: puppeteer-core + @sparticuz/chromium (non-serverless) ──
  if (!isServerless) {
    try {
      const chromium  = require('@sparticuz/chromium');
      const puppeteer = require('puppeteer-core');
      _browser = await puppeteer.launch({
        args: [...chromium.args, ...BROWSER_ARGS],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
      return _browser;
    } catch {}
  }

  // Mark as permanently failed (puppeteer not installed) so we don't retry on every request
  _browserLaunchFailed = true;
  console.error('[getBrowser] All browser strategies failed — falling back to axios-only scanning');
  throw new Error('Browser engine unavailable');
}

// ── Standard page fetch (for main page scanning) ────────────────────────

// Patterns that indicate a bot challenge page (not the real content)
const BOT_CHALLENGE_RE = /vercel security checkpoint|cloudflare|just a moment|checking your browser|captcha|<noscript>.*enable javascript/i;
const AKAMAI_CHALLENGE_RE = /akam-challenge|akamai.*bot|_abck|ak_bmsc/i;

async function fetchWithBrowser(url) {
  let browser;
  let page;
  try {
    browser = await getBrowser();
    page = await browser.newPage();
  } catch (err) {
    // If puppeteer is not installed at all, don't retry
    if (_browserLaunchFailed) throw err;
    // Browser connection stale — restart and retry once
    await closeBrowser();
    browser = await getBrowser();
    page = await browser.newPage();
  }
  _browserPageCount++;

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });

  // Hide automation signals
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  let responseHeaders = {};
  const networkUrls = new Set();       // ALL network request URLs
  const allResponseHeaders = {};       // headers from key responses (scripts, XHR)

  page.on('response', (resp) => {
    try {
      const resUrl = resp.url();
      networkUrls.add(resUrl);

      // Capture main page headers
      if (resUrl === url || resUrl === url + '/') {
        responseHeaders = resp.headers();
      }

      // Capture headers from all document/script/xhr responses for tech detection
      const status = resp.status();
      if (status >= 200 && status < 400) {
        const hdrs = resp.headers();
        for (const [k, v] of Object.entries(hdrs)) {
          if (!allResponseHeaders[k]) allResponseHeaders[k] = v;
          // Merge server/x-powered-by from sub-requests (common tech signals)
          else if (k === 'server' || k === 'x-powered-by' || k.startsWith('x-')) {
            allResponseHeaders[k] += ', ' + v;
          }
        }
      }
    } catch {}
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Check if we're on a bot challenge page — if so, wait for it to resolve
    let html = await page.content();
    if (html.length < 2000 || BOT_CHALLENGE_RE.test(html.slice(0, 3000)) || AKAMAI_CHALLENGE_RE.test(html.slice(0, 5000))) {
      // Try multiple rounds of waiting for challenge to resolve (Cloudflare Turnstile can take up to 30s)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          await new Promise(r => setTimeout(r, 1500));
        } catch {
          await new Promise(r => setTimeout(r, 5000));
        }
        html = await page.content();
        if (html.length > 5000 && !BOT_CHALLENGE_RE.test(html.slice(0, 3000))) break;
      }
    }

    // Collect script srcs from DOM + all network script URLs
    const domScriptSrcs = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')].map(s => s.src)
    );
    // Merge network-intercepted URLs that look like scripts/tracking
    const networkScriptUrls = [...networkUrls].filter(u =>
      /\.js(\?|$)/i.test(u) || /tag|gtm|analytics|pixel|tracker|segment|hotjar|clarity|sentry|cdn/i.test(u)
    );
    const scriptSrcs = [...new Set([...domScriptSrcs, ...networkScriptUrls])];

    // Extract cookies for tech detection (e.g., _ga, _fbp, hubspotutk)
    let cookies = [];
    try { cookies = await page.cookies(); } catch {}
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Extract JS globals that reveal technologies
    const jsGlobals = await page.evaluate(() => {
      const g = {};
      try { if (window.dataLayer) g.dataLayer = true; } catch {}
      try { if (window.__NEXT_DATA__) g.nextjs = true; } catch {}
      try { if (window.__NUXT__) g.nuxt = true; } catch {}
      try { if (window.Shopify) g.shopify = true; } catch {}
      try { if (window.Webflow) g.webflow = true; } catch {}
      try { if (window.wixDeveloperAnalytics) g.wix = true; } catch {}
      try { if (window.angular || document.querySelector('[ng-version]')) g.angular = true; } catch {}
      try { if (window.__GATSBY) g.gatsby = true; } catch {}
      try { if (window.__remixContext) g.remix = true; } catch {}
      try { if (window.Sentry) g.sentry = true; } catch {}
      try { if (window.fbq) g.facebookPixel = true; } catch {}
      try { if (window.gtag || window.google_tag_manager) g.gtm = true; } catch {}
      try { if (window.hj || window._hjSettings) g.hotjar = true; } catch {}
      try { if (window.Intercom) g.intercom = true; } catch {}
      try { if (window.drift) g.drift = true; } catch {}
      try { if (window.zE || window.zESettings) g.zendesk = true; } catch {}
      try { if (window.HubSpotConversations || window._hsq) g.hubspot = true; } catch {}
      try { if (window.Stripe) g.stripe = true; } catch {}
      try { if (window.klpiframe || document.querySelector('[class*="klaviyo"]')) g.klaviyo = true; } catch {}
      try { if (window.__svelte_meta) g.svelte = true; } catch {}
      try { if (window.React || document.querySelector('[data-reactroot]') || document.querySelector('#__next')) g.react = true; } catch {}
      try { if (window.__VUE__ || document.querySelector('[data-v-]')) g.vue = true; } catch {}
      try { if (window.Akamai || window.BOOMR) g.akamai = true; } catch {}
      try { if (window.optimizely) g.optimizely = true; } catch {}
      try { if (window.amplitude) g.amplitude = true; } catch {}
      try { if (window.mixpanel) g.mixpanel = true; } catch {}
      try { if (window.FS || window._fs_namespace) g.fullstory = true; } catch {}
      try { if (window.Raven || window.Sentry) g.sentry = true; } catch {}
      try { if (window.DD_RUM) g.datadog = true; } catch {}
      try { if (window.newrelic || window.NREUM) g.newrelic = true; } catch {}
      try { if (window.LogRocket) g.logrocket = true; } catch {}
      try { if (window.dtrum || window.dT_ || window.dynatrace) g.dynatrace = true; } catch {}
      return g;
    }).catch(() => ({}));

    // Merge all response headers for broader detection
    const mergedHeaders = { ...allResponseHeaders, ...responseHeaders };

    return { html, headers: mergedHeaders, scriptSrcs, cookies: cookieStr, jsGlobals, networkUrls: [...networkUrls] };
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
    timeout: 3000,
    maxRedirects: 3,
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
    const val  = /content=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!val) continue;
    // Capture name= attributes
    const name = /name=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (name) map[name] = val;
    // Also capture property= attributes (og:*, article:*, etc.)
    const prop = /property=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (prop && !map[prop]) map[prop] = val;
  }
  return map;
}

function normalizeUrl(url) {
  return url.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/+$/, '').toLowerCase();
}

module.exports = {
  getBrowser,
  closeBrowser,
  fetchWithBrowser,
  fetchWithAxios,
  scrapeStoreLocatorPage,
  extractScriptSrcs,
  extractMetaMap,
  normalizeUrl,
};
