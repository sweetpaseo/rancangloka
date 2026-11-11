import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const D1_DB_PATH = path.resolve(rootDir, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite');

if (!fs.existsSync(D1_DB_PATH)) {
  console.error('Local D1 sqlite file not found at:', D1_DB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(D1_DB_PATH);

// Canonical pipeline imports
const { validateArticle } = await import('../src/lib/article/validator.ts');
const { renderArticleMarkdownSafely } = await import('../src/lib/article/renderer.ts');
const { generateContentHash, calculateReadingTime } = await import('../src/lib/seo.ts');

const filePath = path.join(__dirname, 'content-bootstrap', 'trials', 'article-plafon-kamar-mandi-berjamur-hitam.md');
const rawContent = fs.readFileSync(filePath, 'utf8');

const validation = validateArticle(rawContent);
if (!validation.isValid || !validation.data) {
  console.error('❌ Validation failed:', validation.errors);
  process.exit(1);
}

const { frontmatter, markdownBody } = validation.data;
const title = frontmatter.title.trim();
const slug = frontmatter.slug.trim();
const description = frontmatter.description.trim();
const focusKeyword = frontmatter.focus_keyword.trim();
const keyTakeaways = JSON.stringify(frontmatter.key_takeaways);
const contentHash = await generateContentHash(markdownBody);
const readingTime = calculateReadingTime(markdownBody);
const contentHtml = await renderArticleMarkdownSafely(markdownBody);
const nowIso = new Date().toISOString();

const categoryId = 8; // Sistem & Konstruksi Rumah
const authorId = 2; // Tim Riset Materialitas

const existing = db.prepare('SELECT id, status, slug FROM articles WHERE slug = ?').get(slug);

let targetId;
if (existing) {
  targetId = existing.id;
  console.log(`Updating existing article (ID: ${targetId}) to DRAFT...`);
  db.prepare(`
    UPDATE articles SET
      title = ?,
      description = ?,
      content_md = ?,
      content_html = ?,
      category_id = ?,
      author_id = ?,
      status = 'draft',
      reading_time_minutes = ?,
      focus_keyword = ?,
      content_hash = ?,
      key_takeaways = ?,
      is_featured = 0,
      is_trending = 0,
      is_sponsored = 0,
      disable_internal_links = 0,
      published_at = NULL,
      updated_at = ?
    WHERE id = ?
  `).run(
    title,
    description,
    markdownBody,
    contentHtml,
    categoryId,
    authorId,
    readingTime,
    focusKeyword,
    contentHash,
    keyTakeaways,
    nowIso,
    targetId
  );
} else {
  const maxRow = db.prepare('SELECT MAX(id) as max_id FROM articles').get();
  targetId = (maxRow?.max_id || 0) + 1;
  console.log(`Inserting new article into local D1 as DRAFT (ID: ${targetId})...`);
  db.prepare(`
    INSERT INTO articles (
      id, title, slug, description, content_md, content_html,
      featured_image, image_alt, category_id, author_id, status,
      reading_time_minutes, focus_keyword, content_hash, key_takeaways,
      is_featured, is_trending, is_sponsored, disable_internal_links,
      published_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      NULL, NULL, ?, ?, 'draft',
      ?, ?, ?, ?,
      0, 0, 0, 0,
      NULL, ?
    )
  `).run(
    targetId,
    title,
    slug,
    description,
    markdownBody,
    contentHtml,
    categoryId,
    authorId,
    readingTime,
    focusKeyword,
    contentHash,
    keyTakeaways,
    nowIso
  );
}

const saved = db.prepare('SELECT id, title, slug, status, category_id, reading_time_minutes FROM articles WHERE id = ?').get(targetId);
console.log('✅ Article successfully saved to DRAFT:');
console.log(saved);
