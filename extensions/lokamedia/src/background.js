import { ApiClient } from './api-client.js';
import { IndexedDbBlobStore } from './blob-store.js';
import { LokaMediaController } from './controller.js';
import { createChromeStorage } from './storage.js';
import { MessageProtocol } from './messages.js';
import { Logger } from './logger.js';

const storage = createChromeStorage();
const blobStore = new IndexedDbBlobStore();
const logger = new Logger();
let controller = null;

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const protocol = new MessageProtocol(storage);
  void protocol.handle(message, {
    STATUS: async () => ({ ok: true, state: await storage.readState() }),
    SAVE_CONFIG: async (request) => {
      await storage.saveConfig(request.config);
      return { ok: true };
    },
    TICK: async () => ({ ok: true, result: await (await ensureController()).tick() })
  }).then(sendResponse);
  return true;
});
