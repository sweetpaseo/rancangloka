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
    return {
      provider_conversation_id: `mock-conversation-${job.job_id}`,
      provider_response_id: `mock-response-${job.job_id}`,
      submitted_at: new Date().toISOString(),
      fingerprint: `mock-fingerprint-${job.job_id}`
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
