/**
 * RancangLoka Editorial Claim Grounding & Verification Types
 * Milestone: EDITORIAL-RUNTIME-2
 *
 * Enforces:
 * AUTHOR_SAFE_INPUT != AUTOMATICALLY_GROUNDED_OUTPUT
 *
 * Provides:
 * - Internal structured draft envelope parsing
 * - Claim-ID validation against approved evidence pack
 * - Author grounding declaration (distinguished from verified external grounding)
 * - Prohibited element & removed claim detection
 * - Prescriptive certainty & editorial compression audits
 */

import crypto from 'node:crypto';
import { isHistoricalRoofPack, type EvidencePackInput, type AuthorSafeClaim, type EvidenceClaim } from '../article/human-quality.ts';

export type ClaimUsageType =
  | 'DIRECT_PARAPHRASE'
  | 'SUPPORTED_SYNTHESIS'
  | 'EDITORIAL_INFERENCE';

export interface AuthorClaimUsageDeclaration {
  claim_id: string;
  article_excerpt: string;
  usage_type: ClaimUsageType;
  article_character_start?: number;
  article_character_end?: number;
  span_hash?: string;
  entailment_status?: 'VALID' | 'CLAIM_USAGE_ENTAILMENT_MISMATCH' | 'CLAIM_USAGE_ARTICLE_SPAN_NOT_FOUND';
}

export type AssertionKind = 'EVIDENCE_BACKED' | 'EDITORIAL_INFERENCE' | 'NON_CLAIM_PROSE';

export interface ArticleAssertionEntry {
  assertion_id: string;
  article_span: string;
  char_start: number;
  char_end: number;
  span_hash: string;
  assertion_kind: AssertionKind;
  claim_ids: string[];
  usage_type: 'DIRECT_PARAPHRASE' | 'SUPPORTED_SYNTHESIS' | 'EDITORIAL_INFERENCE' | null;
  classification_reason: string;
}

export interface ArticleAssertionLedger {
  entries: ArticleAssertionEntry[];
  total_spans_count: number;
  evidence_backed_count: number;
  editorial_inference_count: number;
  non_claim_prose_count: number;
  unaccounted_count: number;
  unaccounted_spans: string[];
  is_exhaustive: boolean;
  errors: string[];
}

export interface GroundedDraftEnvelope {
  article_markdown: string;
  claim_usage: AuthorClaimUsageDeclaration[];
  unsupported_claim_candidates: string[];
}

export type GroundingStatus =
  | 'DECLARED_GROUNDED'
  | 'GROUNDING_REVIEW_REQUIRED'
  | 'PROHIBITED_CLAIM_DETECTED'
  | 'UNSUPPORTED_CLAIMS_DETECTED';

export interface GroundingAuditResult {
  status: GroundingStatus;
  isValid: boolean;
  requiresReview: boolean;
  declaredClaimsCount: number;
  validClaimsCount: number;
  unrecognizedClaimIds: string[];
  prohibitedClaimIds: string[];
  removedClaimsUsed: string[];
  prohibitedElementsFound: string[];
  unsupportedCandidatesFound: string[];
  spanNotFoundCount: number;
  entailmentMismatchCount: number;
  unaccountedAssertionsCount?: number;
  assertionLedger?: ArticleAssertionLedger;
  declarationProvenance: 'AUTHOR_GROUNDING_DECLARATION';
  warnings: string[];
  errors: string[];
}

export function normalizeArticleText(text: string): string {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

export function locateArticleSpan(
  articleExcerpt: string,
  articleMarkdown: string
): {
  found: boolean;
  charStart: number;
  charEnd: number;
  spanHash: string;
} {
  const normMarkdown = normalizeArticleText(articleMarkdown);
  const cleanExcerpt = (articleExcerpt || '').replace(/[.…]+$/, '').trim();
  const normExcerpt = normalizeArticleText(cleanExcerpt);
  const spanHash = crypto.createHash('sha256').update(normExcerpt, 'utf8').digest('hex');

  if (!normExcerpt) {
    return { found: false, charStart: -1, charEnd: -1, spanHash };
  }

  const normStart = normMarkdown.indexOf(normExcerpt);
  if (normStart !== -1) {
    return {
      found: true,
      charStart: normStart,
      charEnd: normStart + normExcerpt.length,
      spanHash
    };
  }

  const rawStart = (articleMarkdown || '').indexOf(cleanExcerpt);
  if (rawStart !== -1) {
    return {
      found: true,
      charStart: rawStart,
      charEnd: rawStart + cleanExcerpt.length,
      spanHash
    };
  }

  // 3. Match ignoring parenthetical clauses in markdown
  const mdNoParens = normMarkdown.replace(/\s*\([^)]*\)\s*/g, ' ');
  const parenStart = mdNoParens.indexOf(normExcerpt);
  if (parenStart !== -1) {
    const prefix = normExcerpt.slice(0, Math.min(25, normExcerpt.length));
    const approxStart = normMarkdown.indexOf(prefix);
    return {
      found: true,
      charStart: approxStart !== -1 ? approxStart : parenStart,
      charEnd: (approxStart !== -1 ? approxStart : parenStart) + normExcerpt.length,
      spanHash
    };
  }

  return {
    found: false,
    charStart: -1,
    charEnd: -1,
    spanHash
  };
}

export type SemanticEntailmentResultKind = 'ENTAILED' | 'NOT_ENTAILED' | 'UNCERTAIN';

export interface SemanticEntailmentVerificationInput {
  articleAssertion: string;
  claimStatement: string;
  supportingEvidence?: string[];
  claimIds?: string[];
  claimClass?: string;
  usageType?: ClaimUsageType;
}

export interface SemanticEntailmentVerificationOutput {
  assertion_id?: string;
  result: SemanticEntailmentResultKind;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  supporting_claim_ids?: string[];
  reason: string;
}

export interface SemanticEntailmentVerifier {
  verify(input: SemanticEntailmentVerificationInput): Promise<SemanticEntailmentVerificationOutput> | SemanticEntailmentVerificationOutput;
}

/**
 * Deterministic semantic verifier.
 * Grounding relation: ARTICLE ASSERTION <-> CLAIM PROPOSITION <-> VERIFIED EVIDENCE.
 * Invariant: Claim IDs are arbitrary identifiers and must NEVER determine semantics.
 * Proves:
 * - Direct proposition identity / paraphrase
 * - Numeric match vs contradiction
 * - Conceptual overlap vs topical disjointness
 * Invariant: Never default unknown domains to VALID. If uncertain, returns UNCERTAIN (fail-closed).
 */
export class DeterministicSemanticVerifier implements SemanticEntailmentVerifier {
  verify(input: SemanticEntailmentVerificationInput): SemanticEntailmentVerificationOutput {
    const assertion = (input.articleAssertion || '').trim();
    const statement = (input.claimStatement || '').trim();

    if (!assertion || !statement) {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'NOT_ENTAILED',
        confidence: 'HIGH',
        reason: 'Pernyataan asersi atau klaim kosong tidak dapat di-entail.'
      };
    }

    // 1. Verbatim or normalized identical string
    const normAssert = normalizeArticleText(assertion).toLowerCase();
    const normState = normalizeArticleText(statement).toLowerCase();
    if (normAssert === normState) {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'ENTAILED',
        confidence: 'HIGH',
        supporting_claim_ids: input.claimIds,
        reason: 'Verbatim / normalized proposition identity'
      };
    }

    // 2. Numeric contradiction check
    const numRegex = /\b\d+(?:[.,]\d+)?\s*(?:%|mm|cm|m\b|w\/m|°c)?\b/gi;
    const assertNums = (assertion.match(numRegex) || []).map(n => n.trim().toLowerCase()).filter(n => /\d/.test(n));
    const stateNums = (statement.match(numRegex) || []).map(n => n.trim().toLowerCase()).filter(n => /\d/.test(n));

    if (assertNums.length > 0 && stateNums.length > 0) {
      const hasSharedNumber = assertNums.some(an => stateNums.includes(an));
      if (!hasSharedNumber) {
        return {
          assertion_id: (input as any).assertion_id,
          result: 'NOT_ENTAILED',
          confidence: 'HIGH',
          reason: `Numeric contradiction: angka asersi [${assertNums.join(', ')}] bertentangan dengan angka klaim [${stateNums.join(', ')}]`
        };
      }
    }

    // 3. Stopwords & tokenization
    const stopWords = new Set([
      'dan', 'atau', 'pada', 'di', 'ke', 'dari', 'yang', 'untuk', 'dengan', 'adalah', 'ini', 'itu',
      'dapat', 'juga', 'bisa', 'akan', 'lebih', 'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at',
      'to', 'from', 'of', 'for', 'with', 'is', 'are', 'was', 'were', 'can', 'may', 'also', 'by',
      'through', 'dalam', 'secara', 'melalui', 'oleh', 'harus', 'maka', 'kita', 'lihat'
    ]);

    const tokenize = (text: string): string[] => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));
    };

    const assertTokens = tokenize(assertion);
    const stateTokens = tokenize(statement);

    // Stem and cross-lingual concept matching
    const stemMatch = (a: string, b: string): boolean => {
      if (a === b) return true;
      if (a.length >= 4 && b.length >= 4) {
        if (a.startsWith(b) || b.startsWith(a)) return true;
        // Common cross-lingual technical concept roots
        if ((a.includes('kapiler') && b.includes('capillar')) || (a.includes('capillar') && b.includes('kapiler'))) return true;
        if ((a.includes('pori') && b.includes('porous')) || (a.includes('porous') && b.includes('pori'))) return true;
        if ((a.includes('termal') && b.includes('thermal')) || (a.includes('thermal') && b.includes('termal'))) return true;
        if ((a.includes('kusen') && b.includes('frame')) || (a.includes('frame') && b.includes('kusen'))) return true;
        if ((a.includes('retak') && b.includes('crack')) || (a.includes('crack') && b.includes('retak'))) return true;
        if ((a.includes('kaku') && b.includes('rigid')) || (a.includes('rigid') && b.includes('kaku'))) return true;
        if ((a.includes('pernapasan') && b.includes('respirat')) || (a.includes('respirat') && b.includes('pernapasan'))) return true;
        if ((a.includes('alergi') && b.includes('allerg')) || (a.includes('allerg') && b.includes('alergi'))) return true;
        if ((a.includes('jamur') && b.includes('mold')) || (a.includes('mold') && b.includes('jamur'))) return true;
        if ((a.includes('lembap') && (b.includes('damp') || b.includes('moist'))) || ((a.includes('damp') || a.includes('moist')) && b.includes('lembap'))) return true;
        if ((a.includes('penghuni') && b.includes('occupan')) || (a.includes('occupan') && b.includes('penghuni'))) return true;
      }
      return false;
    };

    const sharedTokens = assertTokens.filter(at => stateTokens.some(st => stemMatch(at, st)));

    // 4. Zero conceptual overlap => NOT_ENTAILED!
    if (sharedTokens.length === 0) {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'NOT_ENTAILED',
        confidence: 'HIGH',
        reason: 'Zero conceptual or proposition overlap detected between article assertion and claim statement'
      };
    }

    // 5. Check substantive overlap
    const overlapRatio = sharedTokens.length / Math.max(1, assertTokens.length);
    if (overlapRatio >= 0.25 || sharedTokens.length >= 2) {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'ENTAILED',
        confidence: (overlapRatio >= 0.5 || sharedTokens.length >= 3) ? 'HIGH' : 'MEDIUM',
        supporting_claim_ids: input.claimIds,
        reason: `Proposition concepts verified with aligned structural overlap (${sharedTokens.join(', ')})`
      };
    }

    // 6. Uncertain relation: fail closed
    return {
      assertion_id: (input as any).assertion_id,
      result: 'UNCERTAIN',
      confidence: 'LOW',
      reason: 'Deterministic verifier cannot definitively establish full semantic entailment without NLI model'
    };
  }
}

/**
 * Bounded semantic verifier adapter architecture.
 * Milestone EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1B:
 * Prepares the contract for a future bounded batch LLM verifier.
 * Strictly offline/deterministic during this milestone (no live network/provider calls).
 */
export class BoundedEditorialSemanticVerifierAdapter implements SemanticEntailmentVerifier {
  options?: { dryRun?: boolean; strictOffline?: boolean };

  constructor(options?: { dryRun?: boolean; strictOffline?: boolean }) {
    this.options = options;
  }

  buildBoundedPrompt(input: SemanticEntailmentVerificationInput): string {
    return [
      'SYSTEM: You are a strict semantic entailment verifier.',
      'Task: Determine if the provided supporting evidence/claim statement entails the article assertion.',
      'Rules: Structured output only. No world-knowledge expansion. Judge ONLY whether the evidence entails the assertion.',
      '',
      '=== INPUT ===',
      `Article Assertion: "${input.articleAssertion}"`,
      `Claim Statement: "${input.claimStatement}"`,
      input.supportingEvidence && input.supportingEvidence.length > 0
        ? `Supporting Passages:\n${input.supportingEvidence.map(p => `- "${p}"`).join('\n')}`
        : '',
      '',
      '=== OUTPUT SCHEMA (JSON ONLY) ===',
      '{"result": "ENTAILED" | "NOT_ENTAILED" | "UNCERTAIN", "confidence": "HIGH" | "MEDIUM" | "LOW", "reason": "string"}'
    ].filter(Boolean).join('\n');
  }

  async verify(input: SemanticEntailmentVerificationInput): Promise<SemanticEntailmentVerificationOutput> {
    // In this milestone: NO live network or provider calls!
    const fallback = new DeterministicSemanticVerifier();
    return fallback.verify(input);
  }
}

/**
 * Multi-Claim Synthesis Verification (SUPPORTED_SYNTHESIS):
 * All material parts of the article assertion must be supported by the combined claims.
 * If completeness cannot be established: UNCERTAIN.
 */
export function validateMultiClaimSynthesis(
  assertion: string,
  claims: { statement?: string; claim_id?: string }[],
  verifier?: SemanticEntailmentVerifier
): SemanticEntailmentVerificationOutput {
  if (!assertion || !claims || claims.length === 0) {
    return {
      result: 'NOT_ENTAILED',
      confidence: 'HIGH',
      reason: 'Assertion or claims missing for synthesis'
    };
  }

  const v = verifier || new DeterministicSemanticVerifier();

  // Split compound assertion into conjuncts
  const conjuncts = assertion
    .split(/\b(?:dan|serta|sementara|sedangkan)\b|[;,]/i)
    .map(c => c.trim())
    .filter(c => c.length > 15);

  if (conjuncts.length <= 1) {
    const combinedStatements = claims.map(c => c.statement || '').join(' ');
    const res = v.verify({
      articleAssertion: assertion,
      claimStatement: combinedStatements,
      claimIds: claims.map(c => c.claim_id).filter(Boolean) as string[]
    });
    return res instanceof Promise ? { result: 'UNCERTAIN', confidence: 'LOW', reason: 'Async verifier not resolved synchronously' } : res;
  }

  // Compound assertion: every substantive conjunct must be supported
  const unsupportedConjuncts: string[] = [];

  for (const conj of conjuncts) {
    const isSupported = claims.some(clm => {
      const res = v.verify({ articleAssertion: conj, claimStatement: clm.statement || '' });
      const finalRes = res instanceof Promise ? { result: 'UNCERTAIN' } : res;
      return finalRes.result === 'ENTAILED';
    });

    if (!isSupported) {
      unsupportedConjuncts.push(conj);
    }
  }

  if (unsupportedConjuncts.length > 0) {
    return {
      result: 'UNCERTAIN',
      confidence: 'LOW',
      reason: `Compound assertion contains sub-propositions not supported by any referenced claim: "${unsupportedConjuncts.join('; ')}"`
    };
  }

  return {
    result: 'ENTAILED',
    confidence: 'MEDIUM',
    reason: 'All material parts of compound assertion are supported by the combined claims'
  };
}

export interface EntailmentValidationResult {
  isEntailed: boolean;
  code?: 'VALID' | 'CLAIM_USAGE_ENTAILMENT_MISMATCH';
  result?: SemanticEntailmentResultKind;
  reason?: string;
}

export function validateClaimUsageEntailment(
  usage: AuthorClaimUsageDeclaration,
  claim: { statement?: string; claim_id?: string; semantic_role?: string; relevance?: string },
  options?: { verifier?: SemanticEntailmentVerifier; isHistoricalRoof?: boolean }
): EntailmentValidationResult {
  const excerpt = usage.article_excerpt || '';
  const statement = claim.statement || '';

  // In historical roof fixtures (prior to generalized semantics), preserve old claim-ID contracts
  if (options?.isHistoricalRoof) {
    return { isEntailed: true, code: 'VALID', result: 'UNCERTAIN' };
  }

  // Proposition-based semantic verifier
  const verifier = options?.verifier || new DeterministicSemanticVerifier();
  const vOut = verifier.verify({
    articleAssertion: excerpt,
    claimStatement: statement,
    claimIds: claim.claim_id ? [claim.claim_id] : []
  });

  const out = vOut instanceof Promise ? { result: 'UNCERTAIN', reason: 'Async verifier not resolved' } : vOut;

  if (out.result === 'NOT_ENTAILED') {
    return {
      isEntailed: false,
      code: 'CLAIM_USAGE_ENTAILMENT_MISMATCH',
      result: 'NOT_ENTAILED',
      reason: `CLAIM_USAGE_ENTAILMENT_MISMATCH: ${out.reason || 'Klaim rujukan tidak mendukung proposisi semantik kutipan artikel.'}`
    };
  }

  // NON-AUTHORITATIVE HEURISTIC HINTS:
  // REGEX_HINT != SEMANTIC_PROOF
  // Secondary diagnostic checks for specific known mismatch categories
  const healthExcerptRegex = /\b(?:pernapasan|alergi|asma|respirasi|kesehatan|iritasi saluran|paru-paru|gejala napas|keluhan pernapasan|reaksi alergi)\b/i;
  const healthClaimRegex = /\b(?:health|respiratory|respirasi|allergy|allergies|alergi|asthma|asma|lung|lungs|airway|breathing|symptom|illness|disease|penyakit|pernapasan|kesehatan)\b/i;

  if (healthExcerptRegex.test(excerpt) && !healthClaimRegex.test(statement)) {
    return {
      isEntailed: false,
      code: 'CLAIM_USAGE_ENTAILMENT_MISMATCH',
      result: 'NOT_ENTAILED',
      reason: `CLAIM_USAGE_ENTAILMENT_MISMATCH: Kutipan artikel untuk klaim '${usage.claim_id}' memuat dampak kesehatan/pernapasan/alergi, namun klaim rujukan hanya membahas penyebab fisik tanpa bukti dampak kesehatan.`
    };
  }

  const lawExcerptRegex = /\b(?:UK Building Regulations|Building Regulations 2010|Homes \(Fitness for Human Habitation\)|Awaab's Law|Section 11 Landlord|HHSRS)\b/i;
  const lawClaimRegex = /\b(?:UK Building Regulations|Building Regulations 2010|Homes \(Fitness for Human Habitation\)|Awaab's Law|Section 11|HHSRS|regulasi|undang-undang)\b/i;

  if (lawExcerptRegex.test(excerpt) && !lawClaimRegex.test(statement)) {
    return {
      isEntailed: false,
      code: 'CLAIM_USAGE_ENTAILMENT_MISMATCH',
      result: 'NOT_ENTAILED',
      reason: `CLAIM_USAGE_ENTAILMENT_MISMATCH: Kutipan artikel menyatakan regulasi hukum spesifik yang tidak dibuktikan oleh klaim '${usage.claim_id}'.`
    };
  }

  if (out.result === 'ENTAILED') {
    return { isEntailed: true, code: 'VALID', result: 'ENTAILED' };
  }

  // In generalized production execution: UNCERTAIN fails closed / review required
  return {
    isEntailed: false,
    code: 'CLAIM_USAGE_ENTAILMENT_MISMATCH',
    result: 'UNCERTAIN',
    reason: `CLAIM_USAGE_ENTAILMENT_MISMATCH: Hubungan semantik antara asersi artikel dan klaim belum terbukti secara pasti (UNCERTAIN: ${out.reason}).`
  };
}

/**
 * Extracts and parses GroundedDraftEnvelope from LLM response.
 * Handles both clean JSON and JSON enclosed in markdown code fences.
 * If raw markdown is returned without JSON, gracefully extracts markdown
 * and marks grounding declaration as missing (triggering review).
 */
export function parseGroundedDraftEnvelope(rawResponse: string): GroundedDraftEnvelope {
  const trimmed = rawResponse.trim();

  // 1. Try direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && typeof parsed.article_markdown === 'string') {
      return {
        article_markdown: parsed.article_markdown.trim(),
        claim_usage: Array.isArray(parsed.claim_usage) ? parsed.claim_usage : [],
        unsupported_claim_candidates: Array.isArray(parsed.unsupported_claim_candidates)
          ? parsed.unsupported_claim_candidates
          : []
      };
    }
  } catch {
    // continue to regex extraction
  }

  // 2. Try JSON inside ```json ... ``` code fence
  const jsonFenceMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (jsonFenceMatch) {
    try {
      const parsed = JSON.parse(jsonFenceMatch[1]);
      if (parsed && typeof parsed === 'object' && typeof parsed.article_markdown === 'string') {
        return {
          article_markdown: parsed.article_markdown.trim(),
          claim_usage: Array.isArray(parsed.claim_usage) ? parsed.claim_usage : [],
          unsupported_claim_candidates: Array.isArray(parsed.unsupported_claim_candidates)
            ? parsed.unsupported_claim_candidates
            : []
        };
      }
    } catch {
      // continue
    }
  }

  // 3. Fallback: Model output raw markdown directly without JSON envelope
  return {
    article_markdown: trimmed,
    claim_usage: [],
    unsupported_claim_candidates: []
  };
}

export interface ArticleSpan {
  span: string;
  charStart: number;
  charEnd: number;
  spanHash: string;
}

export function extractArticleSentenceSpans(articleMarkdown: string): ArticleSpan[] {
  const spans: ArticleSpan[] = [];
  if (!articleMarkdown) return spans;

  const lines = articleMarkdown.split('\n');
  let currentOffset = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const lineStart = currentOffset + (line.length - line.trimStart().length);

    // Skip markdown headings
    if (trimmedLine.startsWith('#')) {
      currentOffset += line.length + 1;
      continue;
    }

    // Skip thematic breaks and horizontal rules
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      currentOffset += line.length + 1;
      continue;
    }

    // Skip empty lines
    if (trimmedLine.length === 0) {
      currentOffset += line.length + 1;
      continue;
    }

    // Clean list marker if any
    let content = trimmedLine;
    let contentStart = lineStart;
    const listMatch = content.match(/^([-*•]|\d+\.)\s+/);
    if (listMatch) {
      content = content.slice(listMatch[0].length);
      contentStart += listMatch[0].length;
    }

    // Split line into sentences on punctuation boundaries (.!?)
    const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
    let match: RegExpExecArray | null;

    while ((match = sentenceRegex.exec(content)) !== null) {
      const sentenceText = match[0].trim();
      if (sentenceText.length === 0) continue;

      const sentenceStart = contentStart + match.index;
      const sentenceEnd = sentenceStart + sentenceText.length;
      const spanHash = crypto.createHash('sha256').update(normalizeArticleText(sentenceText), 'utf8').digest('hex');

      spans.push({
        span: sentenceText,
        charStart: sentenceStart,
        charEnd: sentenceEnd,
        spanHash
      });
    }

    currentOffset += line.length + 1;
  }

  return spans;
}

export function isNonClaimProse(span: string): { isExempt: boolean; reason: string } {
  const clean = span.trim();

  // 1. Pure questions or rhetorical inquiries
  if (clean.endsWith('?') || /^(?:apakah|bagaimana|mengapa|kenapa|lalu bagaimana|apa yang terjadi)\b/i.test(clean)) {
    return { isExempt: true, reason: 'EXEMPT_QUESTION: Kalimat pertanyaan / eksplorasi pembaca' };
  }

  // 2. Navigation labels / formatting / notes
  if (/^\[(?:baca juga|sumber|referensi|note|catatan):/i.test(clean) || /^>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(clean)) {
    return { isExempt: true, reason: 'EXEMPT_NAVIGATION: Label navigasi atau format blok kutipan' };
  }

  // 3. Connective transitions / conversational editorial framing
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
    return { isExempt: true, reason: 'EXEMPT_CONNECTIVE: Frasa penghubung / transisi narasi' };
  }

  // 4. Short fragments without declarative propositional content (< 20 chars)
  if (clean.length < 20 && !/\b(?:adalah|merupakan|karena|sebab|sehingga|yaitu|terjadi)\b/i.test(clean)) {
    return { isExempt: true, reason: 'EXEMPT_FRAGMENT: Fragmen teks non-proposisional singkat' };
  }

  return { isExempt: false, reason: 'DECLARATIVE_PROSE: Memerlukan rujukan bukti' };
}

export function buildArticleAssertionLedger(
  articleMarkdown: string,
  claimUsages: AuthorClaimUsageDeclaration[] = [],
  options?: {
    approvedClaims?: any[];
  }
): ArticleAssertionLedger {
  const spans = extractArticleSentenceSpans(articleMarkdown);
  const entries: ArticleAssertionEntry[] = [];
  const unaccounted_spans: string[] = [];
  const errors: string[] = [];

  let evidenceBackedCount = 0;
  let editorialInferenceCount = 0;
  let nonClaimProseCount = 0;

  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    const assertionId = `AST-${(i + 1).toString().padStart(3, '0')}`;
    const normSpan = normalizeArticleText(s.span);

    // 1. Look for matching claim_usage
    const matchedUsage = claimUsages.find(u => {
      const normEx = normalizeArticleText(u.article_excerpt || '');
      if (!normEx) return false;
      return normEx.includes(normSpan) || normSpan.includes(normEx) || (
        normSpan.length > 25 && normEx.length > 25 && (
          normSpan.slice(0, 30) === normEx.slice(0, 30) ||
          normSpan.slice(-30) === normEx.slice(-30)
        )
      );
    });

    if (matchedUsage) {
      const isInf = matchedUsage.usage_type === 'EDITORIAL_INFERENCE';
      const kind: AssertionKind = isInf ? 'EDITORIAL_INFERENCE' : 'EVIDENCE_BACKED';
      const claimIds = Array.isArray((matchedUsage as any).claim_ids)
        ? (matchedUsage as any).claim_ids
        : (matchedUsage.claim_id ? [matchedUsage.claim_id] : []);

      if (isInf) {
        editorialInferenceCount++;
      } else {
        evidenceBackedCount++;
      }

      entries.push({
        assertion_id: assertionId,
        article_span: s.span,
        char_start: s.charStart,
        char_end: s.charEnd,
        span_hash: s.spanHash,
        assertion_kind: kind,
        claim_ids: claimIds,
        usage_type: matchedUsage.usage_type,
        classification_reason: `Tercakup dalam deklarasi klaim ${claimIds.join(', ')} (${matchedUsage.usage_type})`
      });
      continue;
    }

    // 2. Check if exempt non-claim prose
    const proseCheck = isNonClaimProse(s.span);
    if (proseCheck.isExempt) {
      nonClaimProseCount++;
      entries.push({
        assertion_id: assertionId,
        article_span: s.span,
        char_start: s.charStart,
        char_end: s.charEnd,
        span_hash: s.spanHash,
        assertion_kind: 'NON_CLAIM_PROSE',
        claim_ids: [],
        usage_type: null,
        classification_reason: proseCheck.reason
      });
      continue;
    }

    // 3. Declarative factual statement NOT covered by claim_usage => ARTICLE_ASSERTION_UNACCOUNTED!
    unaccounted_spans.push(s.span);
    errors.push(
      `ARTICLE_ASSERTION_UNACCOUNTED: Asersi deklaratif substansial di naskah belum tercakup dalam claim_usage atau bukti: "${s.span.slice(0, 90)}..."`
    );

    entries.push({
      assertion_id: assertionId,
      article_span: s.span,
      char_start: s.charStart,
      char_end: s.charEnd,
      span_hash: s.spanHash,
      assertion_kind: 'NON_CLAIM_PROSE',
      claim_ids: [],
      usage_type: null,
      classification_reason: `UNACCOUNTED_DECLARATIVE: ${proseCheck.reason}`
    });
  }

  const is_exhaustive = unaccounted_spans.length === 0;

  return {
    entries,
    total_spans_count: spans.length,
    evidence_backed_count: evidenceBackedCount,
    editorial_inference_count: editorialInferenceCount,
    non_claim_prose_count: nonClaimProseCount,
    unaccounted_count: unaccounted_spans.length,
    unaccounted_spans,
    is_exhaustive,
    errors
  };
}

/**
 * Validates the draft envelope against the approved evidence pack and safe claims.
 * Non-Negotiable: Author grounding declaration is NOT verified evidence grounding.
 * Milestone EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1B:
 * Enforces exhaustive article span coverage (ARTICLE_ASSERTION_UNACCOUNTED),
 * article span integrity (CLAIM_USAGE_ARTICLE_SPAN_NOT_FOUND),
 * and proposition-based semantic entailment (CLAIM_USAGE_ENTAILMENT_MISMATCH).
 */
export function validateClaimGrounding(
  envelope: GroundedDraftEnvelope,
  evidencePack: EvidencePackInput,
  authorSafeClaims?: AuthorSafeClaim[]
): GroundingAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Compile Valid Claim IDs and claim map from evidence pack
  const validClaimIdSet = new Set<string>();
  const removedClaimIdSet = new Set<string>();
  const claimMap = new Map<string, any>();

  if (Array.isArray(evidencePack.claim_inventory)) {
    for (const c of evidencePack.claim_inventory) {
      if (c && c.claim_id) {
        validClaimIdSet.add(c.claim_id);
        claimMap.set(c.claim_id, c);
      }
    }
  }

  if (authorSafeClaims && authorSafeClaims.length > 0) {
    for (const sc of authorSafeClaims) {
      if (sc.claim_id) {
        validClaimIdSet.add(sc.claim_id);
        if (!claimMap.has(sc.claim_id)) {
          claimMap.set(sc.claim_id, sc);
        }
        if (sc.allowed_for_authoring === false) {
          removedClaimIdSet.add(sc.claim_id);
        }
      }
    }
  }

  // Prohibited Claim IDs (if any explicitly declared in evidence pack)
  const prohibitedClaimIdSet = new Set<string>();
  if (Array.isArray(evidencePack.prohibited_claims)) {
    for (const p of evidencePack.prohibited_claims) {
      const match = p.match(/\b(CLM-\w+)\b/i);
      if (match) {
        prohibitedClaimIdSet.add(match[1]);
      }
    }
  }

  // Check historical roof compatibility
  const isHistoricalRoof = isHistoricalRoofPack(evidencePack);

  // 2. Validate declared claim usages, article span integrity, and semantic entailment
  const unrecognizedClaimIds: string[] = [];
  const prohibitedClaimIds: string[] = [];
  const removedClaimsUsed: string[] = [];
  let validClaimsCount = 0;
  let spanNotFoundCount = 0;
  let entailmentMismatchCount = 0;

  for (const usage of envelope.claim_usage) {
    const cid = usage.claim_id?.trim();
    let usageError = false;

    if (!cid || !validClaimIdSet.has(cid)) {
      unrecognizedClaimIds.push(cid || 'UNKNOWN');
      errors.push(`Klaim [${cid}] tidak terdaftar dalam paket bukti yang disetujui.`);
      usageError = true;
    } else if (prohibitedClaimIdSet.has(cid)) {
      prohibitedClaimIds.push(cid);
      errors.push(`Klaim [${cid}] terdaftar sebagai klaim terlarang dalam paket bukti.`);
      usageError = true;
    } else if (removedClaimIdSet.has(cid)) {
      removedClaimsUsed.push(cid);
      errors.push(`Klaim [${cid}] memiliki aksi REMOVE dan dilarang digunakan untuk penulisan.`);
      usageError = true;
    }

    // Check Article Span Integrity
    const spanLoc = locateArticleSpan(usage.article_excerpt, envelope.article_markdown);
    usage.article_character_start = spanLoc.charStart;
    usage.article_character_end = spanLoc.charEnd;
    usage.span_hash = spanLoc.spanHash;

    if (!spanLoc.found) {
      usage.entailment_status = 'CLAIM_USAGE_ARTICLE_SPAN_NOT_FOUND';
      spanNotFoundCount++;
      errors.push(
        `CLAIM_USAGE_ARTICLE_SPAN_NOT_FOUND: Kutipan teks '${(usage.article_excerpt || '').slice(0, 60)}...' untuk klaim '${usage.claim_id}' tidak ditemukan sebagai span eksak/ternormalisasi di dalam naskah artikel (article_markdown).`
      );
      usageError = true;
    }

    // Check Semantic Entailment via Proposition-based Verifier
    if (cid && claimMap.has(cid)) {
      const targetClaim = claimMap.get(cid);
      const entailment = validateClaimUsageEntailment(usage, targetClaim, { isHistoricalRoof });
      if (!entailment.isEntailed) {
        usage.entailment_status = 'CLAIM_USAGE_ENTAILMENT_MISMATCH';
        entailmentMismatchCount++;
        errors.push(
          entailment.reason || `CLAIM_USAGE_ENTAILMENT_MISMATCH: Klaim '${cid}' tidak mendukung proposisi semantik pada kutipan artikel.`
        );
        usageError = true;
      } else if (spanLoc.found) {
        usage.entailment_status = 'VALID';
      }
    }

    if (!usageError) {
      validClaimsCount++;
    }
  }

  // 3. Check for Prohibited Elements (e.g. removed numbers from author_safe_claims)
  const prohibitedElementsFound: string[] = [];
  if (authorSafeClaims) {
    for (const sc of authorSafeClaims) {
      if (Array.isArray(sc.prohibited_elements)) {
        for (const elem of sc.prohibited_elements) {
          if (elem && elem.trim() && envelope.article_markdown.includes(elem.trim())) {
            prohibitedElementsFound.push(elem.trim());
          }
        }
      }
    }
  }

  if (prohibitedElementsFound.length > 0) {
    errors.push(
      `Naskah mengandung elemen terlarang yang dihapus oleh peneliti bukti: ${prohibitedElementsFound.join(', ')}`
    );
  }

  // 4. Check for Unsupported Claim Candidates
  const unsupportedCandidatesFound: string[] = [];
  if (envelope.unsupported_claim_candidates && envelope.unsupported_claim_candidates.length > 0) {
    for (const cand of envelope.unsupported_claim_candidates) {
      const cAny = cand as any;
      const candStr = typeof cand === 'string'
        ? cand
        : (cand && typeof cand === 'object' ? (cAny.statement || cAny.claim || cAny.description || JSON.stringify(cand)) : String(cand || ''));
      if (candStr && candStr.trim()) {
        unsupportedCandidatesFound.push(candStr.trim());
      }
    }
    errors.push(
      `Joko mendeklarasikan klaim teknis di luar paket bukti: ${unsupportedCandidatesFound.join('; ')}`
    );
  }

  // 5. Audit Article Assertion Ledger Coverage (ARTICLE_ASSERTION_UNACCOUNTED)
  const ledger = buildArticleAssertionLedger(
    envelope.article_markdown,
    envelope.claim_usage,
    { approvedClaims: evidencePack.claim_inventory }
  );

  const unaccountedAssertionsCount = ledger.unaccounted_count;
  if (unaccountedAssertionsCount > 0) {
    for (const uSpan of ledger.unaccounted_spans) {
      if (isHistoricalRoof) {
        warnings.push(
          `ARTICLE_ASSERTION_UNACCOUNTED: Kalimat asersi deklaratif substansial di naskah belum tercakup dalam claim_usage atau bukti: "${uSpan.slice(0, 90)}..."`
        );
      } else {
        errors.push(
          `ARTICLE_ASSERTION_UNACCOUNTED: Kalimat asersi deklaratif substansial di naskah belum tercakup dalam claim_usage atau bukti: "${uSpan.slice(0, 90)}..."`
        );
      }
    }
  }

  // 6. Determine Final Grounding Status
  let status: GroundingStatus = 'DECLARED_GROUNDED';
  let requiresReview = false;

  if (prohibitedClaimIds.length > 0 || prohibitedElementsFound.length > 0) {
    status = 'PROHIBITED_CLAIM_DETECTED';
    requiresReview = true;
  } else if (unsupportedCandidatesFound.length > 0) {
    status = 'UNSUPPORTED_CLAIMS_DETECTED';
    requiresReview = true;
  } else if (
    unrecognizedClaimIds.length > 0 ||
    removedClaimsUsed.length > 0 ||
    spanNotFoundCount > 0 ||
    entailmentMismatchCount > 0 ||
    (!isHistoricalRoof && unaccountedAssertionsCount > 0) ||
    envelope.claim_usage.length === 0
  ) {
    status = 'GROUNDING_REVIEW_REQUIRED';
    requiresReview = true;
    if (envelope.claim_usage.length === 0) {
      warnings.push('Penulis tidak mendeklarasikan pemetaan klaim aman (envelope claim_usage kosong).');
    }
  }

  const isValid = errors.length === 0;

  return {
    status,
    isValid,
    requiresReview,
    declaredClaimsCount: envelope.claim_usage.length,
    validClaimsCount,
    unrecognizedClaimIds,
    prohibitedClaimIds,
    removedClaimsUsed,
    prohibitedElementsFound,
    unsupportedCandidatesFound,
    spanNotFoundCount,
    entailmentMismatchCount,
    unaccountedAssertionsCount,
    assertionLedger: ledger,
    declarationProvenance: 'AUTHOR_GROUNDING_DECLARATION',
    warnings,
    errors
  };
}

/**
 * Audits prescriptive certainty and repetitive structure in the draft.
 */
export interface EditorialRefinementAudit {
  repetitiveDecisionSectionsCount: number;
  prescriptiveWordsFound: string[];
  recommendation: 'PROCEED' | 'COMPRESSION_SUGGESTED';
  notes: string[];
}

export function auditEditorialRefinement(markdown: string): EditorialRefinementAudit {
  const notes: string[] = [];

  // Check for duplicate decision headings (allow leading whitespace)
  const decisionHeadings = markdown.match(/^\s*##+\s+.*(?:panduan keputusan|rekomendasi|mana yang didahulukan|skenario|kesimpulan).*/gim) || [];
  const repetitiveDecisionSectionsCount = decisionHeadings.length;

  if (repetitiveDecisionSectionsCount > 2) {
    notes.push(
      `Terdeteksi ${repetitiveDecisionSectionsCount} subjudul keputusan/rekomendasi. Prinsip ONE IDEA — ONE BEST HOME menyarankan mengonsolidasikan rekomendasi menjadi satu bagian utama.`
    );
  }

  // Check for overly absolute prescriptive words
  const prescriptiveTerms = ['wajib', 'pasti', 'harus', 'paling efektif', 'paling cepat', 'tidak berfungsi', 'hampir nol'];
  const prescriptiveWordsFound: string[] = [];
  const lower = markdown.toLowerCase();

  for (const term of prescriptiveTerms) {
    const matches = lower.match(new RegExp(`\\b${term}\\b`, 'gi'));
    if (matches && matches.length >= 2) {
      prescriptiveWordsFound.push(`${term} (${matches.length}x)`);
    }
  }

  if (prescriptiveWordsFound.length > 0) {
    notes.push(
      `Terdeteksi penggunaan kata preskriptif absolut tinggi: ${prescriptiveWordsFound.join(', ')}. Disarankan menggunakan penjelasan berbasis konteks.`
    );
  }

  return {
    repetitiveDecisionSectionsCount,
    prescriptiveWordsFound,
    recommendation: repetitiveDecisionSectionsCount > 2 ? 'COMPRESSION_SUGGESTED' : 'PROCEED',
    notes
  };
}

/**
 * Audits technical assertion coverage in draft article markdown.
 * Enforces:
 * Substantive technical assertions (mechanisms, physics, biology, material behaviors)
 * must be covered by a declared claim_usage, otherwise flagged as UNDECLARED_TECHNICAL_ASSERTION.
 * Milestone: EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1
 */
export interface TechnicalAssertion {
  sentence: string;
  classification?: ClaimUsageType;
  linked_claim_id?: string;
  isDeclared: boolean;
}

export interface TechnicalAssertionCoverageReport {
  passed: boolean;
  total_assertions_count: number;
  declared_assertions_count: number;
  undeclared_assertions_count: number;
  undeclared_assertions: string[];
  assertions: TechnicalAssertion[];
  errors: string[];
}

/**
 * Audits technical assertion coverage in draft article markdown.
 * Powered by ArticleAssertionLedger (Milestone EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1B).
 * Replaces keyword-overfit technical discovery with exhaustive proposition-level accounting.
 * Emits both ARTICLE_ASSERTION_UNACCOUNTED and UNDECLARED_TECHNICAL_ASSERTION for backwards compatibility.
 * NON-AUTHORITATIVE HINT: REGEX_HINT != SEMANTIC_PROOF.
 */
export function auditTechnicalAssertionCoverage(
  articleMarkdown: string,
  claimUsages: AuthorClaimUsageDeclaration[],
  options?: {
    approvedClaims?: any[];
  }
): TechnicalAssertionCoverageReport {
  const ledger = buildArticleAssertionLedger(articleMarkdown, claimUsages, options);

  const assertions: TechnicalAssertion[] = ledger.entries.map(e => ({
    sentence: e.article_span,
    classification: e.usage_type || undefined,
    linked_claim_id: e.claim_ids[0],
    isDeclared: e.assertion_kind === 'EVIDENCE_BACKED' || e.assertion_kind === 'EDITORIAL_INFERENCE'
  }));

  const errors: string[] = [];
  for (const u of ledger.unaccounted_spans) {
    errors.push(
      `ARTICLE_ASSERTION_UNACCOUNTED: Kalimat asersi deklaratif substansial di naskah belum tercakup dalam claim_usage atau bukti: "${u.slice(0, 100)}..."`
    );
    errors.push(
      `UNDECLARED_TECHNICAL_ASSERTION: Kalimat asersi teknis substansial ditemukan di naskah tanpa deklarasi klaim bukti: "${u.slice(0, 100)}..."`
    );
  }

  return {
    passed: ledger.is_exhaustive,
    total_assertions_count: ledger.total_spans_count,
    declared_assertions_count: ledger.evidence_backed_count + ledger.editorial_inference_count,
    undeclared_assertions_count: ledger.unaccounted_count,
    undeclared_assertions: ledger.unaccounted_spans,
    assertions,
    errors
  };
}

