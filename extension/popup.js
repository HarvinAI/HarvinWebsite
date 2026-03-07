// ── Config ───────────────────────────────────────────────────────────────
const API_BASE = 'https://www.harvin.ai';

// Category colors (Wappalyzer-style)
const CATEGORY_COLORS = {
  'ecommerce': '#8b5cf6',
  'ecommerce platform': '#8b5cf6',
  'cms': '#3b82f6',
  'javascript frameworks': '#f59e0b',
  'ui frameworks': '#f59e0b',
  'javascript libraries': '#eab308',
  'analytics': '#06b6d4',
  'payment processors': '#10b981',
  'live chat': '#ec4899',
  'customer support': '#ec4899',
  'customer engagement': '#ec4899',
  'wordpress plugins': '#3b82f6',
  'shopify apps': '#8b5cf6',
  'reviews': '#f97316',
  'loyalty & rewards': '#f97316',
  'buy now, pay later': '#10b981',
  'cdn': '#6366f1',
  'web servers': '#64748b',
  'seo': '#22c55e',
  'tag managers': '#06b6d4',
  'marketing automation': '#e11d48',
  'advertising': '#ef4444',
  'retargeting': '#ef4444',
  'a/b testing': '#a855f7',
  'cart abandonment': '#f97316',
  'personalisation': '#a855f7',
  'push notifications': '#f43f5e',
  'email': '#0ea5e9',
  'surveys': '#14b8a6',
  'booking & scheduling': '#0891b2',
  'accessibility': '#22c55e',
  'cookie compliance': '#84cc16',
  'security': '#ef4444',
  'ssl/tls certificate authorities': '#ef4444',
  'performance': '#f59e0b',
  'hosting': '#6366f1',
  'font scripts': '#8b5cf6',
  'maps': '#22c55e',
  'video players': '#dc2626',
  'search engines': '#3b82f6',
  'caching': '#f59e0b',
  'programming languages': '#64748b',
  'databases': '#0ea5e9',
  'operating systems': '#475569',
};

// Category display order
const CATEGORY_PRIORITY = [
  'Ecommerce', 'Ecommerce Platform', 'CMS', 'JavaScript frameworks', 'UI frameworks',
  'JavaScript libraries', 'Analytics', 'Payment processors', 'Live chat',
  'Customer support', 'Customer engagement', 'WordPress plugins',
  'Shopify apps', 'Reviews', 'Loyalty & rewards', 'Buy now, pay later',
  'CDN', 'Web servers', 'SEO', 'Tag managers', 'Marketing automation',
  'Advertising', 'Retargeting', 'A/B testing', 'Cart abandonment',
  'Personalisation', 'Push notifications', 'Email', 'Surveys',
  'Booking & scheduling', 'Accessibility', 'Cookie compliance',
  'Security', 'SSL/TLS certificate authorities', 'Performance',
  'Hosting', 'Font scripts', 'Maps', 'Video players', 'Search engines',
  'Caching', 'Programming languages', 'Databases', 'Operating systems',
];
const CATEGORY_SET = new Set(CATEGORY_PRIORITY.map(c => c.toLowerCase()));

// ── Tech name → domain mapping for favicons ─────────────────────────────
const ICON_DOMAINS = {
  'shopify': 'shopify.com', 'woocommerce': 'woocommerce.com', 'bigcommerce': 'bigcommerce.com',
  'magento': 'magento.com', 'prestashop': 'prestashop.com', 'wix': 'wix.com',
  'squarespace': 'squarespace.com', 'salesforce commerce cloud': 'salesforce.com',
  'sap commerce cloud': 'sap.com', 'opencart': 'opencart.com', 'vtex': 'vtex.com',
  'ecwid': 'ecwid.com', 'shopware': 'shopware.com', 'dukaan': 'mydukaan.io',
  'shopline': 'shopline.com', 'volusion': 'volusion.com', 'weebly': 'weebly.com',
  'wordpress': 'wordpress.org', 'drupal': 'drupal.org', 'joomla': 'joomla.org',
  'ghost': 'ghost.org', 'webflow': 'webflow.com', 'contentful': 'contentful.com',
  'strapi': 'strapi.io', 'react': 'react.dev', 'next.js': 'nextjs.org',
  'nuxt.js': 'nuxt.com', 'vue.js': 'vuejs.org', 'angular': 'angular.io',
  'svelte': 'svelte.dev', 'gatsby': 'gatsbyjs.com', 'remix': 'remix.run',
  'astro': 'astro.build', 'jquery': 'jquery.com', 'bootstrap': 'getbootstrap.com',
  'tailwind css': 'tailwindcss.com', 'material ui': 'mui.com', 'chakra ui': 'chakra-ui.com',
  'google analytics': 'analytics.google.com', 'google tag manager': 'tagmanager.google.com',
  'google ads': 'ads.google.com', 'google adsense': 'adsense.google.com',
  'google maps': 'maps.google.com', 'google fonts': 'fonts.google.com',
  'google optimize': 'optimize.google.com', 'facebook pixel': 'facebook.com',
  'facebook sdk': 'facebook.com', 'meta pixel': 'facebook.com', 'instagram': 'instagram.com',
  'twitter': 'twitter.com', 'x pixel': 'x.com', 'tiktok pixel': 'tiktok.com',
  'pinterest tag': 'pinterest.com', 'snapchat pixel': 'snapchat.com',
  'linkedin insight tag': 'linkedin.com', 'hotjar': 'hotjar.com', 'mixpanel': 'mixpanel.com',
  'amplitude': 'amplitude.com', 'segment': 'segment.com', 'heap': 'heap.io',
  'plausible': 'plausible.io', 'matomo': 'matomo.org', 'posthog': 'posthog.com',
  'microsoft clarity': 'clarity.microsoft.com', 'contentsquare': 'contentsquare.com',
  'stripe': 'stripe.com', 'paypal': 'paypal.com', 'razorpay': 'razorpay.com',
  'cashfree': 'cashfree.com', 'payu': 'payu.in', 'klarna': 'klarna.com',
  'afterpay': 'afterpay.com', 'affirm': 'affirm.com', 'sezzle': 'sezzle.com',
  'braintree': 'braintreepayments.com', 'adyen': 'adyen.com', 'square': 'squareup.com',
  'intercom': 'intercom.com', 'zendesk': 'zendesk.com', 'freshdesk': 'freshdesk.com',
  'drift': 'drift.com', 'crisp': 'crisp.chat', 'tidio': 'tidio.com',
  'tawk.to': 'tawk.to', 'livechat': 'livechat.com', 'hubspot': 'hubspot.com',
  'mailchimp': 'mailchimp.com', 'klaviyo': 'klaviyo.com', 'sendgrid': 'sendgrid.com',
  'brevo': 'brevo.com', 'activecampaign': 'activecampaign.com',
  'convertkit': 'convertkit.com', 'moengage': 'moengage.com', 'clevertap': 'clevertap.com',
  'webengage': 'webengage.com', 'onesignal': 'onesignal.com', 'pushowl': 'pushowl.com',
  'cloudflare': 'cloudflare.com', 'fastly': 'fastly.com', 'akamai': 'akamai.com',
  'amazon cloudfront': 'aws.amazon.com', 'aws': 'aws.amazon.com',
  'amazon s3': 'aws.amazon.com', 'google cloud': 'cloud.google.com',
  'firebase': 'firebase.google.com', 'azure': 'azure.microsoft.com',
  'vercel': 'vercel.com', 'netlify': 'netlify.com', 'heroku': 'heroku.com',
  'digitalocean': 'digitalocean.com', 'nginx': 'nginx.com', 'apache': 'apache.org',
  'node.js': 'nodejs.org', 'php': 'php.net', 'python': 'python.org',
  'ruby': 'ruby-lang.org', 'java': 'java.com', 'mysql': 'mysql.com',
  'postgresql': 'postgresql.org', 'mongodb': 'mongodb.com', 'redis': 'redis.io',
  'elasticsearch': 'elastic.co', 'varnish': 'varnish-cache.org',
  'optimizely': 'optimizely.com', 'vwo': 'vwo.com', 'abtasty': 'abtasty.com',
  'yotpo': 'yotpo.com', 'judge.me': 'judge.me', 'stamped.io': 'stamped.io',
  'trustpilot': 'trustpilot.com', 'bazaarvoice': 'bazaarvoice.com',
  'loox': 'loox.io', 'smile.io': 'smile.io', 'loyaltylion': 'loyaltylion.com',
  'recaptcha': 'google.com', 'hcaptcha': 'hcaptcha.com', 'sentry': 'sentry.io',
  'datadog': 'datadoghq.com', 'new relic': 'newrelic.com',
  'typekit': 'fonts.adobe.com', 'adobe fonts': 'fonts.adobe.com',
  'adobe analytics': 'adobe.com', 'adobe experience manager': 'adobe.com',
  'youtube': 'youtube.com', 'vimeo': 'vimeo.com', 'wistia': 'wistia.com',
  'mapbox': 'mapbox.com', 'leaflet': 'leafletjs.com', 'algolia': 'algolia.com',
  'outbrain': 'outbrain.com', 'taboola': 'taboola.com', 'criteo': 'criteo.com',
  'doubleclick floodlight': 'google.com', 'google publisher tag': 'google.com',
  'typeform': 'typeform.com', 'recart': 'recart.com', 'privy': 'privy.com',
  'sumo': 'sumo.com', 'wisepops': 'wisepops.com', 'nosto': 'nosto.com',
  'dynamic yield': 'dynamicyield.com', 'freshchat': 'freshworks.com',
  'gorgias': 'gorgias.com', 'reamaze': 'reamaze.com',
  'recharge': 'rechargepayments.com', 'bold subscriptions': 'boldcommerce.com',
  'yoast seo': 'yoast.com', 'rank math': 'rankmath.com', 'schema.org': 'schema.org',
  'open graph': 'ogp.me', 'twitter cards': 'twitter.com',
  'cookiebot': 'cookiebot.com', 'onetrust': 'onetrust.com', 'osano': 'osano.com',
  'accessibe': 'accessibe.com', 'userway': 'userway.org',
  'calendly': 'calendly.com', 'acuity scheduling': 'acuityscheduling.com',
  'simpl': 'getsimpl.com', 'lazypay': 'lazypay.in', 'shiprocket': 'shiprocket.in',
  'delhivery': 'delhivery.com', 'instamojo': 'instamojo.com', 'paytm': 'paytm.com',
  'phonepe': 'phonepe.com', 'gsap': 'gsap.com', 'three.js': 'threejs.org',
  'lodash': 'lodash.com', 'moment.js': 'momentjs.com', 'axios': 'axios-http.com',
  'webpack': 'webpack.js.org', 'vite': 'vitejs.dev', 'babel': 'babeljs.io',
  'typescript': 'typescriptlang.org', 'express': 'expressjs.com',
  'django': 'djangoproject.com', 'laravel': 'laravel.com', 'rails': 'rubyonrails.org',
  'spring': 'spring.io', 'swiper': 'swiperjs.com', 'slick': 'kenwheeler.github.io',
  'recaptcha v3': 'google.com', 'google recaptcha': 'google.com',
  'cloudflare browser insights': 'cloudflare.com', 'cloudflare rocket loader': 'cloudflare.com',
  'amazon pay': 'pay.amazon.com', 'apple pay': 'apple.com', 'google pay': 'pay.google.com',
  'twilio': 'twilio.com', 'twilio segment': 'segment.com',
  'ahrefs': 'ahrefs.com', 'semrush': 'semrush.com', 'crazy egg': 'crazyegg.com',
  'fullstory': 'fullstory.com', 'lucky orange': 'luckyorange.com',
  'mouseflow': 'mouseflow.com',
};

// ── DOM refs ────────────────────────────────────────────────────────────
const siteUrlEl    = document.getElementById('site-url');
const refreshBtn   = document.getElementById('refresh-btn');
const loadingState = document.getElementById('loading-state');
const errorState   = document.getElementById('error-state');
const errorText    = document.getElementById('error-text');
const resultsEl    = document.getElementById('results');
const summaryBar   = document.getElementById('summary-bar');
const companyInfo  = document.getElementById('company-info');
const categoriesEl = document.getElementById('categories');
const emptyState   = document.getElementById('empty-state');

let currentUrl = '';

// ── Init ────────────────────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url) {
    try {
      const url = new URL(tabs[0].url);
      currentUrl = url.hostname.replace(/^www\./, '');
      siteUrlEl.textContent = currentUrl;
    } catch {
      siteUrlEl.textContent = tabs[0].url;
      currentUrl = tabs[0].url;
    }
    doScan();
  } else {
    siteUrlEl.textContent = 'Unable to detect';
  }
});

refreshBtn.addEventListener('click', doScan);

// ── Scan ────────────────────────────────────────────────────────────────
async function doScan() {
  if (!currentUrl) return;

  loadingState.classList.remove('hidden');
  errorState.classList.add('hidden');
  resultsEl.classList.add('hidden');
  emptyState.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/api/detect?url=${encodeURIComponent(currentUrl)}&refresh=1`);
    const text = await res.text();
    if (!text) throw new Error('Empty response from server');

    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Unexpected server response'); }
    if (!res.ok) throw new Error(data.error || 'Detection failed');

    if (!data.technologies || data.technologies.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      renderResults(data);
      resultsEl.classList.remove('hidden');
    }
  } catch (err) {
    errorText.textContent = err.message || 'Something went wrong';
    errorState.classList.remove('hidden');
  } finally {
    loadingState.classList.add('hidden');
  }
}

// ── Render Results ──────────────────────────────────────────────────────
function renderResults(data) {
  const { technologies, companyMeta } = data;
  const grouped = groupByCategory(technologies);
  const catCount = Object.keys(grouped).length;

  // Summary
  summaryBar.innerHTML = `
    <span class="summary-count">${technologies.length}</span> technologies detected in
    <span class="summary-count">${catCount}</span> categories
  `;

  // Company info
  if (companyMeta && companyMeta.category !== 'Unknown') {
    companyInfo.classList.remove('hidden');
    let infoHtml = '';

    infoHtml += makeInfoRow('Industry', companyMeta.category);
    if (companyMeta.subCategory && companyMeta.subCategory !== 'General') {
      infoHtml += makeInfoRow('Type', companyMeta.subCategory);
    }
    infoHtml += makeInfoRow('Region', companyMeta.region);

    const stores = companyMeta.offlineStores || 'Unknown';
    const storeClass = stores === 'Online only' ? 'stores online-only' :
                       stores === 'Unknown' ? 'stores unknown' : 'stores';
    infoHtml += `<div class="company-info-row"><span class="company-info-label">Stores</span><span class="company-info-value ${storeClass}">${esc(stores)}</span></div>`;

    companyInfo.innerHTML = infoHtml;
  } else {
    companyInfo.classList.add('hidden');
  }

  // Categories
  categoriesEl.innerHTML = '';
  const sortedCats = sortCategories(grouped);

  sortedCats.forEach((catName) => {
    const techs = grouped[catName];
    const color = CATEGORY_COLORS[catName.toLowerCase()] || '#6b7280';

    const catEl = document.createElement('div');
    catEl.className = 'category';

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
      <div class="category-left">
        <span class="category-icon" style="background:${color}">${catName.charAt(0)}</span>
        <span class="category-name">${esc(catName)}</span>
      </div>
      <span class="category-badge">${techs.length}</span>
    `;

    const techsEl = document.createElement('div');
    techsEl.className = 'category-techs';

    techs.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'tech-row';

      const iconUrl = getIconUrl(t.name);
      const techColor = t.color || color;

      if (iconUrl) {
        row.innerHTML = `
          <span class="tech-icon"><img src="${iconUrl}" alt="" onerror="this.parentElement.outerHTML='<span class=\\'tech-icon-letter\\' style=\\'background:${techColor}\\'>${t.name.charAt(0).toUpperCase()}</span>'" /></span>
          <span class="tech-name">${esc(t.name)}</span>
        `;
      } else {
        row.innerHTML = `
          <span class="tech-icon-letter" style="background:${techColor}">${t.name.charAt(0).toUpperCase()}</span>
          <span class="tech-name">${esc(t.name)}</span>
        `;
      }
      techsEl.appendChild(row);
    });

    let expanded = true;
    header.addEventListener('click', () => {
      expanded = !expanded;
      techsEl.style.display = expanded ? '' : 'none';
      header.querySelector('.category-badge').textContent = expanded ? techs.length : `${techs.length} +`;
    });

    catEl.appendChild(header);
    catEl.appendChild(techsEl);
    categoriesEl.appendChild(catEl);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────
function makeInfoRow(label, value) {
  return `<div class="company-info-row"><span class="company-info-label">${esc(label)}</span><span class="company-info-value">${esc(value)}</span></div>`;
}

function getIconUrl(techName) {
  const domain = ICON_DOMAINS[techName.toLowerCase()];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;
}

function groupByCategory(techs) {
  return techs.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});
}

function sortCategories(grouped) {
  const all = Object.keys(grouped);
  const allLower = new Map(all.map(c => [c.toLowerCase(), c]));
  const priority = [];
  for (const p of CATEGORY_PRIORITY) {
    const actual = allLower.get(p.toLowerCase());
    if (actual) priority.push(actual);
  }
  const rest = all.filter(c => !CATEGORY_SET.has(c.toLowerCase())).sort();
  return [...priority, ...rest];
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
