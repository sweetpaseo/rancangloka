/**
 * RancangLoka — Evidence Grounding & Provenance Hardening Test Suite
 * Milestone: EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1
 *
 * Verifies:
 * A. Exact passage exists in raw source => PASS
 * B. Synthetic sentence absent from raw source labeled exact => FAIL (PASSAGE_NOT_IN_RETRIEVED_SOURCE)
 * C. Source paraphrase with backing passages => allowed as SOURCE_PARAPHRASE / synthesis
 * D. CLM-005 mapped to respiratory/allergy excerpt => CLAIM_USAGE_ENTAILMENT_MISMATCH
 * E. Correct health claim mapped to health excerpt => PASS
 * F. Technical article sentence with no claim_usage => UNDECLARED_TECHNICAL_ASSERTION
 * G. UK regulation marked UNIVERSAL_PHYSICS => FAIL (JURISDICTION_MISCLASSIFIED_AS_UNIVERSAL)
 * H. UK regulation on Indonesian generic article => blocked from author-safe set (jurisdiction_blocked)
 * I. Same UK regulation in explicit UK article => qualified/allowed according to policy
 * J. Prompt audit file containing "radiant barrier" dictionary => must NOT itself trigger semantic leak
 * K. Meta/manifest/final classification disagreement => PROOF_CLASSIFICATION_INCONSISTENCY
 */

import assert from 'node:assert/strict';
import {
  auditEvidencePackProvenance,
  generateAuthorSafeClaims,
  calculateAuthorSafeMetrics,
  locatePassageInSource,
  normalizeSourceText
} from '../src/lib/article/human-quality.ts';

import {
  validateClaimGrounding,
  locateArticleSpan,
  validateClaimUsageEntailment,
  auditTechnicalAssertionCoverage
} from '../src/lib/editorial/claim-grounding.ts';

import {
  validateProofMetadataConsistency,
  scanActiveContentForLeaks
} from '../src/lib/editorial/proof-metadata-consistency.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting Evidence Grounding & Provenance Hardening Suite (EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1)...\n');

  // Test A: exact passage exists in raw source => PASS
  await test('Test A: Exact passage present in retrieved raw source returns found with valid character locators', async () => {
    const rawSource = 'Structural dampness is unwanted moisture in a building. Coatings will fail if applied before surfaces are dry enough.';
    const passage = 'Coatings will fail if applied before surfaces are dry enough.';

    const loc = locatePassageInSource(passage, rawSource);
    assert.equal(loc.found, true);
    assert.ok(loc.charStart >= 0);
    assert.ok(loc.charEnd > loc.charStart);
    assert.ok(loc.passageHash.length === 64);

    const ep = {
      evidence_pack_id: 'ep_test_a',
      topic: 'Kelembapan Dinding',
      claim_inventory: [
        {
          claim_id: 'CLM-001',
          statement: 'Coatings will fail if applied before surfaces are dry.',
          evidence_status: 'VERIFIED',
          sources: [
            {
              source_id: 'SRC-01',
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
              raw_content_preview: rawSource,
              source_classification: 'TECHNICAL_REPORT'
            }
          ],
          evidence_passage_ids: ['psg_01'],
          semantic_role: 'CORE_TECHNICAL_PRINCIPLE'
        }
      ],
      evidence_passages: [
        {
          passage_id: 'psg_01',
          source_id: 'SRC-01',
          locator: 'Section 2',
          exact_text: passage,
          exact_or_normalized_excerpt: passage,
          extracted_at: new Date().toISOString(),
          supports_claim_ids: ['CLM-001'],
          semantic_role: 'CORE_TECHNICAL_PRINCIPLE',
          passage_nature: 'EXACT_LOCATED'
        }
      ]
    };

    const audit = auditEvidencePackProvenance(ep);
    assert.equal(audit.requires_provenance_failure, false, 'Audit should pass for exact verified passage');
  });

  // Test B: synthetic sentence absent from raw source labeled exact => FAIL (PASSAGE_NOT_IN_RETRIEVED_SOURCE)
  await test('Test B: Synthetic sentence absent from raw source labeled exact triggers PASSAGE_NOT_IN_RETRIEVED_SOURCE', async () => {
    const rawSource = 'Coatings will fail if applied before surfaces are dry enough.';
    const syntheticPassage = 'Hydrostatic pressure behind waterproof paint accelerates substrate deterioration.';

    const loc = locatePassageInSource(syntheticPassage, rawSource);
    assert.equal(loc.found, false);

    const ep = {
      evidence_pack_id: 'ep_test_b',
      topic: 'Kelembapan Dinding',
      claim_inventory: [
        {
          claim_id: 'CLM-001',
          statement: 'Hydrostatic pressure degrades substrates.',
          evidence_status: 'VERIFIED',
          sources: [
            {
              source_id: 'SRC-01',
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
              raw_content_preview: rawSource
            }
          ],
          evidence_passage_ids: ['psg_synthetic'],
          semantic_role: 'CORE_TECHNICAL_PRINCIPLE'
        }
      ],
      evidence_passages: [
        {
          passage_id: 'psg_synthetic',
          source_id: 'SRC-01',
          locator: 'Section 4',
          exact_text: syntheticPassage,
          exact_or_normalized_excerpt: syntheticPassage,
          extracted_at: new Date().toISOString(),
          supports_claim_ids: ['CLM-001'],
          semantic_role: 'CORE_TECHNICAL_PRINCIPLE',
          passage_nature: 'EXACT_LOCATED'
        }
      ]
    };

    const audit = auditEvidencePackProvenance(ep);
    assert.equal(audit.requires_provenance_failure, true, 'Must fail provenance audit');
    const hasError = audit.unverified_claims.some(c => c.includes('PASSAGE_NOT_IN_RETRIEVED_SOURCE'));
    assert.equal(hasError, true, 'Must report PASSAGE_NOT_IN_RETRIEVED_SOURCE');
  });

  // Test C: source paraphrase with correct backing passages => allowed only as SOURCE_PARAPHRASE / synthesis
  await test('Test C: Paraphrase or synthesis with passage_nature != EXACT_LOCATED does not trigger PASSAGE_NOT_IN_RETRIEVED_SOURCE', async () => {
    const rawSource = 'Coatings will fail if applied before surfaces are dry enough.';
    const paraphraseText = 'Pelapis kedap air akan gagal jika dipasang pada bidang yang basah.';

    const ep = {
      evidence_pack_id: 'ep_test_c',
      topic: 'Kelembapan Dinding',
      claim_inventory: [
        {
          claim_id: 'CLM-001',
          statement: 'Aplikasi cat kedap air butuh permukaan kering.',
          evidence_status: 'SUPPORTED',
          sources: [
            {
              source_id: 'SRC-01',
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
              raw_content_preview: rawSource
            }
          ],
          evidence_passage_ids: ['psg_para'],
          semantic_role: 'CORE_TECHNICAL_PRINCIPLE'
        }
      ],
      evidence_passages: [
        {
          passage_id: 'psg_para',
          source_id: 'SRC-01',
          locator: 'Section 2',
          exact_or_normalized_excerpt: paraphraseText,
          extracted_at: new Date().toISOString(),
          supports_claim_ids: ['CLM-001'],
          semantic_role: 'CORE_TECHNICAL_PRINCIPLE',
          passage_nature: 'SOURCE_PARAPHRASE'
        }
      ]
    };

    const audit = auditEvidencePackProvenance(ep);
    const hasNotInSource = audit.unverified_claims.some(c => c.includes('PASSAGE_NOT_IN_RETRIEVED_SOURCE'));
    assert.equal(hasNotInSource, false, 'SOURCE_PARAPHRASE must not be required to be exact substring');
  });

  // Test D: CLM-005 mapped to respiratory/allergy excerpt => CLAIM_USAGE_ENTAILMENT_MISMATCH
  await test('Test D: CLM-005 (building moisture causes) mapped to respiratory/allergy excerpt triggers CLAIM_USAGE_ENTAILMENT_MISMATCH', async () => {
    const clm005 = {
      claim_id: 'CLM-005',
      statement: 'Humidity occurs in indoor environments due to building related causes. Porous walls, rising damp, and leaks in the building are determinants for structural dampness.',
      semantic_role: 'RISK'
    };

    const usage = {
      claim_id: 'CLM-005',
      article_excerpt: 'Kelembapan dan jamur juga berkaitan dengan berbagai keluhan pernapasan dan alergi pada penghuni rumah.',
      usage_type: 'DIRECT_PARAPHRASE'
    };

    const entailment = validateClaimUsageEntailment(usage, clm005);
    assert.equal(entailment.isEntailed, false);
    assert.equal(entailment.code, 'CLAIM_USAGE_ENTAILMENT_MISMATCH');

    const envelope = {
      article_markdown: '# Uji Coba\nKelembapan dan jamur juga berkaitan dengan berbagai keluhan pernapasan dan alergi pada penghuni rumah.',
      claim_usage: [usage],
      unsupported_claim_candidates: []
    };

    const ep = {
      evidence_pack_id: 'ep_test_d',
      claim_inventory: [clm005]
    };

    const audit = validateClaimGrounding(envelope, ep);
    assert.equal(audit.isValid, false);
    assert.ok(audit.entailmentMismatchCount > 0);
    assert.ok(audit.errors.some(e => e.includes('CLAIM_USAGE_ENTAILMENT_MISMATCH')));
  });

  // Test E: correct health claim mapped to health excerpt => PASS
  await test('Test E: Correct health claim mapped to health excerpt passes entailment check', async () => {
    const healthClaim = {
      claim_id: 'CLM-022',
      statement: 'Exposure to microbial dampness and indoor mold exacerbates asthma, respiratory symptoms, and allergic reactions in occupants.',
      semantic_role: 'RISK'
    };

    const usage = {
      claim_id: 'CLM-022',
      article_excerpt: 'Kelembapan dan jamur juga berkaitan dengan berbagai keluhan pernapasan dan alergi pada penghuni rumah.',
      usage_type: 'DIRECT_PARAPHRASE'
    };

    const entailment = validateClaimUsageEntailment(usage, healthClaim);
    assert.equal(entailment.isEntailed, true);
    assert.equal(entailment.code, 'VALID');

    const envelope = {
      article_markdown: '# Uji Coba\nKelembapan dan jamur juga berkaitan dengan berbagai keluhan pernapasan dan alergi pada penghuni rumah.',
      claim_usage: [usage],
      unsupported_claim_candidates: []
    };

    const ep = {
      evidence_pack_id: 'ep_test_e',
      claim_inventory: [healthClaim]
    };

    const audit = validateClaimGrounding(envelope, ep);
    assert.equal(audit.isValid, true);
    assert.equal(audit.entailmentMismatchCount, 0);
  });

  // Test F: technical article sentence with no claim_usage => UNDECLARED_TECHNICAL_ASSERTION
  await test('Test F: Technical article proposition not declared in claim_usage triggers UNDECLARED_TECHNICAL_ASSERTION', async () => {
    const articleMarkdown = `
# Memahami Kelembapan Dinding
Mari kita bedah dulu apa yang terjadi di dinding rumah Anda.
Air dapat bergerak melalui aliran cairan, tarikan kapiler pada material berpori, atau pergerakan udara yang membawa uap.
Pertanyaannya adalah, mengapa cat bisa menggelembung?
    `;

    const usages = [
      {
        claim_id: 'CLM-001',
        article_excerpt: 'Mari kita bedah dulu apa yang terjadi di dinding rumah Anda.',
        usage_type: 'EDITORIAL_INFERENCE'
      }
    ];

    const coverage = auditTechnicalAssertionCoverage(articleMarkdown, usages);
    assert.equal(coverage.passed, false);
    assert.ok(coverage.undeclared_assertions_count > 0);
    assert.ok(coverage.errors.some(e => e.includes('UNDECLARED_TECHNICAL_ASSERTION')));
    assert.ok(coverage.undeclared_assertions.some(a => a.includes('aliran cairan')));
  });

  // Test G: UK regulation marked UNIVERSAL_PHYSICS => FAIL (JURISDICTION_MISCLASSIFIED_AS_UNIVERSAL)
  await test('Test G: UK regulation marked as UNIVERSAL_PHYSICS triggers JURISDICTION_MISCLASSIFIED_AS_UNIVERSAL', async () => {
    const ep = {
      evidence_pack_id: 'ep_test_g',
      topic: 'UK Building Laws',
      claim_inventory: [
        {
          claim_id: 'CLM-019',
          statement: 'UK Building Regulations 2010 and Homes (Fitness for Human Habitation) Act mandate landlords rectify severe damp under Awaab\'s Law.',
          applicability: 'UNIVERSAL_PHYSICS', // VIOLATION!
          evidence_status: 'VERIFIED',
          sources: [
            {
              source_id: 'SRC-UK-01',
              document_title: 'UK Building Regulations Guidance',
              applicability: 'UNIVERSAL_PHYSICS',
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED'
            }
          ]
        }
      ]
    };

    const audit = auditEvidencePackProvenance(ep);
    assert.equal(audit.requires_provenance_failure, true);
    assert.ok(audit.unverified_claims.some(c => c.includes('JURISDICTION_MISCLASSIFIED_AS_UNIVERSAL')));
  });

  // Test H: UK regulation on Indonesian generic article => blocked from author-safe set (jurisdiction_blocked)
  await test('Test H: UK regulation on Indonesian generic article is blocked from author-safe set', async () => {
    const claims = [
      {
        claim_id: 'CLM-019',
        statement: 'Homes (Fitness for Human Habitation) Act and Awaab\'s Law require statutory rectification within fixed timeframes.',
        applicability: 'JURISDICTION_SPECIFIC',
        evidence_status: 'VERIFIED',
        sources: [
          {
            source_id: 'SRC-UK-01',
            document_title: 'UK Housing Act',
            retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED'
          }
        ],
        evidence_passage_ids: ['psg_uk']
      }
    ];

    const safeClaims = generateAuthorSafeClaims(claims, { targetJurisdiction: 'INDONESIA' });
    const clm019Safe = safeClaims.find(c => c.claim_id === 'CLM-019');
    assert.ok(clm019Safe);
    assert.equal(clm019Safe.allowed_for_authoring, false);
    assert.equal(clm019Safe.jurisdiction_blocked, true);

    const metrics = calculateAuthorSafeMetrics(claims, safeClaims);
    assert.equal(metrics.jurisdiction_blocked_count, 1);
    assert.equal(metrics.allowed_for_authoring_count, 0);
  });

  // Test I: same UK regulation in explicit UK article => qualified/allowed according to policy
  await test('Test I: UK regulation in explicit UK article context is qualified and allowed', async () => {
    const claims = [
      {
        claim_id: 'CLM-019',
        statement: 'Homes (Fitness for Human Habitation) Act and Awaab\'s Law require statutory rectification within fixed timeframes.',
        applicability: 'JURISDICTION_SPECIFIC',
        evidence_status: 'VERIFIED',
        sources: [
          {
            source_id: 'SRC-UK-01',
            document_title: 'UK Housing Act',
            retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED'
          }
        ],
        evidence_passage_ids: ['psg_uk']
      }
    ];

    const safeClaims = generateAuthorSafeClaims(claims, {
      targetJurisdiction: 'UK',
      articleContext: 'Studi komparasi regulasi hunian di UK dan Indonesia'
    });

    const clm019Safe = safeClaims.find(c => c.claim_id === 'CLM-019');
    assert.ok(clm019Safe);
    assert.equal(clm019Safe.allowed_for_authoring, true);
    assert.equal(clm019Safe.applicability, 'JURISDICTION_SPECIFIC');
    assert.ok(clm019Safe.qualification_required.includes('Kualifikasi yurisdiksi'));
  });

  // Test J: prompt audit file containing "radiant barrier" dictionary => must NOT itself trigger semantic leak
  await test('Test J: Audit file containing search dictionary does NOT trigger domain leak', async () => {
    const files = {
      'runtime4b-final2-grounded-draft.md': '# Dinding Lembap\nKelembapan pada dinding berpori harus ditangani dari sumber rembesan.',
      'runtime4b-final2-prompt-leak-audit.json': JSON.stringify({
        audit: 'prompt_leak',
        passed: true,
        static_prompt_domain_terms: [
          'radiant barrier',
          'metal roof',
          'atap metal',
          'ventilasi loteng'
        ],
        detected_static_domain_leaks: []
      })
    };

    const leaks = scanActiveContentForLeaks(files);
    assert.equal(leaks.length, 0, 'Scanning active content must exclude audit dictionary file itself');
  });

  // Test K: meta/manifest/final classification disagreement => PROOF_CLASSIFICATION_INCONSISTENCY
  await test('Test K: Meta, manifest, and report classification disagreement triggers PROOF_CLASSIFICATION_INCONSISTENCY', async () => {
    const inconsistentInput = {
      meta: {
        primary_classification: 'GENERALIZATION_SEMANTIC_LEAK_DETECTED'
      },
      manifest: {
        final_machine_classification: 'EDITORIAL_RUNTIME4B_FINAL2_END_TO_END_PROVEN'
      },
      reportClassification: 'EDITORIAL_RUNTIME4B_FINAL2_END_TO_END_PROVEN'
    };

    const result = validateProofMetadataConsistency(inconsistentInput);
    assert.equal(result.passed, false);
    assert.ok(result.errors.some(e => e.includes('PROOF_CLASSIFICATION_INCONSISTENCY')));

    // Consistent input must pass
    const consistentInput = {
      meta: {
        primary_classification: 'EDITORIAL_RUNTIME4B_FINAL2_END_TO_END_PROVEN'
      },
      manifest: {
        final_machine_classification: 'EDITORIAL_RUNTIME4B_FINAL2_END_TO_END_PROVEN'
      },
      reportClassification: 'EDITORIAL_RUNTIME4B_FINAL2_END_TO_END_PROVEN',
      promptLeakAudit: {
        passed: true,
        detected_static_domain_leaks: []
      }
    };

    const consistentResult = validateProofMetadataConsistency(consistentInput);
    assert.equal(consistentResult.passed, true);
    assert.equal(consistentResult.errors.length, 0);
  });

  console.log(`\n🎉 All ${passed}/11 focused hardening tests passed successfully!`);
}

main().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
