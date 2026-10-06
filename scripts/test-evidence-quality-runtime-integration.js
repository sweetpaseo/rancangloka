/**
 * RancangLoka Evidence Quality Runtime Integration Test Suite
 * Milestone: EVIDENCE-QUALITY-RUNTIME-INTEGRATION-1
 *
 * Verifies that the production editorial call graph enforces the semantic
 * evidence quality gate before Joko is authorized to write.
 *
 * Invariants Tested:
 * Case A: 6 authentic but irrelevant sources => authenticity PASS, quality coverage FAIL, writer false
 * Case B: fixture source => authenticity FAIL upstream
 * Case C: authentic relevant source but incomplete RQ coverage => writer false
 * Case D: six semantically and authoritatively covered RQs => research-quality gate PASS
 * Case E: off-topic claim with perfect provenance => author-safe false
 * Case F: navigation/spam text => never enters canonical passage inventory
 * Case G: .ac.id OJS journal article => SCHOLARLY_JOURNAL_ARTICLE
 * Case H: six unrelated domains => topic concentration remains CRITICAL
 * Case I: legacy semantic_role match alone => cannot satisfy RQ
 * Case J: quality gate failure => provider invocation count = 0
 *
 * ZERO network calls, ZERO live LLM requests, ZERO D1 mutations.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  executeEditorialDraftJob
} from '../src/lib/editorial/editorial-runtime.ts';

import {
  EditorialLlmProvider
} from '../src/lib/editorial/editorial-llm-provider.ts';

import {
  generateAuthorSafeClaims
} from '../src/lib/article/human-quality.ts';

import {
  extractDynamicPassagesFromText,
  establishSourceIdentity
} from '../src/lib/editorial/source-discovery.ts';

import {
  evaluateAuthorSafeEvidenceGate,
  evaluateResearchQuestionSupport,
  calculateSourceDiversityQuality,
  cleanBoilerplateAndSpam
} from '../src/lib/editorial/evidence-quality-gate.ts';

import {
  generateEditorialResearchQuestions
} from '../src/lib/editorial/research-questions.ts';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

class TrackingMockProvider extends EditorialLlmProvider {
  constructor() {
    super({ apiKey: 'mock-key', provider: 'sumopod' });
    this.invocationCount = 0;
  }

  async generate(options) {
    this.invocationCount++;
    return {
      success: true,
      content: JSON.stringify({
        article_markdown: '# Draf Artikel\n\nIsi draf lengkap.',
        citations: []
      }),
      latencyMs: 15,
      provider: 'sumopod',
      model: 'mock-test'
    };
  }
}

async function runSuite() {
  console.log('--- STARTING EVIDENCE-QUALITY-RUNTIME-INTEGRATION-1 SUITE ---');

  const activeTopic = 'Jendela Aluminium Sering Berembun di Pagi Hari: Masalah Kusen, Kaca, Ventilasi, atau Kelembapan Ruangan?';
  const final5PackPath = path.resolve('scripts/runtime-proof/final5/final5-evidence-pack.json');
  assert.ok(fs.existsSync(final5PackPath), 'final5-evidence-pack.json must exist');
  const final5EvidencePack = JSON.parse(fs.readFileSync(final5PackPath, 'utf8'));

  // =========================================================================
  // Case A: 6 authentic but irrelevant sources => authenticity PASS, quality coverage FAIL, writer invocation false
  // =========================================================================
  await test('Case A: 6 authentic but irrelevant sources => authenticity PASS, quality coverage FAIL, writer invocation false', async () => {
    // Sources are authentic live retrievals, but off-topic
    const trackingProvider = new TrackingMockProvider();
    const jobInput = {
      taskId: 'task_integration_case_a',
      topic: activeTopic,
      requestedTitle: activeTopic,
      evidencePack: final5EvidencePack,
      operatorAuth: {
        authorizedBy: 'Chief Editor Quality Test',
        timestamp: new Date().toISOString()
      }
    };

    const result = await executeEditorialDraftJob(jobInput, { providerInstance: trackingProvider });

    assert.equal(result.status, 'BLOCKED', 'Job must be BLOCKED when quality coverage fails');
    assert.equal(result.finalDecision, 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT', 'Decision must be RESEARCH_COVERAGE_QUALITY_INSUFFICIENT');
    assert.equal(result.totalAttempts, 0, 'Total attempts must be 0');
    assert.equal(trackingProvider.invocationCount, 0, 'Joko/Provider must NOT be invoked');
  });

  // =========================================================================
  // Case B: fixture source => authenticity FAIL upstream
  // =========================================================================
  await test('Case B: fixture source => authenticity FAIL upstream in real runtime', async () => {
    const fixtureClaim = {
      claim_id: 'CLM-FIXTURE-01',
      statement: 'Kusen aluminium mengalami kondensasi jika tidak ada thermal break.',
      claim_class: 'technical_consensus',
      evidence_status: 'VERIFIED',
      sources: [{
        source_id: 'SRC-FIXTURE-01',
        source_origin: 'TEST_FIXTURE',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        document_title: 'Fixture Kusen Aluminium'
      }],
      evidence_passage_ids: ['psg_fixture_01']
    };

    const safeClaims = generateAuthorSafeClaims([fixtureClaim], {
      executionType: 'REAL_RUNTIME_EXECUTION',
      retrievedDocuments: [{
        source_id: 'SRC-FIXTURE-01',
        source_origin: 'TEST_FIXTURE',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED'
      }],
      topic: activeTopic
    });

    assert.equal(safeClaims.length, 1);
    assert.equal(safeClaims[0].allowed_for_authoring, false, 'Fixture source must NOT be allowed for authoring');
    assert.ok(safeClaims[0].source_provenance_blocked, 'source_provenance_blocked must be true');
    assert.ok(safeClaims[0].qualification_required.includes('FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME'), 'Must cite fixture rejection reason');
  });

  // =========================================================================
  // Case C: authentic relevant source but incomplete RQ coverage => writer false
  // =========================================================================
  await test('Case C: authentic relevant source but incomplete RQ coverage => writer false', async () => {
    const trackingProvider = new TrackingMockProvider();

    // Pack with only 1 relevant claim (covering only PLAUSIBLE_CAUSES)
    const incompletePack = {
      evidence_pack_id: 'pack_incomplete_01',
      topic: activeTopic,
      retrieved_documents: [{
        source_id: 'SRC-AUTH-01',
        title: 'Building Science Fenestration Condensation',
        publisher: 'Lawrence Berkeley National Laboratory',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        source_classification: 'OFFICIAL_INSTITUTIONAL_GUIDANCE',
        content_text: 'Aluminium frames without a thermal break have high conductivity leading to surface temperatures below dew point causing morning condensation.'
      }],
      evidence_passages: [{
        passage_id: 'psg_01',
        source_id: 'SRC-AUTH-01',
        locator: 'Section 1',
        exact_or_normalized_excerpt: 'Aluminium frames without a thermal break have high conductivity leading to surface temperatures below dew point causing morning condensation.'
      }],
      claim_inventory: [{
        claim_id: 'CLM-001',
        statement: 'Kusen aluminium tanpa thermal break menyebabkan suhu permukaan turun di bawah titik embun sehingga terjadi kondensasi pagi hari.',
        claim_class: 'technical_consensus',
        evidence_status: 'VERIFIED',
        sources: [{
          source_id: 'SRC-AUTH-01',
          source_origin: 'LIVE_RETRIEVAL',
          retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
          document_title: 'Building Science Fenestration Condensation'
        }],
        evidence_passage_ids: ['psg_01']
      }],
      author_safe_claims: []
    };

    const jobInput = {
      taskId: 'task_integration_case_c',
      topic: activeTopic,
      evidencePack: incompletePack,
      operatorAuth: {
        authorizedBy: 'Chief Editor Quality Test',
        timestamp: new Date().toISOString()
      }
    };

    const result = await executeEditorialDraftJob(jobInput, { providerInstance: trackingProvider });

    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.finalDecision, 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT');
    assert.equal(trackingProvider.invocationCount, 0, 'Joko must NOT be called when RQ coverage is incomplete');
  });

  // =========================================================================
  // Case D: six semantically and authoritatively covered RQs => research-quality gate PASS
  // =========================================================================
  await test('Case D: six semantically and authoritatively covered RQs => research-quality gate PASS', async () => {
    const validSources = [
      {
        source_id: 'SRC-LBNL',
        title: 'Thermal Performance and Condensation Resistance of Windows',
        publisher: 'Lawrence Berkeley National Laboratory',
        url: 'https://facades.lbl.gov/condensation',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        content_text: 'Aluminium window frames without thermal break have high thermal conductivity causing inner surface temperature to fall below dew point. Proper ventilation and humidity control are essential to prevent condensation, mold, and frame damage.'
      },
      {
        source_id: 'SRC-BSN',
        title: 'SNI Ventilasi dan Tata Udara Bangunan Gedung',
        publisher: 'Badan Standardisasi Nasional',
        url: 'https://bsn.go.id/sni-ventilasi',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        content_text: 'Standar perancangan ventilasi dan tata cara pengendalian kelembapan ruangan gedung untuk mencegah kelembapan berlebih, jamur masif, dan kondensasi pada permukaan elemen jendela bangunan.'
      }
    ];

    const validPassages = [
      { passage_id: 'PSG-1', source_id: 'SRC-LBNL', exact_or_normalized_excerpt: 'Aluminium frames without thermal break have high thermal conductivity causing inner surface temperature to fall below dew point and morning condensation on windows.' },
      { passage_id: 'PSG-2', source_id: 'SRC-BSN', exact_or_normalized_excerpt: 'Pengendalian kelembapan ruangan dengan exhaust fan dan ventilasi aktif menurunkan perbedaan suhu dan mencegah titik embun pada kusen jendela.' },
      { passage_id: 'PSG-3', source_id: 'SRC-LBNL', exact_or_normalized_excerpt: 'Membedakan kondensasi permukaan dari rembesan air hujan dapat dilihat dari adanya titik embun pada kaca dan kusen jendela saat kelembapan ruangan tinggi.' },
      { passage_id: 'PSG-4', source_id: 'SRC-BSN', exact_or_normalized_excerpt: 'Menutup ventilasi atau sekadar lap kaca pada jendela aluminium berembun bukan solusi karena tidak menghilangkan sumber kelembapan udara.' },
      { passage_id: 'PSG-5', source_id: 'SRC-LBNL', exact_or_normalized_excerpt: 'Kondisi korosi profil aluminium, jamur masif, atau drainase tersumbat pada jendela berembun memerlukan inspeksi teknis segera.' },
      { passage_id: 'PSG-6', source_id: 'SRC-BSN', exact_or_normalized_excerpt: 'Rekomendasi prioritas perbaikan jendela berembun adalah evaluasi ventilasi udara dan ukur kelembapan relatif ruangan secara berkala.' }
    ];

    const validClaims = [
      { claim_id: 'CLM-01', statement: 'Kusen jendela aluminium tanpa thermal break menyebabkan suhu dingin turun di bawah titik embun sehingga menjadi penyebab kondensasi pagi hari saat kelembapan tinggi.', claim_class: 'technical_consensus', evidence_status: 'VERIFIED', sources: [validSources[0]], evidence_passage_ids: ['PSG-1'] },
      { claim_id: 'CLM-02', statement: 'Diagnosis untuk membedakan jendela berembun dari bocor luar adalah tanda titik embun merata pada kaca akibat perbedaan suhu dan kelembapan ruangan.', claim_class: 'technical_consensus', evidence_status: 'VERIFIED', sources: [validSources[0]], evidence_passage_ids: ['PSG-3'] },
      { claim_id: 'CLM-03', statement: 'Intervensi jendela berembun yang efektif adalah memasang pemutus termal atau exhaust fan dan ventilasi untuk mengalirkan udara serta menurunkan kelembapan ruangan.', claim_class: 'technical_consensus', evidence_status: 'VERIFIED', sources: [validSources[1]], evidence_passage_ids: ['PSG-2'] },
      { claim_id: 'CLM-04', statement: 'Menutup ventilasi atau sekadar lap kaca jendela adalah bukan solusi permanen dan keterbatasan tindakan karena tidak menghilangkan sumber kelembapan.', claim_class: 'technical_consensus', evidence_status: 'VERIFIED', sources: [validSources[1]], evidence_passage_ids: ['PSG-4'] },
      { claim_id: 'CLM-05', statement: 'Eskalasi perbaikan jendela aluminium mendesak jika ditemukan korosi pada logam atau jamur masif dan drainase tersumbat yang membutuhkan inspeksi profesional.', claim_class: 'technical_consensus', evidence_status: 'VERIFIED', sources: [validSources[0]], evidence_passage_ids: ['PSG-5'] },
      { claim_id: 'CLM-06', statement: 'Langkah rekomendasi prioritas perbaikan jendela berembun adalah evaluasi ventilasi udara dan ukur kelembapan relatif sebelum mengganti kusen jendela.', claim_class: 'editorial_recommendation', evidence_status: 'VERIFIED', derived_from_claim_ids: ['CLM-01', 'CLM-03'], sources: [validSources[1]], evidence_passage_ids: ['PSG-6'] }
    ];

    const fullPack = {
      evidence_pack_id: 'pack_perfect_01',
      topic: activeTopic,
      retrieved_documents: validSources,
      evidence_passages: validPassages,
      claim_inventory: validClaims
    };

    const gateResult = evaluateAuthorSafeEvidenceGate(fullPack, activeTopic);

    assert.equal(gateResult.passed, true, 'Full evidence pack must PASS quality gate');
    assert.equal(gateResult.production_gate.passed, true);
    assert.equal(gateResult.production_gate.gate_status, 'PASS');
    assert.equal(gateResult.production_gate.uncovered_categories.length, 0);
  });

  // =========================================================================
  // Case E: off-topic claim with perfect provenance => author-safe false
  // =========================================================================
  await test('Case E: off-topic claim with perfect provenance => author-safe false', async () => {
    const authenticOffTopicDoc = {
      source_id: 'SRC-AUTH-SPORTS-01',
      title: 'Olahraga Pagi vs Sore Hari untuk Kebugaran Atlet',
      publisher: 'The Conversation Indonesia',
      source_origin: 'LIVE_RETRIEVAL',
      retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
      content_text: 'Latihan fisik di pagi hari membantu ritme sirkadian dan meningkatkan performa metabolisme atlet.'
    };

    const authenticOffTopicPassage = {
      passage_id: 'psg_sports_01',
      source_id: 'SRC-AUTH-SPORTS-01',
      locator: 'Paragraf 1',
      exact_or_normalized_excerpt: 'Latihan fisik di pagi hari membantu ritme sirkadian dan meningkatkan performa metabolisme atlet.'
    };

    const offTopicClaim = {
      claim_id: 'CLM-OFFTOPIC-01',
      statement: 'Latihan fisik di pagi hari membantu ritme sirkadian dan metabolisme tubuh.',
      claim_class: 'technical_consensus',
      evidence_status: 'VERIFIED',
      sources: [{
        source_id: 'SRC-AUTH-SPORTS-01',
        source_origin: 'LIVE_RETRIEVAL',
        retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
        document_title: 'Olahraga Pagi vs Sore Hari'
      }],
      evidence_passage_ids: ['psg_sports_01']
    };

    const safeClaims = generateAuthorSafeClaims([offTopicClaim], {
      executionType: 'REAL_RUNTIME_EXECUTION',
      retrievedDocuments: [authenticOffTopicDoc],
      evidencePassages: [authenticOffTopicPassage],
      topic: activeTopic
    });

    assert.equal(safeClaims.length, 1);
    assert.equal(safeClaims[0].allowed_for_authoring, false, 'Off-topic claim with perfect provenance must NOT be allowed for authoring');
    assert.ok(safeClaims[0].topic_relevance_blocked, 'topic_relevance_blocked must be true');
    assert.ok(safeClaims[0].qualification_required.includes('QUALITY_GATE_REJECTED'), 'Must cite quality gate rejection');
  });

  // =========================================================================
  // Case F: navigation/spam text => never enters canonical passage inventory
  // =========================================================================
  await test('Case F: navigation/spam text => never enters canonical passage inventory', async () => {
    const dirtyWebText = `
Home / Beranda / Menu Utama
Daftar Isi Artikel
Slot Gacor Hari Ini RTP 98% Maxwin Pragmatic Play
Kusen aluminium tanpa thermal break menghantarkan suhu dingin dari luar ke dalam ruangan.
Download PDF Full Text
Hak Cipta Dilindungi Undang-Undang
Judi Online Terpercaya Depo 10k Bonus New Member
Perbedaan suhu yang signifikan antara permukaan kusen dan udara hangat ruangan memicu titik embun.
All Rights Reserved 2026
`;

    const extracted = extractDynamicPassagesFromText('SRC-TEST-CLEANING', 'Test Fenestration Cleaning', dirtyWebText);

    // Verify no passage contains gambling spam or navigation boilerplate
    for (const p of extracted) {
      assert.ok(!/slot\s*gacor|judi\s*online|depo\s*10k/i.test(p.exact_text), 'Spam must never enter passages');
      assert.ok(!/home|beranda|download\s*pdf|hak\s*cipta/i.test(p.exact_text), 'Navigation boilerplate must never enter passages');
    }

    assert.ok(extracted.length > 0, 'Substantive technical passages must still be extracted');
    assert.ok(extracted.some(p => p.exact_text.includes('thermal break')), 'Thermal break passage must be preserved');
  });

  // =========================================================================
  // Case G: .ac.id OJS journal article => SCHOLARLY_JOURNAL_ARTICLE
  // =========================================================================
  await test('Case G: .ac.id OJS journal article => SCHOLARLY_JOURNAL_ARTICLE', async () => {
    const ojsUrl = 'https://journal.unissula.ac.id/index.php/jurnalteknik/article/view/12345';
    const identity = establishSourceIdentity(ojsUrl, 'Universitas Islam Sultan Agung');

    assert.equal(identity.source_role, 'SCHOLARLY_JOURNAL_ARTICLE', 'OJS article on .ac.id must be classified as SCHOLARLY_JOURNAL_ARTICLE');
    assert.equal(identity.source_classification, 'PRIMARY_RESEARCH_DOCUMENT', 'Source classification must be PRIMARY_RESEARCH_DOCUMENT');
    assert.notEqual(identity.source_classification, 'OFFICIAL_INSTITUTIONAL_GUIDANCE', 'Must NOT inflate to OFFICIAL_INSTITUTIONAL_GUIDANCE');
  });

  // =========================================================================
  // Case H: six unrelated domains => topic concentration remains CRITICAL
  // =========================================================================
  await test('Case H: six unrelated domains => topic concentration remains CRITICAL', async () => {
    const unrelatedSources = [
      { source_id: 'SRC-01', url: 'https://site1.org/sports', publisher: 'Domain One' },
      { source_id: 'SRC-02', url: 'https://site2.org/politics', publisher: 'Domain Two' },
      { source_id: 'SRC-03', url: 'https://site3.org/nutrition', publisher: 'Domain Three' },
      { source_id: 'SRC-04', url: 'https://site4.org/gaming', publisher: 'Domain Four' },
      { source_id: 'SRC-05', url: 'https://site5.org/dental', publisher: 'Domain Five' },
      { source_id: 'SRC-06', url: 'https://site6.org/martialarts', publisher: 'Domain Six' }
    ];

    const docRelMap = new Map([
      ['SRC-01', 'IRRELEVANT'],
      ['SRC-02', 'IRRELEVANT'],
      ['SRC-03', 'IRRELEVANT'],
      ['SRC-04', 'IRRELEVANT'],
      ['SRC-05', 'IRRELEVANT'],
      ['SRC-06', 'IRRELEVANT']
    ]);

    const sourceRoleMap = new Map([
      ['SRC-01', 'GENERAL_EDITORIAL_MEDIA'],
      ['SRC-02', 'GENERAL_EDITORIAL_MEDIA'],
      ['SRC-03', 'GENERAL_EDITORIAL_MEDIA'],
      ['SRC-04', 'GENERAL_EDITORIAL_MEDIA'],
      ['SRC-05', 'SCHOLARLY_JOURNAL_ARTICLE'],
      ['SRC-06', 'SCHOLARLY_JOURNAL_ARTICLE']
    ]);

    const diversity = calculateSourceDiversityQuality(unrelatedSources, docRelMap, sourceRoleMap);

    assert.equal(diversity.independent_domain_count, 6, 'Raw domains are 6');
    assert.equal(diversity.independent_relevant_evidence_stream_count, 0, 'Relevant streams must be 0');
    assert.equal(diversity.topic_concentration_risk, 'CRITICAL', 'Topic concentration risk must remain CRITICAL');
  });

  // =========================================================================
  // Case I: legacy semantic_role match alone => cannot satisfy RQ
  // =========================================================================
  await test('Case I: legacy semantic_role match alone => cannot satisfy RQ', async () => {
    const questions = generateEditorialResearchQuestions(activeTopic);

    // Claim with matching label CAUSE_MECHANISM but proposition about election rules
    const offTopicElectionClaim = {
      claim_id: 'CLM-ELECTION-01',
      statement: 'Mekanisme pemilihan sistem proporsional terbuka diatur dalam undang-undang pemilu.',
      semantic_role: 'CAUSE_MECHANISM',
      evidence_passage_ids: ['psg_election'],
      sources: [{ source_id: 'SRC_ELECTION' }]
    };

    const mockClaimQualityMap = new Map([
      ['CLM-ELECTION-01', {
        claim_id: 'CLM-ELECTION-01',
        author_safe_final: false, // Rejected by quality gate!
        rejection_reasons: ['CLAIM_TOPIC_RELEVANCE_OFF_TOPIC']
      }]
    ]);

    const rqEval = evaluateResearchQuestionSupport(
      questions,
      [offTopicElectionClaim],
      [{ passage_id: 'psg_election', source_id: 'SRC_ELECTION' }],
      mockClaimQualityMap,
      new Map([['SRC_ELECTION', 'SCHOLARLY_JOURNAL_ARTICLE']])
    );

    const causeRQ = rqEval.evaluations.find(e => e.category === 'PLAUSIBLE_CAUSES');
    assert.ok(causeRQ, 'Plausible causes RQ must exist');
    assert.equal(causeRQ.support_result, 'NOT_COVERED', 'Semantic role label alone must NOT satisfy RQ without author-safe substantive proposition');
    assert.equal(causeRQ.supporting_claim_ids.length, 0);
  });

  // =========================================================================
  // Case J: quality gate failure => provider invocation count = 0
  // =========================================================================
  await test('Case J: quality gate failure => provider invocation count = 0', async () => {
    const trackingProvider = new TrackingMockProvider();

    const failingJobInput = {
      taskId: 'task_integration_case_j',
      topic: activeTopic,
      evidencePack: final5EvidencePack,
      operatorAuth: {
        authorizedBy: 'Chief Editor Quality Test',
        timestamp: new Date().toISOString()
      }
    };

    const res = await executeEditorialDraftJob(failingJobInput, { providerInstance: trackingProvider });

    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.finalDecision, 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT');
    assert.equal(trackingProvider.invocationCount, 0, 'Provider invocation count must be exactly ZERO when quality gate fails');
    assert.equal(res.totalAttempts, 0);
  });

  console.log(`\n==================================================`);
  console.log(`EVIDENCE-QUALITY-RUNTIME-INTEGRATION-1 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);
  if (failed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});
