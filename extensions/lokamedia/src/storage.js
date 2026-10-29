import {
  BACKEND_ENVIRONMENTS,
  DEFAULT_CONFIG,
  detectEnvironment,
  getCanonicalEnvironmentUrl,
  isUrlConsistentWithEnvironment,
  EXTENSION_VERSION,
  STORAGE_SCHEMA_VERSION
} from './constants.js';
import { AUDIT_RETENTION_DAYS, MAX_AUDIT_EVENTS } from './audit-log.js';
import { isProviderExecutionInFlight, computeQueueCounters } from './execution-state.js';

export function createDefaultEnvironmentProfile(envId) {
  const envKey = (envId || 'local').toUpperCase();
  const envDef = BACKEND_ENVIRONMENTS[envKey] || {
    id: envId || 'local',
    label: envId || 'local',
    defaultUrl: envId === 'production' ? 'https://rancangloka.com' : 'http://localhost:4321',
    defaultDeviceId: 'dev_local_human_operator_v3'
  };
  return {
    environment: envDef.id,
    serverBaseUrl: envDef.defaultUrl,
    deviceToken: '',
    deviceId: envDef.defaultDeviceId,
    jobs: {},
    selectedJobId: null,
    currentJobId: null,
    phase4bSingleRun: null,
    phase4bJobGates: {},
    jobOperationalStates: {},
    jobApprovals: {},
    jobRejections: {}
  };
}

export function sanitizeEnvironmentProfiles(state) {
  state.environmentProfiles ??= {
    local: createDefaultEnvironmentProfile('local'),
    staging: createDefaultEnvironmentProfile('staging'),
    production: createDefaultEnvironmentProfile('production')
  };

  const validEnvs = ['local', 'staging', 'production'];
  for (const env of validEnvs) {
    if (!state.environmentProfiles[env]) {
      state.environmentProfiles[env] = createDefaultEnvironmentProfile(env);
    }
    const prof = state.environmentProfiles[env];
    prof.environment = env;
    prof.deviceId ||= BACKEND_ENVIRONMENTS[env.toUpperCase()].defaultDeviceId;
    prof.deviceToken ??= '';
    prof.jobs ??= {};
    prof.selectedJobId ??= null;
    prof.currentJobId ??= null;
    prof.phase4bJobGates ??= {};
    prof.jobOperationalStates ??= {};
    prof.jobApprovals ??= {};
    prof.jobRejections ??= {};

    // Invariant: Server base URL must be consistent with its environment type
    if (!isUrlConsistentWithEnvironment(env, prof.serverBaseUrl)) {
      if (env === 'local' && detectEnvironment(prof.serverBaseUrl) === 'production') {
        // Recovery from contaminated local profile: move production token/jobs to production profile if empty
        const prodProf = state.environmentProfiles.production;
        if (!prodProf.deviceToken && prof.deviceToken) {
          prodProf.deviceToken = prof.deviceToken;
        }
        if (Object.keys(prodProf.jobs).length === 0 && Object.keys(prof.jobs).length > 0) {
          prodProf.jobs = clone(prof.jobs);
          prodProf.selectedJobId = prof.selectedJobId;
          prodProf.currentJobId = prof.currentJobId;
          prodProf.phase4bJobGates = clone(prof.phase4bJobGates);
          prodProf.jobOperationalStates = clone(prof.jobOperationalStates);
          prodProf.jobApprovals = clone(prof.jobApprovals);
          prodProf.jobRejections = clone(prof.jobRejections);
        }
        // Purge local profile back to pristine local defaults
        prof.serverBaseUrl = BACKEND_ENVIRONMENTS.LOCAL.defaultUrl;
        prof.deviceToken = '';
        prof.jobs = {};
        prof.selectedJobId = null;
        prof.currentJobId = null;
        prof.phase4bSingleRun = null;
        prof.phase4bJobGates = {};
        prof.jobOperationalStates = {};
        prof.jobApprovals = {};
        prof.jobRejections = {};

        // Also purge any contaminated active local config/jobs
        if (state.activeEnvironment === 'local' || !state.activeEnvironment) {
          state.config ??= {};
          state.config.serverBaseUrl = BACKEND_ENVIRONMENTS.LOCAL.defaultUrl;
          state.config.deviceToken = '';
          state.jobs = {};
          state.selectedJobId = null;
          state.currentJobId = null;
          state.phase4bSingleRun = null;
          state.phase4bJobGates = {};
          state.jobOperationalStates = {};
          state.jobApprovals = {};
          state.jobRejections = {};
        }
      } else {
        prof.serverBaseUrl = getCanonicalEnvironmentUrl(env);
      }
    }
  }

  if (!validEnvs.includes(state.activeEnvironment)) {
    state.activeEnvironment = detectEnvironment(state.config?.serverBaseUrl) || 'local';
  }

  const activeProfile = state.environmentProfiles[state.activeEnvironment];
  state.config ??= { ...DEFAULT_CONFIG };

  // Sync any direct modifications on state.config into the active profile
  if (state.config.deviceToken !== undefined && state.config.deviceToken !== activeProfile.deviceToken) {
    activeProfile.deviceToken = state.config.deviceToken;
  }
  if (state.config.deviceId && state.config.deviceId !== activeProfile.deviceId) {
    activeProfile.deviceId = state.config.deviceId;
  }
  if (state.config.serverBaseUrl && isUrlConsistentWithEnvironment(state.activeEnvironment, state.config.serverBaseUrl)) {
    activeProfile.serverBaseUrl = state.config.serverBaseUrl;
  }

  // Ensure config mirrors active profile
  state.config.serverBaseUrl = activeProfile.serverBaseUrl;
  state.config.deviceId = activeProfile.deviceId;
  state.config.deviceToken = activeProfile.deviceToken || '';

  // Critical Invariant: Local environment must NEVER retain production backend URL
  if (state.activeEnvironment === 'local' && detectEnvironment(state.config.serverBaseUrl) !== 'local') {
    state.config.serverBaseUrl = BACKEND_ENVIRONMENTS.LOCAL.defaultUrl;
    activeProfile.serverBaseUrl = BACKEND_ENVIRONMENTS.LOCAL.defaultUrl;
  }

  // Critical Invariant: Local tokenless development must consistently use dev_local_tokenless
  if (state.activeEnvironment === 'local' && !activeProfile.deviceToken) {
    if (activeProfile.deviceId?.startsWith('lokamedia-prod') || activeProfile.deviceId === 'dev_local_human_operator_v3') {
      activeProfile.deviceId = 'dev_local_tokenless';
      state.config.deviceId = 'dev_local_tokenless';
    }
  }
}

const DEFAULT_STATE = {
  schemaVersion: STORAGE_SCHEMA_VERSION,
  config: DEFAULT_CONFIG,
  activeEnvironment: 'local',
  environmentProfiles: {
    local: createDefaultEnvironmentProfile('local'),
    staging: createDefaultEnvironmentProfile('staging'),
    production: createDefaultEnvironmentProfile('production')
  },
  extension_version: EXTENSION_VERSION,
  expected_extension_version: null,
  runtime_extension_version: null,
  runtime_boot_id: null,
  runtime_started_at: null,
  jobs: {},
  uploadQueue: [],
  processedMessages: [],
  locks: {},
  provider: {
    chatgpt: {
      provider_tab_id: null,
      target_state: 'NOT BOUND',
      bound_tab_id: null,
      provider_origin: null,
      bound_at: null,
      bound_url: null,
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
  currentJobId: null,
  selectedJobId: null,
  manualPromotionState: null,
  phase4bSingleRun: null,
  phase4bJobGates: {},
  jobOperationalStates: {},
  jobApprovals: {},
  jobRejections: {},
  auditLog: {
    events: [],
    lastAction: 'Idle',
    nextSequence: 1
  }
};

export function migrateLegacyOperationalState(state) {
  if (!state || typeof state !== 'object') return state;
  state.extension_version = EXTENSION_VERSION;
  state.expected_extension_version ??= null;
  state.jobOperationalStates ??= {};
  state.phase4bJobGates ??= {};
  state.jobApprovals ??= {};
  state.jobRejections ??= {};

  // Check if migrating from pre-v0.1.21 where environmentProfiles did NOT exist
  if (!state.environmentProfiles) {
    const legacyUrl = state.config?.serverBaseUrl || 'http://localhost:4321';
    const legacyEnv = detectEnvironment(legacyUrl);
    state.activeEnvironment = legacyEnv;
    state.environmentProfiles = {
      local: createDefaultEnvironmentProfile('local'),
      staging: createDefaultEnvironmentProfile('staging'),
      production: createDefaultEnvironmentProfile('production')
    };

    const targetProf = state.environmentProfiles[legacyEnv];
    targetProf.serverBaseUrl = legacyUrl;
    targetProf.deviceToken = state.config?.deviceToken ?? '';
    targetProf.deviceId = state.config?.deviceId || targetProf.deviceId;
    targetProf.jobs = clone(state.jobs ?? {});
    targetProf.selectedJobId = state.selectedJobId ?? null;
    targetProf.currentJobId = state.currentJobId ?? null;
    targetProf.phase4bJobGates = clone(state.phase4bJobGates ?? {});
    targetProf.jobOperationalStates = clone(state.jobOperationalStates ?? {});
    targetProf.jobApprovals = clone(state.jobApprovals ?? {});
    targetProf.jobRejections = clone(state.jobRejections ?? {});
  }

  sanitizeEnvironmentProfiles(state);

  const activeProfile = state.environmentProfiles[state.activeEnvironment];
  if (Object.keys(state.jobs ?? {}).length === 0 && Object.keys(activeProfile.jobs ?? {}).length > 0) {
    state.jobs = clone(activeProfile.jobs);
    state.selectedJobId = activeProfile.selectedJobId;
    state.currentJobId = activeProfile.currentJobId;
    state.phase4bJobGates = clone(activeProfile.phase4bJobGates);
    state.jobOperationalStates = clone(activeProfile.jobOperationalStates);
    state.jobApprovals = clone(activeProfile.jobApprovals);
    state.jobRejections = clone(activeProfile.jobRejections);
  } else {
    activeProfile.jobs = clone(state.jobs ?? {});
    activeProfile.selectedJobId = state.selectedJobId ?? null;
    activeProfile.currentJobId = state.currentJobId ?? null;
    activeProfile.phase4bJobGates = clone(state.phase4bJobGates ?? {});
    activeProfile.jobOperationalStates = clone(state.jobOperationalStates ?? {});
    activeProfile.jobApprovals = clone(state.jobApprovals ?? {});
    activeProfile.jobRejections = clone(state.jobRejections ?? {});
  }

  if (state.phase4bSingleRun?.job_id) {
    const jobId = state.phase4bSingleRun.job_id;
    state.phase4bJobGates[jobId] ??= { ...state.phase4bSingleRun };
  }

  for (const [jobId, job] of Object.entries(state.jobs ?? {})) {
    const existing = state.jobOperationalStates[jobId] || {};
    const gate = state.phase4bJobGates[jobId] || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null);
    const runId = job.run_id || job.result_checkpoint?.run_id || gate?.phase4b_single_run_id || existing.run_id || null;

    const isRejectedOrDiscarded = job.local_state === 'RESULT_REJECTED' || (job.blob_key === null && job.sha256 === null);
    const hasCandidate = !isRejectedOrDiscarded && Boolean(
      job.blob_key ||
      job.sha256 ||
      existing.candidate?.blob_key ||
      existing.candidate?.sha256
    );

    const candidate = hasCandidate ? {
      job_id: jobId,
      run_id: job.run_id || existing.candidate?.run_id || runId,
      sha256: job.sha256 || existing.candidate?.sha256 || null,
      width: (job.sha256 && job.sha256 === existing.candidate?.sha256) ? (existing.candidate?.width || job.width) : (job.width || existing.candidate?.width || null),
      height: (job.sha256 && job.sha256 === existing.candidate?.sha256) ? (existing.candidate?.height || job.height) : (job.height || existing.candidate?.height || null),
      size: (job.sha256 && job.sha256 === existing.candidate?.sha256) ? (existing.candidate?.size || job.size) : (job.size || existing.candidate?.size || null),
      mime: (job.sha256 && job.sha256 === existing.candidate?.sha256) ? (existing.candidate?.mime || job.mime) : (job.mime || existing.candidate?.mime || 'image/png'),
      blob_key: job.blob_key || existing.candidate?.blob_key || null,
      provenance: job.provenance || existing.candidate?.provenance || null,
      source_provenance: job.source_provenance || existing.candidate?.source_provenance || null,
      captured_at: job.captured_at || existing.candidate?.captured_at || job.completed_at || null,
      is_uploaded: (job.local_state === 'UPLOAD_COMPLETE' || job.status === 'COMPLETE')
    } : null;

    state.jobOperationalStates[jobId] = {
      job_id: jobId,
      run_id: runId,
      article_id: job.article_id ?? existing.article_id ?? null,
      article_title: job.article_title || existing.article_title || null,
      slot_key: job.slot_key || job.role || existing.slot_key || 'featured',
      target_dimensions: (job.target_width && job.target_height) ? `${job.target_width} × ${job.target_height}` : (job.target_dimensions || existing.target_dimensions || '1315 × 660'),
      prompt: job.prompt || existing.prompt || '',
      prompt_hash: job.prompt_hash || existing.prompt_hash || null,
      local_state: job.local_state || job.status || 'QUEUED',
      candidate,
      approval: state.jobApprovals?.[jobId] || existing.approval || null,
      rejection: state.jobRejections?.[jobId] || existing.rejection || null,
      last_error: job.last_error || gate?.last_error || existing.last_error || null
    };
  }

  if (state.candidate && typeof state.candidate === 'object') {
    if (state.candidate.job_id && state.jobs?.[state.candidate.job_id]) {
      state.jobOperationalStates[state.candidate.job_id] ??= {};
      state.jobOperationalStates[state.candidate.job_id].candidate = { ...state.candidate };
    }
    delete state.candidate;
  }
  if (state.resultCandidate && typeof state.resultCandidate === 'object') {
    if (state.resultCandidate.job_id && state.jobs?.[state.resultCandidate.job_id]) {
      state.jobOperationalStates[state.resultCandidate.job_id] ??= {};
      state.jobOperationalStates[state.resultCandidate.job_id].candidate = { ...state.resultCandidate };
    }
    delete state.resultCandidate;
  }

  return state;
}

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
    if (!lokamediaState) {
      await this.saveState(DEFAULT_STATE);
      return clone(DEFAULT_STATE);
    }
    const isLegacy = !lokamediaState.environmentProfiles || !lokamediaState.activeEnvironment || (lokamediaState.schemaVersion || 1) < 2;
    const base = clone(DEFAULT_STATE);
    if (isLegacy) {
      delete base.activeEnvironment;
      delete base.environmentProfiles;
    }
    const merged = { ...base, ...clone(lokamediaState) };
    merged.schemaVersion = STORAGE_SCHEMA_VERSION;
    merged.extension_version = EXTENSION_VERSION;
    migrateLegacyOperationalState(merged);
    await this.saveState(merged);
    return merged;
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
    migrateLegacyOperationalState(state);
    await this.saveState(state);
    return result ?? state;
  }

  async saveConfig(config) {
    return this.update((state) => {
      if (config.serverBaseUrl !== undefined && config.serverBaseUrl !== null) {
        if (!isUrlConsistentWithEnvironment(state.activeEnvironment, config.serverBaseUrl)) {
          throw new Error(`ENVIRONMENT_URL_MISMATCH: Configured URL '${config.serverBaseUrl}' does not match active environment '${state.activeEnvironment}'. Switch environment first.`);
        }
      }
      state.config = { ...state.config, ...config };
      if (state.activeEnvironment && state.environmentProfiles?.[state.activeEnvironment]) {
        const prof = state.environmentProfiles[state.activeEnvironment];
        if (config.serverBaseUrl !== undefined) prof.serverBaseUrl = config.serverBaseUrl;
        if (config.deviceId !== undefined) prof.deviceId = config.deviceId;
        if (config.deviceToken !== undefined) prof.deviceToken = config.deviceToken;
      }
    });
  }

  async switchEnvironment(targetEnv, customUrl = null) {
    const validEnvs = ['local', 'staging', 'production'];
    const normalizedEnv = String(targetEnv || '').toLowerCase();
    if (!validEnvs.includes(normalizedEnv)) {
      throw new Error(`Invalid environment: ${targetEnv}. Supported: ${validEnvs.join(', ')}`);
    }

    return this.update((state) => {
      if (isProviderExecutionInFlight(state)) {
        throw new Error('Cannot switch environment while media generation or execution is in flight');
      }

      if (customUrl && !isUrlConsistentWithEnvironment(normalizedEnv, customUrl)) {
        throw new Error(`ENVIRONMENT_URL_MISMATCH: Custom URL '${customUrl}' does not match target environment '${normalizedEnv}'`);
      }

      const isCurrentUrlConsistent = isUrlConsistentWithEnvironment(normalizedEnv, state.config?.serverBaseUrl);
      if (state.activeEnvironment === normalizedEnv && isCurrentUrlConsistent && !customUrl) {
        return state;
      }

      const prevEnv = state.activeEnvironment || 'local';
      state.environmentProfiles ??= {
        local: createDefaultEnvironmentProfile('local'),
        staging: createDefaultEnvironmentProfile('staging'),
        production: createDefaultEnvironmentProfile('production')
      };

      // 1. Snapshot current active state into previous environment profile
      const prevProfile = state.environmentProfiles[prevEnv] || createDefaultEnvironmentProfile(prevEnv);
      prevProfile.serverBaseUrl = state.config?.serverBaseUrl || prevProfile.serverBaseUrl;
      prevProfile.deviceId = state.config?.deviceId || prevProfile.deviceId;
      prevProfile.deviceToken = state.config?.deviceToken ?? prevProfile.deviceToken;
      prevProfile.jobs = clone(state.jobs || {});
      prevProfile.selectedJobId = state.selectedJobId || null;
      prevProfile.currentJobId = state.currentJobId || null;
      prevProfile.phase4bSingleRun = clone(state.phase4bSingleRun || null);
      prevProfile.phase4bJobGates = clone(state.phase4bJobGates || {});
      prevProfile.jobOperationalStates = clone(state.jobOperationalStates || {});
      prevProfile.jobApprovals = clone(state.jobApprovals || {});
      prevProfile.jobRejections = clone(state.jobRejections || {});
      state.environmentProfiles[prevEnv] = prevProfile;

      // 2. Prepare target profile
      state.environmentProfiles[normalizedEnv] ??= createDefaultEnvironmentProfile(normalizedEnv);
      const targetProfile = state.environmentProfiles[normalizedEnv];
      if (customUrl) {
        targetProfile.serverBaseUrl = customUrl;
      } else if (!isUrlConsistentWithEnvironment(normalizedEnv, targetProfile.serverBaseUrl)) {
        targetProfile.serverBaseUrl = getCanonicalEnvironmentUrl(normalizedEnv);
      }

      // 3. Switch activeEnvironment
      state.activeEnvironment = normalizedEnv;

      // 4. Restore config and job state from target profile atomically
      state.config = {
        ...state.config,
        serverBaseUrl: targetProfile.serverBaseUrl,
        deviceId: targetProfile.deviceId,
        deviceToken: targetProfile.deviceToken || ''
      };
      state.jobs = clone(targetProfile.jobs || {});
      state.selectedJobId = targetProfile.selectedJobId || null;
      state.currentJobId = targetProfile.currentJobId || null;
      state.phase4bSingleRun = clone(targetProfile.phase4bSingleRun || null);
      state.phase4bJobGates = clone(targetProfile.phase4bJobGates || {});
      state.jobOperationalStates = clone(targetProfile.jobOperationalStates || {});
      state.jobApprovals = clone(targetProfile.jobApprovals || {});
      state.jobRejections = clone(targetProfile.jobRejections || {});

      // 5. Reset transient connection and recompute counters
      state.status.connection = 'offline';
      state.status.last_error = null;
      const counters = computeQueueCounters(state);
      state.counters = { ...state.counters, ...counters };

      // 6. Record audit event
      const seq = state.auditLog?.nextSequence || 1;
      state.auditLog ??= { events: [], lastAction: 'Idle', nextSequence: 1 };
      state.auditLog.events.push({
        sequence: seq,
        event_code: 'ENVIRONMENT_SWITCHED',
        level: 'INFO',
        timestamp: new Date().toISOString(),
        details: {
          from: prevEnv,
          to: normalizedEnv,
          serverBaseUrl: state.config.serverBaseUrl
        }
      });
      state.auditLog.nextSequence = seq + 1;
      state.auditLog.lastAction = `Switched to ${normalizedEnv.toUpperCase()} (${state.config.serverBaseUrl})`;

      return state;
    });
  }

  async upsertJob(jobId, patch) {
    return this.update((state) => {
      state.jobs[jobId] = {
        ...(state.jobs[jobId] ?? { job_id: jobId }),
        ...clone(patch),
        updated_at_local: new Date().toISOString()
      };
      state.jobOperationalStates ??= {};
      migrateLegacyOperationalState(state);
    });
  }

  async getJobOperationalState(jobId) {
    const state = await this.readState();
    return clone(state.jobOperationalStates?.[jobId] ?? null);
  }

  async updateJobOperationalState(jobId, patchOrMutator) {
    return this.update((state) => {
      state.jobOperationalStates ??= {};
      const current = state.jobOperationalStates[jobId] ?? { job_id: jobId };
      const next = typeof patchOrMutator === 'function' ? patchOrMutator(current) : { ...current, ...clone(patchOrMutator) };
      state.jobOperationalStates[jobId] = next;
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
      state.phase4bJobGates ??= {};
      if (state.phase4bSingleRun?.job_id) {
        state.phase4bJobGates[state.phase4bSingleRun.job_id] = state.phase4bSingleRun;
      }
      const gate = jobId ? (state.phase4bJobGates[jobId] || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null)) : state.phase4bSingleRun;
      if (gate && (!jobId || gate.job_id === jobId) && (gate.submission_consumed || gate.generation_consumed || (gate.completed_at && gate.outcome === 'complete'))) {
        return { armed: false, reason: 'PHASE_4B_RUN_CONSUMED', gate };
      }
      const newGate = {
        phase4b_single_run_id: runId,
        job_id: jobId,
        armed_at: now,
        submission_consumed: false,
        generation_consumed: false,
        completed_at: null,
        last_error: null
      };
      if (jobId) {
        state.phase4bJobGates[jobId] = newGate;
      }
      state.phase4bSingleRun = newGate;
      return { armed: true, gate: newGate };
    });
  }

  async disarmPhase4bSubmission({ jobId }) {
    return this.update((state) => {
      state.phase4bJobGates ??= {};
      const gate = (jobId && state.phase4bJobGates[jobId]) || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null);
      if (!gate || (gate.job_id && gate.job_id !== jobId)) return { disarmed: false };
      gate.submission_consumed = false;
      gate.generation_consumed = false;
      delete gate.consumed_at;
      if (jobId) {
        state.phase4bJobGates[jobId] = gate;
      }
      if (state.phase4bSingleRun?.job_id === jobId) {
        state.phase4bSingleRun = gate;
      }
      return { disarmed: true, gate };
    });
  }

  async consumePhase4bSubmission({ jobId, now = new Date().toISOString() }) {
    return this.update((state) => {
      state.phase4bJobGates ??= {};
      if (state.phase4bSingleRun?.job_id && !state.phase4bJobGates[state.phase4bSingleRun.job_id]) {
        state.phase4bJobGates[state.phase4bSingleRun.job_id] = state.phase4bSingleRun;
      }
      const gate = (jobId && state.phase4bJobGates[jobId]) || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null);
      if (!gate) return { consumed: false, reason: 'PHASE_4B_RUN_NOT_ARMED' };
      if (gate.job_id && gate.job_id !== jobId) return { consumed: false, reason: 'PHASE_4B_WRONG_JOB' };
      if (gate.submission_consumed || gate.generation_consumed || gate.completed_at) {
        return { consumed: false, reason: 'PHASE_4B_SUBMISSION_ALREADY_CONSUMED' };
      }
      gate.job_id = jobId;
      gate.submission_consumed = true;
      gate.generation_consumed = true;
      gate.consumed_at = now;
      if (jobId) {
        state.phase4bJobGates[jobId] = gate;
      }
      if (!state.phase4bSingleRun || state.phase4bSingleRun.job_id === jobId) {
        state.phase4bSingleRun = gate;
      }
      return { consumed: true, gate };
    });
  }

  async completePhase4bSingleRun({ jobId, ok = true, error = null, now = new Date().toISOString() }) {
    return this.update((state) => {
      state.phase4bJobGates ??= {};
      if (state.phase4bSingleRun?.job_id && !state.phase4bJobGates[state.phase4bSingleRun.job_id]) {
        state.phase4bJobGates[state.phase4bSingleRun.job_id] = state.phase4bSingleRun;
      }
      const gate = (jobId && state.phase4bJobGates[jobId]) || (state.phase4bSingleRun?.job_id === jobId ? state.phase4bSingleRun : null);
      if (!gate || (gate.job_id && gate.job_id !== jobId)) return { completed: false };
      gate.completed_at = now;
      gate.last_error = error;
      gate.outcome = ok ? 'complete' : 'needs_attention';
      if (jobId) {
        state.phase4bJobGates[jobId] = gate;
      }
      if (!state.phase4bSingleRun || state.phase4bSingleRun.job_id === jobId) {
        state.phase4bSingleRun = gate;
      }
      return { completed: true, gate };
    });
  }

  async resetPhase4bSingleRun(jobId = null) {
    return this.update((state) => {
      if (jobId) {
        if (state.phase4bJobGates) {
          delete state.phase4bJobGates[jobId];
        }
        if (state.phase4bSingleRun?.job_id === jobId) {
          state.phase4bSingleRun = null;
        }
      } else {
        state.phase4bSingleRun = null;
      }
      return { reset: true };
    });
  }

  async recordHumanApproval(params = {}) {
    const jobId = params.jobId || params.job_id;
    const runId = params.runId || params.run_id;
    const candidateSha256 = params.candidateSha256 || params.candidate_sha256;
    const approvalSource = params.approvalSource || params.approval_source || 'operator_side_panel';
    const now = params.now || params.approved_at || new Date().toISOString();
    return this.update((state) => {
      state.jobApprovals ??= {};
      const record = {
        job_id: jobId,
        run_id: runId,
        candidate_sha256: candidateSha256,
        approved_at: now,
        approval_source: approvalSource,
        consumed: Boolean(params.consumed),
        consumed_at: params.consumed_at || (params.consumed ? now : null)
      };
      if (jobId) {
        state.jobApprovals[jobId] = record;
        state.jobOperationalStates ??= {};
        if (state.jobOperationalStates[jobId]) {
          state.jobOperationalStates[jobId].approval = clone(record);
        }
      }
      return { ok: true, approval: record };
    });
  }

  async getHumanApproval(jobId) {
    const state = await this.readState();
    return clone(state.jobApprovals?.[jobId] || state.jobOperationalStates?.[jobId]?.approval || null);
  }

  async consumeHumanApproval(params = {}) {
    const jobId = params.jobId || params.job_id;
    const candidateSha256 = params.candidateSha256 || params.candidate_sha256;
    const runId = params.runId || params.run_id || null;
    const now = params.now || params.consumed_at || new Date().toISOString();
    return this.update((state) => {
      state.jobApprovals ??= {};
      let approval = state.jobApprovals[jobId] || state.jobOperationalStates?.[jobId]?.approval || null;
      if (!approval) {
        return { consumed: false, reason: 'NO_APPROVAL_RECORD' };
      }
      if (candidateSha256 && approval.candidate_sha256 !== candidateSha256) {
        return { consumed: false, reason: 'APPROVAL_SHA_MISMATCH', expectedSha: approval.candidate_sha256, actualSha: candidateSha256 };
      }
      if (approval.consumed) {
        return { consumed: false, reason: 'APPROVAL_ALREADY_CONSUMED', approval };
      }
      approval.consumed = true;
      approval.consumed_at = now;
      if (runId && !approval.run_id) approval.run_id = runId;
      state.jobApprovals[jobId] = approval;
      state.jobOperationalStates ??= {};
      if (state.jobOperationalStates[jobId]) {
        state.jobOperationalStates[jobId].approval = clone(approval);
      }
      return { consumed: true, approval };
    });
  }

  async recordHumanRejection(params = {}) {
    const jobId = params.jobId || params.job_id;
    const runId = params.runId || params.run_id;
    const candidateSha256 = params.candidateSha256 || params.candidate_sha256 || null;
    const rejectionSource = params.rejectionSource || params.rejection_source || 'operator_side_panel';
    const now = params.now || params.rejected_at || new Date().toISOString();
    return this.update((state) => {
      state.jobRejections ??= {};
      const record = {
        job_id: jobId,
        run_id: runId,
        candidate_sha256: candidateSha256,
        rejected_at: now,
        rejection_source: rejectionSource
      };
      if (jobId) {
        state.jobRejections[jobId] = record;
        if (state.jobApprovals?.[jobId]) {
          delete state.jobApprovals[jobId];
        }
        state.jobOperationalStates ??= {};
        if (state.jobOperationalStates[jobId]) {
          state.jobOperationalStates[jobId].rejection = clone(record);
          delete state.jobOperationalStates[jobId].approval;
          delete state.jobOperationalStates[jobId].candidate;
        }
      }
      return { ok: true, rejection: record };
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
      } else if (record.event_code === 'RUN_GATE_CHECK_FAIL' || record.event_code === 'JOB_ACQUIRE_FAIL') {
        state.auditLog.lastAction = 'Idle';
      } else if (record.event_code === 'RUN_REENTRY_REJECTED') {
        state.auditLog.lastAction = 'Run rejected: already active';
      } else if (record.event_code === 'ACQUISITION_PROBE_STOP') {
        state.auditLog.lastAction = 'Probe stopped: acquisition verified';
      } else if (record.event_code === 'PROVIDER_RESULT_PROBE_STOP') {
        state.auditLog.lastAction = 'Probe stopped: provider result identified';
      } else if (record.event_code === 'CAPTURE_BLOB_PROBE_STOP') {
        state.auditLog.lastAction = 'Probe stopped: blob persisted';
      } else if (record.event_code === 'RUN_COMPLETE') {
        state.auditLog.lastAction = 'Complete';
      } else if (record.event_code === 'RUN_REQUEST_ACCEPTED') {
        state.auditLog.lastAction = 'Run Once requested';
      } else if (record.event_code === 'JOB_ACQUIRE_START') {
        state.auditLog.lastAction = 'Acquiring job';
      } else if (record.event_code === 'JOB_ACQUIRED') {
        state.auditLog.lastAction = 'Job acquired';
      } else if (record.event_code === 'PROVIDER_PRECHECK_START') {
        state.auditLog.lastAction = 'Provider precheck';
      } else if (record.event_code === 'SUBMISSION_GATE_ARMED') {
        state.auditLog.lastAction = 'Submission armed';
      } else if (record.event_code === 'PROVIDER_SUBMIT_START') {
        state.auditLog.lastAction = 'Submitting';
      } else if (record.event_code === 'CAPTURE_PERSISTED') {
        state.auditLog.lastAction = 'Captured';
      } else if (record.event_code === 'RESULT_READY') {
        state.auditLog.lastAction = 'Result ready for review';
      } else if (record.event_code === 'HUMAN_APPROVAL_RECORDED') {
        state.auditLog.lastAction = 'Human approval recorded';
      } else if (record.event_code === 'HUMAN_REJECTION_RECORDED') {
        state.auditLog.lastAction = 'Human rejection recorded';
      } else if (record.event_code === 'UPLOAD_APPROVAL_GATE_PASS') {
        state.auditLog.lastAction = 'Upload approval verified';
      } else if (record.event_code === 'UPLOAD_APPROVAL_GATE_FAIL') {
        state.auditLog.lastAction = 'Upload approval rejected';
      } else if (record.event_code === 'UPLOAD_START') {
        state.auditLog.lastAction = 'Uploading';
      } else if (record.event_code === 'ATTACHMENT_CONFIRMED' || record.event_code === 'JOB_COMPLETE') {
        state.auditLog.lastAction = 'Upload complete & confirmed';
      } else if (record.event_code === 'MANUAL_PROMOTION_TARGET_RESOLVED') {
        state.auditLog.lastAction = 'Target article resolved';
      } else if (record.event_code === 'MANUAL_PROMOTION_FILE_SELECTED') {
        state.auditLog.lastAction = 'Local file selected';
      } else if (record.event_code === 'MANUAL_PROMOTION_APPROVAL_RECORDED') {
        state.auditLog.lastAction = 'Manual promotion approved';
      } else if (record.event_code === 'MANUAL_R2_UPLOAD_START') {
        state.auditLog.lastAction = 'Uploading standalone media to R2';
      } else if (record.event_code === 'MANUAL_ASSET_REGISTERED') {
        state.auditLog.lastAction = 'Asset registered';
      } else if (record.event_code === 'MANUAL_PROMOTION_COMPLETE') {
        state.auditLog.lastAction = 'Manual promotion complete';
      }
      return record;
    });
  }

  async getManualPromotionState() {
    const state = await this.readState();
    return clone(state.manualPromotionState ?? null);
  }

  async updateManualPromotionState(patchOrMutator) {
    return this.update((state) => {
      const current = state.manualPromotionState ?? {
        targetArticle: null,
        candidate: null,
        approval: null,
        stage: 'IDLE',
        uploadedAsset: null,
        lastError: null
      };
      const next = typeof patchOrMutator === 'function' ? patchOrMutator(current) : { ...current, ...clone(patchOrMutator) };
      state.manualPromotionState = next;
      return next;
    });
  }

  async clearManualPromotionState() {
    return this.update((state) => {
      state.manualPromotionState = null;
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
