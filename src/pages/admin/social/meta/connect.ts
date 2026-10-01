import type { APIRoute } from 'astro';
import { isValidAdminSession, getAdminSessionFromRequest } from '../../../../lib/auth.ts';
import { processMetaConnectRequest } from '../../../../lib/social/providers/meta/oauth-pipeline.ts';
import type { MetaAuthMode } from '../../../../lib/social/providers/meta/binding-types.ts';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { request, cookies, locals, url } = context;
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env;

  // 1. Admin Authentication Check
  const sessionCookie = cookies.get('admin_session');
  const token = sessionCookie?.value || getAdminSessionFromRequest(request);
  const isAuthed = await isValidAdminSession(token, env);

  if (!isAuthed) {
    if (request.headers.get('Accept')?.includes('application/json')) {
      return new Response(
        JSON.stringify({ status: 'error', code: 'UNAUTHORIZED', message: 'Admin authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return context.redirect('/admin/login?redirect=' + encodeURIComponent(url.pathname), 302);
  }

  // 2. Parse Options
  const authModeParam = url.searchParams.get('mode');
  const authMode: MetaAuthMode = authModeParam === 'INSTAGRAM_LOGIN' ? 'INSTAGRAM_LOGIN' : 'FACEBOOK_LOGIN';
  const redirectUri = url.origin + '/admin/social/meta/callback';

  // 3. Process Connect Request
  const result = await processMetaConnectRequest({
    env,
    authMode,
    redirectUri,
  });

  const wantsJson = url.searchParams.get('format') === 'json' || request.headers.get('Accept')?.includes('application/json');

  if (!result.success) {
    if (wantsJson) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: result.code,
          message: result.error,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return context.redirect(
      `/admin/settings#social-meta-connection?error=${encodeURIComponent(result.code)}&message=${encodeURIComponent(result.error || '')}`,
      302
    );
  }

  if (wantsJson) {
    return new Response(
      JSON.stringify({
        status: 'ready_to_connect',
        authorizeUrl: result.authorizeUrl,
        state: result.stateString,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return context.redirect(result.authorizeUrl!, 302);
};

export const POST: APIRoute = async (context) => {
  return GET(context);
};
