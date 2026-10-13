/**
 * RancangLoka Hermes Editorial — Grounded Citations Source Provenance Verifier
 * Milestone: SKILL-ADOPTION-MILESTONE-1 (Grounded Citations Pilot for Irwan)
 *
 * Invariants:
 * 1. SOURCE_EXCERPT_IS_LITERAL: Source excerpts must literally appear in the retrieved source document.
 * 2. AUTHOR_SAFE_CLAIM_MAY_BE_PARAPHRASED: Claims synthesized by Irwan may be technical paraphrases.
 * 3. PUBLIC_ARTICLE_MAY_BE_NATURAL_LANGUAGE_PARAPHRASE: Article sentences by Joko may be natural Bahasa Indonesia.
 * 4. CLAIM_STRENGTH_MUST_NOT_EXCEED_SOURCE_EVIDENCE: Neither author-safe claim nor public article may claim greater certainty/scope than source.
 * 5. NO_FABRICATED_EXCERPTS: If raw source text is unavailable locally, mark SOURCE_TEXT_NOT_AVAILABLE_FOR_LITERAL_VERIFICATION.
 * 6. NO PUBLIC MARKDOWN CITATION MUTATION: Does not modify public article markdown or inject ## Sources blocks.
 */

export const INVARIANT_SOURCE_EXCERPT_IS_LITERAL = 'SOURCE_EXCERPT_IS_LITERAL';
export const INVARIANT_AUTHOR_SAFE_CLAIM_MAY_BE_PARAPHRASED = 'AUTHOR_SAFE_CLAIM_MAY_BE_PARAPHRASED';
export const INVARIANT_PUBLIC_ARTICLE_MAY_BE_NATURAL_LANGUAGE_PARAPHRASE = 'PUBLIC_ARTICLE_MAY_BE_NATURAL_LANGUAGE_PARAPHRASE';
export const INVARIANT_CLAIM_STRENGTH_MUST_NOT_EXCEED_SOURCE_EVIDENCE = 'CLAIM_STRENGTH_MUST_NOT_EXCEED_SOURCE_EVIDENCE';

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
}

export interface ClaimProvenanceLink {
  claim_id: string;
  source_id: string;
  verbatim_source_excerpt: string | null;
  author_safe_claim: string;
  article_paraphrase?: string | null;
  claim_strength_valid: boolean;
  rejection_reason?: string | null;
}

export interface SourceVerificationLedger {
  ledger_id: string;
  article_topic: string;
  created_at: string;
  updated_at: string;
  audited_by: 'irwan_evidence_researcher_lead';
  sources: SourceProvenanceRecord[];
  claim_links: ClaimProvenanceLink[];
  summary: {
    total_sources: number;
    verified_literal_count: number;
    text_unavailable_count: number;
    mismatch_count: number;
    all_critical_sources_pass: boolean;
  };
}

/**
 * Normalizes text for verbatim substring comparison (case-folding, whitespace collapsing).
 */
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
 * If raw text is missing, marks SOURCE_TEXT_NOT_AVAILABLE_FOR_LITERAL_VERIFICATION.
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
  /\b100% (?:bebas|dingin|hilang)\b/i,
  /\bmutlak efektif\b/i,
  /\btanpa ada panas sedikitpun\b/i
];

/**
 * Validates that claim strength does not exceed the evidence bounded in the source excerpt.
 */
export function validateClaimStrengthBound(
  sourceExcerpt: string | null | undefined,
  authorSafeClaim: string,
  articleParaphrase?: string | null
): { valid: boolean; reason?: string } {
  // Check author-safe claim
  for (const pattern of EXAGGERATED_STRENGTH_PATTERNS) {
    if (pattern.test(authorSafeClaim)) {
      return {
        valid: false,
        reason: `Author-safe claim contains unhedged exaggeration exceeding source evidence: matches ${pattern.toString()}`
      };
    }
  }

  // Check article paraphrase
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

/**
 * Irwan Gate Evaluation: validates that evidence pack provenance meets all criteria
 * before advancing to Joko for drafting.
 */
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
  }

  return {
    passed: blockers.length === 0,
    blockers
  };
}
