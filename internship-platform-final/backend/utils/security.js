const crypto = require("crypto");

function requestMeta(req) {
  const ua = req.headers["user-agent"] || "";
  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Google Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Mozilla Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  let os = "Unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let deviceType = "desktop";
  if (/iPad|Tablet/i.test(ua)) deviceType = "tablet";
  else if (/Mobile|Android|iPhone|iPod/i.test(ua)) deviceType = "mobile";

  const deviceModel =
    (ua.match(/(?:Android[^;]*;\s*([^;)]+))/i)?.[1] ||
    ua.match(/(iPhone|iPad)/i)?.[1] ||
    null);

  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "")
    .split(",")[0].trim();

  const location = req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || "Unknown";

  return {
    browser,
    operatingSystem: os,
    deviceType,
    deviceModel,
    ipAddress: ip || "Unknown",
    location,
    userAgent: ua
  };
}

function fingerprint(meta) {
  return crypto
    .createHash("sha256")
    .update([meta.browser, meta.operatingSystem, meta.deviceType, meta.deviceModel || "", meta.ipAddress].join("|"))
    .digest("hex");
}

function randomLetters(length = 12) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[crypto.randomInt(0, alphabet.length)];
  return out;
}

module.exports = { requestMeta, fingerprint, randomLetters };
