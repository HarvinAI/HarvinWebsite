const { detect } = require('./detect');
const { fetchWithBrowser, fetchWithAxios, extractScriptSrcs, extractMetaMap, normalizeUrl } = require('./fetch');
const { getDb } = require('./db');
const { extractCompanyMeta, CLASSIFIER_VERSION } = require('./companyMeta');

// ── Head-only extraction ────────────────────────────────────────────────
// Tech-stack detection is intentionally restricted to the document <head>.
// Everything a site declares about its stack — meta generators, preconnects,
// head <script src>, JSON-LD, favicons, CMS/framework hints — lives in <head>.
// Scanning <body> (and runtime signals like network requests / JS globals)
// pulls in third-party embeds & pixels that inflate the list with noise.
// NOTE: this restriction applies ONLY to tech detection. companyMeta / app
// presence still get the full HTML (they need <body>).
function extractHead(fullHtml) {
  if (!fullHtml || typeof fullHtml !== 'string') return '';
  const m = fullHtml.match(/<head[\s>][\s\S]*?<\/head>/i);
  if (m) return m[0];
  // No explicit </head> — fall back to everything before <body>.
  const bodyIdx = fullHtml.search(/<body[\s>]/i);
  if (bodyIdx > 0) return fullHtml.slice(0, bodyIdx);
  return fullHtml;
}

async function scanSingleUrl(rawUrl, { forceRefresh = false, pageData = null, metaOnly = false } = {}) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const normalizedDomain = url.replace(/^https?:\/\//i, '')
    .replace(/^www\d*\./i, '')
    .replace(/^(?:en|ar|fr|de|es|it|pt|ja|ko|zh|ru|hi|th|vi|m|mobile|shop|store|app)[-_.]/i, '')
    .replace(/\/.*$/, '').toLowerCase();

  // ── Fast path: check KNOWN_BRANDS + DB cache BEFORE any network calls ──
  const { lookupKnownBrand } = require('./companyMeta');
  const knownBrand = lookupKnownBrand(normalizedDomain);

  let cachedMeta = null;
  if (!forceRefresh) {
    // Check DB cache first — works for both known brands and regular domains
    try {
      const db = await getDb();
      const cached = await db.collection('company_meta').findOne({ normalizedDomain });
      // Only trust cached classification if it was produced by the current
      // classifier version — otherwise re-scan so logic fixes reach old data.
      // (Known brands bypass this: their category comes from KNOWN_BRANDS below.)
      const cacheFresh = cached && (knownBrand || cached.classifierVersion === CLASSIFIER_VERSION);
      if (cacheFresh && cached.category && cached.category !== 'Unknown' && cached.region) {
        cachedMeta = {
          category: knownBrand?.category || cached.overrides?.category || cached.category,
          subCategory: knownBrand?.subCategory || cached.overrides?.subCategory || cached.subCategory,
          region: knownBrand?.region || cached.overrides?.region || cached.region,
          offlineStores: knownBrand?.stores || cached.overrides?.offlineStores || cached.offlineStores,
          storeRawCount: cached.storeRawCount || 0,
          storeConfidence: cached.storeConfidence || null,
          businessModel: cached.businessModel || null,
          appPresence: cached.appPresence || null,
          categoryConfidence: knownBrand ? 'high' : (cached.categoryConfidence || null),
        };
      }
    } catch {}

    // Known brand fallback if not in DB yet
    if (!cachedMeta && knownBrand) {
      cachedMeta = {
        category: knownBrand.category,
        subCategory: knownBrand.subCategory || 'General',
        region: knownBrand.region || 'Global',
        offlineStores: knownBrand.onlineOnly ? 'Online' : (knownBrand.stores || 'Unknown'),
        storeRawCount: 0,
        storeConfidence: { score: 90, tier: 'high', source: 'known_brand', flags: [] },
        businessModel: null,
        appPresence: null,
      };
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
    // Restrict the *generic* HTML/script matching to the <head> only (see
    // extractHead above): scanning <body> pulls in third-party embeds & pixels
    // that inflate the list with noise from the broad TECH html/scripts regexes.
    //
    // Runtime signals — cookies, JS globals, network requests — are a DIFFERENT
    // channel: they feed the curated COOKIE_TECHS / JS_GLOBAL_TECHS /
    // NETWORK_URL_TECHS allowlists inside detect(), which are high-precision
    // (exact cookie/global names, specific host patterns). These catch tools
    // that are injected at runtime and never appear in static <head> markup
    // (e.g. Dynatrace RUM, Datadog, New Relic). They are only present when we
    // have real browser data — from the Chrome extension (pageData) or the
    // puppeteer fallback — so this is additive and adds no noise to static scans.
    const headHtml = extractHead(html);
    const headScriptSrcs = extractScriptSrcs(headHtml);
    const headMetaMap = extractMetaMap(headHtml);
    let techs = detect({
      html: headHtml,
      headers: {},
      scriptSrcs: headScriptSrcs,
      metaMap: headMetaMap,
      cookies,
      jsGlobals,
      networkUrls,
    });
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

  // If we have cached meta but app presence is missing/stale, re-detect from fresh HTML
  if (cachedMeta && (!cachedMeta.appPresence || cachedMeta.appPresence === 'No App') && html) {
    try {
      const { detectAppPresenceFromHTML } = require('./appPresence');
      const freshApp = detectAppPresenceFromHTML(html);
      if (freshApp.appPresence && freshApp.appPresence !== 'No App') {
        cachedMeta.appPresence = freshApp.appPresence;
      }
    } catch {}
  }

  const metaPromise = cachedMeta
    ? Promise.resolve(cachedMeta)
    : extractCompanyMeta({
        url, html: analysisHtml, headers, metaMap,
        technologies: [],
        fetchPage: fetchWithAxios,
        browserFetch: fetchWithBrowser,
        forceRefresh, metaOnly,
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

  // Persist tech to DB after both tech detection and meta extraction complete
  // This ensures techStack is saved even when called from scripts/universe scan
  if (techs.length > 0) {
    const domain = url.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/.*$/, '').toLowerCase();
    const techNames = techs.map(t => t.name || t);
    const now = new Date();
    try {
      const db = await getDb();

      // Compute diff against previous scan
      const prevCache = await db.collection('tech_cache').findOne(
        { domain },
        { projection: { technologies: 1, updatedAt: 1 } },
      );
      const prevNames = new Set((prevCache?.technologies || []).map(t => t.name || t));
      const currNames = new Set(techNames);
      const addedTechs = techNames.filter(n => !prevNames.has(n));
      const removedTechs = [...prevNames].filter(n => !currNames.has(n));
      const hasChanges = prevCache && (addedTechs.length > 0 || removedTechs.length > 0);

      // Surface the diff on the returned result so callers (e.g. the detect
      // route) don't re-diff against the cache we're about to overwrite — that
      // race previously clobbered techChanges back to empty on every scan.
      if (hasChanges) {
        result.techChanges = { added: addedTechs, removed: removedTechs, previousScanAt: prevCache.updatedAt };
      }

      // Build category/color lookup
      const catMap = {};
      for (const t of techs) { catMap[t.name || t] = t.category || 'Other'; }
      if (prevCache?.technologies) {
        for (const t of prevCache.technologies) { if (!catMap[t.name]) catMap[t.name] = t.category || 'Other'; }
      }

      const writes = [
        db.collection('tech_cache').updateOne(
          { domain },
          { $set: {
            domain, technologies: techs, count: techs.length, updatedAt: now,
            ...(hasChanges ? { techChanges: { added: addedTechs, removed: removedTechs, previousScanAt: prevCache.updatedAt } } : {}),
          } },
          { upsert: true },
        ),
        db.collection('company_meta').updateOne(
          { normalizedDomain: domain },
          {
            $set: { techStack: techNames.slice(0, 20), techCount: techs.length, lastTechScan: now },
            $setOnInsert: { normalizedDomain: domain, createdAt: now },
          },
          { upsert: true },
        ),
      ];

      // Log tech changes to feed collection
      if (hasChanges) {
        const changeDocs = [];
        for (const name of addedTechs) {
          changeDocs.push({
            domain, techName: name, changeType: 'installed',
            category: catMap[name] || 'Other', color: '#10b981',
            detectedAt: now,
          });
        }
        for (const name of removedTechs) {
          changeDocs.push({
            domain, techName: name, changeType: 'uninstalled',
            category: catMap[name] || 'Other', color: '#ef4444',
            detectedAt: now,
          });
        }
        if (changeDocs.length > 0) {
          writes.push(db.collection('tech_changes').insertMany(changeDocs));
        }
      }

      await Promise.all(writes);
    } catch {}
  }

  return result;
}

module.exports = { scanSingleUrl };
