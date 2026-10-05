/**
 * Deterministic Test Suite: RESEARCH-SOURCE-COVERAGE-1
 * Authentic Multi-Source Acquisition & Admissible Coverage Gate
 *
 * Verifies:
 * A. 0 authentic sources + fixture claims => admissible_evidence_coverage_ratio = 0
 * B. Fixture covers all six RQs => production gate still FAIL
 * C. Authentic passages cover 3/6 => admissible coverage = 0.5
 * D. Authentic passages cover 6/6 => coverage PASS
 * E. Metadata-only CrossRef candidate => zero evidence authority
 * F. Live retrieved HTML candidate => eligible after provenance validation
 * G. Failed HTTP retrieval => no fixture fallback
 * H. Missing-category second pass targets only missing research roles
 * I. Research loop respects hard pass limit (MAX_RESEARCH_PASSES = 2)
 * J. Arbitrary unrelated topic generates dynamic queries without old-domain keywords
 * K. One source reused for many claims does not inflate authentic source count
 * L. Source diversity metrics correctly distinguish source count from claim-source relationships
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  generateEditorialResearchQuestions,
  validateResearchQuestionCoverage,
  generateQuestionSpecificQueries
} from '../src/lib/editorial/research-questions.ts';

import {
  fetchHttpDocument,
  establishSourceIdentity,
  calculateSourceDiversity,
  sanitizeHtmlToPlainText,
  extractDynamicPassagesFromText
} from '../src/lib/editorial/source-discovery.ts';

import {
  executeGeneralizedResearchJob
} from '../src/lib/editorial/irwan-research-runtime.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  ✓ [TEST-${passed}] ${name}`);
}

async function runTests() {
  console.log('=================================================================');
  console.log('RUNNING TEST SUITE: RESEARCH-SOURCE-COVERAGE-1');
  console.log('Authentic Multi-Source Acquisition & Admissible Coverage');
  console.log('=================================================================\n');

  const topicFenestration = 'Jendela Aluminium Sering Berembun di Pagi Hari: Masalah Kusen, Kaca, Ventilasi, atau Kelembapan Ruangan?';
  const questions = generateEditorialResearchQuestions(topicFenestration);
  assert.equal(questions.length, 6, 'Must generate exactly 6 mandatory research questions');

  // =========================================================================
  // TEST A: 0 authentic sources + fixture claims => admissible_evidence_coverage_ratio = 0
  // =========================================================================
  console.log('--- TEST A: 0 authentic sources + fixture claims ---');
  {
    const fixtureDocs = [
      {
        source_id: 'SRC-TEST-FIXTURE-1',
        title: 'Mock Window Guide',
        publisher: 'Test Publisher',
        source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'TEST_FIXTURE',
        is_blocked: false,
        extracted_passages: []
      }
    ];

    const fixtureClaims = [
      {
        claim_id: 'CLM-001',
        statement: 'Perbedaan suhu memicu kondensasi pada permukaan aluminium tanpa thermal break',
        semantic_role: 'CAUSE_MECHANISM',
        sources: [
          {
            source_id: 'SRC-TEST-FIXTURE-1',
            source_origin: 'TEST_FIXTURE',
            retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED'
          }
        ]
      },
      {
        claim_id: 'CLM-002',
        statement: 'Ventilasi ruangan menurunkan kelembapan relatif udara dalam ruangan',
        semantic_role: 'INTERVENTION_EFFECT',
        sources: [
          {
            source_id: 'SRC-TEST-FIXTURE-1',
            source_origin: 'TEST_FIXTURE',
            retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED'
          }
        ]
      }
    ];

    const pack = {
      topic: topicFenestration,
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: fixtureDocs,
      claim_inventory: fixtureClaims,
      evidence_passages: []
    };

    const res = validateResearchQuestionCoverage(questions, pack, { executionType: 'REAL_RUNTIME_EXECUTION' });

    assert.equal(res.authentic_source_count, 0, 'Authentic source count must be 0 for fixture-backed pack');
    assert.equal(res.admissible_evidence_coverage_ratio, 0, 'Admissible coverage ratio MUST be 0 when authentic source count = 0');
    assert.ok(res.raw_research_coverage_ratio > 0, 'Raw research coverage ratio may reflect fixture claims');
    assert.equal(res.covered, false, 'Production gate must fail closed');
    pass('0 authentic sources + fixture claims yields admissible_evidence_coverage_ratio = 0');
  }

  // =========================================================================
  // TEST B: Fixture covers all six RQs => production gate still FAIL
  // =========================================================================
  console.log('\n--- TEST B: Fixture covers all six RQs => production gate still FAIL ---');
  {
    const fixtureDocs = [
      {
        source_id: 'SRC-SYNTHETIC-FIXTURE-ALL',
        title: 'Complete Synthetic Guide',
        publisher: 'Synthetic Labs',
        source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'SYNTHETIC_FIXTURE',
        is_blocked: false,
        extracted_passages: []
      }
    ];

    const fixtureClaims = [
      { claim_id: 'C-01', statement: 'Mekanisme fisik perpindahan panas memicu embun', semantic_role: 'CAUSE_MECHANISM', sources: [{ source_id: 'SRC-SYNTHETIC-FIXTURE-ALL', source_origin: 'SYNTHETIC_FIXTURE', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }] },
      { claim_id: 'C-02', statement: 'Tanda diagnostik membedakan kondensasi permukaan dari kebocoran air hujan', semantic_role: 'DIAGNOSTIC_SIGNAL', sources: [{ source_id: 'SRC-SYNTHETIC-FIXTURE-ALL', source_origin: 'SYNTHETIC_FIXTURE', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }] },
      { claim_id: 'C-03', statement: 'Profil thermal break dan kaca ganda efektif menahan perbedaan suhu', semantic_role: 'INTERVENTION_EFFECT', sources: [{ source_id: 'SRC-SYNTHETIC-FIXTURE-ALL', source_origin: 'SYNTHETIC_FIXTURE', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }] },
      { claim_id: 'C-04', statement: 'Keterbatasan pelapisan film tanpa mengatasi kelembapan ruangan adalah solusi semu', semantic_role: 'LIMITATION', sources: [{ source_id: 'SRC-SYNTHETIC-FIXTURE-ALL', source_origin: 'SYNTHETIC_FIXTURE', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }] },
      { claim_id: 'C-05', statement: 'Kondisi air menggenang di kusen dan merusak dinding memerlukan inspeksi ahli', semantic_role: 'RISK', sources: [{ source_id: 'SRC-SYNTHETIC-FIXTURE-ALL', source_origin: 'SYNTHETIC_FIXTURE', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }] },
      { claim_id: 'C-06', statement: 'Standar pengujian termal membuktikan urutan tindakan perbaikan', semantic_role: 'REGULATORY_REFERENCE', sources: [{ source_id: 'SRC-SYNTHETIC-FIXTURE-ALL', source_origin: 'SYNTHETIC_FIXTURE', retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED' }] }
    ];

    const pack = {
      topic: topicFenestration,
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: fixtureDocs,
      claim_inventory: fixtureClaims,
      evidence_passages: []
    };

    const res = validateResearchQuestionCoverage(questions, pack, { executionType: 'REAL_RUNTIME_EXECUTION' });

    assert.equal(res.raw_research_coverage_ratio, 1.0, 'Raw coverage should be 1.0 (6/6 categories matched raw)');
    assert.equal(res.admissible_evidence_coverage_ratio, 0, 'Admissible coverage MUST remain 0 despite all 6 RQs covered by fixtures');
    assert.equal(res.covered, false, 'Production gate MUST fail closed when admissible evidence is 0');
    assert.ok(res.rejection_reason.includes('RESEARCH_COVERAGE_INSUFFICIENT') || res.rejection_code === 'ADMISSIBLE_COVERAGE_AUTHORITY_MISMATCH');
    pass('Fixture covering all six RQs fails production gate with admissible_evidence_coverage_ratio = 0');
  }

  // =========================================================================
  // TEST C: Authentic passages cover 3/6 => admissible coverage = 0.5
  // =========================================================================
  console.log('\n--- TEST C: Authentic passages cover 3/6 => admissible coverage = 0.5 ---');
  {
    const authenticDoc = {
      source_id: 'SRC-LIVE-WIKI-WINDOW',
      title: 'Window Frame',
      publisher: 'Wikimedia Foundation',
      source_classification: 'ENCYCLOPEDIC_SECONDARY_SOURCE',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      source_origin: 'LIVE_RETRIEVAL',
      is_blocked: false,
      extracted_passages: []
    };

    const authenticPassages = [
      {
        passage_id: 'p-01',
        source_id: 'SRC-LIVE-WIKI-WINDOW',
        locator: 'Thermal performance',
        exact_or_normalized_excerpt: 'Aluminium conducts heat rapidly, causing interior surface temperature to drop below dew point.',
        semantic_role: 'CAUSE_MECHANISM'
      },
      {
        passage_id: 'p-02',
        source_id: 'SRC-LIVE-WIKI-WINDOW',
        locator: 'Joints and seals',
        exact_or_normalized_excerpt: 'Dual compression seals reduce air infiltration and improve thermal insulation across the frame.',
        semantic_role: 'INTERVENTION_EFFECT'
      },
      {
        passage_id: 'p-03',
        source_id: 'SRC-LIVE-WIKI-WINDOW',
        locator: 'Testing standards',
        exact_or_normalized_excerpt: 'Standard laboratory testing confirms that thermal breaks reduce overall frame conductance.',
        semantic_role: 'MATERIAL_BEHAVIOR'
      }
    ];

    const claims = [
      {
        claim_id: 'CLM-01',
        statement: 'Konduktivitas termal tinggi pada aluminium menyebabkan suhu permukaan turun di bawah titik embun',
        semantic_role: 'CAUSE_MECHANISM',
        evidence_passage_ids: ['p-01'],
        sources: [authenticDoc]
      },
      {
        claim_id: 'CLM-02',
        statement: 'Seal kompresi ganda menurunkan infiltrasi udara dan meningkatkan insulasi termal',
        semantic_role: 'INTERVENTION_EFFECT',
        evidence_passage_ids: ['p-02'],
        sources: [authenticDoc]
      },
      {
        claim_id: 'CLM-03',
        statement: 'Pengujian standar membuktikan efektivitas thermal break',
        semantic_role: 'MATERIAL_BEHAVIOR',
        evidence_passage_ids: ['p-03'],
        sources: [authenticDoc]
      }
    ];

    const pack = {
      topic: topicFenestration,
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: [authenticDoc],
      claim_inventory: claims,
      evidence_passages: authenticPassages
    };

    const res = validateResearchQuestionCoverage(questions, pack, {
      executionType: 'REAL_RUNTIME_EXECUTION',
      requireAllCategories: true
    });

    assert.equal(res.authentic_source_count, 1, 'Should record 1 authentic source');
    assert.equal(res.admissible_evidence_coverage_ratio, 0.5, 'Admissible coverage must be exactly 0.5 (3 of 6 covered)');
    assert.equal(res.covered, false, 'Coverage gate must FAIL when only 3 of 6 are covered and all are required');
    assert.equal(res.missing_categories.length, 3, 'Must report 3 missing categories');
    pass('Authentic passages covering 3/6 yield admissible coverage = 0.5 and fail strict gate');
  }

  // =========================================================================
  // TEST D: Authentic passages cover 6/6 => coverage PASS
  // =========================================================================
  console.log('\n--- TEST D: Authentic passages cover 6/6 => coverage PASS ---');
  {
    const authenticDoc1 = {
      source_id: 'SRC-LIVE-LBNL-DOC',
      title: 'Fenestration Thermal Evaluation',
      publisher: 'Lawrence Berkeley National Laboratory',
      source_classification: 'PRIMARY_RESEARCH_DOCUMENT',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      source_origin: 'LIVE_RETRIEVAL',
      is_blocked: false,
      extracted_passages: []
    };

    const authenticPassages = [
      { passage_id: 'p-01', source_id: 'SRC-LIVE-LBNL-DOC', exact_or_normalized_excerpt: 'Heat conduction through frame causes temperature drop below dew point', semantic_role: 'CAUSE_MECHANISM' },
      { passage_id: 'p-02', source_id: 'SRC-LIVE-LBNL-DOC', exact_or_normalized_excerpt: 'Differential diagnosis distinguishes surface condensation from water leakage', semantic_role: 'DIAGNOSTIC_SIGNAL' },
      { passage_id: 'p-03', source_id: 'SRC-LIVE-LBNL-DOC', exact_or_normalized_excerpt: 'Thermal polyamide break reduces frame heat transmission significantly', semantic_role: 'INTERVENTION_EFFECT' },
      { passage_id: 'p-04', source_id: 'SRC-LIVE-LBNL-DOC', exact_or_normalized_excerpt: 'Applying window film is a false fix that does not prevent frame thermal bridging', semantic_role: 'LIMITATION' },
      { passage_id: 'p-05', source_id: 'SRC-LIVE-LBNL-DOC', exact_or_normalized_excerpt: 'Water pooling on sills with perimeter drywall damage requires professional inspection', semantic_role: 'RISK' },
      { passage_id: 'p-06', source_id: 'SRC-LIVE-LBNL-DOC', exact_or_normalized_excerpt: 'Standard ASTM testing confirms recommendation priority order', semantic_role: 'REGULATORY_REFERENCE' }
    ];

    const claims = authenticPassages.map((p, idx) => ({
      claim_id: `CLM-00${idx + 1}`,
      statement: p.exact_or_normalized_excerpt,
      semantic_role: p.semantic_role,
      evidence_passage_ids: [p.passage_id],
      sources: [authenticDoc1]
    }));

    const pack = {
      topic: topicFenestration,
      execution_type: 'REAL_RUNTIME_EXECUTION',
      retrieved_documents: [authenticDoc1],
      claim_inventory: claims,
      evidence_passages: authenticPassages
    };

    const res = validateResearchQuestionCoverage(questions, pack, {
      executionType: 'REAL_RUNTIME_EXECUTION',
      requireAllCategories: true
    });

    assert.equal(res.admissible_evidence_coverage_ratio, 1.0, 'Admissible coverage ratio must be 1.0 (6/6)');
    assert.equal(res.covered, true, 'Coverage gate must PASS when all 6 RQs are covered by authentic evidence');
    assert.equal(res.missing_categories.length, 0, 'No missing categories');
    pass('Authentic passages covering 6/6 yield coverage PASS');
  }

  // =========================================================================
  // TEST E: Metadata-only CrossRef candidate => zero evidence authority
  // =========================================================================
  console.log('\n--- TEST E: Metadata-only CrossRef candidate => zero evidence authority ---');
  {
    const candidate = {
      candidate_id: 'cand_cr_123',
      query: 'fenestration condensation thermal break',
      discovery_engine: 'CROSSREF_OPEN_API',
      title: 'A Study on Window Condensation in Humid Climates',
      publisher: 'Elsevier',
      doi: '10.1016/j.buildenv.2024.01',
      snippet: 'This study investigates thermal bridging across aluminium fenestration frames.',
      discovered_at: new Date().toISOString()
    };

    // A candidate being discovered does not create a retrieved document or passages
    const pack = {
      topic: topicFenestration,
      execution_type: 'REAL_RUNTIME_EXECUTION',
      discovered_sources: [candidate],
      retrieved_documents: [],
      claim_inventory: [],
      evidence_passages: []
    };

    const res = validateResearchQuestionCoverage(questions, pack, { executionType: 'REAL_RUNTIME_EXECUTION' });

    assert.equal(res.authentic_source_count, 0, 'Discovered metadata candidate cannot count as authentic source');
    assert.equal(res.admissible_evidence_coverage_ratio, 0, 'Discovered metadata candidate provides 0 admissible coverage');
    assert.equal(res.covered, false, 'Cannot pass gate on metadata alone');
    pass('Metadata-only CrossRef candidate contributes zero evidence authority');
  }

  // =========================================================================
  // TEST F: Live retrieved HTML candidate => eligible after provenance validation
  // =========================================================================
  console.log('\n--- TEST F: Live retrieved HTML candidate => eligible after provenance validation ---');
  {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Thermal Breaks in Aluminium Framing</title></head>
        <body>
          <h1>Thermal Performance and Condensation Resistance</h1>
          <p>Aluminium window frames have high thermal conductivity. To prevent interior condensation in cool mornings, a polyamide thermal break must separate the interior and exterior aluminium sections.</p>
          <h2>Differential Diagnosis and Sealing</h2>
          <p>Differentiating condensation from rain water leakage requires examining the location: condensation appears across the entire cold metal profile rather than at corner joints.</p>
        </body>
      </html>
    `;

    const mockFetch = async (url) => ({
      ok: true,
      status: 200,
      url: 'https://lbl.gov/research/thermal-performance-window-frames',
      headers: {
        get: (h) => (h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null)
      },
      text: async () => mockHtml
    });

    const docResult = await fetchHttpDocument('https://windows.lbl.gov/research/thermal-performance-window-frames', { fetchFn: mockFetch });

    assert.equal(docResult.source_origin, 'LIVE_RETRIEVAL', 'Origin must be LIVE_RETRIEVAL');
    assert.equal(docResult.retrieval_status, 'SOURCE_RETRIEVED_AND_VERIFIED', 'Status must be verified');
    assert.equal(docResult.http_status, 200, 'HTTP status must be 200');
    assert.ok(docResult.raw_content_hash.length === 64, 'Must compute 64-char SHA-256');
    assert.ok(docResult.clean_text.includes('Thermal Performance'), 'Extracted clean text must include heading');
    assert.ok(!docResult.clean_text.includes('<p>'), 'HTML tags must be removed');

    const identity = establishSourceIdentity(docResult.resolved_url);
    assert.equal(identity.authority_level, 'INSTITUTIONAL_OFFICIAL');
    assert.equal(identity.source_classification, 'OFFICIAL_INSTITUTIONAL_GUIDANCE');

    const passages = extractDynamicPassagesFromText('SRC-LBNL-01', 'LBNL Guide', docResult.clean_text);
    assert.ok(passages.length >= 2, 'Must extract dynamic passages from retrieved text');
    pass('Live retrieved HTML candidate is verified and yields valid passages');
  }

  // =========================================================================
  // TEST G: Failed HTTP retrieval => no fixture fallback
  // =========================================================================
  console.log('\n--- TEST G: Failed HTTP retrieval => no fixture fallback ---');
  {
    const mockFetch404 = async (url) => ({
      ok: false,
      status: 404,
      url,
      headers: { get: () => 'text/html' }
    });

    const failedResult = await fetchHttpDocument('https://example.com/nonexistent-standard', { fetchFn: mockFetch404 });

    assert.equal(failedResult.retrieval_status, 'SOURCE_RETRIEVAL_FAILED', 'Must record failure status');
    assert.equal(failedResult.is_blocked, true, 'Must be marked blocked');
    assert.equal(failedResult.clean_text, undefined, 'Must NOT fake body text');
    assert.equal(failedResult.blocked_reason, 'HTTP_ERROR_404', 'Must record exact error code');
    pass('Failed HTTP retrieval records SOURCE_RETRIEVAL_FAILED with zero fixture substitution');
  }

  // =========================================================================
  // TEST H: Missing-category second pass targets only missing research roles
  // =========================================================================
  console.log('\n--- TEST H: Missing-category second pass targets only missing research roles ---');
  {
    const topic = 'Jendela Aluminium Sering Berembun: Masalah Kusen atau Ventilasi?';
    const missing = ['DIFFERENTIAL_DIAGNOSIS', 'LIMITATIONS_AND_FALSE_FIXES'];

    const targetedQueries = generateQuestionSpecificQueries(topic, missing);

    assert.ok(targetedQueries.length >= 2, 'Must generate targeted queries');
    const joined = targetedQueries.join(' ').toLowerCase();

    // Must address differential diagnosis and limitations
    assert.ok(joined.includes('diagnosis') || joined.includes('differential'));
    assert.ok(joined.includes('keterbatasan') || joined.includes('limitations') || joined.includes('false fixes'));

    // Must NOT address categories that were not missing
    assert.ok(!joined.includes('inspeksi ahli kriteria eskalasi'), 'Must not generate escalation query when not missing');
    pass('Gap-directed queries specifically target missing categories');
  }

  // =========================================================================
  // TEST I: Research loop respects hard pass limit (MAX_RESEARCH_PASSES = 2)
  // =========================================================================
  console.log('\n--- TEST I: Research loop respects hard pass limit (MAX_RESEARCH_PASSES = 2) ---');
  {
    // Mock research runtime that discovers sources but never fully covers all categories
    const mockWikiSearch = async (q) => [
      { candidate_id: 'c1', query: q, discovery_engine: 'WIKIPEDIA_TECHNICAL_API', title: 'Window frame' }
    ];
    const mockWikiContent = async (t) => ({
      text: '== Overview ==\nAluminium window frames conduct heat rapidly.\n== Performance ==\nThermal breaks improve insulation.',
      hash: crypto.createHash('sha256').update('test', 'utf8').digest('hex'),
      source_origin: 'LIVE_RETRIEVAL',
      requested_url: 'https://en.wikipedia.org/wiki/Window_frame',
      resolved_url: 'https://en.wikipedia.org/wiki/Window_frame'
    });

    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-LOOP-TEST',
      topic: 'Jendela Aluminium Berembun: Masalah Kusen atau Ventilasi?',
      operatorAuth: { authorizedBy: 'EditorialSupervisor' },
      execution_type: 'TEST'
    }, {
      wikiSearchFn: mockWikiSearch,
      wikiContentFn: mockWikiContent,
      crossRefSearchFn: async () => []
    });

    const gapStartEvents = res.traceEvents.filter(e => e.type === 'RESEARCH_GAP_DIRECTED_PASS_STARTED');
    const gapEndEvents = res.traceEvents.filter(e => e.type === 'RESEARCH_GAP_DIRECTED_PASS_COMPLETED');

    assert.ok(gapStartEvents.length <= 1, 'Gap-directed pass must execute at most once (pass 2 of 2)');
    assert.ok(gapEndEvents.length <= 1, 'Gap-directed pass completion must be at most 1');
    assert.equal(res.status, 'BLOCKED', 'Should halt fail-closed when coverage remains incomplete');
    pass('Research loop bounded by MAX_RESEARCH_PASSES = 2 and halts fail-closed');
  }

  // =========================================================================
  // TEST J: Arbitrary unrelated topic generates dynamic queries without old-domain keywords
  // =========================================================================
  console.log('\n--- TEST J: Arbitrary unrelated topic generates dynamic queries without old-domain keywords ---');
  {
    const novelTopic = 'Pondasi Telapak Amblas pada Tanah Lempung Ekspansif: Identifikasi Daya Dukung dan Solusi Perkuatan';
    const novelQuestions = generateEditorialResearchQuestions(novelTopic);
    const novelQueries = generateQuestionSpecificQueries(novelTopic, ['PLAUSIBLE_CAUSES', 'INTERVENTION_MAPPING']);

    const allGeneratedText = [
      ...novelQuestions.map(q => q.question_text),
      ...novelQueries
    ].join(' ').toLowerCase();

    const bannedOldTerms = [
      'atap metal', 'radiant barrier', 'aluminium foil', 'loteng', 'attic',
      'dinding lembap', 'kapiler semen', 'tembok basah',
      'jendela berembun', 'thermal break', 'lbnl'
    ];

    for (const term of bannedOldTerms) {
      assert.ok(
        !allGeneratedText.includes(term),
        `Generated questions/queries for foundation topic must not contain old domain term "${term}"`
      );
    }
    pass('Arbitrary topic generates domain-appropriate queries with zero legacy prompt leaks');
  }

  // =========================================================================
  // TEST K: One source reused for many claims does not inflate authentic source count
  // =========================================================================
  console.log('\n--- TEST K: One source reused for many claims does not inflate authentic source count ---');
  {
    const singleSource = {
      source_id: 'SRC-LIVE-STANDARDS-01',
      title: 'Building Insulation Standard',
      publisher: 'Standards Body',
      source_classification: 'STANDARDS_PUBLICATION',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      source_origin: 'LIVE_RETRIEVAL',
      is_blocked: false
    };

    // 12 claims pointing to the exact same source
    const claims = Array.from({ length: 12 }, (_, i) => ({
      claim_id: `CLM-${i + 1}`,
      statement: `Technical claim number ${i + 1}`,
      sources: [singleSource]
    }));

    const diversity = calculateSourceDiversity([singleSource], claims);

    assert.equal(diversity.authentic_source_count, 1, 'Must count exactly 1 authentic source');
    assert.equal(diversity.claim_source_relationship_count, 12, 'Must record 12 claim-source relationships');
    assert.equal(diversity.concentration_risk, 'HIGH', 'Single source must trigger HIGH concentration risk');
    pass('Single source referenced by 12 claims does not inflate authentic source count');
  }

  // =========================================================================
  // TEST L: Source diversity metrics correctly distinguish source count from relationships
  // =========================================================================
  console.log('\n--- TEST L: Source diversity metrics distinguish source count from relationships ---');
  {
    const source1 = {
      source_id: 'SRC-1',
      title: 'Journal of Building Physics',
      publisher: 'Academic Press',
      source_classification: 'PRIMARY_RESEARCH_DOCUMENT',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      source_origin: 'LIVE_RETRIEVAL',
      is_blocked: false
    };

    const source2 = {
      source_id: 'SRC-2',
      title: 'Government Moisture Guide',
      publisher: 'Building Authority',
      source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      source_origin: 'LIVE_RETRIEVAL',
      is_blocked: false
    };

    const claims = [
      { claim_id: 'C-1', statement: 'Statement 1', sources: [source1] },
      { claim_id: 'C-2', statement: 'Statement 2', sources: [source1] },
      { claim_id: 'C-3', statement: 'Statement 3', sources: [source2] },
      { claim_id: 'C-4', statement: 'Statement 4', sources: [source1, source2] }
    ];

    const diversity = calculateSourceDiversity([source1, source2], claims);

    assert.equal(diversity.authentic_source_count, 2, 'Authentic source count must be 2');
    assert.equal(diversity.independent_source_count, 2, 'Independent publishers must be 2');
    assert.equal(diversity.source_class_count, 2, 'Source classes must be 2');
    assert.equal(diversity.claim_source_relationship_count, 5, 'Total relationships must be 5 (1+1+1+2)');
    assert.equal(diversity.concentration_risk, 'LOW', '2 diverse classes must yield LOW concentration risk');
    pass('Source diversity metrics cleanly distinguish unique sources from claim edges');
  }

  console.log('\n=================================================================');
  console.log(`ALL ${passed}/12 RESEARCH-SOURCE-COVERAGE-1 TESTS PASSED`);
  console.log('=================================================================');
}

runTests().catch(err => {
  console.error('\nFatal test failure:', err);
  process.exit(1);
});
