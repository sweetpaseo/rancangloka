-- Migration: 0037_reference_url_intake.sql
-- Milestone: Reference URL Editorial Mode (URL Intake -> Multi-Angle Decomposition -> Orchestrator Queue)

CREATE TABLE IF NOT EXISTS reference_intake_batches (
  id TEXT PRIMARY KEY,                       -- e.g. 'batch_ref_1795430000000'
  source_url TEXT NOT NULL,                   -- External reference URL
  source_title TEXT,                         -- Title extracted from reference URL
  source_summary TEXT,                       -- Factual extraction summary
  source_provenance_hash TEXT NOT NULL,      -- SHA-256 of raw source content
  domain TEXT NOT NULL,                      -- e.g. 'kompas.com', 'archdaily.com'
  total_proposed_angles INTEGER NOT NULL,    -- Typically 5
  accepted_angles_count INTEGER NOT NULL,    -- 1 to 5 after de-duplication
  batch_status TEXT NOT NULL DEFAULT 'ANALYZED', -- 'ANALYZED' | 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reference_intake_angles (
  id TEXT PRIMARY KEY,                       -- e.g. 'angle_1795430000000_1'
  batch_id TEXT NOT NULL,                    -- FK to reference_intake_batches.id
  angle_index INTEGER NOT NULL,              -- 1 to 5
  proposed_topic TEXT NOT NULL,              -- Full topic title
  focus_keyword TEXT NOT NULL,               -- Target SEO focus keyword
  canonical_slug TEXT,                       -- Unique SEO slug
  search_intent TEXT NOT NULL,               -- Distinct search intent (e.g. 'Informational Comparison', 'DIY Troubleshooting')
  target_audience TEXT NOT NULL,             -- e.g. 'Pemilik rumah renovasi', 'Penghuni apartemen'
  differentiation_angle TEXT NOT NULL,       -- How this adds independent value and differs from source
  status TEXT NOT NULL DEFAULT 'PENDING',    -- 'PENDING' | 'ACCEPTED' | 'REJECTED_CANNIBALIZED' | 'MERGED'
  cannibalization_reason TEXT,               -- If rejected/merged, explain why
  staging_article_id INTEGER,                -- ID in staging D1 articles table once queued/drafted
  article_number INTEGER,                    -- Canonical article number (e.g. 10019)
  workflow_stage TEXT DEFAULT 'QUEUED',      -- Orchestrator stage: 'QUEUED' | 'IN_ORCHESTRATOR' | 'READY_FOR_OWNER_PUBLICATION_REVIEW' | 'STOPPED_AT_GATE'
  reader_preview_url TEXT,                   -- Staging reader preview link with signed token
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES reference_intake_batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ref_intake_batch_status ON reference_intake_batches(batch_status);
CREATE INDEX IF NOT EXISTS idx_ref_intake_angles_batch_id ON reference_intake_angles(batch_id);
CREATE INDEX IF NOT EXISTS idx_ref_intake_angles_status ON reference_intake_angles(status);
