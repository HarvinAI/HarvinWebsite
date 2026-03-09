import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanSingleUrl } = require('@/lib/scan/scan');

export const maxDuration = 300;

const BULK_CONCURRENCY = 5;

async function processBulkJob(jobId: string, urls: string[]) {
  const db = await getDb();
  let ObjectId;
  try { ObjectId = require('mongodb').ObjectId; } catch { /* */ }
  const oid = ObjectId?.isValid(jobId) ? new ObjectId(jobId) : jobId;
  let completed = 0;

  for (let i = 0; i < urls.length; i += BULK_CONCURRENCY) {
    const batch = urls.slice(i, i + BULK_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (url: string) => {
        try {
          return await scanSingleUrl(url);
        } catch (err: unknown) {
          const rawMsg = (err as Error).message || 'Scan failed';
          const safeMsg = /puppeteer|chromium|browser engine|runtime/i.test(rawMsg)
            ? 'Could not fully scan this site'
            : rawMsg;
          return { url, technologies: [], count: 0, error: safeMsg };
        }
      })
    );

    const results = batchResults.map(r => r.status === 'fulfilled' ? r.value : (r as PromiseRejectedResult).reason);
    completed += batch.length;

    await db.collection('bulk_jobs').updateOne(
      { _id: oid },
      {
        $push: { results: { $each: results } },
        $set: { completedUrls: completed },
      }
    );
  }

  await db.collection('bulk_jobs').updateOne(
    { _id: oid },
    { $set: { status: 'completed', completedAt: new Date() } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json();
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array is required' }, { status: 400 });
    }
    if (urls.length > 50000) {
      return NextResponse.json({ error: 'Maximum 50,000 URLs per batch' }, { status: 400 });
    }

    const db = await getDb();
    const jobDoc = {
      status: 'processing',
      totalUrls: urls.length,
      completedUrls: 0,
      urls,
      results: [],
      createdAt: new Date(),
    };

    const { insertedId } = await db.collection('bulk_jobs').insertOne(jobDoc);
    const jobId = insertedId.toString();

    // Fire and forget — processing happens in background
    processBulkJob(jobId, urls).catch(err => {
      console.error(`[bulk] job ${jobId} failed:`, err.message);
    });

    return NextResponse.json({ jobId });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
