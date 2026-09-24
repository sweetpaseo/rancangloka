/**
 * RancangLoka — Fal.ai Image Provider Adapter (MEDIA-A1.1)
 *
 * Implements the provider-neutral ImageProviderAdapter interface for fal.ai.
 * Designed for autonomous server-side image generation (FLUX models).
 *
 * SAFETY INVARIANTS:
 * - Never prints, logs, or leaks FAL_KEY
 * - Redacts secrets from all error messages and provenance objects
 * - Maps errors into canonical typed ProviderErrorCode
 * - Downloads image bytes from provider URL and validates binary headers
 */

import { createFalClient } from '@fal-ai/client';
import type {
  ImageProviderAdapter,
  ImageGenerationRequest,
  ImageGenerationResult
} from './image-provider-types.ts';
import {
  ImageProviderError
} from './image-provider-types.ts';
import {
  validateImageBinary,
  computeBinarySha256
} from './image-validation.ts';

export interface FalAdapterOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  /** Optional custom client or runner for mocking in tests */
  runnerFn?: (model: string, input: any, options?: any) => Promise<any>;
  fetchFn?: typeof fetch;
}

export const DEFAULT_FAL_MODEL = 'fal-ai/flux/dev';
export const DEFAULT_TIMEOUT_MS = 120000;

export class FalImageProviderAdapter implements ImageProviderAdapter {
  readonly providerName = 'fal';
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly runnerFn?: (model: string, input: any, options?: any) => Promise<any>;
  private readonly fetchFn: typeof fetch;

  constructor(options: FalAdapterOptions = {}) {
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.FAL_KEY || '' : '');
    this.modelName = options.model || DEFAULT_FAL_MODEL;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.runnerFn = options.runnerFn;
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  /**
   * Resolves requested aspect ratio / dimensions to fal image_size parameters.
   * Target for RancangLoka landscape featured visual is approximately 1315:660 (~1.99:1).
   */
  resolveImageSize(request: ImageGenerationRequest): { width: number; height: number } | string {
    if (request.width && request.height) {
      return { width: request.width, height: request.height };
    }

    const ratio = (request.aspect_ratio || '').toLowerCase().trim();
    if (ratio === '1315:660' || ratio === '2:1' || ratio === '16:9' || ratio === 'landscape') {
      // 1312x672 is divisible by 16 and close to 1315:660
      return { width: 1312, height: 672 };
    }
    if (ratio === '1:1' || ratio === 'square') {
      return { width: 1024, height: 1024 };
    }
    if (ratio === 'portrait' || ratio === '9:16') {
      return { width: 672, height: 1312 };
    }

    // Default to landscape for RancangLoka architectural visuals
    return { width: 1312, height: 672 };
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    // 1. Guard against missing credentials
    if (!this.apiKey && !this.runnerFn) {
      throw new ImageProviderError({
        code: 'AUTH_ERROR',
        provider: this.providerName,
        message: 'fal.ai credentials missing: FAL_KEY environment variable is not set.',
        isBillable: false
      });
    }

    const imageSize = this.resolveImageSize(request);
    const selectedModel = request.model_override || this.modelName;

    // 2. Prepare fal client
    let client: ReturnType<typeof createFalClient> | null = null;
    if (!this.runnerFn) {
      client = createFalClient({
        credentials: this.apiKey
      });
    }

    const abortController = new AbortController();
    const timeoutDuration = request.timeout_ms || this.timeoutMs;
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error(`Operation timed out after ${timeoutDuration}ms`));
    }, timeoutDuration);

    let rawResult: any = null;
    let requestId = request.request_id;

    try {
      if (this.runnerFn) {
        // Custom runner path (used in unit testing)
        rawResult = await this.runnerFn(selectedModel, {
          prompt: request.prompt,
          image_size: imageSize,
          num_images: 1,
          enable_safety_checker: true
        }, { signal: abortController.signal });
      } else if (client) {
        // Official fal client subscribe invocation
        const subResult = await client.subscribe(selectedModel, {
          input: {
            prompt: request.prompt,
            image_size: imageSize,
            num_images: 1,
            enable_safety_checker: true
          },
          logs: false
        });
        rawResult = subResult;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.handleFalError(err);
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;

    // 3. Extract and Validate Image URL from Result
    const data = rawResult?.data || rawResult;
    requestId = rawResult?.requestId || rawResult?.request_id || requestId;

    const images = data?.images;
    if (!Array.isArray(images) || images.length === 0 || !images[0]?.url) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: 'fal.ai response did not contain expected images array or image URL',
        isBillable: false,
        details: { responseSummary: typeof data }
      });
    }

    const imageUrl = images[0].url;

    // Check for safety violation flagged in response
    if (data?.has_nsfw_concepts && data.has_nsfw_concepts[0] === true) {
      throw new ImageProviderError({
        code: 'CONTENT_POLICY_BLOCK',
        provider: this.providerName,
        message: 'Generated image flagged by fal.ai safety checker',
        isBillable: false
      });
    }

    // 4. Materialize Image Bytes (Download once from verified provider URL)
    let imageBytes: Uint8Array;
    try {
      const dlResponse = await this.fetchFn(imageUrl);
      if (!dlResponse.ok) {
        throw new Error(`HTTP ${dlResponse.status}: ${dlResponse.statusText}`);
      }
      const arrayBuf = await dlResponse.arrayBuffer();
      imageBytes = new Uint8Array(arrayBuf);
    } catch (dlErr: any) {
      throw new ImageProviderError({
        code: 'DOWNLOAD_FAILURE',
        provider: this.providerName,
        message: `Failed to download generated image from fal.ai URL: ${dlErr?.message || dlErr}`,
        isBillable: true,
        details: { providerUrl: imageUrl }
      });
    }

    // 5. Binary Validation (magic bytes, dimensions, SHA-256)
    const validationMeta = await validateImageBinary(imageBytes, 'fal');
    const sha256 = await computeBinarySha256(imageBytes);

    const costEstimate = selectedModel.includes('flux/dev') ? 0.025 : 0.05;

    return {
      provider: this.providerName,
      model: selectedModel,
      provider_request_id: requestId,
      created_at: new Date().toISOString(),
      latency_ms: latencyMs,
      mime_type: validationMeta.mimeType,
      width: validationMeta.width,
      height: validationMeta.height,
      byte_size: validationMeta.byteSize,
      sha256,
      delivery_type: 'URL',
      provider_url: imageUrl,
      image_bytes: imageBytes,
      cost_metadata: {
        estimated_cost_usd: costEstimate,
        is_billable: true
      }
    };
  }

  /**
   * Translates provider-specific errors into canonical ImageProviderError
   */
  private handleFalError(err: any): never {
    if (err instanceof ImageProviderError) {
      throw err;
    }

    let msg = String(err?.message || err || 'Unknown fal.ai error');
    // Strictly sanitize any credential pattern or key value
    if (this.apiKey) {
      msg = msg.split(this.apiKey).join('[REDACTED_FAL_KEY]');
    }
    msg = msg.replace(/(?:fal|key|secret)[-_a-zA-Z0-9]{16,}/gi, '[REDACTED_KEY]');

    const status = Number(err?.status || err?.statusCode || 0);

    if (err?.name === 'AbortError' || msg.toLowerCase().includes('timed out') || msg.toLowerCase().includes('aborted')) {
      throw new ImageProviderError({
        code: 'TIMEOUT',
        provider: this.providerName,
        message: `fal.ai request timed out: ${msg}`,
        isBillable: false
      });
    }

    if (status === 401 || status === 403 || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('invalid credential')) {
      throw new ImageProviderError({
        code: 'AUTH_ERROR',
        provider: this.providerName,
        httpStatus: status || 401,
        message: `fal.ai authentication failure: ${msg}`,
        isBillable: false
      });
    }

    if (status === 429 || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')) {
      throw new ImageProviderError({
        code: 'RATE_LIMIT',
        provider: this.providerName,
        httpStatus: 429,
        message: `fal.ai rate limit or quota exceeded: ${msg}`,
        isBillable: false
      });
    }

    if (status >= 500) {
      throw new ImageProviderError({
        code: 'PROVIDER_5XX',
        provider: this.providerName,
        httpStatus: status,
        message: `fal.ai service error (HTTP ${status}): ${msg}`,
        isBillable: false
      });
    }

    if (msg.toLowerCase().includes('content policy') || msg.toLowerCase().includes('nsfw') || msg.toLowerCase().includes('safety')) {
      throw new ImageProviderError({
        code: 'CONTENT_POLICY_BLOCK',
        provider: this.providerName,
        message: `fal.ai content safety block: ${msg}`,
        isBillable: false
      });
    }

    throw new ImageProviderError({
      code: 'UNKNOWN_PROVIDER_ERROR',
      provider: this.providerName,
      httpStatus: status || undefined,
      message: `fal.ai error: ${msg}`,
      isBillable: false
    });
  }
}
