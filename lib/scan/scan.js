const { detect } = require('./detect');
const { fetchWithBrowser, fetchWithAxios, extractScriptSrcs, extractMetaMap, normalizeUrl } = require('./fetch');
const { getDb } = require('./db');
const { extractCompanyMeta } = require('./companyMeta');

async function scanSingleUrl(rawUrl, { forceRefresh = false } = {}) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let html, headers, scriptSrcs;

  // Try axios first (fast, ~1-2s), fall back to browser only if needed
  try {
    const resp = await fetchWithAxios(url);
    html       = typeof resp.data === 'string' ? resp.data : '';
    headers    = resp.headers || {};
    scriptSrcs = extractScriptSrcs(html);

    // If we got a challenge page or too-small response, fall back to browser
    const isBlocked = html.length < 1000 ||
      /vercel security checkpoint|cloudflare|just a moment|checking your browser|captcha/i.test(html.slice(0, 2000));
    if (isBlocked) throw new Error('blocked');
  } catch {
    // Browser fallback for blocked/failed sites
    try {
      const result = await fetchWithBrowser(url);
      html       = result.html;
      headers    = result.headers || {};
      scriptSrcs = result.scriptSrcs || extractScriptSrcs(html);
    } catch (browserErr) {
      // If browser also fails, use whatever we got from axios (or empty)
      if (!html) throw browserErr;
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
