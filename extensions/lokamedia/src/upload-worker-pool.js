import { UPLOAD_CONCURRENCY } from './constants.js';

export class UploadWorkerPool {
  constructor({ apiClient, storage, blobStore, concurrency = UPLOAD_CONCURRENCY }) {
    this.apiClient = apiClient;
    this.storage = storage;
    this.blobStore = blobStore;
    this.concurrency = concurrency;
    this.active = 0;
    this.maxObservedConcurrency = 0;
  }

  async uploadJob(job) {
    const blob = await this.blobStore.get(job.blob_key);
    if (!blob) {
      await this.storage.upsertJob(job.job_id, { local_state: 'BLOB_MISSING', status: 'RECOVERING' });
      return { ok: false, error: 'BLOB_MISSING' };
    }
    this.active++;
    this.maxObservedConcurrency = Math.max(this.maxObservedConcurrency, this.active);
    try {
      await this.storage.upsertJob(job.job_id, { local_state: 'UPLOADING' });
      const response = await this.apiClient.uploadBlob(job, blob, {
        onProgress: (progress) => {
          void this.storage.upsertJob(job.job_id, {
            upload_progress: {
              bytes_sent: progress.bytesSent,
              bytes_total: progress.bytesTotal,
              percentage: progress.bytesTotal ? Math.round((progress.bytesSent / progress.bytesTotal) * 100) : 0
            }
          });
        }
      });
      await this.storage.upsertJob(job.job_id, {
        status: response.status ?? 'COMPLETE',
        local_state: response.attachment_confirmed === false ? 'UPLOAD_RECEIVED' : 'COMPLETE',
        latest_receipt: response.receipt ?? response.latest_receipt ?? null,
        attachment_confirmed: response.attachment_confirmed !== false,
        asset_id: response.asset_id ?? null
      });
      if (response.attachment_confirmed !== false) await this.blobStore.delete(job.blob_key);
      await this.storage.dequeueUpload(job.job_id);
      return { ok: true, response };
    } finally {
      this.active--;
    }
  }

  async drain() {
    const state = await this.storage.readState();
    const jobs = state.uploadQueue.map((jobId) => state.jobs[jobId]).filter(Boolean);
    const results = [];
    for (let index = 0; index < jobs.length; index += this.concurrency) {
      const batch = jobs.slice(index, index + this.concurrency);
      results.push(...await Promise.all(batch.map((job) => this.uploadJob(job))));
    }
    return results;
  }
}
