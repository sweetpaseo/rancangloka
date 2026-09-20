-- ============================================================================
-- Migration: 0016_media_assets_derivative_registration.sql
-- Description: LokaMedia Phase 5G1 - Media Asset Derivative Registration & Provenance
-- Safety: Additive columns and audit table only. Preserves all existing tables and data.
-- ============================================================================

-- 1. Additive columns for media_assets derivative registration and provenance
ALTER TABLE media_assets ADD COLUMN role TEXT DEFAULT 'ARTICLE_PUBLIC_DERIVATIVE';
ALTER TABLE media_assets ADD COLUMN upload_id TEXT;
ALTER TABLE media_assets ADD COLUMN derivative_id TEXT;
ALTER TABLE media_assets ADD COLUMN transform_id TEXT;
ALTER TABLE media_assets ADD COLUMN provenance_json TEXT;

-- 2. Audit table for media asset lifecycle events (safe metadata only, NO binary)
CREATE TABLE IF NOT EXISTS media_asset_audit (
    audit_id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'REGISTER',
    role TEXT NOT NULL DEFAULT 'ARTICLE_PUBLIC_DERIVATIVE',
    upload_id TEXT,
    derivative_id TEXT,
    transform_id TEXT,
    sha256 TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    safe_metadata_json TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_asset_audit_asset_id ON media_asset_audit(asset_id);
CREATE INDEX IF NOT EXISTS idx_media_asset_audit_sha256 ON media_asset_audit(sha256);
CREATE INDEX IF NOT EXISTS idx_media_asset_audit_created_at ON media_asset_audit(created_at);
