-- ============================================================================
-- Migration: 0007_publication_readiness_and_approvals.sql
-- Description: Publication Readiness Gate & Cryptographic Editorial Approvals (PUBLICATION-0)
-- Semantics:
--   1. Strict separation of states:
--      - articles.status: 'draft' | 'published' | 'scheduled' (article lifecycle)
--      - media_assets.status: 'VALIDATED' etc. (binary asset health)
--      - article_media.is_active: 1 | 0 (relational binding)
--      - article_editorial_approvals: 'APPROVED' | 'REJECTED' | 'REVOKED' (human sign-off)
--      - article_publication_readiness: 'READY_TO_SCHEDULE' | 'NOT_READY' | 'BLOCKED' (gate snapshot)
--   2. Invalidation rules:
--      - Approval is cryptographically tied to article content_hash and featured media asset_id.
--      - Content mutation or featured media replacement invalidates approval.
--   3. Readiness Snapshot:
--      - Immutable audit log of every gate evaluation with complete check vectors.
-- Safety: Additive only. Preserves all existing tables, columns, indexes, and data.
-- ============================================================================

-- 1. Table: article_editorial_approvals
-- Stores explicit, auditable human sign-offs with cryptographic digests
CREATE TABLE IF NOT EXISTS article_editorial_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    approved_by TEXT NOT NULL,                        -- Operator username / authenticated email
    approved_role TEXT NOT NULL DEFAULT 'editor_in_chief', -- 'editor_in_chief' | 'managing_editor'
    approval_status TEXT NOT NULL DEFAULT 'APPROVED', -- 'APPROVED' | 'REJECTED' | 'REVOKED'
    approved_content_hash TEXT NOT NULL,              -- SHA-256 of article content_md at approval time
    approved_asset_id TEXT NOT NULL,                  -- asset_id of active featured media at approval time
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (approval_status IN ('APPROVED', 'REJECTED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_article_status 
ON article_editorial_approvals(article_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_approvals_created_at 
ON article_editorial_approvals(created_at DESC);

-- 2. Table: article_publication_readiness
-- Stores immutable evaluation snapshots from the Publication Readiness Gate
CREATE TABLE IF NOT EXISTS article_publication_readiness (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    is_ready INTEGER NOT NULL DEFAULT 0,              -- 1 = READY_TO_SCHEDULE, 0 = NOT_READY
    overall_status TEXT NOT NULL DEFAULT 'NOT_READY', -- 'READY_TO_SCHEDULE' | 'NOT_READY' | 'BLOCKED'
    content_hash TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,                      -- Complete JSON payload of evaluation vectors & blockers
    evaluated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (is_ready IN (0, 1)),
    CHECK (overall_status IN ('READY_TO_SCHEDULE', 'NOT_READY', 'BLOCKED'))
);

CREATE INDEX IF NOT EXISTS idx_readiness_article 
ON article_publication_readiness(article_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_readiness_ready 
ON article_publication_readiness(is_ready, overall_status);
