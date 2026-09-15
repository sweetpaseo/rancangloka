import { STOP_ACTIONS, TERMINAL_STATUSES } from './constants.js';

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
