const { getDb } = require('./db');
const { detectStoresViaInterception, tryWidgetParsers } = require('./storeInterceptor');
const { seedOverrides } = require('./storeOverrides');
const { calculateStoreConfidence } = require('./storeConfidence');
const { deduplicateStores } = require('./storeDedup');

// ── Classifier version ────────────────────────────────────────────────────
// Bump this whenever category/sub-category logic changes. Cached company_meta
// docs tagged with an older version are treated as stale and re-classified on
// the next scan — so improvements roll out to old data automatically instead of
// leaving stale/wrong categories behind.
const CLASSIFIER_VERSION = 7;

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
  // US D2C brands
  'everlane.com':    { category: 'Fashion & Apparel', subCategory: 'Sustainable Fashion', stores: '11-20', region: 'US' },
  'allbirds.com':    { category: 'Fashion & Apparel', subCategory: 'Sustainable Footwear', stores: '21-50', region: 'US' },
  'warbyparker.com': { category: 'Fashion & Apparel', subCategory: 'Eyewear', stores: '100+', region: 'US' },
  'bonobos.com':     { category: 'Fashion & Apparel', subCategory: 'Men\'s Wear', stores: '51-100', region: 'US' },
  'rothys.com':      { category: 'Fashion & Apparel', subCategory: 'Sustainable Footwear', stores: '11-20', region: 'US' },
  'vuoriclothing.com': { category: 'Fashion & Apparel', subCategory: 'Activewear', stores: '21-50', region: 'US' },
  'brooklinen.com':  { category: 'Home & Living', subCategory: 'Bedding & Bath', onlineOnly: true, region: 'US' },
  'casper.com':      { category: 'Home & Living', subCategory: 'Mattress', stores: '21-50', region: 'US' },
  'awayfrom.com':    { category: 'Fashion & Apparel', subCategory: 'Luggage & Travel', stores: '11-20', region: 'US' },
  'glossier.com':    { category: 'Beauty & Personal Care', subCategory: 'Beauty & Skincare', stores: '1-10', region: 'US' },
  'fabletics.com':   { category: 'Fashion & Apparel', subCategory: 'Activewear', onlineOnly: true, region: 'US' },
  'dollarshaveclub.com': { category: 'Beauty & Personal Care', subCategory: 'Men\'s Grooming', onlineOnly: true, region: 'US' },
  'harrys.com':      { category: 'Beauty & Personal Care', subCategory: 'Men\'s Grooming', onlineOnly: true, region: 'US' },
  'chubbiesshorts.com': { category: 'Fashion & Apparel', subCategory: 'Men\'s Wear', onlineOnly: true, region: 'US' },
  'outdoorvoices.com': { category: 'Fashion & Apparel', subCategory: 'Activewear', stores: '1-10', region: 'US' },
  'bombas.com':      { category: 'Fashion & Apparel', subCategory: 'Socks & Underwear', onlineOnly: true, region: 'US' },
  'mejuri.com':      { category: 'Jewelry', subCategory: 'Fine Jewelry', stores: '21-50', region: 'US' },
  'skims.com':       { category: 'Fashion & Apparel', subCategory: 'Shapewear & Intimates', stores: '1-10', region: 'US' },
  'kith.com':        { category: 'Fashion & Apparel', subCategory: 'Streetwear', stores: '11-20', region: 'US' },
  'parachutehome.com': { category: 'Home & Living', subCategory: 'Bedding & Bath', stores: '1-10', region: 'US' },
  'framebridge.com': { category: 'Home & Living', subCategory: 'Art & Framing', stores: '11-20', region: 'US' },
  'hims.com':        { category: 'Health & Wellness', subCategory: 'Telehealth & Wellness', onlineOnly: true, region: 'US' },
  'chewy.com':       { category: 'Pet Supplies', subCategory: 'Pet Food & Supplies', onlineOnly: true, region: 'US' },
  'barkbox.com':     { category: 'Pet Supplies', subCategory: 'Pet Subscription', onlineOnly: true, region: 'US' },
  'nativecos.com':   { category: 'Beauty & Personal Care', subCategory: 'Natural Personal Care', onlineOnly: true, region: 'US' },
  'rhone.com':       { category: 'Fashion & Apparel', subCategory: 'Men\'s Activewear', stores: '1-10', region: 'US' },
  'cotopaxi.com':    { category: 'Fashion & Apparel', subCategory: 'Outdoor & Adventure', stores: '1-10', region: 'US' },
  'untuckit.com':    { category: 'Fashion & Apparel', subCategory: 'Men\'s Shirts', stores: '51-100', region: 'US' },
  'urbanoutfitters.com': { category: 'Fashion & Apparel', subCategory: 'Lifestyle & Fashion', stores: '100+', region: 'US' },
  'anthropologie.com': { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', stores: '100+', region: 'US' },
  'freepeople.com':  { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', stores: '100+', region: 'US' },
  'jcrew.com':       { category: 'Fashion & Apparel', subCategory: 'Classic Fashion', stores: '100+', region: 'US' },
  'abercrombie.com': { category: 'Fashion & Apparel', subCategory: 'Casual Wear', stores: '100+', region: 'US' },
  'ae.com':          { category: 'Fashion & Apparel', subCategory: 'Casual Wear', stores: '100+', region: 'US' },
  'lululemon.com':   { category: 'Fashion & Apparel', subCategory: 'Activewear', stores: '100+', region: 'US' },
  'bathandbodyworks.com': { category: 'Beauty & Personal Care', subCategory: 'Bath & Body', stores: '100+', region: 'US' },
  'sephora.com':     { category: 'Beauty & Personal Care', subCategory: 'Beauty Retail', stores: '100+', region: 'US' },
  'sephora.in':      { category: 'Beauty & Personal Care', subCategory: 'Beauty Retail', stores: '21-50', region: 'India' },
  'ulta.com':        { category: 'Beauty & Personal Care', subCategory: 'Beauty Retail', stores: '100+', region: 'US' },
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
  'dennislingo.com': { category: 'Fashion & Apparel', subCategory: 'Men\'s Fashion', stores: '1-10', region: 'India' },
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
  'nishhair.com':     { category: 'Beauty & Personal Care', subCategory: 'Hair Care', onlineOnly: true, region: 'India' },
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
  'zudio.com':         { category: 'Fashion & Apparel', subCategory: 'Fast Fashion', stores: '500+', region: 'India' },
  'sony.com':         { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global' },
  'dell.com':         { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100+', region: 'Global' },
  'hp.com':           { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100+', region: 'Global' },
  'lenovo.com':       { category: 'Electronics & Tech', subCategory: 'Computers & Laptops', stores: '100+', region: 'Global' },
  'bose.com':         { category: 'Electronics & Tech', subCategory: 'Premium Audio', stores: '100+', region: 'Global' },
  'jbl.com':          { category: 'Electronics & Tech', subCategory: 'Audio', stores: '100+', region: 'Global' },
  'dyson.com':        { category: 'Electronics & Tech', subCategory: 'Home Appliances', stores: '51-100', region: 'Global' },
  // Cameras & Imaging (camera / lens / imaging brands — often misread as News/Media
  // because their sites are press- and content-heavy)
  'canon.com':        { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', stores: '100+', region: 'Global', parentBrand: 'Canon' },
  'in.canon':         { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', stores: '51-100', region: 'India', parentBrand: 'Canon' },
  'usa.canon.com':    { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', stores: '100+', region: 'US', parentBrand: 'Canon' },
  'global.canon':     { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', stores: '100+', region: 'Global', parentBrand: 'Canon' },
  'nikon.com':        { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', stores: '100+', region: 'Global', parentBrand: 'Nikon' },
  'nikon.co.in':      { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', stores: '51-100', region: 'India', parentBrand: 'Nikon' },
  'fujifilm.com':     { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', stores: '100+', region: 'Global', parentBrand: 'Fujifilm' },
  'fujifilm-x.com':   { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', onlineOnly: true, region: 'Global', parentBrand: 'Fujifilm' },
  'panasonic.com':    { category: 'Electronics & Tech', subCategory: 'Consumer Electronics', stores: '100+', region: 'Global', parentBrand: 'Panasonic' },
  'olympus-imaging.com': { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', onlineOnly: true, region: 'Global' },
  'om-digitalsolutions.com': { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', onlineOnly: true, region: 'Global' },
  'leica-camera.com': { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', stores: '51-100', region: 'Global', parentBrand: 'Leica' },
  'gopro.com':        { category: 'Electronics & Tech', subCategory: 'Action Cameras', onlineOnly: true, region: 'Global', parentBrand: 'GoPro' },
  'dji.com':          { category: 'Electronics & Tech', subCategory: 'Drones & Cameras', stores: '51-100', region: 'Global', parentBrand: 'DJI' },
  'insta360.com':     { category: 'Electronics & Tech', subCategory: 'Action Cameras', onlineOnly: true, region: 'Global', parentBrand: 'Insta360' },
  'sigma-global.com': { category: 'Electronics & Tech', subCategory: 'Camera Lenses', onlineOnly: true, region: 'Global', parentBrand: 'Sigma' },
  'tamron.com':       { category: 'Electronics & Tech', subCategory: 'Camera Lenses', onlineOnly: true, region: 'Global', parentBrand: 'Tamron' },
  'hasselblad.com':   { category: 'Electronics & Tech', subCategory: 'Cameras & Imaging', onlineOnly: true, region: 'Global', parentBrand: 'Hasselblad' },
  // Home & Living
  'ikea.com':         { category: 'Home & Living', subCategory: 'Furniture & Home', stores: '100+', region: 'Global' },
  'woodenstreet.com': { category: 'Home & Living', subCategory: 'Furniture', stores: '51-100', region: 'India' },
  'pepperfry.com':    { category: 'Home & Living', subCategory: 'Furniture Marketplace', stores: '51-100', region: 'India' },
  'urbanladder.com':  { category: 'Home & Living', subCategory: 'Furniture', stores: '21-50', region: 'India' },
  'sleepycat.in':     { category: 'Home & Living', subCategory: 'Mattresses & Sleep', onlineOnly: true },
  'wakefit.co':       { category: 'Home & Living', subCategory: 'Mattresses & Sleep', stores: '100+', storeCount: 114, region: 'India' },
  'sleepwell.co.in':  { category: 'Home & Living', subCategory: 'Mattresses & Sleep', stores: '100+', region: 'India' },
  'godrejinterio.com':{ category: 'Home & Living', subCategory: 'Furniture', stores: '100+', region: 'India' },
  'hometown.in':      { category: 'Home & Living', subCategory: 'Home Decor', stores: '51-100', region: 'India' },
  'nestasia.in':      { category: 'Home & Living', subCategory: 'Home Decor', onlineOnly: true },
  // Food & Beverage
  'eighthbyanurita.in': { category: 'Food & Beverage', subCategory: 'Bakery & Baked Goods', stores: '1', region: 'India' },
  'leeva.in':          { category: 'Electronics & Tech', subCategory: 'Home Appliances', stores: '1-10', region: 'India' },
  'casime.in':         { category: 'Electronics & Tech', subCategory: 'Mobile Covers & Cases', onlineOnly: true, region: 'India' },
  'pereyan.com':       { category: 'Baby & Kids', subCategory: 'Toys & Games', onlineOnly: true, region: 'India' },
  'federflex.com':     { category: 'Health & Wellness', subCategory: 'Medical Devices', onlineOnly: true, region: 'India' },
  'mourierro.com':     { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', onlineOnly: true, region: 'India' },
  'rahulphate.com':    { category: 'Beauty & Personal Care', subCategory: 'Skincare', stores: '1-10', region: 'India' },
  'comicsense.in':     { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true, region: 'India' },
  'comicsense.store':  { category: 'Fashion & Apparel', subCategory: 'Streetwear', onlineOnly: true, region: 'India' },
  'damroindia.com':    { category: 'Home & Living', subCategory: 'Furniture', stores: '100+', region: 'India' },
  'idocindia.com':     { category: 'Electronics & Tech', subCategory: 'Mobile Covers & Cases', onlineOnly: true, region: 'India' },
  'cmmarena.com':      { category: 'Home & Living', subCategory: 'Furniture', stores: '1-10', region: 'India' },
  'styleunion.in':     { category: 'Fashion & Apparel', subCategory: 'Casual Wear', stores: '100+', region: 'India' },
  'ekatvamacademy.com': { category: 'EdTech', subCategory: 'K-12 & Test Prep', stores: '1-10', region: 'India', appPresence: 'Both iOS & Android' },
  'exoticindia.com':   { category: 'Art & Collectibles', subCategory: 'Fine Art', onlineOnly: true, region: 'India' },
  'houseofindya.com':  { category: 'Fashion & Apparel', subCategory: 'Ethnic Wear', onlineOnly: true, region: 'India' },
  'giftstoindia24x7.com': { category: 'Gifting', subCategory: 'Multi-category Gifts', onlineOnly: true, region: 'India' },
  'gocolors.com':      { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', stores: '100+', region: 'India' },
  'justwatches.com':   { category: 'Fashion & Apparel', subCategory: 'Watches', onlineOnly: true, region: 'India' },
  'kamalwatch.com':    { category: 'Fashion & Apparel', subCategory: 'Watches', stores: '1-10', region: 'India' },
  'havells.com':       { category: 'Electronics & Tech', subCategory: 'Home Appliances', stores: '100+', region: 'India', parentBrand: 'Havells' },
  'mylloyd.com':       { category: 'Electronics & Tech', subCategory: 'Home Appliances', stores: '100+', region: 'India', parentBrand: 'Havells' },
  'faballey.com':      { category: 'Fashion & Apparel', subCategory: 'Women\'s Wear', onlineOnly: true, region: 'India' },
  'chaipoint.com':    { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '100+', region: 'India' },
  'starbucks.com':    { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '100+', region: 'Global' },
  'starbucks.in':     { category: 'Food & Beverage', subCategory: 'Cafe Chain', stores: '100+', region: 'India' },
  'mcdonalds.com':    { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'Global' },
  'dominos.com':      { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'Global' },
  'dominos.co.in':    { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'India' },
  'kfc.com':          { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'Global' },
  'subway.com':       { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '100+', region: 'Global' },
  'burgerfarm.in':    { category: 'Food & Beverage', subCategory: 'Quick Service Restaurant', stores: '51-100', storeCount: 54, region: 'India' },
  'zomato.com':       { category: 'Food & Beverage', subCategory: 'Food Delivery', onlineOnly: true },
  'swiggy.com':       { category: 'Food & Beverage', subCategory: 'Food Delivery', onlineOnly: true },
  'deliveryhero.com': { category: 'Food Delivery', subCategory: 'Restaurant Delivery', onlineOnly: true, region: 'Global' },
  'blinkit.com':      { category: 'Food & Beverage', subCategory: 'Quick Commerce', onlineOnly: true },
  'zepto.co':         { category: 'Food & Beverage', subCategory: 'Quick Commerce', onlineOnly: true },
  'bigbasket.com':    { category: 'Food & Beverage', subCategory: 'Online Grocery', onlineOnly: true },
  'licious.in':       { category: 'Food & Beverage', subCategory: 'Fresh Meat & Seafood', onlineOnly: true },
  'godavaricuts.com': { category: 'Grocery & Supermarket', subCategory: 'Meat & Seafood', region: 'India' },
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
  'myescplan.com':    { category: 'Fashion & Apparel', subCategory: 'Luggage & Travel', region: 'India' },
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
  'houseofbiryan.com': { category: 'Food & Beverage', subCategory: 'Biryani', onlineOnly: true, region: 'India' },
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
  // Astrology & Spiritual Services
  'astrotalk.com':    { category: 'Astrology & Spiritual Services', subCategory: 'Astrology Consultation', onlineOnly: true, region: 'India' },
  'astrosage.com':    { category: 'Astrology & Spiritual Services', subCategory: 'Horoscope & Kundli', onlineOnly: true, region: 'India' },
  'ganeshaspeaks.com':{ category: 'Astrology & Spiritual Services', subCategory: 'Astrology Consultation', onlineOnly: true, region: 'India' },
  'clickastro.com':   { category: 'Astrology & Spiritual Services', subCategory: 'Horoscope & Kundli', onlineOnly: true, region: 'India' },
  'anytimeastro.com': { category: 'Astrology & Spiritual Services', subCategory: 'Astrology Consultation', onlineOnly: true, region: 'India' },
  'astroyogi.com':    { category: 'Astrology & Spiritual Services', subCategory: 'Astrology Consultation', onlineOnly: true, region: 'India' },
  'mpanchang.com':    { category: 'Astrology & Spiritual Services', subCategory: 'Panchang & Muhurat', onlineOnly: true, region: 'India' },
  'prokerala.com':    { category: 'Astrology & Spiritual Services', subCategory: 'Horoscope & Kundli', onlineOnly: true, region: 'India' },
  'vedicastrozone.com':{ category: 'Astrology & Spiritual Services', subCategory: 'Vedic Astrology', onlineOnly: true, region: 'India' },
  'indianastrology.com':{ category: 'Astrology & Spiritual Services', subCategory: 'Vedic Astrology', onlineOnly: true, region: 'India' },
  // Web Hosting
  'godaddy.com':      { category: 'Web Hosting & Domains', subCategory: 'Domain Services', onlineOnly: true },
  'hostinger.com':    { category: 'Web Hosting & Domains', subCategory: 'Shared Hosting', onlineOnly: true },
  'bluehost.com':     { category: 'Web Hosting & Domains', subCategory: 'Shared Hosting', onlineOnly: true },
  'cloudflare.com':   { category: 'Web Hosting & Domains', subCategory: 'CDN & Performance', onlineOnly: true },
  // Home Services
  'urbancompany.com': { category: 'Home Services', subCategory: 'Repairs & Maintenance', onlineOnly: true },
  'withpronto.com':   { category: 'Home Services', subCategory: 'Repairs & Maintenance', onlineOnly: true },
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
  'furlenco.com':     { category: 'Home & Living', subCategory: 'Furniture', stores: '21-50', region: 'India' },
  'rentomojo.com':    { category: 'Rental & Subscription Services', subCategory: 'Furniture Rental', onlineOnly: true },
  // ── Bulk known brands (auto-classify without scan) ──────────────────
  // Tech Platforms
  'google.com':       { category: 'SaaS & B2B', subCategory: 'Developer Tools', onlineOnly: true },
  'facebook.com':     { category: 'Social Media & Platforms', subCategory: 'Social Network', onlineOnly: true },
  'soundcloud.com':   { category: 'Media & Entertainment', subCategory: 'Music Streaming', onlineOnly: true },
  'etsy.com':         { category: 'Ecommerce/Retail', subCategory: 'Marketplace', onlineOnly: true },
  'mcafee.com':       { category: 'Cybersecurity', subCategory: 'Endpoint Security', onlineOnly: true },
  'cybx.in':          { category: 'Cybersecurity', subCategory: 'Mobile Security', onlineOnly: true, region: 'India' },
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
  // FinTech / financial trade publications — these COVER fintech, they are not fintechs
  'fintech.global':    { category: 'News & Media', subCategory: 'Business & Financial News', onlineOnly: true },
  'fintechfeatures.com':{ category: 'News & Media', subCategory: 'Business & Financial News', onlineOnly: true },
  'fintechzoom.com':   { category: 'News & Media', subCategory: 'Business & Financial News', onlineOnly: true },
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
  'herolectro.com':  { category: 'Automotive', subCategory: 'Electric Bicycle', stores: '1-10', region: 'India' },
  'herocycles.com':  { category: 'Automotive', subCategory: 'Bicycle', stores: '100+', region: 'India' },
  'zostel.com':      { category: 'Travel & Ticketing', subCategory: 'Hostels & Backpacking', stores: '51-100', region: 'India' },
  'zyppys.com':      { category: 'Transportation & Mobility', subCategory: 'Car Rental', onlineOnly: true, region: 'India' },
  'zoomcar.com':     { category: 'Transportation & Mobility', subCategory: 'Car Rental', onlineOnly: true, region: 'India' },
  'drivezy.com':     { category: 'Transportation & Mobility', subCategory: 'Car Rental', onlineOnly: true, region: 'India' },
  'revv.co.in':      { category: 'Transportation & Mobility', subCategory: 'Car Rental', onlineOnly: true, region: 'India' },
  'zo.xyz':          { category: 'Social Media & Platforms', subCategory: 'Community Platform', onlineOnly: true, region: 'India' },
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
  'adanione.com':     { category: 'Travel & Ticketing', subCategory: 'Airport Services', onlineOnly: true, region: 'India' },
  'nishkarshsharma.com': { category: 'EdTech', subCategory: 'Online Education', onlineOnly: true, region: 'India' },
  'poketcg.in':       { category: 'Art & Collectibles', subCategory: 'Trading Cards', onlineOnly: true, region: 'India' },
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
  'loverollers.com':  { category: 'Health & Wellness', subCategory: 'Sexual Wellness', onlineOnly: true },
  'durexindia.com':   { category: 'Health & Wellness', subCategory: 'Sexual Wellness', stores: '100+', region: 'India' },
  'durex.com':        { category: 'Health & Wellness', subCategory: 'Sexual Wellness', stores: '100+', region: 'Global' },
  // Gifting
  'fnp.com':          { category: 'Gifting', subCategory: 'Flowers & Bouquets', stores: '100+', region: 'India' },
  'fernsandpetals.com': { category: 'Gifting', subCategory: 'Flowers & Bouquets', stores: '100+', region: 'India' },
  'happyribbon.in':   { category: 'Gifting', subCategory: 'Personalized Gifts', onlineOnly: true, region: 'India' },
  'igp.com':          { category: 'Gifting', subCategory: 'Multi-category Gifts', onlineOnly: true, region: 'India' },
  'floweraura.com':   { category: 'Gifting', subCategory: 'Flowers & Bouquets', stores: '51-100', region: 'India' },
  'winni.in':         { category: 'Gifting', subCategory: 'Cakes & Flowers', stores: '100+', region: 'India' },
  'bakingo.com':      { category: 'Gifting', subCategory: 'Cakes & Bakery Gifts', onlineOnly: true, region: 'India' },
  'bloomsvilla.com':  { category: 'Gifting', subCategory: 'Flowers & Bouquets', onlineOnly: true, region: 'India' },
  'giftcart.com':     { category: 'Gifting', subCategory: 'Multi-category Gifts', onlineOnly: true, region: 'India' },
  'confettireams.com':{ category: 'Gifting', subCategory: 'Corporate Gifts', onlineOnly: true },
  'chococraft.in':    { category: 'Gifting', subCategory: 'Chocolate Gifts', onlineOnly: true, region: 'India' },
  'presto.gifts':     { category: 'Gifting', subCategory: 'Personalized Gifts', onlineOnly: true },
  '1800flowers.com':  { category: 'Gifting', subCategory: 'Flowers & Bouquets', stores: '100+', region: 'US' },
  'proflowers.com':   { category: 'Gifting', subCategory: 'Flowers & Bouquets', onlineOnly: true, region: 'US' },
  'ediblearrangements.com': { category: 'Gifting', subCategory: 'Edible Gifts', stores: '100+', region: 'US' },
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
  'Fashion & Apparel': ['fashion', 'clothing', 'apparel', 'outfit', 'garment', 'kurta', 'ethnic wear', 'wardrobe', 't-shirt', 'tshirt', 'jeans', 'trouser', 'hoodie', 'jacket', 'designer t-shirt', 'jogger', 'sweatshirt', 'blazer', 'menswear', 'womenswear', 'blouse', 'sweater', 'cardigan', 'skirt', 'legging', 'activewear', 'loungewear', 'sleepwear', 'pajama', 'swimwear', 'bikini', 'underwear', 'lingerie', 'shapewear', 'sports bra', 'bralette', 'saree', 'sarees', 'sari', 'lehenga', 'salwar', 'dupatta', 'anarkali', 'kurti', 'sherwani', 'dhoti', 'palazzo', 'churidar', 'bandhani', 'patola', 'georgette', 'chiffon', 'designer saree', 'shoes', 'footwear', 'sneaker', 'sneakers', 'sandals', 'slippers', 'heels', 'boots', 'loafers', 'moccasin', 'flip flop', 'flip flops', 'stiletto', 'platform shoe', 'oxford shoe', 'brogue', 'espadrille', 'running shoes', 'athletic shoes', 'dress shoes', 'handbag', 'backpack', 'tote bag', 'crossbody', 'clutch bag', 'duffel bag', 'luggage', 'fashion watch', 'analog watch', 'dress watch', 'wristwatch', 'sunglasses', 'eyewear', 'eyeglasses', 'spectacles', 'contact lens', 'blue light glasses', 'fashion belt', 'beanie', 'fedora', 'bucket hat', 'scarf', 'bandana', 'hair accessories', 'scrunchie', 'headband', 'phone case', 'wallet', 'cardholder', 'socks', 'hosiery', 'modest fashion', 'hijab', 'abaya', 'adaptive clothing', 'plus size', 'plus-size', 'maternity wear', 'sustainable fashion', 'eco fashion', 'upcycled fashion', 'kapda', 'chappal', 'jutti', 'mojari', 'kolhapuri', 'phulkari', 'zardozi', 'chikankari', 'kalamkari', 'block print', 'ajrakh', 'banarasi', 'kanjivaram', 'chanderi', 'maheshwari', 'pochampally', 'tant saree', 'jamdani', 'tussar', 'muga silk', 'pashmina', 'nehru jacket', 'pathani suit', 'lungi', 'mundu', 'veshti', 'anime merch', 'anime merchandise', 'anime store', 'anime tee', 'anime hoodie', 'manga merch', 'merchandise store', 'merch store', 'fandom store', 'pop culture store', 'geek store', 'graphic tees', 'printed tees', 'oversized tee', 'oversized t-shirt', 'drop shoulder', 'watch', 'watches', 'timepiece', 'timepieces', 'chronograph', 'wristwatch', 'luxury watch', 'automatic watch'],
  'Jewelry':           ['jewellery', 'jewelry', 'diamond ring', 'gold jewel', 'necklace', 'bracelet', 'silver jewel', 'pendant', 'earring', 'gold chain', 'mangalsutra', 'karat', 'gold ring', 'silver ring', 'anklet', 'bangle', 'cuff link', 'stud earring', 'hoop earring', 'fine jewelry', 'costume jewelry', 'engagement ring', 'wedding band', 'birthstone', 'charm bracelet', 'sterling silver', 'solitaire', 'jeweller', 'jewelers'],
  'Beauty & Personal Care': ['beauty', 'skincare', 'skin care', 'cosmetic', 'makeup', 'hair care', 'fragrance', 'perfume', 'face wash', 'shampoo', 'conditioner', 'moisturizer', 'sunscreen', 'foundation makeup', 'mascara', 'lipstick', 'body lotion', 'face serum', 'face cream', 'cleanser', 'toner', 'exfoliant', 'eyeshadow', 'blush', 'bronzer', 'concealer', 'cologne', 'body spray', 'beard oil', 'shaving cream', 'aftershave', 'body wash', 'soap', 'bath bomb', 'deodorant', 'nail polish', 'cruelty-free', 'clean beauty', 'vegan beauty', 'hair extensions', 'hair topper', 'clip-in extensions', 'wig', 'wigs', 'human hair', 'hair piece', 'hair solution', 'hair system', 'lace wig', 'tape-in extensions', 'beauty products', 'beauty brand', 'beauty routine', 'skin treatment', 'anti-aging cream', 'hyaluronic acid', 'retinol serum', 'vitamin c serum', 'beauty box', 'cosmetics brand', 'beauty store', 'makeup kit', 'beauty regimen', 'skin glow', 'complexion', 'beauty tips', 'k-beauty', 'korean beauty', 'korean skincare', 'j-beauty', 'japanese beauty', 'ayurvedic beauty', 'dermaceutical', 'cosmeceutical', 'derma', 'dermatologist tested', 'ubtan', 'haldi', 'multani mitti', 'kumkumadi', 'rose water', 'gulab jal', 'kohl', 'kajal', 'sindoor', 'alta', 'mehndi', 'mehendi', 'henna'],
  'Food & Beverage':   ['beverage', 'snack', 'chocolate', 'bakery', 'baking', 'bake', 'bakes', 'fresh bakes', 'baking studio', 'baking class', 'baking classes', 'cooking class', 'cooking classes', 'cake', 'cakes', 'cupcake', 'cupcakes', 'muffin', 'brownie', 'cookie', 'cookies', 'pastry', 'patisserie', 'fondant', 'frosting', 'icing', 'confectionery', 'dessert', 'desserts', 'macaron', 'croissant', 'meal kit', 'protein bar', 'jerky', 'coffee beans', 'tea leaves', 'matcha', 'spirits brand', 'vitamins', 'collagen', 'probiotics', 'organic food', 'vegan food', 'gluten-free', 'keto', 'kombucha', 'energy drink', 'sparkling water', 'condiment', 'spices', 'sauce', 'nut butter', 'nutrition facts', 'non-gmo', 'food brand', 'food product', 'food company', 'recipe', 'ingredients', 'calories', 'packaged food', 'ready to eat', 'food delivery', 'meal prep', 'biryani', 'biryan', 'pizza', 'burger', 'kebab', 'curry', 'tandoori', 'masala', 'pickle', 'papad', 'sweets', 'mithai', 'namkeen', 'dry fruits', 'ghee', 'paneer', 'dal', 'rice', 'flour', 'atta', 'honey', 'jam', 'chutney', 'ice cream', 'frozen food', 'chef', 'cuisine', 'flavour', 'flavor', 'delicious', 'tasty', 'order food', 'order online', 'menu', 'superfood', 'functional food', 'adaptogen', 'nootropic', 'millet', 'ragi', 'bajra', 'jowar', 'quinoa', 'chia seeds', 'flax seeds', 'mukhwas', 'achaar', 'ladoo', 'barfi', 'halwa', 'peda', 'rasgulla', 'gulab jamun', 'jalebi', 'kheer', 'rabri', 'makhana', 'poha', 'upma', 'dosa', 'idli', 'sambar', 'chaat', 'bhujia', 'sev', 'farsan', 'thepla', 'khakhra', 'roti', 'naan', 'paratha', 'cloud kitchen', 'meal subscription'],
  'Home & Living':     ['furniture', 'home decor', 'interior design', 'mattress', 'bedding', 'home furnishing', 'sofa set', 'curtain', 'area rug', 'cushion cover', 'table lamp', 'wall art', 'throw pillow', 'candle', 'mirror', 'vase', 'lighting', 'sheet', 'duvet', 'comforter', 'towel', 'bathrobe', 'cookware', 'dinnerware', 'cutlery', 'small appliance', 'smart home', 'smart speaker', 'thermostat', 'cleaning product', 'detergent', 'weighted blanket', 'sleep trial', 'power tools', 'hand tools', 'drill', 'saw', 'grinder', 'welder', 'compressor', 'generator', 'plumbing', 'lumber', 'paint', 'home improvement', 'homebase', 'homeware', 'homewares', 'diy', 'renovation', 'landscaping', 'garden', 'gardening', 'fencing', 'roofing', 'flooring', 'bathroom', 'kitchen renovation', 'trade tools', 'industrial tools', 'workshop', 'workbench', 'wallpaper', 'shelving', 'outdoor furniture', 'patio', 'shed', 'greenhouse', 'lawn mower', 'pressure washer'],
  'Health & Wellness': ['fitness equipment', 'gym equipment', 'workout gear', 'yoga mat', 'exercise equipment', 'treadmill', 'dumbbell', 'kettlebell', 'resistance band', 'exercise bike', 'sexual wellness', 'intimacy product', 'condom', 'condoms', 'pleasure product', 'personal massager', 'intimate care', 'aromatherapy', 'essential oil', 'self-care kit', 'blood pressure monitor', 'medical thermometer', 'first aid kit', 'compression wear', 'compression stockings', 'compression socks', 'anti-embolism', 'varicose vein', 'diabetic socks', 'orthopedic', 'orthopaedic', 'knee brace', 'knee cap', 'ankle brace', 'wrist brace', 'back support', 'lumbar belt', 'cervical collar', 'calf support', 'support belt', 'abdominal belt', 'hernia belt', 'massage tool', 'foam roller', 'recovery tool', 'wellness product', 'health supplement', 'dietary supplement', 'sleep aid', 'melatonin', 'cbd oil', 'hemp product', 'anti-aging', 'collagen supplement', 'probiotic', 'gut health', 'immunity booster', 'pain relief', 'muscle recovery', 'joint support', 'ayurvedic', 'ayurveda', 'herbal remedy', 'herbal product', 'herbal medicine', 'natural remedy', 'immunity', 'digestive care', 'digestive health', 'joint care', 'liver care', 'oral care tablet', 'health tonic', 'health syrup', 'kadha', 'churna', 'single herbs', 'herbal supplement', 'acidity relief', 'throat care', 'sleep support', 'mental wellness', 'men\'s health', 'women\'s health', 'siddha', 'unani', 'naturopathy', 'homeopathy', 'nutraceutical', 'fertility supplement', 'prenatal vitamin', 'postnatal care', 'pcos', 'period care', 'menstrual cup', 'sanitary pad', 'menstrual health', 'sleep tracker', 'sleep tech', 'white noise machine', 'cpap', 'telehealth', 'online doctor', 'cgm', 'continuous glucose monitor', 'blood sugar', 'diabetes care', 'triphala', 'ashwagandha', 'brahmi', 'tulsi', 'neem', 'amla', 'giloy', 'shatavari', 'moringa', 'turmeric supplement', 'chyawanprash'],
  'Baby & Kids':       ['kids wear', 'baby care', 'toys', 'toy', 'newborn', 'toddler', 'infant', 'baby clothes', 'nursery', 'diaper', 'stroller', 'baby monitor', 'car seat', 'pacifier', 'baby bottle', 'educational toy', 'puzzle', 'board game', 'action figure', 'doll', 'kids furniture', 'crib', 'toddler bed', 'baby skincare', 'learning kit', 'bpa-free', 'non-toxic toy', 'choking hazard', 'baby food', 'breast pump', 'bottle warmer', 'sterilizer', 'highchair', 'baby gate', 'baby proofing', 'maternity', 'prenatal', 'pregnancy', 'nursing pillow', 'baby carrier', 'diaper bag', 'baby wash', 'baby lotion', 'teether', 'rattle', 'play mat', 'baby walker', 'kids tablet', 'lego', 'building blocks', 'stuffed animal', 'kids book', 'coloring book', 'activity kit', 'montessori', 'montessori toy', 'flashcard', 'flashcards', 'diy toy', 'wooden toy', 'sensory toy', 'stem toy', 'stacking toy', 'shape sorter', 'kids craft', 'kids activity', 'return gift', 'return gifts', 'birthday return gift', 'kids gift', 'baby gift set', 'baby shower gift', 'kids party', 'party favour', 'party favor', 'kids game', 'outdoor toy', 'ride on', 'tricycle', 'balance bike', 'kids costume', 'pretend play', 'play kitchen', 'toy car', 'soft toy', 'plush toy'],
  'Pet Products':      ['pet food', 'dog food', 'cat food', 'pet care', 'pet supplies', 'dog treat', 'cat litter', 'pet grooming', 'pet collar', 'leash', 'pet bed', 'pet crate', 'pet toy', 'flea treatment', 'pet dental care', 'cat tree', 'scratching post', 'pet clothing', 'vet recommended', 'aquarium', 'fish tank', 'bird cage', 'pet carrier', 'pet harness', 'raw dog food', 'grain free', 'pet subscription', 'pet tracker', 'gps collar', 'pet insurance', 'puppy', 'kitten', 'dog breed', 'cat breed', 'pet parent', 'fur baby'],
  'Electronics & Tech': ['electronics', 'gadget', 'smartphone', 'laptop', 'tech accessories', 'earbuds', 'headphone', 'smartwatch', 'charger', 'power bank', 'tablet', 'monitor', 'camera', 'drone', 'fitness tracker', 'smart ring', 'speaker', 'soundbar', 'microphone', 'gaming console', 'gaming keyboard', 'gaming mouse', 'controller', 'gaming chair', 'webcam', 'bluetooth', 'usb-c', 'wireless', 'smart home', 'home automation', 'smart bulb', 'smart plug', 'robot vacuum', 'ev charger', 'ev accessories', 'dash cam', 'action camera', 'refurbished electronics', 'renewed', 'open box', 'wearable tech', 'smart glasses', 'gpu', 'graphics card', 'motherboard', 'processor', 'ssd', 'nvme', 'ram', 'pc build', 'custom pc', 'mechanical keyboard', 'curved monitor', 'projector', 'home theater', 'streaming device', 'set top box', 'wifi router', 'mesh wifi', 'network switch', 'nas', 'external hard drive', 'portable ssd', 'air cooler', 'desert cooler', 'tower cooler', 'personal cooler', 'evaporative cooler', 'room cooler', 'tower fan', 'table fan', 'ceiling fan', 'pedestal fan', 'exhaust fan', 'wall fan', 'air purifier', 'dehumidifier', 'humidifier', 'heater', 'room heater', 'geyser', 'water heater', 'iron', 'steam iron', 'vacuum cleaner', 'air fryer', 'induction cooktop', 'mixer grinder', 'juicer', 'food processor', 'toaster', 'electric kettle', 'water purifier', 'ro purifier', 'chimney', 'kitchen chimney', 'oven', 'microwave oven', 'washing machine', 'refrigerator', 'air conditioner', 'split ac', 'window ac', 'inverter ac', 'dishwasher', 'led tv', 'smart tv', 'television', 'mobile cover', 'phone cover', 'back cover', 'mobile case', 'phone case', 'bumper case', 'flip cover', 'tempered glass', 'screen protector', 'screen guard', 'mobile accessories', 'phone accessories', 'phone skin', 'popsocket'],
  'Sports & Outdoor': ['camping gear', 'hiking gear', 'tent', 'sleeping bag', 'camp stove', 'cooler', 'bicycle', 'skateboard', 'surfboard', 'paddleboard', 'fishing gear', 'golf club', 'grill', 'outdoor lighting', 'hammock', 'sports equipment', 'sporting goods', 'sportswear', 'sports wear', 'cricket bat', 'badminton', 'fitness gear', 'sports gear', 'cycling', 'outdoor sports', 'team sports', 'sports store', 'sports shop', 'weather-resistant gear', 'winter sports', 'skiing', 'snowboard', 'ice skating', 'rock climbing', 'bouldering', 'parkour', 'running gear', 'marathon', 'triathlon', 'combat sports', 'boxing', 'mma', 'wrestling gear', 'archery', 'shooting', 'equestrian', 'horse riding', 'yoga equipment', 'pilates equipment', 'table tennis', 'pool table', 'billiards', 'dart board', 'carrom', 'kabaddi', 'kho kho', 'volleyball', 'handball'],
  'Office & Stationery': ['stationery', 'notebook', 'ballpoint pen', 'fountain pen', 'diary', 'planner', 'art supplies', 'craft supplies', 'school supplies', 'journal', 'calendar', 'marker', 'highlighter', 'desk organizer', 'file storage', 'desk accessories', 'ergonomic chair', 'business card', 'stationery set'],
  // Level 3: Service Categories
  'EdTech':            ['education', 'online learning', 'online course', 'tuition', 'coaching class', 'edtech', 'classroom', 'curriculum', 'student portal', 'language learning', 'skill development', 'coding bootcamp', 'programming course', 'test prep', 'tutoring', 'learn at your own pace', 'ncert', 'cbse', 'icse', 'jee', 'neet', 'study material', 'question bank', 'sample paper', 'mock test', 'syllabus', 'exam preparation', 'board exam', 'competitive exam', 'entrance exam', 'physics wallah', 'lecture', 'textbook', 'workbook', 'practice question', 'solved example', 'chapter wise', 'subject wise', 'class 10', 'class 12', 'school book', 'oswaal', 'revision', 'previous year'],
  'FinTech':           ['fintech', 'digital wallet', 'p2p payment', 'buy now pay later', 'robo-advisor', 'credit monitoring', 'budgeting app', 'expense tracking', 'fdic insured', 'apy', 'insurtech', 'regtech', 'bnpl', 'open banking', 'credit scoring', 'neobank', 'digital payment', 'payment gateway', 'upi payment', 'contactless payment', 'financial app', 'money management app', 'stock trading app', 'demat account', 'investment app'],
  'Health & Wellness Services': ['healthcare', 'medical', 'ayurved', 'diagnostic', 'medicine', 'doctor', 'patient', 'telemedicine', 'virtual doctor', 'online prescription', 'therapy app', 'counseling', 'mental health app', 'fitness app', 'workout app', 'yoga app', 'meditation app', 'meal planning', 'calorie tracking', 'hipaa', 'health consultation', 'online doctor', 'health checkup', 'medical consultation'],
  'Telecom':           ['mobile plan', 'phone plan', 'internet service', 'mvno', '5g service', 'data plan', 'unlimited data', 'coverage map', 'no contract', 'prepaid plan', 'postpaid plan', 'home internet', 'broadband', 'telecom', 'satellite communication', 'voip', 'ucaas', '5g infrastructure', 'cable tv', 'iptv', 'tower infrastructure', 'telecom operator'],
  'Media & Entertainment': ['video streaming', 'streaming service', 'original series', 'live tv', 'sports streaming', 'cable replacement', 'stream movies', 'tv shows', 'original content', 'simultaneous streams', 'download for offline', 'ott platform', 'podcast platform', 'radio streaming', 'audiobook', 'ad-free listening', 'offline download', 'lossless audio', 'spatial audio', 'millions of songs', 'on-demand music', 'cloud gaming', 'game streaming', 'game subscription', 'game library', 'game pass', 'day-one release', 'gaming platform', 'web series', 'original movies', 'watch movies', 'movies online', 'bollywood', 'hollywood', 'telugu movies', 'tamil movies', 'hindi movies', 'dubbed movies', 'latest movies', 'movie collections', 'watch free'],
  'News & Media':      ['news', 'publishing house', 'editorial', 'journalism', 'newspaper', 'press release', 'media house', 'broadcast', 'news subscription', 'digital magazine', 'newsletter platform', 'premium newsletter', 'e-reading', 'kindle unlimited', 'paywall', 'ad-free reading', 'archive access', 'breaking news', 'investigative journalism', 'fact check', 'news aggregator', 'news app', 'daily news', 'local news', 'national news', 'world news', 'opinion column', 'editorial board', 'correspondent', 'news anchor', 'news desk', 'print media', 'news portal', 'news wire', 'press agency', 'media company', 'news channel', 'news network', 'samachar', 'khabar', 'patrika', 'dainik'],
  'Insurance':         ['insurance company', 'health insurance', 'life insurance', 'auto insurance', 'home insurance', 'renters insurance', 'pet insurance', 'travel insurance', 'insurance quote', 'get covered', 'coverage amount', 'insurance premium', 'insurance deductible', 'insurance policy', 'claim settlement', 'insurance underwriting', 'insurance agent', 'insurance broker', 'term life insurance', 'whole life insurance', 'insurance claim', 'motor insurance', 'general insurance', 'group insurance'],
  'Travel & Ticketing': ['travel agency', 'travel booking', 'flight booking', 'hotel booking', 'tour package', 'vacation package', 'resort booking', 'itinerary', 'holiday package', 'bus booking', 'train booking', 'cab booking', 'event ticketing', 'concert ticket', 'experience booking', 'vacation rental', 'best price guarantee', 'instant confirmation', 'hostel', 'hostels', 'backpacker', 'dormitory', 'homestay', 'homestays', 'book a stay', 'check-in', 'check-out', 'accommodation', 'guest house', 'bed and breakfast'],
  'Transportation & Mobility': ['ride-sharing', 'car-sharing', 'bike-sharing', 'scooter-sharing', 'parking subscription', 'ride credits', 'unlimited rides', 'rideshare app', 'taxi app', 'electric scooter rental', 'micro-mobility', 'public transit app', 'commuter pass', 'ride hailing', 'transportation app', 'car rental', 'car rentals', 'rent a car', 'self drive', 'self-drive', 'car hire', 'bike rental', 'bike rentals', 'rent a bike', 'scooter rental', 'vehicle rental', 'hourly rental', 'outstation cab', 'outstation car', 'chauffeur', 'intercity', 'ride booking', 'cab service', 'taxi service', 'car subscription', 'sedan', 'hatchback'],
  'Ecommerce/Retail':  ['ecommerce', 'e-commerce', 'online store', 'shop online', 'add to cart', 'marketplace', 'online shopping', 'buy online', 'online marketplace', 'multi-brand', 'cash on delivery', 'free delivery', 'social commerce', 'live shopping', 'cross-border ecommerce', 'd2c', 'direct to consumer', 'discount store', 'convenience store', 'vending machine', 'duty-free'],
  // Level 4: Extended Categories
  'Automotive':       ['car dealership', 'used cars', 'new cars', 'auto parts', 'car accessories', 'automobile', 'automotive', 'motorcycle', 'electric vehicle', 'car service', 'car wash', 'tire', 'tyre', 'engine oil', 'car insurance', 'test drive', 'showroom', 'auto repair', 'spare parts', 'car dealer', 'bike dealer', 'two wheeler', 'four wheeler', 'e-cycle', 'e-cycles', 'electric cycle', 'electric cycles', 'electric bicycle', 'electric bike', 'e-bike', 'e-bikes', 'electric scooter', 'e-scooter', 'bicycle', 'bicycles', 'cycling', 'pedal assist', 'ebike', 'battery cycle'],
  'Real Estate':      ['real estate', 'apartment', 'villa', 'flat for sale', 'plot for sale', 'housing', 'builder', 'real estate developer', 'residential property', 'commercial property', 'rent apartment', 'buy apartment', 'real estate agent', 'mortgage', 'home loan', 'property listing', 'bhk', 'penthouse', 'township', 'gated community', 'ready to move', 'under construction', 'rera', 'proptech'],
  'SaaS & B2B':       ['saas', 'software as a service', 'b2b software', 'enterprise software', 'cloud software', 'crm software', 'erp software', 'project management tool', 'workflow automation', 'business intelligence', 'data analytics platform', 'api platform', 'developer tools', 'devops', 'collaboration tool', 'team management', 'hr software', 'payroll software', 'accounting software', 'invoicing software', 'helpdesk software', 'ticketing system', 'no-code', 'low-code', 'customer support software', 'marketing automation', 'esignature', 'document management', 'vertical saas'],
  'Agriculture':      ['agriculture', 'farming', 'agritech', 'crop', 'fertilizer', 'pesticide', 'seeds', 'irrigation', 'tractor', 'farm equipment', 'dairy farm', 'poultry', 'livestock', 'organic farming', 'hydroponics', 'agri input', 'soil health', 'harvest', 'cold storage', 'grain', 'precision agriculture', 'smart farming', 'crop production', 'animal husbandry', 'drip irrigation', 'agricultural drone', 'seed treatment', 'plant breeding'],
  'Manufacturing':    ['manufacturing', 'factory', 'industrial', 'machinery', 'heavy equipment', 'steel', 'production line', 'assembly', 'cnc', 'lathe', 'fabrication', 'welding', 'casting', 'forging', 'oem', 'odm', 'iso certified', 'quality control', 'electronics manufacturing', 'contract manufacturing', '3d printing', 'additive manufacturing', 'precision engineering'],
  'Logistics':        ['logistics', 'supply chain', 'freight', 'shipping company', 'courier', 'warehousing', 'cold chain', 'last mile delivery', 'fleet management', 'cargo', 'trucking', 'express delivery', 'parcel', 'fulfillment center', '3pl', 'fourth party logistics', 'cross docking', 'customs brokerage', 'reverse logistics', 'drone delivery', 'supply chain management'],
  'Legal':            ['law firm', 'legal services', 'attorney', 'lawyer', 'advocate', 'legal advice', 'litigation', 'corporate law', 'intellectual property', 'trademark', 'patent', 'legal tech', 'contract management', 'legal document', 'court case', 'arbitration', 'legal compliance', 'regulatory affairs'],
  'HR & Recruitment':  ['recruitment', 'hiring', 'job portal', 'job board', 'human resources', 'talent acquisition', 'resume builder', 'onboarding', 'employee engagement', 'hr tech', 'payroll management', 'workforce management', 'applicant tracking', 'job listing', 'career page', 'headhunter'],
  'Energy & Utilities': ['solar energy', 'solar panel', 'renewable energy', 'wind energy', 'electricity', 'power generation', 'energy storage', 'ev battery', 'oil and gas', 'natural gas', 'petroleum', 'smart grid', 'energy efficiency', 'carbon neutral', 'clean energy', 'green energy', 'hydropower', 'hydrogen', 'fuel cell', 'geothermal', 'biomass', 'bioenergy', 'carbon trading'],
  'Art & Collectibles': ['art gallery', 'fine art', 'painting', 'sculpture', 'art print', 'canvas', 'collectible', 'antique', 'vintage', 'art collection', 'nft', 'digital art', 'art dealer', 'contemporary art', 'abstract art', 'photography prints', 'art marketplace', 'artwork', 'artworks', 'indian art', 'folk art', 'tribal art', 'statue', 'statues', 'idol', 'figurine', 'figurines', 'bronze statue', 'marble statue', 'buddha statue', 'wall hanging', 'art decor', 'art piece', 'mandala', 'thangka', 'miniature painting', 'madhubani', 'warli', 'pattachitra', 'pichwai', 'tanjore painting', 'rajasthani painting', 'mughal art', 'artifact', 'artefact', 'curio', 'memorabilia'],
  'Gifting':           ['gift shop', 'gift store', 'gifting', 'gifts', 'send gifts', 'send gift', 'online gift', 'gift online', 'gift delivery', 'gift hamper', 'gift basket', 'personalized gift', 'customized gift', 'gift card', 'gift voucher', 'gift box', 'gift set', 'birthday gift', 'anniversary gift', 'wedding gift', 'corporate gift', 'corporate gifting', 'flower delivery', 'send flowers', 'flower bouquet', 'fresh flowers', 'cake delivery', 'send cake', 'online cake', 'combo gift', 'same day delivery gift', 'midnight delivery', 'gift for him', 'gift for her', 'return gift', 'festival gift', 'diwali gift', 'christmas gift', 'valentines gift', 'rakhi gift', 'housewarming gift', 'gift portal', 'gift site', 'gift website', 'gifts online', 'gifts to india', 'gifts delivery', 'occasion gift', 'celebration gift', 'express delivery gift', 'same day gift', 'midnight gift'],
  'Wedding & Events':  ['wedding planner', 'wedding venue', 'event management', 'wedding dress', 'bridal', 'groom wear', 'wedding invitation', 'wedding card', 'invitation suite', 'wax seal', 'custom stamp', 'save the date', 'rsvp', 'wedding stationery', 'wedding decoration', 'catering', 'florist', 'wedding photographer', 'event planner', 'banquet', 'party supplies', 'wedding registry', 'honeymoon', 'wedding cake', 'envelope set', 'invitation design'],
  'Printing & Packaging': ['printing service', 'custom printing', 'packaging', 'label printing', 'business cards', 'banner', 'signage', 'flex printing', 'digital printing', 'offset printing', 'corrugated box', 'packaging design', 'branded packaging', 'sticker printing', 'brochure printing', 'merchandise printing'],
  'Pharmacy & Optical': ['pharmacy', 'chemist', 'drugstore', 'otc medicine', 'online pharmacy', 'medical store', 'optical store', 'contact lenses', 'prescription glasses', 'eye exam', 'lens', 'spectacle', 'reading glasses', 'eye care', 'vision care', 'prescription medication'],
  'FMCG':             ['fmcg', 'consumer goods', 'fast moving consumer goods', 'household products', 'personal care products', 'packaged goods', 'consumer packaged goods', 'cpg', 'toiletries', 'household cleaning', 'daily use products', 'fmcg brand', 'consumer brand', 'household brand', 'mass market'],
  'Crypto & Web3':     ['cryptocurrency', 'blockchain', 'bitcoin', 'ethereum', 'defi', 'decentralized', 'web3', 'nft marketplace', 'crypto exchange', 'crypto wallet', 'smart contract', 'token', 'dao', 'staking', 'yield farming', 'dex'],
  'Cloud & DevTools':  ['cloud computing', 'cloud platform', 'infrastructure as a service', 'platform as a service', 'containerization', 'kubernetes', 'docker', 'ci cd', 'continuous integration', 'continuous deployment', 'serverless', 'microservices', 'api management', 'developer platform', 'code hosting', 'version control'],
  'Cybersecurity':     ['cybersecurity', 'information security', 'endpoint security', 'firewall', 'intrusion detection', 'penetration testing', 'vulnerability assessment', 'threat intelligence', 'siem', 'zero trust', 'data protection', 'encryption', 'identity management', 'malware protection', 'ransomware', 'ddos protection', 'security operations center', 'cyber threat', 'mobile security', 'mobile threat defense', 'cyber insurance', 'device security'],
  'Grocery & Supermarket': ['grocery store', 'supermarket', 'hypermarket', 'fresh produce', 'pantry', 'frozen food', 'dairy products', 'bakery items', 'meat and seafood', 'organic grocery', 'farm fresh', 'weekly basket', 'household essentials', 'bulk buying', 'grocery delivery', 'online grocery', 'instant delivery', 'grocery chain', 'kirana', 'kirana store', 'provision store', 'ration', 'sabzi', 'fruit shop', 'vegetable market', 'mandi', 'wholesale market', 'cash and carry', 'dark store', 'quick commerce', 'kiryana', 'general store', 'departmental store'],
  'Professional Services': ['consulting firm', 'consultancy', 'management consulting', 'strategy consulting', 'marketing agency', 'digital agency', 'creative agency', 'advertising agency', 'design agency', 'web agency', 'branding agency', 'pr agency', 'public relations', 'accounting firm', 'chartered accountant', 'tax consultant', 'audit firm', 'bookkeeping', 'cpa firm', 'architecture firm', 'architect', 'interior designer', 'engineering consultancy', 'it consulting', 'staffing agency', 'outsourcing', 'bpo', 'kpo', 'call center', 'translation service', 'interpreting', 'market research', 'virtual assistant'],
  'NGO & Non-Profit': ['ngo', 'non-profit', 'nonprofit', 'charity', 'donation', 'donate now', 'philanthropy', 'volunteer with us', 'volunteering opportunity', 'relief fund', 'charitable trust', 'charitable organization', 'fundraising campaign', 'crowdfunding for cause', 'underprivileged', 'marginalized community', 'humanitarian aid', 'humanitarian organization'],
  'Restaurant & Hospitality': ['restaurant', 'cafe', 'bistro', 'diner', 'eatery', 'food court', 'fine dining', 'casual dining', 'fast food', 'takeaway', 'takeout', 'dine-in', 'buffet', 'catering service', 'cloud kitchen', 'ghost kitchen', 'resort', 'boutique hotel', 'motel', 'hostel', 'bed and breakfast', 'lodge', 'guest house', 'hospitality', 'banquet hall', 'convention center', 'spa resort', 'beach resort', 'heritage hotel', 'homestay', 'serviced apartment'],
  'Fitness & Gym': ['gym', 'gymnasium', 'fitness center', 'fitness studio', 'yoga studio', 'pilates', 'crossfit', 'personal training', 'personal trainer', 'martial arts', 'boxing gym', 'swimming pool', 'fitness membership', 'workout studio', 'spin class', 'zumba', 'aerobics', 'strength training', 'bodybuilding', 'fitness club', 'health club', 'sports club', 'football academy', 'football training', 'cricket academy', 'cricket coaching', 'sports academy', 'sports coaching', 'tennis coaching', 'badminton coaching', 'basketball training', 'swimming coaching', 'athletics training', 'football fit', 'sports fit', 'boot camp', 'hiit', 'functional training'],
  'Banking & Financial Services': ['bank', 'banking', 'savings account', 'current account', 'fixed deposit', 'recurring deposit', 'net banking', 'internet banking', 'mobile banking', 'atm', 'locker', 'personal loan', 'car loan', 'education loan', 'debit card', 'nri banking', 'private banking', 'corporate banking', 'treasury', 'forex', 'letter of credit', 'bank account', 'ifsc', 'micr', 'swift code', 'passbook', 'cheque book', 'demand draft', 'rtgs', 'neft', 'imps'],
  'Government & Public Sector': ['government', 'govt', 'municipal', 'ministry', 'department of', 'public sector', 'psu', 'statutory body', 'directorate', 'secretariat', 'e-governance', 'citizen service', 'public service', 'tender', 'procurement', 'gazette', 'legislation', 'parliament', 'lok sabha', 'rajya sabha', 'state government', 'central government', 'district administration'],
  'Social Media & Platforms': ['social network', 'social media', 'connect with friends', 'followers', 'feed', 'timeline', 'stories', 'reels', 'short video', 'live stream', 'community platform', 'forum', 'discussion board', 'q&a platform', 'user generated content', 'content creator', 'influencer platform', 'creator economy', 'social sharing'],
  'Gaming & Esports': ['video game', 'game studio', 'game developer', 'game publisher', 'esports', 'esport', 'competitive gaming', 'tournament', 'multiplayer', 'battle royale', 'mmorpg', 'fps game', 'rpg game', 'indie game', 'steam', 'game download', 'play store game', 'console game', 'pc game', 'mobile game developer', 'game engine', 'unity game', 'unreal engine', 'playstation', 'xbox', 'nintendo', 'game pass', 'twitch', 'game streaming', 'speedrun', 'game mod', 'dlc', 'season pass', 'loot box', 'gacha', 'hyper casual game', 'idle game', 'strategy game', 'simulation game', 'racing game', 'fighting game', 'game tournament', 'lan party', 'game community', 'discord server', 'game clan', 'game guild'],
  'Betting & Fantasy Sports': ['fantasy sports', 'fantasy cricket', 'fantasy football', 'dream team', 'betting', 'odds', 'sportsbook', 'wagering', 'online casino', 'poker', 'rummy', 'real money gaming', 'skill gaming', 'daily fantasy', 'prediction', 'jackpot', 'slot machine', 'live casino', 'sports betting', 'horse racing', 'lottery'],
  'Dating & Matchmaking': ['dating', 'matchmaking', 'matrimony', 'matrimonial', 'life partner', 'soul mate', 'find your match', 'singles', 'compatibility', 'swipe', 'dating app', 'online dating', 'speed dating', 'shaadi', 'vivah', 'rishta', 'biodata', 'bride', 'groom', 'wedding match'],
  'Web Hosting & Domains': ['web hosting', 'domain registration', 'domain name', 'shared hosting', 'vps hosting', 'dedicated server', 'ssl certificate', 'website builder', 'cpanel', 'whm', 'dns', 'nameserver', 'domain transfer', 'domain renewal', 'reseller hosting', 'managed hosting', 'wordpress hosting', 'email hosting', 'cdn', 'content delivery network', 'uptime guarantee'],
  'Home Services': ['home services', 'home cleaning', 'deep cleaning', 'plumber', 'electrician', 'carpenter', 'painter', 'pest control', 'ac repair', 'ac service', 'appliance repair', 'handyman', 'home maintenance', 'water purifier service', 'chimney cleaning', 'bathroom cleaning', 'sofa cleaning', 'carpet cleaning', 'moving service', 'packers and movers', 'relocation', 'interior painting', 'waterproofing', 'home renovation', 'ro service', 'geyser repair', 'washing machine repair', 'fridge repair', 'microwave repair', 'inverter repair', 'solar installation', 'cctv installation', 'interior design', 'false ceiling', 'modular kitchen install', 'garden maintenance', 'lawn mowing', 'tree trimming', 'home sanitization'],
  'Security & Surveillance': ['cctv', 'security camera', 'surveillance', 'ip camera', 'nvr', 'dvr', 'biometric', 'face recognition', 'intrusion alarm', 'motion sensor', 'video door phone', 'intercom', 'security guard', 'guarding service', 'security system', 'home security', 'office security', 'fire alarm', 'smoke detector', 'burglar alarm', 'perimeter security', 'body camera'],
  'Construction & Building Materials': ['construction company', 'cement', 'concrete', 'steel bars', 'tmt bars', 'rebar', 'bricks', 'tiles', 'marble', 'granite', 'sand', 'aggregate', 'ready mix concrete', 'roofing sheet', 'structural steel', 'scaffolding', 'formwork', 'precast', 'waterproofing material', 'grout', 'putty', 'primer', 'construction chemical', 'building material', 'civil engineering', 'infrastructure', 'road construction', 'bridge construction'],
  'Alcohol & Tobacco': ['whisky', 'whiskey', 'vodka', 'rum', 'gin', 'tequila', 'brandy', 'wine', 'beer', 'craft beer', 'brewery', 'distillery', 'single malt', 'blended scotch', 'bourbon', 'champagne', 'prosecco', 'liquor', 'spirits', 'cocktail', 'bar', 'pub', 'lounge', 'tobacco', 'cigarette', 'cigar', 'hookah', 'vape', 'e-cigarette', 'nicotine', 'smoking', 'bottle shop', 'liquor store', 'wine store', 'wine cellar', 'cellar door', 'alcohol delivery', 'drink delivery', 'liquor delivery', 'beer store', 'off licence', 'bottle-o', 'dan murphy', 'bws', 'total wine', 'drizly', 'minibar', 'lcbo', 'abc store', 'package store', 'alcohol online', 'buy wine', 'buy beer', 'buy spirits', 'alcohol shop', 'liquor shop', 'saq', 'vintages', 'bottle king', 'bevmo', 'spec\'s'],
  'Religious & Spiritual': ['temple', 'church', 'mosque', 'gurudwara', 'monastery', 'ashram', 'spiritual', 'prayer', 'worship', 'devotion', 'pilgrimage', 'religious', 'scripture', 'holy', 'sacred', 'puja', 'pooja', 'havan', 'darshan', 'prasad', 'religious book', 'spiritual guru', 'yoga ashram', 'retreat center', 'dharma', 'karma', 'mantra', 'bhajan', 'kirtan'],
  'Astrology & Spiritual Services': ['astrology', 'astrologer', 'horoscope', 'kundli', 'kundali', 'janam kundli', 'birth chart', 'natal chart', 'jyotish', 'vedic astrology', 'zodiac', 'zodiac sign', 'rashi', 'rashifal', 'panchang', 'muhurat', 'shubh muhurat', 'numerology', 'numerologist', 'tarot', 'tarot reading', 'palmistry', 'palm reading', 'vastu', 'vastu shastra', 'feng shui', 'psychic', 'psychic reading', 'fortune teller', 'crystal healing', 'reiki', 'aura reading', 'compatibility', 'love horoscope', 'daily horoscope', 'weekly horoscope', 'moon sign', 'sun sign', 'planetary transit', 'dasha', 'gochar', 'manglik', 'nadi astrology', 'prashna kundli'],
  'Classifieds & Listings': ['classifieds', 'buy and sell', 'second hand', 'used items', 'pre-owned', 'local listing', 'post ad', 'free listing', 'sell online', 'nearby deals', 'local marketplace', 'garage sale', 'flea market', 'bidding', 'community marketplace', 'want ads', 'for sale by owner'],
  'Salon & Spa': ['salon', 'beauty salon', 'hair salon', 'barber', 'barbershop', 'spa', 'massage', 'facial treatment', 'manicure', 'pedicure', 'hair styling', 'hair coloring', 'keratin treatment', 'bridal makeup', 'makeup artist', 'nail art', 'nail salon', 'waxing', 'threading', 'laser hair removal', 'tattoo', 'piercing', 'medspa', 'aesthetic clinic', 'skin clinic', 'dermatologist', 'hair transplant'],
  'Schools & Universities': ['school admission', 'school education', 'primary school', 'secondary school', 'high school', 'international school', 'boarding school', 'day school', 'montessori', 'play school', 'preschool', 'university admission', 'college admission', 'undergraduate', 'postgraduate', 'phd program', 'campus', 'faculty', 'dean', 'vice chancellor', 'convocation', 'semester', 'accredited', 'naac', 'ugc approved', 'aicte approved', 'affiliated university', 'deemed university', 'iit', 'iim', 'nit', 'iisc'],
  'Coworking & Office Space': ['coworking', 'co-working', 'shared office', 'flexible workspace', 'hot desk', 'dedicated desk', 'private office', 'meeting room', 'conference room', 'virtual office', 'business center', 'startup space', 'incubator', 'accelerator', 'innovation hub', 'maker space', 'community workspace', 'day pass', 'monthly membership'],
  'Rental & Subscription Services': ['rent furniture', 'rental service', 'subscribe', 'subscription box', 'monthly subscription', 'rent electronics', 'rent appliance', 'car subscription', 'bike rental', 'equipment rental', 'costume rental', 'dress rental', 'fashion rental', 'toy rental', 'book rental', 'rent to own', 'pay per use', 'access over ownership', 'industrial equipment rental', 'tool rental', 'self storage', 'machinery rental', 'plant hire'],
  'Aerospace & Defense': ['aerospace', 'defense', 'defence', 'aircraft', 'missile', 'fighter jet', 'military', 'aviation mro', 'defense contractor', 'satellite launch', 'unmanned aerial', 'weapons system', 'radar', 'avionics', 'airframe', 'propulsion', 'defense technology', 'military equipment', 'armored vehicle', 'defense electronics', 'munitions', 'ballistic', 'stealth technology', 'military drone'],
  'AI & Data Science': ['artificial intelligence', 'machine learning', 'deep learning', 'data science', 'generative ai', 'computer vision', 'natural language processing', 'nlp', 'neural network', 'predictive analytics', 'data labeling', 'ai model', 'llm', 'large language model', 'chatbot', 'ai platform', 'ai assistant', 'ml pipeline', 'training data', 'ai inference', 'ai agent', 'model training', 'text generation', 'image recognition', 'ai startup'],
  'Airlines & Aviation': ['airline', 'aviation', 'airport', 'boarding pass', 'frequent flyer', 'low cost carrier', 'cargo airline', 'charter flight', 'private jet', 'ground handling', 'in-flight', 'aviation training', 'air traffic', 'flight booking', 'airline ticket', 'economy class', 'business class', 'first class', 'baggage allowance', 'flight status', 'airline loyalty'],
  'Aquaculture & Fisheries': ['aquaculture', 'fishery', 'fish farming', 'marine fisheries', 'freshwater fish', 'hatchery', 'fish feed', 'seaweed', 'algae', 'aquaponics', 'fish processing', 'prawn farming', 'fish pond', 'trawler', 'cage culture', 'recirculating aquaculture'],
  'Biotechnology': ['biotech', 'biotechnology', 'genomics', 'gene therapy', 'biopharmaceutical', 'molecular biology', 'clinical trial', 'bioinformatics', 'synthetic biology', 'stem cell', 'regenerative medicine', 'biomarker', 'crispr', 'dna sequencing', 'monoclonal antibody', 'biosimilar', 'gene editing', 'cell therapy', 'tissue engineering', 'bioprocessing'],
  'Cannabis & Hemp': ['cannabis', 'marijuana', 'hemp', 'cbd', 'thc', 'dispensary', 'medical cannabis', 'recreational cannabis', 'edibles', 'cannabis oil', 'hemp fiber', 'cannabis compliance', 'grow facility', 'cannabinoid', 'cbd oil', 'cbd gummy', 'weed dispensary', 'cannabis store', 'hemp extract', 'seed to sale'],
  'Chemicals & Petrochemicals': ['chemical manufacturer', 'petrochemical', 'specialty chemical', 'agrochemical', 'industrial gas', 'resin', 'solvent', 'catalyst', 'dye manufacturer', 'pigment', 'sealant', 'commodity chemical', 'chemical plant', 'paint manufacturer', 'caustic soda', 'sulfuric acid', 'ethylene', 'polypropylene', 'polyethylene', 'naphtha'],
  'Cleaning & Sanitation Services': ['commercial cleaning', 'janitorial', 'sanitation', 'disinfection', 'industrial cleaning', 'laundry service', 'dry cleaning', 'pressure washing', 'carpet cleaning service', 'window cleaning', 'dumpster service', 'waste bin cleaning', 'sanitization', 'office cleaning', 'floor cleaning', 'deep cleaning service', 'cleaning company', 'maid service', 'housekeeping service'],
  'Commodities & Trading': ['commodity trading', 'commodity exchange', 'futures trading', 'spot market', 'commodity broker', 'agricultural commodity', 'metal trading', 'energy trading', 'soft commodity', 'commodity market', 'commodity price', 'trading floor', 'derivatives', 'futures contract', 'options trading', 'commodity fund', 'clearing house', 'ncdex', 'mcx'],
  'Data Center & Infrastructure': ['data center', 'hyperscale', 'edge computing', 'server rack', 'data center cooling', 'ups system', 'network interconnection', 'data hall', 'tier 3 data center', 'tier 4 data center', 'power density', 'colo facility', 'rack space', 'cage space', 'liquid cooling', 'immersion cooling', 'cross connect', 'peering'],
  'Dental & Oral Care': ['dental', 'dentist', 'orthodontics', 'dental implant', 'oral care', 'dental clinic', 'teeth whitening', 'braces', 'dental lab', 'dental hygiene', 'periodontist', 'endodontist', 'tele-dentistry', 'dental insurance', 'root canal', 'dental crown', 'dental bridge', 'dental checkup', 'oral surgery', 'invisalign', 'clear aligner', 'tooth extraction', 'dental prosthetic', 'gum disease', 'cavity filling'],
  'Education Services (Non-Digital)': ['coaching center', 'tuition center', 'driving school', 'music school', 'art school', 'library', 'in-person tutoring', 'educational publishing', 'study center', 'learning center', 'training institute', 'coaching classes', 'private tutor', 'home tutor', 'dance school', 'vocational training', 'skill training center', 'language classes'],
  'Elderly Care & Senior Services': ['elderly care', 'senior care', 'assisted living', 'home care nursing', 'geriatric', 'senior living', 'retirement home', 'old age home', 'mobility aid', 'elder tech', 'senior day care', 'caregiver', 'aging in place', 'wheelchair', 'walker', 'stair lift', 'fall detection', 'medical alert system', 'dementia care', 'alzheimer care'],
  'Environmental & Waste Management': ['waste management', 'recycling', 'e-waste', 'hazardous waste', 'waste collection', 'waste disposal', 'upcycling', 'composting', 'environmental remediation', 'air quality monitoring', 'emission control', 'water treatment', 'waste to energy', 'landfill', 'material recovery', 'sewage treatment', 'effluent treatment', 'pollution control', 'environmental consulting'],
  'Forestry & Timber': ['forestry', 'sawmill', 'wood processing', 'paper pulp', 'plywood', 'engineered wood', 'sustainable forestry', 'agroforestry', 'lumber mill', 'timber harvesting', 'reforestation', 'tree planting', 'fsc certified', 'mdf board', 'particle board', 'paper mill', 'logging', 'wood cutting'],
  'Funeral & Memorial Services': ['funeral', 'cremation', 'cemetery', 'casket', 'urn', 'grief counseling', 'funeral home', 'burial', 'obituary', 'mortuary', 'memorial park', 'bereavement', 'last rites', 'funeral director', 'crematorium', 'mausoleum', 'funeral service', 'memorial service'],
  'Healthcare & Hospitals': ['hospital', 'multi-specialty hospital', 'polyclinic', 'diagnostic lab', 'radiology', 'pathology', 'ambulance', 'emergency room', 'blood bank', 'home healthcare', 'rehabilitation', 'fertility clinic', 'ivf', 'icu', 'nicu', 'surgery center', 'ct scan', 'mri scan', 'ultrasound', 'outpatient', 'inpatient'],
  'Import/Export & Trade': ['import export', 'trade compliance', 'customs clearance', 'free trade zone', 'sez', 'cross-border trade', 'import broker', 'export management', 'bill of lading', 'freight forwarder', 'trade license', 'export documentation', 'import duty', 'customs duty', 'foreign trade', 'export house', 'import agent'],
  'IoT & Connected Devices': ['iot', 'internet of things', 'connected device', 'smart sensor', 'industrial iot', 'iiot', 'asset tracking', 'iot platform', 'mqtt', 'edge device', 'smart meter', 'connected car', 'wearable iot', 'iot gateway', 'home automation', 'smart thermostat', 'smart plug', 'device management', 'rfid', 'ble beacon'],
  'Luxury & Premium Goods': ['luxury brand', 'designer brand', 'haute couture', 'luxury watch', 'luxury automobile', 'luxury real estate', 'concierge service', 'bespoke', 'handcrafted luxury', 'high-end fashion', 'fine craftsmanship', 'limited edition luxury', 'luxury lifestyle', 'luxury accessories', 'swiss watch', 'designer handbag', 'luxury retail'],
  'Marine & Shipping': ['shipping line', 'container shipping', 'bulk carrier', 'tanker', 'port', 'terminal operations', 'shipbuilding', 'cruise line', 'marine equipment', 'offshore', 'subsea', 'maritime', 'vessel', 'merchant navy', 'dry dock', 'cargo ship', 'shipping container', 'port authority'],
  'Mining & Quarrying': ['mining', 'quarry', 'coal mining', 'gold mining', 'iron ore', 'copper mine', 'mine safety', 'mining equipment', 'mineral exploration', 'ore processing', 'excavation', 'mine site', 'open pit', 'underground mine', 'mining truck', 'drill rig', 'crusher', 'mineral extraction'],
  'Music & Audio': ['music production', 'music distribution', 'record label', 'music instrument', 'audio engineering', 'recording studio', 'music education', 'music rights', 'music licensing', 'sound design', 'mixing', 'mastering', 'vinyl', 'guitar', 'piano', 'keyboard', 'drum kit', 'amplifier', 'daw'],
  'Nuclear & Atomic Energy': ['nuclear energy', 'nuclear power', 'nuclear reactor', 'atomic energy', 'nuclear fuel', 'uranium', 'nuclear waste', 'radiation', 'nuclear plant', 'fission', 'fusion', 'nuclear safety', 'nuclear decommissioning', 'nuclear enrichment', 'nuclear containment', 'isotope'],
  'Outdoor Advertising & Signage': ['billboard', 'outdoor advertising', 'ooh advertising', 'digital signage', 'transit advertising', 'led sign', 'neon sign', 'vehicle wrap', 'fleet graphics', 'mall signage', 'hoarding', 'unipole', 'signboard', 'bus shelter advertising', 'street furniture advertising', 'airport advertising'],
  'Pharmaceuticals': ['pharmaceutical', 'pharma company', 'generic drug', 'branded drug', 'vaccine', 'active pharmaceutical ingredient', 'api manufacturing', 'clinical research', 'drug discovery', 'cro', 'cdmo', 'drug manufacturing', 'pharmacovigilance', 'drug formulation', 'fda approved', 'pharma manufacturing', 'tablet manufacturing', 'capsule', 'drug regulatory'],
  'Photography & Videography': ['photography', 'photographer', 'videography', 'videographer', 'portrait photography', 'commercial photography', 'event photography', 'drone photography', 'photo editing', 'retouching', 'stock photography', 'photo studio', 'headshot', 'wedding photography', 'product photography', 'fashion photography', 'photo shoot'],
  'Private Equity & Venture Capital': ['private equity', 'venture capital', 'growth equity', 'buyout', 'angel investor', 'syndicate', 'fund of funds', 'impact investing', 'portfolio company', 'limited partner', 'general partner', 'carried interest', 'term sheet', 'due diligence', 'series a', 'series b', 'startup funding', 'seed round'],
  'Publishing & Books': ['book publisher', 'self-publishing', 'academic publishing', 'digital publishing', 'comic book publisher', 'graphic novel publisher', 'isbn', 'manuscript submission', 'literary agent', 'printing press', 'book store', 'bookshop', 'e-book publishing', 'book launch event', 'publishing house', 'periodical publisher', 'book author', 'published author', 'bookstore', 'book catalog', 'book review', 'literary magazine'],
  'Railways & Metro': ['railway', 'railroad', 'metro', 'subway', 'passenger rail', 'freight rail', 'high-speed rail', 'rolling stock', 'locomotive', 'rail infrastructure', 'signaling', 'rail track', 'railway station', 'metro station', 'rail network', 'train ticket', 'rail coach'],
  'Robotics & Automation': ['robotics', 'robot', 'industrial robot', 'cobot', 'collaborative robot', 'rpa', 'robotic process automation', 'service robot', 'surgical robot', 'warehouse automation', 'pick and place', 'autonomous mobile robot', 'robot arm', 'automation system', 'robotic surgery', 'robot programming'],
  'Rubber, Plastics & Composites': ['rubber', 'plastic', 'tire manufacturing', 'plastic packaging', 'pvc', 'composite', 'extrusion', 'biodegradable plastic', 'rubber product', 'elastomer', 'thermoset', 'thermoplastic', 'blow molding', 'rotational molding', 'plastic bottle', 'rubber sheet'],
  'Semiconductor & Chips': ['semiconductor', 'chip', 'wafer', 'fabless', 'foundry', 'memory chip', 'analog chip', 'semiconductor equipment', 'osat', 'eda', 'integrated circuit', 'microprocessor', 'asic', 'fpga', 'chip design', 'chip fabrication', 'silicon wafer', 'semiconductor manufacturing'],
  'Space & Satellite': ['space technology', 'satellite', 'launch vehicle', 'rocket', 'earth observation', 'remote sensing', 'space tourism', 'satellite internet', 'leo satellite', 'space debris', 'orbit', 'spacecraft', 'payload', 'ground station', 'space launch', 'satellite communication', 'space exploration'],
  'Staffing & Workforce Solutions': ['staffing agency', 'temporary staffing', 'permanent placement', 'executive search', 'rpo', 'recruitment process outsourcing', 'blue collar staffing', 'gig economy', 'employer of record', 'eor', 'workforce solutions', 'contract staffing', 'manpower supply', 'staffing company', 'temp agency', 'talent sourcing'],
  'Sustainability & ESG': ['sustainability', 'esg', 'carbon accounting', 'carbon footprint', 'circular economy', 'sustainable supply chain', 'green building', 'climate tech', 'biodiversity', 'net zero', 'esg reporting', 'sdg', 'sustainability report', 'environmental social governance', 'sustainable business', 'carbon neutral certification'],
  'Textiles & Fabrics': ['textile', 'fabric', 'cotton', 'synthetic fiber', 'technical textile', 'dyeing', 'finishing', 'knitting', 'weaving', 'home textile', 'nonwoven', 'yarn', 'spinning', 'garment factory', 'fabric mill', 'silk fabric', 'linen', 'polyester fabric'],
  'Tourism & Destination Management': ['tour operator', 'destination management', 'inbound tourism', 'outbound tourism', 'adventure tourism', 'medical tourism', 'eco-tourism', 'heritage tourism', 'pilgrimage tourism', 'cultural tourism', 'tourism board', 'travel guide', 'tourist attraction', 'sightseeing', 'holiday destination', 'tourist visa'],
  'Veterinary & Animal Health': ['veterinarian', 'vet clinic', 'animal hospital', 'veterinary diagnostics', 'animal feed', 'livestock health', 'equine veterinary', 'veterinary pharma', 'animal nutrition', 'vet practice', 'animal welfare', 'pet vaccination', 'animal care', 'spay neuter', 'pet clinic', 'animal surgery', 'veterinary medicine', 'animal checkup', 'pet health', 'veterinary hospital'],
  'Video & Film Production': ['film production', 'video production', 'feature film', 'tv production', 'documentary', 'post-production', 'vfx', 'visual effects', 'dubbing', 'film distribution', 'corporate video', 'brand film', 'animation studio', 'motion picture', 'film editing', 'cinematography', 'film director', 'production house'],
  'Water & Sanitation': ['water supply', 'water purification', 'water filtration', 'desalination', 'wastewater treatment', 'water infrastructure', 'bottled water', 'packaged water', 'smart water meter', 'water conservation', 'sewage treatment', 'water utility', 'reverse osmosis', 'water testing', 'water quality', 'water pump', 'borewell'],
  'Wealth & Asset Management': ['wealth management firm', 'asset management company', 'etf', 'hedge fund', 'family office', 'pension fund', 'retirement fund', 'portfolio management', 'alternative investment', 'fund manager', 'aum', 'assets under management', 'fiduciary', 'financial advisor', 'investment portfolio', 'wealth advisor'],
  'Wellness Tourism & Retreats': ['wellness retreat', 'yoga retreat', 'meditation retreat', 'detox program', 'hot springs', 'thermal spa', 'ayurveda retreat', 'wellness resort', 'weight management camp', 'digital detox', 'silent retreat', 'wellness vacation', 'holistic retreat', 'health retreat', 'spa retreat', 'wellness getaway'],
  'Wire, Cable & Electrical': ['wire manufacturer', 'cable manufacturer', 'power cable', 'communication cable', 'switchgear', 'transformer', 'electrical connector', 'wire harness', 'electrical panel', 'circuit breaker', 'busbar', 'cable tray', 'conduit', 'high voltage cable', 'low voltage cable', 'cable insulation'],
  'AR / VR & Metaverse': ['augmented reality', 'virtual reality', 'mixed reality', 'metaverse', 'spatial computing', 'vr headset', 'ar glasses', 'immersive experience', 'virtual world', 'xr', 'extended reality', 'haptic', '3d simulation', 'hologram', 'vr game', 'ar app', 'vr training'],
  'Quantum Computing': ['quantum computing', 'quantum computer', 'qubit', 'quantum algorithm', 'quantum cryptography', 'quantum networking', 'quantum sensing', 'quantum hardware', 'quantum software', 'quantum as a service', 'quantum supremacy', 'quantum entanglement', 'quantum processor', 'quantum gate', 'quantum error correction'],
  'Creator Economy & Influencer': ['creator economy', 'influencer marketing', 'content creator', 'creator monetization', 'fan engagement', 'patreon', 'ugc platform', 'talent management', 'creator analytics', 'livestream commerce', 'brand ambassador', 'sponsored content', 'influencer platform', 'creator fund', 'content monetization', 'youtube creator'],
  'Halal Economy & Islamic Services': ['halal', 'islamic finance', 'takaful', 'halal certification', 'halal food', 'halal cosmetics', 'modest fashion', 'islamic edtech', 'digital quran', 'zakat', 'waqf', 'sharia compliant', 'halal tourism', 'islamic banking', 'halal restaurant', 'halal meat'],
  'Handicrafts & Artisanal Goods': ['handicraft', 'artisanal', 'handmade', 'handloom', 'pottery', 'ceramics', 'woodwork', 'carving', 'metalwork', 'basket weaving', 'fair trade', 'ethical craft', 'traditional craft', 'artisan', 'cottage industry', 'handwoven', 'block print', 'tribal art'],
  'Amusement & Entertainment Venues': ['theme park', 'amusement park', 'water park', 'arcade', 'gaming center', 'bowling alley', 'escape room', 'cinema', 'movie theater', 'live performance', 'comedy club', 'entertainment venue', 'funfair', 'roller coaster', 'go kart', 'trampoline park', 'laser tag'],
  'Museums, Heritage & Culture': ['museum', 'heritage', 'cultural center', 'science museum', 'history museum', 'planetarium', 'observatory', 'virtual museum', 'heritage conservation', 'cultural institute', 'exhibition hall', 'artifact', 'curator', 'art exhibition', 'gallery exhibition', 'museum collection'],
  'Debt, Credit & Collections': ['credit bureau', 'credit score', 'debt collection', 'debt consolidation', 'credit repair', 'credit counseling', 'factoring', 'invoice financing', 'asset recovery', 'collections agency', 'credit report', 'debt recovery', 'receivables', 'debt management', 'credit monitoring service', 'debt relief'],
  'Personal & Domestic Services': ['tailoring', 'alterations', 'cobbler', 'locksmith', 'personal concierge', 'housekeeping', 'domestic help', 'errand service', 'personal styling', 'image consulting', 'task service', 'valet', 'personal assistant', 'laundry pickup', 'ironing service', 'home maid'],
  'Cooperatives & Community Commerce': ['cooperative', 'co-op', 'credit union', 'agricultural cooperative', 'consumer cooperative', 'housing cooperative', 'worker cooperative', 'energy cooperative', 'cooperative society', 'community commerce', 'mutual aid', 'collective', 'cooperative bank', 'member-owned', 'profit sharing cooperative'],
  'Sharing & Peer-to-Peer Economy': ['sharing economy', 'peer-to-peer', 'p2p rental', 'home sharing', 'car sharing', 'skill sharing', 'co-ownership', 'peer lending', 'tool sharing', 'equipment sharing', 'airbnb', 'collaborative consumption', 'access economy', 'ride pooling', 'shared workspace'],
  'International & Diplomatic Organizations': ['embassy', 'consulate', 'united nations', 'multilateral', 'development bank', 'international trade', 'wto', 'wipo', 'international ngo', 'intergovernmental', 'diplomatic', 'foreign affairs', 'treaty', 'international cooperation', 'diplomatic mission', 'world bank'],
  'Sports Leagues & Professional Sports': ['sports league', 'professional sports', 'football club', 'soccer club', 'basketball league', 'cricket league', 'ipl', 'nba', 'nfl', 'fifa', 'motorsport', 'racing', 'olympic', 'sports sponsorship', 'sports merchandising', 'premier league', 'champions league'],
  'Mobile Money & Agent Banking': ['mobile money', 'm-pesa', 'gcash', 'agent banking', 'ussd banking', 'airtime top-up', 'unbanked', 'mobile savings', 'micro-insurance', 'rural banking', 'financial inclusion', 'mobile financial services', 'mobile payment', 'digital money', 'agent network'],
  'Precious Metals, Gems & Bullion': ['precious metal', 'gold trading', 'gold refining', 'diamond cutting', 'platinum', 'palladium', 'bullion', 'gold bar', 'gemstone grading', 'precious metal etf', 'gold vault', 'bullion dealer', 'gold exchange', 'assaying', 'gold coin', 'silver bullion', 'gold investment'],
  'Postal & Mail Services': ['postal service', 'mail service', 'parcel post', 'po box', 'mailbox service', 'direct mail', 'bulk mailing', 'postal automation', 'hybrid mail', 'international mail', 'postage', 'stamp', 'mail delivery', 'postal code', 'registered post', 'speed post'],
  'Leather & Hide Products': ['leather goods', 'tanning', 'leather footwear', 'leather bag', 'leather garment', 'leather jacket', 'saddlery', 'harness', 'vegan leather', 'synthetic leather', 'hide processing', 'suede', 'nubuck', 'leather wallet', 'leather belt', 'leather craft', 'tannery'],
  'Glass, Ceramics & Nonmetallic Minerals': ['glass manufacturer', 'ceramic', 'flat glass', 'safety glass', 'glass container', 'ceramic tile', 'sanitaryware', 'porcelain', 'tableware', 'industrial ceramic', 'refractory', 'stone processing', 'insulation material', 'tempered glass', 'laminated glass'],
  'Wholesale & Distribution': ['wholesale', 'distribution', 'distributor', 'general merchandise', 'industrial distribution', 'electrical distribution', 'food wholesale', 'pharmaceutical distribution', 'building material distribution', 'chemical distribution', 'wholesale market', 'wholesale supplier', 'bulk order', 'trade wholesale', 'distribution network'],
  'Conglomerates & Holding Companies': ['conglomerate', 'holding company', 'diversified', 'business group', 'chaebol', 'keiretsu', 'business house', 'state-owned enterprise', 'investment holding', 'parent company', 'subsidiary', 'group of companies', 'multi-industry', 'corporate group', 'business conglomerate'],
  'Professional & Trade Associations': ['trade association', 'professional body', 'chamber of commerce', 'trade union', 'labor organization', 'business networking', 'standards body', 'certification body', 'industry association', 'professional licensing', 'bar association', 'medical council', 'professional membership', 'industry lobby', 'trade group'],
  'Social Services & Welfare': ['social service', 'child welfare', 'foster care', 'disability service', 'vocational rehabilitation', 'food bank', 'homeless shelter', 'housing assistance', 'refugee service', 'youth development', 'social work', 'community development', 'government welfare', 'public assistance', 'social safety net'],
  'Plantation & Cash Crops': ['plantation', 'cash crop', 'palm oil', 'rubber plantation', 'tea estate', 'coffee estate', 'sugarcane', 'sugar mill', 'cocoa plantation', 'spice plantation', 'cotton farming', 'tobacco farming', 'estate management', 'tea garden', 'coffee plantation', 'jute farming'],
};

const SUB_INDUSTRY_KEYWORDS = {
  'Fashion & Apparel': {
    'Shoes & Sneakers':   ['sneaker', 'sneakers', 'running shoe', 'athletic shoe', 'basketball shoe', 'trainer', 'trainers', 'just do it', 'air max', 'air jordan', 'ultraboost', 'shoe', 'shoes', 'footwear'],
    'Sportswear':         ['sportswear', 'sports wear', 'activewear', 'athleisure', 'gym wear', 'workout clothes', 'yoga pants', 'sports bra', 'athletic', 'performance wear', 'training gear', 'running gear'],
    'Fast Fashion':       ['fast fashion', 'new arrivals weekly', 'trend', 'latest fashion', 'new collection every week', 'affordable fashion'],
    'Luxury Fashion':     ['luxury', 'haute couture', 'designer', 'maison', 'atelier', 'couture', 'premium collection', 'handcrafted leather', 'made in italy', 'made in france'],
    'Premium Fashion':    ['premium fashion', 'contemporary fashion', 'modern classic', 'elevated basics', 'refined style'],
    'Casual Wear':        ['casual wear', 'everyday wear', 'basic', 'essential', 'daily wear', 'relaxed fit'],
    'Denim & Jeans':      ['denim', 'jeans', 'jean', '501', 'selvedge', 'raw denim', 'indigo'],
    'Ethnic Wear':        ['ethnic wear', 'ethnic fashion', 'kurta', 'kurti', 'saree', 'sarees', 'sari', 'lehenga', 'salwar', 'traditional wear', 'traditional clothing', 'sherwani', 'anarkali', 'dupatta', 'churidar', 'indian wear', 'designer saree', 'silk saree', 'georgette', 'chiffon', 'bandhani', 'patola', 'palazzo', 'dhoti', 'bridal lehenga'],
    'Formal Wear':        ['formal wear', 'formal shirt', 'suit', 'blazer', 'business wear', 'office wear', 'workwear', 'trouser', 'corporate'],
    'Men\'s Fashion':     ['men\'s fashion', 'menswear', 'men\'s clothing', 'men\'s wear', 'for men', 'male fashion'],
    'Women\'s Wear':      ['women\'s wear', 'womenswear', 'women\'s clothing', 'women\'s fashion', 'for women', 'ladies wear'],
    'Streetwear':         ['streetwear', 'street style', 'urban', 'pop culture', 'merchandise', 'merch', 'fandom', 'graphic tee', 'oversized', 'drop', 'limited edition', 'anime merch', 'anime merchandise', 'anime store', 'anime tee', 'anime hoodie', 'manga merch', 'fan merchandise', 'fandom merch', 'pop culture merch', 'geek merch', 'nerd fashion', 'comic merch'],
    'Lingerie & Innerwear': ['lingerie', 'sports bra', 'bralette', 'push-up bra', 'underwear', 'shapewear', 'intimates', 'innerwear', 'panties', 'briefs', 'boxers'],
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
    'Bags & Luggage':     ['backpack', 'handbag', 'tote', 'crossbody', 'clutch', 'duffel bag', 'luggage', 'suitcase', 'travel bag', 'trolley', 'trolleys', 'trolley bag', 'cabin bag', 'carry-on', 'check-in bag', 'travel accessories', 'laptop trolley', 'strolley'],
    'Watches':            ['watch', 'watches', 'smartwatch', 'analog watch', 'digital watch', 'luxury watch', 'fashion watch', 'sport watch', 'wristwatch', 'chronograph', 'timepiece', 'automatic watch', 'mechanical watch', 'quartz watch', 'dive watch', 'dress watch', 'field watch', 'pilot watch', 'swiss watch', 'watch brand', 'watch collection', 'watch store', 'buy watches', 'men watch', 'women watch', 'couple watch', 'watch strap', 'watch band', 'watch dial'],
    'Eyewear':            ['prescription glasses', 'sunglasses', 'blue light glasses', 'reading glasses', 'safety eyewear', 'eyeglasses', 'spectacles', 'optical'],
    'Wallets & Accessories':['wallet', 'cardholder', 'card holder', 'money clip', 'belt', 'suspender', 'scarf', 'hat', 'cap'],
    'Modest Fashion':     ['modest fashion', 'hijab', 'abaya', 'modest wear', 'islamic clothing', 'modest dress', 'covered fashion', 'long sleeve dress', 'modest swimwear', 'burkini'],
    'Plus-Size Fashion':  ['plus size', 'plus-size', 'curvy fashion', 'extended size', 'big and tall', 'full figure', 'inclusive sizing', 'size inclusive', 'xl', 'xxl', 'xxxl'],
    'Maternity & Nursing Wear': ['maternity wear', 'maternity dress', 'nursing wear', 'pregnancy clothing', 'maternity jeans', 'bump friendly', 'nursing top', 'maternity legging'],
    'Adaptive Clothing':  ['adaptive clothing', 'adaptive fashion', 'wheelchair friendly', 'seated wear', 'magnetic closure', 'easy dress', 'disability clothing', 'sensory friendly'],
    'Sustainable Fashion': ['sustainable fashion', 'eco fashion', 'organic cotton', 'recycled fabric', 'upcycled fashion', 'slow fashion', 'ethical fashion', 'fair trade fashion', 'conscious fashion', 'bamboo fabric'],
    'Handloom & Artisan Wear': ['handloom', 'handwoven', 'artisan wear', 'chikankari', 'phulkari', 'zardozi', 'kalamkari', 'block print', 'ajrakh', 'ikat', 'shibori', 'batik', 'dabu print'],
    'Regional Indian Wear': ['banarasi', 'kanjivaram', 'chanderi', 'maheshwari', 'pochampally', 'tant', 'jamdani', 'tussar', 'muga silk', 'pashmina', 'kashmiri shawl', 'kantha', 'khadi', 'lucknowi'],
    'Uniforms & Workwear': ['uniform', 'workwear', 'industrial uniform', 'school uniform', 'hospital uniform', 'chef coat', 'safety vest', 'hi-vis', 'corporate uniform'],
    'Costume & Cosplay':  ['costume', 'cosplay', 'halloween costume', 'fancy dress', 'themed costume', 'anime costume', 'character outfit'],
    'Swimwear & Beachwear': ['swimwear', 'bikini', 'one piece swimsuit', 'swim trunks', 'beach wear', 'beach cover up', 'rash guard', 'surf wear', 'board shorts'],
    'Winter Wear':        ['winter wear', 'puffer jacket', 'down jacket', 'thermal wear', 'fleece', 'wool coat', 'winter boots', 'snow gear', 'insulated jacket', 'windbreaker'],
  },
  'Jewelry': {
    'Fine Jewelry':       ['diamond', 'gold jewel', 'platinum', 'solitaire', 'certified diamond', 'hallmark', 'karat', '22k', '18k', '24k', '14k', '10k', 'sterling silver', '.925'],
    'Fashion Jewelry':    ['fashion jewel', 'imitation', 'artificial jewel', 'costume jewel', 'oxidised', 'beaded', 'handmade jewel', 'trendy jewel'],
    'Bridal Jewelry':     ['bridal jewel', 'bridal set', 'wedding jewel', 'mangalsutra', 'bridal collection', 'engagement ring', 'wedding band'],
    'Silver Jewelry':     ['silver jewel', 'sterling silver', '925 silver', 'silver ring', 'silver necklace'],
    'Custom Jewelry':     ['custom jewel', 'personalized jewel', 'engraving', 'custom design', 'monogram'],
    'Temple Jewelry':     ['temple jewellery', 'temple jewelry', 'traditional south indian', 'kemp jewelry', 'antique finish', 'matte gold', 'nagas jewelry'],
    'Gemstone Jewelry':   ['gemstone', 'ruby', 'emerald', 'sapphire', 'topaz', 'amethyst', 'opal', 'turquoise', 'birthstone jewel', 'semi-precious stone', 'precious stone'],
    'Lab-Grown Diamonds': ['lab-grown diamond', 'lab diamond', 'synthetic diamond', 'cultured diamond', 'man-made diamond', 'created diamond'],
    'Men\'s Jewelry':     ['men\'s jewelry', 'men\'s ring', 'men\'s bracelet', 'men\'s chain', 'cufflinks', 'tie pin', 'men\'s pendant'],
    'Pearl Jewelry':      ['pearl', 'pearl necklace', 'pearl earring', 'freshwater pearl', 'south sea pearl', 'cultured pearl', 'pearl strand'],
    'Kundan & Polki':     ['kundan', 'polki', 'meenakari', 'jadau', 'thewa', 'rajasthani jewelry', 'mughal jewelry'],
    'Body Jewelry':       ['nose ring', 'nose pin', 'belly ring', 'toe ring', 'anklet', 'payal', 'body piercing', 'septum ring'],
  },
  'Beauty & Personal Care': {
    'Skincare':           ['skincare', 'skin care', 'cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'face mask', 'exfoliant', 'face wash', 'face cream', 'face serum', 'hyaluronic acid', 'retinol', 'vitamin c serum', 'niacinamide', 'skin barrier'],
    'Makeup':             ['makeup', 'lipstick', 'mascara', 'eyeliner', 'foundation makeup', 'concealer', 'blush', 'eyeshadow', 'bronzer', 'makeup brush', 'makeup palette', 'primer makeup', 'setting spray'],
    'Hair Care':          ['hair care', 'shampoo', 'conditioner', 'hair oil', 'hair serum', 'hair mask', 'hair treatment', 'styling product', 'hair growth', 'anti-dandruff', 'hair fall control'],
    'Hair Extensions & Wigs': ['hair extensions', 'clip-in extensions', 'tape-in extensions', 'wig', 'wigs', 'lace wig', 'human hair wig', 'hair topper', 'hair piece', 'hair system'],
    'Fragrance':          ['fragrance', 'perfume', 'cologne', 'body spray', 'scented oil', 'eau de toilette', 'eau de parfum'],
    'Men\'s Grooming':    ['beard oil', 'shaving cream', 'aftershave', 'men\'s skincare', 'men\'s grooming', 'grooming kit', 'beard trimmer', 'men\'s face wash'],
    'Bath & Body':        ['body wash', 'soap', 'bath bomb', 'deodorant', 'body lotion', 'body butter', 'shower gel', 'body scrub'],
    'Nail Care':          ['nail polish', 'nail treatment', 'manicure kit', 'nail art', 'gel nails', 'nail extension'],
    'Clean & Vegan Beauty': ['clean beauty', 'vegan beauty', 'cruelty-free', 'organic skincare', 'natural cosmetics', 'toxin-free beauty'],
    'K-Beauty & J-Beauty': ['k-beauty', 'korean beauty', 'korean skincare', 'sheet mask', 'snail mucin', 'rice water', 'j-beauty', 'japanese beauty', 'double cleanse', 'essence', 'ampoule', 'glass skin', '10 step routine'],
    'Ayurvedic & Herbal Beauty': ['ayurvedic beauty', 'herbal cosmetics', 'ubtan', 'kumkumadi', 'multani mitti', 'chandan', 'neem face wash', 'tulsi skincare', 'haldi face pack', 'rose water skincare', 'amla oil'],
    'Dermaceuticals & Clinical': ['dermaceutical', 'cosmeceutical', 'clinical skincare', 'prescription skincare', 'dermatologist recommended', 'medical grade', 'active ingredients', 'peptide', 'aha', 'bha', 'glycolic acid', 'salicylic acid', 'azelaic acid'],
    'Oral Care & Dental':  ['toothpaste', 'toothbrush', 'electric toothbrush', 'mouthwash', 'teeth whitening', 'dental floss', 'oral care', 'tongue cleaner', 'water flosser'],
    'Sun Care':           ['sunscreen', 'spf', 'sun protection', 'sun cream', 'sun block', 'after sun', 'tanning lotion', 'uv protection', 'mineral sunscreen'],
    'Traditional Indian Beauty': ['kajal', 'kohl', 'sindoor', 'alta', 'mehndi', 'mehendi', 'henna art', 'bridal mehndi', 'bindi'],
    'Beauty Tools & Devices': ['beauty device', 'face roller', 'gua sha', 'derma roller', 'led face mask', 'microcurrent device', 'facial steamer', 'hair dryer', 'flat iron', 'curling iron', 'epilator'],
    'Inclusive & Diverse Beauty': ['inclusive beauty', 'shade range', 'all skin tones', 'melanin', 'dark skin beauty', 'diverse beauty'],
  },
  'Food & Beverage': {
    'Snacks':             ['chips', 'crackers', 'nuts', 'trail mix', 'protein bar', 'jerky', 'candy', 'cookies', 'snack'],
    'Meal Kits':          ['meal kit', 'prepared meal', 'ready-to-eat', 'subscription meal'],
    'Coffee & Tea':       ['coffee beans', 'ground coffee', 'coffee pod', 'tea bag', 'loose leaf tea', 'matcha', 'espresso', 'green tea', 'black tea', 'herbal tea', 'oolong tea', 'white tea', 'chai tea', 'tea leaves', 'tea estate', 'tea garden', 'premium tea', 'organic tea', 'darjeeling tea', 'assam tea', 'tea collection', 'brew tea', 'tea blend', 'tea infusion', 'tisane', 'latte', 'cold brew coffee', 'pour over', 'french press', 'arabica', 'robusta', 'single origin coffee'],
    'Alcohol':            ['wine shop', 'winery', 'vineyard', 'craft beer', 'brewery', 'distillery', 'spirits brand', 'cocktail kit', 'mixer', 'whiskey', 'vodka', 'rum', 'tequila', 'gin', 'bourbon'],
    'Supplements':        ['vitamin', 'protein powder', 'collagen', 'probiotic', 'omega-3', 'supplement', 'supplements', 'whey', 'whey protein', 'sports supplement', 'sports supplements', 'protein bar', 'protein bars', 'energy bar', 'peanut butter', 'bcaa', 'creatine', 'pre-workout', 'post-workout', 'mass gainer', 'protein shake', 'isolate protein', 'casein', 'glutamine', 'multivitamin'],
    'Specialty Foods':    ['organic', 'vegan', 'keto', 'gluten-free', 'paleo', 'non-gmo', 'specialty food'],
    'Beverages':          ['sparkling water', 'kombucha', 'juice', 'energy drink', 'cold brew'],
    'Dairy & Alternatives': ['dairy', 'milk', 'cheese', 'yogurt', 'oat milk', 'almond milk', 'plant-based milk'],
    'Frozen Foods': ['frozen food', 'frozen meal', 'ice cream', 'frozen snack', 'frozen vegetable'],
    'Condiments & Sauces': ['condiment', 'sauce', 'ketchup', 'mustard', 'dressing', 'hot sauce', 'spice blend'],
    'Plant-Based & Vegan': ['plant-based', 'vegan food', 'meat alternative', 'plant protein', 'impossible', 'beyond meat'],
    'Baby Food': ['baby food', 'infant formula', 'baby cereal', 'toddler snack', 'baby puree'],
    'Confectionery & Chocolate': ['chocolate', 'candy', 'confectionery', 'truffle', 'praline', 'sweet'],
    'Bakery & Baked Goods': ['bakery', 'baking', 'bake', 'bakes', 'fresh bakes', 'baking studio', 'baking class', 'bread', 'pastry', 'patisserie', 'cake', 'cakes', 'cupcake', 'muffin', 'brownie', 'cookies', 'baked goods', 'artisan bread', 'fondant', 'frosting', 'icing', 'macaron', 'croissant', 'doughnut', 'donut', 'scone', 'biscotti', 'pie', 'tart', 'danish', 'sourdough', 'custom cake', 'birthday cake', 'wedding cake', 'eggless cake', 'designer cake'],
    'Organic & Health Foods': ['organic food', 'health food', 'superfood', 'whole food', 'natural food'],
    'Indian Sweets & Snacks': ['mithai', 'ladoo', 'barfi', 'halwa', 'peda', 'rasgulla', 'gulab jamun', 'jalebi', 'soan papdi', 'kaju katli', 'namkeen', 'bhujia', 'sev', 'farsan', 'mixture', 'chivda', 'mukhwas', 'paan'],
    'Millet & Ancient Grains': ['millet', 'ragi', 'bajra', 'jowar', 'foxtail millet', 'little millet', 'barnyard millet', 'quinoa', 'amaranth', 'buckwheat', 'ancient grain'],
    'Functional & Adaptogenic Foods': ['functional food', 'adaptogen', 'nootropic food', 'ashwagandha latte', 'turmeric latte', 'golden milk', 'mushroom coffee', 'collagen bar', 'gut health food', 'prebiotic food'],
    'Spices & Masala':    ['spice', 'masala', 'turmeric', 'cumin', 'coriander', 'chili powder', 'garam masala', 'biryani masala', 'curry powder', 'whole spices', 'spice blend', 'hand ground spice'],
    'Cooking Oils & Ghee': ['cooking oil', 'olive oil', 'coconut oil', 'mustard oil', 'sesame oil', 'ghee', 'a2 ghee', 'cold pressed oil', 'wood pressed oil', 'extra virgin'],
    'Pickles & Preserves': ['pickle', 'achaar', 'jam', 'preserve', 'marmalade', 'chutney', 'relish', 'fermented', 'kimchi', 'sauerkraut', 'homemade pickle'],
    'Dry Fruits & Nuts':  ['dry fruits', 'almonds', 'cashew', 'walnut', 'pistachio', 'raisin', 'dates', 'fig', 'mixed nuts', 'trail mix', 'dried cranberry', 'dried mango'],
    'Regional Indian Food': ['dosa', 'idli', 'sambar', 'poha', 'upma', 'thepla', 'khakhra', 'dhokla', 'vada pav', 'pav bhaji', 'chole bhature', 'paratha', 'aloo tikki', 'samosa', 'kachori'],
    'Cooking & Baking Classes': ['baking class', 'baking classes', 'baking studio', 'baking workshop', 'baking course', 'cooking class', 'cooking classes', 'cooking studio', 'cooking workshop', 'cooking course', 'culinary class', 'culinary school', 'cake decorating class', 'pastry class', 'learn to bake', 'learn to cook'],
    'Pet Food & Treats':  ['pet food brand', 'dog treat brand', 'cat treat brand', 'pet nutrition', 'raw pet food'],
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
    'Gardening & Outdoor Living': ['gardening', 'outdoor furniture', 'patio', 'lawn care', 'plant nursery', 'landscaping'],
    'Lighting': ['lighting', 'chandelier', 'pendant light', 'led light', 'lamp', 'floor lamp'],
    'Home Fragrance & Candles': ['scented candle', 'home fragrance', 'reed diffuser', 'incense', 'room spray'],
    'Rugs & Carpets': ['rug', 'carpet', 'area rug', 'persian rug', 'hand-knotted', 'floor covering'],
    'Home Storage & Organization': ['storage', 'organizer', 'shelving', 'closet system', 'storage bin', 'declutter'],
    'Modular Kitchen':    ['modular kitchen', 'kitchen cabinet', 'kitchen design', 'chimney', 'hob', 'built-in oven', 'kitchen countertop', 'kitchen sink', 'kitchen hardware'],
    'Sustainable & Eco Home': ['sustainable home', 'eco-friendly home', 'bamboo product', 'reusable', 'zero waste', 'compostable', 'biodegradable', 'eco home', 'green living'],
    'Home Textiles':      ['home textile', 'cushion cover', 'curtain', 'upholstery', 'table cloth', 'table runner', 'door mat', 'tapestry', 'wall hanging'],
    'Pooja & Spiritual Home': ['pooja room', 'mandir', 'home temple', 'pooja thali', 'diya', 'agarbatti', 'incense stick', 'brass idol', 'bell', 'camphor', 'pooja samagri'],
    'Bathroom Fittings':  ['bathroom fittings', 'shower', 'faucet', 'toilet', 'washbasin', 'bathtub', 'bathroom accessories', 'towel rack', 'soap dispenser', 'geyser', 'water heater'],
    'Outdoor & Patio':    ['outdoor furniture', 'patio set', 'garden chair', 'swing', 'hammock', 'planter', 'bird feeder', 'fire pit', 'outdoor rug', 'gazebo'],
    'Smart Furniture':    ['smart furniture', 'adjustable desk', 'standing desk', 'recliner', 'ergonomic furniture', 'space saving furniture', 'convertible furniture', 'murphy bed', 'wall bed'],
    'Water Purifiers & Dispensers': ['water purifier', 'ro water', 'water filter', 'water dispenser', 'alkaline water', 'uv water purifier'],
  },
  'Health & Wellness': {
    'Fitness Equipment':  ['dumbbell', 'kettlebell', 'resistance band', 'yoga mat', 'exercise bike', 'treadmill', 'gym equipment'],
    'Sexual Wellness':    ['contraceptive', 'lubricant', 'intimacy product', 'adult toy', 'sexual wellness', 'condom', 'condoms', 'pleasure', 'vibrator', 'massager', 'personal massager', 'intimate care', 'intimate hygiene', 'sexual health', 'reproductive health', 'fertility', 'pregnancy test', 'ovulation', 'libido', 'sensual', 'erotic', 'love toy', 'couple wellness', 'intimate wellness', 'durex', 'trojan', 'skyn', 'manforce', 'kohinoor', 'loveroller', 'love roller', 'intimate toy', 'bedroom essentials', 'adult pleasure', 'pleasure product', 'intimate product', 'couples toy', 'body massager', 'kegel', 'intimate accessory'],
    'Mental Health & Self-Care': ['aromatherapy', 'essential oil', 'meditation cushion', 'journal', 'self-care', 'mindfulness'],
    'Medical Devices':    ['blood pressure monitor', 'thermometer', 'first aid kit', 'compression wear', 'medical device', 'compression stockings', 'compression socks', 'anti-embolism', 'varicose vein', 'diabetic socks', 'knee cap', 'knee brace', 'ankle brace', 'wrist brace', 'elbow brace', 'back support', 'lumbar belt', 'cervical collar', 'orthopedic', 'orthopaedic', 'calf support', 'calf sleeve', 'thigh support', 'mmhg', 'graduated compression', 'elastic bandage', 'crepe bandage', 'support belt', 'abdominal belt', 'maternity belt', 'hernia belt', 'arm sling', 'finger splint', 'walking stick', 'crutch', 'wheelchair', 'pulse oximeter', 'nebulizer', 'glucometer', 'hearing aid', 'surgical mask', 'face shield'],
    'Recovery':           ['massage tool', 'foam roller', 'recovery equipment', 'ice pack', 'heat pad'],
    'CBD & Herbal Products': ['cbd product', 'hemp extract', 'botanical'],
    'Ayurvedic & Herbal': ['ayurvedic', 'ayurveda', 'herbal remedy', 'herbal product', 'herbal medicine', 'herbal supplement', 'natural remedy', 'kadha', 'churna', 'single herbs', 'siddha', 'unani', 'naturopathy', 'homeopathy', 'nutraceutical', 'digestive care', 'liver care', 'immunity', 'throat care', 'joint care', 'health tonic', 'health syrup', 'acidity relief'],
    'Sleep & Relaxation': ['sleep aid', 'melatonin', 'white noise', 'sleep mask', 'weighted blanket', 'sleep tracker'],
    'Anti-Aging': ['anti-aging', 'anti-wrinkle', 'collagen supplement', 'retinol', 'age-defying'],
    'Wearable Health Tech': ['health wearable', 'cgm', 'blood glucose monitor', 'smart ring health', 'health tracker'],
    'Women\'s Health':    ['women\'s health', 'period care', 'menstrual cup', 'sanitary pad', 'tampon', 'menstrual health', 'pcos', 'pcod', 'endometriosis', 'menopause', 'hormonal balance', 'intimate wash', 'vaginal health'],
    'Fertility & Reproductive Health': ['fertility', 'ovulation tracker', 'fertility supplement', 'prenatal', 'postnatal', 'pregnancy care', 'ivf support', 'conception', 'sperm health', 'reproductive wellness'],
    'Diabetes Care':      ['diabetes care', 'blood sugar monitor', 'glucometer', 'insulin', 'diabetic food', 'sugar free', 'hba1c', 'diabetic supplement', 'continuous glucose monitor'],
    'Weight Management':  ['weight loss', 'weight management', 'fat burner', 'appetite suppressant', 'meal replacement', 'diet shake', 'calorie deficit', 'intermittent fasting', 'weight loss supplement'],
    'Sports Nutrition':   ['sports nutrition', 'whey protein', 'whey', 'bcaa', 'creatine', 'pre-workout', 'post-workout', 'mass gainer', 'protein shake', 'electrolyte', 'energy gel', 'protein bar', 'protein bars', 'sports supplement', 'sports supplements', 'isolate protein', 'whey isolate', 'casein', 'glutamine', 'protein powder', 'gym supplement', 'workout supplement', 'muscle building', 'lean protein'],
    'Hair Health & Growth': ['hair growth', 'hair loss treatment', 'biotin', 'minoxidil', 'hair thinning', 'scalp treatment', 'hair regrowth', 'anti-hair fall', 'dht blocker'],
    'Oral Health':        ['oral health', 'dental supplement', 'gum health', 'teeth whitening kit', 'oral probiotic', 'mouth ulcer', 'dental care'],
    'Eye Health':         ['eye health', 'eye supplement', 'lutein', 'blue light protection', 'dry eye', 'eye drop', 'vision supplement'],
    'Bone & Joint Health': ['bone health', 'calcium supplement', 'vitamin d', 'glucosamine', 'chondroitin', 'collagen peptide', 'joint pain relief', 'arthritis care', 'osteoporosis'],
  },
  'Baby & Kids': {
    'Baby Care':          ['diaper', 'wipe', 'bottle', 'pacifier', 'baby monitor', 'stroller', 'car seat', 'baby care'],
    'Toys & Games':       ['educational toy', 'puzzle', 'board game', 'action figure', 'doll', 'outdoor toy', 'toy', 'toys', 'activity kit', 'montessori', 'montessori toy', 'flashcard', 'flashcards', 'diy toy', 'wooden toy', 'sensory toy', 'stem toy', 'stacking toy', 'shape sorter', 'pretend play', 'play kitchen', 'toy car', 'soft toy', 'plush toy', 'building blocks', 'lego', 'ride on', 'tricycle', 'kids game', 'kids craft'],
    'Return & Party Gifts': ['return gift', 'return gifts', 'birthday return gift', 'party favour', 'party favor', 'kids party', 'goodie bag', 'party supplies kids', 'loot bag'],
    'Kids Furniture':     ['crib', 'toddler bed', 'kids desk', 'toy storage', 'kids furniture'],
    'Baby Skincare':      ['baby skincare', 'baby bath', 'baby lotion', 'baby shampoo'],
    'Learning':           ['learning kit', 'science kit', 'kids book', 'educational'],
    'Childcare & Daycare': ['childcare', 'daycare', 'child minding', 'after school care', 'nanny service'],
    'Kids Apparel': ['kids clothing', 'children fashion', 'boys wear', 'girls wear', 'kids outfit'],
    'Maternity Products': ['maternity', 'prenatal', 'pregnancy', 'maternity wear', 'nursing pillow'],
    'Parenting Platforms': ['parenting', 'parenting app', 'mom community', 'baby tracker', 'parenting tips'],
    'Kids Safety & Baby Proofing': ['baby proofing', 'child safety', 'cabinet lock', 'corner guard', 'baby gate', 'child lock', 'safety net'],
    'School Supplies & Bags': ['school bag', 'kids backpack', 'lunch box', 'water bottle kids', 'school stationery', 'pencil box'],
    'Kids Electronics & Gadgets': ['kids tablet', 'kids smartwatch', 'learning tablet', 'kids headphone', 'educational gadget'],
    'Outdoor Play Equipment': ['swing set', 'slide', 'trampoline', 'sandbox', 'playhouse', 'jungle gym', 'outdoor play'],
    'Baby Feeding':       ['baby feeding', 'breast pump', 'bottle warmer', 'sterilizer', 'highchair', 'sippy cup', 'baby spoon', 'bibs'],
  },
  'Pet Products': {
    'Pet Food':           ['dog food', 'cat food', 'pet treat', 'chew', 'specialty diet', 'pet food'],
    'Pet Supplies':       ['collar', 'leash', 'pet bed', 'crate', 'pet toy', 'bowl', 'pet grooming'],
    'Pet Healthcare':     ['flea treatment', 'pet dental', 'pet supplement', 'pet medication'],
    'Pet Furniture':      ['cat tree', 'scratching post', 'pet house'],
    'Pet Grooming': ['pet grooming', 'dog grooming', 'cat grooming', 'pet shampoo', 'grooming salon'],
    'Pet Boarding & Daycare': ['pet boarding', 'dog daycare', 'pet hotel', 'pet sitting', 'kennel'],
    'Pet Insurance': ['pet insurance', 'pet health insurance', 'vet bill coverage', 'pet plan'],
    'Pet Tech (GPS, Activity Trackers)': ['pet tracker', 'gps pet', 'pet activity tracker', 'smart collar', 'pet camera'],
    'Pet Adoption Platforms': ['pet adoption', 'adopt a pet', 'rescue dog', 'shelter animal', 'foster pet'],
    'Aquarium & Fish':    ['aquarium', 'fish tank', 'aquarium fish', 'tropical fish', 'fish food', 'aquarium filter', 'aquarium plant', 'reef tank'],
    'Bird Care':          ['bird food', 'bird cage', 'parrot', 'bird toy', 'bird feeder', 'aviary', 'bird seed'],
    'Pet Training':       ['dog training', 'pet training', 'puppy training', 'obedience class', 'dog trainer', 'behavior training'],
    'Pet Clothing & Accessories': ['dog clothing', 'pet costume', 'pet bandana', 'dog sweater', 'pet bow tie', 'pet harness', 'pet carrier'],
    'Raw & Natural Pet Food': ['raw dog food', 'barf diet', 'grain free', 'natural pet food', 'organic pet food', 'freeze dried pet food'],
  },
  'Electronics & Tech': {
    'Consumer Electronics': ['smartphone', 'tablet', 'laptop', 'monitor', 'camera', 'drone'],
    'Wearables':          ['smartwatch', 'fitness tracker', 'smart ring', 'vr headset', 'wearable'],
    'Audio':              ['headphone', 'earbuds', 'speaker', 'soundbar', 'microphone'],
    'Gaming':             ['gaming console', 'gaming keyboard', 'gaming mouse', 'controller', 'gaming chair'],
    'Tech Accessories':   ['phone case', 'phone cover', 'mobile cover', 'back cover', 'mobile case', 'charger', 'cable', 'power bank', 'webcam'],
    'Mobile Covers & Cases': ['mobile cover', 'phone case', 'phone cover', 'back cover', 'mobile case', 'bumper case', 'slim case', 'hard case', 'clear case', 'transparent case', 'silicone case', 'tpu case', 'armor case', 'rugged case', 'flip cover', 'wallet case', 'leather case', 'designer case', 'printed case', 'anime case', 'anime cover', 'custom case', 'tempered glass', 'screen protector', 'screen guard', 'camera protector', 'lens protector', 'iphone case', 'samsung case', 'oneplus case', 'redmi case', 'realme case', 'vivo case', 'oppo case', 'poco case', 'nothing phone case', 'pixel case', 'mobile accessories', 'phone accessories', 'phone skin', 'phone grip', 'popsocket', 'ring holder'],
    'Smartphones & Mobile Devices': ['smartphone', 'mobile phone', 'cell phone', 'iphone', 'android phone'],
    'Drones & UAVs': ['drone', 'uav', 'quadcopter', 'aerial photography drone', 'fpv drone'],
    'Computer Hardware': ['computer hardware', 'motherboard', 'gpu', 'processor', 'ram', 'ssd', 'pc build'],
    'Cameras & Imaging': ['camera', 'dslr', 'mirrorless', 'lens', 'photography equipment', 'action camera'],
    'Home Appliances': ['home appliance', 'washing machine', 'refrigerator', 'air conditioner', 'split ac', 'window ac', 'inverter ac', 'microwave', 'dishwasher', 'air cooler', 'desert cooler', 'tower cooler', 'personal cooler', 'evaporative cooler', 'room cooler', 'tower fan', 'table fan', 'ceiling fan', 'pedestal fan', 'exhaust fan', 'wall fan', 'air purifier', 'dehumidifier', 'humidifier', 'room heater', 'geyser', 'water heater', 'iron', 'steam iron', 'vacuum cleaner', 'robot vacuum', 'air fryer', 'induction cooktop', 'mixer grinder', 'juicer', 'food processor', 'toaster', 'electric kettle', 'water purifier', 'ro purifier', 'chimney', 'kitchen chimney', 'oven', 'microwave oven', 'led tv', 'smart tv', 'television'],
    'Networking & WiFi': ['wifi router', 'mesh wifi', 'network switch', 'access point', 'range extender', 'modem', 'ethernet', 'networking equipment'],
    'Projectors & Displays': ['projector', 'home projector', 'portable projector', 'laser projector', 'projection screen', 'smart display', 'digital frame'],
    'Storage Devices':    ['external hard drive', 'portable ssd', 'usb drive', 'memory card', 'sd card', 'nas storage', 'network storage', 'backup drive'],
    'EV Accessories':     ['ev charger', 'ev cable', 'ev adapter', 'charging station', 'car charger', 'ev accessory', 'electric vehicle charger'],
    'Refurbished & Renewed': ['refurbished', 'renewed', 'open box', 'certified refurbished', 'pre-owned electronics', 'factory refurbished', 'like new'],
    'Streaming & Media Devices': ['streaming device', 'fire stick', 'chromecast', 'apple tv', 'roku', 'set top box', 'media player', 'android tv box'],
    'Smart Home Devices': ['smart speaker', 'smart display', 'smart thermostat', 'smart doorbell', 'smart lock', 'smart plug', 'smart bulb', 'home assistant', 'smart camera'],
    'Power & Charging':   ['wireless charger', 'fast charger', 'usb c charger', 'gan charger', 'power strip', 'surge protector', 'solar charger', 'portable power station'],
    'Cables & Adapters':  ['usb cable', 'hdmi cable', 'lightning cable', 'adapter', 'dongle', 'hub', 'docking station', 'type c hub'],
  },
  'Sports & Outdoor': {
    'Camping & Hiking':   ['camping', 'hiking', 'tent', 'sleeping bag', 'backpack', 'camp stove', 'cooler', 'trekking'],
    'Sports Equipment':   ['bicycle', 'skateboard', 'surfboard', 'paddleboard', 'fishing gear', 'golf club', 'cricket bat', 'badminton'],
    'Outdoor Gear':       ['grill', 'bbq', 'gardening tool', 'outdoor lighting'],
    'Team Sports':        ['football', 'basketball', 'volleyball', 'hockey', 'rugby', 'soccer'],
    'Water Sports':       ['swimming', 'surfing', 'diving', 'snorkeling', 'kayak'],
    'Winter Sports':      ['skiing', 'snowboard', 'ice skating', 'ice hockey', 'snow gear', 'ski boots', 'ski poles', 'avalanche gear', 'snowshoe'],
    'Combat & Martial Arts': ['boxing gear', 'mma gear', 'wrestling', 'jiu jitsu', 'muay thai', 'karate gear', 'taekwondo gear', 'boxing gloves', 'punch bag', 'mouthguard'],
    'Cycling':            ['bicycle', 'cycling gear', 'bike helmet', 'cycling jersey', 'bike accessories', 'mountain bike', 'road bike', 'e-bike', 'bike lock', 'bike lights'],
    'Running':            ['running shoes', 'running gear', 'marathon', 'trail running', 'running watch', 'running shorts', 'hydration vest', 'running belt'],
    'Golf':               ['golf club', 'golf ball', 'golf bag', 'golf shoe', 'golf glove', 'golf cart', 'golf tee', 'golf rangefinder', 'golf apparel'],
    'Fitness Accessories': ['resistance band', 'pull up bar', 'jump rope', 'ab roller', 'yoga block', 'foam roller', 'gym gloves', 'wrist wrap', 'knee sleeve', 'ankle weight'],
    'Cricket':            ['cricket bat', 'cricket ball', 'cricket kit', 'cricket pads', 'cricket gloves', 'cricket helmet', 'cricket shoes', 'cricket bag', 'cricket stumps'],
    'Racquet Sports':     ['badminton racket', 'tennis racket', 'squash racket', 'table tennis', 'pickleball', 'shuttlecock', 'tennis ball', 'racquet string'],
    'Fishing':            ['fishing rod', 'fishing reel', 'fishing lure', 'tackle box', 'fly fishing', 'fishing line', 'fishing net', 'bait', 'fish finder'],
    'Skateboarding & Action Sports': ['skateboard', 'longboard', 'roller skates', 'inline skates', 'bmx', 'scooter', 'helmet', 'protective gear', 'skate park'],
  },
  'Office & Stationery': {
    'Notebooks & Planners': ['notebook', 'journal', 'planner', 'calendar', 'diary', 'bullet journal', 'gratitude journal', 'dot grid', 'lined notebook'],
    'Writing Instruments':  ['pen', 'pencil', 'marker', 'highlighter', 'fountain pen', 'ballpoint', 'gel pen', 'mechanical pencil', 'calligraphy pen'],
    'Desk & Organization':  ['desk organizer', 'file storage', 'desk accessories', 'ergonomic', 'desk pad', 'pen holder', 'paper tray', 'filing cabinet'],
    'Art & Craft':          ['art supplies', 'craft materials', 'paint', 'canvas', 'sketch', 'drawing', 'watercolor', 'acrylic paint', 'oil pastel', 'colored pencil'],
    'Paper & Printing':   ['printer paper', 'copy paper', 'photo paper', 'cardstock', 'sticky notes', 'post-it', 'envelope', 'memo pad'],
    'School Supplies':    ['school supply', 'geometry box', 'compass', 'protractor', 'school bag', 'eraser', 'sharpener', 'ruler', 'crayon', 'school kit'],
    'Office Furniture':   ['office chair', 'standing desk', 'office desk', 'filing cabinet', 'bookshelf', 'whiteboard', 'cork board', 'conference table'],
    'Gift Stationery':    ['gift wrap', 'greeting card', 'thank you card', 'invitation card', 'sticker', 'washi tape', 'decorative tape', 'letter set'],
    'DIY & Scrapbooking': ['scrapbook', 'scrapbooking', 'diy kit', 'paper craft', 'origami', 'quilling', 'stamp', 'ink pad', 'embossing'],
  },
  'EdTech': {
    'Online Courses':     ['online course', 'learning platform', 'video lesson', 'progress tracking', 'certificate'],
    'Language Learning':  ['language learning', 'language app', 'learn language'],
    'Skill Development':  ['skill development', 'upskilling', 'professional development'],
    'K-12 & Test Prep':   ['tutoring', 'test prep', 'sat prep', 'gre prep', 'k-12'],
    'Coding':             ['coding bootcamp', 'programming course', 'learn to code'],
    'STEM & Robotics Education': ['stem education', 'robotics class', 'science camp', 'stem kit', 'coding for kids'],
    'Corporate Training & L&D': ['corporate training', 'l&d', 'employee training', 'leadership development', 'lms'],
    'Study Abroad & Admissions': ['study abroad', 'overseas education', 'admission consulting', 'university application'],
    'Special Education': ['special education', 'learning disability', 'inclusive education', 'special needs'],
    'Tutoring Platforms': ['online tutoring', 'live tutoring', 'one-on-one tutor', 'tutor marketplace'],
    'Certification & Credentialing': ['certification', 'credentialing', 'professional certificate', 'digital badge', 'micro-credential'],
  },
  'FinTech': {
    'Digital Banking':    ['digital bank', 'checking account', 'savings account', 'debit card', 'neobank'],
    'Payments':           ['digital wallet', 'p2p payment', 'buy now pay later', 'upi', 'digital payment'],
    'Investment':         ['investment app', 'robo-advisor', 'cryptocurrency', 'stock trading', 'mutual fund', 'portfolio'],
    'Lending':            ['loan', 'lending', 'emi', 'credit line', 'credit card'],
    'Budgeting':          ['budgeting app', 'expense tracking', 'financial planning'],
    'InsurTech': ['insurtech', 'digital insurance', 'insurance platform', 'insurance automation'],
    'RegTech & Compliance': ['regtech', 'regulatory technology', 'compliance automation', 'kyc', 'aml'],
    'Remittances & Money Transfer': ['remittance', 'money transfer', 'international transfer', 'wire transfer', 'cross-border payment'],
    'BNPL (Buy Now Pay Later)': ['buy now pay later', 'bnpl', 'pay in installments', 'split payment', 'afterpay'],
    'Robo-Advisory': ['robo-advisor', 'robo advisory', 'automated investing', 'algorithm portfolio'],
    'Open Banking': ['open banking', 'banking api', 'account aggregation', 'psd2', 'financial data'],
    'Mobile Wallets': ['mobile wallet', 'digital wallet', 'e-wallet', 'contactless payment', 'tap to pay'],
    'Credit Scoring & Underwriting': ['credit scoring', 'credit score', 'underwriting', 'risk assessment', 'creditworthiness'],
  },
  'Health & Wellness Services': {
    'Telemedicine':       ['telemedicine', 'virtual doctor', 'online prescription', 'doctor online', 'online consultation'],
    'Mental Health':      ['therapy app', 'counseling', 'talkspace', 'betterhelp', 'mental health'],
    'Fitness Apps':       ['workout app', 'yoga app', 'meditation app', 'fitness app'],
    'Nutrition':          ['meal planning', 'calorie tracking', 'nutrition app', 'diet plan'],
    'Addiction Recovery': ['addiction recovery', 'rehab', 'substance abuse', 'sobriety', 'detox center'],
    'Elderly Care & Assisted Living': ['elderly care', 'assisted living', 'home nursing', 'senior care app', 'geriatric care'],
    'Physical Therapy & Rehab': ['physical therapy', 'physiotherapy', 'rehabilitation', 'sports rehab', 'occupational therapy'],
    'Alternative Medicine (Ayurveda, TCM, Homeopathy)': ['ayurveda', 'traditional chinese medicine', 'homeopathy', 'acupuncture', 'naturopathy'],
  },
  'Telecom': {
    'Mobile':             ['mobile plan', 'phone plan', 'prepaid', 'postpaid', 'mvno'],
    'Internet':           ['home internet', 'broadband', 'fiber', '5g service'],
    'Broadband / Fiber': ['broadband', 'fiber optic', 'ftth', 'fiber to the home', 'gigabit internet'],
    'Satellite Communications': ['satellite communication', 'vsat', 'satellite phone', 'satellite broadband'],
    'VoIP & UCaaS': ['voip', 'ucaas', 'unified communication', 'cloud telephony', 'ip phone', 'sip'],
    '5G Infrastructure': ['5g infrastructure', '5g tower', '5g network', 'small cell', 'mmwave'],
    'Cable TV & IPTV': ['cable tv', 'iptv', 'set-top box', 'digital tv', 'cable operator'],
    'Tower Infrastructure': ['telecom tower', 'cell tower', 'tower company', 'tower infrastructure', 'passive infrastructure'],
  },
  'Media & Entertainment': {
    'Video Streaming':    ['movie streaming', 'tv show', 'original series', 'video streaming', 'stream movies', 'watch movies', 'watch online', 'movies online', 'bollywood', 'hollywood', 'telugu movies', 'tamil movies', 'hindi movies', 'dubbed movies', 'latest movies', 'new movies', 'movie collections', 'watch free', 'ott platform', 'web series'],
    'Sports Streaming':   ['live sports', 'sports streaming', 'game streaming'],
    'Live TV':            ['live tv', 'cable replacement', 'tv streaming'],
    'Music Streaming':    ['music streaming', 'on-demand music', 'playlist', 'ad-free listening'],
    'Podcasts':           ['podcast', 'premium podcast'],
    'Audiobooks':         ['audiobook', 'audio book'],
    'Gaming':             ['cloud gaming', 'game subscription', 'game library', 'game pass', 'mobile gaming'],
    'Film & TV Production': ['film production', 'tv production', 'studio', 'production house', 'showrunner'],
    'Animation Studios': ['animation studio', 'animated series', 'cgi', '2d animation', '3d animation'],
    'Music Labels & Production': ['record label', 'music production', 'music publishing', 'artist management'],
    'OTT Platforms': ['ott platform', 'over the top', 'svod', 'avod', 'streaming platform'],
    'Radio & FM': ['radio station', 'fm radio', 'internet radio', 'radio broadcast', 'radio show'],
    'Virtual Reality Content': ['vr content', 'vr experience', 'immersive video', '360 degree video'],
  },
  'News & Media': {
    'National Newspaper': ['national newspaper', 'national daily', 'broadsheet', 'national news', 'india news', 'country news'],
    'Regional & Local News': ['regional news', 'local news', 'city news', 'state news', 'hyperlocal news', 'community news'],
    'Business & Financial News': ['business news', 'financial news', 'stock market news', 'economic times', 'market update', 'financial express', 'bloomberg', 'reuters'],
    'Tech & Science News': ['tech news', 'technology news', 'science news', 'gadget review', 'tech blog', 'startup news'],
    'Sports News':        ['sports news', 'cricket news', 'football news', 'sports update', 'match report', 'sports score', 'live score'],
    'Entertainment & Celebrity News': ['entertainment news', 'bollywood news', 'celebrity gossip', 'film news', 'showbiz', 'hollywood news'],
    'Political News':     ['political news', 'politics', 'election news', 'parliament news', 'policy news', 'government news'],
    'Digital News Platform': ['news app', 'news aggregator', 'digital news', 'online news', 'news portal', 'news website'],
    'Newsletter & Subscription': ['newsletter', 'premium newsletter', 'paid newsletter', 'email newsletter', 'substack', 'morning brief'],
    'Wire Service & Agency': ['news wire', 'press agency', 'news agency', 'wire service', 'syndicated news', 'pti', 'ani', 'reuters', 'ap news'],
    'Magazine & Periodical': ['magazine', 'digital magazine', 'online magazine', 'periodical', 'monthly magazine', 'quarterly review'],
    'Vernacular & Hindi News': ['hindi news', 'samachar', 'khabar', 'patrika', 'dainik', 'tamil news', 'telugu news', 'marathi news', 'bengali news', 'gujarati news', 'kannada news', 'malayalam news'],
    'Investigative & Longform': ['investigative journalism', 'longform', 'in-depth reporting', 'special report', 'expose', 'data journalism', 'fact check'],
  },
  'Insurance': {
    'Health Insurance':   ['health insurance', 'medical insurance', 'health plan', 'medical coverage', 'group health insurance'],
    'Life Insurance':     ['life insurance', 'term insurance', 'term life policy', 'whole life policy', 'life cover', 'death benefit'],
    'Auto Insurance':     ['auto insurance', 'car insurance', 'vehicle insurance', 'motor insurance', 'comprehensive car cover'],
    'Home Insurance':     ['home insurance', 'renters insurance', 'homeowners insurance', 'property insurance', 'dwelling coverage'],
    'Travel Insurance': ['travel insurance', 'trip cancellation', 'travel medical insurance', 'flight delay insurance', 'baggage loss insurance'],
    'Pet Insurance': ['pet insurance', 'pet health plan', 'vet bills coverage', 'pet accident insurance'],
    'Crop & Agriculture Insurance': ['crop insurance', 'agriculture insurance', 'weather insurance', 'harvest protection'],
    'Cyber Insurance': ['cyber insurance', 'data breach insurance', 'cyber liability', 'cyber risk insurance'],
    'Marine & Cargo Insurance': ['marine insurance', 'cargo insurance', 'hull insurance', 'freight insurance'],
    'Reinsurance': ['reinsurance', 'reinsurer', 'ceding company', 'retrocession', 'treaty reinsurance'],
    'Commercial & Liability Insurance': ['commercial insurance', 'liability insurance', 'professional indemnity', 'general liability', 'workers compensation'],
  },
  'Travel & Ticketing': {
    'Travel Booking':     ['flight booking', 'hotel booking', 'vacation package', 'tour package', 'travel booking'],
    'Event Ticketing':    ['event ticket', 'concert ticket', 'sports ticket', 'theater ticket'],
    'Experiences':        ['tour', 'activity booking', 'experience booking'],
    'Vacation Rentals':   ['vacation rental', 'holiday home', 'short-term rental'],
    'Business Travel & TMC': ['business travel', 'corporate travel', 'travel management', 'tmc', 'expense management'],
    'Visa & Immigration Services': ['visa service', 'immigration consultant', 'work permit', 'visa application'],
    'Travel Insurance': ['travel insurance', 'trip protection', 'travel cover', 'medical travel insurance'],
    'Travel Influencer Platform': ['travel blog', 'travel influencer', 'travel content', 'travel vlog'],
    'Cruise & Ferry': ['cruise', 'cruise line', 'ferry', 'ocean cruise', 'river cruise', 'cruise booking'],
  },
  'Food Delivery': {
    'Meal Kit':           ['meal kit', 'subscription meal', 'pre-portioned', 'recipe box'],
    'Prepared Meals':     ['prepared meal', 'ready-to-eat', 'fresh meal delivery'],
    'Restaurant Delivery':['restaurant delivery', 'food delivery app'],
    'Grocery Delivery':   ['grocery delivery', 'online grocery', 'fresh delivery'],
    'Dark Store / Quick Commerce': ['dark store', 'quick commerce', 'micro fulfillment', '15 minute delivery'],
    'Corporate Catering Delivery': ['corporate catering', 'office lunch delivery', 'bulk meal delivery', 'catering order'],
    'Alcohol Delivery': ['alcohol delivery', 'wine delivery', 'beer delivery', 'liquor delivery', 'drink delivery app'],
    'Health & Diet Meal Delivery': ['diet meal delivery', 'healthy meal delivery', 'calorie counted meal', 'keto meal delivery', 'vegan meal delivery', 'macro meal', 'fitness meal'],
    'Tiffin & Home Cooked': ['tiffin service', 'home cooked meal', 'dabba service', 'homemade food', 'home kitchen', 'mom\'s kitchen', 'ghar ka khana'],
    'Ice Cream & Dessert Delivery': ['ice cream delivery', 'dessert delivery', 'cake delivery', 'sweet delivery', 'bakery delivery'],
    'Pet Food Delivery':  ['pet food delivery', 'dog food delivery', 'cat food delivery', 'pet treat delivery', 'pet subscription box'],
    'Specialty & Ethnic Food Delivery': ['ethnic food delivery', 'regional cuisine delivery', 'specialty food delivery', 'international food delivery'],
  },
  'Transportation & Mobility': {
    'Ride-Sharing':       ['ride-sharing', 'rideshare', 'taxi app'],
    'Car Rental':         ['car rental', 'car-sharing', 'car subscription'],
    'Micro-Mobility':     ['bike-sharing', 'scooter-sharing', 'electric scooter'],
    'EV Charging':        ['ev charging', 'charging network', 'charging station'],
    'Public Transit': ['public transit', 'bus service', 'transit authority', 'metro pass', 'commuter rail'],
    'Bike-Sharing': ['bike sharing', 'bike rental', 'dockless bike', 'city bike', 'e-bike sharing'],
    'Autonomous Transport': ['autonomous transport', 'self-driving taxi', 'robo-taxi', 'autonomous shuttle'],
    'Trucking & Road Freight': ['trucking', 'road freight', 'long haul', 'ltl', 'ftl', 'truck load'],
    'Parking Solutions': ['parking', 'smart parking', 'parking app', 'valet parking', 'parking management'],
  },
  'Ecommerce/Retail': {
    'Marketplace':        ['marketplace', 'seller', 'vendor', 'multi-brand'],
    'Social Commerce': ['social commerce', 'shop on instagram', 'shoppable post', 'social selling'],
    'Quick Commerce': ['quick commerce', 'instant delivery', '10 minute delivery', 'dark store', 'q-commerce'],
    'Live Shopping / Livestream Commerce': ['live shopping', 'livestream commerce', 'shop live', 'live selling'],
    'Cross-Border Ecommerce': ['cross-border ecommerce', 'international shipping', 'global store', 'import shopping'],
    'D2C (Direct-to-Consumer)': ['d2c', 'direct to consumer', 'brand website', 'own brand store'],
    'Discount & Dollar Stores': ['discount store', 'dollar store', 'value store', 'bargain', 'clearance'],
    'Convenience Stores': ['convenience store', '24 hour store', 'corner shop', 'mini mart'],
    'Warehouse Clubs': ['warehouse club', 'bulk store', 'membership store', 'costco', 'sams club'],
    'Vending & Automated Retail': ['vending machine', 'automated retail', 'smart vending', 'self-service kiosk'],
    'Duty-Free Retail': ['duty free', 'duty-free shop', 'airport retail', 'tax-free shopping'],
  },
  'Automotive': {
    'Car Dealership':     ['car dealership', 'car dealer', 'showroom', 'test drive', 'new cars', 'used cars', 'pre-owned'],
    'Auto Parts':         ['auto parts', 'spare parts', 'car accessories', 'tire', 'tyre', 'engine oil'],
    'Two Wheeler':        ['motorcycle', 'scooter', 'bike dealer', 'two wheeler'],
    'Electric Vehicle':   ['electric vehicle', 'ev charging', 'electric car', 'electric scooter'],
    'Auto Service':       ['car service', 'car wash', 'auto repair', 'car maintenance'],
    'Commercial Vehicles & Trucks': ['commercial vehicle', 'truck', 'lorry', 'bus manufacturer', 'heavy vehicle'],
    'Autonomous Vehicles': ['autonomous vehicle', 'self-driving', 'adas', 'autonomous driving', 'driverless'],
    'Connected Car / Telematics': ['connected car', 'telematics', 'vehicle tracking', 'obd', 'car connectivity'],
    'Car Wash & Detailing': ['car wash', 'car detailing', 'auto detailing', 'car polish', 'paint protection'],
    'Fleet Management': ['fleet management', 'fleet tracking', 'fleet optimization', 'vehicle fleet'],
    'Auto Insurance Tech': ['auto insurance', 'usage-based insurance', 'telematics insurance', 'motor insurance tech'],
    'Used Car Marketplace': ['used car marketplace', 'pre-owned cars', 'certified pre-owned', 'second hand car'],
  },
  'Real Estate': {
    'Residential':        ['apartment', 'villa', 'flat', 'penthouse', 'bhk', 'gated community', 'township'],
    'Commercial':         ['commercial property', 'office space', 'co-working', 'retail space'],
    'Property Listing':   ['property listing', 'real estate agent', 'broker', 'rent apartment'],
    'Construction':       ['builder', 'developer', 'construction', 'under construction', 'rera'],
    'Property Management': ['property management', 'property manager', 'tenant management', 'landlord', 'rent collection'],
    'PropTech': ['proptech', 'property technology', 'real estate tech', 'virtual tour', 'digital twin'],
    'REIT (Real Estate Investment Trust)': ['reit', 'real estate investment trust', 'dividend yield', 'real estate fund'],
    'Co-Living': ['co-living', 'coliving', 'shared living', 'community living', 'student housing'],
    'Senior Living & Retirement': ['senior living', 'retirement community', 'assisted living', 'independent living'],
    'Industrial & Warehouse': ['industrial real estate', 'warehouse space', 'logistics park', 'industrial park'],
    'Land & Agricultural Real Estate': ['land for sale', 'farm land', 'agricultural land', 'plot', 'acreage'],
  },
  'SaaS & B2B': {
    'CRM & Sales':        ['crm software', 'sales automation', 'pipeline management', 'lead management'],
    'Project Management': ['project management', 'task management', 'collaboration tool', 'team management'],
    'HR & Payroll':       ['hr software', 'payroll software', 'employee management', 'onboarding'],
    'Developer Tools':    ['developer tools', 'api platform', 'devops', 'code hosting', 'version control'],
    'Analytics':          ['data analytics platform', 'business intelligence', 'dashboard', 'reporting'],
    'No-Code / Low-Code': ['no-code', 'low-code', 'drag and drop builder', 'visual editor'],
    'Customer Support / Help Desk': ['help desk', 'customer support', 'ticketing system', 'live chat', 'support portal'],
    'Marketing Automation': ['marketing automation', 'email marketing', 'drip campaign', 'marketing platform', 'lead nurturing'],
    'eSignature & Document Management': ['esignature', 'electronic signature', 'document management', 'digital signing', 'docusign'],
    'Communication & Collaboration': ['team chat', 'video conferencing', 'collaboration software', 'slack', 'microsoft teams'],
    'ERP (Enterprise Resource Planning)': ['erp', 'enterprise resource planning', 'sap', 'oracle erp', 'business suite'],
    'Business Intelligence': ['business intelligence', 'bi dashboard', 'data visualization', 'tableau', 'power bi'],
    'Workflow Automation': ['workflow automation', 'process automation', 'zapier', 'integromat', 'business workflow'],
    'Vertical SaaS (Industry-Specific)': ['vertical saas', 'industry specific software', 'niche saas', 'purpose-built software'],
  },
  'Agriculture': {
    'Farm Inputs':        ['seeds', 'fertilizer', 'pesticide', 'agri input'],
    'Farm Equipment':     ['tractor', 'farm equipment', 'irrigation', 'harvester'],
    'Agri-Commerce':      ['mandi', 'grain trading', 'agri marketplace'],
    'Precision Agriculture & AgTech': ['precision agriculture', 'agtech', 'smart farming', 'variable rate', 'gps farming', 'yield mapping'],
    'Crop Production': ['crop production', 'crop yield', 'harvest', 'grain production', 'cereal crop'],
    'Livestock & Poultry': ['livestock', 'poultry', 'cattle', 'dairy farm', 'animal husbandry', 'broiler'],
    'Organic Farming': ['organic farming', 'organic produce', 'organic certification', 'natural farming', 'chemical-free'],
    'Irrigation & Water Management': ['irrigation', 'drip irrigation', 'sprinkler', 'water management', 'canal irrigation'],
    'Agricultural Drones & Sensors': ['agricultural drone', 'crop sensor', 'ndvi', 'drone spraying', 'crop monitoring'],
    'Seed & Biotech': ['seed company', 'hybrid seed', 'gmo seed', 'seed treatment', 'plant breeding'],
  },
  'Manufacturing': {
    'Heavy Industry':     ['steel', 'cement', 'chemical', 'metal', 'mining'],
    'Machinery':          ['machinery', 'cnc', 'lathe', 'heavy equipment'],
    'Textile':            ['textile mill', 'yarn', 'fabric manufacturing'],
    'Electronics Manufacturing (EMS)': ['electronics manufacturing', 'ems', 'pcb assembly', 'smt', 'contract electronics'],
    'Automotive Manufacturing': ['automotive manufacturing', 'car factory', 'auto assembly', 'vehicle production'],
    'Food Processing': ['food processing', 'food factory', 'canning', 'packaging line', 'food manufacturing'],
    'Contract Manufacturing': ['contract manufacturing', 'private label', 'white label', 'toll manufacturing'],
    'Additive Manufacturing (3D Printing)': ['3d printing', 'additive manufacturing', 'rapid prototyping', '3d printer', 'sls', 'sla'],
    'Semiconductor Fabrication': ['semiconductor fab', 'wafer fabrication', 'chip manufacturing', 'clean room'],
    'Precision Engineering': ['precision engineering', 'micro machining', 'precision components', 'tight tolerance'],
  },
  'Logistics': {
    'Courier & Express':  ['courier', 'express delivery', 'parcel', 'last mile delivery'],
    'Freight':            ['freight', 'cargo', 'trucking', 'shipping company'],
    'Warehousing':        ['warehousing', 'fulfillment center', '3pl', 'cold chain'],
    'Cold Chain & Perishables': ['cold chain', 'refrigerated transport', 'perishable goods', 'cold storage', 'reefer'],
    'Last Mile Delivery': ['last mile', 'doorstep delivery', 'same day delivery', 'hyperlocal delivery'],
    'Supply Chain Management': ['supply chain management', 'scm', 'procurement', 'supply chain visibility', 'demand planning'],
    'Customs & Brokerage': ['customs broker', 'customs clearance', 'import duty', 'trade compliance', 'bonded warehouse'],
    'Reverse Logistics & Returns': ['reverse logistics', 'returns management', 'product returns', 'refurbishment'],
    'Drone Delivery': ['drone delivery', 'aerial delivery', 'unmanned delivery', 'delivery drone'],
  },
  'Legal': {
    'Law Firm':           ['law firm', 'attorney', 'lawyer', 'advocate'],
    'Legal Tech':         ['legal tech', 'contract management', 'legal document', 'e-signature'],
    'IP & Trademark':     ['intellectual property', 'trademark', 'patent', 'copyright'],
    'Contract Management': ['contract management', 'clm', 'contract lifecycle', 'contract review', 'contract automation'],
    'e-Discovery': ['e-discovery', 'ediscovery', 'litigation support', 'document review', 'forensic analysis'],
    'Compliance & Regulatory': ['compliance', 'regulatory compliance', 'regulatory affairs', 'legal compliance', 'audit trail'],
    'Arbitration & Mediation': ['arbitration', 'mediation', 'dispute resolution', 'alternative dispute', 'adr'],
    'Notary & Documentation': ['notary', 'notarization', 'apostille', 'legal documentation', 'affidavit'],
  },
  'HR & Recruitment': {
    'Job Portal':         ['job portal', 'job board', 'job listing', 'career page'],
    'Staffing':           ['staffing', 'recruitment agency', 'headhunter', 'talent acquisition'],
    'HR Tech':            ['hr tech', 'employee engagement', 'workforce management', 'applicant tracking'],
    'Payroll & Benefits': ['payroll processing', 'benefits administration', 'compensation management', 'pay stub'],
    'Employee Engagement': ['employee engagement platform', 'pulse survey', 'recognition platform', 'employee wellbeing'],
    'Background Verification': ['background check', 'background verification', 'employment verification', 'criminal check'],
    'Freelance & Gig Platforms': ['freelance platform', 'gig work', 'freelancer marketplace', 'contract work', 'independent contractor'],
    'Employer Branding': ['employer branding', 'employer brand', 'glassdoor', 'company culture', 'employer review'],
    'Workforce Analytics': ['workforce analytics', 'people analytics', 'hr analytics', 'talent analytics', 'attrition prediction'],
  },
  'Energy & Utilities': {
    'Solar':              ['solar energy', 'solar panel', 'solar installation', 'rooftop solar'],
    'Renewable':          ['wind energy', 'clean energy', 'green energy', 'renewable energy'],
    'Oil & Gas':          ['oil and gas', 'petroleum', 'natural gas', 'refinery'],
    'EV & Battery':       ['ev battery', 'energy storage', 'lithium ion', 'battery technology'],
    'Wind Energy': ['wind energy', 'wind turbine', 'wind farm', 'offshore wind', 'onshore wind'],
    'Hydrogen & Fuel Cells': ['hydrogen', 'fuel cell', 'green hydrogen', 'hydrogen economy', 'electrolysis'],
    'Nuclear Energy': ['nuclear energy', 'nuclear power plant', 'nuclear reactor', 'atomic energy'],
    'Hydroelectric': ['hydroelectric', 'hydropower', 'dam', 'hydro turbine', 'run-of-river'],
    'Energy Storage': ['energy storage', 'battery storage', 'grid storage', 'pumped hydro', 'flow battery'],
    'Smart Grid & Distribution': ['smart grid', 'grid modernization', 'power distribution', 'smart meter', 'ami'],
    'Carbon Trading & Offsets': ['carbon trading', 'carbon offset', 'carbon credit', 'emission trading', 'cap and trade'],
    'Biomass & Bioenergy': ['biomass', 'bioenergy', 'biogas', 'biofuel', 'pellet', 'biomass plant'],
    'Geothermal': ['geothermal', 'geothermal energy', 'geothermal heat pump', 'hot spring energy'],
  },
  'Art & Collectibles': {
    'Fine Art':           ['fine art', 'painting', 'sculpture', 'canvas', 'art gallery'],
    'Collectibles':       ['collectible', 'antique', 'vintage', 'limited edition'],
    'Digital Art':        ['nft', 'digital art', 'generative art', 'crypto art'],
    'Art Galleries & Auction Houses': ['art gallery', 'auction house', 'art auction', 'sothebys', 'christies', 'art fair'],
    'Photography': ['photography print', 'photo gallery', 'fine art photography', 'photo exhibition'],
    'Art Restoration & Conservation': ['art restoration', 'art conservation', 'painting restoration', 'artifact preservation'],
    'Antiques': ['antique', 'antique dealer', 'antique shop', 'vintage collectible', 'antique furniture'],
  },
  'Gifting': {
    'Flowers & Bouquets':    ['flower delivery', 'send flowers', 'flower bouquet', 'fresh flowers', 'floral arrangement', 'rose bouquet', 'flower shop'],
    'Cakes & Bakery Gifts':  ['cake delivery', 'send cake', 'online cake', 'birthday cake', 'custom cake', 'designer cake', 'eggless cake'],
    'Personalized Gifts':    ['personalized gift', 'customized gift', 'photo gift', 'engraved gift', 'name printed', 'custom mug', 'photo frame gift', 'personalized hamper'],
    'Multi-category Gifts':  ['gift shop', 'gift store', 'gifting platform', 'send gifts online', 'gift delivery', 'combo gift', 'gift combo'],
    'Corporate Gifts':       ['corporate gift', 'corporate gifting', 'bulk gifts', 'employee gift', 'client gift', 'business gift', 'branded gift'],
    'Chocolate Gifts':       ['chocolate gift', 'chocolate box', 'chocolate bouquet', 'premium chocolate', 'chocolate hamper'],
    'Edible Gifts':          ['edible arrangement', 'fruit basket', 'dry fruit gift', 'sweet box', 'mithai gift', 'gourmet gift basket'],
    'Gift Cards & Vouchers': ['gift card', 'gift voucher', 'experience gift', 'digital gift card', 'e-gift card'],
    'Cakes & Flowers':       ['cake and flower', 'flower with cake', 'combo delivery', 'cake bouquet combo'],
    'Hampers & Gift Sets':   ['gift hamper', 'gift basket', 'gift set', 'curated gift box', 'luxury hamper', 'festive hamper'],
  },
  'Wedding & Events': {
    'Wedding Planning':   ['wedding planner', 'wedding venue', 'wedding decoration'],
    'Wedding Invitations & Stationery': ['wedding invitation', 'wedding card', 'invitation suite', 'wax seal', 'custom stamp', 'envelope', 'rsvp card', 'save the date', 'wedding stationery', 'invitation design'],
    'Bridal & Groom':     ['wedding dress', 'bridal', 'groom wear', 'bridal lehenga'],
    'Event Management':   ['event management', 'event planner', 'conference', 'exhibition'],
    'Wedding Venue': ['wedding venue', 'banquet hall', 'wedding destination', 'outdoor wedding', 'marriage hall'],
    'Wedding Photography & Videography': ['wedding photographer', 'wedding videographer', 'pre-wedding shoot', 'wedding film'],
    'Event Rentals & Decor': ['event rental', 'party decoration', 'event decor', 'tent rental', 'party supplies'],
    'Conference & Exhibition Management': ['conference management', 'exhibition organizer', 'trade show', 'expo', 'summit'],
    'Corporate Events': ['corporate event', 'team building', 'offsite', 'corporate retreat', 'annual day'],
  },
  'Printing & Packaging': {
    'Digital Printing':   ['digital printing', 'custom printing', 'sticker printing', 'label printing', 'on demand printing', 'print on demand'],
    'Commercial Printing':['offset printing', 'flex printing', 'banner printing', 'signage', 'brochure printing', 'catalog printing', 'poster printing'],
    'Packaging':          ['packaging design', 'corrugated box', 'branded packaging', 'custom packaging', 'food packaging', 'sustainable packaging', 'luxury packaging'],
    'Textile & Garment Printing': ['screen printing', 't-shirt printing', 'sublimation printing', 'dtg printing', 'garment printing', 'fabric printing'],
    'Photo & Canvas Printing': ['photo printing', 'canvas print', 'photo book', 'photo frame printing', 'wall print', 'poster print'],
    'Merchandise & Promotional': ['merchandise printing', 'promotional products', 'custom mug', 'custom cap', 'branded merchandise', 'corporate merchandise'],
    '3D Printing Services': ['3d printing service', '3d print', 'rapid prototyping', 'additive manufacturing service', 'custom 3d print'],
  },
  'Pharmacy & Optical': {
    'Pharmacy':           ['pharmacy', 'chemist', 'drugstore', 'online pharmacy', 'medical store'],
    'Optical':            ['optical store', 'eye care', 'prescription glasses', 'contact lenses', 'spectacle'],
    'Online Pharmacy': ['online pharmacy', 'e-pharmacy', 'medicine delivery', 'pharmacy app', 'digital pharmacy'],
    'Compounding Pharmacy': ['compounding pharmacy', 'custom medication', 'compounded drug', 'specialty compounding'],
    'Medical Supplies & Disposables': ['medical supplies', 'disposable gloves', 'surgical mask', 'medical consumable', 'syringe'],
    'Contact Lenses': ['contact lens', 'daily lens', 'monthly lens', 'colored lens', 'toric lens'],
  },
  'FMCG': {
    'Personal Care':      ['personal care', 'toiletries', 'body care', 'oral care', 'shampoo brand', 'soap brand', 'deodorant brand'],
    'Household':          ['household products', 'cleaning', 'detergent', 'air freshener', 'dishwash', 'floor cleaner', 'toilet cleaner', 'fabric softener', 'bleach'],
    'Packaged Foods':     ['packaged goods', 'snack brand', 'beverage brand', 'breakfast cereal', 'instant noodle', 'biscuit brand', 'ready to cook'],
    'Hair Care Products': ['hair oil brand', 'shampoo brand', 'hair color', 'hair dye', 'conditioner brand'],
    'Baby FMCG':          ['baby diaper brand', 'baby wipes brand', 'baby powder', 'baby wash', 'infant care'],
    'Feminine Hygiene':   ['sanitary napkin', 'menstrual pad', 'panty liner', 'tampon brand', 'feminine wash'],
    'Beverages FMCG':     ['soft drink', 'cola', 'juice brand', 'water brand', 'energy drink brand', 'sports drink'],
    'Oral Care Products': ['toothpaste brand', 'toothbrush brand', 'mouthwash brand', 'dental care brand'],
    'Paper & Tissue Products': ['tissue paper', 'toilet paper', 'paper towel', 'facial tissue', 'napkins'],
    'Insect & Pest Repellent': ['mosquito repellent', 'insect repellent', 'cockroach killer', 'ant killer', 'pest spray'],
  },
  'Crypto & Web3': {
    'Exchange':           ['crypto exchange', 'trading platform', 'dex', 'centralized exchange'],
    'DeFi':               ['defi', 'yield farming', 'staking', 'liquidity pool'],
    'NFT':                ['nft marketplace', 'nft collection', 'digital collectible'],
    'Infrastructure':     ['blockchain', 'smart contract', 'web3 infrastructure', 'layer 2'],
    'Wallet & Custody': ['crypto wallet', 'custody', 'cold storage', 'hardware wallet', 'multi-sig'],
    'Blockchain-as-a-Service': ['blockchain as a service', 'baas', 'enterprise blockchain', 'hyperledger'],
    'DAOs & Governance': ['dao', 'decentralized governance', 'on-chain voting', 'governance token'],
    'Tokenization (Real-World Assets)': ['tokenization', 'real world asset', 'rwa', 'security token', 'asset tokenization'],
    'Stablecoins': ['stablecoin', 'usdt', 'usdc', 'dai', 'pegged currency', 'fiat-backed'],
  },
  'Cloud & DevTools': {
    'Cloud Platform':     ['cloud platform', 'iaas', 'paas', 'cloud hosting'],
    'DevOps':             ['ci cd', 'continuous integration', 'kubernetes', 'docker', 'containerization'],
    'Serverless':         ['serverless', 'function as a service', 'edge computing'],
    'CI/CD Platforms': ['ci cd', 'continuous integration', 'continuous delivery', 'build pipeline', 'github actions'],
    'API Management': ['api management', 'api gateway', 'api marketplace', 'api documentation', 'api security'],
    'Containerization & Orchestration': ['container', 'kubernetes', 'docker', 'orchestration', 'helm', 'container registry'],
    'Low-Code / No-Code Platforms': ['low-code platform', 'no-code platform', 'citizen developer', 'visual development'],
    'Database-as-a-Service': ['database as a service', 'dbaas', 'managed database', 'cloud database', 'nosql service'],
  },
  'Cybersecurity': {
    'Endpoint Security':  ['endpoint security', 'antivirus', 'malware protection', 'ransomware'],
    'Network Security':   ['firewall', 'intrusion detection', 'ddos protection', 'vpn'],
    'Identity & Access':  ['identity management', 'access control', 'zero trust', 'sso', 'mfa'],
    'Threat Intelligence':['threat intelligence', 'soc', 'siem', 'vulnerability management'],
    'Cloud Security': ['cloud security', 'cspm', 'cwpp', 'cloud workload protection', 'cloud access security'],
    'Application Security': ['application security', 'appsec', 'sast', 'dast', 'code scanning', 'devsecops'],
    'Data Privacy & Compliance': ['data privacy', 'gdpr', 'ccpa', 'privacy compliance', 'data protection officer'],
    'Security Operations (SOC)': ['security operations center', 'soc analyst', 'incident response', 'threat hunting'],
    'OT/IoT Security': ['ot security', 'iot security', 'scada security', 'industrial control system', 'ics security'],
    'Mobile Security': ['mobile security', 'mobile threat defense', 'mobile threat detection', 'device security', 'app security', 'mobile protection', 'cyber insurance', 'spam call blocking', 'phishing protection'],
  },
  'Grocery & Supermarket': {
    'Supermarket Chain':  ['supermarket', 'hypermarket', 'grocery chain', 'retail chain', 'mega store', 'departmental store'],
    'Online Grocery':     ['online grocery', 'grocery delivery', 'quick commerce', 'instant delivery', 'grocery app', 'e-grocery'],
    'Wholesale':          ['wholesale', 'bulk buying', 'warehouse club', 'cash and carry', 'bulk store', 'wholesale club'],
    'Specialty Grocery':  ['organic grocery', 'gourmet', 'specialty food store', 'health food store', 'vegan store', 'gluten free store'],
    'Fresh Produce & Farm Direct': ['fresh produce', 'farm fresh', 'farm to table', 'farm direct', 'local produce', 'fresh vegetable', 'fresh fruit', 'organic produce'],
    'Meat & Seafood':     ['meat shop', 'meat store', 'meat delivery', 'fresh meat', 'premium meat', 'butcher', 'seafood market', 'seafood store', 'fresh fish', 'halal meat', 'chicken shop', 'frozen meat', 'cold cuts', 'mutton', 'lamb', 'prawns', 'meat online', 'seafood delivery', 'seafood online', 'meat cuts'],
    'Dairy & Bakery':     ['dairy shop', 'milk delivery', 'bakery shop', 'fresh bread', 'cheese shop', 'curd', 'paneer shop'],
    'Quick Commerce & Dark Store': ['quick commerce', '10 minute delivery', '15 minute delivery', 'dark store', 'micro fulfillment', 'instant grocery', 'q-commerce'],
    'Kirana & Convenience': ['kirana store', 'kirana', 'general store', 'provision store', 'convenience store', 'corner shop', 'neighborhood store'],
    'International & Imported Foods': ['imported food', 'international grocery', 'exotic food', 'foreign food', 'asian grocery', 'korean grocery', 'japanese grocery'],
    'Beverage Store':     ['beverage store', 'juice bar', 'smoothie bar', 'tea store', 'coffee store', 'drink store'],
  },
  'Professional Services': {
    'Consulting':         ['management consulting', 'strategy consulting', 'business consulting', 'advisory'],
    'Marketing & Advertising': ['marketing agency', 'digital agency', 'advertising agency', 'creative agency', 'pr agency', 'branding agency', 'social media agency', 'seo agency'],
    'Accounting & Tax':   ['accounting firm', 'chartered accountant', 'tax consultant', 'audit firm', 'bookkeeping', 'cpa'],
    'Design & Architecture': ['architecture firm', 'interior designer', 'design studio', 'ux design', 'graphic design'],
    'IT Services':        ['it consulting', 'software consulting', 'outsourcing', 'bpo', 'kpo', 'managed services'],
    'Research':           ['market research', 'research firm', 'analytics consulting', 'data consulting'],
    'Translation & Localization': ['translation', 'localization', 'interpreter', 'language service', 'multilingual'],
    'PR & Communications': ['public relations', 'pr agency', 'media relations', 'crisis communication', 'press release'],
    'Management Consulting': ['management consulting', 'strategy consulting', 'operational consulting', 'transformation'],
    'Engineering Services': ['engineering services', 'structural engineering', 'mechanical engineering', 'electrical engineering'],
    'Environmental Consulting': ['environmental consulting', 'eia', 'environmental impact', 'sustainability consulting'],
    'Outsourcing (BPO/KPO)': ['bpo', 'kpo', 'business process outsourcing', 'offshore', 'nearshore', 'call center'],
  },
  'NGO & Non-Profit': {
    'Charity':            ['charity', 'charitable trust', 'donation', 'relief fund', 'humanitarian'],
    'Foundation':         ['foundation', 'philanthropy', 'endowment', 'grant making'],
    'Social Enterprise':  ['social enterprise', 'social impact', 'sustainable development', 'impact investing'],
    'Advocacy':           ['advocacy', 'awareness campaign', 'human rights', 'animal rights', 'environmental'],
    'Humanitarian Aid & Relief': ['humanitarian aid', 'disaster relief', 'emergency response', 'refugee support', 'crisis relief'],
    'Environmental Conservation': ['environmental conservation', 'wildlife conservation', 'habitat preservation', 'ecosystem protection'],
    'Community Development': ['community development', 'rural development', 'grassroots', 'community empowerment'],
    'Crowdfunding & Fundraising Platforms': ['crowdfunding', 'fundraising platform', 'gofundme', 'ketto', 'milaap'],
    'Microfinance NGO': ['microfinance ngo', 'micro lending', 'self help group', 'financial literacy', 'poverty alleviation'],
  },
  'Restaurant & Hospitality': {
    'Fine Dining':        ['fine dining', 'michelin', 'gourmet', 'tasting menu', 'chef table'],
    'Casual Dining':      ['casual dining', 'family restaurant', 'diner', 'bistro', 'eatery'],
    'Fast Food & QSR':    ['fast food', 'quick service', 'takeaway', 'drive through', 'burger', 'pizza'],
    'Cloud Kitchen':      ['cloud kitchen', 'ghost kitchen', 'delivery only', 'virtual restaurant'],
    'Cafe & Bakery':      ['cafe', 'coffee shop', 'bakery', 'patisserie', 'tea house'],
    'Hotel & Resort':     ['hotel', 'resort', 'boutique hotel', 'luxury hotel', 'heritage hotel', 'spa resort'],
    'Catering':           ['catering service', 'event catering', 'corporate catering', 'banquet'],
    'Boutique Hotel': ['boutique hotel', 'design hotel', 'lifestyle hotel', 'independent hotel'],
    'Hostel & Budget Accommodation': ['hostel', 'backpacker', 'budget hotel', 'dormitory', 'cheap accommodation'],
    'Motel & Roadside': ['motel', 'roadside inn', 'motor lodge', 'highway hotel'],
    'Bed & Breakfast / Homestay': ['bed and breakfast', 'b&b', 'homestay', 'guest house', 'farmstay'],
    'Service Apartments': ['service apartment', 'serviced apartment', 'apart-hotel', 'extended stay'],
    'Food Truck & Street Food': ['food truck', 'street food', 'mobile kitchen', 'pop-up restaurant'],
    'Restaurant Chain / Franchise': ['restaurant chain', 'franchise restaurant', 'multi-outlet', 'restaurant franchise'],
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
    'Investment Banking': ['investment banking', 'ipo', 'underwriting', 'mergers and acquisitions', 'm&a advisory'],
    'Private Banking': ['private banking', 'high net worth', 'hnwi', 'exclusive banking', 'priority banking'],
    'Islamic Banking': ['islamic banking', 'sharia compliant', 'murabaha', 'sukuk', 'islamic finance'],
    'Central Banking': ['central bank', 'monetary policy', 'reserve bank', 'federal reserve', 'interest rate'],
    'Trade Finance': ['trade finance', 'letter of credit', 'bank guarantee', 'export credit', 'trade facilitation'],
    'Agricultural Finance': ['agricultural finance', 'crop loan', 'farm credit', 'rural lending', 'kisan credit'],
  },
  'Government & Public Sector': {
    'Central Government': ['central government', 'ministry', 'parliament', 'union government'],
    'State Government':   ['state government', 'chief minister', 'state legislature'],
    'Municipal & Local':  ['municipal', 'corporation', 'panchayat', 'district', 'city administration'],
    'Regulatory Body':    ['regulatory', 'commission', 'authority', 'sebi', 'rbi', 'trai'],
    'Public Services':    ['e-governance', 'citizen service', 'public service', 'digital india'],
    'Defense & Military': ['defense ministry', 'military', 'armed forces', 'army', 'navy', 'air force'],
    'Judiciary & Courts': ['judiciary', 'court', 'supreme court', 'high court', 'district court', 'tribunal'],
    'Tax & Revenue': ['tax department', 'income tax', 'gst', 'revenue service', 'tax authority'],
    'Customs & Immigration': ['customs', 'immigration', 'visa', 'passport', 'border control'],
    'Public Health': ['public health', 'health department', 'cdc', 'who', 'epidemic', 'vaccination drive'],
  },
  'Social Media & Platforms': {
    'Social Network':     ['social network', 'connect with friends', 'follow', 'feed', 'timeline'],
    'Short Video':        ['short video', 'reels', 'stories', 'video sharing'],
    'Forum & Community':  ['forum', 'discussion board', 'community platform', 'q&a'],
    'Creator Platform':   ['creator economy', 'influencer platform', 'content creator', 'monetization'],
    'Professional Networking': ['professional networking', 'linkedin', 'business network', 'industry connect'],
    'Messaging & Chat Apps': ['messaging app', 'chat app', 'instant messaging', 'group chat', 'encrypted chat'],
    'Blogging & Microblogging': ['blog platform', 'microblog', 'tumblr', 'medium', 'substack', 'personal blog'],
    'Review & Rating Platforms': ['review platform', 'rating', 'consumer review', 'product review', 'yelp', 'trustpilot'],
    'Anonymous / Niche Social': ['anonymous social', 'niche community', 'interest-based network', 'private group'],
    'Audio Social':       ['audio social', 'clubhouse', 'twitter spaces', 'live audio', 'audio room', 'podcast social'],
    'Photo & Video Sharing': ['photo sharing', 'video sharing', 'instagram', 'snapchat', 'tiktok', 'photo community', 'image hosting'],
    'Social Shopping':    ['social shopping', 'shop with friends', 'group buying', 'social commerce', 'wishlist sharing', 'gift registry'],
    'Alumni & School Networks': ['alumni network', 'school network', 'college community', 'batch group', 'alumni association'],
    'Neighborhood & Local': ['neighborhood app', 'local community', 'nextdoor', 'resident community', 'society app', 'apartment community'],
  },
  'Gaming & Esports': {
    'Game Studio':        ['game studio', 'game developer', 'game publisher', 'indie game'],
    'Esports':            ['esports', 'competitive gaming', 'tournament', 'league'],
    'Game Platform':      ['game download', 'game store', 'game library', 'steam'],
    'Mobile Gaming':      ['mobile game', 'hyper casual', 'casual game', 'puzzle game'],
    'Console Gaming':     ['playstation', 'xbox', 'nintendo', 'switch game', 'ps5', 'ps4', 'xbox series', 'console exclusive'],
    'PC Gaming':          ['pc game', 'steam', 'epic games', 'gog', 'pc master race', 'gaming pc', 'pc build', 'mod support'],
    'Cloud Gaming':       ['cloud gaming', 'game streaming', 'geforce now', 'xbox cloud', 'stadia', 'luna', 'game pass cloud'],
    'Game Streaming & Content': ['twitch', 'game streamer', 'youtube gaming', 'game content', 'lets play', 'speedrun', 'game walkthrough', 'game review'],
    'VR Gaming':          ['vr game', 'virtual reality game', 'meta quest game', 'psvr', 'vr experience', 'immersive gaming'],
    'Esports Teams & Leagues': ['esports team', 'esports league', 'pro gaming', 'competitive league', 'esports organization', 'gaming clan', 'esports roster'],
    'Gaming Peripherals': ['gaming headset', 'gaming monitor', 'gaming mousepad', 'rgb lighting', 'gaming desk', 'stream deck', 'capture card', 'gaming microphone'],
    'Board & Tabletop Games': ['board game', 'tabletop game', 'card game', 'dice game', 'miniature game', 'dungeons and dragons', 'warhammer', 'tcg', 'trading card game'],
    'Game Development Tools': ['game engine', 'unity', 'unreal engine', 'godot', 'game sdk', 'game development', 'level design', 'game asset'],
  },
  'Betting & Fantasy Sports': {
    'Fantasy Sports':     ['fantasy sports', 'fantasy cricket', 'fantasy football', 'dream team', 'daily fantasy'],
    'Sports Betting':     ['sports betting', 'sportsbook', 'odds', 'wagering', 'horse racing'],
    'Online Casino':      ['online casino', 'poker', 'rummy', 'slot', 'live casino', 'card game'],
    'Lottery':            ['lottery', 'jackpot', 'lucky draw', 'raffle'],
    'Esports Betting': ['esports betting', 'esports wagering', 'competitive gaming bet', 'esports odds'],
    'Prediction Markets': ['prediction market', 'event prediction', 'binary options', 'forecast market'],
    'Horse Racing': ['horse racing', 'derby', 'turf', 'racing form', 'thoroughbred'],
  },
  'Dating & Matchmaking': {
    'Dating App':         ['dating app', 'online dating', 'swipe', 'singles', 'speed dating', 'match', 'bumble', 'hinge'],
    'Matrimony':          ['matrimony', 'matrimonial', 'shaadi', 'vivah', 'rishta', 'bride', 'groom', 'biodata'],
    'Niche Dating':       ['christian dating', 'muslim dating', 'senior dating', 'lgbtq dating', 'jewish dating', 'hindu dating', 'caste based', 'community matrimony'],
    'Video Dating':       ['video dating', 'virtual date', 'video call date', 'live dating', 'face-to-face dating'],
    'LGBTQ+ Dating':      ['lgbtq dating', 'gay dating', 'lesbian dating', 'queer dating', 'grindr', 'her app', 'trans dating'],
    'Matchmaking Services': ['matchmaking service', 'professional matchmaker', 'personalized matchmaking', 'elite matchmaking', 'premium matrimony'],
    'Relationship Coaching': ['relationship coaching', 'dating coach', 'relationship advice', 'couples counseling', 'pre-marital counseling'],
    'Regional Matrimony': ['tamil matrimony', 'telugu matrimony', 'marathi matrimony', 'bengali matrimony', 'punjabi matrimony', 'gujarati matrimony', 'kannada matrimony', 'malayalam matrimony'],
  },
  'Web Hosting & Domains': {
    'Shared Hosting':     ['shared hosting', 'web hosting', 'cpanel', 'wordpress hosting'],
    'Cloud & VPS':        ['vps hosting', 'cloud hosting', 'dedicated server', 'managed hosting'],
    'Domain Services':    ['domain registration', 'domain transfer', 'domain renewal', 'whois'],
    'CDN & Performance':  ['cdn', 'content delivery', 'ddos protection', 'load balancer', 'edge computing'],
    'Website Builder':    ['website builder', 'drag and drop', 'no-code website', 'landing page builder'],
    'Managed WordPress Hosting': ['managed wordpress', 'wp hosting', 'wordpress optimized', 'wp engine'],
    'Email Hosting': ['email hosting', 'business email', 'custom email domain', 'email server'],
    'SSL & Security Certificates': ['ssl certificate', 'tls', 'code signing', 'wildcard ssl', 'ev certificate'],
    'DNS Management': ['dns management', 'dns hosting', 'managed dns', 'dns provider', 'authoritative dns'],
  },
  'Home Services': {
    'Cleaning':           ['home cleaning', 'deep cleaning', 'carpet cleaning', 'sofa cleaning', 'kitchen cleaning', 'bathroom cleaning', 'window cleaning'],
    'Repairs & Maintenance': ['plumber', 'electrician', 'carpenter', 'ac repair', 'appliance repair', 'handyman', 'geyser repair', 'washing machine repair', 'fridge repair'],
    'Pest Control':       ['pest control', 'termite', 'cockroach', 'mosquito', 'fumigation', 'bed bug', 'rat control', 'ant control'],
    'Moving & Relocation': ['packers and movers', 'relocation', 'moving service', 'shifting', 'house shifting', 'office shifting', 'car transport'],
    'Home Improvement':   ['painting', 'waterproofing', 'renovation', 'home renovation', 'interior work', 'false ceiling', 'modular kitchen install'],
    'Gardening & Lawn Care': ['gardening service', 'lawn mowing', 'garden maintenance', 'plant care', 'tree trimming', 'landscape service', 'terrace garden'],
    'Water Purifier Service': ['water purifier service', 'ro service', 'water purifier installation', 'filter replacement', 'purifier repair'],
    'Solar Installation': ['solar panel installation', 'rooftop solar', 'solar inverter', 'solar installation service', 'solar for home'],
    'Security & CCTV Installation': ['cctv installation', 'home security setup', 'door lock installation', 'video doorbell install', 'alarm system install'],
    'Interior Design':    ['interior design service', 'home interior', 'room design', 'interior decorator', 'space planning', 'home makeover'],
    'Chimney & Kitchen Service': ['chimney cleaning', 'chimney repair', 'kitchen appliance repair', 'hob repair', 'oven repair'],
  },
  'Security & Surveillance': {
    'CCTV & Cameras':     ['cctv', 'security camera', 'ip camera', 'nvr', 'dvr', 'surveillance'],
    'Access Control':     ['access control', 'biometric', 'face recognition', 'smart lock'],
    'Alarm Systems':      ['fire alarm', 'burglar alarm', 'intrusion alarm', 'smoke detector'],
    'Guard Services':     ['security guard', 'guarding service', 'manned guarding', 'patrol'],
    'Cybersecurity Services (Managed)': ['managed security', 'mssp', 'managed soc', 'security monitoring'],
    'Biometric Systems': ['biometric system', 'fingerprint scanner', 'iris recognition', 'palm vein'],
    'Drone Surveillance': ['drone surveillance', 'aerial security', 'surveillance drone', 'drone patrol'],
    'Event Security': ['event security', 'crowd management', 'venue security', 'concert security'],
  },
  'Construction & Building Materials': {
    'Cement & Concrete':  ['cement', 'concrete', 'ready mix', 'ultratech', 'acc', 'ambuja'],
    'Steel & Metals':     ['steel bars', 'tmt bars', 'structural steel', 'rebar', 'iron'],
    'Tiles & Flooring':   ['tiles', 'marble', 'granite', 'vitrified tiles', 'flooring'],
    'Construction Chemicals': ['waterproofing', 'adhesive', 'grout', 'sealant', 'construction chemical'],
    'Infrastructure':     ['infrastructure', 'road construction', 'bridge', 'tunnel', 'highway'],
    'Prefab & Modular Construction': ['prefab', 'modular construction', 'prefabricated', 'precast', 'modular building'],
    'Glass & Windows': ['glass window', 'window pane', 'double glazing', 'tempered glass', 'architectural glass'],
    'Plumbing & HVAC': ['plumbing', 'hvac', 'heating', 'ventilation', 'air conditioning', 'pipe fitting'],
    'Roofing': ['roofing', 'roof tile', 'metal roofing', 'shingle', 'roofing sheet', 'waterproof roofing'],
    'Paint & Coatings': ['paint', 'coating', 'primer', 'wall paint', 'industrial coating', 'wood finish'],
    'Electrical Fittings': ['electrical fitting', 'switch', 'socket', 'wiring', 'conduit', 'mcb'],
  },
  'Alcohol & Tobacco': {
    'Liquor Retail':      ['bottle shop', 'liquor store', 'wine store', 'alcohol delivery', 'liquor delivery', 'drink delivery', 'bottle-o', 'off licence', 'package store', 'alcohol online', 'alcohol shop', 'liquor shop', 'cellar door'],
    'Spirits':            ['whisky', 'whiskey', 'vodka', 'rum', 'gin', 'tequila', 'brandy', 'bourbon', 'single malt', 'blended scotch'],
    'Wine':               ['wine', 'champagne', 'prosecco', 'vineyard', 'winery', 'sommelier', 'wine cellar', 'vintages'],
    'Beer':               ['beer', 'craft beer', 'brewery', 'lager', 'ale', 'stout', 'ipa', 'microbrewery'],
    'Bar & Lounge':       ['bar', 'pub', 'lounge', 'cocktail bar', 'nightclub'],
    'Tobacco':            ['tobacco', 'cigarette', 'cigar', 'vape', 'e-cigarette', 'hookah'],
    'Craft Brewing': ['craft brewery', 'microbrewery', 'craft beer', 'small batch', 'taproom', 'brew pub'],
    'Non-Alcoholic Beverages (NA Beer/Spirits)': ['non-alcoholic beer', 'na beer', 'alcohol-free', 'zero alcohol', 'mocktail', 'non-alcoholic spirits'],
    'Cannabis-Infused Beverages': ['cannabis beverage', 'thc drink', 'cbd drink', 'infused beverage', 'cannabis seltzer'],
    'Vaping & E-Cigarettes': ['vape', 'e-cigarette', 'vaping', 'vape juice', 'e-liquid', 'pod system', 'nicotine pouch'],
  },
  'Religious & Spiritual': {
    'Temple & Shrine':    ['temple', 'mandir', 'shrine', 'darshan', 'puja', 'pooja', 'prasad'],
    'Church':             ['church', 'cathedral', 'chapel', 'parish', 'diocese', 'sunday service'],
    'Mosque':             ['mosque', 'masjid', 'namaz', 'islamic center', 'jama masjid'],
    'Spiritual Center':   ['ashram', 'retreat center', 'meditation center', 'yoga ashram', 'spiritual guru'],
    'Religious Products': ['religious book', 'puja items', 'incense', 'idol', 'murti', 'prayer beads'],
  },
  'Astrology & Spiritual Services': {
    'Astrology Consultation': ['astrology consultation', 'talk to astrologer', 'chat with astrologer', 'online astrologer', 'astrologer on call', 'live astrologer', 'astrology app', 'astrology platform'],
    'Horoscope & Kundli':     ['horoscope', 'kundli', 'kundali', 'janam kundli', 'birth chart', 'natal chart', 'janampatri', 'rashifal', 'daily horoscope', 'weekly horoscope', 'monthly horoscope', 'yearly horoscope', 'free kundli'],
    'Vedic Astrology':        ['vedic astrology', 'jyotish', 'jyotish shastra', 'vedic chart', 'vedic horoscope', 'indian astrology', 'hindu astrology'],
    'Tarot & Card Reading':   ['tarot', 'tarot reading', 'tarot card', 'oracle card', 'card reading', 'angel card', 'tarot consultation'],
    'Numerology':             ['numerology', 'numerologist', 'name numerology', 'number prediction', 'lucky number', 'life path number'],
    'Vastu & Feng Shui':      ['vastu', 'vastu shastra', 'vastu consultant', 'feng shui', 'feng shui consultant', 'home vastu', 'office vastu'],
    'Palmistry & Face Reading': ['palmistry', 'palm reading', 'face reading', 'physiognomy', 'hand reading', 'chiromancy'],
    'Panchang & Muhurat':     ['panchang', 'muhurat', 'shubh muhurat', 'tithi', 'nakshatra', 'hindu calendar', 'auspicious time', 'marriage muhurat', 'griha pravesh muhurat'],
    'Psychic & Healing':      ['psychic', 'psychic reading', 'crystal healing', 'reiki', 'reiki healer', 'aura reading', 'energy healing', 'chakra healing', 'spiritual healing'],
    'Compatibility & Matchmaking': ['kundli matching', 'horoscope matching', 'gun milan', 'compatibility check', 'manglik check', 'marriage compatibility', 'love compatibility'],
  },
  'Classifieds & Listings': {
    'General Classifieds': ['classifieds', 'buy and sell', 'local listing', 'post ad', 'free listing'],
    'Used Goods':         ['second hand', 'pre-owned', 'used items', 'refurbished'],
    'Auction':            ['auction', 'bidding', 'online auction', 'reserve price'],
    'Vehicle Classifieds': ['car classifieds', 'vehicle listing', 'buy used car', 'sell car online'],
    'Real Estate Listings': ['property classifieds', 'house for sale', 'flat for rent', 'property listing'],
    'Job Classifieds': ['job classified', 'help wanted', 'job posting', 'work opportunity'],
    'B2B Marketplace Listings': ['b2b marketplace', 'trade listing', 'wholesale listing', 'supplier directory'],
    'Pet Classifieds':    ['pet for sale', 'puppy for sale', 'kitten for sale', 'pet adoption listing', 'breeder listing'],
    'Freelance & Services Listings': ['freelancer listing', 'service provider listing', 'hire freelancer', 'local service provider'],
    'Matrimonial Classifieds': ['matrimonial listing', 'bride groom listing', 'marriage classified', 'alliance wanted'],
    'Electronics Classifieds': ['used mobile', 'used laptop', 'second hand phone', 'used electronics', 'refurbished gadget'],
    'Farm & Agricultural Listings': ['farm listing', 'tractor for sale', 'land for lease', 'crop listing', 'agricultural classified'],
  },
  'Salon & Spa': {
    'Hair Salon':         ['hair salon', 'hair styling', 'hair coloring', 'keratin', 'hair cut', 'barber', 'hair straightening', 'hair rebonding', 'hair spa'],
    'Beauty Salon':       ['beauty salon', 'facial', 'makeup artist', 'bridal makeup', 'waxing', 'threading'],
    'Nail Studio':        ['nail salon', 'nail art', 'manicure', 'pedicure', 'gel nails'],
    'Spa & Wellness':     ['spa', 'massage', 'body massage', 'aromatherapy spa', 'day spa'],
    'Aesthetic Clinic':   ['aesthetic clinic', 'skin clinic', 'laser treatment', 'dermatologist', 'medspa', 'hair transplant'],
    'Tattoo & Piercing':  ['tattoo', 'tattoo studio', 'piercing', 'body art'],
    'Home Salon Services': ['at home salon', 'home beauty service', 'doorstep salon', 'home spa', 'mobile salon', 'beauty at home'],
    'Men\'s Salon & Barber': ['men\'s salon', 'barber shop', 'men\'s grooming salon', 'beard trim', 'men\'s haircut', 'gentleman\'s salon'],
    'Bridal & Wedding Beauty': ['bridal makeup', 'bridal package', 'wedding beauty', 'bridal hair', 'mehndi artist', 'bridal styling'],
    'Ayurvedic Spa':      ['ayurvedic spa', 'ayurvedic massage', 'abhyanga', 'shirodhara', 'panchakarma treatment', 'ayurvedic facial'],
    'Kids Salon':         ['kids salon', 'children haircut', 'kids spa', 'kids grooming', 'baby haircut'],
    'Lash & Brow Studio': ['lash extension', 'brow threading', 'brow lamination', 'lash lift', 'microblading', 'lash studio', 'brow studio'],
  },
  'Schools & Universities': {
    'K-12 School':        ['primary school', 'secondary school', 'high school', 'international school', 'boarding school', 'cbse', 'icse', 'ib school'],
    'Pre-School':         ['preschool', 'play school', 'montessori', 'kindergarten', 'daycare', 'nursery school'],
    'University':         ['university', 'deemed university', 'college', 'undergraduate', 'postgraduate', 'phd'],
    'Professional Institute': ['iit', 'iim', 'nit', 'medical college', 'engineering college', 'law school', 'business school'],
    'International School': ['international school', 'ib curriculum', 'cambridge school', 'global school'],
    'Boarding School': ['boarding school', 'residential school', 'hostel school', 'live-in school'],
    'Vocational & Trade School': ['vocational school', 'trade school', 'iti', 'polytechnic', 'technical training'],
    'Online University / Distance Learning': ['online university', 'distance learning', 'ignou', 'open university', 'virtual campus'],
    'Research Institute': ['research institute', 'research lab', 'research center', 'scientific research'],
    'Medical & Law School': ['medical school', 'law school', 'dental college', 'pharmacy college', 'nursing school'],
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
    'Equipment Rental (Industrial)': ['equipment rental', 'industrial equipment rental', 'heavy equipment rental', 'construction equipment rental'],
    'Tool Rental': ['tool rental', 'power tool rental', 'tool hire', 'rent tools'],
    'Storage & Self-Storage': ['self storage', 'storage unit', 'storage facility', 'mini storage', 'climate controlled storage'],
    'Machinery Rental': ['machinery rental', 'crane rental', 'forklift rental', 'plant hire', 'machinery hire'],
    'Book & Library Subscription': ['book subscription', 'book rental', 'library subscription', 'book box', 'reading subscription'],
    'Toy Rental':         ['toy rental', 'toy subscription', 'toy library', 'rent toys', 'toy box subscription'],
    'Camera & Photography Rental': ['camera rental', 'lens rental', 'photography equipment rental', 'rent camera', 'drone rental'],
    'Clothing Rental':    ['clothing rental', 'wardrobe rental', 'outfit rental', 'designer rental', 'sustainable fashion rental'],
    'Subscription Snack Box': ['snack box', 'snack subscription', 'food subscription box', 'curated snack', 'monthly snack'],
    'Beauty Box Subscription': ['beauty box', 'beauty subscription', 'makeup box', 'skincare subscription', 'sample box'],
  },
  'Aerospace & Defense': {
    'Aircraft Manufacturing': ['aircraft manufacturing', 'airframe', 'fuselage', 'wing assembly', 'aircraft assembly'],
    'Defense Electronics': ['defense electronics', 'military radar', 'avionics', 'electronic warfare', 'defense sensor'],
    'Missiles & Weapons Systems': ['missile system', 'weapons system', 'guided munition', 'ballistic missile', 'defense ordnance'],
    'Space Launch & Satellites': ['satellite launch', 'launch vehicle', 'space launch', 'rocket propulsion', 'payload delivery'],
    'Aviation MRO (Maintenance, Repair, Overhaul)': ['aviation mro', 'aircraft maintenance', 'engine overhaul', 'aircraft repair', 'mro services'],
    'Unmanned Systems (Military Drones)': ['military drone', 'unmanned aerial vehicle', 'uav defense', 'combat drone', 'surveillance drone'],
    'Defense Consulting': ['defense consulting', 'defense advisory', 'military consulting', 'defense strategy', 'defense procurement'],
  },
  'AI & Data Science': {
    'Generative AI': ['generative ai', 'gen ai', 'text generation', 'image generation', 'ai content creation'],
    'Computer Vision': ['computer vision', 'image recognition', 'object detection', 'facial recognition', 'visual ai'],
    'NLP & Conversational AI': ['nlp', 'natural language processing', 'conversational ai', 'chatbot', 'voice assistant'],
    'Machine Learning Platforms': ['machine learning platform', 'ml platform', 'model training', 'automl', 'mlops'],
    'Data Labeling & Annotation': ['data labeling', 'data annotation', 'training data', 'labeled dataset', 'annotation tool'],
    'Predictive Analytics': ['predictive analytics', 'forecasting', 'demand prediction', 'predictive model', 'trend analysis'],
    'AI Infrastructure & Compute': ['ai infrastructure', 'gpu cloud', 'ai compute', 'training cluster', 'inference engine'],
    'Responsible AI & Ethics Tools': ['responsible ai', 'ai ethics', 'bias detection', 'fairness in ai', 'explainable ai'],
  },
  'Airlines & Aviation': {
    'Full-Service Airlines': ['full service airline', 'flag carrier', 'premium airline', 'business class', 'first class'],
    'Low-Cost Carriers': ['low cost carrier', 'budget airline', 'no frills', 'cheap flights', 'lcc'],
    'Cargo Airlines': ['cargo airline', 'air freight', 'freight carrier', 'cargo charter', 'air cargo'],
    'Charter & Private Aviation': ['charter flight', 'private jet', 'private aviation', 'jet charter', 'air taxi'],
    'Airport Operations': ['airport operations', 'airport management', 'terminal', 'runway', 'air traffic control'],
    'Ground Handling': ['ground handling', 'baggage handling', 'ramp services', 'ground support', 'aircraft towing'],
    'In-Flight Services': ['in-flight service', 'in-flight entertainment', 'cabin crew', 'meal service', 'inflight wifi'],
    'Aviation Training': ['aviation training', 'flight school', 'pilot training', 'cabin crew training', 'aviation academy'],
  },
  'Aquaculture & Fisheries': {
    'Marine Fisheries': ['marine fishery', 'ocean fishing', 'trawler', 'deep sea fishing', 'commercial fishing'],
    'Inland / Freshwater Fisheries': ['freshwater fish', 'inland fishery', 'river fishing', 'lake fishing', 'pond fish'],
    'Fish Farming & Aquaculture': ['fish farming', 'aquaculture farm', 'fish pond', 'cage culture', 'recirculating aquaculture'],
    'Seafood Processing': ['seafood processing', 'fish processing', 'fish fillet', 'frozen seafood', 'canned fish'],
    'Shrimp & Shellfish': ['shrimp farming', 'shellfish', 'prawn', 'crab', 'lobster', 'shrimp hatchery'],
    'Seaweed & Algae': ['seaweed farming', 'algae cultivation', 'spirulina', 'kelp', 'seaweed extract'],
  },
  'Biotechnology': {
    'Agricultural Biotech': ['agricultural biotech', 'gmo crop', 'biotech seed', 'crop biotechnology', 'plant genetics'],
    'Biopharmaceuticals': ['biopharmaceutical', 'biologic drug', 'monoclonal antibody', 'biosimilar', 'biopharma'],
    'Genomics & Gene Therapy': ['genomics', 'gene therapy', 'gene editing', 'crispr', 'dna sequencing'],
    'Industrial Biotech': ['industrial biotech', 'enzyme technology', 'biocatalysis', 'bioprocessing', 'fermentation'],
    'Diagnostics & Biomarkers': ['diagnostics', 'biomarker', 'molecular diagnostics', 'point of care', 'diagnostic kit'],
    'Synthetic Biology': ['synthetic biology', 'synbio', 'engineered organism', 'metabolic engineering', 'dna synthesis'],
    'Stem Cell & Regenerative Medicine': ['stem cell', 'regenerative medicine', 'cell therapy', 'tissue engineering', 'cord blood'],
  },
  'Cannabis & Hemp': {
    'Medical Cannabis': ['medical cannabis', 'medical marijuana', 'cannabis prescription', 'cannabis clinic', 'therapeutic cannabis'],
    'Recreational Cannabis': ['recreational cannabis', 'recreational marijuana', 'cannabis store', 'pot shop', 'legal cannabis'],
    'CBD Products': ['cbd oil', 'cbd cream', 'cbd gummy', 'cbd tincture', 'hemp extract'],
    'Hemp Fiber & Textiles': ['hemp fiber', 'hemp textile', 'hemp fabric', 'industrial hemp', 'hemp clothing'],
    'Cannabis Dispensary': ['dispensary', 'cannabis dispensary', 'weed dispensary', 'marijuana dispensary', 'pot dispensary'],
    'Cannabis Tech / Compliance': ['cannabis compliance', 'seed to sale', 'cannabis tracking', 'cannabis software', 'cannabis regulation'],
  },
  'Chemicals & Petrochemicals': {
    'Basic & Commodity Chemicals': ['commodity chemical', 'basic chemical', 'caustic soda', 'chlor-alkali', 'sulfuric acid'],
    'Specialty Chemicals': ['specialty chemical', 'performance chemical', 'electronic chemical', 'water treatment chemical'],
    'Agrochemicals & Fertilizers': ['agrochemical', 'fertilizer', 'herbicide', 'insecticide', 'fungicide', 'crop protection'],
    'Paints & Coatings': ['paint manufacturer', 'industrial coating', 'decorative paint', 'automotive paint', 'powder coating'],
    'Adhesives & Sealants': ['adhesive manufacturer', 'sealant', 'epoxy', 'silicone sealant', 'industrial adhesive'],
    'Petrochemicals': ['petrochemical', 'ethylene', 'propylene', 'polyethylene', 'polypropylene', 'naphtha'],
    'Industrial Gases': ['industrial gas', 'oxygen', 'nitrogen', 'argon', 'hydrogen gas', 'gas cylinder'],
    'Dyes & Pigments': ['dye manufacturer', 'pigment', 'colorant', 'textile dye', 'organic pigment'],
  },
  'Cleaning & Sanitation Services': {
    'Commercial Cleaning': ['commercial cleaning', 'office cleaning', 'building cleaning', 'contract cleaning'],
    'Industrial Cleaning': ['industrial cleaning', 'tank cleaning', 'high pressure cleaning', 'factory cleaning'],
    'Disinfection & Sanitization': ['disinfection', 'sanitization', 'fogging', 'uv sanitization', 'anti-microbial'],
    'Waste Bin & Dumpster Services': ['dumpster service', 'waste bin', 'bin cleaning', 'dumpster rental', 'skip hire'],
    'Janitorial Supplies': ['janitorial supply', 'cleaning supply', 'mop', 'broom', 'cleaning chemical'],
    'Laundry & Dry Cleaning': ['laundry service', 'dry cleaning', 'laundromat', 'wash and fold', 'garment care'],
  },
  'Commodities & Trading': {
    'Agricultural Commodities': ['agricultural commodity', 'grain trading', 'wheat futures', 'corn trading', 'soybean'],
    'Metal & Mineral Trading': ['metal trading', 'copper trading', 'aluminum trading', 'iron ore trading', 'lme'],
    'Energy Trading': ['energy trading', 'crude oil trading', 'natural gas trading', 'energy futures', 'brent crude'],
    'Soft Commodities (Coffee, Cocoa, Sugar)': ['coffee trading', 'cocoa trading', 'sugar trading', 'cotton trading', 'soft commodity'],
    'Commodity Brokerage': ['commodity broker', 'futures broker', 'trading broker', 'clearing house', 'commodity fund'],
    'Commodity Exchanges': ['commodity exchange', 'ncdex', 'mcx', 'cbot', 'ice futures'],
  },
  'Data Center & Infrastructure': {
    'Colocation': ['colocation', 'colo facility', 'rack space', 'cage space', 'colocation hosting'],
    'Hyperscale Data Centers': ['hyperscale', 'hyperscale data center', 'mega data center', 'cloud data center'],
    'Edge Computing': ['edge computing', 'edge data center', 'micro data center', 'edge node', 'fog computing'],
    'Data Center Cooling': ['data center cooling', 'liquid cooling', 'immersion cooling', 'precision cooling', 'hot aisle'],
    'Power & UPS Systems': ['ups system', 'uninterruptible power', 'data center power', 'backup power', 'pdu'],
    'Network Interconnection': ['network interconnection', 'peering', 'internet exchange', 'ixp', 'cross connect'],
  },
  'Dental & Oral Care': {
    'Dental Clinic': ['dental clinic', 'dental office', 'dental practice', 'family dentist', 'dental center'],
    'Orthodontics': ['orthodontics', 'braces', 'invisalign', 'clear aligner', 'teeth straightening'],
    'Dental Implants': ['dental implant', 'tooth implant', 'implant dentistry', 'all-on-four', 'dental prosthetic'],
    'Oral Care Products': ['toothbrush', 'toothpaste', 'mouthwash', 'dental floss', 'oral hygiene'],
    'Dental Lab & Supplies': ['dental lab', 'dental supply', 'dental equipment', 'dental material', 'dental instrument'],
    'Tele-Dentistry': ['tele-dentistry', 'online dental consultation', 'virtual dentist', 'dental telehealth'],
  },
  'Education Services (Non-Digital)': {
    'Coaching Centers': ['coaching center', 'coaching institute', 'coaching classes', 'exam coaching', 'competition coaching'],
    'Tutoring (In-Person)': ['in-person tutoring', 'home tutor', 'private tutor', 'tuition teacher', 'face-to-face tutoring'],
    'Driving School': ['driving school', 'driving lessons', 'learner license', 'driving instructor', 'driving test'],
    'Music & Art Schools': ['music school', 'art school', 'dance school', 'music class', 'art class'],
    'Library & Archives': ['library', 'public library', 'archive', 'book lending', 'digital library'],
    'Educational Publishing': ['educational publisher', 'textbook publisher', 'academic publisher', 'study guide', 'workbook publisher'],
  },
  'Elderly Care & Senior Services': {
    'Home Care & Nursing': ['home care nursing', 'home nurse', 'in-home care', 'visiting nurse', 'elder home care'],
    'Assisted Living Facilities': ['assisted living', 'assisted living facility', 'senior living community', 'care home'],
    'Senior Day Care': ['senior day care', 'adult day care', 'day program', 'senior activity center'],
    'Geriatric Healthcare': ['geriatric', 'geriatrician', 'elderly healthcare', 'senior health checkup'],
    'Mobility Aids & Equipment': ['mobility aid', 'wheelchair', 'walker', 'mobility scooter', 'stair lift'],
    'Senior Tech & Apps': ['senior tech', 'elder tech', 'senior app', 'fall detection', 'medical alert'],
  },
  'Environmental & Waste Management': {
    'Waste Collection & Disposal': ['waste collection', 'garbage collection', 'waste disposal', 'trash pickup', 'refuse collection'],
    'Recycling & Upcycling': ['recycling', 'upcycling', 'material recovery', 'recycled material', 'recycling plant'],
    'Hazardous Waste Treatment': ['hazardous waste', 'toxic waste', 'chemical waste', 'biohazard', 'waste treatment'],
    'E-Waste Management': ['e-waste', 'electronic waste', 'e-waste recycling', 'computer recycling', 'it asset disposal'],
    'Water Treatment & Purification': ['water treatment', 'water purification', 'effluent treatment', 'sewage treatment', 'etp'],
    'Air Quality & Emission Control': ['air quality', 'emission control', 'air purifier', 'pollution control', 'scrubber'],
    'Environmental Remediation': ['environmental remediation', 'soil remediation', 'site cleanup', 'brownfield', 'contamination'],
    'Composting & Organic Waste': ['composting', 'organic waste', 'food waste', 'compost bin', 'vermicompost'],
  },
  'Forestry & Timber': {
    'Timber Harvesting': ['timber harvesting', 'logging', 'tree felling', 'log transportation', 'wood harvesting'],
    'Sawmill & Wood Processing': ['sawmill', 'wood processing', 'lumber processing', 'wood cutting', 'timber drying'],
    'Paper & Pulp': ['paper pulp', 'paper mill', 'pulp manufacturing', 'paper production', 'kraft paper'],
    'Plywood & Engineered Wood': ['plywood', 'engineered wood', 'mdf', 'particle board', 'laminated wood'],
    'Sustainable Forestry': ['sustainable forestry', 'fsc certified', 'forest management', 'reforestation', 'tree planting'],
    'Agroforestry': ['agroforestry', 'farm forestry', 'silvopasture', 'tree crop', 'alley cropping'],
  },
  'Funeral & Memorial Services': {
    'Funeral Home': ['funeral home', 'funeral parlor', 'funeral director', 'funeral service', 'funeral chapel'],
    'Cremation Services': ['cremation', 'crematorium', 'direct cremation', 'cremation urn', 'ash scattering'],
    'Cemetery & Memorial Park': ['cemetery', 'memorial park', 'burial ground', 'grave site', 'mausoleum'],
    'Casket & Urn Manufacturing': ['casket', 'coffin', 'urn', 'burial casket', 'cremation urn'],
    'Grief Counseling': ['grief counseling', 'bereavement support', 'grief therapy', 'loss support', 'mourning'],
    'Digital Memorial & Legacy Platforms': ['digital memorial', 'online memorial', 'legacy platform', 'obituary website', 'memorial page'],
  },
  'Healthcare & Hospitals': {
    'Multi-Specialty Hospital': ['multi-specialty hospital', 'super specialty', 'tertiary care', 'hospital chain', 'corporate hospital'],
    'Single-Specialty Hospital': ['eye hospital', 'heart hospital', 'orthopedic hospital', 'cancer hospital', 'children hospital'],
    'Clinic & Polyclinic': ['clinic', 'polyclinic', 'medical center', 'health center', 'walk-in clinic'],
    'Diagnostic Lab & Imaging': ['diagnostic lab', 'pathology lab', 'radiology', 'mri', 'ct scan', 'ultrasound'],
    'Ambulance & Emergency': ['ambulance', 'emergency service', 'ems', 'emergency room', 'trauma center'],
    'Blood Bank': ['blood bank', 'blood donation', 'blood storage', 'blood transfusion', 'platelet'],
    'Home Healthcare': ['home healthcare', 'home nursing', 'home medical care', 'domiciliary care', 'patient at home'],
    'Rehabilitation Center': ['rehabilitation', 'rehab center', 'physical therapy', 'physiotherapy', 'occupational therapy'],
    'Fertility & IVF Clinic': ['fertility clinic', 'ivf', 'in vitro fertilization', 'fertility treatment', 'reproductive health'],
    'Ayurveda & Traditional Medicine': ['ayurveda', 'ayurvedic hospital', 'traditional medicine', 'naturopathy', 'unani'],
  },
  'Import/Export & Trade': {
    'Export Management': ['export management', 'export company', 'export house', 'foreign trade', 'export documentation'],
    'Import Brokerage': ['import broker', 'customs broker', 'import agent', 'import clearance', 'import duty'],
    'Free Trade Zone & SEZ': ['free trade zone', 'sez', 'special economic zone', 'ftz', 'export processing zone'],
    'Trade Finance Platforms': ['trade finance platform', 'export credit', 'trade credit', 'supply chain finance'],
    'Cross-Border Compliance': ['cross-border compliance', 'trade compliance', 'export control', 'sanctions screening'],
    'Commodity Import/Export': ['commodity import', 'commodity export', 'bulk commodity', 'trade commodity', 'raw material trade'],
  },
  'IoT & Connected Devices': {
    'Industrial IoT (IIoT)': ['industrial iot', 'iiot', 'factory iot', 'industrial sensor', 'scada'],
    'Smart Home IoT': ['smart home', 'smart thermostat', 'smart lock', 'smart plug', 'home automation'],
    'Wearable IoT': ['wearable iot', 'fitness band', 'smart wearable', 'health wearable', 'iot wearable'],
    'IoT Platforms & Middleware': ['iot platform', 'iot middleware', 'device management', 'iot cloud', 'mqtt broker'],
    'Connected Vehicles': ['connected car', 'vehicle telematics', 'obd', 'fleet iot', 'v2x'],
    'Asset Tracking & Sensors': ['asset tracking', 'gps tracker', 'rfid', 'ble beacon', 'iot sensor'],
  },
  'Luxury & Premium Goods': {
    'Luxury Watches & Accessories': ['luxury watch', 'swiss watch', 'premium accessory', 'designer accessory', 'luxury timepiece'],
    'Luxury Automobiles': ['luxury automobile', 'luxury car', 'premium vehicle', 'sports car', 'supercar'],
    'Luxury Real Estate': ['luxury real estate', 'premium property', 'penthouse', 'luxury villa', 'mansion'],
    'Luxury Travel & Concierge': ['luxury travel', 'concierge service', 'private travel', 'luxury itinerary', 'vip experience'],
    'Premium Spirits & Wines': ['premium spirits', 'fine wine', 'vintage wine', 'rare whisky', 'champagne brand'],
    'Designer Brands': ['designer brand', 'fashion house', 'luxury label', 'haute couture brand', 'premium label'],
  },
  'Marine & Shipping': {
    'Container Shipping': ['container shipping', 'container vessel', 'container line', 'teu', 'shipping container'],
    'Bulk Carriers': ['bulk carrier', 'dry bulk', 'bulk cargo', 'grain carrier', 'ore carrier'],
    'Tanker Shipping': ['tanker', 'oil tanker', 'chemical tanker', 'lng carrier', 'tanker fleet'],
    'Port & Terminal Operations': ['port operations', 'terminal operator', 'container terminal', 'port authority', 'berth'],
    'Shipbuilding & Repair': ['shipbuilding', 'shipyard', 'ship repair', 'dry dock', 'vessel construction'],
    'Cruise Lines': ['cruise line', 'cruise ship', 'ocean cruise', 'cruise vacation', 'cruise operator'],
    'Marine Equipment & Supplies': ['marine equipment', 'ship supply', 'marine engine', 'navigation equipment', 'anchor'],
    'Offshore & Subsea': ['offshore', 'subsea', 'offshore platform', 'deepwater', 'offshore drilling'],
  },
  'Mining & Quarrying': {
    'Coal Mining': ['coal mining', 'coal mine', 'coal production', 'thermal coal', 'coking coal'],
    'Metal Ore Mining (Gold, Silver, Copper, Iron)': ['gold mining', 'silver mining', 'copper mine', 'iron ore mine', 'metal ore'],
    'Stone, Sand & Gravel Quarrying': ['quarry', 'stone quarry', 'sand mining', 'gravel pit', 'aggregate quarry'],
    'Gemstone Mining': ['gemstone mining', 'diamond mine', 'ruby mine', 'sapphire mine', 'emerald mine'],
    'Mining Equipment': ['mining equipment', 'excavator', 'mining truck', 'drill rig', 'crusher'],
    'Mine Safety & Services': ['mine safety', 'mining services', 'mine rescue', 'ventilation', 'ground support'],
    'Mining Technology & Automation': ['mining technology', 'autonomous mining', 'mine automation', 'remote mining', 'digital mine'],
  },
  'Music & Audio': {
    'Music Production': ['music production', 'music producer', 'beat making', 'daw', 'music composition'],
    'Music Distribution': ['music distribution', 'digital distribution', 'music aggregator', 'distrokid', 'tunecore'],
    'Record Labels': ['record label', 'music label', 'indie label', 'major label', 'artist roster'],
    'Music Instruments & Gear': ['music instrument', 'guitar', 'piano', 'keyboard', 'drum kit', 'amplifier'],
    'Audio Engineering & Studios': ['recording studio', 'audio engineering', 'sound mixing', 'mastering studio', 'audio post'],
    'Music Education': ['music education', 'music lesson', 'music teacher', 'music theory', 'learn guitar'],
    'Music Rights & Licensing': ['music rights', 'music licensing', 'royalty', 'sync licensing', 'publishing rights'],
  },
  'Nuclear & Atomic Energy': {
    'Nuclear Power Generation': ['nuclear power plant', 'nuclear reactor', 'nuclear generation', 'pressurized water reactor'],
    'Nuclear Fuel Processing': ['nuclear fuel', 'uranium enrichment', 'fuel rod', 'nuclear fuel cycle', 'yellowcake'],
    'Nuclear Waste Management': ['nuclear waste', 'spent fuel', 'radioactive waste', 'nuclear decommissioning', 'waste repository'],
    'Nuclear Equipment & Components': ['nuclear equipment', 'reactor vessel', 'control rod', 'steam generator', 'nuclear valve'],
    'Radiation Detection & Safety': ['radiation detection', 'dosimeter', 'radiation safety', 'nuclear safety', 'geiger counter'],
  },
  'Outdoor Advertising & Signage': {
    'Billboard & OOH Advertising': ['billboard', 'ooh advertising', 'out of home', 'outdoor media', 'hoarding'],
    'Digital Signage': ['digital signage', 'led display', 'video wall', 'digital billboard', 'interactive kiosk'],
    'Transit Advertising': ['transit advertising', 'bus advertising', 'metro advertising', 'taxi advertising', 'airport advertising'],
    'Mall & Retail Signage': ['mall signage', 'retail signage', 'in-store display', 'pop display', 'retail media'],
    'LED & Neon Signage': ['led sign', 'neon sign', 'illuminated sign', 'channel letter', 'backlit sign'],
    'Vehicle Wraps & Fleet Graphics': ['vehicle wrap', 'fleet graphics', 'car wrap', 'truck wrap', 'mobile advertising'],
  },
  'Pharmaceuticals': {
    'Generic Drugs': ['generic drug', 'generic medicine', 'off-patent', 'generic pharma', 'generic manufacturer'],
    'Branded / Patented Drugs': ['branded drug', 'patented drug', 'innovator drug', 'brand name medicine', 'pharma brand'],
    'OTC (Over-the-Counter) Medicines': ['otc medicine', 'over the counter', 'self-medication', 'otc drug', 'non-prescription'],
    'Vaccine Manufacturing': ['vaccine', 'vaccine manufacturing', 'immunization', 'covid vaccine', 'vaccine production'],
    'API (Active Pharmaceutical Ingredient)': ['active pharmaceutical ingredient', 'api manufacturer', 'drug intermediate', 'bulk drug'],
    'CRO (Contract Research Organization)': ['cro', 'contract research', 'clinical trial management', 'clinical research organization'],
    'CDMO (Contract Development & Manufacturing)': ['cdmo', 'contract manufacturing', 'pharma manufacturing', 'drug manufacturing'],
    'Veterinary Pharmaceuticals': ['veterinary pharma', 'animal drug', 'vet medicine', 'livestock drug', 'pet medication'],
  },
  'Photography & Videography': {
    'Portrait & Family Photography': ['portrait photography', 'family photography', 'newborn photography', 'maternity photo'],
    'Commercial Photography': ['commercial photography', 'product photography', 'food photography', 'advertising photography'],
    'Event & Wedding Photography': ['event photography', 'wedding photography', 'party photography', 'corporate event photo'],
    'Drone Photography & Videography': ['drone photography', 'aerial photography', 'drone videography', 'aerial video'],
    'Photo Editing & Retouching': ['photo editing', 'retouching', 'photo post-processing', 'lightroom', 'photoshop editing'],
    'Stock Photography': ['stock photography', 'stock photo', 'stock image', 'photo library', 'image licensing'],
    'Video Production & Editing': ['video production', 'video editing', 'video post-production', 'video content creation'],
  },
  'Private Equity & Venture Capital': {
    'Venture Capital': ['venture capital', 'vc fund', 'startup funding', 'seed funding', 'series a'],
    'Growth Equity': ['growth equity', 'growth stage', 'expansion capital', 'growth fund', 'late stage'],
    'Buyout / Private Equity': ['buyout', 'leveraged buyout', 'lbo', 'private equity fund', 'pe firm'],
    'Angel Investing & Syndicates': ['angel investor', 'angel network', 'syndicate investing', 'angel round', 'seed investor'],
    'Fund-of-Funds': ['fund of funds', 'fof', 'multi-manager', 'fund allocation', 'lp commitment'],
    'Impact Investing': ['impact investing', 'social impact fund', 'esg fund', 'impact capital', 'blended finance'],
  },
  'Publishing & Books': {
    'Book Publishing (Fiction & Non-Fiction)': ['book publisher', 'fiction publisher', 'non-fiction publisher', 'bestselling author', 'literary fiction', 'book imprint'],
    'Academic Publishing': ['academic publishing', 'journal publisher', 'research paper', 'scholarly article', 'peer review'],
    'Self-Publishing Platforms': ['self-publishing', 'indie author', 'amazon kdp', 'self-publish', 'ebook publishing'],
    'Magazine & Periodical Publishing': ['magazine', 'periodical', 'monthly magazine', 'trade magazine', 'consumer magazine'],
    'Digital Publishing': ['digital publishing', 'ebook', 'digital magazine', 'online publication', 'digital content'],
    'Comic & Graphic Novel': ['comic book', 'graphic novel', 'manga', 'comic publisher', 'comic series'],
  },
  'Railways & Metro': {
    'Passenger Rail': ['passenger rail', 'passenger train', 'intercity rail', 'rail travel', 'train ticket'],
    'Freight Rail': ['freight rail', 'rail freight', 'cargo train', 'rail logistics', 'freight car'],
    'Metro & Subway': ['metro', 'subway', 'underground', 'metro rail', 'rapid transit'],
    'High-Speed Rail': ['high-speed rail', 'bullet train', 'hsr', 'maglev', 'fast train'],
    'Railway Equipment & Rolling Stock': ['rolling stock', 'locomotive', 'rail car', 'coach', 'bogie'],
    'Rail Infrastructure & Signaling': ['rail infrastructure', 'rail signaling', 'track laying', 'rail switch', 'interlocking'],
  },
  'Robotics & Automation': {
    'Industrial Robotics': ['industrial robot', 'robotic arm', 'manufacturing robot', 'welding robot', 'assembly robot'],
    'Service Robots': ['service robot', 'delivery robot', 'cleaning robot', 'hospitality robot', 'reception robot'],
    'Agricultural Robots': ['agricultural robot', 'harvesting robot', 'weeding robot', 'pruning robot', 'farm automation'],
    'Surgical & Medical Robots': ['surgical robot', 'da vinci', 'medical robot', 'robotic surgery', 'tele-surgery'],
    'Warehouse & Logistics Automation': ['warehouse automation', 'amr', 'agv', 'pick and place', 'sortation'],
    'Robotic Process Automation (RPA)': ['rpa', 'robotic process automation', 'software robot', 'automation bot', 'uipath'],
    'Collaborative Robots (Cobots)': ['cobot', 'collaborative robot', 'human-robot collaboration', 'safe robot', 'lightweight robot'],
  },
  'Rubber, Plastics & Composites': {
    'Tire Manufacturing': ['tire manufacturing', 'tyre maker', 'tire production', 'radial tire', 'tire plant'],
    'Plastic Packaging': ['plastic packaging', 'flexible packaging', 'rigid packaging', 'pet bottle', 'blister pack'],
    'Industrial Rubber Products': ['rubber product', 'rubber hose', 'rubber seal', 'o-ring', 'rubber gasket'],
    'PVC & Polymer Products': ['pvc product', 'pvc pipe', 'polymer product', 'hdpe', 'ldpe'],
    'Composites & Fiber-Reinforced Plastics': ['composite material', 'frp', 'carbon fiber', 'glass fiber', 'fiber reinforced'],
    'Biodegradable Plastics': ['biodegradable plastic', 'compostable packaging', 'pla', 'bioplastic', 'eco-friendly plastic'],
  },
  'Semiconductor & Chips': {
    'Chip Design (Fabless)': ['chip design', 'fabless', 'ic design', 'asic design', 'soc design'],
    'Foundry / Fabrication': ['semiconductor foundry', 'wafer fabrication', 'chip fabrication', 'tsmc', 'fab'],
    'Memory & Storage Chips': ['memory chip', 'dram', 'nand flash', 'sram', 'storage chip'],
    'Analog & Mixed-Signal': ['analog chip', 'mixed-signal', 'analog semiconductor', 'power management ic'],
    'Semiconductor Equipment': ['semiconductor equipment', 'lithography', 'etching', 'deposition', 'wafer inspection'],
    'Packaging & Testing (OSAT)': ['osat', 'chip packaging', 'semiconductor testing', 'wire bonding', 'flip chip'],
    'EDA (Electronic Design Automation)': ['eda', 'electronic design automation', 'cadence', 'synopsys', 'chip simulation'],
  },
  'Space & Satellite': {
    'Satellite Manufacturing': ['satellite manufacturing', 'satellite builder', 'satellite assembly', 'small satellite'],
    'Satellite Communications': ['satellite communication', 'satcom', 'vsat', 'satellite broadband', 'ku band'],
    'Earth Observation & Remote Sensing': ['earth observation', 'remote sensing', 'satellite imagery', 'geospatial', 'sar satellite'],
    'Space Launch Services': ['space launch', 'launch service', 'rocket launch', 'launch provider', 'reusable rocket'],
    'Space Tourism': ['space tourism', 'suborbital flight', 'space travel', 'commercial spaceflight', 'space experience'],
    'Satellite Internet (LEO)': ['satellite internet', 'leo satellite', 'starlink', 'low earth orbit', 'broadband satellite'],
    'Space Debris Management': ['space debris', 'orbital debris', 'debris removal', 'space sustainability', 'deorbit'],
  },
  'Staffing & Workforce Solutions': {
    'Temporary Staffing': ['temporary staffing', 'temp agency', 'temp worker', 'contingent workforce', 'temp to perm'],
    'Permanent Placement': ['permanent placement', 'direct hire', 'full-time placement', 'permanent recruitment'],
    'Executive Search': ['executive search', 'headhunter', 'c-suite hiring', 'retained search', 'leadership hiring'],
    'RPO (Recruitment Process Outsourcing)': ['rpo', 'recruitment outsourcing', 'talent acquisition outsourcing', 'hiring partner'],
    'Blue-Collar Staffing': ['blue collar staffing', 'labor staffing', 'factory worker', 'warehouse staffing', 'construction labor'],
    'Gig Economy Platforms': ['gig economy', 'gig platform', 'freelance marketplace', 'on-demand worker', 'gig worker'],
    'Employer of Record (EOR)': ['employer of record', 'eor', 'global payroll', 'hire globally', 'international employment'],
  },
  'Sustainability & ESG': {
    'Carbon Accounting & Reporting': ['carbon accounting', 'carbon reporting', 'ghg emissions', 'scope 1', 'scope 2', 'scope 3'],
    'ESG Consulting': ['esg consulting', 'esg advisory', 'sustainability consulting', 'esg strategy', 'esg compliance'],
    'Circular Economy Solutions': ['circular economy', 'product lifecycle', 'take-back program', 'refurbishment', 'resource recovery'],
    'Sustainable Supply Chain': ['sustainable supply chain', 'ethical sourcing', 'supply chain transparency', 'fair trade supply'],
    'Green Building & Certification': ['green building', 'leed certified', 'igbc', 'green certification', 'energy efficient building'],
    'Climate Tech': ['climate tech', 'carbon capture', 'direct air capture', 'climate solution', 'decarbonization'],
    'Biodiversity & Ecosystem Services': ['biodiversity', 'ecosystem services', 'habitat restoration', 'conservation finance'],
  },
  'Textiles & Fabrics': {
    'Cotton & Natural Fibers': ['cotton', 'natural fiber', 'silk', 'wool', 'linen', 'jute'],
    'Synthetic Fibers': ['synthetic fiber', 'polyester', 'nylon', 'acrylic', 'spandex', 'viscose'],
    'Technical Textiles': ['technical textile', 'geotextile', 'medical textile', 'protective textile', 'automotive textile'],
    'Dyeing & Finishing': ['dyeing', 'textile finishing', 'fabric dyeing', 'bleaching', 'mercerizing'],
    'Knitting & Weaving': ['knitting', 'weaving', 'loom', 'knit fabric', 'woven fabric'],
    'Home Textiles': ['home textile', 'bed linen', 'curtain fabric', 'upholstery', 'towel manufacturing'],
    'Nonwoven Fabrics': ['nonwoven', 'spunbond', 'meltblown', 'needle punch', 'nonwoven fabric'],
  },
  'Tourism & Destination Management': {
    'Inbound Tourism': ['inbound tourism', 'incoming tour', 'destination service', 'receptive tourism'],
    'Outbound Tourism': ['outbound tourism', 'international tour', 'holiday abroad', 'overseas travel'],
    'Adventure Tourism': ['adventure tourism', 'trekking', 'rafting', 'bungee jumping', 'safari'],
    'Medical Tourism': ['medical tourism', 'health tourism', 'treatment abroad', 'medical travel'],
    'Eco-Tourism': ['eco-tourism', 'ecotourism', 'nature tourism', 'sustainable tourism', 'green tourism'],
    'Heritage & Cultural Tourism': ['heritage tourism', 'cultural tourism', 'historical tour', 'heritage walk', 'cultural experience'],
    'Pilgrimage Tourism': ['pilgrimage tourism', 'religious tourism', 'sacred site', 'pilgrimage tour', 'holy trip'],
    'Destination Marketing Organization': ['destination marketing', 'dmo', 'tourism board', 'tourism promotion', 'visit'],
  },
  'Veterinary & Animal Health': {
    'Veterinary Clinic': ['vet clinic', 'veterinary clinic', 'animal clinic', 'pet doctor', 'vet practice'],
    'Animal Hospital': ['animal hospital', 'veterinary hospital', 'emergency vet', '24 hour vet'],
    'Veterinary Diagnostics': ['veterinary diagnostics', 'animal lab', 'vet lab', 'animal pathology'],
    'Animal Feed & Nutrition': ['animal feed', 'livestock feed', 'poultry feed', 'cattle feed', 'fish feed'],
    'Livestock Health': ['livestock health', 'cattle health', 'herd management', 'dairy health', 'livestock vaccine'],
    'Equine Services': ['equine', 'horse care', 'equine vet', 'horse health', 'equestrian'],
    'Veterinary Pharmaceuticals': ['vet pharma', 'animal drug', 'veterinary medicine', 'animal vaccine', 'antiparasitic'],
  },
  'Video & Film Production': {
    'Feature Film Production': ['feature film', 'film production', 'movie production', 'film studio', 'motion picture'],
    'TV & Series Production': ['tv production', 'series production', 'tv show', 'episodic content', 'showrunner'],
    'Documentary': ['documentary', 'docuseries', 'investigative documentary', 'nature documentary'],
    'Corporate & Brand Video': ['corporate video', 'brand film', 'promotional video', 'explainer video', 'testimonial video'],
    'Post-Production & VFX': ['post-production', 'vfx', 'visual effects', 'color grading', 'compositing'],
    'Dubbing & Localization': ['dubbing', 'voice over', 'localization', 'subtitle', 'language dubbing'],
    'Film Distribution & Sales': ['film distribution', 'film sales', 'theatrical release', 'streaming rights', 'content licensing'],
  },
  'Water & Sanitation': {
    'Municipal Water Supply': ['municipal water', 'water supply', 'city water', 'public water', 'water authority'],
    'Water Purification & Filtration': ['water purifier', 'water filter', 'ro system', 'water filtration', 'uv water purifier'],
    'Desalination': ['desalination', 'desalination plant', 'sea water conversion', 'reverse osmosis desalination'],
    'Wastewater Treatment': ['wastewater treatment', 'sewage treatment', 'stp', 'wastewater recycling', 'effluent'],
    'Water Infrastructure': ['water pipeline', 'water infrastructure', 'water main', 'aqueduct', 'water distribution'],
    'Bottled & Packaged Water': ['bottled water', 'packaged water', 'mineral water', 'spring water', 'purified water'],
    'Smart Water Meters & IoT': ['smart water meter', 'water iot', 'water monitoring', 'water analytics', 'leak detection'],
  },
  'Wealth & Asset Management': {
    'Mutual Funds & ETFs': ['mutual fund', 'etf', 'index fund', 'fund house', 'amc'],
    'Hedge Funds': ['hedge fund', 'absolute return', 'long short', 'macro fund', 'quant fund'],
    'Family Office': ['family office', 'single family office', 'multi family office', 'wealth advisory'],
    'Real Estate Funds': ['real estate fund', 'reit', 'property fund', 'real estate investment trust'],
    'Pension & Retirement Funds': ['pension fund', 'retirement fund', 'superannuation', 'provident fund', '401k'],
    'Portfolio Management Platforms': ['portfolio management', 'investment platform', 'wealth platform', 'portfolio tracker'],
    'Alternative Investments': ['alternative investment', 'private credit', 'infrastructure fund', 'commodities fund'],
  },
  'Wellness Tourism & Retreats': {
    'Yoga & Meditation Retreats': ['yoga retreat', 'meditation retreat', 'yoga holiday', 'yoga teacher training'],
    'Detox & Cleanse Programs': ['detox program', 'cleanse program', 'juice cleanse', 'fasting retreat'],
    'Hot Springs & Thermal Spas': ['hot springs', 'thermal spa', 'onsen', 'thermal bath', 'mineral spa'],
    'Ayurveda Retreats': ['ayurveda retreat', 'panchakarma', 'ayurvedic treatment', 'ayurveda wellness'],
    'Weight Management Camps': ['weight management camp', 'weight loss retreat', 'fitness camp', 'boot camp'],
    'Silent & Digital Detox Retreats': ['silent retreat', 'digital detox', 'vipassana', 'mindfulness retreat'],
  },
  'Wire, Cable & Electrical': {
    'Power Cables': ['power cable', 'high voltage cable', 'low voltage cable', 'armored cable', 'xlpe cable'],
    'Communication Cables': ['communication cable', 'ethernet cable', 'coaxial cable', 'data cable', 'network cable'],
    'Fiber Optic Cable': ['fiber optic', 'optical fiber', 'fiber cable', 'single mode fiber', 'multi mode fiber'],
    'Switchgear & Panels': ['switchgear', 'electrical panel', 'distribution board', 'motor control center', 'mcc'],
    'Transformers': ['transformer', 'power transformer', 'distribution transformer', 'voltage regulator'],
    'Electrical Connectors': ['electrical connector', 'terminal', 'plug', 'socket connector', 'crimp terminal'],
    'Wire Harnesses': ['wire harness', 'cable assembly', 'wiring loom', 'harness assembly', 'automotive harness'],
  },
  'AR / VR & Metaverse': {
    'Virtual Reality Hardware': ['vr headset', 'vr hardware', 'oculus', 'meta quest', 'vr controller'],
    'Augmented Reality Apps & SDKs': ['ar app', 'ar sdk', 'arkit', 'arcore', 'augmented reality app'],
    'Mixed Reality (MR) Solutions': ['mixed reality', 'mr headset', 'hololens', 'spatial display', 'mr solution'],
    'Metaverse Platforms & Virtual Worlds': ['metaverse platform', 'virtual world', 'decentraland', 'sandbox', 'roblox'],
    'Spatial Computing': ['spatial computing', 'spatial tracking', '3d mapping', 'room-scale vr', 'lidar mapping'],
    'Immersive Training & Simulation': ['vr training', 'immersive simulation', 'virtual training', 'xr training', 'flight simulator'],
    'Virtual Events & Conferences': ['virtual event', 'virtual conference', 'vr meeting', 'virtual expo', 'online summit'],
  },
  'Quantum Computing': {
    'Quantum Hardware': ['quantum hardware', 'quantum processor', 'qubit', 'cryogenic', 'quantum chip'],
    'Quantum Software & Algorithms': ['quantum software', 'quantum algorithm', 'quantum circuit', 'qiskit', 'cirq'],
    'Quantum-as-a-Service (QaaS)': ['quantum as a service', 'qaas', 'cloud quantum', 'quantum cloud', 'quantum access'],
    'Quantum Cryptography & Security': ['quantum cryptography', 'quantum key distribution', 'qkd', 'post-quantum', 'quantum safe'],
    'Quantum Networking': ['quantum networking', 'quantum internet', 'quantum repeater', 'entanglement distribution'],
    'Quantum Sensing': ['quantum sensing', 'quantum sensor', 'quantum magnetometer', 'quantum gravimeter'],
  },
  'Creator Economy & Influencer': {
    'Influencer Marketing Platforms': ['influencer marketing', 'influencer platform', 'influencer campaign', 'brand collaboration'],
    'Creator Monetization Tools': ['creator monetization', 'tip jar', 'creator fund', 'fan subscription', 'paid content'],
    'Fan Engagement & Membership Platforms (e.g., Patreon)': ['patreon', 'membership platform', 'fan club', 'creator membership', 'fan engagement'],
    'UGC (User-Generated Content) Platforms': ['ugc platform', 'user generated content', 'content submission', 'community content'],
    'Talent Management for Creators': ['talent management', 'creator management', 'influencer agent', 'creator agency'],
    'Creator Analytics': ['creator analytics', 'social analytics', 'audience insight', 'content performance', 'engagement rate'],
    'Livestream Commerce Platforms': ['livestream commerce', 'live shopping', 'shoppable livestream', 'live selling'],
  },
  'Halal Economy & Islamic Services': {
    'Halal Food & Certification': ['halal food', 'halal certification', 'halal certified', 'halal label', 'halal authority'],
    'Islamic Finance & Takaful (Islamic Insurance)': ['islamic finance', 'takaful', 'sukuk', 'murabaha', 'islamic insurance'],
    'Halal Cosmetics & Personal Care': ['halal cosmetics', 'halal skincare', 'halal personal care', 'halal beauty'],
    'Halal Tourism & Travel': ['halal tourism', 'halal travel', 'muslim-friendly hotel', 'halal holiday', 'halal dining'],
    'Halal Pharmaceuticals': ['halal pharma', 'halal medicine', 'halal supplement', 'gelatin-free medicine'],
    'Modest Fashion': ['modest fashion', 'hijab', 'abaya', 'modest wear', 'islamic clothing'],
    'Islamic EdTech & Digital Quran': ['islamic edtech', 'digital quran', 'quran app', 'islamic learning', 'hadith app'],
    'Zakat & Waqf Platforms': ['zakat', 'waqf', 'sadaqah', 'islamic charity', 'zakat calculator'],
  },
  'Handicrafts & Artisanal Goods': {
    'Handmade Textiles & Weaving': ['handloom', 'handwoven', 'handmade textile', 'hand embroidery', 'ikat'],
    'Pottery & Ceramics': ['pottery', 'ceramic art', 'handmade pottery', 'terracotta', 'stoneware'],
    'Woodwork & Carving': ['woodwork', 'wood carving', 'handmade furniture', 'wooden craft', 'inlay work'],
    'Metalwork & Copperware': ['metalwork', 'copperware', 'brass craft', 'metal art', 'wrought iron'],
    'Basket Weaving & Natural Fiber Crafts': ['basket weaving', 'cane craft', 'bamboo craft', 'natural fiber', 'jute craft'],
    'Artisanal Food & Beverages': ['artisanal food', 'artisan cheese', 'craft chocolate', 'artisan bread', 'small batch'],
    'Fair Trade & Ethical Craft Platforms': ['fair trade', 'ethical craft', 'craft marketplace', 'artisan marketplace', 'handmade marketplace'],
  },
  'Amusement & Entertainment Venues': {
    'Theme Parks & Amusement Parks': ['theme park', 'amusement park', 'amusement ride', 'roller coaster', 'attraction'],
    'Water Parks': ['water park', 'water slide', 'wave pool', 'lazy river', 'splash pad'],
    'Arcades & Gaming Centers': ['arcade', 'gaming center', 'game zone', 'laser tag', 'virtual reality arcade'],
    'Bowling Alleys & Entertainment Centers': ['bowling alley', 'entertainment center', 'bowling lane', 'family entertainment'],
    'Escape Rooms & Immersive Experiences': ['escape room', 'immersive experience', 'puzzle room', 'mystery room'],
    'Cinema & Movie Theaters': ['cinema', 'movie theater', 'multiplex', 'imax', 'film screening'],
    'Live Performance Venues (Theater, Comedy)': ['live performance', 'theater venue', 'comedy club', 'concert hall', 'performing arts'],
  },
  'Museums, Heritage & Culture': {
    'Art Museums & Galleries': ['art museum', 'art gallery', 'contemporary art gallery', 'modern art museum'],
    'Science & Technology Museums': ['science museum', 'technology museum', 'interactive museum', 'discovery center'],
    'History & Heritage Museums': ['history museum', 'heritage museum', 'war museum', 'maritime museum', 'folk museum'],
    'Cultural Centers & Institutes': ['cultural center', 'cultural institute', 'arts council', 'cultural foundation'],
    'Planetariums & Observatories': ['planetarium', 'observatory', 'astronomy center', 'star gazing', 'dome theater'],
    'Digital / Virtual Museums': ['virtual museum', 'digital museum', 'online exhibition', 'virtual tour', '3d gallery'],
    'Heritage Conservation & Restoration': ['heritage conservation', 'restoration', 'monument conservation', 'heritage site'],
  },
  'Debt, Credit & Collections': {
    'Credit Bureau & Scoring': ['credit bureau', 'credit score', 'credit report', 'credit rating', 'cibil'],
    'Debt Collection Agencies': ['debt collection', 'collections agency', 'debt recovery', 'overdue account', 'debt collector'],
    'Debt Consolidation Services': ['debt consolidation', 'debt management', 'debt restructuring', 'consolidation loan'],
    'Credit Repair & Counseling': ['credit repair', 'credit counseling', 'credit restoration', 'improve credit score'],
    'Factoring & Invoice Financing': ['factoring', 'invoice financing', 'invoice factoring', 'receivables financing', 'supply chain finance'],
    'Asset Recovery': ['asset recovery', 'asset tracing', 'repossession', 'debt asset', 'recovery service'],
  },
  'Personal & Domestic Services': {
    'Tailoring & Alterations': ['tailoring', 'alteration', 'custom tailor', 'bespoke tailoring', 'dress alteration'],
    'Shoe Repair & Cobbler': ['cobbler', 'shoe repair', 'shoe restoration', 'heel replacement', 'shoe shine'],
    'Locksmith Services': ['locksmith', 'lock repair', 'key cutting', 'lock installation', 'emergency locksmith'],
    'Personal Concierge': ['personal concierge', 'lifestyle concierge', 'concierge service', 'personal assistant service'],
    'Domestic Help & Housekeeping Agencies': ['domestic help', 'housekeeping agency', 'maid service', 'nanny agency', 'cook placement'],
    'Errand & Task Services (TaskRabbit-type)': ['errand service', 'task service', 'taskrabbit', 'handyman app', 'odd jobs'],
    'Personal Styling & Image Consulting': ['personal stylist', 'image consultant', 'wardrobe consultant', 'style advisor'],
  },
  'Cooperatives & Community Commerce': {
    'Agricultural Cooperatives': ['agricultural cooperative', 'farmer cooperative', 'farm co-op', 'producer organization'],
    'Consumer Cooperatives': ['consumer cooperative', 'consumer co-op', 'buying club', 'retail cooperative'],
    'Credit Unions & Financial Cooperatives': ['credit union', 'financial cooperative', 'savings cooperative', 'thrift society'],
    'Housing Cooperatives': ['housing cooperative', 'housing co-op', 'co-op apartment', 'cooperative housing society'],
    'Worker Cooperatives': ['worker cooperative', 'worker co-op', 'employee-owned', 'democratic workplace'],
    'Energy Cooperatives': ['energy cooperative', 'community energy', 'solar cooperative', 'wind co-op', 'community solar'],
  },
  'Sharing & Peer-to-Peer Economy': {
    'Home Sharing & Short-Term Rentals': ['home sharing', 'short-term rental', 'vacation rental', 'airbnb host', 'guest rental'],
    'Car Sharing & Peer-to-Peer Vehicle Rental': ['car sharing', 'p2p car rental', 'peer car', 'turo', 'getaround'],
    'Skill & Service Sharing': ['skill sharing', 'service sharing', 'freelance marketplace', 'fiverr', 'upwork'],
    'Co-Ownership Platforms': ['co-ownership', 'fractional ownership', 'shared ownership', 'timeshare', 'fractional property'],
    'Peer-to-Peer Lending': ['p2p lending', 'peer lending', 'marketplace lending', 'social lending', 'crowdlending'],
    'Tool & Equipment Sharing': ['tool sharing', 'equipment sharing', 'neighbor lending', 'community tool library'],
  },
  'International & Diplomatic Organizations': {
    'Embassies & Consulates': ['embassy', 'consulate', 'diplomatic mission', 'foreign embassy', 'consular service'],
    'United Nations Agencies': ['united nations', 'un agency', 'unicef', 'unhcr', 'undp', 'who'],
    'Multilateral Development Banks': ['world bank', 'imf', 'adb', 'development bank', 'multilateral bank'],
    'International Trade Bodies (WTO, WIPO)': ['wto', 'wipo', 'trade body', 'international trade organization'],
    'International NGOs & Aid Agencies': ['international ngo', 'aid agency', 'oxfam', 'red cross', 'save the children'],
    'Intergovernmental Organizations': ['intergovernmental', 'igo', 'asean', 'african union', 'european union', 'g20'],
  },
  'Sports Leagues & Professional Sports': {
    'Football / Soccer Clubs & Leagues': ['football club', 'soccer club', 'premier league', 'la liga', 'bundesliga', 'serie a'],
    'Basketball (NBA, FIBA)': ['basketball league', 'nba', 'fiba', 'basketball club', 'basketball association'],
    'Cricket (IPL, ICC)': ['cricket league', 'ipl', 'icc', 'cricket board', 'test cricket', 't20'],
    'Baseball & Softball': ['baseball', 'mlb', 'softball', 'baseball league', 'minor league'],
    'Tennis & Racquet Sports': ['tennis', 'atp', 'wta', 'grand slam', 'badminton league', 'squash'],
    'Motorsport & Racing': ['motorsport', 'formula 1', 'f1', 'nascar', 'motogp', 'rally racing'],
    'Olympic & Multi-Sport Organizations': ['olympic', 'olympics', 'ioc', 'commonwealth games', 'asian games'],
    'Sports Media & Broadcasting Rights': ['sports broadcasting', 'sports rights', 'broadcast deal', 'sports media'],
    'Sports Sponsorship & Merchandising': ['sports sponsorship', 'sports merchandise', 'team jersey', 'fan store', 'sports apparel'],
  },
  'Mobile Money & Agent Banking': {
    'Mobile Money Platforms (M-Pesa, GCash)': ['mobile money', 'm-pesa', 'gcash', 'mobile payment', 'mobile transfer'],
    'Agent Banking Networks': ['agent banking', 'banking agent', 'correspondent banking', 'agent network'],
    'USSD-Based Financial Services': ['ussd banking', 'ussd payment', 'mobile banking ussd', 'feature phone banking'],
    'Airtime & Top-Up Services': ['airtime', 'top-up', 'mobile recharge', 'prepaid recharge', 'airtime transfer'],
    'Rural & Unbanked Financial Access': ['unbanked', 'financial inclusion', 'rural banking', 'underserved', 'last mile banking'],
    'Mobile Savings & Micro-Insurance': ['mobile savings', 'micro-insurance', 'mobile insurance', 'micro savings'],
  },
  'Precious Metals, Gems & Bullion': {
    'Gold Trading & Refining': ['gold trading', 'gold refining', 'gold dealer', 'gold smelting', 'gold hallmark'],
    'Diamond Cutting & Trading': ['diamond cutting', 'diamond trading', 'diamond polishing', 'loose diamond', 'diamond dealer'],
    'Platinum & Palladium': ['platinum', 'palladium', 'platinum trading', 'pgm', 'precious metal trading'],
    'Precious Metal ETFs & Vaults': ['gold etf', 'precious metal etf', 'gold vault', 'bullion storage', 'allocated gold'],
    'Gemstone Mining & Grading': ['gemstone grading', 'gem mining', 'gemological', 'gia certified', 'gem appraisal'],
    'Bullion Dealers & Exchanges': ['bullion dealer', 'gold exchange', 'silver exchange', 'bullion market', 'gold coin dealer'],
  },
  'Postal & Mail Services': {
    'National Postal Services (USPS, Royal Mail, India Post, etc.)': ['postal service', 'post office', 'national mail', 'government postal'],
    'International Mail & Parcel': ['international mail', 'international parcel', 'cross-border mail', 'ems', 'registered mail'],
    'PO Box & Mailbox Services': ['po box', 'mailbox rental', 'virtual mailbox', 'mail forwarding', 'private mailbox'],
    'Direct Mail & Bulk Mailing': ['direct mail', 'bulk mail', 'mass mailing', 'marketing mail', 'mail campaign'],
    'Postal Technology & Automation': ['postal automation', 'mail sorting', 'postal technology', 'automated mail'],
    'Hybrid Mail (Digital-to-Physical)': ['hybrid mail', 'digital to print', 'online postage', 'print and mail'],
  },
  'Leather & Hide Products': {
    'Leather Tanning & Finishing': ['leather tanning', 'tannery', 'chrome tanning', 'vegetable tanning', 'leather finishing'],
    'Leather Footwear Manufacturing': ['leather shoe', 'leather boot', 'leather footwear', 'handmade shoe'],
    'Leather Bags & Accessories': ['leather bag', 'leather wallet', 'leather belt', 'leather accessory', 'leather clutch'],
    'Leather Garments & Jackets': ['leather jacket', 'leather garment', 'leather coat', 'suede jacket'],
    'Saddlery & Harness': ['saddlery', 'horse saddle', 'leather harness', 'equestrian leather', 'bridle'],
    'Synthetic / Vegan Leather': ['vegan leather', 'synthetic leather', 'faux leather', 'pu leather', 'pleather'],
  },
  'Glass, Ceramics & Nonmetallic Minerals': {
    'Flat Glass & Safety Glass': ['flat glass', 'safety glass', 'tempered glass', 'laminated glass', 'float glass'],
    'Glass Containers & Bottles': ['glass bottle', 'glass container', 'glass jar', 'glass packaging', 'amber glass'],
    'Ceramic Tiles & Sanitaryware': ['ceramic tile', 'sanitaryware', 'bathroom ceramic', 'floor tile', 'wall tile'],
    'Porcelain & Tableware': ['porcelain', 'tableware', 'dinnerware', 'bone china', 'fine porcelain'],
    'Industrial Ceramics & Refractories': ['industrial ceramic', 'refractory', 'kiln lining', 'ceramic insulator', 'alumina'],
    'Stone Processing & Monuments': ['stone processing', 'granite cutting', 'marble polishing', 'monument', 'stone carving'],
    'Fiberglass & Insulation': ['fiberglass', 'glass wool', 'insulation material', 'thermal insulation', 'rockwool'],
  },
  'Wholesale & Distribution': {
    'General Merchandise Wholesale': ['general merchandise', 'wholesale trader', 'wholesale supplier', 'bulk supplier'],
    'Industrial & Machinery Distribution': ['industrial distribution', 'machinery dealer', 'equipment distributor', 'spare parts dealer'],
    'Electrical & Electronics Distribution': ['electrical distributor', 'electronics wholesale', 'component distributor', 'electrical supply'],
    'Food & Beverage Wholesale': ['food wholesale', 'beverage distributor', 'food distribution', 'restaurant supply'],
    'Pharmaceutical Distribution': ['pharma distributor', 'drug distributor', 'pharmaceutical wholesale', 'medicine supply chain'],
    'Building Material Distribution': ['building material distributor', 'construction supply', 'building supply', 'hardware distribution'],
    'Chemical Distribution': ['chemical distributor', 'chemical supply', 'industrial chemical', 'chemical wholesale'],
    'Agricultural Wholesale (Mandis, Commodities)': ['agricultural wholesale', 'mandi', 'grain market', 'produce market', 'commodity market'],
  },
  'Conglomerates & Holding Companies': {
    'Diversified Industrial Conglomerates': ['diversified conglomerate', 'industrial conglomerate', 'multi-sector', 'diversified group'],
    'Family-Owned Business Groups': ['family business', 'business group', 'family conglomerate', 'family-owned', 'business dynasty'],
    'Chaebols (South Korea — Samsung, LG, Hyundai)': ['chaebol', 'korean conglomerate', 'samsung group', 'lg group', 'hyundai group'],
    'Keiretsu (Japan — Mitsubishi, Sumitomo)': ['keiretsu', 'japanese conglomerate', 'mitsubishi group', 'sumitomo', 'zaibatsu'],
    'Business Houses (India — Tata, Reliance, Adani)': ['business house', 'tata group', 'reliance industries', 'adani group', 'birla group'],
    'State-Owned Conglomerates': ['state-owned enterprise', 'soe', 'government corporation', 'public sector enterprise'],
    'Investment Holding Companies': ['investment holding', 'holding company', 'parent company', 'investment vehicle', 'shell company'],
  },
  'Professional & Trade Associations': {
    'Industry Trade Associations': ['trade association', 'industry body', 'industry group', 'trade body', 'sector association'],
    'Professional Bodies & Licensing (Bar, Medical, CPA)': ['professional body', 'bar association', 'medical council', 'cpa society', 'professional license'],
    'Chambers of Commerce': ['chamber of commerce', 'business chamber', 'trade chamber', 'commerce association'],
    'Trade Unions & Labor Organizations': ['trade union', 'labor union', 'workers union', 'collective bargaining', 'labor organization'],
    'Business Networking Groups (BNI, YPO)': ['business networking', 'bni', 'ypo', 'rotary club', 'networking group'],
    'Standards & Certification Bodies (ISO, BSI)': ['standards body', 'iso', 'bsi', 'certification body', 'quality standard'],
  },
  'Social Services & Welfare': {
    'Child Welfare & Foster Care': ['child welfare', 'foster care', 'child protection', 'orphanage', 'adoption agency'],
    'Disability Services': ['disability service', 'disabled care', 'accessibility', 'special needs', 'inclusive service'],
    'Vocational Rehabilitation': ['vocational rehabilitation', 'vocational training', 'job training', 'skills rehab'],
    'Community Food Services & Food Banks': ['food bank', 'community kitchen', 'soup kitchen', 'meal program', 'food pantry'],
    'Homeless Shelters & Housing Assistance': ['homeless shelter', 'housing assistance', 'transitional housing', 'emergency shelter'],
    'Refugee & Immigrant Services': ['refugee service', 'immigrant service', 'resettlement', 'asylum', 'migrant support'],
    'Youth Development Programs': ['youth development', 'youth program', 'after school program', 'mentorship', 'youth empowerment'],
    'Social Work Agencies': ['social work', 'social worker', 'case management', 'community outreach', 'social agency'],
  },
  'Plantation & Cash Crops': {
    'Palm Oil Plantations': ['palm oil', 'palm plantation', 'palm kernel', 'oil palm', 'cpo'],
    'Rubber Plantations': ['rubber plantation', 'natural rubber', 'rubber tapping', 'rubber estate', 'latex'],
    'Tea & Coffee Estates': ['tea estate', 'coffee estate', 'tea plantation', 'coffee plantation', 'tea garden'],
    'Sugarcane Farming & Mills': ['sugarcane', 'sugar mill', 'sugar factory', 'cane farming', 'sugar production'],
    'Cocoa & Spice Plantations': ['cocoa plantation', 'spice plantation', 'cinnamon', 'pepper plantation', 'cardamom'],
    'Cotton Farming': ['cotton farming', 'cotton field', 'cotton picking', 'raw cotton', 'cotton ginning'],
    'Tobacco Farming': ['tobacco farming', 'tobacco leaf', 'tobacco plantation', 'curing barn', 'tobacco crop'],
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
  let metaKeywords = (/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i.exec(html) || [])[1]
    || (/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i.exec(html) || [])[1] || '';

  // ── Detect and discard bogus/template meta keywords ──
  // Many Shopify/WordPress/Bootstrap themes ship with default keywords unrelated to the store.
  // Common patterns: "Best Shopify Theme", "Fashion theme, Electronics", "Starter theme", etc.
  const TEMPLATE_KEYWORD_PATTERNS = /\b(?:shopify\s+theme|wordpress\s+theme|bootstrap|html5|css3|theme\s+template|demo\s+store|starter\s+theme|theme\s+store|theme\s+design|theme\s+developer|theme\s+layout|theme\s+customization|website\s+template|landing\s+page\s+template|themeforest|envato|theme\s+preview|theme\s+demo|theme\s+documentation|theme\s+option|theme\s+setting|theme\s+feature|theme\s+support|theme\s+update|theme\s+installation|theme\s+license|theme\s+download|fashion\s+theme|electronics\s+theme|multipurpose\s+theme|responsive\s+theme|premium\s+theme|best\s+shopify|best\s+theme|theme\s+kit|theme\s+json)\b/i;
  if (TEMPLATE_KEYWORD_PATTERNS.test(metaKeywords)) {
    metaKeywords = ''; // Discard entirely — these are template defaults
  }

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

  // ── Cross-validate meta keywords against actual page content ──
  // If meta keywords claim a category (e.g. "fashion") but the actual content (nav, body,
  // title, headings) has zero corroboration, the keywords are likely template defaults.
  // Downgrade their weight to 0 in that case.
  let metaKeywordsWeight = 2;
  if (metaKeywords) {
    const mkLower = metaKeywords.toLowerCase();
    const contentText = [title, metaDesc, navText, bodyText, h1s.join(' '), h2s.join(' ')].join(' ').toLowerCase();
    // Check if meta keywords contain category-indicating words NOT found in actual content
    const MK_CATEGORY_WORDS = ['fashion', 'electronics', 'beauty', 'food', 'furniture', 'jewelry', 'health', 'sports', 'automotive', 'real estate', 'education', 'gaming'];
    const mkCategories = MK_CATEGORY_WORDS.filter(w => mkLower.includes(w));
    const contentCategories = MK_CATEGORY_WORDS.filter(w => contentText.includes(w));
    // If meta keywords claim categories that content doesn't support, discard them
    const unsupported = mkCategories.filter(c => !contentCategories.includes(c));
    if (unsupported.length > 0 && unsupported.length >= mkCategories.length * 0.5) {
      metaKeywordsWeight = 0; // Meta keywords are unreliable — ignore them
    }
  }

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
    { text: metaKeywords.toLowerCase(), weight: metaKeywordsWeight },
    { text: navText.toLowerCase(), weight: 2 },    // Boosted from 1.5 — nav is highly reliable
    { text: bodyText.toLowerCase(), weight: 1 },
    { text: altTexts.toLowerCase(), weight: 1 },
  ];

  // Word-boundary match for short keywords to avoid substring false positives
  // e.g. "ring" shouldn't match "during", "stud" shouldn't match "student"
  // IMPORTANT: Use word boundaries for ALL single-word keywords <=6 chars
  const kwMatchCache = {};
  function kwMatches(text, kw) {
    const key = text + '||' + kw;
    if (kwMatchCache[key] !== undefined) return kwMatchCache[key];
    let result;
    if (kw.length <= 6 && !/\s/.test(kw)) {
      // Short single-word keyword: require word boundary
      const rx = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      result = rx.test(text);
    } else {
      result = text.includes(kw);
    }
    kwMatchCache[key] = result;
    return result;
  }

  // Track per-industry scores AND whether the score has content corroboration
  // (i.e., matched in title, nav, body, headings — not just meta keywords)
  const contentCorroborated = {};
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    let score = 0;
    let hasContentMatch = false;
    for (const part of textParts) {
      let partScore = 0;
      for (const kw of keywords) {
        if (kwMatches(part.text, kw)) {
          partScore += part.weight;
          // Content sources: title, nav, body, headings, domain, alt text — NOT meta keywords
          if (part.text !== metaKeywords.toLowerCase() && part.text !== metaCategory) {
            hasContentMatch = true;
          }
        }
      }
      // Cap low-weight sources (body text, alt text) to avoid product listing spam
      if (part.weight <= 1) partScore = Math.min(partScore, 3);
      score += partScore;
    }
    if (score > 0) {
      results.scores[industry] = score;
      contentCorroborated[industry] = hasContentMatch;
    }
  }

  // ── Remove categories that are ONLY supported by meta keywords (no content corroboration) ──
  // This prevents template/default meta keywords from driving classification
  for (const [industry, score] of Object.entries(results.scores)) {
    if (!contentCorroborated[industry] && score <= 4) {
      delete results.scores[industry];
    }
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

  // ── Context-aware keyword disambiguation ──
  // Words like "laptop" can appear in luggage contexts ("laptop trolley", "laptop bag",
  // "laptop sleeve", "laptop backpack"). When the page's primary content is about bags/luggage,
  // suppress the false Electronics signal that "laptop" triggers.
  const allText = textParts.map(p => p.text).join(' ');
  const LUGGAGE_CONTEXT_WORDS = /\b(trolley|trolleys|luggage|suitcase|cabin\s*bag|travel\s*bag|duffel|carry[- ]on|check[- ]in\s*bag|backpack|strolley)\b/i;
  if (results.scores['Electronics & Tech'] && results.scores['Fashion & Apparel']
    && LUGGAGE_CONTEXT_WORDS.test(allText)
    && /laptop\s+(trolley|bag|sleeve|backpack|case|pouch)/i.test(allText)) {
    // "laptop" here means laptop-bag, not laptop-computer — suppress Electronics boost
    results.scores['Electronics & Tech'] = Math.max(0, (results.scores['Electronics & Tech'] || 0) - 8);
    results.scores['Fashion & Apparel'] = (results.scores['Fashion & Apparel'] || 0) + 4;
  }

  // ── Disambiguation: "watch" as in movies vs fashion watches ──
  // "watch movies", "watch online", "watch free" = entertainment, NOT wristwatches
  const MOVIE_CONTEXT = /\b(watch\s+(movie|film|online|free|now|episode|series|video|trailer|full)|movie|bollywood|hollywood|telugu\s+movie|tamil\s+movie|hindi\s+movie|dubbed|streaming|ott)\b/i;
  if (results.scores['Fashion & Apparel'] && results.scores['Media & Entertainment']
    && MOVIE_CONTEXT.test(allText)
    && !/\b(wristwatch|luxury\s*watch|analog\s*watch|watch\s*brand|watch\s*strap|chronograph|timepiece|buy\s*watch)\b/i.test(allText)) {
    results.scores['Fashion & Apparel'] = Math.max(0, (results.scores['Fashion & Apparel'] || 0) - 10);
    results.scores['Media & Entertainment'] = (results.scores['Media & Entertainment'] || 0) + 6;
  }
  // If only Fashion matched (no Media score yet) but page is clearly about movies
  if (results.scores['Fashion & Apparel'] && !results.scores['Media & Entertainment'] && MOVIE_CONTEXT.test(allText)
    && !/\b(wristwatch|luxury\s*watch|watch\s*brand|chronograph|timepiece)\b/i.test(allText)) {
    results.scores['Media & Entertainment'] = (results.scores['Fashion & Apparel'] || 0) + 4;
    results.scores['Fashion & Apparel'] = 0;
  }

  // ── Disambiguation: retail meat/seafood shops vs Aquaculture ──
  // Words like "seafood", "fish", "shrimp" in a retail context (meat shop, store, delivery)
  // should map to Grocery, not Aquaculture (which is B2B fish farming).
  const RETAIL_FOOD_CONTEXT = /\b(meat\s*shop|meat\s*store|meat\s*delivery|fresh\s*meat|premium\s*meat|butcher|chicken\s*shop|mutton|order\s*(meat|chicken|fish)|buy\s*(meat|chicken|fish)|meat\s*online|seafood\s*(store|shop|delivery|online))\b/i;
  if (results.scores['Aquaculture & Fisheries'] && RETAIL_FOOD_CONTEXT.test(allText)) {
    results.scores['Aquaculture & Fisheries'] = 0;
    results.scores['Grocery & Supermarket'] = (results.scores['Grocery & Supermarket'] || 0) + 6;
  }

  // ── Disambiguation: suppress non-product categories when strong product signals exist ──
  // E-commerce/fashion sites often have words like "bestseller", "book", "publishing" in
  // marketing copy or JS/tracking code. If we see strong product-category signals (Fashion,
  // Beauty, Electronics, etc.), suppress weaker non-product category scores.
  const PRODUCT_CATEGORIES = new Set([
    'Fashion & Apparel', 'Jewelry', 'Beauty & Personal Care', 'Food & Beverage',
    'Home & Living', 'Health & Wellness', 'Electronics & Tech', 'Baby & Kids',
    'Pet Products', 'Sports & Outdoor', 'Grocery & Supermarket', 'FMCG',
    'Ecommerce/Retail', 'Automotive', 'Pharmacy & Optical',
  ]);
  const NON_PRODUCT_CATEGORIES = new Set([
    'Publishing & Books', 'News & Media', 'Professional Services', 'SaaS & B2B',
    'NGO & Non-Profit', 'Government & Public Sector', 'Legal', 'HR & Recruitment',
    'Education Services (Non-Digital)', 'Schools & Universities',
  ]);
  const maxProductScore = Object.entries(results.scores)
    .filter(([cat]) => PRODUCT_CATEGORIES.has(cat))
    .reduce((max, [, s]) => Math.max(max, s), 0);
  if (maxProductScore >= 6) {
    for (const cat of NON_PRODUCT_CATEGORIES) {
      if (results.scores[cat] && results.scores[cat] < maxProductScore * 0.8) {
        delete results.scores[cat];
      }
    }
  }

  // ── Cross-category suppression: prevent false positives from shared keywords ──
  // When a specific category has strong signals, suppress weaker generic categories
  // that match only due to ambiguous short keywords (e.g. "bra" in "brand", "heel" in page footer)
  const identityLower = (title + ' ' + metaDesc).toLowerCase();
  const SUPPRESS_RULES = [
    // If Automotive is strong (e-cycle, bicycle, EV, car), suppress Fashion
    { ifStrong: 'Automotive', suppress: ['Fashion & Apparel'], minScore: 4 },
    // If EdTech is strong, suppress News & Media (education sites often have "news" sections)
    { ifStrong: 'EdTech', suppress: ['News & Media'], minScore: 4 },
    // If Social Media is strong, suppress Dating and Fashion
    { ifStrong: 'Social Media & Platforms', suppress: ['Dating & Matchmaking', 'Fashion & Apparel'], minScore: 4 },
    // If Health & Wellness Services (telemedicine), suppress Health & Wellness (products)
    { ifStrong: 'Health & Wellness Services', suppress: ['Health & Wellness'], minScore: 4 },
    // If FinTech is strong, suppress Banking & Financial Services and Insurance
    { ifStrong: 'FinTech', suppress: ['Banking & Financial Services', 'Insurance'], minScore: 4 },
    // If Travel is strong, suppress Transportation and Fashion
    { ifStrong: 'Travel & Ticketing', suppress: ['Transportation & Mobility', 'Fashion & Apparel'], minScore: 4 },
    // If Automotive is strong, suppress Sports & Outdoor (cycling confusion)
    { ifStrong: 'Automotive', suppress: ['Sports & Outdoor'], minScore: 6 },
    // If Transportation is strong (car rental, cab), suppress Airlines and Travel
    { ifStrong: 'Transportation & Mobility', suppress: ['Airlines & Aviation', 'Travel & Ticketing'], minScore: 4 },
    // If Automotive is strong, suppress Airlines
    { ifStrong: 'Automotive', suppress: ['Airlines & Aviation'], minScore: 4 },
  ];
  for (const rule of SUPPRESS_RULES) {
    const strongScore = results.scores[rule.ifStrong] || 0;
    if (strongScore >= rule.minScore) {
      for (const cat of rule.suppress) {
        if (results.scores[cat] && results.scores[cat] < strongScore) {
          delete results.scores[cat];
        }
      }
    }
  }

  // ── Title/description signal boost ──
  // If the title+description clearly indicates a specific industry, boost it
  // This prevents body-text noise from overriding clear title signals
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (!results.scores[industry]) continue;
    let titleHits = 0;
    for (const kw of keywords) {
      if (kwMatches(identityLower, kw)) titleHits++;
    }
    if (titleHits >= 2) {
      // Multiple keyword hits in title+desc = strong signal, boost score
      results.scores[industry] += 3;
    }
  }

  // ── Publisher / news-media disambiguation ──
  // A site that COVERS a vertical (fintech, crypto, banking…) as a news outlet,
  // magazine or blog is a News & Media business — NOT a company in that vertical.
  // e.g. fintech.global ("Latest FinTech News, Insights & Analysis") and
  // fintechzoom.com ("market news, stock analysis, banking insights, coverage")
  // score high on FinTech from keyword density, but they are publications.
  // Genuine publishers announce themselves in the title/description with several
  // editorial terms. Require 2+ such signals in the identity text (title+desc,
  // NOT the noisy body) so a real fintech company with a single "news" section
  // is not misclassified. These verticals are "topics you can report on"; a
  // publication about them still belongs in News & Media.
  const PUBLISHER_TERMS = [
    'news', 'magazine', 'media', 'insights', 'insight', 'analysis', 'coverage',
    'editorial', 'journalism', 'journal', 'publication', 'headlines', 'reporting',
    'newsroom', 'newsletter', 'the latest', 'breaking', 'press',
  ];
  const titleLower = (title || '').toLowerCase();
  const publisherHits = PUBLISHER_TERMS.filter(t => identityLower.includes(t)).length;
  const titlePublisherHits = PUBLISHER_TERMS.filter(t => titleLower.includes(t)).length;
  const domainSignalsPublisher =
    /(news|magazine|media|wire|times|daily|weekly|herald|gazette|journal|bulletin|digest|headline|feature)/i.test(domainRaw);
  const TOPICAL_VERTICALS = [
    'FinTech', 'Crypto & Web3', 'Banking & Financial Services', 'Insurance',
    'EdTech', 'Health & Wellness Services', 'Automotive', 'Real Estate',
    'Gaming & Esports', 'Telecom',
  ];
  // Gate on a signal in the TITLE (or a publisher-shaped domain): a real company
  // may mention "news"/"insights" as a secondary feature in its description, but
  // a publication names itself as one in the title ("… News, Insights & Analysis").
  const looksLikePublisher =
    titlePublisherHits >= 2 ||
    (titlePublisherHits >= 1 && publisherHits >= 2) ||
    (domainSignalsPublisher && publisherHits >= 2);
  if (looksLikePublisher) {
    const topVerticalScore = TOPICAL_VERTICALS.reduce(
      (m, v) => Math.max(m, results.scores[v] || 0), 0);
    if (topVerticalScore > 0) {
      // News & Media must outrank the topical vertical it merely reports on.
      results.scores['News & Media'] = Math.max(
        results.scores['News & Media'] || 0, topVerticalScore + 2);
      const newsScore = results.scores['News & Media'];
      for (const v of TOPICAL_VERTICALS) {
        if (!results.scores[v]) continue;
        // Keep the vertical only as a weak secondary hint (used for subcategory),
        // never at or above the News score.
        results.scores[v] = Math.min(results.scores[v], newsScore - 2);
        if (results.scores[v] <= 0) delete results.scores[v];
      }
    }
  }

  const sorted = Object.entries(results.scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    // Tiebreaker: whichever industry's keywords appear first in title+desc
    return firstMentionPos(a[0]) - firstMentionPos(b[0]);
  });
  if (sorted.length > 0 && sorted[0][1] >= 2) {
    results.category = sorted[0][0];
    // Confidence: how much the top category leads over the runner-up
    const topScore = sorted[0][1];
    const runnerUp = sorted.length > 1 ? sorted[1][1] : 0;
    const gap = runnerUp > 0 ? topScore / runnerUp : topScore;
    // High confidence: top score >= 8 AND at least 2x the runner-up
    // Low confidence: top score < 4 OR less than 1.3x the runner-up
    results.categoryConfidence = gap >= 2 && topScore >= 8 ? 'high' : gap >= 1.3 && topScore >= 4 ? 'medium' : 'low';
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

  // Region inference from payment tech — require stronger signals
  if (indianPaymentCount >= 2 && globalPaymentCount === 0) {
    results.region = 'India';
  } else if (indianPaymentCount > 0 && globalPaymentCount === 0) {
    // Single Indian payment gateway: suggest India but don't override stronger signals
    results.region = 'India';
  }

  const indianEcom = ['gokwik', 'shiprocket', 'delhivery', 'nimbuspost', 'unicommerce'];
  const indianEcomCount = indianEcom.filter(p => allTechText.includes(p)).length;
  if (indianEcomCount > 0 && globalPaymentCount === 0) {
    results.region = 'India';
    if (!results.category) results.category = 'Ecommerce/Retail';
  }

  // US detection: Stripe alone OR global payments dominating
  if (globalPaymentCount > 0 && indianPaymentCount === 0) {
    results.region = 'US';
  } else if (techNames.has('stripe') && !results.region && globalPaymentCount >= indianPaymentCount) {
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

  if (isComDomain && uniqueCurrencies.length === 1) {
    if (uniqueCurrencies[0] === 'USD') return 'US';
    if (uniqueCurrencies[0] === 'GBP') return 'UK';
    if (uniqueCurrencies[0] === 'EUR') return 'EU';
    if (uniqueCurrencies[0] === 'INR') return 'India';
  }

  // For .com domains with mixed currencies, use majority vote
  if (isComDomain && uniqueCurrencies.length > 1) {
    const usdCount = currencySignals.filter(c => c === 'USD').length;
    const inrCount = currencySignals.filter(c => c === 'INR').length;
    const gbpCount = currencySignals.filter(c => c === 'GBP').length;
    const eurCount = currencySignals.filter(c => c === 'EUR').length;
    const maxCount = Math.max(usdCount, inrCount, gbpCount, eurCount);
    if (maxCount >= 2) {
      if (usdCount === maxCount) return 'US';
      if (inrCount === maxCount) return 'India';
      if (gbpCount === maxCount) return 'UK';
      if (eurCount === maxCount) return 'EU';
    }
    // If tech hints strongly point to India, use that
    if (techHints._indianPaymentCount > 0 && techHints._globalPaymentCount === 0 && inrCount > 0) return 'India';
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
    // For .com domains, require stronger corroboration for India classification
    const inrPresent = currencySignals.includes('INR');
    const usdPresent = currencySignals.includes('USD');
    const indianPhone = phoneSignals.includes('India');
    const usPhone = phoneSignals.includes('US');
    if (techRegion === 'India' && inrPresent && !usdPresent && (indianPhone || !usPhone)) return 'India';
    if (techRegion === 'India' && techHints._indianPaymentCount >= 2 && techHints._globalPaymentCount === 0) return 'India';
    if (techRegion === 'US') return 'US';
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
      '/apps/s/storelocators', '/apps/store-locator', '/pages/store-locator',
      '/pages/stores', '/pages/our-stores', '/pages/find-a-store',
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
      for (const path of ['/stores', '/store-finder', '/store-locator', '/find-a-store', '/apps/s/storelocators', '/pages/store-locator']) {
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

  // If no store/location link anywhere, check for inline store addresses in footer/body
  // Many small brands list stores directly in the footer without a dedicated page
  if (!headerFooterLink) {
    // Double-check: if JSON-LD has multiple addresses, there might be stores
    if (jsonLdStoreHint && jsonLdStoreHint > 1) {
      return { band: countToBand(jsonLdStoreHint), rawCount: jsonLdStoreHint, source: 'json_ld', locatorPageExists: false };
    }

    // Try to detect inline store listings in footer/body
    const inlineCount = countInlineStoreAddresses(html);
    if (inlineCount > 0) {
      return { band: countToBand(inlineCount), rawCount: inlineCount, source: 'inline_footer', locatorPageExists: false };
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

  // 3d2: Count distinct city names on main page — restaurants/QSR chains list cities as outlet selectors
  if (html) {
    const bodyOnly = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
    const INDIAN_CITIES_RE = /\b(Mumbai|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Kolkata|Pune|Ahmedabad|Jaipur|Lucknow|Surat|Kanpur|Nagpur|Indore|Bhopal|Patna|Vadodara|Ghaziabad|Ludhiana|Agra|Nashik|Ranchi|Faridabad|Meerut|Rajkot|Varanasi|Srinagar|Aurangabad|Dhanbad|Amritsar|Allahabad|Visakhapatnam|Jodhpur|Coimbatore|Madurai|Kochi|Chandigarh|Guwahati|Mysore|Thiruvananthapuram|Bhubaneswar|Dehradun|Raipur|Udaipur|Noida|Gurgaon|Gurugram|Kota|Jalandhar|Bikaner|Ajmer|Sikar|Bhilwara|Alwar|Pali|Tonk|Vijayawada|Vizag|Guntur|Warangal|Tirupati|Nellore|Rajahmundry|Kakinada|Kurnool|Kadapa|Khammam|Karimnagar|Nizamabad|Secunderabad|Thane|Navi Mumbai|Goa|Panaji|Shimla|Manali|Rishikesh|Haridwar|Jamshedpur|Bokaro|Cuttack|Rourkela|Siliguri|Durgapur|Asansol|Tiruchirappalli|Salem|Tirunelveli|Erode|Vellore|Hubli|Belgaum|Mangalore|Gwalior|Jabalpur|Ujjain|Bhuj|Anand|Bharuch|Gandhidham)\b/gi;
    const foundCities = [...new Set((bodyOnly.match(INDIAN_CITIES_RE) || []).map(c => c.toLowerCase()))];
    if (foundCities.length >= 3) {
      // Multiple cities listed = multi-city presence. Estimate at least 1 outlet per city.
      return result(foundCities.length, 'city_count');
    }
  }

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
  const stockistMatch = /data-stockist-widget-tag=["']([^"']+)["']/i.exec(html)
    || /stockist\.co\/api\/v1\/(u\w+)/i.exec(html);
  if (stockistMatch) {
    checks.push(async () => {
      // Try /locations/all first (no coordinates needed)
      try {
        const resp = await fetchPage(`https://stockist.co/api/v1/${stockistMatch[1]}/locations/all`);
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        if (Array.isArray(data) && data.length > 0) return data.length;
        if (data?.locations?.length > 0) return data.locations.length;
      } catch {}
      // Fallback: search with wide radius from center of India
      try {
        const resp = await fetchPage(`https://stockist.co/api/v1/${stockistMatch[1]}/locations/search?latitude=20.5937&longitude=78.9629&distance=50000`);
        const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        if (data?.locations) return data.locations.length;
        if (Array.isArray(data)) return data.length;
      } catch {}
      return 0;
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

/**
 * Count inline store/branch addresses listed directly on the page (typically in footer).
 * Many small brands list stores as address blocks without a dedicated store locator page.
 * Detects patterns like:
 *   - Headings: "Flagship Store", "Branch – Mumbai", "Our Store", "Showroom – Delhi"
 *   - Address blocks with Indian pincodes (6 digits) or international zip codes
 *   - Multiple phone numbers with store context
 *   - Google Maps embeds
 */
function countInlineStoreAddresses(html) {
  if (!html) return 0;

  // Focus on footer + last 30% of page (where store addresses typically appear)
  const footerHtml = extractHeaderFooter(html);
  // Also grab the last 30% of the HTML as fallback for non-semantic markup
  const lastChunk = html.slice(-Math.max(10000, Math.floor(html.length * 0.3)));
  const searchHtml = footerHtml + '\n' + lastChunk;
  const searchText = searchHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  let count = 0;

  // Strategy 1: Count headings that indicate individual stores/branches
  // Decode HTML entities first so "Branch &#8211; City" becomes "Branch – City"
  const decodedText = searchText.replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&#x2013;/g, '–').replace(/&#x2014;/g, '—')
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

  // Patterns: "Flagship Store", "Branch – City", "Showroom – Location", "Store – Name"
  const storeHeadingRx = /<(?:h[1-6]|strong|b|p|div|span)[^>]*>\s*(?:<[^>]+>\s*)*\s*((?:flagship|branch|showroom|outlet|store|head\s*office|corporate\s*office|registered\s*office|factory\s*outlet|experience\s*(?:center|centre)|retail\s*store|concept\s*store)(?:\s*[-–—:]\s*|\s+(?:in|at)\s+|\s*[-–—]\s*)[^<]{2,60})\s*(?:<\/[^>]+>\s*)*<\/(?:h[1-6]|strong|b|p|div|span)>/gi;
  const storeHeadings = new Set();
  let shm;
  while ((shm = storeHeadingRx.exec(decodedText)) !== null) {
    const heading = shm[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
    if (heading.length > 3 && heading.length < 80) {
      storeHeadings.add(heading);
    }
  }

  // Also match standalone headings like just "Flagship Store", "Our Showroom", "Head Office"
  const standaloneHeadingRx = /<(?:h[1-6]|strong|b)[^>]*>\s*(?:<[^>]+>\s*)*((?:flagship\s+store|our\s+(?:store|showroom|outlet|branch)|head\s*office|corporate\s*office|registered\s*office|main\s+(?:store|branch|showroom)))\s*(?:<\/[^>]+>\s*)*<\/(?:h[1-6]|strong|b)>/gi;
  let stm;
  while ((stm = standaloneHeadingRx.exec(decodedText)) !== null) {
    const heading = stm[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
    if (heading.length > 3) storeHeadings.add(heading);
  }

  if (storeHeadings.size > 0) count = Math.max(count, storeHeadings.size);

  // Strategy 2: Count distinct Indian pincodes (6-digit numbers) near address context
  // Indian pincodes: 6 digits starting with 1-9, found near address words
  const addressContextRx = /(?:shop\s*(?:no\.?|number)?|floor|road|street|nagar|colony|sector|block|lane|chowk|marg|phase|plot|building|tower|mall|complex|house|gali|mohalla|bazar|bazaar|market|cross|layout|extension|enclave|vihar|puram|pur|gunj|ganj|wadi|peth|tola|para|basti)\s*[\s\S]{0,200}?\b(\d{6})\b/gi;
  const pincodes = new Set();
  let pcm;
  while ((pcm = addressContextRx.exec(searchText)) !== null) {
    const pin = pcm[1];
    // Valid Indian pincodes: 1xxxxx to 8xxxxx
    if (/^[1-8]\d{5}$/.test(pin)) pincodes.add(pin);
  }

  // Also try reverse: pincode followed by address context (less common but valid)
  const reversePincodeRx = /\b(\d{6})\b[\s\S]{0,100}?(?:mobile|phone|tel|email|contact)/gi;
  let rpcm;
  while ((rpcm = reversePincodeRx.exec(searchText)) !== null) {
    const pin = rpcm[1];
    if (/^[1-8]\d{5}$/.test(pin)) pincodes.add(pin);
  }

  // Only count if we have multiple distinct pincodes (1 pincode = could be just HQ)
  if (pincodes.size > 1) count = Math.max(count, pincodes.size);

  // Strategy 3: Count Google Maps embeds (each iframe = likely 1 store)
  const mapEmbeds = (searchText.match(/<iframe[^>]*(?:google\.com\/maps|maps\.google)[^>]*>/gi) || []).length;
  if (mapEmbeds > 1) count = Math.max(count, mapEmbeds);

  // Strategy 4: Count unique Google Maps direction links
  const mapsLinkSet = new Set();
  const mapsLinkRx = /href=["']([^"']*(?:google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)[^"']*)["']/gi;
  let mlm;
  while ((mlm = mapsLinkRx.exec(searchText)) !== null) {
    mapsLinkSet.add(mlm[1].split('?')[0]);
  }
  if (mapsLinkSet.size > 1) count = Math.max(count, mapsLinkSet.size);

  // Strategy 5: Count <address> tags
  const addressTags = (searchText.match(/<address[\s\S]*?<\/address>/gi) || []).length;
  if (addressTags > 1) count = Math.max(count, addressTags);

  // Strategy 6: Count phone numbers that appear near store/branch/address context
  // Only count if multiple distinct phone numbers exist alongside address indicators
  const phoneNearStoreRx = /(?:store|branch|outlet|showroom|flagship|office|location)[\s\S]{0,500}?(?:mobile|phone|tel|call)[\s:]*\+?\d[\d\s-]{8,}/gi;
  const storePhones = (searchText.match(phoneNearStoreRx) || []).length;
  // Also count reverse: phone after address-like text (with pincode)
  const phoneAfterAddressRx = /\b[1-8]\d{5}\b[\s\S]{0,200}?(?:mobile|phone|tel|call)[\s:]*\+?\d[\d\s-]{8,}/gi;
  const addrPhones = (searchText.match(phoneAfterAddressRx) || []).length;
  const totalStorePhones = Math.max(storePhones, addrPhones);
  if (totalStorePhones > 1) count = Math.max(count, totalStorePhones);

  // Guard: if we only found 1, it's likely just the HQ/contact address — don't count as stores
  // Exception: if we found exactly 1 store heading AND 1 pincode, it's a single physical store
  if (count === 0 && storeHeadings.size === 1 && pincodes.size >= 1) {
    count = 1;
  }

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
  'buy now on', 'shop now on',
  'also available at',
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

/* ── D2C-eligible categories (consumer-facing brands that belong in the dashboard) ──
 * Includes: physical product D2C, consumer subscriptions, consumer marketplaces,
 * consumer fintech, consumer services — anything that sells directly to individuals.
 * Excludes: pure B2B (enterprise SaaS, consulting), government, NGOs, pure infra.
 */
const D2C_ELIGIBLE_CATEGORIES = new Set([
  // Physical product D2C
  'Fashion & Apparel', 'Beauty & Personal Care', 'Jewelry', 'Electronics & Tech',
  'Food & Beverage', 'Health & Wellness', 'Home & Living', 'Baby & Kids',
  'Pet Products', 'Sports & Outdoor', 'Grocery & Supermarket', 'FMCG',
  'Office & Stationery', 'Ecommerce/Retail', 'Alcohol & Tobacco', 'Art & Collectibles', 'Gifting',
  'Automotive', 'Pharmacy & Optical', 'Luxury & Premium Goods',
  'Handicrafts & Artisanal Goods', 'Leather & Hide Products',
  // Consumer services & subscriptions
  'Fitness & Gym', 'Salon & Spa', 'Restaurant & Hospitality', 'Food Delivery',
  'Rental & Subscription Services', 'Wedding & Events', 'Dental & Oral Care',
  'Cleaning & Sanitation Services', 'Personal & Domestic Services',
  'Photography & Videography', 'Music & Audio', 'Wellness Tourism & Retreats',
  'Amusement & Entertainment Venues',
  // Consumer digital & subscriptions (D2C to individuals)
  'Betting & Fantasy Sports',     // Dream11, FanDuel, Bet365
  'Dating & Matchmaking',         // Tinder, Bumble, Shaadi
  'EdTech',                       // Byju's, Coursera, Duolingo
  'FinTech',                      // Robinhood, PhonePe, Cash App
  'Health & Wellness Services',   // Headspace, Calm, Cult.fit
  'Media & Entertainment',        // Netflix, Spotify, Disney+
  'Social Media & Platforms',     // YouTube Premium, X Premium
  'Travel & Ticketing',           // MakeMyTrip, Booking.com
  'News & Media',                 // NYT, The Athletic
  'Home Services',                // Urban Company, Thumbtack
  'Classifieds & Listings',       // OLX, Craigslist
  'Transportation & Mobility',    // Uber, Ola
  'Insurance',                    // Acko, Lemonade — D2C insurance
]);

async function extractCompanyMeta({ url, html, headers, metaMap, technologies, fetchPage, browserFetch, forceRefresh, metaOnly = false }) {
  const normalizedDomain = url.replace(/^https?:\/\//i, '')
    .replace(/^www\d*\./i, '')
    .replace(/^(?:en|ar|fr|de|es|it|pt|ja|ko|zh|ru|hi|th|vi|m|mobile|shop|store|app)[-_.]/i, '')
    .replace(/\/.*$/, '').toLowerCase();

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

    // If known brand exists and DB has wrong/missing data, fix DB immediately
    if (knownBrand && cached) {
      const needsCategoryFix = !cached.category || cached.category === 'Unknown' || cached.category !== knownBrand.category;
      const needsStoreFix = knownBrand.stores && cached.offlineStores !== knownBrand.stores
        || knownBrand.onlineOnly && cached.offlineStores !== 'Online';
      const needsRegionFix = knownBrand.region && (!cached.region || cached.region === 'Unknown') && cached.region !== knownBrand.region;
      if (needsCategoryFix || needsStoreFix || needsRegionFix) {
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
    }

    // Only trust cache entries written after classification improvements
    const CACHE_CUTOFF = new Date('2026-03-16T00:00:00Z');
    const cacheIsFresh = cached?.updatedAt && new Date(cached.updatedAt) > CACHE_CUTOFF;

    if (!forceRefresh && cached && cached.expiresAt && new Date(cached.expiresAt) > new Date() && cacheIsFresh) {
      // If category is still Unknown after known-brand fix, skip cache — force re-analysis
      const cachedCategory = knownBrand?.category || cached.overrides?.category || cached.category;
      if (cachedCategory === 'Unknown' || !cachedCategory) {
        // Don't use cache — fall through to re-analyze with keywords
      } else {
        // Skip cache if store data or category is unreliable — force re-analysis
        const storeSource = cached.storeConfidence?.source;
        const isStoreDataWeak = storeSource === 'header_footer_link' || storeSource === 'timeout'
          || storeSource === 'known_brand' || storeSource === 'text_extraction'
          || (!storeSource && cached.offlineStores && cached.offlineStores !== 'Online' && (cached.storeRawCount || 0) === 0);
        const isCategoryWeak = !cached.categoryConfidence || cached.categoryConfidence === 'low';
        if (!isStoreDataWeak && !isCategoryWeak) {
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

  let region = knownBrand?.region || detectRegion(
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
      { sub: 'Bags & Luggage',       kws: ['handbag', 'backpack', 'luggage', 'suitcase', 'tote bag', 'crossbody', 'duffel', 'trolley', 'trolleys', 'trolley bag', 'cabin bag', 'carry-on', 'travel accessories'] },
      { sub: 'Electronics',          kws: ['electronics', 'gadget', 'smartphone', 'laptop', 'earbuds', 'headphone', 'charger', 'power bank', 'tablet'] },
      { sub: 'Home & Living',        kws: ['furniture', 'home decor', 'mattress', 'bedding', 'sofa', 'curtain', 'cushion', 'candle', 'kitchenware'] },
      { sub: 'Food & Beverage',      kws: ['food', 'snack', 'chocolate', 'coffee', 'tea', 'protein', 'supplement', 'organic', 'spices', 'nutrition', 'beverage'] },
      { sub: 'Health & Wellness',    kws: ['health', 'wellness', 'fitness', 'yoga', 'gym', 'supplement', 'vitamin', 'ayurved', 'ayurvedic', 'herbal', 'immunity', 'digestive', 'joint care', 'liver care', 'throat care', 'tonic', 'churna', 'kadha', 'nutraceutical', 'homeopathy', 'natural remedy'] },
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

  // ── AI classification (Gemini) — correct weak/vague keyword results ──
  // Runs whenever the keyword classifier is unsure: category missing/Unknown,
  // low confidence, or a vague subcategory. Confident keyword results are left
  // untouched, so this only fixes the cases that were previously wrong/vague.
  let aiBusinessModel = null;
  let aiRegion = null;
  let aiBrandName = null;
  if (!knownBrand) {
    const kwConfidence = keywords.categoryConfidence || 'low';
    const catMissing = !category || category === 'Unknown';
    const subVague = !subCategory || subCategory === 'General' || subCategory === 'Unknown';

    try {
      const { classifyWithAI } = require('./aiClassifier');
      // Always consult AI (Gemini) for non-known brands. It reads real page
      // context + brand knowledge and is the most reliable category signal, so it
      // corrects keyword false positives — e.g. a luxury-fashion store that the
      // keyword scorer confidently mis-scores as "Media & Entertainment".
      // We deliberately do NOT lock the keyword category: the whole point is to
      // let AI override a confidently-wrong one. Keyword confidence being 'high'
      // is not trustworthy on its own (that is exactly how the bug happened).
      // NOTE: we deliberately do NOT pass the keyword guess as a hint. Doing so
      // anchors Gemini to a confidently-wrong keyword category (e.g. a food
      // *packaging* supplier that the keyword scorer calls "Food & Beverage").
      // Gemini classifies more accurately from the page content on its own.
      const aiResult = await classifyWithAI(normalizedDomain, html || '', {
        categories: Object.keys(INDUSTRY_KEYWORDS),
      });
      if (aiResult && aiResult.category) {
        const aiCat = aiResult.category;
        const categoryChanged = aiCat !== category;
        // Only guard against AI *downgrading* a specific keyword category to the
        // generic "Ecommerce/Retail" bucket; otherwise AI wins.
        const wouldDowngrade = aiCat === 'Ecommerce/Retail' && !catMissing && category !== 'Ecommerce/Retail';
        const adoptedNewCategory = categoryChanged && !wouldDowngrade;
        if (!wouldDowngrade) {
          category = aiCat;
          if (categoryChanged || kwConfidence === 'low') keywords.categoryConfidence = 'medium';
        }
        // Take AI's subcategory when the old one was vague OR the category just
        // changed (a sub from the old/wrong category is now stale).
        if ((subVague || adoptedNewCategory) && aiResult.subCategory && aiResult.subCategory !== 'General') {
          subCategory = aiResult.subCategory;
        }
        // Gemini's business-model read is the best signal we have — use it.
        if (aiResult.businessModel) aiBusinessModel = aiResult.businessModel;
        // Gemini reasoned over the page's currency/address/phone signals — treat
        // its region as authoritative (falls back to the heuristic below if null).
        if (aiResult.region) aiRegion = aiResult.region;
        // Proper display name (already cleaned of domains/URLs in the classifier).
        if (aiResult.brandName) aiBrandName = aiResult.brandName;
      }
    } catch {}
  }

  // Gemini's region wins over the heuristic detector (it read the same currency/
  // address/phone signals, but with better precedence + brand knowledge). Keep
  // the finer state/city granularity from extractLocation.
  if (aiRegion) region = aiRegion;

  // ── Kick off app-presence detection NOW so it runs in parallel with the
  // (slow) offline-store scrape below, instead of sequentially after it. ──
  const { detectAppPresenceFromHTML, detectAppPresence } = require('./appPresence');
  let appDetection = detectAppPresenceFromHTML(html);
  const needFullAppScan = ['No App', 'iOS Only', 'Android Only'].includes(appDetection.appPresence);
  const appScanPromise = (needFullAppScan && !metaOnly)
    ? Promise.race([
        detectAppPresence(normalizedDomain).catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
      ])
    : Promise.resolve(null);

  let offlineStores;
  let storeRawCount = 0;
  let storeConfidence = null;

  /** Estimate a midpoint count from a store band string */
  function estimateCountFromBand(band) {
    const BAND_MIDPOINTS = { '1-10': 5, '11-20': 15, '21-50': 35, '10-50': 30, '50-100': 75, '51-100': 75, '100-500': 250, '100+': 150, '500+': 750 };
    return BAND_MIDPOINTS[band] || 0;
  }

  // Priority 1: Known brand — always trust over scraping
  if (knownBrand?.onlineOnly) {
    offlineStores = 'Online';
    storeConfidence = { score: 100, tier: 'high', source: 'known_brand', flags: [] };
  } else if (knownBrand?.stores) {
    offlineStores = knownBrand.stores;
    storeRawCount = knownBrand.storeCount || 0;
    storeConfidence = { score: knownBrand.storeCount ? 95 : 90, tier: 'high', source: 'known_brand', flags: [] };
  }
  // Priority 2: Category-based online-only detection
  else {
    const noStoreBizTypes = ['FinTech', 'EdTech', 'Insurance', 'Telecom', 'Media & Entertainment', 'News & Media', 'Health & Wellness Services', 'Food Delivery', 'Transportation & Mobility', 'Transportation', 'Real Estate', 'SaaS', 'Cloud Services', 'NGO & Non-Profit', 'Professional Services', 'Social Media & Platforms', 'Gaming & Esports', 'Betting & Fantasy Sports', 'Dating & Matchmaking', 'Web Hosting & Domains', 'Classifieds & Listings', 'Government & Public Sector'];
    const onlineOnlySubCategories = ['Marketplace', 'Social Commerce', 'Fashion Marketplace', 'Online Grocery', 'Quick Commerce', 'Food Delivery', 'Ride-Hailing', 'Online Pharmacy', 'Telemedicine', 'Property Listing', 'Rental Platform', 'Travel Booking', 'Vacation Rentals', 'Digital Payments', 'Payment Gateway', 'Investment Platform', 'Stock Trading', 'Insurance Marketplace', 'Fitness App', 'Online Tutoring', 'Test Prep', 'K-12 Learning', 'Higher Education', 'Professional Courses', 'Coding for Kids', 'Credit & Rewards', 'Car Research', 'Farm Fresh Dairy', 'Fresh Meat & Seafood'];
    if (noStoreBizTypes.includes(category) || onlineOnlySubCategories.includes(subCategory)) {
      offlineStores = 'Online';
      storeConfidence = { score: 100, tier: 'high', source: 'category_rule', flags: [] };
    }
    // metaOnly (Category Finder): skip the slow store-locator scrape entirely.
    else if (metaOnly) {
      offlineStores = 'Unknown';
    }
    // Priority 3: Active scraping — check header/footer for store link, follow it, count locations
    else {
      try {
        const timeoutFallback = { band: 'Online', rawCount: 0, source: 'timeout', locatorPageExists: false };
        const storeResult = await Promise.race([
          detectOfflineStores(html, url, technologies || [], quickFetch, null, jsonLd.storeHint, browserFetch),
          new Promise(resolve => setTimeout(() => resolve(timeoutFallback), 5000)),
        ]);

        // Handle both old string returns and new object returns
        if (typeof storeResult === 'string') {
          offlineStores = storeResult;
        } else {
          storeRawCount = storeResult.rawCount || 0;

          // text_extraction is the weakest source — regex on page text.
          // If it returns a very low count (1-4), it might be a false positive (phone number, address).
          // Trust counts of 5+ from text extraction.
          const source = storeResult.source;
          if (source === 'text_extraction' && storeRawCount < 5) {
            offlineStores = storeRawCount > 0 ? 'Unknown' : 'Online';
            storeRawCount = 0;
          } else {
            offlineStores = storeResult.band;
          }

          // Calculate confidence score
          storeConfidence = calculateStoreConfidence({
            source,
            storeCount: storeRawCount,
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
    if (!storeRawCount) storeRawCount = knownBrand.storeCount || 0;
    if (!storeConfidence) {
      storeConfidence = { score: 70, tier: 'medium', source: 'known_brand_fallback', flags: ['global_count'] };
    }
  }

  // storeRawCount stays 0 if no real count was found — don't estimate

  // Apply known brand region if available and not already set
  if (knownBrand?.region && (!region || region === 'Unknown')) {
    region = knownBrand.region;
  }

  // ── Business Model Detection ──
  // Ground truth first: if we actually detected the brand's own physical retail
  // stores, it is Omnichannel — that outranks any model read (a brand with
  // stores is omnichannel even if Gemini/keywords only saw the online shop).
  const hasPhysicalStores = offlineStores && offlineStores !== 'Online' && offlineStores !== 'Unknown';
  let businessModel;
  if (hasPhysicalStores) {
    businessModel = 'Omnichannel';
  } else {
    // No confirmed stores → trust Gemini's read (it reasoned over marketplace /
    // B2B / store signals), then the deterministic detector, then Pure D2C.
    businessModel = aiBusinessModel || detectBusinessModel(html, url, offlineStores, technologies) || 'Pure D2C';
  }

  // Classification confidence — 'high' for known brands, otherwise from keyword analysis
  const categoryConfidence = knownBrand ? 'high' : (keywords.categoryConfidence || 'low');

  // Resolve app presence — the full domain scan (if needed) was kicked off in
  // parallel with the store scrape above, so this await usually returns instantly.
  const fullScan = await appScanPromise;
  if (fullScan && (fullScan.appPresence === 'Both iOS & Android' ||
      (fullScan.appPresence !== 'No App' && appDetection.appPresence === 'No App'))) {
    appDetection = fullScan;
  }

  // Brand display name: prefer a CLEAN og:site_name (the brand's own declared
  // name), but reject values that just leaked the domain (e.g. "zoak.co.in").
  // Fall back to Gemini's proper name (e.g. "AVT Naturals"), else null so the UI
  // prettifies the domain.
  const ogSiteName = (metaResults.ogSiteName || '').trim();
  const ogIsDomainLike = ogSiteName && !/\s/.test(ogSiteName) && /\.[a-z]{2,4}(\.[a-z]{2,4})?$/i.test(ogSiteName);
  const cleanOgSiteName = (ogSiteName && !ogIsDomainLike) ? ogSiteName : '';
  // Strip trailing/leading separator junk (e.g. "3i Infotech |") from whichever name we use.
  const brandName = (cleanOgSiteName || aiBrandName || '')
    .replace(/^[\s|\-–—·:»«/]+/, '').replace(/[\s|\-–—·:»«/]+$/, '').trim() || null;
  const result = { category, subCategory, region, state, city, offlineStores, storeRawCount, businessModel, categoryConfidence, appPresence: appDetection.appPresence, iosAppUrl: appDetection.iosUrl, androidAppUrl: appDetection.androidUrl, brandName };
  if (storeConfidence) result.storeConfidence = storeConfidence;

  // Check Non-D2C status BEFORE the try block so it's accessible everywhere
  let isNonD2C = false;
  let nonD2CReason = '';

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

    // Non-D2C flagging removed — every site gets a real category + sub-category
    // (never "Not Required" / "Non D2C Brand"). Keep isNonD2C false always.
    isNonD2C = false;

    // Build the $set fields — Non-D2C keeps category, D2C writes scan result
    const setFields = {
      normalizedDomain,
      region: result.region,
      state: result.state || null,
      city: result.city || null,
      storeRawCount: result.storeRawCount || 0,
      storeConfidence: result.storeConfidence || null,
      appPresence: result.appPresence || null,
      iosAppUrl: result.iosAppUrl || null,
      androidAppUrl: result.androidAppUrl || null,
      ...(result.brandName ? { brandName: result.brandName } : {}),
      ...(Array.isArray(technologies) && technologies.length > 0 ? {
        techCount: technologies.length,
        techStack: technologies.map(t => t.name || t).slice(0, 20),
      } : {}),
      classifierVersion: CLASSIFIER_VERSION,
      updatedAt: now,
      expiresAt,
    };

    if (isNonD2C) {
      // Non-D2C: preserve category, clear business model, keep stores as Online
      setFields.category = 'Not Required';
      setFields.subCategory = 'Non D2C Brand';
      setFields.categoryConfidence = 'high';
      setFields.businessModel = null;
      setFields.offlineStores = 'Online';
    } else {
      // Normal D2C: write everything from scan result
      setFields.category = result.category;
      setFields.subCategory = result.subCategory;
      setFields.categoryConfidence = result.categoryConfidence || 'low';
      setFields.businessModel = result.businessModel || null;
      setFields.offlineStores = result.offlineStores;

      // Auto-compute Harvin Score v1 (signal-based scoring)
      try {
        const { computeHarvinScore } = require('../scoring/harvinScore');
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        const techNames = Array.isArray(technologies) ? technologies.map(t => t.name || t) : [];

        // Fetch signals + tech changes for this domain in parallel
        const [domainSignals, techCacheDoc, marketNews] = await Promise.all([
          db.collection('signals').find({
            domain: normalizedDomain,
            detectedAt: { $gte: sixMonthsAgo },
          }).project({
            signalType: 1, detectedAt: 1, signalDate: 1,
            headline: 1, details: 1, confidence: 1,
          }).toArray(),
          db.collection('tech_cache').findOne(
            { domain: normalizedDomain },
            { projection: { techChanges: 1 } },
          ),
          db.collection('market_news').find({
            domain: normalizedDomain,
            publishedAt: { $gte: sixMonthsAgo },
          }).project({
            newsType: 1, publishedAt: 1, title: 1, headline: 1,
            details: 1, confidence: 1,
          }).toArray(),
        ]);

        // Convert market_news to signal format
        const allSignals = [
          ...domainSignals,
          ...marketNews.map(n => ({
            signalType: n.newsType,
            detectedAt: n.publishedAt,
            headline: n.title || n.headline,
            details: n.details || {},
            confidence: n.confidence || 0.5,
          })),
        ];

        const meta = {
          normalizedDomain,
          monthlyVisits: existing?.monthlyVisits || 0,
          appPresence: result.appPresence || existing?.appPresence || 'No App',
          offlineStores: result.offlineStores || 'Online',
          businessModel: result.businessModel || 'Pure D2C',
        };

        const hsResult = computeHarvinScore({
          meta,
          signals: allSignals,
          techChanges: techCacheDoc?.techChanges || null,
          currentTech: techNames,
        });

        setFields.harvinScore = hsResult.score;
        setFields.harvinScoreBreakdown = hsResult.breakdown;
        setFields.harvinScoreReasons = hsResult.reasons.slice(0, 5);
        setFields.harvinMaturity = hsResult.maturity;
        setFields.harvinScoreUpdatedAt = new Date();
      } catch (scoreErr) {
        // Fallback: keep existing score if v1 scoring fails
        if (existing?.harvinScore) setFields.harvinScore = existing.harvinScore;
      }
    }

    await db.collection('company_meta').updateOne(
      { normalizedDomain },
      {
        $set: setFields,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  } catch {}

  // Override result for Non-D2C brands so the API response is correct
  if (isNonD2C) {
    result.category = 'Not Required';
    result.subCategory = 'Non D2C Brand';
    result.categoryConfidence = 'high';
    result.businessModel = null;
    result.isNonD2C = true;
    result.nonD2CReason = nonD2CReason;
  }

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

module.exports = { extractCompanyMeta, INDIA_STATES, INDIA_CITY_STATE, CITY_ALIASES, normalizeCity, formatDisplayLocation, lookupKnownBrand, D2C_ELIGIBLE_CATEGORIES, analyzeKeywords, extractFromMeta, CLASSIFIER_VERSION };
