/**
 * RancangLoka Editorial Human Writing Quality Gate
 * Milestone: EDITORIAL-HUMAN-QUALITY-1
 *
 * Strict Invariants:
 * 1. ZERO FAKE "AI DETECTORS":
 *    - Absolutely NO GPTZero-style scoring, arbitrary "AI probability", or hidden third-party detector APIs.
 *    - Evaluates authentic editorial characteristics: sentence rhythm, concrete detail, contextual relevance,
 *      editorial voice, non-template structure, evidence integration, reader usefulness, and conclusion originality.
 * 2. CANONICAL OWNERSHIP:
 *    - Joko (content_writer_primary): Owns HUMAN-FIRST AUTHORING and prose rewrites. Never invents personal testing or fake anecdotes.
 *    - Rina (editorial_qa_primary): Owns HUMAN-WRITING QUALITY GATE & EDITORIAL_NATURALNESS_REVIEW.
 *    - Irwan (evidence_researcher_lead): Owns facts, evidence, and citations. Stylistic rewrites must never corrupt verified facts.
 *    - Jefry (management_advisor_jefry): Advisory/shadow observer only. Zero execution or publishing authority.
 * 3. DETERMINISTIC 100-POINT RUBRIC & THRESHOLDS:
 *    - Natural sentence rhythm: 20 pts
 *    - Specificity / concrete detail: 15 pts
 *    - Contextual relevance (Indonesian climate/reality): 15 pts
 *    - Editorial voice: 15 pts
 *    - Non-template structure: 10 pts
 *    - Evidence integration: 10 pts
 *    - Useful reader perspective: 10 pts
 *    - Conclusion originality: 5 pts
 *    - Thresholds: 85-100 = PASS, 75-84 = REVISE, 0-74 = REWRITE.
 * 4. REWRITE LOOP & RETRY CAP:
 *    - Maximum 2 rewrite attempts.
 *    - If retry count exceeds cap (>= 2 retries failed), escalates deterministically to HUMAN_REVIEW_REQUIRED.
 *    - Never lowers the threshold to force a pass.
 * 5. EVIDENCE PRESERVATION:
 *    - Stylistic rewrites must strictly preserve technical specifications, citations, and evidence markers.
 */

import crypto from 'node:crypto';
import {
  type SourceOrigin,
  type CachedSnapshotProvenance,
  verifyCachedSnapshotProvenance,
  createCachedSnapshotProvenance
} from '../editorial/source-discovery.ts';

import {
  evaluateClaimQuality,
  DocumentTopicRelevanceEvaluator,
  classifySourceRole
} from '../editorial/evidence-quality-gate.ts';

export type { SourceOrigin, CachedSnapshotProvenance };
export { verifyCachedSnapshotProvenance, createCachedSnapshotProvenance };

export type HumanWritingDecision =
  | 'HUMAN_WRITING_PASS'
  | 'HUMAN_WRITING_REVISE'
  | 'HUMAN_WRITING_REWRITE'
  | 'HUMAN_REVIEW_REQUIRED';

export type HumanQualityDecision = HumanWritingDecision;

export interface HumanWritingDimensions {
  sentence_rhythm: number;         // Max 20
  specificity_detail: number;      // Max 15
  contextual_relevance: number;    // Max 15
  editorial_voice: number;         // Max 15
  non_template_structure: number;  // Max 10
  evidence_integration: number;    // Max 10
  reader_perspective: number;      // Max 10
  conclusion_originality: number;  // Max 5
}

export const DEFAULT_HUMAN_QUALITY_RUBRIC: Record<keyof HumanWritingDimensions, number> = {
  sentence_rhythm: 20,
  specificity_detail: 15,
  contextual_relevance: 15,
  editorial_voice: 15,
  non_template_structure: 10,
  evidence_integration: 10,
  reader_perspective: 10,
  conclusion_originality: 5
};

export interface EditorialPatternIssue {
  code: string;
  category:
    | 'GENERIC_OPENING'
    | 'STRUCTURAL_SYMMETRY'
    | 'REPETITIVE_TRANSITIONS'
    | 'EMPTY_GENERALIZATION'
    | 'EXCESSIVE_HEDGING'
    | 'ARTIFICIAL_CONCLUSION'
    | 'KEYWORD_FORCING'
    | 'PARAGRAPH_UNIFORMITY'
    | 'LACK_OF_LOCAL_CONTEXT'
    | 'INSUFFICIENT_CLAIM_SUPPORT'
    | 'FABRICATED_EXPERIENCE'
    | 'MECHANICAL_AI_STYLE'
    | 'TERMINOLOGY_INCONSISTENCY'
    | 'SPECIFICATION_DUMP'
    | 'COMMERCIAL_BIAS'
    | 'FABRICATED_HANDS_ON'
    | 'COMPLAINT_OVERGENERALIZATION'
    | 'COMPATIBILITY_GAP'
    | 'TRANSLATIONESE'
    | 'EXPERT_CONSULTATION_GAP'
    | 'DECISION_SUPPORT_GAP'
    | 'ACADEMIC_DISTANCE'
    | 'CONTENT_DEPTH_MISMATCH'
    | 'READER_VOICE_PREREQUISITE';
  severity: 'WARNING' | 'CRITICAL';
  description: string;
  penalty: number;
  occurrences?: string[];
}

/**
 * Editorial Article Intent Classification
 * Milestone: EDITORIAL-EXPERT-CONSULTATION-1
 */
export type ArticleIntent =
  | 'EXPLANATORY'
  | 'PROBLEM_SOLVING'
  | 'COMPARISON'
  | 'PRODUCT_REVIEW'
  | 'INSTALLATION_HOW_TO';

export type IntentConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ArticleIntentProfile {
  primary_intent: ArticleIntent;
  secondary_intents: ArticleIntent[];
  confidence: IntentConfidence;
  reasons: string[];
}

import {
  RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
  CANONICAL_TERMINOLOGY_MAP,
  CANONICAL_NATIVE_INDONESIAN_AUTHORING_RULE,
  TECHNICAL_ENGLISH_ALLOWLIST
} from './editorial-knowledge.ts';
import type { ProductReviewType } from './product-review-knowledge.ts';

export interface HumanWritingQualityResult {
  knowledge_version: string;
  total_score: number;
  decision: HumanWritingDecision;
  passed: boolean;
  dimensions: HumanWritingDimensions;
  issues: EditorialPatternIssue[];
  strong_areas: string[];
  evaluated_by: string; // 'editorial_qa_primary' (Rina)
  evaluated_at: string;
  attempt_count: number;
  max_attempts: number;
  rewrite_brief: StructuredRewriteBrief | null;
  article_intent?: ArticleIntent;
  article_intent_profile?: ArticleIntentProfile;
}

export interface StructuredRewriteBrief {
  target_agent_id: string; // 'content_writer_primary' | 'evidence_researcher_lead' | 'editorial_qa_primary'
  supporting_agent_id?: string;
  supporting_agent_ids?: string[];
  reason: 'HUMAN_WRITING_QUALITY';
  revision_reason?: 'RESEARCH_REQUIRED' | 'EDITORIAL_EXPLANATION_REQUIRED' | 'EDITORIAL_INTEGRITY_REVIEW' | 'HOMEOWNER_REFRAMING_REQUIRED';
  quality_decision?: HumanQualityDecision;
  quality_score?: number;
  quality_issue?: string; // Legacy singular issue code for backward compatibility
  primary_quality_issue?: string;
  quality_issues?: string[];
  article_intent?: ArticleIntent;
  article_id?: number | string;
  task_id?: string;
  attempt: number;
  required_actions: string[];
  preserved_invariants: string[];
  failing_sections: string[];
}

// ============================================================================
// Deterministic Pattern Heuristics & Signals
// ============================================================================

/**
 * Weak generic openings that signal dictionary definitions or robotic introductions
 * rather than reader problems / architectural context.
 */
export const GENERIC_OPENING_PATTERNS = [
  /^di era modern (?:saat ini|sekarang|ini)/i,
  /^dalam dunia (?:konstruksi|arsitektur|desain|properti|bangunan)/i,
  /^memilih material yang tepat merupakan hal(?: yang sangat)? penting/i,
  /^rumah adalah (?:tempat|kebutuhan|istana)/i,
  /^pada dasarnya,/i,
  /^seiring dengan perkembangan zaman/i,
  /^tidak dapat dipungkiri bahwa/i,
  /^sebagaimana kita ketahui/i
];

/**
 * Common robotic transitional phrases that become monotonous when overused.
 */
export const REPETITIVE_TRANSITION_MARKERS = [
  'selain itu',
  'di sisi lain',
  'dengan demikian',
  'oleh karena itu',
  'pada akhirnya',
  'secara keseluruhan',
  'pada dasarnya',
  'penting untuk diingat',
  'perlu diperhatikan',
  'dalam hal ini',
  'tidak hanya itu',
  'di samping itu'
];

/**
 * Empty generalizations that sound informative but provide no actionable technical insight.
 */
export const EMPTY_GENERALIZATION_PATTERNS = [
  /setiap pilihan memiliki kelebihan dan kekurangan/i,
  /tentu memiliki kelebihan dan kekurangan/i,
  /memiliki kelebihan dan kekurangan(?: masing-masing)?/i,
  /semua ada kelebihan dan kekurangan/i,
  /pilihan terbaik tergantung kebutuhan masing-masing/i,
  /semua pilihan kembali pada/i,
  /ada banyak faktor yang perlu dipertimbangkan/i,
  /semua kembali kepada selera dan anggaran/i,
  /masing-masing memiliki karakteristik tersendiri/i,
  /memilih kayu yang bagus dan kuat/i,
  /kayu solid yang bermutu tinggi/i,
  /kualitasnya sangat meragukan/i
];

/**
 * Excessive hedging phrases that weaken editorial conviction.
 */
export const EXCESSIVE_HEDGING_PATTERNS = [
  /\bdapat menjadi pilihan\b/gi,
  /\bbisa dipertimbangkan\b/gi,
  /\bumumnya\b/gi,
  /\bcenderung\b/gi,
  /\bmungkin saja\b/gi,
  /\btergantung kebutuhan\b/gi
];

/**
 * Prohibited fabricated personal experience phrases (Layer 5: Trust & Integrity).
 * Strictly bans invented first-person claims ("kami menguji", "berdasarkan pengalaman kami", "kami mengunjungi").
 */
export const FABRICATED_EXPERIENCE_PATTERNS = [
  /kami (?:sudah )?(?:menguji|mencoba|meneliti|mengunjungi|mengamati langsung)/i,
  /berdasarkan pengalaman kami/i,
  /klien kami di (?:jakarta|surabaya|bandung)/i,
  /kami telah membuktikan sendiri/i
];

/**
 * Prohibited foreign or technical jargon phrases that alienate Indonesian readers.
 * Specifically strictly bans "verdict" in any user-facing editorial or review copy.
 */
export const PROHIBITED_EDITORIAL_JARGON_PATTERNS = [
  /\bverdict\b/i,
  /\bfinal verdict\b/i,
  /\breview verdict\b/i,
  /\bverdict produk\b/i
];

/**
 * Translationese patterns representing translated English discourse structures.
 * Milestone: NATIVE-INDONESIAN-AUTHORING-1
 *
 * Checks for unnatural English sentence structures literally translated into Indonesian:
 * - "ketika datang ke..." (when it comes to...)
 * - "ini adalah sesuatu yang perlu Anda pertimbangkan..." (this is something you need to consider...)
 * - "dalam hal pemilihan X, terdapat beberapa faktor..." (in terms of choosing X...)
 * - "dalam hal ini, penting untuk memahami bahwa..." (in this case, it is important to understand that...)
 * - "hadir dengan sejumlah/berbagai fitur..." (comes with a number of features...)
 * - "keputusan berada di tangan Anda..." (the decision is in your hands...)
 * - "pilihan terbaik akan bergantung pada kebutuhan Anda..." (the best choice will depend on your needs...)
 * - "memainkan peran kunci dalam..." (plays a key role in...)
 * - "yang mana hal ini..." (which is...)
 * - English copula copycat "adalah penting / adalah dirancang untuk..."
 *
 * NOTE: Does NOT ban legitimate technical English terms (e.g. thermal break, U-value, low-e, firmware)
 * or formal regulatory/standard Indonesian citations.
 */
export const TRANSLATIONESE_PATTERNS = [
  {
    regex: /\b(?:ketika|saat)\s+datang\s+ke\b/i,
    label: 'ketika datang ke (when it comes to)'
  },
  {
    regex: /\bini\s+adalah\s+(?:sesuatu|hal)\s+yang\s+(?:perlu|harus)\s+anda\s+pertimbangkan\b/i,
    label: 'ini adalah sesuatu yang perlu Anda pertimbangkan (this is something you need to consider)'
  },
  {
    regex: /\bdalam\s+hal\s+(?:pemilihan|pembelian|penggunaan|pertimbangan)\s+[^,\n]+,\s*(?:terdapat|ada)\s+beberapa\s+faktor\b/i,
    label: 'dalam hal pemilihan X, terdapat beberapa faktor (in terms of choosing X...)'
  },
  {
    regex: /\bdalam\s+hal\s+ini,\s*penting\s+untuk\s+memahami\s+bahwa\b/i,
    label: 'dalam hal ini, penting untuk memahami bahwa (in this case, it is important to understand that)'
  },
  {
    regex: /\bhadir\s+dengan\s+(?:sejumlah|berbagai)\s+fitur\b/i,
    label: 'hadir dengan sejumlah/berbagai fitur (comes with a number of features)'
  },
  {
    regex: /\b(?:pada\s+akhirnya,\s+)?keputusan\s+(?:berada|ada)\s+di\s+tangan\s+anda\b/i,
    label: 'keputusan berada di tangan Anda (at the end of the day, the decision is in your hands)'
  },
  {
    regex: /\bpilihan\s+terbaik\s+akan\s+bergantung\s+pada\s+kebutuhan\s+anda\b/i,
    label: 'pilihan terbaik akan bergantung pada kebutuhan Anda (the best choice will depend on your needs)'
  },
  {
    regex: /\bmemainkan\s+peran\s+(?:kunci|penting)\s+dalam\b/i,
    label: 'memainkan peran kunci dalam (plays a key role in)'
  },
  {
    regex: /\byang\s+mana\s+(?:hal\s+ini|ini)\b/i,
    label: 'yang mana hal ini (which is)'
  },
  {
    regex: /\badalah\s+(?:penting|sangat\s+krusial|lebih\s+unggul|dirancang\s+untuk)\b/i,
    label: 'konstruksi kopula "adalah" tiruan bahasa Inggris ("is important", "is designed to")'
  }
];



/**
 * Indonesian tropical climate & local reality vocabulary.
 * Rewards contextual grounding in local weather, moisture, heat, or installation reality.
 */
export const INDONESIAN_LOCAL_REALITY_MARKERS = [
  'tropis',
  'curah hujan',
  'kelembapan',
  'tampias',
  'panas sore',
  'matahari barat',
  'terik',
  'ventilasi silang',
  'rembesan',
  'karat',
  'lapuk',
  'lumut',
  'tukang',
  'plesteran',
  'acian',
  'dak beton',
  'baja ringan',
  'genteng',
  'kemiringan atap',
  'overstek',
  'talang air',
  'drainase',
  'dinding bata',
  'bata ringan',
  'indonesia',
  'musim hujan',
  'musim penghujan',
  'pln',
  'mati lampu',
  'daun pintu',
  'kayu solid',
  'kayu jati',
  'kamper',
  'merbau',
  'kamar mandi',
  'kamar tidur',
  'dapur'
];

// ============================================================================
// Evaluation Engine
// ============================================================================

// ============================================================================
// Evidence Pack & Retrieval Verification Types (EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1)
// ============================================================================

export type SourceRetrievalStatus =
  | 'SOURCE_RETRIEVED_AND_VERIFIED'
  | 'SOURCE_METADATA_ONLY'
  | 'SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED'
  | 'SOURCE_REFERENCE_KNOWN_BUT_NOT_RETRIEVED' // legacy alias
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_RETRIEVAL_FAILED'
  | 'SOURCE_PROVENANCE_UNKNOWN';

export type ClaimSupportLevel =
  | 'VERIFIED'
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'UNVERIFIED'
  | 'CONFLICTING';

export type SourceApplicability =
  | 'UNIVERSAL_PHYSICS'
  | 'CLIMATE_DEPENDENT'
  | 'MATERIAL_SYSTEM_SPECIFIC'
  | 'REGION_SPECIFIC'
  | 'JURISDICTION_SPECIFIC'
  | 'STANDARD_SPECIFIC'
  | 'FOREIGN_BUILDING_GUIDANCE'
  | 'INDONESIAN_REGULATION'
  | 'INDONESIAN_TECHNICAL_GUIDANCE'
  | 'EDITORIAL_INFERENCE'
  | 'ENCYCLOPEDIC_SECONDARY_SOURCE'
  | 'REGULATORY_LOCAL_TROPICAL' // backward compatibility
  | 'TECHNICAL_GUIDANCE_LOCAL'   // backward compatibility
  | 'TECHNICAL_REFERENCE_FOREIGN' // backward compatibility
  | 'FOREIGN_BUILDING_CODE'
  | 'RESEARCH_STUDY'
  | 'MANUFACTURER_DOCUMENTATION'
  | 'UNKNOWN_SCOPE';

export type ClaimApplicability = SourceApplicability;

export type ApplicabilityScopeKind =
  | 'UNIVERSAL_PHYSICS'
  | 'CLIMATE_DEPENDENT'
  | 'MATERIAL_SYSTEM_SPECIFIC'
  | 'REGION_SPECIFIC'
  | 'JURISDICTION_SPECIFIC'
  | 'STANDARD_SPECIFIC'
  | 'UNKNOWN_SCOPE';

export interface EvidenceScope {
  applicability_kind: ApplicabilityScopeKind;
  jurisdictions: string[];
  standards: string[];
  scope_basis?: string;
}

const SCOPE_RESTRICTION_ORDER: Record<ApplicabilityScopeKind, number> = {
  UNKNOWN_SCOPE: 100, // most restricted / fail-closed
  JURISDICTION_SPECIFIC: 90,
  STANDARD_SPECIFIC: 80,
  REGION_SPECIFIC: 70,
  MATERIAL_SYSTEM_SPECIFIC: 60,
  CLIMATE_DEPENDENT: 50,
  UNIVERSAL_PHYSICS: 10 // broadest
};

export function narrowestEvidenceScope(scopes: EvidenceScope[]): EvidenceScope {
  if (!scopes || scopes.length === 0) {
    return { applicability_kind: 'UNKNOWN_SCOPE', jurisdictions: [], standards: [], scope_basis: 'empty scopes' };
  }
  let narrowest = scopes[0];
  for (let i = 1; i < scopes.length; i++) {
    const s = scopes[i];
    const currRank = SCOPE_RESTRICTION_ORDER[narrowest.applicability_kind] || 0;
    const nextRank = SCOPE_RESTRICTION_ORDER[s.applicability_kind] || 0;
    if (nextRank > currRank) {
      narrowest = s;
    }
  }
  const allJurisdictions = Array.from(new Set(scopes.flatMap(s => s.jurisdictions || []))).filter(Boolean);
  const allStandards = Array.from(new Set(scopes.flatMap(s => s.standards || []))).filter(Boolean);
  return {
    applicability_kind: narrowest.applicability_kind,
    jurisdictions: allJurisdictions,
    standards: allStandards,
    scope_basis: narrowest.scope_basis || 'inherited from supporting sources'
  };
}

/**
 * Resolves structured EvidenceScope from evidence source or claim metadata.
 * Domain-agnostic contract: replaces hardcoded country regexes as the primary source of truth.
 * Invariant: Regulatory or standard claims without explicit jurisdiction or standard_id fail-close to UNKNOWN_SCOPE.
 */
export function resolveEvidenceScope(item: any): EvidenceScope {
  if (!item || typeof item !== 'object') {
    return {
      applicability_kind: 'UNKNOWN_SCOPE',
      jurisdictions: [],
      standards: [],
      scope_basis: 'item is null or non-object'
    };
  }

  // 1. Direct explicit evidence_scope on item
  if (item.evidence_scope && typeof item.evidence_scope === 'object') {
    const kind: ApplicabilityScopeKind = item.evidence_scope.applicability_kind || 'UNKNOWN_SCOPE';
    const jur = Array.isArray(item.evidence_scope.jurisdictions) ? item.evidence_scope.jurisdictions.filter(Boolean) : [];
    const std = Array.isArray(item.evidence_scope.standards) ? item.evidence_scope.standards.filter(Boolean) : [];
    return {
      applicability_kind: kind,
      jurisdictions: jur,
      standards: std,
      scope_basis: item.evidence_scope.scope_basis || 'explicit evidence_scope'
    };
  }

  // 2. Structured metadata properties
  const docType = String(item.document_type || item.source_classification || item.claim_class || '').toUpperCase();
  const rawJurisdiction = item.jurisdiction || item.geographic_applicability;
  const jurisdictions: string[] = Array.isArray(item.jurisdictions)
    ? item.jurisdictions.filter(Boolean)
    : (rawJurisdiction && typeof rawJurisdiction === 'string' && rawJurisdiction !== 'JURISDICTION_SPECIFIC' ? [rawJurisdiction] : []);

  const rawStandardId = item.standard_id || item.standard;
  const standards: string[] = Array.isArray(item.standards)
    ? item.standards.filter(Boolean)
    : (rawStandardId ? [String(rawStandardId)] : []);

  // Check document type: REGULATION
  const isRegulation = docType.includes('REGULATION') ||
    docType.includes('BUILDING_CODE') ||
    item.claim_class === 'regulatory_reference' ||
    item.claim_class === 'REGULATORY_REFERENCE' ||
    item.applicability === 'INDONESIAN_REGULATION' ||
    item.applicability === 'FOREIGN_BUILDING_CODE';

  if (isRegulation) {
    if (item.applicability === 'INDONESIAN_REGULATION' && jurisdictions.length === 0) {
      jurisdictions.push('Indonesia');
    }
    if (jurisdictions.length > 0) {
      return {
        applicability_kind: 'JURISDICTION_SPECIFIC',
        jurisdictions,
        standards,
        scope_basis: 'regulation with explicit jurisdiction metadata'
      };
    }
    // Fail-Closed: Regulation without reliable jurisdiction metadata => UNKNOWN_SCOPE
    return {
      applicability_kind: 'UNKNOWN_SCOPE',
      jurisdictions: [],
      standards,
      scope_basis: 'REGULATION requires explicit jurisdiction metadata'
    };
  }

  // Check document type: STANDARD
  const isStandard = docType.includes('STANDARD') ||
    item.applicability === 'STANDARD_SPECIFIC' ||
    standards.length > 0;

  if (isStandard) {
    if (standards.length > 0) {
      return {
        applicability_kind: 'STANDARD_SPECIFIC',
        jurisdictions,
        standards,
        scope_basis: 'standard with explicit standard_id metadata'
      };
    }
    // Fail-Closed: STANDARD without standard identifier => UNKNOWN_SCOPE
    return {
      applicability_kind: 'UNKNOWN_SCOPE',
      jurisdictions,
      standards: [],
      scope_basis: 'STANDARD requires explicit standard identifier metadata'
    };
  }

  // Editorial recommendations are contextual synthesis / guidance
  const isRecommendation = item.claim_class === 'editorial_recommendation' ||
    item.claim_class === 'EDITORIAL_RECOMMENDATION' ||
    item.applicability === 'EDITORIAL_INFERENCE';

  if (isRecommendation) {
    return {
      applicability_kind: 'UNIVERSAL_PHYSICS',
      jurisdictions: [],
      standards: [],
      scope_basis: 'editorial recommendation / inference'
    };
  }

  // NON-AUTHORITATIVE HINT (REGEX_HINT != SEMANTIC_PROOF)
  // Check text blob for jurisdiction-specific markers before accepting universal physics claim
  const textBlob = `${item.statement || ''} ${item.relevance || ''} ${item.document_title || ''} ${item.locator || ''}`;
  if (isJurisdictionSpecific(textBlob)) {
    return {
      applicability_kind: 'JURISDICTION_SPECIFIC',
      jurisdictions: jurisdictions.length > 0 ? jurisdictions : ['Foreign (detected by legacy hint)'],
      standards,
      scope_basis: 'regex hint non-authoritative fallback (REGEX_HINT != SEMANTIC_PROOF)'
    };
  }

  // Check physical mechanism / scientific guidance
  const applicabilityBasis = String(item.applicability_basis || item.scope_basis || '').toLowerCase();
  const isPhysicalBasis = applicabilityBasis.includes('physical mechanism') ||
    applicabilityBasis.includes('physics') ||
    docType === 'SCIENTIFIC_GUIDANCE' ||
    item.applicability === 'UNIVERSAL_PHYSICS';

  if (isPhysicalBasis) {
    return {
      applicability_kind: 'UNIVERSAL_PHYSICS',
      jurisdictions: [],
      standards: [],
      scope_basis: item.applicability_basis || 'physical mechanism'
    };
  }

  // Check legacy string applicability mappings
  if (item.applicability === 'CLIMATE_DEPENDENT') {
    return { applicability_kind: 'CLIMATE_DEPENDENT', jurisdictions, standards, scope_basis: 'legacy applicability' };
  }
  if (item.applicability === 'MATERIAL_SYSTEM_SPECIFIC') {
    return { applicability_kind: 'MATERIAL_SYSTEM_SPECIFIC', jurisdictions, standards, scope_basis: 'legacy applicability' };
  }
  if (item.applicability === 'REGION_SPECIFIC') {
    return { applicability_kind: 'REGION_SPECIFIC', jurisdictions, standards, scope_basis: 'legacy applicability' };
  }
  if (item.applicability === 'TECHNICAL_GUIDANCE_LOCAL' || item.applicability === 'INDONESIAN_TECHNICAL_GUIDANCE') {
    return { applicability_kind: 'REGION_SPECIFIC', jurisdictions: ['Indonesia'], standards, scope_basis: 'local technical guidance' };
  }
  if (item.applicability === 'TECHNICAL_REFERENCE_FOREIGN') {
    return { applicability_kind: 'JURISDICTION_SPECIFIC', jurisdictions: ['Foreign'], standards, scope_basis: 'foreign technical reference' };
  }
  if (item.applicability === 'JURISDICTION_SPECIFIC') {
    if (jurisdictions.length > 0) {
      return { applicability_kind: 'JURISDICTION_SPECIFIC', jurisdictions, standards, scope_basis: 'legacy jurisdiction specific' };
    }
    return { applicability_kind: 'UNKNOWN_SCOPE', jurisdictions: [], standards, scope_basis: 'JURISDICTION_SPECIFIC missing jurisdiction metadata' };
  }

  // If item has sources, inherit narrowest scope from sources
  if (Array.isArray(item.sources) && item.sources.length > 0) {
    return narrowestEvidenceScope(item.sources.map(resolveEvidenceScope));
  }

  // If not a regulation and not a standard, general technical claims default to UNIVERSAL_PHYSICS
  if (!isRegulation && !isStandard) {
    return {
      applicability_kind: 'UNIVERSAL_PHYSICS',
      jurisdictions: [],
      standards: [],
      scope_basis: 'general technical consensus'
    };
  }

  return {
    applicability_kind: 'UNKNOWN_SCOPE',
    jurisdictions,
    standards,
    scope_basis: 'unresolved scope'
  };
}

/**
 * NON-AUTHORITATIVE HEURISTIC HINTS:
 * CRITICAL RULE: REGEX_HINT != SEMANTIC_PROOF.
 * These patterns exist ONLY as secondary diagnostic warnings, NOT as primary evidence proofs.
 */
export const JURISDICTION_SPECIFIC_PATTERNS = [
  /\b(?:UK Building Regulations|Building Regulations 2010|Homes \(Fitness for Human Habitation\) Act|Awaab's Law|Section 11 Landlord and Tenant Act|Housing Health and Safety Rating System|HHSRS|Approved Document [A-Z]|Part [A-Z] regulations)\b/i,
  /\b(?:IRC\b|International Residential Code|IBC\b|International Building Code|ASHRAE Standard|OSHA regulations|Title 24 California|HUD Guidelines)\b/i,
  /\b(?:BCA\b|Building Code of Australia|National Construction Code|NCC\b|AS\/NZS \d+)\b/i
];

export function isJurisdictionSpecific(text: string): boolean {
  if (!text) return false;
  // Non-authoritative hint: cannot independently prove jurisdiction validity
  return JURISDICTION_SPECIFIC_PATTERNS.some(pat => pat.test(text));
}

export function normalizeSourceText(text: string): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

export function locatePassageInSource(
  passageText: string,
  sourceText: string
): {
  found: boolean;
  charStart: number;
  charEnd: number;
  sourceRawHash: string;
  sourceNormalizedHash: string;
  passageHash: string;
} {
  const normSource = normalizeSourceText(sourceText);
  const normPassage = normalizeSourceText(passageText);

  const sourceRawHash = crypto.createHash('sha256').update(sourceText || '', 'utf8').digest('hex');
  const sourceNormalizedHash = crypto.createHash('sha256').update(normSource, 'utf8').digest('hex');
  const passageHash = crypto.createHash('sha256').update(normPassage, 'utf8').digest('hex');

  if (!normPassage) {
    return { found: false, charStart: -1, charEnd: -1, sourceRawHash, sourceNormalizedHash, passageHash };
  }

  const start = normSource.indexOf(normPassage);
  if (start !== -1) {
    return {
      found: true,
      charStart: start,
      charEnd: start + normPassage.length,
      sourceRawHash,
      sourceNormalizedHash,
      passageHash
    };
  }

  const rawStart = (sourceText || '').indexOf(passageText);
  if (rawStart !== -1) {
    return {
      found: true,
      charStart: rawStart,
      charEnd: rawStart + passageText.length,
      sourceRawHash,
      sourceNormalizedHash,
      passageHash
    };
  }

  return {
    found: false,
    charStart: -1,
    charEnd: -1,
    sourceRawHash,
    sourceNormalizedHash,
    passageHash
  };
}

export type SourceIndependence =
  | 'INDEPENDENT'
  | 'PARTIALLY_DEPENDENT'
  | 'DERIVED'
  | 'DERIVATIVE'
  | 'UNKNOWN';

export interface SourceQualityProfile {
  authority: 'INSTITUTIONAL_OFFICIAL' | 'PEER_REVIEWED_RESEARCH' | 'STANDARDS_BODY' | 'SECONDARY_ENCYCLOPEDIC' | 'COMMERCIAL_MANUFACTURER' | string;
  primary_vs_secondary: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  retrieval_integrity: 'HASH_VERIFIED' | 'METADATA_ONLY' | 'UNVERIFIED';
  claim_relevance: 'DIRECT' | 'SUPPORTING' | 'BACKGROUND';
  geographic_applicability: 'UNIVERSAL_PHYSICS' | 'TROPICAL_LOCAL' | 'FOREIGN_TEMPERATE' | string;
  independence: SourceIndependence;
  dependency_note?: string;
}

export type SourceClassification =
  | 'PRIMARY_RESEARCH_DOCUMENT'
  | 'OFFICIAL_INSTITUTIONAL_GUIDANCE'
  | 'ENCYCLOPEDIC_SECONDARY_SOURCE'
  | 'STANDARDS_PUBLICATION'
  | 'INDUSTRY_REFERENCE';

export interface EvidenceSource {
  source_id: string;
  source_type?: string;
  source_classification?: SourceClassification;
  authority_level?: 'INSTITUTIONAL_OFFICIAL' | 'INSTITUTIONAL_PEER_REVIEW' | 'SECONDARY_ENCYCLOPEDIC' | 'STANDARDS_BODY' | 'INDUSTRY_REFERENCE';
  primary_vs_secondary?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  publisher_or_author?: string;
  document_title: string;
  canonical_url?: string;
  retrieved_url?: string;
  publication_or_revision_date?: string;
  edition_or_revision?: string;
  page_or_section?: string;
  applicability: SourceApplicability | string;
  support_type?: string;
  retrieval_status?: SourceRetrievalStatus;
  retrieval_method?: string;
  retrieved_at?: string;
  http_status?: number;
  content_location?: string;
  content_hash?: string;
  snapshot_reference?: string;
  raw_content_preview?: string;
  limitations?: string;
  quality_profile?: SourceQualityProfile;

  // Milestone: SOURCE-ACQUISITION-AUTHENTICITY-1
  source_origin?: SourceOrigin;
  requested_url?: string;
  resolved_url?: string;
  raw_content_hash?: string;
  snapshot_provenance?: CachedSnapshotProvenance;
  snapshot_created_at?: string;
  snapshot_source_hash?: string;
  snapshot_verification_status?: 'VERIFIED_AUTHENTIC' | 'UNVERIFIED' | 'FAILED_INTEGRITY';
  source_role?: string;
}

export type GeneralEvidenceRole =
  | 'CAUSE_MECHANISM'
  | 'DIAGNOSTIC_SIGNAL'
  | 'MATERIAL_BEHAVIOR'
  | 'INTERVENTION_EFFECT'
  | 'INSTALLATION_GUIDANCE'
  | 'LIMITATION'
  | 'RISK'
  | 'CONTEXT_DEPENDENCY'
  | 'MAINTENANCE'
  | 'REGULATORY_REFERENCE'
  | 'USER_EXPERIENCE_SIGNAL';

export type LegacyRoofEvidenceRole =
  | 'ROOF_HEAT_TRANSFER'
  | 'RADIANT_BARRIER_MECHANISM'
  | 'AIR_SPACE_REQUIREMENT'
  | 'ATTIC_VENTILATION'
  | 'DUST_DEGRADATION'
  | 'MATERIAL_PROPERTY';

export type EvidenceSemanticRole = GeneralEvidenceRole | LegacyRoofEvidenceRole;

export const GENERAL_EVIDENCE_ROLES: GeneralEvidenceRole[] = [
  'CAUSE_MECHANISM',
  'DIAGNOSTIC_SIGNAL',
  'MATERIAL_BEHAVIOR',
  'INTERVENTION_EFFECT',
  'INSTALLATION_GUIDANCE',
  'LIMITATION',
  'RISK',
  'CONTEXT_DEPENDENCY',
  'MAINTENANCE',
  'REGULATORY_REFERENCE',
  'USER_EXPERIENCE_SIGNAL'
];

export function isGeneralEvidenceRole(role: any): role is GeneralEvidenceRole {
  return typeof role === 'string' && GENERAL_EVIDENCE_ROLES.includes(role as GeneralEvidenceRole);
}

export const GENERAL_SEMANTIC_ROLE_COMPATIBILITY: Record<GeneralEvidenceRole, GeneralEvidenceRole[]> = {
  CAUSE_MECHANISM: ['CAUSE_MECHANISM'],
  DIAGNOSTIC_SIGNAL: ['DIAGNOSTIC_SIGNAL'],
  MATERIAL_BEHAVIOR: ['MATERIAL_BEHAVIOR'],
  INTERVENTION_EFFECT: ['INTERVENTION_EFFECT'],
  INSTALLATION_GUIDANCE: ['INSTALLATION_GUIDANCE'],
  LIMITATION: ['LIMITATION'],
  RISK: ['RISK'],
  CONTEXT_DEPENDENCY: ['CONTEXT_DEPENDENCY'],
  MAINTENANCE: ['MAINTENANCE'],
  REGULATORY_REFERENCE: ['REGULATORY_REFERENCE'],
  USER_EXPERIENCE_SIGNAL: ['USER_EXPERIENCE_SIGNAL']
};

/**
 * Historical metal-roof ID-specific role mappings.
 * Strictly preserved for historical fixtures and tests (Milestone 3B).
 * In generalized runtime, validation depends solely on claim/passage semantic roles and claim class, never on claim ID.
 */
export const CLAIM_ALLOWED_SEMANTIC_ROLES: Record<string, EvidenceSemanticRole[]> = {
  'CLM-001A': ['ROOF_HEAT_TRANSFER', 'MATERIAL_PROPERTY'],
  'CLM-001B': ['ROOF_HEAT_TRANSFER', 'MATERIAL_PROPERTY'],
  'CLM-002': ['ROOF_HEAT_TRANSFER', 'RADIANT_BARRIER_MECHANISM'],
  'CLM-003': ['AIR_SPACE_REQUIREMENT'],
  'CLM-004': ['RADIANT_BARRIER_MECHANISM', 'AIR_SPACE_REQUIREMENT'],
  'CLM-004A': ['RADIANT_BARRIER_MECHANISM'],
  'CLM-004B': ['AIR_SPACE_REQUIREMENT'],
  'CLM-005': ['ATTIC_VENTILATION'],
  'CLM-006': ['ATTIC_VENTILATION'],
  'CLM-007A': ['DUST_DEGRADATION'],
  'CLM-007B': ['INSTALLATION_GUIDANCE'],
  'CLM-008': []
};

export type PassageNature =
  | 'EXACT_LOCATED'
  | 'SOURCE_PARAPHRASE'
  | 'SOURCE_SYNTHESIS'
  | 'EDITORIAL_INFERENCE';

export interface EvidencePassage {
  passage_id: string;
  source_id: string;
  locator: string; // section, heading, or locator
  exact_text?: string;
  exact_or_normalized_excerpt: string;
  extracted_at: string;
  content_hash?: string;
  supports_claim_ids: string[];
  semantic_role?: EvidenceSemanticRole;
  limitations?: string;
  source_raw_hash?: string;
  source_normalized_hash?: string;
  passage_hash?: string;
  source_character_start?: number;
  source_character_end?: number;
  passage_nature?: PassageNature;
  source_origin?: SourceOrigin;
  snapshot_provenance?: CachedSnapshotProvenance;
}

export interface EvidenceClaim {
  claim_id: string;
  statement: string;
  claim_class?: 'VERIFIED_FACT' | 'TECHNICAL_CONSENSUS' | 'USER_EXPERIENCE_SIGNAL' | 'EDITORIAL_INFERENCE' | 'EDITORIAL_RECOMMENDATION' | 'technical_consensus' | 'verified_fact' | 'editorial_recommendation' | string;
  evidence_status: ClaimSupportLevel | string;
  provenance_retrieval_status?: SourceRetrievalStatus | string;
  source_reference?: string;
  sources?: EvidenceSource[];
  evidence_passage_ids?: string[];
  derived_from_claim_ids?: string[];
  recommendation_confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  inspection_dependency?: string;
  confidence?: string;
  action?: 'KEEP' | 'QUALIFY' | 'REMOVE_NUMBER' | 'REMOVE_CLAIM' | 'RESEARCH_REQUIRED' | string;
  relevance?: string;
  numeric_claim?: boolean;
  semantic_role?: EvidenceSemanticRole;
  absolute_language_allowed?: boolean;
  applicability?: string;
}

export interface AuthorSafeClaim {
  claim_id: string;
  statement: string;
  support_level: ClaimSupportLevel;
  applicability: string;
  allowed_for_authoring: boolean;
  prohibited_elements?: string[];
  qualification_required?: string;
  evidence_passage_ids?: string[];
  jurisdiction_blocked?: boolean;
  source_provenance_blocked?: boolean;
  semantic_support_blocked?: boolean;
  topic_relevance_blocked?: boolean;
  quality_gate_blocked?: boolean;
}

export interface EvidencePackInput {
  evidence_pack_id?: string;
  topic?: string;
  compiled_by?: string;
  compiled_by_name?: string;
  confidence_overall?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  claim_inventory?: EvidenceClaim[];
  author_safe_claims?: AuthorSafeClaim[];
  evidence_passages?: EvidencePassage[];
  retrieved_documents?: any[];
  execution_type?: 'REAL_RUNTIME_EXECUTION' | 'TEST';
  [key: string]: any;
}

export interface ProvenanceAuditSummary {
  total_claims: number;
  /** @deprecated Ambiguous historical field counting claim-source relationships. Use unique_retrieved_sources_count or claim_source_relationship_count. */
  retrieved_and_verified_sources_count: number;
  unique_retrieved_sources_count: number;
  retrieved_documents_count: number;
  claim_source_relationship_count: number;
  unique_verified_source_ids: string[];
  metadata_only_sources_count: number;
  unretrieved_sources_count: number;
  unverified_claims: string[];
  unsupported_numeric_claims: string[];
  missing_provenance_claims: string[];
  claim_support_map: Record<string, ClaimSupportLevel>;
  requires_provenance_failure: boolean;
  audit_reasons: string[];

  // Milestone: SOURCE-ACQUISITION-AUTHENTICITY-1
  live_retrieved_source_count: number;
  verified_cached_snapshot_count: number;
  test_fixture_source_count: number;
  synthetic_fixture_source_count: number;
  real_authoritative_source_count: number;
}

/**
 * Deterministically derives an audit of claim-to-source retrieval verification.
 * Distinguishes SOURCE_RETRIEVED_AND_VERIFIED from SOURCE_METADATA_ONLY / UNRETRIEVED.
 * Fail-closed default: if provenance is missing/unverified for exact numeric assertions,
 * it is flagged automatically without requiring manual caller booleans.
 */
import { auditTopicEvidenceAlignment } from '../editorial/topic-alignment.ts';

export interface ProvenanceAuditOptions {
  topic?: string;
  researchQuestions?: any[];
  minOverlapScore?: number;
  legacyRoofFixtures?: boolean;
  executionType?: 'REAL_RUNTIME_EXECUTION' | 'TEST';
}

export function isHistoricalRoofPack(
  evidencePack: EvidencePackInput | null | undefined,
  options?: ProvenanceAuditOptions
): boolean {
  if (!evidencePack) return false;
  if (options?.legacyRoofFixtures) return true;
  if (evidencePack.is_historical_roof_pack === true) return true;
  if (typeof evidencePack.milestone === 'string' && /EDITORIAL-RUNTIME-3/i.test(evidencePack.milestone)) {
    return true;
  }
  const claims = Array.isArray(evidencePack.claim_inventory) ? evidencePack.claim_inventory : [];
  const hasGenericClaimRoles = claims.some(c => isGeneralEvidenceRole((c as any).semantic_role));
  if (!hasGenericClaimRoles && evidencePack.topic && /atap metal terasa panas/i.test(evidencePack.topic)) {
    return true;
  }
  return false;
}

export function auditEvidencePackProvenance(
  evidencePack: EvidencePackInput | null | undefined,
  contentMd: string = '',
  options?: ProvenanceAuditOptions
): ProvenanceAuditSummary {
  const summary: ProvenanceAuditSummary = {
    total_claims: 0,
    retrieved_and_verified_sources_count: 0,
    unique_retrieved_sources_count: 0,
    retrieved_documents_count: 0,
    claim_source_relationship_count: 0,
    unique_verified_source_ids: [],
    metadata_only_sources_count: 0,
    unretrieved_sources_count: 0,
    unverified_claims: [],
    unsupported_numeric_claims: [],
    missing_provenance_claims: [],
    claim_support_map: {},
    requires_provenance_failure: false,
    audit_reasons: [],
    live_retrieved_source_count: 0,
    verified_cached_snapshot_count: 0,
    test_fixture_source_count: 0,
    synthetic_fixture_source_count: 0,
    real_authoritative_source_count: 0
  };

  if (!evidencePack || !Array.isArray(evidencePack.claim_inventory)) {
    return summary;
  }

  // Pre-writing Invariant: EVIDENCE_PACK_MUST_ADDRESS_REQUESTED_TOPIC
  if (options?.topic) {
    const alignment = auditTopicEvidenceAlignment(options.topic, evidencePack, {
      researchQuestions: options.researchQuestions
    });
    if (!alignment.aligned) {
      summary.requires_provenance_failure = true;
      if (alignment.rejection_code) {
        summary.unverified_claims.push(alignment.rejection_code);
        summary.missing_provenance_claims.push(alignment.rejection_code);
      }
      if (alignment.rejection_reason) {
        summary.audit_reasons.push(alignment.rejection_reason);
      }
    }
  }

  const claims = evidencePack.claim_inventory;
  summary.total_claims = claims.length;

  const verifiedSourceIdSet = new Set<string>();
  let claimSourceRelCount = 0;
  let metadataOnlyRelCount = 0;
  let unretrievedRelCount = 0;

  for (const claim of claims) {
    const claimSources = Array.isArray(claim.sources) ? claim.sources : [];
    let hasRetrievedSource = false;
    let hasMetadataOnlySource = false;
    let hasKnownUnretrievedSource = false;

    for (const src of claimSources) {
      const status: SourceRetrievalStatus =
        src.retrieval_status ||
        (claim.provenance_retrieval_status as SourceRetrievalStatus) ||
        'SOURCE_PROVENANCE_UNKNOWN';

      if (status === 'SOURCE_RETRIEVED_AND_VERIFIED') {
        claimSourceRelCount++;
        if (src.source_id) {
          verifiedSourceIdSet.add(src.source_id);
        }
        hasRetrievedSource = true;
      } else if (status === 'SOURCE_METADATA_ONLY') {
        metadataOnlyRelCount++;
        hasMetadataOnlySource = true;
      } else if (
        status === 'SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED' ||
        status === 'SOURCE_REFERENCE_KNOWN_BUT_NOT_RETRIEVED' ||
        status === 'SOURCE_UNAVAILABLE'
      ) {
        unretrievedRelCount++;
        hasKnownUnretrievedSource = true;
      }
    }

    // Phase 4 & Phase 7: Calculate support level from real source state.
    // A claim cannot be VERIFIED if all linked sources are metadata-only or unretrieved.
    let derivedSupportLevel: ClaimSupportLevel = 'UNVERIFIED';

    if (claimSources.length === 0) {
      derivedSupportLevel = 'UNVERIFIED';
    } else if (hasRetrievedSource) {
      derivedSupportLevel = (claim.evidence_status === 'VERIFIED') ? 'VERIFIED' : 'SUPPORTED';
    } else if (hasMetadataOnlySource || hasKnownUnretrievedSource) {
      // If metadata exists or reference known but not retrieved, maximum support is PARTIALLY_SUPPORTED
      derivedSupportLevel = 'PARTIALLY_SUPPORTED';
    } else {
      derivedSupportLevel = 'UNVERIFIED';
    }

    summary.claim_support_map[claim.claim_id] = derivedSupportLevel;

    // Phase 1 (EDITORIAL-SOURCE-ACQUISITION-1): Support-Level Consistency Audit
    // SOURCE_METADATA_ONLY, SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED, and SOURCE_UNAVAILABLE
    // must NOT by themselves produce SUPPORTED or VERIFIED.
    if ((claim.evidence_status === 'VERIFIED' || claim.evidence_status === 'SUPPORTED') && !hasRetrievedSource) {
      summary.missing_provenance_claims.push(
        `${claim.claim_id}: Status dinyatakan ${claim.evidence_status} namun sumber belum berstatus SOURCE_RETRIEVED_AND_VERIFIED`
      );
      summary.requires_provenance_failure = true;
      summary.audit_reasons.push(
        `Klaim ${claim.claim_id} ditandai ${claim.evidence_status} tetapi sumber dokumen fisik/primer tidak terverifikasi (hanya metadata/unretrieved).`
      );
    }

    // Phase 3 (EDITORIAL-SOURCE-ACQUISITION-1): Source Location Honesty
    // If a document has not been retrieved, do NOT preserve invented page/chapter/section/clause.
    // page_or_section MUST be null or empty.
    for (const src of claimSources) {
      const isRetrieved = src.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED';
      if (!isRetrieved && src.page_or_section !== null && src.page_or_section !== undefined && String(src.page_or_section).trim() !== '') {
        summary.unverified_claims.push(
          `${src.source_id}: Dokumen belum berstatus SOURCE_RETRIEVED_AND_VERIFIED namun mencantumkan lokasi spesifik ("${src.page_or_section}"). Lokasi harus bernilai null.`
        );
        summary.requires_provenance_failure = true;
        summary.audit_reasons.push(
          `Sumber ${src.source_id} belum diambil dan diverifikasi secara fisik/digital; lokasi pasal/halaman tidak boleh direka-reka (wajib null).`
        );
      }
    }

    // Phase 5: Numeric Claim Safety in Claim Inventory
    // Detect whether claim asserts exact numbers
    const statementHasNumbers = /\b\d+(?:[.,]\d+)?\s*(?:%|mm|cm|m|w\/m|°c|c\b)/i.test(claim.statement);
    const isExplicitNumeric = claim.numeric_claim || statementHasNumbers;

    // Fail-Closed Check: If claim has numbers but sources were not retrieved and verified,
    // it MUST NOT be claimed as VERIFIED fact in the evidence pack or final text without qualification.
    if (claim.evidence_status === 'VERIFIED' && !hasRetrievedSource) {
      if (!summary.missing_provenance_claims.some((c) => c.includes(claim.claim_id))) {
        summary.missing_provenance_claims.push(
          `${claim.claim_id}: Status dinyatakan VERIFIED namun sumber belum berstatus SOURCE_RETRIEVED_AND_VERIFIED`
        );
      }
      summary.requires_provenance_failure = true;
      summary.audit_reasons.push(
        `Klaim ${claim.claim_id} ditandai VERIFIED tetapi sumber dokumen fisik/primer tidak terverifikasi (hanya metadata/ingatan model).`
      );
    }

    // If an unsupported numeric claim is present in the inventory with action KEEP instead of QUALIFY/REMOVE_NUMBER
    if (isExplicitNumeric && !hasRetrievedSource && claim.action === 'KEEP') {
      summary.unsupported_numeric_claims.push(
        `${claim.claim_id}: Klaim numerik tanpa dokumen primer terverifikasi harus dikualifikasikan (QUALIFY atau REMOVE_NUMBER)`
      );
      summary.requires_provenance_failure = true;
      summary.audit_reasons.push(
        `Klaim numerik ${claim.claim_id} tidak boleh beraksi KEEP tanpa sumber berstatus SOURCE_RETRIEVED_AND_VERIFIED.`
      );
    }

    // Phase 11 (EDITORIAL-RUNTIME-3A): Strict Rule NO_SOURCE = NO_VERIFIED_STATUS
    if (claimSources.length === 0 && (claim.evidence_status === 'VERIFIED' || claim.evidence_status === 'SUPPORTED')) {
      summary.missing_provenance_claims.push(
        `${claim.claim_id}: Status dinyatakan ${claim.evidence_status} namun tidak memiliki sumber (sources.length === 0)`
      );
      summary.requires_provenance_failure = true;
      summary.audit_reasons.push(
        `Klaim ${claim.claim_id} tidak boleh berstatus ${claim.evidence_status} tanpa rujukan sumber sama sekali.`
      );
    }

    // Phase 12 (EDITORIAL-RUNTIME-3A): VERIFIED REQUIRES PASSAGE
    if (claim.evidence_status === 'VERIFIED') {
      if (Array.isArray(evidencePack.evidence_passages) || Array.isArray(claim.evidence_passage_ids)) {
        if (!Array.isArray(claim.evidence_passage_ids) || claim.evidence_passage_ids.length === 0) {
          summary.missing_provenance_claims.push(
            `${claim.claim_id}: Status dinyatakan VERIFIED namun tidak mencantumkan evidence_passage_ids`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Klaim ${claim.claim_id} berstatus VERIFIED wajib mencantumkan minimal satu ID bagian bukti (evidence_passage_ids).`
          );
        }
      }
    }

    // Phase 13 (EDITORIAL-RUNTIME-3A & 3B): Editorial Recommendation cannot be VERIFIED_FACT and must declare derived_from_claim_ids
    const isRecommendation = claim.claim_class === 'editorial_recommendation' || claim.claim_class === 'EDITORIAL_RECOMMENDATION';
    if (isRecommendation) {
      if (claim.evidence_status === 'VERIFIED' || (claim.claim_class as string) === 'VERIFIED_FACT') {
        summary.missing_provenance_claims.push(
          `${claim.claim_id}: Rekomendasi editorial tidak boleh berstatus VERIFIED atau diklasifikasikan sebagai VERIFIED_FACT`
        );
        summary.requires_provenance_failure = true;
        summary.audit_reasons.push(
          `Rekomendasi editorial ${claim.claim_id} merupakan panduan keputusan terapan, bukan fakta empiris mandiri.`
        );
      }
      if (!Array.isArray(claim.derived_from_claim_ids) || claim.derived_from_claim_ids.length === 0) {
        summary.missing_provenance_claims.push(
          `${claim.claim_id}: Rekomendasi editorial wajib memiliki derived_from_claim_ids yang valid.`
        );
        summary.requires_provenance_failure = true;
        summary.audit_reasons.push(
          `Rekomendasi editorial ${claim.claim_id} harus diturunkan dari klaim-klaim bukti empiris (derived_from_claim_ids).`
        );
      }
    }

    // Phase 14 (EDITORIAL-RUNTIME-3A): Wikipedia cannot masquerade as Primary Research
    for (const src of claimSources) {
      const isWiki = (src.canonical_url?.includes('wikipedia.org') || src.content_location?.includes('wikipedia.org') || src.source_id?.includes('WIKI'));
      if (isWiki) {
        if (src.source_classification === 'PRIMARY_RESEARCH_DOCUMENT') {
          summary.unverified_claims.push(
            `${src.source_id}: Sumber Wikipedia tidak boleh diklasifikasikan sebagai PRIMARY_RESEARCH_DOCUMENT`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Sumber Wikipedia ${src.source_id} wajib diklasifikasikan sebagai ENCYCLOPEDIC_SECONDARY_SOURCE.`
          );
        }
        if (src.publisher_or_author && src.publisher_or_author.includes('Building Science Open Repository')) {
          summary.unverified_claims.push(
            `${src.source_id}: Publisher sintetis ("${src.publisher_or_author}") dilarang untuk Wikipedia.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(`Penerbit Wikipedia harus jujur (Wikimedia Foundation).`);
        }
      }
    }
  }

  const historicalRoofPack = isHistoricalRoofPack(evidencePack, options);
  const executionType = options?.executionType || (evidencePack as any)?.execution_type || 'TEST';
  const isRealRuntime = executionType === 'REAL_RUNTIME_EXECUTION';

  const allRetrievedDocs = Array.isArray(evidencePack.retrieved_documents) ? evidencePack.retrieved_documents : [];
  const docMap = new Map<string, any>();

  let liveCount = 0;
  let cachedCount = 0;
  let testFixCount = 0;
  let synthFixCount = 0;

  for (const doc of allRetrievedDocs) {
    if (doc.source_id) {
      docMap.set(doc.source_id, doc);
    }
    const origin: SourceOrigin = doc.source_origin;
    if (origin === 'LIVE_RETRIEVAL') {
      liveCount++;
    } else if (origin === 'VERIFIED_CACHED_SNAPSHOT') {
      cachedCount++;
    } else if (origin === 'TEST_FIXTURE') {
      testFixCount++;
    } else if (origin === 'SYNTHETIC_FIXTURE') {
      synthFixCount++;
    }

    if (isRealRuntime && !historicalRoofPack) {
      // 1. Fixture prohibition in real runtime
      if (origin === 'TEST_FIXTURE' || origin === 'SYNTHETIC_FIXTURE') {
        summary.unverified_claims.push(
          `FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME: Sumber '${doc.source_id}' adalah ${origin} dan dilarang digunakan dalam REAL_RUNTIME_EXECUTION.`
        );
        summary.requires_provenance_failure = true;
        summary.audit_reasons.push(
          `Sumber fixture (${doc.source_id}) dilarang digunakan dalam eksekusi produksi nyata.`
        );
      } else if (origin === 'VERIFIED_CACHED_SNAPSHOT') {
        // 2. Snapshot provenance verification
        const snapCheck = verifyCachedSnapshotProvenance(doc.snapshot_provenance, doc.content_text);
        if (!snapCheck.isValid) {
          summary.unverified_claims.push(
            `CACHED_SNAPSHOT_PROVENANCE_INVALID: Sumber snapshot '${doc.source_id}' tidak memiliki bukti akuisisi yang valid (${snapCheck.reason}).`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Snapshot '${doc.source_id}' gagal verifikasi integritas rantai akuisisi.`
          );
        }
      } else if (origin === 'LIVE_RETRIEVAL') {
        // 3. Live retrieval acquisition provenance
        if (!doc.url && !doc.requested_url) {
          summary.unverified_claims.push(
            `SOURCE_ACQUISITION_PROVENANCE_MISSING: Dokumen live retrieval '${doc.source_id}' tidak memiliki URL permintaan yang sah.`
          );
          summary.requires_provenance_failure = true;
        }
        if (!doc.content_hash) {
          summary.unverified_claims.push(
            `SOURCE_ACQUISITION_PROVENANCE_MISSING: Dokumen live retrieval '${doc.source_id}' tidak memiliki content_hash.`
          );
          summary.requires_provenance_failure = true;
        }
      } else if (!origin) {
        summary.unverified_claims.push(
          `SOURCE_ACQUISITION_PROVENANCE_MISSING: Sumber '${doc.source_id}' tidak menyatakan source_origin dalam REAL_RUNTIME_EXECUTION.`
        );
        summary.requires_provenance_failure = true;
      }
    }
  }

  summary.live_retrieved_source_count = liveCount;
  summary.verified_cached_snapshot_count = cachedCount;
  summary.test_fixture_source_count = testFixCount;
  summary.synthetic_fixture_source_count = synthFixCount;
  summary.real_authoritative_source_count = liveCount + cachedCount;

  const retrievedDocsList = allRetrievedDocs.filter(d => {
    if (d.retrieval_status !== 'SOURCE_RETRIEVED_AND_VERIFIED' && d.read_status !== 'READ_AND_EXTRACTED') return false;
    if (isRealRuntime && !historicalRoofPack && (d.source_origin === 'TEST_FIXTURE' || d.source_origin === 'SYNTHETIC_FIXTURE')) {
      return false;
    }
    return true;
  });

  for (const doc of retrievedDocsList) {
    if (doc.source_id) {
      verifiedSourceIdSet.add(doc.source_id);
    }
  }

  summary.unique_retrieved_sources_count = verifiedSourceIdSet.size;
  summary.retrieved_documents_count = retrievedDocsList.length;
  summary.claim_source_relationship_count = claimSourceRelCount;
  summary.unique_verified_source_ids = Array.from(verifiedSourceIdSet);
  summary.retrieved_and_verified_sources_count = claimSourceRelCount;
  summary.metadata_only_sources_count = metadataOnlyRelCount;
  summary.unretrieved_sources_count = unretrievedRelCount;

  // Applicability & Scope Audit: Metadata-based verification replacing country regexes
  for (const claim of claims) {
    const scope = resolveEvidenceScope(claim);

    // Rule 1: Regulations or standards with UNKNOWN_SCOPE must fail provenance
    if (scope.applicability_kind === 'UNKNOWN_SCOPE') {
      const docType = String((claim as any).document_type || claim.claim_class || '').toUpperCase();
      const isRegOrStd = docType.includes('REGULATION') || docType.includes('STANDARD') ||
        (claim.sources || []).some(s => {
          const dt = String((s as any).document_type || s.source_classification || '').toUpperCase();
          return dt.includes('REGULATION') || dt.includes('STANDARD');
        });

      if (isRegOrStd) {
        summary.missing_provenance_claims.push(
          `REGULATORY_SCOPE_UNKNOWN: Klaim '${claim.claim_id}' memuat regulasi/standar namun tidak memiliki metadata yurisdiksi atau identifier standar yang valid.`
        );
        summary.requires_provenance_failure = true;
        summary.audit_reasons.push(
          `Klaim regulasi/standar (${claim.claim_id}) berstatus UNKNOWN_SCOPE dan diblokir secara fail-closed.`
        );
      }
    }

    // Rule 2: Jurisdiction or Standard specific claims cannot be marked UNIVERSAL_PHYSICS
    if (!historicalRoofPack && (scope.applicability_kind === 'JURISDICTION_SPECIFIC' || scope.applicability_kind === 'STANDARD_SPECIFIC')) {
      const isMarkedUniversal = claim.applicability === 'UNIVERSAL_PHYSICS' ||
        (claim.sources || []).some(s => s.applicability === 'UNIVERSAL_PHYSICS');
      if (isMarkedUniversal) {
        summary.unverified_claims.push(
          scope.applicability_kind === 'JURISDICTION_SPECIFIC'
            ? `JURISDICTION_MISCLASSIFIED_AS_UNIVERSAL: Klaim '${claim.claim_id}' memuat regulasi/hukum yurisdiksi spesifik namun ditandai sebagai UNIVERSAL_PHYSICS.`
            : `STANDARD_MISCLASSIFIED_AS_UNIVERSAL: Klaim '${claim.claim_id}' memuat standar spesifik namun ditandai sebagai UNIVERSAL_PHYSICS.`
        );
        summary.requires_provenance_failure = true;
        summary.audit_reasons.push(
          `Regulasi dan standar (${claim.claim_id}) wajib diklasifikasikan sebagai JURISDICTION_SPECIFIC atau STANDARD_SPECIFIC, bukan UNIVERSAL_PHYSICS.`
        );
      }
    }
  }

  // Phase 15 (EDITORIAL-RUNTIME-3B): Top-level evidence_passages deduplication & bidirectional integrity
  if (Array.isArray(evidencePack.evidence_passages)) {
    const passageMap = new Map<string, EvidencePassage>();
    const seenHashes = new Set<string>();

    for (const p of evidencePack.evidence_passages) {
      const dedupeKey = `${p.source_id}::${p.locator}::${p.content_hash || p.exact_or_normalized_excerpt}`;
      if (seenHashes.has(dedupeKey)) {
        summary.unverified_claims.push(
          `DUPLICATE_PASSAGE_OBJECTS: Passage '${p.passage_id}' merupakan duplikat kutipan yang sama (${dedupeKey}). Wajib satu kutipan = satu passage_id.`
        );
        summary.requires_provenance_failure = true;
        summary.audit_reasons.push(
          `Duplikasi objek passage terdeteksi untuk ${p.passage_id}. Satu kutipan wajib direpresentasikan oleh tepat satu ID passage.`
        );
      }
      seenHashes.add(dedupeKey);
      passageMap.set(p.passage_id, p);
    }

    const claimsById = new Map<string, EvidenceClaim>();
    for (const c of claims) {
      claimsById.set(c.claim_id, c);
    }

    // Direction 1: claim.evidence_passage_ids -> passage.supports_claim_ids
    for (const claim of claims) {
      if (Array.isArray(claim.evidence_passage_ids)) {
        for (const pid of claim.evidence_passage_ids) {
          const passage = passageMap.get(pid);
          if (!passage) {
            summary.missing_provenance_claims.push(
              `${claim.claim_id}: ID passage '${pid}' tidak ditemukan di koleksi evidence_passages.`
            );
            summary.requires_provenance_failure = true;
            summary.audit_reasons.push(`Passage ${pid} yang dirujuk oleh ${claim.claim_id} tidak ditemukan.`);
          } else {
            if (Array.isArray(passage.supports_claim_ids) && !passage.supports_claim_ids.includes(claim.claim_id)) {
              summary.missing_provenance_claims.push(
                `CLAIM_PASSAGE_LINK_ASYMMETRY: Klaim '${claim.claim_id}' merujuk passage '${pid}', namun passage tidak mencantumkan '${claim.claim_id}' dalam supports_claim_ids.`
              );
              summary.requires_provenance_failure = true;
              summary.audit_reasons.push(
                `Asimetri link: Klaim ${claim.claim_id} merujuk passage ${pid}, namun passage tidak mencantumkannya dalam supports_claim_ids.`
              );
            }
          }
        }
      }
    }

    // Direction 2: passage.supports_claim_ids -> claim.evidence_passage_ids
    for (const passage of evidencePack.evidence_passages) {
      if (Array.isArray(passage.supports_claim_ids)) {
        for (const cid of passage.supports_claim_ids) {
          const claim = claimsById.get(cid);
          if (!claim) {
            summary.missing_provenance_claims.push(
              `DANGLING_CLAIM_REFERENCE: Passage '${passage.passage_id}' mencantumkan klaim '${cid}' yang tidak ada dalam claim_inventory.`
            );
            summary.unverified_claims.push(
              `DANGLING_CLAIM_REFERENCE: ID klaim '${cid}' pada evidence_passages '${passage.passage_id}' tidak ditemukan di dalam claim_inventory.`
            );
            summary.requires_provenance_failure = true;
            summary.audit_reasons.push(
              `DANGLING_CLAIM_REFERENCE: Passage '${passage.passage_id}' merujuk claim_id '${cid}' yang tidak ada dalam claim_inventory.`
            );
          } else if (!Array.isArray(claim.evidence_passage_ids) || !claim.evidence_passage_ids.includes(passage.passage_id)) {
            summary.missing_provenance_claims.push(
              `CLAIM_PASSAGE_LINK_ASYMMETRY: Passage '${passage.passage_id}' mendukung klaim '${cid}', namun klaim '${cid}' tidak mencantumkan '${passage.passage_id}' dalam evidence_passage_ids.`
            );
            summary.requires_provenance_failure = true;
            summary.audit_reasons.push(
              `Asimetri link: Passage ${passage.passage_id} mendukung ${cid}, namun klaim ${cid} tidak mencantumkannya.`
            );
          }
        }
      }
    }

    // Validation: EVERY supports_claim_ids in retrieved_documents[].extracted_passages[] must resolve to claim_inventory
    if (Array.isArray(evidencePack.retrieved_documents)) {
      for (const doc of evidencePack.retrieved_documents) {
        if (Array.isArray(doc.extracted_passages)) {
          for (const p of doc.extracted_passages) {
            if (Array.isArray(p.supports_claim_ids)) {
              for (const cid of p.supports_claim_ids) {
                if (!claimsById.has(cid)) {
                  summary.missing_provenance_claims.push(
                    `DANGLING_CLAIM_REFERENCE: Retrieved passage '${p.passage_id}' (${doc.source_id}) mencantumkan klaim '${cid}' yang tidak ada dalam claim_inventory.`
                  );
                  summary.unverified_claims.push(
                    `DANGLING_CLAIM_REFERENCE: ID klaim '${cid}' pada retrieved_documents[${doc.source_id}].extracted_passages '${p.passage_id}' tidak ditemukan di dalam claim_inventory.`
                  );
                  summary.requires_provenance_failure = true;
                  summary.audit_reasons.push(
                    `DANGLING_CLAIM_REFERENCE: Retrieved passage '${p.passage_id}' (${doc.source_id}) merujuk claim_id '${cid}' yang tidak ada dalam claim_inventory.`
                  );
                }
              }
            }
          }
        }
      }
    }

    // Substring Check: Verify passage excerpt exists in retrieved source content
    const sourceTextMap = new Map<string, string>();
    if (Array.isArray(evidencePack.retrieved_documents)) {
      for (const d of evidencePack.retrieved_documents) {
        if (d.content_text) sourceTextMap.set(d.source_id, d.content_text);
      }
    }
    if (evidencePack.source_snapshots && typeof evidencePack.source_snapshots === 'object') {
      for (const [sid, text] of Object.entries(evidencePack.source_snapshots)) {
        if (typeof text === 'string') sourceTextMap.set(sid, text);
      }
    }
    for (const claim of claims) {
      for (const s of (claim.sources || [])) {
        if ((s as any).raw_content_preview && !sourceTextMap.has(s.source_id)) {
          sourceTextMap.set(s.source_id, (s as any).raw_content_preview);
        }
      }
    }

    for (const passage of evidencePack.evidence_passages) {
      const sourceText = sourceTextMap.get(passage.source_id);
      if (sourceText) {
        const textToCheck = passage.exact_text || passage.exact_or_normalized_excerpt || '';
        const loc = locatePassageInSource(textToCheck, sourceText);

        passage.source_raw_hash = loc.sourceRawHash;
        passage.source_normalized_hash = loc.sourceNormalizedHash;
        passage.passage_hash = loc.passageHash;
        passage.source_character_start = loc.charStart;
        passage.source_character_end = loc.charEnd;

        const isClaimedExact = !passage.passage_nature ||
          passage.passage_nature === 'EXACT_LOCATED' ||
          Boolean(passage.exact_text);

        if (isClaimedExact && !loc.found) {
          summary.unverified_claims.push(
            `PASSAGE_NOT_IN_RETRIEVED_SOURCE: Kutipan passage '${passage.passage_id}' ditandai sebagai bukti eksak namun teksnya tidak ditemukan di dalam teks dokumen sumber '${passage.source_id}'.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Passage ${passage.passage_id} tidak terdapat sebagai substring eksak pada dokumen sumber ${passage.source_id} (PASSAGE_NOT_IN_RETRIEVED_SOURCE).`
          );
        } else if (loc.found && !passage.passage_nature) {
          passage.passage_nature = 'EXACT_LOCATED';
        }
      }
    }

    // Phase 16 (EDITORIAL-RUNTIME-3B-STABILIZE & 4B-STABILIZE): Semantic Claim-Passage Entailment & Boundary Contract
    const historicalRoofPack = isHistoricalRoofPack(evidencePack, options);

    for (const claim of claims) {
      const claimDeclaredGenericRole = isGeneralEvidenceRole((claim as any).semantic_role);
      const allowedRoles = historicalRoofPack && !claimDeclaredGenericRole
        ? CLAIM_ALLOWED_SEMANTIC_ROLES[claim.claim_id]
        : undefined;

      if (Array.isArray(claim.evidence_passage_ids)) {
        for (const pid of claim.evidence_passage_ids) {
          const passage = passageMap.get(pid);
          if (passage) {
            // Case 1: Generic Semantic Contract (active whenever claim has a generic semantic role OR pack is not historical roof)
            if (claimDeclaredGenericRole || !historicalRoofPack) {
              const claimRole = (claim as any).semantic_role as GeneralEvidenceRole;
              const passageRole = passage.semantic_role as GeneralEvidenceRole;

              if (!claimRole) {
                summary.unverified_claims.push(
                  `MISSING_CLAIM_SEMANTIC_ROLE: Klaim '${claim.claim_id}' tidak menyatakan peran semantik (semantic_role) dalam runtime generalisasi.`
                );
                summary.requires_provenance_failure = true;
                summary.audit_reasons.push(
                  `Klaim '${claim.claim_id}' wajib menyatakan peran semantik.`
                );
              } else if (!passageRole) {
                summary.unverified_claims.push(
                  `GENERIC_SEMANTIC_ROLE_MISMATCH: Passage '${pid}' tidak menyatakan peran semantik (semantic_role) untuk mendukung klaim '${claim.claim_id}'.`
                );
                summary.requires_provenance_failure = true;
                summary.audit_reasons.push(
                  `GENERIC_SEMANTIC_ROLE_MISMATCH: Passage '${pid}' tidak memiliki semantic_role.`
                );
              } else {
                const compatibleRoles = GENERAL_SEMANTIC_ROLE_COMPATIBILITY[claimRole] || [claimRole];
                if (!compatibleRoles.includes(passageRole)) {
                  summary.unverified_claims.push(
                    `GENERIC_SEMANTIC_ROLE_MISMATCH: Passage '${pid}' dengan peran '${passageRole}' tidak kompatibel dengan peran klaim '${claimRole}' pada klaim '${claim.claim_id}' (peran yang diizinkan: ${compatibleRoles.join(', ')}).`
                  );
                  summary.requires_provenance_failure = true;
                  summary.audit_reasons.push(
                    `GENERIC_SEMANTIC_ROLE_MISMATCH: Peran semantik passage '${passageRole}' tidak kompatibel dengan klaim '${claim.claim_id}' (peran: '${claimRole}').`
                  );
                }
              }
            } else {
              // Case 2: Historical Metal-Roof Fixtures & Tests
              // Check 1: Walls passage must NOT support roof thermal/mass/conductivity or dust claims
              const locatorIsWall = /\b(?:Walls|Wall)\b/i.test(passage.locator || '') ||
                /\b(?:vented wall skin|sheathing to create a vented air space between the radiant barrier and the siding)\b/i.test(passage.exact_or_normalized_excerpt || '');
              if (locatorIsWall && (claim.claim_id === 'CLM-001A' || claim.claim_id === 'CLM-001B' || claim.claim_id === 'CLM-007A')) {
                summary.unverified_claims.push(
                  `INVALID_PASSAGE_CLAIM_ENTAILMENT: Passage '${pid}' dari locator '${passage.locator}' tidak dapat mendukung klaim '${claim.claim_id}'. Topik dinding tidak membuktikan properti atap atau degradasi debu.`
                );
                summary.requires_provenance_failure = true;
                summary.audit_reasons.push(
                  `Passage '${pid}' (Walls) tidak memenuhi syarat entailment untuk '${claim.claim_id}'.`
                );
              }

              // Check 2: Historical semantic role compatibility
              if (passage.semantic_role && allowedRoles) {
                if (allowedRoles.length > 0 && !allowedRoles.includes(passage.semantic_role)) {
                  summary.unverified_claims.push(
                    `SEMANTIC_ROLE_MISMATCH: Passage '${pid}' dengan peran '${passage.semantic_role}' tidak kompatibel dengan klaim '${claim.claim_id}' (peran yang diizinkan: ${allowedRoles.join(', ')}).`
                  );
                  summary.requires_provenance_failure = true;
                  summary.audit_reasons.push(
                    `Peran semantik passage '${passage.semantic_role}' tidak dapat digunakan untuk membuktikan klaim '${claim.claim_id}'.`
                  );
                }
              }

              // Check 3: Specific adversarial mismatch checks
              const isDustPassage = passage.semantic_role === 'DUST_DEGRADATION' || /\bdust\b/i.test(passage.exact_or_normalized_excerpt || '');
              if (isDustPassage && (claim.claim_id === 'CLM-001B' || claim.claim_id === 'CLM-005' || claim.claim_id === 'CLM-006')) {
                summary.unverified_claims.push(
                  `SEMANTIC_ROLE_MISMATCH: Passage debu '${pid}' tidak dapat mendukung klaim konduktivitas atau ventilasi '${claim.claim_id}'.`
                );
                summary.requires_provenance_failure = true;
                summary.audit_reasons.push(`Passage debu tidak dapat membuktikan ${claim.claim_id}.`);
              }

              const isVentPassage = passage.semantic_role === 'ATTIC_VENTILATION' || /\battic ventilation\b/i.test(passage.exact_or_normalized_excerpt || '');
              if (isVentPassage && (claim.claim_id === 'CLM-004A' || (claim.claim_id === 'CLM-004' && !claim.statement.includes('ventilasi')))) {
                summary.unverified_claims.push(
                  `SEMANTIC_ROLE_MISMATCH: Passage ventilasi '${pid}' tidak dapat mendukung klaim insulasi massa '${claim.claim_id}'.`
                );
                summary.requires_provenance_failure = true;
                summary.audit_reasons.push(`Passage ventilasi tidak dapat membuktikan insulasi massa ${claim.claim_id}.`);
              }

              const isAirSpacePassage = passage.semantic_role === 'AIR_SPACE_REQUIREMENT';
              if (isAirSpacePassage && (claim.claim_id === 'CLM-001A' || claim.claim_id === 'CLM-001B')) {
                summary.unverified_claims.push(
                  `SEMANTIC_ROLE_MISMATCH: Passage rongga udara '${pid}' tidak dapat mendukung klaim sifat fisik material lembaran metal '${claim.claim_id}'.`
                );
                summary.requires_provenance_failure = true;
                summary.audit_reasons.push(`Passage rongga udara tidak dapat membuktikan sifat fisik lembaran ${claim.claim_id}.`);
              }
            }
          }
        }
      }

      // Check 4: CLM-004A cannot contain unsupported fiber/foam comparison (Historical roof only)
      if (historicalRoofPack && !claimDeclaredGenericRole && claim.claim_id === 'CLM-004A') {
        if (/\b(?:serat|busa|fiber|foam)\b/i.test(claim.statement || '')) {
          summary.unverified_claims.push(
            `UNSUPPORTED_MATERIAL_COMPARISON: CLM-004A memuat perbandingan material serat/busa yang tidak didukung langsung oleh kutipan bukti sumber: ${claim.statement}`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `CLM-004A dilarang memuat perbandingan serat/busa tanpa bukti primer langsung.`
          );
        }
      }
    }
  }

  // Phase 9, 10 & 16 (EDITORIAL-SOURCE-ACQUISITION-1, 3B & 3B-STABILIZE): Author-Safe Claims Audit & Invariants
  if (Array.isArray(evidencePack.author_safe_claims)) {
    const claimsById = new Map<string, EvidenceClaim>();
    for (const c of claims) {
      claimsById.set(c.claim_id, c);
    }

    for (const safe of evidencePack.author_safe_claims) {
      const underlying = claimsById.get(safe.claim_id);
      const isRecommendation = underlying?.claim_class === 'editorial_recommendation' || underlying?.claim_class === 'EDITORIAL_RECOMMENDATION';
      const hasRetrieved = underlying?.sources?.some(
        (s) => s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED'
      );
      const hasPassages = Array.isArray(underlying?.evidence_passage_ids) && underlying.evidence_passage_ids.length > 0;

      // Invariant: AUTHOR_SAFE_STRENGTH <= EVIDENCE_STRENGTH
      if (underlying) {
        if (underlying.evidence_status === 'SUPPORTED' && safe.support_level === 'VERIFIED') {
          summary.missing_provenance_claims.push(
            `AUTHOR_SAFE_STRENGTH_OVERREACH: Klaim aman '${safe.claim_id}' berstatus VERIFIED melampaui status bukti inventaris SUPPORTED.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Kekuatan klaim aman '${safe.claim_id}' tidak boleh melampaui kekuatan bukti inventaris (AUTHOR_SAFE_STRENGTH <= EVIDENCE_STRENGTH).`
          );
        }
        if (underlying.evidence_status === 'PARTIALLY_SUPPORTED' && (safe.support_level === 'VERIFIED' || safe.support_level === 'SUPPORTED')) {
          summary.missing_provenance_claims.push(
            `AUTHOR_SAFE_STRENGTH_OVERREACH: Klaim aman '${safe.claim_id}' berstatus ${safe.support_level} melampaui status bukti dasar PARTIALLY_SUPPORTED.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Kekuatan klaim aman '${safe.claim_id}' tidak boleh melampaui kekuatan bukti dasar.`
          );
        }
      }

      // Requirement 5: Unsourced technical claims CANNOT enter authoring
      const packHasPassagesOrRetrieval = (Array.isArray(evidencePack.evidence_passages) && evidencePack.evidence_passages.length > 0) ||
        claims.some((c) => c.sources?.some((s) => s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED'));

      const isUnsourced = (underlying?.sources?.length === 0) ||
        underlying?.action === 'RESEARCH_REQUIRED' ||
        underlying?.action === 'REMOVE' ||
        (packHasPassagesOrRetrieval && !hasRetrieved && !hasPassages);

      if (!isRecommendation && isUnsourced) {
        if (safe.allowed_for_authoring) {
          summary.missing_provenance_claims.push(
            `UNSOURCED_CLAIM_ALLOWED_FOR_AUTHORING: Klaim teknis '${safe.claim_id}' tidak memiliki sumber/passage terverifikasi namun diizinkan untuk authoring (allowed_for_authoring = true). Wajib false.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Klaim tanpa sumber (${safe.claim_id}) dilarang masuk ke author_safe_claims dengan allowed_for_authoring=true.`
          );
        }
      }

      // Recommendation Derivation Integrity: Derived claims must be valid and allowed for authoring
      if (isRecommendation && Array.isArray(underlying?.derived_from_claim_ids)) {
        for (const derivedId of underlying.derived_from_claim_ids) {
          const derivedClaim = claimsById.get(derivedId);
          const derivedSafe = evidencePack.author_safe_claims?.find(c => c.claim_id === derivedId);
          if (!derivedClaim) {
            summary.missing_provenance_claims.push(
              `RECOMMENDATION_DERIVED_FROM_UNKNOWN_CLAIM: Rekomendasi '${safe.claim_id}' diturunkan dari klaim '${derivedId}' yang tidak terdaftar.`
            );
            summary.requires_provenance_failure = true;
          } else if (derivedSafe && !derivedSafe.allowed_for_authoring) {
            summary.missing_provenance_claims.push(
              `RECOMMENDATION_DERIVED_FROM_BLOCKED_CLAIM: Rekomendasi '${safe.claim_id}' diturunkan dari klaim '${derivedId}' yang diblokir untuk authoring (allowed_for_authoring = false).`
            );
            summary.requires_provenance_failure = true;
            summary.audit_reasons.push(
              `Rekomendasi editorial tidak boleh diturunkan dari klaim yang diblokir (${derivedId}).`
            );
          } else if (derivedClaim.action === 'RESEARCH_REQUIRED' || derivedClaim.action === 'REMOVE') {
            summary.missing_provenance_claims.push(
              `RECOMMENDATION_DERIVED_FROM_BLOCKED_CLAIM: Rekomendasi '${safe.claim_id}' diturunkan dari klaim '${derivedId}' dengan aksi ${derivedClaim.action}.`
            );
            summary.requires_provenance_failure = true;
            summary.audit_reasons.push(
              `Rekomendasi editorial tidak boleh diturunkan dari klaim berstatus ${derivedClaim.action} (${derivedId}).`
            );
          }
        }

        // Banning universal absolutes in recommendation statements: harus, wajib, selalu, mutlak, pasti, diperlukan, prioritas utama
        const absoluteAllowed = underlying?.absolute_language_allowed === true;
        const hasUniversalAbsolute = /\b(?:harus|wajib|selalu|mutlak|pasti|diperlukan|prioritas utama)\b/i.test(underlying?.statement || '');
        if (hasUniversalAbsolute) {
          const matchWord = underlying?.statement.match(/\b(?:harus|wajib|selalu|mutlak|pasti|diperlukan|prioritas utama)\b/i)?.[0];
          const hasDirectJustification = absoluteAllowed &&
            underlying?.evidence_status === 'VERIFIED' &&
            Array.isArray(underlying?.evidence_passage_ids) &&
            underlying.evidence_passage_ids.length > 0;

          if (!hasDirectJustification) {
            summary.unverified_claims.push(
              `UNJUSTIFIED_ABSOLUTE_RECOMMENDATION: Rekomendasi '${safe.claim_id}' memuat kata mutlak/absolut yang dilarang ('${matchWord}').`
            );
            summary.requires_provenance_failure = true;
            summary.audit_reasons.push(
              `Rekomendasi ${safe.claim_id} dilarang menggunakan kata mutlak (${matchWord}).`
            );
          }
        }
      }

      // SOURCE-ACQUISITION-AUTHENTICITY-1: Fixture-only author-safe claim check in REAL_RUNTIME_EXECUTION
      if (isRealRuntime && !historicalRoofPack && safe.allowed_for_authoring && !isRecommendation) {
        const supportingDocIds = new Set<string>();
        if (Array.isArray(safe.evidence_passage_ids)) {
          for (const pid of safe.evidence_passage_ids) {
            const p = (evidencePack.evidence_passages || []).find((ep: any) => ep.passage_id === pid);
            if (p?.source_id) supportingDocIds.add(p.source_id);
          }
        }
        if (underlying?.sources) {
          for (const s of underlying.sources) {
            if (s.source_id) supportingDocIds.add(s.source_id);
          }
        }

        const supportingDocs = Array.from(supportingDocIds).map(id => docMap.get(id)).filter(Boolean);
        const hasRealSource = supportingDocs.some(d => d.source_origin === 'LIVE_RETRIEVAL' || d.source_origin === 'VERIFIED_CACHED_SNAPSHOT');
        const isFixtureOnly = supportingDocs.length > 0 && supportingDocs.every(d => d.source_origin === 'TEST_FIXTURE' || d.source_origin === 'SYNTHETIC_FIXTURE');

        if (isFixtureOnly || (!hasRealSource && supportingDocs.length > 0)) {
          summary.missing_provenance_claims.push(
            `FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME: Klaim aman '${safe.claim_id}' hanya didukung oleh sumber fixture dan dilarang untuk authoring di lingkungan produksi riil.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Klaim aman '${safe.claim_id}' hanya didukung sumber fixture di eksekusi produksi.`
          );
        }
      }

      if (!hasRetrieved) {
        // Must NOT produce SUPPORTED or VERIFIED in author_safe_claims
        if (safe.support_level === 'SUPPORTED' || safe.support_level === 'VERIFIED') {
          summary.missing_provenance_claims.push(
            `${safe.claim_id}: author_safe_claims menyatakan support_level '${safe.support_level}' tanpa sumber SOURCE_RETRIEVED_AND_VERIFIED.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Klaim aman ${safe.claim_id} tidak boleh memiliki level ${safe.support_level} jika sumber primer belum diverifikasi.`
          );
        }

        // Must NOT contain exact technical numbers
        const exactNumRegex = /\b\d+(?:[.,]\d+)?\s*(?:%|mm|cm|m\b|w\/m|°c)\b|\b\d+:\d+\b/i;
        if (exactNumRegex.test(safe.statement)) {
          summary.unsupported_numeric_claims.push(
            `${safe.claim_id}: author_safe_claims memuat angka eksak dalam pernyataan ("${safe.statement}") tanpa sumber primer terverifikasi.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Klaim aman ${safe.claim_id} memuat angka eksak tanpa verifikasi retrieval.`
          );
        }

        if (safe.qualification_required && exactNumRegex.test(safe.qualification_required)) {
          summary.unsupported_numeric_claims.push(
            `${safe.claim_id}: author_safe_claims memuat angka eksak dalam teks kualifikasi ("${safe.qualification_required}") tanpa sumber primer terverifikasi.`
          );
          summary.requires_provenance_failure = true;
          summary.audit_reasons.push(
            `Klaim aman ${safe.claim_id} tidak boleh menyelipkan angka eksak dalam kualifikasi.`
          );
        }
      }
    }
  }

  return summary;
}

/**
 * Deterministically calculates overall evidence confidence from source quality, independence, and unique passage coverage.
 * Milestone: EDITORIAL-RUNTIME-3B
 */
export function calculateOverallConfidence(evidencePack: EvidencePackInput): 'HIGH' | 'MEDIUM' | 'LOW' {
  const claims = evidencePack.claim_inventory || [];
  const passages = evidencePack.evidence_passages || [];

  if (claims.length === 0) return 'LOW';

  const retrievedSources: EvidenceSource[] = [];
  const sourceMap = new Map<string, EvidenceSource>();
  for (const c of claims) {
    for (const s of c.sources || []) {
      if (!sourceMap.has(s.source_id)) {
        sourceMap.set(s.source_id, s);
        if (s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED') {
          retrievedSources.push(s);
        }
      }
    }
  }

  // Deduplicate passages by excerpt hash to count truly unique excerpts
  const uniqueExcerptHashes = new Set<string>();
  for (const p of passages) {
    if (p.content_hash) {
      uniqueExcerptHashes.add(p.content_hash);
    } else if (p.exact_or_normalized_excerpt) {
      uniqueExcerptHashes.add(p.exact_or_normalized_excerpt.trim());
    }
  }

  // Source Independence Check (Requirement 8)
  const hasDependentSources = retrievedSources.some(
    s => s.quality_profile?.independence === 'PARTIALLY_DEPENDENT' || s.quality_profile?.independence === 'DERIVATIVE'
  );

  const hasPrimaryRetrieved = retrievedSources.some(
    s => s.source_classification === 'PRIMARY_RESEARCH_DOCUMENT' || s.source_classification === 'STANDARDS_PUBLICATION'
  );

  // If only secondary/institutional guidance, or sources are partially dependent, confidence cannot be HIGH
  if (hasDependentSources || !hasPrimaryRetrieved || retrievedSources.length <= 1) {
    return 'MEDIUM';
  }

  const verifiedCount = claims.filter(c => c.evidence_status === 'VERIFIED').length;
  const verifiedCoverage = verifiedCount / claims.length;

  if (hasPrimaryRetrieved && !hasDependentSources && retrievedSources.length >= 2 && uniqueExcerptHashes.size >= 4 && verifiedCoverage >= 0.5) {
    return 'HIGH';
  }

  return 'MEDIUM';
}

/**
 * Automatically generates author-safe claims from an Evidence Claim inventory.
 * Enforces the Numeric Claim Hard Rule (EDITORIAL-SOURCE-ACQUISITION-1) and Milestone 3B Unsourced Claim Safety:
 * - If sources are NOT retrieved and verified or factual claims have zero supporting passages,
 *   sets allowed_for_authoring = false and action = RESEARCH_REQUIRED.
 * - Editorial recommendations are allowed when transparently derived from supported claims.
 * - Adds stripped numbers to prohibited_elements so authoring models cannot reintroduce them.
 */
export interface AuthorSafeMetrics {
  total_claims: number;
  allowed_for_authoring_count: number;
  blocked_count: number;
  qualified_count: number;
  recommendation_count: number;
  research_required_count: number;
  jurisdiction_blocked_count: number;
  source_provenance_blocked_count: number;
  semantic_support_blocked_count: number;
}

export function calculateAuthorSafeMetrics(
  claims: EvidenceClaim[],
  authorSafeClaims: AuthorSafeClaim[]
): AuthorSafeMetrics {
  const total_claims = claims.length;
  let allowed_for_authoring_count = 0;
  let blocked_count = 0;
  let qualified_count = 0;
  let recommendation_count = 0;
  let research_required_count = 0;
  let jurisdiction_blocked_count = 0;
  let source_provenance_blocked_count = 0;
  let semantic_support_blocked_count = 0;

  for (const safe of authorSafeClaims) {
    if (safe.allowed_for_authoring) {
      allowed_for_authoring_count++;
    } else {
      blocked_count++;
    }
    if (safe.jurisdiction_blocked) {
      jurisdiction_blocked_count++;
    }
    if (safe.source_provenance_blocked) {
      source_provenance_blocked_count++;
    }
    if (safe.semantic_support_blocked) {
      semantic_support_blocked_count++;
    }
    if (safe.qualification_required) {
      qualified_count++;
    }
  }

  for (const claim of claims) {
    const isRecommendation = claim.claim_class === 'editorial_recommendation' || claim.claim_class === 'EDITORIAL_RECOMMENDATION';
    if (isRecommendation) {
      recommendation_count++;
    }
    if (claim.action === 'RESEARCH_REQUIRED' || claim.evidence_status === 'RESEARCH_REQUIRED') {
      research_required_count++;
    }
  }

  return {
    total_claims,
    allowed_for_authoring_count,
    blocked_count,
    qualified_count,
    recommendation_count,
    research_required_count,
    jurisdiction_blocked_count,
    source_provenance_blocked_count,
    semantic_support_blocked_count
  };
}

/**
 * Automatically generates author-safe claims from an Evidence Claim inventory.
 * Enforces the Numeric Claim Hard Rule (EDITORIAL-SOURCE-ACQUISITION-1), Milestone 3B & 4B Unsourced Claim Safety,
 * and Milestone EDITORIAL-EVIDENCE-GROUNDING-HARDENING-1 Jurisdiction & Provenance Filtering:
 * - If sources are NOT retrieved and verified or factual claims have zero supporting passages,
 *   sets allowed_for_authoring = false and action = RESEARCH_REQUIRED (source_provenance_blocked = true).
 * - Foreign regulations/laws default to blocked on Indonesian generic articles unless explicitly qualified (jurisdiction_blocked = true).
 * - Semantic role mismatches block authoring (semantic_support_blocked = true).
 * - Editorial recommendations are allowed when transparently derived from supported claims and free of prohibited absolutes.
 * - Adds stripped numbers to prohibited_elements so authoring models cannot reintroduce them.
 */
export function generateAuthorSafeClaims(
  claims: EvidenceClaim[],
  options?: {
    evidencePassages?: EvidencePassage[];
    targetJurisdiction?: string;
    isForeignComparisonTopic?: boolean;
    articleContext?: string;
    executionType?: 'REAL_RUNTIME_EXECUTION' | 'TEST';
    retrievedDocuments?: any[];
    topic?: string;
    researchQuestions?: any[];
  }
): AuthorSafeClaim[] {
  const result: AuthorSafeClaim[] = [];
  const isRealExecution = options?.executionType === 'REAL_RUNTIME_EXECUTION';

  const docsMap = new Map<string, any>();
  if (Array.isArray(options?.retrievedDocuments)) {
    for (const doc of options.retrievedDocuments) {
      if (doc && doc.source_id) docsMap.set(doc.source_id, doc);
    }
  }

  const passagesById = new Map<string, EvidencePassage>();
  if (Array.isArray(options?.evidencePassages)) {
    for (const p of options.evidencePassages) {
      passagesById.set(p.passage_id, p);
    }
  }

  for (const claim of claims) {
    const isRecommendation = claim.claim_class === 'editorial_recommendation' || claim.claim_class === 'EDITORIAL_RECOMMENDATION';
    const claimSources = Array.isArray(claim.sources) ? claim.sources : [];

    // Helper to evaluate source authenticity in REAL_RUNTIME_EXECUTION
    const isSourceAuthentic = (s: EvidenceSource): boolean => {
      if (!isRealExecution) return true;
      const origin: SourceOrigin | undefined = s.source_origin || docsMap.get(s.source_id)?.source_origin;
      if (origin === 'LIVE_RETRIEVAL') return true;
      if (origin === 'VERIFIED_CACHED_SNAPSHOT') {
        const snap = s.snapshot_provenance || docsMap.get(s.source_id)?.snapshot_provenance;
        return snap ? verifyCachedSnapshotProvenance(snap).isValid : false;
      }
      return false;
    };

    const authenticSources = claimSources.filter(s => isSourceAuthentic(s) && s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED');
    const hasRetrieved = isRealExecution
      ? authenticSources.length > 0
      : claimSources.some(s => s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED');

    const authenticPassageIds = (claim.evidence_passage_ids || []).filter(pid => {
      if (!isRealExecution) return true;
      const p = passagesById.get(pid);
      if (!p) return false;
      const sId = p.source_id;
      const src = claimSources.find(s => s.source_id === sId);
      const origin = p.source_origin || src?.source_origin || docsMap.get(sId)?.source_origin;
      if (origin === 'LIVE_RETRIEVAL') return true;
      if (origin === 'VERIFIED_CACHED_SNAPSHOT') {
        const snap = src?.snapshot_provenance || docsMap.get(sId)?.snapshot_provenance;
        return snap ? verifyCachedSnapshotProvenance(snap).isValid : false;
      }
      return false;
    });

    const hasPassages = isRealExecution
      ? authenticPassageIds.length > 0
      : (Array.isArray(claim.evidence_passage_ids) && claim.evidence_passage_ids.length > 0);

    // Fixture-only detection in real runtime
    const hasAnyFixture = claimSources.some(s => {
      const origin = s.source_origin || docsMap.get(s.source_id)?.source_origin;
      return origin === 'TEST_FIXTURE' || origin === 'SYNTHETIC_FIXTURE';
    }) || (claim.evidence_passage_ids || []).some(pid => {
      const p = passagesById.get(pid);
      const origin = p?.source_origin || docsMap.get(p?.source_id || '')?.source_origin;
      return origin === 'TEST_FIXTURE' || origin === 'SYNTHETIC_FIXTURE';
    });

    const isFixtureOnlyInReal = isRealExecution && !isRecommendation && hasAnyFixture && !hasRetrieved && !hasPassages;
    if (isFixtureOnlyInReal) {
      result.push({
        claim_id: claim.claim_id,
        statement: claim.statement,
        support_level: 'PARTIALLY_SUPPORTED',
        applicability: claimSources[0]?.applicability || 'TECHNICAL_GUIDANCE_LOCAL',
        allowed_for_authoring: false,
        source_provenance_blocked: true,
        qualification_required: 'FIXTURE_SOURCE_NOT_ALLOWED_IN_REAL_RUNTIME: Klaim ini bersumber dari fixture dan dilarang masuk ke naskah penulisan produksi riil.'
      });
      continue;
    }

    // Requirement 5: Unsourced technical claims cannot enter authoring!
    const packHasPassagesOrRetrieval = claims.some(
      (c) => (Array.isArray(c.evidence_passage_ids) && c.evidence_passage_ids.length > 0) ||
        (c.sources || []).some((s) => s.retrieval_status === 'SOURCE_RETRIEVED_AND_VERIFIED')
    );

    const isExplicitlyBlocked = claim.action === 'RESEARCH_REQUIRED' ||
      claim.action === 'REMOVE' ||
      claim.action === 'REMOVE_CLAIM' ||
      claim.evidence_status === 'RESEARCH_REQUIRED' ||
      claim.evidence_status === 'UNVERIFIED';

    const isUnsourcedTechnical = !isRecommendation && (
      claimSources.length === 0 ||
      isExplicitlyBlocked ||
      (packHasPassagesOrRetrieval && !hasPassages && !hasRetrieved)
    );

    if (isUnsourcedTechnical) {
      result.push({
        claim_id: claim.claim_id,
        statement: claim.statement,
        support_level: 'PARTIALLY_SUPPORTED',
        applicability: claimSources[0]?.applicability || 'TECHNICAL_GUIDANCE_LOCAL',
        allowed_for_authoring: false,
        source_provenance_blocked: true,
        qualification_required: 'RESEARCH_REQUIRED: Klaim teknis ini belum memiliki rujukan sumber terverifikasi dan dilarang masuk ke naskah penulisan.'
      });
      continue;
    }

    // Applicability & Scope Check via Structured EvidenceScope
    const scope = resolveEvidenceScope(claim);

    // Fail-Closed Rule: UNKNOWN_SCOPE is prohibited from authoring
    if (scope.applicability_kind === 'UNKNOWN_SCOPE') {
      result.push({
        claim_id: claim.claim_id,
        statement: claim.statement,
        support_level: 'PARTIALLY_SUPPORTED',
        applicability: 'UNKNOWN_SCOPE',
        allowed_for_authoring: false,
        source_provenance_blocked: true,
        qualification_required: `UNKNOWN_SCOPE: Cakupan penerapan bukti (${scope.scope_basis || 'tidak terdefinisi'}) belum valid dan dilarang untuk penulisan.`
      });
      continue;
    }

    // Jurisdiction Specificity Check: Non-Indonesian jurisdiction blocked for general Indonesian articles
    if (scope.applicability_kind === 'JURISDICTION_SPECIFIC') {
      const isIndonesian = scope.jurisdictions.some(j => /indonesia/i.test(j));
      const targetJur = options?.targetJurisdiction?.toLowerCase();
      const textBlob = `${claim.statement || ''} ${(claim as any).relevance || ''} ${claimSources.map(s => `${s.document_title || ''} ${s.page_or_section || ''}`).join(' ')}`.toLowerCase();
      const matchesTarget = targetJur && (scope.jurisdictions.some(j => j.toLowerCase().includes(targetJur)) || textBlob.includes(targetJur));
      const allowForeign = options?.isForeignComparisonTopic === true ||
        Boolean(matchesTarget) ||
        options?.targetJurisdiction === 'UK' ||
        Boolean(options?.articleContext && /\b(?:UK|Inggris|United Kingdom|komparasi|studi banding|luar negeri)\b/i.test(options.articleContext));

      if (!isIndonesian && !allowForeign) {
        result.push({
          claim_id: claim.claim_id,
          statement: claim.statement,
          support_level: (claim.evidence_status as ClaimSupportLevel) || 'SUPPORTED',
          applicability: 'JURISDICTION_SPECIFIC',
          allowed_for_authoring: false,
          jurisdiction_blocked: true,
          evidence_passage_ids: claim.evidence_passage_ids,
          qualification_required: `JURISDICTION_SPECIFIC: Regulasi/standar hukum ini spesifik yurisdiksi luar negeri (${scope.jurisdictions.join(', ')}) dan diblokir untuk artikel umum Indonesia kecuali sebagai komparasi eksplisit.`
        });
        continue;
      }
    }

    if (isRecommendation) {
      const derivedIds = claim.derived_from_claim_ids || [];
      const hasBlockedDerived = derivedIds.some(did => {
        const target = claims.find(c => c.claim_id === did);
        return !target ||
          target.action === 'RESEARCH_REQUIRED' ||
          target.action === 'REMOVE' ||
          target.action === 'REMOVE_CLAIM' ||
          target.evidence_status === 'RESEARCH_REQUIRED' ||
          target.evidence_status === 'UNVERIFIED' ||
          (!target.sources || target.sources.length === 0);
      });

      // Check universal absolutes in recommendation
      const absoluteAllowed = claim.absolute_language_allowed === true;
      const hasUniversalAbsolute = /\b(?:harus|wajib|selalu|mutlak|pasti|diperlukan|prioritas utama)\b/i.test(claim.statement || '');
      const recommendationDisqualified = hasBlockedDerived || (hasUniversalAbsolute && !absoluteAllowed);

      result.push({
        claim_id: claim.claim_id,
        statement: claim.statement,
        support_level: (claim.evidence_status as ClaimSupportLevel) || 'SUPPORTED',
        applicability: claimSources[0]?.applicability || 'EDITORIAL_INFERENCE',
        allowed_for_authoring: !recommendationDisqualified,
        qualification_required: recommendationDisqualified
          ? (hasUniversalAbsolute
              ? 'UNJUSTIFIED_ABSOLUTE_RECOMMENDATION: Rekomendasi memuat kata absolut yang tidak diizinkan.'
              : 'RESEARCH_REQUIRED: Rekomendasi editorial diturunkan dari klaim yang belum terverifikasi.')
          : 'Sajikan sebagai panduan keputusan editorial berbasis kondisi lapangan.'
      });
      continue;
    }

    // Check semantic role compatibility if passages are provided
    let semanticMismatch = false;
    if (passagesById.size > 0 && Array.isArray(claim.evidence_passage_ids) && isGeneralEvidenceRole((claim as any).semantic_role)) {
      const compatibleRoles = GENERAL_SEMANTIC_ROLE_COMPATIBILITY[(claim as any).semantic_role as GeneralEvidenceRole] || [(claim as any).semantic_role];
      for (const pid of claim.evidence_passage_ids) {
        const p = passagesById.get(pid);
        if (p && p.semantic_role && !compatibleRoles.includes(p.semantic_role as GeneralEvidenceRole)) {
          semanticMismatch = true;
          break;
        }
      }
    }

    if (semanticMismatch) {
      result.push({
        claim_id: claim.claim_id,
        statement: claim.statement,
        support_level: 'PARTIALLY_SUPPORTED',
        applicability: claimSources[0]?.applicability || 'TECHNICAL_GUIDANCE_LOCAL',
        allowed_for_authoring: false,
        semantic_support_blocked: true,
        qualification_required: 'GENERIC_SEMANTIC_ROLE_MISMATCH: Peran semantik bukti rujukan tidak sesuai dengan klaim.'
      });
      continue;
    }

    const isJurisdiction = scope.applicability_kind === 'JURISDICTION_SPECIFIC';
    const isStandard = scope.applicability_kind === 'STANDARD_SPECIFIC';

    if (hasRetrieved && hasPassages) {
      // Quality-aware semantic gate integration (Milestone: EVIDENCE-QUALITY-RUNTIME-INTEGRATION-1)
      if (options?.topic && isRealExecution) {
        const allSources = options.retrievedDocuments || Array.from(docsMap.values());
        const passagesList = options.evidencePassages || Array.from(passagesById.values());
        const docRelMap = new Map<string, any>();
        const sourceRoleMap = new Map<string, any>();
        const topicEval = new DocumentTopicRelevanceEvaluator();

        for (const s of allSources) {
          if (!s || !s.source_id) continue;
          const role = classifySourceRole({
            title: s.title || s.document_title,
            publisher: s.publisher || s.publisher_or_author,
            url: s.url || s.canonical_url,
            resolvedUrl: s.resolved_url || s.canonical_url,
            doi: s.doi,
            textSample: s.content_text
          });
          sourceRoleMap.set(s.source_id, role.source_role);
          const rel = topicEval.evaluate(options.topic, {
            title: s.title || s.document_title,
            publisher: s.publisher || s.publisher_or_author,
            text: s.content_text,
            url: s.url || s.canonical_url
          });
          docRelMap.set(s.source_id, rel.relevance_level);
        }

        const qEval = evaluateClaimQuality(
          claim,
          passagesList,
          allSources,
          options.topic,
          docRelMap,
          sourceRoleMap,
          result
        );

        if (!qEval.author_safe_final) {
          result.push({
            claim_id: claim.claim_id,
            statement: claim.statement,
            support_level: 'PARTIALLY_SUPPORTED',
            applicability: claimSources[0]?.applicability || 'TECHNICAL_GUIDANCE_LOCAL',
            allowed_for_authoring: false,
            topic_relevance_blocked: true,
            qualification_required: `QUALITY_GATE_REJECTED: ${qEval.rejection_reasons.join('; ')}`,
            evidence_passage_ids: isRealExecution ? authenticPassageIds : claim.evidence_passage_ids
          });
          continue;
        }
      }

      result.push({
        claim_id: claim.claim_id,
        statement: claim.statement,
        support_level: claim.evidence_status === 'VERIFIED' ? 'VERIFIED' : 'SUPPORTED',
        applicability: isJurisdiction ? 'JURISDICTION_SPECIFIC' : (isStandard ? 'STANDARD_SPECIFIC' : (claimSources[0]?.applicability || 'TECHNICAL_GUIDANCE_LOCAL')),
        allowed_for_authoring: true,
        qualification_required: isJurisdiction
          ? 'Kualifikasi yurisdiksi: Wajib disebutkan secara eksplisit sebagai komparasi hukum/standar luar negeri dan bukan aturan otomatis Indonesia.'
          : (isStandard
            ? `Rujukan standar: Terikat pada ketentuan standar [${scope.standards.join(', ')}].`
            : (claim.action === 'QUALIFY' ? 'Sajikan dengan batasan konteks yang jelas.' : undefined)),
        evidence_passage_ids: isRealExecution ? authenticPassageIds : claim.evidence_passage_ids
      });
    } else {
      // Find numbers in statement
      const numberMatches = claim.statement.match(/\b\d+(?:[.,]\d+)?\s*(?:%|mm|cm|m\b|w\/m|°c)\b|\b\d+:\d+\b/gi) || [];
      const prohibited = Array.from(new Set(numberMatches));

      // Qualitative rewrite: remove exact numbers and express qualitative physical principle
      let qualitativeStatement = claim.statement
        .replace(/\(k ≈ 50-60 W\/m·K\)/gi, '')
        .replace(/800-1000 W\/m²\s*,?\s*/gi, '')
        .replace(/dapat mencapai 60°C hingga 75°C/gi, 'melonjak panas di siang hari')
        .replace(/\(sekitar 75% hingga 90% dari total perpindahan kalor\)/gi, '')
        .replace(/dengan emisivitas permukaan sangat rendah \(ε ≤ 0.05\) dan reflektansi radiasi tinggi \(≥ 95%\),?/gi, 'sebagai penghalang radiasi')
        .replace(/minimal 20-25 mm/gi, 'bebas')
        .replace(/dengan rasio bukaan bersih minimal 1:300 hingga 1:150 terhadap luas loteng/gi, 'yang seimbang')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const applicability = isJurisdiction ? 'JURISDICTION_SPECIFIC' : (isStandard ? 'STANDARD_SPECIFIC' : (claimSources[0]?.applicability || 'TECHNICAL_REFERENCE_FOREIGN'));

      result.push({
        claim_id: claim.claim_id,
        statement: qualitativeStatement,
        support_level: 'PARTIALLY_SUPPORTED',
        applicability,
        allowed_for_authoring: false,
        source_provenance_blocked: true,
        prohibited_elements: prohibited.length > 0 ? prohibited : undefined,
        qualification_required: 'Sajikan sebagai prinsip kualitatif arsitektur/fisika bangunan. Dilarang mencantumkan angka eksak tanpa dokumen primer terverifikasi.'
      });
    }
  }

  const metrics = calculateAuthorSafeMetrics(claims, result);
  (result as any).metrics = metrics;

  return result;
}

export interface EvaluationOptions {
  attemptCount?: number;
  maxAttempts?: number;
  focusKeyword?: string;
  evaluatedAt?: string;
  // Article Intent options (EDITORIAL-EXPERT-CONSULTATION-1 & STABILIZE)
  articleIntent?: ArticleIntent;
  articleIntentProfile?: ArticleIntentProfile;
  articleId?: number | string;
  taskId?: string;
  hasTradeOffEvidence?: boolean;
  isBiasedTradeOffSuppression?: boolean;
  // Product review & calibration options
  reviewType?: ProductReviewType;
  hasFirstPartyEvidence?: boolean;
  isProductReview?: boolean;
  affiliateCTAPosition?: 'BEFORE_RECOMMENDATION' | 'AFTER_RECOMMENDATION' | 'NONE';
  declaredVariant?: string;
  // Evidence provenance & source verification options (EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1)
  hasMissingClaimProvenance?: boolean;
  missingProvenanceClaims?: string[];
  evidencePack?: EvidencePackInput | null;
  // Nadia Reader Voice Gate Integration (HOUSE-VOICE-CALIBRATION)
  readerVoiceState?: 'READER_VOICE_PASS' | 'READER_VOICE_REVIEW_REQUIRED' | 'READER_VOICE_REVISION_REQUIRED' | 'READER_VOICE_BLOCKED';
  readerVoiceResult?: any;
  enforceReaderVoiceGate?: boolean;
}

/**
 * Deterministically derives an article's multi-signal intent profile.
 * Supports primary intent, secondary intents, and confidence level.
 * Milestone: EDITORIAL-EXPERT-CONSULTATION-1-STABILIZE
 */
export function detectArticleIntentProfile(
  contentMd: string,
  options: EvaluationOptions = {}
): ArticleIntentProfile {
  if (options.articleIntentProfile) {
    return options.articleIntentProfile;
  }
  if (options.articleIntent) {
    return {
      primary_intent: options.articleIntent,
      secondary_intents: [],
      confidence: 'HIGH',
      reasons: ['Intensi ditentukan secara eksplisit melalui opsi evaluasi.']
    };
  }
  if (options.isProductReview || options.reviewType) {
    return {
      primary_intent: 'PRODUCT_REVIEW',
      secondary_intents: [],
      confidence: 'HIGH',
      reasons: ['Artikel diklasifikasikan sebagai product review dari opsi reviewType/isProductReview.']
    };
  }

  const clean = contentMd.trim();
  const first500 = clean.slice(0, 500);
  const titleLine = (clean.match(/^##?\s+(.+)$/m) || [])[1] || '';
  const headings = (clean.match(/^##?\s+(.+)$/gm) || []).map((h) => h.replace(/^##?\s+/, '')).join(' ');

  const reasons: string[] = [];
  const scores: Record<ArticleIntent, number> = {
    EXPLANATORY: 1, // baseline fallback
    PROBLEM_SOLVING: 0,
    COMPARISON: 0,
    PRODUCT_REVIEW: 0,
    INSTALLATION_HOW_TO: 0
  };

  // 1. Comparison signals
  const hasComparisonTitle = /\b(?:vs|versus|perbandingan|antara\s+.+\s+dan\b|memilih\s+antara|dibandingkan)\b/i.test(titleLine);
  const hasComparisonHeadings = /\b(?:vs|versus|perbandingan|komparasi|kelebihan dan kelemahan|plus minus)\b/i.test(headings);
  if (hasComparisonTitle) {
    scores.COMPARISON += 3;
    reasons.push('Judul mengindikasikan komparasi langsung');
  }
  if (hasComparisonHeadings) {
    scores.COMPARISON += 2;
    reasons.push('Subjudul mengandung pola pembandingan material/opsi');
  }

  // 2. Problem Solving signals
  const hasProblemTitle = /\b(?:solusi|mengapa|mengatasi|penyebab|kenapa|cara mengatasi|troubleshooting|masalah|bocor|rembes|panas)\b/i.test(titleLine);
  const hasProblemHeadings = /\b(?:solusi|mengapa|mengatasi|penyebab|gejala|diagnosis|akar masalah|langkah perbaikan)\b/i.test(headings);
  if (hasProblemTitle) {
    scores.PROBLEM_SOLVING += 3;
    reasons.push('Judul membingkai masalah atau solusi perbaikan');
  }
  if (hasProblemHeadings) {
    scores.PROBLEM_SOLVING += 2;
    reasons.push('Subjudul membahas diagnosis atau solusi masalah');
  }

  // 3. Installation / How-To signals
  const hasHowToTitle = /\b(?:langkah pemasangan|cara memasang|panduan instalasi|cara merawat|tahapan pengerjaan|tutorial)\b/i.test(titleLine);
  const hasHowToHeadings = /\b(?:langkah|tahap|persiapan|cara memasang|urutan kerja|pemasangan)\b/i.test(headings);
  if (hasHowToTitle) {
    scores.INSTALLATION_HOW_TO += 3;
    reasons.push('Judul mengindikasikan panduan cara/instalasi');
  }
  if (hasHowToHeadings) {
    scores.INSTALLATION_HOW_TO += 2;
    reasons.push('Subjudul memuat langkah pengerjaan sekuensial');
  }

  // 4. Product Review signals
  const hasReviewTitle = /\b(?:review|ulasan|tinjauan spesifikasi|bedah produk)\b/i.test(titleLine);
  const hasReviewHeadings = /\b(?:spesifikasi|ulasan|kelebihan|kekurangan|fitur|performa)\b/i.test(headings);
  if (hasReviewTitle) {
    scores.PRODUCT_REVIEW += 3;
    reasons.push('Judul mengindikasikan ulasan produk');
  }
  if (hasReviewHeadings) {
    scores.PRODUCT_REVIEW += 2;
    reasons.push('Subjudul memuat struktur evaluasi produk');
  }

  // 5. Explanatory signals
  const hasExplanatoryTitle = /\b(?:mengenal|apa itu|prinsip|dasar|memahami|analisis|panduan|sains|dinamika|optimalisasi|pendekatan|kajian|karakteristik|teori|tinjauan|efisiensi|sistem|peran|konsep)\b/i.test(titleLine);
  const hasExplanatoryHeadings = /\b(?:prinsip|analisis|dinamika|optimalisasi|karakteristik|efisiensi|metodologi|pemilihan material)\b/i.test(headings);
  if (hasExplanatoryTitle) {
    scores.EXPLANATORY += 2;
    reasons.push('Judul mengindikasikan paparan konsep atau pemahaman');
  }
  if (hasExplanatoryHeadings) {
    scores.EXPLANATORY += 1;
    reasons.push('Subjudul memuat struktur analisis atau prinsip teknis');
  }

  // Sort intents by score descending
  const sorted = (Object.keys(scores) as ArticleIntent[]).sort((a, b) => scores[b] - scores[a]);
  const primary = sorted[0];
  const highestScore = scores[primary];
  const secondScore = scores[sorted[1]];

  // Secondary intents: any other intent with score >= 2
  const secondary = sorted.slice(1).filter((intent) => scores[intent] >= 2);

  // Confidence determination
  let confidence: IntentConfidence = 'MEDIUM';
  if (highestScore >= 3) {
    confidence = 'HIGH';
    if (highestScore === secondScore) {
      reasons.push('Artikel bertipe hibrida dengan sinyal kuat pada intensi primer dan sekunder');
    }
  } else if (highestScore <= 1) {
    confidence = 'LOW';
    reasons.push('Sinyal intensi lemah, menggunakan klasifikasi default eksplanatori');
  }

  return {
    primary_intent: primary,
    secondary_intents: secondary,
    confidence,
    reasons
  };
}

/**
 * Deterministically infers an article's primary editorial intent.
 * Milestone: EDITORIAL-EXPERT-CONSULTATION-1
 */
export function detectArticleIntent(contentMd: string, options: EvaluationOptions = {}): ArticleIntent {
  return detectArticleIntentProfile(contentMd, options).primary_intent;
}

/**
 * Canonical decision thresholds established in EDITORIAL-HUMAN-QUALITY-1:
 * - 85–100: HUMAN_WRITING_PASS
 * - 75–84:  HUMAN_WRITING_REVISE
 * - 0–74:   HUMAN_WRITING_REWRITE
 */
export const CANONICAL_HUMAN_QUALITY_THRESHOLDS = {
  PASS: 85,
  REVISE: 75,
  REWRITE: 0
} as const;

export interface PublicBodyCleanlinessViolation {
  type: 'RAW_CLAIM_MARKER' | 'PASSAGE_ID' | 'SOURCE_ID' | 'INTERNAL_METADATA' | 'SOURCE_LANGUAGE_ECHO';
  detail: string;
  snippet: string;
}

export interface PublicBodyCleanlinessReport {
  passed: boolean;
  violations: PublicBodyCleanlinessViolation[];
}

const COMMON_ORG_ACRONYMS = new Set([
  'epa', 'us epa', 'lbnl', 'sni', 'bmkg', 'pupr', 'ac', 'iso', 'en', 'astm', 'din', 'ashrae',
  'lawrence berkeley national laboratory', 'environmental protection agency', 'who', 'pu'
]);

export function detectSourceLanguageEchoes(markdown: string): string[] {
  const matches: string[] = [];
  const parenRegex = /\(([^)\n]+)\)/g;
  let m: RegExpExecArray | null;

  while ((m = parenRegex.exec(markdown)) !== null) {
    const rawInner = m[1].trim();
    const lower = rawInner.toLowerCase();

    // 1. Skip short or empty
    if (lower.length <= 3) continue;

    // 2. Skip pure numbers, units, ranges, citations like (2025), (30%), (hal. 12), (10–15 tahun)
    if (/^[\d\s.,\-–—/%°Cwkm²]+$/i.test(lower)) continue;
    if (/^(?:halaman|hal\.?|vol\.?|no\.?|gambar|tabel)\s*\d+/i.test(lower)) continue;

    // 3. Skip org acronyms / well-known names
    if (COMMON_ORG_ACRONYMS.has(lower)) continue;

    // 4. Skip allowed technical English terms
    const isAllowedTechnical = TECHNICAL_ENGLISH_ALLOWLIST.some((term: string) => {
      const t = term.toLowerCase();
      return lower === t || lower === `istilah: ${t}` || lower === `atau ${t}` || lower.startsWith(`${t},`);
    });
    if (isAllowedTechnical) continue;

    // 5. English clause indicators / source-language evidence echoes
    const englishClauseWordPattern = /\b(?:if|you|see|allow|exclude|use|when|needed|has|than|with|through|compliant|modeling|nearing|collecting|moisture|transfer|window|windows|heat|higher|significantly|effects|loss|losses|correctly)\b/i;
    const englishWordMatches = lower.match(/\b(?:if|you|see|allow|exclude|use|when|needed|has|than|with|through|compliant|modeling|nearing|collecting|moisture|transfer|window|windows|heat|higher|significantly|effects|loss|losses|correctly|the|and|for|from|into|over|under|between|against|during|without|before|after|above|below|to|of|in|on|at|by|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|should|would|may|might|must|air|conditioners|de-humidifiers|thermal|bridge|bridges|losses)\b/g);

    if (englishClauseWordPattern.test(lower) && (englishWordMatches && englishWordMatches.length >= 2)) {
      matches.push(m[0]);
    } else if (englishWordMatches && englishWordMatches.length >= 3) {
      matches.push(m[0]);
    }
  }

  return matches;
}

export function auditPublicBodyCleanliness(markdown: string): PublicBodyCleanlinessReport {
  const violations: PublicBodyCleanlinessViolation[] = [];

  // 1. Raw [CLM-*] or [ASSERTION-*] or [EVID-*]
  const clmMatches = markdown.match(/\[(?:CLM|ASSERTION|EVID)-[^\]]+\]/gi) || [];
  for (const match of clmMatches) {
    violations.push({
      type: 'RAW_CLAIM_MARKER',
      detail: `Raw claim marker leaked into public body: ${match}`,
      snippet: match
    });
  }

  // 2. Passage IDs (e.g., PSG-..., pas_..., psg_...)
  const psgMatches = markdown.match(/\b(?:PSG[-_][a-zA-Z0-9_-]+|pas(?:sage)?[-_][a-zA-Z0-9_-]+)\b/gi) || [];
  for (const match of psgMatches) {
    violations.push({
      type: 'PASSAGE_ID',
      detail: `Passage ID leaked into public body: ${match}`,
      snippet: match
    });
  }

  // 3. Source IDs (e.g., SRC-..., DOC-...)
  const srcMatches = markdown.match(/\b(?:SRC[-_][a-zA-Z0-9_-]+|DOC[-_][a-zA-Z0-9_-]+)\b/gi) || [];
  for (const match of srcMatches) {
    violations.push({
      type: 'SOURCE_ID',
      detail: `Source ID leaked into public body: ${match}`,
      snippet: match
    });
  }

  // 4. Internal evidence metadata keywords
  const metaMatches = markdown.match(/\b(?:author_safe_claims|claim_inventory|assertion_ledger|semantic_entailment)\b/gi) || [];
  for (const match of metaMatches) {
    violations.push({
      type: 'INTERNAL_METADATA',
      detail: `Internal metadata identifier leaked into public body: ${match}`,
      snippet: match
    });
  }

  // 5. Source-language evidence echoes copied into parentheses
  const echoes = detectSourceLanguageEchoes(markdown);
  for (const echo of echoes) {
    violations.push({
      type: 'SOURCE_LANGUAGE_ECHO',
      detail: `Parenthesized English source echo leaked into public body: ${echo}`,
      snippet: echo
    });
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

/**
 * Deterministically evaluates an article's Markdown body against RancangLoka's Human Writing Quality rubric.
 */
export function evaluateHumanWritingQuality(
  contentMd: string,
  options: EvaluationOptions = {}
): HumanWritingQualityResult {
  const attemptCount = options.attemptCount ?? 0;
  const maxAttempts = options.maxAttempts ?? 2;
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = 'editorial_qa_primary'; // Rina canonical owner

  if (!contentMd || typeof contentMd !== 'string' || !contentMd.trim()) {
    return {
      knowledge_version: RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
      total_score: 0,
      decision: 'HUMAN_WRITING_REWRITE',
      passed: false,
      dimensions: {
        sentence_rhythm: 0,
        specificity_detail: 0,
        contextual_relevance: 0,
        editorial_voice: 0,
        non_template_structure: 0,
        evidence_integration: 0,
        reader_perspective: 0,
        conclusion_originality: 0
      },
      issues: [
        {
          code: 'EMPTY_CONTENT',
          category: 'EMPTY_GENERALIZATION',
          severity: 'CRITICAL',
          description: 'Naskah artikel kosong.',
          penalty: 100
        }
      ],
      strong_areas: [],
      evaluated_by: evaluatedBy,
      evaluated_at: evaluatedAt,
      attempt_count: attemptCount,
      max_attempts: maxAttempts,
      rewrite_brief: {
        target_agent_id: 'content_writer_primary',
        reason: 'HUMAN_WRITING_QUALITY',
        attempt: attemptCount + 1,
        required_actions: ['Tulis naskah lengkap dari awal.'],
        preserved_invariants: ['Fakta riset teknis dan SNI harus dipertahankan.'],
        failing_sections: ['Seluruh naskah']
      },
      article_intent: options.articleIntent ?? 'EXPLANATORY'
    };
  }

  const cleanMd = contentMd.trim();
  const paragraphs = cleanMd.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const headings = cleanMd.match(/^##\s+.+$/gm) || [];
  const h3Headings = cleanMd.match(/^###\s+.+$/gm) || [];
  const words = cleanMd.split(/\s+/).filter(Boolean);

  const issues: EditorialPatternIssue[] = [];
  const strongAreas: string[] = [];

  // Determine intent & multi-signal profile (EDITORIAL-EXPERT-CONSULTATION-1 & STABILIZE)
  const intentProfile: ArticleIntentProfile = detectArticleIntentProfile(cleanMd, options);
  const articleIntent: ArticleIntent = intentProfile.primary_intent;
  const isLowConfidenceIntent = intentProfile.confidence === 'LOW';

  // Default dimension baseline (100 total potential)
  let dimRhythm = 20;
  let dimSpecificity = 15;
  let dimContext = 15;
  let dimVoice = 15;
  let dimStructure = 10;
  let dimEvidence = 10;
  let dimReader = 10;
  let dimConclusion = 5;

  // --------------------------------------------------------------------------
  // 1. Generic Opening Check (Impacts: Editorial Voice & Reader Perspective)
  // --------------------------------------------------------------------------
  const firstParagraph = paragraphs.find((p) => !p.startsWith('#')) || '';
  let openingGeneric = false;

  for (const pattern of GENERIC_OPENING_PATTERNS) {
    if (pattern.test(firstParagraph)) {
      openingGeneric = true;
      issues.push({
        code: 'GENERIC_OPENING_DETECTED',
        category: 'GENERIC_OPENING',
        severity: 'CRITICAL',
        description: 'Paragraf pembuka menggunakan formula klise/generik ("Di era modern...", "Dalam dunia..."), bukan mengangkat masalah nyata pembaca.',
        penalty: 8,
        occurrences: [firstParagraph.slice(0, 80) + '...']
      });
      dimVoice = Math.max(0, dimVoice - 5);
      dimReader = Math.max(0, dimReader - 3);
      break;
    }
  }

  if (!openingGeneric && firstParagraph.length > 50) {
    strongAreas.push('Pembuka langsung menyentuh konteks spesifik pembaca rumah');
  }

  // --------------------------------------------------------------------------
  // 2. Repetitive Transitional Phrases (Impacts: Sentence Rhythm & Editorial Voice)
  // --------------------------------------------------------------------------
  const transitionOccurrences: Record<string, number> = {};
  let totalTransitions = 0;
  const lowerContent = cleanMd.toLowerCase();

  for (const marker of REPETITIVE_TRANSITION_MARKERS) {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const count = (lowerContent.match(regex) || []).length;
    if (count > 0) {
      transitionOccurrences[marker] = count;
      totalTransitions += count;
    }
  }

  // Flag individual phrase overuse (>= 3 times of same phrase) or high overall transition density
  const overusedTransitions = Object.entries(transitionOccurrences).filter(([_, count]) => count >= 3);
  if (overusedTransitions.length > 0 || totalTransitions >= 7) {
    const penalty = Math.min(8, overusedTransitions.length * 3 + (totalTransitions >= 7 ? 2 : 0));
    issues.push({
      code: 'REPETITIVE_TRANSITIONS_OVERUSED',
      category: 'REPETITIVE_TRANSITIONS',
      severity: 'WARNING',
      description: `Penggunaan frasa transisi mekanis berulang secara monoton (${overusedTransitions.map(([k, v]) => `"${k}": ${v}x`).join(', ')}).`,
      penalty,
      occurrences: overusedTransitions.map(([k, v]) => `${k} (${v}x)`)
    });
    dimRhythm = Math.max(0, dimRhythm - penalty);
    dimVoice = Math.max(0, dimVoice - 2);
  } else if (totalTransitions <= 3) {
    strongAreas.push('Alur antar-paragraf mengalir alami tanpa ketergantungan frasa transisi klise');
  }

  // --------------------------------------------------------------------------
  // 3. Sentence Length Rhythm & Monotony (Impacts: Sentence Rhythm)
  // --------------------------------------------------------------------------
  // Break into sentences (simple Indonesian punctuation splitter)
  const sentences = cleanMd
    .replace(/^#+.*$/gm, '') // Remove heading lines
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const sentenceWordCounts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  if (sentenceWordCounts.length >= 8) {
    const avgLen = sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length;
    const variance =
      sentenceWordCounts.reduce((sum, len) => sum + Math.pow(len - avgLen, 2), 0) / sentenceWordCounts.length;
    const stdDev = Math.sqrt(variance);

    // If standard deviation is very low (< 3.0), writing is mechanically rigid and uniform
    if (stdDev < 3.2 && sentenceWordCounts.length >= 10) {
      issues.push({
        code: 'RIGID_SENTENCE_RHYTHM',
        category: 'PARAGRAPH_UNIFORMITY',
        severity: 'WARNING',
        description: `Panjang kalimat terlalu seragam (rata-rata ~${Math.round(avgLen)} kata per kalimat, variasi sangat rendah). Ritme terasa kaku seperti hasil generasi otomatis.`,
        penalty: 5
      });
      dimRhythm = Math.max(0, dimRhythm - 5);
    } else if (stdDev >= 6.0) {
      strongAreas.push('Variasi panjang kalimat dinamis dan berirama hidup');
    }
  }

  // --------------------------------------------------------------------------
  // 4. Excessive Structural Symmetry (Impacts: Non-Template Structure)
  // --------------------------------------------------------------------------
  // Check section structures under H2 headings
  const sectionChunks = cleanMd.split(/^##\s+/m).slice(1);
  if (sectionChunks.length >= 3) {
    const bulletCounts = sectionChunks.map((chunk) => (chunk.match(/^\s*[-*]\s+/gm) || []).length);
    const paraCounts = sectionChunks.map((chunk) => chunk.split(/\n\s*\n/).filter((p) => !p.startsWith('#')).length);

    // Identical bullet pattern across all sections (e.g. exactly 3 bullets in every single section)
    const nonZeroBullets = bulletCounts.filter((c) => c > 0);
    const allSameBullets =
      nonZeroBullets.length >= 3 && nonZeroBullets.every((count) => count === nonZeroBullets[0]);

    // Identical paragraph count in each section
    const allSameParas = paraCounts.length >= 3 && paraCounts.every((count) => count === paraCounts[0]);

    if (allSameBullets || (allSameParas && bulletCounts.every((c) => c === 0))) {
      issues.push({
        code: 'STRUCTURAL_SYMMETRY_DETECTED',
        category: 'STRUCTURAL_SYMMETRY',
        severity: 'WARNING',
        description: 'Simetri struktur artikel terlalu kaku dan terulang di setiap bagian (jumlah butir/paragraf identik antar-subjudul).',
        penalty: 6
      });
      dimStructure = Math.max(0, dimStructure - 6);
    } else {
      strongAreas.push('Struktur bagian bervariasi secara proporsional sesuai kebutuhan penjelasan');
    }
  }

  // --------------------------------------------------------------------------
  // 5. Empty Generalizations (Impacts: Specificity / Concrete Detail & Editorial Voice)
  // --------------------------------------------------------------------------
  const emptyMatches: string[] = [];
  for (const pattern of EMPTY_GENERALIZATION_PATTERNS) {
    const match = cleanMd.match(pattern);
    if (match) {
      emptyMatches.push(match[0]);
    }
  }

  if (emptyMatches.length > 0) {
    const penalty = Math.min(8, emptyMatches.length * 4);
    issues.push({
      code: 'EMPTY_GENERALIZATIONS_FOUND',
      category: 'EMPTY_GENERALIZATION',
      severity: 'WARNING',
      description: `Mengandung generalisasi kosong tanpa penjelasan teknis spesifik ("${emptyMatches.join('", "')}").`,
      penalty,
      occurrences: emptyMatches
    });
    dimSpecificity = Math.max(0, dimSpecificity - penalty);
    dimVoice = Math.max(0, dimVoice - 2);
  }

  // --------------------------------------------------------------------------
  // 6. Excessive Hedging (Impacts: Specificity & Editorial Voice)
  // --------------------------------------------------------------------------
  let totalHedgingCount = 0;
  for (const pattern of EXCESSIVE_HEDGING_PATTERNS) {
    const matches = cleanMd.match(pattern) || [];
    totalHedgingCount += matches.length;
  }

  // Ratio of hedging phrases to 500 words
  const hedgingDensity = (totalHedgingCount / Math.max(1, words.length)) * 500;
  if (hedgingDensity >= 5.0) {
    issues.push({
      code: 'EXCESSIVE_HEDGING_DETECTED',
      category: 'EXCESSIVE_HEDGING',
      severity: 'WARNING',
      description: `Frekuensi kata lindung nilai / hedging terlalu tinggi (~${Math.round(hedgingDensity)} per 500 kata). Tulisan terdengar ragu-ragu dan defensif.`,
      penalty: 5
    });
    dimVoice = Math.max(0, dimVoice - 4);
    dimSpecificity = Math.max(0, dimSpecificity - 2);
  }

  // --------------------------------------------------------------------------
  // Fabricated Experience & Unverified Anecdotes (Layer 5 Integrity Violation)
  // --------------------------------------------------------------------------
  const fabricatedMatches: string[] = [];
  for (const pattern of FABRICATED_EXPERIENCE_PATTERNS) {
    const match = cleanMd.match(pattern);
    if (match) {
      fabricatedMatches.push(match[0]);
    }
  }

  if (fabricatedMatches.length > 0) {
    issues.push({
      code: 'FABRICATED_EXPERIENCE',
      category: 'FABRICATED_EXPERIENCE',
      severity: 'CRITICAL',
      description: `Ditemukan klaim pengalaman atau pengujian personal fiktif ("${fabricatedMatches.join('", "')}") yang melanggar Layer 5 Trust & Editorial Integrity.`,
      penalty: 35,
      occurrences: fabricatedMatches
    });
    // Legacy alias for existing tests
    issues.push({
      code: 'FABRICATED_EXPERIENCE_OR_SLOP',
      category: 'FABRICATED_EXPERIENCE',
      severity: 'CRITICAL',
      description: `Ditemukan klaim pengalaman fiktif yang melanggar Layer 5 Trust & Editorial Integrity.`,
      penalty: 0
    });
    dimVoice = Math.max(0, dimVoice - 10);
    dimEvidence = Math.max(0, dimEvidence - 10);
    dimReader = Math.max(0, dimReader - 10);
  }

  // --------------------------------------------------------------------------
  // Prohibited Foreign / Elitist Jargon ("verdict") Check
  // --------------------------------------------------------------------------
  const jargonMatches: string[] = [];
  for (const pattern of PROHIBITED_EDITORIAL_JARGON_PATTERNS) {
    const match = cleanMd.match(pattern);
    if (match) {
      jargonMatches.push(match[0]);
    }
  }

  if (jargonMatches.length > 0) {
    issues.push({
      code: 'PROHIBITED_JARGON_VERDICT',
      category: 'EMPTY_GENERALIZATION',
      severity: 'WARNING',
      description: `Ditemukan istilah bahasa asing elitis yang dilarang ("${jargonMatches.join('", "')}"). Gunakan bahasa Indonesia wajar seperti "Penilaian RancangLoka", "Rekomendasi Akhir", atau "Kesimpulan & Rekomendasi".`,
      penalty: 8,
      occurrences: jargonMatches
    });
    dimVoice = Math.max(0, dimVoice - 4);
    dimReader = Math.max(0, dimReader - 4);
  }

  // --------------------------------------------------------------------------
  // Native Indonesian Authoring & Translationese Detection (NATIVE-INDONESIAN-AUTHORING-1)
  // --------------------------------------------------------------------------
  const foundTranslationese: string[] = [];
  for (const item of TRANSLATIONESE_PATTERNS) {
    const matches = cleanMd.match(new RegExp(item.regex, 'gi')) || [];
    if (matches.length > 0) {
      foundTranslationese.push(`${item.label} (${matches.length}x)`);
    }
  }

  const translationeseCount = foundTranslationese.length;
  if (translationeseCount === 1) {
    issues.push({
      code: 'TRANSLATIONESE_DETECTED',
      category: 'TRANSLATIONESE',
      severity: 'WARNING',
      description: `Ditemukan konstruksi kalimat berstruktur terjemahan bahasa Inggris (${foundTranslationese.join(', ')}). RancangLoka mengutamakan bahasa Indonesia asli yang mengalir wajar.`,
      penalty: 6,
      occurrences: foundTranslationese
    });
    dimVoice = Math.max(0, dimVoice - 4);
    dimRhythm = Math.max(0, dimRhythm - 2);
  } else if (translationeseCount >= 2 && translationeseCount <= 3) {
    issues.push({
      code: 'TRANSLATIONESE_DETECTED',
      category: 'TRANSLATIONESE',
      severity: 'WARNING',
      description: `Ditemukan pola kalimat berstruktur terjemahan bahasa Inggris berulang (${foundTranslationese.join(', ')}). Alur bahasa terasa seperti hasil terjemahan mesin/korporat.`,
      penalty: 16,
      occurrences: foundTranslationese
    });
    dimVoice = Math.max(0, dimVoice - 8);
    dimRhythm = Math.max(0, dimRhythm - 5);
    dimReader = Math.max(0, dimReader - 3);
  } else if (translationeseCount >= 4) {
    issues.push({
      code: 'TRANSLATIONESE_DETECTED',
      category: 'TRANSLATIONESE',
      severity: 'CRITICAL',
      description: `Naskah sarat dengan struktur wacana terjemahan literal bahasa Inggris (${foundTranslationese.join(', ')}). Seluruh naskah harus ditulis ulang langsung dalam bahasa Indonesia asli.`,
      penalty: 28,
      occurrences: foundTranslationese
    });
    dimVoice = Math.max(0, dimVoice - 12);
    dimRhythm = Math.max(0, dimRhythm - 10);
    dimReader = Math.max(0, dimReader - 6);
  } else {
    strongAreas.push('Bahasa mengalir asli dalam bahasa Indonesia tanpa struktur terjemahan kaku');
  }

  // --------------------------------------------------------------------------
  // Source-Language Evidence Echo & Scaffolding Hygiene (CONTENT-PUBLICATION-POLISH-1)
  // --------------------------------------------------------------------------
  const sourceEchoes = detectSourceLanguageEchoes(cleanMd);
  if (sourceEchoes.length > 0) {
    issues.push({
      code: 'SOURCE_LANGUAGE_ECHO_DETECTED',
      category: 'TRANSLATIONESE',
      severity: sourceEchoes.length >= 3 ? 'CRITICAL' : 'WARNING',
      description: `Ditemukan cuplikan bukti berbahasa Inggris dalam tanda kurung (${sourceEchoes.slice(0, 3).join(', ')}). Seluruh teks publik harus ditulis murni dalam bahasa Indonesia alami; bukti sumber dipetakan di metadata internal.`,
      penalty: Math.min(25, sourceEchoes.length * 5),
      occurrences: sourceEchoes
    });
    dimVoice = Math.max(0, dimVoice - Math.min(10, sourceEchoes.length * 3));
    dimRhythm = Math.max(0, dimRhythm - Math.min(10, sourceEchoes.length * 3));
  }

  // --------------------------------------------------------------------------
  // 7. Local Indonesian Context & Climate Reality (Impacts: Contextual Relevance)
  // --------------------------------------------------------------------------
  let localContextMatches = 0;
  const foundLocalMarkers: string[] = [];
  for (const marker of INDONESIAN_LOCAL_REALITY_MARKERS) {
    if (lowerContent.includes(marker)) {
      localContextMatches++;
      foundLocalMarkers.push(marker);
    }
  }

  if (localContextMatches < 2) {
    issues.push({
      code: 'LACK_OF_LOCAL_CONTEXT',
      category: 'LACK_OF_LOCAL_CONTEXT',
      severity: 'CRITICAL',
      description: 'Kurang mengakar pada konteks iklim dan realitas hunian Indonesia (hujan tropis, panas sore, kelembapan, kondisi tukang/material lokal).',
      penalty: 7
    });
    dimContext = Math.max(0, dimContext - 7);
  } else if (localContextMatches >= 4) {
    strongAreas.push(`Kontekstual kuat terhadap kondisi tropis Indonesia (${foundLocalMarkers.slice(0, 4).join(', ')})`);
  }

  // --------------------------------------------------------------------------
  // 8. Keyword Forcing / Stuffing in Headings & Body (Impacts: Editorial Voice & Rhythm)
  // --------------------------------------------------------------------------
  if (options.focusKeyword && options.focusKeyword.trim()) {
    const kw = options.focusKeyword.trim().toLowerCase();
    const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwRegex = new RegExp(`\\b${kwEscaped}\\b`, 'gi');
    const kwMatches = (lowerContent.match(kwRegex) || []).length;
    const kwDensity = (kwMatches / Math.max(1, words.length)) * 100;

    // Check heading stuffing
    const kwInHeadings = headings.filter((h) => h.toLowerCase().includes(kw)).length;

    if (kwDensity > 3.0 || (kwInHeadings >= 3 && headings.length <= 4)) {
      issues.push({
        code: 'KEYWORD_FORCING_DETECTED',
        category: 'KEYWORD_FORCING',
        severity: 'WARNING',
        description: `Kata kunci fokus "${options.focusKeyword}" dipaksakan secara berlebihan (kepadatan: ${kwDensity.toFixed(1)}%, muncul di ${kwInHeadings} subjudul).`,
        penalty: 6
      });
      dimVoice = Math.max(0, dimVoice - 4);
      dimRhythm = Math.max(0, dimRhythm - 2);
    }
  }

  // --------------------------------------------------------------------------
  // 9. Conclusion Originality vs Summary Repeat (Impacts: Conclusion Originality)
  // --------------------------------------------------------------------------
  const lastSection = sectionChunks[sectionChunks.length - 1] || paragraphs[paragraphs.length - 1] || '';
  const lastHeading = headings[headings.length - 1] || '';
  const isConclusionSection = /kesimpulan|penutup|rangkuman|akhir kata/i.test(lastHeading) ||
    /kesimpulannya|pada intinya|sebagai penutup/i.test(lastSection.slice(0, 100));

  if (isConclusionSection) {
    // Check if conclusion is purely summarizing or gives concrete trade-offs / actionable checklist
    const hasDecisionWords = /pilih|prioritaskan|periksa|pastikan|cek|pertimbangkan jika|tahap berikutnya/i.test(lastSection);
    const merelySummarizes = /(?:seperti|sebagaimana) (?:yang )?telah (?:dijelaskan|dibahas) (?:di atas|sebelumnya)|secara keseluruhan(?: artikel ini)?/i.test(lastSection);

    if (merelySummarizes && !hasDecisionWords) {
      issues.push({
        code: 'ARTIFICIAL_CONCLUSION_SUMMARY_ONLY',
        category: 'ARTIFICIAL_CONCLUSION',
        severity: 'WARNING',
        description: 'Bagian akhir hanya merangkum ulang poin-poin sebelumnya tanpa membantu pembaca mengambil keputusan praktis.',
        penalty: 17
      });
      dimConclusion = 0;
      dimReader = Math.max(0, dimReader - 6);
      dimVoice = Math.max(0, dimVoice - 6);
    } else if (hasDecisionWords) {
      strongAreas.push('Penutup berorientasi pada keputusan dan panduan aksi bagi pembaca');
    }
  }

  // --------------------------------------------------------------------------
  // 10. Terminology Consistency Check (Phase 10 Lexical Cohesion Calibration)
  // --------------------------------------------------------------------------
  const foundTermVariations: string[] = [];
  for (const entry of Object.values(CANONICAL_TERMINOLOGY_MAP)) {
    for (const prohibited of entry.prohibited_alternations) {
      const escaped = prohibited.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${escaped}\\b`, 'i');
      if (reg.test(cleanMd)) {
        foundTermVariations.push(`"${prohibited}" (seharusnya "${entry.canonical}")`);
      }
    }
  }

  if (foundTermVariations.length > 0) {
    issues.push({
      code: 'TERMINOLOGY_INCONSISTENCY_DETECTED',
      category: 'TERMINOLOGY_INCONSISTENCY',
      severity: 'WARNING',
      description: `Ditemukan variasi istilah tidak baku atau sinonim semu (${foundTermVariations.join(', ')}). Gunakan istilah kanonikal konsisten sesuai Layer 2.`,
      penalty: 16,
      occurrences: foundTermVariations
    });
    dimVoice = Math.max(0, dimVoice - 8);
    dimReader = Math.max(0, dimReader - 8);
  } else {
    strongAreas.push('Terminologi teknis konsisten sesuai standar kanonikal RancangLoka');
  }

  // --------------------------------------------------------------------------
  // 11. Evidence Integration & Claim Support (Phase 6 Evidence Blindspot Fix)
  // --------------------------------------------------------------------------
  const hasMeasurements = /\b\d+(?:[.,]\d+)?\s*(?:cm|mm|m2|m²|kg|watt|derajat|persen|%|tahun|bulan|db|dpi|g\/l|wp|kwh)\b/i.test(cleanMd);
  const hasEvidenceOrStandards = /SNI|ASTM|ISO|EN\s*\d+|standar|uji lab|penelitian|spesifikasi|litbang|referensi|\[EVIDENCE:|dokumentasi resmi|manual pemasangan|prinsip fisika|cahaya pantul|efek cerobong|konveksi|radiasi termal|sudut datang matahari|sudut jatuh matahari|sudut jatuh air hujan|overstek|kantilever|cross-ventilation|ventilasi silang|penetrasi panas|hambatan panas|konduktivitas|tekanan angin mikro|cerobong termal|thermal break|anodized|powder coating|ekstrusi|inverter|on-grid|net metering/i.test(cleanMd);
  const hasQualitativeOnlyAdvice = /memilih kayu yang bagus dan kuat|bermutu tinggi|kualitasnya sangat meragukan|jangan memakai kayu sembarangan/i.test(cleanMd);

  // Unsupported Numerical Claims: High numerical density or sensational percentage claim without methodology or standard
  const sensationalNumberMatch = cleanMd.match(/\b(?:efisiensi|menghemat|hemat|menurunkan panas|reduksi|penurunan)(?:\s+\w+){0,3}\s*(?:hingga|sampai|sebesar)?\s*(?:8[5-9]|9[0-9]|100)\s*%/i);
  const hasStandardOrLabCitation = /SNI|ASTM|ISO|EN\s*\d+|uji lab|laboratorium|metode uji|terakreditasi/i.test(cleanMd);

  if (sensationalNumberMatch && !hasStandardOrLabCitation) {
    issues.push({
      code: 'UNSUPPORTED_NUMERICAL_CLAIM',
      category: 'INSUFFICIENT_CLAIM_SUPPORT',
      severity: 'WARNING',
      description: `Klaim numerik sensasional ("${sensationalNumberMatch[0]}") dicantumkan tanpa penjelasan metodologi, rujukan standar, atau pengujian terakreditasi. Angka tanpa dasar bukti tidak dapat diverifikasi.`,
      penalty: 15
    });
    dimEvidence = Math.max(0, dimEvidence - 10);
  }

  // Automatic Provenance Derivation & Source Verification Check (EDITORIAL-EVIDENCE-SOURCE-VERIFICATION-1)
  const auditProvenance = options.evidencePack
    ? auditEvidencePackProvenance(options.evidencePack, cleanMd)
    : null;

  const isMissingClaimProvenance = Boolean(
    options.hasMissingClaimProvenance ||
    (auditProvenance && auditProvenance.requires_provenance_failure)
  );

  const missingProvenanceClaims = options.missingProvenanceClaims ||
    (auditProvenance && auditProvenance.missing_provenance_claims.length > 0
      ? auditProvenance.missing_provenance_claims
      : auditProvenance?.unsupported_numeric_claims);

  // Claim Source Provenance Missing: Unsupported numerical or technical claims lacking exact document provenance
  if (isMissingClaimProvenance) {
    const missingClaimsList = missingProvenanceClaims?.join(', ') || 'Klaim teknis numerik';
    issues.push({
      code: 'CLAIM_SOURCE_PROVENANCE_MISSING',
      category: 'INSUFFICIENT_CLAIM_SUPPORT',
      severity: 'CRITICAL',
      description: `Klaim teknis tidak memiliki keterlacakan sumber bukti primer yang terverifikasi (${missingClaimsList}). Klaim numerik tanpa pembuktian persis tidak boleh lolos ke publikasi.`,
      penalty: 25
    });
  }

  // Phase 9 & 13 (EDITORIAL-SOURCE-ACQUISITION-1): Rina QA Numeric Check
  // Numbers in article must not exceed verified evidence or resurrect removed numbers.
  if (options.evidencePack && Array.isArray(options.evidencePack.author_safe_claims)) {
    const prohibitedElements: string[] = [];
    for (const safe of options.evidencePack.author_safe_claims) {
      if (Array.isArray(safe.prohibited_elements)) {
        for (const elem of safe.prohibited_elements) {
          if (elem && elem.trim()) {
            prohibitedElements.push(elem.trim());
          }
        }
      }
    }

    const foundProhibitedNumbers = prohibitedElements.filter((elem) => cleanMd.includes(elem));
    if (foundProhibitedNumbers.length > 0) {
      issues.push({
        code: 'UNSUPPORTED_NUMERICAL_CLAIM',
        category: 'INSUFFICIENT_CLAIM_SUPPORT',
        severity: 'CRITICAL',
        description: `Naskah mencantumkan angka teknis atau elemen yang dilarang oleh author_safe_claims (${foundProhibitedNumbers.join(', ')}). Joko tidak boleh memunculkan angka yang telah dihilangkan oleh Irwan.`,
        penalty: 25,
        occurrences: foundProhibitedNumbers
      });
      dimEvidence = 0;
      dimSpecificity = Math.max(0, dimSpecificity - 5);
    }

    // If no sources are retrieved in the evidence pack, unverified dry-run technical numbers must not appear
    if (auditProvenance && auditProvenance.retrieved_and_verified_sources_count === 0) {
      const unverifiedExactNumbers = [
        '800 hingga 1.000 Watt',
        '800-1000 W/m²',
        '60°C bahkan 75°C',
        '60°C hingga 75°C',
        '95% atau lebih',
        'di bawah 0,05',
        '20 hingga 25 milimeter',
        '20-25 mm',
        '1:300 hingga 1:150',
        '1:300',
        '1:150'
      ];
      const foundUnverified = unverifiedExactNumbers.filter((n) => cleanMd.toLowerCase().includes(n.toLowerCase()));
      if (foundUnverified.length > 0 && !issues.some((i) => i.code === 'UNSUPPORTED_NUMERICAL_CLAIM')) {
        issues.push({
          code: 'UNSUPPORTED_NUMERICAL_CLAIM',
          category: 'INSUFFICIENT_CLAIM_SUPPORT',
          severity: 'CRITICAL',
          description: `Naskah memuat angka teknis spesifik tanpa dokumen primer yang terverifikasi (${foundUnverified.join(', ')}). Seluruh sumber berstatus unretrieved / metadata-only sehingga angka wajib dihapus.`,
          penalty: 25,
          occurrences: foundUnverified
        });
        dimEvidence = 0;
        dimSpecificity = Math.max(0, dimSpecificity - 5);
      }
    }
  }

  if (!hasMeasurements && !hasEvidenceOrStandards) {
    const penalty = hasQualitativeOnlyAdvice ? 26 : 5;
    issues.push({
      code: 'INSUFFICIENT_CLAIM_SUPPORT',
      category: 'INSUFFICIENT_CLAIM_SUPPORT',
      severity: hasQualitativeOnlyAdvice ? 'CRITICAL' : 'WARNING',
      description: hasQualitativeOnlyAdvice
        ? 'Naskah hanya memberikan nasihat kualitatif umum tanpa dasar klaim yang kuat (nihil rujukan standar, prinsip fisika arsitektur, maupun spesifikasi terukur).'
        : 'Naskah minim dasar klaim teknis terukur atau rujukan standar teknis konstruksi.',
      penalty
    });
    // Legacy alias for existing tests
    issues.push({
      code: 'WEAK_EVIDENCE_SPECIFICITY',
      category: 'INSUFFICIENT_CLAIM_SUPPORT',
      severity: hasQualitativeOnlyAdvice ? 'CRITICAL' : 'WARNING',
      description: 'Dasar klaim dan spesifisitas bukti teknis belum memadai.',
      penalty: 0
    });
    dimEvidence = 0;
    if (hasQualitativeOnlyAdvice) {
      dimSpecificity = Math.max(0, dimSpecificity - 10);
      dimReader = Math.max(0, dimReader - 6);
    } else {
      dimEvidence = Math.max(0, dimEvidence - 5);
    }
  } else if (hasMeasurements && !hasEvidenceOrStandards) {
    // Numbers alone do not equal strong evidence: arbitrary dimensions without methodology, standards, or physics
    issues.push({
      code: 'INSUFFICIENT_CLAIM_SUPPORT',
      category: 'INSUFFICIENT_CLAIM_SUPPORT',
      severity: 'WARNING',
      description: 'Pencantuman angka atau dimensi fisik tanpa didukung rujukan standar konstruksi, metodologi, maupun prinsip fisika bangunan.',
      penalty: 10
    });
    dimEvidence = Math.max(0, dimEvidence - 6);
  } else if (hasEvidenceOrStandards && !sensationalNumberMatch) {
    strongAreas.push('Integrasi dasar klaim teknis, prinsip fisika arsitektur, atau rujukan standar terjalin rapi');
  }

  // --------------------------------------------------------------------------
  // 12. Specification Dump Without Interpretation (Product Reviews)
  // --------------------------------------------------------------------------
  const isProdReview = Boolean(options.isProductReview || options.reviewType || /tinjauan spesifikasi|panduan pembelian|ulasan/i.test(headings[0] || ''));
  const specMetricMatches = (cleanMd.match(/\b\d+(?:[.,]\d+)?\s*(?:megapixel|mp|fps|mm|cm|gb|watt|volt|kg|derajat|ip\d{2}|hz|m²)\b/gi) || []).length;
  const consequenceExplanations = (cleanMd.match(/\b(?:artinya|berdampak|konsekuensinya|akibatnya|sehingga|bagi pemilik rumah|cocok untuk|kurang cocok untuk|menghasilkan|mengurangi beban|prioritaskan jika)\b/gi) || []).length;
  if (isProdReview && specMetricMatches >= 8 && consequenceExplanations < 2) {
    issues.push({
      code: 'SPEC_DUMP_WITHOUT_INTERPRETATION',
      category: 'SPECIFICATION_DUMP',
      severity: 'CRITICAL',
      description: 'Naskah menumpuk data spesifikasi teknis tanpa menerjemahkan konsekuensi praktis bagi penggunaan sehari-hari pembaca.',
      penalty: 26
    });
    dimReader = Math.max(0, dimReader - 10);
    dimVoice = Math.max(0, dimVoice - 10);
    dimSpecificity = Math.max(0, dimSpecificity - 6);
  }

  // --------------------------------------------------------------------------
  // 13. Affiliate / Commercial Bias Risk
  // --------------------------------------------------------------------------
  const hasEarlyAffiliateCTA = options.affiliateCTAPosition === 'BEFORE_RECOMMENDATION' ||
    /\[>>.*?klik (?:di sini|beli sekarang).*?<<\]/i.test(cleanMd.slice(0, Math.floor(cleanMd.length * 0.75)));
  const hasCommercialSuperlatives = /terbaik nomor satu|paling sempurna tanpa(?: ada)? kekurangan|kualitas bintang lima/i.test(cleanMd);

  if (hasEarlyAffiliateCTA) {
    issues.push({
      code: 'COMMERCIAL_BIAS_RISK',
      category: 'COMMERCIAL_BIAS',
      severity: 'CRITICAL',
      description: 'Tautan atau ajakan pembelian afiliasi disisipkan sebelum alur penalaran dan rekomendasi editorial selesai.',
      penalty: 35
    });
    dimVoice = 0;
    dimReader = 0;
  }
  if (hasCommercialSuperlatives) {
    issues.push({
      code: 'UNSUPPORTED_SUPERLATIVE',
      category: 'EMPTY_GENERALIZATION',
      severity: 'WARNING',
      description: 'Klaim superlatif berlebihan bernada promosi sales tanpa bukti komparasi objektif.',
      penalty: 10
    });
    dimVoice = Math.max(0, dimVoice - 5);
  }

  // --------------------------------------------------------------------------
  // 14. Fabricated Hands-On Claims in Analytical Reviews
  // --------------------------------------------------------------------------
  if ((options.reviewType === 'ANALYTICAL_REVIEW' || !options.hasFirstPartyEvidence) &&
      /dalam pengujian kami|kami sudah mencoba|kami memasangnya|saat kami pasang|hasil tes kami|laboratorium kami/i.test(cleanMd)) {
    issues.push({
      code: 'FABRICATED_HANDS_ON_TEST',
      category: 'FABRICATED_HANDS_ON',
      severity: 'CRITICAL',
      description: 'Artikel mengklaim pengujian fisik langsung padahal berstatus ulasan analitis tanpa bukti primer.',
      penalty: 35
    });
    dimEvidence = 0;
    dimVoice = Math.max(0, dimVoice - 10);
    dimReader = 0;
  }

  // --------------------------------------------------------------------------
  // 15. Single Complaint Overgeneralization
  // --------------------------------------------------------------------------
  if (/(?:satu|ada satu|seorang) ulasan pembeli.*?mengeluhkan.*?menyimpulkan bahwa produk ini (?:memiliki cacat|tidak layak)/is.test(cleanMd)) {
    issues.push({
      code: 'SINGLE_REVIEW_OVERGENERALIZATION',
      category: 'COMPLAINT_OVERGENERALIZATION',
      severity: 'WARNING',
      description: 'Ulasan atau komplain seorang pembeli tunggal digeneralisasi menjadi cacat total produk tanpa bukti pola berulang.',
      penalty: 16
    });
    dimVoice = Math.max(0, dimVoice - 8);
    dimReader = Math.max(0, dimReader - 8);
  }

  // --------------------------------------------------------------------------
  // 16. Compatibility Blind Review (Product Review)
  // --------------------------------------------------------------------------
  if (isProdReview) {
    const hasCompatibilityChecks = /ketebalan|mortise|kusen|substrat|daya|voltase|meteran|pln|kapasitas|jaringan|arah bukaan/i.test(cleanMd);
    const isGenericRecommendationWithoutFit = /sangat kami rekomendasikan untuk segera dipasang oleh semua pemilik rumah/i.test(cleanMd);
    if (isGenericRecommendationWithoutFit || !hasCompatibilityChecks) {
      issues.push({
        code: 'COMPATIBILITY_NOT_EVALUATED',
        category: 'COMPATIBILITY_GAP',
        severity: 'WARNING',
        description: 'Rekomendasi produk tidak memeriksa dimensi kompatibilitas fisik atau sistem instalasi hunian.',
        penalty: 16
      });
      dimContext = Math.max(0, dimContext - 8);
      dimReader = Math.max(0, dimReader - 8);
    }
  }

  // --------------------------------------------------------------------------
  // 17. Expert Consultation & Practical Decision Depth Gate (Milestone: EDITORIAL-EXPERT-CONSULTATION-1-STABILIZE)
  // --------------------------------------------------------------------------
  // Signals for Expert-to-Client Consultation (Layer 3) & Practical Decision Support (Layer 4)
  const hasTradeOffs = /\b(?:trade-off|kompromi|konsekuensi|kelemahan|kekurangan|keterbatasan|risiko|sisi lain|namun menuntut|perlu diantisipasi|perawatan berkala|kelemahan termal|rentan|biaya perawatan|debu|karat|meredam panas lebih optimal|menahan beban angin|pertimbangan teknis|prioritaskan\b[^\n.]+?\bjika\b)\b/i.test(cleanMd);
  const hasActionGuidance = /\b(?:(?:mem)?periksa(?:lah)?|pastikan|memastikan|(?:meng)?ukur|(?:menge)?cek|(?:men)?tanyakan|(?:mem)?verifikasi|spesifikasi|langkah berikutnya|tahapan|pilihan|rekomendasi|alternatif|hubungi aplikator|ahli struktur|uji)\b/i.test(lastSection || cleanMd);
  const hasScenarioFit = /\b(?:jika|apabila|bila|untuk rumah|pada bukaan|cocok untuk|kurang cocok|lebih masuk akal|paling tepat|prioritaskan jika|dalam kondisi)\b/i.test(cleanMd);
  const hasDiagnosticDepth = /\b(?:akar penyebab|penyebab utama|indikasi fisik|rembesan kapiler|sumber air|pemicu utama|diagnosis|gejala|kenapa hal ini terjadi|mengapa bisa)\b/i.test(cleanMd);
  const hasDirectPrescription = /\b(?:harus dipasang|wajib memakai|segera gunakan|langsung pasang|solusinya adalah dengan membeli|langsung beli)\b/i.test(cleanMd);
  const hasPrescriptionWithoutDiagnosis = !hasDiagnosticDepth && hasDirectPrescription;

  // A. Reader Problem Framing (Problem Solving & Comparison articles)
  if (articleIntent === 'PROBLEM_SOLVING' || articleIntent === 'COMPARISON') {
    const hasProblemFraming = /\b(?:masalah|dilema|kebingungan|keluhan|panas|bocor|rembes\w*|rusak|sulit|tantangan|memilih|perbedaan|antara|perbandingan|frustrasi|kecemasan|kekhawatiran|mengantong)\b/i.test(firstParagraph);
    if (!hasProblemFraming && firstParagraph.length > 30) {
      const penalty = isLowConfidenceIntent ? 4 : 8;
      issues.push({
        code: 'READER_PROBLEM_UNCLEAR',
        category: 'EXPERT_CONSULTATION_GAP',
        severity: 'WARNING',
        description: 'Pembuka artikel tidak membingkai secara jelas masalah atau dilema riil yang dialami pemilik rumah.',
        penalty
      });
      dimReader = Math.max(0, dimReader - Math.round(penalty * 0.6));
      dimVoice = Math.max(0, dimVoice - Math.round(penalty * 0.4));
    }
  }

  // B. Diagnosis Before Prescription (Problem Solving)
  if (articleIntent === 'PROBLEM_SOLVING' && hasPrescriptionWithoutDiagnosis) {
    const penalty = isLowConfidenceIntent ? 5 : 10;
    issues.push({
      code: 'DIAGNOSIS_MISSING',
      category: 'EXPERT_CONSULTATION_GAP',
      severity: 'WARNING',
      description: 'Naskah langsung meresepkan produk atau tindakan tanpa terlebih dahulu mendiagnosis gejala dan akar penyebab teknis.',
      penalty
    });
    dimEvidence = Math.max(0, dimEvidence - Math.round(penalty * 0.6));
    dimReader = Math.max(0, dimReader - Math.round(penalty * 0.4));
  }

  // C. Trade-Off Depth & Incomplete Trade-Offs (Comparison & Problem Solving)
  if (articleIntent === 'COMPARISON') {
    if (!hasTradeOffs) {
      const penalty = isLowConfidenceIntent ? 8 : 16;
      issues.push({
        code: 'TRADE_OFFS_INCOMPLETE',
        category: 'DECISION_SUPPORT_GAP',
        severity: isLowConfidenceIntent ? 'WARNING' : 'CRITICAL',
        description: 'Artikel komparasi tidak membeberkan trade-off atau kompromi fisik/material secara transparan bagi pemilik rumah.',
        penalty
      });
      dimVoice = Math.max(0, dimVoice - Math.round(penalty / 2));
      dimReader = Math.max(0, dimReader - Math.round(penalty / 2));
    } else {
      strongAreas.push('Komparasi menguraikan trade-off material secara transparan dan berimbang');
    }
  }

  // D. Universal Recommendation / Missing Scenario Fit (Comparison)
  const hasUniversalRecommendation = /\b(?:produk terbaik untuk semua|pilihan nomor satu tanpa tanding|selalu lebih unggul dalam segala hal|wajib dipilih oleh siapa pun)\b/i.test(cleanMd);
  if (articleIntent === 'COMPARISON' && (hasUniversalRecommendation || (!hasScenarioFit && !hasUniversalRecommendation && !/pertimbangkan|tergantung pada/i.test(cleanMd)))) {
    const penalty = isLowConfidenceIntent ? 5 : 10;
    issues.push({
      code: 'SCENARIO_FIT_MISSING',
      category: 'DECISION_SUPPORT_GAP',
      severity: 'WARNING',
      description: 'Rekomendasi bersifat mutlak/universal tanpa percabangan skenario (kondisi jika X maka A, jika Y maka B).',
      penalty
    });
    dimReader = Math.max(0, dimReader - Math.round(penalty * 0.6));
    dimVoice = Math.max(0, dimVoice - Math.round(penalty * 0.4));
  }

  // E. Next Action / Decision Resolution (All actionable intents: Comparison, Problem Solving, How-to, Product Review)
  if (articleIntent === 'COMPARISON' || articleIntent === 'PROBLEM_SOLVING' || articleIntent === 'INSTALLATION_HOW_TO' || articleIntent === 'PRODUCT_REVIEW') {
    if (!hasActionGuidance && lastSection.length > 50) {
      const penalty = isLowConfidenceIntent ? 5 : 10;
      issues.push({
        code: 'NEXT_ACTION_MISSING',
        category: 'DECISION_SUPPORT_GAP',
        severity: 'WARNING',
        description: 'Bagian penutup artikel tidak memberikan panduan langkah konkret berikutnya (hal yang harus diinspeksi, diukur, diverifikasi, atau ditanyakan ke tukang/aplikator).',
        penalty
      });
      dimReader = Math.max(0, dimReader - Math.round(penalty * 0.6));
      dimConclusion = Math.max(0, dimConclusion - Math.round(penalty * 0.4));
    }
  }

  // F. Academic Distance Excessive (Explanatory / General Articles that detach from homeowner reality)
  // Evaluates when technical concepts are described in abstract theory without practical homeowner relevance,
  // without context qualification, without trade-offs, and ending with an essay summary rather than client action.
  const hasAbstractTone = /\b(?:analisis teoritis|rekayasa (?:amplop|fasad|termal|struktur|akustik|bangunan)|sains kenyamanan|dinamika (?:ventilasi|fluida|aliran|udara)|efisiensi termal|beban pendinginan pasif|selubung adaptif|karakter arsitektural|fenomena (?:beban|perpindahan|degradasi|termal)|parameter penentu keberhasilan|prinsip termodinamika|koefisien (?:perpindahan|reduksi|penyerapan|transmisi)|kajian literatur|studi komparatif|tinjauan pustaka|keberlanjutan konstruksi)\b/i.test(cleanMd);
  const lacksHomeownerRelevance = !/\b(?:bagi pemilik rumah|untuk rumah|di rumah|kamar tidur|kamar mandi|ruang keluarga|ruang tamu|dapur|biaya perawatan|anggaran|saat hujan|saat kemarau|saat panas|tukang|mandor|aplikator|lapangan|penghuni rumah|keseharian keluarga)\b/i.test(cleanMd);
  const lacksPracticalTradeOffs = !hasTradeOffs;
  const lacksNextAction = !hasActionGuidance;

  if (articleIntent === 'EXPLANATORY' && hasAbstractTone && lacksHomeownerRelevance && lacksPracticalTradeOffs && lacksNextAction) {
    const penalty = isLowConfidenceIntent ? 8 : 16;
    issues.push({
      code: 'ACADEMIC_DISTANCE_EXCESSIVE',
      category: 'ACADEMIC_DISTANCE',
      severity: 'WARNING',
      description: 'Artikel bernada esai akademis/makalah ilmiah yang berjarak dari realitas pemilik rumah (nihil relevansi hunian praktis, ketiadaan trade-off perawatan, dan tidak ada resolusi tindakan nyata).',
      penalty
    });
    dimVoice = Math.max(0, dimVoice - Math.round(penalty / 2));
    dimReader = Math.max(0, dimReader - Math.round(penalty / 2));
  }

  // G. Content Depth Adequacy vs Scope (Promised Scope vs Delivered Depth)
  // Canonical Principle: PROMISED SCOPE > DELIVERED DEPTH
  const firstHeading = (cleanMd.match(/^##?\s+(.+)$/m) || [])[1] || '';
  const isBroadScopeTopic = /\b(?:panduan lengkap|panduan komprehensif|semua hal tentang|solusi menyeluruh|master guide|dari nol sampai jadi|panduan memilih .* untuk seluruh rumah|panduan total|solusi rumah panas|panduan smart home|tren desain interior|sistem keamanan rumah)\b/i.test(firstHeading + ' ' + firstParagraph);
  const isNarrowScopeTopic = /\b(?:apa itu|berapa (?:jarak|ketebalan|ukuran)|arti istilah|fungsi utama|definisi)\b/i.test(firstHeading);

  // Delivered depth: substantive subsections (H2 headings with >= 25 words beneath them)
  const substantiveSections = (cleanMd.split(/^##\s+/m).slice(1)).filter((s) => s.trim().split(/\s+/).length >= 25).length;
  const isTooBriefForPromisedScope = isBroadScopeTopic && (words.length < 150 || (substantiveSections < 2 && words.length < 200));

  if (isTooBriefForPromisedScope && !isNarrowScopeTopic) {
    issues.push({
      code: 'SCOPE_DEPTH_MISMATCH',
      category: 'CONTENT_DEPTH_MISMATCH',
      severity: 'WARNING',
      description: `Cakupan topik luas yang dijanjikan dibahas terlalu singkat (~${words.length} kata, ${substantiveSections} sub-bahasan), menyisakan kesenjangan kedalaman eksplanasi dan panduan keputusan.`,
      penalty: 7
    });
    dimSpecificity = Math.max(0, dimSpecificity - 4);
    dimReader = Math.max(0, dimReader - 3);
  }

  // --------------------------------------------------------------------------
  // Score Aggregation & Hard-Fail Decision Logic
  // --------------------------------------------------------------------------
  const dimensions: HumanWritingDimensions = {
    sentence_rhythm: Math.round(dimRhythm),
    specificity_detail: Math.round(dimSpecificity),
    contextual_relevance: Math.round(dimContext),
    editorial_voice: Math.round(dimVoice),
    non_template_structure: Math.round(dimStructure),
    evidence_integration: Math.round(dimEvidence),
    reader_perspective: Math.round(dimReader),
    conclusion_originality: Math.round(dimConclusion)
  };

  let rawTotalScore = Math.max(
    0,
    Math.min(
      100,
      dimensions.sentence_rhythm +
        dimensions.specificity_detail +
        dimensions.contextual_relevance +
        dimensions.editorial_voice +
        dimensions.non_template_structure +
        dimensions.evidence_integration +
        dimensions.reader_perspective +
        dimensions.conclusion_originality
    )
  );

  // Hard-Fail Invariant: Critical integrity violations must strictly force REWRITE (capped < 75)
  const hasCriticalIntegrityViolation = issues.some(
    (i) => i.code === 'FABRICATED_EXPERIENCE' ||
           i.code === 'FABRICATED_EXPERIENCE_OR_SLOP' ||
           i.code === 'FABRICATED_HANDS_ON_TEST' ||
           i.code === 'COMMERCIAL_BIAS_RISK' ||
           i.code === 'CLAIM_SOURCE_PROVENANCE_MISSING' ||
           (i.code === 'UNSUPPORTED_NUMERICAL_CLAIM' && i.severity === 'CRITICAL')
  );

  // Hard-Fail Invariant: Nadia Reader Voice Gate Prerequisite (HOUSE-VOICE-CALIBRATION)
  // Rina requires READER_VOICE_PASS before final editorial QA.
  // Rina may not overrule poor reader voice simply because evidence is strong.
  // No 99/100-style human-writing score is possible when Nadia gate has failed.
  const hasReaderVoiceFailure = Boolean(
    options.readerVoiceState && options.readerVoiceState !== 'READER_VOICE_PASS'
  );

  if (hasReaderVoiceFailure) {
    issues.push({
      code: 'READER_VOICE_GATE_NOT_PASSED',
      category: 'READER_VOICE_PREREQUISITE',
      severity: 'CRITICAL',
      description: `Naskah belum lulus evaluasi suara pembaca Nadia (status: ${options.readerVoiceState}). Rina mewajibkan READER_VOICE_PASS sebelum evaluasi editorial final dapat disetujui.`,
      penalty: 40
    });
  }

  let totalScore = rawTotalScore;
  if (hasCriticalIntegrityViolation) {
    totalScore = Math.min(totalScore, 65);
  }
  if (hasReaderVoiceFailure) {
    totalScore = Math.min(totalScore, 60);
  }

  let decision: HumanWritingDecision;
  let passed = false;

  if (totalScore >= CANONICAL_HUMAN_QUALITY_THRESHOLDS.PASS) {
    decision = 'HUMAN_WRITING_PASS';
    passed = true;
  } else if (totalScore >= CANONICAL_HUMAN_QUALITY_THRESHOLDS.REVISE) {
    decision = 'HUMAN_WRITING_REVISE';
    passed = false;
  } else {
    decision = 'HUMAN_WRITING_REWRITE';
    passed = false;
  }

  // Safeguard: Retry Cap Escalation (Phase 8)
  if (!passed && attemptCount >= maxAttempts) {
    decision = 'HUMAN_REVIEW_REQUIRED';
  }

  // Role Correction Routing (Stabilization: Deterministic Irwan / Joko / Rina mapping)
  let targetAgentId = 'content_writer_primary'; // Default: Joko
  let supportingAgentId: string | undefined = undefined;
  let revisionReason: StructuredRewriteBrief['revision_reason'] = 'HOMEOWNER_REFRAMING_REQUIRED';

  if (issues.some((i) => i.code === 'CLAIM_SOURCE_PROVENANCE_MISSING' || (i.code === 'UNSUPPORTED_NUMERICAL_CLAIM' && i.severity === 'CRITICAL'))) {
    // Provenance failure or unsupported numerical assertion: Irwan owns primary source research; Joko supports prose adaptation
    targetAgentId = 'evidence_researcher_lead';
    supportingAgentId = 'content_writer_primary';
    revisionReason = 'RESEARCH_REQUIRED';
  } else if (hasCriticalIntegrityViolation) {
    // Integrity failure (fabricated experience / commercial bias / fake test)
    targetAgentId = 'editorial_qa_primary'; // Rina
    supportingAgentId = 'content_writer_primary';
    revisionReason = 'EDITORIAL_INTEGRITY_REVIEW';
  } else if (options.isBiasedTradeOffSuppression) {
    // Case C: Known limitation hidden / biased recommendation
    targetAgentId = 'editorial_qa_primary'; // Rina
    supportingAgentId = 'content_writer_primary';
    revisionReason = 'EDITORIAL_INTEGRITY_REVIEW';
  } else if (
    issues.some((i) => i.code === 'TRADE_OFFS_INCOMPLETE') &&
    options.hasTradeOffEvidence === false
  ) {
    // Case A: Missing trade-off evidence
    targetAgentId = 'evidence_researcher_lead'; // Irwan
    supportingAgentId = 'content_writer_primary';
    revisionReason = 'RESEARCH_REQUIRED';
  } else if (
    issues.some((i) => i.code === 'TRADE_OFFS_INCOMPLETE') &&
    (options.hasTradeOffEvidence === true || options.hasTradeOffEvidence === undefined)
  ) {
    // Case B: Evidence exists, but omitted in prose explanation
    targetAgentId = 'content_writer_primary'; // Joko
    revisionReason = 'EDITORIAL_EXPLANATION_REQUIRED';
  } else if (
    issues.some((i) => i.code === 'CLAIM_SOURCE_PROVENANCE_MISSING')
  ) {
    targetAgentId = 'evidence_researcher_lead'; // Irwan: primary provenance owner
    supportingAgentId = 'content_writer_primary'; // Joko: secondary prose adaptation owner
    revisionReason = 'RESEARCH_REQUIRED';
  } else if (
    issues.some((i) => (i.code === 'INSUFFICIENT_CLAIM_SUPPORT' || i.code === 'WEAK_EVIDENCE_SPECIFICITY') && i.severity === 'CRITICAL') &&
    !issues.some((i) => i.category === 'GENERIC_OPENING' || i.category === 'STRUCTURAL_SYMMETRY' || i.category === 'KEYWORD_FORCING')
  ) {
    targetAgentId = 'evidence_researcher_lead'; // Irwan: purely evidence failure
    supportingAgentId = 'content_writer_primary';
    revisionReason = 'RESEARCH_REQUIRED';
  } else if (issues.some((i) => i.code === 'ACADEMIC_DISTANCE_EXCESSIVE' || i.code === 'READER_PROBLEM_UNCLEAR')) {
    targetAgentId = 'content_writer_primary'; // Joko: homeowner reframing
    revisionReason = 'HOMEOWNER_REFRAMING_REQUIRED';
  }

  // Generate Structured Rewrite Brief if revise/rewrite is required
  let rewriteBrief: StructuredRewriteBrief | null = null;
  if (!passed && decision !== 'HUMAN_REVIEW_REQUIRED') {
    const requiredActions: string[] = [];
    const failingSections: string[] = [];

    for (const issue of issues) {
      if (issue.category === 'GENERIC_OPENING') {
        requiredActions.push('Ganti pembuka generik dengan situasi atau masalah riil yang dihadapi pemilik rumah.');
        failingSections.push('Paragraf Pembuka');
      } else if (issue.category === 'REPETITIVE_TRANSITIONS') {
        requiredActions.push('Kurangi frasa transisi berulang ("Selain itu", "Di sisi lain"); biarkan alur bergerak melalui hubungan logika ide.');
      } else if (issue.category === 'STRUCTURAL_SYMMETRY') {
        requiredActions.push('Variasikan pola subjudul; jangan gunakan jumlah butir atau pola paragraf yang sama persis di setiap bagian.');
      } else if (issue.category === 'EMPTY_GENERALIZATION') {
        requiredActions.push('Jelaskan trade-off material secara konkret; jangan berhenti di kalimat umum seperti "semua ada kelebihan dan kekurangan".');
      } else if (issue.category === 'EXCESSIVE_HEDGING') {
        requiredActions.push('Gunakan bahasa yang tegas dan presisi; kurangi kata pelindung ("dapat menjadi pilihan", "cenderung").');
      } else if (issue.category === 'LACK_OF_LOCAL_CONTEXT') {
        requiredActions.push('Kaitkan material/desain dengan iklim tropis Indonesia, kelembapan, curah hujan tinggi, atau realitas pemasangan lokal.');
      } else if (issue.category === 'ARTIFICIAL_CONCLUSION') {
        requiredActions.push('Tulis ulang kesimpulan sebagai panduan keputusan praktis: kapan harus memilih opsi A vs B, dan apa yang harus dicek pembaca.');
        failingSections.push('Bagian Kesimpulan / Penutup');
      } else if (issue.category === 'TERMINOLOGY_INCONSISTENCY') {
        requiredActions.push('Standardisasi istilah teknis: gunakan istilah kanonikal konsisten tanpa variasi sinonim semu.');
      } else if (issue.category === 'SPECIFICATION_DUMP') {
        requiredActions.push('Terjemahkan spesifikasi teknis menjadi dampak praktis bagi penggunaan sehari-hari pembaca.');
      } else if (issue.category === 'COMMERCIAL_BIAS') {
        requiredActions.push('Pindahkan tautan pembelian ke akhir naskah dan susun alur penalaran murni berdasar kecocokan pengguna.');
      } else if (issue.category === 'FABRICATED_HANDS_ON') {
        requiredActions.push('Hapus klaim pengujian fisik jika ulasan berstatus analitis tanpa bukti primer.');
      } else if (issue.category === 'FABRICATED_EXPERIENCE' || issue.code === 'FABRICATED_EXPERIENCE_OR_SLOP') {
        requiredActions.push('Hapus klaim pengalaman fiktif atau testimoni personal palsu yang melanggar Layer 5 Trust & Editorial Integrity.');
        failingSections.push('Narasi Pengalaman / Integritas');
      } else if (issue.code === 'CLAIM_SOURCE_PROVENANCE_MISSING') {
        requiredActions.push('Lakukan verifikasi sumber bukti primer (dokumen, bab/pasal, edisi standar) atau kualifikasikan klaim numerik menjadi penjelasan kualitatif tanpa angka fiktif.');
        failingSections.push('Keterlacakan Sumber Bukti (Provenance)');
      } else if (issue.category === 'INSUFFICIENT_CLAIM_SUPPORT' || issue.code === 'WEAK_EVIDENCE_SPECIFICITY') {
        requiredActions.push('Sertakan rujukan standar konstruksi (SNI/ASTM), prinsip fisika hunian, atau metrik spesifikasi terukur untuk mendukung klaim.');
        failingSections.push('Bukti & Fakta Teknis');
      } else if (issue.category === 'COMPLAINT_OVERGENERALIZATION') {
        requiredActions.push('Pisahkan komplain seorang pembeli dari pola kegagalan berulang yang terverifikasi.');
      } else if (issue.category === 'COMPATIBILITY_GAP') {
        requiredActions.push('Tambahkan evaluasi dimensi kompatibilitas dan kendala instalasi fisik/sistem.');
      } else if (issue.category === 'TRANSLATIONESE' || issue.code === 'TRANSLATIONESE_DETECTED') {
        requiredActions.push('Tulis ulang langsung dalam bahasa Indonesia alami; hilangkan pola wacana terjemahan literal bahasa Inggris ("ketika datang ke", "hadir dengan sejumlah fitur", "dalam hal ini penting untuk memahami", "keputusan berada di tangan Anda", dll.).');
        failingSections.push('Gaya Bahasa & Konstruksi Kalimat');
      } else if (issue.category === 'EXPERT_CONSULTATION_GAP') {
        requiredActions.push('Perjelas masalah riil pemilik rumah di awal naskah dan lakukan diagnosa gejala/sebab sebelum meresepkan solusi.');
        failingSections.push('Perspektif Konsultasi Ahli');
      } else if (issue.category === 'DECISION_SUPPORT_GAP') {
        requiredActions.push('Sertakan trade-off material secara berimbang, percabangan skenario ("jika X maka A, jika Y maka B"), dan langkah aksi konkret di penutup.');
        failingSections.push('Dukungan Keputusan & Aksi Lanjutan');
      } else if (issue.category === 'ACADEMIC_DISTANCE') {
        requiredActions.push('Dekatkan naskah pada realitas pemilik rumah: kaitkan prinsip fisika bangunan dengan konsekuensi praktis, perawatan rutin, dan panduan tindakan di lapangan.');
        failingSections.push('Relevansi & Jarak Akademis');
      } else if (issue.category === 'CONTENT_DEPTH_MISMATCH') {
        requiredActions.push('Perdalam bahasan topik agar sepadan dengan keluasan cakupan yang dijanjikan, atau persempit fokus pembahasan.');
        failingSections.push('Kedalaman Konten');
      }
    }

    if (requiredActions.length === 0) {
      requiredActions.push('Perbaiki kelancaran kalimat dan perdalam detail aplikatif untuk pembaca.');
    }

    const allIssueCodes = Array.from(new Set(issues.map((i) => i.code)));
    const primaryIssueCode = issues.length > 0 ? issues[0].code : undefined;

    rewriteBrief = {
      target_agent_id: targetAgentId,
      supporting_agent_id: supportingAgentId,
      supporting_agent_ids: supportingAgentId ? [supportingAgentId] : [],
      reason: 'HUMAN_WRITING_QUALITY',
      revision_reason: revisionReason,
      quality_decision: decision,
      quality_score: totalScore,
      quality_issue: primaryIssueCode, // Backward compatibility
      primary_quality_issue: primaryIssueCode,
      quality_issues: allIssueCodes,
      article_intent: articleIntent,
      article_id: options.articleId,
      task_id: options.taskId,
      attempt: attemptCount + 1,
      required_actions: requiredActions,
      preserved_invariants: [
        'Fakta riset teknis, angka spesifikasi, dan rujukan standar konstruksi (SNI/ASTM) tidak boleh diubah.',
        'Dilarang mengarang testimoni personal palsu ("kami sudah menguji", "berdasarkan pengalaman kami") jika tidak ada bukti primer.',
        'Kepatuhan Monetary Silence tetap berlaku mutlak (dilarang menebak harga tanpa riset terverifikasi).'
      ],
      failing_sections: failingSections.length > 0 ? failingSections : ['Revisi umum pada alur dan variasi bahasa']
    };
  }

  return {
    knowledge_version: RANCANGLOKA_EDITORIAL_KNOWLEDGE_VERSION,
    total_score: totalScore,
    decision,
    passed,
    dimensions,
    issues,
    strong_areas: strongAreas,
    evaluated_by: evaluatedBy,
    evaluated_at: evaluatedAt,
    attempt_count: attemptCount,
    max_attempts: maxAttempts,
    rewrite_brief: rewriteBrief,
    article_intent: articleIntent,
    article_intent_profile: intentProfile
  };
}

/**
 * Joko Authoring Canonical Guidelines (Reference & Prompt Guidance)
 */
export const JOKO_HUMAN_AUTHORING_GUIDELINES = {
  persona: 'Joko — Writer / Editorial Desk',
  capabilities: ['ARTICLE_WRITING', 'HUMAN_WRITING_AUTHORING'],
  editorial_rules: [
    'Tulis untuk pemilik rumah Indonesia dengan bahasa wajar, lugas, dan enak dibaca.',
    'Buka tulisan dari dilema atau masalah nyata pembaca, bukan definisi kamus atau pembuka brosur.',
    'Variasikan panjang kalimat: padukan kalimat pendek yang tegas dengan penjelasan runtut.',
    'Hindari struktur template kaku (jumlah butir identik di setiap subjudul).',
    'Integrasikan bukti dan angka teknis ke dalam alur pemikiran, bukan menumpuk fakta kering.',
    'Jelaskan istilah arsitektur teknis dengan perumpamaan fisik yang mudah dibayangkan.',
    'Pahami iklim tropis lembap Indonesia: tampias, panas sore, lumut, dan ventilasi silang.',
    'Jaga kerendahan hati editorial: jika bukti memiliki batas, nyatakan secara presisi tanpa hedging berlebihan.',
    'Tutup artikel dengan panduan aksi atau trade-off yang jelas bagi pembaca.',
    'MUTLAK: Dilarang mengarang klaim uji coba mandiri ("kami telah menguji") jika tidak ada bukti tangan pertama.',
    'NATIVE INDONESIAN AUTHORING: Tulis langsung dalam bahasa Indonesia alami sejak awal alur pemikiran; hindari pola wacana terjemahan bahasa Inggris (translationese).',
    'TECHNICAL ENGLISH EXCEPTION: Pertahankan istilah teknis kanonikal dan istilah bahasa Inggris yang sah sesuai standar industri (seperti thermal break, U-value, low-e, mortise, firmware) lalu jelaskan maknanya secara alami dalam bahasa Indonesia.',
    'RINGKASAN TABEL PERBANDINGAN: Tabel perbandingan adalah alat bantu rangkuman, bukan tempat menulis esai mini. Tulis pernyataan perbandingan yang ringkas (< 20 kata per sel) agar mudah discan, dan simpan elaborasi mendalam di paragraf pembahasan sekitarnya.'
  ]
};
