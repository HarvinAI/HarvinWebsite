import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeUrl } = require('@/lib/scan/fetch');

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url query param required' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const normalized = normalizeUrl(url);
    const corrections = await db.collection('corrections').find({ normalizedUrl: normalized }).toArray();
    return NextResponse.json({ corrections });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, techName, type, category } = await req.json();
    if (!url || !techName || !type) {
      return NextResponse.json({ error: 'url, techName, and type are required' }, { status: 400 });
    }
    if (!['false_positive', 'missing'].includes(type)) {
      return NextResponse.json({ error: 'type must be false_positive or missing' }, { status: 400 });
    }

    const db = await getDb();
    const normalized = normalizeUrl(url);
    const doc = {
      normalizedUrl: normalized,
      originalUrl: url,
      techName,
      type,
      ...(category ? { category } : {}),
      updatedAt: new Date(),
    };

    await db.collection('corrections').updateOne(
      { normalizedUrl: normalized, techName, type },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
