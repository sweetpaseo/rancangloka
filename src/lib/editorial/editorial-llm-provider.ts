/**
 * RancangLoka Editorial LLM Provider
 * Milestone: EDITORIAL-RUNTIME-1
 *
 * Implements a secure, server-side text generation transport for editorial drafting (Joko).
 * Completely separate from TypeSafe JEV Decisions infrastructure.
 *
 * Safety Invariants:
 * - Server-side only. Zero client exposure.
 * - API keys are never logged, printed, or echoed.
 * - Fails closed with classified error categories if credentials or endpoints are unconfigured.
 * - Rejects empty, whitespace-only, or malformed responses.
 * - Bounded timeouts and tokens prevent runaway execution.
 */

export type EditorialLlmProviderName = 'openrouter' | 'sumopod' | 'custom';

export type CanonicalProviderErrorCategory =
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_HTTP_ERROR'
  | 'PROVIDER_INVALID_JSON'
  | 'PROVIDER_EMPTY_RESPONSE'
  | 'PROVIDER_MISSING_CONTENT'
  | 'PROVIDER_CONTEXT_LIMIT'
  | 'PROVIDER_TRANSPORT_ERROR';

export type EditorialLlmErrorCategory =
  | CanonicalProviderErrorCategory
  | 'CONFIG_MISSING'
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'SERVER_ERROR'
  | 'MALFORMED'
  | 'EMPTY_RESPONSE';

export interface EditorialChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EditorialGenerationRequest {
  messages: EditorialChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jobId?: string;
  taskId?: string;
}

export interface EditorialGenerationUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface EditorialAttemptDiagnostic {
  attempt: number;
  timestamp: string;
  elapsedMs: number;
  httpStatus?: number;
  responseBodyBytes?: number;
  errorCategory?: EditorialLlmErrorCategory;
  error?: string;
  retryReason?: string;
  finishReason?: string;
  reasoningContentLength?: number;
  rawSnippet?: string;
}

export interface PromptBudgetTelemetry {
  system_prompt_characters: number;
  user_prompt_characters: number;
  total_prompt_characters: number;
  request_body_bytes: number;
  estimated_input_tokens: number;
}

export interface EditorialGenerationResult {
  success: boolean;
  content: string | null;
  provider: EditorialLlmProviderName;
  model: string;
  latencyMs: number;
  usage?: EditorialGenerationUsage;
  error?: string;
  errorCategory?: EditorialLlmErrorCategory;
  canonicalCategory?: CanonicalProviderErrorCategory;
  attempts: number;
  requestId?: string;
  finishReason?: string;
  httpStatus?: number;
  rawResponseBodyBytes?: number;
  promptTelemetry?: PromptBudgetTelemetry;
  attemptsDiagnostics?: EditorialAttemptDiagnostic[];
}

export interface EditorialLlmOptions {
  provider?: EditorialLlmProviderName;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
  fetchFn?: typeof fetch;
}

export const DEFAULT_OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_SUMOPOD_ENDPOINT = 'https://ai.sumopod.com/v1/chat/completions';
export const DEFAULT_EDITORIAL_TIMEOUT_MS = 120000; // 120 seconds
export const DEFAULT_EDITORIAL_MAX_TOKENS = 8000; // 8000 tokens completion headroom
export const DEFAULT_EDITORIAL_TEMPERATURE = 0.6;
export const DEFAULT_EDITORIAL_MODEL = 'google/gemini-2.0-flash-001';
export const DEFAULT_EDITORIAL_MAX_RETRIES = 2; // Up to 3 total attempts for transient failures

/**
 * Checks if a provider failure is retryable under the bounded transient retry policy.
 */
export function isRetryableProviderError(errorCategory: EditorialLlmErrorCategory, httpStatus?: number): boolean {
  if (errorCategory === 'PROVIDER_AUTH_ERROR' || errorCategory === 'AUTH') return false;
  if (errorCategory === 'PROVIDER_CONTEXT_LIMIT') return false;
  if (errorCategory === 'CONFIG_MISSING') return false;
  if (errorCategory === 'PROVIDER_HTTP_ERROR' || errorCategory === 'SERVER_ERROR') {
    // 4xx client errors (e.g. 400 bad request, 404 not found) are non-retryable
    // 429 rate limit is retryable
    // 5xx server errors (500, 502, 503, 504) are retryable
    if (httpStatus && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) {
      return false;
    }
    return true;
  }
  // Transient failures: TIMEOUT, RATE_LIMIT, EMPTY_RESPONSE, MISSING_CONTENT, TRANSPORT_ERROR, INVALID_JSON
  return true;
}

/**
 * Sanitizes headers to ensure secrets cannot leak to error messages or logs.
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase().includes('auth') || k.toLowerCase().includes('key') || k.toLowerCase().includes('token')) {
      sanitized[k] = '[REDACTED]';
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export class EditorialLlmProvider {
  readonly providerName: EditorialLlmProviderName;
  readonly modelName: string;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: EditorialLlmOptions = {}) {
    const env = typeof process !== 'undefined' ? process.env || {} : {};

    // 1. Determine Provider
    const detectedProvider: EditorialLlmProviderName =
      options.provider ||
      (env.EDITORIAL_LLM_PROVIDER as EditorialLlmProviderName) ||
      (env.OPENROUTER_API_KEY ? 'openrouter' : env.SUMOPOD_API_KEY ? 'sumopod' : 'openrouter');
    this.providerName = detectedProvider;

    // 2. Resolve API Key
    this.apiKey =
      options.apiKey ||
      (detectedProvider === 'openrouter'
        ? env.OPENROUTER_API_KEY || env.EDITORIAL_LLM_API_KEY || ''
        : detectedProvider === 'sumopod'
        ? env.SUMOPOD_API_KEY || env.EDITORIAL_LLM_API_KEY || ''
        : env.EDITORIAL_LLM_API_KEY || '');

    // 3. Resolve Endpoint
    this.endpoint =
      options.endpoint ||
      env.EDITORIAL_LLM_ENDPOINT ||
      (detectedProvider === 'sumopod' ? DEFAULT_SUMOPOD_ENDPOINT : DEFAULT_OPENROUTER_ENDPOINT);

    // 4. Resolve Model
    this.modelName =
      options.model ||
      env.EDITORIAL_LLM_MODEL ||
      (detectedProvider === 'sumopod' ? 'gpt-5-nano' : DEFAULT_EDITORIAL_MODEL);

    // 5. Operational Bounds
    this.timeoutMs = options.timeoutMs ?? (env.EDITORIAL_LLM_TIMEOUT_MS ? Number(env.EDITORIAL_LLM_TIMEOUT_MS) : DEFAULT_EDITORIAL_TIMEOUT_MS);
    this.maxTokens = options.maxTokens ?? (env.EDITORIAL_LLM_MAX_TOKENS ? Number(env.EDITORIAL_LLM_MAX_TOKENS) : DEFAULT_EDITORIAL_MAX_TOKENS);
    this.temperature = options.temperature ?? (env.EDITORIAL_LLM_TEMPERATURE ? Number(env.EDITORIAL_LLM_TEMPERATURE) : DEFAULT_EDITORIAL_TEMPERATURE);
    this.maxRetries = options.maxRetries ?? (env.EDITORIAL_LLM_MAX_RETRIES ? Number(env.EDITORIAL_LLM_MAX_RETRIES) : DEFAULT_EDITORIAL_MAX_RETRIES);

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
   * Generates a text response from the configured LLM provider.
   * Enforces fail-closed semantics on missing credentials, malformed responses,
   * with bounded transient retry and granular error classification.
   */
  async generate(request: EditorialGenerationRequest): Promise<EditorialGenerationResult> {
    const startTime = Date.now();
    const effectiveModel = request.model || this.modelName;

    // 1. Fail closed if API key is not configured
    if (!this.apiKey) {
      return {
        success: false,
        content: null,
        provider: this.providerName,
        model: effectiveModel,
        latencyMs: Date.now() - startTime,
        error: `Editorial LLM Provider API key is not configured for provider '${this.providerName}'. Set OPENROUTER_API_KEY or EDITORIAL_LLM_API_KEY.`,
        errorCategory: 'CONFIG_MISSING',
        canonicalCategory: 'PROVIDER_AUTH_ERROR',
        attempts: 0
      };
    }

    // 2. Validate input messages
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      return {
        success: false,
        content: null,
        provider: this.providerName,
        model: effectiveModel,
        latencyMs: Date.now() - startTime,
        error: 'Generation request missing valid messages array',
        errorCategory: 'PROVIDER_MISSING_CONTENT',
        canonicalCategory: 'PROVIDER_MISSING_CONTENT',
        attempts: 0
      };
    }

    const outputTokens = request.maxTokens ?? this.maxTokens;
    const payload: Record<string, any> = {
      model: effectiveModel,
      messages: request.messages,
      max_tokens: outputTokens
    };

    // Temperature inclusion (omit if model does not support it or null)
    const effectiveTemp = request.temperature ?? this.temperature;
    if (effectiveTemp !== null && effectiveTemp !== undefined) {
      payload.temperature = effectiveTemp;
    }

    // Prompt Budget Telemetry
    const systemPromptChars = request.messages
      .filter(m => m.role === 'system')
      .reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const userPromptChars = request.messages
      .filter(m => m.role !== 'system')
      .reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const totalPromptChars = systemPromptChars + userPromptChars;
    const requestBodyString = JSON.stringify(payload);
    const requestBodyBytes = Buffer.byteLength(requestBodyString, 'utf8');
    const estimatedInputTokens = Math.ceil(totalPromptChars / 3.5);

    const promptTelemetry: PromptBudgetTelemetry = {
      system_prompt_characters: systemPromptChars,
      user_prompt_characters: userPromptChars,
      total_prompt_characters: totalPromptChars,
      request_body_bytes: requestBodyBytes,
      estimated_input_tokens: estimatedInputTokens
    };

    let lastError: string = '';
    let lastErrorCategory: EditorialLlmErrorCategory = 'PROVIDER_HTTP_ERROR';
    let lastCanonicalCategory: CanonicalProviderErrorCategory = 'PROVIDER_HTTP_ERROR';
    let lastHttpStatus: number | undefined;
    let lastResponseBodyBytes: number | undefined;
    let attemptsCount = 0;
    const attemptsDiagnostics: EditorialAttemptDiagnostic[] = [];

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      attemptsCount = attempt;
      const attemptStartTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 3000);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        };

        if (this.providerName === 'openrouter') {
          headers['HTTP-Referer'] = 'https://rancangloka.com';
          headers['X-Title'] = 'RancangLoka Editorial Desk (Joko)';
        }

        const response = await this.fetchFn(this.endpoint, {
          method: 'POST',
          headers,
          body: requestBodyString,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const attemptElapsedMs = Date.now() - attemptStartTime;
        const httpStatus = response.status;
        lastHttpStatus = httpStatus;

        let rawText = '';
        try {
          rawText = await response.text();
        } catch {
          rawText = response.statusText;
        }

        const responseBodyBytes = Buffer.byteLength(rawText, 'utf8');
        lastResponseBodyBytes = responseBodyBytes;

        // 3. Handle Non-200 HTTP responses
        if (!response.ok) {
          let errorCat: EditorialLlmErrorCategory = 'PROVIDER_HTTP_ERROR';
          let canonCat: CanonicalProviderErrorCategory = 'PROVIDER_HTTP_ERROR';

          const isContextLimit = /\b(?:context_length_exceeded|maximum context length|too many tokens|prompt is too long|context window|exceeds.*token limit)\b/i.test(rawText);

          if (httpStatus === 401 || httpStatus === 403) {
            errorCat = 'PROVIDER_AUTH_ERROR';
            canonCat = 'PROVIDER_AUTH_ERROR';
          } else if (httpStatus === 429) {
            errorCat = 'PROVIDER_RATE_LIMIT';
            canonCat = 'PROVIDER_RATE_LIMIT';
          } else if (isContextLimit) {
            errorCat = 'PROVIDER_CONTEXT_LIMIT';
            canonCat = 'PROVIDER_CONTEXT_LIMIT';
          }

          let responseBodySnippet = rawText.slice(0, 300);
          if (this.apiKey && responseBodySnippet.includes(this.apiKey)) {
            responseBodySnippet = responseBodySnippet.replaceAll(this.apiKey, '[REDACTED_API_KEY]');
          }

          lastError = `HTTP ${httpStatus}: ${responseBodySnippet}`;
          if (this.apiKey && lastError.includes(this.apiKey)) {
            lastError = lastError.replaceAll(this.apiKey, '[REDACTED_API_KEY]');
          }
          lastErrorCategory = errorCat;
          lastCanonicalCategory = canonCat;

          const retryable = isRetryableProviderError(errorCat, httpStatus);
          attemptsDiagnostics.push({
            attempt,
            timestamp: new Date().toISOString(),
            elapsedMs: attemptElapsedMs,
            httpStatus,
            responseBodyBytes,
            errorCategory: errorCat,
            error: lastError,
            rawSnippet: responseBodySnippet,
            retryReason: retryable && attempt <= this.maxRetries ? 'Transient HTTP response' : undefined
          });

          if (!retryable) {
            break;
          }

          if (attempt <= this.maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs));
          }
          continue;
        }

        // 4. Parse Response JSON
        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch (jsonErr: any) {
          lastError = `Failed to parse LLM response JSON: ${jsonErr.message}`;
          lastErrorCategory = 'PROVIDER_INVALID_JSON';
          lastCanonicalCategory = 'PROVIDER_INVALID_JSON';

          attemptsDiagnostics.push({
            attempt,
            timestamp: new Date().toISOString(),
            elapsedMs: attemptElapsedMs,
            httpStatus,
            responseBodyBytes,
            errorCategory: 'PROVIDER_INVALID_JSON',
            error: lastError,
            rawSnippet: rawText.slice(0, 200),
            retryReason: attempt <= this.maxRetries ? 'Invalid JSON response from endpoint' : undefined
          });

          if (attempt <= this.maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs));
          }
          continue;
        }

        // 5. Validate response structure
        if (!data || typeof data !== 'object') {
          lastError = 'Provider returned non-object response';
          lastErrorCategory = 'PROVIDER_MISSING_CONTENT';
          lastCanonicalCategory = 'PROVIDER_MISSING_CONTENT';

          attemptsDiagnostics.push({
            attempt,
            timestamp: new Date().toISOString(),
            elapsedMs: attemptElapsedMs,
            httpStatus,
            responseBodyBytes,
            errorCategory: 'PROVIDER_MISSING_CONTENT',
            error: lastError,
            retryReason: attempt <= this.maxRetries ? 'Missing data object' : undefined
          });

          if (attempt <= this.maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs));
          }
          continue;
        }

        if (!Array.isArray(data.choices) || data.choices.length === 0) {
          lastError = 'Provider response missing choices array';
          lastErrorCategory = 'PROVIDER_MISSING_CONTENT';
          lastCanonicalCategory = 'PROVIDER_MISSING_CONTENT';

          attemptsDiagnostics.push({
            attempt,
            timestamp: new Date().toISOString(),
            elapsedMs: attemptElapsedMs,
            httpStatus,
            responseBodyBytes,
            errorCategory: 'PROVIDER_MISSING_CONTENT',
            error: lastError,
            retryReason: attempt <= this.maxRetries ? 'Missing choices array' : undefined
          });

          if (attempt <= this.maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs));
          }
          continue;
        }

        const firstChoice = data.choices[0];
        const finishReason = firstChoice?.finish_reason;
        const msg = firstChoice?.message;
        const content = msg?.content;
        const reasoningContent = msg?.reasoning_content || msg?.reasoning;
        const reasoningLen = typeof reasoningContent === 'string' ? reasoningContent.length : undefined;

        if (content === null || content === undefined || typeof content !== 'string') {
          lastError = 'First choice message content is missing or not a string';
          lastErrorCategory = 'PROVIDER_MISSING_CONTENT';
          lastCanonicalCategory = 'PROVIDER_MISSING_CONTENT';

          attemptsDiagnostics.push({
            attempt,
            timestamp: new Date().toISOString(),
            elapsedMs: attemptElapsedMs,
            httpStatus,
            responseBodyBytes,
            errorCategory: 'PROVIDER_MISSING_CONTENT',
            error: lastError,
            finishReason,
            reasoningContentLength: reasoningLen,
            retryReason: attempt <= this.maxRetries ? 'Missing message content' : undefined
          });

          if (attempt <= this.maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs));
          }
          continue;
        }

        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
          lastError = 'Provider returned an empty response string';
          lastErrorCategory = 'PROVIDER_EMPTY_RESPONSE';
          lastCanonicalCategory = 'PROVIDER_EMPTY_RESPONSE';

          attemptsDiagnostics.push({
            attempt,
            timestamp: new Date().toISOString(),
            elapsedMs: attemptElapsedMs,
            httpStatus,
            responseBodyBytes,
            errorCategory: 'PROVIDER_EMPTY_RESPONSE',
            error: lastError,
            finishReason,
            reasoningContentLength: reasoningLen,
            retryReason: attempt <= this.maxRetries ? 'Empty response content' : undefined
          });

          if (attempt <= this.maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs));
          }
          continue;
        }

        // 6. Extract usage tokens if available
        let usage: EditorialGenerationUsage | undefined;
        if (data.usage && typeof data.usage === 'object') {
          usage = {
            promptTokens: typeof data.usage.prompt_tokens === 'number' ? data.usage.prompt_tokens : 0,
            completionTokens: typeof data.usage.completion_tokens === 'number' ? data.usage.completion_tokens : 0,
            totalTokens: typeof data.usage.total_tokens === 'number' ? data.usage.total_tokens : 0
          };
        }

        attemptsDiagnostics.push({
          attempt,
          timestamp: new Date().toISOString(),
          elapsedMs: attemptElapsedMs,
          httpStatus,
          responseBodyBytes,
          finishReason,
          reasoningContentLength: reasoningLen
        });

        return {
          success: true,
          content: trimmedContent,
          provider: this.providerName,
          model: data.model || effectiveModel,
          latencyMs: Date.now() - startTime,
          usage,
          attempts: attemptsCount,
          requestId: data.id || undefined,
          finishReason,
          httpStatus,
          rawResponseBodyBytes: responseBodyBytes,
          promptTelemetry,
          attemptsDiagnostics
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        const attemptElapsedMs = Date.now() - attemptStartTime;

        if (err.name === 'AbortError') {
          lastError = `Request timed out after ${this.timeoutMs}ms`;
          lastErrorCategory = 'PROVIDER_TIMEOUT';
          lastCanonicalCategory = 'PROVIDER_TIMEOUT';
        } else {
          lastError = `Network error: ${err.message || String(err)}`;
          lastErrorCategory = 'PROVIDER_TRANSPORT_ERROR';
          lastCanonicalCategory = 'PROVIDER_TRANSPORT_ERROR';
        }

        attemptsDiagnostics.push({
          attempt,
          timestamp: new Date().toISOString(),
          elapsedMs: attemptElapsedMs,
          errorCategory: lastErrorCategory,
          error: lastError,
          retryReason: attempt <= this.maxRetries ? 'Transient transport error' : undefined
        });

        if (attempt <= this.maxRetries) {
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }

    return {
      success: false,
      content: null,
      provider: this.providerName,
      model: effectiveModel,
      latencyMs: Date.now() - startTime,
      error: lastError,
      errorCategory: lastErrorCategory,
      canonicalCategory: lastCanonicalCategory,
      httpStatus: lastHttpStatus,
      rawResponseBodyBytes: lastResponseBodyBytes,
      attempts: attemptsCount,
      promptTelemetry,
      attemptsDiagnostics
    };
  }
}
