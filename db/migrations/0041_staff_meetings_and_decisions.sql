-- Migration: 0041_staff_meetings_and_decisions.sql
-- Description: Additive schema for Staff Meeting Minutes, Decision Register, and Action Item Tracking.
-- Milestone: OLCI-MEETING-MINUTES-V1
-- INVARIANT: LOCAL ADDITIVE MIGRATION ONLY. DO NOT APPLY TO PRODUCTION UNTIL SEPARATELY AUTHORIZED.

-- 1. Staff Meetings Master Table
CREATE TABLE IF NOT EXISTS mission_control_meetings (
  meeting_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  meeting_type TEXT NOT NULL CHECK(meeting_type IN (
    'EDITORIAL_COORDINATION',
    'INCIDENT_POSTMORTEM',
    'TECHNICAL_REVIEW',
    'STRATEGY_ALIGNMENT',
    'QUALITY_IMPROVEMENT',
    'GOVERNANCE_AND_SAFETY'
  )),
  meeting_date TEXT NOT NULL,
  initiator_id TEXT NOT NULL,
  initiator_name TEXT NOT NULL,
  chair_id TEXT NOT NULL,
  chair_name TEXT NOT NULL,
  actual_start_at TEXT NOT NULL,
  actual_end_at TEXT,
  actual_duration_seconds INTEGER,
  meeting_status TEXT NOT NULL CHECK(meeting_status IN (
    'INITIATED',
    'IN_PROGRESS',
    'COMPLETED',
    'COMPLETED_WITH_PENDING_ACTIONS',
    'CANCELLED',
    'FAILED'
  )),
  provenance TEXT NOT NULL CHECK(provenance IN (
    'REAL_RUNTIME',
    'HISTORICAL_RECONSTRUCTION',
    'DRY_RUN',
    'SIMULATION',
    'FIXTURE_TEST'
  )),
  summary_text TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mcm_date ON mission_control_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_mcm_status ON mission_control_meetings(meeting_status);
CREATE INDEX IF NOT EXISTS idx_mcm_initiator ON mission_control_meetings(initiator_id);
CREATE INDEX IF NOT EXISTS idx_mcm_chair ON mission_control_meetings(chair_id);

-- 2. Meeting Decisions Register
CREATE TABLE IF NOT EXISTS mission_control_meeting_decisions (
  decision_id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  title TEXT NOT NULL,
  decision_text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  authority_role TEXT NOT NULL,
  authority_type TEXT NOT NULL CHECK(authority_type IN (
    'STAFF_AUTONOMOUS',
    'COORDINATOR_ARBITRATION',
    'PENDING_OWNER_APPROVAL'
  )),
  status TEXT NOT NULL CHECK(status IN (
    'ADOPTED',
    'PENDING_OWNER',
    'SUPERSEDED',
    'REJECTED'
  )),
  decided_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES mission_control_meetings(meeting_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcmd_meeting ON mission_control_meeting_decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_mcmd_status ON mission_control_meeting_decisions(status);
CREATE INDEX IF NOT EXISTS idx_mcmd_authority ON mission_control_meeting_decisions(authority_type);

-- 3. Meeting Action Items Tracking
CREATE TABLE IF NOT EXISTS mission_control_meeting_action_items (
  action_id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  description TEXT NOT NULL,
  responsible_staff_id TEXT NOT NULL,
  responsible_staff_name TEXT NOT NULL,
  related_task_id TEXT,
  related_article_ref TEXT,
  status TEXT NOT NULL CHECK(status IN (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'BLOCKED',
    'CANCELLED'
  )),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date TEXT,
  completed_at TEXT,
  completion_evidence TEXT,
  result_summary TEXT,
  FOREIGN KEY (meeting_id) REFERENCES mission_control_meetings(meeting_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcmai_meeting ON mission_control_meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_mcmai_staff ON mission_control_meeting_action_items(responsible_staff_id);
CREATE INDEX IF NOT EXISTS idx_mcmai_status ON mission_control_meeting_action_items(status);
