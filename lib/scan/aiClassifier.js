const https = require('https');

/**
 * AI business classifier.
 *
 * Primary engine: Google Gemini Flash (uses GEMINI_API_KEY).
 * Fallback engine: Groq llama-3.1-8b (uses GROQ_API_KEY) — used only if the
 * Gemini key is missing or the Gemini call fails.
 *
 * Called from extractCompanyMeta when the keyword classifier is unsure:
 *   - category is Unknown/empty, OR
 *   - categoryConfidence is 'low', OR
 *   - subCategory is vague ('General'/'Unknown').
 *
 * @param {string} domain   e.g. "olipop.com"
 * @param {string} html     whatever HTML was fetched (may be minimal)
 * @param {object} [opts]
 * @param {string[]} [opts.categories]      allowed top-level categories (AI must pick one)
 * @param {string|null} [opts.lockedCategory] if set, keep this category and only pick a subCategory
 * @param {string|null} [opts.currentCategory] the keyword classifier's current (uncertain) guess
 * @returns {Promise<{category: string, subCategory: string} | null>}
 */
async function classifyWithAI(domain, html, opts = {}) {
  const categories = (opts.categories && opts.categories.length) ? opts.categories : DEFAULT_CATEGORIES;
  const lockedCategory = opts.lockedCategory || null;
  const currentCategory = opts.currentCategory || null;

  const context = extractContext(html);
  const prompt = buildPrompt({ domain, context, categories, lockedCategory, currentCategory });

  // 1) Gemini (primary)
  if (process.env.GEMINI_API_KEY) {
    try {
      const out = await callGemini(prompt);
      const parsed = parseResult(out, { lockedCategory, categories });
      if (parsed) return parsed;
    } catch { /* fall through to Groq */ }
  }

  // 2) Groq (fallback)
  if (process.env.GROQ_API_KEY) {
    try {
      const out = await callGroq(prompt);
      const parsed = parseResult(out, { lockedCategory, categories });
      if (parsed) return parsed;
    } catch { /* give up */ }
  }

  return null;
}

/* ── Prompt building ────────────────────────────────────────────────────── */

function extractContext(html) {
  if (!html || typeof html !== 'string') return '';
  const pick = (rx) => (rx.exec(html) || [])[1] || '';
  const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const title = strip(pick(/<title[^>]*>([\s\S]*?)<\/title>/i));
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || pick(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogSite = pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  const h1 = strip(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const nav = strip((html.match(/<nav[\s\S]*?<\/nav>/i) || [])[0] || '').slice(0, 300);

  const lines = [];
  if (ogSite) lines.push(`Site name: ${ogSite}`);
  if (title) lines.push(`Title: ${title}`);
  if (ogTitle && ogTitle !== title) lines.push(`OG title: ${ogTitle}`);
  if (desc) lines.push(`Description: ${desc}`);
  if (ogDesc && ogDesc !== desc) lines.push(`OG description: ${ogDesc}`);
  if (h1) lines.push(`Heading: ${h1}`);
  if (nav) lines.push(`Nav: ${nav}`);
  return lines.join('\n').slice(0, 1200);
}

function buildPrompt({ domain, context, categories, lockedCategory, currentCategory }) {
  const catInstruction = lockedCategory
    ? `The business category is already confirmed as "${lockedCategory}". Return that exact category and only choose the most specific subCategory for it.`
    : `Choose the single best category from this exact list:\n${categories.join(', ')}\n` +
      (currentCategory ? `A weak keyword guess was "${currentCategory}" — only keep it if it's actually correct.\n` : '') +
      `Pick the single closest-matching category from the list. Use "Unknown" only if genuinely impossible.`;

  return `You classify what a company sells, for a D2C/B2B account database.

Domain: ${domain}
${context ? `Page signals:\n${context}` : 'No usable page content — classify from the domain name and your knowledge of the brand.'}

${catInstruction}

Respond with ONLY minified JSON: {"category":"...","subCategory":"...","businessModel":"..."}
Rules:
- "category" MUST be exactly one value${lockedCategory ? ` = "${lockedCategory}"` : ' from the list above'}.
- Pick the MOST SPECIFIC category that fits what the company sells (e.g. a store selling only Pokémon/trading cards → a collectibles/toys/hobby category, a store selling only dresses → the fashion category). Use "Ecommerce/Retail" ONLY for genuine general multi-category marketplaces (like Amazon), never for a store focused on one product type.
- "subCategory" MUST be specific (2-4 words) describing the actual product line, e.g. "Soda", "Nail Care", "Men's Grooming", "Supplements", "Cookware", "Cold Brew Coffee", "Trading Cards".
- "businessModel" MUST be exactly one of: "Pure D2C" (sells only via own site/app), "Omnichannel" (own site + physical retail stores), "D2C + Marketplace" (own site + Amazon/marketplaces), "D2C + B2B" (sells to consumers and businesses).
- NEVER return "General", "Unknown", "Other" or an empty string for subCategory or businessModel.
- Classify by what the company sells to customers, not by its website technology.`;
}

/* ── Engine calls ───────────────────────────────────────────────────────── */

function postJson({ hostname, path, headers, body, timeout = 8000 }) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function callGemini(prompt) {
  const model = process.env.GEMINI_CLASSIFIER_MODEL || 'gemini-2.0-flash';
  const raw = await postJson({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 120, responseMimeType: 'application/json' },
    },
  });
  const parsed = JSON.parse(raw);
  return parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGroq(prompt) {
  const raw = await postJson({
    hostname: 'api.groq.com',
    path: '/openai/v1/chat/completions',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: {
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 120,
      response_format: { type: 'json_object' },
    },
  });
  const parsed = JSON.parse(raw);
  return parsed?.choices?.[0]?.message?.content?.trim() || '';
}

/* ── Result parsing ─────────────────────────────────────────────────────── */

function parseResult(text, { lockedCategory, categories }) {
  if (!text) return null;
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end <= start) return null;

  let parsed;
  try { parsed = JSON.parse(text.slice(start, end)); } catch { return null; }

  let category = typeof parsed.category === 'string' ? parsed.category.trim() : '';
  let subCategory = typeof parsed.subCategory === 'string' ? parsed.subCategory.trim() : '';
  let businessModel = typeof parsed.businessModel === 'string' ? parsed.businessModel.trim() : '';

  if (lockedCategory) {
    category = lockedCategory; // never let AI change a confident category
  } else {
    if (!category || category === 'Unknown') return null;
    // Snap to the closest allowed category (case-insensitive) to keep the taxonomy clean.
    const match = categories.find((c) => c.toLowerCase() === category.toLowerCase());
    if (match) category = match;
    else if (categories.length) return null; // AI returned a category outside the taxonomy
  }

  // Reject vague subcategories so we don't reintroduce "General".
  if (!subCategory || /^(general|unknown|other|n\/?a)$/i.test(subCategory)) subCategory = '';

  // Snap businessModel to an allowed value (else drop it).
  const BIZ = ['Pure D2C', 'Omnichannel', 'D2C + Marketplace', 'D2C + B2B'];
  const bizMatch = BIZ.find((b) => b.toLowerCase() === businessModel.toLowerCase());
  businessModel = bizMatch || '';

  if (!category && !subCategory) return null;
  return { category, subCategory: subCategory || 'General', businessModel: businessModel || null };
}

/* Default category list (used if the caller doesn't pass the live taxonomy). */
const DEFAULT_CATEGORIES = [
  'Fashion & Apparel', 'Beauty & Personal Care', 'Food & Beverage', 'Electronics & Tech',
  'Home & Living', 'Health & Wellness', 'Jewelry', 'Sports & Outdoor', 'Baby & Kids',
  'Pet Products', 'Grocery & Supermarket', 'FMCG', 'Ecommerce/Retail', 'Automotive',
  'Pharmacy & Optical',
];

module.exports = { classifyWithAI };
