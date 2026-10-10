export const CHATGPT_SELECTORS = Object.freeze({
  authRequired: [
    'a[href*="/auth/login"]',
    'button[data-testid="login-button"]',
    '[data-testid="login-button"]'
  ],
  composer: [
    '#prompt-textarea',
    'div#prompt-textarea',
    '#prompt-textarea[contenteditable="true"]',
    'div[contenteditable="true"]#prompt-textarea',
    'div[contenteditable].ProseMirror',
    'div[contenteditable][role="textbox"]',
    'div[contenteditable][data-testid*="prompt"]',
    'div[contenteditable][aria-label*="Message" i]',
    'div[contenteditable][aria-label*="ChatGPT" i]',
    'div[contenteditable][aria-label*="Prompt" i]',
    '[data-testid="prompt-textarea"]',
    'textarea[data-testid*="prompt"]',
    'textarea#prompt-textarea',
    'main form div[contenteditable]',
    'form div[contenteditable]',
    'main form textarea',
    'form textarea'
  ],
  sendControl: [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-send-button"]',
    'button[data-testid*="send-button"]',
    'button[aria-label*="Send" i]',
    'button#composer-submit-button',
    'button.composer-submit-button-color',
    'form button[class*="composer-submit-button"]',
    'form button[type="submit"]',
    'button[data-testid="composer-speech-button"]',
    'button[aria-label*="Voice" i]',
    'button[aria-label*="Dictate" i]'
  ],
  conversationSurface: ['main', '[role="main"]'],
  responseBoundary: [
    '[data-message-author-role="assistant"]',
    'article:has([data-message-author-role="assistant"])',
    '[data-testid*="conversation-turn"]'
  ],
  userBoundary: ['[data-message-author-role="user"]'],
  imageCandidates: [
    '[data-message-author-role="assistant"] img',
    'main img[src]',
    'main picture img[src]'
  ],
  downloadAffordance: [
    'a[download]',
    'a[href*="download"]',
    'button[aria-label*="Download"]'
  ]
});

export function firstMatch(root, selectors) {
  for (const selector of selectors) {
    try {
      const match = root.querySelector(selector);
      if (match) return { element: match, selector };
    } catch {
      // Some fixture/browser engines may not support the full selector level.
    }
  }
  return { element: null, selector: null };
}

export function allMatches(root, selectors) {
  const matches = [];
  const seen = new Set();
  for (const selector of selectors) {
    try {
      for (const element of root.querySelectorAll(selector)) {
        if (seen.has(element)) continue;
        seen.add(element);
        matches.push({ element, selector });
      }
    } catch {
      // Ignore unsupported selector syntax and continue layered discovery.
    }
  }
  return matches;
}
