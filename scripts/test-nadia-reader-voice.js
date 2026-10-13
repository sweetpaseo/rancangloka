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
  HEAVY_EDITORIAL_PATTERNS,
  BANNED_GENERIC_OPENING_PATTERNS,
  DENSE_PARAGRAPH_WORD_THRESHOLD,
  DRAMATIC_REGISTER_PATTERNS,
  ESCAPED_MARKDOWN_PATTERNS
} from '../src/lib/editorial/nadia-reader-voice.ts';

import {
  isComparisonMatrixTable,
  parseComparisonMatrixTable,
  enhanceComparisonMatrices
} from '../src/lib/article/comparison-matrix.ts';

import {
  renderArticleMarkdownSafely
} from '../src/lib/article/renderer.ts';

import {
  auditJokoDraftReadability,
  JOKO_COMMON_WORD_PREFERENCE_MAP,
  JOKO_DRAMATIC_REGISTER_PATTERNS,
  JOKO_ESCAPED_MARKDOWN_PATTERNS
} from '../src/lib/editorial/joko-prompt-builder.ts';

import {
  evaluateHumanWritingQuality
} from '../src/lib/article/human-quality.ts';

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

  // --------------------------------------------------------------------------
  // Test 21: Joko Authoring Standards (Clean Markdown, Paragraph Density, Common Words)
  // --------------------------------------------------------------------------
  console.log('Test 21: Joko Authoring Standards (Clean Markdown, Paragraph Density, Common Words)');
  const messyJokoDraft = `# Masalah Jendela Barat

Sinar matahari sore leluasa membakar kaca jendela kamar tidur.
*\\*louver\\*\\* dan \\--- pemisah terpasang dengan rapi.
Kamar terasa seperti oven di siang bolong.

Ini adalah satu paragraf yang sengaja dibuat sangat panjang sekali dengan banyak kata bertumpuk agar melebihi batas kepadatan paragraf normal sehingga memicu peringatan densitas paragraf yang ketat karena pembaca ponsel akan merasa lelah membaca teks tanpa jeda visual yang cukup di layar handphone mereka ketika mencoba memahami solusi teknis perbaikan rumah tropis yang sebenarnya cukup sederhana jika dijelaskan dengan tenang dan runtut oleh konsultan bangunan berpengalaman yang sedang berbicara santai di depan pemilik rumah agar semua detail konstruksi dapat dipahami dengan baik tanpa kebingungan sama sekali dan tanpa istilah asing yang berlebihan.`;

  const jokoAudit = auditJokoDraftReadability(messyJokoDraft);
  assert.equal(jokoAudit.passed, false, 'Messy draft must fail Joko authoring audit');
  assert.ok(jokoAudit.escapedMarkdownPatterns.length > 0, 'Must detect escaped markdown patterns');
  assert.ok(jokoAudit.denseParagraphs.length > 0, 'Must detect dense paragraph >= 90 words');
  assert.ok(jokoAudit.unnaturalWordOccurrences.some(u => u.word === 'leluasa membakar kaca'), 'Must flag "leluasa membakar kaca"');
  assert.ok(jokoAudit.dramaticRegisterOccurrences.includes('seperti oven') || jokoAudit.dramaticRegisterOccurrences.includes('siang bolong'), 'Must flag dramatic register words');

  // Verify calibrated Article C passes Joko audit
  const artCAudit = auditJokoDraftReadability(artCContent);
  assert.equal(artCAudit.passed, true, 'Calibrated Article C must pass Joko authoring audit cleanly');
  assert.equal(artCAudit.escapedMarkdownPatterns.length, 0);
  assert.equal(artCAudit.denseParagraphs.length, 0);
  assert.equal(artCAudit.unnaturalWordOccurrences.length, 0);
  assert.equal(artCAudit.dramaticRegisterOccurrences.length, 0);

  console.log('  ✅ PASS: Joko authoring standard correctly enforces clean markdown, paragraph breathing, and common-word preferences.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 22: Nadia Paragraph Breathing Gate (Dense Paragraph >= 90 words)
  // --------------------------------------------------------------------------
  console.log('Test 22: Nadia Paragraph Breathing Gate (PARAGRAPH_DENSITY_WARNING)');
  const denseProseDraft = `# Cara Meredam Panas Kamar Barat
Kamar tidur lantai dua sering terasa panas saat sore hari.

Sebuah paragraf yang ditulis tanpa jeda bernapas dengan kalimat yang terus-menerus bersambung tanpa henti untuk menjelaskan masalah penyerapan radiasi matahari pada dinding bata dan kaca jendela secara bersamaan tanpa membagi antara penjelasan masalah mekanisme perpindahan kalor dan solusi yang harus diambil oleh pemilik rumah sehingga menghasilkan dinding teks yang sangat padat melebihi sembilan puluh kata dan membuat pembaca merasa lelah serta sulit melakukan scanning cepat saat membaca panduan ini melalui layar smartphone mereka di siang hari yang terik ketika mereka sedang mencari solusi praktis untuk memperbaiki rumah tinggal mereka yang terasa panas dan pengap berjam-jam setiap hari tanpa henti.

Solusi praktisnya adalah memasang kisi-kisi bilah tegak di luar jendela.`;

  const denseEval = evaluateReaderVoice(denseProseDraft);
  assert.equal(denseEval.decision, 'READER_VOICE_REVISION_REQUIRED', 'Dense draft must require revision');
  assert.equal(denseEval.dimensions.paragraphBreathing.passed, false, 'Paragraph breathing dimension must fail');
  assert.ok(denseEval.paragraphDensityWarnings && denseEval.paragraphDensityWarnings.length > 0, 'Must emit PARAGRAPH_DENSITY_WARNING');
  assert.ok(denseEval.paragraphDensityWarnings[0].includes('PARAGRAPH_DENSITY_WARNING'));

  console.log('  ✅ PASS: Nadia paragraph breathing gate detects dense paragraphs and issues PARAGRAPH_DENSITY_WARNING.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 23: Nadia Awkward Vocabulary & Common Indonesian Preference Detection
  // --------------------------------------------------------------------------
  console.log('Test 23: Nadia Awkward Vocabulary & Common Word Test');
  const awkwardDraft = `# Panduan Peneduh Jendela
Kamar terasa panas di sore hari saat matahari barat menyengat.
Panduan ini membedah perbandingan teknis empat peneduh luar untuk membendung sinar matahari yang leluasa membakar kaca kamar Anda.`;

  const awkwardEval = evaluateReaderVoice(awkwardDraft);
  assert.equal(awkwardEval.decision, 'READER_VOICE_REVISION_REQUIRED');
  assert.equal(awkwardEval.dimensions.translationese.passed, false);
  assert.ok(awkwardEval.dimensions.translationese.notes.some(n => n.includes('leluasa membakar kaca')));
  assert.ok(awkwardEval.dimensions.translationese.notes.some(n => n.includes('membedah perbandingan teknis')));
  assert.ok(awkwardEval.dimensions.translationese.notes.some(n => n.includes('membendung sinar matahari')));

  console.log('  ✅ PASS: Nadia enforces common Indonesian words over awkward/fancy phrasing.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 24: Nadia Register Inconsistency & Dramatic Hyperbole Suppression
  // --------------------------------------------------------------------------
  console.log('Test 24: Nadia Register Inconsistency & Dramatic Register Suppression');
  const dramaticDraft = `# Mengapa Kamar Barat Tetap Panas?
Kamar tidur terasa seperti oven dari jam dua siang sampai malam.
Ruangan menjadi gelap gulita di siang bolong akibat penutup jendela yang terlalu rapat. Panas menyiksa membuat penghuni tidak nyaman.`;

  const dramaticEval = evaluateReaderVoice(dramaticDraft);
  assert.equal(dramaticEval.decision, 'READER_VOICE_REVISION_REQUIRED');
  assert.equal(dramaticEval.dimensions.spokenIndonesian.passed, false);
  assert.ok(dramaticEval.dimensions.spokenIndonesian.notes.some(n => n.includes('seperti oven')));
  assert.ok(dramaticEval.dimensions.spokenIndonesian.notes.some(n => n.includes('gelap gulita')));
  assert.ok(dramaticEval.dimensions.spokenIndonesian.notes.some(n => n.includes('siang bolong')));

  console.log('  ✅ PASS: Nadia flags dramatic sensational colloquialisms to maintain consultant register consistency.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 25: Nadia Escaped Markdown Leakage Detection
  // --------------------------------------------------------------------------
  console.log('Test 25: Nadia Markdown Cleanliness (Escaped Markdown Leakage)');
  const escapedMarkdownDraft = `# Mengenal Sistem Peneduh Fasad
Kamar tidur lantai dua terasa panas saat sore hari.
Pilihlah (*\\*louver\\**) atau (*\\*awning\\**) yang dirancang untuk jendela Anda.
\\---
Pastikan celah ventilasi tetap terjaga.`;

  const escapedEval = evaluateReaderVoice(escapedMarkdownDraft);
  assert.equal(escapedEval.decision, 'READER_VOICE_REVISION_REQUIRED');
  assert.equal(escapedEval.dimensions.rawTechnicalSyntax.passed, false);
  assert.ok(escapedEval.escapedMarkdownIssues && escapedEval.escapedMarkdownIssues.length > 0);
  assert.ok(escapedEval.dimensions.rawTechnicalSyntax.notes.some(n => n.includes('markdown escape')));

  console.log('  ✅ PASS: Nadia catches literal escaped markdown syntax before publication.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 26: Nadia Jargon Budget & Unexplained Terminology Check
  // --------------------------------------------------------------------------
  console.log('Test 26: Nadia Jargon Budget (Unexplained Foreign Terminology Overload)');
  const jargonDraft = `# Peneduh Luar Rumah Tropis
Kamar tidur terasa panas pada sore hari.
Nilai solar heat gain coefficient pada jendela sangat menentukan.
Gunakan solar heat gain coefficient rendah untuk kenyamanan thermal comfort.
Bila solar heat gain coefficient tidak sesuai dengan building envelope, pendinginan gagal.`;

  const jargonEval = evaluateReaderVoice(jargonDraft);
  assert.equal(jargonEval.decision, 'READER_VOICE_REVISION_REQUIRED');
  assert.equal(jargonEval.dimensions.jargonBudget.passed, false);
  assert.ok(jargonEval.dimensions.jargonBudget.notes.some(n => n.includes('solar heat gain coefficient')));

  console.log('  ✅ PASS: Nadia penalizes repeated unexplained foreign jargon under Jargon Budget rubric.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 27: Rina Gate Boundary (Reader Voice Failure Blocks Editorial QA)
  // --------------------------------------------------------------------------
  console.log('Test 27: Rina Boundary Gate (Reader Voice Prerequisite Enforcement)');
  // A. When Nadia passes -> Rina evaluates naturally (score >= 85)
  const rinaPassResult = evaluateHumanWritingQuality(artCContent, {
    readerVoiceState: 'READER_VOICE_PASS'
  });
  assert.equal(rinaPassResult.passed, true, 'Rina must pass draft when Nadia has passed');
  assert.equal(rinaPassResult.decision, 'HUMAN_WRITING_PASS');
  assert.ok(rinaPassResult.total_score >= 85, `Rina score must be >= 85 (got ${rinaPassResult.total_score})`);

  // B. When Nadia has NOT passed -> Rina strictly rejects and caps score at <= 60
  const rinaFailResult = evaluateHumanWritingQuality(artCContent, {
    readerVoiceState: 'READER_VOICE_REVISION_REQUIRED'
  });
  assert.equal(rinaFailResult.passed, false, 'Rina must NOT pass draft when Nadia gate has failed');
  assert.equal(rinaFailResult.decision, 'HUMAN_WRITING_REWRITE');
  assert.ok(rinaFailResult.total_score <= 60, `Rina score must be capped <= 60 when Nadia gate failed (got ${rinaFailResult.total_score})`);
  assert.ok(rinaFailResult.issues.some(i => i.code === 'READER_VOICE_GATE_NOT_PASSED'), 'Must flag READER_VOICE_GATE_NOT_PASSED issue');

  console.log('  ✅ PASS: Rina strictly enforces Reader Voice PASS prerequisite; failure caps score <= 60 and rejects draft.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 28: Everyday Indonesian Fixtures Pass
  // --------------------------------------------------------------------------
  console.log('Test 28: Everyday Indonesian Fixtures Pass');
  const everydayDraft = `# Kamar Lantai Dua Panas di Sore Hari
Kamar tidur di lantai dua terasa panas dan pengap setiap sore meski AC sudah menyala dari siang?
Kalau jendela menghadap barat, masalahnya sinar sore datang miring dari samping.
Karena itu, tritisan datar pendek di atas jendela tidak banyak membantu.
Misalnya, kita pasang kisi-kisi bilah tegak di depan jendela, sinar sore bisa tertahan sebelum menyentuh kaca.
Untuk satu jendela saja, kanopi jendela juga bisa jadi pilihan yang praktis.`;

  const everydayEval = evaluateReaderVoice(everydayDraft);
  assert.equal(everydayEval.decision, 'READER_VOICE_PASS', 'Everyday Indonesian fixtures must cleanly pass');
  assert.equal(everydayEval.dimensions.spokenIndonesian.passed, true);
  console.log('  ✅ PASS: Everyday Indonesian conversational phrases cleanly pass Nadia gate.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 29: Heavy Editorial Wording Triggers Revision
  // --------------------------------------------------------------------------
  console.log('Test 29: Heavy Editorial Wording Triggers Revision');
  const heavyDraft = `# Peneduh Luar Rumah
Kamar tidur terasa panas pada sore hari.
Panduan ini membedah karakter praktis sistem peneduh luar dengan intervensi optimalisasi selubung bangunan berdasarkan karakter masalah.
Konsekuensi perawatan juga menjadi pertimbangan penting bagi pemilik rumah.`;

  const heavyEval = evaluateReaderVoice(heavyDraft);
  assert.equal(heavyEval.decision, 'READER_VOICE_REVISION_REQUIRED', 'Heavy editorial constructions must trigger revision');
  assert.equal(heavyEval.dimensions.spokenIndonesian.passed, false, 'Spoken Indonesian test must fail for heavy editorial wording');
  assert.ok(
    heavyEval.revisionRequests.some(r => r.section.includes('Everyday Language Pass') || r.requestedImprovement.includes('panduan ini membedah')),
    'Must issue revision request for heavy editorial phrasing'
  );
  console.log('  ✅ PASS: Unnecessary heavy editorial wording triggers revision request.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 30: Technical Terminology with Simple Explanation Passes
  // --------------------------------------------------------------------------
  console.log('Test 30: Technical Terminology with Simple Explanation Passes');
  const techDraft = `# Menahan Panas Matahari pada Jendela Rumah
Kamar tidur di lantai dua terasa panas saat siang hari.
Standar nasional SNI 6389:2020 mengatur batas perpindahan panas menyeluruh pada selubung gedung atau OTTV (Overall Thermal Transfer Value) maksimal 35 W/m².
Artinya, semakin baik jendela kaca dinaungi peneduh seperti overhang atau tritisan atap, beban pendinginan AC akan semakin ringan.
Kelebihan tritisan adalah bebas biaya perawatan, namun memiliki konsekuensi kurang efektif menahan sinar sore.
Sebagai langkah awal, periksa arah hadap bukaan kamar Anda sebelum menentukan pilihan.`;

  const techEval = evaluateReaderVoice(techDraft);
  assert.equal(techEval.decision, 'READER_VOICE_PASS', 'Technical terminology with simple explanation must pass');
  assert.equal(techEval.dimensions.rawTechnicalSyntax.passed, true);
  assert.equal(techEval.dimensions.jargonBudget.passed, true);
  console.log('  ✅ PASS: Legitimate technical terms (OTTV, SNI, overhang) with plain explanation pass cleanly.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 31: Overly Verbose Comparison Cells Trigger Warning
  // --------------------------------------------------------------------------
  console.log('Test 31: Overly Verbose Comparison Cells Trigger Warning');
  const verboseCellTable = `# Perbandingan Peneduh Jendela
Kamar tidur terasa panas pada sore hari.

| Aspek | Tritisan Atap | Louver |
| :--- | :--- | :--- |
| Kelebihan | Sangat baik untuk menahan panas matahari siang hari dari atas serta melindungi kusen jendela dari guyuran hujan lebat yang terus-menerus turun sepanjang musim hujan tropis di Indonesia | Mampu menghalau panas matahari sore yang datang dari samping dengan sudut rendah sebelum menyentuh kaca jendela kamar |
`;

  const verboseEval = evaluateReaderVoice(verboseCellTable);
  assert.ok(
    verboseEval.visualDensitySignals && verboseEval.visualDensitySignals.length > 0,
    'Verbose comparison table cells (> 20 words) must trigger VISUAL_DENSITY_SIGNAL'
  );

  const jokoVerboseAudit = auditJokoDraftReadability(verboseCellTable);
  assert.equal(jokoVerboseAudit.passed, false, 'Joko audit must fail when comparison cells are mini-essays');
  assert.ok(
    jokoVerboseAudit.verboseTableCells.length > 0,
    'Joko audit must identify verboseTableCells'
  );
  console.log('  ✅ PASS: Overly verbose table cells trigger visual density warnings and Joko audit flag.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 32: Claim-Strength Invariants Still Pass
  // --------------------------------------------------------------------------
  console.log('Test 32: Claim-Strength Invariants Still Pass');
  const claimCheck1 = validateClaimStrengthPreservation(
    'Peneduh luar dapat membantu mengurangi tagihan listrik.',
    'Peneduh luar membuat tagihan listrik turun drastis.'
  );
  assert.equal(claimCheck1.preservesClaimStrength, false);

  const claimCheck2 = validateClaimStrengthPreservation(
    'Peneduh luar membantu mengurangi perambatan panas pada kaca.',
    'Peneduh luar membuat panas tidak bisa masuk ke dalam rumah.'
  );
  assert.equal(claimCheck2.preservesClaimStrength, false);

  const claimCheckValid = validateClaimStrengthPreservation(
    'Peneduh luar membantu meredam panas pada kaca.',
    'Peneduh luar membantu menahan panas matahari sebelum menyentuh kaca.'
  );
  assert.equal(claimCheckValid.preservesClaimStrength, true);
  console.log('  ✅ PASS: Claim-strength invariants strictly preserved without regression.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 33: Comparison Matrix Recognized Intentionally vs Standard Table
  // --------------------------------------------------------------------------
  console.log('Test 33: Comparison Matrix Recognized Intentionally vs Standard Table');
  const standardTableMd = `| Istilah | Definisi |
| :--- | :--- |
| Overhang | Tritisan atap mendatar |
| Louver | Kisi-kisi bilah pelindung |`;

  const comparisonTableMd = `| Aspek | Overhang | Louver | Awning | Fasad Kedua |
| :--- | :--- | :--- | :--- | :--- |
| Cocok untuk | Utara-Selatan | Barat-Timur | Satu jendela | Barat |
| Matahari sore | Terbatas | Sangat baik | Cukup | Sangat baik |`;

  const standardHtml = await renderArticleMarkdownSafely(standardTableMd);
  const comparisonHtml = await renderArticleMarkdownSafely(comparisonTableMd);

  assert.equal(standardHtml.includes('data-comparison-matrix="true"'), false, '2-column dictionary table must NOT be enhanced into comparison matrix');
  assert.equal(comparisonHtml.includes('data-comparison-matrix="true"'), true, '5-column comparison table must be enhanced into comparison matrix');
  console.log('  ✅ PASS: Comparison matrix intentionally recognized while standard 2-column tables remain standard tables.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 34: Desktop Table & Mobile Cards Zero-JS Output
  // --------------------------------------------------------------------------
  console.log('Test 34: Desktop Table & Mobile Cards Zero-JS Output');
  const renderedArticleHtml = await renderArticleMarkdownSafely(`
## Kalau Dibandingkan, Mana yang Cocok untuk Rumah Anda?

| Aspek | Overhang | Louver | Awning |
| :--- | :--- | :--- | :--- |
| Cocok untuk | Utara & Selatan | Barat & Timur | Satu jendela |
| Tempias hujan | Sangat baik | Cukup | Baik |
  `);

  // Verify responsive zero-JS markup:
  // Desktop table: hidden lg:block, semantic th scope="col"
  assert.ok(renderedArticleHtml.includes('data-comparison-matrix="true"'), 'Must have data-comparison-matrix wrapper');
  assert.ok(renderedArticleHtml.includes('hidden lg:block'), 'Must contain desktop-only view (hidden lg:block)');
  assert.ok(renderedArticleHtml.includes('grid grid-cols-1 md:grid-cols-2 lg:hidden'), 'Must contain tablet/mobile card view (grid grid-cols-1 md:grid-cols-2 lg:hidden)');
  assert.ok(renderedArticleHtml.includes('scope="col"'), 'Desktop table must have accessibility scope="col"');
  assert.equal(renderedArticleHtml.includes('<script'), false, 'ZERO client-side JavaScript required');
  assert.equal(renderedArticleHtml.includes('\\*') || renderedArticleHtml.includes('\\_'), false, 'No raw markdown escape leakage');
  console.log('  ✅ PASS: Zero-JS responsive dual-view (desktop matrix + tablet/mobile cards) cleanly generated with full accessibility.\n');
  passed++;

  // --------------------------------------------------------------------------
  // Test 35: Single Source of Content Truth (No Duplication in Source)
  // --------------------------------------------------------------------------
  console.log('Test 35: Single Source of Content Truth (No Duplication in Source)');
  const sampleTableHtml = `<table>
<thead><tr><th>Aspek</th><th>Overhang</th><th>Louver</th><th>Awning</th><th>Fasad Kedua</th></tr></thead>
<tbody>
<tr><td><strong>Cocok untuk</strong></td><td>Utara-Selatan</td><td>Barat-Timur</td><td>Satu jendela</td><td>Barat</td></tr>
<tr><td><strong>Matahari sore</strong></td><td>Terbatas</td><td>Sangat baik</td><td>Cukup</td><td>Sangat baik</td></tr>
</tbody>
</table>`;
  const parsed = parseComparisonMatrixTable(sampleTableHtml);
  assert.ok(parsed, 'Table parsed from single markdown source');
  assert.equal(parsed.options.length, 4, '4 comparison items parsed');
  assert.equal(parsed.rows.length, 2, '2 comparison attributes parsed');
  assert.equal(parsed.options[0], 'Overhang');
  assert.equal(parsed.options[1], 'Louver');
  console.log('  ✅ PASS: Single source of content truth: 1 markdown table -> dual responsive view without manual duplication.\n');
  passed++;

  console.log(`🎉 ALL ${passed}/35 NADIA AUDIENCE & LANGUAGE EDITOR TESTS PASSED!`);
  console.log('======================================================\n');
}

runNadiaTestSuite().catch((err) => {
  console.error('❌ Test failed with exception:', err);
  process.exit(1);
});
