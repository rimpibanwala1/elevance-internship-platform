const jwt = require("jsonwebtoken");
const pool = require("../db");

async function auth(req, res, next) {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;

  if (!token) return res.status(401).json({ message: "Login required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await pool.query(
      "SELECT revoked FROM user_sessions WHERE token = $1 LIMIT 1",
      [token]
    );
    if (session.rows.length && session.rows[0].revoked) {
      return res.status(401).json({ message: "Session revoked. Please login again." });
    }
    req.user = decoded;
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = auth;
