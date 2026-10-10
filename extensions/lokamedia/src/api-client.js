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
      const error = new Error(payload.code ?? payload.error ?? `HTTP_${response.status}`);
      error.code = payload.code ?? payload.error;
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
    const approval = job.approval_record || blobRecord.approval_record;
    if (approval) {
      form.set('approval_record', typeof approval === 'string' ? approval : JSON.stringify(approval));
    }
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

  getWatermarkConfig() {
    return this.request('/api/internal/v1/media/watermark/config', {
      method: 'GET',
      headers: this.headers()
    });
  }

  async getWatermarkMasterAsset(assetId) {
    const response = await this.fetchImpl(`${this.baseUrl}/api/internal/v1/media/watermark/assets/${encodeURIComponent(assetId)}`, {
      method: 'GET',
      headers: this.headers({
        Accept: 'image/png, image/webp, */*'
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload.code ?? payload.error ?? payload.message ?? `HTTP_${response.status}`);
      error.code = payload.code ?? payload.error;
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    const meta = {
      asset_id: response.headers.get('x-asset-id') || assetId,
      mime: response.headers.get('x-asset-mime') || response.headers.get('content-type') || 'image/png',
      width: parseInt(response.headers.get('x-asset-width') || '0', 10),
      height: parseInt(response.headers.get('x-asset-height') || '0', 10),
      byte_size: parseInt(response.headers.get('x-asset-byte-size') || response.headers.get('content-length') || '0', 10),
      sha256: response.headers.get('x-asset-sha256') || '',
      alpha_present: response.headers.get('x-asset-alpha-present') === 'true'
    };

    const bytes = await response.arrayBuffer();
    return {
      bytes,
      meta
    };
  }

  async uploadDerivative({
    derivativeId,
    transformId,
    jobId = '',
    slotKey = 'featured',
    role = 'PUBLIC_DERIVATIVE_CANDIDATE',
    bytes,
    mime = 'image/png',
    width,
    height,
    sha256,
    onProgress
  }) {
    if (!bytes) throw new Error('Derivative bytes are required for upload');
    const total = bytes.byteLength !== undefined ? bytes.byteLength : (bytes.length ?? 0);
    onProgress?.({ bytesSent: 0, bytesTotal: total });

    const form = new FormData();
    form.set('derivative_id', derivativeId);
    form.set('transform_id', transformId);
    form.set('job_id', jobId);
    form.set('slot_key', slotKey);
    form.set('role', role);
    form.set('mime', mime);
    form.set('width', String(width));
    form.set('height', String(height));
    form.set('byte_size', String(total));
    form.set('sha256', sha256);
    form.set('file', new Blob([bytes], { type: mime }), 'derivative.png');

    const response = await this.fetchImpl(
      `${this.baseUrl}/api/internal/v1/media/derivatives/${encodeURIComponent(derivativeId)}/upload`,
      {
        method: 'POST',
        headers: this.deviceToken ? { Authorization: `Bearer ${this.deviceToken}` } : {},
        body: form
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message ?? payload.code ?? payload.error ?? `HTTP_${response.status}`);
      error.code = payload.code ?? payload.error ?? 'UPLOAD_FAILED';
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    onProgress?.({ bytesSent: total, bytesTotal: total });
    return payload;
  }

  async getDerivativeUploadReceipt(sha256, derivativeId, transformId, extension = 'png') {
    const params = new URLSearchParams({
      sha256,
      transform_id: transformId,
      extension
    });
    const response = await this.fetchImpl(
      `${this.baseUrl}/api/internal/v1/media/derivatives/${encodeURIComponent(derivativeId)}/upload?${params.toString()}`,
      {
        method: 'GET',
        headers: this.headers()
      }
    );

    if (response.status === 404) {
      return null;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message ?? payload.code ?? `HTTP_${response.status}`);
      error.code = payload.code ?? 'FETCH_RECEIPT_FAILED';
      error.status = response.status;
      throw error;
    }

    return payload.receipt ?? null;
  }
}

