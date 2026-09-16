import { ApiClient } from './api-client.js';
import { IndexedDbBlobStore } from './blob-store.js';
import { LokaMediaController } from './controller.js';
import { createChromeStorage } from './storage.js';
import { MessageProtocol } from './messages.js';
import { Logger } from './logger.js';
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
    logger
  });
  return controller;
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
    void ensureController().then((instance) => instance.tick()).catch((error) => logger.warn('tick failed', { error: error.message }));
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
    STATUS: async () => ({ ok: true, state: await storage.readState() }),
    SAVE_CONFIG: async (request) => {
      await storage.saveConfig(request.config);
      return { ok: true };
    },
    TICK: async () => ({ ok: false, error: 'PHASE_4B_NOT_ARMED' }),
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
