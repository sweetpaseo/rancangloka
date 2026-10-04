-- Migration: 0026_mission_control_operator_actions.sql
-- Description: Additive schema for canonical Mission Control human operator action audit trail,
-- concurrency tracking, and workstation intervention gate.
-- Milestone: MC-LIVEOPS-3
-- INVARIANT: LOCAL ADDITIVE MIGRATION ONLY. DO NOT APPLY TO PRODUCTION UNTIL SEPARATELY AUTHORIZED.

CREATE TABLE IF NOT EXISTS mission_control_operator_actions (
  action_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL CHECK(action_type IN ('ACKNOWLEDGE_ANOMALY', 'ESCALATE_BLOCKED_TASK', 'REQUEST_HUMAN_REVIEW', 'REQUEST_EVIDENCE_FOLLOWUP')),
  target_type TEXT NOT NULL CHECK(target_type IN ('TASK', 'ANOMALY', 'STAFF', 'ARTICLE')),
  target_id TEXT NOT NULL,
  requested_by TEXT NOT NULL DEFAULT 'admin_operator',
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  expected_state_json TEXT,
  before_state_json TEXT,
  after_state_json TEXT,
  safety_class TEXT NOT NULL CHECK(safety_class IN ('LOW_RISK_INTERNAL', 'GOVERNANCE_REVIEW')),
  status TEXT NOT NULL DEFAULT 'EXECUTED' CHECK(status IN ('EXECUTED', 'REJECTED', 'FAILED')),
  result_summary TEXT NOT NULL,
  audit_hash TEXT NOT NULL,
  related_task_id TEXT,
  related_anomaly_id TEXT,
  related_agent_id TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_mc_action_type ON mission_control_operator_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_mc_action_target ON mission_control_operator_actions(target_id);
CREATE INDEX IF NOT EXISTS idx_mc_action_created ON mission_control_operator_actions(requested_at);
CREATE INDEX IF NOT EXISTS idx_mc_action_task ON mission_control_operator_actions(related_task_id);
