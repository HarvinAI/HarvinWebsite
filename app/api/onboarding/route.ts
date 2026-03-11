import { NextRequest, NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/auth-db';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }
  try {
    const db = await getAuthDb();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    return NextResponse.json({ completed: !!user?.onboardingCompleted });
  } catch {
    return NextResponse.json({ completed: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    const db = await getAuthDb();
    await db.collection('users').updateOne(
      { email: email.toLowerCase() },
      { $set: { onboardingCompleted: true, onboardingCompletedAt: new Date() } }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[onboarding]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
