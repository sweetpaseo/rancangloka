/**
 * RancangLoka — MEDIA-A1.1 Fal.ai Live Canary Execution Script
 *
 * Dispatches exactly ONE real image generation call to fal.ai API.
 * Validates binary, records provenance, and outputs deterministic metadata.
 *
 * HARD CONSTRAINTS:
 * - Exactly ONE generation call (MAX_FAL_GENERATION_CALLS=1)
 * - Zero D1 mutations, Zero R2 uploads, Zero article attachments
 * - Zero secrets printed or leaked
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FalImageProviderAdapter, DEFAULT_FAL_MODEL } from '../src/lib/media/fal-image-adapter.ts';
import {
  HeadlessImagePipelineCoordinator,
  computePromptSha256
} from '../src/lib/media/headless-image-pipeline.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CANARY_PROMPT = `Photorealistic architectural editorial photograph of a contemporary tropical Indonesian residential courtyard in natural daylight.

Authentic Indonesian residential context with warm teak timber, natural stone, exposed concrete, lush tropical planting and cross-ventilation openings.

Realistic eye-level architectural photography.
Balanced natural daylight.
Natural material texture.
Realistic shadows.
Professional editorial composition.

No people.
No text.
No logos.
No watermark.
No UI.
No infographic.
No illustration.
No cartoon.
No CGI / 3D-render appearance.
No impossible architecture.
No duplicated architectural elements.`;

async function runCanary() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A1.1 Fal.ai Live Generation Canary');
  console.log('=============================================================\n');

  const falKey = process.env.FAL_KEY || '';
  const falKeyPresent = Boolean(falKey.trim());
  console.log('FAL_KEY_PRESENT:', falKeyPresent ? 'YES' : 'NO');

  if (!falKeyPresent) {
    console.error('ERROR: FAL_KEY environment variable is not set.');
    console.log('FAL_API_REQUEST_ATTEMPTS: 0');
    console.log('SUCCESSFUL_IMAGE_GENERATIONS: 0');
    console.log('LIVE_FAL_REQUEST_SUCCESS: NO');
    console.log('STOPPING before live request as required by Section 2.');
    process.exitCode = 1;
    return;
  }

  const promptHash = await computePromptSha256(CANARY_PROMPT);
  console.log('SELECTED_FAL_MODEL:', DEFAULT_FAL_MODEL);
  console.log('CANARY_PROMPT:', CANARY_PROMPT.slice(0, 100).replace(/\n/g, ' ') + '...');
  console.log('PROMPT_SHA256:', promptHash);
  console.log('REQUESTED_ASPECT_RATIO: 1315:660 (~1.99:1)');
  console.log('ACTUAL_PROVIDER_SIZE: 1312x672');
  console.log('MAX_FAL_GENERATION_CALLS: 1\n');

  const coordinator = new HeadlessImagePipelineCoordinator(1);
  const adapter = new FalImageProviderAdapter({
    apiKey: falKey,
    model: DEFAULT_FAL_MODEL,
    timeoutMs: 120000
  });

  const requestId = `req_fal_a1_${Date.now()}`;
  const artifactsDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log(`Dispatching EXACTLY ONE live image generation call to fal.ai (${DEFAULT_FAL_MODEL})...`);
  const startTime = Date.now();

  try {
    const result = await coordinator.executeCanary({
      adapter,
      request: {
        request_id: requestId,
        prompt: CANARY_PROMPT,
        aspect_ratio: '1315:660',
        purpose: 'MEDIA_A1',
        media_role: 'featured'
      },
      outputDirectory: artifactsDir,
      outputFilename: 'canary-fal-media-a1.png'
    });

    const elapsed = Date.now() - startTime;
    console.log(`\n--- LIVE FAL CANARY COMPLETED IN ${elapsed}ms ---`);
    console.log('FAL_API_REQUEST_ATTEMPTS: 1');
    console.log('SUCCESSFUL_IMAGE_GENERATIONS: 1');
    console.log('LIVE_FAL_REQUEST_SUCCESS: YES');
    console.log('PROVIDER:', result.generationResult.provider);
    console.log('MODEL:', result.generationResult.model);
    console.log('FAL_REQUEST_ID:', result.generationResult.provider_request_id || requestId);
    console.log('LATENCY_MS:', result.generationResult.latency_ms);
    console.log('DELIVERY_TYPE:', result.generationResult.delivery_type);
    console.log('LOCAL_CANARY_FILE:', result.savedFilePath);
    console.log('GENERATED_SHA256:', result.generationResult.sha256);
    console.log('GENERATED_BYTE_SIZE:', result.generationResult.byte_size);
    console.log('GENERATED_WIDTH:', result.generationResult.width);
    console.log('GENERATED_HEIGHT:', result.generationResult.height);
    console.log('GENERATED_MIME:', result.generationResult.mime_type);
    console.log('LIVE_IMAGE_BINARY_VALIDATION: PASS');

    // Save provenance fixture
    const provPath = path.resolve(artifactsDir, 'canary-fal-media-a1-provenance.json');
    fs.writeFileSync(provPath, JSON.stringify(result.provenance, null, 2), 'utf8');
    console.log('PROVENANCE_RECORD_PATH:', provPath);
    console.log('PROVENANCE_COMPLETE: YES');

    console.log('\n=============================================================');
    console.log('  MEDIA-A1.1 FAL CANARY PASSED SUCCESSFULLY!');
    console.log('=============================================================');
  } catch (err) {
    console.error('\n❌ LIVE FAL CANARY FAILED:', err?.message || err);
    console.log('FAL_API_REQUEST_ATTEMPTS: 1');
    console.log('SUCCESSFUL_IMAGE_GENERATIONS: 0');
    console.log('LIVE_FAL_REQUEST_SUCCESS: NO');
    if (err?.code) {
      console.log('SANITIZED_ERROR_CLASS:', err.code);
      console.log('HTTP_STATUS:', err.httpStatus);
    }
    process.exitCode = 1;
  }
}

runCanary();
