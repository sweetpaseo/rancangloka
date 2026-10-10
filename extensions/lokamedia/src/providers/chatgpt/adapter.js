import {
  CHATGPT_DOM_ADAPTER_VERSION,
  CHATGPT_ERROR_CODES,
  CHATGPT_PROVIDER_NAME,
  PROMPT_SUBMISSION_ENABLED
} from './constants.js';
import { detectChatGptCapabilities } from './capability-detector.js';
import { discoverCapturePaths } from './capture-discovery.js';
import { createCorrelationBaseline, isCaptureReadyProviderResult } from './correlation.js';

export class ChatGptProviderAdapter {
  constructor({ tabController = null, root = null } = {}) {
    this.name = CHATGPT_PROVIDER_NAME;
    this.adapterVersion = CHATGPT_DOM_ADAPTER_VERSION;
    this.tabController = tabController;
    this.root = root;
  }

  async prepare(job) {
    const diagnostic = await this.diagnostic(job);
    if (diagnostic.dom_status !== 'SUPPORTED') {
      const error = new Error(CHATGPT_ERROR_CODES.DOM_CONTRACT_UNSUPPORTED);
      error.code = CHATGPT_ERROR_CODES.DOM_CONTRACT_UNSUPPORTED;
      throw error;
    }
    return diagnostic;
  }

  async submit(job = {}) {
    if (job.controlled_run_once) {
      const tab = await this.tabController?.locateTab?.();
      if (!tab?.ok) {
        const error = new Error(tab?.status || CHATGPT_ERROR_CODES.TAB_MISSING);
        error.code = tab?.status || CHATGPT_ERROR_CODES.TAB_MISSING;
        throw error;
      }
      const response = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
        id: crypto.randomUUID(),
        provider: 'chatgpt',
        type: 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT',
        version: CHATGPT_DOM_ADAPTER_VERSION,
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
        error.submission_escaped = response?.submission_escaped ?? false;
        throw error;
      }
      const providerResult = {
        job_id: job.job_id,
        run_id: job.run_id,
        slot_key: job.slot_key || 'featured',
        prompt_version: job.prompt_version,
        prompt_hash: job.prompt_hash,
        provider_conversation_id: response.provider_conversation_id || response.session_id || null,
        provider_response_id: response.provider_response_id || null,
        submitted_at: response.submitted_at || new Date().toISOString(),
        identified_at: response.identified_at || new Date().toISOString(),
        source_fingerprint: response.source_fingerprint,
        containerFingerprint: response.containerFingerprint
      };
      if (!isCaptureReadyProviderResult(providerResult, { job_id: job.job_id, run_id: job.run_id, slot_key: job.slot_key })) {
        const invErr = new Error(CHATGPT_ERROR_CODES.PROVIDER_RESULT_INVALID_DESCRIPTOR);
        invErr.code = CHATGPT_ERROR_CODES.PROVIDER_RESULT_INVALID_DESCRIPTOR;
        throw invErr;
      }
      return providerResult;
    }
    const error = new Error('PROMPT_SUBMISSION_DISABLED_PHASE_4A');
    error.code = 'PROMPT_SUBMISSION_DISABLED_PHASE_4A';
    error.prompt_submission_enabled = PROMPT_SUBMISSION_ENABLED;
    throw error;
  }

  async generate(job) {
    await this.prepare(job);
    return this.submit(job);
  }

  async observe(job) {
    return this.prepare(job);
  }

  async capture(job = {}, providerResult = {}) {
    if (!this.tabController?.locateTab) {
      const error = new Error('CAPTURE_DISABLED_PHASE_4A');
      error.code = 'CAPTURE_DISABLED_PHASE_4A';
      throw error;
    }
    if (!isCaptureReadyProviderResult(providerResult, { job_id: job.job_id, run_id: job.run_id, slot_key: job.slot_key })) {
      const error = new Error(CHATGPT_ERROR_CODES.ADAPTER_CAPTURE_MALFORMED_DESCRIPTOR);
      error.code = CHATGPT_ERROR_CODES.ADAPTER_CAPTURE_MALFORMED_DESCRIPTOR;
      throw error;
    }
    const tab = await this.tabController.locateTab();
      if (!tab?.ok) {
        const error = new Error(tab?.status || CHATGPT_ERROR_CODES.TAB_MISSING);
        error.code = tab?.status || CHATGPT_ERROR_CODES.TAB_MISSING;
        throw error;
      }
      let response;
      try {
        response = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
          id: crypto.randomUUID(),
          provider: 'chatgpt',
          type: 'CHATGPT_PROVIDER_CAPTURE',
          version: CHATGPT_DOM_ADAPTER_VERSION,
          job_id: job.job_id,
          run_id: job.run_id,
          prompt_version: job.prompt_version,
          prompt_hash: job.prompt_hash,
          slot_key: job.slot_key,
          provider_result: providerResult
        });
      } catch (sendErr) {
        const connErr = new Error(CHATGPT_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE);
        connErr.code = CHATGPT_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE;
        connErr.cause = sendErr;
        throw connErr;
      }
      if (!response?.ok) {
        const error = new Error(response?.error || 'CAPTURE_FAILED');
        error.code = response?.error || 'CAPTURE_FAILED';
        throw error;
      }
      const dataUrl = response.data_url || '';
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
        size: response.byte_size || bytes.byteLength,
        mime: response.mime || 'image/png',
        width: response.width || 1024,
        height: response.height || 768,
        sha256: response.sha256 || `sha256-${job.job_id}`,
        blobKey: `${job.job_id}:${job.prompt_version ?? 1}`,
        provenance: response.provenance || 'PROVIDER_BINARY',
        is_canonical_original: response.is_canonical_original ?? (response.provenance !== 'CANVAS_REENCODED')
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
      const error = new Error(tab?.status || CHATGPT_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE);
      error.code = tab?.status || CHATGPT_ERROR_CODES.PROVIDER_TARGET_UNAVAILABLE;
      throw error;
    }
    let response;
    try {
      response = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
        id: crypto.randomUUID(),
        provider: 'chatgpt',
        type: 'CHATGPT_PROVIDER_CAPTURE_LATEST',
        version: CHATGPT_DOM_ADAPTER_VERSION,
        job_id: job.job_id,
        run_id: job.run_id,
        prompt_version: job.prompt_version,
        prompt_hash: job.prompt_hash,
        slot_key: job.slot_key
      });
    } catch (sendErr) {
      const connErr = new Error(CHATGPT_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE);
      connErr.code = CHATGPT_ERROR_CODES.CONTENT_SCRIPT_UNAVAILABLE;
      connErr.cause = sendErr;
      throw connErr;
    }
    if (!response?.ok) {
      const error = new Error(response?.error || 'CAPTURE_FAILED');
      error.code = response?.error || 'CAPTURE_FAILED';
      throw error;
    }
    const dataUrl = response.data_url || '';
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
      size: response.byte_size || bytes.byteLength,
      mime: response.mime || 'image/png',
      width: response.width || 1024,
      height: response.height || 768,
      sha256: response.sha256 || `sha256-${job.job_id}`,
      blobKey: `${job.job_id}:${job.prompt_version ?? 1}`,
      provenance: response.provenance || 'PROVIDER_BINARY',
      is_canonical_original: response.is_canonical_original ?? (response.provenance !== 'CANVAS_REENCODED')
    };
  }

  async reconcile(job) {
    return this.prepare(job);
  }

  async cancel() {
    return { ok: true, action: 'NOOP_READ_ONLY_PHASE_4A' };
  }

  async diagnostic(job = null) {
    const root = this.root ?? globalThis.document;
    if (!root && this.tabController?.locateTab) {
      const tab = await this.tabController.locateTab();
      if (!tab.ok) {
        return {
          provider: CHATGPT_PROVIDER_NAME,
          adapter_version: CHATGPT_DOM_ADAPTER_VERSION,
          prompt_submission_enabled: PROMPT_SUBMISSION_ENABLED,
          dom_status: 'UNSUPPORTED',
          error_code: tab.status || CHATGPT_ERROR_CODES.TAB_MISSING,
          capture: { screenshot_primary_capture: false, priorities: [] },
          correlation_baseline: null
        };
      }
      const response = await this.tabController.chrome.tabs.sendMessage(tab.tab_id, {
        id: crypto.randomUUID(),
        provider: 'chatgpt',
        type: 'CHATGPT_PROVIDER_DIAGNOSTIC',
        version: CHATGPT_DOM_ADAPTER_VERSION
      });
      return {
        provider: CHATGPT_PROVIDER_NAME,
        adapter_version: CHATGPT_DOM_ADAPTER_VERSION,
        prompt_submission_enabled: PROMPT_SUBMISSION_ENABLED,
        ...response.capabilities,
        capture: { screenshot_primary_capture: false, priorities: [] },
        correlation_baseline: null,
        session_id: response.session_id
      };
    }
    const capabilities = root ? detectChatGptCapabilities(root) : null;
    const capture = root ? discoverCapturePaths(root) : { screenshot_primary_capture: false, priorities: [] };
    return {
      provider: CHATGPT_PROVIDER_NAME,
      adapter_version: CHATGPT_DOM_ADAPTER_VERSION,
      prompt_submission_enabled: PROMPT_SUBMISSION_ENABLED,
      ...capabilities,
      capture,
      correlation_baseline: root ? createCorrelationBaseline({ job, root }) : null
    };
  }
}
