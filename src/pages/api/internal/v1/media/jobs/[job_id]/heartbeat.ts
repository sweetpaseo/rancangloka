import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../../lib/media/device-auth.ts';
import { heartbeatMediaJobLease, validateProtocolVersion } from '../../../../../../../lib/media/jobs-service.ts';

function json(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }
  });
}

function statusFor(code: string): number {
  if (code === 'LEASE_NOT_OWNER') return 403;
  if (code === 'LEASE_EXPIRED' || code === 'JOB_REVISION_CONFLICT') return 409;
  if (code === 'JOB_NOT_FOUND') return 404;
  if (code === 'PROTOCOL_VERSION_UNSUPPORTED') return 426;
  return 400;
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
  if (!db) return json(500, { status: 'error', code: 'DATABASE_UNAVAILABLE' });
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) return json(auth.statusCode || 401, { status: 'error', code: 'AUTH_REQUIRED', message: auth.error });

  try {
    const body = await request.json();
    validateProtocolVersion(body.protocol_version);
    const job = await heartbeatMediaJobLease(db, params.job_id!, auth.deviceId || 'media_device', Number(body.expected_job_revision));
    return json(200, {
      status: 'success',
      protocol_version: body.protocol_version,
      job_id: job.job_id,
      job_revision: job.job_revision,
      lease_expires_at: job.lease_expires_at,
      heartbeat_at: job.heartbeat_at
    });
  } catch (err: any) {
    const code = err.message || 'HEARTBEAT_FAILED';
    return json(statusFor(code), { status: 'error', code });
  }
};
