/**
 * RancangLoka LokaMedia — Gemini Capability Detector
 * Evaluates Gemini Web UI DOM contract and session readiness.
 */

import { GEMINI_DOM_ADAPTER_VERSION, GEMINI_ERROR_CODES } from './constants.js';
import { allMatches, firstMatch, GEMINI_SELECTORS } from './selectors.js';

export function isExcludedImage(element) {
  if (!element) return true;
  const alt = (element.getAttribute?.('alt') || '').toLowerCase();
  const src = (element.getAttribute?.('src') || '').toLowerCase();
  const className = String(element.className || '').toLowerCase();

  if (alt.includes('profile') || alt.includes('user') || alt.includes('avatar') || alt.includes('icon')) return true;
  if (src.includes('avatar') || src.includes('photos/private') || src.includes('googleusercontent.com/ogw')) return true;
  if (className.includes('avatar') || className.includes('profile') || className.includes('icon')) return true;

  const width = Number(element.getAttribute?.('width') || element.naturalWidth || element.width || 0);
  const height = Number(element.getAttribute?.('height') || element.naturalHeight || element.height || 0);
  if ((width > 0 && width < 120) || (height > 0 && height < 120)) return true;

  return false;
}

export function detectGeminiCapabilities(root = document) {
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
    error_code: domSupported ? null : GEMINI_ERROR_CODES.DOM_CONTRACT_UNSUPPORTED,
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
