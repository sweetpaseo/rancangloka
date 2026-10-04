/**
 * RancangLoka — MISSION CONTROL PIXEL OFFICE (2D SPATIAL OPERATIONS) TEST SUITE
 * Milestone: HERMES-MC-4
 * 
 * Verifies:
 * 1. All active staff have valid avatar keys.
 * 2. All active staff have valid home room keys.
 * 3. All room keys resolve to valid office positions.
 * 4. WORKING state maps to department workstation.
 * 5. IDLE state moves staff to Lounge seats.
 * 6. REVIEWING state has deterministic review desk placement (e.g. editorial_review_desk).
 * 7. BLOCKED state keeps staff in department with critical warning markers.
 * 8. OFFLINE intentional disabled (e.g. Media worker DISABLED) is visually distinct with NO emergency beacon.
 * 9. OFFLINE telemetry lost is marked with appropriate offline warning.
 * 10. UNKNOWN state safe handling without guessing.
 * 11. No random positions (coordinates always derive from deterministic position keys).
 * 12. No fake movement or random wandering.
 * 13. Stable position assignment across repeated calls.
 * 14. No staff overlap (each idle staff gets a unique seat).
 * 15. Social Room strictly contains zero staff and is marked unavailable.
 * 16. Staff click/inspector model contains no action authority (read-only).
 * 17. Office model has no write methods (read-only view model).
 * 18. Reduced-motion compatibility supported.
 * 19. Current task title and status sourced from staff read model.
 * 20. Summary counters match staff roster distribution.
 */

import assert from 'node:assert/strict';
import {
  OFFICE_POSITIONS,
  STAFF_HOME_ROOMS,
  STAFF_WORKSTATION_POSITIONS,
  evaluateStateReason,
  deriveSpriteSpatialState,
  getPixelOfficeState
} from '../src/lib/mission-control/pixel-office.ts';
import { getStaffRoster } from '../src/lib/mission-control/staff-registry.ts';

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
      circuitBreaker: {
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureAt: null,
        resetTimeoutMs: 60000
      },
      firstArticleGate: {
        status: 'PASSED',
        passedCount: 13,
        totalCriteria: 13,
        failedRules: []
      },
      rateLimiter: {
        dailyPublished: 2,
        dailyLimit: 10,
        remainingToday: 8,
        inCoolingPeriod: false
      },
      jev: {
        mode: 'shadow',
        reachable: true,
        lastResponseTimeMs: 142
      }
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
    activity: [
      {
        id: 'act-1',
        timestamp: '2026-09-30T09:55:00.000Z',
        type: 'SCHEDULER_HEARTBEAT',
        actor: 'publication_dispatcher_core',
        summary: 'Sari — Publication scheduler checked'
      }
    ],
    scheduler: {
      hermes: {
        status: 'active',
        lastHeartbeatAt: '2026-09-30T09:58:00.000Z',
        secondsSinceHeartbeat: 120,
        daemonPid: 42
      }
    },
    outbox: { pendingCount: 0, errorCount: 0, nextRunAt: null },
    articles: { totalArticles: 12, publishedToday: 2 },
    media: { totalAssets: 48, pendingUploads: 0 },
    jev: { totalDecisions: 18, shadowMatches: 18 }
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

console.log('--- Starting Mission Control Pixel Office Test Suite ---');
let testsPassed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. All active staff have valid avatar keys
runTest('1. all active staff have valid avatar keys', () => {
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);
  assert.equal(office.sprites.length, 7, 'Must contain all 7 named staff sprites');

  const validAvatars = [
    'management_advisor_01',
    'editorial_writer_01',
    'editorial_qa_01',
    'research_evidence_01',
    'media_ops_01',
    'publication_ops_01',
    'telemetry_01'
  ];

  for (const sprite of office.sprites) {
    assert.ok(sprite.avatar_key, `Staff ${sprite.agent_id} must have an avatar_key`);
    assert.ok(
      validAvatars.includes(sprite.avatar_key),
      `Avatar key ${sprite.avatar_key} must be in recognized avatar list`
    );
  }
});

// 2. All staff have valid home room
runTest('2. all staff have valid home room', () => {
  const staffIds = [
    'management_advisor_jefry',
    'content_writer_primary',
    'editorial_qa_primary',
    'evidence_researcher_lead',
    'lokamedia_worker_primary',
    'publication_dispatcher_core',
    'telemetry_observer_jev'
  ];

  for (const agentId of staffIds) {
    const room = STAFF_HOME_ROOMS[agentId];
    assert.ok(room, `Staff ${agentId} must have home room assigned`);
    assert.notEqual(room, 'social_room', 'No active staff may have social_room as home room');
  }
});

// 3. All room keys resolve to valid office positions
runTest('3. all room keys resolve to valid office positions', () => {
  const validRoomKeys = [
    'management_room',
    'editorial_room',
    'research_lab',
    'media_room',
    'publication_room',
    'operations_room',
    'lounge',
    'social_room'
  ];

  for (const pos of OFFICE_POSITIONS) {
    assert.ok(validRoomKeys.includes(pos.room_key), `Position ${pos.position_key} has invalid room ${pos.room_key}`);
    assert.ok(typeof pos.x === 'number' && pos.x >= 0 && pos.x <= 100, 'x must be between 0 and 100');
    assert.ok(typeof pos.y === 'number' && pos.y >= 0 && pos.y <= 100, 'y must be between 0 and 100');
  }
});

// 4. WORKING state maps to department workstation
runTest('4. WORKING -> department workstation', () => {
  const snapshot = createMockSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task-w1',
          title: 'Menulis Panduan Material Kayu Ulin',
          stage: 'writing',
          status: 'draft',
          subsystem: 'editorial',
          retryCount: 0,
          lastUpdate: '2026-09-30T09:30:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const office = getPixelOfficeState(snapshot);
  const joko = office.sprites.find((s) => s.agent_id === 'content_writer_primary');
  assert.ok(joko);
  assert.equal(joko.staff_state, 'WORKING');
  assert.equal(joko.room_key, 'editorial_room');
  assert.equal(joko.position_key, 'editorial_writer_desk');
  assert.equal(joko.visual_mode, 'ACTIVE');
  assert.equal(joko.warning_level, 'NONE');
  assert.equal(joko.current_task_title, 'Menulis Panduan Material Kayu Ulin');
});

// 5. IDLE state moves staff to Lounge
runTest('5. IDLE -> lounge', () => {
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);
  
  // Staf with no tasks (e.g. Joko in baseline with empty tasks)
  const joko = office.sprites.find((s) => s.agent_id === 'content_writer_primary');
  assert.ok(joko);
  assert.equal(joko.staff_state, 'IDLE');
  assert.equal(joko.room_key, 'lounge');
  assert.ok(joko.position_key.startsWith('lounge_seat_'), `Position must be in lounge seats: ${joko.position_key}`);
  assert.equal(joko.visual_mode, 'IDLE');
  assert.equal(joko.state_reason.category, 'IDLE_STANDBY');
});

// 6. REVIEWING state has deterministic review location
runTest('6. REVIEWING -> review location', () => {
  const snapshot = createMockSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task-r1',
          title: 'Verifikasi Kaidah Editorial Naskah Atap Baja Ringan',
          stage: 'editorial_qa',
          status: 'draft',
          subsystem: 'editorial',
          retryCount: 0,
          lastUpdate: '2026-09-30T09:40:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const office = getPixelOfficeState(snapshot);
  const rina = office.sprites.find((s) => s.agent_id === 'editorial_qa_primary');
  assert.ok(rina);
  assert.equal(rina.staff_state, 'REVIEWING');
  assert.equal(rina.room_key, 'editorial_room');
  assert.equal(rina.position_key, 'editorial_review_desk', 'Rina REVIEWING must be placed at editorial_review_desk');
  assert.equal(rina.visual_mode, 'REVIEWING');
});

// 7. BLOCKED state keeps staff in department location + warning
runTest('7. BLOCKED -> department location + warning', () => {
  const snapshot = createMockSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task-b1',
          title: 'Penelitian SNI Mortar Semen',
          stage: 'failed',
          status: 'failed',
          subsystem: 'research',
          retryCount: 1,
          lastUpdate: '2026-09-30T09:00:00.000Z',
          blockerOrError: 'Akses repositori referensi SNI timeout'
        }
      ]
    }
  });

  const office = getPixelOfficeState(snapshot);
  const irwan = office.sprites.find((s) => s.agent_id === 'evidence_researcher_lead');
  assert.ok(irwan);
  assert.equal(irwan.staff_state, 'BLOCKED');
  assert.equal(irwan.room_key, 'research_lab', 'Blocked staff must remain in home department');
  assert.equal(irwan.position_key, 'research_main_desk');
  assert.equal(irwan.visual_mode, 'BLOCKED');
  assert.equal(irwan.warning_level, 'CRITICAL');
  assert.equal(irwan.badge_text, 'Terblokir');
  assert.equal(irwan.state_reason.category, 'BLOCKED_ERROR');
});

// 8. OFFLINE intentional disabled reason (Media worker DISABLED)
runTest('8. OFFLINE intentional disabled reason', () => {
  const snapshot = createMockSnapshot({
    health: {
      automation: { mode: 'OFF', killSwitchEngaged: false },
      mediaWorker: {
        dbGate: 'DISABLED',
        effectiveState: 'DISABLED',
        reason: 'Disabled in settings'
      }
    }
  });

  const office = getPixelOfficeState(snapshot);
  const budi = office.sprites.find((s) => s.agent_id === 'lokamedia_worker_primary');
  assert.ok(budi);
  assert.equal(budi.staff_state, 'OFFLINE');
  assert.equal(budi.room_key, 'media_room');
  assert.equal(budi.state_reason.category, 'INTENTIONAL_DISABLED');
  assert.equal(budi.state_reason.is_intentional, true);
  assert.equal(budi.warning_level, 'NONE', 'Intentional disablement must NOT trigger red emergency beacon');
  assert.equal(budi.badge_text, 'Worker Disabled');
  assert.equal(budi.visual_mode, 'DIMMED');
});

// 9. OFFLINE telemetry failure reason
runTest('9. OFFLINE telemetry failure reason', () => {
  const snapshot = createMockSnapshot({
    scheduler: {
      hermes: {
        status: 'offline',
        secondsSinceHeartbeat: 900,
        lastHeartbeatAt: '2026-09-30T09:00:00.000Z'
      }
    }
  });

  const office = getPixelOfficeState(snapshot);
  const joko = office.sprites.find((s) => s.agent_id === 'content_writer_primary');
  assert.ok(joko);
  assert.equal(joko.staff_state, 'OFFLINE');
  assert.equal(joko.state_reason.category, 'TELEMETRY_OFFLINE');
  assert.equal(joko.state_reason.is_intentional, false);
  assert.equal(joko.warning_level, 'WARNING');
  assert.equal(joko.badge_text, 'Offline');
});

// 10. UNKNOWN safe handling
runTest('10. UNKNOWN safe handling', () => {
  // Test with null snapshot / missing telemetry
  const office = getPixelOfficeState(null);
  assert.ok(office.sprites.length > 0);
  for (const sprite of office.sprites) {
    assert.ok(sprite.room_key, 'Room key must be valid even in null telemetry');
    assert.ok(sprite.position_key, 'Position key must be valid');
    assert.ok(sprite.x >= 0 && sprite.y >= 0);
  }
});

// 11. No random positions
runTest('11. no random positions', () => {
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);
  const validKeys = new Set(OFFICE_POSITIONS.map((p) => p.position_key));

  for (const sprite of office.sprites) {
    assert.ok(
      validKeys.has(sprite.position_key),
      `Sprite ${sprite.agent_id} has unregistered position: ${sprite.position_key}`
    );
  }
});

// 12. No fake movement
runTest('12. no fake movement', () => {
  const snapshot = createMockSnapshot();
  const office1 = getPixelOfficeState(snapshot);
  const office2 = getPixelOfficeState(snapshot);

  for (let i = 0; i < office1.sprites.length; i++) {
    const s1 = office1.sprites[i];
    const s2 = office2.sprites[i];
    assert.equal(s1.position_key, s2.position_key, 'Identical telemetry must produce identical spatial positions');
    assert.equal(s1.x, s2.x);
    assert.equal(s1.y, s2.y);
  }
});

// 13. Stable position assignment
runTest('13. stable position assignment', () => {
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);
  const positionsAssigned = office.sprites.map((s) => s.position_key);

  // Run 5 iterations to confirm deterministic stability
  for (let iter = 0; iter < 5; iter++) {
    const freshOffice = getPixelOfficeState(snapshot);
    const freshPositions = freshOffice.sprites.map((s) => s.position_key);
    assert.deepEqual(freshPositions, positionsAssigned);
  }
});

// 14. No staff overlap
runTest('14. no staff overlap in lounge or workstations', () => {
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);

  const seenPositions = new Set();
  for (const sprite of office.sprites) {
    assert.ok(!seenPositions.has(sprite.position_key), `Duplicate position assigned: ${sprite.position_key}`);
    seenPositions.add(sprite.position_key);
  }
});

// 15. Social contains zero staff
runTest('15. Social contains zero staff', () => {
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);

  const socialRoom = office.rooms.find((r) => r.room_key === 'social_room');
  assert.ok(socialRoom, 'Social room must exist in floor plan');
  assert.equal(socialRoom.occupants.length, 0, 'Social room must contain exactly 0 occupants');
  assert.equal(socialRoom.is_available, false, 'Social room must be flagged is_available = false');

  const occupantsInSocial = office.sprites.filter((s) => s.room_key === 'social_room');
  assert.equal(occupantsInSocial.length, 0, 'No sprites may occupy social_room');
});

// 16. Staff click model contains no action authority
runTest('16. staff click model contains no action authority', () => {
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);

  for (const sprite of office.sprites) {
    assert.equal(sprite.execute, undefined, 'Sprite must not have execute function');
    assert.equal(sprite.retry, undefined, 'Sprite must not have retry function');
    assert.equal(sprite.publish, undefined, 'Sprite must not have publish function');
    assert.equal(sprite.chat, undefined, 'Sprite must not have chat function');
  }
});

// 17. Office model has no write methods
runTest('17. office model has no write methods', () => {
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);

  assert.equal(office.mutate, undefined);
  assert.equal(office.updateState, undefined);
  assert.equal(office.save, undefined);
});

// 18. Reduced motion compatibility
runTest('18. reduced-motion compatibility flag', () => {
  // Check that the office state exposes deterministic visual modes suitable for CSS disabling
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);

  for (const sprite of office.sprites) {
    assert.ok(['ACTIVE', 'IDLE', 'REVIEWING', 'BLOCKED', 'DIMMED', 'UNKNOWN'].includes(sprite.visual_mode));
  }
});

// 19. Current task text sourced from staff read model
runTest('19. current task text is sourced from staff read model', () => {
  const testTitle = 'Analisis Perbandingan Atap Spandek vs Galvalum';
  const snapshot = createMockSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'task-test-1',
          title: testTitle,
          stage: 'writing',
          status: 'draft',
          subsystem: 'editorial',
          retryCount: 0,
          lastUpdate: '2026-09-30T09:15:00.000Z',
          blockerOrError: null
        }
      ]
    }
  });

  const office = getPixelOfficeState(snapshot);
  const joko = office.sprites.find((s) => s.agent_id === 'content_writer_primary');
  assert.ok(joko);
  assert.equal(joko.current_task_title, testTitle);
  assert.equal(joko.state_reason.summary, `Mengerjakan: ${testTitle}`);
});

// 20. Summary metrics match staff roster distribution
runTest('20. summary metrics match staff roster distribution', () => {
  const snapshot = createMockSnapshot();
  const roster = getStaffRoster(snapshot);
  const office = getPixelOfficeState(snapshot);

  assert.equal(office.summary.working, roster.summary.working);
  assert.equal(office.summary.idle, roster.summary.idle);
  assert.equal(office.summary.reviewing, roster.summary.reviewing);
  assert.equal(office.summary.blocked, roster.summary.blocked);
  assert.equal(office.summary.offline, roster.summary.offline);
  assert.equal(office.summary.unknown, roster.summary.unknown);
  assert.equal(office.summary.automation_mode, 'OFF');
  assert.equal(office.summary.media_worker, 'DISABLED');
  assert.equal(office.summary.jev_mode, 'shadow');
  assert.equal(office.summary.kill_switch_engaged, false);
});

console.log(`\n========================================`);
console.log(`ALL ${testsPassed} PIXEL OFFICE TESTS PASSED!`);
console.log(`========================================\n`);
