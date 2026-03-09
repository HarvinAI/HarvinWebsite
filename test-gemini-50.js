#!/usr/bin/env node
/**
 * Test Gemini AI store count on first 50 domains from Accounts.txt
 * Stores results in MongoDB via company_meta collection
 */
// Load .env.local manually
const fs = require('fs');
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

const https = require('https');
const { getDb } = require('./lib/scan/db');
const { getStoreCountFromAI } = require('./lib/scan/deepseekStoreCount');

const DOMAINS = [
  'apple.com','coffeeza.com','griiham.in','divinetalk.in','aachho.co',
  'planetdsg.com','ironasylum.in','sofacovermaker.com','irfc.co.in','onedios.com',
  'maujicafe.com','pravek.com','greenoceanseaways.com','gudworld.in','silaii.com',
  'motovil.com','neogrowth.in','atticagoldcompany.com','bhajanvarietyshop.com','codeforindia.com',
  'nakodadcs.com','drpaulsonline.com','bombaygreens.com','lifekrafts.com','cottonsjaipur.com',
  'houseofraadhvi.com','jatinmalikcouture.com','imwow.co.in','jainmatrimony.com','rideofrenzy.com',
  'variation.in','nocpl.in','thesecretlabel.com','mangalbhawan.com','joypersonalcare.com',
  'blinglane.com','letsdressup.in','opensecret.in','yadavmatrimony.com','margadarsi.com',
  'kccreations.com','wavex.in','invisiblebed.com','ahamjewellery.com','auxilo.com',
  'casadeamor.in','worldone.in','flamingohealth.com','guduchiayurveda.com','totebae.com',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchHtml(domain) {
  return new Promise((resolve, reject) => {
    const url = `https://${domain}`;
    const req = https.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow one redirect
        https.get(res.headers.location, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
          let data = '';
          res2.on('data', c => data += c);
          res2.on('end', () => resolve(data));
        }).on('error', reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
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
  const db = await getDb();
  const col = db.collection('company_meta');
  const results = [];
  let withStores = 0, onlineOnly = 0, errors = 0;

  for (let i = 0; i < DOMAINS.length; i++) {
    const domain = DOMAINS[i];
    const idx = String(i + 1).padStart(2);
    const label = domain.padEnd(30);

    try {
      const html = await fetchHtml(domain);
      if (!html || html.length < 100) {
        console.log(`${idx}. ${label} SKIP (no html)`);
        errors++;
        continue;
      }

      const aiCount = await getStoreCountFromAI(html, domain);
      const band = countToBand(aiCount);
      const now = new Date();

      // Store in MongoDB
      await col.updateOne(
        { normalizedDomain: domain },
        {
          $set: {
            normalizedDomain: domain,
            aiStoreCount: aiCount,
            offlineStores: band,
            storeConfidence: aiCount > 0
              ? { score: 70, tier: 'medium', source: 'gemini_ai', flags: [] }
              : null,
            updatedAt: now,
            expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );

      if (aiCount > 0) {
        console.log(`${idx}. ${label} STORES: ${aiCount} (${band})`);
        withStores++;
      } else {
        console.log(`${idx}. ${label} Online only`);
        onlineOnly++;
      }
      results.push({ domain, aiCount, band });

      // 2.5s delay to stay within 30/min rate limit
      await sleep(2500);
    } catch (err) {
      console.log(`${idx}. ${label} FETCH ERR: ${err.code || err.message}`);
      errors++;
    }
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`With stores: ${withStores}`);
  console.log(`Online only: ${onlineOnly}`);
  console.log(`Errors:      ${errors}`);
  console.log(`\nResults stored in MongoDB (company_meta collection)`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
