/**
 * RancangLoka Evidence Quality Gate Test Suite
 * Milestone: EVIDENCE-QUALITY-GATE-1
 *
 * Verifies:
 * - 4 Independent Qualities: AUTHENTIC + TOPIC_RELEVANT + CLAIM_RELEVANT + AUTHORITY_APPROPRIATE
 * - 14 Adversarial Scenarios
 * - Section W: Historical Final5 Offline Replay (Frozen Artifacts, Zero Live Network)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  classifySourceRole,
  cleanBoilerplateAndSpam,
  DocumentTopicRelevanceEvaluator,
  prioritizeCandidateRelevance,
  evaluatePassageRelevance,
  evaluateAuthoritySufficiency,
  evaluateSynthesizedClaim,
  evaluateClaimQuality,
  evaluateResearchQuestionSupport,
  validateProblemSolverProductionGate,
  calculateSourceDiversityQuality,
  evaluateAuthorSafeEvidenceGate
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
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failed++;
  }
}

async function runSuite() {
  console.log(`--- STARTING EVIDENCE-QUALITY-GATE-1 SUITE ---`);

  const activeTopic = 'Jendela Aluminium Sering Berembun di Pagi Hari: Masalah Kusen, Kaca, Ventilasi, atau Kelembapan Ruangan?';
  const evaluator = new DocumentTopicRelevanceEvaluator();

  // =========================================================================
  // Scenario 1: Topic includes "pagi hari"; sports article includes "pagi hari" => IRRELEVANT
  // =========================================================================
  await test('Scenario 1: Topic includes "pagi hari"; sports article includes "pagi hari" => IRRELEVANT', () => {
    const sportsDoc = {
      title: 'Lebih baik berolahraga di pagi hari atau sore hari?',
      publisher: 'The Conversation',
      text: 'Banyak orang bertanya apakah olahraga di pagi hari lebih efektif membakar lemak tubuh daripada sore hari bagi atlet dan masyarakat umum.'
    };

    const res = evaluator.evaluate(activeTopic, sportsDoc);
    assert.equal(res.relevance_level, 'IRRELEVANT', 'Sports article matching "pagi hari" must be IRRELEVANT');
    assert.equal(res.is_topic_authority, false);
    assert.ok(res.off_topic_domains.includes('SPORTS_AND_EXERCISE'));
  });

  // =========================================================================
  // Scenario 2: Topic includes "jendela"; publisher is "Jendela Pendidikan" => IRRELEVANT
  // =========================================================================
  await test('Scenario 2: Topic includes "jendela"; publisher is "Jendela Pendidikan" => IRRELEVANT', () => {
    const schoolDoc = {
      title: 'Efektivitas Program Sarapan Pagi terhadap Peningkatan Pemahaman Belajar Anak di MIU',
      publisher: 'CV Jendela Edukasi Indonesia',
      text: 'Penelitian ini meneliti gizi sarapan pagi terhadap daya tangkap siswa kelas 4 madrasah ibtidaiyah dalam proses belajar kurikulum merdeka.'
    };

    const res = evaluator.evaluate(activeTopic, schoolDoc);
    assert.equal(res.relevance_level, 'IRRELEVANT', 'School article from Jendela Edukasi must be IRRELEVANT');
    assert.equal(res.is_topic_authority, false);
  });

  // =========================================================================
  // Scenario 3: Topic includes "mekanisme"; election-law article includes "mekanisme" => IRRELEVANT
  // =========================================================================
  await test('Scenario 3: Topic includes "mekanisme"; election-law article includes "mekanisme" => IRRELEVANT', () => {
    const electionDoc = {
      title: 'MEKANISME SISTEM PROPORSIONAL TERBUKA PADA PEMILIHAN DEWAN PERWAKILAN RAKYAT DI INDONESIA',
      publisher: 'Universitas Wiraraja',
      text: 'Kajian yuridis mekanisme pemilihan umum dan penetapan perolehan kursi calon anggota legislatif DPR RI berdasarkan undang-undang pemilu.'
    };

    const res = evaluator.evaluate(activeTopic, electionDoc);
    assert.equal(res.relevance_level, 'IRRELEVANT', 'Election law article matching "mekanisme" must be IRRELEVANT');
    assert.equal(res.is_topic_authority, false);
    assert.ok(res.off_topic_domains.includes('ELECTION_AND_POLITICS'));
  });

  // =========================================================================
  // Scenario 4: Aluminium-frame housing case study => PARTIALLY_RELEVANT, not automatically HIGHLY_RELEVANT
  // =========================================================================
  await test('Scenario 4: Aluminium-frame housing case study => PARTIALLY_RELEVANT, not automatically HIGHLY_RELEVANT', () => {
    const batangDoc = {
      title: 'Penerapan Kusen Aluminium Di Percontohan Perumahan Kalisalak, Lebo, Pasekaran Batang Sebagai Alternatif Kusen Kayu Dalam Desain Pintu Dan Jendela',
      publisher: 'Universitas Selamat Sri',
      text: 'Penggunaan kusen aluminium pada perumahan Batang sebagai pengganti kusen kayu untuk mengatasi rayap, keawetan, dan kemudahan perawatan.'
    };

    const res = evaluator.evaluate(activeTopic, batangDoc);
    assert.equal(res.relevance_level, 'PARTIALLY_RELEVANT', 'Batang housing case study without condensation physics must be PARTIALLY_RELEVANT');
    assert.notEqual(res.relevance_level, 'HIGHLY_RELEVANT', 'Must NOT be elevated to HIGHLY_RELEVANT');
    assert.equal(res.is_topic_authority, false, 'Does not possess full topic authority over dew-point condensation');
  });

  // =========================================================================
  // Scenario 5: navigation/footer => rejected
  // =========================================================================
  await test('Scenario 5: navigation/footer => rejected', () => {
    const rawWithNavAndFooter = `
Home > Sains > Artikel
Cari analisis, penelitian, akademisi... Home Ekonomi
Pendidikan + Budaya Politik + Masyarakat Sains + Teknologi
Dapatkan nawala Disiplin ilmiah, gaya jurnalistik

Kusen aluminium memiliki konduktivitas termal tinggi sehingga permukaan bingkai mudah dingin saat suhu malam turun drastis.

Hak Cipta 2024 RancangLoka Media. All rights reserved.
Platform and workflow with OJS by PKP.
    `.trim();

    const cleaned = cleanBoilerplateAndSpam(rawWithNavAndFooter);
    assert.ok(!cleaned.cleaned_text.includes('Home > Sains'), 'Navigation breadcrumb must be stripped');
    assert.ok(!cleaned.cleaned_text.includes('Hak Cipta'), 'Footer must be stripped');
    assert.ok(!cleaned.cleaned_text.includes('Platform and workflow with OJS'), 'OJS footer must be stripped');
    assert.ok(cleaned.cleaned_text.includes('Kusen aluminium memiliki konduktivitas termal tinggi'), 'Substantive text must be preserved');
    assert.ok(cleaned.boilerplate_removed_count >= 3, 'Must record boilerplate removals');
  });

  // =========================================================================
  // Scenario 6: spam/comment => rejected
  // =========================================================================
  await test('Scenario 6: spam/comment => rejected', () => {
    const rawWithSpam = `
DAFTAR SITUS SLOT GACOR HARI INI RTP 98% MAXWIN PRAGMATIC PLAY
Bocoran pola slot online zeus olympus depo pulsa tanpa potongan

Perbedaan temperatur antara kaca bagian dalam dan udara ruangan yang lembap memicu terjadinya titik embun.

Leave a comment / Komentar (0)
Judi online terpercaya bandar togel resmi
    `.trim();

    const cleaned = cleanBoilerplateAndSpam(rawWithSpam);
    assert.ok(!cleaned.cleaned_text.toLowerCase().includes('slot gacor'), 'Gambling spam must be purged');
    assert.ok(!cleaned.cleaned_text.toLowerCase().includes('judi online'), 'Judi spam must be purged');
    assert.ok(cleaned.cleaned_text.includes('Perbedaan temperatur antara kaca bagian dalam'), 'Technical sentence preserved');
    assert.ok(cleaned.spam_removed_count >= 2, 'Spam removed count must be >= 2');
  });

  // =========================================================================
  // Scenario 7: claim entailed by off-topic passage => author-safe false
  // =========================================================================
  await test('Scenario 7: claim entailed by off-topic passage => author-safe false', () => {
    const offTopicPassage = {
      passage_id: 'psg_sport_01',
      source_id: 'SRC_SPORTS_01',
      locator: 'Olahraga Pagi',
      exact_or_normalized_excerpt: 'Berolahraga di pagi hari membantu menurunkan persentase lemak tubuh pada atlet pesilat.',
      semantic_role: 'MATERIAL_BEHAVIOR'
    };

    const claim = {
      claim_id: 'CLM-SPORT-01',
      statement: 'Berolahraga di pagi hari dapat menurunkan persentase lemak tubuh atlet.',
      evidence_passage_ids: ['psg_sport_01'],
      sources: [{ source_id: 'SRC_SPORTS_01', document_title: 'Latihan Fisik Pesilat' }],
      semantic_role: 'MATERIAL_BEHAVIOR'
    };

    const docRelMap = new Map([['SRC_SPORTS_01', 'IRRELEVANT']]);
    const sourceRoleMap = new Map([['SRC_SPORTS_01', 'SCHOLARLY_JOURNAL_ARTICLE']]);

    const res = evaluateClaimQuality(
      claim,
      [offTopicPassage],
      claim.sources,
      activeTopic,
      docRelMap,
      sourceRoleMap
    );

    assert.equal(res.author_safe_final, false, 'Claim from off-topic document MUST have author_safe_final = false');
    assert.equal(res.passage_relevance, 'OFF_TOPIC');
    assert.equal(res.topic_relevance, 'IRRELEVANT');
    assert.ok(res.rejection_reasons.some(r => r.includes('PASSAGE_RELEVANCE_INSUFFICIENT')));
  });

  // =========================================================================
  // Scenario 8: directly relevant passage + correct claim => eligible
  // =========================================================================
  await test('Scenario 8: directly relevant passage + correct claim => eligible', () => {
    const lbnlPassage = {
      passage_id: 'psg_lbnl_01',
      source_id: 'SRC_LBNL_01',
      locator: 'Thermal Conductivity',
      exact_or_normalized_excerpt: 'Aluminium profiles possess high thermal conductivity, facilitating rapid conductive heat transfer across the window envelope unless equipped with structural thermal breaks.',
      semantic_role: 'CAUSE_MECHANISM'
    };

    const claim = {
      claim_id: 'CLM-PHYS-01',
      statement: 'Kusen aluminium tanpa thermal break menghantarkan dingin dari luar ke dalam sehingga memicu titik embun kondensasi.',
      evidence_passage_ids: ['psg_lbnl_01'],
      sources: [{ source_id: 'SRC_LBNL_01', document_title: 'LBNL Fenestration Research' }],
      semantic_role: 'CAUSE_MECHANISM',
      action: 'KEEP',
      evidence_status: 'VERIFIED'
    };

    const docRelMap = new Map([['SRC_LBNL_01', 'HIGHLY_RELEVANT']]);
    const sourceRoleMap = new Map([['SRC_LBNL_01', 'OFFICIAL_INSTITUTIONAL_GUIDANCE']]);

    const res = evaluateClaimQuality(
      claim,
      [lbnlPassage],
      claim.sources,
      activeTopic,
      docRelMap,
      sourceRoleMap
    );

    assert.equal(res.author_safe_final, true, 'Directly relevant claim on institutional guidance must be author-safe');
    assert.equal(res.passage_relevance, 'DIRECTLY_RELEVANT');
    assert.equal(res.authority_sufficiency, 'SUFFICIENT');
    assert.equal(res.rejection_reasons.length, 0);
  });

  // =========================================================================
  // Scenario 9: unsupported synthesis => blocked
  // =========================================================================
  await test('Scenario 9: unsupported synthesis => blocked', () => {
    // Historical CLM-112: synthesizes acoustic decibels and thermal conductance without parent derivation
    const unparentedSynthesisClaim = {
      claim_id: 'CLM-112',
      statement: 'Pemilihan profil kusen dapat membantu kenyamanan termal dan akustik jika disesuaikan dengan kompromi konduktivitas dan kekedapan suara.',
      claim_class: 'editorial_recommendation',
      // derived_from_claim_ids missing!
      evidence_passage_ids: [],
      sources: []
    };

    const res = evaluateSynthesizedClaim(unparentedSynthesisClaim, []);
    assert.equal(res.isValid, false, 'Synthesized claim without derived_from_claim_ids must fail');
    assert.ok(res.missingReason.includes('SYNTHESIS_SUPPORT_MISSING'));

    // Even if derived IDs provided, but parent claims are missing/blocked:
    const synthesisWithBadParents = {
      ...unparentedSynthesisClaim,
      derived_from_claim_ids: ['CLM-MISSING-01']
    };
    const resBad = evaluateSynthesizedClaim(synthesisWithBadParents, []);
    assert.equal(resBad.isValid, false, 'Synthesis referencing non-author-safe parents must fail');
  });

  // =========================================================================
  // Scenario 10: correct semantic_role but proposition doesn't answer RQ => NOT_COVERED
  // =========================================================================
  await test('Scenario 10: correct semantic_role but proposition doesn\'t answer RQ => NOT_COVERED', () => {
    const questions = generateEditorialResearchQuestions(activeTopic);
    const rqPlausibleCauses = questions.find(q => q.category === 'PLAUSIBLE_CAUSES');
    assert.ok(rqPlausibleCauses);

    // Claim with role 'CAUSE_MECHANISM', but proposition is about elementary school breakfast nutrition
    const offTopicClaim = {
      claim_id: 'CLM-BREAKFAST-01',
      statement: 'Mekanisme penyerapan energi sarapan pagi pada anak sekolah dasar mempengaruhi konsentrasi belajar.',
      semantic_role: 'CAUSE_MECHANISM'
    };

    // Even if artificially marked author-safe in the map:
    const fakeClaimMap = new Map([
      ['CLM-BREAKFAST-01', {
        claim_id: 'CLM-BREAKFAST-01',
        author_safe_final: true,
        statement: offTopicClaim.statement
      }]
    ]);

    const sourceRoleMap = new Map();
    const evalRes = evaluateResearchQuestionSupport(
      [rqPlausibleCauses],
      [offTopicClaim],
      [],
      fakeClaimMap,
      sourceRoleMap
    );

    const qRes = evalRes.evaluations[0];
    assert.equal(qRes.support_result, 'NOT_COVERED', 'Semantic role label alone must NOT answer fenestration causes question');
    assert.equal(evalRes.covered_categories.length, 0);
  });

  // =========================================================================
  // Scenario 11: proposition answers RQ but authority insufficient => production coverage insufficient
  // =========================================================================
  await test('Scenario 11: proposition answers RQ but authority insufficient => production coverage insufficient', () => {
    const propRes = evaluateAuthoritySufficiency('PHYSICAL_MECHANISM', 'GENERAL_EDITORIAL_MEDIA');
    assert.equal(propRes.sufficiency, 'INSUFFICIENT', 'GENERAL_EDITORIAL_MEDIA cannot prove universal physical mechanism');
    assert.equal(propRes.allows_authoring, false);

    // Mock an RQ evaluation where authority is insufficient
    const mockEvaluations = [
      {
        question_id: 'RQ-01',
        category: 'PLAUSIBLE_CAUSES',
        question_text: 'Penyebab kondensasi',
        supporting_claim_ids: ['C-01'],
        supporting_passage_ids: [],
        supporting_source_ids: [],
        support_result: 'ADEQUATELY_COVERED',
        semantic_answer_reason: 'Answered',
        authority_sufficient: false // Insufficient authority!
      },
      {
        question_id: 'RQ-02',
        category: 'DIFFERENTIAL_DIAGNOSIS',
        question_text: 'Diferensiasi diagnosis',
        supporting_claim_ids: ['C-02'],
        supporting_passage_ids: [],
        supporting_source_ids: [],
        support_result: 'ADEQUATELY_COVERED',
        semantic_answer_reason: 'Answered',
        authority_sufficient: true
      }
    ];

    const gate = validateProblemSolverProductionGate(mockEvaluations, activeTopic);
    assert.equal(gate.passed, false, 'Production gate must fail when authority is insufficient');
    assert.equal(gate.gate_status, 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT');
    assert.ok(gate.insufficient_authority_categories.includes('PLAUSIBLE_CAUSES'));
  });

  // =========================================================================
  // Scenario 12: six irrelevant domains => topic concentration risk remains CRITICAL
  // =========================================================================
  await test('Scenario 12: six irrelevant domains => topic concentration risk remains CRITICAL', () => {
    // 6 distinct domains from historical Final5 (The Conversation, Univ. Selamat Sri, Bima Berilmu, Wiraraja, Jendela Edukasi, Sriwijaya)
    const sixSources = [
      { source_id: 'S1', url: 'https://theconversation.com/sport', publisher: 'The Conversation' },
      { source_id: 'S2', url: 'https://jftr.uniss.ac.id/batang-housing', publisher: 'Universitas Selamat Sri' },
      { source_id: 'S3', url: 'https://bimaberilmu.com/tb-window', publisher: 'Yayasan Bima Berilmu' },
      { source_id: 'S4', url: 'https://ejournalwiraraja.com/election', publisher: 'Universitas Wiraraja' },
      { source_id: 'S5', url: 'https://jendelaedukasi.id/breakfast', publisher: 'CV Jendela Edukasi' },
      { source_id: 'S6', url: 'https://ejournal.unsri.ac.id/silat', publisher: 'Universitas Sriwijaya' }
    ];

    const docRelMap = new Map([
      ['S1', 'IRRELEVANT'],
      ['S2', 'PARTIALLY_RELEVANT'], // Only one partially relevant source!
      ['S3', 'INCIDENTALLY_RELEVANT'],
      ['S4', 'IRRELEVANT'],
      ['S5', 'IRRELEVANT'],
      ['S6', 'IRRELEVANT']
    ]);

    const sourceRoleMap = new Map([
      ['S1', 'GENERAL_EDITORIAL_MEDIA'],
      ['S2', 'SCHOLARLY_JOURNAL_ARTICLE'],
      ['S3', 'GENERAL_EDITORIAL_MEDIA'],
      ['S4', 'SCHOLARLY_JOURNAL_ARTICLE'],
      ['S5', 'GENERAL_EDITORIAL_MEDIA'],
      ['S6', 'SCHOLARLY_JOURNAL_ARTICLE']
    ]);

    const diversity = calculateSourceDiversityQuality(sixSources, docRelMap, sourceRoleMap);
    assert.equal(diversity.retrieved_source_count, 6, 'Must record 6 retrieved sources');
    assert.equal(diversity.independent_domain_count, 6, 'Must record 6 independent domains');
    assert.equal(diversity.relevant_source_count, 1, 'Only 1 relevant source (Batang case study)');
    assert.equal(diversity.independent_relevant_evidence_stream_count, 1, 'Only 1 independent relevant stream');
    assert.equal(diversity.topic_concentration_risk, 'CRITICAL', '6 irrelevant domains must NOT prevent CRITICAL concentration risk');
  });

  // =========================================================================
  // Scenario 13: claim IDs renamed => result unchanged
  // =========================================================================
  await test('Scenario 13: claim IDs renamed => result unchanged', () => {
    const lbnlPassage = {
      passage_id: 'psg_01',
      source_id: 'SRC_01',
      exact_or_normalized_excerpt: 'Aluminium frames have high thermal conductivity unless designed with thermal break barriers.'
    };

    const claimOrig = {
      claim_id: 'CLM-ORIGINAL-01',
      statement: 'Kusen aluminium memiliki konduktivitas tinggi yang menyebabkan embun tanpa pemutus termal.',
      evidence_passage_ids: ['psg_01'],
      sources: [{ source_id: 'SRC_01' }]
    };

    const claimRenamed = {
      claim_id: 'CLM-XYZ-ARBITRARY-999',
      statement: 'Kusen aluminium memiliki konduktivitas tinggi yang menyebabkan embun tanpa pemutus termal.',
      evidence_passage_ids: ['psg_01'],
      sources: [{ source_id: 'SRC_01' }]
    };

    const docRelMap = new Map([['SRC_01', 'HIGHLY_RELEVANT']]);
    const sourceRoleMap = new Map([['SRC_01', 'OFFICIAL_INSTITUTIONAL_GUIDANCE']]);

    const resOrig = evaluateClaimQuality(claimOrig, [lbnlPassage], claimOrig.sources, activeTopic, docRelMap, sourceRoleMap);
    const resRenamed = evaluateClaimQuality(claimRenamed, [lbnlPassage], claimRenamed.sources, activeTopic, docRelMap, sourceRoleMap);

    assert.equal(resOrig.author_safe_final, resRenamed.author_safe_final, 'Author-safe status must be invariant to claim ID renaming');
    assert.equal(resOrig.passage_entailment, resRenamed.passage_entailment);
    assert.equal(resOrig.topic_relevance, resRenamed.topic_relevance);
  });

  // =========================================================================
  // Scenario 14: unrelated arbitrary topic => same logic, no Final5 topic overfit
  // =========================================================================
  await test('Scenario 14: unrelated arbitrary topic => same logic, no Final5 topic overfit', () => {
    const roofTopic = 'Atap Rumah Berisik dan Panas: Pilihan Aluminium Foil Radiant Barrier atau Insulasi Glasswool?';
    const roofEvaluator = new DocumentTopicRelevanceEvaluator();

    // 1. Off-topic article (dental clinic)
    const dentalDoc = {
      title: 'Perawatan Saluran Akar Gigi dan Penambalan Estetis',
      publisher: 'Jurnal Kedokteran Gigi',
      text: 'Gigi berlubang harus ditangani dengan pembersihan saluran akar dan restorasi komposit.'
    };
    const resOff = roofEvaluator.evaluate(roofTopic, dentalDoc);
    assert.equal(resOff.relevance_level, 'IRRELEVANT', 'Arbitrary off-topic document must be IRRELEVANT');

    // 2. Direct topic article (DOE Radiant Barrier)
    const doeDoc = {
      title: 'Radiant Barriers in Attics: Reflective Foil Thermal Performance',
      publisher: 'U.S. Department of Energy',
      text: 'Radiant barriers installed in roof attics reflect solar radiant heat gain and require an adjacent open air space.'
    };
    const resOn = roofEvaluator.evaluate(roofTopic, doeDoc);
    assert.equal(resOn.relevance_level, 'HIGHLY_RELEVANT', 'Direct roof thermal document must be HIGHLY_RELEVANT');
  });

  // =========================================================================
  // Scenario 15: Section W — Historical Final5 Frozen Artifact Offline Replay
  // =========================================================================
  await test('Scenario 15: Historical Final5 Offline Replay (Frozen Artifacts, Zero Live Network)', () => {
    const final5Dir = path.resolve('scripts/runtime-proof/final5');
    const sourcesPath = path.join(final5Dir, 'final5-source-acquisition.json');
    const packPath = path.join(final5Dir, 'final5-evidence-pack.json');
    const claimsPath = path.join(final5Dir, 'final5-author-safe-claims.json');

    assert.ok(fs.existsSync(sourcesPath), 'final5-source-acquisition.json must exist');
    assert.ok(fs.existsSync(packPath), 'final5-evidence-pack.json must exist');
    assert.ok(fs.existsSync(claimsPath), 'final5-author-safe-claims.json must exist');

    const sourcesData = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    const evidencePack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
    const questions = generateEditorialResearchQuestions(activeTopic);

    // Run evaluateAuthorSafeEvidenceGate on historical Final5
    const gateResult = evaluateAuthorSafeEvidenceGate(evidencePack, activeTopic, questions);

    console.log(`\n      [Final5 Forensic Replay Quality Evaluation]`);
    console.log(`      Retrieved Documents:           ${evidencePack.retrieved_documents.length}`);
    console.log(`      Eligible Documents:            ${gateResult.diversity_metrics.relevant_source_count}`);
    console.log(`      Authoritative Relevant Sources:${gateResult.diversity_metrics.authoritative_relevant_source_count}`);
    console.log(`      Relevant Evidence Streams:     ${gateResult.diversity_metrics.independent_relevant_evidence_stream_count}`);
    console.log(`      Topic Concentration Risk:      ${gateResult.diversity_metrics.topic_concentration_risk}`);
    console.log(`      Historical Claim Count:        ${evidencePack.claim_inventory.length}`);
    console.log(`      Author-Safe Claims Count:      ${gateResult.author_safe_claims.length}`);
    console.log(`      Adequate RQ Categories:        ${gateResult.research_coverage.evaluations.filter(e => e.support_result === 'ADEQUATELY_COVERED' || e.support_result === 'STRONGLY_COVERED').length} / 6`);
    console.log(`      Production Gate Status:        ${gateResult.production_gate.gate_status}`);

    // Qualitative forensic assertions:
    // 1. Source relevance:
    const sEvals = gateResult.source_evaluations;
    const sWorkout = sEvals.get('SRC-HTTP-cand_cr_1791245800371_0');
    const sBatang = sEvals.get('SRC-HTTP-cand_cr_1791245800371_1');
    const sTB = sEvals.get('SRC-HTTP-cand_cr_1791245800371_2');
    const sElection = sEvals.get('SRC-HTTP-cand_cr_1791245800371_3');
    const sBreakfast = sEvals.get('SRC-HTTP-cand_cr_1791245800910_3');
    const sSilat = sEvals.get('SRC-HTTP-cand_cr_1791245801323_2');

    assert.equal(sWorkout?.relevance.relevance_level, 'IRRELEVANT', 'Workout source must be IRRELEVANT');
    assert.equal(sElection?.relevance.relevance_level, 'IRRELEVANT', 'Election source must be IRRELEVANT');
    assert.equal(sBreakfast?.relevance.relevance_level, 'IRRELEVANT', 'Breakfast source must be IRRELEVANT');
    assert.equal(sSilat?.relevance.relevance_level, 'IRRELEVANT', 'Silat source must be IRRELEVANT');
    assert.equal(sTB?.relevance.relevance_level, 'INCIDENTALLY_RELEVANT', 'TB window source must be INCIDENTALLY_RELEVANT');
    assert.equal(sBatang?.relevance.relevance_level, 'PARTIALLY_RELEVANT', 'Batang housing source must be PARTIALLY_RELEVANT');

    // 2. Concentration risk must be CRITICAL
    assert.equal(gateResult.diversity_metrics.topic_concentration_risk, 'CRITICAL', 'Final5 concentration risk must be CRITICAL');

    // 3. CLM-112 must be BLOCKED
    const clm112Eval = gateResult.claim_evaluations.get('CLM-112');
    assert.ok(clm112Eval, 'CLM-112 must be evaluated');
    assert.equal(clm112Eval.author_safe_final, false, 'Historical CLM-112 must be BLOCKED');

    // 4. Genuine semantic research question coverage is INSUFFICIENT (0/6 adequate categories)
    assert.equal(gateResult.production_gate.passed, false, 'Production gate must fail closed');
    assert.equal(gateResult.production_gate.gate_status, 'RESEARCH_COVERAGE_QUALITY_INSUFFICIENT');
  });

  console.log(`\n==================================================`);
  console.log(`EVIDENCE-QUALITY-GATE-1 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);
  if (failed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});
