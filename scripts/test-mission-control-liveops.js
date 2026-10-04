/**
 * RancangLoka Hermes Mission Control — Test Suite: Live Operations Layer (MC-LIVEOPS-1)
 * Milestone: MC-LIVEOPS-1
 * 
 * Strict Invariants Tested:
 * 1. Real job -> correct staff assignment
 * 2. Correct operational state mapping (WORKING, REVIEWING, RESEARCHING, WAITING, IDLE, BLOCKED, OFFLINE)
 * 3. Job activity -> correct animation category (ARTICLE_TYPING, ARTICLE_REWRITE, RESEARCH_BROWSING, EDITORIAL_READING, etc.)
 * 4. Handoff A -> B updates ownership and operational state
 * 5. Completed / absent job returns staff to deterministic IDLE state in Lounge (no fake workload)
 * 6. Blocked job produces blocked representation with preserved blocker/error provenance
 * 7. Worker disabled does NOT appear falsely active (Budi strictly OFFLINE when Media Worker is DISABLED)
 * 8. JEV / Jefry remains advisory-only (zero execution authority, stationary at advisory console)
 * 9. No execution or publishing authority is accidentally enabled (publishing_authority=0, automation_mode=OFF)
 * 10. Deterministic results for identical inputs across multiple evaluations
 * 11. Queued publication tasks evaluate to WAITING and keep dispatcher in Lounge without autonomous publish
 * 12. API route /api/admin/mission-control/liveops enforces strictly GET-only (405 for non-GET) and read-only access
 */

import {
  deriveLiveStaffOperation,
  getLiveOperationsSnapshot
} from '../src/lib/mission-control/live-operations.ts';
import { getPixelOfficeState } from '../src/lib/mission-control/pixel-office.ts';
import { ALL as liveOpsApiRoute } from '../src/pages/api/admin/mission-control/liveops.ts';

console.log('===========================================================');
console.log('🧪 Starting Mission Control Live Operations Test Suite...');
console.log('===========================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// Helper: Standard Baseline Snapshot (automation OFF, media worker DISABLED, JEV shadow)
function createBaselineSnapshot(overrides = {}) {
  const defaultHealth = {
    overallStatus: 'HEALTHY',
    automation: {
      mode: 'OFF',
      killSwitchEngaged: false,
      killReason: null,
      updatedAt: '2026-10-01T20:00:00.000Z'
    },
    mediaWorker: {
      dbGate: 'DISABLED',
      effectiveState: 'DISABLED',
      activeDevicesCount: 0,
      reason: 'Media Worker intentionally disabled by operator'
    },
    jev: {
      mode: 'shadow',
      authority: 'none',
      providerStatus: 'SUCCESS',
      latestObservationId: 'obs_1001',
      latestLatencyMs: 142,
      latestTimestamp: '2026-10-01T20:00:00.000Z',
      errorClass: null
    },
    circuitBreakers: []
  };

  const defaultPipeline = {
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
  };

  const defaultScheduler = {
    hermes: { status: 'healthy', lastHeartbeat: '2026-10-01T20:00:00.000Z' },
    cron: { status: 'idle' }
  };

  return {
    generatedAt: '2026-10-01T20:00:00.000Z',
    freshness: 'FRESH',
    environment: 'development',
    health: { ...defaultHealth, ...(overrides.health || {}) },
    pipeline: { ...defaultPipeline, ...(overrides.pipeline || {}) },
    activity: overrides.activity || [],
    scheduler: { ...defaultScheduler, ...(overrides.scheduler || {}) },
    outbox: { pendingCount: 0, eligibleCount: 0, heldCount: 0, nextScheduledArticle: null },
    articles: { totalArticles: 10, publishedCount: 8, draftCount: 2 },
    media: { totalJobs: 0, pendingJobs: 0, completedJobs: 0, failedJobs: 0 },
    jev: overrides.jev || {
      mode: 'shadow',
      latestObservation: null
    },
    social: overrides.social || undefined
  };
}

// ----------------------------------------------------------------------------
// TEST SECTION 1: Baseline Idle Behavior (Zero Hallucinated Activity)
// ----------------------------------------------------------------------------
console.log('--- TEST SECTION 1: Baseline Standby & Determinism ---');

{
  const snapshot = createBaselineSnapshot();
  const liveOps = getLiveOperationsSnapshot(snapshot);

  assert(liveOps !== null, 'Live operations snapshot generated successfully');
  assert(liveOps.summary.total_staff >= 7, 'Includes all canonical staff members in roster (>= 7)');
  assert(liveOps.safety_invariants.automation_mode === 'OFF', 'Safety invariant: automation_mode is OFF');
  assert(liveOps.safety_invariants.publishing_authority === 0, 'Safety invariant: publishing_authority is 0');
  assert(liveOps.safety_invariants.social_automation === 'OFF', 'Safety invariant: social_automation is OFF');
  assert(liveOps.safety_invariants.jev_mode === 'shadow', 'Safety invariant: jev_mode is shadow');
  assert(liveOps.safety_invariants.jefry_execution_authority === 'ZERO_ADVISORY_ONLY', 'Safety invariant: Jefry has ZERO execution authority');

  // Verify staff members default to deterministic idle / standby states
  const joko = liveOps.staff_operations['content_writer_primary'];
  const rina = liveOps.staff_operations['editorial_qa_primary'];
  const irwan = liveOps.staff_operations['evidence_researcher_lead'];
  const sari = liveOps.staff_operations['publication_dispatcher_core'];

  assert(joko.operational_state === 'IDLE' && joko.location.is_in_lounge, 'Joko defaults to IDLE in Lounge when no writing job is active');
  assert(joko.animation.animation_key === 'IDLE_STANDBY', 'Joko animation is IDLE_STANDBY with zero fake typing');
  assert(rina.operational_state === 'IDLE' && rina.location.is_in_lounge, 'Rina defaults to IDLE in Lounge when no QA review is active');
  assert(irwan.operational_state === 'IDLE' && irwan.location.is_in_lounge, 'Irwan defaults to IDLE in Lounge when no research is active');
  assert(sari.operational_state === 'IDLE' && sari.location.is_in_lounge, 'Sari defaults to IDLE in Lounge when no publication dispatch is active');
}

// ----------------------------------------------------------------------------
// TEST SECTION 2: Real Job -> Correct Staff Assignment & Location
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 2: Real Job -> Staff Assignment & Location ---');

{
  // 1. Research active -> Irwan assigned & at research desk
  const researchSnapshot = createBaselineSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task_res_101',
          title: 'Kekuatan Geser Sambungan Bambu Petung SNI 7973',
          subsystem: 'research',
          status: 'running',
          stage: 'researching',
          retryCount: 0,
          lastUpdate: '2026-10-01T20:15:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const liveRes = getLiveOperationsSnapshot(researchSnapshot);
  const irwan = liveRes.staff_operations['evidence_researcher_lead'];

  assert(irwan.operational_state === 'WORKING', 'Irwan state is WORKING during active research');
  assert(irwan.live_status === 'RESEARCHING', 'Irwan live_status is RESEARCHING');
  assert(irwan.location.room_key === 'research_lab', 'Irwan location is research_lab');
  assert(irwan.location.position_key === 'research_main_desk', 'Irwan location is research_main_desk');
  assert(irwan.location.is_at_workstation === true, 'Irwan is verified at workstation');
  assert(irwan.animation.animation_key === 'RESEARCH_BROWSING', 'Irwan animation is RESEARCH_BROWSING');
  assert(irwan.current_task?.task_id === 'task_res_101', 'Irwan current_task matches task_res_101 with proven ID');
  assert(irwan.current_task?.responsible_agent_id === 'evidence_researcher_lead', 'Irwan proven as responsible agent');

  // 2. Writing active -> Joko assigned & at writing desk
  const writingSnapshot = createBaselineSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task_write_202',
          title: 'Panduan Praktis Desain Atap Spandek Peredam Panas',
          subsystem: 'editorial',
          status: 'running',
          stage: 'writing',
          retryCount: 0,
          lastUpdate: '2026-10-01T20:25:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const liveWrite = getLiveOperationsSnapshot(writingSnapshot);
  const joko = liveWrite.staff_operations['content_writer_primary'];

  assert(joko.operational_state === 'WORKING', 'Joko state is WORKING during active drafting');
  assert(joko.live_status === 'WORKING', 'Joko live_status is WORKING');
  assert(joko.location.room_key === 'editorial_room', 'Joko location is editorial_room');
  assert(joko.location.position_key === 'editorial_writer_desk', 'Joko location is editorial_writer_desk');
  assert(joko.location.is_at_workstation === true, 'Joko is verified at workstation');
  assert(joko.animation.animation_key === 'ARTICLE_TYPING', 'Joko animation is ARTICLE_TYPING');
  assert(joko.current_task?.task_id === 'task_write_202', 'Joko task provenance matches task_write_202');

  // 3. Editorial QA active -> Rina assigned & at review desk
  const qaSnapshot = createBaselineSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task_qa_303',
          title: 'Review Editorial: Perbandingan Bata Ringan vs Merah',
          subsystem: 'editorial',
          status: 'running',
          stage: 'editorial_qa',
          retryCount: 0,
          lastUpdate: '2026-10-01T20:35:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const liveQa = getLiveOperationsSnapshot(qaSnapshot);
  const rina = liveQa.staff_operations['editorial_qa_primary'];

  assert(rina.operational_state === 'REVIEWING', 'Rina state is REVIEWING during active QA');
  assert(rina.live_status === 'REVIEWING', 'Rina live_status is REVIEWING');
  assert(rina.location.room_key === 'editorial_room', 'Rina location is editorial_room');
  assert(rina.location.position_key === 'editorial_review_desk', 'Rina location is editorial_review_desk');
  assert(rina.location.is_at_workstation === true, 'Rina is verified at workstation');
  assert(rina.animation.animation_key === 'QA_REVIEW', 'Rina animation is QA_REVIEW');
  assert(rina.current_task?.task_id === 'task_qa_303', 'Rina task provenance matches task_qa_303');
}

// ----------------------------------------------------------------------------
// TEST SECTION 3: Task Handoff Lifecycle (Irwan -> Joko -> Rina -> Sari)
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 3: Task Handoff Lifecycle & State Transitions ---');

{
  // Skenario Lifecycle:
  // Step 1: Irwan riset aktif
  // Step 2: Handoff Irwan -> Joko (Joko writing)
  // Step 3: Handoff Joko -> Rina (Rina QA)
  // Step 4: Handoff Rina -> Sari (Sari publication queue)

  const handoffIrwanToJoko = {
    handoff_id: 'hnd_live_01',
    workflow_id: 'art_bambu',
    task_id: 'task_bambu_1',
    artifact_id: 'bambu_sn',
    task_title: 'Standar Konstruksi Rangka Bambu',
    from_agent_id: 'evidence_researcher_lead',
    to_agent_id: 'content_writer_primary',
    from_department_id: 'research_evidence',
    to_department_id: 'editorial',
    from_stage: 'researching',
    to_stage: 'writing',
    handoff_state: 'RUNNING',
    transition_timestamp: '2026-10-01T20:20:00.000Z',
    evidence_source: 'task_handoff_log',
    evidence_id: 'ev_hnd_01',
    confidence: 'EXACT',
    requires_movement: true
  };

  const handoffSnapshot = createBaselineSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task_bambu_1',
          title: 'Standar Konstruksi Rangka Bambu',
          subsystem: 'editorial',
          status: 'running',
          stage: 'writing',
          retryCount: 0,
          lastUpdate: '2026-10-01T20:20:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const liveHandoff = getLiveOperationsSnapshot(handoffSnapshot, [], [handoffIrwanToJoko]);

  const jokoHandoff = liveHandoff.staff_operations['content_writer_primary'];
  const irwanHandoff = liveHandoff.staff_operations['evidence_researcher_lead'];

  assert(jokoHandoff.operational_state === 'WORKING', 'Joko transitions to WORKING upon handoff');
  assert(jokoHandoff.location.is_at_workstation === true, 'Joko moved to writer desk');
  assert(jokoHandoff.active_handoff?.handoff_id === 'hnd_live_01', 'Joko has handoff observation attached');
  assert(irwanHandoff.operational_state === 'IDLE', 'Irwan returns to IDLE after handoff completion');
  assert(irwanHandoff.location.is_in_lounge === true, 'Irwan rests in Lounge');

  // Verify Rewrite Animation on Retry Count > 0
  const rewriteSnapshot = createBaselineSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task_bambu_rewrite',
          title: 'Revisi Tone of Voice: Standar Konstruksi Rangka Bambu',
          subsystem: 'editorial',
          status: 'running',
          stage: 'writing',
          retryCount: 1, // REVISION
          lastUpdate: '2026-10-01T20:45:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const liveRewrite = getLiveOperationsSnapshot(rewriteSnapshot);
  const jokoRewrite = liveRewrite.staff_operations['content_writer_primary'];
  assert(jokoRewrite.animation.animation_key === 'ARTICLE_REWRITE', 'Joko animation switches to ARTICLE_REWRITE on retryCount > 0');
}

// ----------------------------------------------------------------------------
// TEST SECTION 4: Blocked / Anomaly Signals & Provenance
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 4: Blocked / Anomaly Representation ---');

{
  // 1. Failed Editorial task maps to BLOCKED with blockerOrError
  const failedEditorialSnapshot = createBaselineSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task_editorial_fail',
          title: 'Artikel Rusak Struktur Validasi',
          subsystem: 'editorial',
          status: 'failed',
          stage: 'failed',
          retryCount: 3,
          lastUpdate: '2026-10-01T20:50:00.000Z',
          blockerOrError: 'Evidence pack missing mandatory SNI citations'
        }
      ]
    }
  });

  const liveFailed = getLiveOperationsSnapshot(failedEditorialSnapshot);
  const jokoBlocked = liveFailed.staff_operations['content_writer_primary'];

  assert(jokoBlocked.operational_state === 'BLOCKED', 'Failed task maps operational_state to BLOCKED');
  assert(jokoBlocked.live_status === 'BLOCKED', 'live_status is BLOCKED');
  assert(jokoBlocked.animation.animation_key === 'BLOCKED_WARNING', 'Blocked staff shows BLOCKED_WARNING animation');
  assert(jokoBlocked.location.is_at_workstation === true, 'Blocked staff remains visible at workstation with warning');
  assert(jokoBlocked.current_task?.blocking_condition === 'Evidence pack missing mandatory SNI citations', 'Blocking condition preserved in provenance');

  // 2. Active Anomaly attribution to staff
  const anomalyFixture = {
    anomaly_id: 'anom_db_01',
    responsible_agent_id: 'telemetry_observer_jev',
    department_id: 'engineering_telemetry',
    title: 'D1 Database Latency Spike',
    severity: 'WARNING',
    blocking_condition: 'Query latency > 1500ms',
    state: 'OPEN',
    expected_condition: false
  };

  const dimasOp = deriveLiveStaffOperation('telemetry_observer_jev', failedEditorialSnapshot, [anomalyFixture]);
  assert(dimasOp.active_anomaly !== null, 'Dimas has active anomaly attributed');
  assert(dimasOp.active_anomaly?.title === 'D1 Database Latency Spike', 'Anomaly title matched');
  assert(dimasOp.active_anomaly?.severity === 'WARNING', 'Anomaly severity matched');
}

// ----------------------------------------------------------------------------
// TEST SECTION 5: Safety Baseline & Worker Disablement Invariants
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 5: Safety Baseline & Worker Disablement ---');

{
  // 1. Media Worker DISABLED -> Budi is OFFLINE, NEVER simulated as working
  const mediaWorkerDisabledSnapshot = createBaselineSnapshot({
    health: {
      mediaWorker: {
        dbGate: 'DISABLED',
        effectiveState: 'DISABLED',
        activeDevicesCount: 0,
        reason: 'Disabled by operator'
      }
    },
    pipeline: {
      tasks: [
        {
          taskId: 'task_media_idle_job',
          title: 'Render Diagram Konstruksi Baja',
          subsystem: 'media',
          status: 'waiting',
          stage: 'waiting_media',
          retryCount: 0,
          lastUpdate: '2026-10-01T20:55:00.000Z',
          blockerOrError: null,
          relatedMediaJobId: 'mjob_99'
        }
      ]
    }
  });

  const liveMedia = getLiveOperationsSnapshot(mediaWorkerDisabledSnapshot);
  const budi = liveMedia.staff_operations['lokamedia_worker_primary'];

  assert(budi.operational_state === 'OFFLINE', 'When media worker is DISABLED, Budi is OFFLINE');
  assert(budi.live_status === 'OFFLINE', 'Budi live_status is OFFLINE');
  assert(budi.animation.animation_key === 'OFFLINE_DISABLED', 'Budi animation is OFFLINE_DISABLED');
  assert(budi.animation.is_actively_working === false, 'is_actively_working is false for disabled worker');
  assert(budi.state_evidence.includes('DISABLED'), 'Evidence confirms worker disabled');

  // 2. Publication Queue under automation OFF -> Sari is WAITING, zero auto-dispatch
  const queuedPubSnapshot = createBaselineSnapshot({
    health: {
      automation: {
        mode: 'OFF',
        killSwitchEngaged: false,
        killReason: null,
        updatedAt: '2026-10-01T20:00:00.000Z'
      }
    },
    pipeline: {
      tasks: [
        {
          taskId: 'task_pub_queue_1',
          title: 'Artikel Siap Tayang Menunggu Approval',
          subsystem: 'publication',
          status: 'scheduled',
          stage: 'scheduled',
          retryCount: 0,
          lastUpdate: '2026-10-01T21:00:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const livePub = getLiveOperationsSnapshot(queuedPubSnapshot);
  const sari = livePub.staff_operations['publication_dispatcher_core'];

  assert(sari.operational_state === 'IDLE', 'Sari is IDLE in Lounge for scheduled queue when automation is OFF');
  assert(sari.live_status === 'WAITING', 'Sari live_status is WAITING');
  assert(sari.location.is_in_lounge === true, 'Sari stays in Lounge waiting for manual human dispatch');
  assert(sari.animation.animation_key === 'IDLE_STANDBY', 'Sari animation is IDLE_STANDBY without fake dispatch');
}

// ----------------------------------------------------------------------------
// TEST SECTION 6: Jefry Management Advisory Invariants
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 6: Jefry Advisory Invariants (Zero Authority) ---');

{
  const jefrySnapshot = createBaselineSnapshot({
    health: {
      jev: {
        mode: 'shadow',
        authority: 'none',
        providerStatus: 'SUCCESS',
        latestObservationId: 'obs_202',
        latestLatencyMs: 120,
        latestTimestamp: new Date().toISOString(),
        errorClass: null
      }
    },
    jev: {
      mode: 'shadow',
      latestObservation: {
        observationId: 'obs_202',
        decisionPoint: 'article_publication_risk',
        authoritativeDecision: 'HOLD',
        jevDecision: 'human_review',
        providerStatus: 'SUCCESS',
        latencyMs: 120,
        createdAt: new Date().toISOString(),
        rawDecision: { nextAction: 'human_review', publicationRisk: 'low' }
      }
    }
  });

  const liveJev = getLiveOperationsSnapshot(jefrySnapshot);
  const jefry = liveJev.staff_operations['management_advisor_jefry'];

  assert(jefry !== undefined, 'Jefry exists in live operations roster');
  assert(jefry.department_id === 'management', 'Jefry belongs to management department');
  assert(jefry.location.room_key === 'management_room', 'Jefry is located in management_room');
  assert(jefry.location.position_key === 'management_decision_console', 'Jefry is stationed at management_decision_console');
  assert(jefry.animation.animation_key === 'ADVISOR_HUMAN_REVIEW', 'Jefry animation reflects ADVISOR_HUMAN_REVIEW advisory state');
  assert(jefry.state_evidence.includes('0 Otoritas Eksekusi'), 'Jefry state explicitly confirms 0 Otoritas Eksekusi');
  assert(liveJev.safety_invariants.jefry_execution_authority === 'ZERO_ADVISORY_ONLY', 'Safety invariant confirms zero autonomous authority');
}

// ----------------------------------------------------------------------------
// TEST SECTION 7: Determinism & Pixel Office Integration
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 7: Determinism & Pixel Office Integration ---');

{
  const testSnapshot = createBaselineSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task_det_1',
          title: 'Uji Determinisme Sistem Live Ops',
          subsystem: 'editorial',
          status: 'running',
          stage: 'writing',
          retryCount: 0,
          lastUpdate: '2026-10-01T20:00:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  // Evaluate twice with identical input
  const run1 = getLiveOperationsSnapshot(testSnapshot);
  const run2 = getLiveOperationsSnapshot(testSnapshot);

  assert(JSON.stringify(run1.staff_operations) === JSON.stringify(run2.staff_operations), 'Identical input generates 100% identical staff operations');
  assert(JSON.stringify(run1.summary) === JSON.stringify(run2.summary), 'Identical input generates 100% identical summary');

  // Verify integration with getPixelOfficeState
  testSnapshot.live_operations = run1;
  const officeState = getPixelOfficeState(testSnapshot);

  assert(officeState.live_operations !== undefined, 'PixelOfficeState carries live_operations payload');
  assert(officeState.rooms.some((r) => r.room_key === 'management_room'), 'PixelOfficeState includes management_room in rooms list');
  assert(officeState.sprites.some((s) => s.agent_id === 'management_advisor_jefry'), 'PixelOfficeState includes Jefry in sprites list');
}

// ----------------------------------------------------------------------------
// TEST SECTION 8: API Route Contract (/api/admin/mission-control/liveops)
// ----------------------------------------------------------------------------
console.log('\n--- TEST SECTION 8: API Route Invariants ---');

{
  // 1. Non-GET method returns 405 Method Not Allowed
  const mockPostRequest = new Request('https://rancangloka.com/api/admin/mission-control/liveops', {
    method: 'POST'
  });
  const mockContextPost = {
    request: mockPostRequest,
    url: new URL(mockPostRequest.url),
    locals: {
      runtime: { env: {} }
    }
  };

  const postResponse = await liveOpsApiRoute(mockContextPost);
  assert(postResponse.status === 405, 'API route returns 405 Method Not Allowed for POST requests');

  // 2. GET returns 200 with full Live Operations contract
  const mockGetRequest = new Request('https://rancangloka.com/api/admin/mission-control/liveops', {
    method: 'GET'
  });
  const mockContextGet = {
    request: mockGetRequest,
    url: new URL(mockGetRequest.url),
    locals: {
      runtime: { env: {} }
    }
  };

  const getResponse = await liveOpsApiRoute(mockContextGet);
  assert(getResponse.status === 200, 'API route returns 200 OK for valid GET request');
  const getBody = await getResponse.json();
  assert(getBody.summary !== undefined, 'API payload contains summary');
  assert(getBody.staff_operations !== undefined, 'API payload contains staff_operations');
  assert(getBody.safety_invariants !== undefined, 'API payload contains safety_invariants');

  // 3. GET with specific agent_id queries that staff member
  const mockAgentRequest = new Request('https://rancangloka.com/api/admin/mission-control/liveops?agent_id=content_writer_primary', {
    method: 'GET'
  });
  const mockContextAgent = {
    request: mockAgentRequest,
    url: new URL(mockAgentRequest.url),
    locals: {
      runtime: { env: {} }
    }
  };

  const agentResponse = await liveOpsApiRoute(mockContextAgent);
  assert(agentResponse.status === 200, 'API route returns 200 for specific agent_id');
  const agentBody = await agentResponse.json();
  assert(agentBody.agent_id === 'content_writer_primary', 'Returned record matches queried agent_id');
  assert(agentBody.provenance !== undefined, 'Staff record has complete provenance');

  // 4. GET with unknown agent returns 404
  const mockUnknownRequest = new Request('https://rancangloka.com/api/admin/mission-control/liveops?agent_id=unknown_agent_999', {
    method: 'GET'
  });
  const mockContextUnknown = {
    request: mockUnknownRequest,
    url: new URL(mockUnknownRequest.url),
    locals: {
      runtime: { env: {} }
    }
  };

  const unknownResponse = await liveOpsApiRoute(mockContextUnknown);
  assert(unknownResponse.status === 404, 'API route returns 404 for unknown agent_id');
}

// ----------------------------------------------------------------------------
// SUMMARY & REPORT
// ----------------------------------------------------------------------------
console.log('\n===========================================================');
console.log(`🏁 Live Operations Test Suite Finished: ${passCount} Passed, ${failCount} Failed`);
console.log('===========================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
