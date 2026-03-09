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
  'nike.com':        { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100-500', region: 'Global' },
  'adidas.com':      { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100-500', region: 'Global' },
  'adidas.co.in':    { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100-500', region: 'India' },
  'puma.com':        { category: 'Fashion & Apparel', subCategory: 'Sportswear', stores: '100-500', region: 'Global' },
  'reebok.com':      { category: 'Fashion & Apparel', subCategory: 'Sportswear', stores: '100-500', region: 'Global' },
  'newbalance.com':  { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100-500', region: 'Global' },
  'asics.com':       { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100-500', region: 'Global' },
  'skechers.com':    { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '500+', region: 'Global' },
  'converse.com':    { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100-500', region: 'Global' },
  'vans.com':        { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100-500', region: 'Global' },
  'underarmour.com': { category: 'Fashion & Apparel', subCategory: 'Sportswear', stores: '100-500', region: 'Global' },
  'zara.com':        { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', stores: '500+', region: 'Global' },
  'hm.com':          { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', stores: '500+', region: 'Global' },
  'uniqlo.com':      { category: 'Fashion & Apparel', subCategory: 'Casual Wear', stores: '500+', region: 'Global' },
  'gap.com':         { category: 'Fashion & Apparel', subCategory: 'Casual Wear', stores: '500+', region: 'Global' },
  'levis.com':       { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans', stores: '500+', region: 'Global' },
  'levi.com':        { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans', stores: '500+', region: 'Global' },
  'gucci.com':       { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'louisvuitton.com':{ category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'prada.com':       { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'burberry.com':    { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'ralphlauren.com': { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'calvinklein.com': { category: 'Fashion & Apparel', subCategory: 'Premium Fashion', stores: '100-500', region: 'Global' },
  'tommyhilfiger.com':{ category: 'Fashion & Apparel', subCategory: 'Premium Fashion', stores: '100-500', region: 'Global' },
  'armani.com':      { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'versace.com':     { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '50-100', region: 'Global' },
  'balenciaga.com':  { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '50-100', region: 'Global' },
  'dior.com':        { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'fendi.com':       { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '50-100', region: 'Global' },
  'hermes.com':      { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'chanel.com':      { category: 'Fashion & Apparel', subCategory: 'Luxury Fashion', stores: '100-500', region: 'Global' },
  'forever21.com':   { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', stores: '100-500', region: 'Global' },
  'asos.com':        { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', onlineOnly: true },
  'shein.com':       { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', onlineOnly: true },
  'nordstrom.com':   { category: 'Fashion & Apparel', subCategory: 'Department Store', stores: '100-500', region: 'US' },
  'macys.com':       { category: 'Fashion & Apparel', subCategory: 'Department Store', stores: '500+', region: 'US' },
  'crocs.com':       { category: 'Fashion & Apparel', subCategory: 'Casual Footwear', stores: '100-500', region: 'Global' },
  'birkenstock.com': { category: 'Fashion & Apparel', subCategory: 'Casual Footwear', stores: '50-100', region: 'Global' },
  'clarks.com':      { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '500+', region: 'Global' },
  'timberland.com':  { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100-500', region: 'Global' },
  'bata.com':        { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '500+', region: 'Global' },
  'bata.in':         { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '500+', region: 'India' },
  // Custom Tailoring
  'bombayshirts.com':{ category: 'Fashion & Apparel', subCategory: 'Custom Shirts', stores: '10-50', region: 'Global' },
  // Fashion & Apparel — India
  'manyavar.com':    { category: 'Fashion & Apparel', subCategory: 'Ethnic Wear', stores: '500+', region: 'India' },
  'fabindia.com':    { category: 'Fashion & Apparel', subCategory: 'Ethnic Wear', stores: '100-500', region: 'India' },
  'biba.in':         { category: 'Fashion & Apparel', subCategory: 'Ethnic Wear', stores: '100-500', region: 'India' },
  'wforwoman.com':   { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', stores: '100-500', region: 'India' },
  'global.com':      { category: 'Fashion & Apparel', subCategory: 'Denim & Jeans' },
  'bewakoof.com':    { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'thesouledstore.com':{ category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'snitch.co.in':    { category: 'Fashion & Apparel', subCategory: 'Men\'s Fashion', stores: '10-50', region: 'Global' },
  'snitch.com':      { category: 'Fashion & Apparel', subCategory: 'Men\'s Fashion', stores: '10-50', region: 'Global' },
  'rfrk.in':         { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'bonkers.co.in':   { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true },
  'urbanic.com':     { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', onlineOnly: true },
  'nykdfashion.com': { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', onlineOnly: true },
  'pantaloons.com':  { category: 'Fashion & Apparel', subCategory: 'Multi-Brand Retail', stores: '100-500', region: 'India' },
  'lifestylestores.com':{ category: 'Fashion & Apparel', subCategory: 'Multi-Brand Retail', stores: '50-100', region: 'India' },
  'shoppersstop.com':{ category: 'Fashion & Apparel', subCategory: 'Department Store', stores: '50-100', region: 'India' },
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
  'woodland.in':     { category: 'Fashion & Apparel', subCategory: 'Outdoor & Adventure', stores: '500+', region: 'India' },
  'campusshoes.com': { category: 'Fashion & Apparel', subCategory: 'Shoes & Sneakers', stores: '100-500', region: 'India' },
  'libertyshoes.com':{ category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100-500', region: 'India' },
  'metrobrands.com': { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '500+', region: 'India' },
  'mochi.in':        { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100-500', region: 'India' },
  'mochishoes.com':  { category: 'Fashion & Apparel', subCategory: 'Footwear', stores: '100-500', region: 'India' },
  // Jewelry
  'tanishq.co.in':   { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '500+', region: 'India' },
  'caratlane.com':    { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100-500', region: 'India' },
  'bluestone.com':    { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '50-100', region: 'India' },
  'kalyan.com':       { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '500+', region: 'India' },
  'kalyanjewellers.net':{ category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '500+', region: 'India' },
  'malabargold.com':  { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100-500', region: 'Global' },
  'pngjewellers.com': { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100-500', region: 'India' },
  'joyalukkas.com':   { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '100-500', region: 'Global' },
  'tiffany.com':      { category: 'Jewelry', subCategory: 'Luxury Jewelry', stores: '100-500', region: 'Global' },
  'cartier.com':      { category: 'Jewelry', subCategory: 'Luxury Jewelry', stores: '100-500', region: 'Global' },
  'swarovski.com':    { category: 'Jewelry', subCategory: 'Crystal & Fashion Jewelry', stores: '500+', region: 'Global' },
  'pandora.net':      { category: 'Jewelry', subCategory: 'Fashion Jewelry', stores: '500+', region: 'Global' },
  // Beauty & Personal Care
  'foxtale.in':       { category: 'Beauty & Personal Care', subCategory: 'Skincare', stores: '100-500', region: 'India' },
  'nykaa.com':        { category: 'Beauty & Personal Care', subCategory: 'Beauty Marketplace', stores: '100-500', region: 'India' },
  'mamaearth.in':     { category: 'Beauty & Personal Care', subCategory: 'Natural & Organic', stores: '100-500', region: 'India' },
  'mcaffeine.com':    { category: 'Beauty & Personal Care', subCategory: 'Skincare', onlineOnly: true },
  'plumgoodness.com': { category: 'Beauty & Personal Care', subCategory: 'Clean Beauty', onlineOnly: true },
  'myglamm.com':      { category: 'Beauty & Personal Care', subCategory: 'Makeup', stores: '50-100', region: 'India' },
  'sugarcosmetics.com':{ category: 'Beauty & Personal Care', subCategory: 'Makeup', stores: '50-100', region: 'India' },
  'lorealparis.co.in':{ category: 'Beauty & Personal Care', subCategory: 'Premium Beauty', stores: '500+', region: 'Global' },
  'maccosmetics.com': { category: 'Beauty & Personal Care', subCategory: 'Premium Beauty', stores: '500+', region: 'Global' },
  'sephora.com':      { category: 'Beauty & Personal Care', subCategory: 'Beauty Retail', stores: '500+', region: 'Global' },
  'bathbodyworks.com':{ category: 'Beauty & Personal Care', subCategory: 'Bath & Body', stores: '500+', region: 'Global' },
  'forestessentialsindia.com':{ category: 'Beauty & Personal Care', subCategory: 'Luxury Ayurvedic', stores: '50-100', region: 'India' },
  'thebodyshop.com':  { category: 'Beauty & Personal Care', subCategory: 'Natural Beauty', stores: '500+', region: 'Global' },
  'beardo.in':        { category: 'Beauty & Personal Care', subCategory: 'Men\'s Grooming', onlineOnly: true },
  'manmatters.com':   { category: 'Beauty & Personal Care', subCategory: 'Men\'s Grooming', onlineOnly: true },
  'bombayshavingcompany.com':{ category: 'Beauty & Personal Care', subCategory: 'Men\'s Grooming', onlineOnly: true },
  // Electronics & Tech
  'apple.com':        { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '500+', region: 'Global' },
  'samsung.com':      { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '500+', region: 'Global' },
  'oneplus.in':       { category: 'Electronics & Tech', subCategory: 'Smartphones', stores: '50-100', region: 'India' },
  'mi.com':           { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '500+', region: 'Global' },
  'boat-lifestyle.com':{ category: 'Electronics & Tech', subCategory: 'Audio & Wearables', onlineOnly: true },
  'noise.com':        { category: 'Electronics & Tech', subCategory: 'Audio & Wearables', onlineOnly: true },
  'croma.com':        { category: 'Electronics & Tech', subCategory: 'Electronics Retail', stores: '500+', region: 'India' },
  'reliancedigital.in':{ category: 'Electronics & Tech', subCategory: 'Electronics Retail', stores: '500+', region: 'India' },
  'sony.com':         { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '500+', region: 'Global' },
  'dell.com':         { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100-500', region: 'Global' },
  'hp.com':           { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100-500', region: 'Global' },
  'lenovo.com':       { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100-500', region: 'Global' },
  'bose.com':         { category: 'Electronics & Tech', subCategory: 'Premium Audio', stores: '100-500', region: 'Global' },
  'jbl.com':          { category: 'Electronics & Tech', subCategory: 'Audio', stores: '100-500', region: 'Global' },
  'dyson.com':        { category: 'Electronics & Tech', subCategory: 'Home Appliances', stores: '50-100', region: 'Global' },
  // Home & Living
  'ikea.com':         { category: 'Home & Living', subCategory: 'Furniture & Home', stores: '500+', region: 'Global' },
  'woodenstreet.com': { category: 'Home & Living', subCategory: 'Furniture', stores: '50-100', region: 'India' },
  'pepperfry.com':    { category: 'Home & Living', subCategory: 'Furniture Marketplace', stores: '50-100', region: 'India' },
  'urbanladder.com':  { category: 'Home & Living', subCategory: 'Furniture', stores: '10-50', region: 'India' },
  'sleepycat.in':     { category: 'Home & Living', subCategory: 'Mattresses & Sleep', onlineOnly: true },
  'wakefit.co':       { category: 'Home & Living', subCategory: 'Mattresses & Sleep', stores: '10-50', region: 'India' },
  'sleepwell.co.in':  { category: 'Home & Living', subCategory: 'Mattresses & Sleep', stores: '100-500', region: 'India' },
  'godrejinterio.com':{ category: 'Home & Living', subCategory: 'Furniture', stores: '500+', region: 'India' },
  'hometown.in':      { category: 'Home & Living', subCategory: 'Home Decor', stores: '50-100', region: 'India' },
  'nestasia.in':      { category: 'Home & Living', subCategory: 'Home Decor', onlineOnly: true },
  // Food & Beverage
  'chaipoint.com':    { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '100-500', region: 'India' },
  'starbucks.com':    { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '500+', region: 'Global' },
  'starbucks.in':     { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '500+', region: 'India' },
  'mcdonalds.com':    { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '500+', region: 'Global' },
  'dominos.com':      { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '500+', region: 'Global' },
  'dominos.co.in':    { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '500+', region: 'India' },
  'kfc.com':          { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '500+', region: 'Global' },
  'subway.com':       { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '500+', region: 'Global' },
  'zomato.com':       { category: 'Food & Beverage', subCategory: 'Food Delivery', onlineOnly: true },
  'swiggy.com':       { category: 'Food & Beverage', subCategory: 'Food Delivery', onlineOnly: true },
  'blinkit.com':      { category: 'Food & Beverage', subCategory: 'Quick Commerce', onlineOnly: true },
  'zepto.co':         { category: 'Food & Beverage', subCategory: 'Quick Commerce', onlineOnly: true },
  'bigbasket.com':    { category: 'Food & Beverage', subCategory: 'Online Grocery', onlineOnly: true },
  'licious.in':       { category: 'Food & Beverage', subCategory: 'Fresh Meat & Seafood', onlineOnly: true },
  'countrydelight.in':{ category: 'Food & Beverage', subCategory: 'Farm Fresh Dairy', onlineOnly: true },
  // Outdoor & Sports
  'decathlon.in':     { category: 'Outdoor & Sports', subCategory: 'Sports Retail', stores: '100-500', region: 'India' },
  'decathlon.com':    { category: 'Outdoor & Sports', subCategory: 'Sports Retail', stores: '500+', region: 'Global' },
  'thenorthface.com': { category: 'Fashion & Apparel', subCategory: 'Outdoor & Adventure', stores: '100-500', region: 'Global' },
  'columbia.com':     { category: 'Fashion & Apparel', subCategory: 'Outdoor & Adventure', stores: '100-500', region: 'Global' },
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
  'crossword.in':     { category: 'Books & Media', subCategory: 'Bookstore Chain' },
  'amazon.com':       { category: 'Ecommerce/Retail', subCategory: 'Marketplace' },
  // Eyewear
  'lenskart.com':     { category: 'Fashion Accessories', subCategory: 'Eyewear', stores: '500+', region: 'India' },
  'johnjacobs.com':   { category: 'Fashion Accessories', subCategory: 'Eyewear', stores: '50-100', region: 'India' },
  'titaneyeplus.com': { category: 'Fashion Accessories', subCategory: 'Eyewear', stores: '500+', region: 'India' },
  'vincesmallworld.com':{ category: 'Fashion Accessories', subCategory: 'Eyewear' },
  // Watches
  'titan.co.in':      { category: 'Fashion Accessories', subCategory: 'Watches', stores: '500+', region: 'India' },
  'fastrack.in':      { category: 'Fashion Accessories', subCategory: 'Watches & Accessories', stores: '100-500', region: 'India' },
  'fossil.com':       { category: 'Fashion Accessories', subCategory: 'Watches', stores: '100-500', region: 'Global' },
  'casio.com':        { category: 'Fashion Accessories', subCategory: 'Watches', stores: '500+', region: 'Global' },
  'rolex.com':        { category: 'Fashion Accessories', subCategory: 'Luxury Watches', stores: '100-500', region: 'Global' },
  // Bags & Luggage
  'samsonite.com':    { category: 'Fashion Accessories', subCategory: 'Luggage & Travel', stores: '500+', region: 'Global' },
  'americantourister.com':{ category: 'Fashion Accessories', subCategory: 'Luggage & Travel', stores: '500+', region: 'Global' },
  'wildcraft.com':    { category: 'Fashion Accessories', subCategory: 'Backpacks & Outdoor', stores: '100-500', region: 'India' },
  'skybags.co.in':    { category: 'Fashion Accessories', subCategory: 'Bags & Luggage', stores: '100-500', region: 'India' },
  'mokobara.com':     { category: 'Fashion Accessories', subCategory: 'Luggage & Travel', onlineOnly: true },
  // Health & Wellness
  'cultfit.com':      { category: 'Health & Wellness', subCategory: 'Fitness & Gym', stores: '100-500', region: 'India' },
  'curefit.com':      { category: 'Health & Wellness', subCategory: 'Fitness & Gym', stores: '100-500', region: 'India' },
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
  // Travel
  'makemytrip.com':   { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'goibibo.com':      { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'cleartrip.com':    { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'yatra.com':        { category: 'Travel & Ticketing', subCategory: 'Travel Booking', onlineOnly: true },
  'oyo.com':          { category: 'Travel & Ticketing', subCategory: 'Hotel Booking', stores: '500+', region: 'Global' },
  'booking.com':      { category: 'Travel & Ticketing', subCategory: 'Hotel Booking', onlineOnly: true },
  'airbnb.com':       { category: 'Travel & Ticketing', subCategory: 'Vacation Rentals', onlineOnly: true },
  // Automotive
  'cars24.com':       { category: 'Automotive', subCategory: 'Used Cars', stores: '100-500', region: 'India' },
  'cardekho.com':     { category: 'Automotive', subCategory: 'Car Research', onlineOnly: true },
  'spinny.com':       { category: 'Automotive', subCategory: 'Used Cars', stores: '50-100', region: 'India' },
  'ola.com':          { category: 'Transportation', subCategory: 'Ride-Hailing', onlineOnly: true },
  'uber.com':         { category: 'Transportation', subCategory: 'Ride-Hailing', onlineOnly: true },
  'rapido.bike':      { category: 'Transportation', subCategory: 'Ride-Hailing', onlineOnly: true },
  // Real Estate
  '99acres.com':      { category: 'Real Estate', subCategory: 'Property Listing', onlineOnly: true },
  'magicbricks.com':  { category: 'Real Estate', subCategory: 'Property Listing', onlineOnly: true },
  'housing.com':      { category: 'Real Estate', subCategory: 'Property Listing', onlineOnly: true },
  'nobroker.in':      { category: 'Real Estate', subCategory: 'Rental Platform', onlineOnly: true },
};

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
    'Shoes & Sneakers':   ['sneaker', 'sneakers', 'running shoe', 'athletic shoe', 'basketball shoe', 'trainer', 'trainers', 'just do it', 'air max', 'air jordan', 'ultraboost', 'shoe', 'shoes', 'footwear'],
    'Sportswear':         ['sportswear', 'sports wear', 'activewear', 'athleisure', 'gym wear', 'workout clothes', 'yoga pants', 'sports bra', 'athletic', 'performance wear', 'training gear', 'running gear'],
    'Fast Fashion':       ['fast fashion', 'new arrivals weekly', 'trend', 'latest fashion', 'new collection every week', 'affordable fashion'],
    'Luxury Fashion':     ['luxury', 'haute couture', 'designer', 'maison', 'atelier', 'couture', 'premium collection', 'handcrafted leather', 'made in italy', 'made in france'],
    'Premium Fashion':    ['premium', 'contemporary fashion', 'modern classic', 'elevated basics', 'refined style'],
    'Casual Wear':        ['casual wear', 'everyday wear', 'basic', 'essential', 'daily wear', 'relaxed fit'],
    'Denim & Jeans':      ['denim', 'jeans', 'jean', '501', 'selvedge', 'raw denim', 'indigo'],
    'Ethnic Wear':        ['ethnic wear', 'ethnic fashion', 'kurta', 'saree', 'lehenga', 'salwar', 'traditional wear', 'traditional clothing', 'sherwani', 'anarkali', 'dupatta', 'churidar', 'indian wear'],
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
  /\/[a-z0-9]+-stores?\b/i,
];

function countToBand(count) {
  if (count <= 0)   return 'Online';
  if (count <= 10)  return '1-10';
  if (count <= 50)  return '10-50';
  if (count <= 100) return '50-100';
  if (count <= 500) return '100-500';
  return '500+';
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

    if (!storeHtml || storeHtml.length < 500) return { count: 0, source: 'none' };

    // Text-based count from stealth-rendered page
    const textCount = extractStoreCount(storeHtml);
    if (textCount > 0) return { count: textCount, source: 'text_extraction' };

    // JSON arrays in rendered page
    const jsonCount = countJsonArrayItems(storeHtml);
    if (jsonCount > 0) return { count: jsonCount, source: 'json_array' };

    // DOM element counting
    const elemCount = countStoreElements(storeHtml);
    if (elemCount > 0) return { count: elemCount, source: 'store_elements' };

    // Rendered items / direction links
    const renderedCount = countRenderedStoreItems(storeHtml);
    if (renderedCount > 0) return { count: renderedCount, source: 'rendered_items' };

    return { count: 0, source: 'none' };
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

  // Helper: return result with source metadata for confidence scoring
  const result = (count, source) => ({
    band: countToBand(count),
    rawCount: count,
    source,
    locatorPageExists: !!storeLocatorUrl,
  });

  // Start Wikipedia lookup in parallel
  const wikiPromise = tryWikipediaStoreCount(url, html).catch(() => 0);

  // Fetch store locator page with axios (fast, ~1-3s)
  let storeLocatorHtml = '';
  let axiosBlocked = false;
  if (storeLocatorUrl && fetchPage) {
    try {
      const resp = await fetchPage(storeLocatorUrl);
      storeLocatorHtml = typeof resp.data === 'string' ? resp.data : '';
    } catch {}
  }

  // Detect if axios got a bot-protection challenge page or SPA empty shell
  if (storeLocatorHtml) {
    const isChallengeOrEmpty = storeLocatorHtml.length < 1000 ||
      /vercel security checkpoint|cloudflare|just a moment|checking your browser|captcha/i.test(storeLocatorHtml.slice(0, 2000));

    // Detect SPA empty shells: page has JS but no store-related content rendered
    const isSpaShell = !isChallengeOrEmpty && storeLocatorHtml.length < 15000 &&
      (storeLocatorHtml.match(/<script/gi) || []).length > 3 &&
      !/store|location|address|outlet|branch|showroom|pincode|phone|city/i.test(
        storeLocatorHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').slice(0, 5000)
      );

    if (isChallengeOrEmpty || isSpaShell) {
      axiosBlocked = true;
      storeLocatorHtml = ''; // discard — it's a challenge page or SPA shell, not real content
    }
  }

  // --- Priority 1: Widget-specific API parsers (highest accuracy) ---
  const combinedHtml = storeLocatorHtml + '\n' + html;

  // Run widget parsers + third-party locators in parallel
  const [widgetCount, locatorApiCount] = await Promise.all([
    tryWidgetParsers(combinedHtml, fetchPage).catch(() => 0),
    storeLocatorHtml ? tryThirdPartyStoreLocators(storeLocatorHtml, fetchPage).catch(() => 0) : Promise.resolve(0),
  ]);
  if (widgetCount > 0) return result(widgetCount, 'widget_api');
  if (locatorApiCount > 0) return result(locatorApiCount, 'widget_api');

  // --- Priority 2: If axios was blocked OR got no useful data, use stealth browser ---
  if (storeLocatorUrl && (axiosBlocked || !storeLocatorHtml)) {
    try {
      const stealthResult = await scrapeStoreLocatorWithBrowser(storeLocatorUrl);
      if (stealthResult.count > 0) return result(stealthResult.count, stealthResult.source);
    } catch {}
  }

  // --- Priority 3: Analyze axios-fetched store locator page ---
  if (storeLocatorHtml) {
    // Run inline API + JS chunk detection in parallel
    const [locatorInlineCount, jsChunkCount] = await Promise.all([
      tryInlineStoreApis(storeLocatorHtml, storeLocatorUrl, fetchPage).catch(() => 0),
      tryStoreApiFromJsChunks(storeLocatorHtml, storeLocatorUrl, fetchPage).catch(() => 0),
    ]);
    if (locatorInlineCount > 0) return result(locatorInlineCount, 'api_detection');
    if (jsChunkCount > 0) return result(jsChunkCount, 'api_detection');

    // Try text extraction from store locator page
    const countFromLocator = extractStoreCount(storeLocatorHtml);
    if (countFromLocator > 0) {
      const wikiCount = await wikiPromise;
      const finalCount = (wikiCount > countFromLocator * 2 && wikiCount >= 20) ? wikiCount : countFromLocator;
      return result(finalCount, 'text_extraction');
    }

    // Fall back to JSON arrays and DOM element counting (instant, no network)
    const jsonArrayCount = countJsonArrayItems(storeLocatorHtml);
    if (jsonArrayCount > 0) return result(jsonArrayCount, 'json_array');

    const elementCount = countStoreElements(storeLocatorHtml);
    if (elementCount > 0) return result(elementCount, 'store_elements');

    // Count rendered store items from locator page (instant, no network)
    const renderedCount = countRenderedStoreItems(storeLocatorHtml);
    if (renderedCount > 0) return result(renderedCount, 'rendered_items');
  }

  // Fall back to main page text count if no store locator page found
  if (countFromMainText > 0) return result(countFromMainText, 'text_extraction');

  // Check main page HTML for third-party store locator APIs
  const apiCount = await tryStoreLocatorApis(html, url, fetchPage).catch(() => 0);
  if (apiCount > 0) return result(apiCount, 'api_detection');

  // Check jsonLd hint and anchors before expensive browser calls
  if (jsonLdStoreHint && jsonLdStoreHint > 1) return result(jsonLdStoreHint, 'dom_parsing');

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
    if (maxStoreId > 1) return result(maxStoreId, 'dom_parsing');
    if (storeAnchors.size > 1) return result(storeAnchors.size, 'dom_parsing');

    const directionLinks = (html.match(/google\.com\/maps|maps\.google|get\s*direction/gi) || []).length;
    if (directionLinks > 1) return result(directionLinks, 'rendered_items');
  }

  // --- Priority 4: Fallbacks ---
  const hasStoreSignal = storeLocatorUrl || jsonLdStoreHint ||
    /\bstore|outlet|showroom|branch|dealer|franchise/i.test(html.slice(0, 50000));

  const wikiCount = await wikiPromise;
  if (wikiCount > 0) return result(wikiCount, 'wikipedia');

  if (hasStoreSignal) {
    const commonPageCount = await tryCommonStorePages(url, fetchPage);
    if (commonPageCount > 0) return result(commonPageCount, 'common_pages');

    // Stealth browser scrape for sites where axios worked but found nothing
    if (storeLocatorUrl && !axiosBlocked) {
      try {
        const stealthResult = await scrapeStoreLocatorWithBrowser(storeLocatorUrl);
        if (stealthResult.count > 0) return result(stealthResult.count, stealthResult.source);
      } catch {}
    }
  }

  if (storeLocatorUrl) return { band: '1-10', rawCount: 0, source: 'none', locatorPageExists: true };

  return { band: 'Unknown', rawCount: 0, source: 'none', locatorPageExists: false };
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

function countStoreElements(html) {
  let count = 0;

  const addressBlocks = (html.match(/<address[\s\S]*?<\/address>/gi) || []).length;
  if (addressBlocks > 1) count = Math.max(count, addressBlocks);

  const mapPins = (html.match(/(?:marker|pin|LatLng|latitude|lat)\s*[:"]\s*[\d.-]+/gi) || []).length;
  if (mapPins > 2) count = Math.max(count, Math.floor(mapPins / 2));

  // Count directions links first (most reliable: 1 link = 1 store)
  const directionsLinks = (html.match(/(?:get\s*directions?|google\.com\/maps\?|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)/gi) || []).length;
  if (directionsLinks > 1) count = Math.max(count, directionsLinks);

  // Count store card class patterns — but many sites have nested store-card_* classes,
  // so when directionsLinks are available, prefer those. Only use storeCards if no directions found.
  if (directionsLinks <= 1) {
    const storeCards = (html.match(/class=["'][^"']*(?:store[-_]?card|store[-_]?item|store[-_]?listing|store[-_]?detail|store[-_]?box|store[-_]?tile|location[-_]?card|location[-_]?item|location[-_]?listing|outlet[-_]?card|outlet[-_]?item|branch[-_]?item|branch[-_]?card|dealer[-_]?card|dealer[-_]?item|showroom[-_]?card|showroom[-_]?item|shop[-_]?card|shop[-_]?item)[^"']*["']/gi) || []).length;
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
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } : null;

  // Check known brand database (highest priority)
  const knownBrand = lookupKnownBrand(normalizedDomain);

  try {
    const db = await getDb();
    const cached = await db.collection('company_meta').findOne({ normalizedDomain });
    if (!forceRefresh && cached && cached.expiresAt && new Date(cached.expiresAt) > new Date()) {
      const result = {
        category:      knownBrand?.category  || cached.overrides?.category    || cached.category,
        subCategory:   knownBrand?.subCategory || cached.overrides?.subCategory || cached.subCategory,
        region:        knownBrand?.region || cached.overrides?.region || cached.region,
        offlineStores: knownBrand?.onlineOnly ? 'Online' : (knownBrand?.stores || cached.overrides?.offlineStores || cached.offlineStores),
        storeConfidence: knownBrand?.stores || knownBrand?.onlineOnly
          ? { score: 90, tier: 'high', source: 'known_brand', flags: [] }
          : (cached.storeConfidence || null),
      };
      return result;
    }
  } catch {}

  const jsonLd = extractJsonLd(html);
  const metaResults = extractFromMeta(html, metaMap || {});
  const keywords = analyzeKeywords(html, url);
  const techHints = inferFromTech(technologies || []);

  let region = detectRegion(
    url, html, metaMap || {},
    techHints.region,
    jsonLd.region,
    metaResults.region,
    techHints
  );

  let category;
  if (knownBrand) {
    category = knownBrand.category;
  } else {
    category = jsonLd.category || keywords.category || jsonLd.genericCategory || metaResults.category || techHints.category || 'Unknown';
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

  // If category is Ecommerce but subcategory is still General, try to determine
  // the actual product niche from page content across all known product categories
  if (subCategory === 'General' && (category === 'Ecommerce/Retail' || techHints.category === 'Ecommerce/Retail')) {
    const titleText = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').toLowerCase();
    const descText = ((/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html) || [])[1] || '').toLowerCase();
    let bodySnippet = '';
    const bodyM2 = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (bodyM2) {
      bodySnippet = bodyM2[1].replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000).toLowerCase();
    }
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
        if (descText.includes(kw)) score += 3;
        if (bodySnippet.includes(kw)) score += 1;
      }
      if (score > bestProductScore) { bestProductScore = score; bestProductSub = sub; }
    }

    if (bestProductSub && bestProductScore >= 3) {
      subCategory = bestProductSub;
    }
  }

  let offlineStores;
  let storeConfidence = null;

  // Priority 1: Known brand has explicit store data (highest accuracy, no scraping needed)
  if (knownBrand?.onlineOnly) {
    offlineStores = 'Online';
    storeConfidence = { score: 100, tier: 'high', source: 'known_brand', flags: [] };
  } else if (knownBrand?.stores) {
    offlineStores = knownBrand.stores;
    storeConfidence = { score: 90, tier: 'high', source: 'known_brand', flags: [] };
  }
  // Priority 2: Category-based online-only detection
  else {
    const noStoreBizTypes = ['FinTech', 'EdTech', 'Insurance', 'Telecom', 'Streaming Platform / OTT', 'Music & Audio Streaming', 'Gaming', 'News & Media', 'Health & Wellness Services', 'Food Delivery', 'Transportation Booking', 'Transportation', 'Real Estate', 'SaaS', 'Cloud Services'];
    const onlineOnlySubCategories = ['Marketplace', 'Social Commerce', 'Fashion Marketplace', 'Online Grocery', 'Quick Commerce', 'Food Delivery', 'Ride-Hailing', 'Online Pharmacy', 'Telemedicine', 'Property Listing', 'Rental Platform', 'Travel Booking', 'Vacation Rentals', 'Digital Payments', 'Payment Gateway', 'Investment Platform', 'Stock Trading', 'Insurance Marketplace', 'Fitness App', 'Online Tutoring', 'Test Prep', 'K-12 Learning', 'Higher Education', 'Professional Courses', 'Coding for Kids', 'Credit & Rewards', 'Car Research', 'Farm Fresh Dairy', 'Fresh Meat & Seafood'];
    if (noStoreBizTypes.includes(category) || onlineOnlySubCategories.includes(subCategory)) {
      offlineStores = 'Online';
      storeConfidence = { score: 100, tier: 'high', source: 'category_rule', flags: [] };
    }
    // Priority 3: Active scraping for store count
    else {
      try {
        const storeLocatorUrl = findStoreLocatorLink(html, url);
        const timeoutFallback = { band: storeLocatorUrl ? '1-10' : 'Unknown', rawCount: 0, source: 'none', locatorPageExists: !!storeLocatorUrl };
        const storeResult = await Promise.race([
          detectOfflineStores(html, url, technologies || [], quickFetch, storeLocatorUrl, jsonLd.storeHint, browserFetch),
          new Promise(resolve => setTimeout(() => resolve(timeoutFallback), 12000)),
        ]);

        // Handle both old string returns and new object returns
        if (typeof storeResult === 'string') {
          offlineStores = storeResult;
        } else {
          offlineStores = storeResult.band;

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

  // Apply known brand region if available and not already set
  if (knownBrand?.region && (!region || region === 'Unknown')) {
    region = knownBrand.region;
  }

  const result = { category, subCategory, region, offlineStores };
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
          offlineStores: result.offlineStores,
          storeConfidence: result.storeConfidence || null,
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
