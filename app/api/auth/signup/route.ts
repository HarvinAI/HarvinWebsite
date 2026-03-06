import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthDb } from '@/lib/auth-db';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const db = await getAuthDb();
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.collection('users').insertOne({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      provider: 'credentials',
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[signup]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
