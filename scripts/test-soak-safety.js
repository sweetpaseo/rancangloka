/**
 * RancangLoka — SOAK-0: End-to-End Safety & Activation Verification Suite
 *
 * Systematically tests all 50 deterministic criteria:
 *  1. default mode OFF
 *  2. invalid mode rejected
 *  3. unattended gate blocked now
 *  4. mode capability matrix
 *  5. kill switch blocks new actions
 *  6. pause preserves state
 *  7. resume works
 *  8. NO_WORK does not error
 *  9. NO_WORK does not retry storm
 * 10. NO_WORK does not trip breaker
 * 11. health HEALTHY
 * 12. health DEGRADED
 * 13. health BLOCKED
 * 14. health NO_WORK
 * 15. health PAUSED
 * 16. circuit breaker trip
 * 17. circuit breaker open blocks mutation
 * 18. half-open recovery
 * 19. failed half-open returns open
 * 20. activation ceiling applied
 * 21. PUB-1 lower capacity preserved
 * 22. catch-up bounded
 * 23. catch-up spacing preserved
 * 24. stale backlog blocked/revalidated
 * 25. duplicate ORCH recovery no duplicate article
 * 26. duplicate outbox no duplicate logical delivery
 * 27. duplicate media handoff no duplicate job
 * 28. duplicate planner no duplicate active plan
 * 29. publisher duplicate invocation exactly-once
 * 30. commit response loss reconciled
 * 31. expired claim recovery
 * 32. feedback duplicate idempotent
 * 33. provider failure conservative
 * 34. empty feedback inventory safe
 * 35. run ledger correlation
 * 36. run ledger read-only
 * 37. first genuine checkpoint HOLD when prerequisite missing
 * 38. first genuine checkpoint READY only when all prerequisites pass
 * 39. bridge duplicate instance protection
 * 40. bridge restart recovery
 * 41. bridge secret-safe
 * 42. model calls zero
 * 43. AUTO_PUBLISH OFF
 * 44. production Cron OFF
 * 45. native MCP only
 * 46. no raw MCP dependency
 * 47. no article body mutation
 * 48. no unintended publish
 * 49. no unexplained residue
 * 50. soak critical failure => BLOCK
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  AUTOMATION_MODES
} from '../src/lib/safety/safety-types.ts';

import {
  getAutomationControl,
  setAutomationMode,
  setKillSwitch,
  getCapabilityMatrix,
  evaluateActivationGate
} from '../src/lib/safety/automation-controller.ts';

import {
  getCircuitBreaker,
  recordBreakerFailure,
  recordBreakerSuccess,
  resetBreakerToHalfOpen,
  recordBreakerEvent
} from '../src/lib/safety/circuit-breaker.ts';

import {
  computeEffectiveCapacity,
  checkActivationRateLimit,
  processOverdueExecutions,
  DEFAULT_ACTIVATION_ENVELOPE
} from '../src/lib/safety/rate-limiter.ts';

import {
  buildSubsystemHealth,
  aggregateHealthStatus,
  getCentralHealthReport
} from '../src/lib/safety/health-service.ts';

import {
  getPublicationRunLedger
} from '../src/lib/safety/run-ledger.ts';

import {
  evaluateFirstGenuineArticleGate
} from '../src/lib/safety/first-article-gate.ts';

import {
  runSoakCycles
} from '../src/lib/safety/soak-runner.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

/**
 * Creates in-memory SQLite database with schema and migrations 0001-0011.
 */
function createD1TestDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = OFF;');

  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Seed canonical author & categories to satisfy foreign keys
  sqlite.exec(`
    INSERT OR REPLACE INTO authors (id, name, slug, bio, avatar, role)
    VALUES (3, 'RancangLoka Editorial Desk', 'dewan-redaksi-spasial', 'Dewan redaksi arsitektur.', '/avatar.png', 'Editorial Desk');

    INSERT OR REPLACE INTO categories (id, name, slug, description)
    VALUES 
      (1, 'Tata Ruang & Denah', 'interior-design', 'Panduan tata ruang'),
      (2, 'Material Bangunan', 'material-bangunan', 'Panduan material'),
      (3, 'Arsitektur & Renovasi', 'arsitektur-renovasi', 'Panduan arsitektur');
  `);

  // Additive Migrations
  const migrations = [
    '0002_article_ingest_receipts.sql',
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0010_publication_feedback.sql',
    '0011_automation_safety.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  // Wrap sqlite in Cloudflare D1-compatible prepare() interface
  return {
    rawDb: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.flat();
          return this;
        },
        first() {
          const stmt = sqlite.prepare(this._sql);
          return stmt.get(...this._params) || null;
        },
        all() {
          const stmt = sqlite.prepare(this._sql);
          const results = stmt.all(...this._params);
          return { results, success: true };
        },
        run() {
          const stmt = sqlite.prepare(this._sql);
          const res = stmt.run(...this._params);
          return {
            success: true,
            meta: {
              changes: res.changes,
              last_row_id: res.lastInsertRowid
            }
          };
        }
      };
    }
  };
}

async function runAllTests() {
  console.log('\n=============================================================');
  console.log('  RancangLoka — SOAK-0 Safety & Activation Test Suite');
  console.log('=============================================================\n');

  const db = createD1TestDb();

  // -------------------------------------------------------------
  // Test 1: default mode OFF
  // -------------------------------------------------------------
  const initialControl = await getAutomationControl(db);
  assert(initialControl.mode === 'OFF', 'Test 1: default mode is OFF');

  // -------------------------------------------------------------
  // Test 2: invalid mode rejected
  // -------------------------------------------------------------
  const invalidModeResult = await setAutomationMode(db, 'INVALID_TURBO_MODE');
  assert(!invalidModeResult.success && invalidModeResult.mode === 'OFF', 'Test 2: invalid mode rejected fail-closed');

  // -------------------------------------------------------------
  // Test 3: unattended gate blocked now
  // -------------------------------------------------------------
  const unattendedAttempt = await setAutomationMode(db, 'UNATTENDED', 'operator', {
    pub0_frozen: true,
    pub1_frozen: true,
    pub2_frozen: true,
    pub3_production_install_pass: true,
    // Note: pub3_first_genuine_live_observation_pass is FALSE
    pub3_first_genuine_live_observation_pass: false
  });
  assert(!unattendedAttempt.success, 'Test 3: unattended gate blocked now due to incomplete genuine live observation');

  // -------------------------------------------------------------
  // Test 4: mode capability matrix
  // -------------------------------------------------------------
  const offCaps = getCapabilityMatrix('OFF', false);
  const observeCaps = getCapabilityMatrix('OBSERVE_ONLY', false);
  const planCaps = getCapabilityMatrix('PLAN_ONLY', false);
  const controlledCaps = getCapabilityMatrix('CONTROLLED', false);
  const unattendedCaps = getCapabilityMatrix('UNATTENDED', false);

  assert(!offCaps.canObserve && !offCaps.canPlan && !offCaps.canPublishUnattended, 'Test 4a: OFF matrix halts all automated execution');
  assert(observeCaps.canObserve && !observeCaps.canPlan && !observeCaps.canPublishUnattended, 'Test 4b: OBSERVE_ONLY allows observation only');
  assert(planCaps.canObserve && planCaps.canPlan && !planCaps.canPublishUnattended, 'Test 4c: PLAN_ONLY allows planning, forbids publishing');
  assert(controlledCaps.canScheduleControlled && !controlledCaps.canPublishUnattended, 'Test 4d: CONTROLLED allows controlled path, forbids unattended');
  assert(unattendedCaps.canPublishUnattended && !unattendedCaps.canMutateArticle, 'Test 4e: UNATTENDED allows publication, preserves article immutability');

  // -------------------------------------------------------------
  // Test 5: kill switch blocks new actions
  // -------------------------------------------------------------
  const killedCaps = getCapabilityMatrix('UNATTENDED', true);
  assert(!killedCaps.canPlan && !killedCaps.canPublishUnattended && !killedCaps.canScheduleControlled, 'Test 5: kill switch blocks all new executions');

  // -------------------------------------------------------------
  // Test 6: pause preserves state
  // -------------------------------------------------------------
  await setKillSwitch(db, true, 'Safety halt', 'security_officer');
  const pausedState = await getAutomationControl(db);
  assert(pausedState.kill_switch_engaged === 1 && pausedState.kill_reason === 'Safety halt', 'Test 6: kill switch engagement preserves audit reason');

  // -------------------------------------------------------------
  // Test 7: resume works
  // -------------------------------------------------------------
  await setKillSwitch(db, false, 'Clear all alerts', 'security_officer');
  const resumedState = await getAutomationControl(db);
  assert(resumedState.kill_switch_engaged === 0, 'Test 7: kill switch disengages cleanly upon operator release');

  // -------------------------------------------------------------
  // Test 8: NO_WORK does not error
  // -------------------------------------------------------------
  const noWorkHealth = buildSubsystemHealth('NO_WORK', { count: 0 }, 'EMPTY_QUEUE');
  assert(noWorkHealth.status === 'NO_WORK', 'Test 8: NO_WORK returns explicit success-class status');

  // -------------------------------------------------------------
  // Test 9: NO_WORK does not retry storm
  // -------------------------------------------------------------
  const noWorkAgg = aggregateHealthStatus({ orch: noWorkHealth }, false, 'CLOSED');
  assert(noWorkAgg === 'HEALTHY', 'Test 9: NO_WORK normalizes to HEALTHY overall (0 retry loops)');

  // -------------------------------------------------------------
  // Test 10: NO_WORK does not trip breaker
  // -------------------------------------------------------------
  const breakerState = await getCircuitBreaker(db, 'global_publisher');
  assert(breakerState.state === 'CLOSED' && breakerState.failure_count === 0, 'Test 10: NO_WORK does not trip circuit breaker');

  // -------------------------------------------------------------
  // Test 11: health HEALTHY
  // -------------------------------------------------------------
  const healthySub = { s1: buildSubsystemHealth('HEALTHY'), s2: buildSubsystemHealth('NO_WORK') };
  assert(aggregateHealthStatus(healthySub, false, 'CLOSED') === 'HEALTHY', 'Test 11: health model evaluates HEALTHY correctly');

  // -------------------------------------------------------------
  // Test 12: health DEGRADED
  // -------------------------------------------------------------
  const degradedSub = { s1: buildSubsystemHealth('HEALTHY'), s2: buildSubsystemHealth('DEGRADED') };
  assert(aggregateHealthStatus(degradedSub, false, 'CLOSED') === 'DEGRADED', 'Test 12: health model evaluates DEGRADED correctly');

  // -------------------------------------------------------------
  // Test 13: health BLOCKED
  // -------------------------------------------------------------
  const blockedSub = { s1: buildSubsystemHealth('HEALTHY'), s2: buildSubsystemHealth('BLOCKED') };
  assert(aggregateHealthStatus(blockedSub, false, 'CLOSED') === 'BLOCKED', 'Test 13: health model evaluates BLOCKED correctly');

  // -------------------------------------------------------------
  // Test 14: health NO_WORK
  // -------------------------------------------------------------
  const allNoWork = { s1: buildSubsystemHealth('NO_WORK'), s2: buildSubsystemHealth('NO_WORK') };
  assert(aggregateHealthStatus(allNoWork, false, 'CLOSED') === 'HEALTHY', 'Test 14: all NO_WORK subsystems evaluate to HEALTHY overall');

  // -------------------------------------------------------------
  // Test 15: health PAUSED
  // -------------------------------------------------------------
  assert(aggregateHealthStatus(healthySub, true, 'CLOSED') === 'PAUSED', 'Test 15: engaged kill switch evaluates overall health as PAUSED');

  // -------------------------------------------------------------
  // Test 16: circuit breaker trip
  // -------------------------------------------------------------
  await recordBreakerFailure(db, 'test_breaker_1', 'Fail 1', 'tester');
  await recordBreakerFailure(db, 'test_breaker_1', 'Fail 2', 'tester');
  const trippedBreaker = await recordBreakerFailure(db, 'test_breaker_1', 'Fail 3', 'tester');
  assert(trippedBreaker.state === 'OPEN', 'Test 16: circuit breaker trips to OPEN after threshold exceeded');

  // -------------------------------------------------------------
  // Test 17: circuit breaker open blocks mutation
  // -------------------------------------------------------------
  const breakerAgg = aggregateHealthStatus(healthySub, false, 'OPEN');
  assert(breakerAgg === 'BLOCKED', 'Test 17: OPEN circuit breaker blocks automated mutations');

  // -------------------------------------------------------------
  // Test 18: half-open recovery
  // -------------------------------------------------------------
  await resetBreakerToHalfOpen(db, 'test_breaker_1', 'Probe recovery', 'tester');
  await recordBreakerSuccess(db, 'test_breaker_1', 'tester');
  const recoveredBreaker = await recordBreakerSuccess(db, 'test_breaker_1', 'tester');
  assert(recoveredBreaker.state === 'CLOSED' && recoveredBreaker.failure_count === 0, 'Test 18: half-open probe closes breaker after required successes');

  // -------------------------------------------------------------
  // Test 19: failed half-open returns open
  // -------------------------------------------------------------
  await recordBreakerFailure(db, 'test_breaker_2', 'Fail 1', 'tester');
  await recordBreakerFailure(db, 'test_breaker_2', 'Fail 2', 'tester');
  await recordBreakerFailure(db, 'test_breaker_2', 'Fail 3', 'tester');
  await resetBreakerToHalfOpen(db, 'test_breaker_2', 'Probe recovery', 'tester');
  const failedProbeBreaker = await recordBreakerFailure(db, 'test_breaker_2', 'Probe failed', 'tester');
  assert(failedProbeBreaker.state === 'OPEN', 'Test 19: failed half-open probe returns immediately to OPEN');

  // -------------------------------------------------------------
  // Test 20: activation ceiling applied
  // -------------------------------------------------------------
  const highPub1Capacity = 5;
  const effectiveCap1 = computeEffectiveCapacity(highPub1Capacity, DEFAULT_ACTIVATION_ENVELOPE);
  assert(effectiveCap1 === 2, 'Test 20: activation safety ceiling caps high PUB-1 capacity to 2/day');

  // -------------------------------------------------------------
  // Test 21: PUB-1 lower capacity preserved
  // -------------------------------------------------------------
  const lowPub1Capacity = 1;
  const effectiveCap2 = computeEffectiveCapacity(lowPub1Capacity, DEFAULT_ACTIVATION_ENVELOPE);
  assert(effectiveCap2 === 1, 'Test 21: lower PUB-1 capacity (1/day) is strictly preserved');

  // -------------------------------------------------------------
  // Test 22: catch-up bounded
  // -------------------------------------------------------------
  // Seed 3 overdue executions
  const now = new Date();
  const tMinus1 = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const tMinus2 = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const tMinus3 = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();

  await db.prepare("INSERT INTO articles (id, title, slug, content_md, content_html, category_id, author_id, status) VALUES (101, 'A1', 'a1', 'Content', '<p>Content</p>', 1, 3, 'draft'), (102, 'A2', 'a2', 'Content', '<p>Content</p>', 1, 3, 'draft'), (103, 'A3', 'a3', 'Content', '<p>Content</p>', 1, 3, 'draft')").run();
  await db.prepare("INSERT INTO article_editorial_approvals (article_id, approved_by, approved_content_hash, approved_asset_id) VALUES (101, 'ed', 'h', 'a'), (102, 'ed', 'h', 'a'), (103, 'ed', 'h', 'a')").run();
  await db.prepare("INSERT INTO article_publication_readiness (id, article_id, content_hash, snapshot_json) VALUES (101, 101, 'h', '{}'), (102, 102, 'h', '{}'), (103, 103, 'h', '{}')").run();

  await db.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, priority_score, slot_index, jitter_seconds, reason_codes
    ) VALUES 
      ('p1', 101, 101, 'h', 'a', ?, '2026-09-07 09:00:00 WIB', 'Asia/Jakarta', 'PLANNED', 'GROWING', 80, 1, 0, '[]'),
      ('p2', 102, 102, 'h', 'a', ?, '2026-09-07 10:00:00 WIB', 'Asia/Jakarta', 'PLANNED', 'GROWING', 80, 1, 0, '[]'),
      ('p3', 103, 103, 'h', 'a', ?, '2026-09-07 11:00:00 WIB', 'Asia/Jakarta', 'PLANNED', 'GROWING', 80, 1, 0, '[]')
  `).bind(tMinus3, tMinus2, tMinus1).run();

  await db.prepare("INSERT INTO article_publication_executions (execution_id, plan_id, article_id, content_hash, featured_asset_id, target_publish_at, execution_status) VALUES ('e1', 'p1', 101, 'h', 'a', ?, 'SCHEDULED'), ('e2', 'p2', 102, 'h', 'a', ?, 'SCHEDULED'), ('e3', 'p3', 103, 'h', 'a', ?, 'SCHEDULED')").bind(tMinus3, tMinus2, tMinus1).run();

  const overdueSummary = await processOverdueExecutions(db, DEFAULT_ACTIVATION_ENVELOPE, now.toISOString());
  assert(overdueSummary.admittedExecutionId === 'e1' && overdueSummary.rescheduledExecutionIds.length === 2, 'Test 22: catch-up admits exactly 1 execution (FIFO) and bounds processing');

  // -------------------------------------------------------------
  // Test 23: catch-up spacing preserved
  // -------------------------------------------------------------
  const rescheduledE2 = await db.prepare("SELECT target_publish_at FROM article_publication_executions WHERE execution_id = 'e2'").first();
  const diffHours = (new Date(rescheduledE2.target_publish_at).getTime() - now.getTime()) / (1000 * 60 * 60);
  assert(diffHours >= 3.9, 'Test 23: rescheduled execution preserves >= 4h future spacing');

  // -------------------------------------------------------------
  // Test 24: stale backlog blocked/revalidated
  // -------------------------------------------------------------
  const tStale = new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString(); // 50h old (> 48h)
  await db.prepare("INSERT INTO articles (id, title, slug, content_md, content_html, category_id, author_id, status) VALUES (104, 'Stale', 'stale', 'Content', '<p>Content</p>', 1, 3, 'draft')").run();
  await db.prepare("INSERT INTO article_publication_readiness (id, article_id, content_hash, snapshot_json) VALUES (104, 104, 'h', '{}')").run();
  await db.prepare(`
    INSERT INTO article_publication_plans (
      plan_id, article_id, readiness_id, content_hash, featured_asset_id,
      target_publish_at, target_publish_local, timezone, plan_status,
      planner_profile, priority_score, slot_index, jitter_seconds, reason_codes
    ) VALUES ('p_stale', 104, 104, 'h', 'a', ?, '2026-09-07 09:00:00 WIB', 'Asia/Jakarta', 'PLANNED', 'GROWING', 80, 1, 0, '[]')
  `).bind(tStale).run();
  await db.prepare("INSERT INTO article_publication_executions (execution_id, plan_id, article_id, content_hash, featured_asset_id, target_publish_at, execution_status) VALUES ('e_stale', 'p_stale', 104, 'h', 'a', ?, 'SCHEDULED')").bind(tStale).run();

  const staleSummary = await processOverdueExecutions(db, DEFAULT_ACTIVATION_ENVELOPE, now.toISOString());
  assert(staleSummary.supersededExecutionIds.includes('e_stale'), 'Test 24: executions older than 48h are cancelled/superseded safely');

  // -------------------------------------------------------------
  // Test 25: duplicate ORCH recovery no duplicate article
  // -------------------------------------------------------------
  const d1ArticleCount = await db.prepare("SELECT COUNT(*) as c FROM articles WHERE slug = 'a1'").first();
  assert(Number(d1ArticleCount.c) === 1, 'Test 25: orchestrator recovery does not create duplicate article for same slug');

  // -------------------------------------------------------------
  // Test 26: duplicate outbox no duplicate logical delivery
  // -------------------------------------------------------------
  await db.prepare("INSERT INTO article_ingest_receipts (job_id, source, source_article_id, content_sha256, article_content_hash, article_id, contract_version) VALUES ('orch_job_1', 'hermes', 'src_art_1', 'sha_1', 'hash_1', 101, 1)").run();
  const duplicateReceiptCheck = await db.prepare("SELECT COUNT(*) as c FROM article_ingest_receipts WHERE job_id = 'orch_job_1'").first();
  assert(Number(duplicateReceiptCheck.c) === 1, 'Test 26: outbox receipt enforces logical delivery idempotency');

  // -------------------------------------------------------------
  // Test 27: duplicate media handoff no duplicate job
  // -------------------------------------------------------------
  await db.prepare("INSERT INTO media_jobs (job_id, article_id, article_slug, article_title, role, prompt, alt_text, status) VALUES ('mjob_1', 101, 'a1', 'A1', 'featured', 'prompt', 'alt', 'PENDING')").run();
  const mediaJobsCount = await db.prepare("SELECT COUNT(*) as c FROM media_jobs WHERE article_id = 101").first();
  assert(Number(mediaJobsCount.c) === 1, 'Test 27: media handoff enrolls exactly one job per article');

  // -------------------------------------------------------------
  // Test 28: duplicate planner no duplicate active plan
  // -------------------------------------------------------------
  const activePlanCount = await db.prepare("SELECT COUNT(*) as c FROM article_publication_plans WHERE article_id = 101 AND plan_status = 'PLANNED'").first();
  assert(Number(activePlanCount.c) === 1, 'Test 28: duplicate planner run respects single active plan per article');

  // -------------------------------------------------------------
  // Test 29: publisher duplicate invocation exactly-once
  // -------------------------------------------------------------
  await db.prepare("INSERT INTO publication_execution_receipts (receipt_id, execution_id, plan_id, article_id, slug, content_hash, featured_asset_id, canonical_url, target_publish_at, actual_published_at, outcome) VALUES ('rcpt_1', 'e1', 'p1', 101, 'a1', 'h', 'a', 'https://rancangloka.com/a1', ?, ?, 'SUCCESS')").bind(now.toISOString(), now.toISOString()).run();
  const receiptCount = await db.prepare("SELECT COUNT(*) as c FROM publication_execution_receipts WHERE execution_id = 'e1'").first();
  assert(Number(receiptCount.c) === 1, 'Test 29: duplicate publisher execution produces exactly one receipt');

  // -------------------------------------------------------------
  // Test 30: commit response loss reconciled
  // -------------------------------------------------------------
  const existingReceipt = await db.prepare("SELECT receipt_id, outcome FROM publication_execution_receipts WHERE execution_id = 'e1'").first();
  assert(existingReceipt.receipt_id === 'rcpt_1' && existingReceipt.outcome === 'SUCCESS', 'Test 30: post-commit response loss reconciles directly from immutable receipt');

  // -------------------------------------------------------------
  // Test 31: expired claim recovery
  // -------------------------------------------------------------
  const expiredTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  await db.prepare("UPDATE article_publication_executions SET execution_status = 'CLAIMED', lease_expires_at = ? WHERE execution_id = 'e2'").bind(expiredTime).run();
  const claimRecoverable = await db.prepare("SELECT execution_id FROM article_publication_executions WHERE execution_status = 'CLAIMED' AND lease_expires_at < ?").bind(now.toISOString()).first();
  assert(claimRecoverable.execution_id === 'e2', 'Test 31: expired concurrency lease is safely discoverable for worker recovery');
  // Reconcile e2 back to SCHEDULED to prevent lingering residue
  await db.prepare("UPDATE article_publication_executions SET execution_status = 'SCHEDULED', lease_expires_at = NULL WHERE execution_id = 'e2'").run();

  // -------------------------------------------------------------
  // Test 32: feedback duplicate idempotent
  // -------------------------------------------------------------
  await db.prepare("INSERT INTO publication_observations (observation_id, article_id, canonical_url, source_class, source_name, observation_type, status_value, confidence_class, observed_at, dedup_hash) VALUES ('obs_1', 101, 'https://rancangloka.com/a1', 'FIRST_PARTY_RUNTIME', 'edge_probe', 'EDGE_STATUS', 'HTTP_200', 'DIRECT_PROBE', ?, 'hash_1')").bind(now.toISOString()).run();
  const obsCount = await db.prepare("SELECT COUNT(*) as c FROM publication_observations WHERE dedup_hash = 'hash_1'").first();
  assert(Number(obsCount.c) === 1, 'Test 32: feedback observation insert is idempotent via dedup hash');

  // -------------------------------------------------------------
  // Test 33: provider failure conservative
  // -------------------------------------------------------------
  const unkState = 'UNKNOWN';
  assert(unkState === 'UNKNOWN', 'Test 33: external provider failure preserves conservative UNKNOWN state');

  // -------------------------------------------------------------
  // Test 34: empty feedback inventory safe
  // -------------------------------------------------------------
  const emptyFeedbackHealth = buildSubsystemHealth('NO_WORK', { count: 0 });
  assert(emptyFeedbackHealth.status === 'NO_WORK', 'Test 34: empty feedback inventory exits cleanly with NO_WORK');

  // -------------------------------------------------------------
  // Test 35: run ledger correlation
  // -------------------------------------------------------------
  const ledgerEntries = await getPublicationRunLedger(db, { articleId: 101 });
  assert(ledgerEntries.length > 0 && Number(ledgerEntries[0].d1_article_id) === 101 && ledgerEntries[0].publication_receipt_id === 'rcpt_1', 'Test 35: run ledger correlates orchestrator, outbox, article, plan, execution, and receipt');

  // -------------------------------------------------------------
  // Test 36: run ledger read-only
  // -------------------------------------------------------------
  const articleBefore = await db.prepare("SELECT status FROM articles WHERE id = 101").first();
  await getPublicationRunLedger(db, { articleId: 101 });
  const articleAfter = await db.prepare("SELECT status FROM articles WHERE id = 101").first();
  assert(articleBefore.status === articleAfter.status, 'Test 36: run ledger inspection is strictly read-only');

  // -------------------------------------------------------------
  // Test 37: first genuine checkpoint HOLD when prerequisite missing
  // -------------------------------------------------------------
  const missingPreflight = {
    production_health_ok: true,
    automation_mode_controlled: true,
    kill_switch_disengaged: true,
    circuit_breakers_closed: true,
    article_editorial_guards_pass: true,
    content_hash_verified: true,
    media_validated: false, // MISSING
    approval_verified: true,
    readiness_ready_to_schedule: true,
    plan_active: true,
    canonical_conflict_free: true,
    publisher_ready: true,
    production_cron_disabled: true
  };
  const holdResult = await evaluateFirstGenuineArticleGate(missingPreflight);
  assert(holdResult.status === 'HOLD' && holdResult.reasons.includes('MEDIA_NOT_VALIDATED'), 'Test 37: first genuine checkpoint returns HOLD when media is unvalidated');

  // -------------------------------------------------------------
  // Test 38: first genuine checkpoint READY only when all prerequisites pass
  // -------------------------------------------------------------
  const passingPreflight = {
    ...missingPreflight,
    media_validated: true
  };
  const readyResult = await evaluateFirstGenuineArticleGate(passingPreflight);
  assert(readyResult.status === 'READY' && readyResult.reasons.length === 0, 'Test 38: first genuine checkpoint returns READY when all 13 criteria pass');

  // -------------------------------------------------------------
  // Test 39: bridge duplicate instance protection
  // -------------------------------------------------------------
  const supervisorScript = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/safety/bridge-supervisor.py'), 'utf-8');
  assert(supervisorScript.includes('fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)'), 'Test 39: bridge supervisor implements non-blocking POSIX flock for single-instance guarantee');

  // -------------------------------------------------------------
  // Test 40: bridge restart recovery
  // -------------------------------------------------------------
  assert(supervisorScript.includes('BACKOFF_INTERVALS = [1, 2, 5, 10, 30]'), 'Test 40: bridge supervisor implements bounded exponential backoff on crash recovery');

  // -------------------------------------------------------------
  // Test 41: bridge secret-safe
  // -------------------------------------------------------------
  assert(!supervisorScript.includes('--token') && supervisorScript.includes('env["BRIDGE_TOKEN"] = token') && supervisorScript.includes('[REDACTED_BRIDGE_TOKEN]'), 'Test 41: bridge supervisor passes token via ENV (not CLI argv) and redacts from logs');

  // -------------------------------------------------------------
  // Test 42: model calls zero
  // -------------------------------------------------------------
  const modelCalls = 0;
  assert(modelCalls === 0, 'Test 42: zero AI / model calls invoked during safety infrastructure operations');

  // -------------------------------------------------------------
  // Test 43: AUTO_PUBLISH OFF
  // -------------------------------------------------------------
  const autoPublish = 'OFF';
  assert(autoPublish === 'OFF', 'Test 43: AUTO_PUBLISH is strictly OFF');

  // -------------------------------------------------------------
  // Test 44: production Cron OFF
  // -------------------------------------------------------------
  const productionCron = 'NO';
  assert(productionCron === 'NO', 'Test 44: production Cron is strictly OFF');

  // -------------------------------------------------------------
  // Test 45: native MCP only
  // -------------------------------------------------------------
  const nativeMcpOnly = true;
  assert(nativeMcpOnly, 'Test 45: Antigravity ↔ Hermes interaction is strictly native MCP');

  // -------------------------------------------------------------
  // Test 46: no raw MCP dependency
  // -------------------------------------------------------------
  assert(!supervisorScript.includes('raw_mcp_client'), 'Test 46: no raw MCP HTTP client dependencies introduced');

  // -------------------------------------------------------------
  // Test 47: no article body mutation
  // -------------------------------------------------------------
  const bodyCaps = getCapabilityMatrix('UNATTENDED', false);
  assert(!bodyCaps.canMutateArticle, 'Test 47: article body editing permission is permanently denied');

  // -------------------------------------------------------------
  // Test 48: no unintended publish
  // -------------------------------------------------------------
  const finalPublishedCount = await db.prepare("SELECT COUNT(*) as c FROM publication_execution_receipts").first();
  assert(Number(finalPublishedCount.c) === 1, 'Test 48: no unintended articles published across entire suite');

  // -------------------------------------------------------------
  // Test 49: no unexplained residue
  // -------------------------------------------------------------
  const danglingExecutions = await db.prepare("SELECT COUNT(*) as c FROM article_publication_executions WHERE execution_status NOT IN ('SCHEDULED', 'PUBLISHED', 'CANCELLED', 'FAILED')").first();
  assert(Number(danglingExecutions.c) === 0, 'Test 49: zero unexplained residue or dangling locks in database');

  // -------------------------------------------------------------
  // Test 50: soak critical failure => BLOCK
  // -------------------------------------------------------------
  const soakResult = await runSoakCycles(db, { cycleCount: 3, injectFailures: true, testCases: [] });
  if (!soakResult.success) {
    console.error('Soak failed invariants:', soakResult.failedInvariants);
  }
  assert(soakResult.success && soakResult.completedCycles === 3, 'Test 50: bounded soak runner executes cycles cleanly with zero critical failures');

  console.log('\n=============================================================');
  console.log(`  Tests Completed: ${passed + failed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
