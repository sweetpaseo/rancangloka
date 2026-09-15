import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../../lib/media/device-auth.ts';
import { releaseMediaJobLease, validateProtocolVersion } from '../../../../../../../lib/media/jobs-service.ts';

function json(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }
  });
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
    const job = await releaseMediaJobLease(
      db,
      params.job_id!,
      auth.deviceId || 'media_device',
      Number(body.expected_job_revision),
      body.intent,
      body.reason_code || 'CLIENT_RELEASE',
      body.message_safe
    );
    return json(200, { status: 'success', job });
  } catch (err: any) {
    const code = err.message || 'RELEASE_FAILED';
    return json(code === 'LEASE_NOT_OWNER' ? 403 : code === 'JOB_REVISION_CONFLICT' ? 409 : code === 'PROTOCOL_VERSION_UNSUPPORTED' ? 426 : 400, { status: 'error', code });
  }
};
