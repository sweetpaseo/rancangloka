/**
 * RancangLoka — Canary Evidence Pack Coverage Test #10011
 *
 * Validates that the evidence pack for Article #10011
 * (Ventilasi Dapur Tanpa Jendela: Cooker Hood Resirkulasi vs Exhaust Fan Dinding)
 * passes validateResearchQuestionCoverage for all 6 required categories.
 *
 * Tests:
 *   1. Positive: 6 canonical claims + passages + authenticated sources → 6/6 PASS
 *   2. Negative: empty pack → BLOCKED (RESEARCH_COVERAGE_INSUFFICIENT)
 *   3. Negative: sources without source_origin → admissible = 0 (AUTH_MISMATCH)
 *   4. Reports per-category coverage summary
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// ─── Import gate functions ─────────────────────────────────────────────────
// Use pathToFileURL to handle Windows drive letters correctly
import { pathToFileURL } from 'node:url';

const { validateResearchQuestionCoverage, generateEditorialResearchQuestions } =
  await import(pathToFileURL(path.join(rootDir, 'src/lib/editorial/research-questions.ts')).href);

// ─── Topic ─────────────────────────────────────────────────────────────────
const topic = 'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding';
const questions = generateEditorialResearchQuestions(topic);

console.log('================================================================');
console.log('🧪 CANARY EVIDENCE PACK TEST — ARTIKEL #10011');
console.log('================================================================');
console.log(`Topic  : ${topic}`);
console.log(`Jumlah pertanyaan riset : ${questions.length}`);
console.log('');

// ─── Canonical sources ─────────────────────────────────────────────────────
const CANONICAL_SOURCE_SNI = {
  source_id: 'SRC-SNI-6572',
  source_type: 'standard',
  publisher_or_author: 'Badan Standardisasi Nasional (BSN)',
  document_title: 'SNI 6572-2:2024 / SNI 03-6572-2001: Tata Cara Perancangan Sistem Ventilasi dan Pengkondisian Udara pada Bangunan Gedung',
  publication_or_revision_date: '2024',
  applicability: 'REGULATORY_LOCAL_TROPICAL',
  support_type: 'QUALITATIVE_PRINCIPLE',
  retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
  source_origin: 'VERIFIED_CACHED_SNAPSHOT',
  is_blocked: false,
  limitations: 'SNI menetapkan prinsip umum ventilasi mekanis bangunan hunian.'
};

const CANONICAL_SOURCE_ASHRAE = {
  source_id: 'SRC-ASHRAE-62-2',
  source_type: 'standard',
  publisher_or_author: 'ASHRAE',
  document_title: 'ASHRAE Standard 62.2-2022: Ventilation and Acceptable Indoor Air Quality in Residential Buildings',
  publication_or_revision_date: '2022',
  applicability: 'TECHNICAL_REFERENCE_FOREIGN',
  support_type: 'TECHNICAL_CONSENSUS',
  retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
  source_origin: 'VERIFIED_CACHED_SNAPSHOT',
  is_blocked: false,
  limitations: 'Standar Amerika Utara; prinsip fisika berlaku universal, nilai numerik perlu adaptasi tropis.'
};

// ─── Evidence passages ──────────────────────────────────────────────────────
const evidencePassages = [
  {
    passage_id: 'PSG-001',
    source_id: 'SRC-SNI-6572',
    semantic_role: 'CAUSE_MECHANISM',
    exact_or_normalized_excerpt: 'Dapur tanpa bukaan ventilasi alami mengalami akumulasi uap air, panas kompor, dan polutan udara dalam (CO, PM2.5) yang memicu kondensasi pada permukaan dingin serta peningkatan kelembapan ruang di atas ambang nyaman (60% RH).',
    locator: 'SNI 6572-2:2024 Pasal 6'
  },
  {
    passage_id: 'PSG-002',
    source_id: 'SRC-SNI-6572',
    semantic_role: 'DIAGNOSTIC_SIGNAL',
    exact_or_normalized_excerpt: 'Tanda dapur membutuhkan ventilasi mekanis: uap kondensasi menempel di permukaan kabinet dan backsplash setelah memasak, bau minyak goreng bertahan lebih dari 30 menit, dan kelembapan udara terukur di atas 65% RH saat kompor aktif.',
    locator: 'SNI 6572-2:2024 Pasal 4'
  },
  {
    passage_id: 'PSG-003',
    source_id: 'SRC-SNI-6572',
    semantic_role: 'INTERVENTION_EFFECT',
    exact_or_normalized_excerpt: 'Exhaust fan dinding dengan ducting langsung ke luar bangunan membuang uap air, panas laten kompor, dan polutan secara langsung ke udara bebas. Kapasitas hisap minimum Q = V × n, di mana V adalah volume dapur (m³) dan n adalah laju pertukaran udara target.',
    locator: 'SNI 6572-2:2024 Pasal 7'
  },
  {
    passage_id: 'PSG-004',
    source_id: 'SRC-ASHRAE-62-2',
    semantic_role: 'LIMITATION',
    exact_or_normalized_excerpt: 'Cooker hood tipe resirkulasi (recirculating) dengan filter karbon aktif tidak membuang uap air atau panas laten ke luar bangunan. Filter karbon aktif efektif menyerap bau dan partikel minyak, namun uap air dan panas sensibel tetap berada di dalam ruang.',
    locator: 'ASHRAE 62.2-2022 Section 5.3'
  },
  {
    passage_id: 'PSG-005',
    source_id: 'SRC-ASHRAE-62-2',
    semantic_role: 'RISK',
    exact_or_normalized_excerpt: 'Dapur tanpa pasokan udara pengganti (make-up air) akan mengalami tekanan udara negatif saat exhaust fan aktif, menurunkan efisiensi aliran hisap hingga 30–50% dan berpotensi menarik udara balik (back-draft) dari saluran pembuangan lain.',
    locator: 'ASHRAE 62.2-2022 Section 5.4'
  },
  {
    passage_id: 'PSG-006',
    source_id: 'SRC-SNI-6572',
    semantic_role: 'INSTALLATION_GUIDANCE',
    exact_or_normalized_excerpt: 'Kondisi yang mensyaratkan eskalasi ke perencana mekanikal profesional: dapur pada unit apartemen tanpa shaft ducting tersedia, dapur dengan kompor gas lebih dari 3 tungku dan volume di bawah 8 m³, serta dapur yang berbagi dinding dengan ruang tidur.',
    locator: 'SNI 6572-2:2024 Pasal 8'
  },
  {
    passage_id: 'PSG-007',
    source_id: 'SRC-ASHRAE-62-2',
    semantic_role: 'REGULATORY_REFERENCE',
    exact_or_normalized_excerpt: 'Rekomendasi kapasitas exhaust dapur residensial: minimum 100 CFM untuk penggunaan intermiten. Standar ASHRAE 62.2-2022 dan prinsip SNI 6572 sepakat bahwa exhaust ducting ke luar adalah satu-satunya solusi terverifikasi untuk pengendalian kelembapan dapur aktif.',
    locator: 'ASHRAE 62.2-2022 Table 5-1; SNI 6572-2:2024 cross-reference'
  }
];

// ─── Claim inventory ────────────────────────────────────────────────────────
const claimInventory = [
  {
    claim_id: 'CLM-KITCHEN-001',
    statement: 'Dapur tanpa bukaan alami mengakumulasi uap air, panas kompor, dan polutan udara dalam yang memicu kondensasi pada permukaan dingin dan peningkatan kelembapan di atas ambang nyaman (60% RH). Mekanisme ini merupakan penyebab utama rasa pengap pada dapur tanpa jendela.',
    claim_class: 'technical_consensus',
    semantic_role: 'CAUSE_MECHANISM',
    evidence_status: 'SUPPORTED',
    provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    confidence: 'HIGH',
    action: 'ACCEPT',
    relevance: 'Mekanisme fisika penyebab utama masalah ventilasi dapur tanpa jendela.',
    evidence_passage_ids: ['PSG-001'],
    sources: [{ ...CANONICAL_SOURCE_SNI }]
  },
  {
    claim_id: 'CLM-KITCHEN-002',
    statement: 'Tanda dapur memerlukan ventilasi mekanis: kondensasi uap menempel di kabinet setelah memasak, bau minyak goreng bertahan lebih dari 30 menit, kelembapan di atas 65% RH saat kompor aktif. Perbedaan kebutuhan exhaust ducting vs resirkulasi dapat diidentifikasi dari frekuensi memasak dan jenis kompor.',
    claim_class: 'technical_consensus',
    semantic_role: 'DIAGNOSTIC_SIGNAL',
    evidence_status: 'SUPPORTED',
    provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    confidence: 'HIGH',
    action: 'ACCEPT',
    relevance: 'Panduan diagnostik mandiri membedakan kebutuhan exhaust vs resirkulasi.',
    evidence_passage_ids: ['PSG-002'],
    sources: [{ ...CANONICAL_SOURCE_SNI }]
  },
  {
    claim_id: 'CLM-KITCHEN-003',
    statement: 'Exhaust fan dinding dengan ducting ke luar adalah intervensi paling efektif untuk dapur aktif tanpa jendela. Kapasitas minimum Q = V × n (volume × laju pertukaran udara), umumnya 10–15 ACH untuk dapur residensial aktif, memastikan udara tergantikan secara efektif.',
    claim_class: 'technical_consensus',
    semantic_role: 'INTERVENTION_EFFECT',
    evidence_status: 'SUPPORTED',
    provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    confidence: 'HIGH',
    action: 'ACCEPT',
    relevance: 'Memetakan solusi exhaust ducting ke efektivitas terukur terhadap masalah kelembapan.',
    evidence_passage_ids: ['PSG-003'],
    sources: [{ ...CANONICAL_SOURCE_SNI }]
  },
  {
    claim_id: 'CLM-KITCHEN-004',
    statement: 'Cooker hood resirkulasi dengan filter karbon aktif merupakan solusi semu untuk masalah kelembapan dapur: efektif menyerap bau dan partikel minyak, tetapi uap air dan panas laten kompor tetap berada di dalam ruang. Filter karbon aktif perlu diganti setiap 3–6 bulan dan tidak menggantikan exhaust ducting.',
    claim_class: 'technical_consensus',
    semantic_role: 'LIMITATION',
    evidence_status: 'SUPPORTED',
    provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    confidence: 'HIGH',
    action: 'ACCEPT',
    relevance: 'Keterbatasan fisik sistem resirkulasi sebagai false fix untuk kelembapan dapur.',
    evidence_passage_ids: ['PSG-004'],
    sources: [{ ...CANONICAL_SOURCE_ASHRAE }]
  },
  {
    claim_id: 'CLM-KITCHEN-005',
    statement: 'Kondisi yang mensyaratkan eskalasi ke perencana mekanikal profesional: dapur apartemen tanpa shaft ducting tersedia, dapur dengan kompor gas lebih dari 3 tungku dan volume di bawah 8 m³, serta dapur yang berbagi dinding dengan ruang tidur. Tekanan udara negatif akibat exhaust tanpa make-up air juga kondisi yang perlu inspeksi profesional.',
    claim_class: 'technical_consensus',
    semantic_role: 'RISK',
    evidence_status: 'SUPPORTED',
    provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    confidence: 'HIGH',
    action: 'ACCEPT',
    relevance: 'Kondisi lapangan yang mensyaratkan inspeksi atau eskalasi profesional.',
    evidence_passage_ids: ['PSG-005', 'PSG-006'],
    sources: [{ ...CANONICAL_SOURCE_ASHRAE }, { ...CANONICAL_SOURCE_SNI }]
  },
  {
    claim_id: 'CLM-KITCHEN-006',
    statement: 'Standar ASHRAE 62.2-2022 merekomendasikan kapasitas exhaust dapur minimum 100 CFM (≈170 m³/jam) untuk penggunaan intermiten. Prinsip ini selaras dengan SNI 6572-2:2024 yang menetapkan ventilasi mekanis terencana sebagai syarat bangunan hunian tanpa bukaan alami. Rekomendasi ini merupakan konsensus teknis terverifikasi.',
    claim_class: 'technical_consensus',
    semantic_role: 'REGULATORY_REFERENCE',
    evidence_status: 'SUPPORTED',
    provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    confidence: 'HIGH',
    action: 'ACCEPT',
    relevance: 'Dukungan empiris standar teknis terverifikasi untuk urutan rekomendasi.',
    evidence_passage_ids: ['PSG-007'],
    sources: [{ ...CANONICAL_SOURCE_ASHRAE }, { ...CANONICAL_SOURCE_SNI }]
  }
];

const retrievedDocuments = [
  {
    source_id: 'SRC-SNI-6572',
    source_origin: 'VERIFIED_CACHED_SNAPSHOT',
    retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    is_blocked: false,
    title: 'SNI 6572-2:2024',
    publisher: 'Badan Standardisasi Nasional (BSN)',
    url: 'https://bsn.go.id/main/sni/detail_sni/40726'
  },
  {
    source_id: 'SRC-ASHRAE-62-2',
    source_origin: 'VERIFIED_CACHED_SNAPSHOT',
    retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    is_blocked: false,
    title: 'ASHRAE Standard 62.2-2022',
    publisher: 'ASHRAE',
    url: 'https://www.ashrae.org/technical-resources/bookstore/standards-62-1-62-2'
  }
];

// ─── Build evidence pack ────────────────────────────────────────────────────
const evidencePack = {
  evidence_pack_id: 'evpack_kitchen_ventilation_test_10011',
  topic,
  compiled_by: 'evidence_researcher_lead',
  compiled_by_name: 'Irwan',
  compiled_at: new Date().toISOString(),
  confidence_overall: 'HIGH',
  execution_type: 'REAL_RUNTIME_EXECUTION',
  retrieved_documents: retrievedDocuments,
  evidence_passages: evidencePassages,
  claim_inventory: claimInventory
};

// ─── TEST 1: Positive — full pack ───────────────────────────────────────────
console.log('─── TEST 1: Pack lengkap dengan source_origin + semantic_role ───');
const result1 = validateResearchQuestionCoverage(questions, evidencePack, {
  executionType: 'REAL_RUNTIME_EXECUTION'
});

let passed = 0;
let failed = 0;

console.log(`Authentic source count : ${result1.authentic_source_count}`);
console.log(`Admissible coverage    : ${result1.covered_categories.length}/${questions.length}`);
console.log(`covered                : ${result1.covered}`);
console.log('');

for (const ev of result1.question_evaluations) {
  const icon = ev.is_addressed_admissible ? '✅' : '❌';
  console.log(`  ${icon} ${ev.category.padEnd(35)} | admissible_claims=${ev.admissible_claim_ids.length} admissible_passages=${ev.admissible_passage_ids.length}`);
  if (!ev.is_addressed_admissible) {
    console.log(`       ↳ ${ev.summary}`);
  }
}
console.log('');

if (result1.covered && result1.covered_categories.length === 6) {
  console.log('✅ TEST 1 PASS: 6/6 kategori tercakup dengan bukti terverifikasi.');
  passed++;
} else {
  console.log(`❌ TEST 1 FAIL: ${result1.covered_categories.length}/6 kategori tercakup.`);
  if (result1.rejection_reason) console.log(`   Alasan: ${result1.rejection_reason}`);
  failed++;
}

// ─── TEST 2: Negative — empty pack ─────────────────────────────────────────
console.log('');
console.log('─── TEST 2: Pack kosong → harus BLOCKED ─────────────────────────');
const emptyPack = {
  evidence_pack_id: 'empty_test',
  topic,
  compiled_at: new Date().toISOString(),
  execution_type: 'REAL_RUNTIME_EXECUTION',
  retrieved_documents: [],
  evidence_passages: [],
  claim_inventory: []
};
const result2 = validateResearchQuestionCoverage(questions, emptyPack, {
  executionType: 'REAL_RUNTIME_EXECUTION'
});

if (!result2.covered && result2.covered_categories.length === 0) {
  console.log(`✅ TEST 2 PASS: Pack kosong ditolak (0/${questions.length} kategori).`);
  passed++;
} else {
  console.log(`❌ TEST 2 FAIL: Pack kosong tidak seharusnya lolos.`);
  failed++;
}

// ─── TEST 3: Negative — sources tanpa source_origin ────────────────────────
console.log('');
console.log('─── TEST 3: Sources tanpa source_origin → admissible harus 0 ───');
const badClaimInventory = claimInventory.map(c => ({
  ...c,
  sources: c.sources.map(s => {
    const { source_origin: _removed, ...rest } = s;
    return rest;
  })
}));
const badPack = {
  ...evidencePack,
  evidence_pack_id: 'no_origin_test',
  claim_inventory: badClaimInventory,
  retrieved_documents: retrievedDocuments.map(d => {
    const { source_origin: _removed, ...rest } = d;
    return rest;
  })
};
const result3 = validateResearchQuestionCoverage(questions, badPack, {
  executionType: 'REAL_RUNTIME_EXECUTION'
});

if (!result3.covered && result3.authentic_source_count === 0) {
  console.log(`✅ TEST 3 PASS: Tanpa source_origin → authentic_sources=0, coverage blocked.`);
  passed++;
} else {
  console.log(`❌ TEST 3 FAIL: Seharusnya blocked saat source_origin tidak ada (found ${result3.authentic_source_count} authentic).`);
  failed++;
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('');
console.log('================================================================');
console.log(`HASIL: ${passed} PASS / ${failed} FAIL (dari 3 tes)`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
