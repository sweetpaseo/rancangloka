import { LOKAMEDIA_PROTOCOL_VERSION } from './constants.js';

function normalizeBaseUrl(url) {
  return String(url ?? '').replace(/\/+$/, '');
}

export class ApiClient {
  constructor({ baseUrl, deviceToken, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.deviceToken = deviceToken;
    this.fetchImpl = fetchImpl === globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetchImpl;
  }

  headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'X-LokaMedia-Protocol': String(LOKAMEDIA_PROTOCOL_VERSION),
      ...(this.deviceToken ? { Authorization: `Bearer ${this.deviceToken}` } : {}),
      ...extra
    };
  }

  async request(path, options = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error ?? `HTTP_${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  nextJob(deviceId) {
    return this.request('/api/internal/v1/media/jobs/next', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ protocol_version: LOKAMEDIA_PROTOCOL_VERSION, device_id: deviceId })
    });
  }

  listJobs({ status = 'all', limit = 20 } = {}) {
    return this.request(`/api/internal/v1/media/jobs?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`, {
      method: 'GET',
      headers: this.headers()
    });
  }

  heartbeat(jobId, body) {
    return this.request(`/api/internal/v1/media/jobs/${encodeURIComponent(jobId)}/heartbeat`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ protocol_version: LOKAMEDIA_PROTOCOL_VERSION, ...body })
    });
  }

  reconcile(jobId, idempotencyKey) {
    const query = idempotencyKey ? `?idempotency_key=${encodeURIComponent(idempotencyKey)}` : '';
    return this.request(`/api/internal/v1/media/jobs/${encodeURIComponent(jobId)}/reconcile${query}`, {
      method: 'GET',
      headers: this.headers()
    });
  }

  event(jobId, event) {
    return this.request(`/api/internal/v1/media/jobs/${encodeURIComponent(jobId)}/events`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ protocol_version: LOKAMEDIA_PROTOCOL_VERSION, ...event })
    });
  }

  releaseJob(jobId, { expectedJobRevision, intent = 'SAFE_REQUEUE', reasonCode = 'CLIENT_RELEASE', messageSafe = '' } = {}) {
    return this.request(`/api/internal/v1/media/jobs/${encodeURIComponent(jobId)}/release`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        protocol_version: LOKAMEDIA_PROTOCOL_VERSION,
        expected_job_revision: expectedJobRevision,
        intent,
        reason_code: reasonCode,
        message_safe: messageSafe
      })
    });
  }

  async uploadBlob(job, blobRecord, { onProgress } = {}) {
    const total = blobRecord.size ?? blobRecord.bytes?.byteLength ?? 0;
    onProgress?.({ bytesSent: 0, bytesTotal: total });
    const form = new FormData();
    form.set('protocol_version', String(LOKAMEDIA_PROTOCOL_VERSION));
    form.set('source_type', 'lokamedia_extension');
    form.set('job_id', job.job_id);
    form.set('expected_job_revision', String(job.job_revision));
    form.set('article_id', job.article_id);
    form.set('slot_key', job.slot_key);
    form.set('role', job.role);
    form.set('sequence', String(job.sequence ?? 0));
    form.set('prompt_version', String(job.prompt_version));
    form.set('prompt_hash', job.prompt_hash);
    form.set('idempotency_key', job.idempotency_key);
    form.set('client_sha256', blobRecord.sha256);
    form.set('alt_text', job.alt_text ?? '');
    form.set('file', new Blob([blobRecord.bytes], { type: blobRecord.mime }), 'lokamedia.png');

    const response = await this.fetchImpl(`${this.baseUrl}/api/internal/v1/media/upload`, {
      method: 'POST',
      headers: this.deviceToken ? { Authorization: `Bearer ${this.deviceToken}` } : {},
      body: form
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error ?? `HTTP_${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    onProgress?.({ bytesSent: total, bytesTotal: total });
    return payload;
  }
}
