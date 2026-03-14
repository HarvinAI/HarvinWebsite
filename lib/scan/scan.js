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
        // Skip cache if store data was from unreliable fallback (needs re-detection)
        const storeSource = cached.storeConfidence?.source;
        const isStoreDataWeak = storeSource === 'header_footer_link' || storeSource === 'timeout'
          || (!storeSource && cached.offlineStores && cached.offlineStores !== 'Online' && cached.storeRawCount === 0);
        if (!isStoreDataWeak) {
          cachedMeta = {
            category: cached.overrides?.category || cached.category,
            subCategory: cached.overrides?.subCategory || cached.subCategory,
            region: cached.overrides?.region || cached.region,
            offlineStores: cached.overrides?.offlineStores || cached.offlineStores,
            storeRawCount: cached.storeRawCount || 0,
            storeConfidence: cached.storeConfidence || null,
            businessModel: cached.businessModel || null,
          };
        }
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
    /vercel security checkpoint|cloudflare|just a moment|checking your browser|captcha|akam|_abck/i.test((html || '').slice(0, 5000));

  if (isBlocked) {
    try {
      const result = await Promise.race([
        fetchWithBrowser(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('browser_timeout')), 60000)),
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

  // ── If still blocked after browser, try sitemap.xml for category hints ──
  const BLOCKED_PAGE_RE = /just a moment|checking your browser|cloudflare.*challenge|you have been blocked|unable to access|cf-error-details|sorry.*blocked/i;
  const stillBlocked = !html || html.length < 2000 ||
    BLOCKED_PAGE_RE.test((html || '').slice(0, 5000));

  let sitemapHtml = '';
  if (stillBlocked) {
    try {
      const baseUrl = url.replace(/\/$/, '');
      const sitemapResp = await fetchWithAxios(baseUrl + '/sitemap.xml').catch(() => null);
      const robotsResp = !sitemapResp ? await fetchWithAxios(baseUrl + '/robots.txt').catch(() => null) : null;
      const sitemapData = typeof sitemapResp?.data === 'string' ? sitemapResp.data : '';
      const robotsData = typeof robotsResp?.data === 'string' ? robotsResp.data : '';

      // Extract URLs from sitemap for keyword hints
      const sitemapUrls = (sitemapData.match(/<loc>([^<]+)<\/loc>/gi) || [])
        .map(m => m.replace(/<\/?loc>/gi, '')).join(' ');
      // Extract sitemap URLs from robots.txt
      const robotsSitemaps = (robotsData.match(/Sitemap:\s*(.+)/gi) || [])
        .map(m => m.replace(/Sitemap:\s*/i, '')).join(' ');

      sitemapHtml = sitemapUrls + ' ' + robotsSitemaps + ' ' + sitemapData.slice(0, 5000);
      if (sitemapHtml.trim().length > 50) {
        console.log(`[scan] Main page blocked, using sitemap data (${sitemapHtml.length} chars) for ${url}`);
      }
    } catch {}
  }

  // ── Wayback Machine fallback: when page + sitemap are both blocked ──
  let waybackHtml = '';
  if (stillBlocked && sitemapHtml.trim().length <= 50) {
    try {
      const domain = url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const wbResp = await fetchWithAxios(`https://archive.org/wayback/available?url=${encodeURIComponent(domain)}`);
      const snapshot = wbResp?.data?.archived_snapshots?.closest;
      if (snapshot?.available && snapshot.url) {
        const archiveResp = await Promise.race([
          fetchWithAxios(snapshot.url),
          new Promise((_, reject) => setTimeout(() => reject(new Error('wayback_timeout')), 15000)),
        ]);
        waybackHtml = typeof archiveResp?.data === 'string' ? archiveResp.data : '';
        // Strip Wayback Machine's toolbar/injection to get clean content
        waybackHtml = waybackHtml.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, '');
        if (waybackHtml.length > 500) {
          console.log(`[scan] Using Wayback Machine snapshot (${waybackHtml.length} chars) for ${url}`);
        }
      }
    } catch {}
  }

  // Merge fallback data into html for keyword analysis if main page was blocked
  let analysisHtml = html;
  if (stillBlocked) {
    if (waybackHtml.length > 500) {
      // Wayback gives us full page content — best fallback
      analysisHtml = waybackHtml;
    } else if (sitemapHtml.length > 50) {
      analysisHtml = `<title>${html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''}</title><body>${sitemapHtml}</body>`;
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
      url, html: analysisHtml, headers, metaMap,
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
