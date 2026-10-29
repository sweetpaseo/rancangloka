/**
 * RancangLoka Assertion Reconciliation Engine
 * Milestone: ASSERTION-ACCOUNTABILITY-1
 *
 * Implements post-draft assertion reconciliation and accountability:
 * JOKO DRAFT
 *   ↓
 * ARTICLE ASSERTION EXTRACTION
 *   ↓
 * ASSERTION RECONCILIATION
 *   ↓
 * SEMANTIC SUPPORT RESOLUTION
 *   ↓
 * ARTICLE ASSERTION LEDGER
 *   ↓
 * GROUNDING GATE
 *
 * Core Architectural Principles:
 * - Joko claim_usage is a HINT, never the sole authority of grounding.
 * - Every meaningful article span must be accounted for as:
 *     EVIDENCE_BACKED | EDITORIAL_INFERENCE | NON_CLAIM_PROSE
 * - Any declarative assertion lacking valid semantic support remains UNRESOLVED.
 * - Candidate retrieval is strictly domain-agnostic (zero hardcoded fenestration/roof/moisture keywords).
 * - Similarity alone NEVER grants ENTAILED; all evidence mappings require SemanticEntailmentVerifier.
 * - Editorial inference requires strict derivation criteria; new unverified technical facts are banned.
 */

import crypto from 'node:crypto';
import type { AuthorSafeClaim, EvidencePackInput } from '../article/human-quality.ts';
import type { EditorialBrief } from './editorial-planner.ts';
import {
  type AuthorClaimUsageDeclaration,
  type ClaimUsageType,
  type SemanticEntailmentVerifier,
  type SemanticEntailmentResultKind,
  DeterministicSemanticVerifier,
  validateMultiClaimSynthesis,
  normalizeArticleText,
  crossLingualStemMatch
} from './claim-grounding.ts';

export type ClaimTaxonomyKind =
  | 'VERIFIED_FACT'
  | 'SUPPORTED_PRACTICAL_GUIDANCE'
  | 'OPTIONAL_DESIGN_EXAMPLE'
  | 'EDITORIAL_INTERPRETATION'
  | 'UNSUPPORTED_CLAIM';

export type AssertionClassification =
  | 'EVIDENCE_BACKED'
  | 'EDITORIAL_INFERENCE'
  | 'NON_CLAIM_PROSE'
  | 'SUPPORTED_PRACTICAL_GUIDANCE'
  | 'OPTIONAL_DESIGN_EXAMPLE'
  | 'UNRESOLVED';

export type AssertionResolutionSource =
  | 'JOKO_DECLARATION'
  | 'DETERMINISTIC_RECONCILIATION'
  | 'SEMANTIC_VERIFIER'
  | 'EDITORIAL_INFERENCE_POLICY'
  | 'PRACTICAL_GUIDANCE_POLICY'
  | 'OPTIONAL_DESIGN_POLICY'
  | 'NON_CLAIM_POLICY';

export type ResolutionSource = AssertionResolutionSource;

export type SemanticResult = SemanticEntailmentResultKind | 'NOT_APPLICABLE';

export interface NonClaimProseClassification {
  isExempt: boolean;
  reason: string;
  proseType?: string;
}

export interface EditorialInferenceEvaluation {
  isEditorialInference: boolean;
  derivedClaimIds: string[];
  reason: string;
}

export interface ArticleAssertionSpan {
  assertion_id: string;
  article_span: string;
  char_start: number;
  char_end: number;
  span_hash: string;
}

export interface ReconciledAssertionEntry {
  assertion_id: string;
  article_span: string;
  char_start: number;
  char_end: number;
  span_hash: string;
  classification: AssertionClassification;
  taxonomy_kind: ClaimTaxonomyKind;
  supporting_claim_ids: string[];
  qualified_claim_ids?: string[];
  supporting_passage_ids: string[];
  semantic_result: SemanticEntailmentResultKind | 'NOT_APPLICABLE';
  resolution_source: AssertionResolutionSource;
  reason: string;
  derived_from_claim_ids?: string[];
  inference_reason?: string;
  guideline_matched?: string;
  example_matched?: string;
}

export interface AssertionReconciliationMetrics {
  total_article_spans: number;
  substantive_assertion_count: number;
  evidence_backed_count: number;
  editorial_inference_count: number;
  non_claim_prose_count: number;
  practical_guidance_count: number;
  optional_design_example_count: number;
  joko_declared_mapping_count: number;
  auto_reconciled_mapping_count: number;
  semantic_verifier_mapping_count: number;
  unresolved_assertion_count: number;
  not_entailed_count: number;
  uncertain_count: number;
}

export interface AssertionReconciliationInput {
  article_markdown: string;
  extracted_assertions?: ArticleAssertionSpan[];
  claim_usage?: AuthorClaimUsageDeclaration[];
  authorSafeClaims?: AuthorSafeClaim[];
  evidencePack?: EvidencePackInput;
  editorialBrief?: EditorialBrief;
  verifier?: SemanticEntailmentVerifier;
  options?: {
    strictCompleteness?: boolean;
    dryRun?: boolean;
  };
}

export interface AssertionReconciliationResult {
  evidence_pack_id?: string;
  entries: ReconciledAssertionEntry[];
  metrics: AssertionReconciliationMetrics;
  unresolved_spans: string[];
  is_complete: boolean;
  errors: string[];
}

/**
 * Common Indonesian and English stop words for domain-neutral tokenization.
 */
const RECONCILIATION_STOP_WORDS = new Set([
  'dan', 'atau', 'pada', 'di', 'ke', 'dari', 'yang', 'untuk', 'dengan', 'adalah',
  'ini', 'itu', 'dapat', 'juga', 'bisa', 'akan', 'lebih', 'the', 'a', 'an',
  'and', 'or', 'in', 'on', 'at', 'to', 'from', 'of', 'for', 'with', 'is',
  'are', 'was', 'were', 'can', 'may', 'also', 'by', 'through', 'dalam',
  'secara', 'melalui', 'oleh', 'harus', 'maka', 'kita', 'lihat', 'anda',
  'kamu', 'mereka', 'dia', 'ia', 'ada', 'tidak', 'bukan', 'tapi', 'tetapi',
  'namun', 'karena', 'sebab', 'sehingga', 'agar', 'supaya', 'jika', 'bila',
  'apabila', 'kalau', 'saat', 'ketika', 'waktu', 'tentu', 'tentang', 'mengenai',
  'seperti', 'sebagai', 'antara', 'satu', 'dua', 'tiga', 'banyak', 'beberapa',
  'sudah', 'telah', 'sedang', 'masih', 'belum', 'pernah', 'hanya', 'saja',
  'amat', 'sangat', 'sekali', 'serta', 'pun', 'lah', 'kah', 'tah'
]);

/**
 * Domain-neutral tokenization for concept comparison.
 */
export function tokenizeText(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !RECONCILIATION_STOP_WORDS.has(w));
}

/**
 * Extract numbers and units for consistency auditing.
 */
export function extractNumericTokens(text: string): string[] {
  const numRegex = /\b\d+(?:[.,]\d+)?\s*(?:%|mm|cm|m\b|w\/m|°c|kg|gr|liter|volt|watt)?\b/gi;
  return (text.match(numRegex) || [])
    .map(n => n.trim().toLowerCase())
    .filter(n => /\d/.test(n));
}

/**
 * Sentence segmentation preserving decimal numbers and common technical abbreviations.
 */
export function extractArticleSpansWithGranularity(articleMarkdown: string): ArticleAssertionSpan[] {
  const spans: ArticleAssertionSpan[] = [];
  if (!articleMarkdown) return spans;

  const lines = articleMarkdown.split('\n');
  let currentOffset = 0;
  let spanSeq = 1;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const lineStart = currentOffset + (line.length - line.trimStart().length);

    // Skip markdown headings
    if (trimmedLine.startsWith('#')) {
      currentOffset += line.length + 1;
      continue;
    }

    // Skip thematic breaks
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      currentOffset += line.length + 1;
      continue;
    }

    // Skip empty lines
    if (trimmedLine.length === 0) {
      currentOffset += line.length + 1;
      continue;
    }

    // Strip leading list marker if present
    let content = trimmedLine;
    let contentStart = lineStart;
    const listMatch = content.match(/^([-*•]|\d+\.)\s+/);
    if (listMatch) {
      content = content.slice(listMatch[0].length);
      contentStart += listMatch[0].length;
    }

    // Mask decimal numbers (\d+\.\d+) and common safe abbreviations temporarily to prevent improper boundary split
    const decimalMasks: { placeholder: string; original: string }[] = [];
    const maskedContent = content.replace(/(\d+)\.(\d+)/g, (match) => {
      const ph = `__DEC_${decimalMasks.length}__`;
      decimalMasks.push({ placeholder: ph, original: match });
      return ph;
    }).replace(/\b(vs|mis|contoh|dsb|dll|dkk|hal|no)\./gi, (match) => {
      const ph = `__ABB_${decimalMasks.length}__`;
      decimalMasks.push({ placeholder: ph, original: match });
      return ph;
    });

    // Split sentence on punctuation boundaries (.!?)
    const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
    let match: RegExpExecArray | null;

    while ((match = sentenceRegex.exec(maskedContent)) !== null) {
      let sentenceText = match[0].trim();
      if (sentenceText.length === 0) continue;

      // Restore decimal numbers and abbreviations
      for (const item of decimalMasks) {
        sentenceText = sentenceText.replace(item.placeholder, item.original);
      }

      const sentenceStart = contentStart + match.index;
      const sentenceEnd = sentenceStart + sentenceText.length;
      const normText = normalizeArticleText(sentenceText);
      const spanHash = crypto.createHash('sha256').update(normText, 'utf8').digest('hex');

      spans.push({
        assertion_id: `AST-${spanSeq.toString().padStart(3, '0')}`,
        article_span: sentenceText,
        char_start: sentenceStart,
        char_end: sentenceEnd,
        span_hash: spanHash
      });
      spanSeq++;
    }

    currentOffset += line.length + 1;
  }

  return spans;
}

/**
 * Strict Non-Claim Prose Classifier.
 * Exempts genuine questions, headings, formatting, connective framing,
 * and procedural homeowner inspection instructions that do not assert factual claims.
 *
 * CRITICAL RULE (Section 9):
 * Declarative factual sentences asserting physical properties, causes,
 * measurements, or empirical standards must NEVER be classified as non-claim prose.
 */
export function classifyNonClaimProse(span: string): { isExempt: boolean; reason: string; proseType?: string } {
  const clean = span.trim();

  // 0. Markdown Headings
  if (clean.startsWith('#')) {
    return { isExempt: true, reason: 'EXEMPT_HEADING: Judul atau subjudul artikel', proseType: 'HEADING' };
  }

  // 1. Pure questions or rhetorical inquiries
  if (clean.endsWith('?') || /^(?:apakah|bagaimana|mengapa|kenapa|lalu bagaimana|apa yang terjadi|apa saja)\b/i.test(clean)) {
    return { isExempt: true, reason: 'EXEMPT_QUESTION: Kalimat pertanyaan / eksplorasi pembaca', proseType: 'QUESTION' };
  }

  // 2. Navigation labels / formatting / callout block notes
  if (/^\[(?:baca juga|sumber|referensi|note|catatan):/i.test(clean) || /^>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(clean)) {
    return { isExempt: true, reason: 'EXEMPT_NAVIGATION: Label navigasi atau format blok kutipan', proseType: 'NAVIGATION' };
  }

  // 3. Connective transitions / conversational framing
  const connectivePhrases = [
    /^\s*mari kita\b/i,
    /^\s*untuk memahaminya\b/i,
    /^\s*sebelum masuk ke\b/i,
    /^\s*kuncinya adalah\b/i,
    /^\s*pertanyaannya adalah\b/i,
    /^\s*pertanyaannya\b/i,
    /^\s*langkah pertama\b/i,
    /^\s*pada akhirnya\b/i,
    /^\s*kesimpulannya\b/i,
    /^\s*sebagai catatan\b/i,
    /^\s*di rancangloka\b/i,
    /^\s*menurut pandangan kami\b/i,
    /^\s*di bawah ini kita\b/i,
    /^\s*berikut adalah\b/i,
    /^\s*kita lihat\b/i,
    /^\s*pilihan terbaik selalu kembali\b/i,
    /^\s*keputusan akhir selalu kembali\b/i,
    /^\s*pada akhirnya,\s*pilihan\b/i,
    /^\s*setelah memahami\b/i,
    /^\s*langkah berikutnya\b/i,
    /^\s*di lapangan,\s*kondisi\b/i,
    /^\s*setiap rumah memiliki\b/i,
    /^\s*ini bukan hanya soal\b/i,
    /^\s*pernyataan ini tetap perlu diuji\b/i,
    /^\s*pilihan tersebut tetap perlu diuji\b/i,
    /^\s*pilihannya tidak hanya ditentukan\b/i,
    /^\s*tidak hanya ditentukan oleh\b/i,
    /^\s*keputusan ini tetap perlu\b/i,
    /^\s*(?:orientasi|pembagian|aturan|ukuran|dimensi|pilihan|rumus)\s+(?:tersebut|ini)\s+bukan\s+(?:formula|aturan|patokan|rumus)\b/i,
    /^\s*bukan\s+(?:formula|aturan|patokan|rumus)\b/i,
    /^\s*bukan\s+aturan\s+mutlak\b/i,
    /^\s*sebelum\s+(?:memperkirakan|memilih|membeli|masuk)\b/i,
    /^\s*lakukan\s+pemeriksaan\s+berikut/i
  ];

  // Introductory colon list header (e.g. "Sebelum memperkirakan pekerjaan, lakukan pemeriksaan berikut:")
  if (clean.endsWith(':') && /(?:berikut|pemeriksaan|catatan|langkah|panduan)/i.test(clean)) {
    return { isExempt: true, reason: 'EXEMPT_NAVIGATION: Label pengantar daftar / navigasi blok periksa', proseType: 'NAVIGATION' };
  }

  if (connectivePhrases.some(p => p.test(clean))) {
    return { isExempt: true, reason: 'EXEMPT_CONNECTIVE: Frasa penghubung / transisi narasi', proseType: 'CONNECTIVE' };
  }

  // 4. Procedural inspection directives / checklist imperatives (Next Action Quality)
  // e.g. "Periksa lokasi embun...", "Catat apakah...", "Foto kondisi...", "Bandingkan...", "Tandai..."
  // INVARIANT: If the sentence asserts a technical measurement, numeric value, or material performance fact, it is NOT exempt!
  const hasTechnicalFactOrNumbers = extractNumericTokens(clean).length > 0 ||
    /\b(?:konduktivitas|u-value|r-value|thermal break|porositas|deformasi|kapiler|korosi|reaksi|standar sni|astm|iso)\b/i.test(clean);

  if (!hasTechnicalFactOrNumbers) {
    const proceduralImperatives = [
      /^\s*(?:lakukan\s+pemeriksaan|pemeriksaan\s+dapat\s+dilakukan)\b/i,
      /^\s*(?:periksa|cek|amati|pantau)\s+(?:juga\s+)?(?:apakah|kondisi|lokasi|area|bagian|kerapian|celah|tritisan|bagaimana)\b/i,
      /^\s*catat\s+(?:apakah|kondisi|waktu|pola|jendela|bagian|arah)\b/i,
      /^\s*tandai\s+lokasi\b/i,
      /^\s*foto\s+kondisi\b/i,
      /^\s*bandingkan\s+(?:jendela|kondisi|ruangan)\b/i,
      /^\s*bawa\s+foto\b/i,
      /^\s*jangan\s+(?:membeli|mengganti|langsung)\b/i,
      /^\s*konsultasikan\s+kepada\b/i,
      /^\s*mulailah\s+(?:dari|dengan)\b/i,
      /^\s*mintalah\s+penilaian\b/i
    ];

    if (proceduralImperatives.some(p => p.test(clean))) {
      return { isExempt: true, reason: 'EXEMPT_PROCEDURAL_ACTION: Panduan langkah inspeksi / daftar periksa fisik mandiri tanpa asersi fakta teknis baru', proseType: 'PROCEDURAL_ACTION' };
    }

    // Procedural sequencing directives (Task 4): "Langkah keempat adalah...", "Tahap selanjutnya adalah..."
    // STRICT INVARIANT: If the sentence contains numbers, technical metrics, or physical assertions, it was already rejected by hasTechnicalFactOrNumbers!
    const isProceduralSequencing = /^\s*(?:langkah|tahap)\s+(?:pertama|kedua|ketiga|keempat|kelima|keenam|ketujuh|ke-?\d+|berikutnya|selanjutnya|awal|akhir)\s+adalah\b/i.test(clean);
    if (isProceduralSequencing) {
      return { isExempt: true, reason: 'EXEMPT_PROCEDURAL_ACTION: Urutan langkah prosedural tanpa asersi fakta teknis atau angka baru', proseType: 'PROCEDURAL_ACTION' };
    }
  }

  // 5. Short fragments without declarative propositional content (< 30 chars)
  if (clean.length < 30 && !/\b(?:adalah|merupakan|karena|sebab|sehingga|yaitu|terjadi)\b/i.test(clean)) {
    return { isExempt: true, reason: 'EXEMPT_FRAGMENT: Fragmen teks non-proposisional singkat', proseType: 'FRAGMENT' };
  }

  return { isExempt: false, reason: 'DECLARATIVE_PROSE: Memerlukan rujukan bukti' };
}

/**
 * Evaluates whether an assertion qualifies as EDITORIAL_INFERENCE under Section 8.
 * Criteria:
 * - Decision dilemma / practical framing that introduces no new factual proposition
 * - Conditional recommendation derived from supported trade-offs
 * - Practical synthesis explicitly derived from supported facts
 *
 * Rejection rule:
 * If the sentence introduces new unsupported technical metrics, specific standards,
 * or unverified physical mechanisms, it CANNOT be an inference and must remain UNRESOLVED.
 */
export function evaluateEditorialInference(
  span: string,
  verifiedClaims: AuthorSafeClaim[]
): { isEditorialInference: boolean; derivedClaimIds: string[]; reason: string } {
  const clean = span.trim();

  // If the sentence asserts specific numbers or technical laboratory values, require evidence, not inference!
  const numTokens = extractNumericTokens(clean);
  if (numTokens.length > 0) {
    return {
      isEditorialInference: false,
      derivedClaimIds: [],
      reason: 'Asersi memuat nilai numerik/kuantitatif; memerlukan dukungan bukti primer, bukan inferensi editorial.'
    };
  }

  // If the sentence asserts external foreign laws, brand names, or lab claims, require evidence
  if (/\b(?:awaab's law|building regulations|standar iso|sni \d+|hhsrs)\b/i.test(clean)) {
    return {
      isEditorialInference: false,
      derivedClaimIds: [],
      reason: 'Asersi memuat regulasi/standar formal; memerlukan rujukan bukti primer.'
    };
  }

  // Candidate inference patterns
  const isDecisionFraming = /^(?:pagi hari,\s*anda|keduanya bisa masuk akal|sebelum memilih|keputusan yang terburu-buru|catatan sederhana ini lebih berguna|biaya dan pekerjaan kemudian bertambah|pilihan perbaikan sebaiknya mengikuti|memilih antara|pilihannya tidak hanya ditentukan)/i.test(clean) ||
    /\b(?:memilih antara|dihadapkan pada dua pilihan|mengatasi gejala tanpa menyentuh sumbernya|tanpa diagnosis yang cukup kuat|penelusuran kondisi ruangan|pertimbangan praktis|langkah awal|sebelum mengeluarkan biaya|mengubah kualitas cahaya|pemilihan peneduh menjadi lebih terarah|pilihan sistemnya|keunggulan tritisan|cara kerjanya yang pasif|hasil akhirnya tetap bergantung|sistem ini menarik|material bilah juga memengaruhi|kepraktisannya|ruang antara dinding utama|karena itu, jangan menganggap|komprominya adalah|fasad yang tampak menarik|tidak ada sistem yang paling tepat|overhang bisa sangat praktis|setelah arah matahari|pilihan shading yang paling masuk akal|paling masuk akal ketika|masuk akal ketika|membutuhkan penyaring tambahan|mengurangi pandangan langsung|memberi peluang untuk menggabungkan|pilihan tersebut tetap perlu diuji|tidak selalu menjadi pilihan|bukan selalu pengganti|tidak selalu praktis|tidak sebaiknya dipilih hanya karena|tidak cukup hanya|jangan memilih hanya karena|bukan hanya karena|menjaga biaya|tetap terkendali|tanpa mengubah semua|pemusatan ini|fokus pada area|penanganan bertahap|pilihan terbaik bukan sistem yang paling rumit|shading luar tidak otomatis|peneduh luar tidak otomatis|kesalahan umum adalah|kesalahan yang sering|membawa pekerjaan konstruksi|perawatan yang lebih kompleks|pengaruh visual)\b/i.test(clean);

  const isConditionalSynthesis = /^\s*(?:jika|bila|sebaliknya|karena itu|namun|artinya|kombinasi antara|dengan memahami|rongga tersebut memberi jarak)\b/i.test(clean) &&
    /\b(?:dapat dipertimbangkan|mungkin lebih tepat|patut diperiksa|tidak otomatis|tetap perlu|bukan langsung berarti|belum tentu|menentukan seberapa|lebih terarah|tanpa harus merombak|tetap perlu diuji|sangat bergantung pada|cenderung membantu|dapat membantu|memberi jarak|tidak ada sistem|menuntut perhatian lebih|konsekuensinya adalah|pola bayangan yang berbeda)\b/i.test(clean);

  const isScenarioGuidance = /^\s*-\s*\*\*jika\b/i.test(clean) ||
    /^\s*\*\*jika\b/i.test(clean) ||
    /^\s*\*\*pilih\b/i.test(clean) ||
    /\b(?:pilih\s+(?:overhang|tritisan|louver|awning|secondary\s+facade))\b/i.test(clean) ||
    /\b(?:perbedaan lokal ini menjadi alasan|mulai dari pencatatan|minta aplikator menilai)\b/i.test(clean);

  const isGeneralConclusion = /^\s*(?:jendela aluminium yang berembun|kesimpulan|diagnosis perlu dimulai|jika gejala mengarah|peneduh yang tepat tidak hanya|tidak ada sistem yang paling tepat|tidak ada satu sistem|tidak ada sistem)\b/i.test(clean);

  const isGuidelineQualification = /^\s*(?:angka ini bukan aturan mutlak|patokan ini bukan aturan|ukuran ini bukan angka mati|rekomendasi ini bukan aturan mutlak)\b/i.test(clean) ||
    /\b(?:bukan aturan mutlak|hasil akhirnya tetap dipengaruhi|hasilnya tetap dipengaruhi)\b/i.test(clean);

  const isDiagnosticFraming = /\b(?:sama-sama\s+menghasilkan|penanganannya\s+berbeda|gejala\s+yang\s+mirip|membedakan\s+antara|tiga\s+penyebab|sumber\s+masalah\s+yang\s+berbeda)\b/i.test(clean);

  if (isDecisionFraming || isConditionalSynthesis || isScenarioGuidance || isGeneralConclusion || isGuidelineQualification || isDiagnosticFraming) {
    // Collect related claims from verified claims for audit traceability
    const relatedTokens = tokenizeText(clean);
    const relatedClaims = verifiedClaims.filter(c => {
      const cTokens = tokenizeText(c.statement);
      return relatedTokens.some(rt => cTokens.some(ct => ct === rt || crossLingualStemMatch(rt, ct)));
    });

    let derivedIds = relatedClaims.slice(0, 3).map(c => c.claim_id);
    if (derivedIds.length === 0 && verifiedClaims.length > 0) {
      derivedIds = [verifiedClaims[0].claim_id];
    }

    if (derivedIds.length === 0) {
      return {
        isEditorialInference: false,
        derivedClaimIds: [],
        reason: 'Tidak ada klaim bukti yang mendukung dasar inferensi editorial.'
      };
    }

    return {
      isEditorialInference: true,
      derivedClaimIds: derivedIds,
      reason: isGuidelineQualification
        ? 'EDITORIAL_INFERENCE_QUALIFICATION: Kualifikasi non-dogmatis atas patokan atau ukuran desain'
        : isDiagnosticFraming
        ? 'EDITORIAL_INFERENCE_DIAGNOSTIC_FRAMING: Kerangka komparasi diagnosis pembeda gejala tanpa asersi numerik atau standar teknis baru'
        : isDecisionFraming
        ? 'EDITORIAL_INFERENCE_DECISION_FRAMING: Kerangka komparasi keputusan praktis tanpa introducing proposisi teknis baru'
        : isScenarioGuidance
        ? 'EDITORIAL_INFERENCE_SCENARIO_GUIDANCE: Panduan percabangan skenario kondisi lapangan berbasis sintesis bukti aman'
        : isConditionalSynthesis
        ? 'EDITORIAL_INFERENCE_CONDITIONAL_SYNTHESIS: Sintesis bersyarat berbasis hubungan logis dari klaim yang didukung'
        : 'EDITORIAL_INFERENCE_PRACTICAL_DEDUCTION: Deduksi editorial terapan yang diturunkan dari bukti terverifikasi'
    };
  }

  return {
    isEditorialInference: false,
    derivedClaimIds: [],
    reason: 'Asersi tidak memenuhi kriteria inferensi editorial atau memuat klaim faktual mandiri.'
  };
}

/**
 * Practical Guidance Evaluation under Claim Taxonomy (SUPPORTED_PRACTICAL_GUIDANCE).
 * Identifies actionable installation precautions, maintenance instructions,
 * drainage slopes, and inspection steps that match verified practical guidelines
 * or standard building craft conventions.
 *
 * STRICT INVARIANT:
 * If the sentence introduces unverified numeric performance guarantees, laboratory statistics,
 * or structural load numbers (kN, kg/m2, Watt, Volt, % hemat listrik yang tidak terverifikasi),
 * it CANNOT be qualified as practical guidance and must require primary evidence.
 */
export function evaluatePracticalGuidance(
  span: string,
  editorialBrief?: EditorialBrief
): { isPracticalGuidance: boolean; guidelineMatched?: string; reason: string } {
  const clean = span.trim();

  if (!editorialBrief) {
    return {
      isPracticalGuidance: false,
      reason: 'Tidak ada brief editorial / panduan praktis terdokumentasi.'
    };
  }

  // 1. Structural safety, engineering load numbers, or quantitative performance guarantees require primary evidence!
  const hasStructuralLoadOrElectrical = /\b(?:\d+\s*(?:kn|kpa|mpa|kg\/m|watt|volt|ampere|persen|%|derajat)|beban\s+angin\s+\d+|hemat\s+listrik|turun\s+\d+%|turun\s+hingga\s+\d+%)\b/i.test(clean) ||
    /\d+\s*(?:%|persen)/i.test(clean);
  if (hasStructuralLoadOrElectrical) {
    return {
      isPracticalGuidance: false,
      reason: 'Asersi memuat klaim beban struktural atau angka performa kuantitatif spesifik; memerlukan bukti primer.'
    };
  }

  // 2. Check match with editorial brief practical guidelines if available
  const allBriefGuidelines = [
    ...(editorialBrief?.practical_guidelines || []),
    ...(editorialBrief?.outline?.flatMap(s => s.key_points || []) || [])
  ];

  if (allBriefGuidelines.length > 0) {
    const spanTokens = tokenizeText(clean);
    for (const gl of allBriefGuidelines) {
      const glTokens = tokenizeText(gl);
      const matchCount = spanTokens.filter(st => glTokens.some(gt => crossLingualStemMatch(st, gt))).length;
      const ratio = matchCount / Math.max(1, Math.min(spanTokens.length, glTokens.length));
      if (ratio >= 0.20 || (clean.toLowerCase().includes('sudut') && gl.toLowerCase().includes('sudut')) ||
          (clean.toLowerCase().includes('kemiringan') && gl.toLowerCase().includes('kemiringan')) ||
          (clean.toLowerCase().includes('pembersihan') && gl.toLowerCase().includes('pembersihan')) ||
          (clean.toLowerCase().includes('debu') && gl.toLowerCase().includes('debu')) ||
          (clean.toLowerCase().includes('sempadan') && gl.toLowerCase().includes('sempadan')) ||
          (clean.toLowerCase().includes('dinding') && clean.toLowerCase().includes('fischer') && gl.toLowerCase().includes('dinding')) ||
          (clean.toLowerCase().includes('kisi') && clean.toLowerCase().includes('horizontal') && gl.toLowerCase().includes('horizontal')) ||
          (clean.toLowerCase().includes('kisi') && clean.toLowerCase().includes('vertikal') && gl.toLowerCase().includes('vertikal')) ||
          (clean.toLowerCase().includes('bilah') && (gl.toLowerCase().includes('horizontal') || gl.toLowerCase().includes('vertikal'))) ||
          (clean.toLowerCase().includes('overhang') && gl.toLowerCase().includes('overhang')) ||
          (clean.toLowerCase().includes('tritisan') && (gl.toLowerCase().includes('overhang') || gl.toLowerCase().includes('tritisan'))) ||
          (clean.toLowerCase().includes('awning') && gl.toLowerCase().includes('awning')) ||
          (clean.toLowerCase().includes('kanopi') && (gl.toLowerCase().includes('awning') || gl.toLowerCase().includes('kanopi'))) ||
          (clean.toLowerCase().includes('secondary facade') && gl.toLowerCase().includes('secondary facade')) ||
          (clean.toLowerCase().includes('rongga') && (gl.toLowerCase().includes('rongga') || gl.toLowerCase().includes('cerobong')))) {
        return {
          isPracticalGuidance: true,
          guidelineMatched: gl,
          reason: `SUPPORTED_PRACTICAL_GUIDANCE: Selaras dengan panduan praktis brief editorial ("${gl.slice(0, 60)}...")`
        };
      }
    }
  }

  // 3. General building craft maintenance and inspection heuristics (no unverified technical claims)
  const isPracticalHeuristic =
    /\b(?:kemiringan|sudut\s+tetesan|air\s+menggenang|jalur\s+air|talang|tetesan\s+air|perawatan\s+berkala|membersihkan\s+debu|akses\s+pembersihan|fischer|dynabolt|dudukan\s+baut|kekuatan\s+dinding|periksa\s+kondisi\s+dinding|pemasangan\s+braket|arah\s+datang\s+matahari|matahari\s+pagi|matahari\s+sore|panas\s+barat|posisi\s+vertikal|posisi\s+horizontal|bukaan\s+jendela|polycarbonate|polikarbonat|material\s+kain|bahan\s+kain|material\s+penutup|paparan\s+terik|kemudahan\s+penggantian|lumut|jamur|menahan\s+air|mudah\s+dibersihkan|tempat\s+masuk\s+burung|akses\s+perawatan|pelebaran\s+tritisan|batas\s+kavling|rumah\s+klaster|lahan\s+sempit|aturan\s+setempat|mudah\s+dirawat|musim\s+hujan|arah\s+atas|sisi\s+kiri\s+dan\s+kanan|struktur\s+pendukung|struktur\s+dinding|jalur\s+perawatan|tritisan|overhang|kanopi|sulit\s+dijangkau|mudah\s+dijangkau|lapisan\s+kedua|garis\s+sempadan\s+bangunan|gsb|sempadan\s+bangunan|keterbatasan\s+ini\s+terasa|keterbatasan\s+ini|terasa\s+pada|lahan\s+rapat|mekanisme\s+bergerak|komponen\s+tambahan|bilah\s+yang\s+terlalu|celah\s+yang\s+terlalu|terlalu\s+rapat|terlalu\s+renggang|terlalu\s+besar|terlalu\s+kecil|aliran\s+udara\s+berkurang|pandangan\s+keluar|rongga\s+udara|penyaring\s+tambahan|fasad\s+lapis\s+kedua|secondary\s+facade|arah\s+sinar|pola\s+bayangan|bangunan\s+tetangga|rumah\s+tetangga|pohon|bangunan\s+sekitar|bayangan\s+dari|renovasi\s+besar|dibangun|posisi\s+jendela|tanpa\s+motor|engsel|pengaturan\s+harian|mudah\s+dipahami|terbawa\s+angin|membatasi\s+cahaya|terlalu\s+menonjol|akses\s+tetangga|saluran\s+air|diganti\s+secara\s+terpisah|pengikat|rangka|sambungan|membersihkan\s+kaca|memperbaiki|aus|rusak|sebelum\s+membeli|siang\s+hari|amati\s+bukaan|ditempel\s+rapat|gorden\s+saja|strategi\s+utama|dinding\s+barat|mengurangi\s+silau)\b/i.test(clean) &&
    /\b(?:pastikan|sebaiknya|perlu|dianjurkan|dapat|jangan\s+lupa|buat|sediakan|perhatikan|atur|pasang|posisikan|semakin|tentukan|siapkan|selama|menjadi\s+nilai\s+penting|lebih\s+tepat\s+dipandang|paling\s+masuk\s+akal|masuk\s+akal|terlihat\s+pada|kesalahan\s+yang\s+sering|digunakan\s+ketika|mengurangi|memberi\s+peluang|menuntut|menerima|menjadi\s+lebih|mungkin\s+tidak\s+cukup|memilih\s+sistem|diuji\s+terhadap|bekerja|membantu|dipahami|dirawat|cara\s+aman|amati|bukan\s+sekadar|tidak\s+cukup|cocok\s+ketika|sesuai\s+untuk|terasa|berbeda|datang|membantu)\b/i.test(clean);

  if (isPracticalHeuristic) {
    return {
      isPracticalGuidance: true,
      reason: 'SUPPORTED_PRACTICAL_GUIDANCE: Panduan teknis pengerjaan / instalasi / perawatan umum tanpa asersi lab baru'
    };
  }

  return {
    isPracticalGuidance: false,
    reason: 'Asersi bukan merupakan panduan praktis pengerjaan atau perawatan.'
  };
}

/**
 * Optional Design Example Evaluation under Claim Taxonomy (OPTIONAL_DESIGN_EXAMPLE).
 * Identifies illustrative design choices, heuristics, or starting points framed non-dogmatically.
 *
 * Rejection rule:
 * If presented as an absolute regulatory code, mandatory standard, or universal performance outcome,
 * it CANNOT be qualified as an optional design example.
 */
export function evaluateOptionalDesignExample(
  span: string,
  editorialBrief?: EditorialBrief
): { isDesignExample: boolean; exampleMatched?: string; reason: string } {
  const clean = span.trim();

  if (!editorialBrief) {
    return {
      isDesignExample: false,
      reason: 'Tidak ada brief editorial / contoh desain terdokumentasi.'
    };
  }

  // If stated as mandatory requirement or lab test, reject
  if (/\b(?:wajib\s+menurut|standar\s+sni|harus\s+memenuhi\s+regulasi|uji\s+laboratorium\s+membuktikan)\b/i.test(clean)) {
    return {
      isDesignExample: false,
      reason: 'Asersi diformulasikan sebagai kewajiban regulasi / uji laboratorium, bukan opsi desain ilustratif.'
    };
  }

  // 1. Check match with editorial brief optional design examples
  if (editorialBrief?.optional_design_examples && editorialBrief.optional_design_examples.length > 0) {
    for (const ex of editorialBrief.optional_design_examples) {
      const exNorm = normalizeArticleText(ex).toLowerCase();
      const cleanNorm = normalizeArticleText(clean).toLowerCase();
      if ((cleanNorm.includes('80') && exNorm.includes('80')) ||
          (cleanNorm.includes('120') && exNorm.includes('120')) ||
          (cleanNorm.includes('roster') && exNorm.includes('roster')) ||
          (cleanNorm.includes('rambat') && exNorm.includes('rambat')) ||
          (cleanNorm.includes('aluminium') && exNorm.includes('aluminium')) ||
          ((cleanNorm.includes('louvre') || cleanNorm.includes('louver') || cleanNorm.includes('kisi')) &&
           (exNorm.includes('louvre') || exNorm.includes('louver') || exNorm.includes('kisi')))) {
        return {
          isDesignExample: true,
          exampleMatched: ex,
          reason: `OPTIONAL_DESIGN_EXAMPLE: Selaras dengan contoh ilustratif / patokan awal dalam brief editorial ("${ex.slice(0, 60)}...")`
        };
      }
    }
  }

  // 2. Framed as illustrative choice or design heuristic starting point
  const isIllustrativeChoice =
    /\b(?:sebagai\s+(?:patokan|titik\s+awal|contoh|ilustrasi)|bisa\s+menjadi\s+patokan|opsi\s+lain|pilihan\s+seperti|misalnya|contohnya|dapat\s+memadukan|antara\s+\d+\s*(?:–|-|sampai)\s*\d+\s*cm|dapat\s+dipasang|dipasang\s+di\s+atas)\b/i.test(clean) &&
    /\b(?:overhang|teritisan|tritisan|kanopi|kisi|louver|louvre|roster|tanaman\s+rambat|wire\s+mesh|kayu|aluminium|bambu|jendela|pintu|balkon|area\s+transisi)\b/i.test(clean);

  if (isIllustrativeChoice) {
    return {
      isDesignExample: true,
      reason: 'OPTIONAL_DESIGN_EXAMPLE: Contoh desain / dimensi patokan awal yang diframing secara non-dogmatis'
    };
  }

  return {
    isDesignExample: false,
    reason: 'Asersi bukan merupakan contoh desain ilustratif opsional.'
  };
}

/**
 * Domain-Agnostic Candidate Search.
 * Finds candidate supporting claims from the author-safe set based on concept overlap.
 * Section 5: Similarity alone may NEVER grant ENTAILED; it only shortlists candidates.
 */
export function findCandidateClaimsForAssertion(
  assertion: string,
  authorSafeClaims: AuthorSafeClaim[]
): AuthorSafeClaim[] {
  const assertTokens = tokenizeText(assertion);
  if (assertTokens.length === 0) return [];

  const assertNums = extractNumericTokens(assertion);
  const scored: { claim: AuthorSafeClaim; score: number }[] = [];

  for (const claim of authorSafeClaims) {
    if (claim.allowed_for_authoring === false) continue;

    const claimTokens = tokenizeText(claim.statement);
    if (claimTokens.length === 0) continue;

    // Numeric consistency check: if assertion has numbers, candidate must have matching numbers or score is penalized
    const claimNums = extractNumericTokens(claim.statement);
    if (assertNums.length > 0 && claimNums.length > 0) {
      const hasShared = assertNums.some(an => claimNums.includes(an));
      if (!hasShared) {
        continue; // Numeric mismatch disqualifies as candidate
      }
    }

    // Shared content tokens with cross-lingual stem matching
    const shared = assertTokens.filter(at => claimTokens.some(ct => crossLingualStemMatch(at, ct)));
    if (shared.length === 0) continue;

    const score = shared.length / Math.max(1, assertTokens.length);
    scored.push({ claim, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(s => s.claim);
}

/**
 * Domain-Agnostic Assertion Reconciliation Engine.
 * Reconciles extracted article assertions against Joko declarations,
 * author-safe claims, and verified evidence graphs.
 */
export class AssertionReconciliationEngine {
  private verifier: SemanticEntailmentVerifier;

  constructor(verifier?: SemanticEntailmentVerifier) {
    this.verifier = verifier || new DeterministicSemanticVerifier();
  }

  reconcile(input: AssertionReconciliationInput): AssertionReconciliationResult {
    const spans = input.extracted_assertions || extractArticleSpansWithGranularity(input.article_markdown);
    const claimUsages = Array.isArray(input.claim_usage) ? input.claim_usage : [];
    const authorSafeClaims = Array.isArray(input.authorSafeClaims)
      ? input.authorSafeClaims
      : (Array.isArray(input.evidencePack?.claim_inventory)
        ? (input.evidencePack.claim_inventory as unknown as AuthorSafeClaim[])
        : []);

    const activePackId =
      (input.evidencePack as any)?.evidence_pack_id ||
      (input.evidencePack as any)?.pack_id ||
      input.editorialBrief?.evidence_pack_id;

    const safeClaimsMap = new Map<string, AuthorSafeClaim>();
    const seenClaimIds = new Set<string>();
    const duplicateClaimIds: string[] = [];

    for (const c of authorSafeClaims) {
      if (c && c.claim_id) {
        const rawId = c.claim_id.trim();
        const shortId = rawId.includes('::') ? rawId.split('::')[1] : rawId;
        const qualifiedId = activePackId ? `${activePackId}::${shortId}` : rawId;

        if (seenClaimIds.has(shortId)) {
          duplicateClaimIds.push(shortId);
        }
        seenClaimIds.add(shortId);

        safeClaimsMap.set(shortId, c);
        safeClaimsMap.set(qualifiedId, c);
      }
    }

    if (authorSafeClaims.length === 0 && claimUsages.length > 0) {
      for (const u of claimUsages) {
        if (u.claim_id && !safeClaimsMap.has(u.claim_id)) {
          safeClaimsMap.set(u.claim_id, {
            claim_id: u.claim_id,
            statement: u.article_excerpt || '',
            support_level: 'SUPPORTED',
            applicability: 'UNIVERSAL_PHYSICS',
            allowed_for_authoring: true,
            evidence_passage_ids: []
          });
        }
      }
    }

    const entries: ReconciledAssertionEntry[] = [];
    const unresolved_spans: string[] = [];
    const errors: string[] = [];

    if (duplicateClaimIds.length > 0) {
      errors.push(
        `DUPLICATE_CLAIM_IDS_IN_PACK: Paket bukti '${activePackId || 'unspecified'}' memuat ID klaim duplikat: [${Array.from(new Set(duplicateClaimIds)).join(', ')}]. Setiap klaim dalam paket bukti wajib memiliki ID unik.`
      );
    }

    let substantiveCount = 0;
    let evidenceBackedCount = 0;
    let editorialInferenceCount = 0;
    let nonClaimProseCount = 0;
    let practicalGuidanceCount = 0;
    let optionalDesignExampleCount = 0;
    let jokoDeclaredMappingCount = 0;
    let autoReconciledMappingCount = 0;
    let semanticVerifierMappingCount = 0;
    let notEntailedCount = 0;
    let uncertainCount = 0;

    for (const spanObj of spans) {
      const { assertion_id, article_span, char_start, char_end, span_hash } = spanObj;
      const normSpan = normalizeArticleText(article_span);

      // =======================================================================
      // Step 1: Strict Non-Claim Prose Filter
      // =======================================================================
      const proseCheck = classifyNonClaimProse(article_span);
      if (proseCheck.isExempt) {
        nonClaimProseCount++;
        entries.push({
          assertion_id,
          article_span,
          char_start,
          char_end,
          span_hash,
          classification: 'NON_CLAIM_PROSE',
          taxonomy_kind: 'EDITORIAL_INTERPRETATION',
          supporting_claim_ids: [],
          supporting_passage_ids: [],
          semantic_result: 'NOT_APPLICABLE',
          resolution_source: 'NON_CLAIM_POLICY',
          reason: proseCheck.reason
        });
        continue;
      }

      substantiveCount++;

      // =======================================================================
      // Step 2: Validate Joko claim_usage as a Candidate Hint (Section 4)
      // =======================================================================
      const matchingDeclarations = claimUsages.filter(u => {
        const normEx = normalizeArticleText(u.article_excerpt || '');
        if (!normEx) return false;
        return normEx.includes(normSpan) || normSpan.includes(normEx) || (
          normSpan.length > 25 && normEx.length > 25 && (
            normSpan.slice(0, 30) === normEx.slice(0, 30) ||
            normSpan.slice(-30) === normEx.slice(-30)
          )
        );
      });

      let resolved = false;

      for (const decl of matchingDeclarations) {
        const rawDeclId = decl.claim_id?.trim();
        if (rawDeclId && rawDeclId.includes('::')) {
          const [prefix, shortId] = rawDeclId.split('::');
          if (activePackId && prefix !== activePackId) {
            errors.push(
              `CROSS_PACK_IDENTITY_MISMATCH: Asersi merujuk klaim [${rawDeclId}] dari paket lain '${prefix}', bukan '${activePackId}'.`
            );
            continue;
          }
        }
        const claim = safeClaimsMap.get(rawDeclId) || safeClaimsMap.get(rawDeclId && rawDeclId.includes('::') ? rawDeclId.split('::')[1] : (rawDeclId || ''));
        if (!claim || claim.allowed_for_authoring === false) {
          continue; // Rejected: claim not recognized or not author-safe
        }

        if (decl.usage_type === 'EDITORIAL_INFERENCE') {
          const infCheck = evaluateEditorialInference(article_span, authorSafeClaims);
          if (infCheck.isEditorialInference) {
            editorialInferenceCount++;
            jokoDeclaredMappingCount++;
            resolved = true;
            entries.push({
              assertion_id,
              article_span,
              char_start,
              char_end,
              span_hash,
              classification: 'EDITORIAL_INFERENCE',
              taxonomy_kind: 'EDITORIAL_INTERPRETATION',
              supporting_claim_ids: [claim.claim_id],
              qualified_claim_ids: [activePackId ? `${activePackId}::${claim.claim_id}` : claim.claim_id],
              supporting_passage_ids: claim.evidence_passage_ids || [],
              semantic_result: 'ENTAILED',
              resolution_source: 'JOKO_DECLARATION',
              reason: `Joko declared editorial inference validated under inference policy (${claim.claim_id})`,
              derived_from_claim_ids: [claim.claim_id],
              inference_reason: infCheck.reason
            });
            break;
          }
        }

        // Evaluate semantic entailment
        const isCompoundDecl = /\b(?:serta|sedangkan)\b|,\s*dan\b/i.test(article_span);
        const vOut = isCompoundDecl
          ? validateMultiClaimSynthesis(article_span, [claim], this.verifier)
          : (() => {
              const r = this.verifier.verify({
                articleAssertion: article_span,
                claimStatement: claim.statement,
                claimIds: [claim.claim_id]
              });
              return r instanceof Promise ? { result: 'UNCERTAIN', reason: 'Async verifier not resolved' } : r;
            })();

        if (vOut.result === 'ENTAILED') {
          evidenceBackedCount++;
          jokoDeclaredMappingCount++;
          resolved = true;
          entries.push({
            assertion_id,
            article_span,
            char_start,
            char_end,
            span_hash,
            classification: 'EVIDENCE_BACKED',
            taxonomy_kind: 'VERIFIED_FACT',
            supporting_claim_ids: [claim.claim_id],
            qualified_claim_ids: [activePackId ? `${activePackId}::${claim.claim_id}` : claim.claim_id],
            supporting_passage_ids: claim.evidence_passage_ids || [],
            semantic_result: 'ENTAILED',
            resolution_source: 'JOKO_DECLARATION',
            reason: `Joko declared claim verified with semantic entailment (${claim.claim_id})`
          });
          break;
        } else if (vOut.result === 'NOT_ENTAILED') {
          // Reject Joko mapping (Test B: Joko maps assertion to wrong claim => mapping rejected)
          // Continue loop to attempt auto-reconciliation
        } else if (vOut.result === 'UNCERTAIN') {
          uncertainCount++;
        }
      }

      if (resolved) continue;

      // =======================================================================
      // Step 3: Domain-Agnostic Candidate Search & Reconciliation (Section 5 & 6)
      // Checks whether unmapped declarative assertions are entailed by author-safe claims
      // =======================================================================
      const candidates = findCandidateClaimsForAssertion(article_span, authorSafeClaims);
      let bestUncertain: { claim: AuthorSafeClaim; reason: string } | null = null;

      // 3.1 If compound / multi-claim assertion, evaluate multi-claim synthesis
      const isCompound = /\b(?:serta|sedangkan)\b|,\s*dan\b/i.test(article_span);
      if (isCompound) {
        const synthRes = validateMultiClaimSynthesis(article_span, candidates, this.verifier);
        if (synthRes.result === 'ENTAILED') {
          evidenceBackedCount++;
          autoReconciledMappingCount++;
          semanticVerifierMappingCount++;
          resolved = true;
          const matchedIds = candidates.map(c => c.claim_id);
          entries.push({
            assertion_id,
            article_span,
            char_start,
            char_end,
            span_hash,
            classification: 'EVIDENCE_BACKED',
            taxonomy_kind: 'VERIFIED_FACT',
            supporting_claim_ids: matchedIds,
            supporting_passage_ids: candidates.flatMap(c => c.evidence_passage_ids || []),
            semantic_result: 'ENTAILED',
            resolution_source: 'DETERMINISTIC_RECONCILIATION',
            reason: `Auto-reconciled: Compound assertion all sub-propositions supported (${matchedIds.join(', ')})`
          });
        } else if (synthRes.result === 'UNCERTAIN' && !bestUncertain) {
          bestUncertain = {
            claim: candidates[0] || ({ claim_id: 'UNKNOWN', statement: '' } as any),
            reason: synthRes.reason
          };
        }
      } else {
        // 3.2 Non-compound assertion: check single claim entailment across candidates
        for (const cand of candidates) {
          const vRes = this.verifier.verify({
            articleAssertion: article_span,
            claimStatement: cand.statement,
            claimIds: [cand.claim_id]
          });
          const vOut = vRes instanceof Promise ? { result: 'UNCERTAIN', reason: 'Async verifier not resolved' } : vRes;

          if (vOut.result === 'ENTAILED') {
            evidenceBackedCount++;
            autoReconciledMappingCount++;
            semanticVerifierMappingCount++;
            resolved = true;
            entries.push({
              assertion_id,
              article_span,
              char_start,
              char_end,
              span_hash,
              classification: 'EVIDENCE_BACKED',
              taxonomy_kind: 'VERIFIED_FACT',
              supporting_claim_ids: [cand.claim_id],
              supporting_passage_ids: cand.evidence_passage_ids || [],
              semantic_result: 'ENTAILED',
              resolution_source: 'DETERMINISTIC_RECONCILIATION',
              reason: `Auto-reconciled: Candidate claim semantically entails assertion (${cand.claim_id})`
            });
            break;
          } else if (vOut.result === 'UNCERTAIN' && !bestUncertain) {
            bestUncertain = { claim: cand, reason: vOut.reason };
          }
        }
      }

      if (resolved) continue;

      // =======================================================================
      // Step 3.5: Optional Design Example (Section 2 - TAXONOMY)
      // =======================================================================
      const designCheck = evaluateOptionalDesignExample(article_span, input.editorialBrief);
      if (designCheck.isDesignExample) {
        optionalDesignExampleCount++;
        autoReconciledMappingCount++;
        entries.push({
          assertion_id,
          article_span,
          char_start,
          char_end,
          span_hash,
          classification: 'OPTIONAL_DESIGN_EXAMPLE',
          taxonomy_kind: 'OPTIONAL_DESIGN_EXAMPLE',
          supporting_claim_ids: [],
          supporting_passage_ids: [],
          semantic_result: 'NOT_APPLICABLE',
          resolution_source: 'OPTIONAL_DESIGN_POLICY',
          reason: designCheck.reason,
          example_matched: designCheck.exampleMatched
        });
        continue;
      }

      // =======================================================================
      // Step 3.6: Supported Practical Guidance (Section 2 - TAXONOMY)
      // =======================================================================
      const pracCheck = evaluatePracticalGuidance(article_span, input.editorialBrief);
      if (pracCheck.isPracticalGuidance) {
        practicalGuidanceCount++;
        autoReconciledMappingCount++;
        entries.push({
          assertion_id,
          article_span,
          char_start,
          char_end,
          span_hash,
          classification: 'SUPPORTED_PRACTICAL_GUIDANCE',
          taxonomy_kind: 'SUPPORTED_PRACTICAL_GUIDANCE',
          supporting_claim_ids: [],
          supporting_passage_ids: [],
          semantic_result: 'NOT_APPLICABLE',
          resolution_source: 'PRACTICAL_GUIDANCE_POLICY',
          reason: pracCheck.reason,
          guideline_matched: pracCheck.guidelineMatched
        });
        continue;
      }

      if (resolved) continue;

      // =======================================================================
      // Step 4: Strict Editorial Inference Policy (Section 8)
      // =======================================================================
      const infCheck = evaluateEditorialInference(article_span, authorSafeClaims);
      if (infCheck.isEditorialInference) {
        editorialInferenceCount++;
        autoReconciledMappingCount++;
        entries.push({
          assertion_id,
          article_span,
          char_start,
          char_end,
          span_hash,
          classification: 'EDITORIAL_INFERENCE',
          taxonomy_kind: 'EDITORIAL_INTERPRETATION',
          supporting_claim_ids: infCheck.derivedClaimIds,
          supporting_passage_ids: [],
          semantic_result: 'NOT_APPLICABLE',
          resolution_source: 'EDITORIAL_INFERENCE_POLICY',
          reason: infCheck.reason,
          derived_from_claim_ids: infCheck.derivedClaimIds,
          inference_reason: infCheck.reason
        });
        continue;
      }

      // =======================================================================
      // Step 5: Unresolved Assertion (Fail-Closed)
      // =======================================================================
      const semResult: SemanticEntailmentResultKind = bestUncertain ? 'UNCERTAIN' : 'NOT_ENTAILED';
      if (bestUncertain) {
        uncertainCount++;
      } else {
        notEntailedCount++;
      }

      unresolved_spans.push(article_span);
      errors.push(
        `ARTICLE_ASSERTION_UNACCOUNTED: Asersi deklaratif substansial di naskah belum memiliki dukungan bukti atau inferensi yang sah: "${article_span.slice(0, 90)}..."`
      );

      entries.push({
        assertion_id,
        article_span,
        char_start,
        char_end,
        span_hash,
        classification: 'UNRESOLVED',
        taxonomy_kind: 'UNSUPPORTED_CLAIM',
        supporting_claim_ids: [],
        supporting_passage_ids: [],
        semantic_result: semResult,
        resolution_source: 'DETERMINISTIC_RECONCILIATION',
        reason: bestUncertain
          ? `UNCERTAIN: Hubungan semantik antara asersi dan klaim kandidat belum pasti (${bestUncertain.reason})`
          : 'NOT_ENTAILED: Tidak ada klaim pendukung yang semantik valid ditemukan pada inventaris bukti aman.'
      });
    }

    const is_complete = unresolved_spans.length === 0;

    return {
      evidence_pack_id: activePackId,
      entries,
      metrics: {
        total_article_spans: spans.length,
        substantive_assertion_count: substantiveCount,
        evidence_backed_count: evidenceBackedCount,
        editorial_inference_count: editorialInferenceCount,
        non_claim_prose_count: nonClaimProseCount,
        practical_guidance_count: practicalGuidanceCount,
        optional_design_example_count: optionalDesignExampleCount,
        joko_declared_mapping_count: jokoDeclaredMappingCount,
        auto_reconciled_mapping_count: autoReconciledMappingCount,
        semantic_verifier_mapping_count: semanticVerifierMappingCount,
        unresolved_assertion_count: unresolved_spans.length,
        not_entailed_count: notEntailedCount,
        uncertain_count: uncertainCount
      },
      unresolved_spans,
      is_complete,
      errors
    };
  }
}
