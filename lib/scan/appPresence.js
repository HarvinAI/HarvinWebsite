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
