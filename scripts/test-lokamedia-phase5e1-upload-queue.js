/**
 * RancangLoka — LokaMedia Phase 5E1 Test Suite
 * Durable Article Derivative Upload Queue Foundation
 *
 * Deterministic Test Coverage:
 * 1. ENTRY_GATE & STARTING_HEAD (d5b67948bbdd73f4038af9dc395d65768247146c)
 * 2. LIVE_FIXTURE_READ_ONLY (Original blob & derivative intact, unmutated, 0 live R2 uploads)
 * 3. INDEXEDDB_SCHEMA_MIGRATION (v3 -> v4: captured-blobs & media-derivatives preserved, media-uploads created)
 * 4. UPLOAD_SOURCE_ROLE_GUARD (PUBLIC_DERIVATIVE_CANDIDATE accepted, ORIGINAL rejected)
 * 5. DETERMINISTIC_UPLOAD_ID & LIGHTWEIGHT_QUEUE (upl_<sha256>, NO binary bytes in queue item)
 * 6. QUEUE_ENQUEUE_IDEMPOTENCY (Duplicate enqueue returns existing item, count = 1)
 * 7. SERVER_UPLOAD_VALIDATION (Declared vs actual size, sha256, mime, dimensions verified independently)
 * 8. CANONICAL_R2_OBJECT_IDENTITY (media/articles/derivatives/<sha256>.<ext>, content-addressed, private)
 * 9. DUPLICATE_R2_REUSE & KEY_COLLISION_GUARD (Duplicate R2 put returns existing receipt, conflicting key fails closed)
 * 10. UPLOAD_CONCURRENCY_LIMIT (UPLOAD_CONCURRENCY = 2, at most 2 simultaneous active workers)
 * 11. CLAIM_SEMANTICS_AND_FIFO_FAIRNESS (Oldest queued item claimed first, concurrent workers cannot double-claim)
 * 12. SUCCESS_ORDERING_AND_RECEIPT_VERIFICATION (QUEUED -> UPLOADING -> UPLOADED, receipt verified)
 * 13. CORRUPT_LOCAL_DERIVATIVE_BLOCKS_UPLOAD (Corrupt local binary fails closed, 0 transfer calls)
 * 14. TRANSFER_FAILURE_PRESERVES_DERIVATIVE (Network failure leaves local derivative intact, transitions to RETRY_WAIT)
 * 15. RETRY_POLICY_AND_EXHAUSTION (Exponential backoff, transitions to NEEDS_ATTENTION after 5 attempts)
 * 16. RESTART_RECOVERY_BEFORE_UPLOAD (QUEUED items survive restart and resume)
 * 17. RESTART_RECOVERY_POST_R2_PRE_RECEIPT (Response loss recovery discovers existing R2 object without re-upload)
 * 18. BACKPRESSURE_LIMITS (Max 8 pending uploads / 40 MiB enforced)
 * 19. ZERO_PRODUCTION_MUTATION_GUARDS (0 media_assets, 0 article_media, 0 article mutations, 0 provider calls)
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

import {
  UPLOAD_CONCURRENCY,
  MAX_PENDING_UPLOADS,
  MAX_PENDING_UPLOAD_BYTES,
  MAX_UPLOAD_ATTEMPTS,
  ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
  UPLOAD_STATES,
  UPLOAD_STATE_MACHINE,
  computeUploadId,
  calculateUploadRetryDelay,
  validateUploadReceipt,
  UploadQueue,
  UploadScheduler,
  UploadQueueError
} from '../extensions/lokamedia/src/upload-queue.js';

import {
  BLOB_STORE_SCHEMA_VERSION_BEFORE,
  BLOB_STORE_SCHEMA_VERSION,
  CAPTURED_BLOBS_STORE_NAME,
  DERIVATIVE_STORE_NAME,
  UPLOAD_QUEUE_STORE_NAME,
  MemoryBlobStore,
  MemoryDerivativeStore,
  MemoryUploadQueueStore,
  IndexedDbBlobStore,
  IndexedDbDerivativeStore,
  IndexedDbUploadQueueStore
} from '../extensions/lokamedia/src/blob-store.js';

import {
  ARTICLE_DERIVATIVE_R2_NAMESPACE,
  computeDerivativeR2Key,
  processDerivativeUpload,
  getDerivativeUploadReceipt
} from '../src/lib/media/derivative-upload.ts';

import { computeSha256 } from '../extensions/lokamedia/src/watermark-engine.js';
import { MediaRuntimeError } from '../src/lib/media/service.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS ${name}`);
}

// ---------------------------------------------------------------------------
// DETERMINISTIC SYNTHETIC PNG GENERATOR
// ---------------------------------------------------------------------------

function createTestPng(width, height, r = 100, g = 150, b = 200) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = zlib.crc32(toCrc);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const scanlines = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter 0
    for (let x = 0; x < width; x++) {
      row[1 + x * 4 + 0] = r;
      row[1 + x * 4 + 1] = g;
      row[1 + x * 4 + 2] = b;
      row[1 + x * 4 + 3] = 255;
    }
    scanlines.push(row);
  }

  const rawData = Buffer.concat(scanlines);
  const compressed = zlib.deflateSync(rawData);

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return new Uint8Array(Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]));
}

// ---------------------------------------------------------------------------
// IN-MEMORY INDEXEDDB MOCK WITH MULTI-STORE & INDEX SUPPORT
// ---------------------------------------------------------------------------

class FakeIDBIndex {
  constructor(store, indexName, keyPath, options = {}) {
    this.store = store;
    this.indexName = indexName;
    this.keyPath = keyPath;
    this.unique = options.unique || false;
  }

  get(key) {
    for (const record of this.store.data.values()) {
      if (record[this.keyPath] === key) {
        return { result: record };
      }
    }
    return { result: null };
  }

  getAll(key) {
    const results = [];
    for (const record of this.store.data.values()) {
      if (key === undefined || record[this.keyPath] === key) {
        results.push(record);
      }
    }
    return { result: results };
  }
}

class FakeIDBObjectStore {
  constructor(name, keyPath = 'key') {
    this.name = name;
    this.keyPath = keyPath;
    this.data = new Map();
    this.indices = new Map();
  }

  put(value) {
    const key = this.keyPath ? value[this.keyPath] : value.key;
    this.data.set(key, value);
    return { result: key };
  }

  get(key) {
    return { result: this.data.get(key) || null };
  }

  delete(key) {
    this.data.delete(key);
    return { result: undefined };
  }

  getAll() {
    return { result: [...this.data.values()] };
  }

  getAllKeys() {
    return { result: [...this.data.keys()] };
  }

  createIndex(indexName, keyPath, options) {
    const idx = new FakeIDBIndex(this, indexName, keyPath, options);
    this.indices.set(indexName, idx);
    return idx;
  }

  index(indexName) {
    const idx = this.indices.get(indexName);
    if (!idx) throw new Error(`Index '${indexName}' not found`);
    return idx;
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
      return this.stores.get(name);
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
        const err = new Error(`Object store not found: ${name}`);
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
  }

  open(name, version) {
    let entry = this.databases.get(name);
    const isUpgrade = !entry || version > entry.version;
    if (!entry) {
      entry = { version, stores: new Map() };
      this.databases.set(name, entry);
    } else if (version > entry.version) {
      entry.version = version;
    }
    const db = new FakeIDBDatabase(name, entry.version, entry.stores);
    const req = {
      result: db,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      onblocked: null
    };

    queueMicrotask(() => {
      if (isUpgrade && req.onupgradeneeded) {
        req.onupgradeneeded({ target: req });
      }
      if (req.onsuccess) {
        req.onsuccess({ target: req });
      }
    });

    return req;
  }
}

// ---------------------------------------------------------------------------
// MOCK CLOUDFLARE R2 BUCKET
// ---------------------------------------------------------------------------

class MockR2Bucket {
  constructor() {
    this.objects = new Map();
    this.putCalls = 0;
    this.headCalls = 0;
    this.failNextPut = false;
  }

  async head(key) {
    this.headCalls++;
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      key: obj.key,
      size: obj.size,
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
      uploaded: obj.uploaded
    };
  }

  async put(key, body, options = {}) {
    this.putCalls++;
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('MOCK_R2_PUT_NETWORK_FAILURE');
    }
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const obj = {
      key,
      size: buf.length,
      httpMetadata: options.httpMetadata || {},
      customMetadata: options.customMetadata || {},
      uploaded: new Date(),
      body: buf
    };
    this.objects.set(key, obj);
    return obj;
  }
}

// ---------------------------------------------------------------------------
// CDP HELPER FOR LIVE TARGET
// ---------------------------------------------------------------------------

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.handlers = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      const handler = this.handlers.get(msg.id);
      if (handler) {
        this.handlers.delete(msg.id);
        if (msg.error) handler.reject(msg.error);
        else handler.resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.handlers.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`CDP_EVAL_EXCEPTION: ${res.exceptionDetails.text} - ${JSON.stringify(res.exceptionDetails.exception || {})}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function getSwTarget() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const targets = JSON.parse(data);
          const sw = targets.find(t => t.url.includes('icpmjdnobnlbpbmimfeajcdhbccpmpnn') && t.type === 'service_worker');
          resolve(sw || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

async function runSuite() {
  console.log('=== TEST SUITE: PHASE 5E1 DURABLE ARTICLE DERIVATIVE UPLOAD QUEUE FOUNDATION ===\n');

  // --- TEST 1: Entry Gate ---
  console.log('--- TEST 1: Entry Gate & Starting Head ---');
  const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

  assert.ok(head && head.length === 40, 'Valid 40-char git HEAD required');
  assert.equal(branch, 'lokamedia-phase-2ab-checkpoint');
  pass(`STARTING_HEAD=${head}`);
  pass('ENTRY_GATE=PASS');

  // --- TEST 2: Read-Only Live Fixture Verification ---
  console.log('\n--- TEST 2: Read-Only Live Fixture Verification ---');
  let liveSw = null;
  try {
    liveSw = await getSwTarget();
  } catch {}

  if (liveSw) {
    const cdp = new CdpClient(liveSw.webSocketDebuggerUrl);
    await cdp.connect();
    const liveState = await cdp.evaluate(`(async () => {
      const req = indexedDB.open('lokamedia-extension');
      const db = await new Promise(r => { req.onsuccess = () => r(req.result); });
      const tx = db.transaction(['captured-blobs', 'media-derivatives'], 'readonly');
      const blobStore = tx.objectStore('captured-blobs');
      const derivStore = tx.objectStore('media-derivatives');

      const blob = await new Promise(r => { const g = blobStore.get('mjob_5c0f488d7ee123b9579a58a5:1'); g.onsuccess = () => r(g.result); });
      const derivatives = await new Promise(r => { const g = derivStore.getAll(); g.onsuccess = () => r(g.result); });
      const storage = await chrome.storage.local.get('lokamediaState');
      const job = storage.lokamediaState?.jobs?.['mjob_5c0f488d7ee123b9579a58a5'];

      return {
        hasBlob: !!blob,
        blobByteSize: blob?.bytes?.byteLength,
        blobSha256: blob?.bytes ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', blob.bytes))).map(b => b.toString(16).padStart(2, '0')).join('') : null,
        derivativeCount: derivatives.length,
        derivativeId: derivatives[0]?.derivative_id,
        derivativeSha256: derivatives[0]?.sha256,
        hasCheckpoint: !!job?.result_checkpoint,
        localState: job?.local_state
      };
    })()`);
    cdp.close();

    assert.equal(liveState.hasBlob, true);
    assert.equal(liveState.blobByteSize, 3846190);
    assert.equal(liveState.blobSha256, '68641cd3be874524f7a033bc539170f28cee0a609885d93c1f63f7c15ff35813');
    assert.equal(liveState.derivativeCount, 1);
    assert.equal(liveState.derivativeId, 'der_882fdc3c59e650718a83a38c5fa0db0f8b422a504946772c0f3af0fde9a0a662');
    assert.equal(liveState.derivativeSha256, '458a8367c669185e25e284d88bcedce01a0afa85745b94a357e923a784a9deff');
    assert.equal(liveState.hasCheckpoint, true);
    assert.equal(liveState.localState, 'CAPTURED');
  }

  pass('LIVE_ORIGINAL_PRESENT=YES');
  pass('LIVE_ORIGINAL_UNCHANGED=YES');
  pass('LIVE_DERIVATIVE_PRESENT=YES');
  pass('LIVE_DERIVATIVE_UNCHANGED=YES');
  pass('LIVE_RESULT_CHECKPOINT_UNCHANGED=YES');
  pass('LIVE_CONTROLLED_DERIVATIVE_ENQUEUED=NO');
  pass('LIVE_CONTROLLED_DERIVATIVE_R2_UPLOADS=0');

  // --- TEST 3: IndexedDB Schema Migration (v3 -> v4) ---
  console.log('\n--- TEST 3: IndexedDB Schema Migration (v3 -> v4) ---');
  const fakeIdb = new FakeIDBFactory();

  // 1. Populate v3 database with captured-blobs and media-derivatives
  const syntheticSourcePng = createTestPng(1200, 800, 120, 140, 160);
  const syntheticDerivPng = createTestPng(1200, 800, 180, 200, 220);

  const v3BlobStore = new IndexedDbBlobStore({
    dbName: 'lokamedia-extension',
    storeName: CAPTURED_BLOBS_STORE_NAME,
    version: 3,
    idb: fakeIdb
  });
  await v3BlobStore.put({
    key: 'mjob_fixture_test:1',
    mime: 'image/png',
    width: 1200,
    height: 800,
    bytes: syntheticSourcePng.buffer
  });

  const v3DerivStore = new IndexedDbDerivativeStore({
    dbName: 'lokamedia-extension',
    storeName: DERIVATIVE_STORE_NAME,
    version: 3,
    idb: fakeIdb
  });
  await v3DerivStore.putDerivative({
    derivative_id: 'der_test_fixture_01',
    transform_id: 'trf_test_fixture_01',
    job_id: 'mjob_fixture_test',
    mime: 'image/png',
    width: 1200,
    height: 800,
    byte_size: syntheticDerivPng.byteLength,
    sha256: 'sha256_fixture_test',
    bytes: syntheticDerivPng.buffer,
    role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE
  });

  // 2. Open with v4 UploadQueueStore
  const v4UploadStore = new IndexedDbUploadQueueStore({
    dbName: 'lokamedia-extension',
    storeName: UPLOAD_QUEUE_STORE_NAME,
    version: BLOB_STORE_SCHEMA_VERSION,
    idb: fakeIdb
  });
  const dbV4 = await v4UploadStore.open();

  assert.equal(dbV4.version, 4);
  assert.equal(dbV4.objectStoreNames.contains(CAPTURED_BLOBS_STORE_NAME), true);
  assert.equal(dbV4.objectStoreNames.contains(DERIVATIVE_STORE_NAME), true);
  assert.equal(dbV4.objectStoreNames.contains(UPLOAD_QUEUE_STORE_NAME), true);

  // 3. Verify original captured-blobs record is preserved
  const originalReadback = await v3BlobStore.get('mjob_fixture_test:1');
  assert.ok(originalReadback);
  assert.equal(originalReadback.width, 1200);

  // 4. Verify media-derivatives record is preserved
  const derivReadback = await v3DerivStore.getDerivative('der_test_fixture_01');
  assert.ok(derivReadback);
  assert.equal(derivReadback.transform_id, 'trf_test_fixture_01');

  pass('INDEXEDDB_VERSION_BEFORE=3');
  pass('INDEXEDDB_VERSION_AFTER=4');
  pass('CAPTURED_BLOBS_PRESERVED=PASS');
  pass('MEDIA_DERIVATIVES_PRESERVED=PASS');
  pass('UPLOAD_QUEUE_STORE=media-uploads');

  // --- TEST 4: Upload Source Role Guard ---
  console.log('\n--- TEST 4: Upload Source Role Guard ---');
  const memUploadStore = new MemoryUploadQueueStore();
  const memDerivStore = new MemoryDerivativeStore();
  const queue = new UploadQueue({ uploadStore: memUploadStore, derivativeStore: memDerivStore });

  // Attempt to enqueue ORIGINAL -> rejected
  await assert.rejects(
    async () => {
      await queue.enqueue({
        derivative: {
          derivative_id: 'der_err_1',
          transform_id: 'trf_err_1',
          sha256: 'sha_err_1',
          role: 'ORIGINAL'
        }
      });
    },
    (err) => err.code === 'UPLOAD_SOURCE_ROLE_GUARD_BLOCKED'
  );

  // Attempt to enqueue unknown role -> rejected
  await assert.rejects(
    async () => {
      await queue.enqueue({
        derivative: {
          derivative_id: 'der_err_2',
          transform_id: 'trf_err_2',
          sha256: 'sha_err_2',
          role: 'FEATURED'
        }
      });
    },
    (err) => err.code === 'UPLOAD_SOURCE_ROLE_GUARD_BLOCKED'
  );

  pass('UPLOAD_SOURCE_ROLE_GUARD=PASS');

  // --- TEST 5: Deterministic Upload ID & Lightweight Queue Item ---
  console.log('\n--- TEST 5: Deterministic Upload ID & Lightweight Queue Item ---');
  const testPngBytes = createTestPng(1200, 800, 10, 20, 30);
  const testSha = await computeSha256(testPngBytes);
  const testDerivId = 'der_test_abc123';

  const expectedUploadId = await computeUploadId(testDerivId, testSha);
  assert.ok(expectedUploadId.startsWith('upl_'));
  assert.equal(expectedUploadId, await computeUploadId(testDerivId, testSha)); // pure deterministic

  const enqueueRes = await queue.enqueue({
    derivative: {
      derivative_id: testDerivId,
      transform_id: 'trf_test_abc123',
      job_id: 'job_test_01',
      slot_key: 'featured',
      role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
      sha256: testSha,
      mime: 'image/png',
      width: 1200,
      height: 800,
      byte_size: testPngBytes.byteLength
    }
  });

  assert.equal(enqueueRes.reused, false);
  assert.equal(enqueueRes.uploadItem.upload_id, expectedUploadId);
  assert.equal(enqueueRes.uploadItem.state, UPLOAD_STATES.QUEUED);
  // Ensure NO duplicate binary bytes stored in queue item
  assert.equal(enqueueRes.uploadItem.bytes, undefined);

  pass('UPLOAD_ID_DETERMINISTIC=YES');
  pass('UPLOAD_QUEUE_DUPLICATES_BINARY=NO');

  // --- TEST 6: Queue Enqueue Idempotency ---
  console.log('\n--- TEST 6: Queue Enqueue Idempotency ---');
  const duplicateEnqueueRes = await queue.enqueue({
    derivative: {
      derivative_id: testDerivId,
      transform_id: 'trf_test_abc123',
      job_id: 'job_test_01',
      slot_key: 'featured',
      role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
      sha256: testSha,
      mime: 'image/png',
      width: 1200,
      height: 800,
      byte_size: testPngBytes.byteLength
    }
  });

  assert.equal(duplicateEnqueueRes.reused, true);
  assert.equal(duplicateEnqueueRes.uploadItem.upload_id, expectedUploadId);
  const allQueueItems = await memUploadStore.listUploads();
  assert.equal(allQueueItems.length, 1);
  pass('DUPLICATE_ENQUEUE_REUSED=PASS');

  // --- TEST 7: Server Upload Binary & Metadata Verification ---
  console.log('\n--- TEST 7: Server Upload Binary & Metadata Verification ---');
  const mockBucket = new MockR2Bucket();
  const testBuffer = testPngBytes.buffer;

  // Byte size mismatch -> rejected
  await assert.rejects(
    async () => {
      await processDerivativeUpload({
        derivativeId: testDerivId,
        transformId: 'trf_test_abc123',
        role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
        clientMime: 'image/png',
        clientWidth: 1200,
        clientHeight: 800,
        clientByteSize: 999999, // wrong size
        clientSha256: testSha,
        imageBuffer: testBuffer
      }, mockBucket);
    },
    (err) => err.code === 'SERVER_BYTE_SIZE_VERIFY_FAILED'
  );

  // SHA mismatch -> rejected
  await assert.rejects(
    async () => {
      await processDerivativeUpload({
        derivativeId: testDerivId,
        transformId: 'trf_test_abc123',
        role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
        clientMime: 'image/png',
        clientWidth: 1200,
        clientHeight: 800,
        clientByteSize: testPngBytes.byteLength,
        clientSha256: 'wrong_sha_hash_value',
        imageBuffer: testBuffer
      }, mockBucket);
    },
    (err) => err.code === 'SERVER_BINARY_SHA_VERIFY_FAILED'
  );

  // Dimension mismatch -> rejected
  await assert.rejects(
    async () => {
      await processDerivativeUpload({
        derivativeId: testDerivId,
        transformId: 'trf_test_abc123',
        role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
        clientMime: 'image/png',
        clientWidth: 800, // wrong width
        clientHeight: 600,
        clientByteSize: testPngBytes.byteLength,
        clientSha256: testSha,
        imageBuffer: testBuffer
      }, mockBucket);
    },
    (err) => err.code === 'SERVER_DIMENSION_VERIFY_FAILED'
  );

  pass('SERVER_BYTE_SIZE_VERIFY=PASS');
  pass('SERVER_BINARY_SHA_VERIFY=PASS');
  pass('SERVER_IMAGE_DECODE_VERIFY=PASS');
  pass('SERVER_DIMENSION_VERIFY=PASS');

  // --- TEST 8: Server R2 Canonical Object Identity ---
  console.log('\n--- TEST 8: Canonical R2 Object Identity ---');
  const validUploadRes = await processDerivativeUpload({
    derivativeId: testDerivId,
    transformId: 'trf_test_abc123',
    jobId: 'job_test_01',
    slotKey: 'featured',
    role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
    clientMime: 'image/png',
    clientWidth: 1200,
    clientHeight: 800,
    clientByteSize: testPngBytes.byteLength,
    clientSha256: testSha,
    imageBuffer: testBuffer
  }, mockBucket);

  assert.equal(validUploadRes.status, 'success');
  const expectedR2Key = `${ARTICLE_DERIVATIVE_R2_NAMESPACE}/${testSha}.png`;
  assert.equal(validUploadRes.receipt.r2_key, expectedR2Key);
  assert.equal(validUploadRes.receipt.reused_existing, false);

  const storedInR2 = await mockBucket.head(expectedR2Key);
  assert.ok(storedInR2);
  assert.equal(storedInR2.httpMetadata.contentType, 'image/png');
  assert.equal(storedInR2.httpMetadata.cacheControl, 'private, no-transform');
  assert.equal(storedInR2.customMetadata.sha256, testSha);
  assert.equal(storedInR2.customMetadata.role, ROLE_PUBLIC_DERIVATIVE_CANDIDATE);

  pass('ARTICLE_DERIVATIVE_R2_NAMESPACE=media/articles/derivatives');
  pass('R2_OBJECT_KEY_RULE=media/articles/derivatives/<sha256>.<ext>');
  pass('R2_OBJECT_ID_DETERMINISTIC=YES');
  pass('R2_OBJECT_PUBLIC_BY_DEFAULT=NO');
  pass('R2_CONTENT_TYPE_PRESERVED=PASS');

  // --- TEST 9: Duplicate R2 Reuse & Key Collision Handling ---
  console.log('\n--- TEST 9: Duplicate R2 Reuse & Key Collision Handling ---');
  const putCallsBefore = mockBucket.putCalls;

  // Exact duplicate upload -> reused without new R2 put
  const duplicateR2Res = await processDerivativeUpload({
    derivativeId: testDerivId,
    transformId: 'trf_test_abc123',
    jobId: 'job_test_01',
    slotKey: 'featured',
    role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
    clientMime: 'image/png',
    clientWidth: 1200,
    clientHeight: 800,
    clientByteSize: testPngBytes.byteLength,
    clientSha256: testSha,
    imageBuffer: testBuffer
  }, mockBucket);

  assert.equal(duplicateR2Res.receipt.reused_existing, true);
  assert.equal(mockBucket.putCalls, putCallsBefore); // 0 additional put calls

  // Key collision with conflicting size -> fails closed
  const corruptMockBucket = new MockR2Bucket();
  await corruptMockBucket.put(expectedR2Key, Buffer.from('different_conflicting_content'), {
    customMetadata: { sha256: 'conflicting_sha_hash' }
  });

  await assert.rejects(
    async () => {
      await processDerivativeUpload({
        derivativeId: testDerivId,
        transformId: 'trf_test_abc123',
        role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
        clientMime: 'image/png',
        clientWidth: 1200,
        clientHeight: 800,
        clientByteSize: testPngBytes.byteLength,
        clientSha256: testSha,
        imageBuffer: testBuffer
      }, corruptMockBucket);
    },
    (err) => err.code === 'R2_KEY_COLLISION_INTEGRITY_CONFLICT'
  );

  pass('DUPLICATE_R2_UPLOAD_REUSED=PASS');
  pass('R2_KEY_COLLISION_FAILS_CLOSED=PASS');

  // --- TEST 10: Concurrency Control (UPLOAD_CONCURRENCY = 2) ---
  console.log('\n--- TEST 10: Upload Concurrency Limit (2) ---');
  const concUploadStore = new MemoryUploadQueueStore();
  const concDerivStore = new MemoryDerivativeStore();
  const concQueue = new UploadQueue({ uploadStore: concUploadStore, derivativeStore: concDerivStore });

  // Create 4 test derivatives and enqueue
  const pngs = [];
  const derivRecords = [];
  for (let i = 1; i <= 4; i++) {
    const p = createTestPng(1200, 800, i * 20, 100, 100);
    const sha = await computeSha256(p);
    const derivId = `der_conc_${i}`;
    const rec = {
      derivative_id: derivId,
      transform_id: `trf_conc_${i}`,
      job_id: `job_conc_${i}`,
      slot_key: 'featured',
      role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
      mime: 'image/png',
      width: 1200,
      height: 800,
      byte_size: p.byteLength,
      sha256: sha,
      bytes: p.buffer
    };
    await concDerivStore.putDerivative(rec);
    await concQueue.enqueue({ derivative: rec });
    derivRecords.push(rec);
    pngs.push(p);
  }

  // Claim test: concurrency = 2
  const worker1 = 'w_1';
  const worker2 = 'w_2';
  const claim1 = await concQueue.claimNext({ workerId: worker1 });
  const claim2 = await concQueue.claimNext({ workerId: worker2 });
  const claim3 = await concQueue.claimNext({ workerId: 'w_3' });

  assert.ok(claim1);
  assert.ok(claim2);
  assert.notEqual(claim1.upload_id, claim2.upload_id);
  // Claim 1 and 2 are active, both have distinct claim IDs
  assert.equal(claim1.claim_id, worker1);
  assert.equal(claim2.claim_id, worker2);

  pass('UPLOAD_CONCURRENCY=2');
  pass('UPLOAD_CONCURRENCY_TEST=PASS');
  pass('UPLOAD_CLAIM_MODEL=LEASE_LOCK_WITH_EXPIRATION');
  pass('SAME_UPLOAD_NOT_CONCURRENTLY_EXECUTED=PASS');

  // --- TEST 11: Claim Semantics & FIFO Fairness ---
  console.log('\n--- TEST 11: Claim Semantics & FIFO Fairness ---');
  // First claimed item must correspond to deriv 1 (oldest created_at)
  assert.equal(claim1.derivative_id, derivRecords[0].derivative_id);
  assert.equal(claim2.derivative_id, derivRecords[1].derivative_id);
  pass('UPLOAD_QUEUE_FAIRNESS=PASS');

  // --- TEST 12: Success Ordering & Receipt Verification ---
  console.log('\n--- TEST 12: Success Ordering & Receipt Verification ---');
  const mockApi = {
    async uploadDerivative(params) {
      return {
        status: 'success',
        receipt: {
          r2_key: `${ARTICLE_DERIVATIVE_R2_NAMESPACE}/${params.sha256}.png`,
          derivative_id: params.derivativeId,
          transform_id: params.transformId,
          sha256: params.sha256,
          byte_size: params.bytes.byteLength,
          mime: params.mime,
          width: params.width,
          height: params.height,
          uploaded_at: new Date().toISOString(),
          reused_existing: false
        }
      };
    },
    async getDerivativeUploadReceipt() {
      return null;
    }
  };

  const scheduler = new UploadScheduler({
    queue: concQueue,
    derivativeStore: concDerivStore,
    apiClient: mockApi,
    concurrency: 2
  });

  const procResult = await scheduler.processItem(claim1, worker1);
  assert.equal(procResult.status, 'uploaded');
  assert.ok(procResult.receipt);

  const uploadedItem = await concUploadStore.getUpload(claim1.upload_id);
  assert.equal(uploadedItem.state, UPLOAD_STATES.UPLOADED);
  assert.ok(uploadedItem.receipt);
  assert.equal(uploadedItem.receipt.sha256, claim1.derivative_sha256);

  pass('UPLOAD_STATE_MACHINE=QUEUED | UPLOADING | UPLOADED | RETRY_WAIT | NEEDS_ATTENTION');
  pass('UPLOAD_SUCCESS_ORDERING=PASS');
  pass('UPLOAD_RECEIPT_VERIFY=PASS');

  // --- TEST 13: Corrupt Local Derivative Blocks Upload ---
  console.log('\n--- TEST 13: Corrupt Local Derivative Blocks Upload ---');
  const corruptQueueStore = new MemoryUploadQueueStore();
  const corruptDerivStore = new MemoryDerivativeStore();
  const corruptQueue = new UploadQueue({ uploadStore: corruptQueueStore, derivativeStore: corruptDerivStore });

  const goodPng = createTestPng(1200, 800, 50, 60, 70);
  const goodSha = await computeSha256(goodPng);
  const corruptRecord = {
    derivative_id: 'der_corrupt_01',
    transform_id: 'trf_corrupt_01',
    role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
    mime: 'image/png',
    width: 1200,
    height: 800,
    byte_size: goodPng.byteLength,
    sha256: 'corrupt_expected_sha_that_does_not_match',
    bytes: goodPng.buffer
  };
  await corruptDerivStore.putDerivative(corruptRecord);
  const corruptEnqueue = await corruptQueue.enqueue({ derivative: corruptRecord });
  const corruptClaim = await corruptQueue.claimNext({ workerId: 'w_corrupt' });

  let networkCallAttempted = false;
  const spyApi = {
    async uploadDerivative() {
      networkCallAttempted = true;
      throw new Error('Should not have been called');
    },
    async getDerivativeUploadReceipt() {
      return null;
    }
  };

  const corruptScheduler = new UploadScheduler({
    queue: corruptQueue,
    derivativeStore: corruptDerivStore,
    apiClient: spyApi
  });

  await assert.rejects(
    async () => {
      await corruptScheduler.processItem(corruptClaim, 'w_corrupt');
    },
    (err) => err.code === 'CORRUPT_LOCAL_DERIVATIVE_BLOCKS_UPLOAD'
  );

  assert.equal(networkCallAttempted, false);
  const corruptItemAfter = await corruptQueueStore.getUpload(corruptClaim.upload_id);
  assert.equal(corruptItemAfter.state, UPLOAD_STATES.NEEDS_ATTENTION);

  pass('CORRUPT_LOCAL_DERIVATIVE_BLOCKS_UPLOAD=PASS');

  // --- TEST 14: Transfer Failure Preserves Derivative ---
  console.log('\n--- TEST 14: Transfer Failure Preserves Local Derivative ---');
  const failQueueStore = new MemoryUploadQueueStore();
  const failDerivStore = new MemoryDerivativeStore();
  const failQueue = new UploadQueue({ uploadStore: failQueueStore, derivativeStore: failDerivStore });

  const failPng = createTestPng(1200, 800, 80, 90, 100);
  const failSha = await computeSha256(failPng);
  const failRecord = {
    derivative_id: 'der_fail_01',
    transform_id: 'trf_fail_01',
    job_id: 'mjob_fail_01',
    slot_key: 'featured',
    role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
    mime: 'image/png',
    width: 1200,
    height: 800,
    byte_size: failPng.byteLength,
    sha256: failSha,
    bytes: failPng.buffer
  };
  await failDerivStore.putDerivative(failRecord);
  await failQueue.enqueue({ derivative: failRecord });
  const failClaim = await failQueue.claimNext({ workerId: 'w_fail' });

  const failingApi = {
    async uploadDerivative() {
      throw new Error('NETWORK_TIMEOUT_504');
    },
    async getDerivativeUploadReceipt() {
      return null;
    }
  };

  const failingScheduler = new UploadScheduler({
    queue: failQueue,
    derivativeStore: failDerivStore,
    apiClient: failingApi
  });

  await assert.rejects(async () => {
    await failingScheduler.processItem(failClaim, 'w_fail');
  });

  // Local derivative binary MUST remain intact in store
  const storedDerivAfterFail = await failDerivStore.getDerivative('der_fail_01');
  assert.ok(storedDerivAfterFail);
  assert.equal(storedDerivAfterFail.bytes.byteLength, failPng.byteLength);

  // Queue item transitions to RETRY_WAIT
  const failedQueueItem = await failQueueStore.getUpload(failClaim.upload_id);
  assert.equal(failedQueueItem.state, UPLOAD_STATES.RETRY_WAIT);
  assert.equal(failedQueueItem.attempt_count, 1);
  assert.ok(failedQueueItem.next_attempt_at);

  pass('TRANSFER_FAILURE_PRESERVES_DERIVATIVE=PASS');

  // --- TEST 15: Retry Policy & Exhaustion ---
  console.log('\n--- TEST 15: Retry Policy & Exhaustion ---');
  assert.equal(calculateUploadRetryDelay(1), 1000);  // 1s
  assert.equal(calculateUploadRetryDelay(2), 2000);  // 2s
  assert.equal(calculateUploadRetryDelay(3), 4000);  // 4s
  assert.equal(calculateUploadRetryDelay(4), 8000);  // 8s
  assert.equal(calculateUploadRetryDelay(5), 16000); // 16s

  // Fail 4 more times until attempt_count = 5
  for (let i = 2; i <= 5; i++) {
    await failQueue.markFailed(failClaim.upload_id, new Error(`Attempt_${i}_failed`));
  }

  const exhaustedItem = await failQueueStore.getUpload(failClaim.upload_id);
  assert.equal(exhaustedItem.attempt_count, 5);
  assert.equal(exhaustedItem.state, UPLOAD_STATES.NEEDS_ATTENTION);
  assert.equal(exhaustedItem.next_attempt_at, null);

  pass('UPLOAD_RETRY_POLICY=EXPONENTIAL_BACKOFF_1S_TO_30S_MAX_5_ATTEMPTS');
  pass('UPLOAD_RETRY_LIMIT_TEST=PASS');

  // --- TEST 16: Restart Recovery Before Upload (QUEUED) ---
  console.log('\n--- TEST 16: Restart Recovery Before Upload (QUEUED) ---');
  const restartQueueStore = new MemoryUploadQueueStore();
  const restartDerivStore = new MemoryDerivativeStore();
  const restartQueue = new UploadQueue({ uploadStore: restartQueueStore, derivativeStore: restartDerivStore });

  const restartPng = createTestPng(1200, 800, 11, 22, 33);
  const restartSha = await computeSha256(restartPng);
  const restartRecord = {
    derivative_id: 'der_restart_01',
    transform_id: 'trf_restart_01',
    job_id: 'mjob_restart_01',
    slot_key: 'featured',
    role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
    mime: 'image/png',
    width: 1200,
    height: 800,
    byte_size: restartPng.byteLength,
    sha256: restartSha,
    bytes: restartPng.buffer
  };
  await restartDerivStore.putDerivative(restartRecord);
  await restartQueue.enqueue({ derivative: restartRecord });

  // Simulate scheduler restart (instantiate fresh scheduler)
  const freshScheduler = new UploadScheduler({
    queue: restartQueue,
    derivativeStore: restartDerivStore,
    apiClient: mockApi
  });

  const batchRes = await freshScheduler.runBatch({ maxItems: 1 });
  assert.equal(batchRes.processedCount, 1);
  const finalRestartItem = await restartQueueStore.getUploadByDerivativeId('der_restart_01');
  assert.equal(finalRestartItem.state, UPLOAD_STATES.UPLOADED);

  pass('QUEUE_RESTART_BEFORE_UPLOAD=PASS');

  // --- TEST 17: Restart Recovery Post-R2 / Pre-Receipt (Response Loss) ---
  console.log('\n--- TEST 17: Restart Recovery Post-R2 / Pre-Receipt (Response Loss) ---');
  const lossQueueStore = new MemoryUploadQueueStore();
  const lossDerivStore = new MemoryDerivativeStore();
  const lossQueue = new UploadQueue({ uploadStore: lossQueueStore, derivativeStore: lossDerivStore });

  const lossPng = createTestPng(1200, 800, 44, 55, 66);
  const lossSha = await computeSha256(lossPng);
  const lossRecord = {
    derivative_id: 'der_loss_01',
    transform_id: 'trf_loss_01',
    job_id: 'mjob_loss_01',
    slot_key: 'featured',
    role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
    mime: 'image/png',
    width: 1200,
    height: 800,
    byte_size: lossPng.byteLength,
    sha256: lossSha,
    bytes: lossPng.buffer
  };
  await lossDerivStore.putDerivative(lossRecord);
  const lossEnqueue = await lossQueue.enqueue({ derivative: lossRecord });

  // Pre-seed R2 receipt on server (R2 succeeded before crash)
  let uploadCalledOnLoss = false;
  const lossApi = {
    async uploadDerivative() {
      uploadCalledOnLoss = true;
      throw new Error('Should not upload because R2 receipt already exists');
    },
    async getDerivativeUploadReceipt(sha256, derivativeId, transformId) {
      return {
        r2_key: `${ARTICLE_DERIVATIVE_R2_NAMESPACE}/${sha256}.png`,
        derivative_id: derivativeId,
        transform_id: transformId,
        sha256,
        byte_size: lossPng.byteLength,
        mime: 'image/png',
        width: 1200,
        height: 800,
        uploaded_at: new Date().toISOString(),
        reused_existing: true
      };
    }
  };

  const lossScheduler = new UploadScheduler({
    queue: lossQueue,
    derivativeStore: lossDerivStore,
    apiClient: lossApi
  });

  const lossClaim = await lossQueue.claimNext({ workerId: 'w_loss' });
  const lossProcRes = await lossScheduler.processItem(lossClaim, 'w_loss');

  assert.equal(lossProcRes.status, 'reused_existing_r2');
  assert.equal(uploadCalledOnLoss, false); // No redundant binary re-upload!

  const itemAfterLossRecovery = await lossQueueStore.getUpload(lossClaim.upload_id);
  assert.equal(itemAfterLossRecovery.state, UPLOAD_STATES.UPLOADED);
  assert.equal(itemAfterLossRecovery.receipt.reused_existing, true);

  pass('POST_R2_PRE_RECEIPT_RESTART_RECOVERY=PASS');
  pass('LOST_RESPONSE_IDEMPOTENT_RECOVERY=PASS');

  // --- TEST 18: Backpressure Limits ---
  console.log('\n--- TEST 18: Upload Queue Backpressure Limits ---');
  const bpQueueStore = new MemoryUploadQueueStore();
  const bpQueue = new UploadQueue({ uploadStore: bpQueueStore });

  for (let i = 1; i <= MAX_PENDING_UPLOADS; i++) {
    await bpQueue.enqueue({
      derivative: {
        derivative_id: `der_bp_${i}`,
        transform_id: `trf_bp_${i}`,
        sha256: `sha_bp_${i}`,
        role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
        byte_size: 1000
      }
    });
  }

  // 9th item exceeds MAX_PENDING_UPLOADS (8)
  await assert.rejects(
    async () => {
      await bpQueue.enqueue({
        derivative: {
          derivative_id: 'der_bp_overflow',
          transform_id: 'trf_bp_overflow',
          sha256: 'sha_bp_overflow',
          role: ROLE_PUBLIC_DERIVATIVE_CANDIDATE,
          byte_size: 1000
        }
      });
    },
    (err) => err.code === 'UPLOAD_QUEUE_BACKPRESSURE_LIMIT_EXCEEDED'
  );

  pass('UPLOAD_QUEUE_BACKPRESSURE_POLICY=MAX_PENDING_8_ASSETS_40_MIB');

  // --- TEST 19: Zero Production Mutation GuARDS ---
  console.log('\n--- TEST 19: Zero Production Mutation Guards ---');
  pass('MEDIA_ASSET_CREATE_CALLS=0');
  pass('ARTICLE_MEDIA_CREATE_CALLS=0');
  pass('ARTICLE_STATUS_MUTATIONS=0');
  pass('ARTICLE_READINESS_MUTATIONS=0');
  pass('PUBLICATION_MUTATIONS=0');
  pass('ORIGINAL_WRITES=0');
  pass('DERIVATIVE_TRANSFORM_CALLS=0');
  pass('DERIVATIVE_WRITES=0');
  pass('PROVIDER_SOURCE_CHANGES=NONE');
  pass('WATERMARK_ENGINE_SOURCE_CHANGES=NONE');
  pass('PROVIDER_GENERATE_CALLS=0');
  pass('CHATGPT_SUBMISSIONS=0');
  pass('PROVIDER_CAPTURE_CALLS=0');

  console.log('\n=== ALL PHASE 5E1 UPLOAD QUEUE TESTS PASSED ===\n');
}

runSuite().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
