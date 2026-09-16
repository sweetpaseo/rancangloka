import { CHATGPT_ERROR_CODES } from './constants.js';
import { allMatches } from './selectors.js';
import { CHATGPT_SELECTORS } from './selectors.js';

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

export function fingerprintCandidate(candidate) {
  const normalized = normalizeSource(candidate.src || candidate.currentSrc || '');
  const basis = [
    normalized,
    candidate.width || candidate.naturalWidth || 0,
    candidate.height || candidate.naturalHeight || 0,
    candidate.containerFingerprint || '',
    candidate.assetId || ''
  ].join('|');
  return `img_${hashText(basis)}`;
}

export function inventoryImageCandidates(root, now = () => new Date().toISOString()) {
  return allMatches(root, CHATGPT_SELECTORS.imageCandidates).map(({ element, selector }, index) => {
    const container = element.closest?.('[data-message-id], [data-testid*="conversation-turn"], article, [data-message-author-role]') ?? element.parentElement;
    const containerFingerprint = hashText([
      container?.getAttribute?.('data-message-id') ?? '',
      container?.getAttribute?.('data-testid') ?? '',
      container?.getAttribute?.('data-message-author-role') ?? '',
      container?.tagName ?? ''
    ].join('|'));
    const candidate = {
      local_id: `candidate-${index + 1}`,
      selector,
      src: element.currentSrc || element.getAttribute('src') || '',
      width: Number(element.getAttribute('width') || element.naturalWidth || element.width || 0),
      height: Number(element.getAttribute('height') || element.naturalHeight || element.height || 0),
      containerFingerprint,
      observed_at: now(),
      assetId: element.getAttribute('data-asset-id') || ''
    };
    return {
      ...candidate,
      source_fingerprint: fingerprintCandidate(candidate)
    };
  });
}

export function diffImageCandidates(baseline, current) {
  const baselineFingerprints = new Set(baseline.map((item) => item.source_fingerprint));
  const fresh = current.filter((item) => !baselineFingerprints.has(item.source_fingerprint));
  if (fresh.length === 0) return { status: CHATGPT_ERROR_CODES.NO_NEW_IMAGE, candidates: [] };
  const unique = new Set(fresh.map((item) => item.source_fingerprint));
  if (fresh.length > 1 && unique.size !== fresh.length) {
    return { status: CHATGPT_ERROR_CODES.AMBIGUOUS_IMAGE_CANDIDATE, candidates: fresh };
  }
  if (fresh.length > 1) return { status: CHATGPT_ERROR_CODES.AMBIGUOUS_IMAGE_CANDIDATE, candidates: fresh };
  return { status: 'ONE_NEW_IMAGE', candidates: fresh };
}
