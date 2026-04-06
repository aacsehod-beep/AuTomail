const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');

// In-memory token store  { token → { user, createdAt } }
const tokens = new Map();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  const validUser = process.env.APP_USER || 'admin';
  const validPass = process.env.APP_PASS || 'Aurora@2026';

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
  return !!token && tokens.has(token);
}

module.exports = { router, isValidToken, extractToken };
