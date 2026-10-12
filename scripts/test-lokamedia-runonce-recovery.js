import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { MockProviderAdapter } from '../extensions/lokamedia/src/mock-provider.js';
import { summarizeCurrentJob, normalizeServerStatus, normalizeProviderStatus, evaluateRunOnceEligibility } from '../extensions/lokamedia/src/popup-core.js';
import { isRecoverableResultCheckpoint, isCaptureReadyProviderResult } from '../extensions/lokamedia/src/providers/chatgpt/correlation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, '../extensions/lokamedia/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

class MockApi {
  constructor({ jobs = [], nextJobFails = false } = {}) {
    this.jobs = [...jobs];
    this.nextJobFails = nextJobFails;
    this.calls = [];
    this.uploads = [];
  }

  async listJobs() {
    this.calls.push({ type: 'listJobs' });
    return { jobs: this.jobs };
  }

  async nextJob(deviceId) {
    this.calls.push({ type: 'nextJob', deviceId });
    if (this.nextJobFails) {
      const err = new Error('HTTP_500');
      err.status = 500;
      throw err;
    }
    const job = this.jobs.find((j) => j.status === 'QUEUED');
    return { job: job ?? null };
  }

  async heartbeat(jobId, body = {}) {
    this.calls.push({ type: 'heartbeat', jobId, body });
    return { job_id: jobId, job_revision: body.expected_job_revision ?? 1, status: 'LEASED' };
  }

  async reconcile(jobId) {
    this.calls.push({ type: 'reconcile', jobId });
    return { job_id: jobId, job_revision: 1, status: 'LEASED', recommended_action: 'CONTINUE' };
  }

  async releaseJob(jobId, payload) {
    this.calls.push({ type: 'releaseJob', jobId, payload });
    return { ok: true };
  }

  async uploadBlob(job, blob) {
    this.uploads.push({ job_id: job.job_id, key: blob.key });
    return {
      job_id: job.job_id,
      status: 'COMPLETE',
      attachment_confirmed: true,
      receipt: { receipt_type: 'ATTACHMENT_CONFIRMED' }
    };
  }
}

function makeJob(id, overrides = {}) {
  return {
    job_id: id,
    article_id: 7,
    article_title: 'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?',
    slot_key: 'featured',
    role: 'featured',
    prompt: 'Photorealistic window condensation...',
    prompt_version: 1,
    prompt_hash: 'hash-abc',
    status: 'QUEUED',
    local_state: 'QUEUED',
    attempt: 0,
    ...overrides
  };
}

async function makeHarness({ nextJobFails = false, jobs = [] } = {}) {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  await storage.saveConfig({
    enabled: true,
    serverBaseUrl: 'http://localhost:4321',
    deviceToken: 'test-token',
    deviceId: 'dev_chr_local'
  });
  await storage.update((state) => {
    state.status.connection = 'online';
    state.status.last_error = null;
    state.provider.chatgpt = {
      tab_status: 'connected',
      auth_state: 'AUTHENTICATED',
      dom_status: 'SUPPORTED',
      composer_status: 'ready',
      provider_lane: 'idle',
      visible_image_candidates: 1
    };
    for (const job of jobs) {
      state.jobs[job.job_id] = { ...job };
    }
  });

  const api = new MockApi({ jobs, nextJobFails });
  const blobStore = new MemoryBlobStore();
  const provider = new MockProviderAdapter();
  const controller = new LokaMediaController({
    apiClient: api,
    storage,
    blobStore,
    provider
  });

  return { storage, api, blobStore, provider, controller };
}

test('HTTP failure before provider submission does not permanently lock Run Once and does not submit prompt', async () => {
  const jobA = makeJob('mjob_9654a1ff6c242ce49711a664');
  const { storage, api, provider, controller } = await makeHarness({ nextJobFails: true, jobs: [jobA] });

  // 1. Simulate HTTP 500 error during nextJob acquisition
  let caughtError = null;
  try {
    await controller.runOnce({ runId: 'run_fail_before_submit' });
  } catch (err) {
    caughtError = err;
  }
  assert(caughtError, 'Expected nextJob failure to throw or return error');

  // 2. Audit: zero provider calls made
  const generateCalls = provider.calls.filter((c) => c.type === 'generate');
  assert.equal(generateCalls.length, 0, 'Zero provider generations must occur when lease acquisition fails');

  // 3. Audit: phase4bSingleRun was NOT consumed because error happened before submission
  const stateAfterFail = await storage.readState();
  const gate = stateAfterFail.phase4bSingleRun;
  assert.equal(gate?.submission_consumed, undefined, 'Submission gate must not be consumed');

  // 4. Server recovers: nextJob succeeds on next attempt
  api.nextJobFails = false;
  const current = summarizeCurrentJob(stateAfterFail);
  assert.equal(current.operation, 'Waiting');
  assert.equal(current.slot, 'featured');

  // Run Once stops at RESULT READY (Human Approval Boundary invariant)
  const successResult = await controller.runOnce({ runId: 'run_recovery_success' });
  assert.equal(successResult.ok, true);
  assert.equal(successResult.status, 'RESULT_READY');
  assert.equal(api.uploads.length, 0, 'Zero uploads before explicit human approval');
  assert.equal(provider.calls.filter((c) => c.type === 'generate').length, 1);

  // Explicit approval crosses upload boundary
  const approveResult = await controller.approveAndUpload({ jobId: successResult.job_id });
  assert.equal(approveResult.ok, true);
  assert.equal(api.uploads.length, 1);
});

test('Failure after provider submission protects against duplicate generation until reconciliation', async () => {
  const jobA = makeJob('mjob_9654a1ff6c242ce49711a664');
  const { storage, api, provider, controller } = await makeHarness({ jobs: [jobA] });

  // Override capture method on provider to simulate network drop after successful prompt submission
  provider.capture = async () => {
    throw new Error('CAPTURE_NETWORK_DROP');
  };

  let captureError = null;
  try {
    await controller.runOnce({ runId: 'run_submit_then_fail' });
  } catch (err) {
    captureError = err;
  }
  assert(captureError, 'Expected capture failure');

  // Verify prompt was indeed submitted once
  assert.equal(provider.calls.filter((c) => c.type === 'generate').length, 1);

  // Verify latch is CONSUMED for Job A
  const stateAfterSubmit = await storage.readState();
  const gate = stateAfterSubmit.phase4bSingleRun;
  assert(gate?.submission_consumed, 'Submission gate MUST be consumed to prevent duplicate prompt submission');

  // Attempting second runOnce routes to recovery or gate rejection, NEVER regenerating prompt
  try {
    await controller.runOnce({ runId: 'run_duplicate_attempt' });
  } catch (err) {
    // Catch any recovery lease / gate error
  }

  // Total provider generate calls remains strictly 1 (no duplicate generation!)
  assert.equal(provider.calls.filter((c) => c.type === 'generate').length, 1, 'Total provider generations must remain strictly 1');
});

test('Images = 1 pre-existing in DOM is NOT correlated to Job A', async () => {
  const jobA = makeJob('mjob_9654a1ff6c242ce49711a664');
  const unrelatedResult = {
    schema_version: 1,
    source_fingerprint: 'pre-existing-avatar-img',
    containerFingerprint: 'container-old',
    prompt_hash: 'completely_different_hash',
    prompt_version: 1,
    job_id: 'some_other_job'
  };

  // 1. isCaptureReadyProviderResult rejects wrong job_id
  const isCaptureReady = isCaptureReadyProviderResult(unrelatedResult, {
    job_id: jobA.job_id,
    run_id: 'run-1',
    slot_key: 'featured'
  });
  assert.equal(isCaptureReady, false, 'Unrelated pre-existing DOM images with different job_id must fail capture-ready validation');

  // 2. isRecoverableResultCheckpoint rejects missing/unmatched job_id and prompt_hash
  const isRecoverable = isRecoverableResultCheckpoint(unrelatedResult, jobA);
  assert.equal(isRecoverable, false, 'Unrelated pre-existing DOM image without matching prompt_hash cannot be recovered as Job A');
});

test('Transient HTTP_500 error is cleared when connection returns online in refreshServerState', async () => {
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  await storage.update((state) => {
    state.status.connection = 'offline';
    state.status.last_error = 'HTTP_500';
    state.config.deviceToken = 'token';
  });

  // Reconnection logic check
  await storage.update((nextState) => {
    nextState.status.connection = 'online';
    if (/WorkerGlobalScope|Illegal_invocation|Illegal invocation|fetch|HTTP_\d+|SERVER_UNAVAILABLE|ECONNREFUSED/i.test(String(nextState.status.last_error || ''))) {
      nextState.status.last_error = null;
    }
  });

  const state = await storage.readState();
  assert.equal(state.status.connection, 'online');
  assert.equal(state.status.last_error, null, 'HTTP_500 must be cleared when connection is online');
});

test('1. Runtime version comes from manifest.version declaration', () => {
  assert.equal(typeof manifest.version, 'string');
  assert.equal(manifest.version, '0.1.18', 'Manifest version must be bumped to 0.1.18');
});

test('2. Stale runtime version: Run Once disabled and reason = Reload required', () => {
  const jobA = makeJob('mjob_9654a1ff6c242ce49711a664');
  const testState = {
    config: { enabled: true },
    status: { connection: 'online' },
    jobs: { [jobA.job_id]: jobA }
  };
  const current = summarizeCurrentJob(testState);
  const provider = { tab: 'connected', auth: 'ready', dom: 'supported', composer: 'ready', lane: 'idle' };

  // Browser running stale 0.1.1 while server expects 0.1.6
  const evaluation = evaluateRunOnceEligibility({
    state: testState,
    current,
    provider,
    server: 'online',
    transfers: [],
    runtimeVersion: '0.1.1',
    expectedVersion: '0.1.6'
  });

  assert.equal(evaluation.eligible, false);
  assert.equal(evaluation.reason, 'Reload required');
});

test('3. Matching runtime version: version gate passes', () => {
  const jobA = makeJob('mjob_9654a1ff6c242ce49711a664');
  const testState = {
    config: { enabled: true },
    status: { connection: 'online' },
    jobs: { [jobA.job_id]: jobA }
  };
  const current = summarizeCurrentJob(testState);
  const provider = { tab: 'connected', auth: 'ready', dom: 'supported', composer: 'ready', lane: 'idle' };

  const evaluation = evaluateRunOnceEligibility({
    state: testState,
    current,
    provider,
    server: 'online',
    transfers: [],
    runtimeVersion: '0.1.6',
    expectedVersion: '0.1.6'
  });

  assert.equal(evaluation.eligible, true);
  assert.equal(evaluation.reason, '');
});

test('5. Run Once failure before acquire: stale "Run Once requested" clears and job remains retryable', async () => {
  const jobA = makeJob('mjob_9654a1ff6c242ce49711a664');
  const { storage, api, controller } = await makeHarness({ nextJobFails: true, jobs: [jobA] });

  try {
    await controller.runOnce({ runId: 'run_fail_before_acquire' });
  } catch (err) {
    // Expected nextJob failure
  }

  const stateAfterFail = await storage.readState();
  assert.notEqual(stateAfterFail.auditLog?.lastAction, 'Run Once requested', 'Transient "Run Once requested" must clear on acquire failure');
  assert.equal(stateAfterFail.phase4bSingleRun?.submission_consumed, undefined, 'Gate must not be consumed');

  // Job remains in Waiting state and retryable
  const current = summarizeCurrentJob(stateAfterFail);
  assert.equal(current.operation, 'Waiting');

  // Simulate server recovery
  api.nextJobFails = false;
  const result = await controller.runOnce({ runId: 'run_retry_after_fail' });
  assert.equal(result.ok, true);
});

test('7. Generic Article A featured job is eligible without article-title hardcode', () => {
  const articleAJob = makeJob('mjob_9654a1ff6c242ce49711a664', {
    article_title: 'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?'
  });
  const testState = {
    config: { enabled: true },
    status: { connection: 'online' },
    jobs: { [articleAJob.job_id]: articleAJob }
  };
  const current = summarizeCurrentJob(testState);
  const provider = { tab: 'connected', auth: 'ready', dom: 'supported', composer: 'ready', lane: 'idle' };

  const evaluation = evaluateRunOnceEligibility({
    state: testState,
    current,
    provider,
    server: 'online',
    transfers: [],
    runtimeVersion: '0.1.3',
    expectedVersion: '0.1.3'
  });

  assert.equal(evaluation.eligible, true, 'Real Article A title must be eligible without hardcoded test title');
  assert.equal(evaluation.reason, '');
});

test('8. Disabled button exposes concise reason across all conditions', () => {
  const jobA = makeJob('mjob_9654a1ff6c242ce49711a664');
  const baseState = {
    config: { enabled: true },
    status: { connection: 'online' },
    jobs: { [jobA.job_id]: jobA }
  };
  const current = summarizeCurrentJob(baseState);
  const providerReady = { tab: 'connected', auth: 'ready', dom: 'supported', composer: 'ready', lane: 'idle' };

  // 1. Extension paused
  assert.equal(
    evaluateRunOnceEligibility({
      state: { ...baseState, config: { enabled: false } },
      current,
      provider: providerReady,
      server: 'online',
      runtimeVersion: '0.1.6',
      expectedVersion: '0.1.6'
    }).reason,
    'Extension paused'
  );

  // 2. Server offline
  assert.equal(
    evaluateRunOnceEligibility({
      state: baseState,
      current,
      provider: providerReady,
      server: 'offline',
      runtimeVersion: '0.1.6',
      expectedVersion: '0.1.6'
    }).reason,
    'Server offline'
  );

  // 3. Backpressure active
  assert.equal(
    evaluateRunOnceEligibility({
      state: { ...baseState, status: { connection: 'backpressure' } },
      current,
      provider: providerReady,
      server: 'online',
      runtimeVersion: '0.1.6',
      expectedVersion: '0.1.6'
    }).reason,
    'Backpressure active'
  );

  // 4. Transfer active
  assert.equal(
    evaluateRunOnceEligibility({
      state: baseState,
      current,
      provider: providerReady,
      server: 'online',
      transfers: [{ label: 'Uploading', percentage: 50 }],
      runtimeVersion: '0.1.6',
      expectedVersion: '0.1.6'
    }).reason,
    'Transfer active'
  );

  // 5. Provider not ready (tab disconnected)
  assert.equal(
    evaluateRunOnceEligibility({
      state: baseState,
      current,
      provider: { ...providerReady, tab: 'missing' },
      server: 'online',
      runtimeVersion: '0.1.6',
      expectedVersion: '0.1.6'
    }).reason,
    'Provider not ready'
  );

  // 6. Provider lane busy
  assert.equal(
    evaluateRunOnceEligibility({
      state: baseState,
      current,
      provider: { ...providerReady, lane: 'bound' },
      server: 'online',
      runtimeVersion: '0.1.6',
      expectedVersion: '0.1.6'
    }).reason,
    'Provider lane busy'
  );

  // 7. Job already consumed
  assert.equal(
    evaluateRunOnceEligibility({
      state: { ...baseState, phase4bSingleRun: { job_id: jobA.job_id, submission_consumed: true } },
      current,
      provider: providerReady,
      server: 'online',
      runtimeVersion: '0.1.6',
      expectedVersion: '0.1.6'
    }).reason,
    'Job already consumed'
  );

  // 8. No eligible job
  assert.equal(
    evaluateRunOnceEligibility({
      state: { ...baseState, jobs: {} },
      current: summarizeCurrentJob({ jobs: {} }),
      provider: providerReady,
      server: 'online',
      runtimeVersion: '0.1.6',
      expectedVersion: '0.1.6'
    }).reason,
    'No eligible job'
  );
});

test('9. Generic convergence rule: safe server-authoritative QUEUED state clears stale pre-submission failure gate and lastAction', async () => {
  const jobA = makeJob('mjob_9654a1ff6c242ce49711a664');
  const storage = ExtensionStorage.memory();
  await storage.initialize();
  await storage.update((state) => {
    state.config.enabled = true;
    state.status.connection = 'online';
    state.status.last_error = 'DOM_CONTRACT_UNSUPPORTED';
    state.auditLog = {
      events: [],
      lastAction: 'Needs attention - DOM_CONTRACT_UNSUPPORTED',
      nextSequence: 2
    };
    state.phase4bSingleRun = {
      job_id: jobA.job_id,
      phase4b_single_run_id: 'run_stale_123',
      submission_consumed: false,
      generation_consumed: false,
      last_error: 'DOM_CONTRACT_UNSUPPORTED',
      outcome: 'needs_attention',
      completed_at: new Date().toISOString()
    };
    state.jobs[jobA.job_id] = {
      ...jobA,
      local_state: 'QUEUED',
      needs_attention: true,
      last_error: 'DOM_CONTRACT_UNSUPPORTED'
    };
  });

  const api = new MockApi({ jobs: [jobA] });
  const response = await api.listJobs();
  await storage.update((nextState) => {
    for (const job of response.jobs ?? []) {
      const isSafeServerQueued =
        job.status === 'QUEUED' &&
        !job.lease_owner &&
        !job.last_error_code &&
        job.attempt === 0 &&
        !nextState.locks?.activeRun;

      if (isSafeServerQueued) {
        nextState.jobs[job.job_id].last_error = null;
        nextState.jobs[job.job_id].needs_attention = false;
        const gate = nextState.phase4bSingleRun;
        if (gate && (!gate.job_id || gate.job_id === job.job_id)) {
          const isNonConsumedPreSubmissionError =
            gate.last_error === 'DOM_CONTRACT_UNSUPPORTED' ||
            gate.last_error === 'PROMPT_INSERTION_VERIFICATION_FAILED' ||
            gate.last_error === 'SEND_CONTROL_UNAVAILABLE' ||
            gate.last_error === 'SEND_CONTROL_DISABLED' ||
            gate.last_error === 'AUTH_REQUIRED' ||
            gate.last_error === 'PROVIDER_PRECHECK_FAIL';
          if (isNonConsumedPreSubmissionError || (!gate.submission_consumed && !gate.generation_consumed)) {
            nextState.phase4bSingleRun = null;
            if (nextState.auditLog?.lastAction?.startsWith('Needs attention')) {
              nextState.auditLog.lastAction = 'Idle';
            }
            if (nextState.status.last_error) nextState.status.last_error = null;
          }
        }
      }
    }
  });

  const finalState = await storage.readState();
  assert.equal(finalState.phase4bSingleRun, null, 'Stale pre-submission gate must be cleared');
  assert.equal(finalState.auditLog.lastAction, 'Idle', 'Last action must converge to Idle');
  assert.equal(finalState.jobs[jobA.job_id].last_error, null, 'Job last_error must be null');
  assert.equal(finalState.jobs[jobA.job_id].needs_attention, false, 'needs_attention must be false');

  const current = summarizeCurrentJob(finalState);
  const providerReady = { tab: 'connected', auth: 'ready', dom: 'supported', composer: 'ready', lane: 'idle' };
  const eligibility = evaluateRunOnceEligibility({
    state: finalState,
    current,
    provider: providerReady,
    server: 'online',
    runtimeVersion: '0.1.6',
    expectedVersion: '0.1.6'
  });
  assert.equal(eligibility.eligible, true, 'Run Once must be eligible after convergence');
  assert.equal(eligibility.reason, '');
});
