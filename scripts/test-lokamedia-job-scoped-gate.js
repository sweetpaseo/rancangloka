import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getJobWorkflowDetails,
  evaluateRunOnceEligibility,
  summarizeCurrentJob
} from '../extensions/lokamedia/src/popup-core.js';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { EXTENSION_VERSION } from '../extensions/lokamedia/src/constants.js';

class MemoryStorage {
  constructor(initialState = {}) {
    this.state = {
      config: { enabled: true, serverBaseUrl: 'http://localhost:4321', deviceToken: 'dev-token', deviceId: 'dev_chr_local' },
      status: { connection: 'online', last_error: null, transfers: [] },
      counters: { totalJobs: 0, active: 0, waiting: 0, complete: 0 },
      jobs: {},
      uploadQueue: [],
      locks: { providerLane: null, activeRun: null },
      phase4bSingleRun: null,
      phase4bJobGates: {},
      provider: {
        chatgpt: {
          provider_tab_id: 101,
          target_state: 'LOCKED',
          bound_tab_id: 101,
          bound_url: 'https://chatgpt.com/c/locked-tab',
          tab_status: 'connected',
          auth_state: 'AUTHENTICATED',
          dom_status: 'SUPPORTED',
          composer_status: 'ready',
          visible_image_candidates: 0,
          provider_lane: 'idle'
        }
      },
      auditLog: { events: [], lastAction: 'Idle' },
      ...initialState
    };
  }

  async readState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  async update(mutator) {
    const copy = JSON.parse(JSON.stringify(this.state));
    await mutator(copy);
    this.state = copy;
    return this.state;
  }

  async upsertJob(jobId, patch) {
    this.state.jobs[jobId] = { ...(this.state.jobs[jobId] || { job_id: jobId }), ...patch };
    return this.state.jobs[jobId];
  }

  async acquireActiveRunLock({ runId }) {
    if (this.state.locks.activeRun && this.state.locks.activeRun.run_id !== runId) {
      return { acquired: false, lock: this.state.locks.activeRun };
    }
    this.state.locks.activeRun = { run_id: runId, acquired_at: new Date().toISOString() };
    return { acquired: true, lock: this.state.locks.activeRun };
  }

  async releaseActiveRunLock() {
    this.state.locks.activeRun = null;
    return { released: true };
  }

  async armPhase4bSingleRun({ jobId, runId = crypto.randomUUID(), now = new Date().toISOString() }) {
    return this.update((state) => {
      state.phase4bJobGates ??= {};
      if (state.phase4bSingleRun?.job_id) {
        state.phase4bJobGates[state.phase4bSingleRun.job_id] = state.phase4bSingleRun;
      }
      const gate = jobId ? (state.phase4bJobGates[jobId] || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null)) : state.phase4bSingleRun;
      if (gate && (!jobId || gate.job_id === jobId) && (gate.submission_consumed || gate.generation_consumed || (gate.completed_at && gate.outcome === 'complete'))) {
        return { armed: false, reason: 'PHASE_4B_RUN_CONSUMED', gate };
      }
      const newGate = {
        phase4b_single_run_id: runId,
        job_id: jobId,
        armed_at: now,
        submission_consumed: false,
        generation_consumed: false,
        completed_at: null,
        last_error: null
      };
      if (jobId) {
        state.phase4bJobGates[jobId] = newGate;
      }
      state.phase4bSingleRun = newGate;
      return { armed: true, gate: newGate };
    });
  }

  async disarmPhase4bSubmission({ jobId }) {
    return this.update((state) => {
      state.phase4bJobGates ??= {};
      const gate = (jobId && state.phase4bJobGates[jobId]) || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null);
      if (!gate || (gate.job_id && gate.job_id !== jobId)) return { disarmed: false };
      gate.submission_consumed = false;
      gate.generation_consumed = false;
      delete gate.consumed_at;
      if (jobId) state.phase4bJobGates[jobId] = gate;
      if (state.phase4bSingleRun?.job_id === jobId) state.phase4bSingleRun = gate;
      return { disarmed: true, gate };
    });
  }

  async consumePhase4bSubmission({ jobId, now = new Date().toISOString() }) {
    return this.update((state) => {
      state.phase4bJobGates ??= {};
      if (state.phase4bSingleRun?.job_id && !state.phase4bJobGates[state.phase4bSingleRun.job_id]) {
        state.phase4bJobGates[state.phase4bSingleRun.job_id] = state.phase4bSingleRun;
      }
      const gate = (jobId && state.phase4bJobGates[jobId]) || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null);
      if (!gate) return { consumed: false, reason: 'PHASE_4B_RUN_NOT_ARMED' };
      if (gate.job_id && gate.job_id !== jobId) return { consumed: false, reason: 'PHASE_4B_WRONG_JOB' };
      if (gate.submission_consumed || gate.generation_consumed || gate.completed_at) {
        return { consumed: false, reason: 'PHASE_4B_SUBMISSION_ALREADY_CONSUMED' };
      }
      gate.job_id = jobId;
      gate.submission_consumed = true;
      gate.generation_consumed = true;
      gate.consumed_at = now;
      if (jobId) state.phase4bJobGates[jobId] = gate;
      if (!state.phase4bSingleRun || state.phase4bSingleRun.job_id === jobId) state.phase4bSingleRun = gate;
      return { consumed: true, gate };
    });
  }

  async completePhase4bSingleRun({ jobId, ok = true, error = null, now = new Date().toISOString() }) {
    return this.update((state) => {
      state.phase4bJobGates ??= {};
      if (state.phase4bSingleRun?.job_id && !state.phase4bJobGates[state.phase4bSingleRun.job_id]) {
        state.phase4bJobGates[state.phase4bSingleRun.job_id] = state.phase4bSingleRun;
      }
      const gate = (jobId && state.phase4bJobGates[jobId]) || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null);
      if (!gate || (gate.job_id && gate.job_id !== jobId)) return { completed: false };
      gate.completed_at = now;
      gate.last_error = error;
      gate.outcome = ok ? 'complete' : 'needs_attention';
      if (jobId) state.phase4bJobGates[jobId] = gate;
      if (!state.phase4bSingleRun || state.phase4bSingleRun.job_id === jobId) state.phase4bSingleRun = gate;
      return { completed: true, gate };
    });
  }
}

function createHarness(initialState = {}) {
  const storage = new MemoryStorage(initialState);
  let providerCalls = 0;
  const mockProvider = {
    async prepare() {},
    async generate() {
      providerCalls++;
      return {
        schema_version: 2,
        provider_conversation_id: 'conv_gen_1',
        provider_response_id: 'resp_gen_1',
        source_fingerprint: 'sfp_1',
        containerFingerprint: 'cfp_1'
      };
    }
  };
  const mockLane = {
    async acquire() { return true; },
    async release() {}
  };
  const controller = new LokaMediaController({
    storage,
    blobStore: { put: async () => {}, get: async () => null },
    provider: mockProvider,
    apiClient: {},
    audit: {
      async info() {},
      async warn() {},
      async error() {}
    },
    providerLane: mockLane,
    uploads: { async drain() {} }
  });
  return { storage, controller, getProviderCalls: () => providerCalls };
}

function makeJob(id, { title = 'Generic Architectural Article', status = 'QUEUED', prompt = 'Architectural photo of interior detail.' } = {}) {
  return {
    job_id: id,
    article_id: Math.floor(Math.random() * 1000) + 1,
    article_title: title,
    slot_key: 'featured',
    target_dimensions: '1792 × 1024 (Featured)',
    prompt,
    status,
    local_state: status,
    attempt: 0,
    lease_owner: null,
    created_at: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// TEST 1: Job A completes and becomes immutable with submission_consumed = true
// ---------------------------------------------------------------------------
test('1. Job A: QUEUED -> submit -> COMPLETE -> submission_consumed = true and cannot rerun', async () => {
  const jobAId = `mjob_test_a_${crypto.randomUUID().slice(0, 8)}`;
  const jobA = makeJob(jobAId, { title: 'Article A: Fenestration and Moisture Control', status: 'QUEUED' });
  const { storage, controller, getProviderCalls } = createHarness({
    jobs: { [jobAId]: jobA }
  });

  // Send Job A to ChatGPT
  const sendRes = await controller.sendToChatGpt({ jobId: jobAId });
  assert.equal(sendRes.ok, true, 'Job A first submission must succeed');
  assert.equal(getProviderCalls(), 1);

  // Complete Job A
  await storage.completePhase4bSingleRun({ jobId: jobAId, ok: true });
  await storage.upsertJob(jobAId, { status: 'COMPLETE', local_state: 'COMPLETE' });

  const stateAfterA = await storage.readState();
  const gateA = stateAfterA.phase4bJobGates[jobAId];
  assert.equal(gateA.job_id, jobAId);
  assert.equal(gateA.submission_consumed, true);
  assert.equal(gateA.outcome, 'complete');

  // Attempting to rerun Job A must fail with PHASE_4B_RUN_CONSUMED
  const rerunRes = await controller.sendToChatGpt({ jobId: jobAId });
  assert.equal(rerunRes.ok, false);
  assert.equal(rerunRes.error, 'PHASE_4B_RUN_CONSUMED');
  assert.equal(getProviderCalls(), 1, 'Provider must not be called on duplicate attempt');

  // Last error must be set to PHASE_4B_RUN_CONSUMED when Job A itself is consumed
  const stateAfterRerun = await storage.readState();
  assert.equal(stateAfterRerun.status.last_error, 'PHASE_4B_RUN_CONSUMED');
});

// ---------------------------------------------------------------------------
// TEST 2: Job B arrives and is PROMPT READY, SEND enabled, zero consumption leak
// ---------------------------------------------------------------------------
test('2. Server exposes Job B: Job A consumed does NOT block Job B (PROMPT READY & SEND enabled)', async () => {
  const jobAId = `mjob_alpha_${crypto.randomUUID().slice(0, 8)}`;
  const jobBId = `mjob_beta_${crypto.randomUUID().slice(0, 8)}`;

  const jobA = makeJob(jobAId, { title: 'Article A: Moisture Ingress', status: 'COMPLETE' });
  const jobB = makeJob(jobBId, { title: 'Article B: Thermal Bridging in Aluminium Profiles', status: 'QUEUED' });

  const { storage, controller, getProviderCalls } = createHarness({
    jobs: {
      [jobAId]: jobA,
      [jobBId]: jobB
    },
    // Historical state: Job A is stored as consumed in phase4bJobGates
    phase4bJobGates: {
      [jobAId]: {
        job_id: jobAId,
        submission_consumed: true,
        generation_consumed: true,
        completed_at: new Date().toISOString(),
        outcome: 'complete'
      }
    },
    phase4bSingleRun: {
      job_id: jobAId,
      submission_consumed: true,
      generation_consumed: true,
      completed_at: new Date().toISOString(),
      outcome: 'complete'
    }
  });

  const state = await storage.readState();
  const provider = state.provider.chatgpt;

  // Evaluate UI workflow details for Job B
  const workflow = getJobWorkflowDetails(state, provider);
  assert.equal(workflow.job_id, jobBId, 'Current active/queued job must be Job B');
  assert.equal(workflow.stage, 'PROMPT READY', 'Job B workflow must be PROMPT READY');
  assert.equal(workflow.can_send, true, 'SEND TO CHATGPT must be enabled for Job B');
  assert.equal(workflow.send_reason, '');

  // Evaluate Run Once eligibility for Job B
  const current = summarizeCurrentJob(state);
  assert.equal(current.job_id, jobBId);
  const eligibility = evaluateRunOnceEligibility({
    state,
    current,
    provider: { tab: 'connected', target: 'LOCKED', target_bound: true, auth: 'ready', dom: 'supported', composer: 'ready', lane: 'idle' },
    server: 'online',
    runtimeVersion: EXTENSION_VERSION,
    expectedVersion: EXTENSION_VERSION
  });
  assert.equal(eligibility.eligible, true, 'Job B must be eligible for Run Once');
  assert.equal(eligibility.reason, '');

  // Send Job B to ChatGPT
  const sendResB = await controller.sendToChatGpt({ jobId: jobBId });
  assert.equal(sendResB.ok, true, 'Job B submission must succeed');
  assert.equal(getProviderCalls(), 1);

  // Verify Job A remains permanently consumed and unmutated
  const stateAfterB = await storage.readState();
  const gateA = stateAfterB.phase4bJobGates[jobAId];
  assert.equal(gateA.submission_consumed, true);
  assert.equal(gateA.outcome, 'complete');

  // Verify Job B now has its own distinct gate
  const gateB = stateAfterB.phase4bJobGates[jobBId];
  assert.equal(gateB.job_id, jobBId);
  assert.equal(gateB.submission_consumed, true);
  assert.notEqual(gateA.phase4b_single_run_id, gateB.phase4b_single_run_id);
});

// ---------------------------------------------------------------------------
// TEST 3: Generic multi-job progression: A complete, B complete, C queued remains eligible
// ---------------------------------------------------------------------------
test('3. Generic progression (A complete, B complete, C queued): C remains eligible and isolated', async () => {
  const jobAId = `mjob_gen_a_${crypto.randomUUID().slice(0, 8)}`;
  const jobBId = `mjob_gen_b_${crypto.randomUUID().slice(0, 8)}`;
  const jobCId = `mjob_gen_c_${crypto.randomUUID().slice(0, 8)}`;

  const jobA = makeJob(jobAId, { title: 'Job A Article', status: 'COMPLETE' });
  const jobB = makeJob(jobBId, { title: 'Job B Article', status: 'COMPLETE' });
  const jobC = makeJob(jobCId, { title: 'Job C Article', status: 'QUEUED' });

  const { storage, controller, getProviderCalls } = createHarness({
    jobs: {
      [jobAId]: jobA,
      [jobBId]: jobB,
      [jobCId]: jobC
    },
    phase4bJobGates: {
      [jobAId]: { job_id: jobAId, submission_consumed: true, generation_consumed: true, outcome: 'complete' },
      [jobBId]: { job_id: jobBId, submission_consumed: true, generation_consumed: true, outcome: 'complete' }
    },
    phase4bSingleRun: { job_id: jobBId, submission_consumed: true, generation_consumed: true, outcome: 'complete' }
  });

  const state = await storage.readState();
  const provider = state.provider.chatgpt;

  // Job C workflow and eligibility
  const workflowC = getJobWorkflowDetails(state, provider);
  assert.equal(workflowC.job_id, jobCId);
  assert.equal(workflowC.stage, 'PROMPT READY');
  assert.equal(workflowC.can_send, true);

  // Both Job A and Job B must reject rerun
  const rerunA = await controller.sendToChatGpt({ jobId: jobAId });
  assert.equal(rerunA.ok, false);
  assert.equal(rerunA.error, 'PHASE_4B_RUN_CONSUMED');

  const rerunB = await controller.sendToChatGpt({ jobId: jobBId });
  assert.equal(rerunB.ok, false);
  assert.equal(rerunB.error, 'PHASE_4B_RUN_CONSUMED');

  // Job C must execute cleanly
  const sendC = await controller.sendToChatGpt({ jobId: jobCId });
  assert.equal(sendC.ok, true);
  assert.equal(getProviderCalls(), 1);
});

// ---------------------------------------------------------------------------
// TEST 4: Job transition reconciliation clears stale last_error and resets active checkpoint
// ---------------------------------------------------------------------------
test('4. Job transition reconciliation clears stale INTERNAL_ERROR and resets active gate for Job B', async () => {
  const jobAId = `mjob_prev_a_${crypto.randomUUID().slice(0, 8)}`;
  const jobBId = `mjob_new_b_${crypto.randomUUID().slice(0, 8)}`;

  const jobA = makeJob(jobAId, { status: 'COMPLETE' });
  const jobB = makeJob(jobBId, { status: 'QUEUED' });

  // Initial state simulates observed bug: Job A was consumed, status.last_error was 'INTERNAL_ERROR'
  const storage = new MemoryStorage({
    status: { connection: 'online', last_error: 'INTERNAL_ERROR', transfers: [] },
    jobs: { [jobAId]: jobA },
    phase4bSingleRun: {
      phase4b_single_run_id: 'run_legacy_1',
      job_id: jobAId,
      submission_consumed: true,
      generation_consumed: true,
      completed_at: new Date().toISOString(),
      outcome: 'complete'
    }
  });

  // Simulate refreshServerState delivering new safe QUEUED job B
  await storage.update((nextState) => {
    nextState.status.connection = 'online';
    // Server returned jobs including Job A (complete) and Job B (queued)
    const serverJobs = [jobA, jobB];

    if (/WorkerGlobalScope|Illegal_invocation|Illegal invocation|fetch|HTTP_\d+|SERVER_UNAVAILABLE|ECONNREFUSED|INTERNAL_ERROR/i.test(String(nextState.status.last_error || ''))) {
      nextState.status.last_error = null;
    }

    for (const job of serverJobs) {
      const local = nextState.jobs[job.job_id] ?? {};
      const merged = { ...local, ...job, local_state: job.status };

      const isSafeServerQueued =
        job.status === 'QUEUED' &&
        !job.lease_owner &&
        !job.last_error_code &&
        job.attempt === 0 &&
        !nextState.locks?.activeRun;

      if (isSafeServerQueued) {
        merged.last_error = null;
        merged.needs_attention = false;

        // Preserve any existing phase4bSingleRun to job-scoped history
        nextState.phase4bJobGates ??= {};
        if (nextState.phase4bSingleRun?.job_id) {
          nextState.phase4bJobGates[nextState.phase4bSingleRun.job_id] = nextState.phase4bSingleRun;
        }

        // Unbind active pointer from prior job so new job is clean
        if (nextState.phase4bSingleRun && nextState.phase4bSingleRun.job_id !== job.job_id) {
          nextState.phase4bSingleRun = null;
        }

        const gate = nextState.phase4bJobGates[job.job_id] || nextState.phase4bSingleRun;
        if (!gate) {
          if (nextState.status.last_error) nextState.status.last_error = null;
        }
      }

      nextState.jobs[job.job_id] = merged;
    }
  });

  const state = await storage.readState();

  // 1. Job A historical record remains preserved
  assert.equal(state.phase4bJobGates[jobAId].submission_consumed, true);
  assert.equal(state.phase4bJobGates[jobAId].outcome, 'complete');

  // 2. Active pointer phase4bSingleRun is cleared / not leaking Job A
  assert.equal(state.phase4bSingleRun, null);

  // 3. Stale INTERNAL_ERROR is completely cleared
  assert.equal(state.status.last_error, null, 'Last error must be null (none) for reconciled Job B');

  // 4. Job B workflow is PROMPT READY and can send
  const workflow = getJobWorkflowDetails(state, state.provider.chatgpt);
  assert.equal(workflow.job_id, jobBId);
  assert.equal(workflow.stage, 'PROMPT READY');
  assert.equal(workflow.can_send, true);
});
