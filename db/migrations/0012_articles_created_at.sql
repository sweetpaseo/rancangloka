-- Add immutable article creation timestamp for admin ordering.
-- Legacy rows remain NULL because their true creation time is not known.

ALTER TABLE articles ADD COLUMN created_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_articles_created_at_id
ON articles(created_at DESC, id DESC);
