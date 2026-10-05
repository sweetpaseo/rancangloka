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
import type { EvidencePackInput, AuthorSafeClaim, EvidenceClaim } from '../article/human-quality.ts';

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

export interface EntailmentValidationResult {
  isEntailed: boolean;
  code?: 'VALID' | 'CLAIM_USAGE_ENTAILMENT_MISMATCH';
  reason?: string;
}

export function validateClaimUsageEntailment(
  usage: AuthorClaimUsageDeclaration,
  claim: { statement?: string; claim_id?: string; semantic_role?: string; relevance?: string }
): EntailmentValidationResult {
  const excerpt = usage.article_excerpt || '';
  const statement = claim.statement || '';

  // 1. Health / Respiratory / Allergy / Medical impacts
  const healthExcerptRegex = /\b(?:pernapasan|alergi|asma|respirasi|kesehatan|iritasi saluran|paru-paru|gejala napas|keluhan pernapasan|reaksi alergi)\b/i;
  const healthClaimRegex = /\b(?:health|respiratory|respirasi|allergy|allergies|alergi|asthma|asma|lung|lungs|airway|breathing|symptom|illness|disease|penyakit|pernapasan|kesehatan)\b/i;

  const excerptHasHealth = healthExcerptRegex.test(excerpt);
  const claimHasHealth = healthClaimRegex.test(statement);

  if (excerptHasHealth && !claimHasHealth) {
    return {
      isEntailed: false,
      code: 'CLAIM_USAGE_ENTAILMENT_MISMATCH',
      reason: `CLAIM_USAGE_ENTAILMENT_MISMATCH: Kutipan artikel untuk klaim '${usage.claim_id}' memuat dampak kesehatan/pernapasan/alergi, namun klaim rujukan hanya membahas penyebab fisik/kelembapan tanpa bukti dampak kesehatan.`
    };
  }

  // 2. Foreign Law / Legal Regulations
  const lawExcerptRegex = /\b(?:UK Building Regulations|Building Regulations 2010|Homes \(Fitness for Human Habitation\)|Awaab's Law|Section 11 Landlord|HHSRS)\b/i;
  const lawClaimRegex = /\b(?:UK Building Regulations|Building Regulations 2010|Homes \(Fitness for Human Habitation\)|Awaab's Law|Section 11|HHSRS|regulasi|undang-undang)\b/i;

  if (lawExcerptRegex.test(excerpt) && !lawClaimRegex.test(statement)) {
    return {
      isEntailed: false,
      code: 'CLAIM_USAGE_ENTAILMENT_MISMATCH',
      reason: `CLAIM_USAGE_ENTAILMENT_MISMATCH: Kutipan artikel menyatakan regulasi hukum spesifik yang tidak dibuktikan oleh klaim '${usage.claim_id}'.`
    };
  }

  return { isEntailed: true, code: 'VALID' };
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
 * Milestone EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1:
 * Enforces article span integrity (CLAIM_USAGE_ARTICLE_SPAN_NOT_FOUND) and
 * semantic entailment (CLAIM_USAGE_ENTAILMENT_MISMATCH).
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

    // Check Semantic Entailment
    if (cid && claimMap.has(cid)) {
      const targetClaim = claimMap.get(cid);
      const entailment = validateClaimUsageEntailment(usage, targetClaim);
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

  // 5. Determine Final Grounding Status
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

export function auditTechnicalAssertionCoverage(
  articleMarkdown: string,
  claimUsages: AuthorClaimUsageDeclaration[],
  options?: {
    approvedClaims?: any[];
  }
): TechnicalAssertionCoverageReport {
  const errors: string[] = [];
  const undeclared_assertions: string[] = [];
  const assertions: TechnicalAssertion[] = [];

  // Substantive technical/physical patterns that require evidentiary backing
  const technicalPatterns = [
    /\b(?:aliran cairan|tarikan kapiler|kapilaritas|pergerakan udara yang membawa uap|tekanan hidrostatik|rising damp|kelembapan naik|kondensasi|titik embun)\b/i,
    /\b(?:porositas|material berpori|daya rekat|cat kedap|membran kedap|waterproofing|kerusakan substrat|delaminasi|cat menggelembung|nat rusak|pasangan bata)\b/i,
    /\b(?:keluhan pernapasan|spora jamur|alergi|respirasi|asma|kualitas udara dalam ruangan|toksin jamur)\b/i,
    /\b(?:konduksi|konveksi|radiasi termal|emisivitas|pantulan panas|penghalang radiasi|massa termal)\b/i
  ];

  // Pure conversational or transition phrases that do NOT require citations
  const conversationalPhrases = [
    /^\s*mari kita\b/i,
    /^\s*bagaimana dengan\b/i,
    /^\s*kuncinya adalah\b/i,
    /^\s*pertanyaannya\b/i,
    /^\s*menurut pandangan kami\b/i,
    /^\s*di rancangloka\b/i,
    /^\s*langkah pertama\b/i,
    /^\s*kesimpulannya\b/i,
    /^\s*pada akhirnya\b/i
  ];

  const cleanLines = (articleMarkdown || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('#') && line.length > 0);

  const sentences: string[] = [];
  for (const line of cleanLines) {
    const rawSentences = line
      .replace(/^[-*•]\s+/, '')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && !s.endsWith('?'));
    sentences.push(...rawSentences);
  }

  for (const sentence of sentences) {
    const isConversational = conversationalPhrases.some(p => p.test(sentence));
    if (isConversational) continue;

    const isTechnical = technicalPatterns.some(p => p.test(sentence));
    if (!isTechnical) continue;

    // Check if covered by any declared claim usage
    const normSentence = normalizeArticleText(sentence);
    const matchedUsage = claimUsages.find(u => {
      const normEx = normalizeArticleText(u.article_excerpt);
      if (!normEx) return false;
      return normEx.includes(normSentence) || normSentence.includes(normEx) || (
        normSentence.length > 30 && normEx.length > 30 && (
          normSentence.slice(0, 35) === normEx.slice(0, 35) ||
          normSentence.slice(-35) === normEx.slice(-35)
        )
      );
    });

    if (matchedUsage) {
      assertions.push({
        sentence,
        isDeclared: true,
        linked_claim_id: matchedUsage.claim_id,
        classification: matchedUsage.usage_type
      });
    } else {
      assertions.push({
        sentence,
        isDeclared: false
      });
      undeclared_assertions.push(sentence);
      errors.push(
        `UNDECLARED_TECHNICAL_ASSERTION: Kalimat asersi teknis substansial ditemukan di naskah tanpa deklarasi klaim bukti: "${sentence.slice(0, 100)}..."`
      );
    }
  }

  const declared_assertions_count = assertions.filter(a => a.isDeclared).length;
  const undeclared_assertions_count = undeclared_assertions.length;
  const passed = undeclared_assertions_count === 0;

  return {
    passed,
    total_assertions_count: assertions.length,
    declared_assertions_count,
    undeclared_assertions_count,
    undeclared_assertions,
    assertions,
    errors
  };
}

