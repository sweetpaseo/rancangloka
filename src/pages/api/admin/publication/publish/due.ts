import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import { getDueExecutions, runPublisherDispatcher } from '../../../../../lib/publication/publisher-service.ts';

/**
 * Scheduled Publisher Due Dispatch API Endpoint (PUBLICATION-2)
 *
 * GET: Lists executions that are currently due for publication.
 * POST: Wakes the dispatcher to execute due publication tasks.
 *
 * Dumb Trigger Separation:
 * - This endpoint can be invoked by Cloudflare Cron or manual admin smoke tests.
 * - Zero publication business logic resides here; it strictly invokes the publisher engine.
 * - Respects AUTO_PUBLISH setting.
 */
export const GET: APIRoute = async ({ url, locals, request }) => {
  try {
    // Firewall: Media devices strictly forbidden
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.toLowerCase().includes('lkmd_') || authHeader.toLowerCase().includes('media:device')) {
      return new Response(
        JSON.stringify({ status: 'error', code: 'MEDIA_DEVICE_FORBIDDEN', message: 'Media devices cannot access due dispatcher' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;
    const nowUtc = url.searchParams.get('now') || undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    const due = await getDueExecutions(db, { nowUtc, limit });

    return new Response(
      JSON.stringify({
        status: 'success',
        total: due.length,
        due
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: err.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Firewall: Media devices strictly forbidden
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.toLowerCase().includes('lkmd_') || authHeader.toLowerCase().includes('media:device')) {
      return new Response(
        JSON.stringify({ status: 'error', code: 'MEDIA_DEVICE_FORBIDDEN', message: 'Media devices cannot trigger due dispatcher' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // empty body allowed
    }

    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;
    const triggerSource = body.triggerSource || ((locals as any)?.authActor === 'cron_service' ? 'cron' : 'api');
    const workerId = body.workerId || undefined;
    const nowUtc = body.nowUtc || undefined;
    const limit = body.limit || 10;


    const result = await runPublisherDispatcher(db, {
      triggerSource,
      workerId,
      nowUtc,
      limit
    });

    return new Response(
      JSON.stringify({
        status: 'success',
        result
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: err.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
