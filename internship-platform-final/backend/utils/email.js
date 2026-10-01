const nodemailer = require("nodemailer");

function transporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendEmail(to, subject, html) {
  const tx = transporter();
  if (!tx) {
    console.log(`[EMAIL DEMO] To: ${to} | Subject: ${subject}`);
    console.log(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
    return { demo: true };
  }
  return tx.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to, subject, html
  });
}

async function sendOtpEmail(to, otp, purpose) {
  return sendEmail(
    to,
    `${purpose} verification OTP`,
    `<div style="font-family:Arial"><h2>Internship Platform</h2><p>Your verification OTP is:</p><h1>${otp}</h1><p>This code expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.</p><p>Never share this code with anyone.</p></div>`
  );
}

module.exports = { sendEmail, sendOtpEmail };
