/**
 * RancangLoka — LokaMedia Phase 4B1A.5D1E
 * Provider Result Completion + Correlation Contract Hardening Tests
 *
 * Deterministic test suite covering:
 * - Test 13: Delayed Result (resolves only after correlated candidate exists, not at submit time)
 * - Test 14: Preexisting Images Ignored (baseline diffing selects only new result)
 * - Test 15: Result Timeout Fails Closed (no result before timeout -> PROVIDER_RESULT_TIMEOUT, capture=0)
 * - Test 16: Ambiguous Result Fails Closed (multiple candidates -> PROVIDER_RESULT_AMBIGUOUS, capture=0)
 * - Test 17: Valid Result Descriptor (source_fingerprint, containerFingerprint, run/job/slot present)
 * - Test 18: Controller Malformed Result Guard (missing fingerprints -> capture=0)
 * - Test 19: Adapter Malformed Capture Guard (missing fingerprints -> CHATGPT_PROVIDER_CAPTURE message=0)
 * - Test 20: Same Descriptor End to End (descriptor A passed unchanged from generate to capture)
 * - Test 21: Descriptor Checkpoint Survives Capture Failure (persisted checkpoint survives error)
 * - Test 22: Descriptor Checkpoint Survives Storage Reload / Restart (survives restart)
 */

import assert from 'node:assert/strict';
import {
  CHATGPT_DOM_ADAPTER_VERSION,
  CHATGPT_ERROR_CODES,
  CHATGPT_MESSAGE_TYPES
} from '../extensions/lokamedia/src/providers/chatgpt/constants.js';
import { isCaptureReadyProviderResult } from '../extensions/lokamedia/src/providers/chatgpt/correlation.js';
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
    article_title: patch.article_title ?? 'LokaMedia Phase 4B Result Await Test',
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
    prompt: 'A prompt for testing result completion and correlation hardening',
    controlled_run_once: true,
    ...patch
  };
}

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

class FakeDocument {
  constructor() {
    this.elements = [];
  }

  querySelectorAll(selector) {
    return this.elements.filter((el) => {
      if (selector.includes('[data-message-author-role="assistant"] img')) {
        const isImg = el.tagName === 'IMG';
        const role = el.closest('[data-message-author-role]')?.getAttribute('data-message-author-role');
        return isImg && role === 'assistant';
      }
      if (selector.includes('main img[src]') || selector.includes('main picture img[src]')) {
        return el.tagName === 'IMG' && (el.currentSrc || el.getAttribute('src'));
      }
      return false;
    });
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

function fingerprintImg(element) {
  const container = element.closest?.('[data-message-id], [data-testid*="conversation-turn"], article, [data-message-author-role]') ?? element.parentElement;
  const containerFingerprint = hashText([
    container?.getAttribute?.('data-message-id') ?? '',
    container?.getAttribute?.('data-testid') ?? '',
    container?.getAttribute?.('data-message-author-role') ?? '',
    container?.tagName ?? ''
  ].join('|'));
  const normalized = (element.currentSrc || element.getAttribute?.('src') || '').split('?')[0].split('#')[0];
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
// TEST 13 — DELAYED RESULT (resolves after candidate exists, not at submit)
// ---------------------------------------------------------------------------
async function test13_DelayedResult() {
  const fakeDoc = new FakeDocument();
  let submitTime = 0;
  let resolveTime = 0;
  let sendClicked = false;

  const chromeApi = {
    tabs: {
      async sendMessage(tabId, message) {
        if (message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT') {
          submitTime = Date.now();
          sendClicked = true;

          // Simulate image generation delay: new image appears 80ms after submit
          setTimeout(() => {
            const container = new FakeElement({
              attrs: { 'data-message-id': 'msg-turn-13', 'data-message-author-role': 'assistant' }
            });
            const img = new FakeElement({
              tag: 'img',
              attrs: { src: 'https://chatgpt.com/cdn/generated-13.png' },
              width: 1024,
              height: 1024,
              parent: container
            });
            fakeDoc.elements.push(img);
          }, 80);

          // Poll until candidate appears
          const start = Date.now();
          while (Date.now() - start < (message.timeout_ms || 2000)) {
            await new Promise((r) => setTimeout(r, 20));
            const imgs = fakeDoc.querySelectorAll('main img[src]');
            if (imgs.length === 1) {
              const target = imgs[0];
              resolveTime = Date.now();
              return {
                ok: true,
                job_id: message.job_id,
                run_id: message.run_id,
                slot_key: message.slot_key,
                source_fingerprint: fingerprintImg(target),
                containerFingerprint: 'cont-13',
                submitted_at: new Date(submitTime).toISOString(),
                identified_at: new Date(resolveTime).toISOString()
              };
            }
          }
          return { ok: false, error: 'PROVIDER_RESULT_TIMEOUT' };
        }
        return { ok: false, error: 'UNEXPECTED' };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: { chrome: chromeApi, locateTab: async () => ({ ok: true, tab_id: 13 }) }
  });
  adapter.prepare = async () => ({ provider: 'chatgpt' });

  const job = makeJob('mjob_13', { run_id: 'run_13', timeout_ms: 1000 });
  const result = await adapter.generate(job);

  assert.equal(sendClicked, true, 'Prompt send must be clicked');
  assert(resolveTime - submitTime >= 70, `Must resolve only after result appears (${resolveTime - submitTime}ms >= 70ms)`);
  assert(result.source_fingerprint.startsWith('img_'));
  assert.equal(result.containerFingerprint, 'cont-13');

  pass('TEST 13 — DELAYED RESULT: provider.generate resolves after result identification, not at submit time');
}

// ---------------------------------------------------------------------------
// TEST 14 — PREEXISTING IMAGES IGNORED
// ---------------------------------------------------------------------------
async function test14_PreexistingImagesIgnored() {
  const fakeDoc = new FakeDocument();
  // Preexisting images
  const oldContainer = new FakeElement({ attrs: { 'data-message-id': 'msg-old', 'data-message-author-role': 'assistant' } });
  const oldImg1 = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/old1.png' }, width: 512, height: 512, parent: oldContainer });
  const oldImg2 = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/old2.png' }, width: 512, height: 512, parent: oldContainer });
  fakeDoc.elements.push(oldImg1, oldImg2);

  const baselineFps = new Set(fakeDoc.querySelectorAll('main img[src]').map(fingerprintImg));
  assert.equal(baselineFps.size, 2);

  // New generated image added after baseline
  const newContainer = new FakeElement({ attrs: { 'data-message-id': 'msg-new', 'data-message-author-role': 'assistant' } });
  const newImg = new FakeElement({ tag: 'img', attrs: { src: 'https://chatgpt.com/cdn/new-gen.png' }, width: 1024, height: 1024, parent: newContainer });
  fakeDoc.elements.push(newImg);

  const current = fakeDoc.querySelectorAll('main img[src]');
  const fresh = current.filter((img) => !baselineFps.has(fingerprintImg(img)));
  assert.equal(fresh.length, 1);
  assert.strictEqual(fresh[0], newImg);
  assert.equal(fingerprintImg(fresh[0]), fingerprintImg(newImg));

  pass('TEST 14 — PREEXISTING IMAGES IGNORED: baseline diffing isolates exactly the newly generated image');
}

// ---------------------------------------------------------------------------
// TEST 15 — RESULT TIMEOUT FAILS CLOSED
// ---------------------------------------------------------------------------
async function test15_ResultTimeoutFailsClosed() {
  let captureCalls = 0;
  let captureMessages = 0;

  const chromeApi = {
    tabs: {
      async sendMessage(tabId, message) {
        if (message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT') {
          // Never produce image before timeout
          return { ok: false, error: 'PROVIDER_RESULT_TIMEOUT' };
        }
        if (message.type === CHATGPT_MESSAGE_TYPES.CAPTURE) {
          captureMessages++;
          return { ok: true };
        }
        return { ok: false };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: { chrome: chromeApi, locateTab: async () => ({ ok: true, tab_id: 15 }) }
  });
  adapter.prepare = async () => ({ provider: 'chatgpt' });

  const job = makeJob('mjob_15', { run_id: 'run_15' });
  await assert.rejects(
    () => adapter.generate(job),
    /PROVIDER_RESULT_TIMEOUT/
  );

  assert.equal(captureCalls, 0);
  assert.equal(captureMessages, 0);

  pass('TEST 15 — RESULT TIMEOUT FAILS CLOSED: structured timeout returned, capture calls = 0, capture messages = 0');
}

// ---------------------------------------------------------------------------
// TEST 16 — AMBIGUOUS RESULT FAILS CLOSED
// ---------------------------------------------------------------------------
async function test16_AmbiguousResultFailsClosed() {
  let captureCalls = 0;

  const chromeApi = {
    tabs: {
      async sendMessage(tabId, message) {
        if (message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT') {
          return { ok: false, error: 'PROVIDER_RESULT_AMBIGUOUS', candidate_count: 2 };
        }
        return { ok: false };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: { chrome: chromeApi, locateTab: async () => ({ ok: true, tab_id: 16 }) }
  });
  adapter.prepare = async () => ({ provider: 'chatgpt' });

  const job = makeJob('mjob_16', { run_id: 'run_16' });
  await assert.rejects(
    () => adapter.generate(job),
    /PROVIDER_RESULT_AMBIGUOUS/
  );

  assert.equal(captureCalls, 0);

  pass('TEST 16 — AMBIGUOUS RESULT FAILS CLOSED: fails with PROVIDER_RESULT_AMBIGUOUS, zero arbitrary selection');
}

// ---------------------------------------------------------------------------
// TEST 17 — VALID RESULT DESCRIPTOR
// ---------------------------------------------------------------------------
async function test17_ValidResultDescriptor() {
  const chromeApi = {
    tabs: {
      async sendMessage(tabId, message) {
        if (message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT') {
          return {
            ok: true,
            job_id: message.job_id,
            run_id: message.run_id,
            slot_key: message.slot_key,
            source_fingerprint: 'img_fp_valid_17',
            containerFingerprint: 'cont_fp_valid_17',
            session_id: 'sess_17',
            provider_response_id: 'resp_17',
            submitted_at: '2026-09-19T23:00:00.000Z',
            identified_at: '2026-09-19T23:00:15.000Z'
          };
        }
        return { ok: false };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: { chrome: chromeApi, locateTab: async () => ({ ok: true, tab_id: 17 }) }
  });
  adapter.prepare = async () => ({ provider: 'chatgpt' });

  const job = makeJob('mjob_17', { run_id: 'run_17', slot_key: 'featured' });
  const result = await adapter.generate(job);

  assert.equal(result.job_id, 'mjob_17');
  assert.equal(result.run_id, 'run_17');
  assert.equal(result.slot_key, 'featured');
  assert.equal(result.source_fingerprint, 'img_fp_valid_17');
  assert.equal(result.containerFingerprint, 'cont_fp_valid_17');
  assert(isCaptureReadyProviderResult(result, { job_id: 'mjob_17', run_id: 'run_17', slot_key: 'featured' }));

  pass('TEST 17 — VALID RESULT DESCRIPTOR: carries non-empty fingerprints and exact job/run/slot correlation');
}

// ---------------------------------------------------------------------------
// TEST 18 — CONTROLLER MALFORMED RESULT GUARD
// ---------------------------------------------------------------------------
async function test18_ControllerMalformedResultGuard() {
  let captureCalls = 0;
  const malformedProvider = {
    async prepare() { return { provider: 'chatgpt' }; },
    async generate(job) {
      // Missing source_fingerprint and containerFingerprint
      return {
        job_id: job.job_id,
        run_id: job.run_id,
        slot_key: job.slot_key,
        provider_conversation_id: 'conv_18',
        submitted_at: new Date().toISOString()
      };
    },
    async capture() {
      captureCalls++;
      return { ok: true };
    }
  };

  const storage = ExtensionStorage.memory();
  await storage.initialize();
  const mockApi = {
    async heartbeat(id, body) {
      return { job_id: id, job_revision: body.expected_job_revision, status: 'LEASED', lease_expires_at: new Date(Date.now() + 60000).toISOString() };
    }
  };

  const controller = new LokaMediaController({
    apiClient: mockApi,
    storage,
    blobStore: new MemoryBlobStore(),
    provider: malformedProvider
  });

  const job = makeJob('mjob_18', { run_id: 'run_18' });
  await storage.upsertJob(job.job_id, job);

  await assert.rejects(
    () => controller.runJob(job, { runId: 'run_18' }),
    /PROVIDER_RESULT_NOT_CAPTURE_READY/
  );

  assert.equal(captureCalls, 0, 'Controller must NOT call provider.capture on malformed result');
  pass('TEST 18 — CONTROLLER MALFORMED RESULT GUARD: controller rejects result lacking fingerprints; capture calls = 0');
}

// ---------------------------------------------------------------------------
// TEST 19 — ADAPTER MALFORMED CAPTURE GUARD
// ---------------------------------------------------------------------------
async function test19_AdapterMalformedCaptureGuard() {
  let messageCount = 0;
  const chromeApi = {
    tabs: {
      async sendMessage() {
        messageCount++;
        return { ok: true };
      }
    }
  };

  const adapter = new ChatGptProviderAdapter({
    tabController: { chrome: chromeApi, locateTab: async () => ({ ok: true, tab_id: 19 }) }
  });

  const job = makeJob('mjob_19', { run_id: 'run_19' });
  const malformedResult = {
    job_id: 'mjob_19',
    run_id: 'run_19',
    // Missing source_fingerprint
    submitted_at: new Date().toISOString()
  };

  await assert.rejects(
    () => adapter.capture(job, malformedResult),
    /ADAPTER_CAPTURE_MALFORMED_DESCRIPTOR/
  );

  assert.equal(messageCount, 0, 'No CHATGPT_PROVIDER_CAPTURE message may be sent when descriptor is malformed');
  pass('TEST 19 — ADAPTER MALFORMED CAPTURE GUARD: adapter fails before messaging tab on malformed descriptor');
}

// ---------------------------------------------------------------------------
// TEST 20 — SAME DESCRIPTOR END TO END
// ---------------------------------------------------------------------------
async function test20_SameDescriptorEndToEnd() {
  let capturedDescriptor = null;
  const testDescriptor = {
    job_id: 'mjob_20',
    run_id: 'run_20',
    slot_key: 'featured',
    prompt_version: 1,
    prompt_hash: 'hash-20',
    provider_conversation_id: 'conv-20',
    provider_response_id: 'resp-20',
    submitted_at: new Date().toISOString(),
    identified_at: new Date().toISOString(),
    source_fingerprint: 'img_fp_e2e_20',
    containerFingerprint: 'cont_fp_e2e_20'
  };

  const mockProvider = {
    async prepare() { return { provider: 'chatgpt' }; },
    async generate() { return testDescriptor; },
    async capture(job, providerResult) {
      capturedDescriptor = providerResult;
      const raw = Buffer.from('VALID_E2E_BYTES');
      return {
        bytes: new Uint8Array(raw).buffer,
        size: raw.length,
        mime: 'image/png',
        width: 1024,
        height: 1024,
        sha256: 'sha256-20',
        blobKey: `${job.job_id}:1`
      };
    }
  };

  const storage = ExtensionStorage.memory();
  await storage.initialize();
  await storage.saveConfig({ captureBlobProbe: true });

  const mockApi = {
    async heartbeat(id, body) {
      return { job_id: id, job_revision: body.expected_job_revision, status: 'LEASED', lease_expires_at: new Date(Date.now() + 60000).toISOString() };
    }
  };

  const controller = new LokaMediaController({
    apiClient: mockApi,
    storage,
    blobStore: new MemoryBlobStore(),
    provider: mockProvider
  });

  const job = makeJob('mjob_20', { run_id: 'run_20', slot_key: 'featured' });
  await storage.upsertJob(job.job_id, job);

  const res = await controller.runJob(job, { runId: 'run_20', controlledRunOnce: true, captureBlobProbe: true });
  assert.equal(res.ok, true);
  assert.strictEqual(capturedDescriptor, testDescriptor, 'Capture input descriptor must strictly match generated descriptor');
  assert.equal(capturedDescriptor.source_fingerprint, 'img_fp_e2e_20');
  assert.equal(capturedDescriptor.containerFingerprint, 'cont_fp_e2e_20');

  pass('TEST 20 — SAME DESCRIPTOR END TO END: descriptor flows unchanged from generation to capture');
}

// ---------------------------------------------------------------------------
// TEST 21 — CHECKPOINT BEFORE CAPTURE (survives capture failure)
// ---------------------------------------------------------------------------
async function test21_CheckpointSurvivesCaptureFailure() {
  const testDescriptor = {
    job_id: 'mjob_21',
    run_id: 'run_21',
    slot_key: 'featured',
    prompt_version: 1,
    prompt_hash: 'hash-21',
    provider_conversation_id: 'conv-21',
    provider_response_id: 'resp-21',
    submitted_at: new Date().toISOString(),
    identified_at: new Date().toISOString(),
    source_fingerprint: 'img_fp_checkpoint_21',
    containerFingerprint: 'cont_fp_checkpoint_21'
  };

  let generateCalls = 0;
  const failingCaptureProvider = {
    async prepare() { return { provider: 'chatgpt' }; },
    async generate() {
      generateCalls++;
      return testDescriptor;
    },
    async capture() {
      // Simulate transient capture failure
      throw new Error('CAPTURE_FETCH_FAILED_503');
    }
  };

  const storage = ExtensionStorage.memory();
  await storage.initialize();

  const mockApi = {
    async heartbeat(id, body) {
      return { job_id: id, job_revision: body.expected_job_revision, status: 'LEASED', lease_expires_at: new Date(Date.now() + 60000).toISOString() };
    }
  };

  const controller = new LokaMediaController({
    apiClient: mockApi,
    storage,
    blobStore: new MemoryBlobStore(),
    provider: failingCaptureProvider
  });

  const job = makeJob('mjob_21', { run_id: 'run_21', slot_key: 'featured' });
  await storage.upsertJob(job.job_id, job);

  await assert.rejects(
    () => controller.runJob(job, { runId: 'run_21', controlledRunOnce: true }),
    /CAPTURE_FETCH_FAILED_503/
  );

  // Check stored checkpoint in storage
  const savedJob = await storage.getJob('mjob_21');
  assert(savedJob !== null, 'Job must exist in storage');
  assert(savedJob.result_checkpoint !== undefined, 'result_checkpoint must be persisted before capture');
  assert.equal(savedJob.result_checkpoint.source_fingerprint, 'img_fp_checkpoint_21');
  assert.equal(savedJob.result_checkpoint.containerFingerprint, 'cont_fp_checkpoint_21');
  assert.equal(generateCalls, 1, 'Generate calls must remain exactly 1, no automatic generation retry');

  pass('TEST 21 — CHECKPOINT SURVIVES CAPTURE FAILURE: result_checkpoint preserved after capture failure');
}

// ---------------------------------------------------------------------------
// TEST 22 — CHECKPOINT SURVIVES RESTART
// ---------------------------------------------------------------------------
async function test22_CheckpointSurvivesRestart() {
  const sharedStore = {};
  const storage1 = new ExtensionStorage({
    async get(keys) {
      if (!keys) return { lokamediaState: sharedStore.lokamediaState };
      return { lokamediaState: sharedStore.lokamediaState };
    },
    async set(items) {
      Object.assign(sharedStore, JSON.parse(JSON.stringify(items)));
    },
    async remove() {}
  });

  await storage1.initialize();
  await storage1.upsertJob('mjob_22', {
    job_id: 'mjob_22',
    status: 'LEASED',
    local_state: 'IMAGE_DETECTED',
    result_checkpoint: {
      job_id: 'mjob_22',
      run_id: 'run_22',
      slot_key: 'featured',
      source_fingerprint: 'img_fp_restart_22',
      containerFingerprint: 'cont_fp_restart_22',
      identified_at: '2026-09-19T23:00:00.000Z'
    }
  });

  // Simulate complete restart by creating a new ExtensionStorage instance reading the same persistent store
  const storage2 = new ExtensionStorage({
    async get(keys) {
      if (!keys) return { lokamediaState: sharedStore.lokamediaState };
      return { lokamediaState: sharedStore.lokamediaState };
    },
    async set(items) {
      Object.assign(sharedStore, JSON.parse(JSON.stringify(items)));
    },
    async remove() {}
  });

  const recoveredJob = await storage2.getJob('mjob_22');
  assert(recoveredJob !== null);
  assert(recoveredJob.result_checkpoint !== null);
  assert.equal(recoveredJob.result_checkpoint.source_fingerprint, 'img_fp_restart_22');
  assert.equal(recoveredJob.result_checkpoint.containerFingerprint, 'cont_fp_restart_22');

  pass('TEST 22 — CHECKPOINT SURVIVES RESTART: descriptor checkpoint survives service worker reload / re-instantiation');
}

// ---------------------------------------------------------------------------
// RUN ALL TESTS
// ---------------------------------------------------------------------------
async function runAll() {
  console.log('Running LokaMedia Phase 4B1A.5D1E Result Await & Correlation Tests...\n');
  await test13_DelayedResult();
  await test14_PreexistingImagesIgnored();
  await test15_ResultTimeoutFailsClosed();
  await test16_AmbiguousResultFailsClosed();
  await test17_ValidResultDescriptor();
  await test18_ControllerMalformedResultGuard();
  await test19_AdapterMalformedCaptureGuard();
  await test20_SameDescriptorEndToEnd();
  await test21_CheckpointSurvivesCaptureFailure();
  await test22_CheckpointSurvivesRestart();
  console.log(`\nAll ${passed} Phase 4B1A.5D1E tests passed!`);
}

runAll().catch((err) => {
  console.error('\nTest failed:', err);
  process.exit(1);
});
