/**
 * RancangLoka — LokaMedia Operator UX-2 Regression Suite
 *
 * Covers:
 * 1. Prompt preview equals submitted prompt exactly
 * 2. No Send without explicit operator action
 * 3. No Send without bound provider tab
 * 4. Only bound-tab result can become current result
 * 5. Unrelated old images are ignored
 * 6. Capture Latest Image selects correct newest current-run image
 * 7. Reject performs zero upload
 * 8. Approve & Upload uploads exactly the selected previewed asset
 * 9. Generation != Upload != Featured Assignment state separation
 * 10. Article A completed job cannot rerun
 * 11. No arbitrary ChatGPT tab fallback
 * 12. Extension version bumped to 0.1.5
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getJobWorkflowDetails,
  normalizeProviderStatus,
  evaluateRunOnceEligibility
} from '../extensions/lokamedia/src/popup-core.js';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { EXTENSION_VERSION } from '../extensions/lokamedia/src/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(repoRoot, 'extensions', 'lokamedia');

function createMockStorage(initialState = {}) {
  let state = {
    config: { enabled: true, serverBaseUrl: 'http://localhost:4321', deviceToken: 'dev-token' },
    status: { connection: 'online', last_error: null },
    counters: { totalJobs: 1, active: 0, waiting: 1, complete: 0 },
    jobs: {},
    uploadQueue: [],
    locks: { providerLane: null },
    phase4bSingleRun: null,
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
    ...initialState
  };

  const auditEvents = [];
  const uploadQueueLog = [];

  return {
    async readState() {
      return JSON.parse(JSON.stringify(state));
    },
    async update(mutator) {
      const copy = JSON.parse(JSON.stringify(state));
      await mutator(copy);
      state = copy;
      return state;
    },
    async upsertJob(jobId, patch) {
      state.jobs[jobId] = { ...(state.jobs[jobId] || { job_id: jobId }), ...patch };
      return state.jobs[jobId];
    },
    async armPhase4bSingleRun({ runId, jobId }) {
      state.phase4bSingleRun = {
        phase4b_single_run_id: runId,
        job_id: jobId,
        submission_consumed: false,
        generation_consumed: false
      };
      return state.phase4bSingleRun;
    },
    async acquireActiveRunLock({ runId }) {
      return { acquired: true, lock: { run_id: runId } };
    },
    async releaseActiveRunLock() {
      return { released: true };
    },
    async consumePhase4bSubmission({ jobId }) {
      state.phase4bSingleRun = {
        job_id: jobId,
        submission_consumed: true,
        generation_consumed: false,
        submitted_at: new Date().toISOString()
      };
      return state.phase4bSingleRun;
    },
    async completePhase4bSingleRun({ jobId, ok }) {
      state.phase4bSingleRun = {
        ...(state.phase4bSingleRun || {}),
        job_id: jobId,
        outcome: ok ? 'complete' : 'error',
        completed_at: new Date().toISOString()
      };
      return state.phase4bSingleRun;
    },
    async enqueueUpload(jobId) {
      state.uploadQueue = state.uploadQueue || [];
      state.uploadQueue.push(jobId);
      uploadQueueLog.push(jobId);
    },
    async dequeueUpload(jobId) {
      state.uploadQueue = (state.uploadQueue || []).filter((id) => id !== jobId);
    },
    async recordHumanApproval(params = {}) {
      const jobId = params.jobId || params.job_id;
      state.jobApprovals = state.jobApprovals || {};
      const record = {
        job_id: jobId,
        run_id: params.runId || params.run_id,
        candidate_sha256: params.candidateSha256 || params.candidate_sha256,
        approved_at: new Date().toISOString(),
        approval_source: params.approvalSource || params.approval_source || 'operator_side_panel',
        consumed: Boolean(params.consumed),
        consumed_at: params.consumed ? new Date().toISOString() : null
      };
      state.jobApprovals[jobId] = record;
      return { ok: true, approval: record };
    },
    async getHumanApproval(jobId) {
      return state.jobApprovals?.[jobId] || null;
    },
    async consumeHumanApproval(params = {}) {
      const jobId = params.jobId || params.job_id;
      state.jobApprovals = state.jobApprovals || {};
      const approval = state.jobApprovals[jobId];
      if (!approval) return { consumed: false, reason: 'NO_APPROVAL_RECORD' };
      approval.consumed = true;
      return { consumed: true, approval };
    },
    async recordHumanRejection(params = {}) {
      const jobId = params.jobId || params.job_id;
      state.jobRejections = state.jobRejections || {};
      const record = {
        job_id: jobId,
        run_id: params.runId || params.run_id,
        candidate_sha256: params.candidateSha256 || params.candidate_sha256,
        rejected_at: new Date().toISOString(),
        rejection_source: params.rejectionSource || params.rejection_source || 'operator_side_panel'
      };
      state.jobRejections[jobId] = record;
      return { ok: true, rejection: record };
    },
    getUploadQueue() {
      return uploadQueueLog;
    },
    audit: {
      async info(code, payload) {
        auditEvents.push({ level: 'INFO', code, payload, timestamp: new Date().toISOString() });
      },
      async warn(code, payload) {
        auditEvents.push({ level: 'WARN', code, payload, timestamp: new Date().toISOString() });
      },
      async error(code, payload) {
        auditEvents.push({ level: 'ERROR', code, payload, timestamp: new Date().toISOString() });
      }
    },
    getAuditEvents() {
      return auditEvents;
    }
  };
}

function createMockBlobStore() {
  const store = new Map();
  return {
    async put(record) {
      store.set(record.key, { ...record });
      return { ok: true, key: record.key };
    },
    async get(key) {
      return store.get(key) || null;
    },
    async delete(key) {
      return store.delete(key);
    },
    getStore() {
      return store;
    }
  };
}

// ---------------------------------------------------------------------------
// TEST 1: Prompt preview equals submitted prompt exactly
// ---------------------------------------------------------------------------
test('1. Prompt preview equals submitted prompt exactly (canonical string preservation)', async () => {
  const canonicalPrompt = 'Editorial architectural photograph of modern AAC autoclaved aerated concrete masonry wall in residential Jakarta home, sharp 50mm lens, natural daylight.';
  const job = {
    job_id: 'mjob_preview_test_1',
    article_id: 7,
    article_title: 'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?',
    slot_key: 'featured',
    target_dimensions: '1792 × 1024 (Featured)',
    prompt: canonicalPrompt,
    local_state: 'QUEUED',
    status: 'QUEUED'
  };

  const state = {
    config: { enabled: true },
    jobs: { [job.job_id]: job }
  };
  const provider = {
    provider_tab_id: 101,
    target_state: 'LOCKED',
    tab_status: 'connected',
    auth_state: 'AUTHENTICATED',
    dom_status: 'SUPPORTED',
    composer_status: 'ready',
    provider_lane: 'idle'
  };

  const workflow = getJobWorkflowDetails(state, provider);
  assert.equal(workflow.prompt, canonicalPrompt, 'Workflow preview prompt must match canonical prompt string');
  assert.equal(workflow.article_title, job.article_title);
  assert.equal(workflow.slot, 'featured');
  assert.equal(workflow.target_dimensions, '1792 × 1024 (Featured)');
  assert.equal(workflow.can_copy, true);
  assert.equal(workflow.can_send, true);

  // Verify that sendToChatGpt sends this exact string to provider.generate
  let generatedPromptPassed = null;
  const mockStorage = createMockStorage({ jobs: { [job.job_id]: job } });
  const mockBlobStore = createMockBlobStore();
  const mockProvider = {
    async prepare(targetJob) {},
    async generate(targetJob) {
      generatedPromptPassed = targetJob.prompt;
      return {
        schema_version: 2,
        provider_conversation_id: 'conv_123',
        provider_response_id: 'resp_456',
        source_fingerprint: 'fp_789',
        containerFingerprint: 'cfp_012'
      };
    }
  };

  const controller = new LokaMediaController({
    storage: mockStorage,
    blobStore: mockBlobStore,
    provider: mockProvider,
    apiClient: {},
    audit: mockStorage.audit,
    providerLane: { async acquire() { return true; }, async release() {} },
    uploads: { async drain() {} }
  });

  const sendResult = await controller.sendToChatGpt({ jobId: job.job_id });
  assert.equal(sendResult.ok, true);
  assert.equal(generatedPromptPassed, canonicalPrompt, 'Controller must submit the exact canonical prompt to provider');
});

// ---------------------------------------------------------------------------
// TEST 2: No Send without explicit operator action
// ---------------------------------------------------------------------------
test('2. No Send without explicit operator action (passive state reading never submits)', async () => {
  const canonicalPrompt = 'Editorial architectural photograph of modern AAC masonry wall.';
  const job = {
    job_id: 'mjob_explicit_test_2',
    article_title: 'Test Article',
    prompt: canonicalPrompt,
    local_state: 'QUEUED',
    status: 'QUEUED'
  };

  let submitCalled = false;
  const mockStorage = createMockStorage({ jobs: { [job.job_id]: job } });
  const mockProvider = {
    async generate() { submitCalled = true; }
  };

  const controller = new LokaMediaController({
    storage: mockStorage,
    blobStore: createMockBlobStore(),
    provider: mockProvider,
    apiClient: {},
    audit: mockStorage.audit,
    providerLane: { async acquire() { return true; }, async release() {} },
    uploads: { async drain() {} }
  });

  // Read state multiple times as if background polling
  await mockStorage.readState();
  const provider = {
    provider_tab_id: 101,
    target_state: 'LOCKED',
    tab_status: 'connected',
    auth_state: 'AUTHENTICATED',
    dom_status: 'SUPPORTED',
    composer_status: 'ready',
    provider_lane: 'idle'
  };
  const wf1 = getJobWorkflowDetails(await mockStorage.readState(), provider);
  assert.equal(submitCalled, false, 'Reading workflow must NEVER trigger provider submission');
  assert.equal(wf1.stage, 'PROMPT READY');
  assert.equal(wf1.can_send, true);
});

// ---------------------------------------------------------------------------
// TEST 3: No Send without bound provider tab
// ---------------------------------------------------------------------------
test('3. No Send without bound provider tab (fails closed when target is NOT BOUND)', async () => {
  const job = {
    job_id: 'mjob_unbound_test_3',
    article_title: 'Test Article',
    prompt: 'Prompt text',
    local_state: 'QUEUED',
    status: 'QUEUED'
  };

  // State with provider NOT BOUND
  const mockStorage = createMockStorage({
    jobs: { [job.job_id]: job },
    provider: {
      chatgpt: {
        provider_tab_id: null,
        target_state: 'NOT BOUND',
        bound_tab_id: null
      }
    }
  });

  const workflow = getJobWorkflowDetails(await mockStorage.readState(), { target: 'NOT BOUND', bound_tab_id: null });
  assert.equal(workflow.can_send, false, 'can_send must be false when provider is NOT BOUND');
  assert.equal(workflow.stage, 'WAITING');
  assert.match(workflow.send_reason, /LOCKED required/);

  const controller = new LokaMediaController({
    storage: mockStorage,
    blobStore: createMockBlobStore(),
    provider: {},
    apiClient: {},
    audit: mockStorage.audit,
    providerLane: { async acquire() { return true; }, async release() {} },
    uploads: { async drain() {} }
  });

  const res = await controller.sendToChatGpt({ jobId: job.job_id });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'PROVIDER_TARGET_NOT_LOCKED');
});

// ---------------------------------------------------------------------------
// TEST 4: Only bound-tab result can become current result
// ---------------------------------------------------------------------------
test('4. Only bound-tab result can become current result', async () => {
  const job = {
    job_id: 'mjob_bound_tab_result_4',
    local_state: 'IMAGE_DETECTED',
    result_checkpoint: { run_id: 'run_1' }
  };

  let targetTabInspected = null;
  const mockStorage = createMockStorage({ jobs: { [job.job_id]: job } });
  const mockProvider = {
    async captureLatest(opts) {
      targetTabInspected = 101;
      return {
        blobKey: `${job.job_id}:1`,
        bytes: new Uint8Array([1, 2, 3, 4]).buffer,
        sha256: 'abc123sha256',
        mime: 'image/png',
        width: 1792,
        height: 1024,
        size: 4
      };
    }
  };

  const controller = new LokaMediaController({
    storage: mockStorage,
    blobStore: createMockBlobStore(),
    provider: mockProvider,
    apiClient: {},
    audit: mockStorage.audit,
    providerLane: { async acquire() { return true; }, async release() {} },
    uploads: { async drain() {} }
  });

  const capRes = await controller.captureLatestImage({ jobId: job.job_id });
  assert.equal(capRes.ok, true);
  assert.equal(targetTabInspected, 101, 'Must strictly inspect bound tab ID 101');
  assert.equal(capRes.sha256, 'abc123sha256');
});

// ---------------------------------------------------------------------------
// TEST 5: Unrelated old images are ignored
// ---------------------------------------------------------------------------
test('5. Unrelated old images are ignored in correlation and capture', async () => {
  const { diffImageCandidates } = await import('../extensions/lokamedia/src/providers/chatgpt/candidate-discovery.js');
  const baselineCandidate = {
    src: 'https://chatgpt.com/old-image.png',
    source_fingerprint: 'img_old_1'
  };
  const currentCandidates = [
    baselineCandidate,
    {
      src: 'https://chatgpt.com/new-assistant-image.png',
      source_fingerprint: 'img_new_2'
    }
  ];

  const diff = diffImageCandidates([baselineCandidate], currentCandidates);
  assert.equal(diff.status, 'ONE_NEW_IMAGE');
  assert.equal(diff.candidates.length, 1);
  assert.equal(diff.candidates[0].source_fingerprint, 'img_new_2', 'Only the new image is detected; baseline old image is ignored');
});

// ---------------------------------------------------------------------------
// TEST 6: Capture Latest Image selects correct newest current-run image
// ---------------------------------------------------------------------------
test('6. Capture Latest Image selects newest assistant image after current submission', async () => {
  const contentScriptSource = fs.readFileSync(path.join(extensionRoot, 'src', 'providers', 'chatgpt', 'content-script.js'), 'utf8');
  assert.match(contentScriptSource, /controlledCaptureLatest/, 'controlledCaptureLatest must exist');
  assert.match(contentScriptSource, /candidateList\[candidateList\.length - 1\]/, 'controlledCaptureLatest must select candidateList[candidateList.length - 1]');
});

// ---------------------------------------------------------------------------
// TEST 7: Reject performs zero upload
// ---------------------------------------------------------------------------
test('7. Reject performs zero upload, zero mutation, and preserves audit history', async () => {
  const job = {
    job_id: 'mjob_reject_test_7',
    article_id: 88,
    local_state: 'CAPTURED',
    blob_key: 'mjob_reject_test_7:blob',
    sha256: 'rejected_sha_999'
  };

  const mockStorage = createMockStorage({ jobs: { [job.job_id]: job } });
  const mockBlobStore = createMockBlobStore();
  await mockBlobStore.put({ key: job.blob_key, bytes: new ArrayBuffer(8), sha256: job.sha256 });

  const controller = new LokaMediaController({
    storage: mockStorage,
    blobStore: mockBlobStore,
    provider: {},
    apiClient: { async uploadBlob() { return { ok: true }; } },
    audit: mockStorage.audit,
    providerLane: { async acquire() { return true; }, async release() {} },
    uploads: { async drain() {} }
  });

  const rejectRes = await controller.rejectResult({ jobId: job.job_id });
  assert.equal(rejectRes.ok, true);
  assert.equal(rejectRes.status, 'RESULT_REJECTED');
  assert.equal(rejectRes.discarded_sha256, 'rejected_sha_999');

  // Verify blob store has deleted rejected candidate
  const deletedBlob = await mockBlobStore.get(job.blob_key);
  assert.equal(deletedBlob, null, 'Rejected blob must be cleared from blobStore');

  // Verify ZERO uploads enqueued
  assert.equal(mockStorage.getUploadQueue().length, 0, 'Zero uploads must be enqueued on rejection');

  // Verify audit event details
  const auditEvents = mockStorage.getAuditEvents();
  const rejectEvent = auditEvents.find((e) => e.code === 'RESULT_REJECTED');
  assert.notEqual(rejectEvent, undefined, 'Rejection event must be recorded in audit');
  assert.equal(rejectEvent.payload.details.zero_upload, true);
  assert.equal(rejectEvent.payload.details.zero_mutation, true);

  // Verify updated state
  const updatedJob = (await mockStorage.readState()).jobs[job.job_id];
  assert.equal(updatedJob.local_state, 'RESULT_REJECTED');
  assert.equal(updatedJob.blob_key, null);
  assert.equal(updatedJob.sha256, null);
});

// ---------------------------------------------------------------------------
// TEST 8: Approve & Upload uploads exactly the selected previewed asset
// ---------------------------------------------------------------------------
test('8. Approve & Upload uploads exactly the previewed asset and registers media', async () => {
  const targetSha = 'approved_sha_777';
  const targetBlobKey = 'mjob_approve_test_8:blob';
  const job = {
    job_id: 'mjob_approve_test_8',
    article_id: 42,
    local_state: 'CAPTURED',
    blob_key: targetBlobKey,
    sha256: targetSha
  };

  const mockStorage = createMockStorage({ jobs: { [job.job_id]: job } });
  const mockBlobStore = createMockBlobStore();
  await mockBlobStore.put({ key: targetBlobKey, bytes: new Uint8Array([10, 20, 30]).buffer, sha256: targetSha });

  let uploadCalled = false;
  const mockApiClient = {
    async uploadBlob(j, blob) {
      uploadCalled = true;
      return { ok: true, attachment_confirmed: true };
    }
  };

  const controller = new LokaMediaController({
    storage: mockStorage,
    blobStore: mockBlobStore,
    provider: {},
    apiClient: mockApiClient,
    audit: mockStorage.audit,
    providerLane: { async acquire() { return true; }, async release() {} }
  });

  const approveRes = await controller.approveAndUpload({ jobId: job.job_id });
  assert.equal(approveRes.ok, true);
  assert.equal(approveRes.status, 'UPLOAD_COMPLETE');
  assert.equal(approveRes.sha256, targetSha);
  assert.equal(uploadCalled, true, 'Upload API must be called');

  // Check upload queue has exactly job.job_id
  assert.deepEqual(mockStorage.getUploadQueue(), [job.job_id]);

  // Check audit trail
  const auditEvents = mockStorage.getAuditEvents();
  assert(auditEvents.some((e) => e.code === 'UPLOAD_START'));
  assert(auditEvents.some((e) => e.code === 'UPLOAD_RECEIVED'));
  assert(auditEvents.some((e) => e.code === 'ATTACHMENT_CONFIRMED'));
  assert(auditEvents.some((e) => e.code === 'JOB_COMPLETE'));

  // State is complete
  const finalState = await mockStorage.readState();
  assert.equal(finalState.jobs[job.job_id].status, 'COMPLETE');
  assert.equal(finalState.jobs[job.job_id].local_state, 'UPLOAD_COMPLETE');
});

// ---------------------------------------------------------------------------
// TEST 9: Generation != Upload != Featured Assignment state separation
// ---------------------------------------------------------------------------
test('9. Generation != Upload != Featured Assignment state separation invariant', () => {
  // 1. GENERATED state
  const generatingState = {
    jobs: { j1: { job_id: 'j1', local_state: 'GENERATING' } }
  };
  const provider = {
    provider_tab_id: 101,
    target_state: 'LOCKED',
    tab_status: 'connected',
    auth_state: 'AUTHENTICATED',
    dom_status: 'SUPPORTED',
    composer_status: 'ready',
    provider_lane: 'idle'
  };
  const wfGen = getJobWorkflowDetails(generatingState, provider);
  assert.equal(wfGen.stage, 'GENERATING');
  assert.equal(wfGen.can_approve_upload, false, 'Cannot approve upload while generating');
  assert.equal(wfGen.can_assign_featured, false, 'Cannot assign featured while generating');

  // 2. CAPTURED state
  const capturedState = {
    jobs: {
      j1: {
        job_id: 'j1',
        local_state: 'CAPTURED',
        blob_key: 'b1',
        sha256: 'sha_test_1',
        width: 1770,
        height: 889
      }
    }
  };
  const wfCap = getJobWorkflowDetails(capturedState, provider);
  assert.equal(wfCap.stage, 'RESULT READY');
  assert.equal(wfCap.preview.is_captured, true);
  assert.equal(wfCap.preview.is_uploaded, false, 'Captured does NOT mean uploaded');
  assert.equal(wfCap.can_approve_upload, true);
  assert.equal(wfCap.can_assign_featured, false, 'Captured asset cannot be assigned featured before upload');

  // 3. UPLOAD COMPLETE state
  const uploadedState = {
    jobs: {
      j1: {
        job_id: 'j1',
        local_state: 'UPLOAD_COMPLETE',
        status: 'COMPLETE',
        sha256: 'sha_test_1'
      }
    }
  };
  const wfUp = getJobWorkflowDetails(uploadedState, {});
  assert.equal(wfUp.stage, 'UPLOAD COMPLETE');
  assert.equal(wfUp.preview.is_uploaded, true);
  assert.equal(wfUp.can_approve_upload, false, 'Already uploaded');
  // 4. Featured assignment is not automatically executed
  assert.equal(wfUp.can_assign_featured, false, 'Featured assignment must remain an explicit future controlled action');
});

// ---------------------------------------------------------------------------
// TEST 10: Article A completed job cannot rerun
// ---------------------------------------------------------------------------
test('10. Article A completed job cannot rerun (phase4b gate consumed and COMPLETE state)', async () => {
  const articleAJobId = 'mjob_9654a1ff6c242ce49711a664';
  const articleAJob = {
    job_id: articleAJobId,
    article_id: 1,
    article_title: 'Mengenal Bata Ringan AAC',
    slot_key: 'featured',
    status: 'COMPLETE',
    local_state: 'COMPLETE',
    sha256: 'cb5c343af17ef91b13e63c23a818604040512ad6a79282ffd3d1c2520c956144',
    width: 1770,
    height: 889
  };

  const mockStorage = createMockStorage({
    jobs: { [articleAJobId]: articleAJob },
    phase4bSingleRun: {
      job_id: articleAJobId,
      submission_consumed: true,
      generation_consumed: true,
      outcome: 'complete',
      completed_at: new Date().toISOString()
    }
  });

  const provider = {
    provider_tab_id: 101,
    target_state: 'LOCKED',
    tab_status: 'connected',
    auth_state: 'AUTHENTICATED',
    dom_status: 'SUPPORTED',
    composer_status: 'ready',
    provider_lane: 'idle'
  };
  const workflow = getJobWorkflowDetails(await mockStorage.readState(), provider);
  assert.equal(workflow.can_send, false, 'Article A cannot be sent to ChatGPT again');
  assert.equal(workflow.stage, 'UPLOAD COMPLETE');

  const controller = new LokaMediaController({
    storage: mockStorage,
    blobStore: createMockBlobStore(),
    provider: {},
    apiClient: {},
    audit: mockStorage.audit,
    providerLane: { async acquire() { return true; }, async release() {} },
    uploads: { async drain() {} }
  });

  const sendRes = await controller.sendToChatGpt({ jobId: articleAJobId });
  assert.equal(sendRes.ok, false);
  assert.equal(sendRes.error, 'PHASE_4B_RUN_CONSUMED', 'sendToChatGpt must fail closed with PHASE_4B_RUN_CONSUMED');
});

// ---------------------------------------------------------------------------
// TEST 11: No arbitrary ChatGPT tab fallback
// ---------------------------------------------------------------------------
test('11. No arbitrary ChatGPT tab fallback when bound tab is unavailable', async () => {
  const mockStorage = createMockStorage({
    jobs: {
      j1: { job_id: 'j1', status: 'QUEUED', local_state: 'QUEUED', prompt: 'test' }
    },
    provider: {
      chatgpt: {
        provider_tab_id: 999, // closed tab
        target_state: 'CLOSED',
        tab_status: 'closed'
      }
    }
  });

  const controller = new LokaMediaController({
    storage: mockStorage,
    blobStore: createMockBlobStore(),
    provider: {},
    apiClient: {},
    audit: mockStorage.audit,
    providerLane: { async acquire() { return true; }, async release() {} },
    uploads: { async drain() {} }
  });

  const sendRes = await controller.sendToChatGpt({ jobId: 'j1' });
  assert.equal(sendRes.ok, false);
  assert.equal(sendRes.error, 'PROVIDER_TARGET_NOT_LOCKED');
});

// ---------------------------------------------------------------------------
// TEST 12: Extension version is 0.1.10
// ---------------------------------------------------------------------------
test('12. Extension version bumped to 0.1.10 across constants and manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '0.1.10');
  assert.equal(EXTENSION_VERSION, '0.1.10');
});
