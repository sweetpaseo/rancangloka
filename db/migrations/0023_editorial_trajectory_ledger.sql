-- Migration: 0023_editorial_trajectory_ledger.sql
-- Description: Additive local schema for immutable canonical state snapshots,
-- article state transitions, and independent downstream decision outcomes.
-- Milestone: JEV-7K / JEV-7L
-- INVARIANT: LOCAL ADDITIVE MIGRATION ONLY. DO NOT APPLY TO PRODUCTION UNTIL SEPARATELY AUTHORIZED.

-- 1. Immutable Canonical State Snapshots
CREATE TABLE IF NOT EXISTS article_state_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  article_id INTEGER NOT NULL,
  input_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  slug TEXT NOT NULL,
  featured_asset_id TEXT,
  hero_image_present INTEGER NOT NULL,
  references_present INTEGER NOT NULL,
  persisted_readiness_status TEXT,
  planner_eligibility_status TEXT NOT NULL,
  editorial_validation_passed INTEGER NOT NULL,
  manual_hold INTEGER NOT NULL,
  reading_time_minutes INTEGER NOT NULL,
  is_sponsored INTEGER NOT NULL,
  input_schema_version TEXT NOT NULL,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  capture_source TEXT NOT NULL,
  UNIQUE(article_id, input_hash, input_schema_version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_article ON article_state_snapshots(article_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_input_hash ON article_state_snapshots(input_hash);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON article_state_snapshots(captured_at);

-- 2. Article State Transitions Ledger (Append-Only)
CREATE TABLE IF NOT EXISTS article_state_transitions (
  transition_id TEXT PRIMARY KEY,
  article_id INTEGER NOT NULL,
  from_snapshot_id TEXT,
  to_snapshot_id TEXT NOT NULL,
  from_input_hash TEXT,
  to_input_hash TEXT NOT NULL,
  from_observation_id TEXT,
  to_observation_id TEXT,
  transition_type TEXT NOT NULL,
  transition_source TEXT NOT NULL,
  mutation_operation_id TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  evidence_reference TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_transitions_article ON article_state_transitions(article_id);
CREATE INDEX IF NOT EXISTS idx_transitions_from_hash ON article_state_transitions(from_input_hash);
CREATE INDEX IF NOT EXISTS idx_transitions_to_hash ON article_state_transitions(to_input_hash);
CREATE INDEX IF NOT EXISTS idx_transitions_occurred_at ON article_state_transitions(occurred_at);

-- 3. Independent Decision Outcomes Ledger (Append-Only)
CREATE TABLE IF NOT EXISTS decision_outcomes (
  outcome_id TEXT PRIMARY KEY,
  article_id INTEGER NOT NULL,
  decision_observation_id TEXT,
  snapshot_id TEXT,
  input_hash TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  outcome_class TEXT NOT NULL,
  outcome_source TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  evidence_reference TEXT NOT NULL,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_outcomes_article ON decision_outcomes(article_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_input_hash ON decision_outcomes(input_hash);
CREATE INDEX IF NOT EXISTS idx_outcomes_type ON decision_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_outcomes_occurred_at ON decision_outcomes(occurred_at);
