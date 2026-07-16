const https = require('https');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const commerce = extractCommerceSignals(html);
  const prompt = buildPrompt({ domain, context, commerce, categories, lockedCategory, currentCategory });

  // 1) Gemini (primary) — retry on transient rate-limit/overload with backoff
  //    so we don't degrade to the weaker model just because the free tier is busy.
  if (process.env.GEMINI_API_KEY) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await callGemini(prompt);
        const parsed = parseResult(out, { lockedCategory, categories });
        if (parsed) return parsed;
        break; // got a (non-rate-limited) response but unparseable → fall to Groq
      } catch (e) {
        if (e && e.retryable && attempt < 2) { await sleep(1500 * (attempt + 1)); continue; }
        break; // non-retryable, or out of retries → fall to Groq
      }
    }
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

/**
 * Pull the concrete signals that decide REGION and BUSINESS MODEL straight
 * from the full page, so the model reasons over real evidence (currency,
 * contact address, phone codes, marketplace links, store locator, wholesale)
 * instead of guessing from the <head>.
 */
function extractCommerceSignals(html) {
  if (!html || typeof html !== 'string') return '';
  const h = html;
  const body = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const bodyLC = body.toLowerCase();
  const hrefs = (h.match(/href=["']([^"']+)["']/gi) || []).join(' ').toLowerCase();

  // Currencies present on the page
  const cur = [];
  if (/₹|&#x20b9;|&#8377;|"pricecurrency":\s*"inr"|\bINR\b|\bRs\.?\s?\d|\bMRP\b/i.test(h)) cur.push('INR ₹');
  if (/"pricecurrency":\s*"usd"|\$\s?\d/i.test(h)) cur.push('USD $');
  if (/"pricecurrency":\s*"gbp"|£\s?\d/i.test(h)) cur.push('GBP £');
  if (/"pricecurrency":\s*"eur"|€\s?\d/i.test(h)) cur.push('EUR €');
  if (/"pricecurrency":\s*"aud"/i.test(h)) cur.push('AUD');
  if (/"pricecurrency":\s*"cad"/i.test(h)) cur.push('CAD');
  if (/"pricecurrency":\s*"aed"|\bAED\b|\bdirhams?\b/i.test(h)) cur.push('AED');
  if (/"pricecurrency":\s*"sgd"/i.test(h)) cur.push('SGD');

  // Phone country codes in the page body (contact/footer)
  const phone = [];
  if (/\+91[\s-]?\d/.test(body)) phone.push('+91 India');
  if (/\+44[\s-]?\d/.test(body)) phone.push('+44 UK');
  if (/\+1[\s-]?\(?\d{3}/.test(body)) phone.push('+1 US/Canada');
  if (/\+61[\s-]?\d/.test(body)) phone.push('+61 Australia');
  if (/\+971[\s-]?\d/.test(body)) phone.push('+971 UAE');
  if (/\+65[\s-]?\d/.test(body)) phone.push('+65 Singapore');
  if (/\+49[\s-]?\d/.test(body)) phone.push('+49 Germany');

  // Contact country from JSON-LD PostalAddress
  let addrCountry = '';
  const m = /"addresscountry"\s*:\s*(?:\{[^}]*?"name"\s*:\s*"([^"]+)"|"([^"]+)")/i.exec(h);
  if (m) addrCountry = (m[1] || m[2] || '').trim();

  // Third-party marketplace presence (own site also sells on these)
  const MK = ['amazon.', 'flipkart.', 'myntra.', 'nykaa.', 'ajio.', 'meesho.', 'tatacliq', 'jiomart', 'etsy.', 'ebay.', 'walmart.', 'target.com', 'noon.', 'zalando.'];
  const marketplaces = [...new Set(MK.filter((k) => hrefs.includes(k)).map((k) => k.replace(/\.$/, '')))];
  const marketplaceText = /\b(?:also available on|buy (?:it |now )?on|shop (?:us )?on|find us on|available (?:on|at))\s+(?:amazon|flipkart|myntra|nykaa|ajio|meesho)\b/i.test(bodyLC);

  // Own physical retail stores
  const storeLocator = /\b(?:store locator|find a store|locate (?:a )?store|our stores|visit (?:our|us at)|walk into|retail (?:store|outlet)|flagship store|experience (?:centre|center)|book an appointment)\b/i.test(bodyLC);

  // B2B / wholesale
  const b2b = /\b(?:wholesale|bulk (?:order|enquiry|inquiry|purchase|pricing)|distributors?|become a (?:reseller|partner|dealer|distributor)|trade (?:enquiry|inquiry|account|program)|for businesses?|b2b|corporate (?:gifting|orders|sales)|min(?:imum)?\.?\s*order\s*quantity|\bmoq\b|sell in bulk)\b/i.test(bodyLC);

  const lines = [];
  if (cur.length) lines.push(`Currencies shown: ${[...new Set(cur)].join(', ')}`);
  if (addrCountry) lines.push(`Contact address country: ${addrCountry}`);
  if (phone.length) lines.push(`Phone country codes: ${[...new Set(phone)].join(', ')}`);
  if (marketplaces.length || marketplaceText) lines.push(`Sells on third-party marketplaces: ${marketplaces.length ? marketplaces.join(', ') : 'yes (mentioned in copy)'}`);
  if (storeLocator) lines.push('Own physical retail stores: yes (store-locator / retail-outlet signals)');
  if (b2b) lines.push('B2B / wholesale channel: yes');
  return lines.join('\n');
}

function buildPrompt({ domain, context, commerce, categories, lockedCategory, currentCategory }) {
  const catInstruction = lockedCategory
    ? `The business category is already confirmed as "${lockedCategory}". Return that exact category and only choose the most specific subCategory for it.`
    : `Choose the single best category from this exact list:\n${categories.join(', ')}\n` +
      (currentCategory ? `A weak keyword guess was "${currentCategory}" — only keep it if it's actually correct.\n` : '') +
      `Pick the single closest-matching category from the list. Use "Unknown" only if genuinely impossible.`;

  return `You classify what a company or website IS, for a business account database.

Domain: ${domain}
${context ? `Page signals:\n${context}` : 'No usable page content — classify from the domain name and your knowledge of the brand.'}
${commerce ? `\nCommerce signals (extracted from the page — use these for region and businessModel):\n${commerce}` : ''}

${catInstruction}

Respond with ONLY minified JSON: {"category":"...","subCategory":"...","businessModel":"...","region":"...","brandName":"..."}
Rules:
- "category" MUST be exactly one value${lockedCategory ? ` = "${lockedCategory}"` : ' from the list above'}.
- Pick the MOST SPECIFIC category that fits what the company sells (e.g. a store selling only Pokémon/trading cards → a collectibles/toys/hobby category, a store selling only dresses → the fashion category). Use "Ecommerce/Retail" ONLY for genuine general multi-category marketplaces (like Amazon), never for a store focused on one product type.
- "subCategory" MUST be specific (2-4 words) describing the actual product line or service, e.g. "Soda", "Nail Care", "Men's Grooming", "Supplements", "Cookware", "Social Network", "News Aggregator", "WiFi Routers".
- MANY domains are NOT product retailers. If the site is a social network, messaging/search/maps service, news or media publisher, streaming or gaming platform, video/photo-sharing app, SaaS or developer tool, bank, insurer, telecom, government or education site, classify it by what it IS using the closest category from the list (e.g. Social Media & Platforms, News & Media, Media & Entertainment, Cloud & DevTools, Banking & Financial Services, EdTech). NEVER force a physical-product retail category (Beauty, FMCG, Fashion, Food) onto a non-retail service.
- Use your knowledge of the domain itself — it is a strong signal even with little page content (e.g. instagram.com → social network, dzen.ru → news/content platform, spotify.com → music streaming, eero/e2ro → WiFi hardware).
- If the page content looks like a login, redirect, captcha, cookie-consent or error page, IGNORE that content and classify from the domain name + brand knowledge.
- If you do NOT recognise the domain AND there is no usable product/service content, return "Unknown" for category rather than guessing a product category.
- "businessModel" MUST be exactly one of these four, decided from the commerce signals above (and your knowledge of the brand only when a signal is ambiguous):
  • "Omnichannel" — the brand runs its OWN physical retail stores in addition to selling online (store-locator / retail-outlet / flagship signals). This takes precedence.
  • "D2C + Marketplace" — else, if it also sells on third-party marketplaces (Amazon, Flipkart, Myntra, Nykaa, etc.).
  • "D2C + B2B" — else, if it also sells to businesses (wholesale / bulk / distributor / reseller / corporate / MOQ).
  • "Pure D2C" — else, it sells ONLY through its own website/app.
- "region" = the single primary country the brand sells to, inferred from the currency, contact address and phone code above (plus your brand knowledge). Use these exact spellings: "India", "US", "UK", "Australia", "Germany", "France", "Canada", "Japan", "China", "UAE", "Singapore", "Brazil", "Mexico", "Netherlands", "Spain", "Italy", "Sweden", "Saudi Arabia", "Indonesia", "New Zealand", "South Africa", "Bangladesh", "Pakistan", "Sri Lanka", "Nepal". Never write "United States"/"United Kingdom" — use "US"/"UK". Return "Global" ONLY if it clearly sells worldwide with no single primary market.
- "brandName" = the company's proper, human-readable name with correct casing and spacing (e.g. "AVT Naturals", "Zoak", "Nykaa", "boAt", "GymShark"). NEVER the domain or a URL, never include ".com"/".in"/".co", never a tagline or slogan. Use the page's site name if it's clean; otherwise use your knowledge of the brand or a properly-capitalised version of the brand word in the domain (e.g. "avtnaturals" → "AVT Naturals", "zoak" → "Zoak").
- NEVER return "General", "Unknown", "Other" or an empty string for subCategory, businessModel or region (category MAY be "Unknown" per the rule above).
- Classify by what the company/site actually is and does for its users, not by its website technology.`;
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
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function callGemini(prompt) {
  const model = process.env.GEMINI_CLASSIFIER_MODEL || 'gemini-2.0-flash';
  const { status, data } = await postJson({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 120, responseMimeType: 'application/json' },
    },
  });
  // 429 (rate limit) / 503 (overloaded) are transient — signal a retry rather
  // than silently degrading to the weaker fallback model.
  if (status === 429 || status === 503) { const e = new Error('gemini_rate_limited'); e.retryable = true; throw e; }
  const parsed = JSON.parse(data);
  return parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGroq(prompt) {
  const { data: raw } = await postJson({
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

  // Normalize region to a value the app recognizes (else drop → heuristic fallback).
  let region = typeof parsed.region === 'string' ? parsed.region.trim() : '';
  region = normalizeRegion(region);

  // Clean the brand name; reject anything that leaked a domain/URL or is junk.
  let brandName = typeof parsed.brandName === 'string' ? parsed.brandName.trim() : '';
  brandName = cleanBrandName(brandName);

  if (!category && !subCategory) return null;
  return { category, subCategory: subCategory || 'General', businessModel: businessModel || null, region: region || null, brandName: brandName || null };
}

/* Reject a brand name that is really a domain/URL, an empty/placeholder, or
 * absurdly long — so we never display "zoak.co.in" as a company name. */
function cleanBrandName(name) {
  if (!name) return '';
  let n = name.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').trim();
  // Strip leading/trailing separator junk that leaks from og:title, e.g.
  // "3i Infotech |", "Zoak – ", "· Nykaa".
  n = n.replace(/^[\s|\-–—·:»«/]+/, '').replace(/[\s|\-–—·:»«/]+$/, '').trim();
  if (!n) return '';
  // Looks like a bare domain (word.tld or word.tld.tld, no spaces) → reject.
  if (!/\s/.test(n) && /\.[a-z]{2,4}(\.[a-z]{2,4})?$/i.test(n)) return '';
  if (/^(unknown|n\/?a|none|null|general|company|website|home)$/i.test(n)) return '';
  if (n.length > 60) return '';
  return n;
}

/* Region normalization — map common spellings/synonyms to the app's canonical
 * region set (mirrors VALID_REGIONS in app/api/accounts/route.ts). Returns '' if
 * the value isn't a region we recognize, so the caller falls back to the heuristic. */
const ALLOWED_REGIONS = new Set([
  'India', 'US', 'UK', 'Australia', 'Germany', 'France', 'Canada', 'Japan',
  'South Korea', 'Brazil', 'Mexico', 'Italy', 'Spain', 'Netherlands', 'Sweden',
  'Singapore', 'UAE', 'Saudi Arabia', 'Indonesia', 'Thailand', 'Malaysia',
  'Vietnam', 'Philippines', 'New Zealand', 'South Africa', 'Nigeria', 'Kenya',
  'Egypt', 'Turkey', 'Poland', 'Switzerland', 'Belgium', 'Austria', 'Denmark',
  'Norway', 'Finland', 'Ireland', 'Portugal', 'Czech Republic', 'Romania',
  'Hungary', 'Israel', 'China', 'Taiwan', 'Hong Kong', 'Bangladesh', 'Pakistan',
  'Sri Lanka', 'Nepal', 'Global',
]);
const REGION_SYNONYMS = {
  'united states': 'US', 'united states of america': 'US', 'usa': 'US', 'u.s.': 'US', 'u.s.a.': 'US', 'america': 'US',
  'united kingdom': 'UK', 'great britain': 'UK', 'britain': 'UK', 'england': 'UK', 'u.k.': 'UK',
  'uae': 'UAE', 'united arab emirates': 'UAE', 'dubai': 'UAE', 'abu dhabi': 'UAE',
  'ksa': 'Saudi Arabia', 'kingdom of saudi arabia': 'Saudi Arabia',
  'korea': 'South Korea', 'republic of korea': 'South Korea',
  'worldwide': 'Global', 'international': 'Global', 'multiple': 'Global', 'multiple countries': 'Global', 'global': 'Global',
  'bharat': 'India',
};
function normalizeRegion(region) {
  if (!region) return '';
  const lc = region.toLowerCase().trim();
  if (REGION_SYNONYMS[lc]) return REGION_SYNONYMS[lc];
  const exact = [...ALLOWED_REGIONS].find((r) => r.toLowerCase() === lc);
  return exact || '';
}

/* Default category list (used if the caller doesn't pass the live taxonomy). */
const DEFAULT_CATEGORIES = [
  'Fashion & Apparel', 'Beauty & Personal Care', 'Food & Beverage', 'Electronics & Tech',
  'Home & Living', 'Health & Wellness', 'Jewelry', 'Sports & Outdoor', 'Baby & Kids',
  'Pet Products', 'Grocery & Supermarket', 'FMCG', 'Ecommerce/Retail', 'Automotive',
  'Pharmacy & Optical',
];

module.exports = { classifyWithAI };
