const { detect } = require('./detect');
const { fetchWithBrowser, fetchWithAxios, extractScriptSrcs, extractMetaMap, normalizeUrl } = require('./fetch');
const { getDb } = require('./db');
const { extractCompanyMeta } = require('./companyMeta');

async function scanSingleUrl(rawUrl, { forceRefresh = false } = {}) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let html, headers, scriptSrcs;

  // Try browser first, fall back to axios
  try {
    const result = await fetchWithBrowser(url);
    html       = result.html;
    headers    = result.headers || {};
    scriptSrcs = result.scriptSrcs || extractScriptSrcs(html);
  } catch (browserErr) {
    console.warn(`[browser] ${browserErr.message}`);
    const resp = await fetchWithAxios(url);
    html       = typeof resp.data === 'string' ? resp.data : '';
    headers    = resp.headers || {};
    scriptSrcs = extractScriptSrcs(html);
  }

  const metaMap = extractMetaMap(html);
  let technologies = detect({ html, headers, scriptSrcs, metaMap });

  // Apply corrections from DB
  try {
    const db = await getDb();
    const normalized = normalizeUrl(url);
    const corrections = await db.collection('corrections').find({ normalizedUrl: normalized }).toArray();

    const falsePositives = new Set(
      corrections.filter(c => c.type === 'false_positive').map(c => c.techName)
    );
    if (falsePositives.size > 0) {
      technologies = technologies.filter(t => !falsePositives.has(t.name));
    }

    const existingNames = new Set(technologies.map(t => t.name));
    const missing = corrections.filter(c => c.type === 'missing' && !existingNames.has(c.techName));
    for (const m of missing) {
      technologies.push({
        name: m.techName,
        category: m.category || 'Other',
        color: m.color || '#6B7280',
      });
    }
  } catch (dbErr) {
    console.warn(`[mongo] corrections lookup failed: ${dbErr.message}`);
  }

  let companyMeta;
  try {
    companyMeta = await extractCompanyMeta({
      url, html, headers, metaMap, technologies,
      fetchPage: fetchWithAxios,
      browserFetch: fetchWithBrowser,
      forceRefresh,
    });
  } catch (err) {
    console.warn(`[companyMeta] extraction failed: ${err.message}`);
    companyMeta = { category: 'Unknown', subCategory: 'General', region: 'Global', offlineStores: 'Unknown' };
  }

  return { url, technologies, count: technologies.length, companyMeta };
}

module.exports = { scanSingleUrl };
