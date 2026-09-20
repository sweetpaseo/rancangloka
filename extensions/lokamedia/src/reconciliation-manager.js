import { STOP_ACTIONS, TERMINAL_STATUSES } from './constants.js';
import { isRecoverableResultCheckpoint } from './providers/chatgpt/correlation.js';

export function hasValidRecoveryLease(job, deviceId = null, { now = new Date() } = {}) {
  if (!job || typeof job !== 'object') return false;
  if (job.status && job.status !== 'LEASED' && job.status !== 'PROCESSING') return false;
  if (!job.lease_owner || typeof job.lease_owner !== 'string' || job.lease_owner.trim().length === 0) return false;
  if (deviceId && typeof deviceId === 'string' && deviceId.trim().length > 0 && job.lease_owner !== deviceId) return false;
  if (typeof job.job_revision !== 'number' || job.job_revision < 1) return false;
  if (!job.lease_expires_at) return false;
  const expiryMs = Date.parse(job.lease_expires_at);
  if (isNaN(expiryMs) || expiryMs <= now.getTime()) return false;
  return true;
}

function makeReconcileResult(localState, { needsAttention = false, inconsistencyReason = null, preservedDurableStage = false, resultCheckpoint = null } = {}) {
  return {
    local_state: localState,
    needs_attention: needsAttention,
    inconsistency_reason: inconsistencyReason,
    preserved_durable_stage: preservedDurableStage,
    result_checkpoint: resultCheckpoint,
    toString() {
      return this.local_state;
    }
  };
}

export function reconcileJobState(localJob = {}, serverJob = {}) {
  const serverStatus = serverJob.status || localJob.status || 'QUEUED';
  const currentLocalState = localJob.local_state ?? serverStatus;

  // Terminal server states always take precedence
  if (serverStatus === 'COMPLETE' || localJob.attachment_confirmed) {
    return makeReconcileResult('COMPLETE');
  }
  if (serverStatus === 'CANCELLED' || serverStatus === 'SUPERSEDED' || serverStatus === 'FAILED_TERMINAL') {
    return makeReconcileResult('STOPPED');
  }

  // Durable CAPTURED guard:
  // If local state claims CAPTURED or has a blob_key, verify internal consistency
  if (currentLocalState === 'CAPTURED' || Boolean(localJob.blob_key)) {
    const hasValidBlobKey = typeof localJob.blob_key === 'string' && localJob.blob_key.trim().length > 0;
    const hasValidMime = typeof localJob.mime === 'string' && ['image/png', 'image/webp', 'image/jpeg'].includes(localJob.mime);
    const hasValidDimensions = typeof localJob.width === 'number' && localJob.width > 0 && typeof localJob.height === 'number' && localJob.height > 0;
    const hasConsistentEvidence = hasValidBlobKey && hasValidMime && hasValidDimensions;
    if (hasConsistentEvidence) {
      return makeReconcileResult('CAPTURED', { preservedDurableStage: true });
    }
    // Invalid/inconsistent captured evidence fails closed into RECOVERING
    return makeReconcileResult('RECOVERING', { needsAttention: true, inconsistencyReason: 'INVALID_CAPTURED_EVIDENCE' });
  }

  // Preserved GENERATED / IMAGE_DETECTED checkpoint guard:
  if (
    (currentLocalState === 'IMAGE_DETECTED' || currentLocalState === 'GENERATING' || currentLocalState === 'GENERATED') &&
    localJob.result_checkpoint &&
    isRecoverableResultCheckpoint(localJob.result_checkpoint, localJob)
  ) {
    return makeReconcileResult(currentLocalState, { preservedDurableStage: true, resultCheckpoint: localJob.result_checkpoint });
  }

  // Active in-flight processing states when server is still leased/active:
  const activeQueueStates = new Set(['LEASED', 'GENERATING', 'IMAGE_DETECTED', 'CAPTURING', 'CAPTURED', 'UPLOADING', 'RECOVERING']);
  const waitingQueueStates = new Set(['QUEUED', 'WAITING_RETRY']);
  if (activeQueueStates.has(currentLocalState) && !waitingQueueStates.has(serverStatus)) {
    return makeReconcileResult(currentLocalState);
  }

  // Otherwise follow server state (e.g. QUEUED, WAITING_RETRY, LEASED, etc.)
  return makeReconcileResult(serverStatus);
}

export class ReconciliationManager {
  constructor({ apiClient, storage, blobStore }) {
    this.apiClient = apiClient;
    this.storage = storage;
    this.blobStore = blobStore;
  }

  async reconcileJob(localJob) {
    const receipt = await this.apiClient.reconcile(localJob.job_id, localJob.idempotency_key);
    const patch = {
      status: receipt.status,
      job_revision: receipt.job_revision ?? localJob.job_revision,
      last_recommended_action: receipt.recommended_action,
      latest_receipt: receipt.latest_receipt ?? null,
      attachment_confirmed: Boolean(receipt.attachment_confirmed),
      asset_id: receipt.asset_id ?? localJob.asset_id ?? null
    };
    if (receipt.attachment_confirmed || TERMINAL_STATUSES.has(receipt.status) || STOP_ACTIONS.has(receipt.recommended_action)) {
      patch.local_state = receipt.attachment_confirmed ? 'COMPLETE' : 'STOPPED';
      if (receipt.attachment_confirmed) {
        if (localJob.blob_key) await this.blobStore.delete(localJob.blob_key);
        await this.storage.dequeueUpload(localJob.job_id);
      }
    } else if (localJob.local_state === 'CAPTURED' || localJob.local_state === 'UPLOADING') {
      const blob = await this.blobStore.get(localJob.blob_key);
      patch.local_state = blob ? 'UPLOAD_QUEUED' : 'BLOB_MISSING';
    }
    await this.storage.upsertJob(localJob.job_id, patch);
    return { ...localJob, ...patch };
  }

  async startup() {
    const jobs = await this.storage.listJobs();
    const reconciled = [];
    for (const job of jobs.filter((item) => !TERMINAL_STATUSES.has(item.status) || item.local_state !== 'COMPLETE')) {
      reconciled.push(await this.reconcileJob(job));
    }
    return reconciled;
  }
}
