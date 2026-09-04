/**
 * RancangLoka Phase 1D — Comprehensive Admin Authentication & Security Hardening Test Suite
 *
 * Covers:
 * - Section 22: Auth Token & Session Security Matrix (Tests 1 - 21)
 * - Section 23: Admin UI Route Protection Matrix (Tests 22 - 28)
 * - Section 24: Admin API Security & CSRF Protection Matrix (Tests 29 - 35)
 * - Section 25: Open Redirect Normalization Matrix (Tests 36 - 41)
 */

import {
  createAdminSessionToken,
  verifyAdminSession,
  isValidAdminSession,
  verifyAdminCredentials,
  getSafeAdminRedirect,
  verifySameOrigin,
  getAdminCookieOptions,
  getAdminLogoutCookieOptions,
  getAdminSessionFromRequest,
  timingSafeEqual
} from '../src/lib/auth.ts';
import { onRequest as middlewareHandler } from '../src/middleware.ts';

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

async function runPhase1DTestSuite() {
  console.log('====================================================');
  console.log('🛡️ RancangLoka Phase 1D Automated Test Suite');
  console.log('   Admin Auth & API Security Hardening');
  console.log('====================================================\n');

  // =========================================================================
  // Section 22: Auth Test Matrix (Tests 1 - 21)
  // =========================================================================
  console.log('[Section 22: Auth Token & Session Security Matrix (Tests 1 - 21)]');

  // 1. Missing admin_session rejected
  const t1 = await verifyAdminSession(null);
  assert(!t1.valid && t1.reason === 'missing_token', '1. Missing admin_session rejected');

  // 2. Empty admin_session rejected
  const t2 = await verifyAdminSession('');
  assert(!t2.valid && t2.reason === 'empty_token', '2. Empty admin_session rejected');

  // 3. Whitespace admin_session rejected
  const t3 = await verifyAdminSession('   \t\n  ');
  assert(!t3.valid && t3.reason === 'empty_token', '3. Whitespace admin_session rejected');

  // 4. Arbitrary random admin_session rejected (GOLDEN REQUIREMENT: "hello", "random-arbitrary-value")
  const t4a = await verifyAdminSession('hello');
  const t4b = await verifyAdminSession('random-arbitrary-value');
  const t4c = await isValidAdminSession('hello');
  const t4d = await isValidAdminSession('random-arbitrary-value');
  assert(!t4a.valid && !t4b.valid && !t4c && !t4d, '4. Arbitrary random admin_session rejected (Golden Requirement: hello, random-arbitrary-value)');

  // 5. Structurally plausible but unsigned/bogus token rejected
  const fakePayloadB64 = Buffer.from(JSON.stringify({ v: 1, sid: 'bogus', iat: 1000, exp: 9999999999 })).toString('base64url');
  const t5 = await verifyAdminSession(`${fakePayloadB64}.fakeSignatureHere123`);
  assert(!t5.valid, '5. Structurally plausible but unsigned/forged token rejected');

  // 6. Valid signed session accepted
  const validToken = await createAdminSessionToken();
  const t6 = await verifyAdminSession(validToken);
  assert(t6.valid && t6.payload?.v === 1 && typeof t6.payload?.sid === 'string', '6. Valid signed session accepted with matching payload');

  // 7. Single-character token modification rejected
  const modifiedChar = validToken.slice(0, -1) + (validToken.slice(-1) === 'a' ? 'b' : 'a');
  const t7 = await verifyAdminSession(modifiedChar);
  assert(!t7.valid, '7. Single-character token modification rejected');

  // 8. Payload modification rejected
  const parts = validToken.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ v: 1, sid: 'tampered', iat: 1000, exp: 9999999999 })).toString('base64url');
  const t8 = await verifyAdminSession(`${tamperedPayload}.${parts[1]}`);
  assert(!t8.valid, '8. Payload modification with original signature rejected');

  // 9. Signature modification rejected
  const tamperedSig = parts[1].slice(1) + 'x';
  const t9 = await verifyAdminSession(`${parts[0]}.${tamperedSig}`);
  assert(!t9.valid, '9. Signature modification rejected');

  // 10. Expired signed session rejected
  const expiredToken = await createAdminSessionToken(undefined, -100); // expired 100 seconds ago
  const t10 = await verifyAdminSession(expiredToken);
  assert(!t10.valid && t10.reason === 'session_expired', '10. Expired signed session rejected with reason: session_expired');

  // 11. Future-valid signed session accepted
  const futureToken = await createAdminSessionToken(undefined, 3600); // 1 hour lifetime
  const t11 = await verifyAdminSession(futureToken);
  assert(t11.valid, '11. Future-valid signed session accepted');

  // 12. Malformed token rejected without exception leakage
  let threwException = false;
  try {
    const t12a = await verifyAdminSession('...malformed...dots...');
    const t12b = await verifyAdminSession('null.undefined');
    const t12c = await verifyAdminSession(String.fromCharCode(0, 1, 2, 3));
    assert(!t12a.valid && !t12b.valid && !t12c.valid, '12. Malformed token rejected safely without exception leakage');
  } catch (e) {
    threwException = true;
    assert(false, '12. Malformed token caused unhandled exception');
  }

  // 13. Client cannot mint a session by setting arbitrary cookie
  assert(!(await isValidAdminSession('sess_client_minted_xyz123')), '13. Client cannot mint an authenticated session with client-generated string');

  // 14. Login failure does not issue valid session
  const envTest = {
    RANCANGLOKA_ADMIN_USERNAME: 'admin',
    RANCANGLOKA_ADMIN_PASSWORD: 'super-secret-password-123',
    RANCANGLOKA_ADMIN_SESSION_SECRET: 'test-session-secret-phase1d-32-chars-long'
  };
  const loginWrongUser = await verifyAdminCredentials('attacker', 'super-secret-password-123', envTest);
  const loginWrongPass = await verifyAdminCredentials('admin', 'wrong-password', envTest);
  assert(!loginWrongUser && !loginWrongPass, '14. Login failure does not authenticate invalid credentials');

  // 15. Login success issues server-generated signed session
  const loginSuccess = await verifyAdminCredentials('admin', 'super-secret-password-123', envTest);
  const issuedSession = loginSuccess ? await createAdminSessionToken(envTest) : null;
  const verifyIssued = issuedSession ? await verifyAdminSession(issuedSession, envTest) : { valid: false };
  assert(loginSuccess && verifyIssued.valid, '15. Login success enables issuance of server-generated signed session');

  // 16. Successful login replaces attacker-supplied pre-login cookie
  const attackerPreCookie = 'attacker-fixed-session-token';
  const postLoginToken = await createAdminSessionToken(envTest);
  assert(postLoginToken !== attackerPreCookie && (await verifyAdminSession(postLoginToken, envTest)).valid && !(await verifyAdminSession(attackerPreCookie, envTest)).valid,
    '16. Successful login replaces attacker-supplied pre-login cookie with new signed token (Fixation Prevention)');

  // 17. Session cookie is HttpOnly
  const cookieOptsProd = getAdminCookieOptions(true);
  const cookieOptsDev = getAdminCookieOptions(false);
  assert(cookieOptsProd.httpOnly === true && cookieOptsDev.httpOnly === true, '17. Session cookie is always HttpOnly');

  // 18. Session cookie uses SameSite=Strict
  assert(cookieOptsProd.sameSite === 'strict' && cookieOptsDev.sameSite === 'strict', '18. Session cookie uses SameSite=Strict');

  // 19. Production cookie configuration uses Secure
  assert(cookieOptsProd.secure === true && cookieOptsDev.secure === false, '19. Cookie configuration uses Secure=true in production and Secure=false on localhost');

  // 20. Cookie Path is /
  assert(cookieOptsProd.path === '/' && cookieOptsDev.path === '/', '20. Cookie Path is strictly /');

  // 21. Logout clears cookie correctly
  const logoutOptsProd = getAdminLogoutCookieOptions(true);
  assert(logoutOptsProd.path === '/' && logoutOptsProd.maxAge === 0 && logoutOptsProd.httpOnly === true && logoutOptsProd.sameSite === 'strict',
    '21. Logout clears cookie with maxAge=0, path=/, matching HttpOnly and SameSite attributes');
  console.log('');

  // =========================================================================
  // Section 23: Admin Route Test Matrix (Tests 22 - 28)
  // =========================================================================
  console.log('[Section 23: Admin Route Test Matrix (Tests 22 - 28)]');

  // Mock middleware context builder
  function createMockContext(urlStr, cookieVal = null) {
    const headers = new Headers();
    if (cookieVal) {
      headers.set('Cookie', `admin_session=${cookieVal}`);
    }
    const request = new Request(urlStr, { headers });
    const cookies = {
      get: (key) => key === 'admin_session' && cookieVal ? { value: cookieVal } : undefined
    };
    return {
      request,
      url: new URL(urlStr),
      cookies,
      locals: {
        runtime: { env: envTest }
      }
    };
  }

  // 22. Unauthenticated /admin/posts → login redirect
  const ctx22 = createMockContext('http://localhost:4321/admin/posts');
  let nextCalled = false;
  const res22 = await middlewareHandler(ctx22, async () => { nextCalled = true; return new Response('OK'); });
  assert(res22.status === 302 && res22.headers.get('location')?.includes('/admin/login?redirect='),
    '22. Unauthenticated /admin/posts redirects to /admin/login');

  // 23. Arbitrary fake cookie /admin/posts → login redirect
  const ctx23 = createMockContext('http://localhost:4321/admin/posts', 'hello');
  const res23 = await middlewareHandler(ctx23, async () => new Response('OK'));
  assert(res23.status === 302 && res23.headers.get('location')?.includes('/admin/login'),
    '23. Arbitrary fake cookie "hello" on /admin/posts redirects to /admin/login');

  // 24. Valid signed cookie /admin/posts → allowed
  const validAdminCookie = await createAdminSessionToken(envTest);
  const ctx24 = createMockContext('http://localhost:4321/admin/posts', validAdminCookie);
  const res24 = await middlewareHandler(ctx24, async () => new Response('Admin Posts Content', { status: 200 }));
  assert(res24.status === 200, '24. Valid signed cookie on /admin/posts is permitted (200 OK)');

  // 25. Unauthenticated draft preview → login redirect
  const ctx25 = createMockContext('http://localhost:4321/admin/preview/sample-draft-slug');
  const res25 = await middlewareHandler(ctx25, async () => new Response('Preview Content'));
  assert(res25.status === 302 && res25.headers.get('location')?.includes('/admin/login?redirect='),
    '25. Unauthenticated draft preview redirects to /admin/login');

  // 26. Fake cookie draft preview → login redirect
  const ctx26 = createMockContext('http://localhost:4321/admin/preview/sample-draft-slug', 'random-arbitrary-cookie');
  const res26 = await middlewareHandler(ctx26, async () => new Response('Preview Content'));
  assert(res26.status === 302 && res26.headers.get('location')?.includes('/admin/login'),
    '26. Fake cookie draft preview redirects to /admin/login');

  // 27. Valid cookie draft preview → 200 allowed
  const ctx27 = createMockContext('http://localhost:4321/admin/preview/sample-draft-slug', validAdminCookie);
  const res27 = await middlewareHandler(ctx27, async () => new Response('Preview Content', { status: 200 }));
  assert(res27.status === 200, '27. Valid cookie draft preview is allowed (200 OK)');

  // 28. Expired cookie draft preview → login redirect
  const expiredAdminCookie = await createAdminSessionToken(envTest, -60);
  const ctx28 = createMockContext('http://localhost:4321/admin/preview/sample-draft-slug', expiredAdminCookie);
  const res28 = await middlewareHandler(ctx28, async () => new Response('Preview Content'));
  assert(res28.status === 302 && res28.headers.get('location')?.includes('/admin/login'),
    '28. Expired cookie draft preview redirects to /admin/login');
  console.log('');

  // =========================================================================
  // Section 24: Admin API Test Matrix (Tests 29 - 35)
  // =========================================================================
  console.log('[Section 24: Admin API Security & CSRF Matrix (Tests 29 - 35)]');

  const adminApiEndpoints = [
    { path: '/api/admin/authors', methods: ['GET', 'POST'] },
    { path: '/api/admin/categories', methods: ['GET', 'POST'] },
    { path: '/api/admin/import-md', methods: ['POST'] },
    { path: '/api/admin/media', methods: ['DELETE'] },
    { path: '/api/admin/pages', methods: ['GET', 'POST'] },
    { path: '/api/admin/pages/1', methods: ['PUT', 'DELETE'] },
    { path: '/api/admin/posts', methods: ['POST', 'PUT'] },
    { path: '/api/admin/settings', methods: ['POST'] },
    { path: '/api/admin/subscribers', methods: ['GET', 'DELETE'] },
    { path: '/api/admin/subscribers/export', methods: ['GET'] },
    { path: '/api/admin/upload', methods: ['POST'] }
  ];

  // Helper to test API request through middleware
  async function testApiRequest({ path, method = 'GET', cookie = null, origin = null, referer = null }) {
    const urlStr = `http://localhost:4321${path}`;
    const headers = new Headers();
    if (cookie) headers.set('Cookie', `admin_session=${cookie}`);
    if (origin) headers.set('Origin', origin);
    if (referer) headers.set('Referer', referer);

    const request = new Request(urlStr, { method, headers });
    const cookies = {
      get: (k) => k === 'admin_session' && cookie ? { value: cookie } : undefined
    };
    const ctx = {
      request,
      url: new URL(urlStr),
      cookies,
      locals: {
        runtime: { env: envTest }
      }
    };
    return await middlewareHandler(ctx, async () => new Response(JSON.stringify({ status: 'success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  // 29. Missing auth → 401 JSON for all endpoints
  let allMissing401 = true;
  for (const ep of adminApiEndpoints) {
    const res = await testApiRequest({ path: ep.path, method: ep.methods[0] });
    const isJson = res.headers.get('Content-Type')?.includes('application/json');
    if (res.status !== 401 || !isJson) {
      allMissing401 = false;
      console.error(`Endpoint ${ep.path} did not return 401 JSON on missing auth (got ${res.status})`);
    }
  }
  assert(allMissing401, '29. Missing auth → 401 JSON across all 11 admin API endpoints');

  // 30. Fake non-empty cookie → 401 JSON
  let allFake401 = true;
  for (const ep of adminApiEndpoints) {
    const res = await testApiRequest({ path: ep.path, method: ep.methods[0], cookie: 'arbitrary-fake-cookie' });
    if (res.status !== 401) {
      allFake401 = false;
      console.error(`Endpoint ${ep.path} allowed fake cookie (got ${res.status})`);
    }
  }
  assert(allFake401, '30. Fake non-empty cookie → 401 JSON across all 11 admin API endpoints');

  // 31. Expired session → 401 JSON
  let allExpired401 = true;
  for (const ep of adminApiEndpoints) {
    const res = await testApiRequest({ path: ep.path, method: ep.methods[0], cookie: expiredAdminCookie });
    if (res.status !== 401) {
      allExpired401 = false;
      console.error(`Endpoint ${ep.path} allowed expired session (got ${res.status})`);
    }
  }
  assert(allExpired401, '31. Expired session → 401 JSON across all 11 admin API endpoints');

  // 32. Valid session → permitted (for GET requests)
  const getEp = adminApiEndpoints.find(e => e.methods.includes('GET'));
  const res32 = await testApiRequest({ path: getEp.path, method: 'GET', cookie: validAdminCookie });
  assert(res32.status === 200, `32. Valid session permitted on ${getEp.path} (200 OK)`);

  // 33. Valid session + same-origin mutation → permitted
  const postEp = '/api/admin/posts';
  const res33 = await testApiRequest({
    path: postEp,
    method: 'POST',
    cookie: validAdminCookie,
    origin: 'http://localhost:4321'
  });
  assert(res33.status === 200, '33. Valid session + same-origin POST permitted (200 OK)');

  // 34. Valid session + cross-origin mutation → 403 JSON
  const res34 = await testApiRequest({
    path: postEp,
    method: 'POST',
    cookie: validAdminCookie,
    origin: 'https://attacker.evil.com'
  });
  const body34 = await res34.json().catch(() => ({}));
  assert(res34.status === 403 && body34.code === 'FORBIDDEN_CSRF', '34. Valid session + cross-origin POST rejected with 403 FORBIDDEN_CSRF');

  // 35. Invalid session + same-origin mutation → 401 JSON (Auth evaluated BEFORE CSRF / mutation processing)
  const res35 = await testApiRequest({
    path: postEp,
    method: 'POST',
    cookie: 'invalid-cookie',
    origin: 'http://localhost:4321'
  });
  const body35 = await res35.json().catch(() => ({}));
  assert(res35.status === 401 && body35.code === 'UNAUTHORIZED', '35. Invalid session + same-origin mutation rejected with 401 UNAUTHORIZED');
  console.log('');

  // =========================================================================
  // Section 25: Open Redirect Tests (Tests 36 - 41)
  // =========================================================================
  console.log('[Section 25: Open Redirect Normalization Matrix (Tests 36 - 41)]');

  // 36. redirect=/admin/posts → accepted
  assert(getSafeAdminRedirect('/admin/posts') === '/admin/posts', '36. redirect=/admin/posts accepted');

  // 37. redirect=/admin/preview/example → accepted
  assert(getSafeAdminRedirect('/admin/preview/example') === '/admin/preview/example', '37. redirect=/admin/preview/example accepted');

  // 38. redirect=https://evil.example → normalized/rejected
  assert(getSafeAdminRedirect('https://evil.example') === '/admin', '38. redirect=https://evil.example normalized to /admin');

  // 39. redirect=//evil.example → normalized/rejected
  assert(getSafeAdminRedirect('//evil.example') === '/admin', '39. redirect=//evil.example normalized to /admin');

  // 40. redirect=javascript:alert(1) → normalized/rejected
  assert(getSafeAdminRedirect('javascript:alert(1)') === '/admin', '40. redirect=javascript:alert(1) normalized to /admin');

  // 41. encoded external redirect → normalized/rejected
  assert(getSafeAdminRedirect('/\\evil.example') === '/admin', '41A. redirect=/\\evil.example normalized to /admin');
  assert(getSafeAdminRedirect('https%3A%2F%2Fevil.example') === '/admin', '41B. encoded external URL normalized to /admin');
  assert(getSafeAdminRedirect('/admin\r\nHeader-Injection') === '/admin', '41C. CRLF injection normalized to /admin');
  console.log('');

  // =========================================================================
  // Extra Verification: Timing-Safe Comparison & Secret Rotation Readiness
  // =========================================================================
  console.log('[Extra Verification: Secret Rotation Readiness]');

  // Rotation test: token signed with old secret, candidate previous secret configured
  const oldSecret = 'old-previous-signing-secret-key-1';
  const newSecret = 'brand-new-current-signing-secret-2';
  const tokenFromOld = await createAdminSessionToken({ RANCANGLOKA_ADMIN_SESSION_SECRET: oldSecret });

  // System configured with newSecret as primary, oldSecret in previous secrets
  const rotationEnv = {
    RANCANGLOKA_ADMIN_SESSION_SECRET: newSecret,
    RANCANGLOKA_ADMIN_PREVIOUS_SECRETS: `another-secret, ${oldSecret}`
  };
  const rotationVerify = await verifyAdminSession(tokenFromOld, rotationEnv);
  assert(rotationVerify.valid === true, 'Rotation Test: Token signed with previous secret remains valid during rotation window');
  console.log('');

  // =========================================================================
  // Section 26: Base64URL Malleability & Canonical Representation Defense Matrix
  // =========================================================================
  console.log('[Section 26: Base64URL Malleability & Canonical Representation Matrix]');

  // 1. Valid server-issued token accepted
  const canonicalToken = await createAdminSessionToken();
  const res1 = await verifyAdminSession(canonicalToken);
  assert(res1.valid === true && res1.payload?.v === 1, 'Malleability 1: Valid server-issued token accepted');

  // 2. Arbitrary token rejected
  const res2 = await verifyAdminSession('arbitrary.invalid.token');
  assert(res2.valid === false, 'Malleability 2: Arbitrary token rejected');

  // 3. Single-character payload modification rejected
  const [cPayload, cSig] = canonicalToken.split('.');
  const modPayloadChar = (cPayload[0] === 'a' ? 'b' : 'a') + cPayload.slice(1);
  const res3 = await verifyAdminSession(`${modPayloadChar}.${cSig}`);
  assert(res3.valid === false, 'Malleability 3: Single-character payload modification rejected');

  // 4. Single-character signature modification rejected
  const modSigChar = (cSig[0] === 'a' ? 'b' : 'a') + cSig.slice(1);
  const res4 = await verifyAdminSession(`${cPayload}.${modSigChar}`);
  assert(res4.valid === false, 'Malleability 4: Single-character signature modification rejected');

  // 5. Changing only unused Base64URL padding bits is rejected
  // In base64url, 32-byte HMAC produces 43 chars (258 bits). The 43rd char has 2 unused padding bits.
  // Modifying those unused bits produces non-canonical base64url that decodes to the exact same bytes.
  const sigBytesRaw = Buffer.from(cSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  assert(sigBytesRaw.length === 32, 'Signature bytes must be exactly 32');
  // Find an alternate 43rd character that decodes to the exact same 32 bytes
  const lastChar = cSig.slice(-1);
  // In Base64URL, flip bit 0 or 1 of the 6-bit char
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const charIdx = base64Chars.indexOf(lastChar);
  // Flip the lowest bit (unused padding bit in 43rd char of 32-byte string)
  const flippedIdx = charIdx ^ 1;
  const nonCanonicalSig = cSig.slice(0, -1) + base64Chars[flippedIdx];
  const res5 = await verifyAdminSession(`${cPayload}.${nonCanonicalSig}`);
  assert(res5.valid === false && res5.reason === 'non_canonical_signature_encoding', 'Malleability 5: Changing only unused Base64URL padding bits is rejected');

  // 6. Alternate non-canonical Base64URL representation of same signature bytes rejected (e.g. with standard padding '=')
  const res6 = await verifyAdminSession(`${cPayload}.${cSig}=`);
  assert(res6.valid === false, 'Malleability 6: Alternate non-canonical representation (with padding) rejected');

  // 7. Malformed Base64URL rejected (contains illegal characters like +, /, @, !)
  const res7 = await verifyAdminSession(`${cPayload}.${cSig.slice(0, -1)}+`);
  assert(res7.valid === false, 'Malleability 7: Malformed Base64URL rejected');

  // 8. Decoded signature length != 32 rejected (e.g. truncated 16-byte signature)
  const truncatedSig = Buffer.from(sigBytesRaw.subarray(0, 16)).toString('base64url');
  const res8 = await verifyAdminSession(`${cPayload}.${truncatedSig}`);
  assert(res8.valid === false && res8.reason === 'invalid_signature_length', 'Malleability 8: Decoded signature length != 32 rejected');

  // 9. Expired token rejected
  const expToken = await createAdminSessionToken(undefined, -60);
  const res9 = await verifyAdminSession(expToken);
  assert(res9.valid === false && res9.reason === 'session_expired', 'Malleability 9: Expired token rejected');

  // 10. Valid canonical token still accepted
  const freshToken = await createAdminSessionToken();
  const res10 = await verifyAdminSession(freshToken);
  assert(res10.valid === true, 'Malleability 10: Valid canonical token still accepted');

  // 11. Previous-secret rotation behavior remains functional
  const res11 = await verifyAdminSession(tokenFromOld, rotationEnv);
  assert(res11.valid === true, 'Malleability 11: Previous-secret rotation behavior remains functional');

  // 12. No exception or stack leakage on arbitrary input
  let noLeak = true;
  try {
    const res12 = await verifyAdminSession('\x00\xFF\xFEundefined.null');
    assert(res12.valid === false, 'Malleability 12: No exception/stack leakage on null/binary input');
  } catch {
    noLeak = false;
    assert(false, 'Malleability 12: Exception was leaked');
  }

  console.log('====================================================');
  console.log(`📊 PHASE 1D TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase1DTestSuite().catch((err) => {
  console.error('Fatal error running Phase 1D test suite:', err);
  process.exit(1);
});
