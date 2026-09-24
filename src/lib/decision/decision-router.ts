/**
 * RancangLoka — Generic Decision Router
 * Milestone: JEV-4A/4B
 * 
 * Bounded Choice Decision Router & Disagreement Classifier.
 * 
 * Invariants:
 * - The router MUST NOT call any LLM itself.
 * - Only returns normalized decisions and analytics classifications.
 * - Minimal State Principle: Expects normalized structured signals.
 */

import {
  type DecisionPoint,
  DECISION_POINTS,
  type ModelRouteChoice,
  MODEL_ROUTES,
  type ResearchSufficiencyChoice,
  RESEARCH_ROUTES,
  type RewriteRouteChoice,
  REWRITE_ROUTES,
  type RetryRouteChoice,
  RETRY_ROUTES,
  type PublicationPreflightChoice,
  PUBLICATION_PREFLIGHT_ROUTES,
  type EditorialMediaRole,
  EDITORIAL_MEDIA_ROLES,
  type MediaDensityChoice,
  MEDIA_DENSITY_CHOICES,
  type MediaSlotAction,
  MEDIA_SLOT_ACTIONS,
  type MediaPlanningSignals,
  type MediaPlanSlot,
  type MediaPlanningDecision,
  type DisagreementClassification,
  type ResearchSufficiencySignals,
  type ModelRoutingSignals,
  type RewriteRoutingSignals,
  type RetryRoutingSignals,
  type PublicationPreflightSignals
} from './decision-types.ts';

export {
  DECISION_POINTS,
  MODEL_ROUTES,
  RESEARCH_ROUTES,
  REWRITE_ROUTES,
  RETRY_ROUTES,
  PUBLICATION_PREFLIGHT_ROUTES,
  EDITORIAL_MEDIA_ROLES,
  MEDIA_DENSITY_CHOICES,
  MEDIA_SLOT_ACTIONS
};

// ============================================================
// 1. BOUNDED CHOICE VALIDATORS
// ============================================================

export const VALID_MODEL_ROUTES: readonly ModelRouteChoice[] = [
  'skip_llm',
  'cheap_model',
  'standard_model',
  'strong_model',
  'human_review'
];

export const VALID_RESEARCH_CHOICES: readonly ResearchSufficiencyChoice[] = [
  'continue_to_writer',
  'research_more',
  'human_review'
];

export const VALID_REWRITE_CHOICES: readonly RewriteRouteChoice[] = [
  'accept',
  'targeted_revision',
  'full_regeneration',
  'human_review'
];

export const VALID_RETRY_CHOICES: readonly RetryRouteChoice[] = [
  'retry',
  'backoff',
  'stop',
  'human_review'
];

export const VALID_PREFLIGHT_CHOICES: readonly PublicationPreflightChoice[] = [
  'continue',
  'revise',
  'human_review',
  'stop'
];

// ============================================================
// 2. DISAGREEMENT CLASSIFIER (ANALYTICS ONLY)
// ============================================================

/**
 * Classifies agreement/disagreement between the authoritative deterministic decision
 * and the Jev shadow recommendation.
 * Invariant: This output is strictly analytical and NEVER alters execution.
 */
export function classifyDisagreement(
  decisionPoint: DecisionPoint,
  authoritativeDecision: string,
  jevDecision: string | null,
  providerStatus: 'SUCCESS' | 'ERROR' | 'FALLBACK'
): DisagreementClassification {
  if (providerStatus !== 'SUCCESS' || !jevDecision) {
    return 'JEV_UNAVAILABLE';
  }

  const auth = authoritativeDecision.toLowerCase().trim();
  const jev = jevDecision.toLowerCase().trim();

  // If Jev explicitly asks for human review
  if (jev === 'human_review') {
    return 'JEV_HUMAN_REVIEW';
  }

  if (decisionPoint === 'publication_preflight') {
    // Exact agreement pairs
    if ((auth === 'continue' || auth === 'ready') && jev === 'continue') return 'AGREE_CONTINUE';
    if (auth === 'revise' && jev === 'revise') return 'AGREE_REVISE';
    if ((auth === 'stop' || auth === 'hold' || auth === 'blocked') && jev === 'stop') return 'AGREE_STOP';

    // Jev more conservative (auth is more permissive than Jev)
    // continue > revise > stop
    if ((auth === 'continue' || auth === 'ready') && (jev === 'revise' || jev === 'stop')) {
      return 'JEV_MORE_CONSERVATIVE';
    }
    if (auth === 'revise' && jev === 'stop') {
      return 'JEV_MORE_CONSERVATIVE';
    }

    // Jev more permissive (Jev is more permissive than auth)
    if (jev === 'continue' && (auth === 'revise' || auth === 'stop' || auth === 'hold' || auth === 'blocked')) {
      return 'JEV_MORE_PERMISSIVE';
    }
    if (jev === 'revise' && (auth === 'stop' || auth === 'hold' || auth === 'blocked')) {
      return 'JEV_MORE_PERMISSIVE';
    }
  }

  if (decisionPoint === 'research_sufficiency') {
    const isAuthPass = auth === 'continue_to_writer' || auth === 'pass';
    const isJevPass = jev === 'continue_to_writer';
    const isAuthFail = auth === 'research_more' || auth === 'fail' || auth === 'blocked';
    const isJevFail = jev === 'research_more';

    if (isAuthPass && isJevPass) return 'AGREE_CONTINUE';
    if (isAuthFail && isJevFail) return 'AGREE_STOP';
    if (isAuthPass && isJevFail) return 'JEV_MORE_CONSERVATIVE';
    if (isAuthFail && isJevPass) return 'JEV_MORE_PERMISSIVE';
  }

  if (decisionPoint === 'rewrite_routing') {
    const isAuthAccept = auth === 'accept';
    const isJevAccept = jev === 'accept';
    const isAuthReject = auth === 'full_regeneration' || auth === 'stop';
    const isJevReject = jev === 'full_regeneration';

    if (isAuthAccept && isJevAccept) return 'AGREE_CONTINUE';
    if (isAuthReject && isJevReject) return 'AGREE_STOP';
    if (isAuthAccept && (isJevReject || jev === 'targeted_revision')) return 'JEV_MORE_CONSERVATIVE';
    if (isAuthReject && isJevAccept) return 'JEV_MORE_PERMISSIVE';
  }

  if (decisionPoint === 'retry_routing') {
    const isAuthRetry = auth === 'retry';
    const isJevRetry = jev === 'retry';
    const isAuthStop = auth === 'stop';
    const isJevStop = jev === 'stop';

    if (isAuthRetry && isJevRetry) return 'AGREE_CONTINUE';
    if (isAuthStop && isJevStop) return 'AGREE_STOP';
    if (isAuthRetry && (isJevStop || jev === 'backoff')) return 'JEV_MORE_CONSERVATIVE';
    if (isAuthStop && isJevRetry) return 'JEV_MORE_PERMISSIVE';
  }

  if (decisionPoint === 'media_planning') {
    const densityRank: Record<string, number> = {
      minimal: 1,
      standard: 2,
      rich: 3
    };
    const authRank = densityRank[auth] || 2;
    const jevRank = densityRank[jev] || 2;

    if (auth === jev) return 'AGREE_CONTINUE';
    if (jevRank < authRank) return 'JEV_MORE_CONSERVATIVE';
    if (jevRank > authRank) return 'JEV_MORE_PERMISSIVE';
    return 'AGREE_CONTINUE';
  }

  // Exact string match fallback
  if (auth === jev) {
    return auth.includes('stop') || auth.includes('fail') ? 'AGREE_STOP' : 'AGREE_CONTINUE';
  }

  return 'JEV_MORE_CONSERVATIVE';
}

export type PublicationGateAlignment = 'BOTH_CONTINUE' | 'BOTH_HALT' | 'DIVERGENT';

/**
 * Gate-level binary publication alignment metric.
 * Treats revise and stop as BOTH_HALT from the operational publication gate perspective,
 * without replacing or modifying action-level disagreement_classification.
 */
export function computePublicationGateAlignment(
  decisionPoint: DecisionPoint,
  authoritativeDecision: string,
  jevDecision: string | null
): PublicationGateAlignment | 'NOT_APPLICABLE' {
  if (decisionPoint !== 'publication_preflight' || !jevDecision) {
    return 'NOT_APPLICABLE';
  }

  const auth = authoritativeDecision.toLowerCase().trim();
  const jev = jevDecision.toLowerCase().trim();

  const isAuthContinue = auth === 'continue' || auth === 'ready';
  const isJevContinue = jev === 'continue';

  if (isAuthContinue && isJevContinue) {
    return 'BOTH_CONTINUE';
  }

  const isAuthHalt = auth === 'revise' || auth === 'stop' || auth === 'hold' || auth === 'blocked';
  const isJevHalt = jev === 'revise' || jev === 'stop';

  if (isAuthHalt && isJevHalt) {
    return 'BOTH_HALT';
  }

  return 'DIVERGENT';
}

// ============================================================
// 3. DETERMINISTIC ROUTING ENGINES (FOR TESTS / AUTHORITATIVE BASELINE)
// ============================================================

export function routeResearchSufficiencyDeterministic(
  signals: ResearchSufficiencySignals
): { decision: ResearchSufficiencyChoice; reasons: string[] } {
  const reasons: string[] = [];

  if (signals.source_count < 2) {
    reasons.push('INSUFFICIENT_SOURCES (Minimum 2 required)');
  }
  if (signals.authoritative_source_count < 1) {
    reasons.push('NO_AUTHORITATIVE_SOURCE');
  }
  if (signals.contradiction_count > 0) {
    reasons.push(`CONTRADICTIONS_DETECTED (${signals.contradiction_count} found)`);
  }
  if (signals.coverage_score < 0.60) {
    reasons.push(`LOW_COVERAGE (${Math.round(signals.coverage_score * 100)}%)`);
  }

  if (reasons.length === 0) {
    return { decision: 'continue_to_writer', reasons: ['ALL_RESEARCH_CRITERIA_MET'] };
  }

  if (signals.contradiction_count > 1) {
    return { decision: 'human_review', reasons };
  }

  return { decision: 'research_more', reasons };
}

export function routeModelDeterministic(
  signals: ModelRoutingSignals
): { decision: ModelRouteChoice; reasons: string[] } {
  const reasons: string[] = [];

  if (signals.prior_attempts > 2) {
    reasons.push('EXCESSIVE_PRIOR_ATTEMPTS');
    return { decision: 'human_review', reasons };
  }

  if (signals.risk_level === 'high' || signals.complexity === 'high') {
    reasons.push('HIGH_COMPLEXITY_OR_RISK');
    return { decision: 'strong_model', reasons };
  }

  if (signals.complexity === 'medium' || signals.risk_level === 'medium') {
    reasons.push('STANDARD_EDITORIAL_TASK');
    return { decision: 'standard_model', reasons };
  }

  if (signals.complexity === 'low' && signals.risk_level === 'low') {
    if (signals.evidence_quality === 'high') {
      reasons.push('LOW_RISK_HIGH_QUALITY_EVIDENCE');
      return { decision: 'cheap_model', reasons };
    }
    reasons.push('LOW_RISK_STANDARD');
    return { decision: 'standard_model', reasons };
  }

  return { decision: 'standard_model', reasons: ['DEFAULT_STANDARD_ROUTE'] };
}

export function routeRewriteDeterministic(
  signals: RewriteRoutingSignals
): { decision: RewriteRouteChoice; reasons: string[] } {
  const reasons: string[] = [];

  if (!signals.content_contract_pass) {
    reasons.push('CONTRACT_VIOLATION');
  }
  if (!signals.editorial_validation_pass) {
    reasons.push('EDITORIAL_VALIDATION_FAILED');
  }
  if (signals.factual_issue_count > 0) {
    reasons.push(`FACTUAL_ISSUES (${signals.factual_issue_count})`);
  }
  if (signals.style_issue_count > 0) {
    reasons.push(`STYLE_ISSUES (${signals.style_issue_count})`);
  }
  if (signals.structural_issue_count > 0) {
    reasons.push(`STRUCTURAL_ISSUES (${signals.structural_issue_count})`);
  }

  if (reasons.length === 0) {
    return { decision: 'accept', reasons: ['ALL_VALIDATIONS_PASSED'] };
  }

  if (signals.previous_revisions >= 2) {
    reasons.push('MAX_REVISIONS_EXCEEDED');
    return { decision: 'human_review', reasons };
  }

  if (signals.structural_issue_count > 2 || signals.factual_issue_count > 2) {
    reasons.push('MAJOR_STRUCTURAL_OR_FACTUAL_FLAWS');
    return { decision: 'full_regeneration', reasons };
  }

  return { decision: 'targeted_revision', reasons };
}

export function routeRetryDeterministic(
  signals: RetryRoutingSignals
): { decision: RetryRouteChoice; reasons: string[] } {
  if (signals.error_class === 'SAFETY_BLOCK') {
    return { decision: 'stop', reasons: ['SAFETY_BLOCK_TERMINAL'] };
  }

  if (signals.error_class === 'TERMINAL') {
    return { decision: 'stop', reasons: ['TERMINAL_FAILURE_NOT_RETRYABLE'] };
  }

  if (signals.attempt >= signals.max_attempts) {
    return { decision: 'human_review', reasons: ['MAX_ATTEMPTS_EXHAUSTED'] };
  }

  if (signals.attempt > 1) {
    return { decision: 'backoff', reasons: ['INTERMEDIATE_ATTEMPT_BACKOFF'] };
  }

  return { decision: 'retry', reasons: ['RETRYABLE_ERROR_INITIAL_ATTEMPT'] };
}

export interface MediaPolicyLimits {
  min_total_media?: number;
  max_total_media?: number;
  require_featured?: boolean;
  allow_duplicates?: boolean;
  reuse_first?: boolean;
}

export const DEFAULT_MEDIA_POLICY: MediaPolicyLimits = {
  min_total_media: 1,
  max_total_media: 5,
  require_featured: true,
  allow_duplicates: false,
  reuse_first: true
};

/**
 * Validates and enforces deterministic hard policy rules over a media plan recommendation.
 * Hard rule authority MUST override recommendations that violate boundaries.
 * Authority: DETERMINISTIC
 */
export function validateAndEnforceMediaPlan(
  recommendation: Partial<MediaPlanningDecision>,
  signals: MediaPlanningSignals,
  customPolicy?: MediaPolicyLimits
): { decision: MediaPlanningDecision; adjustments: string[]; hardRuleApplied: boolean } {
  const policy = { ...DEFAULT_MEDIA_POLICY, ...customPolicy };
  const adjustments: string[] = [];

  // 1. Density validation
  let density: MediaDensityChoice = recommendation.media_density || 'standard';
  if (!MEDIA_DENSITY_CHOICES.includes(density)) {
    density = 'standard';
    adjustments.push('INVALID_DENSITY_NORMALIZED');
  }

  // 2. Slots validation & copy
  let slots: MediaPlanSlot[] = Array.isArray(recommendation.slots)
    ? recommendation.slots.map(s => ({ ...s }))
    : [];

  // 3. Validate each slot's media_type and action
  for (const slot of slots) {
    if (!EDITORIAL_MEDIA_ROLES.includes(slot.media_type)) {
      slot.media_type = 'section_support';
      adjustments.push('INVALID_MEDIA_TYPE_NORMALIZED');
    }
    if (!MEDIA_SLOT_ACTIONS.includes(slot.action)) {
      slot.action = 'generate';
      adjustments.push('INVALID_ACTION_NORMALIZED');
    }
  }

  // 4. Featured requirement
  if (policy.require_featured && !signals.featured_media_present) {
    const hasFeatured = slots.some(s => s.media_type === 'featured');
    if (!hasFeatured) {
      slots.unshift({
        media_type: 'featured',
        action: signals.existing_usable_media_count > 0 && policy.reuse_first ? 'reuse' : 'generate',
        target_section: 'hero',
        editorial_purpose: 'Mandatory featured header visual (enforced by deterministic rule)',
        priority: 100,
        confidence: 1.0
      });
      adjustments.push('FEATURED_SLOT_ENFORCED');
    }
  }

  // 5. Duplicate featured restriction
  if (!policy.allow_duplicates) {
    let featuredFound = false;
    for (const slot of slots) {
      if (slot.media_type === 'featured') {
        if (featuredFound) {
          slot.media_type = 'context_photo';
          adjustments.push('DUPLICATE_FEATURED_CONVERTED');
        } else {
          featuredFound = true;
        }
      }
    }
  }

  // 6. Reuse-first & Unrelated Existing Media verification
  if (signals.existing_usable_media_count === 0) {
    for (const slot of slots) {
      if (slot.action === 'reuse') {
        slot.action = 'generate';
        adjustments.push('UNRELATED_EXISTING_MEDIA_REJECTED');
      }
    }
  }

  // 7. Clamp minimum total media
  const minMedia = policy.min_total_media ?? 1;
  if (slots.length < minMedia) {
    while (slots.length < minMedia) {
      slots.push({
        media_type: 'section_support',
        action: 'generate',
        target_section: `section_${slots.length + 1}`,
        editorial_purpose: 'Minimum required editorial visual support',
        priority: 50,
        confidence: 1.0
      });
    }
    adjustments.push('CLAMPED_TO_MINIMUM');
  }

  // 8. Clamp maximum total media
  const maxMedia = policy.max_total_media ?? 5;
  if (slots.length > maxMedia) {
    slots = slots.slice(0, maxMedia);
    adjustments.push('CLAMPED_TO_MAXIMUM');
  }

  // 9. Recompute totals
  const recommended_total_media = slots.length;
  const existing_usable_media = slots.filter(s => s.action === 'reuse').length;
  const new_media_required = slots.filter(s => s.action === 'generate').length;

  return {
    decision: {
      media_density: density,
      recommended_total_media,
      existing_usable_media,
      new_media_required,
      slots
    },
    adjustments,
    hardRuleApplied: adjustments.length > 0
  };
}

/**
 * Deterministic baseline media planning engine.
 */
export function routeMediaPlanningDeterministic(
  signals: MediaPlanningSignals,
  customPolicy?: MediaPolicyLimits
): { decision: MediaPlanningDecision; reasons: string[] } {
  const policy = { ...DEFAULT_MEDIA_POLICY, ...customPolicy };
  const reasons: string[] = [];

  // 1. Determine density
  let density: MediaDensityChoice = 'standard';
  if (
    signals.word_count < 600 &&
    signals.visual_explanation_value === 'low' &&
    !signals.article_has_comparison &&
    !signals.article_has_process
  ) {
    density = 'minimal';
    reasons.push('SHORT_LOW_VISUAL_VALUE_MINIMAL');
  } else if (
    signals.word_count > 1500 ||
    signals.visualizable_section_count >= 3 ||
    signals.article_has_comparison ||
    signals.article_has_material_detail ||
    signals.visual_explanation_value === 'high'
  ) {
    density = 'rich';
    reasons.push('HIGH_COMPLEXITY_OR_COMPARISON_RICH');
  } else {
    reasons.push('STANDARD_EDITORIAL_MEDIA_DENSITY');
  }

  // 2. Build slots
  const slots: MediaPlanSlot[] = [];
  let remainingUsable = signals.existing_usable_media_count;

  // Featured slot
  if (policy.require_featured) {
    const isFeaturedAction = remainingUsable > 0 && policy.reuse_first ? 'reuse' : 'generate';
    if (isFeaturedAction === 'reuse') remainingUsable--;
    slots.push({
      media_type: 'featured',
      action: isFeaturedAction,
      target_section: 'hero',
      editorial_purpose: 'Primary article featured header visual',
      priority: 100,
      confidence: 1.0
    });
  }

  // Comparison slot
  if (signals.article_has_comparison || signals.comparison_section_count > 0) {
    const action = remainingUsable > 0 && policy.reuse_first ? 'reuse' : 'generate';
    if (action === 'reuse') remainingUsable--;
    slots.push({
      media_type: 'comparison_visual',
      action,
      target_section: 'comparison',
      editorial_purpose: 'Direct visual comparison of products/materials',
      priority: 90,
      confidence: 1.0
    });
  }

  // Process slot
  if (signals.article_has_process || signals.process_section_count > 0) {
    const action = remainingUsable > 0 && policy.reuse_first ? 'reuse' : 'generate';
    if (action === 'reuse') remainingUsable--;
    slots.push({
      media_type: 'process_visual',
      action,
      target_section: 'steps_guide',
      editorial_purpose: 'Sequential step-by-step workflow guide visual',
      priority: 85,
      confidence: 1.0
    });
  }

  // Material / Detail slot
  if (signals.article_has_material_detail) {
    const action = remainingUsable > 0 && policy.reuse_first ? 'reuse' : 'generate';
    if (action === 'reuse') remainingUsable--;
    slots.push({
      media_type: 'material_detail',
      action,
      target_section: 'material_spec',
      editorial_purpose: 'Close-up technical texture and material detail',
      priority: 80,
      confidence: 1.0
    });
  }

  // Additional slots for rich density
  if (density === 'rich' && slots.length < (policy.max_total_media ?? 5)) {
    const needed = Math.min(
      (policy.max_total_media ?? 5) - slots.length,
      Math.max(1, signals.visualizable_section_count - slots.length)
    );
    for (let i = 0; i < needed; i++) {
      const action = remainingUsable > 0 && policy.reuse_first ? 'reuse' : 'generate';
      if (action === 'reuse') remainingUsable--;
      slots.push({
        media_type: i % 2 === 0 ? 'context_photo' : 'section_support',
        action,
        target_section: `section_${slots.length + 1}`,
        editorial_purpose: 'In-context supporting editorial photograph',
        priority: 70 - i * 5,
        confidence: 1.0
      });
    }
  }

  // 3. Enforce policy bounds
  const enforced = validateAndEnforceMediaPlan({
    media_density: density,
    slots
  }, signals, policy);

  return {
    decision: enforced.decision,
    reasons: [...reasons, ...enforced.adjustments]
  };
}

// ============================================================
// 4. UNIFIED NORMALIZED DECISION DISPATCHER
// ============================================================

export interface NormalizedDecision {
  decision_point: DecisionPoint;
  normalized_choice: string;
  evaluation_type: 'deterministic' | 'bounded_choice';
  reasons: string[];
  requires_human_review: boolean;
  confidence: number;
}

/**
 * Route a decision deterministically based on structured signals.
 * The router MUST NOT call any LLM itself.
 * It only returns a normalized decision and analytical reasons.
 */
export function routeDecision(
  decisionPoint: DecisionPoint,
  signals: any
): NormalizedDecision {
  let decision: string = 'human_review';
  let reasons: string[] = [];

  switch (decisionPoint) {
    case 'model_routing': {
      const res = routeModelDeterministic(signals as ModelRoutingSignals);
      decision = res.decision;
      reasons = res.reasons;
      break;
    }
    case 'research_sufficiency': {
      const res = routeResearchSufficiencyDeterministic(signals as ResearchSufficiencySignals);
      decision = res.decision;
      reasons = res.reasons;
      break;
    }
    case 'rewrite_routing': {
      const res = routeRewriteDeterministic(signals as RewriteRoutingSignals);
      decision = res.decision;
      reasons = res.reasons;
      break;
    }
    case 'retry_routing': {
      const res = routeRetryDeterministic(signals as RetryRoutingSignals);
      decision = res.decision;
      reasons = res.reasons;
      break;
    }
    case 'publication_preflight': {
      const preflight = signals as PublicationPreflightSignals;
      if (!preflight.articleGenerationCompleted || !preflight.editorialValidationPassed || preflight.duplicateSlug) {
        decision = 'stop';
        reasons = ['SAFETY_OR_CONTENT_GUARD_FAILED'];
      } else if (!preflight.heroImagePresent || !preflight.referencesPresent) {
        decision = 'revise';
        reasons = ['MEDIA_OR_REFERENCES_MISSING'];
      } else {
        decision = 'continue';
        reasons = ['ALL_PREFLIGHT_CHECKS_PASSED'];
      }
      break;
    }
    case 'media_planning': {
      const res = routeMediaPlanningDeterministic(signals as MediaPlanningSignals);
      decision = res.decision.media_density;
      reasons = res.reasons;
      break;
    }
    default:
      decision = 'human_review';
      reasons = [`UNKNOWN_DECISION_POINT_${decisionPoint}`];
  }

  return {
    decision_point: decisionPoint,
    normalized_choice: decision,
    evaluation_type: 'deterministic',
    reasons,
    requires_human_review: decision === 'human_review',
    confidence: 1.0
  };
}
