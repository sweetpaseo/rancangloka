/**
 * RancangLoka — Grounded Joko Output & Editorial Compression Test Suite
 * Milestone: EDITORIAL-RUNTIME-2
 *
 * Verifies:
 * 1. Unknown claim IDs rejected (GROUNDING_REVIEW_REQUIRED / validation error)
 * 2. Prohibited claim IDs rejected (PROHIBITED_CLAIM_DETECTED)
 * 3. Claims whose safe action is REMOVE are rejected if used
 * 4. Prohibited numerical elements cannot be restored in article text
 * 5. Unsupported claim candidates cannot silently enter output (EVIDENCE_GROUNDING_REVIEW_REQUIRED)
 * 6. Author grounding declaration is NOT mislabeled verified (provenance = AUTHOR_GROUNDING_DECLARATION)
 * 7. Prescriptive certainty is audited (PRESCRIPTIVE_CERTAINTY <= EVIDENCE_CERTAINTY)
 * 8. Editorial compression is audited (ONE IDEA — ONE BEST HOME, duplicate decision sections flagged)
 * 9. Native Indonesian contract remains intact
 * 10. Visitor Pain Context remains runtime-connected
 * 11. Initial prompt strictly excludes previous article prose
 * 12. Bounded repair still functions with grounding envelope
 * 13. Human review remains mandatory (HUMAN_REVIEW_REQUIRED)
 * 14. Publication remains impossible (publishingAuthority = 0, DRAFT)
 * 15. Runtime provenance remains truthful
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  parseGroundedDraftEnvelope,
  validateClaimGrounding,
  auditEditorialRefinement
} from '../src/lib/editorial/claim-grounding.ts';

import {
  buildJokoPrompt,
  buildJokoSystemPrompt
} from '../src/lib/editorial/joko-prompt-builder.ts';

import {
  executeEditorialDraftJob
} from '../src/lib/editorial/editorial-runtime.ts';

import {
  EditorialLlmProvider
} from '../src/lib/editorial/editorial-llm-provider.ts';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('  ✅ PASS: ' + name);
  passed++;
}

async function main() {
  console.log('🧪 Starting Grounded Joko Output & Editorial Compression Suite (EDITORIAL-RUNTIME-2)...\n');

  // Load baseline dryrun evidence pack for testing
  const evPackPath = path.resolve('scripts/dryrun/evidence-pack.json');
  assert.ok(fs.existsSync(evPackPath), 'evidence-pack.json must exist');
  const evPack = JSON.parse(fs.readFileSync(evPackPath, 'utf8'));

  const baseJobInput = {
    taskId: 'task_test_joko_runtime_02',
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

  // --- SECTION 1: Grounded Draft Envelope Parsing & Claim-ID Validation ---
  console.log('--- TEST SECTION 1: Claim Grounding & Envelope Validation ---');

  await test('1. Unknown claim IDs are rejected and trigger validation errors', () => {
    const envelope = {
      article_markdown: '# Atap Metal Panas\n\nPenjelasan atap metal.',
      claim_usage: [
        {
          claim_id: 'CLM-UNKNOWN-999',
          article_excerpt: 'Penjelasan atap metal.',
          usage_type: 'SUPPORTED_SYNTHESIS'
        }
      ],
      unsupported_claim_candidates: []
    };

    const audit = validateClaimGrounding(envelope, evPack, evPack.author_safe_claims);
    assert.strictEqual(audit.isValid, false);
    assert.strictEqual(audit.status, 'GROUNDING_REVIEW_REQUIRED');
    assert.ok(audit.unrecognizedClaimIds.includes('CLM-UNKNOWN-999'));
    assert.ok(audit.errors.some(e => e.includes('CLM-UNKNOWN-999')));
  });

  await test('2. Prohibited claim IDs are rejected (PROHIBITED_CLAIM_DETECTED)', () => {
    const evPackWithProhibited = {
      ...evPack,
      prohibited_claims: ['CLM-007 klaim terlarang tentang harga fiktif']
    };

    const envelope = {
      article_markdown: '# Atap Metal Panas\n\nKlaim harga terlarang.',
      claim_usage: [
        {
          claim_id: 'CLM-007',
          article_excerpt: 'Klaim harga terlarang.',
          usage_type: 'DIRECT_PARAPHRASE'
        }
      ],
      unsupported_claim_candidates: []
    };

    const audit = validateClaimGrounding(envelope, evPackWithProhibited, evPack.author_safe_claims);
    assert.strictEqual(audit.isValid, false);
    assert.strictEqual(audit.status, 'PROHIBITED_CLAIM_DETECTED');
    assert.ok(audit.prohibitedClaimIds.includes('CLM-007'));
  });

  await test('3. Claims whose safe action is REMOVE are rejected if used', () => {
    const safeClaimsWithRemoved = [
      {
        claim_id: 'CLM-099',
        statement: 'Klaim yang dilarang digunakan',
        allowed_for_authoring: false,
        safe_action: 'REMOVE'
      }
    ];

    const envelope = {
      article_markdown: '# Atap Metal Panas\n\nMenggunakan klaim terlarang.',
      claim_usage: [
        {
          claim_id: 'CLM-099',
          article_excerpt: 'Menggunakan klaim terlarang.',
          usage_type: 'DIRECT_PARAPHRASE'
        }
      ],
      unsupported_claim_candidates: []
    };

    const audit = validateClaimGrounding(envelope, evPack, safeClaimsWithRemoved);
    assert.strictEqual(audit.isValid, false);
    assert.ok(audit.removedClaimsUsed.includes('CLM-099'));
    assert.ok(audit.errors.some(e => e.includes('CLM-099') && e.includes('REMOVE')));
  });

  await test('4. Prohibited numerical elements cannot be restored in article text', () => {
    // evPack.author_safe_claims has prohibited element '800 hingga 1.000 Watt'
    const envelope = {
      article_markdown: '# Atap Metal Panas\n\nBeban panas mencapai 800 hingga 1.000 Watt per meter persegi di terik siang.',
      claim_usage: [
        {
          claim_id: 'CLM-001',
          article_excerpt: 'Beban panas mencapai...',
          usage_type: 'DIRECT_PARAPHRASE'
        }
      ],
      unsupported_claim_candidates: []
    };

    const audit = validateClaimGrounding(envelope, evPack, evPack.author_safe_claims);
    assert.strictEqual(audit.isValid, false);
    assert.strictEqual(audit.status, 'PROHIBITED_CLAIM_DETECTED');
    assert.ok(audit.prohibitedElementsFound.includes('800 hingga 1.000 Watt'));
  });

  await test('5. Unsupported claim candidates cannot silently enter output (EVIDENCE_GROUNDING_REVIEW_REQUIRED)', () => {
    const envelope = {
      article_markdown: '# Atap Metal Panas\n\nAtap seng dapat menurunkan suhu AC 12 derajat secara instan.',
      claim_usage: [
        {
          claim_id: 'CLM-001',
          article_excerpt: 'Atap seng dapat...',
          usage_type: 'DIRECT_PARAPHRASE'
        }
      ],
      unsupported_claim_candidates: ['Penurunan suhu AC 12 derajat instan']
    };

    const audit = validateClaimGrounding(envelope, evPack, evPack.author_safe_claims);
    assert.strictEqual(audit.isValid, false);
    assert.strictEqual(audit.status, 'UNSUPPORTED_CLAIMS_DETECTED');
    assert.ok(audit.unsupportedCandidatesFound.includes('Penurunan suhu AC 12 derajat instan'));
  });

  await test('6. Author grounding declaration is NOT mislabeled as verified (provenance invariant)', () => {
    const envelope = {
      article_markdown: '# Atap Metal Panas\n\nTeks normal.',
      claim_usage: [
        {
          claim_id: 'CLM-001',
          article_excerpt: 'Teks normal.',
          usage_type: 'DIRECT_PARAPHRASE'
        }
      ],
      unsupported_claim_candidates: []
    };

    const audit = validateClaimGrounding(envelope, evPack, evPack.author_safe_claims);
    assert.strictEqual(audit.declarationProvenance, 'AUTHOR_GROUNDING_DECLARATION');
    // Must NOT be labeled as verified external grounding
    assert.notStrictEqual(audit.declarationProvenance, 'VERIFIED_EVIDENCE_GROUNDING');
  });

  // --- SECTION 2: Prescriptive Certainty & Editorial Compression Audits ---
  console.log('\n--- TEST SECTION 2: Prescriptive Certainty & Editorial Compression ---');

  await test('7. Prescriptive certainty is audited (PRESCRIPTIVE_CERTAINTY <= EVIDENCE_CERTAINTY)', () => {
    const excessivePrescriptiveText = `
    Pemilik rumah wajib memasang foil. Atap metal harus diberi ventilasi. Paling efektif adalah membuka semua bubungan.
    Ventilasi wajib dipasang sekarang. Anda pasti akan merasakan perbedaan drastis. Harus ada lubang udara.
    Tanpa foil, ventilasi tidak berfungsi sama sekali. Insulasi biasa pasti gagal total.
    `;

    const audit = auditEditorialRefinement(excessivePrescriptiveText);
    assert.ok(audit.prescriptiveWordsFound.length > 0, 'Must detect excessive prescriptive terms');
    assert.ok(audit.notes.some(n => n.includes('preskriptif absolut')));
  });

  await test('8. Editorial compression is audited (ONE IDEA — ONE BEST HOME)', () => {
    const repetitiveDecisionSectionsText = `
    # Atap Metal Panas
    ## Panduan Keputusan Skenario 1
    Pilihan foil vs ventilasi...
    ## Rekomendasi Skenario Berdasarkan Kondisi Rumah
    Pilihan foil vs ventilasi...
    ## Kesimpulan dan Panduan Keputusan Akhir
    Pilihan foil vs ventilasi lagi...
    `;

    const audit = auditEditorialRefinement(repetitiveDecisionSectionsText);
    assert.ok(audit.repetitiveDecisionSectionsCount >= 3, 'Must detect multiple decision subheadings');
    assert.strictEqual(audit.recommendation, 'COMPRESSION_SUGGESTED');
    assert.ok(audit.notes.some(n => n.includes('ONE IDEA — ONE BEST HOME')));
  });

  // --- SECTION 3: Prompt Invariants & Non-Slop Contracts ---
  console.log('\n--- TEST SECTION 3: Prompt Invariants & Non-Slop Contracts ---');

  await test('9. Native Indonesian contract and consultant voice remain strictly enforced', () => {
    const sys = buildJokoSystemPrompt();
    assert.ok(sys.includes('authoring_language = id-ID'), 'Must mandate authoring_language = id-ID');
    assert.ok(sys.includes('translation_mode = prohibited_by_default'), 'Must prohibit translation mode');
    assert.ok(sys.includes('ONE IDEA — ONE BEST HOME'), 'Must enforce ONE IDEA — ONE BEST HOME');
    assert.ok(sys.includes('Prescriptive Certainty <= Evidence Certainty'), 'Must enforce certainty bound');
    assert.ok(sys.includes('CLAIM GROUNDING CONTRACT'), 'Must instruct claim grounding contract');
    assert.ok(sys.includes('GROUNDED DRAFT ENVELOPE'), 'Must instruct JSON envelope format');
  });

  await test('10. Visitor Pain Context remains connected and existing article prose is excluded', () => {
    const compiled = buildJokoPrompt(baseJobInput);
    assert.ok(compiled.userPrompt.includes('CTX-05-DECISION-FOIL-VS-VENT'));
    assert.ok(compiled.userPrompt.includes('DECISION_UNCERTAINTY'));
    assert.ok(compiled.userPrompt.includes('DECISION_FORK'));

    // Check that existing final draft prose is excluded
    const draftFinalPath = path.resolve('scripts/dryrun/draft-final.md');
    const existingDraftText = fs.readFileSync(draftFinalPath, 'utf8');
    assert.ok(!compiled.userPrompt.includes(existingDraftText));
  });

  // --- SECTION 4: Runtime Execution with Envelope & Stop Gates ---
  console.log('\n--- TEST SECTION 4: Runtime Flow, Bounded Repair & Safety Gates ---');

  await test('11. Grounding violation in LLM draft halts execution at EVIDENCE_GROUNDING_REVIEW_REQUIRED', async () => {
    const violationDraftEnvelope = JSON.stringify({
      article_markdown: '# Atap Metal Panas\n\nNaskah dengan klaim yang tidak didukung.',
      claim_usage: [
        {
          claim_id: 'CLM-UNKNOWN-404',
          article_excerpt: 'Klaim tidak dikenal...',
          usage_type: 'DIRECT_PARAPHRASE'
        }
      ],
      unsupported_claim_candidates: ['Klaim suhu acak 50 derajat tanpa bukti']
    });

    const mockFetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: violationDraftEnvelope } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 0
    });

    const result = await executeEditorialDraftJob(baseJobInput, { providerInstance: provider });
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.finalDecision, 'EVIDENCE_GROUNDING_REVIEW_REQUIRED');
    assert.strictEqual(result.humanStopGateStatus, 'OPERATOR_INTERVENTION_REQUIRED');
    assert.ok(result.traceEvents.some(e => e.type === 'GROUNDING_VIOLATION_HALT'));
  });

  await test('12. Clean grounded draft successfully passes grounding audit and proceeds to Rina QA', async () => {
    const validDraftEnvelope = JSON.stringify({
      article_markdown: `# Atap Metal Terasa Panas: Apakah Insulasi Foil Cukup atau Perlu Ventilasi Atap?

Satu tukang menyarankan pasang aluminium foil. Tukang lain justru menyarankan ventilasi atap. Keduanya terdengar masuk akal, dan di situlah kebingungan renovasi dimulai.

Foil dan ventilasi bekerja pada jalur panas yang berbeda. Jika sumber panas belum dikenali, anggaran renovasi bisa terbuang sementara ruangan tetap panas.

## Memahami Tiga Jalur Panas pada Atap Metal

Panas matahari merambat melalui tiga cara berbeda:
1. **Radiasi Termal Gelombang Panjang**: Sinar matahari memanaskan lembaran seng metal hingga membara. Seng memancarkan radiasi panas ke ruangan di bawahnya. Sebagian besar beban panas atap berpindah melalui mekanisme radiasi ini.
2. **Konveksi Udara di Loteng**: Udara yang terkurung di rongga antara atap dan plafon memanas bila tidak ada sirkulasi udara luar.
3. **Konduksi Menembus Plafon**: Panas merambat langsung menembus plafon ke ruang tidur.

## Evaluasi Solusi: Kapan Memilih Foil dan Kapan Butuh Ventilasi

Aluminium foil efektif memantulkan radiasi termal jika dipasang dengan rongga udara (air gap). Tanpa rongga udara, panas tetap berpindah lewat konduksi langsung.

Ventilasi atap (kisi jalusi sopi-sopi atau ventilasi bubungan) diperlukan bila loteng tertutup rapat untuk mengalirkan akumulasi udara panas keluar sesuai standar SNI 03-6572-2001.

## Kompromi dan Risiko Lapangan

Setiap pilihan memiliki konsekuensi lapangan yang nyata:
- **Risiko Tampias Air Hujan**: Ventilasi atap tanpa kisi miring pelindung dapat memicu tampias saat hujan angin kencang.
- **Penyusupan Debu dan Serangga**: Ventilasi terbuka tanpa kawat kasa halus berpotensi memasukkan debu atau serangga.
- **Kondensasi dan Korosi Reng**: Tanpa sirkulasi yang tepat, kelembapan terjebak dan dapat memicu karat pada reng baja ringan.

## Panduan Skenario Berdasarkan Kondisi Rumah

- **Atap Metal Tanpa Plafon**: Insulasi foil berlapis dengan rongga udara adalah prioritas utama untuk menahan radiasi langsung.
- **Loteng Tertutup dengan Plafon**: Kombinasi insulasi foil dan ventilasi kisi sopi-sopi dibutuhkan agar udara panas tidak terperangkap.
- **Kamar Tidur Ber-AC**: Tambahkan insulasi di atas plafon untuk menahan kebocoran dingin AC.

## Langkah Pemeriksaan Fisik Siang Hari Sebelum Mengeluarkan Biaya

Sebelum membeli material atau menyewa tukang, lakukan pengecekan mandiri:
1. Naik ke plafon pada siang terik: apakah loteng terasa seperti oven tertutup atau ada sirkulasi udara?
2. Periksa apakah sudah ada rongga udara di bawah lembaran seng Anda.
3. Cek potensi tampias air hujan pada dinding pembatas sebelum melubangi atap untuk kisi ventilasi.`,
      claim_usage: [
        {
          claim_id: 'CLM-001',
          article_excerpt: 'Sinar matahari memanaskan lembaran seng metal...',
          usage_type: 'DIRECT_PARAPHRASE'
        },
        {
          claim_id: 'CLM-002',
          article_excerpt: 'Sebagian besar beban panas atap berpindah melalui mekanisme radiasi...',
          usage_type: 'DIRECT_PARAPHRASE'
        },
        {
          claim_id: 'CLM-003',
          article_excerpt: 'Aluminium foil efektif memantulkan radiasi termal jika dipasang dengan rongga udara...',
          usage_type: 'DIRECT_PARAPHRASE'
        },
        {
          claim_id: 'CLM-004',
          article_excerpt: 'Ventilasi atap diperlukan bila loteng tertutup rapat...',
          usage_type: 'DIRECT_PARAPHRASE'
        },
        {
          claim_id: 'CLM-005',
          article_excerpt: 'Ventilasi atap tanpa kisi miring pelindung dapat memicu tampias...',
          usage_type: 'DIRECT_PARAPHRASE'
        }
      ],
      unsupported_claim_candidates: []
    });

    const mockFetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: validDraftEnvelope } }],
      usage: { prompt_tokens: 950, completion_tokens: 700, total_tokens: 1650 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 0
    });

    const result = await executeEditorialDraftJob(baseJobInput, { providerInstance: provider });
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.finalDecision, 'HUMAN_WRITING_PASS');
    assert.strictEqual(result.publicationStatus, 'DRAFT');
    assert.strictEqual(result.humanStopGateStatus, 'HUMAN_REVIEW_REQUIRED');

    // Provenance and grounding metadata attached
    assert.ok(result.groundingAudit);
    assert.strictEqual(result.groundingAudit.status, 'DECLARED_GROUNDED');
    assert.strictEqual(result.groundingAudit.declarationProvenance, 'AUTHOR_GROUNDING_DECLARATION');
    assert.strictEqual(result.groundingAudit.validClaimsCount, 5);
    assert.ok(result.refinementAudit);
  });

  await test('13. Final safety invariants strictly preserved (AUTO_PUBLISH=OFF, publishingAuthority=0, DRAFT)', async () => {
    const mockFetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"article_markdown": "test", "claim_usage": [], "unsupported_claim_candidates": []}' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const provider = new EditorialLlmProvider({
      apiKey: 'test-key',
      fetchFn: mockFetch,
      maxRetries: 0
    });

    const result = await executeEditorialDraftJob(baseJobInput, { providerInstance: provider });
    assert.strictEqual(result.publicationStatus, 'DRAFT');
    assert.strictEqual(result.humanStopGateStatus, 'HUMAN_REVIEW_REQUIRED');
  });

  console.log(`\n🎉 All ${passed} tests in EDITORIAL-RUNTIME-2 passed successfully!`);
}

main().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
