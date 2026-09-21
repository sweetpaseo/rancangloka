/**
 * RancangLoka — Phase 5L10 Test Suite
 * Durable Cron Heartbeat + Operations Observability
 *
 * Deterministic Test Matrix:
 * 1.  Section 40: Planner Heartbeat Test (successful planner run records SUCCEEDED heartbeat)
 * 2.  Section 40: Reconciler Heartbeat Test (successful reconciler run records SUCCEEDED heartbeat)
 * 3.  Section 40: Dispatcher Heartbeat Test (successful dispatcher run records SUCCEEDED heartbeat)
 * 4.  Section 41: Blocked Cron Run Test (mode=OFF -> BLOCKED heartbeat, zero article mutations)
 * 5.  Section 42: Failed Cron Run Test (synthetic error -> FAILED heartbeat, error_class, secrets redacted)
 * 6.  Section 43: Heartbeat Staleness Test (heartbeat older than threshold -> is_stale=true, health=STALE)
 * 7.  Section 44: Stuck Execution Alert Test (expired lease on CLAIMED -> EXECUTION_LEASE_EXPIRED critical alert)
 * 8.  Section 45: Terminal Failure Alert Test (FAILED execution -> TERMINAL_PUBLICATION_FAILURE alert)
 * 9.  Section 46: Receipt Integrity Alert Test (missing receipt on published execution -> RECEIPT_INTEGRITY_ERROR alert)
 * 10. Section 47: Normal OFF State Noise Control Test (mode=OFF, auto_schedule=false -> 0 critical alerts)
 * 11. Section 48: Operations Status API Auth Test (anonymous=401, media_device=403, admin=200)
 * 12. Section 48 & 29: Secret Leak Test (zero passwords, tokens, auth headers in status response)
 * 13. Section 39: Heartbeat Idempotency & Invocation Correlation Test
 * 14. Section 38: Telemetry Failure Policy Test (fail-closed on start failure)
 * 15. Section 49: Admin Operations Dashboard Route / Render Sanity Test
 * 16. Section 51: Golden Article Fixture Freeze Audit (Articles 1, 3, 5, 6 mutations = 0)
 * 17. Section 52: Real Local Control State Audit (auto_schedule_enabled=false, mode=OFF, kill_switch=0)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  handleScheduledEvent,
  executeCronJob,
  CRON_JOB_PLANNER,
  CRON_JOB_RECONCILER,
  CRON_JOB_DISPATCHER
} from '../src/lib/publication/cron-router.ts';

import {
  startCronRun,
  completeCronRun,
  runWithCronTelemetry,
  getLastCronHeartbeats,
  sanitizeErrorSummary
} from '../src/lib/publication/cron-telemetry.ts';

import {
  getPublicationOperationsStatus,
  CADENCE_CONFIG
} from '../src/lib/publication/operations-status.ts';

import { GET as opsStatusGetHandler } from '../src/pages/api/admin/publication/operations/status.ts';
import { createAdminSessionToken } from '../src/lib/auth.ts';
import { setAutomationMode, setKillSwitch } from '../src/lib/safety/automation-controller.ts';

let passed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTestAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
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
    '0018_publication_operator_audit.sql',
    '0019_publication_cron_observability.sql'
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
    prepare(query) {
      return {
        bind(...params) {
          return {
            async all() {
              const stmt = sqlite.prepare(query);
              const rows = stmt.all(...params);
              return { results: rows };
            },
            async first() {
              const stmt = sqlite.prepare(query);
              return stmt.get(...params) || null;
            },
            async run() {
              const stmt = sqlite.prepare(query);
              const info = stmt.run(...params);
              return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
            }
          };
        },
        async all() {
          const stmt = sqlite.prepare(query);
          const rows = stmt.all();
          return { results: rows };
        },
        async first() {
          const stmt = sqlite.prepare(query);
          return stmt.get() || null;
        },
        async run() {
          const stmt = sqlite.prepare(query);
          const info = stmt.run();
          return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
        }
      };
    },
    rawDb: sqlite
  };
}

console.log('\n============================================================');
console.log('RANCANGLOKA PHASE 5L10 TEST SUITE: CRON HEARTBEAT & OBSERVABILITY');
console.log('============================================================\n');

// 1. Planner Heartbeat Test
await runTestAsync('Test 1: PLANNER_HEARTBEAT_TEST (successful planner run records SUCCEEDED heartbeat)', async () => {
  const db = createTestD1();
  await setAutomationMode(db, 'PLAN_ONLY', 'test');

  const res = await executeCronJob(CRON_JOB_PLANNER, db, null, 'cloudflare_cron');
  assert.equal(res.status, 'success');

  const row = db.rawDb.prepare("SELECT * FROM publication_cron_runs WHERE job_name = 'publication_planner' ORDER BY id DESC LIMIT 1").get();
  assert.ok(row, 'Heartbeat record must exist');
  assert.equal(row.job_name, 'publication_planner');
  assert.equal(row.trigger_source, 'cloudflare_cron');
  assert.equal(row.status, 'SUCCEEDED');
  assert.ok(row.run_id.startsWith('crun_plan_'), 'Run ID must have structured prefix');
  assert.ok(row.started_at, 'started_at must be populated');
  assert.ok(row.finished_at, 'finished_at must be populated');
  assert.equal(row.error_class, null);
});

// 2. Reconciler Heartbeat Test
await runTestAsync('Test 2: RECONCILER_HEARTBEAT_TEST (successful reconciler run records SUCCEEDED heartbeat)', async () => {
  const db = createTestD1();
  await setAutomationMode(db, 'CONTROLLED', 'test');

  const res = await executeCronJob(CRON_JOB_RECONCILER, db, null, 'cloudflare_cron');
  assert.equal(res.status, 'success');

  const row = db.rawDb.prepare("SELECT * FROM publication_cron_runs WHERE job_name = 'auto_execution_reconciler' ORDER BY id DESC LIMIT 1").get();
  assert.ok(row, 'Heartbeat record must exist');
  assert.equal(row.job_name, 'auto_execution_reconciler');
  assert.equal(row.status, 'SUCCEEDED');
  assert.ok(row.run_id.startsWith('crun_rec_'), 'Run ID must have structured prefix');
});

// 3. Dispatcher Heartbeat Test
await runTestAsync('Test 3: DISPATCHER_HEARTBEAT_TEST (successful dispatcher run records SUCCEEDED heartbeat)', async () => {
  const db = createTestD1();
  db.rawDb.prepare("UPDATE automation_control SET mode = 'UNATTENDED' WHERE id = 1").run();

  const res = await executeCronJob(CRON_JOB_DISPATCHER, db, null, 'cloudflare_cron');
  assert.equal(res.status, 'success');

  const row = db.rawDb.prepare("SELECT * FROM publication_cron_runs WHERE job_name = 'publication_dispatcher' ORDER BY id DESC LIMIT 1").get();
  assert.ok(row, 'Heartbeat record must exist');
  assert.equal(row.job_name, 'publication_dispatcher');
  assert.equal(row.status, 'SUCCEEDED');
  assert.ok(row.run_id.startsWith('crun_disp_'), 'Run ID must have structured prefix');
});

// 4. Blocked Cron Run Test
await runTestAsync('Test 4: BLOCKED_CRON_HEARTBEAT_TEST (mode=OFF records BLOCKED status, zero mutations)', async () => {
  const db = createTestD1();
  await setAutomationMode(db, 'OFF', 'test');

  const res = await executeCronJob(CRON_JOB_PLANNER, db, null, 'cloudflare_cron');
  assert.equal(res.status, 'blocked');

  const row = db.rawDb.prepare("SELECT * FROM publication_cron_runs WHERE job_name = 'publication_planner' ORDER BY id DESC LIMIT 1").get();
  assert.ok(row, 'Heartbeat record must exist');
  assert.equal(row.status, 'BLOCKED', 'Safety block must be classified as BLOCKED, not FAILED');
  assert.equal(row.error_class, 'SAFETY_BLOCK');
  assert.ok(row.error_summary.includes('AUTOMATION_MODE_OFF') || row.error_summary.includes('PLAN_ONLY'));
});

// 5. Failed Cron Run Test & Secret Firewall
await runTestAsync('Test 5: FAILED_CRON_HEARTBEAT_TEST (unexpected error records FAILED, secrets redacted)', async () => {
  const db = createTestD1();

  const mockSecretError = new Error('Database connect error with Bearer super_secret_admin_token and lkmd_device_key');

  let caught = false;
  try {
    await runWithCronTelemetry(
      db,
      CRON_JOB_PLANNER,
      'test',
      async () => {
        throw mockSecretError;
      }
    );
  } catch (err) {
    caught = true;
  }
  assert.ok(caught, 'Must re-throw error to caller');

  const row = db.rawDb.prepare("SELECT * FROM publication_cron_runs WHERE trigger_source = 'test' ORDER BY id DESC LIMIT 1").get();
  assert.ok(row);
  assert.equal(row.status, 'FAILED');
  assert.equal(row.error_class, 'Error');
  assert.ok(!row.error_summary.includes('super_secret_admin_token'), 'Secret token must be redacted');
  assert.ok(!row.error_summary.includes('lkmd_device_key'), 'Media token must be redacted');
  assert.ok(row.error_summary.includes('Bearer [REDACTED]'), 'Bearer token must be sanitized');
  assert.ok(row.error_summary.includes('[MEDIA_TOKEN_REDACTED]'), 'Media device token must be sanitized');
});

// 6. Heartbeat Staleness Test
await runTestAsync('Test 6: CRON_HEARTBEAT_STALENESS_TEST (threshold exceeds -> is_stale=true, health=STALE)', async () => {
  const db = createTestD1();
  const pastTime = new Date(Date.now() - 15000 * 1000).toISOString(); // 15000 seconds ago

  db.rawDb.prepare(`
    INSERT INTO publication_cron_runs (
      run_id, job_name, trigger_source, started_at, finished_at, status, created_at
    ) VALUES ('crun_plan_stale', 'publication_planner', 'cloudflare_cron', ?, ?, 'SUCCEEDED', ?)
  `).run(pastTime, pastTime, pastTime);

  const status = await getPublicationOperationsStatus(db);
  const plannerHb = status.heartbeats['publication_planner'];

  assert.ok(plannerHb.age_seconds > CADENCE_CONFIG['publication_planner'].staleThresholdSeconds);
  assert.equal(plannerHb.is_stale, true);
  assert.equal(plannerHb.health, 'STALE');
});

function seedTestArticle(db, articleId = 100, overrides = {}) {
  const contentMd = overrides.content_md || 'Konten uji arsitektur fasad adaptif modern tropis.';
  const contentHash = overrides.content_hash || computeSha256(contentMd);
  const slug = overrides.slug || `fixture-test-${articleId}`;
  const status = overrides.status || 'draft';
  const manualHold = overrides.manual_hold !== undefined ? overrides.manual_hold : 0;

  db.rawDb.prepare(`
    INSERT OR REPLACE INTO articles (
      id, slug, title, description, content_md, content_html,
      category_id, author_id, featured_image, image_alt,
      status, content_hash, focus_keyword, reading_time_minutes,
      key_takeaways, manual_hold, published_at, updated_at
    ) VALUES (?, ?, 'Title', 'Desc', ?, ?, 1, 1, '/media/test.webp', 'Alt', ?, ?, 'fasad', 3, '[]', ?, datetime('now'), datetime('now'))
  `).run(articleId, slug, contentMd, `<p>${contentMd}</p>`, status, contentHash, manualHold);

  const assetId = overrides.asset_id || `ast_test_${articleId}`;
  const mediaSha = computeSha256(`media_${articleId}`);
  db.rawDb.prepare(`
    INSERT OR REPLACE INTO media_assets (
      asset_id, source_type, storage_key, public_url, mime_type, file_size, width, height,
      sha256, alt_text, status, created_at
    ) VALUES (?, 'lokamedia_extension', ?, ?, 'image/webp', 150000, 1200, 800, ?, 'Alt', 'VALIDATED', CURRENT_TIMESTAMP)
  `).run(assetId, `media/${assetId}.webp`, `/media/${assetId}.webp`, mediaSha);

  db.rawDb.prepare(`
    INSERT OR REPLACE INTO article_media (
      article_id, slot_key, asset_id, role, caption, is_active, created_at, updated_at
    ) VALUES (?, 'featured', ?, 'featured', 'Alt', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(articleId, assetId);

  return { articleId, slug, contentHash, assetId };
}

function seedTestPlan(db, articleId, planId = `plan_test_${articleId}`) {
  const art = db.rawDb.prepare('SELECT content_hash FROM articles WHERE id = ?').get(articleId);
  const media = db.rawDb.prepare("SELECT asset_id FROM article_media WHERE article_id = ? AND role = 'featured' AND is_active = 1").get(articleId);

  const info = db.rawDb.prepare(`
    INSERT INTO article_publication_readiness (
      article_id, is_ready, overall_status, content_hash, snapshot_json, evaluated_at
    ) VALUES (?, 1, 'READY_TO_SCHEDULE', ?, '{"policy":{"system_policy_pass":true}}', CURRENT_TIMESTAMP)
  `).run(articleId, art.content_hash);

  const readinessId = Number(info.lastInsertRowid);

  db.rawDb.prepare(`
    INSERT OR REPLACE INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, planner_version, priority_score, slot_index,
      jitter_seconds, reason_codes, scheduling_mode
    ) VALUES (?, ?, ?, ?, ?, datetime('now', '+1 hour'), '2026-09-22 10:00:00 WIB', 'Asia/Jakarta', 'PLANNED', 'GROWING', '1.0.0', 50, 1, 0, '[]', 'auto_policy')
  `).run(planId, articleId, readinessId, art.content_hash, media.asset_id);

  return { planId, articleId, contentHash: art.content_hash, assetId: media.asset_id };
}

// 7. Stuck Execution Alert Test
await runTestAsync('Test 7: STUCK_EXECUTION_ALERT_TEST (expired lease on CLAIMED -> critical alert)', async () => {
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, 99, { slug: 'slug-stuck-99' });
  const { planId, contentHash, assetId } = seedTestPlan(db, articleId, 'plan_stuck_99');
  const expiredLease = new Date(Date.now() - 600 * 1000).toISOString(); // 10 minutes ago

  db.rawDb.prepare(`
    INSERT INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id, target_publish_at,
      execution_status, lease_expires_at, claimed_by_worker, attempts_count
    ) VALUES ('pexec_stuck_01', ?, ?, ?, ?, ?, 'CLAIMED', ?, 'worker_dead', 1)
  `).run(planId, articleId, contentHash, assetId, expiredLease, expiredLease);

  const status = await getPublicationOperationsStatus(db);
  assert.equal(status.stuck_work.stuck_executions.length, 1);
  assert.equal(status.stuck_work.stuck_executions[0].execution_id, 'pexec_stuck_01');

  const alert = status.alerts.find((a) => a.type === 'EXECUTION_LEASE_EXPIRED');
  assert.ok(alert, 'Must derive EXECUTION_LEASE_EXPIRED alert');
  assert.equal(alert.severity, 'CRITICAL');
  assert.equal(alert.execution_id, 'pexec_stuck_01');
});

// 8. Terminal Failure Alert Test
await runTestAsync('Test 8: TERMINAL_FAILURE_ALERT_TEST (FAILED execution -> TERMINAL_PUBLICATION_FAILURE alert)', async () => {
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, 199, { slug: 'slug-failed-199' });
  const { planId, contentHash, assetId } = seedTestPlan(db, articleId, 'plan_failed_199');

  db.rawDb.prepare(`
    INSERT INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id, target_publish_at,
      execution_status, last_error_class, last_error_reason, updated_at
    ) VALUES ('pexec_failed_01', ?, ?, ?, ?, datetime('now'), 'FAILED', 'FATAL_D1_ERROR', 'Database locked permanently', datetime('now'))
  `).run(planId, articleId, contentHash, assetId);

  const status = await getPublicationOperationsStatus(db);
  assert.equal(status.terminal_failures.length, 1);
  assert.equal(status.terminal_failures[0].execution_id, 'pexec_failed_01');

  const alert = status.alerts.find((a) => a.type === 'TERMINAL_PUBLICATION_FAILURE');
  assert.ok(alert, 'Must derive TERMINAL_PUBLICATION_FAILURE alert');
  assert.equal(alert.severity, 'CRITICAL');
});

// 9. Receipt Integrity Alert Test
await runTestAsync('Test 9: RECEIPT_INTEGRITY_ALERT_TEST (published missing receipt -> RECEIPT_INTEGRITY_ERROR alert)', async () => {
  const db = createTestD1();
  const { articleId } = seedTestArticle(db, 299, { slug: 'slug-pub-299', status: 'published' });
  const { planId, contentHash, assetId } = seedTestPlan(db, articleId, 'plan_pub_299');

  // Execution PUBLISHED but no row in publication_execution_receipts
  db.rawDb.prepare(`
    INSERT INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id, target_publish_at,
      execution_status, actual_published_at
    ) VALUES ('pexec_pub_no_rcpt', ?, ?, ?, ?, datetime('now'), 'PUBLISHED', datetime('now'))
  `).run(planId, articleId, contentHash, assetId);

  const status = await getPublicationOperationsStatus(db);
  assert.equal(status.receipt_integrity.missing_receipts.length, 1);
  assert.equal(status.receipt_integrity.missing_receipts[0].execution_id, 'pexec_pub_no_rcpt');

  const alert = status.alerts.find((a) => a.type === 'RECEIPT_INTEGRITY_ERROR');
  assert.ok(alert, 'Must derive RECEIPT_INTEGRITY_ERROR alert');
  assert.equal(alert.severity, 'CRITICAL');
});

// 10. Normal OFF State Noise Control Test
await runTestAsync('Test 10: OFF_STATE_NOISE_TEST (normal mode=OFF produces ZERO critical alerts)', async () => {
  const db = createTestD1();
  await setAutomationMode(db, 'OFF', 'test');

  // Insert recent blocked heartbeats
  const now = new Date().toISOString();
  db.rawDb.prepare(`
    INSERT INTO publication_cron_runs (run_id, job_name, trigger_source, started_at, finished_at, status, created_at)
    VALUES
      ('crun_plan_off', 'publication_planner', 'cloudflare_cron', ?, ?, 'BLOCKED', ?),
      ('crun_rec_off', 'auto_execution_reconciler', 'cloudflare_cron', ?, ?, 'BLOCKED', ?),
      ('crun_disp_off', 'publication_dispatcher', 'cloudflare_cron', ?, ?, 'BLOCKED', ?)
  `).run(now, now, now, now, now, now, now, now, now);

  const status = await getPublicationOperationsStatus(db);
  const criticalAlerts = status.alerts.filter((a) => a.severity === 'CRITICAL');

  assert.equal(criticalAlerts.length, 0, 'Normal OFF state must not produce CRITICAL alerts');
});

// 11. Operations Status API Auth Test
await runTestAsync('Test 11: OPS_API_AUTH_TEST (anonymous=401, media_device=403, admin=200)', async () => {
  const db = createTestD1();

  const fakeLocals = {
    db,
    runtime: { env: { DB: db, ADMIN_PASSWORD_HASH: 'hash', ADMIN_SESSION_SECRET: 'test-session-secret' } }
  };

  // A. Anonymous -> 401
  const anonReq = new Request('https://rancangloka.com/api/admin/publication/operations/status', {
    method: 'GET'
  });
  const anonRes = await opsStatusGetHandler({ request: anonReq, locals: fakeLocals });
  assert.equal(anonRes.status, 401, 'Anonymous request must be 401');

  // B. Media Device Token -> 403
  const mediaReq = new Request('https://rancangloka.com/api/admin/publication/operations/status', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer lkmd_device_test_token'
    }
  });
  const mediaRes = await opsStatusGetHandler({ request: mediaReq, locals: fakeLocals });
  assert.equal(mediaRes.status, 403, 'Media device request must be 403');

  // C. Valid Admin Session -> 200
  const validToken = await createAdminSessionToken(fakeLocals.runtime.env);

  const adminReq = new Request('https://rancangloka.com/api/admin/publication/operations/status', {
    method: 'GET',
    headers: {
      Cookie: `admin_session=${validToken}`
    }
  });
  const adminRes = await opsStatusGetHandler({ request: adminReq, locals: fakeLocals });
  assert.equal(adminRes.status, 200, 'Admin session request must be 200');

  const json = await adminRes.json();
  assert.equal(json.status, 'success');
  assert.ok(json.data.controls);
  assert.ok(json.data.pipeline);
  assert.ok(json.data.heartbeats);
});

// 12. Secret Leak Test
await runTestAsync('Test 12: OPS_STATUS_SECRET_LEAK_TEST (zero tokens or secrets in status response)', async () => {
  const db = createTestD1();
  const status = await getPublicationOperationsStatus(db);
  const statusString = JSON.stringify(status);

  assert.ok(!statusString.includes('test-session-secret'), 'Must not contain session secret');
  assert.ok(!statusString.includes('CRON_SECRET'), 'Must not contain CRON_SECRET');
  assert.ok(!statusString.includes('password'), 'Must not contain password');
  assert.ok(!statusString.includes('Authorization:'), 'Must not contain auth headers');
});

// 13. Heartbeat Idempotency & Invocation Correlation Test
await runTestAsync('Test 13: CRON_HEARTBEAT_IDEMPOTENCY (one run_id updates single row without duplicates)', async () => {
  const db = createTestD1();

  const runContext = await startCronRun(db, CRON_JOB_PLANNER, 'test');
  const count1 = db.rawDb.prepare("SELECT COUNT(*) as c FROM publication_cron_runs WHERE run_id = ?").get(runContext.runId).c;
  assert.equal(count1, 1);

  // Complete once
  await completeCronRun(db, runContext, { status: 'SUCCEEDED', processedCount: 5 });
  const count2 = db.rawDb.prepare("SELECT COUNT(*) as c FROM publication_cron_runs WHERE run_id = ?").get(runContext.runId).c;
  assert.equal(count2, 1);

  // Complete second time (idempotency check)
  await completeCronRun(db, runContext, { status: 'SUCCEEDED', processedCount: 5 });
  const count3 = db.rawDb.prepare("SELECT COUNT(*) as c FROM publication_cron_runs WHERE run_id = ?").get(runContext.runId).c;
  assert.equal(count3, 1, 'Calling complete multiple times must not create duplicate run records');
});

// 14. Telemetry Failure Policy Test
await runTestAsync('Test 14: TELEMETRY_FAILURE_POLICY (fails closed if start cannot be recorded)', async () => {
  // Create broken DB where publication_cron_runs table is locked or missing
  const brokenDb = {
    prepare() {
      return {
        bind() {
          return {
            async run() {
              throw new Error('D1_TABLE_LOCKED');
            }
          };
        }
      };
    }
  };

  let caught = false;
  try {
    await runWithCronTelemetry(
      brokenDb,
      CRON_JOB_PLANNER,
      'cloudflare_cron',
      async () => {
        return { status: 'success' };
      }
    );
  } catch (err) {
    caught = true;
    assert.ok(err.message.includes('CRON_TELEMETRY_START_FAILED'));
  }

  assert.ok(caught, 'Must fail closed before executing canonical business logic');
});

// 14B. Telemetry Finalize Failure Test
await runTestAsync('Test 14B: TELEMETRY_FINALIZE_FAILURE_TEST (canonical action succeeds and is NOT rolled back when finalize fails)', async () => {
  const db = createTestD1();
  let businessActionExecuted = false;

  // Start works normally, but complete throws
  const originalRun = db.rawDb.prepare.bind(db.rawDb);
  let failFinalize = false;
  const mockDb = {
    prepare(sql) {
      if (failFinalize && sql.includes('UPDATE publication_cron_runs')) {
        return {
          bind() {
            return {
              async run() {
                throw new Error('D1_FINALIZE_WRITE_ERROR');
              }
            };
          }
        };
      }
      return db.prepare(sql);
    }
  };

  const result = await runWithCronTelemetry(
    mockDb,
    CRON_JOB_PLANNER,
    'cloudflare_cron',
    async () => {
      // Simulate successful business action
      businessActionExecuted = true;
      failFinalize = true; // Trigger failure on finalize step
      return { status: 'success', processedCount: 1 };
    }
  );

  assert.equal(businessActionExecuted, true, 'Business action must have executed');
  assert.equal(result.status, 'success', 'Result must be returned to caller');
  assert.ok(result.telemetry_finalize_error, 'Telemetry finalize error must be surfaced on result');
  assert.ok(result.telemetry_finalize_error.includes('D1_FINALIZE_WRITE_ERROR'));
});

// 15. Admin Operations Dashboard Route / Render Sanity Test
await runTestAsync('Test 15: OPS_DASHBOARD_RENDER_TEST (operations.astro exists and contains required cards)', async () => {
  const dashboardPath = path.resolve(process.cwd(), 'src/pages/admin/publication/operations.astro');
  assert.ok(fs.existsSync(dashboardPath), 'operations.astro must exist');

  const content = fs.readFileSync(dashboardPath, 'utf-8');
  assert.ok(content.includes('Status Kontrol Sistem'), 'Must contain System Status card');
  assert.ok(content.includes('Antrean Pipeline Publikasi'), 'Must contain Pipeline card');
  assert.ok(content.includes('Detak Cron'), 'Must contain Cron Heartbeat card');
  assert.ok(content.includes('Masalah & Peringatan Terdeteksi'), 'Must contain Problems card');
  assert.ok(content.includes('Publikasi Otomatis Terakhir'), 'Must contain Recent Publications card');
  assert.ok(!content.includes('<form method="POST"'), 'Must be read-only without mutation forms');
});

// 16. Article Fixture Freeze Audit
await runTestAsync('Test 16: ARTICLE_FIXTURE_FREEZE (Articles 1, 3, 5, 6 remain 100% frozen in local D1)', async () => {
  const localD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );

  if (fs.existsSync(localD1Path)) {
    const db = new DatabaseSync(localD1Path);

    const a1 = db.prepare('SELECT id, status, manual_hold FROM articles WHERE id = 1').get();
    assert.equal(a1.status, 'draft', 'Article 1 must remain draft');
    assert.equal(a1.manual_hold, 0, 'Article 1 manual_hold must remain 0');

    const a3 = db.prepare('SELECT id, status, manual_hold FROM articles WHERE id = 3').get();
    assert.equal(a3.status, 'draft', 'Article 3 must remain draft');
    assert.equal(a3.manual_hold, 0, 'Article 3 manual_hold must remain 0');

    const a5 = db.prepare('SELECT id, status, manual_hold FROM articles WHERE id = 5').get();
    assert.equal(a5.status, 'draft', 'Article 5 must remain draft');
    assert.equal(a5.manual_hold, 1, 'Article 5 manual_hold must remain 1');

    const a6 = db.prepare('SELECT id, status, manual_hold FROM articles WHERE id = 6').get();
    assert.equal(a6.status, 'published', 'Article 6 must remain published');
    assert.equal(a6.manual_hold, 0, 'Article 6 manual_hold must remain 0');

    const a6Approvals = db.prepare('SELECT COUNT(*) as c FROM article_editorial_approvals WHERE article_id = 6').get().c;
    assert.equal(a6Approvals, 0, 'Article 6 must have zero human approvals');

    const a6Receipt = db.prepare("SELECT receipt_id FROM publication_execution_receipts WHERE article_id = 6").get();
    assert.equal(a6Receipt.receipt_id, 'rcpt_6c247016b4ac6ee0', 'Article 6 golden receipt must remain untouched');
  }
});

// 17. Real Local Control State Audit
await runTestAsync('Test 17: REAL_CONTROL_STATE_AUDIT (mode=OFF, auto_schedule=false, kill_switch=0)', async () => {
  const localD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );

  if (fs.existsSync(localD1Path)) {
    const db = new DatabaseSync(localD1Path);

    const autoSetting = db.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
    assert.equal(autoSetting?.value, 'false', 'auto_schedule_enabled must remain false in local D1');

    const autoCtrl = db.prepare('SELECT mode, kill_switch_engaged FROM automation_control WHERE id = 1').get();
    assert.equal(autoCtrl?.mode, 'OFF', 'automation mode must remain OFF in local D1');
    assert.equal(autoCtrl?.kill_switch_engaged, 0, 'kill switch must remain 0 in local D1');
  }
});

// 18. Stuck Plan Alert Test
await runTestAsync('Test 18: STUCK_PLAN_ALERT_TEST (auto_policy plan > 15m old under execution mode emits alert)', async () => {
  const db = createTestD1();
  // Enable UNATTENDED mode so reconciler is expected to reconcile
  db.rawDb.prepare("UPDATE automation_control SET mode = 'UNATTENDED', kill_switch_engaged = 0 WHERE id = 1").run();

  const { articleId } = seedTestArticle(db, 88, { slug: 'slug-stuck-plan-88' });
  const { planId } = seedTestPlan(db, articleId, 'plan_stuck_88');

  // Backdate plan to 20 minutes ago
  const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  db.rawDb.prepare("UPDATE article_publication_plans SET created_at = ? WHERE plan_id = ?").run(twentyMinAgo, planId);

  const status = await getPublicationOperationsStatus(db);

  const foundStuckPlan = status.stuck_work.stuck_plans.find(p => p.plan_id === planId);
  assert.ok(foundStuckPlan, 'Plan must be detected in stuck_work.stuck_plans');

  const stuckAlert = status.alerts.find(a => a.type === 'STUCK_PLAN_DETECTED' && a.article_id === articleId);
  assert.ok(stuckAlert, 'STUCK_PLAN_DETECTED alert must be derived');
  assert.equal(stuckAlert.severity, 'WARNING');
});

// 19. Stale Binding Alert Test
await runTestAsync('Test 19: STALE_BINDING_ALERT_TEST (content hash mismatch on active execution emits alert)', async () => {
  const db = createTestD1();
  const { articleId, contentHash } = seedTestArticle(db, 89, { slug: 'slug-stale-binding-89' });
  const { planId, assetId } = seedTestPlan(db, articleId, 'plan_stale_89');

  // Insert execution with old content hash
  const oldHash = '0000000000000000000000000000000000000000000000000000000000000000';
  db.rawDb.prepare(`
    INSERT INTO article_publication_executions (
      execution_id, plan_id, article_id, content_hash, featured_asset_id,
      target_publish_at, execution_status, execution_mode, created_at, updated_at
    ) VALUES ('exec_stale_89', ?, ?, ?, ?, datetime('now'), 'SCHEDULED', 'auto_schedule', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(planId, articleId, oldHash, assetId);

  const status = await getPublicationOperationsStatus(db);

  const foundStaleBinding = status.stale_bindings.find(b => b.execution_id === 'exec_stale_89');
  assert.ok(foundStaleBinding, 'Execution must be detected in stale_bindings');
  assert.equal(foundStaleBinding.bound_hash, oldHash);
  assert.equal(foundStaleBinding.current_hash, contentHash);

  const staleAlert = status.alerts.find(a => a.type === 'STALE_BINDING_BLOCKED' && a.execution_id === 'exec_stale_89');
  assert.ok(staleAlert, 'STALE_BINDING_BLOCKED alert must be derived');
  assert.equal(staleAlert.severity, 'WARNING');
});

// 20. Mode-Aware Heartbeat Test
await runTestAsync('Test 20: OFF_MODE_CRON_ALIVE_TEST (mode=OFF with BLOCKED heartbeats considered alive without critical alert)', async () => {
  const db = createTestD1();
  db.rawDb.prepare("UPDATE automation_control SET mode = 'OFF', kill_switch_engaged = 0 WHERE id = 1").run();

  const freshTime = new Date(Date.now() - 30 * 1000).toISOString(); // 30 seconds ago
  for (const job of [CRON_JOB_PLANNER, CRON_JOB_RECONCILER, CRON_JOB_DISPATCHER]) {
    db.rawDb.prepare(`
      INSERT INTO publication_cron_runs (
        run_id, job_name, trigger_source, started_at, finished_at, status, created_at
      ) VALUES (?, ?, 'cloudflare_cron', ?, ?, 'BLOCKED', ?)
    `).run(`crun_alive_${job}`, job, freshTime, freshTime, freshTime);
  }

  const status = await getPublicationOperationsStatus(db);

  for (const job of [CRON_JOB_PLANNER, CRON_JOB_RECONCILER, CRON_JOB_DISPATCHER]) {
    const hb = status.heartbeats[job];
    assert.equal(hb.health, 'BLOCKED', `${job} health must be BLOCKED`);
    assert.equal(hb.is_stale, false, `${job} must not be stale`);
  }

  const criticalHeartbeatAlerts = status.alerts.filter(a => a.type === 'CRON_HEARTBEAT_MISSING' && a.severity === 'CRITICAL');
  assert.equal(criticalHeartbeatAlerts.length, 0, 'Must not emit any CRITICAL heartbeat alert when cron is alive under mode OFF');
});

// 21. Article 6 Golden Fixture Receipt Integrity Test
await runTestAsync('Test 21: ARTICLE_6_RECEIPT_INTEGRITY (Article 6 golden fixture has valid receipt with 0 integrity errors)', async () => {
  const localD1Path = path.resolve(
    process.cwd(),
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/37bd9da5950b040e71b09fbfd7ca57290acb451dcd5dc35acb02655fa75fa480.sqlite'
  );

  if (fs.existsSync(localD1Path)) {
    const rawDb = new DatabaseSync(localD1Path);
    // Wrap with D1 shim
    const db = {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                return rawDb.prepare(sql).get(...args);
              },
              async all() {
                const results = rawDb.prepare(sql).all(...args);
                return { results };
              },
              async run() {
                return rawDb.prepare(sql).run(...args);
              }
            };
          },
          async first() {
            return rawDb.prepare(sql).get();
          },
          async all() {
            const results = rawDb.prepare(sql).all();
            return { results };
          },
          async run() {
            return rawDb.prepare(sql).run();
          }
        };
      }
    };

    const status = await getPublicationOperationsStatus(db);

    const a6ReceiptAlerts = status.alerts.filter(a => a.type === 'RECEIPT_INTEGRITY_ERROR' && a.article_id === 6);
    assert.equal(a6ReceiptAlerts.length, 0, 'Article 6 must have 0 receipt integrity alerts');

    const a6Missing = status.receipt_integrity.missing_receipts.filter(r => r.article_id === 6);
    assert.equal(a6Missing.length, 0, 'Article 6 must not be in missing receipts');
  }
});

console.log(`\n============================================================`);
console.log(`PHASE 5L10 TESTS COMPLETED: ${passed} PASSED, 0 FAILED`);
console.log(`============================================================\n`);
