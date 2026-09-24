/**
 * RancangLoka — Headless Image Pipeline Coordinator (MEDIA-A1)
 *
 * Coordinates headless image generation, strict call bounding,
 * deterministic prompt hashing, binary persistence, and provenance generation.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  type ImageProviderAdapter,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  ImageProviderError
} from './image-provider-types.ts';
import { computeBinarySha256 } from './image-validation.ts';

export const MAX_CANARY_CALLS = 1;

/**
 * Normalizes prompt string and computes deterministic SHA-256 digest.
 */
export async function computePromptSha256(prompt: string): Promise<string> {
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  const enc = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', enc as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface HeadlessPipelineExecutionOptions {
  adapter: ImageProviderAdapter;
  request: ImageGenerationRequest;
  outputDirectory: string;
  outputFilename?: string;
}

export interface HeadlessPipelineExecutionResult {
  generationResult: ImageGenerationResult;
  savedFilePath: string;
  provenance: Record<string, any>;
  promptSha256: string;
  mediaA2Contract: MediaA2InputContract;
}

/**
 * Hand-off contract consumed by future MEDIA-A2 phase.
 */
export interface MediaA2InputContract {
  image_path: string;
  sha256: string;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  prompt_hash: string;
  request_id: string;
  provider: string;
  model: string;
  created_at: string;
  provenance: Record<string, any>;
}

export class HeadlessImagePipelineCoordinator {
  private callCount = 0;
  private readonly maxCalls: number;

  constructor(maxCalls: number = MAX_CANARY_CALLS) {
    this.maxCalls = maxCalls;
  }

  get totalCalls(): number {
    return this.callCount;
  }

  /**
   * Executes a single controlled headless image generation.
   * Enforces hard call guard (maximum billable calls).
   */
  async executeCanary(options: {
    adapter: ImageProviderAdapter;
    request: ImageGenerationRequest;
    outputDirectory: string;
    outputFilename?: string;
  }): Promise<HeadlessPipelineExecutionResult> {
    if (this.callCount >= this.maxCalls) {
      throw new ImageProviderError({
        code: 'UNKNOWN_PROVIDER_ERROR',
        provider: options.adapter.providerName,
        message: `Hard call guard tripped: MAX_PROVIDER_GENERATE_CALLS (${this.maxCalls}) exceeded.`,
        isBillable: false
      });
    }

    const promptSha256 = await computePromptSha256(options.request.prompt);

    // Increment call count prior to calling provider
    this.callCount++;

    const generationResult = await options.adapter.generate(options.request);

    // Save image bytes locally
    const ext = generationResult.mime_type === 'image/webp' ? 'webp' : generationResult.mime_type === 'image/jpeg' ? 'jpg' : 'png';
    const filename = options.outputFilename || `canary-generated-${generationResult.sha256.slice(0, 12)}.${ext}`;
    if (!fs.existsSync(options.outputDirectory)) {
      fs.mkdirSync(options.outputDirectory, { recursive: true });
    }
    const savedFilePath = path.join(options.outputDirectory, filename);
    fs.writeFileSync(savedFilePath, generationResult.image_bytes);

    // Verify written file integrity
    const writtenBytes = fs.readFileSync(savedFilePath);
    const writtenSha256 = await computeBinarySha256(writtenBytes);
    if (writtenSha256 !== generationResult.sha256) {
      throw new Error(`File write integrity mismatch: expected ${generationResult.sha256}, got ${writtenSha256}`);
    }

    // Build Provenance Record
    const provenance: Record<string, any> = {
      request_id: options.request.request_id,
      provider: generationResult.provider,
      model: generationResult.model,
      provider_request_id: generationResult.provider_request_id || null,
      prompt_hash: promptSha256,
      prompt_version: 1,
      media_role: options.request.media_role || 'featured',
      purpose: options.request.purpose,
      requested_aspect_ratio: options.request.aspect_ratio || '1792x1024',
      actual_width: generationResult.width,
      actual_height: generationResult.height,
      mime: generationResult.mime_type,
      byte_size: generationResult.byte_size,
      sha256: generationResult.sha256,
      latency_ms: generationResult.latency_ms,
      created_at: generationResult.created_at,
      delivery_type: generationResult.delivery_type,
      cost_metadata: generationResult.cost_metadata || null,
      revised_prompt: generationResult.revised_prompt || null
    };

    // Build MEDIA-A2 Input Contract
    const mediaA2Contract: MediaA2InputContract = {
      image_path: savedFilePath,
      sha256: generationResult.sha256,
      mime_type: generationResult.mime_type,
      width: generationResult.width,
      height: generationResult.height,
      byte_size: generationResult.byte_size,
      prompt_hash: promptSha256,
      request_id: options.request.request_id,
      provider: generationResult.provider,
      model: generationResult.model,
      created_at: generationResult.created_at,
      provenance
    };

    return {
      generationResult,
      savedFilePath,
      provenance,
      promptSha256,
      mediaA2Contract
    };
  }
}
