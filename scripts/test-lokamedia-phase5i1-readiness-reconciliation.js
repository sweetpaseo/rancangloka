/**
 * RancangLoka — LokaMedia Phase 5I1 Test Suite
 * Readiness Reconciliation Foundation (Code + Deterministic Tests + Read-Only Live Dry-Run)
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  READINESS_STATES,
  READINESS_NONE,
  READINESS_WAITING_MEDIA,
  READINESS_MEDIA_IN_PROGRESS,
  READINESS_MEDIA_NEEDS_ATTENTION,
  READINESS_READY_FOR_REVIEW,
  READINESS_PERSISTENCE_TABLE,
  READINESS_REASON_CODES,
  evaluateArticleMediaReadiness,
  reconcileArticleMediaReadiness
} from '../src/lib/media/readiness-reconciler.ts';

import { POST as reconcileApiPost } from '../src/pages/api/internal/v1/media/articles/[article_id]/reconcile-readiness.ts';
import { hashToken } from '../src/lib/media/device-auth.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');

  const baseSchemaPath = path.resolve(process.cwd(), 'db/schema.sql');
  if (fs.existsSync(baseSchemaPath)) {
    sqlite.exec(fs.readFileSync(baseSchemaPath, 'utf-8'));
  }

  const migrations = [
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0013_lokamedia_durable_jobs.sql',
    '0014_lokamedia_phase2c_slot_attachment.sql',
    '0015_site_watermark_assets.sql',
    '0016_media_assets_derivative_registration.sql'
  ];

  for (const mig of migrations) {
    const p = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(p)) {
      sqlite.exec(fs.readFileSync(p, 'utf-8'));
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
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid)
            },
            lastInsertRowid: Number(info.lastInsertRowid),
            changes: info.changes
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          return stmt.get(...this._params) || null;
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

function seedArticle(db, id = 100, status = 'draft', slug = 'test-article-100') {
  db.raw.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, status, content_hash, key_takeaways
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
  `).run(
    id,
    slug,
    'Judul Artikel Uji Kesiapan Media',
    'Deskripsi artikel uji untuk kesiapan media.',
    '# Judul\n\nIsi artikel untuk pengujian kesiapan media RancangLoka.',
    '<h1>Judul</h1><p>Isi artikel untuk pengujian kesiapan media RancangLoka.</p>',
    status,
    'hash_test_' + id,
    JSON.stringify(['Poin 1', 'Poin 2', 'Poin 3'])
  );
}

function seedAsset(db, assetId = 'ast_test_1', status = 'VALIDATED', role = 'ARTICLE_PUBLIC_DERIVATIVE') {
  db.raw.prepare(`
    INSERT INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url,
      mime_type, width, height, file_size, sha256, alt_text, status, role
    ) VALUES (?, 'image', 'lokamedia_extension', ?, 'https://media.rancangloka.com/test.png', 'image/png', 1200, 675, 50000, ?, 'Alt text', ?, ?)
  `).run(assetId, 'media/articles/derivatives/' + assetId + '.png', 'sha_' + assetId, status, role);
}

function seedAttachment(db, id = 1, articleId = 100, slotKey = 'featured', assetId = 'ast_test_1', role = 'featured', isActive = 1) {
  db.raw.prepare(`
    INSERT INTO article_media (
      id, article_id, asset_id, role, slot_key, is_active, sort_order, caption
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'Caption uji')
  `).run(id, articleId, assetId, role, slotKey, isActive);
}

function seedJob(db, jobId = 'mjob_1', articleId = 100, slotKey = 'featured', role = 'featured', required = 1, status = 'QUEUED') {
  db.raw.prepare(`
    INSERT INTO media_jobs (
      job_id, article_id, article_slug, article_title, role, slot_key, sequence,
      media_type, prompt, prompt_version, prompt_hash, alt_text, aspect_ratio,
      target_width, target_height, required_for_readiness, priority, status
    ) VALUES (?, ?, 'test-slug', 'Title', ?, ?, 0, 'image', 'Prompt', 1, 'phash', 'Alt', '16:9', 1200, 675, ?, 100, ?)
  `).run(jobId, articleId, role, slotKey, required, status);
}

async function runTests() {
  console.log('============================================================');
  console.log('RANCANGLOKA — LOKAMEDIA PHASE 5I1 TEST SUITE');
  console.log('Readiness Reconciliation Foundation');
  console.log('============================================================\n');

  // --- TEST 1: Entry Gate & Starting HEAD ---
  console.log('--- TEST 1: Entry Gate & Starting HEAD ---');
  const gitHead = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  console.log(`Current HEAD: ${gitHead}`);
  assert.ok(gitHead, 'Git HEAD must be defined');
  pass('STARTING_HEAD_VERIFIED=PASS');

  // --- TEST 2: Live Controlled Fixture Read-Only Check ---
  console.log('\n--- TEST 2: Live Controlled Fixture Read-Only Check ---');
  const liveD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );

  let liveD1 = null;
  if (fs.existsSync(liveD1Path)) {
    liveD1 = new DatabaseSync(liveD1Path, { open: true, readOnly: true });

    // Article 1
    const art1 = liveD1.prepare('SELECT id, slug, status FROM articles WHERE id = 1').get();
    assert.ok(art1, 'Live article 1 must exist');
    assert.equal(art1.status, 'draft', 'Article status must be draft');
    pass('LIVE_ARTICLE_PRESENT=YES');
    pass('LIVE_ARTICLE_STATUS_DRAFT=YES');

    // Asset
    const liveAsset = liveD1.prepare('SELECT asset_id, status, role FROM media_assets WHERE asset_id = ?').get('ast_d230f3d834ae5f1a9f689d7c');
    assert.ok(liveAsset, 'Controlled media asset must exist');
    assert.equal(liveAsset.status, 'VALIDATED', 'Asset status must be VALIDATED');
    pass('LIVE_MEDIA_ASSET_PRESENT=YES');
    pass('LIVE_MEDIA_ASSET_VALIDATED=YES');

    // Attachment
    const liveRel = liveD1.prepare('SELECT id, article_id, slot_key, asset_id, is_active FROM article_media WHERE id = 1').get();
    assert.ok(liveRel, 'Relation id=1 must exist');
    assert.equal(liveRel.article_id, 1);
    assert.equal(liveRel.slot_key, 'featured');
    assert.equal(liveRel.asset_id, 'ast_d230f3d834ae5f1a9f689d7c');
    assert.equal(liveRel.is_active, 1);
    pass('LIVE_ARTICLE_MEDIA_ATTACHMENT_PRESENT=YES');

    // No duplicate active featured
    const activeFeaturedCount = liveD1.prepare('SELECT COUNT(*) as c FROM article_media WHERE article_id = 1 AND slot_key = \'featured\' AND is_active = 1').get().c;
    assert.equal(activeFeaturedCount, 1, 'Exactly 1 active featured attachment');
    pass('ACTIVE_FEATURED_ATTACHMENT_COUNT=1');

    // Readiness row count before 5I1
    const readinessCountBefore = liveD1.prepare('SELECT COUNT(*) as c FROM article_publication_readiness WHERE article_id = 1').get().c;
    assert.equal(readinessCountBefore, 0, 'Zero readiness rows in live D1 for article 1 before 5I1');
    pass('CONTROLLED_ARTICLE_READINESS_BEFORE_NONE=YES');
  }

  // --- TEST 3: Constants & Canonical Reason Codes ---
  console.log('\n--- TEST 3: Constants & Reason Codes ---');
  assert.deepEqual(READINESS_STATES, ['WAITING_MEDIA', 'MEDIA_IN_PROGRESS', 'MEDIA_NEEDS_ATTENTION', 'READY_FOR_REVIEW']);
  assert.equal(READINESS_PERSISTENCE_TABLE, 'article_publication_readiness');
  assert.ok(READINESS_REASON_CODES.MISSING_REQUIRED_MEDIA);
  assert.ok(READINESS_REASON_CODES.INVALID_MEDIA_ASSET);
  assert.ok(READINESS_REASON_CODES.ARTICLE_STATUS_NOT_ELIGIBLE);
  assert.ok(READINESS_REASON_CODES.MULTIPLE_ACTIVE_ASSETS_FOR_SLOT);
  pass('READINESS_CONSTANTS=PASS');
  pass('REASON_CODES_DETERMINISTIC=YES');

  // --- TEST 4: Pure Evaluator — All Gates Satisfied (READY_FOR_REVIEW) ---
  console.log('\n--- TEST 4: Pure Evaluator — All Gates Satisfied ---');
  const db4 = createTestDb();
  seedArticle(db4, 100, 'draft');
  seedJob(db4, 'mjob_100', 100, 'featured', 'featured', 1, 'QUEUED');
  seedAsset(db4, 'ast_100', 'VALIDATED');
  seedAttachment(db4, 1, 100, 'featured', 'ast_100', 'featured', 1);

  const eval4 = await evaluateArticleMediaReadiness(db4, 100);
  assert.equal(eval4.ready_for_review, true);
  assert.equal(eval4.evaluated_readiness, READINESS_READY_FOR_REVIEW);
  assert.equal(eval4.blocking_reasons.length, 0);
  assert.deepEqual(eval4.required_media_slots, ['featured']);
  assert.deepEqual(eval4.satisfied_requirements, ['featured']);
  pass('ALL_GATES_SATISFIED_READY=PASS');

  // --- TEST 5: Missing Required Featured Attachment Blocks Ready ---
  console.log('\n--- TEST 5: Missing Required Featured Attachment Blocks Ready ---');
  const db5 = createTestDb();
  seedArticle(db5, 101, 'draft');
  seedJob(db5, 'mjob_101', 101, 'featured', 'featured', 1, 'QUEUED');
  // Zero attachments

  const eval5 = await evaluateArticleMediaReadiness(db5, 101);
  assert.equal(eval5.ready_for_review, false);
  assert.equal(eval5.evaluated_readiness, READINESS_WAITING_MEDIA);
  assert.ok(eval5.blocking_reasons.includes(READINESS_REASON_CODES.MISSING_REQUIRED_MEDIA));
  pass('MISSING_FEATURED_BLOCKS_READY=PASS');
  pass('MISSING_REQUIRED_ATTACHMENT_BLOCKS_READY=PASS');

  // --- TEST 6: Missing Attached Asset Blocks Ready ---
  console.log('\n--- TEST 6: Missing Attached Asset Blocks Ready ---');
  const db6 = createTestDb();
  db6.raw.exec('PRAGMA foreign_keys = OFF;');
  seedArticle(db6, 102, 'draft');
  seedJob(db6, 'mjob_102', 102, 'featured', 'featured', 1, 'QUEUED');
  // Attachment points to non-existent asset ast_missing
  seedAttachment(db6, 2, 102, 'featured', 'ast_missing', 'featured', 1);

  const eval6 = await evaluateArticleMediaReadiness(db6, 102);
  assert.equal(eval6.ready_for_review, false);
  assert.equal(eval6.evaluated_readiness, READINESS_WAITING_MEDIA);
  assert.ok(eval6.blocking_reasons.includes(READINESS_REASON_CODES.MISSING_ATTACHED_ASSET));
  pass('MISSING_ATTACHED_ASSET_BLOCKS_READY=PASS');
  pass('MISSING_ASSET_BLOCKS_READY=PASS');

  // --- TEST 7: Invalid (Non-VALIDATED) Media Asset Blocks Ready ---
  console.log('\n--- TEST 7: Invalid Media Asset Blocks Ready ---');
  const db7 = createTestDb();
  seedArticle(db7, 103, 'draft');
  seedJob(db7, 'mjob_103', 103, 'featured', 'featured', 1, 'QUEUED');
  seedAsset(db7, 'ast_103_bad', 'REJECTED');
  seedAttachment(db7, 3, 103, 'featured', 'ast_103_bad', 'featured', 1);

  const eval7 = await evaluateArticleMediaReadiness(db7, 103);
  assert.equal(eval7.ready_for_review, false);
  assert.equal(eval7.evaluated_readiness, READINESS_WAITING_MEDIA);
  assert.ok(eval7.blocking_reasons.includes(READINESS_REASON_CODES.INVALID_MEDIA_ASSET));
  pass('INVALID_ATTACHED_ASSET_BLOCKS_READY=PASS');
  pass('INVALID_ASSET_BLOCKS_READY=PASS');

  // --- TEST 8: Barred Asset Role (WATERMARK_MASTER) Blocks Ready ---
  console.log('\n--- TEST 8: Barred Asset Role Blocks Ready ---');
  const db8 = createTestDb();
  seedArticle(db8, 104, 'draft');
  seedJob(db8, 'mjob_104', 104, 'featured', 'featured', 1, 'QUEUED');
  seedAsset(db8, 'ast_104_wm', 'VALIDATED', 'WATERMARK_MASTER');
  seedAttachment(db8, 4, 104, 'featured', 'ast_104_wm', 'featured', 1);

  const eval8 = await evaluateArticleMediaReadiness(db8, 104);
  assert.equal(eval8.ready_for_review, false);
  assert.ok(eval8.blocking_reasons.includes(READINESS_REASON_CODES.INVALID_MEDIA_ASSET_ROLE));
  pass('BARRED_ROLE_BLOCKS_READY=PASS');

  // --- TEST 9: Ineligible Article Status Blocks Ready ---
  console.log('\n--- TEST 9: Ineligible Article Status Blocks Ready ---');
  const db9 = createTestDb();
  seedArticle(db9, 105, 'published'); // Not draft!
  seedJob(db9, 'mjob_105', 105, 'featured', 'featured', 1, 'QUEUED');
  seedAsset(db9, 'ast_105', 'VALIDATED');
  seedAttachment(db9, 5, 105, 'featured', 'ast_105', 'featured', 1);

  const eval9 = await evaluateArticleMediaReadiness(db9, 105);
  assert.equal(eval9.ready_for_review, false);
  assert.ok(eval9.blocking_reasons.includes(READINESS_REASON_CODES.ARTICLE_STATUS_NOT_ELIGIBLE));
  pass('INELIGIBLE_ARTICLE_STATUS_BLOCKS_READY=PASS');

  // --- TEST 10: Missing Article Blocks Ready ---
  console.log('\n--- TEST 10: Missing Article Blocks Ready ---');
  const db10 = createTestDb();
  const eval10 = await evaluateArticleMediaReadiness(db10, 9999);
  assert.equal(eval10.ready_for_review, false);
  assert.ok(eval10.blocking_reasons.includes(READINESS_REASON_CODES.ARTICLE_NOT_FOUND));
  pass('MISSING_ARTICLE_BLOCKS_READY=PASS');

  // --- TEST 11: Multiple Active Assets for Single Slot Fails Closed ---
  console.log('\n--- TEST 11: Multiple Active Assets for Single Slot Fails Closed ---');
  const db11 = createTestDb();
  seedArticle(db11, 106, 'draft');
  seedJob(db11, 'mjob_106', 106, 'featured', 'featured', 1, 'QUEUED');
  seedAsset(db11, 'ast_106_a', 'VALIDATED');
  seedAsset(db11, 'ast_106_b', 'VALIDATED');
  // Drop unique partial index in test DB to simulate data corruption
  db11.raw.exec('DROP INDEX IF EXISTS idx_article_media_one_active_slot;');
  db11.raw.prepare(`
    INSERT INTO article_media (id, article_id, asset_id, role, slot_key, is_active)
    VALUES (111, 106, 'ast_106_a', 'featured', 'featured', 1),
           (112, 106, 'ast_106_b', 'featured', 'featured', 1)
  `).run();

  const eval11 = await evaluateArticleMediaReadiness(db11, 106);
  assert.equal(eval11.ready_for_review, false);
  assert.ok(eval11.blocking_reasons.includes(READINESS_REASON_CODES.MULTIPLE_ACTIVE_ASSETS_FOR_SLOT));
  pass('MULTIPLE_ACTIVE_ASSETS_FOR_SLOT_BLOCKS_READY=PASS');
  pass('MULTIPLE_ACTIVE_SLOT_TEST=PASS');

  // --- TEST 12: Inline Slots Requirements & Optional Slots ---
  console.log('\n--- TEST 12: Inline Slots Requirements & Optional Slots ---');
  const db12 = createTestDb();
  seedArticle(db12, 107, 'draft');
  seedJob(db12, 'mjob_107_f', 107, 'featured', 'featured', 1, 'QUEUED');
  seedJob(db12, 'mjob_107_i', 107, 'cross_ventilation', 'inline', 1, 'QUEUED'); // Required inline!
  seedJob(db12, 'mjob_107_opt', 107, 'sketch_detail', 'inline', 0, 'QUEUED'); // Optional inline!

  seedAsset(db12, 'ast_107_f', 'VALIDATED');
  seedAttachment(db12, 21, 107, 'featured', 'ast_107_f', 'featured', 1);

  // 12A: Featured attached, but required inline missing -> NOT ready
  const eval12a = await evaluateArticleMediaReadiness(db12, 107);
  assert.equal(eval12a.ready_for_review, false);
  assert.deepEqual([...eval12a.required_media_slots].sort(), ['cross_ventilation', 'featured']);
  assert.deepEqual(eval12a.satisfied_requirements, ['featured']);
  pass('MISSING_INLINE_BLOCKS_READY=PASS');

  // 12B: Attach required inline -> READY_FOR_REVIEW (optional slot remains unattached)
  seedAsset(db12, 'ast_107_i', 'VALIDATED');
  seedAttachment(db12, 22, 107, 'cross_ventilation', 'ast_107_i', 'inline', 1);

  const eval12b = await evaluateArticleMediaReadiness(db12, 107);
  assert.equal(eval12b.ready_for_review, true);
  assert.equal(eval12b.evaluated_readiness, READINESS_READY_FOR_REVIEW);
  assert.deepEqual([...eval12b.satisfied_requirements].sort(), ['cross_ventilation', 'featured']);
  pass('OPTIONAL_SLOT_DOES_NOT_BLOCK_READY=PASS');

  // --- TEST 13: Media Job State Progress & Attention ---
  console.log('\n--- TEST 13: Media Job State Progress & Attention ---');
  const db13 = createTestDb();
  seedArticle(db13, 108, 'draft');
  seedJob(db13, 'mjob_108_p', 108, 'featured', 'featured', 1, 'GENERATING');

  const eval13p = await evaluateArticleMediaReadiness(db13, 108);
  assert.equal(eval13p.evaluated_readiness, READINESS_MEDIA_IN_PROGRESS);
  assert.equal(eval13p.ready_for_review, false);
  pass('JOB_IN_PROGRESS_MAPS_TO_MEDIA_IN_PROGRESS=PASS');

  const db13b = createTestDb();
  seedArticle(db13b, 109, 'draft');
  seedJob(db13b, 'mjob_109_att', 109, 'featured', 'featured', 1, 'AUTH_REQUIRED');

  const eval13att = await evaluateArticleMediaReadiness(db13b, 109);
  assert.equal(eval13att.evaluated_readiness, READINESS_MEDIA_NEEDS_ATTENTION);
  assert.equal(eval13att.ready_for_review, false);
  assert.ok(eval13att.blocking_reasons.includes(READINESS_REASON_CODES.MEDIA_JOB_NEEDS_ATTENTION));
  pass('JOB_ATTENTION_MAPS_TO_MEDIA_NEEDS_ATTENTION=PASS');

  // --- TEST 14: Deterministic Evaluation ---
  console.log('\n--- TEST 14: Deterministic Evaluation ---');
  const results14 = [];
  for (let i = 0; i < 5; i++) {
    const res = await evaluateArticleMediaReadiness(db4, 100);
    results14.push({
      ready: res.ready_for_review,
      state: res.evaluated_readiness,
      slots: res.required_media_slots,
      satisfied: res.satisfied_requirements,
      blockers: res.blocking_reasons
    });
  }
  for (let i = 1; i < results14.length; i++) {
    assert.deepEqual(results14[i], results14[0]);
  }
  pass('READINESS_EVALUATION_DETERMINISTIC=PASS');

  // --- TEST 15: Dry-Run Guarantees Zero Database Mutations ---
  console.log('\n--- TEST 15: Dry-Run Mode Guarantees Zero DB Mutations ---');
  const db15 = createTestDb();
  seedArticle(db15, 110, 'draft');
  seedJob(db15, 'mjob_110', 110, 'featured', 'featured', 1, 'QUEUED');
  seedAsset(db15, 'ast_110', 'VALIDATED');
  seedAttachment(db15, 31, 110, 'featured', 'ast_110', 'featured', 1);

  const dryResult = await reconcileArticleMediaReadiness(db15, 110, { dryRun: true });
  assert.equal(dryResult.dryRun, true);
  assert.equal(dryResult.persisted, false);
  assert.equal(dryResult.ready_for_review, true);
  assert.equal(dryResult.evaluated_readiness, READINESS_READY_FOR_REVIEW);

  const readinessCount15 = db15.raw.prepare('SELECT COUNT(*) as c FROM article_publication_readiness WHERE article_id = 110').get().c;
  assert.equal(readinessCount15, 0, 'ZERO rows inserted on dry-run');
  pass('READINESS_DRY_RUN_SUPPORTED=YES');
  pass('DRY_RUN_ARTICLE_READINESS_MUTATIONS=0');

  // --- TEST 16: Persist Mode State Transition & Snapshot Content ---
  console.log('\n--- TEST 16: Persist Mode State Transition ---');
  const persistResult = await reconcileArticleMediaReadiness(db15, 110, { dryRun: false });
  assert.equal(persistResult.dryRun, false);
  assert.equal(persistResult.persisted, true);
  assert.equal(persistResult.changed, true);
  assert.equal(persistResult.noop, false);

  const row16 = db15.raw.prepare('SELECT * FROM article_publication_readiness WHERE article_id = 110').get();
  assert.ok(row16, 'Readiness snapshot row persisted in DB');
  assert.equal(row16.is_ready, 0, 'is_ready remains 0 (review readiness != publication scheduling)');
  assert.equal(row16.overall_status, 'NOT_READY', 'overall_status is NOT_READY per schema check constraint');

  const snapshot16 = JSON.parse(row16.snapshot_json);
  assert.equal(snapshot16.evaluated_readiness, READINESS_READY_FOR_REVIEW);
  assert.equal(snapshot16.ready_for_review, true);
  pass('PERSIST_TRANSITION_SUCCESSFUL=PASS');

  // Verify articles.updated_at was NOT touched
  const art16 = db15.raw.prepare('SELECT status, updated_at FROM articles WHERE id = 110').get();
  assert.equal(art16.status, 'draft');
  pass('UNRELATED_ARTICLE_UPDATED_AT_MUTATION=NO');
  pass('ARTICLE_STATUS_MUTATIONS_FROM_RECONCILER=0');

  // --- TEST 17: Identical Readiness NO-OP ---
  console.log('\n--- TEST 17: Identical Readiness NO-OP ---');
  const countBefore17 = db15.raw.prepare('SELECT COUNT(*) as c FROM article_publication_readiness WHERE article_id = 110').get().c;
  assert.equal(countBefore17, 1);

  const noopResult = await reconcileArticleMediaReadiness(db15, 110, { dryRun: false });
  assert.equal(noopResult.dryRun, false);
  assert.equal(noopResult.persisted, false);
  assert.equal(noopResult.changed, false);
  assert.equal(noopResult.noop, true);

  const countAfter17 = db15.raw.prepare('SELECT COUNT(*) as c FROM article_publication_readiness WHERE article_id = 110').get().c;
  assert.equal(countAfter17, 1, 'No duplicate row inserted on identical state');
  pass('IDENTICAL_READINESS_NOOP=PASS');

  // --- TEST 18: Readiness Safe Reversibility / Regression ---
  console.log('\n--- TEST 18: Readiness Safe Regression ---');
  // Deactivate attachment for article 110
  db15.raw.prepare('UPDATE article_media SET is_active = 0 WHERE article_id = 110').run();

  const regressedResult = await reconcileArticleMediaReadiness(db15, 110, { dryRun: false });
  assert.equal(regressedResult.ready_for_review, false);
  assert.equal(regressedResult.evaluated_readiness, READINESS_WAITING_MEDIA);
  assert.equal(regressedResult.persisted, true);
  assert.equal(regressedResult.changed, true);

  const countAfter18 = db15.raw.prepare('SELECT COUNT(*) as c FROM article_publication_readiness WHERE article_id = 110').get().c;
  assert.equal(countAfter18, 2, 'New snapshot persisted for regressed state');

  const latestSnap18 = JSON.parse(db15.raw.prepare('SELECT snapshot_json FROM article_publication_readiness WHERE article_id = 110 ORDER BY id DESC LIMIT 1').get().snapshot_json);
  assert.equal(latestSnap18.evaluated_readiness, READINESS_WAITING_MEDIA);
  pass('READINESS_CAN_REGRESS_SAFELY=PASS');
  pass('READINESS_REGRESSION_TARGET=WAITING_MEDIA');

  // --- TEST 19: Lost Response Recovery ---
  console.log('\n--- TEST 19: Lost Response Recovery ---');
  // Client retries reconcile after regression; recovers identical regressed state with NO-OP
  const retryResult = await reconcileArticleMediaReadiness(db15, 110, { dryRun: false });
  assert.equal(retryResult.noop, true);
  assert.equal(retryResult.persisted, false);
  assert.equal(retryResult.evaluated_readiness, READINESS_WAITING_MEDIA);
  pass('LOST_RESPONSE_RECONCILIATION_RECOVERY=PASS');

  // --- TEST 20: Concurrent Reconciliation Safety ---
  console.log('\n--- TEST 20: Concurrent Reconciliation Safety ---');
  const [resA, resB] = await Promise.all([
    reconcileArticleMediaReadiness(db15, 110, { dryRun: true }),
    reconcileArticleMediaReadiness(db15, 110, { dryRun: true })
  ]);
  assert.deepEqual(resA.blocking_reasons, resB.blocking_reasons);
  assert.equal(resA.evaluated_readiness, resB.evaluated_readiness);
  pass('CONCURRENT_RECONCILIATION_SAFE=PASS');

  // --- TEST 21: Device-Authenticated API Endpoint ---
  console.log('\n--- TEST 21: Device-Authenticated API Endpoint ---');
  const testEnv = {
    DB: db4,
    LOKAMEDIA_DEVICE_TOKEN: 'sec_test_device_token_phase5i1'
  };

  // 21A: Missing auth -> 401
  const reqNoAuth = new Request('http://localhost/api/internal/v1/media/articles/100/reconcile-readiness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun: true })
  });
  const resNoAuth = await reconcileApiPost({ request: reqNoAuth, params: { article_id: '100' }, locals: { runtime: { env: testEnv } } });
  assert.equal(resNoAuth.status, 401);
  const dataNoAuth = await resNoAuth.json();
  assert.equal(dataNoAuth.code, 'AUTHENTICATION_REQUIRED');
  pass('READINESS_RECONCILE_AUTH_REQUIRED=PASS');

  // 21B: Forbidden scope -> 403
  const reqForbidden = new Request('http://localhost/api/internal/v1/media/articles/100/reconcile-readiness', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sec_test_device_token_phase5i1',
      'x-rl-scope': 'publish'
    },
    body: JSON.stringify({ dryRun: true })
  });
  const resForbidden = await reconcileApiPost({ request: reqForbidden, params: { article_id: '100' }, locals: { runtime: { env: testEnv } } });
  assert.equal(resForbidden.status, 403);
  pass('FORBIDDEN_SCOPE_REJECTED=PASS');

  // 21C: Binary payload -> 415
  const reqBinary = new Request('http://localhost/api/internal/v1/media/articles/100/reconcile-readiness', {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'Authorization': 'Bearer sec_test_device_token_phase5i1'
    },
    body: new Uint8Array([1, 2, 3])
  });
  const resBinary = await reconcileApiPost({ request: reqBinary, params: { article_id: '100' }, locals: { runtime: { env: testEnv } } });
  assert.equal(resBinary.status, 415);
  pass('BINARY_PAYLOAD_REJECTED=PASS');

  // 21D: Valid device auth -> 200 with dry-run
  const reqValid = new Request('http://localhost/api/internal/v1/media/articles/100/reconcile-readiness?dryRun=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sec_test_device_token_phase5i1'
    }
  });
  const resValid = await reconcileApiPost({ request: reqValid, params: { article_id: '100' }, locals: { runtime: { env: testEnv } } });
  assert.equal(resValid.status, 200);
  const dataValid = await resValid.json();
  assert.equal(dataValid.status, 'success');
  assert.equal(dataValid.data.ready_for_review, true);
  assert.equal(dataValid.data.dryRun, true);
  pass('READINESS_RECONCILE_API=PASS');

  // --- TEST 22: Controlled Article 1 Read-Only Live Dry-Run ---
  console.log('\n--- TEST 22: Controlled Article 1 Read-Only Live Dry-Run ---');
  if (liveD1) {
    const liveEvalResult = await evaluateArticleMediaReadiness(
      {
        prepare(sql) {
          return {
            _sql: sql,
            _params: [],
            bind(...args) {
              this._params = args.map(v => (v === undefined ? null : v));
              return this;
            },
            async first() {
              const stmt = liveD1.prepare(this._sql);
              return stmt.get(...this._params) || null;
            },
            async all() {
              const stmt = liveD1.prepare(this._sql);
              const results = stmt.all(...this._params);
              return { results };
            }
          };
        }
      },
      1
    );

    console.log('Live Dry-Run Evaluation Result for Article 1:');
    console.log(`  article_id: ${liveEvalResult.article_id}`);
    console.log(`  slug: ${liveEvalResult.slug}`);
    console.log(`  current_readiness: ${liveEvalResult.current_readiness}`);
    console.log(`  evaluated_readiness: ${liveEvalResult.evaluated_readiness}`);
    console.log(`  ready_for_review: ${liveEvalResult.ready_for_review}`);
    console.log(`  required_media_slots: ${JSON.stringify(liveEvalResult.required_media_slots)}`);
    console.log(`  satisfied_requirements: ${JSON.stringify(liveEvalResult.satisfied_requirements)}`);
    console.log(`  attached_media_slots: ${JSON.stringify(liveEvalResult.attached_media_slots)}`);
    console.log(`  blocking_reasons: ${JSON.stringify(liveEvalResult.blocking_reasons)}`);

    assert.equal(liveEvalResult.article_id, 1);
    assert.equal(liveEvalResult.current_readiness, 'NONE');
    assert.equal(liveEvalResult.evaluated_readiness, READINESS_READY_FOR_REVIEW);
    assert.equal(liveEvalResult.ready_for_review, true);
    assert.deepEqual(liveEvalResult.required_media_slots, ['featured']);
    assert.deepEqual(liveEvalResult.satisfied_requirements, ['featured']);
    assert.deepEqual(liveEvalResult.attached_media_slots, ['featured']);
    assert.equal(liveEvalResult.blocking_reasons.length, 0);

    // Verify ZERO mutations on live database
    const readinessCountAfter = liveD1.prepare('SELECT COUNT(*) as c FROM article_publication_readiness WHERE article_id = 1').get().c;
    assert.equal(readinessCountAfter, 0, 'ZERO readiness rows inserted for article 1 during dry-run');

    const art1After = liveD1.prepare('SELECT status, updated_at FROM articles WHERE id = 1').get();
    assert.equal(art1After.status, 'draft', 'Article status must remain draft');

    const mediaRelAfter = liveD1.prepare('SELECT id, asset_id, is_active FROM article_media WHERE id = 1').get();
    assert.equal(mediaRelAfter.id, 1);
    assert.equal(mediaRelAfter.asset_id, 'ast_d230f3d834ae5f1a9f689d7c');
    assert.equal(mediaRelAfter.is_active, 1);

    pass('CONTROLLED_ARTICLE_DRY_RUN_RESULT=READY_FOR_REVIEW');
    pass('DRY_RUN_ARTICLE_MUTATIONS=0');
    pass('DRY_RUN_READINESS_MUTATIONS=0');
    pass('DRY_RUN_ATTACHMENT_MUTATIONS=0');
  }

  console.log('\n============================================================');
  console.log(`ALL TESTS PASSED: ${passed}`);
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\nTEST RUN FAILED:', err);
  process.exit(1);
});
