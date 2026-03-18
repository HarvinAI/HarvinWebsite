const { detect } = require('./detect');
const { fetchWithBrowser, fetchWithAxios, extractScriptSrcs, extractMetaMap, normalizeUrl } = require('./fetch');
const { getDb } = require('./db');
const { extractCompanyMeta } = require('./companyMeta');

async function scanSingleUrl(rawUrl, { forceRefresh = false, pageData = null } = {}) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const normalizedDomain = url.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/.*$/, '').toLowerCase();

  // ── Fast path: check KNOWN_BRANDS + DB cache BEFORE any network calls ──
  const { lookupKnownBrand } = require('./companyMeta');
  const knownBrand = lookupKnownBrand(normalizedDomain);

  let cachedMeta = null;
  if (!forceRefresh) {
    // Known brands: instant response — no need to re-scan store/region/category
    if (knownBrand) {
      cachedMeta = {
        category: knownBrand.category,
        subCategory: knownBrand.subCategory || 'General',
        region: knownBrand.region || 'Global',
        offlineStores: knownBrand.onlineOnly ? 'Online' : (knownBrand.stores || 'Unknown'),
        storeRawCount: 0,
        storeConfidence: { score: 90, tier: 'high', source: 'known_brand', flags: [] },
        businessModel: null,
      };
    }

    // DB cache: use if fresh enough and data is solid
    if (!cachedMeta) {
      try {
        const db = await getDb();
        const cached = await db.collection('company_meta').findOne({ normalizedDomain });
        if (cached && cached.expiresAt && new Date(cached.expiresAt) > new Date()
            && cached.category && cached.category !== 'Unknown'
            && cached.region) {
          cachedMeta = {
            category: knownBrand?.category || cached.overrides?.category || cached.category,
            subCategory: knownBrand?.subCategory || cached.overrides?.subCategory || cached.subCategory,
            region: knownBrand?.region || cached.overrides?.region || cached.region,
            offlineStores: knownBrand?.stores || cached.overrides?.offlineStores || cached.offlineStores,
            storeRawCount: cached.storeRawCount || 0,
            storeConfidence: cached.storeConfidence || null,
            businessModel: cached.businessModel || null,
            appPresence: cached.appPresence || null,
          };
        }
      } catch {}
    }
  }

  // ── Extension signals ──
  let cookies = '', jsGlobals = {}, networkUrls = [];
  const hasExtensionData = !!pageData;
  if (pageData) {
    cookies     = pageData.cookies || '';
    jsGlobals   = pageData.jsGlobals || {};
    networkUrls = pageData.networkUrls || [];
  }

  // ── Fetch HTML ──
  let html = '', headers = {}, scriptSrcs = [];
  let axiosError = null;
  let axiosHtml = '';

  // If extension sent sanitized HTML, use it directly (it's from the real browser)
  if (pageData?.html && pageData.html.length > 500) {
    html       = pageData.html;
    scriptSrcs = pageData.scriptSrcs || extractScriptSrcs(html);
  } else {
    // Server-side fetch
    try {
      const resp = await fetchWithAxios(url);
      axiosHtml  = typeof resp.data === 'string' ? resp.data : '';
      html       = axiosHtml;
      headers    = resp.headers || {};
      scriptSrcs = extractScriptSrcs(html);
    } catch (err) {
      axiosError = err;
    }
  }

  // Browser fallback — only when NO extension data AND axios was blocked
  const isBlocked = !html || html.length < 1000 ||
    /vercel security checkpoint|cloudflare|just a moment|checking your browser|captcha|akam|_abck/i.test((html || '').slice(0, 5000));

  // Hard errors for DNS/network failures
  if (!axiosHtml && !hasExtensionData && axiosError) {
    const code = axiosError.code;
    if (code === 'ENOTFOUND') throw new Error('Domain not found — check the URL and try again');
    if (code === 'ECONNREFUSED') throw new Error('Connection refused — the site may be down');
  }

  if (isBlocked && !hasExtensionData) {
    // Browser fallback — 12s max. If it fails, continue with whatever we have.
    try {
      const result = await Promise.race([
        fetchWithBrowser(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('browser_timeout')), 12000)),
      ]);
      html       = result.html || html;
      headers    = result.headers || headers;
      scriptSrcs = result.scriptSrcs || extractScriptSrcs(html);
      cookies    = result.cookies || cookies;
      jsGlobals  = result.jsGlobals || jsGlobals;
      networkUrls = result.networkUrls || networkUrls;
    } catch {
      // Browser failed — that's OK, continue with partial data (headers, known brand, sitemap)
      scriptSrcs = scriptSrcs.length ? scriptSrcs : extractScriptSrcs(html || '');
    }
  }

  // Merge extension scriptSrcs
  if (pageData?.scriptSrcs?.length) {
    const existing = new Set(scriptSrcs);
    for (const src of pageData.scriptSrcs) {
      if (!existing.has(src)) scriptSrcs.push(src);
    }
  }

  // ── Fallback for blocked pages — sitemap only (fast, skip wayback) ──
  const BLOCKED_PAGE_RE = /just a moment|checking your browser|cloudflare.*challenge|you have been blocked|unable to access|cf-error-details|sorry.*blocked/i;
  const stillBlocked = !html || html.length < 2000 ||
    BLOCKED_PAGE_RE.test((html || '').slice(0, 5000));

  let analysisHtml = html;
  if (stillBlocked) {
    // Try sitemap quickly (3s timeout) — skip wayback entirely (too slow)
    try {
      const baseUrl = url.replace(/\/$/, '');
      const sitemapResp = await Promise.race([
        fetchWithAxios(baseUrl + '/sitemap.xml').catch(() => null),
        new Promise(resolve => setTimeout(() => resolve(null), 3000)),
      ]);
      const sitemapData = typeof sitemapResp?.data === 'string' ? sitemapResp.data : '';
      if (sitemapData.length > 50) {
        const sitemapUrls = (sitemapData.match(/<loc>([^<]+)<\/loc>/gi) || [])
          .map(m => m.replace(/<\/?loc>/gi, '')).join(' ');
        analysisHtml = `<title>${html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''}</title><body>${sitemapUrls} ${sitemapData.slice(0, 5000)}</body>`;
      }
    } catch {}
  }

  const metaMap = pageData?.metaMap || extractMetaMap(html);

  // Check if we have ANY usable content for tech detection
  const hasUsableContent = (html && html.length > 2000 && !stillBlocked)
    || scriptSrcs.length > 0
    || (cookies && cookies.length > 10)
    || Object.keys(jsGlobals).length > 0
    || networkUrls.length > 0;

  // ── Tech detection + company meta — run in parallel ──
  const techsPromise = (async () => {
    let techs = detect({ html, headers, scriptSrcs, metaMap, cookies, jsGlobals, networkUrls });
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

      // If detection found very few techs, check if extension previously cached better results
      if (techs.length < 5) {
        const cached = await db.collection('tech_cache').findOne({ domain: normalizedDomain });
        if (cached && cached.count > techs.length) {
          techs = cached.technologies;
        }
      }
    } catch {}
    return techs;
  })();

  const metaPromise = cachedMeta
    ? Promise.resolve(cachedMeta)
    : extractCompanyMeta({
        url, html: analysisHtml, headers, metaMap,
        technologies: [],
        fetchPage: fetchWithAxios,
        browserFetch: fetchWithBrowser,
        forceRefresh,
      }).catch(err => {
        console.warn(`[companyMeta] extraction failed: ${err.message}`);
        return { category: 'Unknown', subCategory: 'General', region: 'Global', offlineStores: 'Unknown' };
      });

  const [techs, companyMeta] = await Promise.all([techsPromise, metaPromise]);

  const { storeConfidence, ...publicMeta } = companyMeta;
  const result = { url, technologies: techs, count: techs.length, companyMeta: publicMeta };

  // If site was bot-protected and we got no techs, flag it so the UI can tell the user
  if (!hasUsableContent && techs.length === 0) {
    result.blocked = true;
    result.message = 'This site has strong bot protection. For full results, use the HarvinAI Chrome extension which scans from your real browser.';
  }

  return result;
}

module.exports = { scanSingleUrl };
