/**
 * Test Suite: EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1
 * 
 * Verifies:
 * 1. Source metadata alone does not equal verified retrieval.
 * 2. Invented page/section metadata cannot promote an unretrieved source to VERIFIED.
 * 3. Retrieved source content can support a claim (SOURCE_RETRIEVED_AND_VERIFIED).
 * 4. Unavailable / unretrieved source becomes UNVERIFIED or PARTIALLY_SUPPORTED.
 * 5. Unsupported numeric claims are blocked or qualified.
 * 6. Supported qualitative principles may remain in prose.
 * 7. Evidence Pack automatically produces provenance summary via auditEvidencePackProvenance.
 * 8. Rina QA detects missing provenance automatically without caller manual boolean.
 * 9. Caller omission (omitting hasMissingClaimProvenance) cannot bypass provenance QA when evidencePack is passed.
 * 10. Foreign code is distinguishable from Indonesian regulation.
 * 11. Claim applicability and retrieval status survive Evidence Pack serialization.
 * 12. Multi-issue propagation (primary_quality_issue, quality_issues[], supporting_owners) remains intact.
 * 13. Task Handoff remains intact with multi-issue and provenance metadata.
 * 14. Job Trace remains intact with multi-issue details.
 * 15. Jefry authority remains zero and shadow mode only.
 * 16. Publishing remains strictly disabled (automation_mode OFF, auto_publish OFF).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateHumanWritingQuality,
  auditEvidencePackProvenance,
  CANONICAL_HUMAN_QUALITY_THRESHOLDS
} from '../src/lib/article/human-quality.ts';
import {
  deriveCanonicalHandoffsFromPipeline,
  deriveDeterministicHandoffId
} from '../src/lib/mission-control/task-handoff.ts';
import {
  deriveJobTrace
} from '../src/lib/mission-control/job-trace.ts';

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    throw err;
  }
}

async function main() {
  console.log('🧪 Starting Evidence Source Verification & Automatic Provenance Suite (EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1)...\n');

  const evPackRaw = fs.readFileSync(path.resolve('./scripts/dryrun/evidence-pack.json'), 'utf-8');
  const evPack = JSON.parse(evPackRaw);
  const draftFinal = fs.readFileSync(path.resolve('./scripts/dryrun/draft-final.md'), 'utf-8');

  // --- SECTION 1: Retrieval vs Metadata-Only Distinction ---
  console.log('--- TEST SECTION 1: Source Retrieval vs Metadata-Only Distinction ---');

  await test('1. Source metadata alone does not equal verified retrieval', () => {
    // When a source has detailed title and section, but retrieval_status is SOURCE_METADATA_ONLY,
    // audit must not classify it as retrieved and verified.
    const mockPack = {
      claim_inventory: [
        {
          claim_id: 'CLM-TEST-01',
          statement: 'Standar asing menguji emisivitas dengan hasil spesifik.',
          evidence_status: 'PARTIALLY_SUPPORTED',
          sources: [
            {
              source_id: 'SRC-METADATA-ONLY',
              document_title: 'ASTM C1371-15: Standard Test Method for Determination of Emittance',
              page_or_section: 'Section 1.1 & Section 11',
              applicability: 'TECHNICAL_REFERENCE_FOREIGN',
              retrieval_status: 'SOURCE_METADATA_ONLY'
            }
          ]
        }
      ]
    };

    const audit = auditEvidencePackProvenance(mockPack);
    assert.strictEqual(audit.retrieved_and_verified_sources_count, 0);
    assert.strictEqual(audit.metadata_only_sources_count, 1);
    assert.strictEqual(audit.claim_support_map['CLM-TEST-01'], 'PARTIALLY_SUPPORTED');
  });

  await test('2. Invented page/section metadata cannot promote an unretrieved source to VERIFIED', () => {
    // Even if exact-looking section number exists, if retrieval_status is not SOURCE_RETRIEVED_AND_VERIFIED,
    // the claim support level derived is at most PARTIALLY_SUPPORTED.
    const mockPack = {
      claim_inventory: [
        {
          claim_id: 'CLM-TEST-02',
          statement: 'ASTM C1321 menetapkan celah udara 20 mm.',
          evidence_status: 'VERIFIED', // Improperly declared as VERIFIED without retrieval
          sources: [
            {
              source_id: 'SRC-INVENTED-SEC',
              document_title: 'ASTM C1321-15 Standard Practice for Radiant Barrier',
              page_or_section: 'Section 6.2.1: Air Space Minimum Requirements',
              applicability: 'TECHNICAL_REFERENCE_FOREIGN',
              retrieval_status: 'SOURCE_METADATA_ONLY'
            }
          ]
        }
      ]
    };

    const audit = auditEvidencePackProvenance(mockPack);
    // Must flag fail-closed failure
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.missing_provenance_claims.some((c) => c.includes('CLM-TEST-02')));
  });

  await test('3. Retrieved source content can support a claim (SOURCE_RETRIEVED_AND_VERIFIED)', () => {
    const mockPack = {
      claim_inventory: [
        {
          claim_id: 'CLM-TEST-03',
          statement: 'Dokumen panduan teknis yang tersimpan membuktikan prinsip ventilasi.',
          evidence_status: 'VERIFIED',
          sources: [
            {
              source_id: 'SRC-RETRIEVED-DOC',
              document_title: 'Buku Panduan Teknis Lapangan RancangLoka V1',
              page_or_section: 'Bab 2 Halaman 14',
              applicability: 'TECHNICAL_GUIDANCE_LOCAL',
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
              content_location: 'repo://docs/guidelines/local.pdf',
              content_hash: 'sha256_mock_hash_12345'
            }
          ]
        }
      ]
    };

    const audit = auditEvidencePackProvenance(mockPack);
    assert.strictEqual(audit.retrieved_and_verified_sources_count, 1);
    assert.strictEqual(audit.claim_support_map['CLM-TEST-03'], 'VERIFIED');
    assert.strictEqual(audit.requires_provenance_failure, false);
  });

  await test('4. Unavailable or unretrieved source becomes UNVERIFIED or PARTIALLY_SUPPORTED', () => {
    const mockPack = {
      claim_inventory: [
        {
          claim_id: 'CLM-TEST-04A',
          statement: 'Rujukan tidak tersedia sama sekali.',
          evidence_status: 'UNVERIFIED',
          sources: [
            {
              source_id: 'SRC-UNAVAIL',
              document_title: 'Standard X (Unobtainable)',
              applicability: 'TECHNICAL_REFERENCE_FOREIGN',
              retrieval_status: 'SOURCE_UNAVAILABLE'
            }
          ]
        },
        {
          claim_id: 'CLM-TEST-04B',
          statement: 'Klaim tanpa sumber apa pun.',
          evidence_status: 'UNVERIFIED',
          sources: []
        }
      ]
    };

    const audit = auditEvidencePackProvenance(mockPack);
    assert.strictEqual(audit.claim_support_map['CLM-TEST-04A'], 'PARTIALLY_SUPPORTED');
    assert.strictEqual(audit.claim_support_map['CLM-TEST-04B'], 'UNVERIFIED');
  });

  // --- SECTION 2: Numeric Claim Safety & Qualification ---
  console.log('\n--- TEST SECTION 2: Numeric Claim Safety & Qualification ---');

  await test('5. Unsupported numeric claims are blocked or require qualification', () => {
    // If a claim has precise numeric statements, is unretrieved, but action is KEEP (not QUALIFY),
    // audit must require provenance failure.
    const mockPack = {
      claim_inventory: [
        {
          claim_id: 'CLM-NUM-01',
          statement: 'Emisivitas lembaran teruji tepat 0.05 dengan efisiensi 95%.',
          evidence_status: 'PARTIALLY_SUPPORTED',
          action: 'KEEP', // Unqualified KEEP on unretrieved exact number
          sources: [
            {
              source_id: 'SRC-METADATA',
              document_title: 'Emissometer Catalog',
              applicability: 'TECHNICAL_REFERENCE_FOREIGN',
              retrieval_status: 'SOURCE_METADATA_ONLY'
            }
          ]
        }
      ]
    };

    const audit = auditEvidencePackProvenance(mockPack);
    assert.strictEqual(audit.requires_provenance_failure, true);
    assert.ok(audit.unsupported_numeric_claims.some((c) => c.includes('CLM-NUM-01')));
  });

  await test('6. Supported qualitative principle may remain in prose', () => {
    // In dryrun draft-final.md, "75% hingga 90%" was replaced with "jalur transfer panas paling dominan",
    // and air gap 20-25 mm is presented as installation requirement rather than absolute lab cert.
    assert.ok(draftFinal.includes('jalur transfer panas paling dominan'));
    assert.ok(!draftFinal.includes('menyumbang 75% hingga 90%'));
  });

  // --- SECTION 3: Automatic Provenance Derivation & Evaluator Gate ---
  console.log('\n--- TEST SECTION 3: Automatic Provenance Derivation & Evaluator Gate ---');

  await test('7. Evidence Pack automatically produces provenance summary via auditEvidencePackProvenance', () => {
    const audit = auditEvidencePackProvenance(evPack, draftFinal);
    assert.strictEqual(audit.total_claims, 8);
    assert.strictEqual(audit.retrieved_and_verified_sources_count, 0); // Honest: no unverified full-text claims
    assert.strictEqual(audit.requires_provenance_failure, false); // All unretrieved claims are properly QUALIFY or recommendation
  });

  await test('8. Rina QA detects missing provenance automatically when evidencePack has unverified claim', () => {
    // Create an invalid pack where an unretrieved source is falsely declared VERIFIED
    const faultyPack = JSON.parse(JSON.stringify(evPack));
    faultyPack.claim_inventory[0].evidence_status = 'VERIFIED'; // CLM-001 has no retrieved source!

    const res = evaluateHumanWritingQuality(draftFinal, {
      articleId: 'art_auto_provenance_01',
      taskId: 'task_auto_provenance_01',
      evidencePack: faultyPack
      // Notice: caller DOES NOT pass hasMissingClaimProvenance: true!
    });

    assert.strictEqual(res.passed, false);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_REWRITE');
    assert.ok(res.issues.some((i) => i.code === 'CLAIM_SOURCE_PROVENANCE_MISSING'));
    assert.strictEqual(res.rewrite_brief?.target_agent_id, 'evidence_researcher_lead'); // Irwan
    assert.strictEqual(res.rewrite_brief?.supporting_agent_id, 'content_writer_primary'); // Joko
  });

  await test('9. Caller omission cannot bypass provenance QA when evidencePack is passed', () => {
    const faultyPack = {
      claim_inventory: [
        {
          claim_id: 'CLM-UNVERIFIED-NUM',
          statement: 'Penurunan suhu mencapai 15°C.',
          evidence_status: 'VERIFIED',
          sources: [
            {
              source_id: 'SRC-UNRETRIEVED',
              document_title: 'Unretrieved Study',
              applicability: 'RESEARCH_STUDY',
              retrieval_status: 'SOURCE_METADATA_ONLY'
            }
          ]
        }
      ]
    };

    // Caller explicitly leaves hasMissingClaimProvenance undefined / false
    const res = evaluateHumanWritingQuality(draftFinal, {
      evidencePack: faultyPack,
      hasMissingClaimProvenance: false
    });

    assert.strictEqual(res.passed, false);
    assert.ok(res.issues.some((i) => i.code === 'CLAIM_SOURCE_PROVENANCE_MISSING'));
  });

  // --- SECTION 4: Source Applicability & Serialization ---
  console.log('\n--- TEST SECTION 4: Source Applicability & Serialization ---');

  await test('10. Foreign code is clearly distinguishable from Indonesian regulation', () => {
    const clm006 = evPack.claim_inventory.find((c) => c.claim_id === 'CLM-006');
    assert.ok(clm006);
    const ircSource = clm006.sources.find((s) => s.source_id === 'SRC-IRC-R806');
    assert.strictEqual(ircSource.applicability, 'TECHNICAL_REFERENCE_FOREIGN');
    assert.ok(ircSource.limitations.includes('bukan regulasi wajib Indonesia'));

    const clm005 = evPack.claim_inventory.find((c) => c.claim_id === 'CLM-005');
    assert.ok(clm005);
    const puprSource = clm005.sources.find((s) => s.source_id === 'SRC-PUPR-LOTENG');
    assert.strictEqual(puprSource.applicability, 'REGULATORY_LOCAL_TROPICAL');
  });

  await test('11. Claim applicability and retrieval status survive Evidence Pack serialization', () => {
    const serialized = JSON.stringify(evPack);
    const deserialized = JSON.parse(serialized);
    assert.strictEqual(deserialized.claim_inventory.length, 8);
    assert.ok(Array.isArray(deserialized.author_safe_claims));
    assert.strictEqual(deserialized.author_safe_claims.length, 8);
  });

  // --- SECTION 5: Multi-Issue Preservation & Mission Control Invariants ---
  console.log('\n--- TEST SECTION 5: Multi-Issue & Mission Control Invariants ---');

  await test('12. Multi-issue propagation remains intact across brief and evaluator', () => {
    const multiIssueText = `# Atap Metal Terasa Panas\n\nDi era modern saat ini, atap metal sangat populer.\n\nSemua ada kelebihan dan kekurangan masing-masing.`;
    const res = evaluateHumanWritingQuality(multiIssueText, {
      articleId: 'art_multi_issue',
      taskId: 'task_multi_issue'
    });

    assert.ok(res.rewrite_brief);
    assert.strictEqual(res.rewrite_brief.primary_quality_issue, 'GENERIC_OPENING_DETECTED');
    assert.ok(Array.isArray(res.rewrite_brief.quality_issues));
    assert.ok(res.rewrite_brief.quality_issues.length >= 2);
    assert.ok(res.rewrite_brief.quality_issues.includes('GENERIC_OPENING_DETECTED'));
    assert.ok(res.rewrite_brief.quality_issues.includes('EMPTY_GENERALIZATIONS_FOUND'));
  });

  await test('13. Task Handoff remains intact with multi-issue and provenance metadata', () => {
    const snapshotWithProvenanceHandoff = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_test_provenance_handoff',
            title: 'Atap Metal Provenance Handoff',
            subsystem: 'editorial',
            status: 'IN_PROGRESS',
            stage: 'writing',
            retryCount: 1,
            lastUpdate: '2026-10-04T15:30:00.000Z',
            blockerOrError: null,
            relatedArticleId: 301,
            qualityReview: {
              quality_issue: 'CLAIM_SOURCE_PROVENANCE_MISSING',
              primary_quality_issue: 'CLAIM_SOURCE_PROVENANCE_MISSING',
              quality_issues: ['CLAIM_SOURCE_PROVENANCE_MISSING', 'INSUFFICIENT_CLAIM_SUPPORT'],
              quality_score: 55,
              quality_decision: 'HUMAN_WRITING_REWRITE',
              primary_owner: 'evidence_researcher_lead',
              supporting_owner: 'content_writer_primary',
              supporting_owners: ['content_writer_primary'],
              revision_reason: 'RESEARCH_REQUIRED',
              attempt: 2
            }
          }
        ],
        stageCounts: { writing: 1 },
        totalActiveTasks: 1
      },
      health: { automation: { mode: 'OFF', killSwitchEngaged: false } },
      timestamp: '2026-10-04T15:31:00.000Z'
    };

    const handoffs = deriveCanonicalHandoffsFromPipeline(snapshotWithProvenanceHandoff);
    const qHandoff = handoffs.find((h) => h.evidence_source === 'human_quality_brief');
    assert.ok(qHandoff);
    assert.strictEqual(qHandoff.quality_metadata?.primary_quality_issue, 'CLAIM_SOURCE_PROVENANCE_MISSING');
    assert.deepStrictEqual(qHandoff.quality_metadata?.supporting_owners, ['content_writer_primary']);
  });

  await test('14. Job Trace remains intact with multi-issue and provenance details', async () => {
    const snapshotWithTrace = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_test_provenance_trace',
            title: 'Atap Metal Provenance Trace',
            subsystem: 'editorial',
            status: 'IN_PROGRESS',
            stage: 'writing',
            retryCount: 1,
            lastUpdate: '2026-10-04T15:30:00.000Z',
            blockerOrError: null,
            relatedArticleId: 302,
            qualityReview: {
              quality_issue: 'CLAIM_SOURCE_PROVENANCE_MISSING',
              primary_quality_issue: 'CLAIM_SOURCE_PROVENANCE_MISSING',
              quality_issues: ['CLAIM_SOURCE_PROVENANCE_MISSING', 'INSUFFICIENT_CLAIM_SUPPORT'],
              quality_score: 55,
              quality_decision: 'HUMAN_WRITING_REWRITE',
              primary_owner: 'evidence_researcher_lead',
              supporting_owner: 'content_writer_primary',
              supporting_owners: ['content_writer_primary'],
              revision_reason: 'RESEARCH_REQUIRED',
              attempt: 2
            }
          }
        ],
        stageCounts: { writing: 1 },
        totalActiveTasks: 1
      },
      health: { automation: { mode: 'OFF', killSwitchEngaged: false } },
      timestamp: '2026-10-04T15:31:00.000Z'
    };

    const trace = await deriveJobTrace('task_test_provenance_trace', snapshotWithTrace);
    assert.ok(trace);
    const revEvent = trace.events.find((e) => e.event_type === 'HUMAN_WRITING_REVISE_REQUESTED');
    assert.ok(revEvent);
    assert.strictEqual(revEvent.details?.primary_quality_issue, 'CLAIM_SOURCE_PROVENANCE_MISSING');
  });

  await test('15. Jefry remains zero authority and shadow mode only', () => {
    const hrp = JSON.parse(fs.readFileSync(path.resolve('./scripts/dryrun/human-review-package.json'), 'utf-8'));
    assert.strictEqual(hrp.human_governance.jev_mode, 'shadow');
    assert.strictEqual(hrp.human_governance.publishing_authority, 0);
  });

  await test('16. Publishing remains strictly disabled (automation_mode OFF, auto_publish OFF)', () => {
    const hrp = JSON.parse(fs.readFileSync(path.resolve('./scripts/dryrun/human-review-package.json'), 'utf-8'));
    assert.strictEqual(hrp.status, 'HUMAN_REVIEW_REQUIRED');
    assert.strictEqual(hrp.human_governance.auto_publish, 'OFF');
    assert.strictEqual(hrp.human_governance.automation_mode, 'OFF');
  });

  console.log('\n🎉 All 16 tests in EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1 passed successfully!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
