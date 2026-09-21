-- ============================================================================
-- Migration: 0017_auto_schedule_and_manual_hold.sql
-- Description: Phase 5L2 - Hands-Off Auto-Schedule Foundation & Manual Hold
-- Safety: Additive columns and settings default only. Preserves all existing tables and data.
-- ============================================================================

-- 1. Add manual_hold columns to articles table
ALTER TABLE articles ADD COLUMN manual_hold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN manual_hold_reason TEXT DEFAULT NULL;
ALTER TABLE articles ADD COLUMN manual_hold_at DATETIME DEFAULT NULL;
ALTER TABLE articles ADD COLUMN manual_hold_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_status_manual_hold ON articles(status, manual_hold);

-- 2. Add scheduling_mode to article_publication_plans with safe historical default 'legacy'
ALTER TABLE article_publication_plans ADD COLUMN scheduling_mode TEXT NOT NULL DEFAULT 'legacy';

-- 3. Add execution_mode to article_publication_executions with safe historical default 'legacy'
ALTER TABLE article_publication_executions ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'legacy';

-- 4. Insert global auto-schedule toggle default OFF
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('auto_schedule_enabled', 'false', CURRENT_TIMESTAMP);
