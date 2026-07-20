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
      html:    [/UA-\d{4,}-\d+/i, /G-[A-Z0-9]{8,}/i, /gtag\(["']config["'],\s*["'](?:UA-|G-)/i],
      scripts: [/google-analytics\.com\/analytics\.js/i, /googletagmanager\.com\/gtag\/js\?id=(?:UA-|G-)/i],
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

  // ── Store Locator Widgets ──────────────────────────────────────────────
  {
    name: 'Storemapper',
    category: 'Store Locator',
    color: '#4A90D9',
    detect: {
      scripts: [/storemapper\.co/i, /storemapper\.com/i],
      html: [/storemapper-embed/i, /class="storemapper"/i, /data-storemapper-id/i],
    },
  },
  {
    name: 'Storepoint',
    category: 'Store Locator',
    color: '#FF6B35',
    detect: {
      scripts: [/storepoint\.co/i],
      html: [/storepoint-locator/i, /data-storepoint/i],
    },
  },
  {
    name: 'Stockist',
    category: 'Store Locator',
    color: '#2ECC71',
    detect: {
      scripts: [/stockist\.co/i],
      html: [/stockist-widget/i, /data-stockist/i],
    },
  },
  {
    name: 'Bullseye Locations',
    category: 'Store Locator',
    color: '#E74C3C',
    detect: {
      scripts: [/bullseyelocations\.com/i, /bullseye\.js/i],
      html: [/bullseye-locator/i],
    },
  },
  {
    name: 'Yext',
    category: 'Store Locator',
    color: '#0F70E0',
    detect: {
      scripts: [/yext\.com/i, /yextpages/i],
      html: [/yext-locator/i, /data-yext/i],
    },
  },
  {
    name: 'Locally.io',
    category: 'Store Locator',
    color: '#00B4D8',
    detect: {
      scripts: [/locally\.io/i, /locally-sdk/i, /locally\.com\/stores/i],
      html: [/locally-widget/i],
    },
  },
  {
    name: 'Store Locator Plus',
    category: 'Store Locator',
    color: '#21759B',
    detect: {
      scripts: [/store-locator-plus/i, /slp_core/i],
      html: [/slp_results/i, /store-locator-plus/i],
    },
  },
  {
    name: 'StoreRocket',
    category: 'Store Locator',
    color: '#FF4500',
    detect: {
      scripts: [/storerocket\.io/i],
      html: [/storerocket-id/i, /data-storerocket/i],
    },
  },
  {
    name: 'Secomapp Store Locator',
    category: 'Store Locator',
    color: '#96BF48',
    detect: {
      scripts: [/secomapp.*store.*locator/i, /storelocator\.secomapp/i],
      html: [/secomapp-storelocator/i],
    },
  },
  {
    name: 'Bold Store Locator',
    category: 'Store Locator',
    color: '#000000',
    detect: {
      scripts: [/boldapps\.net.*store.*locator/i],
      html: [/bold-store-locator/i],
    },
  },
  {
    name: 'Progus Commerce Locator',
    category: 'Store Locator',
    color: '#6C5CE7',
    detect: {
      scripts: [/proguscommerce\.com/i],
      html: [/progus-store-locator/i],
    },
  },

  // ── Tag Managers ────────────────────────────────────────────────────────
  {
    name: 'Adobe Launch',
    category: 'Tag Manager',
    color: '#FF0000',
    detect: {
      scripts: [/assets\.adobedtm\.com/i, /launch-.*\.adobedtm\.com/i],
      html: [/adobedtm\.com/i],
    },
  },
  {
    name: 'Tealium',
    category: 'Tag Manager',
    color: '#00B2A9',
    detect: {
      scripts: [/tags\.tiqcdn\.com/i, /tealium\.com/i, /tealiumiq/i],
      html: [/tealium/i, /utag\.js/i, /utag_data/i],
    },
  },
  {
    name: 'Segment',
    category: 'Tag Manager',
    color: '#52BD94',
    detect: {
      scripts: [/cdn\.segment\.com/i, /cdn\.segment\.io/i, /api\.segment\.io/i],
      html: [/analytics\.js/i, /segment\.com/i],
    },
  },
  {
    name: 'Ensighten',
    category: 'Tag Manager',
    color: '#0099CC',
    detect: {
      scripts: [/nexus\.ensighten\.com/i, /ensighten\.com/i],
      html: [/ensighten/i],
    },
  },
  {
    name: 'TagCommander',
    category: 'Tag Manager',
    color: '#1A73E8',
    detect: {
      scripts: [/tagcommander\.com/i, /cdn\.tagcommander\.com/i, /commander1\.com/i],
      html: [/tagcommander/i, /tc_vars/i],
    },
  },
  {
    name: 'Piwik Tag Manager',
    category: 'Tag Manager',
    color: '#3152A0',
    detect: {
      scripts: [/matomo.*container/i, /piwik.*container/i],
      html: [/piwik.*tag.?manager/i, /matomo.*tag.?manager/i],
    },
  },

  // ── Live Chat ───────────────────────────────────────────────────────────
  {
    name: 'Tidio',
    category: 'Live chat',
    color: '#0767DB',
    detect: {
      scripts: [/code\.tidio\.co/i, /tidio\.com/i],
      html: [/tidio/i, /tidio-chat/i],
    },
  },
  {
    name: 'Tawk.to',
    category: 'Live chat',
    color: '#03C03C',
    detect: {
      scripts: [/embed\.tawk\.to/i, /tawk\.to/i],
      html: [/tawk\.to/i, /tawkto/i],
    },
  },
  {
    name: 'LiveChat',
    category: 'Live chat',
    color: '#FF5100',
    detect: {
      scripts: [/cdn\.livechatinc\.com/i, /livechatinc\.com/i],
      html: [/livechatinc/i, /livechat-widget/i, /__lc\b/i],
    },
  },
  {
    name: 'Zendesk Chat',
    category: 'Live chat',
    color: '#03363D',
    detect: {
      scripts: [/static\.zdassets\.com/i, /zopim\.com/i, /zendesk\.com\/embeddable/i],
      html: [/zdassets/i, /zopim/i, /zendesk-chat/i],
    },
  },
  {
    name: 'Crisp',
    category: 'Live chat',
    color: '#4B48E0',
    detect: {
      scripts: [/client\.crisp\.chat/i, /crisp\.chat/i],
      html: [/crisp-client/i, /\$crisp/i],
    },
  },
  {
    name: 'Olark',
    category: 'Live chat',
    color: '#2AD56F',
    detect: {
      scripts: [/static\.olark\.com/i, /olark\.com/i],
      html: [/olark/i, /olark-key/i],
    },
  },
  {
    name: 'Freshchat',
    category: 'Live chat',
    color: '#F15A2D',
    detect: {
      scripts: [/wchat\.freshchat\.com/i, /fw-cdn\.com/i],
      html: [/freshchat/i, /fc-widget/i],
    },
  },
  {
    name: 'Chatwoot',
    category: 'Live chat',
    color: '#1F93FF',
    detect: {
      scripts: [/chatwoot\.com/i, /app\.chatwoot\.com/i],
      html: [/chatwoot/i, /chatwoot-widget/i, /chatwootSettings/i],
    },
  },
  {
    name: 'HelpScout Beacon',
    category: 'Live chat',
    color: '#1292EE',
    detect: {
      scripts: [/beacon-v2\.helpscout\.net/i, /beacon\.helpscout\.net/i],
      html: [/helpscout/i, /hs-beacon/i],
    },
  },
  {
    name: 'Kommunicate',
    category: 'Live chat',
    color: '#5C5AA7',
    detect: {
      scripts: [/widget\.kommunicate\.io/i, /kommunicate\.io/i],
      html: [/kommunicate/i],
    },
  },
  {
    name: 'Yellow.ai',
    category: 'Live chat',
    color: '#FFD600',
    detect: {
      scripts: [/cdn\.yellowmessenger\.com/i, /app\.yellowmessenger\.com/i, /cloud\.yellow\.ai/i, /cdn\.yellow\.ai/i],
      html: [/yellowmessenger/i, /yellow\.ai/i, /ymConfig/i],
    },
  },
  {
    name: 'Verloop',
    category: 'Live chat',
    color: '#6C5CE7',
    detect: {
      scripts: [/verloop\.io/i, /sdk\.verloop\.io/i],
      html: [/verloop/i, /verloop-widget/i],
    },
  },

  // ── Search ──────────────────────────────────────────────────────────────
  {
    name: 'Algolia',
    category: 'Search',
    color: '#5468FF',
    detect: {
      scripts: [/algoliasearch/i, /algolia\.net/i, /cdn\.jsdelivr\.net.*algoliasearch/i],
      html: [/algolia/i, /ais-/i],
    },
  },
  {
    name: 'Elasticsearch',
    category: 'Search',
    color: '#FEC514',
    detect: {
      html: [/elasticsearch/i, /elastic-search/i, /_search\?q=/i],
      scripts: [/elasticsearch/i],
    },
  },
  {
    name: 'Klevu',
    category: 'Search',
    color: '#21252B',
    detect: {
      scripts: [/js\.klevu\.com/i, /klevu\.com/i],
      html: [/klevu/i, /klevuSearch/i, /klevu-search/i],
    },
  },
  {
    name: 'Searchspring',
    category: 'Search',
    color: '#00B67A',
    detect: {
      scripts: [/searchspring\.net/i, /cdn\.searchspring\.net/i],
      html: [/searchspring/i],
    },
  },
  {
    name: 'Doofinder',
    category: 'Search',
    color: '#4A54E1',
    detect: {
      scripts: [/doofinder\.com/i, /cdn\.doofinder\.com/i],
      html: [/doofinder/i, /doofinderScript/i],
    },
  },
  {
    name: 'Typesense',
    category: 'Search',
    color: '#D33B67',
    detect: {
      scripts: [/typesense/i, /cdn\.typesense/i],
      html: [/typesense/i],
    },
  },
  {
    name: 'MeiliSearch',
    category: 'Search',
    color: '#FF5CAA',
    detect: {
      scripts: [/meilisearch/i],
      html: [/meilisearch/i],
    },
  },
  {
    name: 'Swiftype',
    category: 'Search',
    color: '#3C6BFF',
    detect: {
      scripts: [/swiftype\.com/i, /s\.swiftypecdn\.com/i],
      html: [/swiftype/i, /swiftype-widget/i],
    },
  },
  {
    name: 'Constructor.io',
    category: 'Search',
    color: '#1D1D1F',
    detect: {
      scripts: [/constructor\.io/i, /cnstrc\.com/i],
      html: [/constructor\.io/i, /cnstrc/i],
    },
  },

  // ── Subscription / Recurring Billing ────────────────────────────────────
  {
    name: 'ReCharge',
    category: 'Subscription',
    color: '#7AB55C',
    detect: {
      scripts: [/rechargepayments\.com/i, /rechargecdn\.com/i],
      html: [/recharge/i, /rechargepayments/i, /rc-widget/i],
    },
  },
  {
    name: 'Bold Subscriptions',
    category: 'Subscription',
    color: '#000000',
    detect: {
      scripts: [/boldapps\.net.*subscriptions/i, /bold-subscriptions/i],
      html: [/bold-subscriptions/i, /bold_subscriptions/i],
    },
  },
  {
    name: 'Chargebee',
    category: 'Subscription',
    color: '#FF6633',
    detect: {
      scripts: [/js\.chargebee\.com/i, /chargebee\.com/i],
      html: [/chargebee/i],
    },
  },
  {
    name: 'Recurly',
    category: 'Subscription',
    color: '#007CFF',
    detect: {
      scripts: [/js\.recurly\.com/i, /recurly\.com/i],
      html: [/recurly/i],
    },
  },
  {
    name: 'Zuora',
    category: 'Subscription',
    color: '#00B8D9',
    detect: {
      scripts: [/static\.zuora\.com/i, /zuora\.com/i],
      html: [/zuora/i],
    },
  },
  {
    name: 'Ordergroove',
    category: 'Subscription',
    color: '#7B2D8E',
    detect: {
      scripts: [/static\.ordergroove\.com/i, /ordergroove\.com/i],
      html: [/ordergroove/i, /og-offer/i],
    },
  },

  // ── Returns & Exchanges ─────────────────────────────────────────────────
  {
    name: 'Loop Returns',
    category: 'Returns',
    color: '#5B45AE',
    detect: {
      scripts: [/loopreturns\.com/i, /cdn\.loopreturns\.com/i],
      html: [/loopreturns/i, /loop-returns/i],
    },
  },
  {
    name: 'Narvar',
    category: 'Returns',
    color: '#FF6600',
    detect: {
      scripts: [/narvar\.com/i, /cdn\.narvar\.com/i],
      html: [/narvar/i],
    },
  },
  {
    name: 'Returnly',
    category: 'Returns',
    color: '#2B2D42',
    detect: {
      scripts: [/returnly\.com/i, /cdn\.returnly\.com/i],
      html: [/returnly/i],
    },
  },
  {
    name: 'AfterShip Returns',
    category: 'Returns',
    color: '#4169E1',
    detect: {
      scripts: [/returns\.aftership\.com/i, /assets\.aftership\.com/i],
      html: [/aftership.*return/i],
    },
  },
  {
    name: 'Happy Returns',
    category: 'Returns',
    color: '#FF4D6A',
    detect: {
      scripts: [/happyreturns\.com/i],
      html: [/happyreturns/i, /happy-returns/i],
    },
  },

  // ── Shipping & Order Tracking ───────────────────────────────────────────
  {
    name: 'AfterShip',
    category: 'Shipping',
    color: '#4169E1',
    detect: {
      scripts: [/aftership\.com/i, /cdn\.aftership\.com/i, /automizely-aftership/i],
      html: [/aftership/i, /aftership-widget/i],
    },
  },
  {
    name: 'ShipStation',
    category: 'Shipping',
    color: '#84C341',
    detect: {
      scripts: [/shipstation\.com/i],
      html: [/shipstation/i],
    },
  },
  {
    name: 'Shippo',
    category: 'Shipping',
    color: '#0B5FFF',
    detect: {
      scripts: [/goshippo\.com/i, /shippo\.com/i],
      html: [/shippo/i, /goshippo/i],
    },
  },
  {
    name: 'EasyPost',
    category: 'Shipping',
    color: '#0066FF',
    detect: {
      scripts: [/easypost\.com/i],
      html: [/easypost/i],
    },
  },
  {
    name: 'Shiprocket',
    category: 'Shipping',
    color: '#7B2D8E',
    detect: {
      scripts: [/shiprocket\.co/i, /shiprocket\.in/i, /app\.shiprocket/i],
      html: [/shiprocket/i],
    },
  },
  {
    name: 'Delhivery',
    category: 'Shipping',
    color: '#ED1C24',
    detect: {
      scripts: [/delhivery\.com/i],
      html: [/delhivery/i],
    },
  },
  {
    name: 'Clickpost',
    category: 'Shipping',
    color: '#FF5722',
    detect: {
      scripts: [/clickpost\.in/i, /clickpost\.ai/i],
      html: [/clickpost/i],
    },
  },
  {
    name: 'Nimbuspost',
    category: 'Shipping',
    color: '#0066FF',
    detect: {
      scripts: [/nimbuspost\.com/i],
      html: [/nimbuspost/i],
    },
  },
  {
    name: 'Route',
    category: 'Shipping',
    color: '#0A0A0A',
    detect: {
      scripts: [/route\.com/i, /cdn\.routeapp\.io/i, /routeapp\.io/i],
      html: [/routeapp/i, /route-widget/i],
    },
  },

  // ── Cookie Compliance & Consent ─────────────────────────────────────────
  {
    name: 'Cookiebot',
    category: 'Cookie Compliance',
    color: '#1A7E3C',
    detect: {
      scripts: [/consent\.cookiebot\.com/i, /cookiebot\.com/i],
      html: [/cookiebot/i, /CookieConsent/i],
    },
  },
  {
    name: 'OneTrust',
    category: 'Cookie Compliance',
    color: '#004A45',
    detect: {
      scripts: [/cdn\.cookielaw\.org/i, /optanon\.blob/i, /onetrust\.com/i],
      html: [/onetrust/i, /optanon/i, /cookielaw/i],
    },
  },
  {
    name: 'TrustArc',
    category: 'Cookie Compliance',
    color: '#0073AA',
    detect: {
      scripts: [/consent\.trustarc\.com/i, /trustarc\.com/i],
      html: [/trustarc/i, /truste/i],
    },
  },
  {
    name: 'Osano',
    category: 'Cookie Compliance',
    color: '#4A154B',
    detect: {
      scripts: [/cmp\.osano\.com/i, /osano\.com/i],
      html: [/osano/i],
    },
  },
  {
    name: 'CookieYes',
    category: 'Cookie Compliance',
    color: '#24B47E',
    detect: {
      scripts: [/cdn-cookieyes\.com/i, /cookieyes\.com/i],
      html: [/cookieyes/i, /cky-consent/i],
    },
  },
  {
    name: 'Iubenda',
    category: 'Cookie Compliance',
    color: '#1CC691',
    detect: {
      scripts: [/cdn\.iubenda\.com/i, /iubenda\.com/i],
      html: [/iubenda/i, /iubenda-cs-banner/i],
    },
  },
  {
    name: 'Quantcast Choice',
    category: 'Cookie Compliance',
    color: '#F44336',
    detect: {
      scripts: [/quantcast\.mgr\.consensu\.org/i, /cmp2\.pcmag\.com/i],
      html: [/quantcast/i, /__cmp\b/i],
    },
  },
  {
    name: 'Termly',
    category: 'Cookie Compliance',
    color: '#1E88E5',
    detect: {
      scripts: [/app\.termly\.io/i, /termly\.io/i],
      html: [/termly/i, /termly-embed/i],
    },
  },

  // ── Accessibility ───────────────────────────────────────────────────────
  {
    name: 'AccessiBe',
    category: 'Accessibility',
    color: '#4054B2',
    detect: {
      scripts: [/acsbapp\.com/i, /accessibe\.com/i, /acsb\.js/i],
      html: [/accessibe/i, /acsb-trigger/i],
    },
  },
  {
    name: 'UserWay',
    category: 'Accessibility',
    color: '#0071CE',
    detect: {
      scripts: [/cdn\.userway\.org/i, /userway\.org/i],
      html: [/userway/i, /userway-widget/i],
    },
  },
  {
    name: 'EqualWeb',
    category: 'Accessibility',
    color: '#FF6600',
    detect: {
      scripts: [/cdn\.equalweb\.com/i, /equalweb\.com/i],
      html: [/equalweb/i],
    },
  },
  {
    name: 'AudioEye',
    category: 'Accessibility',
    color: '#1A1A2E',
    detect: {
      scripts: [/audioeye\.com/i, /cdn\.audioeye\.com/i],
      html: [/audioeye/i, /aeWidget/i],
    },
  },

  // ── Security ────────────────────────────────────────────────────────────
  {
    name: 'Cloudflare',
    category: 'Security',
    color: '#F48120',
    detect: {
      headers: [{ field: 'server', rx: /cloudflare/i }, { field: 'cf-ray', rx: /./ }],
      html: [/cdn-cgi\/challenge-platform/i, /cloudflare/i],
      scripts: [/cdnjs\.cloudflare\.com/i],
    },
  },
  {
    name: 'reCAPTCHA',
    category: 'Security',
    color: '#4285F4',
    detect: {
      scripts: [/google\.com\/recaptcha/i, /gstatic\.com\/recaptcha/i],
      html: [/g-recaptcha/i, /recaptcha/i],
    },
  },
  {
    name: 'hCaptcha',
    category: 'Security',
    color: '#0074BF',
    detect: {
      scripts: [/hcaptcha\.com\/1\/api\.js/i, /js\.hcaptcha\.com/i],
      html: [/h-captcha/i, /hcaptcha/i],
    },
  },
  {
    name: 'Akamai Bot Manager',
    category: 'Security',
    color: '#0096D6',
    detect: {
      scripts: [/akam\/\d+/i, /akamai\.com/i, /akamaized\.net/i],
      headers: [{ field: 'server', rx: /akamai/i }, { field: 'x-akamai-transformed', rx: /./ }],
    },
  },
  {
    name: 'Imperva',
    category: 'Security',
    color: '#004DAA',
    detect: {
      headers: [{ field: 'x-iinfo', rx: /./ }, { field: 'x-cdn', rx: /imperva/i }],
      html: [/imperva/i, /incapsula/i],
    },
  },
  {
    name: 'PerimeterX',
    category: 'Security',
    color: '#5200FF',
    detect: {
      scripts: [/px-cdn\.net/i, /px-client\.net/i, /perimeterx\.net/i],
      html: [/perimeterx/i, /_pxhd/i],
    },
  },
  {
    name: 'Turnstile',
    category: 'Security',
    color: '#F48120',
    detect: {
      scripts: [/challenges\.cloudflare\.com\/turnstile/i],
      html: [/cf-turnstile/i, /turnstile/i],
    },
  },

  // ── CDN & Infrastructure ────────────────────────────────────────────────
  {
    name: 'Akamai CDN',
    category: 'CDN & Infrastructure',
    color: '#0096D6',
    detect: {
      headers: [{ field: 'server', rx: /akamai/i }, { field: 'x-akamai-transformed', rx: /./ }],
      html: [/akamaized\.net/i, /akamaitech\.net/i],
    },
  },
  {
    name: 'Fastly',
    category: 'CDN & Infrastructure',
    color: '#FF282D',
    detect: {
      headers: [{ field: 'via', rx: /varnish/i }, { field: 'x-served-by', rx: /cache-/i }, { field: 'x-fastly-request-id', rx: /./ }],
      html: [/fastly\.net/i, /fastlylb\.net/i],
    },
  },
  {
    name: 'KeyCDN',
    category: 'CDN & Infrastructure',
    color: '#047ADB',
    detect: {
      headers: [{ field: 'server', rx: /keycdn/i }],
      html: [/kxcdn\.com/i, /keycdn\.com/i],
    },
  },
  {
    name: 'StackPath',
    category: 'CDN & Infrastructure',
    color: '#000000',
    detect: {
      headers: [{ field: 'x-hw', rx: /./ }],
      html: [/stackpathdns\.com/i, /stackpath/i],
    },
  },
  {
    name: 'Vercel',
    category: 'CDN & Infrastructure',
    color: '#000000',
    detect: {
      headers: [{ field: 'server', rx: /vercel/i }, { field: 'x-vercel-id', rx: /./ }],
      html: [/vercel\.app/i, /_next\/static/i],
    },
  },
  {
    name: 'Netlify',
    category: 'CDN & Infrastructure',
    color: '#00AD9F',
    detect: {
      headers: [{ field: 'server', rx: /netlify/i }, { field: 'x-nf-request-id', rx: /./ }],
      html: [/netlify/i, /netlify\.app/i],
    },
  },
  {
    name: 'AWS CloudFront',
    category: 'CDN & Infrastructure',
    color: '#FF9900',
    detect: {
      headers: [{ field: 'via', rx: /cloudfront/i }, { field: 'x-amz-cf-id', rx: /./ }, { field: 'x-amz-cf-pop', rx: /./ }],
      html: [/cloudfront\.net/i, /d[a-z0-9]+\.cloudfront\.net/i],
    },
  },
  {
    name: 'Google Cloud CDN',
    category: 'CDN & Infrastructure',
    color: '#4285F4',
    detect: {
      headers: [{ field: 'via', rx: /google/i }],
      html: [/storage\.googleapis\.com/i],
    },
  },
  {
    name: 'Azure CDN',
    category: 'CDN & Infrastructure',
    color: '#0078D4',
    detect: {
      headers: [{ field: 'server', rx: /microsoft/i }],
      html: [/azureedge\.net/i, /azure\.com/i],
    },
  },
  {
    name: 'BunnyCDN',
    category: 'CDN & Infrastructure',
    color: '#FF6600',
    detect: {
      headers: [{ field: 'server', rx: /bunny/i }, { field: 'cdn-pullzone', rx: /./ }],
      html: [/b-cdn\.net/i, /bunny\.net/i, /bunnycdn/i],
    },
  },
  {
    name: 'Imgix',
    category: 'CDN & Infrastructure',
    color: '#FF5722',
    detect: {
      html: [/imgix\.net/i, /\.imgix\.com/i],
    },
  },

  // ── Performance & Monitoring ────────────────────────────────────────────
  {
    name: 'New Relic',
    category: 'Performance',
    color: '#008C99',
    detect: {
      scripts: [/js-agent\.newrelic\.com/i, /nr-data\.net/i, /newrelic\.com/i],
      html: [/NREUM/i, /newrelic/i],
    },
  },
  {
    name: 'Datadog RUM',
    category: 'Performance',
    color: '#632CA6',
    detect: {
      scripts: [/datadoghq\.com/i, /dd-rum/i, /datadog-rum/i],
      html: [/datadoghq/i, /dd-rum/i],
    },
  },
  {
    name: 'Sentry',
    category: 'Performance',
    color: '#362D59',
    detect: {
      scripts: [/browser\.sentry-cdn\.com/i, /sentry\.io/i, /js\.sentry-cdn\.com/i],
      html: [/sentry/i, /Sentry\.init/i],
    },
  },
  {
    name: 'SpeedCurve',
    category: 'Performance',
    color: '#F7C948',
    detect: {
      scripts: [/cdn\.speedcurve\.com/i, /lux\.speedcurve\.com/i],
      html: [/speedcurve/i, /LUX/],
    },
  },
  {
    name: 'Dynatrace',
    category: 'Performance & Monitoring',
    color: '#1496FF',
    detect: {
      scripts: [/js-cdn\.dynatrace\.com/i, /dynatrace\.com/i, /ruxitagentjs/i],
      html: [/dynatrace/i, /ruxitagent/i, /dtrum/i],
    },
  },
  {
    name: 'LogRocket',
    category: 'Performance',
    color: '#764ABC',
    detect: {
      scripts: [/cdn\.logrocket\.io/i, /cdn\.lr-ingest\.io/i],
      html: [/logrocket/i, /LogRocket\.init/i],
    },
  },
  {
    name: 'FullStory',
    category: 'Performance',
    color: '#448AFF',
    detect: {
      scripts: [/fullstory\.com\/s\/fs\.js/i, /edge\.fullstory\.com/i, /rs\.fullstory\.com/i],
      html: [/fullstory/i, /FS\.identify/i],
    },
  },
  {
    name: 'Raygun',
    category: 'Performance',
    color: '#B82025',
    detect: {
      scripts: [/cdn\.raygun\.io/i, /raygun4js/i],
      html: [/raygun/i, /rg4js/i],
    },
  },
  {
    name: 'Pingdom',
    category: 'Performance',
    color: '#FFF000',
    detect: {
      scripts: [/rum-static\.pingdom\.net/i, /pingdom\.net/i],
      html: [/pingdom/i, /_prum/i],
    },
  },

  // ── Hosting / PaaS ──────────────────────────────────────────────────────
  {
    name: 'AWS',
    category: 'Hosting',
    color: '#FF9900',
    detect: {
      headers: [{ field: 'server', rx: /amazons3/i }, { field: 'x-amz-request-id', rx: /./ }],
      html: [/amazonaws\.com/i, /s3\.amazonaws/i],
    },
  },
  {
    name: 'Google Cloud',
    category: 'Hosting',
    color: '#4285F4',
    detect: {
      headers: [{ field: 'server', rx: /gws/i }, { field: 'via', rx: /google/i }],
      html: [/googleapis\.com/i, /appspot\.com/i],
    },
  },
  {
    name: 'Heroku',
    category: 'Hosting',
    color: '#430098',
    detect: {
      headers: [{ field: 'via', rx: /heroku/i }],
      html: [/herokuapp\.com/i],
    },
  },
  {
    name: 'Render',
    category: 'Hosting',
    color: '#46E3B7',
    detect: {
      headers: [{ field: 'server', rx: /render/i }],
      html: [/onrender\.com/i],
    },
  },
  {
    name: 'Railway',
    category: 'Hosting',
    color: '#0B0D0E',
    detect: {
      html: [/railway\.app/i, /up\.railway\.app/i],
    },
  },
  {
    name: 'DigitalOcean',
    category: 'Hosting',
    color: '#0080FF',
    detect: {
      headers: [{ field: 'server', rx: /digitalocean/i }],
      html: [/digitaloceanspaces\.com/i],
    },
  },
  {
    name: 'Fly.io',
    category: 'Hosting',
    color: '#7B3FE4',
    detect: {
      headers: [{ field: 'server', rx: /fly\.io/i }, { field: 'fly-request-id', rx: /./ }],
      html: [/fly\.dev/i, /fly\.io/i],
    },
  },

  // ── Font Scripts ────────────────────────────────────────────────────────
  {
    name: 'Google Fonts',
    category: 'Font Scripts',
    color: '#4285F4',
    detect: {
      html: [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i],
    },
  },
  {
    name: 'Adobe Fonts',
    category: 'Font Scripts',
    color: '#FF0000',
    detect: {
      html: [/use\.typekit\.net/i, /typekit\.com/i, /p\.typekit\.net/i],
      scripts: [/use\.typekit\.net/i],
    },
  },
  {
    name: 'Font Awesome',
    category: 'Font Scripts',
    color: '#339AF0',
    detect: {
      html: [/font-awesome/i, /fontawesome/i, /fa-solid/i, /fa-brands/i],
      scripts: [/fontawesome/i, /kit\.fontawesome\.com/i],
    },
  },

  // ── Maps ────────────────────────────────────────────────────────────────
  {
    name: 'Google Maps',
    category: 'Maps',
    color: '#4285F4',
    detect: {
      scripts: [/maps\.googleapis\.com/i, /maps\.google\.com/i],
      html: [/maps\.googleapis\.com/i, /google\.com\/maps/i, /gm-style/i],
    },
  },
  {
    name: 'Mapbox',
    category: 'Maps',
    color: '#4264FB',
    detect: {
      scripts: [/api\.mapbox\.com/i, /mapbox-gl/i],
      html: [/mapbox/i, /mapboxgl/i],
    },
  },
  {
    name: 'Leaflet',
    category: 'Maps',
    color: '#199900',
    detect: {
      scripts: [/leaflet\.js/i, /leaflet\/leaflet/i, /unpkg\.com\/leaflet/i],
      html: [/leaflet-container/i, /L\.map\b/i],
    },
  },
  {
    name: 'OpenStreetMap',
    category: 'Maps',
    color: '#7EBC6F',
    detect: {
      html: [/openstreetmap\.org/i, /tile\.openstreetmap/i, /osm\.org/i],
    },
  },
  {
    name: 'HERE Maps',
    category: 'Maps',
    color: '#48DAD0',
    detect: {
      scripts: [/js\.api\.here\.com/i, /heremaps/i],
      html: [/here\.com\/maps/i, /heremaps/i],
    },
  },

  // ── Video Players ───────────────────────────────────────────────────────
  {
    name: 'YouTube Embed',
    category: 'Video Players',
    color: '#FF0000',
    detect: {
      html: [/youtube\.com\/embed/i, /youtube-nocookie\.com\/embed/i, /ytimg\.com/i],
    },
  },
  {
    name: 'Vimeo',
    category: 'Video Players',
    color: '#1AB7EA',
    detect: {
      html: [/player\.vimeo\.com/i, /vimeo\.com\/video/i, /vimeocdn\.com/i],
      scripts: [/player\.vimeo\.com/i],
    },
  },
  {
    name: 'Wistia',
    category: 'Video Players',
    color: '#54BBFF',
    detect: {
      scripts: [/fast\.wistia\.com/i, /wistia\.com/i],
      html: [/wistia/i, /wistia_embed/i, /wistia-player/i],
    },
  },
  {
    name: 'Vidyard',
    category: 'Video Players',
    color: '#1FAE6C',
    detect: {
      scripts: [/play\.vidyard\.com/i, /vidyard\.com/i],
      html: [/vidyard/i, /vidyard-player/i],
    },
  },
  {
    name: 'JW Player',
    category: 'Video Players',
    color: '#FF0046',
    detect: {
      scripts: [/cdn\.jwplayer\.com/i, /jwplayer\.com/i, /jwpsrv\.com/i],
      html: [/jwplayer/i],
    },
  },
  {
    name: 'Brightcove',
    category: 'Video Players',
    color: '#3E3E3E',
    detect: {
      scripts: [/players\.brightcove\.net/i, /brightcove\.com/i],
      html: [/brightcove/i, /bc-player/i],
    },
  },

  // ── Surveys & Feedback ──────────────────────────────────────────────────
  {
    name: 'SurveyMonkey',
    category: 'Surveys',
    color: '#00BF6F',
    detect: {
      scripts: [/surveymonkey\.com/i, /widget\.surveymonkey\.com/i],
      html: [/surveymonkey/i],
    },
  },
  {
    name: 'Typeform',
    category: 'Surveys',
    color: '#262627',
    detect: {
      scripts: [/embed\.typeform\.com/i, /typeform\.com/i],
      html: [/typeform/i, /typeform-embed/i],
    },
  },
  {
    name: 'Qualtrics',
    category: 'Surveys',
    color: '#E2231A',
    detect: {
      scripts: [/siteintercept\.qualtrics\.com/i, /qualtrics\.com/i],
      html: [/qualtrics/i, /QSI/],
    },
  },
  {
    name: 'Hotjar Surveys',
    category: 'Surveys',
    color: '#FF3C00',
    detect: {
      scripts: [/static\.hotjar\.com/i, /hotjar\.com/i, /script\.hotjar\.com/i],
      html: [/hotjar/i, /hj\(/i, /_hjSettings/i],
    },
  },
  {
    name: 'Medallia',
    category: 'Surveys',
    color: '#001E60',
    detect: {
      scripts: [/resources\.digital-cloud\.medallia\.com/i, /medallia\.com/i, /kampyle\.com/i],
      html: [/medallia/i, /kampyle/i, /nebula\.medallia/i],
    },
  },
  {
    name: 'UserVoice',
    category: 'Surveys',
    color: '#67A3D9',
    detect: {
      scripts: [/widget\.uservoice\.com/i, /uservoice\.com/i],
      html: [/uservoice/i],
    },
  },

  // ── Booking & Scheduling ────────────────────────────────────────────────
  {
    name: 'Calendly',
    category: 'Booking & Scheduling',
    color: '#006BFF',
    detect: {
      scripts: [/assets\.calendly\.com/i, /calendly\.com/i],
      html: [/calendly/i, /calendly-widget/i],
    },
  },
  {
    name: 'Acuity Scheduling',
    category: 'Booking & Scheduling',
    color: '#0083E3',
    detect: {
      scripts: [/acuityscheduling\.com/i, /squareup\.com.*acuity/i],
      html: [/acuityscheduling/i, /acuity-embed/i],
    },
  },
  {
    name: 'SimplyBook.me',
    category: 'Booking & Scheduling',
    color: '#FF6B6B',
    detect: {
      scripts: [/simplybook\.me/i, /simplybook\.asia/i],
      html: [/simplybook/i],
    },
  },

  // ── Social Proof & Urgency ──────────────────────────────────────────────
  {
    name: 'FOMO',
    category: 'Social Proof',
    color: '#FF4081',
    detect: {
      scripts: [/fomo\.com/i, /cdn\.fomo\.com/i],
      html: [/fomo-widget/i, /fomo\.com/i],
    },
  },
  {
    name: 'ProveSource',
    category: 'Social Proof',
    color: '#2196F3',
    detect: {
      scripts: [/provesrc\.com/i, /cdn\.provesrc\.com/i],
      html: [/provesrc/i],
    },
  },
  {
    name: 'Nudgify',
    category: 'Social Proof',
    color: '#FFC107',
    detect: {
      scripts: [/nudgify\.com/i, /cdn\.nudgify\.com/i],
      html: [/nudgify/i],
    },
  },
  {
    name: 'Fera.ai',
    category: 'Social Proof',
    color: '#5C6BC0',
    detect: {
      scripts: [/cdn\.fera\.ai/i, /app\.fera\.ai/i],
      html: [/fera\.ai/i, /fera-widget/i],
    },
  },
  {
    name: 'TrustPulse',
    category: 'Social Proof',
    color: '#E91E63',
    detect: {
      scripts: [/trustpulse\.com/i, /cdn\.trustpulse\.com/i],
      html: [/trustpulse/i],
    },
  },

  // ── WhatsApp & Messaging Widgets ────────────────────────────────────────
  {
    name: 'WhatsApp Chat Widget',
    category: 'Customer Engagement / CRM',
    color: '#25D366',
    detect: {
      html: [/wa\.me\//i, /api\.whatsapp\.com/i, /whatsapp-widget/i, /whatsapp-chat/i],
      scripts: [/whatsapp-widget/i, /wa-chat/i],
    },
  },
  {
    name: 'GetButton',
    category: 'Customer Engagement / CRM',
    color: '#25D366',
    detect: {
      scripts: [/getbutton\.io/i, /cdn\.getbutton\.io/i],
      html: [/getbutton/i],
    },
  },

  // ── Analytics (additional) ──────────────────────────────────────────────
  {
    name: 'Plausible',
    category: 'Analytics & Optimization Platform',
    color: '#5850EC',
    detect: {
      scripts: [/plausible\.io\/js/i, /plausible\.io/i],
      html: [/plausible/i],
    },
  },
  {
    name: 'Fathom',
    category: 'Analytics & Optimization Platform',
    color: '#9187FF',
    detect: {
      scripts: [/cdn\.usefathom\.com/i, /usefathom\.com/i],
      html: [/fathom/i],
    },
  },
  {
    name: 'Umami',
    category: 'Analytics & Optimization Platform',
    color: '#000000',
    detect: {
      scripts: [/umami\.is/i, /data-website-id/i],
      html: [/umami/i, /data-website-id/i],
    },
  },
  {
    name: 'PostHog',
    category: 'Analytics & Optimization Platform',
    color: '#F9BD2B',
    detect: {
      scripts: [/app\.posthog\.com/i, /us\.posthog\.com/i, /eu\.posthog\.com/i],
      html: [/posthog/i, /posthog-js/i],
    },
  },
  {
    name: 'Heap',
    category: 'Analytics & Optimization Platform',
    color: '#FF6D00',
    detect: {
      scripts: [/cdn\.heapanalytics\.com/i, /heapanalytics\.com/i],
      html: [/heapanalytics/i, /heap\.load/i],
    },
  },
  {
    name: 'Amplitude',
    category: 'Analytics & Optimization Platform',
    color: '#1C1C1C',
    detect: {
      scripts: [/cdn\.amplitude\.com/i, /amplitude\.com/i],
      html: [/amplitude/i, /amplitude\.getInstance/i],
    },
  },
  {
    name: 'Pendo',
    category: 'Analytics & Optimization Platform',
    color: '#EC2059',
    detect: {
      scripts: [/cdn\.pendo\.io/i, /pendo\.io/i, /pendo-io/i],
      html: [/pendo/i, /pendo-guide/i],
    },
  },
  {
    name: 'Kissmetrics',
    category: 'Analytics & Optimization Platform',
    color: '#2D5BFF',
    detect: {
      scripts: [/scripts\.kissmetrics\.com/i, /kissmetrics\.com/i],
      html: [/kissmetrics/i, /_kmq/i],
    },
  },

  // ── Email Service Providers ─────────────────────────────────────────────
  {
    name: 'Mailgun',
    category: 'Email',
    color: '#F06B54',
    detect: {
      html: [/mailgun\.org/i, /mailgun\.com/i],
      scripts: [/mailgun/i],
    },
  },
  {
    name: 'Postmark',
    category: 'Email',
    color: '#FFDE00',
    detect: {
      html: [/postmarkapp\.com/i, /postmark/i],
    },
  },
  {
    name: 'Amazon SES',
    category: 'Email',
    color: '#FF9900',
    detect: {
      html: [/amazonses\.com/i, /email\.us-east/i],
    },
  },

  // ── Databases (detectable) ──────────────────────────────────────────────
  {
    name: 'Firebase',
    category: 'Databases',
    color: '#FFCA28',
    detect: {
      scripts: [/firebase\.js/i, /firebasestorage\.googleapis\.com/i, /firebase-app\.js/i, /firebase\/\d/i],
      html: [/firebase/i, /firebaseapp\.com/i, /firebaseio\.com/i],
    },
  },
  {
    name: 'Supabase',
    category: 'Databases',
    color: '#3ECF8E',
    detect: {
      scripts: [/supabase\.co/i, /supabase\.com/i],
      html: [/supabase/i],
    },
  },

  // ── India-specific Ecommerce & Payments ─────────────────────────────────
  {
    name: 'Unicommerce',
    category: 'Ecommerce Platform',
    color: '#FF6600',
    detect: {
      scripts: [/unicommerce\.com/i],
      html: [/unicommerce/i],
    },
  },
  {
    name: 'Vinculum',
    category: 'Ecommerce Platform',
    color: '#005BAC',
    detect: {
      scripts: [/vinculum\.in/i, /vin-eretail/i],
      html: [/vinculum/i],
    },
  },
  {
    name: 'Instamojo',
    category: 'Payments & Checkout - Gateway',
    color: '#0070E0',
    detect: {
      scripts: [/instamojo\.com/i, /cdn\.instamojo\.com/i],
      html: [/instamojo/i, /instamojo-button/i],
    },
  },
  {
    name: 'BillDesk',
    category: 'Payments & Checkout - Gateway',
    color: '#003366',
    detect: {
      scripts: [/billdesk\.com/i, /pgi\.billdesk\.com/i],
      html: [/billdesk/i],
    },
  },
  {
    name: 'CCAvenue',
    category: 'Payments & Checkout - Gateway',
    color: '#1B365D',
    detect: {
      scripts: [/ccavenue\.com/i, /secure\.ccavenue/i],
      html: [/ccavenue/i],
    },
  },
  {
    name: 'PhonePe',
    category: 'Payments & Checkout - Gateway',
    color: '#5F259F',
    detect: {
      scripts: [/phonepe\.com/i, /cdn\.phonepe\.com/i],
      html: [/phonepe/i],
    },
  },
  {
    name: 'Paytm',
    category: 'Payments & Checkout - Gateway',
    color: '#00BAF2',
    detect: {
      scripts: [/paytm\.com/i, /securegw\.paytm\.in/i, /checkout\.paytm\.com/i],
      html: [/paytm/i],
    },
  },
  {
    name: 'UPI',
    category: 'Payments & Checkout - Gateway',
    color: '#4CAF50',
    detect: {
      html: [/upi:\/\//i, /upi-payment/i, /pay-with-upi/i, /upi_qr/i],
    },
  },

  // ── Social Login / Auth ─────────────────────────────────────────────────
  {
    name: 'Google Sign-In',
    category: 'Authentication',
    color: '#4285F4',
    detect: {
      scripts: [/accounts\.google\.com\/gsi/i, /apis\.google\.com.*client/i],
      html: [/g_id_onload/i, /google-signin/i, /gsi\/client/i],
    },
  },
  {
    name: 'Facebook Login',
    category: 'Authentication',
    color: '#1877F2',
    detect: {
      scripts: [/connect\.facebook\.net.*sdk/i],
      html: [/fb-login-button/i, /FB\.login/i, /fb:login/i],
    },
  },
  {
    name: 'Auth0',
    category: 'Authentication',
    color: '#EB5424',
    detect: {
      scripts: [/cdn\.auth0\.com/i, /auth0\.com/i, /auth0-js/i],
      html: [/auth0/i, /auth0-lock/i],
    },
  },
  {
    name: 'Okta',
    category: 'Authentication',
    color: '#007DC1',
    detect: {
      scripts: [/ok1static\.oktacdn\.com/i, /okta\.com/i],
      html: [/okta/i, /okta-sign-in/i],
    },
  },
  {
    name: 'Clerk',
    category: 'Authentication',
    color: '#6C47FF',
    detect: {
      scripts: [/clerk\.com/i, /clerk\.shared/i, /clerk-js/i],
      html: [/clerk\.com/i, /cl-component/i],
    },
  },

  // ── Wishlist & Registry ─────────────────────────────────────────────────
  {
    name: 'Wishlist Plus',
    category: 'Shopify Apps',
    color: '#FF6B6B',
    detect: {
      scripts: [/swymrelay/i, /swym\.it/i, /swymcdn\.com/i],
      html: [/swym/i, /swym-wishlist/i, /swymWishlist/i],
    },
  },
  {
    name: 'Wishlist King',
    category: 'Shopify Apps',
    color: '#F7B731',
    detect: {
      scripts: [/wishlistking/i, /appmate\.io.*wishlist/i],
      html: [/wishlist-king/i, /wishlistking/i],
    },
  },
  {
    name: 'Gift Reggie',
    category: 'Shopify Apps',
    color: '#E91E63',
    detect: {
      scripts: [/giftreggie/i],
      html: [/giftreggie/i, /gift-reggie/i],
    },
  },

  // ── Product Recommendations ─────────────────────────────────────────────
  {
    name: 'Rebuy',
    category: 'Personalisation',
    color: '#000000',
    detect: {
      scripts: [/rebuyengine\.com/i, /rebuy\.io/i],
      html: [/rebuy/i, /rebuy-widget/i],
    },
  },
  {
    name: 'LimeSpot',
    category: 'Personalisation',
    color: '#4CAF50',
    detect: {
      scripts: [/limespot\.com/i, /cdn\.limespot\.com/i],
      html: [/limespot/i, /ls-recommendation/i],
    },
  },
  {
    name: 'Glood.AI',
    category: 'Personalisation',
    color: '#6366F1',
    detect: {
      scripts: [/glood\.ai/i, /cdn\.glood\.ai/i],
      html: [/glood/i, /glood-widget/i],
    },
  },
  {
    name: 'Visenze',
    category: 'Personalisation',
    color: '#FF5722',
    detect: {
      scripts: [/visenze\.com/i, /search\.visenze\.com/i],
      html: [/visenze/i],
    },
  },
  {
    name: 'Barilliance Recommendations',
    category: 'Personalisation',
    color: '#FF6600',
    detect: {
      scripts: [/barilliance\.com.*recommend/i],
      html: [/barilliance.*reco/i],
    },
  },

  // ── SMS Marketing ───────────────────────────────────────────────────────
  {
    name: 'Attentive',
    category: 'Marketing automation',
    color: '#000000',
    detect: {
      scripts: [/cdn\.attn\.tv/i, /attentive\.com/i, /attn\.tv/i],
      html: [/attentive/i, /attn\.tv/i, /attentive-tag/i],
    },
  },
  {
    name: 'Postscript',
    category: 'Marketing automation',
    color: '#6C3CE1',
    detect: {
      scripts: [/postscript\.io/i, /sdk\.postscript\.io/i],
      html: [/postscript/i, /ps-widget/i],
    },
  },
  {
    name: 'Yotpo SMSBump',
    category: 'Marketing automation',
    color: '#3B82F6',
    detect: {
      scripts: [/smsbump\.com/i, /cdn\.smsbump\.com/i],
      html: [/smsbump/i],
    },
  },

  // ── Affiliate & Referral ────────────────────────────────────────────────
  {
    name: 'ReferralCandy',
    category: 'Loyalty & Rewards',
    color: '#48C9B0',
    detect: {
      scripts: [/referralcandy\.com/i, /cdn\.referralcandy\.com/i],
      html: [/referralcandy/i, /refcandy/i],
    },
  },
  {
    name: 'Friendbuy',
    category: 'Loyalty & Rewards',
    color: '#0066FF',
    detect: {
      scripts: [/friendbuy\.com/i, /djnf6e5yyirys\.cloudfront\.net/i],
      html: [/friendbuy/i],
    },
  },
  {
    name: 'Talkable',
    category: 'Loyalty & Rewards',
    color: '#39CCCC',
    detect: {
      scripts: [/talkable\.com/i, /d2jjzw81hqbuqv\.cloudfront\.net/i],
      html: [/talkable/i],
    },
  },
  {
    name: 'Extole',
    category: 'Loyalty & Rewards',
    color: '#FF6600',
    detect: {
      scripts: [/extole\.com/i, /extole\.io/i],
      html: [/extole/i],
    },
  },
  {
    name: 'Impact.com',
    category: 'Loyalty & Rewards',
    color: '#0052FF',
    detect: {
      scripts: [/impact\.com/i, /d\.impactradius-event\.com/i, /app\.impact\.com/i],
      html: [/impactradius/i, /impact\.com/i],
    },
  },

  // ── Additional technologies (Wappalyzer parity) ──────────────────────

  // Security & Fraud
  {
    name: 'Signifyd',
    category: 'Security',
    color: '#6200EA',
    detect: {
      scripts: [/cdn-scripts\.signifyd\.com/i, /signifyd\.com/i],
      html: [/signifyd/i],
    },
  },
  {
    name: 'Blue Triangle',
    category: 'Performance',
    color: '#003087',
    detect: {
      scripts: [/d\.btttag\.com/i, /btttag\.com/i, /bluetriangle\.com/i],
      html: [/btttag/i, /bluetriangle/i, /bttUT/i],
    },
  },
  {
    name: 'HSTS',
    category: 'Security',
    color: '#5C2D91',
    detect: {
      headers: [{ field: 'strict-transport-security', rx: /max-age/i }],
    },
  },

  // JavaScript Frameworks & Libraries
  {
    name: 'styled-components',
    category: 'JavaScript Frameworks',
    color: '#DB7093',
    detect: {
      html: [/sc-component-id/i, /data-styled-components/i, /data-styled-version/i, /data-styled=/i, /__sc-/i],
      scripts: [/styled-components/i],
    },
  },
  {
    name: 'Loadable-Components',
    category: 'JavaScript Libraries',
    color: '#E91E90',
    detect: {
      html: [/loadable-component/i, /__LOADABLE_REQUIRED_CHUNKS__/i, /loadable-state/i],
      scripts: [/loadable-components/i, /loadable-stats/i],
    },
  },
  {
    name: 'Boomerang',
    category: 'Performance',
    color: '#222222',
    detect: {
      scripts: [/boomerang.*\.js/i, /boomerang-/i, /BOOMR/i],
      html: [/BOOMR\b/i, /boomerang/i],
    },
  },
  {
    name: 'Apollo GraphQL',
    category: 'JavaScript Libraries',
    color: '#311C87',
    detect: {
      html: [/__APOLLO_STATE__/i, /apollo-client/i, /ApolloClient/i, /apollographql/i],
      scripts: [/apollo-client/i, /apollographql/i],
    },
  },

  // Programming Languages & Transpilers
  {
    name: 'Babel',
    category: 'JavaScript Libraries',
    color: '#F5DA55',
    detect: {
      html: [/data-babel/i, /@babel\/runtime/i, /babel-polyfill/i],
      scripts: [/@babel\/runtime/i, /babel[-.]min\.js/i, /babel-polyfill/i],
    },
  },
  {
    name: 'Java',
    category: 'Programming Languages',
    color: '#5382A1',
    detect: {
      headers: [{ field: 'x-powered-by', rx: /servlet|jsp|java|tomcat|jetty|spring|wildfly|jboss/i }],
      html: [/\.jsf\b/i, /javax\.faces/i, /jsessionid/i],
    },
  },
  {
    name: 'TypeScript',
    category: 'Programming Languages',
    color: '#3178C6',
    detect: {
      scripts: [/\.ts\.js/i, /tslib/i],
      html: [/tslib/i],
    },
  },
  {
    name: 'GraphQL',
    category: 'Programming Languages',
    color: '#E10098',
    detect: {
      html: [/graphql/i, /__GRAPHQL/i, /graphql-tag/i],
      scripts: [/graphql/i],
    },
  },

  // Advertising & Ad Tech
  {
    name: 'Google Publisher Tag',
    category: 'Advertising',
    color: '#34A853',
    detect: {
      scripts: [/securepubads\.g\.doubleclick\.net\/tag\/js\/gpt\.js/i, /googletagservices\.com\/tag\/js\/gpt\.js/i],
      html: [/googletag\.defineSlot/i, /googletag\.pubads/i],
    },
  },
  {
    name: 'DoubleClick Floodlight',
    category: 'Advertising',
    color: '#4285F4',
    detect: {
      scripts: [/fls\.doubleclick\.net/i],
      html: [/fls\.doubleclick\.net/i, /floodlight/i, /dcm_floodlight/i, /ad\.doubleclick\.net\/activity/i],
    },
  },
  {
    name: 'Nextdoor Ads',
    category: 'Advertising',
    color: '#8ED500',
    detect: {
      scripts: [/ads\.nextdoor\.com/i, /nextdoor\.com\/ads/i],
      html: [/nextdoor.*pixel/i, /ndclid/i, /ads\.nextdoor\.com/i],
    },
  },

  // Email & Marketing
  {
    name: 'LiveIntent',
    category: 'Advertising',
    color: '#F7931E',
    detect: {
      scripts: [/liadm\.com/i, /li\.liadm\.com/i, /liveintent\.com/i],
      html: [/liadm\.com/i, /liveintent/i],
    },
  },

  // Personalization & CX
  {
    name: 'RevLifter',
    category: 'Personalization',
    color: '#FF4438',
    detect: {
      scripts: [/revlifter\.io/i, /revlifter\.com/i],
      html: [/revlifter/i],
    },
  },
  {
    name: 'iGoDigital',
    category: 'Personalization',
    color: '#5C2D91',
    detect: {
      scripts: [/igodigital\.com/i, /recs\.igodigital\.com/i],
      html: [/igodigital/i],
    },
  },

  // Performance & RUM
  {
    name: 'Akamai mPulse',
    category: 'Performance',
    color: '#0096D6',
    detect: {
      scripts: [/go\.akamai\.com\/boomerang/i, /akstat\.io/i, /mpulse\.soasta\.com/i, /c\.go-mpulse\.net/i],
      html: [/mpulse/i, /akstat\.io/i, /soasta/i, /go-mpulse\.net/i],
    },
  },
  {
    name: 'Priority Hints',
    category: 'Performance',
    color: '#FF6D00',
    detect: {
      html: [/fetchpriority\s*=\s*["'](high|low|auto)["']/i, /importance\s*=\s*["'](high|low|auto)["']/i],
    },
  },

  // Livestreaming & Video
  {
    name: 'Firework',
    category: 'Video & Livestreaming',
    color: '#FF4500',
    detect: {
      scripts: [/asset\.fwcdn\d*\.com/i, /firework\.com/i, /fw-cdn\.com/i],
      html: [/fw-embed/i, /firework/i, /fwn\.tv/i],
    },
  },

  // Reverse Proxy
  {
    name: 'Envoy',
    category: 'CDN & Infrastructure',
    color: '#AC6199',
    detect: {
      headers: [{ field: 'server', rx: /envoy/i }, { field: 'x-envoy-upstream-service-time', rx: /./ }],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // NEW TECH DETECTIONS — Extended Coverage
  // ═══════════════════════════════════════════════════════════════════════

  // ── Analytics (Privacy-focused & Modern) ──────────────────────────────
  {
    name: 'PostHog', category: 'Analytics & Optimization Platform', color: '#1D4AFF',
    detect: {
      scripts: [/posthog\.js/i, /us\.posthog\.com/i, /eu\.posthog\.com/i, /app\.posthog\.com/i],
      html: [/posthog\.init/i, /posthog\.capture/i],
    },
  },
  {
    name: 'Plausible', category: 'Analytics & Optimization Platform', color: '#5850EC',
    detect: {
      scripts: [/plausible\.io\/js/i],
      html: [/plausible\.io/i],
    },
  },
  {
    name: 'Umami', category: 'Analytics & Optimization Platform', color: '#000000',
    detect: {
      scripts: [/umami\.js/i, /umami\.is\/script/i],
      html: [/data-website-id/i],
    },
  },
  {
    name: 'Fathom Analytics', category: 'Analytics & Optimization Platform', color: '#9187FF',
    detect: {
      scripts: [/cdn\.usefathom\.com/i, /usefathom\.com\/script/i],
      html: [/fathom/i],
    },
  },
  {
    name: 'Pirsch', category: 'Analytics & Optimization Platform', color: '#0B6CF4',
    detect: {
      scripts: [/api\.pirsch\.io/i, /pirsch\.min\.js/i],
    },
  },
  {
    name: 'Simple Analytics', category: 'Analytics & Optimization Platform', color: '#FF6600',
    detect: {
      scripts: [/simpleanalyticscdn\.com/i, /scripts\.simpleanalyticscdn\.com/i],
    },
  },
  {
    name: 'Mixpanel', category: 'Analytics & Optimization Platform', color: '#7856FF',
    detect: {
      scripts: [/cdn\.mxpnl\.com/i, /mixpanel\.com\/libs/i],
      html: [/mixpanel\.init/i, /mixpanel\.track/i],
    },
  },
  {
    name: 'Heap', category: 'Analytics & Optimization Platform', color: '#FF6F61',
    detect: {
      scripts: [/cdn\.heapanalytics\.com/i, /heapanalytics\.com\/js/i],
      html: [/heap\.load/i, /heap\.track/i],
    },
  },

  // ── Analytics (Extended) ────────────────────────────────────────────
  {
    name: 'Adobe Analytics', category: 'Analytics & Optimization Platform', color: '#FF0000',
    detect: {
      scripts: [/assets\.adobedtm\.com/i, /omtrdc\.net/i, /demdex\.net/i, /2o7\.net/i, /sc\.omtrdc/i],
      html: [/s_code/i, /AppMeasurement/i, /omniture/i],
    },
  },
  {
    name: 'Chartbeat', category: 'Analytics & Optimization Platform', color: '#E85C41',
    detect: {
      scripts: [/static\.chartbeat\.com/i, /chartbeat\.js/i],
      html: [/chartbeat/i, /_sf_async_config/i],
    },
  },
  {
    name: 'Parse.ly', category: 'Analytics & Optimization Platform', color: '#5BA745',
    detect: {
      scripts: [/cdn\.parsely\.com/i, /parsely\.com\/p\.js/i],
      html: [/parsely-page/i, /parsely/i],
    },
  },
  {
    name: 'Comscore', category: 'Analytics & Optimization Platform', color: '#003366',
    detect: {
      scripts: [/sb\.scorecardresearch\.com/i, /b\.scorecardresearch\.com/i, /comscore\.com/i],
      html: [/scorecardresearch/i, /comscore/i, /COMSCORE/i],
    },
  },
  {
    name: 'Snowplow', category: 'Analytics & Optimization Platform', color: '#6638B6',
    detect: {
      scripts: [/snowplow/i, /sp\.js/i, /snowplowanalytics/i],
      html: [/snowplow/i, /GlobalSnowplowNamespace/i],
    },
  },
  {
    name: 'Clicky', category: 'Analytics & Optimization Platform', color: '#FF6600',
    detect: {
      scripts: [/static\.getclicky\.com/i, /clicky\.js/i],
      html: [/clicky_site_ids/i, /getclicky/i],
    },
  },
  {
    name: 'StatCounter', category: 'Analytics & Optimization Platform', color: '#3D8EB9',
    detect: {
      scripts: [/statcounter\.com\/counter/i, /sc_project/i],
      html: [/statcounter/i, /sc_project/i],
    },
  },
  {
    name: 'GoSquared', category: 'Analytics & Optimization Platform', color: '#78BEEA',
    detect: {
      scripts: [/d1l6p2sc9645hc\.cloudfront\.net\/gosquared/i, /gosquared\.com/i],
      html: [/GoSquared/i, /_gs\(/i],
    },
  },
  {
    name: 'Woopra', category: 'Analytics & Optimization Platform', color: '#363D47',
    detect: {
      scripts: [/static\.woopra\.com/i, /woopra\.js/i],
      html: [/woopra/i],
    },
  },
  {
    name: 'Firebase Analytics', category: 'Analytics & Optimization Platform', color: '#FFCA28',
    detect: {
      scripts: [/firebase-analytics/i, /firebase.*analytics/i, /gstatic\.com\/firebasejs/i],
      html: [/firebase\.analytics/i, /firebaseAnalytics/i],
    },
  },
  {
    name: 'Kochava', category: 'Analytics & Optimization Platform', color: '#00AEEF',
    detect: {
      scripts: [/kochava\.com/i, /tracker\.kochava\.com/i],
      html: [/kochava/i],
    },
  },
  {
    name: 'Singular', category: 'Analytics & Optimization Platform', color: '#4C28FF',
    detect: {
      scripts: [/singular\.net/i, /sdk\.singular\.net/i],
    },
  },
  {
    name: 'UXCam', category: 'Analytics & Optimization Platform', color: '#2962FF',
    detect: {
      scripts: [/uxcam\.com/i],
      html: [/uxcam/i],
    },
  },
  {
    name: 'Sprig', category: 'Analytics & Optimization Platform', color: '#6C47FF',
    detect: {
      scripts: [/cdn\.sprig\.com/i, /sprig\.com/i],
      html: [/Sprig\(/i],
    },
  },
  {
    name: 'ProfitWell', category: 'Analytics & Optimization Platform', color: '#00C2FF',
    detect: {
      scripts: [/public\.profitwell\.com/i, /profitwell\.js/i],
      html: [/profitwell/i],
    },
  },
  {
    name: 'Baremetrics', category: 'Analytics & Optimization Platform', color: '#6C5CE7',
    detect: {
      scripts: [/baremetrics\.com/i],
      html: [/baremetrics/i],
    },
  },
  {
    name: 'Oribi', category: 'Analytics & Optimization Platform', color: '#6C3FFC',
    detect: {
      scripts: [/oribi\.io/i, /cdn\.oribi\.io/i],
    },
  },
  {
    name: 'Indicative', category: 'Analytics & Optimization Platform', color: '#4A4AFF',
    detect: {
      scripts: [/cdn\.indicative\.com/i, /indicative\.js/i],
    },
  },
  {
    name: 'Usabilla', category: 'Analytics & Optimization Platform', color: '#6CC04A',
    detect: {
      scripts: [/w\.usabilla\.com/i, /usabilla/i],
      html: [/usabilla/i],
    },
  },
  {
    name: 'Decibel Insight', category: 'Analytics & Optimization Platform', color: '#FF3366',
    detect: {
      scripts: [/cdn\.decibelinsight\.net/i, /decibelinsight/i],
    },
  },

  // ── Marketing Automation (Extended) ────────────────────────────────────
  {
    name: 'Eloqua', category: 'Marketing automation', color: '#FF0000',
    detect: {
      scripts: [/eloqua\.com/i, /en25\.com/i, /tracking\.eloqua/i],
      html: [/eloqua/i, /elqTrackId/i],
    },
  },
  {
    name: 'Ometria', category: 'Marketing automation', color: '#FF4081',
    detect: {
      scripts: [/cdn\.ometria\.com/i, /ometria/i],
      html: [/ometria/i],
    },
  },
  {
    name: 'Simon Data', category: 'Marketing automation', color: '#4834D4',
    detect: {
      scripts: [/simonsignal\.com/i, /simondata/i],
      html: [/simondata/i],
    },
  },
  {
    name: 'Retention.com', category: 'Marketing automation', color: '#000000',
    detect: {
      scripts: [/retention\.com/i, /cdn\.retention\.com/i],
    },
  },
  {
    name: 'Popupsmart', category: 'Marketing automation', color: '#4F46E5',
    detect: {
      scripts: [/popupsmart\.com/i, /cdn\.popupsmart\.com/i],
    },
  },
  {
    name: 'BlueConic', category: 'Marketing automation', color: '#0000FF',
    detect: {
      scripts: [/blueconic\.net/i, /cdn\.blueconic\.net/i],
      html: [/blueconic/i],
    },
  },
  {
    name: 'Lytics', category: 'Marketing automation', color: '#7B4DFF',
    detect: {
      scripts: [/c\.lytics\.io/i, /cdn\.lytics\.io/i, /api\.lytics\.io/i],
      html: [/lytics\.io/i, /getlytics/i, /jstag\.init\(/i, /jstag\.send\(/i],
    },
  },
  {
    name: 'Treasure Data', category: 'Marketing automation', color: '#E6194B',
    detect: {
      scripts: [/cdn\.treasuredata\.com/i, /treasuredata/i],
      html: [/treasuredata/i],
    },
  },
  {
    name: 'Hightouch', category: 'Marketing automation', color: '#6C3CE1',
    detect: {
      scripts: [/events\.hightouch\.io/i, /hightouch/i],
    },
  },
  {
    name: 'Census', category: 'Marketing automation', color: '#2563EB',
    detect: {
      scripts: [/app\.getcensus\.com/i, /getcensus/i],
    },
  },
  {
    name: 'Leanplum', category: 'Marketing automation', color: '#00B0FF',
    detect: {
      scripts: [/cdn\.leanplum\.com/i, /leanplum/i],
      html: [/Leanplum/i],
    },
  },
  {
    name: 'Localytics', category: 'Marketing automation', color: '#009688',
    detect: {
      scripts: [/library\.localytics\.com/i, /localytics/i],
    },
  },
  {
    name: 'Taplytics', category: 'Marketing automation', color: '#4D90FE',
    detect: {
      scripts: [/cdn\.taplytics\.com/i, /taplytics/i],
    },
  },

  // ── Monitoring & Error Tracking ───────────────────────────────────────
  {
    name: 'Sentry', category: 'Monitoring & Error Tracking', color: '#362D59',
    detect: {
      scripts: [/browser\.sentry-cdn\.com/i, /sentry\.io\/sdk/i, /sentry-cdn\.com/i],
      html: [/Sentry\.init/i, /sentry\.io/i, /dsn.*sentry/i],
    },
  },
  {
    name: 'Datadog RUM', category: 'Monitoring & Error Tracking', color: '#632CA6',
    detect: {
      scripts: [/datadog-rum/i, /datadoghq\.com\/datadog-rum/i, /dd-rum-js/i],
      html: [/datadogRum\.init/i, /DD_RUM/i],
    },
  },
  {
    name: 'New Relic', category: 'Monitoring & Error Tracking', color: '#008C99',
    detect: {
      scripts: [/js-agent\.newrelic\.com/i, /nr-data\.net/i, /newrelic\.com/i],
      html: [/NREUM/i, /newrelic/i],
      headers: [{ field: 'x-newrelic-app-data', rx: /./ }],
    },
  },
  {
    name: 'Bugsnag', category: 'Monitoring & Error Tracking', color: '#4949E4',
    detect: {
      scripts: [/d2wy8f7a9ursnm\.cloudfront\.net\/bugsnag/i, /bugsnag\.com/i],
      html: [/Bugsnag\.start/i, /bugsnag/i],
    },
  },
  {
    name: 'LogRocket', category: 'Monitoring & Error Tracking', color: '#764ABC',
    detect: {
      scripts: [/cdn\.logrocket\.io/i, /cdn\.lr-ingest\.io/i],
      html: [/LogRocket\.init/i],
    },
  },
  {
    name: 'Rollbar', category: 'Monitoring & Error Tracking', color: '#2980B9',
    detect: {
      scripts: [/rollbar\.js/i, /cdn\.rollbar\.com/i],
      html: [/Rollbar\.init/i, /rollbar/i],
    },
  },
  {
    name: 'Raygun', category: 'Monitoring & Error Tracking', color: '#FF6347',
    detect: {
      scripts: [/cdn\.raygun\.io/i, /raygun4js/i],
      html: [/rg4js/i, /raygun/i],
    },
  },

  // ── Headless CMS ──────────────────────────────────────────────────────
  {
    name: 'Contentful', category: 'Headless CMS', color: '#2478CC',
    detect: {
      scripts: [/contentful\.com/i],
      html: [/ctfassets\.net/i, /images\.ctfassets\.net/i, /contentful/i],
    },
  },
  {
    name: 'Sanity', category: 'Headless CMS', color: '#F03E2F',
    detect: {
      scripts: [/sanity\.io/i, /cdn\.sanity\.io/i],
      html: [/cdn\.sanity\.io/i, /sanity-image/i],
    },
  },
  {
    name: 'Strapi', category: 'Headless CMS', color: '#4945FF',
    detect: {
      html: [/powered by strapi/i, /strapi\.io/i],
      headers: [{ field: 'x-powered-by', rx: /strapi/i }],
    },
  },
  {
    name: 'Storyblok', category: 'Headless CMS', color: '#09B3AF',
    detect: {
      scripts: [/storyblok\.com\/storyblok-latest/i, /app\.storyblok\.com/i],
      html: [/storyblok/i],
    },
  },
  {
    name: 'DatoCMS', category: 'Headless CMS', color: '#FF7751',
    detect: {
      html: [/datocms-assets\.com/i, /www\.datocms\.com/i],
      scripts: [/datocms/i],
    },
  },
  {
    name: 'Prismic', category: 'Headless CMS', color: '#5163BA',
    detect: {
      scripts: [/prismic\.io/i, /cdn\.prismic\.io/i],
      html: [/prismic\.io/i, /prismic-dom/i],
    },
  },
  {
    name: 'Hygraph', category: 'Headless CMS', color: '#090E24',
    detect: {
      html: [/graphassets\.com/i, /media\.graphassets\.com/i, /hygraph\.com/i],
    },
  },
  {
    name: 'Builder.io', category: 'Headless CMS', color: '#18B4F4',
    detect: {
      scripts: [/cdn\.builder\.io/i, /builder\.io\/api/i],
      html: [/builder-component/i, /builder\.io/i],
    },
  },

  // ── JavaScript Frameworks (Modern) ────────────────────────────────────
  {
    name: 'HTMX', category: 'JavaScript Frameworks', color: '#3366CC',
    detect: {
      scripts: [/htmx\.org/i, /htmx\.min\.js/i],
      html: [/hx-get\s*=/i, /hx-post\s*=/i, /hx-trigger\s*=/i, /hx-swap\s*=/i],
    },
  },
  {
    name: 'Alpine.js', category: 'JavaScript Frameworks', color: '#77C1D2',
    detect: {
      scripts: [/alpinejs/i, /cdn\.jsdelivr\.net\/npm\/alpinejs/i, /alpine\.min\.js/i],
      html: [/x-data\s*=/i, /x-show\s*=/i, /x-bind\s*=/i, /x-on:/i, /@click\s*=/i],
    },
  },
  {
    name: 'Solid.js', category: 'JavaScript Frameworks', color: '#2C4F7C',
    detect: {
      scripts: [/solid-js/i],
      html: [/_\$createComponent/i, /_\$template/i],
    },
  },
  {
    name: 'Qwik', category: 'JavaScript Frameworks', color: '#AC7EF4',
    detect: {
      html: [/q:container/i, /qwik\/core/i, /q:version/i],
      scripts: [/qwik/i],
    },
  },
  {
    name: 'Astro', category: 'JavaScript Frameworks', color: '#FF5D01',
    detect: {
      html: [/astro-island/i, /astro-slot/i, /data-astro-cid/i],
      meta: [{ name: 'generator', rx: /astro/i }],
    },
  },
  {
    name: 'Remix', category: 'JavaScript Frameworks', color: '#121212',
    detect: {
      html: [/__remix_context/i, /remix\.run/i],
      scripts: [/remix/i],
    },
  },
  {
    name: 'Lit', category: 'JavaScript Frameworks', color: '#324FFF',
    detect: {
      scripts: [/lit-element/i, /lit-html/i, /@lit\//i],
      html: [/lit-element/i, /lit-html/i],
    },
  },
  {
    name: 'Stimulus', category: 'JavaScript Frameworks', color: '#77E8B9',
    detect: {
      scripts: [/stimulus/i, /stimulus\.min\.js/i],
      html: [/data-controller\s*=/i, /data-action\s*=/i, /data-target\s*=/i],
    },
  },
  {
    name: 'Turbo', category: 'JavaScript Frameworks', color: '#5CD8E5',
    detect: {
      scripts: [/turbo\.es2017/i, /hotwired\/turbo/i],
      html: [/turbo-frame/i, /turbo-stream/i, /data-turbo/i],
    },
  },
  {
    name: 'Petite Vue', category: 'JavaScript Frameworks', color: '#42B883',
    detect: {
      scripts: [/petite-vue/i],
      html: [/v-scope\s*=/i],
    },
  },

  // ── Static Site Generators ────────────────────────────────────────────
  {
    name: 'Hugo', category: 'CMS', color: '#FF4088',
    detect: {
      meta: [{ name: 'generator', rx: /hugo/i }],
      html: [/hugo-.*\.min\.css/i],
    },
  },
  {
    name: 'Jekyll', category: 'CMS', color: '#CC0000',
    detect: {
      meta: [{ name: 'generator', rx: /jekyll/i }],
      html: [/jekyll/i],
    },
  },
  {
    name: 'Eleventy', category: 'CMS', color: '#222222',
    detect: {
      meta: [{ name: 'generator', rx: /eleventy/i }],
    },
  },
  {
    name: 'Docusaurus', category: 'CMS', color: '#3ECC5F',
    detect: {
      meta: [{ name: 'generator', rx: /docusaurus/i }],
      html: [/docusaurus/i],
    },
  },

  // ── API & GraphQL ─────────────────────────────────────────────────────
  {
    name: 'GraphQL', category: 'API & Data Layer', color: '#E10098',
    detect: {
      html: [/graphql/i, /__graphql/i],
      scripts: [/graphql/i, /apollo-client/i],
    },
  },
  {
    name: 'Apollo Client', category: 'API & Data Layer', color: '#311C87',
    detect: {
      scripts: [/apollo-client/i, /apollographql/i],
      html: [/__APOLLO_STATE__/i, /ApolloClient/i],
    },
  },
  {
    name: 'tRPC', category: 'API & Data Layer', color: '#398CCB',
    detect: {
      scripts: [/trpc/i],
      html: [/trpc/i],
    },
  },
  {
    name: 'Relay', category: 'API & Data Layer', color: '#F26B00',
    detect: {
      scripts: [/relay-runtime/i, /react-relay/i],
      html: [/__relay/i],
    },
  },

  // ── State Management ──────────────────────────────────────────────────
  {
    name: 'Redux', category: 'JavaScript Libraries', color: '#764ABC',
    detect: {
      scripts: [/redux\.min\.js/i, /redux/i],
      html: [/__REDUX_STATE__/i, /redux/i, /__PRELOADED_STATE__/i],
    },
  },
  {
    name: 'MobX', category: 'JavaScript Libraries', color: '#FF9955',
    detect: {
      scripts: [/mobx/i],
      html: [/mobxReact/i, /mobx/i],
    },
  },
  {
    name: 'Zustand', category: 'JavaScript Libraries', color: '#453F39',
    detect: {
      scripts: [/zustand/i],
    },
  },

  // ── Authentication & Identity ─────────────────────────────────────────
  {
    name: 'Auth0', category: 'Authentication', color: '#EB5424',
    detect: {
      scripts: [/cdn\.auth0\.com/i, /auth0\.js/i, /auth0-spa-js/i],
      html: [/auth0/i],
    },
  },
  {
    name: 'Clerk', category: 'Authentication', color: '#6C47FF',
    detect: {
      scripts: [/clerk\.com/i, /clerk\.browser/i, /clerk-js/i],
      html: [/clerk/i, /cl-sign-in/i],
    },
  },
  {
    name: 'Supabase Auth', category: 'Authentication', color: '#3ECF8E',
    detect: {
      scripts: [/supabase/i],
      html: [/supabase/i, /SUPABASE_URL/i],
    },
  },
  {
    name: 'Okta', category: 'Authentication', color: '#007DC1',
    detect: {
      scripts: [/okta\.com/i, /okta-sign-in/i, /okta-auth-js/i],
      html: [/okta/i],
    },
  },
  {
    name: 'Keycloak', category: 'Authentication', color: '#4D4D4D',
    detect: {
      scripts: [/keycloak\.js/i, /keycloak-js/i],
      html: [/keycloak/i],
    },
  },
  {
    name: 'Firebase Auth', category: 'Authentication', color: '#FFCA28',
    detect: {
      scripts: [/firebase.*auth/i, /firebaseauth/i, /gstatic\.com\/firebasejs/i],
      html: [/firebase.*auth/i, /firebaseAuth/i],
    },
  },

  // ── Databases & Backend ───────────────────────────────────────────────
  {
    name: 'Firebase', category: 'Databases', color: '#FFCA28',
    detect: {
      scripts: [/firebasestorage\.googleapis\.com/i, /gstatic\.com\/firebasejs/i, /firebase-app/i],
      html: [/firebaseapp\.com/i, /firebaseio\.com/i],
    },
  },
  {
    name: 'Supabase', category: 'Databases', color: '#3ECF8E',
    detect: {
      scripts: [/supabase\.co/i, /supabase-js/i],
      html: [/supabase\.co/i],
    },
  },
  {
    name: 'PlanetScale', category: 'Databases', color: '#000000',
    detect: {
      html: [/planetscale/i],
    },
  },
  {
    name: 'Neon', category: 'Databases', color: '#00E599',
    detect: {
      html: [/neon\.tech/i],
    },
  },
  {
    name: 'Upstash', category: 'Databases', color: '#00E9A3',
    detect: {
      html: [/upstash\.io/i, /upstash\.com/i],
      scripts: [/upstash/i],
    },
  },

  // ── Cloud & Hosting ───────────────────────────────────────────────────
  {
    name: 'AWS', category: 'Hosting', color: '#FF9900',
    detect: {
      headers: [{ field: 'server', rx: /amazons3/i }, { field: 'x-amz-request-id', rx: /./ }, { field: 'x-amz-cf-id', rx: /./ }],
      html: [/s3\.amazonaws\.com/i, /\.s3\./i],
      scripts: [/s3\.amazonaws\.com/i],
    },
  },
  {
    name: 'Google Cloud', category: 'Hosting', color: '#4285F4',
    detect: {
      headers: [{ field: 'server', rx: /google frontend/i }, { field: 'via', rx: /google/i }],
      html: [/storage\.googleapis\.com/i],
      scripts: [/storage\.googleapis\.com/i],
    },
  },
  {
    name: 'Azure', category: 'Hosting', color: '#0078D4',
    detect: {
      headers: [{ field: 'server', rx: /microsoft-azure/i }, { field: 'x-azure-ref', rx: /./ }],
      html: [/\.azurewebsites\.net/i, /\.azure\.com/i, /blob\.core\.windows\.net/i],
    },
  },
  {
    name: 'DigitalOcean', category: 'Hosting', color: '#0080FF',
    detect: {
      headers: [{ field: 'server', rx: /digitalocean/i }],
      html: [/digitaloceanspaces\.com/i],
    },
  },
  {
    name: 'Render', category: 'Hosting', color: '#46E3B7',
    detect: {
      headers: [{ field: 'server', rx: /render/i }, { field: 'x-render-origin-server', rx: /./ }],
    },
  },
  {
    name: 'Railway', category: 'Hosting', color: '#0B0D0E',
    detect: {
      headers: [{ field: 'server', rx: /railway/i }],
    },
  },
  {
    name: 'Fly.io', category: 'Hosting', color: '#7B3FF2',
    detect: {
      headers: [{ field: 'server', rx: /fly/i }, { field: 'fly-request-id', rx: /./ }],
    },
  },
  {
    name: 'Heroku', category: 'Hosting', color: '#430098',
    detect: {
      headers: [{ field: 'via', rx: /heroku/i }],
      html: [/herokuapp\.com/i],
    },
  },

  // ── Feature Flags ─────────────────────────────────────────────────────
  {
    name: 'LaunchDarkly', category: 'A/B Testing', color: '#405BFF',
    detect: {
      scripts: [/launchdarkly/i, /ld\.elements\.com/i],
      html: [/launchdarkly/i],
    },
  },
  {
    name: 'Flagsmith', category: 'A/B Testing', color: '#3D4EF5',
    detect: {
      scripts: [/flagsmith/i, /cdn\.flagsmith\.com/i],
      html: [/flagsmith/i],
    },
  },
  {
    name: 'Statsig', category: 'A/B Testing', color: '#194B7D',
    detect: {
      scripts: [/statsig/i, /cdn\.statsig\.com/i],
    },
  },
  {
    name: 'Unleash', category: 'A/B Testing', color: '#1A4049',
    detect: {
      scripts: [/unleash-proxy-client/i, /getunleash\.io/i],
    },
  },

  // ── Form Builders & Survey ────────────────────────────────────────────
  {
    name: 'Typeform', category: 'Surveys', color: '#262627',
    detect: {
      scripts: [/embed\.typeform\.com/i],
      html: [/typeform/i, /tf-v1\.js/i],
    },
  },
  {
    name: 'Tally', category: 'Surveys', color: '#2B3148',
    detect: {
      scripts: [/tally\.so\/widgets/i],
      html: [/tally\.so/i],
    },
  },
  {
    name: 'JotForm', category: 'Surveys', color: '#FFB629',
    detect: {
      scripts: [/jotform\.com/i, /jotfor\.ms/i],
      html: [/jotform/i],
    },
  },

  // ── Notification Services ─────────────────────────────────────────────
  {
    name: 'OneSignal', category: 'Push notifications', color: '#E54B4D',
    detect: {
      scripts: [/onesignal\.com/i, /OneSignalSDK/i],
      html: [/onesignal/i],
    },
  },
  {
    name: 'Pushwoosh', category: 'Push notifications', color: '#0088CC',
    detect: {
      scripts: [/pushwoosh/i, /pushwoosh-web-notifications/i],
    },
  },
  {
    name: 'Pusher', category: 'Push notifications', color: '#300D4F',
    detect: {
      scripts: [/js\.pusher\.com/i, /pusher\.min\.js/i],
      html: [/Pusher\(/i],
    },
  },

  // ── Image & Media Optimization ────────────────────────────────────────
  {
    name: 'Imgix', category: 'CDN & Infrastructure', color: '#FF5A5F',
    detect: {
      html: [/imgix\.net/i],
      scripts: [/imgix/i],
    },
  },
  {
    name: 'Cloudinary', category: 'CDN & Infrastructure', color: '#3448C5',
    detect: {
      html: [/res\.cloudinary\.com/i, /cloudinary\.com/i],
      scripts: [/cloudinary/i],
    },
  },
  {
    name: 'ImageKit', category: 'CDN & Infrastructure', color: '#1673FF',
    detect: {
      html: [/ik\.imagekit\.io/i, /imagekit\.io/i],
    },
  },
  {
    name: 'Uploadcare', category: 'CDN & Infrastructure', color: '#3771FF',
    detect: {
      html: [/ucarecdn\.com/i, /uploadcare/i],
      scripts: [/uploadcare/i],
    },
  },

  // ── Consent & Privacy ─────────────────────────────────────────────────
  {
    name: 'OneTrust', category: 'Cookie Compliance', color: '#1B4B37',
    detect: {
      scripts: [/cdn\.cookielaw\.org/i, /onetrust\.com/i, /optanon/i],
      html: [/onetrust/i, /optanon/i, /cookie-consent/i],
    },
  },
  {
    name: 'TrustArc', category: 'Cookie Compliance', color: '#006D77',
    detect: {
      scripts: [/consent\.trustarc\.com/i, /trustarc/i],
      html: [/trustarc/i, /truste/i],
    },
  },
  {
    name: 'Didomi', category: 'Cookie Compliance', color: '#3CDBC0',
    detect: {
      scripts: [/sdk\.privacy-center\.org/i, /didomi/i],
      html: [/didomi/i],
    },
  },
  {
    name: 'Usercentrics', category: 'Cookie Compliance', color: '#1F3044',
    detect: {
      scripts: [/usercentrics/i, /app\.usercentrics\.eu/i],
      html: [/usercentrics/i],
    },
  },

  // ── Customer Data Platforms ───────────────────────────────────────────
  {
    name: 'Segment', category: 'Customer Engagement / CRM', color: '#52BD94',
    detect: {
      scripts: [/cdn\.segment\.com/i, /segment\.io/i, /analytics\.min\.js/i],
      html: [/analytics\.identify/i, /analytics\.track/i, /segment\.com/i],
    },
  },
  {
    name: 'mParticle', category: 'Customer Engagement / CRM', color: '#04B486',
    detect: {
      scripts: [/jssdkcdn\.mparticle\.com/i, /mparticle/i],
      html: [/mParticle/i],
    },
  },
  {
    name: 'RudderStack', category: 'Customer Engagement / CRM', color: '#4F46E5',
    detect: {
      scripts: [/cdn\.rudderlabs\.com/i, /rudderanalytics/i],
      html: [/rudderanalytics/i],
    },
  },
  {
    name: 'Amplitude', category: 'Analytics & Optimization Platform', color: '#1C86EE',
    detect: {
      scripts: [/cdn\.amplitude\.com/i, /amplitude\.min\.js/i],
      html: [/amplitude\.getInstance/i, /amplitude\.init/i],
    },
  },

  // ── Accessibility ─────────────────────────────────────────────────────
  {
    name: 'AccessiBe', category: 'Accessibility', color: '#4A68F9',
    detect: {
      scripts: [/acsbapp\.com/i, /accessibe/i, /acsb\.js/i],
      html: [/acsb-trigger/i],
    },
  },
  {
    name: 'UserWay', category: 'Accessibility', color: '#2D8CFF',
    detect: {
      scripts: [/cdn\.userway\.org/i, /userway/i],
      html: [/userway/i],
    },
  },
  {
    name: 'EqualWeb', category: 'Accessibility', color: '#0055B8',
    detect: {
      scripts: [/equalweb\.com/i, /nagich\.com/i],
    },
  },

  // ── Session Replay & Heatmaps ─────────────────────────────────────────
  {
    name: 'FullStory', category: 'Analytics & Behavior', color: '#448AFF',
    detect: {
      scripts: [/fullstory\.com\/s\/fs\.js/i, /edge\.fullstory\.com/i],
      html: [/FullStory/i, /fullstory/i],
    },
  },
  {
    name: 'Mouseflow', category: 'Analytics & Behavior', color: '#FF6F00',
    detect: {
      scripts: [/cdn\.mouseflow\.com/i, /mouseflow/i],
    },
  },
  {
    name: 'Lucky Orange', category: 'Analytics & Behavior', color: '#FF6600',
    detect: {
      scripts: [/d10lpsik1i8c69\.cloudfront\.net/i, /luckyorange/i],
      html: [/luckyorange/i],
    },
  },
  {
    name: 'Smartlook', category: 'Analytics & Behavior', color: '#FFBB00',
    detect: {
      scripts: [/rec\.smartlook\.com/i, /smartlook/i],
      html: [/smartlook/i],
    },
  },

  // ── Translation & i18n ────────────────────────────────────────────────
  {
    name: 'Weglot', category: 'Translation', color: '#284AFF',
    detect: {
      scripts: [/cdn\.weglot\.com/i, /weglot/i],
      html: [/weglot/i, /wg-default/i],
    },
  },
  {
    name: 'Transifex', category: 'Translation', color: '#006394',
    detect: {
      scripts: [/cdn\.transifex\.com/i, /transifex/i],
    },
  },
  {
    name: 'Localize', category: 'Translation', color: '#5353EC',
    detect: {
      scripts: [/global\.localizecdn\.com/i, /localizejs/i],
    },
  },

  // ── Web Servers & Runtime ─────────────────────────────────────────────
  {
    name: 'Deno', category: 'Web Servers & Runtime', color: '#000000',
    detect: {
      headers: [{ field: 'server', rx: /deno/i }, { field: 'x-deno-ray', rx: /./ }],
    },
  },
  {
    name: 'Bun', category: 'Web Servers & Runtime', color: '#FBF0DF',
    detect: {
      headers: [{ field: 'server', rx: /bun/i }],
    },
  },

  // ── Design Systems & Component Libraries ──────────────────────────────
  {
    name: 'Radix UI', category: 'UI Frameworks', color: '#111111',
    detect: {
      html: [/data-radix/i, /radix-ui/i],
    },
  },
  {
    name: 'shadcn/ui', category: 'UI Frameworks', color: '#111111',
    detect: {
      html: [/data-slot/i],
    },
  },
  {
    name: 'Headless UI', category: 'UI Frameworks', color: '#66E3FF',
    detect: {
      html: [/headlessui/i, /data-headlessui/i],
    },
  },
  {
    name: 'DaisyUI', category: 'UI Frameworks', color: '#1AD1A5',
    detect: {
      html: [/daisy/i, /daisyui/i],
    },
  },
  {
    name: 'Framer Motion', category: 'JavaScript Libraries', color: '#0055FF',
    detect: {
      html: [/framer-motion/i, /data-framer/i],
      scripts: [/framer-motion/i, /framer\.com/i],
    },
  },
  {
    name: 'GSAP', category: 'JavaScript Libraries', color: '#88CE02',
    detect: {
      scripts: [/gsap\.min\.js/i, /gsap\.com/i, /greensock/i, /cdnjs.*gsap/i],
      html: [/gsap/i, /ScrollTrigger/i],
    },
  },
  {
    name: 'Three.js', category: 'JavaScript Libraries', color: '#000000',
    detect: {
      scripts: [/three\.min\.js/i, /three\.module/i, /threejs/i],
      html: [/THREE\./i],
    },
  },
  {
    name: 'Lottie', category: 'JavaScript Libraries', color: '#00DDB3',
    detect: {
      scripts: [/lottie-player/i, /lottie\.min\.js/i, /lottie-web/i, /bodymovin/i],
      html: [/lottie-player/i, /dotlottie-player/i, /bodymovin/i],
    },
  },
  {
    name: 'Swiper', category: 'JavaScript Libraries', color: '#6332F6',
    detect: {
      scripts: [/swiper-bundle/i, /swiper\.min\.js/i, /swiperjs\.com/i],
      html: [/swiper-container/i, /swiper-slide/i, /swiper-wrapper/i],
    },
  },

  // ── Booking & Scheduling ──────────────────────────────────────────────
  {
    name: 'Calendly', category: 'Booking & Scheduling', color: '#006BFF',
    detect: {
      scripts: [/assets\.calendly\.com/i, /calendly\.com\/js/i],
      html: [/calendly/i, /calendly-inline-widget/i],
    },
  },
  {
    name: 'Cal.com', category: 'Booking & Scheduling', color: '#292929',
    detect: {
      scripts: [/cal\.com\/embed/i, /app\.cal\.com/i],
      html: [/cal\.com/i, /data-cal-link/i],
    },
  },

  // ── Social & Community ────────────────────────────────────────────────
  {
    name: 'Discord Widget', category: 'Social Proof', color: '#5865F2',
    detect: {
      html: [/discord\.com\/widget/i, /discordapp\.com\/widget/i],
      scripts: [/discord/i],
    },
  },

  // ── AI & ML ───────────────────────────────────────────────────────────
  {
    name: 'Vercel AI SDK', category: 'AI & Machine Learning', color: '#000000',
    detect: {
      scripts: [/ai\.vercel\.dev/i],
      html: [/useChat/i, /useCompletion/i],
    },
  },
  {
    name: 'Chatbot (AI)', category: 'AI & Machine Learning', color: '#10A37F',
    detect: {
      html: [/chatbot/i, /chat-widget/i, /ai-assistant/i],
      scripts: [/chatbot/i, /voiceflow/i, /botpress/i, /dialogflow/i],
    },
  },
  {
    name: 'Algolia AI', category: 'AI & Machine Learning', color: '#5468FF',
    detect: {
      scripts: [/algoliasearch/i, /algolia\.net/i],
      html: [/algolia/i, /ais-/i],
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

// ── JS globals → tech mapping (detected via browser page.evaluate) ────
const JS_GLOBAL_TECHS = {
  dataLayer:      { name: 'Google Tag Manager', category: 'Tag Management', color: '#4285F4' },
  nextjs:         { name: 'Next.js', category: 'JavaScript Frameworks', color: '#000000' },
  nuxt:           { name: 'Nuxt.js', category: 'JavaScript Frameworks', color: '#00DC82' },
  shopify:        { name: 'Shopify', category: 'Ecommerce Platform', color: '#96BF48' },
  webflow:        { name: 'Webflow', category: 'Ecommerce Platform', color: '#4353FF' },
  wix:            { name: 'Wix', category: 'Ecommerce Platform', color: '#FAAD00' },
  angular:        { name: 'Angular', category: 'JavaScript Frameworks', color: '#DD0031' },
  gatsby:         { name: 'Gatsby', category: 'JavaScript Frameworks', color: '#663399' },
  remix:          { name: 'Remix', category: 'JavaScript Frameworks', color: '#000000' },
  sentry:         { name: 'Sentry', category: 'Performance & Monitoring', color: '#362D59' },
  facebookPixel:  { name: 'Facebook Pixel', category: 'Advertising & Retargeting', color: '#1877F2' },
  gtm:            { name: 'Google Tag Manager', category: 'Tag Management', color: '#4285F4' },
  hotjar:         { name: 'Hotjar', category: 'Analytics & Behavior', color: '#FF3C00' },
  intercom:       { name: 'Intercom', category: 'Customer Support', color: '#6AFDEF' },
  drift:          { name: 'Drift', category: 'Customer Support', color: '#0176FF' },
  zendesk:        { name: 'Zendesk', category: 'Customer Support', color: '#03363D' },
  hubspot:        { name: 'HubSpot', category: 'Customer Engagement / CRM', color: '#FF7A59' },
  stripe:         { name: 'Stripe', category: 'Payments & Checkout Platform', color: '#635BFF' },
  klaviyo:        { name: 'Klaviyo', category: 'Email Marketing', color: '#000000' },
  svelte:         { name: 'Svelte', category: 'JavaScript Frameworks', color: '#FF3E00' },
  react:          { name: 'React', category: 'JavaScript Frameworks', color: '#61DAFB' },
  vue:            { name: 'Vue.js', category: 'JavaScript Frameworks', color: '#4FC08D' },
  akamai:         { name: 'Akamai', category: 'CDN & Security', color: '#0096D6' },
  optimizely:     { name: 'Optimizely', category: 'A/B Testing & Personalization', color: '#0037FF' },
  amplitude:      { name: 'Amplitude', category: 'Analytics & Behavior', color: '#1E61F0' },
  mixpanel:       { name: 'Mixpanel', category: 'Analytics & Behavior', color: '#7856FF' },
  fullstory:      { name: 'FullStory', category: 'Analytics & Behavior', color: '#448C6A' },
  datadog:        { name: 'Datadog', category: 'Performance & Monitoring', color: '#632CA6' },
  newrelic:       { name: 'New Relic', category: 'Performance & Monitoring', color: '#008C99' },
  logrocket:      { name: 'LogRocket', category: 'Performance & Monitoring', color: '#764ABC' },
  dynatrace:      { name: 'Dynatrace', category: 'Performance & Monitoring', color: '#1496FF' },
};

// ── Cookie patterns → tech mapping ───────────────────────────────────
const COOKIE_TECHS = [
  { rx: /(?:^|;\s*)_ga=/, tech: { name: 'Google Analytics', category: 'Analytics & Optimization Platform', color: '#E37400' } },
  { rx: /(?:^|;\s*)_gid=/, tech: { name: 'Google Analytics', category: 'Analytics & Optimization Platform', color: '#E37400' } },
  { rx: /(?:^|;\s*)_fbp=/, tech: { name: 'Facebook Pixel', category: 'Advertising & Retargeting', color: '#1877F2' } },
  { rx: /(?:^|;\s*)hubspotutk=/, tech: { name: 'HubSpot', category: 'Customer Engagement / CRM', color: '#FF7A59' } },
  { rx: /(?:^|;\s*)_hjid=/, tech: { name: 'Hotjar', category: 'Analytics & Behavior', color: '#FF3C00' } },
  { rx: /(?:^|;\s*)intercom-/, tech: { name: 'Intercom', category: 'Customer Support', color: '#6AFDEF' } },
  { rx: /(?:^|;\s*)mp_[a-f0-9]+_mixpanel=/, tech: { name: 'Mixpanel', category: 'Analytics & Behavior', color: '#7856FF' } },
  { rx: /(?:^|;\s*)ajs_anonymous_id=/, tech: { name: 'Segment', category: 'Analytics & Behavior', color: '#52BD95' } },
  { rx: /(?:^|;\s*)_clck=/, tech: { name: 'Microsoft Clarity', category: 'Analytics & Behavior', color: '#0078D4' } },
  { rx: /(?:^|;\s*)__cf_bm=/, tech: { name: 'Cloudflare', category: 'CDN & Security', color: '#F38020' } },
  { rx: /(?:^|;\s*)ak_bmsc=/, tech: { name: 'Akamai', category: 'CDN & Security', color: '#0096D6' } },
  { rx: /(?:^|;\s*)_pin_unauth=/, tech: { name: 'Pinterest Tag', category: 'Advertising & Retargeting', color: '#E60023' } },
  { rx: /(?:^|;\s*)_tt_enable_cookie=/, tech: { name: 'TikTok Pixel', category: 'Advertising & Retargeting', color: '#000000' } },
  { rx: /(?:^|;\s*)_uetsid=/, tech: { name: 'Microsoft Advertising', category: 'Advertising & Retargeting', color: '#0078D4' } },
  { rx: /(?:^|;\s*)_shopify/, tech: { name: 'Shopify', category: 'Ecommerce Platform', color: '#96BF48' } },
  { rx: /(?:^|;\s*)__kla_id=/, tech: { name: 'Klaviyo', category: 'Email Marketing', color: '#000000' } },
  { rx: /(?:^|;\s*)_gcl_au=/, tech: { name: 'Google Ads', category: 'Advertising & Retargeting', color: '#4285F4' } },
  { rx: /(?:^|;\s*)_s_cc=/, tech: { name: 'Adobe Analytics', category: 'Analytics & Optimization Platform', color: '#FA0F00' } },
  { rx: /(?:^|;\s*)AMCV_/, tech: { name: 'Adobe Experience Cloud', category: 'Analytics & Optimization Platform', color: '#FA0F00' } },
  { rx: /(?:^|;\s*)mbox=/, tech: { name: 'Adobe Target', category: 'A/B Testing & Personalization', color: '#FA0F00' } },
  { rx: /(?:^|;\s*)utag_main=/, tech: { name: 'Tealium', category: 'Tag Management', color: '#1C6FBA' } },
  { rx: /(?:^|;\s*)cto_bundle=/, tech: { name: 'Criteo', category: 'Advertising & Retargeting', color: '#FF6600' } },
  { rx: /(?:^|;\s*)_qm/, tech: { name: 'Quantum Metric', category: 'Analytics & Behavior', color: '#6C2BD9' } },
  { rx: /(?:^|;\s*)IR_gbd=/, tech: { name: 'Impact', category: 'Affiliate Marketing', color: '#000000' } },
  { rx: /(?:^|;\s*)_cs_c=/, tech: { name: 'ContentSquare', category: 'Analytics & Behavior', color: '#5B57D5' } },
  { rx: /(?:^|;\s*)scarab\.visitor=/, tech: { name: 'Emarsys', category: 'Email Marketing', color: '#6B2D5B' } },
];

// ── Network URL patterns → tech mapping ──────────────────────────────
const NETWORK_URL_TECHS = [
  { rx: /google-analytics\.com\/analytics\.js|googletagmanager\.com\/gtag\/js\?id=(?:UA-|G-)/i, tech: { name: 'Google Analytics', category: 'Analytics & Optimization Platform', color: '#E37400' } },
  { rx: /googletagmanager\.com\/gtm/i, tech: { name: 'Google Tag Manager', category: 'Tag Management', color: '#4285F4' } },
  { rx: /connect\.facebook\.net\/.*\/fbevents/i, tech: { name: 'Facebook Pixel', category: 'Advertising & Retargeting', color: '#1877F2' } },
  { rx: /cdn\.segment\.com|api\.segment\.io/i, tech: { name: 'Segment', category: 'Analytics & Behavior', color: '#52BD95' } },
  { rx: /static\.hotjar\.com|script\.hotjar\.com/i, tech: { name: 'Hotjar', category: 'Analytics & Behavior', color: '#FF3C00' } },
  { rx: /js\.hs-scripts\.com|js\.hsforms\.net/i, tech: { name: 'HubSpot', category: 'Customer Engagement / CRM', color: '#FF7A59' } },
  { rx: /widget\.intercom\.io|js\.intercomcdn\.com/i, tech: { name: 'Intercom', category: 'Customer Support', color: '#6AFDEF' } },
  { rx: /static\.zdassets\.com|ekr\.zdassets\.com/i, tech: { name: 'Zendesk', category: 'Customer Support', color: '#03363D' } },
  { rx: /js\.stripe\.com|m\.stripe\.network/i, tech: { name: 'Stripe', category: 'Payments & Checkout Platform', color: '#635BFF' } },
  { rx: /cdn\.amplitude\.com|api\.amplitude\.com/i, tech: { name: 'Amplitude', category: 'Analytics & Behavior', color: '#1E61F0' } },
  { rx: /cdn\.mxpnl\.com|api-js\.mixpanel\.com/i, tech: { name: 'Mixpanel', category: 'Analytics & Behavior', color: '#7856FF' } },
  { rx: /clarity\.ms/i, tech: { name: 'Microsoft Clarity', category: 'Analytics & Behavior', color: '#0078D4' } },
  { rx: /browser\.sentry-cdn\.com|sentry\.io/i, tech: { name: 'Sentry', category: 'Performance & Monitoring', color: '#362D59' } },
  { rx: /cdn\.optimizely\.com/i, tech: { name: 'Optimizely', category: 'A/B Testing & Personalization', color: '#0037FF' } },
  { rx: /cdn\.cookielaw\.org|optanon/i, tech: { name: 'OneTrust', category: 'Cookie Consent', color: '#1F4E46' } },
  { rx: /cdn\.onetrust\.com/i, tech: { name: 'OneTrust', category: 'Cookie Consent', color: '#1F4E46' } },
  { rx: /js-agent\.newrelic\.com|bam\.nr-data\.net/i, tech: { name: 'New Relic', category: 'Performance & Monitoring', color: '#008C99' } },
  { rx: /ruxitagentjs|js-cdn\.dynatrace\.com|bf-[a-z0-9-]+\.dynatrace\.com|\.live\.dynatrace\.com|dynatrace\.com\/(?:jstag|rb_)/i, tech: { name: 'Dynatrace', category: 'Performance & Monitoring', color: '#1496FF' } },
  { rx: /cdn\.taboola\.com/i, tech: { name: 'Taboola', category: 'Advertising & Retargeting', color: '#0052CC' } },
  { rx: /cdn\.outbrain\.com/i, tech: { name: 'Outbrain', category: 'Advertising & Retargeting', color: '#FF6600' } },
  { rx: /bat\.bing\.com|bat\.r\.msn\.com/i, tech: { name: 'Microsoft Advertising', category: 'Advertising & Retargeting', color: '#0078D4' } },
  { rx: /analytics\.tiktok\.com|analytics\.tiktok\.com/i, tech: { name: 'TikTok Pixel', category: 'Advertising & Retargeting', color: '#000000' } },
  { rx: /snap\.licdn\.com|px\.ads\.linkedin\.com/i, tech: { name: 'LinkedIn Insight Tag', category: 'Advertising & Retargeting', color: '#0A66C2' } },
  { rx: /s\.pinimg\.com\/ct\/core\.js|ct\.pinterest\.com/i, tech: { name: 'Pinterest Tag', category: 'Advertising & Retargeting', color: '#E60023' } },
  { rx: /static\.klaviyo\.com|a\.klaviyo\.com/i, tech: { name: 'Klaviyo', category: 'Email Marketing', color: '#000000' } },
  { rx: /cdn\.shopify\.com/i, tech: { name: 'Shopify', category: 'Ecommerce Platform', color: '#96BF48' } },
  { rx: /d2wy8f7a9ursnm\.cloudfront\.net|bugsnag/i, tech: { name: 'Bugsnag', category: 'Performance & Monitoring', color: '#4949E4' } },
  { rx: /cdn\.jsdelivr\.net/i, tech: { name: 'jsDelivr CDN', category: 'CDN & Security', color: '#E84D3D' } },
  { rx: /unpkg\.com/i, tech: { name: 'unpkg', category: 'CDN & Security', color: '#000000' } },
  { rx: /cdn\.datatables\.net/i, tech: { name: 'DataTables', category: 'JavaScript Libraries', color: '#336699' } },
  { rx: /js\.braintreegateway\.com|client-analytics\.braintreegateway\.com/i, tech: { name: 'Braintree', category: 'Payments & Checkout Platform', color: '#003366' } },
  { rx: /www\.paypal\.com\/sdk|www\.paypalobjects\.com/i, tech: { name: 'PayPal', category: 'Payments & Checkout Platform', color: '#003087' } },
  { rx: /cdn\.branch\.io|app\.link/i, tech: { name: 'Branch', category: 'Mobile Attribution', color: '#009CDB' } },
  { rx: /appsflyer\.com|onelink\.me/i, tech: { name: 'AppsFlyer', category: 'Mobile Attribution', color: '#000000' } },
  { rx: /cdn\.contentful\.com/i, tech: { name: 'Contentful', category: 'Headless CMS', color: '#2478CC' } },
  { rx: /cdn\.sanity\.io/i, tech: { name: 'Sanity', category: 'Headless CMS', color: '#F03E2F' } },
  { rx: /images\.ctfassets\.net/i, tech: { name: 'Contentful', category: 'Headless CMS', color: '#2478CC' } },
  { rx: /cdn\.builder\.io/i, tech: { name: 'Builder.io', category: 'Headless CMS', color: '#000000' } },
  { rx: /widgets\.judge\.me/i, tech: { name: 'Judge.me', category: 'Reviews & UGC', color: '#000000' } },
  { rx: /staticw2\.yotpo\.com|api\.yotpo\.com/i, tech: { name: 'Yotpo', category: 'Reviews & UGC', color: '#1252FF' } },
  { rx: /stamped\.io/i, tech: { name: 'Stamped.io', category: 'Reviews & UGC', color: '#000000' } },
  { rx: /widget\.trustpilot\.com/i, tech: { name: 'Trustpilot', category: 'Reviews & UGC', color: '#00B67A' } },
  { rx: /cdn\.dynamicyield\.com/i, tech: { name: 'Dynamic Yield', category: 'A/B Testing & Personalization', color: '#6236FF' } },
  { rx: /assets\.adobedtm\.com|launch-.*\.adobedtm\.com/i, tech: { name: 'Adobe Launch', category: 'Tag Management', color: '#FA0F00' } },
  { rx: /dpm\.demdex\.net|assets\.adobedtm\.com/i, tech: { name: 'Adobe Experience Cloud', category: 'Analytics & Optimization Platform', color: '#FA0F00' } },
  { rx: /rum-static\.pingdom\.net/i, tech: { name: 'Pingdom', category: 'Performance & Monitoring', color: '#FFF200' } },
  { rx: /cdn\.speedcurve\.com/i, tech: { name: 'SpeedCurve', category: 'Performance & Monitoring', color: '#F26522' } },
  { rx: /fast\.wistia\.com|wistia\.net/i, tech: { name: 'Wistia', category: 'Video', color: '#54BBFF' } },
  { rx: /player\.vimeo\.com/i, tech: { name: 'Vimeo', category: 'Video', color: '#1AB7EA' } },
  { rx: /www\.youtube\.com\/iframe_api|youtube\.com\/embed/i, tech: { name: 'YouTube', category: 'Video', color: '#FF0000' } },
  { rx: /recaptcha.*google\.com|www\.google\.com\/recaptcha/i, tech: { name: 'reCAPTCHA', category: 'Security', color: '#4285F4' } },
  { rx: /challenges\.cloudflare\.com/i, tech: { name: 'Cloudflare Turnstile', category: 'Security', color: '#F38020' } },
  { rx: /cdn\.cookiebot\.com/i, tech: { name: 'Cookiebot', category: 'Cookie Consent', color: '#1A2E3B' } },
  { rx: /quantcast\.mgr\.consensu\.org/i, tech: { name: 'Quantcast Choice', category: 'Cookie Consent', color: '#000000' } },
  // Additional common techs for better coverage
  { rx: /tags\.tiqcdn\.com|collect\.tealiumiq\.com|tealium/i, tech: { name: 'Tealium', category: 'Tag Management', color: '#1C6FBA' } },
  { rx: /cdn\.tt\.omtrdc\.net|tt\.omtrdc\.net|mboxedge/i, tech: { name: 'Adobe Target', category: 'A/B Testing & Personalization', color: '#FA0F00' } },
  { rx: /quantummetric\.com|cdn\.quantummetric\.com/i, tech: { name: 'Quantum Metric', category: 'Analytics & Behavior', color: '#6C2BD9' } },
  { rx: /cdn\.mouseflow\.com|mouseflow\.com\/projects/i, tech: { name: 'Mouseflow', category: 'Analytics & Behavior', color: '#FF6B00' } },
  { rx: /cdn\.heapanalytics\.com|heapanalytics\.com/i, tech: { name: 'Heap', category: 'Analytics & Behavior', color: '#7B68EE' } },
  { rx: /cdn\.attn\.tv|attentivemobile\.com/i, tech: { name: 'Attentive', category: 'SMS Marketing', color: '#000000' } },
  { rx: /bat\.bing\.com\/bat\.js/i, tech: { name: 'Bing UET', category: 'Advertising & Retargeting', color: '#008373' } },
  { rx: /cdn\.krxd\.net|beacon\.krxd\.net/i, tech: { name: 'Salesforce DMP (Krux)', category: 'Data Management', color: '#00A1E0' } },
  { rx: /cdn\.appdynamics\.com|eum-static\.appdynamics/i, tech: { name: 'AppDynamics', category: 'Performance & Monitoring', color: '#00BCD4' } },
  { rx: /cdn\.cookielaw\.org|cdn\.cookiepro\.com/i, tech: { name: 'OneTrust CookiePro', category: 'Cookie Consent', color: '#1F4E46' } },
  { rx: /nexus\.ensighten\.com|ensighten\.com/i, tech: { name: 'Ensighten', category: 'Tag Management', color: '#5B2D8E' } },
  { rx: /cdn\.userreplay\.net|cdn\.sessioncam\.com/i, tech: { name: 'SessionCam', category: 'Analytics & Behavior', color: '#2196F3' } },
  { rx: /consent\.trustarc\.com|choices\.trustarc\.com/i, tech: { name: 'TrustArc', category: 'Cookie Consent', color: '#00AEEF' } },
  { rx: /cdn\.mparticle\.com|jssdkcdns\.mparticle\.com/i, tech: { name: 'mParticle', category: 'Customer Data Platform', color: '#368DFF' } },
  { rx: /cdn\.usefathom\.com/i, tech: { name: 'Fathom Analytics', category: 'Analytics & Optimization Platform', color: '#9187FF' } },
  { rx: /plausible\.io\/js/i, tech: { name: 'Plausible', category: 'Analytics & Optimization Platform', color: '#5850EC' } },
  { rx: /cdn\.rudderlabs\.com|rudderstack/i, tech: { name: 'RudderStack', category: 'Customer Data Platform', color: '#5850EC' } },
  { rx: /bazaarvoice\.com|display\.ugc\.bazaarvoice/i, tech: { name: 'Bazaarvoice', category: 'Reviews & UGC', color: '#003B5C' } },
  { rx: /powerreviews\.com/i, tech: { name: 'PowerReviews', category: 'Reviews & UGC', color: '#00B67A' } },
  { rx: /searchspring\.net|cdn\.searchspring\.net/i, tech: { name: 'SearchSpring', category: 'Site Search', color: '#F26522' } },
  { rx: /searchanise\.com/i, tech: { name: 'Searchanise', category: 'Site Search', color: '#FF6B35' } },
  { rx: /algolia\.net|algolianet\.com/i, tech: { name: 'Algolia', category: 'Site Search', color: '#003DFF' } },
  { rx: /fast\.a]?fonts\.net/i, tech: { name: 'Adobe Fonts', category: 'Font Scripts', color: '#FA0F00' } },
  { rx: /fonts\.googleapis\.com|fonts\.gstatic\.com/i, tech: { name: 'Google Fonts', category: 'Font Scripts', color: '#4285F4' } },
  { rx: /use\.typekit\.net/i, tech: { name: 'Adobe Fonts (Typekit)', category: 'Font Scripts', color: '#FA0F00' } },
  { rx: /fast\.fonts\.net/i, tech: { name: 'Fonts.com', category: 'Font Scripts', color: '#000000' } },
  { rx: /cdn\.cquotient\.com|.*\.cquotient\.com/i, tech: { name: 'Salesforce Einstein', category: 'A/B Testing & Personalization', color: '#00A1E0' } },
  { rx: /monetate\.net|cdn\.monetate\.net/i, tech: { name: 'Monetate', category: 'A/B Testing & Personalization', color: '#F26522' } },
  { rx: /cdn\.blueconic\.net/i, tech: { name: 'BlueConic', category: 'Customer Data Platform', color: '#0066CC' } },
  { rx: /cdn\.sail-horizon\.com|sail-personalize/i, tech: { name: 'Sailthru', category: 'Email Marketing', color: '#FF6600' } },
  { rx: /cdn\.listrakbi\.com|s1\.listrakbi\.com/i, tech: { name: 'Listrak', category: 'Email Marketing', color: '#0099CC' } },
  { rx: /cdn\.doofinder\.com|doofinder\.com/i, tech: { name: 'Doofinder', category: 'Site Search', color: '#4A90D9' } },
  { rx: /cdn\.nosto\.com|connect\.nosto\.com/i, tech: { name: 'Nosto', category: 'A/B Testing & Personalization', color: '#2EC76A' } },
  { rx: /cdn\.scarabresearch\.com|recommender\.scarabresearch/i, tech: { name: 'Emarsys', category: 'Email Marketing', color: '#6B2D5B' } },
  { rx: /cdn\.adoberesources\.net|omniture/i, tech: { name: 'Adobe Analytics', category: 'Analytics & Optimization Platform', color: '#FA0F00' } },
  { rx: /b\.scorecardresearch\.com|sb\.scorecardresearch/i, tech: { name: 'comScore', category: 'Analytics & Optimization Platform', color: '#003366' } },
  { rx: /cdn\.adsrvr\.org|insight\.adsrvr\.org/i, tech: { name: 'The Trade Desk', category: 'Advertising & Retargeting', color: '#0074D9' } },
  { rx: /cdn\.criteo\.com|static\.criteo\.net/i, tech: { name: 'Criteo', category: 'Advertising & Retargeting', color: '#FF6600' } },
  { rx: /cdn\.polyfill\.io|polyfill\.io\/v\d/i, tech: { name: 'Polyfill.io', category: 'JavaScript Libraries', color: '#09547A' } },
  { rx: /cdn\.jsdelivr\.net\/npm\/bootstrap/i, tech: { name: 'Bootstrap', category: 'UI Frameworks', color: '#7952B3' } },
  { rx: /cdn\.jsdelivr\.net\/npm\/jquery|code\.jquery\.com/i, tech: { name: 'jQuery', category: 'JavaScript Libraries', color: '#0769AD' } },
  { rx: /unpkg\.com\/react|cdn\.jsdelivr\.net\/npm\/react/i, tech: { name: 'React', category: 'JavaScript Frameworks', color: '#61DAFB' } },
  { rx: /cdn\.jsdelivr\.net\/npm\/vue|unpkg\.com\/vue/i, tech: { name: 'Vue.js', category: 'JavaScript Frameworks', color: '#4FC08D' } },
];

function detect({ html, headers, scriptSrcs, metaMap, cookies, jsGlobals, networkUrls }) {
  cookies = cookies || '';
  jsGlobals = jsGlobals || {};
  networkUrls = networkUrls || [];

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

  // ── JS globals detection (from browser page.evaluate) ──
  for (const [key, techInfo] of Object.entries(JS_GLOBAL_TECHS)) {
    if (jsGlobals[key] && !signals.has(techInfo.name)) {
      signals.set(techInfo.name, 2); // strong signal
    }
  }

  // ── Cookie-based detection ──
  if (cookies) {
    for (const { rx, tech } of COOKIE_TECHS) {
      if (rx.test(cookies) && !signals.has(tech.name)) {
        signals.set(tech.name, 2);
      }
    }
  }

  // ── Network URL detection (all requests intercepted by browser) ──
  if (networkUrls.length > 0) {
    for (const netUrl of networkUrls) {
      for (const { rx, tech } of NETWORK_URL_TECHS) {
        if (rx.test(netUrl) && !signals.has(tech.name)) {
          signals.set(tech.name, 2);
        }
      }
    }
  }

  const out = [];
  const seen = new Set();

  // First: output all TECH entries (original + priority catalog)
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

  // Then: output techs found via JS globals, cookies, or network URLs
  // (only if not already emitted by TECH array)
  const allExtraTechs = [
    ...Object.values(JS_GLOBAL_TECHS),
    ...COOKIE_TECHS.map(c => c.tech),
    ...NETWORK_URL_TECHS.map(n => n.tech),
  ];
  for (const tech of allExtraTechs) {
    if (!signals.has(tech.name)) continue;
    const key = `${tech.category}::${normalizeToolName(tech.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: tech.name, category: tech.category, color: tech.color });
  }

  return out;
}

/* Build a name→category lookup from all tech definitions */
const TECH_CATEGORY_MAP = {};
for (const t of TECH) {
  TECH_CATEGORY_MAP[t.name] = t.category;
}

module.exports = { detect, TECH_CATEGORY_MAP };
