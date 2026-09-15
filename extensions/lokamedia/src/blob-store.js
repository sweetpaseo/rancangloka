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

export class IndexedDbBlobStore {
  constructor({ dbName = 'lokamedia-extension', storeName = 'captured-blobs' } = {}) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async transact(mode, handler) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      const result = handler(store);
      tx.oncomplete = () => resolve(result?.result ?? result);
      tx.onerror = () => reject(tx.error);
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
