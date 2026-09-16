import { firstMatch, CHATGPT_SELECTORS } from './selectors.js';

export function discoverCapturePaths(root = document) {
  const download = firstMatch(root, CHATGPT_SELECTORS.downloadAffordance);
  return {
    screenshot_primary_capture: false,
    priorities: [
      { name: 'provider_download_or_asset', discoverable: Boolean(download.element) },
      { name: 'available_blob_or_binary', discoverable: false },
      { name: 'fetchable_resolved_asset', discoverable: true },
      { name: 'safe_browser_side_conversion', discoverable: true },
      { name: 'screenshot_last_resort', discoverable: true }
    ]
  };
}
