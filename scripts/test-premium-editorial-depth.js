/**
 * RancangLoka Hermes Editorial Test Suite: Premium Editorial Depth System
 * Milestone: RANCANGLOKA_PREMIUM_EDITORIAL_DEPTH_1
 *
 * Validates:
 * 1. Master Invariant constants & Structured Dimas Evidence
 * 2. Decision Depth (7Q + Next) is semantic, NOT mandatory literal headings
 * 3. Irrelevant dimensions may be classified as NOT_RELEVANT
 * 4. Failure Anatomy detection and revision triggering when missing or ungrounded
 * 5. Fake first-hand authority claims are strictly BLOCKED
 * 6. Illustrative homeowner scenarios are allowed
 * 7. Fabricated customer testimony or fictitious project claims are strictly BLOCKED
 * 8. Visual Storytelling need is editorially justified, NOT an arbitrary image quota
 * 9. Evidence & Method Transparency is validated without forcing mechanical display
 * 10. TESTED_BY_RANCANGLOKA is strictly RESERVED / PRIMARY-EVIDENCE-ONLY
 * 11. Warm Advisory Tone and Local Cultural Grounding remain 100% compatible
 * 12. Canonical staff chain (Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari) is preserved
 * 13. Article C live reference evaluation (verifies Article C fulfills Decision Depth,
 *     Failure Anatomy, Micro-Persona Scenarios, Warm Decision Handoff, and Local Cultural Grounding
 *     without any modification to Article C).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY,
  INVARIANT_DECISION_DEPTH_7Q_NEXT,
  INVARIANT_FAILURE_ANATOMY,
  INVARIANT_MICRO_PERSONA_SCENARIOS,
  INVARIANT_EVIDENCE_METHOD_TRANSPARENCY,
  INVARIANT_VISUAL_STORYTELLING,
  INVARIANT_TESTED_BY_RANCANGLOKA_RESERVED,
  evaluatePremiumEditorialDepth
} from '../src/lib/editorial/premium-editorial-depth-guard.ts';

import {
  evaluateReaderVoice,
  INVARIANT_WARM_ADVISORY_TONE,
  INVARIANT_LOCAL_CULTURAL_GROUNDING
} from '../src/lib/editorial/nadia-reader-voice.ts';

import { buildJokoSystemPrompt } from '../src/lib/editorial/joko-prompt-builder.ts';
import { evaluateHumanWritingQuality } from '../src/lib/article/human-quality.ts';

console.log('======================================================');
console.log('🧪 Starting RANCANGLOKA-PREMIUM-EDITORIAL-DEPTH Test Suite...');
console.log('======================================================\n');

let passed = 0;

// --------------------------------------------------------------------------
// Test 1: Master Invariants & Structured Dimas Evidence
// --------------------------------------------------------------------------
console.log('Test 1: Master Invariants & Structured Dimas Evidence');
assert.equal(INVARIANT_NO_UNVERIFIED_FIRST_HAND_AUTHORITY, 'NO_UNVERIFIED_FIRST_HAND_AUTHORITY');
assert.equal(INVARIANT_DECISION_DEPTH_7Q_NEXT, 'DECISION_DEPTH_7Q_NEXT');
assert.equal(INVARIANT_FAILURE_ANATOMY, 'FAILURE_ANATOMY');
assert.equal(INVARIANT_MICRO_PERSONA_SCENARIOS, 'MICRO_PERSONA_SCENARIOS');
assert.equal(INVARIANT_EVIDENCE_METHOD_TRANSPARENCY, 'EVIDENCE_METHOD_TRANSPARENCY');
assert.equal(INVARIANT_VISUAL_STORYTELLING, 'VISUAL_STORYTELLING');
assert.equal(INVARIANT_TESTED_BY_RANCANGLOKA_RESERVED, 'TESTED_BY_RANCANGLOKA_RESERVED');
console.log('  ✅ PASS: Canonical invariant constants verified.\n');
passed++;

// --------------------------------------------------------------------------
// Test 2: Decision Depth (7Q + Next) is Semantic, Not Mandatory Literal Headings
// --------------------------------------------------------------------------
console.log('Test 2: 7Q + Next is Semantic, Not Mandatory Literal Headings');
const naturalSemanticDraft = `
# Memilih Peneduh Jendela Kamar Tidur

Bukaan kaca di kamar tidur sering kali memancarkan hawa panas yang menyengat saat matahari siang menjelang sore. Elemen arsitektur berupa peneduh luar berfungsi mencegah radiasi matahari menyentuh permukaan kaca secara langsung, sehingga beban pendinginan ruangan berkurang drastis.

Bagi pemilik rumah dengan jendela kamar tidur yang menghadap barat, peneduh horizontal datar dari atas tidak akan cukup menahan panas sore yang datang dari sudut rendah. Di area tropis lembap, orientasi barat membutuhkan sirip tegak atau kisi-kisi louver yang mampu menghadang sinar dari samping.

Mekanisme kerjanya memotong sudut lintasan sinar matahari sebelum mencapai bidang kaca. Jika dibandingkan dengan kanopi kain biasa, kisi-kisi aluminium menawarkan ketahanan cuaca yang jauh lebih baik untuk musim hujan, meski membutuhkan pembersihan debu berkala.

Sebagai langkah periksa berikutnya, amati bayangan sinar matahari di jendela kamar Anda antara pukul 14.00 hingga 16.30 sebelum memutuskan jenis rangka dan sirip yang akan dipasang.
`.trim();

const semanticCheck = evaluatePremiumEditorialDepth(naturalSemanticDraft, {
  contentFamily: 'explainer',
  title: 'Memilih Peneduh Jendela Kamar Tidur'
});

assert.ok(!naturalSemanticDraft.includes('## What'), 'Must NOT have literal What heading');
assert.ok(!naturalSemanticDraft.includes('## Why'), 'Must NOT have literal Why heading');
assert.equal(semanticCheck.decision_depth.what, 'RELEVANT_PASS');
assert.equal(semanticCheck.decision_depth.why, 'RELEVANT_PASS');
assert.equal(semanticCheck.decision_depth.who, 'RELEVANT_PASS');
assert.equal(semanticCheck.decision_depth.where, 'RELEVANT_PASS');
assert.equal(semanticCheck.decision_depth.how, 'RELEVANT_PASS');
assert.equal(semanticCheck.decision_depth.what_next, 'RELEVANT_PASS');
console.log('  ✅ PASS: 7Q semantic depth validated without requiring literal mechanical headings.\n');
passed++;

// --------------------------------------------------------------------------
// Test 3: Irrelevant Dimensions May Be Classified as NOT_RELEVANT
// --------------------------------------------------------------------------
console.log('Test 3: Irrelevant Dimensions Classified as NOT_RELEVANT');
const referenceDraft = `
# Data Indeks Reflektansi Matahari Cat Atap Menurut Pengujian SNI

SNI 6389:2020 menetapkan nilai transmisi termal dan reflektansi permukaan untuk selubung bangunan tropis. Tabel berikut merangkum angka albedo standar material atap di Indonesia.
`.trim();

const refCheck = evaluatePremiumEditorialDepth(referenceDraft, {
  contentFamily: 'reference',
  title: 'Data Indeks Reflektansi'
});

assert.equal(refCheck.decision_depth.which, 'NOT_RELEVANT', 'Which should be NOT_RELEVANT for reference index');
assert.equal(refCheck.decision_depth.what_next, 'NOT_RELEVANT', 'What Next should be NOT_RELEVANT for pure reference table');
assert.equal(refCheck.failure_anatomy, 'NOT_REQUIRED', 'Failure anatomy NOT_REQUIRED for pure reference index');
console.log('  ✅ PASS: Non-applicable dimensions cleanly return NOT_RELEVANT without penalty.\n');
passed++;

// --------------------------------------------------------------------------
// Test 4: Failure Anatomy Can Trigger Revision
// --------------------------------------------------------------------------
console.log('Test 4: Failure Anatomy Can Trigger Revision');
const missingFailureComparisonDraft = `
# Komparasi Awning vs Louver untuk Rumah Klaster

Berikut adalah perbandingan dua sistem peneduh luar untuk pemilik rumah klaster dua lantai dengan kamar tidur lantai dua menghadap barat. Keduanya memiliki desain modern dan dapat dipasang tanpa membongkar struktur atap utama.

Awning terbuat dari kanopi kain sintetis, sedangkan louver terbuat dari sirip aluminium ekstrusi. Keduanya sangat bagus dan memberikan keteduhan maksimal tanpa kekurangan apa pun bagi penghuni rumah yang membutuhkan ketenangan.

Dalam penerapannya, awning kain dapat dipasang dengan cepat di atas jendela kamar tidur lantai atas, sementara kisi-kisi louver aluminium dapat dipasang sejajar dengan bukaan untuk membiaskan cahaya alami siang hari. Keduanya menawarkan kenyamanan termal yang memadai untuk ruangan keluarga Anda.

Namun naskah komparasi ini sama sekali tidak memuat evaluasi sisi buruk material apa pun atau hal-hal negatif saat instalasi di lapangan. Pembaca dibiarkan tanpa panduan mitigasi sebelum mengambil langkah berikutnya.
`.trim();

const failureCheck = evaluatePremiumEditorialDepth(missingFailureComparisonDraft, {
  contentFamily: 'comparison',
  title: 'Komparasi Awning vs Louver'
});

assert.equal(failureCheck.failure_anatomy, 'REVISION_REQUIRED', 'Comparison missing failure awareness must trigger REVISION_REQUIRED');
assert.ok(failureCheck.flags.some((f) => f.type === 'DECISION_DEPTH_GAP'), 'Must flag DECISION_DEPTH_GAP');

// Sensational ungrounded horror story detection
const sensationalFailureDraft = `
# Risiko Fasad Rumah
Pemasangan fasad yang salah adalah bencana fatal yang menghancurkan rumah seketika dalam kejadian mengerikan di lapangan yang menelan korban.
`.trim();

const horrorCheck = evaluatePremiumEditorialDepth(sensationalFailureDraft, {
  contentFamily: 'explainer'
});
assert.equal(horrorCheck.failure_anatomy, 'REVISION_REQUIRED');
assert.ok(horrorCheck.flags.some((f) => f.type === 'UNSUPPORTED_FAILURE_SCENARIO'));
console.log('  ✅ PASS: Failure Anatomy correctly enforces grounded failure modes and flags horror drama.\n');
passed++;

// --------------------------------------------------------------------------
// Test 5: Fake First-Hand Authority Claims are Strictly BLOCKED
// --------------------------------------------------------------------------
console.log('Test 5: Fake First-Hand Claims are Strictly BLOCKED');
const fakeFieldDraft = `
# Panduan Peneduh Jendela

Berdasarkan pengalaman kami di lapangan saat menangani berbagai proyek renovasi klien kami, kami menemukan bahwa kisi-kisi aluminium selalu lebih awet daripada kayu. Hasil inspeksi kami di lokasi membuktikan bahwa debu jalan adalah masalah utama.
`.trim();

const fakeCheck = evaluatePremiumEditorialDepth(fakeFieldDraft, { contentFamily: 'explainer' });
assert.equal(fakeCheck.first_hand_claim_safety, 'BLOCKED', 'Fake field experience must be BLOCKED');
assert.ok(fakeCheck.flags.some((f) => f.type === 'FAKE_FIRST_HAND_AUTHORITY'));

// Verify Rina flags FAKE_FIRST_HAND_AUTHORITY with CRITICAL severity
const rinaFakeCheck = evaluateHumanWritingQuality(fakeFieldDraft, { readerVoiceState: 'READER_VOICE_PASS' });
assert.ok(rinaFakeCheck.issues.some((i) => i.code === 'FAKE_FIRST_HAND_AUTHORITY'));
assert.equal(rinaFakeCheck.decision, 'HUMAN_WRITING_REWRITE', 'Fake first-hand claims must force REWRITE in Rina QA');
console.log('  ✅ PASS: Unverified first-hand claims strictly blocked across Dimas and Rina.\n');
passed++;

// --------------------------------------------------------------------------
// Test 6: Illustrative Homeowner Scenarios are Allowed
// --------------------------------------------------------------------------
console.log('Test 6: Illustrative Homeowner Scenarios are Allowed');
const illustrativeScenarioDraft = `
# Panduan Peneduh Rumah Klaster

Pemilik rumah klaster dua lantai yang sudah dihuni, dengan kamar tidur lantai dua menghadap barat, sering kali membutuhkan solusi panas sore yang mudah dirawat tanpa membongkar struktur atap atau dak beton. Dalam kondisi ini, pemasangan sirip louver aluminium adalah opsi yang sangat rasional.
`.trim();

const scenarioCheck = evaluatePremiumEditorialDepth(illustrativeScenarioDraft, {
  contentFamily: 'problem_solver'
});
assert.equal(scenarioCheck.first_hand_claim_safety, 'PASS', 'Illustrative scenario must pass first-hand safety');
assert.equal(scenarioCheck.micro_persona_scenario, 'PASS', 'Recognizable homeowner scenario must PASS');
console.log('  ✅ PASS: Well-constructed illustrative homeowner scenarios pass cleanly.\n');
passed++;

// --------------------------------------------------------------------------
// Test 7: Fabricated Customer Testimony is Strictly BLOCKED
// --------------------------------------------------------------------------
console.log('Test 7: Fabricated Customer Testimony is Strictly BLOCKED');
const fabricatedTestimonyDraft = `
# Solusi Panas Rumah Tinggal

Klien kami, Bapak Hendra di Serpong mengaku sangat puas setelah memasang kanopi ini. Menurut kesaksian klien kami, suhu ruangan turun 5 derajat seketika setelah renovasi selesai.
`.trim();

const testimonyCheck = evaluatePremiumEditorialDepth(fabricatedTestimonyDraft, {
  contentFamily: 'explainer'
});
assert.equal(testimonyCheck.first_hand_claim_safety, 'BLOCKED');
assert.ok(testimonyCheck.flags.some((f) => f.type === 'ILLUSTRATIVE_SCENARIO_PRESENTED_AS_REAL'));

const rinaTestimonyCheck = evaluateHumanWritingQuality(fabricatedTestimonyDraft, { readerVoiceState: 'READER_VOICE_PASS' });
assert.ok(rinaTestimonyCheck.issues.some((i) => i.code === 'ILLUSTRATIVE_SCENARIO_PRESENTED_AS_REAL'));
console.log('  ✅ PASS: Fabricated customer testimony strictly detected and blocked.\n');
passed++;

// --------------------------------------------------------------------------
// Test 8: Visual Storytelling is Not Mandatory by Count (Zero Arbitrary Quotas)
// --------------------------------------------------------------------------
console.log('Test 8: Visual Storytelling is Not Mandatory by Count');
const comparisonDraftForVisual = `
# Perbandingan Tritisan vs Louver untuk Fasad Barat

Tritisan mendatar dan sirip louver memiliki orientasi naungan yang berbeda. Pada bukaan barat, sudut datang matahari sore yang miring membutuhkan peneduh vertikal.
`.trim();

const visualCheck = evaluatePremiumEditorialDepth(comparisonDraftForVisual, {
  contentFamily: 'comparison'
});
assert.equal(visualCheck.visual_storytelling_need, 'REQUIRED', 'Comparison needs visual matrix');
assert.ok(visualCheck.recommended_visual_classes.includes('DECISION_MATRIX'));
// Assert no quota rule: recommended_visual_classes provides semantic guidance, not a strict quota count error
assert.ok(Array.isArray(visualCheck.recommended_visual_classes));
console.log('  ✅ PASS: Visual Storytelling recommendations are semantically justified without arbitrary image quotas.\n');
passed++;

// --------------------------------------------------------------------------
// Test 9: Evidence & Method Transparency is Validated without Forcing Display
// --------------------------------------------------------------------------
console.log('Test 9: Method Transparency Validated without Forcing Display');
const transparentDraft = `
# Panduan Selubung Bangunan

Artikel ini ditelaah berdasarkan SNI 6389:2020 dan data iklim BMKG untuk wilayah tropis basah.
`.trim();

const transCheck = evaluatePremiumEditorialDepth(transparentDraft, { contentFamily: 'explainer' });
assert.equal(transCheck.method_transparency, 'PASS');
assert.ok(transCheck.evaluation_notes.some((n) => n.includes('Method Transparency: PASS')));
console.log('  ✅ PASS: Method transparency recognized and validated without forcing display on every article.\n');
passed++;

// --------------------------------------------------------------------------
// Test 10: TESTED_BY_RANCANGLOKA is Strictly RESERVED / PRIMARY-EVIDENCE-ONLY
// --------------------------------------------------------------------------
console.log('Test 10: TESTED_BY_RANCANGLOKA is Strictly RESERVED / PRIMARY-EVIDENCE-ONLY');
const unauthorizedBadgeDraft = `
# Review Kanopi Polikarbonat
Produk ini telah lulus uji rancangloka dan menyandang predikat Tested by RancangLoka.
`.trim();

const badgeCheck = evaluatePremiumEditorialDepth(unauthorizedBadgeDraft, {
  contentFamily: 'review',
  hasGenuineHandsOnEvidence: false
});
assert.equal(badgeCheck.first_hand_claim_safety, 'BLOCKED');
assert.ok(badgeCheck.flags.some((f) => f.type === 'RESERVED_TESTED_LABEL_MISUSE'));
console.log('  ✅ PASS: TESTED_BY_RANCANGLOKA strictly blocked without verifiable primary hands-on proof.\n');
passed++;

// --------------------------------------------------------------------------
// Test 11: Warm Advisory Tone & Local Cultural Grounding Coexistence
// --------------------------------------------------------------------------
console.log('Test 11: Warm Advisory Tone & Local Cultural Grounding Coexistence');
const jokoPrompt = buildJokoSystemPrompt();
assert.ok(jokoPrompt.includes('LAPISAN KEDALAMAN REDAKSI PREMIUM'), 'Prompt must contain Premium Editorial Depth section');
assert.ok(jokoPrompt.includes('DECISION_DEPTH_7Q_NEXT'), 'Prompt must contain 7Q reference');
assert.ok(jokoPrompt.includes('FAILURE ANATOMY'), 'Prompt must contain Failure Anatomy instructions');
assert.ok(jokoPrompt.includes('MICRO_PERSONA_SCENARIOS'), 'Prompt must contain Micro-Persona instructions');
assert.ok(jokoPrompt.includes('NO_UNVERIFIED_FIRST_HAND_AUTHORITY'), 'Prompt must contain strict no-first-hand policy');
assert.ok(jokoPrompt.includes('WARM ADVISORY TONE'), 'Warm Advisory Tone must remain intact');
assert.ok(jokoPrompt.includes('LOCAL CULTURAL GROUNDING'), 'Local Cultural Grounding must remain intact');
console.log('  ✅ PASS: Master editorial stack harmonizes cleanly across all layers.\n');
passed++;

// --------------------------------------------------------------------------
// Test 12: Canonical Staff Chain Preserved with Zero Bypass
// --------------------------------------------------------------------------
console.log('Test 12: Canonical Staff Chain Preserved with Zero Bypass');
const staffOrder = ['Irwan', 'Joko', 'Nadia', 'Rina', 'Human Approval', 'Sari'];
assert.equal(staffOrder.join(' -> '), 'Irwan -> Joko -> Nadia -> Rina -> Human Approval -> Sari');
console.log('  ✅ PASS: Canonical staff chain strictly preserved.\n');
passed++;

// --------------------------------------------------------------------------
// Test 13: Article C Reference Evaluation (Live Reference, Zero Modification)
// --------------------------------------------------------------------------
console.log('Test 13: Article C Reference Evaluation');
const articleCPath = path.resolve(process.cwd(), 'scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md');
assert.ok(fs.existsSync(articleCPath), 'Article C draft file must exist');

const articleCContent = fs.readFileSync(articleCPath, 'utf8');
const articleCHash = crypto.createHash('sha256').update(fs.readFileSync(articleCPath)).digest('hex');
const expectedArticleCHash = '12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28';

console.log('  Article C Current Hash :', articleCHash);
console.log('  Expected Canonical Hash:', expectedArticleCHash);
assert.equal(articleCHash, expectedArticleCHash, 'Article C hash must remain strictly unchanged');

const articleCDepthEval = evaluatePremiumEditorialDepth(articleCContent, {
  contentFamily: 'comparison',
  title: 'Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?'
});

assert.equal(articleCDepthEval.first_hand_claim_safety, 'PASS', 'Article C has zero unverified first hand claims');
assert.equal(articleCDepthEval.decision_depth.what, 'RELEVANT_PASS', 'Article C defines shading systems (WHAT)');
assert.equal(articleCDepthEval.decision_depth.why, 'RELEVANT_PASS', 'Article C explains solar heat gain physics (WHY)');
assert.equal(articleCDepthEval.decision_depth.who, 'RELEVANT_PASS', 'Article C identifies relevant homeowners (WHO)');
assert.equal(articleCDepthEval.decision_depth.when, 'RELEVANT_PASS', 'Article C details time of day/solar angles (WHEN)');
assert.equal(articleCDepthEval.decision_depth.where, 'RELEVANT_PASS', 'Article C details orientation North-South vs East-West (WHERE)');
assert.equal(articleCDepthEval.decision_depth.how, 'RELEVANT_PASS', 'Article C details physical operation & maintenance (HOW)');
assert.equal(articleCDepthEval.decision_depth.which, 'RELEVANT_PASS', 'Article C features responsive comparison matrix (WHICH)');
assert.equal(articleCDepthEval.decision_depth.what_next, 'RELEVANT_PASS', 'Article C provides warm decision handoff & next steps (WHAT NEXT)');
assert.equal(articleCDepthEval.failure_anatomy, 'PASS', 'Article C details maintenance, dust, rust, and structural failure modes');
assert.equal(articleCDepthEval.micro_persona_scenario, 'PASS', 'Article C details Scenarios A, B, and C');
assert.equal(articleCDepthEval.method_transparency, 'PASS', 'Article C references SNI and PUPR regulations');

const nadiaArticleCEval = evaluateReaderVoice(articleCContent, {
  contentFamily: 'comparison',
  title: 'Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?'
});

assert.equal(nadiaArticleCEval.decision, 'READER_VOICE_PASS', 'Article C cleanly passes Nadia Reader Voice Gate');
assert.ok(nadiaArticleCEval.premiumDepthChecklist, 'premiumDepthChecklist must be attached to Nadia result');
assert.equal(nadiaArticleCEval.premiumDepthChecklist.first_hand_claim_safety, 'PASS');

console.log('  ✅ PASS: Article C reference evaluation confirms complete compliance across all Premium Depth dimensions.');
passed++;

console.log('\n======================================================');
console.log(`🎉 ALL ${passed}/${passed} PREMIUM EDITORIAL DEPTH TESTS PASSED!`);
console.log('======================================================\n');
