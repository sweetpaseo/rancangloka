/**
 * Test Suite: RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1
 * Milestone: Canonical Editorial Knowledge Foundation
 * 
 * Verifies:
 * 1. Canonical knowledge loads deterministically with correct version and title.
 * 2. 5 Major layers are fully articulated and structured:
 *    - Layer 1: Human Writing (Voice DNA, emotional resonance, soul arc, natural cadence).
 *    - Layer 2: Language & Cohesion (Lexical precision, terminology consistency map, lexical cohesion, semantic bridging, 3-step translation).
 *    - Layer 3: Expert Consultation (Expert-client sequence, context qualification, diagnostic logic, root cause vs symptoms, objection handling, trade-offs).
 *    - Layer 4: Decision Support (Scenario branching IF-THEN-BUT IF, cost of wrong decision, 5 golden questions, ending resolution).
 *    - Layer 5: Trust & Integrity (5 claim classes, 4 uncertainty tiers, no fabricated experience, commercial integrity, cross-article consistency).
 * 3. Role-specific adapters provide correct scoped knowledge:
 *    - Irwan: Evidence, factual correctness, technical standards, claim hierarchy, uncertainty.
 *    - Joko: Human voice, language, expert consultation, decision support, empathy.
 *    - Rina: Comprehensive 5-layer knowledge, editorial QA gate, rewrite flow.
 *    - Sari: Publication operations, readiness checklist, zero override invariants.
 *    - Jefry: Shadow advisory only, zero execution authority, zero publishing authority.
 * 4. Backward compatibility with EDITORIAL-HUMAN-QUALITY-1: Knowledge version stamped on evaluation results.
 */

import assert from 'node:assert';
import {
  RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
  CANONICAL_EDITORIAL_KNOWLEDGE,
  CANONICAL_EDITORIAL_KNOWLEDGE_V1,
  CANONICAL_TERMINOLOGY_MAP,
  CLAIM_HIERARCHY_CLASSES,
  UNCERTAINTY_CALIBRATION_TIERS,
  READER_QUALIFICATION_FACTORS,
  DECISION_CONFIDENCE_QUESTIONS,
  getIrwanEvidenceKnowledge,
  getJokoAuthoringKnowledge,
  getRinaQAKnowledge,
  getSariPublicationKnowledge,
  getJefryAdvisoryKnowledge,
  getCanonicalTerm
} from '../src/lib/article/editorial-knowledge.ts';

import {
  evaluateHumanWritingQuality,
  DEFAULT_HUMAN_QUALITY_RUBRIC
} from '../src/lib/article/human-quality.ts';

console.log('🧪 Starting RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1 Test Suite...\n');

let passedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// 1. Canonical Knowledge Loading & Versioning
// -----------------------------------------------------------------------------
test('Canonical knowledge version is strictly RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1', () => {
  assert.strictEqual(RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1');
  assert.strictEqual(CANONICAL_EDITORIAL_KNOWLEDGE.version, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1');
  assert.strictEqual(CANONICAL_EDITORIAL_KNOWLEDGE_V1.version, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1');
  assert.ok(CANONICAL_EDITORIAL_KNOWLEDGE.title.includes('RancangLoka Canonical Editorial Knowledge'));
});

// -----------------------------------------------------------------------------
// 2. Five Major Layers Articulation
// -----------------------------------------------------------------------------
test('Canonical knowledge articulates all 5 major layers plus continuous intelligence', () => {
  const k = CANONICAL_EDITORIAL_KNOWLEDGE;
  assert.ok(k.layer1_human_writing, 'Layer 1 must exist');
  assert.ok(k.layer2_language_cohesion, 'Layer 2 must exist');
  assert.ok(k.layer3_expert_consultation, 'Layer 3 must exist');
  assert.ok(k.layer4_decision_support, 'Layer 4 must exist');
  assert.ok(k.layer5_trust_and_integrity, 'Layer 5 must exist');
  assert.ok(k.continuous_intelligence, 'Continuous intelligence must exist');
});

test('Layer 1 (Human Writing) defines Voice DNA, emotional resonance, soul arc, and cadence', () => {
  const l1 = CANONICAL_EDITORIAL_KNOWLEDGE.layer1_human_writing;
  assert.ok(l1.human_voice_dna.personality.includes('Ahli arsitektur/bangunan Indonesia'));
  assert.ok(l1.human_voice_dna.banned_modes.some(m => m.includes('Chatbot netral generik')));
  assert.ok(l1.human_voice_dna.banned_modes.some(m => m.includes('Brosur sales marketing')));

  assert.ok(l1.emotional_resonance.authentic_triggers.some(t => t.includes('Kamar tidur') || t.includes('panas dinding')));
  assert.ok(l1.emotional_resonance.banned_manipulations.some(m => m.includes('fearmongering')));

  const stages = l1.soul_narrative_arc.progression.map(p => p.stage);
  assert.deepStrictEqual(stages, [
    'RECOGNITION',
    'UNDERSTANDING',
    'CLARITY',
    'CALM_CONFIDENCE'
  ]);
  assert.ok(l1.natural_cadence.principles.some(p => p.includes('Irama kalimat dinamis')));
});

test('Layer 2 (Language & Cohesion) enforces terminology consistency, lexical cohesion, and bridging', () => {
  const l2 = CANONICAL_EDITORIAL_KNOWLEDGE.layer2_language_cohesion;
  assert.ok(l2.lexical_precision.rule.includes('Gunakan kata yang paling tepat'));
  assert.strictEqual(CANONICAL_TERMINOLOGY_MAP['kusen aluminium'].canonical, 'kusen aluminium');
  assert.ok(CANONICAL_TERMINOLOGY_MAP['kusen aluminium'].prohibited_alternations.includes('bingkai aluminium'));
  assert.ok(CANONICAL_TERMINOLOGY_MAP['dak beton'].canonical === 'dak beton');

  assert.ok(l2.lexical_cohesion.mechanisms.some(m => m.includes('Kelemahan termal tersebut')));
  assert.deepStrictEqual(l2.semantic_bridging.preferred_bridges, [
    'CAUSAL',
    'COMPARATIVE',
    'CONDITIONAL',
    'CONTEXTUAL'
  ]);
  assert.deepStrictEqual(l2.technical_to_human_translation.three_step_pattern, [
    'technical_fact',
    'plain_language_explanation',
    'practical_consequence'
  ]);
  assert.ok(l2.native_indonesian_authoring);
  assert.strictEqual(l2.native_indonesian_authoring.principle, 'NATIVE_INDONESIAN_AUTHORING');
  assert.strictEqual(l2.native_indonesian_authoring.canonical_language, 'Bahasa Indonesia');
});

test('Layer 3 (Expert Consultation) structures expert-to-client perspective and diagnosis', () => {
  const l3 = CANONICAL_EDITORIAL_KNOWLEDGE.layer3_expert_consultation;
  assert.deepStrictEqual(l3.expert_to_client_perspective.canonical_sequence, [
    'CLIENT_PROBLEM',
    'CONTEXT',
    'DIAGNOSIS',
    'OPTIONS',
    'TRADE_OFF',
    'SOLUTION_FIT',
    'RECOMMENDATION',
    'NEXT_ACTION'
  ]);
  assert.ok(READER_QUALIFICATION_FACTORS.includes('sunlight_orientation'));
  assert.ok(READER_QUALIFICATION_FACTORS.includes('budget_and_maintenance_tolerance'));
  assert.ok(l3.diagnostic_question_logic.sample_diagnostic_checks.length >= 4);
  assert.ok(l3.problem_diagnosis.rule.includes('Pisahkan gejala dari akar penyebab fisik'));
  assert.ok(l3.objection_handling.common_objections_calibrated.upvc_always_better);
});

test('Layer 4 (Decision Support) mandates scenario recommendations, trade-offs, and 5 golden questions', () => {
  const l4 = CANONICAL_EDITORIAL_KNOWLEDGE.layer4_decision_support;
  assert.ok(l4.scenario_based_recommendation.branching_logic_template.includes('JIKA'));
  assert.ok(l4.cost_of_wrong_decision.practical_consequences.some(c => c.includes('pembongkaran')));
  assert.deepStrictEqual(DECISION_CONFIDENCE_QUESTIONS, [
    'What option is most suitable for my specific condition?',
    'Why is it the right choice based on physical and technical realities?',
    'What real trade-offs and compromises am I accepting?',
    'What specific details must I inspect or verify before purchasing or installing?',
    'What is my immediate next action?'
  ]);
  assert.ok(l4.ending_resolution.banned_conclusion_pattern.includes('Setiap pilihan memiliki kelebihan dan kekurangan'));
});

test('Layer 5 (Trust & Editorial Integrity) enforces claim hierarchy, uncertainty, and zero fabricated experience', () => {
  const l5 = CANONICAL_EDITORIAL_KNOWLEDGE.layer5_trust_and_integrity;
  assert.deepStrictEqual(CLAIM_HIERARCHY_CLASSES, [
    'VERIFIED_FACT',
    'TECHNICAL_CONSENSUS',
    'USER_EXPERIENCE_SIGNAL',
    'EDITORIAL_INFERENCE',
    'EDITORIAL_RECOMMENDATION'
  ]);
  assert.strictEqual(UNCERTAINTY_CALIBRATION_TIERS.HIGH_CONFIDENCE.code, 'HIGH_CONFIDENCE');
  assert.strictEqual(UNCERTAINTY_CALIBRATION_TIERS.MODERATE_INFERENCE.code, 'MODERATE_INFERENCE');
  assert.strictEqual(UNCERTAINTY_CALIBRATION_TIERS.CONTEXT_DEPENDENT.code, 'CONTEXT_DEPENDENT');
  assert.strictEqual(UNCERTAINTY_CALIBRATION_TIERS.UNKNOWN_FIELD_VERIFICATION_REQUIRED.code, 'UNKNOWN_FIELD_VERIFICATION_REQUIRED');

  assert.ok(l5.no_fabricated_experience.banned_phrases.some(p => p.includes('kami sudah menguji')));
  assert.ok(l5.no_fabricated_experience.banned_phrases.some(p => p.includes('berdasarkan pengalaman kami')));
  assert.ok(l5.commercial_integrity.isolation_guarantee.includes('Produk bersponsor dilarang'));
});

// -----------------------------------------------------------------------------
// 3. Role-Specific Knowledge Views & Adapters
// -----------------------------------------------------------------------------
test('Irwan adapter receives only Evidence, Standards, Trust, and Claim Hierarchy', () => {
  const irwan = getIrwanEvidenceKnowledge();
  assert.strictEqual(irwan.role, 'Irwan — Lead Technical Researcher');
  assert.strictEqual(irwan.voice_ownership, false);
  assert.strictEqual(irwan.authority.author_human_voice, false);
  assert.strictEqual(irwan.authority.verify_evidence, true);
  assert.ok(irwan.evidence_and_trust);
  assert.ok(irwan.claim_hierarchy);
  assert.ok(irwan.uncertainty_calibration);
  assert.ok(irwan.evidence_and_trust.no_fabricated_experience);
});

test('Joko adapter receives Human Voice, Language, Consultation, and Decision Support', () => {
  const joko = getJokoAuthoringKnowledge();
  assert.strictEqual(joko.role, 'Joko — Content Writer & Expert Advisor');
  assert.strictEqual(joko.voice_ownership, true);
  assert.strictEqual(joko.authority.author_human_voice, true);
  assert.strictEqual(joko.authority.override_technical_facts, false);
  assert.ok(joko.human_writing);
  assert.ok(joko.language_and_cohesion);
  assert.ok(joko.expert_consultation);
  assert.ok(joko.decision_support);
  assert.ok(joko.native_indonesian_authoring);
  assert.strictEqual(joko.native_indonesian_authoring.principle, 'NATIVE_INDONESIAN_AUTHORING');
  assert.ok(joko.trust_boundaries.no_fabricated_experience);
  assert.strictEqual(joko.trust_boundaries.monetary_silence, 'STRICT_EMPIRICAL_RESEARCH_ONLY_NO_GUESSES');
});

test('Rina adapter receives Complete 5-Layer Knowledge and QA Rewrite Gates', () => {
  const rina = getRinaQAKnowledge();
  assert.strictEqual(rina.role, 'Rina — Senior Editorial QA');
  assert.strictEqual(rina.authority.evaluate_editorial_quality, true);
  assert.strictEqual(rina.authority.silent_rewrite_authoring, false, 'Rina cannot silently replace Joko as writer');
  assert.strictEqual(rina.authority.approve_for_publication_readiness, true);
  assert.ok(rina.layer_1_human_writing);
  assert.ok(rina.layer_2_language_and_cohesion);
  assert.ok(rina.layer_3_expert_consultation);
  assert.ok(rina.layer_4_decision_support);
  assert.ok(rina.layer_5_trust_and_editorial_integrity);
  assert.ok(rina.native_indonesian_language_qa);
  assert.strictEqual(rina.native_indonesian_language_qa.responsibility, 'NATIVE_INDONESIAN_LANGUAGE_QA');
  assert.strictEqual(rina.qa_responsibilities.rewrite_policy, 'STRUCTURED_BRIEF_TO_JOKO_MAX_2_ATTEMPTS');
});

test('Sari adapter receives Publication Operations and Invariants with Zero Override Authority', () => {
  const sari = getSariPublicationKnowledge();
  assert.strictEqual(sari.role, 'Sari — Publication Operations & Safety Lead');
  assert.strictEqual(sari.authority.publish_live, true);
  assert.strictEqual(sari.authority.override_editorial_qa_rejection, false);
  assert.strictEqual(sari.authority.override_evidence_failure, false);
  assert.strictEqual(sari.authority.override_human_review_required, false);
  assert.ok(sari.prerequisites.includes('Rina editorial quality approval (score >= 85)'));
});

test('Jefry adapter is strictly Shadow Advisory with Zero Authority', () => {
  const jefry = getJefryAdvisoryKnowledge();
  assert.strictEqual(jefry.role, 'Jefry / TypeSafe JEV — Shadow Editorial Decision Advisor');
  assert.strictEqual(jefry.operating_mode, 'SHADOW_MODE_ONLY');
  assert.strictEqual(jefry.authority.autonomous_execution, false);
  assert.strictEqual(jefry.authority.editorial_approval, false);
  assert.strictEqual(jefry.authority.publishing_authority, false);
  assert.strictEqual(jefry.authority.authoring_authority, false);
});

// -----------------------------------------------------------------------------
// 4. Terminology Helper Function & Same-Referent vs Technical-Referent
// -----------------------------------------------------------------------------
test('getCanonicalTerm resolves canonical terms and detects prohibited variations', () => {
  const res1 = getCanonicalTerm('kusen aluminium');
  assert.ok(res1);
  assert.strictEqual(res1.canonical, 'kusen aluminium');

  const res2 = getCanonicalTerm('bingkai aluminium');
  assert.ok(res2);
  assert.strictEqual(res2.canonical, 'kusen aluminium');
  assert.strictEqual(res2.is_prohibited_variation, true);

  const res3 = getCanonicalTerm('istilah_tidak_dikenal');
  assert.strictEqual(res3, null);
});

test('getCanonicalTerm allows distinct technical referent (e.g. profil aluminium vs kusen aluminium)', () => {
  const distinct = getCanonicalTerm('profil aluminium');
  assert.ok(distinct, 'profil aluminium must be recognized');
  assert.strictEqual(distinct.canonical, 'profil aluminium');
  assert.strictEqual(distinct.is_prohibited_variation, false, 'distinct technical referent is NOT prohibited');
  assert.ok(distinct.distinct_referent);
  assert.ok(distinct.explanation.includes('Batang logam'));

  const sash = getCanonicalTerm('daun jendela aluminium');
  assert.ok(sash);
  assert.strictEqual(sash.canonical, 'daun jendela aluminium');
  assert.strictEqual(sash.is_prohibited_variation, false);
});

test('CANONICAL_EDITORIAL_KNOWLEDGE enforces Technical Evidence Boundary and marks illustrative values', () => {
  const layer5 = CANONICAL_EDITORIAL_KNOWLEDGE.layer5_trust_and_integrity;
  assert.ok(layer5.technical_evidence_boundary, 'technical_evidence_boundary must be defined');
  assert.strictEqual(layer5.technical_evidence_boundary.illustrative_marker, 'ILLUSTRATIVE_EXAMPLE_ONLY');
  assert.ok(layer5.technical_evidence_boundary.authoritative_evidence_source.includes('Irwan'));

  // Ensure illustrative values in Layer 3 objection handling are marked with ILLUSTRATIVE_EXAMPLE_ONLY
  const upvcObjection = CANONICAL_EDITORIAL_KNOWLEDGE.layer3_expert_consultation.objection_handling.common_objections_calibrated.upvc_always_better;
  assert.ok(upvcObjection.factual_calibration.includes('ILLUSTRATIVE_EXAMPLE_ONLY'));

  // Ensure confidence calibration framing is marked with ILLUSTRATIVE_EXAMPLE_ONLY
  const highConf = layer5.confidence_and_uncertainty_calibration.calibration_tiers.find(t => t.tier === 'STRONG_EVIDENCE');
  assert.ok(highConf.acceptable_framing.includes('ILLUSTRATIVE_EXAMPLE_ONLY'));
});

test('CANONICAL_EDITORIAL_KNOWLEDGE Layer 2 defines Reader-Language Accessibility and Terminology Principles', () => {
  const layer2 = CANONICAL_EDITORIAL_KNOWLEDGE.layer2_language_cohesion;
  assert.ok(layer2.reader_language_accessibility, 'reader_language_accessibility must be defined');
  assert.strictEqual(layer2.reader_language_accessibility.principle, 'Reader-Language Accessibility');
  assert.ok(layer2.reader_language_accessibility.rule.includes('bahasa Indonesia'));

  assert.ok(layer2.terminology_consistency.principles.same_referent_consistency);
  assert.ok(layer2.terminology_consistency.principles.different_technical_referent_precision);
});

// -----------------------------------------------------------------------------
// 5. Integration with Human Quality Rubric
// -----------------------------------------------------------------------------
test('DEFAULT_HUMAN_QUALITY_RUBRIC has exact 100-point total', () => {
  const total = Object.values(DEFAULT_HUMAN_QUALITY_RUBRIC).reduce((sum, val) => sum + val, 0);
  assert.strictEqual(total, 100);
});

test('evaluateHumanWritingQuality stamps knowledge_version RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1', () => {
  const testArticle = {
    title: 'Memilih Kusen Aluminium vs uPVC untuk Rumah Tropis Lembap',
    excerpt: 'Panduan teknis dan praktis memilih material bukaan yang tahan cuaca tropis tanpa mengorbankan insulasi termal.',
    body: `
      Kusen aluminium dan uPVC sering menjadi bahan perbandingan utama bagi pemilik rumah di wilayah tropis lembap.
      Ketika jendela di lantai atas mulai merembeskan air saat hujan lebat disertai angin kencang, frustrasi renovasi langsung terasa nyata.
      
      Keunggulan termal itu menjadi alasan mengapa banyak pemilik rumah mempertimbangkan uPVC. Profil uPVC memiliki koefisien perpindahan panas (U-value) yang secara alami lebih rendah dibandingkan logam tanpa thermal break.
      
      Namun, mari kita bedah akar masalahnya. Masalah rembesan air pada kusen jendela lebih sering bersumber dari kualitas instalasi seal dan drainase celah, bukan material profil itu sendiri.
      
      Berdasarkan SNI 07-0603 tentang profil ekstrusi aluminium dan pengujian laboratorium independen, ketebalan profil minimal 1.35 mm disyaratkan untuk bukaan yang menerima beban angin tinggi.
      
      Untuk bukaan lantai bawah dengan ukuran standar dan orientasi barat yang terpapar terik matahari siang, kusen uPVC berkualitas dengan profil multi-chamber merupakan pilihan yang tepat karena meredam panas lebih optimal.
      Sebaliknya, jika Anda memiliki bukaan kaca lebar bentang lebih dari 2.4 meter di lantai atas, kusen aluminium tebal dengan finishing anodized atau powder coating berkualitas jauh lebih kokoh menahan beban angin.
      
      Sebelum memutuskan pembelian, periksalah tiga hal di lapangan: arah paparan tampias hujan, lebar bentang opening dinding, dan ketersediaan teknisi berpengalaman di kota Anda.
    `
  };

  const result = evaluateHumanWritingQuality(testArticle.body);
  assert.strictEqual(result.knowledge_version, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1');
  assert.ok(result.total_score >= 85, `Expected score >= 85, got ${result.total_score}`);
  assert.strictEqual(result.passed, true);
  assert.strictEqual(result.decision, 'HUMAN_WRITING_PASS');
});

test('evaluateHumanWritingQuality rejects fabricated personal testing claims per Layer 5', () => {
  const fabricatedArticle = {
    title: 'Uji Coba Kusen Aluminium Rumah Kami',
    excerpt: 'Pengalaman kami mencoba kusen aluminium baru selama 3 bulan.',
    body: `
      Kami menguji kusen aluminium ini di workshop kami selama enam bulan dan hasilnya luar biasa.
      Berdasarkan pengalaman kami merenovasi sepuluh rumah klien, produk merek X adalah yang terbaik tanpa tanding.
      Kami mengunjungi pabrik pembuatnya kemarin sore untuk memastikan prosesnya.
    `
  };

  const result = evaluateHumanWritingQuality(fabricatedArticle.body);
  assert.strictEqual(result.knowledge_version, 'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1');
  assert.strictEqual(result.passed, false);
  assert.ok(result.issues.some(i => i.code === 'FABRICATED_EXPERIENCE_OR_SLOP' || i.description.includes('pengalaman kami') || i.description.includes('kami menguji')));
});

console.log(`\n🎉 All ${passedTests} tests in RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1 passed successfully!\n`);
