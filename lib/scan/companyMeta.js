const { getDb } = require('./db');

const JSONLD_TYPE_TO_INDUSTRY = {
  clothingstore:   'Fashion & Apparel',
  shoestore:       'Footwear',
  jewelrystore:    'Jewelry',
  beautystore:     'Beauty & Personal Care',
  beautysalon:     'Beauty & Personal Care',
  cosmeticsstore:  'Beauty & Personal Care',
  restaurant:      'Food & Beverage',
  cafe:            'Food & Beverage',
  bakery:          'Food & Beverage',
  barorgrill:      'Food & Beverage',
  foodestablishment: 'Food & Beverage',
  grocerystore:    'Food & Beverage',
  electronicsstore:'Electronics & Tech',
  computerstore:   'Electronics & Tech',
  mobilephone:     'Electronics & Tech',
  furniturestore:  'Home & Living',
  homedecorstore:  'Home & Living',
  hardwarestore:   'Home & Living',
  sportinggoods:   'Outdoor & Recreation',
  sportsgoodsstore:'Outdoor & Recreation',
  toystore:        'Baby & Kids',
  petstore:        'Pet Products',
  pharmacy:        'Health & Wellness Services',
  medicalclinic:   'Health & Wellness Services',
  hospital:        'Health & Wellness Services',
  dentist:         'Health & Wellness Services',
  physician:       'Health & Wellness Services',
  educationalorganization: 'EdTech',
  school:          'EdTech',
  university:      'EdTech',
  financialservice:'FinTech',
  bankorcreditunion:'FinTech',
  insuranceagency: 'Insurance',
  travelagency:    'Travel & Ticketing',
  hotel:           'Travel & Ticketing',
  airline:         'Travel & Ticketing',
  lodgingbusiness: 'Travel & Ticketing',
  realestateagent: 'Ecommerce/Retail',
  autodealer:      'Ecommerce/Retail',
  autorepair:      'Ecommerce/Retail',
  fitnessclub:     'Health & Wellness',
  gym:             'Health & Wellness',
  healthclub:      'Health & Wellness',
  softwareapplication: 'Ecommerce/Retail',
  webpage:         'News & Media',
  newsarticle:     'News & Media',
  blog:            'News & Media',
  store:           'Ecommerce/Retail',
  onlinestore:     'Ecommerce/Retail',
  product:         'Ecommerce/Retail',
};

// Generic JSON-LD types that should NOT override keyword-based category detection
const GENERIC_JSONLD_TYPES = new Set(['store', 'onlinestore', 'product', 'webpage', 'website']);

function extractJsonLd(html) {
  const results = { category: null, genericCategory: null, region: null, storeHint: 0 };
  const rx = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;

  while ((m = rx.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const type = (item['@type'] || '').toString().toLowerCase().replace(/\s+/g, '');
        if (JSONLD_TYPE_TO_INDUSTRY[type]) {
          if (GENERIC_JSONLD_TYPES.has(type)) {
            if (!results.genericCategory) results.genericCategory = JSONLD_TYPE_TO_INDUSTRY[type];
          } else {
            if (!results.category) results.category = JSONLD_TYPE_TO_INDUSTRY[type];
          }
        }

        const addr = item.address || item.location?.address;
        if (addr) {
          const addresses = Array.isArray(addr) ? addr : [addr];
          for (const a of addresses) {
            if (a.addressCountry && !results.region) {
              results.region = normalizeCountry(a.addressCountry);
            }
          }
          if (Array.isArray(addr) && addr.length > 1) {
            results.storeHint = Math.max(results.storeHint, addr.length);
          }
        }

        if (Array.isArray(item.location) && item.location.length > 1) {
          results.storeHint = Math.max(results.storeHint, item.location.length);
        }
      }
    } catch {}
  }

  return results;
}

function extractFromMeta(html, metaMap) {
  const results = { category: null, region: null };

  const ogLocale = extractOgContent(html, 'og:locale')
    || metaMap['og:locale'] || '';
  if (ogLocale) {
    const locale = ogLocale.toLowerCase();
    if (locale.includes('_in') || locale === 'hi' || locale === 'hi_in') results.region = 'India';
    else if (locale.includes('_gb') || locale.includes('_uk')) results.region = 'UK';
    else if (locale.includes('_de') && !locale.startsWith('en')) results.region = 'Germany';
    else if (locale.includes('_fr') && !locale.startsWith('en')) results.region = 'France';
    else if (locale.includes('_au')) results.region = 'Australia';
    else if (locale.includes('_jp')) results.region = 'Japan';
    else if (locale.includes('_cn') || locale.includes('_zh')) results.region = 'China';
    else if (locale.includes('_br')) results.region = 'Brazil';
    else if (locale.includes('_ae')) results.region = 'UAE';
    else if (locale.includes('_sa')) results.region = 'Saudi Arabia';
    else if (locale.includes('_sg')) results.region = 'Singapore';
  }

  const ogType = extractOgContent(html, 'og:type') || '';
  if (ogType.toLowerCase() === 'product') results.category = 'Ecommerce/Retail';

  const geoRegion = metaMap['geo.region'] || '';
  if (geoRegion && !results.region) {
    results.region = normalizeCountryCode(geoRegion.split('-')[0]);
  }

  return results;
}

function extractOgContent(html, property) {
  const rx = new RegExp(`<meta[^>]+property=["']${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = rx.exec(html);
  if (m) return m[1];
  const rx2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
  const m2 = rx2.exec(html);
  return m2 ? m2[1] : null;
}

const INDUSTRY_KEYWORDS = {
  // Level 2: Product Categories
  'Fashion & Apparel': ['fashion', 'clothing', 'apparel', 'outfit', 'garment', 'kurta', 'ethnic wear', 'wardrobe', 't-shirt', 'tshirt', 'jeans', 'trouser', 'hoodie', 'jacket', 'designer t-shirt', 'jogger', 'sweatshirt', 'blazer', 'menswear', 'womenswear', 'blouse', 'sweater', 'cardigan', 'skirt', 'legging', 'activewear', 'loungewear', 'sleepwear', 'pajama', 'swimwear', 'bikini', 'underwear', 'lingerie', 'shapewear', 'bra'],
  'Footwear':          ['shoe', 'shoes', 'footwear', 'sneaker', 'sneakers', 'sandal', 'sandals', 'slipper', 'slippers', 'heel', 'heels', 'boot', 'boots', 'loafer', 'loafers', 'moccasin', 'flip flop', 'flip flops', 'stiletto', 'wedge', 'platform shoe', 'oxford shoe', 'brogue', 'espadrille', 'clog', 'mule', 'pumps', 'flats', 'running shoes', 'athletic shoes', 'dress shoes'],
  'Fashion Accessories': ['handbag', 'backpack', 'tote bag', 'crossbody', 'clutch', 'duffel bag', 'luggage', 'watch', 'watches', 'smartwatch', 'analog watch', 'sunglasses', 'eyewear', 'eyeglasses', 'spectacles', 'optical', 'contact lens', 'blue light glasses', 'belt', 'suspender', 'hat', 'cap', 'beanie', 'fedora', 'bucket hat', 'scarf', 'bandana', 'glove', 'mitten', 'hair accessories', 'scrunchie', 'headband', 'phone case', 'wallet', 'cardholder', 'socks', 'hosiery'],
  'Jewelry':           ['jewellery', 'jewelry', 'diamond', 'gold jewel', 'necklace', 'bracelet', 'silver jewel', 'pendant', 'earring', 'gold chain', 'mangalsutra', 'karat', 'ring', 'anklet', 'bangle', 'cuff', 'stud', 'hoop', 'fine jewelry', 'costume jewelry', 'engagement ring', 'wedding band', 'birthstone', 'charm', 'sterling silver', 'platinum', 'solitaire', 'gemstone'],
  'Beauty & Personal Care': ['beauty', 'skincare', 'skin care', 'cosmetic', 'makeup', 'hair care', 'fragrance', 'perfume', 'face wash', 'shampoo', 'conditioner', 'moisturizer', 'sunscreen', 'foundation', 'mascara', 'lipstick', 'body lotion', 'face serum', 'face cream', 'cleanser', 'toner', 'exfoliant', 'eyeshadow', 'blush', 'bronzer', 'concealer', 'cologne', 'body spray', 'beard oil', 'shaving cream', 'aftershave', 'body wash', 'soap', 'bath bomb', 'deodorant', 'nail polish', 'cruelty-free', 'clean beauty', 'vegan beauty'],
  'Food & Beverage':   ['food delivery', 'beverage', 'restaurant', 'cafe', 'coffee shop', 'snack', 'chocolate', 'bakery', 'meal kit', 'dining', 'cuisine', 'food menu', 'grocery', 'supermarket', 'protein bar', 'jerky', 'coffee beans', 'tea', 'matcha', 'wine', 'beer', 'spirits', 'cocktail', 'supplement', 'vitamins', 'protein powder', 'collagen', 'probiotics', 'organic food', 'vegan food', 'gluten-free', 'keto', 'kombucha', 'energy drink', 'sparkling water', 'condiment', 'spices', 'sauce', 'nut butter', 'nutrition facts', 'non-gmo'],
  'Home & Living':     ['furniture', 'home decor', 'interior design', 'mattress', 'bedding', 'home furnishing', 'sofa set', 'curtain', 'area rug', 'cushion cover', 'table lamp', 'wall art', 'throw pillow', 'candle', 'mirror', 'vase', 'lighting', 'sheet', 'duvet', 'comforter', 'towel', 'bathrobe', 'cookware', 'dinnerware', 'cutlery', 'small appliance', 'smart home', 'smart speaker', 'thermostat', 'security camera', 'cleaning product', 'detergent', 'weighted blanket', 'sleep trial'],
  'Health & Wellness': ['fitness', 'gym equipment', 'workout', 'yoga mat', 'exercise', 'treadmill', 'dumbbell', 'kettlebell', 'resistance band', 'exercise bike', 'sexual wellness', 'intimacy', 'aromatherapy', 'essential oil', 'meditation', 'self-care', 'blood pressure monitor', 'thermometer', 'first aid', 'compression wear', 'massage tool', 'foam roller', 'recovery', 'wellness product', 'supplement', 'protein powder'],
  'Baby & Kids':       ['kids wear', 'baby care', 'children', 'toys', 'newborn', 'toddler', 'infant', 'baby clothes', 'nursery', 'diaper', 'stroller', 'baby monitor', 'car seat', 'pacifier', 'bottle', 'educational toy', 'puzzle', 'board game', 'action figure', 'doll', 'kids furniture', 'crib', 'toddler bed', 'baby skincare', 'learning kit', 'bpa-free', 'non-toxic', 'choking hazard'],
  'Pet Products':      ['pet food', 'dog food', 'cat food', 'veterinary', 'pet care', 'pet supplies', 'dog treat', 'cat litter', 'pet grooming', 'pet collar', 'leash', 'pet bed', 'pet crate', 'pet toy', 'flea treatment', 'pet dental', 'cat tree', 'scratching post', 'pet clothing', 'vet recommended'],
  'Electronics & Tech': ['electronics', 'gadget', 'smartphone', 'laptop', 'tech accessories', 'earbuds', 'headphone', 'smartwatch', 'charger', 'power bank', 'tablet', 'monitor', 'camera', 'drone', 'fitness tracker', 'smart ring', 'vr headset', 'speaker', 'soundbar', 'microphone', 'gaming console', 'gaming keyboard', 'gaming mouse', 'controller', 'gaming chair', 'webcam', 'bluetooth', 'usb-c', 'wireless'],
  'Outdoor & Recreation': ['camping', 'hiking', 'tent', 'sleeping bag', 'camp stove', 'cooler', 'bicycle', 'skateboard', 'surfboard', 'paddleboard', 'fishing gear', 'golf club', 'grill', 'bbq', 'gardening tool', 'outdoor lighting', 'hammock', 'sports equipment', 'sporting goods', 'sportswear', 'sports wear', 'cricket bat', 'badminton', 'fitness gear', 'sports gear', 'cycling', 'outdoor sports', 'team sports', 'sports store', 'sports shop', 'waterproof', 'weather-resistant'],
  'Office & Stationery': ['stationery', 'notebook', 'ballpoint pen', 'fountain pen', 'diary', 'planner', 'art supplies', 'craft supplies', 'school supplies', 'journal', 'calendar', 'marker', 'highlighter', 'desk organizer', 'file storage', 'desk accessories', 'ergonomic', 'business card', 'stationery set'],
  // Level 3: Service Categories
  'EdTech':            ['education', 'online learning', 'online course', 'university', 'college', 'tuition', 'coaching class', 'edtech', 'classroom', 'curriculum', 'student portal', 'language learning', 'skill development', 'coding bootcamp', 'programming course', 'test prep', 'tutoring', 'learn at your own pace', 'certificate'],
  'FinTech':           ['finance', 'banking', 'investment', 'mutual fund', 'fintech', 'credit card', 'demat', 'stock market', 'trading platform', 'digital wallet', 'p2p payment', 'buy now pay later', 'robo-advisor', 'cryptocurrency', 'credit monitoring', 'budgeting app', 'expense tracking', 'fdic insured', 'apy'],
  'Health & Wellness Services': ['healthcare', 'medical', 'pharma', 'hospital', 'ayurved', 'diagnostic', 'medicine', 'doctor', 'clinic', 'patient', 'prescription', 'telemedicine', 'virtual doctor', 'online prescription', 'therapy app', 'counseling', 'mental health app', 'fitness app', 'workout app', 'yoga app', 'meditation app', 'meal planning', 'calorie tracking', 'hipaa'],
  'Telecom':           ['mobile plan', 'phone plan', 'internet service', 'mvno', '5g service', 'data plan', 'unlimited data', 'coverage map', 'no contract', 'prepaid plan', 'postpaid plan', 'home internet', 'broadband', 'telecom'],
  'Streaming Platform / OTT': ['video streaming', 'streaming service', 'original series', 'live tv', 'sports streaming', 'cable replacement', 'stream movies', 'tv shows', 'original content', 'exclusive shows', 'simultaneous streams', 'download for offline', 'ott platform'],
  'Music & Audio Streaming': ['music streaming', 'podcast platform', 'radio streaming', 'audiobook', 'ad-free listening', 'offline download', 'lossless audio', 'spatial audio', 'millions of songs', 'on-demand music'],
  'Gaming':            ['cloud gaming', 'game streaming', 'game subscription', 'game library', 'game pass', 'mobile gaming', 'day-one release', 'exclusive titles', 'gaming platform'],
  'News & Media':      ['news', 'magazine', 'publishing house', 'editorial', 'journalism', 'newspaper', 'press release', 'media house', 'broadcast', 'news subscription', 'digital magazine', 'newsletter platform', 'premium newsletter', 'e-reading', 'kindle unlimited', 'paywall', 'ad-free reading', 'archive access'],
  'Insurance':         ['insurance', 'health insurance', 'life insurance', 'auto insurance', 'home insurance', 'renters insurance', 'pet insurance', 'travel insurance', 'instant quote', 'get covered', 'coverage amount', 'premium', 'deductible', 'policy'],
  'Travel & Ticketing': ['travel agency', 'travel booking', 'tourism', 'flight booking', 'hotel booking', 'tour package', 'vacation package', 'resort booking', 'airline', 'itinerary', 'flight', 'hotel', 'travel', 'holiday package', 'bus booking', 'train booking', 'cab booking', 'event ticketing', 'concert ticket', 'experience booking', 'vacation rental', 'best price guarantee', 'instant confirmation'],
  'Food Delivery':     ['meal kit delivery', 'prepared meal delivery', 'restaurant delivery', 'grocery delivery', 'recipes per week', 'serving sizes', 'pre-portioned ingredients', 'skip weeks', 'pause subscription', 'free delivery', 'meal subscription'],
  'Transportation Booking': ['ride-sharing', 'car rental', 'car-sharing', 'bike-sharing', 'scooter-sharing', 'ev charging', 'parking subscription', 'ride credits', 'unlimited rides', 'save on every ride', 'priority access'],
  'Ecommerce/Retail':  ['ecommerce', 'e-commerce', 'online store', 'shop online', 'add to cart', 'marketplace', 'online shopping', 'buy online', 'best deals', 'online marketplace', 'multi-brand', 'seller', 'cash on delivery', 'free delivery'],
};

const SUB_INDUSTRY_KEYWORDS = {
  'Fashion & Apparel': {
    'Tops':               ['shirt', 't-shirt', 'tshirt', 'blouse', 'sweater', 'hoodie', 'tank top', 'cardigan'],
    'Bottoms':            ['pants', 'jeans', 'shorts', 'skirt', 'legging', 'trouser'],
    'Dresses & Jumpsuits':['dress', 'jumpsuit', 'gown', 'frock', 'romper'],
    'Outerwear':          ['jacket', 'coat', 'blazer', 'vest', 'parka', 'windbreaker'],
    'Activewear':         ['activewear', 'sportswear', 'athleisure', 'gym wear', 'workout clothes', 'yoga pants', 'sports bra', 'athletic shorts'],
    'Loungewear & Sleepwear': ['loungewear', 'sleepwear', 'pajama', 'robe', 'loungewear set'],
    'Swimwear':           ['swimwear', 'swimsuit', 'bikini', 'board shorts'],
    'Underwear & Intimates': ['underwear', 'bra', 'shapewear', 'lingerie', 'intimates'],
    'Ethnic Wear':        ['ethnic wear', 'ethnic fashion', 'kurta', 'saree', 'lehenga', 'salwar', 'traditional wear', 'traditional clothing'],
    'Streetwear':         ['streetwear', 'street style', 'urban', 'pop culture', 'merchandise', 'merch', 'fandom', 'graphic tee', 'oversized'],
  },
  'Footwear': {
    'Sneakers & Athletic': ['sneaker', 'sneakers', 'trainer', 'trainers', 'running shoe', 'athletic shoe', 'basketball shoe', 'soccer cleat'],
    'Boots':              ['boot', 'boots', 'ankle boot', 'knee-high boot', 'hiking boot', 'work boot', 'chelsea boot', 'combat boot'],
    'Sandals & Slides':   ['sandal', 'slide', 'flip flop', 'kolhapuri'],
    'Heels & Pumps':      ['heel', 'heels', 'stiletto', 'pump', 'kitten heel'],
    'Flats & Loafers':    ['flat', 'loafer', 'moccasin', 'slip on', 'espadrille'],
    'Dress Shoes':        ['dress shoe', 'oxford', 'brogue', 'derby', 'monk strap', 'formal shoe'],
    'Slippers':           ['slipper', 'slippers', 'house shoe', 'clog', 'mule'],
  },
  'Fashion Accessories': {
    'Bags':               ['backpack', 'handbag', 'tote', 'crossbody', 'clutch', 'duffel bag', 'luggage'],
    'Watches':            ['smartwatch', 'analog watch', 'digital watch', 'luxury watch', 'fashion watch', 'sport watch'],
    'Eyewear':            ['prescription glasses', 'sunglasses', 'blue light glasses', 'reading glasses', 'safety eyewear', 'eyeglasses', 'spectacles', 'optical'],
    'Belts & Suspenders': ['belt', 'suspender'],
    'Hats & Caps':        ['baseball cap', 'beanie', 'fedora', 'bucket hat', 'hat', 'cap'],
    'Scarves & Wraps':    ['scarf', 'bandana', 'wrap', 'shawl', 'stole'],
    'Wallets':            ['wallet', 'cardholder', 'card holder', 'money clip'],
    'Phone Cases':        ['phone case', 'mobile cover', 'tech accessories'],
  },
  'Jewelry': {
    'Fine Jewelry':       ['diamond', 'gold jewel', 'platinum', 'solitaire', 'certified diamond', 'hallmark', 'karat', '22k', '18k', '24k', '14k', '10k', 'sterling silver', '.925'],
    'Fashion Jewelry':    ['fashion jewel', 'imitation', 'artificial jewel', 'costume jewel', 'oxidised', 'beaded', 'handmade jewel', 'trendy jewel'],
    'Bridal Jewelry':     ['bridal jewel', 'bridal set', 'wedding jewel', 'mangalsutra', 'bridal collection', 'engagement ring', 'wedding band'],
    'Silver Jewelry':     ['silver jewel', 'sterling silver', '925 silver', 'silver ring', 'silver necklace'],
    'Custom Jewelry':     ['custom jewel', 'personalized jewel', 'engraving', 'custom design', 'monogram'],
  },
  'Beauty & Personal Care': {
    'Skincare':           ['skincare', 'skin care', 'cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'face mask', 'exfoliant', 'face wash', 'face cream', 'face serum'],
    'Makeup':             ['makeup', 'lipstick', 'mascara', 'eyeliner', 'foundation', 'concealer', 'blush', 'eyeshadow', 'bronzer'],
    'Hair Care':          ['hair care', 'shampoo', 'conditioner', 'hair oil', 'hair serum', 'hair mask', 'hair treatment', 'styling product'],
    'Fragrance':          ['fragrance', 'perfume', 'cologne', 'body spray', 'scented oil'],
    'Men\'s Grooming':    ['beard oil', 'shaving cream', 'aftershave', 'men\'s skincare', 'men\'s grooming', 'grooming kit'],
    'Bath & Body':        ['body wash', 'soap', 'bath bomb', 'deodorant', 'body lotion', 'body butter'],
    'Nail Care':          ['nail polish', 'nail treatment', 'manicure', 'nail art'],
  },
  'Food & Beverage': {
    'Snacks':             ['chips', 'crackers', 'nuts', 'trail mix', 'protein bar', 'jerky', 'candy', 'cookies', 'snack'],
    'Meal Kits':          ['meal kit', 'prepared meal', 'ready-to-eat', 'subscription meal'],
    'Coffee & Tea':       ['coffee beans', 'ground coffee', 'coffee pod', 'tea bag', 'loose leaf tea', 'matcha', 'espresso'],
    'Alcohol':            ['wine', 'beer', 'spirits', 'cocktail kit', 'mixer', 'whiskey', 'vodka', 'rum'],
    'Supplements':        ['vitamin', 'protein powder', 'collagen', 'probiotic', 'omega-3', 'supplement'],
    'Specialty Foods':    ['organic', 'vegan', 'keto', 'gluten-free', 'paleo', 'non-gmo', 'specialty food'],
    'Beverages':          ['sparkling water', 'kombucha', 'juice', 'energy drink', 'cold brew'],
  },
  'Home & Living': {
    'Furniture':          ['sofa', 'chair', 'table', 'bed', 'desk', 'cabinet', 'shelf', 'storage', 'bookcase'],
    'Home Decor':         ['wall art', 'throw pillow', 'candle', 'rug', 'mirror', 'vase', 'lighting', 'sculpture'],
    'Bedding & Bath':     ['sheet', 'duvet', 'comforter', 'pillow', 'towel', 'bathrobe', 'bedding', 'thread count'],
    'Mattresses':         ['mattress', 'mattress topper', 'bed frame', 'weighted blanket', 'sleep aid', 'sleep trial', 'firmness'],
    'Kitchen & Dining':   ['cookware', 'dinnerware', 'cutlery', 'small appliance', 'storage container', 'kitchen'],
    'Cleaning':           ['eco-friendly cleaner', 'detergent', 'cleaning tool', 'cleaning product'],
    'Smart Home':         ['smart speaker', 'smart lighting', 'thermostat', 'security camera', 'smart home'],
  },
  'Health & Wellness': {
    'Fitness Equipment':  ['dumbbell', 'kettlebell', 'resistance band', 'yoga mat', 'exercise bike', 'treadmill', 'gym equipment'],
    'Sexual Wellness':    ['contraceptive', 'lubricant', 'intimacy product', 'adult toy', 'sexual wellness'],
    'Mental Health & Self-Care': ['aromatherapy', 'essential oil', 'meditation cushion', 'journal', 'self-care', 'mindfulness'],
    'Medical Devices':    ['blood pressure monitor', 'thermometer', 'first aid kit', 'compression wear', 'medical device'],
    'Recovery':           ['massage tool', 'foam roller', 'recovery equipment', 'ice pack', 'heat pad'],
  },
  'Baby & Kids': {
    'Baby Care':          ['diaper', 'wipe', 'bottle', 'pacifier', 'baby monitor', 'stroller', 'car seat', 'baby care'],
    'Toys & Games':       ['educational toy', 'puzzle', 'board game', 'action figure', 'doll', 'outdoor toy', 'toy'],
    'Kids Furniture':     ['crib', 'toddler bed', 'kids desk', 'toy storage', 'kids furniture'],
    'Baby Skincare':      ['baby skincare', 'baby bath', 'baby lotion', 'baby shampoo'],
    'Learning':           ['learning kit', 'science kit', 'kids book', 'educational'],
  },
  'Pet Products': {
    'Pet Food':           ['dog food', 'cat food', 'pet treat', 'chew', 'specialty diet', 'pet food'],
    'Pet Supplies':       ['collar', 'leash', 'pet bed', 'crate', 'pet toy', 'bowl', 'pet grooming'],
    'Pet Healthcare':     ['flea treatment', 'pet dental', 'pet supplement', 'pet medication'],
    'Pet Furniture':      ['cat tree', 'scratching post', 'pet house'],
  },
  'Electronics & Tech': {
    'Consumer Electronics': ['smartphone', 'tablet', 'laptop', 'monitor', 'camera', 'drone'],
    'Wearables':          ['smartwatch', 'fitness tracker', 'smart ring', 'vr headset', 'wearable'],
    'Audio':              ['headphone', 'earbuds', 'speaker', 'soundbar', 'microphone'],
    'Gaming':             ['gaming console', 'gaming keyboard', 'gaming mouse', 'controller', 'gaming chair'],
    'Tech Accessories':   ['phone case', 'charger', 'cable', 'power bank', 'webcam'],
  },
  'Outdoor & Recreation': {
    'Camping & Hiking':   ['camping', 'hiking', 'tent', 'sleeping bag', 'backpack', 'camp stove', 'cooler', 'trekking'],
    'Sports Equipment':   ['bicycle', 'skateboard', 'surfboard', 'paddleboard', 'fishing gear', 'golf club', 'cricket bat', 'badminton'],
    'Outdoor Gear':       ['grill', 'bbq', 'gardening tool', 'outdoor lighting'],
    'Team Sports':        ['football', 'basketball', 'volleyball', 'hockey', 'rugby', 'soccer'],
    'Water Sports':       ['swimming', 'surfing', 'diving', 'snorkeling', 'kayak'],
  },
  'Office & Stationery': {
    'Notebooks & Planners': ['notebook', 'journal', 'planner', 'calendar', 'diary'],
    'Writing Instruments':  ['pen', 'pencil', 'marker', 'highlighter'],
    'Desk & Organization':  ['desk organizer', 'file storage', 'desk accessories', 'ergonomic'],
    'Art & Craft':          ['art supplies', 'craft materials', 'paint', 'canvas', 'sketch'],
  },
  'EdTech': {
    'Online Courses':     ['online course', 'learning platform', 'video lesson', 'progress tracking', 'certificate'],
    'Language Learning':  ['language learning', 'language app', 'learn language'],
    'Skill Development':  ['skill development', 'upskilling', 'professional development'],
    'K-12 & Test Prep':   ['tutoring', 'test prep', 'sat prep', 'gre prep', 'k-12'],
    'Coding':             ['coding bootcamp', 'programming course', 'learn to code'],
  },
  'FinTech': {
    'Digital Banking':    ['digital bank', 'checking account', 'savings account', 'debit card', 'neobank'],
    'Payments':           ['digital wallet', 'p2p payment', 'buy now pay later', 'upi', 'digital payment'],
    'Investment':         ['investment app', 'robo-advisor', 'cryptocurrency', 'stock trading', 'mutual fund', 'portfolio'],
    'Lending':            ['loan', 'lending', 'emi', 'credit line', 'credit card'],
    'Budgeting':          ['budgeting app', 'expense tracking', 'financial planning'],
  },
  'Health & Wellness Services': {
    'Telemedicine':       ['telemedicine', 'virtual doctor', 'online prescription', 'doctor online', 'online consultation'],
    'Mental Health':      ['therapy app', 'counseling', 'talkspace', 'betterhelp', 'mental health'],
    'Fitness Apps':       ['workout app', 'yoga app', 'meditation app', 'fitness app'],
    'Nutrition':          ['meal planning', 'calorie tracking', 'nutrition app', 'diet plan'],
  },
  'Telecom': {
    'Mobile':             ['mobile plan', 'phone plan', 'prepaid', 'postpaid', 'mvno'],
    'Internet':           ['home internet', 'broadband', 'fiber', '5g service'],
  },
  'Streaming Platform / OTT': {
    'Video Streaming':    ['movie streaming', 'tv show', 'original series', 'video streaming'],
    'Sports Streaming':   ['live sports', 'sports streaming', 'game streaming'],
    'Live TV':            ['live tv', 'cable replacement', 'tv streaming'],
  },
  'Music & Audio Streaming': {
    'Music':              ['music streaming', 'on-demand music', 'playlist'],
    'Podcasts':           ['podcast', 'premium podcast'],
    'Audiobooks':         ['audiobook', 'audio book'],
  },
  'Insurance': {
    'Health Insurance':   ['health insurance', 'medical insurance'],
    'Life Insurance':     ['life insurance', 'term insurance'],
    'Auto Insurance':     ['auto insurance', 'car insurance', 'vehicle insurance'],
    'Home Insurance':     ['home insurance', 'renters insurance', 'homeowners insurance'],
    'Other Insurance':    ['pet insurance', 'travel insurance'],
  },
  'Travel & Ticketing': {
    'Travel Booking':     ['flight booking', 'hotel booking', 'vacation package', 'tour package', 'travel booking'],
    'Event Ticketing':    ['event ticket', 'concert ticket', 'sports ticket', 'theater ticket'],
    'Experiences':        ['tour', 'activity booking', 'experience booking'],
    'Vacation Rentals':   ['vacation rental', 'holiday home', 'short-term rental'],
  },
  'Food Delivery': {
    'Meal Kit':           ['meal kit', 'subscription meal', 'pre-portioned', 'recipe box'],
    'Prepared Meals':     ['prepared meal', 'ready-to-eat', 'fresh meal delivery'],
    'Restaurant Delivery':['restaurant delivery', 'food delivery app'],
    'Grocery Delivery':   ['grocery delivery', 'online grocery', 'fresh delivery'],
  },
  'Transportation Booking': {
    'Ride-Sharing':       ['ride-sharing', 'rideshare', 'taxi app'],
    'Car Rental':         ['car rental', 'car-sharing', 'car subscription'],
    'Micro-Mobility':     ['bike-sharing', 'scooter-sharing', 'electric scooter'],
    'EV Charging':        ['ev charging', 'charging network', 'charging station'],
  },
  'Ecommerce/Retail': {
    'D2C Brand':          ['direct to consumer', 'd2c', 'our brand', 'our story', 'our products'],
    'Marketplace':        ['marketplace', 'seller', 'vendor', 'multi-brand'],
  },
};

function analyzeKeywords(html, url) {
  const results = { category: null, subCategory: null, scores: {} };

  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '';
  const h1s = [];
  const h1Rx = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let h1m;
  while ((h1m = h1Rx.exec(html)) !== null) h1s.push(h1m[1]);
  const metaDesc = (/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html) || [])[1] || '';
  const metaKeywords = (/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i.exec(html) || [])[1]
    || (/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i.exec(html) || [])[1] || '';

  // Extract domain name as a signal (e.g. "mochishoes" from mochishoes.com)
  const domainName = (url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\..*$/, '').toLowerCase();

  let bodyText = '';
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  if (bodyMatch) {
    bodyText = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 5000);
  }

  const altTexts = (html.match(/alt=["']([^"']+)["']/gi) || [])
    .map(a => a.replace(/alt=["']/i, '').replace(/["']$/, '')).join(' ');

  const textParts = [
    { text: domainName, weight: 5 },
    { text: title.toLowerCase(), weight: 4 },
    { text: h1s.join(' ').toLowerCase(), weight: 2 },
    { text: metaDesc.toLowerCase(), weight: 3 },
    { text: metaKeywords.toLowerCase(), weight: 2 },
    { text: bodyText.toLowerCase(), weight: 1 },
    { text: altTexts.toLowerCase(), weight: 1 },
  ];

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    let score = 0;
    for (const part of textParts) {
      let partScore = 0;
      for (const kw of keywords) {
        if (part.text.includes(kw)) {
          partScore += part.weight;
        }
      }
      // Cap low-weight sources (body text, alt text) to avoid product listing spam
      if (part.weight <= 1) partScore = Math.min(partScore, 3);
      score += partScore;
    }
    if (score > 0) results.scores[industry] = score;
  }

  // For tiebreaking: find first mention position in title + description
  const identityText = (title + ' ' + metaDesc).toLowerCase();
  function firstMentionPos(industry) {
    const kws = INDUSTRY_KEYWORDS[industry] || [];
    let earliest = Infinity;
    for (const kw of kws) {
      const pos = identityText.indexOf(kw);
      if (pos !== -1 && pos < earliest) earliest = pos;
    }
    return earliest;
  }

  const sorted = Object.entries(results.scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    // Tiebreaker: whichever industry's keywords appear first in title+desc
    return firstMentionPos(a[0]) - firstMentionPos(b[0]);
  });
  if (sorted.length > 0 && sorted[0][1] >= 2) {
    results.category = sorted[0][0];
  }

  if (results.category && SUB_INDUSTRY_KEYWORDS[results.category]) {
    let bestSub = null;
    let bestScore = 0;
    const subScores = {};
    for (const [sub, kws] of Object.entries(SUB_INDUSTRY_KEYWORDS[results.category])) {
      let sc = 0;
      for (const kw of kws) {
        for (const part of textParts) {
          if (part.text.includes(kw)) sc += part.weight;
        }
      }
      if (sc > 0) subScores[sub] = sc;
      if (sc > bestScore) { bestScore = sc; bestSub = sub; }
    }
    // If multiple subcategories score similarly, the brand is a general store
    const scoredSubs = Object.values(subScores).filter(s => s > 0);
    const secondBest = scoredSubs.sort((a, b) => b - a)[1] || 0;
    if (bestSub && bestScore >= secondBest * 1.5) {
      results.subCategory = bestSub;
    }
    // else leave subCategory as null (will default to 'General')
  }

  return results;
}

function inferFromTech(technologies) {
  const results = { category: null, subCategory: null, region: null };
  const techNamesArr = technologies.map(t => t.name.toLowerCase());
  const techNames = new Set(techNamesArr);
  const techCategories = new Set(technologies.map(t => t.category.toLowerCase()));
  const allTechText = techNamesArr.join(' ');

  const ecomPlatforms = ['shopify', 'woocommerce', 'magento', 'bigcommerce', 'prestashop', 'opencart'];
  const ecomMatches = ecomPlatforms.filter(p => techNames.has(p));

  const indianPayments = ['razorpay', 'payu', 'cashfree', 'juspay', 'phonepe', 'paytm', 'instamojo', 'ccavenue', 'mobikwik', 'snapmint', 'simpl', 'lazypay', 'cred'];
  const globalPayments = ['stripe', 'klarna', 'afterpay', 'affirm', 'apple pay', 'adyen', 'braintree', 'mollie', 'square', 'pine labs'];
  const indianPaymentCount = indianPayments.filter(p => allTechText.includes(p)).length;
  const globalPaymentCount = globalPayments.filter(p => allTechText.includes(p)).length;
  const totalPayments = indianPaymentCount + globalPaymentCount;
  results._indianPaymentCount = indianPaymentCount;
  results._globalPaymentCount = globalPaymentCount;

  if (ecomMatches.length > 0 || techCategories.has('ecommerce')) {
    results.category = 'Ecommerce/Retail';
    results.subCategory = 'D2C Brand';
  }

  if (indianPaymentCount > 0 && globalPaymentCount === 0) {
    results.region = 'India';
  } else if (indianPaymentCount > 0 && indianPaymentCount > globalPaymentCount && totalPayments < 4) {
    results.region = 'India';
  }

  const indianEcom = ['gokwik', 'shiprocket', 'delhivery', 'nimbuspost', 'unicommerce'];
  const indianEcomCount = indianEcom.filter(p => allTechText.includes(p)).length;
  if (indianEcomCount > 0 && globalPaymentCount === 0) {
    results.region = 'India';
    if (!results.category) results.category = 'Ecommerce/Retail';
  }

  if (techNames.has('stripe') && !results.region && globalPaymentCount > indianPaymentCount) {
    results.region = 'US';
  }

  if (techNames.has('ghost') && !results.category) {
    results.category = 'News & Media';
    results.subCategory = 'Blog';
  }

  if (techNames.has('wordpress') && !results.category) {
    results.category = 'News & Media';
  }

  return results;
}

const TLD_TO_REGION = {
  '.in':  'India',
  '.co.in': 'India',
  '.uk':  'UK',
  '.co.uk': 'UK',
  '.au':  'Australia',
  '.com.au': 'Australia',
  '.de':  'Germany',
  '.fr':  'France',
  '.jp':  'Japan',
  '.cn':  'China',
  '.br':  'Brazil',
  '.ca':  'Canada',
  '.it':  'Italy',
  '.es':  'Spain',
  '.nl':  'Netherlands',
  '.se':  'Sweden',
  '.sg':  'Singapore',
  '.ae':  'UAE',
  '.sa':  'Saudi Arabia',
  '.kr':  'South Korea',
  '.nz':  'New Zealand',
  '.za':  'South Africa',
  '.my':  'Malaysia',
  '.id':  'Indonesia',
  '.ph':  'Philippines',
  '.th':  'Thailand',
  '.vn':  'Vietnam',
};

function detectRegion(url, html, metaMap, techRegion, jsonLdRegion, metaRegion, techHints) {
  techHints = techHints || {};
  let isComDomain = false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    isComDomain = hostname.endsWith('.com') || hostname.endsWith('.org') || hostname.endsWith('.io') || hostname.endsWith('.co');
    for (const [tld, region] of Object.entries(TLD_TO_REGION)) {
      if (hostname.endsWith(tld)) return region;
    }
  } catch {}

  if (metaRegion) return metaRegion;

  const htmlLang = (/<html[^>]+lang=["']([^"']+)["']/i.exec(html) || [])[1] || '';
  if (htmlLang && !isComDomain) {
    const lang = htmlLang.toLowerCase();
    if (lang === 'hi' || lang === 'hi-in' || lang.includes('-in')) return 'India';
    if (lang.includes('-gb') || lang.includes('-uk')) return 'UK';
    if (lang.includes('-au')) return 'Australia';
    if (lang.includes('-de') || lang === 'de') return 'Germany';
    if (lang.includes('-fr') || lang === 'fr') return 'France';
    if (lang.includes('-jp') || lang === 'ja') return 'Japan';
    if (lang.includes('-cn') || lang === 'zh') return 'China';
    if (lang.includes('-br') || lang === 'pt-br') return 'Brazil';
  }

  const bodySlice = html.slice(0, 200000);

  const currencySignals = [];
  if (/₹|&#x20B9;|&#8377;/.test(html)) currencySignals.push('INR');
  if (/INR\b/.test(bodySlice) || /Rs\.?\s?\d/.test(bodySlice) || /MRP/.test(bodySlice)) currencySignals.push('INR');
  if (/"(?:currency|priceCurrency)":\s*"INR"/i.test(html)) currencySignals.push('INR');
  if (/"(?:currency|priceCurrency)":\s*"USD"/i.test(html)) currencySignals.push('USD');
  if (/"(?:currency|priceCurrency)":\s*"GBP"/i.test(html)) currencySignals.push('GBP');
  if (/"(?:currency|priceCurrency)":\s*"EUR"/i.test(html)) currencySignals.push('EUR');
  if (/\$\s?\d/.test(bodySlice)) currencySignals.push('USD');
  if (/£\s?\d/.test(bodySlice)) currencySignals.push('GBP');
  if (/€\s?\d/.test(bodySlice)) currencySignals.push('EUR');

  const uniqueCurrencies = [...new Set(currencySignals)];

  if (!isComDomain && uniqueCurrencies.length === 1) {
    if (uniqueCurrencies[0] === 'INR') return 'India';
    if (uniqueCurrencies[0] === 'GBP') return 'UK';
    if (uniqueCurrencies[0] === 'EUR') return 'EU';
    if (uniqueCurrencies[0] === 'USD') return 'US';
  }

  if (isComDomain && uniqueCurrencies.length === 1 && uniqueCurrencies[0] !== 'INR') {
    if (uniqueCurrencies[0] === 'GBP') return 'UK';
    if (uniqueCurrencies[0] === 'EUR') return 'EU';
    if (uniqueCurrencies[0] === 'USD') return 'US';
  }

  if (isComDomain && uniqueCurrencies.includes('INR')) {
    const inrCount = currencySignals.filter(c => c === 'INR').length;
    const otherCount = currencySignals.filter(c => c !== 'INR').length;
    if (inrCount > 0 && otherCount === 0) return 'India';
    if (inrCount >= 2 && inrCount > otherCount) return 'India';
    if (techHints._indianPaymentCount > 0 && techHints._globalPaymentCount === 0) return 'India';
  }

  if (!isComDomain && uniqueCurrencies.length > 1) {
    if (uniqueCurrencies.includes('INR') && !uniqueCurrencies.includes('USD') && !uniqueCurrencies.includes('EUR')) return 'India';
  }

  if (jsonLdRegion) return jsonLdRegion;

  const phoneSignals = [];
  if (/\+91[\s-]?\d/.test(bodySlice)) phoneSignals.push('India');
  if (/\+44[\s-]?\d/.test(bodySlice)) phoneSignals.push('UK');
  if (/\+1[\s-]?\(?\d{3}\)?/.test(bodySlice)) phoneSignals.push('US');
  if (/\+61[\s-]?\d/.test(bodySlice)) phoneSignals.push('Australia');
  if (/\+49[\s-]?\d/.test(bodySlice)) phoneSignals.push('Germany');
  if (/\+971[\s-]?\d/.test(bodySlice)) phoneSignals.push('UAE');

  if (phoneSignals.length === 1) return phoneSignals[0];

  if (techRegion && !isComDomain) return techRegion;

  if (techRegion && isComDomain) {
    const inrPresent = currencySignals.includes('INR');
    const indianPhone = phoneSignals.includes('India');
    if (techRegion === 'India' && (inrPresent || indianPhone)) return 'India';
    if (techRegion === 'India' && techHints._indianPaymentCount > 0 && techHints._globalPaymentCount === 0) return 'India';
    if (techRegion !== 'India') return techRegion;
  }

  return 'Global';
}

const STORE_LOCATOR_PATTERNS = [
  /\/store-?locator/i,
  /\/find-a-store/i,
  /\/find-?store/i,
  /\/store-?finder/i,
  /\/our-stores/i,
  /\/locate-?us/i,
  /\/stores\b/i,
  /\/store-near-?me/i,
  /\/stores?-near-?(?:me|you)/i,
  /\/locations\b/i,
  /\/outlets?\b/i,
  /\/showrooms?\b/i,
  /\/branches?\b/i,
  /\/find-us/i,
  /\/where-to-buy/i,
  /\/visit-us/i,
  /\/dealers?\b/i,
  /\/offline-?\s?stores?/i,
  /\/retail-?\s?stores?/i,
  /\/experience-?\s?(?:centre|center|store)/i,
  /\/pages\/store-locator/i,
  /\/pages\/stores/i,
  /\/pages\/locate/i,
  /\/pages\/find-store/i,
  /\/pages\/our-store/i,
  /\/pages\/boutique/i,
  /\/[a-z0-9]+-stores?\b/i,
];

function countToBand(count) {
  if (count <= 0)   return 'Online only';
  if (count <= 10)  return '1-10';
  if (count <= 50)  return '10-50';
  if (count <= 100) return '50-100';
  if (count <= 500) return '100-500';
  return '500+';
}

async function scrapeStoreLocatorWithBrowser(storeLocatorUrl, browserFetch) {
  let result;
  try {
    result = await Promise.race([
      browserFetch(storeLocatorUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error('browser timeout')), 12000)),
    ]);
  } catch {
    return 0;
  }

  const storeHtml = result.html || '';
  if (!storeHtml || storeHtml.length < 500) return 0;

  // 1. Try text-based count from rendered page
  const textCount = extractStoreCount(storeHtml);
  if (textCount > 0) return textCount;

  // 2. Try JSON arrays embedded in the rendered page
  const jsonCount = countJsonArrayItems(storeHtml);
  if (jsonCount > 0) return jsonCount;

  // 3. Count store-related DOM elements from rendered HTML
  const elemCount = countStoreElements(storeHtml);
  if (elemCount > 0) return elemCount;

  // 4. Count rendered list items / cards that look like store entries
  const renderedCount = countRenderedStoreItems(storeHtml);
  if (renderedCount > 0) return renderedCount;

  return 0;
}

function countRenderedStoreItems(html) {
  let best = 0;

  // Count items with address/phone/city patterns inside repeated containers
  // Look for repeated elements with address-like content
  const addressPatterns = [
    // Cards/divs/lis with addresses (pincode, phone, city references)
    /(?:<(?:div|li|article|section|tr)[^>]*>[\s\S]*?(?:\b\d{5,6}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|(?:phone|tel|call|address|city|state|pincode|zip)\s*[:]\s*[^<]+)[\s\S]*?<\/(?:div|li|article|section|tr)>)/gi,
  ];

  for (const rx of addressPatterns) {
    const matches = html.match(rx);
    if (matches && matches.length > 1) {
      best = Math.max(best, matches.length);
    }
  }

  // Count "Get Directions" or map links (each usually = 1 store)
  const directionLinks = (html.match(/(?:get\s*directions?|directions?\s*(?:to|link)|google\.com\/maps\?|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps)/gi) || []).length;
  if (directionLinks > 1) best = Math.max(best, directionLinks);

  // Count map markers/pins from common JS patterns in rendered source
  const markerPatterns = [
    /new\s+google\.maps\.Marker/gi,
    /L\.marker\s*\(/gi,
    /mapboxgl\.Marker/gi,
    /"lat"\s*:\s*[\d.-]+\s*,\s*"lng"\s*:\s*[\d.-]+/gi,
    /"latitude"\s*:\s*[\d.-]+\s*,\s*"longitude"\s*:\s*[\d.-]+/gi,
  ];
  for (const rx of markerPatterns) {
    const markers = (html.match(rx) || []).length;
    if (markers > 1) best = Math.max(best, markers);
  }

  // Count repeated store-card-like class patterns
  const cardClassPatterns = [
    /class=["'][^"']*(?:store|location|outlet|branch|shop|dealer|showroom)[-_]?(?:card|item|entry|listing|block|tile|row|detail)[^"']*["']/gi,
    /class=["'][^"']*(?:card|item|entry|listing|block|tile|row|detail)[-_]?(?:store|location|outlet|branch|shop|dealer|showroom)[^"']*["']/gi,
    /data-(?:store|location|outlet|branch)[-_]?(?:id|index|name)=/gi,
  ];
  for (const rx of cardClassPatterns) {
    const cards = (html.match(rx) || []).length;
    if (cards > 1) best = Math.max(best, cards);
  }

  // Count <h3>/<h4>/<h5> headers that look like city/store names inside store sections
  const storeHeaders = (html.match(/<h[3-5][^>]*>[^<]{2,60}<\/h[3-5]>/gi) || []);
  // Only count if many of them are inside store-related containers
  if (storeHeaders.length > 3) {
    // Check if the page seems to be a store listing (has store-related keywords)
    const lowerHtml = html.toLowerCase();
    const isStoreListPage = /store.?locat|our.?store|find.?(?:a\s+)?store|store.?finder|outlet|showroom|branch/i.test(lowerHtml);
    if (isStoreListPage && storeHeaders.length > 5) {
      best = Math.max(best, storeHeaders.length);
    }
  }

  return best;
}

async function detectOfflineStores(html, url, technologies, fetchPage, storeLocatorUrl, jsonLdStoreHint, browserFetch) {
  const countFromMainText = extractStoreCount(html);

  if (!storeLocatorUrl) storeLocatorUrl = findStoreLocatorLink(html, url);

  // Fetch store locator page with axios first (most authoritative source)
  let storeLocatorHtml = '';
  if (storeLocatorUrl && fetchPage) {
    try {
      const resp = await fetchPage(storeLocatorUrl);
      storeLocatorHtml = typeof resp.data === 'string' ? resp.data : '';
    } catch {}
  }

  // Check store locator page — its count takes priority over main page text
  if (storeLocatorHtml) {
    // Check for third-party widget APIs (StoreRocket, Storepoint, etc.)
    const locatorApiCount = await tryThirdPartyStoreLocators(storeLocatorHtml, fetchPage);
    if (locatorApiCount > 0) return countToBand(locatorApiCount);

    // Try inline API detection on store locator page
    const locatorInlineCount = await tryInlineStoreApis(storeLocatorHtml, storeLocatorUrl, fetchPage);
    if (locatorInlineCount > 0) return countToBand(locatorInlineCount);

    // Fetch JS chunks referenced in store locator page and check for API URLs
    const jsChunkCount = await tryStoreApiFromJsChunks(storeLocatorHtml, storeLocatorUrl, fetchPage);
    if (jsChunkCount > 0) return countToBand(jsChunkCount);

    // Try text/element extraction from store locator page
    const countFromLocator = extractStoreCount(storeLocatorHtml);
    if (countFromLocator > 0) return countToBand(countFromLocator);

    const jsonArrayCount = countJsonArrayItems(storeLocatorHtml);
    if (jsonArrayCount > 0) return countToBand(jsonArrayCount);

    const elementCount = countStoreElements(storeLocatorHtml);
    if (elementCount > 0) return countToBand(elementCount);
  }

  // Fall back to main page text count if no store locator page found
  if (countFromMainText > 0) return countToBand(countFromMainText);

  // Check main page HTML for third-party store locator APIs
  const apiCount = await tryStoreLocatorApis(html, url, fetchPage);
  if (apiCount > 0) return countToBand(apiCount);

  // Try browser-based rendering of store locator page (catches SPA/JS-rendered pages)
  if (storeLocatorUrl && browserFetch) {
    try {
      const browserCount = await scrapeStoreLocatorWithBrowser(storeLocatorUrl, browserFetch);
      if (browserCount > 0) return countToBand(browserCount);
    } catch (e) {
      console.warn(`[storeLocator] browser scrape failed: ${e.message}`);
    }
  }

  if (jsonLdStoreHint && jsonLdStoreHint > 1) return countToBand(jsonLdStoreHint);

  if (storeLocatorUrl) {
    const storeAnchors = new Set();
    const anchorRx = /(?:stores?-near-me|store-?locator|locations?|find-a-store|our-stores)#([^"'\s]+)/gi;
    let am;
    while ((am = anchorRx.exec(html)) !== null) storeAnchors.add(am[1]);

    let maxStoreId = 0;
    for (const anchor of storeAnchors) {
      const idMatch = /-(\d+)$/.exec(anchor);
      if (idMatch) maxStoreId = Math.max(maxStoreId, parseInt(idMatch[1], 10));
    }
    if (maxStoreId > 1) return countToBand(maxStoreId);

    if (storeAnchors.size > 1) return countToBand(storeAnchors.size);

    const directionLinks = (html.match(/google\.com\/maps|maps\.google|get\s*direction/gi) || []).length;
    if (directionLinks > 1) return countToBand(directionLinks);
  }

  const [commonPageCount, wikiCount] = await Promise.all([
    tryCommonStorePages(url, fetchPage, browserFetch),
    tryWikipediaStoreCount(url, html),
  ]);
  const bestFallback = Math.max(commonPageCount, wikiCount);
  if (bestFallback > 0) return countToBand(bestFallback);

  if (storeLocatorUrl) return '1-10';

  return 'Unknown';
}

async function tryWikipediaStoreCount(url, html) {
  try {
    const https = require('https');
    let domain;
    try { domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace(/^www\./, ''); } catch { return 0; }
    const brandName = domain.split('.')[0];
    const domainNoTld = domain.replace(/\.\w+$/, '');

    let pageTitle = '';
    if (html) {
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      if (titleMatch) {
        pageTitle = titleMatch[1].replace(/[\s|–—-]+(?:official|home|website|page|online|store|shop).*/i, '').trim();
        pageTitle = pageTitle.replace(/\s*[|–—-]\s*$/, '').trim();
      }
    }

    const fetchWikiJson = (apiUrl) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      https.get(apiUrl, { headers: { 'User-Agent': 'HarvinScan/1.0 (tech scanner)' } }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(d)); } catch { resolve(null); } });
      }).on('error', e => { clearTimeout(timer); reject(e); });
    });

    const searchTerms = [brandName + ' company'];
    if (pageTitle && pageTitle.toLowerCase() !== brandName.toLowerCase()) {
      searchTerms.unshift(pageTitle + ' company');
    }

    let searchResult = null;
    for (const term of searchTerms) {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&srlimit=5`;
      searchResult = await fetchWikiJson(searchUrl);
      if (searchResult?.query?.search?.length) break;
    }
    if (!searchResult?.query?.search?.length) return 0;

    const candidates = searchResult.query.search.slice(0, 3);
    for (const candidate of candidates) {
      const title = candidate.title;
      const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json`;
      const parseResult = await fetchWikiJson(parseUrl);
      const wikitext = parseResult?.parse?.wikitext?.['*'] || '';
      if (!wikitext) continue;

      const wtLower = wikitext.toLowerCase();
      const titleLower = title.toLowerCase();
      const brandLower = brandName.toLowerCase();
      const domainLower = domainNoTld.toLowerCase();
      const pageTitleLower = pageTitle.toLowerCase();

      const mentionsDomain = wtLower.includes(domain) || wtLower.includes(domainLower + '.com') || wtLower.includes(domainLower + '.in');
      const mentionsBrand = titleLower.includes(brandLower) || (pageTitleLower && titleLower.includes(pageTitleLower.split(' ')[0].toLowerCase()));
      if (!mentionsDomain && !mentionsBrand) continue;

      const locationMatch = /(?:num_locations|number_of_locations|locations)\s*=\s*[^\n]*?(\d[\d,]+)/i.exec(wikitext);
      if (locationMatch) {
        const num = parseInt(locationMatch[1].replace(/,/g, ''), 10);
        if (num > 0 && num < 100000) return num;
      }

      const patterns = [
        /(\d[\d,]+)\s*(?:stores?|outlets?|retail\s+stores?|locations?)\s*(?:worldwide|globally|across|around\s+the\s+world)/gi,
        /(?:operates?|has|have|with)\s+(?:over\s+|more\s+than\s+|approximately\s+|about\s+|around\s+|nearly\s+)?(\d[\d,]+)\s*(?:stores?|outlets?|locations?|branches?)/gi,
      ];

      let best = 0;
      for (const rx of patterns) {
        let m;
        while ((m = rx.exec(wikitext)) !== null) {
          const num = parseInt(m[1].replace(/,/g, ''), 10);
          if (num >= 5 && num < 100000 && num > best) best = num;
        }
      }
      if (best > 0) return best;
    }
    return 0;
  } catch {
    return 0;
  }
}

function extractStoreCountStrict(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  const patterns = [
    /(?:^|[\s(>])(\d[\d,]+)\+?\s+(?:\w+\s+)?(?:stores?|outlets?|showrooms?|branches?)\b/gi,
    /(?:over|more than)\s+(\d[\d,]+)\s*(?:\w+\s+)?(?:stores?|outlets?|showrooms?|branches?)/gi,
    /(?:network\s+of|chain\s+of)\s+(\d[\d,]+)\+?\s*(?:stores?|outlets?|showrooms?|branches?|locations?)/gi,
  ];

  let best = 0;
  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(text)) !== null) {
      const num = parseInt(m[1].replace(/,/g, ''), 10);
      if (num >= 2 && num < 100000 && !isLikelyYear(num) && !hasNegativeContext(text, m.index, m[0].length) && num > best) {
        best = num;
      }
    }
  }
  return best;
}

async function tryCommonStorePages(url, fetchPage, browserFetch) {
  if (!fetchPage) return 0;
  let baseUrl;
  try { baseUrl = new URL(url.startsWith('http') ? url : 'https://' + url); } catch { return 0; }
  const origin = baseUrl.origin;

  // Build brand-specific store paths (e.g. /mamaearth-store, /mamaearth-stores)
  const brand = getBrandName(baseUrl.hostname);
  const brandStorePaths = brand ? [`/${brand}-store`, `/${brand}-stores`] : [];

  const storePaths = [
    '/stores', '/store-locator', '/locations', '/find-a-store',
    '/our-stores', '/find-store', '/store-finder', '/retail-stores',
    '/store-near-me', '/stores-near-me',
    '/locate-us', '/visit-us', '/where-to-buy', '/dealers',
    '/pages/store-locator', '/pages/stores', '/pages/our-stores',
    '/pages/locate-us', '/pages/find-us', '/pages/boutique',
    ...brandStorePaths,
  ];
  const aboutPaths = ['/about', '/about-us', '/company'];

  // First try with axios (fast, parallel)
  const results = await Promise.allSettled(
    [...storePaths, ...aboutPaths].map(async (path) => {
      try {
        const resp = await fetchPage(origin + path);
        const pageHtml = typeof resp.data === 'string' ? resp.data : '';
        if (!pageHtml || pageHtml.length < 500) return 0;

        const isAboutPage = aboutPaths.includes(path);
        const countFromPage = isAboutPage ? extractStoreCountStrict(pageHtml) : extractStoreCount(pageHtml);
        if (countFromPage > 0) return countFromPage;

        if (!isAboutPage) {
          // Check for third-party store locator widgets
          const widgetCount = await tryThirdPartyStoreLocators(pageHtml, fetchPage);
          if (widgetCount > 0) return widgetCount;

          // Check for inline store APIs (SAP Commerce, custom backends, etc.)
          const inlineApiCount = await tryInlineStoreApis(pageHtml, origin + path, fetchPage);
          if (inlineApiCount > 0) return inlineApiCount;

          // Check JS chunks for store API endpoints (SPA apps like Angular/React)
          const jsChunkCount = await tryStoreApiFromJsChunks(pageHtml, origin + path, fetchPage);
          if (jsChunkCount > 0) return jsChunkCount;

          const jsonCount = countJsonArrayItems(pageHtml);
          if (jsonCount > 0) return jsonCount;

          const elemCount = countStoreElements(pageHtml);
          if (elemCount > 0) return elemCount;

          const renderedCount = countRenderedStoreItems(pageHtml);
          if (renderedCount > 0) return renderedCount;
        }
      } catch {}
      return 0;
    })
  );

  let best = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value > best) best = r.value;
  }

  // If axios found nothing and browser is available, try top store paths with browser
  if (best === 0 && browserFetch) {
    const topPaths = ['/stores', '/store-locator', '/store-finder', '/locations', '/our-stores', '/find-a-store', '/pages/store-locator', '/pages/stores'];
    for (const path of topPaths) {
      try {
        const count = await scrapeStoreLocatorWithBrowser(origin + path, browserFetch);
        if (count > 0) return count;
      } catch {}
    }
  }

  return best;
}

async function tryThirdPartyStoreLocators(html, fetchPage) {
  if (!fetchPage) return 0;

  const checks = [];

  // StoreRocket (Shopify app) — e.g. storerocket-id="dQ8dMjjpr1"
  const storeRocketMatch = /storerocket-id=["']([^"']+)["']/i.exec(html);
  if (storeRocketMatch) {
    checks.push(async () => {
      const resp = await fetchPage(`https://storerocket.io/api/user/${storeRocketMatch[1]}/locations`);
      const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      const locations = data?.results?.locations;
      return Array.isArray(locations) ? locations.length : 0;
    });
  }

  // Storepoint — e.g. data-storepoint-id="xxx" or storepoint.co
  const storepointMatch = /data-storepoint-id=["']([^"']+)["']/i.exec(html)
    || /storepoint\.co\/api\/v1\/(?:tag\/)?(\w+)/i.exec(html);
  if (storepointMatch) {
    checks.push(async () => {
      const resp = await fetchPage(`https://api.storepoint.co/v1/${storepointMatch[1]}/locations`);
      const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      const results = data?.results?.locations || data?.results;
      return Array.isArray(results) ? results.length : 0;
    });
  }

  // Storemapper — storemapper.com or data-storemapper-id
  const storemapperMatch = /data-storemapper-id=["']([^"']+)["']/i.exec(html)
    || /storemapper\.co[^"']*\/api[^"']*?(\d+)/i.exec(html);
  if (storemapperMatch) {
    checks.push(async () => {
      const resp = await fetchPage(`https://storemapper-herokuapp-com.global.ssl.fastly.net/api/users/${storemapperMatch[1]}/stores.js`);
      const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      return Array.isArray(data) ? data.length : 0;
    });
  }

  // Stockist — stockist.co
  const stockistMatch = /stockist\.co\/embed\/(\w+)/i.exec(html)
    || /data-stockist-widget-tag=["']([^"']+)["']/i.exec(html);
  if (stockistMatch) {
    checks.push(async () => {
      const resp = await fetchPage(`https://stockist.co/api/v1/u${stockistMatch[1]}/locations/search?tag=`);
      const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      return Array.isArray(data) ? data.length : (data?.count || 0);
    });
  }

  // Bold Store Locator (Shopify) — bold-store-locator
  const boldMatch = /bold-store-locator[^"']*shop=["']?([^"'\s&]+)/i.exec(html);
  if (boldMatch) {
    checks.push(async () => {
      const resp = await fetchPage(`https://store-locator.boldapps.net/api/lapi/locations?shop=${boldMatch[1]}`);
      const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      return Array.isArray(data) ? data.length : (data?.locations?.length || 0);
    });
  }

  // Yext — yext.com or pages.entity
  const yextMatch = /yextpages\.net|yext\.com\/[^"']*apiKey=([^"'&]+)/i.exec(html);
  if (yextMatch) {
    // Can't easily query Yext API without full details, but detect its presence
    // and try to count from the rendered page instead
  }

  // Locally — locally.com
  const locallyMatch = /locally\.com\/stores\/conversion_data\?.*?id=(\d+)/i.exec(html);
  if (locallyMatch) {
    checks.push(async () => {
      const resp = await fetchPage(`https://www.locally.com/stores/conversion_data?has_data=true&company_id=${locallyMatch[1]}&inline=1&lang=en-us`);
      const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      return Array.isArray(data?.markers) ? data.markers.length : 0;
    });
  }

  if (checks.length === 0) return 0;

  const results = await Promise.allSettled(checks.map(fn => fn()));
  let best = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value > best) best = r.value;
  }
  return best;
}

async function tryStoreApiFromJsChunks(html, pageUrl, fetchPage) {
  if (!fetchPage) return 0;

  // Find JS chunk URLs — prioritize store-related, but also include shared chunks
  const storeChunks = [];
  const sharedChunks = [];
  const srcRx = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = srcRx.exec(html)) !== null) {
    const src = m[1];
    // Skip polyfills, webpack runtime, and non-JS
    if (/polyfill|webpack|framework|runtime/i.test(src)) continue;
    try {
      const fullUrl = new URL(src, pageUrl).href;
      if (/store|location/i.test(src)) {
        storeChunks.push(fullUrl);
      } else if (/\/chunks\/\d+[-.]|\/chunks\/[a-f0-9]{6,}[-.]|app\/|page-|layout|main[.\-]|scripts[.\-]/i.test(src)) {
        sharedChunks.push(fullUrl);
      }
    } catch {}
  }

  // Prioritize store-related chunks, then shared chunks (which often contain API config)
  const allChunks = [...storeChunks, ...sharedChunks];
  if (allChunks.length === 0) return 0;

  // Fetch store chunks + up to 8 shared chunks in parallel
  const chunksToCheck = allChunks.slice(0, storeChunks.length + 8);
  let combinedJs = '';

  const chunkResults = await Promise.allSettled(
    chunksToCheck.map(async (chunkUrl) => {
      const resp = await fetchPage(chunkUrl);
      return typeof resp.data === 'string' ? resp.data : '';
    })
  );

  for (const r of chunkResults) {
    if (r.status === 'fulfilled' && r.value) {
      combinedJs += r.value + '\n';
    }
  }

  if (!combinedJs) return 0;

  // Now try to find API URLs and store endpoints in the combined JS
  return tryInlineStoreApis(combinedJs, pageUrl, fetchPage);
}

async function tryInlineStoreApis(html, url, fetchPage) {
  if (!fetchPage) return 0;

  let siteHost = '';
  let siteRootDomain = '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    siteHost = parsed.hostname;
    siteRootDomain = getRootDomain(siteHost);
  } catch {}

  // Find API base URLs from JS (e.g. AWS AppRunner, Heroku, custom backends)
  const apiBaseUrls = new Set();

  // Match backend URLs in JS: cloud hosting platforms
  const backendPatterns = [
    /["'](https?:\/\/[a-z0-9-]+\.(?:ap-south-1|us-east-1|eu-west-1|ap-southeast-1)\.awsapprunner\.com)["']/gi,
    /["'](https?:\/\/[a-z0-9-]+\.herokuapp\.com)["']/gi,
    /["'](https?:\/\/[a-z0-9-]+\.up\.railway\.app)["']/gi,
    /["'](https?:\/\/[a-z0-9-]+\.onrender\.com)["']/gi,
    /["'](https?:\/\/[a-z0-9-]+\.vercel\.app)["']/gi,
  ];
  for (const rx of backendPatterns) {
    let m;
    while ((m = rx.exec(html)) !== null) {
      apiBaseUrls.add(m[1]);
    }
  }

  // Detect site-specific API subdomains (e.g. apisap.fabindia.com, api.brand.com)
  if (siteRootDomain) {
    const apiSubdomainRx = new RegExp('["\'](https?://(?:api[a-z0-9-]*|backend|services?|gateway)\\.' + siteRootDomain.replace('.', '\\.') + '[^"\']*)["\']', 'gi');
    let m;
    while ((m = apiSubdomainRx.exec(html)) !== null) {
      try {
        const apiUrl = new URL(m[1]);
        apiBaseUrls.add(apiUrl.origin);
      } catch {}
    }
  }

  // Detect SAP Commerce / Hybris OCC API pattern (occ/v2/<baseSite>/stores)
  const sapOccMatch = /["']?(https?:\/\/[^"'\s]+)\/occ\/v\d+\/([a-zA-Z0-9_-]+)/i.exec(html);
  const sapBaseSiteMatch = /baseSite[:\s]*["'\[]+"?([a-zA-Z0-9_-]+)/i.exec(html);
  if (sapOccMatch || sapBaseSiteMatch) {
    const sapBase = sapOccMatch ? sapOccMatch[1] : null;
    const sapSite = sapOccMatch ? sapOccMatch[2] : (sapBaseSiteMatch ? sapBaseSiteMatch[1] : null);
    if (sapBase && sapSite) {
      const sapStoreUrl = `${sapBase}/occ/v2/${sapSite}/stores?query=&pageSize=1000&fields=stores(name)`;
      try {
        const resp = await fetchPage(sapStoreUrl);
        const data = normalizeApiData(resp.data);
        if (data) {
          const count = extractCountFromApiResponse(data);
          if (count > 0) return count;
        }
      } catch {}
    }
    // If we found baseSite but not the API host, try API subdomains + known SAP patterns
    if (!sapBase && sapSite) {
      const hostsToTry = [...apiBaseUrls];
      if (siteRootDomain) {
        hostsToTry.push(`https://api.${siteRootDomain}`, `https://apisap.${siteRootDomain}`);
      }
      for (const h of hostsToTry) {
        const sapStoreUrl = `${h}/occ/v2/${sapSite}/stores?query=&pageSize=1000&fields=stores(name)`;
        try {
          const resp = await fetchPage(sapStoreUrl);
          const data = normalizeApiData(resp.data);
          if (data) {
            const count = extractCountFromApiResponse(data);
            if (count > 0) return count;
          }
        } catch {}
      }
    }
  }

  // Also look for API paths referencing stores
  const storePathMatch = /["'](\/v\d\/stores?\/[^"']+)["']/i.exec(html);
  const storeApiPath = storePathMatch ? storePathMatch[1] : null;

  if (apiBaseUrls.size === 0 && !storeApiPath) return 0;

  // Common store API paths to try
  const storePaths = storeApiPath
    ? [storeApiPath]
    : ['/v1/stores/public', '/v1/stores', '/api/stores', '/api/v1/stores', '/stores', '/api/store-locator'];

  const checks = [];
  for (const base of apiBaseUrls) {
    for (const path of storePaths) {
      checks.push(
        fetchPage(base + path)
          .then(resp => {
            const data = normalizeApiData(resp.data);
            if (!data || !data.startsWith('{') && !data.startsWith('[')) return 0;
            return extractCountFromApiResponse(data);
          })
          .catch(() => 0)
      );
    }
  }

  // Also try store paths on the site's own origin
  if (storeApiPath) {
    let origin;
    try { origin = new URL(url.startsWith('http') ? url : 'https://' + url).origin; } catch {}
    if (origin) {
      checks.push(
        fetchPage(origin + storeApiPath)
          .then(resp => {
            const data = normalizeApiData(resp.data);
            if (!data || !data.startsWith('{') && !data.startsWith('[')) return 0;
            return extractCountFromApiResponse(data);
          })
          .catch(() => 0)
      );
    }
  }

  if (checks.length === 0) return 0;

  const results = await Promise.allSettled(checks);
  let best = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value > best) best = r.value;
  }
  return best;
}

async function tryStoreLocatorApis(html, url, fetchPage) {
  if (!fetchPage) return 0;

  // First try known third-party store locator widget APIs
  const thirdPartyCount = await tryThirdPartyStoreLocators(html, fetchPage);
  if (thirdPartyCount > 0) return thirdPartyCount;

  // Try extracting API base URLs from JS and hitting store endpoints
  const inlineApiCount = await tryInlineStoreApis(html, url, fetchPage);
  if (inlineApiCount > 0) return inlineApiCount;

  const apiUrls = new Set();
  const scriptRx = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while ((sm = scriptRx.exec(html)) !== null) {
    const script = sm[1];
    const urlPatterns = [
      /["']((?:https?:)?\/\/[^"']*(?:store|location|outlet|dealer|find)[^"']*\.json[^"']*)["']/gi,
      /["'](\/api\/[^"']*(?:store|location|outlet|dealer)[^"']*)["']/gi,
      /["']((?:https?:)?\/\/[^"']*(?:stockist|uberall|yext|brandify|locally)[^"']*)["']/gi,
    ];
    for (const rx of urlPatterns) {
      let um;
      while ((um = rx.exec(script)) !== null) {
        try {
          apiUrls.add(new URL(um[1], url).href);
        } catch {}
      }
    }
  }

  if (apiUrls.size === 0) return 0;

  const results = await Promise.allSettled(
    [...apiUrls].slice(0, 3).map(async (apiUrl) => {
      const resp = await fetchPage(apiUrl);
      const data = normalizeApiData(resp.data);
      return data ? extractCountFromApiResponse(data) : 0;
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value > 0) return r.value;
  }
  return 0;
}

function normalizeApiData(respData) {
  if (typeof respData === 'object' && respData !== null) return JSON.stringify(respData);
  if (typeof respData === 'string') return respData;
  return '';
}

function extractCountFromApiResponse(data) {
  // Handle XML responses (e.g., SAP Commerce OCC API with Accept: text/html)
  if (typeof data === 'string' && data.trimStart().startsWith('<?xml')) {
    const totalMatch = /<totalResults>(\d+)<\/totalResults>/i.exec(data);
    if (totalMatch) return parseInt(totalMatch[1], 10);
    const countMatch = /<total>(\d+)<\/total>/i.exec(data);
    if (countMatch) return parseInt(countMatch[1], 10);
    // Count repeated store/location elements
    const storeElements = (data.match(/<stores>/gi) || data.match(/<location>/gi) || []).length;
    if (storeElements > 1) return storeElements;
    return 0;
  }

  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data;

    if (typeof json.total === 'number' && json.total > 0) return json.total;
    if (typeof json.count === 'number' && json.count > 0) return json.count;
    if (typeof json.totalCount === 'number') return json.totalCount;
    if (typeof json.total_count === 'number') return json.total_count;
    if (typeof json.totalResults === 'number') return json.totalResults;
    if (typeof json.total_results === 'number') return json.total_results;

    if (json.data?.total > 0) return json.data.total;
    if (json.data?.count > 0) return json.data.count;
    if (json.meta?.total > 0) return json.meta.total;
    if (json.meta?.count > 0) return json.meta.count;
    if (json.pagination?.total > 0) return json.pagination.total;
    if (json.pagination?.totalResults > 0) return json.pagination.totalResults;
    if (json.pagination?.totalCount > 0) return json.pagination.totalCount;

    const arr = Array.isArray(json) ? json :
                Array.isArray(json.data) ? json.data :
                Array.isArray(json.stores) ? json.stores :
                Array.isArray(json.locations) ? json.locations :
                Array.isArray(json.results) ? json.results : null;

    if (arr && arr.length > 0) {
      const sample = arr[0];
      if (typeof sample === 'object' && sample !== null) {
        const keys = Object.keys(sample).join(' ').toLowerCase();
        if (/lat|lng|longitude|latitude|address|city|store|location|phone|zip|pin|name/.test(keys)) {
          if (json.per_page && json.total_pages) return json.per_page * json.total_pages;
          if (json.pageSize && json.totalPages) return json.pageSize * json.totalPages;
          return arr.length;
        }
      }
    }
  } catch {}

  return 0;
}

function isLikelyYear(num) {
  return num >= 1900 && num <= 2030;
}

function hasNegativeContext(text, matchIndex, matchLength) {
  const before = text.slice(Math.max(0, matchIndex - 40), matchIndex).toLowerCase();
  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + 40).toLowerCase();
  const negBefore = /(?:since|established|founded|copyright|©|serving)\s*$/.test(before);
  const negAfter = /^\s*(?:products?|customers?|employees?|team members?|orders?|skus?|brands?|years?|crores?|lakhs?|users?|downloads?|reviews?|ratings?|pins?|styles?)/.test(after);
  // Phone number context: digits or +/- immediately before the match (e.g. "+91 8452 887740 Store")
  const phoneBefore = /(?:\+?\d[\d\s\-().]{4,})\s*$/.test(before);
  return negBefore || negAfter || phoneBefore;
}

function extractStoreCount(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  const storePatterns = [
    /(?:^|[\s(>])(\d[\d,]+)\+?\s+(?:[a-zA-Z]+\s+)?(?:stores?|outlets?|showrooms?|branches?)\b/gi,
    /(?:over|more than|across)\s+(\d[\d,]+)\s*(?:[a-zA-Z]+\s+)?(?:stores?|outlets?|showrooms?|branches?)/gi,
    /(?:visit|explore|find)\s+(?:our|a)?\s*(\d[\d,]*)\+?\s*(?:stores?|outlets?|showrooms?)/gi,
    /(?:network\s+of|chain\s+of|with)\s+(\d[\d,]+)\+?\s*(?:stores?|outlets?|showrooms?|branches?|locations?)/gi,
  ];

  const cityPatterns = [
    /(?:stores?|outlets?|showrooms?)\s*(?:in|across)\s+(\d[\d,]+)\s*(?:\+?\s*)?(?:cities?|countries?|states?|locations?)/gi,
  ];

  let best = 0;

  for (const rx of storePatterns) {
    let m;
    while ((m = rx.exec(text)) !== null) {
      const raw = m[1];
      const num = parseInt(raw.replace(/,/g, ''), 10);
      // Reject phone-number-like sequences: 5+ raw digits without commas (e.g. 887740)
      if (raw.length >= 5 && !/,/.test(raw)) continue;
      if (num >= 2 && num < 100000 && !isLikelyYear(num) && !hasNegativeContext(text, m.index, m[0].length) && num > best) {
        best = num;
      }
    }
  }

  if (best === 0) {
    for (const rx of cityPatterns) {
      let m;
      while ((m = rx.exec(text)) !== null) {
        const num = parseInt(m[1].replace(/,/g, ''), 10);
        if (num >= 3 && num < 100000 && !isLikelyYear(num) && num > best) {
          best = num;
        }
      }
    }
  }

  return best;
}

function getRootDomain(hostname) {
  const parts = hostname.replace(/^www\./, '').split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

function getBrandName(hostname) {
  // Extract brand name from hostname: "www.snitch.co.in" -> "snitch", "boat-lifestyle.com" -> "boat-lifestyle"
  const parts = hostname.replace(/^www\./, '').split('.');
  return parts[0] || '';
}

function findStoreLocatorLink(html, baseUrl) {
  let baseRoot = '';
  let baseBrand = '';
  try {
    const parsed = new URL(baseUrl);
    baseRoot = getRootDomain(parsed.hostname);
    baseBrand = getBrandName(parsed.hostname);
  } catch {}

  const hrefRx = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRx.exec(html)) !== null) {
    const href = m[1];
    try {
      const resolved = new URL(href, baseUrl);
      const hrefRoot = getRootDomain(resolved.hostname);
      const hrefBrand = getBrandName(resolved.hostname);
      // Allow same domain, relative paths, or same brand on different TLD (e.g. snitch.co.in -> snitch.com)
      if (hrefRoot !== baseRoot && !href.startsWith('/') && !href.startsWith('#') && hrefBrand !== baseBrand) continue;
    } catch { continue; }
    for (const pattern of STORE_LOCATOR_PATTERNS) {
      if (pattern.test(href)) {
        try {
          return new URL(href, baseUrl).href;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function countStoreElements(html) {
  let count = 0;

  const addressBlocks = (html.match(/<address[\s\S]*?<\/address>/gi) || []).length;
  if (addressBlocks > 1) count = Math.max(count, addressBlocks);

  const mapPins = (html.match(/(?:marker|pin|LatLng|latitude|lat)\s*[:"]\s*[\d.-]+/gi) || []).length;
  if (mapPins > 2) count = Math.max(count, Math.floor(mapPins / 2));

  const storeCards = (html.match(/class=["'][^"']*(?:store[-_]?card|store[-_]?item|store[-_]?listing|store[-_]?detail|store[-_]?box|store[-_]?tile|location[-_]?card|location[-_]?item|location[-_]?listing|outlet[-_]?card|outlet[-_]?item|branch[-_]?item|branch[-_]?card|dealer[-_]?card|dealer[-_]?item|showroom[-_]?card|showroom[-_]?item|shop[-_]?card|shop[-_]?item)[^"']*["']/gi) || []).length;
  if (storeCards > 1) count = Math.max(count, storeCards);

  const directionsLinks = (html.match(/(?:get\s*directions?|google\.com\/maps\?|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)/gi) || []).length;
  if (directionsLinks > 1) count = Math.max(count, directionsLinks);

  const addressKeywords = (html.match(/(?:pincode|pin\s*code|zip\s*code|postal\s*code)\s*[:\s]*\d{5,6}/gi) || []).length;
  if (addressKeywords > 1) count = Math.max(count, addressKeywords);

  // Count phone number patterns (Indian format: +91, 10-digit; international formats)
  const phoneNumbers = (html.match(/(?:\+91[\s-]?\d{10}|\+\d{1,3}[\s-]\d{3,4}[\s-]\d{3,4}[\s-]?\d{0,4}|\(\d{2,5}\)\s*\d{6,8})/g) || []).length;
  if (phoneNumbers > 2) count = Math.max(count, phoneNumbers);

  // Count data attributes that indicate store entries
  const dataAttrs = (html.match(/data-(?:store|location|outlet|branch|shop|dealer|showroom)[-_]?(?:id|index|name|slug)\s*=/gi) || []).length;
  if (dataAttrs > 1) count = Math.max(count, dataAttrs);

  // Count Google Maps embed iframes (each iframe = likely 1 store)
  const mapEmbeds = (html.match(/(?:<iframe[^>]*google\.com\/maps[^>]*>|<iframe[^>]*maps\.google[^>]*>)/gi) || []).length;
  if (mapEmbeds > 1) count = Math.max(count, mapEmbeds);

  return count;
}

function countJsonArrayItems(html) {
  const jsonRx = /\[[\s\n]*\{[\s\S]{10,50000}?\}[\s\n]*\]/g;
  let m;
  let maxCount = 0;
  while ((m = jsonRx.exec(html)) !== null) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr) && arr.length > 1) {
        const sample = arr[0];
        const keys = Object.keys(sample).map(k => k.toLowerCase()).join(' ');
        if (/lat|lng|address|city|store|location|phone|zip|pin/i.test(keys)) {
          maxCount = Math.max(maxCount, arr.length);
        }
      }
    } catch {}
  }
  return maxCount;
}

function normalizeCountry(raw) {
  const s = raw.toString().trim().toUpperCase();
  return COUNTRY_MAP[s] || raw;
}

function normalizeCountryCode(code) {
  return COUNTRY_MAP[code.toUpperCase()] || code;
}

const COUNTRY_MAP = {
  'IN':  'India',
  'IND': 'India',
  'INDIA': 'India',
  'US':  'US',
  'USA': 'US',
  'UNITED STATES': 'US',
  'GB':  'UK',
  'UK':  'UK',
  'UNITED KINGDOM': 'UK',
  'AU':  'Australia',
  'AUS': 'Australia',
  'AUSTRALIA': 'Australia',
  'DE':  'Germany',
  'DEU': 'Germany',
  'GERMANY': 'Germany',
  'FR':  'France',
  'FRA': 'France',
  'FRANCE': 'France',
  'JP':  'Japan',
  'JPN': 'Japan',
  'JAPAN': 'Japan',
  'CN':  'China',
  'CHN': 'China',
  'CHINA': 'China',
  'BR':  'Brazil',
  'BRA': 'Brazil',
  'BRAZIL': 'Brazil',
  'CA':  'Canada',
  'CAN': 'Canada',
  'CANADA': 'Canada',
  'AE':  'UAE',
  'ARE': 'UAE',
  'SA':  'Saudi Arabia',
  'SAU': 'Saudi Arabia',
  'SG':  'Singapore',
  'SGP': 'Singapore',
  'KR':  'South Korea',
  'KOR': 'South Korea',
  'NZ':  'New Zealand',
  'NZL': 'New Zealand',
  'ZA':  'South Africa',
  'ZAF': 'South Africa',
  'IT':  'Italy',
  'ITA': 'Italy',
  'ES':  'Spain',
  'ESP': 'Spain',
  'NL':  'Netherlands',
  'NLD': 'Netherlands',
  'SE':  'Sweden',
  'SWE': 'Sweden',
  'MY':  'Malaysia',
  'MYS': 'Malaysia',
  'ID':  'Indonesia',
  'IDN': 'Indonesia',
  'PH':  'Philippines',
  'PHL': 'Philippines',
  'TH':  'Thailand',
  'THA': 'Thailand',
  'VN':  'Vietnam',
  'VNM': 'Vietnam',
};

async function extractCompanyMeta({ url, html, headers, metaMap, technologies, fetchPage, browserFetch, forceRefresh }) {
  const normalizedDomain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();

  const quickFetch = fetchPage ? (fetchUrl) => {
    return Promise.race([
      fetchPage(fetchUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } : null;

  try {
    const db = await getDb();
    const cached = await db.collection('company_meta').findOne({ normalizedDomain });
    if (!forceRefresh && cached && cached.expiresAt && new Date(cached.expiresAt) > new Date()) {
      const result = {
        category:      cached.overrides?.category    || cached.category,
        subCategory:   cached.overrides?.subCategory || cached.subCategory,
        region:        cached.overrides?.region      || cached.region,
        offlineStores: cached.overrides?.offlineStores || cached.offlineStores,
      };
      return result;
    }
  } catch {}

  const jsonLd = extractJsonLd(html);
  const metaResults = extractFromMeta(html, metaMap || {});
  const keywords = analyzeKeywords(html, url);
  const techHints = inferFromTech(technologies || []);

  const region = detectRegion(
    url, html, metaMap || {},
    techHints.region,
    jsonLd.region,
    metaResults.region,
    techHints
  );

  let category;
  category = jsonLd.category || keywords.category || jsonLd.genericCategory || metaResults.category || techHints.category || 'Unknown';

  let subCategory;
  if (techHints.subCategory) {
    subCategory = techHints.subCategory;
  } else {
    subCategory = keywords.subCategory || techHints.subCategory || 'General';
  }

  if (subCategory === 'General' && category !== 'Unknown' && SUB_INDUSTRY_KEYWORDS[category]) {
    const titleText = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').toLowerCase();
    const descText = ((/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html) || [])[1] || '').toLowerCase();
    let bodyText = '';
    const bodyM = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (bodyM) {
      bodyText = bodyM[1].replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000).toLowerCase();
    }
    const subTextParts = [
      { text: titleText, weight: 5 },
      { text: descText, weight: 3 },
      { text: bodyText, weight: 1 },
    ];
    let bestSub = null;
    let bestScore = 0;
    const subScores = {};
    for (const [sub, kws] of Object.entries(SUB_INDUSTRY_KEYWORDS[category])) {
      let sc = 0;
      for (const kw of kws) {
        for (const part of subTextParts) {
          if (part.text.includes(kw)) sc += part.weight;
        }
      }
      if (sc > 0) subScores[sub] = sc;
      if (sc > bestScore) { bestScore = sc; bestSub = sub; }
    }
    // Only assign a subcategory if one clearly dominates
    const scoredSubs = Object.values(subScores).filter(s => s > 0);
    const secondBest = scoredSubs.sort((a, b) => b - a)[1] || 0;
    if (bestSub && bestScore >= secondBest * 1.5) {
      subCategory = bestSub;
    }
  }

  if (techHints.subCategory === 'D2C Brand' && subCategory === 'General') {
    subCategory = 'D2C Brand';
  }

  let offlineStores;
  const noStoreBizTypes = ['FinTech', 'EdTech', 'Insurance', 'Telecom', 'Streaming Platform / OTT', 'Music & Audio Streaming', 'Gaming', 'News & Media', 'Health & Wellness Services', 'Food Delivery', 'Transportation Booking'];
  if (noStoreBizTypes.includes(category)) {
    offlineStores = 'Online only';
  } else {
    try {
      const storeLocatorUrl = findStoreLocatorLink(html, url);
      const timeoutFallback = storeLocatorUrl ? '1-10' : 'Unknown';
      offlineStores = await Promise.race([
        detectOfflineStores(html, url, technologies || [], quickFetch, storeLocatorUrl, jsonLd.storeHint, browserFetch),
        new Promise(resolve => setTimeout(() => resolve(timeoutFallback), 18000)),
      ]);
    } catch {
      offlineStores = 'Unknown';
    }
  }

  const result = { category, subCategory, region, offlineStores };

  try {
    const db = await getDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await db.collection('company_meta').updateOne(
      { normalizedDomain },
      {
        $set: {
          normalizedDomain,
          ...result,
          updatedAt: now,
          expiresAt,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  } catch {}

  return result;
}

module.exports = { extractCompanyMeta };
