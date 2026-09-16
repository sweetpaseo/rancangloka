import { CHATGPT_HOST_PERMISSION } from './constants.js';

export class ChatGptTabController {
  constructor({ chromeApi = globalThis.chrome, storage, timeoutMs = 2000 } = {}) {
    this.chrome = chromeApi;
    this.storage = storage;
    this.timeoutMs = timeoutMs;
  }

  isChatGptUrl(url = '') {
    try {
      return new URL(url).origin === 'https://chatgpt.com';
    } catch {
      return false;
    }
  }

  async locateTab() {
    const tabs = await this.chrome.tabs.query({ url: CHATGPT_HOST_PERMISSION });
    const tab = tabs.find((item) => item.id != null && this.isChatGptUrl(item.url));
    if (!tab) {
      await this.clearTab();
      return { ok: false, status: 'TAB_MISSING' };
    }
    await this.persistTab(tab.id);
    return { ok: true, tab_id: tab.id, status: tab.status ?? 'unknown' };
  }

  async persistTab(tabId) {
    await this.storage.update((state) => {
      state.provider ??= {};
      state.provider.chatgpt ??= {};
      state.provider.chatgpt.provider_tab_id = tabId;
      state.provider.chatgpt.tab_status = 'connected';
      state.provider.chatgpt.updated_at = new Date().toISOString();
    });
  }

  async clearTab(reason = 'missing') {
    await this.storage.update((state) => {
      state.provider ??= {};
      state.provider.chatgpt ??= {};
      state.provider.chatgpt.provider_tab_id = null;
      state.provider.chatgpt.tab_status = reason;
      state.provider.chatgpt.updated_at = new Date().toISOString();
    });
  }

  validateSender(sender, expectedTabId) {
    return Boolean(sender?.tab?.id && sender.tab.id === expectedTabId && this.isChatGptUrl(sender.tab.url));
  }

  async handleTabRemoved(tabId) {
    const state = await this.storage.readState();
    if (state.provider?.chatgpt?.provider_tab_id === tabId) await this.clearTab('closed');
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    const state = await this.storage.readState();
    if (state.provider?.chatgpt?.provider_tab_id !== tabId) return;
    if (!this.isChatGptUrl(tab?.url)) {
      await this.clearTab('navigated');
      return;
    }
    if (changeInfo.status === 'loading') {
      await this.storage.update((next) => {
        next.provider.chatgpt.tab_status = 'reloading';
        next.provider.chatgpt.content_script_session_id = null;
      });
    }
  }
}
