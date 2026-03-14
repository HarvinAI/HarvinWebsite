#!/usr/bin/env node
/**
 * Fix Unknown categories: apply KNOWN_BRANDS data to existing DB entries.
 * Also auto-classify .gov.in / .nic.in / .ac.in domains.
 * Run with: node scripts/fix-unknown-categories.js
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

// Load known brands from companyMeta
const fs = require('fs');
const content = fs.readFileSync(require('path').join(__dirname, '..', 'lib/scan/companyMeta.js'), 'utf8');

// Extract KNOWN_BRANDS object by evaluating the relevant portion
const brandMatch = content.match(/const KNOWN_BRANDS = (\{[\s\S]*?\n\});/);
let KNOWN_BRANDS = {};
if (brandMatch) {
  try {
    KNOWN_BRANDS = eval('(' + brandMatch[1] + ')');
  } catch (e) {
    console.error('Failed to parse KNOWN_BRANDS:', e.message);
    process.exit(1);
  }
}

console.log(`Loaded ${Object.keys(KNOWN_BRANDS).length} known brands\n`);

// Domain suffix rules for auto-classification
const SUFFIX_RULES = [
  { suffix: '.gov.in',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.nic.in',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov.bd',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov.pk',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov.id',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.go.id',   category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov.eg',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov.np',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov.sg',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov.my',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov.uk',  category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.gov',     category: 'Government & Public Sector', subCategory: 'Central Government' },
  { suffix: '.ac.in',   category: 'Schools & Universities', subCategory: 'University' },
  { suffix: '.edu.in',  category: 'Schools & Universities', subCategory: 'University' },
  { suffix: '.edu',     category: 'Schools & Universities', subCategory: 'University' },
  { suffix: '.ac.th',   category: 'Schools & Universities', subCategory: 'University' },
  { suffix: '.ac.id',   category: 'Schools & Universities', subCategory: 'University' },
  { suffix: '.ac.jp',   category: 'Schools & Universities', subCategory: 'University' },
  { suffix: '.ac.uk',   category: 'Schools & Universities', subCategory: 'University' },
  { suffix: '.org.in',  category: 'NGO & Non-Profit', subCategory: 'Foundation' },
];

function lookupBrand(domain) {
  if (KNOWN_BRANDS[domain]) return KNOWN_BRANDS[domain];
  const brandName = domain.split('.')[0];
  const comDomain = brandName + '.com';
  if (KNOWN_BRANDS[comDomain]) return KNOWN_BRANDS[comDomain];
  return null;
}

function matchSuffix(domain) {
  for (const rule of SUFFIX_RULES) {
    if (domain.endsWith(rule.suffix)) return rule;
  }
  return null;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('MONGO_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('company_meta');

  // Get all Unknown accounts
  const unknowns = await col.find(
    { category: 'Unknown' },
    { projection: { normalizedDomain: 1 } }
  ).toArray();

  console.log(`Found ${unknowns.length} Unknown accounts\n`);

  let brandFixed = 0;
  let suffixFixed = 0;
  let skipped = 0;
  const ops = [];

  for (const doc of unknowns) {
    const domain = doc.normalizedDomain;
    if (!domain) { skipped++; continue; }

    // Try known brand first
    const brand = lookupBrand(domain);
    if (brand) {
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              category: brand.category,
              subCategory: brand.subCategory || 'General',
              region: brand.region || undefined,
            }
          }
        }
      });
      brandFixed++;
      continue;
    }

    // Try suffix rules
    const rule = matchSuffix(domain);
    if (rule) {
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              category: rule.category,
              subCategory: rule.subCategory,
            }
          }
        }
      });
      suffixFixed++;
      continue;
    }

    skipped++;
  }

  // Execute bulk updates in batches
  if (ops.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < ops.length; i += BATCH) {
      const batch = ops.slice(i, i + BATCH);
      await col.bulkWrite(batch);
      process.stdout.write(`  Updated ${Math.min(i + BATCH, ops.length)}/${ops.length}\r`);
    }
    console.log();
  }

  console.log(`\nResults:`);
  console.log(`  Known brand matches: ${brandFixed}`);
  console.log(`  Domain suffix matches: ${suffixFixed}`);
  console.log(`  Still Unknown: ${skipped}`);
  console.log(`  Total fixed: ${brandFixed + suffixFixed}`);

  // Show remaining Unknown count
  const remaining = await col.countDocuments({ category: 'Unknown' });
  console.log(`\nRemaining Unknown in DB: ${remaining}`);

  // Show new category distribution
  const cats = await col.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('\n=== Updated Category Distribution ===');
  cats.forEach(c => console.log(`  ${c.count}\t${c._id || 'NULL'}`));

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
