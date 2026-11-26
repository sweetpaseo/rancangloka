/**
 * RancangLoka LokaMedia — Gemini Tab Controller
 * Manages authorized tab binding and lifecycle for Google Gemini web sessions.
 */

import { GEMINI_ERROR_CODES, GEMINI_ORIGIN } from './constants.js';

export class GeminiTabController {
  constructor({ chromeApi = globalThis.chrome, storage, timeoutMs = 2000 } = {}) {
    this.chrome = chromeApi;
    this.storage = storage;
    this.timeoutMs = timeoutMs;
  }

  isGeminiUrl(url = '') {
    try {
      return new URL(url).origin === GEMINI_ORIGIN;
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

  async getActiveGeminiTab(targetTabId = null) {
    if (targetTabId != null) {
      const tab = await this.getTab(targetTabId);
      if (tab && this.isGeminiUrl(tab.url)) return tab;
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
    const active = tabs?.find((t) => t.id != null && this.isGeminiUrl(t.url));
    if (active) return active;
    return null;
  }

  async bindActiveTab(targetTabId = null) {
    const tab = await this.getActiveGeminiTab(targetTabId);
    if (!tab) {
      return { ok: false, status: 'NOT_A_GEMINI_TAB', message: 'Current active tab is not gemini.google.com' };
    }
    const origin = GEMINI_ORIGIN;
    const boundAt = new Date().toISOString();
    const boundUrl = this.sanitizeBoundUrl(tab.url);

    if (this.storage?.update) {
      await this.storage.update((state) => {
        state.provider ??= {};
        state.provider.active_provider_id = 'GEMINI_BROWSER';
        if (state.provider.chatgpt) {
          state.provider.chatgpt.target_state = 'UNBOUND';
        }
        state.provider.gemini ??= {};
        state.provider.gemini.provider_tab_id = tab.id;
        state.provider.gemini.bound_tab_id = tab.id;
        state.provider.gemini.provider_origin = origin;
        state.provider.gemini.bound_at = boundAt;
        state.provider.gemini.bound_url = boundUrl;
        state.provider.gemini.target_state = 'LOCKED';
        state.provider.gemini.tab_status = 'connected';
        state.provider.gemini.updated_at = boundAt;
      });
    }

    return {
      ok: true,
      tab_id: tab.id,
      target_state: 'LOCKED',
      bound_url: boundUrl,
      bound_at: boundAt
    };
  }

  async locateTab() {
    let boundTabId = null;
    let targetState = null;

    if (this.storage?.readState) {
      const state = await this.storage.readState();
      const gemini = state.provider?.gemini;
      boundTabId = gemini?.provider_tab_id;
      targetState = gemini?.target_state;
    }

    if (!boundTabId || targetState !== 'LOCKED') {
      return {
        ok: false,
        status: GEMINI_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE,
        reason: 'NOT_BOUND'
      };
    }

    const tab = await this.getTab(boundTabId);
    if (!tab) {
      await this.handleTabClosed(boundTabId, 'closed');
      return {
        ok: false,
        status: GEMINI_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE,
        reason: 'TAB_CLOSED'
      };
    }

    if (!this.isGeminiUrl(tab.url)) {
      await this.handleTabClosed(boundTabId, 'navigated');
      return {
        ok: false,
        status: GEMINI_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE,
        reason: 'TAB_NAVIGATED'
      };
    }

    return { ok: true, tab_id: tab.id, status: tab.status ?? 'unknown' };
  }

  async handleTabClosed(tabId, reason = 'closed') {
    if (this.storage?.update) {
      await this.storage.update((next) => {
        next.provider ??= {};
        next.provider.gemini ??= {};
        next.provider.gemini.provider_tab_id = null;
        next.provider.gemini.tab_status = reason;
        next.provider.gemini.target_state = 'CLOSED';
        next.provider.gemini.auth_state = 'UNKNOWN';
        next.provider.gemini.dom_status = 'UNKNOWN';
        next.provider.gemini.composer_status = 'unavailable';
        next.provider.gemini.capabilities = {};
        next.provider.gemini.visible_image_candidates = 0;
        next.provider.gemini.prompt_submission_enabled = false;
        next.provider.gemini.updated_at = new Date().toISOString();
        if (next.provider.active_provider_id === 'GEMINI_BROWSER') {
          next.provider.active_provider_id = null;
        }
      });
    }
  }

  validateSender(sender, expectedTabId) {
    return Boolean(sender?.tab?.id && sender.tab.id === expectedTabId && this.isGeminiUrl(sender.tab.url));
  }

  async handleTabRemoved(tabId) {
    if (this.storage?.readState) {
      const state = await this.storage.readState();
      const gemini = state.provider?.gemini;
      if (gemini?.provider_tab_id === tabId || gemini?.bound_tab_id === tabId) {
        await this.handleTabClosed(tabId, 'closed');
      }
    }
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    if (this.storage?.readState) {
      const state = await this.storage.readState();
      const gemini = state.provider?.gemini;
      if (gemini?.provider_tab_id !== tabId && gemini?.bound_tab_id !== tabId) return;

      if (tab?.url && !this.isGeminiUrl(tab.url)) {
        await this.handleTabClosed(tabId, 'navigated');
      }
    }
  }
}
