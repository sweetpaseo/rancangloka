-- ============================================================================
-- Migration: 0002_article_ingest_receipts.sql
-- Description: Machine-to-machine ingestion receipts for Hermes integration
-- Safety: Internal table, strictly preserves existing tables, columns, and foreign keys.
-- ============================================================================

CREATE TABLE IF NOT EXISTS article_ingest_receipts (
    job_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_article_id TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    article_content_hash TEXT NOT NULL,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    contract_version INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(source, source_article_id),
    UNIQUE(content_sha256),
    UNIQUE(article_content_hash)
);

CREATE INDEX IF NOT EXISTS idx_article_ingest_receipts_article_id 
ON article_ingest_receipts(article_id);

CREATE INDEX IF NOT EXISTS idx_article_ingest_receipts_source_article 
ON article_ingest_receipts(source, source_article_id);
