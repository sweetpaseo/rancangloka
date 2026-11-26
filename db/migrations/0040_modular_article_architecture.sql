-- ============================================================================
-- Migration 0040: Modular Article Architecture V1 (MAA-V1)
-- Canonical Storage for Versioned Components, Snapshots, and Audit History
-- ============================================================================

-- 1. Canonical Article Components Table
-- Stores isolated, versioned JSON records for each of the 14 logical component types
CREATE TABLE IF NOT EXISTS article_components (
  article_id INTEGER NOT NULL,
  component_type TEXT NOT NULL, -- 'identity', 'seo', 'evidence_pack', 'executive_summary', 'key_takeaways', 'narrative', 'cover_hero', 'inline_media', 'faq', 'internal_links', 'technical_references', 'metadata', 'publication_schedule', 'qa_receipts'
  schema_version INTEGER NOT NULL DEFAULT 1,
  component_version INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  content_json TEXT NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'DRAFT', -- 'MISSING' | 'DRAFT' | 'VALIDATED' | 'STALE' | 'BLOCKED'
  updated_by TEXT NOT NULL, -- 'seon' | 'irwan' | 'joko' | 'nadia' | 'budi' | 'rina' | 'sari' | 'owner'
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, component_type)
);

CREATE INDEX IF NOT EXISTS idx_article_components_lookup 
  ON article_components(article_id, component_type);

CREATE INDEX IF NOT EXISTS idx_article_components_status 
  ON article_components(article_id, validation_status);

-- 2. Immutable Article Snapshots Table
-- Complete, self-contained, reproducible snapshots referencing exact component versions
CREATE TABLE IF NOT EXISTS article_snapshots (
  snapshot_id TEXT PRIMARY KEY, -- e.g. 'snp_10019_v1_8db29944'
  article_id INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  manifest_json TEXT NOT NULL, -- JSON map of { component_type: { version, hash, status } }
  assembled_md TEXT NOT NULL,
  assembled_html TEXT NOT NULL,
  visual_manifest_json TEXT NOT NULL,
  assembly_hash TEXT NOT NULL, -- SHA-256 of canonical assembled markdown
  assembly_status TEXT NOT NULL DEFAULT 'COMPLETE', -- 'COMPLETE' | 'INCOMPLETE'
  is_active INTEGER NOT NULL DEFAULT 0, -- 1 if active staging/production pointer
  qa_receipts_json TEXT, -- JSON map of attached QA receipts
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_article_snapshots_lookup 
  ON article_snapshots(article_id, snapshot_version);

CREATE INDEX IF NOT EXISTS idx_article_snapshots_active 
  ON article_snapshots(article_id, is_active);

-- 3. Article Component Audit & History Table
-- Preserves every mutation for optimistic concurrency control and rollback
CREATE TABLE IF NOT EXISTS article_component_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  component_type TEXT NOT NULL,
  component_version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  content_json TEXT NOT NULL,
  validation_status TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  reason TEXT,
  idempotency_key TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_component_history_lookup 
  ON article_component_history(article_id, component_type, component_version);

CREATE INDEX IF NOT EXISTS idx_component_history_idempotency 
  ON article_component_history(idempotency_key);
