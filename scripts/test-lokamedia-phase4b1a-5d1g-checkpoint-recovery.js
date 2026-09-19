import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
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
      blobKey: 'blob_test_recovered_key',
      sha256: 'sha256_mock_hash_recovered',
      mime: 'image/png',
      width: 1024,
      height: 1024,
      size: 12345,
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

class MockApi {
  constructor(jobToReturn = null) {
    this.jobToReturn = jobToReturn;
    this.releases = [];
    this.heartbeats = [];
    this.uploads = [];
  }

  async nextJob() {
    return { protocol_version: 1, job: this.jobToReturn };
  }

  async releaseJob(jobId, payload) {
    this.releases.push({ jobId, payload });
    return { ok: true };
  }

  async heartbeat(jobId, payload) {
    this.heartbeats.push({ jobId, payload });
    return { ok: true };
  }

  async uploadBlob(job, blobRecord) {
    this.uploads.push({ job, blobRecord });
    return { ok: true, asset_id: 101, blob_key: blobRecord.key };
  }
}

async function makeController({
  api = new MockApi(),
  storage = ExtensionStorage.memory(),
  blobStore = new MemoryBlobStore(),
  provider = new TrackingProvider()
} = {}) {
  await storage.initialize();
  await storage.saveConfig({ enabled: true, deviceToken: 'test-token', deviceId: 'device-test-01' });
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
    api,
    storage,
    blobStore,
    provider,
    controller: new LokaMediaController({
      apiClient: api,
      storage,
      blobStore,
      provider
    })
  };
}

async function main() {
  console.log('=== TEST SUITE: PHASE 4B1A.5D1G CHECKPOINT CAPTURE RECOVERY ===\n');

  // TEST 1: Checkpoint validation helper unit tests
  console.log('--- TEST 1: Checkpoint Validation Helper (isRecoverableResultCheckpoint) ---');
  {
    const valid = makeCheckpoint();
    const job = makeJob();
    assert.equal(isRecoverableResultCheckpoint(valid, job), true, 'Valid checkpoint should pass');

    // Missing source fingerprint
    assert.equal(isRecoverableResultCheckpoint({ ...valid, source_fingerprint: null }, job), false);
    assert.equal(isRecoverableResultCheckpoint({ ...valid, source_fingerprint: '' }, job), false);

    // Missing container fingerprint
    assert.equal(isRecoverableResultCheckpoint({ ...valid, containerFingerprint: null }, job), false);
    assert.equal(isRecoverableResultCheckpoint({ ...valid, containerFingerprint: '   ' }, job), false);

    // Wrong job_id
    assert.equal(isRecoverableResultCheckpoint({ ...valid, job_id: 'mjob_different' }, job), false);

    // Wrong slot_key
    assert.equal(isRecoverableResultCheckpoint({ ...valid, slot_key: 'inline_1' }, job), false);

    // Wrong prompt_hash
    assert.equal(isRecoverableResultCheckpoint({ ...valid, prompt_hash: 'stale_hash' }, job), false);

    // Wrong prompt_version
    assert.equal(isRecoverableResultCheckpoint({ ...valid, prompt_version: 99 }, job), false);

    // Unsupported schema_version
    assert.equal(isRecoverableResultCheckpoint({ ...valid, schema_version: 3 }, job), false);
    assert.equal(isRecoverableResultCheckpoint({ ...valid, schema_version: 99 }, job), false);

    // Legacy v1 schema supported
    assert.equal(isRecoverableResultCheckpoint({ ...valid, schema_version: 1 }, job), true);
    // V2 schema supported
    assert.equal(isRecoverableResultCheckpoint({ ...valid, schema_version: 2 }, job), true);

    pass('CHECKPOINT_VALIDATION_IMPLEMENTED=YES');
  }

  // TEST 2: Normal generation path regression (when NO result_checkpoint exists)
  console.log('\n--- TEST 2: Normal Generation Path Regression ---');
  {
    const job = makeJob();
    const { controller, provider } = await makeController();
    const res = await controller.runJob(job, { runId: 'run_gen_test', captureBlobProbe: true });

    assert.equal(provider.generateCalls, 1, 'provider.generate must be called once');
    assert.equal(provider.submitCalls, 1, 'ChatGPT submit must be called once');
    assert.equal(provider.captureCalls, 1, 'provider.capture must be called once');
    assert.equal(res.status, 'CAPTURE_BLOB_PROBE_STOPPED');
    pass('NORMAL_GENERATION_PATH_REGRESSION=PASS');
  }

  // TEST 3: Checkpoint recovery skips generation (generateCalls=0, submitCalls=0, captureCalls=1)
  console.log('\n--- TEST 3: Checkpoint Recovery Skips Generation ---');
  {
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const { controller, provider } = await makeController();

    const res = await controller.runCheckpointRecovery(job, {
      runId: 'run_recovery_test_01',
      captureBlobProbe: true
    });

    assert.equal(provider.generateCalls, 0, 'provider.generate must NOT be called in recovery');
    assert.equal(provider.submitCalls, 0, 'ChatGPT submit must NOT be called in recovery');
    assert.equal(provider.captureCalls, 1, 'provider.capture must be called exactly once in recovery');
    assert.equal(res.checkpoint_recovery_used, true);
    assert.equal(res.execution_mode, 'checkpoint_capture_recovery');
    assert.equal(res.origin_run_id, 'run_1789836352166_a279b5a6');
    assert.equal(res.recovery_run_id, 'run_recovery_test_01');

    pass('RECOVERY_GENERATE_CALLS=0');
    pass('RECOVERY_SUBMIT_CALLS=0');
    pass('RECOVERY_CAPTURE_CALLS=1');
  }

  // TEST 4: Checkpoint wins over regeneration (valid checkpoint prevents regeneration)
  console.log('\n--- TEST 4: Checkpoint Wins Over Regeneration ---');
  {
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      local_state: 'RECOVERING',
      result_checkpoint: checkpoint
    });
    const { controller, provider, storage } = await makeController();
    await storage.upsertJob(job.job_id, job);

    // Calling standard runJob without explicit recovery mode
    const res = await controller.runJob(job, {
      runId: 'run_auto_detect_01',
      captureBlobProbe: true
    });

    assert.equal(provider.generateCalls, 0, 'runJob must detect checkpoint and NOT generate');
    assert.equal(provider.captureCalls, 1, 'runJob must enter capture recovery');
    pass('VALID_CHECKPOINT_PREVENTS_REGENERATION=PASS');
  }

  // TEST 5: Missing checkpoint in recovery mode fails closed
  console.log('\n--- TEST 5: Missing Checkpoint Recovery Fails Closed ---');
  {
    const job = makeJob('mjob_missing_checkpoint', { result_checkpoint: null });
    const { controller, provider } = await makeController();

    await assert.rejects(
      () => controller.runCheckpointRecovery(job, { runId: 'run_missing_rec' }),
      (err) => err.code === 'RESULT_CHECKPOINT_MISSING' || err.message === 'RESULT_CHECKPOINT_MISSING',
      'Should reject with RESULT_CHECKPOINT_MISSING'
    );

    assert.equal(provider.generateCalls, 0, 'Must NOT generate when checkpoint is missing');
    assert.equal(provider.captureCalls, 0, 'Must NOT capture when checkpoint is missing');
    pass('MISSING_CHECKPOINT_RECOVERY_FAILS_CLOSED=PASS');
    pass('GENERATE_CALLS_ON_MISSING_CHECKPOINT_RECOVERY=0');
  }

  // TEST 6: Malformed checkpoint fails closed
  console.log('\n--- TEST 6: Malformed Checkpoint Fails Closed ---');
  {
    const malformed = makeCheckpoint({ source_fingerprint: '' }); // empty fp
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: malformed });
    const { controller, provider } = await makeController();

    await assert.rejects(
      () => controller.runJob(job, { runId: 'run_malformed' }),
      (err) => err.code === 'RESULT_CHECKPOINT_INVALID' || err.message === 'RESULT_CHECKPOINT_INVALID'
    );

    assert.equal(provider.generateCalls, 0);
    assert.equal(provider.captureCalls, 0);
    pass('MALFORMED_CHECKPOINT_RECOVERY_FAILS_CLOSED=PASS');
  }

  // TEST 7: Stale prompt checkpoint rejected
  console.log('\n--- TEST 7: Stale Prompt Checkpoint Rejected ---');
  {
    const staleCheckpoint = makeCheckpoint({ prompt_hash: 'old_stale_hash' });
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', {
      prompt_hash: 'new_active_hash',
      result_checkpoint: staleCheckpoint
    });
    const { controller, provider } = await makeController();

    await assert.rejects(
      () => controller.runJob(job, { runId: 'run_stale' }),
      (err) => err.code === 'RESULT_CHECKPOINT_INVALID' || err.message === 'RESULT_CHECKPOINT_INVALID'
    );

    assert.equal(provider.generateCalls, 0);
    assert.equal(provider.captureCalls, 0);
    pass('STALE_PROMPT_CHECKPOINT_REJECTED=PASS');
  }

  // TEST 8: Checkpoint target missing in DOM -> fails safely without regeneration
  console.log('\n--- TEST 8: Checkpoint Target Missing No Regen ---');
  {
    const targetMissingErr = new Error('CAPTURE_TARGET_MISSING');
    targetMissingErr.code = 'CAPTURE_TARGET_MISSING';
    const provider = new TrackingProvider({ captureError: targetMissingErr });
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const { controller, storage } = await makeController({ provider });
    await storage.upsertJob(job.job_id, job);

    await assert.rejects(
      () => controller.runCheckpointRecovery(job, { runId: 'run_target_miss' }),
      (err) => err.code === 'CAPTURE_TARGET_MISSING'
    );

    assert.equal(provider.generateCalls, 0, 'No generation when target missing');
    assert.equal(provider.captureCalls, 1, 'Attempted capture once');

    const state = await storage.readState();
    const stored = state.jobs[job.job_id];
    assert.equal(stored.local_state, 'RECOVERING');
    assert.deepEqual(stored.result_checkpoint, checkpoint, 'Checkpoint must remain preserved');
    pass('TARGET_MISSING_NO_REGEN=PASS');
  }

  // TEST 9: Checkpoint target ambiguous -> fails safely without regeneration
  console.log('\n--- TEST 9: Checkpoint Target Ambiguous No Regen ---');
  {
    const ambiguousErr = new Error('CAPTURE_TARGET_AMBIGUOUS');
    ambiguousErr.code = 'CAPTURE_TARGET_AMBIGUOUS';
    const provider = new TrackingProvider({ captureError: ambiguousErr });
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const { controller } = await makeController({ provider });

    await assert.rejects(
      () => controller.runCheckpointRecovery(job, { runId: 'run_ambig' }),
      (err) => err.code === 'CAPTURE_TARGET_AMBIGUOUS'
    );

    assert.equal(provider.generateCalls, 0);
    pass('TARGET_AMBIGUOUS_NO_REGEN=PASS');
  }

  // TEST 10: Legacy v1 checkpoint recovery
  console.log('\n--- TEST 10: Legacy V1 Checkpoint Recovery ---');
  {
    const v1Checkpoint = makeCheckpoint({
      schema_version: 1,
      source_fingerprint: 'img_9d8c617c',
      containerFingerprint: '55a16ce6'
    });
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: v1Checkpoint });
    const { controller, provider } = await makeController();

    const res = await controller.runCheckpointRecovery(job, {
      runId: 'run_legacy_v1',
      captureBlobProbe: true
    });

    assert.equal(res.ok, true);
    assert.equal(provider.generateCalls, 0);
    assert.equal(provider.captureCalls, 1);
    assert.equal(provider.lastCaptureDescriptor.source_fingerprint, 'img_9d8c617c');
    assert.equal(provider.lastCaptureDescriptor.containerFingerprint, '55a16ce6');
    pass('LEGACY_V1_CHECKPOINT_RECOVERY=PASS');
  }

  // TEST 11: Restart recovery (service worker restart simulation)
  console.log('\n--- TEST 11: Restart Recovery ---');
  {
    const checkpoint = makeCheckpoint();
    const storage = ExtensionStorage.memory();
    await storage.initialize();
    await storage.upsertJob('mjob_5c0f488d7ee123b9579a58a5', {
      ...makeJob('mjob_5c0f488d7ee123b9579a58a5'),
      local_state: 'RECOVERING',
      result_checkpoint: checkpoint
    });

    // Brand new controller instance started from persisted storage
    const provider = new TrackingProvider();
    const { controller } = await makeController({ storage, provider });

    const res = await controller.runCheckpointRecovery('mjob_5c0f488d7ee123b9579a58a5', {
      runId: 'run_after_restart',
      captureBlobProbe: true
    });

    assert.equal(res.ok, true);
    assert.equal(provider.generateCalls, 0, 'No generate after restart');
    assert.equal(provider.captureCalls, 1, 'Exact persisted descriptor used');
    assert.deepEqual(provider.lastCaptureDescriptor, checkpoint);
    pass('RESTART_CHECKPOINT_RECOVERY=PASS');
  }

  // TEST 12: Checkpoint preserved on capture failure (no auto-regen)
  console.log('\n--- TEST 12: Checkpoint Preserved on Capture Failure ---');
  {
    const genericCaptureErr = new Error('CONTENT_SCRIPT_UNAVAILABLE');
    genericCaptureErr.code = 'CONTENT_SCRIPT_UNAVAILABLE';
    const provider = new TrackingProvider({ captureError: genericCaptureErr });
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const { controller, storage } = await makeController({ provider });
    await storage.upsertJob(job.job_id, job);

    await assert.rejects(
      () => controller.runCheckpointRecovery(job, { runId: 'run_cap_fail' }),
      (err) => err.code === 'CONTENT_SCRIPT_UNAVAILABLE'
    );

    const state = await storage.readState();
    const stored = state.jobs[job.job_id];
    assert.equal(stored.local_state, 'RECOVERING');
    assert.deepEqual(stored.result_checkpoint, checkpoint);
    assert.equal(provider.generateCalls, 0);
    pass('CHECKPOINT_PRESERVED_ON_CAPTURE_FAILURE=PASS');
    pass('AUTO_REGEN_AFTER_CAPTURE_FAILURE=NO');
  }

  // TEST 13: Checkpoint preserved on blob persist failure
  console.log('\n--- TEST 13: Checkpoint Preserved on Blob Persist Failure ---');
  {
    class FailingBlobStore extends MemoryBlobStore {
      async put() {
        throw new Error('INDEXEDDB_QUOTA_EXCEEDED');
      }
    }
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const { controller, storage, provider } = await makeController({ blobStore: new FailingBlobStore() });
    await storage.upsertJob(job.job_id, job);

    await assert.rejects(
      () => controller.runCheckpointRecovery(job, { runId: 'run_blob_fail' }),
      (err) => err.message === 'INDEXEDDB_QUOTA_EXCEEDED'
    );

    const state = await storage.readState();
    const stored = state.jobs[job.job_id];
    assert.equal(stored.local_state, 'RECOVERING');
    assert.deepEqual(stored.result_checkpoint, checkpoint);
    assert.equal(provider.generateCalls, 0);
    pass('CHECKPOINT_PRESERVED_ON_BLOB_FAILURE=PASS');
  }

  // TEST 14: Successful recovery state
  console.log('\n--- TEST 14: Successful Recovery State ---');
  {
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const { controller, storage, blobStore } = await makeController();

    const res = await controller.runCheckpointRecovery(job, {
      runId: 'run_success_state',
      captureBlobProbe: true
    });

    assert.equal(res.status, 'CAPTURE_BLOB_PROBE_STOPPED');
    const state = await storage.readState();
    const stored = state.jobs[job.job_id];
    assert.equal(stored.local_state, 'CAPTURED');
    assert.equal(stored.blob_key, 'blob_test_recovered_key');
    assert.deepEqual(stored.result_checkpoint, checkpoint);

    const blob = await blobStore.get('blob_test_recovered_key');
    assert.ok(blob, 'Blob record must exist in blobStore');
    pass('SUCCESSFUL_CHECKPOINT_RECOVERY_STATE=PASS');
  }

  // TEST 15: Capture probe boundary support in recovery
  console.log('\n--- TEST 15: Recovery Capture Probe Boundary ---');
  {
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const api = new MockApi();
    const { controller } = await makeController({ api });

    const res = await controller.runCheckpointRecovery(job, {
      runId: 'run_probe_bound',
      captureBlobProbe: true
    });

    assert.equal(res.status, 'CAPTURE_BLOB_PROBE_STOPPED');
    assert.equal(api.uploads.length, 0, 'Upload queue must NOT execute when probe is armed');
    pass('RECOVERY_CAPTURE_PROBE_BOUNDARY=PASS');
  }

  // TEST 16: Exactly-once active run lock guard
  console.log('\n--- TEST 16: Exactly-Once Recovery Guard ---');
  {
    const checkpoint = makeCheckpoint();
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const { controller, storage } = await makeController();

    // Artificially acquire lock to simulate ongoing run
    await storage.acquireActiveRunLock({ runId: 'run_existing_active' });

    const duplicateRes = await controller.runCheckpointRecovery(job, {
      runId: 'run_concurrent_attempt'
    });

    assert.equal(duplicateRes.ok, false);
    assert.equal(duplicateRes.error, 'RUN_ALREADY_ACTIVE');
    pass('RECOVERY_EXACTLY_ONCE_GUARD=PASS');
  }

  // TEST 17: Origin run ID vs Recovery run ID correlation semantics
  console.log('\n--- TEST 17: Origin Run ID vs Recovery Run ID Semantics ---');
  {
    const checkpoint = makeCheckpoint({ run_id: 'run_1789836352166_a279b5a6' });
    const job = makeJob('mjob_5c0f488d7ee123b9579a58a5', { result_checkpoint: checkpoint });
    const { controller, provider } = await makeController();

    const res = await controller.runCheckpointRecovery(job, {
      runId: 'run_recovery_attempt_99',
      captureBlobProbe: true
    });

    // The descriptor's run_id remains origin run_id
    assert.equal(provider.lastCaptureDescriptor.run_id, 'run_1789836352166_a279b5a6');
    // The captureJob's run_id passed to provider.capture is origin run_id (so content-script matches descriptor.run_id)
    assert.equal(provider.lastCaptureJob.run_id, 'run_1789836352166_a279b5a6');
    // But audit/reporting returns recovery run_id as the execution attempt
    assert.equal(res.origin_run_id, 'run_1789836352166_a279b5a6');
    assert.equal(res.recovery_run_id, 'run_recovery_attempt_99');
    pass('CHECKPOINT_IDENTITY_IMMUTABLE=YES');
    pass('ORIGIN_RUN_ID_VS_RECOVERY_RUN_ID=PASS');
  }

  console.log('\n=== ALL PHASE 4B1A.5D1G TESTS PASSED ===');
}

main().catch((err) => {
  console.error('\nFAILED 5D1G TESTS:', err);
  process.exit(1);
});
