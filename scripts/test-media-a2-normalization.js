/**
 * RancangLoka — MEDIA-A2 Provider-Neutral Image Artifact Normalization & Validation Unit Tests
 *
 * Deterministic offline test suite verifying:
 * 1. Headless ImageGenerationResult normalization
 * 2. ChatGPT / LokaMedia browser bridge normalization
 * 3. Local fixture normalization & real canary run
 * 4. Image binary validation (PNG, JPEG, WebP)
 * 5. MIME consistency validation & anti-spoofing
 * 6. Dimension extraction & dimension consistency anti-spoofing
 * 7. SHA-256 deterministic content hashing
 * 8. Artifact identity semantics (art_${sha256.substring(0, 24)})
 * 9. Provenance normalization
 * 10. Secret / privacy firewall (FAL_KEY, Authorization, Cookies, Session Tokens, sensitive URLs)
 * 11. Malicious / invalid HTML error payload rejection
 * 12. Malicious / invalid JSON error payload rejection
 * 13. Empty / truncated bytes rejection
 * 14. MEDIA-A3 downstream handoff contract creation
 *
 * NO PAID OR LIVE NETWORK CALLS ARE MADE IN THIS SUITE.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MediaArtifactError,
  ARTIFACT_IDENTITY_RULE,
  computeArtifactId,
  createMediaA3Contract,
  normalizeHeadlessResult,
  normalizeChatGptBridgeResult,
  normalizeLocalFixture,
  validateArtifactBinary,
  sanitizeProvenance,
  sanitizeUrl
} from '../src/lib/media/generated-image-artifact.ts';
import {
  computeBinarySha256
} from '../src/lib/media/image-validation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Synthesizes a valid minimal 1x1 PNG binary
function createMinimalPngBytes() {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d,                         // IHDR length: 13
    0x49, 0x44, 0x48, 0x52,                         // "IHDR"
    0x00, 0x00, 0x00, 0x01,                         // width: 1
    0x00, 0x00, 0x00, 0x01,                         // height: 1
    0x08, 0x06, 0x00, 0x00, 0x00,                   // 8-bit RGBA
    0x1f, 0x15, 0xc4, 0x89,                         // CRC
    0x00, 0x00, 0x00, 0x0a,                         // IDAT length: 10
    0x49, 0x44, 0x41, 0x54,                         // "IDAT"
    0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
    0x0d, 0x0a, 0x2d, 0xb4,                         // CRC
    0x00, 0x00, 0x00, 0x00,                         // IEND length: 0
    0x49, 0x45, 0x4e, 0x44,                         // "IEND"
    0xae, 0x42, 0x60, 0x82                          // CRC
  ]);
}

// Helper: Synthesizes a valid minimal 2x2 JPEG binary
function createMinimalJpegBytes() {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0,                         // SOI, APP0
    0x00, 0x10,                                     // length 16
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, // "JFIF"
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0,                                     // SOF0
    0x00, 0x11,                                     // length 17
    0x08,                                           // precision 8
    0x00, 0x02,                                     // height: 2
    0x00, 0x02,                                     // width: 2
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9                                      // EOI
  ]);
}

async function runTestSuite() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A2 Artifact Normalization Test Suite');
  console.log('=============================================================\n');

  let passed = 0;

  // -------------------------------------------------------------------------
  // TEST 1: Headless ImageGenerationResult Normalization
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Headless ImageGenerationResult Normalization ---');
  {
    const pngBytes = createMinimalPngBytes();
    const sha = await computeBinarySha256(pngBytes);

    const headlessResult = {
      provider: 'fal',
      model: 'fal-ai/flux/dev',
      provider_request_id: 'fal_req_test_123',
      created_at: '2026-09-25T10:00:00.000Z',
      latency_ms: 1250,
      mime_type: 'image/png',
      width: 1,
      height: 1,
      byte_size: pngBytes.byteLength,
      sha256: sha,
      delivery_type: 'URL',
      image_bytes: pngBytes,
      provider_url: 'https://fal.media/files/monkey/test.png',
      revised_prompt: 'Sanitized architectural visual'
    };

    const artifact = await normalizeHeadlessResult(headlessResult, {
      prompt_hash: 'ph_test_456',
      purpose: 'canary',
      media_role: 'featured'
    });

    assert.equal(artifact.source_type, 'fal_api', 'source_type must be fal_api');
    assert.equal(artifact.provider, 'fal', 'provider must be fal');
    assert.equal(artifact.model, 'fal-ai/flux/dev', 'model must match');
    assert.equal(artifact.artifact_id, `art_${sha.substring(0, 24)}`, 'artifact_id must follow rule');
    assert.equal(artifact.width, 1, 'width must match');
    assert.equal(artifact.height, 1, 'height must match');
    assert.equal(artifact.mime_type, 'image/png', 'mime must be image/png');
    assert.equal(artifact.sha256, sha, 'sha256 must match binary');
    assert.equal(artifact.provenance.source_type, 'fal_api', 'provenance source_type must match');
    assert.equal(artifact.provenance.capture_method, 'API_DIRECT', 'capture method must be API_DIRECT');

    console.log('  PASS: Headless result successfully normalized into GeneratedImageArtifact');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 2: ChatGPT / LokaMedia Bridge Normalization
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: ChatGPT / LokaMedia Bridge Normalization ---');
  {
    const pngBytes = createMinimalPngBytes();
    const sha = await computeBinarySha256(pngBytes);

    const bridgeResult = {
      bytes: pngBytes,
      size: pngBytes.byteLength,
      mime: 'image/png',
      width: 1,
      height: 1,
      sha256: sha,
      blobKey: 'mjob_chatgpt_789:1',
      provenance: 'PROVIDER_BINARY',
      is_canonical_original: true,
      provider_conversation_id: 'conv_123',
      provider_response_id: 'resp_456'
    };

    const job = {
      job_id: 'mjob_chatgpt_789',
      prompt_hash: 'ph_chatgpt_abc',
      prompt_version: 1,
      slot_key: 'featured',
      purpose: 'editorial'
    };

    const artifact = await normalizeChatGptBridgeResult(bridgeResult, { job });

    assert.equal(artifact.source_type, 'chatgpt_browser_bridge', 'source_type must be chatgpt_browser_bridge');
    assert.equal(artifact.provider, 'chatgpt', 'provider must be chatgpt');
    assert.equal(artifact.artifact_id, `art_${sha.substring(0, 24)}`, 'artifact_id must match content address');
    assert.equal(artifact.provenance.capture_method, 'PROVIDER_BINARY', 'capture_method must be preserved');
    assert.equal(artifact.provenance.is_canonical_original, true, 'is_canonical_original must be preserved');
    assert.equal(artifact.provenance.source_type, 'chatgpt_browser_bridge');

    // Also test data_url representation
    const base64 = Buffer.from(pngBytes).toString('base64');
    const dataUrlResult = {
      data_url: `data:image/png;base64,${base64}`,
      mime: 'image/png',
      width: 1,
      height: 1,
      sha256: sha,
      blobKey: 'mjob_dataurl_1:1'
    };
    const artifactFromDataUrl = await normalizeChatGptBridgeResult(dataUrlResult, { job });
    assert.equal(artifactFromDataUrl.sha256, sha, 'Data URL bytes must match exact sha256');

    console.log('  PASS: ChatGPT bridge capture normalized with source_type=chatgpt_browser_bridge');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 3: Local Fixture Normalization & Real Internal Canary
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Local Fixture Normalization & Canary ---');
  {
    const fixturePath = path.resolve(__dirname, '../public/stitch-homepage.png');
    assert(fs.existsSync(fixturePath), 'Project fixture public/stitch-homepage.png must exist');

    const artifact = await normalizeLocalFixture({
      filePath: fixturePath,
      media_role: 'featured',
      purpose: 'canary'
    });

    assert.equal(artifact.source_type, 'local_fixture');
    assert.equal(artifact.provider, 'local_fixture');
    assert.equal(artifact.mime_type, 'image/png');
    assert.equal(artifact.width, 169);
    assert.equal(artifact.height, 512);
    assert.equal(artifact.byte_size, 58941);
    assert.equal(artifact.sha256, '92eca8e32eb2f0f4e176054d82ce8830faf103044ddb75f59f778e204763676d');
    assert.equal(artifact.artifact_id, 'art_92eca8e32eb2f0f4e176054d');

    console.log('  PASS: Real project image fixture normalized into GeneratedImageArtifact');
    console.log(`        Artifact ID: ${artifact.artifact_id}, Dimensions: ${artifact.width}x${artifact.height}`);
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 4: Binary Magic Byte Validation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Binary Magic Byte Validation ---');
  {
    const png = createMinimalPngBytes();
    const vPng = await validateArtifactBinary(png);
    assert.equal(vPng.mimeType, 'image/png');

    const jpeg = createMinimalJpegBytes();
    const vJpeg = await validateArtifactBinary(jpeg);
    assert.equal(vJpeg.mimeType, 'image/jpeg');

    // Unknown random bytes
    const randomBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]);
    await assert.rejects(
      async () => validateArtifactBinary(randomBytes),
      (err) => err instanceof MediaArtifactError && err.code === 'INVALID_IMAGE_SIGNATURE',
      'Random bytes must fail with INVALID_IMAGE_SIGNATURE'
    );

    console.log('  PASS: Magic byte validation strictly enforced');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 5: MIME Validation & Anti-Spoofing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: MIME Validation & Anti-Spoofing ---');
  {
    const pngBytes = createMinimalPngBytes();

    // Declaring JPEG when bytes are PNG must fail
    await assert.rejects(
      async () => validateArtifactBinary(pngBytes, { declaredMime: 'image/jpeg' }),
      (err) => err instanceof MediaArtifactError && err.code === 'UNSUPPORTED_MIME',
      'Spoofed MIME must be rejected'
    );

    // Matching MIME must pass
    const valid = await validateArtifactBinary(pngBytes, { declaredMime: 'image/png' });
    assert.equal(valid.mimeType, 'image/png');

    console.log('  PASS: MIME validation catches spoofing attempts');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 6: Dimension Extraction & Anti-Spoofing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Dimension Extraction & Anti-Spoofing ---');
  {
    const pngBytes = createMinimalPngBytes(); // actual is 1x1

    // Declaring 1920x1080 when bytes are 1x1 must fail
    await assert.rejects(
      async () => validateArtifactBinary(pngBytes, { declaredWidth: 1920, declaredHeight: 1080 }),
      (err) => err instanceof MediaArtifactError && err.code === 'DIMENSION_INVALID',
      'Spoofed dimensions must be rejected'
    );

    // Accurate dimensions must pass
    const valid = await validateArtifactBinary(pngBytes, { declaredWidth: 1, declaredHeight: 1 });
    assert.equal(valid.width, 1);
    assert.equal(valid.height, 1);

    console.log('  PASS: Dimension verification catches spoofing attempts');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 7: Deterministic SHA-256 Content Hashing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Deterministic SHA-256 Content Hashing ---');
  {
    const pngBytes = createMinimalPngBytes();
    const sha1 = await computeBinarySha256(pngBytes);
    const sha2 = await computeBinarySha256(pngBytes);
    assert.equal(sha1, sha2, 'Same bytes must produce exact same SHA-256');

    // SHA-256 mismatch declared vs computed
    await assert.rejects(
      async () => validateArtifactBinary(pngBytes, { declaredSha256: '0000000000000000000000000000000000000000000000000000000000000000' }),
      (err) => err instanceof MediaArtifactError && err.code === 'HASH_FAILURE',
      'SHA-256 mismatch must fail with HASH_FAILURE'
    );

    console.log('  PASS: SHA-256 is deterministic and verified against declared hashes');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 8: Artifact Identity Semantics
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Artifact Identity Semantics ---');
  {
    const pngBytes = createMinimalPngBytes();
    const jpegBytes = createMinimalJpegBytes();

    const shaPng = await computeBinarySha256(pngBytes);
    const shaJpeg = await computeBinarySha256(jpegBytes);

    const idPng1 = computeArtifactId(shaPng);
    const idPng2 = computeArtifactId(shaPng);
    const idJpeg = computeArtifactId(shaJpeg);

    assert.equal(idPng1, idPng2, 'Identical bytes must produce identical artifact ID');
    assert.notEqual(idPng1, idJpeg, 'Different bytes must produce different artifact IDs');
    assert(idPng1.startsWith('art_'), 'Artifact ID must start with art_ prefix');
    assert.equal(idPng1.length, 28, 'art_ (4 chars) + 24 hex chars = 28 total chars');

    console.log(`  PASS: Artifact identity rule enforced (${ARTIFACT_IDENTITY_RULE})`);
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 9: Provenance Normalization
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Provenance Normalization ---');
  {
    const rawProv = {
      source_type: 'chatgpt_browser_bridge',
      provider: 'chatgpt',
      model: 'gpt-4o',
      request_id: 'req_norm_123',
      prompt_hash: 'ph_hash_999',
      prompt_version: 1,
      capture_method: 'PROVIDER_BINARY',
      created_at: '2026-09-25T12:00:00.000Z',
      width: 1024,
      height: 768,
      mime: 'image/png',
      byte_size: 2048,
      sha256: 'abc123sha',
      adapter_version: '0.1.0',
      is_canonical_original: true
    };

    const normalized = sanitizeProvenance(rawProv);
    assert.equal(normalized.source_type, 'chatgpt_browser_bridge');
    assert.equal(normalized.provider, 'chatgpt');
    assert.equal(normalized.adapter_version, '0.1.0');
    assert.equal(normalized.capture_method, 'PROVIDER_BINARY');
    assert.equal(normalized.is_canonical_original, true);

    console.log('  PASS: Provenance normalized with standard fields across providers');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 10: Secret / Privacy Firewall
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 10: Secret / Privacy Firewall ---');
  {
    const dirtyProvenance = {
      source_type: 'fal_api',
      provider: 'fal',
      model: 'fal-ai/flux/dev',
      FAL_KEY: 'fal_super_secret_key_123',
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
      cookies: ['session_id=fake_session', 'cf_clearance=fake_clearance'],
      session_token: 'chatgpt_oauth_token_secret',
      access_token: 'oauth2_token',
      api_key: 'my_provider_key',
      sensitive_url: 'https://fal.media/files/render.png?token=secret_token&sig=abc12345',
      slot_key: 'featured', // safe whitelisted key
      blobKey: 'mjob_1:1',   // safe whitelisted key
      byte_size: 1024,
      width: 1312,
      height: 656
    };

    const sanitized = sanitizeProvenance(dirtyProvenance);

    // Verify all secrets are removed or redacted
    assert.equal(sanitized.FAL_KEY, undefined, 'FAL_KEY must be completely removed');
    assert.equal(sanitized.authorization, undefined, 'authorization must be removed');
    assert.equal(sanitized.cookies, undefined, 'cookies must be removed');
    assert.equal(sanitized.session_token, undefined, 'session_token must be removed');
    assert.equal(sanitized.access_token, undefined, 'access_token must be removed');
    assert.equal(sanitized.api_key, undefined, 'api_key must be removed');

    // Verify safe whitelisted keys are preserved
    assert.equal(sanitized.slot_key, 'featured', 'slot_key must be preserved');
    assert.equal(sanitized.blobKey, 'mjob_1:1', 'blobKey must be preserved');

    // Verify URL query params are sanitized
    assert(sanitized.sensitive_url.includes('REDACTED'), 'URL secrets must be redacted');
    assert(!sanitized.sensitive_url.includes('secret_token'), 'URL must not contain raw secret token');

    console.log('  PASS: Secret firewall completely cleans sensitive headers, cookies, and tokens');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 11: Malicious / Invalid HTML Error Payload Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 11: Invalid HTML Error Payload Rejection ---');
  {
    const htmlPayload = Buffer.from('<!DOCTYPE html><html><body>502 Bad Gateway</body></html>');
    await assert.rejects(
      async () => validateArtifactBinary(htmlPayload),
      (err) => err instanceof MediaArtifactError && err.code === 'INVALID_IMAGE_SIGNATURE',
      'HTML payload must fail with INVALID_IMAGE_SIGNATURE'
    );

    console.log('  PASS: HTML payload masquerading as image is rejected');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 12: Malicious / Invalid JSON Error Payload Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 12: Invalid JSON Error Payload Rejection ---');
  {
    const jsonPayload = Buffer.from('{"error": {"code": 500, "message": "Internal Server Error"}}');
    await assert.rejects(
      async () => validateArtifactBinary(jsonPayload),
      (err) => err instanceof MediaArtifactError && err.code === 'INVALID_IMAGE_SIGNATURE',
      'JSON error payload must fail with INVALID_IMAGE_SIGNATURE'
    );

    console.log('  PASS: JSON error payload masquerading as image is rejected');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 13: Empty & Truncated Bytes Rejection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 13: Empty & Truncated Bytes Rejection ---');
  {
    await assert.rejects(
      async () => validateArtifactBinary(new Uint8Array(0)),
      (err) => err instanceof MediaArtifactError && err.code === 'EMPTY_IMAGE',
      '0-byte buffer must fail with EMPTY_IMAGE'
    );

    await assert.rejects(
      async () => validateArtifactBinary(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
      (err) => err instanceof MediaArtifactError && err.code === 'INVALID_IMAGE_SIGNATURE',
      'Truncated header must fail with INVALID_IMAGE_SIGNATURE'
    );

    console.log('  PASS: Empty and truncated byte streams fail closed');
    passed++;
  }

  // -------------------------------------------------------------------------
  // TEST 14: Downstream MEDIA-A3 Input Contract Creation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 14: MEDIA-A3 Input Contract Creation ---');
  {
    const pngBytes = createMinimalPngBytes();
    const sha = await computeBinarySha256(pngBytes);
    const artifact = {
      artifact_id: `art_${sha.substring(0, 24)}`,
      source_type: 'fal_api',
      provider: 'fal',
      model: 'fal-ai/flux/dev',
      image_bytes: pngBytes,
      mime_type: 'image/png',
      width: 1,
      height: 1,
      byte_size: pngBytes.byteLength,
      sha256: sha,
      media_role: 'featured',
      purpose: 'canary',
      created_at: new Date().toISOString(),
      provenance: {
        source_type: 'fal_api',
        provider: 'fal',
        model: 'fal-ai/flux/dev',
        created_at: new Date().toISOString(),
        width: 1,
        height: 1,
        mime: 'image/png',
        byte_size: pngBytes.byteLength,
        sha256: sha
      }
    };

    const a3Contract = createMediaA3Contract(artifact);
    assert.equal(a3Contract.artifact_id, artifact.artifact_id);
    assert.equal(a3Contract.source_type, 'fal_api');
    assert.equal(a3Contract.provider, 'fal');
    assert.equal(a3Contract.width, 1);
    assert.equal(a3Contract.height, 1);
    assert.equal(a3Contract.sha256, sha);
    assert(a3Contract.image_bytes instanceof Uint8Array);

    console.log('  PASS: MEDIA-A3 contract successfully formed from GeneratedImageArtifact');
    passed++;
  }

  console.log('\n=============================================================');
  console.log(`  ALL ${passed} MEDIA-A2 ARTIFACT NORMALIZATION TESTS PASSED!`);
  console.log('=============================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ MEDIA-A2 Test Suite Failed:', err);
  process.exit(1);
});
