import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { getActivePlans, executePublicationPlanner } from '../../../../lib/publication/planner-service.ts';
import { PLANNER_PROFILE_GROWING } from '../../../../lib/publication/planner-types.ts';

/**
 * Publication Planner API Endpoint (PUBLICATION-1)
 *
 * Strictly Planner State Domain:
 * - GET: returns current active publication plans.
 * - POST: executes publication planner and creates PLANNED records.
 * - Does NOT publish.
 * - Does NOT execute schedule.
 * - Does NOT mutate article bodies.
 */
export const GET: APIRoute = async ({ url, locals, request }) => {
  try {
    // Firewall: Media devices strictly forbidden
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.toLowerCase().includes('lkmd_') || authHeader.toLowerCase().includes('media:device')) {
      return new Response(
        JSON.stringify({ status: 'error', code: 'MEDIA_DEVICE_FORBIDDEN', message: 'Media devices cannot access planner' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;
    const dateStr = url.searchParams.get('date') || undefined;
    const plans = await getActivePlans(db, { dateStr });

    return new Response(
      JSON.stringify({
        status: 'success',
        total: plans.length,
        plans
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
        JSON.stringify({ status: 'error', code: 'MEDIA_DEVICE_FORBIDDEN', message: 'Media devices cannot trigger planner' }),
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
    const targetDate = body.targetDate || undefined;
    const profile = body.profile || PLANNER_PROFILE_GROWING;
    const dryRun = Boolean(body.dryRun);
    const actor = body.actor || (locals as any)?.authActor || 'admin_operator';


    const result = await executePublicationPlanner(db, {
      targetDate,
      profile,
      dryRun,
      actor
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
