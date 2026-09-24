/**
 * RancangLoka — OpenAI Headless Image Provider Adapter (MEDIA-A1)
 *
 * Implements ImageProviderAdapter for OpenAI Images API (DALL-E 3).
 *
 * Security & Reliability Invariants:
 * 1. API key is read strictly from environment / config; NEVER logged, printed, or exposed.
 * 2. Uses b64_json for single-hop direct binary materialization without extra download.
 * 3. Maps errors deterministically to typed ProviderErrorCode.
 * 4. Normalizes response to canonical ImageGenerationResult.
 */

import {
  type ImageProviderAdapter,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  ImageProviderError
} from './image-provider-types.ts';
import { validateImageBinary } from './image-validation.ts';

export const OPENAI_IMAGES_ENDPOINT = 'https://api.openai.com/v1/images/generations';
export const OPENAI_DEFAULT_IMAGE_MODEL = 'dall-e-3';
export const OPENAI_DEFAULT_TIMEOUT_MS = 90000;

export interface OpenAiImageAdapterOptions {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class OpenAiImageAdapter implements ImageProviderAdapter {
  readonly providerName = 'openai';
  readonly model: string;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: OpenAiImageAdapterOptions = {}) {
    this.model = options.model || OPENAI_DEFAULT_IMAGE_MODEL;
    this.endpoint = options.endpoint || OPENAI_IMAGES_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? OPENAI_DEFAULT_TIMEOUT_MS;
    this.apiKey = options.apiKey !== undefined ? options.apiKey : (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY || '' : '');
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
   * Resolves supported OpenAI image size from requested aspect ratio or dimensions.
   */
  resolveSize(request: ImageGenerationRequest): '1792x1024' | '1024x1024' | '1024x1792' {
    const ratio = (request.aspect_ratio || '').toLowerCase();
    if (ratio.includes('landscape') || ratio === '16:9' || ratio === '1315:660' || ratio === '2:1') {
      return '1792x1024';
    }
    if (ratio.includes('portrait') || ratio === '9:16' || ratio === '4:5') {
      return '1024x1792';
    }
    if (request.width && request.height) {
      if (request.width > request.height * 1.2) {
        return '1792x1024';
      }
      if (request.height > request.width * 1.2) {
        return '1024x1792';
      }
    }
    return '1024x1024';
  }

  /**
   * Generates exactly one image via OpenAI Images API.
   */
  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const effectiveModel = this.model;

    // 1. Auth Guard
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new ImageProviderError({
        code: 'AUTH_ERROR',
        provider: this.providerName,
        message: 'OPENAI_API_KEY is not configured or is empty. Cannot perform image generation.',
        isBillable: false
      });
    }

    // 2. Validate Prompt
    const trimmedPrompt = (request.prompt || '').trim();
    if (!trimmedPrompt) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: 'Prompt cannot be empty.',
        isBillable: false
      });
    }

    const resolvedSize = this.resolveSize(request);
    const quality = request.quality === 'hd' ? 'hd' : 'standard';

    const payload = {
      model: effectiveModel,
      prompt: trimmedPrompt,
      n: 1,
      size: resolvedSize,
      quality,
      response_format: 'b64_json'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeout_ms || this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey.trim()}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (netErr: any) {
      clearTimeout(timeoutId);
      if (netErr?.name === 'AbortError' || controller.signal.aborted) {
        throw new ImageProviderError({
          code: 'TIMEOUT',
          provider: this.providerName,
          message: `OpenAI image generation timed out after ${request.timeout_ms || this.timeoutMs}ms`,
          isBillable: false
        });
      }
      throw new ImageProviderError({
        code: 'UNKNOWN_PROVIDER_ERROR',
        provider: this.providerName,
        message: `Network transport failure calling OpenAI Images API: ${netErr?.message || String(netErr)}`,
        isBillable: false
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;
    const httpStatus = response.status;

    // 3. Handle Non-200 Responses
    if (!response.ok) {
      let errorBody: any = null;
      let errorMsg = `OpenAI API returned HTTP ${httpStatus}`;
      try {
        errorBody = await response.json();
        if (errorBody?.error?.message) {
          errorMsg = String(errorBody.error.message);
        }
      } catch {
        try {
          errorMsg = (await response.text()).slice(0, 256);
        } catch {}
      }

      // Redact any API key patterns or fragments that might be quoted in the error message
      errorMsg = errorMsg.replace(/sk-[a-zA-Z0-9_\-*]+/g, '[REDACTED_KEY]');

      // Check for content policy violation
      const codeOrType = String(errorBody?.error?.code || errorBody?.error?.type || '').toLowerCase();
      if (
        codeOrType.includes('content_policy') ||
        errorMsg.toLowerCase().includes('safety system') ||
        errorMsg.toLowerCase().includes('content policy')
      ) {
        throw new ImageProviderError({
          code: 'CONTENT_POLICY_BLOCK',
          provider: this.providerName,
          httpStatus,
          message: `Content policy violation from provider: ${errorMsg}`,
          isBillable: false,
          details: { errorBody }
        });
      }

      if (httpStatus === 401 || httpStatus === 403) {
        throw new ImageProviderError({
          code: 'AUTH_ERROR',
          provider: this.providerName,
          httpStatus,
          message: `Authentication failure (HTTP ${httpStatus}): ${errorMsg}`,
          isBillable: false
        });
      }

      if (httpStatus === 429) {
        throw new ImageProviderError({
          code: 'RATE_LIMIT',
          provider: this.providerName,
          httpStatus,
          message: `Rate limit exceeded (HTTP 429): ${errorMsg}`,
          isBillable: false
        });
      }

      if (httpStatus >= 500) {
        throw new ImageProviderError({
          code: 'PROVIDER_5XX',
          provider: this.providerName,
          httpStatus,
          message: `Provider server error (HTTP ${httpStatus}): ${errorMsg}`,
          isBillable: false
        });
      }

      throw new ImageProviderError({
        code: 'UNKNOWN_PROVIDER_ERROR',
        provider: this.providerName,
        httpStatus,
        message: `Image generation failed with HTTP ${httpStatus}: ${errorMsg}`,
        isBillable: false,
        details: { errorBody }
      });
    }

    // 4. Parse Successful Response
    let data: any;
    try {
      data = await response.json();
    } catch (parseErr: any) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: `Failed to parse OpenAI JSON response: ${parseErr?.message}`,
        isBillable: true
      });
    }

    const firstItem = data?.data?.[0];
    if (!firstItem) {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: 'OpenAI response contained empty or missing data array.',
        isBillable: true
      });
    }

    // 5. Materialize Binary Bytes
    let imageBytes: Uint8Array;
    let deliveryType: 'BASE64' | 'URL';
    let providerUrl: string | undefined;

    if (firstItem.b64_json) {
      deliveryType = 'BASE64';
      try {
        const binStr = atob(firstItem.b64_json);
        const len = binStr.length;
        imageBytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          imageBytes[i] = binStr.charCodeAt(i);
        }
      } catch (decErr: any) {
        throw new ImageProviderError({
          code: 'INVALID_RESPONSE',
          provider: this.providerName,
          message: `Failed to decode base64 image data: ${decErr?.message}`,
          isBillable: true
        });
      }
    } else if (firstItem.url) {
      deliveryType = 'URL';
      providerUrl = firstItem.url;
      try {
        const imgRes = await this.fetchFn(firstItem.url);
        if (!imgRes.ok) {
          throw new Error(`Download HTTP ${imgRes.status}`);
        }
        const arrayBuf = await imgRes.arrayBuffer();
        imageBytes = new Uint8Array(arrayBuf);
      } catch (dlErr: any) {
        throw new ImageProviderError({
          code: 'DOWNLOAD_FAILURE',
          provider: this.providerName,
          message: `Failed to download image bytes from provider URL: ${dlErr?.message}`,
          isBillable: true
        });
      }
    } else {
      throw new ImageProviderError({
        code: 'INVALID_RESPONSE',
        provider: this.providerName,
        message: 'Response item contains neither b64_json nor url.',
        isBillable: true
      });
    }

    // 6. Binary Validation & Dimension Extraction
    const validated = await validateImageBinary(imageBytes, this.providerName);

    // DALL-E 3 Standard pricing tier
    const costEstimate = quality === 'hd' ? 0.08 : 0.04;

    return {
      provider: this.providerName,
      model: effectiveModel,
      provider_request_id: response.headers?.get?.('x-request-id') || undefined,
      created_at: data.created ? new Date(data.created * 1000).toISOString() : new Date().toISOString(),
      latency_ms: latencyMs,
      mime_type: validated.mimeType,
      width: validated.width,
      height: validated.height,
      byte_size: validated.byteSize,
      sha256: validated.sha256,
      delivery_type: deliveryType,
      image_bytes: imageBytes,
      provider_url: providerUrl,
      revised_prompt: firstItem.revised_prompt || undefined,
      cost_metadata: {
        estimated_cost_usd: costEstimate,
        billed_units: 1,
        pricing_tier: quality
      }
    };
  }
}
