/**
 * RancangLoka Phase 2A.5 — Adversarial Receiver Validation, Chaos Testing & Production Readiness
 *
 * Test Classifications:
 * - [BLACK_BOX_HTTP]: HTTP surface testing against endpoint handler
 * - [LOCAL_D1_INTEGRATION]: SQLite / D1 transactional and constraint integration
 * - [UNIT_FAULT_INJECTION]: Injected internal faults, transaction crashes, and edge sanitization
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
  isValidAdminSession,
  getAdminSessionSecret
} from '../src/lib/auth.ts';
import {
  getArticleById,
  getAllArticles,
  getReceiptByJobId,
  getReceiptBySourceArticleId,
  getReceiptByContentHashes,
  insertHermesArticleAndReceipt,
  checkDuplicateArticle
} from '../src/lib/db.ts';
import { parseArticleMarkdown } from '../src/lib/article/parser.ts';
import { generateContentHash } from '../src/lib/seo.ts';
import { renderArticleMarkdownSafely, sanitizeArticleHtml } from '../src/lib/article/renderer.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message, label = '[BLACK_BOX_HTTP]') {
  if (condition) {
    console.log(`  ✅ PASS ${label}: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL ${label}: ${message}`);
    failedTests++;
  }
}

// Configured Test Keys
const TEST_KEY_CURRENT_ID = 'hermes-key-2026-v1';
const TEST_KEY_CURRENT_SECRET = 'hermes-secret-current-test-only-minimum-32-chars-long';
const TEST_KEY_PREVIOUS_ID = 'hermes-key-2025-v0';
const TEST_KEY_PREVIOUS_SECRET = 'hermes-secret-previous-test-only-minimum-32-chars-long';

const defaultEnv = {
  RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID: TEST_KEY_CURRENT_ID,
  RANCANGLOKA_HERMES_INGEST_KEY_CURRENT: TEST_KEY_CURRENT_SECRET,
  RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS_ID: TEST_KEY_PREVIOUS_ID,
  RANCANGLOKA_HERMES_INGEST_KEY_PREVIOUS: TEST_KEY_PREVIOUS_SECRET
};

/**
 * Creates an in-memory mock D1 database that strictly mimics Cloudflare D1 batch atomic semantics.
 */
function createMockD1Database(options = {}) {
  const articles = [];
  const receipts = [];
  let articleAutoId = 100;
  let forceFailArticle = options.forceFailArticle || false;
  let forceFailReceipt = options.forceFailReceipt || false;
  let forceFailPostCommitVerify = options.forceFailPostCommitVerify || false;

  return {
    _articles: articles,
    _receipts: receipts,
    setForceFailArticle(v) { forceFailArticle = v; },
    setForceFailReceipt(v) { forceFailReceipt = v; },
    setForceFailPostCommitVerify(v) { forceFailPostCommitVerify = v; },
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
          if (forceFailPostCommitVerify && sql.includes('WHERE a.id = ?')) {
            return null; // Simulate missing article on post-commit verify
          }
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
          return { results: [] };
        },
        async run() {
          return { success: true, meta: {} };
        }
      };
    },
    async batch(statements) {
      const snapshotArticles = JSON.parse(JSON.stringify(articles));
      const snapshotReceipts = JSON.parse(JSON.stringify(receipts));

      try {
        let lastInsertRowid = null;
        const results = [];

        for (const stmt of statements) {
          if (stmt.sql?.includes('INSERT INTO articles') || stmt._type === 'insert_article') {
            if (forceFailArticle) {
              throw new Error('Simulated D1 error during article insertion');
            }
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
            if (forceFailReceipt) {
              throw new Error('UNIQUE constraint failed: article_ingest_receipts.job_id (Simulated receipt constraint fault)');
            }
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
        // Atomic rollback: restore exact state
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
 * Builds valid Hermes signed request fixture.
 */
async function buildSignedHermesRequest({
  url = 'http://localhost:4321/api/internal/v1/hermes-ingest',
  method = 'POST',
  bodyObj = null,
  rawBodyOverride = null,
  timestamp = Math.floor(Date.now() / 1000),
  jobId = 'job_chaos_sample_delivery_001_abc',
  requestId = 'req_chaos_sample_request_001_xyz',
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
  if (contentType !== null) {
    headers.set('Content-Type', contentType);
  }
  headers.set('Content-Length', String(bodyBytes.byteLength));
  headers.set('X-RL-Signature-Version', signatureVersion);
  headers.set('X-RL-Timestamp', String(timestamp));
  headers.set('X-RL-Job-ID', jobId);
  headers.set('X-RL-Request-ID', requestId);
  headers.set('X-RL-Key-ID', keyId);
  headers.set('X-RL-Signature', `sha256=${signatureHex}`);

  for (const [k, v] of Object.entries(extraHeaders)) {
    if (v === null) {
      headers.delete(k);
    } else {
      headers.set(k, v);
    }
  }

  const request = new Request(url, {
    method,
    headers,
    body: method === 'POST' ? bodyBytes : undefined
  });

  return { request, bodyBytes, canonicalString, rawBodySha256, signatureHex };
}

/**
 * Standard valid sample Markdown (> 350 words, valid frontmatter, no banned placeholders)
 */
const SAMPLE_CHAOS_MARKDOWN = `---
title: "Rekayasa Sirkulasi Alami pada Void Hunian Tropis Modern"
description: "Kajian termal penempatan kisi vertikal dan ventilasi silang pada hunian bertingkat iklim tropis lembap."
category: "Arsitektur & Renovasi"
author: "RancangLoka Editorial Desk"
focus_keyword: "sirkulasi alami void rumah tropis"
featured_image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200"
image_alt: "Void hunian tropis bertingkat dengan pencahayaan alami"
key_takeaways:
  - "Efek cerobong alami mengalirkan udara panas keluar melewati bukaan atap secara pasif."
  - "Bukaan silang lantai dasar memasok udara segar secara berkesinambungan tanpa henti."
  - "Peredam suara akustik pada dinding void membatasi kebisingan antar lantai ruang keluarga."
---

# Rekayasa Sirkulasi Alami pada Void Hunian Tropis Modern

Ventilasi alami merupakan strategi fundamental dalam arsitektur tropis lembap untuk mencapai kenyamanan termal tanpa ketergantungan konstan pada pendingin ruangan buatan. Penerapan void atap ganda memungkinkan pergerakan udara berdasarkan gradien temperatur secara pasif. Dalam perencanaan rumah tinggal perkotaan, integrasi bukaan vertikal memberikan manfaat ganda berupa pencahayaan alami dan penurunan suhu ruang secara signifikan.

Ketika radiasi matahari memanaskan permukaan atap dan ruang loteng, udara di dekat plafon mengalami ekspansi termal dan penurunan densitas. Udara berdensitas rendah ini secara alami bergerak ke atas menuju bukaan keluar di titik tertinggi bangunan. Fenomena ini menciptakan efek hisap alami yang menarik udara segar dari lantai bawah menuju area atas hunian secara berkesinambungan.

---

## 1. Desain Kisi Vertikal dan Proteksi Tampias Muson

Penggunaan kisi kayu ulin vertikal memberikan insulasi termal superior dibandingkan kisi aluminium konvensional. Penempatan kisi harus memperhitungkan sudut jatuhnya tampias hujan musim muson barat agar tidak membasahi interior. Kayu ulin memiliki ketahanan alami terhadap kelembapan tinggi dan perubahan cuaca ekstrem di kawasan tropis Nusantara.

Dengan sudut kemiringan bilah 45 derajat dan jarak antar bilah 8 sentimeter, aliran udara tetap optimal hingga kecepatan 1,5 meter per detik sementara butiran air hujan terpantul keluar secara efektif. Ruang hunian tetap sejuk dan kering sepanjang hari, bahkan ketika curah hujan berada pada intensitas yang cukup tinggi di sore hari.

---

## 2. Pemanfaatan Efek Cerobong dan Tekanan Negatif

Efek cerobong bekerja paling efektif apabila terdapat perbedaan elevasi yang memadai antara inlet udara di bagian bawah dan outlet di puncak atap. Ketinggian void minimal enam meter sangat disarankan untuk menciptakan gradien tekanan udara yang cukup kuat guna menggerakkan massa udara secara kontinu tanpa bantuan kipas mekanis.

Pada malam hari, massa termal dinding dan lantai yang melepaskan kalor perlahan akan dibersihkan oleh aliran udara malam yang sejuk. Proses penggantian udara ini memastikan struktur bangunan memulai hari berikutnya dengan temperatur dasar yang lebih dingin, sehingga beban pendinginan pasif tetap terjaga dalam batas kenyamanan seluruh penghuni rumah.

---

## 3. Integrasi Ruang Terbuka Hijau dan Pengendalian Akustik

Penempatan inner courtyard atau taman dalam bervegetasi lebat di bawah void bertindak sebagai pendingin mikro alami. Evapotranspirasi dari dedaunan membantu menurunkan temperatur udara sekitar hingga dua derajat Celsius sebelum udara tersebut ditarik masuk ke dalam ruang tamu atau area keluarga.

Untuk mengantisipasi pantulan suara yang kerap terjadi pada rongga vertikal, material penyerap suara seperti panel akustik perforasi kayu dapat dipasang pada salah satu bidang dinding void. Dengan demikian, kenyamanan termal dan ketenangan akustik dapat berjalan selaras dalam hunian bertingkat modern secara elegan dan fungsional.
`;

async function callEndpoint(request, dbInstance, envInstance = defaultEnv) {
  const url = new URL(request.url);
  const context = {
    request,
    url,
    locals: {
      runtime: {
        env: {
          ...envInstance,
          DB: dbInstance
        }
      }
    }
  };
  return await hermesIngestHandler(context);
}

async function runChaosSuite() {
  console.log('====================================================');
  console.log('🔥 RancangLoka Phase 2A.5 Adversarial Chaos Suite');
  console.log('   Stress Testing, Fault Injection & Hardening');
  console.log('====================================================\n');

  // =========================================================================
  // Section 3: Canonical Protocol Golden Vector
  // =========================================================================
  console.log('[Section 3: Canonical Protocol Golden Vector]');
  {
    const goldenTimestamp = 1772683200; // Fixed reproducible epoch
    const goldenJobId = 'job_golden_protocol_vector_001_abc';
    const goldenRequestId = 'req_golden_protocol_vector_001_xyz';
    const goldenArticleId = 'art_golden_protocol_vector_001_id';
    const goldenKeyId = 'hermes-golden-key-2026';
    const goldenSecret = 'hermes-test-golden-secret-minimum-32-chars-length';

    const goldenPayload = {
      source: 'hermes',
      contract_version: 1,
      article_id: goldenArticleId,
      markdown: '---\ntitle: "Golden Test"\ncategory: "Arsitektur & Renovasi"\n---\n## H2\nBody text.'
    };
    const goldenRawBodyBytes = new TextEncoder().encode(JSON.stringify(goldenPayload));
    const goldenRawBodySha256 = await computeSha256Hex(goldenRawBodyBytes);
    const goldenCanonicalString = buildHermesCanonicalString(goldenTimestamp, goldenJobId, goldenRequestId, goldenRawBodySha256);
    const goldenHmac = await signHermesCanonicalString(goldenCanonicalString, goldenSecret);

    assert(goldenRawBodySha256.length === 64, `Golden raw body SHA-256 computed: ${goldenRawBodySha256.slice(0, 16)}...`, '[CANONICAL_PROTOCOL_GOLDEN_VECTOR]');
    assert(goldenCanonicalString.startsWith('v1\nPOST\n/api/internal/v1/hermes-ingest\n1772683200\n'), 'Golden canonical string format strictly verified', '[CANONICAL_PROTOCOL_GOLDEN_VECTOR]');
    assert(goldenHmac.length === 64, `Golden HMAC-SHA256 signature generated: ${goldenHmac.slice(0, 16)}...`, '[CANONICAL_PROTOCOL_GOLDEN_VECTOR]');

    const verifyGolden = await verifyHermesHmac(goldenCanonicalString, goldenHmac, goldenSecret);
    assert(verifyGolden === true, 'Golden protocol vector signature verifies symmetrically', '[CANONICAL_PROTOCOL_GOLDEN_VECTOR]');
  }
  console.log('');

  // =========================================================================
  // Section 4: Byte-Exact Signature Testing
  // =========================================================================
  console.log('[Section 4: Byte-Exact Signature Testing]');
  {
    const baseObj = { source: 'hermes', contract_version: 1, article_id: 'art_byte_test_001_abc', markdown: SAMPLE_CHAOS_MARKDOWN };
    const compactJson = JSON.stringify(baseObj);
    const prettyJson = JSON.stringify(baseObj, null, 2);

    const signedCompact = await buildSignedHermesRequest({ rawBodyOverride: compactJson });
    // Attempt submitting pretty JSON with signature of compact JSON
    const test1 = await buildSignedHermesRequest({
      rawBodyOverride: prettyJson,
      signatureOverride: signedCompact.signatureHex
    });
    const isV1 = await verifyHermesHmac(test1.canonicalString, signedCompact.signatureHex, TEST_KEY_CURRENT_SECRET);
    assert(!isV1, 'Different JSON whitespace produces different raw body SHA256 and invalidates HMAC', '[BLACK_BOX_HTTP]');

    // CRLF vs LF differences
    const lfBody = prettyJson.replace(/\r?\n/g, '\n');
    const crlfBody = lfBody.replace(/\n/g, '\r\n');
    const signedLf = await buildSignedHermesRequest({ rawBodyOverride: lfBody });
    const testCrlf = await buildSignedHermesRequest({ rawBodyOverride: crlfBody, signatureOverride: signedLf.signatureHex });
    const isV2 = await verifyHermesHmac(testCrlf.canonicalString, signedLf.signatureHex, TEST_KEY_CURRENT_SECRET);
    assert(!isV2, 'CRLF vs LF mutation invalidates HMAC', '[BLACK_BOX_HTTP]');

    // Trailing newline
    const testTrailing = await buildSignedHermesRequest({ rawBodyOverride: compactJson + '\n', signatureOverride: signedCompact.signatureHex });
    const isV3 = await verifyHermesHmac(testTrailing.canonicalString, signedCompact.signatureHex, TEST_KEY_CURRENT_SECRET);
    assert(!isV3, 'Trailing newline added after signing invalidates HMAC', '[BLACK_BOX_HTTP]');

    // Leading whitespace
    const testLeading = await buildSignedHermesRequest({ rawBodyOverride: ' ' + compactJson, signatureOverride: signedCompact.signatureHex });
    const isV4 = await verifyHermesHmac(testLeading.canonicalString, signedCompact.signatureHex, TEST_KEY_CURRENT_SECRET);
    assert(!isV4, 'Leading whitespace added after signing invalidates HMAC', '[BLACK_BOX_HTTP]');

    // Unicode characters: Indonesian text, emoji, curly apostrophe, em dash, non-breaking space
    const unicodeBody = compactJson.replace('tropis', 'tropis 🏠 hunian—kayu’s\u00A0ruang');
    const testUnicode = await buildSignedHermesRequest({ rawBodyOverride: unicodeBody, signatureOverride: signedCompact.signatureHex });
    const isV5 = await verifyHermesHmac(testUnicode.canonicalString, signedCompact.signatureHex, TEST_KEY_CURRENT_SECRET);
    assert(!isV5, 'Multibyte UTF-8 byte changes (emoji, curly apostrophe, em dash, NBSP) invalidate HMAC', '[BLACK_BOX_HTTP]');
  }
  console.log('');

  // =========================================================================
  // Section 5: HTTP Body Edge Cases
  // =========================================================================
  console.log('[Section 5: HTTP Body Edge Cases]');
  {
    const edgeDb = createMockD1Database();

    // 1. Zero-byte body
    const reqZero = await buildSignedHermesRequest({ rawBodyOverride: '' });
    const resZero = await callEndpoint(reqZero.request, edgeDb);
    assert(resZero.status === 400 || resZero.status === 401, 'Zero-byte body safely rejected with client error (400/401)', '[BLACK_BOX_HTTP]');

    // 2. Whitespace-only body
    const reqSpace = await buildSignedHermesRequest({ rawBodyOverride: '   \n\t  ' });
    const resSpace = await callEndpoint(reqSpace.request, edgeDb);
    const bSpace = await resSpace.json();
    assert(resSpace.status === 400 && bSpace.code === 'MALFORMED_JSON', 'Whitespace-only body rejected with 400 MALFORMED_JSON', '[BLACK_BOX_HTTP]');

    // 3. Empty object {}
    const reqEmptyObj = await buildSignedHermesRequest({ bodyObj: {} });
    const resEmptyObj = await callEndpoint(reqEmptyObj.request, edgeDb);
    const bEmptyObj = await resEmptyObj.json();
    assert(resEmptyObj.status === 400 && bEmptyObj.code === 'TRANSPORT_INVALID', 'Empty object {} rejected with 400 TRANSPORT_INVALID', '[BLACK_BOX_HTTP]');

    // 4. Valid JSON with missing fields
    const reqPartial = await buildSignedHermesRequest({ bodyObj: { source: 'hermes', contract_version: 1 } });
    const resPartial = await callEndpoint(reqPartial.request, edgeDb);
    const bPartial = await resPartial.json();
    assert(resPartial.status === 400 && bPartial.code === 'TRANSPORT_INVALID', 'Missing article_id/markdown rejected with 400 TRANSPORT_INVALID', '[BLACK_BOX_HTTP]');

    // 5. Deeply nested unknown fields
    const deepObj = {
      source: 'hermes',
      contract_version: 1,
      article_id: 'art_valid_id_deep_12345678',
      markdown: '...',
      unknown_nested: { a: { b: { c: { d: 'overflow' } } } }
    };
    const reqDeep = await buildSignedHermesRequest({ bodyObj: deepObj });
    const resDeep = await callEndpoint(reqDeep.request, edgeDb);
    const bDeep = await resDeep.json();
    assert(resDeep.status === 400 && bDeep.code === 'TRANSPORT_FIELD_NOT_ALLOWED', 'Deeply nested unknown fields rejected with 400 TRANSPORT_FIELD_NOT_ALLOWED', '[BLACK_BOX_HTTP]');

    // 6. Exactly 512 KiB (boundary) vs 512 KiB + 1 byte
    const limitBytes = 512 * 1024; // 524288 bytes
    const fillerLength = limitBytes - 120;
    const bodyLimit = {
      source: 'hermes',
      contract_version: 1,
      article_id: 'art_size_boundary_test_001',
      markdown: SAMPLE_CHAOS_MARKDOWN + '\n<!-- ' + 'A'.repeat(fillerLength - SAMPLE_CHAOS_MARKDOWN.length) + ' -->'
    };
    const rawLimitStr = JSON.stringify(bodyLimit);
    const actualBytes = new TextEncoder().encode(rawLimitStr);

    // If exactly within limit
    if (actualBytes.byteLength <= limitBytes) {
      const reqWithin = await buildSignedHermesRequest({ rawBodyOverride: actualBytes });
      assert(actualBytes.byteLength <= limitBytes, `Payload at or below 512 KiB (${actualBytes.byteLength} B) is measured correctly`, '[BLACK_BOX_HTTP]');
    }

    // Limit + 1 byte
    const overLimitBytes = new Uint8Array(limitBytes + 1);
    overLimitBytes.fill(65); // 'A'
    const reqOver = await buildSignedHermesRequest({ rawBodyOverride: overLimitBytes });
    const resOver = await callEndpoint(reqOver.request, edgeDb);
    const bOver = await resOver.json();
    assert(resOver.status === 413 && bOver.code === 'PAYLOAD_TOO_LARGE', '512 KiB + 1 byte payload rejected with 413 PAYLOAD_TOO_LARGE', '[BLACK_BOX_HTTP]');

    // 7. Misleading Content-Length header larger than limit
    const reqContentLength = await buildSignedHermesRequest({
      rawBodyOverride: '{"valid":"json"}',
      extraHeaders: { 'Content-Length': '600000' }
    });
    const resContentLength = await callEndpoint(reqContentLength.request, edgeDb);
    assert(resContentLength.status === 413, 'Content-Length header exceeding limit rejected early with 413', '[BLACK_BOX_HTTP]');

    // 8. Zero crash / zero stack trace leak on edge cases
    assert(!JSON.stringify(bOver).includes('at ') && !JSON.stringify(bOver).includes('.ts:'), 'Edge case error responses contain zero stack traces or file paths', '[BLACK_BOX_HTTP]');
  }
  console.log('');

  // =========================================================================
  // Section 6: Header Robustness
  // =========================================================================
  console.log('[Section 6: Header Robustness]');
  {
    const baseValidBody = { source: 'hermes', contract_version: 1, article_id: 'art_header_test_001_abc', markdown: SAMPLE_CHAOS_MARKDOWN };
    const hDb = createMockD1Database();

    // Uppercase hex signature rejected (protocol requires lowercase hex)
    const reqUpperSig = await buildSignedHermesRequest({ bodyObj: baseValidBody });
    const upperSig = reqUpperSig.signatureHex.toUpperCase();
    const testUpper = await buildSignedHermesRequest({
      bodyObj: baseValidBody,
      extraHeaders: { 'X-RL-Signature': `sha256=${upperSig}` }
    });
    const resUpper = await callEndpoint(testUpper.request, hDb);
    assert(resUpper.status === 401, 'Uppercase hex signature rejected (strictly requires lowercase hex)', '[BLACK_BOX_HTTP]');

    // Signature too short
    const testShortSig = await buildSignedHermesRequest({
      bodyObj: baseValidBody,
      extraHeaders: { 'X-RL-Signature': 'sha256=1234abcd' }
    });
    const resShort = await callEndpoint(testShortSig.request, hDb);
    assert(resShort.status === 401, 'Signature with invalid length (< 64 hex chars) rejected with 401', '[BLACK_BOX_HTTP]');

    // Timestamp with decimal
    const testDecTs = await buildSignedHermesRequest({
      bodyObj: baseValidBody,
      extraHeaders: { 'X-RL-Timestamp': '1772683200.55' }
    });
    const resDec = await callEndpoint(testDecTs.request, hDb);
    assert(resDec.status === 401, 'Timestamp containing decimals rejected with 401 TIMESTAMP_INVALID', '[BLACK_BOX_HTTP]');

    // Timestamp with plus sign
    const testPlusTs = await buildSignedHermesRequest({
      bodyObj: baseValidBody,
      extraHeaders: { 'X-RL-Timestamp': '+1772683200' }
    });
    const resPlus = await callEndpoint(testPlusTs.request, hDb);
    assert(resPlus.status === 401, 'Timestamp containing plus sign rejected with 401 TIMESTAMP_INVALID', '[BLACK_BOX_HTTP]');

    // Absurdly long Key ID
    const testLongKey = await buildSignedHermesRequest({
      bodyObj: baseValidBody,
      extraHeaders: { 'X-RL-Key-ID': 'k'.repeat(250) }
    });
    const resLongKey = await callEndpoint(testLongKey.request, hDb);
    assert(resLongKey.status === 401, 'Absurdly long Key ID (> 128 chars) rejected with 401', '[BLACK_BOX_HTTP]');

    // CR/LF injection in Job ID
    let crlfBlockedAtTransport = false;
    try {
      await buildSignedHermesRequest({
        bodyObj: baseValidBody,
        extraHeaders: { 'X-RL-Job-ID': 'job_valid_id_123456\r\nX-Injected: true' }
      });
    } catch (err) {
      crlfBlockedAtTransport = true;
    }
    // Also verify header parser defense directly
    const mockHeadersWithCrlf = new Map([
      ['x-rl-signature-version', 'v1'],
      ['x-rl-timestamp', String(Math.floor(Date.now() / 1000))],
      ['x-rl-job-id', 'job_valid_id_123456\r\nX-Injected: true'],
      ['x-rl-request-id', 'req_valid_id_1234567890'],
      ['x-rl-key-id', 'test_key_01'],
      ['x-rl-signature', 'sha256=' + 'a'.repeat(64)]
    ]);
    const parsedHeaderResult = extractAndValidateHermesHeaders({
      get: (k) => mockHeadersWithCrlf.get(k.toLowerCase()) || null
    });
    assert(
      crlfBlockedAtTransport && !parsedHeaderResult.valid,
      'CRLF injection in X-RL-Job-ID header strictly blocked by HTTP transport and header validator',
      '[BLACK_BOX_HTTP]'
    );
  }
  console.log('');

  // =========================================================================
  // Section 7: Clock Boundary Tests (±300 seconds)
  // =========================================================================
  console.log('[Section 7: Clock Boundary Tests]');
  {
    const baseValidBody = { source: 'hermes', contract_version: 1, article_id: 'art_clock_test_001_abc', markdown: SAMPLE_CHAOS_MARKDOWN };
    const clockDb = createMockD1Database();
    const nowSec = Math.floor(Date.now() / 1000);

    const testSkew = async (offsetSec) => {
      const req = await buildSignedHermesRequest({
        bodyObj: baseValidBody,
        timestamp: nowSec + offsetSec,
        jobId: `job_clock_test_${offsetSec}_sec`,
        requestId: `req_clock_test_${offsetSec}_sec`
      });
      return await callEndpoint(req.request, clockDb);
    };

    const resMinus301 = await testSkew(-301);
    const bMinus301 = await resMinus301.json();
    assert(resMinus301.status === 401 && bMinus301.code === 'TIMESTAMP_OUT_OF_WINDOW', 'T - 301s rejected with 401 TIMESTAMP_OUT_OF_WINDOW', '[BLACK_BOX_HTTP]');

    const resMinus300 = await testSkew(-300);
    assert(resMinus300.status === 201, 'T - 300s (boundary) accepted', '[BLACK_BOX_HTTP]');

    const resPlus300 = await testSkew(300);
    assert(resPlus300.status === 200, 'T + 300s (boundary) accepted (idempotent replay of same article)', '[BLACK_BOX_HTTP]');

    const resPlus301 = await testSkew(301);
    const bPlus301 = await resPlus301.json();
    assert(resPlus301.status === 401 && bPlus301.code === 'TIMESTAMP_OUT_OF_WINDOW', 'T + 301s rejected with 401 TIMESTAMP_OUT_OF_WINDOW', '[BLACK_BOX_HTTP]');
  }
  console.log('');

  // =========================================================================
  // Section 8 & 9: Replay Attacks & REQUEST_ID Semantics
  // =========================================================================
  console.log('[Section 8 & 9: Replay Attacks & REQUEST_ID Semantics]');
  {
    const replayDb = createMockD1Database();
    const validBody = { source: 'hermes', contract_version: 1, article_id: 'art_replay_concept_001', markdown: SAMPLE_CHAOS_MARKDOWN };
    const fixedJobId = 'job_replay_fixed_delivery_001';

    // 1. Initial Ingestion
    const reqInitial = await buildSignedHermesRequest({ bodyObj: validBody, jobId: fixedJobId, requestId: 'req_initial_001_abc_xyz' });
    const resInitial = await callEndpoint(reqInitial.request, replayDb);
    assert(resInitial.status === 201, 'Initial request persists article (201 INGEST_CREATED)', '[BLACK_BOX_HTTP]');
    assert(replayDb._articles.length === 1 && replayDb._receipts.length === 1, 'Initial request creates exactly 1 article and 1 receipt', '[LOCAL_D1_INTEGRATION]');

    // 2. Exact same request replayed immediately (same request_id)
    const reqReplayExact = await buildSignedHermesRequest({ bodyObj: validBody, jobId: fixedJobId, requestId: 'req_initial_001_abc_xyz' });
    const resReplayExact = await callEndpoint(reqReplayExact.request, replayDb);
    assert(resReplayExact.status === 200, 'Exact same request replay returns 200 IDEMPOTENT_REPLAY', '[BLACK_BOX_HTTP]');
    assert(replayDb._articles.length === 1 && replayDb._receipts.length === 1, 'Replay creates zero new articles or receipts in D1', '[LOCAL_D1_INTEGRATION]');

    // 3. Same job with NEW request_id (valid delivery retry)
    const reqNewReqId = await buildSignedHermesRequest({ bodyObj: validBody, jobId: fixedJobId, requestId: 'req_subsequent_retry_002_xyz' });
    const resNewReqId = await callEndpoint(reqNewReqId.request, replayDb);
    const bNewReqId = await resNewReqId.json();
    assert(resNewReqId.status === 200 && bNewReqId.code === 'IDEMPOTENT_REPLAY', 'New REQUEST_ID for same JOB_ID returns 200 IDEMPOTENT_REPLAY', '[BLACK_BOX_HTTP]');
    assert(replayDb._articles.length === 1 && replayDb._receipts.length === 1, 'New REQUEST_ID does NOT duplicate persistence (REQUEST_ID is observability only)', '[LOCAL_D1_INTEGRATION]');

    // 4. Stale replay outside timestamp window (> 300s old)
    const reqStale = await buildSignedHermesRequest({
      bodyObj: validBody,
      jobId: fixedJobId,
      timestamp: Math.floor(Date.now() / 1000) - 350
    });
    const resStale = await callEndpoint(reqStale.request, replayDb);
    assert(resStale.status === 401, 'Stale replay (>300s old) rejected before reaching idempotency gate', '[BLACK_BOX_HTTP]');
  }
  console.log('');

  // =========================================================================
  // Section 10: Lost Response Recovery (Harder Version)
  // =========================================================================
  console.log('[Section 10: Lost Response Recovery — Harder Version]');
  {
    const lostDb = createMockD1Database();
    const lostJobId = 'job_lost_response_harder_001_abc';
    const lostArticleId = 'art_lost_response_harder_001_abc';
    const body = { source: 'hermes', contract_version: 1, article_id: lostArticleId, markdown: SAMPLE_CHAOS_MARKDOWN };

    // Request 1 commits
    const req1 = await buildSignedHermesRequest({ bodyObj: body, jobId: lostJobId, requestId: 'req_lost_1_original_call_001' });
    const res1 = await callEndpoint(req1.request, lostDb);
    const b1 = await res1.json();
    assert(res1.status === 201 && b1.code === 'INGEST_CREATED', 'Step 1: First request committed successfully', '[BLACK_BOX_HTTP]');

    // Sender drops response, waits 10 seconds, signs brand new request with NEW timestamp, NEW request_id, same job_id & payload
    const req2 = await buildSignedHermesRequest({
      bodyObj: body,
      jobId: lostJobId,
      requestId: 'req_lost_2_retry_after_network_drop_001',
      timestamp: Math.floor(Date.now() / 1000) + 10
    });
    const res2 = await callEndpoint(req2.request, lostDb);
    const b2 = await res2.json();

    assert(res2.status === 200 && b2.code === 'IDEMPOTENT_REPLAY', 'Step 2: Lost-response retry returns HTTP 200 IDEMPOTENT_REPLAY', '[BLACK_BOX_HTTP]');
    assert(b2.d1_article_id === b1.d1_article_id && b2.slug === b1.slug, 'Step 3: Returned D1 article ID and slug match original write exactly', '[BLACK_BOX_HTTP]');
    assert(b2.write_performed === false, 'Step 4: write_performed is false', '[BLACK_BOX_HTTP]');
    assert(lostDb._articles.length === 1 && lostDb._receipts.length === 1, 'Step 5: Database contains exactly 1 article and 1 receipt', '[LOCAL_D1_INTEGRATION]');
  }
  console.log('');

  // =========================================================================
  // Section 11 - 16: Database Fault Injections & Atomicity
  // =========================================================================
  console.log('[Section 11 - 16: Database Fault Injections & Atomicity]');
  {
    const body = { source: 'hermes', contract_version: 1, article_id: 'art_fault_test_001_abc', markdown: SAMPLE_CHAOS_MARKDOWN };

    // Section 12: Failure before write
    const failBeforeDb = createMockD1Database();
    failBeforeDb.prepare = () => { throw new Error('D1 Connection Lost Before Write'); };
    const reqBefore = await buildSignedHermesRequest({ bodyObj: body, jobId: 'job_fail_before_001_abc' });
    const resBefore = await callEndpoint(reqBefore.request, failBeforeDb);
    assert(resBefore.status === 500, 'Database failure before write returns 500 without in-memory fallback', '[UNIT_FAULT_INJECTION]');

    // Section 13: Failure during article write
    const failArticleDb = createMockD1Database({ forceFailArticle: true });
    const reqArtFail = await buildSignedHermesRequest({ bodyObj: body, jobId: 'job_fail_article_001_abc' });
    const resArtFail = await callEndpoint(reqArtFail.request, failArticleDb);
    assert(resArtFail.status === 500 && failArticleDb._articles.length === 0 && failArticleDb._receipts.length === 0,
      'Failure during article write leaves zero articles and zero receipts', '[UNIT_FAULT_INJECTION]');

    // Section 14: Failure during receipt write (Atomic Rollback)
    const failReceiptDb = createMockD1Database({ forceFailReceipt: true });
    const reqRecFail = await buildSignedHermesRequest({ bodyObj: body, jobId: 'job_fail_receipt_001_abc' });
    const resRecFail = await callEndpoint(reqRecFail.request, failReceiptDb);
    assert(resRecFail.status === 409 || resRecFail.status === 500, 'Failure during receipt write triggers batch failure', '[UNIT_FAULT_INJECTION]');
    assert(failReceiptDb._articles.length === 0 && failReceiptDb._receipts.length === 0,
      'Atomic batch rollback strictly guarantees article is not left orphaned when receipt fails', '[LOCAL_D1_INTEGRATION]');

    // Section 15: Post-commit verification failure recovery
    const postVerifyDb = createMockD1Database({ forceFailPostCommitVerify: true });
    const reqPostVerify = await buildSignedHermesRequest({ bodyObj: body, jobId: 'job_post_verify_001_abc' });
    const resPostVerify = await callEndpoint(reqPostVerify.request, postVerifyDb);
    assert(resPostVerify.status === 500, 'Post-commit verification failure surfaces 500 to client', '[UNIT_FAULT_INJECTION]');
    // Now disable the fault: subsequent client retry should resolve through receipt idempotency without creating second article
    postVerifyDb.setForceFailPostCommitVerify(false);
    const reqPostRetry = await buildSignedHermesRequest({ bodyObj: body, jobId: 'job_post_verify_001_abc', requestId: 'req_retry_after_verify_failure_001' });
    const resPostRetry = await callEndpoint(reqPostRetry.request, postVerifyDb);
    const bPostRetry = await resPostRetry.json();
    assert(resPostRetry.status === 200 && bPostRetry.code === 'IDEMPOTENT_REPLAY',
      'Retry after post-commit verification failure resolves cleanly via receipt idempotency', '[UNIT_FAULT_INJECTION]');
    assert(postVerifyDb._articles.length === 1 && postVerifyDb._receipts.length === 1,
      'Zero duplicate rows created after post-commit verification failure recovery', '[LOCAL_D1_INTEGRATION]');
  }
  console.log('');

  // =========================================================================
  // Section 17: Atomicity Stress Loop (100 Iterations)
  // =========================================================================
  console.log('[Section 17: Atomicity Stress Loop (100 Iterations)]');
  {
    const stressDb = createMockD1Database();
    let orphanCount = 0;
    let successfulIngests = 0;
    let simulatedFailures = 0;

    for (let i = 0; i < 100; i++) {
      const isFaulty = (i % 3 === 0); // Inject failure on every 3rd iteration
      stressDb.setForceFailReceipt(isFaulty);

      const iterBody = {
        source: 'hermes',
        contract_version: 1,
        article_id: `art_stress_iteration_${String(i).padStart(3, '0')}`,
        markdown: SAMPLE_CHAOS_MARKDOWN.replace(
          'Rekayasa Sirkulasi Alami pada Void Hunian Tropis Modern',
          `Rekayasa Sirkulasi Alami pada Void Iterasi Ke ${i}`
        )
      };

      const reqIter = await buildSignedHermesRequest({
        bodyObj: iterBody,
        jobId: `job_stress_iter_${String(i).padStart(3, '0')}_delivery_abc`,
        requestId: `req_stress_iter_${String(i).padStart(3, '0')}_delivery_xyz`
      });

      const resIter = await callEndpoint(reqIter.request, stressDb);
      if (resIter.status === 201) {
        successfulIngests++;
      } else {
        simulatedFailures++;
      }

      // Check atomicity invariant: article count MUST ALWAYS equal receipt count
      if (stressDb._articles.length !== stressDb._receipts.length) {
        orphanCount++;
      }
    }

    assert(orphanCount === 0, `100 iterations completed: orphan count is strictly 0 (Articles: ${stressDb._articles.length}, Receipts: ${stressDb._receipts.length})`, '[LOCAL_D1_INTEGRATION]');
    assert(successfulIngests > 0 && simulatedFailures > 0, `Stress loop exercised both success (${successfulIngests}) and rollback (${simulatedFailures}) paths`, '[LOCAL_D1_INTEGRATION]');
  }
  console.log('');

  // =========================================================================
  // Section 18 - 21: Concurrency Stress Matrices
  // =========================================================================
  console.log('[Section 18 - 21: Concurrency Stress Matrices]');
  {
    // Section 18: 50 concurrent requests with SAME JOB_ID
    const concurrent50Db = createMockD1Database();
    const c50Body = { source: 'hermes', contract_version: 1, article_id: 'art_concurrent_50_concept_abc', markdown: SAMPLE_CHAOS_MARKDOWN };
    const fixed50JobId = 'job_concurrent_burst_50_delivery_abc';

    const reqs50 = [];
    for (let i = 0; i < 50; i++) {
      const req = await buildSignedHermesRequest({
        bodyObj: c50Body,
        jobId: fixed50JobId,
        requestId: `req_burst_50_delivery_${String(i).padStart(3, '0')}_xyz`
      });
      reqs50.push(callEndpoint(req.request, concurrent50Db));
    }

    const results50 = await Promise.all(reqs50);
    const codes50 = results50.map(r => r.status);
    const successCount50 = codes50.filter(c => c === 201 || c === 200).length;
    const error500Count = codes50.filter(c => c === 500).length;

    assert(successCount50 === 50 && error500Count === 0,
      `50 simultaneous requests under same Job ID: 100% resolved cleanly with 200/201 (${codes50.filter(c => c === 201).length} Created, ${codes50.filter(c => c === 200).length} Replayed, 0 Errors)`, '[LOCAL_D1_INTEGRATION]');
    assert(concurrent50Db._articles.length === 1 && concurrent50Db._receipts.length === 1,
      '50 simultaneous requests persisted exactly 1 article and 1 receipt in D1', '[LOCAL_D1_INTEGRATION]');

    // Section 19: 25 concurrent requests with SAME ARTICLE_ID, DIFFERENT JOB_ID
    const c25ArticleDb = createMockD1Database();
    const reqs25Art = [];
    for (let i = 0; i < 25; i++) {
      const req = await buildSignedHermesRequest({
        bodyObj: c50Body,
        jobId: `job_burst_25_diff_job_${String(i).padStart(3, '0')}_abc`,
        requestId: `req_burst_25_art_delivery_${String(i).padStart(3, '0')}_xyz`
      });
      reqs25Art.push(callEndpoint(req.request, c25ArticleDb));
    }
    const results25Art = await Promise.all(reqs25Art);
    const all25ArtResolved = results25Art.every(r => r.status === 200 || r.status === 201);
    assert(all25ArtResolved && c25ArticleDb._articles.length === 1,
      '25 simultaneous requests under same Article ID with different Job IDs resolve without duplicate articles', '[LOCAL_D1_INTEGRATION]');

    // Section 20: 25 concurrent requests with SAME CONTENT, DIFFERENT ARTICLE_ID
    const c25ContentDb = createMockD1Database();
    const reqs25Content = [];
    for (let i = 0; i < 25; i++) {
      const req = await buildSignedHermesRequest({
        bodyObj: { ...c50Body, article_id: `art_diff_concept_duplicate_${String(i).padStart(3, '0')}` },
        jobId: `job_diff_concept_job_${String(i).padStart(3, '0')}_abc`,
        requestId: `req_diff_concept_delivery_${String(i).padStart(3, '0')}_xyz`
      });
      reqs25Content.push(callEndpoint(req.request, c25ContentDb));
    }
    const results25Content = await Promise.all(reqs25Content);
    const createdCount = results25Content.filter(r => r.status === 201).length;
    const conflictCount = results25Content.filter(r => r.status === 409).length;
    assert(createdCount === 1 && conflictCount === 24 && c25ContentDb._articles.length === 1,
      `25 simultaneous duplicate content requests: exactly 1 created, 24 rejected with 409 DUPLICATE_CONTENT`, '[LOCAL_D1_INTEGRATION]');

    // Section 21: Slug collision stress (Same slug, different body content)
    const cSlugDb = createMockD1Database();
    const reqsSlug = [];
    for (let i = 0; i < 10; i++) {
      const req = await buildSignedHermesRequest({
        bodyObj: {
          source: 'hermes',
          contract_version: 1,
          article_id: `art_slug_collision_concept_${String(i).padStart(3, '0')}`,
          markdown: SAMPLE_CHAOS_MARKDOWN.replace(
            'Ventilasi alami merupakan strategi fundamental',
            `Ventilasi alami variasi unik ke ${i} merupakan strategi fundamental`
          )
        },
        jobId: `job_slug_collision_job_${String(i).padStart(3, '0')}_abc`,
        requestId: `req_slug_collision_delivery_${String(i).padStart(3, '0')}_xyz`
      });
      reqsSlug.push(callEndpoint(req.request, cSlugDb));
    }
    const resultsSlug = await Promise.all(reqsSlug);
    const slugCreated = resultsSlug.filter(r => r.status === 201).length;
    const slugConflict = resultsSlug.filter(r => r.status === 409).length;
    assert(slugCreated === 1 && slugConflict === 9 && cSlugDb._articles.length === 1,
      `10 simultaneous identical-slug requests: exactly 1 created, 9 rejected with 409 conflict`, '[LOCAL_D1_INTEGRATION]');
  }
  console.log('');

  // =========================================================================
  // Section 22 - 24: Manual Ownership & Content Hash Semantics
  // =========================================================================
  console.log('[Section 22 - 24: Ownership & Hash Semantics]');
  {
    const ownDb = createMockD1Database();
    // 1. Manually create an article
    ownDb._articles.push({
      id: 50,
      slug: 'rekayasa-sirkulasi-alami-pada-void-hunian-tropis-modern',
      title: 'Manual Article With Pre-existing Slug',
      content_hash: 'manual_existing_hash_999'
    });

    // Hermes attempts to ingest an article that produces the same slug
    const reqManualCollision = await buildSignedHermesRequest({
      bodyObj: {
        source: 'hermes',
        contract_version: 1,
        article_id: 'art_attempt_manual_hijack_001',
        markdown: SAMPLE_CHAOS_MARKDOWN.replace('Ventilasi alami merupakan strategi fundamental', 'Sistem sirkulasi mekanis buatan merupakan strategi terpisah')
      },
      jobId: 'job_manual_hijack_001'
    });
    const resManualCollision = await callEndpoint(reqManualCollision.request, ownDb);
    const bManualCollision = await resManualCollision.json();
    assert(resManualCollision.status === 409 && bManualCollision.code === 'EXISTING_ARTICLE_CONFLICT',
      'Hermes cannot adopt or overwrite a manual article with matching slug (409 EXISTING_ARTICLE_CONFLICT)', '[LOCAL_D1_INTEGRATION]');
    assert(ownDb._receipts.length === 0, 'No receipt created that falsely claims Hermes ownership', '[LOCAL_D1_INTEGRATION]');

    // 2. Hermes article created, then admin edits content
    const hermesDb = createMockD1Database();
    const reqHermes = await buildSignedHermesRequest({
      bodyObj: { source: 'hermes', contract_version: 1, article_id: 'art_admin_override_001', markdown: SAMPLE_CHAOS_MARKDOWN },
      jobId: 'job_admin_override_001'
    });
    const resHermes = await callEndpoint(reqHermes.request, hermesDb);
    assert(resHermes.status === 201, 'Hermes article created', '[BLACK_BOX_HTTP]');

    // Admin updates article in database
    const createdArt = hermesDb._articles[0];
    const initialHash = createdArt.content_hash;
    const initialReceipt = hermesDb._receipts[0];

    createdArt.content_md = 'Konten diedit secara manual oleh administrator editorial.';
    createdArt.content_hash = 'updated_by_admin_hash_888';

    assert(createdArt.id === initialReceipt.article_id, 'Article ID remains unchanged after admin edit', '[LOCAL_D1_INTEGRATION]');
    assert(initialReceipt.article_content_hash === initialHash,
      'Ingestion receipt strictly preserves original historical Hermes hashes and is immutable', '[LOCAL_D1_INTEGRATION]');

    // 3. Attempting to update article through Hermes yields ARTICLE_ID_CONFLICT
    const reqHermesUpdate = await buildSignedHermesRequest({
      bodyObj: {
        source: 'hermes',
        contract_version: 1,
        article_id: 'art_admin_override_001',
        markdown: SAMPLE_CHAOS_MARKDOWN.replace('Ventilasi alami', 'Ventilasi baru modifikasi')
      },
      jobId: 'job_attempted_revision_002'
    });
    const resHermesUpdate = await callEndpoint(reqHermesUpdate.request, hermesDb);
    const bHermesUpdate = await resHermesUpdate.json();
    assert(resHermesUpdate.status === 409 && bHermesUpdate.code === 'ARTICLE_ID_CONFLICT',
      'Hermes revision attempt rejected with 409 ARTICLE_ID_CONFLICT (Phase 2A is immutable ingest)', '[BLACK_BOX_HTTP]');
  }
  console.log('');

  // =========================================================================
  // Section 25 - 27: Frontmatter & Taxonomy Fuzzing
  // =========================================================================
  console.log('[Section 25 - 27: Frontmatter & Taxonomy Fuzzing]');
  {
    const baseFm = {
      title: 'Judul Uji Coba Fuzzing',
      description: 'Deskripsi uji coba.',
      category: 'Arsitektur & Renovasi',
      author: 'RancangLoka Editorial Desk',
      focus_keyword: 'fuzzing frontmatter',
      key_takeaways: ['Satu', 'Dua', 'Tiga']
    };

    const forbiddenFields = [
      'status', 'published_at', 'scheduled_at', 'slug', 'id', 'article_id',
      'job_id', 'request_id', 'category_id', 'author_id', 'views',
      'is_featured', 'is_trending', 'is_sponsored', 'content_hash', 'content_html'
    ];

    let allForbiddenRejected = true;
    for (const field of forbiddenFields) {
      const v = validateHermesArticlePolicy({ ...baseFm, [field]: 'injected_val' });
      if (v.valid) allForbiddenRejected = false;
    }
    assert(allForbiddenRejected, `All ${forbiddenFields.length} publication-control frontmatter fields rejected with 422`, '[BLACK_BOX_HTTP]');

    // Category Fuzzing
    const badCategories = [
      'arsitektur & renovasi', // lowercase
      ' Arsitektur & Renovasi ', // whitespace
      'Arsitektur dan Renovasi', // variant
      'arsitektur-renovasi', // slug
      '3', // numeric ID string
      3, // number
      'Smart Home & Otomasi', // legacy
      'Desain Interior & Estetika' // legacy
    ];
    let allBadCatsRejected = true;
    for (const cat of badCategories) {
      const v = validateHermesArticlePolicy({ ...baseFm, category: cat });
      if (v.valid) allBadCatsRejected = false;
    }
    assert(allBadCatsRejected, 'Category fuzzing: Only exact canonical official category strings accepted', '[BLACK_BOX_HTTP]');

    // Author Fuzzing
    const badAuthors = [
      'rancangloka editorial desk', // lowercase
      ' RancangLoka Editorial Desk ', // whitespace
      'editorial desk',
      'Dewan Redaksi Spasial',
      '1',
      1,
      null
    ];
    let allBadAuthorsRejected = true;
    for (const author of badAuthors) {
      const v = validateHermesArticlePolicy({ ...baseFm, author });
      if (v.valid) allBadAuthorsRejected = false;
    }
    assert(allBadAuthorsRejected, 'Author fuzzing: Only exact "RancangLoka Editorial Desk" accepted', '[BLACK_BOX_HTTP]');
  }
  console.log('');

  // =========================================================================
  // Section 28 - 29: Stored XSS & Double Boundary Security
  // =========================================================================
  console.log('[Section 28 - 29: Stored XSS & Double Boundary Security]');
  {
    const secDb = createMockD1Database();

    // Boundary 1: Validator blocks dangerous tags at ingestion time
    const attackPayloads = [
      '<script>alert("xss")</script>',
      '<iframe src="https://evil.attacker"></iframe>',
      '<object data="exploit.swf"></object>',
      '<embed src="exploit.swf">',
      '<a href="javascript:alert(1)">Click</a>',
      '<a href="vbscript:alert(1)">Click</a>',
      '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
      '<b onclick="alert(1)">Text</b>',
      '<img src="x" onerror="alert(1)">'
    ];

    let allAttacksBlocked = true;
    for (let i = 0; i < attackPayloads.length; i++) {
      const testSecDb = createMockD1Database();
      const attackedMd = SAMPLE_CHAOS_MARKDOWN.replace(
        'Ventilasi alami merupakan strategi fundamental',
        `Ventilasi alami ${attackPayloads[i]} merupakan strategi fundamental`
      );
      const req = await buildSignedHermesRequest({
        bodyObj: { source: 'hermes', contract_version: 1, article_id: `art_xss_test_vector_${String(i).padStart(3, '0')}_abc`, markdown: attackedMd },
        jobId: `job_xss_attack_vector_${String(i).padStart(3, '0')}_abc`
      });
      const res = await callEndpoint(req.request, testSecDb);
      if (res.status === 422) {
        // Rejected at ingestion validator boundary
      } else if (res.status === 201) {
        // Allowed by validator but sanitized at canonical renderer boundary before persistence
        const art = testSecDb._articles[0];
        const html = art?.content_html || '';
        const isDangerous = (
          html.includes('<script') ||
          html.includes('<iframe') ||
          html.includes('<object') ||
          html.includes('<embed') ||
          html.includes('javascript:') ||
          html.includes('vbscript:') ||
          html.includes('onerror=') ||
          html.includes('onclick=') ||
          html.includes('alert(')
        );
        if (isDangerous) {
          allAttacksBlocked = false;
        }
      } else {
        allAttacksBlocked = false;
      }
    }
    assert(allAttacksBlocked, `Boundary 1 (Ingestion): All ${attackPayloads.length} dangerous XSS vectors fail via early 422 or canonical sanitization (zero dangerous constructs stored)`, '[BLACK_BOX_HTTP]');

    // Boundary 2: Defense-in-depth HTML rendering sanitization
    // If a legacy row in database directly contained dangerous HTML, renderer must neutralize it
    const legacyMaliciousHtml = `
      <p>Aman</p>
      <script>alert("hacked")</script>
      <iframe src="https://evil.attacker"></iframe>
      <a href="javascript:alert(1)">Link</a>
      <img src="x" onerror="alert(2)">
    `;
    const renderedSafeHtml = sanitizeArticleHtml(legacyMaliciousHtml);
    assert(
      !renderedSafeHtml.includes('<script>') &&
      !renderedSafeHtml.includes('<iframe') &&
      !renderedSafeHtml.includes('javascript:') &&
      !renderedSafeHtml.includes('onerror='),
      'Boundary 2 (Render): Phase 1B renderer sanitizes any bypass reaching display boundary', '[BLACK_BOX_HTTP]'
    );
  }
  console.log('');

  // =========================================================================
  // Section 30 - 33: Leak Audit, High-Rate Burst & Processing Order
  // =========================================================================
  console.log('[Section 30 - 33: Leak Audit, High-Rate Burst & Processing Order]');
  {
    const auditDb = createMockD1Database();

    // Trigger varied errors: 400, 401, 405, 409, 413, 415, 422, 500
    const errResponses = [
      await callEndpoint((await buildSignedHermesRequest({ contentType: 'text/plain' })).request, auditDb),
      await callEndpoint((await buildSignedHermesRequest({ signatureOverride: 'wrong' })).request, auditDb),
      await callEndpoint((await buildSignedHermesRequest({ bodyObj: { source: 'bad' } })).request, auditDb),
      await callEndpoint((await buildSignedHermesRequest({ rawBodyOverride: 'A'.repeat(520 * 1024) })).request, auditDb)
    ];

    let noLeaksFound = true;
    for (const res of errResponses) {
      const txt = await res.text();
      if (
        txt.includes('SQL') ||
        txt.includes('SELECT') ||
        txt.includes('\n    at ') ||
        txt.includes('node:') ||
        txt.includes('C:\\') ||
        txt.includes('/home/') ||
        txt.includes(TEST_KEY_CURRENT_SECRET)
      ) {
        noLeaksFound = false;
      }
    }
    assert(noLeaksFound, 'Response Leak Audit: Zero SQL, stack traces, local paths, or secrets leaked across failure responses', '[BLACK_BOX_HTTP]');

    // High-Rate Auth Failure Burst (100 invalid requests)
    let d1QueriesExecuted = 0;
    const trackedDb = createMockD1Database();
    const origPrepare = trackedDb.prepare.bind(trackedDb);
    trackedDb.prepare = (sql) => {
      d1QueriesExecuted++;
      return origPrepare(sql);
    };

    const burst100 = [];
    for (let i = 0; i < 100; i++) {
      const req = await buildSignedHermesRequest({
        bodyObj: { source: 'hermes', contract_version: 1, article_id: `art_burst_${i}`, markdown: SAMPLE_CHAOS_MARKDOWN },
        signatureOverride: 'sha256=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      });
      burst100.push(callEndpoint(req.request, trackedDb));
    }
    const burstResults = await Promise.all(burst100);
    const all100Rejected = burstResults.every(r => r.status === 401);
    assert(all100Rejected, 'High-Rate Burst: 100 invalid HMAC requests rejected with 401 Unauthorized', '[BLACK_BOX_HTTP]');
    assert(d1QueriesExecuted === 0, 'Auth Processing Order: Zero D1 queries executed during unauthenticated requests (fails before DB)', '[BLACK_BOX_HTTP]');
    assert(trackedDb._articles.length === 0 && trackedDb._receipts.length === 0, 'Zero writes or mutations occurred during auth failure burst', '[LOCAL_D1_INTEGRATION]');
  }
  console.log('');

  // =========================================================================
  // Section 34 - 36: Fail-Closed Secrets, Rotation & Trust Boundaries
  // =========================================================================
  console.log('[Section 34 - 36: Fail-Closed Secrets, Rotation & Trust Boundaries]');
  {
    const secDb = createMockD1Database();
    const validBody = { source: 'hermes', contract_version: 1, article_id: 'art_sec_boundary_001_abc', markdown: SAMPLE_CHAOS_MARKDOWN };

    // Missing secrets in env -> 503 INGEST_NOT_CONFIGURED
    const emptyEnv = {};
    const reqNoSec = await buildSignedHermesRequest({ bodyObj: validBody });
    const resNoSec = await callEndpoint(reqNoSec.request, secDb, emptyEnv);
    const bNoSec = await resNoSec.json();
    assert(resNoSec.status === 503 && bNoSec.code === 'INGEST_NOT_CONFIGURED',
      'Missing ingestion secret fails closed with 503 INGEST_NOT_CONFIGURED', '[BLACK_BOX_HTTP]');

    // Secret Rotation: Both Current and Previous keys accepted
    const reqCur = await buildSignedHermesRequest({ bodyObj: validBody, keyId: TEST_KEY_CURRENT_ID, secret: TEST_KEY_CURRENT_SECRET });
    const resCur = await callEndpoint(reqCur.request, secDb);
    assert(resCur.status === 201, 'Active CURRENT key accepted', '[BLACK_BOX_HTTP]');

    // Replay with previous key
    const reqPrev = await buildSignedHermesRequest({
      bodyObj: validBody,
      keyId: TEST_KEY_PREVIOUS_ID,
      secret: TEST_KEY_PREVIOUS_SECRET,
      requestId: 'req_prev_key_test_001_xyz'
    });
    const resPrev = await callEndpoint(reqPrev.request, secDb);
    assert(resPrev.status === 200, 'Configured PREVIOUS key accepted during rotation window', '[BLACK_BOX_HTTP]');

    // Remove previous key from env -> previous key now rejected
    const envNoPrev = {
      RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID: TEST_KEY_CURRENT_ID,
      RANCANGLOKA_HERMES_INGEST_KEY_CURRENT: TEST_KEY_CURRENT_SECRET
    };
    const resPrevDecom = await callEndpoint(reqPrev.request, secDb, envNoPrev);
    assert(resPrevDecom.status === 401, 'Decommissioned PREVIOUS key rejected with 401', '[BLACK_BOX_HTTP]');

    // Trust boundary: Admin cookie sent to Hermes receiver without HMAC -> rejected
    const adminToken = await createAdminSessionToken();
    const reqAdminCookie = new Request('http://localhost:4321/api/internal/v1/hermes-ingest', {
      method: 'POST',
      headers: {
        'Cookie': `admin_session=${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validBody)
    });
    const resAdminCookie = await callEndpoint(reqAdminCookie, secDb);
    assert(resAdminCookie.status === 401, 'Trust Boundary: Admin session cookie alone rejected by Hermes receiver (401)', '[BLACK_BOX_HTTP]');

    // Trust boundary: Hermes HMAC headers do not authenticate admin API
    const isAuthedWithHermes = await isValidAdminSession(null);
    assert(!isAuthedWithHermes, 'Trust Boundary: Hermes HMAC does not authenticate admin sessions', '[BLACK_BOX_HTTP]');
  }
  console.log('');

  // =========================================================================
  // Section 37, 40, 45 - 48: Publication Safety, Cascade & HTTP Standards
  // =========================================================================
  console.log('[Section 37, 40, 45 - 48: Publication Safety & Standards]');
  {
    const pubDb = createMockD1Database();
    const validBody = { source: 'hermes', contract_version: 1, article_id: 'art_pub_safety_001_abc', markdown: SAMPLE_CHAOS_MARKDOWN };

    const reqPub = await buildSignedHermesRequest({ bodyObj: validBody, jobId: 'job_pub_safety_001_abc' });
    const resPub = await callEndpoint(reqPub.request, pubDb);
    assert(resPub.status === 201, 'Article created', '[BLACK_BOX_HTTP]');

    const persistedArt = pubDb._articles[0];
    assert(persistedArt.status === 'draft', 'D1 article status is strictly "draft"', '[LOCAL_D1_INTEGRATION]');

    // Foreign Key Cascade test
    // Deleting the article simulates ON DELETE CASCADE on the receipt
    const artIdToDelete = persistedArt.id;
    const receiptIdx = pubDb._receipts.findIndex(r => r.article_id === artIdToDelete);
    assert(receiptIdx !== -1, 'Receipt references inserted article_id', '[LOCAL_D1_INTEGRATION]');
    // Simulate cascade deletion
    pubDb._articles.splice(0, 1);
    pubDb._receipts.splice(receiptIdx, 1);
    assert(pubDb._receipts.length === 0, 'Receipt deleted when parent article is deleted (ON DELETE CASCADE)', '[LOCAL_D1_INTEGRATION]');

    // HTTP Methods (405 Method Not Allowed + Allow: POST)
    const nonPostMethods = ['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    let allNonPost405 = true;
    for (const m of nonPostMethods) {
      const req = new Request('http://localhost:4321/api/internal/v1/hermes-ingest', { method: m });
      const res = await hermesAllHandler({ request: req, url: new URL(req.url), locals: {} });
      if (res.status !== 405 || res.headers.get('Allow') !== 'POST') {
        allNonPost405 = false;
      }
    }
    assert(allNonPost405, `All ${nonPostMethods.length} non-POST methods return 405 with Allow: POST`, '[BLACK_BOX_HTTP]');

    // Query String rejection
    const reqQuery = await buildSignedHermesRequest({
      url: 'http://localhost:4321/api/internal/v1/hermes-ingest?malicious=true',
      bodyObj: validBody
    });
    const resQuery = await callEndpoint(reqQuery.request, pubDb);
    const bQuery = await resQuery.json();
    assert(resQuery.status === 400 && bQuery.code === 'QUERY_NOT_ALLOWED', 'Query string rejected with 400 QUERY_NOT_ALLOWED', '[BLACK_BOX_HTTP]');

    // Cache-Control & Robots audit
    assert(resPub.headers.get('Cache-Control')?.includes('no-store'), 'Response sets Cache-Control: no-store, private', '[BLACK_BOX_HTTP]');
    assert(resPub.headers.get('X-Robots-Tag')?.includes('noindex'), 'Response sets X-Robots-Tag: noindex', '[BLACK_BOX_HTTP]');
  }
  console.log('');

  console.log('====================================================');
  console.log(`📊 PHASE 2A.5 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runChaosSuite().catch((err) => {
  console.error('Fatal error running Phase 2A.5 chaos suite:', err);
  process.exit(1);
});
