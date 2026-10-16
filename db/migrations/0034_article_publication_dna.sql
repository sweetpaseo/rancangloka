-- ============================================================================
-- Migration: 0034_article_publication_dna.sql
-- Description: Add immutable Publication DNA signatures table for content provenance
-- Milestone: CONTENT_PROTECTION-1B-A
-- ============================================================================

CREATE TABLE IF NOT EXISTS article_dna_signatures (
  dna_id TEXT PRIMARY KEY,
  version_key TEXT NOT NULL UNIQUE,
  article_id INTEGER NOT NULL,
  publication_receipt_id TEXT NULL,
  publication_execution_id TEXT NULL,
  provenance_class TEXT NOT NULL,
  content_hash_contract TEXT NOT NULL,

  published_content_hash TEXT NOT NULL,
  approved_content_hash TEXT NULL,

  canonical_slug TEXT NOT NULL,
  canonical_url TEXT NOT NULL,

  approved_recorded_at DATETIME NULL,
  actual_published_at DATETIME NULL,
  historical_published_at DATETIME NULL,

  dna_version TEXT NOT NULL,
  normalization_version TEXT NOT NULL,
  shingle_version TEXT NOT NULL,
  minhash_version TEXT NOT NULL,

  normalized_text_hash TEXT NOT NULL,
  block_hashes_json TEXT NOT NULL,
  minhash_signature_json TEXT NOT NULL,
  structural_signature_json TEXT NOT NULL,

  featured_asset_id TEXT NULL,
  featured_asset_sha256 TEXT NULL,

  generator_version TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (article_id) REFERENCES articles(id),
  FOREIGN KEY (publication_receipt_id) REFERENCES publication_execution_receipts(receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_article_dna_article_id ON article_dna_signatures(article_id);
CREATE INDEX IF NOT EXISTS idx_article_dna_receipt_id ON article_dna_signatures(publication_receipt_id);
CREATE INDEX IF NOT EXISTS idx_article_dna_published_hash ON article_dna_signatures(published_content_hash);
CREATE INDEX IF NOT EXISTS idx_article_dna_normalized_hash ON article_dna_signatures(normalized_text_hash);
