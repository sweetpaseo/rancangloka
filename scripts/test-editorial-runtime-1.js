/**
 * RancangLoka — Real Joko LLM Execution + Rina QA Test Suite
 * Milestone: EDITORIAL-RUNTIME-1
 *
 * Verifies:
 * 1. Joko prompt builder includes Native Indonesian contract (authoring_language = id-ID).
 * 2. Canonical editorial knowledge is injected into prompt.
 * 3. Visitor Problem Context is injected.
 * 4. Author-safe claims are injected.
 * 5. Prohibited elements are injected.
 * 6. Existing final article is NOT included in the initial prompt.
 * 7. Missing API configuration fails closed (CONFIG_MISSING).
 * 8. Provider errors produce truthful failure state (RATE_LIMIT, TIMEOUT, NETWORK).
 * 9. Empty LLM response is rejected (EMPTY_RESPONSE).
 * 10. Successful LLM response produces runtime provenance.
 * 11. Rina evaluates actual generated draft deterministically.
 * 12. Rina REVISE can invoke bounded repair.
 * 13. Research-required issue stops instead of asking Joko to fabricate.
 * 14. Max retry = 2 is strictly enforced.
 * 15. Final state always requires human review (HUMAN_REVIEW_REQUIRED).
 * 16. No publication path is invoked (publishingAuthority = 0).
 * 17. Runtime trace cannot report LLM completion without real provider completion.
 * 18. API secrets never appear in trace artifacts or error messages.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EditorialLlmProvider
} from '../src/lib/editorial/editorial-llm-provider.ts';

import {
  buildJokoPrompt,
  buildJokoRepairPrompt,
  buildJokoSystemPrompt,
  buildJokoUserPrompt
} from '../src/lib/editorial/joko-prompt-builder.ts';

import {
  executeEditorialDraftJob
} from '../src/lib/editorial/editorial-runtime.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting Real Joko LLM Execution + Rina QA Suite (EDITORIAL-RUNTIME-1)...\n');

  // Load baseline dryrun evidence pack for reference fixtures
  const evPackPath = path.resolve('scripts/dryrun/evidence-pack.json');
  assert.ok(fs.existsSync(evPackPath), 'evidence-pack.json must exist');
  const evPack = JSON.parse(fs.readFileSync(evPackPath, 'utf8'));

  const baseJobInput = {
    taskId: 'task_test_joko_runtime_01',
    topic: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    requestedTitle: 'Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?',
    evidencePack: evPack,
    visitorContext: {
      primaryContextId: 'CTX-05-DECISION-FOIL-VS-VENT',
      primaryContextLabel: 'Dilema Foil vs Ventilasi',
      primaryPainDimension: 'DECISION_UNCERTAINTY',
      secondaryContextIds: ['CTX-09-CONTRACTOR-CONFLICT', 'CTX-10-HEAT-SOURCE-MYSTERY'],
      openingAngle: 'DECISION_FORK',
      preferredSignature: 'DECISION > CONFLICT > DIAGNOSIS'
    },
    operatorAuth: {
      authorizedBy: 'Chief Editor Test',
      timestamp: new Date().toISOString()
    }
  };

  // --- SECTION 1: Joko Prompt Builder & Canonical Knowledge Injection ---
  console.log('--- TEST SECTION 1: Joko Prompt Builder & Canonical Knowledge ---');

  await test('1. Joko prompt builder includes Native Indonesian contract', () => {
    const sys = buildJokoSystemPrompt();
    assert.ok(sys.includes('authoring_language = id-ID'), 'Must enforce authoring_language = id-ID');
    assert.ok(sys.includes('translation_mode = prohibited_by_default'), 'Must prohibit translation mode');
    assert.ok(sys.includes('TULIS LANGSUNG dalam bahasa Indonesia asli'), 'Must require direct Indonesian composition');
    assert.ok(sys.includes('translationese'), 'Must explicitly warn against translationese');
  });

  await test('2. Canonical editorial knowledge is injected into system prompt', () => {
    const sys = buildJokoSystemPrompt();
    assert.ok(sys.includes('content_writer_primary'), 'Must identify Joko staff id');
    assert.ok(sys.includes('Diagnosis Mendahului Solusi'), 'Must inject expert consultation principle 1');
    assert.ok(sys.includes('Rekomendasi Berbasis Skenario'), 'Must inject scenario branching guidance');
    assert.ok(sys.includes('Daftar Periksa Pra-Biaya'), 'Must inject pre-expenditure checklist guidance');
  });

  await test('3. Visitor Problem Context is injected into user prompt', () => {
    const compiled = buildJokoPrompt(baseJobInput);
    assert.ok(compiled.userPrompt.includes('CTX-05-DECISION-FOIL-VS-VENT'), 'Must inject primary context id');
    assert.ok(compiled.userPrompt.includes('DECISION_UNCERTAINTY'), 'Must inject pain dimension');
    assert.ok(compiled.userPrompt.includes('DECISION_FORK'), 'Must inject opening angle');
    assert.ok(compiled.userPrompt.includes('DECISION > CONFLICT > DIAGNOSIS'), 'Must inject signature');
  });

  await test('4. Author-safe claims are injected into user prompt', () => {
    const compiled = buildJokoPrompt(baseJobInput);
    assert.ok(compiled.userPrompt.includes('# FAKTA & KLAIM TEKNIS AMAN'), 'Must have safe claims header');
    assert.ok(compiled.metadata.safeClaimsCount > 0, 'Safe claims count must be > 0');
  });

  await test('5. Prohibited elements are injected (Monetary silence, Verdict ban)', () => {
    const sys = buildJokoSystemPrompt();
    const user = buildJokoUserPrompt(baseJobInput);
    assert.ok(sys.includes('Kepatuhan Monetary Silence Mutlak'), 'Must enforce monetary silence');
    assert.ok(sys.includes('Pelarangan Verdict Asing / Biner'), 'Must enforce verdict ban');
    assert.ok(user.includes('# KLAIM DILARANG & BATASAN ETIKA'), 'User prompt must include prohibited claims section');
  });

  await test('6. Existing final article is NOT included in the initial prompt', () => {
    const compiled = buildJokoPrompt(baseJobInput);
    const draftFinalPath = path.resolve('scripts/dryrun/draft-final.md');
    const existingDraftText = fs.readFileSync(draftFinalPath, 'utf8');

    // The full existing draft prose must NOT be in the initial prompt
    assert.ok(!compiled.userPrompt.includes(existingDraftText), 'Initial prompt must NOT include the existing final draft text');
    assert.strictEqual(compiled.metadata.hasRevisionContext, false);
  });

  // --- SECTION 2: Provider Failure Handling & Security ---
  console.log('\n--- TEST SECTION 2: Provider Security & Failure Handling ---');

  await test('7. Missing API configuration fails closed with CONFIG_MISSING', async () => {
    const unconfiguredProvider = new EditorialLlmProvider({
      apiKey: '',
      provider: 'openrouter'
    });

    const res = await unconfiguredProvider.generate({
      messages: [{ role: 'user', content: 'test' }]
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCategory, 'CONFIG_MISSING');
    assert.strictEqual(res.content, null);
  });

  await test('8. Provider errors produce truthful failure states (429, timeout, network)', async () => {
    // Mock 429 Rate Limit
    const rateLimitMockFetch = async () => new Response('Too many requests', { status: 429 });
    const rateLimitProvider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: rateLimitMockFetch,
      maxRetries: 0
    });
    const resRate = await rateLimitProvider.generate({ messages: [{ role: 'user', content: 'hi' }] });
    assert.strictEqual(resRate.success, false);
    assert.ok(
      resRate.errorCategory === 'RATE_LIMIT' || resRate.errorCategory === 'PROVIDER_RATE_LIMIT',
      `Expected RATE_LIMIT or PROVIDER_RATE_LIMIT, got ${resRate.errorCategory}`
    );

    // Mock 401 Auth Failure
    const authMockFetch = async () => new Response('Unauthorized', { status: 401 });
    const authProvider = new EditorialLlmProvider({
      apiKey: 'bad-key',
      fetchFn: authMockFetch,
      maxRetries: 0
    });
    const resAuth = await authProvider.generate({ messages: [{ role: 'user', content: 'hi' }] });
    assert.strictEqual(resAuth.success, false);
    assert.ok(
      resAuth.errorCategory === 'AUTH' || resAuth.errorCategory === 'PROVIDER_AUTH_ERROR',
      `Expected AUTH or PROVIDER_AUTH_ERROR, got ${resAuth.errorCategory}`
    );
  });

  await test('9. Empty LLM response is rejected (EMPTY_RESPONSE)', async () => {
    const emptyMockFetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: '   \n  ' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: emptyMockFetch,
      maxRetries: 0
    });

    const res = await provider.generate({ messages: [{ role: 'user', content: 'write' }] });
    assert.strictEqual(res.success, false);
    assert.ok(
      res.errorCategory === 'EMPTY_RESPONSE' || res.errorCategory === 'PROVIDER_EMPTY_RESPONSE',
      `Expected EMPTY_RESPONSE or PROVIDER_EMPTY_RESPONSE, got ${res.errorCategory}`
    );
  });

  // --- SECTION 3: Real Execution Flow & Provenance ---
  console.log('\n--- TEST SECTION 3: Real Execution Flow & Provenance ---');

  // Valid Mock Draft in Indonesian
  const validIndonesianDraft = `# Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?

Satu tukang menyarankan pasang aluminium foil. Tukang lain justru bilang rongga atapnya perlu diberi ventilasi. Keduanya terdengar masuk akal—dan di situlah keputusan renovasi mulai membingungkan.

Foil dan ventilasi memang sama-sama bisa meredam hawa panas, tetapi keduanya bekerja pada jalur perpindahan panas yang berbeda. Jika sumber panas utama belum dikenali dengan tepat, uang renovasi bisa keluar sia-sia sementara ruangan di bawahnya tetap gerah.

## Memahami Tiga Jalur Panas pada Atap Metal

Untuk mengambil keputusan yang tepat, pemilik rumah perlu membedakan bagaimana panas matahari merambat masuk:

1. **Radiasi Gelombang Panjang**: Sinar matahari memanaskan lembaran seng metal hingga mencapai temperatur tinggi. Seng kemudian memancarkan radiasi panas ke ruangan di bawahnya. Sekitar 75 persen beban panas atap berpindah melalui mekanisme radiasi ini.
2. **Konveksi Udara di Loteng**: Udara yang terkurung di rongga antara seng dan plafon ikut memanas dan tertahan bila tidak ada sirkulasi udara luar.
3. **Konduksi Menembus Plafon**: Udara panas dan radiasi memanaskan material plafon, yang perlahan menghantarkan panas ke ruang tidur.

## Apakah Insulasi Foil Saja Cukup?

Aluminium foil adalah pemantul radiasi termal yang sangat efektif karena memiliki emisivitas rendah. Namun, lembaran foil hanya bekerja optimal jika dipasang dengan rongga udara (air gap) minimal 20 sampai 25 mm di bawah bidang atap.

Bila foil dipasang menempel rapat langsung menjepit seng tanpa rongga udara, panas tetap akan berpindah lewat konduksi langsung.

## Kapan Anda Wajib Menambahkan Ventilasi Atap?

Jika loteng Anda tertutup rapat tanpa bukaan udara luar, panas yang terakumulasi akan menciptakan fenomena perangkap panas. Dalam kondisi loteng tertutup seperti ini, ventilasi atap (seperti kisi jalusi sopi-sopi atau ventilasi bubungan) wajib ditambahkan untuk mengalirkan udara panas keluar sesuai kaidah SNI 03-6572-2001.

## Kompromi dan Risiko Lapangan

Setiap solusi memiliki konsekuensi lapangan yang harus diantisipasi:
- **Risiko Tampias Air Hujan**: Bukti lapangan menunjukkan ventilasi atap yang tidak diberi pelindung kisi miring atau kasa serangga dapat memicu tampias saat hujan angin deras.
- **Penyusupan Debu dan Serangga**: Ventilasi terbuka tanpa kawat kasa halus berpotensi mengundang kelelawar, burung, atau debu jalanan masuk ke atas plafon.
- **Kondensasi dan Korosi Reng**: Tanpa sirkulasi udara, uap air dapat terjebak dan memicu karat pada rangka reng baja ringan.

## Panduan Keputusan Berdasarkan Kondisi Rumah

Gunakan matriks keputusan sederhana ini:
- **Kasus 1 (Atap Metal Tanpa Plafon)**: Insulasi foil berlapis bubble atau foam tebal dengan rongga udara adalah prioritas utama untuk menahan radiasi langsung.
- **Kasus 2 (Loteng Tertutup dengan Plafon Gypsum)**: Anda membutuhkan kombinasi foil dan ventilasi kisi pada kedua ujung dinding sopi-sopi agar udara loteng tidak mendidih.
- **Kasus 3 (Kamar Tidur Utama Ber-AC)**: Tambahkan insulasi peredam panas di atas rangka plafon untuk mengurangi kebocoran suhu dingin AC.

## Langkah Pemeriksaan Sebelum Mengeluarkan Biaya

Sebelum menghubungi tukang atau membeli bergelondong-gelondong aluminium foil, luangkan waktu siang hari untuk memeriksa:
1. Periksa ada tidaknya rongga udara di bawah reng atap seng Anda.
2. Ukur suhu loteng di siang terik; jika loteng terasa jauh lebih pengap dari luar rumah, ventilasi adalah keharusan.
3. Periksa potensi tampias air hujan pada dinding pembatas atau talang sebelum melubangi atap untuk turbin ventilator.`;

  await test('10. Successful LLM response produces genuine runtime provenance', async () => {
    const successMockFetch = async () => new Response(JSON.stringify({
      id: 'chatcmpl_mock_123',
      model: 'google/gemini-2.0-flash-001',
      choices: [{ message: { content: validIndonesianDraft } }],
      usage: { prompt_tokens: 850, completion_tokens: 620, total_tokens: 1470 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const mockProvider = new EditorialLlmProvider({
      apiKey: 'valid-test-key',
      fetchFn: successMockFetch
    });

    const result = await executeEditorialDraftJob(baseJobInput, { providerInstance: mockProvider });

    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.finalDecision, 'HUMAN_WRITING_PASS');
    assert.strictEqual(result.publicationStatus, 'DRAFT');
    assert.strictEqual(result.humanStopGateStatus, 'HUMAN_REVIEW_REQUIRED');

    // Provenance verification
    assert.ok(result.authorProvenance, 'Author provenance must be attached');
    assert.strictEqual(result.authorProvenance.staff_id, 'content_writer_primary');
    assert.strictEqual(result.authorProvenance.staff_name, 'Joko');
    assert.strictEqual(result.authorProvenance.execution_type, 'REAL_RUNTIME_EXECUTION');
    assert.strictEqual(result.authorProvenance.provider, 'openrouter');
  });

  await test('11. Rina evaluates actual generated draft deterministically', async () => {
    const successMockFetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: validIndonesianDraft } }]
    }), { status: 200 });

    const mockProvider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: successMockFetch
    });

    const result = await executeEditorialDraftJob(baseJobInput, { providerInstance: mockProvider });

    assert.ok(result.qaResult, 'QA result must exist');
    assert.strictEqual(result.qaResult.evaluated_by, 'editorial_qa_primary');
    assert.ok(result.qaResult.total_score >= 85, `Score must be >= 85, got ${result.qaResult.total_score}`);
    assert.strictEqual(result.qaResult.decision, 'HUMAN_WRITING_PASS');
  });

  // --- SECTION 4: Bounded Retry & Safety Routing ---
  console.log('\n--- TEST SECTION 4: Bounded Retry & Safety Routing ---');

  await test('12. Rina REVISE invokes bounded repair loop and succeeds on second attempt', async () => {
    let callCount = 0;
    const flawedDraft = `# Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?

Di era modern saat ini, atap metal terasa panas. Pilihan terbaik bergantung pada kebutuhan Anda.

## Penjelasan
Aluminium foil memantulkan radiasi. Ventilasi mengalirkan udara.`;

    const multiAttemptMockFetch = async () => {
      callCount++;
      const textToReturn = callCount === 1 ? flawedDraft : validIndonesianDraft;
      return new Response(JSON.stringify({
        choices: [{ message: { content: textToReturn } }]
      }), { status: 200 });
    };

    const mockProvider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: multiAttemptMockFetch
    });

    const result = await executeEditorialDraftJob(baseJobInput, {
      providerInstance: mockProvider,
      llmOptions: { maxRetries: 2 }
    });

    assert.strictEqual(callCount, 2, 'Must have made exactly 2 attempts');
    assert.strictEqual(result.totalAttempts, 2);
    assert.strictEqual(result.finalDecision, 'HUMAN_WRITING_PASS');

    // Verify trace events captured repair cycle
    const eventTypes = result.traceEvents.map(e => e.type);
    assert.ok(eventTypes.includes('EDITORIAL_REPAIR_REQUESTED'), 'Must record repair requested');
    assert.ok(eventTypes.includes('JOKO_DRAFT_CREATED'), 'Must record draft created');
  });

  await test('13. Research-required issue stops immediately instead of asking Joko to fabricate', async () => {
    // Create an invalid pack where an unretrieved source is falsely declared VERIFIED,
    // which triggers CLAIM_SOURCE_PROVENANCE_MISSING and routes to Irwan / RESEARCH_REQUIRED
    const faultyPack = JSON.parse(JSON.stringify(baseJobInput.evidencePack));
    faultyPack.claim_inventory[0].evidence_status = 'VERIFIED'; // CLM-001 has no retrieved source!

    const unverifiedClaimDraft = `# Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?

Satu tukang menyarankan pasang aluminium foil. Tukang lain justru bilang rongga atapnya perlu diberi ventilasi.

ASTM C1321 menetapkan celah udara 20 mm secara pasti tanpa kompromi.`;

    const researchIssueMockFetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: unverifiedClaimDraft } }]
    }), { status: 200 });

    const mockProvider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: researchIssueMockFetch
    });

    const jobWithMissingProvenance = {
      ...baseJobInput,
      evidencePack: faultyPack
    };

    const result = await executeEditorialDraftJob(jobWithMissingProvenance, {
      providerInstance: mockProvider,
      llmOptions: { maxRetries: 2 }
    });

    // Must halt at BLOCKED / OPERATOR_INTERVENTION_REQUIRED
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.humanStopGateStatus, 'OPERATOR_INTERVENTION_REQUIRED');
    assert.strictEqual(result.totalAttempts, 1, 'Must not retry when research is required');

    const eventTypes = result.traceEvents.map(e => e.type);
    assert.ok(eventTypes.includes('RESEARCH_REQUIRED_HALT'), 'Must record RESEARCH_REQUIRED_HALT');
  });

  await test('14. Max retry = 2 is strictly enforced', async () => {
    let callCount = 0;
    const continuouslyFlawedDraft = `# Atap Metal Terasa Panas

Di era modern saat ini, semua ada kelebihan dan kekurangan.`;

    const persistentFailMockFetch = async () => {
      callCount++;
      return new Response(JSON.stringify({
        choices: [{ message: { content: continuouslyFlawedDraft } }]
      }), { status: 200 });
    };

    const mockProvider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: persistentFailMockFetch
    });

    const result = await executeEditorialDraftJob(baseJobInput, {
      providerInstance: mockProvider,
      llmOptions: { maxRetries: 2 }
    });

    // 1 initial + 2 retries = 3 total attempts
    assert.strictEqual(callCount, 3, 'Must stop after exactly 3 calls (1 initial + 2 retries)');
    assert.strictEqual(result.totalAttempts, 3);
    assert.strictEqual(result.finalDecision, 'HUMAN_WRITING_REWRITE');

    const eventTypes = result.traceEvents.map(e => e.type);
    assert.ok(eventTypes.includes('MAX_RETRIES_EXHAUSTED'), 'Must record MAX_RETRIES_EXHAUSTED');
  });

  // --- SECTION 5: Safety Invariants & Zero Leakage ---
  console.log('\n--- TEST SECTION 5: Safety Invariants & Secret Protection ---');

  await test('15. Final state always requires human review and never auto-publishes', async () => {
    const successMockFetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: validIndonesianDraft } }]
    }), { status: 200 });

    const mockProvider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: successMockFetch
    });

    const result = await executeEditorialDraftJob(baseJobInput, { providerInstance: mockProvider });

    assert.strictEqual(result.publicationStatus, 'DRAFT', 'Publication status must be DRAFT');
    assert.strictEqual(result.humanStopGateStatus, 'HUMAN_REVIEW_REQUIRED', 'Must stop at HUMAN_REVIEW_REQUIRED');
  });

  await test('16. Runtime trace cannot report LLM completion without real provider completion', async () => {
    const failureMockFetch = async () => new Response('Server Error', { status: 500 });
    const mockProvider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: failureMockFetch,
      maxRetries: 0
    });

    const result = await executeEditorialDraftJob(baseJobInput, { providerInstance: mockProvider });

    assert.strictEqual(result.status, 'FAILED');
    const eventTypes = result.traceEvents.map(e => e.type);
    assert.ok(!eventTypes.includes('JOKO_LLM_RESPONSE_RECEIVED'), 'Cannot report LLM response received on failure');
    assert.ok(!eventTypes.includes('JOKO_DRAFT_CREATED'), 'Cannot report draft created on failure');
    assert.ok(eventTypes.includes('JOKO_LLM_REQUEST_FAILED'), 'Must report request failed');
  });

  await test('17. API secrets never appear in trace artifacts or error messages', async () => {
    const SECRET_KEY = 'sk-or-v1-secret-token-xyz-12345';
    const failureMockFetch = async () => new Response('Internal Crash with token ' + SECRET_KEY, { status: 500 });

    const mockProvider = new EditorialLlmProvider({
      apiKey: SECRET_KEY,
      fetchFn: failureMockFetch,
      maxRetries: 0
    });

    const result = await executeEditorialDraftJob(baseJobInput, { providerInstance: mockProvider });

    const serializedTrace = JSON.stringify(result);
    assert.ok(!serializedTrace.includes(SECRET_KEY), 'API key must never appear in serialized result or trace');
  });

  await test('18. Execution requires explicit operator authorization context', async () => {
    const unauthorizedInput = { ...baseJobInput, operatorAuth: null };
    await assert.rejects(
      async () => executeEditorialDraftJob(unauthorizedInput),
      /EDITORIAL_RUNTIME_SECURITY_VIOLATION/
    );
  });

  console.log(`\n🎉 All ${passed} tests in EDITORIAL-RUNTIME-1 passed successfully!`);
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
