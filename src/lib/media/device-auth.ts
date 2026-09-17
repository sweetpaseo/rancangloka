/**
 * RancangLoka — LokaMedia Device Authentication & Authorization (MEDIA-1)
 *
 * Enforces dedicated least-privilege device credentials for LokaMedia Extension:
 * - Allowed scopes: 'media:read', 'media:upload', 'media:attach', 'media:device', 'media:write:draft'
 * - Strictly forbidden: publish, article body edit, article delete, scheduler, backup restore, Cloudflare deploy
 * - Authenticates via Authorization Bearer token, X-RL-Device-Token, or X-RL-Media-Key
 */

export const ALLOWED_MEDIA_SCOPES = new Set([
  'media:read',
  'media:upload',
  'media:attach',
  'media:device',
  'media:write:draft'
]);

export const FORBIDDEN_SCOPES = new Set([
  'publish',
  'article:publish',
  'article:edit',
  'article:delete',
  'scheduler',
  'backup:restore',
  'backup:read',
  'cloudflare:deploy',
  'admin'
]);

/**
 * Computes SHA-256 hex string using Web Crypto Subtle.
 */
export async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface AuthResult {
  authenticated: boolean;
  deviceId?: string;
  scope?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Validates request credentials against Cloudflare D1 media_devices or environment secrets.
 */
export async function authenticateDeviceRequest(
  request: Request,
  db: any,
  env: Record<string, any> = {}
): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization') || '';
  const deviceTokenHeader = request.headers.get('x-rl-device-token') || '';
  const mediaKeyHeader = request.headers.get('x-rl-media-key') || '';
  const declaredScope = request.headers.get('x-rl-scope') || 'media:device';

  // Extract raw token
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (deviceTokenHeader) {
    token = deviceTokenHeader.trim();
  } else if (mediaKeyHeader) {
    token = mediaKeyHeader.trim();
  }

  if (!token) {
    return {
      authenticated: false,
      error: 'Kredensial perangkat LokaMedia wajib disertakan.',
      statusCode: 401
    };
  }

  // Check for forbidden scopes
  if (FORBIDDEN_SCOPES.has(declaredScope)) {
    return {
      authenticated: false,
      error: `Scope '${declaredScope}' tidak diizinkan untuk kredensial perangkat LokaMedia.`,
      statusCode: 403
    };
  }

  // 1. Check against D1 media_devices table if db is available
  if (db) {
    try {
      const hashed = await hashToken(token);
      const row = await db
        .prepare('SELECT device_id, device_name, scope, status FROM media_devices WHERE token_hash = ? AND status = ? LIMIT 1')
        .bind(hashed, 'ACTIVE')
        .first();

      if (row) {
        // Update last_used_at asynchronously
        try {
          await db
            .prepare('UPDATE media_devices SET last_used_at = CURRENT_TIMESTAMP WHERE device_id = ?')
            .bind(row.device_id)
            .run();
        } catch (_) {}

        return {
          authenticated: true,
          deviceId: row.device_id,
          scope: row.scope
        };
      }
    } catch (_) {
      // Fall through to env token check
    }
  }

  // 2. Check against environment secrets (Staging / Dev / Production fallback)
  const expectedKey =
    env.LOKAMEDIA_DEVICE_TOKEN ||
    env.RANCANGLOKA_MEDIA_UPLOAD_KEY ||
    env.MEDIA_UPLOAD_KEY ||
    '';

  if (expectedKey && token === expectedKey) {
    return {
      authenticated: true,
      deviceId: 'dev_env_master',
      scope: 'media:device'
    };
  }

  // 3. Local staging / test environment bypass if no secret configured and valid scope declared
  if (!expectedKey && ALLOWED_MEDIA_SCOPES.has(declaredScope)) {
    // In local dev/staging harness without keys, allow test tokens with prefix 'test_' or 'lkmd_'
    if (token.startsWith('lkmd_') || token.startsWith('test_') || token === 'staging-media-token') {
      return {
        authenticated: true,
        deviceId: 'dev_test_harness',
        scope: declaredScope
      };
    }
  }

  return {
    authenticated: false,
    error: 'Token perangkat LokaMedia tidak valid atau telah dicabut.',
    statusCode: 401
  };
}
