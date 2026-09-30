-- Migration: 0025_mission_control_anomalies.sql
-- Description: Additive schema for canonical Mission Control anomaly normalization,
-- deduplicated tracking, and staff escalation lifecycle.
-- Milestone: HERMES-MC-6
-- INVARIANT: LOCAL ADDITIVE MIGRATION ONLY. DO NOT APPLY TO PRODUCTION UNTIL SEPARATELY AUTHORIZED.

-- 1. Mission Control Normalized Anomalies
CREATE TABLE IF NOT EXISTS mission_control_anomalies (
  anomaly_id TEXT PRIMARY KEY,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_system TEXT NOT NULL,
  source_event_id TEXT,
  department_id TEXT NOT NULL,
  responsible_agent_id TEXT,
  task_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  severity TEXT NOT NULL CHECK(severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  anomaly_type TEXT NOT NULL,
  error_class TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  technical_detail TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED', 'EXPECTED')),
  retryable INTEGER NOT NULL DEFAULT 0,
  operator_action_required INTEGER NOT NULL DEFAULT 0,
  expected_condition INTEGER NOT NULL DEFAULT 0,
  evidence_reference TEXT,
  fingerprint TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_mc_anom_fingerprint ON mission_control_anomalies(fingerprint);
CREATE INDEX IF NOT EXISTS idx_mc_anom_state ON mission_control_anomalies(state);
CREATE INDEX IF NOT EXISTS idx_mc_anom_severity ON mission_control_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_mc_anom_dept ON mission_control_anomalies(department_id);
CREATE INDEX IF NOT EXISTS idx_mc_anom_agent ON mission_control_anomalies(responsible_agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_anom_last_seen ON mission_control_anomalies(last_seen_at);

-- 2. Mission Control Anomaly Audit Events
CREATE TABLE IF NOT EXISTS mission_control_anomaly_events (
  event_id TEXT PRIMARY KEY,
  anomaly_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('DETECTED', 'UPDATED', 'ESCALATED', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED')),
  previous_state TEXT,
  new_state TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT,
  FOREIGN KEY (anomaly_id) REFERENCES mission_control_anomalies(anomaly_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mc_anom_ev_anomaly ON mission_control_anomaly_events(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_mc_anom_ev_created ON mission_control_anomaly_events(created_at);
