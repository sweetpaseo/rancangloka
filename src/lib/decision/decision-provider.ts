/**
 * RancangLoka — Abstract Decision Provider Interface
 * Standardizes structured decision engines (Jev / OpenRouter / local mocks).
 */

import type {
  DecisionRequest,
  DecisionAnswer,
  DecisionUsage,
  ChoiceQuestion,
  NoulQuestion,
  ScoreQuestion,
  ChoiceAnswer,
  NoulAnswer,
  ScoreAnswer
} from './decision-types.ts';

export type DecisionErrorCategory =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'MALFORMED'
  | 'CONFIG_MISSING'
  | 'UNKNOWN';

export interface DecisionResult {
  success: boolean;
  answers: Record<string, DecisionAnswer>;
  latencyMs: number;
  model: string;
  provider: string;
  usage?: DecisionUsage;
  error?: string;
  errorCategory?: DecisionErrorCategory;
}

export interface DecisionProvider {
  readonly providerName: string;
  readonly modelName: string;

  /**
   * Evaluate multiple questions against a given state
   */
  evaluate(request: DecisionRequest): Promise<DecisionResult>;

  /**
   * Convenience helper for a single Choice question
   */
  evaluateChoice(
    state: Record<string, any>,
    questionId: string,
    question: ChoiceQuestion
  ): Promise<{ answer?: ChoiceAnswer; result: DecisionResult }>;

  /**
   * Convenience helper for a single Noul (yes/no probability) question
   */
  evaluateNoul(
    state: Record<string, any>,
    questionId: string,
    question: NoulQuestion
  ): Promise<{ answer?: NoulAnswer; result: DecisionResult }>;

  /**
   * Convenience helper for a single Score question
   */
  evaluateScore(
    state: Record<string, any>,
    questionId: string,
    question: ScoreQuestion
  ): Promise<{ answer?: ScoreAnswer; result: DecisionResult }>;
}
