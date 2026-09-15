export class ProviderLane {
  constructor(storage) {
    this.storage = storage;
  }

  async acquire(jobId) {
    return this.storage.update((state) => {
      const owner = state.locks.providerLane;
      if (owner && owner.job_id !== jobId) return false;
      state.locks.providerLane = { job_id: jobId, acquired_at: new Date().toISOString() };
      return true;
    });
  }

  async release(jobId) {
    return this.storage.update((state) => {
      if (state.locks.providerLane?.job_id === jobId) delete state.locks.providerLane;
    });
  }
}
