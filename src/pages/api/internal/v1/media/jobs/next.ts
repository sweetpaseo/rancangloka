import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import {
  acquireMediaJobLease,
  LOKAMEDIA_PROTOCOL_VERSION,
  publicLeasePayload,
  validateProtocolVersion
} from '../../../../../../lib/media/jobs-service.ts';

function json(status: number, body: Record<string, any>): Response {
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
  if (!db) return json(500, { status: 'error', code: 'DATABASE_UNAVAILABLE' });

  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) return json(auth.statusCode || 401, { status: 'error', code: 'AUTH_REQUIRED', message: auth.error });

  try {
    const body = await request.json().catch(() => ({}));
    validateProtocolVersion(body.protocol_version);
    const lease = await acquireMediaJobLease(db, auth.deviceId || 'media_device');
    if (!lease.acquired || !lease.job) {
      return json(200, {
        status: 'no_work',
        code: lease.code || 'NO_ELIGIBLE_JOB',
        protocol_version: LOKAMEDIA_PROTOCOL_VERSION,
        retry_after_ms: lease.retry_after_ms
      });
    }
    return json(200, { status: 'success', job: publicLeasePayload(lease.job) });
  } catch (err: any) {
    const code = err.message || 'NEXT_JOB_FAILED';
    return json(code === 'PROTOCOL_VERSION_UNSUPPORTED' ? 426 : 400, { status: 'error', code });
  }
};
