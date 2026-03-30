#!/usr/bin/env node

/**
 * Fill missing traffic data using multiple free sources:
 * 1. Google CrUX API (free — real Chrome usage data)
 * 2. Domain-based estimation (subdomain → parent traffic fraction)
 * 3. Fallback: minimal estimate based on tech stack / app presence
 *
 * No paid APIs needed.
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

// Load .env.local
try {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const { getDb } = require('../lib/scan/db');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// ── CrUX API ──────────────────────────────────────────────────────────────
// Google Chrome UX Report — free, real data from Chrome users
// Returns form factor breakdown which indicates relative traffic level

function fetchCrUX(domain) {
  return new Promise((resolve) => {
    if (!GOOGLE_API_KEY) { resolve(null); return; }
    const postData = JSON.stringify({ url: `https://${domain}/` });
    const req = https.request({
      hostname: 'chromeuxreport.googleapis.com',
      path: `/v1/records:queryRecord?key=${GOOGLE_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { resolve(null); return; }
          // CrUX returns metrics — if the domain has data, it has real users
          const record = parsed.record;
          if (!record) { resolve(null); return; }

          // Estimate from form factor distribution
          // CrUX only includes domains with enough traffic (>1000 users/month)
          const formFactors = record.metrics?.form_factors?.fractions || {};
          const phone = formFactors.phone || 0;
          const desktop = formFactors.desktop || 0;
          const tablet = formFactors.tablet || 0;

          // If CrUX has data for this domain, it has at least ~5K monthly visits
          // Use navigation types and form factor to estimate scale
          let estimate = 5000; // base if CrUX has data

          // More mobile = likely more consumer traffic
          if (phone > 0.7) estimate = 50000;
          else if (phone > 0.5) estimate = 20000;
          else if (phone > 0.3) estimate = 10000;

          // Check largest contentful paint p75 — faster sites tend to have more traffic (better infra)
          const lcpP75 = record.metrics?.largest_contentful_paint?.percentiles?.p75;
          if (lcpP75 && lcpP75 < 2000) estimate *= 2; // fast site = better infrastructure = likely more traffic
          if (lcpP75 && lcpP75 < 1500) estimate *= 1.5;

          resolve({ estimate: Math.round(estimate), source: 'crux', formFactors });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(postData);
    req.end();
  });
}

// Also try with origin instead of URL
function fetchCrUXOrigin(domain) {
  return new Promise((resolve) => {
    if (!GOOGLE_API_KEY) { resolve(null); return; }
    const postData = JSON.stringify({ origin: `https://${domain}` });
    const req = https.request({
      hostname: 'chromeuxreport.googleapis.com',
      path: `/v1/records:queryRecord?key=${GOOGLE_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error || !parsed.record) { resolve(null); return; }
          const record = parsed.record;
          const formFactors = record.metrics?.form_factors?.fractions || {};
          const phone = formFactors.phone || 0;

          let estimate = 5000;
          if (phone > 0.7) estimate = 50000;
          else if (phone > 0.5) estimate = 20000;
          else if (phone > 0.3) estimate = 10000;

          const lcpP75 = record.metrics?.largest_contentful_paint?.percentiles?.p75;
          if (lcpP75 && lcpP75 < 2000) estimate *= 2;
          if (lcpP75 && lcpP75 < 1500) estimate *= 1.5;

          resolve({ estimate: Math.round(estimate), source: 'crux', formFactors });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(postData);
    req.end();
  });
}

// ── Parent domain traffic lookup ──────────────────────────────────────────
// If "stores.tanishq.co.in" has no traffic, check "tanishq.co.in"

function getParentDomain(domain) {
  // store.ashleyfurniture.in → ashleyfurniture.in
  // stores.lifestylestores.com → lifestylestores.com
  const parts = domain.split('.');
  if (parts.length <= 2) return null;
  // Skip common subdomains
  const sub = parts[0].toLowerCase();
  if (['store', 'stores', 'shop', 'www', 'app', 'my', 'en', 'in', 'm', 'blog'].includes(sub)) {
    return parts.slice(1).join('.');
  }
  return null;
}

// ── Fallback: estimate from tech stack / app presence ──────────────────────

function estimateFromSignals(doc) {
  const techCount = doc.techCount || (doc.techStack || []).length || 0;
  const hasApp = doc.appPresence && doc.appPresence !== 'No App';
  const hasEcom = (doc.techStack || []).some(t =>
    /shopify|woocommerce|magento|bigcommerce|salesforce commerce/i.test(t)
  );

  // Very rough estimation based on digital maturity signals
  let estimate = 500; // absolute minimum

  if (hasApp) estimate = 5000; // has a mobile app = at least some users
  if (hasEcom) estimate = Math.max(estimate, 2000); // has ecommerce platform
  if (techCount >= 20) estimate = Math.max(estimate, 3000);
  else if (techCount >= 10) estimate = Math.max(estimate, 1500);
  else if (techCount >= 5) estimate = Math.max(estimate, 800);

  return { estimate, source: 'estimate' };
}

// ── Format helpers ────────────────────────────────────────────────────────

function formatVisits(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function toBand(n) {
  if (n >= 20_000_000) return '20M+';
  if (n >= 5_000_000) return '5M-20M';
  if (n >= 1_000_000) return '1M-5M';
  if (n >= 500_000) return '500K-1M';
  if (n >= 200_000) return '200K-500K';
  if (n >= 50_000) return '50K-200K';
  return '<50K';
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('\n[fill-traffic] Filling missing traffic data...');
  console.log(`[fill-traffic] Google API Key: ${GOOGLE_API_KEY ? 'SET' : 'NOT SET'}\n`);

  const db = await getDb();
  const col = db.collection('company_meta');

  const docs = await col.find({
    $or: [{ monthlyVisits: null }, { monthlyVisits: 0 }, { monthlyVisits: { $exists: false } }],
  }).project({
    normalizedDomain: 1, category: 1, techStack: 1, techCount: 1, appPresence: 1,
  }).toArray();

  console.log(`[fill-traffic] ${docs.length} domains without traffic\n`);

  let cruxHits = 0;
  let parentHits = 0;
  let estimateHits = 0;
  let updated = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const domain = doc.normalizedDomain;
    process.stdout.write(`\r  [${i + 1}/${docs.length}] ${domain.padEnd(35)}`);

    let result = null;

    // 1. Try CrUX API (URL then origin)
    result = await fetchCrUX(domain);
    if (!result) result = await fetchCrUXOrigin(domain);
    if (result) cruxHits++;

    // 2. Try parent domain traffic
    if (!result) {
      const parent = getParentDomain(domain);
      if (parent) {
        const parentDoc = await col.findOne(
          { normalizedDomain: parent, monthlyVisits: { $gt: 0 } },
          { projection: { monthlyVisits: 1 } }
        );
        if (parentDoc) {
          // Subdomain gets ~10-30% of parent traffic
          result = {
            estimate: Math.round(parentDoc.monthlyVisits * 0.15),
            source: `parent:${parent}`,
          };
          parentHits++;
        }
      }
    }

    // 3. Fallback: estimate from tech/app signals
    if (!result) {
      result = estimateFromSignals(doc);
      estimateHits++;
    }

    // Write to DB
    const mv = result.estimate;
    await col.updateOne({ normalizedDomain: domain }, {
      $set: {
        monthlyVisits: mv,
        monthlyVisitsFormatted: formatVisits(mv),
        trafficBand: toBand(mv),
        trafficSource: result.source,
        trafficUpdatedAt: new Date(),
      },
    });
    updated++;

    // Rate limit CrUX API (150 req/min free tier)
    if (result.source === 'crux') await sleep(500);
    else await sleep(50);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n[fill-traffic] Done in ${elapsed}s`);
  console.log(`  Updated:       ${updated}`);
  console.log(`  CrUX hits:     ${cruxHits}`);
  console.log(`  Parent lookup: ${parentHits}`);
  console.log(`  Estimated:     ${estimateHits}\n`);

  // Verify
  const remaining = await col.countDocuments({
    $or: [{ monthlyVisits: null }, { monthlyVisits: 0 }, { monthlyVisits: { $exists: false } }],
  });
  console.log(`  Remaining without traffic: ${remaining}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('[fill-traffic] Fatal error:', err);
  process.exit(1);
});
