export const CHATGPT_SELECTORS = Object.freeze({
  authRequired: [
    'a[href*="/auth/login"]',
    'button[data-testid="login-button"]',
    '[data-testid="login-button"]'
  ],
  composer: [
    'div[contenteditable="true"][data-testid*="prompt"]',
    'textarea[data-testid*="prompt"]',
    'form textarea',
    'main form div[contenteditable="true"]'
  ],
  sendControl: [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]',
    'form button[type="submit"]'
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
