export const POPUP_BOOT_FLAGS = Object.freeze({
  SCRIPT_LOADED: 'POPUP_SCRIPT_LOADED',
  DOM_BOUND: 'POPUP_DOM_BOUND',
  SERVICE_WORKER_CONNECTED: 'POPUP_SERVICE_WORKER_CONNECTED',
  PROVIDER_CHECK_AVAILABLE: 'POPUP_PROVIDER_CHECK_AVAILABLE'
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

export function phase4bNotArmedResponse() {
  return { ok: false, error: 'PHASE_4B_NOT_ARMED' };
}
