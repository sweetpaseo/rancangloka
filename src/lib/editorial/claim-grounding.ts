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

import type { EvidencePackInput, AuthorSafeClaim } from '../article/human-quality.ts';

export type ClaimUsageType =
  | 'DIRECT_PARAPHRASE'
  | 'SUPPORTED_SYNTHESIS'
  | 'EDITORIAL_INFERENCE';

export interface AuthorClaimUsageDeclaration {
  claim_id: string;
  article_excerpt: string;
  usage_type: ClaimUsageType;
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
  declarationProvenance: 'AUTHOR_GROUNDING_DECLARATION';
  warnings: string[];
  errors: string[];
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

/**
 * Validates the draft envelope against the approved evidence pack and safe claims.
 * Non-Negotiable: Author grounding declaration is NOT verified evidence grounding.
 */
export function validateClaimGrounding(
  envelope: GroundedDraftEnvelope,
  evidencePack: EvidencePackInput,
  authorSafeClaims?: AuthorSafeClaim[]
): GroundingAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Compile Valid Claim IDs from evidence pack
  const validClaimIdSet = new Set<string>();
  const removedClaimIdSet = new Set<string>();

  if (Array.isArray(evidencePack.claim_inventory)) {
    for (const c of evidencePack.claim_inventory) {
      if (c && c.claim_id) {
        validClaimIdSet.add(c.claim_id);
      }
    }
  }

  if (authorSafeClaims && authorSafeClaims.length > 0) {
    for (const sc of authorSafeClaims) {
      if (sc.claim_id) {
        validClaimIdSet.add(sc.claim_id);
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

  // 2. Validate declared claim usages
  const unrecognizedClaimIds: string[] = [];
  const prohibitedClaimIds: string[] = [];
  const removedClaimsUsed: string[] = [];
  let validClaimsCount = 0;

  for (const usage of envelope.claim_usage) {
    const cid = usage.claim_id?.trim();
    if (!cid || !validClaimIdSet.has(cid)) {
      unrecognizedClaimIds.push(cid || 'UNKNOWN');
      errors.push(`Klaim [${cid}] tidak terdaftar dalam paket bukti yang disetujui.`);
    } else if (prohibitedClaimIdSet.has(cid)) {
      prohibitedClaimIds.push(cid);
      errors.push(`Klaim [${cid}] terdaftar sebagai klaim terlarang dalam paket bukti.`);
    } else if (removedClaimIdSet.has(cid)) {
      removedClaimsUsed.push(cid);
      errors.push(`Klaim [${cid}] memiliki aksi REMOVE dan dilarang digunakan untuk penulisan.`);
    } else {
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

  // 5. Determine Final Grounding Status
  let status: GroundingStatus = 'DECLARED_GROUNDED';
  let requiresReview = false;

  if (prohibitedClaimIds.length > 0 || prohibitedElementsFound.length > 0) {
    status = 'PROHIBITED_CLAIM_DETECTED';
    requiresReview = true;
  } else if (unsupportedCandidatesFound.length > 0) {
    status = 'UNSUPPORTED_CLAIMS_DETECTED';
    requiresReview = true;
  } else if (unrecognizedClaimIds.length > 0 || removedClaimsUsed.length > 0 || envelope.claim_usage.length === 0) {
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
