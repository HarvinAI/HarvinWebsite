import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanSingleUrl } = require('@/lib/scan/scan');

export const maxDuration = 300;

/**
 * POST /api/backfill-location?batch=50
 * Re-scans existing company_meta docs that have no state/city to populate location fields.
 * Call repeatedly until done=true.
 */
export async function POST(req: NextRequest) {
  const batchSize = Math.min(50, parseInt(req.nextUrl.searchParams.get('batch') || '20', 10));

  try {
    const db = await getDb();
    const col = db.collection('company_meta');

    // Find docs that have no state/city fields
    const docs = await col.find({
      category: { $exists: true, $nin: [null, ''] },
      $or: [
        { state: { $exists: false } },
        { state: null },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(batchSize)
      .project({ normalizedDomain: 1 })
      .toArray();

    if (docs.length === 0) {
      const remaining = await col.countDocuments({
        category: { $exists: true, $nin: [null, ''] },
        $or: [{ state: { $exists: false } }, { state: null }],
      });
      return NextResponse.json({ done: true, remaining: 0, processed: 0, message: 'All docs already have location data' });
    }

    let processed = 0;
    let errors = 0;
    for (const doc of docs) {
      try {
        await scanSingleUrl(doc.normalizedDomain, { forceRefresh: true });
        processed++;
      } catch {
        // If scan fails, at least mark it so we don't retry it forever
        await col.updateOne(
          { normalizedDomain: doc.normalizedDomain },
          { $set: { state: null, city: null } }
        );
        errors++;
      }
    }

    const remaining = await col.countDocuments({
      category: { $exists: true, $nin: [null, ''] },
      $or: [{ state: { $exists: false } }, { state: null }],
    });

    return NextResponse.json({
      done: remaining === 0,
      processed,
      errors,
      remaining,
      message: `Processed ${processed} domains, ${errors} errors, ${remaining} remaining`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error?.message || 'Backfill failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = await getDb();
    const col = db.collection('company_meta');
    const total = await col.countDocuments({ category: { $exists: true, $nin: [null, ''] } });
    const withState = await col.countDocuments({ state: { $exists: true, $nin: [null, ''] } });
    const withCity = await col.countDocuments({ city: { $exists: true, $nin: [null, ''] } });
    const remaining = await col.countDocuments({
      category: { $exists: true, $nin: [null, ''] },
      $or: [{ state: { $exists: false } }, { state: null }],
    });
    return NextResponse.json({ total, withState, withCity, remaining });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
