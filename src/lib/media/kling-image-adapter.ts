/**
 * RancangLoka — Kling AI Image Provider Adapter (KLING-V1)
 *
 * Implements ImageProviderAdapter for Kling AI (Singapore Node).
 * Supports:
 * - Model A: 'kling-v3' (POST /v1/images/generations)
 * - Model B: 'kling-v3-omni' (POST /v1/images/omni-image)
 *
 * CANONICAL SAFETY & ARCHITECTURAL INVARIANTS:
 * 1. Zero Secret Leaks: KLING_API_KEY is never logged, printed, or exposed.
 * 2. Asynchronous Polling: Submits task and polls until completion.
 * 3. Task Idempotency: Retries during polling NEVER re-submit a new generation task.
 *    The task_id and external_task_id are preserved to prevent duplicate billing.
 * 4. Controlled Timeout: Respects AbortSignal and per-request timeout bounds.
 * 5. Strict Binary Validation: Validates magic bytes, dimensions, and computes SHA-256.
 * 6. Experimental Status: Kling is active as EXPERIMENTAL_PROVIDER; Seedream Pro remains DEFAULT.
 */

import {
  type ImageProviderAdapter,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageCostMetadata,
  ImageProviderError
} from './image-provider-types.ts';
import {
  validateImageBinary,
  computeBinarySha256
} from './image-validation.ts';

export const KLING_API_BASE = 'https://api-singapore.klingai.com';
export const KLING_MODEL_V3 = 'kling-v3';
export const KLING_MODEL_V3_OMNI = 'kling-v3-omni';
export const DEFAULT_KLING_MODEL = KLING_MODEL_V3;
export const KLING_SUPPORTED_MODELS = [KLING_MODEL_V3, KLING_MODEL_V3_OMNI] as const;

export const DEFAULT_KLING_TIMEOUT_MS = 180000; // 3 minutes
export const DEFAULT_KLING_POLL_INTERVAL_MS = 3000; // 3 seconds

// Official Kling AI Credit Units & Pricing Rates
// Kling Image 3.0 & 3.0 Omni consumption is unit-based:
// 2K Resolution: 8 units ($0.0280 list price at $0.0035/unit)
// 4K Resolution: 16 units ($0.0560 list price at $0.0035/unit)
// Trial Package: $2.45 for 1,000 units = $0.00245 / unit effective prepaid rate
export const KLING_UNITS_PER_IMAGE_2K = 8;
export const KLING_UNITS_PER_IMAGE_4K = 16;
export const KLING_LIST_PRICE_PER_UNIT_USD = 0.0035; // $0.028 / 8 units
export const KLING_TRIAL_PREPAID_RATE_PER_UNIT_USD = 0.00245; // $2.45 / 1000 units

// List prices per image
export const KLING_V3_2K_LIST_PRICE_USD = 0.0280; // 8 units
export const KLING_V3_4K_LIST_PRICE_USD = 0.0560; // 16 units
export const KLING_V3_OMNI_2K_LIST_PRICE_USD = 0.0280; // 8 units
export const KLING_V3_OMNI_4K_LIST_PRICE_USD = 0.0560; // 16 units

// Effective prepaid costs per image (Trial Package: $0.00245/unit)
export const KLING_2K_EFFECTIVE_PREPAID_USD = 0.0196; // 8 units * $0.00245
export const KLING_4K_EFFECTIVE_PREPAID_USD = 0.0392; // 16 units * $0.00245

// Legacy compatibility aliases
export const KLING_V3_UNIT_COST_USD = KLING_V3_2K_LIST_PRICE_USD;
export const KLING_V3_OMNI_UNIT_COST_USD = KLING_V3_OMNI_2K_LIST_PRICE_USD;

export type KlingResolution = '1k' | '2k' | '4k';
export type KlingAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';

export interface KlingTaskInfo {
  task_id: string;
  task_status: 'submitted' | 'processing' | 'succeed' | 'failed' | string;
  task_status_msg?: string;
  task_info?: {
    external_task_id?: string;
  };
  created_at?: number;
  updated_at?: number;
  task_result?: {
    result_type?: 'single' | 'series' | string;
    images?: Array<{
      index: number;
      url: string;
      watermark_url?: string;
    }>;
    series_images?: Array<{
      index: number;
      url: string;
      watermark_url?: string;
    }>;
  };
}

export interface KlingApiResponse<T = any> {
  code: number;
  message: string;
  request_id: string;
  data: T;
}

export interface KlingBatchImageItem {
  index: number;
  url: string;
  bytes: Uint8Array;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  sha256: string;
}

export interface KlingSeriesImageItem extends KlingBatchImageItem {
  frame_index: number;
  shot_role?: string;
}

export interface KlingCostMetadata extends ImageCostMetadata {
  actual_units_consumed: number;
  estimated_spend_usd: number; // Official list price in USD
  effective_prepaid_cost_usd: number; // Trial package rate ($0.00245/unit)
  list_price_usd: number;
  units_per_image: number;
  resolution: KlingResolution;
  result_type?: 'single' | 'series';
  series_amount?: number;
}

export interface KlingGenerationResult extends ImageGenerationResult {
  external_task_id: string;
  task_id: string;
  resolution: KlingResolution;
  aspect_ratio: KlingAspectRatio;
  batch_count: number;
  result_type?: 'single' | 'series';
  series_amount?: number;
  batch_images?: KlingBatchImageItem[];
  series_images?: KlingSeriesImageItem[];
  cost_metadata?: KlingCostMetadata;
}

export interface KlingAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  fetchFn?: typeof fetch;
}

export class KlingImageProviderAdapter implements ImageProviderAdapter {
  readonly providerName = 'kling';
  readonly model: string;
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: KlingAdapterOptions = {}) {
    this.model = options.model || DEFAULT_KLING_MODEL;
    this.baseUrl = (options.baseUrl || KLING_API_BASE).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_KLING_TIMEOUT_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_KLING_POLL_INTERVAL_MS;
    this.apiKey = options.apiKey !== undefined
      ? options.apiKey
      : (typeof process !== 'undefined' ? process.env?.KLING_API_KEY || '' : '');

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
   * Resolves Kling aspect ratio from request.
   * RancangLoka architectural landscape visuals standard is 16:9.
   */
  resolveAspectRatio(request: ImageGenerationRequest): KlingAspectRatio {
    const raw = (request.aspect_ratio || '').toLowerCase().trim();
    if (raw === '16:9' || raw === '1312:672' || raw === '1315:660' || raw === 'landscape' || raw === '2:1') {
      return '16:9';
    }
    if (raw === '1:1' || raw === 'square') {
      return '1:1';
    }
    if (raw === '9:16' || raw === 'portrait') {
      return '9:16';
    }
    if (raw === '4:3') return '4:3';
    if (raw === '3:4') return '3:4';
    if (raw === '3:2') return '3:2';
    if (raw === '2:3') return '2:3';
    if (raw === '21:9' || raw === 'cinematic') return '21:9';

    // Default for RancangLoka architectural photos is 16:9
    return '16:9';
  }

  /**
   * Resolves resolution (1k, 2k, or 4k). Defaults to 2k for architectural fidelity.
   * 2K: 8 units ($0.028 list price, $0.0196 effective trial rate)
   * 4K: 16 units ($0.056 list price, $0.0392 effective trial rate)
   */
  resolveResolution(request: ImageGenerationRequest): KlingResolution {
    const rawRes = ((request as any).resolution || '').toLowerCase().trim();
    if (rawRes === '4k' || (request.width && request.width >= 3840)) {
      return '4k';
    }
    if (rawRes === '1k' || (request.quality === 'standard' && (request.width && request.width <= 1024))) {
      return '1k';
    }
    return '2k';
  }

  /**
   * Resolves batch count n (1..9).
   */
  resolveBatchCount(request: ImageGenerationRequest): number {
    const n = Number((request as any).n ?? (request as any).batch_size ?? 1);
    if (isNaN(n) || n < 1) return 1;
    if (n > 9) return 9;
    return Math.floor(n);
  }

  /**
   * Resolves endpoint path for submission and polling based on model.
   */
  private getEndpoints(model: string): { submitPath: string; statusPath: (id: string) => string } {
    if (model === KLING_MODEL_V3_OMNI) {
      return {
        submitPath: '/v1/images/omni-image',
        statusPath: (id: string) => `/v1/images/omni-image/${encodeURIComponent(id)}`
      };
    }
    return {
      submitPath: '/v1/images/generations',
      statusPath: (id: string) => `/v1/images/generations/${encodeURIComponent(id)}`
    };
  }

  /**
   * Securely redacts secrets from any error message or details.
   */
  /**
   * Securely redacts secrets from any error message or details.
   */
  private sanitizeMessage(msg: string): string {
    if (!this.apiKey) return msg;
    return msg.replaceAll(this.apiKey, '[REDACTED_KLING_API_KEY]');
  }

  /**
   * Constructs the verified submission payload and endpoint for testing/inspection
   * with credentials safely masked.
   */
  buildSubmissionPayload(request: ImageGenerationRequest): {
    url: string;
    endpoint: string;
    model: string;
    payload: Record<string, any>;
    maskedHeaders: Record<string, string>;
  } {
    const selectedModel = request.model_override || this.model;
    const { submitPath } = this.getEndpoints(selectedModel);
    const resolution = this.resolveResolution(request);
    const aspectRatio = this.resolveAspectRatio(request);
    const n = this.resolveBatchCount(request);
    const externalTaskId = request.request_id || `req_kling_${Date.now()}`;

    const isSeries =
      request.result_type === 'series' ||
      Boolean((request as any).series_mode === true) ||
      Boolean(typeof (request as any).series_amount === 'number' && (request as any).series_amount > 1);

    const payload: Record<string, any> = {
      model_name: selectedModel,
      prompt: request.prompt,
      resolution,
      aspect_ratio: aspectRatio,
      external_task_id: externalTaskId
    };

    if (isSeries && submitPath === '/v1/images/omni-image') {
      const rawSeriesAmount = Number((request as any).series_amount ?? 3);
      if (isNaN(rawSeriesAmount) || rawSeriesAmount < 2 || rawSeriesAmount > 9) {
        throw new ImageProviderError({
          code: 'INVALID_RESPONSE',
          provider: this.providerName,
          message: `Kling Omni series_amount must be an integer between 2 and 9 (received: ${rawSeriesAmount})`,
          isBillable: false
        });
      }
      payload.result_type = 'series';
      payload.series_amount = Math.floor(rawSeriesAmount);
    } else {
      payload.result_type = 'single';
      payload.n = n;
    }

    if (request.negative_prompt) {
      payload.negative_prompt = request.negative_prompt;
    }

    // Reference Image Conditioning (PHOTO-FIRST v1.1)
    const refRaw = request.reference_image_url || (request as any).reference_image_base64 || (request as any).reference_image;
    if (refRaw && typeof refRaw === 'string' && refRaw.trim().length > 0) {
      const cleanRef = refRaw.trim().replace(/^data:image\/[a-zA-Z]+;base64,/, '');

      if (submitPath === '/v1/images/omni-image') {
        // Kling Omni uses image_list array; does NOT accept image_fidelity
        payload.image_list = [
          { image: cleanRef }
        ];
        if (!payload.prompt.includes('<<<image_1>>>') && !payload.prompt.includes('<<<object_1>>>')) {
          payload.prompt = `In the exact same architectural room and cabinetry setting as <<<image_1>>>, ${payload.prompt}`;
        }
      } else {
        // Standard endpoint uses singular image string
        payload.image = cleanRef;
        if (typeof request.reference_weight === 'number') {
          payload.image_fidelity = request.reference_weight;
        }
      }
    }

    const url = `${this.baseUrl}${submitPath}`;
    const maskedHeaders = {
      'Content-Type': 'application/json',
      'Authorization': this.apiKey ? 'Bearer [REDACTED_KLING_API_KEY]' : 'Bearer [NOT_SET]'
    };

    return {
      url,
      endpoint: submitPath,
      model: selectedModel,
      payload,
      maskedHeaders
    };
  }

  /**
   * Submits generation task to Kling AI API (POST).
   * Does NOT poll. Returns task_id immediately.
   */
  async submitTask(
    request: ImageGenerationRequest,
    options?: { signal?: AbortSignal }
  ): Promise<{ taskId: string; externalTaskId: string; model: string }> {
    if (!this.apiKey) {
      throw new ImageProviderError({
        code: 'AUTH_ERROR',
        provider: this.providerName,
        message: 'Kling API credentials missing: KLING_API_KEY environment variable is not configured.',
        isBillable: false
      });
    }

    const { url, payload, model } = this.buildSubmissionPayload(request);
    const externalTaskId = payload.external_task_id;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: options?.signal
      });
    } catch (netErr: any) {
      if (options?.signal?.aborted) {
        throw new ImageProviderError({
          code: 'TIMEOUT',
          provider: this.providerName,
          message: `Kling task submission timed out: ${this.sanitizeMessage(netErr?.message || 'aborted')}`,
          isBillable: false
        });
      }
      throw new ImageProviderError({
        code: 'UNKNOWN_PROVIDER_ERROR',
        provider: this.providerName,
        message: `Kling network submission failure: ${this.sanitizeMessage(netErr?.message || String(netErr))}`,
        isBillable: false
      });
    }

    let json: KlingApiResponse<KlingTaskInfo>;
    try {
      json = await response.json();
    } catch (parseErr: any) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Failed to parse Kling API response as JSON: ${this.sanitizeMessage(parseErr?.message)}`,
        httpStatus: response.status,
        isBillable: false
      });
    }

    if (!response.ok || json.code !== 0) {
      const code = json.code;
      const msg = this.sanitizeMessage(json.message || `HTTP ${response.status}`);

      if (response.status === 401 || response.status === 403 || code === 1000) {
        throw new ImageProviderError({
          code: 'AUTH_ERROR',
          provider: this.providerName,
          message: `Kling authentication failure: ${msg}`,
          httpStatus: response.status,
          isBillable: false
        });
      }
      if (response.status === 429 || code === 1004) {
        throw new ImageProviderError({
          code: 'RATE_LIMIT',
          provider: this.providerName,
          message: `Kling rate limit exceeded: ${msg}`,
          httpStatus: response.status,
          isBillable: false
        });
      }
      if (code === 1002 || msg.toLowerCase().includes('sensitive') || msg.toLowerCase().includes('policy')) {
        throw new ImageProviderError({
          code: 'CONTENT_POLICY_BLOCK',
          provider: this.providerName,
          message: `Kling prompt policy violation: ${msg}`,
          httpStatus: response.status,
          isBillable: false
        });
      }
      if (response.status >= 500) {
        throw new ImageProviderError({
          code: 'PROVIDER_5XX',
          provider: this.providerName,
          message: `Kling server error (HTTP ${response.status}): ${msg}`,
          httpStatus: response.status,
          isBillable: false
        });
      }

      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Kling submission rejected (code ${code}): ${msg}`,
        httpStatus: response.status,
        isBillable: false,
        details: { code, requestId: json.request_id }
      });
    }

    const taskId = json.data?.task_id;
    if (!taskId) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: 'Kling API response did not contain expected data.task_id.',
        httpStatus: response.status,
        isBillable: false,
        details: json
      });
    }

    return {
      taskId,
      externalTaskId,
      model
    };
  }

  /**
   * Queries status of an existing task once (GET).
   */
  async queryTask(
    taskId: string,
    model: string = this.model,
    options?: { signal?: AbortSignal }
  ): Promise<KlingTaskInfo> {
    if (!this.apiKey) {
      throw new ImageProviderError({
        code: 'AUTH_ERROR',
        provider: this.providerName,
        message: 'KLING_API_KEY is not configured.',
        isBillable: false
      });
    }

    const { statusPath } = this.getEndpoints(model);
    const url = `${this.baseUrl}${statusPath(taskId)}`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: options?.signal
      });
    } catch (netErr: any) {
      if (options?.signal?.aborted) {
        throw new ImageProviderError({
          code: 'TIMEOUT',
          provider: this.providerName,
          message: `Kling task query timed out for task_id: ${taskId}`,
          isBillable: false,
          details: { taskId }
        });
      }
      throw new ImageProviderError({
        code: 'UNKNOWN_PROVIDER_ERROR',
        provider: this.providerName,
        message: `Network error querying Kling task: ${this.sanitizeMessage(netErr?.message)}`,
        isBillable: false,
        details: { taskId }
      });
    }

    let json: KlingApiResponse<KlingTaskInfo>;
    try {
      json = await response.json();
    } catch (parseErr: any) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Failed to parse Kling task status JSON: ${this.sanitizeMessage(parseErr?.message)}`,
        httpStatus: response.status,
        isBillable: false,
        details: { taskId }
      });
    }

    if (!response.ok || json.code !== 0) {
      throw new ImageProviderError({
        code: response.status === 401 ? 'AUTH_ERROR' : 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Kling query failed for task ${taskId}: ${this.sanitizeMessage(json.message)}`,
        httpStatus: response.status,
        isBillable: false,
        details: { taskId, code: json.code }
      });
    }

    return json.data;
  }

  /**
   * Polls task status until 'succeed' or 'failed'.
   * Invariant: Never re-submits generation on polling error.
   */
  async pollTask(
    taskId: string,
    model: string = this.model,
    timeoutMs: number = this.timeoutMs,
    options?: { signal?: AbortSignal }
  ): Promise<KlingTaskInfo> {
    const startTime = Date.now();
    let consecutiveNetworkErrors = 0;
    const maxNetworkRetries = 5;

    while (Date.now() - startTime < timeoutMs) {
      if (options?.signal?.aborted) {
        throw new ImageProviderError({
          code: 'TIMEOUT',
          provider: this.providerName,
          message: `Kling polling aborted/timed out for task ${taskId}`,
          isBillable: false,
          details: { taskId, elapsedMs: Date.now() - startTime }
        });
      }

      let data: KlingTaskInfo;
      try {
        data = await this.queryTask(taskId, model, options);
        consecutiveNetworkErrors = 0; // reset on successful query
      } catch (err: any) {
        if (err instanceof ImageProviderError && err.code === 'TIMEOUT') {
          throw err;
        }
        consecutiveNetworkErrors++;
        if (consecutiveNetworkErrors >= maxNetworkRetries) {
          throw new ImageProviderError({
            code: 'TIMEOUT',
            provider: this.providerName,
            message: `Polling failed after ${consecutiveNetworkErrors} consecutive network errors for task ${taskId}. Task preserved without re-generation.`,
            isBillable: false,
            details: { taskId, lastError: err?.message }
          });
        }
        // Sleep and retry polling query without re-submitting task
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        continue;
      }

      const status = data?.task_status;
      if (status === 'succeed') {
        return data;
      }

      if (status === 'failed') {
        const failMsg = this.sanitizeMessage(data.task_status_msg || 'Task failed on Kling server');
        const isPolicy = failMsg.toLowerCase().includes('sensitive') || failMsg.toLowerCase().includes('policy');
        throw new ImageProviderError({
          code: isPolicy ? 'CONTENT_POLICY_BLOCK' : 'INVALID_RESPONSE',
          provider: this.providerName,
          message: `Kling generation task failed: ${failMsg}`,
          isBillable: false,
          details: { taskId, taskStatus: status, taskStatusMsg: failMsg }
        });
      }

      // Status is 'submitted' or 'processing': wait and poll again
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    throw new ImageProviderError({
      code: 'TIMEOUT',
      provider: this.providerName,
      message: `Kling task polling exceeded timeout (${timeoutMs}ms) for task ${taskId}. Task is preserved.`,
      isBillable: false,
      details: { taskId, timeoutMs }
    });
  }

  /**
   * Downloads an image from Kling CDN URL and validates its binary structure.
   */
  async downloadImageBytes(imageUrl: string, options?: { signal?: AbortSignal }): Promise<{
    bytes: Uint8Array;
    mimeType: string;
    width: number;
    height: number;
    byteSize: number;
    sha256: string;
  }> {
    let dlResponse: Response;
    try {
      dlResponse = await this.fetchFn(imageUrl, {
        method: 'GET',
        signal: options?.signal
      });
    } catch (dlErr: any) {
      throw new ImageProviderError({
        code: 'DOWNLOAD_FAILURE',
        provider: this.providerName,
        message: `Failed to connect to Kling image CDN: ${this.sanitizeMessage(dlErr?.message)}`,
        isBillable: true,
        details: { imageUrl }
      });
    }

    if (!dlResponse.ok) {
      throw new ImageProviderError({
        code: 'DOWNLOAD_FAILURE',
        provider: this.providerName,
        message: `Failed to download Kling image: HTTP ${dlResponse.status} ${dlResponse.statusText}`,
        httpStatus: dlResponse.status,
        isBillable: true,
        details: { imageUrl }
      });
    }

    const arrayBuf = await dlResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);

    // Validate binary format, magic bytes, dimensions, and compute SHA-256
    const validationMeta = await validateImageBinary(bytes, this.providerName);
    const sha256 = await computeBinarySha256(bytes);

    return {
      bytes,
      mimeType: validationMeta.mimeType,
      width: validationMeta.width,
      height: validationMeta.height,
      byteSize: bytes.byteLength,
      sha256
    };
  }

  /**
   * Downloads all images produced in a batch task.
   */
  async downloadBatchImages(
    taskInfo: KlingTaskInfo,
    options?: { signal?: AbortSignal }
  ): Promise<KlingBatchImageItem[]> {
    const rawImages = taskInfo.task_result?.images || [];
    const results: KlingBatchImageItem[] = [];

    for (const img of rawImages) {
      if (!img.url) continue;
      const materialized = await this.downloadImageBytes(img.url, options);
      results.push({
        index: img.index,
        url: img.url,
        bytes: materialized.bytes,
        mime_type: materialized.mimeType,
        width: materialized.width,
        height: materialized.height,
        byte_size: materialized.byteSize,
        sha256: materialized.sha256
      });
    }

    return results;
  }

  /**
   * Downloads all images produced in a series task with frame order and shot roles.
   */
  async downloadSeriesImages(
    taskInfo: KlingTaskInfo,
    options?: { signal?: AbortSignal }
  ): Promise<KlingSeriesImageItem[]> {
    const rawImages = (taskInfo.task_result?.series_images && taskInfo.task_result.series_images.length > 0)
      ? taskInfo.task_result.series_images
      : (taskInfo.task_result?.images || []);

    const results: KlingSeriesImageItem[] = [];
    const defaultShotRoles = ['cooking_perspective', 'appliance_detail', 'ventilation_solution'];

    for (let i = 0; i < rawImages.length; i++) {
      const img = rawImages[i];
      if (!img.url) continue;
      const materialized = await this.downloadImageBytes(img.url, options);
      const frameIndex = typeof img.index === 'number' ? img.index : i;
      results.push({
        index: frameIndex,
        frame_index: frameIndex,
        url: img.url,
        bytes: materialized.bytes,
        mime_type: materialized.mimeType,
        width: materialized.width,
        height: materialized.height,
        byte_size: materialized.byteSize,
        sha256: materialized.sha256,
        shot_role: defaultShotRoles[i] || `shot_${i + 1}`
      });
    }

    return results;
  }

  /**
   * Full end-to-end execution implementing ImageProviderAdapter.
   * 1. Submits task via POST.
   * 2. Polls until completion (idempotent, never re-submitting).
   * 3. Downloads generated image(s) from CDN (single, batch, or series).
   * 4. Validates binary headers, dimensions, and SHA-256.
   * 5. Returns canonical ImageGenerationResult.
   */
  async generate(request: ImageGenerationRequest): Promise<KlingGenerationResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    const timeoutDuration = request.timeout_ms || this.timeoutMs;
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error(`Kling generate timed out after ${timeoutDuration}ms`));
    }, timeoutDuration);

    const selectedModel = request.model_override || this.model;
    const resolution = this.resolveResolution(request);
    const aspectRatio = this.resolveAspectRatio(request);

    try {
      // 1. Submit task (POST)
      const submission = await this.submitTask(request, { signal: abortController.signal });

      // 2. Poll task status (GET)
      const taskInfo = await this.pollTask(
        submission.taskId,
        submission.model,
        timeoutDuration - (Date.now() - startTime),
        { signal: abortController.signal }
      );

      // Support both series_images and images arrays
      const isSeriesTask =
        taskInfo.task_result?.result_type === 'series' ||
        Boolean(taskInfo.task_result?.series_images && taskInfo.task_result.series_images.length > 0) ||
        request.result_type === 'series';

      const rawImages = (taskInfo.task_result?.series_images && taskInfo.task_result.series_images.length > 0)
        ? taskInfo.task_result.series_images
        : taskInfo.task_result?.images;

      if (!Array.isArray(rawImages) || rawImages.length === 0 || !rawImages[0]?.url) {
        throw new ImageProviderError({
          code: 'INVALID_RESPONSE',
          provider: this.providerName,
          message: 'Kling succeeded but task_result (series_images / images) is empty or missing valid URLs',
          isBillable: false,
          details: { taskId: submission.taskId, taskInfo }
        });
      }

      // 3. Download primary image (and all series/batch items if multiple requested)
      const primaryUrl = rawImages[0].url;
      const primaryDownload = await this.downloadImageBytes(primaryUrl, { signal: abortController.signal });

      let batchImages: KlingBatchImageItem[] | undefined;
      let seriesImages: KlingSeriesImageItem[] | undefined;

      if (isSeriesTask) {
        seriesImages = await this.downloadSeriesImages(taskInfo, { signal: abortController.signal });
        batchImages = seriesImages;
      } else if (rawImages.length > 1) {
        batchImages = await this.downloadBatchImages(taskInfo, { signal: abortController.signal });
      }

      const latencyMs = Date.now() - startTime;
      
      // Billing is strictly based on total output images generated
      // 2K = 8 units per image; 4K = 16 units per image
      const unitsPerImage = resolution === '4k' ? KLING_UNITS_PER_IMAGE_4K : KLING_UNITS_PER_IMAGE_2K;
      const actualUnitsConsumed = unitsPerImage * rawImages.length;
      const listPricePerImage = resolution === '4k' ? KLING_V3_4K_LIST_PRICE_USD : KLING_V3_2K_LIST_PRICE_USD;
      const estimatedSpendUsd = listPricePerImage * rawImages.length;
      const effectivePrepaidCostUsd = actualUnitsConsumed * KLING_TRIAL_PREPAID_RATE_PER_UNIT_USD;

      const costMetadata: KlingCostMetadata = {
        estimated_cost_usd: estimatedSpendUsd,
        actual_units_consumed: actualUnitsConsumed,
        estimated_spend_usd: estimatedSpendUsd,
        effective_prepaid_cost_usd: Number(effectivePrepaidCostUsd.toFixed(4)),
        list_price_usd: listPricePerImage,
        units_per_image: unitsPerImage,
        resolution,
        result_type: isSeriesTask ? 'series' : 'single',
        series_amount: isSeriesTask ? rawImages.length : undefined,
        billed_units: actualUnitsConsumed,
        pricing_tier: `${selectedModel}-${resolution}`,
        is_billable: true,
        cost_status: 'ACTUAL_VERIFIED'
      };

      return {
        provider: this.providerName,
        model: selectedModel,
        provider_request_id: submission.taskId,
        task_id: submission.taskId,
        external_task_id: submission.externalTaskId,
        created_at: new Date().toISOString(),
        latency_ms: latencyMs,
        mime_type: primaryDownload.mimeType,
        width: primaryDownload.width,
        height: primaryDownload.height,
        byte_size: primaryDownload.byteSize,
        sha256: primaryDownload.sha256,
        delivery_type: 'BYTES',
        image_bytes: primaryDownload.bytes,
        provider_url: primaryUrl,
        resolution,
        aspect_ratio: aspectRatio,
        batch_count: rawImages.length,
        result_type: isSeriesTask ? 'series' : 'single',
        series_amount: isSeriesTask ? rawImages.length : undefined,
        batch_images: batchImages,
        series_images: seriesImages,
        cost_metadata: costMetadata
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * R2 Staging Persistence Result
 */
export interface R2StagingPersistResult {
  persisted: boolean;
  persisted_to_r2: boolean;
  persisted_to_disk: boolean;
  r2_bucket: string;
  storage_key: string;
  public_url: string;
  local_file_path?: string;
  byte_size: number;
  sha256: string;
  mime_type: string;
  upload_command: string;
}

/**
 * Persists Kling image candidate to R2 Staging bucket and local disk.
 * R2 Staging Bucket: rancangloka-media-staging
 * Invariant: Never writes to production bucket rancangloka-media.
 */
export async function persistKlingCandidateToR2Staging(params: {
  imageBytes: Uint8Array;
  articleId: number;
  slotKey: string;
  model: string;
  mimeType: string;
  r2Bucket?: any;
  customStorageKey?: string;
  localOutputDir?: string;
  executeWranglerUpload?: boolean;
}): Promise<R2StagingPersistResult> {
  const {
    imageBytes,
    articleId,
    slotKey,
    model,
    mimeType,
    r2Bucket,
    customStorageKey,
    localOutputDir,
    executeWranglerUpload = false
  } = params;

  const sha256 = await computeBinarySha256(imageBytes);
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const cleanModel = model.replace(/[^a-zA-Z0-9_-]/g, '_');
  const storageKey = customStorageKey || `media/staging/articles/${articleId}/${slotKey}_${cleanModel}_${sha256.slice(0, 8)}.${ext}`;
  const r2BucketName = 'rancangloka-media-staging';
  const publicUrl = `https://rancangloka-staging.chandrajoyko.workers.dev/${storageKey}`;
  const uploadCommand = `npx wrangler r2 object put "${r2BucketName}/${storageKey}" --file="[LOCAL_FILE]" --content-type="${mimeType}"`;

  let persistedToDisk = false;
  let localFilePath: string | undefined;

  // 1. Write to local staging directory if requested or in Node environment
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const outDir = localOutputDir || path.resolve(process.cwd(), 'public/experimental-media/candidates');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const fileName = `art${articleId}_${slotKey}_${cleanModel}.${ext}`;
    localFilePath = path.join(outDir, fileName);
    fs.writeFileSync(localFilePath, Buffer.from(imageBytes));
    persistedToDisk = true;
  } catch (_fsErr) {
    // Non-filesystem runtime (e.g. Pure Edge Worker)
  }

  // 2. Persist to R2 Bucket if binding provided
  let persistedToR2 = false;
  if (r2Bucket && typeof r2Bucket.put === 'function') {
    await r2Bucket.put(storageKey, imageBytes, {
      httpMetadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000, immutable'
      },
      customMetadata: {
        article_id: String(articleId),
        slot_key: slotKey,
        model: model,
        sha256: sha256,
        source: 'kling_ai_trial'
      }
    });
    persistedToR2 = true;
  }

  // 3. If executeWranglerUpload is true and local file exists
  if (executeWranglerUpload && localFilePath && !persistedToR2) {
    try {
      const { execSync } = await import('node:child_process');
      const cmd = `npx wrangler r2 object put "${r2BucketName}/${storageKey}" --file="${localFilePath}" --content-type="${mimeType}"`;
      console.log(`   [R2 PUT] Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit', timeout: 60000 });
      persistedToR2 = true;
    } catch (cmdErr: any) {
      console.warn(`   ⚠️ Wrangler R2 Upload Warning: ${cmdErr?.message || cmdErr}`);
    }
  }

  return {
    persisted: persistedToDisk || persistedToR2,
    persisted_to_r2: persistedToR2,
    persisted_to_disk: persistedToDisk,
    r2_bucket: r2BucketName,
    storage_key: storageKey,
    public_url: publicUrl,
    local_file_path: localFilePath,
    byte_size: imageBytes.byteLength,
    sha256,
    mime_type: mimeType,
    upload_command: localFilePath ? uploadCommand.replace('[LOCAL_FILE]', localFilePath) : uploadCommand
  };
}
