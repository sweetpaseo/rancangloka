function cloneBytes(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes.slice(0);
  if (ArrayBuffer.isView(bytes)) return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  if (bytes?.arrayBuffer) return bytes.arrayBuffer();
  throw new Error('Unsupported blob bytes');
}

export class MemoryBlobStore {
  constructor() {
    this.records = new Map();
  }

  async put(record) {
    const bytes = await cloneBytes(record.bytes);
    const size = record.size ?? bytes.byteLength;
    this.records.set(record.key, { ...record, bytes, size, createdAt: record.createdAt ?? new Date().toISOString() });
    return { key: record.key, size };
  }

  async get(key) {
    const record = this.records.get(key);
    if (!record) return null;
    return { ...record, bytes: await cloneBytes(record.bytes) };
  }

  async delete(key) {
    this.records.delete(key);
  }

  async list() {
    return [...this.records.values()].map(({ bytes, ...record }) => ({ ...record }));
  }

  async stats() {
    const records = await this.list();
    return {
      count: records.length,
      bytes: records.reduce((sum, record) => sum + (record.size ?? 0), 0)
    };
  }
}

export const BLOB_STORE_SCHEMA_VERSION_BEFORE = 2;
export const BLOB_STORE_SCHEMA_VERSION = 3;
export const CAPTURED_BLOBS_STORE_NAME = 'captured-blobs';
export const DERIVATIVE_STORE_NAME = 'media-derivatives';

export class BlobStoreSchemaError extends Error {
  constructor(message = 'Blob store schema unavailable', options = {}) {
    super(message);
    this.name = 'BlobStoreSchemaError';
    this.code = options.code || 'BLOB_STORE_SCHEMA_UNAVAILABLE';
    if (options.cause) this.cause = options.cause;
  }
}

export class IndexedDbBlobStore {
  constructor({
    dbName = 'lokamedia-extension',
    storeName = CAPTURED_BLOBS_STORE_NAME,
    version = BLOB_STORE_SCHEMA_VERSION,
    idb = null
  } = {}) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
    this.idb = idb;
  }

  getIdb() {
    return this.idb || globalThis.indexedDB;
  }

  open() {
    const idb = this.getIdb();
    if (!idb) {
      return Promise.reject(new BlobStoreSchemaError('IndexedDB is not available in current environment'));
    }

    return new Promise((resolve, reject) => {
      let request;
      try {
        request = idb.open(this.dbName, this.version);
      } catch (err) {
        reject(new BlobStoreSchemaError(err.message, { cause: err }));
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        // Forward-only migration: ensure captured-blobs exists (v2)
        if (!db.objectStoreNames.contains(CAPTURED_BLOBS_STORE_NAME)) {
          db.createObjectStore(CAPTURED_BLOBS_STORE_NAME, { keyPath: 'key' });
        }
        // Ensure media-derivatives exists (v3)
        if (!db.objectStoreNames.contains(DERIVATIVE_STORE_NAME)) {
          const store = db.createObjectStore(DERIVATIVE_STORE_NAME, { keyPath: 'derivative_id' });
          store.createIndex('transform_id', 'transform_id', { unique: true });
          store.createIndex('job_id', 'job_id', { unique: false });
          store.createIndex('source_blob_key', 'source_blob_key', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // Schema integrity verification: ensure required store actually exists.
        if (!db.objectStoreNames.contains(this.storeName)) {
          try { db.close(); } catch {}
          reject(new BlobStoreSchemaError(
            `Required object store '${this.storeName}' is missing from database '${this.dbName}'`
          ));
          return;
        }
        resolve(db);
      };

      request.onerror = () => {
        const err = request.error || new Error('Failed to open IndexedDB');
        reject(new BlobStoreSchemaError(err.message, { cause: err }));
      };

      request.onblocked = () => {
        reject(new BlobStoreSchemaError(
          `IndexedDB upgrade blocked for '${this.dbName}'`,
          { code: 'BLOB_STORE_BLOCKED' }
        ));
      };
    });
  }

  async transact(mode, handler) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let tx;
      try {
        if (!db.objectStoreNames.contains(this.storeName)) {
          try { db.close(); } catch {}
          reject(new BlobStoreSchemaError(
            `Required object store '${this.storeName}' is missing from database '${this.dbName}'`
          ));
          return;
        }
        tx = db.transaction(this.storeName, mode);
      } catch (err) {
        try { db.close(); } catch {}
        if (err.name === 'NotFoundError' || err.code === 8) {
          reject(new BlobStoreSchemaError(
            `Required object store '${this.storeName}' is missing from database '${this.dbName}'`,
            { cause: err }
          ));
          return;
        }
        reject(err);
        return;
      }

      let result;
      try {
        const store = tx.objectStore(this.storeName);
        result = handler(store);
      } catch (err) {
        try { tx.abort(); } catch {}
        try { db.close(); } catch {}
        reject(err);
        return;
      }

      tx.oncomplete = () => {
        try { db.close(); } catch {}
        resolve(result && 'result' in result ? result.result : result);
      };
      tx.onerror = () => {
        try { db.close(); } catch {}
        const err = tx.error || new Error('IndexedDB transaction failed');
        if (err.name === 'NotFoundError' || err.code === 8) {
          reject(new BlobStoreSchemaError(
            `Required object store '${this.storeName}' is missing from database '${this.dbName}'`,
            { cause: err }
          ));
          return;
        }
        reject(err);
      };
      tx.onabort = () => {
        try { db.close(); } catch {}
        reject(tx.error || new Error('IndexedDB transaction aborted'));
      };
    });
  }

  async put(record) {
    const bytes = await cloneBytes(record.bytes);
    await this.transact('readwrite', (store) => store.put({ ...record, bytes, size: record.size ?? bytes.byteLength }));
    return { key: record.key, size: record.size ?? bytes.byteLength };
  }

  async get(key) {
    return this.transact('readonly', (store) => store.get(key));
  }

  async delete(key) {
    await this.transact('readwrite', (store) => store.delete(key));
  }

  async list() {
    return this.transact('readonly', (store) => store.getAll());
  }

    async stats() {
    const records = await this.list();
    return {
      count: records.length,
      bytes: records.reduce((sum, record) => sum + (record.size ?? 0), 0)
    };
  }
}

export class MemoryDerivativeStore {
  constructor() {
    this.records = new Map();
  }

  async putDerivative(record) {
    const bytes = await cloneBytes(record.bytes);
    const byteSize = record.byte_size ?? record.size ?? bytes.byteLength;
    const stored = {
      ...record,
      bytes,
      byte_size: byteSize,
      size: byteSize,
      created_at: record.created_at ?? new Date().toISOString()
    };
    this.records.set(record.derivative_id, stored);
    return { derivative_id: record.derivative_id, size: byteSize };
  }

  async getDerivative(derivativeId) {
    const record = this.records.get(derivativeId);
    if (!record) return null;
    return { ...record, bytes: await cloneBytes(record.bytes) };
  }

  async getDerivativeByTransformId(transformId) {
    for (const record of this.records.values()) {
      if (record.transform_id === transformId) {
        return { ...record, bytes: await cloneBytes(record.bytes) };
      }
    }
    return null;
  }

  async getDerivativesForJob(jobId) {
    const results = [];
    for (const record of this.records.values()) {
      if (record.job_id === jobId) {
        results.push({ ...record, bytes: await cloneBytes(record.bytes) });
      }
    }
    return results;
  }

  async deleteDerivative(derivativeId) {
    this.records.delete(derivativeId);
  }

  async listDerivatives() {
    return [...this.records.values()].map(({ bytes, ...record }) => ({ ...record }));
  }

  async stats() {
    const records = await this.listDerivatives();
    return {
      count: records.length,
      bytes: records.reduce((sum, record) => sum + (record.byte_size ?? record.size ?? 0), 0)
    };
  }
}

export class IndexedDbDerivativeStore {
  constructor({
    dbName = 'lokamedia-extension',
    storeName = DERIVATIVE_STORE_NAME,
    version = BLOB_STORE_SCHEMA_VERSION,
    idb = null
  } = {}) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
    this.idb = idb;
  }

  getIdb() {
    return this.idb || globalThis.indexedDB;
  }

  open() {
    const idb = this.getIdb();
    if (!idb) {
      return Promise.reject(new BlobStoreSchemaError('IndexedDB is not available in current environment'));
    }

    return new Promise((resolve, reject) => {
      let request;
      try {
        request = idb.open(this.dbName, this.version);
      } catch (err) {
        reject(new BlobStoreSchemaError(err.message, { cause: err }));
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        // 1. Ensure captured-blobs exists (from v2)
        if (!db.objectStoreNames.contains(CAPTURED_BLOBS_STORE_NAME)) {
          db.createObjectStore(CAPTURED_BLOBS_STORE_NAME, { keyPath: 'key' });
        }
        // 2. Ensure media-derivatives exists (v3)
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'derivative_id' });
          store.createIndex('transform_id', 'transform_id', { unique: true });
          store.createIndex('job_id', 'job_id', { unique: false });
          store.createIndex('source_blob_key', 'source_blob_key', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          try { db.close(); } catch {}
          reject(new BlobStoreSchemaError(
            `Required object store '${this.storeName}' is missing from database '${this.dbName}'`
          ));
          return;
        }
        resolve(db);
      };

      request.onerror = () => {
        const err = request.error || new Error('Failed to open IndexedDB');
        reject(new BlobStoreSchemaError(err.message, { cause: err }));
      };

      request.onblocked = () => {
        reject(new BlobStoreSchemaError(
          `IndexedDB upgrade blocked for '${this.dbName}'`,
          { code: 'BLOB_STORE_BLOCKED' }
        ));
      };
    });
  }

  async transact(mode, handler) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let tx;
      try {
        if (!db.objectStoreNames.contains(this.storeName)) {
          try { db.close(); } catch {}
          reject(new BlobStoreSchemaError(
            `Required object store '${this.storeName}' is missing from database '${this.dbName}'`
          ));
          return;
        }
        tx = db.transaction(this.storeName, mode);
      } catch (err) {
        try { db.close(); } catch {}
        reject(err);
        return;
      }

      let result;
      try {
        const store = tx.objectStore(this.storeName);
        result = handler(store);
      } catch (err) {
        try { tx.abort(); } catch {}
        try { db.close(); } catch {}
        reject(err);
        return;
      }

      tx.oncomplete = () => {
        try { db.close(); } catch {}
        resolve(result && 'result' in result ? result.result : result);
      };
      tx.onerror = () => {
        try { db.close(); } catch {}
        const err = tx.error || new Error('IndexedDB transaction failed');
        reject(err);
      };
      tx.onabort = () => {
        try { db.close(); } catch {}
        reject(tx.error || new Error('IndexedDB transaction aborted'));
      };
    });
  }

  async putDerivative(record) {
    const bytes = await cloneBytes(record.bytes);
    const byteSize = record.byte_size ?? record.size ?? bytes.byteLength;
    const stored = {
      ...record,
      bytes,
      byte_size: byteSize,
      size: byteSize,
      created_at: record.created_at ?? new Date().toISOString()
    };
    await this.transact('readwrite', (store) => store.put(stored));
    return { derivative_id: record.derivative_id, size: byteSize };
  }

  async getDerivative(derivativeId) {
    return this.transact('readonly', (store) => store.get(derivativeId));
  }

  async getDerivativeByTransformId(transformId) {
    return this.transact('readonly', (store) => {
      const index = store.index('transform_id');
      return index.get(transformId);
    });
  }

  async getDerivativesForJob(jobId) {
    return this.transact('readonly', (store) => {
      const index = store.index('job_id');
      return index.getAll(jobId);
    });
  }

  async deleteDerivative(derivativeId) {
    await this.transact('readwrite', (store) => store.delete(derivativeId));
  }

  async listDerivatives() {
    return this.transact('readonly', (store) => store.getAll());
  }

  async stats() {
    const records = await this.listDerivatives();
    return {
      count: records.length,
      bytes: records.reduce((sum, r) => sum + (r.byte_size ?? r.size ?? 0), 0)
    };
  }
}
