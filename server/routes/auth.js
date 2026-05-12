const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt  = require('bcryptjs');
const db      = require('../db');

// In-memory token store  { token → { user, school, role, createdAt } }
const tokens = new Map();

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ── Login ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' ||
      !username.trim() || !password) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  try {
    const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get([username.trim()]);
    if (!row) {
      // Constant-time response to prevent user enumeration
      bcrypt.compareSync('dummy', '$2a$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu');
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid username or password.' });

    const token = uuidv4();
    tokens.set(token, {
      user:      row.username,
      school:    row.school_name,
      role:      row.role,
      createdAt: Date.now(),
    });

    return res.json({ token, user: row.username, school: row.school_name, role: row.role });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) tokens.delete(token);
  res.json({ ok: true });
});

// ── User Management (superadmin only) ─────────────────────────────────────────
function requireSuperadmin(req, res, next) {
  const token = extractToken(req);
  const entry = getTokenEntry(token);
  if (!entry) return res.status(401).json({ error: 'Unauthorised.' });
  if (entry.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
  req.user   = entry.user;
  req.school = entry.school;
  req.role   = entry.role;
  next();
}

// GET /api/auth/users
router.get('/users', requireSuperadmin, (req, res) => {
  try {
    const rows = db.prepare(`SELECT id, username, school_name, role FROM users ORDER BY id`).all();
    res.json({ users: rows });
  } catch (err) {
    console.error('[Auth] GET /users error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// GET /api/auth/schools — list all distinct school names (superadmin only)
router.get('/schools', requireSuperadmin, (req, res) => {
  try {
    const rows = db.prepare(`SELECT DISTINCT school_name FROM users ORDER BY school_name`).all();
    res.json({ schools: rows.map(r => r.school_name) });
  } catch (err) {
    console.error('[Auth] GET /schools error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// POST /api/auth/users
router.post('/users', requireSuperadmin, async (req, res) => {
  const { username, password, school_name, role } = req.body || {};

  if (!username || !password || !school_name) {
    return res.status(400).json({ error: 'username, password and school_name are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const safeRole = ['admin', 'superadmin'].includes(role) ? role : 'admin';

  try {
    const hash = await bcrypt.hash(password, 10);
    db.prepare(`INSERT INTO users (username, password_hash, school_name, role) VALUES (?, ?, ?, ?)`)
      .run([username.trim(), hash, school_name.trim(), safeRole]);
    res.json({ ok: true });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    console.error('[Auth] POST /users error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', requireSuperadmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id.' });

  try {
    const target = db.prepare(`SELECT username, role FROM users WHERE id = ?`).get([id]);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.username === req.user) return res.status(400).json({ error: 'Cannot delete your own account.' });

    db.prepare(`DELETE FROM users WHERE id = ?`).run([id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Auth] DELETE /users error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// PUT /api/auth/users/:id/password — reset any user's password (superadmin only)
router.put('/users/:id/password', requireSuperadmin, async (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Invalid user id.' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run([hash, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Auth] PUT /users/password error:', err);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
// Also accepts ?token= query param (needed for EventSource / SSE which can't send headers)
function extractToken(req) {
  const header = req.headers['authorization'] || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.query?.token) return req.query.token;
  return null;
}

function getTokenEntry(token) {
  if (!token) return null;
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    tokens.delete(token);
    return null;
  }
  return entry;
}

function isValidToken(token) {
  return getTokenEntry(token) !== null;
}

module.exports = { router, isValidToken, getTokenEntry, extractToken };
