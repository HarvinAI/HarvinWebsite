import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthDb } from '@/lib/auth-db';

export async function POST(req: NextRequest) {
  try {
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const db = await getAuthDb();

    // Verify OTP
    const record = await db.collection('otp_codes').findOne({
      email: email.toLowerCase(),
      otp,
      type: 'reset',
      expiresAt: { $gte: new Date() },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await db.collection('users').updateOne(
      { email: email.toLowerCase() },
      { $set: { passwordHash, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Clean up
    await db.collection('otp_codes').deleteMany({ email: email.toLowerCase(), type: 'reset' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
