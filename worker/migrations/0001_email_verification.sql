-- Email verification for new signups.
--
-- Additive only. Existing accounts keep working: SQLite fills the new column with the
-- DEFAULT (1) for every row that already exists, so nobody is locked out. The signup
-- handler inserts email_verified = 0 explicitly for accounts created from now on.
--
-- Apply once (it is not re-runnable, ALTER TABLE ADD COLUMN has no IF NOT EXISTS):
--   npx wrangler d1 execute shadowflow-db --remote --file=migrations/0001_email_verification.sql

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id, created_at DESC);
