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

/* ── Decision-maker contact generation ────────────────────────────────
 * Generates deterministic mock contacts per domain so results are stable
 * across page loads. When real contacts DB is available, replace this.
 */
const FIRST_NAMES = ['Aarav','Priya','Rahul','Ananya','Vikram','Sneha','Arjun','Kavya','Rohan','Meera','Aditya','Neha','Karan','Pooja','Siddharth','Divya','Amit','Riya','Nikhil','Anjali','Varun','Shreya','Deepak','Tanvi','Harsh','Simran','Rajesh','Nisha','Manish','Swati'];
const LAST_NAMES = ['Sharma','Patel','Gupta','Singh','Kumar','Agarwal','Reddy','Joshi','Mehta','Iyer','Verma','Shah','Nair','Rao','Chatterjee','Bhatia','Malhotra','Saxena','Kapoor','Das'];
const ROLES = ['Founder / Co-Founder','CEO','CTO','CMO','VP Marketing','VP Sales','VP Product','Head of Marketing','Head of Sales','Head of Product','Head of Operations','Director of Marketing','Director of Engineering','Director of Growth','Product Manager','Marketing Manager','Sales Manager','Operations Manager'];
const DEPARTMENTS = ['Founder','C-Suite','C-Suite','C-Suite','Marketing','Sales','Product','Marketing','Sales','Product','Operations','Marketing','Engineering','Marketing','Product','Marketing','Sales','Operations'];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generateContacts(domain: string): { name: string; email: string; title: string; department: string }[] {
  const h = hashStr(domain);
  const count = 2 + (h % 5); // 2-6 contacts per company
  const contacts: { name: string; email: string; title: string; department: string }[] = [];
  const usedRoles = new Set<number>();
  for (let i = 0; i < count; i++) {
    const seed = hashStr(domain + i.toString());
    const first = FIRST_NAMES[seed % FIRST_NAMES.length];
    const last = LAST_NAMES[(seed >> 4) % LAST_NAMES.length];
    let roleIdx = (seed >> 8) % ROLES.length;
    // Ensure founder/CEO always first if count > 2
    if (i === 0) roleIdx = h % 2; // Founder or CEO
    while (usedRoles.has(roleIdx) && usedRoles.size < ROLES.length) roleIdx = (roleIdx + 1) % ROLES.length;
    usedRoles.add(roleIdx);
    const emailDomain = domain.replace(/^www\./, '');
    contacts.push({
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${emailDomain}`,
      title: ROLES[roleIdx],
      department: DEPARTMENTS[roleIdx],
    });
  }
  return contacts;
}

// GET /api/watchlists — list all watchlists for current user
// GET /api/watchlists?id=xyz — get a specific watchlist with its accounts + contacts
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const watchlistId = req.nextUrl.searchParams.get('id');

  if (watchlistId) {
    // Single watchlist with enriched account data + contacts
    const wl = await db.collection('watchlists').findOne({
      _id: watchlistId,
      userId,
    });
    if (!wl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let accounts: Record<string, unknown>[] = [];
    let totalContacts = 0;
    if (wl.domains?.length) {
      const docs = await db.collection('company_meta').find({
        normalizedDomain: { $in: wl.domains },
      }).project({
        _id: 0, normalizedDomain: 1, category: 1, subCategory: 1, region: 1, state: 1,
        offlineStores: 1, businessModel: 1, monthlyVisitsFormatted: 1, appPresence: 1,
        techCount: 1, harvinScore: 1, brandName: 1, updatedAt: 1,
      }).toArray();
      const byDomain = new Map<string, Record<string, unknown>>(docs.map((d: Record<string, unknown>) => [d.normalizedDomain as string, d]));
      accounts = wl.domains.map((domain: string) => {
        const doc = byDomain.get(domain);
        const contacts = generateContacts(domain);
        totalContacts += contacts.length;
        return {
          normalizedDomain: domain,
          category: (doc?.category as string) || 'Unknown',
          subCategory: (doc?.subCategory as string) || '',
          region: (doc?.region as string) || 'Global',
          state: (doc?.state as string) || '',
          offlineStores: (doc?.offlineStores as string) || 'Unknown',
          businessModel: (doc?.businessModel as string) || '',
          monthlyVisitsFormatted: (doc?.monthlyVisitsFormatted as string) || '',
          appPresence: (doc?.appPresence as string) || '',
          techCount: (doc?.techCount as number) || 0,
          harvinScore: (doc?.harvinScore as number) || 0,
          brandName: (doc?.brandName as string) || '',
          updatedAt: doc?.updatedAt || null,
          contacts,
        };
      });
    }

    return NextResponse.json({ ...wl, accounts, totalContacts });
  }

  // List all watchlists with summary stats (fast — no contact generation)
  const watchlists = await db.collection('watchlists').find({ userId }).sort({ updatedAt: -1 }).toArray();
  const list = watchlists.map((wl: Record<string, unknown>) => ({
    ...wl,
    contactCount: ((wl.domains as string[]) || []).length * 3, // Estimate ~3 contacts per domain (fast)
  }));
  return NextResponse.json({ watchlists: list });
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
    return NextResponse.json({ watchlist: doc }, { status: 201 });
  }

  // Bulk add domains to existing watchlist (single request instead of N)
  if (body.id && body.domains && Array.isArray(body.domains)) {
    const cleanDomains = (body.domains as string[]).map((d: string) =>
      d.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '')
        .replace(/^(?:en|ar|fr|de|es|it|pt|ja|ko|zh|ru|hi|th|vi|m|mobile|shop|store|app|my|web|online|buy)[-_.]/i, '')
        .replace(/\/.*$/, '')
    ).filter(Boolean);
    if (cleanDomains.length > 0) {
      await col.updateOne(
        { _id: body.id, userId },
        { $addToSet: { domains: { $each: cleanDomains } }, $set: { updatedAt: new Date() } }
      );
    }
    const updated = await col.findOne({ _id: body.id, userId });
    return NextResponse.json({ ok: true, action: 'bulk_added', count: cleanDomains.length, watchlist: updated });
  }

  // Add or remove single domain from existing watchlist
  if (body.id && body.domain) {
    const domain = body.domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\d*\./i, '').replace(/^(?:en|ar|fr|de|es|it|pt|ja|ko|zh|ru|hi|th|vi|m|mobile|shop|store|app|my|web|online|buy)[-_.]/i, '').replace(/\/.*$/, '');

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
