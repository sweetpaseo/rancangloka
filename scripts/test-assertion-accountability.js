/**
 * RancangLoka Assertion Accountability & Reconciliation Test Suite
 * Milestone: ASSERTION-ACCOUNTABILITY-1
 *
 * Enforces:
 * - Post-draft assertion reconciliation & semantic support resolution
 * - Domain-agnostic candidate claim search
 * - Joko claim_usage as a HINT, not sole authority of grounding
 * - Strict editorial inference policy (no free passes for unverified facts)
 * - Compound assertion completeness
 * - Preservation of honest historical Final5 forensic replay
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AssertionReconciliationEngine,
  buildArticleAssertionLedger,
  extractArticleSpansWithGranularity,
  classifyNonClaimProse,
  evaluateEditorialInference,
  findCandidateClaimsForAssertion,
  DeterministicSemanticVerifier
} from '../src/lib/editorial/claim-grounding.ts';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failed++;
  }
}

async function runSuite() {
  console.log(`--- STARTING ASSERTION-ACCOUNTABILITY-1 SUITE ---`);

  // =========================================================================
  // Test A: Joko omits claim_usage but exact assertion entailed by safe claim
  // => reconciliation discovers candidate and maps it
  // =========================================================================
  await test('Test A: Joko omits claim_usage but exact assertion entailed by safe claim (auto-reconciled)', () => {
    const articleMarkdown = '# Termal Kusen\nThermal break membantu mengurangi perpindahan panas melalui kusen aluminium.';
    const authorSafeClaims = [
      {
        claim_id: 'CLM-01',
        statement: 'Thermal breaks reduce conductive heat transfer through aluminium frames.',
        support_level: 'SUPPORTED',
        applicability: 'UNIVERSAL_PHYSICS',
        claim_class: 'technical_consensus',
        allowed_for_authoring: true,
        evidence_status: 'VERIFIED',
        evidence_passage_ids: ['pas_01']
      }
    ];

    // Joko declared NO claim_usage entries (empty hint)
    const emptyUsages = [];

    const engine = new AssertionReconciliationEngine();
    const res = engine.reconcile({
      article_markdown: articleMarkdown,
      claim_usage: emptyUsages,
      authorSafeClaims
    });

    const target = res.entries.find(e => e.article_span.includes('Thermal break membantu mengurangi perpindahan'));
    assert.ok(target, 'Target assertion must be extracted');
    assert.equal(target.classification, 'EVIDENCE_BACKED');
    assert.equal(target.resolution_source, 'DETERMINISTIC_RECONCILIATION');
    assert.deepEqual(target.supporting_claim_ids, ['CLM-01']);
    assert.equal(target.semantic_result, 'ENTAILED');
    assert.equal(res.metrics.auto_reconciled_mapping_count >= 1, true);
  });

  // =========================================================================
  // Test B: Joko maps assertion to wrong claim => mapping rejected
  // =========================================================================
  await test('Test B: Joko maps assertion to wrong claim => mapping rejected (NOT_ENTAILED)', () => {
    const articleMarkdown = '# Kusen dan Kaca\nThermal break mengurangi perpindahan panas melalui kusen aluminium.';
    const authorSafeClaims = [
      {
        claim_id: 'CLM-WRONG-01',
        statement: 'Laminated glazing improves impact retention against wind pressure.',
        support_level: 'SUPPORTED',
        applicability: 'UNIVERSAL_PHYSICS',
        claim_class: 'technical_consensus',
        allowed_for_authoring: true,
        evidence_status: 'VERIFIED',
        evidence_passage_ids: ['pas_02']
      }
    ];

    // Joko mistakenly declared wrong claim
    const wrongUsages = [
      {
        claim_id: 'CLM-WRONG-01',
        article_excerpt: 'Thermal break mengurangi perpindahan panas melalui kusen aluminium.',
        usage_type: 'DIRECT_PARAPHRASE'
      }
    ];

    const engine = new AssertionReconciliationEngine();
    const res = engine.reconcile({
      article_markdown: articleMarkdown,
      claim_usage: wrongUsages,
      authorSafeClaims
    });

    const target = res.entries.find(e => e.article_span.includes('Thermal break'));
    assert.ok(target, 'Target assertion must be present');
    assert.notEqual(target.classification, 'EVIDENCE_BACKED');
    assert.equal(target.classification, 'UNRESOLVED');
    assert.notEqual(target.semantic_result, 'ENTAILED');
    assert.equal(res.metrics.not_entailed_count >= 1, true);
  });

  // =========================================================================
  // Test C: No semantically valid supporting claim exists => UNRESOLVED
  // =========================================================================
  await test('Test C: No semantically valid supporting claim exists => UNRESOLVED', () => {
    const articleMarkdown = '# Spesifikasi Kusen\nKetebalan profil kusen minimal harus 1.4 mm untuk menahan beban angin lantai tiga.';
    const authorSafeClaims = [
      {
        claim_id: 'CLM-VENT-01',
        statement: 'Membuka jendela di pagi hari meningkatkan laju pertukaran udara alami.',
        support_level: 'SUPPORTED',
        applicability: 'UNIVERSAL_PHYSICS',
        claim_class: 'technical_consensus',
        allowed_for_authoring: true,
        evidence_status: 'VERIFIED',
        evidence_passage_ids: ['pas_03']
      }
    ];

    const engine = new AssertionReconciliationEngine();
    const res = engine.reconcile({
      article_markdown: articleMarkdown,
      claim_usage: [],
      authorSafeClaims
    });

    const target = res.entries.find(e => e.article_span.includes('Ketebalan profil kusen'));
    assert.ok(target, 'Target assertion must be present');
    assert.equal(target.classification, 'UNRESOLVED');
    assert.ok(res.unresolved_spans.includes(target.article_span));
    assert.equal(res.is_complete, false);
  });

  // =========================================================================
  // Test D: Assertion is genuine supported editorial synthesis
  // => EDITORIAL_INFERENCE with derived_from_claim_ids
  // =========================================================================
  await test('Test D: Genuine supported editorial synthesis => EDITORIAL_INFERENCE with derived_from_claim_ids', () => {
    const articleMarkdown = '# Panduan Keputusan\nMemilih antara perbaikan ventilasi atau penggantian material memerlukan penelusuran kondisi ruangan terlebih dahulu.';
    const authorSafeClaims = [
      {
        claim_id: 'CLM-01',
        statement: 'Ventilation habits and room moisture affect condensation patterns.',
        support_level: 'SUPPORTED',
        applicability: 'UNIVERSAL_PHYSICS',
        claim_class: 'technical_consensus',
        allowed_for_authoring: true,
        evidence_status: 'VERIFIED',
        evidence_passage_ids: ['pas_01']
      }
    ];

    const engine = new AssertionReconciliationEngine();
    const res = engine.reconcile({
      article_markdown: articleMarkdown,
      claim_usage: [],
      authorSafeClaims
    });

    const target = res.entries.find(e => e.article_span.includes('Memilih antara perbaikan ventilasi'));
    assert.ok(target, 'Target assertion must be present');
    assert.equal(target.classification, 'EDITORIAL_INFERENCE');
    assert.equal(target.resolution_source, 'EDITORIAL_INFERENCE_POLICY');
    assert.ok(target.derived_from_claim_ids && target.derived_from_claim_ids.length > 0);
    assert.ok(target.inference_reason && target.inference_reason.length > 0);
  });

  // =========================================================================
  // Test E: Pure transition sentence => NON_CLAIM_PROSE
  // =========================================================================
  await test('Test E: Pure transition and navigational sentence => NON_CLAIM_PROSE', () => {
    const transitions = [
      'Di bawah ini kita melihat langkah pengamatan penting.',
      'Sebagai catatan, pemeriksaan ini dapat dilakukan bertahap.',
      'Apakah masalahnya ada pada kusen atau kaca?',
      '## Panduan Langkah Berikutnya'
    ];

    for (const t of transitions) {
      const classification = classifyNonClaimProse(t);
      assert.equal(classification.isExempt, true, `Transition should be exempt: "${t}"`);
    }
  });

  // =========================================================================
  // Test F: Technical sentence mislabeled non-claim => rejected
  // =========================================================================
  await test('Test F: Technical sentence with facts or metrics mislabeled non-claim => rejected', () => {
    const technicalSentences = [
      'Konduktivitas termal aluminium standar mencapai 160 W/mK sehingga kusen cepat dingin.',
      'Nilai U-value kusen tanpa thermal break adalah 5.8 W/m2K.',
      'Thermal break dari poliamida menurunkan koefisien perpindahan panas secara signifikan.',
      'Lapisan waterproofing akrilik memiliki elongasi putus sebesar 150 persen.'
    ];

    for (const s of technicalSentences) {
      const classification = classifyNonClaimProse(s);
      assert.equal(classification.isExempt, false, `Technical sentence must NOT be exempt: "${s}"`);
      assert.equal(classification.reason.includes('DECLARATIVE_PROSE'), true);
    }
  });

  // =========================================================================
  // Test G: Compound assertion partially supported => UNRESOLVED / UNCERTAIN
  // =========================================================================
  await test('Test G: Compound assertion partially supported => UNRESOLVED / UNCERTAIN', () => {
    const compoundAssertion = 'Thermal break mengurangi perpindahan panas melalui kusen aluminium, serta lapisan low-e memantulkan 80 persen radiasi inframerah.';
    const authorSafeClaims = [
      {
        claim_id: 'CLM-TB-01',
        statement: 'Thermal breaks reduce conductive heat transfer through aluminium frames.',
        support_level: 'SUPPORTED',
        applicability: 'UNIVERSAL_PHYSICS',
        claim_class: 'technical_consensus',
        allowed_for_authoring: true,
        evidence_status: 'VERIFIED',
        evidence_passage_ids: ['pas_tb']
      }
      // Low-e 80% claim is MISSING!
    ];

    const engine = new AssertionReconciliationEngine();
    const res = engine.reconcile({
      article_markdown: compoundAssertion,
      claim_usage: [],
      authorSafeClaims
    });

    const target = res.entries[0];
    assert.ok(target);
    assert.notEqual(target.classification, 'EVIDENCE_BACKED', 'Partially supported compound assertion must NOT be EVIDENCE_BACKED');
    assert.equal(target.classification, 'UNRESOLVED');
  });

  // =========================================================================
  // Test H: Claim ID renamed while proposition stays identical
  // => same semantic result
  // =========================================================================
  await test('Test H: Claim ID renamed while proposition stays identical => same semantic result', () => {
    const span = 'Thermal break mengurangi perpindahan panas melalui kusen aluminium.';
    const claim1 = {
      claim_id: 'CLM-001',
      statement: 'Thermal breaks reduce conductive heat transfer through aluminium frames.',
      support_level: 'SUPPORTED',
      applicability: 'UNIVERSAL_PHYSICS',
      claim_class: 'technical_consensus',
      allowed_for_authoring: true,
      evidence_status: 'VERIFIED',
      evidence_passage_ids: ['pas_1']
    };
    const claim2 = {
      ...claim1,
      claim_id: 'RANDOM-ALPHANUMERIC-98765'
    };

    const engine = new AssertionReconciliationEngine();
    const res1 = engine.reconcile({
      article_markdown: span,
      authorSafeClaims: [claim1]
    });
    const res2 = engine.reconcile({
      article_markdown: span,
      authorSafeClaims: [claim2]
    });

    assert.equal(res1.entries[0].classification, res2.entries[0].classification);
    assert.equal(res1.entries[0].semantic_result, res2.entries[0].semantic_result);
    assert.equal(res1.entries[0].classification, 'EVIDENCE_BACKED');
  });

  // =========================================================================
  // Test I: Unrelated domain claims cannot satisfy assertion
  // =========================================================================
  await test('Test I: Unrelated domain claims cannot satisfy assertion', () => {
    const articleAssertion = 'Pergerakan retak pada dak beton dapat merusak lapisan waterproofing yang kaku.';
    const fenestrationClaims = [
      {
        claim_id: 'CLM-WIN-01',
        statement: 'Opening windows improves natural air exchange in living rooms.',
        support_level: 'SUPPORTED',
        applicability: 'UNIVERSAL_PHYSICS',
        claim_class: 'technical_consensus',
        allowed_for_authoring: true,
        evidence_status: 'VERIFIED',
        evidence_passage_ids: ['pas_w']
      },
      {
        claim_id: 'CLM-WIN-02',
        statement: 'Aluminium frame anodizing provides corrosion protection against moisture.',
        support_level: 'SUPPORTED',
        applicability: 'UNIVERSAL_PHYSICS',
        claim_class: 'technical_consensus',
        allowed_for_authoring: true,
        evidence_status: 'VERIFIED',
        evidence_passage_ids: ['pas_w2']
      }
    ];

    const engine = new AssertionReconciliationEngine();
    const res = engine.reconcile({
      article_markdown: articleAssertion,
      authorSafeClaims: fenestrationClaims
    });

    assert.equal(res.entries[0].classification, 'UNRESOLVED');
    assert.equal(res.entries[0].supporting_claim_ids.length, 0);
  });

  // =========================================================================
  // Test J: Numeric assertion with mismatched evidence => NOT_ENTAILED
  // =========================================================================
  await test('Test J: Numeric assertion with mismatched evidence => NOT_ENTAILED', () => {
    const verifier = new DeterministicSemanticVerifier();
    const res = verifier.verify({
      articleAssertion: 'Tinggi ambang jendela minimum adalah 150 mm untuk menahan genangan.',
      claimStatement: 'Threshold height of 50 mm is required for standard water retention.',
      claimIds: ['CLM-NUM-01']
    });

    assert.notEqual(res.result, 'ENTAILED');
    assert.equal(res.result, 'NOT_ENTAILED');
  });

  // =========================================================================
  // Test K: All ledger spans are represented exactly once (1:1 bijection)
  // =========================================================================
  await test('Test K: All ledger spans are represented exactly once (1:1 bijection & accounting check)', () => {
    const sampleMarkdown = `
# Kusen Aluminium Rumah

Apakah jendela Anda berembun di pagi hari?
Thermal break membantu mengurangi perpindahan panas melalui kusen aluminium.
Periksa lokasi embun sebelum membersihkan kaca.
Jika ragu, amati kondisi selama beberapa pagi.
    `.trim();

    const authorSafeClaims = [
      {
        claim_id: 'CLM-TB-01',
        statement: 'Thermal breaks reduce conductive heat transfer through aluminium frames.',
        support_level: 'SUPPORTED',
        applicability: 'UNIVERSAL_PHYSICS',
        claim_class: 'technical_consensus',
        allowed_for_authoring: true,
        evidence_status: 'VERIFIED',
        evidence_passage_ids: ['pas_01']
      }
    ];

    const ledger = buildArticleAssertionLedger(sampleMarkdown, [], { authorSafeClaims });

    assert.equal(ledger.entries.length, ledger.total_spans_count);

    // Sum of categorized counts must equal total spans
    const accountedSum =
      ledger.evidence_backed_count +
      ledger.editorial_inference_count +
      ledger.non_claim_prose_count +
      (ledger.unresolved_assertion_count || 0);

    assert.equal(accountedSum, ledger.total_spans_count, 'Accounting identity must hold strictly');

    // Unique assertions and char bounds
    const idSet = new Set(ledger.entries.map(e => e.assertion_id));
    assert.equal(idSet.size, ledger.entries.length, 'Every assertion must have a unique ID');
  });

  // =========================================================================
  // Test L: 59 historical Final5 unaccounted spans processed without manual article edits
  // =========================================================================
  await test('Test L: 59 historical Final5 unaccounted spans forensic replay (no manual article edits)', () => {
    const final5Dir = path.resolve('scripts/runtime-proof/final5');
    const draftPath = path.join(final5Dir, 'final5-raw-draft.md');
    const envelopePath = path.join(final5Dir, 'final5-draft-envelope.json');
    const claimsPath = path.join(final5Dir, 'final5-author-safe-claims.json');
    const packPath = path.join(final5Dir, 'final5-evidence-pack.json');

    assert.ok(fs.existsSync(draftPath), 'final5-raw-draft.md must exist');
    assert.ok(fs.existsSync(envelopePath), 'final5-draft-envelope.json must exist');
    assert.ok(fs.existsSync(claimsPath), 'final5-author-safe-claims.json must exist');
    assert.ok(fs.existsSync(packPath), 'final5-evidence-pack.json must exist');

    const draftMarkdown = fs.readFileSync(draftPath, 'utf8');
    const envelope = JSON.parse(fs.readFileSync(envelopePath, 'utf8'));
    const safeClaims = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
    const evidencePack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

    const engine = new AssertionReconciliationEngine();
    const result = engine.reconcile({
      article_markdown: draftMarkdown,
      claim_usage: envelope.claim_usage,
      authorSafeClaims: safeClaims,
      evidencePack
    });

    console.log(`\n      [Final5 Forensic Replay Metrics]`);
    console.log(`      Total Spans:                   ${result.metrics.total_article_spans}`);
    console.log(`      Substantive Assertions:        ${result.metrics.substantive_assertion_count}`);
    console.log(`      Evidence-Backed:               ${result.metrics.evidence_backed_count}`);
    console.log(`      Editorial Inference:           ${result.metrics.editorial_inference_count}`);
    console.log(`      Non-Claim Prose:               ${result.metrics.non_claim_prose_count}`);
    console.log(`      Joko Declared Mappings:        ${result.metrics.joko_declared_mapping_count}`);
    console.log(`      Auto-Reconciled Mappings:      ${result.metrics.auto_reconciled_mapping_count}`);
    console.log(`      Unresolved Assertions:         ${result.metrics.unresolved_assertion_count}`);
    console.log(`      Not Entailed Count:            ${result.metrics.not_entailed_count}`);
    console.log(`      Uncertain Count:               ${result.metrics.uncertain_count}`);

    // Verification of historical facts:
    // Original Final5 had 66 spans and 59 unaccounted.
    assert.equal(result.metrics.total_article_spans, 66, 'Must process exactly 66 spans from Final5 draft');

    // All spans accounted in the categorized partitions
    const sum =
      result.metrics.evidence_backed_count +
      result.metrics.editorial_inference_count +
      result.metrics.non_claim_prose_count +
      result.metrics.unresolved_assertion_count;
    assert.equal(sum, 66, 'Every span must belong to exactly one partition');

    // Section 15 Invariant:
    // DO NOT force Final5 to pass. If sentences introduced unsupported facts, they MUST remain UNRESOLVED.
    // Assert that the engine honestly reports unresolved count rather than masking it.
    assert.ok(
      result.metrics.unresolved_assertion_count > 0,
      'Final5 draft genuinely introduced fenestration physics propositions not in the 112 claims; it MUST remain UNRESOLVED (> 0)'
    );

    // Verify that the draft markdown was untouched (historical 8,589 characters)
    assert.equal(draftMarkdown.length, 8589, 'Final5 raw draft content must be completely untouched');
  });

  console.log(`\n==================================================`);
  console.log(`ASSERTION-ACCOUNTABILITY-1 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);
  if (failed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});
