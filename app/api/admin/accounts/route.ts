import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

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
  const status = sp.get('status') || 'all'; // all, approved, pending, hidden
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '50', 10)));
  const skip = (page - 1) * limit;

  const db = await getDb();
  const col = db.collection('company_meta');

  const query: Record<string, unknown> = {};

  if (search) {
    query.$or = [
      { normalizedDomain: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
  }

  if (status === 'hidden') {
    query.adminHidden = true;
  } else if (status === 'approved') {
    query.adminHidden = { $ne: true };
    query.category = { $exists: true, $nin: [null, '', 'Unknown'] };
  } else if (status === 'pending') {
    query.$or = [
      { category: 'Unknown' },
      { category: null },
      { category: '' },
      { category: { $exists: false } },
    ];
  }

  const [accounts, total] = await Promise.all([
    col.find(query)
      .sort({ updatedAt: -1 })
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

  const stats = {
    total: await col.countDocuments({}),
    approved: await col.countDocuments({ adminHidden: { $ne: true }, category: { $exists: true, $nin: [null, '', 'Unknown'] } }),
    hidden: await col.countDocuments({ adminHidden: true }),
    pending: await col.countDocuments({ $or: [{ category: 'Unknown' }, { category: null }, { category: '' }, { category: { $exists: false } }] }),
  };

  return NextResponse.json({ accounts, total, page, stats }, { headers: corsHeaders });
}

// POST /api/admin/accounts — approve, hide, or update an account
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: corsHeaders });

  const body = await req.json();
  const { domain, action, category, subCategory, region, note } = body;

  if (!domain || !action) {
    return NextResponse.json({ error: 'domain and action required' }, { status: 400, headers: corsHeaders });
  }

  const db = await getDb();
  const col = db.collection('company_meta');

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
