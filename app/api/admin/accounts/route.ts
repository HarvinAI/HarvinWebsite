import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_EMAILS } from '@/auth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email || '').toLowerCase();
  return ADMIN_EMAILS.includes(email);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/admin/accounts — list accounts pending review or search
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: corsHeaders });

  const sp = req.nextUrl.searchParams;
  const search = sp.get('search') || '';
  const status = sp.get('status') || 'all'; // all, approved, pending, unknown, hidden
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '50', 10)));
  const skip = (page - 1) * limit;
  const sortBy = sp.get('sortBy') || 'updatedAt';  // updatedAt | createdAt | domain | category
  const sortDir = sp.get('sortDir') === 'asc' ? 1 : -1;

  const db = await getDb();
  const col = db.collection('company_meta');

  // ── Mutually-exclusive status buckets ──
  // hidden   : admin-hidden (not shown to users), regardless of category/approval
  // unknown  : category could not be determined (Unknown/empty), not hidden
  // approved : admin-approved & has a real category, not hidden → visible in Explorer
  // pending  : has a real category but NOT yet approved, not hidden → awaiting review
  const UNKNOWN_CAT = [{ category: 'Unknown' }, { category: null }, { category: '' }, { category: { $exists: false } }];
  const VALID_CAT = { $exists: true, $nin: [null, '', 'Unknown'] };
  const STATUS_FILTERS: Record<string, Record<string, unknown>> = {
    hidden:   { adminHidden: true },
    unknown:  { adminHidden: { $ne: true }, $or: UNKNOWN_CAT },
    approved: { adminHidden: { $ne: true }, adminApproved: true, category: VALID_CAT },
    pending:  { adminHidden: { $ne: true }, adminApproved: { $ne: true }, category: VALID_CAT },
  };

  const query: Record<string, unknown> = { ...(STATUS_FILTERS[status] || {}) };

  if (search) {
    const searchOr = [
      { normalizedDomain: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
    // If the status filter already uses $or (unknown), AND the two together.
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchOr }];
      delete query.$or;
    } else {
      query.$or = searchOr;
    }
  }

  const SORT_MAP: Record<string, string> = { updatedAt: 'updatedAt', createdAt: 'createdAt', domain: 'normalizedDomain', category: 'category' };
  const sortField = SORT_MAP[sortBy] || 'updatedAt';

  const [accounts, total] = await Promise.all([
    col.find(query)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit)
      .project({
        _id: 0,
        normalizedDomain: 1,
        category: 1,
        subCategory: 1,
        region: 1,
        monthlyVisitsFormatted: 1,
        adminHidden: 1,
        adminApproved: 1,
        adminNote: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .toArray(),
    col.countDocuments(query),
  ]);

  // Sanitize: some fields may be objects (e.g. from JSON-LD) instead of strings
  const safeStr = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null && 'name' in v) return String((v as Record<string, unknown>).name);
    return String(v);
  };
  for (const a of accounts) {
    const r = a as Record<string, unknown>;
    r.category = safeStr(r.category) || 'Unknown';
    r.subCategory = safeStr(r.subCategory) || '';
    r.region = safeStr(r.region) || 'Global';
    r.monthlyVisitsFormatted = safeStr(r.monthlyVisitsFormatted);
  }

  const [sTotal, sApproved, sPending, sUnknown, sHidden] = await Promise.all([
    col.countDocuments({}),
    col.countDocuments(STATUS_FILTERS.approved),
    col.countDocuments(STATUS_FILTERS.pending),
    col.countDocuments(STATUS_FILTERS.unknown),
    col.countDocuments(STATUS_FILTERS.hidden),
  ]);
  const stats = { total: sTotal, approved: sApproved, pending: sPending, unknown: sUnknown, hidden: sHidden };

  return NextResponse.json({ accounts, total, page, stats }, { headers: corsHeaders });
}

// POST /api/admin/accounts — approve, hide, or update an account
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: corsHeaders });

  const body = await req.json();
  const { domain, domains, action, category, subCategory, region, note } = body;

  if (!action) {
    return NextResponse.json({ error: 'action required' }, { status: 400, headers: corsHeaders });
  }

  const db = await getDb();
  const col = db.collection('company_meta');
  const now = new Date();

  // ── Bulk action across multiple domains (e.g. select many → approve) ──
  if (Array.isArray(domains) && domains.length > 0) {
    const list = domains.filter((d: unknown): d is string => typeof d === 'string' && d.length > 0);
    if (list.length === 0) {
      return NextResponse.json({ error: 'domains array required' }, { status: 400, headers: corsHeaders });
    }
    const filter = { normalizedDomain: { $in: list } };
    let update: Record<string, unknown> | null = null;
    if (action === 'approve') update = { $set: { adminApproved: true, adminHidden: false, updatedAt: now } };
    else if (action === 'hide') update = { $set: { adminHidden: true, adminNote: note || 'Hidden by admin', updatedAt: now } };
    else if (action === 'unhide') update = { $set: { adminHidden: false, updatedAt: now }, $unset: { adminNote: '' } };
    else if (action === 'reject') update = { $set: { adminApproved: false, adminHidden: true, adminNote: note || 'Rejected by admin', updatedAt: now } };
    if (!update) {
      return NextResponse.json({ error: 'Unsupported bulk action. Use: approve, hide, unhide, reject' }, { status: 400, headers: corsHeaders });
    }
    const r = await col.updateMany(filter, update);
    return NextResponse.json({ ok: true, action, count: r.modifiedCount ?? 0 }, { headers: corsHeaders });
  }

  if (!domain) {
    return NextResponse.json({ error: 'domain (or domains[]) required' }, { status: 400, headers: corsHeaders });
  }

  switch (action) {
    case 'hide':
      await col.updateOne({ normalizedDomain: domain }, { $set: { adminHidden: true, adminNote: note || 'Hidden by admin', updatedAt: new Date() } });
      return NextResponse.json({ ok: true, action: 'hidden', domain }, { headers: corsHeaders });

    case 'unhide':
      await col.updateOne({ normalizedDomain: domain }, { $set: { adminHidden: false, updatedAt: new Date() }, $unset: { adminNote: '' } });
      return NextResponse.json({ ok: true, action: 'unhidden', domain }, { headers: corsHeaders });

    case 'update':
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (category) updates.category = category;
      if (subCategory) updates.subCategory = subCategory;
      if (region) updates.region = region;
      if (note) updates.adminNote = note;
      await col.updateOne({ normalizedDomain: domain }, { $set: updates });
      return NextResponse.json({ ok: true, action: 'updated', domain }, { headers: corsHeaders });

    case 'approve':
      await col.updateOne({ normalizedDomain: domain }, { $set: { adminApproved: true, adminHidden: false, updatedAt: new Date() } });
      return NextResponse.json({ ok: true, action: 'approved', domain }, { headers: corsHeaders });

    case 'reject':
      await col.updateOne({ normalizedDomain: domain }, { $set: { adminApproved: false, adminHidden: true, adminNote: note || 'Rejected by admin', updatedAt: new Date() } });
      return NextResponse.json({ ok: true, action: 'rejected', domain }, { headers: corsHeaders });

    case 'delete':
      await col.deleteOne({ normalizedDomain: domain });
      return NextResponse.json({ ok: true, action: 'deleted', domain }, { headers: corsHeaders });

    default:
      return NextResponse.json({ error: 'Invalid action. Use: hide, unhide, approve, reject, update, delete' }, { status: 400, headers: corsHeaders });
  }
}

// DELETE /api/admin/accounts — bulk delete accounts by domain
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: corsHeaders });

  let domains: string[] = [];
  try {
    const body = await req.json();
    domains = Array.isArray(body?.domains)
      ? body.domains.filter((d: unknown): d is string => typeof d === 'string' && d.length > 0)
      : [];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  if (domains.length === 0) {
    return NextResponse.json({ error: 'domains array required' }, { status: 400, headers: corsHeaders });
  }

  const db = await getDb();
  const col = db.collection('company_meta');
  const result = await col.deleteMany({ normalizedDomain: { $in: domains } });

  return NextResponse.json(
    { ok: true, action: 'bulk_deleted', deleted: result.deletedCount || 0, requested: domains.length },
    { headers: corsHeaders },
  );
}
