-- Progress Dashboard tables: page_views, downloads, payments (provider-agnostic), repo_stats_daily.
-- Additive only; safe to run once against shadowflow-db.
-- Apply:
--   npx wrangler d1 execute shadowflow-db --remote --file=migrations/0002_progress_dashboard.sql

CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  referrer_domain TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'XX',
  visitor_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_views_day_path ON page_views(day, path);
CREATE INDEX IF NOT EXISTS idx_page_views_day_visitor ON page_views(day, visitor_hash);

CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  asset TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'direct',
  country TEXT NOT NULL DEFAULT 'XX',
  referrer_domain TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_downloads_day_asset ON downloads(day, asset);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_event_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  plan TEXT NOT NULL DEFAULT 'pro',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'succeeded',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE TABLE IF NOT EXISTS repo_stats_daily (
  day TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  watchers INTEGER NOT NULL DEFAULT 0,
  open_issues INTEGER NOT NULL DEFAULT 0,
  clones_count INTEGER NOT NULL DEFAULT 0,
  clones_uniques INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  views_uniques INTEGER NOT NULL DEFAULT 0,
  release_downloads INTEGER NOT NULL DEFAULT 0,
  top_referrers TEXT NOT NULL DEFAULT '[]',
  synced_at TEXT NOT NULL
);
