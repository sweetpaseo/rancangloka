import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../../lib/media/device-auth.ts';
import { reconcileMediaJob, validateProtocolVersion } from '../../../../../../../lib/media/jobs-service.ts';

function json(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }
  });
}

export const GET: APIRoute = async ({ request, params, locals, url }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
  if (!db) return json(500, { status: 'error', code: 'DATABASE_UNAVAILABLE' });
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) return json(auth.statusCode || 401, { status: 'error', code: 'AUTH_REQUIRED', message: auth.error });

  try {
    validateProtocolVersion(url.searchParams.get('protocol_version') || request.headers.get('x-lokamedia-protocol-version'));
    const reconciliation = await reconcileMediaJob(db, params.job_id!, auth.deviceId || 'media_device');
    return json(200, { status: 'success', reconciliation });
  } catch (err: any) {
    const code = err.message || 'RECONCILE_FAILED';
    return json(code === 'JOB_NOT_FOUND' ? 404 : code === 'PROTOCOL_VERSION_UNSUPPORTED' ? 426 : 400, { status: 'error', code });
  }
};
