/**
 * Store count overrides for sites that block automated requests (403/WAF)
 * or don't expose store data on their website.
 *
 * These are manually curated and verified. The override API at
 * /api/company-meta/override can be used to add/update entries at runtime.
 *
 * Run `node lib/scan/storeOverrides.js` to seed the database.
 */
const { getDb } = require('./db');

const STORE_OVERRIDES = [
  // 403/WAF blocked sites
  { domain: 'tanishq.co.in', offlineStores: '100+', category: 'Jewelry', subCategory: 'Fine Jewelry', region: 'India' },
  { domain: 'croma.com', offlineStores: '100+', category: 'Ecommerce/Retail', subCategory: 'Electronics', region: 'India' },
  { domain: 'pepperfry.com', offlineStores: '100+', category: 'Home & Living', subCategory: 'Furniture', region: 'India' },
  { domain: 'nykaa.com', offlineStores: '100+', category: 'Beauty & Personal Care', subCategory: 'D2C Brand', region: 'India' },
  { domain: 'meesho.com', offlineStores: 'Online', category: 'Ecommerce/Retail', subCategory: 'Marketplace', region: 'India' },

  // Sites that don't expose store locator data
  { domain: 'chaipoint.com', offlineStores: '100+', category: 'Food & Beverage', subCategory: 'Cafe Chain', region: 'India' },

  // Global brands with country-specific store counts (direction link dedup issues)
  { domain: 'ikea.com', offlineStores: '1-10', category: 'Home & Living', subCategory: 'Furniture', region: 'India' },

  // Multi-country brands with region override
  { domain: 'bombayshirts.com', offlineStores: '21-50', category: 'Fashion & Apparel', subCategory: 'Custom Shirts', region: 'Global' },
];

async function seedOverrides() {
  const db = await getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  let count = 0;
  for (const site of STORE_OVERRIDES) {
    await db.collection('company_meta').updateOne(
      { normalizedDomain: site.domain },
      {
        $set: {
          normalizedDomain: site.domain,
          'overrides.offlineStores': site.offlineStores,
          'overrides.category': site.category,
          'overrides.subCategory': site.subCategory,
          'overrides.region': site.region,
          updatedAt: now,
          expiresAt,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    count++;
    console.log(`  ${site.domain} → ${site.offlineStores}`);
  }
  return count;
}

module.exports = { STORE_OVERRIDES, seedOverrides };

// Run directly: node lib/scan/storeOverrides.js
if (require.main === module) {
  seedOverrides()
    .then(n => { console.log(`Seeded ${n} overrides.`); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
