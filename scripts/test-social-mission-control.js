/**
 * RancangLoka — SOCIAL MISSION CONTROL INTEGRATION TEST SUITE (SOCIAL-S2)
 * 
 * Verifies:
 * 1. Social department canonical registration and baseline unstaffed state.
 * 2. activateSocialDepartmentShadow() transitions department to AVAILABLE_READ_ONLY and registers Maya.
 * 3. Maya staff identity, role, department, avatar, and capability mapping.
 * 4. All canonical social capabilities have ZERO execution authority (AVAILABLE_READ_ONLY).
 * 5. Pixel Office Zone S (social_room) displays staffed state and social_workstation.
 * 6. Maya is IDLE in Lounge (IDLE_STANDBY) when no active work exists.
 * 7. Real DRAFT/PREPARING work maps Maya to WORKING at social_workstation with ARTICLE_TYPING.
 * 8. Real carousel curation maps to MEDIA_REVIEW.
 * 9. Real QA review maps to QA_REVIEW.
 * 10. PENDING_APPROVAL does NOT fake publishing (Maya remains IDLE in Lounge).
 * 11. SCHEDULED with SOCIAL_AUTOMATION = OFF does NOT fake dispatch (held in outbox, Maya in Lounge).
 * 12. BLOCKED task/campaign maps to BLOCKED_WARNING at social_workstation.
 * 13. COMPLETED campaign returns Maya to IDLE_STANDBY in Lounge.
 * 14. Direct Staff Chat allows read-only queries and strictly rejects publishing/destructive commands.
 * 15. Anomaly detection & escalation for blocked social campaigns assigned to Maya.
 * 16. Dynamic deactivation restores canonical baseline cleanly.
 */

import assert from 'node:assert/strict';
import {
  activateSocialDepartmentShadow,
  deactivateSocialDepartmentShadow,
  getMissionControlSnapshot,
  getOrganizationSnapshot,
  getStaffRoster,
  getStaffDefinitionByAgentId,
  deriveStaffState,
  deriveStaffCurrentTask,
  getPixelOfficeState,
  deriveStaffWorkVisualState,
  getDepartmentDefinition,
  getRegisteredDepartments,
  getRegisteredCapabilities,
  routeAnomalyByCapability,
  getAnomaliesSnapshot,
  processOperatorInteraction,
  executeReadOnlyQuery,
  getSocialOperationsSummary,
  CANONICAL_SOCIAL_STAFF_DEFINITION,
  CANONICAL_SOCIAL_CAPABILITIES
} from '../src/lib/mission-control/index.ts';

// Helper to construct a baseline mock snapshot
function createMockSnapshot(overrides = {}) {
  const base = {
    generatedAt: '2026-10-01T10:00:00.000Z',
    freshness: 'FRESH',
    environment: 'test',
    health: {
      overallStatus: 'HEALTHY',
      automation: {
        mode: 'OFF',
        killSwitchEngaged: false,
        killReason: null,
        updatedAt: '2026-10-01T09:00:00.000Z'
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
        latestTimestamp: '2026-10-01T09:59:00.000Z',
        errorClass: null
      },
      circuitBreakers: []
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
        recordedAt: '2026-10-01T09:58:00.000Z',
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
      acknowledged: 0,
      deadLetter: 0,
      source: 'd1_receipts',
      lastIngestAt: null
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
      effectiveWorkerState: 'DISABLED',
      pendingJobsCount: 0,
      inProgressJobsCount: 0,
      failedJobsCount: 0,
      attachedJobsCount: 0,
      totalAssetsCount: 0,
      activeDevicesCount: 0,
      recentEvent: null
    },
    jev: {
      mode: 'shadow',
      authority: 'none',
      totalObservationsCount: 0,
      agreementRatePercent: null,
      latestObservation: null,
      recentObservations: []
    },
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      totalCampaigns: 0,
      activeCampaigns: 0,
      draftCampaigns: 0,
      approvedCampaigns: 0,
      scheduledCampaigns: 0,
      completedCampaigns: 0,
      blockedCampaigns: 0,
      totalVariants: 0,
      variantsAwaitingQa: 0,
      variantsAwaitingApproval: 0,
      variantsApproved: 0,
      variantsScheduledHeld: 0,
      publishedExternallyCount: 0,
      outboxStagedCount: 0,
      outboxEligibleCount: 0,
      providerExecutionAvailable: false,
      latestCampaign: null
    }
  };

  return { ...base, ...overrides };
}

console.log('--- Starting Social Mission Control Integration Test Suite (SOCIAL-S2) ---');

// ----------------------------------------------------------------------------
// Test 1: Baseline Unstaffed State Before Activation
// ----------------------------------------------------------------------------
{
  const baselineDept = getDepartmentDefinition('social');
  assert.ok(baselineDept, 'Social department definition must exist');
  assert.equal(baselineDept.department_id, 'social');
  assert.equal(baselineDept.availability, 'NOT_AVAILABLE');
  assert.equal(baselineDept.is_staffed, false);

  const baselineStaff = getStaffDefinitionByAgentId('social_distribution_operator');
  assert.equal(baselineStaff, null, 'Maya must not be registered before activation');

  console.log('✓ [PASS] 1. Baseline unstaffed Social department verified');
}

// ----------------------------------------------------------------------------
// Test 2: Activate Social Department Shadow Mode
// ----------------------------------------------------------------------------
{
  activateSocialDepartmentShadow();

  const dept = getDepartmentDefinition('social');
  assert.ok(dept, 'Social department must be retrievable');
  assert.equal(dept.availability, 'AVAILABLE_READ_ONLY', 'Must be AVAILABLE_READ_ONLY (shadow)');
  assert.equal(dept.is_staffed, true, 'Department must now be staffed');
  assert.equal(dept.workstation_zone, 'Zone S - Social Operations & Distribution Hub');

  const staff = getStaffDefinitionByAgentId('social_distribution_operator');
  assert.ok(staff, 'Maya must now be registered');
  assert.equal(staff.agent_id, 'social_distribution_operator');
  assert.equal(staff.display_name, 'Maya');
  assert.equal(staff.role, 'Social Content & Distribution Specialist');
  assert.equal(staff.department_id, 'social');
  assert.equal(staff.avatar_key, 'social_specialist_01');

  console.log('✓ [PASS] 2. Social department shadow activation & staff registration verified');
}

// ----------------------------------------------------------------------------
// Test 3: Capability Registration & Zero Execution Authority Invariant
// ----------------------------------------------------------------------------
{
  const registeredCaps = getRegisteredCapabilities();
  const socialCaps = registeredCaps.filter((c) => c.owning_department_id === 'social');

  assert.ok(socialCaps.length >= 5, `Expected at least 5 social capabilities, got ${socialCaps.length}`);

  const requiredIds = [
    'SOCIAL_DISTRIBUTION',
    'SOCIAL_COPY_WRITING',
    'CAROUSEL_CURATION',
    'SOCIAL_QA_SUPPORT',
    'SOCIAL_SCHEDULING_OBSERVATION'
  ];

  for (const id of requiredIds) {
    const found = socialCaps.find((c) => c.capability_id === id);
    assert.ok(found, `Capability ${id} must be registered`);
    assert.equal(found.default_agent_id, 'social_distribution_operator');
    assert.equal(found.operational_availability, 'AVAILABLE_READ_ONLY', 'Must be read-only');
  }

  console.log('✓ [PASS] 3. Canonical capabilities & zero execution authority verified');
}

// ----------------------------------------------------------------------------
// Test 4: Pixel Office Zone S Visibility & Staffed State
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const office = getPixelOfficeState(snapshot);

  const socialRoom = office.rooms.find((r) => r.room_key === 'social_room');
  assert.ok(socialRoom, 'social_room must exist in Pixel Office');
  assert.equal(socialRoom.is_available, true, 'social_room must be available when staffed');
  assert.ok(socialRoom.zone.includes('Zone S'), 'Zone must include Zone S');
  assert.equal(socialRoom.subtitle, 'Social Operations & Distribution Hub');

  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.ok(mayaSprite, 'Maya sprite must be present in Pixel Office');
  assert.equal(mayaSprite.display_name, 'Maya');
  assert.equal(mayaSprite.role, 'Social Content & Distribution Specialist');

  console.log('✓ [PASS] 4. Pixel Office Zone S and Maya sprite verified');
}

// ----------------------------------------------------------------------------
// Test 5: Idle Behavior When No Active Social Work Exists
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot();
  const state = deriveStaffState('social_distribution_operator', snapshot);
  assert.equal(state.state, 'IDLE', 'Maya must be IDLE when no active tasks exist');

  const task = deriveStaffCurrentTask('social_distribution_operator', snapshot);
  assert.equal(task, null, 'Current task must be null when idle (no fake tasks)');

  const office = getPixelOfficeState(snapshot);
  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.equal(mayaSprite.room_key, 'lounge', 'Idle staff must be in Lounge');
  assert.equal(mayaSprite.animation_key, 'IDLE_STANDBY', 'Idle staff must have IDLE_STANDBY animation');
  assert.equal(mayaSprite.work_visual_state.is_actively_working, false, 'Must not be actively working');

  console.log('✓ [PASS] 5. Idle behavior & Lounge position verified (no fake work)');
}

// ----------------------------------------------------------------------------
// Test 6: Real DRAFT/PREPARING Work Maps to WORKING with ARTICLE_TYPING
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'soc_task_001',
          subsystem: 'social',
          title: 'Menyusun varian Instagram: Bata Ekspos',
          stage: 'draft',
          assignedAgent: 'social_distribution_operator',
          lastUpdate: '2026-10-01T10:05:00.000Z'
        }
      ],
      stageCounts: { draft: 1, writing: 0, editorial_qa: 0, ready_for_review: 0, scheduled: 0, published: 0, failed: 0 },
      totalActiveTasks: 1
    }
  });

  const state = deriveStaffState('social_distribution_operator', snapshot);
  assert.equal(state.state, 'WORKING', 'Active drafting must map to WORKING');

  const task = deriveStaffCurrentTask('social_distribution_operator', snapshot);
  assert.ok(task, 'Task must be populated');
  assert.equal(task.current_task_title, 'Menyusun varian Instagram: Bata Ekspos');

  const office = getPixelOfficeState(snapshot);
  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.equal(mayaSprite.room_key, 'social_room', 'Working Maya must be in social_room');
  assert.equal(mayaSprite.position_key, 'social_workstation', 'Must be at social_workstation');
  assert.equal(mayaSprite.animation_key, 'ARTICLE_TYPING', 'Drafting must show ARTICLE_TYPING');
  assert.equal(mayaSprite.work_visual_state.is_actively_working, true);

  console.log('✓ [PASS] 6. Real drafting work maps to WORKING at workstation with ARTICLE_TYPING');
}

// ----------------------------------------------------------------------------
// Test 7: Real Carousel / Media Curation Maps to MEDIA_REVIEW
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'soc_task_002',
          subsystem: 'social',
          title: 'Kurasi 5 slide visual carousel Instagram',
          stage: 'writing',
          assignedAgent: 'social_distribution_operator',
          lastUpdate: '2026-10-01T10:10:00.000Z'
        }
      ],
      stageCounts: { draft: 0, writing: 1, editorial_qa: 0, ready_for_review: 0, scheduled: 0, published: 0, failed: 0 },
      totalActiveTasks: 1
    }
  });

  const office = getPixelOfficeState(snapshot);
  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.equal(mayaSprite.animation_key, 'MEDIA_REVIEW', 'Carousel curation must show MEDIA_REVIEW');
  assert.equal(mayaSprite.work_visual_state.is_actively_working, true);

  console.log('✓ [PASS] 7. Carousel curation maps to MEDIA_REVIEW');
}

// ----------------------------------------------------------------------------
// Test 8: Real QA Review Maps to QA_REVIEW
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'soc_task_003',
          subsystem: 'social',
          title: 'Inspeksi mutu naskah varian X / Twitter',
          stage: 'editorial_qa',
          assignedAgent: 'social_distribution_operator',
          lastUpdate: '2026-10-01T10:15:00.000Z'
        }
      ],
      stageCounts: { draft: 0, writing: 0, editorial_qa: 1, ready_for_review: 0, scheduled: 0, published: 0, failed: 0 },
      totalActiveTasks: 1
    }
  });

  const state = deriveStaffState('social_distribution_operator', snapshot);
  assert.equal(state.state, 'REVIEWING', 'QA stage must map to REVIEWING');

  const office = getPixelOfficeState(snapshot);
  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.equal(mayaSprite.animation_key, 'QA_REVIEW', 'QA stage must show QA_REVIEW');

  console.log('✓ [PASS] 8. Social QA review maps to QA_REVIEW');
}

// ----------------------------------------------------------------------------
// Test 9: PENDING_APPROVAL Safety Invariant (No Fake Publishing, Maya Remains IDLE)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      totalCampaigns: 1,
      activeCampaigns: 1,
      draftCampaigns: 0,
      approvedCampaigns: 0,
      scheduledCampaigns: 0,
      completedCampaigns: 0,
      blockedCampaigns: 0,
      totalVariants: 2,
      variantsAwaitingQa: 0,
      variantsAwaitingApproval: 2, // 2 items waiting Chief Editor approval
      variantsApproved: 0,
      variantsScheduledHeld: 0,
      publishedExternallyCount: 0,
      outboxStagedCount: 0,
      outboxEligibleCount: 0,
      providerExecutionAvailable: false,
      latestCampaign: {
        campaignId: 'camp_001',
        title: 'Review Pending Campaign',
        status: 'READY_FOR_APPROVAL',
        articleSlug: 'review-pending',
        platformCount: 2,
        createdAt: '2026-10-01T09:00:00.000Z'
      }
    }
  });

  const state = deriveStaffState('social_distribution_operator', snapshot);
  assert.equal(state.state, 'IDLE', 'Pending approval variants must NOT make staff active (waiting state)');

  const task = deriveStaffCurrentTask('social_distribution_operator', snapshot);
  assert.equal(task, null, 'No active work when awaiting approval');

  const office = getPixelOfficeState(snapshot);
  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.equal(mayaSprite.room_key, 'lounge', 'Awaiting approval staff rests in Lounge');
  assert.equal(mayaSprite.animation_key, 'IDLE_STANDBY');
  assert.equal(mayaSprite.work_visual_state.is_actively_working, false);

  console.log('✓ [PASS] 9. PENDING_APPROVAL does not fake publishing (Maya remains IDLE in Lounge)');
}

// ----------------------------------------------------------------------------
// Test 10: SCHEDULED + SOCIAL_AUTOMATION=OFF Safety Invariant (No Fake Dispatch)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      totalCampaigns: 1,
      activeCampaigns: 1,
      draftCampaigns: 0,
      approvedCampaigns: 0,
      scheduledCampaigns: 1,
      completedCampaigns: 0,
      blockedCampaigns: 0,
      totalVariants: 1,
      variantsAwaitingQa: 0,
      variantsAwaitingApproval: 0,
      variantsApproved: 1,
      variantsScheduledHeld: 1, // Scheduled but held because automation is OFF
      publishedExternallyCount: 0,
      outboxStagedCount: 1,
      outboxEligibleCount: 0, // 0 eligible due to automation OFF
      providerExecutionAvailable: false,
      latestCampaign: {
        campaignId: 'camp_002',
        title: 'Scheduled Campaign',
        status: 'SCHEDULED',
        articleSlug: 'scheduled-post',
        platformCount: 1,
        createdAt: '2026-10-01T09:00:00.000Z'
      }
    }
  });

  const state = deriveStaffState('social_distribution_operator', snapshot);
  assert.equal(state.state, 'IDLE', 'Scheduled items with automation OFF must NOT fake publishing');

  const office = getPixelOfficeState(snapshot);
  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.equal(mayaSprite.animation_key, 'IDLE_STANDBY', 'Must remain IDLE_STANDBY');
  assert.equal(mayaSprite.work_visual_state.is_actively_working, false);

  console.log('✓ [PASS] 10. SCHEDULED with automation OFF strictly prevents fake publishing dispatch');
}

// ----------------------------------------------------------------------------
// Test 11: BLOCKED State Maps to BLOCKED_WARNING at Workstation
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    pipeline: {
      tasks: [
        {
          taskId: 'soc_task_004',
          subsystem: 'social',
          title: 'Varian Instagram terhenti: Aset foto gagal validasi',
          stage: 'failed',
          blockerOrError: 'Validasi integritas gambar gagal',
          assignedAgent: 'social_distribution_operator',
          lastUpdate: '2026-10-01T10:20:00.000Z'
        }
      ],
      stageCounts: { draft: 0, writing: 0, editorial_qa: 0, ready_for_review: 0, scheduled: 0, published: 0, failed: 1 },
      totalActiveTasks: 1
    }
  });

  const state = deriveStaffState('social_distribution_operator', snapshot);
  assert.equal(state.state, 'BLOCKED', 'Failed task must map to BLOCKED');

  const office = getPixelOfficeState(snapshot);
  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.equal(mayaSprite.room_key, 'social_room', 'Blocked staff remains at workstation');
  assert.equal(mayaSprite.animation_key, 'BLOCKED_WARNING', 'Blocked staff must show BLOCKED_WARNING');
  assert.equal(mayaSprite.work_visual_state.is_actively_working, false);

  console.log('✓ [PASS] 11. BLOCKED task maps to BLOCKED_WARNING at social_workstation');
}

// ----------------------------------------------------------------------------
// Test 12: COMPLETED Campaign Returns Maya to IDLE in Lounge
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      totalCampaigns: 1,
      activeCampaigns: 0,
      draftCampaigns: 0,
      approvedCampaigns: 0,
      scheduledCampaigns: 0,
      completedCampaigns: 1,
      blockedCampaigns: 0,
      totalVariants: 1,
      variantsAwaitingQa: 0,
      variantsAwaitingApproval: 0,
      variantsApproved: 1,
      variantsScheduledHeld: 0,
      publishedExternallyCount: 0,
      outboxStagedCount: 0,
      outboxEligibleCount: 0,
      providerExecutionAvailable: false,
      latestCampaign: null
    }
  });

  const state = deriveStaffState('social_distribution_operator', snapshot);
  assert.equal(state.state, 'IDLE');

  const office = getPixelOfficeState(snapshot);
  const mayaSprite = office.sprites.find((s) => s.agent_id === 'social_distribution_operator');
  assert.equal(mayaSprite.room_key, 'lounge');
  assert.equal(mayaSprite.animation_key, 'IDLE_STANDBY');

  console.log('✓ [PASS] 12. COMPLETED campaign returns staff to IDLE in Lounge');
}

// ----------------------------------------------------------------------------
// Test 13: Direct Staff Chat Integration (Read-Only Permitted, Mutators Rejected)
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      totalCampaigns: 3,
      activeCampaigns: 2,
      draftCampaigns: 1,
      approvedCampaigns: 0,
      scheduledCampaigns: 1,
      completedCampaigns: 1,
      blockedCampaigns: 0,
      totalVariants: 4,
      variantsAwaitingQa: 1,
      variantsAwaitingApproval: 1,
      variantsApproved: 1,
      variantsScheduledHeld: 1,
      publishedExternallyCount: 0,
      outboxStagedCount: 1,
      outboxEligibleCount: 0,
      providerExecutionAvailable: false,
      latestCampaign: {
        campaignId: 'camp_chat_001',
        title: 'Desain Fasad Industrial',
        status: 'DRAFT',
        articleSlug: 'fasad-industrial',
        platformCount: 2,
        createdAt: '2026-10-01T09:30:00.000Z'
      }
    }
  });

  // A. Safe Read-Only Query: Social Status
  const statusResult = executeReadOnlyQuery('SOCIAL_STATUS_QUERY', 'social_distribution_operator', snapshot);
  assert.ok(statusResult.includes('Mode: **SHADOW / READ-ONLY**'));
  assert.ok(statusResult.includes('Total Kampanye: **3**'));
  assert.ok(statusResult.includes('Terbit Eksternal: **0**'));

  // B. Safe Read-Only Query: Campaign Review
  const campaignResult = executeReadOnlyQuery('SOCIAL_CAMPAIGN_REVIEW', 'social_distribution_operator', snapshot);
  assert.ok(campaignResult.includes('Desain Fasad Industrial'));
  assert.ok(campaignResult.includes('camp_chat_001'));

  // C. Safe Read-Only Query: Outbox Review
  const outboxResult = executeReadOnlyQuery('SOCIAL_OUTBOX_REVIEW', 'social_distribution_operator', snapshot);
  assert.ok(outboxResult.includes('Item Tertahan (Staged): **1**'));
  assert.ok(outboxResult.includes('Item Layak Kirim (Eligible): **0**'));

  // D. Disallowed Destructive / Mutation Commands Rejected via Operator Chat
  const publishAttempt = await processOperatorInteraction(
    null,
    'social_distribution_operator',
    'Publish kampanye sosial ke Instagram sekarang!',
    snapshot
  );
  assert.equal(publishAttempt.command, undefined, 'Publishing via chat must not queue commands');
  assert.equal(publishAttempt.response_message.message_type, 'ERROR');
  assert.ok(publishAttempt.response_message.content.includes('DANGEROUS_ACTION_FORBIDDEN'));

  const adminAttempt = await processOperatorInteraction(
    null,
    'social_distribution_operator',
    'Tolong hidupkan kill switch sekarang',
    snapshot
  );
  assert.equal(adminAttempt.command, undefined, 'Admin control via chat must not queue commands');
  assert.equal(adminAttempt.response_message.message_type, 'ERROR');
  assert.ok(adminAttempt.response_message.content.includes('ADMIN_APPROVAL_REQUIRED'));

  const disallowedAttempt = await processOperatorInteraction(
    null,
    'social_distribution_operator',
    'Buatkan puisi tentang awan dan hujan',
    snapshot
  );
  assert.equal(disallowedAttempt.command, undefined);
  assert.equal(disallowedAttempt.response_message.message_type, 'ERROR');
  assert.ok(disallowedAttempt.response_message.content.includes('COMMAND_NOT_ALLOWED'));

  console.log('✓ [PASS] 13. Direct Staff Chat read-only queries permitted and mutators strictly rejected');
}

// ----------------------------------------------------------------------------
// Test 14: Anomaly Detection & Staff Escalation for Blocked Social Campaigns
// ----------------------------------------------------------------------------
{
  const snapshot = createMockSnapshot({
    social: {
      departmentAvailability: 'AVAILABLE_READ_ONLY',
      mode: 'SHADOW',
      staffCount: 1,
      totalCampaigns: 2,
      activeCampaigns: 2,
      draftCampaigns: 1,
      approvedCampaigns: 0,
      scheduledCampaigns: 0,
      completedCampaigns: 0,
      blockedCampaigns: 1, // 1 blocked campaign
      totalVariants: 2,
      variantsAwaitingQa: 0,
      variantsAwaitingApproval: 0,
      variantsApproved: 0,
      variantsScheduledHeld: 0,
      publishedExternallyCount: 0,
      outboxStagedCount: 0,
      outboxEligibleCount: 0,
      providerExecutionAvailable: false,
      latestCampaign: null
    }
  });

  const anomalies = getAnomaliesSnapshot(snapshot);

  // Should have SOCIAL_AUTOMATION_OFF in expected_conditions (INFO / EXPECTED - NOT an alarm)
  const autoOffAnom = anomalies.expected_conditions.find((a) => a.anomaly_type === 'SOCIAL_AUTOMATION_OFF');
  assert.ok(autoOffAnom, 'SOCIAL_AUTOMATION_OFF expected condition must be recorded');
  assert.equal(autoOffAnom.severity, 'INFO');
  assert.equal(autoOffAnom.state, 'EXPECTED');
  assert.equal(autoOffAnom.expected_condition, true);

  // Should have SOCIAL_CAMPAIGN_BLOCKED in active_anomalies (WARNING / OPEN) assigned to Maya
  const blockedAnom = anomalies.active_anomalies.find((a) => a.anomaly_type === 'SOCIAL_CAMPAIGN_BLOCKED');
  assert.ok(blockedAnom, 'SOCIAL_CAMPAIGN_BLOCKED anomaly must be detected in active_anomalies');
  assert.equal(blockedAnom.severity, 'WARNING');
  assert.equal(blockedAnom.responsible_agent_id, 'social_distribution_operator', 'Must be assigned to Maya');
  assert.equal(blockedAnom.state, 'OPEN');

  // Verify capability anomaly routing
  const route = routeAnomalyByCapability('SOCIAL_CAMPAIGN_BLOCKED');
  assert.equal(route.department_id, 'social');
  assert.equal(route.responsible_agent_id, 'social_distribution_operator');

  console.log('✓ [PASS] 14. Anomaly detection & escalation for blocked social campaigns verified');
}

// ----------------------------------------------------------------------------
// Test 15: Clean Deactivation & Baseline Restoration
// ----------------------------------------------------------------------------
{
  deactivateSocialDepartmentShadow();

  const dept = getDepartmentDefinition('social');
  assert.equal(dept.availability, 'NOT_AVAILABLE');
  assert.equal(dept.is_staffed, false);

  const staff = getStaffDefinitionByAgentId('social_distribution_operator');
  assert.equal(staff, null, 'Maya must no longer be in staff registry');

  console.log('✓ [PASS] 15. Dynamic deactivation restores canonical baseline cleanly');
}

console.log('======================================================');
console.log('ALL 15 SOCIAL MISSION CONTROL TESTS PASSED CLEANLY! (SOCIAL-S2)');
console.log('======================================================');
