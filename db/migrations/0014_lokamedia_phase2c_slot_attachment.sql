-- ============================================================================
-- Migration: 0014_lokamedia_phase2c_slot_attachment.sql
-- Description: LokaMedia Phase 2C - Active Slot Attachment Guard
-- Safety: additive local foundation. Does not mutate production unless applied.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_media_one_active_slot
ON article_media(article_id, slot_key)
WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_article_media_article_slot_active
ON article_media(article_id, slot_key, is_active);
