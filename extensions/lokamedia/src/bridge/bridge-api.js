/**
 * LokaBridge API Client Module
 * File: extensions/lokamedia/src/bridge/bridge-api.js
 * 
 * Handles authenticated communication with RancangLoka Shared Editorial Gateway
 * and LokaBridge Studio Import Orchestrator.
 */

export class BridgeApiClient {
  constructor({ baseUrl, deviceToken, environment = 'local', fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = String(baseUrl ?? '').replace(/\/+$/, '');
    this.deviceToken = deviceToken;
    this.environment = environment;
    this.fetchImpl = fetchImpl;
  }

  headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'X-LokaBridge-Version': '1.1.0',
      ...(this.deviceToken ? { Authorization: `Bearer ${this.deviceToken}` } : { 'X-RL-Dev-Mode': 'tokenless', 'X-RL-Device-Id': 'dev_local_tokenless' }),
      ...extra
    };
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const customHeaders = options.headers || {};
    const isFormData = typeof globalThis.FormData !== 'undefined' && options.body instanceof globalThis.FormData;

    const reqHeaders = isFormData
      ? {
          'X-LokaBridge-Version': '1.1.0',
          ...(this.deviceToken ? { Authorization: `Bearer ${this.deviceToken}` } : { 'X-RL-Dev-Mode': 'tokenless', 'X-RL-Device-Id': 'dev_local_tokenless' }),
          ...customHeaders
        }
      : this.headers(customHeaders);

    const res = await this.fetchImpl(url, {
      ...options,
      headers: reqHeaders
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.code || `HTTP_${res.status}`);
      err.status = res.status;
      err.code = data.code;
      err.data = data;
      throw err;
    }
    return data;
  }

  /**
   * Ping / Healthcheck & Connection Test
   */
  async checkHealth() {
    try {
      const ctx = await this.getEditorialContext();
      return { connected: true, version: ctx?.version || '1.1.0', error: null };
    } catch (err) {
      return { connected: false, version: null, error: err.message };
    }
  }

  /**
   * Retrieve Editorial Guidelines, Voice & Tone, and Golden #9993
   */
  async getEditorialContext() {
    const res = await this.request('/api/internal/v1/bridge/context', { method: 'GET' });
    return res.data;
  }

  /**
   * Check keyword cannibalization & slug availability
   */
  async checkKeyword(keyword, slug = '') {
    const query = new URLSearchParams({ keyword, slug }).toString();
    const res = await this.request(`/api/internal/v1/bridge/keywords/check?${query}`, { method: 'GET' });
    return res.data;
  }

  /**
   * Submit / Stage an Import Job to the Server Orchestrator
   */
  async submitImportJob(packagePayload) {
    const res = await this.request('/api/internal/v1/bridge/jobs', {
      method: 'POST',
      body: JSON.stringify(packagePayload)
    });
    return res;
  }

  /**
   * Get detailed status of an Import Job
   */
  async getImportJob(jobId) {
    const res = await this.request(`/api/internal/v1/bridge/jobs/${jobId}`, {
      method: 'GET'
    });
    return res;
  }

  /**
   * Retry a failed component or asset
   */
  async retryJobAsset(jobId, visualId, replacementUrl) {
    const res = await this.request(`/api/internal/v1/bridge/jobs/${jobId}`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'retry_asset',
        visual_id: visualId,
        replacement_url: replacementUrl
      })
    });
    return res;
  }

  /**
   * Retry all pipelines for a job
   */
  async retryJobPipelines(jobId) {
    const res = await this.request(`/api/internal/v1/bridge/jobs/${jobId}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'retry_pipelines' })
    });
    return res;
  }

  /**
   * Upload an image asset to RancangLoka media ingress
   */
  async uploadAsset(fileOrBlob, visualId = 'cover_hero', role = 'cover_hero', altText = '', caption = '') {
    const formData = new globalThis.FormData();
    formData.append('file', fileOrBlob, `${visualId}.jpg`);
    formData.append('visual_id', visualId);
    formData.append('role', role);
    formData.append('alt_text', altText);
    formData.append('caption', caption);

    const res = await this.request('/api/internal/v1/bridge/assets/upload', {
      method: 'POST',
      body: formData
    });
    return res;
  }

  /**
   * Get Publication Calendar Slots in Asia/Jakarta (WIB)
   */
  async getCalendarSlots(dateStr) {
    const query = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '';
    const res = await this.request(`/api/internal/v1/bridge/calendar/slots${query}`, {
      method: 'GET'
    });
    return res.calendar;
  }
}
