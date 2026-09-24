/**
 * RancangLoka — MEDIA-A1.1 Fal.ai Headless Image Provider Unit Tests
 *
 * Deterministic offline test suite verifying:
 * 1. Provider request mapping (aspect ratio to fal dimensions)
 * 2. Provider response normalization & URL download materialization
 * 3. Secret redaction and credential safety (FAL_KEY protection)
 * 4. Deterministic prompt hashing
 * 5. Image binary validation (magic bytes, dimension parsing, HTML error rejection)
 * 6. Provider error classification (AUTH_ERROR, RATE_LIMIT, TIMEOUT, 5XX, CONTENT_POLICY_BLOCK, DOWNLOAD_FAILURE)
 * 7. Hard one-call canary guard with FalImageProviderAdapter
 *
 * NO PAID OR LIVE NETWORK CALLS ARE MADE IN THIS SUITE.
 */

import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FalImageProviderAdapter,
  DEFAULT_FAL_MODEL
} from '../src/lib/media/fal-image-adapter.ts';
import {
  ImageProviderError
} from '../src/lib/media/image-provider-types.ts';
import {
  validateImageBinary,
  computeBinarySha256
} from '../src/lib/media/image-validation.ts';
import {
  computePromptSha256,
  HeadlessImagePipelineCoordinator
} from '../src/lib/media/headless-image-pipeline.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: build a minimal valid synthetic PNG
function createSyntheticPng(width = 1312, height = 672) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // 8-bit
  ihdr[9] = 2;  // RGB
  ihdr[10] = 0; // deflated
  ihdr[11] = 0;
  ihdr[12] = 0;

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = zlib.crc32(toCrc);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // 1 row of black pixels
  const row = Buffer.alloc(1 + width * 3);
  row[0] = 0;
  const compressed = zlib.deflateSync(row);

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

async function runSuite() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A1.1 Fal.ai Provider Unit Test Suite');
  console.log('=============================================================\n');

  let passed = 0;

  // -------------------------------------------------------------------------
  // TEST 1: Provider Request Mapping
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Provider Request Mapping ---');
  {
    const adapter = new FalImageProviderAdapter({ apiKey: 'mock-fal-key' });

    const sizeLandscape = adapter.resolveImageSize({ request_id: 'r1', prompt: 'test', purpose: 'canary', aspect_ratio: '1315:660' });
    assert.deepEqual(sizeLandscape, { width: 1312, height: 672 });

    const size169 = adapter.resolveImageSize({ request_id: 'r2', prompt: 'test', purpose: 'canary', aspect_ratio: '16:9' });
    assert.deepEqual(size169, { width: 1312, height: 672 });

    const sizeSquare = adapter.resolveImageSize({ request_id: 'r3', prompt: 'test', purpose: 'canary', aspect_ratio: '1:1' });
    assert.deepEqual(sizeSquare, { width: 1024, height: 1024 });

    const sizePortrait = adapter.resolveImageSize({ request_id: 'r4', prompt: 'test', purpose: 'canary', aspect_ratio: 'portrait' });
    assert.deepEqual(sizePortrait, { width: 672, height: 1312 });

    console.log('  PASS: Aspect ratio mapping to fal dimensions (1312x672 / 1024x1024 / 672x1312)');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Provider Response Normalization & URL Download Materialization
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Provider Response Normalization & URL Materialization ---');
  {
    const pngBuf = createSyntheticPng(1312, 672);
    const expectedSha256 = await computeBinarySha256(pngBuf);
    const mockImageUrl = 'https://v3.fal.media/files/monkey/canary-editorial.png';

    const mockRunner = async (model, input) => {
      assert.equal(model, DEFAULT_FAL_MODEL);
      assert.equal(input.image_size.width, 1312);
      assert.equal(input.image_size.height, 672);
      return {
        data: {
          images: [
            {
              url: mockImageUrl,
              width: 1312,
              height: 672,
              content_type: 'image/png'
            }
          ]
        },
        requestId: 'fal_req_canary_mock_999'
      };
    };

    const mockFetch = async (url) => {
      assert.equal(url, mockImageUrl);
      return new Response(pngBuf, {
        status: 200,
        headers: { 'Content-Type': 'image/png' }
      });
    };

    const adapter = new FalImageProviderAdapter({
      apiKey: 'mock-valid-key',
      runnerFn: mockRunner,
      fetchFn: mockFetch
    });

    const result = await adapter.generate({
      request_id: 'req_fal_test',
      prompt: 'Photorealistic tropical Indonesian courtyard in daylight',
      aspect_ratio: '1315:660',
      purpose: 'canary'
    });

    assert.equal(result.provider, 'fal');
    assert.equal(result.model, DEFAULT_FAL_MODEL);
    assert.equal(result.provider_request_id, 'fal_req_canary_mock_999');
    assert.equal(result.mime_type, 'image/png');
    assert.equal(result.width, 1312);
    assert.equal(result.height, 672);
    assert.equal(result.byte_size, pngBuf.length);
    assert.equal(result.sha256, expectedSha256);
    assert.equal(result.delivery_type, 'URL');
    assert.equal(result.provider_url, mockImageUrl);
    assert.ok(result.image_bytes instanceof Uint8Array);
    assert.equal(result.image_bytes.length, pngBuf.length);
    assert.equal(result.cost_metadata?.estimated_cost_usd, 0.025);

    console.log('  PASS: Canonical ImageGenerationResult normalized from fal hosted URL to verified bytes');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 3: Secret Redaction & Key Protection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Secret Redaction & Credential Safety ---');
  {
    const secretKey = 'fal-prod-super-secret-key-999888777';

    const mockFailingRunner = async () => {
      const err = new Error(`Connection failed with key ${secretKey}`);
      err.status = 401;
      throw err;
    };

    const adapter = new FalImageProviderAdapter({
      apiKey: secretKey,
      runnerFn: mockFailingRunner
    });

    try {
      await adapter.generate({ request_id: 'r_sec', prompt: 'test', purpose: 'canary' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof ImageProviderError);
      assert.equal(err.code, 'AUTH_ERROR');
      const serialized = JSON.stringify(err);
      assert.equal(serialized.includes(secretKey), false, 'Secret key must never leak into serialized error');
      assert.equal(err.message.includes(secretKey), false, 'Secret key must not appear in error message');
      assert.ok(err.message.includes('[REDACTED_FAL_KEY]'));
    }

    // Missing key fails closed
    const noKeyAdapter = new FalImageProviderAdapter({ apiKey: '' });
    await assert.rejects(
      async () => noKeyAdapter.generate({ request_id: 'r_nokey', prompt: 'test', purpose: 'canary' }),
      (err) => err.code === 'AUTH_ERROR' && !err.isBillable
    );

    console.log('  PASS: Secret completely redacted from error objects and missing key fails closed');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 4: Deterministic Prompt Hashing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Deterministic Prompt Hashing ---');
  {
    const prompt1 = 'Contemporary tropical Indonesian residential courtyard in natural daylight';
    const prompt2 = '  Contemporary   tropical  Indonesian residential courtyard  in natural daylight  \n';

    const hash1 = await computePromptSha256(prompt1);
    const hash2 = await computePromptSha256(prompt2);

    assert.equal(hash1.length, 64, 'SHA-256 must be 64 hex characters');
    assert.equal(hash1, hash2, 'Normalized whitespace must produce identical hash');

    const diffHash = await computePromptSha256('Different prompt text');
    assert.notEqual(hash1, diffHash, 'Different prompt must produce distinct hash');

    console.log(`  PASS: Deterministic prompt hash verified (${hash1.slice(0, 16)}...)`);
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 5: Image Binary Validation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Image Binary Validation ---');
  {
    const png = createSyntheticPng(1312, 672);
    const meta = await validateImageBinary(png, 'fal');
    assert.equal(meta.mimeType, 'image/png');
    assert.equal(meta.width, 1312);
    assert.equal(meta.height, 672);
    assert.equal(meta.byteSize, png.length);

    // Corrupt payload rejected
    const htmlPayload = Buffer.from('<html><body>Error 502 Bad Gateway</body></html>');
    await assert.rejects(
      async () => validateImageBinary(htmlPayload, 'fal'),
      (err) => err.code === 'INVALID_RESPONSE'
    );

    console.log('  PASS: Binary validation rejects non-images and validates dimensions');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 6: Provider Error Classification
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Provider Error Classification ---');
  {
    const makeAdapterWithError = (status, message) => {
      return new FalImageProviderAdapter({
        apiKey: 'test-key',
        runnerFn: async () => {
          const err = new Error(message);
          err.status = status;
          throw err;
        }
      });
    };

    // 401 -> AUTH_ERROR
    await assert.rejects(
      async () => makeAdapterWithError(401, 'Unauthorized').generate({ request_id: '1', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'AUTH_ERROR' && err.httpStatus === 401
    );

    // 429 -> RATE_LIMIT
    await assert.rejects(
      async () => makeAdapterWithError(429, 'Too many requests').generate({ request_id: '2', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'RATE_LIMIT' && err.httpStatus === 429
    );

    // 500 -> PROVIDER_5XX
    await assert.rejects(
      async () => makeAdapterWithError(500, 'Internal server error').generate({ request_id: '3', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'PROVIDER_5XX' && err.httpStatus === 500
    );

    // NSFW / Safety -> CONTENT_POLICY_BLOCK
    await assert.rejects(
      async () => makeAdapterWithError(400, 'Content safety policy violation detected').generate({ request_id: '4', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'CONTENT_POLICY_BLOCK'
    );

    // Download failure
    const dlFailAdapter = new FalImageProviderAdapter({
      apiKey: 'test-key',
      runnerFn: async () => ({
        data: { images: [{ url: 'https://v3.fal.media/broken.png' }] }
      }),
      fetchFn: async () => new Response('Not Found', { status: 404, statusText: 'Not Found' })
    });

    await assert.rejects(
      async () => dlFailAdapter.generate({ request_id: '5', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'DOWNLOAD_FAILURE' && err.isBillable === true
    );

    console.log('  PASS: Error classification handles AUTH_ERROR, RATE_LIMIT, 5XX, CONTENT_POLICY_BLOCK, DOWNLOAD_FAILURE');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 7: Hard One-Call Canary Guard with Fal Adapter
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Hard One-Call Canary Guard ---');
  {
    const pngBuf = createSyntheticPng(1312, 672);
    let runnerCallCount = 0;

    const mockRunner = async () => {
      runnerCallCount++;
      return {
        data: {
          images: [{ url: 'https://v3.fal.media/canary.png' }]
        },
        requestId: 'fal_req_guard_1'
      };
    };

    const mockFetch = async () => new Response(pngBuf, {
      status: 200,
      headers: { 'Content-Type': 'image/png' }
    });

    const adapter = new FalImageProviderAdapter({
      apiKey: 'test-key',
      runnerFn: mockRunner,
      fetchFn: mockFetch
    });

    const coordinator = new HeadlessImagePipelineCoordinator(1);
    const tempDir = path.resolve(__dirname, '../scratch-fal-test-canary');

    // Call 1: Succeeded
    const res1 = await coordinator.executeCanary({
      adapter,
      request: { request_id: 'call_1', prompt: 'Canary prompt', purpose: 'canary' },
      outputDirectory: tempDir,
      outputFilename: 'fal-canary-test-1.png'
    });

    assert.equal(coordinator.totalCalls, 1);
    assert.equal(runnerCallCount, 1);
    assert.equal(res1.generationResult.provider, 'fal');
    assert.ok(fs.existsSync(res1.savedFilePath));

    // Call 2: BLOCKED by coordinator
    await assert.rejects(
      async () => coordinator.executeCanary({
        adapter,
        request: { request_id: 'call_2', prompt: 'Second prompt', purpose: 'canary' },
        outputDirectory: tempDir,
        outputFilename: 'fal-canary-test-2.png'
      }),
      (err) => err.message.includes('MAX_PROVIDER_GENERATE_CALLS')
    );

    assert.equal(runnerCallCount, 1, 'Provider runner must NOT be called more than once');

    // Clean up
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    console.log('  PASS: Coordinator strictly enforces 1-call maximum on fal adapter');
    passed++;
  }

  console.log('\n=============================================================');
  console.log(`  ALL ${passed} MEDIA-A1.1 FAL UNIT TESTS PASSED!`);
  console.log('=============================================================\n');
}

runSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
