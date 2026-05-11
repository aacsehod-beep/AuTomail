const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');

// In-memory token store  { token → { user, createdAt } }
const tokens = new Map();

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const validUser = process.env.APP_USER;
  const validPass = process.env.APP_PASS;

  if (!validUser || !validPass) {
    console.error('[Auth] APP_USER or APP_PASS env vars are not set');
    return res.status(500).json({ error: 'Server misconfiguration.' });
  }

  if (
    typeof username !== 'string' || typeof password !== 'string' ||
    username.trim() !== validUser || password !== validPass
  ) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = uuidv4();
  tokens.set(token, { user: username.trim(), createdAt: Date.now() });

  return res.json({ token, user: username.trim() });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) tokens.delete(token);
  res.json({ ok: true });
});

// Helper used by middleware
// Also accepts ?token= query param (needed for EventSource / SSE which can't send headers)
function extractToken(req) {
  const header = req.headers['authorization'] || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.query?.token) return req.query.token;
  return null;
}

function isValidToken(token) {
  if (!token) return false;
  const entry = tokens.get(token);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    tokens.delete(token);
    return false;
  }
  return true;
}

module.exports = { router, isValidToken, extractToken };
