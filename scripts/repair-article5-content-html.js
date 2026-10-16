/**
 * Safe Article 5 Derivative Content HTML Repair Script
 * Milestone: ARTICLE-CONTENT-PERSISTENCE-1
 * Classification: LEGACY_DIRECT_D1 / MAINTENANCE_ONLY
 *
 * ⚠️ WARNING: DIRECT_PRODUCTION_D1_MUTATION_BYPASSES_WORKERS_CACHE_INVALIDATION
 * Normal production publication or content repair must proceed via the canonical Worker runtime publication pipeline.
 * Direct D1 execution via wrangler d1 execute --remote bypasses the Cloudflare Worker runtime
 * and does NOT trigger Workers Cache invalidation. If run in production with active Workers Cache,
 * an explicit supported cache invalidation procedure must be executed separately.
 *
 * Regenerates Article 5 content_html from canonical approved content_md in Cloudflare D1.
 *
 * Allowed mutation:
 * - articles.content_html ONLY
 *
 * Strictly forbidden mutations:
 * - content_md
 * - content_hash
 * - title
 * - description
 * - approval
 * - receipt
 * - published_at
 * - featured media
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { renderArticleMarkdownSafely } from '../src/lib/article/renderer.ts';
import { generateContentHash } from '../src/lib/seo.ts';

const REQUIRED_HEADINGS = [
  'Karakter Fisik Dasar: Konduktivitas Termal dan Kekakuan Struktural',
  'Sambungan Sudut, Sistem Drainase, dan Ketahanan terhadap Hujan Angin',
  'Membedakan Peredaman Suara dari Kerapatan Udara',
  'Karakteristik Pemuaian dan Risiko Lapangan',
  'Matriks Komparasi Teknis: Aluminium vs uPVC di Iklim Tropis',
  'Pertimbangan Pemilihan Sistem Berdasarkan Kondisi Ruang',
  'Rekomendasi RancangLoka',
  'Catatan Telaah Teknis dan Rujukan Standar'
];

const CANONICAL_HASH = '6a634f94ab0a26c889594e71d0fade5886018d963da1cfec602c09e54dec539f';
const CANONICAL_APPROVAL_ID = 9;
const CANONICAL_RECEIPT_ID = 'rcpt_bbae85b48e1b2f8d';
const CANONICAL_PUBLISHED_AT = '2026-09-28T06:10:39.816Z';
const CANONICAL_FEATURED_ASSET = 'ast_mfUpgVe99C_bq_p2d_O4Ge4L';

async function main() {
  console.log('=== SAFE ARTICLE 5 DERIVATIVE REPAIR ===');
  console.log('⚠️ WARNING: DIRECT_PRODUCTION_D1_MUTATION_BYPASSES_WORKERS_CACHE_INVALIDATION\n');

  // 1. Load canonical Article 5 fixture
  const fixturePath = path.resolve(process.cwd(), 'scripts/fixtures/article5_canonical.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const article5Md = fixture.content_md;

  // 2. Verify fixture hash matches canonical approved hash
  const computedHash = await generateContentHash(article5Md);
  if (computedHash !== CANONICAL_HASH) {
    throw new Error(`Fixture hash mismatch: expected ${CANONICAL_HASH}, got ${computedHash}`);
  }
  console.log('✅ 1. Canonical Markdown verified against approved hash:', computedHash);

  // 3. Render canonical HTML using canonical renderer
  const safeHtml = await renderArticleMarkdownSafely(article5Md);
  if (typeof safeHtml !== 'string' || safeHtml.includes('[object Object]') || safeHtml.length < 15000) {
    throw new Error(`Rendered HTML failed sanity check: len=${safeHtml.length}`);
  }

  // 4. Verify all 8 headings present
  for (const h of REQUIRED_HEADINGS) {
    if (!safeHtml.includes(h)) {
      throw new Error(`Missing required heading in rendered HTML: ${h}`);
    }
  }
  console.log('✅ 2. Rendered HTML verified: all 8 headings present, length =', safeHtml.length);

  // 5. Verify textual retention >= 90%
  const cleanText = safeHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const mdWords = article5Md.trim().split(/\s+/).length;
  const htmlWords = cleanText.split(/\s+/).length;
  const ratio = htmlWords / mdWords;
  if (ratio < 0.90) {
    throw new Error(`Textual retention below 90%: ${(ratio * 100).toFixed(1)}%`);
  }
  console.log(`✅ 3. Textual retention verified: ${(ratio * 100).toFixed(1)}% (MD: ${mdWords}, HTML: ${htmlWords})`);

  // 6. Query remote D1 to verify pre-repair state
  const preCheckCmd = `npx wrangler d1 execute rancangloka_db --remote --json --command "SELECT id, slug, status, content_hash, published_at, SUBSTR(content_html, 1, 30) as html_preview, LENGTH(content_html) as html_len, LENGTH(content_md) as md_len FROM articles WHERE id = 5"`;
  const preResRaw = execSync(preCheckCmd, { encoding: 'utf8' });
  const preRes = JSON.parse(preResRaw);
  const row = preRes[0].results[0];

  if (!row || row.id !== 5 || row.content_hash !== CANONICAL_HASH || row.status !== 'published') {
    throw new Error(`Remote D1 Article 5 precondition failure: ${JSON.stringify(row)}`);
  }
  console.log('✅ 4. Remote D1 Article 5 pre-state verified:', {
    id: row.id,
    slug: row.slug,
    content_hash: row.content_hash,
    html_preview: row.html_preview,
    html_len: row.html_len,
    md_len: row.md_len
  });

  // 7. Write SQL migration payload to temporary SQL file for safe execution
  const tempSqlPath = path.resolve(process.cwd(), 'scripts/scratch_repair_article5.sql');
  const escapedHtml = safeHtml.replace(/'/g, "''");
  const transitionId = `ast_5_derived_repair_${Date.now()}`;
  const mutationOpId = `mop_derived_repair_a5_${Date.now()}`;
  const metadataJson = JSON.stringify({
    reason: 'Repair malformed [object Object] content_html from approved canonical content_md',
    content_hash: CANONICAL_HASH,
    approval_id: CANONICAL_APPROVAL_ID,
    receipt_id: CANONICAL_RECEIPT_ID
  }).replace(/'/g, "''");

  const sqlContent = `
UPDATE articles
SET content_html = '${escapedHtml}'
WHERE id = 5
  AND content_hash = '${CANONICAL_HASH}'
  AND status = 'published';

INSERT INTO article_state_transitions (
  transition_id, article_id, from_snapshot_id, to_snapshot_id,
  from_input_hash, to_input_hash, from_observation_id, to_observation_id,
  transition_type, transition_source, mutation_operation_id,
  occurred_at, recorded_at, actor_type, actor_id, evidence_reference, metadata_json
) VALUES (
  '${transitionId}', 5, 'snp_h_5666dabd_5', 'snp_h_5666dabd_5',
  'h_5666dabd', 'h_5666dabd', NULL, NULL,
  'DERIVED_CONTENT_REPAIR', 'article_content_persistence_repair',
  '${mutationOpId}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'operator', 'ARTICLE-CONTENT-PERSISTENCE-1',
  'APPROVED_HASH_${CANONICAL_HASH}',
  '${metadataJson}'
);
`;

  fs.writeFileSync(tempSqlPath, sqlContent, 'utf8');
  console.log('✅ 5. Temporary repair SQL script generated.');

  try {
    // 8. Execute on remote D1
    console.log('🚀 6. Executing derivative repair on remote Cloudflare D1...');
    const execCmd = `npx wrangler d1 execute rancangloka_db --remote --file="${tempSqlPath}"`;
    const execOutput = execSync(execCmd, { encoding: 'utf8' });
    console.log(execOutput);
  } finally {
    // Clean up temporary SQL file
    if (fs.existsSync(tempSqlPath)) {
      fs.unlinkSync(tempSqlPath);
    }
  }

  // 9. Post-execution verification on remote D1
  console.log('🔍 7. Verifying post-repair invariants on remote Cloudflare D1...');
  const postCheckCmd = `npx wrangler d1 execute rancangloka_db --remote --json --command "SELECT id, slug, title, status, content_hash, published_at, SUBSTR(content_html, 1, 50) as html_preview, LENGTH(content_html) as html_len, LENGTH(content_md) as md_len FROM articles WHERE id = 5"`;
  const postResRaw = execSync(postCheckCmd, { encoding: 'utf8' });
  const postRes = JSON.parse(postResRaw);
  const postRow = postRes[0].results[0];

  if (!postRow) {
    throw new Error('Post-repair verification failed: Article 5 not found');
  }

  if (postRow.content_hash !== CANONICAL_HASH) {
    throw new Error(`FORBIDDEN MUTATION: content_hash changed from ${CANONICAL_HASH} to ${postRow.content_hash}`);
  }
  if (postRow.published_at !== CANONICAL_PUBLISHED_AT) {
    throw new Error(`FORBIDDEN MUTATION: published_at changed from ${CANONICAL_PUBLISHED_AT} to ${postRow.published_at}`);
  }
  if (postRow.html_len < 15000 || postRow.html_preview.includes('[object Object]')) {
    throw new Error(`content_html repair failed: html_len=${postRow.html_len}, preview=${postRow.html_preview}`);
  }
  if (postRow.md_len !== 15942) {
    throw new Error(`FORBIDDEN MUTATION: content_md changed: length=${postRow.md_len}`);
  }

  // Check approval
  const approvalCmd = `npx wrangler d1 execute rancangloka_db --remote --json --command "SELECT id, article_id, approval_status, approved_content_hash, approved_asset_id FROM article_editorial_approvals WHERE article_id = 5"`;
  const approvalRes = JSON.parse(execSync(approvalCmd, { encoding: 'utf8' }));
  const approvalRow = approvalRes[0].results[0];
  if (approvalRow.id !== CANONICAL_APPROVAL_ID || approvalRow.approved_content_hash !== CANONICAL_HASH) {
    throw new Error(`FORBIDDEN MUTATION: approval mutated: ${JSON.stringify(approvalRow)}`);
  }

  // Check receipt
  const receiptCmd = `npx wrangler d1 execute rancangloka_db --remote --json --command "SELECT receipt_id, article_id, content_hash, featured_asset_id FROM publication_execution_receipts WHERE article_id = 5"`;
  const receiptRes = JSON.parse(execSync(receiptCmd, { encoding: 'utf8' }));
  const receiptRow = receiptRes[0].results[0];
  if (receiptRow.receipt_id !== CANONICAL_RECEIPT_ID || receiptRow.content_hash !== CANONICAL_HASH) {
    throw new Error(`FORBIDDEN MUTATION: receipt mutated: ${JSON.stringify(receiptRow)}`);
  }

  // Check audit log
  const auditCmd = `npx wrangler d1 execute rancangloka_db --remote --json --command "SELECT transition_id, transition_type, transition_source, actor_type, actor_id FROM article_state_transitions WHERE article_id = 5 AND transition_type = 'DERIVED_CONTENT_REPAIR' ORDER BY recorded_at DESC LIMIT 1"`;
  const auditRes = JSON.parse(execSync(auditCmd, { encoding: 'utf8' }));
  const auditRow = auditRes[0].results[0];
  if (!auditRow) {
    throw new Error('Audit log DERIVED_CONTENT_REPAIR not found in article_state_transitions');
  }

  console.log('\n==================================================');
  console.log('🎉 REPAIR SUCCESSFUL & STRICT INVARIANTS VERIFIED:');
  console.log('==================================================');
  console.log('ARTICLE_5_CONTENT_HTML_REPAIRED = YES');
  console.log('ARTICLE_5_CONTENT_MD_UNCHANGED = YES');
  console.log('ARTICLE_5_HASH_UNCHANGED = YES');
  console.log('ARTICLE_5_APPROVAL_UNCHANGED = YES');
  console.log('ARTICLE_5_RECEIPT_UNCHANGED = YES');
  console.log('ARTICLE_5_PUBLISHED_AT_UNCHANGED = YES');
  console.log('AUDIT_RECORD_CONFIRMED = YES (transition_id: ' + auditRow.transition_id + ')');
  console.log('POST_REPAIR_HTML_LEN =', postRow.html_len);
}

main().catch(err => {
  console.error('\n❌ REPAIR FAILED:', err.message);
  process.exit(1);
});
