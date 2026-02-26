import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/* ── Transporter ──────────────────────────────────────────────────────────── */
function createTransporter() {
  const port   = Number(process.env.SMTP_PORT ?? 587);
  const secure = port === 465; // true only for port 465; 587 uses STARTTLS

  return nodemailer.createTransport({
    host:       process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,   // enforce STARTTLS upgrade on port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });
}

/* ── Admin notification HTML ──────────────────────────────────────────────── */
function adminHtml(data: {
  name: string; email: string; company: string;
  role: string; message: string; type: string;
}) {
  const typeLabel  = data.type === 'talk-to-sales' ? '💼 Talk to Sales' : '🚀 Early Access';
  const submitted  = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">

  <!-- Header -->
  <tr><td style="background:#C94C1E;padding:28px 36px;">
    <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);">HarvinAI · Admin Notification</p>
    <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#fff;">New ${typeLabel} Request</h1>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Name',      data.name)}
      ${row('Email',     `<a href="mailto:${data.email}" style="color:#C94C1E;">${data.email}</a>`)}
      ${row('Company',   data.company)}
      ${row('Role',      data.role)}
      ${row('Type',      typeLabel)}
      ${data.message ? row('Message', data.message) : ''}
      ${row('Submitted', submitted + ' IST')}
    </table>

    <div style="margin-top:28px;padding:16px 20px;background:#fef3ee;border-radius:10px;border:1px solid #fcd9c8;">
      <p style="margin:0;font-size:13px;color:#7c2d12;font-weight:600;">Action required</p>
      <p style="margin:6px 0 0;font-size:13px;color:#9a3412;">
        Reply to ${data.name} at <a href="mailto:${data.email}" style="color:#C94C1E;">${data.email}</a> within 24 hours.
      </p>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 36px;border-top:1px solid #f4f4f5;">
    <p style="margin:0;font-size:12px;color:#a1a1aa;">Automated notification from HarvinAI.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

function row(label: string, value: string) {
  return `
  <tr>
    <td style="padding:10px 0;vertical-align:top;width:110px;">
      <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1aa;">${label}</p>
    </td>
    <td style="padding:10px 0 10px 16px;vertical-align:top;">
      <p style="margin:0;font-size:14px;color:#18181b;">${value}</p>
    </td>
  </tr>`;
}

/* ── User thank-you HTML ──────────────────────────────────────────────────── */
function userHtml(name: string, isSales: boolean) {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">

  <!-- Header -->
  <tr><td style="background:#0c0b09;padding:28px 36px;text-align:center;">
    <p style="margin:0;font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.02em;">
      Harvin<span style="opacity:0.4;font-weight:400;">AI</span>
    </p>
  </td></tr>

  <!-- Hero -->
  <tr><td style="padding:40px 36px 28px;text-align:center;">
    <p style="font-size:36px;margin:0 0 16px;">🎉</p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#09090b;letter-spacing:-0.02em;">
      ${isSales ? "We'll be in touch soon!" : "You're on the waitlist!"}
    </h1>
    <p style="margin:0 auto;font-size:15px;color:#52525b;line-height:1.7;max-width:420px;">
      Hi ${name}, thank you for your interest in HarvinAI.
      ${isSales
        ? "Our team has received your message and will reach out within 24 hours."
        : "You're among our earliest supporters. We'll personally reach out when we're ready to onboard new users."}
    </p>
  </td></tr>

  <tr><td style="padding:0 36px;"><div style="height:1px;background:#f4f4f5;"></div></td></tr>

  <!-- What is HarvinAI -->
  <tr><td style="padding:28px 36px;">
    <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#09090b;">What is HarvinAI?</h2>
    <p style="margin:0;font-size:14px;color:#52525b;line-height:1.7;">
      HarvinAI is a <strong>D2C brand intelligence platform</strong> that helps B2B sales teams identify which
      D2C brands are in a buying window — before the competition finds out. We track 500,000+ brands
      across funding rounds, store openings, hiring activity, and app launches.
    </p>
    <p style="margin:14px 0 0;">
      <span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;background:#fef3ee;border:1px solid #fcd9c8;border-radius:999px;font-size:12px;font-weight:600;color:#9a3412;">500K+ D2C brands</span>
      <span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;background:#fef3ee;border:1px solid #fcd9c8;border-radius:999px;font-size:12px;font-weight:600;color:#9a3412;">Real-time signals</span>
      <span style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px;background:#fef3ee;border:1px solid #fcd9c8;border-radius:999px;font-size:12px;font-weight:600;color:#9a3412;">Intent scoring</span>
    </p>
  </td></tr>

  <tr><td style="padding:0 36px;"><div style="height:1px;background:#f4f4f5;"></div></td></tr>

  <!-- What happens next -->
  <tr><td style="padding:28px 36px;">
    <h2 style="margin:0 0 18px;font-size:15px;font-weight:700;color:#09090b;">What happens next?</h2>

    ${step('1', "You're on the list", "We've saved your details. You're among our earliest supporters and we won't forget that.")}
    ${step('2', "We're building for you", "HarvinAI is actively under development. We're focused on getting the product right before we open access.")}
    ${step('3', "You hear from us first", "When we're ready to onboard, you'll get a personal invite — no queue, no waiting.")}
  </td></tr>

  <!-- Reply note -->
  <tr><td style="padding:0 36px 32px;">
    <div style="background:#fef3ee;border-radius:12px;padding:18px 22px;border:1px solid #fcd9c8;">
      <p style="margin:0;font-size:13px;color:#7c2d12;line-height:1.6;">
        <strong>Questions in the meantime?</strong><br/>
        Just reply to this email — we read every single message.
      </p>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 36px;border-top:1px solid #f4f4f5;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#a1a1aa;">© ${new Date().getFullYear()} HarvinAI, Inc. · All rights reserved.</p>
    <p style="margin:0;font-size:12px;color:#a1a1aa;">You're receiving this because you signed up at harvinai.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

function step(num: string, title: string, desc: string) {
  return `
  <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;width:100%;">
  <tr>
    <td style="width:28px;vertical-align:top;padding-top:1px;">
      <div style="width:22px;height:22px;background:#C94C1E;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#fff;">${num}</div>
    </td>
    <td style="padding-left:12px;vertical-align:top;">
      <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#09090b;">${title}</p>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">${desc}</p>
    </td>
  </tr>
  </table>`;
}

/* ── Route handler ────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, role, message = '', type } = body as {
      name: string; email: string; company: string;
      role: string; message?: string; type: string;
    };

    if (!name || !email || !company || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn('SMTP not configured — skipping email send');
      return NextResponse.json({ ok: true, skipped: true });
    }

    const transporter = createTransporter();

    // Verify SMTP connection before attempting to send
    await transporter.verify();

    const isSales = type === 'talk-to-sales';
    const fromName    = process.env.FROM_NAME ?? 'HarvinAI';
    const fromAddr    = process.env.SMTP_USER ?? '';
    const adminEmail  = process.env.ADMIN_EMAIL ?? fromAddr;

    const adminSubject = `${isSales ? '💼' : '🚀'} New ${isSales ? 'sales' : 'early access'} request — ${name} from ${company}`;
    const userSubject  = isSales
      ? `We received your message, ${name}!`
      : `You're on the HarvinAI waitlist, ${name}!`;

    await Promise.all([
      transporter.sendMail({
        from:    `"${fromName}" <${fromAddr}>`,
        to:      adminEmail,
        subject: adminSubject,
        html:    adminHtml({ name, email, company, role, message, type }),
      }),
      transporter.sendMail({
        from:    `"${fromName}" <${fromAddr}>`,
        to:      email,
        subject: userSubject,
        html:    userHtml(name, isSales),
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('notify route error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
