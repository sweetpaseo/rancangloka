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
  return {
    tab: tabStatus === 'connected' ? 'connected' : tabStatus,
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
    'provider-auth',
    'provider-dom',
    'provider-composer',
    'provider-images',
    'provider-lane',
    'system-server',
    'system-backpressure',
    'system-error',
    'server',
    'token',
    'enabled',
    'run-once',
    'save',
    'diagnostic',
    'panel-status'
  ];
  const missing = ids.filter((id) => !doc.querySelector(`#${id}`));
  return { ok: missing.length === 0, missing };
}

export function normalizeServerStatus(state = {}) {
  const connection = state.status?.connection ?? 'offline';
  if (connection === 'online' || connection === 'connected') return 'online';
  if (connection === 'backpressure') return 'backpressure';
  return 'offline';
}

export function summarizeCurrentJob(state = {}) {
  const jobs = Object.values(state.jobs ?? {});
  const active = jobs.find((job) => ['GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED', 'UPLOADING', 'RECOVERING'].includes(job.local_state));
  const waiting = jobs.find((job) => ['QUEUED', 'WAITING_RETRY'].includes(job.local_state ?? job.status));
  const complete = jobs.find((job) => ['COMPLETE'].includes(job.local_state ?? job.status));
  const current = active ?? waiting ?? complete;
  if (!current) {
    return {
      article: 'None',
      slot: 'Idle',
      operation: 'Waiting',
      elapsed: '--'
    };
  }
  const stateLabel = current === waiting ? 'Waiting' : current === complete ? 'Complete' : (current.local_state ?? 'active');
  return {
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
