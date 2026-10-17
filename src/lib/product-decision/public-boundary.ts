/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1E)
 * Public Integration Boundary & Reader-Safe Contracts
 *
 * Core Principles:
 * 1. THE_READER_DECISION_IS_PRIMARY
 *    The public experience assists homeowner architectural decisions.
 *    It is never a catalog, marketplace, top-10 list, or sponsored engine.
 * 2. AFFILIATE_REVENUE_CANNOT_AFFECT_RECOMMENDATION
 *    Decision First -> Product Characteristics Second -> Affiliate Destination Last.
 * 3. NO_FAKE_NUMERIC_PRECISION
 *    Zero scores, ratings, or percentages. Pure qualitative fit taxonomy in plain Indonesian.
 * 4. INTERNAL_DATA_LEAK_PREVENTION
 *    Zero leaking of internal hashes, activation logs, raw SQL, or forensic trace objects.
 * ============================================================================
 */

import type {
  DecisionModelDefinition,
  DecisionContext,
  EvaluationResult,
  EvaluationSuccessResult,
  FitTaxonomy
} from './types.ts';
import {
  validateDecisionContext,
  scanForForbiddenFields
} from './contracts.ts';
import {
  PROBLEM_GOAL_OPTIONS,
  BUILDING_CONTEXT_OPTIONS,
  CLIMATE_EXPOSURE_OPTIONS,
  APPLICATION_LOCATION_OPTIONS,
  BUDGET_CLASS_OPTIONS,
  MAINTENANCE_TOLERANCE_OPTIONS
} from './admin-inspector.ts';

// ============================================================================
// 1. FIT TAXONOMY PUBLIC MAPPING
// ============================================================================

export type PublicFitLabel =
  | 'Sangat Cocok'
  | 'Cocok dengan Kompromi'
  | 'Cocok dengan Syarat Tertentu'
  | 'Kurang Direkomendasikan';

export function mapFitToPublicLabel(fit: FitTaxonomy): PublicFitLabel {
  switch (fit) {
    case 'STRONG_FIT':
      return 'Sangat Cocok';
    case 'GOOD_FIT_WITH_TRADEOFF':
      return 'Cocok dengan Kompromi';
    case 'CONDITIONAL_FIT':
      return 'Cocok dengan Syarat Tertentu';
    case 'POOR_FIT':
      return 'Kurang Direkomendasikan';
    default:
      return 'Cocok dengan Syarat Tertentu';
  }
}

// ============================================================================
// 2. PUBLIC READER RESULT DTO
// ============================================================================

export interface PublicSolutionCard {
  solution_id: string;
  name: string;
  title: string;
  fit_label: PublicFitLabel;
  explanation: string;
  summary: string;
}

export interface PublicTradeoffItem {
  aspect: string;
  benefit: string;
  compromise: string;
  mitigation_tip?: string;
}

export interface PublicEvidenceTransparency {
  article_title: string;
  article_slug: string;
  evidence_claim_count: number;
  review_basis: 'ANALYTICAL_REVIEW' | 'HANDS_ON_REVIEW';
  editorial_statement: string;
}

export interface PublicCommercialFirewall {
  is_independent: true;
  has_affiliate_bias: false;
  recommendation_independent_of_commerce: true;
  statement: string;
}

export interface PublicDecisionResultDTO {
  problem_id: string;
  problem_title: string;
  recommended_solution: PublicSolutionCard;
  alternative_solution?: PublicSolutionCard;
  pivot_conditions: string[];
  important_tradeoffs: PublicTradeoffItem[];
  next_practical_actions: string[];
  evidence_transparency: PublicEvidenceTransparency;
  commercial_firewall: PublicCommercialFirewall;
}

// ============================================================================
// 3. PRODUCT REVIEW DESK HANDOFF CONTRACT
// ============================================================================

export interface ProductReviewHandoffContract {
  /** Target problem identifier */
  problem_id: string;
  /** Final architectural solution class selected by deterministic evaluator */
  solution_class_id: string;
  selected_solution_class_id: string;
  /** Technical specifications and physical criteria required for product matching */
  required_characteristics: string[];
  /** Tradeoffs the product candidate must address or mitigate */
  important_tradeoffs: Array<{ benefit: string; compromise: string }>;
  /** Red lines or traits that disqualify commercial candidate products */
  must_avoid_characteristics: string[];
  /** Summary of reader building context that drove the decision */
  context_summary: Record<string, string>;
  /** Model version identity preserving provenance */
  model_version_key: string;
  /** Authoritative snapshot hash guaranteeing evidence integrity */
  evidence_version: string;
  /** Strict invariant: commercial data cannot influence recommendation */
  commercial_data_allowed: false;
}

// ============================================================================
// 4. MAPPER: EVALUATION RESULT -> PUBLIC RESULT DTO
// ============================================================================

export function mapEvaluationToPublicDTO(
  evaluation: EvaluationResult,
  model: DecisionModelDefinition,
  options?: {
    review_basis?: 'ANALYTICAL_REVIEW' | 'HANDS_ON_REVIEW';
  }
): PublicDecisionResultDTO {
  if (!evaluation.ok || evaluation.status !== 'RECOMMENDED') {
    throw new Error(
      `Cannot map blocked or invalid evaluation to PublicDecisionResultDTO. Status: ${evaluation.status}`
    );
  }

  const success = evaluation as EvaluationSuccessResult;
  const rec = success.recommendation;

  const solMap = new Map(model.solution_classes.map(s => [s.solution_id, s]));
  const primarySol = solMap.get(rec.recommended_solution_id);
  const altSol = rec.alternative_solution_id ? solMap.get(rec.alternative_solution_id) : undefined;

  const primaryName = primarySol ? primarySol.name : rec.recommended_solution_id;
  const altName = altSol ? altSol.name : (rec.alternative_solution_id ?? '');

  // Format pivot conditions into friendly reader guidance
  const formattedPivots = (rec.pivot_conditions || []).map(p => {
    const targetSol = solMap.get(p.pivots_to_solution_id);
    const targetName = targetSol ? targetSol.name : p.pivots_to_solution_id;
    return `Beralih ke ${targetName} jika: ${p.trigger_condition}. Alasan: ${p.rationale}`;
  });

  // Format tradeoffs
  const formattedTradeoffs: PublicTradeoffItem[] = (rec.critical_tradeoffs || []).map(t => {
    return {
      aspect: t.aspect || 'Pertimbangan Teknis',
      benefit: `Keunggulan utama pada aspek ${t.aspect || 'ini'}.`,
      compromise: t.compromise,
      mitigation_tip: t.mitigation_tip
    };
  });

  // Format practical actions
  const formattedActions = (rec.next_practical_actions || [])
    .sort((a, b) => a.order - b.order)
    .map(a => `${a.action_title}: ${a.description}`);

  const reviewBasis = options?.review_basis || 'ANALYTICAL_REVIEW';
  const editorialStatement =
    reviewBasis === 'HANDS_ON_REVIEW'
      ? 'RancangLoka menguji langsung material ini di lapangan dan mengonfirmasi perilakunya terhadap iklim tropis.'
      : 'RancangLoka menyusun panduan ini berdasarkan analisis fisika bangunan, standar teknis material, dan verifikasi empiris di iklim Indonesia, bebas dari pengaruh merek atau sponsor komersial.';

  return {
    problem_id: model.problem.problem_id,
    problem_title: model.problem.title,
    recommended_solution: {
      solution_id: rec.recommended_solution_id,
      name: primaryName,
      title: primaryName,
      fit_label: mapFitToPublicLabel(rec.recommended_fit),
      explanation: rec.why_recommended,
      summary: rec.why_recommended
    },
    alternative_solution: rec.alternative_solution_id
      ? {
          solution_id: rec.alternative_solution_id,
          name: altName,
          title: altName,
          fit_label: mapFitToPublicLabel(rec.alternative_fit || 'CONDITIONAL_FIT'),
          explanation: rec.why_not_alternative || 'Alternatif pendamping untuk pertimbangan kondisi spesifik.',
          summary: rec.why_not_alternative || 'Alternatif pendamping untuk pertimbangan kondisi spesifik.'
        }
      : undefined,
    pivot_conditions: formattedPivots,
    important_tradeoffs: formattedTradeoffs,
    next_practical_actions: formattedActions,
    evidence_transparency: {
      article_title: model.problem.title,
      article_slug: model.problem.canonical_slug,
      evidence_claim_count: rec.evidence_bindings.length,
      review_basis: reviewBasis,
      editorial_statement: editorialStatement
    },
    commercial_firewall: {
      is_independent: true,
      has_affiliate_bias: false,
      recommendation_independent_of_commerce: true,
      statement:
        'Rekomendasi ini murni bersumber dari kelas solusi teknis yang cocok untuk hunian Anda. Nilai komersial, ketersediaan toko, atau komisi merchant dilarang memengaruhi rekomendasi ini.'
    }
  };
}

// ============================================================================
// 5. PRODUCT REVIEW DESK HANDOFF GENERATOR
// ============================================================================

export function createProductReviewHandoff(
  evaluation: EvaluationResult,
  model: DecisionModelDefinition,
  versionKey: string
): ProductReviewHandoffContract {
  if (!evaluation.ok || evaluation.status !== 'RECOMMENDED') {
    throw new Error(
      `Cannot create ProductReviewHandoff from non-recommended evaluation. Status: ${evaluation.status}`
    );
  }

  const success = evaluation as EvaluationSuccessResult;
  const rec = success.recommendation;
  const sol = model.solution_classes.find(s => s.solution_id === rec.recommended_solution_id);

  const requiredSpecs: string[] = [];
  const mustAvoid: string[] = [];

  // Extract technical traits from criteria evaluations
  for (const crit of model.criteria) {
    const ev = model.evaluations.find(
      e => e.criterion_id === crit.criterion_id && e.solution_id === rec.recommended_solution_id
    );
    if (ev) {
      requiredSpecs.push(`${crit.name}: ${ev.qualitative_tier} - ${ev.factual_basis}`);
    }
  }

  // Identify disqualification risks from pivot conditions and constraints
  for (const pivot of rec.pivot_conditions) {
    mustAvoid.push(`Hindari menggunakan untuk: ${pivot.trigger_condition}`);
  }

  const tradeoffs = (sol?.tradeoffs || []).map(t => ({
    benefit: t.benefit,
    compromise: t.cost_or_compromise
  }));

  const contextRecord: Record<string, string> = {};
  if (success.trace?.context) {
    const ctx = success.trace.context as Record<string, any>;
    for (const [k, v] of Object.entries(ctx)) {
      if (typeof v === 'string') {
        contextRecord[k] = v;
      }
    }
  }

  return {
    problem_id: model.problem.problem_id,
    solution_class_id: rec.recommended_solution_id,
    selected_solution_class_id: rec.recommended_solution_id,
    required_characteristics: requiredSpecs,
    important_tradeoffs: tradeoffs,
    must_avoid_characteristics: mustAvoid,
    context_summary: contextRecord,
    model_version_key: versionKey,
    evidence_version: model.evidence_snapshot_hash,
    commercial_data_allowed: false
  };
}

// ============================================================================
// 6. PUBLIC INPUT VALIDATOR
// ============================================================================

export function validatePublicDecisionInput(
  input: unknown
): { valid: true; context: DecisionContext } | { valid: false; errors: string[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['Input must be a valid JSON object.'] };
  }

  const raw = input as Record<string, any>;
  const errors: string[] = [];

  // Check for forbidden commercial fields in input
  const commerceViolations = scanForForbiddenFields(raw);
  if (commerceViolations.length > 0) {
    for (const v of commerceViolations) {
      errors.push(`Forbidden field detected: ${v.field} (${v.message})`);
    }
    return { valid: false, errors };
  }

  // Validate all 6 mandatory CORE dimensions against controlled taxonomy
  const goalValid = PROBLEM_GOAL_OPTIONS.some(o => o.value === raw.problem_goal);
  if (!goalValid) errors.push(`Invalid or missing problem_goal: '${raw.problem_goal}'`);

  const buildingValid = BUILDING_CONTEXT_OPTIONS.some(o => o.value === raw.building_context);
  if (!buildingValid) errors.push(`Invalid or missing building_context: '${raw.building_context}'`);

  const climateValid = CLIMATE_EXPOSURE_OPTIONS.some(o => o.value === raw.climate_exposure);
  if (!climateValid) errors.push(`Invalid or missing climate_exposure: '${raw.climate_exposure}'`);

  const locationValid = APPLICATION_LOCATION_OPTIONS.some(o => o.value === raw.application_location);
  if (!locationValid) errors.push(`Invalid or missing application_location: '${raw.application_location}'`);

  const budgetValid = BUDGET_CLASS_OPTIONS.some(o => o.value === raw.budget_class);
  if (!budgetValid) errors.push(`Invalid or missing budget_class: '${raw.budget_class}'`);

  const maintValid = MAINTENANCE_TOLERANCE_OPTIONS.some(o => o.value === raw.maintenance_tolerance);
  if (!maintValid) errors.push(`Invalid or missing maintenance_tolerance: '${raw.maintenance_tolerance}'`);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const context: DecisionContext = {
    problem_goal: raw.problem_goal,
    building_context: raw.building_context,
    climate_exposure: raw.climate_exposure,
    application_location: raw.application_location,
    budget_class: raw.budget_class,
    maintenance_tolerance: raw.maintenance_tolerance
  };

  const validation = validateDecisionContext(context);
  if (!validation.valid) {
    return { valid: false, errors: validation.issues.map(i => `${i.field}: ${i.message}`) };
  }

  return { valid: true, context };
}

// ============================================================================
// 7. ADMIN VS PUBLIC FIELD CLASSIFICATION MATRIX
// ============================================================================

export const ADMIN_ONLY_FIELDS = [
  'model_payload_hash',
  'evidence_snapshot_hash',
  'activation_ledger',
  'raw_evaluation_trace',
  'forensic_audit_hashes',
  'internal_predicate_rules',
  'hard_constraint_results',
  'soft_constraint_results',
  'criterion_results',
  'scenario_applicability'
] as const;

export const PUBLIC_SAFE_FIELDS = [
  'problem_id',
  'problem_title',
  'recommended_solution',
  'alternative_solution',
  'fit_label',
  'why_recommended',
  'why_not_alternative',
  'pivot_conditions',
  'important_tradeoffs',
  'next_practical_actions',
  'evidence_transparency',
  'commercial_firewall'
] as const;

export const SHARED_FIELDS = [
  'model_id',
  'canonical_slug',
  'model_version',
  'criteria_version',
  'solution_classes.name',
  'criteria.name'
] as const;
