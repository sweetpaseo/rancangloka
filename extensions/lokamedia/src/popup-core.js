export const POPUP_BOOT_FLAGS = Object.freeze({
  SCRIPT_LOADED: 'POPUP_SCRIPT_LOADED',
  DOM_BOUND: 'POPUP_DOM_BOUND',
  SERVICE_WORKER_CONNECTED: 'POPUP_SERVICE_WORKER_CONNECTED',
  PROVIDER_CHECK_AVAILABLE: 'POPUP_PROVIDER_CHECK_AVAILABLE'
});

export const SIDE_PANEL_BOOT_FLAGS = Object.freeze({
  SCRIPT_LOADED: 'SIDE_PANEL_SCRIPT_LOADED',
  DOM_BOUND: 'SIDE_PANEL_DOM_BOUND',
  SERVICE_WORKER_CONNECTED: 'SIDE_PANEL_SERVICE_WORKER_CONNECTED',
  PROVIDER_CHECK_AVAILABLE: 'SIDE_PANEL_PROVIDER_CHECK_AVAILABLE'
});

export function normalizeProviderStatus(provider = {}) {
  const capabilities = provider.capabilities?.capabilities ?? provider.capabilities ?? {};
  const tabStatus = provider.tab_status ?? 'missing';
  const authState = provider.auth_state ?? 'UNKNOWN';
  const domStatus = provider.dom_status ?? 'UNKNOWN';
  const composerReady = provider.composer_status === 'ready' || capabilities.COMPOSER_EDITABLE === true;
  const targetState = provider.target_state ?? (provider.provider_tab_id ? 'LOCKED' : 'NOT BOUND');
  const targetBound = Boolean(provider.provider_tab_id && targetState === 'LOCKED');
  return {
    tab: tabStatus === 'connected' ? 'connected' : tabStatus,
    target: targetState,
    target_bound: targetBound,
    bound_tab_id: provider.bound_tab_id ?? provider.provider_tab_id ?? null,
    bound_url: provider.bound_url ?? null,
    provider_origin: provider.provider_origin ?? null,
    bound_at: provider.bound_at ?? null,
    auth: authState === 'AUTHENTICATED' ? 'ready' : authState === 'AUTH_REQUIRED' ? 'required' : 'unknown',
    dom: domStatus === 'SUPPORTED' ? 'supported' : domStatus === 'UNSUPPORTED' ? 'unsupported' : 'unknown',
    composer: composerReady ? 'ready' : 'unavailable',
    images: Number(provider.visible_image_candidates ?? provider.image_candidate_count ?? 0),
    lane: provider.provider_lane ?? 'idle'
  };
}

export function validatePopupElements(doc) {
  const ids = [
    'connection',
    'total',
    'active',
    'waiting',
    'complete',
    'server',
    'token',
    'enabled',
    'save',
    'tick',
    'diagnostic',
    'provider-tab',
    'provider-auth',
    'provider-dom',
    'provider-composer',
    'provider-images',
    'provider-lane',
    'popup-status'
  ];
  const missing = ids.filter((id) => !doc.querySelector(`#${id}`));
  return { ok: missing.length === 0, missing };
}

export function validateSidePanelElements(doc) {
  const ids = [
    'extension-version',
    'connection-chatgpt',
    'connection-rancangloka',
    'current-article',
    'current-slot',
    'current-operation',
    'current-elapsed',
    'queue-total',
    'queue-active',
    'queue-waiting',
    'queue-complete',
    'transfers',
    'provider-tab',
    'provider-target',
    'provider-bound-tab',
    'provider-bound-url',
    'bind-tab',
    'provider-auth',
    'provider-dom',
    'provider-composer',
    'provider-images',
    'provider-lane',
    'system-server',
    'system-backpressure',
    'system-error',
    'last-action',
    'server',
    'token',
    'enabled',
    'run-once',
    'run-once-reason',
    'runtime-version-display',
    'runtime-boot-id',
    'save',
    'diagnostic',
    'panel-status',
    'audit-filter',
    'audit-current-run',
    'audit-current-job',
    'audit-copy',
    'audit-export',
    'audit-clear',
    'audit-log',
    'workflow-stage',
    'workflow-guidance',
    'prompt-article-title',
    'prompt-slot',
    'prompt-dimensions',
    'prompt-text',
    'copy-prompt',
    'send-to-chatgpt',
    'capture-latest',
    'approve-upload',
    'reject-result',
    'result-preview-image',
    'preview-placeholder',
    'result-dimensions',
    'result-mime',
    'result-size',
    'result-sha256',
    'btn-select-file',
    'local-file-input',
    'assign-featured',
    'generating-card',
    'generating-job-id',
    'generating-run-id',
    'generating-provider-tab',
    'generating-elapsed',
    'result-preview-card'
  ];
  const missing = ids.filter((id) => !doc.querySelector(`#${id}`));
  return { ok: missing.length === 0, missing };
}

export function evaluateRunOnceEligibility({
  state = {},
  current = {},
  provider = {},
  server = 'offline',
  transfers = [],
  runtimeVersion = null,
  expectedVersion = null
} = {}) {
  const versionCurrent = !expectedVersion || !runtimeVersion || runtimeVersion === expectedVersion;
  if (!versionCurrent) {
    return { eligible: false, reason: 'Reload required' };
  }

  if (!state?.config?.enabled) {
    return { eligible: false, reason: 'Extension paused' };
  }

  if (server !== 'online') {
    return { eligible: false, reason: 'Server offline' };
  }

  if (state?.status?.connection === 'backpressure') {
    return { eligible: false, reason: 'Backpressure active' };
  }

  if (transfers.length > 0) {
    return { eligible: false, reason: 'Transfer active' };
  }

  if (provider.target === 'CLOSED' || provider.tab === 'closed' || provider.tab === 'navigated') {
    return { eligible: false, reason: 'Bound ChatGPT tab unavailable' };
  }

  const targetBound = provider.target_bound !== undefined
    ? Boolean(provider.target_bound)
    : (provider.target ? provider.target === 'LOCKED' : true);

  if (!targetBound || provider.target === 'NOT BOUND') {
    return { eligible: false, reason: 'Bind a ChatGPT tab first' };
  }

  if (
    provider.tab !== 'connected' ||
    provider.auth !== 'ready' ||
    provider.dom !== 'supported' ||
    provider.composer !== 'ready'
  ) {
    return { eligible: false, reason: 'Provider not ready' };
  }

  if (provider.lane !== 'idle') {
    return { eligible: false, reason: 'Provider lane busy' };
  }

  const targetJobId = current?.job_id || null;
  const gate = targetJobId
    ? (state?.phase4bJobGates?.[targetJobId] || (state?.phase4bSingleRun?.job_id === targetJobId ? state.phase4bSingleRun : (!state?.phase4bSingleRun?.job_id ? state?.phase4bSingleRun : null)))
    : state?.phase4bSingleRun;
  const isGateForThisJob = Boolean(
    gate && (!gate.job_id || (targetJobId && gate.job_id === targetJobId))
  );
  const consumed = Boolean(
    isGateForThisJob && (gate.submission_consumed || gate.generation_consumed || (gate.completed_at && gate.outcome === 'complete'))
  );
  if (consumed) {
    return { eligible: false, reason: 'Job already consumed', consumed: true, gate };
  }

  const currentJobObj = current?.job_id ? state?.jobs?.[current.job_id] : null;
  const isNeedsAttention = Boolean(
    currentJobObj?.needs_attention ||
    (isGateForThisJob && gate?.outcome === 'needs_attention' && currentJobObj?.needs_attention !== false)
  );
  if (isNeedsAttention) {
    return { eligible: false, reason: 'Needs attention', gate };
  }

  const waitingJob =
    current?.operation === 'Waiting' &&
    current?.slot === 'featured' &&
    Boolean(current?.article) &&
    current?.article !== 'None';

  if (!waitingJob) {
    return { eligible: false, reason: 'No eligible job' };
  }

  return { eligible: true, reason: '' };
}

export function normalizeServerStatus(state = {}) {
  const connection = state.status?.connection ?? 'offline';
  if (connection === 'online' || connection === 'connected') return 'online';
  if (connection === 'backpressure') return 'backpressure';
  return 'offline';
}

export function resolveCurrentJob(state = {}, explicitJobId = null) {
  const jobsMap = state.jobs ?? {};
  if (explicitJobId && jobsMap[explicitJobId]) {
    return jobsMap[explicitJobId];
  }
  const jobs = Object.values(jobsMap);
  if (jobs.length === 0) return null;

  // 1. In-flight active processing jobs
  const active = jobs.find((j) =>
    ['SUBMITTING', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED', 'UPLOADING', 'RECOVERING'].includes(j.local_state)
  );
  if (active) return active;

  // 2. Active armed gate job
  const activeGateJob = jobs.find((j) => {
    const g = state.phase4bJobGates?.[j.job_id] || (state.phase4bSingleRun?.job_id === j.job_id ? state.phase4bSingleRun : null);
    const isCompleted = g?.outcome === 'complete' || Boolean(g?.completed_at);
    return g && !isCompleted && (g.submission_consumed || g.generation_consumed);
  });
  if (activeGateJob) return activeGateJob;

  // 3. Queued / waiting retry jobs
  const queued = jobs.find((j) =>
    ['QUEUED', 'WAITING_RETRY'].includes(j.local_state ?? j.status)
  );
  if (queued) return queued;

  // 4. If currentJobId is set and points to an active/queued job, or all jobs are complete/waiting
  if (state.currentJobId && jobsMap[state.currentJobId]) {
    const candidate = jobsMap[state.currentJobId];
    const isCandidateActiveOrQueued = ['SUBMITTING', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED', 'UPLOADING', 'RECOVERING', 'QUEUED', 'WAITING_RETRY'].includes(candidate.local_state ?? candidate.status);
    if (isCandidateActiveOrQueued) {
      return candidate;
    }
  }

  // 5. Rejected job
  const rejected = jobs.find((j) => j.local_state === 'RESULT_REJECTED');
  if (rejected) return rejected;

  // 6. Job currently pointed by phase4bSingleRun if it exists in jobsMap
  if (state.phase4bSingleRun?.job_id && jobsMap[state.phase4bSingleRun.job_id]) {
    return jobsMap[state.phase4bSingleRun.job_id];
  }

  // 7. Most recently completed job
  const completed = jobs
    .filter((j) => ['COMPLETE', 'UPLOAD_COMPLETE'].includes(j.local_state ?? j.status))
    .sort((a, b) => {
      const timeA = Date.parse(a.completed_at || a.updated_at_local || a.updated_at || a.created_at || 0) || 0;
      const timeB = Date.parse(b.completed_at || b.updated_at_local || b.updated_at || b.created_at || 0) || 0;
      return timeB - timeA;
    });

  if (completed.length > 0) return completed[0];

  return jobs[0] || null;
}

export function summarizeCurrentJob(state = {}, explicitJobId = null) {
  const current = resolveCurrentJob(state, explicitJobId);
  if (!current) {
    return {
      article: 'None',
      slot: 'Idle',
      operation: 'Waiting',
      elapsed: '--'
    };
  }
  const isWaiting = ['QUEUED', 'WAITING_RETRY'].includes(current.local_state ?? current.status);
  const isComplete = ['COMPLETE', 'UPLOAD_COMPLETE'].includes(current.local_state ?? current.status);
  const stateLabel = isWaiting ? 'Waiting' : isComplete ? 'Complete' : (current.local_state ?? 'active');
  return {
    job_id: current.job_id ?? null,
    article: current.article_title ?? (current.article_id ? `Article #${current.article_id}` : current.job_id),
    slot: current.slot_key ?? current.role ?? 'media',
    operation: stateLabel,
    elapsed: current.submitted_at ? elapsedSince(current.submitted_at) : '--'
  };
}

export function summarizeTransfers(state = {}) {
  const transfers = state.status?.transfers ?? [];
  return transfers.map((transfer) => ({
    label: transfer.label ?? transfer.job_id ?? 'Upload',
    percentage: Number.isFinite(transfer.percentage) ? Math.max(0, Math.min(100, Math.round(transfer.percentage))) : null,
    bytesSent: transfer.bytes_sent ?? transfer.bytesSent ?? 0,
    bytesTotal: transfer.bytes_total ?? transfer.bytesTotal ?? 0
  }));
}

function elapsedSince(value) {
  const start = Date.parse(value);
  if (!Number.isFinite(start)) return '--';
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function phase4bNotArmedResponse() {
  return { ok: false, error: 'PHASE_4B_NOT_ARMED' };
}

export function getJobWorkflowDetails(state = {}, provider = {}, explicitJobId = null) {
  const current = resolveCurrentJob(state, explicitJobId);

  if (!current) {
    return {
      stage: 'WAITING',
      guidance: 'No media jobs available in queue.',
      job_id: null,
      article_title: 'None',
      slot: 'featured',
      target_dimensions: '1315 × 660',
      prompt: '',
      prompt_hash: null,
      can_copy: false,
      can_send: false,
      send_reason: 'No job available',
      can_capture_latest: false,
      can_approve_upload: false,
      can_reject: false,
      can_assign_featured: false,
      generating: null,
      preview: null
    };
  }

  const targetJobId = current?.job_id || null;
  const opState = state?.jobOperationalStates?.[targetJobId] || null;
  const gate = targetJobId
    ? (state?.phase4bJobGates?.[targetJobId] || (state?.phase4bSingleRun?.job_id === targetJobId ? state.phase4bSingleRun : (!state?.phase4bSingleRun?.job_id ? state?.phase4bSingleRun : null)))
    : state?.phase4bSingleRun;
  const isGateForThisJob = Boolean(
    gate && (!gate.job_id || (targetJobId && gate.job_id === targetJobId))
  );
  const isConsumed = Boolean(isGateForThisJob && (gate.submission_consumed || gate.generation_consumed || (gate.completed_at && gate.outcome === 'complete')));
  const isNeedsAttention = Boolean(current.needs_attention || (isGateForThisJob && gate?.outcome === 'needs_attention'));

  const prompt = current.prompt || opState?.prompt || current.generation_prompt || current.canonical_prompt || '';
  const promptHash = current.prompt_hash || opState?.prompt_hash || null;
  const articleTitle = current.article_title || opState?.article_title || (current.article_id ? `Article #${current.article_id}` : current.job_id);
  const slotKey = current.slot_key || opState?.slot_key || current.role || 'featured';
  const targetDimensions = (current.target_width && current.target_height)
    ? `${current.target_width} × ${current.target_height}`
    : (current.target_dimensions || opState?.target_dimensions || '1315 × 660');

  const normalizedProvider = normalizeProviderStatus(provider);
  const isLocked = normalizedProvider.target === 'LOCKED' && Boolean(normalizedProvider.bound_tab_id);
  const isProviderReady = isLocked &&
    normalizedProvider.tab === 'connected' &&
    normalizedProvider.auth === 'ready' &&
    normalizedProvider.dom === 'supported' &&
    normalizedProvider.composer === 'ready' &&
    normalizedProvider.lane === 'idle';

  let sendReason = '';
  if (!isLocked) {
    sendReason = 'ChatGPT tab not bound (LOCKED required)';
  } else if (!isProviderReady) {
    sendReason = 'ChatGPT tab not ready (check auth/composer)';
  } else if (isConsumed) {
    sendReason = 'Run already consumed for this job';
  } else if (isNeedsAttention) {
    sendReason = 'Job requires operator attention';
  }

  let stage = 'WAITING';
  let guidance = '';
  let canSend = false;
  let canCaptureLatest = false;
  let canApproveUpload = false;
  let canReject = false;
  let canAssignFeatured = false;

  const localState = current.local_state || (current.status === 'COMPLETE' ? 'UPLOAD_COMPLETE' : current.status);

  if (isNeedsAttention) {
    stage = 'NEEDS ATTENTION';
    guidance = 'Job encountered an issue requiring operator inspection.';
  } else if (localState === 'SUBMITTING') {
    stage = 'SUBMITTING';
    guidance = 'Injecting canonical prompt into locked ChatGPT composer...';
  } else if (localState === 'GENERATING') {
    stage = 'GENERATING';
    guidance = 'ChatGPT is generating the media asset. Awaiting image candidate...';
    canCaptureLatest = isLocked;
  } else if (localState === 'IMAGE_DETECTED') {
    stage = 'RESULT READY';
    guidance = 'Assistant image detected in locked tab. Click "Capture Latest Image" to inspect candidate.';
    canCaptureLatest = isLocked;
    canReject = true;
  } else if (localState === 'CAPTURING') {
    stage = 'RESULT READY';
    guidance = 'Extracting candidate binary from bound ChatGPT tab...';
  } else if (localState === 'CAPTURED') {
    stage = 'RESULT READY';
    guidance = 'Candidate captured and fingerprinted. Review preview below, then Approve & Upload or Reject.';
    const candidateObj = opState?.candidate || current.preview_candidate || (current.blob_key || current.sha256 ? {
      job_id: current.job_id,
      sha256: current.sha256,
      blob_key: current.blob_key,
      is_uploaded: Boolean(current.local_state === 'UPLOAD_COMPLETE' || current.status === 'COMPLETE')
    } : null);
    const isCandidateUploaded = Boolean(candidateObj?.is_uploaded || localState === 'UPLOAD_COMPLETE' || current.status === 'COMPLETE');
    const jobApproval = state?.jobApprovals?.[targetJobId] || opState?.approval || null;
    const isApprovalConsumed = Boolean(jobApproval?.consumed);
    canApproveUpload = Boolean(
      candidateObj &&
      (!candidateObj.job_id || candidateObj.job_id === targetJobId) &&
      !isCandidateUploaded &&
      !isApprovalConsumed
    );
    canReject = true;
    canCaptureLatest = isLocked;
  } else if (localState === 'UPLOADING') {
    stage = 'UPLOADING';
    guidance = 'Uploading derivative binary to RancangLoka server and recording asset...';
  } else if (localState === 'UPLOAD_COMPLETE' || current.status === 'COMPLETE') {
    stage = 'UPLOAD COMPLETE';
    guidance = 'Asset uploaded and confirmed for this job. Distinct from Article Featured Assignment.';
    canAssignFeatured = false;
  } else if (localState === 'RESULT_REJECTED') {
    stage = 'WAITING';
    guidance = 'Previous result rejected. Zero uploads occurred. Prompt preserved.';
    canSend = isProviderReady && !isConsumed;
  } else if (prompt && (localState === 'QUEUED' || localState === 'WAITING_RETRY')) {
    if (isProviderReady && !isConsumed) {
      stage = 'PROMPT READY';
      guidance = 'Canonical prompt ready. Click "Send to ChatGPT" to dispatch to locked tab.';
      canSend = true;
    } else {
      stage = 'WAITING';
      guidance = isConsumed ? 'Single-run gate consumed for this job.' : (sendReason || 'Waiting for provider tab to be locked and ready.');
      canSend = false;
    }
  }

  let preview = null;
  const candidate = opState?.candidate || current.preview_candidate || null;
  let hasCapturedCandidate = false;

  if (candidate) {
    if (!candidate.job_id || candidate.job_id === targetJobId) {
      const activeRunId = current.run_id || gate?.phase4b_single_run_id || current.result_checkpoint?.run_id || null;
      if (!activeRunId || !candidate.run_id || candidate.run_id === activeRunId) {
        hasCapturedCandidate = true;
      }
    }
  } else if (current.blob_key || (['COMPLETE', 'UPLOAD_COMPLETE', 'CAPTURED'].includes(localState) && current.sha256)) {
    hasCapturedCandidate = true;
  }

  if (hasCapturedCandidate) {
    const width = candidate?.width ?? current.width;
    const height = candidate?.height ?? current.height;
    const size = candidate?.size ?? candidate?.byte_length ?? current.size;
    const sha256 = candidate?.sha256 ?? current.sha256;
    const mime = candidate?.mime ?? current.mime ?? 'image/png';
    const blobKey = candidate?.blob_key ?? current.blob_key ?? null;

    preview = {
      available: true,
      job_id: targetJobId,
      run_id: candidate?.run_id || current.run_id || gate?.phase4b_single_run_id || null,
      blob_key: blobKey,
      dimensions: width && height ? `${width} × ${height}` : (current.dimensions || '--'),
      mime,
      size: size ? `${(size / 1024).toFixed(1)} KB` : '--',
      sha256: sha256 || '--',
      short_sha256: sha256 ? `${sha256.slice(0, 8)}...${sha256.slice(-6)}` : '--',
      is_uploaded: localState === 'UPLOAD_COMPLETE' || current.status === 'COMPLETE',
      is_captured: Boolean(blobKey || localState === 'CAPTURED' || current.status === 'COMPLETE')
    };
  }

  const generating = (stage === 'GENERATING' || stage === 'SUBMITTING') ? {
    job_id: current.job_id,
    run_id: current.run_id || '--',
    bound_provider_tab: normalizedProvider.bound_tab_id ? String(normalizedProvider.bound_tab_id) : '--',
    elapsed: current.submitted_at ? elapsedSince(current.submitted_at) : '--'
  } : null;

  return {
    stage,
    guidance,
    job_id: current.job_id,
    article_title: articleTitle,
    slot: slotKey,
    target_dimensions: targetDimensions,
    prompt,
    prompt_hash: promptHash,
    can_copy: Boolean(prompt),
    can_send: canSend,
    send_reason: sendReason,
    can_capture_latest: canCaptureLatest,
    can_approve_upload: canApproveUpload,
    can_reject: canReject,
    can_assign_featured: canAssignFeatured,
    is_consumed: isConsumed,
    job_error: current.last_error || opState?.last_error || (isGateForThisJob ? gate?.last_error : null) || null,
    generating,
    preview
  };
}


