const https = require('https');
const http = require('http');

/**
 * Detect app presence by scanning the website HTML for App Store / Play Store links.
 *
 * Checks for:
 * - apps.apple.com / itunes.apple.com links → iOS app
 * - play.google.com/store/apps links → Android app
 *
 * @param {string} html - The full page HTML
 * @returns {{ appPresence: string, iosUrl: string|null, androidUrl: string|null }}
 */
function detectAppPresenceFromHTML(html) {
  if (!html) return { appPresence: 'No App', iosUrl: null, androidUrl: null };

  let iosUrl = null;
  let androidUrl = null;

  // Search for App Store links (iOS)
  const iosPatterns = [
    /href=["'](https?:\/\/apps\.apple\.com\/[^"']+)["']/gi,
    /href=["'](https?:\/\/itunes\.apple\.com\/[^"']+)["']/gi,
    /href=["'](https?:\/\/apple\.co\/[^"']+)["']/gi,
  ];

  for (const rx of iosPatterns) {
    const match = rx.exec(html);
    if (match) {
      const url = match[1];
      // Verify it's an app link, not a podcast/music link
      if (!/\/(podcast|music|movie|book|album)\//i.test(url)) {
        iosUrl = url;
        break;
      }
    }
  }

  // Search for Play Store links (Android)
  const androidPatterns = [
    /href=["'](https?:\/\/play\.google\.com\/store\/apps\/details[^"']+)["']/gi,
    /href=["'](https?:\/\/play\.google\.com\/store\/apps\/[^"']+)["']/gi,
  ];

  for (const rx of androidPatterns) {
    const match = rx.exec(html);
    if (match) {
      androidUrl = match[1];
      break;
    }
  }

  // Also check for plain text URLs (not in href) — meta tags, JS code, etc.
  if (!iosUrl) {
    const metaIos = /content=["'](https?:\/\/apps\.apple\.com\/[^"']+)["']/i.exec(html);
    if (metaIos && !/\/(podcast|music|movie|book|album)\//i.test(metaIos[1])) {
      iosUrl = metaIos[1];
    }
  }
  if (!androidUrl) {
    const metaAndroid = /content=["'](https?:\/\/play\.google\.com\/store\/apps\/[^"']+)["']/i.exec(html);
    if (metaAndroid) {
      androidUrl = metaAndroid[1];
    }
  }

  // Check for store URLs inside JavaScript code (e.g. window.location.href = "...")
  if (!iosUrl) {
    const jsIos = /["'](https?:\/\/apps\.apple\.com\/[^"']+)["']/i.exec(html);
    if (jsIos && !/\/(podcast|music|movie|book|album)\//i.test(jsIos[1])) {
      iosUrl = jsIos[1];
    }
  }
  if (!androidUrl) {
    const jsAndroid = /["'](https?:\/\/play\.google\.com\/store\/apps\/details[^"']+)["']/i.exec(html);
    if (jsAndroid) {
      androidUrl = jsAndroid[1];
    }
  }

  // Check App Links protocol meta tags (al:ios, al:android)
  // Used by many SPAs that render app links via JS
  if (!iosUrl) {
    const alIos = /property=["']al:ios:app_store_id["'][^>]*content=["']([^"']+)["']/i.exec(html)
      || /content=["']([^"']+)["'][^>]*property=["']al:ios:app_store_id["']/i.exec(html);
    if (alIos) {
      iosUrl = `https://apps.apple.com/app/id${alIos[1]}`;
    }
  }
  if (!androidUrl) {
    const alAndroid = /property=["']al:android:package["'][^>]*content=["']([^"']+)["']/i.exec(html)
      || /content=["']([^"']+)["'][^>]*property=["']al:android:package["']/i.exec(html);
    if (alAndroid) {
      androidUrl = `https://play.google.com/store/apps/details?id=${alAndroid[1]}`;
    }
  }

  // Check apple-itunes-app meta tag (e.g. <meta name="apple-itunes-app" content="app-id=123456">)
  if (!iosUrl) {
    const itunesMeta = /name=["']apple-itunes-app["'][^>]*content=["']([^"']+)["']/i.exec(html);
    if (itunesMeta) {
      const appIdMatch = /app-id=(\d+)/i.exec(itunesMeta[1]);
      if (appIdMatch) {
        iosUrl = `https://apps.apple.com/app/id${appIdMatch[1]}`;
      }
    }
  }

  // Check google-play-app meta tag
  if (!androidUrl) {
    const playMeta = /name=["']google-play-app["'][^>]*content=["']([^"']+)["']/i.exec(html);
    if (playMeta) {
      const pkgMatch = /app-id=([a-zA-Z0-9._]+)/i.exec(playMeta[1]);
      if (pkgMatch) {
        androidUrl = `https://play.google.com/store/apps/details?id=${pkgMatch[1]}`;
      }
    }
  }

  // ── Deep link services (OneLink, Branch, Firebase) — imply BOTH platforms ──
  // These services create universal links that redirect to both App Store and Play Store
  const deepLinkPatterns = [
    /href=["'](https?:\/\/[^"']*\.onelink\.me\/[^"']+)["']/i,
    /href=["'](https?:\/\/[^"']*\.app\.link\/[^"']+)["']/i,        // Branch.io
    /href=["'](https?:\/\/[^"']*\.page\.link\/[^"']+)["']/i,       // Firebase Dynamic Links
    /href=["'](https?:\/\/[^"']*\.adj\.st\/[^"']+)["']/i,          // Adjust
    /href=["'](https?:\/\/[^"']*\.sng\.link\/[^"']+)["']/i,        // Singular
  ];
  const hasDeepLink = deepLinkPatterns.some(rx => rx.test(html));

  // If we found a deep link service + at least one platform → assume both platforms
  if (hasDeepLink) {
    if (androidUrl && !iosUrl) iosUrl = 'deep-link-detected';
    if (iosUrl && !androidUrl) androidUrl = 'deep-link-detected';
    if (!iosUrl && !androidUrl) {
      // Deep link present but no direct store links — likely both platforms
      iosUrl = 'deep-link-detected';
      androidUrl = 'deep-link-detected';
    }
  }

  // Strip <script> and <style> tags to avoid false positives from JS/CSS code
  const visibleHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  // ── App Store badge images ──
  // Match badge class names, img alt/src text, and link text in visible HTML
  if (!iosUrl) {
    const iosBadge = /(?:download[-_]on[-_]the[-_]app[-_]store|ios[-_]badge|apple[-_]badge|badge[-_]app[-_]store)/i.test(visibleHtml)
      || /<img[^>]*alt=["'][^"']*(?:app\s*store|apple\s*app)[^"']*["'][^>]*>/i.test(visibleHtml)
      || /<img[^>]*src=["'][^"']*(?:app[-_]?store|apple[-_]?badge|ios[-_]?badge)[^"']*["'][^>]*>/i.test(visibleHtml)
      || /<a[^>]*href=["'][^"']*apps\.apple\.com[^"']*["'][^>]*>/i.test(visibleHtml)
      || /<a[^>]*href[^>]*>[\s\S]{0,200}app\s*store[\s\S]{0,200}<\/a>/i.test(visibleHtml);
    if (iosBadge) iosUrl = 'badge-detected';
  }
  if (!androidUrl) {
    const androidBadge = /(?:google[-_]?play[-_]?badge|get[-_]it[-_]on[-_]google[-_]play|play[-_]store[-_]badge|badge[-_]google[-_]play)/i.test(visibleHtml)
      || /<img[^>]*alt=["'][^"']*(?:google\s*play|play\s*store)[^"']*["'][^>]*>/i.test(visibleHtml)
      || /<img[^>]*src=["'][^"']*(?:play[-_]?store|google[-_]?play[-_]?badge)[^"']*["'][^>]*>/i.test(visibleHtml)
      || /<a[^>]*href=["'][^"']*play\.google\.com[^"']*["'][^>]*>/i.test(visibleHtml)
      || /<a[^>]*href[^>]*>[\s\S]{0,200}google\s*play[\s\S]{0,200}<\/a>/i.test(visibleHtml);
    if (androidBadge) androidUrl = 'badge-detected';
  }

  // ── Text signals in visible HTML (scripts/styles stripped) ──
  const bodyLower = visibleHtml.toLowerCase();
  if (!iosUrl) {
    const iosTextSignals = [
      'download on the app store', 'available on the app store', 'get it on app store',
      'download on app store', 'available on app store', 'iphone app', 'ipad app',
      'download for ios', 'get the ios app', 'our ios app',
    ];
    if (iosTextSignals.some(t => bodyLower.includes(t))) iosUrl = 'text-detected';
  }
  if (!androidUrl) {
    const androidTextSignals = [
      'get it on google play', 'available on google play', 'download on google play',
      'download for android', 'get the android app', 'our android app',
    ];
    if (androidTextSignals.some(t => bodyLower.includes(t))) androidUrl = 'text-detected';
  }

  // ── "Download App" section with both platform badges ──
  // Many sites have a section like "Download our app" with both badges together
  if ((!iosUrl || !androidUrl)) {
    const downloadSection = /download\s+(?:the\s+)?(?:our\s+)?app|get\s+(?:the\s+)?app|available\s+on\s+both/i.test(bodyLower);
    const hasBothText = /app\s*store[\s\S]{0,200}google\s*play|google\s*play[\s\S]{0,200}app\s*store/i.test(visibleHtml);
    if (downloadSection && hasBothText) {
      if (!iosUrl) iosUrl = 'section-detected';
      if (!androidUrl) androidUrl = 'section-detected';
    }
  }

  // Determine app presence
  let appPresence;
  if (iosUrl && androidUrl) {
    appPresence = 'Both iOS & Android';
  } else if (iosUrl) {
    appPresence = 'iOS Only';
  } else if (androidUrl) {
    appPresence = 'Android Only';
  } else {
    appPresence = 'No App';
  }

  return { appPresence, iosUrl, androidUrl };
}

/**
 * Fetch a URL with a simple GET request (follows redirects).
 * Returns the HTML string.
 */
function fetchHTML(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        fetchHTML(redirectUrl, timeout).then(resolve).catch(reject);
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        // Read up to 3MB to capture footer content with app links
        if (data.length > 3000000) {
          req.destroy();
          resolve(data);
        }
      });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * Detect app presence for a domain by fetching the website and scanning for app links.
 *
 * @param {string} domain - e.g. "nykaa.com"
 * @returns {Promise<{ appPresence: string, iosUrl: string|null, androidUrl: string|null }>}
 */
async function detectAppPresence(domain) {
  const baseUrls = [
    `https://www.${domain}`,
    `https://${domain}`,
  ];

  // Try homepage first
  let homepageResult = null;
  for (const url of baseUrls) {
    try {
      const html = await fetchHTML(url);
      homepageResult = detectAppPresenceFromHTML(html);
      break;
    } catch {
      // Try next URL
    }
  }

  // If homepage detected apps, return immediately
  if (homepageResult && homepageResult.appPresence !== 'No App') {
    return homepageResult;
  }

  // Try common app-related and footer-heavy pages
  const appPages = ['/pages/app', '/app', '/download', '/mobile', '/pages/mobile-app', '/pages/about', '/pages/about-us', '/pages/contact', '/about', '/contact'];
  for (const path of appPages) {
    for (const base of baseUrls) {
      try {
        const html = await fetchHTML(`${base}${path}`, 5000);
        const result = detectAppPresenceFromHTML(html);
        if (result.appPresence !== 'No App') return result;
      } catch {
        // Skip failed pages
      }
    }
  }

  // Direct store lookup — check if apps exist on Play Store / App Store
  const brandName = domain.replace(/\.(com|in|co|io|net|org|co\.\w+)$/i, '').replace(/^www\./, '');
  // Also try spaced-out version for camelCase/concatenated names (e.g. "rforrabbit" → "r for rabbit")
  const spacedBrand = brandName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([a-z])(for|and|the|of)([a-z])/gi, '$1 $2 $3');
  const storeResult = await checkAppStores(spacedBrand !== brandName ? spacedBrand : brandName, domain);
  if (storeResult.appPresence !== 'No App') return storeResult;

  return homepageResult || { appPresence: 'No App', iosUrl: null, androidUrl: null };
}

/**
 * Simple similarity check: does the candidate closely match the brand?
 * Requires either exact match, or the brand is a significant portion of the candidate.
 */
function isBrandMatch(candidate, brand) {
  if (!candidate || !brand || brand.length < 3) return false;
  // Exact match
  if (candidate === brand) return true;
  // Brand is the start or end of candidate (e.g. "nykaa" matches "nykaacosmetics")
  if (candidate.startsWith(brand) || candidate.endsWith(brand)) return true;
  // Candidate starts or ends with brand
  if (brand.startsWith(candidate) || brand.endsWith(candidate)) return true;
  // Brand must be at least 60% of candidate length to count as substring match
  if (candidate.includes(brand) && brand.length / candidate.length >= 0.6) return true;
  return false;
}

/**
 * Check Google Play Store and Apple App Store directly for the brand.
 */
async function checkAppStores(brandName, domain) {
  let iosUrl = null;
  let androidUrl = null;

  const domainClean = domain.replace(/\./g, '').replace(/^www/, '').toLowerCase();
  const brandClean = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check Google Play Store
  try {
    const playHtml = await fetchHTML(`https://play.google.com/store/search?q=${encodeURIComponent(brandName)}&c=apps`, 6000);
    const playLinks = playHtml.match(/\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/g) || [];
    for (const link of playLinks) {
      const pkgId = link.replace('/store/apps/details?id=', '').toLowerCase();
      // Package ID often contains the brand or domain (e.g. com.rforrabbit.app)
      const pkgParts = pkgId.split('.');
      if (pkgParts.some(part => isBrandMatch(part, brandClean)) ||
          pkgParts.some(part => isBrandMatch(part, domainClean)) ||
          isBrandMatch(pkgId, brandClean)) {
        androidUrl = `https://play.google.com${link}`;
        break;
      }
    }
  } catch {
    // Store check failed
  }

  // Check Apple App Store via iTunes Search API
  try {
    const itunesHtml = await fetchHTML(`https://itunes.apple.com/search?term=${encodeURIComponent(brandName)}&entity=software&limit=5`, 6000);
    try {
      const data = JSON.parse(itunesHtml);
      if (data.results && data.results.length > 0) {
        for (const app of data.results) {
          const appName = (app.trackName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const seller = (app.sellerName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const bundleId = (app.bundleId || '').toLowerCase();
          const bundleParts = bundleId.split('.');
          if (isBrandMatch(appName, brandClean) ||
              isBrandMatch(seller, brandClean) ||
              bundleParts.some(part => isBrandMatch(part, brandClean))) {
            iosUrl = app.trackViewUrl || null;
            break;
          }
        }
      }
    } catch {
      // JSON parse failed
    }
  } catch {
    // Store check failed
  }

  let appPresence;
  if (iosUrl && androidUrl) {
    appPresence = 'Both iOS & Android';
  } else if (iosUrl) {
    appPresence = 'iOS Only';
  } else if (androidUrl) {
    appPresence = 'Android Only';
  } else {
    appPresence = 'No App';
  }

  return { appPresence, iosUrl, androidUrl };
}

module.exports = { detectAppPresence, detectAppPresenceFromHTML };
