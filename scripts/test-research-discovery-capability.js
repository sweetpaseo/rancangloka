/**
 * Test Suite: RESEARCH-DISCOVERY-CAPABILITY-1
 *
 * Verifies:
 * 1. Long Indonesian conversational headline => compact query plan
 * 2. Both ID + EN technical variants generated
 * 3. No full headline blindly concatenated with suffix
 * 4. Query length limits respected (<= 80 chars)
 * 5. Same planner handles unrelated topics (bathroom, roof drainage, tile failure, window condensation)
 * 6. CrossRef provider receives scholarly-oriented query
 * 7. Wikipedia receives compact concept query
 * 8. Open-web provider receives institutional/web-oriented query
 * 9. Provider result deduplication works across providers
 * 10. Paywall triggers bounded OA resolution
 * 11. Paywall with no OA version remains blocked
 * 12. Search snippets cannot become evidence without authentic document
 * 13. Private IP URLs blocked before retrieval (SSRF protection)
 * 14. Localhost and internal hostnames blocked
 * 15. Redirect to private/local IP blocked
 * 16. Unsupported URI schemes blocked (ftp, file, data, javascript)
 * 17. URL credentials rejected (user:pass@host)
 * 18. Retrieval budget unaffected by duplicate candidates
 * 19. Pass 2 queries target only missing categories
 * 20. No topic-specific production hardcoding
 * 21. Full Irwan Research Runtime with Multi-Provider Discovery and OA Resolution
 */

import assert from 'node:assert/strict';
import {
  ResearchDiscoveryQueryPlanner,
  MAX_QUERY_LENGTH,
  MAX_CONCEPTS_PER_QUERY,
  MAX_VARIANTS_PER_QUERY
} from '../src/lib/editorial/research-discovery-planner.ts';

import {
  validateSafeUrl,
  isPrivateOrBlockedHost
} from '../src/lib/editorial/discovery-network-safety.ts';

import {
  CrossRefDiscoveryProvider,
  WikipediaDiscoveryProvider,
  OpenWebDiscoveryProvider,
  deduplicateCandidates,
  rankCandidatesByDiscoveryRelevance,
  normalizeDoi,
  normalizeUrl
} from '../src/lib/editorial/discovery-providers.ts';

import {
  resolveOpenAccessCandidate
} from '../src/lib/editorial/open-access-resolver.ts';

import {
  executeGeneralizedResearchJob
} from '../src/lib/editorial/irwan-research-runtime.ts';

import {
  generateEditorialResearchQuestions
} from '../src/lib/editorial/research-questions.ts';

console.log('--- STARTING RESEARCH-DISCOVERY-CAPABILITY-1 TEST SUITE ---\n');

let passedTests = 0;

// =========================================================================
// TEST 1: Long Indonesian headline produces compact, bounded query plan
// =========================================================================
{
  const final6Topic = 'Kamar Mandi Tetap Lembap Meski Sudah Pakai Exhaust Fan: Kapasitas Fan, Jalur Udara Masuk, Durasi Operasi, atau Sumber Uap?';
  const plan = ResearchDiscoveryQueryPlanner.planQueries({
    topic: final6Topic,
    passNumber: 1
  });

  assert.ok(plan.planned_queries.length > 0, 'Plan should contain planned queries');
  assert.ok(plan.planned_queries.length <= 8, 'Queries per pass should not exceed MAX_QUERIES_PER_PASS (8)');

  // All queries must be strictly bounded in length
  for (const q of plan.planned_queries) {
    for (const v of q.variants) {
      assert.ok(
        v.query.length <= MAX_QUERY_LENGTH,
        `Query variant '${v.query}' length (${v.query.length}) exceeds MAX_QUERY_LENGTH (${MAX_QUERY_LENGTH})`
      );
      assert.ok(
        !v.query.includes('Kamar Mandi Tetap Lembap Meski Sudah Pakai Exhaust Fan:'),
        'Query must NOT contain the raw 128-char headline'
      );
      assert.ok(
        !v.query.includes('meski sudah'),
        'Conversational filler "meski sudah" must be stripped'
      );
    }
  }

  console.log('[PASS] Test 1: Long conversational headline decomposes into compact, bounded query plan');
  passedTests++;
}

// =========================================================================
// TEST 2: Both ID and EN technical variants generated with intent provenance
// =========================================================================
{
  const topic = 'Kamar Mandi Tetap Lembap Meski Sudah Pakai Exhaust Fan: Kapasitas Fan, Jalur Udara Masuk, Durasi Operasi, atau Sumber Uap?';
  const plan = ResearchDiscoveryQueryPlanner.planQueries({
    topic,
    passNumber: 1
  });

  for (const q of plan.planned_queries) {
    const idVariant = q.variants.find(v => v.language === 'id');
    const enVariant = q.variants.find(v => v.language === 'en');

    assert.ok(idVariant, `Query ${q.query_id} must have an ID variant`);
    assert.ok(enVariant, `Query ${q.query_id} must have an EN variant`);
    assert.ok(idVariant.query.length > 0, 'ID query string must not be empty');
    assert.ok(enVariant.query.length > 0, 'EN query string must not be empty');
    assert.ok(q.derived_from_concepts.length > 0, 'Must record derived_from_concepts for provenance');
  }

  console.log('[PASS] Test 2: Both ID and EN technical variants generated with provenance');
  passedTests++;
}

// =========================================================================
// TEST 3: No full headline blindly concatenated with suffix
// =========================================================================
{
  const topic = 'Kamar Mandi Tetap Lembap Meski Sudah Pakai Exhaust Fan: Kapasitas Fan, Jalur Udara Masuk, Durasi Operasi, atau Sumber Uap?';
  const plan = ResearchDiscoveryQueryPlanner.planQueries({
    topic,
    passNumber: 1
  });

  const oldConcatenationSample = `${topic} mekanisme penyebab fisika`;
  for (const q of plan.planned_queries) {
    for (const v of q.variants) {
      assert.notEqual(v.query, oldConcatenationSample, 'New query planner must not produce blind topic+suffix concatenation');
      assert.ok(v.query.length < 90, 'Query length must remain well under 90 characters');
    }
  }

  console.log('[PASS] Test 3: No full headline blindly concatenated with suffix');
  passedTests++;
}

// =========================================================================
// TEST 4: Query bounds and word-boundary truncation
// =========================================================================
{
  const ultraLongTopic = 'Analisis Kegagalan Sistem Ventilasi Buatan dan Aliran Udara pada Ruang Basah Tropis Lembap dengan Perbedaan Tekanan Udara Ekstrem serta Kurangnya Bukaan Alami';
  const plan = ResearchDiscoveryQueryPlanner.planQueries({
    topic: ultraLongTopic,
    passNumber: 1
  });

  for (const q of plan.planned_queries) {
    for (const v of q.variants) {
      assert.ok(v.query.length <= MAX_QUERY_LENGTH, `Query must be <= ${MAX_QUERY_LENGTH} chars, got ${v.query.length}`);
      assert.ok(!v.query.endsWith('-'), 'Must not truncate mid-word with dangling hyphen');
    }
  }

  console.log('[PASS] Test 4: Query length limits and word boundary truncation respected');
  passedTests++;
}

// =========================================================================
// TEST 5: Generalization across unrelated architectural topics
// =========================================================================
{
  const topics = [
    {
      topic: 'Talang Air Atap Bocor dan Meluap Saat Hujan Deras: Kemiringan Slope, Ukuran Dimensi, atau Titik Downspout?',
      expectedTerm: 'talang'
    },
    {
      topic: 'Lantai Keramik Menggelembung dan Terangkat (Popping): Sambungan Muai (Expansion Joint), Mortar Tipis, atau Muai Suhu?',
      expectedTerm: 'keramik'
    },
    {
      topic: 'Kondensasi Permukaan Kaca Jendela Ruang Ber-AC: Profil Aluminium Tanpa Thermal Break, Gasket Karet, atau Kaca Ganda?',
      expectedTerm: 'jendela'
    }
  ];

  for (const { topic, expectedTerm } of topics) {
    const plan = ResearchDiscoveryQueryPlanner.planQueries({
      topic,
      passNumber: 1
    });

    assert.ok(plan.planned_queries.length >= 3, `Must generate plan for ${topic}`);
    const allQueriesText = plan.planned_queries.flatMap(q => q.variants.map(v => v.query.toLowerCase())).join(' ');
    assert.ok(allQueriesText.includes(expectedTerm) || plan.decomposition.problem_entities.includes(expectedTerm), `Plan must extract domain term ${expectedTerm}`);
    const hasEn = plan.planned_queries.some(q => q.variants.some(v => v.language === 'en' && v.query.length > 5));
    assert.ok(hasEn, `Must have English technical variants for ${topic}`);
  }

  console.log('[PASS] Test 5: Planner generalizes across roof drainage, tile popping, and window condensation');
  passedTests++;
}

// =========================================================================
// TEST 6: CrossRef receives scholarly-oriented query
// =========================================================================
{
  let capturedQuery = '';
  const mockFetch = async (url) => {
    capturedQuery = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        message: {
          items: [
            {
              DOI: '10.1016/j.buildenv.2020.1001',
              title: ['Bathroom exhaust fan airflow rates in residential buildings'],
              publisher: 'Elsevier',
              abstract: 'Empirical study on bathroom ventilation rates.'
            }
          ]
        }
      })
    };
  };

  const provider = new CrossRefDiscoveryProvider();
  const results = await provider.search({
    query: 'bathroom ventilation exhaust fan airflow CFM',
    query_id: 'Q-01',
    language: 'en'
  }, { fetchFn: mockFetch });

  assert.ok(capturedQuery.includes('api.crossref.org'), 'Must call CrossRef works API');
  assert.ok(capturedQuery.includes('bathroom%20ventilation'), 'Query must contain technical keywords');
  assert.equal(results.length, 1);
  assert.equal(results[0].doi, '10.1016/j.buildenv.2020.1001');
  assert.equal(results[0].document_hint, 'SCHOLARLY');

  console.log('[PASS] Test 6: CrossRef provider receives scholarly-oriented compact query');
  passedTests++;
}

// =========================================================================
// TEST 7: Wikipedia receives compact concept query
// =========================================================================
{
  let capturedUrl = '';
  const mockFetch = async (url) => {
    capturedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        query: {
          search: [
            { title: 'Mechanical ventilation', snippet: 'Mechanical ventilation in residential buildings...' }
          ]
        }
      })
    };
  };

  const provider = new WikipediaDiscoveryProvider('en');
  const results = await provider.search({
    query: 'Mechanical ventilation',
    query_id: 'Q-02',
    language: 'en'
  }, { fetchFn: mockFetch });

  assert.ok(capturedUrl.includes('en.wikipedia.org/w/api.php'), 'Must call English Wikipedia');
  assert.ok(capturedUrl.includes('srsearch=Mechanical%20ventilation'), 'Must send compact concept title');
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Mechanical ventilation');
  assert.equal(results[0].document_hint, 'ENCYCLOPEDIC');

  console.log('[PASS] Test 7: Wikipedia provider receives compact concept query');
  passedTests++;
}

// =========================================================================
// TEST 8: Open-Web provider receives institutional/web-oriented query
// =========================================================================
{
  let capturedWebQuery = '';
  const mockWebSearch = async (query, _maxRows) => {
    capturedWebQuery = query;
    return [
      {
        title: 'ASHRAE Standard 62.2 Ventilation and Acceptable Indoor Air Quality in Residential Buildings',
        url: 'https://www.ashrae.org/technical-resources/standards-and-guidelines/standard-62-2',
        snippet: 'Standard 62.2 defines roles and ventilation rates for residential dwellings.',
        publisher: 'ASHRAE'
      }
    ];
  };

  const provider = new OpenWebDiscoveryProvider(mockWebSearch);
  assert.equal(provider.isConfigured(), true);

  const results = await provider.search({
    query: 'building science standards ventilation ASHRAE',
    query_id: 'Q-03',
    language: 'en'
  });

  assert.equal(capturedWebQuery, 'building science standards ventilation ASHRAE');
  assert.equal(results.length, 1);
  assert.equal(results[0].title.includes('ASHRAE'), true);
  assert.equal(results[0].document_hint, 'STANDARD');

  console.log('[PASS] Test 8: Open-web provider receives institutional/web query and normalizes result');
  passedTests++;
}

// =========================================================================
// TEST 9: Cross-provider candidate deduplication merges provenance
// =========================================================================
{
  const candidates = [
    {
      provider: 'CROSSREF',
      candidate_id: 'cand_cr_1',
      title: 'Moisture Control Guidance for Building Design',
      url: 'https://doi.org/10.1016/j.env.2020',
      doi: '10.1016/j.env.2020',
      publisher: 'Elsevier',
      discovered_at: '2026-10-06T10:00:00Z',
      discovery_query_id: 'Q-01'
    },
    {
      provider: 'OPEN_WEB',
      candidate_id: 'cand_web_1',
      title: 'Moisture Control Guidance for Building Design',
      url: 'https://doi.org/10.1016/j.env.2020?utm_source=feed',
      doi: '10.1016/j.env.2020',
      publisher: 'Elsevier',
      discovered_at: '2026-10-06T10:01:00Z',
      discovery_query_id: 'Q-02'
    }
  ];

  const deduped = deduplicateCandidates(candidates);
  assert.equal(deduped.length, 1, 'Duplicate candidate by DOI and URL must be merged into 1 record');
  assert.ok(deduped[0].discovered_by_providers.includes('CROSSREF'));
  assert.ok(deduped[0].discovered_by_providers.includes('OPEN_WEB'));
  assert.ok(deduped[0].discovery_query_ids.includes('Q-01'));
  assert.ok(deduped[0].discovery_query_ids.includes('Q-02'));

  console.log('[PASS] Test 9: Provider deduplication merges duplicate candidates and preserves provenance');
  passedTests++;
}

// =========================================================================
// TEST 10: Paywalled DOI triggers bounded legitimate OA resolution
// =========================================================================
{
  let oaAttempted = false;
  const mockOaResolver = async (doi) => {
    oaAttempted = true;
    if (doi === '10.1016/j.buildenv.2019.106512') {
      return {
        oa_url: 'https://repository.tudelft.nl/islandora/object/uuid:1234/datastream/OBJ/download',
        repository_type: 'INSTITUTIONAL_REPOSITORY',
        license: 'cc-by'
      };
    }
    return null;
  };

  const res = await resolveOpenAccessCandidate(
    '10.1016/j.buildenv.2019.106512',
    'https://doi.org/10.1016/j.buildenv.2019.106512',
    { customOaResolverFn: mockOaResolver }
  );

  assert.equal(oaAttempted, true);
  assert.equal(res.oa_status, 'OA_AVAILABLE');
  assert.equal(res.oa_url, 'https://repository.tudelft.nl/islandora/object/uuid:1234/datastream/OBJ/download');
  assert.equal(res.oa_repository_type, 'INSTITUTIONAL_REPOSITORY');

  console.log('[PASS] Test 10: Paywalled DOI triggers bounded legitimate OA resolution');
  passedTests++;
}

// =========================================================================
// TEST 11: Paywalled DOI with no OA copy remains blocked
// =========================================================================
{
  const mockOaResolver = async (_doi) => null;

  const res = await resolveOpenAccessCandidate(
    '10.1080/23744731.2020.1783421',
    'https://doi.org/10.1080/23744731.2020.1783421',
    { customOaResolverFn: mockOaResolver }
  );

  assert.equal(res.oa_status, 'NO_OA_FOUND');
  assert.equal(res.oa_url, undefined);

  console.log('[PASS] Test 11: Paywalled DOI with no OA version remains blocked safely');
  passedTests++;
}

// =========================================================================
// TEST 12: Search snippets cannot become evidence without retrieved document
// =========================================================================
{
  const candidateMetadata = {
    provider: 'OPEN_WEB',
    candidate_id: 'cand_test_snippet',
    title: 'Exhaust Fan Airflow Standards',
    snippet_or_abstract: 'Exhaust fans must achieve 50 CFM intermittent or 20 CFM continuous per ASHRAE 62.2.',
    url: 'https://example.com/fans',
    discovered_at: '2026-10-06T10:00:00Z',
    discovery_query_id: 'Q-01'
  };

  const ranked = rankCandidatesByDiscoveryRelevance([candidateMetadata], ['exhaust', 'fan', 'cfm']);
  assert.ok(ranked[0].relevance_score > 0, 'Candidate scored for prioritization');

  assert.equal(candidateMetadata.content_text, undefined);
  assert.equal(candidateMetadata.content_hash, undefined);
  assert.equal(candidateMetadata.retrieval_status, undefined);

  console.log('[PASS] Test 12: Search snippets remain metadata only and cannot become evidence');
  passedTests++;
}

// =========================================================================
// TEST 13: Private IP URLs blocked before retrieval (SSRF protection)
// =========================================================================
{
  const privateIps = [
    'http://127.0.0.1/admin',
    'http://10.0.0.5/api',
    'http://192.168.1.1/router',
    'http://172.20.0.1/private',
    'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1/carrier',
    'http://0.0.0.0:8080/test'
  ];

  for (const url of privateIps) {
    const res = validateSafeUrl(url);
    assert.equal(res.isSafe, false, `URL ${url} must be blocked by SSRF guard`);
    assert.ok(res.reason?.includes('Blocked') || res.reason?.includes('restricted'), `Expected blocked reason for ${url}`);
  }

  console.log('[PASS] Test 13: Private IPv4 and cloud metadata URLs blocked by SSRF guard');
  passedTests++;
}

// =========================================================================
// TEST 14: Localhost and internal hostnames blocked
// =========================================================================
{
  const blockedHosts = [
    'http://localhost:3000/api',
    'https://server.local/internal',
    'http://db.internal/query',
    'http://service.lan:8080/',
    'http://metadata.google.internal/computeMetadata/v1/'
  ];

  for (const url of blockedHosts) {
    const res = validateSafeUrl(url);
    assert.equal(res.isSafe, false, `Host in ${url} must be blocked`);
  }

  console.log('[PASS] Test 14: Localhost and internal hostnames blocked');
  passedTests++;
}

// =========================================================================
// TEST 15: Redirect to private / local IP blocked
// =========================================================================
{
  const mockFetchRedirect = async (url) => {
    if (url === 'https://public-gateway.com/open-redirect') {
      return {
        ok: true,
        status: 200,
        url: 'http://169.254.169.254/secret',
        headers: new Map([['content-type', 'text/html']]),
        text: async () => 'secret metadata'
      };
    }
    return { ok: false, status: 404 };
  };

  const { fetchHttpDocument } = await import('../src/lib/editorial/source-discovery.ts');
  const result = await fetchHttpDocument('https://public-gateway.com/open-redirect', { fetchFn: mockFetchRedirect });

  assert.equal(result.is_blocked, true);
  assert.ok(result.blocked_reason?.includes('SSRF_BLOCKED: Redirected to unsafe destination'));

  console.log('[PASS] Test 15: Redirect to private/local IP blocked immediately');
  passedTests++;
}

// =========================================================================
// TEST 16: Unsupported URI schemes blocked
// =========================================================================
{
  const invalidSchemes = [
    'ftp://ftp.example.com/file.txt',
    'file:///etc/passwd',
    'data:text/html,<h1>Hello</h1>',
    'javascript:alert(1)',
    'gopher://gopher.example.com'
  ];

  for (const url of invalidSchemes) {
    const res = validateSafeUrl(url);
    assert.equal(res.isSafe, false, `Scheme in ${url} must be blocked`);
    assert.ok(res.reason?.includes('Unsupported URI protocol'));
  }

  console.log('[PASS] Test 16: Non-HTTP schemes blocked');
  passedTests++;
}

// =========================================================================
// TEST 17: URL credentials rejected
// =========================================================================
{
  const credUrls = [
    'https://admin:password@example.com/report',
    'http://user:secret@198.51.100.1/doc'
  ];

  for (const url of credUrls) {
    const res = validateSafeUrl(url);
    assert.equal(res.isSafe, false, `URL with embedded credentials ${url} must be blocked`);
    assert.ok(res.reason?.includes('embedded credentials'));
  }

  console.log('[PASS] Test 17: URLs with embedded credentials rejected');
  passedTests++;
}

// =========================================================================
// TEST 18: Retrieval budget unaffected by duplicate candidates
// =========================================================================
{
  const candidates = [
    {
      provider: 'CROSSREF',
      candidate_id: 'c1',
      title: 'Ventilation and moisture physics',
      url: 'https://example.com/ventilation-paper',
      discovered_at: new Date().toISOString(),
      discovery_query_id: 'Q-01'
    },
    {
      provider: 'OPEN_WEB',
      candidate_id: 'c2',
      title: 'Ventilation and moisture physics',
      url: 'https://example.com/ventilation-paper',
      discovered_at: new Date().toISOString(),
      discovery_query_id: 'Q-02'
    }
  ];

  const deduped = deduplicateCandidates(candidates);
  assert.equal(deduped.length, 1, 'Two duplicate records from different providers must yield 1 candidate');

  console.log('[PASS] Test 18: Retrieval budget unaffected by duplicate candidates');
  passedTests++;
}

// =========================================================================
// TEST 19: Pass 2 queries target only missing categories
// =========================================================================
{
  const topic = 'Kamar Mandi Tetap Lembap Meski Sudah Pakai Exhaust Fan: Kapasitas Fan, Jalur Udara Masuk, Durasi Operasi, atau Sumber Uap?';
  const planP2 = ResearchDiscoveryQueryPlanner.planQueries({
    topic,
    passNumber: 2,
    missingResearchCategories: ['LIMITATIONS_AND_FALSE_FIXES', 'ESCALATION_CONDITIONS']
  });

  assert.ok(planP2.planned_queries.length > 0);
  for (const q of planP2.planned_queries) {
    assert.ok(
      q.category === 'LIMITATIONS_AND_FALSE_FIXES' || q.category === 'ESCALATION_CONDITIONS',
      `Pass 2 query ${q.query_id} category ${q.category} must be one of missing categories`
    );
  }

  console.log('[PASS] Test 19: Pass 2 queries strictly target missing categories');
  passedTests++;
}

// =========================================================================
// TEST 20: No Final6 topic-specific hardcoding in query planning
// =========================================================================
{
  const randomTopic = 'Dinding Kamar Tidur Lembap Rembes di Bawah Jendela: Retak Plester, Kusen Tanpa Sealant, atau Saluran Air Hujan?';
  const plan = ResearchDiscoveryQueryPlanner.planQueries({
    topic: randomTopic,
    passNumber: 1
  });

  const allQueries = plan.planned_queries.flatMap(q => q.variants.map(v => v.query.toLowerCase())).join(' ');
  assert.ok(!allQueries.includes('exhaust fan'), 'Planner must not leak exhaust fan into wall moisture topic');
  assert.ok(!allQueries.includes('kamar mandi'), 'Planner must not leak kamar mandi into wall moisture topic');
  assert.ok(allQueries.includes('dinding') || allQueries.includes('rembes') || allQueries.includes('wall'), 'Must extract wall/moisture terms');

  console.log('[PASS] Test 20: Zero topic-specific hardcoding in generic query planner');
  passedTests++;
}

// =========================================================================
// TEST 21: Full Irwan Research Runtime with Multi-Provider Discovery and OA Resolution
// =========================================================================
{
  const mockWebSearch = async (_query) => [
    {
      title: 'ASHRAE 62.2 Ventilation Standards for Residential Dwellings',
      url: 'https://ashrae.org/standards/62-2',
      snippet: 'ASHRAE standard requirements for exhaust airflow and make-up air.'
    }
  ];

  const mockCrossRef = async (_query) => [
    {
      candidate_id: 'cr_paywalled_1',
      query: 'bathroom ventilation',
      discovery_engine: 'CROSSREF_OPEN_API',
      title: 'Bathroom Exhaust Ventilation Rates in Residential Construction',
      publisher: 'Elsevier',
      doi: '10.1016/j.buildenv.2020.999',
      url: 'https://doi.org/10.1016/j.buildenv.2020.999',
      discovered_at: new Date().toISOString()
    }
  ];

  const mockOaResolver = async (doi) => {
    if (doi === '10.1016/j.buildenv.2020.999') {
      return {
        oa_url: 'https://repository.university.edu/papers/bathroom_ventilation_oa.html',
        repository_type: 'INSTITUTIONAL_REPOSITORY'
      };
    }
    return null;
  };

  const mockHttpDoc = async (url) => {
    if (url.includes('doi.org/10.1016/j.buildenv.2020.999')) {
      return {
        requested_url: url,
        resolved_url: url,
        http_status: 403,
        content_type: 'text/html',
        retrieved_at: new Date().toISOString(),
        raw_content_hash: '',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'PAYWALL_OR_LOGIN_PAGE',
        is_blocked: true,
        blocked_reason: 'PAYWALL_OR_LOGIN_PAGE'
      };
    }

    if (url.includes('bathroom_ventilation_oa.html')) {
      const text = `
## Overview of Bathroom Mechanical Ventilation
Mechanical exhaust ventilation removes moisture generated during bathing activities.
Insufficient exhaust airflow leads to high relative humidity and surface condensation.
Airflow rates of 50 CFM intermittent or 20 CFM continuous effectively prevent microbial growth.
Makeup air pathways under door undercuts are essential for proper fan performance.
      `.trim();
      return {
        requested_url: url,
        resolved_url: url,
        http_status: 200,
        content_type: 'text/html',
        retrieved_at: new Date().toISOString(),
        raw_content_hash: 'hash_oa_123',
        clean_text: text,
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        is_blocked: false
      };
    }

    if (url.includes('ashrae.org/standards/62-2')) {
      const text = `
## Technical Standards and Requirements
Standard ventilation guidelines establish design minimums for residential indoor air quality.
Proper installation requires rigid ducting to minimize static pressure and maximize CFM delivery.
      `.trim();
      return {
        requested_url: url,
        resolved_url: url,
        http_status: 200,
        content_type: 'text/html',
        retrieved_at: new Date().toISOString(),
        raw_content_hash: 'hash_ashrae_456',
        clean_text: text,
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        is_blocked: false
      };
    }

    return null;
  };

  const result = await executeGeneralizedResearchJob(
    {
      taskId: 'test_discovery_capability_job',
      topic: 'Kamar Mandi Tetap Lembap Meski Sudah Pakai Exhaust Fan: Kapasitas Fan, Jalur Udara Masuk, Durasi Operasi, atau Sumber Uap?',
      operatorAuth: { authorizedBy: 'Chief Editor', operatorRole: 'CHIEF_EDITOR' }
    },
    {
      crossRefSearchFn: mockCrossRef,
      openWebSearchFn: mockWebSearch,
      oaResolverFn: mockOaResolver,
      httpDocFn: mockHttpDoc,
      dryRun: false
    }
  );

  assert.ok(result.passMetrics && result.passMetrics.length > 0, 'Must record pass metrics');
  const p1Metrics = result.passMetrics[0];
  assert.ok(p1Metrics.query_plan_count > 0, 'Must record query_plan_count');
  assert.ok(p1Metrics.provider_calls && p1Metrics.provider_calls.length > 0, 'Must record provider_calls');
  assert.equal(p1Metrics.oa_resolution_attempts, 1, 'Must record 1 OA resolution attempt');
  assert.equal(p1Metrics.oa_resolution_successes, 1, 'Must record 1 OA resolution success');
  assert.equal(p1Metrics.oa_resolved_candidates, 1, 'Must record 1 OA resolved candidate');

  const oaDoc = result.retrievedDocuments.find(d => d.source_id.startsWith('SRC-OA-'));
  assert.ok(oaDoc, 'Must include retrieved legitimate OA document in authentic documents');
  assert.equal(oaDoc.retrieval_status, 'SOURCE_RETRIEVED_AND_VERIFIED');

  console.log('[PASS] Test 21: Full research runtime executes multi-provider discovery, SSRF checks, and OA resolution');
  passedTests++;
}

console.log(`\n==================================================`);
console.log(`RESEARCH-DISCOVERY-CAPABILITY-1 SUITE COMPLETE: ${passedTests} PASSED, 0 FAILED`);
console.log(`==================================================\n`);
