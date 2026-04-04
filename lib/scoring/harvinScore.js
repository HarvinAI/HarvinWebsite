/**
 * Harvin Score v1 — Signal-Based Scoring Architecture
 *
 * Formula:
 *   Raw Score = (Capital × 0.25) + (Growth × 0.20) + (Expansion × 0.20)
 *              + (Hiring × 0.15) + (TechStack × 0.20)
 *   Final Score = Raw Score × Maturity Multiplier
 *   Capped at 100.
 *
 * Six signal categories, each scored 0–25 max, with time decay on event signals.
 * Brand Maturity acts as a multiplier (0.7x / 1.0x / 1.2x).
 */

const { TECH_CATEGORY_MAP } = require('../scan/detect');

// ─── Signal 1: Capital / Funding (max 25) ─────────────────────────────
// Time-decayed score based on funding events from signals collection.

function scoreFunding(signals) {
  const fundingSignals = signals.filter(s => s.signalType === 'funding');
  if (fundingSignals.length === 0) return { score: 0, reasons: [] };

  // Take the most recent, highest-value funding round (no double-counting)
  let best = null;
  let bestScore = 0;

  for (const sig of fundingSignals) {
    const daysSince = daysBetween(sig.detectedAt || sig.signalDate);
    let base = 25;

    // Decay tiers per PDF
    if (daysSince <= 30) base = 25;
    else if (daysSince <= 60) base = 20;
    else if (daysSince <= 90) base = 14;
    else if (daysSince <= 180) base = 7;
    else base = 0;

    // Accelerator batch (current/recent) = 15 pts
    const details = sig.details || {};
    const headline = (sig.headline || '').toLowerCase();
    const isAccelerator = /\b(yc|y combinator|techstars|500 global|antler|sequoia surge|entrepreneur first|accelerator|incubator)\b/i
      .test(headline + ' ' + (details.investors || []).join(' '));

    if (isAccelerator && daysSince <= 90) {
      base = Math.max(base, 15);
    }

    // Debt rounds score lower
    const round = (details.round || '').toLowerCase();
    if (/debt|venture debt|loan/i.test(round)) {
      base = Math.round(base * 0.6);
    }

    if (base > bestScore) {
      bestScore = base;
      best = sig;
    }
  }

  if (bestScore === 0) return { score: 0, reasons: [] };

  const details = best.details || {};
  const roundStr = details.round || 'funding';
  const amountStr = details.amount ? ` ${details.amount}` : '';
  const daysAgo = Math.round(daysBetween(best.detectedAt || best.signalDate));
  const reason = `Raised${amountStr} ${roundStr} (${daysAgo}d ago)`;

  return { score: Math.min(25, bestScore), reasons: [reason] };
}


// ─── Signal 2: Growth Velocity (max 20) ───────────────────────────────
// Currently based on monthly visits band (structural signal).
// TODO: Add historical traffic trend detection, Tranco rank, app growth.

function scoreGrowth(meta) {
  const mv = meta.monthlyVisits || 0;
  let score = 0;
  const reasons = [];

  // MAU band scoring (structural — refreshes on each scan)
  if (mv >= 20_000_000) { score = 12; reasons.push('20M+ monthly visits'); }
  else if (mv >= 5_000_000) { score = 10; reasons.push('5M+ monthly visits'); }
  else if (mv >= 1_000_000) { score = 8; reasons.push('1M+ monthly visits'); }
  else if (mv >= 500_000) { score = 6; reasons.push('500K+ monthly visits'); }
  else if (mv >= 200_000) { score = 4; reasons.push('200K+ monthly visits'); }
  else if (mv >= 50_000) { score = 3; reasons.push('50K+ monthly visits'); }
  else if (mv >= 10_000) { score = 2; reasons.push('Active brand (10K+ visits)'); }
  else { score = 0; }

  // App presence as growth proxy
  const app = meta.appPresence || 'No App';
  if (app === 'Both iOS & Android') {
    score += 4;
    reasons.push('Both iOS & Android apps');
  } else if (app !== 'No App') {
    score += 2;
    reasons.push(`${app} app`);
  }

  return { score: Math.min(20, score), reasons };
}


// ─── Signal 3: Operational Expansion (max 20) ─────────────────────────
// Store openings, marketplace entry, international expansion from signals.

function scoreExpansion(signals, meta) {
  let score = 0;
  const reasons = [];

  const expansionSignals = signals.filter(s =>
    s.signalType === 'store_expansion' ||
    s.signalType === 'marketplace' ||
    s.signalType === 'app_launch'
  );

  // Also check market_news style signals
  const expansionNews = signals.filter(s =>
    s.signalType === 'expansion' ||
    s.signalType === 'launch'
  );

  const allExpansion = [...expansionSignals, ...expansionNews];

  if (allExpansion.length > 0) {
    // Score the best expansion signal with decay
    for (const sig of allExpansion) {
      const days = daysBetween(sig.detectedAt || sig.signalDate);
      const decay = eventDecay(days);
      let base = 0;

      const headline = (sig.headline || '').toLowerCase();
      const type = sig.signalType;

      // D2C website launch (was marketplace-only) = 20
      if (/launches?\s+(website|d2c|online store|ecommerce)/i.test(headline)) {
        base = 20;
      }
      // First offline store (online-only → omnichannel) = 18
      else if (/first\s+(store|retail|physical|offline|flagship)/i.test(headline)) {
        base = 18;
      }
      // International expansion = 15
      else if (/international|global|expands?\s+(to|into|globally)|enters?\s+(us|uk|europe|asia|middle east|mena)/i.test(headline)) {
        base = 15;
      }
      // New store openings (existing omnichannel) = 12
      else if (type === 'store_expansion' || /new\s+(store|outlet|retail|shop|warehouse)/i.test(headline)) {
        base = 12;
      }
      // Marketplace entry = 10
      else if (type === 'marketplace' || /marketplace|amazon|flipkart|myntra|shopee|lazada/i.test(headline)) {
        base = 10;
      }
      // Quick commerce entry = 10
      else if (/quick commerce|blinkit|zepto|grabmart|gopuff|getir/i.test(headline)) {
        base = 10;
      }
      // App launch = 8
      else if (type === 'app_launch' || /app\s+launch|launches?\s+app/i.test(headline)) {
        base = 8;
      }
      // General expansion = 5
      else {
        base = 5;
      }

      const decayed = Math.round(base * decay);
      if (decayed > score) {
        score = decayed;
        const daysAgo = Math.round(days);
        reasons.length = 0;
        reasons.push(`${sig.headline || type} (${daysAgo}d ago)`);
      }
    }
  }

  // Structural: offline stores as baseline
  const stores = meta.offlineStores || 'Online';
  if (score === 0) {
    // No event signals — use current store status as low baseline
    if (stores === '500+' || stores === '100+') { score = 3; reasons.push('Large retail presence'); }
    else if (stores === '100-500' || stores === '51-100') { score = 2; reasons.push('Multi-store brand'); }
    else if (stores === '50-100' || stores === '21-50' || stores === '10-50' || stores === '11-20') { score = 1; reasons.push('Growing retail presence'); }
  }

  return { score: Math.min(20, score), reasons };
}


// ─── Signal 4: Hiring Intent (max 15) ─────────────────────────────────
// Job postings / key hires with role-tier multipliers.

const ROLE_TIER_1 = /\b(vp|vice president|cmo|cto|coo|cfo|ceo|chief|vp of)\b/i;
const ROLE_TIER_2 = /\b(head of|director|senior director|svp|head)\b/i;
const ROLE_TIER_3 = /\b(manager|lead|senior|sr\.?)\b/i;

function scoreHiring(signals) {
  const hiringSignals = signals.filter(s =>
    s.signalType === 'key_hire' || s.signalType === 'hiring'
  );
  if (hiringSignals.length === 0) return { score: 0, reasons: [] };

  let bestScore = 0;
  let bestReason = '';

  for (const sig of hiringSignals) {
    const days = daysBetween(sig.detectedAt || sig.signalDate);
    const decay = eventDecay(days);
    const details = sig.details || {};
    const title = (details.title || details.role || '').toLowerCase();
    const headline = (sig.headline || '').toLowerCase();
    const combined = title + ' ' + headline;

    let base = 2; // Tier 4 default (IC)

    // Bulk hiring (10+ open roles)
    const hiringCount = details.hiringCount || 0;
    if (hiringCount >= 10) {
      base = 10;
    }
    // Tier 1: Executive (VP, C-suite)
    else if (ROLE_TIER_1.test(combined)) {
      // Marketing/growth executives = strongest
      if (/market|growth|ecommerce|digital|brand/i.test(combined)) {
        base = 15;
      } else {
        base = 12; // tech/data executives
      }
    }
    // Tier 2: Senior Leader
    else if (ROLE_TIER_2.test(combined)) {
      base = 10;
    }
    // Tier 3: Mid-Level
    else if (ROLE_TIER_3.test(combined)) {
      base = 5;
    }

    const decayed = Math.round(base * decay);
    if (decayed > bestScore) {
      bestScore = decayed;
      const daysAgo = Math.round(days);
      const person = details.person || '';
      const roleStr = details.title || details.role || sig.signalType;
      bestReason = person
        ? `Hired ${person} as ${roleStr} (${daysAgo}d ago)`
        : `Hiring: ${sig.headline || roleStr} (${daysAgo}d ago)`;
    }
  }

  return {
    score: Math.min(15, bestScore),
    reasons: bestReason ? [bestReason] : [],
  };
}


// ─── Signal 5: Tech Stack Changes (max 20) ────────────────────────────
// Delta analysis — additions, removals, migrations from tech_cache.techChanges.

// Categories that indicate high-value changes
const ENGAGEMENT_CATEGORIES = new Set([
  'Marketing automation', 'Email', 'Email Marketing', 'Push notifications',
  'Customer Engagement / CRM', 'CRM',
]);
const ECOMMERCE_CATEGORIES = new Set([
  'Ecommerce', 'Ecommerce Platform', 'Ecommerce frontends',
]);
const PAYMENT_CATEGORIES = new Set([
  'Payment processors', 'Payments & Checkout - Gateway', 'Buy now pay later',
]);
const ANALYTICS_CATEGORIES = new Set([
  'Analytics', 'Analytics & Optimization Platform', 'A/B Testing',
  'A/B testing', 'A/B Testing & Personalization',
]);
const SUPPORT_CATEGORIES = new Set([
  'Customer Support', 'Live chat', 'Helpdesk',
]);

function scoreTechChanges(techChanges, currentTech) {
  if (!techChanges) return { score: 0, reasons: [] };

  const added = techChanges.added || [];
  const removed = techChanges.removed || [];

  if (added.length === 0 && removed.length === 0) {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons = [];

  // Classify removals
  for (const techName of removed) {
    const cat = TECH_CATEGORY_MAP[techName] || '';
    if (ENGAGEMENT_CATEGORIES.has(cat)) {
      // Engagement tool removed = 20 (competitor opportunity)
      score = Math.max(score, 20);
      reasons.push(`Removed ${techName} (engagement tool churned)`);
    } else if (ECOMMERCE_CATEGORIES.has(cat)) {
      // Ecommerce platform change = 15 (migration)
      score = Math.max(score, 15);
      reasons.push(`Removed ${techName} (platform migration)`);
    }
  }

  // Classify additions
  for (const techName of added) {
    const cat = TECH_CATEGORY_MAP[techName] || '';

    if (ECOMMERCE_CATEGORIES.has(cat)) {
      // Check if it's a platform migration (removed one, added another)
      const removedPlatform = removed.some(r => ECOMMERCE_CATEGORIES.has(TECH_CATEGORY_MAP[r] || ''));
      if (removedPlatform) {
        score = Math.max(score, 15);
        reasons.push(`Migrated to ${techName} (ecommerce platform change)`);
      } else {
        score = Math.max(score, 10);
        reasons.push(`Added ${techName}`);
      }
    } else if (PAYMENT_CATEGORIES.has(cat)) {
      score = Math.max(score, 10);
      reasons.push(`Added ${techName} (payment expansion)`);
    } else if (ANALYTICS_CATEGORIES.has(cat)) {
      score = Math.max(score, 8);
      reasons.push(`Added ${techName} (investing in analytics)`);
    } else if (SUPPORT_CATEGORIES.has(cat)) {
      // Check if upgraded (free → paid)
      score = Math.max(score, 8);
      reasons.push(`Added ${techName} (customer support investment)`);
    } else if (ENGAGEMENT_CATEGORIES.has(cat)) {
      score = Math.max(score, 8);
      reasons.push(`Added ${techName} (engagement tool)`);
    } else if (cat) {
      // Any new tool in any category = 5
      score = Math.max(score, 5);
      reasons.push(`Added ${techName}`);
    }
  }

  // Greenfield + growing: no engagement platform detected AND has traffic
  if (score === 0 && currentTech && currentTech.length > 0) {
    const hasEngagement = currentTech.some(t => {
      const c = TECH_CATEGORY_MAP[t] || '';
      return ENGAGEMENT_CATEGORIES.has(c);
    });
    if (!hasEngagement) {
      // Will be scored as greenfield in maturity instead
    }
  }

  // Keep only the top 2 reasons to avoid clutter
  return { score: Math.min(20, score), reasons: reasons.slice(0, 2) };
}


// ─── Signal 6: Brand Maturity / Digital Sophistication (multiplier) ───
// Structural signal: 0.7x (low) / 1.0x (medium) / 1.2x (high)

function computeMaturity(meta, currentTech) {
  let indicators = 0;
  const techSet = new Set((currentTech || []).map(t => typeof t === 'string' ? t : t.name));

  // 1. Custom domain (not platform subdomain)
  const domain = meta.normalizedDomain || '';
  const isPlatformSubdomain = /\.(myshopify|mydukaan|shopifypreview|wixsite|squarespace|bigcartel|ecwid)\./i.test(domain);
  if (!isPlatformSubdomain && domain) indicators++;

  // 2. Multi-language / multi-currency support
  const hasMultiLang = techSet.has('WPML') || techSet.has('Weglot') || techSet.has('Transifex')
    || techSet.has('Google Translate') || techSet.has('Crowdin');
  if (hasMultiLang) indicators++;

  // 3. Structured data / SEO investment
  const hasSEO = techSet.has('Yoast SEO') || techSet.has('JSON-LD')
    || techSet.has('All in One SEO Pack') || techSet.has('Rank Math');
  if (hasSEO) indicators++;

  // 4. Reviews / UGC integration
  const hasReviews = techSet.has('Judge.me') || techSet.has('Yotpo') || techSet.has('Stamped')
    || techSet.has('Loox') || techSet.has('Bazaarvoice') || techSet.has('PowerReviews')
    || techSet.has('Trustpilot') || techSet.has('Reviews.io');
  if (hasReviews) indicators++;

  // 5. Active email marketing
  const hasEmail = [...techSet].some(t => {
    const c = TECH_CATEGORY_MAP[t] || '';
    return ENGAGEMENT_CATEGORIES.has(c) || /email/i.test(c);
  });
  if (hasEmail) indicators++;

  // 6. Analytics beyond basic GA
  const advancedAnalytics = techSet.has('Mixpanel') || techSet.has('Amplitude')
    || techSet.has('Hotjar') || techSet.has('FullStory') || techSet.has('Heap')
    || techSet.has('Adobe Analytics') || techSet.has('Segment');
  if (advancedAnalytics) indicators++;

  // 7. App presence
  const hasApp = meta.appPresence && meta.appPresence !== 'No App';
  if (hasApp) indicators++;

  // Determine maturity level
  // High: custom domain + 4+ indicators → 1.2x
  // Medium: custom domain + some optimization → 1.0x
  // Low: platform subdomain, minimal optimization → 0.7x
  let multiplier = 1.0;
  let level = 'medium';

  if (!isPlatformSubdomain && indicators >= 4) {
    multiplier = 1.2;
    level = 'high';
  } else if (isPlatformSubdomain && indicators <= 2) {
    multiplier = 0.7;
    level = 'low';
  }

  return { multiplier, level, indicators };
}


// ─── Composite Harvin Score ───────────────────────────────────────────

/**
 * Compute the full Harvin Score for a domain.
 *
 * @param {Object} params
 * @param {Object} params.meta - company_meta document
 * @param {Array}  params.signals - signals from signals collection (last 180 days)
 * @param {Object|null} params.techChanges - { added: string[], removed: string[] }
 * @param {string[]} params.currentTech - current techStack names
 * @returns {Object} { score, breakdown, reasons, maturity }
 */
function computeHarvinScore({ meta, signals = [], techChanges = null, currentTech = [] }) {
  const funding = scoreFunding(signals);
  const growth = scoreGrowth(meta);
  const expansion = scoreExpansion(signals, meta);
  const hiring = scoreHiring(signals);
  const techStack = scoreTechChanges(techChanges, currentTech);
  const maturity = computeMaturity(meta, currentTech);

  // Weighted sum
  const rawScore =
    (funding.score * 0.25) +
    (growth.score * 0.20) +
    (expansion.score * 0.20) +
    (hiring.score * 0.15) +
    (techStack.score * 0.20);

  // Apply maturity multiplier — scale to 0-100 range
  // Each component is already 0-max, weighted sum max = 25*0.25 + 20*0.20 + 20*0.20 + 15*0.15 + 20*0.20 = 6.25 + 4 + 4 + 2.25 + 4 = 20.5
  // Normalize: multiply by (100/20.5) ≈ 4.878 to get 0-100 range
  const normalized = rawScore * (100 / 20.5);
  const finalScore = Math.min(100, Math.round(normalized * maturity.multiplier));

  // Collect all reasons
  const allReasons = [
    ...funding.reasons,
    ...growth.reasons,
    ...expansion.reasons,
    ...hiring.reasons,
    ...techStack.reasons,
  ];

  // Build breakdown for the "WHY" display
  const breakdown = {
    capital: { score: funding.score, max: 25, weight: 0.25, reasons: funding.reasons },
    growth: { score: growth.score, max: 20, weight: 0.20, reasons: growth.reasons },
    expansion: { score: expansion.score, max: 20, weight: 0.20, reasons: expansion.reasons },
    hiring: { score: hiring.score, max: 15, weight: 0.15, reasons: hiring.reasons },
    techStack: { score: techStack.score, max: 20, weight: 0.20, reasons: techStack.reasons },
  };

  return {
    score: finalScore,
    breakdown,
    reasons: allReasons,
    maturity: {
      level: maturity.level,
      multiplier: maturity.multiplier,
      indicators: maturity.indicators,
    },
    rawScore: Math.round(rawScore * 10) / 10,
  };
}


// ─── Helpers ──────────────────────────────────────────────────────────

function daysBetween(date) {
  if (!date) return 999;
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

/** Event-based signal decay per PDF: 0-30d=100%, 31-60d=75%, 61-90d=50%, 91-120d=25%, 121+=0% */
function eventDecay(days) {
  if (days <= 30) return 1.0;
  if (days <= 60) return 0.75;
  if (days <= 90) return 0.50;
  if (days <= 120) return 0.25;
  return 0;
}


// ─── Batch scoring for all domains ────────────────────────────────────

/**
 * Recompute Harvin Scores for all (or specific) domains.
 * Reads from signals, tech_cache, company_meta and writes back to company_meta.
 *
 * @param {Object} db - MongoDB instance
 * @param {string[]} domains - optional list; empty = all accounts
 * @param {boolean} verbose - log progress
 */
async function recomputeAllScores(db, domains = [], verbose = false) {
  const metaCol = db.collection('company_meta');
  const signalsCol = db.collection('signals');
  const techCacheCol = db.collection('tech_cache');
  const marketNewsCol = db.collection('market_news');

  // 1. Get domains to score
  let query = {};
  if (domains.length > 0) {
    query = { normalizedDomain: { $in: domains } };
  }
  const allMeta = await metaCol.find(query)
    .project({
      normalizedDomain: 1, monthlyVisits: 1, appPresence: 1,
      offlineStores: 1, businessModel: 1, categoryConfidence: 1,
      techStack: 1, techCount: 1,
    })
    .toArray();

  if (allMeta.length === 0) return 0;

  // 2. Get all recent signals (last 180 days — funding can decay up to 180d)
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const domainList = allMeta.map(m => m.normalizedDomain);

  const [allSignals, allMarketNews, allTechCache] = await Promise.all([
    signalsCol.find({
      domain: { $in: domainList },
      detectedAt: { $gte: sixMonthsAgo },
    }).project({
      domain: 1, signalType: 1, detectedAt: 1, signalDate: 1,
      headline: 1, details: 1, confidence: 1,
    }).toArray(),

    marketNewsCol.find({
      domain: { $in: domainList },
      publishedAt: { $gte: sixMonthsAgo },
    }).project({
      domain: 1, newsType: 1, publishedAt: 1, headline: 1,
      title: 1, details: 1, confidence: 1,
    }).toArray(),

    techCacheCol.find({
      domain: { $in: domainList },
    }).project({
      domain: 1, techChanges: 1, technologies: 1,
    }).toArray(),
  ]);

  // Group by domain
  const signalsByDomain = groupBy(allSignals, 'domain');
  const techCacheByDomain = {};
  for (const tc of allTechCache) {
    techCacheByDomain[tc.domain] = tc;
  }

  // Convert market_news to signal-like format
  for (const news of allMarketNews) {
    const domain = news.domain;
    if (!signalsByDomain[domain]) signalsByDomain[domain] = [];
    signalsByDomain[domain].push({
      signalType: news.newsType,
      detectedAt: news.publishedAt,
      headline: news.title || news.headline,
      details: news.details || {},
      confidence: news.confidence || 0.5,
    });
  }

  // 3. Score each domain
  let scored = 0;
  const bulkOps = [];
  const BATCH_SIZE = 500;

  for (const meta of allMeta) {
    const domain = meta.normalizedDomain;
    const domainSignals = signalsByDomain[domain] || [];
    const techCache = techCacheByDomain[domain] || {};
    const techChanges = techCache.techChanges || null;
    const currentTech = meta.techStack || [];

    const result = computeHarvinScore({
      meta,
      signals: domainSignals,
      techChanges,
      currentTech,
    });

    bulkOps.push({
      updateOne: {
        filter: { normalizedDomain: domain },
        update: {
          $set: {
            harvinScore: result.score,
            harvinScoreBreakdown: result.breakdown,
            harvinScoreReasons: result.reasons.slice(0, 5),
            harvinMaturity: result.maturity,
            harvinScoreUpdatedAt: new Date(),
          },
        },
      },
    });

    scored++;

    // Write in batches
    if (bulkOps.length >= BATCH_SIZE) {
      await metaCol.bulkWrite(bulkOps, { ordered: false });
      if (verbose) process.stdout.write(`\r  Scored ${scored}/${allMeta.length}    `);
      bulkOps.length = 0;
    }
  }

  // Flush remaining
  if (bulkOps.length > 0) {
    await metaCol.bulkWrite(bulkOps, { ordered: false });
  }

  if (verbose) console.log(`\n  Scored ${scored} domains`);
  return scored;
}

function groupBy(arr, key) {
  const map = {};
  for (const item of arr) {
    const k = item[key];
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

module.exports = {
  computeHarvinScore,
  recomputeAllScores,
  scoreFunding,
  scoreGrowth,
  scoreExpansion,
  scoreHiring,
  scoreTechChanges,
  computeMaturity,
  eventDecay,
};
