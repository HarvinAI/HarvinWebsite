const { detect } = require('./detect');
const { fetchWithBrowser, fetchWithAxios, extractScriptSrcs, extractMetaMap, normalizeUrl } = require('./fetch');
const { getDb } = require('./db');
const { extractCompanyMeta } = require('./companyMeta');

async function scanSingleUrl(rawUrl, { forceRefresh = false } = {}) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let html = '', headers = {}, scriptSrcs = [];
  let axiosError = null;

  // Try axios first (fast, ~1-2s), fall back to browser only if needed
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

  // Decide if we need browser fallback
  const isBlocked = !html || html.length < 1000 ||
    /vercel security checkpoint|cloudflare|just a moment|checking your browser|captcha/i.test((html || '').slice(0, 2000));

  if (isBlocked) {
    try {
      const result = await fetchWithBrowser(url);
      html       = result.html || html;
      headers    = result.headers || headers;
      scriptSrcs = result.scriptSrcs || extractScriptSrcs(html);
    } catch {
      // Browser failed — continue with whatever axios gave us (even if blocked/empty)
      // If axios also completely failed, throw a user-friendly error
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
      // Otherwise continue with the blocked/small axios response
      scriptSrcs = scriptSrcs.length ? scriptSrcs : extractScriptSrcs(html || '');
    }
  }

  const metaMap = extractMetaMap(html);

  // Run tech detection and company meta in parallel (they're independent)
  const [technologies, companyMeta] = await Promise.all([
    (async () => {
      let techs = detect({ html, headers, scriptSrcs, metaMap });

      // Apply corrections from DB
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

      return techs;
    })(),
    extractCompanyMeta({
      url, html, headers, metaMap, technologies: detect({ html, headers, scriptSrcs, metaMap }),
      fetchPage: fetchWithAxios,
      browserFetch: fetchWithBrowser,
      forceRefresh,
    }).catch(err => {
      console.warn(`[companyMeta] extraction failed: ${err.message}`);
      return { category: 'Unknown', subCategory: 'General', region: 'Global', offlineStores: 'Unknown' };
    }),
  ]);

  return { url, technologies, count: technologies.length, companyMeta };
}

module.exports = { scanSingleUrl };
