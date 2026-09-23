-- Migration: 0021_decision_observations.sql
-- Description: Additive local schema for durable TypeSafe Jev shadow decision telemetry.
-- Milestone: JEV-4D
-- INVARIANT: LOCAL ADDITIVE MIGRATION ONLY. DO NOT APPLY TO PRODUCTION.

CREATE TABLE IF NOT EXISTS decision_observations (
  observation_id TEXT PRIMARY KEY,
  decision_point TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  run_id TEXT,
  authoritative_decision TEXT NOT NULL,
  authoritative_reasons_json TEXT,
  jev_decision TEXT,
  jev_probabilities_json TEXT,
  jev_confidence REAL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  model_version TEXT NOT NULL,
  input_schema_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  provider_status TEXT NOT NULL, -- 'SUCCESS', 'ERROR', 'FALLBACK'
  provider_error_class TEXT,
  disagreement_classification TEXT NOT NULL, -- 'AGREE_CONTINUE', 'AGREE_STOP', 'JEV_MORE_CONSERVATIVE', etc.
  cost_routing_estimate_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decision_obs_point ON decision_observations(decision_point);
CREATE INDEX IF NOT EXISTS idx_decision_obs_subject ON decision_observations(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_decision_obs_run ON decision_observations(run_id);
CREATE INDEX IF NOT EXISTS idx_decision_obs_disagreement ON decision_observations(disagreement_classification);
CREATE INDEX IF NOT EXISTS idx_decision_obs_created_at ON decision_observations(created_at);
