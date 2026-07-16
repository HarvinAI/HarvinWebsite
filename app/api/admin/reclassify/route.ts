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

// Target the accounts actually likely to be WRONG: those on an old classifier
// version AND either low/unknown confidence or an empty/Unknown category. This
// deliberately skips medium/high-confidence accounts (mostly already correct) so
// we fix the low-confidence mistakes without churning good classifications.
// ($ne / $in:[null] also match missing fields, so this covers un-versioned and
// un-scored docs too.)
const staleFilter = {
  normalizedDomain: { $exists: true, $nin: [null, '', 'harvin.ai'] },
  classifierVersion: { $ne: CLASSIFIER_VERSION },
  $or: [
    { categoryConfidence: { $in: ['low', null] } },
    { category: { $in: [null, '', 'Unknown'] } },
  ],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Read from the primary so the count/find reflect writes we just made — otherwise
// a lagged secondary can report 0 stale while accounts still need healing, stalling
// the loop.
const primary = { readPreference: 'primary' as const };

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const db = await getDb();
  const remaining = await db.collection('company_meta').countDocuments(staleFilter, primary);
  const total = await db.collection('company_meta').countDocuments({}, primary);
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
    .find(staleFilter, primary)
    .project({ normalizedDomain: 1, category: 1, subCategory: 1, categoryConfidence: 1 })
    // Lowest-confidence (most likely wrong) first, so the worst offenders heal first.
    .sort({ categoryConfidence: 1, updatedAt: 1 })
    .limit(limit)
    .toArray();

  const isVagueSub = (s: unknown) => !s || /^(general|unknown|other|n\/?a)$/i.test(String(s));
  const isRealCat = (c: unknown) => !!c && c !== 'Unknown' && c !== 'Not Required';

  const results: Array<Record<string, unknown>> = [];
  let changed = 0;
  let kept = 0;
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const oldCat = doc.category, oldSub = doc.subCategory;
    const before = `${oldCat ?? '—'} / ${oldSub ?? '—'}`;
    try {
      const r = await scanSingleUrl(doc.normalizedDomain, { forceRefresh: true, metaOnly: true });
      const m = r?.companyMeta || {};

      // Degradation guard: a re-scan (fetch can be flaky/blocked) must never make
      // a previously-good classification WORSE. If the new result lost the
      // category or turned a specific sub-category into a vague one, restore the
      // old values — while keeping the freshly-stamped classifierVersion so the
      // account is considered healed and won't re-loop.
      let after = `${m.category ?? '—'} / ${m.subCategory ?? '—'}`;
      let guarded = false;
      if (isRealCat(oldCat) && !isRealCat(m.category)) {
        // Lost the category entirely → full revert.
        await db.collection('company_meta').updateOne(
          { normalizedDomain: doc.normalizedDomain },
          { $set: { category: oldCat, subCategory: oldSub } },
        );
        after = before; guarded = true;
      } else if (oldCat === m.category && !isVagueSub(oldSub) && isVagueSub(m.subCategory)) {
        // Same category but the sub-category got vaguer → keep the specific sub.
        await db.collection('company_meta').updateOne(
          { normalizedDomain: doc.normalizedDomain },
          { $set: { subCategory: oldSub } },
        );
        after = `${m.category} / ${oldSub}`; guarded = true;
      }

      const didChange = after !== before;
      if (didChange) changed++;
      if (guarded) kept++;
      results.push({ domain: doc.normalizedDomain, before, after, changed: didChange, guarded });
    } catch (e) {
      // The scan failed hard (unreachable/blocked domain). Stamp the current
      // version so this domain isn't retried forever — it keeps whatever category
      // it already had and simply exits the heal queue.
      await db.collection('company_meta').updateOne(
        { normalizedDomain: doc.normalizedDomain },
        { $set: { classifierVersion: CLASSIFIER_VERSION } },
      ).catch(() => {});
      results.push({ domain: doc.normalizedDomain, before, error: (e as Error).message });
    }
    if (i < docs.length - 1) await sleep(spacingMs);
  }

  const remaining = await db.collection('company_meta').countDocuments(staleFilter, primary);
  return NextResponse.json({ processed: results.length, changed, remaining, results });
}
