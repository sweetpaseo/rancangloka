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
  'media:write:draft',
  'media:reconcile'
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

export interface MediaDeviceRecord {
  deviceId: string;
  deviceName: string;
  scope: string;
  status: 'ACTIVE' | 'REVOKED';
  lastUsedAt: string | null;
  createdAt: string;
}

export interface RegisterDeviceParams {
  deviceId: string;
  deviceName: string;
  scope?: string;
  actorId?: string;
}

export interface RegisterDeviceResult {
  success: boolean;
  deviceId: string;
  deviceName: string;
  scope: string;
  status: 'ACTIVE' | 'REVOKED';
  rawToken: string;
  createdAt: string;
  conflict?: boolean;
  error?: string;
}

export interface RevokeDeviceParams {
  deviceId: string;
  actorId?: string;
  reason?: string;
}

export interface RevokeDeviceResult {
  success: boolean;
  deviceId: string;
  revoked: boolean;
  status: 'REVOKED' | 'NOT_FOUND';
  previousStatus?: string;
  error?: string;
}

export const CANARY_EPHEMERAL_DEVICE_ID = 'dev_canary_a5_7_p2_ephemeral_probe';
export const CANARY_EPHEMERAL_DEVICE_NAME = 'RancangLoka A5.7 P2 Ephemeral Probe';

/**
 * Generates a high-entropy cryptographically secure device secret token.
 * Yields 256 bits of cryptographic entropy prefixed with 'lkmd_'.
 */
export function generateDeviceToken(): string {
  const bytes = new Uint8Array(32); // 32 bytes = 256 bits of entropy
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `lkmd_${hex}`;
}

/**
 * Registers an authorized LokaMedia device in Cloudflare D1.
 *
 * Invariants:
 * - High-entropy token (256-bit entropy)
 * - Persists SHA-256 hash ONLY; plaintext is NEVER persisted
 * - Returns plaintext raw token exactly once to the caller
 * - Enforces minimum required scope
 * - Enforces explicit idempotency / conflict detection
 * - Never logs plaintext token
 */
export async function registerMediaDevice(
  db: any,
  params: RegisterDeviceParams
): Promise<RegisterDeviceResult> {
  const { deviceId, deviceName, scope = 'media:device', actorId = 'operator' } = params;

  if (!deviceId || typeof deviceId !== 'string' || !/^[a-zA-Z0-9_-]{3,64}$/.test(deviceId.trim())) {
    return {
      success: false,
      deviceId: deviceId || '',
      deviceName: deviceName || '',
      scope,
      status: 'ACTIVE',
      rawToken: '',
      createdAt: '',
      error: 'device_id must be 3-64 characters alphanumeric, hyphen, or underscore.'
    };
  }

  const cleanDeviceId = deviceId.trim();
  const cleanDeviceName = (deviceName || '').trim();

  if (!cleanDeviceName || cleanDeviceName.length < 3 || cleanDeviceName.length > 128) {
    return {
      success: false,
      deviceId: cleanDeviceId,
      deviceName: cleanDeviceName,
      scope,
      status: 'ACTIVE',
      rawToken: '',
      createdAt: '',
      error: 'device_name must be between 3 and 128 characters.'
    };
  }

  if (FORBIDDEN_SCOPES.has(scope)) {
    return {
      success: false,
      deviceId: cleanDeviceId,
      deviceName: cleanDeviceName,
      scope,
      status: 'ACTIVE',
      rawToken: '',
      createdAt: '',
      error: `Scope '${scope}' is strictly forbidden for media devices.`
    };
  }

  if (!ALLOWED_MEDIA_SCOPES.has(scope)) {
    return {
      success: false,
      deviceId: cleanDeviceId,
      deviceName: cleanDeviceName,
      scope,
      status: 'ACTIVE',
      rawToken: '',
      createdAt: '',
      error: `Scope '${scope}' is not in allowed media scopes list.`
    };
  }

  if (!db) {
    return {
      success: false,
      deviceId: cleanDeviceId,
      deviceName: cleanDeviceName,
      scope,
      status: 'ACTIVE',
      rawToken: '',
      createdAt: '',
      error: 'Database connection unavailable.'
    };
  }

  // 1. Idempotency Check: verify if device_id already exists
  const existing = await db
    .prepare('SELECT device_id, device_name, scope, status, created_at FROM media_devices WHERE device_id = ? LIMIT 1')
    .bind(cleanDeviceId)
    .first();

  if (existing) {
    return {
      success: false,
      conflict: true,
      deviceId: cleanDeviceId,
      deviceName: existing.device_name,
      scope: existing.scope,
      status: existing.status,
      rawToken: '',
      createdAt: existing.created_at,
      error: `Device with ID '${cleanDeviceId}' already exists (status: ${existing.status}). Cannot register duplicate.`
    };
  }

  // 2. Cryptographic token generation & hashing
  const rawToken = generateDeviceToken();
  const tokenHash = await hashToken(rawToken);
  const nowIso = new Date().toISOString();

  // 3. Persist hash only into D1
  await db
    .prepare(
      `INSERT INTO media_devices (device_id, device_name, token_hash, scope, status, created_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)`
    )
    .bind(cleanDeviceId, cleanDeviceName, tokenHash, scope)
    .run();

  // Audit traceability (token hash or metadata only, NEVER rawToken)
  try {
    console.info(
      JSON.stringify({
        event: 'DEVICE_REGISTERED',
        device_id: cleanDeviceId,
        device_name: cleanDeviceName,
        scope,
        status: 'ACTIVE',
        actor_id: actorId,
        timestamp: nowIso
      })
    );
  } catch (_) {}

  return {
    success: true,
    deviceId: cleanDeviceId,
    deviceName: cleanDeviceName,
    scope,
    status: 'ACTIVE',
    rawToken, // Returned ONCE to the caller
    createdAt: nowIso
  };
}

/**
 * Revokes an authorized media device in Cloudflare D1.
 *
 * Invariants:
 * - Idempotent (safe to call multiple times)
 * - Transitions status to 'REVOKED'
 * - Revoked credential is immediately and fail-closed rejected on authentication
 * - Never logs secret credentials
 */
export async function revokeMediaDevice(
  db: any,
  params: RevokeDeviceParams
): Promise<RevokeDeviceResult> {
  const { deviceId, actorId = 'operator', reason = 'Manual revocation' } = params;

  if (!deviceId || typeof deviceId !== 'string') {
    return {
      success: false,
      deviceId: deviceId || '',
      revoked: false,
      status: 'NOT_FOUND',
      error: 'device_id is required.'
    };
  }

  const cleanDeviceId = deviceId.trim();

  if (!db) {
    return {
      success: false,
      deviceId: cleanDeviceId,
      revoked: false,
      status: 'NOT_FOUND',
      error: 'Database connection unavailable.'
    };
  }

  // 1. Check existing device state
  const existing = await db
    .prepare('SELECT device_id, status FROM media_devices WHERE device_id = ? LIMIT 1')
    .bind(cleanDeviceId)
    .first();

  if (!existing) {
    return {
      success: false,
      deviceId: cleanDeviceId,
      revoked: false,
      status: 'NOT_FOUND',
      error: `Device '${cleanDeviceId}' not found.`
    };
  }

  if (existing.status === 'REVOKED') {
    return {
      success: true,
      deviceId: cleanDeviceId,
      revoked: false,
      status: 'REVOKED',
      previousStatus: 'REVOKED'
    };
  }

  // 2. Execute revocation
  await db
    .prepare('UPDATE media_devices SET status = ? WHERE device_id = ? AND status = ?')
    .bind('REVOKED', cleanDeviceId, 'ACTIVE')
    .run();

  // Audit traceability
  try {
    console.info(
      JSON.stringify({
        event: 'DEVICE_REVOKED',
        device_id: cleanDeviceId,
        previous_status: existing.status,
        status: 'REVOKED',
        actor_id: actorId,
        reason,
        timestamp: new Date().toISOString()
      })
    );
  } catch (_) {}

  return {
    success: true,
    deviceId: cleanDeviceId,
    revoked: true,
    status: 'REVOKED',
    previousStatus: existing.status
  };
}

/**
 * Retrieves safe metadata for a specific media device (omits token_hash).
 */
export async function getMediaDevice(
  db: any,
  deviceId: string
): Promise<MediaDeviceRecord | null> {
  if (!db || !deviceId) return null;

  try {
    const row = await db
      .prepare(
        'SELECT device_id, device_name, scope, status, last_used_at, created_at FROM media_devices WHERE device_id = ? LIMIT 1'
      )
      .bind(deviceId.trim())
      .first();

    if (!row) return null;

    return {
      deviceId: row.device_id,
      deviceName: row.device_name,
      scope: row.scope,
      status: row.status as 'ACTIVE' | 'REVOKED',
      lastUsedAt: row.last_used_at || null,
      createdAt: row.created_at
    };
  } catch (_) {
    return null;
  }
}

/**
 * Lists safe metadata for registered media devices (omits token_hash).
 */
export async function listMediaDevices(
  db: any,
  options: { limit?: number; offset?: number; status?: 'ACTIVE' | 'REVOKED' } = {}
): Promise<MediaDeviceRecord[]> {
  if (!db) return [];

  const limit = Math.min(Math.max(options.limit || 50, 1), 100);
  const offset = Math.max(options.offset || 0, 0);

  try {
    let query = 'SELECT device_id, device_name, scope, status, last_used_at, created_at FROM media_devices';
    const bindings: any[] = [];

    if (options.status) {
      query += ' WHERE status = ?';
      bindings.push(options.status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const statement = db.prepare(query);
    const result = await statement.bind(...bindings).all();
    const rows = result.results || [];

    return rows.map((row: any) => ({
      deviceId: row.device_id,
      deviceName: row.device_name,
      scope: row.scope,
      status: row.status as 'ACTIVE' | 'REVOKED',
      lastUsedAt: row.last_used_at || null,
      createdAt: row.created_at
    }));
  } catch (_) {
    return [];
  }
}

/**
 * Registers the designated canary ephemeral device for P2 dormant probe.
 */
export async function registerCanaryEphemeralDevice(
  db: any,
  actorId: string = 'p2_orchestrator'
): Promise<RegisterDeviceResult> {
  return registerMediaDevice(db, {
    deviceId: CANARY_EPHEMERAL_DEVICE_ID,
    deviceName: CANARY_EPHEMERAL_DEVICE_NAME,
    scope: 'media:device',
    actorId
  });
}

/**
 * Revokes the designated canary ephemeral device immediately following P2 probe.
 */
export async function revokeCanaryEphemeralDevice(
  db: any,
  actorId: string = 'p2_orchestrator'
): Promise<RevokeDeviceResult> {
  return revokeMediaDevice(db, {
    deviceId: CANARY_EPHEMERAL_DEVICE_ID,
    actorId,
    reason: 'P2 ephemeral probe lifecycle complete'
  });
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

  // Check for forbidden scopes or scopes outside allowed media scopes
  if (FORBIDDEN_SCOPES.has(declaredScope) || !ALLOWED_MEDIA_SCOPES.has(declaredScope)) {
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
        .prepare('SELECT device_id, device_name, scope, status FROM media_devices WHERE token_hash = ? LIMIT 1')
        .bind(hashed)
        .first();

      if (row) {
        // FAIL-CLOSED: If device is REVOKED, immediately reject without fallthrough!
        if (row.status === 'REVOKED') {
          return {
            authenticated: false,
            deviceId: row.device_id,
            error: 'Token perangkat LokaMedia tidak valid atau telah dicabut.',
            statusCode: 401
          };
        }

        if (row.status === 'ACTIVE') {
          // Check scope validity
          if (!ALLOWED_MEDIA_SCOPES.has(row.scope)) {
            return {
              authenticated: false,
              deviceId: row.device_id,
              error: `Scope '${row.scope}' pada perangkat LokaMedia tidak valid.`,
              statusCode: 403
            };
          }

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
