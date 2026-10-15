-- ============================================================================
-- Migration: 0033_internal_link_engine.sql
-- Description: Minimal semantic internal-link engine table and explicit pillar metadata
-- Milestone: INTERNAL-LINK-ENGINE-1
-- ============================================================================

-- 1. Table: article_internal_links
CREATE TABLE IF NOT EXISTS article_internal_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  target_article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK(relationship_type IN (
    'PARENT_PILLAR',
    'CHILD_SUPPORTING',
    'RELATED_PROBLEM',
    'RELATED_MATERIAL',
    'RELATED_DECISION',
    'BACKGROUND_EXPLAINER',
    'NEXT_STEP',
    'RELATED_SYSTEM',
    'RELATED_FAILURE_MODE'
  )),
  reader_reason TEXT NOT NULL,
  placement_plane TEXT NOT NULL CHECK(placement_plane IN ('PLANE_A_DYNAMIC', 'PLANE_B_INLINE')),
  anchor_text TEXT,
  confidence_score REAL DEFAULT 1.0,
  status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('CANDIDATE', 'APPROVED', 'ACTIVE', 'REJECTED', 'STALE')),
  source_content_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by TEXT,
  UNIQUE(source_article_id, target_article_id, placement_plane)
);

-- 2. Indexes for source and target lookups
CREATE INDEX IF NOT EXISTS idx_internal_links_source ON article_internal_links(source_article_id, status);
CREATE INDEX IF NOT EXISTS idx_internal_links_target ON article_internal_links(target_article_id, status);
CREATE INDEX IF NOT EXISTS idx_internal_links_source_plane ON article_internal_links(source_article_id, placement_plane, status);

-- 3. Explicit pillar metadata columns on articles table
ALTER TABLE articles ADD COLUMN pillar_role TEXT DEFAULT 'STANDALONE';
ALTER TABLE articles ADD COLUMN parent_pillar_id INTEGER DEFAULT NULL;
