import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import {
  reconcileAutoPolicyPlansForExecution,
  RECONCILER_DEFAULT_BATCH_LIMIT
} from '../../../../../lib/publication/auto-policy-reconciler.ts';
import { PLAN_STATUS_PLANNED } from '../../../../../lib/publication/planner-types.ts';

/**
 * Scheduled Publisher Auto-Policy Plan Execution Reconciler API (PUBLICATION-2 / Phase 5L6A)
 *
 * GET: Lists eligible auto_policy publication plans waiting for execution promotion (inspection).
 * POST: Triggers canonical server-side reconciliation of eligible auto_policy plans into SCHEDULED executions.
 *
 * Dumb Trigger Separation:
 * - Can be triggered by Cloudflare Cron or admin supervisor.
 * - Zero publication logic resides here; strictly invokes the reconciler engine.
 * - Media-device tokens (Bearer lkmd_...) are strictly blocked.
 * - Anonymous access is blocked by admin middleware.
 * - NEVER publishes.
 */

export const GET: APIRoute = async ({ url, locals, request }) => {
  try {
    // Firewall: Media devices strictly forbidden
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.toLowerCase().includes('lkmd_') || authHeader.toLowerCase().includes('media:device')) {
      return new Response(
        JSON.stringify({ status: 'error', code: 'MEDIA_DEVICE_FORBIDDEN', message: 'Media devices cannot access reconciler' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : RECONCILER_DEFAULT_BATCH_LIMIT;

    const query = `
      SELECT 
        p.id,
        p.plan_id,
        p.article_id,
        p.content_hash,
        p.featured_asset_id,
        p.target_publish_at,
        p.plan_status,
        p.scheduling_mode,
        a.status as article_status,
        COALESCE(a.manual_hold, 0) as manual_hold
      FROM article_publication_plans p
      JOIN articles a ON p.article_id = a.id
      WHERE p.plan_status = '${PLAN_STATUS_PLANNED}'
        AND p.scheduling_mode = 'auto_policy'
      ORDER BY p.target_publish_at ASC, p.id ASC
      LIMIT ?;
    `;

    const res = await db.prepare(query).bind(limit).all();
    const plans = res.results || res || [];

    return new Response(
      JSON.stringify({
        status: 'success',
        total: plans.length,
        limit,
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
        JSON.stringify({ status: 'error', code: 'MEDIA_DEVICE_FORBIDDEN', message: 'Media devices cannot trigger reconciler' }),
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
    const batchLimit = body.batchLimit ? Math.max(1, parseInt(body.batchLimit, 10)) : RECONCILER_DEFAULT_BATCH_LIMIT;
    const actor = body.actor || 'auto_scheduler';

    const result = await reconcileAutoPolicyPlansForExecution(db, {
      batchLimit,
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
