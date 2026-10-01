/**
 * RancangLoka Hermes Mission Control — Test Suite: Deterministic Staff Movement & Central-Hall Route Graph (V2.3)
 * 
 * Verifies:
 * 1. Physical Route Graph topology & Central Hall spine.
 * 2. Deterministic BFS shortest pathfinding (zero random behavior).
 * 3. Wall boundaries & physical doorway constraints.
 * 4. State transition rules (IDLE -> RUNNING, RUNNING -> IDLE, BLOCKED, QUEUED).
 * 5. Initial load & page refresh immutability (zero fake journeys).
 * 6. Social Maya holding & Media Worker disabled invariants.
 * 7. Rapid rerouting and lane offset collision avoidance.
 */

import {
  OFFICE_ROUTE_NODES,
  OFFICE_ROUTE_EDGES,
  findDeterministicPath,
  deriveFacingDirection,
  getNodeVisualCoordinate,
  buildRouteAdjacencyMap
} from '../src/lib/mission-control/office-route-graph.ts';

import {
  evaluateStaffMovementTransition,
  advanceMovementStep
} from '../src/lib/mission-control/staff-movement.ts';

import {
  STAFF_CANONICAL_IDLE_SEATS,
  deriveSpriteSpatialState
} from '../src/lib/mission-control/pixel-office.ts';

import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================');
console.log('🧪 Starting Pixel Office V2.3 Deterministic Movement Test Suite...');
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
// GROUP 1: Route Graph & Topological Invariants
// ----------------------------------------------------------------------------
console.log('--- Group 1: Route Graph & Topological Invariants ---');

// Test 1: Lounge -> Editorial path uses Central Hall (Level 3 -> Level 2 -> Level 1)
const pathLoungeToEditorial = findDeterministicPath('lounge_seat_1', 'editorial_writer_desk');
assert(
  pathLoungeToEditorial.includes('lounge_door') &&
  pathLoungeToEditorial.includes('hall_level_3') &&
  pathLoungeToEditorial.includes('hall_level_2') &&
  pathLoungeToEditorial.includes('hall_level_1') &&
  pathLoungeToEditorial.includes('editorial_door') &&
  pathLoungeToEditorial[pathLoungeToEditorial.length - 1] === 'editorial_writer_desk',
  'Test 1: Lounge → Editorial path uses Central Hall (L3 → L2 → L1)'
);

// Test 2: Lounge -> Research path uses Central Hall
const pathLoungeToResearch = findDeterministicPath('lounge_seat_1', 'research_main_desk');
assert(
  pathLoungeToResearch.includes('lounge_door') &&
  pathLoungeToResearch.includes('hall_level_3') &&
  pathLoungeToResearch.includes('hall_level_2') &&
  pathLoungeToResearch.includes('hall_level_1') &&
  pathLoungeToResearch.includes('research_door') &&
  pathLoungeToResearch[pathLoungeToResearch.length - 1] === 'research_main_desk',
  'Test 2: Lounge → Research path uses Central Hall (L3 → L2 → L1)'
);

// Test 3: Lounge -> Media path uses Central Hall
const pathLoungeToMedia = findDeterministicPath('lounge_seat_1', 'media_console');
assert(
  pathLoungeToMedia.includes('hall_level_3') &&
  pathLoungeToMedia.includes('hall_level_2') &&
  pathLoungeToMedia.includes('media_door') &&
  pathLoungeToMedia[pathLoungeToMedia.length - 1] === 'media_console',
  'Test 3: Lounge → Media path uses Central Hall (L3 → L2)'
);

// Test 4: Lounge -> Operations path uses Central Hall
const pathLoungeToOps = findDeterministicPath('lounge_seat_1', 'operations_console');
assert(
  pathLoungeToOps.includes('hall_level_3') &&
  pathLoungeToOps.includes('hall_level_2') &&
  pathLoungeToOps.includes('operations_door') &&
  pathLoungeToOps[pathLoungeToOps.length - 1] === 'operations_console',
  'Test 4: Lounge → Operations path uses Central Hall (L3 → L2)'
);

// Test 5: Lounge -> Publication path uses Central Hall
const pathLoungeToPub = findDeterministicPath('lounge_seat_1', 'publication_console');
assert(
  pathLoungeToPub.includes('lounge_door') &&
  pathLoungeToPub.includes('hall_level_3') &&
  pathLoungeToPub.includes('publication_door') &&
  pathLoungeToPub[pathLoungeToPub.length - 1] === 'publication_console',
  'Test 5: Lounge → Publication path routes through Central Hall Level 3'
);

// Test 6: Editorial -> Research does NOT cross wall directly
const pathEdToRes = findDeterministicPath('editorial_writer_desk', 'research_main_desk');
assert(
  pathEdToRes.includes('editorial_door') &&
  pathEdToRes.includes('hall_level_1') &&
  pathEdToRes.includes('research_door'),
  'Test 6: Editorial → Research routes via hall_level_1 without crossing wall partition'
);

// Test 7: Research -> Publication routes through all 3 hall levels
const pathResToPub = findDeterministicPath('research_main_desk', 'publication_console');
assert(
  pathResToPub.includes('hall_level_1') &&
  pathResToPub.includes('hall_level_2') &&
  pathResToPub.includes('hall_level_3'),
  'Test 7: Research → Publication routes through hall_level_1 → hall_level_2 → hall_level_3'
);

// Test 8: Publication -> Lounge routes through hall
const pathPubToLounge = findDeterministicPath('publication_console', 'lounge_seat_2');
assert(
  pathPubToLounge.includes('publication_door') &&
  pathPubToLounge.includes('hall_level_3') &&
  pathPubToLounge.includes('lounge_door'),
  'Test 8: Publication → Lounge routes through hall_level_3 doorway'
);

// Test 9: Zone S route exists through hall terminus
const pathLoungeToZoneS = findDeterministicPath('lounge_seat_1', 'social_workstation');
assert(
  pathLoungeToZoneS.includes('hall_south') &&
  pathLoungeToZoneS.includes('zone_s_threshold') &&
  pathLoungeToZoneS.includes('social_door'),
  'Test 9: Zone S route topologically connects to hall_south terminus and threshold'
);

// Test 10 & 11: 100% Determinism (Zero Random Path Selection)
let isDeterministic = true;
const samplePath = JSON.stringify(findDeterministicPath('lounge_seat_1', 'editorial_writer_desk'));
for (let i = 0; i < 50; i++) {
  if (JSON.stringify(findDeterministicPath('lounge_seat_1', 'editorial_writer_desk')) !== samplePath) {
    isDeterministic = false;
    break;
  }
}
assert(isDeterministic, 'Test 10 & 11: Same origin/destination produces 100% identical path across 50 iterations');

// ----------------------------------------------------------------------------
// GROUP 2: State Transitions & Observability Truthfulness
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: State Transitions & Observability Truthfulness ---');

const mockIdleJoko = {
  agent_id: 'content_writer_primary',
  display_name: 'Joko',
  role: 'Senior Architectural Writer',
  avatar_key: 'joko',
  department_id: 'content_editorial',
  room_key: 'lounge',
  position_key: 'lounge_seat_1',
  x: 18,
  y: 40,
  staff_state: 'IDLE',
  state_reason: { category: 'IDLE_STANDBY', summary: 'Siaga', is_intentional: true },
  current_task_title: null,
  current_task_status: null,
  visual_mode: 'IDLE',
  warning_level: 'NONE',
  badge_text: 'Di Lounge',
  capabilities: ['article_writing'],
  last_activity_at: null,
  animation_key: 'IDLE_STANDBY',
  work_visual_state: {
    agent_id: 'content_writer_primary',
    capability_id: 'article_writing',
    task_id: null,
    task_type: null,
    task_status: null,
    animation_key: 'IDLE_STANDBY',
    workstation_key: 'lounge',
    visual_detail: 'Duduk santai',
    started_at: null,
    freshness: 'RECENT',
    evidence_reference: null,
    task_label: null,
    is_actively_working: false
  },
  task_label: null
};

const mockWorkingJoko = {
  ...mockIdleJoko,
  room_key: 'editorial_room',
  position_key: 'editorial_writer_desk',
  staff_state: 'WORKING',
  visual_mode: 'ACTIVE',
  current_task_title: 'Desain Fasad Rumah Tropis',
  current_task_status: 'RUNNING',
  badge_text: 'Menulis Naskah',
  animation_key: 'ARTICLE_TYPING',
  work_visual_state: {
    ...mockIdleJoko.work_visual_state,
    task_id: 'task_001',
    task_status: 'RUNNING',
    animation_key: 'ARTICLE_TYPING',
    workstation_key: 'editorial_writer_desk',
    is_actively_working: true
  }
};

// Test 12: Initial page load -> Direct placement (NO FAKE JOURNEY)
const initPlan = evaluateStaffMovementTransition(null, mockWorkingJoko, null, true);
assert(
  initPlan.action === 'NONE' &&
  initPlan.to_node_id === 'editorial_writer_desk' &&
  initPlan.movement_mode === 'STATIONARY',
  'Test 12: Initial page load sets direct canonical workstation placement with ZERO fake journey'
);

// Test 13: IDLE -> WORKING transition triggers START_JOURNEY to workstation
const workPlan = evaluateStaffMovementTransition(mockIdleJoko, mockWorkingJoko, null, false);
assert(
  workPlan.action === 'START_JOURNEY' &&
  workPlan.movement_mode === 'WALKING_TO_WORK' &&
  workPlan.from_node_id === 'lounge_seat_1' &&
  workPlan.to_node_id === 'editorial_writer_desk' &&
  workPlan.path.length >= 5,
  'Test 13: Real IDLE → WORKING transition triggers START_JOURNEY to assigned workstation'
);

// Test 14: WORKING -> IDLE transition triggers START_JOURNEY back to Lounge
const returnPlan = evaluateStaffMovementTransition(mockWorkingJoko, mockIdleJoko, null, false);
assert(
  returnPlan.action === 'START_JOURNEY' &&
  returnPlan.movement_mode === 'WALKING_TO_LOUNGE' &&
  returnPlan.from_node_id === 'editorial_writer_desk' &&
  returnPlan.to_node_id === 'lounge_seat_1',
  'Test 14: Task completion (WORKING → IDLE) triggers START_JOURNEY back to Executive Lounge'
);

// Test 15: QUEUED task status does NOT trigger movement
const mockQueuedSari = {
  ...mockIdleJoko,
  agent_id: 'publication_dispatcher_core',
  display_name: 'Sari',
  department_id: 'publication_ops',
  current_task_status: 'QUEUED',
  current_task_title: 'Draft Antrean',
  badge_text: 'Dalam Antrean'
};
const queuedPlan = evaluateStaffMovementTransition(mockIdleJoko, mockQueuedSari, null, false);
assert(
  queuedPlan.action === 'NONE' && queuedPlan.movement_mode === 'STATIONARY',
  'Test 15: QUEUED task does NOT trigger movement (staff stays idle in Lounge)'
);

// Test 16: WORKING -> BLOCKED remains truthfully at workstation
const mockBlockedJoko = {
  ...mockWorkingJoko,
  staff_state: 'BLOCKED',
  visual_mode: 'BLOCKED',
  badge_text: 'Terblokir'
};
const blockedPlan = evaluateStaffMovementTransition(mockWorkingJoko, mockBlockedJoko, null, false);
assert(
  blockedPlan.action === 'NONE' && blockedPlan.movement_mode === 'STATIONARY',
  'Test 16: WORKING → BLOCKED keeps staff at workstation with warning (no fake walk to lounge)'
);

// Test 17: Identical state refresh causes ZERO movement
const identicalPlan = evaluateStaffMovementTransition(mockWorkingJoko, mockWorkingJoko, null, false);
assert(
  identicalPlan.action === 'NONE',
  'Test 17: Identical state refresh causes zero movement (idempotent observability)'
);

// Test 18: Social Maya in Zone S stays in HOLDING without travel
const mockMaya = {
  ...mockIdleJoko,
  agent_id: 'social_distribution_operator',
  display_name: 'Maya',
  department_id: 'social_distribution',
  room_key: 'social_room',
  position_key: 'social_workstation'
};
const mayaPlan = evaluateStaffMovementTransition(mockMaya, mockMaya, null, false);
assert(
  mayaPlan.action === 'NONE' && mayaPlan.movement_mode === 'STATIONARY',
  'Test 18: Social / Maya stays strictly holding in Zone S without movement'
);

// Test 19: Media Worker DISABLED keeps Budi offline without travel
const mockBudiDisabled = {
  ...mockIdleJoko,
  agent_id: 'lokamedia_worker_primary',
  display_name: 'Budi',
  department_id: 'lokamedia_ops',
  room_key: 'media_room',
  position_key: 'media_console',
  visual_mode: 'DIMMED',
  badge_text: 'Worker Disabled'
};
const budiPlan = evaluateStaffMovementTransition(mockBudiDisabled, mockBudiDisabled, null, false);
assert(
  budiPlan.action === 'NONE',
  'Test 19: Media Worker DISABLED keeps Budi offline without travel'
);

// ----------------------------------------------------------------------------
// GROUP 3: Step Advancement, Direction & Hallway Lanes
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Step Advancement, Direction & Hallway Lanes ---');

const activeMovementState = {
  agent_id: 'content_writer_primary',
  current_node_id: 'lounge_door',
  target_node_id: 'editorial_writer_desk',
  path: ['lounge_door', 'hall_level_3', 'hall_level_2', 'hall_level_1', 'editorial_door', 'editorial_writer_desk'],
  path_index: 0,
  is_moving: true,
  movement_mode: 'WALKING_TO_WORK',
  facing_direction: 'LEFT',
  started_at: Date.now(),
  step_duration_ms: 450
};

// Test 20: Rapid transition while moving triggers clean REROUTE
const reroutePlan = evaluateStaffMovementTransition(
  mockWorkingJoko,
  mockIdleJoko,
  activeMovementState,
  false
);
assert(
  reroutePlan.action === 'REROUTE' &&
  reroutePlan.movement_mode === 'REROUTING' &&
  reroutePlan.from_node_id === 'lounge_door' &&
  reroutePlan.to_node_id === 'lounge_seat_1',
  'Test 20: Mid-travel state change triggers clean REROUTE from current node'
);

// Test 21: Advance movement step updates path index and facing direction
const step1 = advanceMovementStep(activeMovementState);
assert(
  step1.updatedState.current_node_id === 'hall_level_3' &&
  step1.updatedState.path_index === 1 &&
  step1.isArrived === false,
  'Test 21: advanceMovementStep advances node and path index correctly'
);

// Test 22: Step from Level 3 to Level 2 faces UP
const dirUp = deriveFacingDirection('hall_level_3', 'hall_level_2');
assert(dirUp === 'UP', 'Test 22: Northbound hallway travel derives facing direction UP');

// Test 23: Step from Level 1 to Level 2 faces DOWN
const dirDown = deriveFacingDirection('hall_level_1', 'hall_level_2');
assert(dirDown === 'DOWN', 'Test 23: Southbound hallway travel derives facing direction DOWN');

// Test 24: Reaching destination docks staff cleanly and marks isArrived: true
const almostArrivedState = {
  ...activeMovementState,
  current_node_id: 'editorial_door',
  path_index: 4
};
const finalStep = advanceMovementStep(almostArrivedState);
assert(
  finalStep.isArrived === true &&
  finalStep.updatedState.is_moving === false &&
  finalStep.updatedState.movement_mode === 'STATIONARY' &&
  finalStep.updatedState.current_node_id === 'editorial_writer_desk',
  'Test 24: Arrival at destination docks staff cleanly at workstation (isArrived = true)'
);

// Test 25: Hallway lane offsets prevent direct overlap between Northbound and Southbound staff
const coordNorth = getNodeVisualCoordinate('hall_level_2', 0, 'UP');
const coordSouth = getNodeVisualCoordinate('hall_level_2', 0, 'DOWN');
assert(
  coordNorth.x < 50 && coordSouth.x > 50,
  'Test 25: Hallway lane model separates Northbound (left lane) and Southbound (right lane)'
);

// ----------------------------------------------------------------------------
// GROUP 4: Multi-Idle Allocation, Vacancy, Return & Production Audits
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Multi-Idle Allocation, Vacancy, Return & Production Audits ---');

const canonicalStaffIds = [
  { id: 'content_writer_primary', name: 'Joko', dept: 'editorial', expectedSeat: 'lounge_seat_1' },
  { id: 'telemetry_observer_jev', name: 'Dimas', dept: 'operations', expectedSeat: 'lounge_seat_2' },
  { id: 'editorial_qa_primary', name: 'Rina', dept: 'editorial', expectedSeat: 'lounge_seat_3' },
  { id: 'evidence_researcher_lead', name: 'Irwan', dept: 'research', expectedSeat: 'lounge_seat_4' },
  { id: 'publication_dispatcher_core', name: 'Sari', dept: 'publication', expectedSeat: 'lounge_seat_5' }
];

const mockStaffList = canonicalStaffIds.map((item, idx) => ({
  agent_id: item.id,
  name: item.name,
  role: 'Specialist',
  department_id: item.dept,
  state: 'IDLE',
  state_evidence: 'Siaga operasional di Lounge',
  capabilities: ['read', 'write'],
  source_system: 'system',
  active: true,
  sort_order: idx + 1,
  current_task: null,
  last_activity_at: new Date().toISOString(),
  recent_activities: []
}));

// Test 26: Canonical mapping defines dedicated unique idle positions
const allAssignedSeats = canonicalStaffIds.map((s) => STAFF_CANONICAL_IDLE_SEATS[s.id]);
const uniqueAssignedSeats = new Set(allAssignedSeats);
assert(
  allAssignedSeats.length === uniqueAssignedSeats.size &&
  allAssignedSeats.every((seat) => typeof seat === 'string' && seat.startsWith('lounge_seat_')),
  'Test 26: STAFF_CANONICAL_IDLE_SEATS defines 100% unique dedicated lounge seats for all 5 active staff'
);

// Test 27: Multi-idle placement: all 5 eligible staff simultaneously IDLE occupy distinct seats with zero collision
const idleSprites = mockStaffList.map((st, idx) => deriveSpriteSpatialState(st, idx, null, []));
const occupiedIdlePositions = idleSprites.map((spr) => spr.position_key);
const uniqueIdlePositions = new Set(occupiedIdlePositions);
assert(
  uniqueIdlePositions.size === 5 &&
  idleSprites.find((s) => s.agent_id === 'content_writer_primary')?.position_key === 'lounge_seat_1' &&
  idleSprites.find((s) => s.agent_id === 'telemetry_observer_jev')?.position_key === 'lounge_seat_2' &&
  idleSprites.find((s) => s.agent_id === 'editorial_qa_primary')?.position_key === 'lounge_seat_3' &&
  idleSprites.find((s) => s.agent_id === 'evidence_researcher_lead')?.position_key === 'lounge_seat_4' &&
  idleSprites.find((s) => s.agent_id === 'publication_dispatcher_core')?.position_key === 'lounge_seat_5',
  'Test 27: All 5 active staff simultaneously IDLE occupy distinct canonical seats (Zero Lounge Collision)'
);

// Test 28: Invariant: Dimas & Sari never share the same lounge seat
const dimasSprite = idleSprites.find((s) => s.agent_id === 'telemetry_observer_jev');
const sariSprite = idleSprites.find((s) => s.agent_id === 'publication_dispatcher_core');
assert(
  dimasSprite.position_key === 'lounge_seat_2' &&
  sariSprite.position_key === 'lounge_seat_5' &&
  dimasSprite.position_key !== sariSprite.position_key,
  'Test 28: Invariant verified: Dimas (lounge_seat_2) and Sari (lounge_seat_5) NEVER collide'
);

// Test 29: Determinism: 100 iterations of simultaneous idle evaluation yield identical results
let isConsistent = true;
for (let i = 0; i < 100; i++) {
  const runSprites = mockStaffList.map((st, idx) => deriveSpriteSpatialState(st, idx, null, []));
  for (let j = 0; j < runSprites.length; j++) {
    if (runSprites[j].position_key !== idleSprites[j].position_key) {
      isConsistent = false;
      break;
    }
  }
}
assert(isConsistent, 'Test 29: Multi-idle placement is 100% deterministic across 100 iterations (zero randomness)');

// Test 30: Staff departure for RUNNING leaves their seat vacant without moving other idle staff
const mockSariWorking = { ...mockStaffList[4], state: 'WORKING', current_task: { current_task_id: 't-1', current_task_title: 'Dispatch', current_task_status: 'RUNNING', current_task_updated_at: '' } };
const partialIdleStaffList = [
  mockStaffList[0], // Joko IDLE
  mockStaffList[1], // Dimas IDLE
  mockStaffList[2], // Rina IDLE
  mockStaffList[3], // Irwan IDLE
  mockSariWorking   // Sari WORKING
];
const partialSprites = partialIdleStaffList.map((st, idx) => deriveSpriteSpatialState(st, idx, null, []));
const remainingLoungeOccupants = partialSprites.filter((s) => s.room_key === 'lounge');
const sariWorkingSprite = partialSprites.find((s) => s.agent_id === 'publication_dispatcher_core');
assert(
  sariWorkingSprite.position_key === 'publication_console' &&
  sariWorkingSprite.room_key === 'publication_room' &&
  !remainingLoungeOccupants.some((s) => s.position_key === 'lounge_seat_5') &&
  remainingLoungeOccupants.find((s) => s.agent_id === 'content_writer_primary')?.position_key === 'lounge_seat_1' &&
  remainingLoungeOccupants.find((s) => s.agent_id === 'telemetry_observer_jev')?.position_key === 'lounge_seat_2' &&
  remainingLoungeOccupants.find((s) => s.agent_id === 'editorial_qa_primary')?.position_key === 'lounge_seat_3' &&
  remainingLoungeOccupants.find((s) => s.agent_id === 'evidence_researcher_lead')?.position_key === 'lounge_seat_4',
  'Test 30: Departure of Sari vacates lounge_seat_5 without shifting positions of other idle staff'
);

// Test 31: Staff return from RUNNING restores exact canonical seat deterministically
const restoredSariSprite = deriveSpriteSpatialState(mockStaffList[4], 4, null, []);
assert(
  restoredSariSprite.position_key === 'lounge_seat_5' &&
  restoredSariSprite.room_key === 'lounge' &&
  restoredSariSprite.visual_mode === 'IDLE',
  'Test 31: Return of Sari from RUNNING restores canonical lounge_seat_5 deterministically'
);

// Test 32: Maya holding & Budi disabled invariants in spatial derivation
const mockMayaHolding = {
  agent_id: 'social_distribution_operator',
  name: 'Maya',
  role: 'Social Operator',
  department_id: 'social',
  state: 'OFFLINE',
  state_evidence: 'HOLDING: Operator Account Required',
  capabilities: ['publish'],
  source_system: 'system',
  active: true,
  sort_order: 7,
  current_task: null,
  last_activity_at: null,
  recent_activities: []
};
const mayaSprite = deriveSpriteSpatialState(mockMayaHolding, 0, null, []);
assert(
  mayaSprite.position_key === 'social_workstation' &&
  mayaSprite.room_key === 'social_room',
  'Test 32: Maya remains assigned to social_workstation in social_room while in HOLDING'
);

// Test 33: Public asset hygiene: verify zero QA screenshot artifacts in public/
const publicDir = path.resolve('public');
const publicFiles = fs.readdirSync(publicDir);
const qaArtifactsInPublic = publicFiles.filter((f) => f.startsWith('office-v23') || f.endsWith('-1440.png'));
assert(
  qaArtifactsInPublic.length === 0,
  `Test 33: No QA screenshot artifacts found in public/ (found ${qaArtifactsInPublic.length} files: ${qaArtifactsInPublic.join(', ') || 'none'})`
);

// Test 34: Production Dev Harness Guard: office.astro isolates dev controls behind isDev
const officeAstroPath = path.resolve('src/pages/admin/mission-control/office.astro');
const officeAstroContent = fs.readFileSync(officeAstroPath, 'utf8');
const hasDevGatedHarness = officeAstroContent.includes('{isDev && (') && officeAstroContent.includes('id="dev-scenario-harness"');
const hasDirectScenarioListenersInMain = officeAstroContent.includes("document.querySelectorAll('[data-dev-scenario]').forEach");
assert(
  hasDevGatedHarness && !hasDirectScenarioListenersInMain,
  'Test 34: Dev scenario harness is strictly gated behind isDev with no raw listeners in main script'
);

console.log('\n======================================================');
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
}

