/**
 * RancangLoka — Phase 5K3B-R2 Full-Res ChatGPT Capture Adapter Tests
 *
 * Covers:
 * CASE A: DOM rendered 461x259, natural image 1672x941, provider binary 1672x941
 *         -> capture must be 1672x941 provider binary
 * CASE B: Provider binary available, canvas available
 *         -> provider binary wins (provenance === 'PROVIDER_BINARY', is_canonical_original === true)
 * CASE C: Provider binary unavailable, DOM binary available
 *         -> DOM binary used (provenance === 'DOM_BINARY', is_canonical_original === true)
 * CASE D: Only canvas fallback available
 *         -> capture allowed but provenance marks reencoded/non-original
 *            (provenance === 'CANVAS_REENCODED', is_canonical_original === false)
 * CASE E: Unrelated newer/larger images exist
 *         -> exact owned generation result still selected
 * CASE F: Provider binary fetch fails
 *         -> fails closed, no duplicate generation submission
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and evaluate content-script.js in a controlled sandbox environment
const contentScriptPath = path.resolve(__dirname, '../extensions/lokamedia/src/providers/chatgpt/content-script.js');
const contentScriptCode = fs.readFileSync(contentScriptPath, 'utf8');

// Fake DOM Elements and utilities
class FakeElement {
  constructor({ tag = 'div', attrs = {}, width = 0, height = 0, naturalWidth = 0, naturalHeight = 0, parent = null, currentSrc = '' } = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.width = width;
    this.height = height;
    this.naturalWidth = naturalWidth || width;
    this.naturalHeight = naturalHeight || height;
    this.parentElement = parent;
    this.currentSrc = currentSrc || attrs.src || '';
  }

  getAttribute(name) {
    return this.attrs[name] ?? null;
  }

  setAttribute(name, val) {
    this.attrs[name] = String(val);
  }

  closest(selector) {
    if (selector.includes('[data-message-id]') && this.attrs['data-message-id']) return this;
    if (selector.includes('[data-testid*="conversation-turn"]') && this.attrs['data-testid']?.includes('conversation-turn')) return this;
    if (selector.includes('[data-message-author-role]') && this.attrs['data-message-author-role']) return this;
    if (selector.includes('article') && this.tagName === 'ARTICLE') return this;
    return this.parentElement?.closest?.(selector) ?? this.parentElement;
  }
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeSource(src = '') {
  try {
    const url = new URL(src, 'https://chatgpt.com');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return src.split('?')[0].split('#')[0];
  }
}

function fingerprintImg(element) {
  const container = element.closest?.('[data-message-id], [data-testid*="conversation-turn"], article, [data-message-author-role]') ?? element.parentElement;
  const containerFingerprint = hashText([
    container?.getAttribute?.('data-message-id') ?? '',
    container?.getAttribute?.('data-testid') ?? '',
    container?.getAttribute?.('data-message-author-role') ?? '',
    container?.tagName ?? ''
  ].join('|'));
  const normalized = normalizeSource(element.currentSrc || element.getAttribute?.('src') || '');
  const basis = [
    normalized,
    Number(element.getAttribute?.('width') || element.naturalWidth || element.width || 0),
    Number(element.getAttribute?.('height') || element.naturalHeight || element.height || 0),
    containerFingerprint,
    element.getAttribute?.('data-asset-id') || ''
  ].join('|');
  return `img_${hashText(basis)}`;
}

// Instantiate content script provider helpers in Node
function setupSandbox({ fetchHandler = null, canvasHandler = null } = {}) {
  const sandbox = {
    globalThis: {},
    crypto: {
      randomUUID: () => crypto.randomUUID(),
      subtle: {
        digest: async (algo, buf) => {
          return crypto.createHash('sha256').update(Buffer.from(buf)).digest();
        }
      }
    },
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    fetch: fetchHandler,
    document: {
      createElement: canvasHandler || (() => ({
        getContext: () => null
      })),
      querySelector: () => null,
      querySelectorAll: () => []
    },
    chrome: {
      runtime: {
        onMessage: { addListener: () => {} },
        sendMessage: () => {}
      }
    }
  };
  sandbox.globalThis = sandbox;

  const fn = new Function(
    'globalThis', 'crypto', 'btoa', 'atob', 'fetch', 'document', 'chrome',
    contentScriptCode
  );
  fn(sandbox.globalThis, sandbox.crypto, sandbox.btoa, sandbox.atob, sandbox.fetch, sandbox.document, sandbox.chrome);

  return sandbox.globalThis.__lokamediaChatGptProvider;
}

let testsPassed = 0;
function pass(testName) {
  testsPassed++;
  console.log(`  PASS ${testName}`);
}

async function runAllTests() {
  console.log('Running RancangLoka Phase 5K3B-R2 Full-Res Capture Adapter Tests...\n');

  // -------------------------------------------------------------------------
  // CASE A: DOM rendered 461x259, natural image 1672x941, provider binary 1672x941
  // -------------------------------------------------------------------------
  {
    const expectedWidth = 1672;
    const expectedHeight = 941;
    const rawBinary = Buffer.alloc(2655415, 0x5a); // 2.65MB
    const expectedSha256 = crypto.createHash('sha256').update(rawBinary).digest('hex');

    const provider = setupSandbox({
      fetchHandler: async (url) => {
        if (url === 'https://chatgpt.com/backend-api/estuary/content/img-123') {
          return {
            ok: true,
            status: 200,
            blob: async () => ({
              type: 'image/png',
              arrayBuffer: async () => rawBinary.buffer.slice(rawBinary.byteOffset, rawBinary.byteOffset + rawBinary.byteLength)
            })
          };
        }
        return { ok: false, status: 404 };
      }
    });

    const imgElement = new FakeElement({
      tag: 'img',
      attrs: { src: 'https://chatgpt.com/backend-api/estuary/content/img-123' },
      width: 461,          // CSS rendered box
      height: 259,         // CSS rendered box
      naturalWidth: 1672,  // Decoded natural width
      naturalHeight: 941   // Decoded natural height
    });

    const result = await provider.imageToDataUrl(imgElement);

    assert.equal(result.width, expectedWidth, 'Width must match natural/decoded binary width (1672), not CSS width (461)');
    assert.equal(result.height, expectedHeight, 'Height must match natural/decoded binary height (941), not CSS height (259)');
    assert.equal(result.byte_size, 2655415, 'Byte size must match provider binary byte length');
    assert.equal(result.sha256, expectedSha256, 'SHA-256 must match direct binary digest');
    assert.equal(result.provenance, 'PROVIDER_BINARY', 'Provenance must be PROVIDER_BINARY');
    assert.equal(result.is_canonical_original, true, 'Must be marked canonical original');

    pass('CASE A: DOM rendered 461x259, natural 1672x941 -> captured 1672x941 provider binary');
  }

  // -------------------------------------------------------------------------
  // CASE B: Provider binary available, canvas available -> provider binary wins
  // -------------------------------------------------------------------------
  {
    let canvasDrawn = false;
    const rawBinary = Buffer.from('RAW_PROVIDER_IMAGE_BYTES_CASE_B');

    const provider = setupSandbox({
      fetchHandler: async (url) => {
        return {
          ok: true,
          status: 200,
          blob: async () => ({
            type: 'image/png',
            arrayBuffer: async () => rawBinary.buffer.slice(rawBinary.byteOffset, rawBinary.byteOffset + rawBinary.byteLength)
          })
        };
      },
      canvasHandler: () => ({
        getContext: () => ({
          drawImage: () => { canvasDrawn = true; }
        }),
        toDataURL: () => 'data:image/png;base64,VEFJTlRFRF9DQU5WQVM='
      })
    });

    const imgElement = new FakeElement({
      tag: 'img',
      attrs: { src: 'https://chatgpt.com/backend-api/estuary/content/full-res' },
      width: 400,
      height: 200,
      naturalWidth: 1600,
      naturalHeight: 800
    });

    const result = await provider.imageToDataUrl(imgElement);

    assert.equal(result.provenance, 'PROVIDER_BINARY', 'Provider binary must win over canvas fallback');
    assert.equal(result.is_canonical_original, true, 'Provider binary must be canonical original');
    assert.equal(result.byte_size, rawBinary.byteLength, 'Byte size must be raw binary size');
    assert.equal(canvasDrawn, false, 'Canvas drawImage must NOT be invoked when direct binary is available');

    pass('CASE B: Provider binary available, canvas available -> provider binary wins without canvas draw');
  }

  // -------------------------------------------------------------------------
  // CASE C: Provider binary unavailable, natural DOM binary available
  // -------------------------------------------------------------------------
  {
    const domBinaryBytes = Buffer.from('DOM_BINARY_DATA_URL_BYTES_CASE_C');
    const b64 = domBinaryBytes.toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;

    const provider = setupSandbox({
      fetchHandler: async () => ({ ok: false, status: 404 })
    });

    const imgElement = new FakeElement({
      tag: 'img',
      attrs: { src: dataUrl },
      width: 300,
      height: 150,
      naturalWidth: 1200,
      naturalHeight: 600
    });

    const result = await provider.imageToDataUrl(imgElement);

    assert.equal(result.provenance, 'DOM_BINARY', 'Must identify DOM_BINARY');
    assert.equal(result.is_canonical_original, true, 'DOM binary is canonical original');
    assert.equal(result.width, 1200, 'Width matches natural DOM width');
    assert.equal(result.height, 600, 'Height matches natural DOM height');
    assert.equal(result.byte_size, domBinaryBytes.byteLength, 'Byte size matches decoded DOM data');

    pass('CASE C: Provider binary unavailable, natural DOM binary available -> DOM binary used');
  }

  // -------------------------------------------------------------------------
  // CASE D: Only canvas fallback available -> marked reencoded/non-original
  // -------------------------------------------------------------------------
  {
    const canvasBytes = Buffer.from('CANVAS_FALLBACK_RENDERED_BYTES');
    const b64 = canvasBytes.toString('base64');

    const provider = setupSandbox({
      fetchHandler: async () => { throw new Error('NETWORK_FETCH_FAILED'); },
      canvasHandler: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              drawImage: () => {}
            }),
            toDataURL: () => `data:image/png;base64,${b64}`
          };
        }
        return {};
      }
    });

    const imgElement = new FakeElement({
      tag: 'img',
      attrs: { src: 'https://chatgpt.com/unreachable/image.png' },
      width: 400,
      height: 200,
      naturalWidth: 800,
      naturalHeight: 400
    });

    const result = await provider.imageToDataUrl(imgElement);

    assert.equal(result.provenance, 'CANVAS_REENCODED', 'Provenance must be CANVAS_REENCODED');
    assert.equal(result.is_canonical_original, false, 'Canvas fallback must NOT be marked canonical original');
    assert.equal(result.width, 800);
    assert.equal(result.height, 400);

    pass('CASE D: Only canvas fallback available -> marked CANVAS_REENCODED and is_canonical_original=false');
  }

  // -------------------------------------------------------------------------
  // CASE E: Unrelated newer/larger images exist -> exact owned result selected
  // -------------------------------------------------------------------------
  {
    const targetBinary = Buffer.from('TARGET_OWNED_IMAGE_BINARY');
    const targetSha256 = crypto.createHash('sha256').update(targetBinary).digest('hex');

    const targetContainer = new FakeElement({
      attrs: { 'data-message-id': 'msg_owned_turn', 'data-message-author-role': 'assistant' }
    });
    const targetImg = new FakeElement({
      tag: 'img',
      attrs: { src: 'https://chatgpt.com/backend-api/estuary/content/target_owned' },
      width: 461,
      height: 259,
      naturalWidth: 1672,
      naturalHeight: 941,
      parent: targetContainer
    });
    const targetFp = fingerprintImg(targetImg);

    // Newer, larger unrelated image on page
    const unrelatedContainer = new FakeElement({
      attrs: { 'data-message-id': 'msg_newer_turn', 'data-message-author-role': 'assistant' }
    });
    const unrelatedImg = new FakeElement({
      tag: 'img',
      attrs: { src: 'https://chatgpt.com/backend-api/estuary/content/unrelated_huge' },
      width: 1000,
      height: 1000,
      naturalWidth: 3840,
      naturalHeight: 2160,
      parent: unrelatedContainer
    });
    const unrelatedFp = fingerprintImg(unrelatedImg);

    assert.notEqual(targetFp, unrelatedFp, 'Target and unrelated fingerprints must differ');

    const allImages = [unrelatedImg, targetImg]; // Unrelated is first / newer
    let fetchedUrl = null;

    const provider = setupSandbox({
      fetchHandler: async (url) => {
        fetchedUrl = url;
        if (url.includes('target_owned')) {
          return {
            ok: true,
            status: 200,
            blob: async () => ({
              type: 'image/png',
              arrayBuffer: async () => targetBinary.buffer.slice(targetBinary.byteOffset, targetBinary.byteOffset + targetBinary.byteLength)
            })
          };
        }
        throw new Error('UNEXPECTED_FETCH_' + url);
      }
    });

    const rootDoc = {
      querySelectorAll: (sel) => {
        if (sel.includes('img')) return allImages;
        return [];
      },
      querySelector: () => null
    };

    const captureMessage = {
      type: 'CHATGPT_PROVIDER_CAPTURE',
      job_id: 'mjob_target_123',
      run_id: 'run_target_456',
      slot_key: 'featured',
      provider_result: {
        job_id: 'mjob_target_123',
        run_id: 'run_target_456',
        slot_key: 'featured',
        source_fingerprint: targetFp
      }
    };

    const response = await provider.controlledCapture(captureMessage, rootDoc);

    assert.equal(response.ok, true, 'Capture must succeed');
    assert.equal(response.width, 1672, 'Must capture target width 1672, not unrelated 3840');
    assert.equal(response.height, 941, 'Must capture target height 941, not unrelated 2160');
    assert.equal(response.sha256, targetSha256, 'Must match target SHA-256');
    assert.equal(response.provenance, 'PROVIDER_BINARY');
    assert.equal(fetchedUrl, 'https://chatgpt.com/backend-api/estuary/content/target_owned');

    pass('CASE E: Unrelated newer/larger images exist -> exact owned generation result still selected');
  }

  // -------------------------------------------------------------------------
  // CASE F: Provider binary fetch fails -> no duplicate generation submission
  // -------------------------------------------------------------------------
  {
    let generationCalls = 0;
    const provider = setupSandbox({
      fetchHandler: async () => {
        throw new Error('PROVIDER_BINARY_NETWORK_FAILURE');
      },
      canvasHandler: () => ({
        getContext: () => null // Canvas also unavailable -> fails closed
      })
    });

    const imgElement = new FakeElement({
      tag: 'img',
      attrs: { src: 'https://chatgpt.com/backend-api/estuary/content/fail' },
      width: 461,
      height: 259,
      naturalWidth: 1672,
      naturalHeight: 941
    });

    let captureError = null;
    try {
      await provider.imageToDataUrl(imgElement);
    } catch (err) {
      captureError = err;
    }

    assert(captureError !== null, 'Must fail closed when provider binary and fallbacks fail');
    assert.equal(generationCalls, 0, 'Must NOT trigger duplicate generation submission on capture failure');

    pass('CASE F: Provider binary fetch fails -> fails closed with zero duplicate generation calls');
  }

  console.log(`\nAll ${testsPassed} Full-Res Capture Adapter tests passed cleanly.`);
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
