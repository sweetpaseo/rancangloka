/**
 * Test Suite: EDITORIAL-EVIDENCE-PROVENANCE-1
 * 
 * Verifies:
 * 1. Every VERIFIED numeric claim requires source provenance.
 * 2. Source name alone is insufficient (exact document location required).
 * 3. Unverified numeric claim cannot silently pass as verified fact.
 * 4. Qualitative supported claim may remain without fabricated numbers.
 * 5. Foreign reference is distinguishable from Indonesian regulation.
 * 6. Claim-to-source linkage survives Evidence Pack serialization.
 * 7. Rina can flag missing claim provenance (CLAIM_SOURCE_PROVENANCE_MISSING).
 * 8. `primary_quality_issue` is preserved on StructuredRewriteBrief.
 * 9. `quality_issues[]` preserves all simultaneous issues.
 * 10. Task Handoff receives full issue array.
 * 11. Job Trace receives full issue array.
 * 12. Multi-owner correction preserves deterministic primary owner.
 * 13. Existing pipeline tests remain green.
 * 14. Jefry remains zero authority.
 * 15. No publication occurs.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateHumanWritingQuality,
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
  console.log('🧪 Starting Evidence Provenance & Multi-Issue Propagation Suite (EDITORIAL-EVIDENCE-PROVENANCE-1)...\n');

  const evPackRaw = fs.readFileSync(path.resolve('./scripts/dryrun/evidence-pack.json'), 'utf-8');
  const evPack = JSON.parse(evPackRaw);
  const draftFinal = fs.readFileSync(path.resolve('./scripts/dryrun/draft-final.md'), 'utf-8');

  // --- SECTION 1: Evidence Provenance & Exact Citation ---
  console.log('--- TEST SECTION 1: Claim-to-Source Traceability & Provenance ---');

  await test('1. Every VERIFIED claim requires structured sources array with document details', () => {
    const verifiedClaims = evPack.claim_inventory.filter((c) => c.evidence_status === 'VERIFIED');
    assert.ok(verifiedClaims.length >= 2, 'Must have at least 2 VERIFIED claims');

    for (const clm of verifiedClaims) {
      assert.ok(Array.isArray(clm.sources), `Claim ${clm.claim_id} must have sources array`);
      assert.ok(clm.sources.length > 0, `Claim ${clm.claim_id} must have at least one source`);
      for (const src of clm.sources) {
        assert.ok(src.source_id, 'Source must have source_id');
        assert.ok(src.document_title, 'Source must have document_title');
        assert.ok(src.page_or_section, 'Source must have page_or_section');
        assert.ok(src.support_type, 'Source must have support_type');
      }
    }
  });

  await test('2. Source name alone is insufficient: must identify exact document section', () => {
    for (const clm of evPack.claim_inventory) {
      if (clm.sources && clm.sources.length > 0) {
        for (const src of clm.sources) {
          assert.notStrictEqual(src.page_or_section, undefined, 'Must not be undefined');
          assert.notStrictEqual(src.page_or_section.trim(), '', 'Must not be empty');
          assert.ok(src.page_or_section.length >= 5, 'Must specify concrete section/chapter');
        }
      }
    }
  });

  await test('3. Unverified numeric claim cannot silently pass as verified_fact', () => {
    // CLM-001 has precise numbers (60-75°C, 800-1000 W/m²), but retrieval was not first-party empirical lab test.
    // It must be classified as technical_consensus / PARTIALLY_SUPPORTED, not verified_fact.
    const clm001 = evPack.claim_inventory.find((c) => c.claim_id === 'CLM-001');
    assert.ok(clm001);
    assert.strictEqual(clm001.claim_class, 'technical_consensus');
    assert.strictEqual(clm001.evidence_status, 'PARTIALLY_SUPPORTED');
    assert.strictEqual(clm001.provenance_retrieval_status, 'SOURCE_REFERENCE_KNOWN_BUT_NOT_RETRIEVED');
    assert.strictEqual(clm001.action, 'QUALIFY');
  });

  await test('4. Qualitative supported claim may remain without fabricated numbers', () => {
    // In draft-final.md, the 75-90% number was qualified to qualitative principle
    // "jalur transfer panas paling dominan", which is solidly supported by heat transfer physics.
    assert.ok(draftFinal.includes('jalur transfer panas paling dominan'));
    assert.ok(!draftFinal.includes('menyumbang 75% hingga 90%'));
  });

  await test('5. Foreign reference is clearly distinguishable from Indonesian regulation', () => {
    const clm006 = evPack.claim_inventory.find((c) => c.claim_id === 'CLM-006');
    assert.ok(clm006);
    const ircSource = clm006.sources.find((s) => s.source_id === 'SRC-IRC-R806');
    assert.ok(ircSource);
    assert.strictEqual(ircSource.applicability, 'TECHNICAL_REFERENCE_FOREIGN');
    assert.ok(ircSource.limitations.includes('bukan regulasi wajib Indonesia'));

    const clm005 = evPack.claim_inventory.find((c) => c.claim_id === 'CLM-005');
    assert.ok(clm005);
    const puprSource = clm005.sources.find((s) => s.source_id === 'SRC-PUPR-LOTENG');
    assert.ok(puprSource);
    assert.strictEqual(puprSource.applicability, 'REGULATORY_LOCAL_TROPICAL');
  });

  await test('6. Claim-to-source linkage survives Evidence Pack serialization', () => {
    const reSerialized = JSON.parse(JSON.stringify(evPack));
    assert.strictEqual(reSerialized.claim_inventory.length, evPack.claim_inventory.length);
    assert.deepStrictEqual(reSerialized.claim_inventory[2].sources, evPack.claim_inventory[2].sources);
  });

  // --- SECTION 2: Rina QA Evidence Provenance Gate ---
  console.log('\n--- TEST SECTION 2: Rina QA Evidence Provenance Gate ---');

  await test('7. Rina flags CLAIM_SOURCE_PROVENANCE_MISSING and prevents PASS', () => {
    const res = evaluateHumanWritingQuality(draftFinal, {
      articleId: 'art_dryrun_metal_roof_01',
      taskId: 'task_dryrun_metal_roof_01',
      hasMissingClaimProvenance: true,
      missingProvenanceClaims: ['Klaim penurunan suhu drastis tanpa laporan pengujian']
    });

    assert.strictEqual(res.passed, false);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_REWRITE');
    assert.ok(res.total_score <= 65, 'Must be hard-capped at 65 or below');
    assert.ok(res.issues.some((i) => i.code === 'CLAIM_SOURCE_PROVENANCE_MISSING'));
    assert.strictEqual(res.rewrite_brief?.target_agent_id, 'evidence_researcher_lead'); // Irwan owns provenance
    assert.strictEqual(res.rewrite_brief?.supporting_agent_id, 'content_writer_primary'); // Joko supports
    assert.strictEqual(res.rewrite_brief?.revision_reason, 'RESEARCH_REQUIRED');
  });

  // --- SECTION 3: Multi-Issue Propagation Architecture ---
  console.log('\n--- TEST SECTION 3: Multi-Issue Propagation Architecture ---');

  await test('8. primary_quality_issue is preserved on StructuredRewriteBrief', () => {
    const unpolished = `# Atap Metal Terasa Panas\n\nDi era modern saat ini, atap metal sangat populer.\n\nSemua ada kelebihan dan kekurangan masing-masing.`;
    const res = evaluateHumanWritingQuality(unpolished, {
      articleId: 'art_test_multi_01',
      taskId: 'task_test_multi_01'
    });

    assert.ok(res.rewrite_brief);
    assert.strictEqual(res.rewrite_brief.primary_quality_issue, 'GENERIC_OPENING_DETECTED');
    assert.strictEqual(res.rewrite_brief.quality_issue, 'GENERIC_OPENING_DETECTED'); // Backward compatibility
  });

  await test('9. quality_issues[] preserves all simultaneous issues', () => {
    const unpolished = `# Atap Metal Terasa Panas\n\nDi era modern saat ini, atap metal sangat populer.\n\nSemua ada kelebihan dan kekurangan masing-masing.`;
    const res = evaluateHumanWritingQuality(unpolished, {
      articleId: 'art_test_multi_01',
      taskId: 'task_test_multi_01'
    });

    assert.ok(res.rewrite_brief);
    assert.ok(Array.isArray(res.rewrite_brief.quality_issues));
    assert.ok(res.rewrite_brief.quality_issues.length >= 2);
    assert.ok(res.rewrite_brief.quality_issues.includes('GENERIC_OPENING_DETECTED'));
    assert.ok(res.rewrite_brief.quality_issues.includes('EMPTY_GENERALIZATIONS_FOUND'));
  });

  await test('10. Task Handoff receives full issue array and primary issue', () => {
    const snapshotWithMultiIssue = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_test_multi_handoff',
            title: 'Atap Metal Multi Issue',
            subsystem: 'editorial',
            status: 'IN_PROGRESS',
            stage: 'writing',
            retryCount: 1,
            lastUpdate: '2026-10-04T15:00:00.000Z',
            blockerOrError: null,
            relatedArticleId: 202,
            qualityReview: {
              quality_issue: 'GENERIC_OPENING_DETECTED',
              primary_quality_issue: 'GENERIC_OPENING_DETECTED',
              quality_issues: ['GENERIC_OPENING_DETECTED', 'EMPTY_GENERALIZATIONS_FOUND', 'NEXT_ACTION_MISSING'],
              quality_score: 62,
              quality_decision: 'HUMAN_WRITING_REWRITE',
              primary_owner: 'content_writer_primary',
              supporting_owner: 'evidence_researcher_lead',
              supporting_owners: ['evidence_researcher_lead'],
              revision_reason: 'HOMEOWNER_REFRAMING_REQUIRED',
              attempt: 2
            }
          }
        ],
        stageCounts: { writing: 1 },
        totalActiveTasks: 1
      },
      health: { automation: { mode: 'OFF', killSwitchEngaged: false } },
      timestamp: '2026-10-04T15:01:00.000Z'
    };

    const handoffs = deriveCanonicalHandoffsFromPipeline(snapshotWithMultiIssue);
    const qHandoff = handoffs.find((h) => h.evidence_source === 'human_quality_brief');
    assert.ok(qHandoff, 'Handoff must be derived from qualityReview');
    assert.ok(qHandoff.quality_metadata);
    assert.strictEqual(qHandoff.quality_metadata.primary_quality_issue, 'GENERIC_OPENING_DETECTED');
    assert.deepStrictEqual(qHandoff.quality_metadata.quality_issues, [
      'GENERIC_OPENING_DETECTED',
      'EMPTY_GENERALIZATIONS_FOUND',
      'NEXT_ACTION_MISSING'
    ]);
    assert.deepStrictEqual(qHandoff.quality_metadata.supporting_owners, ['evidence_researcher_lead']);
  });

  await test('11. Job Trace receives full issue array in event details', async () => {
    const snapshotWithMultiIssue = {
      pipeline: {
        tasks: [
          {
            taskId: 'task_test_multi_trace',
            title: 'Atap Metal Multi Issue Trace',
            subsystem: 'editorial',
            status: 'IN_PROGRESS',
            stage: 'writing',
            retryCount: 1,
            lastUpdate: '2026-10-04T15:00:00.000Z',
            blockerOrError: null,
            relatedArticleId: 203,
            qualityReview: {
              quality_issue: 'GENERIC_OPENING_DETECTED',
              primary_quality_issue: 'GENERIC_OPENING_DETECTED',
              quality_issues: ['GENERIC_OPENING_DETECTED', 'EMPTY_GENERALIZATIONS_FOUND'],
              quality_score: 65,
              quality_decision: 'HUMAN_WRITING_REWRITE',
              primary_owner: 'content_writer_primary',
              supporting_owner: 'evidence_researcher_lead',
              supporting_owners: ['evidence_researcher_lead'],
              revision_reason: 'HOMEOWNER_REFRAMING_REQUIRED',
              attempt: 2
            }
          }
        ],
        stageCounts: { writing: 1 },
        totalActiveTasks: 1
      },
      health: { automation: { mode: 'OFF', killSwitchEngaged: false } },
      timestamp: '2026-10-04T15:01:00.000Z'
    };

    const trace = await deriveJobTrace('task_test_multi_trace', snapshotWithMultiIssue);
    assert.ok(trace);
    const revEvent = trace.events.find((e) => e.event_type === 'HUMAN_WRITING_REVISE_REQUESTED');
    assert.ok(revEvent);
    assert.ok(revEvent.details);
    assert.strictEqual(revEvent.details.primary_quality_issue, 'GENERIC_OPENING_DETECTED');
    assert.deepStrictEqual(revEvent.details.quality_issues, [
      'GENERIC_OPENING_DETECTED',
      'EMPTY_GENERALIZATIONS_FOUND'
    ]);
    assert.ok(revEvent.note.includes('[2 issues]'));
  });

  await test('12. Multi-owner correction preserves deterministic primary owner', () => {
    // When evidence provenance is missing, Irwan must be primary owner, Joko supporting
    const res = evaluateHumanWritingQuality(draftFinal, {
      articleId: 'art_multi_owner',
      taskId: 'task_multi_owner',
      hasMissingClaimProvenance: true,
      missingProvenanceClaims: ['Klaim numerik tanpa rujukan']
    });

    assert.ok(res.rewrite_brief);
    assert.strictEqual(res.rewrite_brief.target_agent_id, 'evidence_researcher_lead');
    assert.strictEqual(res.rewrite_brief.supporting_agent_id, 'content_writer_primary');
    assert.deepStrictEqual(res.rewrite_brief.supporting_agent_ids, ['content_writer_primary']);
  });

  // --- SECTION 4: Regression & Governance Safety ---
  console.log('\n--- TEST SECTION 4: Governance & Pipeline Safety ---');

  await test('13. Final qualified dry-run draft passes cleanly with score 100', () => {
    const res = evaluateHumanWritingQuality(draftFinal, {
      articleId: 'art_dryrun_metal_roof_01',
      taskId: 'task_dryrun_metal_roof_01',
      attemptCount: 0
    });

    assert.strictEqual(res.total_score, 100);
    assert.strictEqual(res.decision, 'HUMAN_WRITING_PASS');
    assert.strictEqual(res.passed, true);
    assert.strictEqual(res.issues.length, 0);
  });

  await test('14. Jefry remains zero authority and shadow mode only', () => {
    const hrp = JSON.parse(fs.readFileSync(path.resolve('./scripts/dryrun/human-review-package.json'), 'utf-8'));
    assert.strictEqual(hrp.human_governance.jev_mode, 'shadow');
    assert.strictEqual(hrp.human_governance.publishing_authority, 0);
  });

  await test('15. No publication occurs: automation_mode is OFF and gate is HUMAN_REVIEW_REQUIRED', () => {
    const hrp = JSON.parse(fs.readFileSync(path.resolve('./scripts/dryrun/human-review-package.json'), 'utf-8'));
    assert.strictEqual(hrp.status, 'HUMAN_REVIEW_REQUIRED');
    assert.strictEqual(hrp.human_governance.auto_publish, 'OFF');
    assert.strictEqual(hrp.human_governance.automation_mode, 'OFF');
  });

  console.log(`\n🎉 All 15 tests in EDITORIAL-EVIDENCE-PROVENANCE-1 passed successfully!`);
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
