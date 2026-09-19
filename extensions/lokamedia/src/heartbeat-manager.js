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
    const expectedRevision = job.job_revision ?? job.expected_job_revision;
    const response = await this.apiClient.heartbeat(job.job_id, {
      lease_owner: job.lease_owner,
      expected_job_revision: expectedRevision
    });
    if (response.error === 'LEASE_NOT_OWNER' || response.recommended_action === 'STOP') {
      await this.storage.upsertJob(job.job_id, { status: response.status ?? 'RECOVERING', lease_lost: true });
      return { ok: false, leaseLost: true, response };
    }
    const updatedRevision = response.job_revision ?? expectedRevision;
    job.job_revision = updatedRevision;
    if (response.lease_expires_at) job.lease_expires_at = response.lease_expires_at;
    if (response.heartbeat_at) job.heartbeat_at = response.heartbeat_at;
    await this.storage.upsertJob(job.job_id, {
      heartbeat_at: response.heartbeat_at || new this.clock().toISOString(),
      job_revision: updatedRevision
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
