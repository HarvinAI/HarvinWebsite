import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/adminAuth';

const { getDb } = require('@/lib/scan/db');
const { scanSingleUrl } = require('@/lib/scan/scan');
const { CLASSIFIER_VERSION } = require('@/lib/scan/companyMeta');

// Re-classify accounts whose cached classification predates the current
// classifier version. Runs server-side on prod (direct DB access — no tunnel),
// so improvements to the classifier reach existing accounts. Gated by the
// admin token (x-admin-token header or ?token=), same as the other admin/cron
// endpoints. Idempotent + resumable: each call heals a throttled batch and the
// caller loops (or Cloud Scheduler pings it) until `remaining` reaches 0.

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Accounts still on an old classifier version (or never versioned). Known brands
// are excluded — their category comes from the curated KNOWN_BRANDS table.
const staleFilter = {
  normalizedDomain: { $exists: true, $nin: [null, '', 'harvin.ai'] },
  $or: [
    { classifierVersion: { $ne: CLASSIFIER_VERSION } },
    { classifierVersion: { $exists: false } },
  ],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const db = await getDb();
  const remaining = await db.collection('company_meta').countDocuments(staleFilter);
  const total = await db.collection('company_meta').countDocuments({});
  return NextResponse.json({ classifierVersion: CLASSIFIER_VERSION, remaining, total });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 15);
  // Spacing between scans so we stay under the Gemini free-tier ~15 req/min.
  const spacingMs = Math.max(Number(body.spacingMs) || 4500, 3000);

  const db = await getDb();
  const docs = await db.collection('company_meta')
    .find(staleFilter)
    .project({ normalizedDomain: 1, category: 1, subCategory: 1, categoryConfidence: 1 })
    // Lowest-confidence (most likely wrong) first, so the worst offenders heal first.
    .sort({ categoryConfidence: 1, updatedAt: 1 })
    .limit(limit)
    .toArray();

  const results: Array<Record<string, unknown>> = [];
  let changed = 0;
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const before = `${doc.category ?? '—'} / ${doc.subCategory ?? '—'}`;
    try {
      const r = await scanSingleUrl(doc.normalizedDomain, { forceRefresh: true, metaOnly: true });
      const m = r?.companyMeta || {};
      const after = `${m.category ?? '—'} / ${m.subCategory ?? '—'}`;
      const didChange = after !== before;
      if (didChange) changed++;
      results.push({ domain: doc.normalizedDomain, before, after, changed: didChange });
    } catch (e) {
      results.push({ domain: doc.normalizedDomain, before, error: (e as Error).message });
    }
    if (i < docs.length - 1) await sleep(spacingMs);
  }

  const remaining = await db.collection('company_meta').countDocuments(staleFilter);
  return NextResponse.json({ processed: results.length, changed, remaining, results });
}
