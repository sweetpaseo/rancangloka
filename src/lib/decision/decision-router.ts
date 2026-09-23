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
  PUBLICATION_PREFLIGHT_ROUTES
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
    const isAuthContinue = auth === 'continue' || auth === 'ready';
    const isJevContinue = jev === 'continue';
    const isAuthStop = auth === 'stop' || auth === 'hold' || auth === 'blocked';
    const isJevStop = jev === 'stop';

    if (isAuthContinue && isJevContinue) return 'AGREE_CONTINUE';
    if (isAuthStop && isJevStop) return 'AGREE_STOP';
    if (isAuthContinue && (isJevStop || jev === 'revise')) return 'JEV_MORE_CONSERVATIVE';
    if (isAuthStop && isJevContinue) return 'JEV_MORE_PERMISSIVE';
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

  // Exact string match fallback
  if (auth === jev) {
    return auth.includes('stop') || auth.includes('fail') ? 'AGREE_STOP' : 'AGREE_CONTINUE';
  }

  return 'JEV_MORE_CONSERVATIVE';
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
