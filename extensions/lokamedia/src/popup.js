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

void refresh();
