/**
 * RancangLoka Hermes Mission Control — Test Suite: Canonical Task Handoff Visualization (V2.4)
 * Milestone: HERMES-MC-V2.4
 * 
 * Strict Invariants Tested:
 * 1. Same canonical task transitions Joko -> Rina = valid handoff.
 * 2. Different task IDs = NOT a handoff.
 * 3. Sequential timestamps alone = NOT a handoff.
 * 4. Completion without next owner = NOT a handoff.
 * 5. QUEUED recipient = handoff observable but NO movement.
 * 6. RUNNING recipient = movement allowed.
 * 7. Repeated identical event = no replay (deduplication).
 * 8. Refresh = no replay.
 * 9. Page initial load = zero historical journey replay.
 * 10. Blocked recipient = no fake working animation.
 * 11. Unknown ownership = department-level only / UNKNOWN.
 * 12. Multiple workflow handoffs remain isolated.
 * 13. Maya cannot receive handoff while Social HOLDING.
 * 14. Budi cannot receive active handoff while effective worker DISABLED.
 * 15. JEV cannot become workflow owner.
 * 16. Deterministic handoff identity (zero random UUIDs).
 * 17. Same canonical event yields exact same derived identity.
 * 18. Invalid/ambiguous ordering fails closed.
 */

import {
  deriveDeterministicHandoffId,
  validateHandoffSafety,
  deriveCanonicalHandoffsFromPipeline,
  detectSnapshotDeltaHandoffs
} from '../src/lib/mission-control/task-handoff.ts';

import {
  getPixelOfficeState
} from '../src/lib/mission-control/pixel-office.ts';

console.log('======================================================');
console.log('🧪 Starting Pixel Office V2.4 Task Handoff Test Suite...');
console.log('======================================================\n');

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

// ----------------------------------------------------------------------------
// GROUP 1: Canonical Task Handoff Qualification & Delta Detection
// ----------------------------------------------------------------------------
console.log('--- Group 1: Canonical Task Qualification & Delta Detection ---');

const baseSnapshot = {
  generatedAt: '2026-10-01T12:00:00.000Z',
  freshness: 'FRESH',
  environment: 'production',
  health: {
    automation: { mode: 'OFF', killSwitchEngaged: false },
    circuitBreakers: [{ id: 'global_publisher', state: 'CLOSED' }],
    mediaWorker: { effectiveState: 'DISABLED', envGate: 'ENABLED', dbGate: 'DISABLED' },
    jev: { mode: 'shadow' }
  },
  pipeline: {
    tasks: [
      {
        taskId: 'task-kanopi-101',
        title: 'Desain Kanopi Baja Ringan Tahan Angin',
        stage: 'writing',
        status: 'RUNNING',
        relatedArticleId: 'art-101',
        lastUpdate: '2026-10-01T12:00:00.000Z'
      }
    ]
  },
  social: {
    departmentAvailability: 'NOT_AVAILABLE',
    mode: 'OFF',
    providerExecutionAvailable: false
  },
  activity: []
};

// Next snapshot: Same task transitions to editorial_qa (Joko -> Rina)
const qaSnapshot = {
  ...baseSnapshot,
  generatedAt: '2026-10-01T12:05:00.000Z',
  pipeline: {
    tasks: [
      {
        taskId: 'task-kanopi-101',
        title: 'Desain Kanopi Baja Ringan Tahan Angin',
        stage: 'editorial_qa',
        status: 'RUNNING',
        relatedArticleId: 'art-101',
        lastUpdate: '2026-10-01T12:05:00.000Z'
      }
    ]
  }
};

// Test 1: Same canonical task transitions Joko -> Rina = valid handoff
const deltaHandoffs1 = detectSnapshotDeltaHandoffs(baseSnapshot, qaSnapshot);
assert(
  deltaHandoffs1.length === 1 &&
  deltaHandoffs1[0].workflow_id === 'task-kanopi-101' &&
  deltaHandoffs1[0].from_stage === 'writing' &&
  deltaHandoffs1[0].to_stage === 'editorial_qa' &&
  deltaHandoffs1[0].from_agent_id === 'content_writer_primary' &&
  deltaHandoffs1[0].to_agent_id === 'editorial_qa_primary' &&
  deltaHandoffs1[0].handoff_state === 'RUNNING' &&
  deltaHandoffs1[0].requires_movement === true,
  'Test 1: Same canonical task transitioning from writing to editorial_qa produces valid RUNNING handoff'
);

// Test 2: Different task IDs = NOT a handoff
const disjointTaskSnapshot = {
  ...baseSnapshot,
  generatedAt: '2026-10-01T12:05:00.000Z',
  pipeline: {
    tasks: [
      {
        taskId: 'task-pintu-202', // Different task!
        title: 'Panduan Pasang Pintu Geser Aluminium',
        stage: 'editorial_qa',
        status: 'RUNNING',
        relatedArticleId: 'art-202',
        lastUpdate: '2026-10-01T12:05:00.000Z'
      }
    ]
  }
};
const deltaHandoffs2 = detectSnapshotDeltaHandoffs(baseSnapshot, disjointTaskSnapshot);
assert(
  deltaHandoffs2.length === 0,
  'Test 2: Different task IDs across consecutive snapshots are NOT joined into a handoff'
);

// Test 3: Sequential timestamps alone across disjoint tasks = NOT a handoff
const sequentialTimeSnapshotA = {
  ...baseSnapshot,
  pipeline: {
    tasks: [{ taskId: 'task-a', title: 'Task A', stage: 'writing', status: 'COMPLETED', lastUpdate: '2026-10-01T10:02:00.000Z' }]
  }
};
const sequentialTimeSnapshotB = {
  ...baseSnapshot,
  pipeline: {
    tasks: [{ taskId: 'task-b', title: 'Task B', stage: 'editorial_qa', status: 'RUNNING', lastUpdate: '2026-10-01T10:03:00.000Z' }]
  }
};
const deltaHandoffs3 = detectSnapshotDeltaHandoffs(sequentialTimeSnapshotA, sequentialTimeSnapshotB);
assert(
  deltaHandoffs3.length === 0,
  'Test 3: Sequential timestamps alone without shared task identity do NOT create a handoff'
);

// Test 4: Task completion without next owner/stage = NOT a handoff
const completedSnapshot = {
  ...baseSnapshot,
  pipeline: {
    tasks: [
      {
        taskId: 'task-kanopi-101',
        title: 'Desain Kanopi Baja Ringan Tahan Angin',
        stage: 'published',
        status: 'COMPLETED',
        lastUpdate: '2026-10-01T12:10:00.000Z'
      }
    ]
  }
};
const terminalSnapshot = {
  ...completedSnapshot,
  pipeline: {
    tasks: [
      {
        taskId: 'task-kanopi-101',
        title: 'Desain Kanopi Baja Ringan Tahan Angin',
        stage: 'published',
        status: 'COMPLETED',
        lastUpdate: '2026-10-01T12:10:00.000Z'
      }
    ]
  }
};
const deltaHandoffs4 = detectSnapshotDeltaHandoffs(completedSnapshot, terminalSnapshot);
assert(
  deltaHandoffs4.length === 0,
  'Test 4: Completed task without subsequent stage or ownership change is NOT a handoff'
);

// ----------------------------------------------------------------------------
// GROUP 2: State Semantics (QUEUED vs RUNNING vs BLOCKED)
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: State Semantics (QUEUED vs RUNNING vs BLOCKED) ---');

// Test 5: QUEUED recipient = handoff observable but NO movement
const scheduledQueuedSnapshot = {
  ...baseSnapshot,
  pipeline: {
    tasks: [
      {
        taskId: 'task-kanopi-101',
        title: 'Desain Kanopi Baja Ringan Tahan Angin',
        stage: 'scheduled',
        status: 'QUEUED',
        relatedArticleId: 'art-101',
        lastUpdate: '2026-10-01T12:15:00.000Z'
      }
    ]
  }
};
const deltaHandoffs5 = detectSnapshotDeltaHandoffs(qaSnapshot, scheduledQueuedSnapshot);
assert(
  deltaHandoffs5.length === 1 &&
  deltaHandoffs5[0].to_stage === 'scheduled' &&
  deltaHandoffs5[0].handoff_state === 'QUEUED' &&
  deltaHandoffs5[0].requires_movement === false,
  'Test 5: QUEUED next stage produces handoff with requires_movement === false (staff stays in Lounge)'
);

// Test 6: RUNNING recipient = movement allowed
const ingestingRunningSnapshot = {
  ...baseSnapshot,
  pipeline: {
    tasks: [
      {
        taskId: 'task-kanopi-101',
        title: 'Desain Kanopi Baja Ringan Tahan Angin',
        stage: 'ingesting',
        status: 'RUNNING',
        relatedArticleId: 'art-101',
        lastUpdate: '2026-10-01T12:20:00.000Z'
      }
    ]
  }
};
const deltaHandoffs6 = detectSnapshotDeltaHandoffs(scheduledQueuedSnapshot, ingestingRunningSnapshot);
assert(
  deltaHandoffs6.length === 1 &&
  deltaHandoffs6[0].to_stage === 'ingesting' &&
  deltaHandoffs6[0].handoff_state === 'RUNNING' &&
  deltaHandoffs6[0].requires_movement === true,
  'Test 6: Transitioning from QUEUED to RUNNING produces requires_movement === true'
);

// Test 10: Blocked recipient = no fake working animation
const blockedFailedSnapshot = {
  ...baseSnapshot,
  pipeline: {
    tasks: [
      {
        taskId: 'task-kanopi-101',
        title: 'Desain Kanopi Baja Ringan Tahan Angin',
        stage: 'failed',
        status: 'FAILED',
        relatedArticleId: 'art-101',
        blockerOrError: 'Circuit breaker tripped',
        lastUpdate: '2026-10-01T12:25:00.000Z'
      }
    ]
  }
};
const deltaHandoffs10 = detectSnapshotDeltaHandoffs(qaSnapshot, blockedFailedSnapshot);
assert(
  deltaHandoffs10.length === 1 &&
  deltaHandoffs10[0].handoff_state === 'BLOCKED' &&
  deltaHandoffs10[0].requires_movement === false,
  'Test 10: BLOCKED recipient produces requires_movement === false and handoff_state === BLOCKED'
);

// ----------------------------------------------------------------------------
// GROUP 3: Deduplication, Idempotency & Replay Prevention
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Deduplication, Idempotency & Replay Prevention ---');

// Test 7: Repeated identical event = no replay (deterministic ID matches)
const idA1 = deriveDeterministicHandoffId('wf-1', 'writing', 'qa', 'joko', 'rina', '2026-10-01T12:00:00.000Z');
const idA2 = deriveDeterministicHandoffId('wf-1', 'writing', 'qa', 'joko', 'rina', '2026-10-01T12:00:00.000Z');
assert(
  idA1 === idA2,
  'Test 7: Repeated identical event yields exact same deterministic handoff_id for deduplication'
);

// Test 8: Refresh = no replay (identical snapshots yield empty delta)
const deltaRefresh = detectSnapshotDeltaHandoffs(qaSnapshot, qaSnapshot);
assert(
  deltaRefresh.length === 0,
  'Test 8: Polling identical snapshot on refresh yields zero new delta handoffs'
);

// Test 9: Page initial load = no historical animation (pixel office state returns read-only list)
const initialOfficeState = getPixelOfficeState(qaSnapshot);
assert(
  Array.isArray(initialOfficeState.recent_handoffs) &&
  initialOfficeState.recent_handoffs.length > 0 &&
  initialOfficeState.sprites.every((s) => s.room_key !== 'central_hall'),
  'Test 9: Initial page load populates recent_handoffs without forcing transit animations'
);

// ----------------------------------------------------------------------------
// GROUP 4: Department-Only & Unknown Ownership
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Department-Only & Unknown Ownership ---');

// Test 11: Unknown ownership = department-level only / UNKNOWN
const unknownStaffTask = {
  taskId: 'task-custom-audit',
  title: 'Audit Metadata Kategori',
  stage: 'unknown_stage',
  status: 'PENDING',
  subsystem: 'unknown_subsystem',
  lastUpdate: '2026-10-01T12:30:00.000Z'
};
const unassignedSnapshot = {
  ...baseSnapshot,
  pipeline: { tasks: [unknownStaffTask] }
};
const unassignedOffice = getPixelOfficeState(unassignedSnapshot);
assert(
  unassignedOffice.sprites.every((s) => s.current_task_title !== 'Audit Metadata Kategori' || s.room_key === 'lounge'),
  'Test 11: Unassigned task does not fabricate staff ownership or move sprites to arbitrary desks'
);

// ----------------------------------------------------------------------------
// GROUP 5: Multi-Workflow Isolation
// ----------------------------------------------------------------------------
console.log('\n--- Group 5: Multi-Workflow Isolation ---');

// Test 12: Multiple workflow handoffs remain isolated
const multiTaskSnapshotPrev = {
  ...baseSnapshot,
  pipeline: {
    tasks: [
      { taskId: 'art-alpha', title: 'Alpha', stage: 'writing', status: 'RUNNING', lastUpdate: '2026-10-01T12:00:00.000Z' },
      { taskId: 'art-beta', title: 'Beta', stage: 'researching', status: 'RUNNING', lastUpdate: '2026-10-01T12:00:00.000Z' }
    ]
  }
};
const multiTaskSnapshotCurr = {
  ...baseSnapshot,
  pipeline: {
    tasks: [
      { taskId: 'art-alpha', title: 'Alpha', stage: 'editorial_qa', status: 'RUNNING', lastUpdate: '2026-10-01T12:05:00.000Z' },
      { taskId: 'art-beta', title: 'Beta', stage: 'writing', status: 'RUNNING', lastUpdate: '2026-10-01T12:05:00.000Z' }
    ]
  }
};
const multiDelta = detectSnapshotDeltaHandoffs(multiTaskSnapshotPrev, multiTaskSnapshotCurr);
assert(
  multiDelta.length === 2 &&
  multiDelta.find((h) => h.workflow_id === 'art-alpha')?.to_stage === 'editorial_qa' &&
  multiDelta.find((h) => h.workflow_id === 'art-beta')?.to_stage === 'writing',
  'Test 12: Multiple concurrent workflows remain strictly isolated by workflow/task ID'
);

// ----------------------------------------------------------------------------
// GROUP 6: Safety Exclusions (Maya, Budi, JEV)
// ----------------------------------------------------------------------------
console.log('\n--- Group 6: Safety Exclusions (Maya, Budi, JEV) ---');

// Test 13: Maya cannot receive handoff while Social HOLDING
const mayaCandidateHandoff = {
  handoff_id: 'test-maya',
  workflow_id: 'art-social-1',
  task_id: 'art-social-1',
  artifact_id: 'art-social-1',
  task_title: 'Social Distribution',
  from_agent_id: 'publication_dispatcher_core',
  to_agent_id: 'social_distribution_operator',
  from_department_id: 'publication_operations',
  to_department_id: 'social',
  from_stage: 'published',
  to_stage: 'social_syndicate',
  handoff_state: 'RUNNING',
  transition_timestamp: '2026-10-01T12:00:00.000Z',
  evidence_source: 'test',
  evidence_id: 'test',
  confidence: 'EXACT',
  requires_movement: true
};
const mayaSafety = validateHandoffSafety(mayaCandidateHandoff, baseSnapshot);
assert(
  mayaSafety.allowed === false &&
  mayaSafety.reason.includes('Zone S') &&
  mayaSafety.reason.includes('HOLDING'),
  'Test 13: Maya cannot receive handoff while Social is in HOLDING status'
);

// Test 14: Budi cannot receive active handoff while effective worker DISABLED
const budiCandidateHandoff = {
  handoff_id: 'test-budi',
  workflow_id: 'art-media-1',
  task_id: 'art-media-1',
  artifact_id: 'art-media-1',
  task_title: 'Generate Hero Image',
  from_agent_id: 'content_writer_primary',
  to_agent_id: 'lokamedia_worker_primary',
  from_department_id: 'editorial',
  to_department_id: 'media',
  from_stage: 'writing',
  to_stage: 'waiting_media',
  handoff_state: 'RUNNING',
  transition_timestamp: '2026-10-01T12:00:00.000Z',
  evidence_source: 'test',
  evidence_id: 'test',
  confidence: 'EXACT',
  requires_movement: true
};
const budiSafety = validateHandoffSafety(budiCandidateHandoff, baseSnapshot);
assert(
  budiSafety.allowed === false &&
  budiSafety.reason.includes('Media Worker is DISABLED'),
  'Test 14: Budi cannot receive active running handoff while effective Media Worker is DISABLED'
);

// Test 15: JEV cannot become workflow owner
const jevCandidateHandoff = {
  handoff_id: 'test-jev',
  workflow_id: 'art-jev-1',
  task_id: 'art-jev-1',
  artifact_id: 'art-jev-1',
  task_title: 'Evaluate Jev',
  from_agent_id: 'editorial_qa_primary',
  to_agent_id: 'telemetry_observer_jev',
  from_department_id: 'editorial',
  to_department_id: 'operations_room',
  from_stage: 'editorial_qa',
  to_stage: 'scheduled',
  handoff_state: 'RUNNING',
  transition_timestamp: '2026-10-01T12:00:00.000Z',
  evidence_source: 'test',
  evidence_id: 'test',
  confidence: 'EXACT',
  requires_movement: true
};
const jevSafety = validateHandoffSafety(jevCandidateHandoff, baseSnapshot);
assert(
  jevSafety.allowed === false &&
  jevSafety.reason.includes('TypeSafe JEV operates in shadow mode'),
  'Test 15: TypeSafe JEV cannot become workflow owner or handoff recipient'
);

// ----------------------------------------------------------------------------
// GROUP 7: Deterministic Identity & Invariant Robustness
// ----------------------------------------------------------------------------
console.log('\n--- Group 7: Deterministic Identity & Invariant Robustness ---');

// Test 16: Deterministic handoff identity across 50 iterations (zero random UUIDs)
const ids = new Set();
for (let i = 0; i < 50; i++) {
  ids.add(deriveDeterministicHandoffId('wf-deterministic', 'stage_a', 'stage_b', 'agent_1', 'agent_2', '2026-10-01T15:00:00.000Z'));
}
assert(
  ids.size === 1 && !Array.from(ids)[0].includes('undefined') && Array.from(ids)[0].startsWith('hnd_'),
  'Test 16: deriveDeterministicHandoffId is 100% deterministic with zero UUID variance across 50 calls'
);

// Test 17: Same canonical event yields exact same derived identity
const id1 = deriveDeterministicHandoffId('task-100', 'writing', 'editorial_qa', 'joko', 'rina', '2026-10-01T16:00:00.000Z');
const id2 = deriveDeterministicHandoffId('task-100', 'writing', 'editorial_qa', 'joko', 'rina', '2026-10-01T16:00:00.000Z');
assert(
  id1 === id2,
  'Test 17: Same canonical event parameters yield identical derived identity key'
);

// Test 18: Invalid/ambiguous ordering fails closed
const nullDelta = detectSnapshotDeltaHandoffs(null, null);
const emptyDelta = detectSnapshotDeltaHandoffs(baseSnapshot, { ...baseSnapshot, pipeline: { tasks: [] } });
assert(
  nullDelta.length === 0 && emptyDelta.length === 0,
  'Test 18: Ambiguous or missing snapshot ordering fails closed to empty handoffs'
);

console.log('\n======================================================');
console.log(`📊 Test Results: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
