-- ============================================================================
-- Migration: 0004_add_article_flags.sql
-- Description: Align articles table with canonical schema and persistence contracts
-- Safety: Additive only with DEFAULT 0, preserves existing data, columns, and indexes.
-- ============================================================================

ALTER TABLE articles
ADD COLUMN is_sponsored INTEGER DEFAULT 0;

ALTER TABLE articles
ADD COLUMN disable_internal_links INTEGER DEFAULT 0;
