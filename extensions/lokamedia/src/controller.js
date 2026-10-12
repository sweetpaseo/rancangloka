import { BackpressureController } from './backpressure.js';
import { ProviderLane } from './provider-adapter.js';
import { MockProviderAdapter } from './mock-provider.js';
import { ReconciliationManager, hasValidRecoveryLease } from './reconciliation-manager.js';
import { UploadWorkerPool } from './upload-worker-pool.js';
import { HeartbeatManager } from './heartbeat-manager.js';
import { AuditLogger } from './audit-log.js';
import { cloneBytes } from './blob-store.js';
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
      const targetJobId = options?.jobId ||
        Object.values(state.jobs ?? {}).find((j) => (j.local_state ?? j.status) === 'QUEUED' || (j.local_state ?? j.status) === 'WAITING_RETRY')?.job_id ||
        (state.phase4bSingleRun?.job_id && state.jobs?.[state.phase4bSingleRun.job_id] ? state.phase4bSingleRun.job_id : null) ||
        Object.values(state.jobs ?? {}).find((j) => j.status === 'COMPLETE')?.job_id ||
        null;

      if (targetJobId) {
        const targetGate = state.phase4bJobGates?.[targetJobId] ||
          (state.phase4bSingleRun?.job_id === targetJobId ? state.phase4bSingleRun : null);
        if (targetGate && (targetGate.submission_consumed || targetGate.generation_consumed || (targetGate.completed_at && targetGate.outcome === 'complete'))) {
          const hasUnconsumedQueuedJob = Object.values(state.jobs ?? {}).some((j) => {
            if (j.job_id === targetJobId) return false;
            if ((j.local_state ?? j.status) !== 'QUEUED' && (j.local_state ?? j.status) !== 'WAITING_RETRY') return false;
            const jGate = state.phase4bJobGates?.[j.job_id] || (state.phase4bSingleRun?.job_id === j.job_id ? state.phase4bSingleRun : null);
            return !jGate || (!jGate.submission_consumed && !jGate.generation_consumed && jGate.outcome !== 'complete');
          });

          if (options?.jobId || !hasUnconsumedQueuedJob) {
            await this.audit.warn('RUN_GATE_CHECK_FAIL', { run_id: runId, error_code: 'PHASE_4B_RUN_CONSUMED', details: { job_id: targetJobId } });
            await this.storage.update((st) => {
              st.status.last_error = 'PHASE_4B_RUN_CONSUMED';
            });
            return { ok: false, error: 'PHASE_4B_RUN_CONSUMED' };
          }
        }
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
        const deviceId = state.config.deviceId || 'dev_chr_local';
        if (!state.config.deviceToken || !deviceId) return this.failGate(runId, 'DEVICE_CREDENTIAL_REQUIRED');
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
      if (!state.config.enabled) return this.failGate(runId, 'EXTENSION_DISABLED');
      const deviceId = state.config.deviceId || 'dev_chr_local';
      if (!state.config.deviceToken || !deviceId) return this.failGate(runId, 'DEVICE_CREDENTIAL_REQUIRED');
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
      let response;
      try {
        response = await this.apiClient.nextJob(deviceId);
      } catch (acquireError) {
        await this.audit.error('JOB_ACQUIRE_FAIL', {
          run_id: runId,
          error_code: String(acquireError?.message || acquireError).slice(0, 80)
        });
        throw acquireError;
      }
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
      if (job.slot_key !== 'featured') {
        await this.audit.warn('JOB_ACQUIRE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'WRONG_PHASE_4B_JOB' });
        return { ok: false, error: 'WRONG_PHASE_4B_JOB', job_id: job.job_id };
      }
      await this.audit.info('JOB_ACQUIRED', { run_id: runId, job_id: job.job_id, article_id: job.article_id, slot_key: job.slot_key, server_job_status: job.status });
      await this.storage.update((s) => { s.currentJobId = job.job_id; });

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

      try {
        const result = await this.runJob(job, { runId, controlledRunOnce: true, providerResultProbe, captureBlobProbe });
        if (result?.status === 'PROVIDER_RESULT_PROBE_STOPPED' || result?.status === 'CAPTURE_BLOB_PROBE_STOPPED') {
          return result;
        }
        if (result?.status === 'RESULT_READY') {
          return { ok: true, ...result };
        }
        await this.storage.completePhase4bSingleRun({ jobId: job.job_id, ok: true });
        await this.audit.info('RUN_COMPLETE', { run_id: runId, job_id: job.job_id });
        return { ok: true, ...result };
      } catch (error) {
        const submissionEscaped = error?.submission_escaped ?? (error?.code !== 'DOM_CONTRACT_UNSUPPORTED' && error?.code !== 'PROMPT_INSERTION_VERIFICATION_FAILED' && error?.code !== 'SEND_CONTROL_UNAVAILABLE' && error?.code !== 'SEND_CONTROL_DISABLED' && error?.code !== 'AUTH_REQUIRED' && error?.code !== 'PROVIDER_PRECHECK_FAIL');
        if (!submissionEscaped) {
          await this.storage.disarmPhase4bSubmission({ jobId: job.job_id });
        }
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
      if (typeof this.provider?.prepare === 'function') {
        const precheck = await this.provider.prepare(job);
        if (precheck && precheck.dom_status !== 'SUPPORTED') {
          const precheckErr = new Error(precheck.error_code || 'DOM_CONTRACT_UNSUPPORTED');
          precheckErr.code = precheck.error_code || 'DOM_CONTRACT_UNSUPPORTED';
          precheckErr.submission_escaped = false;
          await this.audit.warn('PROVIDER_PRECHECK_FAIL', { run_id: runId, job_id: job.job_id, error_code: precheckErr.code });
          throw precheckErr;
        }
      }
      await this.audit.info('PROVIDER_PRECHECK_PASS', { run_id: runId, job_id: job.job_id });
      await this.audit.info('PROVIDER_PREPARE_START', { run_id: runId, job_id: job.job_id });
      await this.audit.info('PROVIDER_PREPARE_PASS', { run_id: runId, job_id: job.job_id });

      if (controlledRunOnce) {
        const consumed = await this.storage.consumePhase4bSubmission({ jobId: job.job_id });
        if (!consumed.consumed) return { ok: false, error: consumed.reason };
        await this.audit.info('SUBMISSION_GATE_CONSUMED', { run_id: runId, job_id: job.job_id });
      }

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

      await this.audit.info('RESULT_READY', {
        run_id: runId,
        job_id: job.job_id,
        details: {
          sha256: captured.sha256,
          mime: captured.mime,
          width: captured.width,
          height: captured.height,
          size: captured.size ?? byteLength
        }
      });
      await this.providerLane.release(job.job_id);
      await this.storage.update((s) => { s.currentJobId = job.job_id; });
      return {
        ok: true,
        acquired: true,
        status: 'RESULT_READY',
        job_id: job.job_id,
        blob_key: captured.blobKey,
        sha256: captured.sha256,
        width: captured.width,
        height: captured.height,
        mime: captured.mime,
        size: captured.size ?? byteLength
      };
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

      await this.audit.info('RESULT_READY', {
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
      await this.providerLane.release(job.job_id);
      return {
        ok: true,
        acquired: true,
        status: 'RESULT_READY',
        execution_mode: 'checkpoint_capture_recovery',
        checkpoint_recovery_used: true,
        acquire_result: acquireResult,
        origin_run_id: originRunId,
        recovery_run_id: recoveryRunId,
        run_id: recoveryRunId,
        job_id: job.job_id,
        blob_key: captured.blobKey,
        sha256: captured.sha256
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

  async sendToChatGpt(options = {}) {
    const runId = options?.runId || `run_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await this.audit.info('PANEL_SEND_CLICK', { run_id: runId, component: 'side-panel', action: 'SEND_TO_CHATGPT' });

    const lockResult = await this.storage.acquireActiveRunLock({ runId });
    if (!lockResult.acquired) {
      await this.audit.warn('RUN_REENTRY_REJECTED', { run_id: runId, details: { active_run_id: lockResult.lock?.run_id } });
      return { ok: false, error: 'RUN_ALREADY_ACTIVE', run_id: runId };
    }

    try {
      const state = await this.storage.readState();
      if (!state.config.enabled) return this.failGate(runId, 'EXTENSION_DISABLED');

      const provider = state.provider?.chatgpt ?? {};
      if (provider.target_state !== 'LOCKED' || !provider.provider_tab_id) {
        return this.failGate(runId, 'PROVIDER_TARGET_NOT_LOCKED');
      }
      if (
        provider.tab_status !== 'connected' ||
        provider.auth_state !== 'AUTHENTICATED' ||
        provider.dom_status !== 'SUPPORTED' ||
        provider.composer_status !== 'ready'
      ) {
        return this.failGate(runId, 'PROVIDER_NOT_READY');
      }

      const deviceId = state.config.deviceId || 'dev_chr_local';
      let targetJob = null;
      if (options?.jobId) {
        targetJob = state.jobs?.[options.jobId];
      }
      if (!targetJob) {
        const waitingJob = Object.values(state.jobs ?? {}).find((j) => (j.local_state ?? j.status) === 'QUEUED' || (j.local_state ?? j.status) === 'WAITING_RETRY');
        if (waitingJob) targetJob = waitingJob;
      }
      if (!targetJob) {
        try {
          const acquireResp = await this.apiClient.nextJob(deviceId);
          if (acquireResp?.job) targetJob = acquireResp.job;
        } catch {}
      }
      if (!targetJob) {
        return { ok: false, error: 'NO_ELIGIBLE_JOB' };
      }

      // Job-scoped phase4b gate check
      const jobGate = state.phase4bJobGates?.[targetJob.job_id] || (state.phase4bSingleRun?.job_id === targetJob.job_id ? state.phase4bSingleRun : null);
      if (jobGate && (jobGate.submission_consumed || jobGate.generation_consumed || (jobGate.completed_at && jobGate.outcome === 'complete'))) {
        await this.audit.warn('RUN_GATE_CHECK_FAIL', { run_id: runId, error_code: 'PHASE_4B_RUN_CONSUMED', details: { job_id: targetJob.job_id } });
        await this.storage.update((st) => {
          st.status.last_error = 'PHASE_4B_RUN_CONSUMED';
        });
        return { ok: false, error: 'PHASE_4B_RUN_CONSUMED' };
      }

      const armResult = await this.storage.armPhase4bSingleRun({ jobId: targetJob.job_id, runId });
      if (armResult && armResult.armed === false) {
        await this.audit.warn('RUN_GATE_CHECK_FAIL', { run_id: runId, error_code: 'PHASE_4B_RUN_CONSUMED', details: { job_id: targetJob.job_id } });
        await this.storage.update((st) => {
          st.status.last_error = 'PHASE_4B_RUN_CONSUMED';
        });
        return { ok: false, error: 'PHASE_4B_RUN_CONSUMED' };
      }
      await this.audit.info('SUBMISSION_GATE_ARMED', { run_id: runId, job_id: targetJob.job_id });

      const acquiredLane = await this.providerLane.acquire(targetJob.job_id);
      if (!acquiredLane) return { ok: false, error: 'PROVIDER_BUSY' };

      try {
        await this.storage.update((st) => {
          st.currentJobId = targetJob.job_id;
        });
        await this.storage.upsertJob(targetJob.job_id, {
          ...targetJob,
          local_state: 'GENERATING',
          run_id: runId
        });
        await this.provider.prepare(targetJob);
        await this.storage.consumePhase4bSubmission({ jobId: targetJob.job_id });
        await this.audit.info('PROVIDER_SUBMIT_START', { run_id: runId, job_id: targetJob.job_id });

        const providerResult = await this.provider.generate({
          ...targetJob,
          controlled_run_once: true,
          run_id: runId
        });
        await this.audit.info('PROVIDER_SUBMIT_ACCEPTED', { run_id: runId, job_id: targetJob.job_id });

        const resultCheckpoint = {
          schema_version: providerResult.schema_version || 2,
          run_id: runId,
          job_id: targetJob.job_id,
          slot_key: targetJob.slot_key || 'featured',
          prompt_version: targetJob.prompt_version || 1,
          prompt_hash: targetJob.prompt_hash || '',
          provider_conversation_id: providerResult.provider_conversation_id || null,
          provider_response_id: providerResult.provider_response_id || null,
          source_fingerprint: providerResult.source_fingerprint,
          containerFingerprint: providerResult.containerFingerprint,
          identified_at: providerResult.identified_at || new Date().toISOString()
        };

        await this.storage.upsertJob(targetJob.job_id, {
          local_state: 'IMAGE_DETECTED',
          provider_conversation_id: providerResult.provider_conversation_id,
          provider_response_id: providerResult.provider_response_id,
          submitted_at: providerResult.submitted_at || new Date().toISOString(),
          result_checkpoint: resultCheckpoint
        });
        await this.audit.info('GENERATION_IMAGE_DETECTED', { run_id: runId, job_id: targetJob.job_id });

        return {
          ok: true,
          status: 'GENERATING',
          job_id: targetJob.job_id,
          run_id: runId,
          providerResult
        };
      } finally {
        await this.providerLane.release(targetJob.job_id);
      }
    } finally {
      await this.storage.releaseActiveRunLock({ runId });
    }
  }

  async captureLatestImage(options = {}) {
    const runId = options?.runId || `run_cap_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await this.audit.info('PANEL_CAPTURE_CLICK', { run_id: runId, component: 'side-panel', action: 'CAPTURE_LATEST_IMAGE' });

    const state = await this.storage.readState();
    let job = options?.jobId ? state.jobs?.[options.jobId] : null;
    if (!job) {
      job = Object.values(state.jobs ?? {}).find((j) => j.local_state === 'IMAGE_DETECTED' || j.local_state === 'GENERATING' || j.local_state === 'CAPTURING' || j.result_checkpoint);
    }
    if (!job) {
      return { ok: false, error: 'NO_CAPTURING_JOB' };
    }

    const provider = state.provider?.chatgpt ?? {};
    if (provider.target_state !== 'LOCKED' || !provider.provider_tab_id) {
      return { ok: false, error: 'PROVIDER_TARGET_NOT_LOCKED' };
    }

    await this.storage.update((st) => {
      st.currentJobId = job.job_id;
    });
    await this.storage.upsertJob(job.job_id, { local_state: 'CAPTURING' });
    const captured = await this.provider.captureLatest({ ...job, run_id: runId });
    if (!captured?.bytes || (captured.bytes.byteLength ?? captured.size ?? 0) === 0) {
      return { ok: false, error: 'CAPTURE_BINARY_EMPTY' };
    }

    await this.blobStore.put({
      key: captured.blobKey,
      job_id: job.job_id,
      sha256: captured.sha256,
      mime: captured.mime,
      width: captured.width,
      height: captured.height,
      size: captured.size,
      bytes: captured.bytes,
      provenance: captured.provenance || 'PROVIDER_BINARY'
    });

    await this.storage.upsertJob(job.job_id, {
      local_state: 'CAPTURED',
      blob_key: captured.blobKey,
      sha256: captured.sha256,
      mime: captured.mime,
      width: captured.width,
      height: captured.height,
      size: captured.size,
      captured_at: new Date().toISOString()
    });

    await this.audit.info('RESULT_READY', {
      run_id: runId,
      job_id: job.job_id,
      details: {
        sha256: captured.sha256,
        mime: captured.mime,
        width: captured.width,
        height: captured.height,
        size: captured.size
      }
    });

    return {
      ok: true,
      status: 'RESULT_READY',
      job_id: job.job_id,
      blob_key: captured.blobKey,
      sha256: captured.sha256,
      width: captured.width,
      height: captured.height,
      mime: captured.mime,
      size: captured.size
    };
  }

  async approveAndUpload(options = {}) {
    const runId = options?.runId || `run_upl_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await this.audit.info('PANEL_APPROVE_CLICK', { run_id: runId, component: 'side-panel', action: 'APPROVE_AND_UPLOAD' });

    const state = await this.storage.readState();
    let job = options?.jobId ? state.jobs?.[options.jobId] : null;
    if (!job && state.currentJobId) {
      job = state.jobs?.[state.currentJobId];
    }
    if (!job) {
      job = Object.values(state.jobs ?? {}).find((j) => j.local_state === 'CAPTURED' && j.blob_key);
    }
    if (!job || !job.blob_key) {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', { run_id: runId, error_code: 'NO_CAPTURED_ASSET_TO_UPLOAD' });
      return { ok: false, error: 'NO_CAPTURED_ASSET_TO_UPLOAD' };
    }

    // 1. Current job identity check
    if (options?.jobId && options.jobId !== job.job_id) {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'JOB_IDENTITY_MISMATCH' });
      return { ok: false, error: 'JOB_IDENTITY_MISMATCH' };
    }

    const opState = state.jobOperationalStates?.[job.job_id];
    const candidate = opState?.candidate || {
      job_id: job.job_id,
      run_id: job.run_id || null,
      sha256: job.sha256 || null,
      blob_key: job.blob_key || null
    };

    // Duplicate approval consumption check (scoped by job_id + candidate_sha256)
    const existingApproval = state.jobApprovals?.[job.job_id] || opState?.approval;
    if (existingApproval && existingApproval.consumed) {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', {
        run_id: runId,
        job_id: job.job_id,
        error_code: 'APPROVAL_ALREADY_CONSUMED',
        details: { sha256: existingApproval.candidate_sha256 }
      });
      return { ok: false, error: 'APPROVAL_ALREADY_CONSUMED' };
    }

    if (candidate.is_uploaded || job.local_state === 'UPLOAD_COMPLETE' || job.status === 'COMPLETE') {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'CANDIDATE_ALREADY_UPLOADED' });
      return { ok: false, error: 'CANDIDATE_ALREADY_UPLOADED' };
    }

    // 2. Stage check: must be RESULT READY (local_state === 'CAPTURED')
    if (job.local_state !== 'CAPTURED') {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'STAGE_NOT_RESULT_READY' });
      return { ok: false, error: 'STAGE_NOT_RESULT_READY' };
    }

    // 3. Candidate check
    if (!candidate || !candidate.blob_key || !candidate.sha256) {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'CANDIDATE_MISSING' });
      return { ok: false, error: 'CANDIDATE_MISSING' };
    }

    if (candidate.job_id && candidate.job_id !== job.job_id) {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'CANDIDATE_JOB_MISMATCH' });
      return { ok: false, error: 'CANDIDATE_JOB_MISMATCH' };
    }

    // 4. SHA match check
    const previewedSha = candidate.sha256;
    if (options?.expectedSha256 && options.expectedSha256 !== previewedSha) {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', {
        run_id: runId,
        job_id: job.job_id,
        error_code: 'APPROVAL_SHA_MISMATCH',
        details: { expected_sha: options.expectedSha256, candidate_sha: previewedSha }
      });
      return { ok: false, error: 'UPLOAD_APPROVAL_GATE_FAIL' };
    }

    if (options?.approvalRecord?.candidate_sha256 && options.approvalRecord.candidate_sha256 !== previewedSha) {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', {
        run_id: runId,
        job_id: job.job_id,
        error_code: 'APPROVAL_SHA_MISMATCH',
        details: { approval_sha: options.approvalRecord.candidate_sha256, candidate_sha: previewedSha }
      });
      return { ok: false, error: 'UPLOAD_APPROVAL_GATE_FAIL' };
    }

    // 5. Blob data existence check
    const blobRecord = await this.blobStore.get(candidate.blob_key);
    if (!blobRecord || !blobRecord.bytes) {
      await this.audit.warn('UPLOAD_APPROVAL_GATE_FAIL', { run_id: runId, job_id: job.job_id, error_code: 'BLOB_DATA_MISSING' });
      return { ok: false, error: 'BLOB_DATA_MISSING' };
    }

    // 7. Record explicit human approval
    const now = new Date().toISOString();
    const approvalRecord = {
      job_id: job.job_id,
      run_id: candidate.run_id || job.run_id || runId,
      candidate_sha256: previewedSha,
      approved_at: now,
      approval_source: options?.approvalSource || 'operator_side_panel',
      consumed: true,
      consumed_at: now
    };

    await this.storage.recordHumanApproval(approvalRecord);
    await this.audit.info('HUMAN_APPROVAL_RECORDED', {
      run_id: runId,
      job_id: job.job_id,
      details: {
        approval_source: approvalRecord.approval_source,
        candidate_sha256: previewedSha,
        approved_at: now
      }
    });

    // 8. Upload approval gate passes
    await this.audit.info('UPLOAD_APPROVAL_GATE_PASS', {
      run_id: runId,
      job_id: job.job_id,
      details: { candidate_sha256: previewedSha }
    });

    // 9. Transition to UPLOADING and dispatch upload
    await this.storage.update((st) => {
      st.currentJobId = job.job_id;
    });
    await this.storage.upsertJob(job.job_id, {
      local_state: 'UPLOADING',
      approval_record: approvalRecord
    });
    await this.storage.enqueueUpload(job.job_id);
    await this.audit.info('UPLOAD_START', { run_id: runId, job_id: job.job_id });
    await this.uploads.drain();

    // 10. Complete state
    await this.storage.upsertJob(job.job_id, { local_state: 'UPLOAD_COMPLETE', status: 'COMPLETE' });
    await this.storage.completePhase4bSingleRun({ jobId: job.job_id, ok: true });
    await this.audit.info('UPLOAD_RECEIVED', { run_id: runId, job_id: job.job_id });
    await this.audit.info('ATTACHMENT_CONFIRMED', { run_id: runId, job_id: job.job_id });
    await this.audit.info('JOB_COMPLETE', { run_id: runId, job_id: job.job_id });

    return {
      ok: true,
      status: 'UPLOAD_COMPLETE',
      job_id: job.job_id,
      sha256: previewedSha,
      approval: approvalRecord
    };
  }

  async rejectResult(options = {}) {
    const runId = options?.runId || `run_rej_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await this.audit.info('PANEL_REJECT_CLICK', { run_id: runId, component: 'side-panel', action: 'REJECT_RESULT' });

    const state = await this.storage.readState();
    let job = options?.jobId ? state.jobs?.[options.jobId] : null;
    if (!job && state.currentJobId) {
      job = state.jobs?.[state.currentJobId];
    }
    if (!job) {
      job = Object.values(state.jobs ?? {}).find((j) => j.local_state === 'CAPTURED' || j.local_state === 'IMAGE_DETECTED');
    }
    if (!job) {
      return { ok: false, error: 'NO_RESULT_TO_REJECT' };
    }

    const discardedSha = job.sha256 || null;
    if (job.blob_key) {
      await this.blobStore.delete(job.blob_key);
    }

    const now = new Date().toISOString();
    await this.storage.recordHumanRejection({
      jobId: job.job_id,
      runId,
      candidateSha256: discardedSha,
      rejectionSource: 'operator_side_panel',
      now
    });

    await this.storage.upsertJob(job.job_id, {
      local_state: 'RESULT_REJECTED',
      blob_key: null,
      sha256: null,
      result_checkpoint: null,
      rejected_at: now
    });

    await this.audit.info('HUMAN_REJECTION_RECORDED', {
      run_id: runId,
      job_id: job.job_id,
      details: {
        discarded_sha256: discardedSha,
        rejection_source: 'operator_side_panel',
        zero_upload: true,
        zero_attachment: true,
        zero_mutation: true
      }
    });

    await this.audit.info('RESULT_REJECTED', {
      run_id: runId,
      job_id: job.job_id,
      details: { discarded_sha256: discardedSha, zero_upload: true, zero_mutation: true }
    });

    return {
      ok: true,
      status: 'RESULT_REJECTED',
      job_id: job.job_id,
      discarded_sha256: discardedSha
    };
  }

  async saveLocalFileCandidate(options = {}) {
    const { jobId, bytes, mime, width, height, size, sha256 } = options;
    if (!jobId || !bytes) return { ok: false, error: 'INVALID_PAYLOAD' };
    const supportedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!supportedMimes.has(mime)) return { ok: false, error: 'UNSUPPORTED_MIME' };

    const state = await this.storage.readState();
    const job = state.jobs?.[jobId];
    if (job && (job.local_state === 'COMPLETE' || job.status === 'COMPLETE' || job.local_state === 'UPLOAD_COMPLETE')) {
      return { ok: false, error: 'CANNOT_MUTATE_COMPLETED_JOB' };
    }

    const blobKey = `${jobId}:local_${Date.now()}`;
    await this.blobStore.put({
      key: blobKey,
      job_id: jobId,
      sha256,
      mime,
      width,
      height,
      size,
      bytes,
      provenance: 'LOCAL_FILE'
    });

    await this.storage.upsertJob(jobId, {
      local_state: 'CAPTURED',
      blob_key: blobKey,
      sha256,
      mime,
      width,
      height,
      size,
      provenance: 'LOCAL_FILE',
      captured_at: new Date().toISOString()
    });

    await this.audit.info('LOCAL_FILE_ACCEPTED', {
      job_id: jobId,
      details: { sha256, mime, width, height, size }
    });

    return {
      ok: true,
      status: 'RESULT_READY',
      job_id: jobId,
      blob_key: blobKey,
      sha256,
      width,
      height,
      mime,
      size
    };
  }

  async manualResolveArticle({ slug }) {
    if (!slug || typeof slug !== 'string') {
      return { ok: false, error: 'SLUG_REQUIRED' };
    }
    const cleanSlug = slug.trim();
    try {
      const res = await this.apiClient.resolveArticle(cleanSlug);
      if (!res.article) {
        return { ok: false, error: res.error || 'ARTICLE_NOT_FOUND' };
      }
      const article = res.article;
      await this.storage.updateManualPromotionState((current) => {
        const next = { ...current };
        next.targetArticle = article;
        if (current.approval && current.approval.article_slug !== article.slug) {
          next.approval = null;
        }
        if (current.candidate) {
          next.stage = current.approval ? 'APPROVED' : 'CANDIDATE_READY';
        } else {
          next.stage = 'RESOLVED';
        }
        next.lastError = null;
        return next;
      });

      await this.audit.info('MANUAL_PROMOTION_TARGET_RESOLVED', {
        details: {
          slug: article.slug,
          article_id: article.id,
          status: article.status,
          content_hash: article.content_hash
        }
      });

      return { ok: true, article };
    } catch (err) {
      await this.storage.updateManualPromotionState((current) => ({
        ...current,
        lastError: err.message
      }));
      return { ok: false, error: err.message };
    }
  }

  async manualSetLocalFile(options = {}) {
    const { filename, bytes, mime, width, height, size, sha256, alt_text, dataUrl } = options;
    if (!bytes || !sha256) return { ok: false, error: 'INVALID_PAYLOAD' };
    const supportedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!supportedMimes.has(mime)) return { ok: false, error: 'UNSUPPORTED_MIME' };
    if (!width || !height || Number(width) <= 0 || Number(height) <= 0) {
      return { ok: false, error: 'INVALID_DIMENSIONS' };
    }
    if (!size || Number(size) <= 0) {
      return { ok: false, error: 'INVALID_SIZE' };
    }

    const blobKey = `manual_promo:${sha256}`;
    try {
      await this.blobStore.put({
        key: blobKey,
        sha256,
        mime,
        width: Number(width),
        height: Number(height),
        size: Number(size),
        bytes,
        provenance: 'MANUAL_LOCAL_FILE'
      });
    } catch (putErr) {
      return { ok: false, error: `BLOB_STORE_FAILED: ${putErr.message}` };
    }

    const candidate = {
      filename: filename || 'local_candidate',
      blob_key: blobKey,
      sha256,
      mime,
      width: Number(width),
      height: Number(height),
      size: Number(size),
      alt_text: alt_text || '',
      data_url: dataUrl || null
    };

    await this.storage.updateManualPromotionState((current) => {
      const next = { ...current };
      next.candidate = candidate;
      if (current.approval && current.approval.candidate_sha256 !== sha256) {
        next.approval = null;
      }
      next.stage = next.approval ? 'APPROVED' : 'CANDIDATE_READY';
      next.uploadedAsset = null;
      next.lastError = null;
      return next;
    });

    await this.audit.info('MANUAL_PROMOTION_FILE_SELECTED', {
      details: { filename: candidate.filename, sha256, mime, width: candidate.width, height: candidate.height, size: candidate.size }
    });

    await this.audit.info('MANUAL_PROMOTION_RESULT_READY', {
      details: { filename: candidate.filename, sha256, mime, width: candidate.width, height: candidate.height, size: candidate.size }
    });

    return { ok: true, candidate };
  }

  async manualSetAltText(options = {}) {
    const cleanAlt = (options?.alt_text || options?.altText || '').trim();
    await this.storage.updateManualPromotionState((current) => {
      const next = { ...current };
      if (next.candidate) {
        next.candidate = { ...next.candidate, alt_text: cleanAlt };
      }
      next.alt_text = cleanAlt;
      // Changing alt text after request creation invalidates existing approval/request
      if (current.approval || current.promotionRequest) {
        const existingAlt = current.approval?.alt_text || current.promotionRequest?.alt_text || current.candidate?.alt_text || '';
        if (existingAlt !== cleanAlt) {
          next.approval = null;
          next.promotionRequest = null;
          next.stage = next.candidate ? 'CANDIDATE_READY' : 'ARTICLE_RESOLVED';
          next.lastError = null;
        }
      }
      return next;
    });
    return { ok: true, alt_text: cleanAlt };
  }

  async manualApprovePromotion({ expectedContentHash = null, alt_text = null } = {}) {
    const state = await this.storage.getManualPromotionState();
    if (!state?.targetArticle) {
      return { ok: false, error: 'TARGET_ARTICLE_REQUIRED' };
    }
    if (!state?.candidate) {
      return { ok: false, error: 'CANDIDATE_REQUIRED' };
    }
    const cleanAlt = (alt_text || state.candidate?.alt_text || state.alt_text || '').trim();
    if (!cleanAlt) {
      return { ok: false, error: 'ALT_TEXT_REQUIRED' };
    }
    if (expectedContentHash && expectedContentHash !== state.targetArticle.content_hash) {
      return { ok: false, error: 'CONTENT_HASH_MISMATCH' };
    }

    let requestRes;
    try {
      requestRes = await this.apiClient.requestPromotionApproval({
        article_slug: state.targetArticle.slug,
        expected_content_hash: state.targetArticle.content_hash,
        candidate_sha256: state.candidate.sha256,
        slot_key: 'featured',
        candidate_width: state.candidate.width,
        candidate_height: state.candidate.height,
        candidate_mime: state.candidate.mime,
        candidate_byte_size: state.candidate.size,
        alt_text: cleanAlt
      });
    } catch (err) {
      await this.storage.updateManualPromotionState((current) => ({
        ...current,
        lastError: `Gagal meminta persetujuan server: ${err.message}`
      }));
      return { ok: false, error: err.message };
    }

    const promotionRequest = requestRes?.promotion_request || (requestRes?.request_id ? requestRes : null);
    if (!promotionRequest || !promotionRequest.request_id) {
      return { ok: false, error: 'PROMOTION_REQUEST_CREATION_FAILED' };
    }

    await this.storage.updateManualPromotionState((current) => ({
      ...current,
      promotionRequest,
      approval: null,
      alt_text: cleanAlt,
      candidate: current.candidate ? { ...current.candidate, alt_text: cleanAlt } : null,
      stage: 'WAITING_FOR_ADMIN_APPROVAL',
      lastError: null
    }));

    await this.audit.info('MANUAL_PROMOTION_REQUESTED', {
      details: {
        request_id: promotionRequest.request_id,
        article_slug: state.targetArticle.slug,
        article_id: state.targetArticle.id,
        candidate_sha256: state.candidate.sha256,
        expected_content_hash: state.targetArticle.content_hash,
        slot_key: 'featured',
        expires_at: promotionRequest.expires_at
      }
    });

    return { ok: true, stage: 'WAITING_FOR_ADMIN_APPROVAL', promotionRequest };
  }

  async checkPromotionApprovalStatus() {
    const state = await this.storage.getManualPromotionState();
    const requestId = state?.promotionRequest?.request_id || state?.approval?.approval_id || state?.promotionRequest?.approval_id;
    if (!requestId) return { ok: false, error: 'NO_ACTIVE_PROMOTION_REQUEST' };

    let res;
    try {
      res = await this.apiClient.getPromotionStatus(requestId);
    } catch (err) {
      return { ok: false, error: err.message };
    }

    const isExpired = res?.record?.status === 'EXPIRED' ||
      (res?.approval_receipt?.expires_at && Date.now() > new Date(res.approval_receipt.expires_at).getTime()) ||
      (res?.record?.expires_at && Date.now() > new Date(res.record.expires_at).getTime());

    if (isExpired) {
      await this.storage.updateManualPromotionState((current) => ({
        ...current,
        stage: 'APPROVAL_EXPIRED',
        lastError: 'Permintaan promosi telah kedaluwarsa'
      }));
      return { ok: false, status: 'EXPIRED', stage: 'APPROVAL_EXPIRED', error: 'APPROVAL_EXPIRED' };
    }

    const isApproved = (res?.record?.status === 'APPROVED' || res?.status === 'APPROVED') && res?.approval_receipt;
    const isRejected = res?.record?.status === 'REJECTED' || res?.status === 'REJECTED';

    if (isApproved) {
      await this.storage.updateManualPromotionState((current) => ({
        ...current,
        approval: res.approval_receipt,
        stage: 'APPROVED',
        lastError: null
      }));
      await this.audit.info('MANUAL_PROMOTION_APPROVAL_CONFIRMED', {
        details: {
          approval_id: res.approval_receipt.approval_id,
          status: 'APPROVED',
          approved_at: res.approval_receipt.approved_at
        }
      });
      return { ok: true, status: 'APPROVED', stage: 'APPROVED', approval: res.approval_receipt };
    } else if (isRejected) {
      await this.storage.updateManualPromotionState((current) => ({
        ...current,
        stage: 'REJECTED',
        lastError: 'Permintaan promosi ditolak oleh admin operator'
      }));
      return { ok: false, status: 'REJECTED', stage: 'REJECTED', error: 'PROMOTION_REJECTED' };
    }

    return { ok: true, status: res?.record?.status || res?.status || 'REQUESTED', stage: 'WAITING_FOR_ADMIN_APPROVAL' };
  }

  async manualExecutePromotion() {
    if (this.manualPromotionExecuting) {
      return { ok: false, error: 'PROMOTION_EXECUTION_ALREADY_IN_FLIGHT' };
    }
    this.manualPromotionExecuting = true;
    try {
      return await this._manualExecutePromotionInternal();
    } finally {
      this.manualPromotionExecuting = false;
    }
  }

  async _manualExecutePromotionInternal() {
    let state = await this.storage.getManualPromotionState();

    const failExecution = async (errorMsg, newStage = null) => {
      await this.storage.updateManualPromotionState((cur) => ({
        ...cur,
        stage: newStage || cur.stage,
        lastError: errorMsg
      }));
      await this.audit.warn('MANUAL_PROMOTION_EXECUTE_FAILED', {
        details: { error: errorMsg, stage: newStage || state?.stage }
      });
      return { ok: false, error: errorMsg, stage: newStage || state?.stage };
    };

    if (!state?.targetArticle) return failExecution('TARGET_ARTICLE_REQUIRED');
    if (!state?.candidate) return failExecution('CANDIDATE_REQUIRED');
    if (state?.stage === 'WAITING_FOR_ADMIN_APPROVAL' || !state?.approval) {
      return failExecution('HUMAN_ADMIN_APPROVAL_REQUIRED');
    }

    // Strict approval invariance
    const { approval, targetArticle, candidate } = state;

    // Check expiry
    const nowMs = Date.now();
    const expiresAtMs = approval.expires_at ? new Date(approval.expires_at).getTime() : 0;
    if (expiresAtMs > 0 && nowMs > expiresAtMs) {
      return failExecution('APPROVAL_EXPIRED', 'APPROVAL_EXPIRED');
    }

    // Check device binding
    const globalState = await this.storage.readState();
    const currentDeviceId = globalState.config?.deviceId || 'dev_local_human_operator_v3';
    if (approval.device_id && approval.device_id !== currentDeviceId) {
      return failExecution(`PROMOTION_DEVICE_MISMATCH: Approval bound to '${approval.device_id}', current device is '${currentDeviceId}'`);
    }

    if (
      approval.article_slug !== targetArticle.slug ||
      approval.article_id !== targetArticle.id ||
      (approval.expected_content_hash || approval.content_hash) !== targetArticle.content_hash ||
      approval.candidate_sha256 !== candidate.sha256 ||
      approval.slot_key !== 'featured'
    ) {
      return failExecution('APPROVAL_INVARIANT_VIOLATION');
    }

    if (approval.alt_text && candidate.alt_text && approval.alt_text.trim() !== candidate.alt_text.trim()) {
      return failExecution(`APPROVAL_ALT_TEXT_MISMATCH: Approval bound to alt '${approval.alt_text}', candidate has '${candidate.alt_text}'`);
    }

    // Stage 1: Content-addressed R2 upload
    if (!state.uploadedAsset?.storage_key) {
      await this.audit.info('MANUAL_R2_UPLOAD_START', {
        details: {
          article_slug: targetArticle.slug,
          candidate_sha256: candidate.sha256
        }
      });

      let candidateBytes = null;
      if (candidate.blob_key) {
        try {
          const blobRecord = await this.blobStore.get(candidate.blob_key);
          if (blobRecord?.bytes) {
            candidateBytes = cloneBytes(blobRecord.bytes);
          }
        } catch (_) {}
      }
      if (!candidateBytes && candidate.data_url) {
        try {
          candidateBytes = cloneBytes(candidate.data_url);
        } catch (_) {}
      }
      if (!candidateBytes) {
        return failExecution('LOCAL_CANDIDATE_BYTES_UNAVAILABLE');
      }

      // Verify SHA integrity of recovered bytes
      try {
        const rawBuf = candidateBytes instanceof ArrayBuffer ? candidateBytes : (candidateBytes.buffer || candidateBytes);
        const digest = await crypto.subtle.digest('SHA-256', rawBuf);
        const recoveredSha = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
        if (recoveredSha.toLowerCase() !== candidate.sha256.toLowerCase()) {
          return failExecution(`LOCAL_CANDIDATE_BYTES_UNAVAILABLE: SHA mismatch (expected ${candidate.sha256}, got ${recoveredSha})`);
        }
      } catch (shaErr) {
        return failExecution(`LOCAL_CANDIDATE_BYTES_UNAVAILABLE: ${shaErr.message}`);
      }

      const ext = candidate.mime === 'image/webp' ? 'webp' : candidate.mime === 'image/png' ? 'png' : 'jpg';
      let uploadRes;
      try {
        uploadRes = await this.apiClient.uploadStandaloneMedia({
          bytes: candidateBytes,
          mime: candidate.mime,
          filename: candidate.filename || `${candidate.sha256}.${ext}`,
          expectedSha256: candidate.sha256,
          humanApproval: approval
        });
      } catch (err) {
        return failExecution(err.message, 'APPROVED');
      }

      await this.audit.info('MANUAL_R2_UPLOAD_CONFIRMED', {
        details: {
          storage_key: uploadRes.storage_key,
          public_url: uploadRes.public_url,
          sha256: uploadRes.sha256
        }
      });

      state = await this.storage.updateManualPromotionState((cur) => ({
        ...cur,
        uploadedAsset: {
          storage_key: uploadRes.storage_key,
          public_url: uploadRes.public_url,
          sha256: uploadRes.sha256,
          upload_id: uploadRes.upload?.upload_id
        },
        stage: 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING',
        lastError: null
      }));
    }

    // Stage 2: Canonical asset registration
    if (!state.uploadedAsset?.asset_id) {
      let registerRes;
      try {
        registerRes = await this.apiClient.registerAsset({
          upload_id: state.uploadedAsset.upload_id || `upl_standalone_${candidate.sha256.substring(0, 16)}`,
          derivative_id: `der_manual_${candidate.sha256.substring(0, 16)}`,
          transform_id: `trf_manual_${candidate.sha256.substring(0, 16)}`,
          r2_key: state.uploadedAsset.storage_key,
          storage_key: state.uploadedAsset.storage_key,
          public_url: state.uploadedAsset.public_url,
          sha256: candidate.sha256,
          width: candidate.width,
          height: candidate.height,
          mime: candidate.mime,
          byte_size: candidate.size,
          file_size: candidate.size,
          upload_state: 'UPLOADED',
          status: 'VALIDATED',
          alt_text: approval.alt_text || candidate.alt_text || ''
        });
      } catch (err) {
        await this.storage.updateManualPromotionState((cur) => ({
          ...cur,
          stage: 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING',
          lastError: err.message
        }));
        return { ok: false, error: err.message, stage: 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING' };
      }

      const assetId = registerRes.asset?.asset_id || registerRes.asset?.id || registerRes.asset_id || registerRes.id;
      if (!assetId) {
        const errMsg = 'INVALID_REGISTER_RESPONSE_NO_ASSET_ID';
        await this.storage.updateManualPromotionState((cur) => ({
          ...cur,
          stage: 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING',
          lastError: errMsg
        }));
        return { ok: false, error: errMsg, stage: 'OBJECT_UPLOADED_ASSET_REGISTRATION_PENDING' };
      }

      await this.audit.info('MANUAL_ASSET_REGISTERED', {
        details: {
          asset_id: assetId,
          storage_key: state.uploadedAsset.storage_key,
          sha256: candidate.sha256
        }
      });

      state = await this.storage.updateManualPromotionState((cur) => ({
        ...cur,
        uploadedAsset: {
          ...cur.uploadedAsset,
          asset_id: assetId
        },
        stage: 'ASSET_REGISTERED_ATTACHMENT_PENDING',
        lastError: null
      }));
    }

    // Stage 3: Canonical featured attachment
    await this.audit.info('MANUAL_FEATURED_ATTACH_START', {
      details: {
        article_id: targetArticle.id,
        asset_id: state.uploadedAsset.asset_id,
        slot_key: 'featured'
      }
    });

    let attachRes;
    try {
      attachRes = await this.apiClient.attachArticleMedia({
        article_id: targetArticle.id,
        asset_id: state.uploadedAsset.asset_id,
        role: 'featured',
        slot_key: 'featured',
        alt_text: approval.alt_text || candidate.alt_text || '',
        replace_active: true
      });
    } catch (err) {
      await this.storage.updateManualPromotionState((cur) => ({
        ...cur,
        stage: 'ASSET_REGISTERED_ATTACHMENT_PENDING',
        lastError: err.message
      }));
      return { ok: false, error: err.message, stage: 'ASSET_REGISTERED_ATTACHMENT_PENDING' };
    }

    await this.audit.info('MANUAL_FEATURED_ATTACH_CONFIRMED', {
      details: {
        article_id: targetArticle.id,
        asset_id: state.uploadedAsset.asset_id,
        slot_key: 'featured',
        relation: attachRes.relation
      }
    });

    await this.audit.info('MANUAL_PROMOTION_COMPLETE', {
      details: {
        article_id: targetArticle.id,
        slug: targetArticle.slug,
        asset_id: state.uploadedAsset.asset_id,
        storage_key: state.uploadedAsset.storage_key,
        sha256: candidate.sha256
      }
    });

    state = await this.storage.updateManualPromotionState((cur) => ({
      ...cur,
      stage: 'COMPLETE',
      targetArticle: {
        ...cur.targetArticle,
        featured_image: cur.uploadedAsset.public_url,
        image_alt: candidate.alt_text || cur.targetArticle.image_alt
      },
      lastError: null
    }));

    return {
      ok: true,
      status: 'COMPLETE',
      uploadedAsset: state.uploadedAsset,
      targetArticle: state.targetArticle
    };
  }

  async manualResetPromotion() {
    await this.storage.clearManualPromotionState();
    return { ok: true };
  }
}
