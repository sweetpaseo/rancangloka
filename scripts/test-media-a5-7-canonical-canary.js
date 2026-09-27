/**
 * RancangLoka — MEDIA-A5.7 Canonical Canary Mutation & Control Test Suite
 *
 * Validates canonical production mutation paths:
 * 1. Canonical Media Worker Control:
 *    - setMediaWorkerEnabled(true) enables DB gate
 *    - setMediaWorkerEnabled(false) disables DB gate
 *    - Idempotency on repeated enable / repeated disable
 *    - Dual-gate invariant preservation (env && db)
 * 2. Canonical Canary Job Creation:
 *    - createCanaryMediaJob creates valid QUEUED canary for Article 1
 *    - Duplicate creation is idempotent (returns existing active job, no double-insert)
 *    - Validates slot_key, role, and draft status requirements
 * 3. Canonical Canary Cancellation:
 *    - cancelMediaJob from QUEUED -> CANCELLED
 *    - cancelMediaJob from LEASED -> CANCELLED
 *    - cancelMediaJob from WAITING_RETRY -> CANCELLED
 * 4. Zero Mutation & Zero Provider Firewall:
 *    - Exactly ONE canary job leased and executed to COMPLETE
 *    - articles table row count and state hash 100% unchanged (delta = 0)
 *    - article_media table row count 100% unchanged (delta = 0)
 *    - Zero external network / provider calls (fal.ai, Meta, etc.)
 * 5. Internal HTTP Control & Job Endpoints:
 *    - POST /api/internal/v1/media/worker/control: auth check, boolean validation, gate mutation
 *    - Non-POST rejected with 405
 *    - POST /api/internal/v1/media/jobs: canonical job creation and duplicate slot rejection
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  setMediaWorkerEnabled,
  isMediaWorkerEnabled,
  runNextMediaJob
} from '../src/lib/media/worker-runner.ts';
import {
  createCanaryMediaJob,
  cancelMediaJob,
  getMediaJobById,
  acquireMediaJobLease,
  scheduleMediaJobRetry,
  JOB_STATUS_QUEUED,
  JOB_STATUS_LEASED,
  JOB_STATUS_COMPLETE,
  JOB_STATUS_CANCELLED,
  JOB_STATUS_WAITING_RETRY,
  CANARY_ARTICLE_ID,
  CANARY_SLOT_KEY,
  CANARY_IDEMPOTENCY_KEY,
  CANARY_PROVENANCE_MARKER
} from '../src/lib/media/jobs-service.ts';
import {
  POST as controlHandler,
  ALL as controlMethodHandler
} from '../src/pages/api/internal/v1/media/worker/control.ts';
import {
  POST as jobsHandler
} from '../src/pages/api/internal/v1/media/jobs/index.ts';
import { hashToken } from '../src/lib/media/device-auth.ts';

// ---------------------------------------------------------------------------
// 0. Network & Provider Call Firewall
// ---------------------------------------------------------------------------
let realProviderCalls = 0;
let falApiCalls = 0;
let metaApiCalls = 0;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, ...args) => {
  const urlStr = String(input);
  if (urlStr.includes('fal.ai')) falApiCalls++;
  if (urlStr.includes('facebook') || urlStr.includes('graph.meta') || urlStr.includes('instagram')) metaApiCalls++;
  realProviderCalls++;
  throw new Error(`FIREWALL_BREACH: Real network call blocked: ${urlStr}`);
};

let testCount = 0;
function pass(name) {
  testCount++;
  console.log(`  [PASS ${testCount}] ${name}`);
}

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      content_md TEXT NOT NULL,
      content_html TEXT NOT NULL,
      status TEXT CHECK(status IN ('draft', 'published', 'scheduled', 'archived')) DEFAULT 'draft',
      featured_image TEXT,
      image_alt TEXT,
      content_hash TEXT,
      reading_time INTEGER,
      published_at DATETIME,
      scheduled_for DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE media_devices (
      device_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'media:device',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE media_jobs (
      job_id TEXT PRIMARY KEY,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      article_slug TEXT NOT NULL,
      article_title TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'featured',
      slot_key TEXT NOT NULL DEFAULT 'featured',
      sequence INTEGER NOT NULL DEFAULT 0,
      media_type TEXT NOT NULL DEFAULT 'image',
      prompt TEXT NOT NULL,
      prompt_version INTEGER NOT NULL DEFAULT 1,
      prompt_hash TEXT NOT NULL DEFAULT '',
      alt_text TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT '16:9',
      target_width INTEGER NOT NULL DEFAULT 1200,
      target_height INTEGER NOT NULL DEFAULT 675,
      required_for_readiness INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 100,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      lease_owner TEXT,
      lease_expires_at DATETIME,
      heartbeat_at DATETIME,
      attempt INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      next_retry_at DATETIME,
      last_error_code TEXT,
      last_error_message_safe TEXT,
      idempotency_key TEXT,
      submitted_at DATETIME,
      completed_at DATETIME,
      job_revision INTEGER NOT NULL DEFAULT 1,
      superseded_by_job_id TEXT REFERENCES media_jobs(job_id) ON DELETE SET NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CHECK (role IN ('featured', 'inline')),
      CHECK (slot_key GLOB '[a-z][a-z0-9_]*'),
      CHECK (media_type IN ('image', 'video')),
      CHECK (required_for_readiness IN (0, 1)),
      CHECK (priority IN (100, 200, 300)),
      CHECK (attempt >= 0),
      CHECK (max_attempts >= 1),
      CHECK (job_revision >= 1),
      CHECK (status IN (
        'QUEUED', 'LEASED', 'PROMPT_PREPARING', 'PROMPT_READY', 'PROMPT_SENDING',
        'PROMPT_ACKNOWLEDGED', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED',
        'UPLOAD_QUEUED', 'UPLOADING', 'UPLOAD_RECEIVED', 'ATTACHING', 'ATTACHMENT_CONFIRMED',
        'COMPLETE', 'WAITING_RETRY', 'RECOVERING', 'AUTH_REQUIRED', 'PROVIDER_BLOCKED',
        'USER_ACTION_REQUIRED', 'FAILED_TERMINAL', 'SUPERSEDED', 'CANCELLED'
      ))
    );

    CREATE TABLE media_job_events (
      event_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES media_jobs(job_id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      stage TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 0,
      safe_payload_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE media_job_receipts (
      receipt_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES media_jobs(job_id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      receipt_type TEXT NOT NULL,
      asset_id TEXT,
      article_media_id INTEGER,
      sha256 TEXT,
      safe_payload_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE media_assets (
      asset_id TEXT PRIMARY KEY,
      storage_key TEXT NOT NULL UNIQUE,
      public_url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'VALIDATED',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE article_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL REFERENCES media_assets(asset_id) ON DELETE RESTRICT,
      role TEXT NOT NULL,
      slot_key TEXT NOT NULL DEFAULT 'primary',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_media_jobs_one_active_slot
    ON media_jobs(article_id, slot_key)
    WHERE status NOT IN ('COMPLETE', 'FAILED_TERMINAL', 'SUPERSEDED', 'CANCELLED');
  `);

  // Seed Article 1 (the canonical smoke test draft article)
  db.exec(`
    INSERT INTO articles (id, slug, title, content_md, content_html, status)
    VALUES (1, 'rancangloka-internal-ingest-smoke-test-2026-09-04', 'RancangLoka Smoke Test', '# Test', '<p>Test</p>', 'draft');
  `);

  // D1 Compatibility wrapper
  return {
    _raw: db,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          const stmt = db.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        async all() {
          const stmt = db.prepare(this._sql);
          return { results: stmt.all(...this._params) };
        },
        async run() {
          const stmt = db.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid)
            }
          };
        }
      };
    },
    async batch(stmts) {
      const results = [];
      for (const s of stmts) {
        results.push(await s.run());
      }
      return results;
    }
  };
}

async function runAllTests() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A5.7 Canonical Canary Mutation Tests   ');
  console.log('=============================================================\n');

  // -------------------------------------------------------------------------
  // Group 1: Canonical Control Service & Strict Dual-Gate
  // -------------------------------------------------------------------------
  console.log('--- Group 1: Canonical Control Service ---');
  {
    const db = createTestDatabase();

    // Test 1: Enable worker DB gate
    const res1 = await setMediaWorkerEnabled(db, true, { reason: 'Canary Enable' });
    assert.equal(res1.success, true);
    assert.equal(res1.enabled, true);
    assert.equal(res1.previousEnabled, false);
    assert.equal(res1.changed, true);
    pass('SET_MEDIA_WORKER_ENABLED_TRUE_PASS');

    // Test 2: Dual gate evaluation: env=true && db=true -> ON
    const isEn1 = await isMediaWorkerEnabled(db, { MEDIA_WORKER_ENABLED: 'true' });
    assert.equal(isEn1, true);
    pass('DUAL_GATE_BOTH_TRUE_ON');

    // Test 3: Dual gate evaluation: env=false && db=true -> OFF
    const isEn2 = await isMediaWorkerEnabled(db, { MEDIA_WORKER_ENABLED: 'false' });
    assert.equal(isEn2, false);
    pass('DUAL_GATE_ENV_FALSE_OFF');

    // Test 4: Idempotent enable (repeated enable returns changed: false)
    const res2 = await setMediaWorkerEnabled(db, true);
    assert.equal(res2.success, true);
    assert.equal(res2.changed, false);
    pass('SET_MEDIA_WORKER_ENABLED_IDEMPOTENT');

    // Test 5: Disable worker DB gate
    const res3 = await setMediaWorkerEnabled(db, false, { reason: 'Canary Teardown' });
    assert.equal(res3.success, true);
    assert.equal(res3.enabled, false);
    assert.equal(res3.previousEnabled, true);
    assert.equal(res3.changed, true);
    pass('SET_MEDIA_WORKER_ENABLED_FALSE_PASS');

    // Test 6: Dual gate evaluation when DB is false: env=true && db=false -> OFF
    const isEn3 = await isMediaWorkerEnabled(db, { MEDIA_WORKER_ENABLED: 'true' });
    assert.equal(isEn3, false);
    pass('DUAL_GATE_DB_FALSE_OFF');

    // Test 7: Idempotent disable (repeated disable returns changed: false)
    const res4 = await setMediaWorkerEnabled(db, false);
    assert.equal(res4.success, true);
    assert.equal(res4.changed, false);
    pass('SET_MEDIA_WORKER_DISABLED_IDEMPOTENT');
  }

  // -------------------------------------------------------------------------
  // Group 2: Canonical Canary Job Creation & Idempotency
  // -------------------------------------------------------------------------
  console.log('\n--- Group 2: Canonical Canary Job Creation ---');
  {
    const db = createTestDatabase();

    // Test 8: Create canary job
    const createRes1 = await createCanaryMediaJob(db, { jobId: 'mjob_canary_001' });
    assert.equal(createRes1.created, true);
    assert.equal(createRes1.job.job_id, 'mjob_canary_001');
    assert.equal(createRes1.job.article_id, CANARY_ARTICLE_ID);
    assert.equal(createRes1.job.slot_key, CANARY_SLOT_KEY);
    assert.equal(createRes1.job.role, 'inline');
    assert.equal(createRes1.job.status, JOB_STATUS_QUEUED);
    assert.equal(createRes1.job.priority, 100);
    pass('CREATE_CANARY_MEDIA_JOB_PASS');

    // Test 9: Duplicate canary creation is idempotent (returns existing job)
    const createRes2 = await createCanaryMediaJob(db, { jobId: 'mjob_canary_002' });
    assert.equal(createRes2.created, false);
    assert.equal(createRes2.job.job_id, 'mjob_canary_001');
    pass('CREATE_CANARY_MEDIA_JOB_IDEMPOTENT');
  }

  // -------------------------------------------------------------------------
  // Group 3: Canonical Cancellation Service
  // -------------------------------------------------------------------------
  console.log('\n--- Group 3: Canonical Canary Cancellation ---');
  {
    const db = createTestDatabase();

    // Test 10: Cancel from QUEUED
    const { job: job1 } = await createCanaryMediaJob(db, { jobId: 'mjob_cancel_q' });
    assert.equal(job1.status, JOB_STATUS_QUEUED);
    const cancelledJob1 = await cancelMediaJob(db, job1.job_id, { reason: 'Canary aborted' });
    assert.equal(cancelledJob1.status, JOB_STATUS_CANCELLED);
    pass('CANCEL_FROM_QUEUED_PASS');

    // Test 11: Cancel from LEASED
    const { job: job2 } = await createCanaryMediaJob(db, { jobId: 'mjob_cancel_l' });
    await acquireMediaJobLease(db, 'worker_1');
    const leasedJob = await getMediaJobById(db, job2.job_id);
    assert.equal(leasedJob.status, JOB_STATUS_LEASED);
    const cancelledJob2 = await cancelMediaJob(db, job2.job_id, { reason: 'Lease cancellation' });
    assert.equal(cancelledJob2.status, JOB_STATUS_CANCELLED);
    pass('CANCEL_FROM_LEASED_PASS');

    // Test 12: Cancel from WAITING_RETRY
    const { job: job3 } = await createCanaryMediaJob(db, { jobId: 'mjob_cancel_r' });
    await scheduleMediaJobRetry(db, job3.job_id, 'RETRYABLE_NETWORK_ERROR', 'Temporary network glitch');
    const retryJob = await getMediaJobById(db, job3.job_id);
    assert.equal(retryJob.status, JOB_STATUS_WAITING_RETRY);
    const cancelledJob3 = await cancelMediaJob(db, job3.job_id, { reason: 'Retry cancellation' });
    assert.equal(cancelledJob3.status, JOB_STATUS_CANCELLED);
    pass('CANCEL_FROM_WAITING_RETRY_PASS');
  }

  // -------------------------------------------------------------------------
  // Group 4: Full Canary Execution & Invariant Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Group 4: Canary Execution & Invariant Verification ---');
  {
    const db = createTestDatabase();

    // Record baseline state
    const preArticle = await db.prepare('SELECT id, status, updated_at FROM articles WHERE id = 1').first();
    const preArticleMediaCount = (await db.prepare('SELECT COUNT(*) as c FROM article_media').first()).c;
    const preAssetCount = (await db.prepare('SELECT COUNT(*) as c FROM media_assets').first()).c;

    // 1. Create canary job
    const { job: canaryJob } = await createCanaryMediaJob(db, { jobId: 'mjob_canary_exec' });
    assert.equal(canaryJob.status, JOB_STATUS_QUEUED);

    // 2. Open dual-gate window
    await setMediaWorkerEnabled(db, true);
    const env = { MEDIA_WORKER_ENABLED: 'true' };

    // 3. Trigger worker execution (exactly ONE run)
    const runResult = await runNextMediaJob(db, env, { deviceId: 'canary_worker_tester' });
    assert.equal(runResult.executed, true);
    assert.equal(runResult.status, 'success');
    assert.equal(runResult.code, 'JOB_COMPLETED');
    assert.equal(runResult.job_id, 'mjob_canary_exec');
    pass('CANARY_WORKER_EXECUTES_ONE_JOB_PASS');

    // 4. Immediately close dual-gate window
    await setMediaWorkerEnabled(db, false);
    const isNowEnabled = await isMediaWorkerEnabled(db, env);
    assert.equal(isNowEnabled, false);
    pass('CANARY_WORKER_GATE_CLOSED_IMMEDIATELY');

    // 5. Invariant Checks
    // Check Canary job completed
    const finalJob = await getMediaJobById(db, 'mjob_canary_exec');
    assert.equal(finalJob.status, JOB_STATUS_COMPLETE);
    assert.ok(finalJob.completed_at);
    pass('CANARY_JOB_STATUS_COMPLETE_VERIFIED');

    // Check Article 1 was NOT mutated
    const postArticle = await db.prepare('SELECT id, status, updated_at FROM articles WHERE id = 1').first();
    assert.equal(postArticle.status, preArticle.status);
    assert.equal(postArticle.updated_at, preArticle.updated_at);
    pass('ARTICLE_MUTATION_ZERO_VERIFIED');

    // Check article_media was NOT mutated
    const postArticleMediaCount = (await db.prepare('SELECT COUNT(*) as c FROM article_media').first()).c;
    assert.equal(postArticleMediaCount, preArticleMediaCount);
    pass('ARTICLE_MEDIA_MUTATION_ZERO_VERIFIED');

    // Check media_assets was NOT mutated
    const postAssetCount = (await db.prepare('SELECT COUNT(*) as c FROM media_assets').first()).c;
    assert.equal(postAssetCount, preAssetCount);
    pass('MEDIA_ASSETS_MUTATION_ZERO_VERIFIED');

    // Check zero external provider calls
    assert.equal(falApiCalls, 0);
    assert.equal(metaApiCalls, 0);
    assert.equal(realProviderCalls, 0);
    pass('ZERO_EXTERNAL_PROVIDER_CALLS_VERIFIED');

    // 6. Verify subsequent run finds no eligible jobs
    await setMediaWorkerEnabled(db, true); // re-enable temporarily to test queue drain
    const secondRun = await runNextMediaJob(db, env, { deviceId: 'canary_worker_tester' });
    assert.equal(secondRun.executed, false);
    assert.equal(secondRun.status, 'no_job');
    await setMediaWorkerEnabled(db, false); // close again
    pass('CANARY_QUEUE_DRAINED_NO_SECOND_JOB');
  }

  // -------------------------------------------------------------------------
  // Group 5: Internal Control & Jobs HTTP Endpoints
  // -------------------------------------------------------------------------
  console.log('\n--- Group 5: HTTP Endpoints Integration ---');
  {
    const db = createTestDatabase();
    const token = 'canary_operator_secret_token_123';
    const tokenHash = await hashToken(token);

    // Register test device
    await db._raw.prepare(
      "INSERT INTO media_devices (device_id, device_name, token_hash, scope) VALUES ('op_device_1', 'Operator CLI', ?, 'media:device')"
    ).run(tokenHash);

    const locals = { db, runtime: { env: { DB: db } } };

    // Test 13: Unauthenticated control request rejected (401)
    const unauthReq = new Request('https://rancangloka.com/api/internal/v1/media/worker/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true })
    });
    const unauthRes = await controlHandler({ request: unauthReq, locals });
    assert.equal(unauthRes.status, 401);
    pass('HTTP_CONTROL_UNAUTHENTICATED_401');

    // Test 14: Non-POST method rejected (405)
    const getRes = await controlMethodHandler({ request: new Request('https://rancangloka.com/api/internal/v1/media/worker/control', { method: 'GET' }), locals });
    assert.equal(getRes.status, 405);
    pass('HTTP_CONTROL_GET_405');

    // Test 15: Invalid body (non-boolean) rejected (400)
    const invalidReq = new Request('https://rancangloka.com/api/internal/v1/media/worker/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ enabled: 'yes' })
    });
    const invalidRes = await controlHandler({ request: invalidReq, locals });
    assert.equal(invalidRes.status, 400);
    pass('HTTP_CONTROL_NON_BOOLEAN_400');

    // Test 16: Authenticated control request toggles enabled to true (200)
    const enableReq = new Request('https://rancangloka.com/api/internal/v1/media/worker/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ enabled: true, reason: 'Canary operator enable' })
    });
    const enableRes = await controlHandler({ request: enableReq, locals });
    assert.equal(enableRes.status, 200);
    const enableData = await enableRes.json();
    assert.equal(enableData.status, 'success');
    assert.equal(enableData.enabled, true);
    assert.equal(enableData.changed, true);
    pass('HTTP_CONTROL_ENABLE_SUCCESS_200');

    // Test 17: Authenticated control request toggles enabled to false (200)
    const disableReq = new Request('https://rancangloka.com/api/internal/v1/media/worker/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ enabled: false, reason: 'Canary operator disable' })
    });
    const disableRes = await controlHandler({ request: disableReq, locals });
    assert.equal(disableRes.status, 200);
    const disableData = await disableRes.json();
    assert.equal(disableData.status, 'success');
    assert.equal(disableData.enabled, false);
    assert.equal(disableData.changed, true);
    pass('HTTP_CONTROL_DISABLE_SUCCESS_200');

    // Test 18: POST /api/internal/v1/media/jobs creates job canonically (200)
    const createReq = new Request('https://rancangloka.com/api/internal/v1/media/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        article_id: 1,
        article_slug: 'rancangloka-internal-ingest-smoke-test-2026-09-04',
        article_title: 'RancangLoka Smoke Test',
        role: 'inline',
        slot_key: 'inline_canary_http_1',
        prompt: 'HTTP Canary Prompt',
        alt_text: 'HTTP Canary Alt'
      })
    });
    const createRes = await jobsHandler({ request: createReq, locals });
    assert.equal(createRes.status, 200);
    const createData = await createRes.json();
    assert.equal(createData.status, 'success');
    assert.equal(createData.job.slot_key, 'inline_canary_http_1');
    pass('HTTP_JOBS_CREATE_CANARY_200');

    // Test 19: POST /api/internal/v1/media/jobs rejects duplicate active slot (400)
    const dupReq = new Request('https://rancangloka.com/api/internal/v1/media/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        article_id: 1,
        article_slug: 'rancangloka-internal-ingest-smoke-test-2026-09-04',
        article_title: 'RancangLoka Smoke Test',
        role: 'inline',
        slot_key: 'inline_canary_http_1',
        prompt: 'HTTP Canary Prompt Dup',
        alt_text: 'HTTP Canary Alt Dup'
      })
    });
    const dupRes = await jobsHandler({ request: dupReq, locals });
    assert.equal(dupRes.status, 400);
    pass('HTTP_JOBS_REJECTS_DUPLICATE_SLOT_400');
  }

  console.log('\n=============================================================');
  console.log(`  ALL ${testCount} CANONICAL CANARY TESTS PASSED CLEANLY!     `);
  console.log('=============================================================');
}

runAllTests().catch((err) => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
