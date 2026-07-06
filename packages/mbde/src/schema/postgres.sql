-- MBDE Postgres schema (future production persistence)
-- JSONB used for declarative eligibility rules and flexible metadata

CREATE TABLE IF NOT EXISTS mbde_users (
  id UUID PRIMARY KEY,
  external_session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mbde_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES mbde_users(id) ON DELETE CASCADE,
  profile JSONB NOT NULL,
  completeness_score INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mbde_benefit_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  benefit_type TEXT NOT NULL,
  geography JSONB NOT NULL DEFAULT '{}',
  eligibility_rules JSONB NOT NULL,
  value_estimate JSONB NOT NULL,
  source JSONB NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  cluster_theme TEXT,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  replaced_by_id TEXT REFERENCES mbde_benefit_nodes(id),
  scoring_hints JSONB,
  eligibility_confidence_baseline NUMERIC(4,3) NOT NULL DEFAULT 0.85,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mbde_benefit_versions (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES mbde_benefit_nodes(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (node_id, version)
);

CREATE TABLE IF NOT EXISTS mbde_geo_mapping (
  id BIGSERIAL PRIMARY KEY,
  country TEXT,
  state TEXT,
  city TEXT,
  district TEXT,
  benefit_id TEXT NOT NULL REFERENCES mbde_benefit_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mbde_sources (
  id BIGSERIAL PRIMARY KEY,
  benefit_id TEXT NOT NULL REFERENCES mbde_benefit_nodes(id) ON DELETE CASCADE,
  authority TEXT NOT NULL,
  url TEXT NOT NULL,
  ingestion_layer TEXT NOT NULL,
  last_fetched_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mbde_update_logs (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL,
  trigger TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  ingested INT NOT NULL DEFAULT 0,
  updated INT NOT NULL DEFAULT 0,
  deprecated INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mbde_user_opportunities (
  user_id UUID NOT NULL REFERENCES mbde_users(id) ON DELETE CASCADE,
  benefit_id TEXT NOT NULL REFERENCES mbde_benefit_nodes(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL,
  eligibility_confidence NUMERIC(4,3) NOT NULL,
  total_score NUMERIC(8,4) NOT NULL,
  annual_value_eur INT NOT NULL,
  score_payload JSONB NOT NULL,
  PRIMARY KEY (user_id, benefit_id, computed_at)
);

CREATE INDEX IF NOT EXISTS idx_mbde_benefit_nodes_status ON mbde_benefit_nodes(status);
CREATE INDEX IF NOT EXISTS idx_mbde_benefit_nodes_category ON mbde_benefit_nodes(category);
CREATE INDEX IF NOT EXISTS idx_mbde_geo_mapping_lookup ON mbde_geo_mapping(country, state, city);
CREATE INDEX IF NOT EXISTS idx_mbde_user_opportunities_user ON mbde_user_opportunities(user_id, computed_at DESC);
