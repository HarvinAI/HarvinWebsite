import { NextRequest, NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const db = await getAuthDb();

    const record = await db.collection('otp_codes').findOne({
      email: email.toLowerCase(),
      otp,
      type: 'reset',
      expiresAt: { $gte: new Date() },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[verify-reset-otp]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
