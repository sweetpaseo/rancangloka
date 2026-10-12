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
import { resolveCurrentJob } from './popup-core.js';

const storage = createChromeStorage();
const blobStore = new IndexedDbBlobStore();
const logger = new Logger();
const audit = new AuditLogger({ storage, component: 'background' });
let controller = null;
const chatGptTabs = new ChatGptTabController({ chromeApi: chrome, storage });
const chatGptHandshake = new ChatGptHandshakeManager({ storage, tabController: chatGptTabs });
const ACTIVE_QUEUE_STATES = new Set(['LEASED', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED', 'UPLOADING', 'RECOVERING']);
const WAITING_QUEUE_STATES = new Set(['QUEUED', 'WAITING_RETRY']);

const RUNTIME_EXTENSION_VERSION = chrome.runtime?.getManifest?.()?.version ?? '0.1.18';
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
        if (response.expected_extension_version) {
          nextState.expected_extension_version = response.expected_extension_version;
        }
        if (/WorkerGlobalScope|Illegal_invocation|Illegal invocation|fetch|HTTP_\d+|SERVER_UNAVAILABLE|ECONNREFUSED|INTERNAL_ERROR/i.test(String(nextState.status.last_error || ''))) {
          nextState.status.last_error = null;
        }
        if (nextState.auditLog?.lastAction === 'Run Once requested' && !nextState.locks?.activeRun) {
          nextState.auditLog.lastAction = 'Idle';
        }
        if (!nextState.config.deviceId && nextState.config.deviceToken) {
          nextState.config.deviceId = 'dev_local_human_operator_v3';
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
  const jobs = Object.values(state.jobs ?? {});
  state.counters.totalJobs = jobs.length;
  state.counters.complete = jobs.filter((job) => (job.local_state ?? job.status) === 'COMPLETE').length;
  state.counters.active = jobs.filter((job) => ACTIVE_QUEUE_STATES.has(job.local_state ?? job.status)).length;
  state.counters.waiting = jobs.filter((job) => WAITING_QUEUE_STATES.has(job.local_state ?? job.status)).length;
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

chrome.tabs.onRemoved.addListener((tabId) => {
  void chatGptTabs.handleTabRemoved(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void chatGptTabs.handleTabUpdated(tabId, changeInfo, tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const protocol = new MessageProtocol(storage);
  void protocol.handle(message, {
    STATUS: async () => {
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
      if (!config.deviceId && config.deviceToken) {
        config.deviceId = 'dev_local_human_operator_v3';
      }
      await storage.saveConfig(config);
      return { ok: true };
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
    BIND_PROVIDER_TAB: async (request) => {
      const bindResult = await chatGptTabs.bindActiveTab(request?.tabId);
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
          state.provider.chatgpt.capabilities = capabilities.capabilities;
          state.provider.chatgpt.auth_state = capabilities.capabilities?.auth_state ?? 'UNKNOWN';
          state.provider.chatgpt.dom_status = capabilities.capabilities?.dom_status ?? 'UNKNOWN';
          state.provider.chatgpt.composer_status = capabilities.capabilities?.capabilities?.COMPOSER_EDITABLE ? 'ready' : 'unavailable';
          state.provider.chatgpt.visible_image_candidates = capabilities.capabilities?.image_candidate_count ?? 0;
          state.provider.chatgpt.provider_lane = state.locks?.providerLane ? 'bound' : 'idle';
          updateQueueCounters(state);
        });
      } catch (err) {
        logger.warn('Diagnostic after tab bind failed', { error: err.message });
      }
      await audit.info('PROVIDER_TAB_BOUND', {
        tab_id: bindResult.tab_id,
        target_state: 'LOCKED',
        bound_url: bindResult.bound_url,
        component: 'side-panel'
      });
      return { ok: true, bindResult, state: await storage.readState() };
    },
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
    },
    SEND_TO_CHATGPT: async (request) => {
      try {
        const instance = await ensureController();
        const result = await instance.sendToChatGpt(request);
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
    GET_BLOB_PREVIEW: async (request) => {
      const key = request?.key;
      if (!key) return { ok: false, error: 'KEY_REQUIRED' };
      const record = await blobStore.get(key);
      if (!record || !record.bytes) return { ok: false, error: 'BLOB_NOT_FOUND' };
      let binary = '';
      const bytes = new Uint8Array(record.bytes);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const dataUrl = `data:${record.mime || 'image/png'};base64,${base64}`;
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
    }
  }).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: String(error?.message || error || 'SERVICE_WORKER_UNAVAILABLE') });
  });
  return true;
});
