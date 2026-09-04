/**
 * RancangLoka Web Crypto Authentication & Cryptographic Session Security Core
 * Compatible with Cloudflare Workers and Node.js runtime.
 */

export interface AdminSessionPayload {
  v: number;       // Version (1)
  sid: string;     // Cryptographically random session identifier (hex)
  iat: number;     // Issued at timestamp (seconds)
  exp: number;     // Expiration timestamp (seconds)
}

export const ADMIN_COOKIE_NAME = 'admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 8 * 3600; // 8 hours (28,800 seconds)

// Helper: Base64URL encode
function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper: Base64URL decode
function base64UrlDecode(str: string): Uint8Array | null {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

// Helper: Import HMAC-SHA256 CryptoKey
async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Checks if the runtime environment is production.
 */
export function isProductionEnvironment(env?: any): boolean {
  const envMode = env?.ENVIRONMENT ||
                  (globalThis as any).process?.env?.ENVIRONMENT ||
                  (import.meta as any).env?.MODE;
  return envMode === 'production';
}

/**
 * Retrieves the server-side HMAC session signing secret from environment bindings.
 * Fails closed in production if secret is missing.
 */
export function getAdminSessionSecret(env?: any): string {
  const secret = env?.RANCANGLOKA_ADMIN_SESSION_SECRET ||
                 (globalThis as any).process?.env?.RANCANGLOKA_ADMIN_SESSION_SECRET;
  if (secret && typeof secret === 'string' && secret.trim().length > 0) {
    return secret.trim();
  }
  if (isProductionEnvironment(env)) {
    // Fail closed in production: NEVER use development fallback secret
    return '';
  }
  return 'rancangloka-default-dev-secret-change-in-production-32bytes-min';
}

/**
 * Retrieves the expected administrator credentials from server runtime environment.
 * Fails closed in production if credentials are missing.
 */
export function getAdminCredentials(env?: any): { expectedUser: string; expectedPass: string } {
  const expectedUser = env?.RANCANGLOKA_ADMIN_USERNAME ||
                       (globalThis as any).process?.env?.RANCANGLOKA_ADMIN_USERNAME;
  const expectedPass = env?.RANCANGLOKA_ADMIN_PASSWORD ||
                       (globalThis as any).process?.env?.RANCANGLOKA_ADMIN_PASSWORD;

  if (isProductionEnvironment(env)) {
    // In production, require explicit secret bindings. Fail closed if absent.
    return {
      expectedUser: (expectedUser && typeof expectedUser === 'string') ? expectedUser.trim() : '',
      expectedPass: (expectedPass && typeof expectedPass === 'string') ? expectedPass.trim() : ''
    };
  }

  return {
    expectedUser: (expectedUser && typeof expectedUser === 'string' && expectedUser.trim()) ? expectedUser.trim() : 'admin',
    expectedPass: (expectedPass && typeof expectedPass === 'string' && expectedPass.trim()) ? expectedPass.trim() : 'admin123'
  };
}

/**
 * Constant-time string equality check to mitigate timing side-channel attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

/**
 * Server-side administrator login credential verification.
 */
export async function verifyAdminCredentials(
  username: string,
  password: string,
  env?: any
): Promise<boolean> {
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return false;
  }
  const { expectedUser, expectedPass } = getAdminCredentials(env);
  const userMatch = timingSafeEqual(username.trim(), expectedUser);
  const passMatch = timingSafeEqual(password, expectedPass);
  return userMatch && passMatch;
}

/**
 * Generates a cryptographically random hexadecimal session identifier.
 */
export function generateSessionId(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 */
export async function createAdminSessionToken(
  env?: any,
  customTtlSeconds?: number,
  customIssuedAt?: number
): Promise<string> {
  const secret = getAdminSessionSecret(env);
  if (!secret) {
    throw new Error('Admin session secret is not configured in production environment.');
  }
  const key = await getHmacKey(secret);

  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const sid = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');

  const nowSec = customIssuedAt !== undefined ? customIssuedAt : Math.floor(Date.now() / 1000);
  const ttl = customTtlSeconds !== undefined ? customTtlSeconds : ADMIN_SESSION_TTL_SECONDS;
  const exp = nowSec + ttl;

  const payload: AdminSessionPayload = {
    v: 1,
    sid,
    iat: nowSec,
    exp
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const encoder = new TextEncoder();
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload));
  const encodedSig = base64UrlEncode(new Uint8Array(sigBuffer));

  return `${encodedPayload}.${encodedSig}`;
}

/**
 * Verifies the authenticity, cryptographic signature, and expiry of an admin session token.
 * Supports secret rotation via optional RANCANGLOKA_ADMIN_PREVIOUS_SECRETS.
 */
export async function verifyAdminSession(
  token: string | null | undefined,
  env?: any
): Promise<{ valid: boolean; payload?: AdminSessionPayload; reason?: string }> {
  if (token === null || token === undefined || typeof token !== 'string') {
    return { valid: false, reason: 'missing_token' };
  }
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { valid: false, reason: 'empty_token' };
  }

  const dotIndex = cleanToken.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex >= cleanToken.length - 1) {
    return { valid: false, reason: 'malformed_token' };
  }

  const encodedPayload = cleanToken.slice(0, dotIndex);
  const encodedSig = cleanToken.slice(dotIndex + 1);

  // A. Signature segment must have valid Base64URL syntax
  if (!/^[A-Za-z0-9_-]+$/.test(encodedSig)) {
    return { valid: false, reason: 'invalid_signature_syntax' };
  }

  // B. Decode signature
  const sigBytes = base64UrlDecode(encodedSig);
  if (!sigBytes) {
    return { valid: false, reason: 'invalid_signature_encoding' };
  }

  // C. Decoded signature must be exactly 32 bytes (HMAC-SHA256)
  if (sigBytes.length !== 32) {
    return { valid: false, reason: 'invalid_signature_length' };
  }

  // D & E. Canonical Base64URL re-encoding verification
  const canonicalSig = base64UrlEncode(sigBytes);
  if (canonicalSig !== encodedSig) {
    return { valid: false, reason: 'non_canonical_signature_encoding' };
  }

  // Canonical Base64URL validation for payload segment
  if (!/^[A-Za-z0-9_-]+$/.test(encodedPayload)) {
    return { valid: false, reason: 'invalid_payload_syntax' };
  }
  const payloadBytes = base64UrlDecode(encodedPayload);
  if (!payloadBytes) {
    return { valid: false, reason: 'invalid_payload_encoding' };
  }
  const canonicalPayload = base64UrlEncode(payloadBytes);
  if (canonicalPayload !== encodedPayload) {
    return { valid: false, reason: 'non_canonical_payload_encoding' };
  }

  const primarySecret = getAdminSessionSecret(env);
  const previousSecretsStr = env?.RANCANGLOKA_ADMIN_PREVIOUS_SECRETS ||
                            (globalThis as any).process?.env?.RANCANGLOKA_ADMIN_PREVIOUS_SECRETS ||
                            '';
  const candidateSecrets = [primarySecret].filter(s => typeof s === 'string' && s.length > 0);
  if (previousSecretsStr) {
    const prevList = previousSecretsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
    candidateSecrets.push(...prevList);
  }

  if (candidateSecrets.length === 0) {
    return { valid: false, reason: 'secret_not_configured' };
  }

  const encoder = new TextEncoder();
  const payloadBytesToVerify = encoder.encode(encodedPayload);

  let isSigValid = false;
  for (const secret of candidateSecrets) {
    try {
      const key = await getHmacKey(secret);
      const verified = await crypto.subtle.verify('HMAC', key, sigBytes as BufferSource, payloadBytesToVerify);
      if (verified) {
        isSigValid = true;
        break;
      }
    } catch {
      // Continue to next candidate secret
    }
  }

  if (!isSigValid) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  let payload: AdminSessionPayload;
  try {
    const jsonStr = new TextDecoder().decode(payloadBytes);
    payload = JSON.parse(jsonStr);
  } catch {
    return { valid: false, reason: 'invalid_payload_json' };
  }

  if (!payload || typeof payload !== 'object' || payload.v !== 1 || !payload.sid || typeof payload.exp !== 'number') {
    return { valid: false, reason: 'invalid_payload_structure' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSec) {
    return { valid: false, payload, reason: 'session_expired' };
  }

  // Allow up to 60s future clock skew
  if (typeof payload.iat === 'number' && payload.iat > nowSec + 60) {
    return { valid: false, payload, reason: 'future_issued_at' };
  }

  return { valid: true, payload };
}

/**
 * Checks if the provided cookie object or string represents an authentic, non-expired admin session.
 */
export async function isValidAdminSession(cookieOrValue: any, env?: any): Promise<boolean> {
  if (!cookieOrValue) return false;
  let val: any = cookieOrValue;
  if (typeof cookieOrValue === 'object' && cookieOrValue !== null) {
    if ('value' in cookieOrValue) {
      val = cookieOrValue.value;
    } else {
      return false;
    }
  }
  if (!val || typeof val !== 'string') return false;
  if (!val.trim()) return false;
  const result = await verifyAdminSession(val, env);
  return result.valid;
}

/**
 * Extracts the admin session token from Cookie header or Authorization: Bearer header.
 */
export function getAdminSessionFromRequest(request: Request): string | null {
  // 1. Check Cookie header
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  // 2. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Normalizes and validates the redirect destination to strictly prevent Open Redirect attacks.
 */
export function getSafeAdminRedirect(rawRedirect: string | null | undefined): string {
  if (!rawRedirect || typeof rawRedirect !== 'string') return '/admin';
  const trimmed = rawRedirect.trim();

  // Block CRLF and control characters
  if (/[\r\n\x00-\x1f\x7f]/.test(trimmed)) {
    return '/admin';
  }

  // Must start with '/admin' and never '//' or '\'
  if (!trimmed.startsWith('/admin') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/admin';
  }
  // Must not contain scheme or colon before slash (e.g. javascript:, http:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+-.]*:/.test(trimmed)) {
    return '/admin';
  }
  // Check for decoded dangerous characters
  try {
    const decoded = decodeURIComponent(trimmed);
    if (/[\r\n\x00-\x1f\x7f]/.test(decoded) || decoded.startsWith('//') || decoded.includes('\\') || /^[a-zA-Z][a-zA-Z0-9+-.]*:/.test(decoded)) {
      return '/admin';
    }
  } catch {
    return '/admin';
  }
  return trimmed;
}

/**
 * Validates that mutating requests originate from the same application origin (CSRF defense).
 */
export function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const requestUrl = new URL(request.url);
      return origin === requestUrl.origin;
    } catch {
      return false;
    }
  }

  // Fallback to Referer header if present
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const requestUrl = new URL(request.url);
      return refererUrl.origin === requestUrl.origin;
    } catch {
      return false;
    }
  }

  // Check Sec-Fetch-Site if provided by browser
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    return false;
  }

  // Non-browser client / CLI / internal script without Origin/Referer
  return true;
}

/**
 * Cookie options for setting the authenticated admin session.
 */
export function getAdminCookieOptions(isProduction: boolean = false) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: isProduction,
    maxAge: ADMIN_SESSION_TTL_SECONDS
  };
}

/**
 * Cookie options for clearing the admin session upon logout.
 */
export function getAdminLogoutCookieOptions(isProduction: boolean = false) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: isProduction,
    maxAge: 0,
    expires: new Date(0)
  };
}

/**
 * Password hashing utilities using PBKDF2 with SHA-256 for Cloudflare Workers.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const hashHex = Array.from(new Uint8Array(exportedKey)).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [saltHex, originalHashHex] = parts;
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const exportedKey = await crypto.subtle.exportKey('raw', key);
    const hashHex = Array.from(new Uint8Array(exportedKey)).map(b => b.toString(16).padStart(2, '0')).join('');

    return timingSafeEqual(hashHex, originalHashHex);
  } catch (err) {
    return false;
  }
}
