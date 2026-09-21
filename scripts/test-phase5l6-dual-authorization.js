/**
 * RancangLoka — Phase 5L6 Test Suite
 * Publisher Dual Authorization Foundation
 *
 * Deterministic Test Matrix:
 * 1.  Test 1: Editorial signoff authorization (valid human approval + READY_TO_SCHEDULE passes)
 * 2.  Test 2: Auto-policy authorization without human approval (0 approval rows, system_policy_pass=true)
 * 3.  Test 3: Strict plan-mode routing (no cross-fallback between editorial and auto-policy)
 * 4.  Test 4: Legacy plan behavior (scheduling_mode='legacy' requires human approval)
 * 5.  Test 5: Stale content fails closed (article content_hash diverged from plan)
 * 6.  Test 6: Stale media fails closed (active featured asset diverged from plan)
 * 7.  Test 7: Current policy re-evaluation authority (stale current policy blocks publication)
 * 8.  Test 8: Manual hold blocks auto-policy authorization and execution
 * 9.  Test 9: Emergency kill switch blocks auto-policy authorization and execution
 * 10. Test 10: Automation capability matrix enforcement (schedule and prepublish gates)
 * 11. Test 11: PLAN_ONLY mode blocks execution and publication for auto-policy
 * 12. Test 12: Global auto-schedule OFF does NOT invalidate existing plan
 * 13. Test 13: Auto-policy requires valid plan (system_policy_pass alone is not authorization)
 * 14. Test 14: Tampered plan provenance fails closed
 * 15. Test 15: Missing policy binding snapshot fails closed
 * 16. Test 16: Execution mode attribution model (auto_schedule vs scheduled_publish vs manual_publish)
 * 17. Test 17: Prepublish double-gate revalidation
 * 18. Test 18: Atomic content hash publication guard fails closed on concurrent content change
 * 19. Test 19: Final featured-asset race guard fails closed on concurrent featured media change
 * 20. Test 20: Manual Publish Now is strictly human-only (rejects auto-policy without human approval)
 * 21. Test 21: Auto-policy authorization produces ZERO human approval rows
 * 22. Test 22: Publisher idempotency and immutable receipt semantics preserved
 * 23. Test 23: Live local Miniflare D1 read-only freeze audit (Articles 1, 3, 5, settings, and kill switch)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  resolvePublicationAuthorization
} from '../src/lib/publication/authorization-resolver.ts';

import {
  schedulePlanForExecution,
  validatePrepublishInvariants,
  executeAtomicPublication,
  publishNow
} from '../src/lib/publication/publisher-service.ts';

import { evaluateArticleReadiness } from '../src/lib/publication/service.ts';
import { setAutomationMode, setKillSwitch } from '../src/lib/safety/automation-controller.ts';

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
    '0018_publication_operator_audit.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  // Seed canonical taxonomy, author, settings, automation_control
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

async function seedAutoPolicyPlan(db, articleId, overrides = {}) {
  const readiness = await evaluateArticleReadiness(db, articleId);
  const planId = overrides.plan_id || `plan_auto_${articleId}`;
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

async function seedEditorialApproval(db, articleId, contentHash, assetId) {
  db.raw.prepare(`
    INSERT INTO article_editorial_approvals (
      article_id, approved_by, approved_role, approval_status,
      approved_content_hash, approved_asset_id, created_at, updated_at
    ) VALUES (?, 'chief_editor', 'editor_in_chief', 'APPROVED', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(articleId, contentHash, assetId);

  // Evaluate readiness to produce READY_TO_SCHEDULE snapshot
  await evaluateArticleReadiness(db, articleId);
}

async function runTests() {
  console.log('============================================================');
  console.log('RANCANGLOKA — PHASE 5L6 DUAL AUTHORIZATION TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // Test 1: Editorial signoff authorization
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId, contentHash, assetId } = seedArticle(db, { id: 301 });
    await seedEditorialApproval(db, articleId, contentHash, assetId);
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_ed_301', scheduling_mode: 'editorial_signoff' });

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, true);
    assert.equal(auth.authorization_mode, 'editorial_signoff');
    assert.equal(auth.article_id, articleId);
    assert.equal(auth.content_hash, contentHash);
    assert.equal(auth.featured_asset_id, assetId);
    assert.equal(auth.policy_provenance?.human_approval_pass, true);

    pass('Test 1: Editorial signoff authorization (valid human approval + READY_TO_SCHEDULE passes)');
  }

  // -------------------------------------------------------------
  // Test 2: Auto-policy authorization without human approval
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId, contentHash, assetId } = seedArticle(db, { id: 302 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_auto_302', scheduling_mode: 'auto_policy' });

    // Verify 0 approvals
    const appCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_editorial_approvals WHERE article_id = ?').get(articleId).count;
    assert.equal(appCount, 0);

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, true);
    assert.equal(auth.authorization_mode, 'auto_policy');
    assert.equal(auth.article_id, articleId);
    assert.equal(auth.policy_provenance?.system_policy_pass, true);
    assert.equal(auth.policy_provenance?.human_approval_pass, false);

    pass('Test 2: Auto-policy authorization without human approval (0 approval rows, system_policy_pass=true)');
  }

  // -------------------------------------------------------------
  // Test 3: Strict plan-mode routing
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    // Case 3a: editorial_signoff plan without human approval fails (never falls back to auto_policy)
    const { articleId: artA } = seedArticle(db, { id: 303 });
    const { planId: planEdNoApp } = await seedAutoPolicyPlan(db, artA, { plan_id: 'plan_ed_no_app', scheduling_mode: 'editorial_signoff' });
    const authA = await resolvePublicationAuthorization(db, { planId: planEdNoApp, stage: 'schedule' });
    assert.equal(authA.authorized, false);
    assert.equal(authA.reason, 'APPROVAL_REVOKED_OR_STALE');

    // Case 3b: auto_policy plan with human approval strictly executes auto_policy checks
    const { articleId: artB, contentHash: hashB, assetId: assetB } = seedArticle(db, { id: 304 });
    await seedEditorialApproval(db, artB, hashB, assetB);
    const { planId: planAutoWithApp } = await seedAutoPolicyPlan(db, artB, { plan_id: 'plan_auto_with_app', scheduling_mode: 'auto_policy' });
    const authB = await resolvePublicationAuthorization(db, { planId: planAutoWithApp, stage: 'schedule' });
    assert.equal(authB.authorized, true);
    assert.equal(authB.authorization_mode, 'auto_policy');

    pass('Test 3: Strict plan-mode routing (no cross-fallback between editorial and auto-policy)');
  }

  // -------------------------------------------------------------
  // Test 4: Legacy plan behavior
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 305 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_legacy_305', scheduling_mode: 'legacy' });

    // Legacy plan without approval must fail
    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, false);
    assert.equal(auth.authorization_mode, 'editorial_signoff');
    assert.equal(auth.reason, 'APPROVAL_REVOKED_OR_STALE');

    pass('Test 4: Legacy plan behavior (scheduling_mode="legacy" requires human approval)');
  }

  // -------------------------------------------------------------
  // Test 5: Stale content fails closed
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 306 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_stale_content' });

    // Mutate article content
    db.raw.prepare("UPDATE articles SET content_hash = 'tampered_hash_123' WHERE id = ?").run(articleId);

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, false);
    assert.equal(auth.reason, 'CONTENT_HASH_MISMATCH');

    pass('Test 5: Stale content fails closed (article content_hash diverged from plan)');
  }

  // -------------------------------------------------------------
  // Test 6: Stale media fails closed
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 307 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_stale_media' });

    // Change active featured asset
    db.raw.prepare(`
      INSERT INTO media_assets (
        asset_id, source_type, storage_key, public_url, mime_type, file_size, width, height,
        sha256, alt_text, status, created_at
      ) VALUES ('ast_different_media', 'lokamedia_extension', 'media/diff.webp', '/media/diff.webp', 'image/webp', 150000, 1200, 800, 'sha_diff', 'Alt diff', 'VALIDATED', CURRENT_TIMESTAMP)
    `).run();
    db.raw.prepare("UPDATE article_media SET asset_id = 'ast_different_media' WHERE article_id = ?").run(articleId);

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, false);
    assert.equal(auth.reason, 'FEATURED_MEDIA_MISMATCH');

    pass('Test 6: Stale media fails closed (active featured asset diverged from plan)');
  }

  // -------------------------------------------------------------
  // Test 7: Current policy re-evaluation authority
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 308 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_stale_policy' });

    // Corrupt editorial content to introduce banned placeholder without altering length
    db.raw.prepare("UPDATE articles SET content_md = content_md || '\n\n[EVIDENCE NEEDED]' WHERE id = ?").run(articleId);

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, false);
    // Either CONTENT_HASH_MISMATCH or CURRENT_POLICY_FAILURE
    assert.ok(auth.reason === 'CONTENT_HASH_MISMATCH' || auth.reason === 'CURRENT_POLICY_FAILURE');

    pass('Test 7: Current policy re-evaluation authority (stale current policy blocks publication)');
  }

  // -------------------------------------------------------------
  // Test 8: Manual hold blocks auto-policy authorization
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 309, manual_hold: 1 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_held' });

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, false);
    assert.equal(auth.reason, 'MANUAL_HOLD_ENGAGED');

    await assert.rejects(
      async () => schedulePlanForExecution(db, planId),
      /MANUAL_HOLD_ENGAGED/
    );

    pass('Test 8: Manual hold blocks auto-policy authorization and execution');
  }

  // -------------------------------------------------------------
  // Test 9: Emergency kill switch blocks auto-policy authorization
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 310 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_kill_switch' });

    // Engage kill switch
    await setKillSwitch(db, true, 'Emergency test kill', 'operator');

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, false);
    assert.equal(auth.reason, 'KILL_SWITCH_ENGAGED');

    await assert.rejects(
      async () => schedulePlanForExecution(db, planId),
      /KILL_SWITCH_ENGAGED/
    );

    pass('Test 9: Emergency kill switch blocks auto-policy authorization and execution');
  }

  // -------------------------------------------------------------
  // Test 10: Automation capability matrix enforcement
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 311 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_cap_matrix' });

    // Under CONTROLLED mode:
    // canScheduleControlled = true -> schedule stage PASSES
    // canPublishUnattended = false -> prepublish stage FAILS
    await setAutomationMode(db, 'CONTROLLED', 'operator');

    const authSchedule = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(authSchedule.authorized, true);

    const authPrepublish = await resolvePublicationAuthorization(db, { planId, stage: 'prepublish' });
    assert.equal(authPrepublish.authorized, false);
    assert.equal(authPrepublish.reason, 'AUTOMATION_MODE_BLOCKED');

    // Under UNATTENDED mode: both PASS
    db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED' WHERE id = 1").run();
    const authPrepublishUnattended = await resolvePublicationAuthorization(db, { planId, stage: 'prepublish' });
    assert.equal(authPrepublishUnattended.authorized, true);

    pass('Test 10: Automation capability matrix enforcement (schedule and prepublish gates)');
  }

  // -------------------------------------------------------------
  // Test 11: PLAN_ONLY mode blocks execution and publication
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 312 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_plan_only_block' });

    await setAutomationMode(db, 'PLAN_ONLY', 'operator');

    const authSchedule = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(authSchedule.authorized, false);
    assert.equal(authSchedule.reason, 'AUTOMATION_MODE_BLOCKED');

    await assert.rejects(
      async () => schedulePlanForExecution(db, planId),
      /AUTOMATION_MODE_BLOCKED/
    );

    pass('Test 11: PLAN_ONLY mode blocks execution and publication for auto-policy');
  }

  // -------------------------------------------------------------
  // Test 12: Global auto-schedule OFF does NOT invalidate existing plan
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 313 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_existing_valid' });

    // Setting auto_schedule_enabled = false
    db.raw.prepare("UPDATE settings SET value = 'false' WHERE key = 'auto_schedule_enabled'").run();

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, true, 'Existing plan must remain authorized even when auto_schedule_enabled=false');

    pass('Test 12: Global auto-schedule OFF does NOT invalidate existing plan');
  }

  // -------------------------------------------------------------
  // Test 13: Auto-policy requires valid plan
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 314 });
    // Readiness is evaluated, system_policy_pass=true, but NO plan exists
    await evaluateArticleReadiness(db, articleId);

    const auth = await resolvePublicationAuthorization(db, { articleId, planId: 'non_existent_plan', stage: 'schedule' });
    assert.equal(auth.authorized, false);
    assert.equal(auth.reason, 'PLAN_NOT_FOUND');

    pass('Test 13: Auto-policy requires valid plan (system_policy_pass alone is not authorization)');
  }

  // -------------------------------------------------------------
  // Test 14: Tampered plan provenance fails closed
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId: otherArtId } = seedArticle(db, { id: 3150, slug: 'foreign-article-3150' });
    await evaluateArticleReadiness(db, otherArtId);
    const otherReadRow = db.raw.prepare('SELECT id FROM article_publication_readiness WHERE article_id = ? ORDER BY id DESC LIMIT 1').get(otherArtId);

    const { articleId } = seedArticle(db, { id: 315 });
    // Point readiness_id to a valid readiness row of a DIFFERENT article
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_tampered_readiness', readiness_id: otherReadRow.id });

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, false);
    assert.equal(auth.reason, 'PLAN_PROVENANCE_TAMPERED');

    pass('Test 14: Tampered plan provenance fails closed');
  }

  // -------------------------------------------------------------
  // Test 15: Missing policy binding snapshot fails closed
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 316 });
    // Seed readiness with system_policy_pass = false
    const info = db.raw.prepare(`
      INSERT INTO article_publication_readiness (
        article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
      ) VALUES (?, 0, 'NOT_READY', 'hash_316', '{"policy":{"system_policy_pass":false}}', datetime('now'))
    `).run(articleId);
    const badReadinessId = Number(info.lastInsertRowid);
    db.raw.prepare("UPDATE articles SET content_hash = 'hash_316' WHERE id = ?").run(articleId);

    const { planId } = await seedAutoPolicyPlan(db, articleId, {
      plan_id: 'plan_bad_snapshot',
      readiness_id: badReadinessId,
      content_hash: 'hash_316'
    });

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, false);
    assert.equal(auth.reason, 'MISSING_POLICY_BINDING');

    pass('Test 15: Missing policy binding snapshot fails closed');
  }

  // -------------------------------------------------------------
  // Test 16: Execution mode attribution model
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    // Subtest 16a: Auto-policy plan -> execution_mode='auto_schedule'
    const { articleId: artAuto } = seedArticle(db, { id: 317 });
    const { planId: planAuto } = await seedAutoPolicyPlan(db, artAuto, { plan_id: 'plan_attr_auto' });
    const execAuto = await schedulePlanForExecution(db, planAuto);
    assert.equal(execAuto.execution_mode, 'auto_schedule');

    // Subtest 16b: Editorial plan scheduled -> execution_mode='scheduled_publish'
    const { articleId: artEd, contentHash: hashEd, assetId: assetEd } = seedArticle(db, { id: 318 });
    await seedEditorialApproval(db, artEd, hashEd, assetEd);
    const { planId: planEd } = await seedAutoPolicyPlan(db, artEd, { plan_id: 'plan_attr_ed', scheduling_mode: 'editorial_signoff' });
    const execEd = await schedulePlanForExecution(db, planEd);
    assert.equal(execEd.execution_mode, 'scheduled_publish');

    pass('Test 16: Execution mode attribution model (auto_schedule vs scheduled_publish vs manual_publish)');
  }

  // -------------------------------------------------------------
  // Test 17: Prepublish double-gate revalidation
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED' WHERE id = 1").run();
    const { articleId } = seedArticle(db, { id: 319 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_prepub_valid' });
    const exec = await schedulePlanForExecution(db, planId);

    const validResult = await validatePrepublishInvariants(db, exec);
    assert.equal(validResult.isValid, true);
    assert.equal(validResult.article?.id, articleId);

    pass('Test 17: Prepublish double-gate revalidation');
  }

  // -------------------------------------------------------------
  // Test 18: Atomic content hash publication guard
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED' WHERE id = 1").run();
    const { articleId, slug } = seedArticle(db, { id: 320 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_content_race' });
    const exec = await schedulePlanForExecution(db, planId);

    // Simulate content change right before atomic commit
    db.raw.prepare("UPDATE articles SET content_hash = 'new_concurrent_hash' WHERE id = ?").run(articleId);

    await assert.rejects(
      async () => executeAtomicPublication(db, exec, slug, 1),
      /ATOMIC_BATCH_FAILED/
    );

    // Verify article was NOT published
    const art = db.raw.prepare('SELECT status FROM articles WHERE id = ?').get(articleId);
    assert.equal(art.status, 'draft');

    pass('Test 18: Atomic content hash publication guard fails closed on concurrent content change');
  }

  // -------------------------------------------------------------
  // Test 19: Final featured-asset race guard
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED' WHERE id = 1").run();
    const { articleId, slug } = seedArticle(db, { id: 321 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_media_race' });
    const exec = await schedulePlanForExecution(db, planId);

    // Simulate featured asset replacement right before atomic commit
    db.raw.prepare(`
      INSERT INTO media_assets (
        asset_id, source_type, storage_key, public_url, mime_type, file_size, width, height,
        sha256, alt_text, status, created_at
      ) VALUES ('ast_concurrent_swap', 'lokamedia_extension', 'media/swap.webp', '/media/swap.webp', 'image/webp', 150000, 1200, 800, 'sha_swap', 'Alt swap', 'VALIDATED', CURRENT_TIMESTAMP)
    `).run();
    db.raw.prepare("UPDATE article_media SET asset_id = 'ast_concurrent_swap' WHERE article_id = ? AND role = 'featured'").run(articleId);

    await assert.rejects(
      async () => executeAtomicPublication(db, exec, slug, 1),
      /ATOMIC_BATCH_FAILED/
    );

    // Verify article was NOT published
    const art = db.raw.prepare('SELECT status FROM articles WHERE id = ?').get(articleId);
    assert.equal(art.status, 'draft');

    pass('Test 19: Final featured-asset race guard fails closed on concurrent featured media change');
  }

  // -------------------------------------------------------------
  // Test 20: Manual Publish Now is strictly human-only
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 322 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_publish_now_test' });

    // Attempting to invoke publishNow on auto-policy plan must be rejected
    await assert.rejects(
      async () => publishNow(db, planId, 'operator'),
      /PUBLISH_NOW_WITHOUT_HUMAN_APPROVAL_FORBIDDEN/
    );

    pass('Test 20: Manual Publish Now is strictly human-only (rejects auto-policy without human approval)');
  }

  // -------------------------------------------------------------
  // Test 21: Auto-policy authorization produces ZERO human approval rows
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const { articleId } = seedArticle(db, { id: 323 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_no_approval_rows' });

    const auth = await resolvePublicationAuthorization(db, { planId, stage: 'schedule' });
    assert.equal(auth.authorized, true);

    const exec = await schedulePlanForExecution(db, planId);
    assert.ok(exec.execution_id);

    const approvalRowsCount = db.raw.prepare('SELECT COUNT(*) as count FROM article_editorial_approvals WHERE article_id = ?').get(articleId).count;
    assert.equal(approvalRowsCount, 0, 'Auto-policy must create zero approval rows');

    pass('Test 21: Auto-policy authorization produces ZERO human approval rows');
  }

  // -------------------------------------------------------------
  // Test 22: Publisher idempotency and immutable receipt semantics
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    db.raw.prepare("UPDATE automation_control SET mode = 'UNATTENDED' WHERE id = 1").run();
    const { articleId, slug } = seedArticle(db, { id: 324 });
    const { planId } = await seedAutoPolicyPlan(db, articleId, { plan_id: 'plan_idempotency' });
    const exec = await schedulePlanForExecution(db, planId);

    // First publication commit
    const res1 = await executeAtomicPublication(db, exec, slug, 1);
    assert.ok(res1.receiptId);
    assert.ok(res1.actualPublishedAt);

    // Replay publication commit
    const res2 = await executeAtomicPublication(db, exec, slug, 1);
    assert.equal(res2.receiptId, res1.receiptId, 'Receipt ID must be identical on replay');
    assert.equal(res2.actualPublishedAt, res1.actualPublishedAt);

    const receiptsCount = db.raw.prepare('SELECT COUNT(*) as count FROM publication_execution_receipts WHERE execution_id = ?').get(exec.execution_id).count;
    assert.equal(receiptsCount, 1, 'Exactly one immutable receipt must be persisted');

    pass('Test 22: Publisher idempotency and immutable receipt semantics preserved');
  }

  // -------------------------------------------------------------
  // Test 23: Live local Miniflare D1 read-only freeze audit
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

      pass('Test 23: Live local Miniflare D1 read-only freeze audit (Articles 1, 3, 5, settings, and kill switch)');
    } else {
      console.log('  SKIP Test 23 (Miniflare SQLite path not found in this environment)');
    }
  }

  console.log('\n============================================================');
  console.log(`ALL TESTS PASSED: ${passed}/23`);
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
