import {
  SIDE_PANEL_BOOT_FLAGS,
  evaluateRunOnceEligibility,
  getJobWorkflowDetails,
  normalizeProviderStatus,
  normalizeServerStatus,
  summarizeCurrentJob,
  summarizeTransfers,
  validateSidePanelElements
} from './popup-core.js';
import { isRecoverableResultCheckpoint } from './providers/chatgpt/correlation.js';
import { PROVIDER_OPERATION_TIMEOUT_MS } from './constants.js';

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
  return message.replace(/[^\w:.-]/g, '_').slice(0, 80);
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

async function loadPreviewImage(blobKey, preview = null) {
  if (!blobKey) return;
  if (currentLoadedBlobKey === blobKey) return;
  try {
    const res = await send('GET_BLOB_PREVIEW', { key: blobKey });
    if (res.ok && res.dataUrl) {
      currentLoadedBlobKey = blobKey;
      const img = element('#result-preview-image');
      img.src = res.dataUrl;
      img.style.display = 'block';
      element('#preview-placeholder').style.display = 'none';
      return;
    }
  } catch {}
  currentLoadedBlobKey = null;
  const img = element('#result-preview-image');
  img.style.display = 'none';
  const placeholder = element('#preview-placeholder');
  placeholder.style.display = 'block';
  if (preview?.is_uploaded) {
    placeholder.textContent = `Asset uploaded and verified (${preview.short_sha256})`;
  } else if (preview?.available) {
    placeholder.textContent = `Candidate captured (${preview.short_sha256})`;
  } else {
    placeholder.textContent = 'No image candidate captured';
  }
}

function renderState(state) {
  const provider = normalizeProviderStatus(state.provider?.chatgpt ?? {});
  const server = normalizeServerStatus(state);
  const current = summarizeCurrentJob(state);
  const transfers = summarizeTransfers(state);
  const workflow = getJobWorkflowDetails(state, state.provider?.chatgpt ?? {});

  // UX-2 Workflow Stage
  element('#workflow-stage').textContent = workflow.stage;
  element('#workflow-guidance').textContent = workflow.guidance;

  // UX-2 Prompt Preview
  element('#prompt-article-title').textContent = workflow.article_title;
  element('#prompt-slot').textContent = workflow.slot;
  element('#prompt-dimensions').textContent = workflow.target_dimensions;
  element('#prompt-text').value = workflow.prompt;
  element('#copy-prompt').disabled = !workflow.can_copy;
  const sendBtn = element('#send-to-chatgpt');
  sendBtn.disabled = !workflow.can_send;
  sendBtn.title = workflow.send_reason || '';

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
  element('#reject-result').disabled = !workflow.can_reject;
  element('#approve-upload').disabled = !workflow.can_approve_upload;
  element('#assign-featured').disabled = !workflow.can_assign_featured;

  if (workflow.preview?.available) {
    element('#result-dimensions').textContent = workflow.preview.dimensions || '--';
    element('#result-mime').textContent = workflow.preview.mime || '--';
    element('#result-size').textContent = workflow.preview.size || '--';
    element('#result-sha256').textContent = workflow.preview.short_sha256 || '--';

    if (workflow.preview.blob_key) {
      void loadPreviewImage(workflow.preview.blob_key, workflow.preview);
    } else {
      currentLoadedBlobKey = null;
      element('#result-preview-image').style.display = 'none';
      const placeholder = element('#preview-placeholder');
      placeholder.style.display = 'block';
      placeholder.textContent = workflow.preview.is_uploaded
        ? `Asset uploaded and verified (${workflow.preview.short_sha256})`
        : `Candidate captured (${workflow.preview.short_sha256})`;
    }
  } else {
    element('#result-dimensions').textContent = '--';
    element('#result-mime').textContent = '--';
    element('#result-size').textContent = '--';
    element('#result-sha256').textContent = '--';

    currentLoadedBlobKey = null;
    element('#result-preview-image').style.display = 'none';
    const placeholder = element('#preview-placeholder');
    placeholder.style.display = 'block';
    placeholder.textContent = 'No image candidate captured';
  }

  element('#connection-chatgpt').textContent = provider.auth === 'ready' && provider.dom === 'supported' ? 'ready' : provider.tab;
  element('#connection-rancangloka').textContent = server;
  element('#current-article').textContent = current.article;
  element('#current-slot').textContent = current.slot;
  element('#current-operation').textContent = current.operation;
  element('#current-elapsed').textContent = current.elapsed;
  element('#queue-total').textContent = String(state.counters.totalJobs ?? 0);
  element('#queue-active').textContent = String(state.counters.active ?? 0);
  element('#queue-waiting').textContent = String(state.counters.waiting ?? 0);
  element('#queue-complete').textContent = String(state.counters.complete ?? 0);
  element('#provider-tab').textContent = provider.tab;
  element('#provider-target').textContent = provider.target;
  element('#provider-bound-tab').textContent = provider.bound_tab_id ? String(provider.bound_tab_id) : 'none';
  element('#provider-bound-url').textContent = provider.bound_url ? provider.bound_url.replace(/^https?:\/\//, '') : 'none';
  element('#provider-auth').textContent = provider.auth;
  element('#provider-dom').textContent = provider.dom;
  element('#provider-composer').textContent = provider.composer;
  element('#provider-images').textContent = String(provider.images);
  element('#provider-lane').textContent = provider.lane;
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
  if (state.config.deviceToken) element('#token').value = state.config.deviceToken;
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

function getRuntimeVersion() {
  try {
    return chrome.runtime?.getManifest?.()?.version || null;
  } catch {
    return null;
  }
}

export function renderVersionHeader(state) {
  const runtimeVersion = getRuntimeVersion() || state.runtime_extension_version || '0.1.10';
  const expectedVersion = state.expected_extension_version ?? null;
  const versionEl = element('#extension-version');
  const server = normalizeServerStatus(state);
  const isServerOnline = server === 'online';

  let isCurrent = false;
  if (expectedVersion) {
    isCurrent = runtimeVersion === expectedVersion;
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

  const runtimeVersion = getRuntimeVersion() || state.runtime_extension_version || '0.1.10';
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

async function refresh({ quiet = false } = {}) {
  const response = await send('STATUS');
  renderState(response.state);
  if (!quiet) setStatus(`Ready: ${Array.from(boot).join(', ')}`);
}

async function saveConfig() {
  await send('SAVE_CONFIG', {
    config: {
      serverBaseUrl: element('#server').value,
      deviceToken: element('#token').value,
      deviceId: 'dev_chr_local',
      enabled: element('#enabled').checked
    }
  });
  configDraftDirty = false;
  const response = await send('STATUS');
  renderState(response.state);
  renderConfigForm(response.state, { force: true });
  setStatus('Saved');
}

async function providerCheck() {
  boot.add(SIDE_PANEL_BOOT_FLAGS.PROVIDER_CHECK_AVAILABLE);
  setStatus('Checking provider...');
  const response = await send('READ_ONLY_PROVIDER_DIAGNOSTIC', {}, { timeoutMs: 5000 });
  if (response.state) renderState(response.state);
  else await refresh();
  setStatus(response.ok ? 'Provider check complete' : boundedError(response.error), !response.ok);
}

async function bindCurrentTab() {
  setStatus('Binding current ChatGPT tab...');
  let activeTabId = null;
  try {
    const tabs = await chrome.tabs?.query?.({ active: true, lastFocusedWindow: true });
    if (tabs?.[0]?.id != null) activeTabId = tabs[0].id;
  } catch {}
  const response = await send('BIND_PROVIDER_TAB', { tabId: activeTabId }, { timeoutMs: 5000 });
  if (response.state) renderState(response.state);
  else await refresh();
  setStatus(response.ok ? 'ChatGPT tab bound (LOCKED)' : (response.message || boundedError(response.error)), !response.ok);
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

async function sendToChatGpt() {
  const button = element('#send-to-chatgpt');
  button.disabled = true;
  setStatus('Sending prompt to locked ChatGPT tab...');
  try {
    const response = await send('SEND_TO_CHATGPT', {}, { timeoutMs: PROVIDER_OPERATION_TIMEOUT_MS });
    if (response.state) renderState(response.state);
    setStatus(response.ok ? 'Prompt submitted to ChatGPT' : boundedError(response.error), !response.ok);
  } catch (err) {
    setStatus(boundedError(err), true);
  } finally {
    await refresh({ quiet: true });
    await refreshAudit();
  }
}

async function captureLatestImage() {
  const button = element('#capture-latest');
  button.disabled = true;
  setStatus('Capturing latest assistant image from locked tab...');
  try {
    const response = await send('CAPTURE_LATEST_IMAGE', {}, { timeoutMs: 30000 });
    if (response.state) renderState(response.state);
    setStatus(response.ok ? 'Latest image captured' : boundedError(response.error), !response.ok);
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

async function rejectResult() {
  const button = element('#reject-result');
  button.disabled = true;
  setStatus('Rejecting result (zero uploads)...');
  try {
    const response = await send('REJECT_RESULT', {}, { timeoutMs: 15000 });
    if (response.state) renderState(response.state);
    setStatus(response.ok ? 'Result rejected (zero uploads)' : boundedError(response.error), !response.ok);
  } catch (err) {
    setStatus(boundedError(err), true);
  } finally {
    await refresh({ quiet: true });
    await refreshAudit();
  }
}

function selectLocalFile() {
  element('#local-file-input').click();
}

async function handleLocalFileChosen(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  setStatus(`Reading local file: ${file.name}...`);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const bytesArray = Array.from(new Uint8Array(arrayBuffer));

    const statusRes = await send('STATUS');
    const workflow = getJobWorkflowDetails(statusRes.state || {}, statusRes.state?.provider?.chatgpt || {});
    if (!workflow.job_id) {
      throw new Error('NO_ACTIVE_JOB_FOR_LOCAL_FILE');
    }

    const response = await send('SAVE_LOCAL_FILE_CANDIDATE', {
      jobId: workflow.job_id,
      bytes: bytesArray,
      mime: file.type,
      width: 1792,
      height: 1024,
      size: file.size,
      sha256
    });

    if (response.state) renderState(response.state);
    setStatus(response.ok ? 'Local file candidate saved' : boundedError(response.error), !response.ok);
  } catch (err) {
    setStatus(boundedError(err), true);
  } finally {
    event.target.value = '';
    await refresh({ quiet: true });
  }
}

function assignFeatured() {
  setStatus('Featured-image assignment remains a controlled action in a future milestone.');
}

async function copyAuditLog() {
  const response = await send('AUDIT_COPY_TEXT');
  await navigator.clipboard?.writeText(response.text);
  setStatus('Audit copied');
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
  element('#enabled').addEventListener('change', () => {
    markConfigDirty();
    setStatus(element('#enabled').checked ? 'Enabled selected; save required' : 'Paused selected; save required');
  });
  element('#server').addEventListener('input', markConfigDirty);
  element('#token').addEventListener('input', markConfigDirty);
  element('#save').addEventListener('click', () => {
    void saveConfig().catch((error) => setStatus(boundedError(error), true));
  });
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
  element('#send-to-chatgpt').addEventListener('click', () => {
    void sendToChatGpt().catch((error) => setStatus(boundedError(error), true));
  });
  element('#capture-latest').addEventListener('click', () => {
    void captureLatestImage().catch((error) => setStatus(boundedError(error), true));
  });
  element('#approve-upload').addEventListener('click', () => {
    void approveAndUpload().catch((error) => setStatus(boundedError(error), true));
  });
  element('#reject-result').addEventListener('click', () => {
    void rejectResult().catch((error) => setStatus(boundedError(error), true));
  });
  element('#btn-select-file').addEventListener('click', () => {
    selectLocalFile();
  });
  element('#local-file-input').addEventListener('change', (e) => {
    void handleLocalFileChosen(e).catch((error) => setStatus(boundedError(error), true));
  });
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
  bound = true;
  boot.add(SIDE_PANEL_BOOT_FLAGS.DOM_BOUND);
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
  } catch (error) {
    setStatus(boundedError(error), true);
  }
}
