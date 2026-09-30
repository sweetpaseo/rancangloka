/**
 * RancangLoka — Hermes Mission Control Role & Job Animation Test Suite
 * Milestone: HERMES-MC-9
 * 
 * Verifies:
 * 1. Joko active writing derives ARTICLE_TYPING animation and is_actively_working = true.
 * 2. Joko queued task in command queue remains IDLE_STANDBY with NO typing animation.
 * 3. Irwan research task derives RESEARCH_BROWSING animation.
 * 4. Rina QA review task derives QA_REVIEW animation.
 * 5. Budi with disabled Media worker strictly derives OFFLINE_DISABLED without fake work.
 * 6. Budi with enabled worker and active running media task derives MEDIA_PROCESSING.
 * 7. Sari with automation OFF strictly prevents PUBLICATION_DISPATCH.
 * 8. Dimas in JEV shadow mode with no active evaluation does NOT fake JEV processing.
 * 9. Dimas with active shadow observation evaluation derives JEV_ANALYSIS.
 * 10. Completed command stops working animation and returns staff to resting state.
 * 11. Blocked task maps deterministically to BLOCKED_WARNING at workstation.
 * 12. Unknown task / missing telemetry maps safely to UNKNOWN_NEUTRAL or safe fallback.
 * 13. IDLE staff spatial coordinates place them strictly in Lounge.
 * 14. WORKING staff spatial coordinates place them at their department workstation.
 * 15. Zero random movement (all positions match deterministic registry keys).
 * 16. Zero random animation (animations derive strictly from real running tasks).
 * 17. Real compact task labels use actual task titles without synthesized fake descriptions.
 * 18. Stable canonical machine IDs are used across all models (zero human names as runtime keys).
 * 19. Reduced-motion compatibility supported via CSS classes and flags.
 * 20. Zero execution methods (animation layer is strictly read-only presentation).
 * 21. Social department remains unstaffed with zero sprites or animations.
 */

import assert from 'node:assert/strict';
import {
  JOB_ANIMATION_REGISTRY,
  getAnimationDefinition,
  getAllAnimationDefinitions,
  deriveStaffWorkVisualState,
  getWorkstationKeyForAgent,
  evaluateFreshness
} from '../src/lib/mission-control/job-animation-registry.ts';
import {
  deriveSpriteSpatialState,
  getPixelOfficeState,
  OFFICE_POSITIONS,
  STAFF_HOME_ROOMS,
  STAFF_WORKSTATION_POSITIONS
} from '../src/lib/mission-control/pixel-office.ts';
import { getStaffRoster } from '../src/lib/mission-control/staff-registry.ts';

// Helper to construct a baseline mock snapshot
function createMockSnapshot(overrides = {}) {
  const base = {
    generatedAt: '2026-09-30T10:00:00.000Z',
    freshness: 'FRESH',
    environment: 'production',
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
        lastResponseTimeMs: 142,
        providerStatus: 'READY',
        latestObservation: null
      }
    },
    jev: {
      totalDecisions: 18,
      shadowMatches: 18,
      totalObservationsCount: 18,
      latestObservation: null
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
      cloudflareCron: [
        {
          cronName: 'publication_orchestrator',
          schedule: '*/5 * * * *',
          status: 'IDLE',
          lastRunAt: '2026-09-30T09:55:00.000Z'
        }
      ],
      heartbeat: {
        status: 'HEALTHY',
        lastHeartbeat: '2026-09-30T09:59:30.000Z',
        secondsSinceHeartbeat: 30
      }
    },
    anomalies: {
      active_anomalies: [],
      expected_conditions: [],
      resolved_anomalies: [],
      open_anomalies_count: 0,
      critical_count: 0,
      error_count: 0
    }
  };

  return { ...base, ...overrides };
}

// Helper to construct a mock StaffMemberStatus
function createMockStaff(agentId, state = 'IDLE', currentTask = null, overrides = {}) {
  const staffDefaults = {
    content_writer_primary: {
      display_name: 'Joko',
      role: 'Content Writer',
      department_id: 'editorial',
      capabilities: ['ARTICLE_WRITING'],
      avatar_key: 'avatar_joko'
    },
    evidence_researcher_lead: {
      display_name: 'Irwan',
      role: 'Research & Evidence',
      department_id: 'research_evidence',
      capabilities: ['EVIDENCE_RESEARCH'],
      avatar_key: 'avatar_irwan'
    },
    editorial_qa_primary: {
      display_name: 'Rina',
      role: 'Editorial QA',
      department_id: 'editorial',
      capabilities: ['EDITORIAL_QA'],
      avatar_key: 'avatar_irina'
    },
    lokamedia_worker_primary: {
      display_name: 'Budi',
      role: 'Media Operations',
      department_id: 'media',
      capabilities: ['MEDIA_OPERATIONS'],
      avatar_key: 'avatar_budi'
    },
    publication_dispatcher_core: {
      display_name: 'Sari',
      role: 'Publication Operations',
      department_id: 'publication_operations',
      capabilities: ['PUBLICATION_OPERATIONS'],
      avatar_key: 'avatar_sari'
    },
    telemetry_observer_jev: {
      display_name: 'Dimas',
      role: 'Engineering & Telemetry',
      department_id: 'engineering_telemetry',
      capabilities: ['SYSTEM_TELEMETRY'],
      avatar_key: 'avatar_dimas'
    }
  };

  const def = staffDefaults[agentId] || {
    display_name: 'Agent',
    role: 'Operator',
    department_id: 'editorial',
    capabilities: ['UNKNOWN'],
    avatar_key: 'avatar_default'
  };

  return {
    agent_id: agentId,
    display_name: def.display_name,
    role: def.role,
    department_id: def.department_id,
    description: 'Mock staff member',
    avatar_key: def.avatar_key,
    capabilities: def.capabilities,
    source_system: 'hermes_core',
    active: true,
    sort_order: 1,
    state,
    state_evidence: `Staff is currently ${state}`,
    current_task: currentTask,
    last_activity_at: '2026-09-30T09:58:00.000Z',
    recent_activities: [],
    ...overrides
  };
}

console.log('--- Starting Mission Control Role & Job Animation Test Suite (HERMES-MC-9) ---');

// ----------------------------------------------------------------------------
// Test 1: Joko active writing → ARTICLE_TYPING
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('content_writer_primary', 'WORKING', {
    current_task_id: 'task_article_101',
    current_task_title: 'Kusen Aluminium vs UPVC',
    current_task_status: 'IN_PROGRESS',
    current_task_updated_at: new Date().toISOString()
  });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'ARTICLE_TYPING', 'Joko active writing must map to ARTICLE_TYPING');
  assert.equal(visualState.is_actively_working, true, 'is_actively_working must be true');
  assert.equal(visualState.task_label, 'Menulis: Kusen Aluminium vs UPVC', 'Task label must match actual title');
  assert.equal(visualState.workstation_key, 'editorial_writer_desk', 'Must be at editorial_writer_desk');
  console.log('✓ [PASS] 1. Joko active writing → ARTICLE_TYPING');
}

// ----------------------------------------------------------------------------
// Test 2: Joko queued task → no typing (IDLE_STANDBY)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('content_writer_primary', 'IDLE', null);
  const queuedCommand = {
    command_id: 'cmd_draft_001',
    target_agent_id: 'content_writer_primary',
    command_type: 'ARTICLE_DRAFT_REQUEST',
    status: 'QUEUED',
    parameters: { topic: 'Fondasi Cakar Ayam' },
    created_at: new Date().toISOString()
  };

  const visualState = deriveStaffWorkVisualState(staff, snapshot, [queuedCommand]);
  assert.equal(visualState.animation_key, 'IDLE_STANDBY', 'Queued task MUST NOT trigger typing animation');
  assert.equal(visualState.is_actively_working, false, 'is_actively_working must remain false while queued');
  assert.equal(visualState.task_label, null, 'No working task label while merely queued');
  assert.equal(visualState.workstation_key, 'lounge', 'Queued staff remains in Lounge');
  console.log('✓ [PASS] 2. Joko queued task → no typing (IDLE_STANDBY)');
}

// ----------------------------------------------------------------------------
// Test 3: Irwan research → RESEARCH_BROWSING & citation check → EVIDENCE_READING
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('evidence_researcher_lead', 'WORKING', {
    current_task_id: 'task_res_201',
    current_task_title: 'Standar SNI Baja Ringan',
    current_task_status: 'RESEARCHING',
    current_task_updated_at: new Date().toISOString()
  });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'RESEARCH_BROWSING', 'Research task must map to RESEARCH_BROWSING');
  assert.equal(visualState.is_actively_working, true);
  assert.equal(visualState.workstation_key, 'research_main_desk');

  // Citation check variation
  const citationStaff = createMockStaff('evidence_researcher_lead', 'WORKING', {
    current_task_id: 'task_res_202',
    current_task_title: 'Cek Sitasi SNI 03-1726-2019',
    current_task_status: 'RESEARCHING',
    current_task_updated_at: new Date().toISOString()
  });
  const citVisual = deriveStaffWorkVisualState(citationStaff, snapshot);
  assert.equal(citVisual.animation_key, 'EVIDENCE_READING', 'Citation check must map to EVIDENCE_READING');
  console.log('✓ [PASS] 3. Irwan research → RESEARCH_BROWSING & EVIDENCE_READING');
}

// ----------------------------------------------------------------------------
// Test 4: Rina QA → QA_REVIEW & validation checklist → QA_CHECKLIST
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('editorial_qa_primary', 'REVIEWING', {
    current_task_id: 'task_qa_301',
    current_task_title: 'Review Mutu Redaksi Article 8',
    current_task_status: 'EDITORIAL_QA',
    current_task_updated_at: new Date().toISOString()
  });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'QA_REVIEW', 'Editorial QA must map to QA_REVIEW');
  assert.equal(visualState.is_actively_working, true);
  assert.equal(visualState.workstation_key, 'editorial_review_desk');

  // Checklist variation
  const checklistStaff = createMockStaff('editorial_qa_primary', 'WORKING', {
    current_task_id: 'task_qa_302',
    current_task_title: 'First Article Gate Checklist',
    current_task_status: 'VALIDATING',
    current_task_updated_at: new Date().toISOString()
  });
  const checkVisual = deriveStaffWorkVisualState(checklistStaff, snapshot);
  assert.equal(checkVisual.animation_key, 'QA_CHECKLIST', 'Checklist task must map to QA_CHECKLIST');
  console.log('✓ [PASS] 4. Rina QA → QA_REVIEW & QA_CHECKLIST');
}

// ----------------------------------------------------------------------------
// Test 5: Budi disabled → OFFLINE_DISABLED (no fake work even if task exists)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot(); // default mediaWorker is DISABLED
  const staff = createMockStaff('lokamedia_worker_primary', 'OFFLINE', {
    current_task_id: 'task_media_stalled',
    current_task_title: 'Stalled Media Task',
    current_task_status: 'WAITING_WORKER',
    current_task_updated_at: new Date().toISOString()
  });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'OFFLINE_DISABLED', 'Disabled media worker MUST derive OFFLINE_DISABLED');
  assert.equal(visualState.is_actively_working, false, 'Disabled media worker must NOT be actively working');
  assert.equal(visualState.task_label, null, 'No working task label for disabled worker');
  console.log('✓ [PASS] 5. Budi disabled → OFFLINE_DISABLED');
}

// ----------------------------------------------------------------------------
// Test 6: Budi real running media task → MEDIA_PROCESSING (only when enabled)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    health: {
      overallStatus: 'HEALTHY',
      mediaWorker: {
        dbGate: 'ENABLED',
        effectiveState: 'ENABLED',
        activeDevicesCount: 1,
        reason: null
      }
    }
  });

  const staff = createMockStaff('lokamedia_worker_primary', 'WORKING', {
    current_task_id: 'task_media_active',
    current_task_title: 'Render Diagram Kusen',
    current_task_status: 'GENERATING',
    current_task_updated_at: new Date().toISOString()
  });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'MEDIA_PROCESSING', 'Active media job must map to MEDIA_PROCESSING when enabled');
  assert.equal(visualState.is_actively_working, true);
  assert.equal(visualState.workstation_key, 'media_console');
  console.log('✓ [PASS] 6. Budi real running media task → MEDIA_PROCESSING (enabled)');
}

// ----------------------------------------------------------------------------
// Test 7: Sari automation OFF → no publication dispatch
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot(); // automation.mode is OFF
  const staff = createMockStaff('publication_dispatcher_core', 'REVIEWING', {
    current_task_id: 'task_pub_plan',
    current_task_title: 'Antrean Rencana Tayang',
    current_task_status: 'SCHEDULED',
    current_task_updated_at: new Date().toISOString()
  });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.notEqual(visualState.animation_key, 'PUBLICATION_DISPATCH', 'Automation OFF MUST NEVER derive PUBLICATION_DISPATCH');
  assert.equal(visualState.animation_key, 'PUBLICATION_MONITORING', 'Must map safely to PUBLICATION_MONITORING');
  console.log('✓ [PASS] 7. Sari automation OFF → no publication dispatch');
}

// ----------------------------------------------------------------------------
// Test 8: Dimas JEV shadow idle → no fake JEV processing
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot(); // no latestObservation
  const staff = createMockStaff('telemetry_observer_jev', 'IDLE', null);

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'IDLE_STANDBY', 'Idle telemetry observer must remain IDLE_STANDBY in Lounge');
  assert.equal(visualState.is_actively_working, false);
  console.log('✓ [PASS] 8. Dimas JEV shadow idle → no fake JEV processing');
}

// ----------------------------------------------------------------------------
// Test 9: Dimas active observation → JEV_ANALYSIS
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    health: {
      jev: {
        mode: 'shadow',
        reachable: true,
        lastResponseTimeMs: 120,
        latestObservation: {
          observationId: 'obs_999',
          decisionPoint: 'PUBLICATION_READINESS',
          providerStatus: 'SHADOW_EVALUATING',
          createdAt: new Date().toISOString()
        }
      }
    }
  });

  const staff = createMockStaff('telemetry_observer_jev', 'WORKING', {
    current_task_id: 'obs_999',
    current_task_title: 'Shadow Evaluation: PUBLICATION_READINESS',
    current_task_status: 'SHADOW_EVALUATING',
    current_task_updated_at: new Date().toISOString()
  });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'JEV_ANALYSIS', 'Active shadow observation must derive JEV_ANALYSIS');
  assert.equal(visualState.is_actively_working, true);
  assert.equal(visualState.workstation_key, 'operations_console');
  console.log('✓ [PASS] 9. Dimas active observation → JEV_ANALYSIS');
}

// ----------------------------------------------------------------------------
// Test 10: Completed task stops working animation
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('content_writer_primary', 'IDLE', null);
  const completedCommand = {
    command_id: 'cmd_done_123',
    target_agent_id: 'content_writer_primary',
    command_type: 'ARTICLE_DRAFT_REQUEST',
    status: 'COMPLETED',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date().toISOString()
  };

  const visualState = deriveStaffWorkVisualState(staff, snapshot, [completedCommand]);
  assert.equal(visualState.animation_key, 'IDLE_STANDBY', 'Completed task MUST stop working animation');
  assert.equal(visualState.is_actively_working, false);
  assert.equal(visualState.workstation_key, 'lounge');
  console.log('✓ [PASS] 10. Completed task stops working animation');
}

// ----------------------------------------------------------------------------
// Test 11: Blocked task maps BLOCKED_WARNING
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('content_writer_primary', 'BLOCKED', {
    current_task_id: 'task_fail_404',
    current_task_title: 'Penulisan Terhenti',
    current_task_status: 'FAILED',
    current_task_updated_at: new Date().toISOString()
  }, { state_evidence: 'Outbox receipt failed delivery' });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'BLOCKED_WARNING', 'Blocked staff must map to BLOCKED_WARNING');
  assert.equal(visualState.is_actively_working, false);
  assert.equal(visualState.workstation_key, 'editorial_writer_desk');
  console.log('✓ [PASS] 11. Blocked task maps BLOCKED_WARNING');
}

// ----------------------------------------------------------------------------
// Test 12: Unknown task maps safe fallback
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('unknown_agent_id', 'UNKNOWN', null);

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.animation_key, 'UNKNOWN_NEUTRAL', 'Unknown telemetry maps to UNKNOWN_NEUTRAL');
  assert.equal(visualState.is_actively_working, false);
  console.log('✓ [PASS] 12. Unknown task maps safe fallback');
}

// ----------------------------------------------------------------------------
// Test 13: IDLE goes Lounge
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('content_writer_primary', 'IDLE', null);
  const sprite = deriveSpriteSpatialState(staff, 0, snapshot);

  assert.equal(sprite.room_key, 'lounge', 'IDLE staff MUST be placed in lounge');
  assert.equal(sprite.position_key, 'lounge_seat_1', 'IDLE staff assigned lounge seat');
  assert.equal(sprite.animation_key, 'IDLE_STANDBY');
  console.log('✓ [PASS] 13. IDLE goes Lounge');
}

// ----------------------------------------------------------------------------
// Test 14: WORKING goes workstation
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('content_writer_primary', 'WORKING', {
    current_task_id: 'task_active_01',
    current_task_title: 'Desain Atap Baja Ringan',
    current_task_status: 'IN_PROGRESS',
    current_task_updated_at: new Date().toISOString()
  });
  const sprite = deriveSpriteSpatialState(staff, 0, snapshot);

  assert.equal(sprite.room_key, 'editorial_room', 'WORKING Joko must be in editorial_room');
  assert.equal(sprite.position_key, 'editorial_writer_desk', 'Must be at editorial_writer_desk');
  assert.equal(sprite.animation_key, 'ARTICLE_TYPING');
  assert.equal(sprite.work_visual_state.is_actively_working, true);
  console.log('✓ [PASS] 14. WORKING goes workstation');
}

// ----------------------------------------------------------------------------
// Test 15: No random movement (all positions match deterministic registry keys)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);

  for (const sprite of office.sprites) {
    const matchedPos = OFFICE_POSITIONS.find((p) => p.position_key === sprite.position_key);
    assert.ok(matchedPos, `Position key ${sprite.position_key} must exist in OFFICE_POSITIONS`);
    assert.equal(sprite.x, matchedPos.x, 'X coordinate must exactly match registry definition');
    assert.equal(sprite.y, matchedPos.y, 'Y coordinate must exactly match registry definition');
  }
  console.log('✓ [PASS] 15. No random movement (positions strictly deterministic)');
}

// ----------------------------------------------------------------------------
// Test 16: No random animation (all animations derive strictly from real tasks)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);

  // In resting baseline (media worker DISABLED, automation OFF, no active tasks)
  for (const sprite of office.sprites) {
    if (sprite.agent_id === 'lokamedia_worker_primary') {
      assert.equal(sprite.animation_key, 'OFFLINE_DISABLED', 'Budi must be OFFLINE_DISABLED in baseline');
    } else {
      assert.equal(sprite.animation_key, 'IDLE_STANDBY', `${sprite.display_name} must be IDLE_STANDBY with no active tasks`);
    }
    assert.equal(sprite.work_visual_state.is_actively_working, false, 'Zero staff should be marked working in baseline');
  }
  console.log('✓ [PASS] 16. No random animation (baseline strictly idle/disabled)');
}

// ----------------------------------------------------------------------------
// Test 17: Real task label (uses genuine titles, no synthetic fabrication)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const staff = createMockStaff('content_writer_primary', 'WORKING', {
    current_task_id: 'task_concrete_01',
    current_task_title: 'Struktur Beton Bertulang',
    current_task_status: 'IN_PROGRESS',
    current_task_updated_at: new Date().toISOString()
  });

  const visualState = deriveStaffWorkVisualState(staff, snapshot);
  assert.equal(visualState.task_label, 'Menulis: Struktur Beton Bertulang');
  assert.ok(visualState.task_label.includes('Struktur Beton Bertulang'), 'Label must contain genuine task title');
  console.log('✓ [PASS] 17. Real task label preserves genuine task title');
}

// ----------------------------------------------------------------------------
// Test 18: Stable machine IDs (never human names as runtime keys)
// ----------------------------------------------------------------------------
{
  const allDefs = getAllAnimationDefinitions();
  assert.ok(allDefs.length >= 16, 'At least 16 animation definitions must exist');

  const knownMachineIds = [
    'content_writer_primary',
    'editorial_qa_primary',
    'evidence_researcher_lead',
    'lokamedia_worker_primary',
    'publication_dispatcher_core',
    'telemetry_observer_jev'
  ];

  for (const def of allDefs) {
    for (const agentId of def.target_agent_ids) {
      assert.ok(knownMachineIds.includes(agentId), `Agent ID ${agentId} must be canonical machine ID`);
      assert.notEqual(agentId, 'Joko', 'Must not use human display name');
      assert.notEqual(agentId, 'Irwan', 'Must not use human display name');
    }
  }
  console.log('✓ [PASS] 18. Stable canonical machine IDs verified');
}

// ----------------------------------------------------------------------------
// Test 19: Reduced motion compatibility
// ----------------------------------------------------------------------------
{
  const allDefs = getAllAnimationDefinitions();
  for (const def of allDefs) {
    if (def.is_work_animation) {
      assert.ok(
        def.reduced_motion_class.includes('motion-reduce:'),
        `Animation ${def.animation_key} must define motion-reduce accessibility class`
      );
    }
  }
  console.log('✓ [PASS] 19. Reduced motion compatibility verified');
}

// ----------------------------------------------------------------------------
// Test 20: No execution methods (registry & visual states are 100% read-only)
// ----------------------------------------------------------------------------
{
  const def = getAnimationDefinition('ARTICLE_TYPING');
  assert.equal(typeof def, 'object');
  assert.equal((def).execute, undefined, 'Animation definition must contain zero execution methods');
  assert.equal((def).dispatch, undefined, 'Animation definition must contain zero dispatch methods');
  assert.equal((def).publish, undefined, 'Animation definition must contain zero publish methods');
  console.log('✓ [PASS] 20. Zero execution authority verified');
}

// ----------------------------------------------------------------------------
// Test 21: Social department remains unstaffed with zero sprites or animations
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);
  const socialRoom = office.rooms.find((r) => r.room_key === 'social_room');

  assert.ok(socialRoom, 'Social room must exist in office rooms');
  assert.equal(socialRoom.is_available, false, 'Social room must be unavailable');
  assert.equal(socialRoom.occupants.length, 0, 'Social room must contain zero staff');
  console.log('✓ [PASS] 21. Social department remains unstaffed with zero animations');
}

console.log('======================================================');
console.log('ALL 21 ROLE & JOB ANIMATION TESTS PASSED CLEANLY! (HERMES-MC-9)');
console.log('======================================================');
