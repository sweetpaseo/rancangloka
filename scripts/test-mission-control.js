/**
 * RancangLoka — MISSION CONTROL CORE TEST SUITE
 * Milestone: HERMES-MC-1
 * 
 * Verifies:
 * 1. Healthy data mapping (normal mode, normal kill switch, closed breakers, shadow JEV).
 * 2. Zero-state mapping (healthy real 0s without hiding or inventing).
 * 3. Stale, offline, and unknown scheduler heartbeat evaluation.
 * 4. Unknown telemetry mapping when data is absent (fail-safe).
 * 5. Automation OFF & Kill switch ENGAGED transitions overallStatus to PAUSED.
 * 6. Circuit breaker OPEN transitions overallStatus to BLOCKED.
 * 7. Media worker disabled evaluates correctly with dual-gate check.
 * 8. JEV shadow & zero authority invariants preserved.
 * 9. Secret redaction strictly masks tokens, device credentials, and cookies.
 * 10. Read-only invariant: No write operations executed during telemetry queries.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  getSystemHealth,
  getPipelineBoard,
  getActivityFeed,
  getSchedulerHeartbeat,
  getOutboxSummary,
  getArticleOperationsSummary,
  getMediaOperationsSummary,
  getJevObservabilitySummary,
  getMissionControlSnapshot,
  evaluateHeartbeatFreshness,
  sanitizeString,
  sanitizePayload
} from '../src/lib/mission-control/index.ts';

// Helper to create an in-memory D1 mock with all relevant tables
function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');

  // Core schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  // Apply relevant migrations
  const migrations = [
    '0001_category_taxonomy_expansion.sql',
    '0002_article_ingest_receipts.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0010_publication_feedback.sql',
    '0011_automation_safety.sql',
    '0013_lokamedia_durable_jobs.sql',
    '0019_publication_cron_observability.sql',
    '0020_automation_control_audit.sql',
    '0021_decision_observations.sql'
  ];

  for (const mig of migrations) {
    const p = path.resolve(process.cwd(), 'db/migrations', mig);
    if (fs.existsSync(p)) {
      const sql = fs.readFileSync(p, 'utf-8');
      sqlite.exec(sql);
    }
  }

  let writeOperationDetected = false;

  return {
    raw: sqlite,
    getWriteOperationDetected() {
      return writeOperationDetected;
    },
    prepare(sql) {
      const upper = sql.trim().toUpperCase();
      if (
        upper.startsWith('INSERT') ||
        upper.startsWith('UPDATE') ||
        upper.startsWith('DELETE') ||
        upper.startsWith('DROP') ||
        upper.startsWith('ALTER')
      ) {
        writeOperationDetected = true;
      }

      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map((v) => (v === undefined ? null : v));
          return this;
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

async function runTests() {
  console.log('🧪 Starting HERMES-MC-1 Mission Control Test Suite...\n');
  let passed = 0;

  // TEST 1: Secret Redaction
  {
    console.log('Test 1: Secret Redaction Utility');
    const sensitive = 'device token lkmd_9876543210abcdefghijklmnop and Bearer secret_1234567890abcdef and admin_session=sess_abcdef123456';
    const clean = sanitizeString(sensitive);
    assert.ok(!clean.includes('lkmd_9876543210abcdefghijklmnop'), 'Must redact lkmd token');
    assert.ok(clean.includes('lkmd_[REDACTED]'), 'Must format redacted lkmd');
    assert.ok(!clean.includes('secret_1234567890abcdef'), 'Must redact Bearer token');
    assert.ok(clean.includes('Bearer [REDACTED]'), 'Must format redacted Bearer');
    assert.ok(!clean.includes('sess_abcdef123456'), 'Must redact session cookie');

    const obj = { token_hash: 'abc123hash', safe_text: 'hello lkmd_1234567890abcdef123456' };
    const cleanObj = sanitizePayload(obj);
    assert.equal(cleanObj.token_hash, '[REDACTED]', 'Must mask token_hash key');
    assert.ok(cleanObj.safe_text.includes('lkmd_[REDACTED]'), 'Must sanitize nested strings');
    console.log('  ✅ PASS: Secret redaction successfully masks sensitive tokens.\n');
    passed++;
  }

  // TEST 2: Healthy System State & Zero Authority Invariants
  {
    console.log('Test 2: Healthy System State & Zero Authority Invariants');
    const db = createMockD1();

    // Seed normal automation state
    db.raw.exec(`
      INSERT OR REPLACE INTO automation_control (id, mode, kill_switch_engaged, kill_reason)
      VALUES (1, 'OFF', 0, NULL);
    `);

    const health = await getSystemHealth(db, { MEDIA_WORKER_ENABLED: 'false' });
    assert.equal(health.automation.mode, 'OFF', 'Mode must be OFF');
    assert.equal(health.automation.killSwitchEngaged, false, 'Kill switch must be false');
    assert.equal(health.mediaWorker.effectiveState, 'DISABLED', 'Media worker must be DISABLED');
    assert.equal(health.mediaWorker.activeDevicesCount, 0, 'Devices must be 0');
    assert.equal(health.jev.mode, 'shadow', 'JEV mode must strictly be shadow');
    assert.equal(health.jev.authority, 'none', 'JEV authority must strictly be none');
    assert.equal(health.overallStatus, 'HEALTHY', 'Normal dormant mode must be HEALTHY');
    console.log('  ✅ PASS: System health correctly reports baseline safe invariants.\n');
    passed++;
  }

  // TEST 3: Zero-State Mapping (Real Healthy Zeroes)
  {
    console.log('Test 3: Zero-State Mapping (Real Healthy Zeroes)');
    const db = createMockD1();

    const pipeline = await getPipelineBoard(db);
    assert.equal(pipeline.totalActiveTasks, 0, 'Active tasks must be 0 in clean db');
    assert.equal(pipeline.stageCounts.waiting_media, 0, 'Waiting media must be 0');
    assert.equal(pipeline.stageCounts.failed, 0, 'Failed must be 0');

    const mediaSummary = await getMediaOperationsSummary(db);
    assert.equal(mediaSummary.pendingJobsCount, 0, 'Pending media jobs must be 0');
    assert.equal(mediaSummary.activeDevicesCount, 0, 'Active devices must be 0');
    assert.equal(mediaSummary.totalAssetsCount, 0, 'Total assets must be 0');

    const outboxSummary = await getOutboxSummary(db);
    assert.equal(outboxSummary.queued, 0, 'Queued must be 0');
    assert.equal(outboxSummary.deadLetter, 0, 'Dead letter must be 0');
    console.log('  ✅ PASS: Real zero states preserved without fabrication or hiding.\n');
    passed++;
  }

  // TEST 4: Emergency Kill Switch Engagement
  {
    console.log('Test 4: Emergency Kill Switch Engagement');
    const db = createMockD1();

    db.raw.exec(`
      INSERT OR REPLACE INTO automation_control (id, mode, kill_switch_engaged, kill_reason)
      VALUES (1, 'OFF', 1, 'Manual operator freeze during deployment check');
    `);

    const health = await getSystemHealth(db);
    assert.equal(health.automation.killSwitchEngaged, true, 'Kill switch must be engaged');
    assert.equal(health.automation.killReason, 'Manual operator freeze during deployment check');
    assert.equal(health.overallStatus, 'PAUSED', 'Overall status must transition to PAUSED');
    console.log('  ✅ PASS: Emergency Kill Switch engagement properly transitions health to PAUSED.\n');
    passed++;
  }

  // TEST 5: Circuit Breaker OPEN Evaluation
  {
    console.log('Test 5: Circuit Breaker OPEN Evaluation');
    const db = createMockD1();

    db.raw.exec(`
      INSERT OR REPLACE INTO circuit_breakers (id, state, failure_count, failure_threshold, trip_reason)
      VALUES ('global_publisher', 'OPEN', 3, 3, 'Consecutive D1 write timeouts');
    `);

    const health = await getSystemHealth(db);
    const pubBreaker = health.circuitBreakers.find((b) => b.id === 'global_publisher');
    assert.ok(pubBreaker, 'global_publisher breaker must exist');
    assert.equal(pubBreaker.state, 'OPEN', 'Breaker must be OPEN');
    assert.equal(health.overallStatus, 'BLOCKED', 'Overall status must be BLOCKED when breaker is OPEN');
    console.log('  ✅ PASS: Circuit breaker trip correctly sets overall system state to BLOCKED.\n');
    passed++;
  }

  // TEST 6: Pipeline Task Board Mapping with Media & Approvals
  {
    console.log('Test 6: Pipeline Task Board Stage Mapping');
    const db = createMockD1();

    // Insert an article in draft with an in-progress media job
    db.raw.exec(`
      INSERT INTO articles (id, slug, title, status, content_md, content_html, featured_image, image_alt, category_id, author_id, views, reading_time_minutes, is_featured, is_trending, published_at, updated_at)
      VALUES (101, 'uji-atap-dingin', 'Uji Atap Dingin Tropis', 'draft', '# Draft', '<p>Draft</p>', '', '', 1, 1, 0, 5, 0, 0, datetime('now'), datetime('now'));

      INSERT INTO media_jobs (job_id, article_id, article_slug, article_title, status, attempt, max_attempts, prompt, alt_text)
      VALUES ('mjob_test_101', 101, 'uji-atap-dingin', 'Uji Atap Dingin Tropis', 'GENERATING', 1, 3, 'Atap tropis modern', 'Atap dingin tropis');
    `);

    const board = await getPipelineBoard(db);
    assert.equal(board.totalActiveTasks, 1, 'Total active tasks must be 1');
    assert.equal(board.stageCounts.waiting_media, 1, 'Waiting media count must be 1');
    const card = board.tasks.find((t) => t.taskId === 'art_101');
    assert.ok(card, 'Card art_101 must exist');
    assert.equal(card.stage, 'waiting_media', 'Card stage must be waiting_media');
    assert.equal(card.relatedMediaJobId, 'mjob_test_101', 'Must link media job ID');
    console.log('  ✅ PASS: Task stage accurately reflects relational media job state.\n');
    passed++;
  }

  // TEST 7: Activity Feed Aggregation & Ordering
  {
    console.log('Test 7: Activity Feed Aggregation & Ordering');
    const db = createMockD1();

    // Insert events with distinct timestamps
    db.raw.exec(`
      INSERT INTO automation_control_audit (id, audit_id, event_type, actor_id, previous_value, new_value, reason, created_at)
      VALUES (1, 'audit_001', 'AUTOMATION_MODE_CHANGED', 'admin_operator', 'OFF', 'OBSERVE_ONLY', 'Baseline initialized', '2026-09-30T10:00:00Z');

      INSERT INTO circuit_breaker_events (id, breaker_id, from_state, to_state, reason, created_at, actor)
      VALUES (1, 'global_publisher', 'CLOSED', 'HALF_OPEN', 'Trial probe', '2026-09-30T10:15:00Z', 'probe_runner');
    `);

    const feed = await getActivityFeed(db, 10);
    assert.equal(feed.length, 2, 'Feed must contain 2 events');
    assert.equal(feed[0].eventType, 'CIRCUIT_BREAKER_TRANSITION', 'Latest event must appear first');
    assert.equal(feed[1].eventType, 'AUTOMATION_MODE_CHANGED', 'Older event must appear second');
    console.log('  ✅ PASS: Activity feed aggregates and chronologically orders multi-table events.\n');
    passed++;
  }

  // TEST 8: Unknown Telemetry Fallback (Missing DB)
  {
    console.log('Test 8: Unknown Telemetry Fallback (Missing DB)');
    const health = await getSystemHealth(null);
    assert.equal(health.automation.mode, 'OFF', 'Default fallback mode must be OFF');
    assert.equal(health.mediaWorker.effectiveState, 'DISABLED', 'Media worker must default to DISABLED');
    assert.equal(health.jev.providerStatus, 'UNKNOWN', 'JEV status must be UNKNOWN without DB');

    const board = await getPipelineBoard(null);
    assert.equal(board.tasks.length, 0, 'Tasks must be empty without DB');
    assert.equal(board.totalActiveTasks, 0, 'Active tasks must be 0');

    const activity = await getActivityFeed(null);
    assert.deepEqual(activity, [], 'Activity must be empty array without DB');

    // Heartbeat Freshness Threshold Verifications
    const now = Date.now();
    const freshBeat = evaluateHeartbeatFreshness(new Date(now - 120_000).toISOString(), now);
    assert.equal(freshBeat.status, 'healthy', 'Heartbeat <= 300s must be healthy');

    const staleBeat = evaluateHeartbeatFreshness(new Date(now - 450_000).toISOString(), now);
    assert.equal(staleBeat.status, 'stale', 'Heartbeat 301-600s must be stale');

    const offlineBeat = evaluateHeartbeatFreshness(new Date(now - 900_000).toISOString(), now);
    assert.equal(offlineBeat.status, 'offline', 'Heartbeat > 600s must be offline');

    const missingBeat = evaluateHeartbeatFreshness(null, now);
    assert.equal(missingBeat.status, 'unknown', 'Absent heartbeat must be unknown');

    console.log('  ✅ PASS: Missing DB safely falls back to unknown/empty, and heartbeat thresholds pass.\n');
    passed++;
  }

  // TEST 9: JEV Shadow Observation Summary
  {
    console.log('Test 9: JEV Shadow Observation Summary');
    const db = createMockD1();

    db.raw.exec(`
      INSERT INTO decision_observations (
        observation_id, decision_point, subject_type, subject_id, authoritative_decision,
        jev_decision, provider, model, model_version, input_schema_version, prompt_version,
        input_hash, latency_ms, provider_status, disagreement_classification, created_at
      ) VALUES (
        'obs_test_001', 'article_publication_preflight', 'article', 'art_001', 'continue',
        'continue', 'openrouter', 'typesafe/jev-1.13', '20260917', 'v1', 'v1',
        'hash123', 245, 'SUCCESS', 'AGREE_CONTINUE', '2026-09-30T11:00:00Z'
      );
    `);

    const jevSummary = await getJevObservabilitySummary(db);
    assert.equal(jevSummary.mode, 'shadow', 'JEV mode must be shadow');
    assert.equal(jevSummary.authority, 'none', 'JEV authority must be none');
    assert.equal(jevSummary.totalObservationsCount, 1, 'Total observations must be 1');
    assert.equal(jevSummary.agreementRatePercent, 100, 'Agreement rate must be 100%');
    assert.equal(jevSummary.latestObservation?.observationId, 'obs_test_001');
    assert.equal(jevSummary.latestObservation?.providerStatus, 'SUCCESS');
    console.log('  ✅ PASS: JEV summary correctly computes shadow telemetry.\n');
    passed++;
  }

  // TEST 10: Strict Read-Only Invariant (Zero Mutations)
  {
    console.log('Test 10: Strict Read-Only Invariant (Zero Mutations)');
    const db = createMockD1();

    // Call full snapshot aggregator
    const snapshot = await getMissionControlSnapshot(db, { ENVIRONMENT: 'test' });
    assert.ok(snapshot.generatedAt, 'Snapshot must have generatedAt timestamp');
    assert.ok(snapshot.health, 'Snapshot must have health');
    assert.ok(snapshot.pipeline, 'Snapshot must have pipeline');
    assert.ok(snapshot.activity, 'Snapshot must have activity');
    assert.equal(db.getWriteOperationDetected(), false, 'NO write operations must be detected during snapshot generation');
    console.log('  ✅ PASS: Snapshot generation executes 100% read-only queries with zero mutations.\n');
    passed++;
  }

  console.log(`🎉 All ${passed}/${passed} HERMES-MC-1 Mission Control tests PASSED!`);
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
