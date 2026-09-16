import { ApiClient } from './api-client.js';
import { IndexedDbBlobStore } from './blob-store.js';
import { LokaMediaController } from './controller.js';
import { createChromeStorage } from './storage.js';
import { MessageProtocol } from './messages.js';
import { Logger } from './logger.js';
import { ChatGptProviderAdapter } from './providers/chatgpt/adapter.js';
import { ChatGptHandshakeManager } from './providers/chatgpt/handshake.js';
import { ChatGptTabController } from './providers/chatgpt/tab-controller.js';
import { CHATGPT_MESSAGE_TYPES } from './providers/chatgpt/constants.js';

const storage = createChromeStorage();
const blobStore = new IndexedDbBlobStore();
const logger = new Logger();
let controller = null;
const chatGptTabs = new ChatGptTabController({ chromeApi: chrome, storage });
const chatGptHandshake = new ChatGptHandshakeManager({ storage, tabController: chatGptTabs });

if (chrome.sidePanel?.setPanelBehavior) {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    logger.warn('side panel behavior unavailable', { error: error.message });
  });
}

async function readOnlyChatGptDiagnostic(tabId) {
  const message = {
    id: crypto.randomUUID(),
    provider: 'chatgpt',
    type: CHATGPT_MESSAGE_TYPES.DIAGNOSTIC,
    version: 1
  };
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!chrome.scripting?.executeScript) throw error;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/providers/chatgpt/content-script.js']
    });
    return chrome.tabs.sendMessage(tabId, { ...message, id: crypto.randomUUID() });
  }
}

async function ensureController() {
  const state = await storage.readState();
  controller = new LokaMediaController({
    apiClient: new ApiClient({
      baseUrl: state.config.serverBaseUrl,
      deviceToken: state.config.deviceToken
    }),
    storage,
    blobStore,
    provider: new ChatGptProviderAdapter({ tabController: chatGptTabs }),
    logger
  });
  return controller;
}

async function refreshServerState() {
  const instance = await ensureController();
  const state = await storage.readState();
  if (!state.config.deviceToken) return state;
  try {
      const response = await instance.apiClient.listJobs({ status: 'all', limit: 50 });
      await storage.update((nextState) => {
        nextState.status.connection = 'online';
        if (/WorkerGlobalScope|Illegal_invocation|Illegal invocation|fetch/i.test(String(nextState.status.last_error || ''))) {
          nextState.status.last_error = null;
        }
        for (const job of response.jobs ?? []) {
        const local = nextState.jobs[job.job_id] ?? {};
        nextState.jobs[job.job_id] = {
          ...local,
          ...job,
          local_state: local.local_state ?? job.status
        };
      }
      const jobs = Object.values(nextState.jobs);
      nextState.counters.totalJobs = jobs.length;
      nextState.counters.complete = jobs.filter((job) => job.local_state === 'COMPLETE' || job.status === 'COMPLETE').length;
      nextState.counters.active = jobs.filter((job) => ['LEASED', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURED', 'UPLOADING', 'RECOVERING'].includes(job.local_state ?? job.status)).length;
      nextState.counters.waiting = jobs.filter((job) => ['QUEUED', 'WAITING_RETRY'].includes(job.local_state ?? job.status)).length;
    });
  } catch (error) {
    await storage.update((nextState) => {
      nextState.status.connection = 'offline';
      nextState.status.last_error = String(error?.message || error || 'SERVER_UNAVAILABLE').slice(0, 80);
    });
  }
  return storage.readState();
}

chrome.runtime.onInstalled.addListener(() => {
  void storage.initialize();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureController().then((instance) => instance.startup());
});

chrome.alarms.create('lokamedia_tick', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'lokamedia_tick') {
    void ensureController().then((instance) => instance.startup()).catch((error) => logger.warn('startup reconcile failed', { error: error.message }));
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chatGptTabs.handleTabRemoved(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void chatGptTabs.handleTabUpdated(tabId, changeInfo, tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const protocol = new MessageProtocol(storage);
  void protocol.handle(message, {
    STATUS: async () => ({ ok: true, state: await refreshServerState() }),
    SAVE_CONFIG: async (request) => {
      await storage.saveConfig(request.config);
      return { ok: true };
    },
    TICK: async () => ({ ok: false, error: 'PHASE_4B_NOT_ARMED' }),
    RUN_ONCE: async () => {
      const instance = await ensureController();
      return instance.runOnce();
    },
    CHATGPT_PROVIDER_HELLO: async (request) => chatGptHandshake.handle(request, sender),
    CHATGPT_PROVIDER_CAPABILITIES: async (request) => chatGptHandshake.handle(request, sender),
    READ_ONLY_PROVIDER_DIAGNOSTIC: async () => {
      const tab = await chatGptTabs.locateTab();
      if (!tab.ok) return { ok: false, provider: 'ChatGPT', tab, error: tab.status || 'TAB_MISSING', state: await storage.readState() };
      const capabilities = await readOnlyChatGptDiagnostic(tab.tab_id);
      await storage.update((state) => {
        state.provider.chatgpt.capabilities = capabilities.capabilities;
        state.provider.chatgpt.auth_state = capabilities.capabilities.auth_state;
        state.provider.chatgpt.dom_status = capabilities.capabilities.dom_status;
        state.provider.chatgpt.composer_status = capabilities.capabilities.capabilities.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
        state.provider.chatgpt.visible_image_candidates = capabilities.capabilities.image_candidate_count;
        state.provider.chatgpt.provider_lane = state.locks.providerLane ? 'bound' : 'idle';
      });
      return { ok: true, provider: 'ChatGPT', tab, capabilities, state: await storage.readState() };
    }
  }).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: String(error?.message || error || 'SERVICE_WORKER_UNAVAILABLE') });
  });
  return true;
});
