/**
 * ============================================================================
 * RancangLoka Product Decision Engine (PRODUCT_DECISION_ENGINE-1A)
 * Core Domain Types & Data Contracts
 *
 * Invariants:
 * 1. THE_READER_DECISION_IS_PRIMARY (Problem > Context > Solution Class).
 * 2. SOLUTION_CLASS_PRECEDES_PRODUCT_SELECTION (Class before product/SKU).
 * 3. NO_COMMERCE_FIELDS (Zero affiliate, commission, merchant, or pricing fields).
 * 4. NO_FAKE_NUMERIC_PRECISION (Qualitative fit taxonomy and restrained values only).
 * ============================================================================
 */

// ============================================================================
// 1. FIT TAXONOMY
// ============================================================================

export const FIT_TAXONOMY_VALUES = [
  'STRONG_FIT',
  'GOOD_FIT_WITH_TRADEOFF',
  'CONDITIONAL_FIT',
  'POOR_FIT'
] as const;

export type FitTaxonomy = typeof FIT_TAXONOMY_VALUES[number];

// ============================================================================
// 2. CLAIM CLASSES & EVIDENCE
// ============================================================================

export const CANONICAL_CLAIM_CLASSES = [
  'VERIFIED_FACT',
  'TECHNICAL_CONSENSUS',
  'USER_EXPERIENCE_SIGNAL',
  'EDITORIAL_INFERENCE',
  'EDITORIAL_RECOMMENDATION'
] as const;

export type CanonicalClaimClass = typeof CANONICAL_CLAIM_CLASSES[number];

export const SOURCE_FIDELITY_VALUES = [
  'BYTE_EXACT_HASH_VERIFIED',
  'NORMALIZED_HASH_VERIFIED'
] as const;

export type SourceFidelity = typeof SOURCE_FIDELITY_VALUES[number];

export interface EvidenceBinding {
  /** RancangLoka canonical article ID */
  article_id: number;
  /** Permanent canonical slug */
  article_slug: string;
  /** Publication DNA version key (e.g. 'receipt:rcpt_bbae85b48e1b2f8d') */
  publication_version_key: string;
  /** Authoritative SHA-256 hash of the exact published content */
  published_content_hash: string;
  /** Source fidelity contract established during Publication DNA rollout */
  source_fidelity: SourceFidelity;
  /** Canonical epistemic claim classification */
  claim_class: CanonicalClaimClass;
  /** Concise factual claim summary (maximum 200 characters) */
  evidence_summary: string;
  /** Section heading or anchor in the source article */
  source_section?: string;
}

// ============================================================================
// 3. DECISION CONTEXT & DIMENSIONS
// ============================================================================

/** Core Building Contexts */
export type BuildingContextId =
  | 'SINGLE_STORY_HOUSE'
  | 'MULTI_STORY_HOUSE'
  | 'CORNER_HOUSE_HOOK'
  | 'ATTACHED_CLUSTER_TOWNHOUSE';

/** Core Climate & Exposure Profiles */
export type ClimateExposureId =
  | 'WEST_AFTERNOON_HEAT'
  | 'WIND_DRIVEN_RAIN'
  | 'COASTAL_SALT_HUMID'
  | 'STANDARD_TROPICAL_SHELTERED';

/** Core Room & Application Locations */
export type ApplicationLocationId =
  | 'MASTER_BEDROOM'
  | 'LIVING_COMMON_AREA'
  | 'KITCHEN_OR_BATHROOM'
  | 'OUTDOOR_SERVICE_AREA';

/** Core Budget Classes & Capital Staging */
export type BudgetClassId =
  | 'TIGHT_CONSTRAINED'
  | 'BALANCED_MID'
  | 'LONG_TERM_INVESTMENT';

/** Core Maintenance Tolerances */
export type MaintenanceToleranceId =
  | 'FIT_AND_FORGET'
  | 'PERIODIC_LIGHT_MAINTENANCE';

/** Optional Build Phase */
export type BuildPhaseId =
  | 'RENOVATION_OCCUPIED_HOME'
  | 'NEW_CONSTRUCTION_VACANT';

/** Optional Comfort Priority */
export type ComfortPriorityId =
  | 'THERMAL_HEAT_REDUCTION'
  | 'ACOUSTIC_NOISE_REDUCTION'
  | 'BALANCED_COMFORT';

/** Complete Reader Decision Context */
export interface DecisionContext {
  // --- 6 CORE DIMENSIONS (Required) ---
  /** Primary goal or problem statement */
  problem_goal: string;
  /** Type and physical topology of the house */
  building_context: BuildingContextId;
  /** Weather, orientation, and micro-climate exposure */
  climate_exposure: ClimateExposureId;
  /** Room or physical opening application */
  application_location: ApplicationLocationId;
  /** Financial constraint and investment horizon */
  budget_class: BudgetClassId;
  /** Homeowner's maintenance willingness */
  maintenance_tolerance: MaintenanceToleranceId;

  // --- OPTIONAL / DOMAIN-SPECIFIC DIMENSIONS ---
  build_phase?: BuildPhaseId;
  comfort_priority?: ComfortPriorityId;
  security_priority?: 'STANDARD' | 'HIGH_INTRUSION_RESISTANCE';
  installation_constraints?: string[];
  applicator_complexity?: 'GENERAL_LOCAL_HANDYMAN' | 'CERTIFIED_SPECIALIST_REQUIRED';
  service_life_expectation?: 'MEDIUM_5_10_YEARS' | 'LONG_20_PLUS_YEARS';
}

// ============================================================================
// 4. CONSTRAINTS
// ============================================================================

export type ConstraintSeverity = 'HARD' | 'SOFT';

export interface DecisionConstraint {
  constraint_id: string;
  name: string;
  description: string;
  severity: ConstraintSeverity;
  /** Evaluated against DecisionContext */
  applies_when: (context: DecisionContext) => boolean;
  /** Solution class IDs disqualified (for HARD) or downgraded (for SOFT) */
  disqualified_solution_ids?: string[];
  affected_solution_ids?: string[];
  impact_explanation: string;
}

// ============================================================================
// 5. CRITERIA & EVIDENCE VALUE TYPES
// ============================================================================

export type CriterionValueType =
  | 'BOOLEAN'
  | 'ORDINAL'
  | 'QUALITATIVE_CATEGORY'
  | 'MEASURED_VALUE';

export interface MeasuredValueSpec {
  value: number;
  unit: string;
  tolerance?: number;
  standard_reference?: string;
}

export interface DecisionCriterion {
  criterion_id: string;
  name: string;
  dimension_type: 'CORE' | 'OPTIONAL' | 'DOMAIN_SPECIFIC';
  value_type: CriterionValueType;
  description: string;
  evaluation_question: string;
}

export interface CriterionEvaluation {
  criterion_id: string;
  solution_id: string;
  value_type: CriterionValueType;
  /** Qualitative tier (e.g. 'EXCELLENT', 'MODERATE', 'HIGH_RISK') */
  qualitative_tier: string;
  /** Physical measured value ONLY if backed by real lab/standard data */
  measured_value?: MeasuredValueSpec;
  /** Concise factual rationale */
  factual_basis: string;
  /** Canonical evidence binding pointer */
  evidence_binding: EvidenceBinding;
}

// ============================================================================
// 6. TRADEOFFS
// ============================================================================

export interface Tradeoff {
  tradeoff_id: string;
  solution_id: string;
  benefit: string;
  cost_or_compromise: string;
  affected_contexts: string[];
  mitigation_tip?: string;
  evidence_binding: EvidenceBinding;
}

// ============================================================================
// 7. SOLUTION CLASS
// ============================================================================

export interface SolutionClass {
  solution_id: string;
  name: string;
  indonesian_label: string;
  category: 'MATERIAL' | 'BUILDING_SYSTEM' | 'ASSEMBLY';
  description: string;
  inherent_strengths: string[];
  inherent_weaknesses: string[];
  tradeoffs: Tradeoff[];
}

// ============================================================================
// 8. RECOMMENDATION CONTRACT
// ============================================================================

export interface PracticalActionItem {
  order: number;
  action_title: string;
  description: string;
}

export interface PivotCondition {
  trigger_condition: string;
  pivots_to_solution_id: string;
  rationale: string;
}

export interface RecommendationContract {
  recommended_solution_id: string;
  recommended_fit: FitTaxonomy;
  why_recommended: string;
  alternative_solution_id?: string;
  alternative_fit?: FitTaxonomy;
  why_not_alternative?: string;
  fits_who: string[];
  does_not_fit_who: string[];
  critical_tradeoffs: Array<{
    aspect: string;
    compromise: string;
    mitigation_tip?: string;
  }>;
  pivot_conditions: PivotCondition[];
  next_practical_actions: PracticalActionItem[];
  evidence_bindings: EvidenceBinding[];
}

// ============================================================================
// 9. DECISION SCENARIO & MODEL DEFINITION
// ============================================================================

export interface DecisionScenario {
  scenario_id: string;
  title: string;
  context: DecisionContext;
  expected_recommendation: RecommendationContract;
}

export interface DecisionProblem {
  problem_id: string;
  canonical_slug: string;
  title: string;
  description: string;
  primary_article_id: number;
}

export interface DecisionModelDefinition {
  model_id: string;
  model_version: string;
  criteria_version: string;
  problem: DecisionProblem;
  solution_classes: readonly SolutionClass[];
  criteria: readonly DecisionCriterion[];
  evaluations: readonly CriterionEvaluation[];
  constraints: readonly DecisionConstraint[];
  scenarios: readonly DecisionScenario[];
  evidence_snapshot_hash: string;
}

// ============================================================================
// 10. RECALIBRATION DERIVATION TYPE
// ============================================================================

export type EvidenceFreshnessState =
  | 'CURRENT'
  | 'NEEDS_RECALIBRATION'
  | 'EVIDENCE_UNAVAILABLE';

// ============================================================================
// 11. DETERMINISTIC EVALUATOR RUNTIME TYPES (PDE-1B)
// ============================================================================

export interface HardConstraintTrace {
  constraint_id: string;
  name: string;
  severity: 'HARD';
  applied: boolean;
  disqualified_solution_ids: string[];
  affected_solution_ids: string[];
  impact_explanation: string;
}

export interface SoftConstraintTrace {
  constraint_id: string;
  name: string;
  severity: 'SOFT';
  applied: boolean;
  affected_solution_ids: string[];
  impact_explanation: string;
}

export interface CriterionTraceItem {
  criterion_id: string;
  solution_id: string;
  dimension_type: 'CORE' | 'OPTIONAL' | 'DOMAIN_SPECIFIC';
  value_type: CriterionValueType;
  qualitative_tier: string;
  measured_value?: MeasuredValueSpec;
  factual_basis: string;
  evidence_binding: EvidenceBinding;
}

export interface SolutionFitTrace {
  solution_id: string;
  fit: FitTaxonomy;
  is_eligible: boolean;
  disqualification_reason?: string;
  soft_constraint_impacts: string[];
}

export interface ScenarioApplicabilityTrace {
  scenario_id: string;
  title: string;
  matched_dimensions: number;
  total_dimensions: number;
  applicability_ratio: number;
  matching_details: string[];
}

export interface EvaluationTrace {
  model_id: string;
  model_version: string;
  criteria_version: string;
  context: DecisionContext;
  eligible_solutions: string[];
  disqualified_solutions: string[];
  hard_constraint_results: HardConstraintTrace[];
  soft_constraint_results: SoftConstraintTrace[];
  criterion_results: CriterionTraceItem[];
  fit_results: SolutionFitTrace[];
  scenario_applicability: ScenarioApplicabilityTrace[];
  selected_solution_id?: string;
  alternative_solution_id?: string;
  pivot_conditions: PivotCondition[];
  evidence_snapshot_hash: string;
}

export interface EvaluatorOptions {
  /** Map of publication_version_key -> { published_content_hash: string } for freshness verification */
  authoritativeEvidenceMap?: Map<string, { published_content_hash: string }>;
}

export interface EvaluationSuccessResult {
  ok: true;
  status: 'RECOMMENDED';
  recommendation: RecommendationContract;
  trace: EvaluationTrace;
}

export interface EvaluationBlockedResult {
  ok: false;
  status:
    | 'EVALUATION_BLOCKED_EVIDENCE_STALE'
    | 'EVALUATION_BLOCKED_EVIDENCE_UNAVAILABLE'
    | 'INVALID_CONTEXT'
    | 'COMMERCE_FIELD_DETECTED'
    | 'ALL_SOLUTIONS_DISQUALIFIED'
    | 'AMBIGUOUS';
  error: string;
  issues?: Array<{ code: string; field: string; message: string }>;
  trace?: Partial<EvaluationTrace>;
}

export type EvaluationResult = EvaluationSuccessResult | EvaluationBlockedResult;
