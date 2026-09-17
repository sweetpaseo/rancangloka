/**
 * RancangLoka Phase 3B-5B — Authenticated Read-Only Publication Inventory
 * Automated Test Suite
 *
 * Matrix of Tests:
 * 1. Auth Unit Tests (HMAC Canonical String, Web Crypto Sign/Verify, Key Resolution, Headers)
 * 2. Query Validation Tests (limit, after_id, status boundaries & rejections)
 * 3. Endpoint Integration Tests (GET /api/internal/v1/publication-inventory)
 * 4. Pagination & Cursor Contract Tests
 * 5. Method Rejection Tests (Non-GET returns 405)
 * 6. Isolation & Security Verification (Zero secret leakage, No content_md/content_html)
 */

import {
  INVENTORY_TIMESTAMP_WINDOW_SECONDS,
  INVENTORY_ROUTE_PATH,
  INVENTORY_SIGNATURE_VERSION,
  isValidRequestId,
  isValidKeyId,
  buildInventoryCanonicalQuery,
  buildInventoryCanonicalString,
  getInventoryReadSecret,
  signInventoryCanonicalString,
  verifyInventoryHmac,
  extractAndValidateInventoryHeaders
} from '../src/lib/inventory-auth.ts';
import {
  GET as publicationInventoryGet,
  ALL as publicationInventoryAll
} from '../src/pages/api/internal/v1/publication-inventory.ts';

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

console.log('\n====================================================');
console.log('🧪 RANCANGLOKA PHASE 3B-5B TEST SUITE');
console.log('====================================================\n');

const FAKE_CURRENT_KEY_ID = 'key_test_reader_2026_current';
const FAKE_CURRENT_SECRET = 'test_secret_3b5b_read_only_current_abc12345';
const FAKE_PREVIOUS_KEY_ID = 'key_test_reader_2026_previous';
const FAKE_PREVIOUS_SECRET = 'test_secret_3b5b_read_only_prev_xyz98765';

const mockEnv = {
  RANCANGLOKA_INVENTORY_READ_KEY_CURRENT_ID: FAKE_CURRENT_KEY_ID,
  RANCANGLOKA_INVENTORY_READ_KEY_CURRENT: FAKE_CURRENT_SECRET,
  RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS_ID: FAKE_PREVIOUS_KEY_ID,
  RANCANGLOKA_INVENTORY_READ_KEY_PREVIOUS: FAKE_PREVIOUS_SECRET
};

async function runTests() {
  // =========================================================================
  // Section 1: Identifier & Key ID Validation
  // =========================================================================
  console.log('[Section 1: Request ID & Key ID Format Validation]');
  assert(isValidRequestId('req_1234567890abcdef'), 'Valid request ID (16 chars suffix) accepted');
  assert(isValidRequestId('req_a-b_c-d_e-f_1234567890_xyz'), 'Valid request ID with dashes/underscores accepted');
  assert(!isValidRequestId('req_short'), 'Short request ID (<16 chars suffix) rejected');
  assert(!isValidRequestId('art_1234567890abcdef'), 'Wrong prefix (art_) rejected');
  assert(!isValidRequestId('req_1234567890abcdef!@#$'), 'Special characters rejected');
  assert(!isValidRequestId(''), 'Empty request ID rejected');

  assert(isValidKeyId('key_test_2026.01-abc'), 'Valid key ID accepted');
  assert(isValidKeyId('RL-READER-V1'), 'Valid alphanumeric key ID accepted');
  assert(!isValidKeyId(''), 'Empty key ID rejected');
  assert(!isValidKeyId('key with spaces'), 'Key ID with spaces rejected');

  // =========================================================================
  // Section 2: Canonical Query & Canonical String Determinism
  // =========================================================================
  console.log('\n[Section 2: Canonical HMAC String Construction & Query Invariance]');
  const q1 = buildInventoryCanonicalQuery({ status: 'all', limit: 50, after_id: 12 });
  const q2 = buildInventoryCanonicalQuery({ after_id: 12, limit: 50, status: 'all' });
  const q3 = buildInventoryCanonicalQuery({ limit: 50, status: 'all', after_id: 12 });
  assert(q1 === 'after_id=12&limit=50&status=all', 'Canonical query sorted lexicographically');
  assert(q1 === q2 && q2 === q3, 'Query parameter order does not alter canonical query');

  const emptyQuery = buildInventoryCanonicalQuery({});
  assert(emptyQuery === '', 'Empty query produces empty string');

  const ts = 1772683200;
  const reqId = 'req_test_sample_2026_001_abc';
  const canonicalString1 = buildInventoryCanonicalString(ts, reqId, q1);
  const expectedCanonical = `v1\nGET\n/api/internal/v1/publication-inventory\n1772683200\nreq_test_sample_2026_001_abc\nafter_id=12&limit=50&status=all`;
  assert(canonicalString1 === expectedCanonical, 'Canonical string exactly matches specification');

  // Different query value produces different canonical string
  const qDiff = buildInventoryCanonicalQuery({ after_id: 13, limit: 50, status: 'all' });
  const canonicalStringDiff = buildInventoryCanonicalString(ts, reqId, qDiff);
  assert(canonicalString1 !== canonicalStringDiff, 'Different query value alters canonical string');

  // =========================================================================
  // Section 3: HMAC Sign & Verify Web Crypto Matrix
  // =========================================================================
  console.log('\n[Section 3: HMAC-SHA256 Web Crypto Verification]');
  const validSig = await signInventoryCanonicalString(canonicalString1, FAKE_CURRENT_SECRET);
  assert(validSig.length === 64, 'Generated HMAC signature is 64-character hex');

  const isSigValid = await verifyInventoryHmac(canonicalString1, validSig, FAKE_CURRENT_SECRET);
  assert(isSigValid === true, 'Valid signature verified successfully');

  const wrongSig = validSig.slice(0, -2) + 'aa';
  const isWrongSigValid = await verifyInventoryHmac(canonicalString1, wrongSig, FAKE_CURRENT_SECRET);
  assert(isWrongSigValid === false, 'Tampered signature rejected');

  const isWrongSecretValid = await verifyInventoryHmac(canonicalString1, validSig, 'wrong_secret_12345');
  assert(isWrongSecretValid === false, 'Signature with wrong secret rejected');

  const isWrongCanonicalValid = await verifyInventoryHmac(canonicalStringDiff, validSig, FAKE_CURRENT_SECRET);
  assert(isWrongCanonicalValid === false, 'Signature rejected when canonical string differs');

  // Key resolution & rotation tests
  const resCurrent = getInventoryReadSecret(FAKE_CURRENT_KEY_ID, mockEnv);
  assert(resCurrent.configured === true && resCurrent.isKnownKey === true && resCurrent.secret === FAKE_CURRENT_SECRET, 'Current key resolved successfully');

  const resPrevious = getInventoryReadSecret(FAKE_PREVIOUS_KEY_ID, mockEnv);
  assert(resPrevious.configured === true && resPrevious.isKnownKey === true && resPrevious.secret === FAKE_PREVIOUS_SECRET, 'Previous rotation key resolved successfully');

  const resUnknown = getInventoryReadSecret('unknown_key_999', mockEnv);
  assert(resUnknown.configured === true && resUnknown.isKnownKey === false && resUnknown.secret === null, 'Unknown key rejected');

  const resUnconfigured = getInventoryReadSecret(FAKE_CURRENT_KEY_ID, {});
  assert(resUnconfigured.configured === false && resUnconfigured.secret === null, 'Unconfigured environment fails closed');

  // =========================================================================
  // Section 4: Header Extraction & Replay Window
  // =========================================================================
  console.log('\n[Section 4: Header Extraction & Clock Skew Validation]');
  const now = Math.floor(Date.now() / 1000);
  const baseHeaders = new Headers({
    'x-rl-signature-version': 'v1',
    'x-rl-timestamp': String(now),
    'x-rl-request-id': 'req_inventory_test_001_abc',
    'x-rl-key-id': FAKE_CURRENT_KEY_ID,
    'x-rl-signature': `sha256=${validSig}`
  });

  const hOk = extractAndValidateInventoryHeaders(baseHeaders, now);
  assert(hOk.valid === true && hOk.data.requestId === 'req_inventory_test_001_abc', 'Valid headers extracted successfully');

  // Clock skew: within ±300s
  const hWithinSkew = extractAndValidateInventoryHeaders(new Headers({
    ...Object.fromEntries(baseHeaders.entries()),
    'x-rl-timestamp': String(now - 299)
  }), now);
  assert(hWithinSkew.valid === true, 'Timestamp at -299s within tolerance window accepted');

  // Clock skew: outside window
  const hExpired = extractAndValidateInventoryHeaders(new Headers({
    ...Object.fromEntries(baseHeaders.entries()),
    'x-rl-timestamp': String(now - 301)
  }), now);
  assert(hExpired.valid === false && hExpired.code === 'TIMESTAMP_OUT_OF_WINDOW', 'Expired timestamp (-301s) rejected');

  const hFuture = extractAndValidateInventoryHeaders(new Headers({
    ...Object.fromEntries(baseHeaders.entries()),
    'x-rl-timestamp': String(now + 301)
  }), now);
  assert(hFuture.valid === false && hFuture.code === 'TIMESTAMP_OUT_OF_WINDOW', 'Future timestamp (+301s) rejected');

  // Header format errors
  const hNoVersion = extractAndValidateInventoryHeaders(new Headers({
    ...Object.fromEntries(baseHeaders.entries()),
    'x-rl-signature-version': ''
  }), now);
  assert(hNoVersion.valid === false && hNoVersion.code === 'SIGNATURE_VERSION_REQUIRED', 'Missing signature version rejected');

  const hBadSigPrefix = extractAndValidateInventoryHeaders(new Headers({
    ...Object.fromEntries(baseHeaders.entries()),
    'x-rl-signature': validSig // missing sha256=
  }), now);
  assert(hBadSigPrefix.valid === false && hBadSigPrefix.code === 'SIGNATURE_INVALID', 'Signature without sha256= prefix rejected');

  const hBadSigLength = extractAndValidateInventoryHeaders(new Headers({
    ...Object.fromEntries(baseHeaders.entries()),
    'x-rl-signature': 'sha256=abcdef1234'
  }), now);
  assert(hBadSigLength.valid === false && hBadSigLength.code === 'SIGNATURE_INVALID', 'Signature with invalid hex length rejected');

  // =========================================================================
  // Section 5: Query Validation Matrix (Limit, After_id, Status)
  // =========================================================================
  console.log('\n[Section 5: Query Parameter Validation Matrix]');

  // Mock D1 Database for isolated unit testing
  const mockRows = [
    {
      id: 1,
      slug: 'rancangloka-internal-ingest-smoke-test-2026-09-04',
      title: 'RancangLoka Internal Ingest Smoke Test 2026-09-04',
      description: 'Test Description 1',
      category: 'Arsitektur & Renovasi',
      author: 'RancangLoka Editorial Desk',
      focus_keyword: 'internal ingest smoke test',
      status: 'draft',
      content_hash: '0b88aa50b67259013d00757825356877ae3a78061d9151dc446eb0e8d0f419cf',
      published_at: '2026-09-04T07:43:06.284Z',
      updated_at: '2026-09-04T07:43:06.284Z'
    },
    {
      id: 2,
      slug: 'rancangloka-internal-sender-smoke-2b3c-kenapa-rumah-terasa-pengap-padahal-banyak-jendela',
      title: 'RancangLoka Internal Sender Smoke 2B3C',
      description: 'Test Description 2',
      category: 'Kenyamanan Rumah',
      author: 'RancangLoka Editorial Desk',
      focus_keyword: 'rumah terasa pengap',
      status: 'draft',
      content_hash: 'a4c0b0e7602727a31a0a8a49571f71ba3ea10363d0619d70f7898edb91fc809e',
      published_at: '2026-09-04T09:29:46.757Z',
      updated_at: '2026-09-04T09:29:46.757Z'
    },
    {
      id: 3,
      slug: 'rancangloka-sender-runtime-smoke-test-2b3d-2-v2-2026-09-04',
      title: 'RancangLoka Sender Runtime Smoke Test 2B3D-2 V2',
      description: 'Test Description 3',
      category: 'Arsitektur & Renovasi',
      author: 'RancangLoka Editorial Desk',
      focus_keyword: 'sender runtime smoke test',
      status: 'draft',
      content_hash: '45f3eb3bd367a604755ae1363c15507771907748e9cab1f35a551943e37bd0e1',
      published_at: '2026-09-04T15:03:45.440Z',
      updated_at: '2026-09-04T15:03:45.440Z'
    }
  ];

  let lastExecutedSql = '';
  let lastBindings = [];

  const mockDb = {
    prepare(sql) {
      lastExecutedSql = sql;
      return {
        async all() {
          if (sql.includes('settings')) {
            return { results: [{ key: 'site_url', value: 'https://rancangloka.com' }] };
          }
          return { results: mockRows };
        },
        bind(...args) {
          lastBindings = args;
          return {
            async all() {
              // Parse filter from bindings and SQL
              let filtered = [...mockRows];
              let bindingIdx = 0;
              if (sql.includes('a.id > ?')) {
                const afterVal = args[bindingIdx++];
                filtered = filtered.filter(r => r.id > afterVal);
              }
              if (sql.includes('a.status = ?')) {
                const statusVal = args[bindingIdx++];
                filtered = filtered.filter(r => r.status === statusVal);
              }
              const limitVal = args[bindingIdx];
              return { results: filtered.slice(0, limitVal) };
            }
          };
        }
      };
    }
  };

  const mockLocals = {
    runtime: {
      env: {
        ...mockEnv,
        DB: mockDb
      }
    }
  };

  async function executeTestRequest(queryParams = {}, headersOverride = {}) {
    const canonicalQ = buildInventoryCanonicalQuery(queryParams);
    const tsNow = Math.floor(Date.now() / 1000);
    const rId = 'req_test_query_validation_001';
    const canonStr = buildInventoryCanonicalString(tsNow, rId, canonicalQ);
    const sig = await signInventoryCanonicalString(canonStr, FAKE_CURRENT_SECRET);

    const qs = new URLSearchParams(queryParams).toString();
    const fullUrl = `http://localhost:4321/api/internal/v1/publication-inventory${qs ? '?' + qs : ''}`;
    const urlObj = new URL(fullUrl);

    const headers = new Headers({
      'x-rl-signature-version': 'v1',
      'x-rl-timestamp': String(tsNow),
      'x-rl-request-id': rId,
      'x-rl-key-id': FAKE_CURRENT_KEY_ID,
      'x-rl-signature': `sha256=${sig}`,
      ...headersOverride
    });

    const request = new Request(fullUrl, { method: 'GET', headers });
    return await publicationInventoryGet({ request, url: urlObj, locals: mockLocals });
  }

  // 5a. Query boundary tests
  const resDefault = await executeTestRequest({});
  assert(resDefault.status === 200, 'Query with default parameters succeeds (200)');
  const dataDefault = await resDefault.json();
  assert(dataDefault.query.limit === 50, 'limit omitted defaults to 50');
  assert(dataDefault.query.status === 'all', 'status omitted defaults to all');
  assert(dataDefault.query.after_id === null, 'after_id omitted is null');
  assert(dataDefault.articles.length === 3, 'Returns 3 articles in test mock');

  const resLimit1 = await executeTestRequest({ limit: 1 });
  assert(resLimit1.status === 200, 'limit=1 is valid');
  const dataLimit1 = await resLimit1.json();
  assert(dataLimit1.articles.length === 1 && dataLimit1.page.has_more === true && dataLimit1.page.next_after_id === 1, 'limit=1 returns 1 row with has_more=true and next_after_id=1');

  const resLimit100 = await executeTestRequest({ limit: 100 });
  assert(resLimit100.status === 200, 'limit=100 is valid');

  const resLimit0 = await executeTestRequest({ limit: 0 });
  assert(resLimit0.status === 400, 'limit=0 returns 400');

  const resLimit101 = await executeTestRequest({ limit: 101 });
  assert(resLimit101.status === 400, 'limit=101 returns 400');

  const resLimitAbc = await executeTestRequest({ limit: 'abc' });
  assert(resLimitAbc.status === 400, 'limit=abc returns 400');

  const resLimitFloat = await executeTestRequest({ limit: '1.5' });
  assert(resLimitFloat.status === 400, 'limit=1.5 returns 400');

  const resLimitNeg = await executeTestRequest({ limit: '-1' });
  assert(resLimitNeg.status === 400, 'limit=-1 returns 400');

  // 5b. After_id tests
  const resAfter0 = await executeTestRequest({ after_id: 0 });
  assert(resAfter0.status === 200, 'after_id=0 is valid');

  const resAfter12 = await executeTestRequest({ after_id: 12 });
  assert(resAfter12.status === 200, 'after_id=12 is valid');

  const resAfterNeg = await executeTestRequest({ after_id: -1 });
  assert(resAfterNeg.status === 400, 'after_id=-1 returns 400');

  const resAfterAbc = await executeTestRequest({ after_id: 'abc' });
  assert(resAfterAbc.status === 400, 'after_id=abc returns 400');

  const resAfterFloat = await executeTestRequest({ after_id: '1.2' });
  assert(resAfterFloat.status === 400, 'after_id=1.2 returns 400');

  // 5c. Status filter tests
  const resStatusAll = await executeTestRequest({ status: 'all' });
  assert(resStatusAll.status === 200, 'status=all is valid');

  const resStatusDraft = await executeTestRequest({ status: 'draft' });
  assert(resStatusDraft.status === 200, 'status=draft is valid');
  const dataDraft = await resStatusDraft.json();
  assert(dataDraft.articles.every(a => a.status === 'draft'), 'status=draft returns only draft articles');

  const resStatusPub = await executeTestRequest({ status: 'published' });
  assert(resStatusPub.status === 200, 'status=published is valid');
  const dataPub = await resStatusPub.json();
  assert(dataPub.articles.length === 0, 'status=published returns 0 rows when all are drafts');

  const resStatusTrash = await executeTestRequest({ status: 'trash' });
  assert(resStatusTrash.status === 400, 'status=trash returns 400');

  const resUnknownParam = await executeTestRequest({ hack: 'true' });
  assert(resUnknownParam.status === 400, 'Unknown query parameter rejected with 400');

  // =========================================================================
  // Section 6: SQL Parameterization & Security Verification
  // =========================================================================
  console.log('\n[Section 6: SQL Parameterization & Security Verification]');
  await executeTestRequest({ after_id: 2, status: 'draft', limit: 25 });
  assert(lastExecutedSql.includes('ORDER BY a.id ASC'), 'Uses stable ascending cursor ORDER BY a.id ASC');
  assert(!lastExecutedSql.includes('OFFSET'), 'Does not use OFFSET pagination');
  assert(!lastExecutedSql.includes('content_md') && !lastExecutedSql.includes('content_html'), 'Does not query content_md or content_html');
  assert(lastExecutedSql.includes('a.id > ?') && lastExecutedSql.includes('a.status = ?'), 'Uses parameter markers for conditions');
  assert(lastBindings[0] === 2 && lastBindings[1] === 'draft' && lastBindings[2] === 26, 'Bindings array contains bound values strictly [after_id, status, limit+1]');

  // Verify response fields
  const firstArticle = dataDefault.articles[0];
  assert('id' in firstArticle, 'Article contains id');
  assert('slug' in firstArticle, 'Article contains slug');
  assert('title' in firstArticle, 'Article contains title');
  assert('description' in firstArticle, 'Article contains description');
  assert('category' in firstArticle, 'Article contains category');
  assert('author' in firstArticle, 'Article contains author');
  assert('focus_keyword' in firstArticle, 'Article contains focus_keyword');
  assert('status' in firstArticle, 'Article contains status');
  assert('content_hash' in firstArticle, 'Article contains content_hash');
  assert('published_at' in firstArticle, 'Article contains published_at');
  assert('updated_at' in firstArticle, 'Article contains updated_at');
  assert('canonical_url' in firstArticle, 'Article contains canonical_url');
  assert(!('content_md' in firstArticle), 'content_md is NOT present in article response');
  assert(!('content_html' in firstArticle), 'content_html is NOT present in article response');
  assert(!('key_takeaways' in firstArticle), 'key_takeaways is NOT present in article response');
  assert(firstArticle.canonical_url.startsWith('https://rancangloka.com/'), 'Canonical URL matches production public origin');

  // =========================================================================
  // Section 7: HTTP Method & Trust Separation
  // =========================================================================
  console.log('\n[Section 7: HTTP Method Policy & Trust Separation]');
  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const postReq = new Request('http://localhost:4321/api/internal/v1/publication-inventory', { method: m });
    const postRes = await publicationInventoryAll({ request: postReq });
    assert(postRes.status === 405, `Method ${m} rejected with 405 Method Not Allowed`);
    assert(postRes.headers.get('Allow') === 'GET', `Method ${m} response includes Allow: GET header`);
  }

  // Cross-auth separation test: Ingest secret must NOT authenticate inventory endpoint
  const tsSep = Math.floor(Date.now() / 1000);
  const canonSep = buildInventoryCanonicalString(tsSep, 'req_separation_test_001_abc', '');
  const ingestFakeSecret = 'fake_ingest_secret_not_for_reading_123';
  const sigWithIngestSecret = await signInventoryCanonicalString(canonSep, ingestFakeSecret);

  const resCrossAuth = await executeTestRequest({}, {
    'x-rl-key-id': FAKE_CURRENT_KEY_ID,
    'x-rl-signature': `sha256=${sigWithIngestSecret}`
  });
  assert(resCrossAuth.status === 401, 'Request signed with ingest secret is rejected by publication inventory (401)');

  // Missing authentication
  const resNoAuth = await publicationInventoryGet({
    request: new Request('http://localhost:4321/api/internal/v1/publication-inventory', { method: 'GET' }),
    url: new URL('http://localhost:4321/api/internal/v1/publication-inventory'),
    locals: mockLocals
  });
  assert(resNoAuth.status === 401, 'Unauthenticated request rejected with 401');

  console.log('\n====================================================');
  console.log(`📊 PHASE 3B-5B TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
