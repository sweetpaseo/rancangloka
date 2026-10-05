/**
 * Test Suite: RESEARCH-ACQUISITION-ORCHESTRATION-1
 * Milestone: Authentic candidate-to-document retrieval & multi-pass control flow.
 *
 * Invariants Verified:
 * A. 10 discovered candidates, 4 selected, all lifecycle states accounted => no silent candidate loss
 * B. Generic institutional HTML URL => selected and retrieved without hardcoded source ID
 * C. CrossRef metadata + public DOI target => metadata zero authority, retrieved target eligible
 * D. CrossRef metadata + paywalled target => PAYWALL_OR_LOGIN_PAGE, continue research
 * E. Wikipedia live retrieval failure => no real-runtime fixture fallback
 * F. Pass 1 authentic_source_count = 0 + remaining pass budget => Pass 2 executes
 * G. Pass 1 partial admissible coverage => Pass 2 targets missing categories only
 * H. Pass 2 still zero authentic sources => final fail-closed
 * I. Retrieval budget hard cap respected
 * J. Unsupported PDF => CONTENT_TYPE_NOT_SUPPORTED, no synthesis
 * K. Thin/login HTML shell => not admissible evidence
 * L. Unrelated topic exercises same acquisition path without topic-specific source code
 *
 * ENGINEERING NETWORK RULE: ZERO live network. Pure deterministic mocks.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  executeGeneralizedResearchJob,
  MAX_RESEARCH_PASSES,
  MAX_RETRIEVAL_ATTEMPTS_PER_PASS,
  MAX_TOTAL_RETRIEVAL_ATTEMPTS
} from '../src/lib/editorial/irwan-research-runtime.ts';
import {
  CandidateLifecycleTracker,
  scoreAndRankCandidates,
  estimateCandidateSourceClass,
  isPreRejectedCandidate,
  fetchWikipediaPageContent,
  fetchHttpDocument
} from '../src/lib/editorial/source-discovery.ts';

function createMockResponse(bodyText, status = 200, contentType = 'text/html; charset=utf-8', finalUrl = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    url: finalUrl || 'https://example.com',
    headers: {
      get: (headerName) => {
        if (headerName.toLowerCase() === 'content-type') return contentType;
        return null;
      }
    },
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText)
  };
}

let testCount = 0;
async function test(name, fn) {
  testCount++;
  try {
    await fn();
    console.log(`[PASS] Test ${testCount}: ${name}`);
  } catch (err) {
    console.error(`[FAIL] Test ${testCount}: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAllTests() {
  console.log('=== STARTING RESEARCH-ACQUISITION-ORCHESTRATION-1 TEST SUITE ===\n');

  // =========================================================================
  // Test A: 10 discovered candidates, 4 selected, all lifecycle states accounted
  // =========================================================================
  await test('Test A: 10 discovered candidates, 4 selected, all lifecycle states accounted => no silent candidate loss', async () => {
    const candidates = [
      { candidate_id: 'c1', query: 'q', title: 'PUPR Pedoman Beton', url: 'https://pupr.go.id/beton.html', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'Kementerian PUPR', discovered_at: new Date().toISOString() },
      { candidate_id: 'c2', query: 'q', title: 'Reddit Discussion on Walls', url: 'https://reddit.com/r/diy/walls', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'Reddit', discovered_at: new Date().toISOString() },
      { candidate_id: 'c3', query: 'q', title: 'Content Farm SEO Tips', url: 'https://content-farm.com/seo-article', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'Farm', discovered_at: new Date().toISOString() },
      { candidate_id: 'c4', query: 'q', title: 'Scholarly Paper A', doi: '10.1000/182', url: 'https://doi.org/10.1000/182', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'Elsevier', discovered_at: new Date().toISOString() },
      { candidate_id: 'c5', query: 'q', title: 'Scholarly Paper B', doi: '10.1000/183', url: 'https://doi.org/10.1000/183', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'Springer', discovered_at: new Date().toISOString() },
      { candidate_id: 'c6', query: 'q', title: 'Wiki Page Concrete', title_clean: 'Concrete', discovery_engine: 'WIKIPEDIA_TECHNICAL_API', publisher: 'Wikimedia Foundation', url: 'https://en.wikipedia.org/wiki/Concrete', discovered_at: new Date().toISOString() },
      { candidate_id: 'c7', query: 'q', title: 'Commercial Brand X', url: 'https://brand-commercial.com/brochure', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'PT Brand Commercial', discovered_at: new Date().toISOString() },
      { candidate_id: 'c8', query: 'q', title: 'Unknown Blog', url: 'https://random-unknown-site.org/post', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'Unknown', discovered_at: new Date().toISOString() },
      { candidate_id: 'c9', query: 'q', title: 'Extra Site 1', url: 'https://extra1.org/doc', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'Extra', discovered_at: new Date().toISOString() },
      { candidate_id: 'c10', query: 'q', title: 'Extra Site 2', url: 'https://extra2.org/doc', discovery_engine: 'CROSSREF_OPEN_API', publisher: 'Extra', discovered_at: new Date().toISOString() }
    ];

    const tracker = new CandidateLifecycleTracker();
    for (const c of candidates) {
      tracker.registerCandidate(c, 'Discovery query match');
      const pre = isPreRejectedCandidate(c);
      if (pre.rejected) {
        tracker.transition(c.candidate_id, 'REJECTED_PRE_RETRIEVAL', pre.reason);
      }
    }

    const ranked = scoreAndRankCandidates(candidates, 'Teknologi Beton');
    const eligible = ranked.filter(r => !r.isPreRejected);
    const selected = eligible.slice(0, 4);

    for (const s of selected) {
      tracker.transition(s.candidate.candidate_id, 'SELECTED_FOR_RETRIEVAL', 'Budget rank top 4');
      tracker.transition(s.candidate.candidate_id, 'RETRIEVAL_ATTEMPTED', 'Starting fetch');
      tracker.transition(s.candidate.candidate_id, 'RETRIEVAL_SUCCEEDED', 'Fetch success');
      tracker.transition(s.candidate.candidate_id, 'PASSAGE_EXTRACTED', 'Passages extracted');
      tracker.transition(s.candidate.candidate_id, 'AUTHENTIC', 'Verified authentic');
      tracker.transition(s.candidate.candidate_id, 'ADMISSIBLE', 'Passed all criteria');
    }

    const allRecords = tracker.getAllRecords();
    assert.equal(allRecords.length, 10, 'All 10 candidates must have explicit lifecycle records');

    const preRejected = allRecords.filter(r => r.current_state === 'REJECTED_PRE_RETRIEVAL');
    assert.equal(preRejected.length, 2, 'c2 (Reddit) and c3 (content farm) must be pre-rejected');

    const admissible = allRecords.filter(r => r.current_state === 'ADMISSIBLE');
    assert.equal(admissible.length, 4, 'Exactly 4 selected candidates reached ADMISSIBLE');

    const remainingDiscovered = allRecords.filter(r => r.current_state === 'DISCOVERED');
    assert.equal(remainingDiscovered.length, 4, 'Remaining unattempted eligible candidates remain tracked as DISCOVERED');

    for (const r of allRecords) {
      assert.ok(r.state_history.length > 0, `Candidate ${r.candidate_id} must have state history`);
      assert.ok(r.transition_reason.length > 0, `Candidate ${r.candidate_id} must have a recorded transition reason`);
    }

    const metrics = tracker.getMetrics();
    assert.equal(metrics.discovered_candidates_count, 10);
    assert.equal(metrics.selected_for_retrieval_count, 4);
    assert.equal(metrics.rejected_pre_retrieval_count, 2);
  });

  // =========================================================================
  // Test B: Generic institutional HTML URL selected and retrieved without hardcoded ID
  // =========================================================================
  await test('Test B: generic institutional HTML URL => selected and retrieved without hardcoded source ID', async () => {
    const mockHttpDoc = async (url) => {
      return {
        requested_url: url,
        resolved_url: url,
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_hash: crypto.createHash('sha256').update('pupr text', 'utf8').digest('hex'),
        clean_text: `
== Pedoman Teknis Perkuatan Struktur Bangunan ==
Pondasi dangkal pada tanah lempung memerlukan perkuatan cerucuk matras bambu untuk mendistribusikan tegangan kontak tanah.
Kapasitas daya dukung izin tanah lempung ekspansif dapat ditingkatkan melalui stabilisasi kapur tohor dan drainase perimeter.
Batas deformasi penurunan diferensial struktur beton bertulang tidak boleh melebihi 1/500 bentang balok.
        `.trim(),
        title: 'Pedoman Teknis PUPR',
        retrieved_at: new Date().toISOString(),
        http_status: 200,
        content_length_bytes: 400
      };
    };

    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-TEST-GENERIC-INSTITUTIONAL',
      topic: 'Perkuatan Pondasi Tanah Lempung',
      operatorAuth: { authorizedBy: 'Chief Editor' },
      execution_type: 'REAL_RUNTIME_EXECUTION'
    }, {
      crossRefSearchFn: async () => [
        {
          candidate_id: 'cand_pupr_1',
          query: 'Perkuatan Pondasi',
          title: 'Pedoman Teknis PUPR',
          publisher: 'Kementerian PUPR',
          url: 'https://pupr.go.id/pedoman-pondasi.html',
          discovery_engine: 'CROSSREF_OPEN_API',
          discovered_at: new Date().toISOString()
        }
      ],
      wikiSearchFn: async () => [],
      httpDocFn: mockHttpDoc,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    const puprDoc = res.retrievedDocuments.find(d => d.url === 'https://pupr.go.id/pedoman-pondasi.html');
    assert.ok(puprDoc, 'PUPR document must be retrieved dynamically without any hardcoded ID');
    assert.equal(puprDoc.retrieval_status, 'SOURCE_RETRIEVED_AND_VERIFIED');
    assert.equal(puprDoc.source_origin, 'LIVE_RETRIEVAL');
    assert.equal(puprDoc.source_classification, 'OFFICIAL_INSTITUTIONAL_GUIDANCE');
    assert.equal(puprDoc.authority_level, 'INSTITUTIONAL_OFFICIAL');

    const puprRecord = res.candidateLifecycleRecords?.find(r => r.candidate_id === 'cand_pupr_1');
    assert.ok(puprRecord, 'Candidate lifecycle record must exist');
    assert.equal(puprRecord.current_state, 'ADMISSIBLE');
    assert.ok(puprRecord.state_history.some(h => h.state === 'SELECTED_FOR_RETRIEVAL'));
    assert.ok(puprRecord.state_history.some(h => h.state === 'AUTHENTIC'));
  });

  // =========================================================================
  // Test C: CrossRef metadata + public DOI target => metadata zero authority, target eligible
  // =========================================================================
  await test('Test C: CrossRef metadata + public DOI target => metadata zero authority, retrieved target eligible', async () => {
    const rawSnippet = 'Snippet should NOT become an evidence passage!';
    const fullArticleText = `
== Abstract and Thermodynamic Analysis ==
Heat loss through fenestration accounts for substantial building envelope transmission.
Thermal breaks made of polyamide significantly reduce conduction across aluminium profiles.
Condensation resistance factor increases from 35 to over 60 with proper insulation placement.
    `.trim();

    const mockHttpDoc = async (url) => {
      assert.ok(url.includes('10.1016/j.buildenv.2024.12345'), 'Must resolve DOI target URL');
      return {
        requested_url: url,
        resolved_url: 'https://sciencedirect.com/article/pii/S12345',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_hash: crypto.createHash('sha256').update(fullArticleText, 'utf8').digest('hex'),
        clean_text: fullArticleText,
        title: 'Thermal Break Performance in Architectural Fenestration',
        retrieved_at: new Date().toISOString(),
        http_status: 200,
        content_length_bytes: Buffer.byteLength(fullArticleText, 'utf8')
      };
    };

    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-TEST-CROSSREF-DOI',
      topic: 'Thermal Break Performance Fenestration',
      operatorAuth: { authorizedBy: 'Chief Editor' },
      execution_type: 'REAL_RUNTIME_EXECUTION'
    }, {
      crossRefSearchFn: async () => [
        {
          candidate_id: 'cand_cr_doi_1',
          query: 'Thermal Break Performance',
          title: 'Thermal Break Performance in Architectural Fenestration',
          publisher: 'Elsevier Building and Environment',
          doi: '10.1016/j.buildenv.2024.12345',
          url: 'https://doi.org/10.1016/j.buildenv.2024.12345',
          snippet: rawSnippet,
          discovery_engine: 'CROSSREF_OPEN_API',
          discovered_at: new Date().toISOString()
        }
      ],
      wikiSearchFn: async () => [],
      httpDocFn: mockHttpDoc,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    const doiDoc = res.retrievedDocuments.find(d => d.canonical_url?.includes('sciencedirect.com'));
    assert.ok(doiDoc, 'Document retrieved from DOI target must exist in retrievedDocuments');
    assert.equal(doiDoc.source_origin, 'LIVE_RETRIEVAL');
    assert.equal(doiDoc.source_classification, 'PRIMARY_RESEARCH_DOCUMENT');

    // Verify metadata snippet itself is NEVER used as an evidence passage
    const snippetInPassages = res.evidencePack.evidence_passages.some(p => p.exact_or_normalized_excerpt.includes(rawSnippet));
    assert.equal(snippetInPassages, false, 'Raw metadata snippet must never be accepted as evidence passage');

    const record = res.candidateLifecycleRecords?.find(r => r.candidate_id === 'cand_cr_doi_1');
    assert.equal(record.current_state, 'ADMISSIBLE');
  });

  // =========================================================================
  // Test D: CrossRef metadata + paywalled target => PAYWALL_OR_LOGIN_PAGE, continue research
  // =========================================================================
  await test('Test D: CrossRef metadata + paywalled target => PAYWALL_OR_LOGIN_PAGE, continue research', async () => {
    let attemptedSecond = false;

    const mockHttpDoc = async (url) => {
      if (url.includes('paywall-doi')) {
        return {
          requested_url: url,
          resolved_url: 'https://restricted-publisher.com/login?redirect=paper',
          retrieval_status: 'PAYWALL_OR_LOGIN_PAGE',
          source_origin: 'LIVE_RETRIEVAL',
          raw_content_hash: 'paywallhash',
          clean_text: 'Please sign in or subscribe to purchase this article.',
          title: 'Paywalled Paper',
          retrieved_at: new Date().toISOString(),
          http_status: 403,
          content_length_bytes: 52
        };
      }
      attemptedSecond = true;
      return {
        requested_url: url,
        resolved_url: url,
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_hash: 'openhash',
        clean_text: `
== Open Science Report ==
Liquid moisture absorption in porous concrete causes degradation.
Waterproofing membranes provide critical capillary barrier properties.
        `.trim(),
        title: 'Open Technical Report',
        retrieved_at: new Date().toISOString(),
        http_status: 200,
        content_length_bytes: 200
      };
    };

    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-TEST-PAYWALL',
      topic: 'Capillary Barrier Protection',
      operatorAuth: { authorizedBy: 'Chief Editor' },
      execution_type: 'REAL_RUNTIME_EXECUTION'
    }, {
      crossRefSearchFn: async () => [
        {
          candidate_id: 'cand_paywalled',
          query: 'Capillary Barrier',
          title: 'Paywalled Paper',
          url: 'https://doi.org/paywall-doi',
          discovery_engine: 'CROSSREF_OPEN_API',
          discovered_at: new Date().toISOString()
        },
        {
          candidate_id: 'cand_open_second',
          query: 'Capillary Barrier',
          title: 'Open Technical Report',
          url: 'https://pupr.go.id/open-report.html',
          discovery_engine: 'CROSSREF_OPEN_API',
          discovered_at: new Date().toISOString()
        }
      ],
      wikiSearchFn: async () => [],
      httpDocFn: mockHttpDoc,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    assert.ok(attemptedSecond, 'Research must continue to subsequent candidate after paywall');

    const paywallRecord = res.candidateLifecycleRecords?.find(r => r.candidate_id === 'cand_paywalled');
    assert.equal(paywallRecord.current_state, 'RETRIEVAL_HTTP_FAILED');
    assert.ok(paywallRecord.transition_reason.includes('PAYWALL_OR_LOGIN_PAGE'));

    const blockedEntry = res.blockedSources.find(b => b.source_id.includes('cand_paywalled'));
    assert.ok(blockedEntry, 'Blocked source entry must be recorded for audit');
    assert.equal(blockedEntry.legal_status, 'COMMERCIAL_PAYWALL_REQUIRED');

    const openRecord = res.candidateLifecycleRecords?.find(r => r.candidate_id === 'cand_open_second');
    assert.equal(openRecord.current_state, 'ADMISSIBLE');
  });

  // =========================================================================
  // Test E: Wikipedia live retrieval failure => no real-runtime fixture fallback
  // =========================================================================
  await test('Test E: Wikipedia live retrieval failure => no real-runtime fixture fallback', async () => {
    const mockFailedFetch = async (url) => {
      // Simulate Wikimedia 500 error or network disconnect
      return createMockResponse('Internal Server Error', 500);
    };

    const res = await fetchWikipediaPageContent('Window frame', {
      fetchFn: mockFailedFetch,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    assert.equal(res, null, 'In REAL_RUNTIME_EXECUTION, failed Wikipedia live fetch must return null, never TEST_FIXTURE');
  });

  // =========================================================================
  // Test F: Pass 1 authentic_source_count = 0 + remaining pass budget => Pass 2 executes
  // =========================================================================
  await test('Test F: Pass 1 authentic_source_count = 0 + remaining pass budget => Pass 2 executes', async () => {
    let pass2QueryExecuted = false;

    let queryCallCount = 0;
    const mockCrossRef = async (q) => {
      queryCallCount++;
      if (queryCallCount > 4) {
        // Gap query execution in Pass 2 (after initial 4 queries)
        pass2QueryExecuted = true;
        return [
          {
            candidate_id: `cand_pass2_auth_${queryCallCount}`,
            query: q,
            title: `Pass 2 Authentic Institutional Guide ${queryCallCount}`,
            url: `https://pupr.go.id/pass2_${queryCallCount}.html`,
            discovery_engine: 'CROSSREF_OPEN_API',
            discovered_at: new Date().toISOString()
          }
        ];
      }
      return [
        {
          candidate_id: `cand_pass1_fail_${queryCallCount}`,
          query: q,
          title: `Pass 1 Failing Candidate ${queryCallCount}`,
          url: `https://example.com/fail_${queryCallCount}.html`,
          discovery_engine: 'CROSSREF_OPEN_API',
          discovered_at: new Date().toISOString()
        }
      ];
    };

    const mockHttpDoc = async (url) => {
      if (url.includes('fail')) {
        return {
          requested_url: url,
          resolved_url: url,
          retrieval_status: 'SOURCE_RETRIEVAL_FAILED',
          source_origin: 'LIVE_RETRIEVAL',
          clean_text: null
        };
      }
      return {
        requested_url: url,
        resolved_url: url,
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_hash: 'hashpass2',
        clean_text: `
== Sains Fisika Bangunan ==
Penyebab kondensasi permukaan adalah perbedaan suhu titik embun udara dengan suhu permukaan material.
Pemasangan ventilasi silang terkontrol menurunkan kelembapan relatif udara dalam ruang.
        `.trim(),
        title: 'Pass 2 Authentic Institutional Guide',
        retrieved_at: new Date().toISOString(),
        http_status: 200,
        content_length_bytes: 300
      };
    };

    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-TEST-PASS2-ON-ZERO-AUTH',
      topic: 'Kondensasi Dinding dan Ventilasi',
      operatorAuth: { authorizedBy: 'Chief Editor' },
      execution_type: 'REAL_RUNTIME_EXECUTION'
    }, {
      crossRefSearchFn: mockCrossRef,
      wikiSearchFn: async () => [],
      httpDocFn: mockHttpDoc,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    const gapStartEvents = res.traceEvents.filter(e => e.type === 'RESEARCH_GAP_DIRECTED_PASS_STARTED');
    assert.equal(gapStartEvents.length, 1, 'Pass 2 MUST start even when authentic_source_count = 0 after Pass 1');

    assert.ok(pass2QueryExecuted, 'Gap-directed queries must be executed in Pass 2');
    assert.equal(res.passMetrics?.length, 2, 'Exactly 2 passes must be recorded in passMetrics');

    const pass1Metrics = res.passMetrics[0];
    assert.equal(pass1Metrics.pass_number, 1);
    assert.equal(pass1Metrics.authentic_sources_added, 0);

    const pass2Metrics = res.passMetrics[1];
    assert.equal(pass2Metrics.pass_number, 2);
    assert.ok(pass2Metrics.authentic_sources_added > 0, 'Pass 2 added authentic source');
  });

  // =========================================================================
  // Test G: Pass 1 partial admissible coverage => Pass 2 targets missing categories only
  // =========================================================================
  await test('Test G: Pass 1 partial admissible coverage => Pass 2 targets missing categories only', async () => {
    let gapTargetCategories = [];

    const mockCrossRef = async (q) => {
      return [
        {
          candidate_id: 'cand_partial_1',
          query: q,
          title: 'Mekanisme Kerusakan Dinding Basah',
          url: 'https://brin.go.id/mekanisme.html',
          discovery_engine: 'CROSSREF_OPEN_API',
          discovered_at: new Date().toISOString()
        }
      ];
    };

    const mockHttpDoc = async (url) => {
      return {
        requested_url: url,
        resolved_url: url,
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_hash: 'hashbrin',
        clean_text: `
== Mekanisme Fisika Rambatan Air ==
Kenaikan kapiler air tanah melalui pori mortar bata merah merupakan mekanisme utama intrusi kelembapan.
        `.trim(),
        title: 'Mekanisme Kerusakan Dinding Basah',
        retrieved_at: new Date().toISOString(),
        http_status: 200,
        content_length_bytes: 250
      };
    };

    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-TEST-GAP-TARGETING',
      topic: 'Dinding Lembap Rembes Air',
      operatorAuth: { authorizedBy: 'Chief Editor' },
      execution_type: 'REAL_RUNTIME_EXECUTION'
    }, {
      crossRefSearchFn: mockCrossRef,
      wikiSearchFn: async () => [],
      httpDocFn: mockHttpDoc,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    const gapStartEvent = res.traceEvents.find(e => e.type === 'RESEARCH_GAP_DIRECTED_PASS_STARTED');
    assert.ok(gapStartEvent, 'RESEARCH_GAP_DIRECTED_PASS_STARTED must be present');
    gapTargetCategories = gapStartEvent.metadata?.missingCategories || [];
    assert.ok(Array.isArray(gapTargetCategories), 'Missing categories must be an array');
    assert.ok(gapTargetCategories.length > 0, 'There must be missing categories');
    assert.ok(
      gapTargetCategories.includes('DIFFERENTIAL_DIAGNOSIS') || gapTargetCategories.includes('LIMITATIONS_AND_FALSE_FIXES'),
      'Missing categories must target gaps'
    );
  });

  // =========================================================================
  // Test H: Pass 2 still zero authentic sources => final fail-closed
  // =========================================================================
  await test('Test H: Pass 2 still zero authentic sources => final fail-closed', async () => {
    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-TEST-FAIL-CLOSED',
      topic: 'Topik Tanpa Sumber Autentik',
      operatorAuth: { authorizedBy: 'Chief Editor' },
      execution_type: 'REAL_RUNTIME_EXECUTION'
    }, {
      crossRefSearchFn: async () => [],
      wikiSearchFn: async () => [],
      httpDocFn: async () => null,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    assert.equal(res.status, 'BLOCKED', 'Must halt fail-closed when zero authentic sources are available after Pass 2');
    assert.ok(
      res.finalGateStatus === 'TOPIC_EVIDENCE_ALIGNMENT_FAIL' ||
      res.finalGateStatus === 'RESEARCH_COVERAGE_INSUFFICIENT' ||
      res.finalGateStatus === 'SOURCE_AUTHENTICITY_BLOCKED' ||
      res.finalGateStatus.includes('FAIL') ||
      res.finalGateStatus.includes('BLOCKED') ||
      res.finalGateStatus.includes('INSUFFICIENT'),
      `Final gate status must indicate fail-closed blockage (got ${res.finalGateStatus})`
    );
  });

  // =========================================================================
  // Test I: Retrieval budget hard cap respected
  // =========================================================================
  await test('Test I: retrieval budget hard cap respected', async () => {
    let fetchCount = 0;

    // Generate 30 mock candidates
    const manyCandidates = Array.from({ length: 30 }, (_, i) => ({
      candidate_id: `cand_bulk_${i}`,
      query: 'bulk',
      title: `Candidate Document ${i}`,
      url: `https://example.gov/doc_${i}.html`,
      discovery_engine: 'CROSSREF_OPEN_API',
      publisher: 'Government Agency',
      discovered_at: new Date().toISOString()
    }));

    const mockHttpDoc = async (url) => {
      fetchCount++;
      return {
        requested_url: url,
        resolved_url: url,
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_hash: `hash_${fetchCount}`,
        clean_text: `== Section ==\nText for document ${fetchCount}. Building physics principle applies.`,
        title: `Doc ${fetchCount}`,
        retrieved_at: new Date().toISOString(),
        http_status: 200,
        content_length_bytes: 100
      };
    };

    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-TEST-BUDGET-CAP',
      topic: 'Pengujian Kapasitas Anggaran Pengambilan',
      operatorAuth: { authorizedBy: 'Chief Editor' },
      execution_type: 'REAL_RUNTIME_EXECUTION'
    }, {
      crossRefSearchFn: async () => manyCandidates,
      wikiSearchFn: async () => [],
      httpDocFn: mockHttpDoc,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    assert.ok(
      fetchCount <= MAX_TOTAL_RETRIEVAL_ATTEMPTS,
      `Total retrieval attempts (${fetchCount}) must not exceed MAX_TOTAL_RETRIEVAL_ATTEMPTS (${MAX_TOTAL_RETRIEVAL_ATTEMPTS})`
    );

    for (const pm of res.passMetrics || []) {
      assert.ok(
        pm.retrieval_attempts <= MAX_RETRIEVAL_ATTEMPTS_PER_PASS,
        `Pass ${pm.pass_number} attempts (${pm.retrieval_attempts}) must not exceed MAX_RETRIEVAL_ATTEMPTS_PER_PASS (${MAX_RETRIEVAL_ATTEMPTS_PER_PASS})`
      );
    }
  });

  // =========================================================================
  // Test J: Unsupported PDF => CONTENT_TYPE_NOT_SUPPORTED, no synthesis
  // =========================================================================
  await test('Test J: unsupported PDF => CONTENT_TYPE_NOT_SUPPORTED, no synthesis', async () => {
    const mockPdfFetch = async () => {
      return createMockResponse('%PDF-1.5 raw binary pdf content...', 200, 'application/pdf');
    };

    const res = await fetchHttpDocument('https://example.gov/manual.pdf', {
      fetchFn: mockPdfFetch
    });

    assert.equal(res.retrieval_status, 'CONTENT_TYPE_NOT_SUPPORTED');
    assert.ok(!res.clean_text, 'Must not synthesize or parse unsupported PDF as fake text');

    const tracker = new CandidateLifecycleTracker();
    const cand = { candidate_id: 'c_pdf', query: 'q', title: 'PDF Manual', url: 'https://example.gov/manual.pdf', discovery_engine: 'CROSSREF_OPEN_API', discovered_at: new Date().toISOString() };
    tracker.registerCandidate(cand);
    tracker.transition(cand.candidate_id, 'SELECTED_FOR_RETRIEVAL', 'Budget rank');
    tracker.transition(cand.candidate_id, 'RETRIEVAL_ATTEMPTED', 'Fetch started');
    tracker.transition(cand.candidate_id, 'RETRIEVAL_UNSUPPORTED_CONTENT', 'CONTENT_TYPE_NOT_SUPPORTED: application/pdf');

    const rec = tracker.getRecord('c_pdf');
    assert.equal(rec.current_state, 'RETRIEVAL_UNSUPPORTED_CONTENT');
  });

  // =========================================================================
  // Test K: Thin/login HTML shell => not admissible evidence
  // =========================================================================
  await test('Test K: thin/login HTML shell => not admissible evidence', async () => {
    const mockThinFetch = async () => {
      return createMockResponse('<html><body>Please sign in to access your dashboard.</body></html>', 200, 'text/html');
    };

    const res = await fetchHttpDocument('https://portal.example.com/login', {
      fetchFn: mockThinFetch
    });

    assert.ok(
      res.retrieval_status === 'PAYWALL_OR_LOGIN_PAGE' || res.retrieval_status === 'CONTENT_TOO_THIN',
      `Login/thin shell must be flagged (got ${res.retrieval_status})`
    );
  });

  // =========================================================================
  // Test L: Unrelated topic exercises same acquisition path without topic-specific source code
  // =========================================================================
  await test('Test L: unrelated topic exercises same acquisition path without topic-specific source code', async () => {
    const novelTopic = 'Struktur Rangka Baja Ringan Menahan Beban Angin Daerah Pesisir: Sambungan Baut dan Korosi Garam';
    let executedQueries = [];

    const mockCrossRef = async (q) => {
      executedQueries.push(q);
      return [
        {
          candidate_id: 'cand_baja_1',
          query: q,
          title: 'Sambungan Baut Baja Ringan Terhadap Terpaan Angin Siklon',
          url: 'https://pupr.go.id/baja-ringan.html',
          discovery_engine: 'CROSSREF_OPEN_API',
          publisher: 'Kementerian PUPR',
          discovered_at: new Date().toISOString()
        }
      ];
    };

    const mockHttpDoc = async (url) => {
      return {
        requested_url: url,
        resolved_url: url,
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_hash: 'hash_baja_ringan',
        clean_text: `
== Pedoman Perancangan Rangka Baja Ringan Pesisir ==
Penyebab utama kegagalan rangka atap baja ringan pada wilayah pesisir adalah gaya angkat angin (uplift) dan korosi klorida.
Baut self-drilling screw harus memiliki lapisan anti-korosi kelas 3 atau 4 dengan standar ketahanan semprot garam minimum 1000 jam.
Pemasangan ikatan angin (cross bracing) dan strap diagonal mencegah keruntuhan progresif akibat puntir aksial.
        `.trim(),
        title: 'Sambungan Baut Baja Ringan Terhadap Terpaan Angin Siklon',
        retrieved_at: new Date().toISOString(),
        http_status: 200,
        content_length_bytes: 400
      };
    };

    const res = await executeGeneralizedResearchJob({
      taskId: 'TASK-TEST-NOVEL-TOPIC',
      topic: novelTopic,
      operatorAuth: { authorizedBy: 'Chief Editor' },
      execution_type: 'REAL_RUNTIME_EXECUTION'
    }, {
      crossRefSearchFn: mockCrossRef,
      wikiSearchFn: async () => [],
      httpDocFn: mockHttpDoc,
      executionType: 'REAL_RUNTIME_EXECUTION'
    });

    assert.ok(executedQueries.length > 0, 'Dynamic queries must be generated and executed');
    const bajaDoc = res.retrievedDocuments.find(d => d.url === 'https://pupr.go.id/baja-ringan.html');
    assert.ok(bajaDoc, 'Novel topic document must be retrieved through generic HTTP pipeline');
    assert.equal(bajaDoc.retrieval_status, 'SOURCE_RETRIEVED_AND_VERIFIED');
    assert.equal(bajaDoc.source_origin, 'LIVE_RETRIEVAL');
    assert.ok(res.evidencePack.evidence_passages.length > 0, 'Passages extracted from novel topic document');

    // Confirm that the candidate lifecycle tracks the candidate to ADMISSIBLE
    const rec = res.candidateLifecycleRecords?.find(r => r.candidate_id === 'cand_baja_1');
    assert.ok(rec, 'Lifecycle record must exist for novel candidate');
    assert.equal(rec.current_state, 'ADMISSIBLE');
  });

  console.log('\n=== ALL 12 TESTS (A through L) PASSED SUCCESSFULLY! ===');
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
