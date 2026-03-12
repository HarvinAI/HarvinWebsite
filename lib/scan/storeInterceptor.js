/**
 * XHR Interception Engine + Widget Parser Registry
 * Intercepts network requests on store locator pages to capture store API responses.
 * Falls back to DOM parsing (JSON-LD, repeating patterns) when interception captures nothing.
 */

const STORE_API_PATTERNS = [
  /\/stores/i,
  /\/locations/i,
  /\/branches/i,
  /\/outlets/i,
  /\/store-locator/i,
  /\/find-store/i,
  /\/retail/i,
  /\/api\/.*store/i,
  /\/api\/.*location/i,
  /\/graphql/i,
  /storemapper\.co\/api/i,
  /storepoint\.co\/api/i,
  /stockist\.co\/api/i,
  /cdn\.shopify\.com\/s\/files.*store/i,
  /bullseyelocations\.com/i,
  /sweetiq\.com/i,
  /yext\.com.*locations/i,
  /uberall\.com/i,
  /chatmeter\.com/i,
  /storerocket\.io\/api/i,
  /locally\.com\/stores/i,
  /\/_next\/data\//i,
  /storelocator/i,
  /demandware\.store/i,
  /\/external\/.*store/i,
  /cdn\.contentful\.com.*(?:store|location)/i,
];

const EXCLUDE_PATTERNS = [
  /google-analytics/i,
  /googletagmanager/i,
  /facebook\.com/i,
  /hotjar/i,
  /maps\.googleapis\.com\/maps\/api\/js/i,
  /fonts\.googleapis/i,
  /\.css(\?|$)/i,
  /\.png|\.jpg|\.gif|\.svg|\.webp/i,
  /\.woff|\.woff2|\.ttf|\.eot/i,
  /clarity\.ms/i,
  /doubleclick/i,
  /sentry\.io/i,
];

/**
 * Score a JSON response to determine if it contains store/location data.
 */
function scoreStoreResponse(data) {
  let score = 0;
  const payload = unwrapEnvelope(data);
  const arrays = findArraysInObject(payload);
  if (arrays.length === 0) return 0;

  for (const { arr } of arrays) {
    if (arr.length < 2 || arr.length > 10000) continue;

    const sample = arr.slice(0, 3);
    let arrayScore = 0;

    for (const item of sample) {
      if (typeof item !== 'object' || item === null) continue;

      const keys = Object.keys(item).map(k => k.toLowerCase());
      const values = Object.values(item).map(v =>
        typeof v === 'string' ? v.toLowerCase() : v
      );

      const highSignalKeys = [
        'latitude', 'longitude', 'lat', 'lng', 'long', 'lon',
        'address', 'street', 'city', 'state', 'zipcode', 'zip',
        'pincode', 'postal_code', 'postalcode',
        'store_name', 'storename', 'location_name',
        'phone', 'store_phone', 'store_id', 'store_code',
        'opening_hours', 'hours', 'timings',
      ];

      const medSignalKeys = [
        'name', 'title', 'country', 'region', 'area',
        'coordinates', 'geo', 'position', 'location',
        'district', 'landmark',
      ];

      const highMatches = highSignalKeys.filter(k =>
        keys.some(key => key.includes(k))
      ).length;

      const medMatches = medSignalKeys.filter(k =>
        keys.some(key => key.includes(k))
      ).length;

      const hasCoords = values.some(v => {
        if (typeof v !== 'number') return false;
        return (v > -90 && v < 90) || (v > -180 && v < 180);
      });

      if (highMatches >= 2) arrayScore += 30;
      else if (highMatches >= 1) arrayScore += 15;

      if (medMatches >= 2) arrayScore += 10;
      if (hasCoords) arrayScore += 20;
    }

    if (arr.length >= 3 && arr.length <= 5000) arrayScore += 10;
    score = Math.max(score, arrayScore);
  }

  return score;
}

function unwrapEnvelope(data) {
  if (data?.data) return data.data;
  if (data?.results) return data.results;
  if (data?.response) return data.response;
  if (data?.stores) return data.stores;
  if (data?.locations) return data.locations;
  if (data?.features) return data.features;
  if (data?.body) return data.body;
  return data;
}

function findArraysInObject(obj, path = '', depth = 0) {
  if (depth > 4) return [];
  const results = [];

  if (Array.isArray(obj)) {
    results.push({ path, arr: obj });
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      results.push(
        ...findArraysInObject(value, `${path}.${key}`, depth + 1)
      );
    }
  }

  return results;
}

/**
 * Extract store count from a scored API response.
 * Returns the count from the best array found.
 */
function extractCountFromScoredResponse(data) {
  const payload = unwrapEnvelope(data);

  // Check for explicit total/count fields first
  if (typeof data === 'object' && data !== null) {
    if (typeof data.total === 'number' && data.total > 0) return data.total;
    if (typeof data.count === 'number' && data.count > 0) return data.count;
    if (typeof data.totalCount === 'number') return data.totalCount;
    if (typeof data.totalResults === 'number') return data.totalResults;
    if (data.pagination?.total > 0) return data.pagination.total;
    if (data.pagination?.totalResults > 0) return data.pagination.totalResults;
    if (data.meta?.total > 0) return data.meta.total;
  }

  // Find the best array
  const arrays = findArraysInObject(payload);
  let bestCount = 0;
  let bestScore = 0;

  for (const { arr } of arrays) {
    if (arr.length < 2 || arr.length > 10000) continue;
    const sample = arr[0];
    if (typeof sample !== 'object' || sample === null) continue;

    const keys = Object.keys(sample).map(k => k.toLowerCase()).join(' ');
    if (/lat|lng|longitude|latitude|address|city|store|location|phone|zip|pin|name/.test(keys)) {
      if (arr.length > bestCount) {
        bestCount = arr.length;
      }
    }
  }

  return bestCount;
}

/**
 * Intercept store API calls on a page using Puppeteer's response listener.
 * Returns an array of captured responses with scores.
 */
async function interceptStoreAPIs(page, storeLocatorUrl) {
  const capturedResponses = [];

  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();

    if (status !== 200) return;
    if (EXCLUDE_PATTERNS.some(p => p.test(url))) return;

    const isStoreAPI = STORE_API_PATTERNS.some(p => p.test(url));
    if (!isStoreAPI) return;

    try {
      const contentType = response.headers()['content-type'] || '';

      if (contentType.includes('json') || contentType.includes('text')) {
        const text = await response.text();
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          return;
        }

        const score = scoreStoreResponse(parsed);
        if (score > 0) {
          capturedResponses.push({
            url,
            data: parsed,
            score,
            size: text.length,
          });
        }
      }
    } catch {
      // Response body already consumed or network error
    }
  });

  await page.goto(storeLocatorUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // Wait for lazy-loaded API calls
  await new Promise(r => setTimeout(r, 2000));

  // If nothing captured, try trigger strategies
  if (capturedResponses.length === 0) {
    await tryTriggerStrategies(page);
    await new Promise(r => setTimeout(r, 3000));
  }

  return capturedResponses;
}

/**
 * Try various UI interactions to trigger store data loading.
 */
async function tryTriggerStrategies(page) {
  // Strategy 1: Click "View All" / "Show All" buttons
  const viewAllTexts = ['View All', 'Show All', 'All Stores', 'See All', 'All Locations'];
  for (const text of viewAllTexts) {
    try {
      const el = await page.$(`xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | .//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`);
      if (el) {
        await el.click();
        await new Promise(r => setTimeout(r, 2000));
        return 'view_all_clicked';
      }
    } catch {}
  }

  // Strategy 2: CSS class-based selectors for view all
  const viewAllSelectors = ['[class*="view-all"]', '[class*="show-all"]', '[data-action="show-all"]'];
  for (const selector of viewAllSelectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        await new Promise(r => setTimeout(r, 2000));
        return 'view_all_clicked';
      }
    } catch {}
  }

  // Strategy 3: Search for a broad term
  const searchSelectors = [
    'input[placeholder*="search" i]',
    'input[placeholder*="city" i]',
    'input[placeholder*="location" i]',
    'input[placeholder*="pincode" i]',
    'input[placeholder*="zip" i]',
    'input[type="search"]',
    '#store-search',
    '.store-search input',
    '[class*="locator"] input',
  ];

  for (const selector of searchSelectors) {
    try {
      const input = await page.$(selector);
      if (input) {
        await input.type('India', { delay: 50 });
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));
        return 'search_triggered';
      }
    } catch {}
  }

  // Strategy 4: Zoom out on Google Map
  try {
    const mapContainer = await page.$('[class*="map"], #map, .gm-style');
    if (mapContainer) {
      const box = await mapContainer.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < 8; i++) {
          await page.mouse.wheel({ deltaY: -500 });
          await new Promise(r => setTimeout(r, 200));
        }
        await new Promise(r => setTimeout(r, 2000));
        return 'map_zoomed_out';
      }
    }
  } catch {}

  // Strategy 5: Load More / pagination
  const loadMoreTexts = ['Load More', 'Show More'];
  for (const text of loadMoreTexts) {
    try {
      let clicked = 0;
      while (clicked < 15) {
        const el = await page.$(`xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')] | .//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`);
        if (!el) break;
        await el.click();
        await new Promise(r => setTimeout(r, 1000));
        clicked++;
      }
      if (clicked > 0) return `load_more_clicked_${clicked}`;
    } catch {}
  }

  // CSS selectors for load more
  const loadMoreSelectors = ['[class*="load-more"]', '[class*="pagination"] a:last-child'];
  for (const selector of loadMoreSelectors) {
    try {
      let clicked = 0;
      while (clicked < 15) {
        const el = await page.$(selector);
        if (!el) break;
        await el.click();
        await new Promise(r => setTimeout(r, 1000));
        clicked++;
      }
      if (clicked > 0) return `load_more_clicked_${clicked}`;
    } catch {}
  }

  return 'no_trigger_worked';
}

/**
 * DOM fallback parser: JSON-LD structured data + repeating DOM patterns.
 */
async function fallbackDOMParsing(page) {
  return await page.evaluate(() => {
    const stores = [];

    // Strategy 0: __NEXT_DATA__ (Next.js hydration)
    const nextDataEl = document.getElementById('__NEXT_DATA__');
    if (nextDataEl) {
      try {
        const nd = JSON.parse(nextDataEl.textContent);
        const findStoreArrays = (obj, depth = 0) => {
          if (depth > 6 || !obj) return [];
          const results = [];
          if (Array.isArray(obj) && obj.length > 1) {
            const sample = obj[0];
            if (sample && typeof sample === 'object') {
              const keys = Object.keys(sample).map(k => k.toLowerCase()).join(' ');
              if (/lat|lng|longitude|latitude|address|city|store|location|pincode|phone/.test(keys)) {
                results.push(obj);
              }
            }
          } else if (typeof obj === 'object') {
            for (const v of Object.values(obj)) {
              results.push(...findStoreArrays(v, depth + 1));
            }
          }
          return results;
        };
        const storeArrays = findStoreArrays(nd);
        if (storeArrays.length > 0) {
          const best = storeArrays.sort((a, b) => b.length - a.length)[0];
          for (const item of best) {
            stores.push({ name: item.name || item.store_name || 'store', source: 'next_data' });
          }
        }
      } catch {}
    }

    if (stores.length > 0) return stores;

    // Strategy A: JSON-LD structured data
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type']?.match(/Store|LocalBusiness|Place/i)) {
            stores.push({
              name: item.name,
              address: item.address?.streetAddress,
              city: item.address?.addressLocality,
              source: 'json_ld',
            });
          }
          // Also check for list of sub-locations
          if (item.department && Array.isArray(item.department)) {
            for (const dept of item.department) {
              if (dept['@type']?.match(/Store|LocalBusiness|Place/i)) {
                stores.push({ name: dept.name, source: 'json_ld' });
              }
            }
          }
        }
      } catch {}
    }

    if (stores.length > 0) return stores;

    // Strategy B: Repeating DOM patterns with address-like content
    const candidates = document.querySelectorAll(
      '[class*="store"], [class*="location"], [class*="branch"], ' +
      '[class*="outlet"], [data-store], [data-location]'
    );

    for (const el of candidates) {
      const text = el.textContent.trim();
      const hasPhone = /(\+91|0\d{2,4})[\s-]?\d{6,10}/.test(text);
      const hasPincode = /\b\d{6}\b/.test(text);
      const hasZip = /\b\d{5}(-\d{4})?\b/.test(text);

      if (hasPhone || hasPincode || hasZip) {
        stores.push({
          raw_text: text.substring(0, 500),
          source: 'dom_parsing',
        });
      }
    }

    return stores;
  });
}

/**
 * Use Puppeteer to intercept store APIs on the store locator page
 * and return the store count.
 * Uses the shared browser instance from fetch.js.
 */
async function detectStoresViaInterception(storeLocatorUrl) {
  const { getBrowser } = require('./fetch');

  let browser;
  try {
    browser = await getBrowser();
  } catch {
    return 0;
  }

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  try {
    // Step 1: Intercept store API responses
    const captured = await interceptStoreAPIs(page, storeLocatorUrl);

    if (captured.length > 0) {
      const best = captured.sort((a, b) => b.score - a.score)[0];
      const count = extractCountFromScoredResponse(best.data);
      if (count > 0) return count;
    }

    // Step 2: DOM fallback
    const domStores = await fallbackDOMParsing(page);
    if (domStores && domStores.length > 0) return domStores.length;

  } catch {
    // Navigation or interception failure
  } finally {
    await page.close().catch(() => {});
  }

  return 0;
}

/**
 * Try widget-specific API parsers based on detected HTML patterns.
 * These are more reliable than generic interception for known widgets.
 */
async function tryWidgetParsers(html, fetchPage) {
  if (!fetchPage) return 0;

  const checks = [];

  // Storemapper — data attribute or script src
  const storemapperIdAttr = /data-storemapper-id=["']([^"']+)["']/i.exec(html);
  const storemapperScript = /storemapper\.co\/js\/(\d+)/i.exec(html);
  const storemapperId = storemapperIdAttr?.[1] || storemapperScript?.[1];
  if (storemapperId) {
    checks.push(async () => {
      try {
        const resp = await fetchPage(`https://www.storemapper.co/api/users/${storemapperId}/stores.json`);
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        return Array.isArray(data) ? data.length : 0;
      } catch { return 0; }
    });
  }

  // Storepoint — data attribute or API URL in script
  const storepointAttr = /data-storepoint-id=["']([^"']+)["']/i.exec(html);
  const storepointScript = /storepoint\.co\/api\/v1\/(?:tag\/)?(\w+)/i.exec(html);
  const storepointId = storepointAttr?.[1] || storepointScript?.[1];
  if (storepointId) {
    checks.push(async () => {
      try {
        const resp = await fetchPage(`https://api.storepoint.co/v1/${storepointId}/locations`);
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        const locations = data?.results?.locations || [];
        return Array.isArray(locations) ? locations.length : 0;
      } catch { return 0; }
    });
  }

  // Stockist — widget tag or embed URL
  const stockistTag = /data-stockist-widget-tag=["']([^"']+)["']/i.exec(html);
  const stockistEmbed = /stockist\.co\/embed\/v1\/widget\/(\w+)/i.exec(html);
  const stockistId = stockistTag?.[1] || stockistEmbed?.[1];
  if (stockistId) {
    checks.push(async () => {
      try {
        const resp = await fetchPage(`https://stockist.co/api/v1/${stockistId}/locations`);
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        return Array.isArray(data) ? data.length : 0;
      } catch { return 0; }
    });
  }

  // Bullseye Locations
  const bullseyeMatch = /bullseyelocations\.com\/[^"']*?(\d+)/i.exec(html);
  if (bullseyeMatch) {
    checks.push(async () => {
      try {
        const resp = await fetchPage(`https://www.bullseyelocations.com/api/locations?clientId=${bullseyeMatch[1]}&limit=10000`);
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        if (data?.TotalCount > 0) return data.TotalCount;
        if (Array.isArray(data?.Results)) return data.Results.length;
        return 0;
      } catch { return 0; }
    });
  }

  // Locally.io — company ID in script or data attribute
  const locallyMatch = /locally\.com\/stores\/conversion_data\?.*?(?:company_)?id=(\d+)/i.exec(html)
    || /locally-sdk[^"']*\?.*?company=(\d+)/i.exec(html);
  if (locallyMatch) {
    checks.push(async () => {
      try {
        const resp = await fetchPage(`https://www.locally.com/stores/conversion_data?has_data=true&company_id=${locallyMatch[1]}&inline=1&lang=en-us`);
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        return Array.isArray(data?.markers) ? data.markers.length : 0;
      } catch { return 0; }
    });
  }

  // Amasty Store Locator (Magento 2)
  const amastyMatch = /Amasty_Storelocator|amlocator/i.test(html);
  if (amastyMatch) {
    checks.push(async () => {
      try {
        // Extract base URL from the page
        const baseUrlMatch = /BASE_URL\s*=\s*'([^']+)'/i.exec(html)
          || /["']baseUrl["']\s*:\s*["']([^"']+)["']/i.exec(html);
        let baseUrl = baseUrlMatch ? baseUrlMatch[1].replace(/\\u003A/g, ':').replace(/\\u002F/g, '/') : '';
        if (!baseUrl) {
          // Try canonical or og:url
          const canonical = /href="(https?:\/\/[^"]+)"\s+rel="canonical"/i.exec(html)
            || /content="(https?:\/\/[^"]+)"[^>]*property="og:url"/i.exec(html);
          if (canonical) {
            const u = new URL(canonical[1]);
            baseUrl = u.origin + '/';
          }
        }
        if (!baseUrl) return 0;
        // Amasty AJAX endpoint — needs X-Requested-With header
        const ajaxUrl = baseUrl.replace(/\/$/, '') + '/amlocator/index/ajax/';
        const axios = require('axios');
        const resp = await axios.get(ajaxUrl, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'X-Requested-With': 'XMLHttpRequest',
          },
          responseType: 'text',
        });
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        if (data?.items && Array.isArray(data.items)) {
          // Check store description for total count (Amasty often shows "170+ stores")
          const descText = data.items.map(i => i.popup_html || '').join(' ');
          const countMatch = /(\d+)\+?\s*stores?\s+(?:present\s+)?(?:in|across)/i.exec(descText);
          if (countMatch) {
            const num = parseInt(countMatch[1], 10);
            if (num > data.items.length) return num;
          }
          return data.items.length;
        }
        return 0;
      } catch { return 0; }
    });
  }

  // Store Locator Plus (WordPress)
  const slpMatch = /slp_core|store-locator-plus/i.test(html);
  if (slpMatch) {
    // SLP uses AJAX, the count is usually in the rendered page
    // Fall through to XHR interception
  }

  // Shopify Store Locator (Secomapp)
  const secomappMatch = /secomapp.*store.*locator|storelocator\.secomapp/i.exec(html);
  if (secomappMatch) {
    // Secomapp embeds store data inline or via their API
    // Try to extract from inline JSON
    const inlineData = /var\s+storelocator_locations\s*=\s*(\[[\s\S]*?\]);/i.exec(html);
    if (inlineData) {
      try {
        const stores = JSON.parse(inlineData[1]);
        if (Array.isArray(stores) && stores.length > 0) return stores.length;
      } catch {}
    }
  }

  if (checks.length === 0) return 0;

  const results = await Promise.allSettled(checks.map(fn => fn()));
  let best = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value > best) best = r.value;
  }
  return best;
}

module.exports = {
  detectStoresViaInterception,
  interceptStoreAPIs,
  tryWidgetParsers,
  scoreStoreResponse,
  extractCountFromScoredResponse,
  fallbackDOMParsing,
};
