const PRIORITY_CATALOG = require('./priority-catalog.json');

const TECH = [
  {
    name: 'Shopify', category: 'Ecommerce Platform', color: '#96BF48',
    detect: {
      headers: [{ field: 'x-shopid', rx: /./ }, { field: 'x-shopify-stage', rx: /./ }],
      html:    [/Shopify\.theme\b/i, /Shopify\.shop\b/i, /cdn\.shopify\.com/i, /shopify-section/i],
      scripts: [/cdn\.shopify\.com\/s\/files/i],
    },
  },
  {
    name: 'WooCommerce', category: 'Ecommerce Platform', color: '#7F54B3',
    detect: {
      html:    [/woocommerce/i, /wc-cart/i, /wc-api/i],
      scripts: [/woocommerce\.min\.js/i, /wc\.js/i],
    },
  },
  {
    name: 'BigCommerce', category: 'Ecommerce Platform', color: '#34313F',
    detect: {
      headers: [{ field: 'x-bc-appserver', rx: /./ }],
      html:    [/cdn\d+\.bigcommerce\.com/i, /bcapp/i, /bigcommerce/i],
      scripts: [/bigcommerce\.com/i],
    },
  },
  {
    name: 'Magento', category: 'Ecommerce Platform', color: '#F46F25',
    detect: {
      html:    [/Mage\.Cookies\b/i, /\/mage\//i, /requirejs\/require\.js/i],
      scripts: [/\/js\/mage\//i, /mage\/bootstrap/i],
      meta:    [{ name: 'generator', rx: /magento/i }],
    },
  },
  {
    name: 'PrestaShop', category: 'Ecommerce Platform', color: '#DF0067',
    detect: {
      meta:    [{ name: 'generator', rx: /prestashop/i }],
      html:    [/prestashop/i, /var prestashop/i],
    },
  },
  {
    name: 'Wix', category: 'Ecommerce Platform', color: '#FAAD00',
    detect: {
      html:    [/X\.pageId/i, /wixsite\.com/i, /wixstatic\.com/i],
      scripts: [/static\.parastorage\.com/i, /wix\.com/i],
    },
  },
  {
    name: 'Squarespace', category: 'Ecommerce Platform', color: '#222222',
    detect: {
      html:    [/squarespace\.com/i, /squarespace-cdn\.com/i, /static\.squarespace\.com/i],
      meta:    [{ name: 'generator', rx: /squarespace/i }],
    },
  },

  {
    name: 'Salesforce Commerce Cloud', category: 'Ecommerce Platform', color: '#00A1E0',
    detect: {
      html:    [/demandware\.static/i, /demandware\.store/i, /demandware\.net/i, /dw\/image\/v2/i],
      scripts: [/demandware\.static/i],
      headers: [{ field: 'server', rx: /demandware/i }],
    },
  },
  {
    name: 'SAP Commerce Cloud', category: 'Ecommerce Platform', color: '#0070F2',
    detect: {
      html:    [/hybris/i, /SAP Commerce/i, /_ui\/addons/i],
      scripts: [/hybris/i],
    },
  },
  {
    name: 'OpenCart', category: 'Ecommerce Platform', color: '#34B5E4',
    detect: {
      html:    [/route=common\/home/i, /route=product\//i, /catalog\/view\/theme/i],
      scripts: [/catalog\/view\/javascript/i],
      meta:    [{ name: 'generator', rx: /opencart/i }],
    },
  },
  {
    name: 'VTEX', category: 'Ecommerce Platform', color: '#F71963',
    detect: {
      html:    [/vtex\.com/i, /vteximg\.com\.br/i, /vtexcommercestable/i],
      scripts: [/vtex\.com/i, /vteximg\.com\.br/i],
      headers: [{ field: 'x-vtex-janus-router-backend-app', rx: /./ }, { field: 'powered-by', rx: /vtex/i }],
    },
  },
  {
    name: 'Ecwid', category: 'Ecommerce Platform', color: '#0067D5',
    detect: {
      scripts: [/app\.ecwid\.com/i, /d3fi9i0jj23cau\.cloudfront\.net/i],
      html:    [/ecwid/i, /ecwid-ProductBrowser/i],
    },
  },
  {
    name: 'Commercetools', category: 'Ecommerce Platform', color: '#213C53',
    detect: {
      html:    [/commercetools/i],
      scripts: [/commercetools/i],
    },
  },
  {
    name: 'Shopware', category: 'Ecommerce Platform', color: '#189EFF',
    detect: {
      html:    [/shopware/i, /shopware-section/i],
      scripts: [/shopware/i],
      meta:    [{ name: 'generator', rx: /shopware/i }],
    },
  },
  {
    name: 'Dukaan', category: 'Ecommerce Platform', color: '#146EB4',
    detect: {
      scripts: [/mydukaan\.io/i, /dukaan\.io/i],
      html:    [/mydukaan\.io/i, /dukaan/i],
    },
  },
  {
    name: 'Shopline', category: 'Ecommerce Platform', color: '#FF6B35',
    detect: {
      scripts: [/shoplineapp\.com/i, /myshopline\.com/i],
      html:    [/shoplineapp\.com/i, /shopline/i],
    },
  },
  {
    name: 'Nuvemshop', category: 'Ecommerce Platform', color: '#2D0060',
    detect: {
      scripts: [/nuvemshop\.com\.br/i, /tiendanube\.com/i],
      html:    [/nuvemshop/i, /tiendanube/i],
    },
  },
  {
    name: 'Volusion', category: 'Ecommerce Platform', color: '#F90',
    detect: {
      html:    [/volusion/i, /\/a\/vs/i],
      scripts: [/volusion\.com/i],
    },
  },
  {
    name: 'Shift4Shop', category: 'Ecommerce Platform', color: '#0054A6',
    detect: {
      html:    [/3dcart/i, /shift4shop/i],
      scripts: [/3dcart\.com/i, /shift4shop\.com/i],
    },
  },
  {
    name: 'Weebly', category: 'Ecommerce Platform', color: '#2C567E',
    detect: {
      scripts: [/cdn\d\.editmysite\.com/i, /weebly\.com/i],
      html:    [/weebly/i, /editmysite\.com/i],
    },
  },
  {
    name: 'Zen Cart', category: 'Ecommerce Platform', color: '#8B4513',
    detect: {
      html:    [/zen-cart/i, /zencart/i],
      meta:    [{ name: 'generator', rx: /zen.?cart/i }],
    },
  },
  {
    name: 'nopCommerce', category: 'Ecommerce Platform', color: '#204187',
    detect: {
      html:    [/nopcommerce/i, /nopCommerce/i],
      meta:    [{ name: 'generator', rx: /nopcommerce/i }],
    },
  },
  {
    name: 'Medusa', category: 'Ecommerce Platform', color: '#56B4BB',
    detect: {
      html:    [/medusajs\.com/i, /medusa-container/i],
      scripts: [/medusajs/i],
    },
  },
  {
    name: 'Bagisto', category: 'Ecommerce Platform', color: '#0041FF',
    detect: {
      html:    [/bagisto/i],
      meta:    [{ name: 'generator', rx: /bagisto/i }],
    },
  },
  {
    name: 'CS-Cart', category: 'Ecommerce Platform', color: '#333333',
    detect: {
      html:    [/cs-cart/i, /cscart/i],
      meta:    [{ name: 'generator', rx: /cs.?cart/i }],
    },
  },
  {
    name: 'Fynd', category: 'Ecommerce Platform', color: '#6C3CE1',
    detect: {
      scripts: [/cdn\.fynd\.com/i, /platform\.fynd\.com/i],
      html:    [/fynd\.com/i, /fyndplatform/i],
    },
  },

  {
    name: 'WordPress', category: 'CMS', color: '#21759B',
    detect: {
      html:    [/wp-content/i, /wp-includes/i],
      scripts: [/wp-content\/themes/i, /wp-includes\/js/i],
      meta:    [{ name: 'generator', rx: /wordpress/i }],
    },
  },
  {
    name: 'Drupal', category: 'CMS', color: '#0678BE',
    detect: {
      meta:    [{ name: 'generator', rx: /drupal/i }],
      html:    [/drupal\.js/i, /drupal-settings-json/i],
      headers: [{ field: 'x-generator', rx: /drupal/i }],
    },
  },
  {
    name: 'Ghost', category: 'CMS', color: '#738A94',
    detect: {
      meta:    [{ name: 'generator', rx: /ghost/i }],
      html:    [/ghost\.io/i, /ghost-url/i],
    },
  },
  {
    name: 'Contentful', category: 'CMS', color: '#2478CC',
    detect: {
      html:    [/ctfassets\.net/i],
    },
  },
  {
    name: 'Joomla', category: 'CMS', color: '#5091CD',
    detect: {
      meta:    [{ name: 'generator', rx: /joomla/i }],
      html:    [/\/media\/jui\/js\//i, /joomla/i],
      scripts: [/media\/jui\/js/i],
    },
  },
  {
    name: 'Wix', category: 'CMS', color: '#FAAD00',
    detect: {
      html:    [/X\.pageId/i, /wixsite\.com/i, /wixstatic\.com/i],
      scripts: [/static\.parastorage\.com/i, /wix\.com/i],
    },
  },
  {
    name: 'Squarespace', category: 'CMS', color: '#222222',
    detect: {
      html:    [/squarespace\.com/i, /squarespace-cdn\.com/i],
      meta:    [{ name: 'generator', rx: /squarespace/i }],
    },
  },
  {
    name: 'Webflow', category: 'CMS', color: '#4353FF',
    detect: {
      html:    [/webflow\.com/i, /assets\.website-files\.com/i, /w-nav\b/i],
      meta:    [{ name: 'generator', rx: /webflow/i }],
    },
  },
  {
    name: 'Strapi', category: 'CMS', color: '#4945FF',
    detect: {
      html:    [/strapi/i],
      scripts: [/strapi/i],
    },
  },
  {
    name: 'Sanity', category: 'CMS', color: '#F03E2F',
    detect: {
      html:    [/cdn\.sanity\.io/i, /sanity\.io/i],
      scripts: [/cdn\.sanity\.io/i],
    },
  },
  {
    name: 'Prismic', category: 'CMS', color: '#5163BA',
    detect: {
      html:    [/prismic\.io/i, /cdn\.prismic\.io/i],
      scripts: [/prismic\.io/i],
    },
  },
  {
    name: 'Storyblok', category: 'CMS', color: '#09B3AF',
    detect: {
      html:    [/storyblok/i, /a\.storyblok\.com/i],
      scripts: [/storyblok/i],
    },
  },
  {
    name: 'Sitecore', category: 'CMS', color: '#EB1F1F',
    detect: {
      html:    [/sitecore/i, /\/sitecore\//i],
      meta:    [{ name: 'generator', rx: /sitecore/i }],
    },
  },
  {
    name: 'Adobe Experience Manager', category: 'CMS', color: '#FF0000',
    detect: {
      html:    [/\/etc\.clientlibs\//i, /\/content\/dam\//i, /cq-component/i],
      scripts: [/clientlibs/i],
    },
  },
  {
    name: 'TYPO3', category: 'CMS', color: '#FF8700',
    detect: {
      meta:    [{ name: 'generator', rx: /typo3/i }],
      html:    [/typo3/i, /typo3temp/i],
    },
  },
  {
    name: 'Umbraco', category: 'CMS', color: '#3544B1',
    detect: {
      meta:    [{ name: 'generator', rx: /umbraco/i }],
      html:    [/umbraco/i],
    },
  },
  {
    name: 'Kentico', category: 'CMS', color: '#F05A22',
    detect: {
      meta:    [{ name: 'generator', rx: /kentico/i }],
      html:    [/kentico/i, /CMSPages/i],
    },
  },
  {
    name: 'Hugo', category: 'CMS', color: '#FF4088',
    detect: {
      meta:    [{ name: 'generator', rx: /hugo/i }],
      html:    [/hugo-/i],
    },
  },
  {
    name: 'Jekyll', category: 'CMS', color: '#CC0000',
    detect: {
      meta:    [{ name: 'generator', rx: /jekyll/i }],
      html:    [/jekyll/i],
    },
  },
  {
    name: 'Blogger', category: 'CMS', color: '#FF6600',
    detect: {
      html:    [/blogger\.com/i, /blogspot\.com/i, /blogger\.googleusercontent/i],
      meta:    [{ name: 'generator', rx: /blogger/i }],
    },
  },
  {
    name: 'Tilda', category: 'CMS', color: '#000000',
    detect: {
      html:    [/tilda\.cc/i, /tildacdn\.com/i],
      scripts: [/tilda\.cc/i, /tildacdn\.com/i],
    },
  },
  {
    name: 'Tumblr', category: 'CMS', color: '#36465D',
    detect: {
      html:    [/tumblr\.com/i, /assets\.tumblr\.com/i],
      scripts: [/assets\.tumblr\.com/i],
    },
  },
  {
    name: 'Medium', category: 'CMS', color: '#000000',
    detect: {
      html:    [/medium\.com/i, /cdn-client\.medium\.com/i],
      meta:    [{ name: 'generator', rx: /medium/i }],
    },
  },
  {
    name: 'Hexo', category: 'CMS', color: '#0E83CD',
    detect: {
      meta:    [{ name: 'generator', rx: /hexo/i }],
      html:    [/hexo/i],
    },
  },
  {
    name: 'Craft CMS', category: 'CMS', color: '#E5422B',
    detect: {
      meta:    [{ name: 'generator', rx: /craft\s?cms/i }],
      html:    [/craftcms/i],
    },
  },
  {
    name: 'Duda', category: 'CMS', color: '#3A58EE',
    detect: {
      html:    [/duda\.co/i, /multiscreensite\.com/i],
      scripts: [/duda\.co/i, /multiscreensite\.com/i],
    },
  },
  {
    name: 'Jimdo', category: 'CMS', color: '#333333',
    detect: {
      html:    [/jimdo\.com/i, /jimstatic\.com/i],
      scripts: [/jimdo\.com/i],
    },
  },
  {
    name: 'Strikingly', category: 'CMS', color: '#2CB5E2',
    detect: {
      html:    [/strikingly\.com/i, /s\.strikinglydns\.com/i],
      scripts: [/strikingly\.com/i],
    },
  },
  {
    name: 'Weebly', category: 'CMS', color: '#2C567E',
    detect: {
      scripts: [/cdn\d\.editmysite\.com/i, /weebly\.com/i],
      html:    [/weebly/i, /editmysite\.com/i],
    },
  },
  {
    name: 'Notion', category: 'CMS', color: '#000000',
    detect: {
      html:    [/notion\.site/i, /notion\.so/i],
    },
  },
  {
    name: 'Wagtail', category: 'CMS', color: '#43B1B0',
    detect: {
      html:    [/wagtail/i],
      meta:    [{ name: 'generator', rx: /wagtail/i }],
    },
  },
  {
    name: 'Liferay', category: 'CMS', color: '#0B5FFF',
    detect: {
      html:    [/liferay/i, /Liferay-Portal/i],
      headers: [{ field: 'liferay-portal', rx: /./ }],
    },
  },
  {
    name: 'Pimcore', category: 'CMS', color: '#6428B4',
    detect: {
      html:    [/pimcore/i],
      meta:    [{ name: 'generator', rx: /pimcore/i }],
    },
  },
  {
    name: 'October CMS', category: 'CMS', color: '#DB6A26',
    detect: {
      meta:    [{ name: 'generator', rx: /october/i }],
      html:    [/octobercms/i],
    },
  },
  {
    name: 'Statamic', category: 'CMS', color: '#FF269E',
    detect: {
      meta:    [{ name: 'generator', rx: /statamic/i }],
    },
  },
  {
    name: 'KeystoneJS', category: 'CMS', color: '#166BFF',
    detect: {
      html:    [/keystonejs/i],
      scripts: [/keystonejs/i],
    },
  },
  {
    name: 'DatoCMS', category: 'CMS', color: '#FF7751',
    detect: {
      html:    [/datocms/i, /www\.datocms-assets\.com/i],
    },
  },
  {
    name: 'Directus', category: 'CMS', color: '#6644FF',
    detect: {
      html:    [/directus/i],
      scripts: [/directus/i],
    },
  },
  {
    name: 'Grav', category: 'CMS', color: '#FFFFFF',
    detect: {
      meta:    [{ name: 'generator', rx: /grav/i }],
      html:    [/grav-/i],
    },
  },
  {
    name: 'Plone', category: 'CMS', color: '#007BB1',
    detect: {
      meta:    [{ name: 'generator', rx: /plone/i }],
      html:    [/plone/i, /portal_css/i],
    },
  },
  {
    name: 'SilverStripe', category: 'CMS', color: '#005AE1',
    detect: {
      meta:    [{ name: 'generator', rx: /silverstripe/i }],
      html:    [/silverstripe/i],
    },
  },
  {
    name: 'Concrete CMS', category: 'CMS', color: '#00ADEE',
    detect: {
      meta:    [{ name: 'generator', rx: /concrete/i }],
      html:    [/concrete5/i, /ccm-/i],
    },
  },
  {
    name: 'ProcessWire', category: 'CMS', color: '#3B71A1',
    detect: {
      meta:    [{ name: 'generator', rx: /processwire/i }],
    },
  },
  {
    name: 'Contao', category: 'CMS', color: '#F47C00',
    detect: {
      meta:    [{ name: 'generator', rx: /contao/i }],
      html:    [/contao/i],
    },
  },
  {
    name: 'Odoo', category: 'CMS', color: '#714B67',
    detect: {
      html:    [/odoo/i, /\/web\/static\//i],
      meta:    [{ name: 'generator', rx: /odoo/i }],
    },
  },
  {
    name: 'Bloomreach', category: 'CMS', color: '#002840',
    detect: {
      html:    [/bloomreach/i, /brxm/i],
    },
  },
  {
    name: 'Magnolia', category: 'CMS', color: '#EF7C00',
    detect: {
      html:    [/magnolia/i, /magnoliaPublic/i],
    },
  },
  {
    name: 'HubSpot CMS Hub', category: 'CMS', color: '#FF7A59',
    detect: {
      html:    [/hs-scripts\.com/i, /hubspot\.net/i],
      scripts: [/js\.hs-scripts\.com/i],
    },
  },
  {
    name: 'Google Sites', category: 'CMS', color: '#4285F4',
    detect: {
      html:    [/sites\.google\.com/i],
    },
  },

  {
    name: 'Google Analytics', category: 'Analytics & Behavior', color: '#E8710A',
    detect: {
      html:    [/UA-\d{4,}-\d+/i, /G-[A-Z0-9]{8,}/i, /gtag\(["']config/i],
      scripts: [/google-analytics\.com\/analytics\.js/i, /googletagmanager\.com\/gtag\/js/i],
    },
  },
  {
    name: 'Google Tag Manager', category: 'Tag Manager', color: '#4285F4',
    detect: {
      html:    [/GTM-[A-Z0-9]+/i, /googletagmanager\.com\/gtm\.js/i],
      scripts: [/googletagmanager\.com\/gtm\.js/i],
    },
  },
  {
    name: 'Facebook Pixel', category: 'Analytics & Optimization Platform', color: '#1877F2',
    detect: {
      scripts: [/connect\.facebook\.net\/.*\/fbevents\.js/i, /connect\.facebook\.net\/signals/i],
      html:    [/fbq\s*\(\s*['"]init['"]/i, /fbq\s*\(\s*['"]track['"]/i, /_fbq\b/i, /facebook\.com\/tr\?/i, /fbevents\.js/i, /fbpixel/i],
    },
  },
  {
    name: 'Microsoft Clarity', category: 'Analytics & Optimization Platform', color: '#0078D4',
    detect: {
      scripts: [/clarity\.ms\/tag\//i, /clarity\.ms\/s\//i, /clarity\.ms\/eus2-b\/sc/i],
      html:    [/clarity\.ms\/tag\//i, /window\.clarity\b/i, /clarity\s*\(\s*["']set["']/i],
    },
  },
  {
    name: 'LinkedIn Insight Tag', category: 'Analytics & Optimization Platform', color: '#0A66C2',
    detect: {
      scripts: [/snap\.licdn\.com\/li\.lms-analytics\/insight\.min\.js/i, /snap\.licdn\.com/i],
      html:    [/_linkedin_partner_id\b/i, /_linkedin_data_partner_ids\b/i, /linkedin\.com\/px/i, /snap\.licdn\.com/i],
    },
  },
  {
    name: 'Pinterest Tag', category: 'Analytics & Optimization Platform', color: '#E60023',
    detect: {
      scripts: [/s\.pinimg\.com\/ct\/core\.js/i, /pintrk\.js/i],
      html:    [/pintrk\s*\(/i, /pinterest\.com\/ct\.html/i, /s\.pinimg\.com\/ct\//i],
    },
  },
  {
    name: 'TikTok Pixel', category: 'Analytics & Optimization Platform', color: '#000000',
    detect: {
      scripts: [/analytics\.tiktok\.com/i, /tiktok\.com\/i18n\/pixel/i],
      html:    [/ttq\.load\b/i, /ttq\.track\b/i, /tiktok\.com\/i18n\/pixel/i, /analytics\.tiktok\.com/i],
    },
  },
  {
    name: 'Snapchat Pixel', category: 'Analytics & Optimization Platform', color: '#FFFC00',
    detect: {
      scripts: [/sc-static\.net\/scevent\.min\.js/i, /sc-static\.net\/scevent/i],
      html:    [/snaptr\s*\(/i, /sc-static\.net\/scevent/i],
    },
  },
  {
    name: 'Twitter Pixel', category: 'Analytics & Optimization Platform', color: '#1DA1F2',
    detect: {
      scripts: [/static\.ads-twitter\.com\/uwt\.js/i, /ads-twitter\.com/i],
      html:    [/twq\s*\(/i, /static\.ads-twitter\.com/i, /ads-twitter\.com\/uwt/i],
    },
  },
  {
    name: 'Reddit Pixel', category: 'Analytics & Optimization Platform', color: '#FF5700',
    detect: {
      scripts: [/alb\.reddit\.com\/snooze/i, /www\.redditstatic\.com\/ads/i],
      html:    [/rdt\s*\(/i, /alb\.reddit\.com/i, /redditstatic\.com\/ads/i],
    },
  },
  {
    name: 'Quora Pixel', category: 'Analytics & Optimization Platform', color: '#B92B27',
    detect: {
      scripts: [/a\.quora\.com\/qevt/i],
      html:    [/qp\s*\(\s*['"]init['"]/i, /a\.quora\.com\/qevt/i, /quorapixel/i],
    },
  },
  {
    name: 'Mixpanel', category: 'Analytics & Behavior', color: '#7856FF',
    detect: {
      scripts: [/cdn\.mxpnl\.com/i, /cdn\.mixpanel\.com/i],
      html:    [/mixpanel\.init\b/i, /mixpanel\.track\b/i],
    },
  },
  {
    name: 'Segment', category: 'Analytics & Behavior', color: '#52BD94',
    detect: {
      scripts: [/cdn\.segment\.com/i, /cdn\.segment\.io/i],
      html:    [/analytics\.load\(/i, /analytics\.identify\(/i],
    },
  },
  {
    name: 'Hotjar', category: 'Analytics & Behavior', color: '#FF3C00',
    detect: {
      scripts: [/static\.hotjar\.com/i, /vars\.hotjar\.com/i],
      html:    [/hjSiteSettings\b/i, /hjid\b/i],
    },
  },
  {
    name: 'Amplitude', category: 'Analytics & Behavior', color: '#1963FF',
    detect: {
      scripts: [/cdn\.amplitude\.com/i],
      html:    [/amplitude\.getInstance\(\)/i, /amplitude\.init\b/i],
    },
  },
  {
    name: 'Heap', category: 'Analytics & Behavior', color: '#5A26F5',
    detect: {
      scripts: [/cdn\.heapanalytics\.com/i],
      html:    [/heap\.load\b/i, /heapanalytics\.com/i],
    },
  },
  {
    name: 'PostHog', category: 'Analytics & Optimization Platform', color: '#F9BD2B',
    detect: {
      scripts: [/app\.posthog\.com/i, /us\.posthog\.com/i, /eu\.posthog\.com/i],
      html:    [/posthog\.init\b/i, /posthog\.capture\b/i, /app\.posthog\.com/i],
    },
  },
  {
    name: 'VWO', category: 'Analytics & Optimization Platform', color: '#4A90D9',
    detect: {
      scripts: [/dev\.visualwebsiteoptimizer\.com/i, /vwo\.com\/lib\//i],
      html:    [/vwo_\$/i, /visualwebsiteoptimizer\.com/i, /VWO\s*=/i, /_vis_opt_/i, /vwoCode\b/i],
    },
  },
  {
    name: 'Optimizely', category: 'Analytics & Optimization Platform', color: '#0037FF',
    detect: {
      scripts: [/cdn\.optimizely\.com/i, /optimizely\.com\/js\//i],
      html:    [/optimizely/i, /window\.optimizely/i],
    },
  },
  {
    name: 'Crazy Egg', category: 'Analytics & Optimization Platform', color: '#FE6601',
    detect: {
      scripts: [/script\.crazyegg\.com/i],
      html:    [/crazyegg\.com/i, /ceic\b/i],
    },
  },
  {
    name: 'Mouseflow', category: 'Analytics & Optimization Platform', color: '#FF6B35',
    detect: {
      scripts: [/cdn\.mouseflow\.com/i, /o\.mouseflow\.com/i],
      html:    [/mouseflow\.com\/projects/i, /window\._mfq\b/i],
    },
  },
  {
    name: 'Lucky Orange', category: 'Analytics & Optimization Platform', color: '#FF7A00',
    detect: {
      scripts: [/d10lpsik1i8c69\.cloudfront\.net/i, /luckyorange\.com/i],
      html:    [/luckyorange/i, /__lo_cs_added/i],
    },
  },
  {
    name: 'FullStory', category: 'Analytics & Optimization Platform', color: '#462B9C',
    detect: {
      scripts: [/fullstory\.com\/s\/fs\.js/i, /edge\.fullstory\.com/i, /rs\.fullstory\.com/i],
      html:    [/FS\.identify\b/i, /fullstory\.com\/s\//i, /window\._fs_/i],
    },
  },
  {
    name: 'LogRocket', category: 'Analytics & Optimization Platform', color: '#764ABC',
    detect: {
      scripts: [/cdn\.logrocket\.io/i, /cdn\.lr-ingest\.io/i, /cdn\.lr-in\.com/i],
      html:    [/LogRocket\.init\b/i, /logrocket/i],
    },
  },
  {
    name: 'Smartlook', category: 'Analytics & Optimization Platform', color: '#FFD43A',
    detect: {
      scripts: [/web-sdk\.smartlook\.com/i, /rec\.smartlook\.com/i],
      html:    [/smartlook/i, /window\.smartlook\b/i],
    },
  },
  {
    name: 'Contentsquare', category: 'Analytics & Optimization Platform', color: '#6B3FA0',
    detect: {
      scripts: [/t\.contentsquare\.net/i, /contentsquare\.com/i],
      html:    [/contentsquare/i, /_uxa\.push\b/i],
    },
  },
  {
    name: 'Dynamic Yield', category: 'Analytics & Optimization Platform', color: '#6236FF',
    detect: {
      scripts: [/cdn\.dynamicyield\.com/i, /st\.dynamicyield\.com/i],
      html:    [/DY\.recommendationContext\b/i, /dynamicyield\.com/i, /window\.DY\b/i],
    },
  },
  {
    name: 'AB Tasty', category: 'Analytics & Optimization Platform', color: '#1C1C4A',
    detect: {
      scripts: [/try\.abtasty\.com/i, /abtasty\.com/i],
      html:    [/abtasty/i, /ABTasty\b/i],
    },
  },
  {
    name: 'Unbounce', category: 'Analytics & Optimization Platform', color: '#2C44E3',
    detect: {
      scripts: [/ubembed\.com/i, /unbouncepages\.com/i],
      html:    [/unbounce/i, /ubembed\.com/i],
    },
  },
  {
    name: 'Matomo', category: 'Analytics & Optimization Platform', color: '#3152A0',
    detect: {
      scripts: [/matomo\.js/i, /matomo\.php/i, /piwik\.js/i, /piwik\.php/i],
      html:    [/_paq\.push\b/i, /matomo\.js/i, /piwik\.js/i],
    },
  },
  {
    name: 'Plausible Analytics', category: 'Analytics & Optimization Platform', color: '#5850EC',
    detect: {
      scripts: [/plausible\.io\/js\//i, /plausible\.io\/api/i],
      html:    [/plausible\.io/i],
    },
  },
  {
    name: 'Inspectlet', category: 'Analytics & Optimization Platform', color: '#2C3E50',
    detect: {
      scripts: [/cdn\.inspectlet\.com/i],
      html:    [/inspectlet/i, /__insp\b/i],
    },
  },
  {
    name: 'Quantum Metric', category: 'Analytics & Optimization Platform', color: '#FF4B38',
    detect: {
      scripts: [/cdn\.quantummetric\.com/i],
      html:    [/quantummetric/i, /QuantumMetricAPI/i],
    },
  },
  {
    name: 'Glassbox', category: 'Analytics & Optimization Platform', color: '#00BFFF',
    detect: {
      scripts: [/cdn\.glassboxdigital\.io/i, /glassboxcdn\.com/i],
      html:    [/glassbox/i, /_detector\.glassbox/i],
    },
  },
  {
    name: 'AppsFlyer', category: 'Analytics & Optimization Platform', color: '#00C853',
    detect: {
      scripts: [/onelinksmartscript\.appsflyer\.com/i, /cdn\.appsflyer\.com/i],
      html:    [/appsflyer/i, /AF_SMART_SCRIPT/i],
    },
  },
  {
    name: 'Adjust', category: 'Analytics & Optimization Platform', color: '#0E1C32',
    detect: {
      scripts: [/cdn\.adjust\.com/i, /app\.adjust\.com/i],
      html:    [/adjust\.com\/sdk/i],
    },
  },
  {
    name: 'Branch', category: 'Analytics & Optimization Platform', color: '#0B73B5',
    detect: {
      scripts: [/cdn\.branch\.io/i, /app\.link/i],
      html:    [/branch\.init\b/i, /cdn\.branch\.io/i],
    },
  },
  {
    name: 'Kameleoon', category: 'Analytics & Optimization Platform', color: '#FF5722',
    detect: {
      scripts: [/static\.kameleoon\.com/i, /kameleoon\.eu/i],
      html:    [/kameleoon/i, /Kameleoon\b/i],
    },
  },
  {
    name: 'SiteSpect', category: 'Analytics & Optimization Platform', color: '#009688',
    detect: {
      scripts: [/sitespect\.net/i],
      html:    [/sitespect/i, /SiteSpect/i],
    },
  },
  {
    name: 'Monetate', category: 'Analytics & Optimization Platform', color: '#0099CC',
    detect: {
      scripts: [/se\.monetate\.net/i, /cdn\.monetate\.net/i],
      html:    [/monetate/i, /window\.monetateQ\b/i],
    },
  },
  {
    name: 'Convert Experiences', category: 'Analytics & Optimization Platform', color: '#0095FF',
    detect: {
      scripts: [/cdn-\d+\.convertexperiments\.com/i, /convert\.com\/js\//i],
      html:    [/convertexperiments\.com/i, /_conv_q\b/i],
    },
  },
  {
    name: 'Evergage', category: 'Analytics & Optimization Platform', color: '#FF6F00',
    detect: {
      scripts: [/evergage\.com/i, /cdn\.evergage\.com/i],
      html:    [/evergage/i, /Evergage\.init\b/i, /interaction-studio/i],
    },
  },
  {
    name: 'Instapage', category: 'Analytics & Optimization Platform', color: '#1F6FFF',
    detect: {
      scripts: [/instapage\.com/i, /cdn\.instapage/i],
      html:    [/instapage/i, /data-instapage/i],
    },
  },
  {
    name: 'Leadpages', category: 'Analytics & Optimization Platform', color: '#6D3BF5',
    detect: {
      scripts: [/leadpages\.net/i, /lpcdn\.com/i, /leadpages\.com/i],
      html:    [/leadpages/i, /data-leadpages/i],
    },
  },
  {
    name: 'Landingi', category: 'Analytics & Optimization Platform', color: '#0062FF',
    detect: {
      scripts: [/landingi\.com/i, /cdn\.landingi/i],
      html:    [/landingi/i],
    },
  },
  {
    name: 'ClickFunnels', category: 'Analytics & Optimization Platform', color: '#F56A00',
    detect: {
      scripts: [/clickfunnels\.com/i, /cfimg\.com/i],
      html:    [/clickfunnels/i, /cf-powered/i],
    },
  },
  {
    name: 'ConvertFlow', category: 'Analytics & Optimization Platform', color: '#4B44FF',
    detect: {
      scripts: [/convertflow\.com/i, /js\.convertflow\.co/i],
      html:    [/convertflow/i, /data-convertflow/i],
    },
  },
  {
    name: 'Lander', category: 'Analytics & Optimization Platform', color: '#FF5722',
    detect: {
      scripts: [/landerapp\.com/i, /cdn\.lander\.com/i],
      html:    [/landerapp/i],
    },
  },
  {
    name: 'SessionCam', category: 'Analytics & Optimization Platform', color: '#1A237E',
    detect: {
      scripts: [/sessioncam\.com/i, /d2oh4tlt9mrke9\.cloudfront\.net/i],
      html:    [/sessioncam/i, /SessionCam/],
    },
  },
  {
    name: 'UserTesting', category: 'Analytics & Optimization Platform', color: '#00B4D8',
    detect: {
      scripts: [/usertesting\.com/i, /cdn\.usertesting\.com/i],
      html:    [/usertesting/i],
    },
  },
  {
    name: 'Flurry', category: 'Analytics & Optimization Platform', color: '#FF6B6B',
    detect: {
      scripts: [/flurry\.com/i, /cdn\.flurry\.com/i],
      html:    [/flurry\.com/i, /FlurryAgent/i],
    },
  },
  {
    name: 'Countly', category: 'Analytics & Optimization Platform', color: '#FF9900',
    detect: {
      scripts: [/countly\.com/i, /cdn\.countly\.com/i],
      html:    [/countly/i, /Countly\.init\b/i],
    },
  },
  {
    name: 'Clevertap', category: 'Customer Engagement / CRM', color: '#E85E2B',
    detect: {
      scripts: [/d2r1yp2w7bby2u\.cloudfront\.net/i, /clevertap\.com/i, /clevertap-prod\.com/i],
      html:    [/clevertap/i, /WizRocket/i, /clevertap\.init\b/i],
    },
  },
  {
    name: 'WebEngage', category: 'Customer Engagement / CRM', color: '#E84C3D',
    detect: {
      scripts: [/webengage\.com/i, /cdn\.webengage\.com/i, /widgets\.webengage\.com/i],
      html:    [/webengage/i, /_weq/i, /webengage\.init\b/i],
    },
  },
  {
    name: 'Moengage', category: 'Customer Engagement / CRM', color: '#00C853',
    detect: {
      scripts: [/cdn\.moengage\.com/i, /app\.moengage\.com/i, /sdk\.moengage\.com/i],
      html:    [/moengage/i, /Moengage\b/i, /moe\(/i],
    },
  },
  {
    name: 'OneSignal', category: 'Customer Engagement / CRM', color: '#E54B4D',
    detect: {
      scripts: [/cdn\.onesignal\.com/i, /onesignal\.com\/sdks/i],
      html:    [/OneSignal\b/i, /onesignal/i, /OneSignal\.push\b/i],
    },
  },
  {
    name: 'Braze', category: 'Customer Engagement / CRM', color: '#00B2A9',
    detect: {
      scripts: [/js\.appboycdn\.com/i, /sdk\.iad-\d+\.braze\.com/i, /braze\.com\/sdk/i],
      html:    [/appboy/i, /braze\.initialize\b/i, /braze\.openSession\b/i],
    },
  },
  {
    name: 'Omnisend', category: 'Customer Engagement / CRM', color: '#1463FF',
    detect: {
      scripts: [/omnisrc\.com/i, /omnisend\.com/i, /cdn\.omnisend\.com/i],
      html:    [/omnisend/i, /omnisrc\.com/i, /_omnisend/i],
    },
  },
  {
    name: 'Brevo', category: 'Customer Engagement / CRM', color: '#0B996E',
    detect: {
      scripts: [/sibautomation\.com/i, /cdn\.brevo\.com/i, /brevo\.com\/js/i],
      html:    [/sibautomation\.com/i, /sendinblue/i, /brevo\.com/i, /sib\.push\b/i],
    },
  },
  {
    name: 'Pushwoosh', category: 'Customer Engagement / CRM', color: '#00AE4F',
    detect: {
      scripts: [/cdn\.pushwoosh\.com/i, /pushwoosh\.com/i],
      html:    [/pushwoosh/i, /Pushwoosh\.init\b/i],
    },
  },
  {
    name: 'iZooto', category: 'Customer Engagement / CRM', color: '#FF6B00',
    detect: {
      scripts: [/cdn\.izooto\.com/i, /izooto\.com/i],
      html:    [/izooto/i, /iZooto\.init\b/i],
    },
  },
  {
    name: 'Contlo', category: 'Customer Engagement / CRM', color: '#6C63FF',
    detect: {
      scripts: [/cdn\.contlo\.com/i, /contlo\.com/i],
      html:    [/contlo/i],
    },
  },
  {
    name: 'Wigzo', category: 'Customer Engagement / CRM', color: '#FF5722',
    detect: {
      scripts: [/app\.wigzo\.com/i, /cdn\.wigzo\.com/i],
      html:    [/wigzo/i, /Wigzo\b/i],
    },
  },
  {
    name: 'NETCORE', category: 'Customer Engagement / CRM', color: '#0052CC',
    detect: {
      scripts: [/netcore\.co\.in/i, /netcorecloud\.com/i, /smartech\.co/i, /cdn\.smartech\.io/i],
      html:    [/netcore/i, /smartech/i, /hansel\.io/i],
    },
  },
  {
    name: 'Iterable', category: 'Customer Engagement / CRM', color: '#5C3FFF',
    detect: {
      scripts: [/js\.iterable\.com/i],
      html:    [/iterable/i],
    },
  },
  {
    name: 'Lemnisk', category: 'Customer Engagement / CRM', color: '#FF4081',
    detect: {
      scripts: [/cdn\.lemnisk\.co/i, /lemnisk\.co/i],
      html:    [/lemnisk/i],
    },
  },
  {
    name: 'Appier', category: 'Customer Engagement / CRM', color: '#FF6D00',
    detect: {
      scripts: [/cdn\.appier\.net/i, /appier\.com/i],
      html:    [/appier/i, /aiqua/i],
    },
  },
  {
    name: 'Airship', category: 'Customer Engagement / CRM', color: '#0070F3',
    detect: {
      scripts: [/aswpsdks\.com/i, /urbanairship\.com/i],
      html:    [/urbanairship/i, /airship/i],
    },
  },

  {
    name: 'Klaviyo', category: 'Customer Engagement / CRM', color: '#00C58E',
    detect: {
      scripts: [/static\.klaviyo\.com/i, /fast\.a\.klaviyo\.com/i],
      html:    [/_learnq\b/i, /klaviyo/i],
    },
  },
  {
    name: 'Mailchimp', category: 'Customer Engagement / CRM', color: '#FFE01B',
    detect: {
      scripts: [/chimpstatic\.com/i],
      html:    [/list-manage\.com/i, /mailchimp/i, /mc\.js/i],
    },
  },
  {
    name: 'HubSpot', category: 'Customer Engagement / CRM', color: '#FF7A59',
    detect: {
      scripts: [/js\.hs-scripts\.com/i, /js\.hs-analytics\.net/i, /js\.hubspot\.com/i],
      html:    [/hs-analytics/i, /hubspot/i, /_hsp/i],
    },
  },
  {
    name: 'Marketo', category: 'Customer Engagement / CRM', color: '#5C4CBF',
    detect: {
      scripts: [/munchkin\.marketo\.com/i],
      html:    [/munchkin/i, /marketo/i],
    },
  },
  {
    name: 'ActiveCampaign', category: 'Customer Engagement / CRM', color: '#356AE6',
    detect: {
      scripts: [/trackcmp\.net/i],
      html:    [/activecampaign\.com/i, /vgo\(/i],
    },
  },
  {
    name: 'BiteSpeed', category: 'Customer Engagement / CRM', color: '#6C3CE1',
    detect: {
      scripts: [/bitespeed\.co/i, /bitespeed\.com/i, /widget\.bitespeed/i, /cdn\.bitespeed/i],
      html:    [/bitespeed/i, /bite-speed/i, /bitespeed-fb-messenger/i, /bitespeed-whatsapp/i],
    },
  },
  {
    name: 'Salesforce', category: 'Customer Engagement / CRM', color: '#00A1E0',
    detect: {
      scripts: [/force\.com/i, /salesforce\.com\/js/i, /salesforceiq\.com/i, /pardot\.com/i],
      html:    [/salesforce\.com/i, /force\.com/i, /sfdc/i, /data-salesforce/i],
      headers: [{ field: 'server', rx: /salesforce/i }],
    },
  },
  {
    name: 'Zoho CRM', category: 'Customer Engagement / CRM', color: '#E42527',
    detect: {
      scripts: [/zoho\.com\/crm/i, /zohocdn\.com/i, /salesiq\.zoho/i, /zoho\.com\/salesiq/i],
      html:    [/zoho\.com\/crm/i, /zoho-salesiq/i, /zsalesiq/i, /zoho\.com\/web-forms/i],
    },
  },
  {
    name: 'Pipedrive', category: 'Customer Engagement / CRM', color: '#1B1B1B',
    detect: {
      scripts: [/pipedrive\.com/i, /pipedrivewebforms\.com/i, /cdn\.pipedrive/i],
      html:    [/pipedrive/i, /pipedriveWebForms/i],
    },
  },
  {
    name: 'Freshsales', category: 'Customer Engagement / CRM', color: '#F36C3D',
    detect: {
      scripts: [/freshsales\.io/i, /freshmarketer\.com/i, /cdn\.freshsales/i],
      html:    [/freshsales/i, /freshchat\.com/i],
    },
  },
  {
    name: 'Microsoft Dynamics 365', category: 'Customer Engagement / CRM', color: '#002050',
    detect: {
      scripts: [/dynamics\.com/i, /msdynnamics\.com/i],
      html:    [/dynamics\.com/i, /d365/i, /msdyn_/i],
    },
  },
  {
    name: 'SugarCRM', category: 'Customer Engagement / CRM', color: '#E61718',
    detect: {
      scripts: [/sugarcrm\.com/i],
      html:    [/sugarcrm/i, /sugar-crm/i],
    },
  },
  {
    name: 'Insightly', category: 'Customer Engagement / CRM', color: '#2196F3',
    detect: {
      scripts: [/insightly\.com/i],
      html:    [/insightly/i],
    },
  },
  {
    name: 'Agile CRM', category: 'Customer Engagement / CRM', color: '#27AE60',
    detect: {
      scripts: [/agilecrm\.com/i, /d1gwclp1pmzk26\.cloudfront\.net/i],
      html:    [/agilecrm/i, /agile-crm/i, /agile_crm/i],
    },
  },
  {
    name: 'Bitrix24', category: 'Customer Engagement / CRM', color: '#2FC7F7',
    detect: {
      scripts: [/bitrix24\.com/i, /cdn\.bitrix24/i, /b24-widget\.com/i],
      html:    [/bitrix24/i, /bx24_/i, /b24-widget/i],
    },
  },
  {
    name: 'Copper', category: 'Customer Engagement / CRM', color: '#FF6B00',
    detect: {
      scripts: [/copper\.com/i, /prosperworks\.com/i],
      html:    [/copper\.com/i, /prosperworks/i],
    },
  },
  {
    name: 'Apollo.io', category: 'Customer Engagement / CRM', color: '#6200EA',
    detect: {
      scripts: [/apollo\.io/i, /cdn\.apollo\.io/i],
      html:    [/apollo\.io/i, /apolloio/i],
    },
  },
  {
    name: 'Leadsquared', category: 'Customer Engagement / CRM', color: '#FF5722',
    detect: {
      scripts: [/leadsquared\.com/i, /lsq\.io/i, /cdn\.leadsquared/i],
      html:    [/leadsquared/i, /lsq-form/i],
    },
  },
  {
    name: 'Nimble', category: 'Customer Engagement / CRM', color: '#2196F3',
    detect: {
      scripts: [/nimble\.com/i],
      html:    [/nimble\.com\/api/i, /nimblewidget/i],
    },
  },
  {
    name: 'Close CRM', category: 'Customer Engagement / CRM', color: '#1A1A1A',
    detect: {
      scripts: [/close\.com/i, /app\.close\.com/i],
      html:    [/close\.com\/api/i],
    },
  },
  {
    name: 'Nutshell', category: 'Customer Engagement / CRM', color: '#FFB900',
    detect: {
      scripts: [/nutshell\.com/i],
      html:    [/nutshell\.com/i, /nutshell-crm/i],
    },
  },
  {
    name: 'Streak', category: 'Customer Engagement / CRM', color: '#EB4B2C',
    detect: {
      scripts: [/streak\.com/i],
      html:    [/streak\.com/i],
    },
  },
  {
    name: 'Monday CRM', category: 'Customer Engagement / CRM', color: '#6161FF',
    detect: {
      scripts: [/monday\.com/i],
      html:    [/monday\.com\/embed/i, /monday-embed/i],
    },
  },
  {
    name: 'Attio', category: 'Customer Engagement / CRM', color: '#000000',
    detect: {
      scripts: [/attio\.com/i],
      html:    [/attio\.com/i],
    },
  },
  {
    name: 'Folk CRM', category: 'Customer Engagement / CRM', color: '#6366F1',
    detect: {
      scripts: [/folk\.app/i],
      html:    [/folk\.app/i],
    },
  },
  {
    name: 'Salesforce Marketing Cloud', category: 'Customer Engagement / CRM', color: '#00A1E0',
    detect: {
      scripts: [/exacttarget\.com/i, /salesforce\.com\/cloud/i, /mc\.s[0-9]+\.sfmc-content\.com/i],
      html:    [/exacttarget/i, /sfmc/i, /salesforce-marketing/i, /marketingcloudapis/i],
    },
  },
  {
    name: 'Adobe Experience Cloud', category: 'Customer Engagement / CRM', color: '#FF0000',
    detect: {
      scripts: [/demdex\.net/i, /omtrdc\.net/i, /adobedtm\.com/i, /assets\.adobedtm\.com/i, /launch-.*\.adobedtm\.com/i],
      html:    [/adobe-experience/i, /adobeExperienceCloud/i, /demdex/i, /omtrdc/i, /adobe-campaign/i],
    },
  },
  {
    name: 'Wati', category: 'Customer Engagement / CRM', color: '#25D366',
    detect: {
      scripts: [/wati\.io/i, /app\.wati\.io/i, /live-chat\.wati\.io/i],
      html:    [/wati\.io/i, /wati-chat/i, /wati-widget/i],
    },
  },
  {
    name: 'Gupshup', category: 'Customer Engagement / CRM', color: '#03A84E',
    detect: {
      scripts: [/gupshup\.io/i, /smapi\.gupshup/i, /wavy\.gupshup/i],
      html:    [/gupshup/i, /gupshup\.io/i],
    },
  },
  {
    name: 'Zoho Campaigns', category: 'Customer Engagement / CRM', color: '#E42527',
    detect: {
      scripts: [/zcmpms\.com/i, /campaigns\.zoho/i, /zoho\.com\/campaigns/i],
      html:    [/zcmpms\.com/i, /zoho-campaigns/i, /campaigns\.zoho/i],
    },
  },
  {
    name: 'Mailmodo', category: 'Customer Engagement / CRM', color: '#6366F1',
    detect: {
      scripts: [/mailmodo\.com/i, /cdn\.mailmodo\.com/i],
      html:    [/mailmodo/i, /mailmodo\.com/i],
    },
  },
  {
    name: 'Interakt', category: 'Customer Engagement / CRM', color: '#25D366',
    detect: {
      scripts: [/interakt\.shop/i, /interakt\.ai/i, /app\.interakt/i],
      html:    [/interakt/i, /interakt\.shop/i],
    },
  },
  {
    name: 'Aisensy', category: 'Customer Engagement / CRM', color: '#075E54',
    detect: {
      scripts: [/aisensy\.com/i, /widget\.aisensy/i],
      html:    [/aisensy/i, /aisensy\.com/i],
    },
  },
  {
    name: 'Gallabox', category: 'Customer Engagement / CRM', color: '#6C3CE1',
    detect: {
      scripts: [/gallabox\.com/i, /app\.gallabox/i],
      html:    [/gallabox/i, /gallabox\.com/i],
    },
  },
  {
    name: 'Yalo', category: 'Customer Engagement / CRM', color: '#FF6B35',
    detect: {
      scripts: [/yalo\.com/i, /yalochat\.com/i],
      html:    [/yalo\.com/i, /yalochat/i],
    },
  },
  {
    name: 'Kaleyra', category: 'Customer Engagement / CRM', color: '#0068FF',
    detect: {
      scripts: [/kaleyra\.com/i, /kaleyra\.io/i],
      html:    [/kaleyra/i, /kaleyra\.com/i],
    },
  },
  {
    name: 'Twilio', category: 'Customer Engagement / CRM', color: '#F22F46',
    detect: {
      scripts: [/twilio\.com/i, /media\.twiliocdn\.com/i, /flex\.twilio/i],
      html:    [/twilio/i, /twilio\.com/i, /twiliocdn/i],
    },
  },
  {
    name: 'MessageBird', category: 'Customer Engagement / CRM', color: '#2481D7',
    detect: {
      scripts: [/messagebird\.com/i, /bird\.com/i, /cdn\.messagebird/i],
      html:    [/messagebird/i, /messagebird\.com/i],
    },
  },
  {
    name: 'Exotel', category: 'Customer Engagement / CRM', color: '#2196F3',
    detect: {
      scripts: [/exotel\.com/i, /exotel\.in/i, /cdn\.exotel/i],
      html:    [/exotel/i, /exotel\.com/i],
    },
  },
  {
    name: 'MSG91', category: 'Customer Engagement / CRM', color: '#56CCF2',
    detect: {
      scripts: [/msg91\.com/i, /cdn\.msg91/i, /control\.msg91/i],
      html:    [/msg91/i, /msg91\.com/i],
    },
  },
  {
    name: 'Knowlarity', category: 'Customer Engagement / CRM', color: '#FF6F00',
    detect: {
      scripts: [/knowlarity\.com/i, /kfrequency\.com/i],
      html:    [/knowlarity/i, /knowlarity\.com/i],
    },
  },
  {
    name: 'Zoko', category: 'Customer Engagement / CRM', color: '#25D366',
    detect: {
      scripts: [/zoko\.io/i, /chat\.zoko/i],
      html:    [/zoko\.io/i, /zoko-widget/i],
    },
  },
  {
    name: 'DelightChat', category: 'Customer Engagement / CRM', color: '#6C3CE1',
    detect: {
      scripts: [/delightchat\.io/i, /app\.delightchat/i],
      html:    [/delightchat/i, /delightchat\.io/i],
    },
  },
  {
    name: 'Route Mobile', category: 'Customer Engagement / CRM', color: '#003B73',
    detect: {
      scripts: [/routemobile\.com/i],
      html:    [/routemobile/i, /route-mobile/i],
    },
  },
  {
    name: 'cm.com', category: 'Customer Engagement / CRM', color: '#000000',
    detect: {
      scripts: [/cm\.com\/js/i, /cdn\.cm\.com/i, /gateway\.cm\.com/i],
      html:    [/cm\.com\/app/i, /data-cm-widget/i],
    },
  },
  {
    name: 'Engage360', category: 'Customer Engagement / CRM', color: '#FF5722',
    detect: {
      scripts: [/engage360\.com/i, /engage360\.io/i],
      html:    [/engage360/i, /engage-360/i],
    },
  },
  {
    name: 'Pinnacle', category: 'Customer Engagement / CRM', color: '#1E88E5',
    detect: {
      scripts: [/pinnacle\.in/i, /pinnacleworks\.com/i],
      html:    [/pinnacle\.in/i, /pinnacleworks/i],
    },
  },
  {
    name: 'Firebase Cloud Messaging', category: 'Customer Engagement / CRM', color: '#FFCA28',
    detect: {
      scripts: [/firebase-messaging/i, /firebasejs\/.*messaging/i, /fcm\.googleapis\.com/i],
      html:    [/firebase-messaging/i, /gcm_sender_id/i, /firebase-messaging-sw/i],
    },
  },
  {
    name: 'SuperAGI', category: 'Customer Engagement / CRM', color: '#6C3CE1',
    detect: {
      scripts: [/superagi\.com/i, /app\.superagi/i],
      html:    [/superagi/i, /super-agi/i],
    },
  },
  {
    name: 'Engage360', category: 'Customer Engagement / CRM', color: '#FF5722',
    detect: {
      scripts: [/engage360\.com/i, /engage360\.io/i],
      html:    [/engage360/i, /engage-360/i],
    },
  },
  {
    name: 'Mesoka', category: 'Customer Engagement / CRM', color: '#2196F3',
    detect: {
      scripts: [/mesoka\.com/i, /mesoka\.io/i],
      html:    [/mesoka/i],
    },
  },
  {
    name: 'Rapchat', category: 'Customer Engagement / CRM', color: '#FF4081',
    detect: {
      scripts: [/rapchat\.io/i, /rapchat\.com/i],
      html:    [/rapchat/i],
    },
  },
  {
    name: 'SendGrid', category: 'Customer Engagement / CRM', color: '#1A82E2',
    detect: {
      scripts: [/cdn\.sendgrid\.com/i],
      html:    [/sendgrid/i, /sendgrid\.net/i],
    },
  },
  {
    name: 'Drip', category: 'Customer Engagement / CRM', color: '#684DFF',
    detect: {
      scripts: [/tag\.getdrip\.com/i, /api\.getdrip\.com/i],
      html:    [/getdrip\.com/i, /dc\.js/i],
    },
  },
  {
    name: 'ConvertKit', category: 'Customer Engagement / CRM', color: '#FB6970',
    detect: {
      scripts: [/cdn\.convertkit\.com/i, /convertkit\.com/i],
      html:    [/convertkit/i, /ck\.page/i],
    },
  },
  {
    name: 'Pardot', category: 'Marketing automation', color: '#04A1E4',
    detect: {
      scripts: [/pi\.pardot\.com/i, /pardot\.com\/pd\.js/i, /go\.pardot\.com/i],
      html:    [/pardot/i, /piAId\b/i, /piCId\b/i],
    },
  },
  {
    name: 'GetResponse', category: 'Marketing automation', color: '#00BAFF',
    detect: {
      scripts: [/app\.getresponse\.com/i, /getresponse\.com\/script/i],
      html:    [/getresponse\.com/i, /gr-widget/i],
    },
  },
  {
    name: 'AWeber', category: 'Marketing automation', color: '#2C5F8E',
    detect: {
      scripts: [/forms\.aweber\.com/i, /aweber\.com\/scripts/i],
      html:    [/aweber\.com/i],
    },
  },
  {
    name: 'Constant Contact', category: 'Marketing automation', color: '#0D6EFD',
    detect: {
      scripts: [/r20\.rs6\.net/i, /constantcontact\.com/i],
      html:    [/constantcontact\.com/i, /ctct/i],
    },
  },
  {
    name: 'Campaign Monitor', category: 'Marketing automation', color: '#509CF6',
    detect: {
      scripts: [/js\.createsend1\.com/i, /createsend\.com/i, /campaignmonitor\.com/i],
      html:    [/createsend/i, /campaignmonitor/i],
    },
  },
  {
    name: 'Ortto', category: 'Marketing automation', color: '#3B2FC6',
    detect: {
      scripts: [/cdn\.ap3api\.com/i, /ortto\.com/i, /autopilotapp\.com/i],
      html:    [/ortto\.com/i, /autopilotapp\.com/i, /ap3c\b/i],
    },
  },
  {
    name: 'Customer.io', category: 'Customer Engagement / CRM', color: '#FFB74D',
    detect: {
      scripts: [/assets\.customer\.io/i, /track\.customer\.io/i, /customerioforms/i],
      html:    [/customer\.io/i, /customerio/i, /_cio\b/i],
    },
  },
  {
    name: 'Emarsys', category: 'Marketing automation', color: '#512698',
    detect: {
      scripts: [/cdn\.scarabresearch\.com/i, /scarab\.js/i, /emarsys\.com/i, /emarsys\.net/i],
      html:    [/scarab/i, /emarsys/i, /ScarabQueue\b/i],
    },
  },
  {
    name: 'Sailthru', category: 'Marketing automation', color: '#FF6B00',
    detect: {
      scripts: [/ak\.sail-horizon\.com/i, /sailthru\.com/i],
      html:    [/sailthru/i, /Sailthru\b/i],
    },
  },
  {
    name: 'Responsys', category: 'Marketing automation', color: '#E74C3C',
    detect: {
      scripts: [/oc\.rvs\.responsys\.net/i, /responsys\.net/i],
      html:    [/responsys/i],
    },
  },
  {
    name: 'Dotdigital', category: 'Marketing automation', color: '#7B2D8E',
    detect: {
      scripts: [/r[0-9]+\.dotdigital-pages\.com/i, /dotdigital\.com/i, /trackedweb\.net/i],
      html:    [/dotdigital/i, /dotmailer/i, /trackedweb\.net/i],
    },
  },
  {
    name: 'Moosend', category: 'Marketing automation', color: '#22BB5B',
    detect: {
      scripts: [/cdn\.stat-track\.com/i, /moosend\.com/i],
      html:    [/moosend/i],
    },
  },
  {
    name: 'MailerLite', category: 'Customer Engagement / CRM', color: '#09C269',
    detect: {
      scripts: [/static\.mailerlite\.com/i, /assets\.mailerlite\.com/i, /ml\.js/i],
      html:    [/mailerlite/i, /ml-form-embed/i, /ml_account/i],
    },
  },
  {
    name: 'SendPulse', category: 'Marketing automation', color: '#2196F3',
    detect: {
      scripts: [/cdn\.sendpulse\.com/i, /sendpulse\.com/i],
      html:    [/sendpulse/i],
    },
  },
  {
    name: 'Elastic Email', category: 'Marketing automation', color: '#F7A800',
    detect: {
      scripts: [/elasticemail\.com/i],
      html:    [/elasticemail\.com/i],
    },
  },
  {
    name: 'Mailjet', category: 'Marketing automation', color: '#FBD000',
    detect: {
      scripts: [/widget\.mailjet\.com/i, /app\.mailjet\.com/i],
      html:    [/mailjet\.com/i, /mjml/i],
    },
  },
  {
    name: 'Insider', category: 'Marketing automation', color: '#FF2D55',
    detect: {
      scripts: [/insr\.ins-cdn\.com/i, /useinsider\.com/i, /api\.useinsider\.com/i],
      html:    [/useinsider\.com/i, /insider_object\b/i, /ins-launch-pad/i],
    },
  },
  {
    name: 'Bloomreach Engagement', category: 'Marketing automation', color: '#0059FF',
    detect: {
      scripts: [/cdn\.exponea\.com/i, /api\.exponea\.com/i, /bloomreach\.com/i],
      html:    [/exponea/i, /bloomreach/i],
    },
  },
  {
    name: 'Acoustic', category: 'Marketing automation', color: '#0052C2',
    detect: {
      scripts: [/s[0-9]+\.wp\.com\/acoustic/i, /acoustic\.com/i, /mktoresp\.com/i],
      html:    [/acoustic\.com/i, /silverpop/i],
    },
  },
  {
    name: 'Cordial', category: 'Marketing automation', color: '#FF5E35',
    detect: {
      scripts: [/track\.cordial\.com/i, /cordial\.com\/track/i],
      html:    [/cordial\.com/i, /crdl\b/i],
    },
  },
  {
    name: 'Listrak', category: 'Marketing automation', color: '#FF6D00',
    detect: {
      scripts: [/cdn\.listrakbi\.com/i, /listrak\.com/i, /s1\.listrakbi\.com/i],
      html:    [/listrak/i, /ltkModule\b/i, /ltk\b/i],
    },
  },
  {
    name: 'Bluecore', category: 'Marketing automation', color: '#3366FF',
    detect: {
      scripts: [/api\.bluecore\.com/i, /cdn\.bluecore\.com/i],
      html:    [/bluecore/i],
    },
  },
  {
    name: 'Wunderkind', category: 'Marketing automation', color: '#000000',
    detect: {
      scripts: [/tag\.wknd\.ai/i, /cdn\.wknd\.ai/i, /bounceexchange\.com/i],
      html:    [/wknd\.ai/i, /bounceexchange/i, /bouncex/i],
    },
  },
  {
    name: 'Attentive', category: 'Marketing automation', color: '#000000',
    detect: {
      scripts: [/cdn\.attn\.tv/i, /attentive\.com/i, /attn\.tv/i],
      html:    [/attn\.tv/i, /attentive/i, /attntv/i],
    },
  },
  {
    name: 'Postscript', category: 'Marketing automation', color: '#6C3CE1',
    detect: {
      scripts: [/sdk\.postscript\.io/i, /postscript\.io/i],
      html:    [/postscript\.io/i, /ps-widget/i],
    },
  },
  {
    name: 'Wisepops', category: 'Marketing automation', color: '#FF5500',
    detect: {
      scripts: [/wisepops\.com/i, /loader\.wisepops\.com/i],
      html:    [/wisepops/i],
    },
  },
  {
    name: 'Sleeknote', category: 'Marketing automation', color: '#5138EE',
    detect: {
      scripts: [/sleeknotecustomerscripts/i, /sleeknote\.com/i],
      html:    [/sleeknote/i],
    },
  },
  {
    name: 'Sumo', category: 'Marketing automation', color: '#22C55E',
    detect: {
      scripts: [/load\.sumo\.com/i, /sumo\.com\/sumo/i],
      html:    [/sumo\.com/i, /sumo-app/i, /__sumo/i],
    },
  },
  {
    name: 'Hello Bar', category: 'Marketing automation', color: '#FF6B00',
    detect: {
      scripts: [/my\.hellobar\.com/i, /hellobar\.com/i],
      html:    [/hellobar\.com/i, /hellobar/i],
    },
  },

  {
    name: 'Intercom', category: 'Customer Support', color: '#1F8DED',
    detect: {
      scripts: [/widget\.intercom\.io/i, /js\.intercomcdn\.com/i],
      html:    [/window\.Intercom\b/i, /intercomSettings/i, /intercom-lightweight-app/i],
    },
  },
  {
    name: 'Zendesk', category: 'Customer Support', color: '#03363D',
    detect: {
      scripts: [/static\.zdassets\.com/i, /ekr\.zdassets\.com/i],
      html:    [/ze\(['"]webWidget/i, /zopim/i, /zdassets\.com/i],
    },
  },
  {
    name: 'Freshdesk', category: 'Customer Support', color: '#25C16F',
    detect: {
      scripts: [/wchat\.freshchat\.com/i, /d3cpwgzna4s6od\.cloudfront\.net/i],
      html:    [/freshchat/i, /freshdesk/i, /fcWidgetSettings/i],
    },
  },
  {
    name: 'Crisp', category: 'Customer Support', color: '#1972F5',
    detect: {
      scripts: [/client\.crisp\.chat/i],
      html:    [/\$crisp\b/i, /crisp\.chat/i],
    },
  },
  {
    name: 'Tidio', category: 'Customer Support', color: '#0B2040',
    detect: {
      scripts: [/code\.tidio\.co/i],
      html:    [/tidio/i],
    },
  },
  {
    name: 'Tawk.to', category: 'Customer Support', color: '#03C75A',
    detect: {
      scripts: [/embed\.tawk\.to/i],
      html:    [/tawk\.to/i, /Tawk_API\b/i, /Tawk_LoadStart\b/i],
    },
  },
  {
    name: 'Zoho SalesIQ', category: 'Customer Support', color: '#E42527',
    detect: {
      scripts: [/salesiq\.zoho\.com/i, /salesiq\.zohopublic\.com/i],
      html:    [/salesiq\.zoho/i, /zoho\.com\/salesiq/i, /\$zoho\b/i],
    },
  },
  {
    name: 'Chatwoot', category: 'Customer Support', color: '#1F93FF',
    detect: {
      scripts: [/app\.chatwoot\.com/i, /chatwoot\.com\/packs/i],
      html:    [/chatwootSettings\b/i, /chatwoot/i, /chatwootWidget/i],
    },
  },
  {
    name: 'JivoChat', category: 'Customer Support', color: '#23CB4E',
    detect: {
      scripts: [/code\.jivosite\.com/i, /cdn-ca\.jivosite\.com/i],
      html:    [/jivosite/i, /jivo_chat/i, /jivochat/i],
    },
  },
  {
    name: 'Smartsupp', category: 'Customer Support', color: '#F15B22',
    detect: {
      scripts: [/www\.smartsupp\.com\/loader\.js/i, /smartsupp\.com/i],
      html:    [/smartsupp/i, /_smartsupp\b/i],
    },
  },
  {
    name: 'HelpCrunch', category: 'Customer Support', color: '#0075FF',
    detect: {
      scripts: [/widget\.helpcrunch\.com/i, /cdn\.helpcrunch\.com/i],
      html:    [/helpcrunch/i, /HelpCrunch\b/i],
    },
  },
  {
    name: 'Haptik', category: 'Customer Support', color: '#368FFF',
    detect: {
      scripts: [/toolassets\.haptikapi\.com/i, /haptik\.ai/i],
      html:    [/haptik/i, /HaptikSDK\b/i],
    },
  },
  {
    name: 'Kommunicate', category: 'Customer Support', color: '#5C5AA7',
    detect: {
      scripts: [/widget\.kommunicate\.io/i, /cdn\.kommunicate\.io/i],
      html:    [/kommunicate/i, /Kommunicate\b/i],
    },
  },
  {
    name: 'Verloop', category: 'Customer Support', color: '#6C63FF',
    detect: {
      scripts: [/cdn\.verloop\.io/i, /verloop\.io/i],
      html:    [/verloop/i, /Verloop\b/i],
    },
  },
  {
    name: 'Gorgias', category: 'Customer Support', color: '#1F1F1F',
    detect: {
      scripts: [/config\.gorgias\.chat/i, /gorgias\.chat/i],
      html:    [/gorgias/i, /gorgias-chat/i],
    },
  },
  {
    name: 'Sprinklr', category: 'Customer Support', color: '#C02BA0',
    detect: {
      scripts: [/sprinklr\.com/i, /cdn\.sprinklr\.com/i],
      html:    [/sprinklr/i, /Sprinklr\b/i],
    },
  },
  {
    name: 'Zoho Desk', category: 'Customer Support', color: '#E42527',
    detect: {
      scripts: [/desk\.zoho\.com/i, /js\.zohostatic\.com\/desk/i],
      html:    [/zoho.*desk/i, /zohodesk/i, /desk\.zoho/i],
    },
  },
  {
    name: 'Chatra', category: 'Customer Support', color: '#E84E36',
    detect: {
      scripts: [/call\.chatra\.io/i, /chatra\.io/i],
      html:    [/chatra/i, /ChatraID/i],
    },
  },
  {
    name: 'Dixa', category: 'Customer Support', color: '#7B61FF',
    detect: {
      scripts: [/dixa\.io/i, /cdn\.dixa\.io/i],
      html:    [/dixa/i, /dixa\.io/i],
    },
  },
  {
    name: 'Trengo', category: 'Customer Support', color: '#0072FF',
    detect: {
      scripts: [/trengo\.eu/i, /widget\.trengo/i],
      html:    [/trengo/i, /trengo\.eu/i],
    },
  },
  {
    name: 'Userlike', category: 'Customer Support', color: '#00C48C',
    detect: {
      scripts: [/userlike-cdn-widgets/i, /userlike\.com/i],
      html:    [/userlike/i, /userlikedata/i],
    },
  },
  {
    name: 'Customerly', category: 'Customer Support', color: '#0066FF',
    detect: {
      scripts: [/customerly\.io/i, /widget\.customerly/i],
      html:    [/customerly/i],
    },
  },
  {
    name: 'Pure Chat', category: 'Customer Support', color: '#00B5E2',
    detect: {
      scripts: [/purechat\.com/i, /app\.purechat\.com/i],
      html:    [/purechat/i, /pure-chat/i],
    },
  },
  {
    name: 'SnapEngage', category: 'Customer Support', color: '#FF6600',
    detect: {
      scripts: [/snapengage\.com/i, /storage\.googleapis\.com\/code\.snapengage/i],
      html:    [/snapengage/i, /SnapEngageChat/i],
    },
  },
  {
    name: 'Kayako', category: 'Customer Support', color: '#FF6F00',
    detect: {
      scripts: [/kayako\.com/i, /cdn\.kayako\.com/i],
      html:    [/kayako/i, /kayako-messenger/i],
    },
  },
  {
    name: 'Salesforce Live Agent', category: 'Customer Support', color: '#00A1E0',
    detect: {
      scripts: [/liveagent\.salesforce/i, /la\.salesforce\.com/i],
      html:    [/liveagent/i, /liveAgentInit/i, /salesforce.*liveagent/i],
    },
  },
  {
    name: 'Genesys Cloud', category: 'Customer Support', color: '#FF4F1F',
    detect: {
      scripts: [/genesys\.com/i, /apps\.mypurecloud\.com/i, /use\.fontawesome\.com/i],
      html:    [/genesys/i, /purecloud/i, /mypurecloud/i],
    },
  },
  {
    name: 'Freshservice', category: 'Customer Support', color: '#25C16F',
    detect: {
      scripts: [/freshservice\.com/i, /assets\.freshservice/i],
      html:    [/freshservice/i],
    },
  },
  {
    name: 'Birdeye', category: 'Customer Support', color: '#2196F3',
    detect: {
      scripts: [/birdeye\.com/i, /cdn\.birdeye\.com/i],
      html:    [/birdeye/i, /birdeye\.com/i],
    },
  },

  {
    name: 'WhatsApp Business Chat', category: 'Live chat', color: '#25D366',
    detect: {
      html:    [/api\.whatsapp\.com/i, /wa\.me\//i, /whatsapp-widget/i, /whatsapp\.com\/send/i, /data-whatsapp/i, /whatsapp-button/i, /class="[^"]*whatsapp[^"]*"/i],
      scripts: [/whatsapp/i, /wa\.me/i],
    },
  },

  {
    name: 'Stripe', category: 'Payments & Checkout - Gateway', color: '#635BFF',
    detect: {
      scripts: [/js\.stripe\.com/i],
      html:    [/Stripe\(['"]pk_/i],
    },
  },
  {
    name: 'Razorpay', category: 'Payments & Checkout - Gateway', color: '#3395FF',
    detect: {
      scripts: [/checkout\.razorpay\.com/i],
      html:    [/razorpay/i, /Razorpay\b/i],
    },
  },
  {
    name: 'PayPal', category: 'Payments & Checkout - Gateway', color: '#003087',
    detect: {
      scripts: [/paypal\.com\/sdk/i, /paypalobjects\.com/i],
      html:    [/checkout\.paypal\.com/i, /paypal-button/i, /data-paypal/i, /paypal-checkout/i, /paypal-sdk/i, /paypal\.Buttons/i],
    },
  },
  {
    name: 'CCAvenue', category: 'Payments & Checkout - Gateway', color: '#F60000',
    detect: {
      html:    [/ccavenue/i, /ccavenueform/i],
    },
  },
  {
    name: 'Cashfree', category: 'Payments & Checkout - Gateway', color: '#00BFA5',
    detect: {
      scripts: [/cashfree\.com/i, /sdk\.cashfree\.com/i],
      html:    [/cashfree/i],
    },
  },

  {
    name: 'Adyen', category: 'Payments & Checkout - Gateway', color: '#0ABF53',
    detect: {
      scripts: [/checkoutshopper-live\.adyen\.com/i, /checkoutshopper-test\.adyen\.com/i, /adyen\.com\/checkoutshopper/i],
      html:    [/adyen/i, /adyen-checkout/i],
    },
  },
  {
    name: 'PayU', category: 'Payments & Checkout - Gateway', color: '#A8C73A',
    detect: {
      scripts: [/secure\.payu\.in/i, /jssdk\.payu\.in/i, /payu\.in/i],
      html:    [/payu\.in/i, /payubiz/i, /payumoney/i],
    },
  },
  {
    name: 'Juspay', category: 'Payments & Checkout - Gateway', color: '#3350CC',
    detect: {
      scripts: [/api\.juspay\.in/i, /juspay\.in/i, /cdn\.juspay\.in/i],
      html:    [/juspay/i, /Juspay\b/i],
    },
  },
  {
    name: 'PhonePe PG', category: 'Payments & Checkout - Gateway', color: '#5F259F',
    detect: {
      scripts: [/mercury\.phonepe\.com/i, /phonepe\.com/i],
      html:    [/phonepe/i, /PhonePe\b/i],
    },
  },
  {
    name: 'Simpl', category: 'Payments & Checkout - Gateway', color: '#F8D44C',
    detect: {
      scripts: [/cdn\.getsimpl\.com/i, /checkout\.getsimpl\.com/i],
      html:    [/getsimpl\.com/i, /simpl-checkout/i],
    },
  },
  {
    name: 'Instamojo', category: 'Payments & Checkout - Gateway', color: '#00BFA5',
    detect: {
      scripts: [/cdn\.instamojo\.com/i, /js\.instamojo\.com/i],
      html:    [/instamojo/i],
    },
  },
  {
    name: 'BillDesk', category: 'Payments & Checkout - Gateway', color: '#004D8F',
    detect: {
      scripts: [/billdesk\.com/i, /pgi\.billdesk\.com/i],
      html:    [/billdesk/i, /BillDesk\b/i],
    },
  },
  {
    name: 'Paytm PG', category: 'Payments & Checkout - Gateway', color: '#012B72',
    detect: {
      scripts: [/securegw\.paytm\.in/i, /merchantpgpui\.paytm\.in/i, /checkout\.paytm\.com/i],
      html:    [/paytm/i, /Paytm\b/i],
    },
  },
  {
    name: 'Amazon Pay', category: 'Payments & Checkout - Gateway', color: '#FF9900',
    detect: {
      scripts: [/static-na\.payments-amazon\.com/i, /pay\.amazon\./i],
      html:    [/amazonpay/i, /pay\.amazon/i, /amazon-pay/i],
    },
  },
  {
    name: 'Klarna', category: 'Payments & Checkout - Gateway', color: '#FFB3C7',
    detect: {
      scripts: [/js\.klarna\.com/i, /cdn\.klarna\.com/i, /x\.klarnacdn\.net/i],
      html:    [/klarna/i, /Klarna\b/i, /klarna-placement/i],
    },
  },
  {
    name: 'Affirm', category: 'Payments & Checkout - Gateway', color: '#4A4AE9',
    detect: {
      scripts: [/cdn1\.affirm\.com/i, /cdn-assets\.affirm\.com/i],
      html:    [/affirm/i, /affirm\.js/i],
    },
  },
  {
    name: 'Afterpay', category: 'Payments & Checkout - Gateway', color: '#B2FCE4',
    detect: {
      scripts: [/afterpay\.com/i, /portal\.afterpay\.com/i, /js\.afterpay\.com/i],
      html:    [/afterpay/i, /Afterpay\b/i, /afterpay-widget/i],
    },
  },
  {
    name: 'Sezzle', category: 'Payments & Checkout - Gateway', color: '#382757',
    detect: {
      scripts: [/widget\.sezzle\.com/i, /sezzle\.com/i],
      html:    [/sezzle/i, /sezzle-widget/i],
    },
  },
  {
    name: 'Easebuzz', category: 'Payments & Checkout - Gateway', color: '#2196F3',
    detect: {
      scripts: [/ebz-static\.s3\.ap-south-1\.amazonaws\.com/i, /pay\.easebuzz\.in/i],
      html:    [/easebuzz/i, /EasebuzzCheckout\b/i],
    },
  },
  {
    name: 'Visa', category: 'Payments & Checkout - Gateway', color: '#1A1F71',
    detect: {
      html: [/aria-labelledby="pi-visa"/i, /<title[^>]*>Visa<\/title>/i,
             /payment[-_]?icon[^>]*visa/i, /alt="[^"]*\bvisa\b[^"]*"/i,
             /data-payment[^>]*visa/i],
    },
  },
  {
    name: 'Mastercard', category: 'Payments & Checkout - Gateway', color: '#EB001B',
    detect: {
      html: [/aria-labelledby="pi-master(?:card)?"/i, /<title[^>]*>Mastercard<\/title>/i,
             /payment[-_]?icon[^>]*mastercard/i, /alt="[^"]*mastercard[^"]*"/i,
             /data-payment[^>]*mastercard/i],
    },
  },
  {
    name: 'American Express', category: 'Payments & Checkout - Gateway', color: '#006FCF',
    detect: {
      html: [/aria-labelledby="pi-american[_-]?express"/i, /<title[^>]*>American Express<\/title>/i,
             /payment[-_]?icon[^>]*amex/i, /alt="[^"]*(?:amex|american express)[^"]*"/i,
             /data-payment[^>]*amex/i],
    },
  },

  {
    name: 'Algolia', category: 'Search', color: '#5468FF',
    detect: {
      scripts: [/algolia\.net/i, /algoliacdn\.net/i, /algoliasearch/i],
      html:    [/algoliasearch/i, /algoliaSearch/i],
    },
  },

  {
    name: 'Yotpo', category: 'Reviews', color: '#1C1C1C',
    detect: {
      scripts: [/staticw2\.yotpo\.com/i, /yotpo\.com/i],
      html:    [/yotpo/i],
    },
  },
  {
    name: 'Judge.me', category: 'Reviews', color: '#F89020',
    detect: {
      scripts: [/judge\.me/i, /cdn\.judge\.me/i],
      html:    [/judge\.me/i, /judgeMe/i],
    },
  },
  {
    name: 'Okendo', category: 'Reviews', color: '#FF6B4A',
    detect: {
      scripts: [/cdn\.okendo\.io/i],
      html:    [/okendo/i],
    },
  },
  {
    name: 'Trustpilot', category: 'Reviews', color: '#00B67A',
    detect: {
      scripts: [/widget\.trustpilot\.com/i, /invitejs\.trustpilot\.com/i],
      html:    [/trustpilot/i],
    },
  },

  {
    name: 'Smile.io', category: 'Loyalty & Rewards', color: '#FFC501',
    detect: {
      scripts: [/smile\.io/i, /cdn\.smile\.io/i],
      html:    [/smile\.io/i, /sweetTooth/i],
    },
  },
  {
    name: 'LoyaltyLion', category: 'Loyalty & Rewards', color: '#FF6D00',
    detect: {
      scripts: [/loyaltylion\.com/i],
      html:    [/loyaltylion/i, /loyalty-lion/i],
    },
  },

  {
    name: 'AfterShip', category: 'Shipping', color: '#0094F0',
    detect: {
      scripts: [/aftership\.com/i],
      html:    [/aftership/i, /AfterShip/i],
    },
  },
  {
    name: 'Shiprocket', category: 'Shipping', color: '#F05822',
    detect: {
      html:    [/shiprocket/i],
    },
  },
  {
    name: 'Loop Returns', category: 'Returns', color: '#1A1A1A',
    detect: {
      scripts: [/loopreturns\.com/i, /cdn\.loopreturns\.com/i],
      html:    [/loopreturns/i, /loop-returns/i],
    },
  },

  {
    name: 'GoKwik', category: 'Payments & Checkout - Checkout / BNPL', color: '#6C3CE1',
    detect: {
      scripts: [/gokwik\.co/i, /cdn\.gokwik\.co/i],
      html:    [/gokwik/i, /GoKwik/],
    },
  },
  {
    name: 'Shop Pay', category: 'Payments & Checkout - Checkout / BNPL', color: '#5A31F4',
    detect: {
      scripts: [/pay\.shopify\.com/i],
      html:    [/shop-pay/i, /ShopPay\b/i, /pay\.shopify\.com/i],
    },
  },
  {
    name: 'Shiprocket Checkout', category: 'Payments & Checkout - Checkout / BNPL', color: '#F05822',
    detect: {
      scripts: [/shiprocket\.com\/checkout/i],
      html:    [/shiprocket-checkout/i],
    },
  },
  {
    name: 'Shopflo', category: 'Payments & Checkout - Checkout / BNPL', color: '#5046E4',
    detect: {
      scripts: [/shopflo\.com/i, /bridge\.shopflo\.com/i, /shopflo\.bundle/i],
      html:    [/shopflo\.com/i, /shopflo-checkout/i, /data-shopflo/i],
    },
  },
  {
    name: 'LazyPay', category: 'Payments & Checkout - Checkout / BNPL', color: '#FF4081',
    detect: {
      scripts: [/lazypay\.in/i, /lazypay\.getsimpl\.com/i],
      html:    [/lazypay/i, /LazyPay/],
    },
  },
  {
    name: 'ZestMoney', category: 'Payments & Checkout - Checkout / BNPL', color: '#FF6F00',
    detect: {
      scripts: [/zestmoney\.in/i, /zestplatform\.com/i],
      html:    [/zestmoney/i, /ZestMoney/],
    },
  },
  {
    name: 'Snapmint', category: 'Payments & Checkout - Checkout / BNPL', color: '#2F80ED',
    detect: {
      scripts: [/snapmint\.com/i],
      html:    [/snapmint/i],
    },
  },
  {
    name: 'Kissht', category: 'Payments & Checkout - Checkout / BNPL', color: '#FF6B00',
    detect: {
      scripts: [/kissht\.com/i, /cdn\.kissht/i],
      html:    [/kissht/i, /kissht\.com/i],
    },
  },
  {
    name: 'PostPe', category: 'Payments & Checkout - Checkout / BNPL', color: '#E91E63',
    detect: {
      scripts: [/postpe\.com/i, /postpe\.in/i],
      html:    [/postpe/i, /post-pe/i],
    },
  },
  {
    name: 'Uni Cards', category: 'Payments & Checkout - Checkout / BNPL', color: '#000000',
    detect: {
      scripts: [/uni\.cards/i, /unicards\.com/i],
      html:    [/uni\.cards/i, /unicards/i],
    },
  },
  {
    name: 'Google Pay', category: 'Payments & Checkout - Checkout / BNPL', color: '#4285F4',
    detect: {
      scripts: [/pay\.google\.com/i, /google\.com\/pay/i],
      html:    [/google-pay/i, /googlepay/i, /gpay-button/i, /goog-pay/i, /pay\.google\.com/i],
    },
  },
  {
    name: 'Apple Pay', category: 'Payments & Checkout - Checkout / BNPL', color: '#000000',
    detect: {
      html:    [/apple-pay/i, /applepay/i, /apple-pay-button/i, /ApplePaySession/i, /apple\.com\/apple-pay/i],
    },
  },
  {
    name: 'Juspay Express Checkout', category: 'Payments & Checkout - Checkout / BNPL', color: '#3350CC',
    detect: {
      scripts: [/juspay\.in\/express/i, /expresscheckout\.juspay/i],
      html:    [/juspay.*express/i, /express-checkout.*juspay/i],
    },
  },
  {
    name: 'Kiwi Checkout', category: 'Payments & Checkout - Checkout / BNPL', color: '#4CAF50',
    detect: {
      scripts: [/kiwi\.com/i, /kiwisize\.com/i],
      html:    [/kiwi-checkout/i, /kiwisize/i],
    },
  },
  {
    name: 'Capital Float', category: 'Payments & Checkout - Checkout / BNPL', color: '#1565C0',
    detect: {
      scripts: [/capitalfloat\.com/i],
      html:    [/capitalfloat/i, /capital-float/i],
    },
  },
  {
    name: 'FlexiPay', category: 'Payments & Checkout - Checkout / BNPL', color: '#FF9800',
    detect: {
      scripts: [/flexipay\.in/i, /flexipay\.com/i],
      html:    [/flexipay/i, /flexi-pay/i],
    },
  },
  {
    name: 'ePayLater', category: 'Payments & Checkout - Checkout / BNPL', color: '#1B5E20',
    detect: {
      scripts: [/epaylater\.in/i, /epaylater\.com/i],
      html:    [/epaylater/i, /epay-later/i],
    },
  },
  {
    name: 'Shopify Checkout', category: 'Payments & Checkout - Checkout / BNPL', color: '#96BF48',
    detect: {
      html:    [/shopify-checkout/i, /checkout\.shopify\.com/i, /shopify-payment-button/i],
    },
  },
  {
    name: 'Decentro', category: 'Payments & Checkout - Gateway', color: '#1E3A5F',
    detect: {
      scripts: [/decentro\.tech/i],
      html:    [/decentro/i],
    },
  },
  {
    name: 'Checkout.com', category: 'Payments & Checkout - Gateway', color: '#0B5FFF',
    detect: {
      scripts: [/checkout\.com\/js/i, /cdn\.checkout\.com/i],
      html:    [/cko-session/i, /data-checkout/i, /checkout\.com/i],
    },
  },
  {
    name: 'Braintree', category: 'Payments & Checkout - Gateway', color: '#003366',
    detect: {
      scripts: [/braintreegateway\.com/i, /braintree-web/i, /js\.braintreegateway\.com/i],
      html:    [/braintree/i, /braintree-hosted-field/i],
    },
  },
  {
    name: 'Square', category: 'Payments & Checkout - Gateway', color: '#006AFF',
    detect: {
      scripts: [/squareup\.com/i, /square\.site/i, /squarecdn\.com/i],
      html:    [/sq-payment-form/i, /square-payment/i],
    },
  },
  {
    name: '2Checkout (Verifone)', category: 'Payments & Checkout - Gateway', color: '#FF6600',
    detect: {
      scripts: [/2checkout\.com/i, /avangate\.com/i],
      html:    [/2checkout/i, /avangate/i, /2co\.com/i],
    },
  },
  {
    name: 'Authorize.Net', category: 'Payments & Checkout - Gateway', color: '#003B64',
    detect: {
      scripts: [/authorize\.net/i, /jstest\.authorize\.net/i, /js\.authorize\.net/i],
      html:    [/authorize\.net/i, /AcceptUI/i],
    },
  },
  {
    name: 'Worldpay', category: 'Payments & Checkout - Gateway', color: '#EB001B',
    detect: {
      scripts: [/worldpay\.com/i, /secure\.worldpay\.com/i],
      html:    [/worldpay/i],
    },
  },
  {
    name: 'Mollie', category: 'Payments & Checkout - Gateway', color: '#000000',
    detect: {
      scripts: [/mollie\.com/i, /js\.mollie\.com/i],
      html:    [/mollie-components/i, /mollie/i],
    },
  },
  {
    name: 'Pine Labs', category: 'Payments & Checkout - Gateway', color: '#E31837',
    detect: {
      scripts: [/pinelabs\.com/i, /pluralonline\.com/i],
      html:    [/pinelabs/i, /plural/i, /pluralonline/i],
    },
  },
  {
    name: 'Open Financial', category: 'Payments & Checkout - Gateway', color: '#5046E4',
    detect: {
      scripts: [/open\.money/i, /bankopen\.co/i],
      html:    [/open\.money/i, /zwitch\.io/i],
    },
  },
  {
    name: 'MagicPin Pay', category: 'Payments & Checkout - Gateway', color: '#FF3366',
    detect: {
      scripts: [/magicpin\.in/i],
      html:    [/magicpin/i],
    },
  },
  {
    name: 'Cred Pay', category: 'Payments & Checkout - Gateway', color: '#1A1A1A',
    detect: {
      html:    [/credpay/i, /cred\.club\/pay/i, /cred-pay/i],
    },
  },
  {
    name: 'PayKun', category: 'Payments & Checkout - Gateway', color: '#FF6F00',
    detect: {
      scripts: [/paykun\.com/i],
      html:    [/paykun/i, /paykun\.com/i],
    },
  },
  {
    name: 'Airpay', category: 'Payments & Checkout - Gateway', color: '#00BCD4',
    detect: {
      scripts: [/airpay\.co\.in/i, /payments\.airpay/i],
      html:    [/airpay/i, /airpay\.co/i],
    },
  },
  {
    name: 'Zaakpay', category: 'Payments & Checkout - Gateway', color: '#FF5722',
    detect: {
      scripts: [/zaakpay\.com/i],
      html:    [/zaakpay/i],
    },
  },
  {
    name: 'Paynimo', category: 'Payments & Checkout - Gateway', color: '#003087',
    detect: {
      scripts: [/paynimo\.com/i],
      html:    [/paynimo/i],
    },
  },
  {
    name: 'Mobikwik PG', category: 'Payments & Checkout - Gateway', color: '#DB0B5F',
    detect: {
      scripts: [/mobikwik\.com/i, /payments\.mobikwik/i],
      html:    [/mobikwik/i, /mobikwik\.com/i],
    },
  },
  {
    name: 'Payoneer', category: 'Payments & Checkout - Gateway', color: '#FF6300',
    detect: {
      scripts: [/payoneer\.com/i],
      html:    [/payoneer/i, /payoneer\.com/i],
    },
  },
  {
    name: 'Paddle', category: 'Payments & Checkout - Gateway', color: '#FFCC00',
    detect: {
      scripts: [/paddle\.com/i, /cdn\.paddle\.com/i, /paddle\.js/i],
      html:    [/paddle-button/i, /data-paddle/i, /paddle\.com/i],
    },
  },
  {
    name: 'BlueSnap', category: 'Payments & Checkout - Gateway', color: '#0066FF',
    detect: {
      scripts: [/bluesnap\.com/i, /sandpiper\.bluesnap/i],
      html:    [/bluesnap/i],
    },
  },
  {
    name: 'Paystack', category: 'Payments & Checkout - Gateway', color: '#00C3F7',
    detect: {
      scripts: [/paystack\.co/i, /js\.paystack\.co/i],
      html:    [/paystack/i, /paystack\.co/i],
    },
  },
  {
    name: 'Flutterwave', category: 'Payments & Checkout - Gateway', color: '#F5A623',
    detect: {
      scripts: [/flutterwave\.com/i, /checkout\.flutterwave/i, /ravesandbox\.flutterwave/i],
      html:    [/flutterwave/i, /flwpug/i],
    },
  },
  {
    name: 'Shopify Payments', category: 'Payments & Checkout - Gateway', color: '#96BF48',
    detect: {
      html:    [/shopify-payment/i, /shopifypay/i, /shopify_payment/i],
    },
  },
  {
    name: 'ICICI Eazypay', category: 'Payments & Checkout - Gateway', color: '#F37920',
    detect: {
      scripts: [/eazypay\.icicibank/i],
      html:    [/eazypay/i, /icici.*eazypay/i],
    },
  },
  {
    name: 'HDFC Payment Gateway', category: 'Payments & Checkout - Gateway', color: '#004C8F',
    detect: {
      scripts: [/hdfcbank\.com\/payment/i],
      html:    [/hdfc.*payment/i, /hdfcbank\.com/i],
    },
  },
  {
    name: 'PhonePe Switch', category: 'Payments & Checkout - Gateway', color: '#5F259F',
    detect: {
      scripts: [/phonepe\.com\/switch/i],
      html:    [/phonepe-switch/i, /phonepe\.com\/switch/i],
    },
  },
  {
    name: 'Mangopay', category: 'Payments & Checkout - Gateway', color: '#FF6D00',
    detect: {
      scripts: [/mangopay\.com/i, /api\.mangopay/i],
      html:    [/mangopay/i],
    },
  },
  {
    name: 'WePay', category: 'Payments & Checkout - Gateway', color: '#0077C5',
    detect: {
      scripts: [/wepay\.com/i, /static\.wepay/i],
      html:    [/wepay/i, /wepay\.com/i],
    },
  },
  {
    name: 'PayFast', category: 'Payments & Checkout - Gateway', color: '#00457C',
    detect: {
      scripts: [/payfast\.co\.za/i, /sandbox\.payfast/i],
      html:    [/payfast/i, /payfast\.co/i],
    },
  },
  {
    name: 'Axis Bank Payment Gateway', category: 'Payments & Checkout - Gateway', color: '#97144D',
    detect: {
      scripts: [/axisbank\.com\/payment/i],
      html:    [/axis.*payment.*gateway/i, /axisbank\.com/i],
    },
  },
  {
    name: 'DirecPay', category: 'Payments & Checkout - Gateway', color: '#1A237E',
    detect: {
      scripts: [/direcpay\.com/i, /timesofmoney\.com/i],
      html:    [/direcpay/i],
    },
  },

  {
    name: 'Recharge', category: 'Subscription', color: '#FF5A5F',
    detect: {
      scripts: [/recharge\.com/i, /rechargepayments\.com/i],
      html:    [/recharge/i, /rechargepayments/i],
    },
  },

  {
    name: 'Next.js', category: 'JavaScript Frameworks', color: '#000000',
    detect: {
      html:    [/__NEXT_DATA__/i, /_next\/static\//i],
      scripts: [/_next\/static\/chunks/i],
      headers: [{ field: 'x-powered-by', rx: /next\.js/i }],
    },
  },
  {
    name: 'Nuxt.js', category: 'JavaScript Frameworks', color: '#42B883',
    detect: {
      html:    [/__NUXT__/i, /_nuxt\//i],
      scripts: [/_nuxt\/static\//i],
      headers: [{ field: 'x-powered-by', rx: /nuxt/i }],
    },
  },
  {
    name: 'React', category: 'JavaScript Frameworks', color: '#61DAFB',
    detect: {
      html:    [/data-reactroot/i, /__REACT_QUERY_STATE__/i],
      scripts: [/react\.production\.min\.js/i, /react-dom\.production/i],
    },
  },
  {
    name: 'Vue.js', category: 'JavaScript Frameworks', color: '#42B883',
    detect: {
      html:    [/data-v-[0-9a-f]+/i, /v-cloak/i],
      scripts: [/vue\.min\.js/i, /vue\.runtime\.min/i],
    },
  },
  {
    name: 'Angular', category: 'JavaScript Frameworks', color: '#DD0031',
    detect: {
      html:    [/ng-version=/i, /ng-app/i],
      scripts: [/angular\.min\.js/i, /angular\.core/i],
    },
  },
  {
    name: 'jQuery', category: 'JavaScript Libraries', color: '#0769AD',
    detect: {
      html:    [/jQuery v\d/i],
      scripts: [/jquery[-.]min\.js/i, /jquery[-.][\d.]+\.min\.js/i, /jquery\.js/i],
    },
  },

  {
    name: 'Svelte', category: 'JavaScript Frameworks', color: '#FF3E00',
    detect: {
      html:    [/svelte-/i, /__svelte/i],
      scripts: [/svelte/i],
    },
  },
  {
    name: 'Gatsby', category: 'JavaScript Frameworks', color: '#663399',
    detect: {
      html:    [/___gatsby/i, /gatsby-/i],
      scripts: [/gatsby/i],
      meta:    [{ name: 'generator', rx: /gatsby/i }],
    },
  },
  {
    name: 'Ember.js', category: 'JavaScript Frameworks', color: '#E04E39',
    detect: {
      html:    [/ember-/i, /data-ember/i],
      scripts: [/ember\.min\.js/i, /ember\.prod/i],
    },
  },
  {
    name: 'Backbone.js', category: 'JavaScript Frameworks', color: '#0071B5',
    detect: {
      scripts: [/backbone[-.]min\.js/i, /backbone\.js/i],
    },
  },
  {
    name: 'Meteor', category: 'JavaScript Frameworks', color: '#DE4F4F',
    detect: {
      html:    [/__meteor_runtime_config__/i],
      scripts: [/meteor\.js/i],
    },
  },
  {
    name: 'Alpine.js', category: 'JavaScript Frameworks', color: '#8BC0D0',
    detect: {
      html:    [/x-data\s*=/i, /x-bind:/i, /x-on:/i],
      scripts: [/alpinejs/i, /alpine\.min\.js/i],
    },
  },
  {
    name: 'Preact', category: 'JavaScript Frameworks', color: '#673AB8',
    detect: {
      scripts: [/preact/i],
      html:    [/preact/i],
    },
  },
  {
    name: 'Lit', category: 'JavaScript Frameworks', color: '#325CFF',
    detect: {
      scripts: [/lit-element/i, /lit-html/i, /@lit\//i],
    },
  },
  {
    name: 'Solid.js', category: 'JavaScript Frameworks', color: '#2C4F7C',
    detect: {
      scripts: [/solid-js/i],
      html:    [/solid-js/i],
    },
  },
  {
    name: 'Qwik', category: 'JavaScript Frameworks', color: '#AC7EF4',
    detect: {
      html:    [/q:container/i, /qwik/i],
      scripts: [/qwik/i],
    },
  },
  {
    name: 'Astro', category: 'JavaScript Frameworks', color: '#FF5D01',
    detect: {
      html:    [/astro-/i],
      meta:    [{ name: 'generator', rx: /astro/i }],
    },
  },
  {
    name: 'Remix', category: 'JavaScript Frameworks', color: '#121212',
    detect: {
      html:    [/__remix/i, /remix-run/i],
      scripts: [/remix/i],
    },
  },
  {
    name: 'SvelteKit', category: 'JavaScript Frameworks', color: '#FF3E00',
    detect: {
      html:    [/sveltekit/i, /__sveltekit/i],
    },
  },
  {
    name: 'AngularJS', category: 'JavaScript Frameworks', color: '#E23237',
    detect: {
      html:    [/ng-app/i, /ng-controller/i, /ng-model/i],
      scripts: [/angular\.min\.js/i, /angular\.js/i],
    },
  },
  {
    name: 'Stimulus', category: 'JavaScript Frameworks', color: '#77E8B9',
    detect: {
      html:    [/data-controller/i, /data-action/i],
      scripts: [/stimulus/i],
    },
  },
  {
    name: 'HTMX', category: 'JavaScript Frameworks', color: '#3366CC',
    detect: {
      html:    [/hx-get/i, /hx-post/i, /hx-trigger/i, /hx-swap/i],
      scripts: [/htmx\.min\.js/i, /htmx\.org/i],
    },
  },
  {
    name: 'Hotwire', category: 'JavaScript Frameworks', color: '#FFE801',
    detect: {
      html:    [/turbo-frame/i, /turbo-stream/i],
      scripts: [/hotwired/i],
    },
  },
  {
    name: 'Turbo', category: 'JavaScript Frameworks', color: '#FFE801',
    detect: {
      html:    [/data-turbo/i],
      scripts: [/turbo\.es.*\.js/i, /@hotwired\/turbo/i],
    },
  },
  {
    name: 'Polymer', category: 'JavaScript Frameworks', color: '#FF4081',
    detect: {
      html:    [/polymer/i, /web-component/i],
      scripts: [/polymer/i, /webcomponents/i],
    },
  },
  {
    name: 'Knockout.js', category: 'JavaScript Frameworks', color: '#B50000',
    detect: {
      html:    [/data-bind\s*=/i],
      scripts: [/knockout[-.]min\.js/i, /knockout\.js/i],
    },
  },
  {
    name: 'Stencil', category: 'JavaScript Frameworks', color: '#4C48FF',
    detect: {
      scripts: [/stencil/i],
      html:    [/stencil-/i],
    },
  },
  {
    name: 'Marko', category: 'JavaScript Frameworks', color: '#00BCD4',
    detect: {
      html:    [/marko/i],
      scripts: [/marko/i],
    },
  },
  {
    name: 'Inferno', category: 'JavaScript Frameworks', color: '#E82F2F',
    detect: {
      scripts: [/inferno[-.]min\.js/i, /inferno\.js/i],
    },
  },
  {
    name: 'Ext JS', category: 'JavaScript Frameworks', color: '#86BC40',
    detect: {
      scripts: [/ext-all\.js/i, /extjs/i, /ext\.min\.js/i],
      html:    [/x-ext-el/i, /ext-viewport/i],
    },
  },
  {
    name: 'Aurelia', category: 'JavaScript Frameworks', color: '#ED2B88',
    detect: {
      scripts: [/aurelia/i],
      html:    [/aurelia-/i],
    },
  },
  {
    name: 'Mithril', category: 'JavaScript Frameworks', color: '#1E5799',
    detect: {
      scripts: [/mithril\.min\.js/i, /mithril\.js/i],
    },
  },
  {
    name: 'Fresh', category: 'JavaScript Frameworks', color: '#FFDB1E',
    detect: {
      html:    [/fresh-/i],
      meta:    [{ name: 'generator', rx: /fresh/i }],
    },
  },

  {
    name: 'Lodash', category: 'JavaScript Libraries', color: '#3492FF',
    detect: {
      scripts: [/lodash\.min\.js/i, /lodash\.js/i, /lodash\.core/i],
    },
  },
  {
    name: 'Underscore.js', category: 'JavaScript Libraries', color: '#0371B5',
    detect: {
      scripts: [/underscore[-.]min\.js/i, /underscore\.js/i],
    },
  },
  {
    name: 'Moment.js', category: 'JavaScript Libraries', color: '#222222',
    detect: {
      scripts: [/moment\.min\.js/i, /moment\.js/i, /moment-with-locales/i],
    },
  },
  {
    name: 'D3.js', category: 'JavaScript Libraries', color: '#F9A03C',
    detect: {
      scripts: [/d3\.min\.js/i, /d3\.v\d/i, /d3js\.org/i],
    },
  },
  {
    name: 'three.js', category: 'JavaScript Libraries', color: '#000000',
    detect: {
      scripts: [/three\.min\.js/i, /three\.module\.js/i, /threejs/i],
    },
  },
  {
    name: 'GSAP', category: 'JavaScript Libraries', color: '#88CE02',
    detect: {
      scripts: [/gsap\.min\.js/i, /gsap/i, /TweenMax/i, /TweenLite/i, /greensock/i],
    },
  },
  {
    name: 'Axios', category: 'JavaScript Libraries', color: '#5A29E4',
    detect: {
      scripts: [/axios\.min\.js/i, /axios/i],
    },
  },
  {
    name: 'Chart.js', category: 'JavaScript Libraries', color: '#FF6384',
    detect: {
      scripts: [/chart\.min\.js/i, /chart\.js/i, /chartjs/i],
    },
  },
  {
    name: 'Anime.js', category: 'JavaScript Libraries', color: '#252423',
    detect: {
      scripts: [/anime\.min\.js/i, /animejs/i],
    },
  },
  {
    name: 'Swiper', category: 'JavaScript Libraries', color: '#6332F6',
    detect: {
      scripts: [/swiper[-.]min\.js/i, /swiper-bundle/i, /cdn\.jsdelivr\.net.*swiper/i],
      html:    [/swiper-container/i, /swiper-wrapper/i, /swiper-slide/i],
    },
  },
  {
    name: 'Slick', category: 'JavaScript Libraries', color: '#222222',
    detect: {
      scripts: [/slick\.min\.js/i, /slick\.js/i],
      html:    [/slick-slider/i, /slick-carousel/i],
    },
  },
  {
    name: 'Fancybox', category: 'JavaScript Libraries', color: '#6E4B98',
    detect: {
      scripts: [/fancybox/i],
      html:    [/fancybox/i],
    },
  },
  {
    name: 'Handlebars', category: 'JavaScript Libraries', color: '#F0772B',
    detect: {
      scripts: [/handlebars\.min\.js/i, /handlebars\.js/i, /handlebars\.runtime/i],
    },
  },
  {
    name: 'Popper.js', category: 'JavaScript Libraries', color: '#C83B50',
    detect: {
      scripts: [/popper\.min\.js/i, /popper\.js/i, /@popperjs/i],
    },
  },
  {
    name: 'core-js', category: 'JavaScript Libraries', color: '#222222',
    detect: {
      scripts: [/core-js/i, /core\.js/i],
    },
  },
  {
    name: 'Modernizr', category: 'JavaScript Libraries', color: '#D81B60',
    detect: {
      scripts: [/modernizr[-.]min\.js/i, /modernizr\.js/i],
      html:    [/modernizr/i],
    },
  },
  {
    name: 'Lottie', category: 'JavaScript Libraries', color: '#00DDB3',
    detect: {
      scripts: [/lottie[-.]min\.js/i, /lottie\.js/i, /lottie-web/i, /bodymovin/i],
    },
  },
  {
    name: 'Lazysizes', category: 'JavaScript Libraries', color: '#222222',
    detect: {
      scripts: [/lazysizes\.min\.js/i, /lazysizes/i],
      html:    [/lazyload/i, /lazysizes/i],
    },
  },
  {
    name: 'Highlight.js', category: 'JavaScript Libraries', color: '#3D556B',
    detect: {
      scripts: [/highlight\.min\.js/i, /highlightjs/i],
      html:    [/hljs/i],
    },
  },
  {
    name: 'Prism', category: 'JavaScript Libraries', color: '#5B00FF',
    detect: {
      scripts: [/prism\.js/i, /prism\.min\.js/i],
      html:    [/language-javascript/i, /language-css/i, /prism-/i],
    },
  },
  {
    name: 'AOS', category: 'JavaScript Libraries', color: '#3F51B5',
    detect: {
      scripts: [/aos\.js/i, /aos\.min\.js/i],
      html:    [/data-aos=/i, /aos-init/i],
    },
  },
  {
    name: 'Typed.js', category: 'JavaScript Libraries', color: '#222222',
    detect: {
      scripts: [/typed\.min\.js/i, /typed\.js/i],
    },
  },
  {
    name: 'Particles.js', category: 'JavaScript Libraries', color: '#222222',
    detect: {
      scripts: [/particles\.min\.js/i, /particles\.js/i, /particlesjs/i],
    },
  },
  {
    name: 'PixiJS', category: 'JavaScript Libraries', color: '#E91E63',
    detect: {
      scripts: [/pixi\.min\.js/i, /pixi\.js/i, /pixijs/i],
    },
  },
  {
    name: 'Flickity', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/flickity/i],
      html:    [/flickity/i],
    },
  },
  {
    name: 'Isotope', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/isotope\.pkgd/i, /isotope\.min/i],
    },
  },
  {
    name: 'Masonry', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/masonry\.pkgd/i, /masonry\.min/i],
    },
  },
  {
    name: 'SweetAlert', category: 'JavaScript Libraries', color: '#F27474',
    detect: {
      scripts: [/sweetalert/i, /sweetalert2/i],
    },
  },
  {
    name: 'Tippy.js', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/tippy/i, /tippy\.min/i],
    },
  },
  {
    name: 'Clipboard.js', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/clipboard\.min\.js/i, /clipboard\.js/i],
    },
  },
  {
    name: 'Dropzone.js', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/dropzone\.min\.js/i, /dropzone\.js/i],
      html:    [/dropzone/i],
    },
  },
  {
    name: 'MathJax', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/mathjax/i, /MathJax\.js/i],
      html:    [/mathjax/i],
    },
  },
  {
    name: 'Socket.io', category: 'JavaScript Libraries', color: '#010101',
    detect: {
      scripts: [/socket\.io/i],
    },
  },
  {
    name: 'RxJS', category: 'JavaScript Libraries', color: '#B7178C',
    detect: {
      scripts: [/rxjs/i, /rx\.min\.js/i],
    },
  },
  {
    name: 'Redux', category: 'JavaScript Libraries', color: '#764ABC',
    detect: {
      scripts: [/redux\.min\.js/i, /redux/i],
      html:    [/__REDUX_STATE__/i, /redux/i],
    },
  },
  {
    name: 'RequireJS', category: 'JavaScript Libraries', color: '#394E79',
    detect: {
      scripts: [/require\.min\.js/i, /require\.js/i, /requirejs/i],
      html:    [/data-requiremodule/i],
    },
  },
  {
    name: 'PDF.js', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/pdf\.min\.js/i, /pdfjs/i, /pdf\.js/i],
    },
  },
  {
    name: 'FullPage.js', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/fullpage\.min\.js/i, /fullpage\.js/i],
      html:    [/fullpage-wrapper/i],
    },
  },
  {
    name: 'ScrollMagic', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/ScrollMagic/i, /scrollmagic/i],
    },
  },
  {
    name: 'Vuex', category: 'JavaScript Libraries', color: '#42B883',
    detect: {
      scripts: [/vuex\.min\.js/i, /vuex/i],
    },
  },
  {
    name: 'Pinia', category: 'JavaScript Libraries', color: '#FFD859',
    detect: {
      scripts: [/pinia/i],
    },
  },
  {
    name: 'Turbolinks', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/turbolinks/i],
      html:    [/turbolinks/i],
    },
  },
  {
    name: 'KaTeX', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/katex\.min\.js/i, /katex/i],
      html:    [/katex/i],
    },
  },
  {
    name: 'Hammer.js', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/hammer\.min\.js/i, /hammerjs/i],
    },
  },
  {
    name: 'Howler.js', category: 'JavaScript Libraries', color: '#333333',
    detect: {
      scripts: [/howler\.min\.js/i, /howler\.js/i],
    },
  },

  {
    name: 'Bootstrap', category: 'UI Frameworks', color: '#7952B3',
    detect: {
      scripts: [/bootstrap\.min\.js/i, /bootstrap\.bundle/i, /bootstrap\.js/i],
      html:    [/bootstrap/i, /class="[^"]*\bcontainer\b[^"]*"/i],
    },
  },
  {
    name: 'Tailwind CSS', category: 'UI Frameworks', color: '#06B6D4',
    detect: {
      html:    [/tailwindcss/i, /class="[^"]*\b(flex|grid|bg-|text-|p-|m-)\b/i],
      scripts: [/tailwind/i],
    },
  },
  {
    name: 'Material UI', category: 'UI Frameworks', color: '#007FFF',
    detect: {
      html:    [/MuiButton/i, /mui-/i, /Mui[A-Z]/i],
      scripts: [/material-ui/i, /@mui/i],
    },
  },
  {
    name: 'Ant Design', category: 'UI Frameworks', color: '#1890FF',
    detect: {
      html:    [/ant-/i, /antd/i],
      scripts: [/antd/i, /ant-design/i],
    },
  },
  {
    name: 'Chakra UI', category: 'UI Frameworks', color: '#319795',
    detect: {
      html:    [/chakra-/i],
      scripts: [/chakra-ui/i],
    },
  },
  {
    name: 'Bulma', category: 'UI Frameworks', color: '#00D1B2',
    detect: {
      html:    [/bulma\.min\.css/i, /bulma\.css/i, /bulma\.io/i],
    },
  },
  {
    name: 'Foundation', category: 'UI Frameworks', color: '#14679E',
    detect: {
      scripts: [/foundation\.min\.js/i, /foundation\.js/i],
      html:    [/foundation/i, /zurb/i],
    },
  },
  {
    name: 'Semantic UI', category: 'UI Frameworks', color: '#35BDB2',
    detect: {
      scripts: [/semantic\.min\.js/i, /semantic-ui/i],
      html:    [/semantic\.min\.css/i, /semantic-ui/i],
    },
  },
  {
    name: 'UIkit', category: 'UI Frameworks', color: '#2396F3',
    detect: {
      scripts: [/uikit\.min\.js/i, /uikit\.js/i],
      html:    [/uikit/i, /uk-/i],
    },
  },
  {
    name: 'Materialize', category: 'UI Frameworks', color: '#EE6E73',
    detect: {
      scripts: [/materialize\.min\.js/i, /materialize\.js/i],
      html:    [/materialize\.min\.css/i],
    },
  },
  {
    name: 'Vuetify', category: 'UI Frameworks', color: '#1867C0',
    detect: {
      scripts: [/vuetify/i],
      html:    [/v-app/i, /vuetify/i],
    },
  },
  {
    name: 'Quasar', category: 'UI Frameworks', color: '#1976D2',
    detect: {
      scripts: [/quasar/i],
      html:    [/q-app/i, /quasar/i],
    },
  },
  {
    name: 'Element UI', category: 'UI Frameworks', color: '#409EFF',
    detect: {
      scripts: [/element-ui/i, /element-plus/i],
      html:    [/el-button/i, /el-form/i, /element-/i],
    },
  },
  {
    name: 'PrimeVue', category: 'UI Frameworks', color: '#41B883',
    detect: {
      scripts: [/primevue/i],
      html:    [/primevue/i],
    },
  },
  {
    name: 'PrimeReact', category: 'UI Frameworks', color: '#61DAFB',
    detect: {
      scripts: [/primereact/i],
      html:    [/primereact/i],
    },
  },
  {
    name: 'PrimeNG', category: 'UI Frameworks', color: '#DD0031',
    detect: {
      scripts: [/primeng/i],
      html:    [/primeng/i],
    },
  },
  {
    name: 'Flowbite', category: 'UI Frameworks', color: '#1C64F2',
    detect: {
      scripts: [/flowbite/i],
      html:    [/flowbite/i],
    },
  },
  {
    name: 'DaisyUI', category: 'UI Frameworks', color: '#1AD1A5',
    detect: {
      html:    [/daisyui/i, /daisy-/i],
    },
  },
  {
    name: 'Mantine', category: 'UI Frameworks', color: '#339AF0',
    detect: {
      scripts: [/mantine/i],
      html:    [/mantine-/i],
    },
  },
  {
    name: 'Fluent UI', category: 'UI Frameworks', color: '#0078D4',
    detect: {
      scripts: [/fluentui/i, /fluent-ui/i],
      html:    [/fluent-/i, /ms-Button/i],
    },
  },
  {
    name: 'Carbon Design System', category: 'UI Frameworks', color: '#161616',
    detect: {
      html:    [/bx--/i, /carbon-/i],
      scripts: [/carbon-components/i],
    },
  },
  {
    name: 'Tachyons', category: 'UI Frameworks', color: '#333333',
    detect: {
      html:    [/tachyons\.min\.css/i, /tachyons\.css/i],
    },
  },
  {
    name: 'Primer CSS', category: 'UI Frameworks', color: '#0366D6',
    detect: {
      html:    [/primer\.css/i, /primer-/i],
    },
  },
  {
    name: 'Shoelace', category: 'UI Frameworks', color: '#4A90D9',
    detect: {
      scripts: [/shoelace/i],
      html:    [/sl-button/i, /sl-dialog/i, /shoelace/i],
    },
  },

  {
    name: 'Yoast SEO', category: 'WordPress Plugins', color: '#A4286A',
    detect: {
      html:    [/yoast-schema-graph/i, /yoast\.com\/schema/i, /yoast_seo/i, /Yoast SEO plugin/i],
    },
  },
  {
    name: 'Rank Math', category: 'WordPress Plugins', color: '#D63638',
    detect: {
      html:    [/rank-math/i, /rankmath/i, /Rank Math/i],
    },
  },
  {
    name: 'Elementor', category: 'WordPress Plugins', color: '#92003B',
    detect: {
      html:    [/elementor/i, /elementor-widget/i],
      scripts: [/elementor/i],
    },
  },
  {
    name: 'WPBakery', category: 'WordPress Plugins', color: '#0073AA',
    detect: {
      html:    [/wpb_/i, /js_composer/i, /vc_row/i],
      scripts: [/js_composer/i],
    },
  },
  {
    name: 'Contact Form 7', category: 'WordPress Plugins', color: '#0073AA',
    detect: {
      html:    [/wpcf7/i, /contact-form-7/i],
      scripts: [/contact-form-7/i],
    },
  },
  {
    name: 'WPForms', category: 'WordPress Plugins', color: '#E27730',
    detect: {
      html:    [/wpforms/i, /wpforms-container/i],
      scripts: [/wpforms/i],
    },
  },
  {
    name: 'Gravity Forms', category: 'WordPress Plugins', color: '#0B1B34',
    detect: {
      html:    [/gform_wrapper/i, /gravityforms/i],
      scripts: [/gravityforms/i],
    },
  },
  {
    name: 'Jetpack', category: 'WordPress Plugins', color: '#00BE28',
    detect: {
      html:    [/jetpack/i, /jetpack-lazy-image/i],
      scripts: [/jetpack/i, /stats\.wp\.com/i],
    },
  },
  {
    name: 'Wordfence', category: 'WordPress Plugins', color: '#4C4C4C',
    detect: {
      html:    [/wordfence/i, /wfacp/i],
    },
  },
  {
    name: 'WP Rocket', category: 'WordPress Plugins', color: '#F56640',
    detect: {
      html:    [/wp-rocket/i, /WP Rocket/i, /rocket-lazyload/i],
    },
  },
  {
    name: 'W3 Total Cache', category: 'WordPress Plugins', color: '#333333',
    detect: {
      html:    [/w3-total-cache/i, /W3 Total Cache/i, /w3tc/i],
    },
  },
  {
    name: 'LiteSpeed Cache', category: 'WordPress Plugins', color: '#333333',
    detect: {
      html:    [/litespeed-cache/i, /LiteSpeed Cache/i],
      headers: [{ field: 'x-litespeed-cache', rx: /./ }],
    },
  },
  {
    name: 'Autoptimize', category: 'WordPress Plugins', color: '#333333',
    detect: {
      html:    [/autoptimize/i, /Autoptimize/i],
    },
  },
  {
    name: 'MonsterInsights', category: 'WordPress Plugins', color: '#5FB929',
    detect: {
      html:    [/monsterinsights/i, /MonsterInsights/i],
      scripts: [/monsterinsights/i],
    },
  },
  {
    name: 'OptinMonster', category: 'WordPress Plugins', color: '#6CC04A',
    detect: {
      scripts: [/optinmonster/i, /a\.optmstr\.com/i],
      html:    [/optinmonster/i, /OptinMonster/i],
    },
  },
  {
    name: 'Advanced Custom Fields', category: 'WordPress Plugins', color: '#00E4BC',
    detect: {
      html:    [/acf-/i, /advanced-custom-fields/i],
    },
  },
  {
    name: 'WPML', category: 'WordPress Plugins', color: '#2AC1DF',
    detect: {
      html:    [/wpml/i, /sitepress/i],
      scripts: [/wpml/i],
    },
  },
  {
    name: 'Polylang', category: 'WordPress Plugins', color: '#347DBE',
    detect: {
      html:    [/polylang/i],
    },
  },
  {
    name: 'Weglot', category: 'WordPress Plugins', color: '#2F4858',
    detect: {
      scripts: [/weglot/i, /cdn\.weglot\.com/i],
      html:    [/weglot/i],
    },
  },
  {
    name: 'Beaver Builder', category: 'WordPress Plugins', color: '#2271B1',
    detect: {
      html:    [/fl-builder/i, /beaver-builder/i],
      scripts: [/fl-builder/i],
    },
  },
  {
    name: 'Divi Builder', category: 'WordPress Plugins', color: '#7C3AED',
    detect: {
      html:    [/et_pb_/i, /et-boc/i, /divi/i],
      scripts: [/divi/i, /et-core/i],
    },
  },
  {
    name: 'All in One SEO', category: 'WordPress Plugins', color: '#005AE0',
    detect: {
      html:    [/aioseo/i, /all-in-one-seo/i],
    },
  },
  {
    name: 'PixelYourSite', category: 'WordPress Plugins', color: '#3B5998',
    detect: {
      html:    [/pixelyoursite/i, /pys_/i],
      scripts: [/pixelyoursite/i],
    },
  },
  {
    name: 'WP Super Cache', category: 'WordPress Plugins', color: '#333333',
    detect: {
      html:    [/wp-super-cache/i, /WP Super Cache/i, /supercache/i],
    },
  },
  {
    name: 'Smush', category: 'WordPress Plugins', color: '#333333',
    detect: {
      html:    [/wp-smush/i, /smush-lazy/i],
    },
  },

  {
    name: 'Bazaarvoice', category: 'Reviews', color: '#003B5C',
    detect: {
      scripts: [/bazaarvoice\.com/i, /display\.ugc\.bazaarvoice/i],
      html:    [/bazaarvoice/i, /bv-/i],
    },
  },
  {
    name: 'PowerReviews', category: 'Reviews', color: '#000000',
    detect: {
      scripts: [/powerreviews\.com/i],
      html:    [/powerreviews/i],
    },
  },
  {
    name: 'Stamped.io', category: 'Reviews', color: '#6366F1',
    detect: {
      scripts: [/stamped\.io/i, /cdn1\.stamped\.io/i],
      html:    [/stamped-/i, /stamped\.io/i],
    },
  },
  {
    name: 'Reviews.io', category: 'Reviews', color: '#5E2BFF',
    detect: {
      scripts: [/reviews\.io/i, /widget\.reviews\.io/i],
      html:    [/reviews\.io/i],
    },
  },
  {
    name: 'Loox', category: 'Reviews', color: '#FF6B35',
    detect: {
      scripts: [/loox\.io/i],
      html:    [/loox/i],
    },
  },
  {
    name: 'Shopper Approved', category: 'Reviews', color: '#F7941E',
    detect: {
      scripts: [/shopperapproved\.com/i],
      html:    [/shopperapproved/i],
    },
  },
  {
    name: 'Feefo', category: 'Reviews', color: '#2D5F8A',
    detect: {
      scripts: [/feefo\.com/i],
      html:    [/feefo/i],
    },
  },
  {
    name: 'Trusted Shops', category: 'Reviews', color: '#FFDC0F',
    detect: {
      scripts: [/trustedshops\.com/i, /widgets\.trustedshops/i],
      html:    [/trustedshops/i, /trusted-shops/i],
    },
  },
  {
    name: 'Birdeye', category: 'Reviews', color: '#0070F0',
    detect: {
      scripts: [/birdeye\.com/i],
      html:    [/birdeye/i],
    },
  },
  {
    name: 'Fera.ai', category: 'Reviews', color: '#6C63FF',
    detect: {
      scripts: [/fera\.ai/i, /cdn\.fera\.ai/i],
      html:    [/fera-widget/i, /fera\.ai/i],
    },
  },
  {
    name: 'Junip', category: 'Reviews', color: '#6741D9',
    detect: {
      scripts: [/junip\.co/i],
      html:    [/junip/i],
    },
  },

  {
    name: 'Zinrelo', category: 'Loyalty & Rewards', color: '#4A90D9',
    detect: {
      scripts: [/zinrelo\.com/i],
      html:    [/zinrelo/i],
    },
  },
  {
    name: 'Antavo', category: 'Loyalty & Rewards', color: '#FF5A00',
    detect: {
      scripts: [/antavo\.com/i],
      html:    [/antavo/i],
    },
  },
  {
    name: 'BON Loyalty', category: 'Loyalty & Rewards', color: '#FF6B35',
    detect: {
      scripts: [/bonloyalty/i, /bon-loyalty/i],
      html:    [/bon-loyalty/i],
    },
  },
  {
    name: 'ReferralCandy', category: 'Loyalty & Rewards', color: '#38B2AC',
    detect: {
      scripts: [/referralcandy\.com/i],
      html:    [/referralcandy/i],
    },
  },
  {
    name: 'Yotpo Loyalty', category: 'Loyalty & Rewards', color: '#1C1C1C',
    detect: {
      scripts: [/loyalty\.yotpo\.com/i],
      html:    [/yotpo-loyalty/i],
    },
  },
  {
    name: 'Growave', category: 'Loyalty & Rewards', color: '#6C63FF',
    detect: {
      scripts: [/growave\.io/i],
      html:    [/growave/i],
    },
  },
  {
    name: 'Marsello', category: 'Loyalty & Rewards', color: '#FF5A5F',
    detect: {
      scripts: [/marsello\.com/i],
      html:    [/marsello/i],
    },
  },
  {
    name: 'Rise.ai', category: 'Loyalty & Rewards', color: '#6C63FF',
    detect: {
      scripts: [/rise-ai\.com/i, /rise\.ai/i, /cdn\.rise-ai/i],
      html:    [/rise-ai/i, /rise\.ai/i],
    },
  },
  {
    name: 'Joy Loyalty', category: 'Loyalty & Rewards', color: '#FF9800',
    detect: {
      scripts: [/joy\.ac/i, /joy-loyalty/i],
      html:    [/joy-loyalty/i, /joy\.ac/i],
    },
  },
  {
    name: 'Loyalty Gator', category: 'Loyalty & Rewards', color: '#4CAF50',
    detect: {
      scripts: [/loyaltygator\.com/i],
      html:    [/loyaltygator/i, /loyalty-gator/i],
    },
  },
  {
    name: 'Open Loyalty', category: 'Loyalty & Rewards', color: '#0066FF',
    detect: {
      scripts: [/openloyalty\.io/i],
      html:    [/openloyalty/i, /open-loyalty/i],
    },
  },
  {
    name: 'Kangaroo Rewards', category: 'Loyalty & Rewards', color: '#FF5722',
    detect: {
      scripts: [/kangaroorewards\.com/i],
      html:    [/kangaroorewards/i, /kangaroo-rewards/i],
    },
  },
  {
    name: 'Talon.One', category: 'Loyalty & Rewards', color: '#6200EA',
    detect: {
      scripts: [/talon\.one/i, /talonone\.com/i],
      html:    [/talon\.one/i, /talonone/i],
    },
  },
  {
    name: 'Annex Cloud', category: 'Loyalty & Rewards', color: '#1A73E8',
    detect: {
      scripts: [/annexcloud\.com/i],
      html:    [/annexcloud/i, /annex-cloud/i],
    },
  },
  {
    name: 'WPLoyalty', category: 'Loyalty & Rewards', color: '#7B1FA2',
    detect: {
      scripts: [/wployalty\.net/i],
      html:    [/wployalty/i, /wp-loyalty/i],
    },
  },
  {
    name: 'Grprogram', category: 'Loyalty & Rewards', color: '#FF6D00',
    detect: {
      scripts: [/grprogram\.com/i],
      html:    [/grprogram/i],
    },
  },

  {
    name: 'Zip', category: 'Buy Now Pay Later', color: '#AA8FFF',
    detect: {
      scripts: [/zip\.co/i, /quadpay/i],
      html:    [/zip\.co/i, /quadpay/i],
    },
  },
  {
    name: 'Splitit', category: 'Buy Now Pay Later', color: '#00A651',
    detect: {
      scripts: [/splitit\.com/i],
      html:    [/splitit/i],
    },
  },
  {
    name: 'Scalapay', category: 'Buy Now Pay Later', color: '#00D4AA',
    detect: {
      scripts: [/scalapay\.com/i],
      html:    [/scalapay/i],
    },
  },
  {
    name: 'Clearpay', category: 'Buy Now Pay Later', color: '#B2FCE4',
    detect: {
      scripts: [/clearpay/i],
      html:    [/clearpay/i],
    },
  },
  {
    name: 'Alma', category: 'Buy Now Pay Later', color: '#FA5022',
    detect: {
      scripts: [/cdn\.almapay\.com/i, /alma\.eu/i],
      html:    [/alma-widget/i, /almapay/i],
    },
  },
  {
    name: 'Tabby', category: 'Buy Now Pay Later', color: '#3BFFA0',
    detect: {
      scripts: [/tabby\.ai/i, /checkout\.tabby/i],
      html:    [/tabby/i],
    },
  },
  {
    name: 'Tamara', category: 'Buy Now Pay Later', color: '#2F2370',
    detect: {
      scripts: [/tamara\.co/i, /cdn\.tamara\.co/i],
      html:    [/tamara/i],
    },
  },
  {
    name: 'Atome', category: 'Buy Now Pay Later', color: '#00D4AA',
    detect: {
      scripts: [/atome\.sg/i, /atome\.my/i],
      html:    [/atome/i],
    },
  },
  {
    name: 'Laybuy', category: 'Buy Now Pay Later', color: '#7B5DC5',
    detect: {
      scripts: [/laybuy\.com/i],
      html:    [/laybuy/i],
    },
  },
  {
    name: 'Kredivo', category: 'Buy Now Pay Later', color: '#F47920',
    detect: {
      scripts: [/kredivo\.com/i],
      html:    [/kredivo/i],
    },
  },

  {
    name: 'Privy', category: 'Shopify Apps', color: '#242B59',
    detect: {
      scripts: [/privy\.com/i, /widget\.privy\.com/i],
      html:    [/privy/i],
    },
  },
  {
    name: 'Justuno', category: 'Shopify Apps', color: '#00C2E0',
    detect: {
      scripts: [/justuno\.com/i],
      html:    [/justuno/i],
    },
  },
  {
    name: 'OptiMonk', category: 'Shopify Apps', color: '#6236FF',
    detect: {
      scripts: [/optimonk\.com/i],
      html:    [/optimonk/i],
    },
  },
  {
    name: 'PushOwl', category: 'Shopify Apps', color: '#FF7A00',
    detect: {
      scripts: [/pushowl\.com/i, /cdn\.pushowl/i],
      html:    [/pushowl/i],
    },
  },
  {
    name: 'ReConvert', category: 'Shopify Apps', color: '#5C6AC4',
    detect: {
      scripts: [/reconvert/i],
      html:    [/reconvert/i],
    },
  },
  {
    name: 'PageFly', category: 'Shopify Apps', color: '#006CFF',
    detect: {
      html:    [/pagefly/i, /pf-/i],
      scripts: [/pagefly/i],
    },
  },
  {
    name: 'Shogun', category: 'Shopify Apps', color: '#6C63FF',
    detect: {
      scripts: [/getshogun\.com/i, /lib\.getshogun/i],
      html:    [/shogun/i, /getshogun/i],
    },
  },
  {
    name: 'GemPages', category: 'Shopify Apps', color: '#5551FF',
    detect: {
      scripts: [/gempages\.net/i],
      html:    [/gempages/i],
    },
  },
  {
    name: 'Bold Commerce', category: 'Shopify Apps', color: '#000000',
    detect: {
      scripts: [/boldcommerce\.com/i, /boldapps\.net/i],
      html:    [/boldcommerce/i, /bold-/i],
    },
  },
  {
    name: 'ShipStation', category: 'Shopify Apps', color: '#00B36C',
    detect: {
      html:    [/shipstation/i],
    },
  },
  {
    name: 'Narvar', category: 'Shopify Apps', color: '#00A5D1',
    detect: {
      scripts: [/narvar\.com/i],
      html:    [/narvar/i],
    },
  },
  {
    name: 'Vitals', category: 'Shopify Apps', color: '#5C6AC4',
    detect: {
      scripts: [/vitals\.co/i],
      html:    [/vitals-/i],
    },
  },

  {
    name: 'Cloudflare', category: 'CDN & Infrastructure', color: '#F48120',
    detect: {
      headers: [
        { field: 'cf-ray', rx: /./ },
        { field: 'cf-cache-status', rx: /./ },
        { field: 'server', rx: /cloudflare/i },
      ],
    },
  },
  {
    name: 'Fastly', category: 'CDN & Infrastructure', color: '#FF282D',
    detect: {
      headers: [
        { field: 'x-served-by', rx: /cache-/i },
        { field: 'x-fastly-request-id', rx: /./ },
      ],
    },
  },
  {
    name: 'AWS CloudFront', category: 'CDN & Infrastructure', color: '#FF9900',
    detect: {
      headers: [{ field: 'x-amz-cf-id', rx: /./ }],
    },
  },
  {
    name: 'Akamai', category: 'CDN & Infrastructure', color: '#009FDA',
    detect: {
      headers: [{ field: 'x-akamai-transformed', rx: /./ }, { field: 'server', rx: /akamai/i }],
    },
  },
  {
    name: 'KeyCDN', category: 'CDN & Infrastructure', color: '#047AED',
    detect: {
      headers: [{ field: 'server', rx: /keycdn/i }],
    },
  },
  {
    name: 'Bunny CDN', category: 'CDN & Infrastructure', color: '#F6A623',
    detect: {
      headers: [{ field: 'server', rx: /bunnycdn/i }, { field: 'cdn-pullzone', rx: /./ }],
    },
  },
  {
    name: 'Sucuri', category: 'CDN & Infrastructure', color: '#49A84D',
    detect: {
      headers: [{ field: 'x-sucuri-id', rx: /./ }, { field: 'server', rx: /sucuri/i }],
    },
  },
  {
    name: 'Netlify', category: 'CDN & Infrastructure', color: '#00C7B7',
    detect: {
      headers: [{ field: 'server', rx: /netlify/i }, { field: 'x-nf-request-id', rx: /./ }],
    },
  },
  {
    name: 'Vercel', category: 'CDN & Infrastructure', color: '#000000',
    detect: {
      headers: [{ field: 'server', rx: /vercel/i }, { field: 'x-vercel-id', rx: /./ }],
    },
  },

  {
    name: 'Nginx', category: 'Web Servers & Runtime', color: '#009900',
    detect: {
      headers: [{ field: 'server', rx: /nginx/i }],
    },
  },
  {
    name: 'Apache', category: 'Web Servers & Runtime', color: '#D42029',
    detect: {
      headers: [{ field: 'server', rx: /apache/i }],
    },
  },
  {
    name: 'Node.js', category: 'Web Servers & Runtime', color: '#8CC84B',
    detect: {
      headers: [{ field: 'x-powered-by', rx: /express/i }],
    },
  },
  {
    name: 'LiteSpeed', category: 'Web Servers & Runtime', color: '#333333',
    detect: {
      headers: [{ field: 'server', rx: /litespeed/i }],
    },
  },
  {
    name: 'IIS', category: 'Web Servers & Runtime', color: '#0078D4',
    detect: {
      headers: [{ field: 'server', rx: /microsoft-iis/i }],
    },
  },
  {
    name: 'Caddy', category: 'Web Servers & Runtime', color: '#00ADD8',
    detect: {
      headers: [{ field: 'server', rx: /caddy/i }],
    },
  },
  {
    name: 'OpenResty', category: 'Web Servers & Runtime', color: '#333333',
    detect: {
      headers: [{ field: 'server', rx: /openresty/i }],
    },
  },

  {
    name: 'Google Ads', category: 'Advertising', color: '#4285F4',
    detect: {
      html:    [/googleads\.g\.doubleclick\.net/i, /google_ads_iframe/i, /google_conversion_id/i, /google_remarketing/i],
      scripts: [/pagead2\.googlesyndication\.com/i, /googleadservices\.com\/pagead/i, /adservice\.google\.com/i],
    },
  },
  {
    name: 'Google AdSense', category: 'Advertising', color: '#4285F4',
    detect: {
      html:    [/data-ad-client="ca-pub-/i, /adsbygoogle/i, /google_ad_client/i],
      scripts: [/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle/i],
    },
  },
  {
    name: 'Google Ad Manager', category: 'Advertising', color: '#34A853',
    detect: {
      html:    [/googletag\.defineSlot/i, /googletag\.pubads/i, /gpt\.js/i],
      scripts: [/securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/i, /googletagservices\.com\/tag/i],
    },
  },
  {
    name: 'DoubleClick', category: 'Advertising', color: '#4285F4',
    detect: {
      html:    [/doubleclick\.net/i, /dcm_conversion/i],
      scripts: [/ad\.doubleclick\.net/i, /fls\.doubleclick\.net/i, /stats\.g\.doubleclick\.net/i],
    },
  },
  {
    name: 'Facebook Ads', category: 'Advertising', color: '#1877F2',
    detect: {
      html:    [/fbads/i, /fb-ad/i, /data-facebook-ad/i],
      scripts: [/connect\.facebook\.net.*fbevents/i, /facebook\.com\/tr\?/i],
    },
  },
  {
    name: 'Criteo', category: 'Advertising', color: '#F47920',
    detect: {
      html:    [/criteo\.com/i, /criteo_q/i, /window\.criteo_q/i],
      scripts: [/static\.criteo\.net/i, /dynamic\.criteo\.com/i, /dis\.criteo\.com/i],
    },
  },
  {
    name: 'Taboola', category: 'Advertising', color: '#0040FF',
    detect: {
      html:    [/taboola/i, /window\._taboola/i, /tbl:container/i, /tblci/i],
      scripts: [/cdn\.taboola\.com/i, /trc\.taboola\.com/i],
    },
  },
  {
    name: 'Outbrain', category: 'Advertising', color: '#FF5722',
    detect: {
      html:    [/outbrain/i, /ob-widget/i, /OUTBRAIN/],
      scripts: [/widgets\.outbrain\.com/i, /outbrain\.com\/outbrain\.js/i],
    },
  },
  {
    name: 'Amazon Advertising', category: 'Advertising', color: '#FF9900',
    detect: {
      html:    [/amazon-adsystem\.com/i, /amzn_ads_/i],
      scripts: [/amazon-adsystem\.com/i, /c\.amazon-adsystem\.com/i],
    },
  },
  {
    name: 'Microsoft Advertising', category: 'Advertising', color: '#00A4EF',
    detect: {
      html:    [/bat\.bing\.com/i, /UET\s*tag/i, /uetq/i],
      scripts: [/bat\.bing\.com\/bat\.js/i],
    },
  },
  {
    name: 'AdRoll', category: 'Advertising', color: '#0DBDFF',
    detect: {
      html:    [/adroll\.com/i, /adroll_adv_id/i, /\_adroll/i],
      scripts: [/s\.adroll\.com/i, /d\.adroll\.com/i],
    },
  },
  {
    name: 'The Trade Desk', category: 'Advertising', color: '#2196F3',
    detect: {
      html:    [/thetradedesk\.com/i, /ttd_dom_id/i],
      scripts: [/js\.adsrvr\.org/i, /match\.adsrvr\.org/i],
    },
  },
  {
    name: 'MediaMath', category: 'Advertising', color: '#E91E63',
    detect: {
      scripts: [/pixel\.mathtag\.com/i, /mathid\.mathtag\.com/i],
      html:    [/mathtag\.com/i],
    },
  },
  {
    name: 'Mediavine', category: 'Advertising', color: '#1DD882',
    detect: {
      scripts: [/scripts\.mediavine\.com/i, /mediavine\.com\/wp-adv-ads/i],
      html:    [/mediavine/i, /mv-ad-box/i],
    },
  },
  {
    name: 'Ezoic', category: 'Advertising', color: '#009688',
    detect: {
      scripts: [/ezoic\.net/i, /ezodn\.com/i, /ezojs\.com/i],
      html:    [/ezoic/i, /ez-toc/i],
    },
  },
  {
    name: 'Carbon Ads', category: 'Advertising', color: '#111111',
    detect: {
      scripts: [/cdn\.carbonads\.com/i, /srv\.carbonads\.net/i],
      html:    [/carbonads/i, /_carbonads_/i],
    },
  },
  {
    name: 'Inmobi', category: 'Advertising', color: '#1C3E6E',
    detect: {
      scripts: [/inmobi\.com/i, /cf\.cdn\.inmobi\.com/i],
      html:    [/inmobi/i],
    },
  },

  {
    name: 'Google Remarketing', category: 'Retargeting', color: '#4285F4',
    detect: {
      html:    [/google_remarketing/i, /googleads\.g\.doubleclick\.net\/pagead\/viewthroughconversion/i, /google_conversion_id/i],
      scripts: [/googleadservices\.com\/pagead\/conversion_async/i, /www\.googleadservices\.com\/pagead\/conversion/i],
    },
  },
  {
    name: 'Facebook Retargeting', category: 'Retargeting', color: '#1877F2',
    detect: {
      html:    [/facebook\.com\/tr\?/i, /fbq\(\s*['"]track['"]/i, /fbevents\.js/i],
      scripts: [/connect\.facebook\.net.*fbevents/i],
    },
  },
  {
    name: 'Criteo Retargeting', category: 'Retargeting', color: '#F47920',
    detect: {
      html:    [/criteo_q\.push/i, /sslwidget\.criteo\.com/i],
      scripts: [/static\.criteo\.net\/js/i, /dis\.criteo\.com/i],
    },
  },
  {
    name: 'RTB House', category: 'Retargeting', color: '#FF5722',
    detect: {
      scripts: [/creativecdn\.com\/tags/i, /rtbhouse\.com/i],
      html:    [/rtbhouse/i, /creativecdn\.com/i],
    },
  },
  {
    name: 'Nosto', category: 'Retargeting', color: '#39B34A',
    detect: {
      scripts: [/connect\.nosto\.com/i, /nosto\.com/i],
      html:    [/nosto/i, /nostojs/i],
    },
  },
  {
    name: 'SaleCycle', category: 'Retargeting', color: '#00BCD4',
    detect: {
      scripts: [/d16fk4ms6rqz1v\.cloudfront\.net/i, /salecycle\.com/i],
      html:    [/salecycle/i],
    },
  },
  {
    name: 'Barilliance', category: 'Retargeting', color: '#FF6600',
    detect: {
      scripts: [/barilliance\.com/i, /cdn\.barilliance\.com/i],
      html:    [/barilliance/i],
    },
  },
  {
    name: 'Fresh Relevance', category: 'Retargeting', color: '#00B8D9',
    detect: {
      scripts: [/freshrelevance\.com/i, /d81mfvml4h65u\.cloudfront\.net/i],
      html:    [/freshrelevance/i],
    },
  },

  {
    name: 'Yoast SEO', category: 'SEO', color: '#A4286A',
    detect: {
      html:    [/yoast-schema-graph/i, /yoast\.com\/schema/i, /yoast\.com/i, /yoast-seo/i, /This site is optimized with the Yoast/i],
      meta:    [{ name: 'generator', rx: /yoast seo/i }],
    },
  },
  {
    name: 'Rank Math', category: 'SEO', color: '#E73651',
    detect: {
      html:    [/rank-math/i, /rankmath/i, /rank math/i],
      meta:    [{ name: 'generator', rx: /rank math/i }],
    },
  },
  {
    name: 'All in One SEO', category: 'SEO', color: '#005AE0',
    detect: {
      html:    [/aioseo/i, /all-in-one-seo-pack/i, /all in one seo/i],
      meta:    [{ name: 'generator', rx: /all in one seo/i }],
    },
  },
  {
    name: 'SEOPress', category: 'SEO', color: '#029EE5',
    detect: {
      html:    [/seopress/i, /wp-seopress/i],
      meta:    [{ name: 'generator', rx: /seopress/i }],
    },
  },
  {
    name: 'Schema Pro', category: 'SEO', color: '#0073AA',
    detect: {
      html:    [/wp-schema-pro/i, /schema-pro/i],
      scripts: [/schema-pro/i],
    },
  },
  {
    name: 'JSON-LD Schema', category: 'SEO', color: '#333333',
    detect: {
      html:    [/<script\s+type=["']application\/ld\+json["']/i],
    },
  },
  {
    name: 'Open Graph', category: 'SEO', color: '#3B5998',
    detect: {
      html:    [/<meta\s+property=["']og:/i],
    },
  },
  {
    name: 'Twitter Cards', category: 'SEO', color: '#1DA1F2',
    detect: {
      html:    [/<meta\s+name=["']twitter:card/i, /<meta\s+name=["']twitter:site/i],
    },
  },
  {
    name: 'Google Search Console', category: 'SEO', color: '#4285F4',
    detect: {
      html:    [/google-site-verification/i],
      meta:    [{ name: 'google-site-verification', rx: /./ }],
    },
  },
  {
    name: 'Bing Webmaster', category: 'SEO', color: '#00A4EF',
    detect: {
      meta:    [{ name: 'msvalidate.01', rx: /./ }],
    },
  },
  {
    name: 'IndexNow', category: 'SEO', color: '#5E35B1',
    detect: {
      html:    [/indexnow\.org/i, /IndexNow/],
    },
  },

  {
    name: 'Google Optimize', category: 'A/B Testing', color: '#4285F4',
    detect: {
      html:    [/googleoptimize\.com/i, /optimize\.google\.com/i, /gtag.*optimize/i],
      scripts: [/googleoptimize\.com\/optimize\.js/i],
    },
  },
  {
    name: 'LaunchDarkly', category: 'A/B Testing', color: '#3DD6F5',
    detect: {
      scripts: [/launchdarkly\.com/i, /app\.launchdarkly\.com/i],
      html:    [/launchdarkly/i, /ld-client/i],
    },
  },
  {
    name: 'Adobe Target', category: 'A/B Testing', color: '#FF0000',
    detect: {
      scripts: [/tt\.omtrdc\.net/i, /mbox\.js/i, /at\.js/i],
      html:    [/mboxCreate\b/i, /adobe\.target/i, /omtrdc\.net/i],
    },
  },
  {
    name: 'Split.io', category: 'A/B Testing', color: '#5B45AE',
    detect: {
      scripts: [/cdn\.split\.io/i, /split\.io/i],
      html:    [/split\.io/i, /splitio/i],
    },
  },
  {
    name: 'Statsig', category: 'A/B Testing', color: '#194B7D',
    detect: {
      scripts: [/statsig\.com/i, /cdn\.statsig\.com/i],
      html:    [/statsig/i],
    },
  },
  {
    name: 'GrowthBook', category: 'A/B Testing', color: '#56B68B',
    detect: {
      scripts: [/growthbook/i, /cdn\.growthbook\.io/i],
      html:    [/growthbook/i],
    },
  },

  {
    name: 'CartStack', category: 'Cart abandonment', color: '#FF6B35',
    detect: {
      scripts: [/cartstack\.com/i, /cdn\.cartstack\.com/i],
      html:    [/cartstack/i],
    },
  },
  {
    name: 'Privy', category: 'Cart abandonment', color: '#5B2EFF',
    detect: {
      scripts: [/privy\.com/i, /widget\.privy\.com/i, /dashboard\.privy\.com/i],
      html:    [/privy/i, /privy-popup/i],
    },
  },
  {
    name: 'Justuno', category: 'Cart abandonment', color: '#F15A24',
    detect: {
      scripts: [/justuno\.com/i, /cdn\.justuno\.com/i],
      html:    [/justuno/i],
    },
  },
  {
    name: 'OptiMonk', category: 'Cart abandonment', color: '#00C48C',
    detect: {
      scripts: [/optimonk\.com/i, /front\.optimonk\.com/i],
      html:    [/optimonk/i, /OptiMonk/],
    },
  },
  {
    name: 'Recart', category: 'Cart abandonment', color: '#0084FF',
    detect: {
      scripts: [/recart\.com/i, /cdn\.recart\.com/i],
      html:    [/recart/i],
    },
  },
  {
    name: 'PushOwl', category: 'Cart abandonment', color: '#F7941D',
    detect: {
      scripts: [/pushowl\.com/i, /cdn\.pushowl\.com/i],
      html:    [/pushowl/i],
    },
  },

  {
    name: 'Autopilot', category: 'Marketing automation', color: '#6B3FA0',
    detect: {
      scripts: [/autopilothq\.com/i, /api\.autopilothq\.com/i],
      html:    [/autopilothq/i, /Autopilot/],
    },
  },
  {
    name: 'Intercom Marketing', category: 'Marketing automation', color: '#1F8DED',
    detect: {
      html:    [/intercom-container/i, /intercom-messenger/i, /Intercom\(/i],
      scripts: [/widget\.intercom\.io/i, /js\.intercomcdn\.com/i],
    },
  },
  {
    name: 'Drift', category: 'Marketing automation', color: '#0176FF',
    detect: {
      scripts: [/js\.driftt\.com/i, /drift\.com/i],
      html:    [/drift-frame/i, /drift-widget/i, /driftt\.com/i],
    },
  },
  {
    name: 'Freshmarketer', category: 'Marketing automation', color: '#F15A2D',
    detect: {
      scripts: [/freshmarketer\.com/i, /cdn\.freshmarketer\.com/i],
      html:    [/freshmarketer/i],
    },
  },
  {
    name: 'SharpSpring', category: 'Marketing automation', color: '#68BD45',
    detect: {
      scripts: [/sharpspring\.com/i, /app-.*\.sharpspring\.com/i],
      html:    [/sharpspring/i, /SharpSpring/],
    },
  },
  {
    name: 'Keap', category: 'Marketing automation', color: '#2CDE80',
    detect: {
      scripts: [/keap\.com/i, /infusionsoft\.com/i, /app\.infusionsoft\.com/i],
      html:    [/infusionsoft/i, /keap/i],
    },
  },
  {
    name: 'Sendinblue', category: 'Marketing automation', color: '#0092FF',
    detect: {
      scripts: [/sendinblue\.com/i, /sibautomation\.com/i, /sibforms\.com/i],
      html:    [/sendinblue/i, /sib-form/i],
    },
  },

  {
    name: 'Klaviyo', category: 'Marketing automation', color: '#00C58E',
    detect: {
      scripts: [/static\.klaviyo\.com/i, /fast\.a\.klaviyo\.com/i],
      html:    [/_learnq\b/i, /klaviyo/i],
    },
  },
  {
    name: 'Mailchimp', category: 'Marketing automation', color: '#FFE01B',
    detect: {
      scripts: [/chimpstatic\.com/i],
      html:    [/list-manage\.com/i, /mailchimp/i, /mc\.js/i],
    },
  },
  {
    name: 'HubSpot', category: 'Marketing automation', color: '#FF7A59',
    detect: {
      scripts: [/js\.hs-scripts\.com/i, /js\.hs-analytics\.net/i, /js\.hubspot\.com/i],
      html:    [/hs-analytics/i, /hubspot/i, /_hsp/i],
    },
  },
  {
    name: 'ActiveCampaign', category: 'Marketing automation', color: '#356AE6',
    detect: {
      scripts: [/trackcmp\.net/i],
      html:    [/activecampaign\.com/i, /vgo\(/i],
    },
  },
  {
    name: 'Moengage', category: 'Marketing automation', color: '#00C853',
    detect: {
      scripts: [/cdn\.moengage\.com/i, /app\.moengage\.com/i, /sdk\.moengage\.com/i],
      html:    [/moengage/i, /Moengage\b/i, /moe\(/i],
    },
  },
  {
    name: 'WebEngage', category: 'Marketing automation', color: '#E84C3D',
    detect: {
      scripts: [/webengage\.com/i, /cdn\.webengage\.com/i, /widgets\.webengage\.com/i],
      html:    [/webengage/i, /_weq/i, /webengage\.init\b/i],
    },
  },
  {
    name: 'CleverTap', category: 'Marketing automation', color: '#E85E2B',
    detect: {
      scripts: [/d2r1yp2w7bby2u\.cloudfront\.net/i, /clevertap\.com/i, /clevertap-prod\.com/i],
      html:    [/clevertap/i, /WizRocket/i, /clevertap\.init\b/i],
    },
  },
  {
    name: 'Braze', category: 'Marketing automation', color: '#00B2A9',
    detect: {
      scripts: [/js\.appboycdn\.com/i, /sdk\.iad-\d+\.braze\.com/i, /braze\.com/i],
      html:    [/appboy/i, /braze/i, /appboy\.initialize\b/i],
    },
  },
  {
    name: 'OneSignal', category: 'Marketing automation', color: '#E54B4D',
    detect: {
      scripts: [/cdn\.onesignal\.com/i, /onesignal\.com/i],
      html:    [/OneSignal/i, /onesignal/i],
    },
  },
  {
    name: 'Omnisend', category: 'Marketing automation', color: '#1A1A1A',
    detect: {
      scripts: [/omnisrc\.com/i, /omnisend\.com/i],
      html:    [/omnisend/i],
    },
  },
  {
    name: 'SendGrid', category: 'Marketing automation', color: '#1A82E2',
    detect: {
      scripts: [/cdn\.sendgrid\.com/i],
      html:    [/sendgrid/i, /sendgrid\.net/i],
    },
  },
  {
    name: 'Drip', category: 'Marketing automation', color: '#684DFF',
    detect: {
      scripts: [/tag\.getdrip\.com/i, /api\.getdrip\.com/i],
      html:    [/getdrip\.com/i, /dc\.js/i],
    },
  },
  {
    name: 'ConvertKit', category: 'Marketing automation', color: '#FB6970',
    detect: {
      scripts: [/f\.convertkit\.com/i, /convertkit\.com/i],
      html:    [/convertkit/i, /ck\.page/i],
    },
  },
  {
    name: 'Iterable', category: 'Marketing automation', color: '#6236FF',
    detect: {
      scripts: [/js\.iterable\.com/i, /api\.iterable\.com/i],
      html:    [/iterable/i],
    },
  },
  {
    name: 'Customer.io', category: 'Marketing automation', color: '#FFB74D',
    detect: {
      scripts: [/assets\.customer\.io/i, /track\.customer\.io/i, /customerioforms/i],
      html:    [/customer\.io/i, /customerio/i, /_cio\b/i],
    },
  },
  {
    name: 'MailerLite', category: 'Marketing automation', color: '#09C269',
    detect: {
      scripts: [/static\.mailerlite\.com/i, /assets\.mailerlite\.com/i],
      html:    [/mailerlite/i, /ml-embedded/i],
    },
  },
  {
    name: 'Brevo', category: 'Marketing automation', color: '#0B66C3',
    detect: {
      scripts: [/brevo\.com/i, /sendinblue\.com/i, /sibautomation\.com/i],
      html:    [/brevo/i, /sendinblue/i],
    },
  },
  {
    name: 'Contlo', category: 'Marketing automation', color: '#6C3CE1',
    detect: {
      scripts: [/contlo\.com/i, /cdn\.contlo/i],
      html:    [/contlo/i],
    },
  },
  {
    name: 'NETCORE', category: 'Marketing automation', color: '#0066CC',
    detect: {
      scripts: [/netcorecloud\.com/i, /netcore\.co\.in/i, /smartech\.io/i],
      html:    [/netcore/i, /smartechcdn/i, /smartech\.io/i],
    },
  },
  {
    name: 'Wigzo', category: 'Marketing automation', color: '#FF5722',
    detect: {
      scripts: [/wigzo\.com/i, /app\.wigzo\.com/i],
      html:    [/wigzo/i, /Wigzo\b/i],
    },
  },
  {
    name: 'Pushwoosh', category: 'Marketing automation', color: '#2196F3',
    detect: {
      scripts: [/pushwoosh\.com/i, /cdn\.pushwoosh\.com/i],
      html:    [/pushwoosh/i, /Pushwoosh\.init\b/i],
    },
  },
  {
    name: 'Lemnisk', category: 'Marketing automation', color: '#FF6F00',
    detect: {
      scripts: [/lemnisk\.co/i, /cdn\.lemnisk/i],
      html:    [/lemnisk/i],
    },
  },
  {
    name: 'Appier', category: 'Marketing automation', color: '#E91E63',
    detect: {
      scripts: [/appier\.com/i, /cdn\.appier\.net/i],
      html:    [/appier/i, /aiqua/i],
    },
  },
  {
    name: 'Airship', category: 'Marketing automation', color: '#00BCD4',
    detect: {
      scripts: [/urbanairship\.com/i, /aswpsdks\.com/i],
      html:    [/urbanairship/i, /airship/i],
    },
  },
  {
    name: 'iZooto', category: 'Marketing automation', color: '#FF5722',
    detect: {
      scripts: [/cdn\.izooto\.com/i, /izooto\.com/i],
      html:    [/izooto/i],
    },
  },
  {
    name: 'BiteSpeed', category: 'Marketing automation', color: '#6C3CE1',
    detect: {
      scripts: [/bitespeed\.co/i, /bitespeed\.com/i, /widget\.bitespeed/i, /cdn\.bitespeed/i],
      html:    [/bitespeed/i, /bite-speed/i, /bitespeed-fb-messenger/i, /bitespeed-whatsapp/i],
    },
  },
  {
    name: 'Wati', category: 'Marketing automation', color: '#25D366',
    detect: {
      scripts: [/wati\.io/i, /app\.wati\.io/i, /live-chat\.wati\.io/i],
      html:    [/wati\.io/i, /wati-chat/i, /wati-widget/i],
    },
  },
  {
    name: 'Gupshup', category: 'Marketing automation', color: '#03A84E',
    detect: {
      scripts: [/gupshup\.io/i, /smapi\.gupshup/i],
      html:    [/gupshup/i, /gupshup\.io/i],
    },
  },
  {
    name: 'Interakt', category: 'Marketing automation', color: '#25D366',
    detect: {
      scripts: [/interakt\.shop/i, /interakt\.ai/i, /app\.interakt/i],
      html:    [/interakt/i, /interakt\.shop/i],
    },
  },
  {
    name: 'Twilio', category: 'Marketing automation', color: '#F22F46',
    detect: {
      scripts: [/twilio\.com/i, /media\.twiliocdn\.com/i, /flex\.twilio/i],
      html:    [/twilio/i, /twilio\.com/i, /twiliocdn/i],
    },
  },
  {
    name: 'Zoho Campaigns', category: 'Marketing automation', color: '#E42527',
    detect: {
      scripts: [/zcmpms\.com/i, /campaigns\.zoho/i, /zoho\.com\/campaigns/i],
      html:    [/zcmpms\.com/i, /zoho-campaigns/i, /campaigns\.zoho/i],
    },
  },
  {
    name: 'Mailmodo', category: 'Marketing automation', color: '#6366F1',
    detect: {
      scripts: [/mailmodo\.com/i, /cdn\.mailmodo\.com/i],
      html:    [/mailmodo/i, /mailmodo\.com/i],
    },
  },
  {
    name: 'MSG91', category: 'Marketing automation', color: '#56CCF2',
    detect: {
      scripts: [/msg91\.com/i, /cdn\.msg91/i, /control\.msg91/i],
      html:    [/msg91/i, /msg91\.com/i],
    },
  },

  {
    name: 'PushEngage', category: 'Push notifications', color: '#FF5733',
    detect: {
      scripts: [/clientcdn\.pushengage\.com/i, /pushengage\.com/i],
      html:    [/pushengage/i],
    },
  },
  {
    name: 'VWO Engage', category: 'Push notifications', color: '#4A90D9',
    detect: {
      scripts: [/pushcrew\.com/i, /cdn\.pushcrew\.com/i],
      html:    [/pushcrew/i, /PushCrew/],
    },
  },
  {
    name: 'Subscribers', category: 'Push notifications', color: '#FF6347',
    detect: {
      scripts: [/subscribers\.com/i, /cdn\.subscribers\.com/i],
      html:    [/subscribers\.com/i],
    },
  },

  {
    name: 'Insider', category: 'Personalisation', color: '#FF0054',
    detect: {
      scripts: [/insnw\.net/i, /useinsider\.com/i, /api\.useinsider\.com/i],
      html:    [/useinsider/i, /insider_object/i, /insnw\.net/i],
    },
  },
  {
    name: 'Bloomreach', category: 'Personalisation', color: '#0038FF',
    detect: {
      scripts: [/bloomreach\.com/i, /cdn\.bloomreach\.com/i, /brxm\.io/i],
      html:    [/bloomreach/i],
    },
  },
  {
    name: 'Algolia Recommend', category: 'Personalisation', color: '#5468FF',
    detect: {
      scripts: [/algoliasearch/i, /algolia\.net/i, /algolianet\.com/i],
      html:    [/algolia/i, /algoliasearch/i],
    },
  },
  {
    name: 'Clerk.io', category: 'Personalisation', color: '#0FC874',
    detect: {
      scripts: [/clerk\.io/i, /cdn\.clerk\.io/i],
      html:    [/clerk\.io/i, /data-clerk/i],
    },
  },
];

const PRIORITY_CATEGORIES = Object.keys(PRIORITY_CATALOG);
const GENERIC_COLOR = '#64748B';
const TOKEN_STOPWORDS = new Set([
  'and', 'for', 'with', 'from', 'flagging', 'feature', 'platform', 'cloud',
  'checkout', 'payment', 'payments', 'gateway', 'business', 'shopify', 'by',
  'com', 'net', 'org', 'io', 'www', 'cdn', 'static', 'widget', 'js',
]);

const SKIP_GENERIC_NAMES = new Set([
  'bik', 'front', 'square', 'bolt', 'atom', 'pusher', 'drip',
  'convert', 'unbox', 'heatmap', 'joy', 'beans', 'pace', 'bread',
  'route', 'fabric', 'cargo', 'prism', 'pure', 'fresh', 'lit',
  'vant', 'mark', 'immer', 'yup', 'zod', 'r', 'go', 'dart', 'lua',
  'rust', 'java', 'ruby', 'perl', 'scala', 'swift', 'julia',
  'contentad', 'tenor', 'signal', 'matter', 'fiber', 'wire',
  'slide', 'focus', 'simple', 'starter', 'flavor',
  'jtlshop', 'ccvshop', 'shopgold', 'soteshop', 'tomatocart',
  'joyloyalty', 'sloyalty', 'bonloyalty', 'muxlive', 'hellobar',
  'shopifyemail', 'smilepoints',
]);

function normalizeToolName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildGenericDetect(name) {
  const base = String(name || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\/&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = base
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 4 && !TOKEN_STOPWORDS.has(t));

  const nameIsShort = base.length <= 8 || tokens.length === 0 ||
    (tokens.length === 1 && tokens[0].length <= 6);

  const htmlPatterns = [];
  const scriptPatterns = [];

  if (base) {
    if (nameIsShort) {
      const esc = escapeRegex(base.toLowerCase());
      htmlPatterns.push(new RegExp(`${esc}\\.(com|io|co|in|ai|net|org)`, 'i'));
      htmlPatterns.push(new RegExp(`cdn[.-]${esc}`, 'i'));
      htmlPatterns.push(new RegExp(`sdk[.-]${esc}`, 'i'));
      htmlPatterns.push(new RegExp(`api[.-]${esc}`, 'i'));
    } else {
      htmlPatterns.push(new RegExp(escapeRegex(base), 'i'));
    }
  }

  if (tokens.length === 1) {
    if (nameIsShort) {
      const esc = escapeRegex(tokens[0]);
      scriptPatterns.push(new RegExp(`${esc}\\.(com|io|co|in|ai|net|org)`, 'i'));
      scriptPatterns.push(new RegExp(`cdn[.-]${esc}`, 'i'));
    } else {
      scriptPatterns.push(new RegExp(escapeRegex(tokens[0]), 'i'));
    }
  } else if (tokens.length > 1) {
    const pair = `${tokens[0]}[^a-z0-9]{0,10}${tokens[1]}`;
    scriptPatterns.push(new RegExp(pair, 'i'));
  }

  const compact = tokens.join('');
  if (compact.length >= 8) scriptPatterns.push(new RegExp(escapeRegex(compact), 'i'));

  if (!htmlPatterns.length && tokens.length) {
    if (nameIsShort) {
      htmlPatterns.push(new RegExp(`${escapeRegex(tokens[0])}\\.(com|io|co|in|ai|net|org)`, 'i'));
    } else {
      htmlPatterns.push(new RegExp(escapeRegex(tokens[0]), 'i'));
    }
  }

  return {
    html: htmlPatterns,
    scripts: scriptPatterns,
  };
}

const priorityToolToCategory = new Map();
for (const category of PRIORITY_CATEGORIES) {
  for (const tool of PRIORITY_CATALOG[category] || []) {
    const normalized = normalizeToolName(tool);
    if (!normalized || priorityToolToCategory.has(normalized)) continue;
    priorityToolToCategory.set(normalized, category);
  }
}

function getPriorityCategory(toolName) {
  return priorityToolToCategory.get(normalizeToolName(toolName)) || null;
}

const CATEGORY_ALIAS = {
  'Ecommerce Platform':                    'Ecommerce',
  'Analytics & Optimization Platform':     'Analytics',
  'Analytics & Behavior':                  'Analytics',
  'Payments & Checkout Platform':          'Payment processors',
  'Payments & Checkout - Gateway':         'Payment processors',
  'Payments & Checkout - Checkout / BNPL': 'Buy now pay later',
  'Buy Now Pay Later':                     'Buy now pay later',
  'Customer Engagement Platform':          'CRM',
  'Customer Engagement / CRM':             'CRM',
  'Customer Support':                      'Live chat',
  'JavaScript Frameworks':                 'JavaScript frameworks',
  'JavaScript Libraries':                  'JavaScript libraries',
  'UI Frameworks':                         'UI frameworks',
  'Tag Manager':                           'Tag managers',
  'CDN & Infrastructure':                  'CDN',
  'Web Servers & Runtime':                 'Web servers',
  'Loyalty & Rewards':                     'Loyalty & rewards',
  'Shopify Apps':                          'Shopify apps',
  'WordPress Plugins':                     'WordPress plugins',
  'Search':                                'Search engines',
  'Shipping':                              'Shipping carriers',
  'Subscription':                          'Ecommerce',
};

for (const tech of TECH) {
  if (CATEGORY_ALIAS[tech.category]) {
    tech.category = CATEGORY_ALIAS[tech.category];
  }
}

const existingNormalizedTools = new Set(TECH.map(t => normalizeToolName(t.name)));
for (const category of PRIORITY_CATEGORIES) {
  for (const tool of PRIORITY_CATALOG[category] || []) {
    const normalized = normalizeToolName(tool);
    if (!normalized || existingNormalizedTools.has(normalized)) continue;
    if (SKIP_GENERIC_NAMES.has(normalized)) continue;
    TECH.push({
      name: tool,
      category,
      color: GENERIC_COLOR,
      detect: buildGenericDetect(tool),
      _isGeneric: true,
    });
    existingNormalizedTools.add(normalized);
  }
}

function countSignals(tech, { html, headers, scriptSrcs, metaMap }) {
  let count = 0;
  const d = tech.detect;

  if (d.headers) {
    for (const { field, rx } of d.headers) {
      const val = headers[field.toLowerCase()];
      if (val && rx.test(val)) count++;
    }
  }
  if (d.html) {
    for (const rx of d.html) {
      if (rx.test(html)) count++;
    }
  }
  if (d.scripts) {
    for (const src of scriptSrcs) {
      for (const rx of d.scripts) {
        if (rx.test(src)) count++;
      }
    }
  }
  if (d.meta) {
    for (const { name, rx } of d.meta) {
      const val = metaMap[name.toLowerCase()];
      if (val && rx.test(val)) count++;
    }
  }

  return count;
}

function detect({ html, headers, scriptSrcs, metaMap }) {
  const signals = new Map();

  for (const tech of TECH) {
    const d = tech.detect;
    let matched = false;

    if (!matched && d.headers) {
      for (const { field, rx } of d.headers) {
        const val = headers[field.toLowerCase()];
        if (val && rx.test(val)) { matched = true; break; }
      }
    }
    if (!matched && d.html) {
      for (const rx of d.html) {
        if (rx.test(html)) { matched = true; break; }
      }
    }
    if (!matched && d.scripts) {
      for (const src of scriptSrcs) {
        for (const rx of d.scripts) {
          if (rx.test(src)) { matched = true; break; }
        }
        if (matched) break;
      }
    }
    if (!matched && d.meta) {
      for (const { name, rx } of d.meta) {
        const val = metaMap[name.toLowerCase()];
        if (val && rx.test(val)) { matched = true; break; }
      }
    }

    if (matched) {
      signals.set(tech.name, countSignals(tech, { html, headers, scriptSrcs, metaMap }));
    }
  }

  const out = [];
  const seen = new Set();

  for (const tech of TECH) {
    if (!signals.has(tech.name)) continue;

    const signalCount = signals.get(tech.name);
    if (tech._isGeneric && signalCount < 2) continue;

    const category = tech.category;
    const key = `${category}::${normalizeToolName(tech.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: tech.name, category, color: tech.color });
  }

  return out;
}

module.exports = { detect };
