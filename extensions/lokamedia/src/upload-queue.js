/**
 * RancangLoka — Durable Article Derivative Upload Queue & Scheduler
 * Phase 5E1: Durable Article Derivative Upload Queue Foundation
 *
 * Core Guarantees:
 * 1. Queue Item Schema: Lightweight durable state pointing to media-derivatives.
 *    UPLOAD_QUEUE_DUPLICATES_BINARY = NO.
 * 2. Deterministic Upload Identity:
 *    upl_<sha256(derivative_id:derivative_sha256:target_version)>.
 * 3. Enqueue Idempotency: Re-enqueuing identical derivative returns existing item.
 * 4. Strict Role Guard: Only PUBLIC_DERIVATIVE_CANDIDATE allowed. ORIGINAL rejected.
 * 5. Bounded Concurrency: UPLOAD_CONCURRENCY = 2 (serial generate/capture preserved).
 * 6. Explicit State Machine: QUEUED -> UPLOADING -> UPLOADED / RETRY_WAIT / NEEDS_ATTENTION.
 * 7. Durable Lease/Claim Model: Prevents multiple concurrent uploads of same item.
 * 8. Independent Local Integrity Verification: Corrupt derivatives fail closed before transfer.
 * 9. Safe Restart Recovery: Reconciles post-R2 / pre-receipt states against server receipt.
 * 10. Multi-upload Fairness: FIFO ordering prevents starvation.
 * 11. Bounded Exponential Backoff: Transitions to NEEDS_ATTENTION after 5 attempts.
 */

import { computeSha256 } from './watermark-engine.js';
import { validateDerivativeRecordIntegrity } from './derivative-pipeline.js';

export const UPLOAD_CONCURRENCY = 2;
export const MAX_PENDING_UPLOADS = 8;
export const MAX_PENDING_UPLOAD_BYTES = 40 * 1024 * 1024; // 40 MiB
export const MAX_UPLOAD_ATTEMPTS = 5;
export const UPLOAD_TARGET_VERSION = 'v1';
export const ROLE_PUBLIC_DERIVATIVE_CANDIDATE = 'PUBLIC_DERIVATIVE_CANDIDATE';

export const UPLOAD_STATES = Object.freeze({
  QUEUED: 'QUEUED',
  UPLOADING: 'UPLOADING',
  UPLOADED: 'UPLOADED',
  RETRY_WAIT: 'RETRY_WAIT',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION'
});

export const UPLOAD_STATE_MACHINE = 'QUEUED | UPLOADING | UPLOADED | RETRY_WAIT | NEEDS_ATTENTION';

export class UploadQueueError extends Error {
  constructor(message, code = 'UPLOAD_QUEUE_ERROR', cause = null) {
    super(message);
    this.name = 'UploadQueueError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/**
 * Computes deterministic logical upload identity.
 */
export async function computeUploadId(derivativeId, derivativeSha256) {
  if (!derivativeId || !derivativeSha256) {
    throw new UploadQueueError(
      'derivativeId and derivativeSha256 are required to compute uploadId',
      'INVALID_UPLOAD_ID_INPUT'
    );
  }
  const digest = await computeSha256(`${derivativeId}:${derivativeSha256}:${UPLOAD_TARGET_VERSION}`);
  return `upl_${digest}`;
}

/**
 * Calculates exponential backoff delay (base 1s, factor 2, max 30s).
 */
export function calculateUploadRetryDelay(attemptCount) {
  const base = 1000;
  const max = 30000;
  const factor = Math.min(Math.max(1, attemptCount), 5);
  return Math.min(max, base * Math.pow(2, factor - 1));
}

/**
 * Validates server upload receipt against queue item contract.
 */
export function validateUploadReceipt(receipt, item) {
  if (!receipt || typeof receipt !== 'object') {
    throw new UploadQueueError('Server returned null or non-object upload receipt', 'INVALID_RECEIPT_STRUCTURE');
  }

  if (!receipt.r2_key || typeof receipt.r2_key !== 'string') {
    throw new UploadQueueError('Server receipt missing r2_key', 'RECEIPT_MISSING_R2_KEY');
  }

  if (!receipt.r2_key.includes('media/articles/derivatives')) {
    throw new UploadQueueError(
      `Server receipt r2_key '${receipt.r2_key}' outside canonical derivative namespace`,
      'RECEIPT_INVALID_R2_NAMESPACE'
    );
  }

  if (receipt.sha256?.toLowerCase() !== item.derivative_sha256?.toLowerCase()) {
    throw new UploadQueueError(
      `Receipt SHA-256 mismatch: expected ${item.derivative_sha256}, got ${receipt.sha256}`,
      'RECEIPT_SHA256_MISMATCH'
    );
  }

  if (item.byte_size !== undefined && receipt.byte_size !== item.byte_size) {
    throw new UploadQueueError(
      `Receipt byte size mismatch: expected ${item.byte_size}, got ${receipt.byte_size}`,
      'RECEIPT_SIZE_MISMATCH'
    );
  }

  if (item.mime && receipt.mime && receipt.mime.toLowerCase() !== item.mime.toLowerCase()) {
    throw new UploadQueueError(
      `Receipt MIME mismatch: expected ${item.mime}, got ${receipt.mime}`,
      'RECEIPT_MIME_MISMATCH'
    );
  }

  return true;
}

/**
 * Durable Local Upload Queue
 */
export class UploadQueue {
  constructor({ uploadStore, derivativeStore }) {
    if (!uploadStore) {
      throw new UploadQueueError('uploadStore is required', 'MISSING_UPLOAD_STORE');
    }
    this.uploadStore = uploadStore;
    this.derivativeStore = derivativeStore || null;
  }

  /**
   * Enqueues a derivative into the durable upload queue.
   * Enforces role guard, idempotency, and backpressure.
   */
  async enqueue({ derivative, jobId, slotKey = 'featured' }) {
    if (!derivative || typeof derivative !== 'object') {
      throw new UploadQueueError('derivative object is required for enqueue', 'INVALID_DERIVATIVE_INPUT');
    }

    // 1. Source Role Guard: Only PUBLIC_DERIVATIVE_CANDIDATE is accepted
    const sourceRole = derivative.role || 'UNKNOWN';
    if (sourceRole !== ROLE_PUBLIC_DERIVATIVE_CANDIDATE) {
      throw new UploadQueueError(
        `UPLOAD_SOURCE_ROLE_GUARD_BLOCKED: Queue accepts only '${ROLE_PUBLIC_DERIVATIVE_CANDIDATE}' as source. Received: '${sourceRole}'. Original captured blob cannot be uploaded here.`,
        'UPLOAD_SOURCE_ROLE_GUARD_BLOCKED'
      );
    }

    // 2. Validate required metadata
    const derivativeId = derivative.derivative_id;
    const derivativeSha256 = derivative.sha256;
    const transformId = derivative.transform_id;

    if (!derivativeId || !derivativeSha256 || !transformId) {
      throw new UploadQueueError(
        'derivative_id, transform_id, and sha256 are required to enqueue',
        'MISSING_REQUIRED_DERIVATIVE_FIELDS'
      );
    }

    // 3. Compute deterministic upload ID
    const uploadId = await computeUploadId(derivativeId, derivativeSha256);

    // 4. Check queue enqueue idempotency
    const existingById = await this.uploadStore.getUpload(uploadId);
    const existingByDeriv = existingById || (await this.uploadStore.getUploadByDerivativeId(derivativeId));

    if (existingByDeriv) {
      return {
        uploadItem: existingByDeriv,
        reused: true,
        message: 'Duplicate enqueue reused existing queue work item.'
      };
    }

    // 5. Backpressure Check
    const allItems = await this.uploadStore.listUploads();
    const pendingItems = allItems.filter((it) => it.state !== UPLOAD_STATES.UPLOADED);
    const pendingCount = pendingItems.length;
    const pendingBytes = pendingItems.reduce((sum, it) => sum + (it.byte_size ?? 0), 0);

    if (pendingCount >= MAX_PENDING_UPLOADS) {
      throw new UploadQueueError(
        `Upload queue backpressure limit exceeded: max pending items (${MAX_PENDING_UPLOADS}) reached`,
        'UPLOAD_QUEUE_BACKPRESSURE_LIMIT_EXCEEDED'
      );
    }

    const itemByteSize = derivative.byte_size ?? derivative.size ?? 0;
    if (pendingBytes + itemByteSize > MAX_PENDING_UPLOAD_BYTES) {
      throw new UploadQueueError(
        `Upload queue backpressure limit exceeded: max pending bytes (${MAX_PENDING_UPLOAD_BYTES}) would be exceeded`,
        'UPLOAD_QUEUE_BACKPRESSURE_LIMIT_EXCEEDED'
      );
    }

    // 6. Create durable queue work item (NO binary bytes stored in queue item)
    const nowIso = new Date().toISOString();
    const newItem = {
      upload_id: uploadId,
      derivative_id: derivativeId,
      transform_id: transformId,
      job_id: jobId || derivative.job_id || '',
      slot_key: slotKey || derivative.slot_key || 'featured',
      role: sourceRole,
      derivative_sha256: derivativeSha256,
      mime: derivative.mime || 'image/png',
      width: derivative.width,
      height: derivative.height,
      byte_size: itemByteSize,
      state: UPLOAD_STATES.QUEUED,
      attempt_count: 0,
      next_attempt_at: null,
      claim_id: null,
      claimed_at: null,
      claim_expires_at: null,
      created_at: nowIso,
      updated_at: nowIso,
      receipt: null,
      last_error: null
    };

    await this.uploadStore.putUpload(newItem);

    return {
      uploadItem: newItem,
      reused: false
    };
  }

  /**
   * Claims next eligible work item using FIFO fairness and lease locks.
   */
  async claimNext({ workerId = crypto.randomUUID(), now = Date.now(), claimDurationMs = 60000 } = {}) {
    const allItems = await this.uploadStore.listUploads();

    // Filter candidate items eligible for upload
    const candidates = allItems.filter((item) => {
      if (item.state === UPLOAD_STATES.QUEUED) return true;
      if (item.state === UPLOAD_STATES.RETRY_WAIT) {
        if (!item.next_attempt_at) return true;
        return new Date(item.next_attempt_at).getTime() <= now;
      }
      // Stale claim recovery
      if (item.state === UPLOAD_STATES.UPLOADING) {
        if (item.claim_expires_at && new Date(item.claim_expires_at).getTime() <= now) {
          return true;
        }
      }
      return false;
    });

    if (candidates.length === 0) return null;

    // FIFO fairness: oldest created_at first
    candidates.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const selected = candidates[0];

    const claimed = {
      ...selected,
      state: UPLOAD_STATES.UPLOADING,
      claim_id: workerId,
      claimed_at: new Date(now).toISOString(),
      claim_expires_at: new Date(now + claimDurationMs).toISOString(),
      updated_at: new Date(now).toISOString()
    };

    await this.uploadStore.putUpload(claimed);
    return claimed;
  }

  /**
   * Marks a claimed work item as successfully uploaded with verified receipt.
   */
  async markUploaded(uploadId, receipt) {
    const item = await this.uploadStore.getUpload(uploadId);
    if (!item) {
      throw new UploadQueueError(`Queue item '${uploadId}' not found`, 'ITEM_NOT_FOUND');
    }

    validateUploadReceipt(receipt, item);

    const updated = {
      ...item,
      state: UPLOAD_STATES.UPLOADED,
      receipt,
      claim_id: null,
      claim_expires_at: null,
      last_error: null,
      updated_at: new Date().toISOString()
    };

    await this.uploadStore.putUpload(updated);
    return updated;
  }

  /**
   * Marks a claimed work item as failed and calculates retry/backoff or terminal state.
   */
  async markFailed(uploadId, error) {
    const item = await this.uploadStore.getUpload(uploadId);
    if (!item) {
      throw new UploadQueueError(`Queue item '${uploadId}' not found`, 'ITEM_NOT_FOUND');
    }

    const nextAttempt = (item.attempt_count ?? 0) + 1;
    const isFatalCorruption = error?.code === 'CORRUPT_LOCAL_DERIVATIVE_BLOCKS_UPLOAD';
    const isExhausted = nextAttempt >= MAX_UPLOAD_ATTEMPTS || isFatalCorruption;

    let nextState;
    let nextAttemptAt = null;

    if (isExhausted) {
      nextState = UPLOAD_STATES.NEEDS_ATTENTION;
    } else {
      nextState = UPLOAD_STATES.RETRY_WAIT;
      const delay = calculateUploadRetryDelay(nextAttempt);
      nextAttemptAt = new Date(Date.now() + delay).toISOString();
    }

    const updated = {
      ...item,
      state: nextState,
      attempt_count: nextAttempt,
      next_attempt_at: nextAttemptAt,
      claim_id: null,
      claim_expires_at: null,
      last_error: error?.message || String(error),
      updated_at: new Date().toISOString()
    };

    await this.uploadStore.putUpload(updated);
    return updated;
  }

  /**
   * Releases an active claim without changing state (or reverting to QUEUED).
   */
  async releaseClaim(uploadId) {
    const item = await this.uploadStore.getUpload(uploadId);
    if (!item) return;

    const updated = {
      ...item,
      state: item.state === UPLOAD_STATES.UPLOADING ? UPLOAD_STATES.QUEUED : item.state,
      claim_id: null,
      claim_expires_at: null,
      updated_at: new Date().toISOString()
    };

    await this.uploadStore.putUpload(updated);
    return updated;
  }
}

/**
 * Upload Scheduler with Concurrency Control & Recovery Handlers
 */
export class UploadScheduler {
  constructor({ queue, derivativeStore, apiClient, concurrency = UPLOAD_CONCURRENCY }) {
    if (!queue) throw new UploadQueueError('queue is required', 'MISSING_QUEUE');
    if (!derivativeStore) throw new UploadQueueError('derivativeStore is required', 'MISSING_DERIVATIVE_STORE');
    if (!apiClient) throw new UploadQueueError('apiClient is required', 'MISSING_API_CLIENT');

    this.queue = queue;
    this.derivativeStore = derivativeStore;
    this.apiClient = apiClient;
    this.concurrency = concurrency;
    this.activeWorkers = new Set();
  }

  /**
   * Executes complete upload lifecycle for a single claimed queue item.
   * Step ordering:
   * 1. Read derivative from derivativeStore
   * 2. Verify local derivative integrity (corrupt fails closed)
   * 3. Reconcile / check if already uploaded to R2 (restart recovery)
   * 4. Binary transfer via ApiClient
   * 5. Server receipt verification
   * 6. Mark durable local state UPLOADED
   */
  async processItem(item, workerId = crypto.randomUUID()) {
    try {
      // 1. Read derivative from local store
      const derivative = await this.derivativeStore.getDerivative(item.derivative_id);
      if (!derivative || !derivative.bytes) {
        throw new UploadQueueError(
          `Local derivative '${item.derivative_id}' missing or has no binary bytes`,
          'LOCAL_DERIVATIVE_MISSING'
        );
      }

      // 2. Local derivative binary integrity verification
      const integrity = await validateDerivativeRecordIntegrity(derivative);
      if (!integrity.valid) {
        // Corrupt derivative fails closed!
        throw new UploadQueueError(
          `CORRUPT_LOCAL_DERIVATIVE_BLOCKS_UPLOAD: ${integrity.reason}`,
          'CORRUPT_LOCAL_DERIVATIVE_BLOCKS_UPLOAD'
        );
      }

      // 3. Restart recovery check: if R2 object already exists, reuse it without re-upload
      if (typeof this.apiClient.getDerivativeUploadReceipt === 'function') {
        try {
          const priorReceipt = await this.apiClient.getDerivativeUploadReceipt(
            item.derivative_sha256,
            item.derivative_id,
            item.transform_id,
            derivative.mime === 'image/webp' ? 'webp' : 'png'
          );
          if (priorReceipt) {
            validateUploadReceipt(priorReceipt, item);
            await this.queue.markUploaded(item.upload_id, priorReceipt);
            return {
              status: 'reused_existing_r2',
              receipt: priorReceipt
            };
          }
        } catch (_) {
          // If query fails, continue to normal upload attempt
        }
      }

      // 4. Binary transfer
      const uploadResponse = await this.apiClient.uploadDerivative({
        derivativeId: item.derivative_id,
        transformId: item.transform_id,
        jobId: item.job_id,
        slotKey: item.slot_key,
        role: item.role,
        bytes: derivative.bytes,
        mime: derivative.mime,
        width: derivative.width,
        height: derivative.height,
        sha256: item.derivative_sha256
      });

      const receipt = uploadResponse.receipt || uploadResponse;

      // 5. Server receipt verification
      validateUploadReceipt(receipt, item);

      // 6. Durable local UPLOADED mark
      await this.queue.markUploaded(item.upload_id, receipt);

      return {
        status: 'uploaded',
        receipt
      };
    } catch (err) {
      // Transfer or R2 failure preserves local derivative, marks retry in queue
      await this.queue.markFailed(item.upload_id, err);
      throw err;
    }
  }

  /**
   * Executes a batch of uploads respecting the concurrency limit.
   */
  async runBatch({ maxItems = Infinity } = {}) {
    let processedCount = 0;
    const results = [];

    while (processedCount < maxItems) {
      // Collect up to concurrency items
      const claimsToMake = Math.min(this.concurrency - this.activeWorkers.size, maxItems - processedCount);
      if (claimsToMake <= 0) break;

      const claims = [];
      for (let i = 0; i < claimsToMake; i++) {
        const workerId = `w_${crypto.randomUUID().slice(0, 8)}`;
        const claim = await this.queue.claimNext({ workerId });
        if (!claim) break;
        claims.push({ claim, workerId });
      }

      if (claims.length === 0) break;

      const batchPromises = claims.map(({ claim, workerId }) => {
        this.activeWorkers.add(workerId);
        return this.processItem(claim, workerId)
          .then((res) => ({ ok: true, upload_id: claim.upload_id, result: res }))
          .catch((err) => ({ ok: false, upload_id: claim.upload_id, error: err }))
          .finally(() => {
            this.activeWorkers.delete(workerId);
          });
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      processedCount += batchResults.length;
    }

    return {
      processedCount,
      results
    };
  }
}
