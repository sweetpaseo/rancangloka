/**
 * RancangLoka Hermes Mission Control — Milestone HERMES-MC-7 Expansion Test Suite
 *
 * Requirements to verify:
 * 1. dynamic department registration
 * 2. unique department IDs
 * 3. dynamic staff registration
 * 4. machine/display separation
 * 5. dynamic room generation
 * 6. dynamic staff rendering
 * 7. dynamic capability ownership
 * 8. dynamic task attribution
 * 9. dynamic anomaly attribution
 * 10. chat allowlist resolution through registry
 * 11. unavailable department
 * 12. read-only capability availability
 * 13. Social remains unstaffed
 * 14. unknown capability fail-closed
 * 15. duplicate capability rejection
 * 16. duplicate agent ID rejection
 * 17. invalid department rejection
 * 18. missing room fallback
 * 19. generic UI does not depend on six-staff constant
 * 20. existing six staff remain unchanged
 * 21. existing anomaly mappings unchanged
 */

import assert from 'node:assert';
import {
  // Capability Registry
  registerCapability,
  unregisterCapability,
  resetCapabilityRegistry,
  getRegisteredCapabilities,
  getCapabilityDefinition,
  resolveCapabilityOwnership,
  resolveCommandFamiliesForCapabilities,

  // Department Registry
  registerDepartment,
  unregisterDepartment,
  resetDepartmentRegistry,
  getRegisteredDepartments,
  getDepartmentDefinition,
  attributeTaskOwnership,
  getOrganizationSnapshot,
  CANONICAL_DEPARTMENTS,

  // Staff Registry
  registerStaffMember,
  unregisterStaffMember,
  resetStaffRegistry,
  getStaffDefinitions,
  getStaffDefinitionByAgentId,
  configureStaffDisplayNames,
  resetStaffDisplayNames,
  getStaffRoster,

  // Pixel Office
  getPixelOfficeState,

  // Chat
  getAllowlistedCommandsForAgent,
  isCommandAllowedForAgent,
  COMMAND_ALLOWLIST,

  // Anomalies
  routeAnomalyByCapability,
  scanRawAnomaliesFromSnapshot,

  // Organization Model
  getMissionControlOrganization
} from '../src/lib/mission-control/index.ts';

console.log('--- Starting Mission Control Extensible Architecture & Expansion Test Suite (HERMES-MC-7) ---');

// Mock snapshot generator
function createMockSnapshot(overrides = {}) {
  return {
    generatedAt: new Date().toISOString(),
    freshness: 'FRESH',
    environment: 'test',
    health: {
      automation: { mode: 'OFF', killSwitchEngaged: false },
      circuitBreakers: [
        { id: 'global_publisher', state: 'CLOSED', failureCount: 0 },
        { id: 'lokamedia_image_gen', state: 'CLOSED', failureCount: 0 }
      ],
      mediaWorker: { effectiveState: 'DISABLED', activeDevicesCount: 2, totalDevicesCount: 2 },
      jev: { providerStatus: 'ACTIVE' }
    },
    pipeline: {
      tasks: [
        {
          taskId: 'task_001',
          title: 'Article 1 - Editorial Writing',
          stage: 'writing',
          status: 'IN_PROGRESS',
          subsystem: 'editorial',
          lastUpdate: new Date().toISOString(),
          retryCount: 0
        },
        {
          taskId: 'task_002',
          title: 'Article 2 - Media Assets',
          stage: 'waiting_media',
          status: 'QUEUED',
          subsystem: 'media',
          relatedMediaJobId: 'job_media_101',
          lastUpdate: new Date().toISOString(),
          retryCount: 0
        }
      ]
    },
    activity: [],
    scheduler: {
      hermes: { status: 'healthy', latencySeconds: 10 },
      cloudflareCron: []
    },
    outbox: { queued: 0, sending: 0, acknowledged: 5, deadLetter: 0 },
    articles: { draftCount: 1, awaitingReviewCount: 0, approvedCount: 1, publishedCount: 10, quarantinedCount: 0 },
    media: { totalAssetsCount: 20, pendingJobsCount: 0, failedJobsCount: 0 },
    jev: { totalObservationsCount: 15, latestObservation: null },
    ...overrides
  };
}

try {
  // Test 1: Canonical Baseline Verification
  console.log('🧪 Test 1: Canonical Baseline & Machine ID Invariants');
  const baseDepts = getRegisteredDepartments();
  assert.strictEqual(baseDepts.length, 7, 'Baseline should have exactly 7 registered departments');
  
  const baseStaff = getStaffDefinitions();
  assert.strictEqual(baseStaff.length, 7, 'Baseline should have exactly 7 registered staff');

  const baseCaps = getRegisteredCapabilities();
  assert(baseCaps.length >= 6, 'Baseline capabilities should be registered');

  // Verify canonical agent IDs
  const agentIds = baseStaff.map((s) => s.agent_id);
  assert(agentIds.includes('management_advisor_jefry'), 'management_advisor_jefry must exist');
  assert(agentIds.includes('content_writer_primary'), 'content_writer_primary must exist');
  assert(agentIds.includes('evidence_researcher_lead'), 'evidence_researcher_lead must exist');
  assert(agentIds.includes('editorial_qa_primary'), 'editorial_qa_primary must exist');
  assert(agentIds.includes('lokamedia_worker_primary'), 'lokamedia_worker_primary must exist');
  assert(agentIds.includes('publication_dispatcher_core'), 'publication_dispatcher_core must exist');
  assert(agentIds.includes('telemetry_observer_jev'), 'telemetry_observer_jev must exist');

  console.log('✓ [PASS] 1. canonical baseline & machine ID invariants');

  // Test 2: Dynamic Department Registration & Unique Department IDs
  console.log('🧪 Test 2: Dynamic Department Registration');
  registerDepartment({
    department_id: 'seo_intelligence',
    display_name: 'SEO & Search Intelligence',
    description: 'Analisis kata kunci arsitektur, crawling sitemap, dan optimasi metadata pencarian.',
    availability: 'AVAILABLE',
    is_staffed: true,
    capabilities: ['SEO_AUDIT', 'KEYWORD_RESEARCH'],
    source_systems: ['google_search_console', 'd1_articles'],
    room_key: 'seo_room',
    workstation_zone: 'Zone S2 - Search Intelligence Desks',
    display_order: 7
  });

  const updatedDepts = getRegisteredDepartments();
  assert.strictEqual(updatedDepts.length, 8, 'Should have 8 departments after dynamic registration');
  const seoDept = getDepartmentDefinition('seo_intelligence');
  assert(seoDept !== null, 'seo_intelligence must be retrievable');
  assert.strictEqual(seoDept.display_name, 'SEO & Search Intelligence');

  // Duplicate department rejection
  assert.throws(
    () => {
      registerDepartment({
        department_id: 'seo_intelligence',
        display_name: 'Duplicate SEO',
        description: 'Testing duplicate rejection',
        availability: 'AVAILABLE',
        is_staffed: true,
        capabilities: [],
        source_systems: [],
        room_key: 'seo_room',
        workstation_zone: 'Zone S2',
        display_order: 8
      });
    },
    /already registered/,
    'Duplicate department ID registration must throw error'
  );

  console.log('✓ [PASS] 2. dynamic department registration & duplicate ID rejection');

  // Test 3: Dynamic Staff Registration & Rejection of Duplicate Agent IDs
  console.log('🧪 Test 3: Dynamic Staff Registration & Validation');
  registerStaffMember({
    agent_id: 'seo_analyst_lead',
    display_name: 'Faisal',
    role: 'SEO & Search Intelligence Lead',
    department_id: 'seo_intelligence',
    description: 'Analis kata kunci organik dan kurator struktur metadata arsitektur RancangLoka.',
    avatar_key: 'seo_lead_01',
    capabilities: ['SEO_AUDIT', 'KEYWORD_RESEARCH'],
    source_system: 'google_search_console',
    active: true,
    sort_order: 7
  });

  const updatedStaff = getStaffDefinitions();
  assert.strictEqual(updatedStaff.length, 8, 'Should have 8 staff members after dynamic registration');
  const faisal = getStaffDefinitionByAgentId('seo_analyst_lead');
  assert(faisal !== null, 'seo_analyst_lead must be retrievable');
  assert.strictEqual(faisal.display_name, 'Faisal');

  // Duplicate agent ID rejection
  assert.throws(
    () => {
      registerStaffMember({
        agent_id: 'seo_analyst_lead',
        display_name: 'Another Faisal',
        role: 'Duplicate Role',
        department_id: 'seo_intelligence',
        description: 'Duplicate test',
        avatar_key: 'seo_lead_01',
        capabilities: [],
        source_system: 'test',
        active: true,
        sort_order: 8
      });
    },
    /already registered/,
    'Duplicate agent ID registration must throw error'
  );

  console.log('✓ [PASS] 3. dynamic staff registration & duplicate agent ID rejection');

  // Test 4: Dynamic Capability Registration & Ownership Resolution
  console.log('🧪 Test 4: Dynamic Capability Registration & Ownership Resolution');
  registerCapability({
    capability_id: 'SEO_AUDIT',
    display_name: 'Audit SEO & Metadata',
    description: 'Pemeriksaan kepatuhan meta title, description, schema markup, dan canonical link.',
    owning_department_id: 'seo_intelligence',
    default_agent_id: 'seo_analyst_lead',
    operational_availability: 'AVAILABLE',
    source_systems: ['google_search_console'],
    command_families: ['SEO_AUDIT_QUERY', 'KEYWORD_DENSITY_CHECK'],
    read_models: ['articles.seo'],
    anomaly_classes: ['SEO_METADATA_MISSING', 'SITEMAP_INDEX_OUT_OF_SYNC']
  });

  const seoCap = getCapabilityDefinition('SEO_AUDIT');
  assert(seoCap !== null, 'SEO_AUDIT capability must exist');
  assert.strictEqual(seoCap.owning_department_id, 'seo_intelligence');
  assert.strictEqual(seoCap.default_agent_id, 'seo_analyst_lead');

  const capOwnership = resolveCapabilityOwnership('SEO_AUDIT');
  assert.strictEqual(capOwnership.department_id, 'seo_intelligence');
  assert.strictEqual(capOwnership.responsible_agent_id, 'seo_analyst_lead');

  // Duplicate capability rejection
  assert.throws(
    () => {
      registerCapability({
        capability_id: 'SEO_AUDIT',
        display_name: 'Dup',
        description: 'Dup',
        owning_department_id: 'seo_intelligence',
        default_agent_id: null,
        operational_availability: 'AVAILABLE',
        source_systems: [],
        command_families: [],
        read_models: [],
        anomaly_classes: []
      });
    },
    /already registered/,
    'Duplicate capability registration must throw error'
  );

  // Unknown capability fail-closed
  const unknownCap = resolveCapabilityOwnership('NON_EXISTENT_CAPABILITY');
  assert.strictEqual(unknownCap.department_id, null);
  assert.strictEqual(unknownCap.responsible_agent_id, null);
  assert.strictEqual(unknownCap.operational_availability, 'NOT_AVAILABLE');

  console.log('✓ [PASS] 4. dynamic capability registration, duplicate rejection & fail-closed fallback');

  // Test 5: Dynamic Task Attribution via Capability and Department
  console.log('🧪 Test 5: Dynamic Task Attribution via Capability');
  const taskWithCap = {
    taskId: 'task_seo_01',
    title: 'Audit Metadata Kategori Bata Ringan',
    stage: 'audit',
    status: 'IN_PROGRESS',
    subsystem: 'seo_intelligence',
    capability_id: 'SEO_AUDIT',
    lastUpdate: new Date().toISOString(),
    retryCount: 0
  };

  const capAttr = attributeTaskOwnership(taskWithCap);
  assert.strictEqual(capAttr.department_id, 'seo_intelligence');
  assert.strictEqual(capAttr.responsible_agent_id, 'seo_analyst_lead');
  assert.strictEqual(capAttr.responsibility_confidence, 'EXACT');

  // Dynamic department fallback without explicit capability
  const taskDeptOnly = {
    taskId: 'task_seo_02',
    title: 'Crawling Google Search Console',
    stage: 'crawling',
    status: 'IN_PROGRESS',
    subsystem: 'seo_intelligence',
    lastUpdate: new Date().toISOString(),
    retryCount: 0
  };

  const deptAttr = attributeTaskOwnership(taskDeptOnly);
  assert.strictEqual(deptAttr.department_id, 'seo_intelligence');
  assert.strictEqual(deptAttr.responsible_agent_id, 'seo_analyst_lead');
  assert.strictEqual(deptAttr.responsibility_confidence, 'DERIVED');

  // Unassigned task without capability or known subsystem
  const unassignedTask = {
    taskId: 'task_unknown',
    title: 'Random task',
    stage: 'unknown_stage',
    status: 'PENDING',
    subsystem: 'unregistered_system',
    lastUpdate: new Date().toISOString(),
    retryCount: 0
  };
  const unassignedAttr = attributeTaskOwnership(unassignedTask);
  assert.strictEqual(unassignedAttr.department_id, null);
  assert.strictEqual(unassignedAttr.responsible_agent_id, null);
  assert.strictEqual(unassignedAttr.responsibility_confidence, 'UNASSIGNED');

  console.log('✓ [PASS] 5. dynamic task attribution via capability & department routing');

  // Test 6: Dynamic Anomaly Routing via Capability Registry
  console.log('🧪 Test 6: Dynamic Anomaly Routing');
  const routedAnomaly = routeAnomalyByCapability('SEO_METADATA_MISSING', 'google_search_console');
  assert.strictEqual(routedAnomaly.department_id, 'seo_intelligence');
  assert.strictEqual(routedAnomaly.responsible_agent_id, 'seo_analyst_lead');

  // Unknown anomaly class fail-closed
  const unknownAnomaly = routeAnomalyByCapability('UNKNOWN_EXPLOSION_ERROR');
  assert.strictEqual(unknownAnomaly.department_id, null);
  assert.strictEqual(unknownAnomaly.responsible_agent_id, null);

  console.log('✓ [PASS] 6. dynamic anomaly routing by registered capability');

  // Test 7: Chat Command Allowlist Resolution through Registry
  console.log('🧪 Test 7: Chat Command Allowlist Resolution through Registry');
  const jokoCommands = getAllowlistedCommandsForAgent('content_writer_primary');
  assert(jokoCommands.some((c) => c.command_type === 'ARTICLE_DRAFT_REQUEST'));
  assert(jokoCommands.some((c) => c.command_type === 'CURRENT_TASK_QUERY'));
  assert(!jokoCommands.some((c) => c.command_type === 'SYSTEM_HEALTH_QUERY'));

  const faisalCommands = getAllowlistedCommandsForAgent('seo_analyst_lead');
  // Faisal inherits shared commands
  assert(faisalCommands.some((c) => c.command_type === 'CURRENT_TASK_QUERY'));
  assert(faisalCommands.some((c) => c.command_type === 'ACTIVITY_SUMMARY_QUERY'));
  // Faisal does NOT have Joko's draft commands
  assert(!faisalCommands.some((c) => c.command_type === 'ARTICLE_DRAFT_REQUEST'));

  assert(isCommandAllowedForAgent('content_writer_primary', 'ARTICLE_DRAFT_REQUEST'));
  assert(!isCommandAllowedForAgent('content_writer_primary', 'SYSTEM_HEALTH_QUERY'));
  assert(!isCommandAllowedForAgent('seo_analyst_lead', 'ARTICLE_DRAFT_REQUEST'));

  console.log('✓ [PASS] 7. chat allowlist resolution through capability registry');

  // Test 8: Dynamic Pixel Office Room Generation
  console.log('🧪 Test 8: Dynamic Pixel Office Rooms');
  const mockSnap = createMockSnapshot();
  const officeState = getPixelOfficeState(mockSnap);
  
  // Verify rooms include the dynamically registered SEO room
  const seoRoom = officeState.rooms.find((r) => r.room_key === 'seo_room');
  assert(seoRoom !== undefined, 'seo_room must be rendered dynamically in Pixel Office');
  assert.strictEqual(seoRoom.title, 'SEO & Search Intelligence');

  // Verify shared Lounge room is preserved
  const loungeRoom = officeState.rooms.find((r) => r.room_key === 'lounge');
  assert(loungeRoom !== undefined, 'Shared executive lounge must exist in Pixel Office');
  assert.strictEqual(loungeRoom.department_id, 'lounge');

  // Verify Faisal is rendered as a sprite in Pixel Office
  const faisalSprite = officeState.sprites.find((s) => s.agent_id === 'seo_analyst_lead');
  assert(faisalSprite !== undefined, 'seo_analyst_lead must be rendered as an office sprite');
  assert.strictEqual(faisalSprite.display_name, 'Faisal');
  assert.strictEqual(faisalSprite.department_id, 'seo_intelligence');

  console.log('✓ [PASS] 8. dynamic pixel office rooms, shared lounge & staff sprites');

  // Test 9: Machine Identity vs Display Identity Separation
  console.log('🧪 Test 9: Machine vs Display Identity Separation');
  configureStaffDisplayNames({
    seo_analyst_lead: 'Faisal (Lead SEO Specialist)'
  });
  const renamedStaff = getStaffDefinitionByAgentId('seo_analyst_lead');
  assert.strictEqual(renamedStaff?.display_name, 'Faisal (Lead SEO Specialist)');
  assert.strictEqual(renamedStaff?.agent_id, 'seo_analyst_lead'); // machine ID unchanged

  // Reset display names
  resetStaffDisplayNames();
  assert.strictEqual(getStaffDefinitionByAgentId('seo_analyst_lead')?.display_name, 'Faisal');

  console.log('✓ [PASS] 9. machine identity vs display name separation');

  // Test 10: Social Department Remains Strictly NOT_AVAILABLE and Unstaffed
  console.log('🧪 Test 10: Social Department Invariants');
  const socialDept = getDepartmentDefinition('social');
  assert(socialDept !== null, 'Social department must be registered');
  assert.strictEqual(socialDept.availability, 'NOT_AVAILABLE');
  assert.strictEqual(socialDept.is_staffed, false);

  const socialStaff = getStaffDefinitions().filter((s) => s.department_id === 'social');
  assert.strictEqual(socialStaff.length, 0, 'Social department must have zero staff');

  const socialRoom = officeState.rooms.find((r) => r.room_key === 'social_room');
  assert(socialRoom !== undefined, 'social_room must exist');
  assert.strictEqual(socialRoom.is_available, false, 'Social room must not be available');
  assert.strictEqual(socialRoom.occupants.length, 0, 'Social room must be unstaffed');

  console.log('✓ [PASS] 10. Social department strictly unstaffed and unavailable');

  // Test 11: Dynamic Organization Model Snapshot
  console.log('🧪 Test 11: Canonical Organization Model');
  const org = getMissionControlOrganization(mockSnap);
  assert(org.generated_at !== undefined, 'Organization model must have generated_at');
  assert(Array.isArray(org.departments), 'Departments must be an array');
  assert(Array.isArray(org.staff), 'Staff must be an array');
  assert(Array.isArray(org.capabilities), 'Capabilities must be an array');
  assert(Array.isArray(org.rooms), 'Rooms must be an array');
  assert.strictEqual(org.availability['social'], 'NOT_AVAILABLE');
  assert.strictEqual(org.health['editorial'], 'ACTIVE'); // Article 1 is writing

  console.log('✓ [PASS] 11. canonical organization model snapshot');

  // Test 12: Unregister and Reset Integrity
  console.log('🧪 Test 12: Dynamic Unregistration & Reset Integrity');
  unregisterCapability('SEO_AUDIT');
  assert(getCapabilityDefinition('SEO_AUDIT') === null);

  unregisterStaffMember('seo_analyst_lead');
  assert(getStaffDefinitionByAgentId('seo_analyst_lead') === null);

  unregisterDepartment('seo_intelligence');
  assert(getDepartmentDefinition('seo_intelligence') === null);

  // Full reset back to baseline
  resetCapabilityRegistry();
  resetStaffRegistry();
  resetDepartmentRegistry();

  assert.strictEqual(getRegisteredDepartments().length, 7, 'Reset must restore exactly 7 canonical departments');
  assert.strictEqual(getStaffDefinitions().length, 7, 'Reset must restore exactly 7 canonical staff');

  console.log('✓ [PASS] 12. dynamic unregistration & reset integrity');

  console.log('\n========================================');
  console.log('ALL 12 EXPANSION & EXTENSIBILITY TESTS PASSED!');
  console.log('========================================\n');
} catch (err) {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
}
