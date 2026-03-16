const { getDb } = require('./db');
const { detectStoresViaInterception, tryWidgetParsers } = require('./storeInterceptor');
const { seedOverrides } = require('./storeOverrides');
const { calculateStoreConfidence } = require('./storeConfidence');
const { deduplicateStores } = require('./storeDedup');

let _overridesSeeded = false;
async function ensureOverrides() {
  if (_overridesSeeded) return;
  _overridesSeeded = true;
  try { await seedOverrides(); } catch {}
}

// ── Known brand lookup with country-TLD fallback ──────────────────────
// Given "nike.in", tries exact match first, then looks up "nike.com"
function lookupKnownBrand(domain) {
  if (KNOWN_BRANDS[domain]) return KNOWN_BRANDS[domain];
  // Extract brand name (everything before the first dot)
  const brandName = domain.split('.')[0];
  // Try .com fallback
  const comDomain = brandName + '.com';
  if (KNOWN_BRANDS[comDomain]) return KNOWN_BRANDS[comDomain];
  return null;
}

// ── Known brand database for instant, accurate classification ─────────
// domain → { category, subCategory, stores?, region?, onlineOnly? }
const KNOWN_BRANDS = {
  // Fashion & Apparel — Global
  'nike.com':        { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'Global' },
  'adidas.com':      { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'Global' },
  'adidas.co.in':    { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'India' },
  'puma.com':        { category: 'Fashion & Apparel', subCategory: 'Sportswear', stores: '100+', region: 'Global' },
  'reebok.com':      { category: 'Fashion & Apparel', subCategory: 'Sportswear', stores: '100+', region: 'Global' },
  'newbalance.com':  { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'Global' },
  'asics.com':       { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'Global' },
  'skechers.com':    { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'Global' },
  'converse.com':    { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'Global' },
  'vans.com':        { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'Global' },
  'underarmour.com': { category: 'Fashion & Apparel', subCategory: 'Sportswear', stores: '100+', region: 'Global' },
  'zara.com':        { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', stores: '100+', region: 'Global' },
  'hm.com':          { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', stores: '100+', region: 'Global' },

  'uniqlo.com':      { category: 'Fashion & Apparel', subCategory: 'Casual Wear', stores: '100+', region: 'Global' },
  'gap.com':         { category: 'Fashion & Apparel', subCategory: 'Casual Wear', stores: '100+', region: 'Global' },
  'levis.com':       { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans', stores: '100+', region: 'Global' },
  'levi.com':        { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans', stores: '100+', region: 'Global' },
  'gucci.com':       { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'louisvuitton.com':{ category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'prada.com':       { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'burberry.com':    { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'ralphlauren.com': { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'calvinklein.com': { category: 'Fashion & Apparel', subCategory: 'Premium Fashion', stores: '100+', region: 'Global' },
  'tommyhilfiger.com':{ category: 'Fashion & Apparel', subCategory: 'Premium Fashion', stores: '100+', region: 'Global' },
  'armani.com':      { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'versace.com':     { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '51-100', region: 'Global' },
  'balenciaga.com':  { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '51-100', region: 'Global' },
  'dior.com':        { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'fendi.com':       { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '51-100', region: 'Global' },
  'hermes.com':      { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'chanel.com':      { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100+', region: 'Global' },
  'forever21.com':   { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', stores: '100+', region: 'Global' },
  'asos.com':        { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', onlineOnly: true },
  'shein.com':       { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', onlineOnly: true },
  'nordstrom.com':   { category: 'Fashion & Apparel', subCategory: 'Department Store', stores: '100+', region: 'US' },
  'macys.com':       { category: 'Fashion & Apparel', subCategory: 'Department Store', stores: '100+', region: 'US' },
  'crocs.com':       { category: 'Fashion & Apparel', subCategory: 'Casual Footwear', stores: '100+', region: 'Global' },
  'birkenstock.com': { category: 'Fashion & Apparel', subCategory: 'Casual Footwear', stores: '51-100', region: 'Global' },
  'clarks.com':      { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100+', region: 'Global' },
  'timberland.com':  { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100+', region: 'Global' },
  'bata.com':        { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100+', region: 'Global' },
  'bata.in':         { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100+', region: 'India' },
  // Custom Tailoring
  'bombayshirts.com':{ category: 'Fashion & Apparel', subCategory: 'Custom Shirts', stores: '21-50', region: 'Global' },
  // Fashion & Apparel — India
  'manyavar.com':    { category: 'Fashion & Apparel', subCategory: 'Ethnic Wear', stores: '100+', region: 'India' },
  'fabindia.com':    { category: 'Fashion & Apparel', subCategory: 'Ethnic Wear', stores: '100+', region: 'India' },
  'biba.in':         { category: 'Fashion & Apparel', subCategory: 'Ethnic Wear', stores: '100+', region: 'India' },
  'wforwoman.com':   { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', stores: '100+', region: 'India' },
  'global.com':      { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans' },
  'bewakoof.com':    { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'thesouledstore.com':{ category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'snitch.co.in':    { category: 'Fashion & Apparel', subCategory: 'Men\'s Fashion', stores: '21-50', region: 'Global' },
  'snitch.com':      { category: 'Fashion & Apparel', subCategory: 'Men\'s Fashion', stores: '21-50', region: 'Global' },
  'rfrk.in':         { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'bonkers.co.in':   { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'urbanic.com':     { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', onlineOnly: true },
  'nykdfashion.com': { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', onlineOnly: true },
  'pantaloons.com':  { category: 'Fashion & Apparel', subCategory: 'Multi-Brand Retail', stores: '100+', region: 'India' },
  'lifestylestores.com':{ category: 'Fashion & Apparel', subCategory: 'Multi-Brand Retail', stores: '51-100', region: 'India' },
  'shoppersstop.com':{ category: 'Fashion & Apparel', subCategory: 'Department Store', stores: '51-100', region: 'India' },
  'ajio.com':        { category: 'Fashion & Apparel', subCategory: 'Multi-Brand Retail', onlineOnly: true },
  'pepe.in':         { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans' },
  'pepe.co.in':      { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans' },
  'uspoloassn.in':   { category: 'Fashion & Apparel', subCategory: 'Casual Wear' },
  'allensolly.com':  { category: 'Fashion & Apparel', subCategory: 'Formal Wear' },
  'louisphilippe.com':{ category: 'Fashion & Apparel', subCategory: 'Formal Wear' },
  'vanhuesen.com':   { category: 'Fashion & Apparel', subCategory: 'Formal Wear' },
  'peterengland.com':{ category: 'Fashion & Apparel', subCategory: 'Formal Wear' },
  'jockey.in':       { category: 'Fashion & Apparel', subCategory: 'Innerwear & Loungewear' },
  'clovia.com':      { category: 'Fashion & Apparel', subCategory: 'Lingerie & Innerwear' },
  'zivame.com':      { category: 'Fashion & Apparel', subCategory: 'Lingerie & Innerwear' },
  'amante.in':       { category: 'Fashion & Apparel', subCategory: 'Lingerie & Innerwear' },
  'woodland.in':     { category: 'Fashion & Apparel', subCategory: 'Outdoor & Adventure', stores: '100+', region: 'India' },
  'campusshoes.com': { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'India' },
  'libertyshoes.com':{ category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100+', region: 'India' },
  'metrobrands.com': { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100+', region: 'India' },
  'mochi.in':        { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100+', region: 'India' },
  'mochishoes.com':  { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100+', region: 'India' },
  // Jewelry
  'tanishq.co.in':   { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'India' },
  'caratlane.com':    { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'India' },
  'bluestone.com':    { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '51-100', region: 'India' },
  'kalyan.com':       { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'India' },
  'kalyanjewellers.net':{ category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'India' },
  'malabargold.com':  { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'Global' },
  'pngjewellers.com': { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'India' },
  'joyalukkas.com':   { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'Global' },
  'tiffany.com':      { category: 'Jewelry', subCategory: 'Luxury Jewelry', stores: '100+', region: 'Global' },
  'cartier.com':      { category: 'Jewelry', subCategory: 'Luxury Jewelry', stores: '100+', region: 'Global' },
  'swarovski.com':    { category: 'Jewelry', subCategory: 'Crystal & Fashion Jewelry', stores: '100+', region: 'Global' },
  'pandora.net':      { category: 'Jewelry', subCategory: 'Fashion Jewelry', stores: '100+', region: 'Global' },
  // Beauty & Personal Care
  'foxtale.in':       { category: 'Beauty & Personal Care', subCategory: 'Skincare', stores: '100+', region: 'India' },
  'nykaa.com':        { category: 'Beauty & Personal Care', subCategory: 'Beauty Marketplace', stores: '100+', region: 'India' },
  'mamaearth.in':     { category: 'Beauty & Personal Care', subCategory: 'Natural & Organic', stores: '100+', region: 'India' },
  'mcaffeine.com':    { category: 'Beauty & Personal Care', subCategory: 'Skincare', onlineOnly: true },
  'plumgoodness.com': { category: 'Beauty & Personal Care', subCategory: 'Clean Beauty', onlineOnly: true },
  'myglamm.com':      { category: 'Beauty & Personal Care', subCategory: 'Makeup', stores: '51-100', region: 'India' },
  'sugarcosmetics.com':{ category: 'Beauty & Personal Care', subCategory: 'Makeup', stores: '51-100', region: 'India' },
  'lorealparis.co.in':{ category: 'Beauty & Personal Care', subCategory: 'Premium Beauty', stores: '100+', region: 'Global' },
  'maccosmetics.com': { category: 'Beauty & Personal Care', subCategory: 'Premium Beauty', stores: '100+', region: 'Global' },
  'sephora.com':      { category: 'Beauty & Personal Care', subCategory: 'Beauty Retail', stores: '100+', region: 'Global' },
  'bathbodyworks.com':{ category: 'Beauty & Personal Care', subCategory: 'Bath & Body', stores: '100+', region: 'Global' },
  'forestessentialsindia.com':{ category: 'Beauty & Personal Care', subCategory: 'Luxury Ayurvedic', stores: '51-100', region: 'India' },
  'thebodyshop.com':  { category: 'Beauty & Personal Care', subCategory: 'Natural Beauty', stores: '100+', region: 'Global' },
  'beardo.in':        { category: 'Beauty & Personal Care', subCategory: 'Men\'s Grooming', onlineOnly: true },
  'manmatters.com':   { category: 'Beauty & Personal Care', subCategory: 'Men\'s Grooming', onlineOnly: true },
  'bombayshavingcompany.com':{ category: 'Beauty & Personal Care', subCategory: 'Men\'s Grooming', onlineOnly: true },
  // Electronics & Tech
  'apple.com':        { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global' },
  'samsung.com':      { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global' },
  'oneplus.in':       { category: 'Electronics & Tech', subCategory: 'Smartphones', stores: '51-100', region: 'India' },
  'mi.com':           { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global' },
  'boat-lifestyle.com':{ category: 'Electronics & Tech', subCategory: 'Audio & Wearables', onlineOnly: true },
  'noise.com':        { category: 'Electronics & Tech', subCategory: 'Audio & Wearables', onlineOnly: true },
  'croma.com':        { category: 'Electronics & Tech', subCategory: 'Electronics Retail', stores: '100+', region: 'India' },
  'reliancedigital.in':{ category: 'Electronics & Tech', subCategory: 'Electronics Retail', stores: '100+', region: 'India' },
  'sony.com':         { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global' },
  'dell.com':         { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100+', region: 'Global' },
  'hp.com':           { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100+', region: 'Global' },
  'lenovo.com':       { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100+', region: 'Global' },
  'bose.com':         { category: 'Electronics & Tech', subCategory: 'Premium Audio', stores: '100+', region: 'Global' },
  'jbl.com':          { category: 'Electronics & Tech', subCategory: 'Audio', stores: '100+', region: 'Global' },
  'dyson.com':        { category: 'Electronics & Tech', subCategory: 'Home Appliances', stores: '51-100', region: 'Global' },
  // Home & Living
  'ikea.com':         { category: 'Home & Living', subCategory: 'Furniture & Home', stores: '100+', region: 'Global' },
  'woodenstreet.com': { category: 'Home & Living', subCategory: 'Furniture', stores: '51-100', region: 'India' },
  'pepperfry.com':    { category: 'Home & Living', subCategory: 'Furniture Marketplace', stores: '51-100', region: 'India' },
  'urbanladder.com':  { category: 'Home & Living', subCategory: 'Furniture', stores: '21-50', region: 'India' },
  'sleepycat.in':     { category: 'Home & Living', subCategory: 'Mattresses & Sleep', onlineOnly: true },
  'wakefit.co':       { category: 'Home & Living', subCategory: 'Mattresses & Sleep', stores: '21-50', region: 'India' },
  'sleepwell.co.in':  { category: 'Home & Living', subCategory: 'Mattresses & Sleep', stores: '100+', region: 'India' },
  'godrejinterio.com':{ category: 'Home & Living', subCategory: 'Furniture', stores: '100+', region: 'India' },
  'hometown.in':      { category: 'Home & Living', subCategory: 'Home Decor', stores: '51-100', region: 'India' },
  'nestasia.in':      { category: 'Home & Living', subCategory: 'Home Decor', onlineOnly: true },
  // Food & Beverage
  'chaipoint.com':    { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '100+', region: 'India' },
  'starbucks.com':    { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '100+', region: 'Global' },
  'starbucks.in':     { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '100+', region: 'India' },
  'mcdonalds.com':    { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'Global' },
  'dominos.com':      { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'Global' },
  'dominos.co.in':    { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'India' },
  'kfc.com':          { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'Global' },
  'subway.com':       { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'Global' },
  'zomato.com':       { category: 'Food & Beverage', subCategory: 'Food Delivery', onlineOnly: true },
  'swiggy.com':       { category: 'Food & Beverage', subCategory: 'Food Delivery', onlineOnly: true },
  'blinkit.com':      { category: 'Food & Beverage', subCategory: 'Quick Commerce', onlineOnly: true },
  'zepto.co':         { category: 'Food & Beverage', subCategory: 'Quick Commerce', onlineOnly: true },
  'bigbasket.com':    { category: 'Food & Beverage', subCategory: 'Online Grocery', onlineOnly: true },
  'licious.in':       { category: 'Food & Beverage', subCategory: 'Fresh Meat & Seafood', onlineOnly: true },
  'countrydelight.in':{ category: 'Food & Beverage', subCategory: 'Farm Fresh Dairy', onlineOnly: true },
  'pepsico.com':      { category: 'Food & Beverage', subCategory: 'Beverages & Snacks', stores: '100+', region: 'Global' },
  'cocacola.com':     { category: 'Food & Beverage', subCategory: 'Beverages', stores: '100+', region: 'Global' },
  'coca-cola.com':    { category: 'Food & Beverage', subCategory: 'Beverages', stores: '100+', region: 'Global' },
  'nestle.com':       { category: 'Food & Beverage', subCategory: 'FMCG Food & Beverage', stores: '100+', region: 'Global' },
  'unilever.com':     { category: 'FMCG', subCategory: 'Consumer Goods', stores: '100+', region: 'Global' },
  'pg.com':           { category: 'FMCG', subCategory: 'Consumer Goods', stores: '100+', region: 'Global' },
  // Outdoor & Sports
  'decathlon.in':     { category: 'Sports & Outdoor', subCategory: 'Sports Retail', stores: '100+', region: 'India' },
  'decathlon.com':    { category: 'Sports & Outdoor', subCategory: 'Sports Retail', stores: '100+', region: 'Global' },
  'thenorthface.com': { category: 'Fashion & Apparel', subCategory: 'Outdoor & Adventure', stores: '100+', region: 'Global' },
  'columbia.com':     { category: 'Fashion & Apparel', subCategory: 'Outdoor & Adventure', stores: '100+', region: 'Global' },
  // Ecommerce Marketplaces
  'amazon.com':       { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  'amazon.in':        { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  'flipkart.com':     { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  'myntra.com':       { category: 'Fashion & Apparel', subCategory: 'Fashion Marketplace', onlineOnly: true },
  'meesho.com':       { category: 'Ecommerce/Retail', subCategory: 'Social Commerce', onlineOnly: true },
  'snapdeal.com':     { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  'jiomart.com':      { category: 'Ecommerce/Retail', subCategory: 'Online Grocery', onlineOnly: true },
  'tatacliq.com':     { category: 'Ecommerce/Retail', subCategory: 'Multi-Brand Retail', onlineOnly: true },
  // Books & Stationery
  'crossword.in':     { category: 'Office & Stationery', subCategory: 'Bookstore' },
  'amazon.com':       { category: 'Ecommerce/Retail', subCategory: 'Marketplace' },
  // Eyewear
  'lenskart.com':     { category: 'Fashion & Apparel', subCategory: 'Eyewear', stores: '100+', region: 'India' },
  'johnjacobs.com':   { category: 'Fashion & Apparel', subCategory: 'Eyewear', stores: '51-100', region: 'India' },
  'titaneyeplus.com': { category: 'Fashion & Apparel', subCategory: 'Eyewear', stores: '100+', region: 'India' },
  'vincesmallworld.com':{ category: 'Fashion & Apparel', subCategory: 'Eyewear' },
  // Watches
  'titan.co.in':      { category: 'Fashion & Apparel', subCategory: 'Watches', stores: '100+', region: 'India' },
  'fastrack.in':      { category: 'Fashion & Apparel', subCategory: 'Watches & Accessories', stores: '100+', region: 'India' },
  'fossil.com':       { category: 'Fashion & Apparel', subCategory: 'Watches', stores: '100+', region: 'Global' },
  'casio.com':        { category: 'Fashion & Apparel', subCategory: 'Watches', stores: '100+', region: 'Global' },
  'rolex.com':        { category: 'Fashion & Apparel', subCategory: 'Luxury Watches', stores: '100+', region: 'Global' },
  // Bags & Luggage
  'samsonite.com':    { category: 'Fashion & Apparel', subCategory: 'Luggage & Travel', stores: '100+', region: 'Global' },
  'americantourister.com':{ category: 'Fashion & Apparel', subCategory: 'Luggage & Travel', stores: '100+', region: 'Global' },
  'wildcraft.com':    { category: 'Fashion & Apparel', subCategory: 'Backpacks & Outdoor', stores: '100+', region: 'India' },
  'skybags.co.in':    { category: 'Fashion & Apparel', subCategory: 'Bags & Luggage', stores: '100+', region: 'India' },
  'mokobara.com':     { category: 'Fashion & Apparel', subCategory: 'Luggage & Travel', onlineOnly: true },
  // Health & Wellness
  'cultfit.com':      { category: 'Fitness & Gym', subCategory: 'Gym & Fitness Center', stores: '100+', region: 'India' },
  'curefit.com':      { category: 'Fitness & Gym', subCategory: 'Gym & Fitness Center', stores: '100+', region: 'India' },
  'healthifyme.com':  { category: 'Health & Wellness', subCategory: 'Fitness App', onlineOnly: true },
  'pharmeasy.in':     { category: 'Health & Wellness Services', subCategory: 'Online Pharmacy', onlineOnly: true },
  'netmeds.com':      { category: 'Health & Wellness Services', subCategory: 'Online Pharmacy', onlineOnly: true },
  '1mg.com':          { category: 'Health & Wellness Services', subCategory: 'Online Pharmacy', onlineOnly: true },
  'practo.com':       { category: 'Health & Wellness Services', subCategory: 'Telemedicine', onlineOnly: true },
  // FinTech India
  'paytm.com':        { category: 'FinTech', subCategory: 'Digital Payments', onlineOnly: true },
  'phonepe.com':      { category: 'FinTech', subCategory: 'Digital Payments', onlineOnly: true },
  'razorpay.com':     { category: 'FinTech', subCategory: 'Payment Gateway', onlineOnly: true },
  'cred.club':        { category: 'FinTech', subCategory: 'Credit & Rewards', onlineOnly: true },
  'groww.in':         { category: 'FinTech', subCategory: 'Investment Platform', onlineOnly: true },
  'zerodha.com':      { category: 'FinTech', subCategory: 'Stock Trading', onlineOnly: true },
  'upstox.com':       { category: 'FinTech', subCategory: 'Stock Trading', onlineOnly: true },
  'policybazaar.com': { category: 'Insurance', subCategory: 'Insurance Marketplace', onlineOnly: true },
  // EdTech India
  'byjus.com':        { category: 'EdTech', subCategory: 'K-12 Learning', onlineOnly: true },
  'unacademy.com':    { category: 'EdTech', subCategory: 'Test Prep', onlineOnly: true },
  'vedantu.com':      { category: 'EdTech', subCategory: 'Online Tutoring', onlineOnly: true },
  'upgrad.com':       { category: 'EdTech', subCategory: 'Higher Education', onlineOnly: true },
  'simplilearn.com':  { category: 'EdTech', subCategory: 'Professional Courses', onlineOnly: true },
  'whitehatjr.com':   { category: 'EdTech', subCategory: 'Coding for Kids', onlineOnly: true },
  'pw.live':          { category: 'EdTech', subCategory: 'Test Prep', onlineOnly: true },
  'physicswallah.in': { category: 'EdTech', subCategory: 'Test Prep', onlineOnly: true },
  'oswaalbooks.com':  { category: 'EdTech', subCategory: 'K-12 Learning', stores: '1-10', region: 'India' },
  'myanatomy.in':     { category: 'EdTech', subCategory: 'Test Prep', onlineOnly: true },
  'toppr.com':        { category: 'EdTech', subCategory: 'K-12 Learning', onlineOnly: true },
  'doubtnut.com':     { category: 'EdTech', subCategory: 'K-12 Learning', onlineOnly: true },
  'extramarks.com':   { category: 'EdTech', subCategory: 'K-12 Learning', onlineOnly: true },
  'adda247.com':      { category: 'EdTech', subCategory: 'Test Prep', onlineOnly: true },
  'testbook.com':     { category: 'EdTech', subCategory: 'Test Prep', onlineOnly: true },
  'gradeup.co':       { category: 'EdTech', subCategory: 'Test Prep', onlineOnly: true },
  'collegedunia.com': { category: 'EdTech', subCategory: 'Higher Education', onlineOnly: true },
  'shiksha.com':      { category: 'EdTech', subCategory: 'Higher Education', onlineOnly: true },
  'embibe.com':       { category: 'EdTech', subCategory: 'Test Prep', onlineOnly: true },
  'cuemath.com':      { category: 'EdTech', subCategory: 'K-12 Learning', onlineOnly: true },
  // Travel
  'makemytrip.com':   { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'goibibo.com':      { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'cleartrip.com':    { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'yatra.com':        { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'oyo.com':          { category: 'Travel & Ticketing', subCategory: 'Hotel Booking', stores: '100+', region: 'Global' },
  'booking.com':      { category: 'Travel & Ticketing', subCategory: 'Hotel Booking', onlineOnly: true },
  'airbnb.com':       { category: 'Travel & Ticketing', subCategory: 'Vacation Rentals', onlineOnly: true },
  // Automotive
  'cars24.com':       { category: 'Automotive', subCategory: 'Used Cars', stores: '100+', region: 'India' },
  'cardekho.com':     { category: 'Automotive', subCategory: 'Car Research', onlineOnly: true },
  'spinny.com':       { category: 'Automotive', subCategory: 'Used Cars', stores: '51-100', region: 'India' },
  'ola.com':          { category: 'Transportation & Mobility', subCategory: 'Ride-Hailing', onlineOnly: true },
  'uber.com':         { category: 'Transportation & Mobility', subCategory: 'Ride-Hailing', onlineOnly: true },
  'rapido.bike':      { category: 'Transportation & Mobility', subCategory: 'Ride-Hailing', onlineOnly: true },
  // Real Estate
  '99acres.com':      { category: 'Real Estate', subCategory: 'Property Listing', onlineOnly: true },
  'magicbricks.com':  { category: 'Real Estate', subCategory: 'Property Listing', onlineOnly: true },
  'housing.com':      { category: 'Real Estate', subCategory: 'Property Listing', onlineOnly: true },
  'nobroker.in':      { category: 'Real Estate', subCategory: 'Rental Platform', onlineOnly: true },
  // Home Improvement & Hardware
  'bunnings.com.au':  { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'Australia' },
  'homedepot.com':    { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'US' },
  'lowes.com':        { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'US' },
  'acehardware.com':  { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'US' },
  'menards.com':      { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'US' },
  'diy.com':          { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'UK' },
  'wickes.co.uk':     { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'UK' },
  'screwfix.com':     { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'UK' },
  'leroymerlin.com':  { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'Global' },
  'mitre10.com.au':   { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'Australia' },
  'totaltools.com.au':{ category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'Australia' },
  'sydneytools.com.au':{ category: 'Home & Living', subCategory: 'Hardware Store', stores: '51-100', region: 'Australia' },
  // Grocery
  'dmart.in':         { category: 'Grocery & Supermarket', subCategory: 'Supermarket Chain', stores: '100+', region: 'India' },
  'spencers.in':      { category: 'Grocery & Supermarket', subCategory: 'Supermarket Chain', stores: '100+', region: 'India' },
  'naturesbasket.co.in':{ category: 'Grocery & Supermarket', subCategory: 'Premium Grocery', stores: '21-50', region: 'India' },
  'walmart.com':      { category: 'Grocery & Supermarket', subCategory: 'Supermarket Chain', stores: '100+', region: 'US' },
  'target.com':       { category: 'Grocery & Supermarket', subCategory: 'Department & Grocery', stores: '100+', region: 'US' },
  'costco.com':       { category: 'Grocery & Supermarket', subCategory: 'Wholesale Club', stores: '100+', region: 'US' },
  'woolworths.com.au':{ category: 'Grocery & Supermarket', subCategory: 'Supermarket Chain', stores: '100+', region: 'Australia' },
  'coles.com.au':     { category: 'Grocery & Supermarket', subCategory: 'Supermarket Chain', stores: '100+', region: 'Australia' },
  'tesco.com':        { category: 'Grocery & Supermarket', subCategory: 'Supermarket Chain', stores: '100+', region: 'UK' },
  // Alcohol & Tobacco — Retail
  'danmurphys.com.au':{ category: 'Alcohol & Tobacco', subCategory: 'Liquor Retail', stores: '100+', region: 'Australia' },
  'bws.com.au':       { category: 'Alcohol & Tobacco', subCategory: 'Liquor Retail', stores: '100+', region: 'Australia' },
  'totalwine.com':    { category: 'Alcohol & Tobacco', subCategory: 'Liquor Retail', stores: '100+', region: 'US' },
  'drizly.com':       { category: 'Alcohol & Tobacco', subCategory: 'Liquor Retail', onlineOnly: true },
  'vivino.com':       { category: 'Alcohol & Tobacco', subCategory: 'Wine', onlineOnly: true },
  'wine.com':         { category: 'Alcohol & Tobacco', subCategory: 'Wine', onlineOnly: true },
  'lcbo.com':         { category: 'Alcohol & Tobacco', subCategory: 'Liquor Retail', stores: '100+', region: 'Canada' },
  'thewhiskyexchange.com': { category: 'Alcohol & Tobacco', subCategory: 'Spirits', onlineOnly: true },
  // Media & Entertainment
  'netflix.com':      { category: 'Media & Entertainment', subCategory: 'Video Streaming', onlineOnly: true },
  'hotstar.com':      { category: 'Media & Entertainment', subCategory: 'Video Streaming', onlineOnly: true },
  'primevideo.com':   { category: 'Media & Entertainment', subCategory: 'Video Streaming', onlineOnly: true },
  'spotify.com':      { category: 'Media & Entertainment', subCategory: 'Music Streaming', onlineOnly: true },
  'jiocinema.com':    { category: 'Media & Entertainment', subCategory: 'Video Streaming', onlineOnly: true },
  'sonyliv.com':      { category: 'Media & Entertainment', subCategory: 'Video Streaming', onlineOnly: true },
  'zee5.com':         { category: 'Media & Entertainment', subCategory: 'Video Streaming', onlineOnly: true },
  // More Fashion & Apparel
  'abof.com':         { category: 'Fashion & Apparel', subCategory: 'Multi-Brand Retail', onlineOnly: true },
  'koovs.com':        { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', onlineOnly: true },
  'tatacliq.com':     { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  'firstcry.com':     { category: 'Baby & Kids', subCategory: 'Baby & Kids Marketplace', onlineOnly: true },
  'hopscotch.in':     { category: 'Baby & Kids', subCategory: 'Kids Fashion', onlineOnly: true },
  // More Electronics
  'lg.com':           { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global' },
  'realme.com':       { category: 'Electronics & Tech', subCategory: 'Smartphones', onlineOnly: true },
  'nothing.tech':     { category: 'Electronics & Tech', subCategory: 'Smartphones', onlineOnly: true },
  'asus.com':         { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100+', region: 'Global' },
  // More Beauty
  'purplle.com':      { category: 'Beauty & Personal Care', subCategory: 'Beauty Marketplace', onlineOnly: true },
  'minimalist.co':    { category: 'Beauty & Personal Care', subCategory: 'Skincare', onlineOnly: true },
  'dotandkey.com':    { category: 'Beauty & Personal Care', subCategory: 'Skincare', onlineOnly: true },
  // More Home
  'duroflex.com':     { category: 'Home & Living', subCategory: 'Mattresses & Sleep', stores: '51-100', region: 'India' },
  'centrepiece.in':   { category: 'Home & Living', subCategory: 'Home Decor', onlineOnly: true },
  // Restaurant & Hospitality
  'marriott.com':     { category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'Global' },
  'hilton.com':       { category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'Global' },
  'ihg.com':          { category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'Global' },
  'tajhotels.com':    { category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'India' },
  'oberoihotels.com': { category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '51-100', region: 'India' },
  'itchotels.com':    { category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'India' },
  'hyatt.com':        { category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'Global' },
  'radissonhotels.com':{ category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'Global' },
  // Fitness & Gym
  'goldsgym.com':     { category: 'Fitness & Gym', subCategory: 'Gym & Fitness Center', stores: '100+', region: 'Global' },
  'anytimefitness.com':{ category: 'Fitness & Gym', subCategory: 'Gym & Fitness Center', stores: '100+', region: 'Global' },
  // Professional Services
  'deloitte.com':     { category: 'Professional Services', subCategory: 'Consulting', stores: '100+', region: 'Global' },
  'mckinsey.com':     { category: 'Professional Services', subCategory: 'Consulting', stores: '100+', region: 'Global' },
  'accenture.com':    { category: 'Professional Services', subCategory: 'Consulting', stores: '100+', region: 'Global' },
  'pwc.com':          { category: 'Professional Services', subCategory: 'Accounting & Tax', stores: '100+', region: 'Global' },
  'ey.com':           { category: 'Professional Services', subCategory: 'Accounting & Tax', stores: '100+', region: 'Global' },
  'kpmg.com':         { category: 'Professional Services', subCategory: 'Accounting & Tax', stores: '100+', region: 'Global' },
  'tcs.com':          { category: 'Professional Services', subCategory: 'IT Services', stores: '100+', region: 'Global' },
  'infosys.com':      { category: 'Professional Services', subCategory: 'IT Services', stores: '100+', region: 'Global' },
  'wipro.com':        { category: 'Professional Services', subCategory: 'IT Services', stores: '100+', region: 'Global' },
  'hcltech.com':      { category: 'Professional Services', subCategory: 'IT Services', stores: '100+', region: 'Global' },
  // Banking & Financial Services
  'hdfcbank.com':     { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'icicibank.com':    { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'sbi.co.in':        { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'axisbank.com':     { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'kotak.com':        { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'yesbank.in':       { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'indusind.com':     { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'chase.com':        { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'US' },
  'bankofamerica.com':{ category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'US' },
  'wellsfargo.com':   { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'US' },
  'hsbc.com':         { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'Global' },
  'standardchartered.com':{ category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'Global' },
  // Social Media
  'linkedin.com':     { category: 'Social Media & Platforms', subCategory: 'Social Network', onlineOnly: true },
  'reddit.com':       { category: 'Social Media & Platforms', subCategory: 'Forum & Community', onlineOnly: true },
  'quora.com':        { category: 'Social Media & Platforms', subCategory: 'Forum & Community', onlineOnly: true },
  'discord.com':      { category: 'Social Media & Platforms', subCategory: 'Forum & Community', onlineOnly: true },
  // Gaming
  'epicgames.com':    { category: 'Gaming & Esports', subCategory: 'Game Platform', onlineOnly: true },
  'riotgames.com':    { category: 'Gaming & Esports', subCategory: 'Game Studio', onlineOnly: true },
  'supercell.com':    { category: 'Gaming & Esports', subCategory: 'Mobile Gaming', onlineOnly: true },
  // Betting & Fantasy
  'dream11.com':      { category: 'Betting & Fantasy Sports', subCategory: 'Fantasy Sports', onlineOnly: true },
  'mpl.live':         { category: 'Betting & Fantasy Sports', subCategory: 'Fantasy Sports', onlineOnly: true },
  'my11circle.com':   { category: 'Betting & Fantasy Sports', subCategory: 'Fantasy Sports', onlineOnly: true },
  // Dating & Matchmaking
  'shaadi.com':       { category: 'Dating & Matchmaking', subCategory: 'Matrimony', onlineOnly: true },
  'bharatmatrimony.com':{ category: 'Dating & Matchmaking', subCategory: 'Matrimony', onlineOnly: true },
  'jeevansathi.com':  { category: 'Dating & Matchmaking', subCategory: 'Matrimony', onlineOnly: true },
  // Web Hosting
  'godaddy.com':      { category: 'Web Hosting & Domains', subCategory: 'Domain Services', onlineOnly: true },
  'hostinger.com':    { category: 'Web Hosting & Domains', subCategory: 'Shared Hosting', onlineOnly: true },
  'bluehost.com':     { category: 'Web Hosting & Domains', subCategory: 'Shared Hosting', onlineOnly: true },
  'cloudflare.com':   { category: 'Web Hosting & Domains', subCategory: 'CDN & Performance', onlineOnly: true },
  // Home Services
  'urbancompany.com': { category: 'Home Services', subCategory: 'Repairs & Maintenance', onlineOnly: true },
  'housejoy.in':      { category: 'Home Services', subCategory: 'Cleaning', onlineOnly: true },
  // Construction
  'ultratechcement.com':{ category: 'Construction & Building Materials', subCategory: 'Cement & Concrete', stores: '100+', region: 'India' },
  'jswsteel.in':      { category: 'Construction & Building Materials', subCategory: 'Steel & Metals', stores: '100+', region: 'India' },
  'tatasteel.com':    { category: 'Construction & Building Materials', subCategory: 'Steel & Metals', stores: '100+', region: 'India' },
  'kajaria.com':      { category: 'Construction & Building Materials', subCategory: 'Tiles & Flooring', stores: '100+', region: 'India' },
  'somany.com':       { category: 'Construction & Building Materials', subCategory: 'Tiles & Flooring', stores: '100+', region: 'India' },
  // Classifieds
  'olx.in':           { category: 'Classifieds & Listings', subCategory: 'General Classifieds', onlineOnly: true },
  'quikr.com':        { category: 'Classifieds & Listings', subCategory: 'General Classifieds', onlineOnly: true },
  // Salon
  'lakme.com':        { category: 'Salon & Spa', subCategory: 'Beauty Salon', stores: '100+', region: 'India' },
  'vlccpersonalcare.com':{ category: 'Salon & Spa', subCategory: 'Beauty Salon', stores: '100+', region: 'India' },
  // Coworking
  'wework.com':       { category: 'Coworking & Office Space', subCategory: 'Coworking Space', stores: '100+', region: 'Global' },
  'awfis.com':        { category: 'Coworking & Office Space', subCategory: 'Coworking Space', stores: '100+', region: 'India' },
  '91springboard.com':{ category: 'Coworking & Office Space', subCategory: 'Coworking Space', stores: '51-100', region: 'India' },
  // Rental
  'furlenco.com':     { category: 'Rental & Subscription Services', subCategory: 'Furniture Rental', onlineOnly: true },
  'rentomojo.com':    { category: 'Rental & Subscription Services', subCategory: 'Furniture Rental', onlineOnly: true },
  // ── Bulk known brands (auto-classify without scan) ──────────────────
  // Tech Platforms
  'google.com':       { category: 'SaaS & B2B', subCategory: 'Developer Tools', onlineOnly: true },
  'facebook.com':     { category: 'Social Media & Platforms', subCategory: 'Social Network', onlineOnly: true },
  'soundcloud.com':   { category: 'Media & Entertainment', subCategory: 'Music Streaming', onlineOnly: true },
  'etsy.com':         { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  'mcafee.com':       { category: 'Cybersecurity', subCategory: 'Endpoint Security', onlineOnly: true },
  'zoho.com':         { category: 'SaaS & B2B', subCategory: 'CRM & Sales', onlineOnly: true },
  'zoho.in':          { category: 'SaaS & B2B', subCategory: 'CRM & Sales', onlineOnly: true },
  'webengage.com':    { category: 'SaaS & B2B', subCategory: 'Analytics', onlineOnly: true },
  'invideo.io':       { category: 'SaaS & B2B', subCategory: 'Developer Tools', onlineOnly: true },
  'codechef.com':     { category: 'EdTech', subCategory: 'Coding', onlineOnly: true },
  'splashlearn.com':  { category: 'EdTech', subCategory: 'K-12 & Test Prep', onlineOnly: true },
  // News & Media — India
  'ndtv.com':         { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'ndtv.in':          { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'indiatimes.com':   { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'hindustantimes.com':{ category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'thehindu.com':     { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'livemint.com':     { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'economictimes.com':{ category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'indiatoday.in':    { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'news18.com':       { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'aajtak.in':        { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'jagran.com':       { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'eenadu.net':       { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'business-standard.com':{ category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'financialexpress.com':{ category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'oneindia.com':     { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'abplive.com':      { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'rediff.com':       { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'livehindustan.com':{ category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'amarujala.com':    { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'bhaskar.com':      { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'lokmat.com':       { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'anandabazar.com':  { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'mathrubhumi.com':  { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'dnaindia.com':     { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'wionews.com':      { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'zeenews.com':      { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'dailyhunt.in':     { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  'indiatvnews.com':  { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  // Government — India
  'gst.gov.in':       { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'uidai.gov.in':     { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'eci.gov.in':       { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'epfindia.gov.in':  { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'indianrail.gov.in':{ category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'parivahan.gov.in': { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'incometax.gov.in': { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'india.gov.in':     { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'ewaybillgst.gov.in':{ category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'pmkisan.gov.in':   { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'ssc.gov.in':       { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'indiapost.gov.in': { category: 'Government & Public Sector', subCategory: 'Public Services', onlineOnly: true },
  'nta.nic.in':       { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  'upsc.gov.in':      { category: 'Government & Public Sector', subCategory: 'Central Government', onlineOnly: true },
  // Government — States
  'rajasthan.gov.in': { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  'mp.gov.in':        { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  'karnataka.gov.in': { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  'bihar.gov.in':     { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  'ap.gov.in':        { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  'up.gov.in':        { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  'wb.gov.in':        { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  'assam.gov.in':     { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  'telangana.gov.in': { category: 'Government & Public Sector', subCategory: 'State Government', onlineOnly: true },
  // Banking — more
  'dbs.com':          { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'Global' },
  'npci.org.in':      { category: 'FinTech', subCategory: 'Payments', onlineOnly: true },
  'nseindia.com':     { category: 'FinTech', subCategory: 'Investment', onlineOnly: true },
  'bseindia.com':     { category: 'FinTech', subCategory: 'Investment', onlineOnly: true },
  'icicidirect.com':  { category: 'FinTech', subCategory: 'Investment', onlineOnly: true },
  'licindia.in':      { category: 'Insurance', subCategory: 'Life Insurance', stores: '100+', region: 'India' },
  'rbi.org.in':       { category: 'Banking & Financial Services', subCategory: 'Regulatory', onlineOnly: true },
  'onlinesbi.sbi':    { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'bankofbaroda.co.in':{ category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'canarabank.com':   { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'unionbankonline.co.in':{ category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'indianbank.in':    { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'idfcbank.com':     { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'indusind.com':     { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'bankofindia.co.in':{ category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'centralbankofindia.co.in':{ category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'ucobank.com':      { category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  'southindianbank.com':{ category: 'Banking & Financial Services', subCategory: 'Retail Banking', stores: '100+', region: 'India' },
  // Travel
  'tripadvisor.in':   { category: 'Travel & Ticketing', subCategory: 'Experiences', onlineOnly: true },
  'redbus.in':        { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'redbus.com':       { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'irctc.co.in':      { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'goindigo.in':      { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'airindia.com':     { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'akasaair.com':     { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'finnair.com':      { category: 'Travel & Ticketing', subCategory: 'Travel Booking', stores: '100+', region: 'Global' },
  'bookmyshow.com':   { category: 'Media & Entertainment', subCategory: 'Event Ticketing', onlineOnly: true },
  // Automotive
  'carwale.com':      { category: 'Automotive', subCategory: 'Car Dealership', onlineOnly: true },
  'marutisuzuki.com': { category: 'Automotive', subCategory: 'Car Dealership', stores: '100+', region: 'India' },
  'tatamotors.com':   { category: 'Automotive', subCategory: 'Car Dealership', stores: '100+', region: 'India' },
  'tvsmotor.com':     { category: 'Automotive', subCategory: 'Two Wheeler', stores: '100+', region: 'India' },
  'bajajauto.com':    { category: 'Automotive', subCategory: 'Two Wheeler', stores: '100+', region: 'India' },
  'heromotocorp.com': { category: 'Automotive', subCategory: 'Two Wheeler', stores: '100+', region: 'India' },
  'olaelectric.com':  { category: 'Automotive', subCategory: 'Electric Vehicle', stores: '100+', region: 'India' },
  'atherenergy.com':  { category: 'Automotive', subCategory: 'Electric Vehicle', stores: '51-100', region: 'India' },
  'ashokleyland.com': { category: 'Automotive', subCategory: 'Car Dealership', stores: '100+', region: 'India' },
  // Telecom
  'airtel.in':        { category: 'Telecom', subCategory: 'Mobile', stores: '100+', region: 'India' },
  'airtel.com':       { category: 'Telecom', subCategory: 'Mobile', stores: '100+', region: 'Global' },
  'bsnl.in':          { category: 'Telecom', subCategory: 'Internet', stores: '100+', region: 'India' },
  'bsnl.co.in':       { category: 'Telecom', subCategory: 'Internet', stores: '100+', region: 'India' },
  'dish.com':         { category: 'Telecom', subCategory: 'Internet', stores: '100+', region: 'US' },
  'jio.com':          { category: 'Telecom', subCategory: 'Mobile', stores: '100+', region: 'India' },
  // Ecommerce
  'indiamart.com':    { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  'shopclues.com':    { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  // HR & Jobs
  'naukri.com':       { category: 'HR & Recruitment', subCategory: 'Job Portal', onlineOnly: true },
  'freejobalert.com': { category: 'HR & Recruitment', subCategory: 'Job Portal', onlineOnly: true },
  // Media & Entertainment
  'jiosaavn.com':     { category: 'Media & Entertainment', subCategory: 'Music Streaming', onlineOnly: true },
  'wynk.in':          { category: 'Media & Entertainment', subCategory: 'Music Streaming', onlineOnly: true },
  'discoveryplus.in': { category: 'Media & Entertainment', subCategory: 'Video Streaming', onlineOnly: true },
  'hoichoi.tv':       { category: 'Media & Entertainment', subCategory: 'Video Streaming', onlineOnly: true },
  // Sports & Cricket
  'espncricinfo.com': { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  '91mobiles.com':    { category: 'News & Media', subCategory: 'General', onlineOnly: true },
  // Logistics
  'bluedart.com':     { category: 'Logistics', subCategory: 'Courier & Express', stores: '100+', region: 'India' },
  'dtdc.com':         { category: 'Logistics', subCategory: 'Courier & Express', stores: '100+', region: 'India' },
  'dtdc.in':          { category: 'Logistics', subCategory: 'Courier & Express', stores: '100+', region: 'India' },
  'xpressbees.com':   { category: 'Logistics', subCategory: 'Courier & Express', onlineOnly: true },
  // Energy & PSU
  'indianoil.in':     { category: 'Energy & Utilities', subCategory: 'Oil & Gas', stores: '100+', region: 'India' },
  'iocl.com':         { category: 'Energy & Utilities', subCategory: 'Oil & Gas', stores: '100+', region: 'India' },
  'ongc.co.in':       { category: 'Energy & Utilities', subCategory: 'Oil & Gas', stores: '100+', region: 'India' },
  'ntpc.co.in':       { category: 'Energy & Utilities', subCategory: 'Renewable', stores: '100+', region: 'India' },
  'adanione.com':     { category: 'Energy & Utilities', subCategory: 'Renewable', stores: '100+', region: 'India' },
  // Manufacturing & Infra
  'larsentoubro.com': { category: 'Construction & Building Materials', subCategory: 'Infrastructure', stores: '100+', region: 'India' },
  'tatasteel.com':    { category: 'Construction & Building Materials', subCategory: 'Steel & Metals', stores: '100+', region: 'India' },
  'jswsteel.in':      { category: 'Construction & Building Materials', subCategory: 'Steel & Metals', stores: '100+', region: 'India' },
  'bergerpaints.com': { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'India' },
  // Education — Universities
  'ignou.ac.in':      { category: 'Schools & Universities', subCategory: 'University', onlineOnly: true },
  'du.ac.in':         { category: 'Schools & Universities', subCategory: 'University', onlineOnly: true },
  'iitm.ac.in':       { category: 'Schools & Universities', subCategory: 'Professional Institute', onlineOnly: true },
  'iitkgp.ac.in':     { category: 'Schools & Universities', subCategory: 'Professional Institute', onlineOnly: true },
  'iimb.ac.in':       { category: 'Schools & Universities', subCategory: 'Professional Institute', onlineOnly: true },
  // FinTech
  'coindcx.com':      { category: 'Crypto & Web3', subCategory: 'Exchange', onlineOnly: true },
  'coinswitch.co':    { category: 'Crypto & Web3', subCategory: 'Exchange', onlineOnly: true },
  // Fashion & Apparel (missing ones)
  'victoriassecret.com':{ category: 'Fashion & Apparel', subCategory: 'Lingerie & Innerwear', stores: '100+', region: 'Global' },
  'beyoung.in':       { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'celio.com':        { category: 'Fashion & Apparel', subCategory: 'Men\'s Fashion', stores: '100+', region: 'Global' },
  'jackjones.com':    { category: 'Fashion & Apparel', subCategory: 'Men\'s Fashion', stores: '100+', region: 'Global' },
  'supreme.com':      { category: 'Fashion & Apparel', subCategory: 'Streetwear', stores: '51-100', region: 'Global' },
  'montecarlo.in':    { category: 'Fashion & Apparel', subCategory: 'Casual Wear', stores: '100+', region: 'India' },
  'killerjeans.com':  { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans', stores: '100+', region: 'India' },
  'speedo.com':       { category: 'Fashion & Apparel', subCategory: 'Sportswear', stores: '100+', region: 'Global' },
  'brooksrunning.com':{ category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100+', region: 'Global' },
  'gorillawear.com':  { category: 'Fashion & Apparel', subCategory: 'Sportswear', onlineOnly: true },
  // Food & Beverage
  'amul.in':          { category: 'Food & Beverage', subCategory: 'Specialty Foods', stores: '100+', region: 'India' },
  'iherb.com':        { category: 'Health & Wellness', subCategory: 'General', onlineOnly: true },
  'muscleblaze.com':  { category: 'Health & Wellness', subCategory: 'Fitness Equipment', onlineOnly: true },
  // Home Services
  'sulekha.com':      { category: 'Home Services', subCategory: 'General', onlineOnly: true },
  // Beauty
  'innisfree.com':    { category: 'Beauty & Personal Care', subCategory: 'Skincare', stores: '100+', region: 'Global' },
  // Real Estate
  'makaan.com':       { category: 'Real Estate', subCategory: 'Property Listing', onlineOnly: true },
  // Jewelry
  'malabargoldanddiamonds.com':{ category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'Global' },
  'miabytanishq.com': { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100+', region: 'India' },
  // Wedding
  'weddingwire.in':   { category: 'Wedding & Events', subCategory: 'Wedding Planning', onlineOnly: true },
  // Religious
  'tirumala.org':     { category: 'Religious & Spiritual', subCategory: 'Temple & Shrine', onlineOnly: true },
  'srimandir.com':    { category: 'Religious & Spiritual', subCategory: 'Temple & Shrine', onlineOnly: true },
  'somnath.org':      { category: 'Religious & Spiritual', subCategory: 'Temple & Shrine', onlineOnly: true },
  'brahmakumaris.com':{ category: 'Religious & Spiritual', subCategory: 'Spiritual Center', onlineOnly: true },
  // Betting
  'rummycircle.com':  { category: 'Betting & Fantasy Sports', subCategory: 'Online Casino', onlineOnly: true },
  'a23.com':          { category: 'Betting & Fantasy Sports', subCategory: 'Online Casino', onlineOnly: true },
  // Hotel chains
  'lemontreehotels.com':{ category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'India' },
  'clubmahindra.com': { category: 'Restaurant & Hospitality', subCategory: 'Hotel & Resort', stores: '100+', region: 'India' },
  // Salon
  'greatclips.com':   { category: 'Salon & Spa', subCategory: 'Hair Salon', stores: '100+', region: 'US' },
  // Professional Services
  'ltimindtree.com':  { category: 'Professional Services', subCategory: 'IT Services', stores: '100+', region: 'Global' },
  // Watches
  'ethoswatches.com': { category: 'Fashion & Apparel', subCategory: 'Watches', stores: '51-100', region: 'India' },
  'timexindia.com':   { category: 'Fashion & Apparel', subCategory: 'Watches', stores: '100+', region: 'India' },
  'sonatawatches.in': { category: 'Fashion & Apparel', subCategory: 'Watches', stores: '100+', region: 'India' },
  'helioswatchstore.com':{ category: 'Fashion & Apparel', subCategory: 'Watches', stores: '51-100', region: 'India' },
  // Coworking
  'stanzaliving.com': { category: 'Coworking & Office Space', subCategory: 'Managed Office', stores: '100+', region: 'India' },
  // Water & Purifier
  'pureitwater.com':  { category: 'Home & Living', subCategory: 'Smart Home', stores: '100+', region: 'India' },
  // Electronics
  'samsungmobile.com':{ category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global' },
  'poco.in':          { category: 'Electronics & Tech', subCategory: 'Smartphones', onlineOnly: true },
  'haier.com':        { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global' },
  'harmankardon.com': { category: 'Electronics & Tech', subCategory: 'Audio', stores: '100+', region: 'Global' },
  // Paint
  'indigopaints.com': { category: 'Home & Living', subCategory: 'Hardware Store', stores: '100+', region: 'India' },
};

const JSONLD_TYPE_TO_INDUSTRY = {
  clothingstore:   'Fashion & Apparel',
  shoestore:       'Fashion & Apparel',
  jewelrystore:    'Jewelry',
  beautystore:     'Beauty & Personal Care',
  beautysalon:     'Salon & Spa',
  cosmeticsstore:  'Beauty & Personal Care',
  restaurant:      'Restaurant & Hospitality',
  cafe:            'Restaurant & Hospitality',
  bakery:          'Restaurant & Hospitality',
  barorgrill:      'Restaurant & Hospitality',
  foodestablishment: 'Restaurant & Hospitality',
  grocerystore:    'Grocery & Supermarket',
  electronicsstore:'Electronics & Tech',
  computerstore:   'Electronics & Tech',
  mobilephone:     'Electronics & Tech',
  furniturestore:  'Home & Living',
  homedecorstore:  'Home & Living',
  hardwarestore:   'Home & Living',
  sportinggoods:   'Sports & Outdoor',
  sportsgoodsstore:'Sports & Outdoor',
  toystore:        'Baby & Kids',
  petstore:        'Pet Products',
  pharmacy:        'Pharmacy & Optical',
  optician:        'Pharmacy & Optical',
  medicalclinic:   'Health & Wellness Services',
  hospital:        'Health & Wellness Services',
  dentist:         'Health & Wellness Services',
  physician:       'Health & Wellness Services',
  educationalorganization: 'EdTech',
  school:          'Schools & Universities',
  university:      'Schools & Universities',
  financialservice:'FinTech',
  bankorcreditunion:'Banking & Financial Services',
  insuranceagency: 'Insurance',
  travelagency:    'Travel & Ticketing',
  hotel:           'Restaurant & Hospitality',
  airline:         'Travel & Ticketing',
  lodgingbusiness: 'Restaurant & Hospitality',
  realestateagent: 'Real Estate',
  realestateagency:'Real Estate',
  autodealer:      'Automotive',
  autorepair:      'Automotive',
  cardealership:   'Automotive',
  motorizedvehicledealer: 'Automotive',
  gasstation:      'Automotive',
  lawfirm:         'Legal',
  attorney:        'Legal',
  legalservice:    'Legal',
  employmentagency:'HR & Recruitment',
  fitnessclub:     'Fitness & Gym',
  gym:             'Fitness & Gym',
  healthclub:      'Fitness & Gym',
  softwareapplication: 'Ecommerce/Retail',
  webpage:         'News & Media',
  newsarticle:     'News & Media',
  blog:            'News & Media',
  store:           'Ecommerce/Retail',
  onlinestore:     'Ecommerce/Retail',
  product:         'Ecommerce/Retail',
  bookstore:         'Office & Stationery',
  libraryorsomething: 'Office & Stationery',
  movietheater:      'Media & Entertainment',
  entertainmentbusiness: 'Media & Entertainment',
  sportsactivitylocation: 'Fitness & Gym',
  exercisegym:       'Fitness & Gym',
  governmentoffice:  'Government & Public Sector',
  governmentorganization: 'Government & Public Sector',
  barber:            'Salon & Spa',
  hairdresser:       'Salon & Spa',
  dayspa:            'Salon & Spa',
  nailsalon:         'Salon & Spa',
  tattooparlor:      'Salon & Spa',
  highschool:        'Schools & Universities',
  elementaryschool:  'Schools & Universities',
  college:           'Schools & Universities',
  nightclub:         'Alcohol & Tobacco',
  winery:            'Alcohol & Tobacco',
  brewery:           'Alcohol & Tobacco',
  distillery:        'Alcohol & Tobacco',
};

// Generic JSON-LD types that should NOT override keyword-based category detection
const GENERIC_JSONLD_TYPES = new Set(['store', 'onlinestore', 'product', 'webpage', 'website']);

function extractJsonLd(html) {
  const results = { category: null, genericCategory: null, region: null, state: null, city: null, storeHint: 0, addressItems: [] };
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
            if (a.addressRegion && !results.state) {
              results.state = a.addressRegion.toString().trim();
            }
            if (a.addressLocality && !results.city) {
              results.city = a.addressLocality.toString().trim();
            }
            results.addressItems.push(a);
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
  const results = { category: null, region: null, ogTitle: '', ogDescription: '', ogSiteName: '', metaCategory: '' };

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

  // Extract og:title, og:description, og:site_name for keyword analysis
  results.ogTitle = extractOgContent(html, 'og:title') || metaMap['og:title'] || '';
  results.ogDescription = extractOgContent(html, 'og:description') || metaMap['og:description'] || '';
  results.ogSiteName = extractOgContent(html, 'og:site_name') || metaMap['og:site_name'] || '';

  // Direct category/classification meta tags (some sites explicitly declare)
  results.metaCategory = (
    metaMap['category'] || metaMap['classification'] || metaMap['industry'] ||
    metaMap['business:type'] || metaMap['business.type'] ||
    metaMap['subject'] || metaMap['topic'] || ''
  );

  // Twitter card description as fallback
  if (!results.ogDescription) {
    results.ogDescription = metaMap['twitter:description'] || '';
  }

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
  'Fashion & Apparel': ['fashion', 'clothing', 'apparel', 'outfit', 'garment', 'kurta', 'ethnic wear', 'wardrobe', 't-shirt', 'tshirt', 'jeans', 'trouser', 'hoodie', 'jacket', 'designer t-shirt', 'jogger', 'sweatshirt', 'blazer', 'menswear', 'womenswear', 'blouse', 'sweater', 'cardigan', 'skirt', 'legging', 'activewear', 'loungewear', 'sleepwear', 'pajama', 'swimwear', 'bikini', 'underwear', 'lingerie', 'shapewear', 'bra', 'saree', 'sarees', 'sari', 'lehenga', 'salwar', 'dupatta', 'anarkali', 'kurti', 'sherwani', 'dhoti', 'palazzo', 'churidar', 'bandhani', 'patola', 'georgette', 'chiffon', 'designer saree', 'shoe', 'shoes', 'footwear', 'sneaker', 'sneakers', 'sandal', 'sandals', 'slipper', 'slippers', 'heel', 'heels', 'boot', 'boots', 'loafer', 'loafers', 'moccasin', 'flip flop', 'flip flops', 'stiletto', 'wedge', 'platform shoe', 'oxford shoe', 'brogue', 'espadrille', 'clog', 'mule', 'pumps', 'flats', 'running shoes', 'athletic shoes', 'dress shoes', 'handbag', 'backpack', 'tote bag', 'crossbody', 'clutch', 'duffel bag', 'luggage', 'luxury watch', 'fashion watch', 'analog watch', 'dress watch', 'wristwatch', 'sunglasses', 'eyewear', 'eyeglasses', 'spectacles', 'optical', 'contact lens', 'blue light glasses', 'fashion belt', 'leather belt', 'suspender', 'beanie', 'fedora', 'bucket hat', 'scarf', 'bandana', 'fashion glove', 'mitten', 'hair accessories', 'scrunchie', 'headband', 'phone case', 'wallet', 'cardholder', 'socks', 'hosiery'],
  'Jewelry':           ['jewellery', 'jewelry', 'diamond ring', 'gold jewel', 'necklace', 'bracelet', 'silver jewel', 'pendant', 'earring', 'gold chain', 'mangalsutra', 'karat', 'gold ring', 'silver ring', 'anklet', 'bangle', 'cuff link', 'stud earring', 'hoop earring', 'fine jewelry', 'costume jewelry', 'engagement ring', 'wedding band', 'birthstone', 'charm bracelet', 'sterling silver', 'solitaire', 'gemstone', 'jeweller', 'jewelers'],
  'Beauty & Personal Care': ['beauty', 'skincare', 'skin care', 'cosmetic', 'makeup', 'hair care', 'fragrance', 'perfume', 'face wash', 'shampoo', 'conditioner', 'moisturizer', 'sunscreen', 'foundation', 'mascara', 'lipstick', 'body lotion', 'face serum', 'face cream', 'cleanser', 'toner', 'exfoliant', 'eyeshadow', 'blush', 'bronzer', 'concealer', 'cologne', 'body spray', 'beard oil', 'shaving cream', 'aftershave', 'body wash', 'soap', 'bath bomb', 'deodorant', 'nail polish', 'cruelty-free', 'clean beauty', 'vegan beauty'],
  'Food & Beverage':   ['beverage', 'snack', 'chocolate', 'bakery', 'meal kit', 'grocery', 'supermarket', 'protein bar', 'jerky', 'coffee beans', 'tea leaves', 'matcha', 'wine shop', 'winery', 'vineyard', 'craft beer', 'brewery', 'distillery', 'spirits brand', 'cocktail', 'supplement', 'vitamins', 'protein powder', 'collagen', 'probiotics', 'organic food', 'vegan food', 'gluten-free', 'keto', 'kombucha', 'energy drink', 'sparkling water', 'condiment', 'spices', 'sauce', 'nut butter', 'nutrition facts', 'non-gmo'],
  'Home & Living':     ['furniture', 'home decor', 'interior design', 'mattress', 'bedding', 'home furnishing', 'sofa set', 'curtain', 'area rug', 'cushion cover', 'table lamp', 'wall art', 'throw pillow', 'candle', 'mirror', 'vase', 'lighting', 'sheet', 'duvet', 'comforter', 'towel', 'bathrobe', 'cookware', 'dinnerware', 'cutlery', 'small appliance', 'smart home', 'smart speaker', 'thermostat', 'security camera', 'cleaning product', 'detergent', 'weighted blanket', 'sleep trial', 'hardware', 'tools', 'tool store', 'tool shop', 'power tools', 'hand tools', 'drill', 'saw', 'grinder', 'welder', 'compressor', 'generator', 'plumbing', 'timber', 'lumber', 'paint', 'building materials', 'home improvement', 'homebase', 'homeware', 'homewares', 'diy', 'renovation', 'landscaping', 'garden', 'gardening', 'fencing', 'roofing', 'flooring', 'bathroom', 'kitchen renovation', 'trade tools', 'industrial tools', 'workshop', 'workbench', 'wallpaper', 'shelving', 'storage', 'outdoor furniture', 'bbq', 'patio', 'shed', 'greenhouse', 'lawn mower', 'pressure washer'],
  'Health & Wellness': ['fitness', 'gym equipment', 'workout', 'yoga mat', 'exercise', 'treadmill', 'dumbbell', 'kettlebell', 'resistance band', 'exercise bike', 'sexual wellness', 'intimacy', 'aromatherapy', 'essential oil', 'meditation', 'self-care', 'blood pressure monitor', 'thermometer', 'first aid', 'compression wear', 'massage tool', 'foam roller', 'recovery', 'wellness product', 'supplement', 'protein powder'],
  'Baby & Kids':       ['kids wear', 'baby care', 'children', 'toys', 'newborn', 'toddler', 'infant', 'baby clothes', 'nursery', 'diaper', 'stroller', 'baby monitor', 'car seat', 'pacifier', 'bottle', 'educational toy', 'puzzle', 'board game', 'action figure', 'doll', 'kids furniture', 'crib', 'toddler bed', 'baby skincare', 'learning kit', 'bpa-free', 'non-toxic', 'choking hazard'],
  'Pet Products':      ['pet food', 'dog food', 'cat food', 'veterinary', 'pet care', 'pet supplies', 'dog treat', 'cat litter', 'pet grooming', 'pet collar', 'leash', 'pet bed', 'pet crate', 'pet toy', 'flea treatment', 'pet dental', 'cat tree', 'scratching post', 'pet clothing', 'vet recommended'],
  'Electronics & Tech': ['electronics', 'gadget', 'smartphone', 'laptop', 'tech accessories', 'earbuds', 'headphone', 'smartwatch', 'charger', 'power bank', 'tablet', 'monitor', 'camera', 'drone', 'fitness tracker', 'smart ring', 'vr headset', 'speaker', 'soundbar', 'microphone', 'gaming console', 'gaming keyboard', 'gaming mouse', 'controller', 'gaming chair', 'webcam', 'bluetooth', 'usb-c', 'wireless'],
  'Sports & Outdoor': ['camping', 'hiking', 'tent', 'sleeping bag', 'camp stove', 'cooler', 'bicycle', 'skateboard', 'surfboard', 'paddleboard', 'fishing gear', 'golf club', 'grill', 'bbq', 'gardening tool', 'outdoor lighting', 'hammock', 'sports equipment', 'sporting goods', 'sportswear', 'sports wear', 'cricket bat', 'badminton', 'fitness gear', 'sports gear', 'cycling', 'outdoor sports', 'team sports', 'sports store', 'sports shop', 'waterproof', 'weather-resistant'],
  'Office & Stationery': ['stationery', 'notebook', 'ballpoint pen', 'fountain pen', 'diary', 'planner', 'art supplies', 'craft supplies', 'school supplies', 'journal', 'calendar', 'marker', 'highlighter', 'desk organizer', 'file storage', 'desk accessories', 'ergonomic', 'business card', 'stationery set'],
  // Level 3: Service Categories
  'EdTech':            ['education', 'online learning', 'online course', 'university', 'college', 'tuition', 'coaching class', 'edtech', 'classroom', 'curriculum', 'student portal', 'language learning', 'skill development', 'coding bootcamp', 'programming course', 'test prep', 'tutoring', 'learn at your own pace', 'certificate', 'ncert', 'cbse', 'icse', 'jee', 'neet', 'study material', 'question bank', 'sample paper', 'mock test', 'syllabus', 'exam preparation', 'board exam', 'competitive exam', 'entrance exam', 'physics wallah', 'lecture', 'textbook', 'workbook', 'practice question', 'solved example', 'chapter wise', 'subject wise', 'class 10', 'class 12', 'academic', 'school book', 'oswaal', 'revision', 'previous year'],
  'FinTech':           ['finance', 'banking', 'investment', 'mutual fund', 'fintech', 'credit card', 'demat', 'stock market', 'trading platform', 'digital wallet', 'p2p payment', 'buy now pay later', 'robo-advisor', 'cryptocurrency', 'credit monitoring', 'budgeting app', 'expense tracking', 'fdic insured', 'apy'],
  'Health & Wellness Services': ['healthcare', 'medical', 'pharma', 'hospital', 'ayurved', 'diagnostic', 'medicine', 'doctor', 'clinic', 'patient', 'prescription', 'telemedicine', 'virtual doctor', 'online prescription', 'therapy app', 'counseling', 'mental health app', 'fitness app', 'workout app', 'yoga app', 'meditation app', 'meal planning', 'calorie tracking', 'hipaa'],
  'Telecom':           ['mobile plan', 'phone plan', 'internet service', 'mvno', '5g service', 'data plan', 'unlimited data', 'coverage map', 'no contract', 'prepaid plan', 'postpaid plan', 'home internet', 'broadband', 'telecom'],
  'Media & Entertainment': ['video streaming', 'streaming service', 'original series', 'live tv', 'sports streaming', 'cable replacement', 'stream movies', 'tv shows', 'original content', 'exclusive shows', 'simultaneous streams', 'download for offline', 'ott platform', 'music streaming', 'podcast platform', 'radio streaming', 'audiobook', 'ad-free listening', 'offline download', 'lossless audio', 'spatial audio', 'millions of songs', 'on-demand music', 'cloud gaming', 'game streaming', 'game subscription', 'game library', 'game pass', 'mobile gaming', 'day-one release', 'exclusive titles', 'gaming platform', 'entertainment', 'movies', 'web series', 'original movies'],
  'News & Media':      ['news', 'magazine', 'publishing house', 'editorial', 'journalism', 'newspaper', 'press release', 'media house', 'broadcast', 'news subscription', 'digital magazine', 'newsletter platform', 'premium newsletter', 'e-reading', 'kindle unlimited', 'paywall', 'ad-free reading', 'archive access'],
  'Insurance':         ['insurance', 'health insurance', 'life insurance', 'auto insurance', 'home insurance', 'renters insurance', 'pet insurance', 'travel insurance', 'instant quote', 'get covered', 'coverage amount', 'premium', 'deductible', 'policy'],
  'Travel & Ticketing': ['travel agency', 'travel booking', 'tourism', 'flight booking', 'hotel booking', 'tour package', 'vacation package', 'resort booking', 'airline', 'itinerary', 'flight', 'hotel', 'travel', 'holiday package', 'bus booking', 'train booking', 'cab booking', 'event ticketing', 'concert ticket', 'experience booking', 'vacation rental', 'best price guarantee', 'instant confirmation'],
  'Transportation & Mobility': ['ride-sharing', 'car rental', 'car-sharing', 'bike-sharing', 'scooter-sharing', 'ev charging', 'parking subscription', 'ride credits', 'unlimited rides', 'save on every ride', 'priority access'],
  'Ecommerce/Retail':  ['ecommerce', 'e-commerce', 'online store', 'shop online', 'add to cart', 'marketplace', 'online shopping', 'buy online', 'best deals', 'online marketplace', 'multi-brand', 'seller', 'cash on delivery', 'free delivery'],
  // Level 4: Extended Categories
  'Automotive':       ['car dealership', 'used cars', 'new cars', 'auto parts', 'car accessories', 'automobile', 'automotive', 'vehicle', 'motorcycle', 'scooter', 'electric vehicle', 'ev charging', 'car rental', 'car service', 'car wash', 'tire', 'tyre', 'engine oil', 'car insurance', 'test drive', 'showroom', 'auto repair', 'spare parts', 'car dealer', 'bike dealer', 'two wheeler', 'four wheeler'],
  'Real Estate':      ['real estate', 'property', 'apartment', 'villa', 'flat', 'plot', 'land', 'housing', 'builder', 'developer', 'construction', 'residential', 'commercial property', 'rent apartment', 'buy apartment', 'real estate agent', 'broker', 'mortgage', 'home loan', 'property listing', 'bhk', 'penthouse', 'township', 'gated community', 'ready to move', 'under construction', 'rera', 'proptech'],
  'SaaS & B2B':       ['saas', 'software as a service', 'b2b software', 'enterprise software', 'cloud software', 'crm software', 'erp software', 'project management', 'workflow automation', 'business intelligence', 'data analytics platform', 'api platform', 'developer tools', 'devops', 'collaboration tool', 'team management', 'hr software', 'payroll software', 'accounting software', 'invoicing', 'helpdesk software', 'ticketing system', 'no-code', 'low-code'],
  'Agriculture':      ['agriculture', 'farming', 'agritech', 'crop', 'fertilizer', 'pesticide', 'seeds', 'irrigation', 'tractor', 'farm equipment', 'dairy farm', 'poultry', 'livestock', 'organic farming', 'hydroponics', 'agri input', 'soil health', 'harvest', 'cold storage', 'grain', 'mandi'],
  'Manufacturing':    ['manufacturing', 'factory', 'industrial', 'machinery', 'heavy equipment', 'steel', 'cement', 'chemical', 'textile mill', 'production line', 'assembly', 'cnc', 'lathe', 'fabrication', 'welding', 'injection molding', 'casting', 'forging', 'oem', 'odm', 'iso certified', 'quality control'],
  'Logistics':        ['logistics', 'supply chain', 'freight', 'shipping company', 'courier', 'warehousing', 'cold chain', 'last mile delivery', 'fleet management', 'cargo', 'trucking', 'express delivery', 'parcel', 'tracking', 'fulfillment center', '3pl', 'fourth party logistics', 'cross docking'],
  'Legal':            ['law firm', 'legal services', 'attorney', 'lawyer', 'advocate', 'legal advice', 'litigation', 'corporate law', 'intellectual property', 'trademark', 'patent', 'legal tech', 'contract management', 'legal document', 'court', 'arbitration', 'compliance', 'regulatory'],
  'HR & Recruitment':  ['recruitment', 'hiring', 'job portal', 'job board', 'staffing', 'human resources', 'talent acquisition', 'resume', 'interview', 'onboarding', 'employee engagement', 'hr tech', 'payroll', 'workforce management', 'applicant tracking', 'job listing', 'career page', 'headhunter'],
  'Energy & Utilities': ['solar energy', 'solar panel', 'renewable energy', 'wind energy', 'electricity', 'power generation', 'energy storage', 'battery', 'ev battery', 'oil and gas', 'natural gas', 'petroleum', 'utility', 'smart grid', 'energy efficiency', 'carbon neutral', 'clean energy', 'green energy', 'hydropower'],
  'Art & Collectibles': ['art gallery', 'fine art', 'painting', 'sculpture', 'art print', 'canvas', 'collectible', 'antique', 'vintage', 'auction', 'art collection', 'limited edition', 'nft', 'digital art', 'art dealer', 'contemporary art', 'abstract art', 'photography prints', 'art marketplace'],
  'Wedding & Events':  ['wedding planner', 'wedding venue', 'event management', 'wedding dress', 'bridal', 'groom wear', 'wedding invitation', 'wedding decoration', 'catering', 'florist', 'wedding photographer', 'event planner', 'banquet', 'party supplies', 'wedding registry', 'honeymoon', 'wedding cake'],
  'Printing & Packaging': ['printing service', 'custom printing', 'packaging', 'label printing', 'business cards', 'banner', 'signage', 'flex printing', 'digital printing', 'offset printing', 'corrugated box', 'packaging design', 'branded packaging', 'sticker printing', 'brochure printing', 'merchandise printing'],
  'Pharmacy & Optical': ['pharmacy', 'chemist', 'drugstore', 'prescription', 'otc medicine', 'online pharmacy', 'medical store', 'optical store', 'contact lenses', 'prescription glasses', 'eye exam', 'lens', 'spectacle', 'reading glasses', 'eye care', 'vision care'],
  'FMCG':             ['fmcg', 'consumer goods', 'fast moving consumer goods', 'household products', 'personal care products', 'packaged goods', 'daily essentials', 'consumer packaged goods', 'cpg', 'toiletries', 'household cleaning'],
  'Crypto & Web3':     ['cryptocurrency', 'blockchain', 'bitcoin', 'ethereum', 'defi', 'decentralized', 'web3', 'nft marketplace', 'crypto exchange', 'crypto wallet', 'smart contract', 'token', 'dao', 'metaverse', 'staking', 'yield farming', 'dex'],
  'Cloud & DevTools':  ['cloud computing', 'cloud hosting', 'cloud platform', 'infrastructure as a service', 'platform as a service', 'containerization', 'kubernetes', 'docker', 'ci cd', 'continuous integration', 'continuous deployment', 'serverless', 'microservices', 'api management', 'developer platform', 'code hosting', 'version control'],
  'Cybersecurity':     ['cybersecurity', 'information security', 'endpoint security', 'firewall', 'intrusion detection', 'penetration testing', 'vulnerability', 'threat intelligence', 'soc', 'siem', 'zero trust', 'data protection', 'encryption', 'identity management', 'access control', 'malware protection', 'ransomware', 'ddos protection'],
  'Grocery & Supermarket': ['grocery', 'supermarket', 'hypermarket', 'wholesale', 'fresh produce', 'daily essentials', 'pantry', 'frozen food', 'dairy', 'bakery items', 'meat and seafood', 'organic grocery', 'farm fresh', 'weekly basket', 'household essentials', 'bulk buying', 'grocery delivery', 'online grocery', 'quick commerce', 'instant delivery', 'grocery store'],
  'Professional Services': ['consulting', 'consultancy', 'advisory', 'management consulting', 'strategy consulting', 'marketing agency', 'digital agency', 'creative agency', 'advertising agency', 'design agency', 'web agency', 'branding agency', 'pr agency', 'public relations', 'accounting firm', 'chartered accountant', 'tax consultant', 'audit firm', 'bookkeeping', 'cpa firm', 'architecture firm', 'architect', 'interior designer', 'engineering consultancy', 'it consulting', 'staffing agency', 'outsourcing', 'bpo', 'kpo', 'call center', 'translation service', 'interpreting', 'market research', 'data entry', 'virtual assistant'],
  'NGO & Non-Profit': ['ngo', 'non-profit', 'nonprofit', 'charity', 'foundation', 'donation', 'donate', 'philanthropy', 'social impact', 'humanitarian', 'volunteer', 'volunteering', 'cause', 'welfare', 'community service', 'relief fund', 'trust', 'charitable trust', 'social enterprise', 'sustainable development', 'advocacy', 'awareness campaign', 'fundraising', 'crowdfunding for cause', 'underprivileged', 'marginalized', 'empowerment'],
  'Restaurant & Hospitality': ['restaurant', 'cafe', 'bistro', 'diner', 'eatery', 'food court', 'fine dining', 'casual dining', 'fast food', 'takeaway', 'takeout', 'dine-in', 'buffet', 'catering service', 'cloud kitchen', 'ghost kitchen', 'hotel', 'resort', 'boutique hotel', 'motel', 'hostel', 'bed and breakfast', 'lodge', 'guest house', 'hospitality', 'banquet hall', 'convention center', 'spa resort', 'beach resort', 'heritage hotel', 'homestay', 'serviced apartment'],
  'Fitness & Gym': ['gym', 'gymnasium', 'fitness center', 'fitness studio', 'yoga studio', 'pilates', 'crossfit', 'personal training', 'personal trainer', 'martial arts', 'boxing gym', 'swimming pool', 'fitness membership', 'workout studio', 'spin class', 'zumba', 'aerobics', 'strength training', 'bodybuilding', 'fitness club', 'health club', 'sports club'],
  'Banking & Financial Services': ['bank', 'banking', 'savings account', 'current account', 'fixed deposit', 'recurring deposit', 'net banking', 'internet banking', 'mobile banking', 'branch', 'atm', 'locker', 'home loan', 'personal loan', 'car loan', 'education loan', 'credit card', 'debit card', 'nri banking', 'wealth management', 'private banking', 'corporate banking', 'treasury', 'forex', 'remittance', 'trade finance', 'letter of credit', 'bank account', 'ifsc', 'micr', 'swift code', 'passbook', 'cheque book', 'demand draft', 'rtgs', 'neft', 'imps'],
  'Government & Public Sector': ['government', 'govt', 'municipal', 'corporation', 'ministry', 'department of', 'public sector', 'psu', 'statutory body', 'regulatory', 'commission', 'authority', 'bureau', 'directorate', 'secretariat', 'e-governance', 'citizen service', 'public service', 'tender', 'procurement', 'gazette', 'legislation', 'parliament', 'lok sabha', 'rajya sabha', 'state government', 'central government', 'district administration'],
  'Social Media & Platforms': ['social network', 'social media', 'connect with friends', 'follow', 'followers', 'feed', 'timeline', 'stories', 'reels', 'short video', 'live stream', 'community platform', 'forum', 'discussion board', 'q&a platform', 'user generated content', 'content creator', 'influencer platform', 'creator economy', 'social sharing'],
  'Gaming & Esports': ['video game', 'game studio', 'game developer', 'game publisher', 'esports', 'esport', 'competitive gaming', 'tournament', 'multiplayer', 'battle royale', 'mmorpg', 'fps game', 'rpg game', 'indie game', 'steam', 'game download', 'play store game', 'console game', 'pc game', 'mobile game developer', 'game engine', 'unity game', 'unreal engine'],
  'Betting & Fantasy Sports': ['fantasy sports', 'fantasy cricket', 'fantasy football', 'dream team', 'betting', 'odds', 'sportsbook', 'wagering', 'online casino', 'poker', 'rummy', 'card game', 'real money gaming', 'skill gaming', 'daily fantasy', 'prediction', 'jackpot', 'slot', 'live casino', 'sports betting', 'horse racing', 'lottery'],
  'Dating & Matchmaking': ['dating', 'matchmaking', 'matrimony', 'matrimonial', 'life partner', 'soul mate', 'find your match', 'singles', 'relationship', 'compatibility', 'swipe', 'dating app', 'online dating', 'speed dating', 'shaadi', 'vivah', 'rishta', 'biodata', 'horoscope matching', 'bride', 'groom', 'wedding match'],
  'Web Hosting & Domains': ['web hosting', 'domain registration', 'domain name', 'shared hosting', 'vps hosting', 'dedicated server', 'cloud hosting', 'ssl certificate', 'website builder', 'cpanel', 'whm', 'dns', 'nameserver', 'domain transfer', 'domain renewal', 'reseller hosting', 'managed hosting', 'wordpress hosting', 'email hosting', 'colocation', 'cdn', 'content delivery network', 'uptime guarantee'],
  'Home Services': ['home services', 'home cleaning', 'deep cleaning', 'plumber', 'electrician', 'carpenter', 'painter', 'pest control', 'ac repair', 'ac service', 'appliance repair', 'handyman', 'home maintenance', 'water purifier service', 'chimney cleaning', 'bathroom cleaning', 'sofa cleaning', 'carpet cleaning', 'moving service', 'packers and movers', 'relocation', 'interior painting', 'waterproofing', 'home renovation'],
  'Security & Surveillance': ['cctv', 'security camera', 'surveillance', 'ip camera', 'nvr', 'dvr', 'access control', 'biometric', 'face recognition', 'intrusion alarm', 'motion sensor', 'video door phone', 'intercom', 'security guard', 'guarding service', 'security system', 'home security', 'office security', 'fire alarm', 'smoke detector', 'burglar alarm', 'perimeter security', 'body camera'],
  'Construction & Building Materials': ['construction', 'cement', 'concrete', 'steel bars', 'tmt bars', 'rebar', 'bricks', 'tiles', 'marble', 'granite', 'sand', 'aggregate', 'ready mix concrete', 'roofing sheet', 'structural steel', 'scaffolding', 'formwork', 'precast', 'waterproofing material', 'adhesive', 'grout', 'putty', 'primer', 'construction chemical', 'building material', 'civil engineering', 'infrastructure', 'road construction', 'bridge construction'],
  'Alcohol & Tobacco': ['whisky', 'whiskey', 'vodka', 'rum', 'gin', 'tequila', 'brandy', 'wine', 'beer', 'craft beer', 'brewery', 'distillery', 'single malt', 'blended scotch', 'bourbon', 'champagne', 'prosecco', 'liquor', 'spirits', 'cocktail', 'bar', 'pub', 'lounge', 'tobacco', 'cigarette', 'cigar', 'hookah', 'vape', 'e-cigarette', 'nicotine', 'smoking', 'bottle shop', 'liquor store', 'wine store', 'wine cellar', 'cellar door', 'alcohol delivery', 'drink delivery', 'liquor delivery', 'beer store', 'off licence', 'bottle-o', 'dan murphy', 'bws', 'total wine', 'drizly', 'minibar', 'lcbo', 'abc store', 'package store', 'alcohol online', 'buy wine', 'buy beer', 'buy spirits', 'alcohol shop', 'liquor shop', 'saq', 'vintages', 'bottle king', 'bevmo', 'spec\'s'],
  'Religious & Spiritual': ['temple', 'church', 'mosque', 'gurudwara', 'monastery', 'ashram', 'spiritual', 'meditation', 'prayer', 'worship', 'devotion', 'pilgrimage', 'religious', 'scripture', 'holy', 'sacred', 'puja', 'pooja', 'havan', 'darshan', 'prasad', 'religious book', 'spiritual guru', 'yoga ashram', 'retreat center', 'dharma', 'karma', 'mantra', 'bhajan', 'kirtan'],
  'Classifieds & Listings': ['classifieds', 'buy and sell', 'second hand', 'used items', 'pre-owned', 'local listing', 'post ad', 'free listing', 'sell online', 'nearby deals', 'local marketplace', 'garage sale', 'flea market', 'auction', 'bidding', 'community marketplace', 'want ads', 'for sale by owner'],
  'Salon & Spa': ['salon', 'beauty salon', 'hair salon', 'barber', 'barbershop', 'spa', 'massage', 'facial', 'manicure', 'pedicure', 'hair styling', 'hair coloring', 'keratin treatment', 'bridal makeup', 'makeup artist', 'nail art', 'nail salon', 'waxing', 'threading', 'laser hair removal', 'tattoo', 'piercing', 'medspa', 'aesthetic clinic', 'skin clinic', 'dermatologist', 'hair transplant'],
  'Schools & Universities': ['school admission', 'school education', 'primary school', 'secondary school', 'high school', 'international school', 'boarding school', 'day school', 'montessori', 'play school', 'preschool', 'university admission', 'college admission', 'undergraduate', 'postgraduate', 'phd program', 'campus', 'faculty', 'dean', 'vice chancellor', 'convocation', 'semester', 'accredited', 'naac', 'ugc approved', 'aicte approved', 'affiliated university', 'deemed university', 'iit', 'iim', 'nit', 'iisc'],
  'Coworking & Office Space': ['coworking', 'co-working', 'shared office', 'flexible workspace', 'hot desk', 'dedicated desk', 'private office', 'meeting room', 'conference room', 'virtual office', 'business center', 'startup space', 'incubator', 'accelerator', 'innovation hub', 'maker space', 'community workspace', 'day pass', 'monthly membership'],
  'Rental & Subscription Services': ['rent', 'rental', 'subscribe', 'subscription box', 'monthly subscription', 'rent furniture', 'rent electronics', 'rent appliance', 'car subscription', 'bike rental', 'equipment rental', 'costume rental', 'dress rental', 'fashion rental', 'toy rental', 'book rental', 'rent to own', 'lease', 'pay per use', 'sharing economy', 'access over ownership'],
};

const SUB_INDUSTRY_KEYWORDS = {
  'Fashion & Apparel': {
    'Shoes & Sneakers':   ['sneaker', 'sneakers', 'running shoe', 'athletic shoe', 'basketball shoe', 'trainer', 'trainers', 'just do it', 'air max', 'air jordan', 'ultraboost', 'shoe', 'shoes', 'footwear'],
    'Sportswear':         ['sportswear', 'sports wear', 'activewear', 'athleisure', 'gym wear', 'workout clothes', 'yoga pants', 'sports bra', 'athletic', 'performance wear', 'training gear', 'running gear'],
    'Fast Fashion':       ['fast fashion', 'new arrivals weekly', 'trend', 'latest fashion', 'new collection every week', 'affordable fashion'],
    'Luxury Fashion':     ['luxury', 'haute couture', 'designer', 'maison', 'atelier', 'couture', 'premium collection', 'handcrafted leather', 'made in italy', 'made in france'],
    'Premium Fashion':    ['premium', 'contemporary fashion', 'modern classic', 'elevated basics', 'refined style'],
    'Casual Wear':        ['casual wear', 'everyday wear', 'basic', 'essential', 'daily wear', 'relaxed fit'],
    'Denim & Jeans':      ['denim', 'jeans', 'jean', '501', 'selvedge', 'raw denim', 'indigo'],
    'Ethnic Wear':        ['ethnic wear', 'ethnic fashion', 'kurta', 'kurti', 'saree', 'sarees', 'sari', 'lehenga', 'salwar', 'traditional wear', 'traditional clothing', 'sherwani', 'anarkali', 'dupatta', 'churidar', 'indian wear', 'designer saree', 'silk saree', 'georgette', 'chiffon', 'bandhani', 'patola', 'palazzo', 'dhoti', 'bridal lehenga'],
    'Formal Wear':        ['formal wear', 'formal shirt', 'suit', 'blazer', 'business wear', 'office wear', 'workwear', 'trouser', 'corporate'],
    'Men\'s Fashion':     ['men\'s fashion', 'menswear', 'men\'s clothing', 'men\'s wear', 'for men', 'male fashion'],
    'Women\'s Wear':      ['women\'s wear', 'womenswear', 'women\'s clothing', 'women\'s fashion', 'for women', 'ladies wear'],
    'Streetwear':         ['streetwear', 'street style', 'urban', 'pop culture', 'merchandise', 'merch', 'fandom', 'graphic tee', 'oversized', 'drop', 'limited edition'],
    'Lingerie & Innerwear': ['lingerie', 'bra', 'underwear', 'shapewear', 'intimates', 'innerwear', 'panties', 'briefs', 'boxers'],
    'Innerwear & Loungewear': ['innerwear', 'loungewear', 'sleepwear', 'pajama', 'robe', 'lounge set', 'comfortable wear'],
    'Outdoor & Adventure':['outdoor', 'adventure', 'hiking', 'trekking', 'camping', 'waterproof', 'all-terrain', 'trail'],
    'Footwear':           ['footwear', 'boot', 'sandal', 'loafer', 'formal shoe', 'slipper', 'heel', 'flat', 'oxford'],
    'Casual Footwear':    ['casual footwear', 'comfort shoe', 'casual shoe', 'everyday shoe', 'clog', 'slide'],
    'Multi-Brand Retail': ['multi-brand', 'multiple brands', 'top brands', 'brand store', 'fashion store'],
    'Department Store':   ['department store', 'everything you need', 'all categories', 'shop all'],
    'Fashion Marketplace':['fashion marketplace', 'curated fashion', 'fashion brands'],
    'Kids Wear':          ['kids wear', 'children clothing', 'boys clothing', 'girls clothing', 'kids fashion'],
    'Sneakers & Athletic':['sneaker', 'sneakers', 'trainer', 'trainers', 'running shoe', 'athletic shoe', 'basketball shoe', 'soccer cleat'],
    'Boots':              ['boot', 'boots', 'ankle boot', 'knee-high boot', 'hiking boot', 'work boot', 'chelsea boot', 'combat boot'],
    'Sandals & Slides':   ['sandal', 'slide', 'flip flop', 'kolhapuri'],
    'Heels & Pumps':      ['heel', 'heels', 'stiletto', 'pump', 'kitten heel'],
    'Flats & Loafers':    ['flat', 'loafer', 'moccasin', 'slip on', 'espadrille'],
    'Bags & Luggage':     ['backpack', 'handbag', 'tote', 'crossbody', 'clutch', 'duffel bag', 'luggage', 'suitcase', 'travel bag'],
    'Watches':            ['smartwatch', 'analog watch', 'digital watch', 'luxury watch', 'fashion watch', 'sport watch', 'wristwatch'],
    'Eyewear':            ['prescription glasses', 'sunglasses', 'blue light glasses', 'reading glasses', 'safety eyewear', 'eyeglasses', 'spectacles', 'optical'],
    'Wallets & Accessories':['wallet', 'cardholder', 'card holder', 'money clip', 'belt', 'suspender', 'scarf', 'hat', 'cap'],
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
    'Alcohol':            ['wine shop', 'winery', 'vineyard', 'craft beer', 'brewery', 'distillery', 'spirits brand', 'cocktail kit', 'mixer', 'whiskey', 'vodka', 'rum', 'tequila', 'gin', 'bourbon'],
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
    'Hardware Store':     ['hardware', 'tools', 'tool store', 'tool shop', 'power tools', 'hand tools', 'drill', 'saw', 'grinder', 'welder', 'compressor', 'generator', 'plumbing', 'timber', 'lumber', 'building materials', 'home improvement', 'renovation', 'diy', 'fencing', 'roofing', 'flooring', 'paint', 'garden', 'landscaping', 'warehouse', 'trade tools', 'industrial tools', 'workshop', 'workbench'],
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
  'Sports & Outdoor': {
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
  'Media & Entertainment': {
    'Video Streaming':    ['movie streaming', 'tv show', 'original series', 'video streaming', 'stream movies'],
    'Sports Streaming':   ['live sports', 'sports streaming', 'game streaming'],
    'Live TV':            ['live tv', 'cable replacement', 'tv streaming'],
    'Music Streaming':    ['music streaming', 'on-demand music', 'playlist', 'ad-free listening'],
    'Podcasts':           ['podcast', 'premium podcast'],
    'Audiobooks':         ['audiobook', 'audio book'],
    'Gaming':             ['cloud gaming', 'game subscription', 'game library', 'game pass', 'mobile gaming'],
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
  'Transportation & Mobility': {
    'Ride-Sharing':       ['ride-sharing', 'rideshare', 'taxi app'],
    'Car Rental':         ['car rental', 'car-sharing', 'car subscription'],
    'Micro-Mobility':     ['bike-sharing', 'scooter-sharing', 'electric scooter'],
    'EV Charging':        ['ev charging', 'charging network', 'charging station'],
  },
  'Ecommerce/Retail': {
    'Marketplace':        ['marketplace', 'seller', 'vendor', 'multi-brand'],
  },
  'Automotive': {
    'Car Dealership':     ['car dealership', 'car dealer', 'showroom', 'test drive', 'new cars', 'used cars', 'pre-owned'],
    'Auto Parts':         ['auto parts', 'spare parts', 'car accessories', 'tire', 'tyre', 'engine oil'],
    'Two Wheeler':        ['motorcycle', 'scooter', 'bike dealer', 'two wheeler'],
    'Electric Vehicle':   ['electric vehicle', 'ev charging', 'electric car', 'electric scooter'],
    'Auto Service':       ['car service', 'car wash', 'auto repair', 'car maintenance'],
  },
  'Real Estate': {
    'Residential':        ['apartment', 'villa', 'flat', 'penthouse', 'bhk', 'gated community', 'township'],
    'Commercial':         ['commercial property', 'office space', 'co-working', 'retail space'],
    'Property Listing':   ['property listing', 'real estate agent', 'broker', 'rent apartment'],
    'Construction':       ['builder', 'developer', 'construction', 'under construction', 'rera'],
  },
  'SaaS & B2B': {
    'CRM & Sales':        ['crm software', 'sales automation', 'pipeline management', 'lead management'],
    'Project Management': ['project management', 'task management', 'collaboration tool', 'team management'],
    'HR & Payroll':       ['hr software', 'payroll software', 'employee management', 'onboarding'],
    'Developer Tools':    ['developer tools', 'api platform', 'devops', 'code hosting', 'version control'],
    'Analytics':          ['data analytics platform', 'business intelligence', 'dashboard', 'reporting'],
    'No-Code / Low-Code': ['no-code', 'low-code', 'drag and drop builder', 'visual editor'],
  },
  'Agriculture': {
    'Farm Inputs':        ['seeds', 'fertilizer', 'pesticide', 'agri input'],
    'Farm Equipment':     ['tractor', 'farm equipment', 'irrigation', 'harvester'],
    'Agri-Commerce':      ['mandi', 'grain trading', 'agri marketplace'],
  },
  'Manufacturing': {
    'Heavy Industry':     ['steel', 'cement', 'chemical', 'metal', 'mining'],
    'Machinery':          ['machinery', 'cnc', 'lathe', 'heavy equipment'],
    'Textile':            ['textile mill', 'yarn', 'fabric manufacturing'],
  },
  'Logistics': {
    'Courier & Express':  ['courier', 'express delivery', 'parcel', 'last mile delivery'],
    'Freight':            ['freight', 'cargo', 'trucking', 'shipping company'],
    'Warehousing':        ['warehousing', 'fulfillment center', '3pl', 'cold chain'],
  },
  'Legal': {
    'Law Firm':           ['law firm', 'attorney', 'lawyer', 'advocate'],
    'Legal Tech':         ['legal tech', 'contract management', 'legal document', 'e-signature'],
    'IP & Trademark':     ['intellectual property', 'trademark', 'patent', 'copyright'],
  },
  'HR & Recruitment': {
    'Job Portal':         ['job portal', 'job board', 'job listing', 'career page'],
    'Staffing':           ['staffing', 'recruitment agency', 'headhunter', 'talent acquisition'],
    'HR Tech':            ['hr tech', 'employee engagement', 'workforce management', 'applicant tracking'],
  },
  'Energy & Utilities': {
    'Solar':              ['solar energy', 'solar panel', 'solar installation', 'rooftop solar'],
    'Renewable':          ['wind energy', 'clean energy', 'green energy', 'renewable energy'],
    'Oil & Gas':          ['oil and gas', 'petroleum', 'natural gas', 'refinery'],
    'EV & Battery':       ['ev battery', 'energy storage', 'lithium ion', 'battery technology'],
  },
  'Art & Collectibles': {
    'Fine Art':           ['fine art', 'painting', 'sculpture', 'canvas', 'art gallery'],
    'Collectibles':       ['collectible', 'antique', 'vintage', 'limited edition'],
    'Digital Art':        ['nft', 'digital art', 'generative art', 'crypto art'],
  },
  'Wedding & Events': {
    'Wedding Planning':   ['wedding planner', 'wedding venue', 'wedding decoration', 'wedding invitation'],
    'Bridal & Groom':     ['wedding dress', 'bridal', 'groom wear', 'bridal lehenga'],
    'Event Management':   ['event management', 'event planner', 'conference', 'exhibition'],
  },
  'Printing & Packaging': {
    'Digital Printing':   ['digital printing', 'custom printing', 'sticker printing', 'label printing'],
    'Commercial Printing':['offset printing', 'flex printing', 'banner printing', 'signage'],
    'Packaging':          ['packaging design', 'corrugated box', 'branded packaging', 'custom packaging'],
  },
  'Pharmacy & Optical': {
    'Pharmacy':           ['pharmacy', 'chemist', 'drugstore', 'online pharmacy', 'medical store'],
    'Optical':            ['optical store', 'eye care', 'prescription glasses', 'contact lenses', 'spectacle'],
  },
  'FMCG': {
    'Personal Care':      ['personal care', 'toiletries', 'body care', 'oral care'],
    'Household':          ['household products', 'cleaning', 'detergent', 'air freshener'],
    'Packaged Foods':     ['packaged goods', 'snack brand', 'beverage brand', 'breakfast cereal'],
  },
  'Crypto & Web3': {
    'Exchange':           ['crypto exchange', 'trading platform', 'dex', 'centralized exchange'],
    'DeFi':               ['defi', 'yield farming', 'staking', 'liquidity pool'],
    'NFT':                ['nft marketplace', 'nft collection', 'digital collectible'],
    'Infrastructure':     ['blockchain', 'smart contract', 'web3 infrastructure', 'layer 2'],
  },
  'Cloud & DevTools': {
    'Cloud Platform':     ['cloud platform', 'iaas', 'paas', 'cloud hosting'],
    'DevOps':             ['ci cd', 'continuous integration', 'kubernetes', 'docker', 'containerization'],
    'Serverless':         ['serverless', 'function as a service', 'edge computing'],
  },
  'Cybersecurity': {
    'Endpoint Security':  ['endpoint security', 'antivirus', 'malware protection', 'ransomware'],
    'Network Security':   ['firewall', 'intrusion detection', 'ddos protection', 'vpn'],
    'Identity & Access':  ['identity management', 'access control', 'zero trust', 'sso', 'mfa'],
    'Threat Intelligence':['threat intelligence', 'soc', 'siem', 'vulnerability management'],
  },
  'Grocery & Supermarket': {
    'Supermarket Chain':  ['supermarket', 'hypermarket', 'grocery chain', 'retail chain'],
    'Online Grocery':     ['online grocery', 'grocery delivery', 'quick commerce', 'instant delivery'],
    'Wholesale':          ['wholesale', 'bulk buying', 'warehouse club', 'cash and carry'],
    'Specialty Grocery':  ['organic grocery', 'gourmet', 'specialty food store', 'health food store'],
  },
  'Professional Services': {
    'Consulting':         ['management consulting', 'strategy consulting', 'business consulting', 'advisory'],
    'Marketing & Advertising': ['marketing agency', 'digital agency', 'advertising agency', 'creative agency', 'pr agency', 'branding agency', 'social media agency', 'seo agency'],
    'Accounting & Tax':   ['accounting firm', 'chartered accountant', 'tax consultant', 'audit firm', 'bookkeeping', 'cpa'],
    'Design & Architecture': ['architecture firm', 'interior designer', 'design studio', 'ux design', 'graphic design'],
    'IT Services':        ['it consulting', 'software consulting', 'outsourcing', 'bpo', 'kpo', 'managed services'],
    'Research':           ['market research', 'research firm', 'analytics consulting', 'data consulting'],
  },
  'NGO & Non-Profit': {
    'Charity':            ['charity', 'charitable trust', 'donation', 'relief fund', 'humanitarian'],
    'Foundation':         ['foundation', 'philanthropy', 'endowment', 'grant making'],
    'Social Enterprise':  ['social enterprise', 'social impact', 'sustainable development', 'impact investing'],
    'Advocacy':           ['advocacy', 'awareness campaign', 'human rights', 'animal rights', 'environmental'],
  },
  'Restaurant & Hospitality': {
    'Fine Dining':        ['fine dining', 'michelin', 'gourmet', 'tasting menu', 'chef table'],
    'Casual Dining':      ['casual dining', 'family restaurant', 'diner', 'bistro', 'eatery'],
    'Fast Food & QSR':    ['fast food', 'quick service', 'takeaway', 'drive through', 'burger', 'pizza'],
    'Cloud Kitchen':      ['cloud kitchen', 'ghost kitchen', 'delivery only', 'virtual restaurant'],
    'Cafe & Bakery':      ['cafe', 'coffee shop', 'bakery', 'patisserie', 'tea house'],
    'Hotel & Resort':     ['hotel', 'resort', 'boutique hotel', 'luxury hotel', 'heritage hotel', 'spa resort'],
    'Catering':           ['catering service', 'event catering', 'corporate catering', 'banquet'],
  },
  'Fitness & Gym': {
    'Gym & Fitness Center': ['gym', 'gymnasium', 'fitness center', 'health club', 'fitness club'],
    'Yoga & Pilates':     ['yoga studio', 'pilates', 'meditation center', 'wellness studio'],
    'Martial Arts':       ['martial arts', 'boxing gym', 'mma', 'karate', 'taekwondo', 'judo'],
    'Sports Academy':     ['sports academy', 'cricket academy', 'football academy', 'swimming', 'tennis academy'],
    'Personal Training':  ['personal training', 'personal trainer', 'online coaching', 'fitness coaching'],
  },
  'Banking & Financial Services': {
    'Retail Banking':     ['savings account', 'current account', 'fixed deposit', 'personal loan', 'home loan', 'credit card', 'debit card', 'net banking'],
    'Corporate Banking':  ['corporate banking', 'trade finance', 'treasury', 'cash management', 'working capital'],
    'Wealth Management':  ['wealth management', 'private banking', 'portfolio', 'high net worth', 'investment advisory'],
    'Microfinance':       ['microfinance', 'micro loan', 'self help group', 'financial inclusion', 'rural banking'],
    'Cooperative Bank':   ['cooperative bank', 'credit union', 'cooperative society'],
  },
  'Government & Public Sector': {
    'Central Government': ['central government', 'ministry', 'parliament', 'union government'],
    'State Government':   ['state government', 'chief minister', 'state legislature'],
    'Municipal & Local':  ['municipal', 'corporation', 'panchayat', 'district', 'city administration'],
    'Regulatory Body':    ['regulatory', 'commission', 'authority', 'sebi', 'rbi', 'trai'],
    'Public Services':    ['e-governance', 'citizen service', 'public service', 'digital india'],
  },
  'Social Media & Platforms': {
    'Social Network':     ['social network', 'connect with friends', 'follow', 'feed', 'timeline'],
    'Short Video':        ['short video', 'reels', 'stories', 'video sharing'],
    'Forum & Community':  ['forum', 'discussion board', 'community platform', 'q&a'],
    'Creator Platform':   ['creator economy', 'influencer platform', 'content creator', 'monetization'],
  },
  'Gaming & Esports': {
    'Game Studio':        ['game studio', 'game developer', 'game publisher', 'indie game'],
    'Esports':            ['esports', 'competitive gaming', 'tournament', 'league'],
    'Game Platform':      ['game download', 'game store', 'game library', 'steam'],
    'Mobile Gaming':      ['mobile game', 'hyper casual', 'casual game', 'puzzle game'],
  },
  'Betting & Fantasy Sports': {
    'Fantasy Sports':     ['fantasy sports', 'fantasy cricket', 'fantasy football', 'dream team', 'daily fantasy'],
    'Sports Betting':     ['sports betting', 'sportsbook', 'odds', 'wagering', 'horse racing'],
    'Online Casino':      ['online casino', 'poker', 'rummy', 'slot', 'live casino', 'card game'],
    'Lottery':            ['lottery', 'jackpot', 'lucky draw', 'raffle'],
  },
  'Dating & Matchmaking': {
    'Dating App':         ['dating app', 'online dating', 'swipe', 'singles', 'speed dating'],
    'Matrimony':          ['matrimony', 'matrimonial', 'shaadi', 'vivah', 'rishta', 'bride', 'groom'],
    'Niche Dating':       ['christian dating', 'muslim dating', 'senior dating', 'lgbtq dating'],
  },
  'Web Hosting & Domains': {
    'Shared Hosting':     ['shared hosting', 'web hosting', 'cpanel', 'wordpress hosting'],
    'Cloud & VPS':        ['vps hosting', 'cloud hosting', 'dedicated server', 'managed hosting'],
    'Domain Services':    ['domain registration', 'domain transfer', 'domain renewal', 'whois'],
    'CDN & Performance':  ['cdn', 'content delivery', 'ddos protection', 'load balancer', 'edge computing'],
    'Website Builder':    ['website builder', 'drag and drop', 'no-code website', 'landing page builder'],
  },
  'Home Services': {
    'Cleaning':           ['home cleaning', 'deep cleaning', 'carpet cleaning', 'sofa cleaning'],
    'Repairs & Maintenance': ['plumber', 'electrician', 'carpenter', 'ac repair', 'appliance repair', 'handyman'],
    'Pest Control':       ['pest control', 'termite', 'cockroach', 'mosquito', 'fumigation'],
    'Moving & Relocation': ['packers and movers', 'relocation', 'moving service', 'shifting'],
    'Home Improvement':   ['painting', 'waterproofing', 'renovation', 'home renovation', 'interior work'],
  },
  'Security & Surveillance': {
    'CCTV & Cameras':     ['cctv', 'security camera', 'ip camera', 'nvr', 'dvr', 'surveillance'],
    'Access Control':     ['access control', 'biometric', 'face recognition', 'smart lock'],
    'Alarm Systems':      ['fire alarm', 'burglar alarm', 'intrusion alarm', 'smoke detector'],
    'Guard Services':     ['security guard', 'guarding service', 'manned guarding', 'patrol'],
  },
  'Construction & Building Materials': {
    'Cement & Concrete':  ['cement', 'concrete', 'ready mix', 'ultratech', 'acc', 'ambuja'],
    'Steel & Metals':     ['steel bars', 'tmt bars', 'structural steel', 'rebar', 'iron'],
    'Tiles & Flooring':   ['tiles', 'marble', 'granite', 'vitrified tiles', 'flooring'],
    'Construction Chemicals': ['waterproofing', 'adhesive', 'grout', 'sealant', 'construction chemical'],
    'Infrastructure':     ['infrastructure', 'road construction', 'bridge', 'tunnel', 'highway'],
  },
  'Alcohol & Tobacco': {
    'Liquor Retail':      ['bottle shop', 'liquor store', 'wine store', 'alcohol delivery', 'liquor delivery', 'drink delivery', 'bottle-o', 'off licence', 'package store', 'alcohol online', 'alcohol shop', 'liquor shop', 'cellar door'],
    'Spirits':            ['whisky', 'whiskey', 'vodka', 'rum', 'gin', 'tequila', 'brandy', 'bourbon', 'single malt', 'blended scotch'],
    'Wine':               ['wine', 'champagne', 'prosecco', 'vineyard', 'winery', 'sommelier', 'wine cellar', 'vintages'],
    'Beer':               ['beer', 'craft beer', 'brewery', 'lager', 'ale', 'stout', 'ipa', 'microbrewery'],
    'Bar & Lounge':       ['bar', 'pub', 'lounge', 'cocktail bar', 'nightclub'],
    'Tobacco':            ['tobacco', 'cigarette', 'cigar', 'vape', 'e-cigarette', 'hookah'],
  },
  'Religious & Spiritual': {
    'Temple & Shrine':    ['temple', 'mandir', 'shrine', 'darshan', 'puja', 'pooja', 'prasad'],
    'Church':             ['church', 'cathedral', 'chapel', 'parish', 'diocese', 'sunday service'],
    'Mosque':             ['mosque', 'masjid', 'namaz', 'islamic center', 'jama masjid'],
    'Spiritual Center':   ['ashram', 'retreat center', 'meditation center', 'yoga ashram', 'spiritual guru'],
    'Religious Products': ['religious book', 'puja items', 'incense', 'idol', 'murti', 'prayer beads'],
  },
  'Classifieds & Listings': {
    'General Classifieds': ['classifieds', 'buy and sell', 'local listing', 'post ad', 'free listing'],
    'Used Goods':         ['second hand', 'pre-owned', 'used items', 'refurbished'],
    'Auction':            ['auction', 'bidding', 'online auction', 'reserve price'],
  },
  'Salon & Spa': {
    'Hair Salon':         ['hair salon', 'hair styling', 'hair coloring', 'keratin', 'hair cut', 'barber'],
    'Beauty Salon':       ['beauty salon', 'facial', 'makeup artist', 'bridal makeup', 'waxing', 'threading'],
    'Nail Studio':        ['nail salon', 'nail art', 'manicure', 'pedicure', 'gel nails'],
    'Spa & Wellness':     ['spa', 'massage', 'body massage', 'aromatherapy spa', 'day spa'],
    'Aesthetic Clinic':   ['aesthetic clinic', 'skin clinic', 'laser treatment', 'dermatologist', 'medspa', 'hair transplant'],
    'Tattoo & Piercing':  ['tattoo', 'tattoo studio', 'piercing', 'body art'],
  },
  'Schools & Universities': {
    'K-12 School':        ['primary school', 'secondary school', 'high school', 'international school', 'boarding school', 'cbse', 'icse', 'ib school'],
    'Pre-School':         ['preschool', 'play school', 'montessori', 'kindergarten', 'daycare', 'nursery school'],
    'University':         ['university', 'deemed university', 'college', 'undergraduate', 'postgraduate', 'phd'],
    'Professional Institute': ['iit', 'iim', 'nit', 'medical college', 'engineering college', 'law school', 'business school'],
  },
  'Coworking & Office Space': {
    'Coworking Space':    ['coworking', 'co-working', 'shared office', 'hot desk', 'community workspace'],
    'Managed Office':     ['managed office', 'serviced office', 'private office', 'dedicated desk'],
    'Virtual Office':     ['virtual office', 'business address', 'mail handling', 'registered office'],
    'Incubator':          ['incubator', 'accelerator', 'startup space', 'innovation hub'],
  },
  'Rental & Subscription Services': {
    'Furniture Rental':   ['rent furniture', 'furniture rental', 'rent sofa', 'rent bed'],
    'Electronics Rental': ['rent electronics', 'rent laptop', 'rent tv', 'rent appliance'],
    'Vehicle Rental':     ['car subscription', 'bike rental', 'scooter rental', 'vehicle rental'],
    'Fashion Rental':     ['dress rental', 'fashion rental', 'costume rental', 'rent designer'],
    'Subscription Box':   ['subscription box', 'monthly box', 'curated box', 'surprise box'],
  },
};

function analyzeKeywords(html, url, extraMeta) {
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
  const domainRaw = (url || '').replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\..*$/, '').toLowerCase();
  // Decompose compound domain names: "sydneytools" → "sydney tools", "mochishoes" → "mochi shoes"
  const DOMAIN_WORDS = ['shop','store','tools','shoes','fashion','beauty','tech','home','food','baby','pet','wear','mart','hub','gear','zone','world','box','club','fit','health','sport','sports','auto','cars','bike','book','books','watch','watches','jewel','decor','craft','art','game','games','music','base','depot','warehouse'];
  let domainDecomposed = domainRaw;
  for (const w of DOMAIN_WORDS) {
    if (domainRaw.length > w.length && domainRaw.includes(w) && domainRaw !== w) {
      domainDecomposed = domainDecomposed.replace(new RegExp(w, 'g'), ` ${w} `).replace(/\s+/g, ' ').trim();
    }
  }
  // Include both raw and decomposed so "homebase" matches as substring AND "home base" matches words
  const domainName = domainDecomposed !== domainRaw ? `${domainRaw} ${domainDecomposed}` : domainRaw;

  // Extract og:title, og:description, og:site_name, direct meta category from extraMeta
  const ogTitle = (extraMeta?.ogTitle || '').toLowerCase();
  const ogDesc = (extraMeta?.ogDescription || '').toLowerCase();
  const ogSiteName = (extraMeta?.ogSiteName || '').toLowerCase();
  const metaCategory = (extraMeta?.metaCategory || '').toLowerCase();

  // Extract <h2> tags for deeper content signals
  const h2s = [];
  const h2Rx = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let h2m;
  while ((h2m = h2Rx.exec(html)) !== null) h2s.push(h2m[1]);

  let bodyText = '';
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  if (bodyMatch) {
    bodyText = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 5000);
  }

  // Extract nav/menu link text — often contains category clues like "Shop Shoes", "Men", "Women"
  const navText = (html.match(/<nav[\s\S]*?<\/nav>/gi) || [])
    .join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000);

  const altTexts = (html.match(/alt=["']([^"']+)["']/gi) || [])
    .map(a => a.replace(/alt=["']/i, '').replace(/["']$/, '')).join(' ');

  const textParts = [
    { text: domainName, weight: 5 },
    { text: title.toLowerCase(), weight: 4 },
    { text: ogTitle && ogTitle !== title.toLowerCase() ? ogTitle : '', weight: 4 },
    { text: ogDesc && ogDesc !== metaDesc.toLowerCase() ? ogDesc : '', weight: 3 },
    { text: ogSiteName, weight: 2 },
    { text: metaCategory, weight: 6 },  // Direct category declaration — highest signal
    { text: h1s.join(' ').toLowerCase(), weight: 2 },
    { text: h2s.join(' ').toLowerCase().slice(0, 1000), weight: 1.5 },
    { text: metaDesc.toLowerCase(), weight: 3 },
    { text: metaKeywords.toLowerCase(), weight: 2 },
    { text: navText.toLowerCase(), weight: 1.5 },
    { text: bodyText.toLowerCase(), weight: 1 },
    { text: altTexts.toLowerCase(), weight: 1 },
  ];

  // Word-boundary match for short keywords to avoid substring false positives
  // e.g. "ring" shouldn't match "during", "stud" shouldn't match "student"
  const kwMatchCache = {};
  function kwMatches(text, kw) {
    const key = text + '||' + kw;
    if (kwMatchCache[key] !== undefined) return kwMatchCache[key];
    let result;
    if (kw.length <= 5 && !/\s/.test(kw)) {
      // Short single-word keyword: require word boundary
      const rx = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      result = rx.test(text);
    } else {
      result = text.includes(kw);
    }
    kwMatchCache[key] = result;
    return result;
  }

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    let score = 0;
    for (const part of textParts) {
      let partScore = 0;
      for (const kw of keywords) {
        if (kwMatches(part.text, kw)) {
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
          if (kwMatches(part.text, kw)) sc += part.weight;
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
    // Don't set subCategory here — let keyword/content analysis determine the actual product niche
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
  /\/stores(?:\?|\/|$)/i,
  /\/store(?:\.html)?(?:\?|\/|$)/i,
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
  /\/find-?(?:your-?)?(?:nearest-?)?(?:.*?store|.*?outlet|.*?branch|.*?showroom)/i,
  /\/(?:pages\/)?.*bookstore/i,
  /\/store-?list/i,
  /\/all-?stores/i,
  /^https?:\/\/map\./i,
  /^https?:\/\/stores?\./i,
  /\/pages\/store-locator/i,
  /\/pages\/stores/i,
  /\/pages\/locate/i,
  /\/pages\/find-store/i,
  /\/pages\/our-store/i,
  /\/pages\/boutique/i,
  /\/pages\/locate-?us/i,
  /\/locate-?us(?:-page)?/i,
  /\/[a-z0-9]+-stores?\b/i,
];

function countToBand(count) {
  if (count <= 0)   return 'Online';
  if (count <= 10)  return '1-10';
  if (count <= 20)  return '11-20';
  if (count <= 50)  return '21-50';
  if (count <= 100) return '51-100';
  return '100+';
}

async function scrapeStoreLocatorWithBrowser(storeLocatorUrl) {
  const { getBrowser } = require('./fetch');
  const {
    interceptStoreAPIs, extractCountFromScoredResponse,
    fallbackDOMParsing,
  } = require('./storeInterceptor');

  let browser;
  try {
    browser = await getBrowser();
  } catch {
    return { count: 0, source: 'none' };
  }

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // --- Step 1: XHR Interception (best approach — captures structured JSON) ---
    let captured;
    try {
      captured = await Promise.race([
        interceptStoreAPIs(page, storeLocatorUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error('intercept timeout')), 18000)),
      ]);
    } catch {
      captured = [];
    }

    if (captured && captured.length > 0) {
      const best = captured.sort((a, b) => b.score - a.score)[0];
      const count = extractCountFromScoredResponse(best.data);
      if (count > 0) return { count, source: 'xhr_intercept' };
    }

    // --- Step 2: DOM Fallback (JSON-LD, __NEXT_DATA__, repeating patterns) ---
    try {
      const domStores = await fallbackDOMParsing(page);
      if (domStores && domStores.length > 0) return { count: domStores.length, source: 'dom_parsing' };
    } catch {}

    // --- Step 3: Get rendered HTML and try text/element extraction ---
    let storeHtml = '';
    try {
      storeHtml = await page.content();
    } catch {}

    if (!storeHtml || storeHtml.length < 500) return { count: 0, source: 'none', html: storeHtml };

    // Text-based count from stealth-rendered page
    const textCount = extractStoreCount(storeHtml);
    if (textCount > 0) return { count: textCount, source: 'text_extraction', html: storeHtml };

    // JSON arrays in rendered page
    const jsonCount = countJsonArrayItems(storeHtml);
    if (jsonCount > 0) return { count: jsonCount, source: 'json_array', html: storeHtml };

    // DOM element counting
    const elemCount = countStoreElements(storeHtml);
    if (elemCount > 0) return { count: elemCount, source: 'store_elements', html: storeHtml };

    // Rendered items / direction links
    const renderedCount = countRenderedStoreItems(storeHtml);
    if (renderedCount > 0) return { count: renderedCount, source: 'rendered_items', html: storeHtml };

    return { count: 0, source: 'none', html: storeHtml };
  } finally {
    await page.close().catch(() => {});
  }
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

  // Count "Get Directions" / map links — deduplicate by unique href URLs
  // First strip script blocks to avoid counting translation keys like "GET_DIRECTIONS"
  const htmlNoScript = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const uniqueMapHrefs = new Set();
  const hrefMapRx = /href=["']((?:https?:\/\/)?(?:www\.)?(?:google\.com\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps)[^"']*)/gi;
  let _hm;
  while ((_hm = hrefMapRx.exec(htmlNoScript)) !== null) {
    // Normalize by stripping query params for dedup
    uniqueMapHrefs.add(_hm[1].split('?')[0].split('&')[0]);
  }
  // Fall back to text-based count if no href URLs found, but only from visible HTML
  let directionLinks = uniqueMapHrefs.size;
  if (directionLinks === 0) {
    directionLinks = (htmlNoScript.match(/(?:get\s*directions?|directions?\s*(?:to|link))/gi) || []).length;
  }
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

  // Count unique store names from BEM-style __name elements (deduped by text — most accurate)
  const storeNameRx = /class=["'][^"']*(?:store|location|outlet|branch|shop)s?(?:[-_]{1,2})name[^"']*["'][^>]*>([^<]+)</gi;
  const uniqueStoreNames = new Set();
  let snm;
  while ((snm = storeNameRx.exec(htmlNoScript)) !== null) {
    const name = snm[1].trim();
    if (name && name.length > 2 && name.length < 60) uniqueStoreNames.add(name);
  }
  if (uniqueStoreNames.size > 1) {
    // Deduped names are the most reliable — use directly
    best = Math.max(best, uniqueStoreNames.size);
  } else {
    // Fall back to raw card/item element counting (may have mobile/desktop duplicates)
    const cardClassPatterns = [
      /class=["'][^"']*(?:store|location|outlet|branch|shop|dealer|showroom)(?:[-_]{1,2})(?:card|item|entry|listing|block|tile|row|detail)[^"']*["']/gi,
      /class=["'][^"']*(?:card|item|entry|listing|block|tile|row|detail)(?:[-_]{1,2})(?:store|location|outlet|branch|shop|dealer|showroom)[^"']*["']/gi,
      /data-(?:store|location|outlet|branch)[-_]?(?:id|index|name)=/gi,
    ];
    for (const rx of cardClassPatterns) {
      const cards = (html.match(rx) || []).length;
      if (cards > 1) best = Math.max(best, cards);
    }
  }

  // Count <h3>/<h4>/<h5> headers that look like city/store names inside store sections
  const storeHeaders = (html.match(/<h[3-5][^>]*>[^<]{2,60}<\/h[3-5]>/gi) || []);
  // Only count if many of them are inside store-related containers
  if (storeHeaders.length > 3) {
    // Check if the page seems to be a store listing (has store-related keywords)
    const lowerHtml = html.toLowerCase();
    const isStoreListPage = /store.?locat|our.?store|find.?(?:a\s+)?store|store.?finder|outlet|showroom|branch|locations?/i.test(lowerHtml);
    if (isStoreListPage && storeHeaders.length > 5) {
      best = Math.max(best, storeHeaders.length);
    }
  }

  return best;
}

async function detectOfflineStores(html, url, technologies, fetchPage, storeLocatorUrl, jsonLdStoreHint, browserFetch) {
  // --- Step 1: Check ONLY header/footer/nav for store/location links ---
  let headerFooterLink = findStoreLocatorInHeaderFooter(html, url);

  // If main page is blocked by Cloudflare/bot protection, we can't check header/footer.
  // Try common store locator URLs directly before concluding "Online".
  const pageIsBlocked = !html || html.length < 2000 ||
    /just a moment|checking your browser|cloudflare.*challenge/i.test((html || '').slice(0, 3000));

  if (!headerFooterLink && pageIsBlocked) {
    const baseUrl = (url || '').replace(/\/$/, '');
    const commonStorePaths = [
      '/stores', '/store-finder', '/store-locator', '/find-a-store', '/our-stores',
      '/locations', '/find-store', '/storelocator', '/branches', '/find-us',
    ];
    // Try axios first (fast)
    for (const path of commonStorePaths) {
      try {
        const resp = await fetchPage(baseUrl + path);
        const respHtml = typeof resp?.data === 'string' ? resp.data : '';
        if (respHtml.length > 2000 && !/just a moment|cloudflare/i.test(respHtml.slice(0, 2000))) {
          headerFooterLink = baseUrl + path;
          break;
        }
      } catch {}
    }
    // If axios failed (all CF-blocked), try browser for the most common paths
    if (!headerFooterLink && browserFetch) {
      for (const path of ['/stores', '/store-finder', '/store-locator', '/find-a-store']) {
        try {
          const result = await Promise.race([
            browserFetch(baseUrl + path),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
          ]);
          const respHtml = result?.html || '';
          if (respHtml.length > 5000 && !/just a moment|cloudflare/i.test(respHtml.slice(0, 2000))) {
            headerFooterLink = baseUrl + path;
            break;
          }
        } catch {}
      }
    }
  }

  // Fallback: search full page body for store locator links (not just header/footer)
  if (!headerFooterLink && html) {
    const fullPageLink = findStoreLocatorLink(html, url);
    if (fullPageLink) {
      // Verify it's not an app store link (Google Play, Apple App Store)
      if (!/play\.google\.com|apps\.apple\.com|itunes\.apple\.com/i.test(fullPageLink)) {
        headerFooterLink = fullPageLink;
      }
    }
    // Also check anchor text in full body
    if (!headerFooterLink) {
      const STORE_BODY_TEXT = /\b(?:store\s+locator|find\s+(?:a\s+)?store|our\s+stores?|locate\s+us|visit\s+(?:our\s+)?stores?)\b/i;
      const bodyAnchorRx = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let bam;
      while ((bam = bodyAnchorRx.exec(html)) !== null) {
        const href = bam[1];
        const text = bam[2].replace(/<[^>]+>/g, '').trim();
        if (!STORE_BODY_TEXT.test(text)) continue;
        if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)(\?|$)/i.test(href)) continue;
        if (href === '#' || href === '/' || href === '') continue;
        if (/play\.google\.com|apps\.apple\.com|itunes\.apple\.com/i.test(href)) continue;
        try {
          const resolved = new URL(href, url);
          headerFooterLink = resolved.href;
          break;
        } catch {}
      }
    }
  }

  // If no store/location link anywhere → brand sells online only
  if (!headerFooterLink) {
    // Double-check: if JSON-LD has multiple addresses, there might be stores
    if (jsonLdStoreHint && jsonLdStoreHint > 1) {
      return { band: countToBand(jsonLdStoreHint), rawCount: jsonLdStoreHint, source: 'json_ld', locatorPageExists: false };
    }
    return { band: 'Online', rawCount: 0, source: 'header_footer_check', locatorPageExists: false };
  }

  // --- Step 2: Store link found in header/footer — follow it and count locations ---
  const storePageUrl = headerFooterLink;

  const result = (count, source) => ({
    band: countToBand(count),
    rawCount: count,
    source,
    locatorPageExists: true,
  });

  // Try fetching store locator page with axios (longer timeout for large pages like Shopify)
  let storeLocatorHtml = '';
  let axiosBlocked = false;
  if (fetchPage) {
    try {
      // Use fetchPage first with its default timeout
      const resp = await fetchPage(storePageUrl);
      storeLocatorHtml = typeof resp.data === 'string' ? resp.data : '';
    } catch {
      // If quickFetch timed out, try direct axios with longer timeout for large store pages
      try {
        const axios = require('axios');
        const resp = await axios.get(storePageUrl, {
          timeout: 10000,
          maxRedirects: 3,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' },
          responseType: 'text',
        });
        storeLocatorHtml = typeof resp.data === 'string' ? resp.data : '';
      } catch {}
    }
  }

  // Detect bot-protection challenge or SPA empty shell
  if (storeLocatorHtml) {
    const isChallengeOrEmpty = storeLocatorHtml.length < 1000 ||
      /vercel security checkpoint|cloudflare|just a moment|checking your browser|captcha/i.test(storeLocatorHtml.slice(0, 2000));
    const isSpaShell = !isChallengeOrEmpty && storeLocatorHtml.length < 15000 &&
      (storeLocatorHtml.match(/<script/gi) || []).length > 3 &&
      !/store|location|address|outlet|branch|showroom|pincode|phone|city/i.test(
        storeLocatorHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').slice(0, 5000)
      );
    if (isChallengeOrEmpty || isSpaShell) {
      axiosBlocked = true;
      storeLocatorHtml = '';
    }
  }

  // --- Step 3: Count locations from the store locator page ---

  // 3a: Widget-specific API parsers (highest accuracy)
  const combinedHtml = (storeLocatorHtml || '') + '\n' + html;
  const [widgetCount, locatorApiCount] = await Promise.all([
    tryWidgetParsers(combinedHtml, fetchPage).catch(() => 0),
    storeLocatorHtml ? tryThirdPartyStoreLocators(storeLocatorHtml, fetchPage).catch(() => 0) : Promise.resolve(0),
  ]);
  if (widgetCount > 0) return result(widgetCount, 'widget_api');
  if (locatorApiCount > 0) return result(locatorApiCount, 'widget_api');

  // 3b: If axios was blocked or SPA, use stealth browser to render the page
  if (axiosBlocked || !storeLocatorHtml) {
    try {
      const stealthResult = await scrapeStoreLocatorWithBrowser(storePageUrl);
      if (stealthResult.count > 0) return result(stealthResult.count, stealthResult.source);
      // If browser got HTML but no count, use it for further analysis
      if (!storeLocatorHtml && stealthResult.html) storeLocatorHtml = stealthResult.html;
    } catch {}
  }

  // 3c: Analyze fetched store locator page content
  if (storeLocatorHtml) {
    // JSON arrays with lat/lng/address data
    const jsonArrayCount = countJsonArrayItems(storeLocatorHtml);
    if (jsonArrayCount > 0) return result(jsonArrayCount, 'json_array');

    // DOM elements: address blocks, map pins, direction links, store cards
    const elementCount = countStoreElements(storeLocatorHtml);
    if (elementCount > 0) return result(elementCount, 'store_elements');

    // Rendered store items: map markers, card patterns, direction links
    const renderedCount = countRenderedStoreItems(storeLocatorHtml);
    if (renderedCount > 0) return result(renderedCount, 'rendered_items');

    // Text extraction: "150+ stores", "stores in 30 cities"
    const textCount = extractStoreCount(storeLocatorHtml);
    if (textCount > 0) return result(textCount, 'text_extraction');

    // Inline APIs and JS chunks
    const [locatorInlineCount, jsChunkCount] = await Promise.all([
      tryInlineStoreApis(storeLocatorHtml, storePageUrl, fetchPage).catch(() => 0),
      tryStoreApiFromJsChunks(storeLocatorHtml, storePageUrl, fetchPage).catch(() => 0),
    ]);
    if (locatorInlineCount > 0) return result(locatorInlineCount, 'api_detection');
    if (jsChunkCount > 0) return result(jsChunkCount, 'api_detection');
  }

  // 3d: Try text count from main homepage (e.g. "100+ stores across India")
  const mainTextCount = extractStoreCount(html);
  if (mainTextCount > 0) return result(mainTextCount, 'text_extraction');

  // 3e: Wikipedia fallback
  const wikiCount = await tryWikipediaStoreCount(url, html).catch(() => 0);
  if (wikiCount > 0) return result(wikiCount, 'wikipedia');

  // Store link exists in header/footer but couldn't count → assume at least 1-10
  return { band: '1-10', rawCount: 0, source: 'header_footer_link', locatorPageExists: true };
}


async function tryWikipediaStoreCount(url, html) {
  try {
    const https = require('https');
    let domain;
    try { domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace(/^www\d*\./, ''); } catch { return 0; }
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
      const timer = setTimeout(() => reject(new Error('timeout')), 3000);
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

    const candidates = searchResult.query.search.slice(0, 2);
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

      // Check if the scanned URL targets a specific country (e.g. .in, /in/)
      const isIndiaUrl = /\.in(?:\/|$)|\/in(?:\/|$)/i.test(url);
      const isCountrySpecific = isIndiaUrl || /\/[a-z]{2}(?:\/|$)/.test(url);

      // For country-specific URLs, prefer India/country-specific patterns over global num_locations
      // because num_locations on Wikipedia is typically global (e.g. IKEA: 504 worldwide, but only 6 in India)
      let indiaSpecificCount = 0;
      if (isIndiaUrl) {
        const indiaPatterns = [
          /(\d[\d,]+)\s*(?:stores?|outlets?|locations?|branches?)\s*(?:in|across)\s*india/gi,
          /india[^.]{0,80}?(\d[\d,]+)\s*(?:stores?|outlets?|locations?|branches?)/gi,
          /(?:in|across)\s*india[^.]{0,40}?(\d[\d,]+)\s*(?:stores?|outlets?|cities|locations?)/gi,
          /(\d[\d,]+)\s*(?:stores?|outlets?|cities|locations?)\s*(?:in|across)\s*(?:\d+\s+)?(?:cities?\s+(?:in|across)\s+)?india/gi,
        ];
        for (const rx of indiaPatterns) {
          let im;
          while ((im = rx.exec(wikitext)) !== null) {
            const num = parseInt(im[1].replace(/,/g, ''), 10);
            if (num >= 2 && num < 100000 && num > indiaSpecificCount) indiaSpecificCount = num;
          }
        }
        if (indiaSpecificCount > 0) return indiaSpecificCount;
        // For India URLs, skip global counts — they'd be misleading
        continue;
      }

      // For non-country-specific URLs, use num_locations from infobox
      const locationMatch = /(?:num_locations|number_of_locations|locations)\s*=\s*[^\n]*?(\d[\d,]+)/i.exec(wikitext);
      if (locationMatch) {
        const num = parseInt(locationMatch[1].replace(/,/g, ''), 10);
        if (num > 0 && num < 100000) return num;
      }

      // For other country-specific URLs (/fr/, /de/), also skip global patterns
      if (isCountrySpecific) {
        continue;
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

async function tryCommonStorePages(url, fetchPage) {
  if (!fetchPage) return 0;
  let baseUrl;
  try { baseUrl = new URL(url.startsWith('http') ? url : 'https://' + url); } catch { return 0; }
  const origin = baseUrl.origin;

  // Build brand-specific store paths (e.g. /mamaearth-store, /mamaearth-stores)
  const brand = getBrandName(baseUrl.hostname);
  const brandStorePaths = brand ? [`/${brand}-store`, `/${brand}-stores`] : [];

  // Extract locale prefix from URL path (e.g. /in/, /in/en/, /fr/, /de/en/)
  const localePrefixPaths = [];
  const localeMatch = baseUrl.pathname.match(/^(\/[a-z]{2}(?:\/[a-z]{2,3})?)\//i);
  if (localeMatch) {
    const prefix = localeMatch[1];
    const storeSuffixes = ['/stores', '/stores/', '/store-locator', '/locations'];
    for (const suffix of storeSuffixes) localePrefixPaths.push(`${prefix}${suffix}`);
    // Also try with /en/ language prefix if not already included (e.g. /in/ → /in/en/stores)
    if (!/\/[a-z]{2}\/[a-z]{2,3}$/i.test(prefix)) {
      for (const suffix of storeSuffixes) localePrefixPaths.push(`${prefix}/en${suffix}`);
    }
  }

  const storePaths = [
    '/stores', '/store', '/store.html', '/store-locator', '/find-a-store',
    '/our-stores', '/find-store', '/store-finder',
    '/locate-us', '/where-to-buy',
    '/pages/store-locator', '/pages/stores', '/pages/our-stores',
    '/en-in/stores', '/en/stores',
    ...brandStorePaths,
    ...localePrefixPaths,
  ];
  const aboutPaths = ['/about', '/about-us', '/about-us.html'];

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
          // Lightweight extraction only — no JS chunk downloads or extra API calls
          const jsonCount = countJsonArrayItems(pageHtml);
          if (jsonCount > 0) return jsonCount;

          const elemCount = countStoreElements(pageHtml);
          if (elemCount > 0) return elemCount;

          const renderedCount = countRenderedStoreItems(pageHtml);
          if (renderedCount > 0) return renderedCount;

          // Only try third-party widgets if detected (cheap regex check first)
          if (/storerocket|storepoint|storemapper|stockist|boldapps|proguscommerce/i.test(pageHtml)) {
            const widgetCount = await tryThirdPartyStoreLocators(pageHtml, fetchPage);
            if (widgetCount > 0) return widgetCount;
          }
        }
      } catch {}
      return 0;
    })
  );

  let best = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value > best) best = r.value;
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

  // Progus Commerce Store Locator (Shopify app) — proguscommerce.com
  const progusShopMatch = /shop=([a-z0-9-]+\.myshopify\.com)/i.exec(html);
  const hasProgus = /proguscommerce/i.test(html);
  if (hasProgus && progusShopMatch) {
    checks.push(async () => {
      const frontResp = await fetchPage(`https://sl-front.proguscommerce.com/api/front/data?shop=${progusShopMatch[1]}&lang=en`);
      const frontData = typeof frontResp.data === 'string' ? JSON.parse(frontResp.data) : frontResp.data;
      const shopId = frontData?.settings?.shopId || frontData?.settings?.id || frontData?.id || frontData?.shopId;
      if (!shopId) return 0;
      const locResp = await fetchPage(`https://sl-front.proguscommerce.com/api/locations?shopId=${shopId}`);
      const locData = typeof locResp.data === 'string' ? JSON.parse(locResp.data) : locResp.data;
      return Array.isArray(locData) ? locData.length : 0;
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

  // Fetch store chunks + up to 3 shared chunks in parallel
  const chunksToCheck = allChunks.slice(0, storeChunks.length + 3);
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

  // Detect Demandware / Salesforce Commerce Cloud (SFCC) store API
  const demandwareMatch = /\/on\/demandware\.store\/Sites-([a-zA-Z0-9_-]+)-Site\/([a-zA-Z_]+)\//i.exec(html);
  if (demandwareMatch) {
    const sfccSite = demandwareMatch[1];
    const sfccLocale = demandwareMatch[2];
    const cities = [
      { lat: 28.6139, long: 77.2090 }, { lat: 19.0760, long: 72.8777 },
      { lat: 12.9716, long: 77.5946 }, { lat: 22.5726, long: 88.3639 },
      { lat: 13.0827, long: 80.2707 }, { lat: 17.3850, long: 78.4867 },
      { lat: 26.9124, long: 75.7873 }, { lat: 23.0225, long: 72.5714 },
      { lat: 21.1702, long: 72.8311 }, { lat: 26.8467, long: 80.9462 },
      { lat: 25.3176, long: 82.9739 }, { lat: 30.7333, long: 76.7794 },
      { lat: 11.0168, long: 76.9558 }, { lat: 9.9312, long: 76.2673 },
      { lat: 31.6340, long: 74.8723 }, { lat: 23.2599, long: 77.4126 },
    ];
    let origin;
    try { origin = new URL(url.startsWith('http') ? url : 'https://' + url).origin; } catch {}
    if (origin) {
      const storeIds = new Set();
      const fetchPromises = cities.map(city =>
        fetchPage(`${origin}/on/demandware.store/Sites-${sfccSite}-Site/${sfccLocale}/Stores-FindStores?showMap=true&radius=300&lat=${city.lat}&long=${city.long}`)
          .then(resp => {
            const d = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
            const stores = d?.stores || [];
            for (const s of stores) storeIds.add(s.ID || s.name || JSON.stringify(s).substring(0, 50));
          })
          .catch(() => {})
      );
      await Promise.allSettled(fetchPromises);
      if (storeIds.size > 0) {
        // Demandware results are geo-filtered (lower bound). Also check about page for text count.
        let textCount = 0;
        const aboutPaths = ['/about-us.html', '/about-us', '/about', '/en-in/about-us.html', '/en/about-us'];
        try {
          const aboutResults = await Promise.allSettled(
            aboutPaths.map(p => fetchPage(origin + p).then(r => extractStoreCountStrict(typeof r.data === 'string' ? r.data : '')).catch(() => 0))
          );
          for (const r of aboutResults) {
            if (r.status === 'fulfilled' && r.value > textCount) textCount = r.value;
          }
        } catch {}
        return Math.max(storeIds.size, textCount);
      }
    }
  }

  // Detect external API subdomains (e.g., external.mamaearth.in/v1/external/storelocator/stores)
  if (siteRootDomain) {
    const externalApiRx = new RegExp('["\'](https?://external\\.' + siteRootDomain.replace('.', '\\.') + '[^"\']*(?:store|location)[^"\']*)["\']', 'gi');
    let m;
    while ((m = externalApiRx.exec(html)) !== null) {
      try {
        const resp = await fetchPage(m[1]);
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        if (Array.isArray(data)) { if (data.length > 0) return data.length; }
        else if (data?.data && Array.isArray(data.data)) { if (data.data.length > 0) return data.data.length; }
        else if (data?.stores && Array.isArray(data.stores)) { if (data.stores.length > 0) return data.stores.length; }
      } catch {}
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
  // Also extract text from JSON-encoded HTML inside scripts (SSR/CMS content)
  const scriptTexts = [];
  html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, s) => {
    if (/\\u003[cCeE]/.test(s)) {
      const decoded = s.replace(/\\u003[cC]/g, '<').replace(/\\u003[eE]/g, '>');
      scriptTexts.push(decoded.replace(/<[^>]+>/g, ' '));
    }
  });
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    + ' ' + scriptTexts.join(' ').replace(/\s+/g, ' ');

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
      let num = parseInt(raw.replace(/,/g, ''), 10);
      // Reject phone-number-like sequences: 5+ raw digits without commas (e.g. 887740)
      if (raw.length >= 5 && !/,/.test(raw)) continue;
      // "100+ stores" means > 100, bump by 1 to cross band boundary
      if (/\d\+/.test(m[0])) num = num + 1;
      if (num >= 2 && num < 100000 && !isLikelyYear(num) && !hasNegativeContext(text, m.index, m[0].length) && num > best) {
        best = num;
      }
    }
  }

  // If no large headline count found, check for per-city "N stores" pattern and sum them.
  // Pages like "Delhi - 4 stores, Mumbai - 8 stores, ..." list per-city counts.
  if (best <= 20) {
    const perCityRx = /(\d{1,2})\s+stores?\b/gi;
    let cm;
    const perCityCounts = [];
    while ((cm = perCityRx.exec(text)) !== null) {
      const n = parseInt(cm[1], 10);
      if (n >= 1 && n <= 50) perCityCounts.push(n);
    }
    if (perCityCounts.length >= 3) {
      const sum = perCityCounts.reduce((a, b) => a + b, 0);
      if (sum > best) best = sum;
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
  const parts = hostname.replace(/^www\d*\./, '').split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

function getBrandName(hostname) {
  // Extract brand name from hostname: "www.snitch.co.in" -> "snitch", "boat-lifestyle.com" -> "boat-lifestyle"
  const parts = hostname.replace(/^www\d*\./, '').split('.');
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

  // Check both HTML href attributes and JSON "url" values
  // Collect all candidates and pick the best (shortest path = most direct)
  const candidates = [];
  const urlPatterns = [/href=["']([^"']+)["']/gi, /"url"\s*:\s*"([^"]+)"/gi];
  for (const urlRx of urlPatterns) {
    let m;
    while ((m = urlRx.exec(html)) !== null) {
      const href = m[1];
      // Skip static assets (JS, CSS, images, fonts)
      if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)(\?|$)/i.test(href)) continue;
      try {
        const resolved = new URL(href, baseUrl);
        const hrefRoot = getRootDomain(resolved.hostname);
        const hrefBrand = getBrandName(resolved.hostname);
        if (hrefRoot !== baseRoot && !href.startsWith('/') && !href.startsWith('#') && hrefBrand !== baseBrand) continue;
      } catch { continue; }
      for (const pattern of STORE_LOCATOR_PATTERNS) {
        if (pattern.test(href)) {
          try {
            candidates.push(new URL(href, baseUrl).href);
          } catch {}
          break;
        }
      }
    }
  }
  if (candidates.length === 0) return null;
  // Prefer shortest URL (most direct store page, avoids /stores/restaurant/ over /stores/)
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

/**
 * Extract header, footer, and nav sections from HTML.
 * Falls back to first/last 15% of HTML if semantic tags not found.
 */
function extractHeaderFooter(html) {
  const sections = [];

  // Extract <header>...</header>
  const headerRx = /<header[\s>][\s\S]*?<\/header>/gi;
  let m;
  while ((m = headerRx.exec(html)) !== null) sections.push(m[0]);

  // Extract <footer>...</footer>
  const footerRx = /<footer[\s>][\s\S]*?<\/footer>/gi;
  while ((m = footerRx.exec(html)) !== null) sections.push(m[0]);

  // Extract <nav>...</nav>
  const navRx = /<nav[\s>][\s\S]*?<\/nav>/gi;
  while ((m = navRx.exec(html)) !== null) sections.push(m[0]);

  // If no semantic tags found, use first 15% + last 15% of HTML as approximation
  if (sections.length === 0) {
    const len = html.length;
    const chunk = Math.max(5000, Math.floor(len * 0.15));
    sections.push(html.slice(0, chunk));
    if (len > chunk * 2) sections.push(html.slice(-chunk));
  }

  return sections.join('\n');
}

/**
 * Find store/location link only in header, footer, and nav sections.
 * Also matches anchor text like "Stores", "Find a Store", "Our Locations", etc.
 */
function findStoreLocatorInHeaderFooter(html, baseUrl) {
  const headerFooterHtml = extractHeaderFooter(html);

  // First try: look for store links via URL patterns (existing approach but header/footer only)
  const urlResult = findStoreLocatorLink(headerFooterHtml, baseUrl);
  if (urlResult) return urlResult;

  // Second try: look for anchor text that mentions stores/locations
  let baseRoot = '';
  let baseBrand = '';
  try {
    const parsed = new URL(baseUrl);
    baseRoot = getRootDomain(parsed.hostname);
    baseBrand = getBrandName(parsed.hostname);
  } catch {}

  const STORE_TEXT_KEYWORDS = /\b(?:stores?|locations?|outlets?|showrooms?|branches?|find\s+(?:a\s+)?store|store\s+(?:locator|finder)|our\s+stores?|visit\s+us|where\s+to\s+buy|locate\s+us|find\s+us|retail\s+stores?|experience\s+(?:centre|center)s?|store\s+locator)\b/i;

  const anchorRx = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const candidates = [];
  let am;
  while ((am = anchorRx.exec(headerFooterHtml)) !== null) {
    const href = am[1];
    const anchorText = am[2].replace(/<[^>]+>/g, '').trim();

    if (!STORE_TEXT_KEYWORDS.test(anchorText)) continue;
    if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)(\?|$)/i.test(href)) continue;
    if (href === '#' || href === '/' || href === '') continue;

    try {
      const resolved = new URL(href, baseUrl);
      const hrefRoot = getRootDomain(resolved.hostname);
      const hrefBrand = getBrandName(resolved.hostname);
      if (hrefRoot !== baseRoot && !href.startsWith('/') && hrefBrand !== baseBrand) continue;
      candidates.push(resolved.href);
    } catch {}
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

function countStoreElements(html) {
  let count = 0;

  const addressBlocks = (html.match(/<address[\s\S]*?<\/address>/gi) || []).length;
  if (addressBlocks > 1) count = Math.max(count, addressBlocks);

  const mapPins = (html.match(/(?:marker|pin|LatLng|latitude|lat)\s*[:"]\s*[\d.-]+/gi) || []).length;
  if (mapPins > 2) count = Math.max(count, Math.floor(mapPins / 2));

  // Count directions links via unique URLs (deduped — most reliable: 1 unique URL = 1 store)
  const dirHrefSet = new Set();
  const dirHrefRx = /href=["']([^"']*(?:google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)[^"']*)["']/gi;
  let _dh;
  while ((_dh = dirHrefRx.exec(html)) !== null) {
    dirHrefSet.add(_dh[1].split('?')[0]);
  }
  const directionsLinks = dirHrefSet.size > 0 ? dirHrefSet.size
    : (html.match(/(?:get\s*directions?|google\.com\/maps\?|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)/gi) || []).length;
  if (directionsLinks > 1) count = Math.max(count, directionsLinks);

  // Count unique store names from BEM __name elements (deduped by text — most reliable)
  const storeNameElRx = /class=["'][^"']*(?:store|location|outlet|branch|shop)s?(?:[-_]{1,2})name[^"']*["'][^>]*>([^<]+)</gi;
  const uniqueNames = new Set();
  let _snm;
  while ((_snm = storeNameElRx.exec(html)) !== null) {
    const n = _snm[1].trim();
    if (n && n.length > 2 && n.length < 60) uniqueNames.add(n);
  }
  if (uniqueNames.size > 1) {
    // Deduped names are most accurate — prefer over raw card counts
    count = Math.max(count, uniqueNames.size);
  } else if (directionsLinks <= 1) {
    // Fall back to raw card element counting
    const storeCards = (html.match(/class=["'][^"']*(?:store|location|outlet|branch|dealer|showroom|shop)(?:[-_]{1,2})(?:card|item|listing|detail|box|tile|entry|block|row)[^"']*["']/gi) || []).length;
    if (storeCards > 1) count = Math.max(count, storeCards);
  }

  // Only count pincode/zip patterns when they appear alongside address context (not standalone delivery pincodes)
  const addressKeywords = (html.match(/(?:address|street|road|lane|nagar|colony|sector|block)[\s\S]{0,200}?(?:pincode|pin\s*code|zip\s*code|postal\s*code)\s*[:\s]*\d{5,6}/gi) || []).length;
  if (addressKeywords > 1) count = Math.max(count, addressKeywords);

  // Count phone number patterns only when they appear near store/address context
  const phoneWithContext = (html.match(/(?:store|outlet|branch|showroom|address|location)[\s\S]{0,300}?(?:\+91[\s-]?\d{10}|\+\d{1,3}[\s-]\d{3,4}[\s-]\d{3,4}[\s-]?\d{0,4})/gi) || []).length;
  if (phoneWithContext > 2) count = Math.max(count, phoneWithContext);

  // Count data attributes that indicate store entries
  const dataAttrs = (html.match(/data-(?:store|location|outlet|branch|shop|dealer|showroom)[-_]?(?:id|index|name|slug)\s*=/gi) || []).length;
  if (dataAttrs > 1) count = Math.max(count, dataAttrs);

  // Count Google Maps embed iframes (each iframe = likely 1 store)
  const mapEmbeds = (html.match(/(?:<iframe[^>]*google\.com\/maps[^>]*>|<iframe[^>]*maps\.google[^>]*>)/gi) || []).length;
  if (mapEmbeds > 1) count = Math.max(count, mapEmbeds);

  // Count individual store page links (e.g. /pages/location-beverly-hills, /stores/nyc)
  const storePageLinks = new Set();
  const storePageRx = /href=["']([^"']*(?:\/(?:pages\/)?location[-/][^"']+|\/stores?\/[a-z][-a-z0-9]+))["']/gi;
  let spm;
  while ((spm = storePageRx.exec(html)) !== null) {
    const href = spm[1].split('?')[0].split('#')[0];
    // Skip generic pages like /pages/locations (the listing page itself)
    if (!/locations?\/?$/.test(href)) storePageLinks.add(href);
  }
  if (storePageLinks.size > 1) count = Math.max(count, storePageLinks.size);

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
        const keys = Object.keys(sample).map(k => k.toLowerCase());
        // Require exact key names that indicate store/location data — not substring matches
        const hasLocationKey = keys.some(k =>
          k === 'lat' || k === 'lng' || k === 'latitude' || k === 'longitude' ||
          k === 'address' || k === 'city' || k === 'store' || k === 'location' ||
          k === 'phone' || k === 'zip' || k === 'pincode' || k === 'storename' ||
          k === 'store_name' || k === 'store_id' || k === 'storeid' ||
          k === 'addressline1' || k === 'address_line_1' || k === 'streetaddress' ||
          k === 'postalcode' || k === 'postal_code' || k === 'zipcode'
        );
        if (hasLocationKey) {
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

// ── ISO 3166-2 state/region maps ──────────────────────────────────────
const INDIA_STATE_MAP = {
  'IN-AP': 'Andhra Pradesh', 'IN-AR': 'Arunachal Pradesh', 'IN-AS': 'Assam',
  'IN-BR': 'Bihar', 'IN-CT': 'Chhattisgarh', 'IN-GA': 'Goa',
  'IN-GJ': 'Gujarat', 'IN-HR': 'Haryana', 'IN-HP': 'Himachal Pradesh',
  'IN-JH': 'Jharkhand', 'IN-KA': 'Karnataka', 'IN-KL': 'Kerala',
  'IN-MP': 'Madhya Pradesh', 'IN-MH': 'Maharashtra', 'IN-MN': 'Manipur',
  'IN-ML': 'Meghalaya', 'IN-MZ': 'Mizoram', 'IN-NL': 'Nagaland',
  'IN-OR': 'Odisha', 'IN-PB': 'Punjab', 'IN-RJ': 'Rajasthan',
  'IN-SK': 'Sikkim', 'IN-TN': 'Tamil Nadu', 'IN-TG': 'Telangana',
  'IN-TR': 'Tripura', 'IN-UP': 'Uttar Pradesh', 'IN-UT': 'Uttarakhand',
  'IN-WB': 'West Bengal',
  'IN-AN': 'Andaman & Nicobar Islands', 'IN-CH': 'Chandigarh',
  'IN-DN': 'Dadra & Nagar Haveli and Daman & Diu', 'IN-DL': 'Delhi',
  'IN-JK': 'Jammu & Kashmir', 'IN-LA': 'Ladakh', 'IN-LD': 'Lakshadweep',
  'IN-PY': 'Puducherry',
};

const US_STATE_MAP = {
  'US-AL': 'Alabama', 'US-AK': 'Alaska', 'US-AZ': 'Arizona', 'US-AR': 'Arkansas',
  'US-CA': 'California', 'US-CO': 'Colorado', 'US-CT': 'Connecticut', 'US-DE': 'Delaware',
  'US-FL': 'Florida', 'US-GA': 'Georgia', 'US-HI': 'Hawaii', 'US-ID': 'Idaho',
  'US-IL': 'Illinois', 'US-IN': 'Indiana', 'US-IA': 'Iowa', 'US-KS': 'Kansas',
  'US-KY': 'Kentucky', 'US-LA': 'Louisiana', 'US-ME': 'Maine', 'US-MD': 'Maryland',
  'US-MA': 'Massachusetts', 'US-MI': 'Michigan', 'US-MN': 'Minnesota', 'US-MS': 'Mississippi',
  'US-MO': 'Missouri', 'US-MT': 'Montana', 'US-NE': 'Nebraska', 'US-NV': 'Nevada',
  'US-NH': 'New Hampshire', 'US-NJ': 'New Jersey', 'US-NM': 'New Mexico', 'US-NY': 'New York',
  'US-NC': 'North Carolina', 'US-ND': 'North Dakota', 'US-OH': 'Ohio', 'US-OK': 'Oklahoma',
  'US-OR': 'Oregon', 'US-PA': 'Pennsylvania', 'US-RI': 'Rhode Island', 'US-SC': 'South Carolina',
  'US-SD': 'South Dakota', 'US-TN': 'Tennessee', 'US-TX': 'Texas', 'US-UT': 'Utah',
  'US-VT': 'Vermont', 'US-VA': 'Virginia', 'US-WA': 'Washington', 'US-WV': 'West Virginia',
  'US-WI': 'Wisconsin', 'US-WY': 'Wyoming', 'US-DC': 'District of Columbia',
};

const UK_REGION_MAP = {
  'GB-ENG': 'England', 'GB-SCT': 'Scotland', 'GB-WLS': 'Wales', 'GB-NIR': 'Northern Ireland',
};

const AU_STATE_MAP = {
  'AU-NSW': 'New South Wales', 'AU-VIC': 'Victoria', 'AU-QLD': 'Queensland',
  'AU-WA': 'Western Australia', 'AU-SA': 'South Australia', 'AU-TAS': 'Tasmania',
  'AU-ACT': 'Australian Capital Territory', 'AU-NT': 'Northern Territory',
};

const ALL_STATE_MAPS = [INDIA_STATE_MAP, US_STATE_MAP, UK_REGION_MAP, AU_STATE_MAP];

// All Indian states/UTs as a sorted list for filter options
const INDIA_STATES = Object.values(INDIA_STATE_MAP).sort();

// Major Indian cities → state mapping for automatic state derivation
const INDIA_CITY_STATE = {
  // Maharashtra
  'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra', 'thane': 'Maharashtra',
  'nashik': 'Maharashtra', 'aurangabad': 'Maharashtra', 'solapur': 'Maharashtra', 'kolhapur': 'Maharashtra',
  'navi mumbai': 'Maharashtra', 'vasai-virar': 'Maharashtra', 'amravati': 'Maharashtra',
  // Delhi
  'delhi': 'Delhi', 'new delhi': 'Delhi', 'noida': 'Uttar Pradesh', 'greater noida': 'Uttar Pradesh',
  'gurgaon': 'Haryana', 'gurugram': 'Haryana', 'faridabad': 'Haryana', 'ghaziabad': 'Uttar Pradesh',
  // Karnataka
  'bangalore': 'Karnataka', 'bengaluru': 'Karnataka', 'mysore': 'Karnataka', 'mysuru': 'Karnataka',
  'hubli': 'Karnataka', 'mangalore': 'Karnataka', 'mangaluru': 'Karnataka', 'belgaum': 'Karnataka',
  // Tamil Nadu
  'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu', 'tiruchirappalli': 'Tamil Nadu',
  'salem': 'Tamil Nadu', 'tirunelveli': 'Tamil Nadu', 'erode': 'Tamil Nadu', 'vellore': 'Tamil Nadu',
  // Telangana
  'hyderabad': 'Telangana', 'secunderabad': 'Telangana', 'warangal': 'Telangana', 'karimnagar': 'Telangana',
  // West Bengal
  'kolkata': 'West Bengal', 'howrah': 'West Bengal', 'durgapur': 'West Bengal', 'siliguri': 'West Bengal',
  'asansol': 'West Bengal',
  // Gujarat
  'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'vadodara': 'Gujarat', 'rajkot': 'Gujarat',
  'gandhinagar': 'Gujarat', 'bhavnagar': 'Gujarat', 'jamnagar': 'Gujarat', 'junagadh': 'Gujarat',
  // Rajasthan
  'jaipur': 'Rajasthan', 'jodhpur': 'Rajasthan', 'udaipur': 'Rajasthan', 'kota': 'Rajasthan',
  'ajmer': 'Rajasthan', 'bikaner': 'Rajasthan', 'bhilwara': 'Rajasthan',
  // Uttar Pradesh
  'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh', 'agra': 'Uttar Pradesh', 'varanasi': 'Uttar Pradesh',
  'prayagraj': 'Uttar Pradesh', 'allahabad': 'Uttar Pradesh', 'meerut': 'Uttar Pradesh', 'bareilly': 'Uttar Pradesh',
  'aligarh': 'Uttar Pradesh', 'moradabad': 'Uttar Pradesh', 'gorakhpur': 'Uttar Pradesh',
  // Madhya Pradesh
  'bhopal': 'Madhya Pradesh', 'indore': 'Madhya Pradesh', 'jabalpur': 'Madhya Pradesh', 'gwalior': 'Madhya Pradesh',
  'ujjain': 'Madhya Pradesh', 'rewa': 'Madhya Pradesh',
  // Bihar
  'patna': 'Bihar', 'gaya': 'Bihar', 'muzaffarpur': 'Bihar', 'bhagalpur': 'Bihar',
  // Punjab
  'chandigarh': 'Chandigarh', 'ludhiana': 'Punjab', 'amritsar': 'Punjab', 'jalandhar': 'Punjab',
  'patiala': 'Punjab', 'bathinda': 'Punjab', 'mohali': 'Punjab',
  // Haryana
  'ambala': 'Haryana', 'karnal': 'Haryana', 'panipat': 'Haryana', 'hisar': 'Haryana',
  'rohtak': 'Haryana', 'sonipat': 'Haryana',
  // Kerala
  'kochi': 'Kerala', 'cochin': 'Kerala', 'thiruvananthapuram': 'Kerala', 'trivandrum': 'Kerala',
  'kozhikode': 'Kerala', 'calicut': 'Kerala', 'thrissur': 'Kerala', 'kollam': 'Kerala',
  // Andhra Pradesh
  'visakhapatnam': 'Andhra Pradesh', 'vizag': 'Andhra Pradesh', 'vijayawada': 'Andhra Pradesh',
  'guntur': 'Andhra Pradesh', 'nellore': 'Andhra Pradesh', 'tirupati': 'Andhra Pradesh',
  'amaravati': 'Andhra Pradesh',
  // Odisha
  'bhubaneswar': 'Odisha', 'cuttack': 'Odisha', 'rourkela': 'Odisha',
  // Assam
  'guwahati': 'Assam', 'dibrugarh': 'Assam', 'silchar': 'Assam',
  // Jharkhand
  'ranchi': 'Jharkhand', 'jamshedpur': 'Jharkhand', 'dhanbad': 'Jharkhand', 'bokaro': 'Jharkhand',
  // Chhattisgarh
  'raipur': 'Chhattisgarh', 'bhilai': 'Chhattisgarh', 'bilaspur': 'Chhattisgarh',
  // Uttarakhand
  'dehradun': 'Uttarakhand', 'haridwar': 'Uttarakhand', 'rishikesh': 'Uttarakhand',
  'nainital': 'Uttarakhand', 'haldwani': 'Uttarakhand',
  // Goa
  'panaji': 'Goa', 'margao': 'Goa', 'vasco da gama': 'Goa',
  // Himachal Pradesh
  'shimla': 'Himachal Pradesh', 'manali': 'Himachal Pradesh', 'dharamshala': 'Himachal Pradesh',
  // Jammu & Kashmir
  'srinagar': 'Jammu & Kashmir', 'jammu': 'Jammu & Kashmir',
  // Tripura
  'agartala': 'Tripura',
  // Meghalaya
  'shillong': 'Meghalaya',
  // Manipur
  'imphal': 'Manipur',
  // Mizoram
  'aizawl': 'Mizoram',
  // Nagaland
  'kohima': 'Nagaland', 'dimapur': 'Nagaland',
  // Arunachal Pradesh
  'itanagar': 'Arunachal Pradesh',
  // Sikkim
  'gangtok': 'Sikkim',
  // Puducherry
  'pondicherry': 'Puducherry', 'puducherry': 'Puducherry',
};

function normalizeStateCode(code) {
  const upper = code.toUpperCase().trim();
  for (const map of ALL_STATE_MAPS) {
    if (map[upper]) return map[upper];
  }
  return null;
}

// ── extractLocation: derive country, state, city from meta + JSON-LD ──

/**
 * Validate that a value looks like a real city/state name, not a brand or junk.
 * Rejects: brand names ("Lifestyle Stores"), URLs, long strings, all-caps codes, etc.
 */
function isValidLocationName(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 2 || v.length > 50) return false;
  // Reject URLs
  if (/^https?:\/\//i.test(v)) return false;
  // Reject if contains "store", "shop", "brand", "mart", "depot", "outlet", "online", "mall"
  if (/\b(?:stores?|shops?|brands?|marts?|depots?|outlets?|online|malls?|ltd|pvt|inc|llc|corp|limited|private|enterprises?|solutions?|services?|technologies?|industries?|group|locator|finder|shopping|centre|center)\b/i.test(v)) return false;
  // Reject if it looks like a domain name
  if (/\.(com|in|org|net|io|co)\b/i.test(v)) return false;
  // Reject if all uppercase and > 5 chars (likely a code or acronym, not a city)
  if (v.length > 5 && v === v.toUpperCase()) return false;
  return true;
}

function extractLocation(metaMap, jsonLdAddressItems) {
  let country = null;
  let state = null;
  let city = null;

  // 1. geo.region meta tag — e.g. "IN-MH"
  const geoRegion = metaMap['geo.region'] || '';
  if (geoRegion) {
    const parts = geoRegion.split('-');
    if (parts.length >= 1 && !country) {
      country = normalizeCountryCode(parts[0]);
    }
    if (parts.length >= 2 && !state) {
      state = normalizeStateCode(geoRegion) || parts.slice(1).join('-');
    }
  }

  // 2. geo.placename → city
  const geoPlace = metaMap['geo.placename'] || '';
  if (geoPlace && !city && isValidLocationName(geoPlace)) city = geoPlace.trim();

  // 3. Direct meta tags
  if (metaMap['city'] && !city && isValidLocationName(metaMap['city'])) city = metaMap['city'].trim();
  if (metaMap['state'] && !state && isValidLocationName(metaMap['state'])) state = metaMap['state'].trim();
  if (metaMap['country'] && !country) country = normalizeCountry(metaMap['country']);

  // 4. OG business tags
  if (metaMap['business:contact_data:locality'] && !city && isValidLocationName(metaMap['business:contact_data:locality'])) city = metaMap['business:contact_data:locality'].trim();
  if (metaMap['business:contact_data:region'] && !state && isValidLocationName(metaMap['business:contact_data:region'])) state = metaMap['business:contact_data:region'].trim();
  if (metaMap['business:contact_data:country_name'] && !country) country = normalizeCountry(metaMap['business:contact_data:country_name']);

  // 5. og:country-name
  if (metaMap['og:country-name'] && !country) country = normalizeCountry(metaMap['og:country-name']);

  // 6. location meta tag — "City, State, Country"
  const locMeta = metaMap['location'] || '';
  if (locMeta) {
    const locParts = locMeta.split(',').map(s => s.trim()).filter(Boolean);
    if (locParts.length >= 3) {
      if (!city && isValidLocationName(locParts[0])) city = locParts[0];
      if (!state && isValidLocationName(locParts[1])) state = locParts[1];
      if (!country) country = normalizeCountry(locParts[2]);
    } else if (locParts.length === 2) {
      if (!city && isValidLocationName(locParts[0])) city = locParts[0];
      if (!country) country = normalizeCountry(locParts[1]);
    }
  }

  // 7. JSON-LD addresses
  if (Array.isArray(jsonLdAddressItems)) {
    for (const addr of jsonLdAddressItems) {
      if (addr.addressLocality && !city && isValidLocationName(addr.addressLocality)) city = addr.addressLocality.trim();
      if (addr.addressRegion && !state && isValidLocationName(addr.addressRegion)) state = addr.addressRegion.trim();
      if (addr.addressCountry && !country) country = normalizeCountry(addr.addressCountry.toString());
    }
  }

  // 8. Extract city from title/description by matching known Indian city names
  if (!city) {
    const textToSearch = [
      metaMap['og:title'] || '', metaMap['title'] || '',
      metaMap['description'] || '', metaMap['og:description'] || '',
    ].join(' ').toLowerCase();
    if (textToSearch.length > 5) {
      // Check for "in <city>" pattern first, then standalone city names
      for (const [cityName] of Object.entries(INDIA_CITY_STATE)) {
        const rx = new RegExp(`\\bin\\s+${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (rx.test(textToSearch)) {
          city = cityName.charAt(0).toUpperCase() + cityName.slice(1);
          break;
        }
      }
    }
  }

  // Auto-derive state from city for Indian brands using city→state mapping
  if (city && !state) {
    const cityLower = city.toLowerCase().trim();
    if (INDIA_CITY_STATE[cityLower]) {
      state = INDIA_CITY_STATE[cityLower];
      if (!country) country = 'India';
    }
  }

  return { country: country || null, state: state || null, city: city || null };
}

// ── Business Model Detection ──────────────────────────────────────────────
// Classifies brands as: Pure D2C, Omnichannel, D2C + Marketplace, D2C + B2B

const MARKETPLACE_DOMAINS = [
  'amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.ca', 'amazon.com.au',
  'flipkart.com', 'myntra.com', 'ajio.com', 'nykaa.com', 'meesho.com', 'snapdeal.com',
  'ebay.com', 'ebay.co.uk', 'etsy.com', 'walmart.com', 'target.com',
  'lazada.com', 'shopee.com', 'tokopedia.com', 'bukalapak.com',
  'zalando.com', 'asos.com', 'aboutyou.com',
  'jd.com', 'taobao.com', 'tmall.com', 'aliexpress.com',
  'tatacliq.com', 'reliancedigital.in', 'croma.com',
  'firstcry.com', 'purplle.com', 'bigbasket.com', 'blinkit.com',
  'noon.com', 'souq.com', 'jumia.com',
];

const MARKETPLACE_RE = new RegExp(
  MARKETPLACE_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|'), 'i'
);

const B2B_KEYWORDS = [
  'wholesale', 'bulk order', 'bulk orders', 'bulk pricing', 'bulk enquiry', 'bulk inquiry',
  'distributor', 'distributors', 'dealership', 'franchise', 'franchisee',
  'b2b', 'business to business', 'enterprise', 'corporate order', 'corporate orders',
  'trade account', 'trade enquiry', 'trade inquiry', 'trade customer',
  'reseller', 'resellers', 'white label', 'private label',
  'oem', 'manufacturing partner', 'supply partner',
  'institutional', 'institutional order', 'institutional sales',
  'become a dealer', 'become a distributor', 'become a partner',
  'partner with us', 'dealer enquiry', 'dealer login',
];

const B2B_RE = new RegExp(B2B_KEYWORDS.join('|'), 'i');

const MARKETPLACE_LINK_TEXTS = [
  'buy on amazon', 'available on amazon', 'shop on amazon', 'amazon.in', 'amazon.com',
  'buy on flipkart', 'available on flipkart', 'shop on flipkart',
  'buy on myntra', 'available on myntra', 'shop on myntra',
  'buy on nykaa', 'available on nykaa', 'shop on nykaa',
  'buy on ajio', 'available on ajio',
  'available on', 'buy now on', 'shop now on',
  'also available at', 'find us on',
];

const MARKETPLACE_LINK_RE = new RegExp(MARKETPLACE_LINK_TEXTS.join('|'), 'i');

function detectBusinessModel(html, url, offlineStores, technologies) {
  const hasOfflineStores = offlineStores && offlineStores !== 'Online' && offlineStores !== 'Unknown';

  // Check for ecommerce platform (must have a shop to be D2C)
  const techNames = (technologies || []).map(t => t.name?.toLowerCase() || '');
  const techCats = (technologies || []).map(t => t.category?.toLowerCase() || '');
  const hasEcommerce = techCats.some(c => c.includes('ecommerce') || c.includes('e-commerce')) ||
    techNames.some(n => ['shopify', 'woocommerce', 'magento', 'bigcommerce', 'opencart', 'prestashop',
      'shopware', 'saleor', 'medusa', 'commercetools', 'vtex', 'nuvemshop',
      'razorpay', 'stripe', 'paypal', 'payu', 'cashfree', 'instamojo'].includes(n));

  // Parse HTML for signals
  const bodyText = (html || '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 15000).toLowerCase();

  // Extract all href values from HTML
  const hrefMatches = (html || '').match(/href=["']([^"']+)["']/gi) || [];
  const allHrefs = hrefMatches.map(h => h.replace(/href=["']/i, '').replace(/["']$/, '')).join(' ');

  // Marketplace signals
  const hasMarketplaceLinks = MARKETPLACE_RE.test(allHrefs);
  const hasMarketplaceText = MARKETPLACE_LINK_RE.test(bodyText);
  const hasMarketplace = hasMarketplaceLinks || hasMarketplaceText;

  // B2B signals
  const hasB2B = B2B_RE.test(bodyText);

  // Footer/nav links often have "Available on Amazon" etc.
  const navFooter = ((html || '').match(/<(?:nav|footer)[\s\S]*?<\/(?:nav|footer)>/gi) || [])
    .join(' ').toLowerCase();
  const hasMarketplaceInNav = MARKETPLACE_RE.test(navFooter) || MARKETPLACE_LINK_RE.test(navFooter);

  // Determine business model
  if (hasOfflineStores && hasMarketplace) return 'Omnichannel';
  if (hasOfflineStores && hasB2B) return 'Omnichannel';
  if (hasOfflineStores) return 'Omnichannel';
  if (hasMarketplace && hasB2B) return 'D2C + Marketplace';
  if (hasMarketplace || hasMarketplaceInNav) return 'D2C + Marketplace';
  if (hasB2B) return 'D2C + B2B';
  if (hasEcommerce) return 'Pure D2C';

  return null;
}

async function extractCompanyMeta({ url, html, headers, metaMap, technologies, fetchPage, browserFetch, forceRefresh }) {
  const normalizedDomain = url.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/.*$/, '').toLowerCase();

  await ensureOverrides();

  const quickFetch = fetchPage ? (fetchUrl) => {
    return Promise.race([
      fetchPage(fetchUrl).catch(err => {
        // On 403/503 (bot protection), fall back to browser fetch
        if (browserFetch && [403, 503].includes(err.response?.status)) {
          return browserFetch(fetchUrl).then(r => ({ data: r.html || '', headers: r.headers || {} }));
        }
        throw err;
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
  } : null;

  // Check known brand database (highest priority)
  const knownBrand = lookupKnownBrand(normalizedDomain);

  try {
    const db = await getDb();
    const cached = await db.collection('company_meta').findOne({ normalizedDomain });

    // If known brand exists and DB has wrong/missing category, fix DB immediately
    if (knownBrand && cached && (!cached.category || cached.category === 'Unknown' || cached.category !== knownBrand.category)) {
      const fixFields = {
        category: knownBrand.category,
        subCategory: knownBrand.subCategory || cached.subCategory || 'General',
      };
      if (knownBrand.region) fixFields.region = knownBrand.region;
      if (knownBrand.onlineOnly) fixFields.offlineStores = 'Online';
      else if (knownBrand.stores) fixFields.offlineStores = knownBrand.stores;
      await db.collection('company_meta').updateOne(
        { normalizedDomain },
        { $set: fixFields }
      ).catch(() => {});
      // Merge fix into cached object so the return below is correct
      Object.assign(cached, fixFields);
    }

    if (!forceRefresh && cached && cached.expiresAt && new Date(cached.expiresAt) > new Date()) {
      // If category is still Unknown after known-brand fix, skip cache — force re-analysis
      const cachedCategory = knownBrand?.category || cached.overrides?.category || cached.category;
      if (cachedCategory === 'Unknown' || !cachedCategory) {
        // Don't use cache — fall through to re-analyze with keywords
      } else {
        // Skip cache if store data was from unreliable fallback (needs re-detection with improved logic)
        const storeSource = cached.storeConfidence?.source;
        const isStoreDataWeak = storeSource === 'header_footer_link' || storeSource === 'timeout'
          || storeSource === 'known_brand'
          || (!storeSource && cached.offlineStores && cached.offlineStores !== 'Online' && (cached.storeRawCount || 0) === 0);
        if (!isStoreDataWeak) {
          const result = {
            category:      knownBrand?.category  || cached.overrides?.category    || cached.category,
            subCategory:   knownBrand?.subCategory || cached.overrides?.subCategory || cached.subCategory,
            region:        knownBrand?.region || cached.overrides?.region || cached.region,
            state:         cached.state || null,
            city:          cached.city || null,
            offlineStores: knownBrand?.onlineOnly ? 'Online' : (cached.overrides?.offlineStores || cached.offlineStores || knownBrand?.stores),
            storeRawCount: cached.storeRawCount || 0,
            storeConfidence: cached.storeConfidence || (knownBrand?.stores || knownBrand?.onlineOnly
              ? { score: 90, tier: 'high', source: 'known_brand', flags: [] }
              : null),
            businessModel: cached.businessModel || null,
          };
          return result;
        }
      }
    }
  } catch {}

  const jsonLd = extractJsonLd(html);
  const metaResults = extractFromMeta(html, metaMap || {});
  const keywords = analyzeKeywords(html, url, metaResults);
  const techHints = inferFromTech(technologies || []);

  let region = detectRegion(
    url, html, metaMap || {},
    techHints.region,
    jsonLd.region,
    metaResults.region,
    techHints
  );

  // Extract granular location (country, state, city)
  const location = extractLocation(metaMap || {}, jsonLd.addressItems || []);
  if (location.country && (!region || region === 'Global' || region === 'Unknown')) {
    region = location.country;
  }
  let state = location.state || jsonLd.state || null;
  let city = location.city || jsonLd.city || null;

  // ── Refine region granularity: city-level vs country-level vs Global ──
  // Only use title, description, and header/footer for scope signals (not full body which has marketing copy)
  const titleDesc = [
    metaMap?.['og:title'] || '', metaMap?.['title'] || '',
    metaMap?.['description'] || '', metaMap?.['og:description'] || '',
  ].join(' ').toLowerCase();
  const headerFooterText = extractHeaderFooter(html).replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').toLowerCase().slice(0, 20000);
  const scopeText = titleDesc + ' ' + headerFooterText;

  // Signals that the brand is national-level (pan-country)
  const NATIONAL_SIGNALS = /\b(?:pan[\s-]?india|across\s+india|all\s+over\s+india|india[\s-]?wide|across\s+the\s+country|stores?\s+(?:in|across)\s+\d{2,}\s+cit(?:y|ies)|(?:100|200|300|500|1000)\+?\s+(?:stores?|outlets?|locations?|cities?)|deliver(?:y|ing)?\s+(?:across|all\s+over)\s+india)\b/i;
  // Signals that the brand is global (multi-country)
  const GLOBAL_SIGNALS = /\b(?:(?:across|in)\s+\d{2,}\s+countr(?:y|ies)|global\s+(?:presence|reach|operations?))\b/i;

  // Count how many distinct Indian cities/states are mentioned in title/description
  let citiesMentioned = 0;
  if (city && region && /india/i.test(region)) {
    const cityNames = Object.keys(INDIA_CITY_STATE);
    const mentionedStates = new Set();
    for (const cn of cityNames) {
      const rx = new RegExp(`\\b${cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (rx.test(titleDesc)) {
        mentionedStates.add(INDIA_CITY_STATE[cn]);
      }
    }
    citiesMentioned = mentionedStates.size;
  }

  // Refine region based on scope
  if (GLOBAL_SIGNALS.test(scopeText)) {
    region = 'Global';
  }
  // Otherwise region stays as country name (India, US, etc.)
  // City-level granularity is stored in the city field, not region

  // Try to resolve category from direct meta tag declaration (e.g. <meta name="category" content="Fashion">)
  let metaDirectCategory = null;
  if (metaResults.metaCategory) {
    const mc = metaResults.metaCategory.toLowerCase();
    for (const [industry, kws] of Object.entries(INDUSTRY_KEYWORDS)) {
      if (mc.includes(industry.toLowerCase()) || kws.some(kw => mc.includes(kw))) {
        metaDirectCategory = industry;
        break;
      }
    }
  }

  let category;
  if (knownBrand) {
    category = knownBrand.category;
  } else {
    category = jsonLd.category || metaDirectCategory || keywords.category || jsonLd.genericCategory || metaResults.category || techHints.category || 'Unknown';
  }

  let subCategory;
  if (knownBrand) {
    subCategory = knownBrand.subCategory;
  } else if (techHints.subCategory) {
    subCategory = techHints.subCategory;
  } else {
    subCategory = keywords.subCategory || techHints.subCategory || 'General';
  }

  if (subCategory === 'General' && category !== 'Unknown' && SUB_INDUSTRY_KEYWORDS[category]) {
    const titleText = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').toLowerCase();
    const descText = ((/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html) || [])[1] || '').toLowerCase();
    const ogTitleText = (metaResults.ogTitle || '').toLowerCase();
    const ogDescText = (metaResults.ogDescription || '').toLowerCase();
    let bodyText = '';
    const bodyM = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (bodyM) {
      bodyText = bodyM[1].replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000).toLowerCase();
    }
    const subTextParts = [
      { text: titleText, weight: 5 },
      { text: ogTitleText && ogTitleText !== titleText ? ogTitleText : '', weight: 4 },
      { text: descText, weight: 3 },
      { text: ogDescText && ogDescText !== descText ? ogDescText : '', weight: 3 },
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

  // If category is Ecommerce but subcategory is still General, try to determine
  // the actual product niche from page content across all known product categories
  if (subCategory === 'General' && (category === 'Ecommerce/Retail' || techHints.category === 'Ecommerce/Retail')) {
    const titleText = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').toLowerCase();
    const descText = ((/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html) || [])[1] || '').toLowerCase();
    const ogTitleText2 = (metaResults.ogTitle || '').toLowerCase();
    const ogDescText2 = (metaResults.ogDescription || '').toLowerCase();
    let bodySnippet = '';
    const bodyM2 = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (bodyM2) {
      bodySnippet = bodyM2[1].replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000).toLowerCase();
    }
    // Extract nav text for product category hints
    const navText2 = (html.match(/<nav[\s\S]*?<\/nav>/gi) || [])
      .join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000).toLowerCase();

    // Map product keywords to specific subcategories
    const PRODUCT_SUBCATEGORIES = [
      { sub: 'Fashion & Apparel',    kws: ['clothing', 'apparel', 'fashion', 'dress', 'kurta', 'tshirt', 't-shirt', 'shirt', 'hoodie', 'jacket', 'menswear', 'womenswear', 'outfit', 'garment', 'trouser', 'jeans'] },
      { sub: 'Shoes & Sneakers',     kws: ['shoe', 'shoes', 'sneaker', 'sneakers', 'footwear', 'sandal', 'boot', 'loafer', 'slipper'] },
      { sub: 'Beauty & Skincare',    kws: ['skincare', 'beauty', 'cosmetic', 'makeup', 'serum', 'moisturizer', 'sunscreen', 'lipstick', 'mascara', 'face wash', 'cleanser', 'foundation'] },
      { sub: 'Hair Care',            kws: ['shampoo', 'conditioner', 'hair care', 'hair oil', 'hair serum', 'hair growth'] },
      { sub: 'Fragrances',           kws: ['perfume', 'fragrance', 'cologne', 'eau de', 'body spray', 'attar', 'deodorant'] },
      { sub: 'Jewelry',              kws: ['jewellery', 'jewelry', 'necklace', 'bracelet', 'earring', 'ring', 'pendant', 'diamond', 'gold', 'silver'] },
      { sub: 'Eyewear',              kws: ['eyewear', 'sunglasses', 'spectacles', 'optical', 'eyeglasses', 'contact lens'] },
      { sub: 'Watches',              kws: ['watch', 'watches', 'smartwatch', 'timepiece', 'chronograph'] },
      { sub: 'Bags & Luggage',       kws: ['handbag', 'backpack', 'luggage', 'suitcase', 'tote bag', 'crossbody', 'duffel'] },
      { sub: 'Electronics',          kws: ['electronics', 'gadget', 'smartphone', 'laptop', 'earbuds', 'headphone', 'charger', 'power bank', 'tablet'] },
      { sub: 'Home & Living',        kws: ['furniture', 'home decor', 'mattress', 'bedding', 'sofa', 'curtain', 'cushion', 'candle', 'kitchenware'] },
      { sub: 'Food & Beverage',      kws: ['food', 'snack', 'chocolate', 'coffee', 'tea', 'protein', 'supplement', 'organic', 'spices', 'nutrition', 'beverage'] },
      { sub: 'Health & Wellness',    kws: ['health', 'wellness', 'fitness', 'yoga', 'gym', 'supplement', 'vitamin', 'ayurved', 'herbal'] },
      { sub: 'Baby & Kids',          kws: ['baby', 'kids', 'children', 'toddler', 'infant', 'newborn', 'toy', 'nursery', 'diaper'] },
      { sub: 'Pet Products',         kws: ['pet', 'dog food', 'cat food', 'pet care', 'pet supplies'] },
      { sub: 'Sports & Outdoor',     kws: ['sports', 'outdoor', 'camping', 'hiking', 'cycling', 'cricket', 'badminton', 'fitness gear'] },
      { sub: 'Stationery & Art',     kws: ['stationery', 'notebook', 'pen', 'art supplies', 'craft', 'planner', 'journal'] },
      { sub: 'Ethnic & Traditional', kws: ['ethnic', 'traditional', 'saree', 'lehenga', 'kurta', 'sherwani', 'anarkali'] },
      { sub: 'Lingerie & Innerwear', kws: ['lingerie', 'bra', 'underwear', 'innerwear', 'shapewear', 'intimates'] },
      { sub: 'Men\'s Grooming',      kws: ['beard', 'shaving', 'grooming', 'aftershave', 'trimmer', 'men\'s care'] },
    ];

    let bestProductSub = null;
    let bestProductScore = 0;
    for (const { sub, kws } of PRODUCT_SUBCATEGORIES) {
      let score = 0;
      for (const kw of kws) {
        if (titleText.includes(kw)) score += 5;
        if (ogTitleText2.includes(kw)) score += 4;
        if (descText.includes(kw)) score += 3;
        if (ogDescText2.includes(kw)) score += 3;
        if (navText2.includes(kw)) score += 2;
        if (bodySnippet.includes(kw)) score += 1;
      }
      if (score > bestProductScore) { bestProductScore = score; bestProductSub = sub; }
    }

    if (bestProductSub && bestProductScore >= 3) {
      subCategory = bestProductSub;
    }
  }

  let offlineStores;
  let storeRawCount = 0;
  let storeConfidence = null;

  // Priority 1: Known brand — always trust over scraping
  if (knownBrand?.onlineOnly) {
    offlineStores = 'Online';
    storeConfidence = { score: 100, tier: 'high', source: 'known_brand', flags: [] };
  } else if (knownBrand?.stores) {
    offlineStores = knownBrand.stores;
    storeConfidence = { score: 90, tier: 'high', source: 'known_brand', flags: [] };
  }
  // Priority 2: Category-based online-only detection
  else {
    const noStoreBizTypes = ['FinTech', 'EdTech', 'Insurance', 'Telecom', 'Media & Entertainment', 'News & Media', 'Health & Wellness Services', 'Food Delivery', 'Transportation & Mobility', 'Transportation', 'Real Estate', 'SaaS', 'Cloud Services', 'NGO & Non-Profit', 'Professional Services', 'Social Media & Platforms', 'Gaming & Esports', 'Betting & Fantasy Sports', 'Dating & Matchmaking', 'Web Hosting & Domains', 'Classifieds & Listings', 'Government & Public Sector'];
    const onlineOnlySubCategories = ['Marketplace', 'Social Commerce', 'Fashion Marketplace', 'Online Grocery', 'Quick Commerce', 'Food Delivery', 'Ride-Hailing', 'Online Pharmacy', 'Telemedicine', 'Property Listing', 'Rental Platform', 'Travel Booking', 'Vacation Rentals', 'Digital Payments', 'Payment Gateway', 'Investment Platform', 'Stock Trading', 'Insurance Marketplace', 'Fitness App', 'Online Tutoring', 'Test Prep', 'K-12 Learning', 'Higher Education', 'Professional Courses', 'Coding for Kids', 'Credit & Rewards', 'Car Research', 'Farm Fresh Dairy', 'Fresh Meat & Seafood'];
    if (noStoreBizTypes.includes(category) || onlineOnlySubCategories.includes(subCategory)) {
      offlineStores = 'Online';
      storeConfidence = { score: 100, tier: 'high', source: 'category_rule', flags: [] };
    }
    // Priority 3: Active scraping — check header/footer for store link, follow it, count locations
    else {
      try {
        const timeoutFallback = { band: 'Online', rawCount: 0, source: 'timeout', locatorPageExists: false };
        const storeResult = await Promise.race([
          detectOfflineStores(html, url, technologies || [], quickFetch, null, jsonLd.storeHint, browserFetch),
          new Promise(resolve => setTimeout(() => resolve(timeoutFallback), 15000)),
        ]);

        // Handle both old string returns and new object returns
        if (typeof storeResult === 'string') {
          offlineStores = storeResult;
        } else {
          offlineStores = storeResult.band;
          storeRawCount = storeResult.rawCount || 0;

          // Calculate confidence score
          storeConfidence = calculateStoreConfidence({
            source: storeResult.source,
            storeCount: storeResult.rawCount,
            previousCount: null,
            previousScrapedAt: null,
            locatorPageExists: storeResult.locatorPageExists,
            hasStructuredData: false,
            storesHaveCoords: false,
            storesHaveAddresses: false,
            manuallyVerifiedAt: null,
          });
        }
      } catch {
        offlineStores = 'Unknown';
      }
    }
  }

  // Fallback: if scraping found no stores but known brand has store data, use it as fallback
  if (knownBrand?.stores && (!offlineStores || offlineStores === 'Online' || offlineStores === 'Unknown')) {
    offlineStores = knownBrand.stores;
    if (!storeConfidence) {
      storeConfidence = { score: 70, tier: 'medium', source: 'known_brand_fallback', flags: ['global_count'] };
    }
  }

  // Apply known brand region if available and not already set
  if (knownBrand?.region && (!region || region === 'Unknown')) {
    region = knownBrand.region;
  }

  // ── Business Model Detection ──
  const businessModel = detectBusinessModel(html, url, offlineStores, technologies);

  const result = { category, subCategory, region, state, city, offlineStores, storeRawCount, businessModel };
  if (storeConfidence) result.storeConfidence = storeConfidence;

  try {
    const db = await getDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Check for existing overrides and apply them — but KNOWN_BRANDS always wins
    const existing = await db.collection('company_meta').findOne({ normalizedDomain });
    if (existing?.overrides) {
      // Only apply DB overrides for fields NOT already set by knownBrand
      if (existing.overrides.region && !knownBrand?.region) result.region = existing.overrides.region;
      if (existing.overrides.offlineStores && !knownBrand?.stores && !knownBrand?.onlineOnly) {
        result.offlineStores = existing.overrides.offlineStores;
        result.storeConfidence = { score: 35, tier: 'medium', source: 'override', flags: [] };
      }
      if (existing.overrides.category && !knownBrand?.category) result.category = existing.overrides.category;
      if (existing.overrides.subCategory && !knownBrand?.subCategory) result.subCategory = existing.overrides.subCategory;
    }

    // Enrich confidence with previous scan data for temporal consistency
    if (existing && storeConfidence && !existing.overrides?.offlineStores) {
      const prevConfidence = calculateStoreConfidence({
        source: storeConfidence.source,
        storeCount: storeConfidence.rawCount || 0,
        previousCount: existing.storeRawCount || null,
        previousScrapedAt: existing.updatedAt || null,
        locatorPageExists: storeConfidence.locatorPageExists || false,
        hasStructuredData: false,
        storesHaveCoords: false,
        storesHaveAddresses: false,
        manuallyVerifiedAt: existing.manuallyVerifiedAt || null,
      });
      result.storeConfidence = prevConfidence;
    }

    await db.collection('company_meta').updateOne(
      { normalizedDomain },
      {
        $set: {
          normalizedDomain,
          category: result.category,
          subCategory: result.subCategory,
          region: result.region,
          state: result.state || null,
          city: result.city || null,
          offlineStores: result.offlineStores,
          storeRawCount: result.storeRawCount || 0,
          storeConfidence: result.storeConfidence || null,
          businessModel: result.businessModel || null,
          techCount: Array.isArray(technologies) ? technologies.length : 0,
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

/* ── City alias normalization ──────────────────────────────────────────── */
// Maps alternate / legacy / misspelled city names to canonical form.
const CITY_ALIASES = {
  'bengaluru': 'Bangalore',
  'bangalore': 'Bangalore',
  'mumbai': 'Mumbai',
  'bombay': 'Mumbai',
  'navi mumbai': 'Navi Mumbai',
  'new delhi': 'New Delhi',
  'delhi': 'New Delhi',
  'gurugram': 'Gurugram',
  'gurgaon': 'Gurugram',
  'kolkata': 'Kolkata',
  'calcutta': 'Kolkata',
  'chennai': 'Chennai',
  'madras': 'Chennai',
  'mysuru': 'Mysore',
  'mysore': 'Mysore',
  'mangaluru': 'Mangalore',
  'mangalore': 'Mangalore',
  'thiruvananthapuram': 'Thiruvananthapuram',
  'trivandrum': 'Thiruvananthapuram',
  'kozhikode': 'Kozhikode',
  'calicut': 'Kozhikode',
  'kochi': 'Kochi',
  'cochin': 'Kochi',
  'visakhapatnam': 'Visakhapatnam',
  'vizag': 'Visakhapatnam',
  'prayagraj': 'Prayagraj',
  'allahabad': 'Prayagraj',
  'puducherry': 'Puducherry',
  'pondicherry': 'Puducherry',
  'greater noida': 'Greater Noida',
  'noida': 'Noida',
  'pune': 'Pune',
  'hyderabad': 'Hyderabad',
  'ahmedabad': 'Ahmedabad',
  'surat': 'Surat',
  'jaipur': 'Jaipur',
  'lucknow': 'Lucknow',
  'bhopal': 'Bhopal',
  'indore': 'Indore',
  'patna': 'Patna',
  'chandigarh': 'Chandigarh',
  'dehradun': 'Dehradun',
  'guwahati': 'Guwahati',
  'ranchi': 'Ranchi',
  'raipur': 'Raipur',
  'bhubaneswar': 'Bhubaneswar',
  'shimla': 'Shimla',
  'srinagar': 'Srinagar',
  'jammu': 'Jammu',
  'panaji': 'Panaji',
  'varanasi': 'Varanasi',
  'agra': 'Agra',
  'ludhiana': 'Ludhiana',
  'amritsar': 'Amritsar',
  'faridabad': 'Faridabad',
  'ghaziabad': 'Ghaziabad',
  'thane': 'Thane',
  'coimbatore': 'Coimbatore',
  'madurai': 'Madurai',
  'nagpur': 'Nagpur',
  'rajkot': 'Rajkot',
  'vadodara': 'Vadodara',
};

/**
 * Normalize a city name to its canonical form.
 * Handles case, aliases, and trims whitespace.
 */
function normalizeCity(city) {
  if (!city || typeof city !== 'string') return null;
  const trimmed = city.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  // Check alias map
  if (CITY_ALIASES[lower]) return CITY_ALIASES[lower];
  // Check if it's a known Indian city (use proper casing)
  if (INDIA_CITY_STATE[lower]) return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  // Return as-is with title case if short enough to be a real city
  if (trimmed.length > 50) return null;
  return trimmed;
}

/**
 * Determine smart display location based on brand scope.
 * Rules:
 *   - If brand is global (region != specific country) → "Global"
 *   - If brand has wide store presence (21+ stores) → country only (e.g. "India")
 *   - If brand is online-only with no city/state → country only
 *   - If city is actually a state/country name → ignore it
 *   - If brand has state but no city, small store count → "State, Country"
 *   - If brand has city, small store count → "City, State"
 *
 * @returns {{ displayLocation: string, locationLevel: string }}
 */
const VALID_COUNTRIES = new Set([
  'India', 'US', 'UK', 'Australia', 'Germany', 'France', 'Canada', 'Japan',
  'South Korea', 'Brazil', 'Mexico', 'Italy', 'Spain', 'Netherlands', 'Sweden',
  'Singapore', 'UAE', 'Saudi Arabia', 'Indonesia', 'Thailand', 'Malaysia',
  'Vietnam', 'Philippines', 'New Zealand', 'South Africa', 'Nigeria', 'Kenya',
  'Egypt', 'Turkey', 'Poland', 'Switzerland', 'Belgium', 'Austria', 'Denmark',
  'Norway', 'Finland', 'Ireland', 'Portugal', 'Czech Republic', 'Romania',
  'Hungary', 'Israel', 'China', 'Taiwan', 'Hong Kong', 'Bangladesh', 'Pakistan',
  'Sri Lanka', 'Nepal', 'Global',
]);

function formatDisplayLocation({ region, state, city, offlineStores }) {
  let r = (typeof region === 'string' && region) ? region : 'Global';

  // Normalize city
  let c = normalizeCity(city);
  let s = (typeof state === 'string' && state) ? state.trim() : null;

  // If region is not a valid country, try to fix it
  if (!VALID_COUNTRIES.has(r)) {
    const rLower = r.toLowerCase().trim();
    // Region is actually a known Indian city
    if (INDIA_CITY_STATE[rLower]) {
      if (!c) c = normalizeCity(r);
      s = s || INDIA_CITY_STATE[rLower];
      r = 'India';
    }
    // Region is an Indian state
    else if (INDIA_STATES.includes(r)) {
      s = s || r;
      r = 'India';
    }
    // Unknown region — likely Indian (most of our data)
    else {
      // If state hints at India, set region to India
      if (s && (INDIA_STATES.includes(s) || INDIA_CITY_STATE[s.toLowerCase()])) {
        r = 'India';
      } else {
        r = 'Global';
      }
    }
  }

  // If "city" is actually a country/state name, discard it
  if (c) {
    const cLower = c.toLowerCase();
    if (cLower === 'india' || cLower === r.toLowerCase()) c = null;
    // If city equals the state, discard it (redundant)
    if (s && cLower === s.toLowerCase()) c = null;
    // If city looks like an address (contains commas or is very long), discard
    if (c && (c.includes(',') || c.length > 40)) c = null;
    // If city is a state name (not a city), discard
    if (c && INDIA_STATES.includes(c)) { s = s || c; c = null; }
  }

  // If state is actually a known city, fix it
  if (s) {
    const sLower = s.toLowerCase();
    if (INDIA_CITY_STATE[sLower] && !INDIA_STATES.includes(s)) {
      if (!c) c = normalizeCity(s);
      s = INDIA_CITY_STATE[sLower];
    }
  }

  // Determine brand scope from store presence
  const stores = (typeof offlineStores === 'string') ? offlineStores : 'Unknown';
  const isWidePresence = ['21-50', '51-100', '100+', '500+', '100-500', '50-100', '10-50'].includes(stores);
  const isOnline = stores === 'Online' || stores === 'Online only';

  // Global brands
  if (r === 'Global') return { displayLocation: 'Global', locationLevel: 'global' };

  // Wide physical presence → country level only
  if (isWidePresence) return { displayLocation: r, locationLevel: 'country' };

  // Online-only without specific city/state → country level
  if (isOnline && !c && !s) return { displayLocation: r, locationLevel: 'country' };

  // City-specific brand
  if (c && s) return { displayLocation: `${c}, ${s}`, locationLevel: 'city' };
  if (c) {
    // Try to derive state from city
    const derivedState = INDIA_CITY_STATE[c.toLowerCase()];
    if (derivedState) return { displayLocation: `${c}, ${derivedState}`, locationLevel: 'city' };
    return { displayLocation: `${c}, ${r}`, locationLevel: 'city' };
  }

  // State-specific brand
  if (s) return { displayLocation: `${s}, ${r}`, locationLevel: 'state' };

  // Fallback → country
  return { displayLocation: r, locationLevel: 'country' };
}

module.exports = { extractCompanyMeta, INDIA_STATES, INDIA_CITY_STATE, CITY_ALIASES, normalizeCity, formatDisplayLocation, lookupKnownBrand };
