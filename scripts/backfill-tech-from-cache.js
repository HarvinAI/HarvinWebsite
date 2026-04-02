#!/usr/bin/env node
/**
 * Backfill Tech Stack from tech_cache → company_meta
 *
 * Many brands in company_meta have empty/missing techStack even though
 * tech_cache has their full tech data. This script syncs them.
 *
 * Usage:
 *   node scripts/backfill-tech-from-cache.js              # backfill all missing
 *   node scripts/backfill-tech-from-cache.js --dry-run     # preview only
 *   node scripts/backfill-tech-from-cache.js --limit 100   # backfill first 100
 *   node scripts/backfill-tech-from-cache.js --force        # overwrite existing techStack too
 */

const dotenvPath = require('path').join(__dirname, '..', '.env.local');
require('fs').existsSync(dotenvPath) && require('dotenv').config({ path: dotenvPath });

const { getDb } = require('../lib/scan/db');

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const DRY_RUN = hasFlag('dry-run');
const FORCE = hasFlag('force');
const LIMIT = parseInt(getArg('limit') || '0', 10);

async function main() {
  const db = await getDb();
  const metaCol = db.collection('company_meta');
  const cacheCol = db.collection('tech_cache');

  // Step 1: Find company_meta docs with missing/empty techStack
  const missingQuery = FORCE
    ? {}
    : {
        $or: [
          { techStack: { $exists: false } },
          { techStack: { $size: 0 } },
          { techStack: null },
          { techCount: { $exists: false } },
          { techCount: 0 },
          { techCount: null },
        ],
      };

  const missingCount = await metaCol.countDocuments(missingQuery);
  const totalAccounts = await metaCol.countDocuments({});
  const withTech = await metaCol.countDocuments({
    techStack: { $exists: true, $not: { $size: 0 } },
    techCount: { $gt: 0 },
  });

  console.log(`\n--- Current State ---`);
  console.log(`  Total accounts in company_meta: ${totalAccounts}`);
  console.log(`  Accounts WITH tech data:        ${withTech}`);
  console.log(`  Accounts WITHOUT tech data:     ${missingCount}`);

  // Step 2: Get all tech_cache entries
  const cacheCount = await cacheCol.countDocuments({ count: { $gt: 0 } });
  console.log(`  Entries in tech_cache:          ${cacheCount}`);

  // Step 3: Find domains in tech_cache that can backfill company_meta
  const cursor = metaCol.find(missingQuery).project({ normalizedDomain: 1, _id: 0 });
  const missingDomains = (await cursor.toArray()).map((d) => d.normalizedDomain);

  if (missingDomains.length === 0) {
    console.log('\nAll accounts already have tech data!');
    process.exit(0);
  }

  const toProcess = LIMIT > 0 ? missingDomains.slice(0, LIMIT) : missingDomains;
  console.log(`\nWill attempt to backfill ${toProcess.length} domains from tech_cache...`);

  if (DRY_RUN) {
    console.log('(DRY RUN - no changes will be made)\n');
  }

  let updated = 0;
  let noCache = 0;
  let errors = 0;
  const BATCH = 100;

  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);

    // Fetch cached tech for this batch
    const cachedDocs = await cacheCol
      .find({ domain: { $in: batch }, count: { $gt: 0 } })
      .project({ domain: 1, technologies: 1, count: 1, updatedAt: 1 })
      .toArray();

    const cacheMap = new Map();
    for (const doc of cachedDocs) {
      cacheMap.set(doc.domain, doc);
    }

    const bulkOps = [];
    for (const domain of batch) {
      const cached = cacheMap.get(domain);
      if (!cached || !cached.technologies || cached.technologies.length === 0) {
        noCache++;
        continue;
      }

      const techNames = cached.technologies.map((t) => t.name || t).filter(Boolean);
      if (techNames.length === 0) {
        noCache++;
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { normalizedDomain: domain },
          update: {
            $set: {
              techStack: techNames.slice(0, 20),
              techCount: cached.count,
              lastTechScan: cached.updatedAt || new Date(),
            },
          },
        },
      });
    }

    if (bulkOps.length > 0 && !DRY_RUN) {
      try {
        const result = await metaCol.bulkWrite(bulkOps, { ordered: false });
        updated += result.modifiedCount;
      } catch (err) {
        errors += bulkOps.length;
        console.error(`  Batch error: ${err.message}`);
      }
    } else {
      updated += bulkOps.length;
    }

    const pct = (((i + batch.length) / toProcess.length) * 100).toFixed(1);
    process.stdout.write(`\r  [${pct}%] ${updated} updated, ${noCache} no cache, ${errors} errors    `);
  }

  console.log(`\n\n--- Results ---`);
  console.log(`  Updated from cache: ${updated}`);
  console.log(`  No cache available: ${noCache}`);
  console.log(`  Errors:             ${errors}`);

  // Show updated stats
  if (!DRY_RUN) {
    const newWithTech = await metaCol.countDocuments({
      techStack: { $exists: true, $not: { $size: 0 } },
      techCount: { $gt: 0 },
    });
    const stillMissing = await metaCol.countDocuments({
      $or: [
        { techStack: { $exists: false } },
        { techStack: { $size: 0 } },
        { techStack: null },
      ],
    });
    console.log(`\n--- After Backfill ---`);
    console.log(`  Accounts WITH tech data:     ${newWithTech} (was ${withTech})`);
    console.log(`  Accounts still missing tech: ${stillMissing}`);
    console.log(`\nFor accounts still missing tech, run: node scripts/bulk-tech-scan.js`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
