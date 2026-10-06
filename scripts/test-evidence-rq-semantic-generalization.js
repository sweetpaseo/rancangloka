/**
 * RancangLoka Evidence RQ Semantic Generalization Test Suite
 * Milestone: EVIDENCE-RQ-SEMANTIC-GENERALIZATION-1
 *
 * Verifies that the bilingual semantic research-question support evaluator:
 * 1. Correctly connects authentic English, Indonesian, and mixed evidence to canonical RQs.
 * 2. Generalizes across arbitrary building physics & architecture domains without topic-name conditionals.
 * 3. Rejects out-of-domain (medical, software, finance) and title-only false positives.
 * 4. Preserves authority separation and fail-closed policies for UNCERTAIN evidence.
 * 5. Replaces legacy single-topic regexes with general semantic concept profiling.
 * 6. Deterministically replays frozen Wave1B evidence packs.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildResearchQuestionSemanticProfile,
  evaluateResearchQuestionSemanticSupport,
  CATEGORY_SEMANTIC_LEXICON,
  normalizeTechnicalConcept
} from '../src/lib/editorial/research-question-semantics.ts';

import {
  evaluateResearchQuestionSupport,
  evaluateAuthorSafeEvidenceGate
} from '../src/lib/editorial/evidence-quality-gate.ts';

import {
  generateEditorialResearchQuestions,
  validateResearchQuestionCoverage
} from '../src/lib/editorial/research-questions.ts';

let passedCount = 0;
let totalCount = 0;

async function test(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalCount}: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalCount}: ${name}`);
    console.error(err);
    throw err;
  }
}

console.log('==================================================');
console.log('EVIDENCE-RQ-SEMANTIC-GENERALIZATION-1 TEST SUITE');
console.log('==================================================\n');

// ============================================================================
// Test 1: English evidence supports Indonesian RQ semantically
// ============================================================================
await test('English evidence supports Indonesian RQ semantically', () => {
  const rq = {
    question_id: 'RQ-01-CAUSE',
    category: 'PLAUSIBLE_CAUSES',
    question_text: 'Apa saja faktor fisik pemicu timbulnya embun pada permukaan bukaan rumah?',
    rationale: 'Menjelaskan mekanisme perpindahan panas dan titik embun',
    expected_evidence_roles: ['CAUSE_MECHANISM']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  const claim = {
    claim_id: 'CLM-EN-01',
    statement: 'Surface condensation occurs when interior glass temperature falls below the dew point of humid indoor air.',
    semantic_role: 'CAUSE_MECHANISM',
    evidence_passage_ids: ['PSG-EN-01'],
    sources: [{ source_id: 'SRC-SCHOLAR-01' }]
  };

  const passages = [{
    passage_id: 'PSG-EN-01',
    source_id: 'SRC-SCHOLAR-01',
    exact_text: 'Surface condensation occurs on building fenestration when the interior surface temperature drops below the dew point under high indoor relative humidity.',
    semantic_role: 'CAUSE_MECHANISM'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'SCHOLARLY_JOURNAL_ARTICLE'
  });

  assert.equal(res.support_level, 'SUPPORTED', 'English building science evidence must semantically support Indonesian RQ');
  assert.ok(res.matched_concepts.length >= 2, 'Must match subject and category concepts');
  assert.ok(res.supporting_passage_ids.includes('PSG-EN-01'));
});

// ============================================================================
// Test 2: Indonesian evidence supports equivalent RQ
// ============================================================================
await test('Indonesian evidence supports equivalent RQ', () => {
  const rq = {
    question_id: 'RQ-03-INTERVENTION',
    category: 'INTERVENTION_MAPPING',
    question_text: 'Bagaimana pemutus termal bekerja mengurangi konduksi panas pada profil aluminium?',
    rationale: 'Menjelaskan fungsi insulasi profil',
    expected_evidence_roles: ['INTERVENTION_EFFECT']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Memahami Thermal Bridge pada Kusen Aluminium: Mengapa Permukaan Kusen Bisa Terasa Sangat Panas atau Dingin?'
  );

  const claim = {
    claim_id: 'CLM-ID-01',
    statement: 'Pemutus termal poliamida pada profil kusen aluminium menyekat jalur konduksi panas dan mengurangi transfer termal.',
    semantic_role: 'INTERVENTION_EFFECT',
    evidence_passage_ids: ['PSG-ID-01'],
    sources: [{ source_id: 'SRC-STD-01' }]
  };

  const passages = [{
    passage_id: 'PSG-ID-01',
    source_id: 'SRC-STD-01',
    exact_text: 'Penerapan pemutus termal berupa strip poliamida pada profil kusen aluminium berhasil menghambat konduksi panas dan menurunkan koefisien perpindahan panas.',
    semantic_role: 'INTERVENTION_EFFECT'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'TECHNICAL_STANDARD'
  });

  assert.equal(res.support_level, 'SUPPORTED', 'Indonesian building science evidence must semantically support intervention RQ');
  assert.ok(res.matched_concepts.length >= 2);
});

// ============================================================================
// Test 3: Mixed technical terminology supported
// ============================================================================
await test('Mixed technical terminology supported', () => {
  const rq = {
    question_id: 'RQ-04-LIMITS',
    category: 'LIMITATIONS_AND_FALSE_FIXES',
    question_text: 'Apa batasan teknis dan tindakan semu yang kerap keliru diterapkan?',
    rationale: 'Menjelaskan kekeliruan umum',
    expected_evidence_roles: ['LIMITATION']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  const claim = {
    claim_id: 'CLM-MIXED-01',
    statement: 'Menyeka kaca atau wiping embun hanyalah temporary measure dan false fix yang tidak mengatasi thermal bypass.',
    semantic_role: 'LIMITATION',
    evidence_passage_ids: ['PSG-MIXED-01'],
    sources: [{ source_id: 'SRC-GUIDE-01' }]
  };

  const passages = [{
    passage_id: 'PSG-MIXED-01',
    source_id: 'SRC-GUIDE-01',
    exact_text: 'Wiping surface moisture is an ineffective false fix; it does not resolve indoor relative humidity or building envelope thermal bridging.',
    semantic_role: 'LIMITATION'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'OFFICIAL_INSTITUTIONAL_GUIDANCE'
  });

  assert.equal(res.support_level, 'SUPPORTED', 'Mixed ID/EN technical vocabulary must resolve cleanly');
});

// ============================================================================
// Test 4: Window condensation generalizes
// ============================================================================
await test('Window condensation generalizes without per-topic hardcoding', () => {
  const topic = 'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?';
  const rqs = generateEditorialResearchQuestions(topic);
  assert.equal(rqs.length, 6);

  const profiles = rqs.map(q => buildResearchQuestionSemanticProfile(q, topic));
  assert.ok(profiles.every(p => p.subject_concepts.includes('jendela') || p.subject_concepts.includes('kaca') || p.subject_concepts.includes('embun')));
});

// ============================================================================
// Test 5: Thermal bridge generalizes
// ============================================================================
await test('Thermal bridge generalizes without per-topic hardcoding', () => {
  const topic = 'Memahami Thermal Bridge pada Kusen Aluminium: Mengapa Permukaan Kusen Bisa Terasa Sangat Panas atau Dingin?';
  const rqs = generateEditorialResearchQuestions(topic);
  const diffQ = rqs.find(q => q.category === 'DIFFERENTIAL_DIAGNOSIS');
  assert.ok(diffQ);

  const profile = buildResearchQuestionSemanticProfile(diffQ, topic);
  assert.ok(profile.subject_concepts.some(c => c.includes('kusen') || c.includes('aluminium') || c.includes('thermal bridge')));
});

// ============================================================================
// Test 6: Solar shading generalizes
// ============================================================================
await test('Solar shading generalizes without per-topic hardcoding', () => {
  const topic = 'Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?';
  const rqs = generateEditorialResearchQuestions(topic);
  const interventionQ = rqs.find(q => q.category === 'INTERVENTION_MAPPING');
  assert.ok(interventionQ);

  const profile = buildResearchQuestionSemanticProfile(interventionQ, topic);
  assert.ok(profile.subject_concepts.some(c => c.includes('shading') || c.includes('overhang') || c.includes('louver')));
});

// ============================================================================
// Test 7: Ceramic tile popping generalizes
// ============================================================================
await test('Tile failure generalizes without per-topic hardcoding', () => {
  const topic = 'Keramik Lantai Terangkat atau Popping: Analisis Pemuaian, Kualitas Perekat, dan Peran Movement Joint';
  const rqs = generateEditorialResearchQuestions(topic);
  const causeQ = rqs.find(q => q.category === 'PLAUSIBLE_CAUSES');
  assert.ok(causeQ);

  const profile = buildResearchQuestionSemanticProfile(causeQ, topic);
  assert.ok(profile.subject_concepts.some(c => c.includes('keramik') || c.includes('popping')));

  const claim = {
    claim_id: 'CLM-TILE-01',
    statement: 'Thermal expansion of ceramic tiles induces shear stress in thin-set mortar without expansion joints.',
    semantic_role: 'CAUSE_MECHANISM',
    evidence_passage_ids: ['PSG-TILE-01'],
    sources: [{ source_id: 'SRC-CERAMIC-01' }]
  };

  const passages = [{
    passage_id: 'PSG-TILE-01',
    source_id: 'SRC-CERAMIC-01',
    exact_text: 'Thermal expansion of tile flooring produces shear stress at the adhesive bond line when movement joints are omitted.',
    semantic_role: 'CAUSE_MECHANISM'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'SCHOLARLY_JOURNAL_ARTICLE'
  });

  assert.equal(res.support_level, 'SUPPORTED', 'Tile popping mechanics must be evaluated as SUPPORTED');
});

// ============================================================================
// Test 8: Roof drainage generalizes
// ============================================================================
await test('Roof drainage generalizes without per-topic hardcoding', () => {
  const topic = 'Mengatasi Kebocoran Talang Jurai dan Flashing Atap Rumah Saat Hujan Deras';
  const rqs = generateEditorialResearchQuestions(topic);
  const escQ = rqs.find(q => q.category === 'ESCALATION_CONDITIONS');
  assert.ok(escQ);

  const profile = buildResearchQuestionSemanticProfile(escQ, topic);

  const claim = {
    claim_id: 'CLM-ROOF-01',
    statement: 'Rembesan struktural pada rangka atap akibat kebocoran talang jurai membutuhkan inspeksi profesional.',
    semantic_role: 'RISK',
    evidence_passage_ids: ['PSG-ROOF-01'],
    sources: [{ source_id: 'SRC-ROOF-01' }]
  };

  const passages = [{
    passage_id: 'PSG-ROOF-01',
    source_id: 'SRC-ROOF-01',
    exact_text: 'Severe water intrusion from valley gutter overflow causes structural rot in timber roof framing requiring engineering inspection.',
    semantic_role: 'RISK'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'TECHNICAL_STANDARD'
  });

  assert.equal(res.support_level, 'SUPPORTED', 'Roof drainage escalation must be evaluated as SUPPORTED');
});

// ============================================================================
// Test 9: Bathroom ventilation generalizes
// ============================================================================
await test('Bathroom ventilation generalizes without per-topic hardcoding', () => {
  const topic = 'Ventilasi Kamar Mandi Lembap: Peran Exhaust Fan, Make-up Air, dan Pencegahan Jamur';
  const rqs = generateEditorialResearchQuestions(topic);
  const intQ = rqs.find(q => q.category === 'INTERVENTION_MAPPING');
  assert.ok(intQ);

  const profile = buildResearchQuestionSemanticProfile(intQ, topic);

  const claim = {
    claim_id: 'CLM-VENT-01',
    statement: 'Exhaust fan dengan make-up air memadai mengurangi akumulasi uap air dan kelembapan ruangan.',
    semantic_role: 'INTERVENTION_EFFECT',
    evidence_passage_ids: ['PSG-VENT-01'],
    sources: [{ source_id: 'SRC-VENT-01' }]
  };

  const passages = [{
    passage_id: 'PSG-VENT-01',
    source_id: 'SRC-VENT-01',
    exact_text: 'Dedicated mechanical exhaust ventilation with adequate make-up air removes indoor moisture and reduces microbial contamination.',
    semantic_role: 'INTERVENTION_EFFECT'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'OFFICIAL_INSTITUTIONAL_GUIDANCE'
  });

  assert.equal(res.support_level, 'SUPPORTED', 'Bathroom ventilation intervention must be evaluated as SUPPORTED');
});

// ============================================================================
// Test 10: Irrelevant medical evidence rejected
// ============================================================================
await test('Irrelevant medical evidence rejected', () => {
  const rq = {
    question_id: 'RQ-01-CAUSE',
    category: 'PLAUSIBLE_CAUSES',
    question_text: 'Apa saja faktor fisik pemicu timbulnya embun pada permukaan bukaan rumah?',
    rationale: 'Fisika bangunan',
    expected_evidence_roles: ['CAUSE_MECHANISM']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  const claim = {
    claim_id: 'CLM-MED-01',
    statement: 'Clinical moisture condensation in respiratory ventilators increases bacterial infection risks for hospital patients.',
    semantic_role: 'CAUSE_MECHANISM',
    evidence_passage_ids: ['PSG-MED-01'],
    sources: [{ source_id: 'SRC-MED-01' }]
  };

  const passages = [{
    passage_id: 'PSG-MED-01',
    source_id: 'SRC-MED-01',
    exact_text: 'Clinical evaluation of moisture condensation inside ventilator breathing circuits showed elevated bacterial colony counts among intensive care unit patients.',
    semantic_role: 'CAUSE_MECHANISM'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'SCHOLARLY_JOURNAL_ARTICLE'
  });

  assert.equal(res.support_level, 'UNSUPPORTED', 'Medical ventilator condensation must be rejected as out-of-domain');
  assert.ok(res.support_reason.includes('ranah luar domain') || res.support_reason.includes('UNSUPPORTED'));
});

// ============================================================================
// Test 11: Software "window" false positive rejected
// ============================================================================
await test('Software "window" false positive rejected', () => {
  const rq = {
    question_id: 'RQ-01-CAUSE',
    category: 'PLAUSIBLE_CAUSES',
    question_text: 'Apa saja faktor pemicu masalah bukaan jendela?',
    rationale: 'Fisika bangunan',
    expected_evidence_roles: ['CAUSE_MECHANISM']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  const claim = {
    claim_id: 'CLM-SOFT-01',
    statement: 'Sliding window buffer mechanism optimizes neural network execution throughput in Linux kernel.',
    semantic_role: 'CAUSE_MECHANISM',
    evidence_passage_ids: ['PSG-SOFT-01'],
    sources: [{ source_id: 'SRC-SOFT-01' }]
  };

  const passages = [{
    passage_id: 'PSG-SOFT-01',
    source_id: 'SRC-SOFT-01',
    exact_text: 'A sliding window buffer algorithm optimizes frame execution throughput in high concurrency neural network pipelines.',
    semantic_role: 'CAUSE_MECHANISM'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'SCHOLARLY_JOURNAL_ARTICLE'
  });

  assert.equal(res.support_level, 'UNSUPPORTED', 'Software sliding window must be rejected');
});

// ============================================================================
// Test 12: Title-only relevance insufficient
// ============================================================================
await test('Title-only relevance insufficient (unlinked claim rejected)', () => {
  const rq = {
    question_id: 'RQ-01-CAUSE',
    category: 'PLAUSIBLE_CAUSES',
    question_text: 'Apa faktor pemicu kondensasi?',
    rationale: 'Fisika bangunan',
    expected_evidence_roles: ['CAUSE_MECHANISM']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  // Claim with empty evidence_passage_ids
  const claim = {
    claim_id: 'CLM-TITLE-01',
    statement: 'Kondensasi disebabkan perbedaan suhu permukaan kaca dan titik embun.',
    semantic_role: 'CAUSE_MECHANISM',
    evidence_passage_ids: [],
    sources: [{ source_id: 'SRC-TITLE-01' }]
  };

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages: [],
    sourceRole: 'SCHOLARLY_JOURNAL_ARTICLE'
  });

  assert.equal(res.support_level, 'UNSUPPORTED', 'Claim without passage link must fail as UNSUPPORTED');
  assert.ok(res.support_reason.includes('tidak memiliki rujukan passage'));
});

// ============================================================================
// Test 13: Authoritative but semantically irrelevant source rejected
// ============================================================================
await test('Authoritative but semantically irrelevant source rejected', () => {
  const rq = {
    question_id: 'RQ-01-CAUSE',
    category: 'PLAUSIBLE_CAUSES',
    question_text: 'Apa faktor pemicu kondensasi bukaan?',
    rationale: 'Fisika bangunan',
    expected_evidence_roles: ['CAUSE_MECHANISM']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  const claim = {
    claim_id: 'CLM-FIRE-01',
    statement: 'ASTM E119 provides standard fire tests for building construction and materials.',
    semantic_role: 'REGULATORY_REFERENCE',
    evidence_passage_ids: ['PSG-FIRE-01'],
    sources: [{ source_id: 'SRC-ASTM-01' }]
  };

  const passages = [{
    passage_id: 'PSG-FIRE-01',
    source_id: 'SRC-ASTM-01',
    exact_text: 'ASTM E119 standard test methods evaluate the duration for which building assemblies contain a fire and retain structural integrity under standardized fire exposure.',
    semantic_role: 'REGULATORY_REFERENCE'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'TECHNICAL_STANDARD'
  });

  assert.equal(res.support_level, 'UNSUPPORTED', 'Fire resistance standard does not answer condensation cause');
});

// ============================================================================
// Test 14: Semantically relevant but insufficient-authority source remains authority-limited
// ============================================================================
await test('Semantically relevant but insufficient-authority source remains authority-limited', () => {
  const rq = {
    question_id: 'RQ-06-STD',
    category: 'EMPIRICAL_RECOMMENDATION_SUPPORT',
    question_text: 'Apa standar dan ambang batas U-factor yang direkomendasikan?',
    rationale: 'Standar teknis',
    expected_evidence_roles: ['REGULATORY_REFERENCE']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  const claim = {
    claim_id: 'CLM-BLOG-01',
    statement: 'Nilai U-factor kusen jendela sebaiknya berada di bawah ambang batas 2.0 W/m2K untuk efisiensi energi optimal.',
    semantic_role: 'REGULATORY_REFERENCE',
    evidence_passage_ids: ['PSG-BLOG-01'],
    sources: [{ source_id: 'SRC-BLOG-01' }]
  };

  const passages = [{
    passage_id: 'PSG-BLOG-01',
    source_id: 'SRC-BLOG-01',
    exact_text: 'Berdasarkan artikel blog dekorasi rumah, u-factor kusen jendela sebaiknya di bawah ambang batas standar efisiensi.',
    semantic_role: 'REGULATORY_REFERENCE'
  }];

  const res = evaluateResearchQuestionSemanticSupport({
    profile,
    claim,
    passages,
    sourceRole: 'GENERAL_EDITORIAL_MEDIA' // Insufficient for EMPIRICAL_RECOMMENDATION_SUPPORT
  });

  assert.equal(res.support_level, 'SUPPORTED', 'Semantic match is recognized');
  assert.equal(res.authority_sufficient, false, 'Authority must remain insufficient for popular blog source');
});

// ============================================================================
// Test 15: PARTIAL distinct from SUPPORTED
// ============================================================================
await test('PARTIAL distinct from SUPPORTED', () => {
  const rq = {
    question_id: 'RQ-02-DIAG',
    category: 'DIFFERENTIAL_DIAGNOSIS',
    question_text: 'Bagaimana cara mendiagnosis dan membedakan kebocoran air vs kondensasi permukaan?',
    rationale: 'Diferensiasi gejala',
    expected_evidence_roles: ['DIAGNOSTIC_SIGNAL']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  // Partial: matches 1 category concept ('perbedaan') without secondary diagnostic terms or role bonus
  const claimPartial = {
    claim_id: 'CLM-PARTIAL-01',
    statement: 'Karakteristik kaca dipengaruhi oleh perbedaan iklim makro dan orientasi bangunan.',
    evidence_passage_ids: ['PSG-PARTIAL-01'],
    sources: [{ source_id: 'SRC-P-01' }]
  };

  const passagesPartial = [{
    passage_id: 'PSG-PARTIAL-01',
    source_id: 'SRC-P-01',
    exact_text: 'Karakteristik termal kaca dipengaruhi oleh perbedaan iklim makro dan posisi orientasi fasad bangunan.'
  }];

  const resPartial = evaluateResearchQuestionSemanticSupport({
    profile,
    claim: claimPartial,
    passages: passagesPartial,
    sourceRole: 'TECHNICAL_STANDARD'
  });

  assert.equal(resPartial.support_level, 'PARTIAL', 'Single concept match should evaluate to PARTIAL');

  // Supported: matches diagnostic role and multiple category concepts ('membedakan', 'gejala', 'diagnosis')
  const claimSupported = {
    claim_id: 'CLM-SUPP-01',
    statement: 'Untuk membedakan kebocoran vs kondensasi, periksa tanda visual dan pola kelembapan pada kaca jendela.',
    semantic_role: 'DIAGNOSTIC_SIGNAL',
    evidence_passage_ids: ['PSG-SUPP-01'],
    sources: [{ source_id: 'SRC-S-01' }]
  };

  const passagesSupported = [{
    passage_id: 'PSG-SUPP-01',
    source_id: 'SRC-S-01',
    exact_text: 'Membedakan kebocoran air dengan kondensasi dilakukan melalui deteksi pola kelembapan dan tanda visual pada permukaan kaca jendela.',
    semantic_role: 'DIAGNOSTIC_SIGNAL'
  }];

  const resSupported = evaluateResearchQuestionSemanticSupport({
    profile,
    claim: claimSupported,
    passages: passagesSupported,
    sourceRole: 'TECHNICAL_STANDARD'
  });

  assert.equal(resSupported.support_level, 'SUPPORTED', 'Rich concept match with role bonus must be SUPPORTED');
  assert.notEqual(resPartial.support_level, resSupported.support_level);
});

// ============================================================================
// Test 16: UNCERTAIN remains fail-closed
// ============================================================================
await test('UNCERTAIN remains fail-closed in production gate', () => {
  const rq = {
    question_id: 'RQ-05-ESCALATION',
    category: 'ESCALATION_CONDITIONS',
    question_text: 'Kapan pemilik rumah harus menghubungi ahli untuk inspeksi struktural?',
    rationale: 'Eskalasi',
    expected_evidence_roles: ['RISK']
  };

  const profile = buildResearchQuestionSemanticProfile(
    rq,
    'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  );

  // Vague text: mentions window/glass but has 0 escalation terms
  const claimVague = {
    claim_id: 'CLM-VAGUE-01',
    statement: 'Kaca jendela bangunan perumahan umumnya menggunakan lembaran bening berketebalan standar.',
    evidence_passage_ids: ['PSG-VAGUE-01'],
    sources: [{ source_id: 'SRC-V-01' }]
  };

  const passagesVague = [{
    passage_id: 'PSG-VAGUE-01',
    source_id: 'SRC-V-01',
    exact_text: 'Lembaran kaca bening pada jendela perumahan dipasang dengan bingkai aluminium atau kayu untuk pencahayaan alami.'
  }];

  const semRes = evaluateResearchQuestionSemanticSupport({
    profile,
    claim: claimVague,
    passages: passagesVague,
    sourceRole: 'SCHOLARLY_JOURNAL_ARTICLE'
  });

  assert.equal(semRes.support_level, 'UNCERTAIN', 'Ambiguous evidence without category answer must yield UNCERTAIN');

  // Verify that UNCERTAIN does not satisfy the production gate
  const claimMap = new Map([
    ['CLM-VAGUE-01', {
      claim_id: 'CLM-VAGUE-01',
      author_safe_final: true,
      statement: claimVague.statement
    }]
  ]);

  const rqSupport = evaluateResearchQuestionSupport(
    [rq],
    [claimVague],
    passagesVague,
    claimMap,
    new Map([['SRC-V-01', 'SCHOLARLY_JOURNAL_ARTICLE']]),
    'Jendela Berkondensasi'
  );

  assert.equal(rqSupport.evaluations[0].support_result, 'NOT_COVERED', 'UNCERTAIN must fail closed to NOT_COVERED');
  assert.equal(rqSupport.covered_categories.length, 0);
  assert.ok(rqSupport.missing_categories.includes('ESCALATION_CONDITIONS'));
});

// ============================================================================
// Test 17: No topic-name production conditionals
// ============================================================================
await test('No topic-name production conditionals in quality gate or semantic evaluator', () => {
  const gateSource = fs.readFileSync(path.resolve('src/lib/editorial/evidence-quality-gate.ts'), 'utf-8');
  const semanticsSource = fs.readFileSync(path.resolve('src/lib/editorial/research-question-semantics.ts'), 'utf-8');
  const rqSource = fs.readFileSync(path.resolve('src/lib/editorial/research-questions.ts'), 'utf-8');

  // Banned patterns: if topic.includes('window'), if (topic === 'tile'), etc.
  const bannedTopicConditionals = [
    /if\s*\([^)]*topic\.includes\(['"]window/i,
    /if\s*\([^)]*topic\.includes\(['"]thermal\s*bridge/i,
    /if\s*\([^)]*topic\.includes\(['"]shading/i,
    /if\s*\([^)]*topic\.includes\(['"]tile/i,
    /if\s*\([^)]*topic\s*===/i
  ];

  for (const pat of bannedTopicConditionals) {
    assert.ok(!pat.test(gateSource), `evidence-quality-gate.ts must not contain per-topic conditionals: ${pat}`);
    assert.ok(!pat.test(semanticsSource), `research-question-semantics.ts must not contain per-topic conditionals: ${pat}`);
    assert.ok(!pat.test(rqSource), `research-questions.ts must not contain per-topic conditionals: ${pat}`);
  }
});

// ============================================================================
// Test 18: Old topic-specific regexes absent from production RQ gate
// ============================================================================
await test('Old topic-specific regexes absent from production RQ gate', () => {
  const gateSource = fs.readFileSync(path.resolve('src/lib/editorial/evidence-quality-gate.ts'), 'utf-8');

  // Find evaluateResearchQuestionSupport function body
  const fnMatch = gateSource.match(/export function evaluateResearchQuestionSupport[\s\S]*?^}/m);
  assert.ok(fnMatch, 'evaluateResearchQuestionSupport must exist');
  const fnBody = fnMatch[0];

  const bannedLegacyStrings = [
    'lap kaca',
    'menutup ventilasi',
    'bocor vs embun',
    'exhaust fan|ventilasi|dehumidifier',
    'korosi|jamur masif|drainase tersumbat'
  ];

  for (const s of bannedLegacyStrings) {
    assert.ok(!fnBody.includes(s), `Legacy string "${s}" must not remain hardcoded in evaluateResearchQuestionSupport`);
  }
});

// ============================================================================
// Test 19: Raw coverage does not automatically imply semantic coverage
// ============================================================================
await test('Raw coverage does not automatically imply semantic coverage', () => {
  const topic = 'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?';
  const rqs = generateEditorialResearchQuestions(topic);
  const causeQ = rqs.find(q => q.category === 'PLAUSIBLE_CAUSES');

  // A claim that has lexical keyword match ("penyebab", "jendela") but answers a completely different domain question
  const irrelevantClaim = {
    claim_id: 'CLM-IRR-01',
    statement: 'Penyebab kerusakan sistem operasi pada komputer kantor adalah bug software jendela aplikasi.',
    semantic_role: 'CAUSE_MECHANISM',
    evidence_passage_ids: ['PSG-IRR-01'],
    sources: [{ source_id: 'SRC-IRR-01' }]
  };

  const passages = [{
    passage_id: 'PSG-IRR-01',
    source_id: 'SRC-IRR-01',
    exact_text: 'Penyebab kerusakan sistem operasi pada jendela program aplikasi perkantoran.'
  }];

  // 1. Raw RQ coverage in research-questions.ts might match due to lexical overlap
  const rawCoverage = validateResearchQuestionCoverage([causeQ], {
    retrieved_documents: [{ source_id: 'SRC-IRR-01', source_origin: 'LIVE_RETRIEVAL' }],
    claim_inventory: [irrelevantClaim],
    evidence_passages: passages
  });

  // 2. Semantic RQ coverage in evaluateResearchQuestionSupport
  const claimMap = new Map([
    ['CLM-IRR-01', {
      claim_id: 'CLM-IRR-01',
      author_safe_final: true,
      statement: irrelevantClaim.statement
    }]
  ]);

  const semanticCoverage = evaluateResearchQuestionSupport(
    [causeQ],
    [irrelevantClaim],
    passages,
    claimMap,
    new Map([['SRC-IRR-01', 'SCHOLARLY_JOURNAL_ARTICLE']]),
    topic
  );

  // Semantic evaluator rejects software false positive
  assert.equal(semanticCoverage.evaluations[0].support_result, 'NOT_COVERED', 'Semantic gate must reject irrelevant proposition despite any raw lexical match');
  assert.equal(semanticCoverage.covered_categories.length, 0);
});

// ============================================================================
// Test 20: Frozen Wave1B artifacts replay deterministically
// ============================================================================
await test('Frozen Wave1B artifacts replay deterministically', () => {
  // Replay Article A (Window condensation)
  const topicA = 'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?';
  const rqsA = generateEditorialResearchQuestions(topicA);

  const frozenPackA = {
    retrieved_documents: [
      {
        source_id: 'SRC-WIKI-DEW',
        title: 'Dew point',
        publisher: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Dew_point',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'The dew point is the temperature to which air must be cooled to become saturated with water vapor. When the surface temperature of glass falls below the dew point, condensation occurs.'
      },
      {
        source_id: 'SRC-WIKI-COND',
        title: 'Condensation',
        publisher: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Condensation',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'Condensation on windows occurs when warm moist air contacts cold glass surfaces. Thermal breaks in window frames reduce conductive heat transfer.'
      },
      {
        source_id: 'SRC-WIKI-IGU',
        title: 'Insulated glazing',
        publisher: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Insulated_glazing',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'Insulated glazing units reduce thermal transmittance (U-factor). Severe perimeter seal failure permits moisture intrusion between panes requiring specialist replacement.'
      },
      {
        source_id: 'SRC-STD-ASHRAE',
        title: 'ASHRAE Standard 90.1: Energy Standard for Buildings Except Low-Rise Residential Buildings',
        publisher: 'ASHRAE / Technical Standard',
        url: 'https://www.ashrae.org/standards/90-1',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'Building energy standards establish fenestration U-factor criteria and interior relative humidity limits to mitigate condensation.'
      }
    ],
    claim_inventory: [
      {
        claim_id: 'CLM-A-01',
        statement: 'Kondensasi pada kaca jendela terjadi ketika suhu permukaan kaca turun di bawah titik embun (dew point) udara ruangan.',
        semantic_role: 'CAUSE_MECHANISM',
        evidence_passage_ids: ['PSG-A-01'],
        sources: [{ source_id: 'SRC-WIKI-DEW' }]
      },
      {
        claim_id: 'CLM-A-02',
        statement: 'Untuk membedakan kebocoran air hujan dengan kondensasi, periksa tanda perbedaan suhu dan pola embun pada permukaan kusen.',
        semantic_role: 'DIAGNOSTIC_SIGNAL',
        evidence_passage_ids: ['PSG-A-02'],
        sources: [{ source_id: 'SRC-WIKI-COND' }]
      },
      {
        claim_id: 'CLM-A-03',
        statement: 'Penerapan thermal break dan insulated glazing secara efektif menurunkan konduksi panas dan menaikkan suhu permukaan kaca.',
        semantic_role: 'INTERVENTION_EFFECT',
        evidence_passage_ids: ['PSG-A-03'],
        sources: [{ source_id: 'SRC-WIKI-IGU' }]
      },
      {
        claim_id: 'CLM-A-04',
        statement: 'Menyeka embun berkala hanyalah solusi semu yang tidak mengatasi sumber kelembapan atau thermal bridge.',
        semantic_role: 'LIMITATION',
        evidence_passage_ids: ['PSG-A-04'],
        sources: [{ source_id: 'SRC-WIKI-COND' }]
      },
      {
        claim_id: 'CLM-A-05',
        statement: 'Kerusakan perimeter seal pada insulated glazing menuntut inspeksi ahli dan penggantian unit kaca.',
        semantic_role: 'RISK',
        evidence_passage_ids: ['PSG-A-05'],
        sources: [{ source_id: 'SRC-WIKI-IGU' }]
      },
      {
        claim_id: 'CLM-A-06',
        statement: 'Standar efisiensi energi merekomendasikan batas nilai U-factor dan evaluasi ventilasi udara ruangan.',
        semantic_role: 'REGULATORY_REFERENCE',
        claim_class: 'editorial_recommendation',
        derived_from_claim_ids: ['CLM-A-01', 'CLM-A-03'],
        evidence_passage_ids: ['PSG-A-06'],
        sources: [{ source_id: 'SRC-STD-ASHRAE' }]
      }
    ],
    evidence_passages: [
      {
        passage_id: 'PSG-A-01',
        source_id: 'SRC-WIKI-DEW',
        exact_text: 'When the surface temperature of glass falls below the dew point of humid air, condensation occurs on the surface.',
        semantic_role: 'CAUSE_MECHANISM'
      },
      {
        passage_id: 'PSG-A-02',
        source_id: 'SRC-WIKI-COND',
        exact_text: 'Identifying difference between external leakage and condensation relies on temperature difference and moisture pattern.',
        semantic_role: 'DIAGNOSTIC_SIGNAL'
      },
      {
        passage_id: 'PSG-A-03',
        source_id: 'SRC-WIKI-IGU',
        exact_text: 'Insulated glazing and thermal breaks improve interior surface temperature and reduce thermal transmittance.',
        semantic_role: 'INTERVENTION_EFFECT'
      },
      {
        passage_id: 'PSG-A-04',
        source_id: 'SRC-WIKI-COND',
        exact_text: 'Wiping surface moisture does not solve thermal bridging or relative humidity boundary conditions.',
        semantic_role: 'LIMITATION'
      },
      {
        passage_id: 'PSG-A-05',
        source_id: 'SRC-WIKI-IGU',
        exact_text: 'Severe perimeter seal failure permits moisture intrusion between panes requiring specialist replacement and building inspection.',
        semantic_role: 'RISK'
      },
      {
        passage_id: 'PSG-A-06',
        source_id: 'SRC-STD-ASHRAE',
        exact_text: 'Building standards recommend u-factor thresholds and proper ventilation practices for condensation control.',
        semantic_role: 'REGULATORY_REFERENCE'
      }
    ]
  };

  // Old evaluator simulation (representing pre-fix single-topic regexes)
  function evaluateRQSupportOld(questions, claims) {
    const covered = [];
    for (const q of questions) {
      let match = false;
      for (const c of claims) {
        const stmt = (c.statement || '').toLowerCase();
        if (q.category === 'PLAUSIBLE_CAUSES') {
          if (/\b(?:penyebab|memicu|radiasi|konduksi|titik embun|dew point|suhu dingin|kondensasi|kelembapan tinggi)\b/i.test(stmt)) match = true;
        } else if (q.category === 'DIFFERENTIAL_DIAGNOSIS') {
          if (/\b(?:membedakan|tanda|gejala|diagnosis|titik embun|perbedaan suhu|kelembapan ruangan|bocor vs embun)\b/i.test(stmt)) match = true;
        } else if (q.category === 'INTERVENTION_MAPPING') {
          if (/\b(?:thermal break|pemutus termal|exhaust fan|ventilasi|dehumidifier|insulasi|u-factor)\b/i.test(stmt)) match = true;
        } else if (q.category === 'LIMITATIONS_AND_FALSE_FIXES') {
          if (/\b(?:bukan solusi|keterbatasan|menutup ventilasi|lap kaca|tidak menghilangkan|sumber kelembapan)\b/i.test(stmt)) match = true;
        } else if (q.category === 'ESCALATION_CONDITIONS') {
          if (/\b(?:korosi|jamur masif|drainase tersumbat|inspeksi|rembesan struktural|kebocoran perimeter)\b/i.test(stmt)) match = true;
        } else if (q.category === 'EMPIRICAL_RECOMMENDATION_SUPPORT') {
          if (/\b(?:rekomendasi|prioritas|evaluasi ventilasi|ukur kelembapan|pertimbangkan profil berpenghalang)\b/i.test(stmt)) match = true;
        }
      }
      if (match) covered.push(q.category);
    }
    return covered;
  }

  // --- Article A (Window condensation) ---
  const gateResultA = evaluateAuthorSafeEvidenceGate(frozenPackA, topicA, rqsA);
  const oldCoveredA = evaluateRQSupportOld(rqsA, frozenPackA.claim_inventory);
  console.log(`    Article A (Window Condensation):`);
  console.log(`      OLD RQ Support: ${oldCoveredA.length}/6 covered ([${oldCoveredA.join(', ')}])`);
  console.log(`      NEW RQ Support: ${gateResultA.research_coverage.evaluations.filter(e => e.support_result !== 'NOT_COVERED').length}/6 covered`);
  for (const ev of gateResultA.research_coverage.evaluations) {
    console.log(`        - ${ev.category}: ${ev.support_result} (${ev.supporting_claim_ids.length} claims, ${ev.supporting_passage_ids.length} passages)`);
  }
  assert.equal(gateResultA.passed, true, 'Article A gate must PASS with valid bilingual evidence pack');

  // --- Article B (Aluminium Thermal Bridge) ---
  const topicB = 'Memahami Thermal Bridge pada Kusen Aluminium: Mengapa Permukaan Kusen Bisa Terasa Sangat Panas atau Dingin?';
  const rqsB = generateEditorialResearchQuestions(topicB);
  const frozenPackB = {
    retrieved_documents: [
      {
        source_id: 'SRC-B-TB',
        title: 'Thermal bridge',
        publisher: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Thermal_bridge',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'A thermal bridge is an area of a building envelope with significantly higher heat transfer than surrounding materials, common in uninsulated aluminium frames.'
      },
      {
        source_id: 'SRC-B-TBRK',
        title: 'Thermal break',
        publisher: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Thermal_break',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'A thermal break incorporates a low thermal conductivity polyamide barrier within the aluminium window profile to reduce heat flow and surface temperature drops.'
      },
      {
        source_id: 'SRC-B-ISO',
        title: 'ISO 10077-2: Thermal performance of windows, doors and shutters - Calculation of thermal transmittance',
        publisher: 'ISO / Technical Standard',
        url: 'https://www.iso.org/standard/65708.html',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'ISO 10077 establishes numerical calculations for frame thermal transmittance and linear thermal bridge coefficients (Psi-values).'
      }
    ],
    claim_inventory: [
      {
        claim_id: 'CLM-B-01',
        statement: 'Thermal bridging in aluminium frames accelerates heat transfer across the building envelope due to high metal thermal conductivity.',
        semantic_role: 'CAUSE_MECHANISM',
        evidence_passage_ids: ['PSG-B-01'],
        sources: [{ source_id: 'SRC-B-TB' }]
      },
      {
        claim_id: 'CLM-B-02',
        statement: 'Membedakan perbedaan suhu kusen akibat konduksi thermal bridge vs infiltrasi udara dilakukan melalui uji deteksi kebocoran perimeter.',
        semantic_role: 'DIAGNOSTIC_SIGNAL',
        evidence_passage_ids: ['PSG-B-02'],
        sources: [{ source_id: 'SRC-B-TB' }]
      },
      {
        claim_id: 'CLM-B-03',
        statement: 'Polyamide thermal breaks significantly improve aluminium frame thermal performance and reduce conductive heat flux.',
        semantic_role: 'INTERVENTION_EFFECT',
        evidence_passage_ids: ['PSG-B-03'],
        sources: [{ source_id: 'SRC-B-TBRK' }]
      },
      {
        claim_id: 'CLM-B-04',
        statement: 'Pengecatan ulang atau coating film tipis pada kusen adalah false fix yang tidak mengatasi degradasi akibat thermal bypass konduktif.',
        semantic_role: 'LIMITATION',
        evidence_passage_ids: ['PSG-B-04'],
        sources: [{ source_id: 'SRC-B-TBRK' }]
      },
      {
        claim_id: 'CLM-B-05',
        statement: 'Severe structural corrosion and persistent moisture accumulation in framing require specialist building inspection.',
        semantic_role: 'RISK',
        evidence_passage_ids: ['PSG-B-05'],
        sources: [{ source_id: 'SRC-B-TB' }]
      },
      {
        claim_id: 'CLM-B-06',
        statement: 'Standar ISO 10077 merekomendasikan batas koefisien thermal transmittance untuk profil kusen jendela.',
        semantic_role: 'REGULATORY_REFERENCE',
        claim_class: 'editorial_recommendation',
        derived_from_claim_ids: ['CLM-B-01', 'CLM-B-03'],
        evidence_passage_ids: ['PSG-B-06'],
        sources: [{ source_id: 'SRC-B-ISO' }]
      }
    ],
    evidence_passages: [
      {
        passage_id: 'PSG-B-01',
        source_id: 'SRC-B-TB',
        exact_text: 'Thermal bridging in aluminium frames accelerates heat transfer across the envelope due to metal thermal conductivity.',
        semantic_role: 'CAUSE_MECHANISM'
      },
      {
        passage_id: 'PSG-B-02',
        source_id: 'SRC-B-TB',
        exact_text: 'Differentiating thermal bridge heat loss from perimeter air infiltration requires infrared thermography and airtightness detection.',
        semantic_role: 'DIAGNOSTIC_SIGNAL'
      },
      {
        passage_id: 'PSG-B-03',
        source_id: 'SRC-B-TBRK',
        exact_text: 'Polyamide thermal breaks in aluminium extrusion reduce heat transfer coefficient and improve interior surface temperature.',
        semantic_role: 'INTERVENTION_EFFECT'
      },
      {
        passage_id: 'PSG-B-04',
        source_id: 'SRC-B-TBRK',
        exact_text: 'Surface painting or interior film is an ineffective trade-off that cannot eliminate conductive thermal bridge pathways.',
        semantic_role: 'LIMITATION'
      },
      {
        passage_id: 'PSG-B-05',
        source_id: 'SRC-B-TB',
        exact_text: 'Persistent moisture accumulation and framing corrosion require specialist building inspection and perimeter seal remediation.',
        semantic_role: 'RISK'
      },
      {
        passage_id: 'PSG-B-06',
        source_id: 'SRC-B-ISO',
        exact_text: 'ISO standard calculation method specifies thermal transmittance threshold and measurement for architectural profiles.',
        semantic_role: 'REGULATORY_REFERENCE'
      }
    ]
  };

  const gateResultB = evaluateAuthorSafeEvidenceGate(frozenPackB, topicB, rqsB);
  const oldCoveredB = evaluateRQSupportOld(rqsB, frozenPackB.claim_inventory);
  console.log(`    Article B (Aluminium Thermal Bridge):`);
  console.log(`      OLD RQ Support: ${oldCoveredB.length}/6 covered ([${oldCoveredB.join(', ')}])`);
  console.log(`      NEW RQ Support: ${gateResultB.research_coverage.evaluations.filter(e => e.support_result !== 'NOT_COVERED').length}/6 covered`);
  for (const ev of gateResultB.research_coverage.evaluations) {
    console.log(`        - ${ev.category}: ${ev.support_result} (${ev.supporting_claim_ids.length} claims, ${ev.supporting_passage_ids.length} passages)`);
  }

  // --- Article C (Exterior Solar Shading) ---
  const topicC = 'Memilih Sistem Shading Luar untuk Rumah Tropis: Overhang, Louver, Awning, atau Secondary Facade?';
  const rqsC = generateEditorialResearchQuestions(topicC);
  const frozenPackC = {
    retrieved_documents: [
      {
        source_id: 'SRC-C-SHADE',
        title: 'Solar shading',
        publisher: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Solar_shading',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'Solar shading devices reduce solar heat gain through exterior overhang, louver, or awning attachments on building facades.'
      },
      {
        source_id: 'SRC-C-BRISE',
        title: 'Brise soleil',
        publisher: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Brise_soleil',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'A brise soleil is an architectural shading feature that prevents excessive solar heat gain while preserving daylighting in tropical facades.'
      },
      {
        source_id: 'SRC-C-ASHRAE',
        title: 'ASHRAE Guideline: Solar Heat Gain and Daylight Integration in Building Facades',
        publisher: 'ASHRAE / Technical Standard',
        url: 'https://www.ashrae.org/guidelines/shading',
        source_origin: 'LIVE_RETRIEVAL',
        raw_content_preview: 'Standard guidelines specify solar heat gain coefficient (SHGC) reduction targets for external shading devices.'
      }
    ],
    claim_inventory: [
      {
        claim_id: 'CLM-C-01',
        statement: 'Exterior solar shading directly reduces solar heat gain through the building envelope before radiant energy penetrates glazing.',
        semantic_role: 'CAUSE_MECHANISM',
        evidence_passage_ids: ['PSG-C-01'],
        sources: [{ source_id: 'SRC-C-SHADE' }]
      },
      {
        claim_id: 'CLM-C-02',
        statement: 'Membedakan kebutuhan shading horizontal overhang vs vertical louver bergantung pada orientasi fasad utara-selatan vs timur-barat.',
        semantic_role: 'DIAGNOSTIC_SIGNAL',
        evidence_passage_ids: ['PSG-C-02'],
        sources: [{ source_id: 'SRC-C-SHADE' }]
      },
      {
        claim_id: 'CLM-C-03',
        statement: 'Brise soleil and exterior louvers block direct solar radiation while allowing natural daylight penetration into living spaces.',
        semantic_role: 'INTERVENTION_EFFECT',
        evidence_passage_ids: ['PSG-C-03'],
        sources: [{ source_id: 'SRC-C-BRISE' }]
      },
      {
        claim_id: 'CLM-C-04',
        statement: 'Shading luar memiliki trade-off kehilangan cahaya alami (loss of daylight) dan beban perawatan akumulasi debu bila sudut louver terlalu rapat.',
        semantic_role: 'LIMITATION',
        evidence_passage_ids: ['PSG-C-04'],
        sources: [{ source_id: 'SRC-C-BRISE' }]
      },
      {
        claim_id: 'CLM-C-05',
        statement: 'Kerusakan struktural pada anchor point teritisan atau anchor awning akibat beban angin memerlukan inspeksi profesional kontraktor.',
        semantic_role: 'RISK',
        evidence_passage_ids: ['PSG-C-05'],
        sources: [{ source_id: 'SRC-C-SHADE' }]
      },
      {
        claim_id: 'CLM-C-06',
        statement: 'Standar teknis ASHRAE merekomendasikan target pengurangan SHGC dan evaluasi sudut jatuh matahari tahunan.',
        semantic_role: 'REGULATORY_REFERENCE',
        claim_class: 'editorial_recommendation',
        derived_from_claim_ids: ['CLM-C-01', 'CLM-C-03'],
        evidence_passage_ids: ['PSG-C-06'],
        sources: [{ source_id: 'SRC-C-ASHRAE' }]
      }
    ],
    evidence_passages: [
      {
        passage_id: 'PSG-C-01',
        source_id: 'SRC-C-SHADE',
        exact_text: 'External shading intercepts solar heat gain before radiation reaches the glass envelope, reducing indoor cooling loads.',
        semantic_role: 'CAUSE_MECHANISM'
      },
      {
        passage_id: 'PSG-C-02',
        source_id: 'SRC-C-SHADE',
        exact_text: 'Differentiating horizontal overhangs and vertical louvers depends on solar path geometry and facade solar orientation.',
        semantic_role: 'DIAGNOSTIC_SIGNAL'
      },
      {
        passage_id: 'PSG-C-03',
        source_id: 'SRC-C-BRISE',
        exact_text: 'Brise-soleil architectural louvers block direct radiation while preserving diffused daylight and ventilation.',
        semantic_role: 'INTERVENTION_EFFECT'
      },
      {
        passage_id: 'PSG-C-04',
        source_id: 'SRC-C-BRISE',
        exact_text: 'Exterior shading presents limitations including loss of daylight and dust accumulation maintenance constraints.',
        semantic_role: 'LIMITATION'
      },
      {
        passage_id: 'PSG-C-05',
        source_id: 'SRC-C-SHADE',
        exact_text: 'Structural anchorage failure under extreme wind loads presents a safety hazard requiring engineering inspection.',
        semantic_role: 'RISK'
      },
      {
        passage_id: 'PSG-C-06',
        source_id: 'SRC-C-ASHRAE',
        exact_text: 'ASHRAE engineering guidance specifies SHGC threshold reduction and solar shading design benchmarks.',
        semantic_role: 'REGULATORY_REFERENCE'
      }
    ]
  };

  const gateResultC = evaluateAuthorSafeEvidenceGate(frozenPackC, topicC, rqsC);
  const oldCoveredC = evaluateRQSupportOld(rqsC, frozenPackC.claim_inventory);
  console.log(`    Article C (Exterior Solar Shading):`);
  console.log(`      OLD RQ Support: ${oldCoveredC.length}/6 covered ([${oldCoveredC.join(', ')}])`);
  console.log(`      NEW RQ Support: ${gateResultC.research_coverage.evaluations.filter(e => e.support_result !== 'NOT_COVERED').length}/6 covered`);
  for (const ev of gateResultC.research_coverage.evaluations) {
    console.log(`        - ${ev.category}: ${ev.support_result} (${ev.supporting_claim_ids.length} claims, ${ev.supporting_passage_ids.length} passages)`);
  }
  const replayA2 = evaluateAuthorSafeEvidenceGate(frozenPackA, topicA, rqsA);
  assert.deepEqual(
    gateResultA.research_coverage.covered_categories,
    replayA2.research_coverage.covered_categories,
    'Article A replay must be 100% deterministic'
  );

  const replayB2 = evaluateAuthorSafeEvidenceGate(frozenPackB, topicB, rqsB);
  assert.deepEqual(
    gateResultB.research_coverage.covered_categories,
    replayB2.research_coverage.covered_categories,
    'Article B replay must be 100% deterministic'
  );

  const replayC2 = evaluateAuthorSafeEvidenceGate(frozenPackC, topicC, rqsC);
  assert.deepEqual(
    gateResultC.research_coverage.covered_categories,
    replayC2.research_coverage.covered_categories,
    'Article C replay must be 100% deterministic'
  );

  assert.equal(gateResultA.research_coverage.evaluations.length, 6);
  assert.equal(gateResultB.research_coverage.evaluations.length, 6);
  assert.equal(gateResultC.research_coverage.evaluations.length, 6);
});

console.log('\n==================================================');
console.log(`RESULTS: ${passedCount}/${totalCount} tests passed cleanly.`);
console.log('==================================================');
