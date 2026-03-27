#!/usr/bin/env node

/**
 * Finds all domains in the DB whose category is NOT a valid D2C category
 * per D2C_Classification_Rules.docx.pdf
 *
 * Outputs: scripts/invalid-category-domains.csv
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

// ── Valid D2C categories per D2C_Classification_Rules.docx.pdf ────────────
// Level 2: Product categories (Section 3)
// Level 3: Service categories (Section 4)
const VALID_D2C_CATEGORIES = new Set([
  // 3.1 - 3.13: Product categories
  'Fashion & Apparel',
  'Jewelry',
  'Beauty & Personal Care',
  'Food & Beverage',
  'Home & Living',
  'Health & Wellness',
  'Baby & Kids',
  'Pet Products',
  'Electronics & Tech',
  'Sports & Outdoor',       // PDF calls it "Outdoor & Recreation" but DB uses this
  'Office & Stationery',
  'FMCG',                   // Physical consumer goods — valid D2C

  // 4.1 - 4.12: Service categories
  'EdTech',
  'FinTech',
  'Health & Wellness Services',
  'Telecom',
  'Media & Entertainment',  // PDF: Streaming Platform / OTT
  'Music & Audio',          // PDF: Music & Audio Streaming
  'Gaming & Esports',       // PDF: Gaming
  'News & Media',
  'Insurance',
  'Travel & Ticketing',
  'Food Delivery',
  'Transportation & Mobility', // PDF: Transportation Booking

  // Borderline but consumer-facing (included)
  'Ecommerce/Retail',       // D2C marketplace/retail
  'Grocery & Supermarket',  // Consumer retail
  'Restaurant & Hospitality', // Consumer-facing
  'Salon & Spa',            // Consumer service
  'Fitness & Gym',          // Consumer service
  'Alcohol & Tobacco',      // Consumer products
  'Pharmacy & Optical',     // Consumer retail
  'Dating & Matchmaking',   // Consumer app
  'Betting & Fantasy Sports', // Consumer service
  'Rental & Subscription Services', // Consumer subscriptions
  'Wedding & Events',       // Consumer service
  'Social Media & Platforms', // Consumer platform
  'Home Services',          // Consumer service
  'Luxury & Premium Goods', // Consumer D2C
  'Art & Collectibles',     // Consumer products
  'Wellness Tourism & Retreats', // Consumer service
  'Tourism & Destination Management', // Consumer service
  'Dental & Oral Care',     // Consumer health products
  'Photography & Videography', // Consumer service
  'Creator Economy & Influencer', // Consumer platform
  'Amusement & Entertainment Venues', // Consumer
  'Cannabis & Hemp',        // Consumer products (where legal)
  'Handicrafts & Artisanal Goods', // Consumer D2C
  'Precious Metals, Gems & Bullion', // Consumer retail
  'Publishing & Books',     // Consumer products
  'Automotive',             // Consumer (car buying, D2C EV)
  'Real Estate',            // Consumer-facing (proptech)
  'Coworking & Office Space', // Consumer/prosumer service
  'Agriculture',            // Agri-commerce D2C
  'Elderly Care & Senior Services', // Consumer service
  'Classifieds & Listings', // Consumer platform
  'Religious & Spiritual',  // Consumer products/services
  'Personal & Domestic Services', // Consumer
  'Halal Economy & Islamic Services', // Consumer
  'Museums, Heritage & Culture', // Consumer
  'Leather & Hide Products', // Consumer D2C products
  'Textiles & Fabrics',     // Can be D2C
  'Education Services (Non-Digital)', // Consumer
  'Veterinary & Animal Health', // Consumer pet services
  'Pet Supplies',           // Legacy name used in knownBrands
  'Video & Film Production', // Consumer content
  'Cleaning & Sanitation Services', // Consumer service
  'Biotechnology',          // Some D2C biotech (23andMe etc)
]);

// ── Invalid categories per D2C Classification Rules ───────────────────────
// These are explicitly excluded in Step 0 or are B2B/industrial/government
const INVALID_D2C_CATEGORIES = [
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
  'Postal & Mail Services',
  'Social Services & Welfare',
  'Cooperatives & Community Commerce',
  'Sharing & Peer-to-Peer Economy',
  'Cybersecurity',
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
  'Security & Surveillance',
  'Legal',
  'Logistics',
  'Airlines & Aviation',
  'Environmental & Waste Management',
  'Water & Sanitation',
  'Sustainability & ESG',
  'Energy & Utilities',
  'Banking & Financial Services',
  'Wealth & Asset Management',
  'Debt, Credit & Collections',
  'Mobile Money & Agent Banking',
  'Crypto & Web3',
  'AR / VR & Metaverse',
  'Space & Satellite',
  'Sports Leagues & Professional Sports',
  'Healthcare & Hospitals',
];

const INVALID_SET = new Set(INVALID_D2C_CATEGORIES);

async function main() {
  console.log('[find-invalid] Connecting to DB...');
  const db = await getDb();
  const col = db.collection('company_meta');

  // Query for all domains with invalid categories
  console.log(`[find-invalid] Querying for domains with ${INVALID_D2C_CATEGORIES.length} invalid categories...`);

  const results = await col.find({
    category: { $in: INVALID_D2C_CATEGORIES },
  })
    .sort({ category: 1, normalizedDomain: 1 })
    .project({
      normalizedDomain: 1,
      category: 1,
      subCategory: 1,
      region: 1,
      monthlyVisits: 1,
      brandName: 1,
    })
    .toArray();

  console.log(`[find-invalid] Found ${results.length} domains with invalid D2C categories`);

  // Count by category
  const categoryCounts = {};
  for (const r of results) {
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  }

  // Also find domains with unknown/null/empty categories
  const unknownResults = await col.find({
    $or: [
      { category: { $in: [null, '', 'Unknown', 'Not Required', 'unknown'] } },
      { category: { $exists: false } },
    ],
  })
    .sort({ normalizedDomain: 1 })
    .project({
      normalizedDomain: 1,
      category: 1,
      subCategory: 1,
      region: 1,
      monthlyVisits: 1,
    })
    .toArray();

  console.log(`[find-invalid] Found ${unknownResults.length} domains with Unknown/empty categories`);

  // Also check for "Gifting" and "Pet Supplies" (legacy names not in official categories)
  const legacyResults = await col.find({
    category: { $in: ['Gifting', 'Pet Supplies', 'Footwear', 'Fashion Accessories', 'Fashion', 'Beauty', 'Jewellery', 'SaaS', 'Stationery'] },
  })
    .sort({ category: 1, normalizedDomain: 1 })
    .project({
      normalizedDomain: 1,
      category: 1,
      subCategory: 1,
      region: 1,
    })
    .toArray();

  console.log(`[find-invalid] Found ${legacyResults.length} domains with legacy/unmigrated category names`);

  // Safe string conversion
  const safeStr = (v) => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.join('; ');
    return String(v).replace(/,/g, ';');
  };

  // Build CSV
  const lines = [
    'domain,category,subCategory,region,monthlyVisits,issue',
  ];

  for (const r of results) {
    lines.push(`${safeStr(r.normalizedDomain)},${safeStr(r.category)},${safeStr(r.subCategory)},${safeStr(r.region)},${r.monthlyVisits || ''},Invalid D2C category (B2B/Industrial/Government)`);
  }

  for (const r of unknownResults) {
    lines.push(`${safeStr(r.normalizedDomain)},${safeStr(r.category)},${safeStr(r.subCategory)},${safeStr(r.region)},${r.monthlyVisits || ''},Unknown/empty category`);
  }

  for (const r of legacyResults) {
    lines.push(`${safeStr(r.normalizedDomain)},${safeStr(r.category)},${safeStr(r.subCategory)},${safeStr(r.region)},,Legacy category name (needs migration)`);
  }

  const outFile = path.resolve(__dirname, 'invalid-category-domains.csv');
  fs.writeFileSync(outFile, lines.join('\n'), 'utf-8');

  // Print summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  INVALID D2C CATEGORY DOMAINS REPORT`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  Invalid category domains:    ${results.length}`);
  console.log(`  Unknown/empty category:      ${unknownResults.length}`);
  console.log(`  Legacy unmigrated names:     ${legacyResults.length}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  TOTAL:                       ${results.length + unknownResults.length + legacyResults.length}`);

  console.log(`\n  Breakdown by invalid category:`);
  const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    console.log(`    ${String(count).padStart(5)}  ${cat}`);
  }

  console.log(`\n  Saved to: ${outFile}`);
  console.log(`${'═'.repeat(60)}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('[find-invalid] Fatal error:', err);
  process.exit(1);
});
