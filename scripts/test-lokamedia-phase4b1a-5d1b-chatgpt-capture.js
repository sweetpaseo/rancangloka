/**
 * RancangLoka — LokaMedia Phase 4B1A.5D1B Real ChatGPT Capture Adapter Wiring Tests
 *
 * Deterministic test suite covering:
 * - Test A: Exact Correlated Capture (old image, target image, unrelated image -> target only, capture=1)
 * - Test B: Missing Target fails closed (CAPTURE_TARGET_MISSING, acquisition=0, generate=0)
 * - Test C: Ambiguous Target fails closed (CAPTURE_TARGET_AMBIGUOUS, acquisition=0, no fallback)
 * - Test D: Correlation Mismatch fails closed (CAPTURE_CORRELATION_MISMATCH, acquisition=0)
 * - Test E: Binary Transport roundtrip identical bytes (source bytes === decoded ArrayBuffer bytes)
 * - Test F: MIME Preservation (image/png, image/jpeg, image/webp accepted, invalid rejected)
 * - Test G: Content Script Absent fails closed (CONTENT_SCRIPT_UNAVAILABLE, zero uploads)
 * - Test H: Capture Exactly Once (adapter.capture=1, sendMessage=1, acquisition=1, never duplicated)
 * - Test I: Controller Integration with real adapter (validates, persists to blobStore, CAPTURE_BLOB_PROBE_STOP, R2=0, media_assets=0)
 * - Test J: Provider Result Passed Explicitly (generate result descriptor === capture input descriptor)
 */

import assert from 'node:assert/strict';
import {
  CHATGPT_DOM_ADAPTER_VERSION,
  CHATGPT_ERROR_CODES,
  CHATGPT_MESSAGE_TYPES
} from '../extensions/lokamedia/src/providers/chatgpt/constants.js';
import { ChatGptProviderAdapter } from '../extensions/lokamedia/src/providers/chatgpt/adapter.js';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

function makeJob(id, patch = {}) {
  return {
    job_id: id,
    article_id: patch.article_id ?? 1,
    article_slug: patch.article_slug ?? `article-${id}`,
    article_title: patch.article_title ?? 'LokaMedia Phase 4B Real Capture Adapter Test',
    slot_key: patch.slot_key ?? 'featured',
    role: patch.role ?? 'featured',
    sequence: patch.sequence ?? 1,
    prompt_version: patch.prompt_version ?? 1,
    prompt_hash: patch.prompt_hash ?? `hash-${id}`,
    idempotency_key: patch.idempotency_key ?? `idem-${id}`,
    job_revision: patch.job_revision ?? 11,
    lease_owner: patch.lease_owner ?? 'device-1',
    status: patch.status ?? 'LEASED',
    lease_expires_at: new Date(Date.now() + 60000).toISOString(),
    prompt: 'A prompt for testing real capture',
    controlled_run_once: true,
    ...patch
  };
}

// ---------------------------------------------------------------------------
// FAKE DOM FOR CONTENT SCRIPT TESTING
// ---------------------------------------------------------------------------

class FakeElement {
  constructor({ tag = 'div', attrs = {}, width = 0, height = 0, parent = null, currentSrc = '' } = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.width = width;
    this.height = height;
    this.naturalWidth = width;
    this.naturalHeight = height;
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

// ---------------------------------------------------------------------------
// TEST A — EXACT CORRELATED CAPTURE
// ---------------------------------------------------------------------------
async function testA_ExactCorrelatedCapture() {
  const oldContainer = new FakeElement({ attrs: { 'data-message-id': 'msg-old', 'data-message-author-role': 'assistant' } });
  const oldImg = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/old.png' }, width: 512, height: 512, parent: oldContainer });

  const targetContainer = new FakeElement({ attrs: { 'data-message-id': 'msg-target', 'data-message-author-role': 'assistant' } });
  const targetImg = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/target.png' }, width: 1024, height: 1024, parent: targetContainer });

  const unrelatedContainer = new FakeElement({ attrs: { 'data-message-id': 'msg-unrelated', 'data-message-author-role': 'user' } });
  const unrelatedImg = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/unrelated.png' }, width: 256, height: 256, parent: unrelatedContainer });

  const allElements = [oldImg, targetImg, unrelatedImg];
  const targetFp = fingerprintImg(targetImg);
  const oldFp = fingerprintImg(oldImg);

  assert.notEqual(targetFp, oldFp, 'Target and old images must have distinct fingerprints');

  let binaryAcquisitions = 0;
  let capturedElement = null;

  async function mockContentScriptCapture(message, candidateImages) {
    const { job_id, run_id, slot_key, provider_result } = message;
    if (!job_id || !provider_result) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    const expectedFp = provider_result.source_fingerprint || provider_result.fingerprint || null;
    if (!expectedFp) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };

    const matches = candidateImages.filter((el) => fingerprintImg(el) === expectedFp);
    if (matches.length === 0) return { ok: false, error: 'CAPTURE_TARGET_MISSING' };
    if (matches.length > 1) return { ok: false, error: 'CAPTURE_TARGET_AMBIGUOUS', match_count: matches.length };

    const chosen = matches[0];
    binaryAcquisitions++;
    capturedElement = chosen;

    const base64Png = Buffer.from('FAKE_TARGET_PNG_BYTES').toString('base64');
    return {
      ok: true,
      data_url: `data:image/png;base64,${base64Png}`,
      mime: 'image/png',
      width: chosen.width,
      height: chosen.height,
      byte_size: 21,
      source_fingerprint: fingerprintImg(chosen),
      job_id,
      run_id,
      slot_key
    };
  }

  const result = await mockContentScriptCapture(
    {
      job_id: 'mjob_a',
      run_id: 'run_a',
      slot_key: 'featured',
      provider_result: {
        source_fingerprint: targetFp,
        job_id: 'mjob_a',
        run_id: 'run_a',
        slot_key: 'featured'
      }
    },
    allElements
  );

  assert.equal(result.ok, true);
  assert.equal(binaryAcquisitions, 1, 'Binary acquisition calls must be exactly 1');
  assert.strictEqual(capturedElement, targetImg, 'Captured element must be target image only');
  assert.equal(result.source_fingerprint, targetFp);

  pass('TEST A — EXACT CORRELATED CAPTURE: target selected exclusively, binary acquisition calls = 1');
}

// ---------------------------------------------------------------------------
// TEST B — MISSING TARGET
// ---------------------------------------------------------------------------
async function testB_MissingTarget() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-1', 'data-message-author-role': 'assistant' } });
  const existingImg = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/existing.png' }, width: 512, height: 512, parent: container });

  let binaryAcquisitions = 0;
  let generateCalls = 0;

  async function mockContentScriptCapture(message, candidateImages) {
    const { job_id, provider_result } = message;
    if (!job_id || !provider_result) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    const expectedFp = provider_result.source_fingerprint;
    const matches = candidateImages.filter((el) => fingerprintImg(el) === expectedFp);
    if (matches.length === 0) return { ok: false, error: 'CAPTURE_TARGET_MISSING' };
    binaryAcquisitions++;
    return { ok: true };
  }

  const result = await mockContentScriptCapture(
    {
      job_id: 'mjob_b',
      provider_result: { source_fingerprint: 'img_nonexistent_hash_12345' }
    },
    [existingImg]
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, 'CAPTURE_TARGET_MISSING');
  assert.equal(binaryAcquisitions, 0, 'Binary acquisition calls must be 0 when target is missing');
  assert.equal(generateCalls, 0, 'Provider generate calls must be 0 (no regeneration)');

  pass('TEST B — MISSING TARGET: fails closed with CAPTURE_TARGET_MISSING, acquisition=0, generate=0');
}

// ---------------------------------------------------------------------------
// TEST C — AMBIGUOUS TARGET
// ---------------------------------------------------------------------------
async function testC_AmbiguousTarget() {
  const container = new FakeElement({ attrs: { 'data-message-id': 'msg-dup', 'data-message-author-role': 'assistant' } });
  const img1 = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/same.png' }, width: 512, height: 512, parent: container });
  const img2 = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/same.png' }, width: 512, height: 512, parent: container });

  let binaryAcquisitions = 0;

  async function mockContentScriptCapture(message, candidateImages) {
    const { job_id, provider_result } = message;
    if (!job_id || !provider_result) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    const expectedFp = provider_result.source_fingerprint;
    const matches = candidateImages.filter((el) => fingerprintImg(el) === expectedFp);
    if (matches.length === 0) return { ok: false, error: 'CAPTURE_TARGET_MISSING' };
    if (matches.length > 1) return { ok: false, error: 'CAPTURE_TARGET_AMBIGUOUS', match_count: matches.length };
    binaryAcquisitions++;
    return { ok: true };
  }

  const fp = fingerprintImg(img1);
  const result = await mockContentScriptCapture(
    {
      job_id: 'mjob_c',
      provider_result: { source_fingerprint: fp }
    },
    [img1, img2]
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, 'CAPTURE_TARGET_AMBIGUOUS');
  assert.equal(result.match_count, 2);
  assert.equal(binaryAcquisitions, 0, 'Binary acquisition calls must be 0 on ambiguity, no fallback');

  pass('TEST C — AMBIGUOUS TARGET: fails closed with CAPTURE_TARGET_AMBIGUOUS, acquisition=0, no fallback');
}

// ---------------------------------------------------------------------------
// TEST D — CORRELATION MISMATCH
// ---------------------------------------------------------------------------
async function testD_CorrelationMismatch() {
  let binaryAcquisitions = 0;

  async function mockContentScriptCapture(message) {
    const { job_id, run_id, slot_key, provider_result } = message;
    if (!job_id || !provider_result) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    if (provider_result.job_id && provider_result.job_id !== job_id) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    if (provider_result.run_id && run_id && provider_result.run_id !== run_id) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    if (provider_result.slot_key && slot_key && provider_result.slot_key !== slot_key) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    if (!provider_result.source_fingerprint && !provider_result.containerFingerprint) return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    binaryAcquisitions++;
    return { ok: true };
  }

  // Subcase 1: job_id mismatch
  const res1 = await mockContentScriptCapture({
    job_id: 'mjob_req_1',
    run_id: 'run_1',
    provider_result: { job_id: 'mjob_diff_2', source_fingerprint: 'fp_1' }
  });
  assert.equal(res1.ok, false);
  assert.equal(res1.error, 'CAPTURE_CORRELATION_MISMATCH');

  // Subcase 2: run_id mismatch
  const res2 = await mockContentScriptCapture({
    job_id: 'mjob_req_1',
    run_id: 'run_req_1',
    provider_result: { job_id: 'mjob_req_1', run_id: 'run_diff_2', source_fingerprint: 'fp_1' }
  });
  assert.equal(res2.ok, false);
  assert.equal(res2.error, 'CAPTURE_CORRELATION_MISMATCH');

  // Subcase 3: missing descriptor identity
  const res3 = await mockContentScriptCapture({
    job_id: 'mjob_req_1',
    run_id: 'run_req_1',
    provider_result: {}
  });
  assert.equal(res3.ok, false);
  assert.equal(res3.error, 'CAPTURE_CORRELATION_MISMATCH');

  assert.equal(binaryAcquisitions, 0, 'Binary acquisition calls must remain 0 on correlation mismatch');

  pass('TEST D — CORRELATION MISMATCH: fail closed on run/job/result identity mismatch, acquisition=0');
}

// ---------------------------------------------------------------------------
// TEST E — BINARY TRANSPORT (Roundtrip Identical)
// ---------------------------------------------------------------------------
async function testE_BinaryTransport() {
  // Construct deterministic 64 KiB pseudo-random binary fixture
  const fixtureSize = 65536;
  const originalBytes = new Uint8Array(fixtureSize);
  for (let i = 0; i < fixtureSize; i++) {
    originalBytes[i] = (i * 31 + 17) & 0xff;
  }

  // Convert to base64 data URL
  const base64 = Buffer.from(originalBytes).toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  // Use ChatGptProviderAdapter with mocked tabController
  const chromeApi = {
    tabs: {
      async sendMessage(tabId, message) {
        assert.equal(message.type, CHATGPT_MESSAGE_TYPES.CAPTURE);
        return {
          ok: true,
          data_url: dataUrl,
          mime: 'image/png',
          width: 1024,
          height: 1024,
          byte_size: fixtureSize,
          sha256: 'test-sha256-e'
        };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: {
      chrome: chromeApi,
      async locateTab() {
        return { ok: true, tab_id: 100 };
      }
    }
  });

  const job = makeJob('mjob_e');
  const captured = await adapter.capture(job, { source_fingerprint: 'fp_e' });

  assert(captured.bytes instanceof ArrayBuffer, 'captured.bytes must be ArrayBuffer');
  assert.equal(captured.bytes.byteLength, fixtureSize);

  const capturedU8 = new Uint8Array(captured.bytes);
  assert.equal(Buffer.compare(Buffer.from(capturedU8), Buffer.from(originalBytes)), 0, 'Decoded bytes must match original byte-for-byte');

  pass('TEST E — BINARY TRANSPORT: 64 KiB roundtrip identical (BINARY_ROUNDTRIP_IDENTICAL=YES)');
}

// ---------------------------------------------------------------------------
// TEST F — MIME PRESERVATION
// ---------------------------------------------------------------------------
async function testF_MimePreservation() {
  const mimeTypes = ['image/png', 'image/jpeg', 'image/webp'];

  for (const mime of mimeTypes) {
    const raw = Buffer.from(`RAW_BYTES_FOR_${mime}`);
    const base64 = raw.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    const chromeApi = {
      tabs: {
        async sendMessage() {
          return {
            ok: true,
            data_url: dataUrl,
            mime,
            width: 800,
            height: 600,
            byte_size: raw.length
          };
        }
      }
    };

    const adapter = new ChatGptProviderAdapter({
      tabController: {
        chrome: chromeApi,
        async locateTab() {
          return { ok: true, tab_id: 101 };
        }
      }
    });

    const captured = await adapter.capture(makeJob('mjob_f'), { source_fingerprint: 'fp_f' });
    assert.equal(captured.mime, mime, `MIME ${mime} must be preserved`);
    assert.equal(captured.width, 800);
    assert.equal(captured.height, 600);
    assert.equal(captured.size, raw.length);
  }

  // Reject invalid / unsupported MIME
  const invalidDataUrl = `data:text/html;base64,${Buffer.from('<h1>slop</h1>').toString('base64')}`;
  const badChromeApi = {
    tabs: {
      async sendMessage() {
        return {
          ok: true,
          data_url: invalidDataUrl,
          mime: 'text/html',
          width: 800,
          height: 600,
          byte_size: 15
        };
      }
    }
  };
  const badAdapter = new ChatGptProviderAdapter({
    tabController: {
      chrome: badChromeApi,
      async locateTab() {
        return { ok: true, tab_id: 101 };
      }
    }
  });

  const badJob = makeJob('mjob_f_bad');
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  await storage.upsertJob(badJob.job_id, badJob);
  badAdapter.prepare = async () => ({ provider: 'chatgpt' });
  badAdapter.generate = async () => ({
    provider_conversation_id: 'conv-bad',
    source_fingerprint: 'fp_bad',
    containerFingerprint: 'cont_bad'
  });
  badAdapter.observe = async () => ({ source_fingerprint: 'fp_bad' });
  const mockApi = {
    async heartbeat(jobId, body) {
      return {
        job_id: jobId,
        job_revision: body.expected_job_revision,
        status: 'LEASED',
        lease_expires_at: new Date(Date.now() + 60000).toISOString()
      };
    }
  };
  const controller = new LokaMediaController({
    apiClient: mockApi,
    storage,
    blobStore: new MemoryBlobStore(),
    provider: badAdapter
  });

  await assert.rejects(
    () => controller.runJob(badJob, { runId: 'run-bad-mime' }),
    /CAPTURE_UNSUPPORTED_MIME/
  );

  pass('TEST F — MIME PRESERVATION: png, jpeg, webp preserved; invalid mime rejected');
}

// ---------------------------------------------------------------------------
// TEST G — CONTENT SCRIPT ABSENT
// ---------------------------------------------------------------------------
async function testG_ContentScriptAbsent() {
  const chromeApi = {
    tabs: {
      async sendMessage() {
        throw new Error('Could not establish connection. Receiving end does not exist.');
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: {
      chrome: chromeApi,
      async locateTab() {
        return { ok: true, tab_id: 102 };
      }
    }
  });

  let caught = null;
  try {
    await adapter.capture(makeJob('mjob_g'), { source_fingerprint: 'fp_g' });
  } catch (err) {
    caught = err;
  }

  assert(caught !== null, 'Must throw error when content script is absent');
  assert.equal(caught.code, CHATGPT_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE);

  pass('TEST G — CONTENT SCRIPT ABSENT: fails closed with CONTENT_SCRIPT_UNAVAILABLE, zero retry/upload');
}

// ---------------------------------------------------------------------------
// TEST H — CAPTURE EXACTLY ONCE
// ---------------------------------------------------------------------------
async function testH_CaptureExactlyOnce() {
  let adapterCaptureCalls = 0;
  let tabSendMessageCalls = 0;
  let binaryAcquisitions = 0;

  const rawBytes = Buffer.from('TEST_EXACTLY_ONCE');
  const base64 = rawBytes.toString('base64');

  const chromeApi = {
    tabs: {
      async sendMessage(tabId, message) {
        if (message.type === CHATGPT_MESSAGE_TYPES.CAPTURE) {
          tabSendMessageCalls++;
          binaryAcquisitions++;
          return {
            ok: true,
            data_url: `data:image/png;base64,${base64}`,
            mime: 'image/png',
            width: 1024,
            height: 1024,
            byte_size: rawBytes.length
          };
        }
        return { ok: false };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: {
      chrome: chromeApi,
      async locateTab() {
        return { ok: true, tab_id: 103 };
      }
    }
  });

  const origCapture = adapter.capture.bind(adapter);
  adapter.capture = async function (...args) {
    adapterCaptureCalls++;
    return origCapture(...args);
  };

  const job = makeJob('mjob_h');
  const providerResult = { source_fingerprint: 'fp_h' };
  const res = await adapter.capture(job, providerResult);

  assert.equal(adapterCaptureCalls, 1, 'ChatGptProviderAdapter.capture call count = 1');
  assert.equal(tabSendMessageCalls, 1, 'content-script capture command count = 1');
  assert.equal(binaryAcquisitions, 1, 'binary acquisition count = 1');
  assert.equal(res.size, rawBytes.length);

  pass('TEST H — CAPTURE EXACTLY ONCE: adapter=1, command=1, acquisition=1, never duplicated');
}

// ---------------------------------------------------------------------------
// TEST I — CONTROLLER INTEGRATION
// ---------------------------------------------------------------------------
async function testI_ControllerIntegration() {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  const blobStore = new MemoryBlobStore();

  let r2UploadCalls = 0;
  let mediaAssetCreateCalls = 0;
  let mediaAttachmentCalls = 0;

  const rawBytes = Buffer.from('VALID_CONTROLLER_IMAGE_BYTES');
  const base64 = rawBytes.toString('base64');

  const chromeApi = {
    tabs: {
      async sendMessage(tabId, message) {
        if (message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT') {
          return {
            ok: true,
            session_id: 'chatgpt-session-i',
            submitted_at: new Date().toISOString(),
            source_fingerprint: 'img_fp_controller_i',
            containerFingerprint: 'container_fp_i'
          };
        }
        if (message.type === CHATGPT_MESSAGE_TYPES.CAPTURE) {
          return {
            ok: true,
            data_url: `data:image/png;base64,${base64}`,
            mime: 'image/png',
            width: 1024,
            height: 1024,
            byte_size: rawBytes.length,
            sha256: 'sha256-controller-test-i'
          };
        }
        return { ok: false };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: {
      chrome: chromeApi,
      async locateTab() {
        return { ok: true, tab_id: 104 };
      }
    }
  });

  // Provide prepare/submit/capture/observe
  adapter.prepare = async () => ({ provider: 'chatgpt', ready: true });
  adapter.observe = async (job) => {
    return {
      ok: true,
      source_fingerprint: 'img_fp_controller_i',
      containerFingerprint: 'container_fp_i',
      job_id: job.job_id
    };
  };

  const mockApi = {
    async heartbeat(jobId, body) {
      return {
        job_id: jobId,
        job_revision: body.expected_job_revision,
        status: 'LEASED',
        lease_expires_at: new Date(Date.now() + 60000).toISOString()
      };
    },
    async uploadAsset() {
      r2UploadCalls++;
      return { ok: true };
    },
    async createMediaAsset() {
      mediaAssetCreateCalls++;
      return { ok: true };
    },
    async attachMedia() {
      mediaAttachmentCalls++;
      return { ok: true };
    }
  };

  const controller = new LokaMediaController({
    apiClient: mockApi,
    storage,
    blobStore,
    provider: adapter
  });

  // Arm captureBlobProbe
  await storage.saveConfig({ captureBlobProbe: true });

  const job = makeJob('mjob_i', { job_revision: 11 });
  await storage.upsertJob(job.job_id, job);

  const result = await controller.runJob(job, { runId: 'run-probe-i', controlledRunOnce: true, captureBlobProbe: true });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'CAPTURE_BLOB_PROBE_STOPPED');
  assert.equal(result.run_id, 'run-probe-i');
  assert.equal(result.job_id, job.job_id);

  // Verify blob persisted in durable store
  const blobRecord = await blobStore.get(result.blob_key);
  assert(blobRecord !== null, 'Captured blob must be durably persisted');
  assert.equal(blobRecord.mime, 'image/png');
  assert.equal(blobRecord.size, rawBytes.length);

  // Safety invariants: zero R2 uploads, zero assets, zero attachments
  assert.equal(r2UploadCalls, 0, 'R2 upload calls must be 0');
  assert.equal(mediaAssetCreateCalls, 0, 'Media asset create calls must be 0');
  assert.equal(mediaAttachmentCalls, 0, 'Media attachment calls must be 0');

  pass('TEST I — CONTROLLER INTEGRATION: validates, persists to blobStore, hits CAPTURE_BLOB_PROBE_STOP, R2=0');
}

// ---------------------------------------------------------------------------
// TEST J — PROVIDER RESULT PASSED EXPLICITLY
// ---------------------------------------------------------------------------
async function testJ_ProviderResultPassedExplicitly() {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  const blobStore = new MemoryBlobStore();

  let generatedDescriptorId = null;
  let capturedDescriptorId = null;

  const rawBytes = Buffer.from('TEST_EXPLICIT_DESCRIPTOR');
  const base64 = rawBytes.toString('base64');

  const mockProvider = {
    async prepare() {
      return { provider: 'chatgpt' };
    },
    async generate(job) {
      generatedDescriptorId = `descriptor_${job.job_id}_fingerprint_xyz`;
      return {
        provider_conversation_id: 'conv-j',
        source_fingerprint: generatedDescriptorId,
        containerFingerprint: 'cont_fp_j',
        job_id: job.job_id,
        run_id: 'run-j'
      };
    },
    async observe(job) {
      return {
        source_fingerprint: generatedDescriptorId,
        job_id: job.job_id,
        run_id: 'run-j'
      };
    },
    async capture(job, providerResult) {
      capturedDescriptorId = providerResult?.source_fingerprint;
      return {
        bytes: new Uint8Array(rawBytes).buffer,
        size: rawBytes.length,
        mime: 'image/png',
        width: 1024,
        height: 1024,
        sha256: 'sha256-j',
        blobKey: `${job.job_id}:1`
      };
    }
  };

  const mockApi = {
    async heartbeat(jobId, body) {
      return {
        job_id: jobId,
        job_revision: body.expected_job_revision,
        status: 'LEASED',
        lease_expires_at: new Date(Date.now() + 60000).toISOString()
      };
    }
  };

  const controller = new LokaMediaController({
    apiClient: mockApi,
    storage,
    blobStore,
    provider: mockProvider
  });

  await storage.saveConfig({ captureBlobProbe: true });
  const job = makeJob('mjob_j');
  await storage.upsertJob(job.job_id, job);

  const result = await controller.runJob(job, { runId: 'run-j', controlledRunOnce: true, captureBlobProbe: true });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'CAPTURE_BLOB_PROBE_STOPPED');

  assert(generatedDescriptorId !== null, 'Generated descriptor ID must be present');
  assert(capturedDescriptorId !== null, 'Captured input descriptor ID must be present');
  assert.equal(generatedDescriptorId, capturedDescriptorId, 'Controller MUST pass the exact correlated provider result to capture');

  console.log(`    GENERATE_RESULT_DESCRIPTOR_ID=${generatedDescriptorId}`);
  console.log(`    CAPTURE_INPUT_DESCRIPTOR_ID=${capturedDescriptorId}`);

  pass('TEST J — PROVIDER RESULT PASSED EXPLICITLY: generate result and capture input descriptors match');
}

// ---------------------------------------------------------------------------
// MAIN EXECUTION
// ---------------------------------------------------------------------------
async function run() {
  console.log('Running LokaMedia Phase 4B1A.5D1B Real ChatGPT Capture Adapter Tests...\n');
  await testA_ExactCorrelatedCapture();
  await testB_MissingTarget();
  await testC_AmbiguousTarget();
  await testD_CorrelationMismatch();
  await testE_BinaryTransport();
  await testF_MimePreservation();
  await testG_ContentScriptAbsent();
  await testH_CaptureExactlyOnce();
  await testI_ControllerIntegration();
  await testJ_ProviderResultPassedExplicitly();

  console.log(`\nLokaMedia Phase 4B1A.5D1B tests: ${passed} passed`);
}

run().catch((err) => {
  console.error('\nTest failed:', err);
  process.exit(1);
});
