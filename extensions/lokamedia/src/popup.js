function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ id: crypto.randomUUID(), type, ...payload });
}

async function refresh() {
  const response = await send('STATUS');
  const state = response.state;
  document.querySelector('#connection').textContent = state.status.connection;
  document.querySelector('#total').textContent = state.counters.totalJobs;
  document.querySelector('#active').textContent = state.counters.active;
  document.querySelector('#waiting').textContent = state.counters.waiting;
  document.querySelector('#complete').textContent = state.counters.complete;
  document.querySelector('#server').value = state.config.serverBaseUrl;
  document.querySelector('#enabled').checked = state.config.enabled;
  const provider = state.provider?.chatgpt ?? {};
  document.querySelector('#provider-tab').textContent = provider.tab_status ?? 'missing';
  document.querySelector('#provider-auth').textContent = provider.auth_state ?? 'UNKNOWN';
  document.querySelector('#provider-dom').textContent = provider.dom_status ?? 'UNKNOWN';
  document.querySelector('#provider-composer').textContent = provider.composer_status ?? 'unavailable';
  document.querySelector('#provider-images').textContent = String(provider.visible_image_candidates ?? 0);
  document.querySelector('#provider-lane').textContent = provider.provider_lane ?? 'idle';
}

document.querySelector('#save').addEventListener('click', async () => {
  await send('SAVE_CONFIG', {
    config: {
      serverBaseUrl: document.querySelector('#server').value,
      deviceToken: document.querySelector('#token').value,
      enabled: document.querySelector('#enabled').checked
    }
  });
  await refresh();
});

document.querySelector('#tick').addEventListener('click', async () => {
  await send('TICK');
  await refresh();
});

document.querySelector('#diagnostic').addEventListener('click', async () => {
  await send('READ_ONLY_PROVIDER_DIAGNOSTIC');
  await refresh();
});

void refresh();
