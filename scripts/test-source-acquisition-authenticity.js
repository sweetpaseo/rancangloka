/**
 * RancangLoka Editorial Test Suite
 * Milestone: SOURCE-ACQUISITION-AUTHENTICITY-1
 * REAL SOURCE vs FIXTURE PROVENANCE HARDENING
 *
 * Deterministic Test Matrix:
 * Test A: LIVE_RETRIEVAL + exact passage => allowed provenance
 * Test B: VERIFIED_CACHED_SNAPSHOT with valid acquisition chain => allowed provenance
 * Test C: TEST_FIXTURE in REAL_RUNTIME_EXECUTION => FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME
 * Test D: SYNTHETIC_FIXTURE in REAL_RUNTIME_EXECUTION => FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME
 * Test E: fixture-only claim => author-safe false in REAL_RUNTIME_EXECUTION
 * Test F: real source + fixture supporting same claim => authority derived only from real source
 * Test G: missing or corrupted cached snapshot metadata => CACHED_SNAPSHOT_PROVENANCE_INVALID
 * Test H: failed live source retrieval must NOT trigger silent fixture fallback
 * Test I: test execution may use fixture but remains explicitly TEST provenance
 * Test J: fixture text cannot become SOURCE_RETRIEVED_AND_VERIFIED simply because exact substring matching succeeds
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  auditEvidencePackProvenance,
  generateAuthorSafeClaims,
  locatePassageInSource,
  verifyCachedSnapshotProvenance,
  createCachedSnapshotProvenance
} from '../src/lib/article/human-quality.ts';
import {
  executeGeneralizedResearchJob
} from '../src/lib/editorial/irwan-research-runtime.ts';

async function runSuite() {
  console.log('--- STARTING SOURCE-ACQUISITION-AUTHENTICITY-1 SUITE ---');
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

  // Common passage & text fixture
  const sampleRealText = `
== Mekanisme Fisika Kapiler ==
Air tanah naik melintasi pasangan bata porus melalui gaya kapiler alami.
Tegangan permukaan menarik cairan ke dalam mikropori material dinding.
  `.trim();
  const sampleRealHash = crypto.createHash('sha256').update(sampleRealText, 'utf8').digest('hex');

  // =========================================================================
  // Test A: LIVE_RETRIEVAL + exact passage => allowed provenance
  // =========================================================================
  await test('Test A: LIVE_RETRIEVAL + exact passage => allowed provenance', async () => {
    const docId = 'SRC-LIVE-TEST-001';
    const passageText = 'Air tanah naik melintasi pasangan bata porus melalui gaya kapiler alami.';
    const passageHash = crypto.createHash('sha256').update(passageText, 'utf8').digest('hex');

    const pack = {
      evidence_pack_id: 'pack_live_001',
      topic: 'Dinding Lembap',
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: [
        {
          source_id: docId,
          title: 'Studi Fisika Kapiler Dinding Bangunan',
          publisher: 'Building Science Institution',
          url: 'https://example.org/capillary-study',
          canonical_url: 'https://example.org/capillary-study',
          source_classification: 'PRIMARY_RESEARCH_DOCUMENT',
          authority_level: 'INSTITUTIONAL_OFFICIAL',
          primary_vs_secondary: 'PRIMARY',
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          retrieval_method: 'OPEN_API_FULL_TEXT_INSPECTION',
          retrieved_at: '2026-10-05T12:00:00.000Z',
          content_hash: sampleRealHash,
          content_text: sampleRealText,
          content_length_bytes: Buffer.byteLength(sampleRealText, 'utf8'),
          read_status: 'READ_AND_EXTRACTED',
          extracted_passages: [],
          applicability: 'UNIVERSAL_PHYSICS',
          source_origin: 'LIVE_RETRIEVAL',
          requested_url: 'https://example.org/capillary-study',
          resolved_url: 'https://example.org/capillary-study',
          limitations: 'Studi primer fisika bangunan.',
          is_blocked: false
        }
      ],
      claim_inventory: [
        {
          claim_id: 'CLM-001',
          statement: 'Air tanah naik melintasi pasangan bata porus melalui gaya kapiler alami.',
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          sources: [
            {
              source_id: docId,
              document_title: 'Studi Fisika Kapiler Dinding Bangunan',
              applicability: 'UNIVERSAL_PHYSICS',
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
              retrieval_method: 'OPEN_API_FULL_TEXT_INSPECTION',
              source_origin: 'LIVE_RETRIEVAL',
              requested_url: 'https://example.org/capillary-study',
              resolved_url: 'https://example.org/capillary-study',
              content_hash: sampleRealHash
            }
          ],
          evidence_passage_ids: ['PSG-001'],
          semantic_role: 'CAUSE_MECHANISM',
          confidence: 'HIGH',
          action: 'KEEP',
          numeric_claim: false
        }
      ],
      evidence_passages: [
        {
          passage_id: 'PSG-001',
          source_id: docId,
          locator: 'Mekanisme Fisika Kapiler',
          exact_text: passageText,
          exact_or_normalized_excerpt: passageText,
          extracted_at: '2026-10-05T12:00:00.000Z',
          content_hash: passageHash,
          supports_claim_ids: ['CLM-001'],
          semantic_role: 'CAUSE_MECHANISM'
        }
      ],
      author_safe_claims: [
        {
          claim_id: 'CLM-001',
          statement: 'Air tanah naik melintasi pasangan bata porus melalui gaya kapiler alami.',
          support_level: 'VERIFIED',
          applicability: 'UNIVERSAL_PHYSICS',
          allowed_for_authoring: true,
          evidence_passage_ids: ['PSG-001']
        }
      ]
    };

    const summary = auditEvidencePackProvenance(pack, { executionType: 'REAL_RUNTIME_EXECUTION' });
    assert.equal(summary.requires_provenance_failure, false, 'Audit must pass for genuine LIVE_RETRIEVAL');
    assert.equal(summary.live_retrieved_source_count, 1);
    assert.equal(summary.real_authoritative_source_count, 1);
    assert.equal(summary.test_fixture_source_count, 0);
    assert.equal(summary.synthetic_fixture_source_count, 0);

    const safeClaims = generateAuthorSafeClaims(pack.claim_inventory, {
      evidencePassages: pack.evidence_passages,
      executionType: 'REAL_RUNTIME_EXECUTION',
      retrievedDocuments: pack.retrieved_documents
    });
    assert.equal(safeClaims[0].allowed_for_authoring, true);
  });

  // =========================================================================
  // Test B: VERIFIED_CACHED_SNAPSHOT with valid acquisition chain => allowed provenance
  // =========================================================================
  await test('Test B: VERIFIED_CACHED_SNAPSHOT with valid acquisition chain => allowed provenance', async () => {
    const docId = 'SRC-SNAP-TEST-002';
    const passageText = 'Air tanah naik melintasi pasangan bata porus melalui gaya kapiler alami.';
    const passageHash = crypto.createHash('sha256').update(passageText, 'utf8').digest('hex');

    const snapshot = createCachedSnapshotProvenance({
      canonical_source_identity: 'ORNL Building Envelope Archive',
      original_source_url: 'https://ornl.gov/building-envelope/capillary.pdf',
      original_retrieved_at: '2026-08-15T10:00:00.000Z',
      original_http_status: 200,
      text: sampleRealText
    });

    const check = verifyCachedSnapshotProvenance(snapshot, sampleRealText);
    assert.equal(check.isValid, true, 'Snapshot provenance validation must succeed');

    const pack = {
      evidence_pack_id: 'pack_snap_002',
      topic: 'Dinding Lembap',
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: [
        {
          source_id: docId,
          title: 'ORNL Moisture Mechanics',
          publisher: 'Oak Ridge National Laboratory',
          url: 'https://ornl.gov/building-envelope/capillary.pdf',
          source_classification: 'PRIMARY_RESEARCH_DOCUMENT',
          authority_level: 'INSTITUTIONAL_OFFICIAL',
          primary_vs_secondary: 'PRIMARY',
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          retrieval_method: 'OPEN_INSTITUTIONAL_REPOSITORY_INSPECTION',
          retrieved_at: '2026-08-15T10:00:00.000Z',
          content_hash: sampleRealHash,
          content_text: sampleRealText,
          content_length_bytes: Buffer.byteLength(sampleRealText, 'utf8'),
          read_status: 'READ_AND_EXTRACTED',
          extracted_passages: [],
          applicability: 'UNIVERSAL_PHYSICS',
          source_origin: 'VERIFIED_CACHED_SNAPSHOT',
          requested_url: 'https://ornl.gov/building-envelope/capillary.pdf',
          resolved_url: 'https://ornl.gov/building-envelope/capillary.pdf',
          snapshot_provenance: snapshot,
          limitations: 'Snapshot riset terverifikasi.',
          is_blocked: false
        }
      ],
      claim_inventory: [
        {
          claim_id: 'CLM-001',
          statement: 'Air tanah naik melintasi pasangan bata porus melalui gaya kapiler alami.',
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          sources: [
            {
              source_id: docId,
              document_title: 'ORNL Moisture Mechanics',
              applicability: 'UNIVERSAL_PHYSICS',
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
              retrieval_method: 'OPEN_INSTITUTIONAL_REPOSITORY_INSPECTION',
              source_origin: 'VERIFIED_CACHED_SNAPSHOT',
              snapshot_provenance: snapshot,
              content_hash: sampleRealHash
            }
          ],
          evidence_passage_ids: ['PSG-001'],
          semantic_role: 'CAUSE_MECHANISM',
          confidence: 'HIGH',
          action: 'KEEP',
          numeric_claim: false
        }
      ],
      evidence_passages: [
        {
          passage_id: 'PSG-001',
          source_id: docId,
          locator: 'Mekanisme Fisika Kapiler',
          exact_text: passageText,
          exact_or_normalized_excerpt: passageText,
          extracted_at: '2026-08-15T10:00:00.000Z',
          content_hash: passageHash,
          supports_claim_ids: ['CLM-001'],
          semantic_role: 'CAUSE_MECHANISM'
        }
      ],
      author_safe_claims: [
        {
          claim_id: 'CLM-001',
          statement: 'Air tanah naik melintasi pasangan bata porus melalui gaya kapiler alami.',
          support_level: 'VERIFIED',
          applicability: 'UNIVERSAL_PHYSICS',
          allowed_for_authoring: true,
          evidence_passage_ids: ['PSG-001']
        }
      ]
    };

    const summary = auditEvidencePackProvenance(pack, { executionType: 'REAL_RUNTIME_EXECUTION' });
    assert.equal(summary.requires_provenance_failure, false, 'Audit must pass for genuine VERIFIED_CACHED_SNAPSHOT');
    assert.equal(summary.verified_cached_snapshot_count, 1);
    assert.equal(summary.real_authoritative_source_count, 1);
  });

  // =========================================================================
  // Test C: TEST_FIXTURE in REAL_RUNTIME_EXECUTION => FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME
  // =========================================================================
  await test('Test C: TEST_FIXTURE in REAL_RUNTIME_EXECUTION => FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME', async () => {
    const pack = {
      evidence_pack_id: 'pack_test_fix_003',
      topic: 'Dinding Lembap',
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: [
        {
          source_id: 'SRC-TEST-FIXTURE-1',
          title: 'Mock Test Document',
          publisher: 'Test Author',
          url: 'https://test.local/doc',
          source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
          authority_level: 'INSTITUTIONAL_OFFICIAL',
          primary_vs_secondary: 'SECONDARY',
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          retrieval_method: 'MOCK_INSPECTION',
          retrieved_at: new Date().toISOString(),
          content_hash: '1234567890abcdef',
          content_text: 'Teks uji coba lokal.',
          content_length_bytes: 20,
          read_status: 'READ_AND_EXTRACTED',
          extracted_passages: [],
          applicability: 'UNIVERSAL_PHYSICS',
          source_origin: 'TEST_FIXTURE',
          limitations: 'Hanya fixture uji coba.',
          is_blocked: false
        }
      ],
      claim_inventory: [],
      evidence_passages: []
    };

    const summary = auditEvidencePackProvenance(pack, { executionType: 'REAL_RUNTIME_EXECUTION' });
    assert.equal(summary.requires_provenance_failure, true, 'TEST_FIXTURE in REAL_RUNTIME_EXECUTION must fail provenance');
    const hasCode = summary.unverified_claims.some(c => c.includes('FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME'));
    assert.equal(hasCode, true, 'Must report FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME');
    assert.equal(summary.test_fixture_source_count, 1);
    assert.equal(summary.real_authoritative_source_count, 0);
  });

  // =========================================================================
  // Test D: SYNTHETIC_FIXTURE in REAL_RUNTIME_EXECUTION => FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME
  // =========================================================================
  await test('Test D: SYNTHETIC_FIXTURE in REAL_RUNTIME_EXECUTION => FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME', async () => {
    const pack = {
      evidence_pack_id: 'pack_synth_fix_004',
      topic: 'Dinding Lembap',
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: [
        {
          source_id: 'SRC-OPEN-EPA-MOISTURE',
          title: 'Moisture Control Guidance',
          publisher: 'U.S. EPA (Synthetic Summary)',
          url: 'https://epa.gov/moisture',
          source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
          authority_level: 'INSTITUTIONAL_OFFICIAL',
          primary_vs_secondary: 'SECONDARY',
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          retrieval_method: 'OPEN_INSTITUTIONAL_REPOSITORY_INSPECTION',
          retrieved_at: new Date().toISOString(),
          content_hash: 'abcdef1234567890',
          content_text: 'Summary of moisture control principles.',
          content_length_bytes: 40,
          read_status: 'READ_AND_EXTRACTED',
          extracted_passages: [],
          applicability: 'UNIVERSAL_PHYSICS',
          source_origin: 'SYNTHETIC_FIXTURE',
          limitations: 'Fixture sintetis lokal.',
          is_blocked: false
        }
      ],
      claim_inventory: [],
      evidence_passages: []
    };

    const summary = auditEvidencePackProvenance(pack, { executionType: 'REAL_RUNTIME_EXECUTION' });
    assert.equal(summary.requires_provenance_failure, true, 'SYNTHETIC_FIXTURE in REAL_RUNTIME_EXECUTION must fail provenance');
    const hasCode = summary.unverified_claims.some(c => c.includes('FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME'));
    assert.equal(hasCode, true, 'Must report FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME');
    assert.equal(summary.synthetic_fixture_source_count, 1);
    assert.equal(summary.real_authoritative_source_count, 0);
  });

  // =========================================================================
  // Test E: fixture-only claim => author-safe false
  // =========================================================================
  await test('Test E: fixture-only claim => author-safe false', async () => {
    const claims = [
      {
        claim_id: 'CLM-010',
        statement: 'Penetrasi air hujan melewati retakan fasad pasangan bata memicu bercak basah lokal.',
        claim_class: 'technical_consensus',
        evidence_status: 'SUPPORTED',
        provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        sources: [
          {
            source_id: 'SRC-OPEN-EPA-MOISTURE',
            document_title: 'EPA Guidance Fixture',
            applicability: 'UNIVERSAL_PHYSICS',
            retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
            source_origin: 'SYNTHETIC_FIXTURE'
          }
        ],
        evidence_passage_ids: ['PSG-010'],
        semantic_role: 'CAUSE_MECHANISM',
        confidence: 'HIGH',
        action: 'KEEP',
        numeric_claim: false
      }
    ];

    const passages = [
      {
        passage_id: 'PSG-010',
        source_id: 'SRC-OPEN-EPA-MOISTURE',
        locator: 'Section 1',
        exact_text: 'Penetrasi air hujan melewati retakan fasad pasangan bata memicu bercak basah lokal.',
        exact_or_normalized_excerpt: 'Penetrasi air hujan melewati retakan fasad pasangan bata memicu bercak basah lokal.',
        extracted_at: new Date().toISOString(),
        supports_claim_ids: ['CLM-010'],
        semantic_role: 'CAUSE_MECHANISM',
        source_origin: 'SYNTHETIC_FIXTURE'
      }
    ];

    const safeClaims = generateAuthorSafeClaims(claims, {
      evidencePassages: passages,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    assert.equal(safeClaims.length, 1);
    assert.equal(safeClaims[0].allowed_for_authoring, false, 'Fixture-only claim must not be allowed for authoring in real runtime');
    assert.equal(safeClaims[0].source_provenance_blocked, true);
    assert.match(safeClaims[0].qualification_required, /FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME/);
  });

  // =========================================================================
  // Test F: real source + fixture supporting same claim => authority derived only from real source
  // =========================================================================
  await test('Test F: real source + fixture supporting same claim => authority derived only from real source', async () => {
    const claims = [
      {
        claim_id: 'CLM-020',
        statement: 'Air kapiler merembes melalui pori bata dan menyebabkan kerusakan plesteran dinding.',
        claim_class: 'technical_consensus',
        evidence_status: 'VERIFIED',
        provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        sources: [
          {
            source_id: 'SRC-REAL-001',
            document_title: 'Live Retrieved Study',
            applicability: 'UNIVERSAL_PHYSICS',
            retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
            source_origin: 'LIVE_RETRIEVAL',
            requested_url: 'https://example.org/study'
          },
          {
            source_id: 'SRC-FIXTURE-002',
            document_title: 'Synthetic Fixture',
            applicability: 'UNIVERSAL_PHYSICS',
            retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
            source_origin: 'SYNTHETIC_FIXTURE'
          }
        ],
        evidence_passage_ids: ['PSG-REAL-001', 'PSG-FIX-002'],
        semantic_role: 'CAUSE_MECHANISM',
        confidence: 'HIGH',
        action: 'KEEP',
        numeric_claim: false
      }
    ];

    const passages = [
      {
        passage_id: 'PSG-REAL-001',
        source_id: 'SRC-REAL-001',
        locator: 'Section 1',
        exact_text: 'Air kapiler merembes melalui pori bata dan menyebabkan kerusakan plesteran dinding.',
        exact_or_normalized_excerpt: 'Air kapiler merembes melalui pori bata dan menyebabkan kerusakan plesteran dinding.',
        extracted_at: new Date().toISOString(),
        supports_claim_ids: ['CLM-020'],
        semantic_role: 'CAUSE_MECHANISM',
        source_origin: 'LIVE_RETRIEVAL'
      },
      {
        passage_id: 'PSG-FIX-002',
        source_id: 'SRC-FIXTURE-002',
        locator: 'Section 2',
        exact_text: 'Air kapiler merembes melalui pori bata dan menyebabkan kerusakan plesteran dinding.',
        exact_or_normalized_excerpt: 'Air kapiler merembes melalui pori bata dan menyebabkan kerusakan plesteran dinding.',
        extracted_at: new Date().toISOString(),
        supports_claim_ids: ['CLM-020'],
        semantic_role: 'CAUSE_MECHANISM',
        source_origin: 'SYNTHETIC_FIXTURE'
      }
    ];

    const safeClaims = generateAuthorSafeClaims(claims, {
      evidencePassages: passages,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    assert.equal(safeClaims.length, 1);
    assert.equal(safeClaims[0].allowed_for_authoring, true, 'Must be allowed because authentic source supports it');
    // Crucial: evidence_passage_ids must contain ONLY the real passage, not the fixture passage
    assert.deepEqual(safeClaims[0].evidence_passage_ids, ['PSG-REAL-001']);
  });

  // =========================================================================
  // Test G: missing or corrupted cached snapshot acquisition metadata => CACHED_SNAPSHOT_PROVENANCE_INVALID
  // =========================================================================
  await test('Test G: missing or corrupted cached snapshot acquisition metadata => CACHED_SNAPSHOT_PROVENANCE_INVALID', async () => {
    // Corrupted snapshot (tampered hash)
    const badSnapshot = {
      canonical_source_identity: 'ORNL Building Envelope Archive',
      original_source_url: 'https://ornl.gov/doc.pdf',
      original_retrieved_at: '2026-08-15T10:00:00.000Z',
      original_http_status: 200,
      raw_snapshot_hash: 'badhash123',
      snapshot_integrity_hash: 'invalid_integrity_token'
    };

    const check = verifyCachedSnapshotProvenance(badSnapshot, sampleRealText);
    assert.equal(check.isValid, false, 'Corrupted snapshot must fail verification');

    const pack = {
      evidence_pack_id: 'pack_bad_snap_005',
      topic: 'Dinding Lembap',
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: [
        {
          source_id: 'SRC-BAD-SNAP',
          title: 'Tampered Snapshot',
          publisher: 'Unknown',
          url: 'https://ornl.gov/doc.pdf',
          source_classification: 'PRIMARY_RESEARCH_DOCUMENT',
          authority_level: 'INSTITUTIONAL_OFFICIAL',
          primary_vs_secondary: 'PRIMARY',
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          retrieval_method: 'OPEN_INSTITUTIONAL_REPOSITORY_INSPECTION',
          retrieved_at: '2026-08-15T10:00:00.000Z',
          content_hash: sampleRealHash,
          content_text: sampleRealText,
          content_length_bytes: Buffer.byteLength(sampleRealText, 'utf8'),
          read_status: 'READ_AND_EXTRACTED',
          extracted_passages: [],
          applicability: 'UNIVERSAL_PHYSICS',
          source_origin: 'VERIFIED_CACHED_SNAPSHOT',
          snapshot_provenance: badSnapshot,
          limitations: 'Tampered.',
          is_blocked: false
        }
      ],
      claim_inventory: [],
      evidence_passages: []
    };

    const summary = auditEvidencePackProvenance(pack, { executionType: 'REAL_RUNTIME_EXECUTION' });
    assert.equal(summary.requires_provenance_failure, true);
    const hasCode = summary.unverified_claims.some(c => c.includes('CACHED_SNAPSHOT_PROVENANCE_INVALID'));
    assert.equal(hasCode, true, 'Must report CACHED_SNAPSHOT_PROVENANCE_INVALID');
  });

  // =========================================================================
  // Test H: failed live source retrieval must NOT trigger silent fixture fallback
  // =========================================================================
  await test('Test H: failed live source retrieval must NOT trigger silent fixture fallback', async () => {
    // When executing research in REAL_RUNTIME_EXECUTION and institutional doc is a synthetic fixture:
    const mockWiki = async () => ({
      title: 'Damp (structural)',
      text: sampleRealText,
      hash: sampleRealHash,
      source_origin: 'LIVE_RETRIEVAL',
      requested_url: 'https://en.wikipedia.org/wiki/Damp_(structural)',
      resolved_url: 'https://en.wikipedia.org/wiki/Damp_(structural)'
    });

    const mockOpenDoc = async () => ({
      title: 'EPA Guidance',
      publisher: 'EPA',
      url: 'https://epa.gov/moisture',
      canonical_url: 'https://epa.gov/moisture',
      text: 'Synthetic EPA fixture text',
      hash: 'synthhash',
      source_origin: 'SYNTHETIC_FIXTURE'
    });

    const jobResult = await executeGeneralizedResearchJob({
      taskId: 'job_test_no_silent_fallback',
      topic: 'Dinding Lembap Rembes Air',
      execution_type: 'REAL_RUNTIME_EXECUTION',
      operatorAuth: { authorizedBy: 'Chief Editor' }
    }, {
      wikiContentFn: mockWiki,
      openTechnicalDocFn: mockOpenDoc,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    // In real runtime, the fixture must NOT be silently accepted as SOURCE_RETRIEVED_AND_VERIFIED
    const epaDoc = jobResult.retrievedDocuments.find(d => d.source_id === 'SRC-OPEN-EPA-MOISTURE');
    assert.ok(epaDoc, 'EPA doc should be recorded in retrievedDocuments');
    assert.equal(epaDoc.retrieval_status, 'SOURCE_RETRIEVAL_FAILED', 'Synthetic fixture must NOT become SOURCE_RETRIEVED_AND_VERIFIED in real runtime');
    assert.equal(epaDoc.is_blocked, true, 'Fixture doc must be blocked in real runtime');
    assert.equal(epaDoc.blocked_reason, 'FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME');

    // Trace events must explicitly record the blockage
    const blockedEvent = jobResult.traceEvents.find(e => e.type === 'SOURCE_RETRIEVAL_BLOCKED' && e.summary.includes('FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME'));
    assert.ok(blockedEvent, 'Trace event SOURCE_RETRIEVAL_BLOCKED must be logged');
  });

  // =========================================================================
  // Test I: test execution may use fixture but remains explicitly TEST provenance
  // =========================================================================
  await test('Test I: test execution may use fixture but remains explicitly TEST provenance', async () => {
    const mockWiki = async () => ({
      title: 'Damp (structural)',
      text: sampleRealText,
      hash: sampleRealHash,
      source_origin: 'TEST_FIXTURE'
    });

    const mockOpenDoc = async () => ({
      title: 'EPA Guidance Fixture',
      publisher: 'EPA',
      url: 'https://epa.gov/moisture',
      canonical_url: 'https://epa.gov/moisture',
      text: sampleRealText,
      hash: sampleRealHash,
      source_origin: 'TEST_FIXTURE'
    });

    const jobResult = await executeGeneralizedResearchJob({
      taskId: 'job_test_explicit_test',
      topic: 'Dinding Lembap Rembes Air',
      execution_type: 'TEST',
      operatorAuth: { authorizedBy: 'Chief Editor' }
    }, {
      wikiContentFn: mockWiki,
      openTechnicalDocFn: mockOpenDoc,
      executionType: 'TEST'
    });

    assert.equal(jobResult.evidencePack.execution_type, 'TEST', 'Evidence Pack execution_type must be explicitly TEST');
    const summary = auditEvidencePackProvenance(jobResult.evidencePack, { executionType: 'TEST' });
    // In TEST execution, audit does not block fixtures
    assert.equal(summary.requires_provenance_failure, false, 'Audit passes in test mode for fixtures');
    assert.equal(summary.real_authoritative_source_count, 0, 'Fixtures must never be counted as real authoritative sources');
    assert.ok(summary.test_fixture_source_count > 0, 'Test fixtures are counted separately');
  });

  // =========================================================================
  // Test J: fixture text cannot become SOURCE_RETRIEVED_AND_VERIFIED simply because exact substring matching succeeds
  // =========================================================================
  await test('Test J: fixture text cannot become SOURCE_RETRIEVED_AND_VERIFIED simply because exact substring matching succeeds', async () => {
    const fixtureText = 'Air tanah merembes naik ke dinding melalui tarikan kapiler mikropori bata.';
    const loc = locatePassageInSource(fixtureText, fixtureText);
    assert.equal(loc.found, true, 'Exact string containment succeeds');

    const pack = {
      evidence_pack_id: 'pack_fixture_substring_006',
      topic: 'Dinding Lembap',
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: [
        {
          source_id: 'SRC-FIXTURE-SUBSTRING',
          title: 'Hand-Authored Fixture Document',
          publisher: 'Local Mock',
          url: 'https://mock.local/doc',
          source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
          authority_level: 'INSTITUTIONAL_OFFICIAL',
          primary_vs_secondary: 'SECONDARY',
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED', // Attempting to masquerade
          retrieval_method: 'OPEN_INSTITUTIONAL_REPOSITORY_INSPECTION',
          retrieved_at: new Date().toISOString(),
          content_hash: crypto.createHash('sha256').update(fixtureText, 'utf8').digest('hex'),
          content_text: fixtureText,
          content_length_bytes: Buffer.byteLength(fixtureText, 'utf8'),
          read_status: 'READ_AND_EXTRACTED',
          extracted_passages: [],
          applicability: 'UNIVERSAL_PHYSICS',
          source_origin: 'SYNTHETIC_FIXTURE', // Stated origin
          limitations: 'Fixture lokal.',
          is_blocked: false
        }
      ],
      claim_inventory: [
        {
          claim_id: 'CLM-030',
          statement: fixtureText,
          claim_class: 'technical_consensus',
          evidence_status: 'VERIFIED',
          provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          sources: [
            {
              source_id: 'SRC-FIXTURE-SUBSTRING',
              document_title: 'Hand-Authored Fixture Document',
              applicability: 'UNIVERSAL_PHYSICS',
              retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
              source_origin: 'SYNTHETIC_FIXTURE'
            }
          ],
          evidence_passage_ids: ['PSG-030'],
          semantic_role: 'CAUSE_MECHANISM',
          confidence: 'HIGH',
          action: 'KEEP',
          numeric_claim: false
        }
      ],
      evidence_passages: [
        {
          passage_id: 'PSG-030',
          source_id: 'SRC-FIXTURE-SUBSTRING',
          locator: 'Section 1',
          exact_text: fixtureText,
          exact_or_normalized_excerpt: fixtureText,
          extracted_at: new Date().toISOString(),
          content_hash: crypto.createHash('sha256').update(fixtureText, 'utf8').digest('hex'),
          supports_claim_ids: ['CLM-030'],
          semantic_role: 'CAUSE_MECHANISM',
          passage_nature: 'EXACT_LOCATED',
          source_origin: 'SYNTHETIC_FIXTURE'
        }
      ],
      author_safe_claims: [
        {
          claim_id: 'CLM-030',
          statement: fixtureText,
          support_level: 'VERIFIED',
          applicability: 'UNIVERSAL_PHYSICS',
          allowed_for_authoring: true,
          evidence_passage_ids: ['PSG-030']
        }
      ]
    };

    // Substring match is 100% verified, but source_origin is SYNTHETIC_FIXTURE in REAL_RUNTIME_EXECUTION
    const summary = auditEvidencePackProvenance(pack, { executionType: 'REAL_RUNTIME_EXECUTION' });
    assert.equal(summary.requires_provenance_failure, true, 'Exact match must NOT bypass fixture prohibition');
    assert.ok(summary.unverified_claims.some(c => c.includes('FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME')));
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
