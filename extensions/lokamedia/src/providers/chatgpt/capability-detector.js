import { CHATGPT_DOM_ADAPTER_VERSION, CHATGPT_ERROR_CODES, PROMPT_SUBMISSION_ENABLED } from './constants.js';
import { inventoryImageCandidates } from './candidate-discovery.js';
import { allMatches, firstMatch, CHATGPT_SELECTORS } from './selectors.js';

export function detectChatGptCapabilities(root = document) {
  const authControl = firstMatch(root, CHATGPT_SELECTORS.authRequired);
  const composer = firstMatch(root, CHATGPT_SELECTORS.composer);
  const sendControl = firstMatch(root, CHATGPT_SELECTORS.sendControl);
  const conversationSurface = firstMatch(root, CHATGPT_SELECTORS.conversationSurface);
  const responses = allMatches(root, CHATGPT_SELECTORS.responseBoundary);
  const images = inventoryImageCandidates(root);
  const download = firstMatch(root, CHATGPT_SELECTORS.downloadAffordance);

  const authenticated = !authControl.element && Boolean(conversationSurface.element || composer.element);
  const composerEditable = Boolean(
    composer.element &&
      (composer.element.matches?.('textarea') ||
        composer.element.getAttribute?.('contenteditable') === 'true' ||
        !composer.element.hasAttribute?.('disabled'))
  );
  const domSupported = Boolean(authControl.element || (conversationSurface.element && composer.element));

  return {
    adapter_version: CHATGPT_DOM_ADAPTER_VERSION,
    auth_state: authControl.element ? 'AUTH_REQUIRED' : authenticated ? 'AUTHENTICATED' : 'UNKNOWN',
    dom_status: domSupported ? 'SUPPORTED' : 'UNSUPPORTED',
    error_code: domSupported ? null : CHATGPT_ERROR_CODES.DOM_CONTRACT_UNSUPPORTED,
    capabilities: {
      COMPOSER_PRESENT: Boolean(composer.element),
      COMPOSER_EDITABLE: composerEditable,
      SEND_CONTROL_PRESENT: Boolean(sendControl.element),
      CONVERSATION_SURFACE_PRESENT: Boolean(conversationSurface.element),
      RESPONSE_SURFACE_DISCOVERABLE: responses.length > 0,
      IMAGE_RESULT_SURFACE_DISCOVERABLE: images.length > 0,
      DOWNLOAD_CAPABILITY_DISCOVERABLE: Boolean(download.element),
      AUTHENTICATED: authenticated,
      AUTH_REQUIRED: Boolean(authControl.element)
    },
    selectors: {
      composer: composer.selector,
      send_control: sendControl.selector,
      conversation_surface: conversationSurface.selector,
      download: download.selector
    },
    response_count: responses.length,
    image_candidate_count: images.length,
    image_candidates: images,
    prompt_submission_enabled: PROMPT_SUBMISSION_ENABLED
  };
}
