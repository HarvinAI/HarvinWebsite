import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

export const maxDuration = 10;

type SessionUser = { id?: string; email?: string | null; name?: string | null };

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser)?.id || null;
}

// GET /api/watchlists — list all watchlists for current user
// GET /api/watchlists?id=xyz — get a specific watchlist with its accounts
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const watchlistId = req.nextUrl.searchParams.get('id');

  if (watchlistId) {
    // Single watchlist with enriched account data
    const wl = await db.collection('watchlists').findOne({
      _id: watchlistId,
      userId,
    });
    if (!wl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Enrich domains with company_meta
    let accounts: Record<string, unknown>[] = [];
    if (wl.domains?.length) {
      const docs = await db.collection('company_meta').find({
        normalizedDomain: { $in: wl.domains },
      }).toArray();
      const byDomain = new Map<string, Record<string, unknown>>(docs.map((d: Record<string, unknown>) => [d.normalizedDomain as string, d]));
      accounts = wl.domains.map((domain: string) => {
        const doc = byDomain.get(domain);
        return {
          normalizedDomain: domain,
          category: (doc?.category as string) || 'Unknown',
          subCategory: (doc?.subCategory as string) || '',
          region: (doc?.region as string) || 'Global',
          offlineStores: (doc?.offlineStores as string) || 'Unknown',
          updatedAt: doc?.updatedAt || null,
        };
      });
    }

    return NextResponse.json({ ...wl, accounts });
  }

  // List all watchlists
  const watchlists = await db.collection('watchlists').find({ userId }).toArray();
  return NextResponse.json({ watchlists });
}

// POST /api/watchlists — create new watchlist OR add domain to existing
// Body: { name: "My List" }  → create
// Body: { id: "xyz", domain: "nike.com" }  → add domain
// Body: { id: "xyz", domain: "nike.com", remove: true }  → remove domain
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = await getDb();
  const col = db.collection('watchlists');

  // Create new watchlist
  if (body.name && !body.id) {
    const id = `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const doc = {
      _id: id,
      userId,
      name: body.name.trim(),
      domains: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await col.insertOne(doc);
    return NextResponse.json(doc, { status: 201 });
  }

  // Add or remove domain from existing watchlist
  if (body.id && body.domain) {
    const domain = body.domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');

    if (body.remove) {
      await col.updateOne(
        { _id: body.id, userId },
        { $pull: { domains: domain }, $set: { updatedAt: new Date() } }
      );
      return NextResponse.json({ ok: true, action: 'removed', domain });
    }

    // Add (avoid duplicates)
    await col.updateOne(
      { _id: body.id, userId },
      { $addToSet: { domains: domain }, $set: { updatedAt: new Date() } }
    );
    return NextResponse.json({ ok: true, action: 'added', domain });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

// DELETE /api/watchlists?id=xyz — delete entire watchlist
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = await getDb();
  await db.collection('watchlists').deleteOne({ _id: id, userId });
  return NextResponse.json({ ok: true });
}

// PATCH /api/watchlists — rename watchlist
// Body: { id: "xyz", name: "New Name" }
export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.id || !body.name) return NextResponse.json({ error: 'id and name required' }, { status: 400 });

  const db = await getDb();
  await db.collection('watchlists').updateOne(
    { _id: body.id, userId },
    { $set: { name: body.name.trim(), updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true });
}
