import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

export async function POST(req: NextRequest) {
  try {
    const { url, field, value } = await req.json();
    if (!url || !field || !value) {
      return NextResponse.json({ error: 'url, field, and value are required' }, { status: 400 });
    }
    const validFields = ['category', 'subCategory', 'region', 'offlineStores'];
    if (!validFields.includes(field)) {
      return NextResponse.json({ error: `field must be one of: ${validFields.join(', ')}` }, { status: 400 });
    }

    const db = await getDb();
    const normalizedDomain = url.replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/\/.*$/, '').toLowerCase();

    await db.collection('company_meta').updateOne(
      { normalizedDomain },
      {
        $set: {
          normalizedDomain,
          [`overrides.${field}`]: value,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
