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

  // Also check for plain text URLs (not in href) and meta tags
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

  // ── App Store badge images ──
  // Many sites use badge images (Download on App Store / Get it on Google Play)
  if (!iosUrl) {
    const iosBadge = /(?:app[-_]?store|download[-_]on[-_]the[-_]app[-_]store|ios[-_]badge|apple[-_]badge|badge[-_]app[-_]store)/i.test(html);
    if (iosBadge) iosUrl = 'badge-detected';
  }
  if (!androidUrl) {
    const androidBadge = /(?:google[-_]?play[-_]?badge|get[-_]it[-_]on[-_]google[-_]play|play[-_]store[-_]badge|badge[-_]google[-_]play|play[-_]badge)/i.test(html);
    if (androidBadge) androidUrl = 'badge-detected';
  }

  // ── Text signals in HTML ──
  const bodyLower = html.toLowerCase();
  if (!iosUrl) {
    const iosTextSignals = [
      'download on the app store', 'available on the app store', 'get it on app store',
      'download on app store', 'available on app store', 'ios app', 'iphone app', 'ipad app',
      'download for ios', 'get the ios app', 'our ios app', 'download our app.*app store',
    ];
    if (iosTextSignals.some(t => bodyLower.includes(t))) iosUrl = 'text-detected';
  }
  if (!androidUrl) {
    const androidTextSignals = [
      'get it on google play', 'available on google play', 'download on google play',
      'android app', 'download for android', 'get the android app', 'our android app',
      'download our app.*google play', 'play store',
    ];
    if (androidTextSignals.some(t => bodyLower.includes(t))) androidUrl = 'text-detected';
  }

  // ── "Download App" section with both platform badges ──
  // Many sites have a section like "Download our app" with both badges together
  if ((!iosUrl || !androidUrl)) {
    const downloadSection = /download\s+(?:the\s+)?(?:our\s+)?app|get\s+(?:the\s+)?app|available\s+on\s+both/i.test(bodyLower);
    const hasBothText = /app\s*store[\s\S]{0,200}google\s*play|google\s*play[\s\S]{0,200}app\s*store/i.test(html);
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
        // Only read first 500KB (app links are typically in header/footer)
        if (data.length > 500000) {
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
  const urls = [
    `https://www.${domain}`,
    `https://${domain}`,
  ];

  for (const url of urls) {
    try {
      const html = await fetchHTML(url);
      const result = detectAppPresenceFromHTML(html);
      return result;
    } catch {
      // Try next URL
    }
  }

  return { appPresence: 'No App', iosUrl: null, androidUrl: null };
}

module.exports = { detectAppPresence, detectAppPresenceFromHTML };
