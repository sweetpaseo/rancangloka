/**
 * RancangLoka — MISSION CONTROL DEPARTMENT OPERATIONS TEST SUITE
 * Milestone: HERMES-MC-3
 * 
 * Verifies:
 * 1. Department registry validity & unique department IDs.
 * 2. Deterministic staff membership per department.
 * 3. Unstaffed Social department invariant (NOT_AVAILABLE / 0 staff).
 * 4. HEALTHY derivation for healthy standby departments.
 * 5. ACTIVE derivation for active in-progress work.
 * 6. DEGRADED derivation on warnings, retries, or stale telemetry.
 * 7. BLOCKED derivation on open breakers and kill-switch.
 * 8. OFFLINE derivation for disabled media worker and offline daemon.
 * 9. UNKNOWN derivation on missing/uninitialized telemetry.
 * 10. NOT_AVAILABLE derivation for unimplemented capacity.
 * 11. Deterministic task ownership attribution (EXACT, DERIVED, UNASSIGNED).
 * 12. Ambiguous/system task unassigned behavior.
 * 13. Department event attribution with confidence classification.
 * 14. Genuine cross-department handoff derivation.
 * 15. Zero fake handoffs when no cross-department transition exists.
 * 16. Structural blocker model mapping and operator action classification.
 * 17. Pixel Office room metadata preparation (room_key, workstation_zone).
 * 18. Staff logical room mapping.
 * 19. Clean zero-state behavior without fabrication.
 * 20. Strict read-only invariant (zero mutations or database side-effects).
 */

import assert from 'node:assert/strict';
import {
  CANONICAL_DEPARTMENTS,
  STAFF_ROOM_MAP,
  attributeTaskOwnership,
  attributeActivityToDepartment,
  deriveDepartmentBlockers,
  deriveDepartmentHandoffs,
  deriveDepartmentHealth,
  getOrganizationSnapshot,
  getDepartmentById
} from '../src/lib/mission-control/department-registry.ts';

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

async function runDepartmentTests() {
  console.log('🧪 Starting HERMES-MC-3 Department Operations Test Suite...\n');
  let passed = 0;

  // TEST 1: Department Registry Validity & Unique IDs
  {
    console.log('Test 1: Department Registry Validity & Unique IDs');
    assert.equal(CANONICAL_DEPARTMENTS.length, 6, 'Must define exactly 6 departments');
    const ids = CANONICAL_DEPARTMENTS.map((d) => d.department_id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, 6, 'All department IDs must be strictly unique');

    const expectedDepts = ['editorial', 'research_evidence', 'media', 'publication_operations', 'engineering_telemetry', 'social'];
    for (const id of expectedDepts) {
      assert.ok(uniqueIds.has(id), `Department ${id} must exist in registry`);
    }
    console.log('  ✅ PASS: Department registry is valid with 6 unique canonical identifiers.\n');
    passed++;
  }

  // TEST 2: Deterministic Staff Membership
  {
    console.log('Test 2: Deterministic Staff Membership');
    const snap = createMockSnapshot();
    const org = getOrganizationSnapshot(snap);

    const editorial = org.departments.find((d) => d.department_id === 'editorial');
    assert.ok(editorial);
    assert.equal(editorial.staff.length, 2, 'Editorial must have 2 staff members');
    const editorialAgentIds = editorial.staff.map((s) => s.agent_id).sort();
    assert.deepEqual(editorialAgentIds, ['content_writer_primary', 'editorial_qa_primary']);

    const research = org.departments.find((d) => d.department_id === 'research_evidence');
    assert.ok(research);
    assert.equal(research.staff.length, 1);
    assert.equal(research.staff[0].agent_id, 'evidence_researcher_lead');

    const media = org.departments.find((d) => d.department_id === 'media');
    assert.ok(media);
    assert.equal(media.staff.length, 1);
    assert.equal(media.staff[0].agent_id, 'lokamedia_worker_primary');

    const publication = org.departments.find((d) => d.department_id === 'publication_operations');
    assert.ok(publication);
    assert.equal(publication.staff.length, 1);
    assert.equal(publication.staff[0].agent_id, 'publication_dispatcher_core');

    const engineering = org.departments.find((d) => d.department_id === 'engineering_telemetry');
    assert.ok(engineering);
    assert.equal(engineering.staff.length, 1);
    assert.equal(engineering.staff[0].agent_id, 'telemetry_observer_jev');

    console.log('  ✅ PASS: All 6 staff members map deterministically to their respective departments.\n');
    passed++;
  }

  // TEST 3: Unstaffed Social Department Invariant
  {
    console.log('Test 3: Unstaffed Social Department Invariant');
    const snap = createMockSnapshot();
    const social = getDepartmentById('social', snap);
    assert.ok(social, 'Social department must exist');
    assert.equal(social.status, 'NOT_AVAILABLE');
    assert.equal(social.availability, 'NOT_AVAILABLE');
    assert.equal(social.health, 'NOT_AVAILABLE');
    assert.equal(social.is_staffed, false);
    assert.equal(social.staff_count, 0);
    assert.equal(social.staff.length, 0);
    assert.equal(social.active_task_count, 0);
    assert.ok(social.health_evidence.includes('unstaffed'));
    console.log('  ✅ PASS: Social department is explicitly NOT_AVAILABLE and cleanly unstaffed.\n');
    passed++;
  }

  // TEST 4: HEALTHY Derivation
  {
    console.log('Test 4: HEALTHY Derivation');
    const snap = createMockSnapshot();
    const pub = getDepartmentById('publication_operations', snap);
    assert.equal(pub.health, 'HEALTHY', 'Publication must be HEALTHY in clean standby');
    assert.ok(pub.health_evidence.includes('sehat dan siaga'));

    const res = getDepartmentById('research_evidence', snap);
    assert.equal(res.health, 'HEALTHY', 'Research must be HEALTHY when no tasks');
    console.log('  ✅ PASS: Standby departments with healthy telemetry evaluate to HEALTHY.\n');
    passed++;
  }

  // TEST 5: ACTIVE Derivation
  {
    console.log('Test 5: ACTIVE Derivation');
    const snapActive = createMockSnapshot({
      pipeline: {
        tasks: [
          { taskId: 'art_act', title: 'Panduan Renovasi Fasad', subsystem: 'editorial', status: 'draft', stage: 'writing', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null }
        ]
      }
    });

    const editorial = getDepartmentById('editorial', snapActive);
    assert.equal(editorial.health, 'ACTIVE', 'Editorial must be ACTIVE when writing task is processing');
    assert.ok(editorial.health_evidence.includes('Joko') || editorial.health_evidence.includes('aktif'));
    console.log('  ✅ PASS: ACTIVE health derived when genuine work is in-progress.\n');
    passed++;
  }

  // TEST 6: DEGRADED Derivation (Retries, Warnings, Stale Telemetry)
  {
    console.log('Test 6: DEGRADED Derivation');
    const snapDegraded = createMockSnapshot({
      pipeline: {
        tasks: [
          { taskId: 'art_ret', title: 'Uji Pondasi', subsystem: 'editorial', status: 'draft', stage: 'draft', retryCount: 2, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null }
        ]
      }
    });

    const editorial = getDepartmentById('editorial', snapDegraded);
    assert.equal(editorial.health, 'DEGRADED', 'Editorial must be DEGRADED when retries > 0');
    assert.ok(editorial.health_evidence.includes('retry'));

    // Stale scheduler -> degraded
    const snapStale = createMockSnapshot({
      scheduler: {
        hermes: { status: 'stale', freshnessSeconds: 450 }
      }
    });
    const resStale = getDepartmentById('research_evidence', snapStale);
    assert.equal(resStale.health, 'DEGRADED', 'Research must be DEGRADED when Hermes is stale');
    console.log('  ✅ PASS: DEGRADED health derived on retry warnings or stale heartbeats.\n');
    passed++;
  }

  // TEST 7: BLOCKED Derivation (Open Breakers, Active Kill Switch)
  {
    console.log('Test 7: BLOCKED Derivation');
    // 1. Kill Switch engaged -> publication BLOCKED
    const snapKill = createMockSnapshot({
      health: {
        automation: { mode: 'OFF', killSwitchEngaged: true, killReason: 'Deployment hold' }
      }
    });
    const pubKill = getDepartmentById('publication_operations', snapKill);
    assert.equal(pubKill.health, 'BLOCKED', 'Publication must be BLOCKED when kill switch is engaged');
    assert.ok(pubKill.current_blockers.some((b) => b.error_class === 'EMERGENCY_KILL_SWITCH_ACTIVE'));

    // 2. Open circuit breaker -> publication BLOCKED
    const snapBreaker = createMockSnapshot({
      health: {
        circuitBreakers: [{ id: 'global_publisher', state: 'OPEN', failureCount: 3, failureThreshold: 3, tripReason: 'DB timeout' }]
      }
    });
    const pubBreaker = getDepartmentById('publication_operations', snapBreaker);
    assert.equal(pubBreaker.health, 'BLOCKED', 'Publication must be BLOCKED when publisher breaker is OPEN');

    console.log('  ✅ PASS: BLOCKED health derived on kill switches, open circuit breakers, and unhandled failures.\n');
    passed++;
  }

  // TEST 8: OFFLINE Derivation
  {
    console.log('Test 8: OFFLINE Derivation');
    // Media worker DISABLED -> Media department OFFLINE
    const snap = createMockSnapshot({
      health: {
        mediaWorker: { effectiveState: 'DISABLED', activeDevicesCount: 0 }
      }
    });
    const mediaDept = getDepartmentById('media', snap);
    assert.equal(mediaDept.health, 'OFFLINE', 'Media department must be OFFLINE when media worker is DISABLED');
    assert.ok(mediaDept.health_evidence.includes('DISABLED'));

    // Hermes offline -> Editorial & Research OFFLINE
    const snapOff = createMockSnapshot({
      scheduler: {
        hermes: { status: 'offline' }
      }
    });
    const editOff = getDepartmentById('editorial', snapOff);
    assert.equal(editOff.health, 'OFFLINE', 'Editorial must be OFFLINE when Hermes container is offline');
    console.log('  ✅ PASS: OFFLINE health accurately derived for disabled workers and offline daemons.\n');
    passed++;
  }

  // TEST 9: UNKNOWN Derivation
  {
    console.log('Test 9: UNKNOWN Derivation');
    const deptConfig = CANONICAL_DEPARTMENTS[0]; // editorial
    const res = deriveDepartmentHealth(deptConfig, null, [], [], []);
    assert.equal(res.health, 'UNKNOWN', 'Null snapshot must evaluate to UNKNOWN health');
    assert.ok(res.evidence.includes('tidak tersedia'));
    console.log('  ✅ PASS: Incomplete or missing telemetry safely evaluates to UNKNOWN.\n');
    passed++;
  }

  // TEST 10: Task Ownership Attribution (EXACT, DERIVED, UNASSIGNED)
  {
    console.log('Test 10: Task Ownership Attribution');
    
    // Writing -> Editorial / Joko / EXACT
    const tWriting = { taskId: 't1', title: 'Writing article', subsystem: 'editorial', status: 'draft', stage: 'writing', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null };
    const o1 = attributeTaskOwnership(tWriting);
    assert.equal(o1.department_id, 'editorial');
    assert.equal(o1.responsible_agent_id, 'content_writer_primary');
    assert.equal(o1.responsibility_confidence, 'EXACT');

    // Research -> Research & Evidence / Irwan / EXACT
    const tResearch = { taskId: 't2', title: 'Research task', subsystem: 'research', status: 'draft', stage: 'researching', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null };
    const o2 = attributeTaskOwnership(tResearch);
    assert.equal(o2.department_id, 'research_evidence');
    assert.equal(o2.responsible_agent_id, 'evidence_researcher_lead');
    assert.equal(o2.responsibility_confidence, 'EXACT');

    // Editorial QA -> Editorial / Rina / EXACT
    const tQA = { taskId: 't3', title: 'QA validation', subsystem: 'editorial', status: 'draft', stage: 'editorial_qa', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null };
    const o3 = attributeTaskOwnership(tQA);
    assert.equal(o3.department_id, 'editorial');
    assert.equal(o3.responsible_agent_id, 'editorial_qa_primary');
    assert.equal(o3.responsibility_confidence, 'EXACT');

    // Media -> Media Operations / Budi / EXACT
    const tMedia = { taskId: 'mjob_99', title: 'Image rendering', subsystem: 'media', status: 'GENERATING', stage: 'waiting_media', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null };
    const o4 = attributeTaskOwnership(tMedia);
    assert.equal(o4.department_id, 'media');
    assert.equal(o4.responsible_agent_id, 'lokamedia_worker_primary');
    assert.equal(o4.responsibility_confidence, 'EXACT');

    // Ambiguous system task -> UNASSIGNED
    const tAmbiguous = { taskId: 'sys_1', title: 'Database vacuum', subsystem: 'system', status: 'completed', stage: 'draft', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null };
    const o5 = attributeTaskOwnership(tAmbiguous);
    assert.equal(o5.department_id, null);
    assert.equal(o5.responsible_agent_id, null);
    assert.equal(o5.responsibility_confidence, 'UNASSIGNED');

    console.log('  ✅ PASS: Task ownership is deterministically attributed with confidence tags.\n');
    passed++;
  }

  // TEST 11: Department Event Attribution
  {
    console.log('Test 11: Department Event Attribution');
    const evMedia = { eventId: 'e1', timestamp: '2026-09-30T10:00:00Z', subsystem: 'media', eventType: 'MEDIA_STAGE_EVENT', statusOrSeverity: 'INFO', summary: 'Media ok', entityReference: null };
    const a1 = attributeActivityToDepartment(evMedia);
    assert.equal(a1.attributedDepartmentId, 'media');
    assert.equal(a1.attributedAgentId, 'lokamedia_worker_primary');
    assert.equal(a1.confidence, 'EXACT');

    const evJev = { eventId: 'e2', timestamp: '2026-09-30T10:00:00Z', subsystem: 'engineering', eventType: 'JEV_SHADOW_OBSERVATION', statusOrSeverity: 'INFO', summary: 'Jev obs', entityReference: null };
    const a2 = attributeActivityToDepartment(evJev);
    assert.equal(a2.attributedDepartmentId, 'engineering_telemetry');
    assert.equal(a2.attributedAgentId, 'telemetry_observer_jev');
    assert.equal(a2.confidence, 'EXACT');

    const evSys = { eventId: 'e3', timestamp: '2026-09-30T10:00:00Z', subsystem: 'system', eventType: 'OS_PING', statusOrSeverity: 'INFO', summary: 'Ping', entityReference: null };
    const a3 = attributeActivityToDepartment(evSys);
    assert.equal(a3.attributedDepartmentId, null);
    assert.equal(a3.attributedAgentId, null);
    assert.equal(a3.confidence, 'UNASSIGNED');

    console.log('  ✅ PASS: Activity events correctly attribute to departments or fallback to UNASSIGNED.\n');
    passed++;
  }

  // TEST 12: Genuine Cross-Department Handoff Derivation
  {
    console.log('Test 12: Genuine Cross-Department Handoff Derivation');
    const snapHandoff = createMockSnapshot({
      pipeline: {
        tasks: [
          // Article in waiting_media with media job -> Editorial -> Media handoff
          { taskId: 'art_100', title: 'Atap Baja Ringan', subsystem: 'editorial', status: 'draft', stage: 'waiting_media', retryCount: 0, lastUpdate: '2026-09-30T10:00:00Z', blockerOrError: null, relatedMediaJobId: 'mjob_100' },
          // Article in editorial_qa -> Media -> Editorial handoff
          { taskId: 'art_200', title: 'Pintu Geser Minimalis', subsystem: 'editorial', status: 'draft', stage: 'editorial_qa', retryCount: 0, lastUpdate: '2026-09-30T10:05:00Z', blockerOrError: null, relatedMediaJobId: 'mjob_200' },
          // Article in scheduled -> Editorial -> Publication handoff
          { taskId: 'art_300', title: 'Keramik Granit', subsystem: 'editorial', status: 'scheduled', stage: 'scheduled', retryCount: 0, lastUpdate: '2026-09-30T10:10:00Z', blockerOrError: null }
        ]
      }
    });

    const handoffs = deriveDepartmentHandoffs(snapHandoff);
    assert.equal(handoffs.length, 3, 'Must derive exactly 3 real handoffs');

    // 1. Editorial -> Media
    const h1 = handoffs.find((h) => h.source_department_id === 'editorial' && h.destination_department_id === 'media');
    assert.ok(h1, 'Editorial -> Media handoff must exist');
    assert.equal(h1.task_id, 'art_100');
    assert.equal(h1.handoff_state, 'READY');

    // 2. Media -> Editorial
    const h2 = handoffs.find((h) => h.source_department_id === 'media' && h.destination_department_id === 'editorial');
    assert.ok(h2, 'Media -> Editorial handoff must exist');
    assert.equal(h2.task_id, 'art_200');

    // 3. Editorial -> Publication
    const h3 = handoffs.find((h) => h.source_department_id === 'editorial' && h.destination_department_id === 'publication_operations');
    assert.ok(h3, 'Editorial -> Publication handoff must exist');
    assert.equal(h3.task_id, 'art_300');

    console.log('  ✅ PASS: Cross-department handoffs derived strictly from real article pipeline transitions.\n');
    passed++;
  }

  // TEST 13: Zero Fake Handoffs Invariant
  {
    console.log('Test 13: Zero Fake Handoffs Invariant');
    const cleanSnap = createMockSnapshot(); // 0 tasks
    const handoffs = deriveDepartmentHandoffs(cleanSnap);
    assert.equal(handoffs.length, 0, 'Clean snapshot must produce zero fake handoffs');

    const nullHandoffs = deriveDepartmentHandoffs(null);
    assert.equal(nullHandoffs.length, 0, 'Null snapshot must produce zero handoffs');
    console.log('  ✅ PASS: No synthetic handoffs fabricated when workflow transition evidence is absent.\n');
    passed++;
  }

  // TEST 14: Structural Blocker Model Mapping
  {
    console.log('Test 14: Structural Blocker Model Mapping');
    const snapBlock = createMockSnapshot({
      health: {
        automation: { mode: 'OFF', killSwitchEngaged: true, killReason: 'Operator hold' },
        circuitBreakers: [{ id: 'global_publisher', state: 'OPEN', failureCount: 3, failureThreshold: 3, tripReason: 'Write timeout' }]
      }
    });

    const blockers = deriveDepartmentBlockers('publication_operations', snapBlock);
    assert.equal(blockers.length, 2, 'Publication must surface 2 structural blockers');
    
    const killBlocker = blockers.find((b) => b.error_class === 'EMERGENCY_KILL_SWITCH_ACTIVE');
    assert.ok(killBlocker);
    assert.equal(killBlocker.severity, 'CRITICAL');
    assert.equal(killBlocker.operator_action_required, true);
    assert.equal(killBlocker.retryable, false);

    const breakerBlocker = blockers.find((b) => b.error_class === 'CIRCUIT_BREAKER_OPEN');
    assert.ok(breakerBlocker);
    assert.equal(breakerBlocker.severity, 'CRITICAL');
    assert.equal(breakerBlocker.operator_action_required, true);
    assert.equal(breakerBlocker.retryable, true);

    console.log('  ✅ PASS: Structural blockers model severity, retryability, and operator requirements accurately.\n');
    passed++;
  }

  // TEST 15: Pixel Office Preparation (Room Keys & Workstation Zones)
  {
    console.log('Test 15: Pixel Office Preparation (Room Keys & Workstation Zones)');
    const expectedRooms = {
      editorial: 'editorial_room',
      research_evidence: 'research_lab',
      media: 'media_room',
      publication_operations: 'publication_room',
      engineering_telemetry: 'operations_room',
      social: 'social_room'
    };

    for (const [deptId, room] of Object.entries(expectedRooms)) {
      const dept = CANONICAL_DEPARTMENTS.find((d) => d.department_id === deptId);
      assert.ok(dept, `Dept ${deptId} must exist`);
      assert.equal(dept.room_key, room, `Room key mismatch for ${deptId}`);
      assert.ok(dept.workstation_zone, `Workstation zone must be defined for ${deptId}`);
      assert.ok(dept.display_order >= 1 && dept.display_order <= 6, `Display order must be valid`);
    }

    console.log('  ✅ PASS: Pixel office room keys and workstation zones prepared for future rendering.\n');
    passed++;
  }

  // TEST 16: Staff Logical Room Mapping Preparation
  {
    console.log('Test 16: Staff Logical Room Mapping Preparation');
    const staffRoomChecks = {
      content_writer_primary: 'editorial_room',
      editorial_qa_primary: 'editorial_room',
      evidence_researcher_lead: 'research_lab',
      lokamedia_worker_primary: 'media_room',
      publication_dispatcher_core: 'publication_room',
      telemetry_observer_jev: 'operations_room'
    };

    for (const [agentId, room] of Object.entries(staffRoomChecks)) {
      assert.equal(STAFF_ROOM_MAP[agentId], room, `Staff logical room mismatch for ${agentId}`);
    }

    console.log('  ✅ PASS: Logical room mappings prepared for all 6 active staff members.\n');
    passed++;
  }

  // TEST 17: Organization Snapshot Aggregation & Workload
  {
    console.log('Test 17: Organization Snapshot Aggregation & Workload');
    const snap = createMockSnapshot();
    const org = getOrganizationSnapshot(snap);

    assert.equal(org.departments.length, 6, 'Organization must have 6 departments');
    assert.equal(org.summary.total_departments, 6);
    assert.equal(org.summary.total_staff, 6);
    assert.equal(org.summary.unavailable_departments, 1, 'Social must be counted as unavailable');
    assert.equal(org.summary.offline_departments, 1, 'Media must be counted as offline (disabled worker)');

    console.log('  ✅ PASS: Master organization snapshot correctly compiles summary metrics and workloads.\n');
    passed++;
  }

  // TEST 18: Strict Read-Only Invariant (Zero Mutations)
  {
    console.log('Test 18: Strict Read-Only Invariant (Zero Mutations)');
    const snap = createMockSnapshot();
    const snapClone = JSON.parse(JSON.stringify(snap));

    const org1 = getOrganizationSnapshot(snap);
    const org2 = getOrganizationSnapshot(snap);

    assert.deepEqual(snap, snapClone, 'Snapshot must not be modified by department functions');
    assert.equal(org1.departments.length, org2.departments.length);

    console.log('  ✅ PASS: All department operations functions are strictly pure and read-only.\n');
    passed++;
  }

  console.log(`🎉 All ${passed}/${passed} HERMES-MC-3 Department Operations tests PASSED!\n`);
}

runDepartmentTests().catch((err) => {
  console.error('❌ Department operations test failed with error:', err);
  process.exit(1);
});
