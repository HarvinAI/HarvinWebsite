import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

function normalizeDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
}

function domainToName(domain: string): string {
  const base = domain.replace(/^www\./, '').split('.')[0];
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
    const meta = {
      normalizedDomain,
      name: domainToName(normalizedDomain),
      category: overrides.category || doc?.category || 'Unknown',
      subCategory: overrides.subCategory || doc?.subCategory || 'General',
      region: overrides.region || doc?.region || 'Global',
      offlineStores: overrides.offlineStores || doc?.offlineStores || 'Unknown',
      aiStoreCount: doc?.aiStoreCount || 0,
      storeConfidence: doc?.storeConfidence || null,
      updatedAt: doc?.updatedAt || null,
      createdAt: doc?.createdAt || null,
    };

    // Similar accounts: same category, different domain, limit 6
    let similar: { normalizedDomain: string; name: string; category: string; subCategory: string }[] = [];
    if (meta.category !== 'Unknown') {
      try {
        const cursor = col.find({
          category: meta.category,
          normalizedDomain: { $ne: normalizedDomain },
        });
        // If cursor supports limit
        const limitedCursor = cursor.limit ? cursor.limit(6) : cursor;
        const docs = await limitedCursor.toArray();
        similar = (docs || []).slice(0, 6).map((d: Record<string, unknown>) => ({
          normalizedDomain: d.normalizedDomain as string,
          name: domainToName(d.normalizedDomain as string),
          category: (d.overrides as Record<string, unknown>)?.category as string || d.category as string || '',
          subCategory: (d.overrides as Record<string, unknown>)?.subCategory as string || d.subCategory as string || '',
        }));
      } catch {}
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
      offlineStores: 'Unknown',
      aiStoreCount: 0,
      storeConfidence: null,
      updatedAt: null,
      createdAt: null,
      score: 40,
      similar: [],
      found: false,
    });
  }
}
