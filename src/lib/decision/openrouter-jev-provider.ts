/**
 * RancangLoka — OpenRouter TypeSafe Jev Provider
 * Model: typesafe/jev-1.13
 * Endpoint: POST https://openrouter.ai/api/alpha/decisions
 * 
 * Safety Invariants:
 * - API keys are read from environment / config and NEVER logged or printed.
 * - Fails safe with structured error categories (never throws unhandled exceptions).
 * - Full timeout and cancellation control.
 */

import {
  type DecisionRequest,
  type DecisionResponse,
  type DecisionAnswer,
  type ChoiceQuestion,
  type NoulQuestion,
  type ScoreQuestion,
  type ChoiceAnswer,
  type NoulAnswer,
  type ScoreAnswer,
  type JevConfig,
  JEV_DEFAULT_MODEL,
  OPENROUTER_DECISIONS_ENDPOINT,
  JEV_DEFAULT_TIMEOUT_MS
} from './decision-types.ts';

import {
  type DecisionProvider,
  type DecisionResult,
  type DecisionErrorCategory
} from './decision-provider.ts';

export interface OpenRouterJevProviderOptions {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class OpenRouterJevProvider implements DecisionProvider {
  readonly providerName = 'openrouter';
  readonly modelName: string;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: OpenRouterJevProviderOptions = {}) {
    this.modelName = options.model || JEV_DEFAULT_MODEL;
    this.endpoint = options.endpoint || OPENROUTER_DECISIONS_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? JEV_DEFAULT_TIMEOUT_MS;
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY || '' : '');
    this.fetchFn = (input: RequestInfo | URL, init?: RequestInit) => {
      if (options.fetchFn) {
        return options.fetchFn(input, init);
      }
      if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
        return globalThis.fetch(input, init);
      }
      return fetch(input, init);
    };
  }

  /**
   * Evaluates a decision request with multiple questions against a given state.
   */
  async evaluate(request: DecisionRequest): Promise<DecisionResult> {
    const startTime = Date.now();
    const effectiveModel = request.model || this.modelName;

    // 1. Validate API Key presence
    if (!this.apiKey) {
      return {
        success: false,
        answers: {},
        latencyMs: Date.now() - startTime,
        model: effectiveModel,
        provider: this.providerName,
        error: 'OPENROUTER_API_KEY is not configured',
        errorCategory: 'CONFIG_MISSING'
      };
    }

    // 2. Prepare payload
    const payload = {
      model: effectiveModel,
      state: request.state || {},
      questions: request.questions || {}
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://rancangloka.com',
          'X-Title': 'RancangLoka Decision Observer'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      // 3. Handle HTTP errors with classified categories
      if (!response.ok) {
        let errorCategory: DecisionErrorCategory = 'UNKNOWN';
        if (response.status === 401 || response.status === 403) {
          errorCategory = 'AUTH';
        } else if (response.status === 429) {
          errorCategory = 'RATE_LIMIT';
        }

        let errorText = '';
        try {
          const errBody = await response.text();
          // Never log or echo sensitive auth headers
          errorText = `HTTP ${response.status}: ${errBody.slice(0, 300)}`;
        } catch {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }

        return {
          success: false,
          answers: {},
          latencyMs,
          model: effectiveModel,
          provider: this.providerName,
          error: errorText,
          errorCategory
        };
      }

      // 4. Parse response JSON
      let data: DecisionResponse;
      try {
        data = (await response.json()) as DecisionResponse;
      } catch (jsonErr: any) {
        return {
          success: false,
          answers: {},
          latencyMs,
          model: effectiveModel,
          provider: this.providerName,
          error: `Failed to parse response JSON: ${jsonErr.message}`,
          errorCategory: 'MALFORMED'
        };
      }

      // 5. Validate response structure
      if (!data || typeof data !== 'object' || !data.answers || typeof data.answers !== 'object') {
        return {
          success: false,
          answers: {},
          latencyMs,
          model: effectiveModel,
          provider: this.providerName,
          error: 'Response missing valid answers map',
          errorCategory: 'MALFORMED'
        };
      }

      // Validate each expected question answer
      const validatedAnswers: Record<string, DecisionAnswer> = {};
      for (const [qid, qDef] of Object.entries(request.questions)) {
        const ans = data.answers[qid];
        if (!ans) {
          continue;
        }

        if (qDef.type === 'choice' && ans.type === 'choice') {
          if (typeof ans.choice === 'string') {
            validatedAnswers[qid] = {
              type: 'choice',
              choice: ans.choice,
              probabilities: ans.probabilities || {},
              confidence: typeof ans.confidence === 'number' ? ans.confidence : 0
            };
          }
        } else if (qDef.type === 'noul' && ans.type === 'noul') {
          if (typeof ans.noul === 'number') {
            validatedAnswers[qid] = {
              type: 'noul',
              noul: ans.noul,
              confidence: typeof ans.confidence === 'number' ? ans.confidence : 0
            };
          }
        } else if (qDef.type === 'score' && ans.type === 'score') {
          if (typeof ans.score === 'number') {
            validatedAnswers[qid] = {
              type: 'score',
              score: ans.score,
              probabilities: Array.isArray(ans.probabilities) ? ans.probabilities : [],
              confidence: typeof ans.confidence === 'number' ? ans.confidence : 0
            };
          }
        }
      }

      return {
        success: true,
        answers: validatedAnswers,
        latencyMs,
        model: data.model || effectiveModel,
        provider: this.providerName,
        usage: data.usage
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (err.name === 'AbortError') {
        return {
          success: false,
          answers: {},
          latencyMs,
          model: effectiveModel,
          provider: this.providerName,
          error: `Request timed out after ${this.timeoutMs}ms`,
          errorCategory: 'TIMEOUT'
        };
      }

      return {
        success: false,
        answers: {},
        latencyMs,
        model: effectiveModel,
        provider: this.providerName,
        error: `Network error: ${err.message || String(err)}`,
        errorCategory: 'NETWORK'
      };
    }
  }

  async evaluateChoice(
    state: Record<string, any>,
    questionId: string,
    question: ChoiceQuestion
  ): Promise<{ answer?: ChoiceAnswer; result: DecisionResult }> {
    const result = await this.evaluate({
      model: this.modelName,
      state,
      questions: { [questionId]: question }
    });
    const answer = result.answers[questionId] as ChoiceAnswer | undefined;
    return { answer, result };
  }

  async evaluateNoul(
    state: Record<string, any>,
    questionId: string,
    question: NoulQuestion
  ): Promise<{ answer?: NoulAnswer; result: DecisionResult }> {
    const result = await this.evaluate({
      model: this.modelName,
      state,
      questions: { [questionId]: question }
    });
    const answer = result.answers[questionId] as NoulAnswer | undefined;
    return { answer, result };
  }

  async evaluateScore(
    state: Record<string, any>,
    questionId: string,
    question: ScoreQuestion
  ): Promise<{ answer?: ScoreAnswer; result: DecisionResult }> {
    const result = await this.evaluate({
      model: this.modelName,
      state,
      questions: { [questionId]: question }
    });
    const answer = result.answers[questionId] as ScoreAnswer | undefined;
    return { answer, result };
  }
}
