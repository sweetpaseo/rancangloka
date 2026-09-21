/**
 * RancangLoka — Phase 5L6A Test Suite
 * Auto-Policy Plan Execution Reconciler
 *
 * Deterministic Test Matrix:
 * 1.  Test 1: Controlled happy path (draft, 0 approval rows, system_policy_pass=true -> SCHEDULED execution created, execution_mode=auto_schedule, article draft, 0 publication)
 * 2.  Test 2: Unattended promotion (automation mode=UNATTENDED promotes to SCHEDULED execution, reconciler does not publish)
 * 3.  Test 3: PLAN_ONLY block (automation mode=PLAN_ONLY blocks execution promotion, plan remains PLANNED, 0 execution)
 * 4.  Test 4: OFF & OBSERVE_ONLY block (OFF/OBSERVE_ONLY blocks execution promotion)
 * 5.  Test 5: Manual hold block (manual_hold=1 blocks promotion, plan remains PLANNED)
 * 6.  Test 6: Emergency kill switch block (kill_switch_engaged=1 blocks promotion)
 * 7.  Test 7: Stale content fail-closed (content changed after plan -> blocked)
 * 8.  Test 8: Stale media fail-closed (featured media changed after plan -> blocked)
 * 9.  Test 9: Stale policy fail-closed (stale system policy -> blocked)
 * 10. Test 10: Global auto-schedule OFF does NOT invalidate existing plan promotion
 * 11. Test 11: Auto-policy only (editorial_signoff and legacy plans are NOT processed by reconciler)
 * 12. Test 12: Reconciler idempotency (running twice produces exactly 1 execution, second run status=reused)
 * 13. Test 13: Lost response recovery (pre-existing execution discovered and reused without error)
 * 14. Test 14: Concurrent execution duplicate prevention (concurrent promotion yields exactly 1 execution)
 * 15. Test 15: Reconciler publication firewall (0 articles published, articles.status remains draft)
 * 16. Test 16: Human approval firewall (0 rows in article_editorial_approvals produced)
 * 17. Test 17: Honest system audit attribution (publication_plan_events has actor_type='system_policy', actor_id='auto_scheduler')
 * 18. Test 18: Bounded batch limit (batch limit respected)
 * 19. Test 19: Per-plan failure isolation (one held plan does not block another valid plan)
 * 20. Test 20: Server trigger API & Media Device firewall (media device rejected with 403, valid call succeeds)
 * 21. Test 21: Live local Miniflare D1 read-only freeze audit (Articles 1, 3, 5, settings, and kill switch)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  reconcileAutoPolicyPlansForExecution,
  RECONCILER_DEFAULT_BATCH_LIMIT,
  RECONCILER_ACTOR_ID,
  RECONCILER_ACTOR_TYPE
} from '../src/lib/publication/auto-policy-reconciler.ts';

import { evaluateArticleReadiness } from '../src/lib/publication/service.ts';
import { setAutomationMode, setKillSwitch } from '../src/lib/safety/automation-controller.ts';
import { POST as reconcilePostHandler, GET as reconcileGetHandler } from '../src/pages/api/admin/publication/publish/reconcile.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS: ${name}`);
}

function computeSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function createTestD1() {
  const sqlite = new DatabaseSync(':memory:');

  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  const migrations = [
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0011_automation_safety.sql',
    '0017_auto_schedule_and_manual_hold.sql',
    '0018_publication_operator_audit.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  sqlite.exec(`
    INSERT OR IGNORE INTO categories (id, name, slug, color_badge) VALUES
    (1, 'Arsitektur & Renovasi', 'arsitektur-renovasi', '#2563eb');

    INSERT OR IGNORE INTO authors (id, name, slug, bio, role) VALUES
    (1, 'Dewan Redaksi Spasial', 'dewan-redaksi-spasial', 'Tim Kurasi', 'editor_in_chief');

    INSERT OR REPLACE INTO settings (key, value) VALUES
    ('site_url', 'https://rancangloka.com'),
    ('auto_schedule_enabled', 'false');

    INSERT OR REPLACE INTO automation_control (id, mode, kill_switch_engaged, kill_reason, updated_at, updated_by) VALUES
    (1, 'CONTROLLED', 0, NULL, datetime('now'), 'system_init');
  `);

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
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid)
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

function seedArticle(db, overrides = {}) {
  const contentMd = overrides.content_md || generateValidArticleBody();
  const contentHash = computeSha256(contentMd);
  const articleId = overrides.id || 301;
  const slug = overrides.slug || `fixture-artikel-reconcile-${articleId}`;
  const status = overrides.status || 'draft';
  const manualHold = overrides.manual_hold !== undefined ? overrides.manual_hold : 0;

  db.raw.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, featured_image, image_alt,
      status, content_hash, focus_keyword, reading_time_minutes,
      key_takeaways, manual_hold, published_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'https://images.unsplash.com/photo-test-valid.jpg', 'Alt visual fasad adaptif teruji', ?, ?, 'fasad adaptif', 3, '["Kisi kisi aluminium","Efisiensi energi","Ventilasi silang"]', ?, datetime('now'), datetime('now'))
  `).run(
    articleId,
    slug,
    overrides.title || `Uji Reconciler Artikel ${articleId}`,
    overrides.description || 'Deskripsi uji valid untuk reconciler auto policy ke eksekusi.',
    contentMd,
    `<p>${contentMd}</p>`,
    status,
    contentHash,
    manualHold
  );

  const assetId = overrides.asset_id || `ast_rec_${articleId}`;
  const mediaSha = computeSha256(`media_content_${articleId}`);
  db.raw.prepare(`
    INSERT INTO media_assets (
      asset_id, source_type, storage_key, public_url, mime_type, file_size, width, height,
      sha256, alt_text, status, created_at
    ) VALUES (?, 'lokamedia_extension', ?, ?, 'image/webp', 150000, 1200, 800, ?, 'Fasad modern', 'VALIDATED', CURRENT_TIMESTAMP)
  `).run(assetId, `media/${assetId}.webp`, `/media/${assetId}.webp`, mediaSha);

  db.raw.prepare(`
    INSERT INTO article_media (
      article_id, slot_key, asset_id, role, caption, is_active, created_at, updated_at
    ) VALUES (?, 'featured', ?, 'featured', 'Fasad modern', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(articleId, assetId);

  return { articleId, slug, contentHash, assetId };
}

async function seedAutoPolicyPlan(db, articleId, overrides = {}) {
  const readiness = await evaluateArticleReadiness(db, articleId);
  const planId = overrides.plan_id || `plan_rec_${articleId}`;
  const planStatus = overrides.plan_status || 'PLANNED';
  const schedulingMode = overrides.scheduling_mode || 'auto_policy';

  const art = db.raw.prepare('SELECT content_hash FROM articles WHERE id = ?').get(articleId);
  const media = db.raw.prepare("SELECT asset_id FROM article_media WHERE article_id = ? AND role = 'featured' AND is_active = 1").get(articleId);

  const contentHash = overrides.content_hash || art.content_hash;
  const assetId = overrides.featured_asset_id || media.asset_id;
  const readRow = db.raw.prepare('SELECT id FROM article_publication_readiness WHERE article_id = ? ORDER BY id DESC LIMIT 1').get(articleId);
  const readinessId = overrides.readiness_id !== undefined ? overrides.readiness_id : (readRow ? readRow.id : 1);

  db.raw.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, planner_version, priority_score, slot_index,
      jitter_seconds, reason_codes, scheduling_mode
    ) VALUES (?, ?, ?, ?, ?, datetime('now', '+1 hour'), '2026-09-22 10:00:00 WIB', 'Asia/Jakarta', ?, 'GROWING', '1.0.0', 50, 1, 0, '[]', ?)
  `).run(planId, articleId, readinessId, contentHash, assetId, planStatus, schedulingMode);

  return { planId, readinessId, contentHash, assetId };
}

async function runTests() {
  console.log('============================================================');
  console.log('RANCANGLOKA — PHASE 5L6A AUTO-POLICY RECONCILER TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // Test 1: Controlled happy path
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 401 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.status, 'success');
    assert.equal(res.processedCount, 1);
    assert.equal(res.scheduledCount, 1);
    assert.equal(res.reusedCount, 0);
    assert.equal(res.blockedCount, 0);
    assert.equal(res.failedCount, 0);
    assert.equal(res.plans[0].status, 'scheduled');
    assert.ok(res.plans[0].executionId);
    assert.equal(res.plans[0].executionMode, 'auto_schedule');

    // Verify execution in database
    const exec = db.raw.prepare('SELECT * FROM article_publication_executions WHERE plan_id = ?').get(planId);
    assert.ok(exec);
    assert.equal(exec.execution_status, 'SCHEDULED');
    assert.equal(exec.execution_mode, 'auto_schedule');

    // Article remains draft (NEVER published)
    const art = db.raw.prepare('SELECT status FROM articles WHERE id = ?').get(articleId);
    assert.equal(art.status, 'draft');

    // Zero approval rows created
    const approvals = db.raw.prepare('SELECT COUNT(*) as count FROM article_editorial_approvals WHERE article_id = ?').get(articleId);
    assert.equal(approvals.count, 0);

    pass('Test 1: Controlled happy path (draft, 0 approval rows, system_policy_pass=true -> SCHEDULED execution created, execution_mode=auto_schedule, article draft, 0 publication)');
  }

  // -------------------------------------------------------------
  // Test 2: Unattended promotion
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED' WHERE id = 1").run();
    const { articleId } = seedArticle(db, { id: 402 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.status, 'success');
    assert.equal(res.scheduledCount, 1);
    const exec = db.raw.prepare('SELECT * FROM article_publication_executions WHERE plan_id = ?').get(planId);
    assert.equal(exec.execution_status, 'SCHEDULED');

    // Article still remains draft (reconciler itself never publishes)
    const art = db.raw.prepare('SELECT status FROM articles WHERE id = ?').get(articleId);
    assert.equal(art.status, 'draft');

    pass('Test 2: Unattended promotion (automation mode=UNATTENDED promotes to SCHEDULED execution, reconciler does not publish)');
  }

  // -------------------------------------------------------------
  // Test 3: PLAN_ONLY block
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    db.raw.prepare("UPDATE automation_control SET mode = 'PLAN_ONLY' WHERE id = 1").run();
    const { articleId } = seedArticle(db, { id: 403 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.status, 'blocked');
    assert.equal(res.processedCount, 0);
    assert.equal(res.scheduledCount, 0);

    // Verify 0 executions created
    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 0);

    // Plan remains PLANNED
    const plan = db.raw.prepare('SELECT plan_status FROM article_publication_plans WHERE plan_id = ?').get(planId);
    assert.equal(plan.plan_status, 'PLANNED');

    pass('Test 3: PLAN_ONLY block (automation mode=PLAN_ONLY blocks execution promotion, plan remains PLANNED, 0 execution)');
  }

  // -------------------------------------------------------------
  // Test 4: OFF & OBSERVE_ONLY block
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 404 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    // OFF mode
    db.raw.prepare("UPDATE automation_control SET mode = 'OFF' WHERE id = 1").run();
    const resOff = await reconcileAutoPolicyPlansForExecution(db);
    assert.equal(resOff.status, 'blocked');
    assert.equal(resOff.scheduledCount, 0);

    // OBSERVE_ONLY mode
    db.raw.prepare("UPDATE automation_control SET mode = 'OBSERVE_ONLY' WHERE id = 1").run();
    const resObs = await reconcileAutoPolicyPlansForExecution(db);
    assert.equal(resObs.status, 'blocked');
    assert.equal(resObs.scheduledCount, 0);

    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 0);

    pass('Test 4: OFF & OBSERVE_ONLY block (OFF/OBSERVE_ONLY blocks execution promotion)');
  }

  // -------------------------------------------------------------
  // Test 5: Manual hold block
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 405, manual_hold: 1 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.status, 'success');
    assert.equal(res.blockedCount, 1);
    assert.equal(res.scheduledCount, 0);
    assert.equal(res.plans[0].status, 'blocked');
    assert.ok(res.plans[0].reason.includes('MANUAL_HOLD_ENGAGED'));

    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 0);

    pass('Test 5: Manual hold block (manual_hold=1 blocks promotion, plan remains PLANNED)');
  }

  // -------------------------------------------------------------
  // Test 6: Emergency kill switch block
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    db.raw.prepare("UPDATE automation_control SET kill_switch_engaged = 1, kill_reason = 'Emergency stop' WHERE id = 1").run();
    const { articleId } = seedArticle(db, { id: 406 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.status, 'blocked');
    assert.equal(res.reason, 'KILL_SWITCH_ENGAGED');
    assert.equal(res.scheduledCount, 0);

    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 0);

    pass('Test 6: Emergency kill switch block (kill_switch_engaged=1 blocks promotion)');
  }

  // -------------------------------------------------------------
  // Test 7: Stale content fail-closed
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 407 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    // Mutate content after plan creation
    db.raw.prepare("UPDATE articles SET content_hash = 'tampered_hash_after_plan' WHERE id = ?").run(articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.blockedCount, 1);
    assert.equal(res.scheduledCount, 0);
    assert.equal(res.plans[0].status, 'blocked');
    assert.ok(res.plans[0].reason.includes('CONTENT_HASH'));

    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 0);

    pass('Test 7: Stale content fail-closed (content changed after plan -> blocked)');
  }

  // -------------------------------------------------------------
  // Test 8: Stale media fail-closed
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 408 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    // Swap featured media asset after plan creation
    db.raw.prepare(`
      INSERT INTO media_assets (
        asset_id, source_type, storage_key, public_url, mime_type, file_size, width, height,
        sha256, alt_text, status, created_at
      ) VALUES ('ast_swapped_after_plan', 'lokamedia_extension', 'media/swap.webp', '/media/swap.webp', 'image/webp', 150000, 1200, 800, 'sha_swap', 'Alt swap', 'VALIDATED', CURRENT_TIMESTAMP)
    `).run();
    db.raw.prepare("UPDATE article_media SET asset_id = 'ast_swapped_after_plan' WHERE article_id = ? AND role = 'featured'").run(articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.blockedCount, 1);
    assert.equal(res.scheduledCount, 0);
    assert.equal(res.plans[0].status, 'blocked');
    assert.ok(res.plans[0].reason.includes('FEATURED_MEDIA'));

    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 0);

    pass('Test 8: Stale media fail-closed (featured media changed after plan -> blocked)');
  }

  // -------------------------------------------------------------
  // Test 9: Stale policy fail-closed
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 409 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    // Invalidate current system policy without mutating content_hash
    db.raw.prepare("UPDATE articles SET key_takeaways = '[]' WHERE id = ?").run(articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.blockedCount, 1);
    assert.equal(res.scheduledCount, 0);
    assert.equal(res.plans[0].status, 'blocked');
    assert.ok(res.plans[0].reason.includes('CURRENT_POLICY_FAILURE') || res.plans[0].reason.includes('CATEGORY_INVALID'));

    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 0);

    pass('Test 9: Stale policy fail-closed (stale system policy -> blocked)');
  }

  // -------------------------------------------------------------
  // Test 10: Global auto-schedule OFF does NOT invalidate existing plan
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    // settings.auto_schedule_enabled is 'false' by default
    const setting = db.raw.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
    assert.equal(setting.value, 'false');

    const { articleId } = seedArticle(db, { id: 410 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);

    assert.equal(res.status, 'success');
    assert.equal(res.scheduledCount, 1);
    assert.equal(res.plans[0].status, 'scheduled');

    const exec = db.raw.prepare('SELECT * FROM article_publication_executions WHERE plan_id = ?').get(planId);
    assert.ok(exec);
    assert.equal(exec.execution_status, 'SCHEDULED');

    pass('Test 10: Global auto-schedule OFF does NOT invalidate existing plan promotion (mode=CONTROLLED, auto_schedule_enabled=false -> promotion succeeds)');
  }

  // -------------------------------------------------------------
  // Test 11: Auto-policy only
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId: artId1 } = seedArticle(db, { id: 411 });
    const { articleId: artId2 } = seedArticle(db, { id: 412 });

    // Seed editorial_signoff plan and legacy plan
    await seedAutoPolicyPlan(db, artId1, { plan_id: 'plan_editorial_ignore', scheduling_mode: 'editorial_signoff' });
    await seedAutoPolicyPlan(db, artId2, { plan_id: 'plan_legacy_ignore', scheduling_mode: 'legacy' });

    const res = await reconcileAutoPolicyPlansForExecution(db);

    // Reconciler queries only scheduling_mode = 'auto_policy'
    assert.equal(res.processedCount, 0);
    assert.equal(res.scheduledCount, 0);

    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions').get().count;
    assert.equal(execCount, 0);

    pass('Test 11: Auto-policy only (editorial_signoff and legacy plans are NOT processed by reconciler)');
  }

  // -------------------------------------------------------------
  // Test 12: Reconciler idempotency
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 413 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    // First run: scheduled
    const res1 = await reconcileAutoPolicyPlansForExecution(db);
    assert.equal(res1.scheduledCount, 1);
    assert.equal(res1.reusedCount, 0);
    assert.equal(res1.plans[0].status, 'scheduled');
    const firstExecId = res1.plans[0].executionId;

    // Second run: reused
    const res2 = await reconcileAutoPolicyPlansForExecution(db);
    assert.equal(res2.scheduledCount, 0);
    assert.equal(res2.reusedCount, 1);
    assert.equal(res2.plans[0].status, 'reused');
    assert.equal(res2.plans[0].executionId, firstExecId);

    // Exactly 1 execution exists in database
    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 1);

    pass('Test 12: Reconciler idempotency (running twice produces exactly 1 execution, second run status=reused)');
  }

  // -------------------------------------------------------------
  // Test 13: Lost response recovery
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 414 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    // Pre-insert execution to simulate caller having lost response after insert
    db.raw.prepare(`
      INSERT INTO article_publication_executions (
        execution_id, plan_id, article_id, content_hash, featured_asset_id,
        target_publish_at, execution_status, publisher_version, execution_mode, created_at, updated_at
      ) VALUES (
        'pexec_lost_response_recovery', ?, ?, 'hash', 'ast',
        datetime('now', '+1 hour'), 'SCHEDULED', '1.0.0', 'auto_schedule', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(planId, articleId);

    const res = await reconcileAutoPolicyPlansForExecution(db);
    assert.equal(res.scheduledCount, 0);
    assert.equal(res.reusedCount, 1);
    assert.equal(res.plans[0].status, 'reused');
    assert.equal(res.plans[0].executionId, 'pexec_lost_response_recovery');

    pass('Test 13: Lost response recovery (pre-existing execution discovered and reused without error)');
  }

  // -------------------------------------------------------------
  // Test 14: Concurrent execution duplicate prevention
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 415 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    // Simulate two concurrent reconciler workers racing on the exact same plan
    const [resA, resB] = await Promise.all([
      reconcileAutoPolicyPlansForExecution(db),
      reconcileAutoPolicyPlansForExecution(db)
    ]);

    const totalScheduled = resA.scheduledCount + resB.scheduledCount;
    const totalReused = resA.reusedCount + resB.reusedCount;
    assert.equal(totalScheduled, 1, 'Exactly one worker successfully schedules the execution');
    assert.equal(totalReused, 1, 'The other worker safely reuses the execution');

    const execCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE plan_id = ?').get(planId).count;
    assert.equal(execCount, 1, 'Exactly one execution record exists in database');

    pass('Test 14: Concurrent execution duplicate prevention (concurrent promotion yields exactly 1 execution)');
  }

  // -------------------------------------------------------------
  // Test 15: Reconciler publication firewall
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 416 });
    await seedAutoPolicyPlan(db, articleId);

    await reconcileAutoPolicyPlansForExecution(db);

    // Article status MUST strictly remain 'draft'
    const art = db.raw.prepare('SELECT status, published_at FROM articles WHERE id = ?').get(articleId);
    assert.equal(art.status, 'draft');

    // 0 publication receipts
    const receiptsCount = db.raw.prepare('SELECT COUNT(*) as count FROM publication_execution_receipts').get().count;
    assert.equal(receiptsCount, 0);

    pass('Test 15: Reconciler publication firewall (0 articles published, articles.status remains draft)');
  }

  // -------------------------------------------------------------
  // Test 16: Human approval firewall
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 417 });
    await seedAutoPolicyPlan(db, articleId);

    await reconcileAutoPolicyPlansForExecution(db);

    // 0 approval rows created
    const approvalsCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_editorial_approvals WHERE article_id = ?').get(articleId).count;
    assert.equal(approvalsCount, 0);

    pass('Test 16: Human approval firewall (0 rows in article_editorial_approvals produced)');
  }

  // -------------------------------------------------------------
  // Test 17: Honest system audit attribution
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 418 });
    const { planId } = await seedAutoPolicyPlan(db, articleId);

    await reconcileAutoPolicyPlansForExecution(db);

    const event = db.raw.prepare('SELECT * FROM publication_plan_events WHERE plan_id = ? AND event_type = ?').get(planId, 'RESCHEDULED');
    assert.ok(event, 'Audit event must be logged');
    assert.equal(event.actor_id, RECONCILER_ACTOR_ID);
    const details = JSON.parse(event.details_json);
    assert.equal(details.actor_type, RECONCILER_ACTOR_TYPE);
    assert.equal(details.actor_id, RECONCILER_ACTOR_ID);
    assert.equal(details.execution_mode, 'auto_schedule');

    pass('Test 17: Honest system audit attribution (publication_plan_events has actor_type=system_policy, actor_id=auto_scheduler)');
  }

  // -------------------------------------------------------------
  // Test 18: Bounded batch limit
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId: a1 } = seedArticle(db, { id: 419 });
    const { articleId: a2 } = seedArticle(db, { id: 420 });
    const { articleId: a3 } = seedArticle(db, { id: 421 });

    await seedAutoPolicyPlan(db, a1);
    await seedAutoPolicyPlan(db, a2);
    await seedAutoPolicyPlan(db, a3);

    // Limit to batch of 2
    const res = await reconcileAutoPolicyPlansForExecution(db, { batchLimit: 2 });
    assert.equal(res.processedCount, 2);
    assert.equal(res.scheduledCount, 2);

    pass('Test 18: Bounded batch limit (batch limit respected)');
  }

  // -------------------------------------------------------------
  // Test 19: Per-plan failure isolation
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    // Article A has manual_hold = 1 (blocked)
    const { articleId: a1 } = seedArticle(db, { id: 422, manual_hold: 1 });
    await seedAutoPolicyPlan(db, a1, { plan_id: 'plan_held_422' });

    // Article B is normal and valid
    const { articleId: a2 } = seedArticle(db, { id: 423, manual_hold: 0 });
    await seedAutoPolicyPlan(db, a2, { plan_id: 'plan_valid_423' });

    const res = await reconcileAutoPolicyPlansForExecution(db);
    assert.equal(res.processedCount, 2);
    assert.equal(res.blockedCount, 1);
    assert.equal(res.scheduledCount, 1);

    const plan1Res = res.plans.find((p) => p.planId === 'plan_held_422');
    const plan2Res = res.plans.find((p) => p.planId === 'plan_valid_423');
    assert.equal(plan1Res.status, 'blocked');
    assert.equal(plan2Res.status, 'scheduled');

    pass('Test 19: Per-plan failure isolation (one held plan does not block another valid plan)');
  }

  // -------------------------------------------------------------
  // Test 20: Server trigger API & Media Device firewall
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 424 });
    await seedAutoPolicyPlan(db, articleId);

    // 1. Media device token request MUST be rejected with 403
    const fakeDeviceRequest = new Request('http://localhost/api/admin/publication/publish/reconcile', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer lkmd_extension_device_secret',
        'Content-Type': 'application/json'
      }
    });
    const deviceResp = await reconcilePostHandler({ request: fakeDeviceRequest, locals: { db } });
    assert.equal(deviceResp.status, 403);
    const deviceBody = await deviceResp.json();
    assert.equal(deviceBody.code, 'MEDIA_DEVICE_FORBIDDEN');

    // 2. Legitimate server-side trigger executes reconciler successfully
    const validRequest = new Request('http://localhost/api/admin/publication/publish/reconcile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ batchLimit: 5 })
    });
    const validResp = await reconcilePostHandler({ request: validRequest, locals: { db } });
    assert.equal(validResp.status, 200);
    const validBody = await validResp.json();
    assert.equal(validBody.status, 'success');
    assert.equal(validBody.result.scheduledCount, 1);

    // 3. GET inspects waiting plans
    const getRequest = new Request('http://localhost/api/admin/publication/publish/reconcile', {
      method: 'GET'
    });
    const getResp = await reconcileGetHandler({ request: getRequest, locals: { db }, url: new URL(getRequest.url) });
    assert.equal(getResp.status, 200);

    pass('Test 20: Server trigger API & Media Device firewall (media device rejected with 403, valid call succeeds)');
  }

  // -------------------------------------------------------------
  // Test 21: Live local Miniflare D1 read-only freeze audit
  // -------------------------------------------------------------
  {
    const d1Dir = path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    let d1SqlitePath = null;
    if (fs.existsSync(d1Dir)) {
      const files = fs.readdirSync(d1Dir).filter((f) => f.endsWith('.sqlite'));
      if (files.length > 0) d1SqlitePath = path.join(d1Dir, files[0]);
    }

    if (d1SqlitePath && fs.existsSync(d1SqlitePath)) {
      const liveDb = new DatabaseSync(d1SqlitePath, { readOnly: true });

      // 1. Article 1 freeze check
      const art1 = liveDb.prepare('SELECT id, status, COALESCE(manual_hold, 0) as manual_hold FROM articles WHERE id = 1').get();
      assert.ok(art1, 'Article 1 must exist');
      assert.equal(art1.status, 'draft', 'Article 1 must be draft');

      // 2. Article 3 freeze check
      const art3 = liveDb.prepare('SELECT id, status, COALESCE(manual_hold, 0) as manual_hold FROM articles WHERE id = 3').get();
      assert.ok(art3, 'Article 3 must exist');
      assert.equal(art3.status, 'draft', 'Article 3 must be draft');
      assert.equal(art3.manual_hold, 0, 'Article 3 manual_hold must be 0');

      const art3Approval = liveDb.prepare('SELECT approval_status FROM article_editorial_approvals WHERE article_id = 3 ORDER BY id DESC LIMIT 1').get();
      assert.equal(art3Approval?.approval_status, 'APPROVED');

      const art3Plans = liveDb.prepare('SELECT COUNT(*) as count FROM article_publication_plans WHERE article_id = 3').get().count;
      assert.equal(art3Plans, 0);

      const art3Execs = liveDb.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE article_id = 3').get().count;
      assert.equal(art3Execs, 0);

      // 3. Article 5 freeze check
      const art5 = liveDb.prepare('SELECT id, status, COALESCE(manual_hold, 0) as manual_hold FROM articles WHERE id = 5').get();
      if (art5) {
        assert.equal(art5.status, 'draft');
        assert.equal(art5.manual_hold, 1, 'Article 5 must remain held');

        const art5Plans = liveDb.prepare('SELECT plan_status FROM article_publication_plans WHERE article_id = 5').all();
        for (const p of art5Plans) {
          assert.equal(p.plan_status, 'CANCELLED', 'Article 5 plan must remain CANCELLED');
        }

        const art5Execs = liveDb.prepare('SELECT COUNT(*) as count FROM article_publication_executions WHERE article_id = 5').get().count;
        assert.equal(art5Execs, 0);

        const art5Approvals = liveDb.prepare('SELECT COUNT(*) as count FROM article_editorial_approvals WHERE article_id = 5').get().count;
        assert.equal(art5Approvals, 0);
      }

      // 4. Global Settings & Safety
      const autoScheduleSetting = liveDb.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
      assert.equal(autoScheduleSetting?.value, 'false', 'Real local auto_schedule_enabled MUST remain false');

      const autoControl = liveDb.prepare('SELECT kill_switch_engaged FROM automation_control WHERE id = 1').get();
      assert.equal(autoControl?.kill_switch_engaged, 0);

      pass('Test 21: Live local Miniflare D1 read-only freeze audit (Articles 1, 3, 5, settings, and kill switch)');
    } else {
      console.log('  SKIP Test 21 (Miniflare SQLite path not found in this environment)');
    }
  }

  console.log('\n============================================================');
  console.log(`ALL TESTS PASSED: ${passed}/21`);
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
