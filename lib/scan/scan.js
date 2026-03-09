const { detect } = require('./detect');
const { fetchWithBrowser, fetchWithAxios, extractScriptSrcs, extractMetaMap, normalizeUrl } = require('./fetch');
const { getDb } = require('./db');
const { extractCompanyMeta } = require('./companyMeta');

async function scanSingleUrl(rawUrl, { forceRefresh = false } = {}) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const normalizedDomain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();

  // ── Fast path: check DB cache FIRST before any network calls ──
  let cachedMeta = null;
  if (!forceRefresh) {
    try {
      const db = await getDb();
      const cached = await db.collection('company_meta').findOne({ normalizedDomain });
      if (cached && cached.expiresAt && new Date(cached.expiresAt) > new Date()
          && cached.category && cached.subCategory && cached.region) {
        cachedMeta = {
          category: cached.overrides?.category || cached.category,
          subCategory: cached.overrides?.subCategory || cached.subCategory,
          region: cached.overrides?.region || cached.region,
          offlineStores: cached.overrides?.offlineStores || cached.offlineStores,
          storeConfidence: cached.storeConfidence || null,
        };
      }
    } catch {}
  }

  // ── Fetch HTML (with tight timeout) ──
  let html = '', headers = {}, scriptSrcs = [];
  let axiosError = null;
  let axiosHtml = '';

  try {
    const resp = await fetchWithAxios(url);
    axiosHtml  = typeof resp.data === 'string' ? resp.data : '';
    html       = axiosHtml;
    headers    = resp.headers || {};
    scriptSrcs = extractScriptSrcs(html);
  } catch (err) {
    axiosError = err;
  }

  // Browser fallback when axios returned blocked/empty HTML — needed for tech detection
  const isBlocked = !html || html.length < 1000 ||
    /vercel security checkpoint|cloudflare|just a moment|checking your browser|captcha/i.test((html || '').slice(0, 2000));

  if (isBlocked) {
    try {
      const result = await Promise.race([
        fetchWithBrowser(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('browser_timeout')), 5000)),
      ]);
      html       = result.html || html;
      headers    = result.headers || headers;
      scriptSrcs = result.scriptSrcs || extractScriptSrcs(html);
    } catch {
      if (!axiosHtml && axiosError) {
        const code = axiosError.code;
        const status = axiosError.response?.status;
        if (code === 'ENOTFOUND') throw new Error('Domain not found — check the URL and try again');
        if (code === 'ECONNABORTED') throw new Error('Request timed out — the site took too long to respond');
        if (code === 'ECONNREFUSED') throw new Error('Connection refused — the site may be down');
        if (code === 'ECONNRESET') throw new Error('Connection reset — the site dropped the connection');
        if (status) throw new Error(`Target returned HTTP ${status}`);
        throw new Error('Could not reach this website — check the URL and try again');
      }
      scriptSrcs = scriptSrcs.length ? scriptSrcs : extractScriptSrcs(html || '');
    }
  }

  const metaMap = extractMetaMap(html);

  // ── Tech detection (always runs, fast ~50ms) ──
  let techs = detect({ html, headers, scriptSrcs, metaMap });
  try {
    const db = await getDb();
    const normalized = normalizeUrl(url);
    const corrections = await db.collection('corrections').find({ normalizedUrl: normalized }).toArray();
    const falsePositives = new Set(
      corrections.filter(c => c.type === 'false_positive').map(c => c.techName)
    );
    if (falsePositives.size > 0) {
      techs = techs.filter(t => !falsePositives.has(t.name));
    }
    const existingNames = new Set(techs.map(t => t.name));
    const missing = corrections.filter(c => c.type === 'missing' && !existingNames.has(c.techName));
    for (const m of missing) {
      techs.push({ name: m.techName, category: m.category || 'Other', color: m.color || '#6B7280' });
    }
  } catch {}

  // ── Company meta: use cache or extract fresh ──
  let companyMeta;
  if (cachedMeta) {
    companyMeta = cachedMeta;
  } else {
    companyMeta = await extractCompanyMeta({
      url, html, headers, metaMap,
      technologies: techs,
      fetchPage: fetchWithAxios,
      browserFetch: fetchWithBrowser,
      forceRefresh,
    }).catch(err => {
      console.warn(`[companyMeta] extraction failed: ${err.message}`);
      return { category: 'Unknown', subCategory: 'General', region: 'Global', offlineStores: 'Unknown' };
    });
  }

  // Strip storeConfidence from response — internal use only
  const { storeConfidence, ...publicMeta } = companyMeta;
  return { url, technologies: techs, count: techs.length, companyMeta: publicMeta };
}

module.exports = { scanSingleUrl };
