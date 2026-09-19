(() => {
  const CHATGPT_DOM_ADAPTER_VERSION = 1;
  if (globalThis.__lokamediaChatGptProvider?.version === CHATGPT_DOM_ADAPTER_VERSION) {
    void globalThis.__lokamediaChatGptProvider.handshake();
    return;
  }

  const sessionId = crypto.randomUUID();

  function first(selectors, root = document) {
    for (const selector of selectors) {
      try {
        const element = root.querySelector(selector);
        if (element) return { element, selector };
      } catch {
        // Continue layered discovery when a browser rejects a selector.
      }
    }
    return { element: null, selector: null };
  }

  function count(selectors, root = document) {
    const seen = new Set();
    for (const selector of selectors) {
      try {
        for (const element of root.querySelectorAll(selector)) seen.add(element);
      } catch {
        // Continue layered discovery.
      }
    }
    return seen.size;
  }

  function detect() {
    const auth = first(['a[href*="/auth/login"]', 'button[data-testid="login-button"]', '[data-testid="login-button"]']);
    const composer = first([
      '#prompt-textarea[contenteditable="true"]',
      'div[contenteditable="true"]#prompt-textarea',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-testid*="prompt"]',
      'textarea[data-testid*="prompt"]',
      'main form div[contenteditable="true"]',
      'form div[contenteditable="true"]',
      'form textarea'
    ]);
    const send = first([
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button#composer-submit-button',
      'button.composer-submit-button-color',
      'form button[class*="composer-submit-button"]',
      'form button[type="submit"]'
    ]);
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
          composer.element.isContentEditable ||
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

  function setComposerValue(element, value) {
    if (element.matches?.('textarea')) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement?.prototype || {}, 'value')?.set;
      if (setter) {
        setter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (element.isContentEditable || element.getAttribute?.('contenteditable') === 'true') {
      element.focus?.();
      try {
        const sel = window.getSelection?.();
        if (sel) {
          const range = document.createRange?.();
          range.selectNodeContents(element);
          sel.removeAllRanges?.();
          sel.addRange?.(range);
        }
        if (document.execCommand?.('insertText', false, value)) {
          element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
          return;
        }
      } catch {
        // Fallback below
      }
      element.textContent = value;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      return;
    }
    element.textContent = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function waitForSendControl(container, timeoutMs = 2000) {
    const form = container?.closest?.('form') || document;
    const findSend = () => {
      const btn = first([
        'button[data-testid="send-button"]:not([disabled])',
        'button[aria-label*="Send"]:not([disabled])',
        '#composer-submit-button:not([aria-label*="Voice"]):not([disabled])',
        'form button[type="submit"]:not([disabled])',
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        '#composer-submit-button',
        'button.composer-submit-button-color'
      ], form).element;
      if (!btn) return null;
      const isVoice = btn.getAttribute?.('aria-label')?.includes('Voice');
      const isDisabled = btn.disabled || btn.getAttribute?.('aria-disabled') === 'true';
      if (!isVoice && !isDisabled) return btn;
      return null;
    };

    const immediate = findSend();
    if (immediate) return immediate;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 50));
      const found = findSend();
      if (found) return found;
    }
    return null;
  }

  async function controlledSubmit(message) {
    const caps = detect();
    if (caps.auth_state !== 'AUTHENTICATED') return { ok: false, error: 'AUTH_REQUIRED', capabilities: caps };
    if (caps.dom_status !== 'SUPPORTED' || !caps.capabilities.COMPOSER_EDITABLE || !caps.capabilities.SEND_CONTROL_PRESENT) {
      return { ok: false, error: 'DOM_CONTRACT_UNSUPPORTED', capabilities: caps };
    }
    const composer = first([
      '#prompt-textarea[contenteditable="true"]',
      'div[contenteditable="true"]#prompt-textarea',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-testid*="prompt"]',
      'textarea[data-testid*="prompt"]',
      'main form div[contenteditable="true"]',
      'form div[contenteditable="true"]',
      'form textarea'
    ]);
    if (!composer.element) {
      return { ok: false, error: 'DOM_CONTRACT_UNSUPPORTED', capabilities: caps };
    }
    if (!message.controlled_run_once || !message.prompt || !message.prompt_hash || !message.job_id) {
      return { ok: false, error: 'CONTROLLED_SUBMIT_CONTRACT_INVALID', capabilities: caps };
    }
    setComposerValue(composer.element, message.prompt);
    const sendControl = await waitForSendControl(composer.element, 2000);
    if (!sendControl) {
      return { ok: false, error: 'SEND_CONTROL_UNAVAILABLE', capabilities: detect() };
    }
    sendControl.click();
    return {
      ok: true,
      submitted_at: new Date().toISOString(),
      session_id: sessionId,
      baseline_image_count: caps.image_candidate_count
    };
  }

  function normalizeSource(src = '') {
    try {
      const url = new URL(src, 'https://chatgpt.com');
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return src.split('?')[0].split('#')[0];
    }
  }

  function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function fingerprintImg(element) {
    const container = element.closest?.('[data-message-id], [data-testid*="conversation-turn"], article, [data-message-author-role]') ?? element.parentElement;
    const containerFingerprint = hashText([
      container?.getAttribute?.('data-message-id') ?? '',
      container?.getAttribute?.('data-testid') ?? '',
      container?.getAttribute?.('data-message-author-role') ?? '',
      container?.tagName ?? ''
    ].join('|'));
    const normalized = normalizeSource(element.currentSrc || element.getAttribute?.('src') || '');
    const basis = [
      normalized,
      Number(element.getAttribute?.('width') || element.naturalWidth || element.width || 0),
      Number(element.getAttribute?.('height') || element.naturalHeight || element.height || 0),
      containerFingerprint,
      element.getAttribute?.('data-asset-id') || ''
    ].join('|');
    return `img_${hashText(basis)}`;
  }

  async function imageToDataUrl(imgElement) {
    // If element has a valid src, try canvas drawImage first (for already-rendered image elements)
    if (typeof document !== 'undefined' && document.createElement) {
      try {
        const canvas = document.createElement('canvas');
        const width = imgElement.naturalWidth || imgElement.width || 1024;
        const height = imgElement.naturalHeight || imgElement.height || 768;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl && dataUrl.startsWith('data:image/png;base64,') && dataUrl.length > 50) {
            const base64 = dataUrl.split(',')[1];
            const byteSize = Math.floor((base64.length * 3) / 4);
            return { data_url: dataUrl, mime: 'image/png', width, height, byte_size: byteSize };
          }
        }
      } catch {
        // Tainted canvas or canvas draw failed, fallback to fetch below
      }
    }

    const src = imgElement.currentSrc || imgElement.src || imgElement.getAttribute?.('src');
    if (!src) throw new Error('CAPTURE_SRC_MISSING');

    if (src.startsWith('data:')) {
      const mime = src.slice(5, src.indexOf(';')) || 'image/png';
      const base64 = src.split(',')[1] || '';
      const byteSize = Math.floor((base64.length * 3) / 4);
      return {
        data_url: src,
        mime,
        width: imgElement.naturalWidth || imgElement.width || 1024,
        height: imgElement.naturalHeight || imgElement.height || 768,
        byte_size: byteSize
      };
    }

    // Otherwise fetch the source URL directly
    const res = await fetch(src);
    if (!res.ok) throw new Error(`CAPTURE_FETCH_FAILED_${res.status}`);
    const blob = await res.blob();
    const mime = blob.type || 'image/png';
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;
    return {
      data_url: dataUrl,
      mime,
      width: imgElement.naturalWidth || imgElement.width || 1024,
      height: imgElement.naturalHeight || imgElement.height || 768,
      byte_size: buffer.byteLength
    };
  }

  async function controlledCapture(message) {
    const { job_id, run_id, slot_key, provider_result } = message;
    if (!job_id || !provider_result) {
      return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    }
    if (provider_result.job_id && provider_result.job_id !== job_id) {
      return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    }
    if (provider_result.run_id && run_id && provider_result.run_id !== run_id) {
      return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    }
    if (provider_result.slot_key && slot_key && provider_result.slot_key !== slot_key) {
      return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    }

    const expectedFp = provider_result.source_fingerprint || provider_result.fingerprint || null;
    const expectedContainerFp = provider_result.containerFingerprint || null;

    if (!expectedFp && !expectedContainerFp) {
      return { ok: false, error: 'CAPTURE_CORRELATION_MISMATCH' };
    }

    // Discover all candidate images on page
    const imageSelectors = [
      '[data-message-author-role="assistant"] img',
      'main img[src]',
      'main picture img[src]'
    ];
    const allImgs = [];
    const seen = new Set();
    for (const sel of imageSelectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          if (!seen.has(el)) {
            seen.add(el);
            allImgs.push(el);
          }
        }
      } catch {}
    }

    if (allImgs.length === 0) {
      return { ok: false, error: 'CAPTURE_TARGET_MISSING' };
    }

    // Correlate: match by exact source_fingerprint if provided
    let matches = [];
    if (expectedFp) {
      matches = allImgs.filter((el) => fingerprintImg(el) === expectedFp);
    } else if (expectedContainerFp) {
      matches = allImgs.filter((el) => {
        const container = el.closest?.('[data-message-id], [data-testid*="conversation-turn"], article, [data-message-author-role]') ?? el.parentElement;
        const cFp = hashText([
          container?.getAttribute?.('data-message-id') ?? '',
          container?.getAttribute?.('data-testid') ?? '',
          container?.getAttribute?.('data-message-author-role') ?? '',
          container?.tagName ?? ''
        ].join('|'));
        return cFp === expectedContainerFp;
      });
    }

    if (matches.length === 0) {
      return { ok: false, error: 'CAPTURE_TARGET_MISSING' };
    }
    if (matches.length > 1) {
      return { ok: false, error: 'CAPTURE_TARGET_AMBIGUOUS', match_count: matches.length };
    }

    const targetImg = matches[0];
    try {
      const capturedData = await imageToDataUrl(targetImg);
      return {
        ok: true,
        ...capturedData,
        source_fingerprint: fingerprintImg(targetImg),
        job_id,
        run_id,
        slot_key
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err || 'CAPTURE_FAILED') };
    }
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
    if (message.type === 'CHATGPT_PROVIDER_CONTROLLED_SUBMIT') {
      void controlledSubmit(message).then(sendResponse).catch((error) => sendResponse({ ok: false, error: String(error?.message || error || 'SUBMIT_FAILED') }));
      return true;
    }
    if (message.type === 'CHATGPT_PROVIDER_CAPTURE') {
      void controlledCapture(message).then(sendResponse).catch((error) => sendResponse({ ok: false, error: String(error?.message || error || 'CAPTURE_FAILED') }));
      return true;
    }
    return false;
  });

  globalThis.__lokamediaChatGptProvider = {
    version: CHATGPT_DOM_ADAPTER_VERSION,
    detect,
    handshake,
    fingerprintImg,
    controlledCapture
  };

  void handshake();
})();
