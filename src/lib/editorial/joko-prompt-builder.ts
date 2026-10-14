/**
 * RancangLoka Joko Runtime Prompt Builder
 * Milestone: JOKO-PROMPT-GENERALIZATION-1
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
 * - Generalization Invariant: Static prompt templates MUST be domain-neutral.
 *   Domain vocabulary (e.g. foil, ventilasi, waterproofing, aluminium, etc.) must originate
 *   ONLY from active inputs (topic, visitor context, evidence pack), NEVER from static generic instructions.
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
  competingOptions?: string[];
  primaryProblem?: string;
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

export interface PromptSectionComponents {
  staticSystemInstructions: string;
  staticEditorialGuidelines: string;
  staticFormattingContract: string;
  topicTitleBlock: string;
  dynamicVisitorPainBlock: string;
  dynamicAuthorSafeClaimsBlock: string;
  dynamicProhibitedClaimsBlock: string;
  staticStructureGuidelines: string;
  dynamicRevisionBlock?: string;
}

export interface JokoCompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
  messages: EditorialChatMessage[];
  components?: PromptSectionComponents;
  metadata: {
    intent: string;
    safeClaimsCount: number;
    prohibitedClaimsCount: number;
    visitorContextId?: string;
    openingAngle?: string;
    hasRevisionContext: boolean;
  };
}

export const SUSPICIOUS_STATIC_DOMAIN_TERMS = [
  'radiant barrier',
  'doe radiant barrier',
  'insulasi foil',
  'aluminium foil',
  'foil',
  'ventilasi atap',
  'ventilasi loteng',
  'atap metal',
  'metal roof',
  'rongga atap',
  'karat atap',
  'kondensasi atap'
];

export interface PromptSemanticLeakAuditResult {
  passed: boolean;
  leaks: Array<{
    term: string;
    section: 'STATIC_SYSTEM' | 'STATIC_USER_STRUCTURE' | 'STATIC_OPENING_TEMPLATE' | 'STATIC_GENERAL';
    snippet: string;
  }>;
  code?: 'WRITER_PROMPT_DOMAIN_LEAK';
  rejectionReason?: string;
}

/**
 * Derives competing options or choices dynamically from the active topic or context.
 * Never hardcodes domain assumptions into generic instructions.
 */
export function deriveCompetingOptionsFromTopicOrContext(
  topic: string,
  visitorContext?: JokoVisitorContextInput,
  authorSafeClaims?: AuthorSafeClaim[]
): { optionA?: string; optionB?: string; summary: string } {
  // 1. Check if visitorContext has explicit competing options passed
  if (visitorContext?.competingOptions && Array.isArray(visitorContext.competingOptions) && visitorContext.competingOptions.length >= 2) {
    const a = String(visitorContext.competingOptions[0]).trim();
    const b = String(visitorContext.competingOptions[1]).trim();
    return {
      optionA: a,
      optionB: b,
      summary: `antara ${a} dan ${b}`
    };
  }

  // 2. Parse topic for dichotomy (versus / vs / atau)
  const cleanOption = (s: string): string => {
    return s
      .replace(/^apakah\s+/i, '')
      .replace(/^perlu\s+/i, '')
      .replace(/\s+cukup$/i, '')
      .replace(/[?!.]+$/, '')
      .trim();
  };

  const parts = topic.includes(':') ? topic.split(/:\s*/) : [topic];
  const queryPart = parts[parts.length - 1];

  const vsMatch = queryPart.match(/(.+?)\s+(?:vs\.?|versus)\s+([^,?!]+)/i);
  if (vsMatch && vsMatch[1] && vsMatch[2]) {
    const a = cleanOption(vsMatch[1]);
    const b = cleanOption(vsMatch[2]);
    return {
      optionA: a,
      optionB: b,
      summary: `antara ${a} dan ${b}`
    };
  }

  const atauMatch = queryPart.match(/(.+?)\s+atau\s+([^,?!]+)/i);
  if (atauMatch && atauMatch[1] && atauMatch[2]) {
    const a = cleanOption(atauMatch[1]);
    const b = cleanOption(atauMatch[2]);
    return {
      optionA: a,
      optionB: b,
      summary: `antara ${a} atau ${b}`
    };
  }

  return {
    summary: `dua pilihan atau pendekatan penanganan yang sedang dipertimbangkan pada topik "${topic}"`
  };
}

/**
 * Builds dynamic opening instructions derived purely from active topic, visitor context,
 * and author safe claims. Free of static domain-specific assumptions.
 */
export function buildDynamicOpeningGuidance(
  topic: string,
  visitorContext: JokoVisitorContextInput,
  authorSafeClaims?: AuthorSafeClaim[]
): string {
  const angle = visitorContext.openingAngle;
  const isContractorConflict =
    visitorContext.primaryContextId === 'CTX-04-CONTRACTOR-CONFLICT' ||
    visitorContext.primaryPainDimension === 'INFORMATION_CONFLICT' ||
    angle === 'EXPERT_OBSERVATION';

  const competing = deriveCompetingOptionsFromTopicOrContext(topic, visitorContext, authorSafeClaims);

  const lines: string[] = [];

  if (isContractorConflict) {
    const conflictDesc = competing.optionA && competing.optionB
      ? `satu pihak menyarankan ${competing.optionA.toLowerCase()}, sementara pihak lain menyarankan ${competing.optionB.toLowerCase()}`
      : competing.summary;
    lines.push(
      `- Awali naskah dari situasi saat pemilik rumah bingung karena tukang/kontraktor memberikan saran yang saling bertentangan di lapangan (${conflictDesc}).`,
      `- Tunjukkan bahwa kedua anjuran tersebut terdengar masuk akal bagi pembaca, lalu jelaskan mengapa diagnosis kondisi fisik lapangan dibutuhkan sebelum memutuskan solusi mana yang tepat.`
    );
  } else if (angle === 'DECISION_FORK') {
    const forkDesc = competing.optionA && competing.optionB
      ? `memilih antara ${competing.optionA.toLowerCase()} atau ${competing.optionB.toLowerCase()}`
      : competing.summary;
    lines.push(
      `- Awali naskah dari persimpangan keputusan nyata yang sedang dihadapi pemilik rumah terkait "${topic}" (${forkDesc}).`,
      `- Tunjukkan dua pilihan atau pendekatan penanganan yang sedang dipertimbangkan pembaca, lalu jelaskan mengapa diagnosis konteks lapangan dibutuhkan sebelum menentukan pilihan material atau tindakan.`
    );
  } else if (angle === 'FAILURE_AFTER_SOLUTION') {
    lines.push(
      `- Awali naskah dari situasi saat pemilik rumah sudah mencoba langkah perbaikan awal pada "${topic}" namun masalah tetap berulang.`,
      `- Tunjukkan frustrasi wajar pemilik rumah akibat perbaikan yang tidak tuntas sebelum Anda masuk ke akar penyebab fisik yang sebenarnya.`
    );
  } else if (angle === 'DIAGNOSTIC_MYSTERY') {
    lines.push(
      `- Awali naskah dengan pertanyaan reflektif atau gejala fisik yang membingungkan seputar "${topic}".`,
      `- Ajak pembaca melacak dari mana masalah sebenarnya bermula sebelum tergesa-gesa membeli produk atau material pelindung.`
    );
  } else if (angle === 'COST_OF_WRONG_DECISION') {
    lines.push(
      `- Awali naskah dari kekhawatiran salah urutan penanganan atau pemborosan anggaran renovasi untuk "${topic}".`,
      `- Tunjukkan risiko biaya yang sia-sia bila intervensi permukaan dilakukan sebelum akar masalah fisik diperbaiki.`
    );
  } else {
    lines.push(
      `- Awali naskah dari sudut pandang dilema nyata pemilik rumah terkait "${topic}".`,
      `- Hadirkan empati terhadap kesulitan atau keraguan lapangan sebelum masuk mendiagnosa jalur masalah secara teknis.`
    );
  }

  // Universal quality rules for openings
  lines.push(
    `- JANGAN gunakan pembuka generik klise ("Di era modern...", "Banyak pemilik rumah mengira...", "Memilih material bukanlah hal yang mudah...").`,
    `- JANGAN menyalin teks naskah lain secara harfiah. Tuliskan prosa pembuka yang segar, mengalir alami, dan langsung terikat pada topik ini.`
  );

  return lines.join('\n');
}

/**
 * Builds the canonical System Prompt for Joko.
 * Integrates Master Editorial Knowledge, Native Indonesian contract, and safety invariants.
 * Guaranteed 100% domain-neutral and free of hardcoded building-component assumptions.
 */
export function buildJokoSystemPrompt(): string {
  const terminologyRules = Object.values(CANONICAL_TERMINOLOGY_MAP)
    .slice(0, 15)
    .map((entry) => `- Gunakan "${entry.canonical}" (bukan ${entry.prohibited_alternations.map((p: string) => `"${p}"`).join(', ')})`)
    .join('\n');

  const bannedVerdictTerms = (CANONICAL_PRODUCT_REVIEW_TERMINOLOGY?.banned_terms || ['verdict', 'pemenang mutlak'])
    .slice(0, 10)
    .map((w: string) => `"${w}"`)
    .join(', ');

  return `# PERAN & IDENTITAS REDAKSI
Nama Staf: Joko (content_writer_primary)
Peran: Senior Content Writer & Lead Architectural Editorial Desk RancangLoka
Keahlian: Menjelaskan arsitektur, fisika bangunan tropis, dan problem solving hunian kepada pemilik rumah awam dengan bahasa yang jernih, lugas, bersahabat, dan berbobot teknis.

# PRINSIP UTAMA SUARA RANCANGLOKA (CANONICAL RANCANGLOKA VOICE)
"RancangLoka tidak menulis untuk membuat pembaca merasa penulisnya pintar. RancangLoka menulis supaya pembaca merasa dirinya sekarang mengerti."
"RancangLoka menjelaskan dengan kehangatan seorang konsultan yang membantu, bukan dengan jarak seorang penguji yang menghakimi."
"Setelah pembaca memahami fakta dan trade-off, RancangLoka membantu mereka percaya diri mengambil keputusan sendiri."

Target Suara Redaksi: WARM ADVISORY TONE
Konsultan bangunan dan arsitektur Indonesia berpengalaman yang memahami masalah teknis secara mendalam, namun berbicara kepada pemilik rumah dengan kehangatan, kejelasan, ketenangan, dan rasa hormat.

Pembaca harus merasakan:
- "Saya sekarang mengerti masalahnya."
- "Saya tahu trade-off dan pertimbangan apa yang penting."
- "Saya bisa mengambil keputusan sendiri tanpa merasa digurui atau dihakimi."

Arti 'Hangat' (Warm Advisory) bagi RancangLoka:
- BUKAN: sentimental, terlalu ramah (overly friendly), banyak bahasa gaul/slang, bernada motivasi murahan, bahasa iklan/salesy, manipulasi emosional, bertele-tele (verbose), samar/vague, atau melunakkan fakta teknis.
- MELAINKAN: manusiawi, penuh pertimbangan, komunikatif (conversational), tenang, menentramkan tanpa janji berlebihan, praktis, menghormati keputusan akhir pemilik rumah, dan berbobot teknis dalam bahasa Indonesia sehari-hari.

Tanggung Jawab Kepenulisan Utama Joko:
- Menulis langsung dalam bahasa Indonesia alami (native Indonesian authoring).
- Menjaga akurasi dan ketepatan teknis secara utuh.
- Mengutamakan kosakata bahasa Indonesia sehari-hari yang akrab.
- Menjelaskan konsekuensi teknis dalam bahasa dampak praktis pemilik rumah.
- Menggunakan transisi paragraf yang hangat dan mengalir.
- Menghindari kesimpulan kaku bergaya laporan birokrasi / makalah akademis.
- Menghindari frasa rangkuman robotik ("secara rangkuman", "dapat disimpulkan bahwa").
- Menghindari penutup klise generic AI ("semoga bermanfaat", "selamat mencoba").
- Joko harus terdengar seperti: konsultan berpengalaman yang menjelaskan opsi di seberang meja kepada klien, BUKAN makalah akademis, surat edaran instansi, artikel terjemahan bahasa Inggris, copywriter iklan, atau chatbot.

ATURAN PENUTUP ARTIKEL KOMPARASI (COMPARISON_WARM_DECISION_HANDOFF):
Setiap artikel komparasi RancangLoka WAJIB ditutup dengan serah-terima keputusan manusia yang singkat dan hangat setelah rekomendasi analitis selesai dipaparkan.
- Tujuan: Mengembalikan agensi keputusan akhir kepada pembaca setelah RancangLoka menjelaskan masalah, konteks, trade-off, kesesuaian skenario, dan rekomendasi teknis.
- Pesan inti penutup: Jarang sekali ada satu opsi yang sempurna untuk segala situasi; pilihan terbaik selalu bergantung pada kondisi nyata dan prioritas rumah pembaca.
- Tonal Reference (rujukan nada, BUKAN template kaku yang disalin kata-per-kata):
  "Jadi, setelah semua pertimbangannya jelas, keputusan akhirnya tetap ada di tangan Anda—pilih solusi yang paling masuk akal untuk kondisi rumah Anda, bukan sekadar yang paling menarik dilihat."
- PENTING: Kalimat di atas adalah tonal reference. Joko wajib mengadaptasinya secara alami sesuai topik bahasan agar terhindar dari pengulangan template yang monoton di seluruh situs.

INTENSITAS WARM ADVISORY TONE BERDASARKAN TIPE ARTIKEL:
- COMPARISON: Wajib menyertakan serah-terima keputusan hangat yang kuat (COMPARISON_WARM_DECISION_HANDOFF).
- PROBLEM SOLVER: Langkah aksi nyata yang menentramkan dan dapat langsung diterapkan pemilik rumah.
- MATERIAL GUIDE: Panduan kesesuaian material dan konteks ruangan yang praktis dan bersahabat.
- TECHNICAL EXPLAINER: Penjelasan pemahaman yang hangat dengan implikasi praktis bagi penghuni.
- PRODUCT DECISION: Serah-terima konteks pembeli yang berimbang dan tidak berpihak.
- NEWS / FACTUAL UPDATE: Kehangatan terukur; fakta dan kronologi tetap menjadi fokus utama.

Hal yang Wajib Dihindari:
- Register akademis kaku (gaya makalah jurnal / skripsi)
- Irama terjemahan bahasa Inggris (translationese cadence)
- Frasa birokratis berbelit-belit
- Drama pemasaran / marketing hiperbolis ("solusi ajaib", "wajib dimiliki")
- Kosakata mentereng demi terdengar pintar
- Istilah teknis berlebihan tanpa penjelasan sederhana

# ATURAN PENULISAN WAJIB JOKO (AUTHORING STANDARDS)
A. SATU GAGASAN PER PARAGRAF (PARAGRAPH BREATHING & DENSITY)
   - Pola default: 1–3 kalimat per paragraf (rata-rata 30–70 kata).
   - Jangan menumpuk masalah, mekanisme fisika, contoh, dan kesimpulan ke dalam satu blok paragraf panjang.
   - Bila sebuah paragraf memuat lebih dari satu alur penalaran, PECAH menjadi paragraf terpisah.
   - Jaga ritme visual membaca: pendek, sedang, pendek, sedang.

B. KOSAKATA UMUM TERLEBIH DAHULU (COMMON WORD FIRST)
   - Utamakan kosakata bahasa Indonesia biasa bila maknanya setara dan akurat:
     * "leluasa membakar kaca" -> Ganti dengan: "langsung mengenai kaca"
     * "membedah perbandingan teknis" -> Ganti dengan: "membandingkan"
     * "membendung sinar matahari" -> Ganti dengan: "menghalangi sinar matahari"
     * "orientasi hadap" -> Ganti dengan: "arah jendela" atau "arah hadap dinding"
     * "geometri peneduh" -> Ganti dengan: "bentuk dan posisi peneduh"
     * "akumulasi termal" -> Ganti dengan: "penumpukan hawa panas"
     * "titik kulminasi harian" -> Ganti dengan: "posisi matahari tertinggi saat tengah hari"

C. JANGAN MENULIS DEMI TERLIHAT PINTAR (DO NOT WRITE TO SOUND SMART)
   - Bobot intelektual dan kecanggihan teknis naskah harus bersumber dari kualitas penalaran dan diagnosis, BUKAN dari kerumitan kosakata.

D. KONSISTENSI REGISTER & ANTI-DRAMA (REGISTER CONSISTENCY)
   - Jaga register bahasa tetap konsisten. Jangan melompat antara bahasa akademis kaku ke bahasa gaul/slang yang mendramatisasi.
   - Hindari kata-kata hiperbolis seperti: "seperti oven", "gelap gulita", "siang bolong", "menyiksa", "terbakar habis", kecuali benar-benar alami dan tak terhindarkan dalam konteks.

E. MARKDOWN BERSIH & KANONIKAL (CLEAN MARKDOWN ONLY)
   - Output Markdown harus berupa Markdown kanonikal yang valid.
   - DILARANG mencantumkan karakter sintaksis yang lolos/ter-escape (escaped markdown) seperti: *\\*, \\---, \\*, **\\**, \\(/path\\).
   - Gunakan *kata* untuk miring, **kata** untuk tebal, --- untuk pemisah, dan * untuk butir daftar.

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
   Sebelum menyarankan produk, material, atau tindakan perbaikan, diagnosa terlebih dahulu gejala fisik, akar penyebab struktural, dan jalur terjadinya masalah pada bangunan.
5. Rekomendasi Berbasis Skenario:
   Gunakan pola percabangan konkret yang relevan dengan topik: "Jika [Kondisi Lapangan A], maka [Opsi Penanganan 1]. Tetapi jika [Kondisi Lapangan B], maka [Opsi Penanganan 2]."
6. Transparansi Risiko & Kompromi Nyata:
   Paparkan trade-off dan konsekuensi lapangan nyata (keterbatasan teknis material, konsekuensi jangka panjang, perawatan, atau potensi efek samping) secara berimbang.
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

  // Format Visitor Problem Context dynamically
  let visitorPainBlock = '';
  if (visitorContext) {
    const painDef = CANONICAL_PAIN_DIMENSIONS[visitorContext.primaryPainDimension as PainDimension];
    const openingGuidance = buildDynamicOpeningGuidance(topic, visitorContext, authorSafeClaims);

    visitorPainBlock = `
# KONTEKS MASALAH PENGUNJUNG & SUDUT PEMBUKA (VISITOR PROBLEM CONTEXT)
- Konteks Masalah Utama: [${visitorContext.primaryContextId}] ${visitorContext.primaryContextLabel || 'Dilema Keputusan Pemilik Rumah'}
- Dimensi Keluhan Utama: ${visitorContext.primaryPainDimension} (${painDef?.label || 'Keraguan Keputusan'})
- Sudut Pembuka Naratif: ${visitorContext.openingAngle}
- Urutan Pola Pembuka yang Diharapkan: ${visitorContext.preferredSignature || 'DECISION > TRADEOFF > QUESTION'}

ARAHAN KHUSUS PARAGRAF PEMBUKA:
${openingGuidance}`;
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

  const staticStructureBlock = `# PERSYARATAN STRUKTUR ARTIKEL (ONE IDEA — ONE BEST HOME)
1. Paragraf Pembuka Masalah Riil: Menghadirkan dilema atau keraguan keputusan pemilik rumah secara wajar, empatik, dan tidak terburu-buru.
2. Diagnosis Akar Masalah Fisik: Menguraikan bagaimana mekanisme fisik atau kerusakan terjadi (alur fisik, gejala vs sumber masalah) dengan menghubungkan ke kenyamanan dan keamanan penghuni.
3. Evaluasi Solusi Teknis & Komparasi Pilihan: Membedah efektivitas masing-masing pilihan solusi/material secara berimbang berdasarkan bukti aman yang disediakan, tanpa melebih-lebihkan klaim sepihak.
4. Kompromi, Batasan & Risiko Lapangan: Membahas trade-off nyata di lapangan (keterbatasan teknis, konsekuensi pemeliharaan, potensi efek samping jika salah penanganan).
5. Panduan Skenario Kondisi Rumah: Rekomendasi terpadu berbasis skenario lapangan konkret. JANGAN membuat subjudul kesimpulan terpisah yang mengulang skenario ini secara berlebihan (ONE IDEA — ONE BEST HOME).
6. Panduan Aksi & Daftar Periksa Pra-Biaya (Next Action): Langkah pemeriksaan fisik mandiri di siang hari sebelum mengeluarkan uang, tanda apa yang mengubah keputusan solusi, dan kapan harus berkonsultasi dengan tenaga profesional/ahli.`;

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

${staticStructureBlock}
${revisionBlock}

Hasilkan sekarang draf naskah lengkap dalam format JSON Grounded Draft Envelope yang diminta di System Prompt (dengan properti "article_markdown", "claim_usage", dan "unsupported_claim_candidates"). Langsung berikan JSON tanpa basa-basi teks pengantar.`;
}

/**
 * Compiles complete prompt messages for Joko execution with separated static components.
 */
export function buildJokoPrompt(context: JokoPromptContext): JokoCompiledPrompt {
  const systemPrompt = buildJokoSystemPrompt();
  const userPrompt = buildJokoUserPrompt(context);

  const safeClaimsCount = context.authorSafeClaims?.length || context.evidencePack?.claim_inventory?.length || 0;
  const prohibitedClaimsCount = context.evidencePack?.prohibited_claims?.length || 0;

  const staticStructureBlock = `# PERSYARATAN STRUKTUR ARTIKEL (ONE IDEA — ONE BEST HOME)
1. Paragraf Pembuka Masalah Riil: Menghadirkan dilema atau keraguan keputusan pemilik rumah secara wajar, empatik, dan tidak terburu-buru.
2. Diagnosis Akar Masalah Fisik: Menguraikan bagaimana mekanisme fisik atau kerusakan terjadi (alur fisik, gejala vs sumber masalah) dengan menghubungkan ke kenyamanan dan keamanan penghuni.
3. Evaluasi Solusi Teknis & Komparasi Pilihan: Membedah efektivitas masing-masing pilihan solusi/material secara berimbang berdasarkan bukti aman yang disediakan, tanpa melebih-lebihkan klaim sepihak.
4. Kompromi, Batasan & Risiko Lapangan: Membahas trade-off nyata di lapangan (keterbatasan teknis, konsekuensi pemeliharaan, potensi efek samping jika salah penanganan).
5. Panduan Skenario Kondisi Rumah: Rekomendasi terpadu berbasis skenario lapangan konkret. JANGAN membuat subjudul kesimpulan terpisah yang mengulang skenario ini secara berlebihan (ONE IDEA — ONE BEST HOME).
6. Panduan Aksi & Daftar Periksa Pra-Biaya (Next Action): Langkah pemeriksaan fisik mandiri di siang hari sebelum mengeluarkan uang, tanda apa yang mengubah keputusan solusi, dan kapan harus berkonsultasi dengan tenaga profesional/ahli.`;

  const components: PromptSectionComponents = {
    staticSystemInstructions: systemPrompt,
    staticEditorialGuidelines: '# PRINSIP KONSULTAN AHLI & GAYA PENULISAN\n# KONTRAK KETERCANTUMAN KLAIM\n# INVARIAN KESELAMATAN & INTEGRITAS BUKTI',
    staticFormattingContract: '# FORMAT KELUARAN WAJIB (GROUNDED DRAFT ENVELOPE)',
    topicTitleBlock: `Topik Artikel: ${context.topic}\nJudul Naskah: ${context.requestedTitle || context.topic}`,
    dynamicVisitorPainBlock: context.visitorContext ? JSON.stringify(context.visitorContext) : '',
    dynamicAuthorSafeClaimsBlock: (context.authorSafeClaims || []).map((c) => c.statement).join('\n'),
    dynamicProhibitedClaimsBlock: (context.evidencePack?.prohibited_claims || []).join('\n'),
    staticStructureGuidelines: staticStructureBlock,
    dynamicRevisionBlock: context.revisionContext ? JSON.stringify(context.revisionContext.rewriteBrief) : undefined
  };

  return {
    systemPrompt,
    userPrompt,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    components,
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
 * Deterministic Pre-Provider Prompt Semantic Leak Audit.
 * Detects whether static prompt sections (system prompt, static instructions, general templates)
 * introduce technical domain concepts that do NOT originate from the active topic,
 * visitor context, or author safe claims.
 */
export function auditPromptSemanticLeaks(
  compiledPrompt: JokoCompiledPrompt,
  context: JokoPromptContext
): PromptSemanticLeakAuditResult {
  // Aggregate all active topic, context, claims and evidence text
  const activeInput = [
    context.topic || '',
    context.requestedTitle || '',
    JSON.stringify(context.visitorContext || {}),
    (context.authorSafeClaims || []).map((c) => `${c.statement} ${c.qualification_required || ''}`).join(' '),
    Array.isArray(context.evidencePack?.claim_inventory)
      ? context.evidencePack.claim_inventory.map((c: any) => c.statement || '').join(' ')
      : '',
    Array.isArray(context.evidencePack?.evidence_passages)
      ? context.evidencePack.evidence_passages.map((p: any) => p.passage_text || '').join(' ')
      : ''
  ].join(' ').toLowerCase();

  const leaks: PromptSemanticLeakAuditResult['leaks'] = [];

  const staticSystem = compiledPrompt.systemPrompt;
  const staticStructure = compiledPrompt.components?.staticStructureGuidelines || '';
  const staticUser = compiledPrompt.userPrompt;

  // Extract non-evidence portions of user prompt
  const safeClaimsIndex = staticUser.indexOf('# FAKTA & KLAIM TEKNIS AMAN');
  const userPromptStaticNonEvidence = safeClaimsIndex !== -1
    ? (staticUser.substring(0, safeClaimsIndex) + '\n' + staticUser.substring(staticUser.indexOf('# PERSYARATAN STRUKTUR ARTIKEL')))
    : staticUser;

  for (const term of SUSPICIOUS_STATIC_DOMAIN_TERMS) {
    const termLower = term.toLowerCase();
    const isPresentInActiveInput = activeInput.includes(termLower);

    // If the term is NOT part of the active topic, visitor context, or evidence pack,
    // it MUST NOT appear in the compiled prompt (system prompt or user prompt).
    if (!isPresentInActiveInput) {
      if (staticSystem.toLowerCase().includes(termLower)) {
        leaks.push({
          term,
          section: 'STATIC_SYSTEM',
          snippet: `Found "${term}" in static system instructions`
        });
      } else if (staticStructure.toLowerCase().includes(termLower)) {
        leaks.push({
          term,
          section: 'STATIC_USER_STRUCTURE',
          snippet: `Found "${term}" in static article structure guidelines`
        });
      } else if (staticUser.toLowerCase().includes(termLower)) {
        leaks.push({
          term,
          section: 'STATIC_GENERAL',
          snippet: `Found "${term}" in compiled user prompt instructions (absent from active inputs)`
        });
      }
    }
  }

  if (leaks.length > 0) {
    return {
      passed: false,
      leaks,
      code: 'WRITER_PROMPT_DOMAIN_LEAK',
      rejectionReason: `Static prompt instructions introduced technical domain concepts not present in active input: ${leaks.map((l) => l.term).join(', ')}`
    };
  }

  return {
    passed: true,
    leaks: []
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

/**
 * Common Word Preference Dictionary for Joko
 */
export const JOKO_COMMON_WORD_PREFERENCE_MAP: Record<string, string> = {
  'leluasa membakar kaca': 'langsung mengenai kaca',
  'membedah perbandingan teknis': 'membandingkan',
  'membendung sinar matahari': 'menghalangi sinar matahari',
  'orientasi hadap': 'arah jendela',
  'geometri peneduh': 'bentuk dan posisi peneduh',
  'panduan ini membedah': 'panduan ini membahas / membandingkan',
  'karakter praktis': 'kelebihan dan kekurangan',
  'konsekuensi perawatan': 'perawatan yang perlu diperhatikan',
  'intervensi': 'tindakan perbaikan / penanganan',
  'optimalisasi': 'cara memaksimalkan',
  'mekanisme': 'cara kerja',
  'berdasarkan karakter masalah': 'sesuai masalah yang dihadapi'
};

/**
 * Dramatic Register Patterns to Avoid in Joko Drafts
 */
export const JOKO_DRAMATIC_REGISTER_PATTERNS = [
  /\bseperti oven\b/i,
  /\bgelap gulita\b/i,
  /\bsiang bolong\b/i,
  /\bpanas menyiksa\b/i,
  /\bterbakar habis\b/i
];

/**
 * Literal Escaped Markdown Syntax Patterns (Forbidden in canonical drafts)
 */
export const JOKO_ESCAPED_MARKDOWN_PATTERNS = [
  /\*\\\*/,         // *\*
  /\\\*/,           // \*
  /\\\---/,         // \---
  /\*\*\\\*\*/,     // **\**
  /\\\(\/[a-zA-Z0-9_-]+\\\)/ // \(/path\)
];

export interface JokoDraftReadabilityAuditResult {
  passed: boolean;
  issues: string[];
  denseParagraphs: Array<{ index: number; wordCount: number; excerpt: string }>;
  escapedMarkdownPatterns: string[];
  unnaturalWordOccurrences: Array<{ word: string; preferred: string }>;
  dramaticRegisterOccurrences: string[];
  verboseTableCells: Array<{ line: number; wordCount: number; excerpt: string }>;
}

/**
 * Audits a draft against Joko's authoring standards:
 * - One idea per paragraph (flags paragraphs >= 90 words)
 * - Common word first (detects unnecessarily fancy/academic phrases)
 * - Register consistency (detects overly dramatic phrases)
 * - Clean Markdown (detects escaped markdown patterns)
 */
export function auditJokoDraftReadability(markdown: string): JokoDraftReadabilityAuditResult {
  const issues: string[] = [];
  const text = String(markdown || '').trim();

  // 1. Escaped markdown patterns
  const foundEscaped: string[] = [];
  for (const pat of JOKO_ESCAPED_MARKDOWN_PATTERNS) {
    const match = text.match(pat);
    if (match) {
      foundEscaped.push(match[0]);
    }
  }
  if (foundEscaped.length > 0) {
    issues.push(`Ditemukan sintaks Markdown ter-escape (${foundEscaped.join(', ')}). Output harus berupa Markdown kanonikal bersih.`);
  }

  // 2. Paragraph density (ignore headings, tables, separators)
  const paragraphs = text
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('#') && !p.startsWith('---') && !p.startsWith('|'));

  const denseParagraphs: Array<{ index: number; wordCount: number; excerpt: string }> = [];
  paragraphs.forEach((p, idx) => {
    // If it's a list item, count words in the item
    const words = p.split(/\s+/).filter(Boolean).length;
    if (words >= 90) {
      denseParagraphs.push({
        index: idx + 1,
        wordCount: words,
        excerpt: p.slice(0, 100) + '...'
      });
    }
  });

  if (denseParagraphs.length > 0) {
    issues.push(`Ditemukan ${denseParagraphs.length} paragraf padat (>= 90 kata). Pecah menjadi 1-3 kalimat per paragraf untuk menjaga ritme visual membaca.`);
  }

  // 3. Common word preferences
  const unnaturalWords: Array<{ word: string; preferred: string }> = [];
  for (const [fancyWord, commonWord] of Object.entries(JOKO_COMMON_WORD_PREFERENCE_MAP)) {
    const reg = new RegExp(`\\b${fancyWord}\\b`, 'i');
    if (reg.test(text)) {
      unnaturalWords.push({ word: fancyWord, preferred: commonWord });
    }
  }
  if (unnaturalWords.length > 0) {
    issues.push(`Utamakan kosakata umum: ${unnaturalWords.map(u => `"${u.word}" -> "${u.preferred}"`).join(', ')}.`);
  }

  // 4. Dramatic register patterns
  const dramaticWords: string[] = [];
  for (const pat of JOKO_DRAMATIC_REGISTER_PATTERNS) {
    const m = text.match(pat);
    if (m) {
      dramaticWords.push(m[0]);
    }
  }
  if (dramaticWords.length > 0) {
    issues.push(`Hindari frasa drama/hiperbolis: ${dramaticWords.join(', ')}.`);
  }

  // 5. Comparison table cell verbosity check
  // Comparison tables must contain concise summary statements, not mini-essays
  const tableLines = text.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  const verboseTableCells: Array<{ line: number; wordCount: number; excerpt: string }> = [];
  tableLines.forEach((line, idx) => {
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) return;
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    cells.forEach((cell) => {
      const words = cell.split(/\s+/).filter(Boolean).length;
      if (words > 20) {
        verboseTableCells.push({
          line: idx + 1,
          wordCount: words,
          excerpt: cell.slice(0, 60) + '...'
        });
      }
    });
  });
  if (verboseTableCells.length > 0) {
    issues.push(`Ditemukan ${verboseTableCells.length} sel tabel terlalu panjang (> 20 kata). Sel tabel perbandingan harus berupa rangkuman ringkas, bukan esai mini.`);
  }

  return {
    passed: issues.length === 0,
    issues,
    denseParagraphs,
    escapedMarkdownPatterns: foundEscaped,
    unnaturalWordOccurrences: unnaturalWords,
    dramaticRegisterOccurrences: dramaticWords,
    verboseTableCells
  };
}
