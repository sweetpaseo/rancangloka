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
    | 'CONTENT_DEPTH_MISMATCH';
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
  | 'SOURCE_PROVENANCE_UNKNOWN';

export type ClaimSupportLevel =
  | 'VERIFIED'
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'UNVERIFIED'
  | 'CONFLICTING';

export type SourceApplicability =
  | 'REGULATORY_LOCAL_TROPICAL'
  | 'TECHNICAL_GUIDANCE_LOCAL'
  | 'TECHNICAL_REFERENCE_FOREIGN'
  | 'FOREIGN_BUILDING_CODE'
  | 'RESEARCH_STUDY'
  | 'MANUFACTURER_DOCUMENTATION';

export interface EvidenceSource {
  source_id: string;
  source_type?: string;
  publisher_or_author?: string;
  document_title: string;
  publication_or_revision_date?: string;
  edition_or_revision?: string;
  page_or_section?: string;
  applicability: SourceApplicability | string;
  support_type?: string;
  retrieval_status?: SourceRetrievalStatus;
  retrieval_method?: string;
  retrieved_at?: string;
  content_location?: string;
  content_hash?: string;
  limitations?: string;
}

export interface EvidenceClaim {
  claim_id: string;
  statement: string;
  claim_class?: string;
  evidence_status: ClaimSupportLevel | string;
  provenance_retrieval_status?: SourceRetrievalStatus | string;
  source_reference?: string;
  sources?: EvidenceSource[];
  confidence?: string;
  action?: 'KEEP' | 'QUALIFY' | 'REMOVE_NUMBER' | 'REMOVE_CLAIM' | 'RESEARCH_REQUIRED' | string;
  relevance?: string;
  numeric_claim?: boolean;
}

export interface AuthorSafeClaim {
  claim_id: string;
  statement: string;
  support_level: ClaimSupportLevel;
  applicability: string;
  allowed_for_authoring: boolean;
  prohibited_elements?: string[];
  qualification_required?: string;
}

export interface EvidencePackInput {
  evidence_pack_id?: string;
  topic?: string;
  compiled_by?: string;
  claim_inventory?: EvidenceClaim[];
  author_safe_claims?: AuthorSafeClaim[];
  [key: string]: any;
}

export interface ProvenanceAuditSummary {
  total_claims: number;
  retrieved_and_verified_sources_count: number;
  metadata_only_sources_count: number;
  unretrieved_sources_count: number;
  unverified_claims: string[];
  unsupported_numeric_claims: string[];
  missing_provenance_claims: string[];
  claim_support_map: Record<string, ClaimSupportLevel>;
  requires_provenance_failure: boolean;
  audit_reasons: string[];
}

/**
 * Deterministically derives an audit of claim-to-source retrieval verification.
 * Distinguishes SOURCE_RETRIEVED_AND_VERIFIED from SOURCE_METADATA_ONLY / UNRETRIEVED.
 * Fail-closed default: if provenance is missing/unverified for exact numeric assertions,
 * it is flagged automatically without requiring manual caller booleans.
 */
export function auditEvidencePackProvenance(
  evidencePack: EvidencePackInput | null | undefined,
  contentMd: string = ''
): ProvenanceAuditSummary {
  const summary: ProvenanceAuditSummary = {
    total_claims: 0,
    retrieved_and_verified_sources_count: 0,
    metadata_only_sources_count: 0,
    unretrieved_sources_count: 0,
    unverified_claims: [],
    unsupported_numeric_claims: [],
    missing_provenance_claims: [],
    claim_support_map: {},
    requires_provenance_failure: false,
    audit_reasons: []
  };

  if (!evidencePack || !Array.isArray(evidencePack.claim_inventory)) {
    return summary;
  }

  const claims = evidencePack.claim_inventory;
  summary.total_claims = claims.length;

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
        summary.retrieved_and_verified_sources_count++;
        hasRetrievedSource = true;
      } else if (status === 'SOURCE_METADATA_ONLY') {
        summary.metadata_only_sources_count++;
        hasMetadataOnlySource = true;
      } else if (
        status === 'SOURCE_REFERENCE_KNOWN_NOT_RETRIEVED' ||
        status === 'SOURCE_REFERENCE_KNOWN_BUT_NOT_RETRIEVED' ||
        status === 'SOURCE_UNAVAILABLE'
      ) {
        summary.unretrieved_sources_count++;
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

    // Phase 5: Numeric Claim Safety
    // Detect whether claim asserts exact numbers
    const statementHasNumbers = /\b\d+(?:[.,]\d+)?\s*(?:%|mm|cm|m|w\/m|°c|c\b)/i.test(claim.statement);
    const isExplicitNumeric = claim.numeric_claim || statementHasNumbers;

    // Fail-Closed Check: If claim has numbers but sources were not retrieved and verified,
    // it MUST NOT be claimed as VERIFIED fact in the evidence pack or final text without qualification.
    if (claim.evidence_status === 'VERIFIED' && !hasRetrievedSource) {
      summary.missing_provenance_claims.push(
        `${claim.claim_id}: Status dinyatakan VERIFIED namun sumber belum berstatus SOURCE_RETRIEVED_AND_VERIFIED`
      );
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
  }

  return summary;
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
    dimEvidence = 0;
    dimSpecificity = Math.max(0, dimSpecificity - 5);
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
           i.code === 'CLAIM_SOURCE_PROVENANCE_MISSING'
  );

  let totalScore = rawTotalScore;
  if (hasCriticalIntegrityViolation) {
    totalScore = Math.min(totalScore, 65);
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

  if (issues.some((i) => i.code === 'CLAIM_SOURCE_PROVENANCE_MISSING')) {
    // Provenance failure: Irwan owns primary source research; Joko supports prose adaptation
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
    'TECHNICAL ENGLISH EXCEPTION: Pertahankan istilah teknis kanonikal dan istilah bahasa Inggris yang sah sesuai standar industri (seperti thermal break, U-value, low-e, mortise, firmware) lalu jelaskan maknanya secara alami dalam bahasa Indonesia.'
  ]
};
