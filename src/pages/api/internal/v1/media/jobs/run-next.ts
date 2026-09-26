/**
 * RancangLoka — Internal Media Worker Execution Trigger (MEDIA-A5.6)
 * POST /api/internal/v1/media/jobs/run-next
 *
 * Triggers exactly ONE media worker execution cycle:
 *   authenticate device -> check worker gate -> acquire lease -> processMediaJob -> response
 *
 * Security Invariants:
 * - Internal / device authenticated only (Bearer token / X-RL-Device-Token / X-RL-Media-Key)
 * - POST method only (fails with 405 for other methods)
 * - Cache-Control: no-store, private & X-Robots-Tag
 * - Zero secrets or credential material returned
 * - Single job execution per request (no daemon, no batching)
 * - Defaults safely to OFF when MEDIA_WORKER_ENABLED is not explicitly true
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import { runNextMediaJob } from '../../../../../../lib/media/worker-runner.ts';

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

  // 1. Device / Internal Authentication
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return jsonResponse(auth.statusCode || 401, {
      status: 'error',
      code: 'AUTHENTICATION_REQUIRED',
      message: auth.error || 'Authentication required for media worker execution.'
    });
  }

  try {
    // 2. Execute exactly ONE media job through canonical runner
    const result = await runNextMediaJob(db, env, {
      deviceId: auth.deviceId || 'api_media_worker'
    });

    return jsonResponse(200, {
      status: result.status,
      code: result.code,
      executed: result.executed,
      job_id: result.job_id || null,
      reason: result.reason || null
    });
  } catch (err: any) {
    return jsonResponse(500, {
      status: 'error',
      code: 'WORKER_EXECUTION_ERROR',
      message: err.message || 'Unexpected error during media worker execution.'
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
