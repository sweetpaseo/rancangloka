import { ApiClient } from './api-client.js';
import { IndexedDbBlobStore } from './blob-store.js';
import { LokaMediaController } from './controller.js';
import { createChromeStorage } from './storage.js';
import { MessageProtocol } from './messages.js';
import { Logger } from './logger.js';
import { ChatGptProviderAdapter } from './providers/chatgpt/adapter.js';
import { AuditLogger, formatAuditText, MAX_AUDIT_EVENTS, AUDIT_RETENTION_DAYS } from './audit-log.js';
import { ChatGptHandshakeManager } from './providers/chatgpt/handshake.js';
import { ChatGptTabController } from './providers/chatgpt/tab-controller.js';
import { CHATGPT_MESSAGE_TYPES } from './providers/chatgpt/constants.js';
import { reconcileJobState } from './reconciliation-manager.js';

const storage = createChromeStorage();
const blobStore = new IndexedDbBlobStore();
const logger = new Logger();
const audit = new AuditLogger({ storage, component: 'background' });
let controller = null;
const chatGptTabs = new ChatGptTabController({ chromeApi: chrome, storage });
const chatGptHandshake = new ChatGptHandshakeManager({ storage, tabController: chatGptTabs });
const ACTIVE_QUEUE_STATES = new Set(['LEASED', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED', 'UPLOADING', 'RECOVERING']);
const WAITING_QUEUE_STATES = new Set(['QUEUED', 'WAITING_RETRY']);

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
    logger,
    audit
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
        nextState.jobs[job.job_id] = merged;
      }
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
  const jobs = Object.values(state.jobs ?? {});
  state.counters.totalJobs = jobs.length;
  state.counters.complete = jobs.filter((job) => (job.local_state ?? job.status) === 'COMPLETE').length;
  state.counters.active = jobs.filter((job) => ACTIVE_QUEUE_STATES.has(job.local_state ?? job.status)).length;
  state.counters.waiting = jobs.filter((job) => WAITING_QUEUE_STATES.has(job.local_state ?? job.status)).length;
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
        return await instance.runOnce({ runId, acceptedLogged: true, acquisitionProbe, providerResultProbe, captureBlobProbe });
      } catch (error) {
        await storage.releaseActiveRunLock({ runId });
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
      const events = await storage.listAuditEvents({
        level: request.level || 'ALL',
        runId: request.currentRun ? gate.phase4b_single_run_id : null,
        jobId: request.currentJob ? gate.job_id : null,
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
        updateQueueCounters(state);
      });
      return { ok: true, provider: 'ChatGPT', tab, capabilities, state: await refreshServerState() };
    }
  }).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: String(error?.message || error || 'SERVICE_WORKER_UNAVAILABLE') });
  });
  return true;
});
