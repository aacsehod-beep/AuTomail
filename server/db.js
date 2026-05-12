const { Database } = require('node-sqlite3-wasm');
const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');

const DB_DIR     = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SCHOOLS_DIR = path.join(DB_DIR, 'schools');
if (!fs.existsSync(DB_DIR))      fs.mkdirSync(DB_DIR,      { recursive: true });
if (!fs.existsSync(SCHOOLS_DIR)) fs.mkdirSync(SCHOOLS_DIR, { recursive: true });

// Clean up stale lock left by a crashed previous process
const lockDir = path.join(DB_DIR, 'aurora.db.lock');
if (fs.existsSync(lockDir)) {
  try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch (_) {}
}
// Clean up stale school DB locks
try {
  if (fs.existsSync(SCHOOLS_DIR)) {
    fs.readdirSync(SCHOOLS_DIR)
      .filter(f => f.endsWith('.db.lock'))
      .forEach(f => {
        try { fs.rmSync(path.join(SCHOOLS_DIR, f), { recursive: true, force: true }); } catch (_) {}
      });
  }
} catch (_) {}

// ── Shim: add transaction() helper to any db instance ────────────────────────
function addShim(db) {
  db.transaction = function(fn) {
    return function(arg) {
      db.run('BEGIN');
      try   { fn(arg); db.run('COMMIT'); }
      catch (e) { db.run('ROLLBACK'); throw e; }
    };
  };
}

// ── Main DB — users + jobs (global, not school-specific) ─────────────────────
const mainDb = new Database(path.join(DB_DIR, 'aurora.db'));
mainDb.run('PRAGMA journal_mode = WAL');
mainDb.run('PRAGMA foreign_keys = ON');

mainDb.run(`CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  title        TEXT,
  total        INTEGER DEFAULT 0,
  sent         INTEGER DEFAULT 0,
  failed       INTEGER DEFAULT 0,
  done         INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'pending',
  finished     INTEGER DEFAULT 0,
  cancelled    INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL,
  finished_at  TEXT,
  payload_json TEXT
)`);
try { mainDb.run(`ALTER TABLE jobs ADD COLUMN payload_json TEXT`); } catch (_) {}

mainDb.run(`CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  school_name   TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin'
)`);

try {
  mainDb.run(`CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);
  // Seed default languages config
  mainDb.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('languages', '[{"code":"hi","label":"Hindi"},{"code":"ta","label":"Tamil"}]')`);
} catch (_) {}

// Seed default superadmin from env vars (INSERT OR IGNORE — never overwrites existing)
try {
  const defaultUser = process.env.APP_USER || 'admin';
  const defaultPass = process.env.APP_PASS || 'Aurora@2026';
  const existing = mainDb.prepare(`SELECT id FROM users WHERE username = ?`).get([defaultUser]);
  if (!existing) {
    const hash = bcrypt.hashSync(defaultPass, 10);
    mainDb.prepare(`INSERT INTO users (username, password_hash, school_name, role) VALUES (?, ?, ?, ?)`).run([
      defaultUser, hash, 'Aurora University', 'superadmin',
    ]);
  }
} catch (e) {
  console.error('[DB] Failed to seed superadmin:', e.message);
}

addShim(mainDb);

// ── Per-school DB factory ─────────────────────────────────────────────────────

function slugify(name) {
  return (name || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'default';
}

const schoolDbCache = new Map();

function initSchoolDb(db, schoolName) {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Store the school's display name inside the DB itself
  db.run(`CREATE TABLE IF NOT EXISTS school_meta (key TEXT PRIMARY KEY, value TEXT)`);
  if (schoolName) {
    try {
      db.run(`INSERT OR IGNORE INTO school_meta (key, value) VALUES ('school_name', '${schoolName.replace(/'/g, "''")}')`);
    } catch (_) {}
  }

  db.run(`CREATE TABLE IF NOT EXISTS email_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id     TEXT NOT NULL,
    sent_at    TEXT NOT NULL,
    type       TEXT NOT NULL,
    recipient  TEXT NOT NULL,
    name       TEXT,
    reg_no     TEXT,
    section    TEXT,
    status     TEXT NOT NULL,
    message    TEXT,
    sender     TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_job    ON email_logs(job_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_type   ON email_logs(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_status ON email_logs(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_sent   ON email_logs(sent_at)`);

  db.run(`CREATE TABLE IF NOT EXISTS templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    type        TEXT NOT NULL,
    subject     TEXT NOT NULL,
    body        TEXT NOT NULL,
    subject_i18n TEXT DEFAULT '{}',
    body_i18n    TEXT DEFAULT '{}',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`);
  // Backward-compatible migrations for existing school DBs
  try { db.run(`ALTER TABLE templates ADD COLUMN subject_i18n TEXT DEFAULT '{}'`); } catch (_) {}
  try { db.run(`ALTER TABLE templates ADD COLUMN body_i18n TEXT DEFAULT '{}'`); } catch (_) {}

  db.run(`CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    type         TEXT NOT NULL,
    payload      TEXT NOT NULL,
    run_at       TEXT NOT NULL,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT NOT NULL
  )`);

  addShim(db);
}

/**
 * Get (or create) the SQLite DB for a given school name.
 * Each school gets its own file: data/schools/<slug>.db
 */
function getSchoolDb(schoolName) {
  if (!schoolName) return mainDb; // fallback for edge cases
  const slug = slugify(schoolName);
  if (schoolDbCache.has(slug)) return schoolDbCache.get(slug);

  // Clean up stale lock for this school DB
  const lockPath = path.join(SCHOOLS_DIR, `${slug}.db.lock`);
  if (fs.existsSync(lockPath)) {
    try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch (_) {}
  }

  const db = new Database(path.join(SCHOOLS_DIR, `${slug}.db`));
  try { initSchoolDb(db, schoolName); } catch (e) { console.error(`[DB] initSchoolDb failed for ${slug}:`, e.message); }
  schoolDbCache.set(slug, db);
  return db;
}

/**
 * Open every school DB in data/schools/ and return an array of { slug, db }.
 * Used by superadmin for cross-school aggregation.
 */
function getAllSchoolDbs() {
  if (!fs.existsSync(SCHOOLS_DIR)) return [];
  const files = fs.readdirSync(SCHOOLS_DIR).filter(
    f => f.endsWith('.db') && !f.endsWith('-journal') && !f.endsWith('-wal') && !f.endsWith('-shm')
  );
  const results = [];
  for (const f of files) {
    const slug = f.replace(/\.db$/, '');
    if (schoolDbCache.has(slug)) {
      results.push({ slug, db: schoolDbCache.get(slug) });
      continue;
    }
    // Clean stale lock left by a crashed/restarted process
    const lockPath = path.join(SCHOOLS_DIR, `${slug}.db.lock`);
    if (fs.existsSync(lockPath)) {
      try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch (_) {}
    }
    try {
      const db = new Database(path.join(SCHOOLS_DIR, f));
      try { initSchoolDb(db, null); } catch (e) { console.error(`[DB] initSchoolDb failed for ${slug}:`, e.message); }
      schoolDbCache.set(slug, db);
      results.push({ slug, db });
    } catch (e) {
      console.error(`[DB] Could not open school DB ${f}:`, e.message);
    }
  }
  return results;
}

// Default export = mainDb so existing requires of db.js (auth, jobManager) keep working
module.exports = mainDb;
module.exports.mainDb        = mainDb;
module.exports.getSchoolDb   = getSchoolDb;
module.exports.getAllSchoolDbs = getAllSchoolDbs;
module.exports.slugify       = slugify;
