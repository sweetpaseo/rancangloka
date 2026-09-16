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
    TICK: async () => ({ ok: true, result: await (await ensureController()).tick() })
    ,
    CHATGPT_PROVIDER_HELLO: async (request) => chatGptHandshake.handle(request, sender),
    CHATGPT_PROVIDER_CAPABILITIES: async (request) => chatGptHandshake.handle(request, sender),
    READ_ONLY_PROVIDER_DIAGNOSTIC: async () => {
      const tab = await chatGptTabs.locateTab();
      if (!tab.ok) return { ok: true, provider: 'ChatGPT', tab };
      const capabilities = await chrome.tabs.sendMessage(tab.tab_id, {
        id: crypto.randomUUID(),
        provider: 'chatgpt',
        type: CHATGPT_MESSAGE_TYPES.DIAGNOSTIC,
        version: 1
      });
      await storage.update((state) => {
        state.provider.chatgpt.capabilities = capabilities.capabilities;
        state.provider.chatgpt.auth_state = capabilities.capabilities.auth_state;
        state.provider.chatgpt.dom_status = capabilities.capabilities.dom_status;
        state.provider.chatgpt.composer_status = capabilities.capabilities.capabilities.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
        state.provider.chatgpt.visible_image_candidates = capabilities.capabilities.image_candidate_count;
        state.provider.chatgpt.provider_lane = state.locks.providerLane ? 'bound' : 'idle';
      });
      return { ok: true, provider: 'ChatGPT', tab, capabilities };
    }
  }).then(sendResponse);
  return true;
});
