-- ============================================================================
-- Migration: 0005_media_assets_and_article_media.sql
-- Description: LokaMedia Foundation - Runtime Schema (MEDIA-0 Final Hardened)
-- Semantics:
--   1. media_assets.status describes binary asset health ONLY:
--      'PENDING', 'UPLOADING', 'VALIDATED', 'REJECTED', 'FAILED'.
--      (ATTACHED and SUPERSEDED are barred from media_assets; attachment
--       lifecycle belongs exclusively to article_media.is_active).
--   2. Global SHA-256 storage key pattern: media/images/<sha256>.<ext>
--   3. Relational binding lifecycle: article_media (is_active: 1=active, 0=inactive)
-- Safety: Additive only. Preserves all existing tables, columns, indexes, and data.
-- Scope: D1 Staging Draft (image enabled; video, lokamedia_extension, fal reserved).
-- ============================================================================

-- 1. Table: media_assets
-- Stores authoritative binary asset records stored in Cloudflare R2
CREATE TABLE IF NOT EXISTS media_assets (
    asset_id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL DEFAULT 'image',
    source_type TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,                -- Global canonical key: media/images/<sha256>.<ext>
    public_url TEXT NOT NULL,                        -- Global canonical URL: /media/images/<sha256>.<ext>
    mime_type TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,                     -- 1:1 binding between SHA-256 and media_asset record
    alt_text TEXT,
    status TEXT NOT NULL DEFAULT 'VALIDATED',        -- Binary lifecycle ONLY: PENDING | UPLOADING | VALIDATED | REJECTED | FAILED
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Media Type Constraint: IMAGE currently enabled, VIDEO reserved for future LokaMedia
    CHECK (media_type IN ('image', 'video')),

    -- Source Type Constraint: manual_upload enabled, lokamedia_extension & fal_generated reserved
    CHECK (source_type IN ('manual_upload', 'lokamedia_extension', 'fal_generated')),

    -- Supported MIME Types: JPEG, PNG, WebP (AVIF not supported in Media-0)
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),

    -- Media Binary Lifecycle States (Describes binary health ONLY, never article attachment)
    CHECK (status IN ('PENDING', 'UPLOADING', 'VALIDATED', 'REJECTED', 'FAILED'))
);

-- Indices for fast querying and global deduplication
CREATE INDEX IF NOT EXISTS idx_media_assets_sha256 ON media_assets(sha256);
CREATE INDEX IF NOT EXISTS idx_media_assets_source_type ON media_assets(source_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_media_type ON media_assets(media_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(status);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at);

-- 2. Table: article_media
-- Relational join table mapping media assets to articles with role and active history.
-- Article-specific replacement is managed here via is_active (1 = active, 0 = replaced/superseded).
CREATE TABLE IF NOT EXISTS article_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES media_assets(asset_id) ON DELETE RESTRICT,
    role TEXT NOT NULL,
    slot_key TEXT NOT NULL DEFAULT 'primary',
    is_active INTEGER NOT NULL DEFAULT 1,            -- 1 = Active displayed asset, 0 = Inactive/replaced history
    sort_order INTEGER NOT NULL DEFAULT 0,
    caption TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Role Constraint: featured or inline
    CHECK (role IN ('featured', 'inline')),

    -- Active Flag Constraint: 1 active, 0 inactive/replaced
    CHECK (is_active IN (0, 1))
);

-- Indices for fast article-role resolution and asset lookups
CREATE INDEX IF NOT EXISTS idx_article_media_article_role_active 
ON article_media(article_id, role, is_active);

CREATE INDEX IF NOT EXISTS idx_article_media_asset 
ON article_media(asset_id);
