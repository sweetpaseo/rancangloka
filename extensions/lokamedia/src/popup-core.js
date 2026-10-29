import { isProviderExecutionInFlight } from './execution-state.js';
import { detectEnvironment } from './constants.js';

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

/**
 * Single authoritative provider resolution contract.
 * Guarantees that active execution locks, eligible foreground windows,
 * and persisted bindings resolve consistently across all UI elements.
 */
export function resolveAuthoritativeProvider(state = {}, windowCtx = null) {
  // 1. In-flight execution lock strictly dictates the provider
  if (isProviderExecutionInFlight(state)) {
    const lockedProviderId = state.locks?.providerLock?.providerId || state.provider?.active_provider_id;
    const isGeminiLocked = lockedProviderId === 'GEMINI_BROWSER';
    const key = isGeminiLocked ? 'gemini' : 'chatgpt';
    return {
      activeProviderKey: key,
      activeProviderId: isGeminiLocked ? 'GEMINI_BROWSER' : 'CHATGPT_BROWSER',
      providerName: isGeminiLocked ? 'Gemini' : 'ChatGPT',
      isExecutionLocked: true,
      selectionReason: 'IN_FLIGHT_EXECUTION_LOCK'
    };
  }

  // 2. Identify foreground tab in operator window if present
  let foregroundKey = null;
  const tabUrl = windowCtx?.tabUrl || '';
  if (tabUrl.startsWith('https://gemini.google.com')) {
    foregroundKey = 'gemini';
  } else if (tabUrl.startsWith('https://chatgpt.com')) {
    foregroundKey = 'chatgpt';
  }

  // 3. Check bound target states
  const geminiBound = state.provider?.gemini?.target_state === 'LOCKED' && Boolean(state.provider?.gemini?.provider_tab_id || state.provider?.gemini?.bound_tab_id);
  const chatGptBound = state.provider?.chatgpt?.target_state === 'LOCKED' && Boolean(state.provider?.chatgpt?.provider_tab_id || state.provider?.chatgpt?.bound_tab_id);

  // 4. If foreground is an eligible provider tab:
  if (foregroundKey) {
    const activeProviderId = foregroundKey === 'gemini' ? 'GEMINI_BROWSER' : 'CHATGPT_BROWSER';
    const isBound = foregroundKey === 'gemini' ? geminiBound : chatGptBound;
    return {
      activeProviderKey: foregroundKey,
      activeProviderId,
      providerName: foregroundKey === 'gemini' ? 'Gemini' : 'ChatGPT',
      isExecutionLocked: false,
      isBound,
      selectionReason: `FOREGROUND_WINDOW_${foregroundKey.toUpperCase()}`
    };
  }

  // 5. Bound target precedence (explicitly locked target takes priority over passive historical strings)
  if (geminiBound && !chatGptBound) {
    return {
      activeProviderKey: 'gemini',
      activeProviderId: 'GEMINI_BROWSER',
      providerName: 'Gemini',
      isExecutionLocked: false,
      isBound: true,
      selectionReason: 'BOUND_TARGET_GEMINI'
    };
  }
  if (chatGptBound && !geminiBound) {
    return {
      activeProviderKey: 'chatgpt',
      activeProviderId: 'CHATGPT_BROWSER',
      providerName: 'ChatGPT',
      isExecutionLocked: false,
      isBound: true,
      selectionReason: 'BOUND_TARGET_CHATGPT'
    };
  }

  // 6. Diagnostics origin fallback
  const diagOrigin = state.provider?.diagnostics?.selected_provider_origin || '';
  if (diagOrigin.includes('gemini.google.com')) {
    return {
      activeProviderKey: 'gemini',
      activeProviderId: 'GEMINI_BROWSER',
      providerName: 'Gemini',
      isExecutionLocked: false,
      isBound: geminiBound,
      selectionReason: 'DIAGNOSTICS_ORIGIN_GEMINI'
    };
  }
  if (diagOrigin.includes('chatgpt.com')) {
    return {
      activeProviderKey: 'chatgpt',
      activeProviderId: 'CHATGPT_BROWSER',
      providerName: 'ChatGPT',
      isExecutionLocked: false,
      isBound: chatGptBound,
      selectionReason: 'DIAGNOSTICS_ORIGIN_CHATGPT'
    };
  }

  // 7. Stored active_provider_id
  if (state.provider?.active_provider_id === 'GEMINI_BROWSER') {
    return {
      activeProviderKey: 'gemini',
      activeProviderId: 'GEMINI_BROWSER',
      providerName: 'Gemini',
      isExecutionLocked: false,
      isBound: geminiBound,
      selectionReason: 'STORED_ACTIVE_PROVIDER_GEMINI'
    };
  }
  if (state.provider?.active_provider_id === 'CHATGPT_BROWSER') {
    return {
      activeProviderKey: 'chatgpt',
      activeProviderId: 'CHATGPT_BROWSER',
      providerName: 'ChatGPT',
      isExecutionLocked: false,
      isBound: chatGptBound,
      selectionReason: 'STORED_ACTIVE_PROVIDER_CHATGPT'
    };
  }

  // 8. Default fallback: ChatGPT
  return {
    activeProviderKey: 'chatgpt',
    activeProviderId: 'CHATGPT_BROWSER',
    providerName: 'ChatGPT',
    isExecutionLocked: false,
    isBound: chatGptBound,
    selectionReason: 'DEFAULT_FALLBACK_CHATGPT'
  };
}

export function normalizeProviderStatus(provider = {}) {
  const capabilities = provider.capabilities?.capabilities ?? provider.capabilities ?? {};
  const tabStatus = provider.tab_status ?? 'missing';
  const boundId = provider.bound_tab_id ?? provider.provider_tab_id ?? null;
  const targetState = provider.target_state ?? (boundId ? 'LOCKED' : 'NOT BOUND');
  const targetBound = Boolean(boundId && targetState === 'LOCKED');
  const isLive = targetBound && tabStatus === 'connected';

  const authState = isLive ? (provider.auth_state ?? 'UNKNOWN') : 'UNKNOWN';
  const domStatus = isLive ? (provider.dom_status ?? 'UNKNOWN') : 'UNKNOWN';
  const composerReady = isLive && (provider.composer_status === 'ready' || capabilities.COMPOSER_EDITABLE === true);

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
    images: isLive ? Number(provider.visible_image_candidates ?? provider.image_candidate_count ?? 0) : 0,
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
    'system-environment',
    'system-backpressure',
    'system-error',
    'last-action',
    'server',
    'token',
    'environment-selector',
    'btn-switch-environment',
    'environment-badge',
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
    'acquire-lease-container',
    'btn-acquire-lease',
    'capture-latest',
    'approve-upload',
    'reject-result',
    'result-preview-image',
    'preview-placeholder',
    'result-dimensions',
    'result-mime',
    'result-size',
    'result-sha256',
    'result-provenance',
    'assign-featured',
    'generating-card',
    'generating-job-id',
    'generating-run-id',
    'generating-provider-tab',
    'generating-elapsed',
    'result-preview-card',
    'manual-promotion-card',
    'manual-article-slug',
    'manual-btn-resolve',
    'manual-article-attestation',
    'manual-article-title',
    'manual-article-status',
    'manual-article-hash',
    'manual-current-featured',
    'manual-file-input',
    'manual-btn-select-file',
    'manual-candidate-preview-box',
    'manual-preview-image',
    'manual-candidate-filename',
    'manual-candidate-dimensions',
    'manual-candidate-mime',
    'manual-candidate-size',
    'manual-candidate-sha',
    'manual-status-banner',
    'manual-btn-approve',
    'manual-btn-check-status',
    'manual-btn-execute',
    'manual-btn-reset',
    'job-selector',
    'btn-copy-diagnostic-snapshot',
    'snapshot-status',
    'snapshot-fallback-container',
    'snapshot-fallback-text'
  ];
  const missing = ids.filter((id) => !doc.querySelector(`#${id}`));
  return { ok: missing.length === 0, missing };
}

export function parseSemver(v) {
  if (!v || typeof v !== 'string') return null;
  const clean = v.trim().replace(/^[vV]/, '');
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null
  };
}

export function compareSemver(v1, v2) {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);
  if (!p1 || !p2) return null;
  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;
  return 0;
}

export function isVersionCompatible(runtimeVersion, expectedVersion) {
  if (!runtimeVersion || !expectedVersion) return false;
  if (runtimeVersion === expectedVersion) return true;
  const r = parseSemver(runtimeVersion);
  const e = parseSemver(expectedVersion);
  if (!r || !e) return false;
  // Major mismatch is incompatible
  if (r.major !== e.major) return false;
  // In 0.y.z, minor bumps are breaking changes (e.g. 0.1.x vs 0.2.x)
  if (r.major === 0) {
    if (r.minor !== e.minor) return false;
    // Client runtime must be at least the expected version
    return r.patch >= e.patch;
  }
  // In >= 1.0.0, runtime minor must be >= expected minor, or if equal, patch >= expected patch
  if (r.minor !== e.minor) {
    return r.minor >= e.minor;
  }
  return r.patch >= e.patch;
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
  const versionCurrent = !expectedVersion || !runtimeVersion || isVersionCompatible(runtimeVersion, expectedVersion);
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

  const providerLabel = provider.provider_origin?.includes('gemini') ? 'Gemini' : 'ChatGPT';

  if (provider.target === 'CLOSED' || provider.tab === 'closed' || provider.tab === 'navigated') {
    return { eligible: false, reason: `Bound ${providerLabel} tab unavailable` };
  }

  const targetBound = provider.target_bound !== undefined
    ? Boolean(provider.target_bound)
    : (provider.target ? provider.target === 'LOCKED' : true);

  if (!targetBound || provider.target === 'NOT BOUND') {
    return { eligible: false, reason: `Bind a ${providerLabel} tab first` };
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

  const slotVal = current?.slot || 'featured';
  const isSupportedSlot = ['featured', 'inline'].includes(slotVal) ||
    slotVal.startsWith('inline') ||
    ['featured', 'inline'].includes(currentJobObj?.role || '');
  const waitingJob =
    current?.operation === 'Waiting' &&
    isSupportedSlot &&
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
  // Operator explicit selection takes immediate precedence
  if (state.selectedJobId && jobsMap[state.selectedJobId]) {
    return jobsMap[state.selectedJobId];
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

  // 3. Queued / leased / waiting retry jobs
  const queued = jobs.find((j) =>
    ['LEASED', 'QUEUED', 'WAITING_RETRY'].includes(j.local_state ?? j.status)
  );
  if (queued) return queued;

  // 4. If currentJobId is set and points to an active/leased/queued job, or all jobs are complete/waiting
  if (state.currentJobId && jobsMap[state.currentJobId]) {
    const candidate = jobsMap[state.currentJobId];
    const isCandidateActiveOrQueued = ['SUBMITTING', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED', 'UPLOADING', 'RECOVERING', 'LEASED', 'QUEUED', 'WAITING_RETRY'].includes(candidate.local_state ?? candidate.status);
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

export function resolveEffectiveDeviceId(state = {}) {
  const configuredEnv = state.activeEnvironment || 'local';
  const actualHttpDestination = state.config?.serverBaseUrl || 'http://localhost:4321';
  const detectedEnv = detectEnvironment(actualHttpDestination);
  const isLocalDev = Boolean(
    configuredEnv === 'local' ||
    detectedEnv === 'local' ||
    state.config?.activeProfile === 'local' ||
    !state.config?.serverBaseUrl ||
    state.config?.serverBaseUrl?.includes('localhost') ||
    state.config?.serverBaseUrl?.includes('127.0.0.1')
  );
  const isTokenlessDev = (!state.config?.deviceToken && isLocalDev);

  if (isTokenlessDev) {
    return 'dev_local_tokenless';
  }

  return (
    state.config?.deviceId ||
    state.activeDeviceId ||
    state.deviceId ||
    (isLocalDev ? 'dev_local_tokenless' : 'dev_chr_local')
  );
}

export function evaluateJobLease(currentJob, state = {}) {
  if (!currentJob) {
    return { status: 'NO_JOB', isValid: false, reason: 'No job selected', leaseEvaluation: 'NO_JOB', activeDeviceId: null };
  }

  const activeDeviceId = resolveEffectiveDeviceId(state);

  const isLeased = currentJob.status === 'LEASED' || currentJob.local_state === 'LEASED';
  const isQueued = !isLeased && (
    (currentJob.local_state ?? currentJob.status) === 'QUEUED' ||
    (currentJob.local_state ?? currentJob.status) === 'WAITING_RETRY'
  );

  if (isQueued || (!isLeased && !currentJob.lease_owner)) {
    return { status: 'UNLEASED', isValid: false, reason: 'Job is unleased. Acquire lease before dispatch.', leaseEvaluation: 'UNLEASED', activeDeviceId };
  }

  if (!currentJob.lease_owner) {
    return { status: 'UNLEASED', isValid: false, reason: 'Job has no lease owner', leaseEvaluation: 'UNLEASED', activeDeviceId };
  }

  // Expired lease evaluated FIRST before checking owner match.
  // An expired lease cannot be held by any device.
  if (currentJob.lease_expires_at) {
    const expiresMs = Date.parse(currentJob.lease_expires_at);
    if (isNaN(expiresMs) || expiresMs <= Date.now()) {
      return { status: 'LEASE_EXPIRED', isValid: false, reason: 'Job lease expired', leaseEvaluation: 'LEASE_EXPIRED', activeDeviceId };
    }
  } else {
    return { status: 'LEASE_EXPIRED', isValid: false, reason: 'Job lease expired', leaseEvaluation: 'LEASE_EXPIRED', activeDeviceId };
  }

  if (currentJob.lease_owner !== activeDeviceId) {
    return { status: 'LEASE_MISMATCH', isValid: false, reason: 'Lease held by another device', leaseEvaluation: `MISMATCH_OWNED_BY_${currentJob.lease_owner}`, activeDeviceId };
  }

  return { status: 'ACTIVE_VALID', isValid: true, reason: '', leaseEvaluation: 'ACTIVE_VALID', activeDeviceId };
}

export function getJobWorkflowDetails(state = {}, provider = {}, explicitJobId = null, explicitProviderLabel = null) {
  const current = resolveCurrentJob(state, explicitJobId);

  const isGemini =
    explicitProviderLabel?.toLowerCase?.() === 'gemini' ||
    provider?.provider_origin?.includes('gemini.google.com') ||
    provider?.bound_url?.includes('gemini.google.com') ||
    provider?.provider_id === 'GEMINI_BROWSER' ||
    state.provider?.active_provider_id === 'GEMINI_BROWSER';
  const providerLabel = isGemini ? 'Gemini' : 'ChatGPT';

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
      can_paste_image: false,
      can_import_file: false,
      can_approve_upload: false,
      can_reject: false,
      can_assign_featured: false,
      can_select_fallback_file: false,
      can_acquire_lease: false,
      acquire_lease_reason: 'No media jobs available in queue.',
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
    sendReason = `${providerLabel} tab not bound (LOCKED required)`;
  } else if (!isProviderReady) {
    sendReason = `${providerLabel} tab not ready (check auth/composer)`;
  } else if (isConsumed) {
    sendReason = 'Run already consumed for this job';
  } else if (isNeedsAttention) {
    sendReason = 'Job requires operator attention';
  }

  let stage = 'WAITING';
  let guidance = '';
  let canSend = false;
  let canApproveUpload = false;
  let canReject = false;
  let canAssignFeatured = false;

  const localState = (current.status === 'COMPLETE')
    ? 'UPLOAD_COMPLETE'
    : (current.status === 'LEASED' && (!current.local_state || current.local_state === 'QUEUED')
        ? 'LEASED'
        : (current.local_state || current.status));
  const isJobIncomplete = Boolean(
    current &&
    !['COMPLETE', 'UPLOAD_COMPLETE'].includes(localState) &&
    !['COMPLETE', 'UPLOAD_COMPLETE'].includes(current.status)
  );
  const canPasteImage = Boolean(isJobIncomplete && localState !== 'UPLOADING');
  const canImportFile = false; // Retired by owner decision (2026-10-22)
  const canSelectFallbackFile = false; // Retired
  let canCaptureLatest = Boolean(isLocked && isJobIncomplete && localState !== 'UPLOADING');

  const lease = evaluateJobLease(current, state);
  const isLeaseValid = lease.isValid;
  const leaseBlockReason = lease.reason;

  const isCompleted = Boolean(
    current.status === 'COMPLETE' ||
    localState === 'COMPLETE' ||
    localState === 'UPLOAD_COMPLETE'
  );
  const isInFlight = ['SUBMITTING', 'GENERATING', 'CAPTURING', 'UPLOADING'].includes(localState);

  let canAcquireLease = false;
  let acquireLeaseReason = '';

  if (isCompleted) {
    canAcquireLease = false;
    acquireLeaseReason = 'Job is already completed';
  } else if (isInFlight) {
    canAcquireLease = false;
    acquireLeaseReason = 'Job execution is in progress';
  } else if (isLeaseValid) {
    canAcquireLease = false;
    acquireLeaseReason = 'Active valid lease already held by this device';
  } else if (lease.status === 'LEASE_MISMATCH') {
    canAcquireLease = false;
    acquireLeaseReason = current.lease_owner
      ? `Lease held by device "${current.lease_owner}". Exclusive lease required.`
      : (leaseBlockReason || 'Lease held by another device');
  } else if (lease.status === 'LEASE_EXPIRED') {
    canAcquireLease = true;
    acquireLeaseReason = 'Acquire active lease to renew expired lease from server';
  } else if (lease.status === 'UNLEASED' || localState === 'QUEUED' || localState === 'WAITING_RETRY') {
    canAcquireLease = true;
    acquireLeaseReason = 'Acquire active lease for current job from server';
  } else {
    canAcquireLease = false;
    acquireLeaseReason = leaseBlockReason || 'Job lease is not available for acquisition';
  }

  if (isNeedsAttention) {
    stage = 'NEEDS ATTENTION';
    guidance = 'Job encountered an issue requiring operator inspection.';
  } else if (localState === 'SUBMITTING') {
    stage = 'SUBMITTING';
    guidance = `Injecting canonical prompt into locked ${providerLabel} composer...`;
  } else if (localState === 'GENERATING') {
    stage = 'GENERATING';
    guidance = `${providerLabel} is generating the media asset. Awaiting image candidate...`;
    canCaptureLatest = isLocked;
  } else if (localState === 'IMAGE_DETECTED') {
    stage = 'RESULT READY';
    guidance = 'Assistant image detected in locked tab. Click "Capture Latest Image" to inspect candidate.';
    canCaptureLatest = isLocked;
    canReject = true;
  } else if (localState === 'CAPTURING') {
    stage = 'RESULT READY';
    guidance = `Extracting candidate binary from bound ${providerLabel} tab...`;
  } else if (localState === 'CAPTURED') {
    stage = 'RESULT READY';
    guidance = isLeaseValid
      ? 'Candidate captured and fingerprinted. Review preview below, then Approve & Upload or Reject.'
      : 'Candidate captured and fingerprinted. Active lease expired; acquire lease before Approve & Upload.';
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
      !isApprovalConsumed &&
      isLeaseValid
    );
    canReject = !isCandidateUploaded && !isApprovalConsumed;
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
    canSend = isProviderReady && !isConsumed && isLeaseValid;
  } else if (localState === 'LEASED') {
    if (!isLeaseValid) {
      stage = 'WAITING';
      guidance = leaseBlockReason === 'Job lease expired'
        ? 'Job lease expired. Needs recovery or re-queue.'
        : (leaseBlockReason === 'Lease held by another device'
            ? `Lease held by device "${current.lease_owner}". Exclusive lease required.`
            : 'Job lease is invalid or missing lease owner.');
      canSend = false;
      sendReason = sendReason || leaseBlockReason;
    } else if (prompt) {
      if (isProviderReady && !isConsumed) {
        stage = 'PROMPT READY';
        guidance = `Canonical prompt ready. Click "Send to ${providerLabel}" to dispatch to locked tab.`;
        canSend = true;
      } else {
        stage = 'WAITING';
        guidance = isConsumed ? 'Single-run gate consumed for this job.' : (sendReason || 'Waiting for provider tab to be locked and ready.');
        canSend = false;
      }
    }
  } else if (localState === 'QUEUED' || localState === 'WAITING_RETRY') {
    stage = 'WAITING';
    canSend = false;
    sendReason = 'Job is unleased. Acquire lease before dispatch.';
    guidance = isConsumed
      ? 'Single-run gate consumed for this job.'
      : 'Job is queued but unleased. Click "Acquire Job Lease" to lease before dispatch.';
  }

  let preview = null;
  const candidate = opState?.candidate || current.preview_candidate || null;
  let hasCapturedCandidate = false;

  if (candidate) {
    if (!candidate.job_id || candidate.job_id === targetJobId) {
      const activeRunId = current.run_id || gate?.phase4b_single_run_id || current.result_checkpoint?.run_id || null;
      if (!activeRunId || !candidate.run_id || candidate.run_id === activeRunId || ['CAPTURED', 'UPLOAD_COMPLETE', 'COMPLETE'].includes(localState) || Boolean(candidate.blob_key || current.blob_key)) {
        hasCapturedCandidate = true;
      }
    }
  } else if (current.blob_key || (['COMPLETE', 'UPLOAD_COMPLETE', 'CAPTURED'].includes(localState) && current.sha256)) {
    hasCapturedCandidate = true;
  }

  if (hasCapturedCandidate) {
    const width = current.width ?? candidate?.width;
    const height = current.height ?? candidate?.height;
    const size = current.size ?? candidate?.size ?? candidate?.byte_length;
    const sha256 = current.sha256 ?? candidate?.sha256;
    const mime = current.mime ?? candidate?.mime ?? 'image/png';
    const blobKey = current.blob_key ?? candidate?.blob_key ?? null;

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
      provenance: candidate?.provenance || current.provenance || '--',
      source_provenance: candidate?.source_provenance || current.source_provenance || candidate?.provenance || current.provenance || '--',
      is_uploaded: localState === 'UPLOAD_COMPLETE' || current.status === 'COMPLETE',
      is_captured: Boolean(blobKey || localState === 'CAPTURED' || current.status === 'COMPLETE')
    };

    if (!preview.is_uploaded) {
      const jobApproval = state?.jobApprovals?.[targetJobId] || opState?.approval || null;
      const isApprovalConsumed = Boolean(jobApproval?.consumed);
      if (!isApprovalConsumed) {
        canReject = true;
      }
    }
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
    can_paste_image: canPasteImage,
    can_import_file: canImportFile,
    can_approve_upload: canApproveUpload,
    can_reject: canReject,
    can_assign_featured: canAssignFeatured,
    can_select_fallback_file: canSelectFallbackFile,
    can_acquire_lease: canAcquireLease,
    acquire_lease_reason: acquireLeaseReason,
    is_consumed: isConsumed,
    job_error: current.last_error || opState?.last_error || (isGateForThisJob ? gate?.last_error : null) || null,
    generating,
    preview
  };
}


