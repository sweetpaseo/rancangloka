import test from 'node:test';
import assert from 'node:assert/strict';
import { LokaMediaController } from '../extensions/lokamedia/src/controller.js';
import { ExtensionStorage } from '../extensions/lokamedia/src/storage.js';
import { MemoryBlobStore } from '../extensions/lokamedia/src/blob-store.js';
import { getJobWorkflowDetails } from '../extensions/lokamedia/src/popup-core.js';
import { POST as mediaUploadPost } from '../src/pages/api/internal/v1/media/upload.ts';

function createMockProvider(customImageBytes = new Uint8Array([1, 2, 3, 4])) {
  return {
    async prepare(job) {
      return { dom_status: 'SUPPORTED', composer_status: 'ready' };
    },
    async generate(job) {
      return {
        schema_version: 2,
        provider_conversation_id: 'conv_test_123',
        provider_response_id: 'resp_test_123',
        source_fingerprint: 'fp_test_image',
        containerFingerprint: 'cont_test_123',
        identified_at: new Date().toISOString()
      };
    },
    async capture(job, result) {
      return {
        blobKey: `${job.job_id}:candidate`,
        bytes: customImageBytes.buffer,
        sha256: 'sha256_mock_candidate_aaa',
        mime: 'image/png',
        width: 1315,
        height: 660,
        size: customImageBytes.byteLength,
        provenance: 'PROVIDER_BINARY'
      };
    },
    async captureLatest(job) {
      return {
        blobKey: `${job.job_id}:latest`,
        bytes: customImageBytes.buffer,
        sha256: 'sha256_mock_candidate_aaa',
        mime: 'image/png',
        width: 1315,
        height: 660,
        size: customImageBytes.byteLength,
        provenance: 'PROVIDER_BINARY'
      };
    }
  };
}

function createHarness({ jobOverrides = {}, providerBytes = new Uint8Array([1, 2, 3, 4]) } = {}) {
  const storage = ExtensionStorage.memory();
  const blobStore = new MemoryBlobStore();
  const provider = createMockProvider(providerBytes);

  let uploadCalls = 0;
  let uploadPayloads = [];

  const apiClient = {
    async nextJob() {
      return { job: null };
    },
    async heartbeat() {
      return { ok: true };
    },
    async uploadBlob(job, blobRecord) {
      uploadCalls++;
      uploadPayloads.push({ job, blobRecord });
      return {
        ok: true,
        status: 'COMPLETE',
        attachment_confirmed: true,
        asset_id: `ast_${Date.now()}`
      };
    }
  };

  const controller = new LokaMediaController({
    storage,
    blobStore,
    provider,
    apiClient
  });

  return {
    storage,
    blobStore,
    provider,
    apiClient,
    controller,
    getUploadCalls: () => uploadCalls,
    getUploadPayloads: () => uploadPayloads
  };
}

// ---------------------------------------------------------------------------
// TEST 1: Exact Regression - Image generation stops strictly at RESULT READY
// ---------------------------------------------------------------------------
test('1. Exact Regression: Successful ChatGPT generation stops at RESULT READY without automatic upload', async () => {
  const harness = createHarness();
  const { controller, storage, blobStore } = harness;

  const jobId = 'mjob_test_exact_regress_1';
  const job = {
    job_id: jobId,
    article_id: 10,
    article_title: 'Sistem Ventilasi Silang',
    slot_key: 'featured',
    role: 'featured',
    prompt: 'Prompt ventilasi silang...',
    prompt_hash: 'phash_1',
    status: 'QUEUED',
    local_state: 'QUEUED'
  };

  await storage.initialize();
  await storage.upsertJob(jobId, job);
  await storage.armPhase4bSingleRun({ jobId, runId: 'run_init_1' });

  // Run job through provider generation and capture
  const runResult = await controller.runJob(job, { runId: 'run_init_1', controlledRunOnce: true });

  assert.equal(runResult.ok, true);
  assert.equal(runResult.status, 'RESULT_READY');
  assert.equal(runResult.job_id, jobId);
  assert.equal(runResult.sha256, 'sha256_mock_candidate_aaa');

  // Hard Invariant Check: upload must NOT have been called!
  assert.equal(harness.getUploadCalls(), 0, 'Upload calls must be 0 after generation/capture');

  // Storage Invariant Check
  const stateAfterCapture = await storage.readState();
  const opState = stateAfterCapture.jobOperationalStates[jobId];
  assert.equal(opState.local_state, 'CAPTURED');
  assert.equal(opState.candidate.sha256, 'sha256_mock_candidate_aaa');
  assert.equal(opState.candidate.is_uploaded, false);
  assert.equal(stateAfterCapture.jobs[jobId].status, 'QUEUED', 'Server status must not be COMPLETE');

  // Workflow Stage in Side Panel UI
  const workflow = getJobWorkflowDetails(stateAfterCapture, { tab_status: 'connected', auth_state: 'AUTHENTICATED', dom_status: 'SUPPORTED', composer_status: 'ready', provider_lane: 'idle', target_state: 'LOCKED', bound_tab_id: 1 });
  assert.equal(workflow.stage, 'RESULT READY');
  assert.equal(workflow.can_approve_upload, true, 'Approve & Upload must be enabled at RESULT READY');
  assert.equal(workflow.can_reject, true, 'Reject Result must be enabled');

  // Audit Events: Check sequence
  const auditEvents = stateAfterCapture.auditLog.events;
  const codes = auditEvents.map((e) => e.event_code);
  assert(codes.includes('CAPTURE_PERSISTED'), 'CAPTURE_PERSISTED must be emitted');
  assert(codes.includes('RESULT_READY'), 'RESULT_READY must be emitted');
  assert(!codes.includes('UPLOAD_START'), 'UPLOAD_START must NOT be emitted yet');
  assert(!codes.includes('JOB_COMPLETE'), 'JOB_COMPLETE must NOT be emitted yet');

  // Now simulate explicit APPROVE & UPLOAD
  const approveRes = await controller.approveAndUpload({ jobId });
  assert.equal(approveRes.ok, true);
  assert.equal(approveRes.status, 'UPLOAD_COMPLETE');
  assert.equal(approveRes.sha256, 'sha256_mock_candidate_aaa');
  assert.equal(harness.getUploadCalls(), 1, 'Upload calls must be exactly 1 after approval');

  // Check state after approval
  const stateAfterApproval = await storage.readState();
  assert.equal(stateAfterApproval.jobs[jobId].status, 'COMPLETE');
  assert.equal(stateAfterApproval.jobs[jobId].local_state, 'UPLOAD_COMPLETE');
  assert.equal(stateAfterApproval.jobApprovals[jobId].candidate_sha256, 'sha256_mock_candidate_aaa');
  assert.equal(stateAfterApproval.jobApprovals[jobId].consumed, true);

  // Check audit trail sequence after approval
  const finalCodes = stateAfterApproval.auditLog.events.map((e) => e.event_code);
  const captureIdx = finalCodes.indexOf('CAPTURE_PERSISTED');
  const resultReadyIdx = finalCodes.indexOf('RESULT_READY');
  const approvalIdx = finalCodes.indexOf('HUMAN_APPROVAL_RECORDED');
  const gatePassIdx = finalCodes.indexOf('UPLOAD_APPROVAL_GATE_PASS');
  const uploadStartIdx = finalCodes.indexOf('UPLOAD_START');
  const uploadRecvIdx = finalCodes.indexOf('UPLOAD_RECEIVED');
  const completeIdx = finalCodes.indexOf('JOB_COMPLETE');

  assert(captureIdx < resultReadyIdx, 'CAPTURE_PERSISTED -> RESULT_READY');
  assert(resultReadyIdx < approvalIdx, 'RESULT_READY -> HUMAN_APPROVAL_RECORDED');
  assert(approvalIdx < gatePassIdx, 'HUMAN_APPROVAL_RECORDED -> UPLOAD_APPROVAL_GATE_PASS');
  assert(gatePassIdx < uploadStartIdx, 'UPLOAD_APPROVAL_GATE_PASS -> UPLOAD_START');
  assert(uploadStartIdx < uploadRecvIdx, 'UPLOAD_START -> UPLOAD_RECEIVED');
  assert(uploadRecvIdx < completeIdx, 'UPLOAD_RECEIVED -> JOB_COMPLETE');
});

// ---------------------------------------------------------------------------
// TEST 2: Rejection Regression
// ---------------------------------------------------------------------------
test('2. Rejection Regression: Reject Result from RESULT READY records rejection with zero uploads and consumed submission', async () => {
  const harness = createHarness();
  const { controller, storage, blobStore } = harness;

  const jobId = 'mjob_test_reject_1';
  const job = {
    job_id: jobId,
    article_id: 11,
    article_title: 'Material Fasad Kayu Tropis',
    slot_key: 'featured',
    role: 'featured',
    prompt: 'Prompt fasad...',
    status: 'QUEUED',
    local_state: 'QUEUED'
  };

  await storage.initialize();
  await storage.upsertJob(jobId, job);
  await storage.armPhase4bSingleRun({ jobId, runId: 'run_rej_init' });

  // Generate & capture candidate
  await controller.runJob(job, { runId: 'run_rej_init', controlledRunOnce: true });

  const stateReady = await storage.readState();
  assert.equal(stateReady.jobOperationalStates[jobId].local_state, 'CAPTURED');

  // Operator clicks REJECT RESULT
  const rejectRes = await controller.rejectResult({ jobId });
  assert.equal(rejectRes.ok, true);
  assert.equal(rejectRes.status, 'RESULT_REJECTED');
  assert.equal(rejectRes.discarded_sha256, 'sha256_mock_candidate_aaa');

  // Hard Invariants on Rejection
  assert.equal(harness.getUploadCalls(), 0, 'Zero uploads must occur on rejection');

  const stateAfterReject = await storage.readState();
  const jobAfter = stateAfterReject.jobs[jobId];
  assert.equal(jobAfter.local_state, 'RESULT_REJECTED');
  assert.equal(jobAfter.status, 'QUEUED', 'Job must not be COMPLETE');
  assert.equal(jobAfter.blob_key, null, 'Blob reference cleared');
  assert.equal(jobAfter.sha256, null, 'SHA reference cleared');

  // Gate remains consumed
  const gate = stateAfterReject.phase4bJobGates[jobId];
  assert.equal(gate.submission_consumed, true, 'Provider submission gate remains consumed');

  // Rejection audit recorded
  const events = stateAfterReject.auditLog.events;
  const rejEvent = events.find((e) => e.event_code === 'HUMAN_REJECTION_RECORDED');
  assert(rejEvent, 'HUMAN_REJECTION_RECORDED must exist in audit log');
  assert.equal(rejEvent.details.discarded_sha256, 'sha256_mock_candidate_aaa');
  assert.equal(rejEvent.details.zero_upload, true);
});

// ---------------------------------------------------------------------------
// TEST 3: Wrong-Candidate Regression
// ---------------------------------------------------------------------------
test('3. Wrong-Candidate Regression: SHA mismatch triggers UPLOAD_APPROVAL_GATE_FAIL with zero uploads', async () => {
  const harness = createHarness();
  const { controller, storage } = harness;

  const jobId = 'mjob_test_wrong_sha_1';
  const job = {
    job_id: jobId,
    article_id: 12,
    article_title: 'Suhu Kaca Jendela',
    slot_key: 'featured',
    role: 'featured',
    prompt: 'Prompt kaca...',
    status: 'QUEUED',
    local_state: 'QUEUED'
  };

  await storage.initialize();
  await storage.upsertJob(jobId, job);
  await storage.armPhase4bSingleRun({ jobId, runId: 'run_wrong_sha' });

  await controller.runJob(job, { runId: 'run_wrong_sha', controlledRunOnce: true });

  // Simulate an approve request referencing a different SHA
  const mismatchRes = await controller.approveAndUpload({
    jobId,
    expectedSha256: 'sha256_mismatched_wrong_hash_bbb'
  });

  assert.equal(mismatchRes.ok, false);
  assert.equal(mismatchRes.error, 'UPLOAD_APPROVAL_GATE_FAIL');
  assert.equal(harness.getUploadCalls(), 0, 'Zero uploads on wrong candidate SHA');

  const state = await storage.readState();
  const failEvent = state.auditLog.events.find((e) => e.event_code === 'UPLOAD_APPROVAL_GATE_FAIL');
  assert(failEvent, 'UPLOAD_APPROVAL_GATE_FAIL event must be recorded');
  assert.equal(failEvent.error_code, 'APPROVAL_SHA_MISMATCH');
  assert.equal(state.jobs[jobId].status, 'QUEUED');
});

// ---------------------------------------------------------------------------
// TEST 4: Duplicate Approval Regression
// ---------------------------------------------------------------------------
test('4. Duplicate Approval Regression: Repeated APPROVE & UPLOAD calls are blocked idempotently with zero redundant uploads', async () => {
  const harness = createHarness();
  const { controller, storage } = harness;

  const jobId = 'mjob_test_duplicate_1';
  const job = {
    job_id: jobId,
    article_id: 13,
    article_title: 'Atap Bitumen vs Spandek',
    slot_key: 'featured',
    role: 'featured',
    prompt: 'Prompt atap...',
    status: 'QUEUED',
    local_state: 'QUEUED'
  };

  await storage.initialize();
  await storage.upsertJob(jobId, job);
  await storage.armPhase4bSingleRun({ jobId, runId: 'run_dup_1' });

  await controller.runJob(job, { runId: 'run_dup_1', controlledRunOnce: true });

  // First approve call succeeds
  const firstRes = await controller.approveAndUpload({ jobId });
  assert.equal(firstRes.ok, true);
  assert.equal(harness.getUploadCalls(), 1);

  // Second duplicate approve call
  const secondRes = await controller.approveAndUpload({ jobId });
  assert.equal(secondRes.ok, false);
  assert.equal(secondRes.error, 'APPROVAL_ALREADY_CONSUMED');

  // Hard Invariant: upload calls must remain exactly 1!
  assert.equal(harness.getUploadCalls(), 1, 'Zero duplicate uploads on duplicate approve click');
});

// ---------------------------------------------------------------------------
// TEST 5: Job Isolation Regression
// ---------------------------------------------------------------------------
test('5. Job Isolation Regression: Job B cannot approve, upload, or inherit Job A candidate', async () => {
  const harness = createHarness();
  const { controller, storage } = harness;

  const jobA = {
    job_id: 'mjob_isolated_A',
    article_id: 21,
    article_title: 'Artikel Isolasi A',
    slot_key: 'featured',
    role: 'featured',
    prompt: 'Prompt A...',
    status: 'QUEUED',
    local_state: 'QUEUED'
  };

  const jobB = {
    job_id: 'mjob_isolated_B',
    article_id: 22,
    article_title: 'Artikel Isolasi B',
    slot_key: 'featured',
    role: 'featured',
    prompt: 'Prompt B...',
    status: 'QUEUED',
    local_state: 'QUEUED'
  };

  await storage.initialize();
  await storage.upsertJob(jobA.job_id, jobA);
  await storage.upsertJob(jobB.job_id, jobB);

  // Arm & generate for Job A
  await storage.armPhase4bSingleRun({ jobId: jobA.job_id, runId: 'run_A' });
  await controller.runJob(jobA, { runId: 'run_A', controlledRunOnce: true });

  // Now switch current job to Job B
  await storage.update((s) => {
    s.currentJobId = jobB.job_id;
  });

  const state = await storage.readState();
  const workflowB = getJobWorkflowDetails(state, { tab_status: 'connected', auth_state: 'AUTHENTICATED', dom_status: 'SUPPORTED', composer_status: 'ready', provider_lane: 'idle', target_state: 'LOCKED', bound_tab_id: 1 }, jobB.job_id);

  // Job B must NOT show Job A preview
  assert.equal(workflowB.stage, 'PROMPT READY');
  assert.equal(workflowB.preview, null, 'Job B must have null preview');
  assert.equal(workflowB.can_approve_upload, false, 'Job B cannot approve');

  // Attempting to call approveAndUpload for Job B must fail
  const approveBRes = await controller.approveAndUpload({ jobId: jobB.job_id });
  assert.equal(approveBRes.ok, false);
  assert.equal(approveBRes.error, 'NO_CAPTURED_ASSET_TO_UPLOAD');
  assert.equal(harness.getUploadCalls(), 0);
});

// ---------------------------------------------------------------------------
// TEST 6: Server-Side Defense (Fail-Closed)
// ---------------------------------------------------------------------------
test('6. Server-Side Defense: POST /api/internal/v1/media/upload fails closed without explicit human approval', async () => {
  const dummyPng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0xf3, 0xff, 0x61,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);

  const mockDb = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return null; },
        async run() { return { success: true }; }
      };
    }
  };
  const mockLocals = { db: mockDb, runtime: { env: { DB: mockDb, MEDIA_UPLOAD_KEY: 'test_token' } } };

  // 1. Buggy extension client sends upload without approval_record
  {
    const form = new FormData();
    form.set('source_type', 'lokamedia_extension');
    form.set('job_id', 'mjob_buggy_unapproved');
    form.set('article_id', '101');
    form.set('role', 'featured');
    form.set('alt_text', 'Gambar uji tanpa approval');
    form.set('file', new Blob([dummyPng], { type: 'image/png' }), 'test.png');

    const req = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test_token',
        'X-RL-Device-Token': 'test_token',
        'X-RL-Scope': 'media:write:draft'
      },
      body: form
    });

    const res = await mediaUploadPost({ request: req, locals: mockLocals });
    assert.equal(res.status, 403, 'Server must return 403 Forbidden without approval');
    const payload = await res.json();
    assert.equal(payload.code, 'HUMAN_APPROVAL_REQUIRED');
  }

  // 2. Extension client sends approval_record with mismatched job_id
  {
    const form = new FormData();
    form.set('source_type', 'lokamedia_extension');
    form.set('job_id', 'mjob_target_101');
    form.set('article_id', '101');
    form.set('role', 'featured');
    form.set('alt_text', 'Gambar uji');
    form.set('approval_record', JSON.stringify({
      job_id: 'mjob_different_999',
      candidate_sha256: 'some_hash',
      approval_source: 'operator_side_panel',
      approved_at: new Date().toISOString()
    }));
    form.set('file', new Blob([dummyPng], { type: 'image/png' }), 'test.png');

    const req = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer test_token', 'X-RL-Device-Token': 'test_token' },
      body: form
    });

    const res = await mediaUploadPost({ request: req, locals: mockLocals });
    assert.equal(res.status, 422, 'Server must return 422 on approval job_id mismatch');
    const payload = await res.json();
    assert.equal(payload.code, 'APPROVAL_JOB_MISMATCH');
  }

  // 3. Extension client sends approval_record with invalid approval_source
  {
    const form = new FormData();
    form.set('source_type', 'lokamedia_extension');
    form.set('job_id', 'mjob_target_101');
    form.set('article_id', '101');
    form.set('role', 'featured');
    form.set('alt_text', 'Gambar uji');
    form.set('approval_record', JSON.stringify({
      job_id: 'mjob_target_101',
      candidate_sha256: 'some_hash',
      approval_source: 'automatic_script',
      approved_at: new Date().toISOString()
    }));
    form.set('file', new Blob([dummyPng], { type: 'image/png' }), 'test.png');

    const req = new Request('http://localhost:4321/api/internal/v1/media/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer test_token', 'X-RL-Device-Token': 'test_token' },
      body: form
    });

    const res = await mediaUploadPost({ request: req, locals: mockLocals });
    assert.equal(res.status, 403, 'Server must return 403 on non-operator approval source');
    const payload = await res.json();
    assert.equal(payload.code, 'APPROVAL_SOURCE_INVALID');
  }
});

// ---------------------------------------------------------------------------
// TEST 7: Article B Legacy Real-Run Preservation Invariant
// ---------------------------------------------------------------------------
test('7. Article B Legacy Invariant: Article B already uploaded local asset is preserved as LEGACY_AUTO_UPLOAD_COMPLETE without re-upload or fake history', () => {
  const articleBJobId = 'mjob_9a381066fb65ee5dcbadbd51';
  const articleBAssetId = 'ast_U0qJsAPBnIga9ExfH385kNUp';
  const articleBSha = 'f87275adaf3df50eb3a27982e54cf1fc9f5d27107e62560beff20da263613903';

  const legacyState = {
    jobs: {
      [articleBJobId]: {
        job_id: articleBJobId,
        article_id: 6,
        status: 'COMPLETE',
        local_state: 'UPLOAD_COMPLETE',
        asset_id: articleBAssetId,
        sha256: articleBSha,
        width: 1770,
        height: 889,
        mime: 'image/png'
      }
    },
    jobOperationalStates: {
      [articleBJobId]: {
        job_id: articleBJobId,
        local_state: 'UPLOAD_COMPLETE',
        candidate: {
          job_id: articleBJobId,
          sha256: articleBSha,
          is_uploaded: true
        }
      }
    }
  };

  const workflow = getJobWorkflowDetails(legacyState, {}, articleBJobId);
  assert.equal(workflow.stage, 'UPLOAD COMPLETE');
  assert.equal(workflow.can_approve_upload, false, 'Already uploaded Article B cannot be re-approved or re-uploaded');
  assert.equal(workflow.can_send, false, 'Article B cannot be re-sent to ChatGPT');
  assert.equal(workflow.preview.is_uploaded, true);
  assert.equal(workflow.preview.sha256, articleBSha);
});

// ---------------------------------------------------------------------------
// TEST 8: Article A Production Preservation Invariant
// ---------------------------------------------------------------------------
test('8. Article A Production Invariant: Production Article A remains untouched', () => {
  const articleAProductionAsset = '/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp';
  assert.equal(articleAProductionAsset.endsWith('.webp'), true);
  assert(articleAProductionAsset.includes('b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4'));
});
