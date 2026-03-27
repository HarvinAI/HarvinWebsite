#!/usr/bin/env node

/**
 * Re-classification script for low-confidence domain categories.
 *
 * Fetches homepage title + meta description via lightweight HTTP GET,
 * then applies D2C Classification Rules keyword matching.
 *
 * No API keys, no Puppeteer, no LLM — pure regex on HTML meta tags.
 *
 * Usage:
 *   node scripts/reclassify-domains.js                  # re-classify all low/missing
 *   node scripts/reclassify-domains.js --dry-run        # preview without writing
 *   node scripts/reclassify-domains.js --limit 100      # limit domains
 *   node scripts/reclassify-domains.js --domain zo.xyz  # single domain
 *   node scripts/reclassify-domains.js --include-medium # also re-check medium confidence
 *   node scripts/reclassify-domains.js --verbose        # print every change
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

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

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const INCLUDE_MEDIUM = args.includes('--include-medium');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;
const domainIdx = args.indexOf('--domain');
const SINGLE_DOMAIN = domainIdx !== -1 ? args[domainIdx + 1] : null;

const PROGRESS_FILE = path.resolve(__dirname, 'reclassify-progress.json');

// ── Lightweight HTTP fetch — just get enough HTML for meta tags ────────────

function fetchHomepageMeta(domain, timeout = 5000) {
  return new Promise((resolve) => {
    const url = `https://${domain}`;
    const req = https.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        const redirectUrl = loc.startsWith('http') ? loc : `https://${domain}${loc}`;
        res.resume();
        // Simple redirect follow (1 level)
        const mod2 = redirectUrl.startsWith('https') ? https : http;
        const req2 = mod2.get(redirectUrl, { timeout, headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        }}, (res2) => {
          let html = '';
          res2.on('data', chunk => {
            html += chunk;
            // Stop after 50KB — we only need the <head>
            if (html.length > 50000) { res2.destroy(); }
          });
          res2.on('end', () => resolve(parseMeta(html)));
          res2.on('error', () => resolve(null));
        });
        req2.on('error', () => resolve(null));
        req2.on('timeout', () => { req2.destroy(); resolve(null); });
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      let html = '';
      res.on('data', chunk => {
        html += chunk;
        if (html.length > 50000) { res.destroy(); }
      });
      res.on('end', () => resolve(parseMeta(html)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => {
      // Try HTTP fallback
      const req2 = http.get(`http://${domain}`, { timeout, headers: {
        'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html',
      }}, (res2) => {
        if (res2.statusCode !== 200) { res2.resume(); resolve(null); return; }
        let html = '';
        res2.on('data', chunk => { html += chunk; if (html.length > 50000) res2.destroy(); });
        res2.on('end', () => resolve(parseMeta(html)));
        res2.on('error', () => resolve(null));
      });
      req2.on('error', () => resolve(null));
      req2.on('timeout', () => { req2.destroy(); resolve(null); });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function parseMeta(html) {
  if (!html) return null;
  const title = extractMetaTag(html, 'title') || '';
  const description = getMetaContent(html, 'description') || '';
  const keywords = getMetaContent(html, 'keywords') || '';
  const ogTitle = getMetaProperty(html, 'og:title') || '';
  const ogDescription = getMetaProperty(html, 'og:description') || '';
  const ogSiteName = getMetaProperty(html, 'og:site_name') || '';
  const ogType = getMetaProperty(html, 'og:type') || '';

  // Also grab h1 and nav items from early HTML
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
  const navText = (html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i) || [])[1] || '';

  const combined = [title, description, keywords, ogTitle, ogDescription, ogSiteName, h1, cleanHtml(navText)].join(' ');
  return {
    title: cleanHtml(title),
    description: cleanHtml(description),
    keywords: cleanHtml(keywords),
    ogType,
    combined: cleanHtml(combined),
  };
}

function extractMetaTag(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = re.exec(html);
  return m ? m[1].trim() : '';
}

function getMetaContent(html, name) {
  const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*?)["']`, 'i');
  const m = re.exec(html);
  if (m) return m[1];
  // Try reversed order (content before name)
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']${name}["']`, 'i');
  const m2 = re2.exec(html);
  return m2 ? m2[1] : '';
}

function getMetaProperty(html, prop) {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*?)["']`, 'i');
  const m = re.exec(html);
  if (m) return m[1];
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+property=["']${prop}["']`, 'i');
  const m2 = re2.exec(html);
  return m2 ? m2[1] : '';
}

function cleanHtml(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// ── D2C Category classification rules (from PDF) ──────────────────────────
// Each rule: { category, subCategory, keywords: RegExp, weight }
// Higher weight = more specific = preferred when multiple match

const CLASSIFICATION_RULES = [
  // ── PRODUCT CATEGORIES (Level 2, Section 3) ──────────────────────────

  // 3.1 Fashion & Apparel
  { category: 'Fashion & Apparel', subCategory: 'Tops & Shirts', keywords: /\b(?:t-?shirts?|shirts?|blouses?|sweaters?|hoodies?|tank\s*tops?|cardigans?|polo)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Bottoms', keywords: /\b(?:jeans|pants|shorts|skirts?|leggings?|trousers|chinos|palazzos?)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Dresses', keywords: /\b(?:dresses?|gowns?|jumpsuits?|rompers?)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Ethnic Wear', keywords: /\b(?:saree|sari|kurta|kurti|lehenga|salwar|churidar|anarkali|sherwani|dupatta|ethnic\s*wear)\b/i, weight: 6 },
  { category: 'Fashion & Apparel', subCategory: 'Outerwear', keywords: /\b(?:jackets?|coats?|blazers?|vests?|parka|windbreaker)\b/i, weight: 4 },
  { category: 'Fashion & Apparel', subCategory: 'Activewear', keywords: /\b(?:activewear|workout\s*clothes?|yoga\s*pants?|sports?\s*bras?|athletic\s*shorts?|gym\s*wear)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Loungewear', keywords: /\b(?:loungewear|sleepwear|pajamas?|robes?|nightwear|nightgown)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Swimwear', keywords: /\b(?:swimsuits?|swimwear|bikinis?|board\s*shorts?|swim\s*trunks?)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Lingerie & Innerwear', keywords: /\b(?:bras?|underwear|shapewear|lingerie|innerwear|panties|briefs|boxers)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'General', keywords: /\b(?:fashion|apparel|clothing|garments?|outfits?|collection|wardrobe|style|wear|boutique|designer\s*wear)\b/i, weight: 3 },

  // 3.2 Footwear (PDF says separate from Fashion)
  { category: 'Fashion & Apparel', subCategory: 'Footwear', keywords: /\b(?:shoes?|sneakers?|boots?|sandals?|heels?|loafers?|flats|slippers?|footwear|pumps|oxfords?|running\s*shoes?|cleats)\b/i, weight: 5 },

  // 3.3 Fashion Accessories
  { category: 'Fashion & Apparel', subCategory: 'Bags & Luggage', keywords: /\b(?:bags?|backpacks?|handbags?|totes?|crossbody|clutch|duffel|luggage|purse|satchel)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Watches', keywords: /\b(?:watches?|smartwatch|wristwatch|timepiece|chronograph)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Eyewear', keywords: /\b(?:eyewear|sunglasses|glasses|spectacles|frames|optical|lenses?|blue\s*light)\b/i, weight: 5 },
  { category: 'Fashion & Apparel', subCategory: 'Accessories', keywords: /\b(?:belts?|hats?|caps?|scarves?|bandanas?|gloves?|wallets?|cardholders?|ties?|cufflinks?|socks|hosiery|hair\s*accessories)\b/i, weight: 4 },

  // 3.4 Jewelry
  { category: 'Jewelry', subCategory: 'Necklaces & Chains', keywords: /\b(?:necklaces?|chains?|pendants?|chokers?|mangalsutra)\b/i, weight: 6 },
  { category: 'Jewelry', subCategory: 'Earrings', keywords: /\b(?:earrings?|studs?|hoops?|dangles?|ear\s*cuffs?|jhumka)\b/i, weight: 6 },
  { category: 'Jewelry', subCategory: 'Bracelets & Bangles', keywords: /\b(?:bracelets?|bangles?|cuffs?|charm\s*bracelet|kada)\b/i, weight: 6 },
  { category: 'Jewelry', subCategory: 'Rings', keywords: /\b(?:rings?|engagement\s*ring|wedding\s*band|stackable\s*ring)\b/i, weight: 5 },
  { category: 'Jewelry', subCategory: 'General', keywords: /\b(?:jewel(?:ry|lery)|gold|silver|platinum|diamond|gemstone|precious\s*stone|14k|18k|24k|sterling|carat|fine\s*jewel|artisan\s*jewel|handcrafted\s*jewel)\b/i, weight: 5 },

  // 3.5 Beauty & Personal Care
  { category: 'Beauty & Personal Care', subCategory: 'Skincare', keywords: /\b(?:skincare|skin\s*care|cleanser|toner|serum|moisturizer|sunscreen|face\s*mask|exfoliant|retinol|hyaluronic|vitamin\s*c|niacinamide|anti.?aging)\b/i, weight: 6 },
  { category: 'Beauty & Personal Care', subCategory: 'Makeup', keywords: /\b(?:makeup|make.?up|foundation|concealer|lipstick|mascara|eyeshadow|blush|bronzer|primer|cosmetics?|lip\s*gloss|eyeliner)\b/i, weight: 6 },
  { category: 'Beauty & Personal Care', subCategory: 'Hair Care', keywords: /\b(?:hair\s*care|shampoo|conditioner|hair\s*oil|hair\s*mask|hair\s*treatment|styling|hair\s*growth|anti.?dandruff|keratin)\b/i, weight: 6 },
  { category: 'Beauty & Personal Care', subCategory: 'Fragrance', keywords: /\b(?:perfume|fragrance|cologne|body\s*spray|scented\s*oil|eau\s*de|attar|deodorant)\b/i, weight: 6 },
  { category: 'Beauty & Personal Care', subCategory: "Men's Grooming", keywords: /\b(?:men'?s?\s*grooming|beard\s*oil|shaving|aftershave|men'?s?\s*skincare|trimmer)\b/i, weight: 6 },
  { category: 'Beauty & Personal Care', subCategory: 'Bath & Body', keywords: /\b(?:body\s*wash|soap|bath\s*bomb|body\s*lotion|body\s*butter|hand\s*cream|shower\s*gel)\b/i, weight: 5 },
  { category: 'Beauty & Personal Care', subCategory: 'Nail Care', keywords: /\b(?:nail\s*polish|nail\s*art|nail\s*treatment|manicure|pedicure|gel\s*nails?)\b/i, weight: 5 },
  { category: 'Beauty & Personal Care', subCategory: 'General', keywords: /\b(?:beauty|personal\s*care|clean\s*beauty|cruelty.?free|vegan\s*beauty|organic\s*beauty|natural\s*beauty|paraben.?free|glow|radiant)\b/i, weight: 4 },

  // 3.6 Food & Beverage
  { category: 'Food & Beverage', subCategory: 'Snacks', keywords: /\b(?:snacks?|chips?|crackers?|nuts?|trail\s*mix|protein\s*bars?|cookies?|biscuits?|namkeen|munchies|popcorn)\b/i, weight: 5 },
  { category: 'Food & Beverage', subCategory: 'Coffee & Tea', keywords: /\b(?:coffee|tea|matcha|chai|espresso|brew|roast|loose\s*leaf|pods?|coffee\s*beans?|green\s*tea)\b/i, weight: 5 },
  { category: 'Food & Beverage', subCategory: 'Supplements', keywords: /\b(?:supplements?|vitamins?|protein\s*powder|collagen|probiotics?|omega|whey|bcaa|creatine|nutrition)\b/i, weight: 5 },
  { category: 'Food & Beverage', subCategory: 'Specialty Foods', keywords: /\b(?:organic\s*food|vegan\s*food|keto|gluten.?free|paleo|superfoods?|millet|quinoa|health\s*food)\b/i, weight: 5 },
  { category: 'Food & Beverage', subCategory: 'Beverages', keywords: /\b(?:beverages?|juice|kombucha|sparkling\s*water|energy\s*drink|smoothie|cold.?press|soda|lemonade)\b/i, weight: 5 },
  { category: 'Food & Beverage', subCategory: 'Condiments & Spices', keywords: /\b(?:spices?|masala|condiments?|sauces?|pickles?|chutneys?|honey|ghee|jam|preserve|nut\s*butter)\b/i, weight: 5 },
  { category: 'Food & Beverage', subCategory: 'Alcohol', keywords: /\b(?:wine|beer|spirits?|whiskey|vodka|rum|gin|cocktail|brewery|craft\s*beer|single\s*malt|liquor)\b/i, weight: 6 },
  { category: 'Food & Beverage', subCategory: 'Meal Kits', keywords: /\b(?:meal\s*kit|ready.?to.?eat|meal\s*prep|subscription\s*meal|meal\s*plan|food\s*box|recipe\s*box)\b/i, weight: 5 },
  { category: 'Food & Beverage', subCategory: 'General', keywords: /\b(?:food|gourmet|artisan\s*food|farm.?to.?table|fresh|bakery|chocolate|sweets?|candy|confection|dessert|ice\s*cream)\b/i, weight: 3 },

  // 3.7 Home & Living
  { category: 'Home & Living', subCategory: 'Furniture', keywords: /\b(?:furniture|sofas?|chairs?|tables?|desks?|cabinets?|shelves?|bookcase|bed\s*frame|wardrobe|ottoman)\b/i, weight: 5 },
  { category: 'Home & Living', subCategory: 'Home Decor', keywords: /\b(?:home\s*decor|wall\s*art|throw\s*pillows?|candles?|vases?|mirrors?|rugs?|lighting|lamp|curtains?|wallpaper)\b/i, weight: 5 },
  { category: 'Home & Living', subCategory: 'Bedding & Bath', keywords: /\b(?:bedding|sheets?|duvet|comforter|pillows?|towels?|bathrobes?|blankets?|mattress)\b/i, weight: 5 },
  { category: 'Home & Living', subCategory: 'Kitchen & Dining', keywords: /\b(?:cookware|dinnerware|cutlery|kitchen|utensils?|storage\s*container|appliance|blender|mixer|pots?\s*(?:and|&)\s*pans?)\b/i, weight: 5 },
  { category: 'Home & Living', subCategory: 'Smart Home', keywords: /\b(?:smart\s*home|smart\s*speaker|thermostat|security\s*camera|smart\s*light|home\s*automation|alexa|google\s*home)\b/i, weight: 5 },
  { category: 'Home & Living', subCategory: 'General', keywords: /\b(?:home|living|interior|household|houseware|homeware|furnishing)\b/i, weight: 2 },

  // 3.8 Health & Wellness (Physical Products)
  { category: 'Health & Wellness', subCategory: 'Fitness Equipment', keywords: /\b(?:dumbbells?|kettlebells?|resistance\s*bands?|yoga\s*mats?|exercise\s*bike|treadmill|home\s*gym|weights?|barbell)\b/i, weight: 6 },
  { category: 'Health & Wellness', subCategory: 'Sexual Wellness', keywords: /\b(?:sexual\s*wellness|contraceptive|lubricant|intimacy|intimate|condom|sexual\s*health)\b/i, weight: 6 },
  { category: 'Health & Wellness', subCategory: 'Medical Devices', keywords: /\b(?:blood\s*pressure|thermometer|first\s*aid|compression\s*wear|pulse\s*oximeter|glucometer|BP\s*monitor)\b/i, weight: 6 },
  { category: 'Health & Wellness', subCategory: 'Mental Health', keywords: /\b(?:aromatherapy|essential\s*oils?|meditation|mindfulness|journaling|stress\s*relief|wellness\s*journal|self.?care)\b/i, weight: 4 },
  { category: 'Health & Wellness', subCategory: 'General', keywords: /\b(?:wellness|health|ayurved|herbal|natural\s*remedy|holistic|organic\s*health|detox|immunity)\b/i, weight: 3 },

  // 3.9 Baby & Kids
  { category: 'Baby & Kids', subCategory: 'Baby Care', keywords: /\b(?:diapers?|wipes|baby\s*bottles?|pacifiers?|baby\s*monitor|stroller|car\s*seat|baby\s*care|newborn|infant)\b/i, weight: 6 },
  { category: 'Baby & Kids', subCategory: 'Toys & Games', keywords: /\b(?:toys?|puzzles?|board\s*games?|action\s*figures?|dolls?|outdoor\s*toys?|building\s*blocks?|lego)\b/i, weight: 5 },
  { category: 'Baby & Kids', subCategory: 'Kids Furniture', keywords: /\b(?:cribs?|toddler\s*bed|kids?\s*desk|toy\s*storage|nursery\s*furniture|bunk\s*bed)\b/i, weight: 6 },
  { category: 'Baby & Kids', subCategory: 'General', keywords: /\b(?:baby|kids?|children|toddler|infant|newborn|maternity|parenting|mommy|nursery)\b/i, weight: 3 },

  // 3.10 Pet Products
  { category: 'Pet Products', subCategory: 'Pet Food', keywords: /\b(?:dog\s*food|cat\s*food|pet\s*food|pet\s*treats?|kibble|raw\s*dog\s*food|grain.?free\s*pet)\b/i, weight: 6 },
  { category: 'Pet Products', subCategory: 'Pet Supplies', keywords: /\b(?:pet\s*supplies|collars?|leash|pet\s*bed|pet\s*toy|litter|pet\s*grooming|scratching\s*post|cat\s*tree|dog\s*bed)\b/i, weight: 6 },
  { category: 'Pet Products', subCategory: 'General', keywords: /\b(?:pets?|dogs?|cats?|puppy|kitten|furry|paws?|pet\s*care|vet\s*recommended|pet\s*parent)\b/i, weight: 4 },

  // 3.11 Electronics & Tech
  { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', keywords: /\b(?:smartphones?|tablets?|laptops?|monitors?|cameras?|drones?|gadgets?|electronics?)\b/i, weight: 5 },
  { category: 'Electronics & Tech', subCategory: 'Wearables', keywords: /\b(?:smartwatch|fitness\s*tracker|smart\s*ring|VR\s*headset|wearable)\b/i, weight: 6 },
  { category: 'Electronics & Tech', subCategory: 'Audio', keywords: /\b(?:headphones?|earbuds?|speakers?|soundbar|microphone|audio|wireless\s*earphone|TWS|ANC)\b/i, weight: 5 },
  { category: 'Electronics & Tech', subCategory: 'Gaming', keywords: /\b(?:gaming\s*(?:keyboard|mouse|chair|headset|monitor|console|accessories)|game\s*controller)\b/i, weight: 5 },
  { category: 'Electronics & Tech', subCategory: 'Tech Accessories', keywords: /\b(?:phone\s*cases?|chargers?|cables?|power\s*banks?|webcam|USB|adapter|screen\s*protector)\b/i, weight: 4 },

  // 3.12 Sports & Outdoor (PDF: Outdoor & Recreation)
  { category: 'Sports & Outdoor', subCategory: 'Camping & Hiking', keywords: /\b(?:camping|hiking|tents?|sleeping\s*bags?|backpacks?|camp\s*stoves?|trekking|outdoor\s*adventure)\b/i, weight: 5 },
  { category: 'Sports & Outdoor', subCategory: 'Sports Equipment', keywords: /\b(?:bicycles?|skateboards?|surfboards?|fishing|golf|cricket|badminton|tennis|sports?\s*equipment)\b/i, weight: 5 },
  { category: 'Sports & Outdoor', subCategory: 'General', keywords: /\b(?:outdoor|recreation|adventure|explore|expedition|nature|trail)\b/i, weight: 2 },

  // 3.13 Office & Stationery
  { category: 'Office & Stationery', subCategory: 'Notebooks & Planners', keywords: /\b(?:notebooks?|journals?|planners?|calendars?|diary|writing\s*pad)\b/i, weight: 5 },
  { category: 'Office & Stationery', subCategory: 'Writing Instruments', keywords: /\b(?:pens?|pencils?|markers?|highlighters?|fountain\s*pen|ballpoint)\b/i, weight: 5 },
  { category: 'Office & Stationery', subCategory: 'Art Supplies', keywords: /\b(?:art\s*supplies|craft|painting|canvas|brushes|sketch|watercolor|acrylic)\b/i, weight: 5 },
  { category: 'Office & Stationery', subCategory: 'General', keywords: /\b(?:stationery|office\s*supplies|desk\s*accessories|file\s*storage|organizer)\b/i, weight: 4 },

  // ── SERVICE CATEGORIES (Level 3, Section 4) ──────────────────────────

  // 4.1 EdTech
  { category: 'EdTech', subCategory: 'Online Learning', keywords: /\b(?:online\s*cours|e-?learning|learning\s*platform|skill\s*development|bootcamp|certification|tutoring|coaching|upskill|MOOC|LMS)\b/i, weight: 6 },
  { category: 'EdTech', subCategory: 'Test Prep', keywords: /\b(?:SAT|GRE|GMAT|IELTS|TOEFL|test\s*prep|entrance\s*exam|competitive\s*exam|JEE|NEET|UPSC|CAT\s*prep)\b/i, weight: 7 },
  { category: 'EdTech', subCategory: 'K-12', keywords: /\b(?:K.?12|school\s*learning|student\s*platform|class\s*\d|homework|tuition|study\s*material|CBSE|ICSE|NCERT)\b/i, weight: 6 },
  { category: 'EdTech', subCategory: 'Language Learning', keywords: /\b(?:language\s*learning|learn\s*(?:english|spanish|french|hindi|german)|duolingo|vocabulary|grammar)\b/i, weight: 6 },
  { category: 'EdTech', subCategory: 'General', keywords: /\b(?:education|learning|academy|institute|training|teach|mentor|ed-?tech|learn)\b/i, weight: 3 },

  // 4.2 FinTech
  { category: 'FinTech', subCategory: 'Digital Banking', keywords: /\b(?:digital\s*bank|neobank|checking\s*account|savings\s*account|debit\s*card|mobile\s*banking|zero\s*balance)\b/i, weight: 7 },
  { category: 'FinTech', subCategory: 'Payments', keywords: /\b(?:payment|UPI|digital\s*wallet|P2P|pay\s*later|BNPL|buy\s*now\s*pay\s*later|checkout|POS|merchant)\b/i, weight: 6 },
  { category: 'FinTech', subCategory: 'Investment', keywords: /\b(?:invest|robo.?advisor|mutual\s*fund|stock\s*trad|crypto\s*trad|SIP|portfolio|equity|demat)\b/i, weight: 6 },
  { category: 'FinTech', subCategory: 'Lending', keywords: /\b(?:loan|lending|credit|EMI|personal\s*loan|home\s*loan|NBFC|microfinance|credit\s*score)\b/i, weight: 5 },
  { category: 'FinTech', subCategory: 'General', keywords: /\b(?:fintech|fin-?tech|financial\s*(?:tech|services?|platform)|money\s*management|budgeting|expense\s*track)\b/i, weight: 4 },

  // 4.3 Health & Wellness Services
  { category: 'Health & Wellness Services', subCategory: 'Telemedicine', keywords: /\b(?:telemedicine|virtual\s*doctor|online\s*(?:doctor|consultation|prescription)|telehealth|tele-?consult)\b/i, weight: 7 },
  { category: 'Health & Wellness Services', subCategory: 'Mental Health', keywords: /\b(?:therapy|therapist|counseling|counselor|mental\s*health|psycholog|anxiety|depression|talkspace|betterhelp)\b/i, weight: 6 },
  { category: 'Health & Wellness Services', subCategory: 'Fitness App', keywords: /\b(?:workout\s*app|fitness\s*app|yoga\s*app|meditation\s*app|exercise\s*program|personal\s*trainer\s*app)\b/i, weight: 6 },

  // 4.4 Telecom
  { category: 'Telecom', subCategory: 'Mobile Plans', keywords: /\b(?:mobile\s*plan|prepaid|postpaid|SIM|data\s*plan|unlimited\s*calls?|recharge|MVNO|5G\s*plan|broadband)\b/i, weight: 6 },

  // 4.5 Media & Entertainment (Streaming/OTT)
  { category: 'Media & Entertainment', subCategory: 'Video Streaming', keywords: /\b(?:streaming|OTT|movies?|TV\s*shows?|web\s*series|original\s*series|watch\s*online|binge|netflix|hotstar|prime\s*video)\b/i, weight: 5 },
  { category: 'Media & Entertainment', subCategory: 'Music Streaming', keywords: /\b(?:music\s*streaming|podcast|radio|audiobook|listen|playlist|spotify|apple\s*music|audio\s*stream)\b/i, weight: 5 },
  { category: 'Media & Entertainment', subCategory: 'General', keywords: /\b(?:entertainment|media|content\s*platform|digital\s*content|creator|influencer)\b/i, weight: 2 },

  // 4.7 Gaming
  { category: 'Gaming & Esports', subCategory: 'Game Streaming', keywords: /\b(?:cloud\s*gaming|game\s*stream|game\s*pass|game\s*subscription)\b/i, weight: 6 },
  { category: 'Gaming & Esports', subCategory: 'Mobile Gaming', keywords: /\b(?:mobile\s*game|play\s*game|game\s*app|casual\s*game|puzzle\s*game)\b/i, weight: 5 },
  { category: 'Gaming & Esports', subCategory: 'Esports', keywords: /\b(?:esports?|e-?sports?|competitive\s*gaming|tournament|pro\s*gaming)\b/i, weight: 6 },
  { category: 'Gaming & Esports', subCategory: 'General', keywords: /\b(?:gaming|gamer|game\s*studio|video\s*game)\b/i, weight: 3 },

  // 4.8 News & Media
  { category: 'News & Media', subCategory: 'Digital News', keywords: /\b(?:news|newspaper|magazine|newsletter|journalism|editorial|press|breaking\s*news|headlines?|current\s*affairs)\b/i, weight: 4 },

  // 4.9 Insurance
  { category: 'Insurance', subCategory: 'General', keywords: /\b(?:insurance|insur-?tech|health\s*insurance|life\s*insurance|auto\s*insurance|term\s*plan|premium|coverage|claim|policy\s*buy)\b/i, weight: 6 },

  // 4.10 Travel & Ticketing
  { category: 'Travel & Ticketing', subCategory: 'Travel Booking', keywords: /\b(?:travel|flights?|hotels?|booking|vacation|holiday|trip|resort|airfare|cruise|hostel|homestay)\b/i, weight: 5 },
  { category: 'Travel & Ticketing', subCategory: 'Event Ticketing', keywords: /\b(?:tickets?|concerts?|events?|shows?|theater|stadium|book\s*tickets?|ticketing)\b/i, weight: 4 },

  // 4.11 Food Delivery
  { category: 'Food Delivery', subCategory: 'Meal Delivery', keywords: /\b(?:food\s*delivery|meal\s*(?:kit|delivery)|cloud\s*kitchen|order\s*food|deliver\s*food|tiffin|dabbawala|home\s*cook|fresh\s*meal)\b/i, weight: 6 },

  // 4.12 Transportation
  { category: 'Transportation & Mobility', subCategory: 'Ride Sharing', keywords: /\b(?:ride|cab|taxi|car\s*rental|bike\s*sharing|scooter\s*sharing|EV\s*charging|ride.?share|carpool)\b/i, weight: 5 },

  // ── Additional valid D2C categories ──────────────────────────────────

  { category: 'Ecommerce/Retail', subCategory: 'Marketplace', keywords: /\b(?:marketplace|buy\s*online|shop\s*online|online\s*store|online\s*shop|e-?store|web\s*store|shop\s*now|add\s*to\s*cart|free\s*shipping|cash\s*on\s*delivery|COD)\b/i, weight: 3 },
  { category: 'Grocery & Supermarket', subCategory: 'General', keywords: /\b(?:grocery|supermarket|kirana|daily\s*essentials|staples|quick\s*commerce|q-?commerce|instant\s*delivery|10.?minute\s*delivery|pantry)\b/i, weight: 6 },
  { category: 'Restaurant & Hospitality', subCategory: 'General', keywords: /\b(?:restaurant|cafe|bistro|dining|dine.?in|menu|reservat|table\s*booking|bar\s*&\s*grill|QSR|fast\s*food)\b/i, weight: 5 },
  { category: 'Salon & Spa', subCategory: 'General', keywords: /\b(?:salon|spa|parlour|parlor|beauty\s*salon|hair\s*salon|nail\s*salon|massage|facial|waxing|threading)\b/i, weight: 6 },
  { category: 'Fitness & Gym', subCategory: 'General', keywords: /\b(?:gym|fitness|crossfit|pilates|yoga\s*studio|fitness\s*center|workout\s*studio|boxing|martial\s*arts|personal\s*train)\b/i, weight: 5 },
  { category: 'Betting & Fantasy Sports', subCategory: 'General', keywords: /\b(?:fantasy|betting|bet|casino|lottery|prediction|odds|wager|sportsbook|rummy|poker)\b/i, weight: 6 },
  { category: 'Dating & Matchmaking', subCategory: 'General', keywords: /\b(?:dating|matchmak|singles?|meet\s*people|swipe|relationship|matrimon|shaadi|jeevansathi|love|companionship)\b/i, weight: 6 },
  { category: 'Social Media & Platforms', subCategory: 'Social Network', keywords: /\b(?:social\s*(?:network|media|platform|club|community)|connect\s*(?:with\s*(?:people|friends)|from\s*anywhere)|community\s*(?:app|platform)|gen.?z|social\s*app|club|hang\s*out|vibe|local\s*friend|meet\s*(?:new\s*)?people|make\s*friends|connect\s*anywhere|world\s*community)\b/i, weight: 5 },
  { category: 'Rental & Subscription Services', subCategory: 'General', keywords: /\b(?:rent(?:al)?|subscribe|subscription\s*box|monthly\s*box|lease|membership\s*box)\b/i, weight: 4 },
  { category: 'Pharmacy & Optical', subCategory: 'General', keywords: /\b(?:pharmacy|chemist|medical\s*store|medicine\s*delivery|prescription|OTC|optical|contact\s*lens)\b/i, weight: 6 },
  { category: 'Real Estate', subCategory: 'General', keywords: /\b(?:real\s*estate|property|apartment|flat|house|villa|plot|BHK|sqft|sq\.?\s*ft|builder|developer|housing)\b/i, weight: 5 },
  { category: 'Automotive', subCategory: 'General', keywords: /\b(?:car|automobile|vehicle|EV|electric\s*vehicle|bike|scooter|motor|auto\s*parts|tire|tyre|garage|workshop)\b/i, weight: 4 },

  // FMCG — general consumer goods
  { category: 'FMCG', subCategory: 'General', keywords: /\b(?:FMCG|consumer\s*goods|daily\s*use|household\s*product|cleaning\s*product|detergent|tissue|toothpaste|soap|shampoo)\b.*\b(?:brand|products?|shop|buy|range|portfolio)\b/i, weight: 5 },
];

// ── Tech stack → category inference ───────────────────────────────────────

const TECH_TO_CATEGORY = {
  'Shopify': { category: 'Ecommerce/Retail', confidence: 'medium' },
  'WooCommerce': { category: 'Ecommerce/Retail', confidence: 'medium' },
  'Magento': { category: 'Ecommerce/Retail', confidence: 'medium' },
  'BigCommerce': { category: 'Ecommerce/Retail', confidence: 'medium' },
  'PrestaShop': { category: 'Ecommerce/Retail', confidence: 'medium' },
  'OpenCart': { category: 'Ecommerce/Retail', confidence: 'medium' },
  'Wix Stores': { category: 'Ecommerce/Retail', confidence: 'medium' },
  'Squarespace Commerce': { category: 'Ecommerce/Retail', confidence: 'medium' },
};

// ── Domain name → category hints ──────────────────────────────────────────

const DOMAIN_HINTS = [
  { re: /\b(?:jewel|gems?|gold|silver|diamond)\b/i, category: 'Jewelry' },
  { re: /\b(?:beauty|skin|glow|cosmetic|makeup)\b/i, category: 'Beauty & Personal Care' },
  { re: /\b(?:fashion|wear|cloth|style|outfit|apparel)\b/i, category: 'Fashion & Apparel' },
  { re: /\b(?:food|eat|cook|kitchen|meal|snack|bake)\b/i, category: 'Food & Beverage' },
  { re: /\b(?:health|wellness|fit|gym|yoga)\b/i, category: 'Health & Wellness' },
  { re: /\b(?:pet|paw|dog|cat|furr)\b/i, category: 'Pet Products' },
  { re: /\b(?:baby|kid|child|toddler|mom|mum)\b/i, category: 'Baby & Kids' },
  { re: /\b(?:home|decor|living|furniture|mattress)\b/i, category: 'Home & Living' },
  { re: /\b(?:tech|gadget|electronic|phone|audio)\b/i, category: 'Electronics & Tech' },
  { re: /\b(?:game|gaming|esport|play)\b/i, category: 'Gaming & Esports' },
  { re: /\b(?:travel|trip|hotel|booking|tour)\b/i, category: 'Travel & Ticketing' },
  { re: /\b(?:learn|edu|academy|school|course|study)\b/i, category: 'EdTech' },
  { re: /\b(?:pay|money|finance|loan|credit|bank)\b/i, category: 'FinTech' },
  { re: /\b(?:date|match|love|single|relation)\b/i, category: 'Dating & Matchmaking' },
  { re: /\b(?:social|club|community|connect|chat)\b/i, category: 'Social Media & Platforms' },
];

// ── Main classification function ──────────────────────────────────────────

function classifyDomain(domain, meta, techStack) {
  const scores = {};

  // 1. Score from homepage meta tags (highest priority)
  if (meta && meta.combined) {
    for (const rule of CLASSIFICATION_RULES) {
      if (rule.keywords.test(meta.combined)) {
        const key = `${rule.category}|${rule.subCategory}`;
        scores[key] = (scores[key] || 0) + rule.weight;
      }
    }
  }

  // 2. Score from domain name (lower priority)
  const domainName = domain.replace(/\.[^.]+$/, '').replace(/[-_.]/g, ' ');
  for (const hint of DOMAIN_HINTS) {
    if (hint.re.test(domainName)) {
      const key = `${hint.category}|General`;
      scores[key] = (scores[key] || 0) + 2;
    }
  }

  // 3. Score from tech stack
  if (techStack && Array.isArray(techStack)) {
    for (const tech of techStack) {
      const hint = TECH_TO_CATEGORY[tech];
      if (hint) {
        const key = `${hint.category}|General`;
        scores[key] = (scores[key] || 0) + 3;
      }
    }
  }

  // Find best match
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const [bestKey, bestScore] = sorted[0];
  const [category, subCategory] = bestKey.split('|');
  const secondScore = sorted.length > 1 ? sorted[1][1] : 0;
  const gap = bestScore / (secondScore || 1);

  // Determine confidence
  let confidence;
  if (bestScore >= 12 && gap >= 1.5) confidence = 'high';
  else if (bestScore >= 6 && gap >= 1.3) confidence = 'medium';
  else if (bestScore >= 4) confidence = 'medium';
  else confidence = 'low';

  return { category, subCategory, confidence, score: bestScore, gap: Math.round(gap * 10) / 10 };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`\n[reclassify] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);
  console.log(`[reclassify] No API keys needed — HTTP meta fetch + regex\n`);

  const db = await getDb();
  const col = db.collection('company_meta');

  // Build query for domains to reclassify
  let query;
  if (SINGLE_DOMAIN) {
    query = { normalizedDomain: SINGLE_DOMAIN };
  } else {
    const conditions = [
      { categoryConfidence: 'low' },
      { categoryConfidence: { $exists: false } },
      { category: { $in: [null, '', 'Unknown', 'Not Required'] } },
    ];
    if (INCLUDE_MEDIUM) conditions.push({ categoryConfidence: 'medium' });
    query = { $or: conditions };
  }

  const totalToProcess = await col.countDocuments(query);
  console.log(`[reclassify] Found ${totalToProcess} domains to reclassify`);

  let domains = await col.find(query)
    .sort({ updatedAt: -1 }) // most recently scanned first
    .project({ normalizedDomain: 1, category: 1, subCategory: 1, categoryConfidence: 1, techStack: 1, monthlyVisits: 1 })
    .toArray();

  if (LIMIT > 0) {
    domains = domains.slice(0, LIMIT);
    console.log(`[reclassify] Limited to ${LIMIT} domains`);
  }

  console.log(`[reclassify] Processing ${domains.length} domains...\n`);

  let fetched = 0;
  let fetchFailed = 0;
  let reclassified = 0;
  let unchanged = 0;
  let improved = 0;
  const changes = [];

  for (let i = 0; i < domains.length; i++) {
    const doc = domains[i];
    const domain = doc.normalizedDomain;
    const pct = ((i / domains.length) * 100).toFixed(0);
    process.stdout.write(`\r  [${pct}%] ${i + 1}/${domains.length} — ${domain.padEnd(35)} `);

    // Fetch homepage meta (with hard timeout)
    let meta = null;
    try {
      meta = await Promise.race([
        fetchHomepageMeta(domain),
        sleep(6000).then(() => null), // hard 6s cutoff
      ]);
    } catch {}
    if (meta) fetched++;
    else fetchFailed++;

    // Classify
    const result = classifyDomain(domain, meta, doc.techStack);

    if (!result) {
      unchanged++;
      continue;
    }

    const oldCat = doc.category || 'Unknown';
    const newCat = result.category;
    const oldSub = doc.subCategory || '';
    const newSub = result.subCategory;
    const oldConf = doc.categoryConfidence || 'none';
    const newConf = result.confidence;

    // Update if: better confidence, OR same confidence but different (potentially better) category
    const confidenceRank = { high: 3, medium: 2, low: 1, none: 0 };
    const isImproved = confidenceRank[newConf] > confidenceRank[oldConf]
      || (newCat !== oldCat && confidenceRank[newConf] >= confidenceRank[oldConf] && result.score >= 4);

    if (!isImproved) {
      unchanged++;
      continue;
    }

    reclassified++;
    if (newCat !== oldCat) improved++;

    if (VERBOSE || DRY_RUN) {
      if (newCat !== oldCat) {
        console.log(`\n  CHANGED: ${domain}`);
        console.log(`    ${oldCat}/${oldSub} (${oldConf}) → ${newCat}/${newSub} (${newConf}) [score: ${result.score}, gap: ${result.gap}]`);
      }
    }

    changes.push({
      domain,
      oldCategory: oldCat,
      oldSubCategory: oldSub,
      oldConfidence: oldConf,
      newCategory: newCat,
      newSubCategory: newSub,
      newConfidence: newConf,
      score: result.score,
    });

    if (!DRY_RUN) {
      await col.updateOne(
        { normalizedDomain: domain },
        {
          $set: {
            category: newCat,
            subCategory: newSub,
            categoryConfidence: newConf,
            reclassifiedAt: new Date(),
            reclassifiedFrom: oldCat,
          },
        }
      );
    }

    // Small delay to avoid hammering servers
    await sleep(200);

    // Save progress periodically
    if (i % 50 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        status: 'running',
        processed: i + 1,
        total: domains.length,
        fetched, fetchFailed, reclassified, improved, unchanged,
      }, null, 2));
    }
  }

  // Save changes to CSV
  const outFile = path.resolve(__dirname, 'reclassified-domains.csv');
  const csvLines = ['domain,oldCategory,oldSubCategory,oldConfidence,newCategory,newSubCategory,newConfidence,score'];
  for (const c of changes) {
    csvLines.push(`${c.domain},${c.oldCategory},${c.oldSubCategory},${c.oldConfidence},${c.newCategory},${c.newSubCategory},${c.newConfidence},${c.score}`);
  }
  fs.writeFileSync(outFile, csvLines.join('\n'), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`  RECLASSIFICATION REPORT${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`\n  Processed:           ${domains.length}`);
  console.log(`  Pages fetched:       ${fetched}`);
  console.log(`  Fetch failed:        ${fetchFailed}`);
  console.log(`  Reclassified:        ${reclassified}`);
  console.log(`  Category changed:    ${improved}`);
  console.log(`  Unchanged:           ${unchanged}`);
  console.log(`  Time:                ${elapsed}s`);
  console.log(`\n  Changes saved to:    ${outFile}`);
  console.log(`${'═'.repeat(60)}\n`);

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    status: 'completed',
    lastRunDate: new Date().toISOString(),
    processed: domains.length,
    fetched, fetchFailed, reclassified, improved, unchanged,
    elapsedSeconds: parseFloat(elapsed),
  }, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error('[reclassify] Fatal error:', err);
  process.exit(1);
});
