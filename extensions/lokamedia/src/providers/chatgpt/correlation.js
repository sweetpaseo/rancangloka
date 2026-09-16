import { diffImageCandidates, inventoryImageCandidates } from './candidate-discovery.js';

export function createCorrelationBaseline({ job, providerTabId, conversationId = null, root = document }) {
  return {
    job_id: job?.job_id ?? null,
    prompt_version: job?.prompt_version ?? null,
    prompt_hash: job?.prompt_hash ?? null,
    provider_tab_id: providerTabId ?? null,
    conversation_id: conversationId,
    submitted_at: null,
    response_id: null,
    generation_sequence: null,
    baseline_fingerprints: inventoryImageCandidates(root),
    created_at: new Date().toISOString()
  };
}

export function correlateImageCandidates(baseline, root = document) {
  const current = inventoryImageCandidates(root);
  return {
    ...diffImageCandidates(baseline.baseline_fingerprints ?? [], current),
    current_fingerprints: current
  };
}
