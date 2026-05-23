// mailer.js — Nodemailer email service with HTML templates
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Shared email wrapper ──────────────────────────────────────────────────────
function wrapTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;padding:0;background:#080C14;font-family:'Segoe UI',Arial,sans-serif;color:#E2E8F0}
  .wrap{max-width:600px;margin:40px auto;background:#0E1420;border:1px solid rgba(0,242,254,.15);border-radius:16px;overflow:hidden}
  .header{background:linear-gradient(135deg,#080C14,#0E2030);padding:36px 40px;text-align:center;border-bottom:1px solid rgba(0,242,254,.12)}
  .logo{font-size:1.6rem;font-weight:800;letter-spacing:2px}
  .logo span{background:linear-gradient(135deg,#00F2FE,#4FACFE);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .body{padding:36px 40px}
  h2{color:#fff;font-size:1.3rem;margin:0 0 18px}
  p{color:#94A3B8;line-height:1.75;margin:0 0 14px;font-size:.95rem}
  .highlight{background:rgba(0,242,254,.08);border:1px solid rgba(0,242,254,.2);border-radius:10px;padding:18px 22px;margin:20px 0}
  .highlight td{padding:7px 0;font-size:.9rem}
  .highlight td:first-child{color:#64748B;width:130px}
  .highlight td:last-child{color:#E2E8F0;font-weight:600}
  .badge{display:inline-block;padding:4px 14px;border-radius:100px;font-size:.78rem;font-weight:700;letter-spacing:1px}
  .badge-confirmed{background:rgba(52,211,153,.15);color:#34D399;border:1px solid rgba(52,211,153,.3)}
  .badge-pending{background:rgba(251,191,36,.1);color:#FBB724;border:1px solid rgba(251,191,36,.25)}
  .badge-cancelled{background:rgba(248,113,113,.1);color:#F87171;border:1px solid rgba(248,113,113,.25)}
  .btn{display:inline-block;padding:13px 28px;border-radius:100px;background:linear-gradient(135deg,#00F2FE,#4FACFE);color:#080C14;font-weight:700;text-decoration:none;font-size:.9rem;margin-top:10px}
  .footer{text-align:center;padding:24px 40px;border-top:1px solid rgba(255,255,255,.06);color:#475569;font-size:.78rem}
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo"><span>Aurex</span> Labs</div>
      <p style="color:#475569;font-size:.8rem;margin:8px 0 0;letter-spacing:1px">ENGINEERING YOUR FUTURE</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © 2024 Aurex Labs &nbsp;·&nbsp; hello@aurexlabs.io &nbsp;·&nbsp; Remote-first · Global Reach<br/>
      <span style="color:#334155">You received this because you booked a meeting with Aurex Labs.</span>
    </div>
  </div>
</body>
</html>`;
}

// ── Email Templates ───────────────────────────────────────────────────────────

function bookingConfirmationEmail(booking) {
  const statusBadge = `<span class="badge badge-${booking.status}">${booking.status.toUpperCase()}</span>`;
  const content = `
    <h2>Meeting Booking ${booking.status === 'confirmed' ? 'Confirmed ✅' : 'Received 📩'}</h2>
    <p>Hi <strong style="color:#E2E8F0">${booking.client_name}</strong>, thank you for reaching out to Aurex Labs!</p>
    <p>Here are your booking details: ${statusBadge}</p>
    <div class="highlight">
      <table style="width:100%;border-collapse:collapse">
        <tr><td>Service</td><td>${booking.service || 'Strategy Call'}</td></tr>
        <tr><td>Date</td><td>${new Date(booking.meeting_date).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</td></tr>
        <tr><td>Time</td><td>${booking.meeting_time} (PKT)</td></tr>
        <tr><td>Duration</td><td>${booking.duration_min || 30} minutes</td></tr>
        ${booking.assigned_to ? `<tr><td>Your Expert</td><td>${booking.assigned_to}</td></tr>` : ''}
        ${booking.meet_link ? `<tr><td>Meeting Link</td><td><a href="${booking.meet_link}" style="color:#00F2FE">${booking.meet_link}</a></td></tr>` : ''}
      </table>
    </div>
    <p>We'll send you a Google Meet link 30 minutes before your call. If you need to reschedule, simply reply to this email.</p>
    ${booking.meet_link ? `<a href="${booking.meet_link}" class="btn">Join Meeting →</a>` : ''}
    <p style="margin-top:24px;font-size:.85rem;color:#475569">Questions? Email us at <a href="mailto:hello@aurexlabs.io" style="color:#00F2FE">hello@aurexlabs.io</a></p>
  `;
  return wrapTemplate(content);
}

function bookingCancelledEmail(booking) {
  const content = `
    <h2>Meeting Cancelled</h2>
    <p>Hi <strong style="color:#E2E8F0">${booking.client_name}</strong>,</p>
    <p>Your meeting scheduled for <strong style="color:#E2E8F0">${new Date(booking.meeting_date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} at ${booking.meeting_time}</strong> has been cancelled.</p>
    <p>We apologise for any inconvenience. Please book a new slot at your convenience.</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/booking.html" class="btn">Book a New Slot →</a>
  `;
  return wrapTemplate(content);
}

function adminNotificationEmail(booking) {
  const content = `
    <h2>🔔 New Booking Request</h2>
    <p>A new meeting has been booked via the Aurex Labs website.</p>
    <div class="highlight">
      <table style="width:100%;border-collapse:collapse">
        <tr><td>Client</td><td>${booking.client_name}</td></tr>
        <tr><td>Email</td><td>${booking.client_email}</td></tr>
        <tr><td>Service</td><td>${booking.service || 'Not specified'}</td></tr>
        <tr><td>Date</td><td>${new Date(booking.meeting_date).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</td></tr>
        <tr><td>Time</td><td>${booking.meeting_time}</td></tr>
        <tr><td>Message</td><td>${booking.message || '—'}</td></tr>
        <tr><td>Source</td><td>${booking.source || 'website'}</td></tr>
      </table>
    </div>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard.html" class="btn">Open Dashboard →</a>
  `;
  return wrapTemplate(content);
}

// ── Send helpers ──────────────────────────────────────────────────────────────

async function sendBookingConfirmation(booking) {
  return transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Aurex Labs <hello@aurexlabs.io>',
    to:      booking.client_email,
    subject: `Your Aurex Labs Meeting — ${new Date(booking.meeting_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})} at ${booking.meeting_time}`,
    html:    bookingConfirmationEmail(booking),
  });
}

async function sendCancellationEmail(booking) {
  return transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Aurex Labs <hello@aurexlabs.io>',
    to:      booking.client_email,
    subject: 'Your Aurex Labs Meeting Has Been Cancelled',
    html:    bookingCancelledEmail(booking),
  });
}

async function sendAdminNotification(booking) {
  if (!process.env.EMAIL_USER) return;
  return transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Aurex Labs <hello@aurexlabs.io>',
    to:      process.env.EMAIL_USER,
    subject: `[New Booking] ${booking.client_name} — ${booking.service || 'Strategy Call'}`,
    html:    adminNotificationEmail(booking),
  });
}

module.exports = { sendBookingConfirmation, sendCancellationEmail, sendAdminNotification };
