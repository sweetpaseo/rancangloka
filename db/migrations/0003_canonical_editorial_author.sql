-- Migration: 0003_canonical_editorial_author.sql
-- Purpose: Provision canonical Hermes v1 editorial author identity
-- Constraints: Idempotent, safe against duplicate slugs or names, AUTOINCREMENT ID

INSERT INTO authors (
  name,
  slug,
  bio,
  avatar,
  role,
  social_links
)
SELECT
  'RancangLoka Editorial Desk',
  'dewan-redaksi-spasial',
  'Tim editorial RancangLoka.',
  NULL,
  'Editorial Desk',
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM authors
  WHERE slug = 'dewan-redaksi-spasial'
     OR lower(trim(name)) = lower('RancangLoka Editorial Desk')
);
