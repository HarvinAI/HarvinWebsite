import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Centralized admin-request auth for cron + admin endpoints.
 *
 * Two accepted forms (in order):
 *   1. `x-admin-token` header (or `?token=` query) matches ADMIN_API_TOKEN env.
 *      → Used by curl, by your Vercel/Railway crons, and currently by
 *        Cloud Scheduler (configured to send the header).
 *   2. Cloud Scheduler OIDC bearer token (Authorization: Bearer <jwt>).
 *      → Set up when you switch crons to OIDC auth (more secure than a static
 *        token because tokens are short-lived and bound to a service account).
 *      → Currently stubbed; flip CLOUD_SCHEDULER_SERVICE_ACCOUNT in env to enable.
 *
 * Returns null when authorized (caller proceeds) or a NextResponse 401 when not.
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  // ── Path 1: static token ─────────────────────────────────────────────
  const expected = process.env.ADMIN_API_TOKEN;
  if (expected) {
    const headerToken = req.headers.get('x-admin-token') || '';
    const queryToken = req.nextUrl.searchParams.get('token') || '';
    if (headerToken === expected || queryToken === expected) return null;
  }

  // ── Path 2: Cloud Scheduler OIDC token (optional, future) ────────────
  // To enable: in Cloud Scheduler job config, set oidcToken.serviceAccountEmail
  // and oidcToken.audience to the Cloud Run service URL. Then set the env var
  // CLOUD_SCHEDULER_SERVICE_ACCOUNT to that service-account email here, and
  // implement JWT verification below (either via google-auth-library OR a
  // minimal RS256 verifier against https://www.googleapis.com/oauth2/v3/certs).
  //
  // For now this path is a no-op; the static token above is the active gate.
  const expectedSA = process.env.CLOUD_SCHEDULER_SERVICE_ACCOUNT;
  if (expectedSA) {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      // TODO(oidc): verify JWT signature, exp, iss=accounts.google.com,
      // email==expectedSA. Returning null here would allow the request through
      // — until verification is implemented we deliberately do NOT short-circuit.
    }
  }

  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
