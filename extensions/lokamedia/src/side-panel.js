import {
  SIDE_PANEL_BOOT_FLAGS,
  evaluateRunOnceEligibility,
  getJobWorkflowDetails,
  isVersionCompatible,
  normalizeProviderStatus,
  normalizeServerStatus,
  resolveAuthoritativeProvider,
  resolveCurrentJob,
  summarizeCurrentJob,
  summarizeTransfers,
  validateSidePanelElements
} from './popup-core.js';
import { isRecoverableResultCheckpoint } from './providers/chatgpt/correlation.js';
import { EXTENSION_VERSION, PROVIDER_OPERATION_TIMEOUT_MS, detectEnvironment } from './constants.js';
import { isProviderExecutionInFlight } from './execution-state.js';
import { collectDiagnosticSnapshot, formatDiagnosticSnapshotText } from './diagnostic-snapshot.js';

const boot = new Set([SIDE_PANEL_BOOT_FLAGS.SCRIPT_LOADED]);
let bound = false;
let refreshTimer = null;
let configInitialized = false;
let configDraftDirty = false;

function element(selector) {
  const match = document.querySelector(selector);
  if (!match) throw new Error(`SIDE_PANEL_ELEMENT_MISSING:${selector}`);
  return match;
}

function setStatus(message, isError = false) {
  if (typeof document === 'undefined') return;
  const status = document.querySelector('#panel-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
}

function boundedError(error) {
  const message = String(error?.message || error || 'UNKNOWN_ERROR');
  if (message.includes('Receiving end does not exist')) return 'CONTENT_SCRIPT_UNAVAILABLE';
  if (message.includes('Extension context invalidated')) return 'SERVICE_WORKER_UNAVAILABLE';
  if (message.startsWith('SIDE_PANEL_ELEMENT_MISSING')) return message;
  return message.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 100);
}

export const TRANSIENT_STALE_STATUS_PATTERNS = [
  'RUN_ONCE_TIMEOUT',
  'SEND_TO_CHATGPT_TIMEOUT',
  'Failed to fetch'
];

export const HEALTHY_OPERATOR_STAGES = new Set([
  'PROMPT READY',
  'RESULT READY',
  'UPLOAD COMPLETE'
]);

export function reconcileStatusBanner(state, workflow, displayError) {
  if (typeof document === 'undefined') return;
  const statusEl = document.querySelector('#panel-status');
  if (!statusEl) return;
  if (statusEl.dataset.state !== 'error') return;

  const currentText = statusEl.textContent || '';
  const isTransientBanner = TRANSIENT_STALE_STATUS_PATTERNS.some((pat) => currentText.includes(pat));
  if (!isTransientBanner) return;

  const isHealthyStage = HEALTHY_OPERATOR_STAGES.has(workflow?.stage);
  const currentJobError = workflow?.job_error || (workflow?.job_id && state?.jobs?.[workflow.job_id]?.last_error) || null;
  const hasNoJobError = !currentJobError;

  if (isHealthyStage && hasNoJobError && !displayError) {
    setStatus('Ready', false);
  }
}

async function send(type, payload = {}, { timeoutMs = 3000 } = {}) {
  const request = { id: crypto.randomUUID(), type, ...payload };
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${type}_TIMEOUT`)), timeoutMs);
  });
  try {
    const response = await Promise.race([chrome.runtime.sendMessage(request), timeout]);
    if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
    if (!response?.ok && response?.error) throw new Error(response.error);
    boot.add(SIDE_PANEL_BOOT_FLAGS.SERVICE_WORKER_CONNECTED);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function renderTransfers(transfers) {
  const container = element('#transfers');
  if (!transfers.length) {
    container.textContent = 'No active transfers';
    return;
  }
  container.textContent = '';
  for (const transfer of transfers) {
    const row = document.createElement('div');
    row.className = 'transfer';
    const percentage = transfer.percentage == null ? 'active' : `${transfer.percentage}%`;
    row.innerHTML = `<div class="transfer-label"><span></span><strong></strong></div><div class="bar"><span></span></div>`;
    row.querySelector('span').textContent = transfer.label;
    row.querySelector('strong').textContent = percentage;
    row.querySelector('.bar span').style.width = `${transfer.percentage ?? 100}%`;
    container.append(row);
  }
}

let currentLoadedBlobKey = null;
let currentLoadedSha256 = null;
let currentPreviewObjectUrl = null;
let activePreviewRequestId = 0;

export function invalidatePreviewCache() {
  currentLoadedBlobKey = null;
  currentLoadedSha256 = null;
  if (currentPreviewObjectUrl) {
    try { URL.revokeObjectURL(currentPreviewObjectUrl); } catch {}
    currentPreviewObjectUrl = null;
  }
}

export async function loadPreviewImage(blobKey, preview = null) {
  const requestId = ++activePreviewRequestId;
  const targetSha = preview?.sha256 || null;
  if (!blobKey) {
    invalidatePreviewCache();
    const img = element('#result-preview-image');
    if (img) {
      if (img.src && img.src.startsWith('blob:')) {
        try { URL.revokeObjectURL(img.src); } catch {}
      }
      img.src = '';
      img.style.display = 'none';
    }
    const placeholder = element('#preview-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = preview?.is_uploaded
        ? `Asset uploaded and verified (${preview.short_sha256})`
        : 'No image candidate captured';
    }
    return;
  }
  if (currentLoadedBlobKey === blobKey && targetSha && currentLoadedSha256 === targetSha) {
    const existingImg = element('#result-preview-image');
    if (existingImg && existingImg.style.display === 'block' && existingImg.src) {
      return;
    }
  }
  try {
    const res = await send('GET_BLOB_PREVIEW', { key: blobKey });
    if (requestId !== activePreviewRequestId) {
      console.info(`[LokaMedia:ImportTrace] [B8:DomPreview] Discarding stale preview response (reqId=${requestId}, active=${activePreviewRequestId})`);
      return;
    }
    if (res.ok && res.dataUrl) {
      currentLoadedBlobKey = blobKey;
      currentLoadedSha256 = res.sha256 || targetSha || null;
      const img = element('#result-preview-image');
      if (img.src && img.src.startsWith('blob:')) {
        try { URL.revokeObjectURL(img.src); } catch {}
      }
      if (currentPreviewObjectUrl) {
        try { URL.revokeObjectURL(currentPreviewObjectUrl); } catch {}
        currentPreviewObjectUrl = null;
      }
      img.src = res.dataUrl;
      img.style.display = 'block';
      element('#preview-placeholder').style.display = 'none';
      console.info(`[LokaMedia:ImportTrace] [B8:DomPreview] Applied preview: blobKey=${blobKey} sha=${currentLoadedSha256} naturalDims=${img.naturalWidth || '--'}x${img.naturalHeight || '--'}`);
      return;
    }
  } catch (err) {
    console.warn('[LokaMedia:Preview] GET_BLOB_PREVIEW failed:', err);
  }
  invalidatePreviewCache();
  const img = element('#result-preview-image');
  if (img) {
    if (img.src && img.src.startsWith('blob:')) {
      try { URL.revokeObjectURL(img.src); } catch {}
    }
    img.src = '';
    img.style.display = 'none';
  }
  const placeholder = element('#preview-placeholder');
  if (placeholder) {
    placeholder.style.display = 'block';
    if (preview?.is_uploaded) {
      placeholder.textContent = `Asset uploaded and verified (${preview.short_sha256})`;
    } else if (preview?.available) {
      placeholder.textContent = `Candidate captured (${preview.short_sha256})`;
    } else {
      placeholder.textContent = 'No image candidate captured';
    }
  }
}

let lastKnownWindowCtx = null;
let lastKnownWorkflow = null;

export function hasUnapprovedCandidate(workflow) {
  return Boolean(
    workflow?.preview?.available &&
    !workflow.preview.is_uploaded &&
    (workflow.preview.blob_key || workflow.preview.sha256)
  );
}

export function promptCandidateReplacement(workflow, actionLabel = 'intake') {
  if (!hasUnapprovedCandidate(workflow)) return true;
  const dims = workflow.preview?.dimensions || 'dimensions unknown';
  const sha = workflow.preview?.short_sha256 || 'unknown';
  const msg = `An unapproved candidate image is currently loaded for this job (${dims}, SHA: ${sha}).\n\nDo you want to replace it with the new ${actionLabel}? The existing candidate will be replaced.`;
  const confirmed = globalThis.confirm ? globalThis.confirm(msg) : true;
  if (!confirmed) {
    console.info(`[LokaMedia:Replace] Candidate replacement cancelled by operator for ${actionLabel}`);
    return false;
  }
  return true;
}

export async function getSidePanelWindowContext() {
  if (typeof chrome === 'undefined' || !chrome.windows?.getCurrent) {
    return lastKnownWindowCtx || { windowId: null, tabId: null, tabUrl: null };
  }
  try {
    const win = await chrome.windows.getCurrent({ populate: false });
    const winId = win?.id;
    if (winId != null && win.type === 'normal') {
      const tabs = await chrome.tabs?.query?.({ active: true, windowId: winId });
      const activeTab = tabs?.find((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
      if (activeTab) {
        lastKnownWindowCtx = {
          windowId: winId,
          tabId: activeTab.id,
          tabUrl: activeTab.url
        };
        return lastKnownWindowCtx;
      }
    }
  } catch {}
  return lastKnownWindowCtx || { windowId: null, tabId: null, tabUrl: null };
}

export function getActiveProviderKey(state, windowCtx = null) {
  const effectiveCtx = windowCtx || lastKnownWindowCtx;
  return resolveAuthoritativeProvider(state, effectiveCtx).activeProviderKey;
}

export function renderState(state, windowCtx = null) {
  const effectiveWindowCtx = windowCtx || lastKnownWindowCtx;
  const authProvider = resolveAuthoritativeProvider(state, effectiveWindowCtx);
  const activeProviderKey = authProvider.activeProviderKey;
  const isGeminiActive = activeProviderKey === 'gemini';
  const providerLabel = authProvider.providerName;
  const provider = normalizeProviderStatus(state.provider?.[activeProviderKey] ?? {});
  const server = normalizeServerStatus(state);
  const current = summarizeCurrentJob(state);
  const transfers = summarizeTransfers(state);
  const workflow = getJobWorkflowDetails(state, state.provider?.[activeProviderKey] ?? {}, null, providerLabel);
  lastKnownWorkflow = workflow;
  const diag = state.provider?.diagnostics;

  // UX-2 Workflow Stage
  element('#workflow-stage').textContent = workflow.stage;
  element('#workflow-guidance').textContent = workflow.guidance;

  // Active Job Selector Dropdown
  const jobSelector = document.querySelector('#job-selector');
  if (jobSelector) {
    const jobsList = Object.values(state.jobs ?? {});
    const selectedJobId = state.selectedJobId || workflow.job_id || '';
    const currentOptions = Array.from(jobSelector.options || []).map((o) => o.value);
    const currentOptionTexts = Array.from(jobSelector.options || []).map((o) => o.textContent);
    const newJobIds = ['', ...jobsList.map((j) => j.job_id)];
    const newOptionTexts = ['Auto (Default Precedence)', ...jobsList.map((j) => {
      const stateBadge = j.local_state || j.status || 'QUEUED';
      const roleBadge = j.role || j.slot_key || 'media';
      const titleShort = (j.article_title || j.job_id).slice(0, 30);
      return `[${stateBadge}] ${titleShort} (${roleBadge})`;
    })];
    const optionsDiffer = currentOptions.length !== newJobIds.length ||
      currentOptions.some((val, idx) => val !== newJobIds[idx]) ||
      currentOptionTexts.some((text, idx) => text !== newOptionTexts[idx]);

    if (optionsDiffer || jobSelector.value !== selectedJobId) {
      jobSelector.innerHTML = '<option value="">Auto (Default Precedence)</option>';
      for (const j of jobsList) {
        const opt = document.createElement('option');
        opt.value = j.job_id;
        const stateBadge = j.local_state || j.status || 'QUEUED';
        const roleBadge = j.role || j.slot_key || 'media';
        const titleShort = (j.article_title || j.job_id).slice(0, 30);
        opt.textContent = `[${stateBadge}] ${titleShort} (${roleBadge})`;
        if (j.job_id === selectedJobId) {
          opt.selected = true;
        }
        jobSelector.appendChild(opt);
      }
      jobSelector.value = selectedJobId;
    }
  }

  // UX-2 Prompt Preview
  element('#prompt-article-title').textContent = workflow.article_title;
  element('#prompt-slot').textContent = workflow.slot;
  element('#prompt-dimensions').textContent = workflow.target_dimensions;
  element('#prompt-text').value = workflow.prompt;
  element('#copy-prompt').disabled = !workflow.can_copy;
  const sendBtn = element('#send-to-chatgpt');
  sendBtn.textContent = isGeminiActive ? 'Send to Gemini' : 'Send to ChatGPT';
  sendBtn.disabled = !workflow.can_send;
  sendBtn.title = workflow.send_reason || '';

  const acquireContainer = element('#acquire-lease-container');
  const acquireBtn = element('#btn-acquire-lease');
  if (acquireContainer && acquireBtn) {
    acquireContainer.style.display = 'block';
    const canAcquire = Boolean(workflow.can_acquire_lease && server === 'online');
    acquireBtn.disabled = !canAcquire;
    acquireBtn.title = server !== 'online'
      ? 'RancangLoka server is offline'
      : (workflow.acquire_lease_reason || (canAcquire ? 'Acquire active lease for current job from server' : 'Job lease is not available for acquisition'));
  }

  // UX-2 Generating State
  const genCard = element('#generating-card');
  if (workflow.generating) {
    genCard.style.display = 'block';
    element('#generating-job-id').textContent = workflow.generating.job_id || '--';
    element('#generating-run-id').textContent = workflow.generating.run_id || '--';
    element('#generating-provider-tab').textContent = workflow.generating.bound_provider_tab || '--';
    element('#generating-elapsed').textContent = workflow.generating.elapsed || '--';
  } else {
    genCard.style.display = 'none';
  }

  // UX-2 Result Review
  element('#capture-latest').disabled = !workflow.can_capture_latest;
  element('#capture-latest').title = workflow.can_capture_latest
    ? 'Capture latest image from bound provider tab'
    : (workflow.job_id ? 'Bind tab or select incomplete job to capture' : 'No active media job selected');

  const pasteBtn = document.querySelector('#paste-image');
  if (pasteBtn) {
    pasteBtn.disabled = !workflow.can_paste_image;
    pasteBtn.title = workflow.can_paste_image
      ? 'Paste image from clipboard (Ctrl+V)'
      : (workflow.job_id ? 'Job is already complete' : 'No active media job selected');
  }

  element('#reject-result').disabled = !workflow.can_reject;
  element('#reject-result').title = workflow.can_reject
    ? 'Reset this image (discard current unapproved candidate)'
    : (workflow.preview?.is_uploaded
        ? 'Cannot reset an already uploaded or completed asset'
        : 'No unapproved candidate loaded to reset');
  element('#approve-upload').disabled = !workflow.can_approve_upload;
  element('#assign-featured').disabled = !workflow.can_assign_featured;

  const provenanceEl = element('#result-provenance');
  if (workflow.preview?.available) {
    element('#result-dimensions').textContent = workflow.preview.dimensions || '--';
    element('#result-mime').textContent = workflow.preview.mime || '--';
    element('#result-size').textContent = workflow.preview.size || '--';
    element('#result-sha256').textContent = workflow.preview.short_sha256 || '--';
    if (provenanceEl) {
      provenanceEl.textContent = workflow.preview.source_provenance || workflow.preview.provenance || '--';
    }
    console.info(`[LokaMedia:ImportTrace] [B6:RenderState] jobId=${workflow.job_id} renderedBlobKey=${workflow.preview.blob_key} renderedSha=${workflow.preview.sha256} renderedDims=${workflow.preview.dimensions}`);

    if (workflow.preview.blob_key) {
      void loadPreviewImage(workflow.preview.blob_key, workflow.preview);
    } else {
      currentLoadedBlobKey = null;
      const img = element('#result-preview-image');
      if (img) { img.src = ''; img.style.display = 'none'; }
      const placeholder = element('#preview-placeholder');
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.textContent = workflow.preview.is_uploaded
          ? `Asset uploaded and verified (${workflow.preview.short_sha256})`
          : `Candidate captured (${workflow.preview.short_sha256})`;
      }
    }
  } else {
    element('#result-dimensions').textContent = '--';
    element('#result-mime').textContent = '--';
    element('#result-size').textContent = '--';
    element('#result-sha256').textContent = '--';
    if (provenanceEl) provenanceEl.textContent = '--';

    currentLoadedBlobKey = null;
    const img = element('#result-preview-image');
    if (img) { img.src = ''; img.style.display = 'none'; }
    const placeholder = element('#preview-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = 'No image candidate captured';
    }
  }

  // Update dynamic connection label & status
  const connLabel = document.querySelector('#connection-provider-label') || document.querySelector('#connection-chatgpt')?.previousElementSibling;
  if (connLabel) {
    connLabel.textContent = providerLabel;
  }
  const isProviderReady = provider.target_bound && provider.tab === 'connected' && provider.auth === 'ready' && provider.dom === 'supported';
  element('#connection-chatgpt').textContent = isProviderReady ? 'ready' : provider.tab;
  element('#connection-rancangloka').textContent = server;
  element('#current-article').textContent = current.article;
  element('#current-slot').textContent = current.slot;
  element('#current-operation').textContent = current.operation;
  element('#current-elapsed').textContent = current.elapsed;
  element('#queue-total').textContent = String(state.counters.totalJobs ?? 0);
  const queueActiveEl = element('#queue-active');
  const executingCount = state.counters.executing ?? state.counters.active ?? 0;
  const reviewCount = state.counters.awaitingReview ?? 0;
  queueActiveEl.textContent = String(executingCount);
  if (queueActiveEl.parentElement) {
    queueActiveEl.parentElement.title = `Executing: ${executingCount}, Awaiting Review: ${reviewCount}`;
  }
  element('#queue-waiting').textContent = String(state.counters.waiting ?? 0);
  element('#queue-complete').textContent = String(state.counters.complete ?? 0);

  // Update Provider Card
  const selectedNameEl = document.querySelector('#provider-selected-name');
  if (selectedNameEl) {
    selectedNameEl.textContent = providerLabel;
  }
  element('#provider-tab').textContent = provider.tab;
  element('#provider-target').textContent = provider.target;
  element('#provider-bound-tab').textContent = provider.bound_tab_id ? String(provider.bound_tab_id) : 'none';
  element('#provider-bound-url').textContent = provider.bound_url ? provider.bound_url.replace(/^https?:\/\//, '') : 'none';
  element('#provider-auth').textContent = provider.auth;
  element('#provider-dom').textContent = provider.dom;
  element('#provider-composer').textContent = provider.composer;
  element('#provider-images').textContent = String(provider.images);
  element('#provider-lane').textContent = provider.lane;

  const bindBtn = element('#bind-tab');
  if (bindBtn) {
    bindBtn.textContent = `Bind Current ${providerLabel} Tab`;
  }
  const activeEnv = state.activeEnvironment || detectEnvironment(state.config?.serverBaseUrl || 'http://localhost:4321');
  const isTokenlessLocal = (activeEnv === 'local' || detectEnvironment(state.config?.serverBaseUrl) === 'local') && !state.config?.deviceToken;
  const envBadge = element('#environment-badge');
  if (envBadge) {
    envBadge.textContent = isTokenlessLocal ? 'LOCAL DEV — TOKENLESS' : activeEnv.toUpperCase();
    envBadge.className = `env-badge env-${activeEnv}`;
  }
  const sysEnv = element('#system-environment');
  if (sysEnv) {
    sysEnv.textContent = isTokenlessLocal ? 'LOCAL DEV — TOKENLESS' : activeEnv.toUpperCase();
  }
  const envSelector = element('#environment-selector');
  if (envSelector && !configDraftDirty) {
    envSelector.value = activeEnv;
  }
  const httpTargetEl = element('#system-http-target');
  if (httpTargetEl) {
    httpTargetEl.textContent = state.config?.serverBaseUrl || '--';
  }
  element('#system-server').textContent = server;
  element('#system-backpressure').textContent = server === 'backpressure' ? 'on' : 'off';

  const currentJobError = workflow.job_error || (state.jobs?.[workflow.job_id]?.last_error ?? null);
  const globalError = state.status.last_error;
  const isGlobalConnectionError = Boolean(
    globalError && /SERVER_UNAVAILABLE|ECONNREFUSED|offline|fetch|HTTP_\d+|backpressure/i.test(globalError)
  );
  const displayError = isGlobalConnectionError
    ? globalError
    : (currentJobError || (globalError === 'PHASE_4B_RUN_CONSUMED' && workflow.is_consumed ? globalError : null));

  element('#system-error').textContent = displayError ?? 'none';
  reconcileStatusBanner(state, workflow, displayError);
  element('#last-action').textContent = state.auditLog?.lastAction ?? 'Idle';
  renderConfigForm(state);
  renderVersionHeader(state);
  renderRunOnce(state, current, provider, server, transfers);
  renderTransfers(transfers);
  renderManualPromotion(state);
}

function renderAuditEvents(events = []) {
  const container = element('#audit-log');
  if (!events.length) {
    container.textContent = 'No audit events';
    return;
  }
  container.textContent = '';
  for (const event of events.slice(-40).reverse()) {
    const row = document.createElement('details');
    row.className = `audit-event audit-${String(event.level || 'INFO').toLowerCase()}`;
    const summary = document.createElement('summary');
    const time = new Date(event.timestamp).toLocaleTimeString([], { hour12: false });
    summary.textContent = `${time} ${event.level} ${event.event_code} ${event.message_safe || ''}`;
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(event, null, 2);
    row.append(summary, pre);
    container.append(row);
  }
}

async function refreshAudit() {
  const response = await send('AUDIT_STATUS', {
    level: element('#audit-filter').value,
    currentRun: element('#audit-current-run').checked,
    currentJob: element('#audit-current-job').checked,
    limit: 100
  });
  renderAuditEvents(response.events);
  if (response.lastAction) element('#last-action').textContent = response.lastAction;
}

function renderConfigForm(state, { force = false } = {}) {
  if (configDraftDirty && !force) return;
  element('#server').value = state.config.serverBaseUrl ?? '';
  element('#enabled').checked = Boolean(state.config.enabled);
  element('#token').value = state.config.deviceToken ?? '';
  const devIdEl = document.querySelector('#device-id');
  if (devIdEl) devIdEl.value = state.config.deviceId ?? 'dev_local_tokenless';
  configInitialized = true;
}

function markConfigDirty() {
  if (!configInitialized) return;
  configDraftDirty = true;
}

function findRecoverableJob(state = {}) {
  const jobs = Object.values(state.jobs ?? {});
  return jobs.find((job) => {
    if (job.local_state === 'COMPLETE' || job.status === 'COMPLETE') return false;
    if (job.local_state === 'CAPTURED' && job.blob_key) return false;
    return isRecoverableResultCheckpoint(job.result_checkpoint, job);
  }) || null;
}

export function getRuntimeVersion() {
  try {
    return chrome?.runtime?.getManifest?.()?.version || null;
  } catch {
    return null;
  }
}

export function renderVersionHeader(state) {
  const runtimeVersion = getRuntimeVersion() || state.runtime_extension_version || EXTENSION_VERSION;
  const expectedVersion = state.expected_extension_version ?? null;
  const versionEl = element('#extension-version');
  const server = normalizeServerStatus(state);
  const isServerOnline = server === 'online';

  let isCurrent = false;
  if (expectedVersion) {
    isCurrent = isVersionCompatible(runtimeVersion, expectedVersion);
    if (isCurrent) {
      versionEl.textContent = isServerOnline
        ? `Extension v${runtimeVersion} — CURRENT`
        : `Extension v${runtimeVersion} — CURRENT (cached)`;
      versionEl.dataset.state = 'current';
    } else {
      versionEl.textContent = `Extension v${runtimeVersion} — RELOAD REQUIRED (Expected v${expectedVersion})`;
      versionEl.dataset.state = 'reload_required';
    }
  } else {
    isCurrent = false;
    versionEl.textContent = `Extension v${runtimeVersion} — UNVERIFIED (Server expected version unknown)`;
    versionEl.dataset.state = 'unverified';
  }

  element('#runtime-version-display').textContent = `v${runtimeVersion}`;
  const bootId = state.runtime_boot_id ? state.runtime_boot_id.replace(/^boot_/, '') : '--';
  element('#runtime-boot-id').textContent = bootId;

  return { runtimeVersion, expectedVersion, isCurrent };
}

function renderRunOnce(state, current, provider, server, transfers = []) {
  const button = element('#run-once');
  const reasonEl = element('#run-once-reason');
  const recoverableJob = findRecoverableJob(state);

  if (recoverableJob) {
    const readyForRecovery =
      state.config.enabled &&
      server === 'online' &&
      provider.tab === 'connected' &&
      provider.auth === 'ready' &&
      provider.dom === 'supported' &&
      provider.lane === 'idle' &&
      state.status?.connection !== 'backpressure';
    button.disabled = !readyForRecovery;
    button.textContent = 'Resume Capture';
    reasonEl.textContent = readyForRecovery ? '' : 'Provider not ready';
    reasonEl.dataset.state = readyForRecovery ? 'ok' : 'disabled';
    return;
  }

  const runtimeVersion = getRuntimeVersion() || state.runtime_extension_version || EXTENSION_VERSION;
  const expectedVersion = state.expected_extension_version ?? null;

  const eligibility = evaluateRunOnceEligibility({
    state,
    current,
    provider,
    server,
    transfers,
    runtimeVersion,
    expectedVersion
  });

  button.disabled = !eligibility.eligible;
  if (eligibility.consumed) {
    button.textContent = eligibility.gate?.outcome === 'complete' ? 'Complete' : eligibility.gate?.outcome === 'needs_attention' ? 'Needs attention' : 'Run consumed';
  } else {
    button.textContent = 'Run Once';
  }

  reasonEl.textContent = eligibility.reason;
  reasonEl.dataset.state = eligibility.eligible ? 'ok' : 'disabled';
}

export async function refresh({ quiet = false } = {}) {
  const windowCtx = await getSidePanelWindowContext();
  const response = await send('STATUS', { windowContext: windowCtx });
  renderState(response.state, windowCtx);
  if (!quiet) setStatus(`Ready: ${Array.from(boot).join(', ')}`);
}

async function saveConfig() {
  const currentConfig = (await send('STATUS')).state?.config || {};
  const devIdInput = document.querySelector('#device-id');
  const deviceId = devIdInput?.value?.trim() || currentConfig.deviceId || 'dev_local_tokenless';
  await send('SAVE_CONFIG', {
    config: {
      ...currentConfig,
      serverBaseUrl: element('#server').value,
      deviceToken: element('#token').value,
      deviceId,
      enabled: element('#enabled').checked
    }
  });
  configDraftDirty = false;
  await refresh();
  renderConfigForm((await send('STATUS')).state, { force: true });
  setStatus('Saved');
}

async function switchBackendEnvironment() {
  const envSelector = element('#environment-selector');
  const targetEnv = envSelector?.value || 'local';
  setStatus(`Switching to ${targetEnv.toUpperCase()} backend...`);
  configDraftDirty = false;
  const response = await send('SWITCH_ENVIRONMENT', { environment: targetEnv }, { timeoutMs: 15000 });
  if (response.ok) {
    setStatus(`Switched to ${targetEnv.toUpperCase()}`);
    if (response.state) {
      renderState(response.state);
      renderConfigForm(response.state, { force: true });
    }
  } else {
    setStatus(boundedError(response.error || response.message || 'Environment switch failed'), true);
  }
}

async function providerCheck() {
  boot.add(SIDE_PANEL_BOOT_FLAGS.PROVIDER_CHECK_AVAILABLE);
  setStatus('Checking provider...');
  const windowCtx = await getSidePanelWindowContext();
  const response = await send('READ_ONLY_PROVIDER_DIAGNOSTIC', {
    windowContext: windowCtx,
    windowId: windowCtx.windowId,
    tabId: windowCtx.tabId
  }, { timeoutMs: 5000 });
  if (response.state) renderState(response.state, windowCtx);
  else await refresh();
  setStatus(response.ok ? 'Provider check complete' : boundedError(response.error), !response.ok);
}

async function bindCurrentTab() {
  setStatus('Detecting active provider tab in window...');
  const windowCtx = await getSidePanelWindowContext();
  const response = await send('BIND_PROVIDER_TAB', {
    tabId: windowCtx.tabId,
    windowId: windowCtx.windowId,
    windowContext: windowCtx
  }, { timeoutMs: 5000 });
  if (response.state) renderState(response.state, windowCtx);
  else await refresh();
  const providerLabel = response.provider === 'GEMINI_BROWSER' ? 'Gemini' : response.provider === 'CHATGPT_BROWSER' ? 'ChatGPT' : 'Provider';
  setStatus(response.ok ? `${providerLabel} tab bound (LOCKED)` : (response.message || boundedError(response.error)), !response.ok);
}

async function runOnce() {
  const runId = `run_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const button = element('#run-once');
  button.disabled = true;

  try {
    const stateRes = await send('STATUS');
    const recoverableJob = findRecoverableJob(stateRes.state || {});

    if (recoverableJob) {
      button.textContent = 'Recovering...';
      setStatus('Recovering generated result...');
      const response = await send('RUN_CHECKPOINT_RECOVERY', { runId, jobId: recoverableJob.job_id }, { timeoutMs: 30000 });
      if (response.state) renderState(response.state);
      setStatus(response.ok ? 'Recovery capture complete' : boundedError(response.error), !response.ok);
      return;
    }

    button.textContent = 'Running...';
    const response = await send('RUN_ONCE', { runId }, { timeoutMs: PROVIDER_OPERATION_TIMEOUT_MS });
    if (response.state) renderState(response.state);
    setStatus(response.ok ? 'Run consumed' : boundedError(response.error), !response.ok);
  } catch (error) {
    setStatus(boundedError(error), true);
  } finally {
    await refresh({ quiet: true });
    await refreshAudit();
  }
}

async function copyPrompt() {
  const promptText = element('#prompt-text').value;
  if (!promptText) return;
  await navigator.clipboard?.writeText(promptText);
  setStatus('Prompt copied to clipboard');
}

async function sendToProvider() {
  const button = element('#send-to-chatgpt');
  button.disabled = true;
  let actionError = null;
  try {
    const providerSelector = element('#provider-selector');
    const selectedProvider = providerSelector ? providerSelector.value : 'CHATGPT_BROWSER';

    if (selectedProvider === 'MANUAL_UPLOAD') {
      document.querySelector('#manual-file-input')?.click();
      button.disabled = false;
      return;
    }

    if (selectedProvider === 'CLOUDFLARE_WORKERS_AI') {
      const promptText = (element('#prompt-text')?.value || '').trim();
      if (!promptText) {
        setStatus('Prompt generation text cannot be empty.', true);
        button.disabled = false;
        return;
      }
      const cfModel = element('#cf-model-selector')?.value || '@cf/black-forest-labs/flux-1-schnell';
      const windowCtx = await getSidePanelWindowContext();
      const statusRes = await send('STATUS', { windowContext: windowCtx });
      const currentJob = resolveCurrentJob(statusRes.state || {});
      const articleId = currentJob?.article_id || 9993;

      setStatus(`Generating with Cloudflare Workers AI (${cfModel.split('/').pop()})...`);
      const serverUrl = element('#server')?.value || 'http://localhost:4321';

      const genRes = await fetch(`${serverUrl}/api/admin/media/generate-cloudflare-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: articleId,
          model: cfModel,
          prompt: promptText,
          media_role: 'featured_hero'
        })
      });

      const genData = await genRes.json();
      if (genData.status === 'success' && genData.candidate) {
        const c = genData.candidate;
        setStatus(`Candidate generated successfully via ${cfModel.split('/').pop()}!`);
        const img = element('#result-preview-image');
        const placeholder = element('#preview-placeholder');
        if (img) {
          img.src = `${serverUrl}${c.public_url}`;
          img.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
        element('#result-dimensions').textContent = c.dimensions;
        element('#result-mime').textContent = c.mime_type;
        element('#result-size').textContent = `${(c.byte_size / 1024).toFixed(1)} KB`;
        element('#result-sha256').textContent = `${c.sha256.slice(0, 16)}...`;
        const provEl = element('#result-provenance');
        if (provEl) provEl.textContent = `Cloudflare AI (${c.model.split('/').pop()})`;
        element('#approve-upload').disabled = false;
        element('#reject-result').disabled = false;
      } else {
        setStatus(`Generation error: ${genData.message || 'Unknown error'}`, true);
      }
      button.disabled = false;
      return;
    }

    const windowCtx = await getSidePanelWindowContext();
    const statusRes = await send('STATUS', { windowContext: windowCtx });
    const auth = resolveAuthoritativeProvider(statusRes.state || {}, windowCtx);
    const currentJob = resolveCurrentJob(statusRes.state || {});
    const providerLabel = auth.providerName || (auth.activeProviderKey === 'gemini' ? 'Gemini' : 'ChatGPT');
    setStatus(`Sending prompt to locked ${providerLabel} tab...`);
    const response = await send('SEND_TO_PROVIDER', {
      provider: auth.activeProviderId,
      jobId: currentJob?.job_id || null
    }, { timeoutMs: PROVIDER_OPERATION_TIMEOUT_MS });
    if (response.state) renderState(response.state, windowCtx);
    if (!response.ok) {
      actionError = boundedError(response.error);
      setStatus(actionError, true);
    } else {
      setStatus(`Prompt submitted to ${providerLabel}`);
    }
  } catch (err) {
    actionError = boundedError(err);
    setStatus(actionError, true);
  } finally {
    await refresh({ quiet: true });
    await refreshAudit();
    if (actionError) setStatus(actionError, true);
  }
}
const sendToChatGpt = sendToProvider;

async function acquireJobLease() {
  const btn = element('#btn-acquire-lease');
  btn.disabled = true;
  setStatus('Acquiring job lease from server...');
  let actionError = null;
  try {
    const windowCtx = await getSidePanelWindowContext();
    const statusRes = await send('STATUS', { windowContext: windowCtx });
    const currentJob = resolveCurrentJob(statusRes.state || {});
    const targetJobId = currentJob?.job_id || null;
    const response = await send('ACQUIRE_JOB_LEASE', { jobId: targetJobId });
    if (response.ok) {
      setStatus('Job lease acquired successfully.');
      if (response.state) renderState(response.state, windowCtx);
      else await refresh();
    } else {
      actionError = boundedError(response.error || response.code || 'Failed to acquire lease');
      setStatus(actionError, true);
    }
  } catch (err) {
    actionError = boundedError(err);
    setStatus(actionError, true);
  } finally {
    btn.disabled = false;
    await refresh({ quiet: true });
    await refreshAudit();
    if (actionError) setStatus(actionError, true);
  }
}

async function captureLatestImage() {
  const button = element('#capture-latest');
  button.disabled = true;
  try {
    const statusRes = await send('STATUS');
    const auth = resolveAuthoritativeProvider(statusRes.state || {});
    const workflow = getJobWorkflowDetails(statusRes.state || {}, statusRes.state?.provider?.[auth.activeProviderKey] || {}, null, auth.providerName);
    const targetJobId = workflow.job_id || statusRes.state?.selectedJobId || statusRes.state?.currentJobId;
    if (!targetJobId) {
      throw new Error('NO_ACTIVE_JOB: Please select an active media job first.');
    }

    if (!promptCandidateReplacement(workflow, 'capture')) {
      setStatus('Capture cancelled; existing candidate preserved', false);
      button.disabled = !workflow.can_capture_latest;
      return;
    }

    setStatus('Capturing latest assistant image from locked tab...');
    const response = await send('CAPTURE_LATEST_IMAGE', { jobId: targetJobId }, { timeoutMs: 30000 });
    if (response.state) renderState(response.state);
    setStatus(response.ok ? 'Latest image captured' : boundedError(response.error), !response.ok);
  } catch (err) {
    setStatus(boundedError(err), true);
  } finally {
    await refresh({ quiet: true });
    await refreshAudit();
  }
}

export function detectImageMime(file, headerBytes) {
  if (headerBytes && headerBytes.length >= 4) {
    // PNG: 89 50 4E 47
    if (headerBytes[0] === 0x89 && headerBytes[1] === 0x50 && headerBytes[2] === 0x4E && headerBytes[3] === 0x47) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (headerBytes[0] === 0xFF && headerBytes[1] === 0xD8 && headerBytes[2] === 0xFF) {
      return 'image/jpeg';
    }
    // WebP: RIFF....WEBP
    if (headerBytes.length >= 12 &&
        headerBytes[0] === 0x52 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46 && headerBytes[3] === 0x46 &&
        headerBytes[8] === 0x57 && headerBytes[9] === 0x45 && headerBytes[10] === 0x42 && headerBytes[11] === 0x50) {
      return 'image/webp';
    }
  }

  const rawType = (file?.type || '').toLowerCase();
  if (rawType === 'image/png') return 'image/png';
  if (rawType === 'image/jpeg' || rawType === 'image/jpg' || rawType === 'image/pjpeg') return 'image/jpeg';
  if (rawType === 'image/webp') return 'image/webp';

  const ext = (file?.name || '').split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'jfif') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';

  return null;
}

export function extractImageDimensionsFromBytes(arrayBuffer, mime) {
  if (!arrayBuffer || arrayBuffer.byteLength < 16) return null;
  const u8 = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A -> IHDR at offset 12..15 -> width @ 16, height @ 20 (big-endian 32-bit)
  if (u8.length >= 24 &&
      u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47 &&
      u8[4] === 0x0D && u8[5] === 0x0A && u8[6] === 0x1A && u8[7] === 0x0A) {
    if (u8[12] === 0x49 && u8[13] === 0x48 && u8[14] === 0x44 && u8[15] === 0x52) { // "IHDR"
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      if (width > 0 && height > 0) return { width, height };
    }
    return null;
  }

  // 2. JPEG: FF D8 FF -> SOF markers
  if (u8.length >= 4 && u8[0] === 0xFF && u8[1] === 0xD8) {
    let offset = 2;
    while (offset < u8.length - 1) {
      if (u8[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = u8[offset + 1];
      if (marker === 0xFF || marker === 0x00) {
        offset++;
        continue;
      }
      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
        offset += 2;
        continue;
      }
      if (offset + 4 > u8.length) break;
      const length = view.getUint16(offset + 2, false);
      const isSof = (marker >= 0xC0 && marker <= 0xC3) ||
                    (marker >= 0xC5 && marker <= 0xC7) ||
                    (marker >= 0xC9 && marker <= 0xCB) ||
                    (marker >= 0xCD && marker <= 0xCF);
      if (isSof && offset + 9 <= u8.length) {
        const height = view.getUint16(offset + 5, false);
        const width = view.getUint16(offset + 7, false);
        if (width > 0 && height > 0) return { width, height };
      }
      offset += 2 + length;
    }
    return null;
  }

  // 3. WebP: "RIFF" .... "WEBP"
  if (u8.length >= 16 &&
      u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
      u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
    const chunkType = String.fromCharCode(u8[12], u8[13], u8[14], u8[15]);

    // Extended WebP: VP8X
    if (chunkType === 'VP8X' && u8.length >= 30) {
      const width = 1 + (u8[24] | (u8[25] << 8) | (u8[26] << 16));
      const height = 1 + (u8[27] | (u8[28] << 8) | (u8[29] << 16));
      if (width > 0 && height > 0) return { width, height };
    }

    // Lossy WebP: VP8
    if (chunkType === 'VP8 ' && u8.length >= 30) {
      if (u8[23] === 0x9D && u8[24] === 0x01 && u8[25] === 0x2A) {
        const width = (view.getUint16(26, true) & 0x3fff);
        const height = (view.getUint16(28, true) & 0x3fff);
        if (width > 0 && height > 0) return { width, height };
      }
    }

    // Lossless WebP: VP8L
    if (chunkType === 'VP8L' && u8.length >= 25) {
      if (u8[20] === 0x2F) {
        const u32 = view.getUint32(21, true);
        const width = 1 + (u32 & 0x3FFF);
        const height = 1 + ((u32 >>> 14) & 0x3FFF);
        if (width > 0 && height > 0) return { width, height };
      }
    }
    return null;
  }

  return null;
}

export async function decodeImageDimensions(arrayBuffer, mime) {
  // Method 1: Deterministic binary header decoding directly from verified raw bytes
  try {
    const headerDims = extractImageDimensionsFromBytes(arrayBuffer, mime);
    if (headerDims && headerDims.width > 0 && headerDims.height > 0) {
      console.info(`[LokaMedia:Import] Decoded dimensions via binary header: ${headerDims.width}x${headerDims.height}`);
      return headerDims;
    }
  } catch (hdrErr) {
    console.warn('[LokaMedia:Import] Binary header parsing error:', hdrErr?.message || hdrErr);
  }

  // Method 2: createImageBitmap with 1000ms timeout
  if (typeof createImageBitmap === 'function') {
    try {
      const blob = new Blob([arrayBuffer], { type: mime || 'image/png' });
      const bmpPromise = createImageBitmap(blob);
      const bmpTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('BITMAP_TIMEOUT')), 1000));
      const bmp = await Promise.race([bmpPromise, bmpTimeout]);
      const width = bmp.width;
      const height = bmp.height;
      bmp.close?.();
      if (width > 0 && height > 0) {
        console.info(`[LokaMedia:Import] Decoded dimensions via createImageBitmap: ${width}x${height}`);
        return { width, height };
      }
    } catch (bmpErr) {
      console.warn('[LokaMedia:Import] createImageBitmap failed or timed out:', bmpErr?.message || bmpErr);
    }
  }

  // Method 3: HTML Image with data: URL (CSP-safe, no blob: URL leakage) with 2000ms timeout
  if (typeof Image !== 'undefined') {
    try {
      const u8 = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < u8.length; i += chunk) {
        binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
      }
      const dataUrl = `data:${mime || 'image/png'};base64,${btoa(binary)}`;
      const dims = await new Promise((resolve, reject) => {
        const img = new Image();
        const timeoutId = setTimeout(() => {
          img.onload = null;
          img.onerror = null;
          reject(new Error('IMG_DECODE_TIMEOUT'));
        }, 2000);
        img.onload = () => {
          clearTimeout(timeoutId);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (w > 0 && h > 0) resolve({ width: w, height: h });
          else reject(new Error('ZERO_DIMENSIONS'));
        };
        img.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error('DECODE_FAILED'));
        };
        img.src = dataUrl;
      });
      if (dims && dims.width > 0 && dims.height > 0) {
        console.info(`[LokaMedia:Import] Decoded dimensions via dataUrl Image: ${dims.width}x${dims.height}`);
        return dims;
      }
    } catch (imgErr) {
      console.warn('[LokaMedia:Import] dataUrl Image decode failed or timed out:', imgErr?.message || imgErr);
    }
  }

  // STRICT REQUIREMENT: Never fabricate or default dimensions. Fail closed!
  throw new Error('IMAGE_DIMENSIONS_DECODE_FAILED: Could not decode verified image dimensions from file bytes');
}

export async function readFileAsArrayBuffer(file) {
  if (typeof file.arrayBuffer === 'function') {
    try {
      const buf = await file.arrayBuffer();
      if (buf && buf.byteLength !== undefined) {
        return buf;
      }
    } catch (bufErr) {
      console.warn('[LokaMedia:Import] file.arrayBuffer() failed, falling back to FileReader:', bufErr?.message || bufErr);
    }
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FILE_READ_FAILED: FileReader failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function ingestCandidatePipeline({ targetJobId, arrayBuffer, mime, width, height, size, provenance, opId = null }) {
  const verifiedWidth = Number(width);
  const verifiedHeight = Number(height);
  if (!Number.isFinite(verifiedWidth) || !Number.isFinite(verifiedHeight) || verifiedWidth <= 0 || verifiedHeight <= 0) {
    throw new Error('INVALID_DIMENSIONS: Verified image dimensions are required');
  }

  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

  // Encode binary to base64 string to avoid huge array serialization across chrome.runtime.sendMessage
  const u8 = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  const base64Bytes = btoa(binary);

  const effectiveOpId = opId || `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  console.info(`[LokaMedia:ImportTrace] [B2:SidePanelIPC] opId=${effectiveOpId} jobId=${targetJobId} sourceSha=${sha256} payloadLen=${base64Bytes.length} encoding=base64`);

  const label = provenance === 'MANUAL_CLIPBOARD' ? 'clipboard image' : 'file candidate';
  setStatus(`Ingesting ${label} (${size || u8.length} bytes)...`);

  console.info(`[LokaMedia:Import] Runtime message dispatched: INGEST_MANUAL_CANDIDATE (jobId: ${targetJobId})`);
  const response = await send('INGEST_MANUAL_CANDIDATE', {
    jobId: targetJobId,
    opId: effectiveOpId,
    bytes: base64Bytes,
    mime,
    width: verifiedWidth,
    height: verifiedHeight,
    size: size || u8.length,
    sha256,
    provenance
  }, { timeoutMs: 30000 });

  const retJob = response.state?.jobs?.[targetJobId];
  const retCand = response.state?.jobOperationalStates?.[targetJobId]?.candidate;
  console.info(`[LokaMedia:ImportTrace] [B6:SidePanelResponse] opId=${effectiveOpId} ok=${response?.ok} returnedJobBlobKey=${retJob?.blob_key} returnedJobSha=${retJob?.sha256} returnedOpBlobKey=${retCand?.blob_key} returnedOpSha=${retCand?.sha256}`);

  if (response.ok) {
    invalidatePreviewCache();
  }
  if (response.state) renderState(response.state);
  if (response.ok) {
    const okMsg = provenance === 'MANUAL_CLIPBOARD'
      ? 'Clipboard image candidate saved & watermarked'
      : 'File candidate saved & watermarked';
    setStatus(okMsg);
  } else {
    const errText = response.error === 'JOB_LEASE_EXPIRED'
      ? "JOB_LEASE_EXPIRED: Lease expired. Click 'Acquire Job Lease' above to renew."
      : boundedError(response.error);
    setStatus(errText, true);
  }
  console.info('[LokaMedia:Import] Result Review refreshed');
  return response;
}

export async function handlePasteImage() {
  const button = element('#paste-image');
  button.disabled = true;
  setStatus('Reading image from clipboard...');
  try {
    const statusRes = await send('STATUS');
    const auth = resolveAuthoritativeProvider(statusRes.state || {});
    const workflow = getJobWorkflowDetails(statusRes.state || {}, statusRes.state?.provider?.[auth.activeProviderKey] || {}, null, auth.providerName);
    const targetJobId = workflow.job_id || statusRes.state?.selectedJobId || statusRes.state?.currentJobId;
    if (!targetJobId) {
      throw new Error('NO_ACTIVE_JOB: Please select an active media job first.');
    }

    if (!promptCandidateReplacement(workflow, 'clipboard image')) {
      setStatus('Paste cancelled; existing candidate preserved', false);
      button.disabled = !workflow.can_paste_image;
      return;
    }

    if (!navigator.clipboard || !navigator.clipboard.read) {
      throw new Error('CLIPBOARD_API_UNAVAILABLE: Clipboard access unavailable in this context. Use "Paste Image" (Ctrl+V) or "Capture Latest Image".');
    }

    let items;
    try {
      items = await navigator.clipboard.read();
    } catch (readErr) {
      if (readErr.name === 'NotAllowedError') {
        throw new Error('CLIPBOARD_PERMISSION_DENIED: Clipboard read permission was denied. Use "Paste Image" (Ctrl+V) or "Capture Latest Image".');
      }
      throw readErr;
    }

    let imageBlob = null;
    for (const item of items) {
      for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
        if (item.types.includes(type)) {
          imageBlob = await item.getType(type);
          break;
        }
      }
      if (imageBlob) break;
    }

    if (!imageBlob) {
      throw new Error('NO_IMAGE_ON_CLIPBOARD: No image found on clipboard. Right-click the generated visual and choose "Copy image", then click "Paste Image" (or press Ctrl+V).');
    }

    const arrayBuffer = await imageBlob.arrayBuffer();
    const { width, height } = await decodeImageDimensions(arrayBuffer, imageBlob.type || 'image/png');

    await ingestCandidatePipeline({
      targetJobId,
      arrayBuffer,
      mime: imageBlob.type || 'image/png',
      width,
      height,
      size: arrayBuffer.byteLength,
      provenance: 'MANUAL_CLIPBOARD'
    });
  } catch (err) {
    setStatus(boundedError(err), true);
  } finally {
    await refresh({ quiet: true });
    await refreshAudit();
  }
}

async function approveAndUpload() {
  const button = element('#approve-upload');
  button.disabled = true;
  setStatus('Approving and uploading media asset...');
  try {
    const response = await send('APPROVE_AND_UPLOAD', {}, { timeoutMs: 60000 });
    if (response.state) renderState(response.state);
    setStatus(response.ok ? 'Upload complete & confirmed' : boundedError(response.error), !response.ok);
  } catch (err) {
    setStatus(boundedError(err), true);
  } finally {
    await refresh({ quiet: true });
    await refreshAudit();
  }
}

export async function rejectResult() {
  const button = element('#reject-result');
  button.disabled = true;
  try {
    const statusRes = await send('STATUS');
    const auth = resolveAuthoritativeProvider(statusRes.state || {});
    const workflow = getJobWorkflowDetails(statusRes.state || {}, statusRes.state?.provider?.[auth.activeProviderKey] || {}, null, auth.providerName);
    const targetJobId = workflow.job_id || statusRes.state?.selectedJobId || statusRes.state?.currentJobId;
    if (!targetJobId) {
      throw new Error('NO_ACTIVE_JOB: Please select an active media job first.');
    }

    if (workflow.preview?.is_uploaded) {
      throw new Error('CANNOT_MUTATE_COMPLETED_JOB: Cannot discard an already uploaded or completed asset.');
    }

    const confirmed = globalThis.confirm
      ? globalThis.confirm('Reset this image? The current unapproved candidate will be discarded. Your media job and previously uploaded assets will remain unchanged.')
      : true;
    if (!confirmed) {
      console.info('[LokaMedia:Reject] Reset cancelled by operator');
      setStatus('Reset cancelled; existing candidate preserved', false);
      button.disabled = !workflow.can_reject;
      return;
    }

    setStatus('Resetting image (zero uploads)...');
    const response = await send('REJECT_RESULT', { jobId: targetJobId }, { timeoutMs: 15000 });

    currentLoadedBlobKey = null;
    const img = element('#result-preview-image');
    if (img) {
      img.src = '';
      img.style.display = 'none';
    }
    const placeholder = element('#preview-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = 'No image candidate captured';
    }

    if (response.state) renderState(response.state);
    setStatus(response.ok ? 'Image reset (candidate discarded, media job preserved)' : boundedError(response.error), !response.ok);
  } catch (err) {
    setStatus(boundedError(err), true);
  } finally {
    await refresh({ quiet: true });
    await refreshAudit();
  }
}

// Import File feature retired by owner decision (2026-10-22).
// Paste Image remains the primary manual fallback for candidate intake.
export function selectLocalFile() {
  setStatus('Import File retired by owner decision; use Paste Image (Ctrl+V)', false);
}

export async function handleLocalFileChosen() {
  setStatus('Import File retired by owner decision; use Paste Image (Ctrl+V)', false);
}

function assignFeatured() {
  setStatus('Featured-image assignment remains a controlled action in a future milestone.');
}

async function copyAuditLog() {
  const response = await send('AUDIT_COPY_TEXT');
  await navigator.clipboard?.writeText(response.text);
  setStatus('Audit copied');
}

async function copyDiagnosticSnapshot() {
  const button = element('#btn-copy-diagnostic-snapshot');
  button.disabled = true;
  button.textContent = 'Collecting snapshot...';
  const statusEl = document.querySelector('#snapshot-status');
  const fallbackBox = document.querySelector('#snapshot-fallback-container');
  const fallbackText = document.querySelector('#snapshot-fallback-text');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--muted)';
    statusEl.textContent = 'Collecting fresh read-only state...';
  }
  try {
    const windowCtx = await getSidePanelWindowContext();
    let res = null;
    try {
      res = await send('GET_DIAGNOSTIC_SNAPSHOT', { windowContext: windowCtx }, { timeoutMs: 5000 });
    } catch {
      const stateRes = await send('STATUS', { windowContext: windowCtx }, { timeoutMs: 3000 }).catch(() => ({}));
      const snapshot = await collectDiagnosticSnapshot({
        state: stateRes?.state || {},
        windowContext: windowCtx,
        doc: document,
        manifestVersion: getRuntimeVersion()
      });
      res = { ok: true, snapshot, text: formatDiagnosticSnapshotText(snapshot) };
    }

    if (!res?.text) {
      throw new Error(res?.error || 'SNAPSHOT_COLLECTION_FAILED');
    }

    const text = res.text;
    if (fallbackText) fallbackText.value = text;

    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (clipErr) {
        console.warn('Clipboard writeText failed', clipErr);
      }
    }

    if (copied) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#15803d';
        statusEl.textContent = 'Diagnostic snapshot copied to clipboard (ready to paste into ChatGPT)';
      }
      if (fallbackBox) fallbackBox.style.display = 'none';
      setStatus('Diagnostic snapshot copied', false);
    } else {
      if (fallbackBox) fallbackBox.style.display = 'block';
      if (fallbackText) {
        fallbackText.focus();
        fallbackText.select();
      }
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#b45309';
        statusEl.textContent = 'Clipboard write blocked by browser. Please copy from text box below:';
      }
      setStatus('Copy snapshot manually below', false);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#b91c1c';
      statusEl.textContent = `Snapshot error: ${err.message || err}`;
    }
    setStatus('Snapshot collection failed', true);
  } finally {
    button.disabled = false;
    button.textContent = 'Copy Diagnostic Snapshot';
  }
}

async function exportAuditJson() {
  const response = await send('AUDIT_EXPORT_JSON');
  const blob = new Blob([JSON.stringify(response.payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lokamedia-audit-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus('Audit exported');
}

async function clearAuditLog() {
  await send('AUDIT_CLEAR');
  await refreshAudit();
  setStatus('Audit cleared');
}

function bindSidePanel() {
  if (bound) return;
  const validation = validateSidePanelElements(document);
  if (!validation.ok) throw new Error(`SIDE_PANEL_DOM_BIND_FAILED:${validation.missing.join(',')}`);

  const runtimeVer = getRuntimeVersion();
  const versionBadge = element('#extension-version');
  if (versionBadge && runtimeVer) {
    versionBadge.textContent = `Extension v${runtimeVer}`;
  }
  const runtimeDisplay = element('#runtime-version-display');
  if (runtimeDisplay && runtimeVer) {
    runtimeDisplay.textContent = `v${runtimeVer}`;
  }

  const jobSelector = element('#job-selector');
  if (jobSelector) {
    jobSelector.addEventListener('change', async (e) => {
      const jobId = e.target.value || null;
      await send('SELECT_JOB', { jobId });
      await refresh();
    });
  }

  const copyDiagBtn = element('#btn-copy-diagnostic-snapshot');
  if (copyDiagBtn) {
    copyDiagBtn.addEventListener('click', () => {
      void copyDiagnosticSnapshot().catch((err) => setStatus(boundedError(err), true));
    });
  }
  element('#enabled').addEventListener('change', () => {
    markConfigDirty();
    setStatus(element('#enabled').checked ? 'Enabled selected; save required' : 'Paused selected; save required');
  });
  element('#server').addEventListener('input', markConfigDirty);
  element('#token').addEventListener('input', markConfigDirty);
  const devIdInput = document.querySelector('#device-id');
  if (devIdInput) devIdInput.addEventListener('input', markConfigDirty);
  element('#save').addEventListener('click', () => {
    void saveConfig().catch((error) => setStatus(boundedError(error), true));
  });
  const switchEnvBtn = document.querySelector('#btn-switch-environment');
  if (switchEnvBtn) {
    switchEnvBtn.addEventListener('click', () => {
      void switchBackendEnvironment().catch((err) => setStatus(boundedError(err), true));
    });
  }
  element('#diagnostic').addEventListener('click', () => {
    void providerCheck().catch((error) => setStatus(boundedError(error), true));
  });
  element('#bind-tab').addEventListener('click', () => {
    void bindCurrentTab().catch((error) => setStatus(boundedError(error), true));
  });
  element('#run-once').addEventListener('click', () => {
    void runOnce().catch((error) => setStatus(boundedError(error), true));
  });
  element('#copy-prompt').addEventListener('click', () => {
    void copyPrompt().catch((error) => setStatus(boundedError(error), true));
  });
  const acquireBtn = element('#btn-acquire-lease');
  if (acquireBtn) {
    acquireBtn.addEventListener('click', () => {
      void acquireJobLease().catch((error) => setStatus(boundedError(error), true));
    });
  }
  const providerSelector = element('#provider-selector');
  const cfModelRow = element('#cf-model-row');
  const sendBtn = element('#send-to-chatgpt');

  function updateProviderUi() {
    if (!providerSelector) return;
    const selected = providerSelector.value;
    if (selected === 'CLOUDFLARE_WORKERS_AI') {
      if (cfModelRow) cfModelRow.style.display = 'flex';
      if (sendBtn) {
        sendBtn.textContent = 'Generate with Cloudflare AI';
        sendBtn.disabled = false;
      }
    } else if (selected === 'MANUAL_UPLOAD') {
      if (cfModelRow) cfModelRow.style.display = 'none';
      if (sendBtn) {
        sendBtn.textContent = 'Select Local File';
        sendBtn.disabled = false;
      }
    } else if (selected === 'GEMINI_BROWSER') {
      if (cfModelRow) cfModelRow.style.display = 'none';
      if (sendBtn) sendBtn.textContent = 'Send to Gemini';
    } else {
      if (cfModelRow) cfModelRow.style.display = 'none';
      if (sendBtn) sendBtn.textContent = 'Send to ChatGPT';
    }
  }

  if (providerSelector) {
    providerSelector.addEventListener('change', updateProviderUi);
    updateProviderUi();
  }

  element('#send-to-chatgpt').addEventListener('click', () => {
    void sendToChatGpt().catch((error) => setStatus(boundedError(error), true));
  });
  element('#capture-latest').addEventListener('click', () => {
    void captureLatestImage().catch((error) => setStatus(boundedError(error), true));
  });
  const pasteBtn = document.querySelector('#paste-image');
  if (pasteBtn) {
    pasteBtn.addEventListener('click', () => {
      void handlePasteImage().catch((error) => setStatus(boundedError(error), true));
    });
  }
  element('#approve-upload').addEventListener('click', () => {
    void approveAndUpload().catch((error) => setStatus(boundedError(error), true));
  });
  element('#reject-result').addEventListener('click', () => {
    void rejectResult().catch((error) => setStatus(boundedError(error), true));
  });

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        const activeEl = document.activeElement;
        const tag = activeEl?.tagName?.toLowerCase();
        if (tag === 'textarea' || (tag === 'input' && activeEl?.type === 'text')) {
          return;
        }
        e.preventDefault?.();
        void handlePasteImage().catch((error) => setStatus(boundedError(error), true));
      }
    });
  }
  element('#assign-featured').addEventListener('click', () => {
    assignFeatured();
  });
  element('#audit-filter').addEventListener('change', () => {
    void refreshAudit().catch((error) => setStatus(boundedError(error), true));
  });
  element('#audit-current-run').addEventListener('change', () => {
    void refreshAudit().catch((error) => setStatus(boundedError(error), true));
  });
  element('#audit-current-job').addEventListener('change', () => {
    void refreshAudit().catch((error) => setStatus(boundedError(error), true));
  });
  element('#audit-copy').addEventListener('click', () => {
    void copyAuditLog().catch((error) => setStatus(boundedError(error), true));
  });
  element('#audit-export').addEventListener('click', () => {
    void exportAuditJson().catch((error) => setStatus(boundedError(error), true));
  });
  element('#audit-clear').addEventListener('click', () => {
    void clearAuditLog().catch((error) => setStatus(boundedError(error), true));
  });

  const manualResolveBtn = document.querySelector('#manual-btn-resolve');
  if (manualResolveBtn) {
    manualResolveBtn.addEventListener('click', () => {
      void resolveManualArticle().catch((err) => setStatus(boundedError(err), true));
    });
  }
  const manualSelectBtn = document.querySelector('#manual-btn-select-file');
  if (manualSelectBtn) {
    manualSelectBtn.addEventListener('click', () => {
      document.querySelector('#manual-file-input')?.click();
    });
  }
  const manualFileInput = document.querySelector('#manual-file-input');
  if (manualFileInput) {
    manualFileInput.addEventListener('change', (e) => {
      void handleManualFileChosen(e).catch((err) => setStatus(boundedError(err), true));
    });
  }
  const manualAltInput = document.querySelector('#manual-alt-text');
  if (manualAltInput) {
    manualAltInput.addEventListener('input', (e) => {
      const val = (e.target.value || '').trim();
      void send('MANUAL_PROMOTION_SET_ALT_TEXT', { alt_text: val }).then((res) => {
        if (res.state) {
          renderState(res.state);
          renderManualPromotion(res.state);
        }
      }).catch(() => {});
    });
  }
  const manualApproveBtn = document.querySelector('#manual-btn-approve');
  if (manualApproveBtn) {
    manualApproveBtn.addEventListener('click', () => {
      void approveManualPromotion().catch((err) => setStatus(boundedError(err), true));
    });
  }
  const manualCheckStatusBtn = document.querySelector('#manual-btn-check-status');
  if (manualCheckStatusBtn) {
    manualCheckStatusBtn.addEventListener('click', () => {
      void checkManualPromotionStatus().catch((err) => setStatus(boundedError(err), true));
    });
  }
  const manualExecuteBtn = document.querySelector('#manual-btn-execute');
  if (manualExecuteBtn) {
    manualExecuteBtn.addEventListener('click', () => {
      void executeManualPromotion().catch((err) => setStatus(boundedError(err), true));
    });
  }
  const manualResetBtn = document.querySelector('#manual-btn-reset');
  if (manualResetBtn) {
    manualResetBtn.addEventListener('click', () => {
      void resetManualPromotion().catch((err) => setStatus(boundedError(err), true));
    });
  }

  bound = true;
  boot.add(SIDE_PANEL_BOOT_FLAGS.DOM_BOUND);
}

export function renderManualPromotion(state) {
  const promoCard = document.querySelector('#manual-promotion-card');
  if (!promoCard) return;
  const promo = state?.manualPromotionState;
  const target = promo?.targetArticle;
  const candidate = promo?.candidate;
  const approval = promo?.approval;
  const stage = promo?.stage || 'IDLE';

  const attestationEl = document.querySelector('#manual-article-attestation');
  if (attestationEl) {
    if (target) {
      attestationEl.style.display = 'block';
      const slugInput = document.querySelector('#manual-article-slug');
      if (slugInput && target.slug && !slugInput.value) {
        slugInput.value = target.slug;
      }
      const titleEl = document.querySelector('#manual-article-title');
      if (titleEl) titleEl.textContent = target.title || '--';
      const statusEl = document.querySelector('#manual-article-status');
      if (statusEl) statusEl.textContent = target.status || '--';
      const hashEl = document.querySelector('#manual-article-hash');
      if (hashEl) hashEl.textContent = target.content_hash ? `${target.content_hash.slice(0, 16)}...` : '--';
      const featEl = document.querySelector('#manual-current-featured');
      if (featEl) featEl.textContent = target.featured_image || 'None';
    } else {
      attestationEl.style.display = 'none';
    }
  }

  const previewBox = document.querySelector('#manual-candidate-preview-box');
  if (previewBox) {
    if (candidate) {
      previewBox.style.display = 'block';
      const imgEl = document.querySelector('#manual-preview-image');
      if (imgEl) {
        if (candidate.data_url) {
          imgEl.src = candidate.data_url;
          imgEl.style.display = 'inline-block';
        } else if (candidate.blob_key) {
          void send('GET_BLOB_PREVIEW', { key: candidate.blob_key }).then((res) => {
            if (res?.ok && res.dataUrl) {
              imgEl.src = res.dataUrl;
              imgEl.style.display = 'inline-block';
            }
          }).catch(() => {});
        } else {
          imgEl.style.display = 'none';
        }
      }
      const filenameEl = document.querySelector('#manual-candidate-filename');
      if (filenameEl) filenameEl.textContent = candidate.filename || '--';
      const dimEl = document.querySelector('#manual-candidate-dimensions');
      if (dimEl) dimEl.textContent = `${candidate.width} × ${candidate.height}`;
      const mimeEl = document.querySelector('#manual-candidate-mime');
      if (mimeEl) mimeEl.textContent = candidate.mime;
      const sizeEl = document.querySelector('#manual-candidate-size');
      if (sizeEl) sizeEl.textContent = `${Number(candidate.size).toLocaleString('en-US')} bytes`;
      const shaEl = document.querySelector('#manual-candidate-sha');
      if (shaEl) shaEl.textContent = candidate.sha256 ? `${candidate.sha256.slice(0, 16)}...` : '--';
    } else {
      previewBox.style.display = 'none';
    }
  }

  const btnApprove = document.querySelector('#manual-btn-approve');
  const btnCheckStatus = document.querySelector('#manual-btn-check-status');
  const btnExecute = document.querySelector('#manual-btn-execute');
  const bannerEl = document.querySelector('#manual-status-banner');

  const altInput = document.querySelector('#manual-alt-text');
  if (altInput && document.activeElement !== altInput) {
    altInput.value = promo?.candidate?.alt_text || promo?.alt_text || '';
  }
  const currentAlt = (altInput?.value || promo?.candidate?.alt_text || promo?.alt_text || '').trim();
  const isAltTextValid = currentAlt.length >= 3 && currentAlt.length <= 500;

  const isArticleAttested = Boolean(target && target.slug && target.id && target.content_hash);
  const isCandidateValid = Boolean(
    candidate &&
    typeof candidate.sha256 === 'string' &&
    candidate.sha256.length === 64 &&
    Number(candidate.width) > 0 &&
    Number(candidate.height) > 0 &&
    Number(candidate.size) > 0 &&
    ['image/webp', 'image/png', 'image/jpeg'].includes(candidate.mime)
  );
  const isApproved = Boolean(approval);

  const isExpired = Boolean(
    approval?.expires_at && Date.now() > new Date(approval.expires_at).getTime()
  );
  const effectiveStage = isExpired && (stage === 'APPROVED' || stage === 'WAITING_FOR_ADMIN_APPROVAL')
    ? 'APPROVAL_EXPIRED'
    : stage;

  if (bannerEl) {
    if (promo?.lastError) {
      bannerEl.style.display = 'block';
      bannerEl.style.color = 'var(--danger)';
      bannerEl.textContent = `Error: ${promo.lastError}`;
    } else if (effectiveStage === 'APPROVAL_EXPIRED') {
      bannerEl.style.display = 'block';
      bannerEl.style.color = 'var(--danger)';
      bannerEl.textContent = 'APPROVAL_EXPIRED — Persetujuan telah kedaluwarsa. Silakan ajukan persetujuan baru.';
    } else if (stage === 'WAITING_FOR_ADMIN_APPROVAL') {
      bannerEl.style.display = 'block';
      bannerEl.style.color = '#eab308';
      bannerEl.textContent = 'WAITING FOR HUMAN ADMIN APPROVAL — Buka /admin/media-promotions';
    } else if (stage === 'APPROVED') {
      bannerEl.style.display = 'block';
      bannerEl.style.color = '#22c55e';
      bannerEl.textContent = 'ADMIN APPROVED — Siap untuk dipromosikan ke Featured';
    } else if (stage === 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING') {
      bannerEl.style.display = 'block';
      bannerEl.style.color = '#eab308';
      bannerEl.textContent = 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING — Ready to register asset';
    } else if (stage === 'ASSET_REGISTERED_ATTACHMENT_PENDING') {
      bannerEl.style.display = 'block';
      bannerEl.style.color = '#eab308';
      bannerEl.textContent = 'ASSET_REGISTERED_ATTACHMENT_PENDING — Ready to attach featured media';
    } else if (stage === 'COMPLETE') {
      bannerEl.style.display = 'block';
      bannerEl.style.color = '#22c55e';
      bannerEl.textContent = 'Manual media promotion complete & confirmed';
    } else {
      bannerEl.style.display = 'none';
    }
  }

  if (effectiveStage === 'APPROVAL_EXPIRED') {
    if (btnExecute) btnExecute.style.display = 'none';
    if (btnCheckStatus) btnCheckStatus.style.display = 'none';
    if (btnApprove) {
      btnApprove.style.display = 'block';
      btnApprove.disabled = !(isArticleAttested && isCandidateValid && isAltTextValid);
      btnApprove.textContent = 'Request Promotion Approval';
    }
  } else if (stage === 'WAITING_FOR_ADMIN_APPROVAL') {
    if (btnApprove) btnApprove.style.display = 'none';
    if (btnCheckStatus) {
      btnCheckStatus.style.display = 'block';
      btnCheckStatus.disabled = false;
    }
    if (btnExecute) btnExecute.style.display = 'none';
  } else if (stage === 'APPROVED' || stage === 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING' || stage === 'ASSET_REGISTERED_ATTACHMENT_PENDING') {
    if (btnApprove) btnApprove.style.display = 'none';
    if (btnCheckStatus) btnCheckStatus.style.display = 'none';
    if (btnExecute) {
      btnExecute.style.display = 'block';
      btnExecute.disabled = false;
      btnExecute.textContent = stage === 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING'
        ? 'Retry Asset Registration'
        : stage === 'ASSET_REGISTERED_ATTACHMENT_PENDING'
          ? 'Retry Featured Attachment'
          : 'Promote to Featured';
    }
  } else {
    if (btnCheckStatus) btnCheckStatus.style.display = 'none';
    if (btnExecute) btnExecute.style.display = 'none';
    if (btnApprove) {
      btnApprove.style.display = 'block';
      btnApprove.disabled = !(isArticleAttested && isCandidateValid && isAltTextValid && !isApproved);
      btnApprove.textContent = 'Request Promotion Approval';
    }
  }
}

async function resolveManualArticle() {
  const slugInput = document.querySelector('#manual-article-slug');
  const slug = slugInput?.value?.trim();
  if (!slug) {
    setStatus('Article slug required', true);
    return;
  }
  setStatus('Resolving article...');
  const res = await send('MANUAL_PROMOTION_RESOLVE_ARTICLE', { slug });
  if (res.state) renderState(res.state);
  setStatus(res.ok ? 'Article resolved' : boundedError(res.error), !res.ok);
}

async function handleManualFileChosen(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  setStatus('Reading local image...');
  try {
    const supportedMimes = new Set(['image/webp', 'image/png', 'image/jpeg']);
    if (!supportedMimes.has(file.type)) {
      throw new Error(`LOCAL_FILE_UNSUPPORTED_MIME: File type "${file.type || 'unknown'}" is not supported (use WebP, PNG, or JPEG)`);
    }
    if (!file.size || file.size <= 0) {
      throw new Error('LOCAL_FILE_EMPTY: Selected file is empty');
    }

    let arrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (readErr) {
      throw new Error(`LOCAL_FILE_READ_FAILED: ${readErr?.message || 'Unable to read file'}`);
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const sha256 = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('LOCAL_FILE_READ_FAILED: FileReader failed'));
      reader.readAsDataURL(file);
    });

    const dimensions = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w > 0 && h > 0) {
          resolve({ width: w, height: h });
        } else {
          reject(new Error('LOCAL_FILE_INVALID_DIMENSIONS: Image dimensions must be greater than 0'));
        }
      };
      img.onerror = () => reject(new Error('LOCAL_FILE_IMAGE_DECODE_FAILED: Could not decode image data'));
      img.src = dataUrl;
    });

    const bytesArray = Array.from(new Uint8Array(arrayBuffer));
    const res = await send('MANUAL_PROMOTION_SET_FILE', {
      filename: file.name,
      bytes: bytesArray,
      mime: file.type,
      width: dimensions.width,
      height: dimensions.height,
      size: file.size,
      sha256,
      dataUrl
    });

    if (res.state) {
      renderState(res.state);
      renderManualPromotion(res.state);
    }
    if (!res.ok) {
      const errReason = res.error ? `LOCAL_FILE_INGEST_FAILED: ${res.error}` : 'LOCAL_FILE_INGEST_FAILED';
      setStatus(errReason, true);
    } else {
      setStatus('Local candidate ready');
    }
  } catch (err) {
    const message = err?.message || String(err);
    const friendlyError = message.startsWith('LOCAL_FILE_') ? message : `LOCAL_FILE_READ_FAILED: ${message}`;
    setStatus(friendlyError, true);
  } finally {
    event.target.value = '';
    await refresh({ quiet: true });
  }
}

async function approveManualPromotion() {
  const altInput = document.querySelector('#manual-alt-text');
  const altText = (altInput?.value || '').trim();
  if (!altText) {
    setStatus('Alt Text wajib diisi sebelum meminta persetujuan!', true);
    return;
  }
  setStatus('Membuat permintaan promosi...');
  const res = await send('MANUAL_PROMOTION_APPROVE', { alt_text: altText });
  if (res.state) renderState(res.state);
  setStatus(res.ok ? 'Menunggu persetujuan admin...' : boundedError(res.error), !res.ok);
}

async function checkManualPromotionStatus() {
  setStatus('Memeriksa status persetujuan admin...');
  const res = await send('MANUAL_PROMOTION_CHECK_STATUS');
  if (res.state) renderState(res.state);
  if (res.ok && res.status === 'APPROVED') {
    setStatus('Persetujuan admin dikonfirmasi!');
  } else if (res.ok) {
    setStatus(`Status promosi: ${res.status}`);
  } else {
    setStatus(boundedError(res.error), true);
  }
}

async function executeManualPromotion() {
  const btnExecute = document.querySelector('#manual-btn-execute');
  if (btnExecute) btnExecute.disabled = true;
  setStatus('Executing promotion...');
  try {
    const res = await send('MANUAL_PROMOTION_EXECUTE', {}, { timeoutMs: 30000 });
    if (res.state) {
      renderState(res.state);
      renderManualPromotion(res.state);
    }
    setStatus(res.ok ? 'Manual promotion complete' : boundedError(res.error), !res.ok);
  } catch (err) {
    setStatus(boundedError(err), true);
    await refresh({ quiet: true });
  } finally {
    if (btnExecute) btnExecute.disabled = false;
  }
}

async function resetManualPromotion() {
  const res = await send('MANUAL_PROMOTION_RESET');
  if (res.state) renderState(res.state);
  const slugInput = document.querySelector('#manual-article-slug');
  if (slugInput) slugInput.value = '';
  const altInput = document.querySelector('#manual-alt-text');
  if (altInput) altInput.value = '';
  setStatus('Manual promotion reset');
}

if (typeof document !== 'undefined') {
  try {
    bindSidePanel();
    void refresh().catch((error) => setStatus(boundedError(error), true));
    void refreshAudit().catch(() => {});
    refreshTimer = setInterval(() => {
      void refresh({ quiet: true }).catch(() => {});
    }, 5000);
    refreshTimer.unref?.();
    globalThis.addEventListener?.('pagehide', () => {
      if (refreshTimer) clearInterval(refreshTimer);
    });

    if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
      try {
        chrome.tabs.onActivated.addListener(() => {
          void refresh({ quiet: true }).catch(() => {});
        });
      } catch {}
    }
    if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
      try {
        chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
          if (changeInfo.status === 'complete' || changeInfo.url) {
            void refresh({ quiet: true }).catch(() => {});
          }
        });
      } catch {}
    }
    if (typeof chrome !== 'undefined' && chrome.windows?.onFocusChanged) {
      try {
        chrome.windows.onFocusChanged.addListener(() => {
          void refresh({ quiet: true }).catch(() => {});
        });
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        void refresh({ quiet: true }).catch(() => {});
      });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void refresh({ quiet: true }).catch(() => {});
        }
      });
    }
  } catch (error) {
    setStatus(boundedError(error), true);
  }
}
