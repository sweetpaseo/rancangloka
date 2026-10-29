/**
 * RancangLoka — Editorial Visual Intelligence v1 (EVIS-1) Contract & Guard Engine
 *
 * Scope: Cover images, inline images, material comparisons, problem-solving visuals,
 * and product illustrations.
 *
 * Non-Negotiable Principle:
 * "Editorial meaning determines visual composition. Visual variety must never come at the expense of factual accuracy."
 */

export const EVIS_VERSION = '1.0.0-20261020';
export const INVARIANT_EVIS_EDITORIAL_MEANING = 'EDITORIAL_MEANING_DETERMINES_COMPOSITION';
export const INVARIANT_EVIS_ACCURACY_OVER_VARIETY = 'VISUAL_VARIETY_NEVER_SACRIFICES_ACCURACY';
export const INVARIANT_EVIS_CRITICAL_CONSTRUCTION_ERROR_REJECTS = 'CRITICAL_CONSTRUCTION_ERROR_REJECTS';
export const INVARIANT_EVIS_PROVIDER_NEUTRAL_PROMPT = 'PROVIDER_NEUTRAL_PROMPT';

/**
 * Section B: Editorial Visual Identity Profile
 */
export interface VisualIdentityProfile {
  article_id: number;
  article_slug: string;
  editorial_angle: string;
  reader_question: string;
  primary_subject: string;
  visual_story: string;
  environment_context: string;
  required_visual_evidence: string[];
  excluded_visual_elements: string[];
  visual_distinctiveness_notes: string;
}

export const VISUAL_IDENTITY_PROFILE_FIELDS: (keyof VisualIdentityProfile)[] = [
  'article_id',
  'article_slug',
  'editorial_angle',
  'reader_question',
  'primary_subject',
  'visual_story',
  'environment_context',
  'required_visual_evidence',
  'excluded_visual_elements',
  'visual_distinctiveness_notes'
];

/**
 * Section C & G: Anti-Repetition & Similarity Dimensions
 */
export interface AntiRepetitionDimensions {
  main_object_and_characteristics: string;
  camera_angle_and_framing: string;
  setting_and_architectural_environment: string;
  arrangement_of_materials: string;
  lighting_and_visual_treatment: string;
  editorial_meaning_and_purpose: string;
}

export interface SimilarityCheckResult {
  perceptual_similarity_score?: number; // 0.0 - 1.0
  semantic_editorial_similarity_score?: number; // 0.0 - 1.0
  is_flagged_for_editorial_review: boolean;
  editorial_justification?: string | null;
  review_signals: string[];
}

/**
 * Section F: Visual Quality Assurance Checklist
 */
export interface VisualQAChecklist {
  subject_accuracy: boolean; // 1. Represents the intended article subject accurately
  slot_purpose_addressed: boolean; // 2. Addresses specific visual purpose of assigned slot
  no_critical_construction_errors: boolean; // 3. Contains no critical material or construction errors
  sufficiently_distinct: boolean; // 4. Sufficiently distinct from related editorial images
  meets_composition_and_dimensions: boolean; // 5. Meets required composition and dimensions
  no_unintended_artifacts: boolean; // 6. No unintended labels, logos, watermark, or misleading elements
  critical_error_detail?: string | null;
}

export type VisualQADecision = 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED';

export interface VisualQAResult {
  decision: VisualQADecision;
  ok: boolean;
  reasons: string[];
  blocking_errors: string[];
}

/**
 * Section I: Required Image Provenance
 */
export interface ImageProvenanceRecord {
  article_id: number;
  article_slug: string;
  slot_key: string;
  visual_brief_version: string;
  canonical_prompt: string;
  generation_provider: 'GEMINI_BROWSER' | 'CHATGPT_BROWSER' | 'OPENAI_API' | 'FAL_API' | 'LOCAL_MANUAL';
  image_candidate_reference: string;
  qa_decision: VisualQADecision;
  qa_reviewer: string;
  revision_reason?: string | null;
  final_approved_asset_reference?: string | null;
  recorded_at: string;
}

/**
 * Validates a Visual Identity Profile for completeness
 */
export function validateVisualIdentityProfile(profile: Partial<VisualIdentityProfile>): {
  ok: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (const field of VISUAL_IDENTITY_PROFILE_FIELDS) {
    const val = profile[field];
    if (val === undefined || val === null || val === '') {
      missingFields.push(field);
    } else if (Array.isArray(val) && val.length === 0) {
      missingFields.push(field);
    }
  }

  return {
    ok: missingFields.length === 0,
    missingFields
  };
}

/**
 * Evaluates Visual Quality Assurance (Section F)
 * Invariant: Critical factual or construction errors are automatic revision/rejection triggers regardless of aesthetic quality.
 */
export function evaluateVisualQA(checklist: Partial<VisualQAChecklist>): VisualQAResult {
  const reasons: string[] = [];
  const blocking_errors: string[] = [];

  if (!checklist.no_critical_construction_errors) {
    const detail = checklist.critical_error_detail || 'Critical material or construction inaccuracy detected';
    blocking_errors.push(`CRITICAL_CONSTRUCTION_ERROR: ${detail}`);
  }

  if (!checklist.subject_accuracy) {
    reasons.push('SUBJECT_INACCURATE: Image does not accurately represent the intended article subject');
  }

  if (!checklist.slot_purpose_addressed) {
    reasons.push('SLOT_PURPOSE_UNMET: Image does not fulfill the visual purpose of the assigned slot');
  }

  if (!checklist.sufficiently_distinct) {
    reasons.push('INSUFFICIENT_DISTINCTIVENESS: Image is substantially repetitive with existing catalog assets');
  }

  if (!checklist.meets_composition_and_dimensions) {
    reasons.push('DIMENSION_OR_COMPOSITION_MISMATCH: Image does not conform to required dimensions/framing');
  }

  if (!checklist.no_unintended_artifacts) {
    reasons.push('PROHIBITED_ARTIFACTS: Image contains unwanted text labels, watermark, or misleading artifacts');
  }

  if (blocking_errors.length > 0) {
    return {
      decision: 'REJECTED',
      ok: false,
      reasons: [...blocking_errors, ...reasons],
      blocking_errors
    };
  }

  if (reasons.length > 0) {
    return {
      decision: 'REVISION_REQUIRED',
      ok: false,
      reasons,
      blocking_errors: []
    };
  }

  return {
    decision: 'APPROVED',
    ok: true,
    reasons: [],
    blocking_errors: []
  };
}

/**
 * Evaluates Anti-Repetition similarity signals (Section C & G)
 * Invariant: Changing only decorative elements, color, or location does not count as differentiation.
 */
export function evaluateAntiRepetitionSignals(params: {
  dimensions: AntiRepetitionDimensions;
  comparisonDimensions: AntiRepetitionDimensions;
  semanticSimilarityScore?: number;
  perceptualSimilarityScore?: number;
}): SimilarityCheckResult {
  const reviewSignals: string[] = [];

  // Check trivial differentiation (Section C)
  const isSameSubject = params.dimensions.main_object_and_characteristics.toLowerCase() ===
    params.comparisonDimensions.main_object_and_characteristics.toLowerCase();
  const isSameFraming = params.dimensions.camera_angle_and_framing.toLowerCase() ===
    params.comparisonDimensions.camera_angle_and_framing.toLowerCase();
  const isSameSetting = params.dimensions.setting_and_architectural_environment.toLowerCase() ===
    params.comparisonDimensions.setting_and_architectural_environment.toLowerCase();
  const isSamePurpose = params.dimensions.editorial_meaning_and_purpose.toLowerCase() ===
    params.comparisonDimensions.editorial_meaning_and_purpose.toLowerCase();

  if (isSameSubject && isSameFraming && isSameSetting && isSamePurpose) {
    reviewSignals.push('TRIVIAL_DIFFERENTIATION_SUSPECTED: Identical subject, framing, setting, and editorial meaning');
  }

  if (params.semanticSimilarityScore != null && params.semanticSimilarityScore >= 0.85) {
    reviewSignals.push(`HIGH_SEMANTIC_SIMILARITY: ${(params.semanticSimilarityScore * 100).toFixed(1)}%`);
  }

  if (params.perceptualSimilarityScore != null && params.perceptualSimilarityScore >= 0.90) {
    reviewSignals.push(`HIGH_PERCEPTUAL_SIMILARITY: ${(params.perceptualSimilarityScore * 100).toFixed(1)}%`);
  }

  return {
    perceptual_similarity_score: params.perceptualSimilarityScore,
    semantic_editorial_similarity_score: params.semanticSimilarityScore,
    is_flagged_for_editorial_review: reviewSignals.length > 0,
    review_signals: reviewSignals,
    editorial_justification: null
  };
}
