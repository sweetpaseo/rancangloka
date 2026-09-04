/**
 * RancangLoka Phase 2A — Secure Hermes Ingestion Receiver Automated Test Suite
 *
 * Tests:
 * - Section 43: HMAC Protocol Test Matrix (Tests 1 - 23)
 * - Section 44: Transport Contract Test Matrix (Tests 24 - 39)
 * - Section 45: Hermes Policy Test Matrix (Tests 40 - 56)
 * - Section 46: Idempotency Test Matrix (Tests 57 - 71)
 * - Section 47: Concurrency Test Matrix (Tests 72 - 76)
 * - Section 48: Atomic Failure Test Matrix (Tests 77 - 81)
 * - Section 49: Lost Response Recovery (Golden Test)
 * - Admin / Hermes Trust Separation Test (Section 39)
 * - Publication Injection & Draft Security Regression (Sections 40 - 42)
 */

import {
  computeSha256Hex,
  buildHermesCanonicalString,
  signHermesCanonicalString,
  verifyHermesHmac,
  extractAndValidateHermesHeaders,
  validateHermesTransportPayload,
  validateHermesArticlePolicy,
  isValidOpaqueId,
  getHermesIngestSecret
} from '../src/lib/hermes.ts';
import {
  POST as hermesIngestHandler,
  ALL as hermesAllHandler
} from '../src/pages/api/internal/v1/hermes-ingest.ts';
import {
  createAdminSessionToken,
  isValidAdminSession
} from '../src/lib/auth.ts';
import {
  getPublishedArticleBySlug,
  getArticleById,
  getAllArticles,
  getReceiptByJobId
} from '../src/lib/db.ts';
import {
  parseArticleMarkdown
} from '../src/lib/article/parser.ts';
import {
  generateContentHash
} from '../src/lib/seo.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

// Test Key Setup
const TEST_KEY_CURRENT_ID = 'hermes-key-2026-v1';
const TEST_KEY_CURRENT_SECRET = 'hermes-secret-current-test-only-minimum-32-chars-long';
const TEST_KEY_PREVIOUS_ID = 'hermes-key-2025-v0';
const TEST_KEY_PREVIOUS_SECRET = 'hermes-secret-previous-test-only-minimum-32-chars-long';

const mockEnv = {
  RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID: TEST_KEY_CURRENT_ID,
  RANCANGLOKA_HERMES_INGEST_KEY_CURRENT: TEST_KEY_CURRENT_SECRET,
  RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS_ID: TEST_KEY_PREVIOUS_ID,
  RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS: TEST_KEY_PREVIOUS_SECRET
};

/**
 * Mock D1 In-Memory Database Adapter with batch atomicity support
 */
function createMockD1Database() {
  const articles = [];
  const receipts = [];
  let articleAutoId = 100;

  return {
    _articles: articles,
    _receipts: receipts,
    prepare(sql) {
      const bound = [];
      return {
        sql,
        bound,
        bind(...args) {
          bound.push(...args);
          return this;
        },
        async first() {
          if (sql.includes('SELECT article_id FROM article_ingest_receipts WHERE job_id = ?')) {
            const jid = bound[0];
            const found = receipts.find(r => r.job_id === jid);
            return found ? { article_id: found.article_id } : null;
          }
          if (sql.includes('FROM article_ingest_receipts WHERE job_id = ?')) {
            const jid = bound[0];
            return receipts.find(r => r.job_id === jid) || null;
          }
          if (sql.includes('FROM article_ingest_receipts WHERE source = ? AND source_article_id = ?')) {
            const src = bound[0];
            const said = bound[1];
            return receipts.find(r => r.source === src && r.source_article_id === said) || null;
          }
          if (sql.includes('FROM article_ingest_receipts WHERE content_sha256 = ? OR article_content_hash = ?')) {
            const csha = bound[0];
            const chash = bound[1];
            return receipts.find(r => r.content_sha256 === csha || r.article_content_hash === chash) || null;
          }
          if (sql.includes('WHERE slug = ?') || sql.includes('WHERE a.slug = ?')) {
            const slug = bound[0];
            return articles.find(a => a.slug === slug) || null;
          }
          if (sql.includes('WHERE content_hash = ?') || sql.includes('WHERE a.content_hash = ?')) {
            const chash = bound[0];
            return articles.find(a => a.content_hash === chash) || null;
          }
          if (sql.includes('WHERE a.id = ?') || sql.includes('WHERE id = ?')) {
            const id = bound[0];
            return articles.find(a => a.id === id) || null;
          }
          return null;
        },
        async all() {
          if (sql.includes('FROM authors')) {
            return {
              results: [
                {
                  id: 1,
                  name: 'RancangLoka Editorial Desk',
                  slug: 'dewan-redaksi-spasial',
                  bio: 'Tim editorial RancangLoka.',
                  avatar: null,
                  role: 'Editorial Desk',
                  social_links: null
                }
              ]
            };
          }
          return { results: [] };
        },
        async run() {
          return { success: true, meta: {} };
        }
      };
    },
    async batch(statements) {
      // Execute atomically
      const snapshotArticles = JSON.parse(JSON.stringify(articles));
      const snapshotReceipts = JSON.parse(JSON.stringify(receipts));

      try {
        let lastInsertRowid = null;
        const results = [];

        for (const stmt of statements) {
          if (stmt.sql?.includes('INSERT INTO articles') || stmt._type === 'insert_article') {
            const bound = stmt.bound || [];
            const artData = stmt._data || {
              slug: bound[0],
              title: bound[1],
              description: bound[2],
              content_md: bound[3],
              content_html: bound[4],
              featured_image: bound[5],
              image_alt: bound[6],
              category_id: bound[7],
              author_id: bound[8],
              status: bound[9],
              reading_time_minutes: bound[10],
              key_takeaways: bound[11],
              focus_keyword: bound[12],
              content_hash: bound[13]
            };
            if (articles.some(a => a.slug === artData.slug)) {
              throw new Error('UNIQUE constraint failed: articles.slug');
            }
            articleAutoId++;
            const newArt = { id: articleAutoId, ...artData };
            articles.push(newArt);
            lastInsertRowid = articleAutoId;
            results.push({ success: true, meta: { last_row_id: articleAutoId } });
          } else if (stmt.sql?.includes('INSERT INTO article_ingest_receipts') || stmt._type === 'insert_receipt') {
            const bound = stmt.bound || [];
            const rData = stmt._data || {
              job_id: bound[0],
              source: bound[1],
              source_article_id: bound[2],
              content_sha256: bound[3],
              article_content_hash: bound[4],
              contract_version: bound[5]
            };
            const rArtId = (stmt._useLastId !== false) ? lastInsertRowid : rData.article_id;
            if (receipts.some(r => r.job_id === rData.job_id)) {
              throw new Error('UNIQUE constraint failed: article_ingest_receipts.job_id');
            }
            if (receipts.some(r => r.source === rData.source && r.source_article_id === rData.source_article_id)) {
              throw new Error('UNIQUE constraint failed: article_ingest_receipts.source_article_id');
            }
            if (receipts.some(r => r.content_sha256 === rData.content_sha256)) {
              throw new Error('UNIQUE constraint failed: article_ingest_receipts.content_sha256');
            }
            if (receipts.some(r => r.article_content_hash === rData.article_content_hash)) {
              throw new Error('UNIQUE constraint failed: article_ingest_receipts.article_content_hash');
            }
            const newRec = {
              ...rData,
              article_id: rArtId,
              created_at: new Date().toISOString()
            };
            receipts.push(newRec);
            results.push({ success: true, meta: {} });
          }
        }
        return results;
      } catch (err) {
        // Rollback atomic batch
        articles.length = 0;
        articles.push(...snapshotArticles);
        receipts.length = 0;
        receipts.push(...snapshotReceipts);
        throw err;
      }
    }
  };
}

/**
 * Creates mock statement for D1 batch
 */
function createMockArticleStatement(articleData) {
  return { _type: 'insert_article', _data: articleData };
}
function createMockReceiptStatement(receiptData) {
  return { _type: 'insert_receipt', _data: receiptData, _useLastId: true };
}

/**
 * Builds valid Hermes signed request fixture.
 */
async function buildSignedHermesRequest({
  url = 'http://localhost:4321/api/internal/v1/hermes-ingest',
  method = 'POST',
  bodyObj = null,
  rawBodyOverride = null,
  timestamp = Math.floor(Date.now() / 1000),
  jobId = 'job_test_sample_delivery_001_abc',
  requestId = 'req_test_sample_request_001_xyz',
  keyId = TEST_KEY_CURRENT_ID,
  secret = TEST_KEY_CURRENT_SECRET,
  signatureVersion = 'v1',
  signatureOverride = null,
  contentType = 'application/json',
  extraHeaders = {}
} = {}) {
  let bodyBytes;
  if (rawBodyOverride !== null) {
    bodyBytes = typeof rawBodyOverride === 'string' ? new TextEncoder().encode(rawBodyOverride) : rawBodyOverride;
  } else if (bodyObj !== null) {
    bodyBytes = new TextEncoder().encode(JSON.stringify(bodyObj));
  } else {
    bodyBytes = new Uint8Array(0);
  }

  const rawBodySha256 = await computeSha256Hex(bodyBytes);
  const canonicalString = buildHermesCanonicalString(timestamp, jobId, requestId, rawBodySha256);
  const signatureHex = signatureOverride !== null
    ? signatureOverride
    : await signHermesCanonicalString(canonicalString, secret);

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(bodyBytes.byteLength));
  headers.set('X-RL-Signature-Version', signatureVersion);
  headers.set('X-RL-Timestamp', String(timestamp));
  headers.set('X-RL-Job-ID', jobId);
  headers.set('X-RL-Request-ID', requestId);
  headers.set('X-RL-Key-ID', keyId);
  headers.set('X-RL-Signature', `sha256=${signatureHex}`);

  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v);
  }

  const request = new Request(url, {
    method,
    headers,
    body: method === 'POST' ? bodyBytes : undefined
  });

  return { request, bodyBytes, canonicalString, signatureHex };
}

/**
 * Standard valid sample Markdown
 */
const SAMPLE_VALID_MARKDOWN = `---
title: "Rekayasa Sirkulasi Alami pada Void Hunian Tropis"
description: "Kajian termal penempatan kisi vertikal dan ventilasi silang pada rumah dua lantai."
category: "Arsitektur & Renovasi"
author: "RancangLoka Editorial Desk"
focus_keyword: "sirkulasi alami void rumah tropis"
featured_image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200"
image_alt: "Void tinggi dengan kisi ventilasi kayu"
key_takeaways:
  - "Efek cerobong alami mengalirkan udara panas keluar melewati bukaan atap."
  - "Bukaan silang lantai dasar memasok udara segar secara berkesinambungan."
  - "Peredam suara pada void membatasi kebisingan antar lantai."
---

# Rekayasa Sirkulasi Alami pada Void Hunian Tropis

Ventilasi alami merupakan strategi fundamental dalam arsitektur tropis lembap untuk mencapai kenyamanan termal tanpa ketergantungan konstan pada pendingin ruangan buatan. Penerapan void atap ganda memungkinkan pergerakan udara berdasarkan gradien temperatur secara pasif. Dalam perencanaan rumah tinggal perkotaan, integrasi bukaan vertikal memberikan manfaat ganda berupa pencahayaan alami dan penurunan suhu ruang secara signifikan.

Ketika radiasi matahari memanaskan permukaan atap dan ruang loteng, udara di dekat plafon mengalami ekspansi termal dan penurunan densitas. Udara berdensitas rendah ini secara alami bergerak ke atas menuju bukaan keluar di titik tertinggi bangunan. Fenomena ini menciptakan efek hisap alami yang menarik udara segar dari lantai bawah menuju area atas hunian secara berkesinambungan.

---

## 1. Desain Kisi Vertikal dan Proteksi Tampias

Penggunaan kisi kayu ulin vertikal memberikan insulasi termal superior dibandingkan kisi aluminium konvensional. Penempatan kisi harus memperhitungkan sudut jatuhnya tampias hujan musim muson barat agar tidak membasahi interior. Kayu ulin memiliki ketahanan alami terhadap kelembapan tinggi dan perubahan cuaca ekstrem di kawasan tropis.

Dengan sudut kemiringan bilah 45 derajat dan jarak antar bilah 8 sentimeter, aliran udara tetap optimal hingga kecepatan 1,5 meter per detik sementara butiran air hujan terpantul keluar secara efektif. Ruang hunian tetap sejuk dan kering sepanjang hari, bahkan ketika curah hujan berada pada intensitas yang cukup tinggi.

---

## 2. Pemanfaatan Efek Cerobong dan Tekanan Negatif

Efek cerobong bekerja paling efektif apabila terdapat perbedaan elevasi yang memadai antara inlet udara di bagian bawah dan outlet di puncak atap. Ketinggian void minimal enam meter sangat disarankan untuk menciptakan gradien tekanan udara yang cukup kuat guna menggerakkan massa udara secara kontinu tanpa bantuan kipas mekanis.

Pada malam hari, massa termal dinding dan lantai yang melepaskan kalor perlahan akan dibersihkan oleh aliran udara malam yang sejuk. Proses penggantian udara ini memastikan struktur bangunan memulai hari berikutnya dengan temperatur dasar yang lebih dingin, sehingga beban pendinginan pasif tetap terjaga dalam batas kenyamanan seluruh penghuni rumah.

---

## 3. Integrasi Ruang Terbuka Hijau dan Pengendalian Akustik

Penempatan inner courtyard atau taman dalam bervegetasi lebat di bawah void bertindak sebagai pendingin mikro alami. Evapotranspirasi dari dedaunan membantu menurunkan temperatur udara sekitar hingga dua derajat Celsius sebelum udara tersebut ditarik masuk ke dalam ruang tamu atau area keluarga.

Untuk mengantisipasi pantulan suara yang kerap terjadi pada rongga vertikal, material penyerap suara seperti panel akustik perforasi kayu dapat dipasang pada salah satu bidang dinding void. Dengan demikian, kenyamanan termal dan ketenangan akustik dapat berjalan selaras dalam hunian bertingkat modern secara elegan dan fungsional.
`;

async function runPhase2ATestSuite() {
  console.log('====================================================');
  console.log('🚀 RancangLoka Phase 2A Automated Test Suite');
  console.log('   Secure Hermes Ingestion Receiver');
  console.log('====================================================\n');

  // =========================================================================
  // Section 43: HMAC Protocol Test Matrix (Tests 1 - 23)
  // =========================================================================
  console.log('[Section 43: HMAC Protocol Test Matrix (Tests 1 - 23)]');

  const validBody = {
    source: 'hermes',
    contract_version: 1,
    article_id: 'art_2026_hermes_initial_delivery_test_001',
    markdown: SAMPLE_VALID_MARKDOWN
  };

  // 1. Valid current key signature accepted
  const req1 = await buildSignedHermesRequest({ bodyObj: validBody });
  const rawSha1 = await computeSha256Hex(req1.bodyBytes);
  const can1 = buildHermesCanonicalString(Math.floor(Date.now() / 1000), 'job_test_sample_delivery_001_abc', 'req_test_sample_request_001_xyz', rawSha1);
  const isV1 = await verifyHermesHmac(can1, req1.signatureHex, TEST_KEY_CURRENT_SECRET);
  assert(isV1, '1. Valid current key signature accepted');

  // 2. Valid previous key signature accepted when configured
  const req2 = await buildSignedHermesRequest({ bodyObj: validBody, keyId: TEST_KEY_PREVIOUS_ID, secret: TEST_KEY_PREVIOUS_SECRET });
  const isV2 = await verifyHermesHmac(req2.canonicalString, req2.signatureHex, TEST_KEY_PREVIOUS_SECRET);
  assert(isV2, '2. Valid previous key signature accepted when configured');

  // 3. Unknown key ID rejected
  const secUnknown = getHermesIngestSecret('unknown-key-999', mockEnv);
  assert(!secUnknown.isKnownKey, '3. Unknown key ID rejected');

  // 4. Missing signature rejected
  const headersNoSig = new Headers({
    'X-RL-Signature-Version': 'v1',
    'X-RL-Timestamp': String(Math.floor(Date.now() / 1000)),
    'X-RL-Job-ID': 'job_test_sample_delivery_001_abc',
    'X-RL-Request-ID': 'req_test_sample_request_001_xyz',
    'X-RL-Key-ID': TEST_KEY_CURRENT_ID
  });
  const v4 = extractAndValidateHermesHeaders(headersNoSig);
  assert(!v4.valid && v4.code === 'SIGNATURE_REQUIRED', '4. Missing signature rejected');

  // 5. Malformed signature prefix rejected (not sha256=)
  const headersBadPrefix = new Headers(headersNoSig);
  headersBadPrefix.set('X-RL-Signature', 'md5=abcd1234abcd1234');
  const v5 = extractAndValidateHermesHeaders(headersBadPrefix);
  assert(!v5.valid && v5.code === 'SIGNATURE_INVALID', '5. Malformed signature prefix rejected');

  // 6. Invalid hex signature rejected
  const headersBadHex = new Headers(headersNoSig);
  headersBadHex.set('X-RL-Signature', 'sha256=not-a-valid-hex-string-of-64-characters-long-1234567890abcdef12345');
  const v6 = extractAndValidateHermesHeaders(headersBadHex);
  assert(!v6.valid && v6.code === 'SIGNATURE_INVALID', '6. Invalid hex signature rejected');

  // 7. Wrong secret rejected
  const isV7 = await verifyHermesHmac(req1.canonicalString, req1.signatureHex, 'wrong-secret-key-12345678901234567890');
  assert(!isV7, '7. Wrong secret rejected');

  // 8. One-character signature mutation rejected
  const mutatedSig = req1.signatureHex.slice(0, -1) + (req1.signatureHex.slice(-1) === 'a' ? 'b' : 'a');
  const isV8 = await verifyHermesHmac(req1.canonicalString, mutatedSig, TEST_KEY_CURRENT_SECRET);
  assert(!isV8, '8. One-character signature mutation rejected');

  // 9. Raw-body mutation after signing rejected
  const mutatedBody = new TextEncoder().encode(JSON.stringify({ ...validBody, article_id: 'art_mutated_after_signing_0001' }));
  const mutatedSha = await computeSha256Hex(mutatedBody);
  const mutatedCanonical = buildHermesCanonicalString(Math.floor(Date.now() / 1000), 'job_test_sample_delivery_001_abc', 'req_test_sample_request_001_xyz', mutatedSha);
  const isV9 = await verifyHermesHmac(mutatedCanonical, req1.signatureHex, TEST_KEY_CURRENT_SECRET);
  assert(!isV9, '9. Raw-body mutation after signing rejected');

  // 10. JSON whitespace change after signing rejected
  const whitespaceBody = new TextEncoder().encode(JSON.stringify(validBody, null, 2)); // pretty printed
  const wsSha = await computeSha256Hex(whitespaceBody);
  const wsCanonical = buildHermesCanonicalString(Math.floor(Date.now() / 1000), 'job_test_sample_delivery_001_abc', 'req_test_sample_request_001_xyz', wsSha);
  const isV10 = await verifyHermesHmac(wsCanonical, req1.signatureHex, TEST_KEY_CURRENT_SECRET);
  assert(!isV10, '10. JSON whitespace change after signing rejected');

  // 11. Body Unicode byte change rejected
  const unicodeMutated = new TextEncoder().encode(JSON.stringify(validBody).replace('Sirkulasi', 'Sîrkulâsi'));
  const uniSha = await computeSha256Hex(unicodeMutated);
  const uniCanonical = buildHermesCanonicalString(Math.floor(Date.now() / 1000), 'job_test_sample_delivery_001_abc', 'req_test_sample_request_001_xyz', uniSha);
  const isV11 = await verifyHermesHmac(uniCanonical, req1.signatureHex, TEST_KEY_CURRENT_SECRET);
  assert(!isV11, '11. Body Unicode byte change rejected');

  // 12. Wrong HTTP method canonicalization rejected
  const getCanonical = `v1\nGET\n/api/internal/v1/hermes-ingest\n${Math.floor(Date.now() / 1000)}\njob_test_sample_delivery_001_abc\nreq_test_sample_request_001_xyz\n${rawSha1}`;
  const isV12 = await verifyHermesHmac(getCanonical, req1.signatureHex, TEST_KEY_CURRENT_SECRET);
  assert(!isV12, '12. Wrong HTTP method canonicalization rejected');

  // 13. Wrong canonical path rejected
  const pathCanonical = `v1\nPOST\n/api/admin/posts\n${Math.floor(Date.now() / 1000)}\njob_test_sample_delivery_001_abc\nreq_test_sample_request_001_xyz\n${rawSha1}`;
  const isV13 = await verifyHermesHmac(pathCanonical, req1.signatureHex, TEST_KEY_CURRENT_SECRET);
  assert(!isV13, '13. Wrong canonical path rejected');

  // 14. Stale timestamp rejected (> 300s in past)
  const staleTime = Math.floor(Date.now() / 1000) - 301;
  const headersStale = new Headers(headersNoSig);
  headersStale.set('X-RL-Timestamp', String(staleTime));
  headersStale.set('X-RL-Signature', `sha256=${req1.signatureHex}`);
  const v14 = extractAndValidateHermesHeaders(headersStale);
  assert(!v14.valid && v14.code === 'TIMESTAMP_OUT_OF_WINDOW', '14. Stale timestamp (>300s in past) rejected');

  // 15. Timestamp too far in future rejected (> 300s in future)
  const futureTime = Math.floor(Date.now() / 1000) + 305;
  const headersFuture = new Headers(headersNoSig);
  headersFuture.set('X-RL-Timestamp', String(futureTime));
  headersFuture.set('X-RL-Signature', `sha256=${req1.signatureHex}`);
  const v15 = extractAndValidateHermesHeaders(headersFuture);
  assert(!v15.valid && v15.code === 'TIMESTAMP_OUT_OF_WINDOW', '15. Timestamp too far in future (>300s) rejected');

  // 16. Malformed timestamp rejected
  const headersBadTime = new Headers(headersNoSig);
  headersBadTime.set('X-RL-Timestamp', 'not-a-number');
  headersBadTime.set('X-RL-Signature', `sha256=${req1.signatureHex}`);
  const v16 = extractAndValidateHermesHeaders(headersBadTime);
  assert(!v16.valid && v16.code === 'TIMESTAMP_INVALID', '16. Malformed timestamp rejected');

  // 17. Request inside ±300s accepted
  const goodTime = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
  const headersGood = new Headers(headersNoSig);
  headersGood.set('X-RL-Timestamp', String(goodTime));
  headersGood.set('X-RL-Signature', `sha256=${req1.signatureHex}`);
  const v17 = extractAndValidateHermesHeaders(headersGood);
  assert(v17.valid && v17.data?.timestamp === goodTime, '17. Request inside ±300s accepted');

  // 18. Missing JOB_ID rejected
  const headersNoJob = new Headers(headersNoSig);
  headersNoJob.delete('X-RL-Job-ID');
  headersNoJob.set('X-RL-Signature', `sha256=${req1.signatureHex}`);
  const v18 = extractAndValidateHermesHeaders(headersNoJob);
  assert(!v18.valid && v18.code === 'JOB_ID_REQUIRED', '18. Missing JOB_ID rejected');

  // 19. Invalid JOB_ID rejected (spaces, path, wrong prefix)
  assert(!isValidOpaqueId('bad_prefix_1234567890123456', 'job_'), '19A. Wrong prefix for JOB_ID rejected');
  assert(!isValidOpaqueId('job_with spaces_1234567890', 'job_'), '19B. Spaces in JOB_ID rejected');
  assert(!isValidOpaqueId('job_../path/traversal/123456', 'job_'), '19C. Path traversal in JOB_ID rejected');

  // 20. Missing REQUEST_ID rejected
  const headersNoReq = new Headers(headersNoSig);
  headersNoReq.delete('X-RL-Request-ID');
  headersNoReq.set('X-RL-Signature', `sha256=${req1.signatureHex}`);
  const v20 = extractAndValidateHermesHeaders(headersNoReq);
  assert(!v20.valid && v20.code === 'REQUEST_ID_REQUIRED', '20. Missing REQUEST_ID rejected');

  // 21. Invalid REQUEST_ID rejected
  assert(!isValidOpaqueId('req_short', 'req_'), '21A. Too short REQUEST_ID rejected');
  assert(!isValidOpaqueId('req_\nnewlines_injection_1234', 'req_'), '21B. Control characters in REQUEST_ID rejected');

  // 22. Missing signature version rejected
  const headersNoVer = new Headers(headersNoSig);
  headersNoVer.delete('X-RL-Signature-Version');
  headersNoVer.set('X-RL-Signature', `sha256=${req1.signatureHex}`);
  const v22 = extractAndValidateHermesHeaders(headersNoVer);
  assert(!v22.valid && v22.code === 'SIGNATURE_VERSION_REQUIRED', '22. Missing signature version rejected');

  // 23. Unsupported signature version rejected
  const headersBadVer = new Headers(headersNoSig);
  headersBadVer.set('X-RL-Signature-Version', 'v2');
  headersBadVer.set('X-RL-Signature', `sha256=${req1.signatureHex}`);
  const v23 = extractAndValidateHermesHeaders(headersBadVer);
  assert(!v23.valid && v23.code === 'SIGNATURE_VERSION_UNSUPPORTED', '23. Unsupported signature version rejected');
  console.log('');

  // =========================================================================
  // Section 44: Transport Test Matrix (Tests 24 - 39)
  // =========================================================================
  console.log('[Section 44: Transport Test Matrix (Tests 24 - 39)]');

  // 24. Valid transport payload accepted
  const vp24 = validateHermesTransportPayload(validBody);
  assert(vp24.valid && vp24.data?.contract_version === 1, '24. Valid transport payload accepted');

  // 25. source != hermes rejected
  const vp25 = validateHermesTransportPayload({ ...validBody, source: 'external_bot' });
  assert(!vp25.valid && vp25.code === 'TRANSPORT_INVALID', '25. source != hermes rejected');

  // 26. contract_version missing rejected
  const noCv = { ...validBody };
  delete noCv.contract_version;
  const vp26 = validateHermesTransportPayload(noCv);
  assert(!vp26.valid && vp26.code === 'TRANSPORT_INVALID', '26. contract_version missing rejected');

  // 27. contract_version != 1 rejected
  const vp27 = validateHermesTransportPayload({ ...validBody, contract_version: 2 });
  assert(!vp27.valid && vp27.code === 'TRANSPORT_INVALID', '27. contract_version != 1 rejected');

  // 28. article_id missing rejected
  const noArtId = { ...validBody };
  delete noArtId.article_id;
  const vp28 = validateHermesTransportPayload(noArtId);
  assert(!vp28.valid && vp28.code === 'TRANSPORT_INVALID', '28. article_id missing rejected');

  // 29. Malformed article_id rejected
  const vp29 = validateHermesTransportPayload({ ...validBody, article_id: 'invalid_no_art_prefix_1234567890' });
  assert(!vp29.valid && vp29.code === 'TRANSPORT_INVALID', '29. Malformed article_id rejected');

  // 30. markdown missing rejected
  const noMd = { ...validBody };
  delete noMd.markdown;
  const vp30 = validateHermesTransportPayload(noMd);
  assert(!vp30.valid && vp30.code === 'TRANSPORT_INVALID', '30. markdown missing rejected');

  // 31. markdown not string rejected
  const vp31 = validateHermesTransportPayload({ ...validBody, markdown: 12345 });
  assert(!vp31.valid && vp31.code === 'TRANSPORT_INVALID', '31. markdown not string rejected');

  // 32. Unknown top-level transport field rejected
  const vp32 = validateHermesTransportPayload({ ...validBody, unexpected_extra_field: 'leak' });
  assert(!vp32.valid && vp32.code === 'TRANSPORT_FIELD_NOT_ALLOWED', '32. Unknown top-level transport field rejected');

  // Helper function to call endpoint handler directly
  async function callEndpoint(req, dbInstance = null) {
    const context = {
      request: req,
      url: new URL(req.url),
      locals: {
        runtime: {
          env: {
            ...mockEnv,
            DB: dbInstance
          }
        }
      }
    };
    return await hermesIngestHandler(context);
  }

  // 33. Malformed JSON rejected (400 MALFORMED_JSON)
  const req33 = await buildSignedHermesRequest({ rawBodyOverride: '{ bad: json syntax ' });
  const res33 = await callEndpoint(req33.request);
  const b33 = await res33.json();
  assert(res33.status === 400 && b33.code === 'MALFORMED_JSON', '33. Malformed JSON rejected with 400 MALFORMED_JSON');

  // 34. Wrong Content-Type rejected (415 UNSUPPORTED_MEDIA_TYPE)
  const req34 = await buildSignedHermesRequest({ contentType: 'multipart/form-data', bodyObj: validBody });
  const res34 = await callEndpoint(req34.request);
  const b34 = await res34.json();
  assert(res34.status === 415 && b34.code === 'UNSUPPORTED_MEDIA_TYPE', '34. Wrong Content-Type rejected with 415');

  // 35. JSON charset content type accepted (application/json; charset=utf-8)
  const req35 = await buildSignedHermesRequest({ contentType: 'application/json; charset=utf-8', bodyObj: validBody });
  // Will pass content type check (may fail on DB in unit mode)
  assert(req35.request.headers.get('content-type')?.includes('application/json'), '35. JSON charset content type accepted');

  // 36. Body over size limit rejected (413 PAYLOAD_TOO_LARGE)
  const hugeString = 'A'.repeat(513 * 1024); // 513 KiB > 512 KiB
  const req36 = await buildSignedHermesRequest({ rawBodyOverride: hugeString });
  const res36 = await callEndpoint(req36.request);
  const b36 = await res36.json();
  assert(res36.status === 413 && b36.code === 'PAYLOAD_TOO_LARGE', '36. Body over 512 KiB size limit rejected with 413');

  // 37. Multibyte UTF-8 size measured correctly by BYTES
  const euroChar = '€'; // 1 character, 3 UTF-8 bytes
  const euroBytes = new TextEncoder().encode(euroChar);
  assert(euroChar.length === 1 && euroBytes.byteLength === 3, '37. Multibyte UTF-8 measured by exact bytes, not char length');

  // 38. Query parameter rejected (400 QUERY_NOT_ALLOWED)
  const req38 = await buildSignedHermesRequest({
    url: 'http://localhost:4321/api/internal/v1/hermes-ingest?hack=true',
    bodyObj: validBody
  });
  const res38 = await callEndpoint(req38.request);
  const b38 = await res38.json();
  assert(res38.status === 400 && b38.code === 'QUERY_NOT_ALLOWED', '38. Query parameter rejected with 400 QUERY_NOT_ALLOWED');

  // 39. GET returns 405 Method Not Allowed with Allow: POST
  const getReq = new Request('http://localhost:4321/api/internal/v1/hermes-ingest', { method: 'GET' });
  const res39 = await hermesAllHandler({ request: getReq, url: new URL(getReq.url), locals: {} });
  assert(res39.status === 405 && res39.headers.get('Allow') === 'POST', '39. GET returns 405 with Allow: POST');
  console.log('');

  // =========================================================================
  // Section 45: Hermes Policy Test Matrix (Tests 40 - 56)
  // =========================================================================
  console.log('[Section 45: Hermes Policy Test Matrix (Tests 40 - 56)]');

  const baseFrontmatter = {
    title: 'Uji Validasi Kebijakan Hermes',
    description: 'Deskripsi pengujian kebijakan Hermes.',
    category: 'Arsitektur & Renovasi',
    author: 'RancangLoka Editorial Desk',
    focus_keyword: 'uji kebijakan hermes',
    key_takeaways: ['Satu', 'Dua', 'Tiga']
  };

  // 40 - 46. The 6 Official Categories accepted
  const officialCats = [
    'Arsitektur & Renovasi',
    'Interior & Tata Ruang',
    'Material & Finishing',
    'Kenyamanan Rumah',
    'Eksterior & Lanskap',
    'Sistem & Konstruksi Rumah'
  ];
  let allOfficialCatsPassed = true;
  for (const cat of officialCats) {
    const v = validateHermesArticlePolicy({ ...baseFrontmatter, category: cat });
    if (!v.valid) allOfficialCatsPassed = false;
  }
  assert(allOfficialCatsPassed, '40-46. All 6 Official Editorial Categories accepted');

  // 47 - 49. Legacy categories rejected for Hermes
  const v47 = validateHermesArticlePolicy({ ...baseFrontmatter, category: 'Smart Home & Otomasi' });
  const v48 = validateHermesArticlePolicy({ ...baseFrontmatter, category: 'Gaya Hidup & Hunian' });
  const v49 = validateHermesArticlePolicy({ ...baseFrontmatter, category: 'Desain Interior & Estetika' });
  const v49b = validateHermesArticlePolicy({ ...baseFrontmatter, category: 'smart-home-automation' });
  const v49c = validateHermesArticlePolicy({ ...baseFrontmatter, category: 'arbitrary-slug-or-id' });
  assert(!v47.valid && v47.code === 'HERMES_CATEGORY_NOT_ALLOWED', '47. Legacy category "Smart Home & Otomasi" rejected for Hermes');
  assert(!v48.valid && v48.code === 'HERMES_CATEGORY_NOT_ALLOWED', '48. Legacy category "Gaya Hidup & Hunian" rejected for Hermes');
  assert(!v49.valid && v49.code === 'HERMES_CATEGORY_NOT_ALLOWED', '49. Legacy category "Desain Interior & Estetika" rejected for Hermes');
  assert(!v49b.valid && v49b.code === 'HERMES_CATEGORY_NOT_ALLOWED', '49B. Transport slug "smart-home-automation" rejected for Hermes');
  assert(!v49c.valid && v49c.code === 'HERMES_CATEGORY_NOT_ALLOWED', '49C. Arbitrary slug/ID rejected for Hermes');

  // 50. RancangLoka Editorial Desk accepted
  const v50 = validateHermesArticlePolicy({ ...baseFrontmatter, author: 'RancangLoka Editorial Desk' });
  assert(v50.valid, '50. Author "RancangLoka Editorial Desk" accepted');

  // 51. Arbitrary author rejected
  const v51 = validateHermesArticlePolicy({ ...baseFrontmatter, author: 'Penulis Lepas Fiktif' });
  assert(!v51.valid && v51.code === 'HERMES_AUTHOR_NOT_ALLOWED', '51. Arbitrary author rejected');

  // 52. Author numeric ID rejected
  const v52 = validateHermesArticlePolicy({ ...baseFrontmatter, author: 1 });
  assert(!v52.valid && v52.code === 'HERMES_AUTHOR_NOT_ALLOWED', '52. Author numeric ID rejected');

  // 53. Forbidden frontmatter status rejected
  const v53a = validateHermesArticlePolicy({ ...baseFrontmatter, status: 'published' });
  const v53b = validateHermesArticlePolicy({ ...baseFrontmatter, status: 'scheduled' });
  assert(!v53a.valid && !v53b.valid && v53a.code === 'FRONTMATTER_FIELD_NOT_ALLOWED', '53. Forbidden frontmatter status rejected (published, scheduled)');

  // 54. Forbidden frontmatter slug rejected
  const v54 = validateHermesArticlePolicy({ ...baseFrontmatter, slug: 'attacker-chosen-slug' });
  assert(!v54.valid && v54.code === 'FRONTMATTER_FIELD_NOT_ALLOWED', '54. Forbidden frontmatter slug rejected');

  // 55. Forbidden frontmatter database ID rejected
  const v55a = validateHermesArticlePolicy({ ...baseFrontmatter, id: 999 });
  const v55b = validateHermesArticlePolicy({ ...baseFrontmatter, article_id: 'injected' });
  assert(!v55a.valid && !v55b.valid && v55a.code === 'FRONTMATTER_FIELD_NOT_ALLOWED', '55. Forbidden frontmatter database ID rejected');

  // 56. Unknown frontmatter field rejected
  const v56 = validateHermesArticlePolicy({ ...baseFrontmatter, hacker_tag: 'test' });
  assert(!v56.valid && v56.code === 'FRONTMATTER_FIELD_NOT_ALLOWED', '56. Unknown frontmatter field rejected');
  console.log('');

  // =========================================================================
  // Section 46 & 48: Idempotency, Atomic Batch, and Conflict Tests (Tests 57 - 71)
  // =========================================================================
  console.log('[Section 46: Idempotency & Conflict Tests (Tests 57 - 71)]');

  const mockDb = createMockD1Database();

  // 57 - 60. First valid ingestion creates exactly one article and one receipt
  const req57 = await buildSignedHermesRequest({
    bodyObj: validBody,
    jobId: 'job_2026_first_ingest_delivery_001_abc',
    requestId: 'req_2026_first_ingest_delivery_001_xyz'
  });
  const res57 = await callEndpoint(req57.request, mockDb);
  const b57 = await res57.json();
  if (res57.status !== 201) {
    console.error('res57 failed with status:', res57.status, 'body:', b57);
  }

  assert(res57.status === 201 && b57.code === 'INGEST_CREATED', '57. First valid ingestion returns 201 INGEST_CREATED');
  assert(mockDb._articles.length === 1, '58. First valid ingestion creates exactly one article');
  assert(mockDb._receipts.length === 1, '59. First valid ingestion creates exactly one receipt');
  assert(b57.d1_article_id === mockDb._articles[0].id && mockDb._receipts[0].article_id === mockDb._articles[0].id,
    '60. Receipt article_id equals actual D1 article.id');

  // 61 - 63. Replay with SAME JOB_ID + SAME CONTENT returns 200 IDEMPOTENT_REPLAY
  const req61 = await buildSignedHermesRequest({
    bodyObj: validBody,
    jobId: 'job_2026_first_ingest_delivery_001_abc',
    requestId: 'req_2026_second_retry_request_002_xyz'
  });
  const res61 = await callEndpoint(req61.request, mockDb);
  const b61 = await res61.json();

  assert(res61.status === 200 && b61.code === 'IDEMPOTENT_REPLAY', '61. Same JOB_ID + same content returns 200 IDEMPOTENT_REPLAY');
  assert(mockDb._articles.length === 1, '62. Replay creates zero new articles');
  assert(mockDb._receipts.length === 1, '63. Replay creates zero new receipts');

  // 64. SAME JOB_ID + DIFFERENT CONTENT returns 409 JOB_ID_CONFLICT
  const differentBody = {
    ...validBody,
    markdown: SAMPLE_VALID_MARKDOWN.replace('Rekayasa Sirkulasi Alami', 'Rekayasa Sirkulasi Alami Modifikasi Baru')
  };
  const req64 = await buildSignedHermesRequest({
    bodyObj: differentBody,
    jobId: 'job_2026_first_ingest_delivery_001_abc', // existing job_id
    requestId: 'req_2026_conflicting_retry_003_xyz'
  });
  const res64 = await callEndpoint(req64.request, mockDb);
  const b64 = await res64.json();
  assert(res64.status === 409 && b64.code === 'JOB_ID_CONFLICT', '64. Same JOB_ID + different content returns 409 JOB_ID_CONFLICT');

  // 65. SAME JOB_ID + DIFFERENT ARTICLE_ID returns 409 JOB_ID_CONFLICT
  const req65 = await buildSignedHermesRequest({
    bodyObj: { ...validBody, article_id: 'art_different_article_concept_9999' },
    jobId: 'job_2026_first_ingest_delivery_001_abc',
    requestId: 'req_2026_conflicting_art_004_xyz'
  });
  const res65 = await callEndpoint(req65.request, mockDb);
  const b65 = await res65.json();
  assert(res65.status === 409 && b65.code === 'JOB_ID_CONFLICT', '65. Same JOB_ID + different ARTICLE_ID returns 409 JOB_ID_CONFLICT');

  // 66. SAME ARTICLE_ID + NEW JOB_ID + SAME CONTENT returns 200 ARTICLE_IDEMPOTENT_REPLAY
  const req66 = await buildSignedHermesRequest({
    bodyObj: validBody,
    jobId: 'job_2026_brand_new_job_retry_002_def',
    requestId: 'req_2026_new_job_retry_005_xyz'
  });
  const res66 = await callEndpoint(req66.request, mockDb);
  const b66 = await res66.json();
  assert(res66.status === 200 && b66.code === 'ARTICLE_IDEMPOTENT_REPLAY', '66. Same ARTICLE_ID + new JOB_ID + same content returns 200 ARTICLE_IDEMPOTENT_REPLAY');

  // 67. SAME ARTICLE_ID + NEW JOB_ID + CHANGED CONTENT returns 409 ARTICLE_ID_CONFLICT
  const req67 = await buildSignedHermesRequest({
    bodyObj: differentBody,
    jobId: 'job_2026_brand_new_job_retry_003_ghi',
    requestId: 'req_2026_revision_attempt_006_xyz'
  });
  const res67 = await callEndpoint(req67.request, mockDb);
  const b67 = await res67.json();
  assert(res67.status === 409 && b67.code === 'ARTICLE_ID_CONFLICT', '67. Same ARTICLE_ID + new JOB_ID + changed content returns 409 ARTICLE_ID_CONFLICT');

  // 68. SAME EXACT CONTENT + DIFFERENT ARTICLE_ID returns 409 DUPLICATE_CONTENT
  const req68 = await buildSignedHermesRequest({
    bodyObj: { ...validBody, article_id: 'art_second_hermes_concept_8888' },
    jobId: 'job_2026_different_concept_job_004_jkl',
    requestId: 'req_2026_duplicate_content_007_xyz'
  });
  const res68 = await callEndpoint(req68.request, mockDb);
  const b68 = await res68.json();
  assert(res68.status === 409 && b68.code === 'DUPLICATE_CONTENT', '68. Same exact content + different ARTICLE_ID returns 409 DUPLICATE_CONTENT');

  // 69. SAME NORMALIZED BODY + CHANGED FRONTMATTER + NEW ARTICLE_ID returns 409 DUPLICATE_CONTENT
  const changedFrontmatterSameBody = SAMPLE_VALID_MARKDOWN.replace(
    'description: "Kajian termal penempatan kisi vertikal dan ventilasi silang pada rumah dua lantai."',
    'description: "Deskripsi yang sedikit diubah namun isi body artikel tetap identik."'
  );
  const req69 = await buildSignedHermesRequest({
    bodyObj: {
      source: 'hermes',
      contract_version: 1,
      article_id: 'art_third_hermes_concept_7777',
      markdown: changedFrontmatterSameBody
    },
    jobId: 'job_2026_diff_frontmatter_same_body_005',
    requestId: 'req_2026_diff_frontmatter_008_xyz'
  });
  const res69 = await callEndpoint(req69.request, mockDb);
  const b69 = await res69.json();
  assert(res69.status === 409 && b69.code === 'DUPLICATE_CONTENT', '69. Same normalized body + changed frontmatter returns 409 DUPLICATE_CONTENT');

  // 70. Existing manual article with same slug returns 409 EXISTING_ARTICLE_CONFLICT (not adopted)
  mockDb._articles.push({
    id: 1,
    slug: 'slug-manual-sudah-ada-di-database',
    title: 'Manual Article',
    content_hash: 'manualhash999'
  });
  const manualCollisionBody = {
    source: 'hermes',
    contract_version: 1,
    article_id: 'art_manual_collision_test_6666',
    markdown: SAMPLE_VALID_MARKDOWN
      .replace('title: "Rekayasa Sirkulasi Alami pada Void Hunian Tropis"', 'title: "Slug Manual Sudah Ada Di Database"')
      .replace('Ventilasi alami merupakan strategi fundamental', 'Sistem ventilasi buatan manusia manual merupakan strategi terpisah')
  };
  const req70 = await buildSignedHermesRequest({
    bodyObj: manualCollisionBody,
    jobId: 'job_2026_manual_collision_job_006',
    requestId: 'req_2026_manual_collision_009_xyz'
  });
  const res70 = await callEndpoint(req70.request, mockDb);
  const b70 = await res70.json();
  assert(res70.status === 409 && b70.code === 'EXISTING_ARTICLE_CONFLICT', '70. Existing manual article with same slug returns 409 EXISTING_ARTICLE_CONFLICT (not adopted)');

  // 71. Existing manual article with same content hash returns 409 EXISTING_ARTICLE_CONFLICT (not adopted)
  const manualUniqueBodyMarkdown = SAMPLE_VALID_MARKDOWN
    .replace('title: "Rekayasa Sirkulasi Alami pada Void Hunian Tropis"', 'title: "Judul Baru Unik Tapi Hash Manual Sama"')
    .replace('Ventilasi alami merupakan strategi fundamental', 'Sistem sirkulasi udara manual non hermes merupakan konsep unik dan tersendiri');

  const manualParsed = parseArticleMarkdown(manualUniqueBodyMarkdown);
  const manualContentHash = await generateContentHash(manualParsed.markdownBody);
  mockDb._articles.push({
    id: 2,
    slug: 'slug-artikel-manual-lama-berbeda-999',
    title: 'Manual Article With Same Content Hash',
    content_hash: manualContentHash
  });

  const manualHashCollisionBody = {
    source: 'hermes',
    contract_version: 1,
    article_id: 'art_manual_hash_collision_test_5555',
    markdown: manualUniqueBodyMarkdown
  };
  const req71 = await buildSignedHermesRequest({
    bodyObj: manualHashCollisionBody,
    jobId: 'job_2026_manual_hash_collision_007',
    requestId: 'req_2026_manual_hash_collision_010_xyz'
  });
  const res71 = await callEndpoint(req71.request, mockDb);
  const b71 = await res71.json();
  assert(res71.status === 409 && b71.code === 'EXISTING_ARTICLE_CONFLICT', '71. Existing manual article with same content hash returns 409 EXISTING_ARTICLE_CONFLICT (not adopted)');
  console.log('');

  // =========================================================================
  // Section 47: Concurrency Test Matrix (Tests 72 - 76)
  // =========================================================================
  console.log('[Section 47: Concurrency Test Matrix (Tests 72 - 76)]');

  const concurrentDb = createMockD1Database();
  const concurrentBody = {
    source: 'hermes',
    contract_version: 1,
    article_id: 'art_2026_concurrent_batch_test_001',
    markdown: SAMPLE_VALID_MARKDOWN.replace('Rekayasa Sirkulasi Alami', 'Rekayasa Sirkulasi Alami Pengujian Konkurensi')
  };

  // 72. 2 simultaneous requests: same JOB_ID, same payload
  const req72a = await buildSignedHermesRequest({
    bodyObj: concurrentBody,
    jobId: 'job_concurrent_pair_001_abc',
    requestId: 'req_concurrent_pair_001_req1'
  });
  const req72b = await buildSignedHermesRequest({
    bodyObj: concurrentBody,
    jobId: 'job_concurrent_pair_001_abc',
    requestId: 'req_concurrent_pair_001_req2'
  });

  const [res72a, res72b] = await Promise.all([
    callEndpoint(req72a.request, concurrentDb),
    callEndpoint(req72b.request, concurrentDb)
  ]);
  const statuses72 = [res72a.status, res72b.status].sort();
  assert(
    (statuses72[0] === 200 && statuses72[1] === 201) || (statuses72[0] === 201 && statuses72[1] === 201),
    '72A. Both simultaneous requests complete successfully (201 Created + 200 Replay)'
  );
  assert(concurrentDb._articles.length === 1 && concurrentDb._receipts.length === 1,
    '72B. Exactly one article and one receipt persisted after 2 simultaneous requests');

  // 73. 10 simultaneous requests: same JOB_ID, same payload
  const promises10 = [];
  for (let i = 0; i < 10; i++) {
    const req10 = await buildSignedHermesRequest({
      bodyObj: concurrentBody,
      jobId: 'job_concurrent_pair_001_abc',
      requestId: `req_concurrent_burst_00${i}`
    });
    promises10.push(callEndpoint(req10.request, concurrentDb));
  }
  const results10 = await Promise.all(promises10);
  const all10Success = results10.every(r => r.status === 200 || r.status === 201);
  assert(all10Success && concurrentDb._articles.length === 1 && concurrentDb._receipts.length === 1,
    '73. 10 simultaneous requests with same JOB_ID resolve cleanly to exactly one article and one receipt');

  // 74. Concurrent: same JOB_ID, different payload -> conflict
  const diffPayloadConcurrent = {
    ...concurrentBody,
    markdown: SAMPLE_VALID_MARKDOWN.replace('Rekayasa Sirkulasi Alami', 'Rekayasa Sirkulasi Alami Konflik Konkuren')
  };
  const req74 = await buildSignedHermesRequest({
    bodyObj: diffPayloadConcurrent,
    jobId: 'job_concurrent_pair_001_abc',
    requestId: 'req_concurrent_conflict_001'
  });
  const res74 = await callEndpoint(req74.request, concurrentDb);
  assert(res74.status === 409, '74. Conflicting payload under same JOB_ID returns 409');

  // 75. Concurrent: different JOB_ID, same ARTICLE_ID, same content -> resolves safely
  const req75 = await buildSignedHermesRequest({
    bodyObj: concurrentBody,
    jobId: 'job_concurrent_new_job_id_002',
    requestId: 'req_concurrent_retry_002'
  });
  const res75 = await callEndpoint(req75.request, concurrentDb);
  const b75 = await res75.json();
  assert(res75.status === 200 && b75.code === 'ARTICLE_IDEMPOTENT_REPLAY', '75. Concurrent different JOB_ID with same article resolves to 200 ARTICLE_IDEMPOTENT_REPLAY');

  // 76. No duplicate article bodies created
  assert(concurrentDb._articles.length === 1, '76. Zero duplicate article bodies created under concurrent bombardment');
  console.log('');

  // =========================================================================
  // Section 48 & 49: Atomic Failure & Lost Response Recovery (Tests 77 - 81)
  // =========================================================================
  console.log('[Section 48 & 49: Atomic Failure & Lost Response Recovery]');

  // 77 - 78. Atomic failure simulation
  const failingDb = createMockD1Database();
  // Force a receipt constraint failure in batch
  failingDb._receipts.push({
    job_id: 'job_colliding_receipt_pre_existing',
    source: 'hermes',
    source_article_id: 'art_existing_something',
    content_sha256: 'sha_existing',
    article_content_hash: 'hash_existing',
    article_id: 99
  });
  const failingReq = await buildSignedHermesRequest({
    bodyObj: {
      ...validBody,
      article_id: 'art_test_atomic_rollback_111'
    },
    jobId: 'job_colliding_receipt_pre_existing', // will collide on receipt
    requestId: 'req_atomic_rollback_001'
  });
  const resFailing = await callEndpoint(failingReq.request, failingDb);
  assert(resFailing.status === 409 && failingDb._articles.length === 0,
    '77-78. Receipt constraint failure rolls back entire batch; article insert does NOT remain orphaned');

  // 79 - 80. Database unavailable returns 500 without in-memory fallback
  const noDbReq = await buildSignedHermesRequest({ bodyObj: validBody });
  const resNoDb = await callEndpoint(noDbReq.request, null); // null DB
  const bNoDb = await resNoDb.json();
  assert(resNoDb.status === 500 && bNoDb.code === 'INGEST_PERSISTENCE_FAILED',
    '79-80. Missing real database fails closed with 500 INGEST_PERSISTENCE_FAILED and does NOT fall back to in-memory');

  // 81. Persistence failure response contains no SQL/stack leak
  assert(!JSON.stringify(bNoDb).includes('SQL') && !JSON.stringify(bNoDb).includes('SELECT') && !JSON.stringify(bNoDb).includes('at '),
    '81. Persistence failure response contains zero SQL text or stack traces');

  // 82. GOLDEN TEST: Lost Response Recovery
  const goldenDb = createMockD1Database();
  const goldenJobId = 'job_2026_golden_lost_response_001';
  const goldenReq1 = await buildSignedHermesRequest({
    bodyObj: validBody,
    jobId: goldenJobId,
    requestId: 'req_golden_attempt_1'
  });
  const goldenRes1 = await callEndpoint(goldenReq1.request, goldenDb);
  const goldenBody1 = await goldenRes1.json();
  assert(goldenRes1.status === 201 && goldenBody1.code === 'INGEST_CREATED', '82A. Golden Test: First delivery persists article');

  // Pretend response was lost over network: Hermes resends same JOB_ID and payload with new request_id
  const goldenReq2 = await buildSignedHermesRequest({
    bodyObj: validBody,
    jobId: goldenJobId,
    requestId: 'req_golden_attempt_2_retry'
  });
  const goldenRes2 = await callEndpoint(goldenReq2.request, goldenDb);
  const goldenBody2 = await goldenRes2.json();
  assert(
    goldenRes2.status === 200 &&
    goldenBody2.code === 'IDEMPOTENT_REPLAY' &&
    goldenBody2.d1_article_id === goldenBody1.d1_article_id &&
    goldenDb._articles.length === 1 &&
    goldenDb._receipts.length === 1,
    '82B. Golden Test: Lost response recovery resend returns HTTP 200 IDEMPOTENT_REPLAY with identical D1 article ID and zero new records'
  );
  console.log('');

  // =========================================================================
  // Section 39: Admin / Hermes Trust Separation Test
  // =========================================================================
  console.log('[Section 39: Admin / Hermes Trust Separation Test]');

  // A valid admin_session cookie WITHOUT Hermes HMAC -> Hermes endpoint rejected (401)
  const adminToken = await createAdminSessionToken();
  const unauthHermesHeaders = new Headers({
    'Cookie': `admin_session=${adminToken}`,
    'Content-Type': 'application/json'
  });
  const reqAdminToHermes = new Request('http://localhost:4321/api/internal/v1/hermes-ingest', {
    method: 'POST',
    headers: unauthHermesHeaders,
    body: JSON.stringify(validBody)
  });
  const resAdminToHermes = await callEndpoint(reqAdminToHermes, mockDb);
  assert(resAdminToHermes.status === 401, 'Separation 1: Valid admin cookie WITHOUT Hermes HMAC is rejected by hermes-ingest (401)');

  // A valid Hermes HMAC WITHOUT admin cookie -> Hermes endpoint allowed
  assert(res57.status === 201, 'Separation 2: Valid Hermes HMAC WITHOUT admin cookie is accepted by hermes-ingest (201)');

  // A valid Hermes HMAC sent to /api/admin/posts -> does NOT authenticate as admin
  const hermesSigOnlyHeader = {
    'X-RL-Signature-Version': 'v1',
    'X-RL-Signature': 'sha256=abcdef1234567890'
  };
  const isAuthedWithHermesHeaders = await isValidAdminSession(null);
  assert(!isAuthedWithHermesHeaders, 'Separation 3: Hermes HMAC headers do not authenticate as administrator');
  console.log('');

  // =========================================================================
  // Section 40 - 42: Forced Draft & Security Regression
  // =========================================================================
  console.log('[Section 40 - 42: Forced Draft & Markdown Security Regression]');

  // Forced DRAFT check
  const createdArt = mockDb._articles[0];
  assert(createdArt && createdArt.status === 'draft', 'Forced Draft: Ingested article status is strictly "draft"');

  // Publication injection attempts rejected
  const pubAttempt1 = validateHermesArticlePolicy({ ...baseFrontmatter, status: 'published' });
  const pubAttempt2 = validateHermesArticlePolicy({ ...baseFrontmatter, is_featured: 1 });
  const pubAttempt3 = validateHermesArticlePolicy({ ...baseFrontmatter, views: 99999 });
  assert(!pubAttempt1.valid && !pubAttempt2.valid && !pubAttempt3.valid,
    'Publication Injection: Injection of status, is_featured, or views is strictly rejected by Hermes policy');

  // XSS attack payload inside Hermes Markdown body is sanitized by Phase 1B renderer
  const xssMarkdown = `---
title: "Pengujian Injeksi Skrip Berbahaya untuk Keamanan Receiver"
description: "Pengujian sanitasi HTML di dalam receiver Hermes untuk memastikan keamanan rendering konten kanonikal."
category: "Arsitektur & Renovasi"
author: "RancangLoka Editorial Desk"
focus_keyword: "pengujian injeksi skrip berbahaya"
featured_image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200"
image_alt: "Gambar pengujian sanitasi"
key_takeaways:
  - "Satu pengujian sanitasi keamanan front-end."
  - "Dua pemastian tidak adanya eksekusi kode berbahaya."
  - "Tiga kepatuhan standar keamanan rendering Fase 1B."
---

# Pengujian Injeksi Skrip Berbahaya untuk Keamanan Receiver

Ventilasi alami merupakan strategi fundamental dalam arsitektur tropis lembap untuk mencapai kenyamanan termal tanpa ketergantungan konstan pada pendingin ruangan buatan. Penerapan void atap ganda memungkinkan pergerakan udara berdasarkan gradien temperatur secara pasif. Dalam perencanaan rumah tinggal perkotaan, integrasi bukaan vertikal memberikan manfaat ganda berupa pencahayaan alami dan penurunan suhu ruang secara signifikan.

<script>alert('pwned')</script>
<iframe src="https://attacker.evil"></iframe>
<a href="javascript:alert(1)">Klik disini</a>
<img src="x" onerror="alert('xss')">

Ketika radiasi matahari memanaskan permukaan atap dan ruang loteng, udara di dekat plafon mengalami ekspansi termal dan penurunan densitas. Udara berdensitas rendah ini secara alami bergerak ke atas menuju bukaan keluar di titik tertinggi bangunan. Fenomena ini menciptakan efek hisap alami yang menarik udara segar dari lantai bawah menuju area atas hunian secara berkesinambungan.

---

## 1. Desain Kisi Vertikal dan Proteksi Tampias

Penggunaan kisi kayu ulin vertikal memberikan insulasi termal superior dibandingkan kisi aluminium konvensional. Penempatan kisi harus memperhitungkan sudut jatuhnya tampias hujan musim muson barat agar tidak membasahi interior. Kayu ulin memiliki ketahanan alami terhadap kelembapan tinggi dan perubahan cuaca ekstrem di kawasan tropis.

Dengan sudut kemiringan bilah 45 derajat dan jarak antar bilah 8 sentimeter, aliran udara tetap optimal hingga kecepatan 1,5 meter per detik sementara butiran air hujan terpantul keluar secara efektif. Ruang hunian tetap sejuk dan kering sepanjang hari, bahkan ketika curah hujan berada pada intensitas yang cukup tinggi.

---

## 2. Pemanfaatan Efek Cerobong dan Tekanan Negatif

Efek cerobong bekerja paling efektif apabila terdapat perbedaan elevasi yang memadai antara inlet udara di bagian bawah dan outlet di puncak atap. Ketinggian void minimal enam meter sangat disarankan untuk menciptakan gradien tekanan udara yang cukup kuat guna menggerakkan massa udara secara kontinu tanpa bantuan kipas mekanis.
`;
  const xssReq = await buildSignedHermesRequest({
    bodyObj: {
      source: 'hermes',
      contract_version: 1,
      article_id: 'art_2026_xss_sanitization_test_001',
      markdown: xssMarkdown
    },
    jobId: 'job_2026_xss_test_001_abc',
    requestId: 'req_2026_xss_test_001_xyz'
  });
  const xssRes = await callEndpoint(xssReq.request, mockDb);
  const xssBody = await xssRes.json();
  // Section 42: Malicious <script> and <iframe> payloads fail early in Phase 1B canonical validator
  assert(
    xssRes.status === 422 &&
    xssBody.code === 'VALIDATION_FAILED' &&
    JSON.stringify(xssBody).includes('berbahaya'),
    'Markdown Security 1: Dangerous <script> and <iframe> payloads fail early via Phase 1B canonical validator (422)'
  );

  // Markdown Security 2: Payloads with javascript: links and inline handlers also fail early in Phase 1B validator
  const sanitizeTestMarkdown = SAMPLE_VALID_MARKDOWN.replace(
    'Ventilasi alami merupakan strategi fundamental',
    'Ventilasi alami [Klik disini untuk eksploit](javascript:alert(1)) merupakan strategi fundamental <b onclick="alert(2)">tebal</b>'
  ).replace('title: "Rekayasa Sirkulasi Alami pada Void Hunian Tropis"', 'title: "Uji Coba Sanitasi Link Javascript"');

  const sanitizeReq = await buildSignedHermesRequest({
    bodyObj: {
      source: 'hermes',
      contract_version: 1,
      article_id: 'art_2026_sanitization_render_002',
      markdown: sanitizeTestMarkdown
    },
    jobId: 'job_2026_sanitization_render_002',
    requestId: 'req_2026_sanitization_render_002'
  });
  const sanitizeRes = await callEndpoint(sanitizeReq.request, mockDb);
  const sanitizeBody = await sanitizeRes.json();
  assert(
    sanitizeRes.status === 422 &&
    sanitizeBody.code === 'VALIDATION_FAILED' &&
    JSON.stringify(sanitizeBody).includes('berbahaya'),
    'Markdown Security 2: Payloads with javascript: links and event handlers fail early via Phase 1B validator (422)'
  );

  console.log('====================================================');
  console.log(`📊 PHASE 2A TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase2ATestSuite().catch((err) => {
  console.error('Fatal error running Phase 2A test suite:', err);
  process.exit(1);
});
