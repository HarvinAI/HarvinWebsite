#!/usr/bin/env node

/**
 * D2C Validation Script
 *
 * Checks every account against Step 0 of D2C_Classification_Rules.docx.pdf:
 *   - Is this a D2C company that sells directly to consumers?
 *   - Does it have a self-serve checkout/purchase flow?
 *
 * Non-D2C accounts get:
 *   category = "Not Required"
 *   subCategory = "Non D2C Brand"
 *   businessModel = null
 *   offlineStores = "Online"
 *
 * BUT they KEEP:
 *   techStack, techCount, appPresence, monthlyVisits, trafficBand, region
 *
 * Usage:
 *   node scripts/validate-d2c.js                  # full run
 *   node scripts/validate-d2c.js --dry-run        # preview without writing
 *   node scripts/validate-d2c.js --limit 500      # limit domains
 *   node scripts/validate-d2c.js --domain bit.ly  # single domain check
 *   node scripts/validate-d2c.js --verbose        # print every decision
 */

const path = require('path');
const fs = require('fs');

// Load .env.local
try {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const { getDb } = require('../lib/scan/db');

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;
const domainIdx = args.indexOf('--domain');
const SINGLE_DOMAIN = domainIdx !== -1 ? args[domainIdx + 1] : null;

// ══════════════════════════════════════════════════════════════════════════
// STEP 0: NON-D2C DETECTION RULES
// Per D2C_Classification_Rules.docx.pdf — these are NOT D2C companies
// ══════════════════════════════════════════════════════════════════════════

// ── 1. Domain-level exclusions ────────────────────────────────────────────
// Government, education, non-profit TLDs → automatically Non-D2C
const NON_D2C_DOMAIN_PATTERNS = [
  /\.gov\b/i,                    // Government
  /\.gov\.[a-z]{2}$/i,          // gov.in, gov.uk, etc.
  /\.nic\.in$/i,                // Indian government
  /\.ac\.in$/i,                 // Indian academic
  /\.edu\b/i,                   // Education
  /\.edu\.[a-z]{2}$/i,
  /\.mil\b/i,                   // Military
  /\.org\.in$/i,                // Indian non-profits (most)
  /\.ac\.[a-z]{2}$/i,          // Academic (ac.uk, ac.jp, etc.)
];

// ── 2. Known Non-D2C domain types ─────────────────────────────────────────
// URL shorteners, dev tools, infrastructure, B2B platforms
const NON_D2C_KNOWN_DOMAINS = new Set([
  // URL shorteners
  'bit.ly', 'tinyurl.com', 'ow.ly', 'buff.ly', 't.co', 'goo.gl', 'short.io',
  'rebrand.ly', 'bl.ink', 'cutt.ly', 'is.gd', 'v.gd',
  // Link in bio / redirect
  'linktr.ee', 'linkin.bio', 'lnk.bio', 'onelink.me', 'heylink.me',
  'campsite.bio', 'beacons.ai', 'tap.bio', 'withkoji.com', 'snipfeed.co',
  // Dev tools / Infrastructure
  'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
  'npmjs.com', 'pypi.org', 'docker.com', 'kubernetes.io',
  'vercel.com', 'netlify.com', 'heroku.com', 'railway.app',
  'digitalocean.com', 'linode.com', 'vultr.com',
  // B2B SaaS
  'salesforce.com', 'hubspot.com', 'slack.com', 'monday.com',
  'notion.so', 'airtable.com', 'asana.com', 'trello.com',
  'zendesk.com', 'freshdesk.com', 'intercom.com', 'drift.com',
  'mailchimp.com', 'sendgrid.com', 'twilio.com', 'stripe.com',
  'razorpay.com', 'payu.in', 'cashfree.com', 'juspay.in',
  'segment.com', 'mixpanel.com', 'amplitude.com', 'hotjar.com',
  'datadog.com', 'newrelic.com', 'sentry.io', 'pagerduty.com',
  'atlassian.com', 'jira.com', 'confluence.com',
  'odoo.com', 'zoho.com', 'sap.com', 'oracle.com', 'servicenow.com',
  'workday.com', 'successfactors.com',
  // Enterprise software / IT services
  'accenture.com', 'tcs.com', 'infosys.com', 'wipro.com', 'hcltech.com',
  'cognizant.com', 'capgemini.com', 'deloitte.com', 'pwc.com', 'ey.com', 'kpmg.com',
  'mckinsey.com', 'bcg.com', 'bain.com',
  // Cloud providers
  'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com',
  'cloudflare.com', 'fastly.com', 'akamai.com',
  // Payment gateways (B2B infra — not consumer products)
  'paypal.com',
  // Search engines / platforms
  'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com',
  // Social platforms (they ARE consumer but not D2C product/service sellers)
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'youtube.com', 'tiktok.com', 'reddit.com', 'quora.com', 'pinterest.com',
  'whatsapp.com', 'telegram.org', 'discord.com',
  // Web builders (B2B tools)
  'wordpress.com', 'wordpress.org', 'wix.com', 'squarespace.com',
  'webflow.com', 'weebly.com', 'godaddy.com', 'namecheap.com',
  'bluehost.com', 'hostgator.com', 'siteground.com',
  // CMS / Ecommerce platforms (B2B — they power D2C sites but aren't D2C themselves)
  'shopify.com', 'bigcommerce.com', 'magento.com', 'prestashop.com',
  'woocommerce.com', 'opencart.com',
  // Analytics / Ad platforms
  'analytics.google.com', 'ads.google.com', 'business.facebook.com',
  'semrush.com', 'ahrefs.com', 'moz.com', 'similarweb.com',
  // B2B-only aggregators (NOT consumer marketplaces)
  'tradeindia.com', 'exportersindia.com',
  'thomasnet.com', 'made-in-china.com',
  // News / media aggregators
  'news.google.com', 'flipboard.com', 'feedly.com',
  // Regulators (NOT consumer-facing banks — banks like HDFC/ICICI ARE D2C)
  'rbi.org.in', 'sebi.gov.in', 'npci.org.in',
  // Government portals
  'india.gov.in', 'mygov.in', 'digilocker.gov.in',
]);

// ── 3. Category-based Non-D2C rules ──────────────────────────────────────
// ONLY truly B2B/industrial/government categories.
// Categories with consumer-facing companies are NOT here:
//   Logistics (Delhivery), Airlines (IndiGo), Healthcare (Apollo),
//   Banking (HDFC), Energy (Tata Power), Legal (Vakilsearch),
//   Crypto, Security, Sports, AR/VR, Space — all serve consumers
const NON_D2C_CATEGORIES = new Set([
  'SaaS & B2B',
  'Professional Services',
  'Manufacturing',
  'Wholesale & Distribution',
  'Cloud & DevTools',
  'Data Center & Infrastructure',
  'Web Hosting & Domains',
  'HR & Recruitment',
  'Staffing & Workforce Solutions',
  'Government & Public Sector',
  'NGO & Non-Profit',
  'International & Diplomatic Organizations',
  'Professional & Trade Associations',
  'Schools & Universities',
  'Railways & Metro',
  'Nuclear & Atomic Energy',
  'Aerospace & Defense',
  'Mining & Quarrying',
  'Chemicals & Petrochemicals',
  'Rubber, Plastics & Composites',
  'Glass, Ceramics & Nonmetallic Minerals',
  'Wire, Cable & Electrical',
  'Semiconductor & Chips',
  'Conglomerates & Holding Companies',
  'Private Equity & Venture Capital',
  'Commodities & Trading',
  'Import/Export & Trade',
  'Social Services & Welfare',
  'Cooperatives & Community Commerce',
  'Sharing & Peer-to-Peer Economy',
  'Robotics & Automation',
  'IoT & Connected Devices',
  'Quantum Computing',
  'AI & Data Science',
  'Printing & Packaging',
  'Construction & Building Materials',
  'Forestry & Timber',
  'Aquaculture & Fisheries',
  'Plantation & Cash Crops',
  'Marine & Shipping',
  'Outdoor Advertising & Signage',
]);

// ── 4. Tech stack signals for B2B ─────────────────────────────────────────
// If a site's ONLY tech stack indicates it's a B2B platform, not a consumer store
const B2B_TECH_INDICATORS = [
  'Salesforce', 'HubSpot', 'Marketo', 'Pardot', 'Eloqua',
  'SAP', 'Oracle', 'ServiceNow', 'Workday',
  'Intercom', 'Drift', 'Zendesk',
];

// ── 5. Domain name patterns for Non-D2C ───────────────────────────────────
const NON_D2C_DOMAIN_NAME_PATTERNS = [
  /\b(?:consulting|consultants?|advisory|advisors?)\b/i,
  /\b(?:solutions|technologies|infotech|techsolutions|softwares?)\b/i,
  /\b(?:associates|partners|llp|chartered|advocates)\b/i,
  /\b(?:logistics|freight|shipping|cargo|transport)\b/i,
  /\b(?:factory|industries|manufacturing|foundry|forge)\b/i,
  /\b(?:construction|builders|infra|infrastructure)\b/i,
  /\b(?:mining|quarry|minerals|metals)\b/i,
  /\b(?:chemical|pharma|biotech|laboratories)\b/i,
  /\b(?:polytechnic|college|university|institute|academy|school|iit|nit|iim)\b/i,
  /\b(?:municipality|corporation|authority|tribunal|commission|board)\b/i,
  /\b(?:bank|banking|cooperative|co-?op\s*bank|urban\s*bank|gramin\s*bank|dccb|ccb)\b/i,
  /\b(?:ngo|foundation|trust|charitable|welfare|society)\b/i,
];

// ── 6. Known D2C-safe categories ──────────────────────────────────────────
// These are always D2C — don't flag them
const SAFE_D2C_CATEGORIES = new Set([
  'Fashion & Apparel', 'Jewelry', 'Beauty & Personal Care',
  'Food & Beverage', 'Home & Living', 'Health & Wellness',
  'Baby & Kids', 'Pet Products', 'Electronics & Tech',
  'Sports & Outdoor', 'Office & Stationery', 'FMCG',
  'Grocery & Supermarket', 'Pharmacy & Optical',
]);

// ══════════════════════════════════════════════════════════════════════════
// VALIDATION LOGIC
// ══════════════════════════════════════════════════════════════════════════

function validateD2C(doc) {
  const domain = doc.normalizedDomain || '';
  const category = doc.category || '';
  const techStack = doc.techStack || [];
  const confidence = doc.categoryConfidence || '';

  // Result object
  const result = { isD2C: true, reason: null, reasonCode: null };

  // ── CHECK 0: D2C override signals ──
  // If the site has an ecommerce platform, it sells to consumers = D2C
  const ECOM_PLATFORMS = ['Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'PrestaShop', 'OpenCart',
    'Wix Stores', 'Squarespace Commerce', 'Salesforce Commerce Cloud', 'Ecwid', 'Snipcart',
    'Big Cartel', 'Volusion', '3dcart'];
  const hasEcomPlatform = techStack.some(t => ECOM_PLATFORMS.some(p => t.includes(p)));
  if (hasEcomPlatform) return result; // Definitely D2C — has checkout

  // If the site has a consumer mobile app, it serves consumers = D2C
  const appPresence = doc.appPresence || 'No App';
  if (appPresence !== 'No App') return result; // Has iOS/Android app = consumer-facing

  // ── Check 1: Domain TLD exclusions ──
  for (const pattern of NON_D2C_DOMAIN_PATTERNS) {
    if (pattern.test(domain)) {
      result.isD2C = false;
      result.reason = `Government/Academic/Non-Profit domain (${domain})`;
      result.reasonCode = 'domain_tld';
      return result;
    }
  }

  // ── Check 2: Known Non-D2C domains ──
  if (NON_D2C_KNOWN_DOMAINS.has(domain)) {
    result.isD2C = false;
    result.reason = `Known Non-D2C platform/tool (${domain})`;
    result.reasonCode = 'known_non_d2c';
    return result;
  }

  // ── Check 3: Category-based exclusion ──
  if (NON_D2C_CATEGORIES.has(category)) {
    // If confidence is high, trust it — this IS a non-D2C company
    // If confidence is low, it might be misclassified — still flag but note
    result.isD2C = false;
    result.reason = `Non-D2C category: ${category}`;
    result.reasonCode = 'non_d2c_category';
    return result;
  }

  // ── Check 4: Domain name pattern check ──
  const domainName = domain.replace(/\.[^.]+$/, '').replace(/\.[^.]+$/, ''); // strip TLD
  for (const pattern of NON_D2C_DOMAIN_NAME_PATTERNS) {
    if (pattern.test(domainName)) {
      // Only flag if category isn't a safe D2C category with high confidence
      if (!SAFE_D2C_CATEGORIES.has(category) || confidence === 'low' || !confidence) {
        result.isD2C = false;
        result.reason = `Domain name suggests Non-D2C: ${domain}`;
        result.reasonCode = 'domain_name_pattern';
        return result;
      }
    }
  }

  // ── Check 5: B2B tech stack ──
  // If the ONLY tech signals are B2B tools and there's no ecommerce platform
  const hasEcommPlatform = techStack.some(t =>
    /shopify|woocommerce|magento|bigcommerce|prestashop|opencart|salesforce commerce/i.test(t)
  );
  const hasB2BOnly = !hasEcommPlatform && techStack.length > 0 &&
    techStack.filter(t => B2B_TECH_INDICATORS.some(b => t.toLowerCase().includes(b.toLowerCase()))).length >= 3;
  if (hasB2BOnly && !SAFE_D2C_CATEGORIES.has(category)) {
    result.isD2C = false;
    result.reason = 'Tech stack indicates B2B platform (no ecommerce, multiple B2B tools)';
    result.reasonCode = 'b2b_tech_stack';
    return result;
  }

  // Unknown category does NOT mean non-D2C — it just means not yet classified.
  // These domains need scanning, not flagging.

  return result;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();
  console.log(`\n[validate-d2c] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const db = await getDb();
  const col = db.collection('company_meta');

  // Build query
  let query = {};
  if (SINGLE_DOMAIN) {
    query = { normalizedDomain: SINGLE_DOMAIN };
  }
  // We check ALL accounts — even high confidence ones might be non-D2C

  const totalCount = await col.countDocuments(query);
  console.log(`[validate-d2c] Total accounts to check: ${totalCount}`);

  let cursor = col.find(query)
    .sort({ monthlyVisits: -1 })
    .project({
      normalizedDomain: 1, category: 1, subCategory: 1,
      categoryConfidence: 1, techStack: 1, techCount: 1,
      appPresence: 1, monthlyVisits: 1, monthlyVisitsFormatted: 1,
      trafficBand: 1, region: 1, businessModel: 1, offlineStores: 1,
    });

  if (LIMIT > 0) {
    cursor = cursor.limit(LIMIT);
    console.log(`[validate-d2c] Limited to ${LIMIT} accounts`);
  }

  const allDocs = await cursor.toArray();
  console.log(`[validate-d2c] Processing ${allDocs.length} accounts...\n`);

  let d2cCount = 0;
  let nonD2CCount = 0;
  let alreadyNonD2C = 0;
  const reasonCounts = {};
  const nonD2CList = [];

  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    const domain = doc.normalizedDomain;

    // Skip already-marked Non-D2C
    if (doc.category === 'Not Required' && doc.subCategory === 'Non D2C Brand') {
      alreadyNonD2C++;
      continue;
    }

    const result = validateD2C(doc);

    if (result.isD2C) {
      d2cCount++;
      continue;
    }

    nonD2CCount++;
    reasonCounts[result.reasonCode] = (reasonCounts[result.reasonCode] || 0) + 1;

    if (VERBOSE) {
      console.log(`  NON-D2C: ${domain.padEnd(35)} ${(doc.category || '?').padEnd(30)} → ${result.reason}`);
    }

    nonD2CList.push({
      domain,
      oldCategory: doc.category || '',
      oldSubCategory: doc.subCategory || '',
      reason: result.reason,
      reasonCode: result.reasonCode,
      appPresence: doc.appPresence || 'No App',
      monthlyVisits: doc.monthlyVisits || 0,
      monthlyVisitsFormatted: doc.monthlyVisitsFormatted || '',
      trafficBand: doc.trafficBand || '',
      techCount: doc.techCount || 0,
      region: doc.region,
    });

    // Update DB — keep tech stack, app presence, traffic; change category
    if (!DRY_RUN) {
      await col.updateOne(
        { normalizedDomain: domain },
        {
          $set: {
            category: 'Not Required',
            subCategory: 'Non D2C Brand',
            categoryConfidence: 'high',
            businessModel: null,
            offlineStores: 'Online',
            d2cValidation: {
              isD2C: false,
              reason: result.reason,
              reasonCode: result.reasonCode,
              previousCategory: doc.category,
              previousSubCategory: doc.subCategory,
              validatedAt: new Date(),
            },
            // KEEP these fields untouched:
            // techStack, techCount, appPresence, monthlyVisits,
            // monthlyVisitsFormatted, trafficBand, region,
            // androidAppUrl, iosAppUrl
          },
        }
      );
    }

    // Progress
    if (i % 5000 === 0 && i > 0) {
      process.stdout.write(`\r  [${((i / allDocs.length) * 100).toFixed(0)}%] ${i}/${allDocs.length} — D2C: ${d2cCount}, Non-D2C: ${nonD2CCount}`);
    }
  }

  // Save Non-D2C list to CSV
  const safeStr = (v) => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.join('; ');
    return String(v).replace(/,/g, ';');
  };

  const csvLines = [
    'domain,oldCategory,oldSubCategory,reason,reasonCode,appPresence,monthlyVisits,monthlyVisitsFormatted,trafficBand,techCount,region',
  ];
  for (const r of nonD2CList) {
    csvLines.push([
      r.domain,
      safeStr(r.oldCategory),
      safeStr(r.oldSubCategory),
      safeStr(r.reason),
      r.reasonCode,
      safeStr(r.appPresence),
      r.monthlyVisits,
      safeStr(r.monthlyVisitsFormatted),
      safeStr(r.trafficBand),
      r.techCount,
      safeStr(r.region),
    ].join(','));
  }

  const outFile = path.resolve(__dirname, 'non-d2c-accounts.csv');
  fs.writeFileSync(outFile, csvLines.join('\n'), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n${'═'.repeat(65)}`);
  console.log(`  D2C VALIDATION REPORT${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'═'.repeat(65)}`);
  console.log(`\n  Total accounts checked:      ${allDocs.length}`);
  console.log(`  ✓ Valid D2C:                  ${d2cCount}`);
  console.log(`  ✗ Non-D2C (flagged):          ${nonD2CCount}`);
  console.log(`  ○ Already marked Non-D2C:     ${alreadyNonD2C}`);
  console.log(`  Time:                         ${elapsed}s`);
  console.log(`\n  Breakdown by reason:`);
  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sortedReasons) {
    const label = {
      'domain_tld': 'Government/Academic/Non-Profit TLD',
      'known_non_d2c': 'Known Non-D2C platform/tool',
      'non_d2c_category': 'Non-D2C industry category',
      'domain_name_pattern': 'Domain name suggests B2B/institutional',
      'b2b_tech_stack': 'B2B-only tech stack',
      'unknown_category': 'Unknown/unclassified category',
    }[code] || code;
    console.log(`    ${String(count).padStart(6)}  ${label}`);
  }
  console.log(`\n  Non-D2C accounts keep: techStack, techCount, appPresence, traffic, region`);
  console.log(`  Non-D2C accounts get:  category="Not Required", subCategory="Non D2C Brand"`);
  console.log(`\n  Saved to: ${outFile}`);
  console.log(`${'═'.repeat(65)}\n`);

  // Save progress
  fs.writeFileSync(path.resolve(__dirname, 'validate-d2c-progress.json'), JSON.stringify({
    status: 'completed',
    lastRunDate: new Date().toISOString(),
    totalChecked: allDocs.length,
    d2c: d2cCount,
    nonD2C: nonD2CCount,
    alreadyNonD2C,
    reasonCounts,
    elapsedSeconds: parseFloat(elapsed),
    dryRun: DRY_RUN,
  }, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('[validate-d2c] Fatal error:', err);
  process.exit(1);
});
