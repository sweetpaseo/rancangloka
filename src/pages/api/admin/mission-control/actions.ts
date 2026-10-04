/**
 * RancangLoka Hermes Mission Control — Controlled Operator Intervention API
 * Milestone: MC-LIVEOPS-3
 * Route: /api/admin/mission-control/actions
 * 
 * Strict Invariants:
 * 1. Protected by admin_session authentication & same-origin CSRF checks.
 * 2. Media device credentials strictly rejected (403 FORBIDDEN_MEDIA_DEVICE).
 * 3. Human explicit confirmation required — no anonymous or autonomous execution.
 * 4. Stale-state concurrency conflict detection returns HTTP 409.
 * 5. Full audit trail generated for every executed mutation.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { isValidAdminSession, verifySameOrigin } from '../../../../lib/auth.ts';
import {
  getMissionControlSnapshot,
  previewOperatorAction,
  executeOperatorAction,
  getAllowedActionsForTarget,
  getOperatorActionById,
  getOperatorActionsHistory,
  ACTION_ALLOWLIST,
  type HumanOperatorActionRequest
} from '../../../../lib/mission-control/index.ts';

function isMediaDeviceRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization') || '';
  const deviceHeader = request.headers.get('x-lokamedia-device-id');
  const userAgent = request.headers.get('user-agent') || '';
  return Boolean(
    deviceHeader ||
    authHeader.toLowerCase().includes('lkmd_') ||
    authHeader.toLowerCase().includes('media:device') ||
    userAgent.includes('LokaMediaExtension') ||
    userAgent.includes('MediaDevice')
  );
}

export const GET: APIRoute = async ({ url, cookies, locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const sessionCookie = cookies.get('admin_session');
  const token = sessionCookie?.value;
  const isAuth = await isValidAdminSession(token, env);

  if (!isAuth) {
    return new Response(
      JSON.stringify({ status: 'error', code: 'UNAUTHORIZED', message: 'Admin authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  const actionId = url.searchParams.get('action_id');
  if (actionId) {
    const action = await getOperatorActionById(db, actionId);
    if (!action) {
      return new Response(
        JSON.stringify({ status: 'error', code: 'ACTION_NOT_FOUND', message: `Action ${actionId} not found` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ status: 'success', action }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
      }
    });
  }

  const targetType = url.searchParams.get('target_type') as any;
  const targetId = url.searchParams.get('target_id');
  if (targetType && targetId) {
    const snapshot = await getMissionControlSnapshot(db, env);
    const allowed = getAllowedActionsForTarget(targetType, targetId, snapshot);
    return new Response(JSON.stringify({ status: 'success', allowed_actions: allowed }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
      }
    });
  }

  const history = await getOperatorActionsHistory(db, 50);
  return new Response(
    JSON.stringify({
      status: 'success',
      allowlist: ACTION_ALLOWLIST,
      history
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
      }
    }
  );
};

export const POST: APIRoute = async ({ request, cookies, locals, url }) => {
  // 1. Media Device Firewall
  if (isMediaDeviceRequest(request)) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'FORBIDDEN_MEDIA_DEVICE',
        message: 'Media devices are strictly forbidden from executing operator actions.'
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Admin Authentication
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const sessionCookie = cookies.get('admin_session');
  const token = sessionCookie?.value;
  const isAuth = await isValidAdminSession(token, env);

  if (!isAuth) {
    return new Response(
      JSON.stringify({ status: 'error', code: 'UNAUTHORIZED', message: 'Admin authentication required.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Same-Origin CSRF Check
  if (!verifySameOrigin(request)) {
    return new Response(
      JSON.stringify({ status: 'error', code: 'FORBIDDEN_CSRF', message: 'Cross-origin request rejected.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ status: 'error', code: 'INVALID_JSON', message: 'Invalid JSON payload.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const actionRequest: HumanOperatorActionRequest = {
    action_id: body.action_id,
    action_type: body.action_type,
    target_type: body.target_type,
    target_id: body.target_id,
    expected_current_state: body.expected_current_state || {},
    reason: body.reason,
    payload: body.payload
  };

  if (!actionRequest.action_type || !actionRequest.target_type || !actionRequest.target_id) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Fields action_type, target_type, and target_id are required.'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const isPreview = url.searchParams.get('preview') === 'true' || Boolean(body.preview);
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const snapshot = await getMissionControlSnapshot(db, env);

    if (isPreview) {
      const preview = await previewOperatorAction(actionRequest, snapshot);
      return new Response(
        JSON.stringify({ status: 'success', preview }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private',
            'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
          }
        }
      );
    }

    const actor = (locals as any)?.authActor || 'admin_operator';
    const executed = await executeOperatorAction(db, actionRequest, snapshot, actor);

    return new Response(
      JSON.stringify({
        status: 'success',
        action: executed
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      }
    );
  } catch (err: any) {
    const msg = err?.message || 'Action execution error';
    let statusCode = 500;
    let errCode = 'EXECUTION_FAILED';

    if (msg.includes('STATE_CONFLICT')) {
      statusCode = 409;
      errCode = 'STATE_CONFLICT';
    } else if (msg.includes('SAFETY_POLICY_VIOLATION')) {
      statusCode = 403;
      errCode = 'SAFETY_POLICY_VIOLATION';
    } else if (msg.includes('TARGET_NOT_FOUND')) {
      statusCode = 404;
      errCode = 'TARGET_NOT_FOUND';
    } else if (msg.includes('UNSUPPORTED_ACTION')) {
      statusCode = 400;
      errCode = 'UNSUPPORTED_ACTION';
    }

    return new Response(
      JSON.stringify({
        status: 'error',
        code: errCode,
        message: msg
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
