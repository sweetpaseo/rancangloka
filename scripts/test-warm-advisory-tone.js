/**
 * RancangLoka & Hermes — Test Suite: Warm Advisory Tone & Decision Handoff
 * Milestone: RANCANGLOKA_WARM_ADVISORY_TONE_1
 *
 * Verifies all mandatory requirements:
 * 1. Canonical principle & House Voice additions.
 * 2. Joko authoring standards & WARM ADVISORY TONE integration.
 * 3. Nadia Reader Voice Gate (WARMTH, HUMANNESS, ADVISORY TONE, DECISION COMFORT).
 * 4. Nadia 6 canonical review questions.
 * 5. Cold report / generic AI / authoritarian verdict detection.
 * 6. COMPARISON_WARM_DECISION_HANDOFF rule & anti-boilerplate verification.
 * 7. Dimas System Guard semantic checklist (warm_advisory_tone, human_reader_handoff, comparison_decision_handoff).
 * 8. Rina QA editorial truth & consistency checks (no evidence distortion, no universal overreach, no softened warnings).
 * 9. Canonical staff chain preservation: Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari (zero bypass).
 * 10. Jefry shadow boundary preservation (zero execution or publishing authority).
 * 11. Article C hash transition: old hash invalidated, new hash verified.
 * 12. Article C revised content passes both Nadia Reader Voice and Rina Editorial QA.
 * 13. Article C publication safety state (remains UNPUBLISHED).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Import editorial modules
import {
  evaluateWarmAdvisoryTone,
  isComparisonContent,
  extractEditorialClosingPassage,
  INVARIANT_WARM_ADVISORY_TONE,
  INVARIANT_COMPARISON_WARM_DECISION_HANDOFF
} from '../src/lib/editorial/warm-advisory-guard.ts';

import {
  evaluateReaderVoice,
  validateNadiaAuthorityBoundaries,
  INVARIANT_LANGUAGE_SIMPLIFICATION_MUST_PRESERVE_CLAIM_STRENGTH
} from '../src/lib/editorial/nadia-reader-voice.ts';

import {
  buildJokoSystemPrompt
} from '../src/lib/editorial/joko-prompt-builder.ts';

import {
  evaluateHumanWritingQuality,
  JOKO_HUMAN_AUTHORING_GUIDELINES
} from '../src/lib/article/human-quality.ts';

import {
  validateHandoffSafety,
  setNadiaGateActive,
  isNadiaGateActive
} from '../src/lib/mission-control/task-handoff.ts';

import {
  getStaffDefinitionByAgentId
} from '../src/lib/mission-control/staff-registry.ts';

let passed = 0;

console.log('======================================================');
console.log('🧪 Starting RANCANGLOKA-WARM-ADVISORY-TONE Test Suite...');
console.log('======================================================\n');

// --------------------------------------------------------------------------
// Test 1: Canonical Principle & House Voice Invariants
// --------------------------------------------------------------------------
console.log('Test 1: Canonical House Voice Additions');
const jokoPrompt = buildJokoSystemPrompt();
assert.ok(
  jokoPrompt.includes('RancangLoka tidak menulis untuk membuat pembaca merasa penulisnya pintar. RancangLoka menulis supaya pembaca merasa dirinya sekarang mengerti.'),
  'Core House Voice invariant must be preserved'
);
assert.ok(
  jokoPrompt.includes('RancangLoka menjelaskan dengan kehangatan seorang konsultan yang membantu, bukan dengan jarak seorang penguji yang menghakimi.'),
  'Warm consultant voice invariant must be present immediately below'
);
assert.ok(
  jokoPrompt.includes('Setelah pembaca memahami fakta dan trade-off, RancangLoka membantu mereka percaya diri mengambil keputusan sendiri.'),
  'Decision confidence invariant must be present'
);
assert.ok(jokoPrompt.includes('WARM ADVISORY TONE'), 'Target voice must specify WARM ADVISORY TONE');
console.log('  ✅ PASS: Core House Voice and Warm Advisory Tone invariants correctly embedded in Joko prompt.\n');
passed++;

// --------------------------------------------------------------------------
// Test 2: Joko Authoring Responsibilities & Article Type Breakdown
// --------------------------------------------------------------------------
console.log('Test 2: Joko Authoring Responsibilities & Article Type Intensity');
assert.ok(jokoPrompt.includes('Tanggung Jawab Kepenulisan Utama Joko'), 'Joko primary authoring responsibilities must be present');
assert.ok(jokoPrompt.includes('COMPARISON_WARM_DECISION_HANDOFF'), 'Comparison closing rule must be present in Joko prompt');
assert.ok(jokoPrompt.includes('INTENSITAS WARM ADVISORY TONE BERDASARKAN TIPE ARTIKEL'), 'Intensity breakdown across article types must be present');
assert.ok(jokoPrompt.includes('PROBLEM SOLVER'), 'Problem solver type must be documented');
assert.ok(jokoPrompt.includes('MATERIAL GUIDE'), 'Material guide type must be documented');
assert.ok(jokoPrompt.includes('TECHNICAL EXPLAINER'), 'Technical explainer type must be documented');
assert.ok(jokoPrompt.includes('PRODUCT DECISION'), 'Product decision type must be documented');
assert.ok(jokoPrompt.includes('NEWS / FACTUAL UPDATE'), 'News update type must be documented');
console.log('  ✅ PASS: Joko authoring responsibilities and intensity breakdown correctly defined.\n');
passed++;

// --------------------------------------------------------------------------
// Test 3: Dimas Semantic Guard — Missing Comparison Handoff Flagged
// --------------------------------------------------------------------------
console.log('Test 3: Dimas Semantic Guard — Missing Comparison Decision Handoff');
const coldComparisonDraft = `
# Membandingkan Kusen Aluminium vs Kayu untuk Rumah Tropis

Kusen jendela kayu memberikan kesan hangat, sedangkan aluminium menawarkan ketahanan rayap.

## Matriks Perbandingan Teknis
| Fitur | Aluminium | Kayu |
| :--- | :--- | :--- |
| Tahan Rayap | Sangat Baik | Rentan |
| Insulasi | Rendah | Baik |

## Rekomendasi
Gunakan aluminium untuk area basah dan kayu solid untuk ruang tamu beratap lebar.

---

## Catatan Telaah Teknis
Rujukan SNI 03-6389-2000.
`.trim();

const coldChecklist = evaluateWarmAdvisoryTone(coldComparisonDraft, {
  contentFamily: 'comparison',
  title: 'Membandingkan Kusen Aluminium vs Kayu untuk Rumah Tropis'
});

assert.equal(coldChecklist.is_comparison, true, 'Draft must be detected as comparison');
assert.equal(coldChecklist.comparison_decision_handoff, 'REVISION_REQUIRED', 'Missing handoff must trigger REVISION_REQUIRED');
assert.equal(coldChecklist.warm_advisory_tone, 'REVISION_REQUIRED');
assert.ok(coldChecklist.flags.some((f) => f.type === 'MISSING_COMPARISON_HANDOFF'), 'Must flag MISSING_COMPARISON_HANDOFF');
console.log('  ✅ PASS: Comparison lacking decision handoff correctly triggers REVISION_REQUIRED in Dimas guard.\n');
passed++;

// --------------------------------------------------------------------------
// Test 4: Dimas Semantic Guard — Cold Report Phrasing Flagged
// --------------------------------------------------------------------------
console.log('Test 4: Dimas Semantic Guard — Cold Report Phrasing Flagged');
const bureaucraticDraft = `
# Memilih Sistem Ventilasi Rumah

Bukaan ventilasi silang menentukan pergantian udara.

## Rekomendasi
Demikianlah laporan analisis perbandingan ini dibuat secara rangkuman dapat disimpulkan bahwa ventilasi silang optimal.

---

## Catatan Rujukan
Standar ASHRAE 62.2.
`.trim();

const bureauChecklist = evaluateWarmAdvisoryTone(bureaucraticDraft, {
  contentFamily: 'comparison'
});

assert.ok(bureauChecklist.flags.some((f) => f.type === 'COLD_REPORT_SUMMARY'), 'Must flag COLD_REPORT_SUMMARY');
assert.equal(bureauChecklist.warm_advisory_tone, 'REVISION_REQUIRED');
console.log('  ✅ PASS: Cold bureaucratic report summary correctly caught and flagged.\n');
passed++;

// --------------------------------------------------------------------------
// Test 5: Dimas Semantic Guard — Generic AI Chatbot Sign-off Flagged
// --------------------------------------------------------------------------
console.log('Test 5: Dimas Semantic Guard — Generic AI Chatbot Sign-off Flagged');
const genericAiDraft = `
# Memilih Material Atap Rumah

Material atap harus tahan panas.

## Rekomendasi
Semoga artikel ini bermanfaat bagi Anda dalam merancang rumah impian. Selamat mencoba dan semoga sukses!

---

## Referensi
Literatur arsitektur tropis.
`.trim();

const aiChecklist = evaluateWarmAdvisoryTone(genericAiDraft, {
  contentFamily: 'comparison'
});

assert.ok(aiChecklist.flags.some((f) => f.type === 'GENERIC_AI_SIGN_OFF'), 'Must flag GENERIC_AI_SIGN_OFF');
assert.equal(aiChecklist.warm_advisory_tone, 'REVISION_REQUIRED');
console.log('  ✅ PASS: Generic AI sign-off phrases correctly caught and flagged.\n');
passed++;

// --------------------------------------------------------------------------
// Test 6: Dimas Semantic Guard — Natural Warm Decision Handoff Passes
// --------------------------------------------------------------------------
console.log('Test 6: Dimas Semantic Guard — Natural Warm Decision Handoff Passes');
const warmComparisonDraft = `
# Memilih Sistem Shading Luar: Overhang atau Louver?

Kamar tidur lantai dua terasa panas saat siang menjelang sore hari.

## Rekomendasi Skenario
Gunakan overhang horizontal untuk bukaan utara-selatan, dan sirip louver untuk bukaan barat-timur.

Setelah semua pertimbangannya jelas, keputusan akhirnya tetap kembali ke kondisi nyata rumah Anda. Tidak ada satu sistem yang sempurna untuk segala situasi—pilihlah solusi yang paling masuk akal sesuai arah datangnya sinar matahari dan kemudahan perawatan yang sanggup Anda jalani dalam jangka panjang.

---

## Catatan Telaah Teknis
Rujukan SNI 6389:2020.
`.trim();

const warmChecklist = evaluateWarmAdvisoryTone(warmComparisonDraft, {
  contentFamily: 'comparison',
  title: 'Memilih Sistem Shading Luar: Overhang atau Louver?'
});

assert.equal(warmChecklist.comparison_decision_handoff, 'PASS', 'Warm decision handoff must PASS');
assert.equal(warmChecklist.warm_advisory_tone, 'PASS', 'Warm advisory tone must PASS');
assert.equal(warmChecklist.review_questions.expert_homeowner_dialogue, true);
assert.equal(warmChecklist.review_questions.confident_not_authoritarian, true);
assert.equal(warmChecklist.review_questions.calm_confidence_ending, true);
assert.equal(warmChecklist.flags.length, 0, 'Zero flags in warm comparison draft');
console.log('  ✅ PASS: Naturally adapted warm decision handoff cleanly passes Dimas guard.\n');
passed++;

// --------------------------------------------------------------------------
// Test 7: Nadia Reader Voice Gate Integration & 6 Canonical Questions
// --------------------------------------------------------------------------
console.log('Test 7: Nadia Reader Voice Gate Integration & 6 Canonical Questions');
const nadiaWarmEval = evaluateReaderVoice(warmComparisonDraft, {
  contentFamily: 'comparison',
  title: 'Memilih Sistem Shading Luar: Overhang atau Louver?'
});

assert.equal(nadiaWarmEval.decision, 'READER_VOICE_PASS', 'Warm draft must pass Nadia gate');
assert.ok(nadiaWarmEval.dimensions.warmAdvisoryTone, 'warmAdvisoryTone dimension must exist');
assert.equal(nadiaWarmEval.dimensions.warmAdvisoryTone.passed, true);
assert.equal(nadiaWarmEval.dimensions.warmAdvisoryTone.score, 100);
assert.ok(nadiaWarmEval.warmthChecklist, 'warmthChecklist must be attached to result');
assert.equal(nadiaWarmEval.warmthChecklist.comparison_decision_handoff, 'PASS');

// Cold draft evaluation under Nadia
const nadiaColdEval = evaluateReaderVoice(coldComparisonDraft, {
  contentFamily: 'comparison',
  title: 'Membandingkan Kusen Aluminium vs Kayu untuk Rumah Tropis'
});
assert.equal(nadiaColdEval.decision, 'READER_VOICE_REVISION_REQUIRED', 'Cold draft must trigger REVISION_REQUIRED');
assert.equal(nadiaColdEval.dimensions.warmAdvisoryTone.passed, false);
assert.ok(nadiaColdEval.revisionRequests.some((r) => r.section.includes('Warm Advisory Tone')), 'Revision request for warmth must be issued');
console.log('  ✅ PASS: Nadia successfully evaluates Warm Advisory Tone and enforces revision on cold drafts.\n');
passed++;

// --------------------------------------------------------------------------
// Test 8: Rina Editorial QA — Truth Verification & Universal Overreach
// --------------------------------------------------------------------------
console.log('Test 8: Rina Editorial QA — Truth Verification & Universal Overreach');
const overreachDraft = `
# Memilih Kusen Rumah Tropis

Kusen adalah elemen penting bukaan jendela.

## Rekomendasi
Aluminium adalah satu-satunya pilihan yang benar dan solusi terbaik untuk semua kondisi rumah tanpa kecuali.

---

## Catatan Teknis
Rujukan SNI.
`.trim();

const rinaOverreachEval = evaluateHumanWritingQuality(overreachDraft, {
  readerVoiceState: 'READER_VOICE_PASS'
});
assert.ok(rinaOverreachEval.issues.some((i) => i.code === 'UNIVERSAL_RECOMMENDATION_OVERREACH'), 'Rina must flag universal overreach');

const softenedWarningDraft = `
# Memilih Penutup Atap

Atap melindungi rumah dari air hujan dan panas.

## Rekomendasi
Pemasangan genteng seng tidak perlu khawatir sama sekali dan pasti aman tanpa perlu dicek kebocorannya.

---

## Catatan Teknis
Standar atap.
`.trim();

const rinaWarningEval = evaluateHumanWritingQuality(softenedWarningDraft, {
  readerVoiceState: 'READER_VOICE_PASS'
});
assert.ok(rinaWarningEval.issues.some((i) => i.code === 'WARM_TONE_WARNING_WEAKENED'), 'Rina must flag softened safety warnings');
console.log('  ✅ PASS: Rina editorial QA catches universal overreach and softened warnings.\n');
passed++;

// --------------------------------------------------------------------------
// Test 9: Canonical Staff Chain & Zero Bypass (Irwan -> Joko -> Nadia -> Rina -> Sari)
// --------------------------------------------------------------------------
console.log('Test 9: Canonical Staff Chain & Zero Bypass');
setNadiaGateActive(true);
const mockSnapshot = {
  health: { automation: { mode: 'OFF' }, mediaWorker: { effectiveState: 'DISABLED' } }
};

// 1. Direct Joko -> Rina transition is rejected
const directJokoToRina = validateHandoffSafety({
  handoff_id: 'hnd_test_joko_to_rina',
  workflow_id: 'wf_art_c',
  task_id: 'task_art_c',
  artifact_id: 'art_c',
  task_title: 'Test Article',
  from_agent_id: 'content_writer_primary', // Joko
  to_agent_id: 'editorial_qa_primary', // Rina
  from_department_id: 'editorial',
  to_department_id: 'editorial',
  from_stage: 'writing',
  to_stage: 'editorial_qa',
  handoff_state: 'RUNNING',
  transition_timestamp: new Date().toISOString(),
  evidence_source: 'test',
  evidence_id: 'test',
  confidence: 'EXACT',
  requires_movement: true
}, mockSnapshot);
assert.equal(directJokoToRina.allowed, false, 'Direct Joko -> Rina transition must be strictly rejected');
assert.ok(directJokoToRina.reason?.includes('Nadia'), 'Rejection reason must cite Nadia prerequisite');

// 2. Canonical Joko -> Nadia transition is allowed
const jokoToNadia = validateHandoffSafety({
  handoff_id: 'hnd_test_joko_to_nadia',
  workflow_id: 'wf_art_c',
  task_id: 'task_art_c',
  artifact_id: 'art_c',
  task_title: 'Test Article',
  from_agent_id: 'content_writer_primary', // Joko
  to_agent_id: 'audience_language_editor', // Nadia
  from_department_id: 'editorial',
  to_department_id: 'editorial',
  from_stage: 'writing',
  to_stage: 'reader_voice_review',
  handoff_state: 'RUNNING',
  transition_timestamp: new Date().toISOString(),
  evidence_source: 'test',
  evidence_id: 'test',
  confidence: 'EXACT',
  requires_movement: true
}, mockSnapshot);
assert.equal(jokoToNadia.allowed, true, 'Joko -> Nadia handoff must be allowed');

// 3. Nadia PASS -> Rina transition is allowed
const nadiaToRina = validateHandoffSafety({
  handoff_id: 'hnd_test_nadia_to_rina',
  workflow_id: 'wf_art_c',
  task_id: 'task_art_c',
  artifact_id: 'art_c',
  task_title: 'Test Article',
  from_agent_id: 'audience_language_editor', // Nadia
  to_agent_id: 'editorial_qa_primary', // Rina
  from_department_id: 'editorial',
  to_department_id: 'editorial',
  from_stage: 'reader_voice_review',
  to_stage: 'editorial_qa',
  handoff_state: 'RUNNING',
  transition_timestamp: new Date().toISOString(),
  evidence_source: 'test',
  evidence_id: 'test',
  confidence: 'EXACT',
  requires_movement: true
}, mockSnapshot);
assert.equal(nadiaToRina.allowed, true, 'Nadia PASS -> Rina handoff must be allowed');
console.log('  ✅ PASS: Canonical staff chain strictly enforced with zero bypass.\n');
passed++;

// --------------------------------------------------------------------------
// Test 10: Jefry Management Advisory Boundary (Shadow Mode Only)
// --------------------------------------------------------------------------
console.log('Test 10: Jefry Management Advisory Boundary');
const jefryStaff = getStaffDefinitionByAgentId('management_advisor_jefry');
assert.ok(jefryStaff, 'Jefry staff definition must exist');
assert.equal(jefryStaff.role, 'Management Decision Advisor');
assert.equal(jefryStaff.department_id, 'management');
assert.ok(!jefryStaff.capabilities.includes('ARTICLE_WRITING'), 'Jefry cannot write articles');
assert.ok(!jefryStaff.capabilities.includes('HUMAN_WRITING_AUTHORING'), 'Jefry cannot author prose');
assert.ok(!jefryStaff.capabilities.includes('HUMAN_WRITING_QA'), 'Jefry cannot QA');
assert.ok(!jefryStaff.capabilities.includes('PUBLICATION_OPERATIONS'), 'Jefry cannot publish');
console.log('  ✅ PASS: Jefry remains strictly shadow/advisory observer without execution authority.\n');
passed++;

// --------------------------------------------------------------------------
// Test 11: Article C Hash Invalidation & Revision Verification
// --------------------------------------------------------------------------
console.log('Test 11: Article C Hash Invalidation & New Hash Verification');
const artCDraftPath = path.resolve('scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md');
assert.ok(fs.existsSync(artCDraftPath), 'Article C clean draft file must exist');
const artCContent = fs.readFileSync(artCDraftPath, 'utf-8');

const OLD_APPROVED_HASH = '85270eb8534331da54efe4bb2dbe471a25ec532bf75d55270758d18c375f15c5';
const currentArtCHash = crypto.createHash('sha256').update(artCContent).digest('hex');

console.log(`  Old Approved Hash : ${OLD_APPROVED_HASH}`);
console.log(`  Current Draft Hash: ${currentArtCHash}`);

assert.notEqual(currentArtCHash, OLD_APPROVED_HASH, 'Current draft hash must differ from old approved hash');
assert.ok(
  artCContent.includes('Setelah semua pertimbangannya jelas, keputusan akhirnya tetap kembali ke kondisi nyata rumah Anda'),
  'Article C must contain the warm decision handoff'
);

// Publication plan reflects hash invalidation
const planPath = path.resolve('artifacts/article-c-publication-plan.json');
assert.ok(fs.existsSync(planPath), 'Publication plan must exist');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
assert.equal(plan.status, 'ARTICLE_C_REVISED_AWAITING_CHIEF_EDITOR_READING_REVIEW', 'Plan status must be REVISED_AWAITING_CHIEF_EDITOR_READING_REVIEW');
assert.equal(plan.target_article.current_content_hash, currentArtCHash, 'Plan current content hash must match new hash');
assert.equal(plan.human_approvals.content_approval.status, 'REVISED_PENDING_FINAL_READING_REVIEW', 'Content approval must be REVISED_PENDING_FINAL_READING_REVIEW');
console.log('  ✅ PASS: Article C old hash cleanly invalidated and new hash bound to revision review.\n');
passed++;

// --------------------------------------------------------------------------
// Test 12: Article C Revised Draft Clean Passes Nadia & Rina
// --------------------------------------------------------------------------
console.log('Test 12: Article C Revised Draft Clean Passes Nadia & Rina');
const artCNadiaEval = evaluateReaderVoice(artCContent, {
  contentFamily: 'comparison',
  title: 'Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?'
});

assert.equal(artCNadiaEval.decision, 'READER_VOICE_PASS', 'Revised Article C must pass Nadia Reader Voice');
assert.equal(artCNadiaEval.warmthChecklist?.warm_advisory_tone, 'PASS');
assert.equal(artCNadiaEval.warmthChecklist?.comparison_decision_handoff, 'PASS');
assert.equal(artCNadiaEval.dimensions.warmAdvisoryTone.passed, true);
assert.equal(artCNadiaEval.dimensions.warmAdvisoryTone.score, 100);

const artCRinaEval = evaluateHumanWritingQuality(artCContent, {
  readerVoiceState: artCNadiaEval.decision,
  readerVoiceResult: artCNadiaEval,
  warmthChecklist: artCNadiaEval.warmthChecklist
});

assert.equal(artCRinaEval.decision, 'HUMAN_WRITING_PASS', 'Revised Article C must pass Rina QA');
assert.ok(artCRinaEval.total_score >= 85, `Rina score must be >= 85 (got ${artCRinaEval.total_score})`);
assert.equal(
  artCRinaEval.issues.some((i) => i.code === 'UNIVERSAL_RECOMMENDATION_OVERREACH'),
  false,
  'Zero universal overreach in Article C'
);
assert.equal(
  artCRinaEval.issues.some((i) => i.code === 'WARM_TONE_WARNING_WEAKENED'),
  false,
  'Zero softened safety warnings in Article C'
);
console.log('  ✅ PASS: Revised Article C cleanly passes both Nadia and Rina.\n');
passed++;

// --------------------------------------------------------------------------
// Test 13: Article C Publication Safety State
// --------------------------------------------------------------------------
console.log('Test 13: Article C Publication Safety State');
assert.equal(plan.target_article.publication_state, 'UNPUBLISHED', 'Article C publication state must remain UNPUBLISHED');
console.log('  ✅ PASS: Article C publication state strictly remains UNPUBLISHED.\n');
passed++;

console.log('======================================================');
console.log(`🎉 ALL ${passed}/${passed} WARM ADVISORY TONE TESTS PASSED!`);
console.log('======================================================');
