/**
 * RancangLoka — Internal Media Worker Control Endpoint (MEDIA-A5.7)
 * POST /api/internal/v1/media/worker/control
 *
 * Provides authenticated, canonical control over the D1 media_worker_enabled setting.
 *
 * Security Invariants:
 * - Authenticated via device / internal token (fail-closed)
 * - POST method only (405 for other methods)
 * - Cache-Control: no-store, private & X-Robots-Tag
 * - Strict boolean validation on body.enabled
 * - Modifies ONLY settings.media_worker_enabled (preserves dual-gate invariant)
 * - Cannot touch publication controls, kill switch, or Cloudflare env bindings
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import { setMediaWorkerEnabled } from '../../../../../../lib/media/worker-runner.ts';

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

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  if (!db) {
    return jsonResponse(500, {
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database connection unavailable.'
    });
  }

  // 1. Authenticate Request
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return jsonResponse(auth.statusCode || 401, {
      status: 'error',
      code: 'AUTHENTICATION_REQUIRED',
      message: auth.error || 'Authentication required for media worker control.'
    });
  }

  // 2. Parse & Validate Body
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

  if (typeof body?.enabled !== 'boolean') {
    return jsonResponse(400, {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Field "enabled" must be an explicit boolean (true or false).'
    });
  }

  try {
    // 3. Execute Canonical Mutation
    const result = await setMediaWorkerEnabled(db, body.enabled, {
      actorId: auth.deviceId || 'api_operator',
      reason: body.reason || 'Operator control mutation',
      source: 'internal_control_api'
    });

    return jsonResponse(200, {
      status: 'success',
      enabled: result.enabled,
      previous_enabled: result.previousEnabled,
      changed: result.changed,
      message: result.message
    });
  } catch (err: any) {
    return jsonResponse(500, {
      status: 'error',
      code: 'CONTROL_MUTATION_FAILED',
      message: err.message || 'Failed to update media worker control.'
    });
  }
};

export const ALL: APIRoute = async () => {
  return new Response(
    JSON.stringify({ status: 'error', code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are permitted.' }),
    {
      status: 405,
      headers: {
        'Allow': 'POST',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    }
  );
};
