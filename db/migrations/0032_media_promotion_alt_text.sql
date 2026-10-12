-- ============================================================================
-- Migration: 0032_media_promotion_alt_text.sql
-- Description: Add alt_text to media_promotion_approvals for dual-control accessibility binding
-- ============================================================================

ALTER TABLE media_promotion_approvals ADD COLUMN alt_text TEXT;
