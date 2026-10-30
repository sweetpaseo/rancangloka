/**
 * RancangLoka — Repair Frontmatter Leak in Local D1
 * Phase 4 Implementation
 *
 * Repairs local D1 article #9993 by:
 * 1. Stripping raw YAML frontmatter from content_md.
 * 2. Re-rendering content_html with canonical safe renderer.
 * 3. Recalculating content_hash via canonical SHA-256 algorithm.
 * 4. Updating visual manifest content_hash to maintain consistency.
 * 5. Strictly preserving status='draft', IDs, slugs, and canonical media bindings.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.resolve(
  rootDir,
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
);

console.log('======================================================================');
console.log('RANCANGLOKA — REPAIR BATCH 1 FRONTMATTER LEAK IN LOCAL D1');
console.log('Target Database:', dbPath);
console.log('======================================================================\n');

const db = new DatabaseSync(dbPath);

// Import canonical parsing and rendering modules
const { extractArticleBody, parseArticleMarkdown } = await import('../src/lib/article/parser.ts');
const { renderArticleMarkdownSafely } = await import('../src/lib/article/renderer.ts');
const { generateContentHash, calculateReadingTime } = await import('../src/lib/seo.ts');

async function repair() {
  const articleId = 9993;
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);

  if (!row) {
    console.error(`❌ Article #${articleId} not found in database`);
    process.exit(1);
  }

  console.log(`[Before Repair] Article #${row.id} (${row.slug})`);
  console.log(`  status:       ${row.status}`);
  console.log(`  md_len:       ${row.content_md?.length}`);
  console.log(`  html_len:     ${row.content_html?.length}`);
  console.log(`  content_hash: ${row.content_hash}`);
  console.log(`  featured_img: ${row.featured_image}`);

  // 1. Extract clean markdown body
  const cleanBody = extractArticleBody(row.content_md);
  console.log(`\nClean markdown body extracted (length: ${cleanBody.length})`);
  console.log(`Body preview (first 120 chars): ${JSON.stringify(cleanBody.slice(0, 120))}`);

  // 2. Render safe HTML without frontmatter
  const cleanHtml = await renderArticleMarkdownSafely(cleanBody);
  console.log(`Clean HTML rendered (length: ${cleanHtml.length})`);
  console.log(`HTML preview (first 120 chars): ${JSON.stringify(cleanHtml.slice(0, 120))}`);

  // 3. Compute canonical content hash
  const newContentHash = await generateContentHash(cleanBody);
  const newReadingTime = calculateReadingTime(cleanBody);
  console.log(`Canonical content hash: ${newContentHash}`);
  console.log(`Reading time:           ${newReadingTime} minutes`);

  // Verify that cleanHtml has zero frontmatter leakage
  const leakCheck = /<(?:h[1-6]|p|blockquote|div)[^>]*>\s*(?:&quot;|")?title:[\s\S]*?(?:slug:|focus_keyword:)[\s\S]*?<\/(?:h[1-6]|p|blockquote|div)>/i.test(cleanHtml);
  if (leakCheck) {
    console.error('❌ FATAL: cleanHtml still contains frontmatter leak!');
    process.exit(1);
  }

  // 4. Update the D1 database row
  db.prepare(`
    UPDATE articles
    SET content_md = ?,
        content_html = ?,
        content_hash = ?,
        reading_time_minutes = ?
    WHERE id = ?
  `).run(cleanBody, cleanHtml, newContentHash, newReadingTime, articleId);

  console.log('\n✅ Database row updated successfully!');

  // 5. Update visual manifest to maintain hash consistency
  const manifestPath = path.resolve(rootDir, 'scripts/content-bootstrap/manifests/job-02-visual-manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const oldManifestHash = manifest.content_hash;
    manifest.content_hash = newContentHash;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`Updated manifest ${manifestPath}:`);
    console.log(`  old: ${oldManifestHash}`);
    console.log(`  new: ${newContentHash}`);
  }

  // 6. Verification of the updated database state
  const updatedRow = db.prepare('SELECT id, slug, status, length(content_md) as md_len, length(content_html) as html_len, content_hash, featured_image FROM articles WHERE id = ?').get(articleId);
  console.log('\n[After Repair] Article record:');
  console.dir(updatedRow);

  // 7. Verify bindings
  const bindings = db.prepare('SELECT am.id, am.slot_key, am.role, am.asset_id, am.is_active FROM article_media am WHERE am.article_id = ?').all(articleId);
  console.log('\nCanonical media bindings preserved:');
  console.dir(bindings);

  // 8. Verify all Batch 1 statuses
  const batch1 = db.prepare('SELECT id, slug, status FROM articles WHERE id IN (9993, 9999, 10000)').all();
  console.log('\nBatch 1 articles statuses:');
  console.dir(batch1);
}

repair().catch((err) => {
  console.error('Fatal repair error:', err);
  process.exit(1);
});
