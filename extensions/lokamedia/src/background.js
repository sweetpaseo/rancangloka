import { ApiClient } from './api-client.js';
import { IndexedDbBlobStore, IndexedDbDerivativeStore } from './blob-store.js';
import { LokaMediaController } from './controller.js';
import { createChromeStorage } from './storage.js';
import { MessageProtocol } from './messages.js';
import { Logger } from './logger.js';
import { ChatGptProviderAdapter } from './providers/chatgpt/adapter.js';
import { AuditLogger, formatAuditText, MAX_AUDIT_EVENTS, AUDIT_RETENTION_DAYS } from './audit-log.js';
import { ChatGptHandshakeManager } from './providers/chatgpt/handshake.js';
import { ChatGptTabController } from './providers/chatgpt/tab-controller.js';
import { CHATGPT_MESSAGE_TYPES } from './providers/chatgpt/constants.js';
import { BrowserProviderDetector, PROVIDER_CHATGPT, PROVIDER_GEMINI, DETECTOR_STATUS, PERMITTED_ORIGINS } from './providers/detector.js';
import { MultiProviderOrchestrator } from './providers/multi-provider.js';
import { GeminiTabController } from './providers/gemini/tab-controller.js';
import { GeminiProviderAdapter } from './providers/gemini/adapter.js';
import { GEMINI_DOM_ADAPTER_VERSION } from './providers/gemini/constants.js';
import { reconcileJobState } from './reconciliation-manager.js';
import { resolveCurrentJob } from './popup-core.js';
import {
  isProviderExecutionInFlight,
  computeQueueCounters,
  IN_FLIGHT_EXECUTION_STATES,
  REVIEW_PENDING_STATES,
  WAITING_QUEUE_STATES
} from './execution-state.js';

import { EXTENSION_VERSION, detectEnvironment } from './constants.js';
import { collectDiagnosticSnapshot, formatDiagnosticSnapshotText } from './diagnostic-snapshot.js';

const storage = createChromeStorage();
const blobStore = new IndexedDbBlobStore();
const derivativeStore = new IndexedDbDerivativeStore();
const logger = new Logger();
const audit = new AuditLogger({ storage, component: 'background' });
let controller = null;
const chatGptTabs = new ChatGptTabController({ chromeApi: chrome, storage });
const geminiTabs = new GeminiTabController({ chromeApi: chrome, storage });
const chatGptHandshake = new ChatGptHandshakeManager({ storage, tabController: chatGptTabs });
const providerDetector = new BrowserProviderDetector({ chromeApi: chrome, storage });
const multiProvider = new MultiProviderOrchestrator({ chromeApi: chrome, storage, logger });

const RUNTIME_EXTENSION_VERSION = chrome.runtime?.getManifest?.()?.version ?? EXTENSION_VERSION;
const RUNTIME_BOOT_ID = `boot_${crypto.randomUUID().slice(0, 8)}`;
const RUNTIME_STARTED_AT = new Date().toISOString();

async function recordRuntimeBoot() {
  try {
    if (chrome.storage?.local?.set) {
      await chrome.storage.local.set({
        runtime_extension_version: RUNTIME_EXTENSION_VERSION,
        runtime_boot_id: RUNTIME_BOOT_ID,
        runtime_started_at: RUNTIME_STARTED_AT
      });
    }
    await storage.update((state) => {
      state.runtime_extension_version = RUNTIME_EXTENSION_VERSION;
      state.runtime_boot_id = RUNTIME_BOOT_ID;
      state.runtime_started_at = RUNTIME_STARTED_AT;
    });
  } catch (error) {
    logger.warn('failed to record runtime boot marker', { error: error?.message });
  }
}
void recordRuntimeBoot();

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

async function readOnlyGeminiDiagnostic(tabId) {
  const message = {
    id: crypto.randomUUID(),
    provider: 'gemini',
    type: 'GEMINI_PROVIDER_DIAGNOSTIC',
    version: GEMINI_DOM_ADAPTER_VERSION
  };
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!chrome.scripting?.executeScript) throw error;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/providers/gemini/content-script.js']
    });
    return chrome.tabs.sendMessage(tabId, { ...message, id: crypto.randomUUID() });
  }
}

async function ensureController() {
  const state = await storage.readState();
  const isGeminiActive = state.provider?.active_provider_id === PROVIDER_GEMINI;
  const activeProviderAdapter = isGeminiActive
    ? new GeminiProviderAdapter({ tabController: geminiTabs })
    : new ChatGptProviderAdapter({ tabController: chatGptTabs });

  controller = new LokaMediaController({
    apiClient: new ApiClient({
      baseUrl: state.config.serverBaseUrl,
      deviceToken: state.config.deviceToken,
      environment: state.activeEnvironment || 'local'
    }),
    storage,
    blobStore,
    derivativeStore,
    provider: activeProviderAdapter,
    logger,
    audit
  });
  return controller;
}

async function refreshServerState() {
  const state = await storage.readState();
  const activeEnv = state.activeEnvironment || 'local';
  const detectedEnv = detectEnvironment(state.config.serverBaseUrl);

  if (activeEnv !== detectedEnv) {
    logger.error('CRITICAL: Environment and serverBaseUrl mismatch in refreshServerState', { activeEnv, detectedEnv, url: state.config.serverBaseUrl });
    await storage.update((nextState) => {
      nextState.status.connection = 'offline';
      nextState.status.last_error = `ENVIRONMENT_URL_MISMATCH: Environment '${activeEnv}' does not match URL '${state.config.serverBaseUrl}'`;
    });
    return storage.readState();
  }

  const isLocalDev = activeEnv === 'local' || detectedEnv === 'local';
  if (!state.config.deviceToken && !isLocalDev) {
    await storage.update((nextState) => {
      if (nextState.status.connection !== 'backpressure') {
        nextState.status.connection = 'offline';
      }
    });
    return storage.readState();
  }

  const instance = await ensureController();
  try {
      const response = await instance.apiClient.listJobs({ status: 'all', limit: 50 });
      await storage.update((nextState) => {
        nextState.status.connection = 'online';
        if (response.expected_extension_version) {
          nextState.expected_extension_version = response.expected_extension_version;
        }
        if (/WorkerGlobalScope|Illegal_invocation|Illegal invocation|fetch|HTTP_\d+|SERVER_UNAVAILABLE|ECONNREFUSED|INTERNAL_ERROR/i.test(String(nextState.status.last_error || ''))) {
          nextState.status.last_error = null;
        }
        if (nextState.auditLog?.lastAction === 'Run Once requested' && !nextState.locks?.activeRun) {
          nextState.auditLog.lastAction = 'Idle';
        }
        if (!nextState.config.deviceId) {
          nextState.config.deviceId = isLocalDev ? 'dev_local_tokenless' : 'dev_local_human_operator_v3';
        }
      for (const job of response.jobs ?? []) {
        const local = nextState.jobs[job.job_id] ?? {};
        const recon = reconcileJobState(local, job);
        const merged = {
          ...local,
          ...job,
          local_state: recon.local_state,
          result_checkpoint: local.result_checkpoint ?? job.result_checkpoint ?? null
        };
        if (recon.preserved_durable_stage && local.blob_key) {
          merged.blob_key = local.blob_key;
          merged.sha256 = local.sha256;
          merged.mime = local.mime;
          merged.width = local.width;
          merged.height = local.height;
          merged.size = local.size;
        }
        if (recon.needs_attention) {
          merged.needs_attention = true;
          merged.attention_reason = recon.inconsistency_reason;
        }

        // Generic convergence rule (Section 11):
        // Safe server-authoritative QUEUED state supersedes stale, non-consumed transient client failure state.
        const isSafeServerQueued =
          job.status === 'QUEUED' &&
          !job.lease_owner &&
          !job.last_error_code &&
          job.attempt === 0 &&
          !nextState.locks?.activeRun;

        if (isSafeServerQueued) {
          merged.last_error = null;
          merged.needs_attention = false;
          delete merged.attention_reason;

          // Preserve any existing phase4bSingleRun to job-scoped history
          nextState.phase4bJobGates ??= {};
          if (nextState.phase4bSingleRun?.job_id) {
            nextState.phase4bJobGates[nextState.phase4bSingleRun.job_id] = nextState.phase4bSingleRun;
          }

          // If current active gate is for another job, unbind active pointer so new job is not blocked
          if (nextState.phase4bSingleRun && nextState.phase4bSingleRun.job_id !== job.job_id) {
            nextState.phase4bSingleRun = null;
          }

          const gate = nextState.phase4bJobGates[job.job_id] || nextState.phase4bSingleRun;
          if (gate && gate.job_id === job.job_id) {
            const isNonConsumedPreSubmissionError =
              gate.last_error === 'DOM_CONTRACT_UNSUPPORTED' ||
              gate.last_error === 'PROMPT_INSERTION_VERIFICATION_FAILED' ||
              gate.last_error === 'SEND_CONTROL_UNAVAILABLE' ||
              gate.last_error === 'SEND_CONTROL_DISABLED' ||
              gate.last_error === 'AUTH_REQUIRED' ||
              gate.last_error === 'PROVIDER_PRECHECK_FAIL';

            const canSafelyClearGate =
              isNonConsumedPreSubmissionError ||
              (!gate.submission_consumed && !gate.generation_consumed);

            // Invariant: NEVER clear state if submission is uncertain or generation may have started
            if (canSafelyClearGate) {
              delete nextState.phase4bJobGates[job.job_id];
              nextState.phase4bSingleRun = null;
              if (typeof nextState.auditLog?.lastAction === 'string' && nextState.auditLog.lastAction.startsWith('Needs attention')) {
                nextState.auditLog.lastAction = 'Idle';
              }
              if (nextState.status.last_error) {
                nextState.status.last_error = null;
              }
            }
          } else {
            if (nextState.status.last_error) {
              nextState.status.last_error = null;
            }
          }
        }

        nextState.jobs[job.job_id] = merged;
      }
      nextState.currentJobId = resolveCurrentJob(nextState)?.job_id || null;
      updateQueueCounters(nextState);
    });
  } catch (error) {
    await storage.update((nextState) => {
      nextState.status.connection = 'offline';
      nextState.status.last_error = String(error?.message || error || 'SERVER_UNAVAILABLE').slice(0, 80);
    });
  }
  return storage.readState();
}

function updateQueueCounters(state) {
  const counters = computeQueueCounters(state);
  state.counters = {
    ...state.counters,
    ...counters
  };
}

chrome.runtime.onInstalled.addListener(() => {
  void storage.initialize();
  void recordRuntimeBoot();
});

chrome.runtime.onStartup.addListener(() => {
  void recordRuntimeBoot();
  void ensureController().then((instance) => instance.startup());
});

chrome.alarms.create('lokamedia_tick', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'lokamedia_tick') {
    void ensureController().then((instance) => instance.startup()).catch((error) => logger.warn('startup reconcile failed', { error: error.message }));
  }
});

export async function getActiveBrowserTab(chromeApi = chrome, targetWindowId = null) {
  if (!chromeApi?.tabs?.query) return null;
  try {
    if (targetWindowId != null) {
      const winTabs = await chromeApi.tabs.query({ active: true, windowId: targetWindowId });
      const validWin = winTabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
      if (validWin?.length) return validWin[0];
    }

    if (chromeApi.windows?.getLastFocused) {
      try {
        const focusedWin = await chromeApi.windows.getLastFocused({ populate: false, windowTypes: ['normal'] });
        if (focusedWin?.id != null) {
          const tabs = await chromeApi.tabs.query({ active: true, windowId: focusedWin.id });
          const valid = tabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
          if (valid?.length) return valid[0];
        }
      } catch {}
    }

    let tabs = await chromeApi.tabs.query({ active: true, lastFocusedWindow: true });
    let valid = tabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
    if (valid?.length) return valid[0];

    tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
    valid = tabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
    if (valid?.length) return valid[0];

    tabs = await chromeApi.tabs.query({ active: true });
    valid = tabs?.filter((t) => t.id != null && t.url && !t.url.startsWith('chrome-extension://'));
    if (valid?.length) return valid[0];
  } catch {}
  return null;
}

export async function reconcileActiveBrowserTab(args = {}) {
  try {
    const params = typeof args === 'number' ? { tabId: args } : (args || {});
    const { tabId = null, windowId = null, windowContext = null } = params;

    const state = await storage.readState();

  // Rule 1: Genuine running media job lock preservation
  const isJobActive = isProviderExecutionInFlight(state);

  if (isJobActive) {
    const activeLock = state.locks?.providerLock;
    const lockedProvider = activeLock?.providerId || state.provider?.active_provider_id || PROVIDER_CHATGPT;
    const lockedTabId = activeLock?.tabId ||
      (lockedProvider === PROVIDER_GEMINI ? state.provider?.gemini?.provider_tab_id : state.provider?.chatgpt?.provider_tab_id);

    const diagnostics = {
      last_focused_window_id: windowId ?? null,
      active_tab_id: lockedTabId ?? null,
      selected_provider_origin: PERMITTED_ORIGINS[lockedProvider] ?? null,
      bound_tab_id: lockedTabId ?? null,
      active_job_lock_state: 'LOCKED_BY_JOB',
      selection_reason: 'ACTIVE_JOB_LOCK_PRESERVED',
      evaluated_at: new Date().toISOString()
    };
    await storage.update((st) => {
      st.provider ??= {};
      st.provider.diagnostics = diagnostics;
    });
    logger.info('reconcileActiveBrowserTab: job active, preserving provider lock', diagnostics);
    return;
  }

  // Phase 1 / Rule 2: Operator is idle. Determine the foreground tab in operator's normal browser window.
  let targetTab = null;
  let targetWindowId = windowContext?.windowId ?? windowId ?? null;

  if (windowContext?.tabId && windowContext?.tabUrl && !windowContext.tabUrl.startsWith('chrome-extension://')) {
    targetTab = { id: windowContext.tabId, url: windowContext.tabUrl, windowId: targetWindowId };
  } else if (tabId != null && chrome.tabs?.get) {
    try {
      const t = await chrome.tabs.get(tabId);
      if (t?.url && !t.url.startsWith('chrome-extension://')) {
        targetTab = t;
        targetWindowId = t.windowId ?? targetWindowId;
      }
    } catch {}
  }

  if (!targetTab) {
    targetTab = await getActiveBrowserTab(chrome, targetWindowId);
    targetWindowId = targetTab?.windowId ?? targetWindowId;
  }

  const foregroundProviderId = targetTab?.url ? providerDetector.identifyUrlProvider(targetTab.url) : null;
  const discovery = await providerDetector.discoverAvailableProviders();

  if (foregroundProviderId === PROVIDER_GEMINI) {
    // Operator is visibly on Google Gemini
    await storage.update((st) => {
      st.provider ??= {};
      st.provider.active_provider_id = PROVIDER_GEMINI;
      if (st.provider.chatgpt && st.provider.chatgpt.target_state === 'LOCKED') {
        st.provider.chatgpt.target_state = 'UNBOUND';
        st.provider.chatgpt.auth_state = 'UNKNOWN';
        st.provider.chatgpt.dom_status = 'UNKNOWN';
        st.provider.chatgpt.composer_status = 'unavailable';
        st.provider.chatgpt.capabilities = {};
        st.provider.chatgpt.provider_tab_id = null;
      }
      st.provider.diagnostics = {
        last_focused_window_id: targetWindowId ?? null,
        active_tab_id: targetTab.id,
        selected_provider_origin: PERMITTED_ORIGINS[PROVIDER_GEMINI],
        bound_tab_id: targetTab.id,
        active_job_lock_state: 'IDLE',
        selection_reason: 'FOREGROUND_WINDOW_GEMINI',
        evaluated_at: new Date().toISOString()
      };
    });

    await geminiTabs.bindActiveTab(targetTab.id);
    try {
      const capabilities = await readOnlyGeminiDiagnostic(targetTab.id);
      await storage.update((next) => {
        next.provider ??= {};
        next.provider.active_provider_id = PROVIDER_GEMINI;
        next.provider.gemini ??= {};
        next.provider.gemini.capabilities = capabilities.capabilities;
        next.provider.gemini.auth_state = capabilities.capabilities?.auth_state ?? 'UNKNOWN';
        next.provider.gemini.dom_status = capabilities.capabilities?.dom_status ?? 'UNKNOWN';
        next.provider.gemini.composer_status = capabilities.capabilities?.capabilities?.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
        next.provider.gemini.visible_image_candidates = capabilities.capabilities?.image_candidate_count ?? 0;
        next.provider.gemini.provider_lane = next.locks?.providerLane ? 'bound' : 'idle';
        updateQueueCounters(next);
      });
    } catch (err) {
      logger.warn('Diagnostic after auto-bind Gemini failed', { error: err.message });
    }
  } else if (foregroundProviderId === PROVIDER_CHATGPT) {
    // Operator is visibly on ChatGPT
    await storage.update((st) => {
      st.provider ??= {};
      st.provider.active_provider_id = PROVIDER_CHATGPT;
      if (st.provider.gemini && st.provider.gemini.target_state === 'LOCKED') {
        st.provider.gemini.target_state = 'UNBOUND';
        st.provider.gemini.auth_state = 'UNKNOWN';
        st.provider.gemini.dom_status = 'UNKNOWN';
        st.provider.gemini.composer_status = 'unavailable';
        st.provider.gemini.capabilities = {};
        st.provider.gemini.provider_tab_id = null;
      }
      st.provider.diagnostics = {
        last_focused_window_id: targetWindowId ?? null,
        active_tab_id: targetTab.id,
        selected_provider_origin: PERMITTED_ORIGINS[PROVIDER_CHATGPT],
        bound_tab_id: targetTab.id,
        active_job_lock_state: 'IDLE',
        selection_reason: 'FOREGROUND_WINDOW_CHATGPT',
        evaluated_at: new Date().toISOString()
      };
    });

    await chatGptTabs.bindActiveTab(targetTab.id);
    try {
      const capabilities = await readOnlyChatGptDiagnostic(targetTab.id);
      await storage.update((next) => {
        next.provider ??= {};
        next.provider.active_provider_id = PROVIDER_CHATGPT;
        next.provider.chatgpt ??= {};
        next.provider.chatgpt.capabilities = capabilities.capabilities;
        next.provider.chatgpt.auth_state = capabilities.capabilities?.auth_state ?? 'UNKNOWN';
        next.provider.chatgpt.dom_status = capabilities.capabilities?.dom_status ?? 'UNKNOWN';
        next.provider.chatgpt.composer_status = capabilities.capabilities?.capabilities?.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
        next.provider.chatgpt.visible_image_candidates = capabilities.capabilities?.image_candidate_count ?? 0;
        next.provider.chatgpt.provider_lane = next.locks?.providerLane ? 'bound' : 'idle';
        updateQueueCounters(next);
      });
    } catch (err) {
      logger.warn('Diagnostic after auto-bind ChatGPT failed', { error: err.message });
    }
  } else {
    // Foreground tab is neither Gemini nor ChatGPT
    // Rule 3: Never select an arbitrary ChatGPT/Gemini tab from another window as silent fallback!
    // Rule 4: If multiple windows or tabs are ambiguous, request explicit provider selection.
    // Rule 5: Release stale idle bindings safely.
    let reason = 'NO_PROVIDER_OPEN';
    if (discovery.hasChatGpt && discovery.hasGemini) {
      reason = 'AMBIGUOUS_ACROSS_WINDOWS';
    } else if (discovery.hasChatGpt || discovery.hasGemini) {
      reason = 'PROVIDER_TAB_IN_BACKGROUND';
    }

    await storage.update((st) => {
      st.provider ??= {};
      st.provider.active_provider_id = null;
      if (st.provider.chatgpt?.target_state === 'LOCKED') {
        st.provider.chatgpt.target_state = 'UNBOUND';
        st.provider.chatgpt.auth_state = 'UNKNOWN';
        st.provider.chatgpt.dom_status = 'UNKNOWN';
        st.provider.chatgpt.composer_status = 'unavailable';
        st.provider.chatgpt.capabilities = {};
        st.provider.chatgpt.provider_tab_id = null;
      }
      if (st.provider.gemini?.target_state === 'LOCKED') {
        st.provider.gemini.target_state = 'UNBOUND';
        st.provider.gemini.auth_state = 'UNKNOWN';
        st.provider.gemini.dom_status = 'UNKNOWN';
        st.provider.gemini.composer_status = 'unavailable';
        st.provider.gemini.capabilities = {};
        st.provider.gemini.provider_tab_id = null;
      }
      st.provider.diagnostics = {
        last_focused_window_id: targetWindowId ?? null,
        active_tab_id: targetTab?.id ?? null,
        selected_provider_origin: null,
        bound_tab_id: null,
        active_job_lock_state: 'IDLE',
        selection_reason: reason,
        evaluated_at: new Date().toISOString()
      };
    });
  }
  } catch (err) {
    logger.warn('reconcileActiveBrowserTab failed', { error: err?.message || String(err) });
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void chatGptTabs.handleTabRemoved(tabId);
  void geminiTabs.handleTabRemoved(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void chatGptTabs.handleTabUpdated(tabId, changeInfo, tab);
  void geminiTabs.handleTabUpdated(tabId, changeInfo, tab);
  if (changeInfo.status === 'complete' && tab?.url) {
    void reconcileActiveBrowserTab({ tabId, windowId: tab.windowId });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  void reconcileActiveBrowserTab({ tabId: activeInfo.tabId, windowId: activeInfo.windowId });
});

if (chrome.windows?.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    void reconcileActiveBrowserTab({ windowId });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const protocol = new MessageProtocol(storage);
  void protocol.handle(message, {
    STATUS: async (request) => {
      const stateBefore = await storage.readState();
      const isJobActive = isProviderExecutionInFlight(stateBefore);
      if (!isJobActive) {
        await reconcileActiveBrowserTab({
          windowId: request?.windowContext?.windowId,
          tabId: request?.windowContext?.tabId,
          windowContext: request?.windowContext
        });
      }
      const state = await refreshServerState();
      return {
        ok: true,
        state,
        runtime_extension_version: RUNTIME_EXTENSION_VERSION,
        runtime_boot_id: RUNTIME_BOOT_ID,
        runtime_started_at: RUNTIME_STARTED_AT
      };
    },
    SAVE_CONFIG: async (request) => {
      const config = { ...request.config };
      const currentState = await storage.readState();
      const currentEnv = currentState.activeEnvironment || 'local';
      if (!config.deviceId) {
        config.deviceId = (currentEnv === 'local' || detectEnvironment(config.serverBaseUrl) === 'local')
          ? 'dev_local_tokenless'
          : 'dev_local_human_operator_v3';
      }
      await storage.saveConfig(config);
      return { ok: true };
    },
    SWITCH_ENVIRONMENT: async (request) => {
      const stateBefore = await storage.readState();
      if (isProviderExecutionInFlight(stateBefore)) {
        return { ok: false, error: 'EXECUTION_IN_FLIGHT', message: 'Cannot switch environment while media execution is in flight' };
      }
      const targetEnv = request?.environment;
      const customUrl = request?.customUrl || null;
      try {
        const nextState = await storage.switchEnvironment(targetEnv, customUrl);
        controller = null;
        let refreshedState = nextState;
        try {
          refreshedState = await refreshServerState();
        } catch (err) {
          logger.warn('Failed to refresh server state after environment switch', { error: err.message });
        }
        return { ok: true, state: refreshedState || nextState };
      } catch (err) {
        return { ok: false, error: 'SWITCH_FAILED', message: err.message };
      }
    },
    RESET_SINGLE_RUN: async () => {
      await storage.resetPhase4bSingleRun();
      return { ok: true };
    },
    TICK: async () => ({ ok: false, error: 'PHASE_4B_NOT_ARMED' }),
    RUN_ONCE: async (request) => {
      const runId = request?.runId || `run_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const state = await storage.readState();
      const acquisitionProbe = Boolean(request?.acquisitionProbe ?? state.config?.acquisitionProbe);
      const providerResultProbe = Boolean(request?.providerResultProbe ?? state.config?.providerResultProbe);
      const captureBlobProbe = Boolean(request?.captureBlobProbe ?? state.config?.captureBlobProbe);
      await audit.info('PANEL_RUN_CLICK', { run_id: runId, component: 'side-panel' });
      await audit.info('RUN_REQUEST_DISPATCHED', { run_id: runId, component: 'side-panel' });

      const lockResult = await storage.acquireActiveRunLock({ runId });
      if (!lockResult.acquired) {
        await audit.warn('RUN_REENTRY_REJECTED', {
          run_id: runId,
          component: 'background',
          details: { active_run_id: lockResult.lock?.run_id }
        });
        return { ok: false, error: 'RUN_ALREADY_ACTIVE', run_id: runId };
      }

      await audit.info('RUN_REQUEST_ACCEPTED', { run_id: runId, component: 'background' });
      try {
        const instance = await ensureController();
        const result = await instance.runOnce({ runId, acceptedLogged: true, acquisitionProbe, providerResultProbe, captureBlobProbe });
        if (!result?.ok) {
          await storage.update((st) => {
            if (st.auditLog?.lastAction === 'Run Once requested') {
              st.auditLog.lastAction = 'Idle';
            }
          });
        }
        return result;
      } catch (error) {
        await storage.releaseActiveRunLock({ runId });
        await storage.update((st) => {
          if (st.auditLog?.lastAction === 'Run Once requested') {
            st.auditLog.lastAction = 'Idle';
          }
        });
        throw error;
      }
    },
    RUN_CHECKPOINT_RECOVERY: async (request) => {
      const runId = request?.runId || `run_rec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const state = await storage.readState();
      const captureBlobProbe = Boolean(request?.captureBlobProbe ?? state.config?.captureBlobProbe);
      await audit.info('PANEL_RUN_CLICK', { run_id: runId, component: 'side-panel', mode: 'recovery' });
      await audit.info('RUN_REQUEST_DISPATCHED', { run_id: runId, component: 'side-panel', mode: 'recovery' });

      const lockResult = await storage.acquireActiveRunLock({ runId });
      if (!lockResult.acquired) {
        await audit.warn('RUN_REENTRY_REJECTED', {
          run_id: runId,
          component: 'background',
          details: { active_run_id: lockResult.lock?.run_id }
        });
        return { ok: false, error: 'RUN_ALREADY_ACTIVE', run_id: runId };
      }

      await audit.info('RUN_REQUEST_ACCEPTED', { run_id: runId, component: 'background', mode: 'recovery' });
      try {
        const instance = await ensureController();
        return await instance.runCheckpointRecovery(request?.jobId || request?.job, {
          runId,
          acceptedLogged: true,
          captureBlobProbe
        });
      } catch (error) {
        await storage.releaseActiveRunLock({ runId });
        throw error;
      }
    },
    AUDIT_STATUS: async (request) => {
      const state = await storage.readState();
      const gate = state.phase4bSingleRun || {};
      const currentJob = Object.values(state.jobs ?? {}).find((j) => ['SUBMITTING', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED', 'UPLOADING', 'QUEUED', 'WAITING_RETRY'].includes(j.local_state ?? j.status));
      const targetJobId = request.currentJob ? (gate.job_id || currentJob?.job_id || null) : null;
      const events = await storage.listAuditEvents({
        level: request.level || 'ALL',
        runId: request.currentRun ? gate.phase4b_single_run_id : null,
        jobId: targetJobId,
        limit: request.limit || 100
      });
      return { ok: true, events, lastAction: state.auditLog?.lastAction || 'Idle', maxEvents: MAX_AUDIT_EVENTS, retentionDays: AUDIT_RETENTION_DAYS };
    },
    AUDIT_COPY_TEXT: async () => {
      const state = await storage.readState();
      const events = await storage.listAuditEvents({ limit: MAX_AUDIT_EVENTS });
      return { ok: true, text: formatAuditText({ events, state }) };
    },
    AUDIT_EXPORT_JSON: async () => {
      const state = await storage.readState();
      const events = await storage.listAuditEvents({ limit: MAX_AUDIT_EVENTS });
      return { ok: true, payload: { generated_at: new Date().toISOString(), events, last_action: state.auditLog?.lastAction || 'Idle' } };
    },
    AUDIT_CLEAR: async () => {
      await storage.clearAuditEvents();
      return { ok: true, state: await storage.readState() };
    },
    CHATGPT_PROVIDER_HELLO: async (request) => chatGptHandshake.handle(request, sender),
    GEMINI_PROVIDER_HELLO: async (request) => {
      if (request?.capabilities) {
        await storage.update((state) => {
          state.provider ??= {};
          state.provider.gemini ??= {};
          state.provider.gemini.capabilities = request.capabilities.capabilities;
          state.provider.gemini.auth_state = request.capabilities.auth_state;
          state.provider.gemini.dom_status = request.capabilities.dom_status;
          state.provider.gemini.composer_status = request.capabilities.capabilities?.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
          state.provider.gemini.visible_image_candidates = request.capabilities.image_candidate_count;
        });
      }
      return { ok: true, version: GEMINI_DOM_ADAPTER_VERSION };
    },
    DETECT_BROWSER_PROVIDERS: async (request) => {
      const detection = await providerDetector.detectAndSelectProvider(request || {});
      return { ok: true, detection, state: await storage.readState() };
    },
    BIND_PROVIDER_TAB: async (request) => {
      let targetTabId = request?.tabId ?? request?.windowContext?.tabId;
      let targetTab = null;
      if (targetTabId && chrome.tabs?.get) {
        try {
          targetTab = await chrome.tabs.get(targetTabId);
        } catch {}
      }
      if (!targetTab || !targetTab.url || targetTab.url.startsWith('chrome-extension://')) {
        targetTab = await getActiveBrowserTab(chrome, request?.windowId ?? request?.windowContext?.windowId);
        targetTabId = targetTab?.id ?? null;
      }

      const providerId = targetTab?.url ? providerDetector.identifyUrlProvider(targetTab.url) : null;

      if (providerId === PROVIDER_GEMINI) {
        await storage.update((st) => {
          st.provider ??= {};
          st.provider.active_provider_id = PROVIDER_GEMINI;
          if (st.provider.chatgpt && st.provider.chatgpt.target_state === 'LOCKED') {
            st.provider.chatgpt.target_state = 'UNBOUND';
            st.provider.chatgpt.auth_state = 'UNKNOWN';
            st.provider.chatgpt.dom_status = 'UNKNOWN';
            st.provider.chatgpt.composer_status = 'unavailable';
            st.provider.chatgpt.capabilities = {};
            st.provider.chatgpt.provider_tab_id = null;
          }
          st.provider.diagnostics = {
            last_focused_window_id: targetTab?.windowId ?? request?.windowId ?? null,
            active_tab_id: targetTabId,
            selected_provider_origin: PERMITTED_ORIGINS[PROVIDER_GEMINI],
            bound_tab_id: targetTabId,
            active_job_lock_state: 'IDLE',
            selection_reason: 'FOREGROUND_WINDOW_GEMINI',
            evaluated_at: new Date().toISOString()
          };
        });

        const bindResult = await geminiTabs.bindActiveTab(targetTabId);
        if (!bindResult.ok) {
          return {
            ok: false,
            error: bindResult.status || 'BIND_FAILED',
            message: bindResult.message,
            state: await storage.readState()
          };
        }
        try {
          const capabilities = await readOnlyGeminiDiagnostic(bindResult.tab_id);
          await storage.update((state) => {
            state.provider ??= {};
            state.provider.active_provider_id = PROVIDER_GEMINI;
            state.provider.gemini ??= {};
            state.provider.gemini.capabilities = capabilities.capabilities;
            state.provider.gemini.auth_state = capabilities.capabilities?.auth_state ?? 'UNKNOWN';
            state.provider.gemini.dom_status = capabilities.capabilities?.dom_status ?? 'UNKNOWN';
            state.provider.gemini.composer_status = capabilities.capabilities?.capabilities?.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
            state.provider.gemini.visible_image_candidates = capabilities.capabilities?.image_candidate_count ?? 0;
            state.provider.gemini.provider_lane = state.locks?.providerLane ? 'bound' : 'idle';
            updateQueueCounters(state);
          });
        } catch (err) {
          logger.warn('Diagnostic after Gemini tab bind failed', { error: err.message });
        }
        await audit.info('PROVIDER_TAB_BOUND', {
          provider: 'GEMINI_BROWSER',
          tab_id: bindResult.tab_id,
          target_state: 'LOCKED',
          bound_url: bindResult.bound_url,
          component: 'side-panel'
        });
        return { ok: true, provider: 'GEMINI_BROWSER', bindResult, state: await storage.readState() };
      }

      if (providerId === PROVIDER_CHATGPT) {
        await storage.update((st) => {
          st.provider ??= {};
          st.provider.active_provider_id = PROVIDER_CHATGPT;
          if (st.provider.gemini && st.provider.gemini.target_state === 'LOCKED') {
            st.provider.gemini.target_state = 'UNBOUND';
            st.provider.gemini.auth_state = 'UNKNOWN';
            st.provider.gemini.dom_status = 'UNKNOWN';
            st.provider.gemini.composer_status = 'unavailable';
            st.provider.gemini.capabilities = {};
            st.provider.gemini.provider_tab_id = null;
          }
          st.provider.diagnostics = {
            last_focused_window_id: targetTab?.windowId ?? request?.windowId ?? null,
            active_tab_id: targetTabId,
            selected_provider_origin: PERMITTED_ORIGINS[PROVIDER_CHATGPT],
            bound_tab_id: targetTabId,
            active_job_lock_state: 'IDLE',
            selection_reason: 'FOREGROUND_WINDOW_CHATGPT',
            evaluated_at: new Date().toISOString()
          };
        });

        const bindResult = await chatGptTabs.bindActiveTab(targetTabId);
        if (!bindResult.ok) {
          return {
            ok: false,
            error: bindResult.status || 'BIND_FAILED',
            message: bindResult.message,
            state: await storage.readState()
          };
        }
        try {
          const capabilities = await readOnlyChatGptDiagnostic(bindResult.tab_id);
          await storage.update((state) => {
            state.provider ??= {};
            state.provider.active_provider_id = PROVIDER_CHATGPT;
            state.provider.chatgpt ??= {};
            state.provider.chatgpt.capabilities = capabilities.capabilities;
            state.provider.chatgpt.auth_state = capabilities.capabilities?.auth_state ?? 'UNKNOWN';
            state.provider.chatgpt.dom_status = capabilities.capabilities?.dom_status ?? 'UNKNOWN';
            state.provider.chatgpt.composer_status = capabilities.capabilities?.capabilities?.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
            state.provider.chatgpt.visible_image_candidates = capabilities.capabilities?.image_candidate_count ?? 0;
            state.provider.chatgpt.provider_lane = state.locks?.providerLane ? 'bound' : 'idle';
            updateQueueCounters(state);
          });
        } catch (err) {
          logger.warn('Diagnostic after ChatGPT tab bind failed', { error: err.message });
        }
        await audit.info('PROVIDER_TAB_BOUND', {
          provider: 'CHATGPT_BROWSER',
          tab_id: bindResult.tab_id,
          target_state: 'LOCKED',
          bound_url: bindResult.bound_url,
          component: 'side-panel'
        });
        return { ok: true, provider: 'CHATGPT_BROWSER', bindResult, state: await storage.readState() };
      }

      return {
        ok: false,
        error: 'NOT_A_PROVIDER_TAB',
        message: 'Active tab is neither gemini.google.com nor chatgpt.com',
        state: await storage.readState()
      };
    },
    READ_ONLY_PROVIDER_DIAGNOSTIC: async (request) => {
      let state = await storage.readState();
      const isJobActive = isProviderExecutionInFlight(state);

      if (!isJobActive) {
        await reconcileActiveBrowserTab({
          windowId: request?.windowContext?.windowId ?? request?.windowId,
          tabId: request?.windowContext?.tabId ?? request?.tabId,
          windowContext: request?.windowContext
        });
        state = await storage.readState();
      }

      const isGemini = state.provider?.active_provider_id === PROVIDER_GEMINI;

      if (isGemini) {
        const tab = await geminiTabs.locateTab();
        if (!tab.ok) {
          return { ok: false, provider: 'Gemini', tab, error: tab.status || 'TAB_MISSING', state: await storage.readState() };
        }
        const capabilities = await readOnlyGeminiDiagnostic(tab.tab_id);
        await storage.update((st) => {
          st.provider ??= {};
          st.provider.gemini ??= {};
          st.provider.gemini.capabilities = capabilities.capabilities;
          st.provider.gemini.auth_state = capabilities.capabilities?.auth_state ?? 'UNKNOWN';
          st.provider.gemini.dom_status = capabilities.capabilities?.dom_status ?? 'UNKNOWN';
          st.provider.gemini.composer_status = capabilities.capabilities?.capabilities?.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
          st.provider.gemini.visible_image_candidates = capabilities.capabilities?.image_candidate_count ?? 0;
          st.provider.gemini.provider_lane = st.locks?.providerLane ? 'bound' : 'idle';
          updateQueueCounters(st);
        });
        return { ok: true, provider: 'Gemini', tab, capabilities, state: await refreshServerState() };
      }

      const tab = await chatGptTabs.locateTab();
      if (!tab.ok) {
        return { ok: false, provider: 'ChatGPT', tab, error: tab.status || 'TAB_MISSING', state: await storage.readState() };
      }
      const capabilities = await readOnlyChatGptDiagnostic(tab.tab_id);
      await storage.update((st) => {
        st.provider ??= {};
        st.provider.chatgpt ??= {};
        st.provider.chatgpt.capabilities = capabilities.capabilities;
        st.provider.chatgpt.auth_state = capabilities.capabilities?.auth_state ?? 'UNKNOWN';
        st.provider.chatgpt.dom_status = capabilities.capabilities?.dom_status ?? 'UNKNOWN';
        st.provider.chatgpt.composer_status = capabilities.capabilities?.capabilities?.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
        st.provider.chatgpt.visible_image_candidates = capabilities.capabilities?.image_candidate_count ?? 0;
        st.provider.chatgpt.provider_lane = st.locks?.providerLane ? 'bound' : 'idle';
        updateQueueCounters(st);
      });
      return { ok: true, provider: 'ChatGPT', tab, capabilities, state: await refreshServerState() };
    },
    ACQUIRE_JOB_LEASE: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.acquireJobLease(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    SEND_TO_PROVIDER: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.sendToProvider(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    SEND_TO_CHATGPT: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.sendToProvider(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    CAPTURE_LATEST_IMAGE: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.captureLatestImage(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    APPROVE_AND_UPLOAD: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.approveAndUpload(request);
        return { ...result, state: await refreshServerState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    REJECT_RESULT: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.rejectResult(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    SAVE_LOCAL_FILE_CANDIDATE: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.saveLocalFileCandidate(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    INGEST_MANUAL_CANDIDATE: async (request) => {
      try {
        const opId = request?.opId || 'unknown';
        console.info(`[LokaMedia:ImportTrace] [B3:BackgroundRx] opId=${opId} jobId=${request?.jobId} receivedSourceSha=${request?.sha256} payloadLength=${request?.bytes?.length ?? 0}`);
        const instance = await ensureController();
        const result = await instance.ingestCandidateBinary(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        console.error('[LokaMedia:Import] Background candidate ingestion failed:', error);
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    GET_BLOB_PREVIEW: async (request) => {
      const key = request?.key;
      if (!key) return { ok: false, error: 'KEY_REQUIRED' };
      let record = await blobStore.get(key);
      if ((!record || !record.bytes) && typeof derivativeStore !== 'undefined' && derivativeStore?.get) {
        record = await derivativeStore.get(key);
      }
      if (!record || !record.bytes) {
        console.info(`[LokaMedia:ImportTrace] [B7:GetBlobPreview] requestedKey=${key} found=false`);
        return { ok: false, error: 'BLOB_NOT_FOUND' };
      }
      const bytes = new Uint8Array(record.bytes);
      const chunkSize = 8192;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const dataUrl = `data:${record.mime || 'image/png'};base64,${base64}`;
      console.info(`[LokaMedia:ImportTrace] [B7:GetBlobPreview] requestedKey=${key} found=true responseSha=${record.sha256} mime=${record.mime} size=${record.size || bytes.length}`);
      return {
        ok: true,
        dataUrl,
        width: record.width,
        height: record.height,
        mime: record.mime,
        size: record.size,
        sha256: record.sha256
      };
    },
    MANUAL_PROMOTION_RESOLVE_ARTICLE: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.manualResolveArticle(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    MANUAL_PROMOTION_SET_FILE: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.manualSetLocalFile(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    MANUAL_PROMOTION_SET_ALT_TEXT: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.manualSetAltText(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    MANUAL_PROMOTION_APPROVE: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.manualApprovePromotion(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    MANUAL_PROMOTION_EXECUTE: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.manualExecutePromotion(request);
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    MANUAL_PROMOTION_RESET: async () => {
      try {
        const instance = await ensureController();
        const result = await instance.manualResetPromotion();
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    MANUAL_PROMOTION_CHECK_STATUS: async () => {
      try {
        const instance = await ensureController();
        const result = await instance.checkPromotionApprovalStatus();
        return { ...result, state: await storage.readState() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), state: await storage.readState() };
      }
    },
    SELECT_JOB: async (request) => {
      const jobId = request?.jobId || null;
      await storage.update((state) => {
        state.selectedJobId = jobId;
        if (jobId) state.currentJobId = jobId;
      });
      return { ok: true, state: await storage.readState() };
    },
    GET_DIAGNOSTIC_SNAPSHOT: async (request) => {
      const state = await storage.readState();
      const snapshot = await collectDiagnosticSnapshot({
        state,
        windowContext: request?.windowContext,
        manifestVersion: RUNTIME_EXTENSION_VERSION
      });
      const text = formatDiagnosticSnapshotText(snapshot);
      return { ok: true, snapshot, text };
    }
  }).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: String(error?.message || error || 'SERVICE_WORKER_UNAVAILABLE') });
  });
  return true;
});
