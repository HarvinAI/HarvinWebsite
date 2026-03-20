import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function domainToName(domain: string): string {
  const base = domain.replace(/^www\d*\./, '').split('.')[0];
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

    // Build query — OR logic: match ANY of the selected filters
    // This ensures all combinations work and returns maximum results
    const orConditions: Record<string, unknown>[] = [];
    const labels: string[] = [];

    for (const basis of bases) {
      switch (basis) {
        case 'category':
          if (source.category && source.category !== 'Unknown') {
            orConditions.push({ category: source.category });
            labels.push(source.category as string);
          }
          break;
        case 'tech': {
          const sourceTech = (source.techStack || []) as string[];
          if (sourceTech.length > 0) {
            orConditions.push({ techStack: { $in: sourceTech } });
            labels.push('Similar tech');
          }
          break;
        }
        case 'appPresence': {
          const ap = source.appPresence || 'No App';
          orConditions.push({ appPresence: ap });
          labels.push(ap as string);
          break;
        }
        case 'offlineStores': {
          const os = source.offlineStores || 'Online';
          orConditions.push({ offlineStores: os });
          labels.push(`${os} stores`);
          break;
        }
        case 'businessModel': {
          const bm = source.businessModel;
          if (bm) {
            orConditions.push({ businessModel: bm });
          } else {
            orConditions.push({ $or: [{ businessModel: null }, { businessModel: { $exists: false } }, { businessModel: 'Pure D2C' }] });
          }
          labels.push((bm as string) || 'Pure D2C');
          break;
        }
        case 'region':
          if (source.region) {
            orConditions.push({ region: source.region });
            labels.push(source.region as string);
          }
          break;
      }
    }

    const query: Record<string, unknown> = {
      normalizedDomain: { $ne: normalizedDomain },
      category: { $exists: true, $nin: [null, '', 'Unknown'] },
    };

    if (orConditions.length === 1) {
      // Single filter — apply directly
      Object.assign(query, orConditions[0]);
    } else if (orConditions.length > 1) {
      // Multiple filters — OR logic (match ANY)
      query.$or = orConditions;
    } else {
      // No valid filters — fall back to category
      query.category = source.category;
      labels.push(source.category as string);
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
