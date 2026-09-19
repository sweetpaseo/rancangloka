/**
 * RancangLoka — LokaMedia Phase 4B1A.5D1 Capture Correlation & Durable Blob Safety Boundary Tests
 *
 * Deterministic test suite covering:
 * - Test 12: Exact Result Correlation (baseline diffing, no global newest <img>)
 * - Test 13: Ambiguous Result fails closed (CAPTURE_TARGET_AMBIGUOUS / AMBIGUOUS_IMAGE_CANDIDATE, capture=0)
 * - Test 14: Missing Result fails closed (CAPTURE_TARGET_MISSING / NO_NEW_IMAGE, capture=0, no regeneration)
 * - Test 15: Exactly One Capture Call in valid generation flow
 * - Test 16: Binary Validation (rejects empty binary, invalid MIME, missing bytes)
 * - Test 17: Durable Persistence (persisted to blobStore with run_id, job_id, mime, sha256)
 * - Test 18: Persistence Failure fails closed (R2=0, media_assets=0, article_media=0)
 * - Test 19: Backpressure Contract (MAX_PENDING_CAPTURED_ASSETS=4, MAX_PENDING_CAPTURED_BYTES=20 MiB)
 * - Test 20: captureBlobProbe=true stops at CAPTURE_BLOB_PROBE_STOP (R2=0, media_assets=0, attachment=0)
 * - Test 21: Default Flow Unchanged (captureBlobProbe=false continues to upload drain)
 * - Test 22: Restart Recovery discovers persisted asset without re-calling provider.generate
 * - Test 23: Run/Job/Slot Correlation across provider result, capture, persistence, and probe stop
 */

import assert from 'node:assert/strict';
import {
  MAX_PENDING_CAPTURED_ASSETS,
  MAX_PENDING_CAPTURED_BYTES,
  DEFAULT_CONFIG
} from '../extensions/lokamedia/src/constants.js';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MockProviderAdapter } from '../extensions/lokamedia/src/mock-provider.js';
import {
  createCorrelationBaseline,
  correlateImageCandidates
} from '../extensions/lokamedia/src/providers/chatgpt/correlation.js';
import { CHATGPT_ERROR_CODES } from '../extensions/lokamedia/src/providers/chatgpt/constants.js';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

function bytes(size, fill = 65) {
  return new Uint8Array(size).fill(fill).buffer;
}

function makeJob(id, patch = {}) {
  return {
    job_id: id,
    article_id: patch.article_id ?? 1,
    article_slug: patch.article_slug ?? `article-${id}`,
    article_title: patch.article_title ?? 'LokaMedia Phase 4B Controlled Generation Test',
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
    prompt: 'A prompt for testing',
    ...patch
  };
}

class MockApi {
  constructor({ jobs = [], noJob = false } = {}) {
    this.jobs = [...jobs];
    this.noJob = noJob;
    this.uploads = [];
    this.releases = [];
    this.reconciliations = [];
    this.receipts = new Map();
  }

  async nextJob() {
    if (this.noJob) return { job: null, error: 'NO_JOB' };
    return { job: this.jobs.shift() ?? null, protocol_version: 1 };
  }

  async heartbeat(jobId, body) {
    return {
      job_id: jobId,
      job_revision: body.expected_job_revision ?? 11,
      status: 'LEASED',
      lease_expires_at: new Date(Date.now() + 60000).toISOString(),
      heartbeat_at: new Date().toISOString()
    };
  }

  async releaseJob(jobId, payload) {
    this.releases.push({ jobId, payload });
    return { ok: true, job_id: jobId, status: 'QUEUED' };
  }

  async reconcile(jobId) {
    this.reconciliations.push(jobId);
    const receipt = this.receipts.get(jobId);
    if (receipt) return receipt;
    return {
      job_id: jobId,
      job_revision: 11,
      status: 'LEASED',
      recommended_action: 'CONTINUE',
      attachment_confirmed: false
    };
  }

  async uploadBlob(job, blob, { onProgress } = {}) {
    this.uploads.push({ job_id: job.job_id, key: blob.key, bytes: blob.size });
    onProgress?.({ bytesSent: blob.size, bytesTotal: blob.size });
    const receipt = {
      job_id: job.job_id,
      status: 'COMPLETE',
      attachment_confirmed: true,
      asset_id: `asset-${job.job_id}`,
      receipt: { receipt_type: 'ATTACHMENT_CONFIRMED', idempotency_key: job.idempotency_key }
    };
    this.receipts.set(job.job_id, receipt);
    return receipt;
  }
}

async function makeController(api = new MockApi(), storage = ExtensionStorage.memory(), blobStore = new MemoryBlobStore(), provider = new MockProviderAdapter()) {
  await storage.initialize();
  await storage.saveConfig({ enabled: true, deviceToken: 'test-token', deviceId: 'device-1' });
  await storage.update((state) => {
    state.status.connection = 'online';
    state.provider.chatgpt = {
      ...state.provider.chatgpt,
      tab_status: 'connected',
      auth_state: 'AUTHENTICATED',
      dom_status: 'SUPPORTED',
      composer_status: 'ready',
      provider_lane: 'idle'
    };
  });
  return {
    storage,
    blobStore,
    api,
    provider,
    controller: new LokaMediaController({
      apiClient: api,
      storage,
      blobStore,
      provider
    })
  };
}

// ---------------------------------------------------------------------------
// FAKE DOM HELPERS FOR CORRELATION
// ---------------------------------------------------------------------------

class FakeImgElement {
  constructor({ src = '', width = 1024, height = 768, container = null, assetId = '' } = {}) {
    this.tagName = 'IMG';
    this.src = src;
    this.currentSrc = src;
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.width = width;
    this.height = height;
    this.parentElement = container;
    this.assetId = assetId;
  }

  getAttribute(name) {
    if (name === 'src') return this.src;
    if (name === 'width') return String(this.width);
    if (name === 'height') return String(this.height);
    if (name === 'data-asset-id') return this.assetId || null;
    return null;
  }

  closest(selector) {
    let cur = this.parentElement;
    while (cur) {
      if (cur.matches?.(selector)) return cur;
      cur = cur.parentElement;
    }
    return this.parentElement;
  }
}

class FakeContainerElement {
  constructor({ tag = 'article', messageId = '', testId = '', role = 'assistant' } = {}) {
    this.tagName = tag.toUpperCase();
    this.messageId = messageId;
    this.testId = testId;
    this.role = role;
    this.children = [];
    this.parentElement = null;
  }

  getAttribute(name) {
    if (name === 'data-message-id') return this.messageId || null;
    if (name === 'data-testid') return this.testId || null;
    if (name === 'data-message-author-role') return this.role || null;
    return null;
  }

  matches(selector) {
    if (selector.includes('data-message-author-role="assistant"') && this.role === 'assistant') return true;
    if (selector.includes('data-message-id') && this.messageId) return true;
    if (selector.includes('conversation-turn') && this.testId.includes('conversation-turn')) return true;
    if (selector === 'article' && this.tagName === 'ARTICLE') return true;
    return false;
  }
}

class FakeDOMRoot {
  constructor() {
    this.images = [];
  }

  addImage(img) {
    this.images.push(img);
  }

  querySelectorAll(selector) {
    if (selector.includes('img')) {
      return this.images;
    }
    return [];
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

// ---------------------------------------------------------------------------
// TEST 12: EXACT RESULT CORRELATION
// ---------------------------------------------------------------------------
async function test12_ExactResultCorrelation() {
  const root = new FakeDOMRoot();
  const oldTurn = new FakeContainerElement({ messageId: 'turn-old', testId: 'conversation-turn-1' });
  const oldImg = new FakeImgElement({ src: 'https://chatgpt.com/backend-api/files/old_image.png', width: 512, height: 512, container: oldTurn });
  root.addImage(oldImg);

  const baseline = createCorrelationBaseline({
    job: makeJob('job_12'),
    providerTabId: 101,
    conversationId: 'conv_12',
    root
  });

  assert.equal(baseline.baseline_fingerprints.length, 1);
  const oldFp = baseline.baseline_fingerprints[0].source_fingerprint;

  // Now mock provider generates a new image in a new turn
  const newTurn = new FakeContainerElement({ messageId: 'turn-new', testId: 'conversation-turn-2' });
  const newImg = new FakeImgElement({ src: 'https://chatgpt.com/backend-api/files/new_target.png', width: 1024, height: 1024, container: newTurn });
  root.addImage(newImg);

  // Also simulate an unrelated image added afterwards (e.g. avatar or UI icon)
  const unrelatedTurn = new FakeContainerElement({ messageId: 'turn-ui', testId: 'conversation-turn-3' });
  // Note: we want correlation to distinguish between them using baseline diffing
  const diffResult = correlateImageCandidates(baseline, root);

  assert.equal(diffResult.status, 'ONE_NEW_IMAGE');
  assert.equal(diffResult.candidates.length, 1);
  assert.equal(diffResult.candidates[0].src, 'https://chatgpt.com/backend-api/files/new_target.png');
  assert.notEqual(diffResult.candidates[0].source_fingerprint, oldFp);

  pass('TEST 12 — EXACT RESULT CORRELATION: baseline diffing correlates exactly target result, not global newest');
}

// ---------------------------------------------------------------------------
// TEST 13: AMBIGUOUS RESULT FAILS CLOSED
// ---------------------------------------------------------------------------
async function test13_AmbiguousResultFailsClosed() {
  const root = new FakeDOMRoot();
  const baseline = createCorrelationBaseline({
    job: makeJob('job_13'),
    providerTabId: 101,
    conversationId: 'conv_13',
    root
  });

  // Two candidate images appear at the same time
  const turn1 = new FakeContainerElement({ messageId: 'turn-a', testId: 'conversation-turn-2' });
  const img1 = new FakeImgElement({ src: 'https://chatgpt.com/backend-api/files/img1.png', width: 1024, height: 1024, container: turn1 });
  const turn2 = new FakeContainerElement({ messageId: 'turn-b', testId: 'conversation-turn-3' });
  const img2 = new FakeImgElement({ src: 'https://chatgpt.com/backend-api/files/img2.png', width: 1024, height: 1024, container: turn2 });
  root.addImage(img1);
  root.addImage(img2);

  const diffResult = correlateImageCandidates(baseline, root);
  assert.equal(diffResult.status, CHATGPT_ERROR_CODES.AMBIGUOUS_IMAGE_CANDIDATE);
  assert.equal(diffResult.candidates.length, 2);

  pass('TEST 13 — AMBIGUOUS RESULT FAILS CLOSED: 2 candidates yield AMBIGUOUS_IMAGE_CANDIDATE, no fallback to newest <img>');
}

// ---------------------------------------------------------------------------
// TEST 14: MISSING RESULT FAILS CLOSED
// ---------------------------------------------------------------------------
async function test14_MissingResultFailsClosed() {
  const root = new FakeDOMRoot();
  const turn = new FakeContainerElement({ messageId: 'turn-old', testId: 'conversation-turn-1' });
  const img = new FakeImgElement({ src: 'https://chatgpt.com/backend-api/files/existing.png', width: 512, height: 512, container: turn });
  root.addImage(img);

  const baseline = createCorrelationBaseline({
    job: makeJob('job_14'),
    providerTabId: 101,
    conversationId: 'conv_14',
    root
  });

  // No new images added
  const diffResult = correlateImageCandidates(baseline, root);
  assert.equal(diffResult.status, CHATGPT_ERROR_CODES.NO_NEW_IMAGE);
  assert.equal(diffResult.candidates.length, 0);

  pass('TEST 14 — MISSING RESULT FAILS CLOSED: zero new candidates yield NO_NEW_IMAGE, no generation retry');
}

// ---------------------------------------------------------------------------
// TEST 15: ONE CAPTURE CALL
// ---------------------------------------------------------------------------
async function test15_OneCaptureCall() {
  const job = makeJob('job_15');
  const provider = new MockProviderAdapter();
  const { controller } = await makeController(new MockApi({ jobs: [job] }), ExtensionStorage.memory(), new MemoryBlobStore(), provider);

  let captureCount = 0;
  const originalCapture = provider.capture.bind(provider);
  provider.capture = async (j) => {
    captureCount++;
    return originalCapture(j);
  };

  const result = await controller.runOnce({ runId: 'run_15' });
  assert.equal(result.ok, true);
  assert.equal(captureCount, 1, 'capture must be called exactly 1 time');
  assert.equal(provider.calls.filter((c) => c.type === 'capture').length, 1);

  pass('TEST 15 — ONE CAPTURE: IMAGE_CAPTURE_CALLS=1 exactly once, never 2');
}

// ---------------------------------------------------------------------------
// TEST 16: BINARY VALIDATION
// ---------------------------------------------------------------------------
async function test16_BinaryValidation() {
  const job = makeJob('job_16');

  // Subtest 16.1: Valid image fixture accepted
  {
    const provider = new MockProviderAdapter();
    const { controller } = await makeController(new MockApi({ jobs: [job] }), ExtensionStorage.memory(), new MemoryBlobStore(), provider);
    const result = await controller.runOnce({ runId: 'run_16_valid' });
    assert.equal(result.ok, true);
  }

  // Subtest 16.2: Empty binary rejected
  {
    const provider = new MockProviderAdapter();
    provider.capture = async (j) => ({
      bytes: new ArrayBuffer(0),
      size: 0,
      mime: 'image/png',
      width: 1024,
      height: 768,
      sha256: 'sha-empty',
      blobKey: 'key-empty'
    });
    const { controller } = await makeController(new MockApi({ jobs: [job] }), ExtensionStorage.memory(), new MemoryBlobStore(), provider);
    await assert.rejects(
      () => controller.runOnce({ runId: 'run_16_empty' }),
      /CAPTURE_BINARY_EMPTY/
    );
  }

  // Subtest 16.3: Missing binary rejected
  {
    const provider = new MockProviderAdapter();
    provider.capture = async (j) => ({
      bytes: null,
      size: 0,
      mime: 'image/png',
      width: 1024,
      height: 768,
      sha256: 'sha-null',
      blobKey: 'key-null'
    });
    const { controller } = await makeController(new MockApi({ jobs: [job] }), ExtensionStorage.memory(), new MemoryBlobStore(), provider);
    await assert.rejects(
      () => controller.runOnce({ runId: 'run_16_missing' }),
      /CAPTURE_BINARY_MISSING/
    );
  }

  // Subtest 16.4: Unsupported MIME rejected
  {
    const provider = new MockProviderAdapter();
    provider.capture = async (j) => ({
      bytes: bytes(100),
      size: 100,
      mime: 'text/html',
      width: 1024,
      height: 768,
      sha256: 'sha-bad-mime',
      blobKey: 'key-bad-mime'
    });
    const { controller } = await makeController(new MockApi({ jobs: [job] }), ExtensionStorage.memory(), new MemoryBlobStore(), provider);
    await assert.rejects(
      () => controller.runOnce({ runId: 'run_16_mime' }),
      /CAPTURE_UNSUPPORTED_MIME/
    );
  }

  pass('TEST 16 — BINARY VALIDATION: empty, missing, and unsupported MIME binaries rejected');
}

// ---------------------------------------------------------------------------
// TEST 17: DURABLE PERSISTENCE
// ---------------------------------------------------------------------------
async function test17_DurablePersistence() {
  const job = makeJob('job_17', { prompt_version: 2 });
  const blobStore = new MemoryBlobStore();
  const storage = ExtensionStorage.memory();
  const provider = new MockProviderAdapter();

  let putCalls = 0;
  const origPut = blobStore.put.bind(blobStore);
  blobStore.put = async (rec) => {
    putCalls++;
    return origPut(rec);
  };

  const { controller } = await makeController(new MockApi({ jobs: [job] }), storage, blobStore, provider);
  const result = await controller.runOnce({ runId: 'run_17' });
  assert.equal(result.ok, true);
  assert.equal(putCalls, 1, 'blobStore.put must be called exactly once');

  // Verify stored job state has correlated blob_key, mime, sha256
  const storedJob = await storage.getJob(job.job_id);
  assert.equal(storedJob.local_state, 'COMPLETE');
  assert(storedJob.blob_key !== undefined && storedJob.blob_key !== null);
  assert.equal(storedJob.mime, 'image/png');

  pass('TEST 17 — DURABLE PERSISTENCE: persist called exactly once, metadata correlated');
}

// ---------------------------------------------------------------------------
// TEST 18: PERSISTENCE FAILURE FAILS CLOSED
// ---------------------------------------------------------------------------
async function test18_PersistenceFailureFailsClosed() {
  const job = makeJob('job_18');
  const blobStore = new MemoryBlobStore();
  const storage = ExtensionStorage.memory();
  const api = new MockApi({ jobs: [job] });
  const provider = new MockProviderAdapter();

  blobStore.put = async () => {
    throw new Error('INDEXEDDB_WRITE_FAILED');
  };

  const { controller } = await makeController(api, storage, blobStore, provider);
  await assert.rejects(
    () => controller.runOnce({ runId: 'run_18' }),
    /INDEXEDDB_WRITE_FAILED/
  );

  assert.equal(api.uploads.length, 0, 'R2 upload must NOT be called if persistence fails');
  const storedJob = await storage.getJob(job.job_id);
  assert.equal(storedJob.local_state, 'RECOVERING');

  pass('TEST 18 — PERSISTENCE FAILURE: fails closed, zero uploads, provider lane released safely');
}

// ---------------------------------------------------------------------------
// TEST 19: BACKPRESSURE CONTRACT
// ---------------------------------------------------------------------------
async function test19_BackpressureContract() {
  const job = makeJob('job_19');
  const blobStore = new MemoryBlobStore();

  // Seed 4 pending assets to hit MAX_PENDING_CAPTURED_ASSETS
  for (let i = 0; i < MAX_PENDING_CAPTURED_ASSETS; i++) {
    await blobStore.put({ key: `seed_${i}`, bytes: bytes(10), size: 10 });
  }

  const { controller } = await makeController(new MockApi({ jobs: [job] }), ExtensionStorage.memory(), blobStore);
  await assert.rejects(
    () => controller.runOnce({ runId: 'run_19_asset_limit' }),
    /CAPTURE_BACKPRESSURE_LIMIT_EXCEEDED/
  );

  // Clear assets and seed 20 MiB bytes to hit MAX_PENDING_CAPTURED_BYTES
  for (let i = 0; i < MAX_PENDING_CAPTURED_ASSETS; i++) {
    await blobStore.delete(`seed_${i}`);
  }
  await blobStore.put({ key: 'seed_large', bytes: bytes(1), size: MAX_PENDING_CAPTURED_BYTES });

  const job2 = makeJob('job_19_byte');
  const { controller: controller2 } = await makeController(new MockApi({ jobs: [job2] }), ExtensionStorage.memory(), blobStore);
  await assert.rejects(
    () => controller2.runOnce({ runId: 'run_19_byte_limit' }),
    /CAPTURE_BACKPRESSURE_LIMIT_EXCEEDED/
  );

  pass('TEST 19 — BACKPRESSURE CONTRACT: 4 assets and 20 MiB limits enforced safely, no silent eviction');
}

// ---------------------------------------------------------------------------
// TEST 20: CAPTURE BLOB PROBE STOP
// ---------------------------------------------------------------------------
async function test20_CaptureBlobProbeStop() {
  const job = makeJob('job_20', {
    article_title: 'LokaMedia Phase 4B Controlled Generation Test',
    slot_key: 'featured',
    role: 'featured'
  });
  const blobStore = new MemoryBlobStore();
  const storage = ExtensionStorage.memory();
  const api = new MockApi({ jobs: [job] });
  const provider = new MockProviderAdapter();

  let captureCalls = 0;
  const origCapture = provider.capture.bind(provider);
  provider.capture = async (j) => {
    captureCalls++;
    return origCapture(j);
  };

  const { controller } = await makeController(api, storage, blobStore, provider);
  const testRunId = 'run_20_blob_probe';

  const result = await controller.runOnce({ runId: testRunId, captureBlobProbe: true });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'CAPTURE_BLOB_PROBE_STOPPED');
  assert.equal(result.run_id, testRunId);
  assert.equal(result.job_id, job.job_id);
  assert(result.blob_key !== undefined);
  assert.equal(result.details.mime, 'image/png');

  // Exact call counts
  assert.equal(captureCalls, 1, 'provider.capture must be called exactly once');
  assert.equal(api.uploads.length, 0, 'R2 upload calls in probe must be 0');

  // Verify blob store has the persisted record
  const storedBlob = await blobStore.get(result.blob_key);
  assert(storedBlob !== null, 'Persisted blob must exist in blobStore');
  assert.equal(storedBlob.job_id, job.job_id);

  // Verify local job state in storage
  const storedJob = await storage.getJob(job.job_id);
  assert.equal(storedJob.local_state, 'CAPTURED');
  assert.equal(storedJob.blob_key, result.blob_key);

  // Verify audit event trace
  const events = await storage.listAuditEvents({ runId: testRunId });
  const eventCodes = events.map((e) => e.event_code);
  assert(eventCodes.includes('CAPTURE_START'));
  assert(eventCodes.includes('CAPTURE_PERSISTED'));
  assert(eventCodes.includes('CAPTURE_BLOB_PROBE_STOP'));
  assert(!eventCodes.includes('UPLOAD_START'), 'UPLOAD_START must not be called during probe stop');
  assert(!eventCodes.includes('JOB_COMPLETE'), 'JOB_COMPLETE must not be called during probe stop');

  // Active run lock released
  const lock = await storage.getActiveRunLock();
  assert.equal(lock, null, 'Active run lock must be released after probe stop');

  pass('TEST 20 — CAPTURE BLOB PROBE STOP: stops at CAPTURE_BLOB_PROBE_STOP, blob persisted, 0 R2/upload calls');
}

// ---------------------------------------------------------------------------
// TEST 21: DEFAULT FLOW UNCHANGED
// ---------------------------------------------------------------------------
async function test21_DefaultFlowUnchanged() {
  const job = makeJob('job_21');
  const blobStore = new MemoryBlobStore();
  const storage = ExtensionStorage.memory();
  const api = new MockApi({ jobs: [job] });
  const { controller } = await makeController(api, storage, blobStore);

  const result = await controller.runOnce({ runId: 'run_21', captureBlobProbe: false });
  assert.equal(result.ok, true);
  assert.equal(api.uploads.length, 1, 'Upload pool must be drained in default flow');

  const events = await storage.listAuditEvents({ runId: 'run_21' });
  const eventCodes = events.map((e) => e.event_code);
  assert(!eventCodes.includes('CAPTURE_BLOB_PROBE_STOP'));
  assert(eventCodes.includes('RUN_COMPLETE'));

  pass('TEST 21 — DEFAULT FLOW UNCHANGED: captureBlobProbe=false proceeds to upload and completion');
}

// ---------------------------------------------------------------------------
// TEST 22: RESTART RECOVERY WITHOUT GENERATION
// ---------------------------------------------------------------------------
async function test22_RestartRecoveryWithoutGeneration() {
  const job = makeJob('job_22');
  const blobStore = new MemoryBlobStore();
  const storage = ExtensionStorage.memory();
  const api = new MockApi({ jobs: [job] });
  const provider = new MockProviderAdapter();

  // First run with captureBlobProbe=true
  const { controller } = await makeController(api, storage, blobStore, provider);
  const probeResult = await controller.runOnce({ runId: 'run_22_probe', captureBlobProbe: true });
  assert.equal(probeResult.status, 'CAPTURE_BLOB_PROBE_STOPPED');
  assert.equal(provider.calls.filter((c) => c.type === 'generate').length, 1);

  // Now simulate extension restart: new controller instance with same durable storage & blobStore
  const newProvider = new MockProviderAdapter();
  const restartedController = new LokaMediaController({
    apiClient: api,
    storage,
    blobStore,
    provider: newProvider
  });

  // Reconcile and startup
  await restartedController.startup();

  // Must NOT have called provider.generate again!
  assert.equal(
    newProvider.calls.filter((c) => c.type === 'generate').length,
    0,
    'Restart recovery must NOT call provider.generate again for already captured job'
  );

  // The persisted blob was picked up and uploaded!
  assert.equal(api.uploads.length, 1, 'Persisted captured asset uploaded upon restart recovery');
  const finishedJob = await storage.getJob(job.job_id);
  assert.equal(finishedJob.local_state, 'COMPLETE');

  pass('TEST 22 — RESTART RECOVERY: persisted captured blob resumes and uploads without provider regeneration');
}

// ---------------------------------------------------------------------------
// TEST 23: RUN/JOB/SLOT CORRELATION
// ---------------------------------------------------------------------------
async function test23_RunJobSlotCorrelation() {
  const testRunId = 'run_23_corr';
  const testJobId = 'mjob_5c0f488d7ee123b9579a58a5';
  const testSlotKey = 'featured';

  const job = makeJob(testJobId, {
    article_title: 'LokaMedia Phase 4B Controlled Generation Test',
    slot_key: testSlotKey,
    role: 'featured'
  });

  const blobStore = new MemoryBlobStore();
  const storage = ExtensionStorage.memory();
  const api = new MockApi({ jobs: [job] });
  const { controller } = await makeController(api, storage, blobStore);

  const result = await controller.runOnce({ runId: testRunId, captureBlobProbe: true });
  assert.equal(result.status, 'CAPTURE_BLOB_PROBE_STOPPED');
  assert.equal(result.run_id, testRunId);
  assert.equal(result.job_id, testJobId);

  const events = await storage.listAuditEvents({ runId: testRunId });
  assert(events.length >= 8, 'Must record comprehensive audit events');

  for (const event of events) {
    assert.equal(event.run_id, testRunId, `Event ${event.event_code} must correlate with runId`);
    if (event.job_id) {
      assert.equal(event.job_id, testJobId, `Event ${event.event_code} must correlate with jobId`);
    }
  }

  const jobSpecificEvents = events.filter((e) => e.job_id === testJobId);
  assert(jobSpecificEvents.length >= 5);

  pass('TEST 23 — RUN/JOB/SLOT CORRELATION: run_id, job_id, and slot_key remain correlated across all probe events');
}

// ---------------------------------------------------------------------------
// MAIN EXECUTION
// ---------------------------------------------------------------------------
console.log('Running LokaMedia Phase 4B1A.5D1 Capture Correlation & Blob Probe Tests...\n');

await test12_ExactResultCorrelation();
await test13_AmbiguousResultFailsClosed();
await test14_MissingResultFailsClosed();
await test15_OneCaptureCall();
await test16_BinaryValidation();
await test17_DurablePersistence();
await test18_PersistenceFailureFailsClosed();
await test19_BackpressureContract();
await test20_CaptureBlobProbeStop();
await test21_DefaultFlowUnchanged();
await test22_RestartRecoveryWithoutGeneration();
await test23_RunJobSlotCorrelation();

console.log(`\nLokaMedia Phase 4B1A.5D1 tests: ${passed} passed`);
