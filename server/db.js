const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs   = require('fs');

const DB_DIR  = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Clean up stale lock left by a crashed previous process
const lockDir = path.join(DB_DIR, 'aurora.db.lock');
if (fs.existsSync(lockDir)) {
  try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch (_) {}
}

const db = new Database(path.join(DB_DIR, 'aurora.db'));

db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

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

db.run(`CREATE TABLE IF NOT EXISTS jobs (
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
// Add payload_json to existing DBs that predate this column (silently ignore if already exists)
try { db.run(`ALTER TABLE jobs ADD COLUMN payload_json TEXT`); } catch (_) {}

db.run(`CREATE TABLE IF NOT EXISTS templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  type         TEXT NOT NULL,
  payload      TEXT NOT NULL,
  run_at       TEXT NOT NULL,
  status       TEXT DEFAULT 'pending',
  created_at   TEXT NOT NULL
)`);

// ── Shim: expose better-sqlite3–style .prepare() / .transaction() ──────────

// node-sqlite3-wasm already has .prepare() returning statements with
// .run(values), .get(values), .all(values) — but uses :name bindings.
// We add a .transaction() shim for batch inserts.

db.transaction = function(fn) {
  return function(arg) {
    db.run('BEGIN');
    try   { fn(arg); db.run('COMMIT'); }
    catch (e) { db.run('ROLLBACK'); throw e; }
  };
};

module.exports = db;
