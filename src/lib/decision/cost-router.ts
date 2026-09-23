/**
 * RancangLoka — Cost Routing Foundation
 * Milestone: JEV-4A/4B
 * 
 * Pure, deterministic cost-routing evaluation comparing:
 * ALWAYS_STRONG_MODEL baseline vs JEV_ROUTED_MODEL strategy.
 * 
 * Invariants:
 * - NO live LLM calls.
 * - NO hardcoded monetary savings claims.
 * - Captures structured telemetry for empirical cost calculation.
 */

import {
  type CostRoutingEstimate,
  type ModelRouteChoice
} from './decision-types.ts';

export interface CostRoutingEvaluationInput {
  route_selected: ModelRouteChoice | string;
  task_type: string;
  estimated_input_tokens?: number;
  estimated_output_tokens?: number;
}

/**
 * Evaluates the cost-routing delta for a selected model route.
 */
export function evaluateCostRouting(
  inputOrRoute: CostRoutingEvaluationInput | ModelRouteChoice | string,
  extra?: Partial<CostRoutingEvaluationInput>
): CostRoutingEstimate {
  const normalizedInput: CostRoutingEvaluationInput =
    typeof inputOrRoute === 'string'
      ? {
          route_selected: inputOrRoute,
          task_type: extra?.task_type || 'unspecified',
          estimated_input_tokens: extra?.estimated_input_tokens,
          estimated_output_tokens: extra?.estimated_output_tokens
        }
      : inputOrRoute;

  const route = normalizedInput.route_selected;

  // An LLM call is avoided entirely if task is skipped or routed to deterministic rules
  const llmCallAvoided = route === 'skip_llm';

  // A strong model call (e.g. GPT-5.6 / Opus / Tier-1) is avoided if routed to
  // cheap_model, standard_model, or skipped entirely
  const strongModelCallAvoided =
    route === 'cheap_model' ||
    route === 'standard_model' ||
    route === 'skip_llm';

  // An additional lightweight Jev decision call is always incurred by using Jev routing
  const additionalJevCall = true;

  return {
    llm_call_avoided: llmCallAvoided,
    strong_model_call_avoided: strongModelCallAvoided,
    additional_jev_call: additionalJevCall,
    route_selected: route,
    baseline_strategy: 'ALWAYS_STRONG_MODEL',
    jev_strategy: 'JEV_ROUTED_MODEL',
    estimated_input_tokens: normalizedInput.estimated_input_tokens,
    estimated_output_tokens: normalizedInput.estimated_output_tokens
  };
}
