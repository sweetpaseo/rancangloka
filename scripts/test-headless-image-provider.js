/**
 * RancangLoka — MEDIA-A1 Headless Image Provider Unit Tests
 *
 * Deterministic offline test suite verifying:
 * 1. Provider request mapping (aspect ratio to DALL-E 3 dimensions)
 * 2. Provider response normalization (base64 and URL materialization)
 * 3. Secret redaction and credential safety (no key leaks in provenance, errors, or objects)
 * 4. Deterministic prompt hashing
 * 5. Image binary validation (magic bytes, dimension parsing, HTML payload rejection)
 * 6. Provider error classification (AUTH_ERROR, RATE_LIMIT, TIMEOUT, 5XX, CONTENT_POLICY_BLOCK, INVALID_RESPONSE)
 * 7. Hard one-call canary guard
 *
 * NO PAID OR LIVE NETWORK CALLS ARE MADE IN THIS SUITE.
 */

import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OpenAiImageAdapter,
  OPENAI_IMAGES_ENDPOINT
} from '../src/lib/media/openai-image-adapter.ts';
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
function createSyntheticPng(width = 1792, height = 1024) {
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
  console.log('  RancangLoka — MEDIA-A1 Headless Provider Unit Test Suite');
  console.log('=============================================================\n');

  let passed = 0;

  // -------------------------------------------------------------------------
  // TEST 1: Provider Request Mapping
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Provider Request Mapping ---');
  {
    const adapter = new OpenAiImageAdapter({ apiKey: 'mock-key-not-real' });

    assert.equal(adapter.resolveSize({ request_id: 'r1', prompt: 'test', purpose: 'canary', aspect_ratio: '1315:660' }), '1792x1024');
    assert.equal(adapter.resolveSize({ request_id: 'r2', prompt: 'test', purpose: 'canary', aspect_ratio: 'landscape' }), '1792x1024');
    assert.equal(adapter.resolveSize({ request_id: 'r3', prompt: 'test', purpose: 'canary', aspect_ratio: '16:9' }), '1792x1024');
    assert.equal(adapter.resolveSize({ request_id: 'r4', prompt: 'test', purpose: 'canary', aspect_ratio: 'portrait' }), '1024x1792');
    assert.equal(adapter.resolveSize({ request_id: 'r5', prompt: 'test', purpose: 'canary', aspect_ratio: '1:1' }), '1024x1024');

    console.log('  PASS: Aspect ratio mapping to OpenAI sizes (1792x1024 / 1024x1792 / 1024x1024)');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Provider Response Normalization (Base64)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Provider Response Normalization ---');
  {
    const pngBuf = createSyntheticPng(1792, 1024);
    const b64 = pngBuf.toString('base64');
    const expectedSha256 = await computeBinarySha256(pngBuf);

    const mockFetch = async (url, init) => {
      assert.equal(url, OPENAI_IMAGES_ENDPOINT);
      assert.equal(init.method, 'POST');
      assert.ok(init.headers.Authorization.startsWith('Bearer '));
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'dall-e-3');
      assert.equal(body.response_format, 'b64_json');
      assert.equal(body.size, '1792x1024');

      return new Response(JSON.stringify({
        created: 1727211600,
        data: [{
          b64_json: b64,
          revised_prompt: 'High-end architectural photograph of Indonesian courtyard...'
        }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'x-request-id': 'req_mock_12345' }
      });
    };

    const adapter = new OpenAiImageAdapter({ apiKey: 'sk-mock-valid-key-testing', fetchFn: mockFetch });
    const result = await adapter.generate({
      request_id: 'req_canary_test',
      prompt: 'Photorealistic tropical Indonesian residential interior',
      aspect_ratio: '1315:660',
      purpose: 'canary'
    });

    assert.equal(result.provider, 'openai');
    assert.equal(result.model, 'dall-e-3');
    assert.equal(result.provider_request_id, 'req_mock_12345');
    assert.equal(result.mime_type, 'image/png');
    assert.equal(result.width, 1792);
    assert.equal(result.height, 1024);
    assert.equal(result.byte_size, pngBuf.length);
    assert.equal(result.sha256, expectedSha256);
    assert.equal(result.delivery_type, 'BASE64');
    assert.ok(result.latency_ms >= 0);
    assert.ok(result.revised_prompt.includes('Indonesian courtyard'));
    assert.equal(result.cost_metadata?.estimated_cost_usd, 0.04);

    console.log('  PASS: Canonical ImageGenerationResult normalized with verified bytes and dimensions');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 3: Secret Redaction & Protection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Secret Redaction & Protection ---');
  {
    const secretKey = 'sk-extremely-sensitive-production-token-12345';
    let interceptedAuth = '';

    const mockFetch = async (url, init) => {
      interceptedAuth = init.headers.Authorization;
      return new Response(JSON.stringify({
        error: { message: 'Some provider error mentioning key or auth issue', type: 'invalid_request_error' }
      }), { status: 400 });
    };

    const adapter = new OpenAiImageAdapter({ apiKey: secretKey, fetchFn: mockFetch });

    try {
      await adapter.generate({ request_id: 'r_sec', prompt: 'test', purpose: 'canary' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof ImageProviderError);
      // Verify secret is NOT in error message or error details
      const serialized = JSON.stringify(err);
      assert.equal(serialized.includes(secretKey), false, 'Secret must never appear in serialized error');
      assert.equal(err.message.includes(secretKey), false, 'Secret must not appear in err.message');
    }

    assert.equal(interceptedAuth, `Bearer ${secretKey}`);

    // Missing key fails closed with AUTH_ERROR
    const noKeyAdapter = new OpenAiImageAdapter({ apiKey: '', fetchFn: mockFetch });
    await assert.rejects(
      async () => noKeyAdapter.generate({ request_id: 'r_nokey', prompt: 'test', purpose: 'canary' }),
      (err) => err.code === 'AUTH_ERROR' && !err.isBillable
    );

    console.log('  PASS: Secret completely absent from errors and objects; auth guard fails closed');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 4: Deterministic Prompt Hashing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Deterministic Prompt Hashing ---');
  {
    const prompt1 = 'Contemporary tropical Indonesian house with natural daylight';
    const prompt2 = '  Contemporary   tropical  Indonesian house  with natural daylight  \n';

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
    // Valid PNG
    const png = createSyntheticPng(800, 600);
    const pngMeta = await validateImageBinary(png, 'test');
    assert.equal(pngMeta.mimeType, 'image/png');
    assert.equal(pngMeta.width, 800);
    assert.equal(pngMeta.height, 600);
    assert.equal(pngMeta.byteSize, png.length);

    // Empty / short bytes rejected
    await assert.rejects(
      async () => validateImageBinary(Buffer.alloc(8), 'test'),
      (err) => err.code === 'INVALID_RESPONSE'
    );

    // HTML error masquerading as image rejected
    const htmlPayload = Buffer.from('<!DOCTYPE html><html><body>Error 503</body></html>');
    await assert.rejects(
      async () => validateImageBinary(htmlPayload, 'test'),
      (err) => err.code === 'INVALID_RESPONSE' && err.message.includes('HTML')
    );

    // Random non-image binary rejected
    const randomGarbage = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]);
    await assert.rejects(
      async () => validateImageBinary(randomGarbage, 'test'),
      (err) => err.code === 'INVALID_RESPONSE' && err.message.includes('Unrecognized')
    );

    console.log('  PASS: Magic bytes, dimension extraction, and malicious payload guards verified');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 6: Typed Error Model Classification
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Typed Error Model Classification ---');
  {
    const makeAdapterWithStatus = (status, body) => new OpenAiImageAdapter({
      apiKey: 'mock-key',
      fetchFn: async () => new Response(JSON.stringify(body), { status })
    });

    // 401 -> AUTH_ERROR
    await assert.rejects(
      async () => makeAdapterWithStatus(401, { error: { message: 'Invalid API key' } }).generate({ request_id: '1', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'AUTH_ERROR' && err.httpStatus === 401
    );

    // 429 -> RATE_LIMIT
    await assert.rejects(
      async () => makeAdapterWithStatus(429, { error: { message: 'Rate limit exceeded' } }).generate({ request_id: '2', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'RATE_LIMIT' && err.httpStatus === 429
    );

    // 400 content policy -> CONTENT_POLICY_BLOCK
    await assert.rejects(
      async () => makeAdapterWithStatus(400, { error: { message: 'Safety system violation', code: 'content_policy_violation' } }).generate({ request_id: '3', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'CONTENT_POLICY_BLOCK' && err.httpStatus === 400
    );

    // 500 -> PROVIDER_5XX
    await assert.rejects(
      async () => makeAdapterWithStatus(500, { error: { message: 'Internal server error' } }).generate({ request_id: '4', prompt: 'p', purpose: 'c' }),
      (err) => err.code === 'PROVIDER_5XX' && err.httpStatus === 500
    );

    // Timeout
    const timeoutAdapter = new OpenAiImageAdapter({
      apiKey: 'mock-key',
      timeoutMs: 10,
      fetchFn: async (_url, init) => {
        return new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }
    });

    await assert.rejects(
      async () => timeoutAdapter.generate({ request_id: '5', prompt: 'p', purpose: 'c', timeout_ms: 20 }),
      (err) => err.code === 'TIMEOUT'
    );

    console.log('  PASS: Typed error classification for AUTH_ERROR, RATE_LIMIT, CONTENT_POLICY_BLOCK, 5XX, TIMEOUT');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 7: Hard One-Call Canary Guard
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Hard One-Call Canary Guard ---');
  {
    const pngBuf = createSyntheticPng(400, 300);
    const b64 = pngBuf.toString('base64');
    let callCounter = 0;

    const mockAdapter = {
      providerName: 'mock-guarded',
      async generate() {
        callCounter++;
        return {
          provider: 'mock-guarded',
          model: 'test-model',
          created_at: new Date().toISOString(),
          latency_ms: 50,
          mime_type: 'image/png',
          width: 400,
          height: 300,
          byte_size: pngBuf.length,
          sha256: await computeBinarySha256(pngBuf),
          delivery_type: 'BASE64',
          image_bytes: new Uint8Array(pngBuf)
        };
      }
    };

    const tempDir = path.resolve(__dirname, '../scratch-test-canary-dir');
    const coordinator = new HeadlessImagePipelineCoordinator(1);

    // Call 1: Must succeed
    const res1 = await coordinator.executeCanary({
      adapter: mockAdapter,
      request: { request_id: 'call_1', prompt: 'Canary test prompt', purpose: 'canary' },
      outputDirectory: tempDir,
      outputFilename: 'canary-test-1.png'
    });

    assert.equal(coordinator.totalCalls, 1);
    assert.equal(callCounter, 1);
    assert.ok(fs.existsSync(res1.savedFilePath));
    assert.equal(res1.provenance.provider, 'mock-guarded');
    assert.ok(res1.mediaA2Contract.image_path);

    // Call 2: Must be BLOCKED by coordinator without calling adapter
    await assert.rejects(
      async () => coordinator.executeCanary({
        adapter: mockAdapter,
        request: { request_id: 'call_2', prompt: 'Second attempt prompt', purpose: 'canary' },
        outputDirectory: tempDir,
        outputFilename: 'canary-test-2.png'
      }),
      (err) => err.message.includes('MAX_PROVIDER_GENERATE_CALLS')
    );

    assert.equal(callCounter, 1, 'Adapter must NOT have been called a second time');
    assert.equal(coordinator.totalCalls, 1);

    // Clean up temporary test file and dir
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    console.log('  PASS: Hard one-call guard blocks subsequent billable generation calls');
    passed++;
  }

  console.log('\n=============================================================');
  console.log(`  ALL ${passed} MEDIA-A1 UNIT TESTS PASSED!`);
  console.log('=============================================================\n');
}

runSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
