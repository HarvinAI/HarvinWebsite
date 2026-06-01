#!/usr/bin/env node
/**
 * Persist KNOWN_BRANDS classification onto existing company_meta docs.
 *
 * KNOWN_BRANDS (lib/scan/companyMeta.js) is the curated source of truth. The API
 * routes already override category/subCategory/region at READ time, but the raw
 * value stored in Mongo is what the category/region FILTERS query against — so a
 * drifted doc (e.g. canon misclassified as "News & Media") still won't surface
 * when you filter by its real category until the stored value is corrected.
 *
 * This script updates only docs whose normalizedDomain EXACTLY matches a
 * KNOWN_BRANDS key and whose stored category/subCategory/region differs. It does
 * not touch anything else.
 *
 *   node scripts/apply-known-brands.js          # apply changes
 *   node scripts/apply-known-brands.js --dry    # preview only, no writes
 */
try { require('dotenv').config({ path: '.env.local' }); } catch {
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
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');

// Load KNOWN_BRANDS from companyMeta.js (same approach as fix-unknown-categories.js)
const content = fs.readFileSync(path.join(__dirname, '..', 'lib/scan/companyMeta.js'), 'utf8');
const brandMatch = content.match(/const KNOWN_BRANDS = (\{[\s\S]*?\n\});/);
let KNOWN_BRANDS = {};
if (brandMatch) {
  try { KNOWN_BRANDS = eval('(' + brandMatch[1] + ')'); }
  catch (e) { console.error('Failed to parse KNOWN_BRANDS:', e.message); process.exit(1); }
}
console.log(`Loaded ${Object.keys(KNOWN_BRANDS).length} known brands${DRY ? '  (DRY RUN — no writes)' : ''}\n`);

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('MONGO_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('company_meta');

  const domains = Object.keys(KNOWN_BRANDS);
  const ops = [];
  let checked = 0, changed = 0;

  for (const domain of domains) {
    const brand = KNOWN_BRANDS[domain];
    const doc = await col.findOne(
      { normalizedDomain: domain },
      { projection: { normalizedDomain: 1, category: 1, subCategory: 1, region: 1 } }
    );
    if (!doc) continue;
    checked++;

    const wantCategory = brand.category;
    const wantSub = brand.subCategory || 'General';
    const wantRegion = brand.region;

    const set = {};
    if (wantCategory && doc.category !== wantCategory) set.category = wantCategory;
    if (wantSub && doc.subCategory !== wantSub) set.subCategory = wantSub;
    if (wantRegion && doc.region !== wantRegion) set.region = wantRegion;

    if (Object.keys(set).length === 0) continue;

    changed++;
    console.log(`  ${domain}`);
    if (set.category)  console.log(`      category:    ${JSON.stringify(doc.category)} → ${JSON.stringify(set.category)}`);
    if (set.subCategory) console.log(`      subCategory: ${JSON.stringify(doc.subCategory)} → ${JSON.stringify(set.subCategory)}`);
    if (set.region)    console.log(`      region:      ${JSON.stringify(doc.region)} → ${JSON.stringify(set.region)}`);

    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
  }

  if (!DRY && ops.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < ops.length; i += BATCH) {
      await col.bulkWrite(ops.slice(i, i + BATCH));
    }
  }

  console.log(`\nResults:`);
  console.log(`  Known-brand domains present in DB: ${checked}`);
  console.log(`  ${DRY ? 'Would update' : 'Updated'}: ${changed}`);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
