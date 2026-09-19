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

  function getContainerFingerprint(element) {
    const container = element.closest?.('[data-message-id], [data-testid*="conversation-turn"], article, [data-message-author-role]') ?? element.parentElement;
    return hashText([
      container?.getAttribute?.('data-message-id') ?? '',
      container?.getAttribute?.('data-testid') ?? '',
      container?.getAttribute?.('data-message-author-role') ?? '',
      container?.tagName ?? ''
    ].join('|'));
  }

  function fingerprintImg(element) {
    const containerFingerprint = getContainerFingerprint(element);
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

  function getAllImages(root = (typeof document !== 'undefined' ? document : null)) {
    if (!root?.querySelectorAll) return [];
    const imageSelectors = [
      '[data-message-author-role="assistant"] img',
      'main img[src]',
      'main picture img[src]'
    ];
    const allImgs = [];
    const seen = new Set();
    for (const sel of imageSelectors) {
      try {
        for (const el of root.querySelectorAll(sel)) {
          if (!seen.has(el)) {
            seen.add(el);
            allImgs.push(el);
          }
        }
      } catch {}
    }
    return allImgs;
  }

  async function controlledSubmit(message, root = (typeof document !== 'undefined' ? document : null)) {
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

    // Capture pre-submit image baseline
    const baselineImages = getAllImages(root);
    const baselineFps = new Set(baselineImages.map((el) => fingerprintImg(el)));

    setComposerValue(composer.element, message.prompt);
    const sendControl = await waitForSendControl(composer.element, 2000);
    if (!sendControl) {
      return { ok: false, error: 'SEND_CONTROL_UNAVAILABLE', capabilities: detect() };
    }
    sendControl.click();
    const submittedAt = new Date().toISOString();

    // Await deterministic generation result
    const timeoutMs = message.timeout_ms || 120000;
    const pollIntervalMs = 50;
    const startWait = Date.now();
    let targetCandidate = null;

    while (Date.now() - startWait < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const currentImages = getAllImages(root);
      const newImages = currentImages.filter((el) => !baselineFps.has(fingerprintImg(el)));

      if (newImages.length === 1) {
        const candidate = newImages[0];
        const src = candidate.currentSrc || candidate.src || candidate.getAttribute?.('src');
        if (src) {
          targetCandidate = candidate;
          break;
        }
      } else if (newImages.length > 1) {
        // Disambiguate against aria-hidden or blurred decorative clones
        const nonDecorative = newImages.filter((el) => {
          const isAriaHidden = el.getAttribute?.('aria-hidden') === 'true' || el.closest?.('[aria-hidden="true"]') !== null;
          const isBlur = (el.className?.includes?.('blur') || el.closest?.('[class*="blur"]') !== null);
          const isOpacityZero = (el.className?.includes?.('opacity-0') || el.style?.opacity === '0');
          return !isAriaHidden && !isBlur && !isOpacityZero;
        });
        const pool = nonDecorative.length > 0 ? nonDecorative : newImages;
        const distinctFps = new Set(pool.map((el) => fingerprintImg(el)));
        if (distinctFps.size > 1) {
          return {
            ok: false,
            error: 'PROVIDER_RESULT_AMBIGUOUS',
            candidate_count: distinctFps.size
          };
        } else if (distinctFps.size === 1) {
          const withAlt = pool.filter((el) => (el.getAttribute?.('alt') || '').trim() !== '');
          targetCandidate = withAlt.length > 0 ? withAlt[0] : pool[0];
          break;
        }
      }
    }

    if (!targetCandidate) {
      return {
        ok: false,
        error: 'PROVIDER_RESULT_TIMEOUT',
        duration_ms: Date.now() - startWait
      };
    }

    const container = targetCandidate.closest?.('[data-message-id], [data-testid*="conversation-turn"], article, [data-message-author-role]') ?? targetCandidate.parentElement;
    const containerFingerprint = getContainerFingerprint(targetCandidate);

    let candidateOrdinal = 0;
    if (container?.querySelectorAll) {
      const containerImgs = Array.from(container.querySelectorAll('img'));
      const idx = containerImgs.indexOf(targetCandidate);
      if (idx >= 0) candidateOrdinal = idx;
    }
    const candidateAlt = (targetCandidate.getAttribute?.('alt') || '').trim();

    return {
      ok: true,
      schema_version: 2,
      job_id: message.job_id,
      run_id: message.run_id,
      slot_key: message.slot_key || 'featured',
      prompt_version: message.prompt_version,
      prompt_hash: message.prompt_hash,
      provider_conversation_id: sessionId,
      provider_response_id: container?.getAttribute?.('data-message-id') || null,
      submitted_at: submittedAt,
      identified_at: new Date().toISOString(),
      source_fingerprint: fingerprintImg(targetCandidate),
      containerFingerprint,
      candidate_ordinal: candidateOrdinal,
      candidate_alt: candidateAlt,
      baseline_image_count: baselineImages.length
    };
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

  async function controlledCapture(message, root = (typeof document !== 'undefined' ? document : null)) {
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
    const allImgs = getAllImages(root);

    if (allImgs.length === 0) {
      return { ok: false, error: 'CAPTURE_TARGET_MISSING' };
    }

    // Initial match: filter by exact source_fingerprint and/or containerFingerprint
    let matches = allImgs;
    if (expectedFp) {
      matches = matches.filter((el) => fingerprintImg(el) === expectedFp);
    }
    if (expectedContainerFp) {
      matches = matches.filter((el) => getContainerFingerprint(el) === expectedContainerFp);
    }

    if (matches.length === 0) {
      return { ok: false, error: 'CAPTURE_TARGET_MISSING' };
    }

    // If more than 1 candidate matches the source & container fingerprints,
    // disambiguate between decorative/hidden/blur clones vs the primary generated image:
    if (matches.length > 1) {
      // 1. Candidate alt filter (if recorded in descriptor and non-empty)
      if (provider_result.candidate_alt) {
        const altMatches = matches.filter((el) => (el.getAttribute?.('alt') || '').trim() === provider_result.candidate_alt);
        if (altMatches.length === 1) {
          matches = altMatches;
        } else if (altMatches.length > 1) {
          matches = altMatches;
        }
      }

      // 2. Filter decorative / hidden clones:
      // ChatGPT renders aria-hidden="true" on layout placeholders and blurred backdrop clones.
      if (matches.length > 1) {
        const nonDecorative = matches.filter((el) => {
          const isAriaHidden = el.getAttribute?.('aria-hidden') === 'true' || el.closest?.('[aria-hidden="true"]') !== null;
          const isBlur = (el.className?.includes?.('blur') || el.closest?.('[class*="blur"]') !== null);
          const isOpacityZero = (el.className?.includes?.('opacity-0') || el.style?.opacity === '0');
          return !isAriaHidden && !isBlur && !isOpacityZero;
        });
        if (nonDecorative.length === 1) {
          matches = nonDecorative;
        } else if (nonDecorative.length > 1) {
          matches = nonDecorative;
        }
      }

      // 3. Semantic primary image check: descriptive non-empty alt vs empty alt=""
      if (matches.length > 1) {
        const withAlt = matches.filter((el) => (el.getAttribute?.('alt') || '').trim() !== '');
        if (withAlt.length === 1) {
          matches = withAlt;
        } else if (withAlt.length > 1) {
          matches = withAlt;
        }
      }

      // 4. Thumbnail vs full image disambiguation (if sizes differ within same container)
      if (matches.length > 1) {
        const widths = matches.map((el) => Number(el.getAttribute?.('width') || el.naturalWidth || el.width || 0));
        const maxWidth = Math.max(...widths);
        const minWidth = Math.min(...widths);
        if (maxWidth > minWidth) {
          const fullImgs = matches.filter((el) => Number(el.getAttribute?.('width') || el.naturalWidth || el.width || 0) === maxWidth);
          if (fullImgs.length === 1) {
            matches = fullImgs;
          }
        }
      }

      // 5. Candidate ordinal within container (if recorded in descriptor)
      if (matches.length > 1 && typeof provider_result.candidate_ordinal === 'number') {
        const targetEl = matches[provider_result.candidate_ordinal];
        if (targetEl) {
          matches = [targetEl];
        }
      }

      // If still ambiguous after all deterministic revalidation invariants, FAIL CLOSED!
      if (matches.length > 1) {
        return { ok: false, error: 'CAPTURE_TARGET_AMBIGUOUS', match_count: matches.length };
      }
    }

    const targetImg = matches[0];
    try {
      const capturedData = await imageToDataUrl(targetImg);
      return {
        ok: true,
        ...capturedData,
        source_fingerprint: fingerprintImg(targetImg),
        containerFingerprint: getContainerFingerprint(targetImg),
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
    getContainerFingerprint,
    getAllImages,
    controlledSubmit,
    controlledCapture
  };

  void handshake();
})();
