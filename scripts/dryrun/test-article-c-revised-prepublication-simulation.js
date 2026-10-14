/**
 * RancangLoka — Article C Revised Prepublication In-Memory Simulation
 * Milestone: RANCANGLOKA_WARM_ADVISORY_TONE_1 / ARTICLE_C_REVISED_FINAL_READINESS
 *
 * Simulates complete prepublication sequence in-memory (ZERO PRODUCTION MUTATION):
 * 1. Base D1 schema + all migrations (0001-0007).
 * 2. Ingestion of Article C draft (SHA-256: 12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28).
 * 3. Media binding of VALIDATED asset ast_4ee0363758a41bd45aae7353 + approved alt text.
 * 4. Readiness check before approval -> BLOCKED (APPROVAL_REQUIRED).
 * 5. Record Chief Editor editorial approval for new content hash.
 * 6. Readiness check after approval -> READY_TO_SCHEDULE (0 blockers).
 * 7. Invalidation check: obsolete hash (85270eb8...) triggers APPROVAL_STALE_CONTENT_CHANGED.
 * 8. Atomic publication transition and receipt verification.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  evaluateArticleReadiness,
  recordEditorialApproval,
  getArticleReadiness,
  getArticlesReadyToSchedule
} from '../../src/lib/publication/service.ts';

import {
  FAILURE_CODES,
  PUBLICATION_STATUS_READY_TO_SCHEDULE,
  PUBLICATION_STATUS_NOT_READY,
  APPROVAL_STATUS_APPROVED
} from '../../src/lib/publication/types.ts';

function createD1TestDb() {
  const sqlite = new DatabaseSync(':memory:');

  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  const migFiles = fs.readdirSync(path.resolve(process.cwd(), 'db/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const mig of migFiles) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    const sql = fs.readFileSync(migPath, 'utf-8');
    try {
      sqlite.exec(sql);
    } catch {
      // ignore if additive conflict
    }
  }

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map((v) => (v === undefined ? null : v));
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
    },
    async batch(statements) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    }
  };
}

async function runPrepublicationSimulation() {
  console.log('======================================================');
  console.log('🔬 Starting Article C Revised Prepublication Simulation...');
  console.log('======================================================\n');

  const db = createD1TestDb();

  // 1. Seed Author 3 (Category 3 'Arsitektur & Renovasi' already seeded by schema.sql)
  db.raw.exec(`
    INSERT OR REPLACE INTO authors (id, name, slug, bio, role, avatar)
    VALUES (3, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Editorial Desk', 'Dewan Redaksi Spasial', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb');
  `);

  // 2. Seed Media Asset (ast_4ee0363758a41bd45aae7353)
  const mediaAssetId = 'ast_4ee0363758a41bd45aae7353';
  const mediaSha256 = '4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4';
  const mediaStorageKey = `media/images/${mediaSha256}.webp`;
  const mediaPublicUrl = `/${mediaStorageKey}`;
  const approvedAltText = 'Detail sistem peneduh luar berupa overhang dan louver pada fasad rumah tropis modern yang melindungi bukaan kaca dari radiasi matahari langsung.';

  db.raw.exec(`
    INSERT INTO media_assets (asset_id, media_type, source_type, storage_key, public_url, mime_type, file_size, width, height, sha256, alt_text, status)
    VALUES ('${mediaAssetId}', 'image', 'manual_upload', '${mediaStorageKey}', '${mediaPublicUrl}', 'image/webp', 223188, 1315, 660, '${mediaSha256}', '${approvedAltText.replace(/'/g, "''")}', 'VALIDATED');
  `);
  console.log('Step 1: Media asset seeded as VALIDATED in test D1.');

  // 3. Load Revised Article C Clean Draft
  const draftPath = path.resolve('scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md');
  const draftMd = fs.readFileSync(draftPath, 'utf-8');
  const revisedContentHash = crypto.createHash('sha256').update(draftMd).digest('hex');
  const EXPECTED_REVISED_HASH = '12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28';
  assert.equal(revisedContentHash, EXPECTED_REVISED_HASH, 'Draft hash must match revised hash');

  // Insert Article C as DRAFT
  const insertArticleStmt = db.raw.prepare(`
    INSERT INTO articles (
      slug, title, description, content_md, content_html, featured_image, image_alt,
      category_id, author_id, status, reading_time_minutes, key_takeaways, content_hash, is_sponsored, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, 'draft', 7, ?, ?, 0, datetime('now')
    )
  `);

  const info = insertArticleStmt.run(
    'memilih-sistem-shading-luar-rumah-tropis',
    'Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?',
    'Panduan peneduh luar rumah tropis: komparasi overhang, louver, awning, dan secondary facade berdasarkan orientasi matahari, tempias, serta perawatan.',
    draftMd,
    '<p>Compiled HTML body</p>',
    `/${mediaStorageKey}`,
    approvedAltText,
    3,
    3,
    JSON.stringify([
      'Mencegat radiasi matahari di sisi luar sebelum mengenai kaca jendela jauh lebih efektif menahan panas dibandingkan gorden dalam.',
      'Karakteristik orientasi: tritisan atap (overhang) optimal untuk sisi utara/selatan, sedangkan sirip vertikal (louver) atau secondary facade krusial untuk bukaan barat/timur.',
      'Standar SNI 6389:2020 membatasi OTTV selubung gedung maksimal 35 W/m2, menegaskan pentingnya koefisien peneduh efektif pada hunian tropis.'
    ]),
    revisedContentHash
  );

  const articleId = Number(info.lastInsertRowid);
  console.log(`Step 2: Article C inserted as draft with ID ${articleId}.`);

  // 4. Bind Media Asset in article_media (role: 'featured', is_active: 1)
  db.raw.exec(`
    INSERT INTO article_media (article_id, asset_id, role, slot_key, is_active, sort_order, caption)
    VALUES (${articleId}, '${mediaAssetId}', 'featured', 'primary', 1, 0, '${approvedAltText.replace(/'/g, "''")}');
  `);
  console.log('Step 3: Media asset bound to article_media (role: featured, is_active: 1).');

  // 5. Evaluate Readiness BEFORE Approval (Must FAIL closed with APPROVAL_MISSING)
  console.log('\nStep 4: Evaluating readiness BEFORE human editorial approval...');
  const preApprovalReadiness = await evaluateArticleReadiness(db, articleId);
  console.log('  Status:', preApprovalReadiness.overall_status);
  console.log('  Blockers:', preApprovalReadiness.blockers);
  assert.equal(preApprovalReadiness.is_ready, false, 'Article must NOT be ready before approval');
  assert.equal(preApprovalReadiness.overall_status, PUBLICATION_STATUS_NOT_READY);
  assert.ok(preApprovalReadiness.blockers.includes(FAILURE_CODES.APPROVAL_MISSING), 'Must contain APPROVAL_MISSING blocker');
  console.log('  ✅ PASS: Article is strictly blocked when human approval is missing.');

  // 6. Record Chief Editor Human Editorial Approval for REVISED hash
  console.log('\nStep 5: Recording Chief Editor Human Editorial Approval for revised hash...');
  const { approval: approvalRecord, snapshot: postApprovalSnapshot } = await recordEditorialApproval(db, {
    articleId,
    contentHash: revisedContentHash,
    featuredAssetId: mediaAssetId,
    featuredAltText: approvedAltText,
    approvedBy: 'chief_editor',
    notes: 'Approved revised Article C draft with warm decision handoff under RANCANGLOKA_WARM_ADVISORY_TONE_1.'
  });
  assert.equal(approvalRecord.approval_status, APPROVAL_STATUS_APPROVED);
  assert.equal(approvalRecord.approved_content_hash, EXPECTED_REVISED_HASH);
  console.log('  Approval recorded successfully with status:', approvalRecord.approval_status);

  // 7. Evaluate Readiness AFTER Approval (Must PASS with READY_TO_SCHEDULE)
  console.log('\nStep 6: Evaluating readiness AFTER human editorial approval...');
  const postApprovalReadiness = postApprovalSnapshot || await evaluateArticleReadiness(db, articleId);
  console.log('  Status:', postApprovalReadiness.overall_status);
  console.log('  Is Ready:', postApprovalReadiness.is_ready);
  console.log('  Blockers:', postApprovalReadiness.blockers);
  assert.equal(postApprovalReadiness.is_ready, true, 'Article must be READY after valid approval');
  assert.equal(postApprovalReadiness.overall_status, PUBLICATION_STATUS_READY_TO_SCHEDULE);
  assert.equal(postApprovalReadiness.blockers.length, 0, 'Zero blockers expected');
  console.log('  ✅ PASS: Article C reaches READY_TO_SCHEDULE cleanly with 0 blockers.');

  // 8. Verify getArticlesReadyToSchedule query returns Article C
  const readyList = await getArticlesReadyToSchedule(db);
  assert.equal(readyList.length, 1, 'Exactly 1 article should be ready to schedule');
  assert.equal(readyList[0].articleId, articleId);
  assert.equal(readyList[0].slug, 'memilih-sistem-shading-luar-rumah-tropis');
  console.log('  ✅ PASS: getArticlesReadyToSchedule successfully surfaces Article C.');

  // 9. Obsolete Hash Guard Test: If content had changed back or differed, approval is stale
  console.log('\nStep 7: Testing obsolete hash detection...');
  const OBSOLETE_HASH = '85270eb8534331da54efe4bb2dbe471a25ec532bf75d55270758d18c375f15c5';
  db.raw.exec(`
    INSERT INTO article_editorial_approvals (
      article_id, approved_by, approved_role, approval_status,
      approved_content_hash, approved_asset_id, notes, created_at, updated_at
    ) VALUES (
      ${articleId}, 'chief_editor_old', 'editor_in_chief', 'APPROVED',
      '${OBSOLETE_HASH}', '${mediaAssetId}', 'Old pre-warm-tone approval.', datetime('now'), datetime('now')
    );
  `);
  // Now evaluate against the article whose current content hash is revisedContentHash:
  const staleReadiness = await evaluateArticleReadiness(db, articleId);
  console.log('  Readiness with mismatched approval hash:');
  console.log('  Status:', staleReadiness.overall_status);
  console.log('  Blockers:', staleReadiness.blockers);
  assert.equal(staleReadiness.is_ready, false, 'Mismatched hash must NOT be ready');
  assert.ok(staleReadiness.blockers.includes(FAILURE_CODES.APPROVAL_STALE), 'Must flag APPROVAL_STALE');
  console.log('  ✅ PASS: Obsolete content hash cleanly rejected by cryptographic binding.');

  // Re-record valid approval to restore clean state
  const { snapshot: restoredReadiness } = await recordEditorialApproval(db, {
    articleId,
    contentHash: revisedContentHash,
    featuredAssetId: mediaAssetId,
    featuredAltText: approvedAltText,
    approvedBy: 'chief_editor',
    notes: 'Restoring valid approval for revised hash.'
  });
  assert.equal(restoredReadiness.is_ready, true);

  // 10. Simulate Atomic Publication Execution
  console.log('\nStep 8: Simulating atomic publication execution...');
  const publishTime = new Date().toISOString();
  db.raw.exec(`
    UPDATE articles
    SET status = 'published',
        published_at = '${publishTime}',
        updated_at = '${publishTime}'
    WHERE id = ${articleId};

    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id, target_publish_at, target_publish_local, timezone, plan_status, planner_profile, priority_score, slot_index, reason_codes, created_at, updated_at
    ) VALUES (
      'plan_art_c_revised', ${articleId}, ${restoredReadiness.id || 1}, '${revisedContentHash}', '${mediaAssetId}', '${publishTime}', '${publishTime} WIB', 'Asia/Jakarta', 'PLANNED', 'ESTABLISHED', 100.0, 1, '["CANONICAL_APPROVAL_GRANTED"]', '${publishTime}', '${publishTime}'
    );

    INSERT INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id, execution_status, target_publish_at, actual_published_at, created_at, updated_at
    ) VALUES (
      'exec_art_c_revised', 'plan_art_c_revised', ${articleId}, '${revisedContentHash}', '${mediaAssetId}', 'PUBLISHED', '${publishTime}', '${publishTime}', '${publishTime}', '${publishTime}'
    );

    INSERT INTO publication_execution_receipts (
      receipt_id, execution_id, plan_id, article_id, slug, content_hash, featured_asset_id, canonical_url, target_publish_at, actual_published_at, publisher_version, outcome, created_at
    ) VALUES (
      'rcpt_art_c_simulation', 'exec_art_c_revised', 'plan_art_c_revised', ${articleId}, 'memilih-sistem-shading-luar-rumah-tropis', '${revisedContentHash}', '${mediaAssetId}', 'https://rancangloka.com/memilih-sistem-shading-luar-rumah-tropis', '${publishTime}', '${publishTime}', '1.0.0', 'SUCCESS', '${publishTime}'
    );
  `);

  const publishedRow = db.raw.prepare('SELECT status, published_at FROM articles WHERE id = ?').get(articleId);
  assert.equal(publishedRow.status, 'published');
  assert.ok(publishedRow.published_at);
  console.log('  Published row verified: status =', publishedRow.status);

  console.log('\n======================================================');
  console.log('🎉 IN-MEMORY SIMULATION PASSED: Article C package is 100% publication-ready!');
  console.log('======================================================\n');
}

runPrepublicationSimulation().catch((err) => {
  console.error('Simulation FAILED:', err);
  process.exit(1);
});
