import { BackpressureController } from './backpressure.js';
import { ProviderLane } from './provider-adapter.js';
import { MockProviderAdapter } from './mock-provider.js';
import { ReconciliationManager } from './reconciliation-manager.js';
import { UploadWorkerPool } from './upload-worker-pool.js';
import { HeartbeatManager } from './heartbeat-manager.js';
import { LOKAMEDIA_PROTOCOL_VERSION } from './constants.js';

export class LokaMediaController {
  constructor({ apiClient, storage, blobStore, provider = new MockProviderAdapter(), logger = console }) {
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

  async runJob(job) {
    const acquired = await this.providerLane.acquire(job.job_id);
    if (!acquired) return { acquired: false, reason: 'PROVIDER_BUSY' };
    try {
      await this.storage.upsertJob(job.job_id, { ...job, local_state: 'GENERATING' });
      await this.heartbeat.beat(job);
      const providerResult = await this.provider.generate(job);
      await this.storage.upsertJob(job.job_id, {
        local_state: 'IMAGE_DETECTED',
        provider_conversation_id: providerResult.provider_conversation_id,
        provider_response_id: providerResult.provider_response_id,
        submitted_at: providerResult.submitted_at
      });
      const captured = await this.provider.capture(job);
      await this.blobStore.put({
        key: captured.blobKey,
        job_id: job.job_id,
        sha256: captured.sha256,
        mime: captured.mime,
        width: captured.width,
        height: captured.height,
        size: captured.size,
        bytes: captured.bytes
      });
      await this.storage.upsertJob(job.job_id, {
        local_state: 'CAPTURED',
        blob_key: captured.blobKey,
        sha256: captured.sha256,
        mime: captured.mime,
        width: captured.width,
        height: captured.height
      });
      await this.providerLane.release(job.job_id);
      await this.storage.enqueueUpload(job.job_id);
      await this.uploads.drain();
      return { acquired: true, job_id: job.job_id };
    } catch (error) {
      await this.storage.upsertJob(job.job_id, {
        local_state: error.status === 401 ? 'AUTH_REQUIRED' : 'RECOVERING',
        last_error: error.message
      });
      throw error;
    } finally {
      await this.providerLane.release(job.job_id);
    }
  }
}
