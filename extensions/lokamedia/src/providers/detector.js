/**
 * RancangLoka LokaMedia — Browser Provider Detector & Multi-Provider Manager
 * Phase 2 Implementation
 *
 * Implements deterministic browser session discovery and provider selection:
 * 1. Exact permitted origin validation (https://chatgpt.com vs https://gemini.google.com).
 * 2. Five canonical provider-selection rules.
 * 3. Strict provider and tab locking per media job (zero silent mid-job switching).
 * 4. Fail-safe disconnection and session expiry detection.
 */

import { isProviderExecutionInFlight } from '../execution-state.js';

export const PROVIDER_CHATGPT = 'CHATGPT_BROWSER';
export const PROVIDER_GEMINI = 'GEMINI_BROWSER';

export const PERMITTED_ORIGINS = Object.freeze({
  [PROVIDER_CHATGPT]: 'https://chatgpt.com',
  [PROVIDER_GEMINI]: 'https://gemini.google.com'
});

export const DETECTOR_STATUS = Object.freeze({
  SELECTED: 'SELECTED',
  WAITING_FOR_BROWSER: 'WAITING_FOR_BROWSER',
  AMBIGUOUS_SELECTION: 'AMBIGUOUS_SELECTION',
  BROWSER_DISCONNECTED: 'BROWSER_DISCONNECTED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  SWITCH_LOCKED: 'PROVIDER_SWITCH_LOCKED'
});

export class BrowserProviderDetector {
  constructor({ chromeApi = globalThis.chrome, storage = null } = {}) {
    this.chrome = chromeApi;
    this.storage = storage;
    this.activeJobLocks = new Map(); // jobId -> { providerId, tabId, origin, lockedAt }
  }

  isPermittedOrigin(url = '', expectedOrigin) {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  identifyUrlProvider(url = '') {
    if (this.isPermittedOrigin(url, PERMITTED_ORIGINS[PROVIDER_CHATGPT])) {
      return PROVIDER_CHATGPT;
    }
    if (this.isPermittedOrigin(url, PERMITTED_ORIGINS[PROVIDER_GEMINI])) {
      return PROVIDER_GEMINI;
    }
    return null;
  }

  async getAllTabs() {
    if (!this.chrome?.tabs?.query) return [];
    try {
      return await this.chrome.tabs.query({});
    } catch {
      return [];
    }
  }

  async getForegroundTab(targetWindowId = null) {
    if (!this.chrome?.tabs?.query) return null;
    try {
      // 1. If targetWindowId is explicitly specified (e.g. from side panel)
      if (targetWindowId != null) {
        const winTabs = await this.chrome.tabs.query({ active: true, windowId: targetWindowId });
        const validWin = winTabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
        if (validWin?.length) {
          return validWin[0];
        }
      }

      // 2. Query active tab in the last focused normal browser window
      if (this.chrome?.windows?.getLastFocused) {
        try {
          const focusedWin = await this.chrome.windows.getLastFocused({ populate: false, windowTypes: ['normal'] });
          if (focusedWin?.id != null) {
            const tabs = await this.chrome.tabs.query({ active: true, windowId: focusedWin.id });
            const valid = tabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
            if (valid?.length) return valid[0];
          }
        } catch {}
      }

      // 3. Try active tab in last focused window
      const focusedTabs = await this.chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const validFocused = focusedTabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
      if (validFocused?.length) {
        return validFocused[0];
      }

      // 4. Fall back to active tab in current window
      const currentTabs = await this.chrome.tabs.query({ active: true, currentWindow: true });
      const validCurrent = currentTabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
      if (validCurrent?.length) {
        return validCurrent[0];
      }

      // 5. Fall back to any active tab
      const anyTabs = await this.chrome.tabs.query({ active: true });
      const validAny = anyTabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
      if (validAny?.length) {
        return validAny[0];
      }
    } catch {}
    return null;
  }

  async discoverAvailableProviders() {
    const allTabs = await this.getAllTabs();
    const chatGptTabs = [];
    const geminiTabs = [];

    for (const tab of allTabs) {
      if (!tab.url) continue;
      if (this.isPermittedOrigin(tab.url, PERMITTED_ORIGINS[PROVIDER_CHATGPT])) {
        chatGptTabs.push(tab);
      } else if (this.isPermittedOrigin(tab.url, PERMITTED_ORIGINS[PROVIDER_GEMINI])) {
        geminiTabs.push(tab);
      }
    }

    return {
      allTabs,
      chatGptTabs,
      geminiTabs,
      hasChatGpt: chatGptTabs.length > 0,
      hasGemini: geminiTabs.length > 0
    };
  }

  /**
   * Evaluates open browser sessions against the 5 canonical selection rules:
   * Rule 1: If only ChatGPT is available -> select ChatGPT.
   * Rule 2: If only Gemini is available -> select Gemini.
   * Rule 3: If both are available -> prefer foreground active tab in operator's window.
   * Rule 4: If foreground is ambiguous -> return AMBIGUOUS_SELECTION.
   * Rule 5: If neither is available -> return WAITING_FOR_BROWSER.
   */
  async detectAndSelectProvider(options = {}) {
    const { forcedProvider = null, targetTabId = null, targetWindowId = null, activeJobLock = null, state = null } = options;

    let effectiveLock = activeJobLock;
    if (!effectiveLock && state && isProviderExecutionInFlight(state)) {
      effectiveLock = state.locks?.providerLock || null;
    }

    // Rule 1: Active job lock preservation (genuine in-flight job)
    if (effectiveLock && effectiveLock.providerId && effectiveLock.tabId != null) {
      return {
        status: DETECTOR_STATUS.SELECTED,
        provider: effectiveLock.providerId,
        tab: { id: effectiveLock.tabId, url: effectiveLock.origin },
        origin: effectiveLock.origin,
        ruleApplied: 'ACTIVE_JOB_LOCK_PRESERVED',
        diagnostics: {
          last_focused_window_id: targetWindowId ?? null,
          active_tab_id: effectiveLock.tabId,
          selected_provider_origin: effectiveLock.origin,
          bound_tab_id: effectiveLock.tabId,
          active_job_lock_state: 'LOCKED_BY_JOB',
          selection_reason: 'ACTIVE_JOB_LOCK_PRESERVED',
          evaluated_at: new Date().toISOString()
        }
      };
    }

    const discovery = await this.discoverAvailableProviders();
    const foreground = await this.getForegroundTab(targetWindowId);

    // Forced override (if operator manually chose a provider in UI)
    if (forcedProvider) {
      if (forcedProvider === PROVIDER_CHATGPT && discovery.hasChatGpt) {
        const selectedTab = targetTabId
          ? discovery.chatGptTabs.find((t) => t.id === targetTabId) || discovery.chatGptTabs[0]
          : discovery.chatGptTabs[0];
        return {
          status: DETECTOR_STATUS.SELECTED,
          provider: PROVIDER_CHATGPT,
          tab: selectedTab,
          origin: PERMITTED_ORIGINS[PROVIDER_CHATGPT],
          ruleApplied: 'FORCED_SELECTION',
          diagnostics: {
            last_focused_window_id: targetWindowId ?? selectedTab.windowId ?? null,
            active_tab_id: selectedTab.id,
            selected_provider_origin: PERMITTED_ORIGINS[PROVIDER_CHATGPT],
            bound_tab_id: selectedTab.id,
            active_job_lock_state: 'IDLE',
            selection_reason: 'FORCED_SELECTION',
            evaluated_at: new Date().toISOString()
          }
        };
      }
      if (forcedProvider === PROVIDER_GEMINI && discovery.hasGemini) {
        const selectedTab = targetTabId
          ? discovery.geminiTabs.find((t) => t.id === targetTabId) || discovery.geminiTabs[0]
          : discovery.geminiTabs[0];
        return {
          status: DETECTOR_STATUS.SELECTED,
          provider: PROVIDER_GEMINI,
          tab: selectedTab,
          origin: PERMITTED_ORIGINS[PROVIDER_GEMINI],
          ruleApplied: 'FORCED_SELECTION',
          diagnostics: {
            last_focused_window_id: targetWindowId ?? selectedTab.windowId ?? null,
            active_tab_id: selectedTab.id,
            selected_provider_origin: PERMITTED_ORIGINS[PROVIDER_GEMINI],
            bound_tab_id: selectedTab.id,
            active_job_lock_state: 'IDLE',
            selection_reason: 'FORCED_SELECTION',
            evaluated_at: new Date().toISOString()
          }
        };
      }
    }

    // Rule 1: Only ChatGPT available
    if (discovery.hasChatGpt && !discovery.hasGemini) {
      return {
        status: DETECTOR_STATUS.SELECTED,
        provider: PROVIDER_CHATGPT,
        tab: discovery.chatGptTabs[0],
        origin: PERMITTED_ORIGINS[PROVIDER_CHATGPT],
        ruleApplied: 'RULE_1_ONLY_CHATGPT',
        diagnostics: {
          last_focused_window_id: targetWindowId ?? discovery.chatGptTabs[0].windowId ?? null,
          active_tab_id: discovery.chatGptTabs[0].id,
          selected_provider_origin: PERMITTED_ORIGINS[PROVIDER_CHATGPT],
          bound_tab_id: discovery.chatGptTabs[0].id,
          active_job_lock_state: 'IDLE',
          selection_reason: 'RULE_1_ONLY_CHATGPT',
          evaluated_at: new Date().toISOString()
        }
      };
    }

    // Rule 2: Only Gemini available
    if (discovery.hasGemini && !discovery.hasChatGpt) {
      return {
        status: DETECTOR_STATUS.SELECTED,
        provider: PROVIDER_GEMINI,
        tab: discovery.geminiTabs[0],
        origin: PERMITTED_ORIGINS[PROVIDER_GEMINI],
        ruleApplied: 'RULE_2_ONLY_GEMINI',
        diagnostics: {
          last_focused_window_id: targetWindowId ?? discovery.geminiTabs[0].windowId ?? null,
          active_tab_id: discovery.geminiTabs[0].id,
          selected_provider_origin: PERMITTED_ORIGINS[PROVIDER_GEMINI],
          bound_tab_id: discovery.geminiTabs[0].id,
          active_job_lock_state: 'IDLE',
          selection_reason: 'RULE_2_ONLY_GEMINI',
          evaluated_at: new Date().toISOString()
        }
      };
    }

    // Rule 3 & 4: Both ChatGPT and Gemini available
    if (discovery.hasChatGpt && discovery.hasGemini) {
      const fgProvider = foreground?.url ? this.identifyUrlProvider(foreground.url) : null;

      if (fgProvider) {
        return {
          status: DETECTOR_STATUS.SELECTED,
          provider: fgProvider,
          tab: foreground,
          origin: PERMITTED_ORIGINS[fgProvider],
          ruleApplied: 'RULE_3_FOREGROUND_PREFERENCE',
          diagnostics: {
            last_focused_window_id: targetWindowId ?? foreground.windowId ?? null,
            active_tab_id: foreground.id,
            selected_provider_origin: PERMITTED_ORIGINS[fgProvider],
            bound_tab_id: foreground.id,
            active_job_lock_state: 'IDLE',
            selection_reason: `FOREGROUND_WINDOW_${fgProvider === PROVIDER_GEMINI ? 'GEMINI' : 'CHATGPT'}`,
            evaluated_at: new Date().toISOString()
          }
        };
      }

      // Rule 4: Neither is active in the foreground -> Ambiguous
      return {
        status: DETECTOR_STATUS.AMBIGUOUS_SELECTION,
        provider: null,
        tab: null,
        candidates: [
          { provider: PROVIDER_CHATGPT, tabCount: discovery.chatGptTabs.length },
          { provider: PROVIDER_GEMINI, tabCount: discovery.geminiTabs.length }
        ],
        message: 'Both ChatGPT and Google Gemini are open, but neither is the active foreground tab in this window. Please activate or select your desired provider tab.',
        ruleApplied: 'RULE_4_AMBIGUOUS_SELECTION',
        diagnostics: {
          last_focused_window_id: targetWindowId ?? null,
          active_tab_id: foreground?.id ?? null,
          selected_provider_origin: null,
          bound_tab_id: null,
          active_job_lock_state: 'IDLE',
          selection_reason: 'AMBIGUOUS_ACROSS_WINDOWS',
          evaluated_at: new Date().toISOString()
        }
      };
    }

    // Rule 5: Neither available
    return {
      status: DETECTOR_STATUS.WAITING_FOR_BROWSER,
      provider: null,
      tab: null,
      candidates: [],
      message: 'No authorized ChatGPT or Google Gemini tab detected. Please open chatgpt.com or gemini.google.com in your browser.',
      ruleApplied: 'RULE_5_NO_PROVIDERS',
      diagnostics: {
        last_focused_window_id: targetWindowId ?? null,
        active_tab_id: foreground?.id ?? null,
        selected_provider_origin: null,
        bound_tab_id: null,
        active_job_lock_state: 'IDLE',
        selection_reason: 'NO_PROVIDER_OPEN',
        evaluated_at: new Date().toISOString()
      }
    };
  }

  // --- Provider Job Locking Invariants ---

  async lockProviderForJob(jobId, providerId, tabId) {
    if (!jobId || !providerId || tabId == null) {
      throw new Error('jobId, providerId, and tabId are required to lock a provider');
    }
    const existing = this.activeJobLocks.get(jobId);
    if (existing && (existing.providerId !== providerId || existing.tabId !== tabId)) {
      const err = new Error(`Cannot switch provider mid-job. Job '${jobId}' is locked to ${existing.providerId} (tab ${existing.tabId}).`);
      err.code = DETECTOR_STATUS.SWITCH_LOCKED;
      throw err;
    }

    const lock = {
      jobId,
      providerId,
      tabId,
      origin: PERMITTED_ORIGINS[providerId],
      lockedAt: new Date().toISOString()
    };
    this.activeJobLocks.set(jobId, lock);

    if (this.storage?.update) {
      await this.storage.update((state) => {
        state.locks ??= {};
        state.locks.providerLock = lock;
      });
    }
    return lock;
  }

  async verifyJobLock(jobId, proposedProviderId) {
    const lock = this.activeJobLocks.get(jobId);
    if (lock) {
      if (proposedProviderId && proposedProviderId !== lock.providerId) {
        const err = new Error(`Job '${jobId}' is locked to ${lock.providerId}. Attempt to use ${proposedProviderId} rejected.`);
        err.code = DETECTOR_STATUS.SWITCH_LOCKED;
        throw err;
      }
      // Check if locked tab is still open and on the exact permitted origin
      if (this.chrome?.tabs?.get) {
        try {
          const tab = await this.chrome.tabs.get(lock.tabId);
          if (!tab || !this.isPermittedOrigin(tab.url, lock.origin)) {
            const err = new Error(`Locked ${lock.providerId} tab (${lock.tabId}) was closed or navigated away.`);
            err.code = DETECTOR_STATUS.BROWSER_DISCONNECTED;
            throw err;
          }
        } catch (getErr) {
          const err = new Error(`Locked ${lock.providerId} tab (${lock.tabId}) is no longer reachable.`);
          err.code = DETECTOR_STATUS.BROWSER_DISCONNECTED;
          throw err;
        }
      }
      return lock;
    }
    return null;
  }

  async releaseJobLock(jobId) {
    this.activeJobLocks.delete(jobId);
    if (this.storage?.update) {
      await this.storage.update((state) => {
        if (state.locks?.providerLock?.jobId === jobId) {
          delete state.locks.providerLock;
        }
      });
    }
  }
}
