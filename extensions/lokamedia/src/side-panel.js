import {
  SIDE_PANEL_BOOT_FLAGS,
  normalizeProviderStatus,
  normalizeServerStatus,
  summarizeCurrentJob,
  summarizeTransfers,
  validateSidePanelElements
} from './popup-core.js';

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

function renderState(state) {
  const provider = normalizeProviderStatus(state.provider?.chatgpt ?? {});
  const server = normalizeServerStatus(state);
  const current = summarizeCurrentJob(state);
  const transfers = summarizeTransfers(state);

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
  element('#provider-auth').textContent = provider.auth;
  element('#provider-dom').textContent = provider.dom;
  element('#provider-composer').textContent = provider.composer;
  element('#provider-images').textContent = String(provider.images);
  element('#provider-lane').textContent = provider.lane;
  element('#system-server').textContent = server;
  element('#system-backpressure').textContent = server === 'backpressure' ? 'on' : 'off';
  element('#system-error').textContent = state.status.last_error ?? 'none';
  renderConfigForm(state);
  renderRunOnce(state, current, provider, server);
  renderTransfers(transfers);
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

function renderRunOnce(state, current, provider, server) {
  const button = element('#run-once');
  const gate = state.phase4bSingleRun;
  const consumed = Boolean(gate?.submission_consumed || gate?.generation_consumed || gate?.completed_at);
  const waitingJob = current.operation === 'Waiting' && current.slot === 'featured' && current.article === 'LokaMedia Phase 4B Controlled Generation Test';
  const ready =
    state.config.enabled &&
    server === 'online' &&
    waitingJob &&
    provider.lane === 'idle' &&
    state.status?.connection !== 'backpressure';
  button.disabled = consumed || !ready;
  button.textContent = consumed ? (gate?.outcome === 'complete' ? 'Complete' : gate?.outcome === 'needs_attention' ? 'Needs attention' : 'Run consumed') : 'Run Once';
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

async function runOnce() {
  const button = element('#run-once');
  button.disabled = true;
  button.textContent = 'Running...';
  const response = await send('RUN_ONCE', {}, { timeoutMs: 15000 });
  if (response.state) renderState(response.state);
  await refresh({ quiet: true });
  setStatus(response.ok ? 'Run consumed' : boundedError(response.error), !response.ok);
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
  element('#run-once').addEventListener('click', () => {
    void runOnce().catch((error) => setStatus(boundedError(error), true));
  });
  bound = true;
  boot.add(SIDE_PANEL_BOOT_FLAGS.DOM_BOUND);
}

try {
  bindSidePanel();
  void refresh().catch((error) => setStatus(boundedError(error), true));
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
