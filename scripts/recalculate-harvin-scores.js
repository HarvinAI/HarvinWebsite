#!/usr/bin/env node
/**
 * Recalculate Harvin Scores (v1) for all accounts.
 *
 * Uses the new signal-based scoring:
 *   Raw = (Capital × 0.25) + (Growth × 0.20) + (Expansion × 0.20)
 *       + (Hiring × 0.15) + (TechStack × 0.20)
 *   Final = Raw × Maturity Multiplier (0.7x / 1.0x / 1.2x)
 *
 * Usage:
 *   node scripts/recalculate-harvin-scores.js                # all accounts
 *   node scripts/recalculate-harvin-scores.js --limit 500    # first 500
 *   node scripts/recalculate-harvin-scores.js --domain nike.com  # single domain
 *   node scripts/recalculate-harvin-scores.js --dry-run      # preview only
 */

const dotenvPath = require('path').join(__dirname, '..', '.env.local');
require('fs').existsSync(dotenvPath) && require('dotenv').config({ path: dotenvPath });

const { getDb } = require('../lib/scan/db');
const { recomputeAllScores } = require('../lib/scoring/harvinScore');

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const LIMIT = parseInt(getArg('limit') || '0', 10);
const DOMAIN = getArg('domain');
const DRY_RUN = hasFlag('dry-run');

async function main() {
  const db = await getDb();
  const metaCol = db.collection('company_meta');

  console.log('\n--- Harvin Score v1 Recalculation ---\n');

  // Show current state
  const totalAccounts = await metaCol.countDocuments({});
  const withScore = await metaCol.countDocuments({ harvinScore: { $gt: 0 } });
  const withSignals = await db.collection('signals').countDocuments({});
  const withTechChanges = await db.collection('tech_cache').countDocuments({
    'techChanges.added': { $exists: true, $not: { $size: 0 } },
  });
  const withMarketNews = await db.collection('market_news').countDocuments({});

  console.log(`  Total accounts:       ${totalAccounts}`);
  console.log(`  With existing score:  ${withScore}`);
  console.log(`  Signals in DB:        ${withSignals}`);
  console.log(`  Tech changes tracked: ${withTechChanges}`);
  console.log(`  Market news articles: ${withMarketNews}`);

  if (DRY_RUN) {
    console.log('\n  DRY RUN — no changes will be made.');

    // Show sample scoring for a few domains
    const { computeHarvinScore } = require('../lib/scoring/harvinScore');
    const samples = await metaCol.find({ monthlyVisits: { $gte: 50000 } })
      .sort({ monthlyVisits: -1 })
      .limit(5)
      .project({ normalizedDomain: 1, monthlyVisits: 1, appPresence: 1, offlineStores: 1, techStack: 1, harvinScore: 1 })
      .toArray();

    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    console.log('\n  Sample scores:\n');
    for (const meta of samples) {
      const domain = meta.normalizedDomain;
      const [signals, techCache, marketNews] = await Promise.all([
        db.collection('signals').find({ domain, detectedAt: { $gte: sixMonthsAgo } }).toArray(),
        db.collection('tech_cache').findOne({ domain }, { projection: { techChanges: 1 } }),
        db.collection('market_news').find({ domain, publishedAt: { $gte: sixMonthsAgo } }).toArray(),
      ]);

      const allSignals = [
        ...signals,
        ...marketNews.map(n => ({
          signalType: n.newsType, detectedAt: n.publishedAt,
          headline: n.title || n.headline, details: n.details || {},
          confidence: n.confidence || 0.5,
        })),
      ];

      const result = computeHarvinScore({
        meta, signals: allSignals,
        techChanges: techCache?.techChanges || null,
        currentTech: meta.techStack || [],
      });

      console.log(`  ${domain}`);
      console.log(`    Old score: ${meta.harvinScore || 0} → New score: ${result.score}`);
      console.log(`    Maturity: ${result.maturity.level} (${result.maturity.multiplier}x)`);
      console.log(`    Breakdown: Capital=${result.breakdown.capital.score}/${result.breakdown.capital.max}`
        + ` Growth=${result.breakdown.growth.score}/${result.breakdown.growth.max}`
        + ` Expansion=${result.breakdown.expansion.score}/${result.breakdown.expansion.max}`
        + ` Hiring=${result.breakdown.hiring.score}/${result.breakdown.hiring.max}`
        + ` TechStack=${result.breakdown.techStack.score}/${result.breakdown.techStack.max}`);
      if (result.reasons.length > 0) {
        console.log(`    Reasons: ${result.reasons.join(' | ')}`);
      }
      console.log('');
    }

    process.exit(0);
  }

  // Determine domains to score
  let domains = [];
  if (DOMAIN) {
    domains = [DOMAIN];
    console.log(`\n  Scoring single domain: ${DOMAIN}`);
  } else if (LIMIT > 0) {
    const docs = await metaCol.find({})
      .sort({ monthlyVisits: -1 })
      .limit(LIMIT)
      .project({ normalizedDomain: 1 })
      .toArray();
    domains = docs.map(d => d.normalizedDomain);
    console.log(`\n  Scoring top ${domains.length} domains by traffic`);
  } else {
    console.log(`\n  Scoring ALL ${totalAccounts} domains...`);
  }

  const startTime = Date.now();
  const scored = await recomputeAllScores(db, domains, true);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n--- Done ---`);
  console.log(`  Scored: ${scored} domains in ${elapsed}s`);

  // Show updated stats
  const scoreDistribution = await metaCol.aggregate([
    { $match: { harvinScore: { $exists: true } } },
    {
      $bucket: {
        groupBy: '$harvinScore',
        boundaries: [0, 10, 25, 45, 70, 101],
        default: 'unknown',
        output: { count: { $sum: 1 } },
      },
    },
  ]).toArray();

  console.log('\n  Score distribution:');
  const labels = { 0: '0-9 (Cold)', 10: '10-24 (Cool)', 25: '25-44 (Warm)', 45: '45-69 (Hot)', 70: '70-100 (Fire)' };
  for (const bucket of scoreDistribution) {
    const label = labels[bucket._id] || `${bucket._id}`;
    console.log(`    ${label}: ${bucket.count}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
