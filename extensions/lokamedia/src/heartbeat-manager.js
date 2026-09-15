import { HEARTBEAT_INTERVAL_MS } from './constants.js';

export class HeartbeatManager {
  constructor({ apiClient, storage, intervalMs = HEARTBEAT_INTERVAL_MS, clock = Date }) {
    this.apiClient = apiClient;
    this.storage = storage;
    this.intervalMs = intervalMs;
    this.clock = clock;
    this.timers = new Map();
  }

  async beat(job) {
    const response = await this.apiClient.heartbeat(job.job_id, {
      lease_owner: job.lease_owner,
      job_revision: job.job_revision
    });
    if (response.error === 'LEASE_NOT_OWNER' || response.recommended_action === 'STOP') {
      await this.storage.upsertJob(job.job_id, { status: response.status ?? 'RECOVERING', lease_lost: true });
      return { ok: false, leaseLost: true, response };
    }
    await this.storage.upsertJob(job.job_id, {
      heartbeat_at: new this.clock().toISOString(),
      job_revision: response.job_revision ?? job.job_revision
    });
    return { ok: true, response };
  }

  start(job) {
    this.stop(job.job_id);
    this.timers.set(job.job_id, setInterval(() => void this.beat(job), this.intervalMs));
  }

  stop(jobId) {
    const timer = this.timers.get(jobId);
    if (timer) clearInterval(timer);
    this.timers.delete(jobId);
  }

  stopAll() {
    for (const jobId of this.timers.keys()) this.stop(jobId);
  }
}
