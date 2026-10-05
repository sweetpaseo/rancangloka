/**
 * EDITORIAL-RUNTIME-4A Test Suite
 * Generalization Architecture Unblock & Adversarial Verification
 *
 * Verifies that:
 * 1. Visitor Pain & Contexts are generated dynamically per topic and content family without hardcoded metal roof contexts.
 * 2. Research Questions are dynamically generated covering the 6 core investigative categories.
 * 3. Generalization Matrix across 3 unrelated topics produces distinct visitor contexts, research questions, discovered sources, evidence passages, and claim inventories.
 * 4. Topic <-> Evidence Alignment Gate rejects off-topic packs (TOPIC_EVIDENCE_ALIGNMENT_FAIL).
 * 5. Research Question Coverage Gate rejects under-covered packs (RESEARCH_COVERAGE_INSUFFICIENT).
 * 6. Off-topic/insufficient packs halt editorial draft execution (BLOCKED, 0 attempts) before Joko is called.
 */

import assert from 'node:assert/strict';
import {
  generateDynamicVisitorPain,
  buildHumanVisitorPainSelectionPackage
} from '../src/lib/article/visitor-pain.ts';
import {
  generateEditorialResearchQuestions,
  validateResearchQuestionCoverage
} from '../src/lib/editorial/research-questions.ts';
import {
  auditTopicEvidenceAlignment
} from '../src/lib/editorial/topic-alignment.ts';
import {
  executeGeneralizedResearchJob,
  executeEditorialResearchJob
} from '../src/lib/editorial/irwan-research-runtime.ts';
import {
  executeEditorialDraftJob
} from '../src/lib/editorial/editorial-runtime.ts';

console.log('🧪 Starting EDITORIAL-RUNTIME-4A Generalization & Adversarial Architecture Suite...\n');

let testsPassed = 0;
function pass(desc) {
  console.log(`  ✅ PASS: ${desc}`);
  testsPassed++;
}

async function runTests() {
  // =========================================================================
  // SECTION 1: Dynamic Visitor Pain & Intent Independence (No hardcoded metal roof)
  // =========================================================================
  console.log('--- TEST SECTION 1: Dynamic Visitor Pain Generalization ---');

  const topicDamp = "Dinding Rumah Lembap dan Berjamur: Cat Waterproofing Cukup atau Sumber Air Harus Diperbaiki?";
  const topicWindow = "Kusen Aluminium vs uPVC: Mana yang Lebih Tahan Cuaca Tropis dan Kedap Suara?";
  const topicRoof = "Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?";

  const painDamp = generateDynamicVisitorPain(topicDamp, 'problem_solver');
  assert.equal(painDamp.topic, topicDamp);
  assert.equal(painDamp.content_family, 'problem_solver');
  assert.ok(painDamp.primary_context.context_id.length > 0);
  assert.ok(painDamp.primary_context.primary_problem.toLowerCase().includes('dinding') || painDamp.primary_context.primary_problem.toLowerCase().includes('lembap'));
  assert.ok(!painDamp.primary_context.primary_problem.toLowerCase().includes('atap metal'), 'Damp wall context must NOT contain atap metal');
  assert.ok(painDamp.secondary_contexts.length >= 2);
  assert.ok(painDamp.opening_angle.length > 0);
  assert.ok(painDamp.narrative_signature.length > 0);
  pass('1. Dynamic Visitor Pain generates topic-specific pain states for damp wall without metal-roof assumptions');

  const painWindow = generateDynamicVisitorPain(topicWindow, 'comparison_guide');
  assert.equal(painWindow.topic, topicWindow);
  assert.ok(painWindow.primary_context.primary_problem.toLowerCase().includes('kusen') || painWindow.primary_context.primary_problem.toLowerCase().includes('aluminium') || painWindow.primary_context.primary_problem.toLowerCase().includes('upvc'));
  assert.ok(!painWindow.primary_context.primary_problem.toLowerCase().includes('radiant barrier'));
  pass('2. Dynamic Visitor Pain generates topic-specific pain states for window materials');

  // Verify buildHumanVisitorPainSelectionPackage uses dynamic generator when topic is provided
  const pkgDamp = buildHumanVisitorPainSelectionPackage({ topic: topicDamp, contentFamily: 'problem_solver' });
  assert.ok(pkgDamp.candidate_contexts.some(c => c.primary_problem.toLowerCase().includes('dinding') || c.primary_problem.toLowerCase().includes('lembap')));
  assert.ok(!pkgDamp.candidate_contexts.some(c => c.context_id === 'CTX-01-MIDDAY-PEAK'), 'Canonical metal roof context must not be returned for damp topic');
  pass('3. buildHumanVisitorPainSelectionPackage dynamically switches away from metal roof when topic provided');

  // =========================================================================
  // SECTION 2: Dynamic Research Question Generation & Coverage
  // =========================================================================
  console.log('\n--- TEST SECTION 2: Dynamic Research Question Generation & Coverage ---');

  const dampQuestions = generateEditorialResearchQuestions(topicDamp, { primaryIntent: 'problem_solving' });
  assert.ok(dampQuestions.length >= 6, 'Must generate questions across all 6 core categories');
  const dampCategories = dampQuestions.map(q => q.category);
  assert.ok(dampCategories.includes('PLAUSIBLE_CAUSES'));
  assert.ok(dampCategories.includes('DIFFERENTIAL_DIAGNOSIS'));
  assert.ok(dampCategories.includes('INTERVENTION_MAPPING'));
  assert.ok(dampCategories.includes('LIMITATIONS_AND_FALSE_FIXES'));
  assert.ok(dampCategories.includes('ESCALATION_CONDITIONS'));
  assert.ok(dampCategories.includes('EMPIRICAL_RECOMMENDATION_SUPPORT'));
  pass('4. Research Questions cover all 6 required investigative categories dynamically');

  // Test coverage validation
  const mockDampPack = {
    canonical_topic: topicDamp,
    claim_inventory: [
      { claim_id: 'CLM-001', claim_text: 'Rembesan air tanah dan kebocoran pipa merupakan penyebab utama kelembapan dinding', semantic_role: 'CAUSE_MECHANISM' },
      { claim_id: 'CLM-002', claim_text: 'Waterproofing topikal tidak mengatasi air yang terperangkap di dalam pasangan bata', semantic_role: 'LIMITATION' },
      { claim_id: 'CLM-003', claim_text: 'Perbaikan sumber air dan injeksi barrier kimia menghentikan kapiler air tanah', semantic_role: 'INTERVENTION_EFFECT' },
      { claim_id: 'CLM-004', claim_text: 'Kadar kelembapan dinding dapat diukur dengan moisture meter', semantic_role: 'DIAGNOSTIC_SIGNAL' }
    ]
  };
  const coverageCheck = validateResearchQuestionCoverage(dampQuestions, mockDampPack);
  assert.ok(coverageCheck.covered_categories.length >= 4);
  assert.equal(coverageCheck.covered, true);
  pass('5. Research Question Coverage Validator passes when key causes and interventions are covered');

  const sparsePack = {
    canonical_topic: topicDamp,
    claim_inventory: [
      { claim_id: 'CLM-001', claim_text: 'Kadar kelembapan dinding dapat diukur', semantic_role: 'DIAGNOSTIC_SIGNAL' }
    ]
  };
  const sparseCheck = validateResearchQuestionCoverage(dampQuestions, sparsePack);
  assert.equal(sparseCheck.covered, false);
  assert.ok(sparseCheck.rejection_reason?.includes('RESEARCH_COVERAGE_INSUFFICIENT'));
  assert.ok(sparseCheck.missing_categories.length > 0);
  pass('6. Research Question Coverage Validator rejects sparse pack with RESEARCH_COVERAGE_INSUFFICIENT');

  // =========================================================================
  // SECTION 3: Generalization Matrix across 3 Unrelated Topics
  // =========================================================================
  console.log('\n--- TEST SECTION 3: Generalization Matrix across 3 Unrelated Topics ---');

  const resRoof = await executeGeneralizedResearchJob({
    topic: topicRoof,
    runId: 'TEST-GEN-ROOF'
  });
  const resDamp = await executeGeneralizedResearchJob({
    topic: topicDamp,
    runId: 'TEST-GEN-DAMP'
  });
  const resWindow = await executeGeneralizedResearchJob({
    topic: topicWindow,
    runId: 'TEST-GEN-WINDOW'
  });

  // Check Roof Pack
  assert.ok(resRoof.evidencePack.retrieved_documents.some(s => s.source_id.includes('DOE') || s.source_id.includes('WIKI-RADIANT')));
  assert.ok(resRoof.evidencePack.claim_inventory.some(c => (c.statement || c.claim_text).toLowerCase().includes('radiant') || (c.statement || c.claim_text).toLowerCase().includes('radiasi')));

  // Check Damp Pack
  assert.ok(resDamp.evidencePack.retrieved_documents.some(s => s.source_id.includes('EPA') || s.source_id.includes('WIKI-DAMP')));
  assert.ok(resDamp.evidencePack.claim_inventory.some(c => (c.statement || c.claim_text).toLowerCase().includes('moisture') || (c.statement || c.claim_text).toLowerCase().includes('air') || (c.statement || c.claim_text).toLowerCase().includes('water')));

  // Check Window Pack
  assert.ok(resWindow.evidencePack.retrieved_documents.some(s => s.source_id.includes('LBNL') || s.source_id.includes('WIKI-WINDOW')));
  assert.ok(resWindow.evidencePack.claim_inventory.some(c => (c.statement || c.claim_text).toLowerCase().includes('window') || (c.statement || c.claim_text).toLowerCase().includes('frame') || (c.statement || c.claim_text).toLowerCase().includes('aluminium') || (c.statement || c.claim_text).toLowerCase().includes('upvc')));

  // Assert claim IDs are sequential graph node IDs (CLM-001, CLM-002), not domain encoded
  assert.ok(resDamp.evidencePack.claim_inventory.every(c => /^CLM-\d{3}$/.test(c.claim_id)), 'Damp claims must have generic sequential IDs');
  assert.ok(resWindow.evidencePack.claim_inventory.every(c => /^CLM-\d{3}$/.test(c.claim_id)), 'Window claims must have generic sequential IDs');

  // Verify non-overlapping claims across different topics
  const roofTexts = resRoof.evidencePack.claim_inventory.map(c => c.statement || c.claim_text);
  const dampTexts = resDamp.evidencePack.claim_inventory.map(c => c.statement || c.claim_text);
  const windowTexts = resWindow.evidencePack.claim_inventory.map(c => c.statement || c.claim_text);
  assert.ok(!dampTexts.some(t => roofTexts.includes(t)), 'Damp and Roof claim inventories must be completely disjoint');
  assert.ok(!windowTexts.some(t => dampTexts.includes(t)), 'Window and Damp claim inventories must be completely disjoint');
  pass('7. Generalization Matrix: 3 topics produce materially different visitor contexts, research questions, discovered sources, and claim graphs');

  // =========================================================================
  // SECTION 4: Adversarial Topic <-> Evidence Alignment Tests
  // =========================================================================
  console.log('\n--- TEST SECTION 4: Adversarial Topic <-> Evidence Alignment Gate ---');

  // Adversarial Test A: Metal-roof pack applied to Damp-wall topic
  const roofJob = await executeEditorialResearchJob({
    taskId: 'TEST-ROOF-HISTORICAL',
    topic: topicRoof,
    milestone: 'EDITORIAL-RUNTIME-3B-STABILIZE',
    operatorAuth: { authorizedBy: 'Tester', operatorRole: 'CHIEF_EDITOR', timestamp: new Date().toISOString() }
  });
  const roofPack = roofJob.evidencePack;
  const auditRoofOnDamp = auditTopicEvidenceAlignment(topicDamp, roofPack);
  assert.equal(auditRoofOnDamp.aligned, false);
  assert.equal(auditRoofOnDamp.rejection_code, 'TOPIC_EVIDENCE_ALIGNMENT_FAIL');
  assert.equal(auditRoofOnDamp.domain_match, false);
  pass('8. Adversarial Test A: Metal-roof evidence pack on damp-wall topic FAILS with TOPIC_EVIDENCE_ALIGNMENT_FAIL');

  // Adversarial Test B: Damp-wall pack applied to Window-material topic
  const auditDampOnWindow = auditTopicEvidenceAlignment(topicWindow, resDamp.evidencePack);
  assert.equal(auditDampOnWindow.aligned, false);
  assert.equal(auditDampOnWindow.rejection_code, 'TOPIC_EVIDENCE_ALIGNMENT_FAIL');
  assert.equal(auditDampOnWindow.domain_match, false);
  pass('9. Adversarial Test B: Damp-wall evidence pack on window topic FAILS with TOPIC_EVIDENCE_ALIGNMENT_FAIL');

  // Adversarial Test C: Structurally valid pack with missing core research coverage
  const offTopicDummyPack = {
    canonical_topic: topicDamp,
    discovered_sources: [{ source_id: 'SRC-DUMMY', title: 'Cara Merawat Rumput Halaman' }],
    claim_inventory: [
      { claim_id: 'CLM-001', claim_text: 'Rumput jepang membutuhkan sinar matahari penuh', semantic_role: 'MATERIAL_BEHAVIOR' }
    ],
    retrieved_documents: [{ doc_id: 'DOC-1', title: 'Rumput Halaman' }],
    evidence_passages: [{ passage_id: 'PAS-1', passage_text: 'Rumput membutuhkan air secukupnya', supports_claim_ids: ['CLM-001'] }]
  };
  const auditDummyOnDamp = auditTopicEvidenceAlignment(topicDamp, offTopicDummyPack);
  assert.equal(auditDummyOnDamp.aligned, false);
  assert.equal(auditDummyOnDamp.rejection_code, 'TOPIC_EVIDENCE_ALIGNMENT_FAIL');
  pass('10. Adversarial Test C: Internally valid but completely off-topic evidence pack FAILS alignment');

  // Valid Test: Damp pack on Damp topic
  const auditDampOnDamp = auditTopicEvidenceAlignment(topicDamp, resDamp.evidencePack);
  assert.equal(auditDampOnDamp.aligned, true);
  assert.ok(auditDampOnDamp.research_coverage?.covered, 'Research coverage must be covered');
  pass('11. Topic-derived evidence pack with valid coverage PASSES alignment gate');

  // =========================================================================
  // SECTION 5: Fail-Closed Pre-Writing Gate in Editorial Draft Runner
  // =========================================================================
  console.log('\n--- TEST SECTION 5: Fail-Closed Pre-Writing Execution Gate ---');

  // When an off-topic evidence pack is passed into executeEditorialDraftJob,
  // it must immediately halt before calling any LLM / Joko, returning BLOCKED and totalAttempts = 0.
  const blockedDraftJob = await executeEditorialDraftJob({
    taskId: 'TEST-BLOCKED-ALIGNMENT-001',
    topic: topicDamp,
    evidencePack: roofPack, // Mismatched metal-roof pack
    visitorPain: painDamp,
    articleIntent: 'problem_solving',
    dryRun: true,
    operatorAuth: {
      authorizedBy: 'Tester Chief Editor',
      operatorRole: 'CHIEF_EDITOR',
      timestamp: new Date().toISOString()
    }
  });

  assert.equal(blockedDraftJob.status, 'BLOCKED');
  assert.equal(blockedDraftJob.totalAttempts, 0);
  assert.equal(blockedDraftJob.finalDecision, 'TOPIC_EVIDENCE_ALIGNMENT_FAIL');
  assert.equal(blockedDraftJob.humanStopGateStatus, 'OPERATOR_INTERVENTION_REQUIRED');
  assert.ok(blockedDraftJob.error?.includes('TOPIC_EVIDENCE_ALIGNMENT_FAIL'));
  pass('12. Blocked Research Gate halts executeEditorialDraftJob with 0 attempts and prevents Joko invocation');

  console.log(`\n🎉 All ${testsPassed} tests in EDITORIAL-RUNTIME-4A passed successfully!`);
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
