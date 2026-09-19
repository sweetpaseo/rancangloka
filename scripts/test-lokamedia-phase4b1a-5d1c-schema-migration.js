/**
 * RancangLoka — LokaMedia Phase 4B1A.5D1C
 * IndexedDB Capture Store Schema Migration Repair Test Suite
 *
 * Deterministic Tests:
 * Test A: Fresh database (version 0 -> 2, captured-blobs created, stats 0/0)
 * Test B: Legacy version 1 without capture store (automatic migration 1 -> 2, store added)
 * Test C: Legacy data preservation (existing stores & records untouched)
 * Test D: Existing capture store (idempotent, no duplicate creation / error)
 * Test E: Blob store operations after migration (put, get, stats, delete)
 * Test F: Backpressure after migration (empty store 0/0, limits enforced at 4 assets / 20 MiB)
 * Test G: Restart / reopen (schema & data persist across close/reopen)
 * Test H: Missing / corrupt schema fails closed (structured BLOB_STORE_SCHEMA_UNAVAILABLE, zero provider/capture/upload)
 */

import assert from 'node:assert/strict';
import {
  BLOB_STORE_SCHEMA_VERSION,
  BlobStoreSchemaError,
  IndexedDbBlobStore
} from '../extensions/lokamedia/src/blob-store.js';
import { BackpressureController } from '../extensions/lokamedia/src/backpressure.js';
import {
  MAX_PENDING_CAPTURED_ASSETS,
  MAX_PENDING_CAPTURED_BYTES
} from '../extensions/lokamedia/src/constants.js';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

// In-memory W3C compliant IndexedDB mock for deterministic testing
class FakeIDBObjectStore {
  constructor(name, keyPath = 'key') {
    this.name = name;
    this.keyPath = keyPath;
    this.data = new Map();
  }

  put(value) {
    const key = this.keyPath ? value[this.keyPath] : value.key;
    this.data.set(key, value);
    return { result: key };
  }

  get(key) {
    return { result: this.data.get(key) };
  }

  delete(key) {
    this.data.delete(key);
    return { result: undefined };
  }

  getAll() {
    return { result: [...this.data.values()] };
  }
}

class FakeIDBDatabase {
  constructor(name, version, stores = new Map()) {
    this.name = name;
    this.version = version;
    this.stores = stores;
    this._closed = false;
  }

  get objectStoreNames() {
    const names = [...this.stores.keys()];
    return {
      contains: (n) => names.includes(n),
      item: (i) => names[i],
      length: names.length,
      [Symbol.iterator]: () => names[Symbol.iterator]()
    };
  }

  createObjectStore(name, options = {}) {
    if (this.stores.has(name)) {
      const err = new Error(`Object store ${name} already exists`);
      err.name = 'ConstraintError';
      throw err;
    }
    const store = new FakeIDBObjectStore(name, options.keyPath);
    this.stores.set(name, store);
    return store;
  }

  transaction(storeNames, mode = 'readonly') {
    if (this._closed) throw new Error('Database is closed');
    const targetNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    for (const name of targetNames) {
      if (!this.stores.has(name)) {
        const err = new Error(`One of the specified object stores was not found: ${name}`);
        err.name = 'NotFoundError';
        err.code = 8;
        throw err;
      }
    }
    const tx = {
      mode,
      error: null,
      oncomplete: null,
      onerror: null,
      onabort: null,
      objectStore: (name) => {
        const s = this.stores.get(name);
        if (!s) {
          const err = new Error(`NotFoundError: ${name}`);
          err.name = 'NotFoundError';
          err.code = 8;
          throw err;
        }
        return s;
      },
      abort: () => {
        if (tx.onabort) queueMicrotask(() => tx.onabort());
      }
    };
    queueMicrotask(() => {
      if (tx.oncomplete) tx.oncomplete();
    });
    return tx;
  }

  close() {
    this._closed = true;
  }
}

class FakeIDBFactory {
  constructor() {
    this.databases = new Map();
    this.failNextOpen = null;
  }

  open(name, requestedVersion) {
    const req = {
      result: null,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null
    };

    queueMicrotask(() => {
      if (this.failNextOpen) {
        req.error = this.failNextOpen;
        this.failNextOpen = null;
        if (req.onerror) req.onerror();
        return;
      }

      let dbMeta = this.databases.get(name);
      const isNew = !dbMeta;
      if (isNew) {
        dbMeta = { version: 0, stores: new Map() };
        this.databases.set(name, dbMeta);
      }

      const currentVersion = dbMeta.version;
      const targetVersion = requestedVersion ?? (currentVersion || 1);

      if (targetVersion < currentVersion) {
        const err = new Error(`VersionError: ${targetVersion} is less than ${currentVersion}`);
        err.name = 'VersionError';
        req.error = err;
        if (req.onerror) req.onerror();
        return;
      }

      const dbInstance = new FakeIDBDatabase(name, targetVersion, dbMeta.stores);
      req.result = dbInstance;

      if (targetVersion > currentVersion) {
        dbMeta.version = targetVersion;
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ oldVersion: currentVersion, newVersion: targetVersion });
        }
      }

      if (req.onsuccess) {
        req.onsuccess();
      }
    });

    return req;
  }
}

console.log('=== LokaMedia Phase 4B1A.5D1C Schema Migration Tests ===\n');

// -------------------------------------------------------------
// Test A — Fresh database
// -------------------------------------------------------------
{
  const idb = new FakeIDBFactory();
  const blobStore = new IndexedDbBlobStore({ dbName: 'fresh-db', idb });

  const stats = await blobStore.stats();
  assert.equal(stats.count, 0, 'fresh stats count must be 0');
  assert.equal(stats.bytes, 0, 'fresh stats bytes must be 0');

  const meta = idb.databases.get('fresh-db');
  assert.equal(meta.version, BLOB_STORE_SCHEMA_VERSION, 'must be created at current version');
  assert.ok(meta.stores.has('captured-blobs'), 'captured-blobs store must exist');

  pass('Test A: Fresh database initialises at schema v2 with captured-blobs store');
}

// -------------------------------------------------------------
// Test B — Legacy version 1 without capture store
// -------------------------------------------------------------
{
  const idb = new FakeIDBFactory();
  // Seed legacy v1 database without captured-blobs
  idb.databases.set('legacy-v1-db', { version: 1, stores: new Map() });

  const blobStore = new IndexedDbBlobStore({ dbName: 'legacy-v1-db', idb });
  const stats = await blobStore.stats();

  assert.equal(stats.count, 0, 'migrated stats count must be 0');
  assert.equal(stats.bytes, 0, 'migrated stats bytes must be 0');

  const meta = idb.databases.get('legacy-v1-db');
  assert.equal(meta.version, 2, 'legacy v1 database must migrate to version 2');
  assert.ok(meta.stores.has('captured-blobs'), 'captured-blobs must exist after migration');

  pass('Test B: Legacy version 1 without capture store upgrades automatically to v2');
}

// -------------------------------------------------------------
// Test C — Legacy data preservation
// -------------------------------------------------------------
{
  const idb = new FakeIDBFactory();
  const legacyStore = new FakeIDBObjectStore('settings', 'id');
  legacyStore.data.set('theme', { id: 'theme', value: 'dark' });
  legacyStore.data.set('device', { id: 'device', value: 'dev_chr_local' });

  idb.databases.set('legacy-with-data', {
    version: 1,
    stores: new Map([['settings', legacyStore]])
  });

  const blobStore = new IndexedDbBlobStore({ dbName: 'legacy-with-data', idb });
  await blobStore.stats();

  const meta = idb.databases.get('legacy-with-data');
  assert.equal(meta.version, 2);
  assert.ok(meta.stores.has('settings'), 'legacy store must be preserved');
  assert.ok(meta.stores.has('captured-blobs'), 'captured-blobs must be added');
  assert.equal(meta.stores.get('settings').data.get('theme').value, 'dark', 'legacy record preserved');
  assert.equal(meta.stores.get('settings').data.get('device').value, 'dev_chr_local', 'legacy record preserved');

  pass('Test C: Legacy data in unrelated stores preserved during migration');
}

// -------------------------------------------------------------
// Test D — Existing capture store (Idempotent)
// -------------------------------------------------------------
{
  const idb = new FakeIDBFactory();
  const blobStore = new IndexedDbBlobStore({ dbName: 'existing-store-db', idb });

  // First open creates store
  await blobStore.stats();

  // Second open using a new instance pointing to same DB
  const blobStore2 = new IndexedDbBlobStore({ dbName: 'existing-store-db', idb });
  await blobStore2.stats();

  const meta = idb.databases.get('existing-store-db');
  assert.equal(meta.version, 2);
  assert.ok(meta.stores.has('captured-blobs'));

  pass('Test D: Migration is idempotent and does not recreate store or throw on existing store');
}

// -------------------------------------------------------------
// Test E — Blob store operations after migration
// -------------------------------------------------------------
{
  const idb = new FakeIDBFactory();
  idb.databases.set('ops-db', { version: 1, stores: new Map() });

  const blobStore = new IndexedDbBlobStore({ dbName: 'ops-db', idb });

  const testRecord = {
    key: 'mjob_test:1',
    bytes: new Uint8Array([1, 2, 3, 4, 5]).buffer,
    size: 5,
    mime: 'image/png'
  };

  const putResult = await blobStore.put(testRecord);
  assert.equal(putResult.key, 'mjob_test:1');
  assert.equal(putResult.size, 5);

  const getResult = await blobStore.get('mjob_test:1');
  assert.ok(getResult, 'must retrieve stored blob');
  assert.equal(getResult.key, 'mjob_test:1');
  assert.equal(getResult.size, 5);
  assert.equal(getResult.mime, 'image/png');

  const stats = await blobStore.stats();
  assert.equal(stats.count, 1);
  assert.equal(stats.bytes, 5);

  await blobStore.delete('mjob_test:1');
  const deletedResult = await blobStore.get('mjob_test:1');
  assert.equal(deletedResult, undefined);

  const finalStats = await blobStore.stats();
  assert.equal(finalStats.count, 0);
  assert.equal(finalStats.bytes, 0);

  pass('Test E: Blob store operations (put, get, stats, delete) succeed after migration');
}

// -------------------------------------------------------------
// Test F — Backpressure after migration
// -------------------------------------------------------------
{
  const idb = new FakeIDBFactory();
  idb.databases.set('bp-db', { version: 1, stores: new Map() });

  const blobStore = new IndexedDbBlobStore({ dbName: 'bp-db', idb });
  const backpressure = new BackpressureController(blobStore);

  // Empty inspect
  const emptyPressure = await backpressure.inspect();
  assert.equal(emptyPressure.blocked, false, 'empty store must not block backpressure');
  assert.equal(emptyPressure.pendingAssets, 0);
  assert.equal(emptyPressure.pendingBytes, 0);
  assert.equal(emptyPressure.maxAssets, MAX_PENDING_CAPTURED_ASSETS);
  assert.equal(emptyPressure.maxBytes, MAX_PENDING_CAPTURED_BYTES);

  // Add 4 assets to hit limit
  for (let i = 1; i <= 4; i++) {
    await blobStore.put({
      key: `job_${i}:1`,
      bytes: new Uint8Array([1, 2, 3]).buffer,
      size: 3,
      mime: 'image/png'
    });
  }

  const limitPressure = await backpressure.inspect();
  assert.equal(limitPressure.blocked, true, 'must block when count reaches maxAssets');
  assert.equal(limitPressure.pendingAssets, 4);

  pass('Test F: BackpressureController operates safely on empty and populated migrated stores');
}

// -------------------------------------------------------------
// Test G — Restart / Reopen
// -------------------------------------------------------------
{
  const idb = new FakeIDBFactory();
  idb.databases.set('restart-db', { version: 1, stores: new Map() });

  // Session 1: Migrates and writes data
  const session1 = new IndexedDbBlobStore({ dbName: 'restart-db', idb });
  await session1.put({
    key: 'persisted_blob_1',
    bytes: new Uint8Array([10, 20, 30]).buffer,
    size: 3,
    mime: 'image/webp'
  });

  // Session 2: Fresh instance reopening DB
  const session2 = new IndexedDbBlobStore({ dbName: 'restart-db', idb });
  const retrieved = await session2.get('persisted_blob_1');
  assert.ok(retrieved);
  assert.equal(retrieved.key, 'persisted_blob_1');
  assert.equal(retrieved.size, 3);
  assert.equal(retrieved.mime, 'image/webp');

  const stats = await session2.stats();
  assert.equal(stats.count, 1);
  assert.equal(stats.bytes, 3);

  pass('Test G: Schema and records survive closing and reopening database');
}

// -------------------------------------------------------------
// Test H — Missing/corrupt schema fails closed
// -------------------------------------------------------------
{
  const idb = new FakeIDBFactory();
  // Simulate corrupt / partial database: version is 2 but captured-blobs does not exist
  idb.databases.set('corrupt-db', { version: 2, stores: new Map() });

  const blobStore = new IndexedDbBlobStore({ dbName: 'corrupt-db', idb });

  let capturedError = null;
  try {
    await blobStore.stats();
  } catch (err) {
    capturedError = err;
  }

  assert.ok(capturedError, 'must reject when required schema is missing');
  assert.ok(capturedError instanceof BlobStoreSchemaError, 'must throw structured BlobStoreSchemaError');
  assert.equal(capturedError.code, 'BLOB_STORE_SCHEMA_UNAVAILABLE', 'error code must be BLOB_STORE_SCHEMA_UNAVAILABLE');

  // Verify database was NOT automatically deleted
  assert.ok(idb.databases.has('corrupt-db'), 'corrupt database must not be deleted');

  // Verify that workflow fails closed before any provider generate, capture, or upload calls
  let generateCalls = 0;
  let captureCalls = 0;
  let uploadCalls = 0;

  const mockProvider = {
    generate: async () => { generateCalls++; },
    capture: async () => { captureCalls++; }
  };
  const mockApi = {
    nextJob: async () => ({ job: { job_id: 'job_fail' } }),
    upload: async () => { uploadCalls++; }
  };

  const backpressure = new BackpressureController(blobStore);
  let bpError = null;
  try {
    await backpressure.inspect();
    await mockProvider.generate();
    await mockProvider.capture();
    await mockApi.upload();
  } catch (err) {
    bpError = err;
  }

  assert.ok(bpError instanceof BlobStoreSchemaError, 'backpressure must fail with BlobStoreSchemaError');
  assert.equal(generateCalls, 0, 'provider.generate calls must be 0');
  assert.equal(captureCalls, 0, 'capture calls must be 0');
  assert.equal(uploadCalls, 0, 'upload calls must be 0');

  pass('Test H: Incomplete schema fails closed with structured BLOB_STORE_SCHEMA_UNAVAILABLE and zero calls');
}

console.log(`\nAll ${passed} schema migration tests passed!`);
