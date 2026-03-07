// ── Config ───────────────────────────────────────────────────────────────
const API_BASE = 'https://www.harvin.ai';

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
  'shopify': 'shopify.com',
  'woocommerce': 'woocommerce.com',
  'bigcommerce': 'bigcommerce.com',
  'magento': 'magento.com',
  'prestashop': 'prestashop.com',
  'wix': 'wix.com',
  'squarespace': 'squarespace.com',
  'salesforce commerce cloud': 'salesforce.com',
  'sap commerce cloud': 'sap.com',
  'opencart': 'opencart.com',
  'vtex': 'vtex.com',
  'ecwid': 'ecwid.com',
  'shopware': 'shopware.com',
  'dukaan': 'mydukaan.io',
  'shopline': 'shopline.com',
  'volusion': 'volusion.com',
  'weebly': 'weebly.com',
  'wordpress': 'wordpress.org',
  'drupal': 'drupal.org',
  'joomla': 'joomla.org',
  'ghost': 'ghost.org',
  'webflow': 'webflow.com',
  'contentful': 'contentful.com',
  'strapi': 'strapi.io',
  'react': 'react.dev',
  'next.js': 'nextjs.org',
  'nuxt.js': 'nuxt.com',
  'vue.js': 'vuejs.org',
  'angular': 'angular.io',
  'svelte': 'svelte.dev',
  'gatsby': 'gatsbyjs.com',
  'remix': 'remix.run',
  'astro': 'astro.build',
  'jquery': 'jquery.com',
  'bootstrap': 'getbootstrap.com',
  'tailwind css': 'tailwindcss.com',
  'material ui': 'mui.com',
  'chakra ui': 'chakra-ui.com',
  'google analytics': 'analytics.google.com',
  'google tag manager': 'tagmanager.google.com',
  'google ads': 'ads.google.com',
  'google adsense': 'adsense.google.com',
  'google maps': 'maps.google.com',
  'google fonts': 'fonts.google.com',
  'google optimize': 'optimize.google.com',
  'facebook pixel': 'facebook.com',
  'facebook sdk': 'facebook.com',
  'meta pixel': 'facebook.com',
  'instagram': 'instagram.com',
  'twitter': 'twitter.com',
  'x pixel': 'x.com',
  'tiktok pixel': 'tiktok.com',
  'pinterest tag': 'pinterest.com',
  'snapchat pixel': 'snapchat.com',
  'linkedin insight tag': 'linkedin.com',
  'hotjar': 'hotjar.com',
  'mixpanel': 'mixpanel.com',
  'amplitude': 'amplitude.com',
  'segment': 'segment.com',
  'heap': 'heap.io',
  'plausible': 'plausible.io',
  'matomo': 'matomo.org',
  'posthog': 'posthog.com',
  'microsoft clarity': 'clarity.microsoft.com',
  'contentsquare': 'contentsquare.com',
  'stripe': 'stripe.com',
  'paypal': 'paypal.com',
  'razorpay': 'razorpay.com',
  'cashfree': 'cashfree.com',
  'payu': 'payu.in',
  'klarna': 'klarna.com',
  'afterpay': 'afterpay.com',
  'affirm': 'affirm.com',
  'sezzle': 'sezzle.com',
  'braintree': 'braintreepayments.com',
  'adyen': 'adyen.com',
  'square': 'squareup.com',
  'intercom': 'intercom.com',
  'zendesk': 'zendesk.com',
  'freshdesk': 'freshdesk.com',
  'drift': 'drift.com',
  'crisp': 'crisp.chat',
  'tidio': 'tidio.com',
  'tawk.to': 'tawk.to',
  'livechat': 'livechat.com',
  'hubspot': 'hubspot.com',
  'mailchimp': 'mailchimp.com',
  'klaviyo': 'klaviyo.com',
  'sendgrid': 'sendgrid.com',
  'brevo': 'brevo.com',
  'activecampaign': 'activecampaign.com',
  'convertkit': 'convertkit.com',
  'moengage': 'moengage.com',
  'clevertap': 'clevertap.com',
  'webengage': 'webengage.com',
  'onesignal': 'onesignal.com',
  'pushowl': 'pushowl.com',
  'web push': 'webpush.com',
  'cloudflare': 'cloudflare.com',
  'fastly': 'fastly.com',
  'akamai': 'akamai.com',
  'amazon cloudfront': 'aws.amazon.com',
  'aws': 'aws.amazon.com',
  'amazon s3': 'aws.amazon.com',
  'google cloud': 'cloud.google.com',
  'firebase': 'firebase.google.com',
  'azure': 'azure.microsoft.com',
  'vercel': 'vercel.com',
  'netlify': 'netlify.com',
  'heroku': 'heroku.com',
  'digitalocean': 'digitalocean.com',
  'nginx': 'nginx.com',
  'apache': 'apache.org',
  'node.js': 'nodejs.org',
  'php': 'php.net',
  'python': 'python.org',
  'ruby': 'ruby-lang.org',
  'java': 'java.com',
  'mysql': 'mysql.com',
  'postgresql': 'postgresql.org',
  'mongodb': 'mongodb.com',
  'redis': 'redis.io',
  'elasticsearch': 'elastic.co',
  'varnish': 'varnish-cache.org',
  'optimizely': 'optimizely.com',
  'vwo': 'vwo.com',
  'abtasty': 'abtasty.com',
  'yotpo': 'yotpo.com',
  'judge.me': 'judge.me',
  'stamped.io': 'stamped.io',
  'trustpilot': 'trustpilot.com',
  'bazaarvoice': 'bazaarvoice.com',
  'loox': 'loox.io',
  'smile.io': 'smile.io',
  'loyaltylion': 'loyaltylion.com',
  'recaptcha': 'google.com',
  'hcaptcha': 'hcaptcha.com',
  'sentry': 'sentry.io',
  'datadog': 'datadoghq.com',
  'new relic': 'newrelic.com',
  'typekit': 'fonts.adobe.com',
  'adobe fonts': 'fonts.adobe.com',
  'adobe analytics': 'adobe.com',
  'adobe experience manager': 'adobe.com',
  'youtube': 'youtube.com',
  'vimeo': 'vimeo.com',
  'wistia': 'wistia.com',
  'mapbox': 'mapbox.com',
  'leaflet': 'leafletjs.com',
  'algolia': 'algolia.com',
  'outbrain': 'outbrain.com',
  'taboola': 'taboola.com',
  'criteo': 'criteo.com',
  'doubleclick floodlight': 'google.com',
  'google publisher tag': 'google.com',
  'lazysizes': 'github.com',
  'unpkg': 'unpkg.com',
  'cdnjs': 'cdnjs.com',
  'jsdelivr': 'jsdelivr.com',
  'typeform': 'typeform.com',
  'recart': 'recart.com',
  'privy': 'privy.com',
  'sumo': 'sumo.com',
  'wisepops': 'wisepops.com',
  'nosto': 'nosto.com',
  'barilliance': 'barilliance.com',
  'dynamic yield': 'dynamicyield.com',
  'freshchat': 'freshworks.com',
  'gorgias': 'gorgias.com',
  'reamaze': 'reamaze.com',
  'recharge': 'rechargepayments.com',
  'bold subscriptions': 'boldcommerce.com',
  'yoast seo': 'yoast.com',
  'rank math': 'rankmath.com',
  'schema.org': 'schema.org',
  'open graph': 'ogp.me',
  'twitter cards': 'twitter.com',
  'cookie notice': 'cookienotice.com',
  'cookiebot': 'cookiebot.com',
  'onetrust': 'onetrust.com',
  'osano': 'osano.com',
  'accessibe': 'accessibe.com',
  'userway': 'userway.org',
  'calendly': 'calendly.com',
  'acuity scheduling': 'acuityscheduling.com',
  'simpl': 'getsimpl.com',
  'lazypay': 'lazypay.in',
  'zestmoney': 'zestmoney.in',
  'snapmint': 'snapmint.com',
  'shiprocket': 'shiprocket.in',
  'delhivery': 'delhivery.com',
  'instamojo': 'instamojo.com',
  'paytm': 'paytm.com',
  'phonepe': 'phonepe.com',
  'shopify apps': 'shopify.com',
  'gsap': 'gsap.com',
  'three.js': 'threejs.org',
  'lodash': 'lodash.com',
  'moment.js': 'momentjs.com',
  'axios': 'axios-http.com',
  'webpack': 'webpack.js.org',
  'vite': 'vitejs.dev',
  'babel': 'babeljs.io',
  'typescript': 'typescriptlang.org',
  'express': 'expressjs.com',
  'django': 'djangoproject.com',
  'laravel': 'laravel.com',
  'rails': 'rubyonrails.org',
  'spring': 'spring.io',
  'linux': 'linux.org',
  'ubuntu': 'ubuntu.com',
  'windows server': 'microsoft.com',
  'centos': 'centos.org',
  'debian': 'debian.org',
  'lottie': 'airbnb.io',
  'swiper': 'swiperjs.com',
  'slick': 'kenwheeler.github.io',
  'recaptcha v3': 'google.com',
  'google recaptcha': 'google.com',
  'cloudflare browser insights': 'cloudflare.com',
  'cloudflare rocket loader': 'cloudflare.com',
  'amazon pay': 'pay.amazon.com',
  'apple pay': 'apple.com',
  'google pay': 'pay.google.com',
  'twilio': 'twilio.com',
  'twilio segment': 'segment.com',
  'ahrefs': 'ahrefs.com',
  'semrush': 'semrush.com',
  'crazy egg': 'crazyegg.com',
  'fullstory': 'fullstory.com',
  'lucky orange': 'luckyorange.com',
  'mouseflow': 'mouseflow.com',
  'whatconverts': 'whatconverts.com',
  'callrail': 'callrail.com',
};

// ── DOM refs ────────────────────────────────────────────────────────────
const siteUrlEl     = document.getElementById('site-url');
const refreshBtn    = document.getElementById('refresh-btn');
const loadingState  = document.getElementById('loading-state');
const errorState    = document.getElementById('error-state');
const errorText     = document.getElementById('error-text');
const resultsEl     = document.getElementById('results');
const summaryEl     = document.getElementById('tech-summary');
const categoriesEl  = document.getElementById('categories');
const infoPanelEl   = document.getElementById('info-panel');
const infoContentEl = document.getElementById('info-content');
const tabTech       = document.getElementById('tab-tech');
const tabInfo       = document.getElementById('tab-info');

let currentUrl = '';
let lastResult = null;

// ── Init: get current tab URL and auto-scan ─────────────────────────────
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

// ── Tab switching ───────────────────────────────────────────────────────
tabTech.addEventListener('click', () => switchTab('tech'));
tabInfo.addEventListener('click', () => switchTab('info'));

function switchTab(tab) {
  tabTech.classList.toggle('active', tab === 'tech');
  tabInfo.classList.toggle('active', tab === 'info');
  if (tab === 'tech') {
    if (lastResult) resultsEl.classList.remove('hidden');
    infoPanelEl.classList.add('hidden');
  } else {
    resultsEl.classList.add('hidden');
    infoPanelEl.classList.remove('hidden');
  }
}

// ── Scan handler ────────────────────────────────────────────────────────
async function doScan() {
  if (!currentUrl) return;

  loadingState.classList.remove('hidden');
  errorState.classList.add('hidden');
  resultsEl.classList.add('hidden');
  infoPanelEl.classList.add('hidden');

  try {
    let res;
    try {
      res = await fetch(`${API_BASE}/api/detect?url=${encodeURIComponent(currentUrl)}&refresh=1`);
    } catch (fetchErr) {
      throw new Error('Cannot connect to Harvin AI server. Make sure the app is running at ' + API_BASE);
    }
    const text = await res.text();
    if (!text) throw new Error('Empty response from server');

    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Unexpected server response'); }
    if (!res.ok) throw new Error(data.error || 'Detection failed');

    lastResult = data;
    renderResults(data);
    renderInfoPanel(data);
    switchTab('tech');
  } catch (err) {
    errorText.textContent = err.message || 'Something went wrong';
    errorState.classList.remove('hidden');
  } finally {
    loadingState.classList.add('hidden');
  }
}

refreshBtn.addEventListener('click', doScan);

// ── Get icon URL for a tech ─────────────────────────────────────────────
function getIconUrl(techName) {
  const key = techName.toLowerCase();
  const domain = ICON_DOMAINS[key];
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  }
  return null;
}

// ── Render results ──────────────────────────────────────────────────────
function renderResults(data) {
  const { technologies } = data;
  const grouped = groupByCategory(technologies);
  const catCount = Object.keys(grouped).length;

  summaryEl.innerHTML = `
    <span class="summary-badge tech-count">
      <span class="summary-badge-num">${technologies.length}</span> technologies
    </span>
    <span class="summary-badge cat-count">
      <span class="summary-badge-num">${catCount}</span> categories
    </span>
  `;

  categoriesEl.innerHTML = '';
  const sortedCats = sortCategories(grouped);

  sortedCats.forEach((catName) => {
    const techs = grouped[catName];
    const catEl = document.createElement('div');
    catEl.className = 'category';

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
      <span class="category-name">${escapeHtml(catName)}</span>
      <span class="category-count">${techs.length}</span>
    `;

    const techsEl = document.createElement('div');
    techsEl.className = 'category-techs';

    techs.forEach((t) => {
      const chip = document.createElement('div');
      chip.className = 'tech-chip';

      const iconUrl = getIconUrl(t.name);
      const color = t.color || '#6B7280';
      const initial = t.name.charAt(0).toUpperCase();

      if (iconUrl) {
        chip.innerHTML = `
          <span class="tech-icon-wrap">
            <img src="${iconUrl}" alt="${escapeHtml(t.name)}" onerror="this.parentElement.outerHTML='<span class=\\'tech-icon-fallback\\' style=\\'background:${color}\\'>${initial}</span>'" />
          </span>
          <span class="tech-name">${escapeHtml(t.name)}</span>
        `;
      } else {
        chip.innerHTML = `
          <span class="tech-icon-fallback" style="background:${color}">${initial}</span>
          <span class="tech-name">${escapeHtml(t.name)}</span>
        `;
      }

      techsEl.appendChild(chip);
    });

    let expanded = true;
    header.addEventListener('click', () => {
      expanded = !expanded;
      techsEl.style.display = expanded ? 'flex' : 'none';
    });

    catEl.appendChild(header);
    catEl.appendChild(techsEl);
    categoriesEl.appendChild(catEl);
  });

  resultsEl.classList.remove('hidden');
}

// ── Render: More Info panel ─────────────────────────────────────────────
function renderInfoPanel(data) {
  const { url, technologies, companyMeta } = data;

  let html = '<div class="info-grid">';
  html += `<div class="info-card full-width"><div class="info-card-label">Scanned URL</div><div class="info-url">${escapeHtml(url)}</div></div>`;

  if (companyMeta) {
    html += `
      <div class="info-card"><div class="info-card-label">Industry</div><div class="info-card-value">${escapeHtml(companyMeta.category)}</div></div>
      <div class="info-card"><div class="info-card-label">Type</div><div class="info-card-value">${escapeHtml(companyMeta.subCategory)}</div></div>
      <div class="info-card"><div class="info-card-label">Region</div><div class="info-card-value">${escapeHtml(companyMeta.region)}</div></div>
      <div class="info-card"><div class="info-card-label">Stores</div><div class="info-card-value">${escapeHtml(companyMeta.offlineStores || 'Unknown')}</div></div>
    `;
  }

  html += `<div class="info-card full-width"><div class="info-card-label">Total Technologies</div><div class="info-card-value">${technologies.length} detected across ${Object.keys(groupByCategory(technologies)).length} categories</div></div>`;
  html += '</div>';
  infoContentEl.innerHTML = html;
}

// ── Helpers ─────────────────────────────────────────────────────────────
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
  const rest = all
    .filter(c => !CATEGORY_SET.has(c.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return [...priority, ...rest];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
