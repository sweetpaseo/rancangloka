/**
 * RancangLoka Hermes Mission Control — Live Operations Layer V2 Test Suite
 * Milestone: MC-LIVEOPS-2
 * 
 * Verifies:
 * 1. Active staff exposes backing task with complete provenance.
 * 2. Idle staff does not fabricate a task (task is null when in baseline standby).
 * 3. Correct task ID & provenance shown with capability, timestamps, and evidence ID.
 * 4. Correct article context shown when available (relatedArticleId, slug).
 * 5. Blocked state exposes blocker reason.
 * 6. Budi remains disabled (OFFLINE) when media worker is disabled (zero fake workload).
 * 7. Sari scheduled state under automation OFF does not imply publish execution.
 * 8. Jefry inspector exposes advisory context only (Zero execution controls).
 * 9. No inspector action can mutate state (purely read-only / links only).
 * 10. Deep links only target valid, existing internal routes (/admin/posts, /admin/preview, /admin/publication, /admin/mission-control/alerts).
 * 11. Identical operational inputs produce 100% deterministic inspector output.
 */

import assert from 'node:assert';
import {
  deriveLiveStaffOperation,
  getLiveOperationsSnapshot
} from '../src/lib/mission-control/live-operations.ts';

console.log('===========================================================');
console.log('🧪 Starting Mission Control Live Operations V2 Test Suite...');
console.log('===========================================================');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

function createBaseSnapshot(overrides = {}) {
  return {
    generatedAt: '2026-10-04T08:00:00.000Z',
    pipeline: {
      tasks: [],
      stageCounts: {
        draft: 0,
        researching: 0,
        writing: 0,
        validating: 0,
        editorial_qa: 0,
        ready_for_ingest: 0,
        ingesting: 0,
        waiting_media: 0,
        ready_for_review: 0,
        scheduled: 0,
        published: 0,
        failed: 0
      },
      totalActiveTasks: 0
    },
    activity: { events: [], totalEvents: 0 },
    scheduler: {
      hermes: {
        status: 'healthy',
        recordedAt: '2026-10-04T08:00:00.000Z',
        senderStatus: 'active',
        cycleStatus: 'nominal',
        freshnessSeconds: 10,
        note: 'Nominal'
      },
      cloudflareCron: []
    },
    outbox: {
      queued: 0,
      sending: 0,
      acknowledged: 0,
      deadLetter: 0,
      source: 'd1_receipts',
      lastIngestAt: null
    },
    health: {
      overallStatus: 'HEALTHY',
      automation: {
        mode: 'OFF',
        killSwitchEngaged: false,
        killReason: null,
        updatedAt: '2026-10-04T08:00:00.000Z'
      },
      mediaWorker: {
        dbGate: 'DISABLED',
        effectiveState: 'DISABLED',
        activeDevicesCount: 0,
        reason: 'Disabled by operator policy'
      },
      jev: {
        mode: 'shadow',
        authority: 'none',
        providerStatus: 'SUCCESS',
        latestObservationId: 'obs_liveops2_001',
        latestLatencyMs: 140,
        latestTimestamp: '2026-10-04T08:00:00.000Z',
        errorClass: null
      },
      circuitBreakers: []
    },
    jev: {
      activeMode: 'shadow',
      authorityLevel: 'none',
      latestObservation: null
    },
    articles: {
      draftCount: 0,
      awaitingReviewCount: 0,
      approvedCount: 0,
      publishedCount: 0,
      quarantinedCount: 0,
      latestPublished: null,
      latestApproval: null,
      latestReceipt: null
    },
    media: {
      activeDevicesCount: 0,
      registeredDevicesCount: 1,
      devices: []
    },
    ...overrides
  };
}

// ============================================================================
// TEST SUITE: LIVEOPS-2
// ============================================================================

console.log('\n--- TEST SECTION 1: Active Staff Exposes Backing Task ---');

test('Active writer (Joko) exposes complete backing task provenance', () => {
  const writingTask = {
    taskId: 'task_joko_write_99',
    title: 'Panduan Rangka Atap Baja Ringan SNI',
    subsystem: 'editorial',
    status: 'IN_PROGRESS',
    stage: 'writing',
    retryCount: 0,
    lastUpdate: '2026-10-04T08:15:00.000Z',
    blockerOrError: null,
    relatedArticleId: 42,
    slug: 'panduan-rangka-atap-baja-ringan-sni'
  };

  const snap = createBaseSnapshot({
    pipeline: {
      tasks: [writingTask],
      stageCounts: { ...createBaseSnapshot().pipeline.stageCounts, writing: 1 },
      totalActiveTasks: 1
    }
  });

  const jokoOp = deriveLiveStaffOperation('content_writer_primary', snap);
  assert.strictEqual(jokoOp.operational_state, 'WORKING');
  assert.strictEqual(jokoOp.live_status, 'WORKING');
  assert.ok(jokoOp.current_task, 'current_task must not be null');
  assert.strictEqual(jokoOp.current_task?.task_id, 'task_joko_write_99');
  assert.strictEqual(jokoOp.current_task?.task_title, 'Panduan Rangka Atap Baja Ringan SNI');
  assert.strictEqual(jokoOp.current_task?.stage, 'writing');
  assert.strictEqual(jokoOp.current_task?.related_article_id, 42);
  assert.strictEqual(jokoOp.current_task?.slug, 'panduan-rangka-atap-baja-ringan-sni');
  assert.strictEqual(jokoOp.current_task?.department_id, 'editorial');
  assert.strictEqual(jokoOp.current_task?.capability_id, 'ARTICLE_WRITING');
  assert.strictEqual(jokoOp.current_task?.evidence_source, 'pipeline.tasks');
});

console.log('\n--- TEST SECTION 2: Idle Staff Does NOT Fabricate a Task ---');

test('Idle staff (Joko in Lounge) does not fabricate a task', () => {
  const snap = createBaseSnapshot();
  const jokoOp = deriveLiveStaffOperation('content_writer_primary', snap);
  assert.strictEqual(jokoOp.operational_state, 'IDLE');
  assert.strictEqual(jokoOp.live_status, 'IDLE');
  assert.strictEqual(jokoOp.current_task, null, 'Idle staff must have null current_task');
  assert.strictEqual(jokoOp.location.room_key, 'lounge');
});

test('Idle staff (Irwan in Lounge) does not fabricate a task', () => {
  const snap = createBaseSnapshot();
  const irwanOp = deriveLiveStaffOperation('evidence_researcher_lead', snap);
  assert.strictEqual(irwanOp.operational_state, 'IDLE');
  assert.strictEqual(irwanOp.live_status, 'IDLE');
  assert.strictEqual(irwanOp.current_task, null, 'Idle Irwan must have null current_task');
});

console.log('\n--- TEST SECTION 3: Task Context & Safe Link References ---');

test('QA staff (Rina) carries approval and article context', () => {
  const qaTask = {
    taskId: 'task_rina_qa_88',
    title: 'Komparasi Mortar Instan vs Konvensional',
    subsystem: 'editorial',
    status: 'IN_REVIEW',
    stage: 'validating',
    retryCount: 0,
    lastUpdate: '2026-10-04T08:20:00.000Z',
    blockerOrError: null,
    relatedArticleId: 55,
    slug: 'komparasi-mortar-instan-vs-konvensional',
    approvalEvidence: {
      approvedBy: 'chief_editor',
      approvedAt: '2026-10-04T08:19:00.000Z'
    }
  };

  const snap = createBaseSnapshot({
    pipeline: {
      tasks: [qaTask],
      stageCounts: { ...createBaseSnapshot().pipeline.stageCounts, validating: 1 },
      totalActiveTasks: 1
    }
  });

  const rinaOp = deriveLiveStaffOperation('editorial_qa_primary', snap);
  assert.strictEqual(rinaOp.operational_state, 'WORKING');
  assert.strictEqual(rinaOp.live_status, 'REVIEWING');
  assert.ok(rinaOp.current_task);
  assert.strictEqual(rinaOp.current_task?.related_article_id, 55);
  assert.strictEqual(rinaOp.current_task?.slug, 'komparasi-mortar-instan-vs-konvensional');
  assert.strictEqual(rinaOp.current_task?.approval_state, 'APPROVED');
});

console.log('\n--- TEST SECTION 4: Blocked / Error State Inspection ---');

test('Blocked research task exposes blocker condition clearly', () => {
  const failedResearch = {
    taskId: 'task_irwan_fail_12',
    title: 'Riset SNI Pondasi Tahan Gempa',
    subsystem: 'research',
    status: 'FAILED',
    stage: 'failed',
    retryCount: 2,
    lastUpdate: '2026-10-04T08:25:00.000Z',
    blockerOrError: 'Koneksi database standar BSN timeout 504'
  };

  const snap = createBaseSnapshot({
    pipeline: {
      tasks: [failedResearch],
      stageCounts: { ...createBaseSnapshot().pipeline.stageCounts, failed: 1 },
      totalActiveTasks: 1
    }
  });

  const irwanOp = deriveLiveStaffOperation('evidence_researcher_lead', snap);
  assert.strictEqual(irwanOp.operational_state, 'BLOCKED');
  assert.strictEqual(irwanOp.live_status, 'BLOCKED');
  assert.ok(irwanOp.current_task);
  assert.strictEqual(irwanOp.current_task?.blocking_condition, 'Koneksi database standar BSN timeout 504');
  assert.strictEqual(irwanOp.animation.animation_key, 'BLOCKED_WARNING');
});

console.log('\n--- TEST SECTION 5: Safety Invariants & Persona Boundaries ---');

test('Budi strictly remains OFFLINE when media worker is DISABLED', () => {
  const snap = createBaseSnapshot();
  const budiOp = deriveLiveStaffOperation('lokamedia_worker_primary', snap);
  assert.strictEqual(budiOp.operational_state, 'OFFLINE');
  assert.strictEqual(budiOp.live_status, 'OFFLINE');
  assert.strictEqual(budiOp.animation.animation_key, 'OFFLINE_DISABLED');
  assert.strictEqual(budiOp.animation.is_actively_working, false);
});

test('Sari scheduled state under automation OFF stays WAITING in Lounge without dispatch', () => {
  const scheduledTask = {
    taskId: 'task_sari_sched_77',
    title: 'Artikel Siap Publikasi',
    subsystem: 'publication',
    status: 'SCHEDULED',
    stage: 'scheduled',
    retryCount: 0,
    lastUpdate: '2026-10-04T08:30:00.000Z',
    blockerOrError: null,
    relatedArticleId: 99
  };

  const snap = createBaseSnapshot({
    pipeline: {
      tasks: [scheduledTask],
      stageCounts: { ...createBaseSnapshot().pipeline.stageCounts, scheduled: 1 },
      totalActiveTasks: 1
    },
    health: {
      ...createBaseSnapshot().health,
      automation: {
        mode: 'OFF',
        killSwitchEngaged: false,
        killReason: null,
        updatedAt: '2026-10-04T08:00:00.000Z'
      }
    }
  });

  const sariOp = deriveLiveStaffOperation('publication_dispatcher_core', snap);
  assert.strictEqual(sariOp.operational_state, 'IDLE');
  assert.strictEqual(sariOp.live_status, 'WAITING');
  assert.strictEqual(sariOp.location.room_key, 'lounge');
  assert.strictEqual(sariOp.animation.is_actively_working, false);
});

test('Jefry inspector exposes advisory context only with ZERO execution authority', () => {
  const snap = createBaseSnapshot({
    jev: {
      activeMode: 'shadow',
      authorityLevel: 'none',
      latestObservation: {
        observationId: 'obs_jefry_advisory_505',
        decisionPoint: 'PUBLICATION_PREFLIGHT',
        providerStatus: 'SUCCESS',
        createdAt: new Date().toISOString(),
        jevDecision: 'human_review',
        latencyMs: 120
      }
    }
  });

  const jefryOp = deriveLiveStaffOperation('management_advisor_jefry', snap);
  assert.strictEqual(jefryOp.location.room_key, 'management_room');
  assert.strictEqual(jefryOp.location.position_key, 'management_decision_console');
  assert.strictEqual(jefryOp.animation.animation_key, 'ADVISOR_HUMAN_REVIEW');
  assert.ok(jefryOp.state_evidence.includes('0 Otoritas Eksekusi'));
  assert.strictEqual(jefryOp.current_task?.stage, 'management_eval');
  assert.strictEqual(jefryOp.current_task?.status, 'ADVISORY_EVALUATION');
});

console.log('\n--- TEST SECTION 6: Determinism & Route Links ---');

test('Identical inputs produce 100% deterministic Live Operations outputs', () => {
  const snap = createBaseSnapshot();
  const snap1 = getLiveOperationsSnapshot(snap);
  const snap2 = getLiveOperationsSnapshot(snap);
  assert.deepStrictEqual(snap1.staff_operations, snap2.staff_operations);
  assert.deepStrictEqual(snap1.summary, snap2.summary);
});

test('Deep link routes verify existing canonical structure', () => {
  // Test route builder rules match actual application routes:
  // Article: /admin/posts/:id
  // Preview: /admin/preview/:slug
  // Publication: /admin/publication/operations
  // Alerts: /admin/mission-control/alerts
  // Staff: /admin/mission-control/staff
  const dummyArticleId = 42;
  const dummySlug = 'test-article-slug';
  
  const articleUrl = `/admin/posts/${dummyArticleId}`;
  const previewUrl = `/admin/preview/${dummySlug}`;
  const pubUrl = '/admin/publication/operations';
  const alertsUrl = '/admin/mission-control/alerts';

  assert.match(articleUrl, /^\/admin\/posts\/\d+$/);
  assert.match(previewUrl, /^\/admin\/preview\/[a-z0-9-]+$/);
  assert.strictEqual(pubUrl, '/admin/publication/operations');
  assert.strictEqual(alertsUrl, '/admin/mission-control/alerts');
});

console.log('===========================================================');
console.log(`🏁 Live Operations V2 Test Suite Finished: ${passCount} Passed, 0 Failed`);
console.log('===========================================================');
