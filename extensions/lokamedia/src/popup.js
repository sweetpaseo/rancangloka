import {
  POPUP_BOOT_FLAGS,
  normalizeProviderStatus,
  phase4bNotArmedResponse,
  validatePopupElements
} from './popup-core.js';

const boot = new Set([POPUP_BOOT_FLAGS.SCRIPT_LOADED]);
let bound = false;

function element(selector) {
  const match = document.querySelector(selector);
  if (!match) throw new Error(`POPUP_ELEMENT_MISSING:${selector}`);
  return match;
}

function setStatus(message, isError = false) {
  const status = document.querySelector('#popup-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
}

function boundedError(error) {
  const message = String(error?.message || error || 'UNKNOWN_ERROR');
  if (message.includes('Receiving end does not exist')) return 'CONTENT_SCRIPT_UNAVAILABLE';
  if (message.includes('Extension context invalidated')) return 'SERVICE_WORKER_UNAVAILABLE';
  if (message.startsWith('POPUP_ELEMENT_MISSING')) return message;
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
    boot.add(POPUP_BOOT_FLAGS.SERVICE_WORKER_CONNECTED);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function renderState(state) {
  element('#connection').textContent = state.status.connection;
  element('#total').textContent = state.counters.totalJobs;
  element('#active').textContent = state.counters.active;
  element('#waiting').textContent = state.counters.waiting;
  element('#complete').textContent = state.counters.complete;
  element('#server').value = state.config.serverBaseUrl;
  element('#enabled').checked = state.config.enabled;
  const provider = normalizeProviderStatus(state.provider?.chatgpt ?? {});
  element('#provider-tab').textContent = provider.tab;
  element('#provider-auth').textContent = provider.auth;
  element('#provider-dom').textContent = provider.dom;
  element('#provider-composer').textContent = provider.composer;
  element('#provider-images').textContent = String(provider.images);
  element('#provider-lane').textContent = provider.lane;
}

async function refresh() {
  const response = await send('STATUS');
  renderState(response.state);
  setStatus(`Ready: ${Array.from(boot).join(', ')}`);
}

async function saveConfig() {
  await send('SAVE_CONFIG', {
    config: {
      serverBaseUrl: element('#server').value,
      deviceToken: element('#token').value,
      enabled: element('#enabled').checked
    }
  });
  await refresh();
  setStatus('Saved');
}

async function providerCheck() {
  boot.add(POPUP_BOOT_FLAGS.PROVIDER_CHECK_AVAILABLE);
  setStatus('Checking provider...');
  const response = await send('READ_ONLY_PROVIDER_DIAGNOSTIC', {}, { timeoutMs: 5000 });
  if (response.state) renderState(response.state);
  else await refresh();
  setStatus(response.ok ? 'Provider check complete' : boundedError(response.error), !response.ok);
}

async function safeRun() {
  const response = phase4bNotArmedResponse();
  setStatus(response.error, true);
  return response;
}

function bindPopup() {
  if (bound) return;
  const validation = validatePopupElements(document);
  if (!validation.ok) throw new Error(`POPUP_DOM_BIND_FAILED:${validation.missing.join(',')}`);
  element('#enabled').addEventListener('change', () => {
    setStatus(element('#enabled').checked ? 'Enabled selected; save required' : 'Disabled selected; save required');
  });
  element('#save').addEventListener('click', () => {
    void saveConfig().catch((error) => setStatus(boundedError(error), true));
  });
  element('#tick').addEventListener('click', () => {
    void safeRun();
  });
  element('#diagnostic').addEventListener('click', () => {
    void providerCheck().catch((error) => setStatus(boundedError(error), true));
  });
  bound = true;
  boot.add(POPUP_BOOT_FLAGS.DOM_BOUND);
}

try {
  bindPopup();
  void refresh().catch((error) => setStatus(boundedError(error), true));
} catch (error) {
  setStatus(boundedError(error), true);
}
