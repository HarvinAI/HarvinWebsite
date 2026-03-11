#!/usr/bin/env node

/**
 * Backfill state/city for existing company_meta docs.
 *
 * Usage:
 *   node scripts/backfill-location.js              # process 50 at a time
 *   node scripts/backfill-location.js --batch=100  # process 100 at a time
 *   node scripts/backfill-location.js --all        # keep going until done
 */

const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI not set'); process.exit(1); }

const args = process.argv.slice(2);
const batchSize = parseInt((args.find(a => a.startsWith('--batch=')) || '--batch=50').split('=')[1], 10);
const runAll = args.includes('--all');

async function main() {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  console.log('[mongo] connected');

  const db = client.db('harvinai');
  const col = db.collection('company_meta');

  // Status
  const total = await col.countDocuments({ category: { $exists: true, $nin: [null, ''] } });
  const needBackfill = await col.countDocuments({
    category: { $exists: true, $nin: [null, ''] },
    state: { $exists: false },
  });
  const withState = await col.countDocuments({ state: { $exists: true, $nin: [null, ''] } });
  const withCity = await col.countDocuments({ city: { $exists: true, $nin: [null, ''] } });

  console.log(`Total accounts: ${total}`);
  console.log(`Already have state: ${withState}`);
  console.log(`Already have city: ${withCity}`);
  console.log(`Need backfill (no state field): ${needBackfill}`);
  console.log(`Batch size: ${batchSize}, Run all: ${runAll}`);
  console.log('---');

  if (needBackfill === 0) {
    console.log('Nothing to backfill!');
    await client.close();
    return;
  }

  // We can't re-scan every domain (too slow). Instead, for existing docs,
  // set state/city to null so the filters work. When they're re-scanned
  // via the tech scanner, they'll get proper values.
  // But we CAN try to extract location from the region field for known mappings.

  let processed = 0;
  let round = 0;

  do {
    round++;
    const docs = await col.find({ state: { $exists: false } })
      .limit(batchSize)
      .project({ normalizedDomain: 1, region: 1 })
      .toArray();

    if (docs.length === 0) break;

    const bulk = docs.map(doc => ({
      updateOne: {
        filter: { normalizedDomain: doc.normalizedDomain },
        update: { $set: { state: null, city: null } },
      },
    }));

    await col.bulkWrite(bulk);
    processed += docs.length;

    const remaining = await col.countDocuments({ state: { $exists: false } });
    console.log(`Round ${round}: marked ${docs.length} docs (total: ${processed}, remaining: ${remaining})`);

    if (!runAll) break;
  } while (true);

  // Final status
  const finalStates = await col.distinct('state', { state: { $exists: true, $nin: [null, ''] } });
  const finalCities = await col.distinct('city', { city: { $exists: true, $nin: [null, ''] } });
  console.log('---');
  console.log(`Done! Processed ${processed} docs.`);
  console.log(`States in DB: ${finalStates.length > 0 ? finalStates.join(', ') : '(none yet - will populate as brands are scanned)'}`);
  console.log(`Cities in DB: ${finalCities.length > 0 ? finalCities.join(', ') : '(none yet - will populate as brands are scanned)'}`);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
