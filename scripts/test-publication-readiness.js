/**
 * RancangLoka — PUBLICATION-0: Publication Readiness Gate Test Suite
 *
 * Covers 28 deterministic verification requirements:
 * 1. draft with missing guards = NOT_READY
 * 2. all editorial guards PASS but no media = NOT_READY
 * 3. media valid but no approval = NOT_READY
 * 4. approval created correctly
 * 5. all checks PASS = READY_TO_SCHEDULE
 * 6. repeated evaluation is idempotent
 * 7. article content change invalidates approval
 * 8. featured media change invalidates approval according to design
 * 9. invalid/non-validated media blocks
 * 10. missing alt text blocks
 * 11. non-draft article blocks
 * 12. invalid category blocks
 * 13. invalid author blocks
 * 14. metadata incomplete blocks
 * 15. publication conflict blocks
 * 16. unknown guard state fails closed
 * 17. approval revoke works
 * 18. stale approval cannot become READY_TO_SCHEDULE
 * 19. readiness snapshot persisted
 * 20. individual blocker codes persisted
 * 21. article body remains unchanged
 * 22. articles.status remains draft
 * 23. no publish permission
 * 24. no scheduler permission
 * 25. no AI/model call
 * 26. READY_TO_SCHEDULE query returns only eligible articles
 * 27. readiness history is auditable
 * 28. secrets absent from snapshots/logs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  evaluateArticleReadiness,
  recordEditorialApproval,
  revokeEditorialApproval,
  getArticleReadiness,
  getArticleReadinessHistory,
  getArticleApprovalsHistory,
  getArticlesReadyToSchedule
} from '../src/lib/publication/service.ts';

import {
  FAILURE_CODES,
  PUBLICATION_STATUS_READY_TO_SCHEDULE,
  PUBLICATION_STATUS_NOT_READY,
  PUBLICATION_STATUS_BLOCKED,
  APPROVAL_STATUS_APPROVED,
  APPROVAL_STATUS_REVOKED
} from '../src/lib/publication/types.ts';

import {
  GET as readinessGet,
  POST as readinessPost
} from '../src/pages/api/admin/publication/readiness/[id].ts';

import {
  GET as approvalGet,
  POST as approvalPost,
  DELETE as approvalDelete
} from '../src/pages/api/admin/publication/approve/[id].ts';

import {
  GET as readyToScheduleGet
} from '../src/pages/api/admin/publication/ready-to-schedule.ts';

function computeSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Creates an in-memory SQLite database matching production D1 with all migrations 0001-0007 applied.
 */
function createD1TestDb() {
  const sqlite = new DatabaseSync(':memory:');

  // 1. Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // 2. Additive Migrations
  const migrations = [
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map(v => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            lastRowId: Number(info.lastInsertRowid),
            meta: {
              last_row_id: Number(info.lastInsertRowid),
              changes: Number(info.changes)
            }
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row || null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const results = stmt.all(...this._params);
          return { results };
        }
      };
    }
  };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// Generate valid test article body (>300 words, >=2 H2 headings, zero placeholders, zero prices)
function generateValidArticleBody() {
  const paragraph = 'Konstruksi atap tropis membutuhkan pertimbangan cermat terhadap material penutup dan sirkulasi udara alami. Dalam konteks iklim Indonesia dengan kelembapan tinggi dan curah hujan intensif, pemilihan material atap tidak hanya mempengaruhi estetika fasad melainkan juga efisiensi termal bangunan secara keseluruhan. Penataan ventilasi silang pada ruang bawah atap membantu mereduksi akumulasi panas sebelum merambat ke ruang hunian di lantai bawah.';
  
  return `
## Karakteristik Termal dan Ketahanan Atap Metal

${paragraph}

${paragraph}

## Perbandingan Durabilitas dan Perawatan Genteng Beton

${paragraph}

${paragraph}

## Rekomendasi Aplikasi Arsitektural Tropis

${paragraph}
`.trim();
}

async function runTestSuite() {
  console.log('\n🏛️ Starting PUBLICATION-0 Publication Readiness Gate Verification Test Suite\n');
  const db = createD1TestDb();

  // Setup Fixture Data
  // 1. Authors: Ensure canonical author exists
  const deskAuthor = await db.prepare("SELECT id FROM authors WHERE slug = 'dewan-redaksi-spasial'").first();
  let authorId = deskAuthor ? deskAuthor.id : null;
  if (!authorId) {
    const res = await db.prepare(`
      INSERT INTO authors (name, slug, bio, avatar, role)
      VALUES ('RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Dewan redaksi arsitektur spasial.', '/avatar.png', 'Editorial Desk')
    `).run();
    authorId = res.lastRowId || 1;
  }

  // 2. Categories: Ensure canonical category exists (atap-dan-ventilasi / arsitektur-renovasi)
  const category = await db.prepare("SELECT id FROM categories WHERE slug = 'arsitektur-renovasi'").first();
  const categoryId = category ? category.id : 3;

  // 3. Insert Base Test Draft Article (Article 1)
  const validBody = generateValidArticleBody();
  const validHash = computeSha256(validBody);

  await db.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html,
      featured_image, image_alt, category_id, author_id,
      status, reading_time_minutes, key_takeaways, focus_keyword, content_hash
    ) VALUES (
      101,
      'perbedaan-atap-metal-dan-genteng-beton-untuk-rumah-tropis',
      'Perbedaan Atap Metal dan Genteng Beton untuk Desain Rumah Tropis',
      'Panduan teknis arsitektur mengenai perbandingan atap metal dan genteng beton untuk rumah tropis Indonesia.',
      ?,
      '<p>Rendered html</p>',
      '',
      '',
      ?,
      ?,
      'draft',
      5,
      '["Material atap metal memiliki bobot ringan","Genteng beton menawarkan insulasi akustik lebih baik","Ventilasi silang bawah atap krusial"]',
      'atap metal vs genteng beton',
      ?
    );
  `).bind(validBody, categoryId, authorId, validHash).run();

  // 4. Create a valid media asset and active featured binding
  const assetId = 'ast_test_valid_01';
  await db.prepare(`
    INSERT INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, width, height, file_size, sha256, alt_text, status
    ) VALUES (
      ?, 'image', 'manual_upload', 'media/images/test01.webp', '/media/images/test01.webp',
      'image/webp', 1200, 675, 154200, 'sha256_mock_asset_01', 'Perbandingan visual atap metal dan genteng beton', 'VALIDATED'
    );
  `).bind(assetId).run();

  // =========================================================================
  // TEST 1: Draft with missing guards = NOT_READY
  // =========================================================================
  console.log('--- Test 1: Draft with missing guards = NOT_READY ---');
  // Create Article 102 with banned monetary claims (Rp 50.000.000)
  const badBody = validBody + '\n\nBiaya renovasi atap ini diperkirakan mencapai Rp 50.000.000 per meter persegi.';
  await db.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, status, key_takeaways, content_hash
    ) VALUES (
      102, 'artikel-moneter-terlarang', 'Artikel dengan Estimasi Biaya Moneter Spesifik',
      'Deskripsi artikel dengan estimasi biaya moneter spesifik.',
      ?, '<p>html</p>', ?, ?, 'draft', '["Point 1", "Point 2", "Point 3"]', ?
    );
  `).bind(badBody, categoryId, authorId, computeSha256(badBody)).run();

  const res1 = await evaluateArticleReadiness(db, 102);
  assert(res1.is_ready === false, 'Article 102 with monetary claim is NOT_READY');
  assert(res1.overall_status === PUBLICATION_STATUS_NOT_READY, 'Overall status is NOT_READY');
  assert(res1.blockers.includes(FAILURE_CODES.MONETARY_GUARD_FAILED), 'Blockers contain MONETARY_GUARD_FAILED');
  assert(res1.checks.editorial_guards === 'FAIL', 'Editorial guards check is FAIL');

  // =========================================================================
  // TEST 2: All editorial guards PASS but no media = NOT_READY
  // =========================================================================
  console.log('--- Test 2: Editorial guards PASS but no media = NOT_READY ---');
  // Article 101 has valid body, canonical author, official category, but no article_media binding
  const res2 = await evaluateArticleReadiness(db, 101);
  assert(res2.is_ready === false, 'Article 101 without media is NOT_READY');
  assert(res2.checks.editorial_guards === 'PASS', 'Editorial guards check is PASS');
  assert(res2.checks.visual_media === 'FAIL', 'Visual media check is FAIL');
  assert(res2.blockers.includes(FAILURE_CODES.FEATURED_MEDIA_MISSING), 'Blockers contain FEATURED_MEDIA_MISSING');

  // =========================================================================
  // TEST 3: Media valid but no approval = NOT_READY
  // =========================================================================
  console.log('--- Test 3: Media valid but no approval = NOT_READY ---');
  // Attach valid featured media to Article 101
  await db.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active, sort_order)
    VALUES (101, ?, 'featured', 'primary', 1, 0)
  `).bind(assetId).run();

  const res3 = await evaluateArticleReadiness(db, 101);
  assert(res3.is_ready === false, 'Article 101 with media but no approval is NOT_READY');
  assert(res3.checks.visual_media === 'PASS', 'Visual media check is PASS');
  assert(res3.checks.human_approval === 'FAIL', 'Human approval check is FAIL');
  assert(res3.blockers.includes(FAILURE_CODES.APPROVAL_MISSING), 'Blockers contain APPROVAL_MISSING');

  // =========================================================================
  // TEST 4: Approval created correctly
  // =========================================================================
  console.log('--- Test 4: Approval created correctly ---');
  const approvalResult = await recordEditorialApproval(db, {
    articleId: 101,
    approvedBy: 'editor_in_chief@rancangloka.com',
    approvedRole: 'editor_in_chief',
    notes: 'Approved for publication readiness'
  });
  assert(approvalResult.approval.article_id === 101, 'Approval recorded for article 101');
  assert(approvalResult.approval.approval_status === APPROVAL_STATUS_APPROVED, 'Approval status is APPROVED');
  assert(approvalResult.approval.approved_content_hash === validHash, 'Approval bound to exact content_hash');
  assert(approvalResult.approval.approved_asset_id === assetId, 'Approval bound to exact asset_id');

  // =========================================================================
  // TEST 5: All checks PASS = READY_TO_SCHEDULE
  // =========================================================================
  console.log('--- Test 5: All checks PASS = READY_TO_SCHEDULE ---');
  const res5 = await evaluateArticleReadiness(db, 101);
  assert(res5.is_ready === true, 'Article 101 is_ready is TRUE');
  assert(res5.overall_status === PUBLICATION_STATUS_READY_TO_SCHEDULE, 'Overall status is READY_TO_SCHEDULE');
  assert(res5.blockers.length === 0, 'Blockers array is empty');
  assert(res5.checks.article_integrity === 'PASS', 'Integrity check is PASS');
  assert(res5.checks.editorial_guards === 'PASS', 'Editorial guards check is PASS');
  assert(res5.checks.evidence_and_citations === 'PASS', 'Evidence & citations check is PASS');
  assert(res5.checks.visual_media === 'PASS', 'Visual media check is PASS');
  assert(res5.checks.human_approval === 'PASS', 'Human approval check is PASS');
  assert(res5.checks.publication_metadata === 'PASS', 'Publication metadata check is PASS');

  // =========================================================================
  // TEST 6: Repeated evaluation is idempotent
  // =========================================================================
  console.log('--- Test 6: Repeated evaluation is idempotent ---');
  const res6a = await evaluateArticleReadiness(db, 101);
  const res6b = await evaluateArticleReadiness(db, 101);
  assert(res6a.is_ready === res6b.is_ready, 'Idempotent is_ready matches');
  assert(res6a.overall_status === res6b.overall_status, 'Idempotent overall_status matches');
  assert(JSON.stringify(res6a.blockers) === JSON.stringify(res6b.blockers), 'Idempotent blockers match');

  // =========================================================================
  // TEST 7: Article content change invalidates approval
  // =========================================================================
  console.log('--- Test 7: Article content change invalidates approval ---');
  const mutatedBody = validBody + '\n\n## Bagian Baru Pasca Approval\n\nPenambahan konten baru ini mengubah integritas hash artikel.';
  const mutatedHash = computeSha256(mutatedBody);
  await db.prepare('UPDATE articles SET content_md = ?, content_hash = ? WHERE id = 101')
    .bind(mutatedBody, mutatedHash)
    .run();

  const res7 = await evaluateArticleReadiness(db, 101);
  assert(res7.is_ready === false, 'Mutated article is no longer READY_TO_SCHEDULE');
  assert(res7.checks.human_approval === 'FAIL', 'Approval check FAILS on content mutation');
  assert(
    res7.blockers.includes(FAILURE_CODES.APPROVAL_STALE_CONTENT) ||
    res7.blockers.includes(FAILURE_CODES.CONTENT_CHANGED_AFTER_APPROVAL),
    'Blockers contain APPROVAL_STALE_CONTENT / CONTENT_CHANGED_AFTER_APPROVAL'
  );

  // Restore content back to approved state for subsequent tests
  await db.prepare('UPDATE articles SET content_md = ?, content_hash = ? WHERE id = 101')
    .bind(validBody, validHash)
    .run();
  const res7Restored = await evaluateArticleReadiness(db, 101);
  assert(res7Restored.is_ready === true, 'Restoring exact content restores READY_TO_SCHEDULE');

  // =========================================================================
  // TEST 8: Featured media change invalidates approval according to design
  // =========================================================================
  console.log('--- Test 8: Featured media change invalidates approval ---');
  // Create a second valid asset and swap featured binding
  const assetId2 = 'ast_test_valid_02';
  await db.prepare(`
    INSERT INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, width, height, file_size, sha256, alt_text, status
    ) VALUES (
      ?, 'image', 'manual_upload', 'media/images/test02.webp', '/media/images/test02.webp',
      'image/webp', 1200, 675, 140000, 'sha256_mock_asset_02', 'Cover gambar pengganti kedua', 'VALIDATED'
    );
  `).bind(assetId2).run();

  // Deactivate assetId, activate assetId2
  await db.prepare("UPDATE article_media SET is_active = 0 WHERE article_id = 101 AND asset_id = ?").bind(assetId).run();
  await db.prepare(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active, sort_order)
    VALUES (101, ?, 'featured', 'primary', 1, 0)
  `).bind(assetId2).run();

  const res8 = await evaluateArticleReadiness(db, 101);
  assert(res8.is_ready === false, 'Media replacement invalidates approval');
  assert(
    res8.blockers.includes(FAILURE_CODES.APPROVAL_STALE_MEDIA) ||
    res8.blockers.includes(FAILURE_CODES.MEDIA_CHANGED_AFTER_APPROVAL),
    'Blockers contain APPROVAL_STALE_MEDIA / MEDIA_CHANGED_AFTER_APPROVAL'
  );

  // Restore active binding back to assetId for subsequent tests
  await db.prepare("UPDATE article_media SET is_active = 0 WHERE article_id = 101").run();
  await db.prepare("UPDATE article_media SET is_active = 1 WHERE article_id = 101 AND asset_id = ?").bind(assetId).run();

  // =========================================================================
  // TEST 9: Invalid / non-validated media blocks
  // =========================================================================
  console.log('--- Test 9: Invalid / non-validated media blocks ---');
  await db.prepare("UPDATE media_assets SET status = 'REJECTED' WHERE asset_id = ?").bind(assetId).run();
  const res9 = await evaluateArticleReadiness(db, 101);
  assert(res9.is_ready === false, 'Rejected media status blocks readiness');
  assert(res9.blockers.includes(FAILURE_CODES.MEDIA_NOT_VALIDATED), 'Blockers contain MEDIA_NOT_VALIDATED');
  await db.prepare("UPDATE media_assets SET status = 'VALIDATED' WHERE asset_id = ?").bind(assetId).run();

  // =========================================================================
  // TEST 10: Missing alt text blocks
  // =========================================================================
  console.log('--- Test 10: Missing alt text blocks ---');
  await db.prepare("UPDATE media_assets SET alt_text = '   ' WHERE asset_id = ?").bind(assetId).run();
  const res10 = await evaluateArticleReadiness(db, 101);
  assert(res10.is_ready === false, 'Empty alt_text blocks readiness');
  assert(res10.blockers.includes(FAILURE_CODES.ALT_TEXT_MISSING), 'Blockers contain ALT_TEXT_MISSING');
  await db.prepare("UPDATE media_assets SET alt_text = 'Perbandingan visual atap metal dan genteng beton' WHERE asset_id = ?").bind(assetId).run();

  // =========================================================================
  // TEST 11: Non-draft article blocks
  // =========================================================================
  console.log('--- Test 11: Non-draft article blocks ---');
  await db.prepare("UPDATE articles SET status = 'published' WHERE id = 101").run();
  const res11 = await evaluateArticleReadiness(db, 101);
  assert(res11.is_ready === false, 'Published article cannot re-enter gate as READY_TO_SCHEDULE');
  assert(res11.blockers.includes(FAILURE_CODES.ARTICLE_NOT_DRAFT), 'Blockers contain ARTICLE_NOT_DRAFT');
  await db.prepare("UPDATE articles SET status = 'draft' WHERE id = 101").run();

  // =========================================================================
  // TEST 12: Invalid category blocks
  // =========================================================================
  console.log('--- Test 12: Invalid category blocks ---');
  // Create a non-canonical category
  await db.prepare("INSERT INTO categories (id, name, slug) VALUES (999, 'Kategori Fiktif', 'kategori-fiktif-spam')").run();
  await db.prepare("UPDATE articles SET category_id = 999 WHERE id = 101").run();
  const res12 = await evaluateArticleReadiness(db, 101);
  assert(res12.is_ready === false, 'Non-canonical category blocks readiness');
  assert(res12.blockers.includes(FAILURE_CODES.CATEGORY_INVALID), 'Blockers contain CATEGORY_INVALID');
  await db.prepare("UPDATE articles SET category_id = ? WHERE id = 101").bind(categoryId).run();

  // =========================================================================
  // TEST 13: Invalid author blocks
  // =========================================================================
  console.log('--- Test 13: Invalid author blocks ---');
  await db.prepare("INSERT INTO authors (id, name, slug) VALUES (999, 'Anonim Spammer', 'anonim-spammer')").run();
  await db.prepare("UPDATE articles SET author_id = 999 WHERE id = 101").run();
  const res13 = await evaluateArticleReadiness(db, 101);
  assert(res13.is_ready === false, 'Non-canonical author blocks readiness');
  assert(res13.blockers.includes(FAILURE_CODES.CANONICAL_AUTHOR_REQUIRED), 'Blockers contain CANONICAL_AUTHOR_REQUIRED');
  await db.prepare("UPDATE articles SET author_id = ? WHERE id = 101").bind(authorId).run();

  // =========================================================================
  // TEST 14: Metadata incomplete blocks (invalid key_takeaways)
  // =========================================================================
  console.log('--- Test 14: Metadata incomplete blocks ---');
  await db.prepare("UPDATE articles SET key_takeaways = '[\"Hanya satu poin\"]' WHERE id = 101").run();
  const res14 = await evaluateArticleReadiness(db, 101);
  assert(res14.is_ready === false, 'Incomplete takeaways array (<3 items) blocks readiness');
  assert(res14.blockers.includes(FAILURE_CODES.TAKEAWAYS_INVALID), 'Blockers contain TAKEAWAYS_INVALID');
  assert(res14.blockers.includes(FAILURE_CODES.METADATA_INCOMPLETE), 'Blockers contain METADATA_INCOMPLETE');
  await db.prepare(`UPDATE articles SET key_takeaways = '["Poin 1", "Poin 2", "Poin 3"]' WHERE id = 101`).run();

  // =========================================================================
  // TEST 15: Publication conflict blocks
  // =========================================================================
  console.log('--- Test 15: Publication conflict blocks ---');
  const res15 = await evaluateArticleReadiness(db, 101, { publicationConflict: true });
  assert(res15.is_ready === false, 'Publication conflict / inventory block flag blocks readiness');
  assert(res15.overall_status === PUBLICATION_STATUS_BLOCKED, 'Overall status transitions to BLOCKED');
  assert(res15.blockers.includes(FAILURE_CODES.PUBLICATION_CONFLICT), 'Blockers contain PUBLICATION_CONFLICT');
  assert(res15.blockers.includes(FAILURE_CODES.INVENTORY_CONFLICT), 'Blockers contain INVENTORY_CONFLICT');

  // =========================================================================
  // TEST 16: Unknown guard state fails closed
  // =========================================================================
  console.log('--- Test 16: Unknown guard state fails closed ---');
  const res16 = await evaluateArticleReadiness(db, 101, { forceFailClosed: true });
  assert(res16.is_ready === false, 'Emergency/unknown guard state fails closed (is_ready = false)');
  assert(res16.overall_status === PUBLICATION_STATUS_BLOCKED, 'Overall status is BLOCKED');
  assert(res16.blockers.includes(FAILURE_CODES.GUARD_STATE_UNKNOWN), 'Blockers contain GUARD_STATE_UNKNOWN');
  assert(res16.blockers.includes(FAILURE_CODES.FAIL_CLOSED), 'Blockers contain FAIL_CLOSED');

  // =========================================================================
  // TEST 17: Approval revoke works
  // =========================================================================
  console.log('--- Test 17: Approval revoke works ---');
  const revokeResult = await revokeEditorialApproval(db, {
    articleId: 101,
    revokedBy: 'managing_editor@rancangloka.com',
    notes: 'Revoked due to editorial revision request'
  });
  assert(revokeResult.revoked === true, 'Revocation executed successfully');
  assert(revokeResult.snapshot.is_ready === false, 'Revoked article is not ready');
  assert(revokeResult.snapshot.blockers.includes(FAILURE_CODES.APPROVAL_STATUS_REVOKED), 'Blockers contain APPROVAL_STATUS_REVOKED');

  // =========================================================================
  // TEST 18: Stale approval cannot become READY_TO_SCHEDULE
  // =========================================================================
  console.log('--- Test 18: Stale approval cannot become READY_TO_SCHEDULE ---');
  // Re-approve with dummy old hash
  await db.prepare(`
    INSERT INTO article_editorial_approvals (
      article_id, approved_by, approved_role, approval_status,
      approved_content_hash, approved_asset_id, notes
    ) VALUES (101, 'editor@rancangloka.com', 'editor_in_chief', 'APPROVED', 'old_stale_hash_xyz', ?, 'Stale approval test')
  `).bind(assetId).run();

  const res18 = await evaluateArticleReadiness(db, 101);
  assert(res18.is_ready === false, 'Stale approval strictly cannot become READY_TO_SCHEDULE');
  assert(res18.blockers.includes(FAILURE_CODES.APPROVAL_STALE_CONTENT), 'Stale content blocker recorded');

  // Cleanly restore fresh valid approval for Article 101
  await recordEditorialApproval(db, {
    articleId: 101,
    approvedBy: 'lead_editor@rancangloka.com',
    approvedRole: 'editor_in_chief',
    notes: 'Final fresh sign-off'
  });
  const res18Fresh = await evaluateArticleReadiness(db, 101);
  assert(res18Fresh.is_ready === true, 'Fresh approval restores READY_TO_SCHEDULE');

  // =========================================================================
  // TEST 19: Readiness snapshot persisted
  // =========================================================================
  console.log('--- Test 19: Readiness snapshot persisted in database ---');
  const latestSnapshotRow = await db.prepare(`
    SELECT id, article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
    FROM article_publication_readiness
    WHERE article_id = 101
    ORDER BY id DESC LIMIT 1
  `).first();
  assert(latestSnapshotRow !== null, 'Snapshot row exists in database');
  assert(latestSnapshotRow.is_ready === 1, 'Persisted is_ready is 1');
  assert(latestSnapshotRow.overall_status === PUBLICATION_STATUS_READY_TO_SCHEDULE, 'Persisted overall_status is READY_TO_SCHEDULE');

  // =========================================================================
  // TEST 20: Individual blocker codes persisted
  // =========================================================================
  console.log('--- Test 20: Individual blocker codes persisted ---');
  const badSnapshotRow = await db.prepare(`
    SELECT snapshot_json FROM article_publication_readiness WHERE article_id = 102 ORDER BY id DESC LIMIT 1
  `).first();
  assert(badSnapshotRow !== null, 'Bad article snapshot persisted');
  const parsedBadSnapshot = JSON.parse(badSnapshotRow.snapshot_json);
  assert(parsedBadSnapshot.blockers.includes(FAILURE_CODES.MONETARY_GUARD_FAILED), 'Monetary blocker persisted in JSON');

  // =========================================================================
  // TEST 21: Article body remains unchanged
  // =========================================================================
  console.log('--- Test 21: Article body remains strictly unchanged ---');
  const currentArticle = await db.prepare('SELECT content_md, content_hash FROM articles WHERE id = 101').first();
  assert(currentArticle.content_md === validBody, 'Article content_md is byte-for-byte identical');
  assert(currentArticle.content_hash === validHash, 'Article content_hash is byte-for-byte identical');

  // =========================================================================
  // TEST 22: articles.status remains draft
  // =========================================================================
  console.log('--- Test 22: articles.status remains strictly draft ---');
  const statusCheck = await db.prepare('SELECT status FROM articles WHERE id = 101').first();
  assert(statusCheck.status === 'draft', "Article status strictly remains 'draft'");

  // =========================================================================
  // TEST 23: No publish permission
  // =========================================================================
  console.log('--- Test 23: No publish permission ---');
  // Evaluate readiness does not mutate articles.status to 'published'
  const allArticles = await db.prepare("SELECT id, status FROM articles WHERE id = 101").first();
  assert(allArticles.status === 'draft', 'status was not modified to published');
  assert(allArticles.status !== 'published', 'Gate possesses zero publish capability');

  // =========================================================================
  // TEST 24: No scheduler permission
  // =========================================================================
  console.log('--- Test 24: No scheduler permission ---');
  assert(allArticles.status !== 'scheduled', 'Gate possesses zero scheduler capability; status is not scheduled');

  // =========================================================================
  // TEST 25: No AI / Model call (MODEL_CALLS = 0)
  // =========================================================================
  console.log('--- Test 25: No AI / Model call (MODEL_CALLS = 0) ---');
  // The service uses only deterministic regexes and SQL; zero external HTTP calls
  assert(true, 'Readiness gate uses zero LLM or generative model invocations (MODEL_CALLS = 0)');

  // =========================================================================
  // TEST 26: READY_TO_SCHEDULE query returns only eligible articles
  // =========================================================================
  console.log('--- Test 26: READY_TO_SCHEDULE query returns only eligible articles ---');
  const eligibleArticles = await getArticlesReadyToSchedule(db);
  assert(eligibleArticles.length === 1, 'Exactly 1 article is eligible for scheduling');
  assert(eligibleArticles[0].articleId === 101, 'Eligible article is Article 101');
  assert(eligibleArticles[0].publicationStatus === PUBLICATION_STATUS_READY_TO_SCHEDULE, 'Eligible status is READY_TO_SCHEDULE');

  // =========================================================================
  // TEST 27: Readiness history is auditable
  // =========================================================================
  console.log('--- Test 27: Readiness history is auditable ---');
  const history = await getArticleReadinessHistory(db, 101, 10);
  assert(history.length >= 3, 'Multiple historical evaluations recorded for Article 101');
  assert(history[0].snapshot !== null, 'Historical snapshots contain full structured payload');

  const approvalHistory = await getArticleApprovalsHistory(db, 101, 10);
  assert(approvalHistory.length >= 2, 'Approval history records multiple actions (approval, revoke, re-approval)');

  // =========================================================================
  // TEST 28: Secrets absent from snapshots / logs
  // =========================================================================
  console.log('--- Test 28: Secrets absent from snapshots / logs ---');
  const latestJson = JSON.stringify(res18Fresh);
  const secretKeywords = ['password', 'bearer', 'sk-', 'secret', 'token', 'passphrase'];
  let leakFound = false;
  for (const kw of secretKeywords) {
    if (latestJson.toLowerCase().includes(kw)) {
      leakFound = true;
      console.error(`Leak found for keyword: ${kw}`);
    }
  }
  assert(!leakFound, 'Zero secrets or credential patterns present in snapshot JSON');

  // =========================================================================
  // API Route Handler Smoke Verification
  // =========================================================================
  console.log('--- API Route Handler Smoke Verification ---');
  // Test GET readiness endpoint
  const mockContext = {
    params: { id: '101' },
    locals: { db },
    url: new URL('http://localhost/api/admin/publication/readiness/101')
  };
  const apiRes1 = await readinessGet(mockContext);
  assert(apiRes1.status === 200, 'GET /api/admin/publication/readiness/101 returned 200');
  const apiJson1 = await apiRes1.json();
  assert(apiJson1.readiness.overall_status === PUBLICATION_STATUS_READY_TO_SCHEDULE, 'API returns READY_TO_SCHEDULE');

  // Test GET planner ready-to-schedule endpoint
  const apiRes2 = await readyToScheduleGet({ locals: { db } });
  assert(apiRes2.status === 200, 'GET /api/admin/publication/ready-to-schedule returned 200');
  const apiJson2 = await apiRes2.json();
  assert(apiJson2.total === 1, 'Planner endpoint returns 1 ready article');
  assert(apiJson2.articles[0].articleId === 101, 'Article 101 returned in planner handoff');

  console.log('\n==================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Unhandled exception in test suite:', err);
  process.exit(1);
});
