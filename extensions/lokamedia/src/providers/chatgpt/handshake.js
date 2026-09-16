import { CHATGPT_DOM_ADAPTER_VERSION, CHATGPT_MESSAGE_TYPES } from './constants.js';

export class ChatGptHandshakeManager {
  constructor({ storage, tabController }) {
    this.storage = storage;
    this.tabController = tabController;
  }

  async handle(message, sender) {
    if (!message || message.provider !== 'chatgpt' || message.version !== CHATGPT_DOM_ADAPTER_VERSION) {
      return { ok: false, error: 'INVALID_CHATGPT_PROVIDER_MESSAGE' };
    }
    const state = await this.storage.readState();
    const expectedTabId = state.provider?.chatgpt?.provider_tab_id;
    if (!this.tabController.validateSender(sender, expectedTabId)) return { ok: false, error: 'WRONG_TAB_SENDER' };
    if (message.type !== CHATGPT_MESSAGE_TYPES.HELLO && message.type !== CHATGPT_MESSAGE_TYPES.CAPABILITIES) {
      return { ok: false, error: 'UNKNOWN_CHATGPT_PROVIDER_MESSAGE' };
    }
    const sessionId = message.session_id;
    if (!sessionId) return { ok: false, error: 'MISSING_SESSION' };
    await this.storage.update((next) => {
      next.provider ??= {};
      next.provider.chatgpt ??= {};
      const existing = next.provider.chatgpt.content_script_session_id;
      next.provider.chatgpt.content_script_session_id = sessionId;
      next.provider.chatgpt.handshake_status = existing === sessionId ? 'duplicate_ready' : 'ready';
      next.provider.chatgpt.adapter_version = CHATGPT_DOM_ADAPTER_VERSION;
      next.provider.chatgpt.capabilities = message.capabilities ?? next.provider.chatgpt.capabilities ?? null;
      next.provider.chatgpt.auth_state = message.capabilities?.auth_state ?? next.provider.chatgpt.auth_state ?? 'UNKNOWN';
      next.provider.chatgpt.dom_status = message.capabilities?.dom_status ?? next.provider.chatgpt.dom_status ?? 'UNKNOWN';
      next.provider.chatgpt.visible_image_candidates = message.capabilities?.image_candidate_count ?? 0;
      next.provider.chatgpt.prompt_submission_enabled = false;
      next.provider.chatgpt.updated_at = new Date().toISOString();
    });
    return { ok: true, type: CHATGPT_MESSAGE_TYPES.READY, version: CHATGPT_DOM_ADAPTER_VERSION };
  }
}
