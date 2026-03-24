import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { lookupKnownBrand, normalizeCity, formatDisplayLocation, INDIA_CITY_STATE } = require('@/lib/scan/companyMeta');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function normalizeDomain(raw: string): string {
  return raw.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\d*\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .replace(/[,\s]+/g, '');
}

function domainToName(domain: string): string {
  let base = domain.replace(/^www\d*\./, '').split('.')[0];
  const _px = /^(with|get|try|use|go|hey|the|my|our|join|meet|hello)(?=[a-z]{3,})/i.exec(base);
  if (_px && base.length > _px[1].length + 2) base = base.slice(_px[1].length);
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

function fixLocation(region: string | null, state: string | null, city: string | null) {
  const KNOWN_CITIES_MAP = INDIA_CITY_STATE as Record<string, string>;
  let r = region || 'Global', s = state, c = city ? normalizeCity(city) : null;
  if (r && r !== 'Global') {
    const rLower = r.toLowerCase().trim();
    if (KNOWN_CITIES_MAP[rLower]) {
      if (!c) c = normalizeCity(r);
      s = s || KNOWN_CITIES_MAP[rLower];
      r = 'India';
    }
  }
  return { region: r, state: s, city: c };
}

/**
 * GET /api/universe?email=...
 * Returns all universe domains with enriched account data
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400, headers: corsHeaders });
  }

  try {
    const db = await getDb();
    const universeCol = db.collection('user_universes');
    const metaCol = db.collection('company_meta');

    // Get user's universe
    const universeDoc = await universeCol.findOne({ email: email.toLowerCase() });
    if (!universeDoc || !universeDoc.domains?.length) {
      return NextResponse.json({ accounts: [], total: 0, pendingScan: [], statuses: {} }, { headers: corsHeaders });
    }

    const domains = universeDoc.domains as string[];
    const statuses = (universeDoc.statuses || {}) as Record<string, string>;

    // Fetch enriched data from company_meta
    const metaDocs = await metaCol.find({ normalizedDomain: { $in: domains } })
      .project({
        _id: 0,
        normalizedDomain: 1,
        category: 1, subCategory: 1,
        region: 1, state: 1, city: 1,
        offlineStores: 1, businessModel: 1,
        monthlyVisits: 1, monthlyVisitsFormatted: 1,
        appPresence: 1, techCount: 1, techStack: 1,
        updatedAt: 1,
      })
      .toArray();

    const metaMap: Record<string, Record<string, unknown>> = {};
    for (const doc of metaDocs) {
      metaMap[doc.normalizedDomain as string] = doc;
    }

    // Also fetch tech from tech_cache
    const techDocs = await db.collection('tech_cache').find({ domain: { $in: domains } })
      .project({ domain: 1, technologies: 1, count: 1, _id: 0 }).toArray();
    const techMap: Record<string, { names: string[]; count: number }> = {};
    for (const td of techDocs) {
      const techs = (td.technologies || []) as { name: string }[];
      techMap[td.domain as string] = {
        names: techs.map(t => t.name).slice(0, 10),
        count: (td.count as number) || techs.length,
      };
    }

    const pendingScan: string[] = [];

    const accounts = domains.map(domain => {
      const a = metaMap[domain] || {};
      const kb = lookupKnownBrand(domain);
      const hasData = !!metaMap[domain];

      if (!hasData) pendingScan.push(domain);

      const loc = fixLocation(
        kb?.region || a.region as string | null,
        a.state as string | null,
        a.city as string | null,
      );
      const offlineStores = kb?.stores || a.offlineStores || 'Unknown';
      const { displayLocation } = formatDisplayLocation({ ...loc, offlineStores });
      const hasTraffic = (a.monthlyVisits as number) > 0;
      const techCache = techMap[domain];
      const techStack = (a.techStack as string[] || []).length > 0 ? a.techStack as string[] : (techCache?.names || []);
      const techCount = (a.techCount as number) || techCache?.count || 0;

      return {
        normalizedDomain: domain,
        name: domainToName(domain),
        category: kb?.category || a.category || 'Unknown',
        subCategory: kb?.subCategory || a.subCategory || 'General',
        region: loc.region,
        displayLocation,
        offlineStores,
        businessModel: a.businessModel || null,
        monthlyVisits: hasTraffic ? a.monthlyVisits : null,
        monthlyVisitsFormatted: hasTraffic ? a.monthlyVisitsFormatted : null,
        appPresence: a.appPresence || 'No App',
        techCount,
        techStack,
        updatedAt: a.updatedAt || null,
        scanned: hasData,
      };
    });

    return NextResponse.json({
      accounts,
      total: accounts.length,
      statuses,
      pendingScan: pendingScan.length,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error('[universe GET] error:', err);
    return NextResponse.json({ error: 'Failed to fetch universe' }, { status: 500, headers: corsHeaders });
  }
}

/**
 * POST /api/universe
 * Body: { email, domains: string[] } — add domains to user's universe
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, domains: rawDomains } = body;

    if (!email || !rawDomains?.length) {
      return NextResponse.json({ error: 'Email and domains required' }, { status: 400, headers: corsHeaders });
    }

    // Normalize & deduplicate domains
    const newDomains = [...new Set(
      (rawDomains as string[])
        .map(d => normalizeDomain(d))
        .filter(d => d && d.includes('.') && d.length > 3)
    )];

    if (newDomains.length === 0) {
      return NextResponse.json({ error: 'No valid domains found in upload' }, { status: 400, headers: corsHeaders });
    }

    const db = await getDb();
    const col = db.collection('user_universes');

    // Upsert: add new domains to existing set (no duplicates)
    await col.updateOne(
      { email: email.toLowerCase() },
      {
        $addToSet: { domains: { $each: newDomains } },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    // Get updated doc to return count
    const doc = await col.findOne({ email: email.toLowerCase() });
    const totalDomains = (doc?.domains || []).length;

    // Check which domains need scanning (not in company_meta)
    const metaCol = db.collection('company_meta');
    const existing = await metaCol.find(
      { normalizedDomain: { $in: newDomains } },
      { projection: { normalizedDomain: 1 } },
    ).toArray();
    const existingSet = new Set(existing.map((d: Record<string, unknown>) => d.normalizedDomain as string));
    const needsScan = newDomains.filter(d => !existingSet.has(d));

    return NextResponse.json({
      added: newDomains.length,
      total: totalDomains,
      needsScan: needsScan.length,
      domains: newDomains,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error('[universe POST] error:', err);
    return NextResponse.json({ error: 'Failed to upload universe' }, { status: 500, headers: corsHeaders });
  }
}

/**
 * DELETE /api/universe
 * Body: { email, domains?: string[] } — remove specific domains or clear all
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, domains } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400, headers: corsHeaders });
    }

    const db = await getDb();
    const col = db.collection('user_universes');

    if (domains && domains.length > 0) {
      // Remove specific domains
      await col.updateOne(
        { email: email.toLowerCase() },
        { $pullAll: { domains: domains } },
      );
    } else {
      // Clear all domains
      await col.updateOne(
        { email: email.toLowerCase() },
        { $set: { domains: [], updatedAt: new Date() } },
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error('[universe DELETE] error:', err);
    return NextResponse.json({ error: 'Failed to update universe' }, { status: 500, headers: corsHeaders });
  }
}

/**
 * PATCH /api/universe
 * Body: { email, domain, status } — update status for a specific domain
 * Status: 'in-conversation' | 'active-client' | 'churned-client' | '' (clear)
 */
export async function PATCH(req: NextRequest) {
  try {
    const { email, domain, status } = await req.json();
    if (!email || !domain) {
      return NextResponse.json({ error: 'Email and domain required' }, { status: 400, headers: corsHeaders });
    }

    const db = await getDb();
    const col = db.collection('user_universes');

    if (status) {
      await col.updateOne(
        { email: email.toLowerCase() },
        { $set: { [`statuses.${domain}`]: status, updatedAt: new Date() } },
      );
    } else {
      await col.updateOne(
        { email: email.toLowerCase() },
        { $unset: { [`statuses.${domain}`]: '' }, $set: { updatedAt: new Date() } },
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error('[universe PATCH] error:', err);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500, headers: corsHeaders });
  }
}
