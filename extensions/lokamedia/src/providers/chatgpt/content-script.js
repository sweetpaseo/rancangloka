(() => {
  const CHATGPT_DOM_ADAPTER_VERSION = 1;
  if (globalThis.__lokamediaChatGptProvider?.version === CHATGPT_DOM_ADAPTER_VERSION) {
    void globalThis.__lokamediaChatGptProvider.handshake();
    return;
  }

  const sessionId = crypto.randomUUID();

  function first(selectors) {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) return { element, selector };
      } catch {
        // Continue layered discovery when a browser rejects a selector.
      }
    }
    return { element: null, selector: null };
  }

  function count(selectors) {
    const seen = new Set();
    for (const selector of selectors) {
      try {
        for (const element of document.querySelectorAll(selector)) seen.add(element);
      } catch {
        // Continue layered discovery.
      }
    }
    return seen.size;
  }

  function detect() {
    const auth = first(['a[href*="/auth/login"]', 'button[data-testid="login-button"]', '[data-testid="login-button"]']);
    const composer = first([
      'div[contenteditable="true"][data-testid*="prompt"]',
      'textarea[data-testid*="prompt"]',
      'form textarea',
      'main form div[contenteditable="true"]'
    ]);
    const send = first(['button[data-testid="send-button"]', 'button[aria-label*="Send"]', 'form button[type="submit"]']);
    const surface = first(['main', '[role="main"]']);
    const imageCount = count(['[data-message-author-role="assistant"] img', 'main img[src]', 'main picture img[src]']);
    const responseCount = count([
      '[data-message-author-role="assistant"]',
      'article:has([data-message-author-role="assistant"])',
      '[data-testid*="conversation-turn"]'
    ]);
    const download = first(['a[download]', 'a[href*="download"]', 'button[aria-label*="Download"]']);
    const domSupported = Boolean(auth.element || (surface.element && composer.element));
    const authenticated = !auth.element && Boolean(surface.element || composer.element);
    const composerEditable = Boolean(
      composer.element &&
        (composer.element.matches?.('textarea') ||
          composer.element.getAttribute?.('contenteditable') === 'true' ||
          !composer.element.hasAttribute?.('disabled'))
    );
    return {
      adapter_version: CHATGPT_DOM_ADAPTER_VERSION,
      auth_state: auth.element ? 'AUTH_REQUIRED' : authenticated ? 'AUTHENTICATED' : 'UNKNOWN',
      dom_status: domSupported ? 'SUPPORTED' : 'UNSUPPORTED',
      capabilities: {
        COMPOSER_PRESENT: Boolean(composer.element),
        COMPOSER_EDITABLE: composerEditable,
        SEND_CONTROL_PRESENT: Boolean(send.element),
        CONVERSATION_SURFACE_PRESENT: Boolean(surface.element),
        RESPONSE_SURFACE_DISCOVERABLE: responseCount > 0,
        IMAGE_RESULT_SURFACE_DISCOVERABLE: imageCount > 0,
        DOWNLOAD_CAPABILITY_DISCOVERABLE: Boolean(download.element),
        AUTHENTICATED: authenticated,
        AUTH_REQUIRED: Boolean(auth.element)
      },
      response_count: responseCount,
      image_candidate_count: imageCount,
      prompt_submission_enabled: false
    };
  }

  function send(type, payload = {}) {
    return chrome.runtime.sendMessage({
      id: crypto.randomUUID(),
      provider: 'chatgpt',
      type,
      version: CHATGPT_DOM_ADAPTER_VERSION,
      session_id: sessionId,
      ...payload
    });
  }

  async function handshake() {
    await send('CHATGPT_PROVIDER_HELLO', { capabilities: detect() });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.provider !== 'chatgpt' || message?.version !== CHATGPT_DOM_ADAPTER_VERSION) return false;
    if (message.type === 'CHATGPT_PROVIDER_DIAGNOSTIC') {
      sendResponse({ ok: true, capabilities: detect(), session_id: sessionId });
      return true;
    }
    return false;
  });

  globalThis.__lokamediaChatGptProvider = {
    version: CHATGPT_DOM_ADAPTER_VERSION,
    detect,
    handshake
  };

  void handshake();
})();
