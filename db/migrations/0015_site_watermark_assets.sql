-- ============================================================================
-- Migration: 0015_site_watermark_assets.sql
-- Description: LokaMedia Phase 5D4B - Site-Level Watermark Master Asset Storage
-- Semantics:
--   1. Authoritative binary metadata for site-level watermark master assets.
--   2. Pure site-level scope: zero coupling to articles or article_media.
--   3. Content-addressed identity and SHA-256 deduplication.
--   4. R2 private storage namespace: site/watermarks/master/<sha256>.<ext>
--   5. Binary health and transparency status (alpha_present).
-- Safety: Additive only. Preserves all existing tables, columns, indexes, and data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS site_watermark_assets (
    asset_id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL DEFAULT 'WATERMARK_MASTER',
    source_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png', 'image/webp')),
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    byte_size INTEGER NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
    r2_key TEXT NOT NULL UNIQUE,
    alpha_present INTEGER NOT NULL DEFAULT 1 CHECK(alpha_present IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'VALIDATED' CHECK(status IN ('VALIDATED', 'FAILED')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_watermark_assets_sha256 ON site_watermark_assets(sha256);
CREATE INDEX IF NOT EXISTS idx_site_watermark_assets_purpose ON site_watermark_assets(purpose);
CREATE INDEX IF NOT EXISTS idx_site_watermark_assets_created_at ON site_watermark_assets(created_at);
