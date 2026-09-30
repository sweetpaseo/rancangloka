/**
 * RancangLoka — STAFF REGISTRY TEST SUITE
 * Milestone: HERMES-MC-2
 * 
 * Verifies:
 * 1. Machine vs display identity separation (central configurable names).
 * 2. Stable canonical machine IDs (agent_id) and initial roster.
 * 3. Presentation capability mappings.
 * 4. Task attribution & priority rules (1: active, 2: blocked, 3: reviewing, 4: latest).
 * 5. Deterministic activity attribution & low-confidence fallback (System/Unassigned).
 * 6. WORKING state derivation across roles.
 * 7. IDLE state derivation for healthy/standby roles.
 * 8. REVIEWING state derivation for review & QA pipelines.
 * 9. BLOCKED state derivation on errors, breakers, and kill-switches.
 * 10. OFFLINE state derivation on daemon offline or worker disabled.
 * 11. UNKNOWN state derivation on absent telemetry / null snapshot.
 * 12. Strict null current task fallback (never invents placeholder tasks).
 * 13. Disabled media worker safety invariant (Budi must never be WORKING when disabled).
 * 14. JEV shadow & zero publication authority representation for Dimas.
 * 15. Strict read-only invariant (no write-capable methods or side-effects).
 * 16. Social department unstaffed & unavailable representation.
 */

import assert from 'node:assert/strict';
import {
  getStaffDefinitions,
  getStaffDefinitionByAgentId,
  configureStaffDisplayNames,
  resetStaffDisplayNames,
  attributeActivityEvent,
  deriveStaffCurrentTask,
  deriveStaffState,
  getStaffRoster,
  DEPARTMENTS_METADATA
} from '../src/lib/mission-control/staff-registry.ts';

// Helper to create a baseline healthy mock snapshot
function createMockSnapshot(overrides = {}) {
  const base = {
    generatedAt: '2026-09-30T10:00:00.000Z',
    freshness: 'FRESH',
    environment: 'test',
    health: {
      overallStatus: 'HEALTHY',
      automation: {
        mode: 'OFF',
        killSwitchEngaged: false,
        killReason: null,
        updatedAt: '2026-09-30T09:00:00.000Z'
      },
      mediaWorker: {
        dbGate: 'DISABLED',
        effectiveState: 'DISABLED',
        activeDevicesCount: 0,
        reason: 'Disabled in settings'
      },
      jev: {
        mode: 'shadow',
        authority: 'none',
        providerStatus: 'SUCCESS',
        latestObservationId: 'obs_001',
        latestLatencyMs: 180,
        latestTimestamp: '2026-09-30T09:59:00.000Z',
        errorClass: null
      },
      circuitBreakers: [
        {
          id: 'global_publisher',
          state: 'CLOSED',
          failureCount: 0,
          failureThreshold: 3,
          tripReason: null,
          lastFailureAt: null,
          lastStateChangeAt: null
        }
      ]
    },
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
    activity: [],
    scheduler: {
      hermes: {
        status: 'healthy',
        recordedAt: '2026-09-30T09:58:00.000Z',
        senderStatus: 'OK',
        cycleStatus: 'IDLE',
        freshnessSeconds: 120,
        note: 'Daemon running normally'
      },
      cloudflareCron: []
    },
    outbox: {
      queued: 0,
      sending: 0,
      acknowledged: 5,
      deadLetter: 0,
      source: 'd1_receipts',
      lastIngestAt: '2026-09-30T09:30:00.000Z'
    },
    articles: {
      draftCount: 0,
      awaitingReviewCount: 0,
      approvedCount: 0,
      publishedCount: 10,
      quarantinedCount: 0,
      latestPublished: null,
      latestApproval: null,
      latestReceipt: null
    },
    media: {
      effectiveWorkerState: 'DISABLED',
      pendingJobsCount: 0,
      inProgressJobsCount: 0,
      failedJobsCount: 0,
      attachedJobsCount: 0,
      totalAssetsCount: 15,
      activeDevicesCount: 0,
      recentEvent: null
    },
    jev: {
      mode: 'shadow',
      authority: 'none',
      totalObservationsCount: 1,
      agreementRatePercent: 100,
      latestObservation: null,
      recentObservations: []
    }
  };

  // Deep merge overrides
  return {
    ...base,
    ...overrides,
    health: { ...base.health, ...(overrides.health || {}) },
    pipeline: { ...base.pipeline, ...(overrides.pipeline || {}) },
    scheduler: { ...base.scheduler, ...(overrides.scheduler || {}) },
    media: { ...base.media, ...(overrides.media || {}) },
    articles: { ...base.articles, ...(overrides.articles || {}) },
    jev: { ...base.jev, ...(overrides.jev || {}) }
  };
}

async function runStaffTests() {
  console.log('🧪 Starting HERMES-MC-2 Staff Registry Test Suite...\n');
  let passed = 0;

  // TEST 1: Machine vs Display Identity Separation & Central Display Name Configuration
  {
    console.log('Test 1: Machine vs Display Identity Separation & Central Name Configuration');
    resetStaffDisplayNames();

    const staff = getStaffDefinitions();
    assert.equal(staff.length, 6, 'Must define 6 staff members');
    const joko = staff.find((s) => s.agent_id === 'content_writer_primary');
    assert.ok(joko, 'content_writer_primary must exist');
    assert.equal(joko.display_name, 'Joko', 'Default display name must be Joko');

    // Central display name override test
    configureStaffDisplayNames({ content_writer_primary: 'Joko Widodo Editorial' });
    const updatedStaff = getStaffDefinitions();
    const updatedJoko = updatedStaff.find((s) => s.agent_id === 'content_writer_primary');
    assert.equal(updatedJoko.display_name, 'Joko Widodo Editorial', 'Display name must update');
    assert.equal(updatedJoko.agent_id, 'content_writer_primary', 'Machine ID must remain strictly unchanged');

    // Reset override
    resetStaffDisplayNames();
    const resetStaff = getStaffDefinitions();
    assert.equal(resetStaff.find((s) => s.agent_id === 'content_writer_primary')?.display_name, 'Joko');
    console.log('  ✅ PASS: Human names and authoritative machine IDs are strictly separated and configurable.\n');
    passed++;
  }

  // TEST 2: Canonical Initial Staff Roster & Machine IDs
  {
    console.log('Test 2: Canonical Initial Staff Roster & Machine IDs');
    const expectedRoster = [
      { id: 'content_writer_primary', name: 'Joko', role: 'Content Writer', dep: 'editorial', avatar: 'editorial_writer_01' },
      { id: 'evidence_researcher_lead', name: 'Irwan', role: 'Research & Evidence Specialist', dep: 'research_evidence', avatar: 'research_evidence_01' },
      { id: 'editorial_qa_primary', name: 'Rina', role: 'Editorial QA', dep: 'editorial', avatar: 'editorial_qa_01' },
      { id: 'lokamedia_worker_primary', name: 'Budi', role: 'Media Operations', dep: 'media', avatar: 'media_ops_01' },
      { id: 'publication_dispatcher_core', name: 'Sari', role: 'Publication Operator', dep: 'publication_operations', avatar: 'publication_ops_01' },
      { id: 'telemetry_observer_jev', name: 'Dimas', role: 'Decision & Telemetry Analyst', dep: 'engineering_telemetry', avatar: 'telemetry_01' }
    ];

    for (const exp of expectedRoster) {
      const def = getStaffDefinitionByAgentId(exp.id);
      assert.ok(def, `Agent ${exp.id} must exist in registry`);
      assert.equal(def.display_name, exp.name, `Display name mismatch for ${exp.id}`);
      assert.equal(def.role, exp.role, `Role mismatch for ${exp.id}`);
      assert.equal(def.department_id, exp.dep, `Department mismatch for ${exp.id}`);
      assert.equal(def.avatar_key, exp.avatar, `Avatar key mismatch for ${exp.id}`);
      assert.equal(def.active, true, `Staff ${exp.id} must be active`);
    }
    console.log('  ✅ PASS: All 6 initial staff members have accurate canonical machine definitions.\n');
    passed++;
  }

  // TEST 3: Capability Ownership Mappings
  {
    console.log('Test 3: Capability Ownership Mappings');
    const capMap = {
      content_writer_primary: 'ARTICLE_WRITING',
      evidence_researcher_lead: 'EVIDENCE_RESEARCH',
      editorial_qa_primary: 'EDITORIAL_QA',
      lokamedia_worker_primary: 'MEDIA_OPERATIONS',
      publication_dispatcher_core: 'PUBLICATION_OPERATIONS',
      telemetry_observer_jev: 'SYSTEM_TELEMETRY'
    };

    for (const [agentId, cap] of Object.entries(capMap)) {
      const def = getStaffDefinitionByAgentId(agentId);
      assert.ok(def.capabilities.includes(cap), `${agentId} must possess capability ${cap}`);
    }
    console.log('  ✅ PASS: Presentation capability mappings align with organizational ownership.\n');
    passed++;
  }

  // TEST 4: Activity Attribution & Low-Confidence Fallback
  {
    console.log('Test 4: Activity Attribution & Low-Confidence Fallback');
    
    // 1. Media event -> Budi
    const mediaEv = { eventId: 'ev1', timestamp: '2026-09-30T10:00:00Z', subsystem: 'media', eventType: 'MEDIA_STAGE_EVENT', statusOrSeverity: 'INFO', summary: 'Media generated', entityReference: 'job_1' };
    const r1 = attributeActivityEvent(mediaEv);
    assert.equal(r1.attributedAgentId, 'lokamedia_worker_primary', 'Media event must map to Budi');
    assert.equal(r1.attributedStaffName, 'Budi');

    // 2. Decision event -> Dimas
    const jevEv = { eventId: 'ev2', timestamp: '2026-09-30T10:01:00Z', subsystem: 'engineering', eventType: 'JEV_SHADOW_OBSERVATION', statusOrSeverity: 'INFO', summary: 'Shadow decision', entityReference: 'obs_1' };
    const r2 = attributeActivityEvent(jevEv);
    assert.equal(r2.attributedAgentId, 'telemetry_observer_jev', 'Decision event must map to Dimas');
    assert.equal(r2.attributedStaffName, 'Dimas');

    // 3. Publication event -> Sari
    const pubEv = { eventId: 'ev3', timestamp: '2026-09-30T10:02:00Z', subsystem: 'publication', eventType: 'PUBLICATION_CRON_EXECUTION', statusOrSeverity: 'SUCCESS', summary: 'Cron ran', entityReference: 'cron_1' };
    const r3 = attributeActivityEvent(pubEv);
    assert.equal(r3.attributedAgentId, 'publication_dispatcher_core', 'Publication event must map to Sari');

    // 4. Writer event -> Joko
    const writerEv = { eventId: 'ev4', timestamp: '2026-09-30T10:03:00Z', subsystem: 'editorial', eventType: 'ARTICLE_DRAFT_INGEST', statusOrSeverity: 'INFO', summary: 'Draft ingested', entityReference: 'art_1' };
    const r4 = attributeActivityEvent(writerEv);
    assert.equal(r4.attributedAgentId, 'content_writer_primary', 'Draft event must map to Joko');

    // 5. Research event -> Irwan
    const resEv = { eventId: 'ev5', timestamp: '2026-09-30T10:04:00Z', subsystem: 'research', eventType: 'EVIDENCE_PACK_READY', statusOrSeverity: 'INFO', summary: 'Evidence ready', entityReference: 'pack_1' };
    const r5 = attributeActivityEvent(resEv);
    assert.equal(r5.attributedAgentId, 'evidence_researcher_lead', 'Research event must map to Irwan');

    // 6. QA event -> Rina
    const qaEv = { eventId: 'ev6', timestamp: '2026-09-30T10:05:00Z', subsystem: 'editorial', eventType: 'EDITORIAL_QA_PASSED', statusOrSeverity: 'SUCCESS', summary: 'QA passed', entityReference: 'gate_1' };
    const r6 = attributeActivityEvent(qaEv);
    assert.equal(r6.attributedAgentId, 'editorial_qa_primary', 'QA event must map to Rina');

    // 7. Low-confidence / generic event -> System / Unassigned
    const genericEv = { eventId: 'ev7', timestamp: '2026-09-30T10:06:00Z', subsystem: 'system', eventType: 'SYSTEM_CONFIG_UPDATED', statusOrSeverity: 'INFO', summary: 'Config updated', entityReference: null };
    const r7 = attributeActivityEvent(genericEv);
    assert.equal(r7.attributedAgentId, null, 'Generic event must have null agent ID');
    assert.equal(r7.attributedStaffName, 'System', 'Generic event must be named System');
    assert.equal(r7.confidence, 'NONE');

    console.log('  ✅ PASS: Activity attribution correctly attributes events and safely defaults to System/Unassigned.\n');
    passed++;
  }

  // TEST 5: WORKING State Derivation
  {
    console.log('Test 5: WORKING State Derivation');
    
    // Joko WORKING when task in writing stage
    const snap1 = createMockSnapshot({
      pipeline: {
        tasks: [
          { taskId: 'art_1', title: 'Cara Pasang Dak Beton', subsystem: 'editorial', status: 'draft', stage: 'writing', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null }
        ]
      }
    });
    const s1 = deriveStaffState('content_writer_primary', snap1);
    assert.equal(s1.state, 'WORKING', 'Joko must be WORKING when writing task exists');
    assert.ok(s1.evidence.includes('Sedang menulis naskah'), 'Evidence must reflect writing');

    // Irwan WORKING when task in researching stage
    const snap2 = createMockSnapshot({
      pipeline: {
        tasks: [
          { taskId: 'art_2', title: 'Standar SNI Besi Beton', subsystem: 'research', status: 'draft', stage: 'researching', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null }
        ]
      }
    });
    const s2 = deriveStaffState('evidence_researcher_lead', snap2);
    assert.equal(s2.state, 'WORKING', 'Irwan must be WORKING when research task exists');

    // Rina WORKING when task in validating stage
    const snap3 = createMockSnapshot({
      pipeline: {
        tasks: [
          { taskId: 'art_3', title: 'Validasi Standar Finishing', subsystem: 'editorial', status: 'draft', stage: 'validating', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null }
        ]
      }
    });
    const s3 = deriveStaffState('editorial_qa_primary', snap3);
    assert.equal(s3.state, 'WORKING', 'Rina must be WORKING when validating task exists');

    // Budi WORKING when worker ENABLED and job in progress
    const snap4 = createMockSnapshot({
      health: {
        mediaWorker: { dbGate: 'ENABLED', effectiveState: 'ENABLED', activeDevicesCount: 1, reason: 'Active' }
      },
      media: {
        effectiveWorkerState: 'ENABLED',
        inProgressJobsCount: 2,
        activeDevicesCount: 1
      }
    });
    const s4 = deriveStaffState('lokamedia_worker_primary', snap4);
    assert.equal(s4.state, 'WORKING', 'Budi must be WORKING when worker enabled and in-progress jobs exist');

    console.log('  ✅ PASS: WORKING states are derived exclusively from active real tasks.\n');
    passed++;
  }

  // TEST 6: IDLE State Derivation & Automation OFF Rule
  {
    console.log('Test 6: IDLE State Derivation & Automation OFF Safe Handling');
    const snap = createMockSnapshot(); // all clean zeroes, mode OFF

    const sJoko = deriveStaffState('content_writer_primary', snap);
    assert.equal(sJoko.state, 'IDLE', 'Joko must be IDLE when pipeline is healthy and empty');

    const sIrwan = deriveStaffState('evidence_researcher_lead', snap);
    assert.equal(sIrwan.state, 'IDLE', 'Irwan must be IDLE when no research tasks');

    const sSari = deriveStaffState('publication_dispatcher_core', snap);
    assert.equal(sSari.state, 'IDLE', 'Sari must be IDLE when automation mode is OFF');
    assert.ok(!sSari.evidence.toLowerCase().includes('error'), 'Mode OFF must not be labeled an error');
    assert.ok(sSari.evidence.includes('siaga'), 'Evidence must state standby/siaga');

    console.log('  ✅ PASS: Healthy empty states correctly evaluate to IDLE and automation OFF is not an error.\n');
    passed++;
  }

  // TEST 7: REVIEWING State Derivation
  {
    console.log('Test 7: REVIEWING State Derivation');
    // Rina REVIEWING when drafts await review
    const snapReview = createMockSnapshot({
      articles: {
        draftCount: 3,
        awaitingReviewCount: 3,
        approvedCount: 0
      }
    });
    const sRina = deriveStaffState('editorial_qa_primary', snapReview);
    assert.equal(sRina.state, 'REVIEWING', 'Rina must be REVIEWING when awaiting review drafts exist');
    assert.ok(sRina.evidence.includes('3 artikel draf'), 'Evidence must reflect review count');

    // Sari REVIEWING when scheduled publication articles exist
    const snapSched = createMockSnapshot({
      health: {
        automation: { mode: 'PLAN_ONLY', killSwitchEngaged: false }
      },
      pipeline: {
        tasks: [
          { taskId: 'art_sched_1', title: 'Jadwal Terbit Besok', subsystem: 'publication', status: 'scheduled', stage: 'scheduled', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null }
        ]
      }
    });
    const sSari = deriveStaffState('publication_dispatcher_core', snapSched);
    assert.equal(sSari.state, 'REVIEWING', 'Sari must be REVIEWING when scheduled queue is populated');

    console.log('  ✅ PASS: REVIEWING state properly reflects review and scheduling queues.\n');
    passed++;
  }

  // TEST 8: BLOCKED State Derivation (Breakers, Failures, Kill Switch)
  {
    console.log('Test 8: BLOCKED State Derivation');
    
    // 1. Sari BLOCKED when Emergency Kill Switch engaged
    const snapKill = createMockSnapshot({
      health: {
        automation: { mode: 'OFF', killSwitchEngaged: true, killReason: 'Manual freeze by operator' }
      }
    });
    const sSariKill = deriveStaffState('publication_dispatcher_core', snapKill);
    assert.equal(sSariKill.state, 'BLOCKED', 'Sari must be BLOCKED when kill switch is engaged');
    assert.ok(sSariKill.evidence.includes('Emergency Kill Switch'), 'Evidence must cite kill switch');

    // 2. Sari BLOCKED when publisher circuit breaker is OPEN
    const snapBreaker = createMockSnapshot({
      health: {
        circuitBreakers: [{ id: 'global_publisher', state: 'OPEN', failureCount: 3, failureThreshold: 3, tripReason: 'D1 timeout' }]
      }
    });
    const sSariBreaker = deriveStaffState('publication_dispatcher_core', snapBreaker);
    assert.equal(sSariBreaker.state, 'BLOCKED', 'Sari must be BLOCKED when global_publisher breaker is OPEN');

    // 3. Joko BLOCKED when writing task failed
    const snapFailed = createMockSnapshot({
      pipeline: {
        tasks: [
          { taskId: 'art_fail_1', title: 'Draf Gagal', subsystem: 'editorial', status: 'draft', stage: 'failed', retryCount: 3, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: 'Token limit exceeded' }
        ]
      }
    });
    const sJokoFail = deriveStaffState('content_writer_primary', snapFailed);
    assert.equal(sJokoFail.state, 'BLOCKED', 'Joko must be BLOCKED when authoring task fails');

    // 4. Dimas BLOCKED when JEV provider has ERROR status
    const snapJevErr = createMockSnapshot({
      health: {
        jev: { mode: 'shadow', authority: 'none', providerStatus: 'ERROR', errorClass: 'HTTP_502' }
      }
    });
    const sDimasErr = deriveStaffState('telemetry_observer_jev', snapJevErr);
    assert.equal(sDimasErr.state, 'BLOCKED', 'Dimas must be BLOCKED when JEV provider status is ERROR');

    console.log('  ✅ PASS: BLOCKED state is triggered on kill-switch, open breakers, failed tasks, and provider errors.\n');
    passed++;
  }

  // TEST 9: OFFLINE State Derivation
  {
    console.log('Test 9: OFFLINE State Derivation');
    
    // Hermes scheduler offline -> Joko & Irwan & Rina OFFLINE
    const snapOffline = createMockSnapshot({
      scheduler: {
        hermes: { status: 'offline', note: 'Container uncontactable for 900s' }
      }
    });
    const sJokoOff = deriveStaffState('content_writer_primary', snapOffline);
    assert.equal(sJokoOff.state, 'OFFLINE', 'Joko must be OFFLINE when Hermes is offline');

    const sIrwanOff = deriveStaffState('evidence_researcher_lead', snapOffline);
    assert.equal(sIrwanOff.state, 'OFFLINE', 'Irwan must be OFFLINE when Hermes is offline');

    // Budi OFFLINE when Media Worker is DISABLED
    const snapMediaOff = createMockSnapshot({
      health: {
        mediaWorker: { effectiveState: 'DISABLED', activeDevicesCount: 0 }
      }
    });
    const sBudiOff = deriveStaffState('lokamedia_worker_primary', snapMediaOff);
    assert.equal(sBudiOff.state, 'OFFLINE', 'Budi must be OFFLINE when media worker is DISABLED');

    console.log('  ✅ PASS: OFFLINE states accurately reflect container and worker downtime.\n');
    passed++;
  }

  // TEST 10: UNKNOWN State Derivation (Missing Snapshot / Incomplete Telemetry)
  {
    console.log('Test 10: UNKNOWN State Derivation');
    const sNull = deriveStaffState('content_writer_primary', null);
    assert.equal(sNull.state, 'UNKNOWN', 'Null snapshot must evaluate to UNKNOWN');
    assert.ok(sNull.evidence.includes('tidak tersedia'), 'Evidence must explain missing data');

    const snapIncomplete = createMockSnapshot({
      scheduler: { hermes: { status: 'unknown' } },
      health: null
    });
    const sInc = deriveStaffState('editorial_qa_primary', snapIncomplete);
    assert.equal(sInc.state, 'UNKNOWN', 'Incomplete telemetry must evaluate to UNKNOWN');

    console.log('  ✅ PASS: Missing or uninitialized telemetry safely maps to UNKNOWN.\n');
    passed++;
  }

  // TEST 11: Disabled Media Worker Safety Invariant (Budi Never WORKING when Disabled)
  {
    console.log('Test 11: Disabled Media Worker Safety Invariant');
    // Even if there are pending or leased media jobs in database, if worker is DISABLED, Budi must NEVER be WORKING
    const snapForbiddenWork = createMockSnapshot({
      health: {
        mediaWorker: { effectiveState: 'DISABLED', activeDevicesCount: 0, reason: 'Operator locked' }
      },
      media: {
        effectiveWorkerState: 'DISABLED',
        inProgressJobsCount: 3,
        pendingJobsCount: 5
      },
      pipeline: {
        tasks: [
          { taskId: 'mjob_1', title: 'Visual Rendering', subsystem: 'media', status: 'GENERATING', stage: 'waiting_media', retryCount: 1, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null }
        ]
      }
    });

    const sBudi = deriveStaffState('lokamedia_worker_primary', snapForbiddenWork);
    assert.notEqual(sBudi.state, 'WORKING', 'CRITICAL: Budi must NEVER be WORKING when media worker is DISABLED');
    assert.equal(sBudi.state, 'OFFLINE', 'Budi must be OFFLINE when media worker is DISABLED');

    const tBudi = deriveStaffCurrentTask('lokamedia_worker_primary', snapForbiddenWork);
    assert.notEqual(tBudi?.current_task_status, 'GENERATING', 'Current task must not show active generation when disabled');

    console.log('  ✅ PASS: Strict invariant upheld: Media worker DISABLED prevents Budi from appearing WORKING.\n');
    passed++;
  }

  // TEST 12: JEV Shadow & Zero Publication Authority Invariant (Dimas)
  {
    console.log('Test 12: JEV Shadow & Zero Publication Authority Invariant');
    const snapJev = createMockSnapshot({
      health: {
        jev: { mode: 'shadow', authority: 'none', providerStatus: 'SUCCESS' }
      }
    });

    const dimasDef = getStaffDefinitionByAgentId('telemetry_observer_jev');
    assert.ok(dimasDef.description.includes('shadow mode'), 'Description must state shadow mode');
    assert.ok(dimasDef.description.includes('zero execution authority'), 'Description must state zero authority');
    assert.ok(!dimasDef.capabilities.includes('PUBLICATION_OPERATIONS'), 'Dimas must NOT possess publication capability');

    const sDimas = deriveStaffState('telemetry_observer_jev', snapJev);
    assert.ok(sDimas.evidence.includes('Otoritas: none'), 'Evidence must state 0 authority');

    console.log('  ✅ PASS: Strict invariant upheld: Dimas represents shadow-only telemetry with zero authority.\n');
    passed++;
  }

  // TEST 13: Strict Null Current Task Fallback
  {
    console.log('Test 13: Strict Null Current Task Fallback');
    const cleanSnap = createMockSnapshot(); // clean snapshot, 0 tasks

    const tJoko = deriveStaffCurrentTask('content_writer_primary', cleanSnap);
    assert.equal(tJoko, null, 'Joko current task must be null when no tasks exist');

    const tIrwan = deriveStaffCurrentTask('evidence_researcher_lead', cleanSnap);
    assert.equal(tIrwan, null, 'Irwan current task must be null when no tasks exist');

    const tRina = deriveStaffCurrentTask('editorial_qa_primary', cleanSnap);
    assert.equal(tRina, null, 'Rina current task must be null when no tasks exist');

    const tSari = deriveStaffCurrentTask('publication_dispatcher_core', cleanSnap);
    assert.equal(tSari, null, 'Sari current task must be null when no tasks exist');

    console.log('  ✅ PASS: When no reliable task exists, current_task is strictly null without placeholder fabrication.\n');
    passed++;
  }

  // TEST 14: Department Registry Metadata & Social Unstaffed Invariant
  {
    console.log('Test 14: Department Registry Metadata & Social Unstaffed Invariant');
    assert.equal(DEPARTMENTS_METADATA.length, 6, 'Must define 6 departments');

    const social = DEPARTMENTS_METADATA.find((d) => d.department_id === 'social');
    assert.ok(social, 'Social department metadata must be prepared');
    assert.equal(social.is_available, false, 'Social department must be unavailable in MC-2');
    assert.equal(social.is_staffed, false, 'Social department must NOT be staffed in MC-2');

    const allStaff = getStaffDefinitions();
    const socialStaff = allStaff.filter((s) => s.department_id === 'social');
    assert.equal(socialStaff.length, 0, 'No staff member may belong to Social department in MC-2');

    console.log('  ✅ PASS: Department registry metadata prepared and Social department is cleanly unstaffed.\n');
    passed++;
  }

  // TEST 15: Full Staff Roster Aggregation & Summary Counts
  {
    console.log('Test 15: Full Staff Roster Aggregation & Summary Counts');
    const snap = createMockSnapshot({
      health: {
        mediaWorker: { effectiveState: 'DISABLED', activeDevicesCount: 0 }
      },
      pipeline: {
        tasks: [
          { taskId: 'art_w', title: 'Menulis Desain Ruang', subsystem: 'editorial', status: 'draft', stage: 'writing', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null }
        ]
      }
    });

    const roster = getStaffRoster(snap);
    assert.equal(roster.staff.length, 6, 'Roster must contain 6 staff members');
    assert.equal(roster.summary.total, 6, 'Summary total must be 6');
    assert.equal(roster.summary.working, 1, 'Summary working must count Joko (1)');
    assert.equal(roster.summary.offline, 1, 'Summary offline must count Budi (1)');
    assert.equal(roster.summary.idle, 4, 'Summary idle must count Irwan, Rina, Sari, Dimas (4)');

    const jokoStatus = roster.staff.find((s) => s.agent_id === 'content_writer_primary');
    assert.equal(jokoStatus.state, 'WORKING');
    assert.equal(jokoStatus.current_task?.current_task_id, 'art_w');

    console.log('  ✅ PASS: Master staff roster aggregates status, current tasks, and summary counts correctly.\n');
    passed++;
  }

  // TEST 16: Strict Read-Only Invariant (Zero Mutations)
  {
    console.log('Test 16: Strict Read-Only Invariant (Zero Mutations)');
    const snap = createMockSnapshot();
    const snapClone = JSON.parse(JSON.stringify(snap));

    // Calling roster compiler multiple times should not alter input or execute mutations
    const r1 = getStaffRoster(snap);
    const r2 = getStaffRoster(snap);

    assert.deepEqual(snap, snapClone, 'Input snapshot must remain completely unmodified');
    assert.equal(r1.staff.length, r2.staff.length);
    assert.equal(r1.summary.total, r2.summary.total);

    console.log('  ✅ PASS: Staff registry functions are 100% read-only and free of side-effects.\n');
    passed++;
  }

  console.log(`🎉 All ${passed}/${passed} HERMES-MC-2 Staff Registry tests PASSED!\n`);
}

runStaffTests().catch((err) => {
  console.error('❌ Staff registry test failed with error:', err);
  process.exit(1);
});
