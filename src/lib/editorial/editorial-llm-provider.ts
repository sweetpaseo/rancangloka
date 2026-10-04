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

export type EditorialLlmErrorCategory =
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

export interface EditorialGenerationResult {
  success: boolean;
  content: string | null;
  provider: EditorialLlmProviderName;
  model: string;
  latencyMs: number;
  usage?: EditorialGenerationUsage;
  error?: string;
  errorCategory?: EditorialLlmErrorCategory;
  attempts: number;
  requestId?: string;
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
export const DEFAULT_EDITORIAL_TIMEOUT_MS = 60000; // 60 seconds
export const DEFAULT_EDITORIAL_MAX_TOKENS = 4000;
export const DEFAULT_EDITORIAL_TEMPERATURE = 0.6;
export const DEFAULT_EDITORIAL_MODEL = 'google/gemini-2.0-flash-001';

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
    this.maxRetries = options.maxRetries ?? (env.EDITORIAL_LLM_MAX_RETRIES ? Number(env.EDITORIAL_LLM_MAX_RETRIES) : 1);

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
   * Enforces fail-closed semantics on missing credentials and malformed responses.
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
        errorCategory: 'MALFORMED',
        attempts: 0
      };
    }

    const payload: Record<string, any> = {
      model: effectiveModel,
      messages: request.messages,
      max_tokens: request.maxTokens ?? this.maxTokens
    };

    // Temperature inclusion (omit if model does not support it or null)
    const effectiveTemp = request.temperature ?? this.temperature;
    if (effectiveTemp !== null && effectiveTemp !== undefined) {
      payload.temperature = effectiveTemp;
    }

    let lastError: string = '';
    let lastErrorCategory: EditorialLlmErrorCategory = 'SERVER_ERROR';
    let attemptsCount = 0;

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      attemptsCount = attempt;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

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
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startTime;

        // Handle Non-200 HTTP responses
        if (!response.ok) {
          let errorCat: EditorialLlmErrorCategory = 'SERVER_ERROR';
          if (response.status === 401 || response.status === 403) {
            errorCat = 'AUTH';
          } else if (response.status === 429) {
            errorCat = 'RATE_LIMIT';
          } else if (response.status >= 400 && response.status < 500) {
            errorCat = 'MALFORMED';
          }

          let responseBodyText = '';
          try {
            const rawErr = await response.text();
            responseBodyText = rawErr.slice(0, 300);
          } catch {
            responseBodyText = response.statusText;
          }

          // Redact any appearance of apiKey or auth headers
          if (this.apiKey && responseBodyText.includes(this.apiKey)) {
            responseBodyText = responseBodyText.replaceAll(this.apiKey, '[REDACTED_API_KEY]');
          }

          lastError = `HTTP ${response.status}: ${responseBodyText}`;
          if (this.apiKey && lastError.includes(this.apiKey)) {
            lastError = lastError.replaceAll(this.apiKey, '[REDACTED_API_KEY]');
          }
          lastErrorCategory = errorCat;

          // Non-retryable errors break immediately
          if (errorCat === 'AUTH' || errorCat === 'MALFORMED') {
            break;
          }

          // Retryable errors continue if attempts remain
          continue;
        }

        // Parse Response JSON
        let data: any;
        try {
          data = await response.json();
        } catch (jsonErr: any) {
          lastError = `Failed to parse LLM response JSON: ${jsonErr.message}`;
          lastErrorCategory = 'MALFORMED';
          continue;
        }

        // Validate response structure
        if (!data || typeof data !== 'object') {
          lastError = 'Provider returned non-object response';
          lastErrorCategory = 'MALFORMED';
          continue;
        }

        if (!Array.isArray(data.choices) || data.choices.length === 0) {
          lastError = 'Provider response missing choices array';
          lastErrorCategory = 'MALFORMED';
          continue;
        }

        const firstChoice = data.choices[0];
        const content = firstChoice?.message?.content;

        if (typeof content !== 'string') {
          lastError = 'First choice message content is not a string';
          lastErrorCategory = 'MALFORMED';
          continue;
        }

        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
          lastError = 'Provider returned an empty response string';
          lastErrorCategory = 'EMPTY_RESPONSE';
          continue;
        }

        // Extract usage tokens if available
        let usage: EditorialGenerationUsage | undefined;
        if (data.usage && typeof data.usage === 'object') {
          usage = {
            promptTokens: typeof data.usage.prompt_tokens === 'number' ? data.usage.prompt_tokens : 0,
            completionTokens: typeof data.usage.completion_tokens === 'number' ? data.usage.completion_tokens : 0,
            totalTokens: typeof data.usage.total_tokens === 'number' ? data.usage.total_tokens : 0
          };
        }

        return {
          success: true,
          content: trimmedContent,
          provider: this.providerName,
          model: data.model || effectiveModel,
          latencyMs,
          usage,
          attempts: attemptsCount,
          requestId: data.id || undefined
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startTime;

        if (err.name === 'AbortError') {
          lastError = `Request timed out after ${this.timeoutMs}ms`;
          lastErrorCategory = 'TIMEOUT';
        } else {
          lastError = `Network error: ${err.message || String(err)}`;
          lastErrorCategory = 'NETWORK';
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
      attempts: attemptsCount
    };
  }
}
