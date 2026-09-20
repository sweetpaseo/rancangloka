import { BackpressureController } from './backpressure.js';
import { ProviderLane } from './provider-adapter.js';
import { MockProviderAdapter } from './mock-provider.js';
import { ReconciliationManager, hasValidRecoveryLease } from './reconciliation-manager.js';
import { UploadWorkerPool } from './upload-worker-pool.js';
import { HeartbeatManager } from './heartbeat-manager.js';
import { LOKAMEDIA_PROTOCOL_VERSION } from './constants.js';
import { AuditLogger } from './audit-log.js';
import { isCaptureReadyProviderResult, isRecoverableResultCheckpoint } from './providers/chatgpt/correlation.js';

export class LokaMediaController {
  constructor({ apiClient, storage, blobStore, provider = new MockProviderAdapter(), logger = console, audit = null }) {
    this.apiClient = apiClient;
    this.storage = storage;
    this.blobStore = blobStore;
    this.provider = provider;
    this.logger = logger;
    this.backpressure = new BackpressureController(blobStore);
    this.providerLane = new ProviderLane(storage);
    this.reconciliation = new ReconciliationManager({ apiClient, storage, blobStore });
    this.uploads = new UploadWorkerPool({ apiClient, storage, blobStore });
    this.heartbeat = new HeartbeatManager({ apiClient, storage });
    this.audit = audit || new AuditLogger({ storage, component: 'controller' });
  }

  async startup() {
    await this.storage.initialize();
    const reconciled = await this.reconciliation.startup();
    for (const job of reconciled.filter((item) => item.local_state === 'UPLOAD_QUEUED')) {
      await this.storage.enqueueUpload(job.job_id);
    }
    await this.uploads.drain();
    return reconciled;
  }

  async tick() {
    await this.startup();
    const pressure = await this.backpressure.inspect();
    if (pressure.blocked) {
      await this.storage.update((state) => {
        state.status.connection = 'backpressure';
      });
      return { acquired: false, reason: 'BACKPRESSURE', pressure };
    }

    const state = await this.storage.readState();
    if (!state.config.enabled) return { acquired: false, reason: 'DISABLED' };
    if (!state.config.deviceToken) return { acquired: false, reason: 'AUTH_REQUIRED' };

    const response = await this.apiClient.nextJob(state.config.deviceId);
    if (response.protocol_version && response.protocol_version !== LOKAMEDIA_PROTOCOL_VERSION) {
      await this.storage.update((nextState) => {
        nextState.status.connection = 'protocol_mismatch';
      });
      return { acquired: false, reason: 'PROTOCOL_MISMATCH' };
    }
    if (!response.job) return { acquired: false, reason: response.error ?? 'NO_JOB' };
    return this.runJob(response.job);
  }

  async runOnce(options = {}) {
    const runId = typeof options === 'string' ? options : (options?.runId || `run_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`);
    const acceptedLogged = typeof options === 'object' && options !== null && Boolean(options.acceptedLogged);

    const lockResult = await this.storage.acquireActiveRunLock({ runId });
    if (!lockResult.acquired) {
      await this.audit.warn('RUN_REENTRY_REJECTED', {
        run_id: runId,
        component: 'controller',
        details: { active_run_id: lockResult.lock?.run_id }
      });
      return { ok: false, error: 'RUN_ALREADY_ACTIVE', run_id: runId };
    }

    try {
      if (!acceptedLogged) {
        await this.audit.info('RUN_REQUEST_ACCEPTED', { run_id: runId, component: 'controller' });
      }
      await this.audit.info('RUN_GATE_CHECK_START', { run_id: runId });

      const state = await this.storage.readState();
      const gate = state.phase4bSingleRun;
      if (gate?.outcome === 'complete') {
        await this.audit.warn('RUN_GATE_CHECK_FAIL', { run_id: runId, error_code: 'PHASE_4B_RUN_CONSUMED', details: { job_id: gate.job_id } });
        return { ok: false, error: 'PHASE_4B_RUN_CONSUMED' };
      }

      // Check for recovery mode trigger or recoverable checkpoint
      const recoverableJob = Object.values(state.jobs ?? {}).find((j) => {
        if (j.local_state === 'COMPLETE' || j.status === 'COMPLETE') return false;
        if (j.local_state === 'CAPTURED' && j.blob_key) return false;
        return isRecoverableResultCheckpoint(j.result_checkpoint, j);
      });
      const isRecoveryRequested = options?.runMode === 'checkpoint_capture_recovery' || Boolean(recoverableJob);

      if (isRecoveryRequested) {
        const targetJob = recoverableJob || (options?.jobId ? state.jobs[options.jobId] : null);
        if (!targetJob) {
          return this.failGate(runId, 'RESULT_CHECKPOINT_MISSING');
        }
        if (!state.config.enabled) return this.failGate(runId, 'EXTENSION_DISABLED');
        if (!state.config.deviceToken || !state.config.deviceId) return this.failGate(runId, 'DEVICE_CREDENTIAL_REQUIRED');
        if (state.status.connection === 'backpressure') return this.failGate(runId, 'BACKPRESSURE');
        if (state.locks.providerLane) return this.failGate(runId, 'PROVIDER_LANE_BUSY');

        const provider = state.provider?.chatgpt ?? {};
        if (
          provider.tab_status !== 'connected' ||
          provider.auth_state !== 'AUTHENTICATED' ||
          provider.dom_status !== 'SUPPORTED'
        ) {
          return this.failGate(runId, 'PROVIDER_NOT_READY');
        }
        await this.audit.info('RUN_GATE_CHECK_PASS', { run_id: runId, mode: 'recovery' });

        const captureBlobProbe = Boolean(
          (typeof options === 'object' && options !== null && options.captureBlobProbe !== undefined)
            ? options.captureBlobProbe
            : state.config?.captureBlobProbe
        );

        return await this.runCheckpointRecovery(targetJob, {
          runId,
          acceptedLogged: true,
          captureBlobProbe,
          ...options
        });
      }

      if (gate?.submission_consumed || gate?.generation_consumed || gate?.completed_at) {
        await this.audit.warn('RUN_GATE_CHECK_FAIL', { run_id: runId, error_code: 'PHASE_4B_RUN_CONSUMED', details: { job_id: gate.job_id } });
        return { ok: false, error: 'PHASE_4B_RUN_CONSUMED' };
      }
      if (!state.config.enabled) return this.failGate(runId, 'EXTENSION_DISABLED');
      if (!state.config.deviceToken || !state.config.deviceId) return this.failGate(runId, 'DEVICE_CREDENTIAL_REQUIRED');
      if (state.status.connection === 'backpressure') return this.failGate(runId, 'BACKPRESSURE');
      if (state.locks.providerLane) return this.failGate(runId, 'PROVIDER_LANE_BUSY');

      const provider = state.provider?.chatgpt ?? {};
      if (
        provider.tab_status !== 'connected' ||
        provider.auth_state !== 'AUTHENTICATED' ||
        provider.dom_status !== 'SUPPORTED' ||
        provider.composer_status !== 'ready'
      ) {
        return this.failGate(runId, 'PROVIDER_NOT_READY');
      }
      await this.audit.info('RUN_GATE_CHECK_PASS', { run_id: runId });

      try {
        await this.startup();
      } catch (startupError) {
        this.logger?.warn?.('startup reconcile failed in runOnce', { error: startupError?.message || startupError });
      }

      await this.audit.info('JOB_ACQUIRE_START', { run_id: runId });
      const response = await this.apiClient.nextJob(state.config.deviceId);
      if (response.protocol_version && response.protocol_version !== LOKAMEDIA_PROTOCOL_VERSION) {
        await this.audit.error('JOB_ACQUIRE_FAIL', { run_id: runId, error_code: 'PROTOCOL_MISMATCH' });
        return { ok: false, error: 'PROTOCOL_MISMATCH' };
      }
      if (!response.job) {
        const code = response.error ?? 'NO_JOB';
        await this.audit.warn('JOB_ACQUIRE_FAIL', { run_id: runId, error_code: code });
        return { ok: false, error: code };
      }

      const job = response.job;
      if (job.article_title !== 'LokaMedia Phase 4B Controlled Generation Test' || job.slot_key !== 'featured') {
        await this.audit.warn('JOB_ACQUIRE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'WRONG_PHASE_4B_JOB' });
        return { ok: false, error: 'WRONG_PHASE_4B_JOB', job_id: job.job_id };
      }
      await this.audit.info('JOB_ACQUIRED', { run_id: runId, job_id: job.job_id, article_id: job.article_id, slot_key: job.slot_key, server_job_status: job.status });

      const acquisitionProbe = Boolean(
        (typeof options === 'object' && options !== null && options.acquisitionProbe !== undefined)
          ? options.acquisitionProbe
          : state.config?.acquisitionProbe
      );
      const providerResultProbe = Boolean(
        (typeof options === 'object' && options !== null && options.providerResultProbe !== undefined)
          ? options.providerResultProbe
          : state.config?.providerResultProbe
      );
      const captureBlobProbe = Boolean(
        (typeof options === 'object' && options !== null && options.captureBlobProbe !== undefined)
          ? options.captureBlobProbe
          : state.config?.captureBlobProbe
      );

      if (acquisitionProbe) {
        await this.audit.info('ACQUISITION_PROBE_STOP', {
          run_id: runId,
          job_id: job.job_id,
          details: { status: job.status, job_revision: job.job_revision }
        });

        if (typeof this.apiClient?.releaseJob === 'function') {
          try {
            await this.apiClient.releaseJob(job.job_id, {
              expectedJobRevision: job.job_revision,
              intent: 'SAFE_REQUEUE',
              reasonCode: 'ACQUISITION_PROBE_STOP',
              messageSafe: 'Acquisition probe stopped before provider generation'
            });
            await this.audit.info('JOB_LEASE_RELEASED', {
              run_id: runId,
              job_id: job.job_id,
              details: { intent: 'SAFE_REQUEUE' }
            });
          } catch (releaseErr) {
            this.logger?.warn?.('failed to release job lease after probe stop', { error: releaseErr?.message || releaseErr });
          }
        }

        return {
          ok: true,
          status: 'ACQUISITION_PROBE_STOPPED',
          run_id: runId,
          job_id: job.job_id,
          job
        };
      }

      await this.audit.info('JOB_CHECKPOINT_SAVED', { run_id: runId, job_id: job.job_id });
      const armed = await this.storage.armPhase4bSingleRun({ jobId: job.job_id, runId });
      if (!armed.armed) return { ok: false, error: armed.reason };
      await this.audit.info('SUBMISSION_GATE_ARMED', { run_id: runId, job_id: job.job_id, details: { boundary: 'before_provider_submit_intent' } });
      const consumed = await this.storage.consumePhase4bSubmission({ jobId: job.job_id });
      if (!consumed.consumed) return { ok: false, error: consumed.reason };

      try {
        const result = await this.runJob(job, { runId, controlledRunOnce: true, providerResultProbe, captureBlobProbe });
        await this.storage.completePhase4bSingleRun({ jobId: job.job_id, ok: true });
        if (result?.status === 'PROVIDER_RESULT_PROBE_STOPPED' || result?.status === 'CAPTURE_BLOB_PROBE_STOPPED') {
          return result;
        }
        await this.audit.info('RUN_COMPLETE', { run_id: runId, job_id: job.job_id });
        return { ok: true, ...result };
      } catch (error) {
        await this.storage.completePhase4bSingleRun({ jobId: job.job_id, ok: false, error: String(error?.message || error) });
        await this.audit.error('RUN_FAILED', { run_id: runId, job_id: job.job_id, error });
        throw error;
      }
    } finally {
      await this.storage.releaseActiveRunLock({ runId });
    }
  }

  async failGate(runId, error) {
    await this.audit.warn('RUN_GATE_CHECK_FAIL', { run_id: runId, error_code: error });
    await this.audit.warn('RUN_NEEDS_ATTENTION', { run_id: runId, error_code: error });
    return { ok: false, error };
  }

  async runCheckpointRecovery(jobOrJobId, options = {}) {
    const runId = typeof options === 'string' ? options : (options?.runId || `run_rec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`);
    const acceptedLogged = typeof options === 'object' && options !== null && Boolean(options.acceptedLogged);

    const lockResult = await this.storage.acquireActiveRunLock({ runId });
    if (!lockResult.acquired) {
      await this.audit.warn('RUN_REENTRY_REJECTED', {
        run_id: runId,
        component: 'controller',
        details: { active_run_id: lockResult.lock?.run_id }
      });
      return { ok: false, error: 'RUN_ALREADY_ACTIVE', run_id: runId };
    }

    try {
      if (!acceptedLogged) {
        await this.audit.info('RUN_REQUEST_ACCEPTED', { run_id: runId, component: 'controller', mode: 'recovery' });
      }
      await this.audit.info('RUN_GATE_CHECK_START', { run_id: runId, mode: 'recovery' });

      const state = await this.storage.readState();
      if (!state.config.enabled) return this.failGate(runId, 'EXTENSION_DISABLED');
      if (!state.config.deviceToken || !state.config.deviceId) return this.failGate(runId, 'DEVICE_CREDENTIAL_REQUIRED');
      if (state.status.connection === 'backpressure') return this.failGate(runId, 'BACKPRESSURE');
      if (state.locks.providerLane) return this.failGate(runId, 'PROVIDER_LANE_BUSY');

      const provider = state.provider?.chatgpt ?? {};
      if (
        provider.tab_status !== 'connected' ||
        provider.auth_state !== 'AUTHENTICATED' ||
        provider.dom_status !== 'SUPPORTED'
      ) {
        return this.failGate(runId, 'PROVIDER_NOT_READY');
      }
      await this.audit.info('RUN_GATE_CHECK_PASS', { run_id: runId, mode: 'recovery' });

      let job = typeof jobOrJobId === 'object' && jobOrJobId !== null ? { ...jobOrJobId } : null;
      if (!job) {
        const jobId = typeof jobOrJobId === 'string' ? jobOrJobId : null;
        if (jobId) {
          job = state.jobs?.[jobId] ? { ...state.jobs[jobId] } : null;
        } else {
          const found = Object.values(state.jobs ?? {}).find((j) => isRecoverableResultCheckpoint(j.result_checkpoint, j));
          if (found) job = { ...found };
        }
      }
      if (!job) {
        await this.audit.warn('CHECKPOINT_RECOVERY_FAIL', { run_id: runId, error_code: 'RESULT_CHECKPOINT_MISSING' });
        const missErr = new Error('RESULT_CHECKPOINT_MISSING');
        missErr.code = 'RESULT_CHECKPOINT_MISSING';
        throw missErr;
      }

      const storedJob = state.jobs?.[job.job_id] || {};
      const candidateCheckpoint = job.result_checkpoint || storedJob.result_checkpoint || null;
      if (!candidateCheckpoint) {
        await this.audit.warn('CHECKPOINT_RECOVERY_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'RESULT_CHECKPOINT_MISSING' });
        const missErr = new Error('RESULT_CHECKPOINT_MISSING');
        missErr.code = 'RESULT_CHECKPOINT_MISSING';
        throw missErr;
      }
      if (!isRecoverableResultCheckpoint(candidateCheckpoint, job)) {
        await this.audit.warn('CHECKPOINT_RECOVERY_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'RESULT_CHECKPOINT_INVALID' });
        const invErr = new Error('RESULT_CHECKPOINT_INVALID');
        invErr.code = 'RESULT_CHECKPOINT_INVALID';
        throw invErr;
      }

      const captureBlobProbe = Boolean(
        (typeof options === 'object' && options !== null && options.captureBlobProbe !== undefined)
          ? options.captureBlobProbe
          : state.config?.captureBlobProbe
      );

      const deviceId = state.config.deviceId;
      let acquireResult = null;
      let leaseJob = job;

      if (hasValidRecoveryLease(leaseJob, deviceId)) {
        acquireResult = 'SKIPPED';
        await this.audit.info('JOB_ACQUIRE_SKIPPED', {
          run_id: runId,
          job_id: leaseJob.job_id,
          reason: 'EXISTING_LEASE_VALID',
          lease_owner: leaseJob.lease_owner,
          job_revision: leaseJob.job_revision
        });
      } else {
        await this.audit.info('JOB_ACQUIRE_START', { run_id: runId, mode: 'recovery', expected_job_id: job.job_id });
        let acquireResponse = null;
        try {
          acquireResponse = await this.apiClient.nextJob(deviceId);
        } catch (acquireErr) {
          await this.audit.warn('JOB_ACQUIRE_FAIL', {
            run_id: runId,
            error_code: acquireErr.code || acquireErr.message || 'ACQUIRE_REQUEST_FAILED',
            mode: 'recovery'
          });
          acquireResult = 'FAILED';
          const err = new Error(acquireErr.code || acquireErr.message || 'ACQUIRE_REQUEST_FAILED');
          err.code = acquireErr.code || 'ACQUIRE_REQUEST_FAILED';
          throw err;
        }

        if (acquireResponse?.protocol_version && acquireResponse.protocol_version !== LOKAMEDIA_PROTOCOL_VERSION) {
          await this.audit.error('JOB_ACQUIRE_FAIL', { run_id: runId, error_code: 'PROTOCOL_MISMATCH' });
          acquireResult = 'FAILED';
          const err = new Error('PROTOCOL_MISMATCH');
          err.code = 'PROTOCOL_MISMATCH';
          throw err;
        }

        const acquired = acquireResponse?.job;
        if (!acquired) {
          const code = acquireResponse?.error || 'NO_JOB_ACQUIRED';
          await this.audit.warn('JOB_ACQUIRE_FAIL', { run_id: runId, error_code: code, mode: 'recovery' });
          acquireResult = 'FAILED';
          const err = new Error(code);
          err.code = code;
          throw err;
        }

        // Fail-closed validation: acquired job_id and slot_key MUST match checkpoint
        if (acquired.job_id !== job.job_id || acquired.slot_key !== job.slot_key) {
          await this.audit.warn('JOB_ACQUIRE_FAIL', {
            run_id: runId,
            error_code: 'WRONG_ACQUIRED_JOB',
            expected_job_id: job.job_id,
            acquired_job_id: acquired.job_id,
            expected_slot_key: job.slot_key,
            acquired_slot_key: acquired.slot_key
          });
          if (typeof this.apiClient?.releaseJob === 'function') {
            try {
              await this.apiClient.releaseJob(acquired.job_id, {
                expectedJobRevision: acquired.job_revision,
                intent: 'SAFE_REQUEUE',
                reasonCode: 'WRONG_ACQUIRED_JOB_DURING_RECOVERY',
                messageSafe: 'Recovery acquired different job than checkpoint'
              });
            } catch (relErr) {
              this.logger?.warn?.('failed to release mismatched job lease', { error: relErr?.message || relErr });
            }
          }
          acquireResult = 'MISMATCH';
          const mismatchErr = new Error('WRONG_ACQUIRED_JOB');
          mismatchErr.code = 'WRONG_ACQUIRED_JOB';
          throw mismatchErr;
        }

        acquireResult = 'ACQUIRED';
        leaseJob = {
          ...job,
          ...acquired,
          result_checkpoint: candidateCheckpoint
        };
        await this.storage.upsertJob(leaseJob.job_id, leaseJob);
        await this.audit.info('JOB_ACQUIRED', {
          run_id: runId,
          job_id: leaseJob.job_id,
          article_id: leaseJob.article_id,
          slot_key: leaseJob.slot_key,
          lease_owner: leaseJob.lease_owner,
          job_revision: leaseJob.job_revision,
          mode: 'recovery'
        });

        // Heartbeat policy: issue heartbeat immediately after acquire / before capture
        if (this.heartbeat && typeof this.heartbeat.beat === 'function') {
          const beatResult = await this.heartbeat.beat(leaseJob);
          if (beatResult && !beatResult.ok) {
            const beatErr = new Error(beatResult.response?.error || 'HEARTBEAT_FAILED');
            beatErr.code = beatResult.response?.error || 'HEARTBEAT_FAILED';
            throw beatErr;
          }
        }
      }

      return await this.runJob(leaseJob, {
        runId,
        runMode: 'checkpoint_capture_recovery',
        captureBlobProbe,
        acquireResult,
        ...options
      });
    } finally {
      await this.storage.releaseActiveRunLock({ runId });
    }
  }

  async runJob(job, { runId = null, controlledRunOnce = false, providerResultProbe = false, captureBlobProbe = false, runMode = null, acquireResult = null } = {}) {
    const isExplicitRecovery = runMode === 'checkpoint_capture_recovery';
    const state = await this.storage.readState();
    const storedJob = state.jobs?.[job.job_id] || {};
    const candidateCheckpoint = job.result_checkpoint || storedJob.result_checkpoint || null;

    if (isExplicitRecovery) {
      if (!candidateCheckpoint) {
        const missErr = new Error('RESULT_CHECKPOINT_MISSING');
        missErr.code = 'RESULT_CHECKPOINT_MISSING';
        await this.audit.warn('CHECKPOINT_RECOVERY_FAIL', {
          run_id: runId,
          job_id: job.job_id,
          error_code: 'RESULT_CHECKPOINT_MISSING'
        });
        throw missErr;
      }
      if (!isRecoverableResultCheckpoint(candidateCheckpoint, job)) {
        const invErr = new Error('RESULT_CHECKPOINT_INVALID');
        invErr.code = 'RESULT_CHECKPOINT_INVALID';
        await this.audit.warn('CHECKPOINT_RECOVERY_FAIL', {
          run_id: runId,
          job_id: job.job_id,
          error_code: 'RESULT_CHECKPOINT_INVALID'
        });
        throw invErr;
      }
      return this._executeCaptureFromCheckpoint(job, candidateCheckpoint, {
        runId,
        captureBlobProbe,
        acquireResult: acquireResult || 'ACQUIRED'
      });
    }

    if (candidateCheckpoint) {
      if (!isRecoverableResultCheckpoint(candidateCheckpoint, job)) {
        const invErr = new Error('RESULT_CHECKPOINT_INVALID');
        invErr.code = 'RESULT_CHECKPOINT_INVALID';
        await this.audit.warn('CHECKPOINT_RECOVERY_FAIL', {
          run_id: runId,
          job_id: job.job_id,
          error_code: 'RESULT_CHECKPOINT_INVALID'
        });
        throw invErr;
      }
      return await this.runCheckpointRecovery(job, {
        runId,
        captureBlobProbe,
        controlledRunOnce
      });
    }

    await this.audit.info('PROVIDER_LANE_ACQUIRE_START', { run_id: runId, job_id: job.job_id });
    const acquired = await this.providerLane.acquire(job.job_id);
    if (!acquired) {
      await this.audit.warn('PROVIDER_LANE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'PROVIDER_BUSY' });
      return { acquired: false, reason: 'PROVIDER_BUSY' };
    }
    try {
      await this.audit.info('PROVIDER_LANE_ACQUIRED', { run_id: runId, job_id: job.job_id });
      await this.storage.upsertJob(job.job_id, { ...job, local_state: 'GENERATING' });
      const beatResult = await this.heartbeat.beat(job);
      if (beatResult && !beatResult.ok) {
        const err = new Error(beatResult.response?.error || 'HEARTBEAT_FAILED');
        err.code = beatResult.response?.error || 'HEARTBEAT_FAILED';
        throw err;
      }
      await this.audit.info('PROVIDER_PRECHECK_START', { run_id: runId, job_id: job.job_id });
      await this.audit.info('PROVIDER_PRECHECK_PASS', { run_id: runId, job_id: job.job_id });
      await this.audit.info('PROVIDER_PREPARE_START', { run_id: runId, job_id: job.job_id });
      await this.audit.info('PROVIDER_PREPARE_PASS', { run_id: runId, job_id: job.job_id });
      await this.audit.info('PROVIDER_SUBMIT_START', { run_id: runId, job_id: job.job_id, provider_stage: 'submit' });
      const providerResult = await this.provider.generate({ ...job, controlled_run_once: controlledRunOnce, run_id: runId });
      await this.audit.info('PROVIDER_SUBMIT_ACCEPTED', { run_id: runId, job_id: job.job_id, provider_stage: 'submit' });

      // Immediate post-generate validation
      if (!isCaptureReadyProviderResult(providerResult, { job_id: job.job_id, run_id: runId, slot_key: job.slot_key })) {
        const notReadyErr = new Error('PROVIDER_RESULT_NOT_CAPTURE_READY');
        notReadyErr.code = 'PROVIDER_RESULT_NOT_CAPTURE_READY';
        await this.audit.warn('PROVIDER_RESULT_INVALID', {
          run_id: runId,
          job_id: job.job_id,
          error_code: 'PROVIDER_RESULT_NOT_CAPTURE_READY'
        });
        throw notReadyErr;
      }

      const resultCheckpoint = {
        schema_version: providerResult.schema_version || 1,
        run_id: runId,
        job_id: job.job_id,
        slot_key: job.slot_key,
        prompt_version: job.prompt_version,
        prompt_hash: job.prompt_hash,
        provider_conversation_id: providerResult.provider_conversation_id || null,
        provider_response_id: providerResult.provider_response_id || null,
        source_fingerprint: providerResult.source_fingerprint,
        containerFingerprint: providerResult.containerFingerprint,
        candidate_ordinal: typeof providerResult.candidate_ordinal === 'number' ? providerResult.candidate_ordinal : null,
        candidate_alt: providerResult.candidate_alt || null,
        identified_at: providerResult.identified_at || new Date().toISOString()
      };

      await this.storage.upsertJob(job.job_id, {
        local_state: 'IMAGE_DETECTED',
        provider_conversation_id: providerResult.provider_conversation_id,
        provider_response_id: providerResult.provider_response_id,
        submitted_at: providerResult.submitted_at,
        result_checkpoint: resultCheckpoint
      });
      await this.audit.info('GENERATION_OBSERVER_START', { run_id: runId, job_id: job.job_id });
      await this.audit.info('GENERATION_IMAGE_DETECTED', {
        run_id: runId,
        job_id: job.job_id,
        details: {
          source_fingerprint: providerResult.source_fingerprint,
          containerFingerprint: providerResult.containerFingerprint
        }
      });

      if (providerResultProbe) {
        await this.audit.info('PROVIDER_RESULT_PROBE_STOP', {
          run_id: runId,
          job_id: job.job_id,
          details: {
            provider_conversation_id: providerResult?.provider_conversation_id || null,
            provider_response_id: providerResult?.provider_response_id || null,
            submitted_at: providerResult?.submitted_at || null,
            source_fingerprint: providerResult?.source_fingerprint || null,
            containerFingerprint: providerResult?.containerFingerprint || null,
            local_state: 'IMAGE_DETECTED'
          }
        });

        if (typeof this.apiClient?.releaseJob === 'function') {
          try {
            await this.apiClient.releaseJob(job.job_id, {
              expectedJobRevision: job.job_revision,
              intent: 'SAFE_REQUEUE',
              reasonCode: 'PROVIDER_RESULT_PROBE_STOP',
              messageSafe: 'Provider result probe stopped before image capture'
            });
            await this.audit.info('JOB_LEASE_RELEASED', {
              run_id: runId,
              job_id: job.job_id,
              details: { intent: 'SAFE_REQUEUE', reason: 'PROVIDER_RESULT_PROBE_STOP' }
            });
          } catch (releaseErr) {
            this.logger?.warn?.('failed to release job lease after provider result probe stop', { error: releaseErr?.message || releaseErr });
          }
        }

        return {
          ok: true,
          status: 'PROVIDER_RESULT_PROBE_STOPPED',
          run_id: runId,
          job_id: job.job_id,
          provider_result: {
            provider_conversation_id: providerResult?.provider_conversation_id || null,
            provider_response_id: providerResult?.provider_response_id || null,
            submitted_at: providerResult?.submitted_at || null,
            source_fingerprint: providerResult?.source_fingerprint || null,
            containerFingerprint: providerResult?.containerFingerprint || null
          }
        };
      }

      // Backpressure inspection before capturing & persisting new asset
      const pressure = await this.backpressure.inspect();
      if (pressure.blocked) {
        const bpErr = new Error('CAPTURE_BACKPRESSURE_LIMIT_EXCEEDED');
        bpErr.code = 'CAPTURE_BACKPRESSURE_LIMIT_EXCEEDED';
        bpErr.pressure = pressure;
        await this.audit.warn('CAPTURE_BACKPRESSURE_EXCEEDED', {
          run_id: runId,
          job_id: job.job_id,
          details: pressure
        });
        throw bpErr;
      }

      // Fail-closed guard: ensure providerResult is capture-ready before capture
      if (!isCaptureReadyProviderResult(providerResult, { job_id: job.job_id, run_id: runId, slot_key: job.slot_key })) {
        const notReadyErr = new Error('CONTROLLER_CAPTURE_PRECONDITION_FAILED');
        notReadyErr.code = 'CONTROLLER_CAPTURE_PRECONDITION_FAILED';
        throw notReadyErr;
      }

      await this.audit.info('CAPTURE_START', { run_id: runId, job_id: job.job_id });
      const captured = await this.provider.capture({ ...job, run_id: runId }, providerResult);

      // Binary validation
      if (!captured || !captured.bytes) {
        const binErr = new Error('CAPTURE_BINARY_MISSING');
        binErr.code = 'CAPTURE_BINARY_MISSING';
        throw binErr;
      }
      const byteLength = captured.bytes.byteLength ?? captured.size ?? 0;
      if (byteLength === 0) {
        const binErr = new Error('CAPTURE_BINARY_EMPTY');
        binErr.code = 'CAPTURE_BINARY_EMPTY';
        throw binErr;
      }
      const supportedMimes = new Set(['image/png', 'image/webp', 'image/jpeg']);
      if (!captured.mime || !supportedMimes.has(captured.mime)) {
        const binErr = new Error('CAPTURE_UNSUPPORTED_MIME');
        binErr.code = 'CAPTURE_UNSUPPORTED_MIME';
        throw binErr;
      }

      // Durable blob persistence
      await this.blobStore.put({
        key: captured.blobKey,
        job_id: job.job_id,
        sha256: captured.sha256,
        mime: captured.mime,
        width: captured.width,
        height: captured.height,
        size: captured.size ?? byteLength,
        bytes: captured.bytes,
        provenance: captured.provenance || 'PROVIDER_BINARY',
        is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED')
      });
      await this.audit.info('CAPTURE_PERSISTED', {
        run_id: runId,
        job_id: job.job_id,
        details: {
          sha256: captured.sha256,
          mime: captured.mime,
          width: captured.width,
          height: captured.height,
          size: captured.size ?? byteLength,
          provenance: captured.provenance || 'PROVIDER_BINARY',
          is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED')
        }
      });
      await this.storage.upsertJob(job.job_id, {
        local_state: 'CAPTURED',
        blob_key: captured.blobKey,
        sha256: captured.sha256,
        mime: captured.mime,
        width: captured.width,
        height: captured.height,
        provenance: captured.provenance || 'PROVIDER_BINARY',
        is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED')
      });

      // Capture Blob Probe boundary: stops immediately after durable persistence
      // and BEFORE provider lane release, upload queue enqueue, and uploads drain.
      if (captureBlobProbe) {
        await this.audit.info('CAPTURE_BLOB_PROBE_STOP', {
          run_id: runId,
          job_id: job.job_id,
          details: {
            blob_key: captured.blobKey,
            sha256: captured.sha256,
            mime: captured.mime,
            width: captured.width,
            height: captured.height,
            size: captured.size ?? byteLength,
            provenance: captured.provenance || 'PROVIDER_BINARY',
            is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED'),
            local_state: 'CAPTURED'
          }
        });
        return {
          ok: true,
          status: 'CAPTURE_BLOB_PROBE_STOPPED',
          run_id: runId,
          job_id: job.job_id,
          blob_key: captured.blobKey,
          details: {
            sha256: captured.sha256,
            mime: captured.mime,
            width: captured.width,
            height: captured.height,
            size: captured.size ?? byteLength,
            provenance: captured.provenance || 'PROVIDER_BINARY',
            is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED')
          }
        };
      }

      await this.providerLane.release(job.job_id);
      await this.storage.enqueueUpload(job.job_id);
      await this.audit.info('UPLOAD_START', { run_id: runId, job_id: job.job_id });
      await this.uploads.drain();
      await this.audit.info('UPLOAD_RECEIVED', { run_id: runId, job_id: job.job_id });
      await this.audit.info('ATTACHMENT_CONFIRMED', { run_id: runId, job_id: job.job_id });
      await this.audit.info('JOB_COMPLETE', { run_id: runId, job_id: job.job_id });
      return { acquired: true, job_id: job.job_id };
    } catch (error) {
      await this.audit.error('PROVIDER_SUBMIT_FAIL', { run_id: runId, job_id: job.job_id, error });
      await this.storage.upsertJob(job.job_id, {
        local_state: error.status === 401 ? 'AUTH_REQUIRED' : 'RECOVERING',
        last_error: error.message
      });
      throw error;
    } finally {
      await this.providerLane.release(job.job_id);
    }
  }

  async _executeCaptureFromCheckpoint(job, checkpoint, { runId = null, captureBlobProbe = false, acquireResult = 'ACQUIRED' } = {}) {
    const originRunId = checkpoint.run_id;
    const recoveryRunId = runId || `run_rec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    await this.audit.info('CHECKPOINT_RECOVERY_START', {
      run_id: recoveryRunId,
      origin_run_id: originRunId,
      job_id: job.job_id,
      slot_key: job.slot_key
    });

    await this.audit.info('CHECKPOINT_RECOVERY_VALIDATED', {
      run_id: recoveryRunId,
      origin_run_id: originRunId,
      job_id: job.job_id,
      slot_key: job.slot_key,
      details: {
        source_fingerprint: checkpoint.source_fingerprint || checkpoint.fingerprint,
        containerFingerprint: checkpoint.containerFingerprint,
        schema_version: checkpoint.schema_version ?? 1
      }
    });

    const acquired = await this.providerLane.acquire(job.job_id);
    if (!acquired) {
      await this.audit.warn('PROVIDER_LANE_FAIL', {
        run_id: recoveryRunId,
        origin_run_id: originRunId,
        job_id: job.job_id,
        error_code: 'PROVIDER_BUSY'
      });
      return { acquired: false, reason: 'PROVIDER_BUSY' };
    }

    try {
      await this.audit.info('PROVIDER_LANE_ACQUIRED', {
        run_id: recoveryRunId,
        origin_run_id: originRunId,
        job_id: job.job_id
      });

      const state = await this.storage.readState();
      const deviceId = state?.config?.deviceId;
      if (!hasValidRecoveryLease(job, deviceId)) {
        const leaseErr = new Error('EXPIRED_RECOVERY_LEASE');
        leaseErr.code = 'EXPIRED_RECOVERY_LEASE';
        throw leaseErr;
      }

      // Backpressure inspection before capturing & persisting
      const pressure = await this.backpressure.inspect();
      if (pressure.blocked) {
        const bpErr = new Error('CAPTURE_BACKPRESSURE_LIMIT_EXCEEDED');
        bpErr.code = 'CAPTURE_BACKPRESSURE_LIMIT_EXCEEDED';
        bpErr.pressure = pressure;
        await this.audit.warn('CAPTURE_BACKPRESSURE_EXCEEDED', {
          run_id: recoveryRunId,
          origin_run_id: originRunId,
          job_id: job.job_id,
          details: pressure
        });
        throw bpErr;
      }

      await this.audit.info('CHECKPOINT_RECOVERY_CAPTURE_START', {
        run_id: recoveryRunId,
        origin_run_id: originRunId,
        job_id: job.job_id
      });

      // Pass originRunId in captureJob so adapter and content-script correlation match descriptor.run_id!
      const captureJob = { ...job, run_id: originRunId || recoveryRunId };
      const captured = await this.provider.capture(captureJob, checkpoint);

      // Binary validation
      if (!captured || !captured.bytes) {
        const binErr = new Error('CAPTURE_BINARY_MISSING');
        binErr.code = 'CAPTURE_BINARY_MISSING';
        throw binErr;
      }
      const byteLength = captured.bytes.byteLength ?? captured.size ?? 0;
      if (byteLength === 0) {
        const binErr = new Error('CAPTURE_BINARY_EMPTY');
        binErr.code = 'CAPTURE_BINARY_EMPTY';
        throw binErr;
      }
      const supportedMimes = new Set(['image/png', 'image/webp', 'image/jpeg']);
      if (!captured.mime || !supportedMimes.has(captured.mime)) {
        const binErr = new Error('CAPTURE_UNSUPPORTED_MIME');
        binErr.code = 'CAPTURE_UNSUPPORTED_MIME';
        throw binErr;
      }

      await this.audit.info('CHECKPOINT_RECOVERY_CAPTURE_SUCCESS', {
        run_id: recoveryRunId,
        origin_run_id: originRunId,
        job_id: job.job_id,
        details: {
          sha256: captured.sha256,
          mime: captured.mime,
          width: captured.width,
          height: captured.height,
          size: captured.size ?? byteLength
        }
      });

      // Durable blob persistence
      await this.blobStore.put({
        key: captured.blobKey,
        job_id: job.job_id,
        sha256: captured.sha256,
        mime: captured.mime,
        width: captured.width,
        height: captured.height,
        size: captured.size ?? byteLength,
        bytes: captured.bytes,
        provenance: captured.provenance || 'PROVIDER_BINARY',
        is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED')
      });

      await this.audit.info('CAPTURE_PERSISTED', {
        run_id: recoveryRunId,
        job_id: job.job_id,
        details: {
          sha256: captured.sha256,
          mime: captured.mime,
          width: captured.width,
          height: captured.height,
          size: captured.size ?? byteLength,
          provenance: captured.provenance || 'PROVIDER_BINARY',
          is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED')
        }
      });

      await this.storage.upsertJob(job.job_id, {
        local_state: 'CAPTURED',
        blob_key: captured.blobKey,
        sha256: captured.sha256,
        mime: captured.mime,
        width: captured.width,
        height: captured.height,
        result_checkpoint: checkpoint,
        provenance: captured.provenance || 'PROVIDER_BINARY',
        is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED')
      });

      // Capture Blob Probe boundary: stops immediately after durable persistence
      if (captureBlobProbe) {
        await this.audit.info('CAPTURE_BLOB_PROBE_STOP', {
          run_id: recoveryRunId,
          job_id: job.job_id,
          details: {
            blob_key: captured.blobKey,
            sha256: captured.sha256,
            mime: captured.mime,
            width: captured.width,
            height: captured.height,
            size: captured.size ?? byteLength,
            provenance: captured.provenance || 'PROVIDER_BINARY',
            is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED'),
            local_state: 'CAPTURED'
          }
        });
        return {
          ok: true,
          status: 'CAPTURE_BLOB_PROBE_STOPPED',
          execution_mode: 'checkpoint_capture_recovery',
          checkpoint_recovery_used: true,
          acquire_result: acquireResult,
          origin_run_id: originRunId,
          recovery_run_id: recoveryRunId,
          run_id: recoveryRunId,
          job_id: job.job_id,
          blob_key: captured.blobKey,
          details: {
            sha256: captured.sha256,
            mime: captured.mime,
            width: captured.width,
            height: captured.height,
            size: captured.size ?? byteLength,
            provenance: captured.provenance || 'PROVIDER_BINARY',
            is_canonical_original: captured.is_canonical_original ?? (captured.provenance !== 'CANVAS_REENCODED')
          }
        };
      }

      await this.providerLane.release(job.job_id);
      await this.storage.enqueueUpload(job.job_id);
      await this.audit.info('UPLOAD_START', { run_id: recoveryRunId, job_id: job.job_id });
      await this.uploads.drain();
      await this.audit.info('UPLOAD_RECEIVED', { run_id: recoveryRunId, job_id: job.job_id });
      await this.audit.info('ATTACHMENT_CONFIRMED', { run_id: recoveryRunId, job_id: job.job_id });
      await this.audit.info('JOB_COMPLETE', { run_id: recoveryRunId, job_id: job.job_id });
      return {
        ok: true,
        acquired: true,
        execution_mode: 'checkpoint_capture_recovery',
        checkpoint_recovery_used: true,
        acquire_result: acquireResult,
        origin_run_id: originRunId,
        recovery_run_id: recoveryRunId,
        run_id: recoveryRunId,
        job_id: job.job_id
      };
    } catch (error) {
      await this.audit.error('CHECKPOINT_RECOVERY_FAIL', {
        run_id: recoveryRunId,
        origin_run_id: originRunId,
        job_id: job.job_id,
        error_code: error.code || error.message,
        error
      });
      await this.storage.upsertJob(job.job_id, {
        local_state: error.status === 401 ? 'AUTH_REQUIRED' : 'RECOVERING',
        last_error: error.message,
        result_checkpoint: checkpoint
      });
      throw error;
    } finally {
      await this.providerLane.release(job.job_id);
    }
  }
}
