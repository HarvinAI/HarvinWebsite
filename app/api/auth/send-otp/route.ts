import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAuthDb } from '@/lib/auth-db';

function createTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: true },
  });
}

function otpEmailHtml(otp: string, name: string) {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">

  <tr><td style="background:#0c0b09;padding:24px 36px;text-align:center;">
    <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em;">
      Harvin<span style="opacity:0.4;font-weight:400;">AI</span>
    </p>
  </td></tr>

  <tr><td style="padding:36px 36px 20px;text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;color:#71717a;">Hi ${name},</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;">Verify your email</h1>
    <p style="margin:0;font-size:14px;color:#52525b;line-height:1.6;">
      Enter this code to complete your sign-up:
    </p>
  </td></tr>

  <tr><td style="padding:0 36px 28px;text-align:center;">
    <div style="display:inline-block;padding:16px 40px;background:#fef3ee;border:2px solid #fcd9c8;border-radius:14px;">
      <p style="margin:0;font-size:36px;font-weight:800;letter-spacing:0.3em;color:#C94C1E;">${otp}</p>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#a1a1aa;">This code expires in 10 minutes.</p>
  </td></tr>

  <tr><td style="padding:0 36px 28px;">
    <div style="background:#f9fafb;border-radius:10px;padding:14px 18px;border:1px solid #f4f4f5;">
      <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
  </td></tr>

  <tr><td style="padding:16px 36px;border-top:1px solid #f4f4f5;text-align:center;">
    <p style="margin:0;font-size:11px;color:#a1a1aa;">&copy; ${new Date().getFullYear()} HarvinAI, Ltd.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = await getAuthDb();

    // Check if user already exists
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Rate limit: max 1 OTP per email per 60 seconds
    const recent = await db.collection('otp_codes').findOne({
      email: email.toLowerCase(),
      createdAt: { $gte: new Date(Date.now() - 60_000) },
    });
    if (recent) {
      return NextResponse.json({ error: 'Please wait before requesting another code' }, { status: 429 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP (expires in 10 minutes)
    await db.collection('otp_codes').deleteMany({ email: email.toLowerCase() });
    await db.collection('otp_codes').insertOne({
      email: email.toLowerCase(),
      otp,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send email
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('[send-otp] SMTP not configured — OTP:', otp);
      return NextResponse.json({ ok: true, debug: process.env.NODE_ENV === 'development' ? otp : undefined });
    }

    const transporter = createTransporter();
    await transporter.verify();

    const fromName = process.env.FROM_NAME ?? 'HarvinAI';
    const fromAddr = process.env.SMTP_USER ?? '';

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: email,
      subject: `${otp} — Your HarvinAI verification code`,
      html: otpEmailHtml(otp, name || 'there'),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
