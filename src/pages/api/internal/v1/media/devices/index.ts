/**
 * RancangLoka — Media Device Provisioning & Management API (MEDIA-A5.7-P2A)
 * GET  /api/internal/v1/media/devices -> List registered media devices (safe metadata only)
 * POST /api/internal/v1/media/devices -> Register a new media device (returns plaintext token once)
 *
 * Security Invariants:
 * - Operator authentication strictly required (HMAC-SHA256 admin session)
 * - Media device firewall: credentials starting with 'lkmd_' or carrying media scopes are strictly forbidden (403)
 * - Zero self-provisioning trust loop (media devices cannot create media devices)
 * - Plaintext token returned exactly once in 201 response, never persisted (hash-only)
 * - Plaintext token never logged
 * - Cache-Control: no-store, private & X-Robots-Tag
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import {
  isValidAdminSession,
  getAdminSessionFromRequest
} from '../../../../../../lib/auth.ts';
import {
  registerMediaDevice,
  listMediaDevices
} from '../../../../../../lib/media/device-auth.ts';

function jsonResponse(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    }
  });
}

function checkMediaDeviceForbidden(request: Request): boolean {
  const authHeader = request.headers.get('authorization') || '';
  const deviceHeader = request.headers.get('x-rl-device-token') || '';
  const mediaKey = request.headers.get('x-rl-media-key') || '';
  const declaredScope = request.headers.get('x-rl-scope') || '';

  return (
    authHeader.toLowerCase().includes('lkmd_') ||
    authHeader.toLowerCase().includes('media:device') ||
    Boolean(deviceHeader) ||
    Boolean(mediaKey) ||
    declaredScope.includes('media:')
  );
}

async function verifyOperatorAuthority(request: Request, env: any): Promise<boolean> {
  const sessionToken = getAdminSessionFromRequest(request);
  if (!sessionToken) return false;
  return await isValidAdminSession(sessionToken, env);
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  // 1. Media device firewall: prevent self-provisioning loop
  if (checkMediaDeviceForbidden(request)) {
    return jsonResponse(403, {
      status: 'error',
      code: 'MEDIA_DEVICE_FORBIDDEN',
      message: 'Media device credentials cannot access device management APIs.'
    });
  }

  // 2. Operator authentication check
  const isOperator = await verifyOperatorAuthority(request, env);
  if (!isOperator) {
    return jsonResponse(401, {
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Operator admin session required.'
    });
  }

  if (!db) {
    return jsonResponse(500, {
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database connection unavailable.'
    });
  }

  try {
    const devices = await listMediaDevices(db);
    return jsonResponse(200, {
      status: 'success',
      devices
    });
  } catch (err: any) {
    return jsonResponse(500, {
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: err.message || 'Failed to list media devices.'
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  // 1. Media device firewall: prevent self-provisioning loop
  if (checkMediaDeviceForbidden(request)) {
    return jsonResponse(403, {
      status: 'error',
      code: 'MEDIA_DEVICE_FORBIDDEN',
      message: 'Media device credentials cannot access device management APIs.'
    });
  }

  // 2. Operator authentication check
  const isOperator = await verifyOperatorAuthority(request, env);
  if (!isOperator) {
    return jsonResponse(401, {
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Operator admin session required.'
    });
  }

  if (!db) {
    return jsonResponse(500, {
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database connection unavailable.'
    });
  }

  // 3. Parse JSON body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, {
      status: 'error',
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON.'
    });
  }

  const { device_id, device_name, scope } = body || {};

  if (!device_id || !device_name) {
    return jsonResponse(400, {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'device_id and device_name are required.'
    });
  }

  try {
    const result = await registerMediaDevice(db, {
      deviceId: device_id,
      deviceName: device_name,
      scope: scope || 'media:device',
      actorId: 'operator'
    });

    if (!result.success) {
      if (result.conflict) {
        return jsonResponse(409, {
          status: 'error',
          code: 'DEVICE_ALREADY_EXISTS',
          message: result.error || 'Device already exists.'
        });
      }

      return jsonResponse(400, {
        status: 'error',
        code: 'REGISTRATION_FAILED',
        message: result.error || 'Device registration failed.'
      });
    }

    return jsonResponse(201, {
      status: 'success',
      device: {
        device_id: result.deviceId,
        device_name: result.deviceName,
        scope: result.scope,
        status: result.status,
        created_at: result.createdAt,
        token: result.rawToken // Returned ONCE to the caller
      }
    });
  } catch (err: any) {
    return jsonResponse(500, {
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: err.message || 'Unexpected error during device registration.'
    });
  }
};

export const ALL: APIRoute = async () => {
  return jsonResponse(405, {
    status: 'error',
    code: 'METHOD_NOT_ALLOWED',
    message: 'Only GET and POST requests are permitted.'
  });
};
