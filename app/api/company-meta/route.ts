import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 5;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { lookupKnownBrand } = require('@/lib/scan/companyMeta');

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\d*\./i, '')
    .replace(/^(?:en|ar|fr|de|es|it|pt|ja|ko|zh|ru|hi|th|vi|m|mobile|shop|store|app|my|web|online|buy)[-_.]/i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain');
  if (!domain) {
    return NextResponse.json({ error: 'domain query param required' }, { status: 400 });
  }

  const normalizedDomain = normalizeDomain(domain);

  try {
    const db = await getDb();
    const doc = await db.collection('company_meta').findOne({ normalizedDomain });

    if (!doc) {
      return NextResponse.json({ found: false });
    }

    // Check for overrides sub-document
    const overrides = doc.overrides || {};
    // Known-brand data is authoritative (same precedence as the accounts/account APIs)
    const knownBrand = lookupKnownBrand(normalizedDomain) || {};

    return NextResponse.json({
      found: true,
      data: {
        category: knownBrand.category || overrides.category || doc.category || null,
        subCategory: knownBrand.subCategory || overrides.subCategory || doc.subCategory || null,
        region: knownBrand.region || overrides.region || doc.region || null,
        offlineStores: knownBrand.stores || overrides.offlineStores || doc.offlineStores || null,
        storeRawCount: doc.storeRawCount || 0,
        businessModel: doc.businessModel || null,
        appPresence: doc.appPresence || null,
        monthlyVisitsFormatted: doc.monthlyVisitsFormatted || null,
        aiStoreCount: doc.aiStoreCount || null,
        storeConfidence: doc.storeConfidence || null,
        updatedAt: doc.updatedAt || null,
      },
    });
  } catch (err) {
    console.error('[company-meta] DB error:', err);
    return NextResponse.json({ found: false });
  }
}
