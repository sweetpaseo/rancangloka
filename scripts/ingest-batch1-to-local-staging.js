/**
 * Ingest Batch 1 Articles into Local Staging D1 Database
 * MISSION: RANCANGLOKA_BATCH1_STAGING_AND_EDITORIAL_REVIEW_1
 *
 * STRICT SAFETY INVARIANTS:
 * 1. Zero Cloudflare remote API calls.
 * 2. Zero remote production D1 writes.
 * 3. All articles ingested strictly with status = 'draft'.
 * 4. Zero publication receipts created.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Safety guard
if (process.env.NODE_ENV === 'production' || process.env.CF_PAGES || process.env.DEPLOYMENT_TARGET === 'production') {
  console.error('[SAFETY_GUARD] Local staging ingest is strictly barred in production environments.');
  process.exit(1);
}

const D1_DB_PATH = path.resolve(rootDir, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite');

if (!fs.existsSync(D1_DB_PATH)) {
  console.error('Local D1 sqlite file not found at:', D1_DB_PATH);
  process.exit(1);
}

console.log('='.repeat(70));
console.log('INGESTING BATCH 1 ARTICLES TO LOCAL STAGING D1 DATABASE');
console.log(`Database: ${D1_DB_PATH}`);
console.log('='.repeat(70));

const db = new DatabaseSync(D1_DB_PATH);

// Dynamic imports of canonical article processing modules
const { parseArticleMarkdown } = await import('../src/lib/article/parser.ts');
const { validateArticle } = await import('../src/lib/article/validator.ts');
const { renderArticleMarkdownSafely } = await import('../src/lib/article/renderer.ts');
const { generateContentHash, calculateReadingTime } = await import('../src/lib/seo.ts');

const batchDir = path.join(__dirname, 'content-bootstrap', 'batch-1-import-ready');
const batchFiles = [
  {
    code: 'ARTICLE_A',
    file: 'article-01-dinding-rembes.md',
    categoryId: 8,
    categoryName: 'Sistem & Konstruksi Rumah',
    authorId: 2,
    authorName: 'Tim Riset Materialitas',
    jobId: 'JOB-02-MOISTURE-WALL'
  },
  {
    code: 'ARTICLE_B',
    file: 'article-02-menata-balkon.md',
    categoryId: 7,
    categoryName: 'Eksterior & Lanskap',
    authorId: 1,
    authorName: 'Dewan Redaksi Spasial',
    jobId: 'JOB-04-BALKON-COMPACT'
  },
  {
    code: 'ARTICLE_C',
    file: 'article-03-menata-denah.md',
    categoryId: 1,
    categoryName: 'Interior & Tata Ruang',
    authorId: 1,
    authorName: 'Dewan Redaksi Spasial',
    jobId: 'JOB-03-INTERIOR-SPATIAL'
  }
];

for (const item of batchFiles) {
  const filePath = path.join(batchDir, item.file);
  console.log(`\nProcessing ${item.code} (${item.file})...`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(filePath, 'utf8');

  // 1. Validation
  const validation = validateArticle(rawContent);
  if (!validation.isValid || !validation.data) {
    console.error(`❌ Validation failed:`, validation.errors);
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

  // Featured image resolution (strictly no unvetted random fallbacks)
  const featuredImage = frontmatter.featured_image ? frontmatter.featured_image.trim() : null;
  const imageAlt = featuredImage ? (frontmatter.image_alt?.trim() || title) : null;

  // 2. Check if slug exists in local D1
  const existing = db.prepare('SELECT id, status, slug FROM articles WHERE slug = ?').get(slug);

  let targetId;

  if (existing) {
    console.log(`  Updating existing row in local staging (ID: ${existing.id}, previous status: ${existing.status}) -> status: draft`);
    targetId = existing.id;
    db.prepare(`
      UPDATE articles SET
        title = ?,
        description = ?,
        content_md = ?,
        content_html = ?,
        featured_image = ?,
        image_alt = ?,
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
      featuredImage,
      imageAlt,
      item.categoryId,
      item.authorId,
      readingTime,
      focusKeyword,
      contentHash,
      keyTakeaways,
      nowIso,
      targetId
    );
  } else {
    // Determine next sequential ID
    const maxRow = db.prepare('SELECT MAX(id) as max_id FROM articles').get();
    targetId = (maxRow?.max_id || 0) + 1;
    console.log(`  Inserting new draft row into local staging (ID: ${targetId})`);

    db.prepare(`
      INSERT INTO articles (
        id, slug, title, description, content_md, content_html, featured_image, image_alt,
        category_id, author_id, status, reading_time_minutes, key_takeaways,
        focus_keyword, content_hash, is_featured, is_trending, is_sponsored,
        disable_internal_links, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, 0, 0, 0, 0, NULL, ?)
    `).run(
      targetId,
      slug,
      title,
      description,
      markdownBody,
      contentHtml,
      featuredImage,
      imageAlt,
      item.categoryId,
      item.authorId,
      readingTime,
      keyTakeaways,
      focusKeyword,
      contentHash,
      nowIso
    );
  }

  // 3. Upsert into article_editorial_approvals for the Admin Approvals Inbox
  try {
    const existingApproval = db.prepare('SELECT id FROM article_editorial_approvals WHERE article_id = ?').get(targetId);
    if (existingApproval) {
      db.prepare(`
        UPDATE article_editorial_approvals SET
          approval_status = 'PENDING',
          approved_by = NULL,
          approved_role = 'Chief Editor',
          approved_content_hash = ?,
          notes = ?,
          updated_at = ?
        WHERE article_id = ?
      `).run(contentHash, `Batch 1 Manuscript Ready for Owner Review (${item.jobId})`, nowIso, targetId);
    } else {
      db.prepare(`
        INSERT INTO article_editorial_approvals (
          article_id, approved_by, approved_role, approval_status,
          approved_content_hash, approved_asset_id, notes, created_at, updated_at
        ) VALUES (?, NULL, 'Chief Editor', 'PENDING', ?, NULL, ?, ?, ?)
      `).run(targetId, contentHash, `Batch 1 Manuscript Ready for Owner Review (${item.jobId})`, nowIso, nowIso);
    }
    console.log(`  ✓ Approval inbox entry created/updated (status: PENDING, actor: Chief Editor)`);
  } catch (err) {
    console.warn(`  ⚠ Could not write to article_editorial_approvals table:`, err.message);
  }

  // 4. Verification of stored record
  const verified = db.prepare('SELECT id, slug, status, title, reading_time_minutes FROM articles WHERE id = ?').get(targetId);
  if (verified.status !== 'draft') {
    console.error(`❌ INVARIANT VIOLATION: Stored status is ${verified.status}, expected 'draft'!`);
    process.exit(1);
  }

  console.log(`  ✓ SUCCESS: Stored in Local Staging D1`);
  console.log(`    - ID: ${verified.id}`);
  console.log(`    - Slug: /${verified.slug}`);
  console.log(`    - Status: ${verified.status} (Verified Draft Only)`);
  console.log(`    - Reading Time: ${verified.reading_time_minutes} min`);
  console.log(`    - Preview URL: /admin/preview/${verified.slug}`);
}

console.log('\n' + '='.repeat(70));
console.log('ALL 3 BATCH 1 ARTICLES SUCCESSFULLY INGESTED AS DRAFT INTO LOCAL STAGING D1');
console.log('='.repeat(70));
