/**
 * RancangLoka LokaMedia — Gemini Provider Adapter
 * Coordinates observation, controlled submission, and image candidate capture for Gemini Web UI.
 */

import {
  GEMINI_DOM_ADAPTER_VERSION,
  GEMINI_ERROR_CODES,
  GEMINI_PROVIDER_NAME,
  GEMINI_PROVIDER_ID
} from './constants.js';
import { detectGeminiCapabilities } from './capability-detector.js';

export class GeminiProviderAdapter {
  constructor({ tabController = null, root = null } = {}) {
    this.name = GEMINI_PROVIDER_NAME;
    this.providerId = GEMINI_PROVIDER_ID;
    this.adapterVersion = GEMINI_DOM_ADAPTER_VERSION;
    this.tabController = tabController;
    this.root = root;
  }

  async diagnostic(job = {}) {
    if (this.root) {
      return detectGeminiCapabilities(this.root);
    }
    const tab = await this.tabController?.locateTab?.();
    if (!tab?.ok) {
      return {
        dom_status: 'UNSUPPORTED',
        error_code: tab?.status || GEMINI_ERROR_CODES.TAB_MISSING,
        auth_state: 'UNKNOWN',
        capabilities: {}
      };
    }
    if (this.tabController?.chrome?.tabs?.sendMessage) {
      try {
        const resp = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
          id: crypto.randomUUID(),
          provider: 'gemini',
          type: 'GEMINI_PROVIDER_DIAGNOSTIC',
          version: GEMINI_DOM_ADAPTER_VERSION
        });
        return resp?.capabilities || resp;
      } catch (err) {
        return {
          dom_status: 'UNSUPPORTED',
          error_code: GEMINI_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE,
          auth_state: 'UNKNOWN',
          capabilities: {}
        };
      }
    }
    return {
      dom_status: 'UNSUPPORTED',
      error_code: GEMINI_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE,
      auth_state: 'UNKNOWN',
      capabilities: {}
    };
  }

  async prepare(job) {
    const diag = await this.diagnostic(job);
    if (diag.dom_status !== 'SUPPORTED') {
      const error = new Error(diag.error_code || GEMINI_ERROR_CODES.DOM_CONTRACT_UNSUPPORTED);
      error.code = diag.error_code || GEMINI_ERROR_CODES.DOM_CONTRACT_UNSUPPORTED;
      throw error;
    }
    return diag;
  }

  async submit(job = {}) {
    if (job.controlled_run_once) {
      const tab = await this.tabController?.locateTab?.();
      if (!tab?.ok) {
        const error = new Error(tab?.status || GEMINI_ERROR_CODES.TAB_MISSING);
        error.code = tab?.status || GEMINI_ERROR_CODES.TAB_MISSING;
        throw error;
      }

      const response = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
        id: crypto.randomUUID(),
        provider: 'gemini',
        type: 'GEMINI_PROVIDER_CONTROLLED_SUBMIT',
        version: GEMINI_DOM_ADAPTER_VERSION,
        controlled_run_once: true,
        job_id: job.job_id,
        prompt: job.prompt,
        prompt_hash: job.prompt_hash,
        prompt_version: job.prompt_version,
        run_id: job.run_id,
        slot_key: job.slot_key,
        timeout_ms: job.timeout_ms
      });

      if (!response?.ok) {
        const error = new Error(response?.error || 'PROVIDER_SUBMIT_FAILED');
        error.code = response?.error || 'PROVIDER_SUBMIT_FAILED';
        error.stage = response?.stage || 'UNKNOWN';
        error.submission_escaped = Boolean(response?.submission_escaped);
        throw error;
      }

      return {
        ok: true,
        job_id: job.job_id,
        run_id: job.run_id,
        slot_key: job.slot_key || 'featured',
        provider_id: GEMINI_PROVIDER_ID,
        provider_name: GEMINI_PROVIDER_NAME,
        stage: response.stage || 'SUBMISSION_CONFIRMED',
        submission_stage: response.submission_stage || 'SUBMISSION_CONFIRMED',
        submitted_at: response.submitted_at || new Date().toISOString(),
        baseline_image_count: response.baseline_image_count ?? 0,
        evidence: response.evidence || null
      };
    }

    // Manual-assisted workflow fallback when full autonomous automation is prohibited
    return {
      job_id: job.job_id,
      run_id: job.run_id,
      slot_key: job.slot_key || 'featured',
      provider_id: GEMINI_PROVIDER_ID,
      provider_name: GEMINI_PROVIDER_NAME,
      workflow_mode: 'MANUAL_ASSISTED',
      instructions: 'Salin prompt visual ke composer Gemini dan konfirmasi gambar yang dihasilkan.',
      submitted_at: new Date().toISOString()
    };
  }

  async observeGeneration(job = {}) {
    const tab = await this.tabController?.locateTab?.();
    if (!tab?.ok) {
      const error = new Error(tab?.status || GEMINI_ERROR_CODES.TAB_MISSING);
      error.code = tab?.status || GEMINI_ERROR_CODES.TAB_MISSING;
      throw error;
    }
    const response = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
      id: crypto.randomUUID(),
      provider: 'gemini',
      type: 'GEMINI_PROVIDER_OBSERVE_GENERATION',
      version: GEMINI_DOM_ADAPTER_VERSION,
      job_id: job.job_id,
      run_id: job.run_id,
      prompt_version: job.prompt_version,
      prompt_hash: job.prompt_hash,
      slot_key: job.slot_key
    });
    return response;
  }

  async generate(job) {
    await this.prepare(job);
    return this.submit(job);
  }

  async observe(job) {
    return this.observeGeneration(job);
  }

  async capture(job = {}, providerResult = {}) {
    const tab = await this.tabController?.locateTab?.();
    if (!tab?.ok) {
      const error = new Error(tab?.status || GEMINI_ERROR_CODES.TAB_MISSING);
      error.code = tab?.status || GEMINI_ERROR_CODES.TAB_MISSING;
      throw error;
    }

    const response = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
      id: crypto.randomUUID(),
      provider: 'gemini',
      type: 'GEMINI_PROVIDER_CAPTURE',
      version: GEMINI_DOM_ADAPTER_VERSION,
      job_id: job.job_id,
      run_id: job.run_id,
      slot_key: job.slot_key
    });

    if (!response?.ok || (!response?.candidate && !response?.data_url)) {
      const error = new Error(response?.error || GEMINI_ERROR_CODES.CAPTURE_TARGET_MISSING);
      error.code = response?.error || GEMINI_ERROR_CODES.CAPTURE_TARGET_MISSING;
      throw error;
    }

    const candidate = response.candidate || response;
    const dataUrl = candidate.data_url || '';
    let bytes;
    if (dataUrl.startsWith('data:')) {
      const base64 = dataUrl.split(',')[1] || '';
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        u8[i] = binaryStr.charCodeAt(i);
      }
      bytes = u8.buffer;
    } else {
      const binErr = new Error('CAPTURE_BINARY_MISSING');
      binErr.code = 'CAPTURE_BINARY_MISSING';
      throw binErr;
    }

    return {
      bytes,
      size: candidate.byte_size || bytes.byteLength,
      mime: candidate.mime || 'image/png',
      width: candidate.width || 1024,
      height: candidate.height || 1024,
      sha256: candidate.sha256 || `sha256-${job.job_id}`,
      blobKey: `${job.job_id}:${job.prompt_version ?? 1}`,
      provenance: candidate.provenance || 'PROVIDER_BINARY',
      is_canonical_original: candidate.is_canonical_original ?? true
    };
  }

  async captureLatest(job = {}) {
    if (!this.tabController?.locateTab) {
      const error = new Error('CAPTURE_DISABLED');
      error.code = 'CAPTURE_DISABLED';
      throw error;
    }
    const tab = await this.tabController.locateTab();
    if (!tab?.ok) {
      const error = new Error(tab?.status || GEMINI_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE);
      error.code = tab?.status || GEMINI_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE;
      throw error;
    }
    let response;
    try {
      response = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
        id: crypto.randomUUID(),
        provider: 'gemini',
        type: 'GEMINI_PROVIDER_CAPTURE_LATEST',
        version: GEMINI_DOM_ADAPTER_VERSION,
        job_id: job.job_id,
        run_id: job.run_id,
        prompt_version: job.prompt_version,
        prompt_hash: job.prompt_hash,
        slot_key: job.slot_key
      });
    } catch (sendErr) {
      const connErr = new Error(GEMINI_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE);
      connErr.code = GEMINI_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE;
      connErr.cause = sendErr;
      throw connErr;
    }
    if (!response?.ok) {
      const error = new Error(response?.error || 'CAPTURE_FAILED');
      error.code = response?.error || 'CAPTURE_FAILED';
      throw error;
    }
    const dataUrl = response.data_url || response.candidate?.data_url || '';
    let bytes;
    let computedSha = response.sha256 || response.candidate?.sha256 || null;
    let byteSize = response.byte_size || response.candidate?.byte_size || 0;
    let mime = response.mime || response.candidate?.mime || 'image/png';
    const imageSrc = response.src || response.candidate?.src || null;

    if (dataUrl.startsWith('data:')) {
      const base64 = dataUrl.split(',')[1] || '';
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        u8[i] = binaryStr.charCodeAt(i);
      }
      bytes = u8.buffer;
      byteSize = bytes.byteLength;
    } else if (imageSrc && (imageSrc.startsWith('http://') || imageSrc.startsWith('https://') || imageSrc.startsWith('blob:'))) {
      const fetchRes = await fetch(imageSrc);
      if (!fetchRes.ok) {
        const fetchErr = new Error(`FETCH_CDN_IMAGE_FAILED:${fetchRes.status}`);
        fetchErr.code = `FETCH_CDN_IMAGE_FAILED:${fetchRes.status}`;
        throw fetchErr;
      }
      bytes = await fetchRes.arrayBuffer();
      byteSize = bytes.byteLength;
      mime = fetchRes.headers.get('content-type') || mime;
      if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        computedSha = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } else {
      const binErr = new Error('CAPTURE_BINARY_MISSING');
      binErr.code = 'CAPTURE_BINARY_MISSING';
      throw binErr;
    }
    return {
      bytes,
      size: byteSize || bytes.byteLength,
      mime,
      width: response.width || response.candidate?.width || 1024,
      height: response.height || response.candidate?.height || 1024,
      sha256: computedSha || `sha256-${job.job_id}`,
      blobKey: `${job.job_id}:${job.prompt_version ?? 1}`,
      provenance: response.provenance || response.candidate?.provenance || 'PROVIDER_BINARY',
      is_canonical_original: response.is_canonical_original ?? response.candidate?.is_canonical_original ?? true
    };
  }
}
