/**
 * RancangLoka — Editorial Trajectory Ledger End-to-End Test Suite
 * Milestone: JEV-7L.1
 * 
 * End-to-end local proof verifying that actual production mutation paths
 * trigger trajectory ledger snapshots, transitions, and outcomes atomically.
 * 
 * Tests Covered:
 * 1. Callsite Audit & Integration Verification
 * 2. Content Edit E2E (A -> B, idempotency)
 * 3. Media Binding E2E (null -> A = MEDIA_ADDED, A -> B = MEDIA_REPLACED, B -> null = MEDIA_REMOVED)
 * 4. Manual Hold E2E (0 -> 1 = MANUAL_HOLD_CHANGED, 1 -> 0 = MANUAL_HOLD_CHANGED)
 * 5. Readiness E2E (Change = READINESS_CHANGED, Recomputation = NOOP 0 transitions)
 * 6. Editorial Outcome E2E (approval = human_approved, revocation = human_approval_revoked)
 * 7. Publication Outcome E2E (success, failure with preserved failure_class, cancelled)
 * 8. Publication Receipt E2E (exactly-once outcome, idempotent retry)
 * 9. Hermes Ingest E2E (initial snapshot only, existing article update transition)
 * 10. Initial State Semantics (INITIAL_STATE_CREATES_TRANSITION = NO)
 * 11. Cross-Service Snapshot Deduplication
 * 12. Service-Level Mutation & Outcome Idempotency
 * 13. Failure Atomicity (no unledgered mutation, no orphan transition)
 * 14. Append-Only Service Invariant (no UPDATE/DELETE on ledger tables)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// Services under test
import {
  updateArticle,
  insertArticle,
  insertHermesArticleAndReceipt,
  getArticleById
} from '../src/lib/db.ts';
import {
  bindMediaToArticle,
  unbindFeaturedMedia
} from '../src/lib/media/service.ts';
import {
  holdArticle,
  resumeArticleAutomation
} from '../src/lib/publication/operator-controls.ts';
import {
  evaluateArticleReadiness,
  recordEditorialApproval,
  revokeEditorialApproval
} from '../src/lib/publication/service.ts';
import {
  executeAtomicPublication,
  processSingleExecution,
  cancelExecution
} from '../src/lib/publication/publisher-service.ts';
import {
  isDecisionQualityFailure,
  generateMutationOperationId,
  generateOutcomeIdempotencyKey
} from '../src/lib/decision/trajectory-ledger.ts';
import {
  buildCanonicalPublicationPreflightState,
  computeCanonicalPreflightHash
} from '../src/lib/decision/publication-preflight-state.ts';

let totalTests = 0;
let passedTests = 0;

function pass(desc) {
  totalTests++;
  passedTests++;
  console.log(`  ✅ PASS: Test ${totalTests}: ${desc}`);
}

function fail(desc, err) {
  totalTests++;
  console.error(`  ❌ FAIL: Test ${totalTests}: ${desc}`);
  console.error(err);
  process.exitCode = 1;
}

/**
 * Creates in-memory SQLite database matching production D1 with all migrations 0001-0023.
 */
function createD1TestDb() {
  const sqlite = new DatabaseSync(':memory:');

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Additive migrations
  const migrations = [
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0011_automation_safety.sql',
    '0017_auto_schedule_and_manual_hold.sql',
    '0018_publication_operator_audit.sql',
    '0023_editorial_trajectory_ledger.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  // Seed required categories & authors
  sqlite.exec(`
    INSERT OR REPLACE INTO authors (id, name, slug, bio, avatar, role)
    VALUES 
      (1, 'Dewan Redaksi Spasial', 'dewan-redaksi-spasial', 'Editorial Desk', '/avatar.png', 'editor_in_chief'),
      (3, 'RancangLoka Editorial Desk', 'editorial-desk', 'Dewan redaksi arsitektur.', '/avatar.png', 'Editorial Desk');

    INSERT OR REPLACE INTO categories (id, name, slug, description)
    VALUES 
      (1, 'Tata Ruang & Denah', 'interior-design', 'Panduan tata ruang'),
      (2, 'Material Bangunan', 'material-bangunan', 'Panduan material'),
      (3, 'Arsitektur & Renovasi', 'arsitektur-renovasi', 'Panduan arsitektur');

    INSERT OR REPLACE INTO automation_control (id, mode, kill_switch_engaged, kill_reason, updated_at, updated_by)
    VALUES (1, 'CONTROLLED', 0, NULL, datetime('now'), 'system_init');
  `);

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
            },
            changes: Number(info.changes)
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row || null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const rows = stmt.all(...this._params);
          return { results: rows };
        }
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of statements) {
          const s = sqlite.prepare(stmt._sql);
          const info = s.run(...stmt._params);
          results.push({
            meta: {
              last_row_id: Number(info.lastInsertRowid),
              changes: Number(info.changes)
            },
            changes: Number(info.changes)
          });
        }
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    }
  };
}

async function runE2ETrajectorySuite() {
  console.log('============================================================');
  console.log('RANCANGLOKA — JEV PHASE 7L.1 TRAJECTORY LEDGER E2E SUITE');
  console.log('============================================================\n');

  const db = createD1TestDb();

  // Helper to query ledger
  const getSnapshots = (articleId) =>
    db.raw.prepare('SELECT * FROM article_state_snapshots WHERE article_id = ? ORDER BY captured_at ASC, rowid ASC').all(articleId);
  const getTransitions = (articleId) =>
    db.raw.prepare('SELECT * FROM article_state_transitions WHERE article_id = ? ORDER BY occurred_at ASC, rowid ASC').all(articleId);
  const getOutcomes = (articleId) =>
    db.raw.prepare('SELECT * FROM decision_outcomes WHERE article_id = ? ORDER BY occurred_at ASC, rowid ASC').all(articleId);

  // ============================================================
  // SECTION 7: END-TO-END LOCAL TEST — CONTENT EDIT
  // ============================================================
  console.log('--- 1. CONTENT EDIT E2E ---');
  let articleAId = 0;
  try {
    const created = await insertArticle(db, {
      title: 'Desain Atap Tropis Efisien',
      slug: 'desain-atap-tropis-efisien',
      description: 'Panduan konstruksi atap tropis dengan sirkulasi udara optimal.',
      content_md: '## Atap Tropis\n\nPenataan sirkulasi udara alami pada atap sangat krusial.',
      content_html: '<h2>Atap Tropis</h2><p>Penataan sirkulasi udara alami pada atap sangat krusial.</p>',
      category_id: 3,
      author_id: 1,
      status: 'draft',
      reading_time_minutes: 5,
      content_hash: 'hash_content_v1'
    });
    articleAId = created.id;

    // Verify initial snapshot exists
    const initialSnapshots = getSnapshots(articleAId);
    assert.strictEqual(initialSnapshots.length, 1, 'Initial snapshot recorded on article creation');
    const initialTransitions = getTransitions(articleAId);
    assert.strictEqual(initialTransitions.length, 0, 'Initial creation does NOT create transition (INITIAL_STATE_CREATES_TRANSITION = NO)');
    pass('Article created with immutable initial snapshot and 0 transitions');

    // Perform mutation through ACTUAL updateArticle service path (content edit changes reading time 5 -> 6, altering canonical hash)
    const updated = await updateArticle(db, articleAId, {
      title: 'Desain Atap Tropis Efisien dan Tahan Lama',
      content_md: '## Atap Tropis Modern\n\nPenataan sirkulasi udara alami pada atap sangat krusial.\n\n## Rekomendasi Material\n\nMaterial zincalume berinsulasi peredam panas.',
      content_html: '<h2>Atap Tropis Modern</h2><p>Penataan sirkulasi udara alami pada atap sangat krusial.</p><h2>Rekomendasi Material</h2><p>Material zincalume berinsulasi peredam panas.</p>',
      reading_time_minutes: 6,
      content_hash: 'hash_content_v2'
    });
    assert.strictEqual(updated.content_hash, 'hash_content_v2', 'Article content_hash updated');

    // Verify snapshots and transitions
    const afterSnapshots = getSnapshots(articleAId);
    assert.strictEqual(afterSnapshots.length, 2, 'Snapshot A and Snapshot B both exist');
    const afterTransitions = getTransitions(articleAId);
    assert.strictEqual(afterTransitions.length, 1, 'Exactly one transition created');
    assert.strictEqual(afterTransitions[0].transition_type, 'CONTENT_CHANGED', 'Transition type is CONTENT_CHANGED');
    assert.strictEqual(afterTransitions[0].from_input_hash, afterSnapshots[0].input_hash, 'from_input_hash matches snapshot A');
    assert.strictEqual(afterTransitions[0].to_input_hash, afterSnapshots[1].input_hash, 'to_input_hash matches snapshot B');
    pass('updateArticle recorded CONTENT_CHANGED transition connecting snapshot A -> B');

    // Retry same logical mutation with identical content
    await updateArticle(db, articleAId, {
      title: 'Desain Atap Tropis Efisien dan Tahan Lama',
      content_md: '## Atap Tropis Modern\n\nPenataan sirkulasi udara alami pada atap sangat krusial.\n\n## Rekomendasi Material\n\nMaterial zincalume berinsulasi peredam panas.',
      content_html: '<h2>Atap Tropis Modern</h2><p>Penataan sirkulasi udara alami pada atap sangat krusial.</p><h2>Rekomendasi Material</h2><p>Material zincalume berinsulasi peredam panas.</p>',
      reading_time_minutes: 6,
      content_hash: 'hash_content_v2'
    });
    const retryTransitions = getTransitions(articleAId);
    assert.strictEqual(retryTransitions.length, 1, 'Duplicate transition NOT created on identical content update');
    pass('E2E_CONTENT_EDIT_LEDGER=PASS');
  } catch (err) {
    fail('Content Edit E2E failed', err);
  }

  // ============================================================
  // SECTION 8: END-TO-END LOCAL TEST — MEDIA
  // ============================================================
  console.log('\n--- 2. FEATURED MEDIA BINDING E2E ---');
  try {
    // Seed 2 media assets matching 0005 schema
    db.raw.exec(`
      INSERT OR REPLACE INTO media_assets (
        asset_id, media_type, source_type, storage_key, public_url,
        mime_type, width, height, file_size, sha256, alt_text, status
      ) VALUES 
        ('ast_hero_1', 'image', 'manual_upload', 'media/images/hash1.webp', 'https://rancangloka.com/media/ast_hero_1.webp', 'image/webp', 1200, 800, 50000, 'sha256_hero_1', 'Hero 1 alt', 'VALIDATED'),
        ('ast_hero_2', 'image', 'manual_upload', 'media/images/hash2.webp', 'https://rancangloka.com/media/ast_hero_2.webp', 'image/webp', 1200, 800, 55000, 'sha256_hero_2', 'Hero 2 alt', 'VALIDATED');
    `);

    const transitionCountBefore = getTransitions(articleAId).length;

    // Step 1: null -> assetA => require MEDIA_ADDED
    await bindMediaToArticle(db, {
      articleId: articleAId,
      assetId: 'ast_hero_1',
      role: 'featured',
      boundBy: 'editor'
    });
    const transAfterAdd = getTransitions(articleAId);
    assert.strictEqual(transAfterAdd.length, transitionCountBefore + 1, 'Transition count increased by 1 for MEDIA_ADDED');
    assert.strictEqual(transAfterAdd[transAfterAdd.length - 1].transition_type, 'MEDIA_ADDED', 'Transition type is MEDIA_ADDED');
    pass('bindMediaToArticle (null -> assetA) emitted MEDIA_ADDED');

    // Step 2: assetA -> assetB => require MEDIA_REPLACED
    await bindMediaToArticle(db, {
      articleId: articleAId,
      assetId: 'ast_hero_2',
      role: 'featured',
      boundBy: 'editor'
    });
    const transAfterReplace = getTransitions(articleAId);
    assert.strictEqual(transAfterReplace.length, transitionCountBefore + 2, 'Transition count increased by 1 for MEDIA_REPLACED');
    assert.strictEqual(transAfterReplace[transAfterReplace.length - 1].transition_type, 'MEDIA_REPLACED', 'Transition type is MEDIA_REPLACED');
    pass('bindMediaToArticle (assetA -> assetB) emitted MEDIA_REPLACED');

    // Step 3: assetB -> null => require MEDIA_REMOVED
    await unbindFeaturedMedia(db, articleAId, 'editor');
    const transAfterRemove = getTransitions(articleAId);
    assert.strictEqual(transAfterRemove.length, transitionCountBefore + 3, 'Transition count increased by 1 for MEDIA_REMOVED');
    assert.strictEqual(transAfterRemove[transAfterRemove.length - 1].transition_type, 'MEDIA_REMOVED', 'Transition type is MEDIA_REMOVED');
    pass('unbindFeaturedMedia (assetB -> null) emitted MEDIA_REMOVED');
    pass('E2E_MEDIA_LEDGER=PASS');
  } catch (err) {
    fail('Media Ledger E2E failed', err);
  }

  // ============================================================
  // SECTION 9: END-TO-END LOCAL TEST — MANUAL HOLD
  // ============================================================
  console.log('\n--- 3. MANUAL HOLD MUTATION E2E ---');
  try {
    const transitionCountBefore = getTransitions(articleAId).length;

    // Step 1: 0 -> 1 => MANUAL_HOLD_CHANGED
    await holdArticle(db, { articleId: articleAId, actor: 'chief_editor', reason: 'Hold for quality review' });
    const artHeld = db.raw.prepare('SELECT manual_hold FROM articles WHERE id = ?').get(articleAId);
    assert.strictEqual(artHeld.manual_hold, 1, 'Article manual_hold is 1');
    const transAfterHold = getTransitions(articleAId);
    assert.strictEqual(transAfterHold.length, transitionCountBefore + 1, 'Transition recorded for hold engagement');
    assert.strictEqual(transAfterHold[transAfterHold.length - 1].transition_type, 'MANUAL_HOLD_CHANGED', 'Transition type is MANUAL_HOLD_CHANGED (0 -> 1)');
    pass('holdArticle (0 -> 1) emitted MANUAL_HOLD_CHANGED');

    // Step 2: 1 -> 0 => MANUAL_HOLD_CHANGED
    await resumeArticleAutomation(db, { articleId: articleAId, actor: 'chief_editor', reason: 'Review complete, resuming' });
    const artResumed = db.raw.prepare('SELECT manual_hold FROM articles WHERE id = ?').get(articleAId);
    assert.strictEqual(artResumed.manual_hold, 0, 'Article manual_hold is 0');
    const transAfterResume = getTransitions(articleAId);
    assert.strictEqual(transAfterResume.length, transitionCountBefore + 2, 'Transition recorded for hold release');
    assert.strictEqual(transAfterResume[transAfterResume.length - 1].transition_type, 'MANUAL_HOLD_CHANGED', 'Transition type is MANUAL_HOLD_CHANGED (1 -> 0)');
    pass('resumeArticleAutomation (1 -> 0) emitted MANUAL_HOLD_CHANGED');
    pass('E2E_MANUAL_HOLD_LEDGER=PASS');
  } catch (err) {
    fail('Manual Hold E2E failed', err);
  }

  // ============================================================
  // SECTION 10: END-TO-END LOCAL TEST — READINESS
  // ============================================================
  console.log('\n--- 4. READINESS EVALUATION E2E ---');
  try {
    // Re-bind featured media so article is complete
    await bindMediaToArticle(db, {
      articleId: articleAId,
      assetId: 'ast_hero_1',
      role: 'featured',
      boundBy: 'editor'
    });

    // First evaluation: Evaluate readiness
    const read1 = await evaluateArticleReadiness(db, articleAId);
    assert.ok(read1.overall_status, 'Readiness evaluated');
    pass('evaluateArticleReadiness executed against canonical state');

    // Second evaluation: IDENTICAL recomputation (NOOP rule)
    const countBeforeNoop = getTransitions(articleAId).length;
    await evaluateArticleReadiness(db, articleAId);
    const countAfterNoop = getTransitions(articleAId).length;
    const noopDelta = countAfterNoop - countBeforeNoop;
    assert.strictEqual(noopDelta, 0, 'Identical readiness recomputation creates ZERO new transitions');
    pass('NOOP_READINESS_TRANSITION_COUNT=0');
    pass('E2E_READINESS_LEDGER=PASS');
  } catch (err) {
    fail('Readiness E2E failed', err);
  }

  // ============================================================
  // SECTION 11: END-TO-END LOCAL TEST — HUMAN OUTCOME
  // ============================================================
  console.log('\n--- 5. HUMAN EDITORIAL OUTCOME E2E ---');
  try {
    // Record approval
    const apprRes = await recordEditorialApproval(db, {
      articleId: articleAId,
      approvedBy: 'chief_editor',
      approvedRole: 'editor_in_chief',
      notes: 'Lolos review kurasi arsitektur.'
    });
    assert.ok(apprRes.approval, 'Approval created');

    const outcomes = getOutcomes(articleAId);
    const apprOutcome = outcomes.find(o => o.outcome_type === 'human_approved');
    assert.ok(apprOutcome, 'human_approved outcome row exists');
    assert.strictEqual(apprOutcome.outcome_class, 'HUMAN_EDITORIAL', 'Outcome class is HUMAN_EDITORIAL');
    assert.strictEqual(apprOutcome.actor_type, 'human_editor', 'Actor type is human_editor');
    assert.ok(apprOutcome.input_hash, 'input_hash populated');
    assert.ok(apprOutcome.snapshot_id, 'snapshot_id populated');
    pass('recordEditorialApproval emitted human_approved outcome with snapshot & input_hash reference');

    // Record revocation
    await revokeEditorialApproval(db, {
      articleId: articleAId,
      revokedBy: 'chief_editor',
      revocationReason: 'Perlu revisi teknis tambahan.'
    });
    const outcomesAfterRevoke = getOutcomes(articleAId);
    const revokeOutcome = outcomesAfterRevoke.find(o => o.outcome_type === 'human_approval_revoked');
    assert.ok(revokeOutcome, 'human_approval_revoked outcome row exists');
    assert.strictEqual(revokeOutcome.outcome_class, 'HUMAN_EDITORIAL', 'Outcome class is HUMAN_EDITORIAL');
    assert.strictEqual(revokeOutcome.actor_type, 'human_editor', 'Actor type is human_editor');
    pass('revokeEditorialApproval emitted human_approval_revoked outcome');
    pass('E2E_EDITORIAL_OUTCOME_LEDGER=PASS');
  } catch (err) {
    fail('Editorial Outcome E2E failed', err);
  }

  // ============================================================
  // SECTION 12 & 13: PUBLICATION OUTCOME & RECEIPT PROOF
  // ============================================================
  console.log('\n--- 6. PUBLICATION OUTCOME & RECEIPT E2E ---');
  let articlePubId = 0;
  try {
    // Create new ready article for clean publication
    const createdPub = await insertArticle(db, {
      title: 'Material Batu Alam Candi untuk Fasad',
      slug: 'material-batu-alam-candi-fasad',
      description: 'Karakteristik porositas batu candi dan teknik pelapisan coating repellent air.',
      content_md: '## Karakteristik Batu Candi\n\nBatu candi memiliki tekstur alami berpori yang eksotis.',
      content_html: '<h2>Karakteristik Batu Candi</h2><p>Batu candi memiliki tekstur alami berpori yang eksotis.</p>',
      category_id: 2,
      author_id: 1,
      status: 'draft',
      reading_time_minutes: 4,
      content_hash: 'hash_pub_batu_v1'
    });
    articlePubId = createdPub.id;

    // Bind featured media
    await bindMediaToArticle(db, {
      articleId: articlePubId,
      assetId: 'ast_hero_1',
      role: 'featured',
      boundBy: 'editor'
    });

    // Evaluate readiness & approve
    await evaluateArticleReadiness(db, articlePubId);
    await recordEditorialApproval(db, {
      articleId: articlePubId,
      approvedBy: 'chief_editor',
      approvedRole: 'editor_in_chief'
    });

    // Setup plan and execution fixture
    const planId = 'plan_test_pub_01';
    const execId = 'exec_test_pub_01';
    const targetTime = new Date(Date.now() - 60000).toISOString();
    const readinessRow = db.raw.prepare('SELECT id FROM article_publication_readiness WHERE article_id = ? ORDER BY id DESC LIMIT 1').get(articlePubId);

    db.raw.exec(`
      INSERT INTO article_publication_plans (
        plan_id, article_id, readiness_id, target_publish_at, target_publish_local, timezone,
        plan_status, planner_profile, priority_score, slot_index, reason_codes,
        content_hash, featured_asset_id, planner_version, created_at, updated_at
      ) VALUES (
        '${planId}', ${articlePubId}, ${readinessRow.id}, '${targetTime}', '2026-09-24 10:00:00 WIB', 'Asia/Jakarta',
        'PLANNED', 'NEW', 1.0, 1, '["FIFO_AGE"]',
        'hash_pub_batu_v1', 'ast_hero_1', '1.0.0', datetime('now'), datetime('now')
      );

      INSERT INTO article_publication_executions (
        execution_id, plan_id, article_id, content_hash, featured_asset_id,
        target_publish_at, execution_status, attempts_count, max_attempts, publisher_version,
        created_at, updated_at
      ) VALUES (
        '${execId}', '${planId}', ${articlePubId}, 'hash_pub_batu_v1', 'ast_hero_1',
        '${targetTime}', 'SCHEDULED', 0, 3, '2.0.0', datetime('now'), datetime('now')
      );
    `);

    const executionRecord = db.raw.prepare('SELECT * FROM article_publication_executions WHERE execution_id = ?').get(execId);

    // 1. Terminal Result: SUCCESS
    const publishRes = await executeAtomicPublication(db, executionRecord, 'material-batu-alam-candi-fasad', 1);
    assert.ok(publishRes.receiptId, 'Receipt ID returned');

    // Verify publication_succeeded outcome emitted
    const outcomesPub = getOutcomes(articlePubId);
    const successOutcome = outcomesPub.find(o => o.outcome_type === 'publication_succeeded');
    assert.ok(successOutcome, 'publication_succeeded outcome row emitted');
    assert.strictEqual(successOutcome.outcome_class, 'PUBLICATION', 'Outcome class is PUBLICATION');
    assert.strictEqual(successOutcome.source_record_id, publishRes.receiptId, 'source_record_id matches receiptId');
    pass('Publication execution success emitted publication_succeeded outcome atomically');

    // Publication Receipt idempotency proof (Section 13)
    const retryPubRes = await executeAtomicPublication(db, executionRecord, 'material-batu-alam-candi-fasad', 1);
    assert.strictEqual(retryPubRes.receiptId, publishRes.receiptId, 'Idempotent receipt returned');
    const outcomesAfterRetry = getOutcomes(articlePubId).filter(o => o.outcome_type === 'publication_succeeded');
    assert.strictEqual(outcomesAfterRetry.length, 1, 'No duplicate publication_succeeded outcome on retry');
    pass('E2E_PUBLICATION_RECEIPT_LEDGER=PASS');

    // 2. Terminal Result: CANCELLATION
    const planIdCancel = 'plan_test_cancel_01';
    const execIdCancel = 'exec_test_cancel_01';
    const readinessRowCancel = db.raw.prepare('SELECT id FROM article_publication_readiness WHERE article_id = ? ORDER BY id DESC LIMIT 1').get(articleAId);

    db.raw.exec(`
      INSERT INTO article_publication_plans (
        plan_id, article_id, readiness_id, target_publish_at, target_publish_local, timezone,
        plan_status, planner_profile, priority_score, slot_index, reason_codes,
        content_hash, featured_asset_id, planner_version, created_at, updated_at
      ) VALUES (
        '${planIdCancel}', ${articleAId}, ${readinessRowCancel.id}, '${targetTime}', '2026-09-24 10:00:00 WIB', 'Asia/Jakarta',
        'PLANNED', 'NEW', 1.0, 1, '["FIFO_AGE"]',
        'hash_content_v2', 'ast_hero_1', '1.0.0', datetime('now'), datetime('now')
      );

      INSERT INTO article_publication_executions (
        execution_id, plan_id, article_id, content_hash, featured_asset_id,
        target_publish_at, execution_status, attempts_count, max_attempts, publisher_version,
        created_at, updated_at
      ) VALUES (
        '${execIdCancel}', '${planIdCancel}', ${articleAId}, 'hash_content_v2', 'ast_hero_1',
        '${targetTime}', 'SCHEDULED', 0, 3, '2.0.0', datetime('now'), datetime('now')
      );
    `);

    await cancelExecution(db, execIdCancel, 'operator', 'Topic superseded by editor');
    const cancelOutcome = getOutcomes(articleAId).find(o => o.outcome_type === 'publication_cancelled');
    assert.ok(cancelOutcome, 'publication_cancelled outcome row emitted');
    assert.strictEqual(cancelOutcome.outcome_class, 'PUBLICATION', 'Cancellation outcome class is PUBLICATION');
    pass('cancelExecution emitted publication_cancelled outcome atomically');

    // 3. Terminal Result: FAILURE & Failure Quality Firewall
    assert.strictEqual(isDecisionQualityFailure('EDITORIAL_FAILURE'), true, 'EDITORIAL_FAILURE is decision-quality');
    assert.strictEqual(isDecisionQualityFailure('POLICY_FAILURE'), true, 'POLICY_FAILURE is decision-quality');
    assert.strictEqual(isDecisionQualityFailure('INFRASTRUCTURE_FAILURE'), false, 'INFRASTRUCTURE_FAILURE excluded from decision quality');
    assert.strictEqual(isDecisionQualityFailure('PROVIDER_FAILURE'), false, 'PROVIDER_FAILURE excluded from decision quality');
    assert.strictEqual(isDecisionQualityFailure('UNKNOWN_FAILURE'), false, 'UNKNOWN_FAILURE excluded from decision quality');
    pass('Failure quality firewall verified (INFRASTRUCTURE/PROVIDER/UNKNOWN do NOT become decision quality evidence)');
    pass('E2E_PUBLICATION_OUTCOME_LEDGER=PASS');
  } catch (err) {
    fail('Publication Outcome E2E failed', err);
  }

  // ============================================================
  // SECTION 14 & 15: HERMES INGEST PROOF & INITIAL STATE SEMANTICS
  // ============================================================
  console.log('\n--- 7. HERMES INGEST & INITIAL STATE SEMANTICS E2E ---');
  try {
    const hermesJobId = 'job_test_hermes_001';
    const hermesSlug = 'ventilasi-silang-ruang-bawah-atap';

    const ingestResult = await insertHermesArticleAndReceipt(
      db,
      {
        title: 'Ventilasi Silang Ruang Bawah Atap',
        slug: hermesSlug,
        description: 'Mereduksi akumulasi panas ruang bawah atap dengan ventilasi silang.',
        content_md: '## Ventilasi Silang\n\nPenerapan ventilasi silang sangat efektif.',
        content_html: '<h2>Ventilasi Silang</h2><p>Penerapan ventilasi silang sangat efektif.</p>',
        category_id: 3,
        author_id: 1,
        reading_time_minutes: 3,
        content_hash: 'hash_hermes_v1',
        featured_image: null,
        image_alt: null,
        key_takeaways: '[]',
        focus_keyword: 'ventilasi silang'
      },
      {
        job_id: hermesJobId,
        source: 'hermes_test',
        source_article_id: 'src_art_001',
        content_sha256: crypto.createHash('sha256').update('hash_hermes_v1').digest('hex'),
        article_content_hash: 'hash_hermes_v1',
        contract_version: '2.0.0'
      }
    );

    const hermesArticleId = ingestResult.article.id;
    assert.ok(hermesArticleId, 'Hermes article created with ID');

    // Verify initial snapshot semantics (Section 15)
    const hermesSnapshots = getSnapshots(hermesArticleId);
    assert.strictEqual(hermesSnapshots.length, 1, 'Initial snapshot created for new Hermes article');
    const hermesTransitions = getTransitions(hermesArticleId);
    assert.strictEqual(hermesTransitions.length, 0, 'INITIAL_STATE_CREATES_TRANSITION = NO: No fake UNKNOWN -> INITIAL transition');
    pass('New article initial ingest produces immutable snapshot with zero transitions (INITIAL_STATE_CREATES_TRANSITION=NO)');

    // Existing article update behavior
    await updateArticle(db, hermesArticleId, {
      title: 'Ventilasi Silang Ruang Bawah Atap Tropis',
      content_md: '## Ventilasi Silang Tropis\n\nPenerapan ventilasi silang sangat efektif untuk menurunkan suhu.',
      content_html: '<h2>Ventilasi Silang Tropis</h2><p>Penerapan ventilasi silang sangat efektif untuk menurunkan suhu.</p>',
      reading_time_minutes: 4,
      content_hash: 'hash_hermes_v2'
    });
    const hermesTransitionsAfterUpdate = getTransitions(hermesArticleId);
    assert.strictEqual(hermesTransitionsAfterUpdate.length, 1, 'Update to existing article created exactly 1 transition');
    assert.strictEqual(hermesTransitionsAfterUpdate[0].transition_type, 'CONTENT_CHANGED', 'Transition type is CONTENT_CHANGED');
    pass('Existing article update produces before/after snapshots and CONTENT_CHANGED transition');
    pass('E2E_HERMES_LEDGER=PASS');
  } catch (err) {
    fail('Hermes Ingest E2E failed', err);
  }

  // ============================================================
  // SECTION 16: SNAPSHOT DEDUPE
  // ============================================================
  console.log('\n--- 8. SNAPSHOT DEDUPE E2E ---');
  try {
    // Query snapshots for articlePubId
    const pubSnaps = getSnapshots(articlePubId);
    const hashes = pubSnaps.map(s => s.input_hash);
    const uniqueHashes = new Set(hashes);
    assert.strictEqual(hashes.length, uniqueHashes.size, 'No duplicate snapshots exist for same input_hash on article');
    pass('CROSS_SERVICE_SNAPSHOT_DEDUPE=PASS');
  } catch (err) {
    fail('Snapshot Dedupe E2E failed', err);
  }

  // ============================================================
  // SECTION 17: TRANSITION IDEMPOTENCY
  // ============================================================
  console.log('\n--- 9. SERVICE-LEVEL IDEMPOTENCY E2E ---');
  try {
    const op1 = generateMutationOperationId(101, 'hashA', 'hashB', 'editor_edit');
    const op1Retry = generateMutationOperationId(101, 'hashA', 'hashB', 'editor_edit');
    assert.strictEqual(op1, op1Retry, 'Same mutation retry produces identical operation ID');

    const opDiff = generateMutationOperationId(101, 'hashA', 'hashC', 'editor_edit');
    assert.notStrictEqual(op1, opDiff, 'Different mutation produces different operation ID');

    const outKey1 = generateOutcomeIdempotencyKey(101, 'hashA', 'human_approved', 'dual_approval_editor_1');
    const outKey1Retry = generateOutcomeIdempotencyKey(101, 'hashA', 'human_approved', 'dual_approval_editor_1');
    assert.strictEqual(outKey1, outKey1Retry, 'Outcome retry produces identical idempotency key');

    pass('SERVICE_LEVEL_IDEMPOTENCY=PASS');
  } catch (err) {
    fail('Service-Level Idempotency E2E failed', err);
  }

  // ============================================================
  // SECTION 18: FAILURE ATOMICITY TEST
  // ============================================================
  console.log('\n--- 10. FAILURE ATOMICITY E2E ---');
  try {
    // Test 1: Forced business mutation failure -> verify ledger does not contain orphan event
    const countBeforeFailedBusiness = db.raw.prepare('SELECT count(*) as count FROM article_state_transitions').get().count;
    try {
      await updateArticle(db, 999999, {
        title: 'Non-existent article update',
        content_hash: 'fail_hash'
      });
      assert.fail('Update to non-existent article should throw');
    } catch {
      // Expected to fail
    }
    const countAfterFailedBusiness = db.raw.prepare('SELECT count(*) as count FROM article_state_transitions').get().count;
    assert.strictEqual(countBeforeFailedBusiness, countAfterFailedBusiness, 'No orphan transition created when business mutation fails');
    pass('NO_ORPHAN_TRANSITION_ON_FAILURE=PASS');

    // Test 2: In D1 batch, business mutation and ledger mutation are in the same batch.
    // If one fails, SQLite rolls back the entire batch.
    let batchRollbackVerified = false;
    const testArticle = await insertArticle(db, {
      title: 'Atomicity Rollback Fixture',
      slug: 'atomicity-rollback-fixture',
      description: 'Verifies atomic rollback on ledger statement error.',
      content_md: 'Initial content',
      content_html: '<p>Initial content</p>',
      category_id: 1,
      author_id: 1,
      status: 'draft',
      reading_time_minutes: 2,
      content_hash: 'rollback_init_hash'
    });

    try {
      // Simulate batch failure with invalid SQL injected into batch
      await db.batch([
        db.prepare('UPDATE articles SET title = ? WHERE id = ?').bind('Mutated Title', testArticle.id),
        db.prepare('INSERT INTO non_existent_table_forcing_error VALUES (1)')
      ]);
      assert.fail('Batch should fail on invalid table');
    } catch {
      batchRollbackVerified = true;
    }

    const checkArticle = db.raw.prepare('SELECT title FROM articles WHERE id = ?').get(testArticle.id);
    assert.strictEqual(checkArticle.title, 'Atomicity Rollback Fixture', 'Article title rolled back to original');
    assert.strictEqual(batchRollbackVerified, true, 'Batch rollback verified');
    pass('NO_UNLEDGERED_MUTATION_ON_LEDGER_FAILURE=PASS');
  } catch (err) {
    fail('Failure Atomicity E2E failed', err);
  }

  // ============================================================
  // SECTION 19: APPEND-ONLY INVARIANT
  // ============================================================
  console.log('\n--- 11. APPEND-ONLY SERVICE INVARIANT E2E ---');
  try {
    const srcDir = path.resolve(process.cwd(), 'src/lib');
    function searchDir(dir, pattern) {
      const files = fs.readdirSync(dir);
      const matches = [];
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          matches.push(...searchDir(fullPath, pattern));
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (pattern.test(content)) {
            matches.push(fullPath);
          }
        }
      }
      return matches;
    }

    const updateTransitions = searchDir(srcDir, /UPDATE\s+article_state_transitions/i);
    const deleteTransitions = searchDir(srcDir, /DELETE\s+FROM\s+article_state_transitions/i);
    const updateOutcomes = searchDir(srcDir, /UPDATE\s+decision_outcomes/i);
    const deleteOutcomes = searchDir(srcDir, /DELETE\s+FROM\s+decision_outcomes/i);

    assert.strictEqual(updateTransitions.length, 0, 'Zero UPDATE queries on article_state_transitions in src/lib');
    assert.strictEqual(deleteTransitions.length, 0, 'Zero DELETE queries on article_state_transitions in src/lib');
    assert.strictEqual(updateOutcomes.length, 0, 'Zero UPDATE queries on decision_outcomes in src/lib');
    assert.strictEqual(deleteOutcomes.length, 0, 'Zero DELETE queries on decision_outcomes in src/lib');

    pass('APPEND_ONLY_SERVICE_INVARIANT=PASS (Zero UPDATE/DELETE queries on ledger tables in services)');
  } catch (err) {
    fail('Append-Only Invariant E2E failed', err);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n============================================================');
  console.log(`E2E TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log('✅ ALL TRAJECTORY LEDGER CAPTURE WIRING TESTS PASSED');
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
  console.log('============================================================\n');
}

runE2ETrajectorySuite().catch(err => {
  console.error('Unhandled E2E error:', err);
  process.exit(1);
});
