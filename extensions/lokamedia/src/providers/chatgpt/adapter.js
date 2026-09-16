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

  async submit() {
    const error = new Error('PROMPT_SUBMISSION_DISABLED_PHASE_4A');
    error.code = 'PROMPT_SUBMISSION_DISABLED_PHASE_4A';
    error.prompt_submission_enabled = PROMPT_SUBMISSION_ENABLED;
    throw error;
  }

  async generate(job) {
    await this.prepare(job);
    await this.submit(job);
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
