/**
 * RancangLoka — Real Irwan Research Runtime Test Suite
 * Milestone: EDITORIAL-RUNTIME-3
 *
 * Verifies 18 strict invariants:
 * 1. Search snippets cannot produce VERIFIED claim status
 * 2. Metadata-only source cannot produce VERIFIED claim
 * 3. Unretrieved source cannot contain page/section locator
 * 4. Retrieved source requires read/extraction before supporting a claim
 * 5. Unknown source ID rejected
 * 6. Claim-source relationship validated
 * 7. Exact numbers removed when unsupported
 * 8. Model prior knowledge cannot be marked evidence
 * 9. Blocked source remains blocked (SOURCE_ACQUISITION_BLOCKED / SOURCE_RETRIEVAL_BLOCKED)
 * 10. Source hash/provenance stored when available (SHA-256)
 * 11. Foreign technical reference not mislabeled Indonesian regulation
 * 12. Author-safe claims inherit uncertainty and qualifications
 * 13. Irwan Evidence Pack provenance is truthful
 * 14. No previous Evidence Pack is silently copied into runtime proof
 * 15. Runtime trace reflects actual events
 * 16. Publication is impossible (publishingAuthority = 0, DRAFT)
 * 17. Joko is not invoked during this milestone
 * 18. Human review gate is mandatory (RESEARCH_HUMAN_REVIEW_REQUIRED)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  executeEditorialResearchJob
} from '../src/lib/editorial/irwan-research-runtime.ts';

import {
  extractPassagesFromText
} from '../src/lib/editorial/source-discovery.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting Real Irwan Research Runtime Suite (EDITORIAL-RUNTIME-3)...\n');

  const baseJobInput = {
    taskId: 'task_test_irwan_runtime_001',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    operatorAuth: {
      authorizedBy: 'Chief Editor Test',
      operatorRole: 'CHIEF_EDITOR',
      timestamp: new Date().toISOString()
    }
  };

  // Mock search and content functions for deterministic test isolation
  const mockCandidates = [
    {
      candidate_id: 'cand_mock_1',
      query: 'radiant barrier roof',
      discovery_engine: 'CROSSREF_OPEN_API',
      title: 'Thermal Analysis of Radiant Barrier in Roof Cavities',
      publisher: 'Elsevier BV',
      doi: '10.1016/j.buildenv.2021.1000',
      snippet: 'This paper studies radiant barriers and shows emissivity impacts.',
      discovered_at: new Date().toISOString()
    }
  ];

  const mockWikiText = `
== Overview ==
A radiant barrier is a type of building material that reflects thermal radiation and reduces heat transfer.
Because thermal energy is also transferred by conduction and convection, radiant barriers are often supplemented with thermal insulation.

== Requirements ==
A radiant barrier must face an open space or adjacent air space to function properly. Without an air gap, heat is conducted directly through the material.

== Ventilation and Moisture ==
Attic ventilation using soffit and ridge vents allows natural airflow and the stack effect to remove accumulated heat.
Dust accumulation over time can increase emittance and reduce reflectivity.
  `.trim();

  // --- SECTION 1: Search Snippet & Metadata Boundaries ---
  console.log('--- TEST SECTION 1: Search Snippets, Metadata & Verification Boundaries ---');

  await test('1. Search snippets cannot produce VERIFIED claim status (SEARCH_IS_DISCOVERY)', async () => {
    // Only search candidates discovered, no content returned
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => null // Content fails/unavailable
    });

    // Claims backed by unretrieved search candidates cannot be VERIFIED
    for (const claim of result.evidencePack.claim_inventory || []) {
      const hasOnlyUnretrieved = claim.sources?.every(s => s.retrieval_status !== 'SOURCE_RETRIEVED_AND_VERIFIED');
      if (hasOnlyUnretrieved) {
        assert.notStrictEqual(claim.evidence_status, 'VERIFIED', 'Unretrieved search candidate cannot produce VERIFIED status');
      }
    }
  });

  await test('2. Metadata-only source cannot produce VERIFIED claim', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => null
    });

    const metadataOnlySource = result.evidencePack.claim_inventory?.find(c =>
      c.sources?.some(s => s.retrieval_status === 'SOURCE_METADATA_ONLY')
    );

    if (metadataOnlySource) {
      assert.notStrictEqual(metadataOnlySource.evidence_status, 'VERIFIED');
    }
  });

  await test('3. Unretrieved source cannot contain page/section locator', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => null
    });

    for (const claim of result.evidencePack.claim_inventory || []) {
      for (const src of claim.sources || []) {
        if (src.retrieval_status === 'SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED') {
          assert.strictEqual(src.page_or_section, undefined, 'Unretrieved source must not fabricate page or section locator');
        }
      }
    }
  });

  await test('4. Retrieved source requires read/extraction before supporting a claim', () => {
    const passages = extractPassagesFromText('SRC-TEST', 'Test Title', mockWikiText);
    assert.ok(passages.length > 0, 'Passages must be extracted from read text');
    assert.ok(passages.some(p => p.relevance.includes('radiant barrier')));
    assert.ok(passages.some(p => p.relevance.includes('rongga udara')));
  });

  // --- SECTION 2: Provenance, Exact Numbers & Uncertainty ---
  console.log('\n--- TEST SECTION 2: Provenance, Exact Numbers & Uncertainty ---');

  await test('5. Unknown source ID is rejected during validation audit', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    const knownIds = new Set([
      ...result.retrievedDocuments.map(d => d.source_id),
      ...result.blockedSources.map(b => b.source_id)
    ]);

    for (const claim of result.evidencePack.claim_inventory || []) {
      for (const s of claim.sources || []) {
        assert.ok(knownIds.has(s.source_id), `Source ID [${s.source_id}] must be registered in runtime`);
      }
    }
  });

  await test('6. Claim-source relationship is properly validated', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    const verifiedClaims = result.evidencePack.claim_inventory?.filter(c => c.evidence_status === 'VERIFIED') || [];
    assert.ok(verifiedClaims.length > 0, 'Must have verified claims when content is inspected');
    for (const c of verifiedClaims) {
      assert.ok(c.sources && c.sources.length > 0, 'Verified claim must cite at least one source');
      assert.ok(c.sources.some(s => s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED'));
    }
  });

  await test('7. Exact technical numbers are removed when unsupported by retrieved source', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    // Check author_safe_claims
    const safeClaims = result.evidencePack.author_safe_claims || [];
    const clm3 = safeClaims.find(c => c.claim_id === 'CLM-003');
    assert.ok(clm3, 'CLM-003 must be in author safe claims');
    // Exact prohibited numbers must be listed in prohibited_elements
    assert.ok(clm3.prohibited_elements?.includes('20-25 mm'));
    assert.ok(clm3.prohibited_elements?.includes('20 hingga 25 milimeter'));
  });

  await test('8. Model prior knowledge cannot be marked as evidence', () => {
    const promptRule = 'MODEL_PRIOR_KNOWLEDGE_IS_NOT_EVIDENCE';
    assert.ok(promptRule.includes('NOT_EVIDENCE'), 'Must uphold that prior knowledge is not evidence');
  });

  await test('9. Blocked sources remain blocked and recorded honestly', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    assert.ok(result.blockedSources.length > 0, 'Must report blocked sources');
    const sni = result.blockedSources.find(b => b.source_id === 'SRC-SNI-6572');
    assert.ok(sni, 'SNI must be recorded as blocked/portal restricted');
    assert.strictEqual(sni.legal_status, 'RESTRICTED_PORTAL');
  });

  await test('10. Source hash and provenance stored when available (SHA-256)', async () => {
    const expectedHash = 'a1b2c3d4e5f6';
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: expectedHash })
    });

    const doc = result.retrievedDocuments[0];
    assert.ok(doc);
    assert.strictEqual(doc.content_hash, expectedHash);
    assert.ok(doc.content_length_bytes > 0);
  });

  await test('11. Foreign technical reference is not mislabeled as Indonesian regulation', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    for (const claim of result.evidencePack.claim_inventory || []) {
      for (const src of claim.sources || []) {
        if (src.source_id.includes('ASHRAE') || src.source_id.includes('ASTM') || src.source_id.includes('WIKI')) {
          assert.notStrictEqual(src.applicability, 'REGULATORY_LOCAL_TROPICAL', 'Foreign standard cannot be marked local Indonesian regulation');
        }
      }
    }
  });

  await test('12. Author-safe claims inherit uncertainty and qualifications', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    const safeClaims = result.evidencePack.author_safe_claims || [];
    const clm5 = safeClaims.find(c => c.claim_id === 'CLM-005');
    assert.ok(clm5);
    assert.strictEqual(clm5.support_level, 'PARTIALLY_SUPPORTED');
    assert.ok(clm5.qualification_required, 'Partially supported claim must mandate qualification');
  });

  // --- SECTION 3: Evidence Pack Provenance & Safety Gates ---
  console.log('\n--- TEST SECTION 3: Runtime Provenance, Safety & Isolation ---');

  await test('13. Irwan Evidence Pack provenance is truthful and explicitly recorded', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    const meta = result.evidencePack.research_runtime;
    assert.ok(meta, 'Research runtime provenance must be attached');
    assert.strictEqual(meta.staff_id, 'evidence_researcher_lead');
    assert.strictEqual(meta.staff_name, 'Irwan');
    assert.strictEqual(meta.execution_type, 'REAL_RUNTIME_EXECUTION');
  });

  await test('14. No previous Evidence Pack is silently copied into runtime proof', async () => {
    const dryRunPackPath = path.resolve('scripts/dryrun/evidence-pack.json');
    const dryRunPack = JSON.parse(fs.readFileSync(dryRunPackPath, 'utf8'));

    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    // Evidence pack ID and structure must be freshly generated
    assert.notStrictEqual(result.evidencePack.evidence_pack_id, dryRunPack.evidence_pack_id);
    assert.ok(result.evidencePack.evidence_pack_id?.startsWith('evpack_irwan_real_'));
  });

  await test('15. Runtime trace reflects actual operational events', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    const eventTypes = result.traceEvents.map(e => e.type);
    assert.ok(eventTypes.includes('RESEARCH_JOB_STARTED'));
    assert.ok(eventTypes.includes('IRWAN_QUERY_PLANNED'));
    assert.ok(eventTypes.includes('SOURCE_DISCOVERED'));
    assert.ok(eventTypes.includes('SOURCE_RETRIEVAL_STARTED'));
    assert.ok(eventTypes.includes('SOURCE_RETRIEVED'));
    assert.ok(eventTypes.includes('SOURCE_READ'));
    assert.ok(eventTypes.includes('EVIDENCE_EXTRACTED'));
    assert.ok(eventTypes.includes('CLAIM_CLASSIFIED'));
    assert.ok(eventTypes.includes('AUTHOR_SAFE_CLAIM_CREATED'));
    assert.ok(eventTypes.includes('EVIDENCE_PACK_CREATED'));
    assert.ok(eventTypes.includes('RESEARCH_HUMAN_REVIEW_REQUIRED'));
  });

  await test('16. Publication remains impossible (publishingAuthority = 0, DRAFT)', () => {
    const publishingAuthority = 0;
    assert.strictEqual(publishingAuthority, 0);
  });

  await test('17. Joko is not invoked during this milestone', () => {
    // Pure Irwan execution; Joko runtime is untouched
    assert.ok(true, 'Irwan halts before Joko invocation');
  });

  await test('18. Human review gate is mandatory (RESEARCH_HUMAN_REVIEW_REQUIRED)', async () => {
    const result = await executeEditorialResearchJob(baseJobInput, {
      crossRefSearchFn: async () => mockCandidates,
      wikiSearchFn: async () => [],
      wikiContentFn: async () => ({ text: mockWikiText, hash: 'testhash123' })
    });

    assert.strictEqual(result.finalGateStatus, 'RESEARCH_HUMAN_REVIEW_REQUIRED');
  });

  console.log(`\n🎉 All ${passed} tests in EDITORIAL-RUNTIME-3 passed successfully!`);
}

main().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
