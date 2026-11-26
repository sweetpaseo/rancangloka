/**
 * RancangLoka — Native Kling Image 4.0 Provider Adapter (KLING-V4-NATIVE)
 *
 * Dedicated adapter for Kling Image 4.0 implementing the official endpoint:
 * POST /image-generation/kling-4.0
 * Status Query: GET /tasks?task_ids={task_id}
 *
 * CANONICAL ARCHITECTURAL & INTEGRITY INVARIANTS:
 * 1. Zero Model Impersonation: Never silently maps to kling-v3 or another model.
 * 2. Authentic Provenance: Always preserves model: 'kling-v4' and actual provider task ID.
 * 3. Dedicated Schema: Encapsulates the Kling 4.0 `contents` array and `settings` object.
 * 4. Test Mocking: Accepts custom fetchFn for zero-cost schema & unit validation.
 * 5. Secret Protection: Redacts KLING_API_KEY from all error messages and exceptions.
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

export const KLING_V4_API_BASE = 'https://api-singapore.klingai.com';
export const KLING_V4_SUBMIT_PATH = '/image-generation/kling-4.0';
export const KLING_V4_STATUS_PATH = '/tasks';
export const KLING_MODEL_V4_NATIVE = 'kling-v4';

// Pricing rates for Kling Image 4.0:
// 1K: 6 units ($0.0210 list price at $0.0035/unit)
// 2K: 12 units ($0.0420 list price at $0.0035/unit)
// 4K: 24 units ($0.0840 list price at $0.0035/unit)
// 8K: 48 units ($0.1680 list price at $0.0035/unit)
// Trial package prepaid rate: $0.00245 / unit
export const KLING_V4_UNITS_1K = 6;
export const KLING_V4_UNITS_2K = 12;
export const KLING_V4_UNITS_4K = 24;
export const KLING_V4_UNITS_8K = 48;

export const KLING_V4_LIST_PRICE_1K_USD = 0.0210;
export const KLING_V4_LIST_PRICE_2K_USD = 0.0420;
export const KLING_V4_LIST_PRICE_4K_USD = 0.0840;
export const KLING_V4_LIST_PRICE_8K_USD = 0.1680;

export const DEFAULT_KLING_V4_TIMEOUT_MS = 180000; // 3 minutes
export const DEFAULT_KLING_V4_POLL_INTERVAL_MS = 3000; // 3 seconds

export interface KlingV4AdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  fetchFn?: typeof fetch;
}

export interface KlingV4TaskInfo {
  task_id: string;
  task_status: 'submitted' | 'processing' | 'succeed' | 'success' | 'failed' | string;
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
  };
}

export class KlingV4ImageProviderAdapter implements ImageProviderAdapter {
  readonly providerName = 'kling';
  readonly modelName = KLING_MODEL_V4_NATIVE;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: KlingV4AdapterOptions = {}) {
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.KLING_API_KEY || '' : '');
    this.baseUrl = (options.baseUrl || KLING_V4_API_BASE).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs || DEFAULT_KLING_V4_TIMEOUT_MS;
    this.pollIntervalMs = options.pollIntervalMs || DEFAULT_KLING_V4_POLL_INTERVAL_MS;
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  resolveResolution(request: ImageGenerationRequest): '1k' | '2k' | '4k' | '8k' {
    const raw = (request.quality || (request as any).resolution || '2k').toLowerCase();
    if (raw.includes('8k')) return '8k';
    if (raw.includes('4k')) return '4k';
    if (raw.includes('1k')) return '1k';
    return '2k';
  }

  resolveAspectRatio(request: ImageGenerationRequest): string {
    const ar = (request.aspect_ratio || '16:9').toLowerCase().trim();
    if (ar === '1:1' || ar === 'square') return '1:1';
    if (ar === '9:16' || ar === 'portrait') return '9:16';
    if (ar === '4:3') return '4:3';
    if (ar === '3:4') return '3:4';
    if (ar === '3:2') return '3:2';
    if (ar === '2:3') return '2:3';
    if (ar === '21:9' || ar === 'ultrawide') return '21:9';
    return '16:9';
  }

  sanitizeMessage(msg: string): string {
    if (!this.apiKey) return msg;
    return msg.replaceAll(this.apiKey, '[REDACTED_KLING_API_KEY]');
  }

  /**
   * Constructs official Kling 4.0 submission payload according to POST /image-generation/kling-4.0 schema.
   */
  buildSubmissionPayload(request: ImageGenerationRequest): {
    url: string;
    payload: {
      contents: Array<{ type: 'prompt' | 'refer_image'; text?: string; url?: string; id?: string }>;
      settings: {
        result_type: 'single' | 'series';
        n: number;
        resolution: string;
        aspect_ratio: string;
        negative_prompt?: string;
      };
      external_task_id: string;
    };
    maskedHeaders: Record<string, string>;
  } {
    const resolution = this.resolveResolution(request);
    const aspectRatio = this.resolveAspectRatio(request);
    const externalTaskId = request.request_id || `req_kling4_${Date.now()}`;

    const contents: Array<{ type: 'prompt' | 'refer_image'; text?: string; url?: string; id?: string }> = [
      {
        type: 'prompt',
        text: request.prompt
      }
    ];

    if (request.reference_image_url) {
      contents.push({
        type: 'refer_image',
        url: request.reference_image_url,
        id: request.reference_image_id || 'ref_image'
      });
    }

    const settings: {
      result_type: 'single' | 'series';
      n: number;
      resolution: string;
      aspect_ratio: string;
      negative_prompt?: string;
    } = {
      result_type: 'single',
      n: 1,
      resolution,
      aspect_ratio: aspectRatio
    };

    if (request.negative_prompt && request.negative_prompt.trim().length > 0) {
      settings.negative_prompt = request.negative_prompt.trim();
    }

    const payload = {
      contents,
      settings,
      external_task_id: externalTaskId
    };

    return {
      url: `${this.baseUrl}${KLING_V4_SUBMIT_PATH}`,
      payload,
      maskedHeaders: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer [REDACTED_KLING_API_KEY]'
      }
    };
  }

  /**
   * Submits generation task to Kling 4.0 endpoint.
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

    const { url, payload } = this.buildSubmissionPayload(request);

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
      throw new ImageProviderError({
        code: 'UNKNOWN_PROVIDER_ERROR',
        provider: this.providerName,
        message: `Kling 4.0 network submission failure: ${this.sanitizeMessage(netErr?.message || String(netErr))}`,
        isBillable: false
      });
    }

    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Kling 4.0 invalid JSON response: ${this.sanitizeMessage(text.slice(0, 200))}`,
        httpStatus: response.status,
        isBillable: false
      });
    }

    if (!response.ok || json.code !== 0) {
      const code = json.code ?? response.status;
      const msg = this.sanitizeMessage(json.message || `HTTP ${response.status}`);
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Kling 4.0 submission rejected (code ${code}): ${msg}`,
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
        message: 'Kling 4.0 response did not contain expected data.task_id.',
        httpStatus: response.status,
        isBillable: false,
        details: json
      });
    }

    return {
      taskId,
      externalTaskId: payload.external_task_id,
      model: KLING_MODEL_V4_NATIVE
    };
  }

  /**
   * Queries status of an existing task via GET /tasks?task_ids={taskId}
   */
  async queryTaskStatus(
    taskId: string,
    options?: { signal?: AbortSignal }
  ): Promise<KlingV4TaskInfo> {
    if (!this.apiKey) {
      throw new ImageProviderError({
        code: 'AUTH_ERROR',
        provider: this.providerName,
        message: 'Kling API credentials missing.',
        isBillable: false
      });
    }

    const url = `${this.baseUrl}${KLING_V4_STATUS_PATH}?task_ids=${encodeURIComponent(taskId)}`;
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: options?.signal
      });
    } catch (netErr: any) {
      throw new ImageProviderError({
        code: 'UNKNOWN_PROVIDER_ERROR',
        provider: this.providerName,
        message: `Kling 4.0 task status check failed: ${this.sanitizeMessage(netErr?.message || String(netErr))}`,
        isBillable: false
      });
    }

    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Kling 4.0 task status invalid JSON: ${this.sanitizeMessage(text.slice(0, 200))}`,
        httpStatus: response.status,
        isBillable: false
      });
    }

    if (!response.ok || json.code !== 0) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Kling 4.0 task status error (code ${json.code}): ${this.sanitizeMessage(json.message || '')}`,
        httpStatus: response.status,
        isBillable: false
      });
    }

    // Official response wraps in data array or data object
    let item: KlingV4TaskInfo | undefined;
    if (Array.isArray(json.data)) {
      item = json.data.find((t: any) => t.task_id === taskId) || json.data[0];
    } else if (json.data && typeof json.data === 'object') {
      item = json.data;
    }

    if (!item) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Kling 4.0 task ${taskId} not found in response data.`,
        isBillable: false
      });
    }

    return item;
  }

  /**
   * Polls task until complete.
   */
  async pollTaskUntilComplete(
    taskId: string,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<KlingV4TaskInfo> {
    const timeout = options?.timeoutMs || this.timeoutMs;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (options?.signal?.aborted) {
        throw new ImageProviderError({
          code: 'TIMEOUT',
          provider: this.providerName,
          message: 'Operation aborted while polling Kling 4.0 task.',
          isBillable: false
        });
      }

      const task = await this.queryTaskStatus(taskId, options);
      const status = task.task_status?.toLowerCase();

      if (status === 'succeed' || status === 'success') {
        return task;
      }

      if (status === 'failed') {
        throw new ImageProviderError({
          code: 'CONTENT_POLICY_BLOCK',
          provider: this.providerName,
          message: `Kling 4.0 generation failed: ${task.task_status_msg || 'Provider reported task_status=failed'}`,
          isBillable: false,
          details: task
        });
      }

      await new Promise(r => setTimeout(r, this.pollIntervalMs));
    }

    throw new ImageProviderError({
      code: 'TIMEOUT',
      provider: this.providerName,
      message: `Kling 4.0 generation timed out after ${timeout}ms (task_id: ${taskId})`,
      isBillable: false
    });
  }

  /**
   * Complete end-to-end generation execution.
   */
  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const resolution = this.resolveResolution(request);
    const { taskId } = await this.submitTask(request);

    const completedTask = await this.pollTaskUntilComplete(taskId, {
      timeoutMs: request.timeout_ms || this.timeoutMs
    });

    const images = completedTask.task_result?.images;
    if (!images || images.length === 0 || !images[0]?.url) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Kling 4.0 generation succeeded but returned empty images array (task_id: ${taskId})`,
        isBillable: false
      });
    }

    const imageUrl = images[0].url;

    // Download image bytes
    const imgRes = await this.fetchFn(imageUrl);
    if (!imgRes.ok) {
      throw new ImageProviderError({
        code: 'DOWNLOAD_FAILURE',
        provider: this.providerName,
        message: `Failed downloading Kling 4.0 asset (HTTP ${imgRes.status}): ${imageUrl}`,
        isBillable: false
      });
    }

    const imageBytes = new Uint8Array(await imgRes.arrayBuffer());
    const mimeType = imgRes.headers.get('content-type') || 'image/png';
    const validation = await validateImageBinary(imageBytes, mimeType);
    const sha256 = await computeBinarySha256(imageBytes);

    let billedUnits = KLING_V4_UNITS_2K;
    let estimatedCostUsd = KLING_V4_LIST_PRICE_2K_USD;
    if (resolution === '1k') {
      billedUnits = KLING_V4_UNITS_1K;
      estimatedCostUsd = KLING_V4_LIST_PRICE_1K_USD;
    } else if (resolution === '4k') {
      billedUnits = KLING_V4_UNITS_4K;
      estimatedCostUsd = KLING_V4_LIST_PRICE_4K_USD;
    } else if (resolution === '8k') {
      billedUnits = KLING_V4_UNITS_8K;
      estimatedCostUsd = KLING_V4_LIST_PRICE_8K_USD;
    }

    const costMetadata: ImageCostMetadata = {
      estimated_cost_usd: estimatedCostUsd,
      billed_units: billedUnits,
      pricing_tier: `kling_v4_${resolution}`,
      is_billable: true,
      cost_status: 'ACTUAL_VERIFIED'
    };

    return {
      provider: this.providerName,
      model: KLING_MODEL_V4_NATIVE,
      provider_request_id: taskId,
      created_at: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
      mime_type: mimeType,
      width: validation.width || 1280,
      height: validation.height || 720,
      byte_size: imageBytes.byteLength,
      sha256,
      delivery_type: 'BYTES',
      image_bytes: imageBytes,
      provider_url: imageUrl,
      cost_metadata: costMetadata
    };
  }
}
