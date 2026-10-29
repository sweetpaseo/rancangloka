/**
 * RancangLoka Hermes Editorial — Grounded Citations Source Provenance Verifier
 * Milestone: SKILL-ADOPTION-MILESTONE-1 & PRODUCTION-GROUNDING-GATE-HARDENING
 *
 * Core Principles:
 * 1. SEMANTIC ENTAILMENT DOES NOT REQUIRE VERBATIM QUOTATION:
 *    A primary source sentence may fully support a naturally paraphrased Indonesian assertion.
 * 2. SEPARATION OF CONCERNS (6 Orthogonal Domains):
 *    - Source Authenticity (External primary vs local mock fixture)
 *    - Source Text Accessibility (Digitally verified vs physical book offline)
 *    - Quotation Authenticity (Verbatim vs translated/independent paraphrase vs fabricated)
 *    - Claim Semantic Support (ENTAILED, PARTIALLY_SUPPORTED, UNVERIFIED, CONTRADICTED, REVIEW_REQUIRED)
 *    - Climate & Building Typology Applicability (Tropical residential vs commercial baseline vs CFD simulation)
 *    - Editorial Approval Gate (Approved vs Hold Retained vs Blocked)
 * 3. NO AUTOMATIC PRESUMPTIONS:
 *    - Verbatim quote != ENTAILED
 *    - Paraphrase != PARTIALLY_SUPPORTED
 *    - Genuine source != Relevant
 *    - Valid SHA-256 != Authentic external primary document
 * 4. ASSERTION COVERAGE & CONTENT HASH BINDING:
 *    - Audits are bound to exact article-content SHA-256 hash. Stale audits fail closed.
 *    - Substantive declarative spans without traceable evidence are flagged.
 */

import crypto from 'node:crypto';
import {
  evaluateBilingualPropositionEntailment,
  parseSpelledOutNumbers,
  extractStructuredNumbers
} from './bilingual-normalizer.ts';
import {
  type TrustedIngestionReceipt,
  type IngestionRetrievalMethod,
  type PhysicalBookInspectionRecord,
  verifyTrustedIngestionReceipt,
  issueTrustedIngestionReceipt,
  issueManualBookInspectionReceipt
} from './trusted-ingestion-receipt.ts';

export {
  type TrustedIngestionReceipt,
  type IngestionRetrievalMethod,
  type PhysicalBookInspectionRecord,
  verifyTrustedIngestionReceipt,
  issueTrustedIngestionReceipt,
  issueManualBookInspectionReceipt
};

export const INVARIANT_SOURCE_EXCERPT_IS_LITERAL = 'SOURCE_EXCERPT_IS_LITERAL';
export const INVARIANT_AUTHOR_SAFE_CLAIM_MAY_BE_PARAPHRASED = 'AUTHOR_SAFE_CLAIM_MAY_BE_PARAPHRASED';
export const INVARIANT_PUBLIC_ARTICLE_MAY_BE_NATURAL_LANGUAGE_PARAPHRASE = 'PUBLIC_ARTICLE_MAY_BE_NATURAL_LANGUAGE_PARAPHRASE';
export const INVARIANT_CLAIM_STRENGTH_MUST_NOT_EXCEED_SOURCE_EVIDENCE = 'CLAIM_STRENGTH_MUST_NOT_EXCEED_SOURCE_EVIDENCE';

// ============================================================================
// 1. ORTHOGONAL VERIFICATION ENUMS & TYPES
// ============================================================================

export type SourceAuthenticity =
  | 'AUTHENTIC_EXTERNAL_PRIMARY'      // e.g. official national standard (BSN), official decree
  | 'AUTHENTIC_GOVERNMENT_REGULATION' // e.g. ministerial regulation (PUPR)
  | 'AUTHENTIC_PEER_REVIEWED'         // peer-reviewed journal article (ARTEKS, RISA)
  | 'AUTHENTIC_ENCYCLOPEDIC'          // public consensus physics reference (Wikipedia Physics)
  | 'LOCAL_FIXTURE_ONLY'              // internal test/mock fixture authored locally in repo
  | 'UNAUTHENTIC_OR_REJECTED';        // blacklisted/irrelevant/fabricated source

export type SourceTextAccessibility =
  | 'DIGITALLY_ACCESSIBLE'            // full source text or verified passage cache accessible
  | 'PHYSICAL_BOOK_OFFLINE'           // printed textbook without local digital cache (honest limitation)
  | 'ACCESSIBLE_ONLINE_ONLY'          // URL known, but text not cached locally
  | 'SOURCE_TEXT_UNAVAILABLE';        // cannot be accessed or verified

export type QuotationAuthenticity =
  | 'VERBATIM_CONFIRMED'              // exact quote found in authentic source text
  | 'TRANSLATED_PARAPHRASE'           // valid translation/paraphrase from foreign-language source
  | 'INDEPENDENT_PARAPHRASE'          // original natural language authoring without claiming quote
  | 'FABRICATED_QUOTE_REJECTED'       // claimed quote does NOT exist in source text snapshot
  | 'NO_QUOTE_CLAIMED';               // no verbatim quote claimed

export type ClaimSemanticSupportStatus =
  | 'ENTAILED'                        // source proposition directly and fully entails the assertion
  | 'PARTIALLY_SUPPORTED'             // source supports general principle or part of claim, but not all clauses/extrapolations
  | 'UNVERIFIED'                      // no valid source evidence supports the claim
  | 'CONTRADICTED'                    // claim contradicts the source evidence, or makes unsupported absolute claims
  | 'REVIEW_REQUIRED';                // nuanced/ambiguous proposition requiring human/expert evaluation

export type ClimateBuildingApplicability =
  | 'DIRECTLY_APPLICABLE_TROPICAL_RESIDENTIAL'  // directly applies to Indonesian tropical landed homes
  | 'ANALOGY_BASELINE_COMMERCIAL'              // applies to commercial/conditioned buildings, baseline analogy
  | 'COMPUTATIONAL_SIMULATION_RESIDENTIAL'     // CFD/energy simulation of residential building
  | 'INAPPLICABLE_CLIMATE_OR_TYPOLOGY';        // temperate/subtropical/industrial/military context

export type EditorialGateStatus =
  | 'APPROVED'
  | 'HOLD_RETAINED'
  | 'BLOCKED';

// Legacy status for backwards compatibility with SKILL-ADOPTION-MILESTONE-1
export type SourceVerificationStatus =
  | 'VERIFIED_LITERAL'
  | 'SOURCE_TEXT_NOT_AVAILABLE_FOR_LITERAL_VERIFICATION'
  | 'METADATA_MISMATCH'
  | 'EXCERPT_NOT_FOUND'
  | 'CLAIM_STRENGTH_EXCEEDED';

export interface SourceProvenanceRecord {
  source_id: string;
  canonical_url?: string | null;
  doi?: string | null;
  standard_identifier?: string | null;
  title: string;
  authors: string[];
  publisher_or_authority: string;
  year: number;
  volume_issue?: string | null;
  page_range?: string | null;
  retrieved_source_excerpt?: string | null;
  source_excerpt_location?: string | null;
  verification_status: SourceVerificationStatus;
  status_reason?: string;
  supported_claims?: string[];
  // Hardened provenance extensions
  source_authenticity?: SourceAuthenticity;
  source_text_accessibility?: SourceTextAccessibility;
  content_hash?: string | null;
}

export interface ClaimProvenanceLink {
  claim_id: string;
  source_id: string;
  verbatim_source_excerpt: string | null;
  author_safe_claim: string;
  article_paraphrase?: string | null;
  claim_strength_valid: boolean;
  rejection_reason?: string | null;
  // Hardened entailment extensions
  semantic_support?: ClaimSemanticSupportStatus;
  quotation_authenticity?: QuotationAuthenticity;
  applicability?: ClimateBuildingApplicability;
}

export interface SourceVerificationLedger {
  ledger_id: string;
  article_topic: string;
  created_at: string;
  updated_at: string;
  audited_by: 'irwan_evidence_researcher_lead' | string;
  article_content_hash?: string;
  sources: SourceProvenanceRecord[];
  claim_links: ClaimProvenanceLink[];
  summary: {
    total_sources: number;
    verified_literal_count: number;
    text_unavailable_count: number;
    mismatch_count: number;
    all_critical_sources_pass: boolean;
    entailed_count?: number;
    partially_supported_count?: number;
    unverified_count?: number;
    contradicted_count?: number;
    review_required_count?: number;
  };
}

// ============================================================================
// 2. RELIABLE EVIDENCE RECORD (Task C)
// ============================================================================

export interface ReliableEvidenceRecord {
  source_id: string;
  canonical_url: string | null;
  doi?: string | null;
  standard_identifier?: string | null;
  publisher_or_authority: string;
  document_title: string;
  edition_or_year: number | string;
  retrieval_method: 'AUTOMATED_DISCOVERY' | 'MANUAL_CURATION' | 'LEGAL_REGISTRY' | 'PHYSICAL_LIBRARY' | 'LOCAL_FIXTURE';
  retrieval_timestamp: string;
  raw_source_artifact_path?: string | null;
  content_hash?: string | null;
  immutable_snapshot_id?: string | null;
  exact_locator: string; // e.g. "Lampiran II Hal. Cetak 106", "Pasal 4.3.5"
  source_authenticity: SourceAuthenticity;
  source_text_accessibility: SourceTextAccessibility;
  verified_quotation?: string | null;
  quotation_authenticity: QuotationAuthenticity;
  assertion_id: string;
  claim_semantic_support: ClaimSemanticSupportStatus;
  building_climate_applicability: ClimateBuildingApplicability;
  applicability_notes?: string;
  verification_method: 'DETERMINISTIC_PROPOSITION_EVALUATOR' | 'HUMAN_EXPERT_REVIEW' | 'FIXTURE_AUDIT';
  reviewer_provenance: string;
}

// ============================================================================
// 3. ASSERTION COVERAGE AUDIT DATA CONTRACT (Task E)
// ============================================================================

export interface AssertionCoverageAuditResult {
  article_content_hash: string;
  total_spans_extracted: number;
  substantive_assertion_count: number;
  covered_assertions_count: number;
  untraceable_spans: string[];
  coverage_ratio: number;
  is_exhaustively_covered: boolean;
  hash_match: boolean;
  errors: string[];
}

// ============================================================================
// 4. CORE UTILITY & METADATA VERIFICATION FUNCTIONS
// ============================================================================

export function computeArticleContentHash(content: string): string {
  return crypto.createHash('sha256').update(content || '', 'utf8').digest('hex');
}

export function normalizeForLiteralComparison(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies that candidate metadata strictly matches canonical expected metadata.
 */
export function verifySourceMetadata(
  expected: {
    authors?: string[];
    year?: number;
    page_range?: string | null;
    doi?: string | null;
    canonical_url?: string | null;
  },
  candidate: {
    authors?: string[];
    year?: number;
    page_range?: string | null;
    doi?: string | null;
    canonical_url?: string | null;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Author verification
  if (expected.authors && candidate.authors) {
    const normExpected = expected.authors.map((a) => a.toLowerCase().trim()).sort();
    const normCandidate = candidate.authors.map((a) => a.toLowerCase().trim()).sort();
    const match =
      normExpected.length === normCandidate.length &&
      normExpected.every((val, idx) => normCandidate[idx] === val);
    if (!match) {
      errors.push(`AUTHOR_MISMATCH: Expected [${expected.authors.join(', ')}], found [${candidate.authors.join(', ')}]`);
    }
  }

  // 2. Year verification
  if (expected.year !== undefined && candidate.year !== undefined) {
    if (expected.year !== candidate.year) {
      errors.push(`YEAR_MISMATCH: Expected ${expected.year}, found ${candidate.year}`);
    }
  }

  // 3. Page range verification
  if (expected.page_range && candidate.page_range) {
    const cleanExp = expected.page_range.replace(/\s+/g, '').toLowerCase();
    const cleanCand = candidate.page_range.replace(/\s+/g, '').toLowerCase();
    if (cleanExp !== cleanCand) {
      errors.push(`PAGE_RANGE_MISMATCH: Expected '${expected.page_range}', found '${candidate.page_range}'`);
    }
  }

  // 4. DOI verification
  if (expected.doi && candidate.doi) {
    const cleanExp = expected.doi.replace(/^https?:\/\/doi\.org\//i, '').trim().toLowerCase();
    const cleanCand = candidate.doi.replace(/^https?:\/\/doi\.org\//i, '').trim().toLowerCase();
    if (cleanExp !== cleanCand) {
      errors.push(`DOI_MISMATCH: Expected '${expected.doi}', found '${candidate.doi}'`);
    }
  }

  // 5. Canonical URL verification
  if (expected.canonical_url && candidate.canonical_url) {
    const cleanExp = expected.canonical_url.replace(/\/+$/, '').toLowerCase();
    const cleanCand = candidate.canonical_url.replace(/\/+$/, '').toLowerCase();
    if (cleanExp !== cleanCand) {
      errors.push(`URL_MISMATCH: Expected '${expected.canonical_url}', found '${candidate.canonical_url}'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Verifies whether a source excerpt literally exists in raw source document text.
 */
export function verifyLiteralExcerpt(
  excerpt: string | null | undefined,
  rawSourceText: string | null | undefined
): { status: SourceVerificationStatus; reason?: string } {
  if (!rawSourceText || rawSourceText.trim().length === 0) {
    return {
      status: 'SOURCE_TEXT_NOT_AVAILABLE_FOR_LITERAL_VERIFICATION',
      reason: 'Raw source document text is not cached locally for literal substring verification'
    };
  }

  if (!excerpt || excerpt.trim().length === 0) {
    return {
      status: 'EXCERPT_NOT_FOUND',
      reason: 'No excerpt provided to verify'
    };
  }

  const normExcerpt = normalizeForLiteralComparison(excerpt);
  const normDoc = normalizeForLiteralComparison(rawSourceText);

  if (normDoc.includes(normExcerpt)) {
    return {
      status: 'VERIFIED_LITERAL'
    };
  }

  return {
    status: 'EXCERPT_NOT_FOUND',
    reason: `Excerpt not found verbatim in source document: '${excerpt}'`
  };
}

// Exaggerated claim patterns that exceed hedged scientific source evidence
const EXAGGERATED_STRENGTH_PATTERNS = [
  /\bturun drastis\b/i,
  /\bpasti menghilangkan\b/i,
  /\bpanas(?:\s+\w+)?\s+tidak bisa masuk\b/i,
  /\btidak bisa masuk sama sekali\b/i,
  /\bpanas(?:\s+\w+)?\s+tidak sempat merambat\b/i,
  /\b100% (?:bebas|dingin|hilang|eliminasi)\b/i,
  /\bmutlak efektif\b/i,
  /\btanpa ada panas sedikitpun\b/i,
  /\bmenjamin tagihan listrik.*(?:turun tepat|bebas biaya)\b/i,
  /\bsuhu.*pasti turun \d+°?c secara mutlak\b/i
];

/**
 * Validates that claim strength does not exceed the evidence bounded in the source excerpt.
 */
export function validateClaimStrengthBound(
  sourceExcerpt: string | null | undefined,
  authorSafeClaim: string,
  articleParaphrase?: string | null
): { valid: boolean; reason?: string } {
  for (const pattern of EXAGGERATED_STRENGTH_PATTERNS) {
    if (pattern.test(authorSafeClaim)) {
      return {
        valid: false,
        reason: `Author-safe claim contains unhedged exaggeration exceeding source evidence: matches ${pattern.toString()}`
      };
    }
  }

  if (articleParaphrase) {
    for (const pattern of EXAGGERATED_STRENGTH_PATTERNS) {
      if (pattern.test(articleParaphrase)) {
        return {
          valid: false,
          reason: `Article paraphrase contains unhedged exaggeration exceeding source evidence: matches ${pattern.toString()}`
        };
      }
    }
  }

  return { valid: true };
}

// ============================================================================
// 5. HARDENED CONTENT INTEGRITY & AUTHENTICITY VERIFICATION (Task A & C)
// ============================================================================

/**
 * Verifies source document content integrity:
 * - Differentiates external primary sources from local test fixtures.
 * - Prevents circular verification (local fixture != independent source).
 * - Verifies cryptographic content hash if provided.
 */
export interface SourceContentIntegrityInput {
  sourceId?: string;
  sourceText?: string | null;
  expectedChecksum?: string | null;
  sourceAuthenticity: SourceAuthenticity;
  sourceTextAccessibility?: SourceTextAccessibility;
  isLocalFixtureOnly?: boolean;
  ingestionReceipt?: TrustedIngestionReceipt | null;
  allowTestAdapter?: boolean;
}

export function verifySourceContentIntegrity(input: SourceContentIntegrityInput): {
  valid: boolean;
  status: string;
  reason?: string;
  computedChecksum?: string;
  receiptId?: string;
  receipt?: TrustedIngestionReceipt;
} {
  // Guard 1: Local test fixture circularity
  if (input.isLocalFixtureOnly || input.sourceAuthenticity === 'LOCAL_FIXTURE_ONLY') {
    if (input.allowTestAdapter === true && input.ingestionReceipt?.retrieval_method === 'ISOLATED_TEST_ADAPTER') {
      const rcptCheck = verifyTrustedIngestionReceipt(input.ingestionReceipt, {
        expectedSourceId: input.sourceId,
        expectedSourceText: input.sourceText,
        allowTestAdapter: true
      });
      if (rcptCheck.valid) {
        const computedChecksum = input.sourceText
          ? crypto.createHash('sha256').update(input.sourceText.trim(), 'utf8').digest('hex')
          : undefined;
        return {
          valid: true,
          status: 'TEST_ADAPTER_PROVENANCE_VERIFIED',
          reason: 'Source verified under explicitly authorized isolated test adapter (NOT external evidence)',
          computedChecksum,
          receiptId: input.ingestionReceipt.receipt_id
        };
      }
    }
    return {
      valid: false,
      status: 'REJECTED_FIXTURE_CIRCULARITY',
      reason: 'Source text originates from a locally authored test fixture, not an independently retrieved external source'
    };
  }

  // Guard 2: Physical book offline authentication
  if (input.sourceTextAccessibility === 'PHYSICAL_BOOK_OFFLINE') {
    if (input.ingestionReceipt && input.ingestionReceipt.retrieval_method === 'AUTHENTICATED_HUMAN_INSPECTION') {
      const rcptCheck = verifyTrustedIngestionReceipt(input.ingestionReceipt, {
        expectedSourceId: input.sourceId,
        expectedSourceText: input.sourceText,
        allowTestAdapter: input.allowTestAdapter
      });
      if (!rcptCheck.valid) {
        return {
          valid: false,
          status: rcptCheck.status,
          reason: `Physical book inspection receipt invalid: ${rcptCheck.reason}`
        };
      }
      return {
        valid: true,
        status: 'AUTHENTIC_PHYSICAL_INSPECTION_VERIFIED',
        receiptId: input.ingestionReceipt.receipt_id
      };
    }
    return {
      valid: false,
      status: 'UNVERIFIED_PHYSICAL_BOOK',
      reason: 'Physical book offline lacks authenticated manual inspection record signed by authorized reviewer'
    };
  }

  // Guard 3: External source authenticity trust boundary
  const isExternalAuthenticClaim =
    input.sourceAuthenticity === 'AUTHENTIC_EXTERNAL_PRIMARY' ||
    input.sourceAuthenticity === 'AUTHENTIC_GOVERNMENT_REGULATION' ||
    input.sourceAuthenticity === 'AUTHENTIC_PEER_REVIEWED' ||
    input.sourceAuthenticity === 'AUTHENTIC_ENCYCLOPEDIC';

  if (isExternalAuthenticClaim) {
    if (!input.ingestionReceipt) {
      return {
        valid: false,
        status: 'MISSING_INGESTION_RECEIPT',
        reason: `External source '${input.sourceId || 'unspecified'}' claims ${input.sourceAuthenticity} but lacks trusted ingestion receipt proving authentic retrieval`
      };
    }

    const rcptCheck = verifyTrustedIngestionReceipt(input.ingestionReceipt, {
      expectedSourceId: input.sourceId,
      expectedSourceText: input.sourceText,
      allowTestAdapter: input.allowTestAdapter
    });

    if (!rcptCheck.valid) {
      return {
        valid: false,
        status: rcptCheck.status,
        reason: `Trusted ingestion receipt verification failed: ${rcptCheck.reason}`
      };
    }
  }

  // Guard 4: Source content availability
  if (!input.sourceText || input.sourceText.trim().length === 0) {
    return {
      valid: false,
      status: 'SOURCE_TEXT_UNAVAILABLE',
      reason: 'Primary document text is unavailable locally for content hashing'
    };
  }

  // Guard 5: Cryptographic checksum match
  const computedChecksum = crypto.createHash('sha256').update(input.sourceText.trim(), 'utf8').digest('hex');
  if (input.expectedChecksum) {
    const cleanExpected = input.expectedChecksum.trim().toLowerCase();
    if (computedChecksum.toLowerCase() !== cleanExpected) {
      return {
        valid: false,
        status: 'CHECKSUM_MISMATCH',
        reason: `Source content hash mismatch: computed ${computedChecksum}, expected ${cleanExpected}`,
        computedChecksum
      };
    }
  }

  return {
    valid: true,
    status: 'AUTHENTIC_CONTENT_VERIFIED',
    computedChecksum,
    receiptId: input.ingestionReceipt?.receipt_id,
    receipt: input.ingestionReceipt || undefined
  };
}

// ============================================================================
// 6. ENTAILMENT MODEL: INDEPENDENT SEMANTIC EVALUATION (Task A & D)
// ============================================================================

export interface SemanticEntailmentEvaluationInput {
  assertionText: string;
  sourceProposition: string;
  sourceTextAccessibility: SourceTextAccessibility;
  buildingClimateApplicability: ClimateBuildingApplicability;
  isDirectProof?: boolean;
  hasExtrapolation?: boolean;
  citedLocator?: string;
  validLocators?: string[];
  claimedQuotation?: string | null;
  sourceText?: string | null;
}

export interface SemanticEntailmentEvaluationOutput {
  status: ClaimSemanticSupportStatus;
  quotationAuthenticity: QuotationAuthenticity;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  blockers: string[];
}

/**
 * Hardened Semantic Entailment Evaluator.
 * Core Principle (Owner Directive):
 * SEMANTIC ENTAILMENT DOES NOT REQUIRE VERBATIM QUOTATION.
 * A source may fully support a naturally paraphrased Indonesian article sentence.
 *
 * Enforces:
 * - Quote match != ENTAILED
 * - Natural Indonesian paraphrase CAN BE ENTAILED if proposition truth conditions are met.
 * - Unhedged numerical/absolute claims -> CONTRADICTED.
 * - Missing source content -> UNVERIFIED / REVIEW_REQUIRED (no fabrication).
 * - Misapplied commercial standard to mandatory residential PBG -> CONTRADICTED.
 * - Ambiguous / unverified -> REVIEW_REQUIRED (fail-closed).
 */
export function evaluateEvidenceEntailment(
  input: SemanticEntailmentEvaluationInput
): SemanticEntailmentEvaluationOutput {
  const blockers: string[] = [];
  const assertion = (input.assertionText || '').trim();
  const sourceProp = (input.sourceProposition || '').trim();

  // 1. Evaluate Quotation Authenticity
  let quoteAuth: QuotationAuthenticity = 'NO_QUOTE_CLAIMED';
  if (input.claimedQuotation && input.claimedQuotation.trim().length > 0) {
    const qClean = input.claimedQuotation.trim();
    if (!input.sourceText || input.sourceText.trim().length === 0) {
      quoteAuth = input.sourceTextAccessibility === 'PHYSICAL_BOOK_OFFLINE'
        ? 'INDEPENDENT_PARAPHRASE'
        : 'FABRICATED_QUOTE_REJECTED';
    } else {
      const normQ = normalizeForLiteralComparison(qClean);
      const normSrc = normalizeForLiteralComparison(input.sourceText);
      if (normSrc.includes(normQ)) {
        quoteAuth = 'VERBATIM_CONFIRMED';
      } else {
        quoteAuth = 'FABRICATED_QUOTE_REJECTED';
        blockers.push(`Claimed quotation "${qClean.slice(0, 50)}..." not found verbatim in source text`);
      }
    }
  } else {
    quoteAuth = 'INDEPENDENT_PARAPHRASE';
  }

  // 2. Evaluate Locator Accuracy
  if (input.citedLocator && input.validLocators && input.validLocators.length > 0) {
    const locMatch = input.validLocators.some(validLoc => input.citedLocator!.includes(validLoc));
    if (!locMatch) {
      blockers.push(`Locator mismatch: cited '${input.citedLocator}', but valid locations are [${input.validLocators.join(', ')}]`);
    }
  }

  // 3. Evaluate Building & Climate Typology Applicability
  if (input.buildingClimateApplicability === 'INAPPLICABLE_CLIMATE_OR_TYPOLOGY') {
    return {
      status: 'CONTRADICTED',
      quotationAuthenticity: quoteAuth,
      confidence: 'HIGH',
      reason: 'Source evidence originates from inapplicable climate or non-building typology (e.g. military/aerospace/subtropical heating)',
      blockers: ['INAPPLICABLE_TYPOLOGY_MISMATCH']
    };
  }

  // Guard against misapplied commercial standards as mandatory residential PBG regulations
  if (input.buildingClimateApplicability === 'ANALOGY_BASELINE_COMMERCIAL') {
    const mandatoryRegex = /\b(?:wajib.*izin pbg|mandat pbg|syarat mutlak pbg rumah tapak|harus memiliki sertifikat pbg)\b/i;
    if (mandatoryRegex.test(assertion)) {
      return {
        status: 'CONTRADICTED',
        quotationAuthenticity: quoteAuth,
        confidence: 'HIGH',
        reason: 'Commercial conditioned building standard (SNI 6389:2020) falsely asserted as mandatory PBG permit for residential landed houses',
        blockers: ['MISAPPLIED_BUILDING_TYPOLOGY']
      };
    }
  }

  // 4. Evaluate Extrapolations & Unhedged Absolute Claims
  const hasExtrapolation = input.hasExtrapolation || EXAGGERATED_STRENGTH_PATTERNS.some(p => p.test(assertion));
  if (hasExtrapolation) {
    return {
      status: 'CONTRADICTED',
      quotationAuthenticity: quoteAuth,
      confidence: 'HIGH',
      reason: 'Assertion extrapolates source evidence into unhedged absolute performance claims (e.g. 100% heat elimination or exact numerical savings)',
      blockers: ['UNSUPPORTED_EXTRAPOLATION_DETECTED']
    };
  }

  // 5. Evaluate Source Accessibility Limitation
  if (input.sourceTextAccessibility === 'SOURCE_TEXT_UNAVAILABLE') {
    return {
      status: 'UNVERIFIED',
      quotationAuthenticity: quoteAuth,
      confidence: 'HIGH',
      reason: 'Source document text is unavailable and cannot support factual claims',
      blockers: ['SOURCE_TEXT_UNAVAILABLE']
    };
  }

  if (input.sourceTextAccessibility === 'PHYSICAL_BOOK_OFFLINE') {
    // Physical book offline: primary document is inaccessible/unverified in repository and cannot independently substantiate a factual assertion
    return {
      status: 'UNVERIFIED',
      quotationAuthenticity: quoteAuth,
      confidence: 'LOW',
      reason: 'Physical book offline: primary document text is inaccessible and unverified in repository; cannot independently substantiate factual assertion without verified primary passage',
      blockers: ['OFFLINE_BOOK_UNVERIFIED_IN_REPOSITORY']
    };
  }

  // 6. Proposition Semantic Entailment Evaluation
  // Evaluate proposition support (using bilingual normalizer if available)
  if (!sourceProp || sourceProp.trim().length === 0) {
    return {
      status: 'UNVERIFIED',
      quotationAuthenticity: quoteAuth,
      confidence: 'HIGH',
      reason: 'No source proposition provided for semantic evaluation',
      blockers: ['MISSING_SOURCE_PROPOSITION']
    };
  }

  // Check proposition-level semantic match
  const propEval = evaluateBilingualPropositionEntailment(assertion, sourceProp);

  if (propEval.result === 'NOT_ENTAILED' || propEval.hasUnresolvedConflict) {
    return {
      status: propEval.hasUnresolvedConflict ? 'CONTRADICTED' : 'UNVERIFIED',
      quotationAuthenticity: quoteAuth,
      confidence: propEval.confidence,
      reason: `Semantic mismatch or conflict: ${propEval.reason}`,
      blockers: [propEval.hasUnresolvedConflict ? 'SEMANTIC_CONTRADICTION' : 'SEMANTIC_NOT_ENTAILED']
    };
  }

  if (input.isDirectProof === false) {
    // Evidence is on related topic / background, but does not directly prove the multifaceted proposition
    return {
      status: 'PARTIALLY_SUPPORTED',
      quotationAuthenticity: quoteAuth,
      confidence: 'MEDIUM',
      reason: 'Source provides foundational engineering/physics principle, but does not directly prove all specific editorial clauses',
      blockers: blockers.length > 0 ? blockers : []
    };
  }

  if (propEval.result === 'ENTAILED' && blockers.length === 0) {
    // POSITIVE CASE: Naturally paraphrased Indonesian assertion is fully entailed by source proposition!
    return {
      status: 'ENTAILED',
      quotationAuthenticity: quoteAuth,
      confidence: propEval.confidence,
      reason: `Source proposition directly and fully entails the assertion proposition (${propEval.reason || 'natural Indonesian paraphrase validated'})`,
      blockers: []
    };
  }

  // Fallback: If partial overlap exists and no contradiction
  if (blockers.length === 0 && propEval.matchedConcepts && propEval.matchedConcepts.length > 0) {
    return {
      status: 'PARTIALLY_SUPPORTED',
      quotationAuthenticity: quoteAuth,
      confidence: 'MEDIUM',
      reason: `Partial proposition alignment verified without contradiction (${propEval.matchedConcepts.join(', ')})`,
      blockers: []
    };
  }

  // If semantic support cannot be determined deterministically, classify as REVIEW_REQUIRED
  return {
    status: 'REVIEW_REQUIRED',
    quotationAuthenticity: quoteAuth,
    confidence: 'LOW',
    reason: `Semantic entailment cannot be resolved deterministically: ${blockers.join('; ') || propEval.reason}`,
    blockers: blockers.length > 0 ? blockers : ['DETERMINISTIC_RESOLUTION_INSUFFICIENT']
  };
}

// ============================================================================
// 7. ASSERTION COVERAGE AUDIT (Task E)
// ============================================================================

/**
 * Audits whether article assertions exhaustively cover all substantive factual spans
 * in the article markdown, and binds the assessment directly to the content hash.
 */
export function auditAssertionCoverage(input: {
  articleMarkdown: string;
  expectedContentHash?: string;
  extractedSpans: { assertion_id: string; article_span: string; char_start: number; char_end: number }[];
  classifiedSpans: { article_span: string; isExempt: boolean }[];
  trackedAssertionPassages: string[];
}): AssertionCoverageAuditResult {
  const errors: string[] = [];
  const articleHash = computeArticleContentHash(input.articleMarkdown);

  // Check 1: Content hash match
  let hashMatch = true;
  if (input.expectedContentHash) {
    const cleanExpected = input.expectedContentHash.trim().toLowerCase();
    if (articleHash.toLowerCase() !== cleanExpected) {
      hashMatch = false;
      errors.push(
        `ARTICLE_HASH_MISMATCH_STALE_AUDIT: Current article content hash (${articleHash}) does not match expected hash (${cleanExpected}). Stale audit cannot approve modified draft.`
      );
    }
  }

  // Check 2: Substantive span coverage
  const normTracked = input.trackedAssertionPassages.map(p => normalizeForLiteralComparison(p));
  const untraceableSpans: string[] = [];

  let substantiveCount = 0;
  let coveredCount = 0;

  for (let i = 0; i < input.extractedSpans.length; i++) {
    const span = input.extractedSpans[i];
    const classification = input.classifiedSpans[i];

    if (classification && classification.isExempt) {
      // Non-claim prose / heading / rhetorical question -> exempt
      continue;
    }

    substantiveCount++;
    const normSpan = normalizeForLiteralComparison(span.article_span);
    const isCovered = normTracked.some(t => t.includes(normSpan) || normSpan.includes(t));

    if (isCovered) {
      coveredCount++;
    } else {
      untraceableSpans.push(span.article_span);
      errors.push(
        `ARTICLE_ASSERTION_UNACCOUNTED: Factual span lacks traceable claim ID: "${span.article_span.slice(0, 80)}..."`
      );
    }
  }

  const coverageRatio = substantiveCount > 0 ? coveredCount / substantiveCount : 1.0;
  const is_exhaustively_covered = untraceableSpans.length === 0 && hashMatch;

  return {
    article_content_hash: articleHash,
    total_spans_extracted: input.extractedSpans.length,
    substantive_assertion_count: substantiveCount,
    covered_assertions_count: coveredCount,
    untraceable_spans: untraceableSpans,
    coverage_ratio: coverageRatio,
    is_exhaustively_covered,
    hash_match: hashMatch,
    errors
  };
}

// ============================================================================
// 8. IRWAN PROVENANCE GATE EVALUATOR (Legacy & Upgraded)
// ============================================================================

export function evaluateIrwanProvenanceGate(
  ledger: SourceVerificationLedger
): { passed: boolean; blockers: string[] } {
  const blockers: string[] = [];

  for (const src of ledger.sources) {
    if (src.verification_status === 'METADATA_MISMATCH') {
      blockers.push(`Critical source '${src.source_id}' has unresolved metadata mismatch: ${src.status_reason}`);
    } else if (src.verification_status === 'EXCERPT_NOT_FOUND') {
      blockers.push(`Critical source '${src.source_id}' excerpt failed verbatim verification: ${src.status_reason}`);
    } else if (src.verification_status === 'CLAIM_STRENGTH_EXCEEDED') {
      blockers.push(`Critical source '${src.source_id}' claims exceed evidence boundaries.`);
    }
  }

  for (const link of ledger.claim_links) {
    if (!link.claim_strength_valid) {
      blockers.push(`Claim '${link.claim_id}' rejected: ${link.rejection_reason}`);
    }
    if (link.semantic_support === 'CONTRADICTED') {
      blockers.push(`Claim '${link.claim_id}' rejected: evidence contradicts assertion proposition.`);
    }
  }

  return {
    passed: blockers.length === 0,
    blockers
  };
}
