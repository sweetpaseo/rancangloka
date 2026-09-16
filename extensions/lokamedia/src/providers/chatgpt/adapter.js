import {
  CHATGPT_DOM_ADAPTER_VERSION,
  CHATGPT_ERROR_CODES,
  CHATGPT_PROVIDER_NAME,
  PROMPT_SUBMISSION_ENABLED
} from './constants.js';
import { detectChatGptCapabilities } from './capability-detector.js';
import { discoverCapturePaths } from './capture-discovery.js';
import { createCorrelationBaseline } from './correlation.js';

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
        run_id: job.run_id
      });
      if (!response?.ok) {
        const error = new Error(response?.error || 'PROVIDER_SUBMIT_FAILED');
        error.code = response?.error || 'PROVIDER_SUBMIT_FAILED';
        throw error;
      }
      return {
        provider_conversation_id: response.session_id || null,
        provider_response_id: null,
        submitted_at: response.submitted_at || new Date().toISOString()
      };
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

  async capture() {
    const error = new Error('CAPTURE_DISABLED_PHASE_4A');
    error.code = 'CAPTURE_DISABLED_PHASE_4A';
    throw error;
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
