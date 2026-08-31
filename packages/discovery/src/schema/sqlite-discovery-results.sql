-- Discovery Result persistence (E4.1)
-- Portable SQLite schema; PostgreSQL target documented in ADR E4.1 addendum.

CREATE TABLE IF NOT EXISTS discovery_results (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discovery_results_profile
  ON discovery_results (profile_id);
