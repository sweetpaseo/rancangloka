import { DEFAULT_CONFIG, STORAGE_SCHEMA_VERSION } from './constants.js';

const DEFAULT_STATE = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  config: DEFAULT_CONFIG,
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
  phase4bSingleRun: null
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
