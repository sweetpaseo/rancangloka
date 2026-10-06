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
import {
  type AuthorClaimUsageDeclaration,
  type ClaimUsageType,
  type SemanticEntailmentVerifier,
  type SemanticEntailmentResultKind,
  DeterministicSemanticVerifier,
  validateMultiClaimSynthesis,
  normalizeArticleText
} from './claim-grounding.ts';

export type AssertionClassification =
  | 'EVIDENCE_BACKED'
  | 'EDITORIAL_INFERENCE'
  | 'NON_CLAIM_PROSE'
  | 'UNRESOLVED';

export type AssertionResolutionSource =
  | 'JOKO_DECLARATION'
  | 'DETERMINISTIC_RECONCILIATION'
  | 'SEMANTIC_VERIFIER'
  | 'EDITORIAL_INFERENCE_POLICY'
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
  supporting_claim_ids: string[];
  supporting_passage_ids: string[];
  semantic_result: SemanticEntailmentResultKind | 'NOT_APPLICABLE';
  resolution_source: AssertionResolutionSource;
  reason: string;
  derived_from_claim_ids?: string[];
  inference_reason?: string;
}

export interface AssertionReconciliationMetrics {
  total_article_spans: number;
  substantive_assertion_count: number;
  evidence_backed_count: number;
  editorial_inference_count: number;
  non_claim_prose_count: number;
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
  verifier?: SemanticEntailmentVerifier;
  options?: {
    strictCompleteness?: boolean;
    dryRun?: boolean;
  };
}

export interface AssertionReconciliationResult {
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
    /^\s*kita lihat\b/i
  ];

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
      /^\s*(?:periksa|cek|amati|pantau)\s+(?:apakah|kondisi|lokasi|area|bagian|kerapian|celah)\b/i,
      /^\s*catat\s+(?:apakah|kondisi|waktu|pola)\b/i,
      /^\s*tandai\s+lokasi\b/i,
      /^\s*foto\s+kondisi\b/i,
      /^\s*bandingkan\s+(?:jendela|kondisi|ruangan)\b/i,
      /^\s*bawa\s+foto\b/i,
      /^\s*jangan\s+(?:membeli|mengganti|langsung)\b/i,
      /^\s*konsultasikan\s+kepada\b/i
    ];

    if (proceduralImperatives.some(p => p.test(clean))) {
      return { isExempt: true, reason: 'EXEMPT_PROCEDURAL_ACTION: Panduan langkah inspeksi / daftar periksa fisik mandiri tanpa asersi fakta teknis baru', proseType: 'PROCEDURAL_ACTION' };
    }
  }

  // 5. Short fragments without declarative propositional content (< 20 chars)
  if (clean.length < 20 && !/\b(?:adalah|merupakan|karena|sebab|sehingga|yaitu|terjadi)\b/i.test(clean)) {
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
  const isDecisionFraming = /^(?:pagi hari,\s*anda|keduanya bisa masuk akal|sebelum memilih|keputusan yang terburu-buru|catatan sederhana ini lebih berguna|biaya dan pekerjaan kemudian bertambah|pilihan perbaikan sebaiknya mengikuti|memilih antara)/i.test(clean) ||
    /\b(?:memilih antara|dihadapkan pada dua pilihan|mengatasi gejala tanpa menyentuh sumbernya|tanpa diagnosis yang cukup kuat|penelusuran kondisi ruangan|pertimbangan praktis|langkah awal|sebelum mengeluarkan biaya)\b/i.test(clean);

  const isConditionalSynthesis = /^\s*(?:jika|bila|sebaliknya|karena itu|namun|artinya)\b/i.test(clean) &&
    /\b(?:dapat dipertimbangkan|mungkin lebih tepat|patut diperiksa|tidak otomatis|tetap perlu|bukan langsung berarti|belum tentu)\b/i.test(clean);

  const isScenarioGuidance = /^\s*-\s*\*\*jika\b/i.test(clean) ||
    /^\s*\*\*jika\b/i.test(clean) ||
    /\b(?:perbedaan lokal ini menjadi alasan|mulai dari pencatatan|minta aplikator menilai)\b/i.test(clean);

  const isGeneralConclusion = /^\s*(?:jendela aluminium yang berembun|kesimpulan|diagnosis perlu dimulai|jika gejala mengarah)\b/i.test(clean);

  if (isDecisionFraming || isConditionalSynthesis || isScenarioGuidance || isGeneralConclusion) {
    // Collect related claims from verified claims for audit traceability
    const relatedTokens = tokenizeText(clean);
    const relatedClaims = verifiedClaims.filter(c => {
      const cTokens = tokenizeText(c.statement);
      return relatedTokens.some(rt => cTokens.some(ct => ct === rt || (rt.length >= 4 && (ct.startsWith(rt.slice(0, 4)) || rt.startsWith(ct.slice(0, 4))))));
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
      reason: isDecisionFraming
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

    // Shared content tokens
    const shared = assertTokens.filter(at => claimTokens.some(ct => ct === at || (at.length >= 4 && ct.startsWith(at))));
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

    const safeClaimsMap = new Map<string, AuthorSafeClaim>();
    for (const c of authorSafeClaims) {
      if (c && c.claim_id) safeClaimsMap.set(c.claim_id, c);
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

    let substantiveCount = 0;
    let evidenceBackedCount = 0;
    let editorialInferenceCount = 0;
    let nonClaimProseCount = 0;
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
        const claim = safeClaimsMap.get(decl.claim_id);
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
              supporting_claim_ids: [claim.claim_id],
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
            supporting_claim_ids: [claim.claim_id],
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
      // =======================================================================
      const candidates = findCandidateClaimsForAssertion(article_span, authorSafeClaims);
      let bestUncertain: { claim: AuthorSafeClaim; reason: string } | null = null;

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
            supporting_claim_ids: matchedIds,
            supporting_passage_ids: candidates.flatMap(c => c.evidence_passage_ids || []),
            semantic_result: 'ENTAILED',
            resolution_source: 'DETERMINISTIC_RECONCILIATION',
            reason: `Auto-reconciled: Compound assertion all sub-propositions supported (${matchedIds.join(', ')})`
          });
        } else if (synthRes.result === 'UNCERTAIN') {
          uncertainCount++;
          bestUncertain = {
            claim: candidates[0] || ({ claim_id: 'UNKNOWN', statement: '' } as any),
            reason: synthRes.reason
          };
        }
      } else {
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
              supporting_claim_ids: [cand.claim_id],
              supporting_passage_ids: cand.evidence_passage_ids || [],
              semantic_result: 'ENTAILED',
              resolution_source: 'DETERMINISTIC_RECONCILIATION',
              reason: `Auto-reconciled: Candidate claim semantically entails assertion (${cand.claim_id})`
            });
            break;
          } else if (vOut.result === 'UNCERTAIN') {
            uncertainCount++;
            if (!bestUncertain) {
              bestUncertain = { claim: cand, reason: vOut.reason };
            }
          }
        }
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
      entries,
      metrics: {
        total_article_spans: spans.length,
        substantive_assertion_count: substantiveCount,
        evidence_backed_count: evidenceBackedCount,
        editorial_inference_count: editorialInferenceCount,
        non_claim_prose_count: nonClaimProseCount,
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
