import { CHATGPT_ERROR_CODES, CHATGPT_HOST_PERMISSION } from './constants.js';

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

  sanitizeBoundUrl(url = '') {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return null;
    }
  }

  async getTab(tabId) {
    if (tabId == null) return null;
    if (this.chrome?.tabs?.get) {
      try {
        return await this.chrome.tabs.get(tabId);
      } catch {
        return null;
      }
    }
    if (this.chrome?.tabs?.query) {
      try {
        const tabs = await this.chrome.tabs.query({});
        return tabs.find((t) => t.id === tabId) ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async getActiveChatGptTab(targetTabId = null) {
    if (targetTabId != null) {
      const tab = await this.getTab(targetTabId);
      if (tab && this.isChatGptUrl(tab.url)) return tab;
      return null;
    }

    let tabs = [];
    if (this.chrome?.tabs?.query) {
      try {
        tabs = await this.chrome.tabs.query({ active: true, lastFocusedWindow: true });
      } catch {}
      if (!tabs?.length) {
        try {
          tabs = await this.chrome.tabs.query({ active: true, currentWindow: true });
        } catch {}
      }
      if (!tabs?.length) {
        try {
          tabs = await this.chrome.tabs.query({ active: true });
        } catch {}
      }
    }
    const active = tabs?.find((t) => t.id != null && this.isChatGptUrl(t.url));
    if (active) return active;
    return null;
  }

  async bindActiveTab(targetTabId = null) {
    const tab = await this.getActiveChatGptTab(targetTabId);
    if (!tab) {
      return { ok: false, status: 'NOT_A_CHATGPT_TAB', message: 'Current active tab is not chatgpt.com' };
    }
    const origin = 'https://chatgpt.com';
    const boundAt = new Date().toISOString();
    const boundUrl = this.sanitizeBoundUrl(tab.url);

    await this.storage.update((state) => {
      state.provider ??= {};
      state.provider.chatgpt ??= {};
      state.provider.chatgpt.provider_tab_id = tab.id;
      state.provider.chatgpt.bound_tab_id = tab.id;
      state.provider.chatgpt.provider_origin = origin;
      state.provider.chatgpt.bound_at = boundAt;
      state.provider.chatgpt.bound_url = boundUrl;
      state.provider.chatgpt.target_state = 'LOCKED';
      state.provider.chatgpt.tab_status = 'connected';
      state.provider.chatgpt.updated_at = boundAt;
    });

    return {
      ok: true,
      tab_id: tab.id,
      target_state: 'LOCKED',
      bound_url: boundUrl,
      bound_at: boundAt
    };
  }

  async locateTab() {
    const state = await this.storage.readState();
    const chatgpt = state.provider?.chatgpt;
    const boundTabId = chatgpt?.provider_tab_id;

    if (!boundTabId || chatgpt?.target_state !== 'LOCKED') {
      return {
        ok: false,
        status: CHATGPT_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE,
        reason: 'NOT_BOUND'
      };
    }

    const tab = await this.getTab(boundTabId);
    if (!tab) {
      await this.handleTabClosed(boundTabId, 'closed');
      return {
        ok: false,
        status: CHATGPT_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE,
        reason: 'TAB_CLOSED'
      };
    }

    if (!this.isChatGptUrl(tab.url)) {
      await this.handleTabClosed(boundTabId, 'navigated');
      return {
        ok: false,
        status: CHATGPT_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE,
        reason: 'TAB_NAVIGATED'
      };
    }

    return { ok: true, tab_id: tab.id, status: tab.status ?? 'unknown' };
  }

  async persistTab(tabId) {
    await this.storage.update((state) => {
      state.provider ??= {};
      state.provider.chatgpt ??= {};
      state.provider.chatgpt.provider_tab_id = tabId;
      state.provider.chatgpt.bound_tab_id = tabId;
      state.provider.chatgpt.target_state = 'LOCKED';
      state.provider.chatgpt.tab_status = 'connected';
      state.provider.chatgpt.updated_at = new Date().toISOString();
    });
  }

  async clearTab(reason = 'missing') {
    await this.storage.update((state) => {
      state.provider ??= {};
      state.provider.chatgpt ??= {};
      state.provider.chatgpt.provider_tab_id = null;
      state.provider.chatgpt.target_state = 'NOT BOUND';
      state.provider.chatgpt.tab_status = reason;
      state.provider.chatgpt.updated_at = new Date().toISOString();
    });
  }

  async handleTabClosed(tabId, reason = 'closed') {
    await this.storage.update((next) => {
      next.provider ??= {};
      next.provider.chatgpt ??= {};
      next.provider.chatgpt.provider_tab_id = null;
      next.provider.chatgpt.tab_status = reason;
      next.provider.chatgpt.target_state = 'CLOSED';
      next.provider.chatgpt.composer_status = 'unavailable';
      next.provider.chatgpt.prompt_submission_enabled = false;
      next.provider.chatgpt.updated_at = new Date().toISOString();
    });
  }

  validateSender(sender, expectedTabId) {
    return Boolean(sender?.tab?.id && sender.tab.id === expectedTabId && this.isChatGptUrl(sender.tab.url));
  }

  async handleTabRemoved(tabId) {
    const state = await this.storage.readState();
    const chatgpt = state.provider?.chatgpt;
    if (chatgpt?.provider_tab_id === tabId || chatgpt?.bound_tab_id === tabId) {
      await this.handleTabClosed(tabId, 'closed');
    }
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    const state = await this.storage.readState();
    const chatgpt = state.provider?.chatgpt;
    if (chatgpt?.provider_tab_id !== tabId && chatgpt?.bound_tab_id !== tabId) return;

    if (tab?.url && !this.isChatGptUrl(tab.url)) {
      await this.handleTabClosed(tabId, 'navigated');
      return;
    }

    if (changeInfo?.status === 'loading') {
      await this.storage.update((next) => {
        next.provider ??= {};
        next.provider.chatgpt ??= {};
        next.provider.chatgpt.tab_status = 'reloading';
        next.provider.chatgpt.content_script_session_id = null;
      });
    }
  }
}
