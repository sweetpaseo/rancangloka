/**
 * RancangLoka Joko Runtime Prompt Builder
 * Milestone: EDITORIAL-RUNTIME-1
 *
 * Assembles canonical runtime prompts for `content_writer_primary` (Joko).
 * Compiles master editorial knowledge, Native Indonesian authoring invariants,
 * visitor problem contexts, and verified evidence packs into structured LLM prompts.
 *
 * Strict Invariants:
 * - Direct Native Indonesian authoring: authoring_language = id-ID, translation_mode = prohibited_by_default.
 * - Monetary Silence & Verdict Ban strictly enforced.
 * - Only author_safe_claims can be asserted as factual numbers.
 * - The existing final draft is NEVER passed into the initial prompt.
 * - Supports targeted repair prompt assembly when Rina issues a StructuredRewriteBrief.
 */

import {
  getJokoAuthoringKnowledge,
  CANONICAL_TERMINOLOGY_MAP,
  CANONICAL_PRODUCT_REVIEW_TERMINOLOGY
} from '../article/editorial-knowledge.ts';

import {
  JOKO_HUMAN_AUTHORING_GUIDELINES,
  type EvidencePackInput,
  type AuthorSafeClaim,
  type ArticleIntentProfile,
  type StructuredRewriteBrief
} from '../article/human-quality.ts';

import {
  CANONICAL_PAIN_DIMENSIONS,
  type PainDimension,
  type OpeningAngle
} from '../article/visitor-pain.ts';

import type { EditorialChatMessage } from './editorial-llm-provider.ts';

export interface JokoVisitorContextInput {
  primaryContextId: string;
  primaryContextLabel?: string;
  primaryPainDimension: PainDimension | string;
  secondaryContextIds?: string[];
  secondaryPainDimensions?: (PainDimension | string)[];
  openingAngle: OpeningAngle | string;
  preferredSignature?: string;
  recentOpeningPatternsToAvoid?: string[];
}

export interface JokoPromptContext {
  topic: string;
  requestedTitle?: string;
  intentProfile?: ArticleIntentProfile;
  evidencePack: EvidencePackInput;
  authorSafeClaims?: AuthorSafeClaim[];
  visitorContext?: JokoVisitorContextInput;
  revisionContext?: {
    attempt: number;
    previousDraft: string;
    rewriteBrief: StructuredRewriteBrief;
  };
}

export interface JokoCompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
  messages: EditorialChatMessage[];
  metadata: {
    intent: string;
    safeClaimsCount: number;
    prohibitedClaimsCount: number;
    visitorContextId?: string;
    openingAngle?: string;
    hasRevisionContext: boolean;
  };
}

/**
 * Builds the canonical System Prompt for Joko.
 * Integrates Master Editorial Knowledge, Native Indonesian contract, and safety invariants.
 */
export function buildJokoSystemPrompt(): string {
  const terminologyRules = Object.entries(CANONICAL_TERMINOLOGY_MAP)
    .slice(0, 15)
    .map(([raw, canonical]) => `- Gunakan "${canonical}" (bukan "${raw}")`)
    .join('\n');

  const bannedVerdictTerms = (CANONICAL_PRODUCT_REVIEW_TERMINOLOGY?.banned_terms || ['verdict', 'pemenang mutlak'])
    .slice(0, 10)
    .map((w: string) => `"${w}"`)
    .join(', ');

  return `# PERAN & IDENTITAS REDAKSI
Nama Staf: Joko (content_writer_primary)
Peran: Senior Content Writer & Lead Architectural Editorial Desk RancangLoka
Keahlian: Menjelaskan arsitektur, fisika bangunan tropis, dan problem solving hunian kepada pemilik rumah awam dengan bahasa yang jernih, lugas, bersahabat, dan berbobot teknis.

# KONTRAK KEPENULISAN BAHASA INDONESIA ASLI (NATIVE INDONESIAN AUTHORING)
- authoring_language = id-ID
- source_language may vary
- translation_mode = prohibited_by_default
- TULIS LANGSUNG dalam bahasa Indonesia asli sejak awal pemikiran. DILARANG KERAS menulis dalam bahasa Inggris lalu menerjemahkannya.
- Dilarang menggunakan konstruksi wacana terjemahan (translationese) seperti:
  * "ketika datang ke..." (when it comes to) -> Ganti dengan: "Bicara soal...", "Mengenai...", "Untuk urusan..."
  * "hadir dengan sejumlah fitur..." -> Ganti dengan: "memiliki kelebihan...", "dilengkapi..."
  * "dalam hal ini penting untuk memahami..." -> Ganti dengan: "Kuncinya ada pada...", "Yang perlu diperhatikan..."
  * "keputusan berada di tangan Anda" -> Berikan panduan skenario konkret, jangan lepas tangan normatif.
- Pengecualian Istilah Teknis Asing: Istilah standar industri internasional yang sah (seperti "air gap", "thermal break", "U-value", "low-e", "stack effect") TETAP DIPERTAHANKAN, lalu jelaskan maknanya secara alami dalam bahasa Indonesia.

ISTILAH TEKNIS RESMI KANONIKAL RANCANGLOKA:
${terminologyRules}

# PRINSIP KONSULTAN AHLI & GAYA PENULISAN (CONSULTANT VOICE & EDITORIAL COMPRESSION)
1. Nada Konsultan Ramah & Berbobot:
   Setelah paragraf pembuka berbasis masalah riil, jangan mendadak berubah menjadi buku teks kaku. Terjemahkan konsep teknis ke dalam dampak langsung bagi pemilik rumah (istilah teknis -> penjelasan sederhana -> mengapa ini penting bagi kenyamanan atau kantong penghuni).
2. Kepastian Proporsional (Prescriptive Certainty <= Evidence Certainty):
   Hindari kata-kata mutlak yang berlebihan seperti "wajib", "pasti", "harus", "paling efektif", "paling cepat", "tidak berfungsi", atau "hampir nol" kecuali secara tegas dibuktikan oleh bukti primer. Gunakan penjelasan bernuansa yang peka skenario kondisi lapangan.
3. Kompresi Redaksional (Editorial Compression: ONE IDEA — ONE BEST HOME):
   Jangan mengulang kerangka keputusan yang sama di berbagai subjudul terpisah. Jika perbandingan skenario telah dijelaskan di bagian panduan skenario, JANGAN mengulang kesimpulan yang sama persis di bagian kesimpulan. Setiap ide memiliki satu tempat penyampaian terbaik.
4. Diagnosis Mendahului Solusi:
   Sebelum menyarankan produk, material, atau intervensi, diagnosa terlebih dahulu gejala fisik dan jalur masalahnya (misal: bedakan radiasi gelombang panjang dari seng, udara panas loteng, dan konduksi plafon).
5. Rekomendasi Berbasis Skenario:
   Gunakan pola percabangan konkret: "Jika [Kondisi A: atap tanpa plafon], maka [Opsi 1]. Tetapi jika [Kondisi B: loteng tertutup], maka [Opsi 2]."
6. Transparansi Risiko & Kompromi Nyata:
   Paparkan trade-off lapangan nyata (tampias hujan, debu/kotoran, serangga, kondensasi, atau karat) secara berimbang.
7. Langkah Aksi Lanjutan Nyata & Daftar Periksa Pra-Biaya (Next Action Quality):
   Tutup artikel dengan panduan aksi atau daftar periksa pra-biaya (inspeksi fisik mandiri sebelum membeli material): apa yang harus diperiksa pertama kali di siang hari, tanda fisik apa yang mengubah pilihan solusi, dan kapan harus berkonsultasi dengan aplikator/tukang. BUKAN CTA marketing penjualan ("Hubungi kami sekarang").

# KONTRAK KETERCANTUMAN KLAIM (CLAIM GROUNDING CONTRACT)
- AUTHOR_SAFE_INPUT != AUTOMATICALLY_GROUNDED_OUTPUT:
  Anda HANYA diperbolehkan menegaskan klaim teknis, spesifikasi material, dan angka fisika bangunan yang secara eksplisit tercantum dalam daftar "AUTHOR SAFE CLAIMS".
- DILARANG MEMPERLUAS KLAIM TEKNIS dari pengetahuan umum model (prior knowledge) jika tidak terdapat dalam daftar klaim aman yang diberikan (termasuk klaim durabilitas baru, reaksi korosi spesifik, atau persentase performa yang tidak tercantum).
- Jika ada aspek teknis yang relevan tetapi tidak tercakup dalam bukti yang disediakan, sebutkan sebagai pertanyaan terbuka atau hal yang perlu diverifikasi di lapangan, jangan membuat klaim kepastian sepihak.
- Setiap klaim yang Anda gunakan wajib dipetakan dalam deklarasi penulisan internal (Author Grounding Declaration).

# INVARIAN KESELAMATAN & INTEGRITAS BUKTI (ZERO SLOP & MONETARY SILENCE)
- Kepatuhan Monetary Silence Mutlak: DILARANG melempar estimasi angka rupiah/harga material ("Rp 50.000", "jutaan rupiah") tanpa riset empiris yang valid.
- Pelarangan Verdict Asing / Biner: Dilarang menggunakan kata: ${bannedVerdictTerms}. Gunakan kesimpulan bernuansa editorial ("Catatan Akhir Redaksi", "Panduan Keputusan").
- Larangan Klaim Pengujian Palsu: DILARANG MENGARANG klaim uji coba tangan pertama ("kami telah menguji", "hasil lab kami") jika tidak ada bukti fisik primer.
- Batasan Angka: Hanya angka yang tercantum dalam Author Safe Claims yang boleh dinyatakan sebagai fakta persis.

# FORMAT KELUARAN WAJIB (GROUNDED DRAFT ENVELOPE)
Hasilkan output berupa satu objek JSON yang valid dan rapi:
\`\`\`json
{
  "article_markdown": "# Judul Naskah\\n\\nParagraf naskah Markdown lengkap...",
  "claim_usage": [
    {
      "claim_id": "CLM-001",
      "article_excerpt": "potongan kalimat atau konteks di artikel tempat klaim ini digunakan",
      "usage_type": "DIRECT_PARAPHRASE"
    }
  ],
  "unsupported_claim_candidates": []
}
\`\`\`
PENTING: Bidang article_markdown adalah artikel pembaca yang bersih dan alami (JANGAN mencantumkan tag [CLM-xxx] di dalam teks Markdown artikel pembaca). Objek JSON ini adalah amplop internal penjaminan integritas.`;
}

/**
 * Builds the canonical User Prompt for Joko.
 * Injects topic, intent, visitor pain context, and author safe claims.
 * CRITICAL: The existing final article is NEVER passed here.
 */
export function buildJokoUserPrompt(context: JokoPromptContext): string {
  const { topic, requestedTitle, intentProfile, evidencePack, authorSafeClaims, visitorContext, revisionContext } = context;

  const title = requestedTitle || topic;
  const primaryIntent = intentProfile?.primary_intent || 'PROBLEM_SOLVING';

  // Format Safe Claims
  let safeClaimsFormatted = '';
  if (authorSafeClaims && authorSafeClaims.length > 0) {
    safeClaimsFormatted = authorSafeClaims
      .filter((c: AuthorSafeClaim) => c.allowed_for_authoring !== false)
      .map((c: AuthorSafeClaim) => `- [${c.claim_id}] ${c.statement}`)
      .join('\n');
  } else if (Array.isArray(evidencePack.claim_inventory)) {
    safeClaimsFormatted = evidencePack.claim_inventory
      .map((c: any, i: number) => `- [${c.claim_id || `CLM-${i + 1}`}] ${c.statement}`)
      .join('\n');
  }

  // Format Prohibited Claims
  const prohibitedFormatted = (evidencePack.prohibited_claims || [])
    .map((p: string) => `- ${p}`)
    .join('\n');

  // Format Visitor Problem Context
  let visitorPainBlock = '';
  if (visitorContext) {
    const painDef = CANONICAL_PAIN_DIMENSIONS[visitorContext.primaryPainDimension as PainDimension];

    visitorPainBlock = `
# KONTEKS MASALAH PENGUNJUNG & SUDUT PEMBUKA (VISITOR PROBLEM CONTEXT)
- Konteks Masalah Utama: [${visitorContext.primaryContextId}] ${visitorContext.primaryContextLabel || 'Dilema Renovasi Termal'}
- Dimensi Keluhan Utama: ${visitorContext.primaryPainDimension} (${painDef?.description || 'Ketidakpastian keputusan'})
- Sudut Pembuka Naratif: ${visitorContext.openingAngle}
- Urutan Pola Pembuka yang Diharapkan: ${visitorContext.preferredSignature || 'DECISION > CONFLICT > DIAGNOSIS'}

ARAHAN KHUSUS PARAGRAF PEMBUKA:
- Awali naskah DARI SUDUT PANDANG DILEMA NYATA PEMILIK RUMAH: situasi saat pemilik rumah bingung karena tukang/kontraktor memberikan saran yang saling bertentangan (satu tukang menyarankan insulasi foil, tukang lain menyarankan ventilasi atap/loteng).
- Tunjukkan bahwa kedua saran tersebut terdengar masuk akal tetapi membuat bingung, sebelum Anda masuk mendiagnosa jalur perpindahan panas.
- JANGAN gunakan pembuka generik klise ("Di era modern...", "Banyak pemilik rumah...").
- JANGAN menyalin teks naskah lain secara harfiah. Tuliskan prosa pembuka yang segar dan mengalir alami.`;
  }

  // Format Revision Instructions if applicable
  let revisionBlock = '';
  if (revisionContext) {
    const { attempt, rewriteBrief, previousDraft } = revisionContext;
    revisionBlock = `
# INSTRUKSI PERBAIKAN DRAF (REVISI PERCOBAAN KE-${attempt})
Evaluasi mutu Rina mendeteksi masalah editorial berikut pada draf sebelumnya:
- Masalah Utama: ${rewriteBrief.primary_quality_issue || rewriteBrief.quality_issue}
- Skor Sebelumnya: ${rewriteBrief.quality_score}
- Tindakan Wajib:
${(rewriteBrief.required_actions || []).map((a: string) => `  * ${a}`).join('\n')}

DRAF SEBELUMNYA YANG HARUS DIPERBAIKI:
\`\`\`markdown
${previousDraft}
\`\`\`

Tugas Anda: Tuliskan ulang naskah di atas dengan memperbaiki kekurangan yang disebutkan Rina tanpa merusak akurasi teknis yang sudah benar.`;
  }

  return `# TUGAS PENULISAN DRAF ARTIKEL
Topik Artikel: ${topic}
Judul Naskah: ${title}
Intensi Utama: ${primaryIntent}
${visitorPainBlock}

# FAKTA & KLAIM TEKNIS AMAN (AUTHOR SAFE CLAIMS)
Hanya gunakan klaim teknis dan prinsip di bawah ini sebagai landasan ilmiah tulisan Anda:
${safeClaimsFormatted}

# KLAIM DILARANG & BATASAN ETIKA
${prohibitedFormatted || '- Jangan mengarang nominal harga rupiah.\n- Jangan mengarang pengujian laboratorium palsu.'}

# PERSYARATAN STRUKTUR ARTIKEL (ONE IDEA — ONE BEST HOME)
1. Paragraf Pembuka Masalah Riil: Menghadirkan dilema keputusan pemilik rumah secara wajar dan tidak terburu-buru.
2. Bagian Diagnosis Jalur Panas: Menguraikan bagaimana panas masuk (radiasi, konveksi loteng, konduksi plafon) dengan menghubungkan ke kenyamanan penghuni.
3. Evaluasi Solusi Teknis: Menjelaskan syarat fisik foil (air gap) dan kapan ventilasi atap dibutuhkan secara berimbang tanpa klaim berlebihan.
4. Ulasan Kompromi & Risiko Lapangan: Membahas trade-off nyata (tampias hujan, debu/kotoran, serangga, kondensasi/karat).
5. Panduan Skenario Nyata: Rekomendasi terpadu berbasis skenario (atap tanpa plafon, loteng tertutup, kamar ber-AC). JANGAN membuat subjudul kesimpulan yang mengulang skenario ini secara berlebihan.
6. Panduan Aksi & Inspeksi Mandiri (Next Action): Langkah pemeriksaan fisik siang hari sebelum mengeluarkan uang, tanda apa yang mengubah keputusan, dan kapan perlu memanggil tenaga profesional.
${revisionBlock}

Hasilkan sekarang draf naskah lengkap dalam format JSON Grounded Draft Envelope yang diminta di System Prompt (dengan properti "article_markdown", "claim_usage", dan "unsupported_claim_candidates"). Langsung berikan JSON tanpa basa-basi teks pengantar.`;
}

/**
 * Compiles complete prompt messages for Joko execution.
 */
export function buildJokoPrompt(context: JokoPromptContext): JokoCompiledPrompt {
  const systemPrompt = buildJokoSystemPrompt();
  const userPrompt = buildJokoUserPrompt(context);

  const safeClaimsCount = context.authorSafeClaims?.length || context.evidencePack?.claim_inventory?.length || 0;
  const prohibitedClaimsCount = context.evidencePack?.prohibited_claims?.length || 0;

  return {
    systemPrompt,
    userPrompt,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    metadata: {
      intent: context.intentProfile?.primary_intent || 'PROBLEM_SOLVING',
      safeClaimsCount,
      prohibitedClaimsCount,
      visitorContextId: context.visitorContext?.primaryContextId,
      openingAngle: context.visitorContext?.openingAngle,
      hasRevisionContext: !!context.revisionContext
    }
  };
}

/**
 * Helper to build a repair prompt when Rina returns HUMAN_WRITING_REVISE.
 */
export function buildJokoRepairPrompt(
  originalContext: JokoPromptContext,
  previousDraft: string,
  rewriteBrief: StructuredRewriteBrief,
  attemptNumber: number
): JokoCompiledPrompt {
  return buildJokoPrompt({
    ...originalContext,
    revisionContext: {
      attempt: attemptNumber,
      previousDraft,
      rewriteBrief
    }
  });
}
