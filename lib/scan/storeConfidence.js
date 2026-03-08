/**
 * Store count confidence scoring model.
 * Assigns a 0-100 confidence score based on data source quality,
 * cross-validation, temporal consistency, and data completeness.
 */

function calculateStoreConfidence({
  source,              // 'widget_api' | 'xhr_intercept' | 'dom_parsing' | 'text_extraction' |
                       //   'api_detection' | 'wikipedia' | 'manual' | 'override' | 'none'
  storeCount,
  previousCount,       // from last scrape (null if first time)
  previousScrapedAt,   // Date of last scrape
  locatorPageExists,   // boolean
  hasStructuredData,   // boolean (JSON-LD found)
  storesHaveCoords,    // boolean (lat/lng present)
  storesHaveAddresses, // boolean
  manuallyVerifiedAt,  // Date (null if never verified)
}) {
  let score = 0;
  const flags = [];

  // ═══════════════════════════════════════════════════
  // SOURCE QUALITY (max 45 points)
  // ═══════════════════════════════════════════════════

  const sourceScores = {
    'widget_api': 40,      // Best: clean structured data from known API
    'xhr_intercept': 35,   // Very good: structured JSON from brand's API
    'api_detection': 30,   // Good: detected API endpoint (SAP/SFCC/custom)
    'manual': 35,          // Human verified
    'override': 35,        // Curated override
    'dom_parsing': 20,     // Decent but fragile
    'json_array': 20,      // JSON array in page source
    'text_extraction': 15, // Regex on text — approximate
    'store_elements': 15,  // DOM element counting
    'rendered_items': 15,  // Rendered list items / direction links
    'wikipedia': 10,       // May be outdated
    'common_pages': 15,    // Brute-force page enumeration
    'browser_scrape': 20,  // Puppeteer rendered page
    'none': 0,
  };
  score += sourceScores[source] || 0;

  // Bonus for structured coordinates
  if (storesHaveCoords) score += 5;

  // ═══════════════════════════════════════════════════
  // TEMPORAL CONSISTENCY (max 15 points)
  // ═══════════════════════════════════════════════════

  if (previousCount !== null && previousCount !== undefined && previousScrapedAt) {
    const daysSinceLast = (Date.now() - new Date(previousScrapedAt).getTime())
      / (1000 * 60 * 60 * 24);
    const changePercent = Math.abs(storeCount - previousCount)
      / Math.max(previousCount, 1) * 100;

    if (changePercent < 10) {
      // Stable count — high confidence
      score += 15;
    } else if (changePercent < 30) {
      // Moderate change — reasonable for growing brands
      score += 10;
    } else if (changePercent > 50 && daysSinceLast < 30) {
      // >50% change in under a month — suspicious
      score += 0;
      flags.push('suspicious_rapid_change');
    } else {
      score += 5;
    }
  }

  // ═══════════════════════════════════════════════════
  // DATA COMPLETENESS (max 10 points)
  // ═══════════════════════════════════════════════════

  if (storesHaveAddresses) score += 5;
  if (hasStructuredData) score += 3;
  if (locatorPageExists) score += 2;

  // ═══════════════════════════════════════════════════
  // MANUAL VERIFICATION BONUS (max 10 points, decays)
  // ═══════════════════════════════════════════════════

  if (manuallyVerifiedAt) {
    const daysSinceVerification = (Date.now() - new Date(manuallyVerifiedAt).getTime())
      / (1000 * 60 * 60 * 24);

    if (daysSinceVerification < 30) score += 10;
    else if (daysSinceVerification < 90) score += 7;
    else if (daysSinceVerification < 180) score += 3;
    // After 6 months, manual verification adds nothing
  }

  // ═══════════════════════════════════════════════════
  // DEDUCTIONS
  // ═══════════════════════════════════════════════════

  if (storeCount === 0 && locatorPageExists) {
    score -= 15;
    flags.push('locator_exists_but_no_stores_found');
  }

  // ═══════════════════════════════════════════════════
  // NORMALIZE TO 0-100
  // ═══════════════════════════════════════════════════

  const finalScore = Math.max(0, Math.min(100, score));

  // Determine display tier
  let tier;
  if (finalScore >= 70) tier = 'high';
  else if (finalScore >= 40) tier = 'medium';
  else tier = 'low';

  return {
    score: finalScore,
    tier,
    source: source || 'none',
    flags,
  };
}

module.exports = { calculateStoreConfidence };
