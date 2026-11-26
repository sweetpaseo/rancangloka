-- ============================================================================
-- Migration: 0042_unified_topic_lifecycle.sql
-- Milestone: UTLIS-V1 (Unified Topic Lifecycle & Intelligence System V1)
-- Mode: Additive & Backward-Compatible
--
-- Creates canonical persistent Topic Bank, Permanent Topic Registry,
-- Decision History, Atomic Topic Reservations, Global Article Identity Map,
-- and Irwan Research Repository Index.
-- ============================================================================

-- 1. Additive columns on existing tables (backward-compatible, nullable)
-- Note: articles.topic_id and articles.canonical_article_uid link articles to editorial_topics.
-- bridge_import_jobs links via global_article_identity_map.bridge_job_id.
ALTER TABLE articles ADD COLUMN topic_id TEXT NULL;
ALTER TABLE articles ADD COLUMN canonical_article_uid TEXT NULL;

-- 2. Canonical Topic Registry & Topic Bank
-- Note: Intentionally NO unique constraint on focus_keyword alone to support
-- RancangLoka's Multi-Angle Editorial Policy (up to 5 distinct angles per topic).
CREATE TABLE IF NOT EXISTS editorial_topics (
  topic_id TEXT PRIMARY KEY,
  canonical_topic_key TEXT NOT NULL,
  angle_key TEXT NOT NULL DEFAULT 'primary',
  angle_index INTEGER NOT NULL DEFAULT 1,
  category_id INTEGER NOT NULL,
  subcategory TEXT,
  topic_family TEXT,
  topic_cluster TEXT,
  candidate_title TEXT NOT NULL,
  canonical_slug TEXT,
  focus_keyword TEXT NOT NULL,
  supporting_keywords_json TEXT NOT NULL DEFAULT '[]',
  search_intent TEXT NOT NULL DEFAULT 'Informational',
  content_angle TEXT NOT NULL DEFAULT 'Panduan Praktis Rumah Tropis',
  reader_need TEXT,
  archetype TEXT DEFAULT 'Spatial Planning',
  seasonality TEXT NOT NULL DEFAULT 'EVERGREEN',
  estimated_word_count INTEGER NOT NULL DEFAULT 1350,
  discovery_source TEXT NOT NULL DEFAULT 'MAYA_STRATEGY',
  proposing_staff TEXT NOT NULL DEFAULT 'maya',
  discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  epis_score REAL NOT NULL DEFAULT 0,
  priority_rank INTEGER NOT NULL DEFAULT 0,
  priority_rationale TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (
    lifecycle_status IN (
      'DISCOVERED',
      'KEYWORD_VALIDATED',
      'PRIORITIZED',
      'READY_FOR_RESEARCH',
      'RESERVED',
      'IN_RESEARCH',
      'RESEARCH_READY',
      'READY_FOR_WRITING',
      'IN_WRITING',
      'EDITORIAL_REVIEW',
      'MEDIA_PRODUCTION',
      'STAGED_IN_REVIEW',
      'SCHEDULED',
      'PUBLISHED',
      'DEFERRED',
      'BLOCKED',
      'REJECTED',
      'MERGED',
      'CANCELLED',
      'ARCHIVED'
    )
  ),
  related_task_id TEXT,
  related_research_id TEXT,
  related_article_id INTEGER,
  canonical_article_uid TEXT,
  published_url TEXT,
  environment_scope TEXT NOT NULL DEFAULT 'production' CHECK (
    environment_scope IN ('production', 'staging', 'local', 'fixture')
  ),
  is_test_fixture INTEGER NOT NULL DEFAULT 0,
  duplicate_screening_json TEXT,
  decision_summary TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(canonical_topic_key, angle_key)
);

CREATE INDEX IF NOT EXISTS idx_etopics_status_epis ON editorial_topics(lifecycle_status, epis_score DESC);
CREATE INDEX IF NOT EXISTS idx_etopics_canonical_key ON editorial_topics(canonical_topic_key);
CREATE INDEX IF NOT EXISTS idx_etopics_slug ON editorial_topics(canonical_slug);
CREATE INDEX IF NOT EXISTS idx_etopics_focus_kw ON editorial_topics(focus_keyword);
CREATE INDEX IF NOT EXISTS idx_etopics_category ON editorial_topics(category_id);
CREATE INDEX IF NOT EXISTS idx_etopics_family ON editorial_topics(topic_family);
CREATE INDEX IF NOT EXISTS idx_etopics_article_uid ON editorial_topics(canonical_article_uid);
CREATE INDEX IF NOT EXISTS idx_etopics_fixture ON editorial_topics(is_test_fixture);

-- 3. Topic Decision History & Transition Audit Trail
CREATE TABLE IF NOT EXISTS topic_decision_history (
  decision_id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES editorial_topics(topic_id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  event_ref TEXT,
  task_id TEXT,
  override_flag INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tdh_topic_id ON topic_decision_history(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tdh_actor ON topic_decision_history(actor);

-- 4. Atomic Topic Reservations (Concurrency & Double-Dispatch Prevention)
CREATE TABLE IF NOT EXISTS topic_reservations (
  reservation_id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES editorial_topics(topic_id) ON DELETE CASCADE,
  canonical_topic_key TEXT NOT NULL,
  angle_key TEXT NOT NULL DEFAULT 'primary',
  task_id TEXT NOT NULL,
  production_channel TEXT NOT NULL CHECK (
    production_channel IN ('hermes', 'loka_bridge', 'reference_intake', 'manual_owner')
  ),
  lease_owner TEXT NOT NULL,
  lease_expires_at DATETIME NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  fencing_token INTEGER NOT NULL DEFAULT 1,
  reservation_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    reservation_status IN ('ACTIVE', 'RELEASED', 'COMPLETED', 'EXPIRED', 'CANCELLED')
  ),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Database-enforced single active reservation per topic/opportunity
CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_res_active_unique
  ON topic_reservations(topic_id)
  WHERE reservation_status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_topic_res_status_expiry
  ON topic_reservations(reservation_status, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_topic_res_task_id
  ON topic_reservations(task_id);

-- 5. Global Article Identity & Cross-Environment Reconciliation Map
-- Explicitly separates staging_article_id from production_article_id.
CREATE TABLE IF NOT EXISTS global_article_identity_map (
  canonical_article_uid TEXT PRIMARY KEY,
  topic_id TEXT REFERENCES editorial_topics(topic_id) ON DELETE SET NULL,
  angle_key TEXT,
  research_id TEXT,
  task_id TEXT,
  canonical_slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  focus_keyword TEXT,
  category_id INTEGER,
  topic_family TEXT,
  staging_article_id INTEGER,
  production_article_id INTEGER,
  ingest_receipt_id TEXT,
  bridge_job_id TEXT,
  published_url TEXT,
  article_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    article_status IN ('draft', 'staged', 'scheduled', 'published', 'archived')
  ),
  is_test_fixture INTEGER NOT NULL DEFAULT 0,
  environment_freshness_at DATETIME,
  sync_status TEXT NOT NULL DEFAULT 'SYNCED' CHECK (
    sync_status IN ('SYNCED', 'STAGING_ONLY', 'PRODUCTION_ONLY', 'STALE', 'PENDING_RECONCILIATION')
  ),
  lineage_proof_json TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gaim_topic_id ON global_article_identity_map(topic_id);
CREATE INDEX IF NOT EXISTS idx_gaim_staging_id ON global_article_identity_map(staging_article_id);
CREATE INDEX IF NOT EXISTS idx_gaim_prod_id ON global_article_identity_map(production_article_id);
CREATE INDEX IF NOT EXISTS idx_gaim_status ON global_article_identity_map(article_status, is_test_fixture);

-- 6. Irwan Research Repository Index
-- Stores lightweight verified index & freshness metadata pointing to artifact_reference
-- instead of duplicating full evidence pack payloads redundantly.
CREATE TABLE IF NOT EXISTS research_evidence_packs (
  research_id TEXT PRIMARY KEY,
  topic_id TEXT REFERENCES editorial_topics(topic_id) ON DELETE SET NULL,
  canonical_article_uid TEXT,
  research_domain TEXT NOT NULL,
  topic_keywords TEXT,
  evidence_claims_json TEXT NOT NULL DEFAULT '[]',
  source_references_json TEXT NOT NULL DEFAULT '[]',
  document_editions_json TEXT NOT NULL DEFAULT '[]',
  section_references_json TEXT NOT NULL DEFAULT '[]',
  source_provenance TEXT NOT NULL DEFAULT 'VERIFIED_PRIMARY',
  verified_at DATETIME,
  freshness_expires_at DATETIME,
  freshness_status TEXT NOT NULL DEFAULT 'FRESH' CHECK (
    freshness_status IN ('FRESH', 'STALE', 'EXPIRED', 'UNVERIFIED')
  ),
  artifact_reference TEXT NOT NULL,
  reuse_count INTEGER NOT NULL DEFAULT 0,
  reuse_history_json TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_research_topic_id ON research_evidence_packs(topic_id);
CREATE INDEX IF NOT EXISTS idx_research_domain ON research_evidence_packs(research_domain);
CREATE INDEX IF NOT EXISTS idx_research_freshness ON research_evidence_packs(freshness_status, freshness_expires_at);
