/**
 * Store deduplication module.
 * Removes duplicate store entries based on coordinates, addresses, and names.
 */

/**
 * Deduplicate an array of store objects.
 * Uses multi-pass deduplication: coordinates → normalized address → fuzzy name.
 * @param {Array} stores - Array of store objects with optional lat, lng, address, city, name fields
 * @returns {Array} Deduplicated store array
 */
function deduplicateStores(stores) {
  if (!Array.isArray(stores) || stores.length <= 1) return stores;

  const seen = new Set();
  const unique = [];

  for (const store of stores) {
    const keys = getDeduplicationKeys(store);
    let isDuplicate = false;

    for (const key of keys) {
      if (key && seen.has(key)) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      for (const key of keys) {
        if (key) seen.add(key);
      }
      unique.push(store);
    }
  }

  return unique;
}

/**
 * Generate deduplication keys for a store object.
 * Returns an array of keys — if any key matches, it's a duplicate.
 */
function getDeduplicationKeys(store) {
  const keys = [];

  // Key 1: Coordinate-based (rounded to ~10m precision)
  const lat = parseFloat(store.lat || store.latitude);
  const lng = parseFloat(store.lng || store.longitude || store.lon || store.long);
  if (!isNaN(lat) && !isNaN(lng)) {
    keys.push(`coord:${lat.toFixed(4)},${lng.toFixed(4)}`);
  }

  // Key 2: Normalized address
  const address = normalizeAddress(
    [store.address, store.street, store.address_line_1].filter(Boolean).join(' '),
    store.city,
    store.zip || store.zipcode || store.postal_code || store.postalcode || store.pincode
  );
  if (address) keys.push(`addr:${address}`);

  // Key 3: Store name + city (fuzzy)
  const name = normalizeName(store.name || store.store_name || store.storeName || store.location_name);
  const city = normalizeName(store.city);
  if (name && city) keys.push(`name:${name}@${city}`);

  // Key 4: Store ID (if available)
  const id = store.store_id || store.storeId || store.id || store.store_code;
  if (id) keys.push(`id:${id}`);

  return keys;
}

function normalizeAddress(address, city, zip) {
  if (!address && !zip) return null;
  let normalized = (address || '').toLowerCase()
    .replace(/[,.\-#]/g, ' ')
    .replace(/\b(street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|floor|fl|suite|ste|unit|apt|apartment)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (city) normalized += '|' + city.toLowerCase().trim();
  if (zip) normalized += '|' + String(zip).replace(/\s/g, '');
  return normalized || null;
}

function normalizeName(str) {
  if (!str) return null;
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim() || null;
}

module.exports = { deduplicateStores };
