/**
 * RancangLoka LokaMedia — Gemini DOM Selectors
 * Non-invasive selector queries for observing Gemini Web UI.
 */

export const GEMINI_SELECTORS = Object.freeze({
  composer: [
    'rich-textarea [contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="prompt"]',
    'div[contenteditable="true"]',
    'textarea'
  ],
  sendControl: [
    'button[aria-label*="Send message"]',
    'button[aria-label*="Kirim pesan"]',
    'button[aria-label*="Send prompt"]',
    'button.send-button',
    'button[mat-icon-button][aria-label*="Send"]',
    'button[data-test-id="send-button"]'
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
  responseBoundary: [
    'model-response',
    '.model-response-text',
    '[data-test-id="model-response"]',
    '.response-container'
  ],
  imageResult: [
    'img[src*="googleusercontent.com"]',
    'img[src^="blob:"]',
    '.image-container img',
    'generated-image img',
    'image-viewer img',
    'img[alt*="generated" i]',
    'img[alt*="Image" i]'
  ],
  downloadAffordance: [
    'button[aria-label*="Download full size"]',
    'button[aria-label*="Unduh ukuran penuh"]',
    'button[aria-label*="Download"]',
    'a[download]'
  ],
  userQuery: [
    'user-query',
    '.user-query',
    '[data-test-id="user-query"]',
    'div.query-content',
    '[data-message-author-role="user"]'
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
  modelSelector: [
    'button[aria-label*="model" i]',
    '[data-test-id="model-selector"]',
    '.model-selector-btn',
    '.input-area-model-label',
    '.selected-model-title'
  ]
});

export function firstMatch(root, selectors = []) {
  for (const selector of selectors) {
    try {
      const element = root.querySelector?.(selector);
      if (element) return { selector, element };
    } catch (_) {}
  }
  return { selector: null, element: null };
}

export function allMatches(root, selectors = []) {
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
