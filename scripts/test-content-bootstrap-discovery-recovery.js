import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import {
  ResearchDiscoveryQueryPlanner,
  MAX_QUERY_LENGTH,
  decomposeTopicConcepts,
  sanitizeBibliographicTerms,
  renderProviderSpecificQuery,
  EDITORIAL_INTENT_TERMS
} from '../src/lib/editorial/research-discovery-planner.ts';

import {
  evaluateCandidateDomainConsistency,
  rankCandidatesByDiscoveryRelevance,
  HermesBrowserDiscoveryProvider,
  OpenWebDiscoveryProvider,
  OUT_OF_DOMAIN_PATTERNS
} from '../src/lib/editorial/discovery-providers.ts';

import {
  scoreAndRankCandidates,
  isPreRejectedCandidate
} from '../src/lib/editorial/source-discovery.ts';

import {
  validateSafeUrl
} from '../src/lib/editorial/discovery-network-safety.ts';

console.log('--- STARTING CONTENT-BOOTSTRAP-DISCOVERY-RECOVERY TEST SUITE ---\n');

let passedTests = 0;

// =========================================================================
// TEST 1: Wave1 exact-query forensic reproducible
// =========================================================================
{
  const glassTopic = 'Kaca Laminated vs Tempered untuk Hunian: Perbandingan Karakteristik Keamanan, Kekuatan Benturan, dan Isolasi Suara';
  const decomp = decomposeTopicConcepts(glassTopic);

  assert.ok(decomp.problem_entities.includes('kaca'), 'Entity kaca must be matched');
  assert.ok(decomp.problem_entities.includes('laminated'), 'Entity laminated must be matched');
  assert.ok(decomp.problem_entities.includes('tempered'), 'Entity tempered must be matched');

  const legacyContaminated = 'kaca problem differential diagnosis inspection';
  const sanitized = sanitizeBibliographicTerms(legacyContaminated);
  assert.ok(!sanitized.includes('differential diagnosis'), 'Sanitization must purge differential diagnosis');
  assert.ok(!sanitized.includes('inspection'), 'Sanitization must purge inspection');

  console.log('[PASS] Test 1: Wave1 exact-query forensic reproducible and sanitization proven');
  passedTests++;
}

// =========================================================================
// TEST 2: Generic editorial terms do not dominate CrossRef
// =========================================================================
{
  const testString = 'differential diagnosis inspection causes physics remediation effectiveness airflow mitigation limitations false fixes';
  const clean = sanitizeBibliographicTerms(testString);
  assert.strictEqual(clean, '', 'All generic editorial intent terms must be purged for bibliographic retrieval');

  const technicalString = 'laminated safety glass PVB impact resistance fracture differential diagnosis';
  const cleanTech = sanitizeBibliographicTerms(technicalString);
  assert.ok(cleanTech.includes('laminated safety glass'), 'Technical terms preserved');
  assert.ok(cleanTech.includes('impact resistance fracture'), 'Mechanism preserved');
  assert.ok(!cleanTech.includes('differential diagnosis'), 'Editorial noise stripped');

  console.log('[PASS] Test 2: Generic editorial terms do not dominate CrossRef');
  passedTests++;
}

// =========================================================================
// TEST 3: Provider-specific query rendering works
// =========================================================================
{
  const rawTerms = 'laminated safety glass PVB impact resistance fracture comparative performance';
  const crQuery = renderProviderSpecificQuery(rawTerms, 'CROSSREF', 'en', 'building');
  const wikiQuery = renderProviderSpecificQuery(rawTerms, 'WIKIPEDIA', 'en');
  const webQuery = renderProviderSpecificQuery(rawTerms, 'OPEN_WEB', 'en');

  assert.ok(crQuery.length <= MAX_QUERY_LENGTH, 'CrossRef query bounded');
  assert.ok(wikiQuery.length <= MAX_QUERY_LENGTH, 'Wikipedia query bounded');
  assert.ok(webQuery.length <= MAX_QUERY_LENGTH, 'Web query bounded');

  assert.ok(crQuery.includes('laminated') && crQuery.includes('glass'), 'CrossRef query has core technical concepts');
  assert.ok(wikiQuery.split(' ').length <= 4, 'Wikipedia query is compact entity phrase');

  console.log('[PASS] Test 3: Provider-specific query rendering works');
  passedTests++;
}

// =========================================================================
// TEST 4: Tile topic rejects Earth shelter candidate
// =========================================================================
{
  const tileTopic = 'Keramik Lantai Terangkat atau Popping: Analisis Pemuaian, Kualitas Perekat, dan Peran Movement Joint';
  const candidates = [
    {
      candidate_id: 'cand_earth_shelter',
      query: 'tile popping',
      discovery_engine: 'WIKIPEDIA_TECHNICAL_API',
      title: 'Earth shelter',
      snippet: 'An earth shelter is a structure with earth against the walls or on the roof.',
      url: 'https://en.wikipedia.org/wiki/Earth_shelter',
      discovered_at: new Date().toISOString()
    },
    {
      candidate_id: 'cand_tile_debonding',
      query: 'tile popping',
      discovery_engine: 'CROSSREF_OPEN_API',
      title: 'Debonding and Tenting Mechanism of Ceramic Tile Flooring due to Thermal Expansion and Movement Joint Absence',
      snippet: 'Experimental investigation on adhesive bond failure, mortar shear stress, and movement joint expansion.',
      url: 'https://doi.org/10.1016/j.buildenv.2024.1001',
      doi: '10.1016/j.buildenv.2024.1001',
      discovered_at: new Date().toISOString()
    }
  ];

  const ranked = scoreAndRankCandidates(candidates, tileTopic);
  assert.strictEqual(ranked[0].candidate.candidate_id, 'cand_tile_debonding', 'Genuine tile debonding candidate must rank first');
  assert.ok(ranked[0].score > ranked[1].score, 'Tile failure score must be significantly higher than Earth shelter');

  console.log('[PASS] Test 4: Tile topic ranks genuine tile failure far above unrelated Earth shelter candidate');
  passedTests++;
}

// =========================================================================
// TEST 5: Glass topic rejects biomedical candidate
// =========================================================================
{
  const glassTopic = 'Kaca Laminated vs Tempered untuk Hunian: Perbandingan Karakteristik Keamanan, Kekuatan Benturan, dan Isolasi Suara';
  const bioCandidate = {
    candidate_id: 'cand_paralysis',
    query: 'glass safety',
    discovery_engine: 'CROSSREF_OPEN_API',
    title: 'Skeletal atrophy and the problem of the differential diagnosis of conditions causing paralysis',
    snippet: 'Clinical presentation of patients with neuromuscular paralysis in hospital setting.',
    url: 'https://doi.org/10.14195/2182-7982_19_1',
    doi: '10.14195/2182-7982_19_1',
    discovered_at: new Date().toISOString()
  };

  const domainCheck = evaluateCandidateDomainConsistency(bioCandidate, glassTopic);
  assert.strictEqual(domainCheck.consistent, false, 'Biomedical paralysis candidate must be inconsistent');
  assert.ok(domainCheck.scoreAdjustment < 0, 'Negative adjustment applied');

  const ranked = scoreAndRankCandidates([bioCandidate], glassTopic);
  assert.strictEqual(ranked[0].isPreRejected, true, 'Biomedical candidate must be pre-rejected');
  assert.strictEqual(ranked[0].score, -1, 'Pre-rejected candidate score must be -1');

  console.log('[PASS] Test 5: Glass topic rejects biomedical candidate pre-retrieval');
  passedTests++;
}

// =========================================================================
// TEST 6: Glass engineering candidate ranks higher
// =========================================================================
{
  const glassTopic = 'Kaca Laminated vs Tempered untuk Hunian: Perbandingan Karakteristik Keamanan, Kekuatan Benturan, dan Isolasi Suara';
  const candidates = [
    {
      candidate_id: 'cand_spondylodiscitis',
      query: 'glass',
      discovery_engine: 'CROSSREF_OPEN_API',
      title: 'Infectious spondylodiscitis – a challenging problem of differential diagnosis',
      snippet: 'Clinical diagnosis of spinal infection.',
      url: 'https://doi.org/10.26226/morressier.1',
      doi: '10.26226/morressier.1',
      discovered_at: new Date().toISOString()
    },
    {
      candidate_id: 'cand_laminated_impact',
      query: 'glass',
      discovery_engine: 'CROSSREF_OPEN_API',
      title: 'Impact Resistance and Post-Breakage Structural Performance of Laminated Architectural Glass with PVB Interlayer',
      snippet: 'Testing of laminated safety glass under soft and hard body impact in building envelopes.',
      url: 'https://doi.org/10.1016/j.engstruct.2024.1002',
      doi: '10.1016/j.engstruct.2024.1002',
      discovered_at: new Date().toISOString()
    }
  ];

  const ranked = scoreAndRankCandidates(candidates, glassTopic);
  assert.strictEqual(ranked[0].candidate.candidate_id, 'cand_laminated_impact');
  assert.ok(ranked[0].score >= 80, 'Glass engineering candidate gets strong positive score');
  assert.strictEqual(ranked[1].isPreRejected, true);

  console.log('[PASS] Test 6: Glass engineering candidate ranks higher and biomedical candidate is rejected');
  passedTests++;
}

// =========================================================================
// TEST 7: Shading topic rejects HIV intervention candidate
// =========================================================================
{
  const shadingTopic = 'Memilih Sistem Shading Luar untuk Mengurangi Panas Rumah Tropis: Overhang, Louver, Awning, atau Secondary Skin';
  const hivCandidate = {
    candidate_id: 'cand_hiv',
    query: 'intervention effectiveness',
    discovery_engine: 'CROSSREF_OPEN_API',
    title: 'An Evaluation of the Effectiveness of Behavioural Intervention Strategies Employed towards the Mitigation of HIV Risky Sexual Behaviour among Students in Institutions of Higher Learning in Western Kenya',
    snippet: 'Study evaluating youth intervention programs in Western Kenya.',
    url: 'https://doi.org/10.7176/rhss/12-16-05',
    doi: '10.7176/rhss/12-16-05',
    discovered_at: new Date().toISOString()
  };

  const domainCheck = evaluateCandidateDomainConsistency(hivCandidate, shadingTopic);
  assert.strictEqual(domainCheck.consistent, false, 'HIV intervention candidate must fail domain consistency');

  const ranked = scoreAndRankCandidates([hivCandidate], shadingTopic);
  assert.strictEqual(ranked[0].isPreRejected, true, 'HIV candidate must be pre-rejected');
  assert.strictEqual(ranked[0].score, -1);

  console.log('[PASS] Test 7: Shading topic rejects HIV intervention candidate');
  passedTests++;
}

// =========================================================================
// TEST 8: Building-energy candidate ranks higher
// =========================================================================
{
  const shadingTopic = 'Memilih Sistem Shading Luar untuk Mengurangi Panas Rumah Tropis: Overhang, Louver, Awning, atau Secondary Skin';
  const candidates = [
    {
      candidate_id: 'cand_hiv_biomed',
      query: 'shading',
      discovery_engine: 'CROSSREF_OPEN_API',
      title: 'An Evaluation of the Effectiveness of Biomedical Intervention Strategies Employed towards the Mitigation of HIV',
      snippet: 'Biomedical clinic survey.',
      url: 'https://doi.org/10.7176/alst/94-04',
      doi: '10.7176/alst/94-04',
      discovered_at: new Date().toISOString()
    },
    {
      candidate_id: 'cand_shading_facade',
      query: 'shading',
      discovery_engine: 'CROSSREF_OPEN_API',
      title: 'Complex Geometry Facades and Exterior Louver Shading in Building Energy Simulations',
      snippet: 'Evaluation of overhang and exterior louver shading devices for solar heat gain reduction in tropical facades.',
      url: 'https://doi.org/10.26868/25746308.2014.3',
      doi: '10.26868/25746308.2014.3',
      discovered_at: new Date().toISOString()
    }
  ];

  const ranked = scoreAndRankCandidates(candidates, shadingTopic);
  assert.strictEqual(ranked[0].candidate.candidate_id, 'cand_shading_facade');
  assert.ok(ranked[0].score >= 80, 'Building facade shading candidate scores high');
  assert.strictEqual(ranked[1].isPreRejected, true);

  console.log('[PASS] Test 8: Building-energy facade candidate ranks higher than biomedical candidate');
  passedTests++;
}

// =========================================================================
// TEST 9: Relevant candidates preserve retrieval eligibility
// =========================================================================
{
  const topic = 'Ventilasi Kamar Mandi Lembap dan Pengaruh Exhaust Fan';
  const genuineCandidate = {
    candidate_id: 'cand_hvac_vent',
    query: 'bathroom ventilation',
    discovery_engine: 'CROSSREF_OPEN_API',
    title: 'Bathroom Exhaust Ventilation Rates and Moisture Removal in Residential Buildings',
    snippet: 'ASHRAE standard testing on moisture removal and airflow CFM capacity.',
    url: 'https://doi.org/10.1016/j.buildenv.2023.1003',
    doi: '10.1016/j.buildenv.2023.1003',
    discovered_at: new Date().toISOString()
  };

  const pre = isPreRejectedCandidate(genuineCandidate);
  assert.strictEqual(pre.rejected, false, 'Genuine engineering candidate is not pre-rejected');

  const ranked = scoreAndRankCandidates([genuineCandidate], topic);
  assert.strictEqual(ranked[0].isPreRejected, false, 'Candidate preserves retrieval eligibility');
  assert.ok(ranked[0].score > 50, 'Candidate receives positive retrieval priority');

  console.log('[PASS] Test 9: Relevant candidates preserve retrieval eligibility');
  passedTests++;
}

// =========================================================================
// TEST 10: Evidence authority is not granted by ranking
// =========================================================================
{
  const metadataCandidate = {
    provider: 'CROSSREF',
    candidate_id: 'cand_001',
    title: 'High Ranking Material Science Paper',
    url: 'https://doi.org/10.1016/test',
    doi: '10.1016/test',
    discovered_at: new Date().toISOString(),
    discovery_query_id: 'q_001'
  };

  const ranked = rankCandidatesByDiscoveryRelevance([metadataCandidate], ['material', 'science']);
  assert.ok(ranked[0].relevance_score > 0, 'Candidate ranked');
  assert.strictEqual(ranked[0].is_verified_evidence, undefined, 'Ranking never confers evidence authority');
  assert.strictEqual(ranked[0].content_hash, undefined, 'No content hash until authentic retrieval');

  console.log('[PASS] Test 10: Evidence authority is not granted by discovery ranking');
  passedTests++;
}

// =========================================================================
// TEST 11: Hermes browser capability correctly detected
// =========================================================================
{
  const defaultProvider = new HermesBrowserDiscoveryProvider();
  assert.strictEqual(defaultProvider.isAvailable(), false, 'Default Hermes browser provider is false when not configured');

  const mockProvider = new HermesBrowserDiscoveryProvider({
    browserSearchFn: async () => []
  });
  assert.strictEqual(mockProvider.isAvailable(), true, 'Configured Hermes browser provider is available');

  console.log('[PASS] Test 11: Hermes browser capability correctly detected');
  passedTests++;
}

// =========================================================================
// TEST 12: Browser provider normalized if supported
// =========================================================================
{
  const mockBrowser = new HermesBrowserDiscoveryProvider({
    browserSearchFn: async (query, maxResults) => [
      {
        title: 'Building Energy Standards for Tropical Envelope Shading',
        url: 'https://energycodes.ocean.gov/tropical-shading',
        snippet: 'Comprehensive guidelines for overhangs and shading devices.',
        publisher: 'Government Energy Portal'
      }
    ]
  });

  const candidates = await mockBrowser.search({
    query: 'tropical solar shading',
    query_id: 'q_test_1',
    language: 'en',
    max_results: 3
  });

  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].provider, 'HERMES_BROWSER');
  assert.strictEqual(candidates[0].title, 'Building Energy Standards for Tropical Envelope Shading');
  assert.strictEqual(candidates[0].url, 'https://energycodes.ocean.gov/tropical-shading');
  assert.strictEqual(candidates[0].document_hint, 'INSTITUTIONAL');

  console.log('[PASS] Test 12: Browser provider normalized correctly');
  passedTests++;
}

// =========================================================================
// TEST 13: Browser CAPTCHA/block state fails cleanly
// =========================================================================
{
  const blockedBrowser = new HermesBrowserDiscoveryProvider({
    browserSearchFn: async () => [
      {
        title: 'Bot Verification Challenge / sorry',
        url: 'https://google.com/sorry/index?continue=...',
        isBlocked: true,
        blockReason: 'BROWSER_SEARCH_BLOCKED: Captcha challenge encountered'
      }
    ]
  });

  const results = await blockedBrowser.search({
    query: 'blocked search',
    query_id: 'q_test_block',
    language: 'en'
  });

  assert.strictEqual(results.length, 0, 'Blocked browser query returns empty array cleanly without error');

  console.log('[PASS] Test 13: Browser CAPTCHA/block state fails cleanly');
  passedTests++;
}

// =========================================================================
// TEST 14: Browser result snippet cannot become evidence
// =========================================================================
{
  const mockBrowser = new HermesBrowserDiscoveryProvider({
    browserSearchFn: async () => [
      {
        title: 'Snippet Only Candidate',
        url: 'https://example.com/article',
        snippet: 'Claim: laminated glass has 35 dB sound reduction.'
      }
    ]
  });

  const candidates = await mockBrowser.search({
    query: 'laminated glass acoustic',
    query_id: 'q_test_snip',
    language: 'en'
  });

  assert.ok(candidates[0].snippet_or_abstract.includes('Claim:'), 'Snippet stored as discovery metadata');
  assert.strictEqual(candidates[0].is_verified_passage, undefined, 'Snippet is never a verified passage');
  assert.strictEqual(candidates[0].content_hash, undefined, 'Snippet has no document content hash');

  console.log('[PASS] Test 14: Browser result snippet cannot become evidence');
  passedTests++;
}

// =========================================================================
// TEST 15: Browser-discovered URL still uses safe retrieval
// =========================================================================
{
  const unsafeBrowser = new HermesBrowserDiscoveryProvider({
    browserSearchFn: async () => [
      {
        title: 'Internal Metadata Discovery',
        url: 'http://169.254.169.254/latest/meta-data/',
        snippet: 'Dangerous cloud metadata endpoint'
      },
      {
        title: 'Localhost Discovery',
        url: 'http://127.0.0.1:8080/admin',
        snippet: 'Dangerous internal server'
      }
    ]
  });

  const results = await unsafeBrowser.search({
    query: 'ssrf attack simulation',
    query_id: 'q_test_ssrf',
    language: 'en'
  });

  assert.strictEqual(results.length, 0, 'SSRF URLs discovered by browser must be rejected immediately');

  console.log('[PASS] Test 15: Browser-discovered URLs strictly pass network safety before normalization');
  passedTests++;
}

// =========================================================================
// TEST 16: Brave remains OFF and request count = 0
// =========================================================================
{
  let braveNetworkRequests = 0;
  const mockFetch = async (url) => {
    const str = String(url);
    if (str.includes('api.search.brave.com')) {
      braveNetworkRequests++;
    }
    return new Response(JSON.stringify({ web: { results: [] } }), { status: 200 });
  };

  const braveProvider = new OpenWebDiscoveryProvider(undefined, {
    enabled: false,
    apiKey: undefined,
    provider: 'BRAVE'
  });

  assert.strictEqual(braveProvider.isEnabled(), false, 'Brave search is OFF by default');
  assert.strictEqual(braveProvider.isConfigured(), false, 'Brave search is not configured');

  let errorCaught = false;
  try {
    await braveProvider.search(
      { query: 'test query', query_id: 'q_brave_off', language: 'en' },
      { fetchFn: mockFetch }
    );
  } catch (err) {
    errorCaught = true;
    assert.ok(err.message.includes('OPEN_WEB_DISCOVERY_PROVIDER_UNAVAILABLE'), 'Explicit unavailable error thrown');
  }

  assert.strictEqual(errorCaught, true, 'Calling disabled Brave search throws explicit error');
  assert.strictEqual(braveNetworkRequests, 0, 'Brave request count must be exactly 0');

  console.log('[PASS] Test 16: Brave remains OFF and request count = 0');
  passedTests++;
}

// =========================================================================
// TEST 17: No topic-specific production hardcoding
// =========================================================================
{
  const plannerCode = fs.readFileSync(path.resolve('./src/lib/editorial/research-discovery-planner.ts'), 'utf-8');
  const providersCode = fs.readFileSync(path.resolve('./src/lib/editorial/discovery-providers.ts'), 'utf-8');
  const discoveryCode = fs.readFileSync(path.resolve('./src/lib/editorial/source-discovery.ts'), 'utf-8');

  const forbiddenPatterns = [
    /if\s*\([^)]*topic\.includes\(['"]keramik['"]\)/i,
    /if\s*\([^)]*topic\.includes\(['"]laminated['"]\)/i,
    /if\s*\([^)]*topic\.includes\(['"]shading['"]\)/i,
    /if\s*\([^)]*topicId\s*===/i
  ];

  for (const pat of forbiddenPatterns) {
    assert.ok(!pat.test(plannerCode), `Planner code must not contain forbidden topic pattern: ${pat}`);
    assert.ok(!pat.test(providersCode), `Providers code must not contain forbidden topic pattern: ${pat}`);
    assert.ok(!pat.test(discoveryCode), `Discovery code must not contain forbidden topic pattern: ${pat}`);
  }

  console.log('[PASS] Test 17: Zero topic-specific conditional hardcoding in production code');
  passedTests++;
}

console.log(`\n==================================================`);
console.log(`CONTENT-BOOTSTRAP-DISCOVERY-RECOVERY SUITE COMPLETE: ${passedTests} PASSED, 0 FAILED`);
console.log(`==================================================\n`);
