import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

export const maxDuration = 30;

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\d*\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

type EnrichRow = {
  domain: string;
  category: string | null;
  subCategory: string | null;
  businessModel: string | null;
  appPresence: string | null;
};

export async function POST(req: NextRequest) {
  let body: { domains?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawDomains = Array.isArray(body.domains) ? body.domains : [];
  if (rawDomains.length === 0) {
    return NextResponse.json({ error: 'domains array required' }, { status: 400 });
  }
  if (rawDomains.length > 5000) {
    return NextResponse.json({ error: 'Maximum 5,000 domains per request' }, { status: 400 });
  }

  const normalized = [...new Set(
    rawDomains
      .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
      .map(normalizeDomain)
      .filter(d => d.length > 0)
  )];

  try {
    const db = await getDb();
    const docs = await db.collection('company_meta')
      .find({ normalizedDomain: { $in: normalized } })
      .project({
        _id: 0,
        normalizedDomain: 1,
        category: 1,
        subCategory: 1,
        businessModel: 1,
        appPresence: 1,
        overrides: 1,
      })
      .toArray();

    const foundMap = new Map<string, EnrichRow>();
    for (const d of docs as Record<string, unknown>[]) {
      const overrides = (d.overrides || {}) as Record<string, unknown>;
      const domain = d.normalizedDomain as string;
      foundMap.set(domain, {
        domain,
        category: (overrides.category as string) || (d.category as string) || null,
        subCategory: (overrides.subCategory as string) || (d.subCategory as string) || null,
        businessModel: (overrides.businessModel as string) || (d.businessModel as string) || null,
        appPresence: (overrides.appPresence as string) || (d.appPresence as string) || null,
      });
    }

    const found: EnrichRow[] = [];
    const notFound: string[] = [];
    for (const dom of normalized) {
      const hit = foundMap.get(dom);
      if (hit) found.push(hit);
      else notFound.push(dom);
    }

    return NextResponse.json({ found, notFound, total: normalized.length });
  } catch (err) {
    console.error('[bulk-enrich] DB error:', err);
    return NextResponse.json({ error: (err as Error).message || 'Lookup failed' }, { status: 500 });
  }
}
