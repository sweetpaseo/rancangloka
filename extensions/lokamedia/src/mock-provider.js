import { IMAGE_CAPTURE_CONCURRENCY, PROVIDER_GENERATION_CONCURRENCY } from './constants.js';

function bytesFromText(text) {
  return new TextEncoder().encode(text).buffer;
}

export class MockProviderAdapter {
  constructor() {
    this.generationConcurrency = PROVIDER_GENERATION_CONCURRENCY;
    this.captureConcurrency = IMAGE_CAPTURE_CONCURRENCY;
    this.calls = [];
  }

  async generate(job) {
    this.calls.push({ type: 'generate', job_id: job.job_id });
    const fp = `mock-fingerprint-${job.job_id}`;
    return {
      job_id: job.job_id,
      run_id: job.run_id,
      slot_key: job.slot_key,
      prompt_version: job.prompt_version ?? 1,
      prompt_hash: job.prompt_hash ?? null,
      provider_conversation_id: `mock-conversation-${job.job_id}`,
      provider_response_id: `mock-response-${job.job_id}`,
      submitted_at: new Date().toISOString(),
      identified_at: new Date().toISOString(),
      fingerprint: fp,
      source_fingerprint: fp,
      containerFingerprint: `mock-container-${job.job_id}`
    };
  }

  async capture(job) {
    this.calls.push({ type: 'capture', job_id: job.job_id });
    const bytes = bytesFromText(`lokamedia:${job.job_id}:${job.prompt_hash ?? 'no-hash'}`);
    return {
      bytes,
      size: bytes.byteLength,
      mime: 'image/png',
      width: job.target_width ?? 1024,
      height: job.target_height ?? 768,
      sha256: job.client_sha256 ?? `sha256-${job.job_id}`,
      blobKey: `${job.job_id}:sha256-${job.job_id}`
    };
  }
}
