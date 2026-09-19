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

export const BLOB_STORE_SCHEMA_VERSION = 2;

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
    storeName = 'captured-blobs',
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
        // Forward-only migration: create captured-blobs if not present.
        // Existing stores and data are preserved.
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
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
