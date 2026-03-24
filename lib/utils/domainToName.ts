/**
 * Convert a domain name to a human-readable brand name.
 * Handles camelCase, common word boundaries, hyphens, and known patterns.
 *
 * Examples:
 *   joymolcouture.in → Joymol Couture
 *   boat-lifestyle.com → Boat Lifestyle
 *   mamaearth.in → Mamaearth
 *   sugarcosmetics.com → Sugar Cosmetics
 *   bigbasket.com → Big Basket
 *   urbancompany.com → Urban Company
 */

// Common English words that should be split from compound domain names
const COMMON_WORDS = new Set([
  'shop', 'store', 'mart', 'buy', 'sell', 'deal', 'deals', 'hub', 'club', 'box',
  'lab', 'labs', 'studio', 'studios', 'house', 'home', 'homes', 'world', 'zone',
  'tech', 'digital', 'online', 'global', 'india', 'express', 'direct', 'market',
  'fashion', 'style', 'styles', 'wear', 'wears', 'clothing', 'apparel', 'couture',
  'beauty', 'skin', 'care', 'hair', 'health', 'wellness', 'fit', 'fitness',
  'food', 'foods', 'kitchen', 'cafe', 'coffee', 'tea', 'organic', 'fresh', 'farm',
  'baby', 'kids', 'pet', 'pets', 'life', 'lifestyle', 'living', 'decor',
  'gold', 'silver', 'jewel', 'jewels', 'gems', 'diamond', 'art', 'arts', 'craft',
  'auto', 'car', 'cars', 'bike', 'bikes', 'ride', 'travel', 'tours', 'trip',
  'pay', 'money', 'cash', 'fin', 'finance', 'capital', 'bank', 'fund', 'invest',
  'learn', 'edu', 'academy', 'school', 'class', 'course', 'skills',
  'game', 'games', 'play', 'sport', 'sports',
  'media', 'news', 'daily', 'times', 'post', 'press',
  'net', 'web', 'app', 'soft', 'cloud', 'data', 'code',
  'smart', 'fast', 'easy', 'quick', 'super', 'mega', 'mini', 'micro',
  'big', 'little', 'new', 'old', 'first', 'best', 'top', 'pro',
  'blue', 'green', 'red', 'black', 'white', 'pink', 'purple',
  'star', 'sun', 'moon', 'sky', 'sea', 'ocean', 'river', 'fire', 'ice',
  'urban', 'rural', 'city', 'town', 'village', 'street',
  'royal', 'king', 'queen', 'prince',
  'company', 'group', 'brand', 'brands', 'works', 'space',
  'basket', 'cart', 'bag', 'bags', 'trunk', 'rack', 'shelf',
  'earth', 'nature', 'eco', 'pure', 'natural', 'clean', 'clear',
  // Additional common suffixes/prefixes
  'sugar', 'honey', 'pepper', 'spice', 'lime', 'mint', 'berry',
  'lens', 'kart', 'fry', 'fries', 'shoes', 'shoe', 'sole',
  'discover', 'explore', 'find', 'seek', 'look', 'view',
  'campus', 'pilgrim', 'madras', 'mumbai', 'delhi', 'bangalore',
  'cosmetics', 'makeup', 'glow', 'bright', 'light', 'dark',
  'heal', 'cure', 'med', 'medi', 'dent', 'dental',
  'cry', 'joy', 'love', 'happy', 'bliss',
  'stone', 'rock', 'gem', 'pearl', 'jade',
  'clue', 'clues', 'key', 'keys', 'lock', 'pass',
  'biryan', 'biryani', 'pizza', 'chai', 'dosa', 'roti',
  'tale', 'tales', 'story', 'book', 'books', 'page',
  'eye', 'eyes', 'face', 'body', 'hand', 'head', 'foot',
  'tree', 'leaf', 'flower', 'bloom', 'garden', 'seed',
  'wool', 'silk', 'cotton', 'linen', 'denim', 'leather',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'nest', 'den', 'lair', 'cove', 'haven', 'nook',
  'way', 'path', 'road', 'lane', 'bridge', 'gate',
  'snap', 'click', 'tap', 'swipe', 'scan', 'track',
  'grow', 'rise', 'leap', 'fly', 'soar', 'flow',
  'edge', 'peak', 'core', 'base', 'root', 'node',
  'ware', 'wares', 'goods', 'things', 'items', 'stuff',
]);

// Domains that should NOT be split (keep as-is, just capitalize)
const NO_SPLIT = new Set([
  'nykaa', 'myntra', 'meesho', 'zepto', 'swiggy', 'zomato', 'flipkart',
  'snapdeal', 'paytm', 'razorpay', 'phonepe', 'groww', 'cred',
  'pepperfry', 'lenskart', 'bewakoof', 'ajio', 'myntra', 'spotify',
  'netflix', 'amazon', 'google', 'facebook', 'instagram', 'twitter',
  'youtube', 'linkedin', 'pinterest', 'reddit', 'whatsapp', 'telegram',
  'uber', 'ola', 'dunzo', 'blinkit', 'instamart', 'jiomart',
  'mamaearth', 'mokobara', 'bonkers',
]);

export function domainToName(domain: string): string {
  // Strip www, TLD
  const base = domain
    .replace(/^www\d*\./, '')
    .replace(/\.(com|in|co|io|net|org|co\.in|com\.au|co\.uk|ai|shop|store|xyz|app|dev|tech)$/i, '')
    .replace(/\.(com|in|co|io|net|org)$/i, ''); // double strip for .co.in etc

  // If it has hyphens or underscores, split on those
  if (base.includes('-') || base.includes('_')) {
    return base
      .split(/[-_]/)
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const lower = base.toLowerCase();

  // If it's a known no-split brand, just capitalize
  if (NO_SPLIT.has(lower)) {
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  // If it's short (≤6 chars), don't try to split — probably a brand name
  if (base.length <= 6) {
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  // Try to split compound words using the dictionary
  const words = splitCompoundWord(lower);

  // If split produced a single word or a very short fragment (<3), don't split
  if (words.length === 1 || words.some(w => w.length < 3)) {
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function splitCompoundWord(word: string): string[] {
  if (word.length <= 3) return [word];

  // Try splitting at every position and check if both parts are known words
  const results: string[][] = [];

  for (let i = 2; i < word.length - 1; i++) {
    const left = word.slice(0, i);
    const right = word.slice(i);

    if (COMMON_WORDS.has(left) && COMMON_WORDS.has(right)) {
      results.push([left, right]);
    }

    // Try 3-way split
    if (COMMON_WORDS.has(left)) {
      for (let j = i + 2; j < word.length - 1; j++) {
        const mid = word.slice(i, j);
        const rest = word.slice(j);
        if (COMMON_WORDS.has(mid) && COMMON_WORDS.has(rest)) {
          results.push([left, mid, rest]);
        }
      }
    }

    // Check if right part is a known word and left is a brand name (not in dict)
    if (COMMON_WORDS.has(right) && left.length >= 3) {
      results.push([left, right]);
    }

    // Check if left part is a known word and right is a brand name
    if (COMMON_WORDS.has(left) && right.length >= 3) {
      results.push([left, right]);
    }
  }

  if (results.length === 0) return [word];

  // Pick the best split — prefer splits where both parts are known, or longest known word
  const scored = results.map(parts => {
    const knownCount = parts.filter(p => COMMON_WORDS.has(p)).length;
    const minLen = Math.min(...parts.map(p => p.length));
    return { parts, score: knownCount * 10 + minLen };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].parts;
}

export default domainToName;
