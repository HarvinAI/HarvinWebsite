import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeCity, formatDisplayLocation, INDIA_CITY_STATE, lookupKnownBrand } = require('@/lib/scan/companyMeta');

const SCALE_BANDS = [
  { label: '<50K',      min: 0,        max: 50000 },
  { label: '50K-200K',  min: 50000,    max: 200000 },
  { label: '200K-500K', min: 200000,   max: 500000 },
  { label: '500K-1M',   min: 500000,   max: 1000000 },
  { label: '1M-5M',     min: 1000000,  max: 5000000 },
  { label: '5M-20M',    min: 5000000,  max: 20000000 },
  { label: '20M+',      min: 20000000, max: Infinity },
];
function toScaleBand(mv: number | null | undefined): string | null {
  if (!mv || mv <= 0) return null;
  for (const b of SCALE_BANDS) {
    if (mv >= b.min && (b.max === Infinity || mv < b.max)) return b.label;
  }
  return null;
}

function normalizeDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/.*$/, '').toLowerCase();
}

function domainToName(domain: string): string {
  let base = domain.replace(/^www\d*\./, '').split('.')[0];
  const _px = /^(with|get|try|use|go|hey|the|my|our|join|meet|hello)(?=[a-z]{3,})/i.exec(base); if (_px && base.length > _px[1].length + 2) base = base.slice(_px[1].length);
  const W = new Set(['shop','store','mart','hub','club','box','lab','studio','house','home','world','zone','tech','digital','online','global','india','express','market','fashion','style','wear','clothing','couture','beauty','skin','care','hair','health','wellness','fitness','food','foods','kitchen','cafe','coffee','organic','fresh','farm','baby','kids','pet','life','lifestyle','living','decor','gold','silver','jewel','diamond','auto','car','bike','travel','pay','money','capital','bank','learn','academy','game','play','sport','media','news','smart','fast','easy','quick','super','big','new','first','best','top','pro','blue','green','red','black','white','star','sun','urban','city','royal','company','brand','basket','cart','bag','trunk','earth','nature','eco','pure','sugar','honey','pepper','kart','shoes','campus','cosmetics','stone','clue','biryan','tale','eye','face','body','flower','bloom','garden','snap','click','grow','edge','core','ware','goods','and','the','of','my','our','forty','winks']);
  const N = new Set(['nykaa','myntra','meesho','zepto','swiggy','zomato','flipkart','paytm','razorpay','phonepe','groww','cred','pepperfry','lenskart','bewakoof','ajio','mamaearth','mokobara','caratlane','healthandglow','shopclues']);
  const l = base.toLowerCase();
  if (base.includes('-') || base.includes('_')) return base.split(/[-_]/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  if (N.has(l) || base.length <= 6) return base.charAt(0).toUpperCase() + base.slice(1);
  let best: [string,string]|null = null, bs = 0;
  for (let i = 3; i < l.length - 2; i++) { const a = l.slice(0, i), b = l.slice(i); const ak = W.has(a), bk = W.has(b); if (!ak && !bk) continue; const s = (ak ? a.length : 0) + (bk ? b.length * 2 : 0); if (s > bs) { bs = s; best = [a, b]; } }
  if (best) return best.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function computeScore(meta: Record<string, unknown>, techCount: number): number {
  let score = 40; // base
  if (meta.category && meta.category !== 'Unknown') score += 10;
  if (meta.subCategory && meta.subCategory !== 'General') score += 5;
  if (meta.region && meta.region !== 'Global') score += 5;
  if (meta.offlineStores && meta.offlineStores !== 'Unknown' && meta.offlineStores !== 'Online') score += 10;
  if (techCount > 0) score += Math.min(techCount * 2, 20);
  if (meta.aiStoreCount && (meta.aiStoreCount as number) > 0) score += 10;
  return Math.min(score, 99);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain: rawDomain } = await params;
  const normalizedDomain = normalizeDomain(decodeURIComponent(rawDomain));

  try {
    const db = await getDb();
    const col = db.collection('company_meta');

    // Fetch the main account
    const doc = await col.findOne({ normalizedDomain });

    const overrides = doc?.overrides || {};
    // Apply known brand data (always takes priority over DB)
    const knownBrand = lookupKnownBrand(normalizedDomain);
    // Fix misclassified location fields (same logic as accounts list API)
    let region = knownBrand?.region || overrides.region || doc?.region || 'Global';
    let state: string | null = doc?.state || null;
    let city: string | null = normalizeCity(doc?.city) || null;
    const KNOWN_CITIES_MAP = INDIA_CITY_STATE as Record<string, string>;
    // If region is actually a city name
    if (region && region !== 'Global') {
      const rLower = (typeof region === 'string' ? region : '').toLowerCase().trim();
      if (rLower && KNOWN_CITIES_MAP[rLower]) {
        if (!city) city = normalizeCity(region);
        state = state || KNOWN_CITIES_MAP[rLower];
        region = 'India';
      }
    }
    // If state is actually a city name
    if (state) {
      const sLower = state.toLowerCase().trim();
      if (KNOWN_CITIES_MAP[sLower] && !Object.values(KNOWN_CITIES_MAP).includes(state)) {
        if (!city) city = normalizeCity(state);
        state = KNOWN_CITIES_MAP[sLower];
      }
    }
    const offlineStores = knownBrand?.stores || overrides.offlineStores || doc?.offlineStores || 'Unknown';
    const { displayLocation, locationLevel } = formatDisplayLocation({ region, state, city, offlineStores });
    const hasTrafficData = (doc?.monthlyVisits || 0) > 0;
    const meta = {
      normalizedDomain,
      name: domainToName(normalizedDomain),
      category: knownBrand?.category || overrides.category || doc?.category || 'Unknown',
      subCategory: knownBrand?.subCategory || overrides.subCategory || doc?.subCategory || 'General',
      region,
      state,
      city,
      displayLocation,
      locationLevel,
      offlineStores,
      aiStoreCount: doc?.aiStoreCount || 0,
      storeConfidence: doc?.storeConfidence || null,
      monthlyVisits: hasTrafficData ? (doc?.monthlyVisits || null) : null,
      monthlyVisitsFormatted: hasTrafficData ? (doc?.monthlyVisitsFormatted || null) : null,
      scaleBand: hasTrafficData ? toScaleBand(doc?.monthlyVisits) : null,
      businessModel: doc?.businessModel || null,
      appPresence: doc?.appPresence || 'No App',
      iosAppUrl: doc?.iosAppUrl || null,
      androidAppUrl: doc?.androidAppUrl || null,
      updatedAt: doc?.updatedAt || null,
      createdAt: doc?.createdAt || null,
    };

    // Similar accounts: same category, different domain, sorted by traffic, limit 6
    let similar: { normalizedDomain: string; name: string; category: string; subCategory: string }[] = [];
    if (meta.category && meta.category !== 'Unknown') {
      try {
        const similarDocs = await col.find({
          category: meta.category,
          normalizedDomain: { $ne: normalizedDomain },
          adminHidden: { $ne: true },
        })
          .sort({ monthlyVisits: -1 })
          .limit(6)
          .project({
            _id: 0,
            normalizedDomain: 1,
            category: 1,
            subCategory: 1,
            overrides: 1,
          })
          .toArray();
        similar = similarDocs.map((d: Record<string, unknown>) => ({
          normalizedDomain: d.normalizedDomain as string,
          name: domainToName(d.normalizedDomain as string),
          category: (d.overrides as Record<string, unknown>)?.category as string || d.category as string || '',
          subCategory: (d.overrides as Record<string, unknown>)?.subCategory as string || d.subCategory as string || '',
        }));
      } catch (e) {
        console.error('[account] similar query error:', e);
      }
    }

    const score = computeScore(meta, 0); // tech count added client-side

    return NextResponse.json({
      ...meta,
      score,
      similar,
      found: !!doc,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[account] error:', err);
    return NextResponse.json({
      normalizedDomain,
      name: domainToName(normalizedDomain),
      category: 'Unknown',
      subCategory: 'General',
      region: 'Global',
      state: null,
      city: null,
      displayLocation: 'Global',
      locationLevel: 'global',
      offlineStores: 'Unknown',
      aiStoreCount: 0,
      storeConfidence: null,
      monthlyVisits: null,
      monthlyVisitsFormatted: null,
      scaleBand: null,
      businessModel: null,
      appPresence: 'No App',
      iosAppUrl: null,
      androidAppUrl: null,
      updatedAt: null,
      createdAt: null,
      score: 40,
      similar: [],
      found: false,
    });
  }
}
