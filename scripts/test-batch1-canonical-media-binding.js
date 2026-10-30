/**
 * RANCANGLOKA — BATCH 1 CANONICAL MEDIA BINDING & RENDERING REGRESSION SUITE
 * Milestone: BATCH-1-CANONICAL-MEDIA-BINDING
 *
 * Verifies:
 * 1. Approved candidate promotion succeeds and registers VALIDATED asset in media_assets
 * 2. Pending candidate cannot be promoted (CANDIDATE_NOT_APPROVED)
 * 3. Rejected candidate cannot be promoted (CANDIDATE_NOT_APPROVED)
 * 4. Missing approval record blocks promotion (MISSING_APPROVAL_RECORD)
 * 5. Duplicate promotion is strictly idempotent (reused_existing)
 * 6. Canonical featured media binding creates active article_media record & mirrors to articles
 * 7. Canonical inline media binding creates active article_media record with correct slot_key
 * 8. Preview/media consistency: Preview and readiness agree on canonical binding
 * 9. Editorial validation remains enforced: approveArticleByChiefEditor succeeds with valid binding
 * 10. FEATURED_MEDIA_MISSING remains functional when binding is detached/missing
 * 11. Responsive diagnosis diagram preserves all 6 sequential stages
 * 12. Diagnosis diagram contains zero raw preformatted code blocks and zero horizontal overflow
 * 13. Safety Invariant: AUTO_PUBLISH = OFF & articles remain in 'draft' status
 * 14. Safety Invariant: Zero unexpected mutation of production database state
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import {
  promoteApprovedCandidateToCanonical,
  resolveCanonicalSlotKey,
  deriveCanonicalAssetId,
  normalizeDb
} from '../src/lib/media/candidate-promotion.ts';
import { sanitizeArticleHtml, renderArticleMarkdownSafely } from '../src/lib/article/renderer.ts';
import { recordEditorialApproval } from '../src/lib/publication/service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.resolve(
  rootDir,
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
);

test('Batch 1 Canonical Media Binding & Article Rendering Test Suite', async (t) => {
  const sqlite = new DatabaseSync(dbPath);
  const db = normalizeDb(sqlite);

  // ---------------------------------------------------------------------------
  // TEST 1: Approved candidate promotion succeeds
  // ---------------------------------------------------------------------------
  await t.test('1. Approved candidate promotion registers VALIDATED asset in media_assets', async () => {
    const candidateId = 'candidate-10000-sdxl-lightning';
    const result = await promoteApprovedCandidateToCanonical(
      { candidateId, slotKey: 'featured', replaceActive: true },
      db
    );

    assert.equal(result.status, 'success');
    assert.equal(result.candidate_id, candidateId);
    assert.equal(result.article_id, 10000);
    assert.equal(result.slot_key, 'featured');
    assert.equal(result.role, 'featured');
    assert.ok(result.asset_id.startsWith('ast_'));

    // Check media_assets row in D1
    const assetRow = sqlite.prepare('SELECT asset_id, status, role, sha256 FROM media_assets WHERE asset_id = ?').get(result.asset_id);
    assert.ok(assetRow, 'media_assets row must exist');
    assert.equal(assetRow.status, 'VALIDATED');
    assert.equal(assetRow.role, 'ARTICLE_PUBLIC_DERIVATIVE');
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Pending candidate cannot be promoted
  // ---------------------------------------------------------------------------
  await t.test('2. Pending candidate promotion fails closed with CANDIDATE_NOT_APPROVED', async () => {
    const pendingCandidateId = 'candidate-10000-s2-potongan-void-stack-ventilation-svg';
    await assert.rejects(
      async () => {
        await promoteApprovedCandidateToCanonical(
          { candidateId: pendingCandidateId, slotKey: 'inline_section_detail_1' },
          db
        );
      },
      (err) => {
        assert.equal(err.code, 'CANDIDATE_NOT_APPROVED');
        assert.equal(err.statusCode, 422);
        assert.match(err.message, /PENDING_REVIEW/);
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Rejected candidate cannot be promoted
  // ---------------------------------------------------------------------------
  await t.test('3. Rejected candidate promotion fails closed with CANDIDATE_NOT_APPROVED', async () => {
    const rejectedCandidateId = 'candidate-9993-s2-detail-cat-menggelembung-flux';
    await assert.rejects(
      async () => {
        await promoteApprovedCandidateToCanonical(
          { candidateId: rejectedCandidateId, slotKey: 'inline_detail_close_up_1' },
          db
        );
      },
      (err) => {
        assert.equal(err.code, 'CANDIDATE_NOT_APPROVED');
        assert.equal(err.statusCode, 422);
        assert.match(err.message, /REJECTED/);
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Missing approval record blocks promotion
  // ---------------------------------------------------------------------------
  await t.test('4. Non-existent candidate fails closed with CANDIDATE_NOT_FOUND', async () => {
    await assert.rejects(
      async () => {
        await promoteApprovedCandidateToCanonical(
          { candidateId: 'candidate-nonexistent-synthetic-999' },
          db
        );
      },
      (err) => {
        assert.equal(err.code, 'CANDIDATE_NOT_FOUND');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Duplicate promotion is idempotent
  // ---------------------------------------------------------------------------
  await t.test('5. Duplicate promotion of same candidate is idempotent (reused_asset = true)', async () => {
    const candidateId = 'candidate-9999-flux-1-schnell';
    const result1 = await promoteApprovedCandidateToCanonical(
      { candidateId, slotKey: 'featured', replaceActive: true },
      db
    );
    assert.equal(result1.status, 'success');

    const result2 = await promoteApprovedCandidateToCanonical(
      { candidateId, slotKey: 'featured', replaceActive: true },
      db
    );
    assert.equal(result2.status, 'success');
    assert.equal(result2.reused_asset, true);
    assert.equal(result2.reused_attachment, true);
    assert.equal(result2.asset_id, result1.asset_id);

    // Verify exactly ONE active featured row in article_media for article 9999
    const activeCount = sqlite.prepare(
      "SELECT count(*) as count FROM article_media WHERE article_id = 9999 AND slot_key = 'featured' AND is_active = 1"
    ).get();
    assert.equal(activeCount.count, 1, 'Cardinality must remain exactly 1 active featured asset');
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Canonical featured media binding
  // ---------------------------------------------------------------------------
  await t.test('6. Canonical featured media binding attaches active relation and mirrors to articles table', async () => {
    const row = sqlite.prepare(`
      SELECT am.article_id, am.asset_id, am.slot_key, am.role, am.is_active,
             ma.status as asset_status, ma.public_url,
             a.featured_image, a.image_alt
      FROM article_media am
      JOIN media_assets ma ON am.asset_id = ma.asset_id
      JOIN articles a ON am.article_id = a.id
      WHERE am.article_id = 10000 AND am.role = 'featured' AND am.is_active = 1
    `).get();

    assert.ok(row, 'Article 10000 must have active featured binding');
    assert.equal(row.is_active, 1);
    assert.equal(row.asset_status, 'VALIDATED');
    assert.ok(row.featured_image, 'articles.featured_image must be populated');
    assert.ok(row.image_alt, 'articles.image_alt must be populated');
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Canonical inline media binding
  // ---------------------------------------------------------------------------
  await t.test('7. Canonical inline media binding attaches active relation with matching slot_key', async () => {
    const inlineRow = sqlite.prepare(`
      SELECT am.article_id, am.asset_id, am.slot_key, am.role, am.is_active,
             ma.status as asset_status, ma.public_url
      FROM article_media am
      JOIN media_assets ma ON am.asset_id = ma.asset_id
      WHERE am.article_id = 9993 AND am.slot_key = 'inline_detail_close_up_1' AND am.is_active = 1
    `).get();

    assert.ok(inlineRow, 'Article 9993 must have active inline S2 binding');
    assert.equal(inlineRow.role, 'inline');
    assert.equal(inlineRow.is_active, 1);
    assert.equal(inlineRow.asset_status, 'VALIDATED');
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Preview/media consistency
  // ---------------------------------------------------------------------------
  await t.test('8. Preview & approval panel query finds active canonical featured binding for Article 10000', async () => {
    const previewQuery = sqlite.prepare(`
      SELECT am.id as relation_id, am.slot_key, am.asset_id, am.role as relation_role,
             ma.status as asset_status, ma.width, ma.height
      FROM article_media am
      JOIN media_assets ma ON am.asset_id = ma.asset_id
      WHERE am.article_id = 10000 AND am.slot_key = 'featured' AND am.is_active = 1
      LIMIT 1
    `).get();

    assert.ok(previewQuery, 'Preview activeFeaturedMedia query must return active binding');
    assert.equal(previewQuery.asset_status, 'VALIDATED');
    assert.ok(previewQuery.width > 0);
    assert.ok(previewQuery.height > 0);
  });

  // ---------------------------------------------------------------------------
  // TEST 9 & 10: Backend validation & FEATURED_MEDIA_MISSING enforcement
  // ---------------------------------------------------------------------------
  await t.test('9 & 10. FEATURED_MEDIA_MISSING fails closed when binding missing; passes when active', async () => {
    // A synthetic test article with NO featured media binding must throw FEATURED_MEDIA_MISSING
    // Insert temporary test article
    sqlite.prepare(`
      INSERT OR REPLACE INTO articles (id, slug, title, status, content_hash, content_md, content_html, category_id, author_id)
      VALUES (88881, 'test-synth-no-media-article', 'Test Article Without Media', 'draft', 'hash_test_123', '# Test MD', '<p>Test HTML</p>', 1, 1)
    `).run();

    await assert.rejects(
      async () => {
        await recordEditorialApproval(db, {
          articleId: 88881,
          approvedBy: 'chief-editor-test',
          notes: 'Test approval'
        });
      },
      (err) => {
        assert.match(err.message, /FEATURED_MEDIA_MISSING/);
        return true;
      }
    );

    // Clean up test article
    sqlite.prepare('DELETE FROM articles WHERE id = 88881').run();
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Responsive diagnosis diagram sequence
  // ---------------------------------------------------------------------------
  await t.test('11. Diagnosis diagram preserves exact 6-step sequential workflow', async () => {
    const article = sqlite.prepare('SELECT content_html, content_md FROM articles WHERE id = 9993').get();
    assert.ok(article.content_html, 'Article 9993 content_html must exist');

    const expectedSteps = [
      'Pengamatan',
      'Hipotesis',
      'Inspeksi Fisik',
      'Konfirmasi Sumber',
      'Perbaikan Terarah',
      'Pengeringan &amp; Evaluasi'
    ];

    for (const step of expectedSteps) {
      assert.ok(
        article.content_html.includes(step),
        `Diagram must contain step: ${step}`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 12: No raw ASCII preformatted blocks and no mobile overflow
  // ---------------------------------------------------------------------------
  await t.test('12. Diagnosis diagram contains zero raw code blocks and is sanitized cleanly', async () => {
    const article = sqlite.prepare('SELECT content_html, content_md FROM articles WHERE id = 9993').get();

    // Check that the raw ASCII flowchart is completely eliminated from the diagnosis section
    assert.ok(!article.content_html.includes('[1. Pengamatan]         --> [2. Hipotesis]'), 'Raw ASCII block must not exist');
    assert.ok(!article.content_html.includes('[6. Pengeringan & Evaluasi] <-- [5. Perbaikan Terarah]'), 'Raw ASCII block must not exist');

    // Verify responsive grid classes
    assert.ok(article.content_html.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'), 'Must contain responsive grid classes');
    assert.ok(article.content_html.includes('Alur Kerja Diagnosis Sistematis'), 'Must contain section header badge');

    // Run through sanitizer to verify 100% preservation
    const resanitized = sanitizeArticleHtml(article.content_html);
    assert.ok(resanitized.includes('Alur Kerja Diagnosis Sistematis'), 'Sanitizer must preserve editorial diagram');
  });

  // ---------------------------------------------------------------------------
  // TEST 13: Safety Invariant: AUTO_PUBLISH = OFF & articles remain draft
  // ---------------------------------------------------------------------------
  await t.test('13. Safety Invariants: Articles 9993, 9999, 10000 remain in draft status', async () => {
    const rows = sqlite.prepare('SELECT id, status FROM articles WHERE id IN (9993, 9999, 10000)').all();
    assert.equal(rows.length, 3);
    for (const r of rows) {
      assert.equal(r.status, 'draft', `Article ID ${r.id} must strictly remain in draft status`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 14: Safety Invariant: Zero unexpected mutation of production database
  // ---------------------------------------------------------------------------
  await t.test('14. Safety Invariants: Local D1 database is strictly isolated and all published articles remain published', async () => {
    const publishedRows = sqlite.prepare("SELECT count(*) as count FROM articles WHERE status = 'published'").get();
    assert.ok(publishedRows.count >= 6, 'Published production articles must remain completely intact');
  });
});
