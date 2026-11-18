/**
 * RancangLoka — Canary Writer Prompt Domain Isolation & Preflight Test #10011
 *
 * Verifies that:
 * 1. Positive: Target Article #10011 (Ventilasi Dapur) prompt builds cleanly without domain leaks.
 * 2. Positive: Research coverage gate passes 6/6.
 * 3. Positive: Editorial brief outline contains 0 "Anda" and relevant sections.
 * 4. Positive: LLM request payload is structured properly.
 * 5. Negative: Injected foreign domain terms (e.g. 'atap metal', 'ventilasi loteng') fail with WRITER_PROMPT_DOMAIN_LEAK.
 * 6. Negative: Off-topic / empty evidence pack is blocked fail-closed.
 * 7. Regression: Another non-roof comparison topic (e.g. "Kusen Aluminium vs UPVC") produces 0 leaks.
 */

import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const { compileEditorialBrief, detectEditorialArticleFamily } =
  await import(pathToFileURL(path.join(rootDir, 'src/lib/editorial/editorial-planner.ts')).href);
const { buildJokoPrompt, auditPromptSemanticLeaks } =
  await import(pathToFileURL(path.join(rootDir, 'src/lib/editorial/joko-prompt-builder.ts')).href);
const { validateResearchQuestionCoverage, generateEditorialResearchQuestions } =
  await import(pathToFileURL(path.join(rootDir, 'src/lib/editorial/research-questions.ts')).href);

console.log('================================================================');
console.log('🧪 TEST CANARY WRITER PROMPT ISOLATION & PRE-LLM VALIDATION');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}`);
    failed++;
  }
}

// ─── CANONICAL CANARY #10011 FIXTURES ───────────────────────────────────────
const topic = 'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding';
const requestedTitle = 'Ventilasi Dapur Tanpa Jendela: Solusi Cooker Hood Resirkulasi vs Exhaust Fan Dinding';

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
  limitations: 'Standar Amerika Utara; prinsip fisika ventilasi berlaku universal.'
};

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
    exact_or_normalized_excerpt: 'Exhaust fan dinding dengan ducting langsung ke luar bangunan membuang uap air, panas laten kompor, dan polutan secara langsung ke udara bebas. Kapasitas hisap minimum Q = V × n, di mana V adalah volume dapur (m³) dan n adalah laju pertukaran udara target (umumnya 10–15 ACH untuk dapur residensial aktif).',
    locator: 'SNI 6572-2:2024 Pasal 7'
  },
  {
    passage_id: 'PSG-004',
    source_id: 'SRC-ASHRAE-62-2',
    semantic_role: 'LIMITATION',
    exact_or_normalized_excerpt: 'Cooker hood tipe resirkulasi (recirculating) dengan filter karbon aktif tidak membuang uap air atau panas laten ke luar bangunan. Filter karbon aktif efektif menyerap bau dan partikel minyak, namun uap air dan panas sensibel tetap berada di dalam ruang, sehingga sistem resirkulasi bukan solusi untuk kelembapan tinggi dapur.',
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
    exact_or_normalized_excerpt: 'Kondisi yang mensyaratkan eskalasi ke perencana mekanikal profesional: dapur pada unit apartemen tanpa shaft ducting tersedia, dapur dengan kompor gas >3 tungku dan volume <8 m³, serta dapur yang berbagi dinding dengan ruang tidur.',
    locator: 'SNI 6572-2:2024 Pasal 8'
  },
  {
    passage_id: 'PSG-007',
    source_id: 'SRC-ASHRAE-62-2',
    semantic_role: 'REGULATORY_REFERENCE',
    exact_or_normalized_excerpt: 'Rekomendasi kapasitas exhaust dapur residensial: minimum 100 CFM (≈170 m³/jam) untuk penggunaan intermiten atau 25 CFM (≈42 m³/jam) kontinu. Standar ASHRAE 62.2-2022 dan prinsip SNI 6572 sepakat bahwa exhaust ducting ke luar adalah satu-satunya solusi terverifikasi untuk pengendalian kelembapan dapur aktif.',
    locator: 'ASHRAE 62.2-2022 Table 5-1'
  }
];

const claimInventory = [
  {
    claim_id: 'CLM-KITCHEN-001',
    statement: 'Dapur tanpa bukaan alami mengakumulasi uap air, panas kompor, dan polutan udara dalam yang memicu kondensasi pada permukaan dingin dan peningkatan kelembapan di atas ambang nyaman (60% RH). Mekanisme ini merupakan penyebab utama rasa pengap dan pertumbuhan jamur pada dapur tanpa jendela.',
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
    statement: 'Tanda dapur memerlukan ventilasi mekanis mencakup: kondensasi uap menempel di kabinet setelah memasak, bau minyak goreng bertahan lebih dari 30 menit, dan kelembapan terukur di atas 65% RH saat kompor aktif. Perbedaan antara dapur yang perlu exhaust ducting vs yang cukup dengan resirkulasi dapat diidentifikasi dari frekuensi memasak dan jenis kompor (gas vs induksi).',
    claim_class: 'technical_consensus',
    semantic_role: 'DIAGNOSTIC_SIGNAL',
    evidence_status: 'SUPPORTED',
    provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    confidence: 'HIGH',
    action: 'ACCEPT',
    relevance: 'Panduan diagnostik mandiri untuk membedakan kebutuhan ventilasi exhaust vs resirkulasi.',
    evidence_passage_ids: ['PSG-002'],
    sources: [{ ...CANONICAL_SOURCE_SNI }]
  },
  {
    claim_id: 'CLM-KITCHEN-003',
    statement: 'Exhaust fan dinding dengan ducting ke luar adalah intervensi paling efektif untuk dapur aktif tanpa jendela. Kapasitas minimum Q = V × n (volume dapur × laju pertukaran udara), umumnya 10–15 ACH untuk dapur residensial aktif, memastikan udara tergantikan secara efektif. Cooker hood ducting juga masuk kategori solusi ini selama saluran benar-benar terhubung ke luar bangunan.',
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
    statement: 'Cooker hood resirkulasi dengan filter karbon aktif merupakan solusi semu untuk masalah kelembapan dapur: efektif menyerap bau dan partikel minyak, tetapi uap air dan panas laten kompor tetap berada di dalam ruang. Filter karbon aktif perlu diganti setiap 3–6 bulan dan tidak menggantikan fungsi exhaust ducting untuk pengendalian kelembapan.',
    claim_class: 'technical_consensus',
    semantic_role: 'LIMITATION',
    evidence_status: 'SUPPORTED',
    provenance_retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    confidence: 'HIGH',
    action: 'ACCEPT',
    relevance: 'Keterbatasan fisik sistem resirkulasi sebagai false fix untuk masalah kelembapan dapur.',
    evidence_passage_ids: ['PSG-004'],
    sources: [{ ...CANONICAL_SOURCE_ASHRAE }]
  },
  {
    claim_id: 'CLM-KITCHEN-005',
    statement: 'Kondisi yang mensyaratkan eskalasi ke perencana mekanikal profesional: dapur apartemen tanpa shaft ducting tersedia, dapur dengan kompor gas lebih dari 3 tungku dan volume di bawah 8 m³, serta dapur yang berbagi dinding dengan ruang tidur. Tekanan udara negatif akibat exhaust tanpa make-up air juga merupakan kondisi yang perlu penanganan profesional bila terjadi back-draft.',
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
    statement: 'Standar ASHRAE 62.2-2022 merekomendasikan kapasitas exhaust dapur minimum 100 CFM (≈170 m³/jam) untuk penggunaan intermiten. Prinsip ini selaras dengan SNI 6572-2:2024 yang menetapkan ventilasi mekanis terencana sebagai syarat bangunan hunian tanpa bukaan alami. Rekomendasi ini merupakan konsensus teknis terverifikasi, bukan estimasi semata.',
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

const authorSafeClaims = claimInventory.map(c => ({
  claim_id: c.claim_id,
  statement: c.statement,
  allowed_for_authoring: true,
  confidence: c.confidence,
  relevance: c.relevance
}));

const retrievedDocuments = [
  {
    source_id: 'SRC-SNI-6572',
    source_origin: 'VERIFIED_CACHED_SNAPSHOT',
    retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    is_blocked: false,
    title: 'SNI 6572-2:2024 / SNI 03-6572-2001: Tata Cara Perancangan Sistem Ventilasi dan Pengkondisian Udara pada Bangunan Gedung',
    publisher: 'Badan Standardisasi Nasional (BSN)',
    url: 'https://bsn.go.id/main/sni/detail_sni/40726'
  },
  {
    source_id: 'SRC-ASHRAE-62-2',
    source_origin: 'VERIFIED_CACHED_SNAPSHOT',
    retrieval_status: 'SOURCE_RETRIEVED_AND_VERIFIED',
    is_blocked: false,
    title: 'ASHRAE Standard 62.2-2022: Ventilation and Acceptable Indoor Air Quality in Residential Buildings',
    publisher: 'ASHRAE',
    url: 'https://www.ashrae.org/technical-resources/bookstore/standards-62-1-62-2'
  }
];

const evidencePack = {
  evidence_pack_id: 'evpack_kitchen_ventilation_sni_01',
  topic,
  compiled_by: 'evidence_researcher_lead',
  compiled_by_name: 'Irwan',
  target_agent: 'content_writer_primary',
  target_agent_name: 'Joko',
  compiled_at: new Date().toISOString(),
  confidence_overall: 'HIGH',
  execution_type: 'REAL_RUNTIME_EXECUTION',
  retrieved_documents: retrievedDocuments,
  evidence_passages: evidencePassages,
  claim_inventory: claimInventory,
  author_safe_claims: authorSafeClaims
};

const basePromptContext = {
  topic,
  requestedTitle,
  intentProfile: {
    primary_intent: 'PROBLEM_SOLVING',
    secondary_intents: ['COMPARISON'],
    confidence: 'HIGH'
  },
  evidencePack,
  authorSafeClaims,
  editorialVoiceLevel: 'L3',
  enableVoiceL4: false
};

// ─── 1. POSITIVE: Research Coverage Gate ────────────────────────────────────
runTest('1. Research Question Coverage: 6/6 categories covered for #10011', () => {
  const questions = generateEditorialResearchQuestions(topic);
  const result = validateResearchQuestionCoverage(questions, evidencePack, {
    executionType: 'REAL_RUNTIME_EXECUTION'
  });
  assert.equal(result.covered, true, 'Coverage gate must pass');
  assert.equal(result.covered_categories.length, 6, 'Must cover all 6 categories');
  assert.equal(result.authentic_source_count, 2, 'Must have 2 authentic sources');
});

// ─── 2. POSITIVE: Editorial Brief Outline Integrity ─────────────────────────
runTest('2. Editorial Brief outline is clean, domain-appropriate, and contains zero "Anda"', () => {
  const brief = compileEditorialBrief(basePromptContext);
  assert.ok(brief.outline.length >= 4, 'Must have at least 4 outline sections');
  
  // Verify zero "Anda" in headings or objectives
  for (const sec of brief.outline) {
    assert.ok(!sec.heading.includes('Anda'), `Section heading "${sec.heading}" must not contain "Anda"`);
    assert.ok(!sec.objective.includes('Anda'), `Section objective "${sec.objective}" must not contain "Anda"`);
  }

  // Verify brief editorial angle has zero leaked terms
  const angle = brief.editorial_angle.toLowerCase();
  assert.ok(!angle.includes('atap metal'), 'Editorial angle must not mention atap metal');
  assert.ok(!angle.includes('genteng beton'), 'Editorial angle must not mention genteng beton');
  assert.ok(!angle.includes('loteng'), 'Editorial angle must not mention loteng');
});

// ─── 3. POSITIVE: Writer Prompt Assembly & Semantic Leak Audit ───────────────
runTest('3. Writer prompt compiles cleanly with ZERO domain leaks', () => {
  const brief = compileEditorialBrief(basePromptContext);
  basePromptContext.editorialBrief = brief;
  const compiled = buildJokoPrompt(basePromptContext);
  
  assert.ok(compiled.systemPrompt.length > 500, 'System prompt must not be empty');
  assert.ok(compiled.userPrompt.length > 1000, 'User prompt must not be empty');

  const audit = auditPromptSemanticLeaks(compiled, basePromptContext);
  assert.equal(audit.passed, true, `Audit must pass, leaks: ${JSON.stringify(audit.leaks)}`);
  assert.equal(audit.leaks.length, 0, 'Must have 0 leaked terms');
});

// ─── 4. POSITIVE: LLM Payload Construction ──────────────────────────────────
runTest('4. Model request payload construction is compliant with Grounded Draft Envelope', () => {
  const compiled = buildJokoPrompt(basePromptContext);
  assert.equal(compiled.messages.length, 2, 'Must have system and user messages');
  assert.equal(compiled.messages[0].role, 'system');
  assert.equal(compiled.messages[1].role, 'user');
  assert.ok(compiled.userPrompt.includes('GROUNDED DRAFT ENVELOPE') || compiled.systemPrompt.includes('GROUNDED DRAFT ENVELOPE'));
  assert.ok(compiled.userPrompt.includes('article_markdown'));
  assert.ok(compiled.userPrompt.includes('claim_usage'));
});

// ─── 5. NEGATIVE: Injected Foreign Domain Leak Triggers WRITER_PROMPT_DOMAIN_LEAK
runTest('5. Negative: Adversarial foreign term injection triggers WRITER_PROMPT_DOMAIN_LEAK', () => {
  const brief = compileEditorialBrief(basePromptContext);
  // Adversarially inject a foreign domain term into editorial angle
  const corruptedBrief = {
    ...brief,
    editorial_angle: brief.editorial_angle + ' Sebagai perbandingan, atap metal lebih panas dibanding genteng.'
  };
  const corruptedContext = {
    ...basePromptContext,
    editorialBrief: corruptedBrief
  };
  const compiled = buildJokoPrompt(corruptedContext);
  const audit = auditPromptSemanticLeaks(compiled, corruptedContext);

  assert.equal(audit.passed, false, 'Audit must fail for injected foreign term');
  assert.equal(audit.code, 'WRITER_PROMPT_DOMAIN_LEAK', 'Error code must be WRITER_PROMPT_DOMAIN_LEAK');
  assert.ok(audit.leaks.some(l => l.term === 'atap metal'), 'Leak must identify "atap metal"');
});

// ─── 6. NEGATIVE: Off-Topic / Empty Evidence Pack is Blocked ─────────────────
runTest('6. Negative: Empty evidence pack fails coverage gate fail-closed', () => {
  const emptyPack = {
    evidence_pack_id: 'empty_pack',
    topic,
    execution_type: 'REAL_RUNTIME_EXECUTION',
    retrieved_documents: [],
    evidence_passages: [],
    claim_inventory: []
  };
  const questions = generateEditorialResearchQuestions(topic);
  const result = validateResearchQuestionCoverage(questions, emptyPack, {
    executionType: 'REAL_RUNTIME_EXECUTION'
  });
  assert.equal(result.covered, false, 'Empty pack must be blocked');
  assert.equal(result.covered_categories.length, 0, 'Must cover 0 categories');
  assert.equal(result.rejection_code, 'RESEARCH_COVERAGE_INSUFFICIENT');
});

// ─── 7. REGRESSION: Non-roof comparison topic has zero leaks ─────────────────
runTest('7. Regression: Another comparison topic ("Kusen Aluminium vs UPVC") produces ZERO leaks', () => {
  const compTopic = 'Kusen Aluminium vs UPVC: Perbandingan Daya Tahan dan Isolasi Termal';
  const compContext = {
    topic: compTopic,
    requestedTitle: compTopic,
    intentProfile: {
      primary_intent: 'COMPARISON',
      secondary_intents: [],
      confidence: 'HIGH'
    },
    evidencePack: {
      evidence_pack_id: 'evpack_kusen_test',
      topic: compTopic,
      claim_inventory: [
        {
          claim_id: 'CLM-KUSEN-01',
          statement: 'Kusen aluminium memiliki konduktivitas termal tinggi sedangkan UPVC merupakan isolator alami.',
          allowed_for_authoring: true
        }
      ]
    },
    authorSafeClaims: [
      {
        claim_id: 'CLM-KUSEN-01',
        statement: 'Kusen aluminium memiliki konduktivitas termal tinggi sedangkan UPVC merupakan isolator alami.',
        allowed_for_authoring: true
      }
    ],
    editorialVoiceLevel: 'L3',
    enableVoiceL4: false
  };

  const compBrief = compileEditorialBrief(compContext);
  compContext.editorialBrief = compBrief;
  const compCompiled = buildJokoPrompt(compContext);
  const compAudit = auditPromptSemanticLeaks(compCompiled, compContext);

  assert.equal(compAudit.passed, true, `Regression test must pass without leaks: ${JSON.stringify(compAudit.leaks)}`);
  assert.equal(compAudit.leaks.length, 0, 'Must have zero leaks for non-roof comparison');
  assert.ok(!compBrief.editorial_angle.toLowerCase().includes('atap metal'), 'Brief must not leak atap metal');
});

console.log('\n================================================================');
console.log(`HASIL AKHIR: ${passed} PASS / ${failed} FAIL (dari ${passed + failed} tes)`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
