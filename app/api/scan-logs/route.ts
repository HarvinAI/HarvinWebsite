import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

export const maxDuration = 15;

/**
 * GET /api/scan-logs — admin-only endpoint to view scan usage data
 *
 * Query params:
 *   ?days=7        — look back N days (default 7, max 90)
 *   ?source=...    — filter by source: dashboard | extension | api | unknown
 *   ?domain=...    — filter by scanned domain (substring match)
 *   ?page=1        — pagination
 *   ?limit=50      — results per page (max 200)
 *   ?summary=1     — return aggregated stats instead of individual logs
 */
export async function GET(req: NextRequest) {
  // Admin-only
  const session = await getServerSession(authOptions) as { isAdmin?: boolean } | null;
  if (!session?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const days = Math.min(90, Math.max(1, parseInt(sp.get('days') || '7', 10)));
  const source = sp.get('source') || '';
  const domain = sp.get('domain') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50', 10)));
  const summary = sp.get('summary') === '1';

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const db = await getDb();
    const col = db.collection('scan_logs');

    const query: Record<string, unknown> = { ts: { $gte: since } };
    if (source) query.source = source;
    if (domain) query.domain = { $regex: domain, $options: 'i' };

    if (summary) {
      // Aggregated stats
      const [totalScans, bySource, topDomains, byDay, errorRate] = await Promise.all([
        col.countDocuments(query),
        col.aggregate([
          { $match: query },
          { $group: { _id: '$source', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]).toArray(),
        col.aggregate([
          { $match: query },
          { $group: { _id: '$domain', count: { $sum: 1 }, lastScan: { $max: '$ts' } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]).toArray(),
        col.aggregate([
          { $match: query },
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } },
            count: { $sum: 1 },
            errors: { $sum: { $cond: [{ $ne: ['$error', null] }, 1, 0] } },
          }},
          { $sort: { _id: 1 } },
        ]).toArray(),
        col.countDocuments({ ...query, error: { $ne: null } }),
      ]);

      return NextResponse.json({
        totalScans,
        errorRate: totalScans > 0 ? +(errorRate / totalScans * 100).toFixed(1) : 0,
        bySource,
        topDomains,
        byDay,
        days,
      });
    }

    // Paginated log list
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      col.find(query)
        .sort({ ts: -1 })
        .skip(skip)
        .limit(limit)
        .project({ _id: 0 })
        .toArray(),
      col.countDocuments(query),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error?.message || 'Failed to fetch scan logs' }, { status: 500 });
  }
}
