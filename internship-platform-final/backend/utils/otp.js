const crypto = require("crypto");

const store = new Map();
const cooldowns = new Map();

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

function generateOtp(key, purpose) {
  const cooldownKey = `${purpose}:${key}`;
  const last = cooldowns.get(cooldownKey) || 0;
  const resendSeconds = Number(process.env.OTP_RESEND_SECONDS || 60);
  if (Date.now() - last < resendSeconds * 1000) {
    const wait = Math.ceil((resendSeconds * 1000 - (Date.now() - last)) / 1000);
    const err = new Error(`Please wait ${wait} seconds before requesting another OTP.`);
    err.code = "OTP_COOLDOWN";
    throw err;
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + Number(process.env.OTP_EXPIRY_MINUTES || 5) * 60 * 1000;
  store.set(`${purpose}:${key}`, {
    hash: hashOtp(otp),
    expiresAt,
    attempts: 0
  });
  cooldowns.set(cooldownKey, Date.now());
  return { otp, expiresAt };
}

function verifyOtp(key, purpose, otp) {
  const itemKey = `${purpose}:${key}`;
  const item = store.get(itemKey);
  const max = Number(process.env.OTP_MAX_ATTEMPTS || 5);

  if (!item) return { ok: false, message: "OTP not found. Please request a new OTP." };
  if (Date.now() > item.expiresAt) {
    store.delete(itemKey);
    return { ok: false, message: "OTP expired. Please request a new OTP." };
  }
  if (item.attempts >= max) {
    store.delete(itemKey);
    return { ok: false, message: "Too many OTP attempts. Please request a new OTP." };
  }

  item.attempts += 1;
  if (item.hash !== hashOtp(otp)) {
    return { ok: false, message: `Invalid OTP. ${Math.max(0, max - item.attempts)} attempts remaining.` };
  }

  store.delete(itemKey);
  return { ok: true };
}

module.exports = { generateOtp, verifyOtp };
