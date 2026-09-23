/**
 * RancangLoka — TypeSafe Jev Decision Platform Types
 * Milestone: JEV-4A/4B
 * 
 * Strict Contracts for:
 * - Generic Decision Points (publication_preflight, research_sufficiency, model_routing, rewrite_routing, retry_routing)
 * - Minimal State Principle Signals (NO raw article bodies or full source documents)
 * - Bounded Route Choices
 * - Strict DecisionObservation schema (NO `any` types)
 * - Disagreement Classification & Cost Routing Foundations
 */

export const JEV_DEFAULT_MODEL = 'typesafe/jev-1.13';
export const OPENROUTER_DECISIONS_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
export const JEV_DEFAULT_TIMEOUT_MS = 5000;
export const DECISION_SCHEMA_VERSION_V1 = '2026-09-23.v1';
export const DECISION_SCHEMA_VERSION_V2 = '2026-09-23.v2';
export const DECISION_SCHEMA_VERSION = DECISION_SCHEMA_VERSION_V2;
export const DECISION_PROMPT_VERSION = 'v1.13';

// ============================================================
// 1. QUESTION PRIMITIVES
// ============================================================

export type DecisionQuestionType = 'choice' | 'noul' | 'score';

export interface ChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export interface NoulQuestion {
  type: 'noul';
  instructions: string;
  criteria: {
    true: string;
    false: string;
  };
}

export interface ScoreQuestion {
  type: 'score';
  instructions: string;
  criteria: string[];
}

export type DecisionQuestion = ChoiceQuestion | NoulQuestion | ScoreQuestion;

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface NoulAnswer {
  type: 'noul';
  noul: number;
  confidence: number;
}

export interface ScoreAnswer {
  type: 'score';
  score: number;
  probabilities: number[];
  confidence: number;
}

export type DecisionAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export interface DecisionRequest {
  model: string;
  state: Record<string, any>;
  questions: Record<string, DecisionQuestion>;
}

export interface DecisionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

export interface DecisionResponse {
  answers: Record<string, DecisionAnswer>;
  usage?: DecisionUsage;
  model?: string;
}

export type JevMode = 'shadow' | 'disabled';

export interface JevConfig {
  enabled: boolean;
  mode: JevMode;
  provider: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
  endpoint: string;
}

// ============================================================
// 2. GENERIC DECISION POINTS & SUBJECTS
// ============================================================

export type DecisionPoint =
  | 'publication_preflight'
  | 'research_sufficiency'
  | 'model_routing'
  | 'rewrite_routing'
  | 'retry_routing'
  | 'media_planning';

export const DECISION_POINTS: DecisionPoint[] = [
  'publication_preflight',
  'research_sufficiency',
  'model_routing',
  'rewrite_routing',
  'retry_routing',
  'media_planning'
];

export type SubjectType = 'article' | 'topic' | 'task' | 'draft' | 'execution' | 'media';

// ============================================================
// 3. BOUNDED ROUTING CHOICES
// ============================================================

export type ModelRouteChoice =
  | 'skip_llm'
  | 'cheap_model'
  | 'standard_model'
  | 'strong_model'
  | 'human_review';

export const MODEL_ROUTES: ModelRouteChoice[] = [
  'skip_llm',
  'cheap_model',
  'standard_model',
  'strong_model',
  'human_review'
];

export type ResearchSufficiencyChoice =
  | 'continue_to_writer'
  | 'research_more'
  | 'human_review';

export const RESEARCH_ROUTES: ResearchSufficiencyChoice[] = [
  'continue_to_writer',
  'research_more',
  'human_review'
];

export type RewriteRouteChoice =
  | 'accept'
  | 'targeted_revision'
  | 'full_regeneration'
  | 'human_review';

export const REWRITE_ROUTES: RewriteRouteChoice[] = [
  'accept',
  'targeted_revision',
  'full_regeneration',
  'human_review'
];

export type RetryRouteChoice =
  | 'retry'
  | 'backoff'
  | 'stop'
  | 'human_review';

export const RETRY_ROUTES: RetryRouteChoice[] = [
  'retry',
  'backoff',
  'stop',
  'human_review'
];

export type PublicationPreflightChoice =
  | 'continue'
  | 'revise'
  | 'human_review'
  | 'stop';

export const PUBLICATION_PREFLIGHT_ROUTES: PublicationPreflightChoice[] = [
  'continue',
  'revise',
  'human_review',
  'stop'
];

// ============================================================
// 4. MINIMAL STATE PRINCIPLE SIGNALS
// ============================================================

export interface PublicationPreflightSignals {
  project: 'RancangLoka';
  articleId: string | number;
  slug: string;
  articleGenerationCompleted: boolean;
  editorialValidationPassed: boolean;
  referencesPresent: boolean;
  heroImagePresent: boolean;
  duplicateSlug: boolean;
  persistedReadinessStatus?: 'READY_TO_SCHEDULE' | 'NOT_READY' | 'BLOCKED';
  plannerEligibilityStatus?: 'ELIGIBLE' | 'NOT_ELIGIBLE';
  readinessStatus?: string;
  readingTimeMinutes?: number;
  isSponsored?: boolean;
}

/** Backward compatibility alias */
export type CandidateDecisionState = PublicationPreflightSignals;

export interface ResearchSufficiencySignals {
  topic: string;
  source_count: number;
  authoritative_source_count: number;
  source_diversity: number; // e.g. distinct domains
  contradiction_count: number;
  coverage_score: number; // 0.00 to 1.00
  freshness_score: number; // 0.00 to 1.00
}

export interface ModelRoutingSignals {
  task_type: string; // e.g. 'planning', 'writing', 'qa', 'fact_check'
  complexity: 'low' | 'medium' | 'high';
  risk_level: 'low' | 'medium' | 'high';
  evidence_quality: 'low' | 'medium' | 'high';
  prior_attempts: number;
  token_estimate: number;
}

export interface RewriteRoutingSignals {
  content_contract_pass: boolean;
  editorial_validation_pass: boolean;
  factual_issue_count: number;
  style_issue_count: number;
  structural_issue_count: number;
  previous_revisions: number;
}

export interface RetryRoutingSignals {
  attempt: number;
  max_attempts: number;
  error_class: 'RETRYABLE' | 'TERMINAL' | 'SAFETY_BLOCK';
  error_code: string;
  elapsed_seconds: number;
}

// ============================================================
// 4B. GENERIC MEDIA PLANNING CONTRACTS
// ============================================================

export type EditorialMediaRole =
  | 'featured'
  | 'context_photo'
  | 'material_detail'
  | 'comparison_visual'
  | 'technical_diagram'
  | 'process_visual'
  | 'before_after'
  | 'section_support';

export const EDITORIAL_MEDIA_ROLES: readonly EditorialMediaRole[] = [
  'featured',
  'context_photo',
  'material_detail',
  'comparison_visual',
  'technical_diagram',
  'process_visual',
  'before_after',
  'section_support'
];

export type MediaDensityChoice = 'minimal' | 'standard' | 'rich';

export const MEDIA_DENSITY_CHOICES: readonly MediaDensityChoice[] = [
  'minimal',
  'standard',
  'rich'
];

export type MediaSlotAction = 'reuse' | 'generate' | 'skip';

export const MEDIA_SLOT_ACTIONS: readonly MediaSlotAction[] = [
  'reuse',
  'generate',
  'skip'
];

export interface MediaPlanningSignals {
  content_type: string; // e.g. 'article', 'review', 'comparison', 'guide', 'news'
  word_count: number;
  heading_count: number;
  major_section_count: number;
  visualizable_section_count: number;
  comparison_section_count: number;
  process_section_count: number;
  technical_complexity: 'low' | 'medium' | 'high';
  visual_explanation_value: 'low' | 'medium' | 'high';

  existing_media_count: number;
  existing_usable_media_count: number;
  featured_media_present: boolean;

  article_has_comparison: boolean;
  article_has_process: boolean;
  article_has_material_detail: boolean;
  article_has_spatial_explanation: boolean;
}

export interface MediaPlanSlot {
  media_type: EditorialMediaRole;
  action: MediaSlotAction;
  target_section: string;
  editorial_purpose: string;
  priority?: number;
  confidence?: number;
  reused_asset_id?: string | null;
}

export interface MediaPlanningDecision {
  media_density: MediaDensityChoice;
  recommended_total_media: number;
  existing_usable_media: number;
  new_media_required: number;
  slots: MediaPlanSlot[];
}

export interface MediaPlanningCostEstimate {
  baseline_static_media_count: number;
  jev_recommended_media_count: number;
  existing_media_reused: number;
  new_generation_required: number;
  generation_calls_avoided: number;
}

// ============================================================
// 5. DISAGREEMENT & ANALYTICS CLASSIFICATIONS
// ============================================================

export type DisagreementClassification =
  | 'AGREE_CONTINUE'
  | 'AGREE_STOP'
  | 'JEV_MORE_CONSERVATIVE'
  | 'JEV_MORE_PERMISSIVE'
  | 'JEV_HUMAN_REVIEW'
  | 'JEV_UNAVAILABLE';

// ============================================================
// 6. COST ROUTING FOUNDATION
// ============================================================

export interface CostRoutingEstimate {
  llm_call_avoided: boolean;
  strong_model_call_avoided: boolean;
  additional_jev_call: boolean;
  route_selected: string;
  baseline_strategy: 'ALWAYS_STRONG_MODEL';
  jev_strategy: 'JEV_ROUTED_MODEL';
  estimated_input_tokens?: number;
  estimated_output_tokens?: number;
}

// ============================================================
// 7. STRICT DECISION OBSERVATION CONTRACT (NO `any`)
// ============================================================

export type ProviderStatus = 'SUCCESS' | 'ERROR' | 'FALLBACK';

export interface DecisionObservation {
  observation_id: string;
  decision_point: DecisionPoint;
  subject_type: SubjectType;
  subject_id: string;
  run_id: string | null;

  authoritative_decision: string;
  authoritative_reasons: string[];

  jev_decision: string | null;
  jev_probabilities: Record<string, number> | null;
  jev_confidence: number | null;

  provider: string;
  model: string;
  model_version: string;

  input_schema_version: string;
  prompt_version: string;
  input_hash: string;

  latency_ms: number;
  provider_status: ProviderStatus;
  status?: ProviderStatus;
  provider_error_class: string | null;
  errorCategory?: string;
  fallbackReason?: string;

  disagreement_classification: DisagreementClassification;
  cost_routing_estimate: CostRoutingEstimate | null;

  created_at: string;

  // Backward compatibility convenience aliases
  correlationId?: string;
  confidence?: number;

  // Optional normalized recommendations snapshot for preflight
  recommendations?: {
    nextAction?: string;
    needsHumanReview?: boolean;
    publicationRisk?: string;
  };
  stateSnapshot?: Record<string, any>;
  usage?: DecisionUsage;
}

/** Backward compatibility alias */
export type ShadowObservation = DecisionObservation;
