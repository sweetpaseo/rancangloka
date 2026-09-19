import { DEFAULT_CONFIG, EXTENSION_VERSION, STORAGE_SCHEMA_VERSION } from './constants.js';
import { AUDIT_RETENTION_DAYS, MAX_AUDIT_EVENTS } from './audit-log.js';

const DEFAULT_STATE = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  config: DEFAULT_CONFIG,
  extension_version: EXTENSION_VERSION,
  jobs: {},
  uploadQueue: [],
  processedMessages: [],
  locks: {},
  provider: {
    chatgpt: {
      provider_tab_id: null,
      tab_status: 'missing',
      auth_state: 'UNKNOWN',
      dom_status: 'UNKNOWN',
      composer_status: 'unavailable',
      visible_image_candidates: 0,
      provider_lane: 'idle',
      prompt_submission_enabled: false
    }
  },
  counters: {
    totalJobs: 0,
    complete: 0,
    active: 0,
    waiting: 0
  },
  status: {
    connection: 'offline',
    currentGeneration: null,
    transfers: []
  },
  phase4bSingleRun: null,
  auditLog: {
    events: [],
    lastAction: 'Idle',
    nextSequence: 1
  }
};

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export class MemoryStorageArea {
  constructor(initial = {}) {
    this.store = clone(initial);
  }

  async get(keys = null) {
    if (keys == null) return clone(this.store);
    if (typeof keys === 'string') return { [keys]: clone(this.store[keys]) };
    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, clone(this.store[key])]));
    }
    return Object.fromEntries(
      Object.entries(keys).map(([key, fallback]) => [
        key,
        this.store[key] === undefined ? clone(fallback) : clone(this.store[key])
      ])
    );
  }

  async set(values) {
    Object.assign(this.store, clone(values));
  }

  async remove(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete this.store[key];
  }
}

export class ExtensionStorage {
  constructor(area) {
    this.area = area;
  }

  static memory(initial = {}) {
    return new ExtensionStorage(new MemoryStorageArea(initial));
  }

  async initialize() {
    const { lokamediaState } = await this.area.get({ lokamediaState: null });
    if (!lokamediaState || lokamediaState.schemaVersion !== STORAGE_SCHEMA_VERSION) {
      await this.saveState(DEFAULT_STATE);
      return clone(DEFAULT_STATE);
    }
    return { ...clone(DEFAULT_STATE), ...clone(lokamediaState) };
  }

  async readState() {
    return this.initialize();
  }

  async saveState(state) {
    await this.area.set({ lokamediaState: clone(state) });
  }

  async update(mutator) {
    const state = await this.readState();
    const result = await mutator(state);
    await this.saveState(state);
    return result ?? state;
  }

  async saveConfig(config) {
    return this.update((state) => {
      state.config = { ...state.config, ...config };
    });
  }

  async upsertJob(jobId, patch) {
    return this.update((state) => {
      state.jobs[jobId] = {
        ...(state.jobs[jobId] ?? { job_id: jobId }),
        ...clone(patch),
        updated_at_local: new Date().toISOString()
      };
    });
  }

  async getJob(jobId) {
    const state = await this.readState();
    return clone(state.jobs[jobId] ?? null);
  }

  async listJobs() {
    const state = await this.readState();
    return Object.values(state.jobs).map(clone);
  }

  async enqueueUpload(jobId) {
    return this.update((state) => {
      if (!state.uploadQueue.includes(jobId)) state.uploadQueue.push(jobId);
    });
  }

  async dequeueUpload(jobId) {
    return this.update((state) => {
      state.uploadQueue = state.uploadQueue.filter((item) => item !== jobId);
    });
  }

  async armPhase4bSingleRun({ jobId, runId = crypto.randomUUID(), now = new Date().toISOString() }) {
    return this.update((state) => {
      const gate = state.phase4bSingleRun;
      if (gate?.submission_consumed || gate?.generation_consumed || gate?.completed_at) {
        return { armed: false, reason: 'PHASE_4B_RUN_CONSUMED', gate };
      }
      state.phase4bSingleRun = {
        phase4b_single_run_id: runId,
        job_id: jobId,
        armed_at: now,
        submission_consumed: false,
        generation_consumed: false,
        completed_at: null,
        last_error: null
      };
      return { armed: true, gate: state.phase4bSingleRun };
    });
  }

  async consumePhase4bSubmission({ jobId, now = new Date().toISOString() }) {
    return this.update((state) => {
      const gate = state.phase4bSingleRun;
      if (!gate) return { consumed: false, reason: 'PHASE_4B_RUN_NOT_ARMED' };
      if (gate.job_id && gate.job_id !== jobId) return { consumed: false, reason: 'PHASE_4B_WRONG_JOB' };
      if (gate.submission_consumed || gate.generation_consumed || gate.completed_at) {
        return { consumed: false, reason: 'PHASE_4B_SUBMISSION_ALREADY_CONSUMED' };
      }
      gate.job_id = jobId;
      gate.submission_consumed = true;
      gate.generation_consumed = true;
      gate.consumed_at = now;
      return { consumed: true, gate };
    });
  }

  async completePhase4bSingleRun({ jobId, ok = true, error = null, now = new Date().toISOString() }) {
    return this.update((state) => {
      const gate = state.phase4bSingleRun;
      if (!gate || (gate.job_id && gate.job_id !== jobId)) return { completed: false };
      gate.completed_at = now;
      gate.last_error = error;
      gate.outcome = ok ? 'complete' : 'needs_attention';
      return { completed: true, gate };
    });
  }

  async acquireActiveRunLock({ runId, now = new Date().toISOString(), staleThresholdMs = 300000 }) {
    return this.update((state) => {
      state.locks ??= {};
      const current = state.locks.activeRun;
      if (current) {
        if (current.run_id === runId) {
          return { acquired: true, lock: current };
        }
        const acquiredMs = Date.parse(current.acquired_at || current.started_at || 0);
        const age = Date.parse(now) - acquiredMs;
        if (!isNaN(age) && age < staleThresholdMs) {
          return { acquired: false, reason: 'RUN_ALREADY_ACTIVE', lock: current };
        }
      }
      state.locks.activeRun = {
        run_id: runId,
        started_at: now,
        acquired_at: now
      };
      return { acquired: true, lock: state.locks.activeRun };
    });
  }

  async releaseActiveRunLock({ runId = null } = {}) {
    return this.update((state) => {
      state.locks ??= {};
      if (!state.locks.activeRun) return { released: true, lock: null };
      if (!runId || state.locks.activeRun.run_id === runId) {
        delete state.locks.activeRun;
        return { released: true };
      }
      return { released: false, lock: state.locks.activeRun };
    });
  }

  async getActiveRunLock() {
    const state = await this.readState();
    return state.locks?.activeRun ?? null;
  }

  async appendAuditEvent(event) {
    return this.update((state) => {
      state.auditLog ??= { events: [], lastAction: 'Idle', nextSequence: 1 };
      const sequence = state.auditLog.nextSequence || 1;
      const record = { ...event, sequence };
      state.auditLog.nextSequence = sequence + 1;
      state.auditLog.events.push(record);
      const cutoff = Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      state.auditLog.events = state.auditLog.events
        .filter((item) => Date.parse(item.timestamp) >= cutoff)
        .slice(-MAX_AUDIT_EVENTS);
      if (record.event_code === 'RUN_FAILED' || record.event_code === 'RUN_NEEDS_ATTENTION') {
        state.auditLog.lastAction = `Needs attention - ${record.error_code || record.message_safe || record.event_code}`;
      } else if (record.event_code === 'RUN_REENTRY_REJECTED') {
        state.auditLog.lastAction = 'Run rejected: already active';
      } else if (record.event_code === 'ACQUISITION_PROBE_STOP') {
        state.auditLog.lastAction = 'Probe stopped: acquisition verified';
      } else if (record.event_code === 'RUN_COMPLETE') {
        state.auditLog.lastAction = 'Complete';
      } else if (record.event_code === 'RUN_REQUEST_ACCEPTED') {
        state.auditLog.lastAction = 'Run Once requested';
      } else if (record.event_code === 'JOB_ACQUIRE_START') {
        state.auditLog.lastAction = 'Acquiring job';
      } else if (record.event_code === 'PROVIDER_PRECHECK_START') {
        state.auditLog.lastAction = 'Provider precheck';
      } else if (record.event_code === 'SUBMISSION_GATE_ARMED') {
        state.auditLog.lastAction = 'Submission armed';
      } else if (record.event_code === 'PROVIDER_SUBMIT_START') {
        state.auditLog.lastAction = 'Submitting';
      } else if (record.event_code === 'CAPTURE_PERSISTED') {
        state.auditLog.lastAction = 'Captured';
      } else if (record.event_code === 'UPLOAD_START') {
        state.auditLog.lastAction = 'Uploading';
      }
      return record;
    });
  }

  async listAuditEvents({ level = 'ALL', runId = null, jobId = null, limit = 100 } = {}) {
    const state = await this.readState();
    let events = state.auditLog?.events ?? [];
    if (level !== 'ALL') events = events.filter((event) => event.level === level);
    if (runId) events = events.filter((event) => event.run_id === runId);
    if (jobId) events = events.filter((event) => event.job_id === jobId);
    return events.slice(-limit);
  }

  async clearAuditEvents() {
    return this.update((state) => {
      state.auditLog = { events: [], lastAction: 'Idle', nextSequence: state.auditLog?.nextSequence || 1 };
    });
  }

  async isDuplicateMessage(messageId) {
    if (!messageId) return false;
    return this.update((state) => {
      if (state.processedMessages.includes(messageId)) return true;
      state.processedMessages.push(messageId);
      state.processedMessages = state.processedMessages.slice(-200);
      return false;
    });
  }
}

export function createChromeStorage(chromeApi = globalThis.chrome) {
  if (!chromeApi?.storage?.local) {
    throw new Error('chrome.storage.local is required for the MV3 runtime');
  }
  return new ExtensionStorage(chromeApi.storage.local);
}
