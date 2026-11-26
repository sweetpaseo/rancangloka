-- Migration: 0038_lokabridge_ingest_receipts.sql
-- Milestone: LOKABRIDGE-V1 (Bidirectional Browser Editorial Bridge)

CREATE TABLE IF NOT EXISTS bridge_ingest_receipts (
  id TEXT PRIMARY KEY,                       -- e.g. 'rcpt_bridge_1795504000000'
  idempotency_key TEXT NOT NULL UNIQUE,      -- Unique client idempotency key
  article_id INTEGER NOT NULL,               -- Foreign key to articles.id
  article_slug TEXT NOT NULL,                -- Slug of drafted article
  article_title TEXT NOT NULL,               -- Title of drafted article
  focus_keyword TEXT,                        -- Primary focus keyword
  content_hash TEXT NOT NULL,                -- SHA-256 of canonical markdown
  source_platform TEXT NOT NULL,             -- 'chatgpt_plus' | 'gemini_advanced' | 'claude_pro'
  source_model TEXT,                         -- e.g. 'gpt-4o', 'gemini-1.5-pro'
  device_id TEXT,                            -- Media device ID from authentication
  dod_gate_a_score REAL,                     -- Gate A score from Definition of Done
  dod_gate_a_status TEXT NOT NULL,           -- 'PASS' | 'BLOCKED'
  preview_url TEXT,                          -- Generated signed reader preview URL
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bridge_receipts_idempotency ON bridge_ingest_receipts(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_bridge_receipts_article_id ON bridge_ingest_receipts(article_id);
CREATE INDEX IF NOT EXISTS idx_bridge_receipts_created_at ON bridge_ingest_receipts(created_at);
