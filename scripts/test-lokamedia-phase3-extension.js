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
import { AuditLogger, formatAuditText, MAX_AUDIT_EVENTS } from '../extensions/lokamedia/src/audit-log.js';
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
    this.releases = [];
    this.leaseLost = false;
    this.uploadDelayMs = 0;
    this.lostUploadResponse = false;
  }

  async releaseJob(jobId, payload = {}) {
    this.releases.push({ jobId, payload });
    return { ok: true, status: 'success' };
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
    controller: new LokaMediaController({
      apiClient: api,
      storage,
      blobStore,
      provider: new MockProviderAdapter()
    })
  };
}

async function testPhase4bOneShotGuard() {
  const job = makeJob('phase4b-single', {
    article_id: 481,
    article_title: 'LokaMedia Phase 4B Controlled Generation Test',
    slot_key: 'featured',
    role: 'featured'
  });
  const { controller, storage, api } = await makeController(new MockApi({ jobs: [job, job] }));
  const first = await controller.runOnce();
  assert.equal(first.ok, true);
  assert.equal(api.uploads.length, 1);
  assert.equal(controller.provider.calls.filter((call) => call.type === 'generate').length, 1);
  const second = await controller.runOnce();
  assert.equal(second.error, 'PHASE_4B_RUN_CONSUMED');
  assert.equal(api.uploads.length, 1);

  const reopened = new LokaMediaController({
    apiClient: api,
    storage,
    blobStore: new MemoryBlobStore(),
    provider: new MockProviderAdapter()
  });
  assert.equal((await reopened.runOnce()).error, 'PHASE_4B_RUN_CONSUMED');
  assert.equal(api.uploads.length, 1);
  pass('Phase 4B Run Once durable latch blocks double click, panel reopen, and service-worker restart');
}

async function testAuditLogDurabilityAndRedaction() {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  const audit = new AuditLogger({ storage, component: 'test' });
  await audit.info('RUN_REQUEST_ACCEPTED', { run_id: 'run-test', job_id: 'job-test', details: { token: 'secret', prompt_hash: 'hash-ok' } });
  await audit.error('RUN_FAILED', { run_id: 'run-test', job_id: 'job-test', error: Object.assign(new Error('token abc failed'), { code: 'SUBMIT_FAILED', status: 500 }) });
  const events = await storage.listAuditEvents({ runId: 'run-test' });
  assert.equal(events.length, 2);
  assert.equal(events[0].sequence < events[1].sequence, true);
  assert.equal(events[0].details.token, '[REDACTED]');
  assert.equal((await storage.readState()).auditLog.lastAction, 'Needs attention - SUBMIT_FAILED');
  const copied = formatAuditText({ events, state: await storage.readState() });
  assert.match(copied, /LokaMedia Audit Log/);
  await storage.clearAuditEvents();
  assert.equal((await storage.listAuditEvents()).length, 0);
  assert.equal((await storage.readState()).config.serverBaseUrl, 'http://localhost:4321');

  for (let i = 0; i < MAX_AUDIT_EVENTS + 5; i++) await audit.info('UPLOAD_PROGRESS', { details: { index: i } });
  assert.equal((await storage.listAuditEvents({ limit: MAX_AUDIT_EVENTS + 10 })).length, MAX_AUDIT_EVENTS);
  pass('durable audit log orders, persists, redacts, copies, clears in isolation, and prunes oldest events');
}

async function testPhase4bPreconditions() {
  const phaseJob = makeJob('phase4b-precheck', {
    article_title: 'LokaMedia Phase 4B Controlled Generation Test',
    slot_key: 'featured',
    role: 'featured'
  });

  const notReady = await makeController(new MockApi({ jobs: [phaseJob] }));
  await notReady.storage.update((state) => {
    state.provider.chatgpt.composer_status = 'unavailable';
  });
  assert.equal((await notReady.controller.runOnce()).error, 'PROVIDER_NOT_READY');
  assert.equal(notReady.api.jobs.length, 1);

  const wrong = await makeController(new MockApi({ jobs: [makeJob('wrong-job', { article_title: 'Other', slot_key: 'featured', role: 'featured' })] }));
  assert.equal((await wrong.controller.runOnce()).error, 'WRONG_PHASE_4B_JOB');

  const pressure = await makeController(new MockApi({ jobs: [phaseJob] }));
  await pressure.storage.update((state) => {
    state.status.connection = 'backpressure';
  });
  assert.equal((await pressure.controller.runOnce()).error, 'BACKPRESSURE');
  assert.equal(pressure.api.jobs.length, 1);
  pass('Phase 4B Run Once blocks provider-not-ready, wrong job, and backpressure states');
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
  assert.deepEqual(manifest.permissions.sort(), ['alarms', 'scripting', 'sidePanel', 'storage', 'tabs']);
  assert.equal(manifest.side_panel.default_path, 'src/side-panel.html');
  assert.equal(manifest.action.default_popup, undefined);
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

async function testApiClientBindsWorkerFetch() {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async function fetch(url) {
      if (this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation");
      assert.equal(String(url), 'http://localhost:4321/api/internal/v1/media/jobs?status=all&limit=1');
      return new Response(JSON.stringify({ status: 'success', jobs: [] }), { status: 200 });
    };
    const { ApiClient } = await import(`../extensions/lokamedia/src/api-client.js?bind=${Date.now()}`);
    const client = new ApiClient({ baseUrl: 'http://localhost:4321', deviceToken: 'token' });
    const result = await client.listJobs({ status: 'all', limit: 1 });
    assert.deepEqual(result.jobs, []);
    pass('ApiClient binds WorkerGlobalScope fetch to avoid illegal invocation');
  } finally {
    globalThis.fetch = originalFetch;
  }
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

async function testPhase4bBackgroundSafetySource() {
  const background = fs.readFileSync(path.join(extensionRoot, 'src', 'background.js'), 'utf8');
  assert(!/onAlarm[\s\S]{0,260}\.tick\(/.test(background), 'alarm must not auto-acquire provider jobs');
  assert(/last_error\s*=\s*null/.test(background), 'successful server refresh clears stale resolved transport error');
  assert(/READ_ONLY_PROVIDER_DIAGNOSTIC[\s\S]+state:\s*await refreshServerState\(\)/.test(background), 'provider diagnostic response must include server-authoritative queue state');
  assert(/updateQueueCounters\(nextState\)/.test(background), 'server job refresh must update queue counters');
  pass('background status refresh clears stale transport error and enable does not auto-run generation');
}

async function testPhase4b1a5aExecutionStartAndActiveLock() {
  const job = makeJob('phase4b-exec-lock', {
    article_id: 481,
    article_title: 'LokaMedia Phase 4B Controlled Generation Test',
    slot_key: 'featured',
    role: 'featured'
  });

  // TEST A, B, D, F: Message dispatch -> accepted -> controller.runOnce -> RUN_GATE_CHECK_START with exact run_id
  {
    const storage = ExtensionStorage.memory();
    const audit = new AuditLogger({ storage, component: 'background' });
    const { controller } = await makeController(new MockApi({ jobs: [job] }), storage);
    let runOnceCalls = 0;
    const originalRunOnce = controller.runOnce.bind(controller);
    controller.runOnce = async (options) => {
      runOnceCalls++;
      return originalRunOnce(options);
    };

    const protocol = new MessageProtocol(storage);
    const testRunId = 'run_deterministic_test_001';

    const response = await protocol.handle({ id: 'msg-1', type: 'RUN_ONCE', runId: testRunId }, {
      RUN_ONCE: async (request) => {
        const runId = request?.runId || `run_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
        await audit.info('PANEL_RUN_CLICK', { run_id: runId, component: 'side-panel' });
        await audit.info('RUN_REQUEST_DISPATCHED', { run_id: runId, component: 'side-panel' });

        const lockResult = await storage.acquireActiveRunLock({ runId });
        if (!lockResult.acquired) {
          await audit.warn('RUN_REENTRY_REJECTED', {
            run_id: runId,
            component: 'background',
            details: { active_run_id: lockResult.lock?.run_id }
          });
          return { ok: false, error: 'RUN_ALREADY_ACTIVE', run_id: runId };
        }

        await audit.info('RUN_REQUEST_ACCEPTED', { run_id: runId, component: 'background' });
        try {
          return await controller.runOnce({ runId, acceptedLogged: true });
        } catch (error) {
          await storage.releaseActiveRunLock({ runId });
          throw error;
        }
      }
    });

    assert.equal(response.ok, true);
    assert.equal(runOnceCalls, 1, 'controller.runOnce invoked exactly once (TEST A, TEST F)');

    const events = await storage.listAuditEvents({ runId: testRunId });
    const eventCodes = events.map((e) => e.event_code);
    assert(eventCodes.includes('PANEL_RUN_CLICK'), 'PANEL_RUN_CLICK recorded');
    assert(eventCodes.includes('RUN_REQUEST_DISPATCHED'), 'RUN_REQUEST_DISPATCHED recorded');
    assert(eventCodes.includes('RUN_REQUEST_ACCEPTED'), 'RUN_REQUEST_ACCEPTED recorded');
    assert(eventCodes.includes('RUN_GATE_CHECK_START'), 'RUN_GATE_CHECK_START recorded (TEST A)');
    assert(eventCodes.includes('RUN_GATE_CHECK_PASS'), 'RUN_GATE_CHECK_PASS recorded');
    assert(eventCodes.includes('JOB_ACQUIRE_START'), 'JOB_ACQUIRE_START recorded');
    assert(eventCodes.includes('RUN_COMPLETE'), 'RUN_COMPLETE recorded');

    // TEST B: all events use exact testRunId
    for (const event of events) {
      assert.equal(event.run_id, testRunId, `event ${event.event_code} must use propagated run_id (TEST B)`);
    }

    // TEST D: active lock removed on normal completion
    const lockAfterSuccess = await storage.getActiveRunLock();
    assert.equal(lockAfterSuccess, null, 'active run lock must be released on success (TEST D)');
  }

  // TEST C: Concurrent re-entry blocked
  {
    const storage = ExtensionStorage.memory();
    const audit = new AuditLogger({ storage, component: 'background' });
    let releaseHold;
    const holdPromise = new Promise((resolve) => { releaseHold = resolve; });

    class BlockingApi extends MockApi {
      async nextJob(deviceId) {
        await holdPromise;
        return super.nextJob(deviceId);
      }
    }

    const { controller } = await makeController(new BlockingApi({ jobs: [job] }), storage);

    const protocol = new MessageProtocol(storage);
    const runHandler = async (request) => {
      const runId = request?.runId || `run_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      await audit.info('PANEL_RUN_CLICK', { run_id: runId, component: 'side-panel' });
      await audit.info('RUN_REQUEST_DISPATCHED', { run_id: runId, component: 'side-panel' });

      const lockResult = await storage.acquireActiveRunLock({ runId });
      if (!lockResult.acquired) {
        await audit.warn('RUN_REENTRY_REJECTED', {
          run_id: runId,
          component: 'background',
          details: { active_run_id: lockResult.lock?.run_id }
        });
        return { ok: false, error: 'RUN_ALREADY_ACTIVE', run_id: runId };
      }

      await audit.info('RUN_REQUEST_ACCEPTED', { run_id: runId, component: 'background' });
      try {
        return await controller.runOnce({ runId, acceptedLogged: true });
      } catch (error) {
        await storage.releaseActiveRunLock({ runId });
        throw error;
      }
    };

    const runAPromise = protocol.handle({ id: 'msg-run-a', type: 'RUN_ONCE', runId: 'run-a' }, { RUN_ONCE: runHandler });
    await new Promise((r) => setTimeout(r, 10));

    const runBResponse = await protocol.handle({ id: 'msg-run-b', type: 'RUN_ONCE', runId: 'run-b' }, { RUN_ONCE: runHandler });

    assert.equal(runBResponse.ok, false);
    assert.equal(runBResponse.error, 'RUN_ALREADY_ACTIVE');

    const bEvents = await storage.listAuditEvents({ runId: 'run-b' });
    const bCodes = bEvents.map((e) => e.event_code);
    assert(bCodes.includes('RUN_REENTRY_REJECTED'), 'reentry rejection must be recorded in audit (TEST C)');
    assert(!bCodes.includes('RUN_GATE_CHECK_START'), 'run B must not reach gate check start (TEST C)');

    releaseHold();
    const runAResponse = await runAPromise;
    assert.equal(runAResponse.ok, true);

    const lockAfterAll = await storage.getActiveRunLock();
    assert.equal(lockAfterAll, null, 'active run lock must be released after run A completes');
  }

  // TEST E: Lock release on failure
  {
    const storage = ExtensionStorage.memory();
    class FailingApi extends MockApi {
      async nextJob() {
        throw new Error('MOCKED_SCHEDULER_NETWORK_ERROR');
      }
    }
    const { controller } = await makeController(new FailingApi({ jobs: [job] }), storage);

    let errorThrown = false;
    try {
      await controller.runOnce({ runId: 'run-fail' });
    } catch (err) {
      errorThrown = true;
      assert.match(err.message, /MOCKED_SCHEDULER_NETWORK_ERROR/);
    }
    assert.equal(errorThrown, true, 'deterministic error must be thrown');

    const lockAfterFail = await storage.getActiveRunLock();
    assert.equal(lockAfterFail, null, 'active lock must be removed in finally on failure (TEST E)');

    const goodApi = new MockApi({ jobs: [job] });
    const recovering = await makeController(goodApi, storage);
    const recoverResult = await recovering.controller.runOnce({ runId: 'run-recover' });
    assert.equal(recoverResult.ok, true, 'future run must succeed after failure lock release (TEST E)');
  }

  pass('Phase 4B1A.5A execution start, single run_id, mutual exclusion, reentry rejection, and lock cleanup');
}

async function testPhase4b1a5b1AcquisitionProbeBoundary() {
  const job = makeJob('phase4b-probe-test', {
    article_id: 481,
    article_title: 'LokaMedia Phase 4B Controlled Generation Test',
    slot_key: 'featured',
    role: 'featured',
    job_revision: 5
  });

  // TEST A: Default normal flow unaffected when acquisitionProbe is false or omitted
  {
    const storage = ExtensionStorage.memory();
    const { controller } = await makeController(new MockApi({ jobs: [job] }), storage);
    let runJobInvoked = false;
    const originalRunJob = controller.runJob.bind(controller);
    controller.runJob = async (j, opts) => {
      runJobInvoked = true;
      return originalRunJob(j, opts);
    };

    const result = await controller.runOnce({ runId: 'run-normal-flow' });
    assert.equal(result.ok, true);
    assert.equal(runJobInvoked, true, 'runJob must be invoked in normal flow (TEST A)');
    const events = await storage.listAuditEvents({ runId: 'run-normal-flow' });
    const eventCodes = events.map((e) => e.event_code);
    assert(!eventCodes.includes('ACQUISITION_PROBE_STOP'), 'ACQUISITION_PROBE_STOP absent in normal run (TEST A)');
    assert(eventCodes.includes('RUN_COMPLETE'), 'normal run reaches RUN_COMPLETE (TEST A)');
  }

  // TEST B, C, D, E, F: Probe stops after acquisition, correlates run_id, releases lock & job, skips provider
  {
    const storage = ExtensionStorage.memory();
    const api = new MockApi({ jobs: [job] });
    const { controller } = await makeController(api, storage);

    let runJobCalls = 0;
    controller.runJob = async () => {
      runJobCalls++;
      throw new Error('UNEXPECTED_RUN_JOB_INVOCATION');
    };

    let providerCalls = 0;
    controller.provider.generate = async () => {
      providerCalls++;
      throw new Error('UNEXPECTED_PROVIDER_GENERATE');
    };

    const testRunId = 'run_probe_test_777';
    const result = await controller.runOnce({ runId: testRunId, acquisitionProbe: true });

    // TEST B: Probe stops after acquisition
    assert.equal(result.ok, true);
    assert.equal(result.status, 'ACQUISITION_PROBE_STOPPED', 'result status must be ACQUISITION_PROBE_STOPPED (TEST B)');
    assert.equal(result.job_id, job.job_id);

    // TEST F: No provider side effect (runJob = 0, provider.generate = 0)
    assert.equal(runJobCalls, 0, 'runJob must not be called during probe (TEST B, TEST F)');
    assert.equal(providerCalls, 0, 'provider.generate must not be called during probe (TEST B, TEST F)');

    // Audit trace & correlation
    const events = await storage.listAuditEvents({ runId: testRunId });
    const eventCodes = events.map((e) => e.event_code);
    const jobAcquiredIdx = eventCodes.indexOf('JOB_ACQUIRED');
    const probeStopIdx = eventCodes.indexOf('ACQUISITION_PROBE_STOP');

    assert(jobAcquiredIdx !== -1, 'JOB_ACQUIRED must be emitted');
    assert(probeStopIdx !== -1, 'ACQUISITION_PROBE_STOP must be emitted');
    assert(jobAcquiredIdx < probeStopIdx, 'JOB_ACQUIRED must precede ACQUISITION_PROBE_STOP');

    // TEST C: Run ID correlation
    const jobAcquiredEvent = events.find((e) => e.event_code === 'JOB_ACQUIRED');
    const probeStopEvent = events.find((e) => e.event_code === 'ACQUISITION_PROBE_STOP');
    assert.equal(jobAcquiredEvent.run_id, testRunId, 'JOB_ACQUIRED run_id matches (TEST C)');
    assert.equal(probeStopEvent.run_id, testRunId, 'ACQUISITION_PROBE_STOP run_id matches (TEST C)');
    assert.equal(probeStopEvent.job_id, job.job_id, 'ACQUISITION_PROBE_STOP job_id matches (TEST C)');

    // TEST D: Active lock release
    const lockAfterProbe = await storage.getActiveRunLock();
    assert.equal(lockAfterProbe, null, 'active run lock must be released after probe stop (TEST D)');

    // TEST E: Canonical job cleanup invoked
    assert.equal(api.releases.length, 1, 'releaseJob must be called exactly once (TEST E)');
    assert.equal(api.releases[0].jobId, job.job_id);
    assert.equal(api.releases[0].payload.intent, 'SAFE_REQUEUE');
    assert.equal(api.releases[0].payload.expectedJobRevision, job.job_revision);
    assert(eventCodes.includes('JOB_LEASE_RELEASED'), 'JOB_LEASE_RELEASED audit event recorded');
  }

  pass('Phase 4B1A.5B1 acquisition probe stop, single run_id, lock release, canonical requeue, and zero provider calls');
}

await testManifestAndConstants();
await testFreshStartupAndNoJob();
await testApiClientBindsWorkerFetch();
await testJobAcquiredAndPipeline();
await testPhase4bOneShotGuard();
await testAuditLogDurabilityAndRedaction();
await testPhase4bPreconditions();
await testPhase4b1a5aExecutionStartAndActiveLock();
await testPhase4b1a5b1AcquisitionProbeBoundary();
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
await testPhase4bBackgroundSafetySource();

console.log(`\nLokaMedia Phase 3 extension tests: ${passed} passed`);
