const https = require('https');

/**
 * AI-based fallback classifier using Groq LLM.
 * Called when keyword analysis fails to classify a domain.
 * Uses the domain name + any available HTML snippets to infer category.
 *
 * @param {string} domain - e.g. "footballfit.in"
 * @param {string} html - whatever HTML was fetched (may be minimal)
 * @returns {Promise<{category: string, subCategory: string} | null>}
 */
async function classifyWithAI(domain, html) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  // Extract any useful text from HTML
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const desc = (html.match(/name=["']description["'][^>]*content=["']([^"']+)/i) || [])[1] || '';
  const ogDesc = (html.match(/property=["']og:description["'][^>]*content=["']([^"']+)/i) || [])[1] || '';
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim() || '';

  const context = [title, desc, ogDesc, h1].filter(Boolean).join(' | ').slice(0, 500);

  const prompt = `Classify this website into a business category.

Domain: ${domain}
${context ? `Page info: ${context}` : 'No page content available — classify based on domain name only.'}

Return ONLY a valid JSON object:
{"category": "one of: Fashion & Apparel, Beauty & Personal Care, Food & Beverage, Electronics & Tech, Home & Living, Health & Wellness, Jewelry, Fitness & Gym, Baby & Kids, Pet Products, Sports & Outdoor, Ecommerce/Retail, EdTech, FinTech, SaaS & B2B, Media & Entertainment, Travel & Ticketing, Restaurant & Hospitality, Food Delivery, Home Services, Automotive, Pharmacy & Optical, Salon & Spa, Real Estate, News & Media, Gaming & Esports, Grocery & Supermarket, FMCG, Logistics, Insurance, Banking & Financial Services, Professional Services, or Unknown", "subCategory": "specific sub-category"}

Rules:
- If domain name clearly suggests a business type, classify it (e.g. "footballfit" = Fitness & Gym)
- If uncertain, return "Unknown"
- Return ONLY the JSON, no explanation`;

  try {
    const body = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 100,
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 8000,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content?.trim() || '');
          } catch { resolve(''); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(body);
      req.end();
    });

    // Parse JSON from response
    const start = result.indexOf('{');
    if (start === -1) return null;
    let depth = 0, end = -1;
    for (let i = start; i < result.length; i++) {
      if (result[i] === '{') depth++;
      else if (result[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end <= start) return null;

    const parsed = JSON.parse(result.slice(start, end));
    if (!parsed.category || parsed.category === 'Unknown') return null;

    return { category: parsed.category, subCategory: parsed.subCategory || 'General' };
  } catch {
    return null;
  }
}

module.exports = { classifyWithAI };
