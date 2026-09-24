/**
 * RancangLoka — MEDIA-A1 Live Canary Execution Script
 *
 * Makes exactly ONE genuine headless image generation call to OpenAI Images API (DALL-E 3).
 * Validates binary, records provenance, and outputs deterministic metadata.
 *
 * HARD CONSTRAINTS:
 * - Exactly ONE billable call (MAX_PROVIDER_GENERATE_CALLS=1)
 * - Zero D1 mutations, Zero R2 uploads, Zero article attachments
 * - Zero secrets printed
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OpenAiImageAdapter } from '../src/lib/media/openai-image-adapter.ts';
import {
  HeadlessImagePipelineCoordinator,
  computePromptSha256
} from '../src/lib/media/headless-image-pipeline.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CANARY_PROMPT = 'Photorealistic architectural editorial photograph of a contemporary tropical Indonesian residential courtyard in natural daylight. Authentic Indonesian residential context featuring exposed brick, teak timber louvers, polished concrete, and lush tropical greenery in a central open-air lightwell. Realistic daylight with soft diffused shadows and balanced exposure. Realistic eye-level photographic perspective with subtle optical depth. High-end architectural photography, natural material textures, true photographic realism, no oversharpening. No people, no text, no logos, no watermarks, no UI, no infographic, no illustration, no cartoon, no 3D CGI look, no impossible architecture, no duplicated elements.';

async function runCanary() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A1 Live Image Generation Canary');
  console.log('=============================================================\n');

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY is not set in environment.');
    process.exit(1);
  }

  const promptHash = await computePromptSha256(CANARY_PROMPT);
  console.log('CANARY_PROMPT:', CANARY_PROMPT.slice(0, 80) + '...');
  console.log('PROMPT_SHA256:', promptHash);
  console.log('CANARY_ASPECT_RATIO: 1792x1024 (landscape ~1.75:1)');
  console.log('CANARY_OUTPUT_FORMAT: image/png');
  console.log('MAX_PROVIDER_GENERATE_CALLS: 1\n');

  const coordinator = new HeadlessImagePipelineCoordinator(1);
  const adapter = new OpenAiImageAdapter({
    apiKey,
    model: 'dall-e-3',
    timeoutMs: 120000
  });

  const requestId = `req_canary_a1_${Date.now()}`;
  const artifactsDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log('Dispatching EXACTLY ONE live image generation call to OpenAI (DALL-E 3)...');
  const startTime = Date.now();

  try {
    const result = await coordinator.executeCanary({
      adapter,
      request: {
        request_id: requestId,
        prompt: CANARY_PROMPT,
        aspect_ratio: '1315:660',
        purpose: 'canary_media_a1',
        media_role: 'featured',
        quality: 'standard'
      },
      outputDirectory: artifactsDir,
      outputFilename: 'canary-media-a1.png'
    });

    const elapsed = Date.now() - startTime;
    console.log(`\n--- LIVE CANARY COMPLETED IN ${elapsed}ms ---`);
    console.log('PROVIDER_GENERATE_CALLS:', coordinator.totalCalls);
    console.log('LIVE_PROVIDER_REQUEST_SUCCESS: YES');
    console.log('PROVIDER:', result.generationResult.provider);
    console.log('MODEL:', result.generationResult.model);
    console.log('PROVIDER_REQUEST_ID:', result.generationResult.provider_request_id || requestId);
    console.log('LATENCY_MS:', result.generationResult.latency_ms);
    console.log('DELIVERY_TYPE:', result.generationResult.delivery_type);
    console.log('IMAGE_BYTES_ACQUIRED: YES');
    console.log('LOCAL_CANARY_FILE:', result.savedFilePath);
    console.log('GENERATED_SHA256:', result.generationResult.sha256);
    console.log('GENERATED_BYTE_SIZE:', result.generationResult.byte_size);
    console.log('GENERATED_WIDTH:', result.generationResult.width);
    console.log('GENERATED_HEIGHT:', result.generationResult.height);
    console.log('GENERATED_MIME:', result.generationResult.mime_type);
    console.log('IMAGE_BINARY_VALIDATION: PASS');

    // Save provenance fixture
    const provPath = path.resolve(artifactsDir, 'canary-media-a1-provenance.json');
    fs.writeFileSync(provPath, JSON.stringify(result.provenance, null, 2), 'utf8');
    console.log('PROVENANCE_RECORD_PATH:', provPath);
    console.log('PROVENANCE_COMPLETE: YES');

    // Save handoff contract
    const contractPath = path.resolve(artifactsDir, 'canary-media-a2-handoff.json');
    fs.writeFileSync(contractPath, JSON.stringify(result.mediaA2Contract, null, 2), 'utf8');
    console.log('MEDIA_A2_HANDOFF_PATH:', contractPath);

    console.log('\n=============================================================');
    console.log('  MEDIA-A1 LIVE CANARY PASSED SUCCESSFULLY!');
    console.log('=============================================================');
  } catch (err) {
    console.error('\n❌ LIVE CANARY FAILED:', err?.message || err);
    if (err?.code) {
      console.log('SANITIZED_ERROR_CLASS:', err.code);
      console.log('HTTP_STATUS:', err.httpStatus);
      console.log('IS_BILLABLE:', err.isBillable);
    }
    console.log('LIVE_PROVIDER_REQUEST_SUCCESS: NO');
    process.exitCode = 1;
  }
}

runCanary();
