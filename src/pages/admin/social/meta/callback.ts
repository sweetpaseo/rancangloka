import type { APIRoute } from 'astro';
import { isValidAdminSession, getAdminSessionFromRequest } from '../../../../lib/auth.ts';
import { getDb } from '../../../../lib/db.ts';
import { processMetaCallbackRequest } from '../../../../lib/social/providers/meta/oauth-pipeline.ts';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { request, cookies, locals, url } = context;
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env;

  // 1. Admin Authentication Check
  const sessionCookie = cookies.get('admin_session');
  const token = sessionCookie?.value || getAdminSessionFromRequest(request);
  const isAuthed = await isValidAdminSession(token, env);

  const wantsJson = url.searchParams.get('format') === 'json' || request.headers.get('Accept')?.includes('application/json');

  if (!isAuthed) {
    if (wantsJson) {
      return new Response(
        JSON.stringify({ status: 'error', code: 'UNAUTHORIZED', message: 'Admin authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return context.redirect('/admin/login?redirect=' + encodeURIComponent(url.pathname), 302);
  }

  // 2. Extract Callback Parameters
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description') || url.searchParams.get('error_message');
  const selectedPageId = url.searchParams.get('page_id') || undefined;

  const db = await getDb(locals);
  const expectedRedirectUri = url.origin + url.pathname;

  // 3. Process Callback Pipeline
  const result = await processMetaCallbackRequest({
    db,
    env,
    code,
    state,
    error,
    errorDescription,
    expectedRedirectUri,
    explicitSelectedPageId: selectedPageId,
  });

  if (!result.success) {
    if (wantsJson) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: result.code,
          message: result.message,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return context.redirect(
      `/admin/settings#social-meta-connection?error=${encodeURIComponent(result.code)}&message=${encodeURIComponent(result.message)}`,
      302
    );
  }

  if (wantsJson) {
    return new Response(
      JSON.stringify({
        status: 'success',
        code: result.code,
        message: result.message,
        connection: result.connection,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return context.redirect('/admin/settings#social-meta-connection?connected=true', 302);
};

export const POST: APIRoute = async (context) => {
  return GET(context);
};
