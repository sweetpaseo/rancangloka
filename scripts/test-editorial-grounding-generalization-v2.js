/**
 * RancangLoka Editorial Test Suite
 * Milestone: EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1B
 * DOMAIN-AGNOSTIC GROUNDING ARCHITECTURE TEST SUITE
 *
 * Enforces:
 * - A: Exhaustive assertion ledger coverage across multiple domains
 * - B: Non-claim prose exemption (connective phrasing, rhetorical questions)
 * - C: Wrong-domain claim never ENTAILED (adversarial verification)
 * - D: Unknown semantic relation fails closed (UNCERTAIN -> review required)
 * - E: Claim IDs irrelevant to semantics (pure proposition verification)
 * - F: Compound claim completeness (supported synthesis sub-propositions)
 * - G: Arbitrary jurisdiction from metadata (Singapore, Indonesia, etc.)
 * - H: Arbitrary standard from metadata (ASTM, SNI, ISO)
 * - I: Missing jurisdiction on regulation => UNKNOWN_SCOPE & fail-closed block
 * - J: Source provenance exact locator regression preserved
 * - K: Historical roof compatibility isolated
 * - L: Fresh topic bypasses all historical semantics
 */

import assert from 'node:assert/strict';
import {
  extractArticleSentenceSpans,
  isNonClaimProse,
  buildArticleAssertionLedger,
  DeterministicSemanticVerifier,
  BoundedEditorialSemanticVerifierAdapter,
  validateMultiClaimSynthesis,
  validateClaimUsageEntailment,
  validateClaimGrounding,
  auditTechnicalAssertionCoverage
} from '../src/lib/editorial/claim-grounding.ts';
import {
  resolveEvidenceScope,
  auditEvidencePackProvenance,
  generateAuthorSafeClaims,
  locatePassageInSource,
  normalizeSourceText,
  isHistoricalRoofPack
} from '../src/lib/article/human-quality.ts';

async function runSuite() {
  console.log('--- STARTING EDITORIAL-GROUNDING-GENERALIZATION-V2 SUITE ---');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // =========================================================================
  // Test A: Exhaustive assertion ledger coverage across multiple domains
  // =========================================================================
  await test('Test A: Exhaustive assertion ledger coverage across multiple domains', async () => {
    const multiDomainMarkdown = [
      '# Panduan Bangunan Lintas Bidang',
      'Air dapat bergerak naik melalui material berpori secara kapiler.',
      'Thermal break membantu mengurangi perpindahan panas melalui kusen aluminium.',
      'Rasio air-semen yang berbeda memengaruhi perilaku beton.'
    ].join('\n');

    // Case 1: Without claim usages -> all 3 declarative sentences must appear as unaccounted
    const emptyLedger = buildArticleAssertionLedger(multiDomainMarkdown, []);
    assert.equal(emptyLedger.is_exhaustive, false);
    assert.equal(emptyLedger.unaccounted_count, 3);
    assert.equal(emptyLedger.entries.length, 3);
    assert.ok(emptyLedger.unaccounted_spans.some(s => s.includes('bergerak naik melalui material berpori')));
    assert.ok(emptyLedger.unaccounted_spans.some(s => s.includes('Thermal break membantu mengurangi perpindahan panas')));
    assert.ok(emptyLedger.unaccounted_spans.some(s => s.includes('Rasio air-semen yang berbeda')));
    assert.ok(emptyLedger.errors.some(e => e.includes('ARTICLE_ASSERTION_UNACCOUNTED')));

    // Case 2: Covered by claim usages -> exhaustive ledger pass
    const usages = [
      {
        claim_id: 'CLM-MOISTURE-01',
        article_excerpt: 'Air dapat bergerak naik melalui material berpori secara kapiler.',
        usage_type: 'DIRECT_PARAPHRASE'
      },
      {
        claim_id: 'CLM-WINDOW-01',
        article_excerpt: 'Thermal break membantu mengurangi perpindahan panas melalui kusen aluminium.',
        usage_type: 'DIRECT_PARAPHRASE'
      },
      {
        claim_id: 'CLM-CONCRETE-01',
        article_excerpt: 'Rasio air-semen yang berbeda memengaruhi perilaku beton.',
        usage_type: 'DIRECT_PARAPHRASE'
      }
    ];

    const coveredLedger = buildArticleAssertionLedger(multiDomainMarkdown, usages);
    assert.equal(coveredLedger.is_exhaustive, true);
    assert.equal(coveredLedger.unaccounted_count, 0);
    assert.equal(coveredLedger.evidence_backed_count, 3);
  });

  // =========================================================================
  // Test B: Non-claim prose exemption
  // =========================================================================
  await test('Test B: Non-claim prose exemption (connectives, questions, navigation)', async () => {
    const proseMarkdown = [
      '# Bagian Pengantar',
      'Untuk memahaminya, kita lihat kondisi lapangan lebih dulu.',
      'Apakah perbedaan material selalu berbanding lurus dengan biaya perbaikan?',
      'Langkah pertama adalah mengecek jalur rembesan.',
      '[Sumber: Dokumentasi Teknis]'
    ].join('\n');

    const ledger = buildArticleAssertionLedger(proseMarkdown, []);
    assert.equal(ledger.unaccounted_count, 0, 'Connectives, questions, and formatting fragments must not be unaccounted errors');
    assert.equal(ledger.is_exhaustive, true);
    assert.ok(ledger.non_claim_prose_count >= 3);
  });

  // =========================================================================
  // Test C: Wrong-domain claim never ENTAILED (Adversarial test)
  // =========================================================================
  await test('Test C: Wrong-domain claim never ENTAILED across adversarial pairs', async () => {
    const verifier = new DeterministicSemanticVerifier();

    // Pair 1: Moisture vs Mold Respiratory
    const pair1 = verifier.verify({
      articleAssertion: 'Air bergerak melalui material berpori secara kapiler.',
      claimStatement: 'Indoor mold can contribute to respiratory symptoms.'
    });
    assert.notEqual(pair1.result, 'ENTAILED', 'Moisture cannot be entailed by mold respiratory claim');
    assert.equal(pair1.result, 'NOT_ENTAILED');

    // Pair 2: Window Thermal Break vs Laminated Glazing Impact
    const pair2 = verifier.verify({
      articleAssertion: 'Thermal break mengurangi perpindahan panas melalui kusen aluminium.',
      claimStatement: 'Laminated glazing improves impact retention.'
    });
    assert.notEqual(pair2.result, 'ENTAILED', 'Thermal break cannot be entailed by laminated impact claim');
    assert.equal(pair2.result, 'NOT_ENTAILED');

    // Pair 3: Concrete Crack Waterproofing vs Water-Cement Compressive Strength
    const pair3 = verifier.verify({
      articleAssertion: 'Pergerakan retak dapat merusak lapisan waterproofing yang kaku.',
      claimStatement: 'Lower water-cement ratio can increase concrete compressive strength.'
    });
    assert.notEqual(pair3.result, 'ENTAILED', 'Waterproofing crack cannot be entailed by concrete water-cement claim');
    assert.equal(pair3.result, 'NOT_ENTAILED');
  });

  // =========================================================================
  // Test D: Unknown semantic relation fails closed
  // =========================================================================
  await test('Test D: Unknown semantic relation fails closed (UNCERTAIN -> review required)', async () => {
    const verifier = new DeterministicSemanticVerifier();
    // Proposition where relation is uncertain / cannot be deterministically proven
    const res = verifier.verify({
      articleAssertion: 'Desain ventilasi silang dapat memengaruhi persepsi kesegaran ruang tamu.',
      claimStatement: 'Natural air velocity of 0.3 m/s improves human comfort evaluation in warm environments.'
    });
    // Never default unknown domains to ENTAILED or VALID
    assert.notEqual(res.result, 'ENTAILED');
    assert.ok(res.result === 'UNCERTAIN' || res.result === 'NOT_ENTAILED');

    // In validation context, UNCERTAIN must fail closed
    const usage = {
      claim_id: 'CLM-UNKNOWN-01',
      article_excerpt: 'Desain ventilasi silang dapat memengaruhi persepsi kesegaran ruang tamu.',
      usage_type: 'DIRECT_PARAPHRASE'
    };
    const claim = {
      claim_id: 'CLM-UNKNOWN-01',
      statement: 'Natural air velocity of 0.3 m/s improves human comfort evaluation in warm environments.'
    };
    const entailment = validateClaimUsageEntailment(usage, claim);
    assert.equal(entailment.isEntailed, false, 'UNCERTAIN semantic relation must fail closed in production');
    assert.equal(entailment.code, 'CLAIM_USAGE_ENTAILMENT_MISMATCH');
  });

  // =========================================================================
  // Test E: Claim IDs irrelevant to semantics
  // =========================================================================
  await test('Test E: Claim IDs irrelevant to semantics (pure proposition verification)', async () => {
    const verifier = new DeterministicSemanticVerifier();

    // Adversarial: Claim ID says THERMAL_BREAK_ALIGNED, but proposition is completely mismatched
    const adversarialRes = verifier.verify({
      articleAssertion: 'Thermal break mengurangi perpindahan panas melalui kusen aluminium.',
      claimStatement: 'Laminated glazing improves impact retention.',
      claimIds: ['CLM-THERMAL-BREAK-001']
    });
    assert.notEqual(adversarialRes.result, 'ENTAILED', 'Claim ID string cannot grant entailment to mismatched proposition');
    assert.equal(adversarialRes.result, 'NOT_ENTAILED');

    // Genuine match with completely random / generic ID
    const validRes = verifier.verify({
      articleAssertion: 'Thermal break mengurangi perpindahan panas melalui kusen aluminium.',
      claimStatement: 'Thermal breaks reduce conductive heat transfer through aluminium frames.',
      claimIds: ['RANDOM-UUID-998877']
    });
    assert.equal(validRes.result, 'ENTAILED', 'Genuine proposition match must pass regardless of arbitrary claim ID');
  });

  // =========================================================================
  // Test F: Compound claim completeness
  // =========================================================================
  await test('Test F: Compound claim completeness (supported synthesis sub-propositions)', async () => {
    const compoundAssertion = 'Thermal break mengurangi perpindahan panas melalui kusen aluminium, serta pergerakan retak dapat merusak lapisan waterproofing yang kaku.';

    const claim1 = {
      claim_id: 'CLM-01',
      statement: 'Thermal breaks reduce conductive heat transfer through aluminium frames.'
    };
    const claim2 = {
      claim_id: 'CLM-02',
      statement: 'Crack movement can compromise rigid waterproofing layers.'
    };

    // Case 1: Partial match (only claim 1 provided) -> must return UNCERTAIN
    const partialRes = validateMultiClaimSynthesis(compoundAssertion, [claim1]);
    assert.equal(partialRes.result, 'UNCERTAIN', 'Compound assertion with missing sub-proposition support must be UNCERTAIN');
    assert.ok(partialRes.reason.includes('sub-propositions not supported'));

    // Case 2: Complete match (both claim 1 and 2 provided) -> ENTAILED
    const completeRes = validateMultiClaimSynthesis(compoundAssertion, [claim1, claim2]);
    assert.equal(completeRes.result, 'ENTAILED', 'All material parts of compound assertion are supported');
  });

  // =========================================================================
  // Test G: Arbitrary jurisdiction from metadata
  // =========================================================================
  await test('Test G: Arbitrary jurisdiction from metadata (Singapore, Indonesia, UK)', async () => {
    // 1. Singapore Regulation
    const sgScope = resolveEvidenceScope({
      document_type: 'REGULATION',
      jurisdiction: 'Singapore'
    });
    assert.equal(sgScope.applicability_kind, 'JURISDICTION_SPECIFIC');
    assert.deepEqual(sgScope.jurisdictions, ['Singapore']);

    // In Indonesian general article, Singapore regulation must be blocked
    const sgClaim = {
      claim_id: 'CLM-SG-01',
      statement: 'Building facade envelope regulations require specific thermal transfer limits.',
      sources: [{ retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED', document_type: 'REGULATION', jurisdiction: 'Singapore' }],
      evidence_passage_ids: ['pas_sg_01']
    };
    const safeClaimsSG = generateAuthorSafeClaims([sgClaim]);
    assert.equal(safeClaimsSG[0].allowed_for_authoring, false);
    assert.equal(safeClaimsSG[0].jurisdiction_blocked, true);

    // 2. Indonesian Regulation
    const idScope = resolveEvidenceScope({
      document_type: 'REGULATION',
      jurisdiction: 'Indonesia'
    });
    assert.equal(idScope.applicability_kind, 'JURISDICTION_SPECIFIC');
    assert.deepEqual(idScope.jurisdictions, ['Indonesia']);

    const idClaim = {
      claim_id: 'CLM-ID-01',
      statement: 'Peraturan Menteri PUPR menetapkan standar keandalan bangunan gedung.',
      sources: [{ retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED', document_type: 'REGULATION', jurisdiction: 'Indonesia' }],
      evidence_passage_ids: ['pas_id_01']
    };
    const safeClaimsID = generateAuthorSafeClaims([idClaim]);
    assert.equal(safeClaimsID[0].allowed_for_authoring, true);
    assert.equal(safeClaimsID[0].jurisdiction_blocked, undefined);
  });

  // =========================================================================
  // Test H: Arbitrary standard from metadata
  // =========================================================================
  await test('Test H: Arbitrary standard from metadata (ASTM C836, SNI 03-6572-2001)', async () => {
    const astmScope = resolveEvidenceScope({
      document_type: 'STANDARD',
      standard_id: 'ASTM C836'
    });
    assert.equal(astmScope.applicability_kind, 'STANDARD_SPECIFIC');
    assert.deepEqual(astmScope.standards, ['ASTM C836']);

    const sniScope = resolveEvidenceScope({
      document_type: 'STANDARD',
      standard_id: 'SNI 03-6572-2001'
    });
    assert.equal(sniScope.applicability_kind, 'STANDARD_SPECIFIC');
    assert.deepEqual(sniScope.standards, ['SNI 03-6572-2001']);

    // Scientific guidance based on physical mechanism
    const physicsScope = resolveEvidenceScope({
      document_type: 'SCIENTIFIC_GUIDANCE',
      applicability_basis: 'physical mechanism'
    });
    assert.equal(physicsScope.applicability_kind, 'UNIVERSAL_PHYSICS');
  });

  // =========================================================================
  // Test I: Missing jurisdiction on regulation => UNKNOWN_SCOPE / blocked
  // =========================================================================
  await test('Test I: Missing jurisdiction on regulation fails closed as UNKNOWN_SCOPE', async () => {
    const anonRegScope = resolveEvidenceScope({
      document_type: 'REGULATION'
      // missing jurisdiction!
    });
    assert.equal(anonRegScope.applicability_kind, 'UNKNOWN_SCOPE');

    const anonClaim = {
      claim_id: 'CLM-ANON-01',
      statement: 'Landlord housing standards require damp remediation within 14 days.',
      claim_class: 'regulatory_reference',
      sources: [{ retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED', document_type: 'REGULATION' }],
      evidence_passage_ids: ['pas_anon_01']
    };

    // Must be blocked for authoring
    const safeClaims = generateAuthorSafeClaims([anonClaim]);
    assert.equal(safeClaims[0].allowed_for_authoring, false);
    assert.equal(safeClaims[0].applicability, 'UNKNOWN_SCOPE');

    // Provenance audit must fail
    const audit = auditEvidencePackProvenance({
      evidence_pack_id: 'ep_anon_reg',
      claim_inventory: [anonClaim]
    });
    assert.equal(audit.requires_provenance_failure, true);
    assert.ok(audit.missing_provenance_claims.some(c => c.includes('REGULATORY_SCOPE_UNKNOWN')));
  });

  // =========================================================================
  // Test J: Source provenance exact locator regression preserved
  // =========================================================================
  await test('Test J: Source provenance exact locator regression preserved', async () => {
    const rawSource = 'The primary mechanism of moisture movement in masonry is capillary action through pores.';
    const passage = 'moisture movement in masonry is capillary action';

    const loc = locatePassageInSource(passage, rawSource);
    assert.equal(loc.found, true);
    assert.ok(loc.charStart >= 0);
    assert.ok(loc.charEnd > loc.charStart);
    assert.equal(rawSource.slice(loc.charStart, loc.charEnd), passage);
    assert.ok(loc.sourceRawHash.length === 64);
    assert.ok(loc.passageHash.length === 64);
  });

  // =========================================================================
  // Test K: Historical roof compatibility isolated
  // =========================================================================
  await test('Test K: Historical roof compatibility isolated in isHistoricalRoofPack', async () => {
    const historicalPack = {
      evidence_pack_id: 'pack_historical_roof_1',
      milestone: 'EDITORIAL-RUNTIME-3',
      is_historical_roof_pack: true,
      topic: 'atap metal terasa panas'
    };
    assert.equal(isHistoricalRoofPack(historicalPack), true);

    const freshPack = {
      evidence_pack_id: 'pack_fresh_window_1',
      milestone: 'EDITORIAL-RUNTIME-4B',
      topic: 'Kusen aluminium berembun dan rembes air hujan'
    };
    assert.equal(isHistoricalRoofPack(freshPack), false);
  });

  // =========================================================================
  // Test L: Fresh topic bypasses all historical claim-ID semantics
  // =========================================================================
  await test('Test L: Fresh topic bypasses all historical claim-ID semantics', async () => {
    const freshEnvelope = {
      article_markdown: '# Kusen Aluminium\nThermal break membantu mengurangi perpindahan panas melalui kusen aluminium.',
      claim_usage: [
        {
          claim_id: 'FRESH-CLAIM-WIN-01',
          article_excerpt: 'Thermal break membantu mengurangi perpindahan panas melalui kusen aluminium.',
          usage_type: 'DIRECT_PARAPHRASE'
        }
      ],
      unsupported_claim_candidates: []
    };

    const freshPack = {
      evidence_pack_id: 'ep_fresh_window',
      topic: 'Kusen aluminium dan kenyamanan termal jendela',
      claim_inventory: [
        {
          claim_id: 'FRESH-CLAIM-WIN-01',
          statement: 'Thermal breaks reduce conductive heat transfer through aluminium frames.',
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          sources: [
            {
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
              document_type: 'SCIENTIFIC_GUIDANCE',
              applicability_basis: 'physical mechanism'
            }
          ],
          evidence_passage_ids: ['pas_win_01']
        }
      ]
    };

    const audit = validateClaimGrounding(freshEnvelope, freshPack);
    assert.equal(audit.isValid, true, 'Fresh topic must validate purely on domain-agnostic contracts without historical roof rules');
    assert.equal(audit.unrecognizedClaimIds.length, 0);
    assert.equal(audit.entailmentMismatchCount, 0);
    assert.equal(audit.unaccountedAssertionsCount, 0);
  });

  console.log(`\n==================================================`);
  console.log(`GENERALIZATION-V2 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);
  if (failed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});
