// ── Config ───────────────────────────────────────────────────────────────
// Published (packed) extension → production. Unpacked (dev) extension → a
// local server. We don't hardcode one dev port: `npm run dev` serves on 3000
// while the docker-compose stack serves on 8080, so probe both and use
// whichever is actually up (preferring 3000, the hot-reload dev server).
const IS_DEV = !('update_url' in chrome.runtime.getManifest());
const PROD_API_BASE = 'https://www.harvin.ai';
const DEV_API_CANDIDATES = ['http://localhost:3000', 'http://localhost:8080'];
let API_BASE = IS_DEV ? DEV_API_CANDIDATES[0] : PROD_API_BASE;
let _apiBaseResolved = IS_DEV ? null : PROD_API_BASE;

// Resolve (once per popup) which local server is reachable. `/api/healthz`
// returns 200 when healthy and 503 when up-but-DB-down — both mean "server is
// there", so we accept either.
async function resolveApiBase() {
  if (_apiBaseResolved) return _apiBaseResolved;
  for (const base of DEV_API_CANDIDATES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(base + '/api/healthz', { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok || res.status === 503) { API_BASE = base; _apiBaseResolved = base; return base; }
    } catch { /* try next candidate */ }
  }
  // Nothing responded — fall back to the first candidate so the error surfaced
  // to the user points at a concrete address.
  API_BASE = DEV_API_CANDIDATES[0];
  _apiBaseResolved = API_BASE;
  return API_BASE;
}

// Category colors
const CATEGORY_COLORS = {
  'ecommerce': '#8b5cf6', 'ecommerce platform': '#8b5cf6', 'cms': '#3b82f6',
  'javascript frameworks': '#f59e0b', 'ui frameworks': '#f59e0b',
  'javascript libraries': '#eab308', 'analytics': '#06b6d4',
  'analytics & behavior': '#06b6d4', 'analytics & optimization platform': '#06b6d4',
  'payment processors': '#10b981', 'payments': '#10b981',
  'payments & checkout - gateway': '#10b981', 'payments & checkout - checkout / bnpl': '#10b981',
  'live chat': '#ec4899', 'customer support': '#ec4899',
  'customer engagement': '#ec4899', 'customer engagement / crm': '#ec4899',
  'wordpress plugins': '#3b82f6', 'shopify apps': '#8b5cf6',
  'reviews': '#f97316', 'loyalty & rewards': '#f97316',
  'buy now, pay later': '#10b981', 'buy now pay later': '#10b981',
  'cdn': '#6366f1', 'cdn & infrastructure': '#6366f1', 'web servers': '#64748b',
  'web servers & runtime': '#64748b',
  'seo': '#22c55e', 'tag managers': '#06b6d4', 'tag manager': '#06b6d4',
  'marketing automation': '#e11d48',
  'advertising': '#ef4444', 'retargeting': '#ef4444', 'a/b testing': '#a855f7',
  'cart abandonment': '#f97316', 'personalisation': '#a855f7',
  'push notifications': '#f43f5e', 'email': '#0ea5e9', 'surveys': '#14b8a6',
  'booking & scheduling': '#0891b2', 'accessibility': '#22c55e',
  'cookie compliance': '#84cc16', 'security': '#ef4444',
  'ssl/tls certificate authorities': '#ef4444', 'performance': '#f59e0b',
  'hosting': '#6366f1', 'font scripts': '#8b5cf6', 'maps': '#22c55e',
  'video players': '#dc2626', 'search engines': '#3b82f6', 'search': '#3b82f6',
  'caching': '#f59e0b', 'programming languages': '#64748b', 'databases': '#0ea5e9',
  'operating systems': '#475569', 'store locator': '#f97316',
  'paas': '#6366f1', 'static site generators': '#3b82f6',
  'web frameworks': '#f59e0b', 'miscellaneous': '#9ca3af',
  'subscription': '#8b5cf6', 'returns': '#f97316', 'shipping': '#06b6d4',
  'social proof': '#e11d48', 'authentication': '#6366f1',
};

const CATEGORY_PRIORITY = [
  'Ecommerce', 'Ecommerce Platform', 'CMS', 'JavaScript frameworks', 'UI frameworks',
  'JavaScript libraries', 'Analytics', 'Analytics & Behavior', 'Analytics & Optimization Platform',
  'Payment processors', 'Payments', 'Payments & Checkout - Gateway', 'Payments & Checkout - Checkout / BNPL',
  'Live chat', 'Customer support', 'Customer engagement', 'Customer Engagement / CRM',
  'WordPress plugins', 'Shopify apps', 'Reviews', 'Loyalty & rewards',
  'Buy now, pay later', 'Buy Now Pay Later', 'Subscription',
  'CDN', 'CDN & Infrastructure', 'Web servers', 'Web Servers & Runtime',
  'SEO', 'Search', 'Tag managers', 'Tag Manager',
  'Marketing automation', 'Advertising', 'Retargeting', 'A/B testing',
  'Cart abandonment', 'Personalisation', 'Social Proof',
  'Push notifications', 'Email', 'Surveys',
  'Booking & scheduling', 'Accessibility', 'Cookie Compliance',
  'Security', 'Authentication', 'SSL/TLS certificate authorities', 'Performance',
  'Hosting', 'Shipping', 'Returns', 'PaaS', 'Static site generators', 'Web frameworks',
  'Font scripts', 'Maps', 'Video players', 'Search engines',
  'Caching', 'Programming languages', 'Databases', 'Operating systems',
  'Miscellaneous',
];
const CATEGORY_SET = new Set(CATEGORY_PRIORITY.map(c => c.toLowerCase()));

// Tech name → favicon domain (comprehensive mapping for all 594 techs)
const ICON_DOMAINS = {
  // Ecommerce Platforms
  'shopify': 'shopify.com', 'shopify checkout': 'shopify.com', 'shopify payments': 'shopify.com', 'shop pay': 'shopify.com',
  'woocommerce': 'woocommerce.com', 'bigcommerce': 'bigcommerce.com', 'magento': 'magento.com',
  'prestashop': 'prestashop.com', 'wix': 'wix.com', 'squarespace': 'squarespace.com',
  'salesforce commerce cloud': 'salesforce.com', 'sap commerce cloud': 'sap.com',
  'opencart': 'opencart.com', 'vtex': 'vtex.com', 'ecwid': 'ecwid.com',
  'commercetools': 'commercetools.com', 'shopware': 'shopware.com',
  'dukaan': 'mydukaan.io', 'shopline': 'shopline.com', 'nuvemshop': 'nuvemshop.com',
  'volusion': 'volusion.com', 'shift4shop': 'shift4shop.com', 'weebly': 'weebly.com',
  'zen cart': 'zen-cart.com', 'nopcommerce': 'nopcommerce.com',
  'medusa': 'medusajs.com', 'bagisto': 'bagisto.com', 'cs-cart': 'cs-cart.com',
  'fynd': 'fynd.com', 'shopflo': 'shopflo.com',
  // CMS
  'wordpress': 'wordpress.org', 'drupal': 'drupal.org', 'ghost': 'ghost.org',
  'contentful': 'contentful.com', 'joomla': 'joomla.org', 'webflow': 'webflow.com',
  'strapi': 'strapi.io', 'sanity': 'sanity.io', 'prismic': 'prismic.io',
  'storyblok': 'storyblok.com', 'sitecore': 'sitecore.com',
  'adobe experience manager': 'adobe.com', 'typo3': 'typo3.org', 'umbraco': 'umbraco.com',
  'kentico': 'kentico.com', 'hugo': 'gohugo.io', 'jekyll': 'jekyllrb.com',
  'blogger': 'blogger.com', 'tilda': 'tilda.cc', 'tumblr': 'tumblr.com',
  'medium': 'medium.com', 'hexo': 'hexo.io', 'craft cms': 'craftcms.com',
  'duda': 'duda.co', 'jimdo': 'jimdo.com', 'strikingly': 'strikingly.com',
  'notion': 'notion.so', 'wagtail': 'wagtail.org', 'liferay': 'liferay.com',
  'pimcore': 'pimcore.com', 'october cms': 'octobercms.com', 'statamic': 'statamic.com',
  'keystonejs': 'keystonejs.com', 'datocms': 'datocms.com', 'directus': 'directus.io',
  'grav': 'getgrav.org', 'plone': 'plone.org', 'silverstripe': 'silverstripe.org',
  'concrete cms': 'concretecms.com', 'processwire': 'processwire.com',
  'contao': 'contao.org', 'odoo': 'odoo.com', 'bloomreach': 'bloomreach.com',
  'magnolia': 'magnolia-cms.com', 'hubspot cms hub': 'hubspot.com',
  'google sites': 'https://www.google.com/s2/favicons?domain=sites.google.com&sz=64',
  // Frameworks & Libraries
  'react': 'react.dev', 'next.js': 'nextjs.org', 'nuxt.js': 'nuxt.com',
  'vue.js': 'vuejs.org', 'angular': 'angular.dev', 'angularjs': 'angularjs.org',
  'svelte': 'svelte.dev', 'sveltekit': 'kit.svelte.dev', 'gatsby': 'gatsbyjs.com',
  'remix': 'remix.run', 'astro': 'astro.build', 'jquery': 'jquery.com',
  'backbone.js': 'backbonejs.org', 'ember.js': 'emberjs.com', 'alpine.js': 'alpinejs.dev',
  'preact': 'preactjs.com', 'solid.js': 'solidjs.com', 'qwik': 'qwik.dev',
  'lit': 'lit.dev', 'polymer': 'polymer-project.org', 'inferno': 'infernojs.org',
  'mithril': 'mithril.js.org', 'marko': 'markojs.com', 'aurelia': 'aurelia.io',
  'knockout.js': 'knockoutjs.com', 'meteor': 'meteor.com', 'fresh': 'fresh.deno.dev',
  'stencil': 'stenciljs.com', 'htmx': 'htmx.org', 'hotwire': 'hotwired.dev',
  'turbo': 'turbo.hotwired.dev', 'turbolinks': 'turbo.hotwired.dev',
  'stimulus': 'stimulus.hotwired.dev', 'ext js': 'sencha.com',
  // UI Frameworks
  'bootstrap': 'getbootstrap.com', 'tailwind css': 'tailwindcss.com',
  'material ui': 'mui.com', 'chakra ui': 'chakra-ui.com', 'ant design': 'ant.design',
  'bulma': 'bulma.io', 'foundation': 'get.foundation', 'semantic ui': 'semantic-ui.com',
  'vuetify': 'vuetifyjs.com', 'quasar': 'quasar.dev',
  'element ui': 'element.eleme.io', 'primevue': 'primevue.org',
  'primereact': 'primereact.org', 'primeng': 'primeng.org',
  'mantine': 'mantine.dev', 'daisyui': 'daisyui.com', 'flowbite': 'flowbite.com',
  'materialize': 'materializecss.com', 'shoelace': 'shoelace.style',
  'uikit': 'getuikit.com', 'fluent ui': 'fluent2.microsoft.design',
  'carbon design system': 'carbondesignsystem.com', 'primer css': 'primer.style',
  'tachyons': 'tachyons.io',
  // JS Libraries
  'lodash': 'lodash.com', 'underscore.js': 'underscorejs.org',
  'moment.js': 'momentjs.com', 'axios': 'axios-http.com', 'rxjs': 'rxjs.dev',
  'redux': 'redux.js.org', 'vuex': 'vuex.vuejs.org', 'pinia': 'pinia.vuejs.org',
  'd3.js': 'd3js.org', 'chart.js': 'chartjs.org', 'three.js': 'threejs.org',
  'gsap': 'gsap.com', 'anime.js': 'animejs.com', 'lottie': 'airbnb.io',
  'swiper': 'swiperjs.com', 'slick': 'kenwheeler.github.io',
  'flickity': 'flickity.metafizzy.co', 'masonry': 'masonry.desandro.com',
  'isotope': 'isotope.metafizzy.co', 'fancybox': 'fancyapps.com',
  'scrollmagic': 'scrollmagic.io', 'particles.js': 'vincentgarreau.com',
  'fullpage.js': 'alvarotrigo.com', 'lazysizes': 'github.com',
  'modernizr': 'modernizr.com', 'hammer.js': 'hammerjs.github.io',
  'clipboard.js': 'clipboardjs.com', 'dropzone.js': 'dropzone.dev',
  'highlight.js': 'highlightjs.org', 'prism': 'prismjs.com',
  'aos': 'michalsnik.github.io', 'typed.js': 'mattboldt.com',
  'tippy.js': 'atomiks.github.io', 'popper.js': 'popper.js.org',
  'handlebars': 'handlebarsjs.com', 'requirejs': 'requirejs.org',
  'sweetalert': 'sweetalert2.github.io', 'socket.io': 'socket.io',
  'pdf.js': 'mozilla.github.io', 'katex': 'katex.org', 'mathjax': 'mathjax.org',
  'pixijs': 'pixijs.com', 'howler.js': 'howlerjs.com',
  'core-js': 'github.com/nicolo-ribaudo', // generic fallback
  // Build Tools
  'webpack': 'webpack.js.org', 'vite': 'vitejs.dev', 'babel': 'babeljs.io',
  'typescript': 'typescriptlang.org',
  // Backend Frameworks
  'express': 'expressjs.com', 'django': 'djangoproject.com', 'laravel': 'laravel.com',
  'rails': 'rubyonrails.org', 'spring': 'spring.io',
  // Analytics & Tracking
  'google analytics': 'https://www.google.com/s2/favicons?domain=analytics.google.com&sz=64',
  'google tag manager': 'https://www.google.com/s2/favicons?domain=tagmanager.google.com&sz=64',
  'google ads': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'google adsense': 'https://www.google.com/s2/favicons?domain=adsense.google.com&sz=64',
  'google optimize': 'https://www.google.com/s2/favicons?domain=optimize.google.com&sz=64',
  'google remarketing': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'google search console': 'https://www.google.com/s2/favicons?domain=search.google.com&sz=64',
  'google ad manager': 'https://www.google.com/s2/favicons?domain=admob.google.com&sz=64',
  'facebook pixel': 'facebook.com',
  'facebook ads': 'facebook.com',
  'facebook retargeting': 'facebook.com',
  'meta pixel': 'meta.com',
  'microsoft clarity': 'https://www.google.com/s2/favicons?domain=clarity.microsoft.com&sz=64',
  'microsoft advertising': 'microsoft.com',
  'linkedin insight tag': 'linkedin.com', 'pinterest tag': 'pinterest.com',
  'tiktok pixel': 'tiktok.com', 'snapchat pixel': 'snapchat.com',
  'twitter pixel': 'twitter.com', 'reddit pixel': 'reddit.com',
  'quora pixel': 'quora.com', 'bing webmaster': 'bing.com',
  'hotjar': 'hotjar.com', 'mixpanel': 'mixpanel.com', 'amplitude': 'amplitude.com',
  'segment': 'segment.com', 'heap': 'heap.io', 'posthog': 'posthog.com',
  'matomo': 'matomo.org', 'plausible analytics': 'plausible.io',
  'contentsquare': 'contentsquare.com', 'fullstory': 'fullstory.com',
  'logrocket': 'logrocket.com', 'smartlook': 'smartlook.com',
  'crazy egg': 'crazyegg.com', 'mouseflow': 'mouseflow.com',
  'lucky orange': 'luckyorange.com', 'inspectlet': 'inspectlet.com',
  'sessioncam': 'sessioncam.com', 'usertesting': 'usertesting.com',
  'optimizely': 'optimizely.com', 'vwo': 'vwo.com', 'vwo engage': 'vwo.com',
  'ab tasty': 'abtasty.com', 'dynamic yield': 'dynamicyield.com',
  'kameleoon': 'kameleoon.com', 'sitespect': 'sitespect.com',
  'monetate': 'monetate.com', 'convert experiences': 'convert.com',
  'evergage': 'evergage.com', 'growthbook': 'growthbook.io',
  'launchdarkly': 'launchdarkly.com', 'split.io': 'split.io',
  'statsig': 'statsig.com', 'unbounce': 'unbounce.com',
  'instapage': 'instapage.com', 'leadpages': 'leadpages.com',
  'landingi': 'landingi.com', 'clickfunnels': 'clickfunnels.com',
  'convertflow': 'convertflow.com', 'lander': 'landerapp.com',
  'quantum metric': 'quantummetric.com', 'glassbox': 'glassbox.com',
  'appsflyer': 'appsflyer.com', 'adjust': 'adjust.com', 'branch': 'branch.io',
  'flurry': 'flurry.com', 'countly': 'countly.com',
  'monsterinsights': 'monsterinsights.com', 'pixelyoursite': 'pixelyoursite.com',
  // Customer Engagement / CRM
  'clevertap': 'clevertap.com', 'webengage': 'webengage.com',
  'moengage': 'moengage.com', 'onesignal': 'onesignal.com',
  'braze': 'braze.com', 'omnisend': 'omnisend.com', 'brevo': 'brevo.com',
  'pushwoosh': 'pushwoosh.com', 'izooto': 'izooto.com', 'contlo': 'contlo.com',
  'wigzo': 'wigzo.com', 'netcore': 'netcorecloud.com', 'iterable': 'iterable.com',
  'lemnisk': 'lemnisk.co', 'appier': 'appier.com', 'airship': 'airship.com',
  'klaviyo': 'klaviyo.com', 'mailchimp': 'mailchimp.com', 'hubspot': 'hubspot.com',
  'marketo': 'marketo.com', 'activecampaign': 'activecampaign.com',
  'bitespeed': 'bitespeed.co',
  'salesforce': 'salesforce.com',
  'zoho crm': 'zoho.com', 'pipedrive': 'pipedrive.com',
  'freshsales': 'freshworks.com', 'microsoft dynamics 365': 'microsoft.com',
  'sugarcrm': 'sugarcrm.com', 'insightly': 'insightly.com',
  'agile crm': 'agilecrm.com', 'bitrix24': 'bitrix24.com',
  'copper': 'copper.com', 'apollo.io': 'apollo.io',
  'leadsquared': 'leadsquared.com', 'nimble': 'nimble.com',
  'close crm': 'close.com', 'nutshell': 'nutshell.com',
  'folk crm': 'folk.app', 'attio': 'attio.com',
  'monday crm': 'monday.com', 'streak': 'streak.com',
  'convertkit': 'convertkit.com', 'getresponse': 'getresponse.com',
  'drip': 'drip.com', 'aweber': 'aweber.com',
  'campaign monitor': 'campaignmonitor.com', 'constant contact': 'constantcontact.com',
  'sendinblue': 'brevo.com', 'elastic email': 'elasticemail.com',
  'mailerlite': 'mailerlite.com', 'mailjet': 'mailjet.com',
  'mailmodo': 'mailmodo.com', 'moosend': 'moosend.com',
  'sendgrid': 'sendgrid.com', 'sendpulse': 'sendpulse.com',
  'customer.io': 'customer.io', 'ortto': 'ortto.com',
  'autopilot': 'ortto.com', 'sharpspring': 'sharpspring.com',
  'responsys': 'oracle.com', 'sailthru': 'sailthru.com',
  'listrak': 'listrak.com', 'dotdigital': 'dotdigital.com',
  'emarsys': 'emarsys.com', 'cordial': 'cordial.com',
  'bluecore': 'bluecore.com', 'wunderkind': 'wunderkind.co',
  'postscript': 'postscript.io', 'attentive': 'attentivemobile.com',
  'bloomreach engagement': 'bloomreach.com',
  // Chat & Support
  'intercom': 'intercom.com', 'intercom marketing': 'intercom.com',
  'zendesk': 'zendesk.com', 'freshdesk': 'freshworks.com',
  'freshservice': 'freshworks.com', 'freshmarketer': 'freshworks.com',
  'drift': 'drift.com', 'crisp': 'crisp.chat', 'tidio': 'tidio.com',
  'tawk.to': 'tawk.to', 'livechat': 'livechat.com',
  'gorgias': 'gorgias.com', 'reamaze': 'reamaze.com',
  'jivochat': 'jivochat.com', 'chatra': 'chatra.com',
  'chatwoot': 'chatwoot.com', 'helpcrunch': 'helpcrunch.com',
  'smartsupp': 'smartsupp.com', 'userlike': 'userlike.com',
  'snapengage': 'snapengage.com', 'kayako': 'kayako.com',
  'pure chat': 'purechat.com', 'customerly': 'customerly.io',
  'dixa': 'dixa.com', 'sleeknote': 'sleeknote.com',
  'kommunicate': 'kommunicate.io', 'genesys cloud': 'genesys.com',
  'salesforce live agent': 'salesforce.com', 'trengo': 'trengo.com',
  'sprinklr': 'sprinklr.com',
  'zoho salesiq': 'zoho.com',
  'zoho desk': 'zoho.com',
  'zoho campaigns': 'zoho.com',
  // Payments
  'stripe': 'stripe.com', 'paypal': 'paypal.com', 'razorpay': 'razorpay.com',
  'cashfree': 'cashfree.com', 'payu': 'payu.in', 'paytm pg': 'paytm.com',
  'phonepe pg': 'phonepe.com', 'phonepe switch': 'phonepe.com',
  'klarna': 'klarna.com', 'afterpay': 'afterpay.com', 'clearpay': 'clearpay.com',
  'affirm': 'affirm.com', 'sezzle': 'sezzle.com', 'braintree': 'braintreepayments.com',
  'adyen': 'adyen.com', 'square': 'squareup.com', 'mollie': 'mollie.com',
  'worldpay': 'worldpay.com', 'authorize.net': 'authorize.net',
  'checkout.com': 'checkout.com', 'bluesnap': 'bluesnap.com',
  '2checkout (verifone)': 'verifone.com', 'paddle': 'paddle.com',
  'flutterwave': 'flutterwave.com', 'paystack': 'paystack.com',
  'payfast': 'payfast.co.za', 'wepay': 'wepay.com', 'payoneer': 'payoneer.com',
  'amazon pay': 'pay.amazon.com', 'apple pay': 'apple.com',
  'google pay': 'https://www.google.com/s2/favicons?domain=pay.google.com&sz=64', 'visa': 'visa.com',
  'mastercard': 'mastercard.com', 'american express': 'americanexpress.com',
  'simpl': 'getsimpl.com', 'lazypay': 'lazypay.in', 'snapmint': 'snapmint.com',
  'instamojo': 'instamojo.com', 'ccavenue': 'ccavenue.com',
  'billdesk': 'billdesk.com', 'juspay': 'juspay.in',
  'juspay express checkout': 'juspay.in', 'paynimo': 'paynimo.com',
  'hdfc payment gateway': 'hdfcbank.com', 'icici eazypay': 'icicibank.com',
  'axis bank payment gateway': 'axisbank.com', 'easebuzz': 'easebuzz.in',
  'zaakpay': 'zaakpay.com', 'open financial': 'open.money',
  'decentro': 'decentro.tech', 'mangopay': 'mangopay.com',
  'cred pay': 'cred.club', 'uni cards': 'uni.cards',
  'airpay': 'airpay.co.in', 'mobikwik pg': 'mobikwik.com',
  'pine labs': 'pinelabs.com', 'direcpay': 'direcpay.com',
  'capital float': 'capitalfloat.com', 'zestmoney': 'zestmoney.in',
  'kissht': 'kissht.com', 'epaylater': 'epaylater.in',
  'flexipay': 'flexipay.com', 'postpe': 'postpe.com',
  'laybuy': 'laybuy.com', 'tabby': 'tabby.ai', 'tamara': 'tamara.co',
  'alma': 'almapay.com', 'scalapay': 'scalapay.com',
  'splitit': 'splitit.com', 'atome': 'atome.sg', 'kredivo': 'kredivo.com',
  'zip': 'zip.co', 'kiwi checkout': 'kiwi.com',
  'paykun': 'paykun.com', 'magicpin pay': 'magicpin.in',
  // BNPL
  'shiprocket': 'shiprocket.in', 'shiprocket checkout': 'shiprocket.in',
  'shipstation': 'shipstation.com', 'aftership': 'aftership.com',
  'narvar': 'narvar.com', 'delhivery': 'delhivery.com',
  // Reviews & Loyalty
  'yotpo': 'yotpo.com', 'yotpo loyalty': 'yotpo.com',
  'judge.me': 'judge.me', 'stamped.io': 'stamped.io',
  'trustpilot': 'trustpilot.com', 'bazaarvoice': 'bazaarvoice.com',
  'loox': 'loox.io', 'junip': 'junip.co', 'okendo': 'okendo.io',
  'reviews.io': 'reviews.io', 'shopper approved': 'shopperapproved.com',
  'powerreviews': 'powerreviews.com', 'birdeye': 'birdeye.com',
  'feefo': 'feefo.com', 'fera.ai': 'fera.ai', 'trusted shops': 'trustedshops.com',
  'smile.io': 'smile.io', 'loyaltylion': 'loyaltylion.com',
  'annex cloud': 'annexcloud.com', 'antavo': 'antavo.com',
  'kangaroo rewards': 'kangaroorewards.com', 'loyalty gator': 'loyaltygator.com',
  'open loyalty': 'openloyalty.io', 'zinrelo': 'zinrelo.com',
  'bon loyalty': 'bonloyalty.com', 'joy loyalty': 'joyrewards.io',
  'growave': 'growave.io', 'wployalty': 'wployalty.net',
  'rise.ai': 'rise.ai', 'talon.one': 'talon.one',
  // SEO & Marketing
  'yoast seo': 'yoast.com', 'rank math': 'rankmath.com',
  'all in one seo': 'aioseo.com', 'seopress': 'seopress.org',
  'schema pro': 'wpschema.com', 'json-ld schema': 'schema.org',
  'open graph': 'ogp.me', 'twitter cards': 'twitter.com', 'indexnow': 'indexnow.org',
  'ahrefs': 'ahrefs.com', 'semrush': 'semrush.com',
  // Popups & Conversion
  'privy': 'privy.com', 'sumo': 'sumo.com', 'wisepops': 'wisepops.com',
  'optinmonster': 'optinmonster.com', 'optimonk': 'optimonk.com',
  'justuno': 'justuno.com', 'hello bar': 'hellobar.com',
  'recart': 'recart.com', 'nosto': 'nosto.com', 'barilliance': 'barilliance.com',
  'fresh relevance': 'freshrelevance.com', 'clerk.io': 'clerk.io',
  'salecycle': 'salecycle.com', 'cartstack': 'cartstack.com',
  'wunderkind': 'wunderkind.co', 'subscribers': 'subscribers.com',
  'pushengage': 'pushengage.com', 'reconvert': 'reconvert.io',
  // Advertising
  'criteo': 'criteo.com', 'criteo retargeting': 'criteo.com',
  'outbrain': 'outbrain.com', 'taboola': 'taboola.com',
  'adroll': 'adroll.com', 'amazon advertising': 'advertising.amazon.com',
  'the trade desk': 'thetradedesk.com', 'rtb house': 'rtbhouse.com',
  'carbon ads': 'carbonads.net', 'inmobi': 'inmobi.com',
  'mediavine': 'mediavine.com', 'ezoic': 'ezoic.com',
  'doubleclick': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'doubleclick floodlight': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'google publisher tag': 'https://www.google.com/s2/favicons?domain=ads.google.com&sz=64',
  'mediamath': 'mediamath.com',
  // CDN & Infrastructure
  'cloudflare': 'cloudflare.com', 'cloudflare browser insights': 'cloudflare.com',
  'cloudflare rocket loader': 'cloudflare.com',
  'fastly': 'fastly.com', 'akamai': 'akamai.com',
  'aws cloudfront': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'amazon cloudfront': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'bunny cdn': 'bunny.net', 'keycdn': 'keycdn.com',
  'vercel': 'vercel.com', 'netlify': 'netlify.com',
  'firebase': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'firebase cloud messaging': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'heroku': 'heroku.com', 'digitalocean': 'digitalocean.com',
  'google cloud': 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64', 'azure': 'microsoft.com',
  'aws': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'amazon s3': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  // Web Servers
  'nginx': 'nginx.com', 'apache': 'apache.org', 'iis': 'iis.net',
  'litespeed': 'litespeedtech.com', 'caddy': 'caddyserver.com',
  'openresty': 'openresty.org',
  // Languages & Databases
  'node.js': 'nodejs.org', 'php': 'php.net', 'python': 'python.org',
  'ruby': 'ruby-lang.org', 'java': 'java.com',
  'mysql': 'mysql.com', 'postgresql': 'postgresql.org',
  'mongodb': 'mongodb.com', 'redis': 'redis.io',
  'elasticsearch': 'elastic.co',
  // Caching
  'varnish': 'varnish-cache.org', 'litespeed cache': 'litespeedtech.com',
  'w3 total cache': 'boldgrid.com', 'wp rocket': 'wp-rocket.me',
  'wp super cache': 'wordpress.org', 'autoptimize': 'autoptimize.com',
  // Security
  'recaptcha': 'https://www.gstatic.com/recaptcha/api2/logo_48.png',
  'recaptcha v3': 'https://www.gstatic.com/recaptcha/api2/logo_48.png',
  'google recaptcha': 'https://www.gstatic.com/recaptcha/api2/logo_48.png', 'hcaptcha': 'hcaptcha.com',
  'sucuri': 'sucuri.net', 'wordfence': 'wordfence.com',
  'cookiebot': 'cookiebot.com', 'onetrust': 'onetrust.com',
  'osano': 'osano.com', 'accessibe': 'accessibe.com', 'userway': 'userway.org',
  // Monitoring
  'sentry': 'sentry.io', 'datadog': 'datadoghq.com', 'new relic': 'newrelic.com',
  // Fonts & Media
  'typekit': 'fonts.adobe.com',
  'adobe fonts': 'fonts.adobe.com',
  'google fonts': 'https://www.google.com/s2/favicons?domain=fonts.google.com&sz=64',
  'google maps': 'https://www.google.com/s2/favicons?domain=maps.google.com&sz=64',
  'mapbox': 'mapbox.com', 'leaflet': 'leafletjs.com',
  'youtube': 'youtube.com', 'vimeo': 'vimeo.com', 'wistia': 'wistia.com',
  'algolia': 'algolia.com', 'algolia recommend': 'algolia.com',
  // WordPress / Shopify Plugins
  'elementor': 'elementor.com', 'wpbakery': 'wpbakery.com',
  'divi builder': 'elegantthemes.com', 'beaver builder': 'wpbeaverbuilder.com',
  'advanced custom fields': 'advancedcustomfields.com',
  'gravity forms': 'gravityforms.com', 'wpforms': 'wpforms.com',
  'contact form 7': 'contactform7.com', 'jetpack': 'jetpack.com',
  'polylang': 'polylang.pro', 'wpml': 'wpml.org',
  'weglot': 'weglot.com', 'smush': 'wpmudev.com',
  'gempages': 'gempages.net', 'pagefly': 'pagefly.io',
  'vitals': 'vitals.co', 'shogun': 'getshogun.com',
  'bold commerce': 'boldcommerce.com', 'bold store locator': 'boldcommerce.com',
  'recharge': 'rechargepayments.com', 'marsello': 'marsello.com',
  // Communications
  'twilio': 'twilio.com', 'twilio segment': 'segment.com',
  'msg91': 'msg91.com', 'exotel': 'exotel.com',
  'kaleyra': 'kaleyra.com', 'knowlarity': 'knowlarity.com',
  'route mobile': 'routemobile.com', 'gupshup': 'gupshup.io',
  'messagebird': 'messagebird.com', 'cm.com': 'cm.com',
  'haptik': 'haptik.ai', 'gallabox': 'gallabox.com',
  'interakt': 'interakt.shop', 'wati': 'wati.io',
  'zoko': 'zoko.io', 'aisensy': 'aisensy.com',
  'delightchat': 'delightchat.io', 'rapchat': 'rapchat.com',
  'verloop': 'verloop.io', 'whatsapp business chat': 'whatsapp.com',
  // Scheduling
  'calendly': 'calendly.com', 'acuity scheduling': 'acuityscheduling.com',
  // Store Locators
  'storemapper': 'storemapper.com', 'storepoint': 'storepoint.co',
  'stockist': 'stockist.co', 'bullseye locations': 'bullseyelocations.com',
  'yext': 'yext.com', 'locally.io': 'locally.io',
  'store locator plus': 'storelocatorplus.com', 'storerocket': 'storerocket.io',
  'secomapp store locator': 'secomapp.com', 'progus commerce locator': 'progus.com',
  // Misc
  'typeform': 'typeform.com',
  'adobe experience cloud': 'adobe.com',
  'adobe target': 'adobe.com',
  'adobe analytics': 'adobe.com',
  'insider': 'useinsider.com', 'engage360': 'engage360.io',
  'superagi': 'superagi.com',
  'pardot': 'salesforce.com',
  'keap': 'keap.com', 'acoustic': 'acoustic.com',
  'loop returns': 'loopreturns.com', 'referralcandy': 'referralcandy.com',
  'gokwik': 'gokwik.co', 'grprogram': 'grprogram.com',
  'mesoka': 'mesoka.com', 'pinnacle': 'pinnacle.com',
  // Tag Managers
  'adobe launch': 'adobe.com', 'tealium': 'tealium.com', 'segment': 'segment.com',
  'ensighten': 'ensighten.com', 'tagcommander': 'tagcommander.com',
  'piwik tag manager': 'matomo.org',
  // Live Chat
  'tidio': 'tidio.com', 'tawk.to': 'tawk.to', 'livechat': 'livechat.com',
  'zendesk chat': 'zendesk.com', 'crisp': 'crisp.chat', 'olark': 'olark.com',
  'freshchat': 'freshchat.com', 'chatwoot': 'chatwoot.com',
  'helpscout beacon': 'https://www.google.com/s2/favicons?domain=helpscout.com&sz=64', 'kommunicate': 'kommunicate.io',
  'yellow.ai': 'yellow.ai', 'verloop': 'verloop.io',
  // Search
  'algolia': 'algolia.com', 'elasticsearch': 'elastic.co', 'klevu': 'klevu.com',
  'searchspring': 'searchspring.net', 'doofinder': 'doofinder.com',
  'typesense': 'typesense.org', 'meilisearch': 'meilisearch.com',
  'swiftype': 'swiftype.com', 'constructor.io': 'constructor.io',
  // Subscription
  'recharge': 'rechargepayments.com', 'bold subscriptions': 'boldcommerce.com',
  'chargebee': 'chargebee.com', 'recurly': 'recurly.com', 'zuora': 'zuora.com',
  'ordergroove': 'ordergroove.com',
  // Returns
  'narvar': 'narvar.com', 'returnly': 'returnly.com',
  'aftership returns': 'aftership.com', 'happy returns': 'happyreturns.com',
  // Shipping
  'aftership': 'aftership.com', 'shipstation': 'shipstation.com',
  'shippo': 'goshippo.com', 'easypost': 'easypost.com',
  'shiprocket': 'shiprocket.in', 'delhivery': 'delhivery.com',
  'clickpost': 'clickpost.in', 'nimbuspost': 'nimbuspost.com', 'route': 'route.com',
  // Cookie Compliance
  'cookiebot': 'cookiebot.com', 'onetrust': 'onetrust.com', 'trustarc': 'trustarc.com',
  'osano': 'osano.com', 'cookieyes': 'cookieyes.com', 'iubenda': 'iubenda.com',
  'quantcast choice': 'quantcast.com', 'termly': 'termly.io',
  // Accessibility
  'accessibe': 'accessibe.com', 'userway': 'userway.org',
  'equalweb': 'equalweb.com', 'audioeye': 'audioeye.com',
  // Security
  'cloudflare': 'cloudflare.com',
  'recaptcha': 'https://www.gstatic.com/recaptcha/api2/logo_48.png',
  'hcaptcha': 'hcaptcha.com',
  'akamai bot manager': 'akamai.com', 'imperva': 'imperva.com',
  'perimeterx': 'perimeterx.com', 'turnstile': 'cloudflare.com',
  // CDN & Infrastructure
  'akamai cdn': 'akamai.com', 'fastly': 'fastly.com', 'keycdn': 'keycdn.com',
  'stackpath': 'stackpath.com', 'vercel': 'vercel.com', 'netlify': 'netlify.com',
  'aws cloudfront': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'google cloud cdn': 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64',
  'azure cdn': 'microsoft.com', 'bunnycdn': 'bunny.net', 'imgix': 'imgix.com',
  // Performance
  'new relic': 'newrelic.com', 'datadog rum': 'datadoghq.com', 'sentry': 'sentry.io',
  'speedcurve': 'speedcurve.com', 'dynatrace': 'dynatrace.com',
  'logrocket': 'logrocket.com', 'fullstory': 'fullstory.com',
  'raygun': 'raygun.com', 'pingdom': 'pingdom.com',
  // Hosting
  'aws': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64', 'google cloud': 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64',
  'heroku': 'heroku.com', 'render': 'render.com', 'railway': 'railway.app',
  'digitalocean': 'digitalocean.com', 'fly.io': 'fly.io',
  // Font Scripts
  'google fonts': 'https://www.google.com/s2/favicons?domain=fonts.google.com&sz=64',
  'adobe fonts': 'fonts.adobe.com',
  'font awesome': 'fontawesome.com',
  // Maps
  'google maps': 'https://www.google.com/s2/favicons?domain=maps.google.com&sz=64',
  'mapbox': 'mapbox.com', 'leaflet': 'leafletjs.com',
  'openstreetmap': 'openstreetmap.org', 'here maps': 'here.com',
  // Video Players
  'youtube embed': 'youtube.com', 'vimeo': 'vimeo.com', 'wistia': 'wistia.com',
  'vidyard': 'vidyard.com', 'jw player': 'jwplayer.com', 'brightcove': 'brightcove.com',
  // Surveys
  'surveymonkey': 'surveymonkey.com', 'qualtrics': 'qualtrics.com',
  'hotjar surveys': 'hotjar.com', 'medallia': 'medallia.com', 'uservoice': 'uservoice.com',
  // Booking
  'calendly': 'calendly.com', 'acuity scheduling': 'acuityscheduling.com',
  'simplybook.me': 'simplybook.me',
  // Social Proof
  'fomo': 'fomo.com', 'provesource': 'provesrc.com', 'nudgify': 'nudgify.com',
  'fera.ai': 'fera.ai', 'trustpulse': 'trustpulse.com',
  // Analytics
  'plausible': 'plausible.io', 'fathom': 'usefathom.com', 'umami': 'umami.is',
  'posthog': 'posthog.com', 'heap': 'heap.io', 'amplitude': 'amplitude.com',
  'pendo': 'pendo.io', 'kissmetrics': 'kissmetrics.com',
  // Email
  'mailgun': 'mailgun.com', 'postmark': 'postmarkapp.com',
  // Databases
  'firebase': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64', 'supabase': 'supabase.com',
  // Authentication
  'google sign-in': 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
  'facebook login': 'facebook.com',
  'auth0': 'auth0.com', 'okta': 'okta.com', 'clerk': 'clerk.com',
  // India-specific
  'unicommerce': 'unicommerce.com', 'vinculum': 'vinculumgroup.com',
  'instamojo': 'instamojo.com', 'billdesk': 'billdesk.com',
  'ccavenue': 'ccavenue.com', 'phonepe': 'phonepe.com', 'paytm': 'paytm.com',
  // SMS / Referral
  'attentive': 'attentivemobile.com', 'postscript': 'postscript.io',
  'yotpo smsbump': 'smsbump.com',
  'friendbuy': 'friendbuy.com', 'talkable': 'talkable.com',
  'extole': 'extole.com', 'impact.com': 'impact.com',
  // Personalisation
  'rebuy': 'rebuyengine.com', 'limespot': 'limespot.com', 'glood.ai': 'glood.ai',
  'visenze': 'visenze.com',
  // Shopify Apps additions
  'wishlist plus': 'swym.it', 'wishlist king': 'appmate.io',
  // ── Missing techs (synced from dashboard TECH_LOGO_MAP) ──
  'adobe fonts (typekit)': 'fonts.adobe.com',
  'akamai mpulse': 'akamai.com',
  'algolia ai': 'algolia.com',
  'amazon ses': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'apollo client': 'apollographql.com', 'apollo graphql': 'apollographql.com',
  'appdynamics': 'appdynamics.com',
  'baremetrics': 'baremetrics.com',
  'barilliance recommendations': 'barilliance.com',
  'bing uet': 'bing.com',
  'blue triangle': 'bluetriangle.com',
  'blueconic': 'blueconic.com',
  'boomerang': 'akamai.com',
  'paperform': 'paperform.co',
  'manager': 'google.com',
  'vue storefront': 'vuestorefront.io',
  'bugsnag': 'bugsnag.com',
  'builder.io': 'builder.io',
  'bun': 'bun.sh',
  'cal.com': 'cal.com',
  'census': 'getcensus.com',
  'chartbeat': 'chartbeat.com',
  'chatbot (ai)': 'chatbot.com',
  'clicky': 'clicky.com',
  'cloudflare turnstile': 'cloudflare.com',
  'cloudinary': 'cloudinary.com',
  'comscore': 'comscore.com', 'comScore': 'comscore.com',
  'datatables': 'datatables.net',
  'decibel insight': 'decibelinsight.com',
  'deno': 'deno.land',
  'didomi': 'didomi.io',
  'discord widget': 'discord.com',
  'docusaurus': 'docusaurus.io',
  'eleventy': '11ty.dev',
  'eloqua': 'oracle.com',
  'envoy': 'envoyproxy.io',
  'fathom analytics': 'usefathom.com',
  'firebase analytics': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'firebase auth': 'https://www.google.com/s2/favicons?domain=firebase.google.com&sz=64',
  'firework': 'firework.com',
  'flagsmith': 'flagsmith.com',
  'fonts.com': 'fonts.com',
  'framer motion': 'framer.com',
  'getbutton': 'getbutton.io',
  'gift reggie': 'giftreggie.com',
  'gosquared': 'gosquared.com',
  'graphql': 'graphql.org',
  'hsts': 'hstspreload.org',
  'headless ui': 'headlessui.com',
  'hightouch': 'hightouch.com',
  'hygraph': 'hygraph.com',
  'imagekit': 'imagekit.io',
  'impact': 'impact.com',
  'indicative': 'indicative.com',
  'jotform': 'jotform.com',
  'keycloak': 'keycloak.org',
  'kochava': 'kochava.com',
  'leanplum': 'leanplum.com',
  'liveintent': 'liveintent.com',
  'loadable-components': 'loadable-components.com',
  'localize': 'localizejs.com',
  'localytics': 'localytics.com',
  'lytics': 'lytics.com',
  'mobx': 'mobx.js.org',
  'neon': 'neon.tech',
  'nextdoor ads': 'nextdoor.com',
  'ometria': 'ometria.com',
  'onetrust cookiepro': 'onetrust.com',
  'oribi': 'oribi.io',
  'parse.ly': 'parsely.com',
  'petite vue': 'vuejs.org',
  'pirsch': 'pirsch.io',
  'planetscale': 'planetscale.com',
  'polyfill.io': 'polyfill.io',
  'popupsmart': 'popupsmart.com',
  'priority hints': 'web.dev',
  'profitwell': 'profitwell.com',
  'pushowl': 'pushowl.com',
  'pusher': 'pusher.com',
  'radix ui': 'radix-ui.com',
  'relay': 'relay.dev',
  'retention.com': 'retention.com',
  'revlifter': 'revlifter.com',
  'rollbar': 'rollbar.com',
  'rudderstack': 'rudderstack.com',
  'salesforce dmp (krux)': 'salesforce.com',
  'salesforce einstein': 'salesforce.com',
  'salesforce marketing cloud': 'salesforce.com',
  'searchanise': 'searchanise.com',
  'signifyd': 'signifyd.com',
  'simon data': 'simondata.com',
  'simple analytics': 'simpleanalytics.com',
  'singular': 'singular.net',
  'snowplow': 'snowplow.io',
  'sprig': 'sprig.com',
  'statcounter': 'statcounter.com',
  'supabase auth': 'supabase.com',
  'tally': 'tally.so',
  'taplytics': 'taplytics.com',
  'transifex': 'transifex.com',
  'treasure data': 'treasuredata.com',
  'upi': 'npci.org.in',
  'uxcam': 'uxcam.com',
  'unleash': 'getunleash.io',
  'uploadcare': 'uploadcare.com',
  'upstash': 'upstash.com',
  'usabilla': 'usabilla.com',
  'usercentrics': 'usercentrics.com',
  'vercel ai sdk': 'vercel.com',
  'whatsapp chat widget': 'whatsapp.com',
  'woopra': 'woopra.com',
  'yalo': 'yalo.com',
  'zustand': 'zustand-demo.pmnd.rs',
  'generator': 'wordpress.org',
  'google-site-verification': 'https://www.google.com/s2/favicons?domain=search.google.com&sz=64',
  'igodigital': 'salesforce.com',
  'jsdelivr cdn': 'jsdelivr.com',
  'mparticle': 'mparticle.com',
  'msvalidate.01': 'bing.com',
  'shadcn/ui': 'ui.shadcn.com',
  'styled-components': 'styled-components.com',
  'trpc': 'trpc.io',
  'unpkg': 'unpkg.com',
  // ── Real-world gaps found via head-only scans (slug guess was wrong) ──
  'turbopack': 'turbo.build',
  'freshpaint': 'freshpaint.io',
  'netlify cdn': 'netlify.com',
  'netlify cms': 'netlify.com',
  'owl carousel': 'owlcarousel2.github.io',
  'the seo framework': 'theseoframework.com',
};

// ── DOM refs ────────────────────────────────────────────────────────────
const siteUrlEl      = document.getElementById('site-url');
const refreshBtn     = document.getElementById('refresh-btn');
const themeBtn       = document.getElementById('theme-btn');
const loadingState   = document.getElementById('loading-state');
const errorState     = document.getElementById('error-state');
const errorText      = document.getElementById('error-text');
const panelDetails   = document.getElementById('panel-details');
const panelTech      = document.getElementById('panel-tech');
const detailsContent = document.getElementById('details-content');
const techSummary    = document.getElementById('tech-summary');
const categoriesEl   = document.getElementById('categories');
// No tabs — single scrollable panel

let currentUrl = '';
let lastResult = null;

// ── Local cache (30-day TTL) ────────────────────────────────────────
const CACHE_KEY = 'techscanner-cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day

function getCached(domain) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = cache[domain];
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    if (entry) { delete cache[domain]; localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
  } catch {}
  return null;
}

function setCache(domain, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[domain] = { data, ts: Date.now() };
    const keys = Object.keys(cache);
    if (keys.length > 200) {
      keys.sort((a, b) => cache[a].ts - cache[b].ts);
      for (let i = 0; i < keys.length - 200; i++) delete cache[keys[i]];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// ── Theme ───────────────────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('techscanner-theme');
  if (saved === 'dark') document.body.classList.add('dark');
}
loadTheme();

themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('techscanner-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

// ── Init ────────────────────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url) {
    try {
      const url = new URL(tabs[0].url);
      currentUrl = url.hostname.replace(/^www\d*\./, '');
      siteUrlEl.textContent = currentUrl;
    } catch {
      siteUrlEl.textContent = tabs[0].url;
      currentUrl = tabs[0].url;
    }
    doScan(false);
  } else {
    siteUrlEl.textContent = 'Unable to detect';
  }
});

function showBothPanels() {
  panelDetails.classList.remove('hidden');
  panelTech.classList.remove('hidden');
  adjustPopupHeight();
}

let popupHeightLocked = false;
function adjustPopupHeight() {
  if (popupHeightLocked) return;
  requestAnimationFrame(() => {
    if (popupHeightLocked) return;
    const scrollHint = document.getElementById('scroll-hint');
    if (scrollHint) {
      // Use offsetTop + offsetHeight for stable measurement unaffected by scroll
      const targetHeight = scrollHint.offsetTop + scrollHint.offsetHeight;
      document.body.style.height = targetHeight + 'px';
      document.documentElement.style.height = targetHeight + 'px';
      popupHeightLocked = true;
    }
  });
}

refreshBtn.addEventListener('click', () => doScan(true));


// ── Scan ────────────────────────────────────────────────────────────────
async function doScan(forceRefresh = false) {
  if (!currentUrl) return;

  popupHeightLocked = false;
  document.body.style.height = '';
  document.documentElement.style.height = '';

  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');
  panelDetails.classList.add('hidden');
  panelTech.classList.add('hidden');

  // Show cached data instantly if available (no loading spinner)
  const cached = !forceRefresh && getCached(currentUrl);
  if (cached) {
    lastResult = cached;
    renderDetails(cached);
    renderTechStack(cached);
    showBothPanels();
    // Still fetch fresh data in background to update cache
    fetchFresh(false).catch(() => {});
    return;
  }

  // No cache — show loading and fetch
  loadingState.classList.remove('hidden');
  await fetchFresh(forceRefresh);
}

// ── Capture live page data from the active tab ────────────────────────
async function capturePageData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab?.url?.startsWith('http')) return null;

  // 1. Inject script into the active tab to capture page data
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Capture HTML but sanitize it for safe POST (strip <script> content that triggers WAFs)
      // Keep <script src="..."> tags (just the tag, not inline code) + all other HTML
      let html = document.documentElement.outerHTML;
      // Remove inline script content but keep the tags with src attributes
      html = html.replace(/<script(?![^>]*\bsrc\b)[^>]*>[\s\S]*?<\/script>/gi, '');
      // Cap at 800KB — enough for pattern matching, safe for POST
      html = html.slice(0, 800_000);

      // All script src URLs from the live DOM (includes dynamically loaded)
      const scriptSrcs = [...document.querySelectorAll('script[src]')].map(s => s.src);

      // Meta tags
      const metaMap = {};
      document.querySelectorAll('meta[content]').forEach(m => {
        const key = (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase();
        if (key) metaMap[key] = m.getAttribute('content');
      });

      // JS globals — reveals frameworks, analytics, etc. that may not be in HTML
      const jsGlobals = {};
      const checks = [
        ['dataLayer', () => window.dataLayer],
        ['nextjs', () => window.__NEXT_DATA__],
        ['nuxt', () => window.__NUXT__],
        ['shopify', () => window.Shopify],
        ['webflow', () => window.Webflow],
        ['wix', () => window.wixDeveloperAnalytics],
        ['angular', () => window.angular || document.querySelector('[ng-version]')],
        ['gatsby', () => window.__GATSBY],
        ['remix', () => window.__remixContext],
        ['sentry', () => window.Sentry || window.Raven],
        ['facebookPixel', () => window.fbq],
        ['gtm', () => window.gtag || window.google_tag_manager],
        ['hotjar', () => window.hj || window._hjSettings],
        ['intercom', () => window.Intercom],
        ['drift', () => window.drift],
        ['zendesk', () => window.zE || window.zESettings],
        ['hubspot', () => window.HubSpotConversations || window._hsq],
        ['stripe', () => window.Stripe],
        ['klaviyo', () => window.klpiframe || document.querySelector('[class*="klaviyo"]')],
        ['svelte', () => window.__svelte_meta],
        ['react', () => window.React || document.querySelector('[data-reactroot]') || document.querySelector('#__next')],
        ['vue', () => window.__VUE__ || document.querySelector('[data-v-]')],
        ['akamai', () => window.Akamai || window.BOOMR],
        ['optimizely', () => window.optimizely],
        ['amplitude', () => window.amplitude],
        ['mixpanel', () => window.mixpanel],
        ['fullstory', () => window.FS || window._fs_namespace],
        ['datadog', () => window.DD_RUM],
        ['newrelic', () => window.newrelic || window.NREUM],
        ['logrocket', () => window.LogRocket],
        ['segment', () => window.analytics?.identify],
        ['clarity', () => window.clarity],
        ['tiktokPixel', () => window.ttq],
        ['pinterest', () => window.pintrk],
        ['linkedin', () => window._linkedin_data_partner_ids],
      ];
      for (const [key, check] of checks) {
        try { if (check()) jsGlobals[key] = true; } catch {}
      }

      // Capture performance resource URLs (all network requests the browser made)
      const networkUrls = performance.getEntriesByType('resource').map(e => e.name);

      return { html, scriptSrcs, metaMap, jsGlobals, networkUrls };
    },
  });

  return { ...result, cookies: '' };
}

async function fetchFresh(forceRefresh) {
  try {
    const apiBase = await resolveApiBase();
    const refreshParam = forceRefresh ? '&refresh=1' : '';
    const apiUrl = `${apiBase}/api/detect?url=${encodeURIComponent(currentUrl)}${refreshParam}`;

    // Try to capture real page data from the active tab
    // Skip for pages Chrome doesn't allow scripting (chrome://, chrome-extension://, Web Store)
    let pageData = null;
    const unscriptable = /^(chrome|chrome-extension|about|edge|brave):\/\/|chromewebstore\.google\.com/i;
    if (!unscriptable.test(currentUrl)) {
      try { pageData = await capturePageData(); } catch (e) {
        console.warn('[HarvinAI] Could not capture page data:', e.message);
      }
    }

    let res;
    if (pageData) {
      // POST rich page data — server skips re-fetching
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageData }),
      });
    } else {
      // Fallback to GET (e.g., chrome:// pages, permission denied)
      res = await fetch(apiUrl);
    }

    const text = await res.text();
    if (!text) throw new Error('Empty response from server');

    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Unexpected server response'); }
    if (!res.ok) throw new Error(data.error || 'Detection failed');

    lastResult = data;
    setCache(currentUrl, data);
    renderDetails(data);
    renderTechStack(data);
    // Show both panels (no tabs)
    document.getElementById('panel-details').classList.remove('hidden');
    document.getElementById('panel-tech').classList.remove('hidden');
    adjustPopupHeight();
  } catch (err) {
    // Only show error if nothing is displayed yet
    if (!lastResult || lastResult.url !== currentUrl) {
      errorText.textContent = err.message || 'Something went wrong';
      errorState.classList.remove('hidden');
    }
  } finally {
    loadingState.classList.add('hidden');
  }
}

// ── Render: Details (single panel, no tabs) ─────────────────────────────
function renderDetails(data) {
  const { technologies, companyMeta } = data;
  const grouped = groupByCategory(technologies);

  let html = '<div class="details-grid">';

  if (companyMeta) {
    // Non-D2C banner removed — every site shows a category & sub-category.
    const isNonD2C = false;
    if (isNonD2C) {
      const nonD2CReason = companyMeta.nonD2CReason
        || (companyMeta.category === 'Unknown' || !companyMeta.category
          ? 'Could not identify as a D2C brand — no consumer checkout or product catalog detected'
          : 'This company does not sell directly to consumers');
      html += `<div class="detail-card full" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">&#9888;</span>
          <div>
            <div style="font-weight:700;font-size:12px;color:#dc2626;">Non D2C Brand</div>
            <div style="font-size:10px;color:#92400e;margin-top:2px;">${esc(nonD2CReason)}</div>
          </div>
        </div>
      </div>`;

      // Still show App Presence and Traffic for Non-D2C
      const appPresence = companyMeta.appPresence || 'No App';
      const appBadgeClass = appPresence === 'No App' ? 'online-only' :
                            appPresence === 'Both iOS & Android' ? 'has-stores' : 'unknown';
      html += `<div class="detail-card"><div class="detail-label">App Presence</div><div class="detail-value"><span class="store-badge ${appBadgeClass}">${esc(appPresence)}</span></div></div>`;

      if (companyMeta.monthlyVisitsFormatted) {
        html += `<div class="detail-card"><div class="detail-label">Est. Traffic</div><div class="detail-value">${esc(companyMeta.monthlyVisitsFormatted)} <span class="mau-sub">visits/mo</span></div></div>`;
      }

      if (companyMeta.region) {
        html += `<div class="detail-card"><div class="detail-label">Region</div><div class="detail-value">${esc(companyMeta.region)}</div></div>`;
      }
    } else {
      // Normal D2C brand — show full details
      // Category
      html += `<div class="detail-card"><div class="detail-label">Category</div><div class="detail-value">${esc(companyMeta.category)}</div></div>`;

      // Sub-category
      html += `<div class="detail-card"><div class="detail-label">Sub-Category</div><div class="detail-value">${esc(companyMeta.subCategory || 'General')}</div></div>`;

      // Region
      html += `<div class="detail-card"><div class="detail-label">Region</div><div class="detail-value">${esc(companyMeta.region)}</div></div>`;

      // Store count
      const stores = companyMeta.offlineStores || 'Unknown';
      const rawCount = companyMeta.storeRawCount || 0;
      const storeDisplay = (stores !== 'Online' && stores !== 'Unknown' && rawCount > 0) ? `${rawCount} stores` : stores;
      const badgeClass = stores === 'Online' ? 'online-only' :
                         stores === 'Unknown' ? 'unknown' : 'has-stores';
      html += `<div class="detail-card"><div class="detail-label">Offline Stores</div><div class="detail-value"><span class="store-badge ${badgeClass}">${esc(storeDisplay)}</span></div></div>`;

      // Business Model — derive from stores if not set
      let bizModel = companyMeta.businessModel;
      if (!bizModel) {
        // Don't assign D2C labels to non-D2C categories (hospitality, services, etc.)
        const NON_D2C_CATS = ['Restaurant & Hospitality', 'Travel & Ticketing', 'Professional Services', 'Media & Entertainment', 'News & Media', 'Government & Public Sector', 'NGO & Non-Profit', 'Wellness Tourism & Retreats', 'Not Required'];
        const cat = companyMeta.category || '';
        if (NON_D2C_CATS.some(c => cat.includes(c))) {
          bizModel = null; // Don't show business model for non-D2C
        } else {
          const stores2 = companyMeta.offlineStores || 'Unknown';
          bizModel = (stores2 !== 'Online' && stores2 !== 'Unknown') ? 'Omnichannel' : 'Pure D2C';
        }
      }
      if (bizModel) {
        const bizColor = bizModel === 'Pure D2C' ? 'online-only' :
                         bizModel === 'Omnichannel' ? 'has-stores' :
                         bizModel === 'D2C + Marketplace' ? 'unknown' : 'unknown';
        html += `<div class="detail-card"><div class="detail-label">Business Model</div><div class="detail-value"><span class="store-badge ${bizColor}">${esc(bizModel)}</span></div></div>`;
      }

      // App Presence
      const appPresence = companyMeta.appPresence || 'No App';
      const appBadgeClass = appPresence === 'No App' ? 'online-only' :
                            appPresence === 'Both iOS & Android' ? 'has-stores' : 'unknown';
      html += `<div class="detail-card"><div class="detail-label">App Presence</div><div class="detail-value"><span class="store-badge ${appBadgeClass}">${esc(appPresence)}</span></div></div>`;

      // MAU / Estimated Traffic
      if (companyMeta.monthlyVisitsFormatted) {
        html += `<div class="detail-card"><div class="detail-label">Est. Traffic</div><div class="detail-value">${esc(companyMeta.monthlyVisitsFormatted)} <span class="mau-sub">visits/mo</span></div></div>`;
      }
    }
  }

  html += '</div>';
  detailsContent.innerHTML = html;
}

// ── Render: Tech Stack ──────────────────────────────────────────────────
function renderTechStack(data) {
  // Filter out removed techs
  const technologies = (data.technologies || []).filter(t => t.changeTag !== 'removed');

  const grouped = groupByCategory(technologies);
  const catCount = Object.keys(grouped).length;

  techSummary.innerHTML = `<span class="count">${technologies.length}</span> technologies detected across <span class="count">${catCount}</span> categories`;

  categoriesEl.innerHTML = '';
  const sortedCats = sortCategories(grouped);

  // Build category blocks, then distribute into two balanced columns
  const catBlocks = sortedCats.map((catName) => {
    const techs = grouped[catName];
    const color = CATEGORY_COLORS[catName.toLowerCase()] || '#6b7280';

    let blockHtml = `<div class="category">`;
    blockHtml += `<div class="category-header"><span class="category-name">${esc(catName)}</span></div>`;
    blockHtml += `<div class="category-techs">`;

    techs.forEach((t) => {
      // Skip removed techs — don't show in extension
      if (t.changeTag === 'removed') return;
      const iconUrl = getIconUrl(t.name);
      const techColor = t.color || color;
      const versionHtml = t.version ? `<span class="tech-version">${esc(t.version)}</span>` : '';

      const letter = (t.name.charAt(0) || '?').toUpperCase();
      if (iconUrl) {
        // Error fallback is wired up in JS (attachIconFallbacks) because MV3's
        // default CSP blocks inline onerror handlers.
        blockHtml += `
          <div class="tech-row">
            <span class="tech-icon"><img class="tech-fav" src="${esc(iconUrl)}" alt="" loading="lazy" data-name="${esc(t.name)}" data-color="${esc(techColor)}" data-letter="${esc(letter)}" /></span>
            <span class="tech-info"><span class="tech-name">${esc(t.name)}</span>${versionHtml}</span>
          </div>`;
      } else {
        blockHtml += `
          <div class="tech-row">
            <span class="tech-icon-letter" style="background:${techColor}">${letter}</span>
            <span class="tech-info"><span class="tech-name">${esc(t.name)}</span>${versionHtml}</span>
          </div>`;
      }
    });

    blockHtml += `</div></div>`;
    // Weight = header (1) + tech items count
    return { html: blockHtml, weight: 1 + techs.length };
  });

  // Distribute into two columns, balancing total weight
  const col1 = [];
  const col2 = [];
  let w1 = 0, w2 = 0;
  for (const block of catBlocks) {
    if (w1 <= w2) {
      col1.push(block.html);
      w1 += block.weight;
    } else {
      col2.push(block.html);
      w2 += block.weight;
    }
  }

  categoriesEl.innerHTML = `
    <div class="categories-col">${col1.join('')}</div>
    <div class="categories-col">${col2.join('')}</div>
  `;
  attachIconFallbacks(categoriesEl);
}

// Attach CSP-safe error fallbacks (MV3 blocks inline onerror handlers).
// icon.horse returns 200 even for unknown domains, so this only fires on a real
// network/rate-limit failure — in which case we swap in a colored letter tile
// so a row is never left showing a broken image.
function attachIconFallbacks(root) {
  root.querySelectorAll('img.tech-fav').forEach((img) => {
    img.addEventListener('error', () => {
      const span = document.createElement('span');
      span.className = 'tech-icon-letter';
      span.style.background = img.dataset.color || '#6b7280';
      span.textContent = img.dataset.letter || (img.dataset.name || '?').charAt(0).toUpperCase();
      (img.closest('.tech-icon') || img).replaceWith(span);
    }, { once: true });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────
// Derive a compact slug from a tech name for domain guessing.
function techSlug(name) {
  return name.toLowerCase()
    .replace(/\s+(pg|pixel|tag|sdk|retargeting|ads|checkout|payments|switch|engage)$/i, '')
    .replace(/\.js$/i, '')
    .replace(/[^a-z0-9]+/g, '');
}

// Always returns an icon URL (never null for a normal name). Mapped techs
// resolve to their real logo; unmapped techs fall back to a domain guess via
// icon.horse, which serves a clean generated tile (HTTP 200, never a 404) when
// the guess doesn't resolve — so every tech renders *something*, never a blank.
function getIconUrl(techName) {
  const val = ICON_DOMAINS[techName.toLowerCase()];
  if (val) {
    return val.startsWith('http') ? val : `https://icon.horse/icon/${val}`;
  }
  const slug = techSlug(techName);
  if (slug.length >= 2) return `https://icon.horse/icon/${slug}.com`;
  return null; // extremely short/odd name — caller renders a letter tile
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
