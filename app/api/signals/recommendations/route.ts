import { NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const db = await getDb();
    const scoresCol = db.collection('signal_scores');
    const metaCol = db.collection('company_meta');

    // Get top 100 recommended accounts
    const scores = await scoresCol.find({ recommended: true })
      .sort({ totalScore: -1 })
      .limit(100)
      .project({ _id: 0 })
      .toArray();

    if (scores.length === 0) {
      return NextResponse.json({ accounts: [] }, { headers: corsHeaders });
    }

    // Join with company_meta for category, region, traffic
    const domains = scores.map((s: Record<string, unknown>) => s.domain as string);
    const metaDocs = await metaCol.find(
      { normalizedDomain: { $in: domains } }
    ).project({
      _id: 0,
      normalizedDomain: 1,
      category: 1,
      region: 1,
      monthlyVisits: 1,
      monthlyVisitsFormatted: 1,
    }).toArray();

    const metaMap: Record<string, Record<string, unknown>> = {};
    for (const doc of metaDocs) {
      metaMap[doc.normalizedDomain as string] = doc;
    }

    const accounts = scores.map((score: Record<string, unknown>) => {
      const domain = score.domain as string;
      const meta = metaMap[domain] || {};
      return {
        domain,
        name: domainToBrand(domain),
        category: meta.category || null,
        region: meta.region || null,
        monthlyVisits: meta.monthlyVisits || null,
        monthlyVisitsFormatted: meta.monthlyVisitsFormatted || null,
        score: score.totalScore,
        signalCount: score.signalCount,
        signals: score.signals || [],
        topSignal: score.topSignal,
        reason: score.recommendedReason,
        lastSignalDate: score.lastSignalDate,
      };
    });

    return NextResponse.json({ accounts }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[recommendations API] error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch recommendations' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/** Extract brand name from domain */
function domainToBrand(domain: string): string {
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
