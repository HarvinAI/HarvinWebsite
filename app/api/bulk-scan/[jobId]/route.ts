import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const db = await getDb();

    let ObjectId;
    try { ObjectId = require('mongodb').ObjectId; } catch { /* */ }
    const oid = ObjectId?.isValid(jobId) ? new ObjectId(jobId) : jobId;

    const job = await db.collection('bulk_jobs').findOne({ _id: oid });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(500, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '100')));
    const skip  = (page - 1) * limit;

    const paginatedResults = (job.results || []).slice(skip, skip + limit);

    return NextResponse.json({
      jobId,
      status: job.status,
      totalUrls: job.totalUrls,
      completedUrls: job.completedUrls,
      results: paginatedResults,
      page,
      totalPages: Math.ceil((job.results || []).length / limit),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
