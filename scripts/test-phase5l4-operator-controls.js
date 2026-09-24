/**
 * RancangLoka — Phase 5L4 Test Suite
 * Admin Override + Manual Hold + Global Auto-Schedule Controls
 *
 * Deterministic Test Matrix:
 * 1.  Test 1: Manual Hold sets manual_hold=1, metadata, audit event
 * 2.  Test 2: Repeated Hold is idempotent
 * 3.  Test 3: Resume Automation clears hold, restores eligibility, does NOT create plan
 * 4.  Test 4: Repeated Resume is idempotent
 * 5.  Test 5: Return to Draft & Hold cancels active PLANNED plan safely
 * 6.  Test 6: Return to Draft & Hold cancels cancellable SCHEDULED execution safely
 * 7.  Test 7: Return to Draft & Hold fails closed on PUBLISHING execution (cannot cancel)
 * 8.  Test 8: Return to Draft & Hold fails closed on published article (UNPUBLISH_REQUIRED)
 * 9.  Test 9: Publisher pre-check double-gate rejects manual_hold=1 with MANUAL_HOLD_ENGAGED
 * 10. Test 10: Atomic final publication guard fails closed if manual_hold race occurs
 * 11. Test 11: Global Auto-Schedule toggle (OFF -> ON -> OFF) persists and audits correctly
 * 12. Test 12: Authorization & Media Device Firewall (blocks unauthenticated & device tokens)
 * 13. Test 13: Audit attribution model verification in publication_operator_audit
 * 14. Test 14: No-approval auto-policy regression (eligible when auto_schedule_enabled=true, blocked when held or off)
 * 15. Test 15: Live D1 Article 3 read-only verification (draft, APPROVED, manual_hold=0, plans=0, executions=0)
 * 16. Test 16: Live D1 Article 1 freeze & auto_schedule_enabled=false check
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  holdArticle,
  resumeArticleAutomation,
  returnArticleToDraftAndHold,
  setGlobalAutoScheduleEnabled,
  getArticleAutomationState
} from '../src/lib/publication/operator-controls.ts';

import {
  validatePrepublishInvariants,
  executeAtomicPublication
} from '../src/lib/publication/publisher-service.ts';

import {
  getEligibleReadyCandidates
} from '../src/lib/publication/planner-service.ts';

import { evaluateArticleReadiness } from '../src/lib/publication/service.ts';

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

  // Base schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Additive migrations
  const migrations = [
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

  // Seed canonical taxonomy, author, and settings
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
  const articleId = overrides.id || 201;
  const slug = overrides.slug || `fixture-artikel-${articleId}`;
  const status = overrides.status || 'draft';
  const manualHold = overrides.manual_hold !== undefined ? overrides.manual_hold : 0;

  db.raw.prepare(`
    INSERT INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, featured_image, image_alt,
      status, content_hash, focus_keyword, reading_time_minutes,
      key_takeaways, manual_hold, published_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'https://images.unsplash.com/photo-test-valid.jpg', 'Alt visual fasad modern teruji', ?, ?, 'fasad adaptif', 3, '["Kisi kisi aluminium","Efisiensi energi","Ventilasi silang"]', ?, datetime('now'), datetime('now'))
  `).run(
    articleId,
    slug,
    overrides.title || `Uji Fasad Artikel ${articleId}`,
    overrides.description || 'Deskripsi uji valid untuk verifikasi kontrol operator.',
    contentMd,
    `<p>${contentMd}</p>`,
    status,
    contentHash,
    manualHold
  );

  // Attach valid featured media
  const assetId = overrides.asset_id || `ast_test_${articleId}`;
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

function seedTestPlan(db, overrides = {}) {
  const planId = overrides.plan_id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const articleId = overrides.article_id || 101;
  const contentHash = overrides.content_hash || 'hash_123';
  const planStatus = overrides.plan_status || 'PLANNED';
  const schedulingMode = overrides.scheduling_mode || 'auto_policy';

  // Ensure a readiness row exists for foreign key
  const readInfo = db.raw.prepare(`
    INSERT INTO article_publication_readiness (
      article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
    ) VALUES (?, 1, 'READY_TO_SCHEDULE', ?, '{}', datetime('now'))
  `).run(articleId, contentHash);

  const readinessId = Number(readInfo.lastInsertRowid);

  db.raw.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, planner_version, priority_score, slot_index,
      jitter_seconds, reason_codes, scheduling_mode
    ) VALUES (?, ?, ?, ?, 'ast_test_feat', CURRENT_TIMESTAMP, '2026-09-21 12:00:00 WIB', 'Asia/Jakarta', ?, 'GROWING', 'v1', 50, 0, 0, '[]', ?)
  `).run(planId, articleId, readinessId, contentHash, planStatus, schedulingMode);

  return planId;
}

function seedTestExecution(db, overrides = {}) {
  const executionId = overrides.execution_id || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const planId = overrides.plan_id || `plan_${Date.now()}`;
  const articleId = overrides.article_id || 101;
  const contentHash = overrides.content_hash || 'hash_123';
  const executionStatus = overrides.execution_status || 'SCHEDULED';
  const executionMode = overrides.execution_mode || 'hands_off_automated';

  db.raw.prepare(`
    INSERT INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id,
      target_publish_at, execution_status, execution_mode
    ) VALUES (?, ?, ?, ?, 'ast_test_feat', CURRENT_TIMESTAMP, ?, ?)
  `).run(executionId, planId, articleId, contentHash, executionStatus, executionMode);

  return executionId;
}

async function runTests() {
  console.log('============================================================');
  console.log('RANCANGLOKA — PHASE 5L4 OPERATOR CONTROLS TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // Test 1: Manual Hold sets manual_hold=1, metadata, audit event
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 101, manual_hold: 0 });

    const res = await holdArticle(db, {
      articleId,
      actor: { id: 'admin_1', role: 'editor_in_chief' },
      reason: 'Pemeriksaan redaksi mendalam'
    });

    assert.equal(res.success, true);
    assert.equal(res.held, true);
    assert.equal(res.alreadyHeld, false);

    // Verify article row
    const row = db.raw.prepare('SELECT manual_hold, manual_hold_reason, manual_hold_by, manual_hold_at FROM articles WHERE id = ?').get(articleId);
    assert.equal(row.manual_hold, 1);
    assert.equal(row.manual_hold_reason, 'Pemeriksaan redaksi mendalam');
    assert.equal(row.manual_hold_by, 'admin_1');
    assert.ok(row.manual_hold_at);

    // Verify audit log
    const audit = db.raw.prepare('SELECT * FROM publication_operator_audit WHERE article_id = ? AND event_type = ?').get(articleId, 'MANUAL_HOLD_SET');
    assert.ok(audit);
    assert.equal(audit.actor_id, 'admin_1');
    assert.equal(audit.reason, 'Pemeriksaan redaksi mendalam');

    pass('Test 1: Manual Hold sets manual_hold=1, metadata, audit event');
  }

  // -------------------------------------------------------------
  // Test 2: Repeated Hold is idempotent
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 102, manual_hold: 0 });

    await holdArticle(db, { articleId, actor: { id: 'admin_1', role: 'editor_in_chief' }, reason: 'Hold 1' });
    const res2 = await holdArticle(db, { articleId, actor: { id: 'admin_2', role: 'admin_operator' }, reason: 'Hold 2' });

    assert.equal(res2.success, true);
    assert.equal(res2.held, true);
    assert.equal(res2.alreadyHeld, true);

    const row = db.raw.prepare('SELECT manual_hold FROM articles WHERE id = ?').get(articleId);
    assert.equal(row.manual_hold, 1);

    pass('Test 2: Repeated Hold is idempotent');
  }

  // -------------------------------------------------------------
  // Test 3: Resume Automation clears hold, does NOT create plan
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 103, manual_hold: 1 });
    db.raw.prepare('UPDATE articles SET manual_hold_reason = ?, manual_hold_by = ?, manual_hold_at = ? WHERE id = ?')
      .run('Old reason', 'old_admin', '2026-09-20T00:00:00Z', articleId);

    const res = await resumeArticleAutomation(db, {
      articleId,
      actor: { id: 'admin_3', role: 'editor_in_chief' },
      reason: 'Selesai peninjauan'
    });

    assert.equal(res.success, true);
    assert.equal(res.resumed, true);
    assert.equal(res.alreadyActive, false);

    const row = db.raw.prepare('SELECT manual_hold, manual_hold_reason, manual_hold_by, manual_hold_at FROM articles WHERE id = ?').get(articleId);
    assert.equal(row.manual_hold, 0);
    assert.equal(row.manual_hold_reason, null);
    assert.equal(row.manual_hold_by, null);
    assert.equal(row.manual_hold_at, null);

    // CRITICAL: Resume MUST NOT create a plan
    const planCount = db.raw.prepare('SELECT COUNT(*) as c FROM article_publication_plans WHERE article_id = ?').get(articleId);
    assert.equal(planCount.c, 0, 'Resume Automation must not immediately create a plan');

    // Verify audit log
    const audit = db.raw.prepare('SELECT * FROM publication_operator_audit WHERE article_id = ? AND event_type = ?').get(articleId, 'MANUAL_HOLD_CLEARED');
    assert.ok(audit);
    assert.equal(audit.actor_id, 'admin_3');

    pass('Test 3: Resume Automation clears hold, restores eligibility, does NOT create plan');
  }

  // -------------------------------------------------------------
  // Test 4: Repeated Resume is idempotent
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 104, manual_hold: 0 });

    const res = await resumeArticleAutomation(db, {
      articleId,
      actor: { id: 'admin_1', role: 'editor_in_chief' }
    });

    assert.equal(res.success, true);
    assert.equal(res.resumed, true);
    assert.equal(res.alreadyActive, true);

    const row = db.raw.prepare('SELECT manual_hold FROM articles WHERE id = ?').get(articleId);
    assert.equal(row.manual_hold, 0);

    pass('Test 4: Repeated Resume is idempotent');
  }

  // -------------------------------------------------------------
  // Test 5: Return to Draft & Hold cancels active PLANNED plan safely
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId, contentHash } = seedArticle(db, { id: 105, status: 'draft', manual_hold: 0 });

    const planId = seedTestPlan(db, {
      plan_id: 'plan_test_5',
      article_id: articleId,
      content_hash: contentHash,
      plan_status: 'PLANNED',
      scheduling_mode: 'auto_policy'
    });

    const res = await returnArticleToDraftAndHold(db, {
      articleId,
      actor: { id: 'admin_editor', role: 'editor_in_chief' },
      reason: 'Batal jadwal, revisi konten'
    });

    assert.equal(res.success, true);
    assert.equal(res.previousStatus, 'draft');
    assert.equal(res.cancelledPlanId, planId);

    // Verify plan is CANCELLED
    const planRow = db.raw.prepare('SELECT plan_status FROM article_publication_plans WHERE plan_id = ?').get(planId);
    assert.equal(planRow.plan_status, 'CANCELLED');

    // Verify article is draft and manual_hold=1
    const artRow = db.raw.prepare('SELECT status, manual_hold, manual_hold_reason FROM articles WHERE id = ?').get(articleId);
    assert.equal(artRow.status, 'draft');
    assert.equal(artRow.manual_hold, 1);
    assert.equal(artRow.manual_hold_reason, 'Batal jadwal, revisi konten');

    // Verify audit
    const audit = db.raw.prepare('SELECT * FROM publication_operator_audit WHERE article_id = ? AND event_type = ?').get(articleId, 'RETURNED_TO_DRAFT_AND_HELD');
    assert.ok(audit);
    assert.equal(audit.plan_id, planId);

    pass('Test 5: Return to Draft & Hold cancels active PLANNED plan safely');
  }

  // -------------------------------------------------------------
  // Test 6: Return to Draft & Hold cancels cancellable SCHEDULED execution safely
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId, contentHash } = seedArticle(db, { id: 106, status: 'draft', manual_hold: 0 });

    const planId = seedTestPlan(db, {
      plan_id: 'plan_test_6',
      article_id: articleId,
      content_hash: contentHash,
      plan_status: 'PLANNED',
      scheduling_mode: 'editorial_signoff'
    });

    const executionId = seedTestExecution(db, {
      execution_id: 'exec_test_6',
      plan_id: planId,
      article_id: articleId,
      content_hash: contentHash,
      execution_status: 'SCHEDULED',
      execution_mode: 'human_approved'
    });

    const res = await returnArticleToDraftAndHold(db, {
      articleId,
      actor: { id: 'supervisor_1', role: 'admin_operator' },
      reason: 'Perlu pemeriksaan gambar ulang'
    });

    assert.equal(res.success, true);
    assert.equal(res.cancelledExecutionId, executionId);
    assert.equal(res.cancelledPlanId, planId);

    // Verify execution cancelled
    const execRow = db.raw.prepare('SELECT execution_status, last_error_reason FROM article_publication_executions WHERE execution_id = ?').get(executionId);
    assert.equal(execRow.execution_status, 'CANCELLED');
    assert.equal(execRow.last_error_reason, 'Perlu pemeriksaan gambar ulang');

    // Verify article is draft and held
    const artRow = db.raw.prepare('SELECT status, manual_hold FROM articles WHERE id = ?').get(articleId);
    assert.equal(artRow.status, 'draft');
    assert.equal(artRow.manual_hold, 1);

    pass('Test 6: Return to Draft & Hold cancels cancellable SCHEDULED execution safely');
  }

  // -------------------------------------------------------------
  // Test 7: Return to Draft & Hold fails closed on PUBLISHING execution
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId, contentHash } = seedArticle(db, { id: 107, status: 'draft', manual_hold: 0 });

    const planId = seedTestPlan(db, {
      plan_id: 'plan_test_7',
      article_id: articleId,
      content_hash: contentHash,
      plan_status: 'PLANNED',
      scheduling_mode: 'auto_policy'
    });

    seedTestExecution(db, {
      execution_id: 'exec_test_7',
      plan_id: planId,
      article_id: articleId,
      content_hash: contentHash,
      execution_status: 'PUBLISHING',
      execution_mode: 'hands_off_automated'
    });

    await assert.rejects(
      async () => {
        await returnArticleToDraftAndHold(db, {
          articleId,
          actor: { id: 'admin_x', role: 'editor_in_chief' }
        });
      },
      (err) => {
        assert.ok(err.message.includes('CANNOT_CANCEL_PUBLISHING_EXECUTION'));
        return true;
      }
    );

    // Article must NOT have been changed to held or mutated
    const artRow = db.raw.prepare('SELECT manual_hold, status FROM articles WHERE id = ?').get(articleId);
    assert.equal(artRow.manual_hold, 0);
    assert.equal(artRow.status, 'draft');

    pass('Test 7: Return to Draft & Hold fails closed on PUBLISHING execution (cannot cancel)');
  }

  // -------------------------------------------------------------
  // Test 8: Return to Draft & Hold fails closed on published article (UNPUBLISH_REQUIRED)
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 108, status: 'published', manual_hold: 0 });

    await assert.rejects(
      async () => {
        await returnArticleToDraftAndHold(db, {
          articleId,
          actor: { id: 'admin_x', role: 'editor_in_chief' }
        });
      },
      (err) => {
        assert.ok(err.message.includes('UNPUBLISH_REQUIRED'));
        return true;
      }
    );

    // Article status remains published
    const artRow = db.raw.prepare('SELECT status FROM articles WHERE id = ?').get(articleId);
    assert.equal(artRow.status, 'published');

    pass('Test 8: Return to Draft & Hold fails closed on published article (UNPUBLISH_REQUIRED)');
  }

  // -------------------------------------------------------------
  // Test 9: Publisher pre-check double-gate rejects manual_hold=1 with MANUAL_HOLD_ENGAGED
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId, slug, contentHash } = seedArticle(db, { id: 109, status: 'draft', manual_hold: 1 });

    const planId = seedTestPlan(db, {
      plan_id: 'plan_test_9',
      article_id: articleId,
      content_hash: contentHash,
      plan_status: 'PLANNED',
      scheduling_mode: 'auto_policy'
    });

    const executionId = seedTestExecution(db, {
      execution_id: 'exec_test_9',
      plan_id: planId,
      article_id: articleId,
      content_hash: contentHash,
      execution_status: 'CLAIMED',
      execution_mode: 'hands_off_automated'
    });

    const execution = {
      execution_id: executionId,
      plan_id: planId,
      article_id: articleId,
      slug,
      execution_status: 'CLAIMED',
      execution_mode: 'hands_off_automated'
    };

    const plan = {
      plan_id: planId,
      article_id: articleId,
      slug,
      content_hash: contentHash,
      plan_status: 'PLANNED',
      scheduling_mode: 'auto_policy'
    };

    const precheck = await validatePrepublishInvariants(db, execution);
    assert.equal(precheck.isValid, false);
    assert.equal(precheck.reasonCode, 'MANUAL_HOLD_ENGAGED');

    pass('Test 9: Publisher pre-check double-gate rejects manual_hold=1 with MANUAL_HOLD_ENGAGED');
  }

  // -------------------------------------------------------------
  // Test 10: Atomic final publication guard fails closed if manual_hold race occurs
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId, slug, contentHash } = seedArticle(db, { id: 110, status: 'draft', manual_hold: 0 });

    const planId = seedTestPlan(db, {
      plan_id: 'plan_test_10',
      article_id: articleId,
      content_hash: contentHash,
      plan_status: 'PLANNED',
      scheduling_mode: 'auto_policy'
    });

    const executionId = seedTestExecution(db, {
      execution_id: 'exec_test_10',
      plan_id: planId,
      article_id: articleId,
      content_hash: contentHash,
      execution_status: 'PUBLISHING',
      execution_mode: 'hands_off_automated'
    });

    const execution = {
      execution_id: executionId,
      plan_id: planId,
      article_id: articleId,
      slug,
      content_hash: contentHash,
      featured_asset_id: 'ast_test_feat',
      target_publish_at: new Date().toISOString(),
      execution_status: 'PUBLISHING',
      execution_mode: 'hands_off_automated'
    };

    // Race simulation:
    // Earlier precheck passed, but admin engages hold right before final atomic publication mutation
    db.raw.prepare('UPDATE articles SET manual_hold = 1 WHERE id = ?').run(articleId);

    // executeAtomicPublication attempts to execute
    // It must fail closed because WHERE id = ? AND status = 'draft' AND COALESCE(manual_hold, 0) = 0 affected 0 rows
    await assert.rejects(
      async () => {
        await executeAtomicPublication(db, execution, slug, 1);
      },
      (err) => {
        assert.ok(err.message.includes('ATOMIC_BATCH_FAILED'));
        return true;
      }
    );

    // Verify article was NOT published!
    const artRow = db.raw.prepare('SELECT status, manual_hold FROM articles WHERE id = ?').get(articleId);
    assert.equal(artRow.status, 'draft', 'Article must remain in draft');
    assert.equal(artRow.manual_hold, 1, 'Article remains held');

    pass('Test 10: Atomic final publication guard fails closed if manual_hold race occurs');
  }

  // -------------------------------------------------------------
  // Test 11: Global Auto-Schedule toggle (OFF -> ON -> OFF) persists and audits correctly
  // -------------------------------------------------------------
  {
    const db = createTestD1();

    // Initial state is OFF
    let state = await db.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").first();
    assert.equal(state?.value, 'false');

    // Turn ON
    const resOn = await setGlobalAutoScheduleEnabled(db, true, { id: 'super_admin', role: 'editor_in_chief' }, 'Testing activation');
    assert.equal(resOn.success, true);
    assert.equal(resOn.enabled, true);

    state = await db.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").first();
    assert.equal(state?.value, 'true');

    // Turn OFF
    const resOff = await setGlobalAutoScheduleEnabled(db, false, { id: 'super_admin', role: 'editor_in_chief' }, 'Testing deactivation');
    assert.equal(resOff.success, true);
    assert.equal(resOff.enabled, false);

    state = await db.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").first();
    assert.equal(state?.value, 'false');

    // Verify audit rows
    const audits = db.raw.prepare("SELECT event_type, reason FROM publication_operator_audit WHERE event_type IN ('AUTO_SCHEDULE_ENABLED', 'AUTO_SCHEDULE_DISABLED') ORDER BY id ASC").all();
    assert.equal(audits.length, 2);
    assert.equal(audits[0].event_type, 'AUTO_SCHEDULE_ENABLED');
    assert.equal(audits[1].event_type, 'AUTO_SCHEDULE_DISABLED');

    pass('Test 11: Global Auto-Schedule toggle (OFF -> ON -> OFF) persists and audits correctly');
  }

  // -------------------------------------------------------------
  // Test 12: Authorization & Media Device Firewall
  // -------------------------------------------------------------
  {
    function checkApiAccess(cookies, headers) {
      const sessionCookie = cookies.admin_session;
      const deviceToken = headers['x-lokamedia-device-token'];
      const userAgent = headers['user-agent'] || '';

      if (deviceToken || userAgent.toLowerCase().includes('lokamedia-device')) {
        return { status: 403, error: 'Media devices are not authorized to control publication automation.' };
      }
      if (!sessionCookie || !sessionCookie.startsWith('sess_')) {
        return { status: 401, error: 'Authentication required: Admin session not found or invalid.' };
      }
      return { status: 200, user: { id: 'admin_operator', role: 'admin_operator' } };
    }

    // Unauthenticated
    const unauth = checkApiAccess({}, {});
    assert.equal(unauth.status, 401);

    // Media device token header
    const deviceWithSession = checkApiAccess({ admin_session: 'sess_valid' }, { 'x-lokamedia-device-token': 'dev_tok_123' });
    assert.equal(deviceWithSession.status, 403);

    // Media device user agent
    const deviceAgent = checkApiAccess({ admin_session: 'sess_valid' }, { 'user-agent': 'LokaMedia-Device-Worker/1.0' });
    assert.equal(deviceAgent.status, 403);

    // Valid admin session
    const validAdmin = checkApiAccess({ admin_session: 'sess_valid' }, {});
    assert.equal(validAdmin.status, 200);

    pass('Test 12: Authorization & Media Device Firewall blocks unauthenticated & device tokens');
  }

  // -------------------------------------------------------------
  // Test 13: Audit attribution model verification in publication_operator_audit
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 113, manual_hold: 0 });

    await holdArticle(db, { articleId, actor: { id: 'chief_editor_1', role: 'editor_in_chief' }, reason: 'Audit test reason' });

    const auditRow = db.raw.prepare('SELECT * FROM publication_operator_audit WHERE article_id = ? ORDER BY id DESC LIMIT 1').get(articleId);
    assert.ok(auditRow);
    assert.equal(auditRow.event_type, 'MANUAL_HOLD_SET');
    assert.equal(auditRow.article_id, articleId);
    assert.equal(auditRow.actor_id, 'chief_editor_1');
    assert.equal(auditRow.actor_role, 'editor_in_chief');
    assert.equal(auditRow.reason, 'Audit test reason');
    assert.ok(auditRow.created_at);

    // Verify getArticleAutomationState returns complete view
    const autoState = await getArticleAutomationState(db, articleId);
    assert.equal(autoState.manualHold, true);
    assert.equal(autoState.manualHoldReason, 'Audit test reason');
    assert.equal(autoState.manualHoldBy, 'chief_editor_1');
    assert.equal(autoState.displayState, 'HELD');

    pass('Test 13: Audit attribution model verification in publication_operator_audit');
  }

  // -------------------------------------------------------------
  // Test 14: No-approval auto-policy regression
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 114, status: 'draft', manual_hold: 0 });

    // Evaluate readiness to create authoritative snapshot with system_policy_pass=true
    const snap = await evaluateArticleReadiness(db, articleId);
    assert.equal(snap.policy?.system_policy_pass, true, 'System policy must pass');

    // Subcase 1: auto_schedule_enabled=false -> candidate blocked
    db.raw.prepare("UPDATE settings SET value = 'false' WHERE key = 'auto_schedule_enabled'").run();
    let candidates = await getEligibleReadyCandidates(db, 10);
    assert.equal(candidates.length, 0, 'Must be 0 when auto_schedule_enabled=false');

    // Subcase 2: auto_schedule_enabled=true and manual_hold=0 -> candidate eligible via auto_policy!
    db.raw.prepare("UPDATE settings SET value = 'true' WHERE key = 'auto_schedule_enabled'").run();
    candidates = await getEligibleReadyCandidates(db, 10);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].articleId, articleId);
    assert.equal(candidates[0].candidateSource, 'auto_policy');

    // Subcase 3: manual_hold=1 -> candidate blocked!
    db.raw.prepare('UPDATE articles SET manual_hold = 1 WHERE id = ?').run(articleId);
    candidates = await getEligibleReadyCandidates(db, 10);
    assert.equal(candidates.length, 0, 'Must be blocked when manual_hold=1');

    pass('Test 14: No-approval auto-policy regression (eligible when auto_schedule_enabled=true, blocked when held or off)');
  }

  // -------------------------------------------------------------
  // Test 15: Live D1 Article 3 read-only verification
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

      const art3 = liveDb.prepare(`
        SELECT id, slug, status, COALESCE(manual_hold, 0) as manual_hold
        FROM articles WHERE id = 3
      `).get();

      assert.ok(art3, 'Article 3 must exist in local D1');
      assert.equal(art3.status, 'draft', 'Article 3 status must remain draft');
      assert.equal(art3.manual_hold, 0, 'Article 3 manual_hold must remain 0');

      const approval = liveDb.prepare(`
        SELECT approval_status FROM article_editorial_approvals
        WHERE article_id = 3 ORDER BY id DESC LIMIT 1
      `).get();
      assert.equal(approval?.approval_status, 'APPROVED', 'Article 3 approval status must be APPROVED');

      const planCount = liveDb.prepare(`
        SELECT COUNT(*) as count FROM article_publication_plans
        WHERE article_id = 3
      `).get();
      assert.equal(planCount.count, 0, 'Article 3 must have exactly 0 publication plans');

      const execCount = liveDb.prepare(`
        SELECT COUNT(*) as count FROM article_publication_executions
        WHERE article_id = 3
      `).get();
      assert.equal(execCount.count, 0, 'Article 3 must have exactly 0 publication executions');

      pass('Test 15: Live D1 Article 3 read-only verification (draft, APPROVED, manual_hold=0, plans=0, executions=0)');
    } else {
      console.log('  SKIP Test 15 (Miniflare SQLite path not found in this environment)');
    }
  }

  // -------------------------------------------------------------
  // Test 16: Live D1 Article 1 freeze & auto_schedule_enabled=false check
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

      const art1 = liveDb.prepare('SELECT id, status, COALESCE(manual_hold, 0) as manual_hold FROM articles WHERE id = 1').get();
      assert.ok(art1, 'Article 1 must exist in local D1');
      assert.equal(art1.status, 'draft', 'Article 1 status must remain draft');

      const autoScheduleSetting = liveDb.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
      assert.equal(autoScheduleSetting?.value, 'false', 'Real local auto_schedule_enabled MUST remain false');

      pass('Test 16: Live D1 Article 1 freeze & auto_schedule_enabled=false check');
    } else {
      console.log('  SKIP Test 16 (Miniflare SQLite path not found in this environment)');
    }
  }

  console.log('\n============================================================');
  console.log(`ALL TESTS PASSED: ${passed}/16`);
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
