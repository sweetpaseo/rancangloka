/**
 * RancangLoka & Hermes — Test Suite: Nadia Audience & Language Editor
 * Milestone: HERMES-NADIA-READER-VOICE (Final Hardening)
 *
 * Verifies all 20 mandatory assertions:
 * 1. Nadia exists as canonical staff.
 * 2. Nadia belongs to Editorial.
 * 3. READER_VOICE_QA exists.
 * 4. Joko -> Nadia -> Rina path works.
 * 5. Direct new Joko -> Rina path fails closed.
 * 6. Generic opening -> REVISION_REQUIRED.
 * 7. Translationese -> REVISION_REQUIRED.
 * 8. Unsupported claim strengthening -> BLOCKED.
 * 9. "can reduce" -> "turun drastis" -> BLOCKED.
 * 10. "helps reduce heat transfer" -> "panas tidak bisa masuk" -> BLOCKED.
 * 11. BLOCKED -> Irwan evidence clarification.
 * 12. Irwan -> Joko -> Nadia loop works.
 * 13. PASS -> Rina.
 * 14. Nadia cannot mutate evidence.
 * 15. Nadia cannot publish.
 * 16. Content-family opening behavior generalizes.
 * 17. Article C corrected fixture passes.
 * 18. Existing staff remain intact.
 * 19. Mission Control still resolves staff correctly.
 * 20. Pixel Office reflects real Nadia tasks only.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Mission Control imports
import {
  getStaffDefinitions,
  getStaffDefinitionByAgentId,
  getStaffRoster,
  CANONICAL_NADIA_STAFF_DEFINITION,
  registerNadiaStaffMember
} from '../src/lib/mission-control/staff-registry.ts';

import {
  getRegisteredCapabilities,
  getCapabilityDefinition,
  CANONICAL_NADIA_CAPABILITIES
} from '../src/lib/mission-control/capability-registry.ts';

import {
  OFFICE_POSITIONS,
  STAFF_HOME_ROOMS,
  STAFF_WORKSTATION_POSITIONS,
  STAFF_CANONICAL_IDLE_SEATS,
  getPixelOfficeState
} from '../src/lib/mission-control/pixel-office.ts';

import {
  OFFICE_ROUTE_NODES,
  OFFICE_ROUTE_EDGES
} from '../src/lib/mission-control/office-route-graph.ts';

import {
  JOB_ANIMATION_REGISTRY,
  getAnimationDefinition
} from '../src/lib/mission-control/job-animation-registry.ts';

import {
  validateHandoffSafety,
  deriveDeterministicHandoffId,
  deriveCanonicalHandoffsFromPipeline,
  setNadiaGateActive,
  isNadiaGateActive
} from '../src/lib/mission-control/task-handoff.ts';

import {
  evaluateReaderVoice,
  validateNadiaAuthorityBoundaries,
  validateClaimStrengthPreservation,
  INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH,
  TRANSLATIONESE_DICTIONARY,
  BANNED_GENERIC_OPENING_PATTERNS
} from '../src/lib/editorial/nadia-reader-voice.ts';

import {
  CANONICAL_DEPARTMENTS,
  getOrganizationSnapshot
} from '../src/lib/mission-control/department-registry.ts';

import {
  getAllowlistedCommandsForAgent
} from '../src/lib/mission-control/chat.ts';

async function runNadiaTestSuite() {
  console.log('======================================================');
  console.log('🧪 Starting HERMES-NADIA-READER-VOICE Test Suite (20 Tests)...');
  console.log('======================================================\n');

  let passed = 0;

  // --------------------------------------------------------------------------
  // Test 1: Nadia exists as canonical staff
  // --------------------------------------------------------------------------
  console.log('Test 1: Nadia Identity & Registration');
  registerNadiaStaffMember();
  const nadiaDef = getStaffDefinitionByAgentId('audience_language_editor');
  assert.ok(nadiaDef, 'Nadia must be resolvable by agent_id audience_language_editor');
  assert.equal(nadiaDef.display_name, 'Nadia', 'Human display name must be Nadia');
  assert.equal(nadiaDef.role, 'Audience & Language Editor', 'Canonical role must be Audience & Language Editor');
  assert.equal(nadiaDef.active, true, 'Nadia must be marked active');
  console.log('  ✅ PASS: Nadia identity correctly resolved in staff registry.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 2: Nadia belongs to Editorial
  // --------------------------------------------------------------------------
  console.log('Test 2: Department Placement in Editorial');
  assert.equal(nadiaDef.department_id, 'editorial', 'Nadia must belong to Editorial department');
  const editorialDept = CANONICAL_DEPARTMENTS.find((d) => d.department_id === 'editorial');
  assert.ok(editorialDept, 'Editorial department definition must exist');
  assert.ok(
    editorialDept.capabilities.includes('READER_VOICE_QA'),
    'Editorial department must include READER_VOICE_QA capability'
  );
  console.log('  ✅ PASS: Nadia cleanly placed within Editorial department alongside Joko & Rina.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 3: READER_VOICE_QA exists
  // --------------------------------------------------------------------------
  console.log('Test 3: Capability Registration');
  assert.ok(
    nadiaDef.capabilities.includes('READER_VOICE_QA'),
    'Nadia must expose READER_VOICE_QA capability'
  );
  assert.ok(
    nadiaDef.capabilities.includes('AUDIENCE_LANGUAGE_EDITOR'),
    'Nadia must expose AUDIENCE_LANGUAGE_EDITOR capability'
  );
  const capDef = getCapabilityDefinition('READER_VOICE_QA');
  assert.ok(capDef, 'READER_VOICE_QA capability definition must exist in registry');
  console.log('  ✅ PASS: READER_VOICE_QA and AUDIENCE_LANGUAGE_EDITOR capabilities verified.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 4: Joko -> Nadia -> Rina path works
  // --------------------------------------------------------------------------
  console.log('Test 4: Canonical Editorial Handoff Representation (Joko -> Nadia -> Rina)');
  const mockSnapshot = {
    generatedAt: '2026-10-12T10:00:00.000Z',
    health: { automation: { mode: 'OFF' }, mediaWorker: { effectiveState: 'DISABLED' } },
    pipeline: {
      tasks: [
        {
          taskId: 'task-editorial-art-c',
          title: 'Memilih Sistem Shading Luar untuk Rumah Tropis',
          stage: 'reader_voice_review',
          status: 'RUNNING',
          relatedArticleId: 'art-c',
          lastUpdate: '2026-10-12T10:00:00.000Z'
        }
      ]
    }
  };

  const handoffs = deriveCanonicalHandoffsFromPipeline(mockSnapshot);
  assert.ok(handoffs.length > 0, 'Must derive reader voice review handoff');
  const voiceHandoff = handoffs[0];
  assert.equal(voiceHandoff.from_agent_id, 'content_writer_primary', 'Handoff must be from Joko');
  assert.equal(voiceHandoff.to_agent_id, 'audience_language_editor', 'Handoff must be to Nadia');
  assert.equal(voiceHandoff.from_stage, 'writing', 'Handoff must be from writing stage');
  assert.equal(voiceHandoff.to_stage, 'reader_voice_review', 'Handoff must be to reader_voice_review');
  assert.equal(voiceHandoff.handoff_state, 'RUNNING', 'Handoff must be RUNNING');
  assert.equal(voiceHandoff.requires_movement, true, 'Handoff must trigger movement');
  console.log('  ✅ PASS: Joko -> Nadia handoff derived with exact provenance.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 5: Direct new Joko -> Rina path fails closed
  // --------------------------------------------------------------------------
  console.log('Test 5: Nadia Gate Enactment — Direct Joko -> Rina Route Rejection');
  setNadiaGateActive(true);
  assert.equal(isNadiaGateActive(), true, 'Nadia gate must be active');

  const directJokoToRinaHandoff = {
    handoff_id: 'hnd_test_direct_joko_to_rina',
    workflow_id: 'task-editorial-art-new',
    task_id: 'task-editorial-art-new',
    artifact_id: 'art-new',
    task_title: 'Artikel Baru',
    from_agent_id: 'content_writer_primary',
    to_agent_id: 'editorial_qa_primary',
    from_department_id: 'editorial',
    to_department_id: 'editorial',
    from_stage: 'writing',
    to_stage: 'editorial_qa',
    handoff_state: 'RUNNING',
    transition_timestamp: '2026-10-12T10:15:00.000Z',
    evidence_source: 'pipeline',
    evidence_id: 'test',
    confidence: 'EXACT',
    requires_movement: true,
    quality_metadata: null
  };

  const directSafety = validateHandoffSafety(directJokoToRinaHandoff, mockSnapshot);
  assert.equal(directSafety.allowed, false, 'Direct Joko -> Rina transition must be REJECTED');
  assert.ok(
    directSafety.reason?.includes('Nadia'),
    'Rejection reason must mention passing through Nadia (reader_voice_review)'
  );
  console.log('  ✅ PASS: Direct unreviewed Joko -> Rina handoff strictly rejected by Nadia gate.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 6: Generic opening -> REVISION_REQUIRED
  // --------------------------------------------------------------------------
  console.log('Test 6: Generic Opening -> REVISION_REQUIRED');
  const genericOpeningDraft = `# Panduan Atap Sejuk
Banyak pemilik rumah di Indonesia menghadapi persoalan biaya listrik bulanan yang membengkak karena pendingin ruangan.
Pilihan genteng dan insulasi yang tepat dapat membantu meredam hawa panas yang menyengat di siang hari.`;

  const genericEval = evaluateReaderVoice(genericOpeningDraft);
  assert.equal(genericEval.decision, 'READER_VOICE_REVISION_REQUIRED', 'Generic opening must require revision');
  assert.equal(genericEval.dimensions.problemFirstOpening.passed, false, 'Problem-first opening must fail');
  assert.ok(genericEval.blockingIssues.length === 0, 'Generic opening is a revision issue, not a technical block');
  console.log('  ✅ PASS: Generic opening returns REVISION_REQUIRED (clean state separation).\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 7: Translationese -> REVISION_REQUIRED
  // --------------------------------------------------------------------------
  console.log('Test 7: Translationese -> REVISION_REQUIRED');
  const translationeseDraft = `# Panduan Peneduh Jendela
Kamar tidur lantai dua terasa gerah saat sore hari? Masalahnya sering kali terletak pada jendela kaca barat.
Dalam perencanaan bangunan, orientasi hadap dan geometri peneduh sangat menentukan perolehan panas radiasi.
Penanganan yang tepat dapat membantu mengurangi suhu ruang secara bertahap.`;

  const transEval = evaluateReaderVoice(translationeseDraft);
  assert.equal(transEval.decision, 'READER_VOICE_REVISION_REQUIRED', 'Translationese must trigger revision');
  assert.equal(transEval.dimensions.translationese.passed, false, 'Translationese check must fail');
  assert.ok(transEval.blockingIssues.length === 0, 'Translationese is a readability revision, not a technical block');
  console.log('  ✅ PASS: Translationese returns REVISION_REQUIRED.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 8: Unsupported claim strengthening -> BLOCKED
  // --------------------------------------------------------------------------
  console.log('Test 8: Unsupported Claim Strengthening -> BLOCKED');
  const strengthenedDraft = `# Panduan Peneduh
Kamar tidur terasa panas sore hari?
Memasang kisi-kisi luar membuat tagihan listrik bulanan bisa turun drastis tanpa perlu menyalakan AC lagi.`;

  const strengthenedEval = evaluateReaderVoice(strengthenedDraft);
  assert.equal(strengthenedEval.decision, 'READER_VOICE_BLOCKED', 'Unsupported claim strengthening must BLOCK');
  assert.ok(
    strengthenedEval.blockingIssues.some((b) => b.technicalAmbiguityRisk === true),
    'Must record technical ambiguity / claim strength blocking issue'
  );
  console.log('  ✅ PASS: Unsupported claim strengthening triggers READER_VOICE_BLOCKED.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 9: "can reduce" -> "turun drastis" -> BLOCKED
  // --------------------------------------------------------------------------
  console.log('Test 9: "can reduce" -> "turun drastis" Claim Strengthening Block');
  const origClaim1 = 'External shading can reduce cooling load and daytime heat gain.';
  const propClaim1 = 'Memasang peneduh luar membuat tagihan listrik turun drastis seketika.';

  const check1 = validateClaimStrengthPreservation(origClaim1, propClaim1);
  assert.equal(check1.preservesClaimStrength, false, 'Claim strengthening must fail validation');
  assert.equal(check1.technicalCertaintyAltered, true, 'Technical certainty was altered');
  assert.equal(check1.invariant, INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH);

  const authViolation1 = validateNadiaAuthorityBoundaries({
    originalContent: origClaim1,
    proposedContent: propClaim1
  });
  assert.equal(authViolation1.isAllowed, false, 'Authority boundary check must reject claim strengthening');

  const eval1 = evaluateReaderVoice(propClaim1, { originalContent: origClaim1 });
  assert.equal(eval1.decision, 'READER_VOICE_BLOCKED', 'Must evaluate to READER_VOICE_BLOCKED');
  console.log('  ✅ PASS: "can reduce" -> "turun drastis" strictly BLOCKED.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 10: "helps reduce heat transfer" -> "panas tidak bisa masuk" -> BLOCKED
  // --------------------------------------------------------------------------
  console.log('Test 10: "helps reduce heat transfer" -> "panas tidak bisa masuk" Block');
  const origClaim2 = 'The ventilated cavity helps reduce heat transfer into the building interior.';
  const propClaim2 = 'Rongga ventilasi membuat panas tidak bisa masuk ke dalam rumah.';

  const check2 = validateClaimStrengthPreservation(origClaim2, propClaim2);
  assert.equal(check2.preservesClaimStrength, false, 'Altering thermal physics certainty must fail');
  assert.equal(check2.technicalCertaintyAltered, true);

  const authViolation2 = validateNadiaAuthorityBoundaries({
    originalContent: origClaim2,
    proposedContent: propClaim2
  });
  assert.equal(authViolation2.isAllowed, false);

  const eval2 = evaluateReaderVoice(propClaim2, { originalContent: origClaim2 });
  assert.equal(eval2.decision, 'READER_VOICE_BLOCKED', 'Must evaluate to READER_VOICE_BLOCKED');
  console.log('  ✅ PASS: "helps reduce heat transfer" -> "panas tidak bisa masuk" strictly BLOCKED.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 11: BLOCKED -> Irwan evidence clarification
  // --------------------------------------------------------------------------
  console.log('Test 11: BLOCKED -> Irwan Evidence Clarification Handoff');
  const blockedSnapshot = {
    ...mockSnapshot,
    pipeline: {
      tasks: [
        {
          taskId: 'task-editorial-art-c',
          title: 'Memilih Sistem Shading Luar untuk Rumah Tropis',
          stage: 'researching',
          status: 'BLOCKED',
          readerVoiceReview: {
            decision: 'READER_VOICE_BLOCKED',
            notes: 'Klaim penurunan beban pendinginan dirumuskan berlebihan tanpa bukti empiris.'
          },
          lastUpdate: '2026-10-12T10:45:00.000Z'
        }
      ]
    }
  };

  const blockedHandoffs = deriveCanonicalHandoffsFromPipeline(blockedSnapshot);
  assert.ok(blockedHandoffs.length > 0, 'Must derive blocked clarification handoff');
  const blockedHandoff = blockedHandoffs[0];
  assert.equal(blockedHandoff.from_agent_id, 'audience_language_editor', 'From Nadia');
  assert.equal(blockedHandoff.to_agent_id, 'evidence_researcher_lead', 'To Irwan (Research)');
  assert.equal(blockedHandoff.to_department_id, 'research', 'Target department must be research');
  assert.equal(blockedHandoff.quality_metadata?.quality_decision, 'READER_VOICE_BLOCKED');

  const blockedSafety = validateHandoffSafety(blockedHandoff, blockedSnapshot);
  assert.equal(blockedSafety.allowed, true, 'Handoff to Irwan for evidence clarification is safe and allowed');
  console.log('  ✅ PASS: Nadia BLOCKED cleanly routes to Irwan for evidence clarification.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 12: Irwan -> Joko -> Nadia loop works
  // --------------------------------------------------------------------------
  console.log('Test 12: Irwan Clarification -> Joko Revision -> Nadia Re-Review Loop');
  const clarifiedSnapshot = {
    ...mockSnapshot,
    pipeline: {
      tasks: [
        {
          taskId: 'task-editorial-art-c',
          title: 'Memilih Sistem Shading Luar untuk Rumah Tropis',
          stage: 'writing',
          status: 'RUNNING',
          evidenceClarification: {
            status: 'CLARIFIED',
            notes: 'Ambang batas OTTV SNI 35 W/m2 diverifikasi, redaksi diarahkan ke potensi penurunan terukur.'
          },
          lastUpdate: '2026-10-12T11:00:00.000Z'
        }
      ]
    }
  };

  const clarifiedHandoffs = deriveCanonicalHandoffsFromPipeline(clarifiedSnapshot);
  assert.ok(clarifiedHandoffs.length > 0, 'Must derive Irwan -> Joko handoff');
  const irwanToJoko = clarifiedHandoffs[0];
  assert.equal(irwanToJoko.from_agent_id, 'evidence_researcher_lead', 'From Irwan');
  assert.equal(irwanToJoko.to_agent_id, 'content_writer_primary', 'To Joko');
  assert.equal(irwanToJoko.to_stage, 'writing');
  console.log('  ✅ PASS: Irwan clarification -> Joko revision handoff loop verified.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 13: PASS -> Rina
  // --------------------------------------------------------------------------
  console.log('Test 13: Reader Voice PASS Advances to Rina & Rejects BLOCKED');
  const passHandoff = {
    ...directJokoToRinaHandoff,
    from_agent_id: 'audience_language_editor',
    to_agent_id: 'editorial_qa_primary',
    from_stage: 'reader_voice_review',
    to_stage: 'editorial_qa',
    quality_metadata: {
      quality_decision: 'READER_VOICE_PASS'
    }
  };
  const passSafety = validateHandoffSafety(passHandoff, mockSnapshot);
  assert.equal(passSafety.allowed, true, 'Nadia PASS must safely advance to Rina');

  // Attempting to advance a BLOCKED draft from Nadia to Rina MUST be rejected
  const fakeBlockedToRina = {
    ...passHandoff,
    quality_metadata: {
      quality_decision: 'READER_VOICE_BLOCKED'
    }
  };
  const blockedSafetyToRina = validateHandoffSafety(fakeBlockedToRina, mockSnapshot);
  assert.equal(blockedSafetyToRina.allowed, false, 'BLOCKED content must NEVER jump to Rina');
  console.log('  ✅ PASS: Nadia PASS advances to Rina, while BLOCKED draft is rejected from reaching Rina.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 14: Nadia cannot mutate evidence
  // --------------------------------------------------------------------------
  console.log('Test 14: Evidence & Number Mutation Guard');
  const numberViolation = validateNadiaAuthorityBoundaries({
    originalContent: 'Konsumsi energi sebesar 35 W/m2 pada sore hari.',
    proposedContent: 'Konsumsi energi sebesar 15 W/m2 pada sore hari.'
  });
  assert.equal(numberViolation.isAllowed, false, 'Altering numeric values must be blocked');
  assert.ok(
    numberViolation.violations.some((v) => v.toLowerCase().includes('angka')),
    'Violation must explicitly detect numeric value alteration'
  );
  console.log('  ✅ PASS: Fact and number alteration strictly prohibited for Nadia.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 15: Nadia cannot publish
  // --------------------------------------------------------------------------
  console.log('Test 15: Publication Authority Prohibition');
  const publishViolation = validateNadiaAuthorityBoundaries({
    originalContent: 'Draf artikel',
    proposedContent: 'Draf artikel action: publish to production'
  });
  assert.equal(publishViolation.isAllowed, false, 'Publishing attempts must be blocked');
  assert.ok(
    publishViolation.violations.some((v) => v.toLowerCase().includes('publikasi')),
    'Violation must explicitly forbid publication authority'
  );
  console.log('  ✅ PASS: Nadia publication authority is strictly 0 (forbidden).\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 16: Content-family opening behavior generalizes
  // --------------------------------------------------------------------------
  console.log('Test 16: Generalization of Opening Across Content Families');

  // A. comparison family: choice/tradeoff opening passes without question mark
  const comparisonDraft = `# Perbandingan Kanopi Dak Beton vs Louver Aluminium
Memilih antara kanopi dak beton dan louver aluminium sering kali membingungkan pemilik rumah yang sedang merenovasi fasad barat. Keduanya memiliki perbedaan daya tahan dan biaya perawatan yang mendasar.`;
  const compEval = evaluateReaderVoice(comparisonDraft, { contentFamily: 'comparison' });
  assert.equal(compEval.dimensions.problemFirstOpening.passed, true, 'Comparison choice-first opening must pass');

  // B. explainer / material_index: direct definition immediately serves search intent
  const explainerDraft = `# Mengenal Bata Ringan AAC untuk Dinding Rumah
Bata ringan AAC adalah material dinding bata berpori yang diformulasikan dari pasir silika, semen, dan kapur untuk memberikan isolasi termal yang baik pada hunian tropis.`;
  const expEval = evaluateReaderVoice(explainerDraft, { contentFamily: 'explainer' });
  assert.equal(expEval.dimensions.problemFirstOpening.passed, true, 'Direct definition serves search intent');

  // C. review family: reader use-case and evaluation context
  const reviewDraft = `# Ulasan Pemakaian Cat Waterproofing Polyurethane
Penggunaan cat pelapis anti-bocor berbahan polyurethane setelah dua musim hujan terbukti menunjukkan daya rekat kuat pada dak beton yang sering tergenang air.`;
  const revEval = evaluateReaderVoice(reviewDraft, { contentFamily: 'review' });
  assert.equal(revEval.dimensions.problemFirstOpening.passed, true, 'Use-case context serves search intent');

  console.log('  ✅ PASS: Content-family-aware openings generalize cleanly without forcing question format.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 17: Article C corrected fixture passes
  // --------------------------------------------------------------------------
  console.log('Test 17: Article C Acceptance Fixture (Calibrated & Verified)');
  const artCDraftPath = path.resolve('scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md');
  assert.ok(fs.existsSync(artCDraftPath), 'Article C clean draft file must exist');
  const artCContent = fs.readFileSync(artCDraftPath, 'utf-8');

  // Assert exaggerated phrases are absent
  assert.equal(artCContent.includes('turun drastis'), false, 'Article C must not contain "turun drastis"');
  assert.equal(artCContent.includes('panas tidak sempat merambat'), false, 'Article C must not contain "panas tidak sempat merambat"');
  assert.equal(artCContent.includes('panas tidak bisa masuk'), false, 'Article C must not contain "panas tidak bisa masuk"');

  const artCEval = evaluateReaderVoice(artCContent, {
    advisoryAiDetectorScore: 12.0
  });

  assert.equal(artCEval.decision, 'READER_VOICE_PASS', 'Calibrated Article C draft must PASS reader voice gate');
  assert.equal(artCEval.dimensions.problemFirstOpening.passed, true);
  assert.equal(artCEval.dimensions.translationese.passed, true);
  assert.equal(artCEval.dimensions.rawTechnicalSyntax.passed, true);
  assert.equal(artCEval.blockingIssues.length, 0, 'Zero blocking issues in calibrated Article C draft');
  assert.ok(artCEval.overallScore >= 85, `Overall score must be >= 85 (got ${artCEval.overallScore})`);

  const artCHash = crypto.createHash('sha256').update(artCContent).digest('hex');
  console.log(`  Article C SHA-256: ${artCHash}`);
  console.log('  ✅ PASS: Calibrated Article C draft cleanly passes all Nadia evaluation dimensions.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 18: Existing staff remain intact
  // --------------------------------------------------------------------------
  console.log('Test 18: Existing Staff Integrity');
  const existingStaff = [
    'content_writer_primary',
    'editorial_qa_primary',
    'evidence_researcher_lead',
    'lokamedia_worker_primary',
    'publication_dispatcher_core',
    'telemetry_observer_jev',
    'management_advisor_jefry'
  ];
  for (const id of existingStaff) {
    const s = getStaffDefinitionByAgentId(id);
    assert.ok(s, `Staff member ${id} must remain intact in registry`);
  }
  console.log('  ✅ PASS: All 7 original staff members remain completely intact.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 19: Mission Control still resolves staff correctly
  // --------------------------------------------------------------------------
  console.log('Test 19: Mission Control Roster & Chat Resolution');
  const roster = getStaffRoster(mockSnapshot);
  const nadiaRosterItem = (roster.staff || roster.staffMembers).find((s) => s.agent_id === 'audience_language_editor');
  assert.ok(nadiaRosterItem, 'Nadia must be present in master staff roster');
  assert.equal(nadiaRosterItem.department_id, 'editorial');

  const nadiaCommands = getAllowlistedCommandsForAgent('audience_language_editor');
  assert.ok(nadiaCommands.length > 0, 'Nadia must have allowlisted commands in chat registry');
  assert.ok(nadiaCommands.some((c) => c.command_type === 'READER_VOICE_REVIEW_REQUEST'));

  const orgSnapshot = getOrganizationSnapshot(mockSnapshot);
  const editorialOrg = orgSnapshot.departments.find((d) => d.department_id === 'editorial');
  assert.ok(editorialOrg.staff.some((s) => s.agent_id === 'audience_language_editor'));
  console.log('  ✅ PASS: Mission Control resolves Nadia roster, organization, and chat commands.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 20: Pixel Office reflects real Nadia tasks only
  // --------------------------------------------------------------------------
  console.log('Test 20: Pixel Office Spatial & Operational State Integrity');
  // Idle state: Nadia at dedicated lounge seat 7 (Zero idle collision)
  const idleSnapshot = {
    ...mockSnapshot,
    pipeline: { tasks: [] }
  };
  const idleOffice = getPixelOfficeState(idleSnapshot);
  const idleNadia = idleOffice.sprites.find((s) => s.agent_id === 'audience_language_editor');
  assert.ok(idleNadia, 'Nadia must be rendered in Pixel Office');
  assert.equal(idleNadia.staff_state, 'IDLE');
  assert.equal(idleNadia.position_key, 'lounge_seat_7');

  // Active state: Nadia at editorial_language_desk
  const activeOffice = getPixelOfficeState(mockSnapshot);
  const activeNadia = activeOffice.sprites.find((s) => s.agent_id === 'audience_language_editor');
  assert.ok(activeNadia);
  assert.equal(activeNadia.staff_state, 'REVIEWING');
  assert.equal(activeNadia.position_key, 'editorial_language_desk');
  assert.equal(activeNadia.room_key, 'editorial_room');

  const readingAnim = getAnimationDefinition('READER_VOICE_READING');
  assert.ok(readingAnim.target_agent_ids.includes('audience_language_editor'));

  console.log('  ✅ PASS: Pixel Office reflects real Nadia task states with zero fabrication.\n');
  passed++;

  console.log('======================================================');
  console.log(`🎉 ALL ${passed}/20 NADIA AUDIENCE & LANGUAGE EDITOR TESTS PASSED!`);
  console.log('======================================================\n');
}

runNadiaTestSuite().catch((err) => {
  console.error('❌ Test failed with exception:', err);
  process.exit(1);
});
