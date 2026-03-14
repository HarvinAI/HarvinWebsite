const https = require('https');
const { getDb } = require('./db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Make a single API call to Groq. Returns the content string or '' on failure.
 */
function callGroq(body, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject({ code: res.statusCode, message: parsed.error.message || 'API error' });
            return;
          }
          const content = parsed.choices?.[0]?.message?.content?.trim() || '';
          resolve(content);
        } catch { resolve(''); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

/**
 * Check MongoDB cache for a previously stored AI store count.
 * Returns the cached count (number) or null if not cached / expired.
 */
async function getCachedStoreCount(domain) {
  try {
    const db = await getDb();
    const doc = await db.collection('ai_store_cache').findOne({ domain });
    if (doc && doc.expiresAt && new Date(doc.expiresAt) > new Date()) {
      return doc.storeCount;
    }
  } catch {}
  return null;
}

/**
 * Save AI store count to MongoDB cache (90-day TTL).
 */
async function cacheStoreCount(domain, storeCount) {
  try {
    const db = await getDb();
    const now = new Date();
    await db.collection('ai_store_cache').updateOne(
      { domain },
      {
        $set: {
          domain,
          storeCount,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  } catch {}
}

/**
 * Ask AI (via Groq free tier) to extract the store count from page content.
 * Checks DB cache first. Retries up to 2 times on rate limits.
 * Returns a number (0 if it can't determine).
 */
async function getStoreCountFromAI(pageText, brandUrl) {
  // Normalize domain
  const domain = brandUrl.replace(/^https?:\/\//, '').replace(/^www\d*\./, '').replace(/\/.*$/, '').toLowerCase();

  // Check cache first
  const cached = await getCachedStoreCount(domain);
  if (cached !== null) {
    return cached;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return 0;

  // Extract only header + footer + nav from HTML (store info lives there, not in body content)
  const cleanTag = (html) => html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let parts = [];

  // Extract <header>, <nav>, <footer> tags
  const headerMatch = pageText.match(/<header[\s\S]*?<\/header>/gi) || [];
  const navMatch = pageText.match(/<nav[\s\S]*?<\/nav>/gi) || [];
  const footerMatch = pageText.match(/<footer[\s\S]*?<\/footer>/gi) || [];

  for (const h of headerMatch) parts.push(cleanTag(h));
  for (const n of navMatch) parts.push(cleanTag(n));
  for (const f of footerMatch) parts.push(cleanTag(f));

  // If no semantic tags found, fall back to first 1000 + last 1000 chars of stripped text
  if (parts.length === 0) {
    const stripped = cleanTag(pageText);
    if (stripped.length > 2000) {
      parts.push(stripped.slice(0, 1000));
      parts.push(stripped.slice(-1000));
    } else {
      parts.push(stripped);
    }
  }

  const trimmed = parts.join('\n').slice(0, 2000);
  if (trimmed.length < 30) return 0;

  const prompt = `You are analyzing the header/nav/footer of ${brandUrl}.

From the content below, determine: How many physical retail store locations does this brand have?

Rules:
- Return ONLY a single integer number (e.g. 42)
- Look for phrases like "Store Locator", "Find a Store", "X+ stores", "Our Stores", city lists
- If the page mentions a total (e.g. "150+ stores"), return that number
- If you see a list of cities or locations, count them
- If this looks like an online-only brand with no physical stores, return 0
- Do NOT guess or hallucinate — if unsure, return 0
- Do NOT return ranges, text, or explanations — just one number

Content:
${trimmed}`;

  const body = {
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 20,
  };

  // Retry up to 2 times on 429 rate limits
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await callGroq(body, apiKey);
      const match = /(\d[\d,]*)/.exec(result);
      let count = 0;
      if (match) {
        const parsed = parseInt(match[1].replace(/,/g, ''), 10);
        if (parsed > 0 && parsed < 5000) count = parsed;
      }

      // Cache the result (even 0s, to avoid re-calling)
      await cacheStoreCount(domain, count);
      return count;
    } catch (err) {
      if (err.code === 429 && attempt < 2) {
        const wait = (attempt + 1) * 5000; // 5s, 10s
        await sleep(wait);
        continue;
      }
      if (attempt === 2 || err.code !== 429) {
        console.warn(`[ai-store] failed: ${err.message || err}`);
        return 0;
      }
    }
  }
  return 0;
}

module.exports = { getStoreCountFromAI };
