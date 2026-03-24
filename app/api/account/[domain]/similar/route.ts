import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

/** Safely convert any DB value to a plain string — handles objects like {@type, name} */
function safeStr(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    if ('name' in (val as Record<string, unknown>)) return String((val as Record<string, unknown>).name);
    return JSON.stringify(val);
  }
  return String(val);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  const sp = req.nextUrl.searchParams;

  // Similarity criteria — supports comma-separated multi-select
  const basisParam = sp.get('basis') || 'category';
  const bases = basisParam.split(',').filter(Boolean);
  const limit = Math.min(1000, Math.max(1, parseInt(sp.get('limit') || '500', 10)));

  try {
    const db = await getDb();
    const col = db.collection('company_meta');

    // Get the source account
    const source = await col.findOne({ normalizedDomain });
    if (!source) {
      return NextResponse.json({ accounts: [], basis: basisParam, source: null }, { headers: corsHeaders });
    }

    // Build query — ALWAYS stay within the same category, then apply additional filters
    // This prevents vague/unrelated results when combining filters
    const query: Record<string, unknown> = {
      normalizedDomain: { $ne: normalizedDomain },
      category: source.category && source.category !== 'Unknown' ? source.category : { $exists: true, $nin: [null, '', 'Unknown'] },
    };

    const labels: string[] = [];
    if (source.category && source.category !== 'Unknown') {
      labels.push(safeStr(source.category));
    }

    for (const basis of bases) {
      switch (basis) {
        case 'category':
          // Already applied above as base filter
          break;
        case 'tech': {
          const sourceTech = (source.techStack || []) as string[];
          if (sourceTech.length > 0) {
            query.techStack = { $in: sourceTech };
            labels.push('Similar tech');
          }
          break;
        }
        case 'appPresence': {
          const ap = safeStr(source.appPresence, 'No App');
          query.appPresence = ap;
          labels.push(ap);
          break;
        }
        case 'offlineStores': {
          const os = safeStr(source.offlineStores, 'Online');
          query.offlineStores = os;
          labels.push(`${os} stores`);
          break;
        }
        case 'businessModel': {
          const bm = source.businessModel;
          if (bm) {
            query.businessModel = bm;
          } else {
            query.$or = [{ businessModel: null }, { businessModel: { $exists: false } }, { businessModel: 'Pure D2C' }];
          }
          labels.push(safeStr(bm, 'Pure D2C'));
          break;
        }
        case 'region':
          if (source.region) {
            query.region = source.region;
            labels.push(safeStr(source.region));
          }
          break;
      }
    }

    const basisLabel = labels.join(' · ');

    const docs = await col.find(query)
      .sort({ monthlyVisits: -1 })
      .limit(limit)
      .project({
        _id: 0,
        normalizedDomain: 1,
        category: 1,
        subCategory: 1,
        region: 1,
        offlineStores: 1,
        businessModel: 1,
        appPresence: 1,
        monthlyVisitsFormatted: 1,
        techStack: 1,
      })
      .toArray();

    const accounts = docs.map((d: Record<string, unknown>) => ({
      normalizedDomain: safeStr(d.normalizedDomain),
      name: domainToName(safeStr(d.normalizedDomain)),
      category: safeStr(d.category, 'Unknown'),
      subCategory: safeStr(d.subCategory, 'General'),
      region: safeStr(d.region, 'Global'),
      offlineStores: safeStr(d.offlineStores, 'Unknown'),
      businessModel: safeStr(d.businessModel) || null,
      appPresence: safeStr(d.appPresence, 'No App'),
      monthlyVisitsFormatted: safeStr(d.monthlyVisitsFormatted) || null,
      topTech: (Array.isArray(d.techStack) ? d.techStack.map((t: unknown) => safeStr(t)) : []).slice(0, 3),
    }));

    return NextResponse.json({
      accounts,
      basis: basisParam,
      basisLabel,
      total: accounts.length,
      source: {
        normalizedDomain: safeStr(source.normalizedDomain),
        name: domainToName(safeStr(source.normalizedDomain)),
        category: safeStr(source.category, 'Unknown'),
      },
    }, { headers: corsHeaders });
  } catch (err) {
    console.error('[similar] error:', err);
    return NextResponse.json({ error: 'Failed to fetch similar accounts' }, { status: 500, headers: corsHeaders });
  }
}
