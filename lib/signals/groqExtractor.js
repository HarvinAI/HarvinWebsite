const https = require('https');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Simple semaphore for concurrency control
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }
  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    await new Promise(resolve => this.queue.push(resolve));
    this.current++;
  }
  release() {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    }
  }
}

const semaphore = new Semaphore(1); // sequential to respect Groq free tier TPM limits

/**
 * Call Groq API (reused pattern from deepseekStoreCount.js).
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
      timeout: 10000,
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
 * Extract structured signal data from a news headline using Groq LLM.
 *
 * @param {Object} article - {title, snippet, url, pubDate}
 * @param {string} brandName
 * @param {string} apiKey
 * @returns {Promise<Object|null>} Extracted signal or null if not relevant
 */
async function extractSignal(article, brandName, apiKey) {
  await semaphore.acquire();
  try {
    const result = await _extractWithRetry(article, brandName, apiKey);
    // Cooldown between calls to respect Groq free tier limits (6K TPM)
    await sleep(12000);
    return result;
  } finally {
    semaphore.release();
  }
}

async function _extractWithRetry(article, brandName, apiKey) {
  const prompt = `Analyze this news headline about "${brandName}" and extract structured signal data.

Headline: ${article.title}
Snippet: ${article.snippet}

Return ONLY a valid JSON object with these fields:
{
  "isRelevant": boolean (true if this is about funding, investment, key executive hire, or fundraising for "${brandName}"),
  "signalType": "funding" | "key_hire" | null,
  "amount": string or null (e.g. "$30M"),
  "round": string or null (e.g. "Series D", "Seed", "Pre-Series A"),
  "investors": string[] (investor names, empty array if unknown),
  "person": string or null (name of hired person),
  "title": string or null (job title of hired person, e.g. "CTO", "VP Engineering"),
  "confidence": number (0.0 to 1.0)
}

Rules:
- Set isRelevant=false if the headline is not about ${brandName}'s funding or key hiring
- For funding: extract amount, round, and investors
- For key_hire: extract person name and their title
- Only mark key_hire for VP-level and above (VP, SVP, CTO, CFO, CEO, CMO, COO, CPO, Head of, Director)
- Do NOT mark brand ambassadors, endorsers, or celebrities as key_hire
- Do NOT mark appointments at OTHER companies as signals for "${brandName}"
- Return ONLY the JSON, no explanation`;

  const body = {
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 300,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await callGroq(body, apiKey);
      // Extract JSON from response — try multiple strategies
      let parsed = null;

      // Strategy 1: direct parse
      try { parsed = JSON.parse(result.trim()); } catch {}

      // Strategy 2: extract first JSON object with balanced braces
      if (!parsed) {
        const start = result.indexOf('{');
        if (start !== -1) {
          let depth = 0;
          let end = -1;
          for (let i = start; i < result.length; i++) {
            if (result[i] === '{') depth++;
            else if (result[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
          }
          if (end > start) {
            try { parsed = JSON.parse(result.slice(start, end)); } catch {}
          }
        }
      }

      if (!parsed) return null;
      if (!parsed.isRelevant) return null;

      return {
        signalType: parsed.signalType,
        amount: parsed.amount || null,
        round: parsed.round || null,
        investors: parsed.investors || [],
        person: parsed.person || null,
        title: parsed.title || null,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      };
    } catch (err) {
      if (err.code === 429 && attempt < 2) {
        const wait = (attempt + 1) * 15000;
        console.warn(`[groqExtractor] rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (attempt === 2 || (err.code && err.code !== 429)) {
        console.warn(`[groqExtractor] failed: ${err.message || err}`);
        return null;
      }
    }
  }
  return null;
}

/**
 * Check if a signal already exists in the database (dedup by domain+headline).
 */
async function signalExists(db, domain, headline) {
  const existing = await db.collection('signals').findOne({
    domain,
    headline,
  });
  return !!existing;
}

module.exports = { extractSignal, signalExists };
