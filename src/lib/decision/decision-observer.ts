/**
 * RancangLoka — Shadow Decision Observer
 * Milestone: JEV-4A/4B
 * 
 * Safely evaluates publication candidate state using TypeSafe Jev in SHADOW MODE ONLY.
 * 
 * Strict Guarantees:
 * - Deterministic RancangLoka rules remain 100% AUTHORITATIVE.
 * - Jev is an asynchronous, non-blocking observer.
 * - Jev observations CANNOT mutate, publish, schedule, or block any real action.
 * - Minimal State Principle: Only compact factual signals are evaluated, NEVER article bodies.
 * - Fails closed / safe: any error or timeout records an observation failure and returns immediately.
 * - Produces strictly typed DecisionObservation records with durable telemetry support.
 */

import {
  type CandidateDecisionState,
  type DecisionObservation,
  type JevConfig,
  type DecisionQuestion,
  JEV_DEFAULT_MODEL,
  OPENROUTER_DECISIONS_ENDPOINT,
  JEV_DEFAULT_TIMEOUT_MS,
  DECISION_SCHEMA_VERSION,
  DECISION_PROMPT_VERSION
} from './decision-types.ts';

import {
  type DecisionProvider,
  type DecisionResult
} from './decision-provider.ts';

import { OpenRouterJevProvider } from './openrouter-jev-provider.ts';
import { classifyDisagreement } from './decision-router.ts';
import {
  recordDecisionObservation,
  getMemoryObservations,
  clearMemoryObservations
} from './decision-telemetry.ts';

export function getJevConfig(): JevConfig {
  const env = typeof process !== 'undefined' ? process.env || {} : {};
  const isEnabled = env.JEV_ENABLED === 'true';
  const rawMode = env.JEV_MODE?.toLowerCase();
  
  // Safety Invariant: active mode is strictly forbidden at this phase.
  const mode = rawMode === 'shadow' ? 'shadow' : (isEnabled ? 'shadow' : 'disabled');

  return {
    enabled: isEnabled,
    mode,
    provider: env.JEV_PROVIDER || 'openrouter',
    model: env.JEV_MODEL || JEV_DEFAULT_MODEL,
    apiKey: env.OPENROUTER_API_KEY || '',
    timeoutMs: Number(env.JEV_TIMEOUT_MS) || JEV_DEFAULT_TIMEOUT_MS,
    endpoint: env.JEV_ENDPOINT || OPENROUTER_DECISIONS_ENDPOINT
  };
}

/**
 * Standard RancangLoka candidate questions for Jev
 */
export function buildCandidateQuestions(): Record<string, DecisionQuestion> {
  return {
    nextAction: {
      type: 'choice',
      instructions: 'What is the appropriate next pipeline action for this publication candidate?',
      criteria: {
        continue: 'Article passes editorial validations, references and media are present, and candidate is ready to schedule.',
        revise: 'Validation passed but minor improvements are needed before publication.',
        human_review: 'Editorial approval is pending, or high-risk claims require human editor verification.',
        stop: 'Candidate failed contract guards, has duplicate slug, or missing essential prerequisites.'
      }
    },
    needsHumanReview: {
      type: 'noul',
      instructions: 'Does this candidate require explicit Chief Editor human review before publication dispatch?',
      criteria: {
        true: 'Human approval is pending or high-risk claims/sponsored content require human sign-off.',
        false: 'Candidate satisfies standard verified criteria and all editorial gates.'
      }
    },
    publicationRisk: {
      type: 'choice',
      instructions: 'What is the publication risk level for this candidate?',
      criteria: {
        very_low: 'All validations passed, genuine authentic article, verified references and validated media.',
        low: 'Standard article with verified evidence and clean editorial checks.',
        medium: 'Article has time-sensitive claims or pending secondary verifications.',
        high: 'High-risk topic, missing primary evidence, or unvalidated media assets.',
        critical: 'Guard violations, monetary policy breach, or duplicate slug conflict.'
      }
    }
  };
}

function computeInputHash(data: any): string {
  const json = JSON.stringify(data, Object.keys(data).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `h_${(h >>> 0).toString(16)}`;
}

function generateObservationId(): string {
  return `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getRecentShadowObservations(): DecisionObservation[] {
  return getMemoryObservations();
}

export function clearShadowObservations(): void {
  clearMemoryObservations();
}

/**
 * Observe a candidate asynchronously in SHADOW MODE.
 * Guaranteed to never throw and never alter execution flow.
 */
export async function observeCandidateShadowDecision(
  state: CandidateDecisionState,
  options: {
    provider?: DecisionProvider;
    config?: JevConfig;
    correlationId?: string;
    db?: any;
    authoritativeDecision?: string;
    authoritativeReasons?: string[];
  } = {}
): Promise<DecisionObservation> {
  const baseConfig = options.config || getJevConfig();
  const config = options.provider && !options.config
    ? { ...baseConfig, enabled: true, mode: 'shadow' as const }
    : baseConfig;
  const runId = options.correlationId || null;
  const observationId = generateObservationId();
  const timestamp = new Date().toISOString();
  const authDecision = options.authoritativeDecision || 'continue';
  const authReasons = options.authoritativeReasons || ['DETERMINISTIC_ELIGIBILITY_PASSED'];
  const inputHash = computeInputHash(state);

  // If Jev is disabled or in disabled mode, return immediate fallback record
  if (!config.enabled || config.mode === 'disabled') {
    const disabledObservation: DecisionObservation = {
      observation_id: observationId,
      decision_point: 'publication_preflight',
      subject_type: 'article',
      subject_id: String(state.articleId),
      run_id: runId,
      authoritative_decision: authDecision,
      authoritative_reasons: authReasons,
      jev_decision: null,
      jev_probabilities: null,
      jev_confidence: null,
      provider: config.provider,
      model: config.model,
      model_version: '20260917',
      input_schema_version: DECISION_SCHEMA_VERSION,
      prompt_version: DECISION_PROMPT_VERSION,
      input_hash: inputHash,
      latency_ms: 0,
      provider_status: 'FALLBACK',
      status: 'FALLBACK',
      provider_error_class: 'JEV_DISABLED',
      errorCategory: 'JEV_DISABLED',
      fallbackReason: 'JEV_DISABLED',
      disagreement_classification: 'JEV_UNAVAILABLE',
      cost_routing_estimate: null,
      created_at: timestamp,
      correlationId: runId || undefined,
      confidence: 0,
      stateSnapshot: state,
      recommendations: {}
    };
    await recordDecisionObservation(options.db, disabledObservation);
    return disabledObservation;
  }

  const provider = options.provider || new OpenRouterJevProvider({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    model: config.model,
    timeoutMs: config.timeoutMs
  });

  const questions = buildCandidateQuestions();

  try {
    const result: DecisionResult = await provider.evaluate({
      model: config.model,
      state,
      questions
    });

    if (!result.success) {
      const errorObservation: DecisionObservation = {
        observation_id: observationId,
        decision_point: 'publication_preflight',
        subject_type: 'article',
        subject_id: String(state.articleId),
        run_id: runId,
        authoritative_decision: authDecision,
        authoritative_reasons: authReasons,
        jev_decision: null,
        jev_probabilities: null,
        jev_confidence: null,
        provider: result.provider,
        model: result.model,
        model_version: '20260917',
        input_schema_version: DECISION_SCHEMA_VERSION,
        prompt_version: DECISION_PROMPT_VERSION,
        input_hash: inputHash,
        latency_ms: result.latencyMs,
        provider_status: 'ERROR',
        status: 'ERROR',
        provider_error_class: result.errorCategory || 'UNKNOWN',
        errorCategory: result.errorCategory || 'UNKNOWN',
        disagreement_classification: 'JEV_UNAVAILABLE',
        cost_routing_estimate: null,
        created_at: timestamp,
        correlationId: runId || undefined,
        confidence: 0,
        stateSnapshot: state,
        recommendations: {}
      };
      await recordDecisionObservation(options.db, errorObservation);
      return errorObservation;
    }

    // Extract recommendations safely
    const nextActionAns = result.answers.nextAction;
    const humanReviewAns = result.answers.needsHumanReview;
    const riskAns = result.answers.publicationRisk;

    const jevChoice = nextActionAns?.type === 'choice' ? nextActionAns.choice : null;
    const jevProbs = nextActionAns?.type === 'choice' ? nextActionAns.probabilities : null;
    const jevConf = nextActionAns?.type === 'choice' ? nextActionAns.confidence : null;

    const recommendations = {
      nextAction: jevChoice || undefined,
      needsHumanReview: humanReviewAns?.type === 'noul' ? humanReviewAns.noul > 0.5 : undefined,
      publicationRisk: riskAns?.type === 'choice' ? riskAns.choice : undefined
    };

    const disagreement = classifyDisagreement(
      'publication_preflight',
      authDecision,
      jevChoice,
      'SUCCESS'
    );

    const observation: DecisionObservation = {
      observation_id: observationId,
      decision_point: 'publication_preflight',
      subject_type: 'article',
      subject_id: String(state.articleId),
      run_id: runId,
      authoritative_decision: authDecision,
      authoritative_reasons: authReasons,
      jev_decision: jevChoice,
      jev_probabilities: jevProbs,
      jev_confidence: jevConf,
      provider: result.provider,
      model: result.model,
      model_version: '20260917',
      input_schema_version: DECISION_SCHEMA_VERSION,
      prompt_version: DECISION_PROMPT_VERSION,
      input_hash: inputHash,
      latency_ms: result.latencyMs,
      provider_status: 'SUCCESS',
      status: 'SUCCESS',
      provider_error_class: null,
      disagreement_classification: disagreement,
      cost_routing_estimate: null,
      created_at: timestamp,
      correlationId: runId || undefined,
      confidence: jevConf || 0,
      stateSnapshot: state,
      recommendations,
      usage: result.usage
    };

    await recordDecisionObservation(options.db, observation);
    return observation;
  } catch (unexpectedError: any) {
    // Failsafe: never throw to caller
    const failedObservation: DecisionObservation = {
      observation_id: observationId,
      decision_point: 'publication_preflight',
      subject_type: 'article',
      subject_id: String(state.articleId),
      run_id: runId,
      authoritative_decision: authDecision,
      authoritative_reasons: authReasons,
      jev_decision: null,
      jev_probabilities: null,
      jev_confidence: null,
      provider: config.provider,
      model: config.model,
      model_version: '20260917',
      input_schema_version: DECISION_SCHEMA_VERSION,
      prompt_version: DECISION_PROMPT_VERSION,
      input_hash: inputHash,
      latency_ms: 0,
      provider_status: 'ERROR',
      status: 'ERROR',
      provider_error_class: 'UNEXPECTED_EXCEPTION',
      errorCategory: 'UNEXPECTED_EXCEPTION',
      disagreement_classification: 'JEV_UNAVAILABLE',
      cost_routing_estimate: null,
      created_at: timestamp,
      correlationId: runId || undefined,
      confidence: 0,
      stateSnapshot: state,
      recommendations: {}
    };
    await recordDecisionObservation(options.db, failedObservation);
    return failedObservation;
  }
}
