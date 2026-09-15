import { MAX_PENDING_CAPTURED_ASSETS, MAX_PENDING_CAPTURED_BYTES } from './constants.js';

export class BackpressureController {
  constructor(blobStore, {
    maxAssets = MAX_PENDING_CAPTURED_ASSETS,
    maxBytes = MAX_PENDING_CAPTURED_BYTES
  } = {}) {
    this.blobStore = blobStore;
    this.maxAssets = maxAssets;
    this.maxBytes = maxBytes;
  }

  async inspect() {
    const stats = await this.blobStore.stats();
    const blocked = stats.count >= this.maxAssets || stats.bytes >= this.maxBytes;
    return {
      blocked,
      pendingAssets: stats.count,
      pendingBytes: stats.bytes,
      maxAssets: this.maxAssets,
      maxBytes: this.maxBytes
    };
  }
}
