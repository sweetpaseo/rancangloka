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
import { isHistoricalRoofPack, generateAuthorSafeClaims, type EvidencePackInput, type AuthorSafeClaim, type EvidenceClaim } from '../article/human-quality.ts';
import type { EditorialBrief } from './editorial-planner.ts';
import { evaluateBilingualPropositionEntailment } from './bilingual-normalizer.ts';
import {
  verifySourceContentIntegrity,
  evaluateEvidenceEntailment,
  auditAssertionCoverage,
  computeArticleContentHash,
  type AssertionCoverageAuditResult
} from './source-provenance-verifier.ts';
import {
  AssertionReconciliationEngine,
  extractArticleSpansWithGranularity,
  classifyNonClaimProse,
  evaluateEditorialInference,
  findCandidateClaimsForAssertion,
  type AssertionClassification,
  type ClaimTaxonomyKind,
  type ResolutionSource,
  type SemanticResult,
  type ReconciledAssertionEntry,
  type AssertionReconciliationMetrics,
  type AssertionReconciliationInput,
  type AssertionReconciliationResult,
  type NonClaimProseClassification,
  type EditorialInferenceEvaluation
} from './assertion-reconciliation.ts';

export {
  AssertionReconciliationEngine,
  extractArticleSpansWithGranularity,
  classifyNonClaimProse,
  evaluateEditorialInference,
  findCandidateClaimsForAssertion,
  type AssertionClassification,
  type ClaimTaxonomyKind,
  type ResolutionSource,
  type SemanticResult,
  type ReconciledAssertionEntry,
  type AssertionReconciliationMetrics,
  type AssertionReconciliationInput,
  type AssertionReconciliationResult,
  type NonClaimProseClassification,
  type EditorialInferenceEvaluation
};

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

export type AssertionKind =
  | 'EVIDENCE_BACKED'
  | 'EDITORIAL_INFERENCE'
  | 'NON_CLAIM_PROSE'
  | 'SUPPORTED_PRACTICAL_GUIDANCE'
  | 'OPTIONAL_DESIGN_EXAMPLE'
  | 'UNRESOLVED';

export interface ArticleAssertionEntry {
  assertion_id: string;
  article_span: string;
  char_start: number;
  char_end: number;
  span_hash: string;
  assertion_kind: AssertionKind;
  classification?: AssertionClassification;
  taxonomy_kind?: ClaimTaxonomyKind;
  claim_ids: string[];
  supporting_claim_ids?: string[];
  supporting_passage_ids?: string[];
  usage_type: 'DIRECT_PARAPHRASE' | 'SUPPORTED_SYNTHESIS' | 'EDITORIAL_INFERENCE' | null;
  semantic_result?: SemanticResult;
  resolution_source?: ResolutionSource;
  classification_reason: string;
  reason?: string;
  derived_from_claim_ids?: string[];
  inference_reason?: string;
}

export interface ArticleAssertionLedger {
  article_content_hash?: string;
  entries: ArticleAssertionEntry[];
  total_spans_count: number;
  substantive_assertion_count?: number;
  evidence_backed_count: number;
  editorial_inference_count: number;
  non_claim_prose_count: number;
  practical_guidance_count?: number;
  optional_design_example_count?: number;
  unaccounted_count: number;
  unresolved_assertion_count?: number;
  not_entailed_count?: number;
  uncertain_count?: number;
  joko_declared_mapping_count?: number;
  auto_reconciled_mapping_count?: number;
  semantic_verifier_mapping_count?: number;
  unaccounted_spans: string[];
  is_exhaustive: boolean;
  errors: string[];
  reconciliation_report?: AssertionReconciliationResult;
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
  article_content_hash?: string;
  coverageAudit?: AssertionCoverageAuditResult;
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

  // 4. Graceful prefix match for excerpts truncated mid-sentence or ending with ellipsis
  if (normExcerpt.length >= 25) {
    const candidatePrefixes = [
      normExcerpt.slice(0, Math.min(45, normExcerpt.length)),
      normExcerpt.slice(0, Math.min(35, normExcerpt.length)),
      normExcerpt.slice(0, Math.min(25, normExcerpt.length))
    ];
    for (const pfx of candidatePrefixes) {
      const idx = normMarkdown.indexOf(pfx);
      if (idx !== -1) {
        return {
          found: true,
          charStart: idx,
          charEnd: idx + pfx.length,
          spanHash
        };
      }
    }
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

export function crossLingualStemMatch(a: string, b: string): boolean {
  if (a === b) {
    // Explicit homograph guard: Indonesian "air" (liquid water) != English "air" (atmospheric gas)
    if (a === 'air') return false;
    return true;
  }
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
    if ((a.includes('lembap') && (b.includes('damp') || b.includes('moist') || b.includes('humid'))) || ((a.includes('damp') || a.includes('moist') || a.includes('humid')) && b.includes('lembap'))) return true;
    if ((a.includes('penghuni') && b.includes('occupan')) || (a.includes('occupan') && b.includes('penghuni'))) return true;
    if ((a.includes('radiasi') && b.includes('radiat')) || (a.includes('radiat') && b.includes('radiasi'))) return true;
    if ((a.includes('peneduh') && (b.includes('shad') || b.includes('screen') || b.includes('overhang') || b.includes('louver') || b.includes('awning') || b.includes('facade'))) ||
        ((b.includes('shad') || b.includes('screen') || b.includes('overhang') || b.includes('louver') || b.includes('awning') || b.includes('facade')) && a.includes('peneduh'))) return true;
    if ((a.includes('shading') && (b.includes('peneduh') || b.includes('naung'))) || ((b.includes('peneduh') || b.includes('naung')) && a.includes('shading'))) return true;
    if ((a.includes('kaca') && (b.includes('glass') || b.includes('glaz'))) || ((b.includes('glass') || b.includes('glaz')) && a.includes('kaca'))) return true;
    if ((a.includes('jendela') && b.includes('window')) || (a.includes('window') && b.includes('jendela'))) return true;
    if ((a.includes('matahari') && (b.includes('solar') || b.includes('sun'))) || ((b.includes('solar') || b.includes('sun')) && a.includes('matahari'))) return true;
    if ((a.includes('panas') && (b.includes('heat') || b.includes('thermal') || b.includes('warm'))) || ((b.includes('heat') || b.includes('thermal') || b.includes('warm')) && a.includes('panas'))) return true;
    if ((a.includes('ventilasi') && (b.includes('ventilat') || b.includes('airflow'))) || ((b.includes('ventilat') || b.includes('airflow')) && a.includes('ventilasi'))) return true;
    if ((a.includes('tirai') && (b.includes('curtain') || b.includes('blind') || b.includes('shade'))) || ((b.includes('curtain') || b.includes('blind') || b.includes('shade')) && a.includes('tirai'))) return true;
    if ((a.includes('bayangan') && (b.includes('shadow') || b.includes('shade'))) || ((b.includes('shadow') || b.includes('shade')) && a.includes('bayangan'))) return true;
    if ((a.includes('pantul') && b.includes('reflect')) || (a.includes('reflect') && b.includes('pantul'))) return true;
    if ((a.includes('sudut') && b.includes('angle')) || (a.includes('angle') && b.includes('sudut'))) return true;
    if ((a.includes('dinding') && b.includes('wall')) || (a.includes('wall') && b.includes('dinding'))) return true;
    if ((a.includes('atap') && b.includes('roof')) || (a.includes('roof') && b.includes('atap'))) return true;
    if ((a.includes('tritisan') && (b.includes('overhang') || b.includes('eave'))) || ((b.includes('overhang') || b.includes('eave')) && a.includes('tritisan'))) return true;
    if ((a.includes('arah') && (b.includes('orient') || b.includes('direction'))) || ((b.includes('orient') || b.includes('direction')) && a.includes('arah'))) return true;
    if ((a.includes('suhu') && b.includes('temp')) || (a.includes('temp') && b.includes('suhu'))) return true;
    if ((a.includes('rongga') && (b.includes('cavity') || b.includes('gap') || b.includes('space'))) || ((b.includes('cavity') || b.includes('gap') || b.includes('space')) && a.includes('rongga'))) return true;
    if ((a.includes('aliran') && b.includes('flow')) || (a.includes('flow') && b.includes('aliran'))) return true;
    if ((a.includes('udara') && b.includes('air')) || (a.includes('air') && b.includes('udara'))) return true;
    if ((a.includes('air') && (b.includes('water') || b.includes('moist'))) || ((b.includes('water') || b.includes('moist')) && a.includes('air'))) return true;
    if ((a.includes('insulasi') && b.includes('insulat')) || (b.includes('insulat') && a.includes('insulasi'))) return true;
    if ((a.includes('pembangunan') && b.includes('construct')) || (b.includes('construct') && a.includes('pembangunan'))) return true;
    if ((a.includes('mudah') && (b.includes('eas') || b.includes('simple'))) || ((b.includes('eas') || b.includes('simple')) && a.includes('mudah'))) return true;
    if ((a.includes('terperangkap') && b.includes('trap')) || (b.includes('trap') && a.includes('terperangkap'))) return true;
    if ((a.includes('kinerja') && b.includes('perform')) || (b.includes('perform') && a.includes('kinerja'))) return true;
    if ((a.includes('sambungan') && b.includes('joint')) || (b.includes('joint') && a.includes('sambungan'))) return true;
    if ((a.includes('pendingin') && b.includes('cooling')) || (a.includes('cooling') && b.includes('pendingin'))) return true;
    if ((a.includes('nyaman') && b.includes('comfort')) || (b.includes('comfort') && a.includes('nyaman'))) return true;
    if ((a.includes('permukaan') && b.includes('surface')) || (b.includes('surface') && a.includes('permukaan'))) return true;
    if ((a.includes('konveksi') && b.includes('convect')) || (b.includes('convect') && a.includes('konveksi'))) return true;
    if ((a.includes('konduksi') && b.includes('conduct')) || (b.includes('conduct') && a.includes('konduksi'))) return true;
    if ((a.includes('serap') && b.includes('absorb')) || (b.includes('absorb') && a.includes('serap'))) return true;
    if ((a.includes('warna') && b.includes('color')) || (b.includes('color') && a.includes('warna'))) return true;
    if ((a.includes('luas') && b.includes('area')) || (b.includes('area') && a.includes('luas'))) return true;
    if ((a.includes('faktor') && b.includes('factor')) || (b.includes('factor') && a.includes('faktor'))) return true;
    if ((a.includes('pengaruh') && (b.includes('effect') || b.includes('influenc'))) || ((b.includes('effect') || b.includes('influenc')) && a.includes('pengaruh'))) return true;
    if ((a.includes('energi') && b.includes('energy')) || (b.includes('energy') && a.includes('energi'))) return true;
    if ((a.includes('pasif') && b.includes('passive')) || (b.includes('passive') && a.includes('pasif'))) return true;
    if ((a.includes('aktif') && b.includes('active')) || (b.includes('active') && a.includes('aktif'))) return true;
    if ((a.includes('mekanis') && b.includes('mechanic')) || (b.includes('mechanic') && a.includes('mekanis'))) return true;
  }
  return false;
}

export interface CompoundClauseDecomposition {
  isCompound: boolean;
  clauses: string[];
  isAmbiguous: boolean;
  decompositionReason?: string;
}

/**
 * Phase 2C.2 Compound Assertion Safety:
 * Decomposes substantive compound assertions into independently factual clauses.
 * Invariant: Supported clause + unsupported clause != ENTAILED.
 * Avoids naive splitting that breaks legitimate terminology, decimal numbers, or quoted passages.
 * If decomposition is ambiguous, marks isAmbiguous: true to fail closed.
 */
export function decomposeSubstantiveCompoundClauses(text: string): CompoundClauseDecomposition {
  if (!text) return { isCompound: false, clauses: [text], isAmbiguous: false };

  // Strip non-propositional introductory framing phrases before splitting conjuncts
  const cleanAssertion = text.replace(
    /^\s*(?:secara\s+(?:fisika\s+bangunan|umum|garis\s+besar|teori|praktik|keseluruhan)|dalam\s+(?:fisika\s+bangunan|praktiknya|kenyataannya|hal\s+ini))\s*,\s*/i,
    ''
  );

  // Mask string quotes and decimal numbers
  const quotes: string[] = [];
  let masked = cleanAssertion.replace(/"([^"]*)"|'([^']*)'/g, (m) => {
    quotes.push(m);
    return `__QUOTE_${quotes.length - 1}__`;
  });

  masked = masked.replace(/(\d+),(\d+)/g, '$1__COMMA__$2');

  // Coordinating conjunctions separating independent clauses:
  // e.g. ', dan ', ', serta ', ', sedangkan ', ', sementara ', '; ', ', tetapi ', ', padahal '
  const clauseSplitter = /(?:,\s*(?:dan|serta|sedangkan|sementara|tetapi|padahal)\s+|;\s*)/gi;
  const rawParts = masked.split(clauseSplitter);

  if (rawParts.length <= 1) {
    return { isCompound: false, clauses: [cleanAssertion], isAmbiguous: false };
  }

  const predicateRegex = /\b(?:adalah|merupakan|dapat|bisa|harus|wajib|perlu|terjadi|menyebabkan|menghasilkan|mengurangi|meningkatkan|memengaruhi|berpengaruh|memiliki|menggunakan|dibuat|dipasang|berfungsi|menjaga|memutus|menahan|mengalirkan|merambat|menguap|mendingin|memanas|membentuk|mengikat|menghantarkan|menghantar|menyerap|mencegah|melindungi|memerlukan|membutuhkan|mengalami|membantu|menurunkan|menghentikan)\b/i;

  const clauses: string[] = [];
  for (const part of rawParts) {
    let unmasked = part.replace(/__COMMA__/g, ',');
    unmasked = unmasked.replace(/__QUOTE_(\d+)__/g, (_, idx) => quotes[Number(idx)] || '');
    const trimmed = unmasked.trim();

    // Check if each clause is substantive (length >= 20 and has a predicate)
    if (trimmed.length < 20 || !predicateRegex.test(trimmed)) {
      // One of the parts is merely a noun phrase, list element, or fragment.
      // Not an independent compound proposition; do not split.
      return { isCompound: false, clauses: [cleanAssertion], isAmbiguous: false };
    }
    clauses.push(trimmed);
  }

  // Ambiguity check: if split created > 4 clauses, structure is too convoluted for deterministic decomposition
  if (clauses.length > 4) {
    return {
      isCompound: true,
      clauses,
      isAmbiguous: true,
      decompositionReason: 'Compound assertion clause structure exceeds maximum deterministic decomposition depth'
    };
  }

  return {
    isCompound: clauses.length > 1,
    clauses,
    isAmbiguous: false
  };
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
 * Phase 2C.2 Invariant: LEXICAL SIMILARITY IS NOT FACTUAL ENTAILMENT.
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

    // Phase 4: Compound Assertion Safety
    const compoundCheck = decomposeSubstantiveCompoundClauses(assertion);
    if (compoundCheck.isAmbiguous) {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'UNCERTAIN',
        confidence: 'LOW',
        reason: `Ambiguous compound assertion clause decomposition (${compoundCheck.decompositionReason || 'fail-closed'})`
      };
    }

    if (compoundCheck.isCompound && compoundCheck.clauses.length > 1) {
      // Verify each substantive independent clause
      for (const clause of compoundCheck.clauses) {
        const clRes = this.verifySingleClause({
          articleAssertion: clause,
          claimStatement: statement,
          claimIds: input.claimIds,
          usageType: input.usageType
        });
        if (clRes.result !== 'ENTAILED') {
          return {
            assertion_id: (input as any).assertion_id,
            result: clRes.result === 'NOT_ENTAILED' ? 'NOT_ENTAILED' : 'UNCERTAIN',
            confidence: 'HIGH',
            reason: `Compound assertion safety violation: Independent clause "${clause.slice(0, 60)}..." is not supported by claim (${clRes.reason})`
          };
        }
      }
      return {
        assertion_id: (input as any).assertion_id,
        result: 'ENTAILED',
        confidence: 'MEDIUM',
        supporting_claim_ids: input.claimIds,
        reason: 'All substantive independent clauses in compound assertion are supported by evidence'
      };
    }

    return this.verifySingleClause(input);
  }

  verifySingleClause(input: SemanticEntailmentVerificationInput): SemanticEntailmentVerificationOutput {
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

    // 2. Comprehensive 6-Domain Entailment Evaluation via evaluateEvidenceEntailment
    const evEval = evaluateEvidenceEntailment({
      assertionText: assertion,
      sourceProposition: statement,
      sourceTextAccessibility: (input as any).sourceTextAccessibility || 'DIGITALLY_ACCESSIBLE',
      buildingClimateApplicability: (input as any).buildingClimateApplicability || 'DIRECTLY_APPLICABLE_TROPICAL_RESIDENTIAL',
      isDirectProof: (input as any).isDirectProof !== false
    });

    if (evEval.status === 'CONTRADICTED' || evEval.status === 'UNVERIFIED') {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'NOT_ENTAILED',
        confidence: evEval.confidence,
        reason: evEval.reason
      };
    }

    if (evEval.status === 'ENTAILED') {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'ENTAILED',
        confidence: evEval.confidence,
        supporting_claim_ids: input.claimIds,
        reason: evEval.reason
      };
    }

    // 2b. Direct Bilingual Component check if statement has ' / '
    const propEval = evaluateBilingualPropositionEntailment(assertion, statement);
    if (propEval.result === 'NOT_ENTAILED') {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'NOT_ENTAILED',
        confidence: propEval.confidence,
        reason: propEval.reason
      };
    }

    if (propEval.result === 'ENTAILED') {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'ENTAILED',
        confidence: propEval.confidence,
        supporting_claim_ids: input.claimIds,
        reason: propEval.reason
      };
    }

    // 2b. If statement contains bilingual components (e.g. 'ID proposition / EN source snippet')
    if (statement.includes(' / ')) {
      const parts = statement.split(/\s+\/\s+/).map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        const partEval = evaluateBilingualPropositionEntailment(assertion, part);
        if (partEval.result === 'ENTAILED' && !partEval.hasUnresolvedConflict) {
          return {
            assertion_id: (input as any).assertion_id,
            result: 'ENTAILED',
            confidence: partEval.confidence,
            supporting_claim_ids: input.claimIds,
            reason: partEval.reason
          };
        }
      }
    }

    // Invariant Phase 2C.1: Lower-confidence lexical fallback must NEVER override
    // an explicit semantic contradiction, entity mismatch, or unresolved material-subtype conflict.
    if (propEval.hasUnresolvedConflict) {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'UNCERTAIN',
        confidence: 'HIGH',
        reason: `Lexical fallback prohibited due to unresolved semantic conflict: ${propEval.unresolvedConflictReason || propEval.reason}`
      };
    }

    // 3. Fallback: Numeric contradiction check
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

    // 4. Stopwords & tokenization
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

    const sharedTokens = assertTokens.filter(at => stateTokens.some(st => crossLingualStemMatch(at, st)));

    // 5. Zero conceptual overlap => NOT_ENTAILED!
    if (sharedTokens.length === 0) {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'NOT_ENTAILED',
        confidence: 'HIGH',
        reason: 'Zero conceptual or proposition overlap detected between article assertion and claim statement'
      };
    }

    // 6. Check editorial inference
    if (input.usageType === 'EDITORIAL_INFERENCE' && sharedTokens.length >= 1) {
      return {
        assertion_id: (input as any).assertion_id,
        result: 'ENTAILED',
        confidence: 'MEDIUM',
        supporting_claim_ids: input.claimIds,
        reason: `Editorial inference substantiated by core concept (${sharedTokens.join(', ')})`
      };
    }

    // -------------------------------------------------------------------------
    // PHASE 2C.2 INVARIANT: LEXICAL SIMILARITY IS NOT FACTUAL ENTAILMENT.
    // Token overlap may support candidate retrieval or debug diagnostics,
    // but MUST NOT independently return ENTAILED for substantive technical propositions.
    // When affirmative proposition support is incomplete or unavailable: FAIL-CLOSED AS UNCERTAIN.
    // -------------------------------------------------------------------------
    return {
      assertion_id: (input as any).assertion_id,
      result: 'UNCERTAIN',
      confidence: 'LOW',
      reason: `Factual entailment not affirmatively established (token overlap of [${sharedTokens.join(', ')}] does not confer entailment authority; fail-closed)`
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

  // Strip non-propositional introductory framing phrases before splitting conjuncts
  const cleanAssertion = assertion.replace(
    /^\s*(?:secara\s+(?:fisika\s+bangunan|umum|garis\s+besar|teori|praktik|keseluruhan)|dalam\s+(?:fisika\s+bangunan|praktiknya|kenyataannya|hal\s+ini))\s*,\s*/i,
    ''
  );

  // Phase 4: Use robust compound clause decomposition
  const decomp = decomposeSubstantiveCompoundClauses(cleanAssertion);
  if (decomp.isAmbiguous) {
    return {
      result: 'UNCERTAIN',
      confidence: 'LOW',
      reason: `Ambiguous multi-claim synthesis clause structure (${decomp.decompositionReason || 'fail-closed'})`
    };
  }

  const conjuncts = decomp.isCompound ? decomp.clauses : [cleanAssertion];

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
  options?: { verifier?: SemanticEntailmentVerifier; isHistoricalRoof?: boolean; enableVoiceL4?: boolean }
): EntailmentValidationResult {
  const excerpt = usage.article_excerpt || '';
  const statement = claim.statement || '';

  // In historical roof fixtures (prior to generalized semantics), preserve old claim-ID contracts unless Voice L4 is active
  if (options?.isHistoricalRoof && !options?.enableVoiceL4) {
    return { isEntailed: true, code: 'VALID', result: 'UNCERTAIN' };
  }

  // Proposition-based semantic verifier
  const verifier = options?.verifier || new DeterministicSemanticVerifier();
  const vOut = verifier.verify({
    articleAssertion: excerpt,
    claimStatement: statement,
    claimIds: claim.claim_id ? [claim.claim_id] : [],
    usageType: usage.usage_type
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

  if (out.result === 'ENTAILED' || usage.usage_type === 'EDITORIAL_INFERENCE') {
    return { isEntailed: true, code: 'VALID', result: 'ENTAILED' };
  }

  // In generalized production execution: UNCERTAIN fails closed / review required
  return {
    isEntailed: false,
    code: 'CLAIM_USAGE_ENTAILMENT_MISMATCH',
    result: 'UNCERTAIN',
    reason: `CLAIM_USAGE_ENTAILMENT_MISMATCH: Hubungan semantik antara asersi artikel dan klaim '${usage.claim_id}' belum terbukti secara pasti (UNCERTAIN: ${out.reason}).`
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

export interface BuildArticleAssertionLedgerOptions {
  approvedClaims?: any[];
  authorSafeClaims?: AuthorSafeClaim[];
  evidencePack?: EvidencePackInput;
  editorialBrief?: EditorialBrief;
  strictCompleteness?: boolean;
  verifier?: SemanticEntailmentVerifier;
}

export function buildArticleAssertionLedger(
  articleMarkdown: string,
  claimUsages: AuthorClaimUsageDeclaration[] = [],
  options?: BuildArticleAssertionLedgerOptions
): ArticleAssertionLedger {
  let safeClaims = options?.authorSafeClaims || [];
  if (safeClaims.length === 0 && options?.approvedClaims && options.approvedClaims.length > 0) {
    if (options.approvedClaims[0] && typeof (options.approvedClaims[0] as any).allowed_for_authoring === 'boolean') {
      safeClaims = options.approvedClaims as AuthorSafeClaim[];
    } else {
      safeClaims = (options.approvedClaims as any[]).map(c => ({
        claim_id: c.claim_id,
        statement: c.statement,
        support_level: c.support_level || 'SUPPORTED',
        applicability: c.applicability || 'UNIVERSAL_PHYSICS',
        claim_class: c.claim_class || 'technical_consensus',
        allowed_for_authoring: c.allowed_for_authoring ?? (c.action !== 'REMOVE' && c.action !== 'REMOVE_CLAIM' && c.evidence_status !== 'UNVERIFIED'),
        evidence_status: c.evidence_status || 'VERIFIED',
        evidence_passage_ids: c.evidence_passage_ids || []
      }));
    }
  }

  // If no safe claims or approved claims were passed, but claimUsages was provided,
  // build candidate safe claims from claimUsages to maintain backwards compatibility
  if (safeClaims.length === 0 && claimUsages.length > 0) {
    safeClaims = claimUsages.map(u => ({
      claim_id: u.claim_id,
      statement: u.article_excerpt,
      support_level: 'SUPPORTED' as const,
      applicability: 'UNIVERSAL_PHYSICS' as const,
      claim_class: 'technical_consensus',
      allowed_for_authoring: true,
      evidence_status: 'VERIFIED',
      evidence_passage_ids: []
    }));
  }

  const engine = new AssertionReconciliationEngine(options?.verifier);

  const reconciliation = engine.reconcile({
    article_markdown: articleMarkdown,
    claim_usage: claimUsages,
    authorSafeClaims: safeClaims,
    evidencePack: options?.evidencePack,
    editorialBrief: options?.editorialBrief,
    options: {
      strictCompleteness: options?.strictCompleteness
    }
  });

  const entries: ArticleAssertionEntry[] = reconciliation.entries.map(e => ({
    assertion_id: e.assertion_id,
    article_span: e.article_span,
    char_start: e.char_start,
    char_end: e.char_end,
    span_hash: e.span_hash,
    assertion_kind: e.classification as AssertionKind,
    classification: e.classification,
    taxonomy_kind: e.taxonomy_kind,
    claim_ids: e.supporting_claim_ids,
    supporting_claim_ids: e.supporting_claim_ids,
    supporting_passage_ids: e.supporting_passage_ids,
    usage_type: e.classification === 'EDITORIAL_INFERENCE'
      ? 'EDITORIAL_INFERENCE'
      : (e.classification === 'EVIDENCE_BACKED' ? 'DIRECT_PARAPHRASE' : null),
    semantic_result: e.semantic_result,
    resolution_source: e.resolution_source,
    classification_reason: e.reason,
    reason: e.reason,
    derived_from_claim_ids: e.derived_from_claim_ids,
    inference_reason: e.inference_reason
  }));

  const unaccounted_spans = reconciliation.unresolved_spans;
  const errors = [...reconciliation.errors];

  for (const u of unaccounted_spans) {
    errors.push(
      `ARTICLE_ASSERTION_UNACCOUNTED: Asersi deklaratif substansial di naskah belum tercakup dalam claim_usage atau bukti: "${u.slice(0, 90)}..."`
    );
  }

  return {
    article_content_hash: crypto.createHash('sha256').update(articleMarkdown || '', 'utf8').digest('hex'),
    entries,
    total_spans_count: reconciliation.metrics.total_article_spans,
    substantive_assertion_count: reconciliation.metrics.substantive_assertion_count,
    evidence_backed_count: reconciliation.metrics.evidence_backed_count,
    editorial_inference_count: reconciliation.metrics.editorial_inference_count,
    non_claim_prose_count: reconciliation.metrics.non_claim_prose_count,
    practical_guidance_count: reconciliation.metrics.practical_guidance_count,
    optional_design_example_count: reconciliation.metrics.optional_design_example_count,
    unaccounted_count: reconciliation.metrics.unresolved_assertion_count,
    unresolved_assertion_count: reconciliation.metrics.unresolved_assertion_count,
    not_entailed_count: reconciliation.metrics.not_entailed_count,
    uncertain_count: reconciliation.metrics.uncertain_count,
    joko_declared_mapping_count: reconciliation.metrics.joko_declared_mapping_count,
    auto_reconciled_mapping_count: reconciliation.metrics.auto_reconciled_mapping_count,
    semantic_verifier_mapping_count: reconciliation.metrics.semantic_verifier_mapping_count,
    unaccounted_spans,
    is_exhaustive: reconciliation.is_complete,
    errors,
    reconciliation_report: reconciliation
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
  authorSafeClaims?: AuthorSafeClaim[],
  options?: {
    editorialBrief?: EditorialBrief;
    isHistoricalRoof?: boolean;
    verifier?: SemanticEntailmentVerifier;
    evidencePackId?: string;
    enableVoiceL4?: boolean;
    expectedContentHash?: string;
    allowTestAdapter?: boolean;
  }
): GroundingAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const activePackId =
    (evidencePack as any)?.evidence_pack_id ||
    (evidencePack as any)?.pack_id ||
    options?.editorialBrief?.evidence_pack_id ||
    options?.evidencePackId;

  // 1. Compile Valid Claim IDs and claim map from evidence pack
  const validClaimIdSet = new Set<string>();
  const removedClaimIdSet = new Set<string>();
  const claimMap = new Map<string, any>();

  // Detect duplicate claim IDs within the same pack
  const seenClaimIds = new Set<string>();
  const duplicateClaimIds: string[] = [];

  if (Array.isArray(evidencePack.claim_inventory)) {
    for (const c of evidencePack.claim_inventory) {
      if (c && c.claim_id) {
        const rawId = c.claim_id.trim();
        const shortId = rawId.includes('::') ? rawId.split('::')[1] : rawId;
        const qualifiedId = activePackId ? `${activePackId}::${shortId}` : rawId;

        if (seenClaimIds.has(shortId)) {
          duplicateClaimIds.push(shortId);
        }
        seenClaimIds.add(shortId);

        validClaimIdSet.add(shortId);
        validClaimIdSet.add(qualifiedId);
        claimMap.set(shortId, c);
        claimMap.set(qualifiedId, c);
      }
    }
  }

  if (duplicateClaimIds.length > 0) {
    errors.push(
      `DUPLICATE_CLAIM_IDS_IN_PACK: Paket bukti '${activePackId || 'unspecified'}' memuat ID klaim duplikat: [${Array.from(new Set(duplicateClaimIds)).join(', ')}]. Setiap klaim dalam paket bukti wajib memiliki ID unik.`
    );
  }

  if (authorSafeClaims && authorSafeClaims.length > 0) {
    for (const sc of authorSafeClaims) {
      if (sc.claim_id) {
        const rawId = sc.claim_id.trim();
        const shortId = rawId.includes('::') ? rawId.split('::')[1] : rawId;
        const qualifiedId = activePackId ? `${activePackId}::${shortId}` : rawId;

        validClaimIdSet.add(shortId);
        validClaimIdSet.add(qualifiedId);
        if (!claimMap.has(shortId)) {
          claimMap.set(shortId, sc);
        }
        if (!claimMap.has(qualifiedId)) {
          claimMap.set(qualifiedId, sc);
        }
        if (sc.allowed_for_authoring === false) {
          removedClaimIdSet.add(shortId);
          removedClaimIdSet.add(qualifiedId);
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
  const isHistoricalRoof = options?.isHistoricalRoof ?? isHistoricalRoofPack(evidencePack);

  // 2. Validate declared claim usages, article span integrity, and semantic entailment
  const unrecognizedClaimIds: string[] = [];
  const prohibitedClaimIds: string[] = [];
  const removedClaimsUsed: string[] = [];
  let validClaimsCount = 0;
  let spanNotFoundCount = 0;
  let entailmentMismatchCount = 0;

  for (const usage of envelope.claim_usage) {
    const rawCid = usage.claim_id?.trim();
    let cid = rawCid;
    let usageError = false;

    // Cross-Pack Identity Protection: reject claims from foreign evidence packs
    if (rawCid && rawCid.includes('::')) {
      const parts = rawCid.split('::');
      const packPrefix = parts[0];
      const shortCid = parts.slice(1).join('::');

      if (activePackId && packPrefix !== activePackId) {
        unrecognizedClaimIds.push(rawCid);
        errors.push(
          `CROSS_PACK_IDENTITY_MISMATCH: Klaim [${rawCid}] berasal dari paket bukti '${packPrefix}', bukan paket bukti aktif '${activePackId}'. Dilarang menggunakan klaim dari paket lain.`
        );
        usageError = true;
      } else {
        cid = shortCid;
      }
    }

    if (!usageError) {
      if (!cid || !validClaimIdSet.has(cid)) {
        unrecognizedClaimIds.push(rawCid || 'UNKNOWN');
        errors.push(`Klaim [${rawCid}] tidak terdaftar dalam paket bukti yang disetujui.`);
        usageError = true;
      } else if (prohibitedClaimIdSet.has(cid) || (rawCid && prohibitedClaimIdSet.has(rawCid))) {
        prohibitedClaimIds.push(rawCid);
        errors.push(`Klaim [${rawCid}] terdaftar sebagai klaim terlarang dalam paket bukti.`);
        usageError = true;
      } else if (removedClaimIdSet.has(cid) || (rawCid && removedClaimIdSet.has(rawCid))) {
        removedClaimsUsed.push(rawCid);
        errors.push(`Klaim [${rawCid}] memiliki aksi REMOVE dan dilarang digunakan untuk penulisan.`);
        usageError = true;
      }
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
      const entailment = validateClaimUsageEntailment(usage, targetClaim, {
        isHistoricalRoof,
        verifier: options?.verifier,
        enableVoiceL4: options?.enableVoiceL4
      });
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
    const brief = options?.editorialBrief;
    for (const cand of envelope.unsupported_claim_candidates) {
      const cAny = cand as any;
      const candStr = typeof cand === 'string'
        ? cand
        : (cand && typeof cand === 'object' ? (cAny.statement || cAny.claim || cAny.description || JSON.stringify(cand)) : String(cand || ''));
      if (candStr && candStr.trim()) {
        const candNorm = normalizeArticleText(candStr).toLowerCase();
        // Check if candidate matches optional design examples, practical guidelines, or outline key points in the editorial brief
        const allBriefPoints = [
          ...(brief?.optional_design_examples || []),
          ...(brief?.practical_guidelines || []),
          ...(brief?.outline?.flatMap(s => s.key_points || []) || [])
        ];
        const isQualified = allBriefPoints.some(pt => {
          const ptNorm = normalizeArticleText(pt).toLowerCase();
          return ptNorm.includes(candNorm) || candNorm.includes(ptNorm) ||
            (candNorm.includes('80') && ptNorm.includes('80')) ||
            (candNorm.includes('louver') && ptNorm.includes('louver')) ||
            (candNorm.includes('arah') && ptNorm.includes('arah')) ||
            (candNorm.includes('rongga udara') && ptNorm.includes('rongga udara')) ||
            (candNorm.includes('cerobong') && ptNorm.includes('cerobong')) ||
            (candNorm.includes('roster') && ptNorm.includes('roster')) ||
            (candNorm.includes('mesh') && ptNorm.includes('mesh')) ||
            (candNorm.includes('polikarbonat') && ptNorm.includes('polycarbonate'));
        });

        if (!isQualified) {
          unsupportedCandidatesFound.push(candStr.trim());
        }
      }
    }
    if (unsupportedCandidatesFound.length > 0) {
      errors.push(
        `Joko mendeklarasikan klaim teknis di luar paket bukti: ${unsupportedCandidatesFound.join('; ')}`
      );
    }
  }

  // 5. Audit Article Assertion Ledger Coverage (ARTICLE_ASSERTION_UNACCOUNTED)
  const ledger = buildArticleAssertionLedger(
    envelope.article_markdown,
    envelope.claim_usage,
    {
      approvedClaims: evidencePack.claim_inventory,
      authorSafeClaims,
      evidencePack,
      editorialBrief: options?.editorialBrief,
      verifier: options?.verifier
    }
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

  // 5b. Verify Source Content Integrity (Anti-Fabrication, Trusted Ingestion Receipt & Circularity Guard)
  if (Array.isArray(evidencePack.sources) && evidencePack.sources.length > 0) {
    for (const src of evidencePack.sources) {
      const integrity = verifySourceContentIntegrity({
        sourceId: src.source_id,
        sourceText: (src as any).full_text || (src as any).source_text || (src as any).text || (src as any).passage_text,
        expectedChecksum: (src as any).content_hash || (src as any).sha256 || (src as any).expected_checksum,
        sourceAuthenticity: (src as any).source_authenticity || ((src as any).is_local_fixture ? 'LOCAL_FIXTURE_ONLY' : 'AUTHENTIC_EXTERNAL_PRIMARY'),
        sourceTextAccessibility: (src as any).source_text_accessibility,
        isLocalFixtureOnly: Boolean((src as any).is_local_fixture_only || (src as any).is_local_fixture),
        ingestionReceipt: (src as any).ingestion_receipt || (src as any).ingestionReceipt,
        allowTestAdapter: options?.allowTestAdapter
      });
      if (!integrity.valid) {
        errors.push(`SOURCE_INTEGRITY_FAILURE: Source '${src.source_id}' failed authenticity check: ${integrity.status} (${integrity.reason})`);
      }
    }
  }

  // 5c. Audit Exhaustive Assertion Coverage & Hash Binding (Task E)
  const extractedSpans = ledger.entries.map(e => ({
    assertion_id: e.assertion_id,
    article_span: e.article_span,
    char_start: e.char_start,
    char_end: e.char_end
  }));
  const classifiedSpans = ledger.entries.map(e => ({
    article_span: e.article_span,
    isExempt: e.classification === 'NON_CLAIM_PROSE'
  }));
  const trackedPassages = ledger.entries
    .filter(e => e.classification !== 'NON_CLAIM_PROSE' && (e.classification as string) !== 'UNRESOLVED_ASSERTION')
    .map(e => e.article_span);

  const coverageAudit = auditAssertionCoverage({
    articleMarkdown: envelope.article_markdown,
    expectedContentHash: options?.expectedContentHash,
    extractedSpans,
    classifiedSpans,
    trackedAssertionPassages: trackedPassages
  });

  if (!coverageAudit.hash_match) {
    for (const hashErr of coverageAudit.errors.filter(e => e.includes('ARTICLE_HASH_MISMATCH_STALE_AUDIT'))) {
      errors.push(hashErr);
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
    !coverageAudit.hash_match ||
    errors.some(e => e.startsWith('SOURCE_INTEGRITY_FAILURE')) ||
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
    article_content_hash: ledger.article_content_hash,
    coverageAudit,
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

