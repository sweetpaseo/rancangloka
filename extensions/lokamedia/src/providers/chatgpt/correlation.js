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

export function isCaptureReadyProviderResult(result, context = {}) {
  if (!result || typeof result !== 'object') return false;
  const fp = result.source_fingerprint || result.fingerprint;
  if (!fp || typeof fp !== 'string' || fp.trim() === '') return false;
  if (result.containerFingerprint !== undefined && (typeof result.containerFingerprint !== 'string' || result.containerFingerprint.trim() === '')) {
    return false;
  }
  if (context.job_id && result.job_id && result.job_id !== context.job_id) return false;
  if (context.run_id && result.run_id && result.run_id !== context.run_id) return false;
  if (context.slot_key && result.slot_key && result.slot_key !== context.slot_key) return false;
  return true;
}

export function isRecoverableResultCheckpoint(checkpoint, job = {}) {
  if (!checkpoint || typeof checkpoint !== 'object') return false;
  const fp = checkpoint.source_fingerprint || checkpoint.fingerprint;
  if (!fp || typeof fp !== 'string' || fp.trim() === '') return false;
  if (!checkpoint.containerFingerprint || typeof checkpoint.containerFingerprint !== 'string' || checkpoint.containerFingerprint.trim() === '') {
    return false;
  }
  if (job.job_id && (!checkpoint.job_id || checkpoint.job_id !== job.job_id)) return false;
  if (job.slot_key && (!checkpoint.slot_key || checkpoint.slot_key !== job.slot_key)) return false;
  if (job.prompt_hash && checkpoint.prompt_hash && checkpoint.prompt_hash !== job.prompt_hash) return false;
  if (job.prompt_version !== undefined && checkpoint.prompt_version !== undefined && checkpoint.prompt_version !== job.prompt_version) return false;
  const schemaVer = checkpoint.schema_version ?? 1;
  if (schemaVer !== 1 && schemaVer !== 2) return false;
  return true;
}
