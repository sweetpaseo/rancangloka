-- ============================================================================
-- Migration: 0018_publication_operator_audit.sql
-- Description: Phase 5L4 - Publication Automation Operator Audit & Control Events
-- Safety: Additive only. Creates publication_operator_audit table and indexes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS publication_operator_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    article_id INTEGER DEFAULT NULL REFERENCES articles(id) ON DELETE CASCADE,
    plan_id TEXT DEFAULT NULL,
    execution_id TEXT DEFAULT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL DEFAULT 'admin_operator',
    reason TEXT DEFAULT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (event_type IN (
        'MANUAL_HOLD_SET',
        'MANUAL_HOLD_CLEARED',
        'RETURNED_TO_DRAFT_AND_HELD',
        'AUTO_SCHEDULE_ENABLED',
        'AUTO_SCHEDULE_DISABLED',
        'PLAN_CANCELLED_BY_OPERATOR'
    ))
);

CREATE INDEX IF NOT EXISTS idx_pub_operator_audit_article 
ON publication_operator_audit(article_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_operator_audit_event 
ON publication_operator_audit(event_type, created_at DESC);
