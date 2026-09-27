/**
 * RancangLoka — Media Device Instance Management API (MEDIA-A5.7-P2A)
 * GET    /api/internal/v1/media/devices/[device_id] -> Get device metadata (safe metadata only)
 * DELETE /api/internal/v1/media/devices/[device_id] -> Revoke device (idempotent)
 * POST   /api/internal/v1/media/devices/[device_id] -> Revoke device (POST alternative for environments without DELETE)
 *
 * Security Invariants:
 * - Operator authentication strictly required (HMAC-SHA256 admin session)
 * - Media device firewall: credentials starting with 'lkmd_' or carrying media scopes strictly forbidden (403)
 * - Zero self-provisioning or self-revocation trust loop by device credentials
 * - Idempotent revocation (safe to call multiple times)
 * - Cache-Control: no-store, private & X-Robots-Tag
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import {
  isValidAdminSession,
  getAdminSessionFromRequest
} from '../../../../../../lib/auth.ts';
import {
  getMediaDevice,
  revokeMediaDevice
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

export const GET: APIRoute = async ({ params, request, locals }) => {
  const deviceId = params.device_id;
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  if (checkMediaDeviceForbidden(request)) {
    return jsonResponse(403, {
      status: 'error',
      code: 'MEDIA_DEVICE_FORBIDDEN',
      message: 'Media device credentials cannot access device management APIs.'
    });
  }

  const isOperator = await verifyOperatorAuthority(request, env);
  if (!isOperator) {
    return jsonResponse(401, {
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Operator admin session required.'
    });
  }

  if (!deviceId) {
    return jsonResponse(400, {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'device_id parameter is required.'
    });
  }

  if (!db) {
    return jsonResponse(500, {
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database connection unavailable.'
    });
  }

  const device = await getMediaDevice(db, deviceId);
  if (!device) {
    return jsonResponse(404, {
      status: 'error',
      code: 'DEVICE_NOT_FOUND',
      message: `Device '${deviceId}' not found.`
    });
  }

  return jsonResponse(200, {
    status: 'success',
    device: {
      device_id: device.deviceId,
      device_name: device.deviceName,
      scope: device.scope,
      status: device.status,
      last_used_at: device.lastUsedAt,
      created_at: device.createdAt
    }
  });
};

async function handleRevocation(deviceId: string | undefined, request: Request, locals: any): Promise<Response> {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  if (checkMediaDeviceForbidden(request)) {
    return jsonResponse(403, {
      status: 'error',
      code: 'MEDIA_DEVICE_FORBIDDEN',
      message: 'Media device credentials cannot access device management APIs.'
    });
  }

  const isOperator = await verifyOperatorAuthority(request, env);
  if (!isOperator) {
    return jsonResponse(401, {
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Operator admin session required.'
    });
  }

  if (!deviceId) {
    return jsonResponse(400, {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'device_id parameter is required.'
    });
  }

  if (!db) {
    return jsonResponse(500, {
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database connection unavailable.'
    });
  }

  let reason = 'Operator revocation';
  try {
    const body = await request.json();
    if (body?.reason) reason = String(body.reason);
  } catch (_) {}

  const result = await revokeMediaDevice(db, {
    deviceId,
    actorId: 'operator',
    reason
  });

  if (!result.success && result.status === 'NOT_FOUND') {
    return jsonResponse(404, {
      status: 'error',
      code: 'DEVICE_NOT_FOUND',
      message: `Device '${deviceId}' not found.`
    });
  }

  return jsonResponse(200, {
    status: 'success',
    device_id: result.deviceId,
    revoked: result.revoked,
    status_code: result.status,
    message: result.revoked
      ? `Device '${deviceId}' successfully revoked.`
      : `Device '${deviceId}' was already revoked.`
  });
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  return handleRevocation(params.device_id, request, locals);
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  return handleRevocation(params.device_id, request, locals);
};

export const ALL: APIRoute = async () => {
  return jsonResponse(405, {
    status: 'error',
    code: 'METHOD_NOT_ALLOWED',
    message: 'Only GET, POST, and DELETE requests are permitted.'
  });
};
