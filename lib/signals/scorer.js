/**
 * Rules-based composite scoring for buying signals.
 *
 * Weights, recency decay, traffic bonus, and multi-signal bonus
 * are all configurable constants at the top.
 */

const SIGNAL_WEIGHTS = {
  funding: 40,
  key_hire: 25,
  app_launch: 20,
  store_expansion: 20,
  marketplace: 15,
  traffic_growth: 15,
};

const TRAFFIC_BONUS = [
  { min: 2_000_000, points: 10 },
  { min: 500_000, points: 7 },
  { min: 100_000, points: 4 },
];

const MULTI_SIGNAL_BONUS = [
  { count: 4, points: 15 },
  { count: 3, points: 10 },
  { count: 2, points: 5 },
];

/**
 * Compute recency decay factor.
 * 1.0 for today, 0.7 at 7 days, 0.25 at 30 days, linear interpolation.
 */
function recencyDecay(signalDate) {
  const now = Date.now();
  const age = now - new Date(signalDate).getTime();
  const days = age / (1000 * 60 * 60 * 24);

  if (days <= 0) return 1.0;
  if (days <= 7) return 1.0 - (0.3 * days / 7); // 1.0 → 0.7
  if (days <= 30) return 0.7 - (0.45 * (days - 7) / 23); // 0.7 → 0.25
  return Math.max(0.1, 0.25 - (0.15 * (days - 30) / 60)); // slow decay after 30d
}

/**
 * Score a single domain given its signals and optional traffic data.
 *
 * @param {Array<{signalType: string, detectedAt: Date|string, confidence: number}>} signals
 * @param {number|null} monthlyVisits
 * @returns {{totalScore: number, signalCount: number, topSignal: string|null, lastSignalDate: Date|null, recommended: boolean, recommendedReason: string|null, signalBreakdown: Object}}
 */
function scoreDomain(signals, monthlyVisits = null) {
  if (!signals || signals.length === 0) {
    return {
      totalScore: 0,
      signalCount: 0,
      topSignal: null,
      lastSignalDate: null,
      recommended: false,
      recommendedReason: null,
      signalBreakdown: {},
    };
  }

  let totalScore = 0;
  const signalBreakdown = {};
  const bestPerType = {}; // track best score per signal type (not sum)
  let topSignalScore = 0;
  let topSignal = null;
  let lastSignalDate = null;
  const signalTypes = new Set();

  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.signalType] || 10;
    const decay = recencyDecay(signal.detectedAt);
    const confidence = signal.confidence || 0.7;
    const score = weight * decay * confidence;

    signalTypes.add(signal.signalType);

    // Keep only the BEST score per signal type (avoids inflating score with duplicates)
    const type = signal.signalType;
    if (!bestPerType[type] || score > bestPerType[type]) {
      bestPerType[type] = score;
    }

    if (score > topSignalScore) {
      topSignalScore = score;
      topSignal = signal.signalType;
    }

    const sigDate = new Date(signal.detectedAt);
    if (!lastSignalDate || sigDate > lastSignalDate) {
      lastSignalDate = sigDate;
    }
  }

  // Sum best score per type (not all signals)
  for (const [type, score] of Object.entries(bestPerType)) {
    totalScore += score;
    signalBreakdown[type] = score;
  }

  // Traffic bonus
  if (monthlyVisits) {
    for (const tier of TRAFFIC_BONUS) {
      if (monthlyVisits >= tier.min) {
        totalScore += tier.points;
        break;
      }
    }
  }

  // Multi-signal bonus
  const uniqueTypes = signalTypes.size;
  for (const tier of MULTI_SIGNAL_BONUS) {
    if (uniqueTypes >= tier.count) {
      totalScore += tier.points;
      break;
    }
  }

  // Cap score at 100
  totalScore = Math.min(100, Math.round(totalScore * 10) / 10);

  // "Recommended" = score >= 50 AND at least one signal < 7 days old
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hasRecentSignal = signals.some(s => new Date(s.detectedAt) > sevenDaysAgo);
  const recommended = totalScore >= 50 && hasRecentSignal;

  let recommendedReason = null;
  if (recommended) {
    const reasons = [];
    if (signalBreakdown.funding) reasons.push('Recently funded');
    if (signalBreakdown.key_hire) reasons.push('Key executive hire');
    if (signalBreakdown.app_launch) reasons.push('New app launch');
    if (signalBreakdown.store_expansion) reasons.push('Store expansion');
    if (uniqueTypes >= 2) reasons.push('Multiple buying signals');
    recommendedReason = reasons.join('; ');
  }

  return {
    totalScore,
    signalCount: signals.length,
    topSignal,
    lastSignalDate,
    recommended,
    recommendedReason,
    signalBreakdown,
  };
}

/**
 * Score all domains with signals and write to signal_scores collection.
 *
 * @param {Object} db - MongoDB database instance
 * @param {string[]} domains - optional list of domains to score (if empty, scores all)
 */
async function scoreAllDomains(db, domains = []) {
  const signalsCol = db.collection('signals');
  const scoresCol = db.collection('signal_scores');
  const metaCol = db.collection('company_meta');

  // Get signals from last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const query = { detectedAt: { $gte: ninetyDaysAgo } };
  if (domains.length > 0) {
    query.domain = { $in: domains };
  }

  const allSignals = await signalsCol.find(query)
    .sort({ domain: 1, detectedAt: -1 })
    .project({ domain: 1, signalType: 1, detectedAt: 1, confidence: 1, headline: 1, details: 1, sourceUrl: 1 })
    .toArray();

  // Group by domain
  const grouped = {};
  for (const sig of allSignals) {
    if (!grouped[sig.domain]) grouped[sig.domain] = [];
    grouped[sig.domain].push(sig);
  }

  const domainsToScore = Object.keys(grouped);

  // When doing a full re-score (no specific domains), remove scores for domains
  // that no longer have any recent signals
  if (domains.length === 0) {
    const allScoredDomains = await scoresCol.find({}).project({ domain: 1 }).toArray();
    const staleScoreDomains = allScoredDomains
      .map(d => d.domain)
      .filter(d => !grouped[d]);
    if (staleScoreDomains.length > 0) {
      await scoresCol.deleteMany({ domain: { $in: staleScoreDomains } });
      console.log(`[scorer] Removed ${staleScoreDomains.length} stale scores`);
    }
  }

  if (domainsToScore.length === 0) {
    console.log('[scorer] No signals to score');
    return 0;
  }

  // Get traffic data for these domains
  const metaDocs = await metaCol.find(
    { normalizedDomain: { $in: domainsToScore } },
  ).project({ normalizedDomain: 1, monthlyVisits: 1 }).toArray();

  const trafficMap = {};
  for (const doc of metaDocs) {
    trafficMap[doc.normalizedDomain] = doc.monthlyVisits || null;
  }

  let scored = 0;
  for (const domain of domainsToScore) {
    const signals = grouped[domain];
    const monthlyVisits = trafficMap[domain] || null;
    const result = scoreDomain(signals, monthlyVisits);

    const signalSummaries = signals.slice(0, 5).map(s => ({
      signalType: s.signalType,
      headline: s.headline,
      detectedAt: s.detectedAt,
      details: s.details || {},
      sourceUrl: s.sourceUrl || '',
    }));

    await scoresCol.updateOne(
      { domain },
      {
        $set: {
          domain,
          totalScore: result.totalScore,
          signalCount: result.signalCount,
          signals: signalSummaries,
          topSignal: result.topSignal,
          lastSignalDate: result.lastSignalDate,
          recommended: result.recommended,
          recommendedReason: result.recommendedReason,
          signalBreakdown: result.signalBreakdown,
          scoredAt: new Date(),
        },
      },
      { upsert: true }
    );
    scored++;
  }

  console.log(`[scorer] Scored ${scored} domains`);
  return scored;
}

module.exports = { scoreDomain, scoreAllDomains, recencyDecay };
