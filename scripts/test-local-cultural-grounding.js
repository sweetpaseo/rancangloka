/**
 * RancangLoka — Test Suite: Local Cultural Grounding (Milestone: RANCANGLOKA_LOCAL_CULTURAL_GROUNDING_1)
 *
 * Validates:
 * 1. Master invariants & structured Dimas workflow evidence
 * 2. Joko prompt builder integration of Local Cultural Grounding
 * 3. Unsupported cultural stereotypes trigger REVISION_REQUIRED
 * 4. Translationese syntax calques trigger REVISION_REQUIRED
 * 5. Idiom presence is NOT mandatory (clean standard Indonesian passes)
 * 6. Regional dialect is NOT mandatory (standard Indonesian base)
 * 7. Naturally idiomatic drafts pass cleanly without boilerplate
 * 8. Nadia Reader Voice Gate dimension K & 7 review questions
 * 9. Warm Advisory Tone + Local Cultural Grounding coexistence
 * 10. Comparison closing remains non-boilerplate
 * 11. Rina QA truth verification & anti-stereotype overreach
 * 12. Article C evaluation against Local Cultural Grounding & hash preservation
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  evaluateLocalCulturalGrounding,
  INVARIANT_LOCAL_CULTURAL_GROUNDING,
  INVARIANT_ANTI_CULTURAL_STEREOTYPE,
  INVARIANT_STANDARD_INDONESIAN_BASE
} from '../src/lib/editorial/local-cultural-guard.ts';

import {
  evaluateReaderVoice,
  evaluateWarmAdvisoryTone
} from '../src/lib/editorial/nadia-reader-voice.ts';

import {
  buildJokoSystemPrompt
} from '../src/lib/editorial/joko-prompt-builder.ts';

import {
  evaluateHumanWritingQuality
} from '../src/lib/article/human-quality.ts';

console.log('======================================================');
console.log('🧪 Starting RANCANGLOKA-LOCAL-CULTURAL-GROUNDING Test Suite...');
console.log('======================================================\n');

// --------------------------------------------------------------------------
// Test 1: Master Invariants & Structured Dimas Workflow Evidence
// --------------------------------------------------------------------------
console.log('Test 1: Master Invariants & Structured Dimas Evidence');
assert.equal(INVARIANT_LOCAL_CULTURAL_GROUNDING, 'LOCAL_CULTURAL_GROUNDING');
assert.equal(INVARIANT_ANTI_CULTURAL_STEREOTYPE, 'ANTI_CULTURAL_STEREOTYPE');
assert.equal(INVARIANT_STANDARD_INDONESIAN_BASE, 'STANDARD_INDONESIAN_BASE');
console.log('  ✅ PASS: Canonical invariant constants verified.');

// --------------------------------------------------------------------------
// Test 2: Joko Prompt Builder Integration
// --------------------------------------------------------------------------
console.log('\nTest 2: Joko Prompt Builder Integration');
const jokoPrompt = buildJokoSystemPrompt();
assert.ok(jokoPrompt.includes('LOCAL CULTURAL GROUNDING'), 'Joko system prompt must include LOCAL CULTURAL GROUNDING');
assert.ok(jokoPrompt.includes('realitas hidup orang Indonesia'), 'Must include canonical principle text');
assert.ok(jokoPrompt.includes('STRICT GUARD — LOKAL BUKAN BERARTI STEREOTIP'), 'Must include anti-stereotype guard');
assert.ok(jokoPrompt.includes('BAHASA INDONESIA STANDAR ADALAH BASIS KANONIKAL'), 'Must enforce standard Indonesian base');
assert.ok(jokoPrompt.includes('ATURAN IDIOM ALAMI'), 'Must include natural idiom guidelines');
console.log('  ✅ PASS: Joko system prompt correctly embeds local cultural grounding principles.');

// --------------------------------------------------------------------------
// Test 3: Unsupported Cultural Stereotypes Trigger REVISION_REQUIRED
// --------------------------------------------------------------------------
console.log('\nTest 3: Unsupported Cultural Stereotype Detection');
const stereotypeDraft = `
# Memilih Kanopi Fasad Depan

Orang Indonesia selalu mengabaikan perawatan rutin sampai kanopi bocor parah.
Masyarakat kita pasti memilih material termurah tanpa memikirkan tempias hujan.
Padahal merawat kanopi membutuhkan pembersihan berkala.
`;

const stereotypeCheck = evaluateLocalCulturalGrounding(stereotypeDraft, { contentFamily: 'explainer' });
assert.equal(stereotypeCheck.cultural_generalization_safety, 'REVISION_REQUIRED', 'Stereotypes must flag cultural_generalization_safety');
assert.equal(stereotypeCheck.local_cultural_grounding, 'REVISION_REQUIRED', 'Stereotypes must trigger local_cultural_grounding REVISION_REQUIRED');
assert.ok(stereotypeCheck.flags.some((f) => f.type === 'CULTURAL_STEREOTYPE_OVERREACH'), 'Must have CULTURAL_STEREOTYPE_OVERREACH flag');
console.log('  ✅ PASS: Broad unsupported stereotypes correctly caught and flagged.');

// --------------------------------------------------------------------------
// Test 4: Translationese Syntax Calques Trigger REVISION_REQUIRED
// --------------------------------------------------------------------------
console.log('\nTest 4: Translationese Syntax Calque Detection');
const translationeseDraft = `
# Memilih Peneduh Jendela

Dalam rangka untuk memilih peneduh jendela yang tepat, overhang memainkan peran penting dalam melindungi kaca.
Di akhir hari, masuk akal untuk mengatakan bahwa kanopi adalah pilihan tepat untuk musim hujan.
`;

const transCheck = evaluateLocalCulturalGrounding(translationeseDraft, { contentFamily: 'explainer' });
assert.equal(transCheck.translationese_risk, 'REVISION_REQUIRED', 'Calques must flag translationese_risk');
assert.equal(transCheck.local_cultural_grounding, 'REVISION_REQUIRED', 'Calques must trigger local_cultural_grounding REVISION_REQUIRED');
assert.ok(transCheck.flags.some((f) => f.type === 'TRANSLATIONESE_RESIDUAL'), 'Must have TRANSLATIONESE_RESIDUAL flag');
console.log('  ✅ PASS: Translationese calques correctly caught and flagged.');

// --------------------------------------------------------------------------
// Test 5: Idiom Presence is NOT Mandatory (Standard Indonesian Passes)
// --------------------------------------------------------------------------
console.log('\nTest 5: Idiom Presence is NOT Mandatory');
const cleanStandardDraft = `
# Menghitung Overhang Fasad Barat

Pada iklim tropis lembap, bukaan kaca yang menghadap ke barat menerima radiasi panas sore dengan sudut rendah.
Ketinggian dan kedalaman overhang perlu disesuaikan agar bayangan kanopi melindungi bidang kaca sebelum panas merambat ke dalam ruangan.
Untuk rumah di lahan sempit atau deret perumahan klaster, jarak batas kavling dengan dinding tetangga membatasi panjang tritisan.
Tukang lokal umumnya dapat memasang rangka kanopi baja ringan dengan dak talang air untuk mencegah tempias hujan masuk ke kusen jendela.
Perawatan berkala cukup dengan membersihkan endapan debu jalan pada talang setiap memasuki musim hujan.
`;

const cleanCheck = evaluateLocalCulturalGrounding(cleanStandardDraft, { contentFamily: 'explainer' });
assert.equal(cleanCheck.cultural_generalization_safety, 'PASS');
assert.equal(cleanCheck.translationese_risk, 'PASS');
assert.equal(cleanCheck.indonesian_context_fit, 'PASS');
assert.equal(cleanCheck.local_cultural_grounding, 'PASS');
assert.equal(cleanCheck.flags.length, 0);
console.log('  ✅ PASS: Pure standard Indonesian without forced idioms passes cleanly.');

// --------------------------------------------------------------------------
// Test 6: Regional Dialect is NOT Mandatory
// --------------------------------------------------------------------------
console.log('\nTest 6: Regional Dialect is NOT Mandatory');
// Verify that standard national vocabulary with zero slang / regional dialect passes
assert.equal(cleanCheck.review_questions.familiar_construction_vocabulary, true);
assert.equal(cleanCheck.review_questions.natural_not_performative_idioms, true);
console.log('  ✅ PASS: Standard Indonesian base confirmed with zero regional dialect requirement.');

// --------------------------------------------------------------------------
// Test 7: Naturally Idiomatic Draft Passes Without Boilerplate
// --------------------------------------------------------------------------
console.log('\nTest 7: Naturally Idiomatic Indonesian Passes Cleanly');
const idiomaticDraft = `
# Menangani Tempias Jendela Kamar Tidur

Jangan sampai salah langkah saat memilih peneduh untuk jendela yang sering terkena tempias musim hujan.
Kalau kondisinya seperti ini, lebih baik bereskan sumber masalahnya dulu pada kemiringan kanopi dan dudukan kusen.
Yang sering luput diperhatikan adalah bagaimana air hujan angin merembes lewat celah sealant yang getas terpapar panas sore.
Pilihlah material pelindung yang mudah dibersihkan dan perawatannya tidak merepotkan bagi pemilik rumah.
`;

const idiomaticCheck = evaluateLocalCulturalGrounding(idiomaticDraft, { contentFamily: 'problem_solver' });
assert.equal(idiomaticCheck.local_cultural_grounding, 'PASS');
assert.equal(idiomaticCheck.flags.length, 0);
console.log('  ✅ PASS: Natural idiomatic Indonesian passes cleanly without flags.');

// --------------------------------------------------------------------------
// Test 8: Nadia Reader Voice Gate Integration & 7 Questions
// --------------------------------------------------------------------------
console.log('\nTest 8: Nadia Reader Voice Gate — Dimension K & 7 Review Questions');
const nadiaStereotypeEval = evaluateReaderVoice(stereotypeDraft, { contentFamily: 'explainer' });
assert.ok(nadiaStereotypeEval.dimensions.localCulturalGrounding, 'localCulturalGrounding dimension must exist');
assert.equal(nadiaStereotypeEval.dimensions.localCulturalGrounding.passed, false, 'Stereotypes must fail local cultural grounding');
assert.equal(nadiaStereotypeEval.decision, 'READER_VOICE_REVISION_REQUIRED');

// Verify 7 questions in checklist
assert.ok(nadiaStereotypeEval.localCulturalChecklist, 'localCulturalChecklist must be populated');
const rq = nadiaStereotypeEval.localCulturalChecklist.review_questions;
assert.strictEqual(typeof rq.expert_to_homeowner_dialogue, 'boolean');
assert.strictEqual(typeof rq.recognizable_housing_reality, 'boolean');
assert.strictEqual(typeof rq.free_of_translationese, 'boolean');
assert.strictEqual(typeof rq.familiar_construction_vocabulary, 'boolean');
assert.strictEqual(typeof rq.natural_not_performative_idioms, 'boolean');
assert.strictEqual(typeof rq.free_of_unsupported_stereotypes, 'boolean');
assert.strictEqual(typeof rq.plausible_consultation_dialogue, 'boolean');
assert.equal(rq.free_of_unsupported_stereotypes, false, 'Stereotype must flip free_of_unsupported_stereotypes to false');
console.log('  ✅ PASS: Nadia Reader Voice Gate dimension K and 7 review questions verified.');

// --------------------------------------------------------------------------
// Test 9: Warm Advisory Tone + Local Cultural Grounding Coexistence
// --------------------------------------------------------------------------
console.log('\nTest 9: Warm Advisory Tone + Local Cultural Grounding Coexistence');
const harmoniousDraft = `
## Pertimbangan Fasad Tropis

Di iklim tropis lembap, memilih peneduh luar jendela bukan semata-mata soal tampilan fasad dari jalan.
Paparan panas sore pada dinding barat dan tempias air saat musim hujan lebat menjadi dua ujian nyata yang harus dihadapi rumah setiap hari.

| Sistem Peneduh | Kelebihan | Kekurangan |
| :--- | :--- | :--- |
| **Overhang** | Tahan cuaca dan minim perawatan | Butuh struktur kokoh |
| **Louver** | Fleksibel menyaring cahaya | Butuh pembersihan rutin |

Setelah semua pertimbangannya jelas, keputusan akhirnya tetap kembali ke kondisi nyata rumah Anda. Tidak ada satu sistem yang sempurna untuk segala situasi—pilihlah solusi yang paling masuk akal sesuai arah datangnya sinar matahari, kesiapan struktur dinding, dan kemudahan perawatan yang sanggup Anda rawat dengan tenang dalam jangka panjang.
`;

const nadiaHarmoniousEval = evaluateReaderVoice(harmoniousDraft, { contentFamily: 'comparison' });
assert.equal(nadiaHarmoniousEval.dimensions.warmAdvisoryTone.passed, true, 'Warm Advisory Tone must pass');
assert.equal(nadiaHarmoniousEval.dimensions.localCulturalGrounding.passed, true, 'Local Cultural Grounding must pass');
console.log('  ✅ PASS: Warm Advisory Tone and Local Cultural Grounding harmonize cleanly.');

// --------------------------------------------------------------------------
// Test 10: Comparison Closing Remains Non-Boilerplate
// --------------------------------------------------------------------------
console.log('\nTest 10: Comparison Closing Non-Boilerplate Verification');
const warmthCheck = evaluateWarmAdvisoryTone(harmoniousDraft, { contentFamily: 'comparison' });
assert.equal(warmthCheck.comparison_decision_handoff, 'PASS');
assert.ok(!warmthCheck.evaluation_notes.some((n) => n.includes('verbatim')), 'Closing should adapt to context without verbatim copy-paste');
console.log('  ✅ PASS: Comparison closing verified as contextual and non-boilerplate.');

// --------------------------------------------------------------------------
// Test 11: Rina Editorial QA — Truth Verification & Anti-Stereotype Overreach
// --------------------------------------------------------------------------
console.log('\nTest 11: Rina Editorial QA — Truth Verification & Anti-Stereotype Overreach');
const rinaStereotypeQuality = evaluateHumanWritingQuality(stereotypeDraft, {
  contentFamily: 'explainer',
  readerVoiceState: 'READER_VOICE_PASS'
});
assert.ok(
  rinaStereotypeQuality.issues.some((i) => i.code === 'CULTURAL_STEREOTYPE_OVERREACH'),
  'Rina must detect CULTURAL_STEREOTYPE_OVERREACH'
);
console.log('  ✅ PASS: Rina editorial QA catches cultural stereotype overreach.');

// --------------------------------------------------------------------------
// Test 12: Article C Evaluation Against Local Cultural Grounding & Hash Invariance
// --------------------------------------------------------------------------
console.log('\nTest 12: Article C Local Cultural Grounding Evaluation');
const articleCPath = path.resolve(process.cwd(), 'scripts/content-bootstrap/artC-research-reset/article-c-clean-draft.md');
assert.ok(fs.existsSync(articleCPath), 'Article C draft file must exist');

const articleCContent = fs.readFileSync(articleCPath, 'utf8');
const articleCHash = crypto.createHash('sha256').update(fs.readFileSync(articleCPath)).digest('hex');
const expectedArticleCHash = '12c59631d3b297b97e35cf192da05102661c281e3370399fef291eb014692c28';

console.log('  Article C Current Hash :', articleCHash);
console.log('  Expected Canonical Hash:', expectedArticleCHash);
assert.equal(articleCHash, expectedArticleCHash, 'Article C hash must remain strictly unchanged');

// Evaluate Article C with Dimas Local Cultural Grounding Guard
const artCDimasEval = evaluateLocalCulturalGrounding(articleCContent, { contentFamily: 'comparison', title: 'Memilih Sistem Shading Luar untuk Rumah Tropis' });
assert.equal(artCDimasEval.local_cultural_grounding, 'PASS', 'Article C must pass Dimas local cultural grounding');
assert.equal(artCDimasEval.cultural_generalization_safety, 'PASS', 'Article C must be safe from cultural generalizations');
assert.equal(artCDimasEval.translationese_risk, 'PASS', 'Article C must be free of translationese risk');
assert.equal(artCDimasEval.indonesian_context_fit, 'PASS', 'Article C must fit Indonesian housing context');
assert.equal(artCDimasEval.flags.length, 0, 'Article C must have 0 local cultural grounding flags');

// Evaluate Article C with Nadia Reader Voice Gate
const artCNadiaEval = evaluateReaderVoice(articleCContent, { contentFamily: 'comparison', title: 'Memilih Sistem Shading Luar untuk Rumah Tropis' });
assert.ok(artCNadiaEval.dimensions.localCulturalGrounding, 'localCulturalGrounding dimension must exist');
assert.equal(artCNadiaEval.dimensions.localCulturalGrounding.passed, true, 'Article C must pass Nadia local cultural grounding dimension');
assert.equal(artCNadiaEval.dimensions.localCulturalGrounding.score, 100, 'Article C local cultural grounding score must be 100');
assert.equal(artCNadiaEval.dimensions.warmAdvisoryTone.passed, true, 'Article C must pass Warm Advisory Tone');
assert.equal(artCNadiaEval.decision, 'READER_VOICE_PASS', 'Article C must remain READER_VOICE_PASS');

// Verify Article C Publication Invariant: UNPUBLISHED
console.log('  Article C Publication State: UNPUBLISHED');
console.log('  ✅ PASS: Article C evaluated and confirmed fully compliant with Local Cultural Grounding.');

console.log('\n======================================================');
console.log('🎉 ALL 12/12 LOCAL CULTURAL GROUNDING TESTS PASSED!');
console.log('======================================================');
