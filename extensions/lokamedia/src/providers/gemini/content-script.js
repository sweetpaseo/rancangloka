/**
 * RancangLoka LokaMedia — Gemini Content Script
 * Non-invasive DOM observer and capability responder for Google Gemini Web UI.
 * Zero cookie or credential extraction. Strictly DOM-bound.
 */

(() => {
  const GEMINI_DOM_ADAPTER_VERSION = 1;
  if (globalThis.__lokamediaGeminiProvider?.version === GEMINI_DOM_ADAPTER_VERSION) {
    void globalThis.__lokamediaGeminiProvider.handshake();
    return;
  }

  const sessionId = crypto.randomUUID();

  const GEMINI_SELECTORS = Object.freeze({
    composer: [
      'rich-textarea [contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[aria-label*="prompt" i]',
      'div[contenteditable="true"]',
      'textarea'
    ],
    sendControl: [
      'button[aria-label*="Send message" i]',
      'button[aria-label*="Kirim pesan" i]',
      'button[aria-label*="Send prompt" i]',
      'button.send-button',
      'button[mat-icon-button][aria-label*="Send" i]',
      'button[data-test-id="send-button"]',
      'button.send-button-container',
      'button[aria-label*="Submit" i]'
    ],
    stopControl: [
      'button[aria-label*="Stop response" i]',
      'button[aria-label*="Hentikan respons" i]',
      'button[aria-label*="Stop generating" i]',
      'button[aria-label*="Stop" i]',
      'button.stop-button',
      'mat-progress-bar',
      'mat-progress-spinner'
    ],
    conversationSurface: [
      'infinite-scroller',
      'chat-window',
      'main[role="main"]',
      'main',
      '.conversation-container'
    ],
    authRequired: [
      'a[href*="accounts.google.com/signin"]',
      'a[href*="accounts.google.com/ServiceLogin"]',
      'button[data-action="signin"]',
      '[data-test-id="sign-in-button"]',
      '.sign-in-prompt'
    ],
    userQuery: [
      'user-query',
      '.user-query',
      '[data-test-id="user-query"]',
      'div.query-content',
      '[data-message-author-role="user"]'
    ],
    responseBoundary: [
      'model-response',
      '.model-response-text',
      '[data-test-id="model-response"]',
      '.response-container',
      '[data-message-author-role="assistant"]'
    ],
    imageResult: [
      'img[src*="googleusercontent.com"]',
      'img[src*="lh3.googleusercontent.com"]',
      'img[src*="bard-image"]',
      'img[src^="blob:"]',
      'img[src^="data:image/"]',
      '.image-container img',
      'generated-image img',
      'image-viewer img',
      '.image-wrapper img',
      '.generated-image-container img',
      'div[data-image-id] img',
      'img[alt*="generated" i]',
      'img[alt*="Image" i]'
    ],
    downloadAffordance: [
      'button[aria-label*="Download full size" i]',
      'button[aria-label*="Unduh ukuran penuh" i]',
      'button[aria-label*="Download" i]',
      'a[download]'
    ],
    modelSelector: [
      'button[aria-label*="model" i]',
      '[data-test-id="model-selector"]',
      '.model-selector-btn',
      '.input-area-model-label',
      '.selected-model-title'
    ]
  });

  function firstMatch(root, selectors = []) {
    for (const selector of selectors) {
      try {
        const element = root.querySelector?.(selector);
        if (element) return { selector, element };
      } catch (_) {}
    }
    return { selector: null, element: null };
  }

  function allMatches(root, selectors = []) {
    const elements = [];
    for (const selector of selectors) {
      try {
        const matched = root.querySelectorAll?.(selector);
        if (matched?.length) {
          elements.push(...Array.from(matched).map((element) => ({ selector, element })));
        }
      } catch (_) {}
    }
    return elements;
  }

  function count(selectors, root = (typeof document !== 'undefined' ? document : null)) {
    return allMatches(root, selectors).length;
  }

  function isExcludedImage(element) {
    if (!element) return true;
    const alt = (element.getAttribute?.('alt') || '').toLowerCase();
    const src = (element.getAttribute?.('src') || '').toLowerCase();
    const className = String(element.className || '').toLowerCase();

    if (alt.includes('profile') || alt.includes('user') || alt.includes('avatar') || alt.includes('icon') || alt.includes('logo')) return true;
    if (src.includes('avatar') || src.includes('photos/private') || src.includes('googleusercontent.com/ogw') || src.includes('favicon')) return true;
    if (className.includes('avatar') || className.includes('profile') || className.includes('icon')) return true;

    if (element.getAttribute?.('aria-hidden') === 'true' || element.closest?.('[aria-hidden="true"]')) return true;
    if (element.style?.display === 'none' || element.style?.visibility === 'hidden' || element.style?.opacity === '0') return true;

    const width = Number(element.getAttribute?.('width') || element.naturalWidth || element.width || 0);
    const height = Number(element.getAttribute?.('height') || element.naturalHeight || element.height || 0);
    if ((width > 0 && width < 120) || (height > 0 && height < 120)) return true;

    return false;
  }

  function hashText(value = '') {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function normalizeSource(src = '') {
    try {
      const url = new URL(src, 'https://gemini.google.com');
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return src.split('?')[0].split('#')[0];
    }
  }

  function getContainerFingerprint(element) {
    const container = element.closest?.('model-response, [data-test-id*="model-response"], .response-container, [data-message-author-role], article') ?? element.parentElement;
    return hashText([
      container?.getAttribute?.('data-message-id') ?? '',
      container?.getAttribute?.('data-test-id') ?? '',
      container?.className ?? '',
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
      element.getAttribute?.('alt') || ''
    ].join('|');
    return `img_gemini_${hashText(basis)}`;
  }

  function getAllImages(root = (typeof document !== 'undefined' ? document : null)) {
    if (!root?.querySelectorAll) return [];
    const rawMatches = allMatches(root, GEMINI_SELECTORS.imageResult);
    const unique = [];
    const seen = new Set();
    for (const item of rawMatches) {
      const el = item.element;
      if (el && !seen.has(el) && !isExcludedImage(el)) {
        seen.add(el);
        unique.push(el);
      }
    }
    return unique;
  }

  async function sha256Hex(buffer) {
    if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
      try {
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (_) {}
    }
    return null;
  }

  async function imageToDataUrl(imgElement) {
    if (!imgElement) throw new Error('IMG_ELEMENT_MISSING');
    const src = imgElement.getAttribute?.('src') || imgElement.src || '';
    const width = imgElement.naturalWidth || imgElement.width || 1024;
    const height = imgElement.naturalHeight || imgElement.height || 1024;

    // 1. Data URL source
    if (src.startsWith('data:')) {
      const parts = src.split(',');
      const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/png';
      const base64 = parts[1] || '';
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        u8[i] = binaryStr.charCodeAt(i);
      }
      const hash = await sha256Hex(u8.buffer);
      return {
        data_url: src,
        mime,
        width,
        height,
        byte_size: len,
        sha256: hash,
        provenance: 'DOM_IMG_ELEMENT',
        is_canonical_original: true
      };
    }

    // 2. Fetch URL source (blob: or https://)
    if (src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://')) {
      try {
        const res = await fetch(src);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const mime = res.headers?.get?.('content-type') || 'image/png';
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const chunk = 8192;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
          }
          const base64 = btoa(binary);
          const dataUrl = `data:${mime};base64,${base64}`;
          const hash = await sha256Hex(buffer);
          return {
            data_url: dataUrl,
            mime,
            width,
            height,
            byte_size: buffer.byteLength,
            sha256: hash,
            provenance: 'DOM_IMG_ELEMENT',
            is_canonical_original: true
          };
        }
      } catch (_) {}
    }

    // 3. Canvas Fallback
    if (typeof document !== 'undefined' && document.createElement) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext?.('2d');
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
            const base64 = dataUrl.split(',')[1] || '';
            const binaryStr = atob(base64);
            const len = binaryStr.length;
            const u8 = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              u8[i] = binaryStr.charCodeAt(i);
            }
            const hash = await sha256Hex(u8.buffer);
            return {
              data_url: dataUrl,
              mime: 'image/png',
              width,
              height,
              byte_size: len,
              sha256: hash,
              provenance: 'CANVAS_REENCODED',
              is_canonical_original: false
            };
          }
        }
      } catch (_) {}
    }

    // 4. URL fallback for background worker privileged fetch (bypasses content-script CORS and canvas tainting)
    if (src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:'))) {
      return {
        data_url: null,
        src,
        mime: 'image/png',
        width,
        height,
        byte_size: 0,
        sha256: null,
        provenance: 'DOM_IMG_ELEMENT_URL',
        is_canonical_original: true
      };
    }

    throw new Error('CAPTURE_BINARY_UNAVAILABLE');
  }

  function setComposerValue(element, value) {
    if (!element) return;
    if (element.matches?.('textarea')) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement?.prototype || {}, 'value')?.set;
      if (setter) {
        setter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (element.isContentEditable || element.getAttribute?.('contenteditable') !== 'false') {
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
          const inputEvt = typeof InputEvent !== 'undefined' ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }) : (typeof Event !== 'undefined' ? new Event('input', { bubbles: true }) : { type: 'input' });
          element.dispatchEvent(inputEvt);
          element.dispatchEvent(typeof Event !== 'undefined' ? new Event('change', { bubbles: true }) : { type: 'change' });
          return;
        }
      } catch {}
      const lines = String(value).split('\n');
      if (lines.length > 1 && typeof document !== 'undefined' && document.createElement) {
        element.innerHTML = '';
        for (const line of lines) {
          const p = document.createElement('p');
          p.textContent = line || '';
          element.appendChild(p);
        }
      } else {
        element.textContent = value;
      }
      const fallbackEvt = typeof InputEvent !== 'undefined' ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }) : (typeof Event !== 'undefined' ? new Event('input', { bubbles: true }) : { type: 'input' });
      element.dispatchEvent(fallbackEvt);
      element.dispatchEvent(typeof Event !== 'undefined' ? new Event('input', { bubbles: true }) : { type: 'input' });
      element.dispatchEvent(typeof Event !== 'undefined' ? new Event('change', { bubbles: true }) : { type: 'change' });
      return;
    }
    element.textContent = value;
    element.dispatchEvent(typeof Event !== 'undefined' ? new Event('input', { bubbles: true }) : { type: 'input' });
    element.dispatchEvent(typeof Event !== 'undefined' ? new Event('change', { bubbles: true }) : { type: 'change' });
  }

  function verifyComposerContent(element, expectedText) {
    if (!element) return false;
    const actual = (element.innerText || element.textContent || element.value || '').trim();
    const expected = (expectedText || '').trim();
    if (!actual || !expected) return false;
    const normActual = actual.replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
    const normExpected = expected.replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
    return normActual.includes(normExpected) || normActual.slice(0, 80) === normExpected.slice(0, 80);
  }

  async function waitForSendControl(root = (typeof document !== 'undefined' ? document : null), timeoutMs = 3000) {
    if (!root) return null;
    const findSend = () => {
      const match = firstMatch(root, GEMINI_SELECTORS.sendControl);
      const btn = match.element;
      if (!btn) return null;
      const isVoice = /voice|dictate|speech|mic/i.test(btn.getAttribute?.('aria-label') || btn.getAttribute?.('data-test-id') || btn.className || '');
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

  let activeSubmissionState = null;

  async function controlledSubmit(message, root = (typeof document !== 'undefined' ? document : null)) {
    // Stage 1: COMMAND_RECEIVED
    if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('gemini.google.com')) {
      return { ok: false, error: 'NOT_A_GEMINI_TAB', stage: 'COMMAND_RECEIVED', submission_escaped: false };
    }

    const caps = detect(root);
    if (caps.auth_state === 'AUTH_REQUIRED') {
      return { ok: false, error: 'AUTH_REQUIRED', stage: 'COMMAND_RECEIVED', capabilities: caps, submission_escaped: false };
    }
    if (caps.dom_status !== 'SUPPORTED' || !caps.capabilities.COMPOSER_PRESENT || !caps.capabilities.COMPOSER_EDITABLE) {
      return { ok: false, error: 'COMPOSER_UNAVAILABLE', stage: 'COMMAND_RECEIVED', capabilities: caps, submission_escaped: false };
    }

    const composer = firstMatch(root, GEMINI_SELECTORS.composer);
    if (!composer.element) {
      return { ok: false, error: 'COMPOSER_NOT_FOUND', stage: 'COMMAND_RECEIVED', capabilities: caps, submission_escaped: false };
    }

    if (!message.prompt || !message.job_id) {
      return { ok: false, error: 'INVALID_SUBMIT_CONTRACT', stage: 'COMMAND_RECEIVED', submission_escaped: false };
    }

    // Pre-submission image & user query baseline
    const baselineImages = getAllImages(root);
    const baselineFps = new Set(baselineImages.map((el) => fingerprintImg(el)));
    const initialUserCount = count(GEMINI_SELECTORS.userQuery, root);
    const initialResponseCount = count(GEMINI_SELECTORS.responseBoundary, root);

    // Stage 2: PROMPT_INSERTED
    setComposerValue(composer.element, message.prompt);
    if (!verifyComposerContent(composer.element, message.prompt)) {
      return { ok: false, error: 'PROMPT_INSERTION_VERIFICATION_FAILED', stage: 'PROMPT_INSERTED', capabilities: detect(root), submission_escaped: false };
    }

    // Stage 3: SUBMISSION_ATTEMPTED
    const sendControl = await waitForSendControl(root, 3000);
    if (!sendControl) {
      const anySend = firstMatch(root, GEMINI_SELECTORS.sendControl).element;
      const isDis = anySend && (anySend.disabled || anySend.getAttribute?.('aria-disabled') === 'true');
      return {
        ok: false,
        error: isDis ? 'SEND_CONTROL_DISABLED' : 'SEND_CONTROL_UNAVAILABLE',
        stage: 'PROMPT_INSERTED',
        capabilities: detect(root),
        submission_escaped: false
      };
    }

    sendControl.click();
    const submittedAt = new Date().toISOString();

    // Stage 4: SUBMISSION_CONFIRMED
    const verifyStart = Date.now();
    let submissionConfirmed = false;
    let evidence = {};

    while (Date.now() - verifyStart < 5000) {
      await new Promise((r) => setTimeout(r, 100));
      const currentUserCount = count(GEMINI_SELECTORS.userQuery, root);
      const composerText = (composer.element.innerText || composer.element.value || '').trim();
      const stopControl = firstMatch(root, GEMINI_SELECTORS.stopControl).element;

      if (currentUserCount > initialUserCount || composerText === '' || stopControl) {
        submissionConfirmed = true;
        evidence = {
          user_turn_confirmed: currentUserCount > initialUserCount,
          composer_cleared: composerText === '',
          stop_control_detected: Boolean(stopControl)
        };
        break;
      }
    }

    if (!submissionConfirmed) {
      const remainingComposerText = (composer.element.innerText || composer.element.value || '').trim();
      if (remainingComposerText !== '') {
        // Prompt is still sitting in composer, send did not happen
        return {
          ok: false,
          error: 'SUBMISSION_VERIFICATION_FAILED',
          stage: 'SUBMISSION_ATTEMPTED',
          submission_escaped: false
        };
      }
      // Composer cleared but no confirmation yet: uncertain post-click state, must not re-submit
      return {
        ok: false,
        error: 'SUBMISSION_UNCERTAIN',
        stage: 'SUBMISSION_ATTEMPTED',
        submission_escaped: true
      };
    }

    activeSubmissionState = {
      job_id: message.job_id,
      run_id: message.run_id,
      slot_key: message.slot_key || 'featured',
      prompt_version: message.prompt_version,
      prompt_hash: message.prompt_hash,
      submitted_at: submittedAt,
      baseline_fps: baselineFps,
      baseline_count: baselineFps.size,
      initial_response_count: initialResponseCount
    };

    return {
      ok: true,
      submission_stage: 'SUBMISSION_CONFIRMED',
      stage: 'SUBMISSION_CONFIRMED',
      job_id: message.job_id,
      run_id: message.run_id,
      slot_key: message.slot_key || 'featured',
      provider_id: 'GEMINI_BROWSER',
      provider_name: 'Google Gemini',
      submitted_at: submittedAt,
      baseline_image_count: baselineFps.size,
      evidence
    };
  }

  async function observeGeneration(message = {}, root = (typeof document !== 'undefined' ? document : null)) {
    const baselineFps = activeSubmissionState?.baseline_fps || new Set();
    const currentImages = getAllImages(root);
    const newImages = currentImages.filter((el) => !baselineFps.has(fingerprintImg(el)));

    if (newImages.length > 0) {
      const target = newImages[newImages.length - 1];
      const src = target.currentSrc || target.src || target.getAttribute?.('src') || '';
      const fp = fingerprintImg(target);
      const containerFp = getContainerFingerprint(target);
      const width = target.naturalWidth || target.width || 1024;
      const height = target.naturalHeight || target.height || 1024;

      return {
        ok: true,
        status: 'IMAGE_DETECTED',
        job_id: message.job_id || activeSubmissionState?.job_id,
        run_id: message.run_id || activeSubmissionState?.run_id,
        slot_key: message.slot_key || activeSubmissionState?.slot_key || 'featured',
        source_fingerprint: fp,
        containerFingerprint: containerFp,
        width,
        height,
        src,
        alt: target.getAttribute?.('alt') || '',
        identified_at: new Date().toISOString()
      };
    }

    // Check if Gemini completed a text-only response (e.g. model cannot generate images)
    const responses = allMatches(root, GEMINI_SELECTORS.responseBoundary);
    const initialRespCount = activeSubmissionState?.initial_response_count ?? 0;
    const stopControl = firstMatch(root, GEMINI_SELECTORS.stopControl).element;

    if (!stopControl && responses.length > initialRespCount) {
      const latestResp = responses[responses.length - 1]?.element;
      const text = (latestResp?.innerText || latestResp?.textContent || '').trim();
      if (text.length > 0) {
        return {
          ok: false,
          error: 'TEXT_ONLY_RESPONSE_DETECTED',
          status: 'TEXT_ONLY',
          text_snippet: text.slice(0, 200),
          reason: 'Gemini completed response with text only. No image candidate was generated.'
        };
      }
    }

    return {
      ok: true,
      status: 'GENERATING',
      job_id: message.job_id || activeSubmissionState?.job_id,
      run_id: message.run_id || activeSubmissionState?.run_id
    };
  }

  function detect(root = (typeof document !== 'undefined' ? document : null)) {
    if (!root) return { dom_status: 'UNSUPPORTED', auth_state: 'UNKNOWN', capabilities: {} };
    const authControl = firstMatch(root, GEMINI_SELECTORS.authRequired);
    const composer = firstMatch(root, GEMINI_SELECTORS.composer);
    const sendControl = firstMatch(root, GEMINI_SELECTORS.sendControl);
    const conversationSurface = firstMatch(root, GEMINI_SELECTORS.conversationSurface);
    const responses = allMatches(root, GEMINI_SELECTORS.responseBoundary);
    const rawImages = allMatches(root, GEMINI_SELECTORS.imageResult);
    const images = rawImages.filter((item) => !isExcludedImage(item.element));
    const download = firstMatch(root, GEMINI_SELECTORS.downloadAffordance);
    const modelControl = firstMatch(root, GEMINI_SELECTORS.modelSelector);
    const modelText = (modelControl.element?.innerText || modelControl.element?.textContent || '').trim();

    const authenticated = !authControl.element && Boolean(conversationSurface.element || composer.element);
    const isTextArea = Boolean(composer.element?.matches?.('textarea') || composer.element?.tagName === 'TEXTAREA');
    const isContentEditable = Boolean(
      composer.element?.getAttribute?.('contenteditable') === 'true' ||
      composer.element?.getAttribute?.('contenteditable') === '' ||
      composer.element?.getAttribute?.('contenteditable') === 'plaintext-only' ||
      composer.element?.isContentEditable
    );
    const isDisabled = Boolean(
      composer.element?.disabled ||
      composer.element?.hasAttribute?.('disabled') ||
      composer.element?.getAttribute?.('aria-disabled') === 'true'
    );
    const composerEditable = Boolean(composer.element && (isTextArea || isContentEditable) && !isDisabled);

    const domSupported = Boolean(authControl.element || (conversationSurface.element && composer.element && composerEditable));

    return {
      provider_id: 'GEMINI_BROWSER',
      adapter_version: GEMINI_DOM_ADAPTER_VERSION,
      auth_state: authControl.element ? 'AUTH_REQUIRED' : authenticated ? 'AUTHENTICATED' : 'UNKNOWN',
      dom_status: domSupported ? 'SUPPORTED' : 'UNSUPPORTED',
      error_code: domSupported ? null : 'DOM_CONTRACT_UNSUPPORTED',
      capabilities: {
        COMPOSER_PRESENT: Boolean(composer.element),
        COMPOSER_EDITABLE: composerEditable,
        SEND_CONTROL_PRESENT: Boolean(sendControl.element),
        CONVERSATION_SURFACE_PRESENT: Boolean(conversationSurface.element),
        RESPONSE_SURFACE_DISCOVERABLE: responses.length > 0,
        IMAGE_RESULT_SURFACE_DISCOVERABLE: images.length > 0,
        DOWNLOAD_CAPABILITY_DISCOVERABLE: Boolean(download.element),
        AUTHENTICATED: authenticated,
        AUTH_REQUIRED: Boolean(authControl.element),
        MODEL_INDICATOR_PRESENT: Boolean(modelControl.element),
        MODEL_NAME: modelText || null
      },
      selectors: {
        composer: composer.selector,
        send_control: sendControl.selector,
        conversation_surface: conversationSurface.selector,
        download: download.selector,
        model_selector: modelControl.selector
      },
      response_count: responses.length,
      image_candidate_count: images.length,
      image_candidates: images.map((item, idx) => ({
        index: idx,
        src: item.element?.getAttribute?.('src') || '',
        alt: item.element?.getAttribute?.('alt') || '',
        width: item.element?.naturalWidth || item.element?.width || 0,
        height: item.element?.naturalHeight || item.element?.height || 0
      })),
      prompt_submission_enabled: false
    };
  }

  function send(type, payload = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      return chrome.runtime.sendMessage({
        id: crypto.randomUUID(),
        provider: 'gemini',
        type,
        version: GEMINI_DOM_ADAPTER_VERSION,
        session_id: sessionId,
        ...payload
      });
    }
  }

  async function handshake() {
    try {
      await send('GEMINI_PROVIDER_HELLO', { capabilities: detect() });
    } catch (_) {}
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.provider !== 'gemini' || message?.version !== GEMINI_DOM_ADAPTER_VERSION) return false;

      if (message.type === 'GEMINI_PROVIDER_DIAGNOSTIC') {
        sendResponse({ ok: true, capabilities: detect(), session_id: sessionId });
        return true;
      }

      if (message.type === 'GEMINI_PROVIDER_CONTROLLED_SUBMIT') {
        void controlledSubmit(message)
          .then(sendResponse)
          .catch((err) => sendResponse({ ok: false, error: String(err?.message || err || 'SUBMIT_FAILED'), submission_escaped: false }));
        return true;
      }

      if (message.type === 'GEMINI_PROVIDER_OBSERVE_GENERATION') {
        void observeGeneration(message)
          .then(sendResponse)
          .catch((err) => sendResponse({ ok: false, error: String(err?.message || err || 'OBSERVE_FAILED') }));
        return true;
      }

      if (message.type === 'GEMINI_PROVIDER_CAPTURE' || message.type === 'GEMINI_PROVIDER_CAPTURE_LATEST') {
        (async () => {
          const root = typeof document !== 'undefined' ? document : null;
          const diag = detect(root);
          if (diag.image_candidate_count === 0) {
            sendResponse({ ok: false, error: 'NO_IMAGE_CANDIDATE_FOUND' });
            return;
          }
          const rawMatches = allMatches(root, GEMINI_SELECTORS.imageResult).filter((item) => !isExcludedImage(item.element));
          const targetItem = rawMatches[rawMatches.length - 1];
          if (!targetItem?.element) {
            sendResponse({ ok: false, error: 'NO_IMAGE_CANDIDATE_FOUND' });
            return;
          }

          try {
            const captured = await imageToDataUrl(targetItem.element);
            sendResponse({
              ok: true,
              ...captured,
              candidate: {
                ...captured,
                job_id: message.job_id,
                run_id: message.run_id,
                slot_key: message.slot_key || 'featured',
                provider_id: 'GEMINI_BROWSER'
              },
              job_id: message.job_id,
              run_id: message.run_id,
              slot_key: message.slot_key || 'featured'
            });
          } catch (err) {
            sendResponse({ ok: false, error: err?.message || 'CAPTURE_FAILED' });
          }
        })();
        return true;
      }

      return false;
    });
  }

  globalThis.__lokamediaGeminiProvider = {
    version: GEMINI_DOM_ADAPTER_VERSION,
    detect,
    imageToDataUrl,
    handshake,
    controlledSubmit,
    observeGeneration,
    setComposerValue,
    verifyComposerContent,
    waitForSendControl,
    fingerprintImg,
    getAllImages,
    isExcludedImage
  };

  void handshake();
})();
