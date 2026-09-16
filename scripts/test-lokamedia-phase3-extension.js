/**
 * RancangLoka — LokaMedia Phase 3 MV3 extension core tests.
 *
 * This suite runs without Chrome, ChatGPT, production services, or model calls.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXTENSION_VERSION,
  IMAGE_CAPTURE_CONCURRENCY,
  LOKAMEDIA_PROTOCOL_VERSION,
  MAX_PENDING_CAPTURED_ASSETS,
  MAX_PENDING_CAPTURED_BYTES,
  PROVIDER_GENERATION_CONCURRENCY,
  STORAGE_SCHEMA_VERSION,
  UPLOAD_CONCURRENCY
} from '../extensions/lokamedia/src/constants.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { BackpressureController } from '../extensions/lokamedia/src/backpressure.js';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { HeartbeatManager } from '../extensions/lokamedia/src/heartbeat-manager.js';
import { MessageProtocol } from '../extensions/lokamedia/src/messages.js';
import { MockProviderAdapter } from '../extensions/lokamedia/src/mock-provider.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { UploadWorkerPool } from '../extensions/lokamedia/src/upload-worker-pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'extensions', 'lokamedia');

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
    article_id: patch.article_id ?? `article-${id}`,
    article_slug: `article-${id}`,
    article_title: `Article ${id}`,
    slot_key: patch.slot_key ?? `slot_${id}`,
    role: patch.role ?? 'inline',
    sequence: patch.sequence ?? 1,
    prompt_version: patch.prompt_version ?? 1,
    prompt_hash: patch.prompt_hash ?? `hash-${id}`,
    idempotency_key: patch.idempotency_key ?? `idem-${id}`,
    job_revision: patch.job_revision ?? 1,
    lease_owner: patch.lease_owner ?? 'device-1',
    alt_text: `Alt ${id}`,
    status: patch.status ?? 'LEASED',
    ...patch
  };
}

class MockApi {
  constructor({ jobs = [], noJob = false, protocolVersion = LOKAMEDIA_PROTOCOL_VERSION, authRequired = false } = {}) {
    this.jobs = [...jobs];
    this.noJob = noJob;
    this.protocolVersion = protocolVersion;
    this.authRequired = authRequired;
    this.heartbeats = [];
    this.uploads = [];
    this.reconciliations = [];
    this.receipts = new Map();
    this.leaseLost = false;
    this.uploadDelayMs = 0;
    this.lostUploadResponse = false;
  }

  async nextJob() {
    if (this.authRequired) return { error: 'AUTH_REQUIRED' };
    if (this.protocolVersion !== LOKAMEDIA_PROTOCOL_VERSION) return { protocol_version: this.protocolVersion };
    if (this.noJob || this.jobs.length === 0) return { protocol_version: LOKAMEDIA_PROTOCOL_VERSION, job: null };
    return { protocol_version: LOKAMEDIA_PROTOCOL_VERSION, job: this.jobs.shift() };
  }

  async heartbeat(jobId, body) {
    this.heartbeats.push({ jobId, body });
    if (this.leaseLost) return { error: 'LEASE_NOT_OWNER', status: 'RECOVERING', recommended_action: 'STOP' };
    return { job_id: jobId, job_revision: body.job_revision, status: 'LEASED' };
  }

  async reconcile(jobId) {
    this.reconciliations.push(jobId);
    const receipt = this.receipts.get(jobId);
    if (receipt) return receipt;
    return {
      job_id: jobId,
      job_revision: 2,
      status: 'LEASED',
      recommended_action: 'CONTINUE',
      attachment_confirmed: false
    };
  }

  async uploadBlob(job, blob, { onProgress } = {}) {
    this.uploads.push({ job_id: job.job_id, key: blob.key });
    if (this.uploadDelayMs) await new Promise((resolve) => setTimeout(resolve, this.uploadDelayMs));
    onProgress?.({ bytesSent: 0, bytesTotal: blob.size });
    onProgress?.({ bytesSent: blob.size, bytesTotal: blob.size });
    const receipt = {
      job_id: job.job_id,
      status: 'COMPLETE',
      attachment_confirmed: true,
      asset_id: `asset-${job.job_id}`,
      receipt: { receipt_type: 'ATTACHMENT_CONFIRMED', idempotency_key: job.idempotency_key }
    };
    this.receipts.set(job.job_id, receipt);
    if (this.lostUploadResponse) {
      this.lostUploadResponse = false;
      throw new Error('NETWORK_RESPONSE_LOST');
    }
    return receipt;
  }
}

async function makeController(api = new MockApi(), storage = ExtensionStorage.memory(), blobStore = new MemoryBlobStore()) {
  await storage.initialize();
  await storage.saveConfig({ enabled: true, deviceToken: 'test-token', deviceId: 'device-1' });
  return {
    storage,
    blobStore,
    api,
    controller: new LokaMediaController({
      apiClient: api,
      storage,
      blobStore,
      provider: new MockProviderAdapter()
    })
  };
}

async function seedCaptured(storage, blobStore, job) {
  const blobKey = `${job.job_id}:sha`;
  await blobStore.put({
    key: blobKey,
    job_id: job.job_id,
    sha256: `sha-${job.job_id}`,
    mime: 'image/png',
    size: 8,
    bytes: bytes(8)
  });
  await storage.upsertJob(job.job_id, { ...job, local_state: 'CAPTURED', blob_key: blobKey });
  await storage.enqueueUpload(job.job_id);
  return blobKey;
}

async function testManifestAndConstants() {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, EXTENSION_VERSION);
  assert.equal(manifest.background.type, 'module');
  assert.deepEqual(manifest.permissions.sort(), ['alarms', 'scripting', 'storage', 'tabs']);
  assert(!JSON.stringify(manifest).includes('<all_urls>'));
  assert(!JSON.stringify(manifest).includes('chat.openai.com'));
  assert.equal(STORAGE_SCHEMA_VERSION, 1);
  assert.equal(LOKAMEDIA_PROTOCOL_VERSION, 1);
  assert.equal(PROVIDER_GENERATION_CONCURRENCY, 1);
  assert.equal(IMAGE_CAPTURE_CONCURRENCY, 1);
  assert.equal(UPLOAD_CONCURRENCY, 2);
  pass('MV3 manifest, minimal permissions, versions, and concurrency constants');
}

async function testFreshStartupAndNoJob() {
  const { controller, storage } = await makeController(new MockApi({ noJob: true }));
  const startup = await controller.startup();
  assert.deepEqual(startup, []);
  const tick = await controller.tick();
  assert.equal(tick.reason, 'NO_JOB');
  assert.equal((await storage.readState()).schemaVersion, STORAGE_SCHEMA_VERSION);
  pass('fresh startup and no-job response');
}

async function testJobAcquiredAndPipeline() {
  const job = makeJob('job-acquired');
  const { controller, storage, blobStore, api } = await makeController(new MockApi({ jobs: [job] }));
  const result = await controller.tick();
  assert.equal(result.acquired, true);
  const local = await storage.getJob(job.job_id);
  assert.equal(local.local_state, 'COMPLETE');
  assert.equal(local.attachment_confirmed, true);
  assert.equal(api.uploads.length, 1);
  assert.equal((await blobStore.stats()).count, 0);
  pass('job acquired through mock generation, capture, upload, and attachment confirmation');
}

async function testHeartbeatLossAndLeaseLost() {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  const api = new MockApi();
  const heartbeat = new HeartbeatManager({ apiClient: api, storage });
  const job = makeJob('job-heartbeat');
  await storage.upsertJob(job.job_id, job);
  assert.equal((await heartbeat.beat(job)).ok, true);
  api.leaseLost = true;
  const lost = await heartbeat.beat(job);
  assert.equal(lost.leaseLost, true);
  assert.equal((await storage.getJob(job.job_id)).lease_lost, true);
  pass('heartbeat success and lost lease detection');
}

async function testProtocolMismatchAndAuthRequired() {
  const mismatch = await makeController(new MockApi({ protocolVersion: 99, jobs: [makeJob('protocol')] }));
  assert.equal((await mismatch.controller.tick()).reason, 'PROTOCOL_MISMATCH');
  const auth = await makeController(new MockApi({ authRequired: true }));
  assert.equal((await auth.controller.tick()).reason, 'AUTH_REQUIRED');
  pass('protocol mismatch and auth-required fail closed');
}

async function testRestartAndIndexedDbPersistence() {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const job = makeJob('job-restart');
  await storage.initialize();
  await seedCaptured(storage, blobStore, job);
  const api = new MockApi();
  const first = new LokaMediaController({ apiClient: api, storage, blobStore, provider: new MockProviderAdapter() });
  await first.startup();
  assert.equal((await storage.getJob(job.job_id)).local_state, 'COMPLETE');
  assert.equal(api.uploads.length, 1);
  assert.equal((await blobStore.stats()).count, 0);
  pass('service worker/browser restart resumes captured blob from durable store');
}

async function testBlobRecoveryMissing() {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  const blobStore = new MemoryBlobStore();
  const job = makeJob('job-missing');
  await storage.upsertJob(job.job_id, { ...job, local_state: 'CAPTURED', blob_key: 'missing' });
  await storage.enqueueUpload(job.job_id);
  const pool = new UploadWorkerPool({ apiClient: new MockApi(), storage, blobStore });
  const [result] = await pool.drain();
  assert.equal(result.error, 'BLOB_MISSING');
  assert.equal((await storage.getJob(job.job_id)).local_state, 'BLOB_MISSING');
  pass('missing blob moves local job to recovery-safe state');
}

async function testTwoUploadWorkersAndParallelPipeline() {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const api = new MockApi();
  api.uploadDelayMs = 20;
  await storage.initialize();
  await seedCaptured(storage, blobStore, makeJob('job-upload-a'));
  await seedCaptured(storage, blobStore, makeJob('job-upload-b'));
  await seedCaptured(storage, blobStore, makeJob('job-upload-c'));
  const pool = new UploadWorkerPool({ apiClient: api, storage, blobStore });
  await pool.drain();
  assert.equal(api.uploads.length, 3);
  assert.equal(pool.maxObservedConcurrency, 2);
  assert.equal((await blobStore.stats()).count, 0);
  pass('two upload workers drain while respecting concurrency two');
}

async function testUploadReplayAndLostResponse() {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const api = new MockApi();
  await storage.initialize();
  const job = makeJob('job-replay');
  await seedCaptured(storage, blobStore, job);
  await new UploadWorkerPool({ apiClient: api, storage, blobStore }).drain();
  await seedCaptured(storage, blobStore, job);
  await new UploadWorkerPool({ apiClient: api, storage, blobStore }).drain();
  assert.equal(api.uploads.length, 2);
  assert.equal((await storage.getJob(job.job_id)).asset_id, `asset-${job.job_id}`);

  const lostStorage = ExtensionStorage.memory();
  const lostBlobStore = new MemoryBlobStore();
  const lostApi = new MockApi();
  lostApi.lostUploadResponse = true;
  await lostStorage.initialize();
  await seedCaptured(lostStorage, lostBlobStore, makeJob('job-lost-response'));
  await assert.rejects(() => new UploadWorkerPool({ apiClient: lostApi, storage: lostStorage, blobStore: lostBlobStore }).drain());
  const recovered = new LokaMediaController({ apiClient: lostApi, storage: lostStorage, blobStore: lostBlobStore, provider: new MockProviderAdapter() });
  await recovered.startup();
  assert.equal((await lostStorage.getJob('job-lost-response')).local_state, 'COMPLETE');
  pass('same upload replay and lost response recovery reconcile to server receipt');
}

async function testBackpressureThresholdsAndClear() {
  const blobStore = new MemoryBlobStore();
  const backpressure = new BackpressureController(blobStore);
  for (let index = 0; index < MAX_PENDING_CAPTURED_ASSETS; index++) {
    await blobStore.put({ key: `asset-${index}`, bytes: bytes(10), size: 10 });
  }
  assert.equal((await backpressure.inspect()).blocked, true);
  await blobStore.delete('asset-0');
  assert.equal((await backpressure.inspect()).blocked, false);
  await blobStore.put({ key: 'large', bytes: bytes(1), size: MAX_PENDING_CAPTURED_BYTES });
  assert.equal((await backpressure.inspect()).blocked, true);
  pass('backpressure blocks and clears by asset count and pending bytes');
}

async function testDuplicateMessageAndStaleRevision() {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  const protocol = new MessageProtocol(storage);
  const message = { id: 'message-1', type: 'PING' };
  const handlers = { PING: async () => ({ ok: true }) };
  assert.equal((await protocol.handle(message, handlers)).ok, true);
  assert.equal((await protocol.handle(message, handlers)).duplicate, true);

  const api = new MockApi();
  const oldJob = makeJob('job-stale', { job_revision: 1 });
  await storage.upsertJob(oldJob.job_id, { ...oldJob, local_state: 'CAPTURED', blob_key: 'stale' });
  await new LokaMediaController({ apiClient: api, storage, blobStore: new MemoryBlobStore(), provider: new MockProviderAdapter() }).startup();
  assert.equal((await storage.getJob(oldJob.job_id)).job_revision, 2);
  pass('duplicate messages ignored and stale revision refreshed by reconcile');
}

async function testSupersededTerminalAndOfflineRecovery() {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  await storage.initialize();
  const terminalApi = new MockApi();
  terminalApi.receipts.set('job-stop', {
    job_id: 'job-stop',
    job_revision: 3,
    status: 'SUPERSEDED',
    recommended_action: 'STOP',
    attachment_confirmed: false
  });
  await storage.upsertJob('job-stop', { ...makeJob('job-stop'), local_state: 'UPLOADING', blob_key: 'stop' });
  await new LokaMediaController({ apiClient: terminalApi, storage, blobStore, provider: new MockProviderAdapter() }).startup();
  assert.equal((await storage.getJob('job-stop')).local_state, 'STOPPED');

  const offlineStorage = ExtensionStorage.memory();
  const offlineBlob = new MemoryBlobStore();
  await offlineStorage.initialize();
  await offlineStorage.saveConfig({ enabled: true, deviceToken: 'token', deviceId: 'device-1' });
  await seedCaptured(offlineStorage, offlineBlob, makeJob('job-offline'));
  const offlineApi = new MockApi();
  offlineApi.uploadBlob = async () => { throw new Error('OFFLINE'); };
  await assert.rejects(() => new LokaMediaController({ apiClient: offlineApi, storage: offlineStorage, blobStore: offlineBlob, provider: new MockProviderAdapter() }).startup());
  const onlineApi = new MockApi();
  await new LokaMediaController({ apiClient: onlineApi, storage: offlineStorage, blobStore: offlineBlob, provider: new MockProviderAdapter() }).startup();
  assert.equal((await offlineStorage.getJob('job-offline')).local_state, 'COMPLETE');
  pass('superseded terminal stop and offline/online recovery');
}

async function testMultiLaneRestart() {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  await storage.initialize();
  await seedCaptured(storage, blobStore, makeJob('lane-upload-a'));
  await storage.upsertJob('lane-generating-b', { ...makeJob('lane-generating-b'), local_state: 'GENERATING' });
  await seedCaptured(storage, blobStore, makeJob('lane-captured-c'));
  const api = new MockApi();
  api.receipts.set('lane-upload-a', {
    job_id: 'lane-upload-a',
    job_revision: 2,
    status: 'COMPLETE',
    recommended_action: 'COMPLETE',
    attachment_confirmed: true,
    asset_id: 'asset-lane-upload-a'
  });
  await new LokaMediaController({ apiClient: api, storage, blobStore, provider: new MockProviderAdapter() }).startup();
  assert.equal((await storage.getJob('lane-upload-a')).local_state, 'COMPLETE');
  assert.equal((await storage.getJob('lane-captured-c')).local_state, 'COMPLETE');
  assert.equal((await storage.getJob('lane-generating-b')).local_state, 'GENERATING');
  assert(api.reconciliations.includes('lane-generating-b'));
  pass('multi-lane restart reconciles complete upload, generating lane, and captured queue');
}

async function testNoSecretAndNoFakeProgress() {
  const sourceFiles = fs.readdirSync(path.join(extensionRoot, 'src'), { recursive: true })
    .filter((file) => String(file).endsWith('.js'));
  const allSource = sourceFiles
    .map((file) => fs.readFileSync(path.join(extensionRoot, 'src', file), 'utf8'))
    .join('\n');
  assert(!/sk-[A-Za-z0-9]/.test(allSource));
  assert(!/chat\.openai/i.test(allSource));
  assert(!/PROMPT_SUBMISSION_ENABLED\s*=\s*true/i.test(allSource));
  assert(!/generation.*percentage|fake.*percentage/i.test(allSource));
  pass('no hardcoded device/model secret, no legacy ChatGPT host, no prompt submission, no fake generation percentage');
}

await testManifestAndConstants();
await testFreshStartupAndNoJob();
await testJobAcquiredAndPipeline();
await testHeartbeatLossAndLeaseLost();
await testProtocolMismatchAndAuthRequired();
await testRestartAndIndexedDbPersistence();
await testBlobRecoveryMissing();
await testTwoUploadWorkersAndParallelPipeline();
await testUploadReplayAndLostResponse();
await testBackpressureThresholdsAndClear();
await testDuplicateMessageAndStaleRevision();
await testSupersededTerminalAndOfflineRecovery();
await testMultiLaneRestart();
await testNoSecretAndNoFakeProgress();

console.log(`\nLokaMedia Phase 3 extension tests: ${passed} passed`);
