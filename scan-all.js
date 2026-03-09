#!/usr/bin/env node
/**
 * Scan ALL domains from Accounts.txt for AI store count.
 * - Skips domains already cached in MongoDB (ai_store_cache)
 * - Respects Groq rate limits (30/min → 2s delay)
 * - Resumable: re-run to continue from where it left off
 * - Logs progress every 100 domains
 */
const fs = require('fs');
const https = require('https');

// Load .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const { getDb } = require('./lib/scan/db');
const { getStoreCountFromAI } = require('./lib/scan/deepseekStoreCount');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchHtml(domain) {
  const http = require('http');
  const doGet = (u, redirects = 0) => new Promise((resolve, reject) => {
    if (redirects > 3) return reject(new Error('too many redirects'));
    const mod = u.startsWith('http://') ? http : https;
    const req = mod.get(u, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HarvinBot/1.0)' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://${domain}${res.headers.location}`;
        doGet(loc, redirects + 1).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
  return doGet(`https://${domain}`);
}

function countToBand(count) {
  if (count <= 0) return 'Online';
  if (count <= 10) return '1-10';
  if (count <= 20) return '11-20';
  if (count <= 50) return '21-50';
  if (count <= 100) return '51-100';
  return '100+';
}

async function main() {
  const domains = fs.readFileSync('Accounts.txt', 'utf8')
    .split('\n')
    .map(d => d.trim().toLowerCase())
    .filter(d => d && d.includes('.'));

  console.log(`Total domains: ${domains.length}`);

  const db = await getDb();
  const cacheCol = db.collection('ai_store_cache');
  const metaCol = db.collection('company_meta');

  // Check which domains are already cached
  const cachedDocs = await cacheCol.find({}).toArray();
  const cachedSet = new Set(cachedDocs.map(d => d.domain));
  const toScan = domains.filter(d => !cachedSet.has(d));

  console.log(`Already cached: ${cachedSet.size}`);
  console.log(`Remaining to scan: ${toScan.length}`);
  console.log(`---`);

  let withStores = 0, onlineOnly = 0, errors = 0, apiCalls = 0;
  const startTime = Date.now();

  for (let i = 0; i < toScan.length; i++) {
    const domain = toScan[i];
    const idx = String(i + 1).padStart(5);
    const label = domain.padEnd(35);

    try {
      const html = await fetchHtml(domain);
      if (!html || html.length < 100) {
        if (i % 100 === 0 || i < 10) console.log(`${idx}. ${label} SKIP (no html)`);
        errors++;
        continue;
      }

      const aiCount = await getStoreCountFromAI(html, domain);
      apiCalls++;
      const band = countToBand(aiCount);
      const now = new Date();

      // Only update offlineStores in company_meta if the doc already has category/region
      // (don't create incomplete entries — the full scan flow handles that)
      const existing = await metaCol.findOne({ normalizedDomain: domain });
      if (existing && existing.category) {
        await metaCol.updateOne(
          { normalizedDomain: domain },
          {
            $set: {
              aiStoreCount: aiCount,
              offlineStores: band,
              storeConfidence: aiCount > 0
                ? { score: 70, tier: 'medium', source: 'groq_ai', flags: [] }
                : null,
              updatedAt: now,
            },
          }
        );
      }

      if (aiCount > 0) {
        console.log(`${idx}. ${label} STORES: ${aiCount} (${band})`);
        withStores++;
      } else {
        if (i % 100 === 0 || i < 10) console.log(`${idx}. ${label} Online only`);
        onlineOnly++;
      }

      // Progress log every 100 domains
      if ((i + 1) % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const rate = (apiCalls / ((Date.now() - startTime) / 1000 / 60)).toFixed(1);
        console.log(`\n--- Progress: ${i + 1}/${toScan.length} | Stores: ${withStores} | Online: ${onlineOnly} | Errors: ${errors} | ${elapsed}min | ${rate} req/min ---\n`);
      }

      // 2s delay between API calls to stay within 30/min
      await sleep(4000);
    } catch (err) {
      if (i % 100 === 0 || i < 10) console.log(`${idx}. ${label} FETCH ERR: ${err.code || err.message}`);
      errors++;
      // Don't delay on fetch errors (no API call was made)
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n=== FINAL SUMMARY ===`);
  console.log(`With stores: ${withStores}`);
  console.log(`Online only: ${onlineOnly}`);
  console.log(`Errors:      ${errors}`);
  console.log(`API calls:   ${apiCalls}`);
  console.log(`Time:        ${totalTime} minutes`);
  console.log(`All results stored in MongoDB`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
