const axios = require('axios');
const https = require('https');
const http  = require('http');

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
const httpAgent  = new http.Agent({ keepAlive: false });

let _browser = null;

async function fetchWithBrowser(url) {
  let chromium, puppeteer;
  try {
    chromium  = require('@sparticuz/chromium');
    puppeteer = require('puppeteer-core');
  } catch {
    throw new Error('Browser dependencies not available — falling back to HTTP');
  }

  if (!_browser || !_browser.isConnected()) {
    _browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  const page = await _browser.newPage();
  let responseHeaders = {};
  page.on('response', (resp) => {
    if (resp.url() === url || resp.url() === url + '/') {
      try { responseHeaders = resp.headers(); } catch {}
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const html = await page.content();
    const scriptSrcs = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')].map(s => s.src)
    );

    return { html, headers: responseHeaders, scriptSrcs };
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchWithAxios(url) {
  const opts = {
    timeout: 15000,
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

module.exports = { fetchWithBrowser, fetchWithAxios, extractScriptSrcs, extractMetaMap, normalizeUrl };
