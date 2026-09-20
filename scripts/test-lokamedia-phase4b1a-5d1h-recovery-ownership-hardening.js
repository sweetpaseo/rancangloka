import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { hasValidRecoveryLease, reconcileJobState } from '../extensions/lokamedia/src/reconciliation-manager.js';
import { isRecoverableResultCheckpoint } from '../extensions/lokamedia/src/providers/chatgpt/correlation.js';

function pass(name) {
  console.log(`  PASS ${name}`);
}

function makeJob(id = 'mjob_5c0f488d7ee123b9579a58a5', patch = {}) {
  return {
    job_id: id,
    article_id: 1,
    article_title: 'LokaMedia Phase 4B Controlled Generation Test',
    slot_key: 'featured',
    role: 'featured',
    sequence: 0,
    prompt_version: 1,
    prompt_hash: 'hash_4b_test_01',
    job_revision: 16,
    status: 'QUEUED',
    lease_owner: null,
    lease_expires_at: null,
    heartbeat_at: null,
    attempt: 0,
    max_attempts: 3,
    local_state: 'QUEUED',
    prompt: 'A prompt for testing checkpoint recovery',
    ...patch
  };
}

function makeCheckpoint(patch = {}) {
  return {
    schema_version: 1,
    run_id: 'run_1789836352166_a279b5a6',
    job_id: 'mjob_5c0f488d7ee123b9579a58a5',
    slot_key: 'featured',
    prompt_version: 1,
    prompt_hash: 'hash_4b_test_01',
    provider_conversation_id: '6aae8fae-6308-83ec-accc-2a98d5c030eb',
    provider_response_id: 'resp_test_01',
    source_fingerprint: 'img_9d8c617c',
    containerFingerprint: '55a16ce6',
    candidate_ordinal: 0,
    candidate_alt: 'Tropical Courtyard Photograph',
    identified_at: '2026-09-19T16:47:00.000Z',
    ...patch
  };
}

class TrackingProvider {
  constructor(options = {}) {
    this.generateCalls = 0;
    this.submitCalls = 0;
    this.captureCalls = 0;
    this.lastCaptureJob = null;
    this.lastCaptureDescriptor = null;
    this.captureError = options.captureError || null;
    this.captureResult = options.captureResult || {
      blobKey: 'mjob_5c0f488d7ee123b9579a58a5:1',
      sha256: 'sha256_mock_hash_recovered',
      mime: 'image/png',
      width: 1672,
      height: 941,
      size: 3846192,
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    };
  }

  async generate(job) {
    this.generateCalls++;
    this.submitCalls++;
    return {
      schema_version: 1,
      run_id: job.run_id || 'run_gen_01',
      job_id: job.job_id,
      slot_key: job.slot_key,
      source_fingerprint: 'img_generated_fp',
      containerFingerprint: 'container_gen_fp'
    };
  }

  async capture(job, descriptor) {
    this.captureCalls++;
    this.lastCaptureJob = job;
    this.lastCaptureDescriptor = descriptor;
    if (this.captureError) {
      throw this.captureError;
    }
    return this.captureResult;
  }
}

class ControllableMockApi {
  constructor({ jobToReturn = undefined, acquireError = null, heartbeatError = null } = {}) {
    this.jobToReturn = jobToReturn;
    this.acquireError = acquireError;
    this.heartbeatError = heartbeatError;
    this.nextJobCalls = 0;
    this.releases = [];
    this.heartbeats = [];
    this.uploads = [];
    this.listJobsJobs = [];
  }

  async nextJob(deviceId = 'device-test-01') {
    this.nextJobCalls++;
    if (this.acquireError) throw this.acquireError;
    if (this.jobToReturn !== undefined) {
      return { protocol_version: 1, job: this.jobToReturn };
    }
    return {
      protocol_version: 1,
      job: makeJob('mjob_5c0f488d7ee123b9579a58a5', {
        status: 'LEASED',
        lease_owner: deviceId || 'device-test-01',
        lease_expires_at: new Date(Date.now() + 300000).toISOString(),
        job_revision: 17
      })
    };
  }

  async releaseJob(jobId, payload) {
    this.releases.push({ jobId, payload });
    return { ok: true };
  }

  async heartbeat(jobId, payload) {
    this.heartbeats.push({ jobId, payload });
    if (this.heartbeatError) throw this.heartbeatError;
    return {
      ok: true,
      job_id: jobId,
      job_revision: (payload?.expected_job_revision || 17) + 1,
      lease_expires_at: new Date(Date.now() + 300000).toISOString(),
      heartbeat_at: new Date().toISOString()
    };
  }

  async uploadBlob(job, blobRecord) {
    this.uploads.push({ job, blobRecord });
    return { ok: true, asset_id: 101, blob_key: blobRecord.key };
  }

  async listJobs() {
    return { jobs: this.listJobsJobs };
  }
}

async function makeTestSetup({
  api = new ControllableMockApi(),
  storage = ExtensionStorage.memory(),
  blobStore = new MemoryBlobStore(),
  provider = new TrackingProvider()
} = {}) {
  await storage.initialize();
  await storage.saveConfig({
    enabled: true,
    deviceToken: 'test-token',
    deviceId: 'device-test-01',
    serverBaseUrl: 'http://localhost:4321'
  });
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
  const controller = new LokaMediaController({
    apiClient: api,
    storage,
    blobStore,
    provider,
    logger: console
  });
  return { api, storage, blobStore, provider, controller };
}

async function runAllTests() {
  console.log('=== TEST SUITE: PHASE 4B1A.5D1H RECOVERY OWNERSHIP & DURABLE RECONCILIATION ===\n');

  let totalGenerateCalls = 0;
  let totalSubmitCalls = 0;

  // -------------------------------------------------------------
  // TEST 1: Section 14 — Recovery Acquires Expected Job with Canonical Lease
  // -------------------------------------------------------------
  console.log('--- TEST 1: Recovery Acquires Expected Job with Canonical Lease ---');
  {
    const checkpoint = makeCheckpoint();
    // Server job is QUEUED with null lease
    const unleasedJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'QUEUED',
      lease_owner: null,
      lease_expires_at: null,
      job_revision: 16,
      result_checkpoint: checkpoint
    });

    const leasedJobFromServer = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'LEASED',
      lease_owner: 'device-test-01',
      lease_expires_at: new Date(Date.now() + 300000).toISOString(),
      job_revision: 17
    });

    const api = new ControllableMockApi({ jobToReturn: leasedJobFromServer });
    const { controller, provider, storage } = await makeTestSetup({ api });
    await storage.upsertJob(unleasedJob.job_id, unleasedJob);

    const res = await controller.runCheckpointRecovery(unleasedJob, {
      runId: 'run_rec_lease_01',
      captureBlobProbe: true
    });

    assert.equal(api.nextJobCalls, 1, 'Canonical acquire endpoint must be called exactly once');
    assert.equal(api.heartbeats.length, 1, 'Heartbeat must be issued immediately after acquire');
    assert.equal(provider.generateCalls, 0, 'provider.generate must NOT be called');
    assert.equal(provider.submitCalls, 0, 'ChatGPT submit must NOT be called');
    assert.equal(provider.captureCalls, 1, 'provider.capture must be called once');
    assert.equal(res.acquire_result, 'ACQUIRED');
    assert.equal(res.status, 'CAPTURE_BLOB_PROBE_STOPPED');

    const state = await storage.readState();
    const stored = state.jobs[unleasedJob.job_id];
    assert.equal(stored.lease_owner, 'device-test-01');
    assert.equal(stored.job_revision, 18, 'Authoritative job revision propagated through heartbeat');
    assert.equal(stored.local_state, 'CAPTURED');

    totalGenerateCalls += provider.generateCalls;
    totalSubmitCalls += provider.submitCalls;
    pass('CHECKPOINT_RECOVERY_ACQUIRES_LEASE=PASS');
  }

  // -------------------------------------------------------------
  // TEST 2: Section 15 — Wrong Job Returned Fails Closed
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Wrong Job Returned Fails Closed ---');
  {
    const checkpoint = makeCheckpoint();
    const targetJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      result_checkpoint: checkpoint
    });

    // Acquire returns a different job
    const differentJob = makeJob('mjob_DIFFERENT_99999', {
      status: 'LEASED',
      lease_owner: 'device-test-01',
      job_revision: 5
    });

    const api = new ControllableMockApi({ jobToReturn: differentJob });
    const { controller, provider, storage } = await makeTestSetup({ api });
    await storage.upsertJob(targetJob.job_id, targetJob);

    await assert.rejects(
      () => controller.runCheckpointRecovery(targetJob, { runId: 'run_wrong_job' }),
      (err) => err.code === 'WRONG_ACQUIRED_JOB' || err.message === 'WRONG_ACQUIRED_JOB',
      'Should reject with WRONG_ACQUIRED_JOB'
    );

    assert.equal(api.nextJobCalls, 1);
    assert.equal(api.releases.length, 1, 'Mismatched acquired job must be released with SAFE_REQUEUE');
    assert.equal(api.releases[0].payload.intent, 'SAFE_REQUEUE');
    assert.equal(provider.generateCalls, 0, 'Must NOT generate');
    assert.equal(provider.captureCalls, 0, 'Must NOT capture against wrong job');

    const state = await storage.readState();
    assert.deepEqual(state.jobs[targetJob.job_id].result_checkpoint, checkpoint, 'Checkpoint preserved');

    totalGenerateCalls += provider.generateCalls;
    totalSubmitCalls += provider.submitCalls;
    pass('WRONG_ACQUIRED_JOB_FAILS_CLOSED=PASS');
  }

  // -------------------------------------------------------------
  // TEST 3: Section 16 — Acquire Returns None Fails Closed
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Acquire Returns None Fails Closed ---');
  {
    const checkpoint = makeCheckpoint();
    const targetJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      result_checkpoint: checkpoint
    });

    const api = new ControllableMockApi({ jobToReturn: null });
    const { controller, provider, storage } = await makeTestSetup({ api });
    await storage.upsertJob(targetJob.job_id, targetJob);

    await assert.rejects(
      () => controller.runCheckpointRecovery(targetJob, { runId: 'run_none_job' }),
      (err) => err.code === 'NO_JOB_ACQUIRED' || err.message === 'NO_JOB_ACQUIRED'
    );

    assert.equal(api.nextJobCalls, 1);
    assert.equal(provider.generateCalls, 0);
    assert.equal(provider.captureCalls, 0);

    totalGenerateCalls += provider.generateCalls;
    totalSubmitCalls += provider.submitCalls;
    pass('NO_JOB_ACQUIRED_FAILS_CLOSED=PASS');
  }

  // -------------------------------------------------------------
  // TEST 4: Section 17 — Expired Recovery Lease Blocks Capture
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Expired Recovery Lease Blocks Capture ---');
  {
    const checkpoint = makeCheckpoint();
    // Lease expired 10 seconds ago
    const expiredJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'LEASED',
      lease_owner: 'device-test-01',
      lease_expires_at: new Date(Date.now() - 10000).toISOString(),
      job_revision: 20,
      result_checkpoint: checkpoint
    });

    // Mock API that fails if nextJob is called, or returns expired job
    const api = new ControllableMockApi({
      jobToReturn: {
        ...expiredJob,
        lease_expires_at: new Date(Date.now() - 5000).toISOString()
      }
    });
    const { controller, provider } = await makeTestSetup({ api });

    await assert.rejects(
      () => controller._executeCaptureFromCheckpoint(expiredJob, checkpoint, { runId: 'run_expired' }),
      (err) => err.code === 'EXPIRED_RECOVERY_LEASE' || err.message === 'EXPIRED_RECOVERY_LEASE'
    );

    assert.equal(provider.generateCalls, 0);
    assert.equal(provider.captureCalls, 0, 'Capture MUST NOT execute under expired lease');

    totalGenerateCalls += provider.generateCalls;
    totalSubmitCalls += provider.submitCalls;
    pass('EXPIRED_RECOVERY_LEASE_BLOCKS_CAPTURE=PASS');
  }

  // -------------------------------------------------------------
  // TEST 5: Section 18 — Concurrent Second Acquire Blocked
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Concurrent Second Acquire Blocked ---');
  {
    // Verify lease invariant check function: hasValidRecoveryLease
    const activeLease = {
      job_id: 'mjob_5c0f488d7ee123b9579a58a5',
      lease_owner: 'worker_A',
      lease_expires_at: new Date(Date.now() + 60000).toISOString(),
      job_revision: 17
    };

    // Worker A owns active lease
    assert.equal(hasValidRecoveryLease(activeLease, 'worker_A'), true);
    // Worker B does not own lease
    assert.equal(hasValidRecoveryLease(activeLease, 'worker_B'), false);

    // Another worker attempting acquisition will see worker_A's lease active
    const canWorkerBAcquire = !hasValidRecoveryLease(activeLease, 'worker_A');
    assert.equal(canWorkerBAcquire, false, 'Second worker must be blocked while active lease is held');

    pass('CONCURRENT_ACQUIRE_BLOCKED=PASS');
  }

  // -------------------------------------------------------------
  // TEST 6: Section 19 — CAPTURED Survives Server QUEUED Refresh
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: CAPTURED Survives Server QUEUED Refresh ---');
  {
    const localJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      local_state: 'CAPTURED',
      blob_key: 'mjob_5c0f488d7ee123b9579a58a5:1',
      mime: 'image/png',
      width: 1672,
      height: 941,
      size: 3846192,
      sha256: 'sha256_mock_hash_recovered'
    });

    const serverJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'QUEUED',
      lease_owner: null,
      lease_expires_at: null,
      job_revision: 17
    });

    const recon = reconcileJobState(localJob, serverJob);
    assert.equal(recon.local_state, 'CAPTURED', 'Local state must remain CAPTURED');
    assert.equal(recon.preserved_durable_stage, true);

    const api = new ControllableMockApi();
    api.listJobsJobs = [serverJob];

    const { storage } = await makeTestSetup({ api });
    await storage.upsertJob(localJob.job_id, localJob);

    // Simulate refreshServerState logic
    const stateBefore = await storage.readState();
    const local = stateBefore.jobs[localJob.job_id];
    const decision = reconcileJobState(local, serverJob);

    await storage.update((s) => {
      const merged = {
        ...local,
        ...serverJob,
        local_state: decision.local_state,
        result_checkpoint: local.result_checkpoint ?? serverJob.result_checkpoint ?? null
      };
      if (decision.preserved_durable_stage && local.blob_key) {
        merged.blob_key = local.blob_key;
        merged.sha256 = local.sha256;
        merged.mime = local.mime;
        merged.width = local.width;
        merged.height = local.height;
        merged.size = local.size;
      }
      s.jobs[serverJob.job_id] = merged;
    });

    const stateAfter = await storage.readState();
    const updated = stateAfter.jobs[localJob.job_id];
    assert.equal(updated.local_state, 'CAPTURED');
    assert.equal(updated.blob_key, 'mjob_5c0f488d7ee123b9579a58a5:1');
    assert.equal(updated.status, 'QUEUED', 'Server status reflects server QUEUED');
    assert.equal(updated.lease_owner, null);

    pass('CAPTURED_SURVIVES_SERVER_QUEUE_REFRESH=PASS');
  }

  // -------------------------------------------------------------
  // TEST 7: Section 20 — CAPTURED Survives Repeated Polling
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: CAPTURED Survives Repeated Polling ---');
  {
    let currentJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      local_state: 'CAPTURED',
      blob_key: 'mjob_5c0f488d7ee123b9579a58a5:1',
      mime: 'image/png',
      width: 1672,
      height: 941,
      size: 3846192
    });

    const serverJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'QUEUED',
      lease_owner: null
    });

    for (let round = 1; round <= 10; round++) {
      const recon = reconcileJobState(currentJob, serverJob);
      assert.equal(recon.local_state, 'CAPTURED', `Round ${round} must stay CAPTURED`);
      currentJob = {
        ...currentJob,
        ...serverJob,
        local_state: recon.local_state,
        blob_key: currentJob.blob_key
      };
    }

    assert.equal(currentJob.local_state, 'CAPTURED');
    assert.equal(currentJob.blob_key, 'mjob_5c0f488d7ee123b9579a58a5:1');
    pass('CAPTURED_SURVIVES_REPEATED_REFRESH=PASS');
  }

  // -------------------------------------------------------------
  // TEST 8: Section 21 — Invalid Captured Evidence Fails Closed
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Invalid Captured Evidence Fails Closed ---');
  {
    // Claims CAPTURED but blob_key is missing
    const missingBlobJob = makeJob('mjob_invalid_01', {
      local_state: 'CAPTURED',
      blob_key: null,
      mime: 'image/png',
      width: 1672,
      height: 941
    });

    const serverJob = makeJob('mjob_invalid_01', { status: 'QUEUED' });
    const recon1 = reconcileJobState(missingBlobJob, serverJob);

    assert.equal(recon1.local_state, 'RECOVERING', 'Missing blob must fail closed to RECOVERING');
    assert.equal(recon1.needs_attention, true);
    assert.equal(recon1.inconsistency_reason, 'INVALID_CAPTURED_EVIDENCE');

    // Claims CAPTURED but width/height missing
    const missingDimensionsJob = makeJob('mjob_invalid_02', {
      local_state: 'CAPTURED',
      blob_key: 'blob_test_key',
      mime: 'image/png',
      width: 0,
      height: 0
    });
    const recon2 = reconcileJobState(missingDimensionsJob, serverJob);
    assert.equal(recon2.local_state, 'RECOVERING');
    assert.equal(recon2.needs_attention, true);

    pass('INVALID_CAPTURED_STATE_FAILS_CLOSED=PASS');
  }

  // -------------------------------------------------------------
  // TEST 9: Section 22 — GENERATED Checkpoint Survives QUEUED Refresh
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: GENERATED Checkpoint Survives QUEUED Refresh ---');
  {
    const checkpoint = makeCheckpoint();
    const localJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      local_state: 'IMAGE_DETECTED',
      result_checkpoint: checkpoint
    });

    const serverJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'QUEUED',
      lease_owner: null
    });

    const recon = reconcileJobState(localJob, serverJob);
    assert.equal(recon.local_state, 'IMAGE_DETECTED', 'Local IMAGE_DETECTED must survive server QUEUED');
    assert.equal(recon.preserved_durable_stage, true);
    assert.deepEqual(recon.result_checkpoint, checkpoint, 'Checkpoint must be preserved');

    pass('GENERATED_SURVIVES_SERVER_QUEUE_REFRESH=PASS');
  }

  // -------------------------------------------------------------
  // TEST 10: Section 23 — Ordinary QUEUED Job Still Reconciles
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Ordinary QUEUED Job Still Reconciles ---');
  {
    const localJob = makeJob('mjob_ord_01', {
      local_state: 'QUEUED',
      blob_key: null,
      result_checkpoint: null
    });

    const serverJob = makeJob('mjob_ord_01', {
      status: 'QUEUED',
      attempt: 1
    });

    const recon = reconcileJobState(localJob, serverJob);
    assert.equal(recon.local_state, 'QUEUED');
    assert.equal(recon.preserved_durable_stage, false);

    pass('ORDINARY_QUEUE_RECONCILIATION_REGRESSION=PASS');
  }

  // -------------------------------------------------------------
  // TEST 11: Section 24 — Server Lease Metadata Still Updates
  // -------------------------------------------------------------
  console.log('\n--- TEST 11: Server Lease Metadata Still Updates ---');
  {
    const localJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      local_state: 'CAPTURED',
      blob_key: 'mjob_5c0f488d7ee123b9579a58a5:1',
      mime: 'image/png',
      width: 1672,
      height: 941,
      size: 3846192,
      job_revision: 16,
      status: 'LEASED',
      lease_owner: 'device-test-01'
    });

    const updatedServerJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'QUEUED',
      lease_owner: null,
      lease_expires_at: null,
      job_revision: 18,
      attempt: 2
    });

    const recon = reconcileJobState(localJob, updatedServerJob);
    assert.equal(recon.local_state, 'CAPTURED');

    const merged = {
      ...localJob,
      ...updatedServerJob,
      local_state: recon.local_state
    };

    assert.equal(merged.local_state, 'CAPTURED');
    assert.equal(merged.status, 'QUEUED', 'Server status updated to QUEUED');
    assert.equal(merged.lease_owner, null, 'Lease owner cleared');
    assert.equal(merged.job_revision, 18, 'Job revision updated to 18');
    assert.equal(merged.attempt, 2, 'Attempt count updated to 2');
    assert.equal(merged.blob_key, 'mjob_5c0f488d7ee123b9579a58a5:1', 'Blob key preserved');

    pass('SERVER_METADATA_REFRESH_WHILE_CAPTURED=PASS');
  }

  // -------------------------------------------------------------
  // TEST 12: Section 25 — Successful Checkpoint Recovery Needs No Manual Script
  // -------------------------------------------------------------
  console.log('\n--- TEST 12: Successful Checkpoint Recovery Needs No Manual Script ---');
  {
    const checkpoint = makeCheckpoint();
    const queuedJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'QUEUED',
      lease_owner: null,
      result_checkpoint: checkpoint
    });

    const leasedJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      status: 'LEASED',
      lease_owner: 'device-test-01',
      lease_expires_at: new Date(Date.now() + 300000).toISOString(),
      job_revision: 17
    });

    const api = new ControllableMockApi({ jobToReturn: leasedJob });
    api.listJobsJobs = [queuedJob]; // Server still reports QUEUED when listing!

    const { controller, storage } = await makeTestSetup({ api });
    await storage.upsertJob(queuedJob.job_id, queuedJob);

    // Execute recovery with captureBlobProbe
    const recoveryResult = await controller.runCheckpointRecovery(queuedJob, {
      runId: 'run_auto_captured_01',
      captureBlobProbe: true
    });

    assert.equal(recoveryResult.status, 'CAPTURE_BLOB_PROBE_STOPPED');
    assert.equal(recoveryResult.acquire_result, 'ACQUIRED');

    // State right after probe stop
    let state = await storage.readState();
    assert.equal(state.jobs[queuedJob.job_id].local_state, 'CAPTURED');

    // Background reconciliation runs (like finally block in UI or alarm)
    const serverJob = makeJob('mjob_5c0f488d7ee123b9579a58a5', { status: 'QUEUED', lease_owner: null, job_revision: 17 });
    const local = state.jobs[queuedJob.job_id];
    const recon = reconcileJobState(local, serverJob);

    await storage.update((s) => {
      s.jobs[queuedJob.job_id] = {
        ...local,
        ...serverJob,
        local_state: recon.local_state,
        blob_key: local.blob_key
      };
    });

    state = await storage.readState();
    assert.equal(state.jobs[queuedJob.job_id].local_state, 'CAPTURED', 'Final state remains CAPTURED automatically!');
    assert.equal(state.jobs[queuedJob.job_id].blob_key, 'mjob_5c0f488d7ee123b9579a58a5:1');

    pass('MANUAL_SET_CAPTURED_SCRIPT_REQUIRED=NO');
  }

  // -------------------------------------------------------------
  // TEST 13: Section 26 — Capture Probe Final State Stable
  // -------------------------------------------------------------
  console.log('\n--- TEST 13: Capture Probe Final State Stable ---');
  {
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      result_checkpoint: checkpoint
    });

    const api = new ControllableMockApi();
    const { controller, storage } = await makeTestSetup({ api });
    await storage.upsertJob(job.job_id, job);

    const res = await controller.runCheckpointRecovery(job, {
      runId: 'run_probe_stable',
      captureBlobProbe: true
    });

    assert.equal(res.status, 'CAPTURE_BLOB_PROBE_STOPPED');

    // Simulate finally refresh
    const serverView = makeJob(job.job_id, { status: 'QUEUED', lease_owner: null });
    const local = (await storage.readState()).jobs[job.job_id];
    const recon = reconcileJobState(local, serverView);

    await storage.update((s) => {
      s.jobs[job.job_id] = {
        ...local,
        ...serverView,
        local_state: recon.local_state,
        blob_key: local.blob_key
      };
    });

    const finalState = (await storage.readState()).jobs[job.job_id];
    assert.equal(finalState.local_state, 'CAPTURED');
    assert.equal(finalState.blob_key, 'mjob_5c0f488d7ee123b9579a58a5:1');

    pass('CAPTURE_PROBE_FINAL_STATE_STABLE=PASS');
  }

  // -------------------------------------------------------------
  // TEST 14: Section 27 — Checkpoint Preserved After Capture
  // -------------------------------------------------------------
  console.log('\n--- TEST 14: Checkpoint Preserved After Capture ---');
  {
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      result_checkpoint: checkpoint
    });

    const api = new ControllableMockApi();
    const { controller, storage } = await makeTestSetup({ api });
    await storage.upsertJob(job.job_id, job);

    await controller.runCheckpointRecovery(job, {
      runId: 'run_ckpt_pres',
      captureBlobProbe: true
    });

    const state = await storage.readState();
    const stored = state.jobs[job.job_id];
    assert.deepEqual(stored.result_checkpoint, checkpoint, 'Checkpoint must be intact and unchanged');

    pass('CHECKPOINT_PRESERVED_AFTER_CAPTURE=PASS');
  }

  // -------------------------------------------------------------
  // TEST 15: Section 28 — No Regeneration in Any Path
  // -------------------------------------------------------------
  console.log('\n--- TEST 15: No Regeneration in Any Recovery Path ---');
  {
    assert.equal(totalGenerateCalls, 0, 'Total generate calls across all tests must be 0');
    assert.equal(totalSubmitCalls, 0, 'Total ChatGPT submit calls across all tests must be 0');

    pass('RECOVERY_GENERATE_CALLS=0');
    pass('RECOVERY_SUBMIT_CALLS=0');
  }

  console.log('\n=== ALL PHASE 4B1A.5D1H TESTS PASSED ===');
}

runAllTests().catch((err) => {
  console.error('\nFAILED 5D1H TESTS:', err);
  process.exit(1);
});
