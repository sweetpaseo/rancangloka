/**
 * RancangLoka — LokaMedia Phase 5D3A Watermark Engine Test Suite
 *
 * Deterministic test coverage:
 * 1. TRANSFORM_ID_IDEMPOTENCY
 * 2. DOUBLE_WATERMARK_GUARD
 * 3. SOURCE_BLOB_IMMUTABLE
 * 4. OUTPUT_DIMENSIONS_PRESERVED
 * 5. LANDSCAPE_TEXT_RENDER_TEST
 * 6. PORTRAIT_TEXT_RENDER_TEST
 * 7. SMALL_IMAGE_BOUNDARY_TEST
 * 8. TRANSPARENT_IMAGE_WATERMARK_TEST
 * 9. OPAQUE_WATERMARK_DETECTION_TEST
 * 10. INVALID_CONFIG_TESTS
 * 11. WATERMARK_DISABLED_NOOP
 * 12. LIVE_FIXTURE_READ_ONLY_TRANSFORM
 * 13. PNG_TO_WEBP_NORMALIZER_STATUS
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import {
  WATERMARK_ENGINE_VERSION,
  DEFAULT_WATERMARK_VERSION,
  DEFAULT_WATERMARK_CONFIG,
  WATERMARK_TYPES,
  WATERMARK_POSITIONS,
  CONFIG_BOUNDS,
  normalizeWatermarkConfig,
  computeCanonicalConfigString,
  computeSha256,
  computeTransformId,
  assertSourceEligibleForWatermark,
  calculateWatermarkPlacement,
  calculateTextWatermarkMetrics,
  validateWatermarkImageTransparency,
  normalizeWatermarkAsset,
  transformWatermark
} from '../extensions/lokamedia/src/watermark-engine.js';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

// ---------------------------------------------------------------------------
// CDP HELPER FOR SERVICE WORKER EVALUATION
// ---------------------------------------------------------------------------

async function getSwTarget() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const targets = JSON.parse(data);
          const sw = targets.find(t => t.url.includes('icpmjdnobnlbpbmimfeajcdhbccpmpnn') && t.type === 'service_worker');
          resolve(sw || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.handlers = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      const handler = this.handlers.get(msg.id);
      if (handler) {
        this.handlers.delete(msg.id);
        if (msg.error) handler.reject(msg.error);
        else handler.resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.handlers.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`CDP_EVAL_EXCEPTION: ${res.exceptionDetails.text} - ${JSON.stringify(res.exceptionDetails.exception || {})}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// ---------------------------------------------------------------------------
// TEST RUNNER
// ---------------------------------------------------------------------------

console.log('=== TEST SUITE: PHASE 5D3A WATERMARK ENGINE FOUNDATION ===\n');

// --- TEST 1: Default Config & Guardrails ---
console.log('--- TEST 1: Default Config & Guardrails ---');
const defaultConfig = normalizeWatermarkConfig();
assert.equal(defaultConfig.enabled, true);
assert.equal(defaultConfig.type, 'TEXT');
assert.equal(defaultConfig.text.value, 'rancangloka.com');
assert.equal(defaultConfig.position, 'bottom-right');
assert.equal(defaultConfig.opacity, 0.62);
assert.equal(defaultConfig.text.font_size_ratio, 0.022);
assert.equal(defaultConfig.text.font_weight, 500);
assert.equal(defaultConfig.margin_x_ratio, 0.022);
assert.equal(defaultConfig.margin_y_ratio, 0.028);
pass('DEFAULT_CONFIG_SCHEMA_VERIFIED=PASS');

// --- TEST 2: Deterministic Transform ID & Idempotency ---
console.log('\n--- TEST 2: Transform ID Determinism & Idempotency ---');
const sampleSha = '68641cd3be874524f7a033bc539170f28cee0a609885d93c1f63f7c15ff35813';
const id1 = await computeTransformId({
  sourceSha256: sampleSha,
  normalizedConfig: defaultConfig
});
const id2 = await computeTransformId({
  sourceSha256: sampleSha,
  normalizedConfig: defaultConfig
});
assert.equal(id1, id2, 'Transform IDs must match exactly for identical inputs');
assert.equal(typeof id1, 'string');
assert.equal(id1.length, 64, 'Transform ID must be a 64-character SHA-256 hex string');
pass('DETERMINISTIC_TRANSFORM_ID=YES');
pass('TRANSFORM_ID_IDEMPOTENCY=PASS');

// Different configs must yield different IDs
const alteredConfig = normalizeWatermarkConfig({ opacity: 0.70 });
const idDifferent = await computeTransformId({
  sourceSha256: sampleSha,
  normalizedConfig: alteredConfig
});
assert.notEqual(id1, idDifferent, 'Altered config must produce different transform ID');
pass('TRANSFORM_ID_CONFIG_SENSITIVE=PASS');

// --- TEST 3: Double Watermark Guard ---
console.log('\n--- TEST 3: Double Watermark Guard ---');
// Original master is allowed
assert.equal(assertSourceEligibleForWatermark({ role: 'ORIGINAL' }), true);
assert.equal(assertSourceEligibleForWatermark({ role: 'MASTER' }), true);
assert.equal(assertSourceEligibleForWatermark({ role: 'featured' }), true);

// Already watermarked derivative is rejected
assert.throws(
  () => assertSourceEligibleForWatermark({ role: 'DERIVATIVE' }),
  /DOUBLE_WATERMARK_GUARD_BLOCKED/
);
assert.throws(
  () => assertSourceEligibleForWatermark({ role: 'ORIGINAL', isWatermarked: true }),
  /DOUBLE_WATERMARK_GUARD_BLOCKED/
);
assert.throws(
  () => assertSourceEligibleForWatermark({ role: 'ORIGINAL', transformId: 'some-transform-id' }),
  /DOUBLE_WATERMARK_GUARD_BLOCKED/
);
// Explicit rebuild override allowed if passed in options
assert.equal(
  assertSourceEligibleForWatermark({ role: 'DERIVATIVE', isWatermarked: true }, { allowRebuild: true }),
  true
);
pass('DOUBLE_WATERMARK_GUARD=PASS');

// --- TEST 4: Invalid Config Tests (Fail Closed) ---
console.log('\n--- TEST 4: Invalid Config Tests (Fail Closed) ---');
// Unknown type
assert.throws(() => normalizeWatermarkConfig({ type: 'UNKNOWN' }), /CONFIG_GUARDRAIL_ERROR/);
// Unknown position
assert.throws(() => normalizeWatermarkConfig({ position: 'center' }), /CONFIG_GUARDRAIL_ERROR/);
// Empty text for TEXT
assert.throws(() => normalizeWatermarkConfig({ type: 'TEXT', text: { value: '' } }), /CONFIG_GUARDRAIL_ERROR/);
assert.throws(() => normalizeWatermarkConfig({ type: 'TEXT', text: { value: '   ' } }), /CONFIG_GUARDRAIL_ERROR/);
// Opacity out of bounds (< 0.30 or > 0.90)
assert.throws(() => normalizeWatermarkConfig({ opacity: 0.10 }), /CONFIG_GUARDRAIL_ERROR/);
assert.throws(() => normalizeWatermarkConfig({ opacity: 0.95 }), /CONFIG_GUARDRAIL_ERROR/);
assert.throws(() => normalizeWatermarkConfig({ opacity: 'invalid' }), /CONFIG_GUARDRAIL_ERROR/);
// Font size ratio out of bounds (< 0.012 or > 0.05)
assert.throws(() => normalizeWatermarkConfig({ text: { font_size_ratio: 0.005 } }), /CONFIG_GUARDRAIL_ERROR/);
assert.throws(() => normalizeWatermarkConfig({ text: { font_size_ratio: 0.10 } }), /CONFIG_GUARDRAIL_ERROR/);
// Margin ratios out of bounds (< 0.01 or > 0.08)
assert.throws(() => normalizeWatermarkConfig({ margin_x_ratio: 0.005 }), /CONFIG_GUARDRAIL_ERROR/);
assert.throws(() => normalizeWatermarkConfig({ margin_x_ratio: 0.15 }), /CONFIG_GUARDRAIL_ERROR/);
assert.throws(() => normalizeWatermarkConfig({ margin_y_ratio: 0.005 }), /CONFIG_GUARDRAIL_ERROR/);
assert.throws(() => normalizeWatermarkConfig({ margin_y_ratio: 0.15 }), /CONFIG_GUARDRAIL_ERROR/);
// Image width ratio out of bounds (< 0.05 or > 0.30)
assert.throws(() => normalizeWatermarkConfig({ type: 'IMAGE', image: { width_ratio: 0.02 } }), /CONFIG_GUARDRAIL_ERROR/);
assert.throws(() => normalizeWatermarkConfig({ type: 'IMAGE', image: { width_ratio: 0.50 } }), /CONFIG_GUARDRAIL_ERROR/);
pass('INVALID_CONFIG_TESTS=PASS');

// --- TEST 5: Watermark Disabled NOOP ---
console.log('\n--- TEST 5: Watermark Disabled NOOP ---');
const dummyBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
const noopResult = await transformWatermark({
  sourceBlob: dummyBlob,
  sourceMeta: { width: 1000, height: 800, mime: 'image/png', role: 'ORIGINAL' },
  config: { enabled: false }
});
assert.equal(noopResult.transformed, false);
assert.equal(noopResult.blob, dummyBlob);
assert.equal(noopResult.transformId, null);
assert.equal(noopResult.reason, 'WATERMARK_DISABLED_NOOP');
pass('WATERMARK_DISABLED_NOOP=PASS');

// --- TEST 6: Metrics & Visual Sanity for 1672x941 ---
console.log('\n--- TEST 6: Default Visual Sanity for 1672x941 ---');
const metrics1672 = calculateTextWatermarkMetrics({
  width: 1672,
  height: 941,
  config: defaultConfig
});
// Base dim = min(1672, 941) = 941
// fontSize = round(941 * 0.022) = 21px
// marginX = round(1672 * 0.022) = 37px
// marginY = round(941 * 0.028) = 26px
assert.equal(metrics1672.fontSizePx, 21);
assert.equal(metrics1672.marginXPx, 37);
assert.equal(metrics1672.marginYPx, 26);
pass(`TEXT_FONT_SIZE_PX=${metrics1672.fontSizePx}`);
pass(`MARGIN_X_PX=${metrics1672.marginXPx}`);
pass(`MARGIN_Y_PX=${metrics1672.marginYPx}`);

// --- TEST 7: Transparency Validation & Opaque Detection ---
console.log('\n--- TEST 7: Transparency Validation & Opaque Detection ---');
// 1. Transparent pixel asset: 2x2 image with one transparent pixel
const transparentPixels = new Uint8ClampedArray([
  255, 255, 255, 255, // pixel 1: opaque
  255, 255, 255, 128, // pixel 2: semi-transparent (alpha 128)
  255, 255, 255, 0,   // pixel 3: fully transparent (alpha 0)
  255, 255, 255, 255  // pixel 4: opaque
]);
const validAsset = {
  width: 2,
  height: 2,
  mime: 'image/png',
  pixelData: transparentPixels
};
const transparentCheck = validateWatermarkImageTransparency(validAsset);
assert.equal(transparentCheck.valid, true);
assert.equal(transparentCheck.hasAlphaChannel, true);
assert.equal(transparentCheck.transparentCount, 2);
pass('TRANSPARENCY_VALIDATION_IMPLEMENTED=YES');
pass('TRANSPARENT_IMAGE_WATERMARK_VALIDATION=PASS');

// 2. Completely opaque asset: 2x2 image with all alpha = 255
const opaquePixels = new Uint8ClampedArray([
  255, 255, 255, 255,
  200, 100, 50, 255,
  0,   0,   0, 255,
  255, 255, 255, 255
]);
const opaqueAsset = {
  width: 2,
  height: 2,
  mime: 'image/png',
  pixelData: opaquePixels
};
const opaqueCheck = validateWatermarkImageTransparency(opaqueAsset);
assert.equal(opaqueCheck.valid, false);
assert.equal(opaqueCheck.reason, 'OPAQUE_WATERMARK_INPUT_NO_TRANSPARENCY');
assert.equal(opaqueCheck.transparentCount, 0);
pass('OPAQUE_WATERMARK_DETECTION_TEST=PASS');

// --- TEST 8: PNG -> WebP Normalizer Contract (Capability Gate) ---
console.log('\n--- TEST 8: PNG -> WebP Normalizer Contract (Capability Gate) ---');
const normalizerRes = await normalizeWatermarkAsset({ mime: 'image/png', blob: dummyBlob });
assert.equal(normalizerRes.status, 'BLOCKED_LOSSLESS_ENCODER_REQUIRED');
assert.ok(normalizerRes.reason.includes('lossless'));
pass('PNG_TO_WEBP_NORMALIZER_STATUS=BLOCKED_LOSSLESS_ENCODER_REQUIRED');

// --- TEST 9: Deterministic Placement Math (Landscape, Portrait, Small Image) ---
console.log('\n--- TEST 9: Placement Geometry Math ---');
// Landscape (1200x800) all four positions
const itemW = 100;
const itemH = 30;
const mXRatio = 0.022; // 26px
const mYRatio = 0.028; // 22px

const br = calculateWatermarkPlacement({
  canvasWidth: 1200,
  canvasHeight: 800,
  itemWidth: itemW,
  itemHeight: itemH,
  position: WATERMARK_POSITIONS.BOTTOM_RIGHT,
  marginXRatio: mXRatio,
  marginYRatio: mYRatio
});
assert.equal(br.x, 1200 - 26 - 100); // 1074
assert.equal(br.y, 800 - 22 - 30);   // 748
assert.ok(br.x >= 0 && br.x + itemW <= 1200);
assert.ok(br.y >= 0 && br.y + itemH <= 800);

const bl = calculateWatermarkPlacement({
  canvasWidth: 1200,
  canvasHeight: 800,
  itemWidth: itemW,
  itemHeight: itemH,
  position: WATERMARK_POSITIONS.BOTTOM_LEFT,
  marginXRatio: mXRatio,
  marginYRatio: mYRatio
});
assert.equal(bl.x, 26);
assert.equal(bl.y, 800 - 22 - 30);

const tr = calculateWatermarkPlacement({
  canvasWidth: 1200,
  canvasHeight: 800,
  itemWidth: itemW,
  itemHeight: itemH,
  position: WATERMARK_POSITIONS.TOP_RIGHT,
  marginXRatio: mXRatio,
  marginYRatio: mYRatio
});
assert.equal(tr.x, 1200 - 26 - 100);
assert.equal(tr.y, 22);

const tl = calculateWatermarkPlacement({
  canvasWidth: 1200,
  canvasHeight: 800,
  itemWidth: itemW,
  itemHeight: itemH,
  position: WATERMARK_POSITIONS.TOP_LEFT,
  marginXRatio: mXRatio,
  marginYRatio: mYRatio
});
assert.equal(tl.x, 26);
assert.equal(tl.y, 22);
pass('LANDSCAPE_TEXT_RENDER_TEST=PASS');

// Portrait (800x1200)
const pPlacement = calculateWatermarkPlacement({
  canvasWidth: 800,
  canvasHeight: 1200,
  itemWidth: itemW,
  itemHeight: itemH,
  position: WATERMARK_POSITIONS.BOTTOM_RIGHT,
  marginXRatio: mXRatio,
  marginYRatio: mYRatio
});
assert.ok(pPlacement.x >= 0 && pPlacement.x + itemW <= 800);
assert.ok(pPlacement.y >= 0 && pPlacement.y + itemH <= 1200);
pass('PORTRAIT_TEXT_RENDER_TEST=PASS');

// Small Image (100x60)
const smallPlacement = calculateWatermarkPlacement({
  canvasWidth: 100,
  canvasHeight: 60,
  itemWidth: 80,
  itemHeight: 20,
  position: WATERMARK_POSITIONS.BOTTOM_RIGHT,
  marginXRatio: mXRatio,
  marginYRatio: mYRatio
});
assert.ok(smallPlacement.x >= 0 && smallPlacement.x + 80 <= 100);
assert.ok(smallPlacement.y >= 0 && smallPlacement.y + 20 <= 60);
pass('SMALL_IMAGE_BOUNDARY_TEST=PASS');

// --- TEST 10: Canvas Rendering & Live Fixture Evaluation via Service Worker CDP ---
console.log('\n--- TEST 10: Service Worker OffscreenCanvas & Live Fixture Evaluation ---');
const swTarget = await getSwTarget();
if (!swTarget) {
  throw new Error('Extension Service Worker not found on CDP port 9222! Please ensure Chrome is running with extension loaded.');
}

const cdp = new CdpClient(swTarget.webSocketDebuggerUrl);
await cdp.connect();

// Read watermark-engine.js from workspace
let engineCode = fs.readFileSync('extensions/lokamedia/src/watermark-engine.js', 'utf8');
engineCode = engineCode.replace(/export /g, '');

const swTestExpression = `(async () => {
  ${engineCode}

  // Helper to create synthetic solid color PNG blob via OffscreenCanvas
  async function makeSyntheticPng(width, height, color = '#3498db') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/png' });
  }

  // Helper to create synthetic transparent watermark PNG
  async function makeSyntheticWatermarkPng(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(5, 5, width - 10, height - 10);
    return canvas.convertToBlob({ type: 'image/png' });
  }

  // 1. Landscape rendering test
  const landscapeBlob = await makeSyntheticPng(1200, 800);
  const landscapeRes = await transformWatermark({
    sourceBlob: landscapeBlob,
    sourceMeta: { width: 1200, height: 800, mime: 'image/png', role: 'ORIGINAL' },
    config: DEFAULT_WATERMARK_CONFIG
  });

  // 2. Portrait rendering test
  const portraitBlob = await makeSyntheticPng(800, 1200);
  const portraitRes = await transformWatermark({
    sourceBlob: portraitBlob,
    sourceMeta: { width: 800, height: 1200, mime: 'image/png', role: 'ORIGINAL' },
    config: { ...DEFAULT_WATERMARK_CONFIG, position: 'top-left' }
  });

  // 3. Small image boundary test
  const smallBlob = await makeSyntheticPng(120, 80);
  const smallRes = await transformWatermark({
    sourceBlob: smallBlob,
    sourceMeta: { width: 120, height: 80, mime: 'image/png', role: 'ORIGINAL' },
    config: DEFAULT_WATERMARK_CONFIG
  });

  // 4. Image watermark test
  const watermarkBlob = await makeSyntheticWatermarkPng(100, 50);
  const imageWatermarkRes = await transformWatermark({
    sourceBlob: landscapeBlob,
    sourceMeta: { width: 1200, height: 800, mime: 'image/png', role: 'ORIGINAL' },
    config: {
      enabled: true,
      type: 'IMAGE',
      position: 'bottom-right',
      opacity: 0.75,
      margin_x_ratio: 0.03,
      margin_y_ratio: 0.03,
      image: { width_ratio: 0.15 }
    },
    watermarkAsset: {
      blob: watermarkBlob,
      width: 100,
      height: 50,
      mime: 'image/png',
      hasAlpha: true
    }
  });

  // 5. Read-only live fixture evaluation on mjob_5c0f488d7ee123b9579a58a5:1
  const request = indexedDB.open('lokamedia-extension', 2);
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const tx = db.transaction(['captured-blobs'], 'readonly');
  const store = tx.objectStore('captured-blobs');
  const key = 'mjob_5c0f488d7ee123b9579a58a5:1';
  const record = await new Promise((resolve) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  if (!record || !record.bytes) {
    throw new Error('Live original fixture record missing from IndexedDB');
  }

  const liveSourceBlob = new Blob([record.bytes], { type: record.mime });
  const liveInitialByteSize = liveSourceBlob.size;
  const liveInitialSha = await computeSha256(liveSourceBlob);

  const liveSourceMeta = {
    width: record.width,
    height: record.height,
    mime: record.mime,
    sha256: liveInitialSha,
    role: 'ORIGINAL'
  };

  const liveTransformResult = await transformWatermark({
    sourceBlob: liveSourceBlob,
    sourceMeta: liveSourceMeta,
    config: DEFAULT_WATERMARK_CONFIG
  });

  const liveFinalByteSize = liveSourceBlob.size;
  const liveFinalSha = await computeSha256(liveSourceBlob);

  // Check that IndexedDB remains completely untouched
  const txCheck = db.transaction(['captured-blobs'], 'readonly');
  const storeCheck = txCheck.objectStore('captured-blobs');
  const allKeysAfter = await new Promise((resolve) => {
    const req = storeCheck.getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });

  return {
    landscapeDimensions: { width: landscapeRes.width, height: landscapeRes.height },
    portraitDimensions: { width: portraitRes.width, height: portraitRes.height },
    smallDimensions: { width: smallRes.width, height: smallRes.height },
    imageWatermarkResult: {
      width: imageWatermarkRes.width,
      height: imageWatermarkRes.height,
      mime: imageWatermarkRes.mime,
      byteSize: imageWatermarkRes.byteSize
    },
    liveFixture: {
      key: record.key,
      sourceWidth: liveSourceMeta.width,
      sourceHeight: liveSourceMeta.height,
      sourceByteSize: liveInitialByteSize,
      sourceSha: liveInitialSha,
      sourceImmutable: liveInitialByteSize === liveFinalByteSize && liveInitialSha === liveFinalSha,
      allKeysInIdb: allKeysAfter,
      idbKeysCount: allKeysAfter.length,
      outputMime: liveTransformResult.mime,
      outputWidth: liveTransformResult.width,
      outputHeight: liveTransformResult.height,
      outputByteSize: liveTransformResult.byteSize,
      transformId: liveTransformResult.transformId,
      engineVersion: liveTransformResult.engineVersion,
      watermarkVersion: liveTransformResult.watermarkVersion
    }
  };
})()`;

const swResults = await cdp.evaluate(swTestExpression);
cdp.close();

// Assert Landscape preservation
assert.equal(swResults.landscapeDimensions.width, 1200);
assert.equal(swResults.landscapeDimensions.height, 800);
pass('BROWSER_CANVAS_LANDSCAPE_RENDER=PASS');

// Assert Portrait preservation
assert.equal(swResults.portraitDimensions.width, 800);
assert.equal(swResults.portraitDimensions.height, 1200);
pass('BROWSER_CANVAS_PORTRAIT_RENDER=PASS');

// Assert Small image preservation
assert.equal(swResults.smallDimensions.width, 120);
assert.equal(swResults.smallDimensions.height, 80);
pass('BROWSER_CANVAS_SMALL_IMAGE_RENDER=PASS');

// Assert Image Watermark transform
assert.equal(swResults.imageWatermarkResult.width, 1200);
assert.equal(swResults.imageWatermarkResult.height, 800);
assert.equal(swResults.imageWatermarkResult.mime, 'image/png');
assert.ok(swResults.imageWatermarkResult.byteSize > 0);
pass('TRANSPARENT_IMAGE_WATERMARK_TEST=PASS');

// Assert Live Fixture Read-Only Transform (Section 24)
const live = swResults.liveFixture;
assert.equal(live.key, 'mjob_5c0f488d7ee123b9579a58a5:1');
assert.equal(live.sourceWidth, 1672);
assert.equal(live.sourceHeight, 941);
assert.equal(live.sourceByteSize, 3846190); // 3846190 bytes (within valid capture range)
assert.equal(live.outputWidth, 1672);
assert.equal(live.outputHeight, 941);
assert.equal(live.outputMime, 'image/png');
assert.ok(live.outputByteSize > 0);
assert.equal(live.sourceImmutable, true);
assert.equal(live.idbKeysCount, 1);
assert.deepEqual(live.allKeysInIdb, ['mjob_5c0f488d7ee123b9579a58a5:1']);

pass('SOURCE_BLOB_IMMUTABLE=PASS');
pass('OUTPUT_DIMENSIONS_PRESERVED=PASS');
pass('LIVE_FIXTURE_READ_ONLY_TRANSFORM=PASS');
pass('LIVE_ORIGINAL_UNCHANGED=YES');
pass(`LIVE_FIXTURE_TRANSFORM_ID=${live.transformId}`);
pass(`LIVE_FIXTURE_OUTPUT_BYTE_SIZE=${live.outputByteSize}`);

console.log('\n=== ALL PHASE 5D3A WATERMARK ENGINE TESTS PASSED ===\n');
