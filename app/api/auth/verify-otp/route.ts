import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthDb } from '@/lib/auth-db';

export async function POST(req: NextRequest) {
  try {
    const { email, otp, name, password } = await req.json();

    if (!email || !otp || !name || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const db = await getAuthDb();

    // Find valid OTP
    const record = await db.collection('otp_codes').findOne({
      email: email.toLowerCase(),
      otp,
      expiresAt: { $gte: new Date() },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    // Check if user was created in the meantime
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    await db.collection('users').insertOne({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      provider: 'credentials',
      emailVerified: true,
      createdAt: new Date(),
    });

    // Clean up OTP
    await db.collection('otp_codes').deleteMany({ email: email.toLowerCase() });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
