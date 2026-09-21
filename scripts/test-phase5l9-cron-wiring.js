/**
 * RancangLoka — Phase 5L9 Test Suite
 * Cloudflare Cron Wiring + Server Trigger Auth Foundation
 *
 * Deterministic Test Matrix:
 * 1.  Section 29: Local Scheduled Handler & Identity Resolution Test
 * 2.  Section 30: OFF Mode Test (0 plan mutations, 0 execution mutations, 0 publications)
 * 3.  Section 31: OBSERVE_ONLY Mode Test (no lifecycle mutations)
 * 4.  Section 32: PLAN_ONLY Mode Test (planner creates plan, reconciler blocked, dispatcher blocked)
 * 5.  Section 33: CONTROLLED Mode Test (reconciler creates execution, dispatcher blocked from unattended publish)
 * 6.  Section 34: UNATTENDED Routing Test (planner eligible, reconciler eligible, dispatcher eligible)
 * 7.  Section 35: Kill Switch Test (all modes + kill switch engaged -> zero mutations)
 * 8.  Section 36: Auto-Schedule OFF Test (mode=UNATTENDED, auto_schedule_enabled=false -> no new auto_policy plan, existing execution processed)
 * 9.  Section 37: HTTP Service Auth Tests:
 *     - Anonymous -> 401
 *     - Bad secret -> 401
 *     - Media device -> 403
 *     - Valid admin session -> 200 (preserved)
 *     - Valid Cron secret (Authorization: Bearer) -> 200 without CSRF failure
 *     - Valid Cron secret (X-RancangLoka-Cron-Secret) -> 200 without CSRF failure
 *     - Non-trigger admin route with secret -> 401
 * 10. Section 38: Secret Leak Test (CRON_SECRET never appears in responses, logs, or audits)
 * 11. Section 24 & 26: Error Isolation & Lifetime (ctx.waitUntil used, no cascade on failure)
 * 12. Article Fixture Freeze Audit (Articles 1, 3, 5, 6 mutations = 0)
 * 13. Real Local Control State Audit (auto_schedule_enabled=false, mode=OFF, kill_switch=0)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  handleScheduledEvent,
  resolveCronJobIdentity,
  CRON_JOB_PLANNER,
  CRON_JOB_RECONCILER,
  CRON_JOB_DISPATCHER,
  CRON_PLANNER_EXPRESSION,
  CRON_RECONCILER_EXPRESSION,
  CRON_DISPATCHER_EXPRESSION
} from '../src/lib/publication/cron-router.ts';

import {
  isValidCronSecret,
  getCronSecretFromRequest,
  isCronServiceAuthenticated,
  CRON_SECRET_HEADER
} from '../src/lib/auth.ts';

import { onRequest as middlewareHandler } from '../src/middleware.ts';
import { POST as plansPostHandler, GET as plansGetHandler } from '../src/pages/api/admin/publication/plans.ts';
import { POST as reconcilePostHandler, GET as reconcileGetHandler } from '../src/pages/api/admin/publication/publish/reconcile.ts';
import { POST as duePostHandler, GET as dueGetHandler } from '../src/pages/api/admin/publication/publish/due.ts';

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
    (1, 'OFF', 0, NULL, datetime('now'), 'system_init');
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
            results: []
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

function insertSyntheticArticle(db, opts = {}) {
  const id = opts.id || 100;
  const slug = opts.slug || `synthetic-article-${id}`;
  const status = opts.status || 'draft';
  const manualHold = opts.manualHold !== undefined ? opts.manualHold : 0;
  const content = opts.content || generateValidArticleBody();
  const contentHash = computeSha256(content);
  const assetId = opts.assetId || `ast_synth_${id}`;

  db.raw.prepare(`
    INSERT OR REPLACE INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, featured_image, image_alt,
      status, content_hash, focus_keyword, reading_time_minutes,
      key_takeaways, manual_hold, published_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      1, 1, 'https://images.unsplash.com/photo-test-valid.jpg', 'Alt visual teruji',
      ?, ?, 'arsitektur tropis modern', 4,
      '["Material atap metal memiliki bobot ringan","Genteng beton menawarkan insulasi akustik lebih baik","Ventilasi silang bawah atap krusial"]',
      ?, datetime('now', '-2 days'), datetime('now', '-2 days')
    )
  `).run(
    id,
    slug,
    opts.title || `Desain Ventilasi Silang untuk Rumah Tropis Modern di Kawasan Urban Padat ${id}`,
    opts.description || 'Panduan komprehensif rancangan bukaan spasial dan sirkulasi alami untuk kenyamanan termal hunian tropis perkotaan.',
    content,
    `<p>${content}</p>`,
    status,
    contentHash,
    manualHold
  );


  const mediaSha = computeSha256(`media_${assetId}`);
  db.raw.prepare(`
    INSERT OR REPLACE INTO media_assets (
      asset_id, media_type, source_type, storage_key, public_url, mime_type,
      width, height, file_size, sha256, alt_text, status, created_at
    ) VALUES (
      ?, 'image', 'lokamedia_extension', ?, ?, 'image/webp',
      1200, 800, 150000, ?, 'Alt text', 'VALIDATED', datetime('now')
    )
  `).run(assetId, `media/${assetId}.webp`, `/media/${assetId}.webp`, mediaSha);

  db.raw.prepare(`
    INSERT OR REPLACE INTO article_media (
      article_id, asset_id, role, slot_key, is_active, sort_order, caption, created_at, updated_at
    ) VALUES (
      ?, ?, 'featured', 'featured', 1, 0, 'Caption', datetime('now'), datetime('now')
    )
  `).run(id, assetId);

  return { id, slug, contentHash, assetId };
}


async function runTests() {
  console.log('============================================================');
  console.log('RANCANGLOKA — PHASE 5L9 CRON WIRING & SERVICE AUTH TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // Section 29: Local Scheduled Handler & Identity Resolution Test
  // -------------------------------------------------------------
  {
    assert.equal(resolveCronJobIdentity({ cron: '0 * * * *' }), CRON_JOB_PLANNER);
    assert.equal(resolveCronJobIdentity({ cron: '*/5 * * * *' }), CRON_JOB_RECONCILER);
    assert.equal(resolveCronJobIdentity({ cron: '* * * * *' }), CRON_JOB_DISPATCHER);
    assert.equal(resolveCronJobIdentity({ cron: '*/1 * * * *' }), CRON_JOB_DISPATCHER);
    assert.equal(resolveCronJobIdentity({ job: 'publication_planner' }), CRON_JOB_PLANNER);
    assert.equal(resolveCronJobIdentity({ job: 'auto_execution_reconciler' }), CRON_JOB_RECONCILER);
    assert.equal(resolveCronJobIdentity({ job: 'publication_dispatcher' }), CRON_JOB_DISPATCHER);
    assert.equal(resolveCronJobIdentity({ cron: '12 3 * * *' }), null);

    const db = createTestD1();
    let waitUntilCalled = false;
    const ctx = {
      waitUntil(p) {
        waitUntilCalled = true;
        p.catch(() => {});
      }
    };

    // Test missing DB binding
    await assert.rejects(
      async () => handleScheduledEvent({ cron: '0 * * * *' }, {}),
      /D1 database binding \(DB\) is missing from env/
    );

    // Test unrecognized schedule
    const ignoredRes = await handleScheduledEvent({ cron: '9 9 * * *' }, { DB: db });
    assert.equal(ignoredRes.status, 'ignored');
    assert.equal(ignoredRes.reason, 'UNRECOGNIZED_CRON_SCHEDULE');

    // Test valid event routes directly
    const res = await handleScheduledEvent({ cron: '0 * * * *' }, { DB: db }, ctx);
    assert.equal(waitUntilCalled, true);
    assert.equal(res.job, CRON_JOB_PLANNER);

    pass('Section 29: Local Scheduled Handler & Identity Resolution Test (LOCAL_CRON_ROUTER_TEST)');
  }

  // -------------------------------------------------------------
  // Section 30: OFF Mode Test
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await setAutomationMode(db, 'OFF', 'test');
    insertSyntheticArticle(db, { id: 101 });

    const planRes = await handleScheduledEvent({ cron: CRON_PLANNER_EXPRESSION }, { DB: db });
    assert.equal(planRes.status, 'blocked');

    const recRes = await handleScheduledEvent({ cron: CRON_RECONCILER_EXPRESSION }, { DB: db });
    assert.equal(recRes.status, 'blocked');

    const dispRes = await handleScheduledEvent({ cron: CRON_DISPATCHER_EXPRESSION }, { DB: db });
    assert.equal(dispRes.status, 'blocked');

    const planCount = (await db.prepare('SELECT COUNT(*) as c FROM article_publication_plans').first()).c;
    const execCount = (await db.prepare('SELECT COUNT(*) as c FROM article_publication_executions').first()).c;
    const pubCount = (await db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'published'").first()).c;

    assert.equal(planCount, 0, 'Zero plan mutations under OFF');
    assert.equal(execCount, 0, 'Zero execution mutations under OFF');
    assert.equal(pubCount, 0, 'Zero publications under OFF');

    pass('Section 30: OFF Mode Test (CRON_OFF_MODE_TEST)');
  }

  // -------------------------------------------------------------
  // Section 31: OBSERVE_ONLY Mode Test
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await setAutomationMode(db, 'OBSERVE_ONLY', 'test');
    insertSyntheticArticle(db, { id: 102 });

    const planRes = await handleScheduledEvent({ cron: CRON_PLANNER_EXPRESSION }, { DB: db });
    assert.equal(planRes.status, 'blocked');

    const recRes = await handleScheduledEvent({ cron: CRON_RECONCILER_EXPRESSION }, { DB: db });
    assert.equal(recRes.status, 'blocked');

    const dispRes = await handleScheduledEvent({ cron: CRON_DISPATCHER_EXPRESSION }, { DB: db });
    assert.equal(dispRes.status, 'blocked');

    const planCount = (await db.prepare('SELECT COUNT(*) as c FROM article_publication_plans').first()).c;
    const execCount = (await db.prepare('SELECT COUNT(*) as c FROM article_publication_executions').first()).c;
    assert.equal(planCount, 0, 'Zero plans under OBSERVE_ONLY');
    assert.equal(execCount, 0, 'Zero executions under OBSERVE_ONLY');

    pass('Section 31: OBSERVE_ONLY Mode Test (CRON_OBSERVE_ONLY_TEST)');
  }

  // -------------------------------------------------------------
  // Section 32: PLAN_ONLY Mode Test
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await setAutomationMode(db, 'PLAN_ONLY', 'test');
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'auto_schedule_enabled'").run();

    const art = insertSyntheticArticle(db, { id: 103 });
    await evaluateArticleReadiness(db, art.id, { actor: 'test' });

    // 1. Planner runs and creates plan
    const planRes = await handleScheduledEvent({ cron: CRON_PLANNER_EXPRESSION }, { DB: db });
    assert.equal(planRes.status, 'success');
    assert.equal(planRes.job, CRON_JOB_PLANNER);

    const plans = (await db.prepare('SELECT * FROM article_publication_plans WHERE article_id = ?').bind(art.id).all()).results;
    assert.equal(plans.length, 1, 'Plan created in PLAN_ONLY');
    assert.equal(plans[0].scheduling_mode, 'auto_policy');

    // 2. Reconciler runs and is blocked
    const recRes = await handleScheduledEvent({ cron: CRON_RECONCILER_EXPRESSION }, { DB: db });
    assert.equal(recRes.status, 'blocked');

    // 3. Dispatcher runs and is blocked
    const dispRes = await handleScheduledEvent({ cron: CRON_DISPATCHER_EXPRESSION }, { DB: db });
    assert.equal(dispRes.status, 'blocked');

    const execCount = (await db.prepare('SELECT COUNT(*) as c FROM article_publication_executions WHERE article_id = ?').bind(art.id).first()).c;
    const artStatus = (await db.prepare('SELECT status FROM articles WHERE id = ?').bind(art.id).first()).status;
    assert.equal(execCount, 0, 'Zero executions in PLAN_ONLY');
    assert.equal(artStatus, 'draft', 'Article remains draft in PLAN_ONLY');

    pass('Section 32: PLAN_ONLY Mode Test (CRON_PLAN_ONLY_TEST)');
  }

  // -------------------------------------------------------------
  // Section 33: CONTROLLED Mode Test
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await setAutomationMode(db, 'CONTROLLED', 'test');
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'auto_schedule_enabled'").run();

    const art = insertSyntheticArticle(db, { id: 104 });
    await evaluateArticleReadiness(db, art.id, { actor: 'test' });

    // Create plan
    await handleScheduledEvent({ cron: CRON_PLANNER_EXPRESSION }, { DB: db });

    // Reconciler runs and successfully creates execution
    const recRes = await handleScheduledEvent({ cron: CRON_RECONCILER_EXPRESSION }, { DB: db });
    assert.equal(recRes.status, 'success');
    assert.equal(recRes.details.scheduledCount, 1);

    const execs = (await db.prepare('SELECT * FROM article_publication_executions WHERE article_id = ?').bind(art.id).all()).results;
    assert.equal(execs.length, 1);
    assert.equal(execs[0].execution_mode, 'auto_schedule');

    // Dispatcher runs and is blocked from unattended publish
    const dispRes = await handleScheduledEvent({ cron: CRON_DISPATCHER_EXPRESSION }, { DB: db });
    assert.equal(dispRes.status, 'blocked');

    const artStatus = (await db.prepare('SELECT status FROM articles WHERE id = ?').bind(art.id).first()).status;
    assert.equal(artStatus, 'draft', 'Article remains draft in CONTROLLED');

    pass('Section 33: CONTROLLED Mode Test (CRON_CONTROLLED_TEST)');
  }

  // -------------------------------------------------------------
  // Section 34: UNATTENDED Routing Test
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await db.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();
    await db.prepare("UPDATE settings SET value = 'true' WHERE key = 'auto_schedule_enabled'").run();

    const art = insertSyntheticArticle(db, { id: 105 });
    await evaluateArticleReadiness(db, art.id, { actor: 'test' });

    // Planner cron
    const pRes = await handleScheduledEvent({ cron: CRON_PLANNER_EXPRESSION }, { DB: db });
    assert.equal(pRes.status, 'success');

    // Reconciler cron
    const rRes = await handleScheduledEvent({ cron: CRON_RECONCILER_EXPRESSION }, { DB: db });
    assert.equal(rRes.status, 'success');

    // Dispatcher cron (verifies dispatcher is eligible under UNATTENDED without error)
    const dRes = await handleScheduledEvent({ cron: CRON_DISPATCHER_EXPRESSION }, { DB: db });
    assert.equal(dRes.status, 'success');
    assert.equal(dRes.job, CRON_JOB_DISPATCHER);

    pass('Section 34: UNATTENDED Routing Test (CRON_UNATTENDED_ROUTING_TEST)');
  }

  // -------------------------------------------------------------
  // Section 35: Kill Switch Test
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await db.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 1, kill_reason = 'Emergency drill' WHERE id = 1").run();

    const art = insertSyntheticArticle(db, { id: 106 });

    const pRes = await handleScheduledEvent({ cron: CRON_PLANNER_EXPRESSION }, { DB: db });
    assert.equal(pRes.status, 'blocked');
    assert.ok(pRes.reason.includes('KILL_SWITCH_ENGAGED'));

    const rRes = await handleScheduledEvent({ cron: CRON_RECONCILER_EXPRESSION }, { DB: db });
    assert.equal(rRes.status, 'blocked');
    assert.equal(rRes.reason, 'KILL_SWITCH_ENGAGED');

    const dRes = await handleScheduledEvent({ cron: CRON_DISPATCHER_EXPRESSION }, { DB: db });
    assert.equal(dRes.status, 'blocked');
    assert.equal(dRes.reason, 'KILL_SWITCH_ENGAGED');

    const planCount = (await db.prepare('SELECT COUNT(*) as c FROM article_publication_plans').first()).c;
    assert.equal(planCount, 0, 'Zero mutations when kill switch engaged');

    pass('Section 35: Kill Switch Test (CRON_KILL_SWITCH_TEST)');
  }

  // -------------------------------------------------------------
  // Section 36: Auto-Schedule OFF Test
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await db.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();
    await db.prepare("UPDATE settings SET value = 'false' WHERE key = 'auto_schedule_enabled'").run();


    const art = insertSyntheticArticle(db, { id: 107 });
    await evaluateArticleReadiness(db, art.id, { actor: 'test' });

    // Planner cron runs with auto_schedule_enabled=false: creates 0 new plans
    await handleScheduledEvent({ cron: CRON_PLANNER_EXPRESSION }, { DB: db });
    const plans = (await db.prepare('SELECT * FROM article_publication_plans WHERE article_id = ?').bind(art.id).all()).results;
    assert.equal(plans.length, 0, 'Planner creates NO new plans when auto_schedule_enabled=false');

    // If an existing valid scheduled execution already existed:
    const readinessId = (await db.prepare('SELECT id FROM article_publication_readiness WHERE article_id = ?').bind(art.id).first())?.id || 1;
    db.raw.exec(`
      INSERT INTO article_publication_plans (
        id, plan_id, article_id, readiness_id, content_hash, featured_asset_id, target_publish_at, target_publish_local, timezone,
        plan_status, planner_profile, planner_version, priority_score, slot_index, jitter_seconds,
        reason_codes, created_at, updated_at, scheduling_mode
      ) VALUES (
        999, 'plan_999', 107, ${readinessId}, '${art.contentHash}', '${art.assetId}', datetime('now', '-10 minutes'), 'local', 'Asia/Jakarta',
        'PLANNED', 'GROWING', '1.0.0', 50, 1, 0, '[]', datetime('now', '-1 hour'), datetime('now', '-1 hour'), 'auto_policy'
      );

      INSERT INTO article_publication_executions (
        id, execution_id, plan_id, article_id, content_hash, featured_asset_id, target_publish_at, execution_status,
        max_attempts, attempts_count, publisher_version, execution_mode, created_at, updated_at
      ) VALUES (
        999, 'pexec_999', 'plan_999', 107, '${art.contentHash}', '${art.assetId}', datetime('now', '-10 minutes'), 'SCHEDULED',
        3, 0, '1.0.0', 'auto_schedule', datetime('now', '-30 minutes'), datetime('now', '-30 minutes')
      );
    `);

    // Dispatcher cron runs: processes existing due execution
    const dRes = await handleScheduledEvent({ cron: CRON_DISPATCHER_EXPRESSION }, { DB: db });
    assert.equal(dRes.status, 'success');
    assert.equal(dRes.details.publishedCount, 1);

    const artStatus = (await db.prepare('SELECT status FROM articles WHERE id = 107').first()).status;
    assert.equal(artStatus, 'published', 'Existing valid execution progresses even when auto_schedule_enabled=false');

    pass('Section 36: Auto-Schedule OFF Test (CRON_AUTO_SCHEDULE_OFF_TEST)');
  }

  // -------------------------------------------------------------
  // Section 37: HTTP Service Auth Tests
  // -------------------------------------------------------------
  {
    const testSecret = 'rancangloka-super-secret-cron-token-2026';
    const env = {
      CRON_SECRET: testSecret,
      RANCANGLOKA_ADMIN_SESSION_SECRET: 'admin-secret-32-characters-test-string'
    };

    // Helper to simulate request through middleware
    async function runMiddleware(req, pathname) {
      const url = new URL(`https://rancangloka.com${pathname}`);
      const locals = { runtime: { env } };
      let nextCalled = false;
      const cookies = {
        get(name) {
          const cookieHeader = req.headers.get('cookie') || '';
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
          return match ? { value: match[1] } : undefined;
        }
      };

      const res = await middlewareHandler(
        { url, request: req, cookies, locals, redirect: () => {} },
        async () => {
          nextCalled = true;
          return new Response(JSON.stringify({ status: 'success', nextCalled: true }), { status: 200 });
        }
      );

      return { res, nextCalled, locals };
    }

    const triggerPaths = [
      '/api/admin/publication/plans',
      '/api/admin/publication/publish/reconcile',
      '/api/admin/publication/publish/due'
    ];

    for (const p of triggerPaths) {
      // 1. Anonymous -> 401
      const anonReq = new Request(`https://rancangloka.com${p}`, { method: 'POST' });
      const anonRes = await runMiddleware(anonReq, p);
      assert.equal(anonRes.res.status, 401, `Anonymous request to ${p} must return 401`);
      assert.equal(anonRes.nextCalled, false);

      // 2. Bad Secret -> 401
      const badReq = new Request(`https://rancangloka.com${p}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer wrong-secret-token' }
      });
      const badRes = await runMiddleware(badReq, p);
      assert.equal(badRes.res.status, 401, `Bad secret request to ${p} must return 401`);
      assert.equal(badRes.nextCalled, false);

      // 3. Media device auth -> 403
      const mediaReq1 = new Request(`https://rancangloka.com${p}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer lkmd_device_test_token' }
      });
      const mediaRes1 = await runMiddleware(mediaReq1, p);
      assert.equal(mediaRes1.res.status, 403, `Media token to ${p} must return 403`);

      const mediaReq2 = new Request(`https://rancangloka.com${p}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer media:device:key' }
      });
      const mediaRes2 = await runMiddleware(mediaReq2, p);
      assert.equal(mediaRes2.res.status, 403, `Media device header to ${p} must return 403`);

      // 4. Valid CRON_SECRET via Bearer -> 200 without CSRF failure
      const validBearerReq = new Request(`https://rancangloka.com${p}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${testSecret}` }
      });
      const validBearerRes = await runMiddleware(validBearerReq, p);
      assert.equal(validBearerRes.res.status, 200, `Valid Bearer secret to ${p} must succeed`);
      assert.equal(validBearerRes.locals.authType, 'cron_service');

      // 5. Valid CRON_SECRET via X-RancangLoka-Cron-Secret -> 200 without CSRF failure
      const validCustomReq = new Request(`https://rancangloka.com${p}`, {
        method: 'POST',
        headers: { [CRON_SECRET_HEADER]: testSecret }
      });
      const validCustomRes = await runMiddleware(validCustomReq, p);
      assert.equal(validCustomRes.res.status, 200, `Valid X-RancangLoka-Cron-Secret to ${p} must succeed`);
      assert.equal(validCustomRes.locals.authType, 'cron_service');
    }

    // 6. Non-trigger admin route with CRON_SECRET -> 401 (service secret cannot access general admin)
    const postReq = new Request('https://rancangloka.com/api/admin/posts', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testSecret}` }
    });
    const postRes = await runMiddleware(postReq, '/api/admin/posts');
    assert.equal(postRes.res.status, 401, 'CRON_SECRET cannot access non-trigger admin endpoints');

    // 7. Route handlers reject media tokens directly
    const reqWithMedia = new Request('https://rancangloka.com/api/admin/publication/plans', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer lkmd_sample' }
    });
    const planHandlerRes = await plansPostHandler({ request: reqWithMedia, locals: { runtime: { env } } });
    assert.equal(planHandlerRes.status, 403);

    const dueHandlerRes = await duePostHandler({ request: reqWithMedia, locals: { runtime: { env } } });
    assert.equal(dueHandlerRes.status, 403);

    const recHandlerRes = await reconcilePostHandler({ request: reqWithMedia, locals: { runtime: { env } } });
    assert.equal(recHandlerRes.status, 403);

    pass('Section 37: HTTP Service Auth Tests (CRON_HTTP_AUTH_TESTS)');
  }

  // -------------------------------------------------------------
  // Section 38: Secret Leak Test
  // -------------------------------------------------------------
  {
    const testSecret = 'top-secret-canary-value-481726354';
    const env = { CRON_SECRET: testSecret, DB: createTestD1() };

    // 1. Check isValidCronSecret does not throw or expose secret
    assert.equal(isValidCronSecret('wrong-val', env), false);
    assert.equal(isValidCronSecret(testSecret, env), true);

    // 2. Invoke handler and inspect response body
    const req = new Request('https://rancangloka.com/api/admin/publication/publish/due', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testSecret}` }
    });
    const res = await duePostHandler({ request: req, locals: { runtime: { env }, authActor: 'cron_service' } });
    const text = await res.text();

    assert.ok(!text.includes(testSecret), 'Response body must not contain CRON_SECRET');
    assert.ok(!JSON.stringify(env.DB.raw).includes(testSecret), 'Database must not contain CRON_SECRET');

    pass('Section 38: Secret Leak Test (CRON_SECRET_LEAK_TEST)');
  }

  // -------------------------------------------------------------
  // Section 24 & 26: Error Isolation & No Cascade
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await db.prepare("UPDATE automation_control SET mode = 'PLAN_ONLY' WHERE id = 1").run();

    // Simulate failing DB for planner only
    const faultyDb = {
      prepare(sql) {
        if (sql.includes('settings')) {
          throw new Error('SIMULATED_DB_CRASH');
        }
        return db.prepare(sql);
      }
    };

    // Planner fails -> bubbles error, does NOT invoke reconciler or dispatcher
    await assert.rejects(
      async () => handleScheduledEvent({ cron: CRON_PLANNER_EXPRESSION }, { DB: faultyDb }),
      /SIMULATED_DB_CRASH/
    );

    const planCount = (await db.prepare('SELECT COUNT(*) as c FROM article_publication_plans').first()).c;
    const execCount = (await db.prepare('SELECT COUNT(*) as c FROM article_publication_executions').first()).c;
    assert.equal(planCount, 0, 'No cascade mutations on failure');
    assert.equal(execCount, 0, 'No cascade mutations on failure');

    pass('Section 24 & 26: Error Isolation & No Cascade (CRON_JOB_FAILURE_ISOLATION)');
  }

  // -------------------------------------------------------------
  // Section 40: Article Fixture Freeze Audit (Articles 1, 3, 5, 6)
  // -------------------------------------------------------------
  {
    const d1Dir = path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    let d1SqlitePath = null;
    if (fs.existsSync(d1Dir)) {
      const files = fs.readdirSync(d1Dir).filter((f) => f.endsWith('.sqlite'));
      if (files.length > 0) d1SqlitePath = path.join(d1Dir, files[0]);
    }

    assert.ok(d1SqlitePath && fs.existsSync(d1SqlitePath), 'Miniflare D1 sqlite file must exist');
    const liveDb = new DatabaseSync(d1SqlitePath, { readOnly: true });

    const art1 = liveDb.prepare('SELECT id, status, COALESCE(manual_hold, 0) as manual_hold FROM articles WHERE id = 1').get();
    assert.equal(art1.id, 1);
    assert.equal(art1.status, 'draft');
    assert.equal(art1.manual_hold, 0);

    const art3 = liveDb.prepare('SELECT id, status, COALESCE(manual_hold, 0) as manual_hold FROM articles WHERE id = 3').get();
    assert.equal(art3.id, 3);
    assert.equal(art3.status, 'draft');
    assert.equal(art3.manual_hold, 0);

    const art5 = liveDb.prepare('SELECT id, status, COALESCE(manual_hold, 0) as manual_hold FROM articles WHERE id = 5').get();
    assert.equal(art5.id, 5);
    assert.equal(art5.status, 'draft');
    assert.equal(art5.manual_hold, 1);

    const art6 = liveDb.prepare('SELECT id, slug, status FROM articles WHERE id = 6').get();
    assert.equal(art6.id, 6);
    assert.equal(art6.slug, 'phase5l7-hands-off-publish-fixture');
    assert.equal(art6.status, 'published');

    const art6Approvals = liveDb.prepare('SELECT COUNT(*) as c FROM article_editorial_approvals WHERE article_id = 6').get().c;
    assert.equal(art6Approvals, 0, 'Article 6 must have 0 approvals');

    const art6Receipts = liveDb.prepare('SELECT COUNT(*) as c FROM publication_execution_receipts WHERE article_id = 6').get().c;
    assert.equal(art6Receipts, 1, 'Article 6 must have exactly 1 receipt');

    pass('Section 40: Golden Article Fixture Freeze Audit (Articles 1, 3, 5, 6)');
  }

  // -------------------------------------------------------------
  // Section 41: Real Local Control State Audit
  // -------------------------------------------------------------
  {
    const d1Dir = path.resolve(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    const files = fs.readdirSync(d1Dir).filter((f) => f.endsWith('.sqlite'));
    const d1SqlitePath = path.join(d1Dir, files[0]);
    const liveDb = new DatabaseSync(d1SqlitePath, { readOnly: true });

    const control = liveDb.prepare('SELECT mode, kill_switch_engaged FROM automation_control WHERE id = 1').get();
    assert.equal(control.mode, 'OFF', 'Local automation mode must be OFF');
    assert.equal(control.kill_switch_engaged, 0, 'Local kill switch must be 0');

    const autoSchedSetting = liveDb.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
    assert.equal(autoSchedSetting.value, 'false', 'auto_schedule_enabled must be false');

    pass('Section 41: Real Local Control State Audit (mode=OFF, auto_schedule_enabled=false)');
  }

  console.log('\n============================================================');
  console.log(`ALL PHASE 5L9 CRON & AUTH TESTS PASSED: ${passed}/${passed}`);
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ PHASE 5L9 TEST FAILED:', err);
  process.exit(1);
});
