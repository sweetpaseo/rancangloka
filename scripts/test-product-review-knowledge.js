/**
 * RancangLoka — PRODUCT REVIEW KNOWLEDGE V1 TEST SUITE
 * Milestone: RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1
 *
 * Deterministic test suite verifying:
 * 1. Product Review Knowledge V1 loads correctly.
 * 2. Inherits canonical Editorial Knowledge version/rules.
 * 3. Analytical vs hands-on review distinction exists.
 * 4. Fabricated hands-on claim is prohibited.
 * 5. 'Tested by RancangLoka' requires first-party evidence.
 * 6. Official specification is distinguished from measured performance.
 * 7. User signal is distinguished from verified fact.
 * 8. Recurring complaint requires repeated evidence.
 * 9. Compatibility evaluation exists.
 * 10. Use-case fit exists.
 * 11. Suitable / less-suitable reader logic exists.
 * 12. Limitation disclosure exists.
 * 13. Trade-off reasoning exists.
 * 14. Commercial integrity exists.
 * 15. Affiliate CTA cannot determine recommendation.
 * 16. Review freshness rules exist.
 * 17. Variant identity protection exists.
 * 18. Product recommendation remains scenario-based.
 * 19. Reader-facing vocabulary uses approved Indonesian wording.
 * 20. Prohibited foreign editorial label guard remains passing.
 * 21. Jefry has zero execution authority.
 * 22. Publishing authority remains unchanged (Sari & zero auto-publish).
 */

import assert from 'node:assert/strict';
import {
  RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION,
  CANONICAL_PRODUCT_REVIEW_KNOWLEDGE,
  CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1,
  PRODUCT_REVIEW_TYPES,
  BANNED_HANDS_ON_PHRASES,
  HANDS_ON_BOUNDARY_RULES,
  PRODUCT_EVIDENCE_HIERARCHY,
  CLAIM_SPECIFIC_EVIDENCE_MODEL,
  PRODUCT_CLAIM_CLASSES,
  PRODUCT_DECISION_QUESTIONS,
  PRODUCT_REVIEW_QA_ISSUE_DEFINITIONS,
  detectFabricatedHandsOnClaims,
  validateAffiliateCTABoundary,
  getIrwanProductEvidenceKnowledge,
  getJokoProductReviewKnowledge,
  getRinaProductReviewQAKnowledge,
  getSariProductReviewPublicationKnowledge,
  getJefryProductReviewAdvisoryKnowledge
} from '../src/lib/article/product-review-knowledge.ts';
import {
  RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
  CANONICAL_EDITORIAL_KNOWLEDGE_V1,
  CANONICAL_PRODUCT_REVIEW_TERMINOLOGY
} from '../src/lib/article/editorial-knowledge.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting RancangLoka Product Review Knowledge V1 Test Suite...\n');

  // --- SECTION 1: Knowledge Module Loading & Inheritance ---
  console.log('--- TEST SECTION 1: Knowledge Loading & Inheritance ---');

  await test('1. Product Review Knowledge V1 loads correctly', () => {
    assert.strictEqual(
      RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_VERSION,
      'RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1'
    );
    assert.ok(CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1);
    assert.strictEqual(CANONICAL_PRODUCT_REVIEW_KNOWLEDGE, CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1);
    assert.strictEqual(
      CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.core_principle,
      'Apakah produk ini cocok untuk kondisi saya, dan apa yang perlu saya ketahui sebelum membeli?'
    );
  });

  await test('2. Inherits canonical Editorial Knowledge version and rules', () => {
    assert.strictEqual(
      CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.parent_editorial_version,
      RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION
    );
    assert.strictEqual(
      CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.parent_editorial_version,
      'RANCANGLOKA_EDITORIAL_KNOWLEDGE_V1'
    );
    assert.ok(CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer1_human_writing);
    assert.ok(CANONICAL_EDITORIAL_KNOWLEDGE_V1.layer5_trust_and_integrity);
  });

  // --- SECTION 2: Review Types & Hands-On Boundaries ---
  console.log('--- TEST SECTION 2: Review Types & Hands-On Boundaries ---');

  await test('3. Analytical vs hands-on review distinction exists', () => {
    assert.ok(PRODUCT_REVIEW_TYPES.ANALYTICAL_REVIEW);
    assert.ok(PRODUCT_REVIEW_TYPES.HANDS_ON_REVIEW);
    assert.ok(PRODUCT_REVIEW_TYPES.COMPARISON_REVIEW);

    assert.strictEqual(PRODUCT_REVIEW_TYPES.ANALYTICAL_REVIEW.hands_on_allowed, false);
    assert.strictEqual(PRODUCT_REVIEW_TYPES.HANDS_ON_REVIEW.hands_on_allowed, true);
    assert.strictEqual(
      PRODUCT_REVIEW_TYPES.ANALYTICAL_REVIEW.reader_facing_label,
      'Tinjauan Spesifikasi & Analisis Produk'
    );
    assert.strictEqual(
      PRODUCT_REVIEW_TYPES.HANDS_ON_REVIEW.reader_facing_label,
      'Tested by RancangLoka'
    );
  });

  await test('4. Fabricated hands-on claim is prohibited in analytical reviews', () => {
    assert.ok(BANNED_HANDS_ON_PHRASES.length >= 10);
    assert.ok(BANNED_HANDS_ON_PHRASES.includes('kami sudah mencoba'));
    assert.ok(BANNED_HANDS_ON_PHRASES.includes('dalam pengujian kami'));
    assert.ok(BANNED_HANDS_ON_PHRASES.includes('hasil tes kami'));

    // Check detector function on violating text
    const sampleViolatingText = '[ILLUSTRATIVE_EXAMPLE_ONLY] Kunci digital ini sangat responsif, kami sudah mencoba memasangnya di pintu kayu jati.';
    const violationResult = detectFabricatedHandsOnClaims(sampleViolatingText, 'ANALYTICAL_REVIEW', false);
    assert.strictEqual(violationResult.has_violation, true);
    assert.ok(violationResult.detected_phrases.includes('kami sudah mencoba'));
    assert.strictEqual(violationResult.violation_code, 'FABRICATED_HANDS_ON_TEST');

    // Clean analytical text passes
    const sampleCleanText = '[ILLUSTRATIVE_EXAMPLE_ONLY] Berdasarkan spesifikasi resmi pabrikan dan laporan pengujian laboratorium terakreditasi, kunci ini menggunakan mortise stainless steel 304.';
    const cleanResult = detectFabricatedHandsOnClaims(sampleCleanText, 'ANALYTICAL_REVIEW', false);
    assert.strictEqual(cleanResult.has_violation, false);
    assert.strictEqual(cleanResult.detected_phrases.length, 0);
  });

  await test('5. "Tested by RancangLoka" requires first-party physical evidence', () => {
    // If text uses "Tested by RancangLoka" without physical evidence, flag violation
    const fakeClaimText = '[ILLUSTRATIVE_EXAMPLE_ONLY] Produk ini berlabel Tested by RancangLoka dengan keandalan tinggi.';
    const resultWithoutEvidence = detectFabricatedHandsOnClaims(fakeClaimText, 'HANDS_ON_REVIEW', false);
    assert.strictEqual(resultWithoutEvidence.has_violation, true);

    // If genuine physical evidence is verified, passes
    const resultWithEvidence = detectFabricatedHandsOnClaims(fakeClaimText, 'HANDS_ON_REVIEW', true);
    assert.strictEqual(resultWithEvidence.has_violation, false);

    assert.ok(HANDS_ON_BOUNDARY_RULES.sponsor_rule.includes('TIDAK secara otomatis'));
    assert.ok(HANDS_ON_BOUNDARY_RULES.affiliate_rule.includes('katalog afiliasi'));
  });

  // --- SECTION 3: Evidence Model & Signals ---
  console.log('--- TEST SECTION 3: Evidence Model & Signal Classification ---');

  await test('6. Official specification is distinguished from measured performance', () => {
    const layer1 = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer1_identity_and_specs;
    assert.ok(layer1.official_specifications.three_way_distinction.manufacturer_spec);
    assert.ok(layer1.official_specifications.three_way_distinction.measured_performance);
    assert.ok(layer1.official_specifications.three_way_distinction.user_experience);

    // Check evidence hierarchy ordering
    assert.ok(PRODUCT_EVIDENCE_HIERARCHY.FIRST_PARTY_TEST.rank < PRODUCT_EVIDENCE_HIERARCHY.OFFICIAL_MANUFACTURER_DOCS.rank);
    assert.ok(PRODUCT_EVIDENCE_HIERARCHY.ACCREDITED_INDEPENDENT_TEST.rank < PRODUCT_EVIDENCE_HIERARCHY.OFFICIAL_MANUFACTURER_DOCS.rank);
  });

  await test('7. User signal is distinguished from verified fact', () => {
    assert.ok(PRODUCT_CLAIM_CLASSES.VERIFIED_FACT);
    assert.ok(PRODUCT_CLAIM_CLASSES.USER_EXPERIENCE_SIGNAL);
    assert.ok(PRODUCT_CLAIM_CLASSES.TECHNICAL_CONSENSUS);
    assert.ok(PRODUCT_CLAIM_CLASSES.EDITORIAL_INFERENCE);
    assert.ok(PRODUCT_CLAIM_CLASSES.EDITORIAL_RECOMMENDATION);

    const layer3 = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer3_performance_signals;
    assert.ok(layer3.user_review_signals.separation_rule.includes('TIDAK boleh disimpulkan sebagai cacat produk'));
  });

  await test('8. Recurring complaint requires repeated evidence', () => {
    const layer3 = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer3_performance_signals;
    assert.ok(layer3.recurring_complaint_treatment.common_recurring_patterns.length >= 5);
    assert.ok(layer3.recurring_complaint_treatment.common_recurring_patterns.some(p => p.includes('Koneksi aplikasi sering putus')));
    assert.ok(layer3.recurring_complaint_treatment.common_recurring_patterns.some(p => p.includes('Baterai boros')));

    // Balance with positive recurring signals
    assert.ok(layer3.recurring_positive_signals.common_positive_patterns.length >= 3);
    assert.ok(PRODUCT_REVIEW_QA_ISSUE_DEFINITIONS.SINGLE_REVIEW_OVERGENERALIZATION);
  });

  // --- SECTION 4: Compatibility, Fit, and Limitations ---
  console.log('--- TEST SECTION 4: Compatibility, Fit & Limitations ---');

  await test('9. Compatibility evaluation exists across product categories', () => {
    const compatibility = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer2_use_case_and_compatibility.compatibility_dimensions;
    assert.ok(compatibility.smart_lock);
    assert.ok(compatibility.cctv_security);
    assert.ok(compatibility.building_materials);

    assert.ok(compatibility.smart_lock.key_dimensions.some(d => d.includes('mortise')));
    assert.ok(compatibility.cctv_security.key_dimensions.some(d => d.includes('Wi-Fi')));
    assert.ok(compatibility.building_materials.key_dimensions.some(d => d.includes('Substrat')));
  });

  await test('10. Use-case fit exists and rejects universal declarations', () => {
    const layer2 = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer2_use_case_and_compatibility;
    assert.ok(layer2.use_case_fit.conditional_recommendation_principle.includes('Tidak ada produk yang secara universal sempurna'));
    assert.ok(layer2.use_case_fit.banned_declaration.includes('pilihan terbaik untuk semua rumah'));
  });

  await test('11. Suitable / less-suitable reader logic exists', () => {
    const labels = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer2_use_case_and_compatibility.reader_facing_labels;
    assert.strictEqual(labels.suitable_for, 'Cocok untuk');
    assert.strictEqual(labels.unsuitable_for, 'Kurang cocok untuk');
  });

  await test('12. Limitation disclosure is mandatory and guarded', () => {
    const layer4 = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer4_limitations_and_trade_offs;
    assert.ok(layer4.mandatory_limitation_disclosure.rule.includes('wajib mencantumkan'));
    assert.ok(layer4.mandatory_limitation_disclosure.core_questions.length >= 4);
    assert.ok(PRODUCT_REVIEW_QA_ISSUE_DEFINITIONS.LIMITATIONS_UNDERDISCLOSED);
  });

  await test('13. Trade-off reasoning explains what the buyer gives up', () => {
    const tradeOffs = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer4_limitations_and_trade_offs.trade_off_logic.common_dichotomies;
    assert.ok(tradeOffs.length >= 3);
    assert.ok(tradeOffs.some(t => t.advantage.includes('microSD') && t.consequence.includes('dicuri')));
    assert.ok(tradeOffs.some(t => t.advantage.includes('baterai') && t.consequence.includes('penggantian')));
  });

  // --- SECTION 5: Commercial Integrity & Value ---
  console.log('--- TEST SECTION 5: Commercial Integrity & Value ---');

  await test('14. Commercial integrity prevents revenue from dictating recommendations', () => {
    const integrity = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.commercial_integrity;
    assert.ok(integrity.core_rule.includes('TIDAK BOLEH memengaruhi'));
    assert.ok(integrity.isolation_guarantees.some(g => g.includes('Dinding api total')));
  });

  await test('15. Affiliate CTA cannot precede editorial recommendation reasoning', () => {
    // Valid structure: CTA after recommendation
    const validFlow = validateAffiliateCTABoundary({
      has_evidence: true,
      has_analysis: true,
      has_suitability: true,
      has_recommendation: true,
      affiliate_cta_position: 'AFTER_RECOMMENDATION'
    });
    assert.strictEqual(validFlow.is_valid, true);

    // Invalid structure: CTA before recommendation
    const invalidFlow = validateAffiliateCTABoundary({
      has_evidence: true,
      has_analysis: true,
      has_suitability: true,
      has_recommendation: true,
      affiliate_cta_position: 'BEFORE_RECOMMENDATION'
    });
    assert.strictEqual(invalidFlow.is_valid, false);
    assert.strictEqual(invalidFlow.issue, 'COMMERCIAL_BIAS_RISK');

    // Invalid structure: CTA after recommendation but analysis missing
    const missingAnalysisFlow = validateAffiliateCTABoundary({
      has_evidence: true,
      has_analysis: false,
      has_suitability: true,
      has_recommendation: true,
      affiliate_cta_position: 'AFTER_RECOMMENDATION'
    });
    assert.strictEqual(missingAnalysisFlow.is_valid, false);
  });

  await test('16. Review freshness rules track decay triggers and timestamps', () => {
    const freshness = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.review_freshness;
    assert.ok(freshness.tracked_metadata.includes('specifications_verified_date'));
    assert.ok(freshness.tracked_metadata.includes('price_check_date'));
    assert.ok(freshness.decay_triggers.some(t => t.includes('firmware')));
  });

  await test('17. Variant identity protection prohibits mixing specifications', () => {
    const identity = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer1_identity_and_specs.product_identity;
    assert.ok(identity.mandatory_fields.includes('variant'));
    assert.ok(identity.mandatory_fields.includes('generation'));
    assert.ok(identity.variant_protection_rule.includes('Dilarang menggabungkan spesifikasi'));
    assert.ok(PRODUCT_REVIEW_QA_ISSUE_DEFINITIONS.VARIANT_IDENTITY_AMBIGUOUS);
  });

  // --- SECTION 6: Recommendations, Terminology & Governance ---
  console.log('--- TEST SECTION 6: Recommendations, Terminology & Governance ---');

  await test('18. Product recommendation remains strictly scenario-based', () => {
    const rec = CANONICAL_PRODUCT_REVIEW_KNOWLEDGE_V1.layer7_decision_recommendation.recommendation_pattern;
    assert.ok(rec.template.includes('Jika kebutuhan Anda X'));
    assert.ok(rec.banned_pattern.includes('terbaik di kelasnya'));
    assert.ok(PRODUCT_REVIEW_QA_ISSUE_DEFINITIONS.RECOMMENDATION_NOT_SCENARIO_BASED);
  });

  await test('19. Reader-facing vocabulary uses approved Indonesian wording', () => {
    const term = CANONICAL_PRODUCT_REVIEW_TERMINOLOGY;
    assert.strictEqual(term.overall_assessment.primary, 'Penilaian RancangLoka');
    assert.strictEqual(term.overall_assessment.alternative, 'Rekomendasi Akhir');
    assert.strictEqual(term.decision_sections.suitable_for, 'Cocok untuk');
    assert.strictEqual(term.decision_sections.unsuitable_for, 'Kurang cocok untuk');
    assert.strictEqual(term.decision_sections.buying_considerations, 'Pertimbangan sebelum membeli');
  });

  await test('20. Prohibited foreign editorial label guard remains passing', () => {
    const banned = CANONICAL_PRODUCT_REVIEW_TERMINOLOGY.banned_terms;
    assert.ok(banned.includes('verdict'));
    assert.ok(banned.includes('final verdict'));
    assert.ok(banned.includes('review verdict'));
    assert.ok(banned.includes('verdict produk'));
  });

  await test('21. Jefry has zero execution authority and shadow-only observation', () => {
    const jefry = getJefryProductReviewAdvisoryKnowledge();
    assert.strictEqual(jefry.operating_mode, 'SHADOW_MODE_ONLY');
    assert.strictEqual(jefry.authority.autonomous_execution, false);
    assert.strictEqual(jefry.authority.review_writing, false);
    assert.strictEqual(jefry.authority.score_manipulation, false);
    assert.strictEqual(jefry.authority.product_recommendation_execution, false);
    assert.strictEqual(jefry.authority.commercial_influence, false);
  });

  await test('22. Publishing authority remains unchanged and cannot override Rina/Irwan rejection', () => {
    const sari = getSariProductReviewPublicationKnowledge();
    assert.strictEqual(sari.publication_invariants.auto_publish_state, 'OFF');
    assert.strictEqual(sari.publication_invariants.cannot_override_rina_or_irwan_rejection, true);
    assert.strictEqual(sari.authority.override_qa_failure, false);
    assert.strictEqual(sari.role, 'Sari — Product Review Gatekeeper & Human-Governed Dispatch Operations');

    const rina = getRinaProductReviewQAKnowledge();
    assert.strictEqual(rina.authority.autonomous_publishing, false);

    const irwan = getIrwanProductEvidenceKnowledge();
    assert.strictEqual(irwan.authority.author_user_facing_copy, false);
    assert.strictEqual(irwan.authority.verify_specifications, true);

    const joko = getJokoProductReviewKnowledge();
    assert.strictEqual(joko.authority.override_evidence_limits, false);
    assert.strictEqual(joko.authority.insert_affiliate_prior_to_analysis, false);
  });

  // --- SECTION 7: 9 Decision Questions Verification ---
  console.log('--- TEST SECTION 7: 9 Decision Questions & Claim-Specific Evidence Model ---');

  await test('23. Master decision questions contain exact 9 canonical questions', () => {
    assert.strictEqual(PRODUCT_DECISION_QUESTIONS.length, 9);
    assert.ok(PRODUCT_DECISION_QUESTIONS[0].includes('menyelesaikan masalah apa'));
    assert.ok(PRODUCT_DECISION_QUESTIONS[1].includes('kondisi rumah atau sistem'));
    assert.ok(PRODUCT_DECISION_QUESTIONS[3].includes('keterbatasan nyata'));
    assert.ok(PRODUCT_DECISION_QUESTIONS[4].includes('Keluhan apa yang berulang'));
    assert.ok(PRODUCT_DECISION_QUESTIONS[8].includes('biaya kepemilikan totalnya'));
  });

  await test('24. Claim-Specific Evidence Model distinguishes question types and enforces core principle', () => {
    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL);
    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL.identity_and_specification_evidence);
    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL.performance_evidence);
    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL.ownership_and_reliability_signal);
    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL.individual_anecdote);

    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL.core_principle.includes('Kekuatan bukti bergantung pada jenis klaim yang sedang dievaluasi'));
    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL.identity_and_specification_evidence.authoritative_sources.includes('OFFICIAL_MANUFACTURER_DOCS'));
    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL.performance_evidence.authoritative_sources.includes('FIRST_PARTY_TEST'));
    assert.ok(CLAIM_SPECIFIC_EVIDENCE_MODEL.ownership_and_reliability_signal.authoritative_sources.includes('AGGREGATED_USER_SIGNALS'));
  });

  console.log(`\n🎉 All ${passed} tests in RANCANGLOKA_PRODUCT_REVIEW_KNOWLEDGE_V1 passed successfully!`);
}

main().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
