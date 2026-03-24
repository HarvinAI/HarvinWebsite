#!/usr/bin/env node
/**
 * One-time script: copies tech names from tech_cache into company_meta.techStack
 * so the Account Explorer can show real tech pills.
 *
 * Usage: node scripts/backfill-techstack.js
 */
const { getDb } = require('../lib/scan/db');

(async () => {
  const db = await getDb();
  const techCache = db.collection('tech_cache');
  const metaCol = db.collection('company_meta');

  const docs = await techCache.find({ count: { $gt: 0 } }).toArray();
  console.log(`Found ${docs.length} tech_cache entries to backfill`);

  let updated = 0;
  for (const doc of docs) {
    const domain = doc.domain;
    const techNames = (doc.technologies || []).map(t => t.name || t).slice(0, 15);
    if (techNames.length === 0) continue;

    const result = await metaCol.updateOne(
      { normalizedDomain: domain },
      { $set: { techStack: techNames, techCount: doc.count || techNames.length } },
    );
    if (result.matchedCount > 0) updated++;
  }

  console.log(`Updated ${updated} company_meta records with real techStack`);
  process.exit(0);
})();
