import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scanSingleUrl } = require('@/lib/scan/scan');

export const maxDuration = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url query param required' }, { status: 400, headers: corsHeaders });
  }

  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';

  try {
    const result = await scanSingleUrl(url, { forceRefresh });
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as { response?: { status?: number }; code?: string; message?: string };
    const status = error.response?.status;
    const msg = status
      ? `Target returned HTTP ${status}`
      : error.code === 'ECONNABORTED'
        ? 'Request timed out — the site took too long to respond'
        : error.code === 'ENOTFOUND'
          ? 'Domain not found — check the URL and try again'
          : error.message || 'Failed to fetch URL';
    return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders });
  }
}
