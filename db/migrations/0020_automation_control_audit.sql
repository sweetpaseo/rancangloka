-- ============================================================================
-- Migration: 0020_automation_control_audit.sql
-- Description: Phase 5L12B - Dedicated Control-Plane Audit Ledger
-- Safety: Additive only. Creates automation_control_audit table and indexes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_control_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL DEFAULT 'admin_operator',
    source TEXT NOT NULL DEFAULT 'operator_api',
    previous_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    reason TEXT DEFAULT NULL,
    correlation_id TEXT DEFAULT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (event_type IN (
        'AUTOMATION_MODE_CHANGED',
        'AUTO_SCHEDULE_CHANGED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_automation_control_audit_event 
ON automation_control_audit(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_control_audit_created 
ON automation_control_audit(created_at DESC);
