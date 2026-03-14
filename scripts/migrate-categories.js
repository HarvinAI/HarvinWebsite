#!/usr/bin/env node
/**
 * One-time migration: rename old category names to new consolidated names in company_meta.
 * Run with: node scripts/migrate-categories.js
 */
try { require('dotenv').config({ path: '.env.local' }); } catch {
  // dotenv not available — load .env.local manually
  const fs = require('fs'), path = require('path');
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
    });
  }
}
const { MongoClient } = require('mongodb');

const CATEGORY_RENAMES = {
  'Footwear':                  'Fashion & Apparel',
  'Fashion Accessories':       'Fashion & Apparel',
  'Fashion':                   'Fashion & Apparel',
  'Beauty':                    'Beauty & Personal Care',
  'Jewellery':                 'Jewelry',
  'Outdoor & Recreation':      'Sports & Outdoor',
  'Outdoor & Sports':          'Sports & Outdoor',
  'Transportation Booking':    'Transportation & Mobility',
  'Transportation':            'Transportation & Mobility',
  'Streaming Platform / OTT':  'Media & Entertainment',
  'Music & Audio Streaming':   'Media & Entertainment',
  'Gaming':                    'Media & Entertainment',
  'Luxury & Premium':          'Fashion & Apparel',
  'Books & Media':             'Office & Stationery',
  'SaaS':                      'SaaS & B2B',
  'Stationery':                'Office & Stationery',
  'Food Delivery':             'Food & Beverage',
  'Not Required':              'Unknown',
};

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('MONGO_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('company_meta');

  console.log('Starting category migration...\n');

  let totalUpdated = 0;

  for (const [oldCat, newCat] of Object.entries(CATEGORY_RENAMES)) {
    // Count first
    const count = await col.countDocuments({ category: oldCat });
    if (count === 0) {
      console.log(`  ${oldCat} → ${newCat}: 0 (skip)`);
      continue;
    }

    // Update category
    const result = await col.updateMany(
      { category: oldCat },
      { $set: { category: newCat } }
    );
    console.log(`  ${oldCat} → ${newCat}: ${result.modifiedCount} updated`);
    totalUpdated += result.modifiedCount;

    // Also update overrides.category if it matches old name
    const overrideResult = await col.updateMany(
      { 'overrides.category': oldCat },
      { $set: { 'overrides.category': newCat } }
    );
    if (overrideResult.modifiedCount > 0) {
      console.log(`    (+ ${overrideResult.modifiedCount} overrides)`);
    }
  }

  // Also fix Health & Wellness → Fitness & Gym for gym-related subcategories
  const gymFix = await col.updateMany(
    { category: 'Health & Wellness', subCategory: { $in: ['Fitness & Gym', 'Fitness App', 'Fitness Equipment'] } },
    { $set: { category: 'Fitness & Gym' } }
  );
  if (gymFix.modifiedCount > 0) {
    console.log(`  Health & Wellness (fitness subs) → Fitness & Gym: ${gymFix.modifiedCount} updated`);
    totalUpdated += gymFix.modifiedCount;
  }

  console.log(`\nDone. Total updated: ${totalUpdated}`);

  // Show new category distribution
  const cats = await col.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('\n=== New Category Distribution ===');
  cats.forEach(c => console.log(`  ${c.count}\t${c._id || 'NULL'}`));

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
