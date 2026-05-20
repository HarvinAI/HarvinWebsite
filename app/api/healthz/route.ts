import { NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDb } = require('@/lib/scan/db');

export const dynamic = 'force-dynamic';
// Short timeout — health checks should be fast.
export const maxDuration = 15;

/**
 * GET /api/healthz
 *
 * Liveness + dependency check. Used by Cloud Run rolling deploys and any
 * uptime monitor (UptimeRobot, GCP Uptime Checks, etc.).
 *
 *   200  →  app is up AND Mongo is reachable
 *   503  →  app responded but Mongo ping failed (degraded)
 *
 * Intentionally returns details only at runtime, no secrets.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const db = await getDb();
    // Cheapest ping that requires a real round-trip
    await db.command({ ping: 1 });
    return NextResponse.json({
      ok: true,
      mongo: 'ok',
      uptime: process.uptime(),
      latencyMs: Date.now() - startedAt,
    }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    console.warn('[healthz] mongo ping failed:', error?.message);
    return NextResponse.json({
      ok: false,
      mongo: 'error',
      error: error?.message || 'mongo ping failed',
      latencyMs: Date.now() - startedAt,
    }, { status: 503 });
  }
}
