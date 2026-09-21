import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { isValidAdminSession } from '../../../../lib/auth.ts';
import {
  holdArticle,
  resumeArticleAutomation,
  returnArticleToDraftAndHold,
  setGlobalAutoScheduleEnabled,
  getArticleAutomationState
} from '../../../../lib/publication/operator-controls.ts';

/**
 * Publication Automation Operator Control API (PUBLICATION-AUTO-1)
 *
 * Enforces:
 * 1. Admin authentication strictly required (no anonymous access)
 * 2. Media device firewall: browser extension / device credentials permanently rejected (403)
 * 3. Human veto actions: hold, resume, return_to_draft_hold, toggle_auto_schedule
 */

function isMediaDeviceRequest(request: Request): boolean {
  const deviceHeader = request.headers.get('x-lokamedia-device-id');
  const userAgent = request.headers.get('user-agent') || '';
  return Boolean(deviceHeader || userAgent.includes('LokaMediaExtension') || userAgent.includes('MediaDevice'));
}

export const GET: APIRoute = async ({ url, cookies, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (import.meta as any).env || {};
    const sessionCookie = cookies.get('admin_session');
    const isAuth = await isValidAdminSession(sessionCookie, env);

    if (!isAuth) {
      return new Response(JSON.stringify({ status: 'error', message: 'UNAUTHORIZED: Admin session required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const articleIdParam = url.searchParams.get('article_id');
    if (!articleIdParam) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing article_id parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const articleId = parseInt(articleIdParam, 10);
    if (isNaN(articleId)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid article_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;
    const state = await getArticleAutomationState(db, articleId);

    return new Response(JSON.stringify({ status: 'success', state }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: err.message.includes('NOT_FOUND') ? 404 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    // 1. Media Device Firewall Check
    if (isMediaDeviceRequest(request)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'FORBIDDEN_MEDIA_DEVICE',
          message: 'MEDIA_FIREWALL_BLOCK: Media devices and browser extensions cannot control publication automation'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Enforce Admin Authentication
    const env = (locals as any)?.runtime?.env || (import.meta as any).env || {};
    const sessionCookie = cookies.get('admin_session');
    const isAuth = await isValidAdminSession(sessionCookie, env);

    if (!isAuth) {
      return new Response(JSON.stringify({ status: 'error', message: 'UNAUTHORIZED: Admin session required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const action = body.action;
    const actor = body.actor || 'admin_operator';
    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;

    if (!action) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing action field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'hold': {
        const articleId = parseInt(body.article_id, 10);
        if (isNaN(articleId)) {
          return new Response(JSON.stringify({ status: 'error', message: 'Invalid or missing article_id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await holdArticle(db, {
          articleId,
          actor,
          reason: body.reason || null
        });
        return new Response(JSON.stringify({ status: 'success', result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'resume': {
        const articleId = parseInt(body.article_id, 10);
        if (isNaN(articleId)) {
          return new Response(JSON.stringify({ status: 'error', message: 'Invalid or missing article_id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await resumeArticleAutomation(db, {
          articleId,
          actor
        });
        return new Response(JSON.stringify({ status: 'success', result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'return_to_draft_hold': {
        const articleId = parseInt(body.article_id, 10);
        if (isNaN(articleId)) {
          return new Response(JSON.stringify({ status: 'error', message: 'Invalid or missing article_id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await returnArticleToDraftAndHold(db, {
          articleId,
          actor,
          reason: body.reason || null
        });
        return new Response(JSON.stringify({ status: 'success', result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'toggle_auto_schedule': {
        if (typeof body.enabled !== 'boolean') {
          return new Response(JSON.stringify({ status: 'error', message: 'Missing or invalid enabled boolean' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await setGlobalAutoScheduleEnabled(db, {
          enabled: body.enabled,
          actor,
          reason: body.reason || null
        });
        return new Response(JSON.stringify({ status: 'success', result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ status: 'error', message: `Unknown action: ${action}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (err: any) {
    const isConflict = err.message.includes('UNPUBLISH_REQUIRED') || err.message.includes('CANNOT_CANCEL');
    const isNotFound = err.message.includes('NOT_FOUND');
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: isNotFound ? 404 : isConflict ? 409 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
