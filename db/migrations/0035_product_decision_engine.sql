-- ============================================================================
-- Migration: 0035_product_decision_engine.sql
-- Description: Add Product Decision Engine model persistence and activation audit tables
-- Milestone: PRODUCT_DECISION_ENGINE-1D-A
-- Invariants:
-- 1. D1_STORES_DECISION_MODEL (D1 stores structured model, evaluator computes decision)
-- 2. At most one ACTIVE version per model_id via partial unique index
-- 3. Controlled lifecycle: DRAFT, VALIDATED, ACTIVE, SUPERSEDED, DISABLED
-- ============================================================================

-- 1. Table: decision_models
CREATE TABLE IF NOT EXISTS decision_models (
  version_key TEXT PRIMARY KEY,
  model_id TEXT NOT NULL CHECK(length(model_id) > 0),
  model_version TEXT NOT NULL CHECK(length(model_version) > 0),
  criteria_version TEXT NOT NULL CHECK(length(criteria_version) > 0),

  problem_id TEXT NOT NULL CHECK(length(problem_id) > 0),
  problem_title TEXT NOT NULL,
  problem_slug TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  primary_article_id INTEGER NOT NULL,

  status TEXT NOT NULL CHECK(status IN ('DRAFT', 'VALIDATED', 'ACTIVE', 'SUPERSEDED', 'DISABLED')),
  evidence_snapshot_hash TEXT NOT NULL,
  model_payload_hash TEXT NOT NULL,

  solution_classes_json TEXT NOT NULL,
  criteria_json TEXT NOT NULL,
  evaluations_json TEXT NOT NULL,
  constraints_json TEXT NOT NULL,
  scenarios_json TEXT NOT NULL,
  evidence_bindings_json TEXT NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME NULL,
  superseded_at DATETIME NULL,
  activated_by TEXT NULL,

  FOREIGN KEY (primary_article_id) REFERENCES articles(id)
);

-- 2. Indexes for model querying, lifecycle, and integrity
CREATE INDEX IF NOT EXISTS idx_decision_models_model_status ON decision_models(model_id, status);
CREATE INDEX IF NOT EXISTS idx_decision_models_article_id ON decision_models(primary_article_id);
CREATE INDEX IF NOT EXISTS idx_decision_models_evidence_hash ON decision_models(evidence_snapshot_hash);

-- 3. Strict partial unique index: Exactly at most ONE active version per model_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_models_active_unique ON decision_models(model_id) WHERE status = 'ACTIVE';

-- 4. Table: decision_model_activations (Append-only human activation audit ledger)
CREATE TABLE IF NOT EXISTS decision_model_activations (
  activation_id TEXT PRIMARY KEY,
  version_key TEXT NOT NULL,
  model_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('ACTIVATE', 'SUPERSEDE', 'DISABLE')),
  actor TEXT NOT NULL CHECK(length(actor) > 0),
  rationale TEXT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (version_key) REFERENCES decision_models(version_key)
);

CREATE INDEX IF NOT EXISTS idx_decision_activations_version ON decision_model_activations(version_key);
CREATE INDEX IF NOT EXISTS idx_decision_activations_model ON decision_model_activations(model_id);
