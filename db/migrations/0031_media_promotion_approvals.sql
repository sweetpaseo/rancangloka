-- ============================================================================
-- Migration: 0031_media_promotion_approvals.sql
-- Description: Server-Side Promotion Approval Dual-Control for Published Articles
-- Semantics:
--   1. media_promotion_approvals stores dual-control promotion requests & receipts.
--   2. Authority Separation:
--      - Media devices create requests (status: 'REQUESTED').
--      - Only authenticated Human Admin can transition 'REQUESTED' -> 'APPROVED'.
--      - Upload endpoint requires status = 'APPROVED' and transitions to 'CONSUMED'.
--   3. Bound strictly to device_id, article_id, slug, content_hash, and candidate_sha256.
-- Safety: Additive only. Preserves all existing tables, columns, indexes, and data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_promotion_approvals (
    approval_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    article_slug TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    candidate_sha256 TEXT NOT NULL,
    slot_key TEXT NOT NULL DEFAULT 'featured',
    candidate_width INTEGER,
    candidate_height INTEGER,
    candidate_mime TEXT,
    candidate_byte_size INTEGER,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    signature TEXT,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    approved_by TEXT,
    rejection_reason TEXT,
    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME,
    consumed_by_upload_id TEXT,
    CHECK (status IN ('REQUESTED', 'APPROVED', 'CONSUMED', 'EXPIRED', 'REJECTED', 'ISSUED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_prom_appr_slug ON media_promotion_approvals(article_slug);
CREATE INDEX IF NOT EXISTS idx_prom_appr_sha ON media_promotion_approvals(candidate_sha256);
CREATE INDEX IF NOT EXISTS idx_prom_appr_device ON media_promotion_approvals(device_id);
CREATE INDEX IF NOT EXISTS idx_prom_appr_status ON media_promotion_approvals(status);
