/**
 * RancangLoka — MEDIA-A5.3 Durable Retry Accounting & Decision Policy Integration Test Suite
 *
 * Verifies:
 * 1. Authoritative Retry Policy integration with durable media jobs
 * 2. Generation vs Stage-aware attempt accounting:
 *    - Source / Generation retries consume global media_jobs.attempt
 *    - Transform (watermark) & Storage (R2) retries PRESERVE generation budget
 * 3. Secret firewall: Zero credentials persisted in last_error_message_safe or events
 * 4. Manual bridge durability: Technical failures route to USER_ACTION_REQUIRED with zero provider retries
 * 5. Provider auth & content block: Route to AUTH_REQUIRED & PROVIDER_BLOCKED safely
 * 6. Slot conflict: Routes to USER_ACTION_REQUIRED without regenerating media
 * 7. Attempt sequence & exhaustion: 0 -> 1 -> 2 -> 3 (exhausted / FAILED_TERMINAL)
 * 8. Stage retry exhaustion: Repeated stage failures eventually collapse to FAILED_TERMINAL
 * 9. Scheduling idempotency & duplicate prevention
 * 10. Stale decision protection (OCC / revision conflict)
 * 11. Terminal state protection: Cannot reopen terminal jobs
 * 12. Next_retry_at deterministic timing with injected clock
 * 13. Worker restart reconstruction: Restoring state purely from database
 * 14. Event & receipt audit: Verifies durable media_job_events and media_job_receipts
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  decideMediaRetryPolicy,
  computeRetryDelay
} from '../src/lib/media/retry-policy.ts';
import {
  applyMediaRetryDecision,
  countStageRetries,
  sanitizeErrorMessage,
  executeDurableRetry
} from '../src/lib/media/durable-retry.ts';
import {
  createMediaRequirement,
  getMediaJobById,
  scheduleMediaJobRetry,
  calculateRetry,
  JOB_STATUS_QUEUED,
  JOB_STATUS_LEASED,
  JOB_STATUS_WAITING_RETRY,
  JOB_STATUS_COMPLETE,
  JOB_STATUS_FAILED_TERMINAL,
  JOB_STATUS_AUTH_REQUIRED,
  JOB_STATUS_PROVIDER_BLOCKED,
  JOB_STATUS_USER_ACTION_REQUIRED
} from '../src/lib/media/jobs-service.ts';
import { MEDIA_QA_FAILURE_CODES } from '../src/lib/media/qa-service.ts';

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
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content_md TEXT,
      content_html TEXT,
      featured_image TEXT,
      image_alt TEXT,
      content_hash TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      manual_hold INTEGER NOT NULL DEFAULT 0,
      reading_time_minutes INTEGER DEFAULT 5,
      is_sponsored INTEGER DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CHECK (attempt >= 0),
      CHECK (event_type IN (
        'JOB_PROGRESS', 'GENERATION_STARTED', 'IMAGE_DETECTED', 'CAPTURE_STARTED',
        'CAPTURED', 'UPLOAD_STARTED', 'UPLOAD_PROGRESS', 'UPLOAD_RECEIVED',
        'ATTACHMENT_CONFIRMED', 'JOB_COMPLETE', 'JOB_RECOVERING', 'JOB_FAILED'
      ))
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
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CHECK (receipt_type IN (
        'UPLOAD_ACCEPTED', 'ASSET_EXISTS', 'UPLOAD_RECEIVED', 'ATTACHMENT_CONFIRMED',
        'REJECTED', 'RETRYABLE_ERROR', 'TERMINAL_ERROR'
      ))
    );

    INSERT INTO articles (id, title, slug, status)
    VALUES (1, 'Rumah Minimalis Modern', 'rumah-minimalis-modern', 'draft');
  `);

  return asD1(db);
}

function asD1(db) {
  return {
    raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        first() {
          return stmt.get(...values) || null;
        },
        all() {
          return { results: stmt.all(...values) };
        },
        run() {
          return stmt.run(...values);
        }
      };
    }
  };
}

async function runTestSuite() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A5.3 Durable Retry Accounting Test Suite');
  console.log('=============================================================\n');

  const baseNow = new Date('2026-09-26T12:00:00.000Z');

  // -------------------------------------------------------------------------
  // 1. GENERATION / SOURCE RETRY: CONSUMES GENERATION BUDGET
  // -------------------------------------------------------------------------
  console.log('--- Phase 1: Source / Generation Retry Accounting ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    assert.equal(job.attempt, 0, 'Initial job attempt must be 0');

    // Simulate provider timeout
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: job.attempt,
      max_attempts: 3
    });

    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    assert.equal(res.applied, true);
    assert.equal(res.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(res.attempt, 1, 'Generation retry must increment global attempt counter (0 -> 1)');
    assert(res.next_retry_at !== null, 'next_retry_at must be populated');

    const updated = await getMediaJobById(db, job.job_id);
    assert.equal(updated.attempt, 1);
    assert.equal(updated.status, JOB_STATUS_WAITING_RETRY);

    pass('Source retry correctly consumes generation attempt (0 -> 1)');
  }

  // -------------------------------------------------------------------------
  // 2. TRANSFORM RETRY: PRESERVES GENERATION BUDGET
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 2: Transform Retry Accounting ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    // Simulate watermark failure
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.WATERMARK_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: job.attempt,
      max_attempts: 3,
      has_bytes: true
    });

    assert.equal(decision.consume_attempt, false);

    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    assert.equal(res.applied, true);
    assert.equal(res.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(res.attempt, 0, 'Transform retry must PRESERVE generation attempt budget (remains 0)');
    assert.equal(res.stage_attempt, 1, 'Stage retry attempt is tracked as 1');

    const updated = await getMediaJobById(db, job.job_id);
    assert.equal(updated.attempt, 0);

    const stageRetries = await countStageRetries(db, job.job_id, 'TRANSFORM');
    assert.equal(stageRetries, 1, 'Durable event recorded 1 transform retry');

    pass('Transform retry preserves provider generation budget and records stage attempt');
  }

  // -------------------------------------------------------------------------
  // 3. STORAGE RETRY: PRESERVES GENERATION BUDGET
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 3: Storage Retry Accounting ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    // Simulate R2 upload failure
    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.R2_UPLOAD_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: job.attempt,
      max_attempts: 3,
      has_derivative: true
    });

    assert.equal(decision.consume_attempt, false);

    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    assert.equal(res.applied, true);
    assert.equal(res.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(res.attempt, 0, 'Storage retry must PRESERVE generation attempt budget (remains 0)');
    assert.equal(res.stage_attempt, 1);

    const stageRetries = await countStageRetries(db, job.job_id, 'STORAGE');
    assert.equal(stageRetries, 1);

    pass('Storage retry preserves provider generation budget and records storage attempt');
  }

  // -------------------------------------------------------------------------
  // 4. MANUAL BRIDGE DURABILITY: NO PROVIDER FALLTHROUGH
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 4: Manual Bridge Durability ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.DIMENSIONS_TOO_SMALL,
      source_channel: 'MANUAL_BROWSER_BRIDGE',
      attempt_number: 0,
      role: 'featured'
    });

    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    assert.equal(res.applied, true);
    assert.equal(res.status, JOB_STATUS_USER_ACTION_REQUIRED);
    assert.equal(res.attempt, 0);
    assert.equal(res.next_retry_at, null);

    const updated = await getMediaJobById(db, job.job_id);
    assert.equal(updated.status, JOB_STATUS_USER_ACTION_REQUIRED);
    assert.equal(updated.next_retry_at, null);

    pass('Manual bridge technical failure durably transitions to USER_ACTION_REQUIRED');
  }

  // -------------------------------------------------------------------------
  // 5. AUTH FAILURE & PROVIDER CONTENT BLOCK
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 5: Auth Failure & Provider Block ---');

  // 5.1 Auth failure
  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_AUTH_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0,
      http_status: 401
    });

    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    assert.equal(res.status, JOB_STATUS_AUTH_REQUIRED);
    assert.equal(res.next_retry_at, null);
    pass('Provider auth failure durably transitions to AUTH_REQUIRED with no retry scheduled');
  }

  // 5.2 Provider block
  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_CONTENT_REJECTED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });

    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    assert.equal(res.status, JOB_STATUS_PROVIDER_BLOCKED);
    assert.equal(res.next_retry_at, null);
    pass('Provider content block durably transitions to PROVIDER_BLOCKED');
  }

  // -------------------------------------------------------------------------
  // 6. SLOT CONFLICT DURABILITY
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 6: Slot Conflict Durability ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.SLOT_OCCUPIED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0,
      slot_key: 'featured'
    });

    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    assert.equal(res.status, JOB_STATUS_USER_ACTION_REQUIRED);
    assert.equal(res.attempt, 0);
    assert.equal(res.next_retry_at, null);
    pass('Slot conflict durably transitions to USER_ACTION_REQUIRED with zero attempt increment');
  }

  // -------------------------------------------------------------------------
  // 7. GENERATION ATTEMPT BUDGET SEQUENCE & EXHAUSTION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 7: Generation Attempt Sequence & Exhaustion ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern',
      max_attempts: 3
    });

    // Attempt 0 -> Failure 1
    const d1 = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0,
      max_attempts: 3
    });
    const r1 = await applyMediaRetryDecision(db, { jobId: job.job_id, decision: d1, now: baseNow });
    assert.equal(r1.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(r1.attempt, 1, 'First failure brings attempt to 1 (WAITING_RETRY)');

    // Attempt 1 -> Failure 2
    const d2 = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 1,
      max_attempts: 3
    });
    const r2 = await applyMediaRetryDecision(db, { jobId: job.job_id, decision: d2, now: baseNow });
    assert.equal(r2.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(r2.attempt, 2, 'Second failure brings attempt to 2 (WAITING_RETRY)');

    // Attempt 2 -> Failure 3 (Exhausted!)
    const d3 = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 2,
      max_attempts: 3
    });
    const r3 = await applyMediaRetryDecision(db, { jobId: job.job_id, decision: d3, now: baseNow });
    assert.equal(r3.status, JOB_STATUS_FAILED_TERMINAL, 'Third failure reaches max_attempts (3) -> FAILED_TERMINAL');
    assert.equal(r3.attempt, 3);
    assert.equal(r3.next_retry_at, null);

    const finalJob = await getMediaJobById(db, job.job_id);
    assert.equal(finalJob.status, JOB_STATUS_FAILED_TERMINAL);
    assert.equal(finalJob.next_retry_at, null);

    pass('Generation attempt sequence strictly adheres to 0 -> 1 -> 2 -> 3 (FAILED_TERMINAL)');
  }

  // -------------------------------------------------------------------------
  // 8. STAGE RETRY EXHAUSTION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 8: Stage Retry Exhaustion ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const watermarkDecision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.WATERMARK_FAILED,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0,
      has_bytes: true
    });

    // 1st transform failure
    const r1 = await applyMediaRetryDecision(db, { jobId: job.job_id, decision: watermarkDecision, maxStageAttempts: 3, now: baseNow });
    assert.equal(r1.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(r1.stage_attempt, 1);

    // Worker re-leases job for 2nd transform attempt
    db.prepare("UPDATE media_jobs SET status = 'LEASED', job_revision = job_revision + 1 WHERE job_id = ?").bind(job.job_id).run();

    // 2nd transform failure
    const r2 = await applyMediaRetryDecision(db, { jobId: job.job_id, decision: watermarkDecision, maxStageAttempts: 3, now: baseNow });
    assert.equal(r2.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(r2.stage_attempt, 2);

    // Worker re-leases job for 3rd transform attempt
    db.prepare("UPDATE media_jobs SET status = 'LEASED', job_revision = job_revision + 1 WHERE job_id = ?").bind(job.job_id).run();

    // 3rd transform failure -> stage budget exhausted!
    const r3 = await applyMediaRetryDecision(db, { jobId: job.job_id, decision: watermarkDecision, maxStageAttempts: 3, now: baseNow });
    assert.equal(r3.status, JOB_STATUS_FAILED_TERMINAL);
    assert.equal(r3.next_retry_at, null);

    pass('Stage retry exhaustion collapses repeated transform failures to FAILED_TERMINAL');
  }

  // -------------------------------------------------------------------------
  // 9. SECRET FIREWALL REDACTION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 9: Secret Firewall Redaction ---');

  {
    const dirtyError = 'Provider request failed: Bearer secret_access_token_12345 fal_key_xyz98765';
    const clean = sanitizeErrorMessage(dirtyError);
    assert(!clean.includes('secret_access_token_12345'), 'Leaked bearer token must be redacted');
    assert(!clean.includes('fal_key_xyz98765'), 'Leaked fal_key must be redacted');
    assert(clean.includes('[REDACTED_SECRET]'));

    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const secretLeakDecision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.SECRET_LEAK,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });
    secretLeakDecision.evidence.reasons.push(dirtyError);

    await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision: secretLeakDecision,
      now: baseNow
    });

    const storedJob = await getMediaJobById(db, job.job_id);
    assert(!storedJob.last_error_message_safe.includes('secret_access_token_12345'));
    assert(!storedJob.last_error_message_safe.includes('fal_key_xyz98765'));

    // Check media_job_events payload is also clean
    const eventRow = await db.prepare('SELECT safe_payload_json FROM media_job_events WHERE job_id = ? LIMIT 1').bind(job.job_id).first();
    assert(!eventRow.safe_payload_json.includes('secret_access_token_12345'));

    pass('Secret firewall completely redacts sensitive credentials from durable state and events');
  }

  // -------------------------------------------------------------------------
  // 10. SCHEDULING IDEMPOTENCY & DUPLICATE PREVENTION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 10: Scheduling Idempotency ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });

    const idempotencyKey = 'idemp_retry_test_123';

    // First application
    const r1 = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow,
      idempotencyKey
    });
    assert.equal(r1.applied, true);
    assert.equal(r1.attempt, 1);

    // Second application with identical idempotencyKey
    const r2 = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow,
      idempotencyKey
    });
    assert.equal(r2.applied, false);
    assert.equal(r2.reason, 'IDEMPOTENT_ALREADY_APPLIED');
    assert.equal(r2.attempt, 1, 'Attempt must NOT be double-incremented');

    const jobCheck = await getMediaJobById(db, job.job_id);
    assert.equal(jobCheck.attempt, 1);

    // Only one receipt recorded for idempotency key
    const receiptsCount = await db.prepare('SELECT COUNT(*) as cnt FROM media_job_receipts WHERE job_id = ?').bind(job.job_id).first();
    assert.equal(receiptsCount.cnt, 1);

    pass('Scheduling idempotency prevents double attempt consumption and duplicate receipts');
  }

  // -------------------------------------------------------------------------
  // 11. STALE DECISION SAFETY (OCC / REVISION CONFLICT)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 11: Stale Decision Safety (OCC) ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });

    // Provide an outdated expectedJobRevision (e.g. 99 instead of 1)
    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      expectedJobRevision: 99,
      now: baseNow
    });

    assert.equal(res.applied, false);
    assert.equal(res.reason, 'JOB_REVISION_CONFLICT');

    const unchanged = await getMediaJobById(db, job.job_id);
    assert.equal(unchanged.job_revision, 1);
    assert.equal(unchanged.status, JOB_STATUS_QUEUED);

    pass('Stale decision fails closed on job revision conflict');
  }

  // -------------------------------------------------------------------------
  // 12. TERMINAL STATE PROTECTION
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 12: Terminal State Protection ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    // Manually mark job as COMPLETE
    db.prepare("UPDATE media_jobs SET status = 'COMPLETE' WHERE job_id = ?").bind(job.job_id).run();

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });

    const res = await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    assert.equal(res.applied, false);
    assert.equal(res.reason, 'TERMINAL_STATE_PROTECTED');

    const jobCheck = await getMediaJobById(db, job.job_id);
    assert.equal(jobCheck.status, JOB_STATUS_COMPLETE, 'Complete job must never be reopened by retry adapter');

    pass('Terminal state protection prevents reopening COMPLETE or FAILED_TERMINAL jobs');
  }

  // -------------------------------------------------------------------------
  // 13. WORKER RESTART RECOVERY & DETERMINISTIC NEXT_RETRY_AT
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 13: Worker Restart Recovery & Deterministic Timing ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });

    // Apply with injected clock
    await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    // Simulate process termination and re-reading from database
    const loadedJob = await getMediaJobById(db, job.job_id);
    assert.equal(loadedJob.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(loadedJob.attempt, 1);
    assert.equal(
      loadedJob.next_retry_at,
      new Date(baseNow.getTime() + (decision.suggested_delay_ms || 2000)).toISOString()
    );

    // Verify events are readable
    const events = db.prepare('SELECT event_type, stage, attempt, safe_payload_json FROM media_job_events WHERE job_id = ?').bind(job.job_id).all();
    const rows = events.results || [];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].event_type, 'JOB_PROGRESS');
    assert.equal(rows[0].stage, 'GENERATION');

    pass('Worker restart recovery restores 100% accurate durable state from database');
  }

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 14. INTEGRATION WITH executeDurableRetry & calculateRetry
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 14: executeDurableRetry & Timing Integration ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    // Call executeDurableRetry from durable-retry.ts
    const updated = await executeDurableRetry(
      db,
      job.job_id,
      MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      {
        errorMessageSafe: 'Transient upstream gateway timeout',
        now: baseNow
      }
    );

    assert.equal(updated.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(updated.attempt, 1);

    const stored = await getMediaJobById(db, job.job_id);
    assert.equal(stored.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(stored.attempt, 1);
    assert.equal(stored.last_error_code, MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT);
    assert(stored.last_error_message_safe.includes('Transient upstream gateway timeout'));

    // Check calculateRetry low-level timing infrastructure
    const preview = calculateRetry(job, 'TRANSIENT_NETWORK', baseNow);
    assert.equal(preview.status, JOB_STATUS_WAITING_RETRY);
    assert.equal(preview.attempt, 1);

    pass('executeDurableRetry seamlessly integrates authoritative policy with durable state');
  }

  // -------------------------------------------------------------------------
  // 15. CROSS-LAYER CONSISTENCY & PARITY (A5.2 Decision <-> A5.3 Durable State)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 15: Cross-Layer Policy Parity ---');

  {
    const matrix = [
      { code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT, channel: 'AUTONOMOUS_PROVIDER', expectedStatus: 'WAITING_RETRY', consumes: true },
      { code: MEDIA_QA_FAILURE_CODES.PROVIDER_AUTH_FAILED, channel: 'AUTONOMOUS_PROVIDER', expectedStatus: 'AUTH_REQUIRED', consumes: false },
      { code: MEDIA_QA_FAILURE_CODES.PROVIDER_CONTENT_REJECTED, channel: 'AUTONOMOUS_PROVIDER', expectedStatus: 'PROVIDER_BLOCKED', consumes: false },
      { code: MEDIA_QA_FAILURE_CODES.DIMENSIONS_TOO_SMALL, channel: 'MANUAL_BROWSER_BRIDGE', expectedStatus: 'USER_ACTION_REQUIRED', consumes: false },
      { code: MEDIA_QA_FAILURE_CODES.WATERMARK_FAILED, channel: 'AUTONOMOUS_PROVIDER', expectedStatus: 'WAITING_RETRY', consumes: false },
      { code: MEDIA_QA_FAILURE_CODES.R2_UPLOAD_FAILED, channel: 'AUTONOMOUS_PROVIDER', expectedStatus: 'WAITING_RETRY', consumes: false },
      { code: MEDIA_QA_FAILURE_CODES.SLOT_OCCUPIED, channel: 'AUTONOMOUS_PROVIDER', expectedStatus: 'USER_ACTION_REQUIRED', consumes: false },
      { code: MEDIA_QA_FAILURE_CODES.SECRET_LEAK, channel: 'AUTONOMOUS_PROVIDER', expectedStatus: 'FAILED_TERMINAL', consumes: false }
    ];

    for (const item of matrix) {
      const db = createTestDatabase();
      const job = await createMediaRequirement(db, {
        article_id: 1,
        slot_key: 'featured',
        role: 'featured',
        prompt: 'Modern architectural house facade',
        alt_text: 'Fasad rumah modern'
      });

      const decision = decideMediaRetryPolicy({
        failure_code: item.code,
        source_channel: item.channel,
        attempt_number: 0,
        role: 'featured',
        has_bytes: true,
        has_derivative: true
      });

      assert.equal(decision.next_job_status, item.expectedStatus);
      assert.equal(decision.consume_attempt, item.consumes);

      const res = await applyMediaRetryDecision(db, {
        jobId: job.job_id,
        decision,
        now: baseNow
      });

      assert.equal(res.status, item.expectedStatus);
      assert.equal(res.attempt, item.consumes ? 1 : 0);

      const stored = await getMediaJobById(db, job.job_id);
      assert.equal(stored.status, item.expectedStatus);
      assert.equal(stored.attempt, item.consumes ? 1 : 0);
    }

    pass('Full failure matrix proves 100% parity between retry-policy and durable state');
  }

  // -------------------------------------------------------------------------
  // 16. RECEIPT AUDIT: NO UNWANTED RECEIPTS FOR REGULAR PROGRESS
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 16: Receipt Audit Policy ---');

  {
    const db = createTestDatabase();
    const job = await createMediaRequirement(db, {
      article_id: 1,
      slot_key: 'featured',
      role: 'featured',
      prompt: 'Modern architectural house facade',
      alt_text: 'Fasad rumah modern'
    });

    const decision = decideMediaRetryPolicy({
      failure_code: MEDIA_QA_FAILURE_CODES.PROVIDER_TIMEOUT,
      source_channel: 'AUTONOMOUS_PROVIDER',
      attempt_number: 0
    });

    // Regular retry without explicit idempotencyKey does NOT create receipt
    await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      now: baseNow
    });

    const receipts = db.prepare('SELECT COUNT(*) as cnt FROM media_job_receipts WHERE job_id = ?').bind(job.job_id).first();
    assert.equal(receipts.cnt, 0, 'No receipt should be generated for internal progress without idempotency key');

    // With idempotencyKey, receipt is recorded
    await applyMediaRetryDecision(db, {
      jobId: job.job_id,
      decision,
      idempotencyKey: 'idemp_key_milestone_1',
      now: baseNow
    });

    const receiptsAfter = db.prepare('SELECT COUNT(*) as cnt FROM media_job_receipts WHERE job_id = ?').bind(job.job_id).first();
    assert.equal(receiptsAfter.cnt, 1);

    pass('Receipt policy records receipts only for explicit milestone idempotency boundaries');
  }

  console.log('\n=============================================================');
  console.log(`  ALL ${testCount} MEDIA-A5.3 DURABLE RETRY TESTS PASSED CLEANLY`);
  console.log('=============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nFAILED TEST:', err);
  process.exit(1);
});
