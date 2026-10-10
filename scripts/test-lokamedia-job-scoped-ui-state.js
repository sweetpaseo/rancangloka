import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getJobWorkflowDetails,
  summarizeCurrentJob,
  resolveCurrentJob,
  evaluateRunOnceEligibility
} from '../extensions/lokamedia/src/popup-core.js';
import { EXTENSION_VERSION } from '../extensions/lokamedia/src/constants.js';

const ARTICLE_A_JOB_ID = 'mjob_9654a1ff6c242ce49711a664';
const ARTICLE_A_TITLE = 'Jendela Berkondensasi: Kelembapan Ruangan, Suhu Permukaan Kaca, Ventilasi, atau Thermal Bridge?';
const ARTICLE_A_SHA = 'cb5c343af17ef91b13e63c23a818604040512ad6a79282ffd3d1c2520c956144';
const ARTICLE_A_PROMPT = 'Canonical Prompt for Jendela Berkondensasi...';

const ARTICLE_B_JOB_ID = 'mjob_9a381066fb65ee5dcbadbd51';
const ARTICLE_B_TITLE = 'Thermal Bridge Kusen Aluminium: Mengapa Permukaan Kusen Terasa Sangat Panas atau Dingin?';
const ARTICLE_B_SHA = 'f87275adaf3df50eb3a27982e54cf1fc9f5d27107e62560beff20da263613903';
const ARTICLE_B_PROMPT = 'Canonical Prompt for Thermal Bridge Kusen Aluminium...';
const ARTICLE_B_PROMPT_HASH = '5ea3cfb98af3801bc61445e80dda3d964b9126bf1c0f966876a95762785a98e3';

const ARTICLE_C_JOB_ID = 'mjob_c1234567890abcdef1234567';
const ARTICLE_C_TITLE = 'Ventilasi Silang Alami Pada Rumah Tropis Urban';
const ARTICLE_C_PROMPT = 'Canonical Prompt for Ventilasi Silang Alami...';

const providerReady = {
  provider_tab_id: 101,
  target_state: 'LOCKED',
  bound_tab_id: 101,
  tab_status: 'connected',
  auth_state: 'AUTHENTICATED',
  dom_status: 'SUPPORTED',
  composer_status: 'ready',
  provider_lane: 'idle'
};

// ---------------------------------------------------------------------------
// TEST 1: Job A complete -> Job B transitions: PROMPT READY -> SEND -> GENERATING -> RESULT READY
// ---------------------------------------------------------------------------
test('1. Job A complete -> Job B progression renders strictly Job B metadata with zero Job A leakage', () => {
  const state = {
    config: { enabled: true },
    status: { connection: 'online', last_error: null },
    phase4bJobGates: {
      [ARTICLE_A_JOB_ID]: {
        job_id: ARTICLE_A_JOB_ID,
        submission_consumed: true,
        generation_consumed: true,
        outcome: 'complete',
        completed_at: '2026-10-07T13:46:38.639Z'
      }
    },
    phase4bSingleRun: null,
    currentJobId: ARTICLE_B_JOB_ID,
    jobs: {
      [ARTICLE_A_JOB_ID]: {
        job_id: ARTICLE_A_JOB_ID,
        article_title: ARTICLE_A_TITLE,
        prompt: ARTICLE_A_PROMPT,
        status: 'COMPLETE',
        local_state: 'UPLOAD_COMPLETE',
        completed_at: '2026-10-07T13:46:38.639Z',
        sha256: ARTICLE_A_SHA,
        width: 1770,
        height: 889,
        size: 2623727
      },
      [ARTICLE_B_JOB_ID]: {
        job_id: ARTICLE_B_JOB_ID,
        article_title: ARTICLE_B_TITLE,
        prompt: ARTICLE_B_PROMPT,
        prompt_hash: ARTICLE_B_PROMPT_HASH,
        status: 'QUEUED',
        local_state: 'QUEUED',
        created_at: '2026-10-08T00:18:31.000Z'
      }
    }
  };

  // Step 1: Job B is QUEUED -> PROMPT READY
  const wfQueued = getJobWorkflowDetails(state, providerReady);
  assert.equal(wfQueued.job_id, ARTICLE_B_JOB_ID);
  assert.equal(wfQueued.article_title, ARTICLE_B_TITLE);
  assert.equal(wfQueued.prompt, ARTICLE_B_PROMPT);
  assert.equal(wfQueued.prompt_hash, ARTICLE_B_PROMPT_HASH);
  assert.equal(wfQueued.stage, 'PROMPT READY');
  assert.equal(wfQueued.can_send, true);
  assert.equal(wfQueued.preview, null, 'No candidate for Job B yet');

  // Step 2: Job B is SUBMITTING
  state.jobs[ARTICLE_B_JOB_ID].local_state = 'SUBMITTING';
  const wfSubmit = getJobWorkflowDetails(state, providerReady);
  assert.equal(wfSubmit.stage, 'SUBMITTING');
  assert.equal(wfSubmit.article_title, ARTICLE_B_TITLE);
  assert.equal(wfSubmit.preview, null);

  // Step 3: Job B is GENERATING
  state.jobs[ARTICLE_B_JOB_ID].local_state = 'GENERATING';
  state.jobs[ARTICLE_B_JOB_ID].submitted_at = new Date().toISOString();
  const wfGen = getJobWorkflowDetails(state, providerReady);
  assert.equal(wfGen.stage, 'GENERATING');
  assert.equal(wfGen.article_title, ARTICLE_B_TITLE);
  assert.equal(wfGen.preview, null);
  assert(wfGen.generating !== null);
  assert.equal(wfGen.generating.job_id, ARTICLE_B_JOB_ID);

  // Step 4: Job B is CAPTURED -> RESULT READY
  state.jobs[ARTICLE_B_JOB_ID].local_state = 'CAPTURED';
  state.jobs[ARTICLE_B_JOB_ID].blob_key = `${ARTICLE_B_JOB_ID}:1`;
  state.jobs[ARTICLE_B_JOB_ID].preview_candidate = {
    sha256: ARTICLE_B_SHA,
    width: 1770,
    height: 889,
    mime: 'image/png',
    size: 2327052
  };
  const wfRes = getJobWorkflowDetails(state, providerReady);
  assert.equal(wfRes.stage, 'RESULT READY');
  assert.equal(wfRes.job_id, ARTICLE_B_JOB_ID);
  assert.equal(wfRes.article_title, ARTICLE_B_TITLE);
  assert.equal(wfRes.preview.available, true);
  assert.equal(wfRes.preview.sha256, ARTICLE_B_SHA);
  assert.equal(wfRes.preview.dimensions, '1770 × 889');
  assert.equal(wfRes.preview.mime, 'image/png');
  assert.notEqual(wfRes.preview.sha256, ARTICLE_A_SHA, 'Zero Article A SHA leakage');
});

// ---------------------------------------------------------------------------
// TEST 2: Job A complete + Job B has NO candidate -> Result metadata rule
// ---------------------------------------------------------------------------
test('2. Job A complete + Job B has no candidate: Result review strictly renders dashes and no candidate', () => {
  const state = {
    config: { enabled: true },
    status: { connection: 'online' },
    phase4bJobGates: {
      [ARTICLE_A_JOB_ID]: {
        job_id: ARTICLE_A_JOB_ID,
        submission_consumed: true,
        generation_consumed: true,
        outcome: 'complete'
      }
    },
    phase4bSingleRun: null,
    currentJobId: ARTICLE_B_JOB_ID,
    jobs: {
      [ARTICLE_A_JOB_ID]: {
        job_id: ARTICLE_A_JOB_ID,
        article_title: ARTICLE_A_TITLE,
        prompt: ARTICLE_A_PROMPT,
        status: 'COMPLETE',
        local_state: 'UPLOAD_COMPLETE',
        completed_at: '2026-10-07T13:46:38.639Z',
        sha256: ARTICLE_A_SHA,
        width: 1770,
        height: 889,
        size: 2623727
      },
      [ARTICLE_B_JOB_ID]: {
        job_id: ARTICLE_B_JOB_ID,
        article_title: ARTICLE_B_TITLE,
        prompt: ARTICLE_B_PROMPT,
        status: 'QUEUED',
        local_state: 'QUEUED'
      }
    }
  };

  const wf = getJobWorkflowDetails(state, providerReady);
  assert.equal(wf.job_id, ARTICLE_B_JOB_ID);
  assert.equal(wf.article_title, ARTICLE_B_TITLE);
  assert.equal(wf.stage, 'PROMPT READY');
  assert.notEqual(wf.stage, 'UPLOAD COMPLETE', 'Job A UPLOAD COMPLETE must not leak into Job B');

  // Exact Rule 11 Verification:
  assert.equal(wf.preview, null, 'Must be null when current job has no candidate');

  // Verify that a helper rendering preview metadata produces dashes:
  const dimensions = wf.preview?.dimensions || '--';
  const mime = wf.preview?.mime || '--';
  const size = wf.preview?.size || '--';
  const sha = wf.preview?.short_sha256 || '--';

  assert.equal(dimensions, '--');
  assert.equal(mime, '--');
  assert.equal(size, '--');
  assert.equal(sha, '--');
});

// ---------------------------------------------------------------------------
// TEST 3: Multi-job progression: Job A complete -> Job B complete -> Job C queued
// ---------------------------------------------------------------------------
test('3. Generic multi-job progression (A complete, B complete, C queued): Generic isolation confirmed', () => {
  const state = {
    config: { enabled: true },
    status: { connection: 'online' },
    phase4bJobGates: {
      [ARTICLE_A_JOB_ID]: { job_id: ARTICLE_A_JOB_ID, outcome: 'complete' },
      [ARTICLE_B_JOB_ID]: { job_id: ARTICLE_B_JOB_ID, outcome: 'complete' }
    },
    phase4bSingleRun: { job_id: ARTICLE_B_JOB_ID, outcome: 'complete' },
    jobs: {
      [ARTICLE_A_JOB_ID]: {
        job_id: ARTICLE_A_JOB_ID,
        article_title: ARTICLE_A_TITLE,
        status: 'COMPLETE',
        local_state: 'UPLOAD_COMPLETE',
        completed_at: '2026-10-07T13:46:38.639Z',
        sha256: ARTICLE_A_SHA,
        width: 1770,
        height: 889
      },
      [ARTICLE_B_JOB_ID]: {
        job_id: ARTICLE_B_JOB_ID,
        article_title: ARTICLE_B_TITLE,
        status: 'COMPLETE',
        local_state: 'UPLOAD_COMPLETE',
        completed_at: '2026-10-08T00:58:56.000Z',
        sha256: ARTICLE_B_SHA,
        width: 1770,
        height: 889
      }
    }
  };

  // When only A and B exist and both are COMPLETE:
  // resolveCurrentJob deterministically selects Job B (most recently completed and pointed by phase4bSingleRun)
  const wfB = getJobWorkflowDetails(state, providerReady);
  assert.equal(wfB.job_id, ARTICLE_B_JOB_ID);
  assert.equal(wfB.article_title, ARTICLE_B_TITLE);
  assert.equal(wfB.stage, 'UPLOAD COMPLETE');
  assert.equal(wfB.preview.sha256, ARTICLE_B_SHA);
  assert.notEqual(wfB.preview.sha256, ARTICLE_A_SHA);

  // Now server injects Job C which is QUEUED:
  state.jobs[ARTICLE_C_JOB_ID] = {
    job_id: ARTICLE_C_JOB_ID,
    article_title: ARTICLE_C_TITLE,
    prompt: ARTICLE_C_PROMPT,
    status: 'QUEUED',
    local_state: 'QUEUED',
    created_at: '2026-10-08T01:30:00.000Z'
  };

  // With Job C in queue, resolveCurrentJob immediately prioritizes the queued job:
  const wfC = getJobWorkflowDetails(state, providerReady);
  assert.equal(wfC.job_id, ARTICLE_C_JOB_ID);
  assert.equal(wfC.article_title, ARTICLE_C_TITLE);
  assert.equal(wfC.prompt, ARTICLE_C_PROMPT);
  assert.equal(wfC.stage, 'PROMPT READY');
  assert.equal(wfC.preview, null);

  const dimC = wfC.preview?.dimensions || '--';
  const shaC = wfC.preview?.short_sha256 || '--';
  assert.equal(dimC, '--');
  assert.equal(shaC, '--');
});

// ---------------------------------------------------------------------------
// TEST 4: Reconcile live Article B upload state: Verified asset identity
// ---------------------------------------------------------------------------
test('4. Article B real uploaded asset state is reconciled cleanly', () => {
  const liveState = {
    config: { enabled: true, deviceId: 'dev_chr_local' },
    status: { connection: 'online', last_error: null },
    phase4bSingleRun: {
      job_id: ARTICLE_B_JOB_ID,
      outcome: 'complete',
      submission_consumed: true,
      generation_consumed: true,
      completed_at: '2026-10-08T00:58:56.894Z'
    },
    phase4bJobGates: {
      [ARTICLE_A_JOB_ID]: { job_id: ARTICLE_A_JOB_ID, outcome: 'complete', completed_at: '2026-10-07T13:46:38.639Z' },
      [ARTICLE_B_JOB_ID]: { job_id: ARTICLE_B_JOB_ID, outcome: 'complete', completed_at: '2026-10-08T00:58:56.894Z' }
    },
    currentJobId: ARTICLE_B_JOB_ID,
    jobs: {
      [ARTICLE_A_JOB_ID]: {
        job_id: ARTICLE_A_JOB_ID,
        article_title: ARTICLE_A_TITLE,
        prompt: ARTICLE_A_PROMPT,
        status: 'COMPLETE',
        local_state: 'COMPLETE',
        completed_at: '2026-10-07 13:46:38',
        sha256: ARTICLE_A_SHA,
        width: 1770,
        height: 889
      },
      [ARTICLE_B_JOB_ID]: {
        job_id: ARTICLE_B_JOB_ID,
        article_title: ARTICLE_B_TITLE,
        prompt: ARTICLE_B_PROMPT,
        prompt_hash: ARTICLE_B_PROMPT_HASH,
        status: 'COMPLETE',
        local_state: 'COMPLETE',
        completed_at: '2026-10-08 00:58:56',
        blob_key: `${ARTICLE_B_JOB_ID}:1`,
        sha256: ARTICLE_B_SHA,
        width: 1770,
        height: 889,
        mime: 'image/png',
        size: 2327052
      }
    }
  };

  const current = summarizeCurrentJob(liveState);
  assert.equal(current.job_id, ARTICLE_B_JOB_ID);
  assert.equal(current.article, ARTICLE_B_TITLE);
  assert.equal(current.operation, 'Complete');

  const wf = getJobWorkflowDetails(liveState, providerReady);
  assert.equal(wf.job_id, ARTICLE_B_JOB_ID);
  assert.equal(wf.article_title, ARTICLE_B_TITLE);
  assert.equal(wf.stage, 'UPLOAD COMPLETE');
  assert.equal(wf.preview.available, true);
  assert.equal(wf.preview.is_uploaded, true);
  assert.equal(wf.preview.sha256, ARTICLE_B_SHA);
  assert.equal(wf.preview.dimensions, '1770 × 889');
  assert.equal(wf.preview.mime, 'image/png');
  assert.equal(wf.preview.short_sha256, `${ARTICLE_B_SHA.slice(0, 8)}...${ARTICLE_B_SHA.slice(-6)}`);
});
