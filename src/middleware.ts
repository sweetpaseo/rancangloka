import type { MiddlewareHandler } from 'astro';
import {
  isValidAdminSession,
  getAdminSessionFromRequest,
  getSafeAdminRedirect,
  verifySameOrigin
} from './lib/auth.ts';
import { getRuntimeEnv } from './lib/db.ts';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { url, request, cookies, locals } = context;
  const pathname = url.pathname;
  const env = await getRuntimeEnv(locals);

  // 1. Admin UI Protection & Stealth Route Guard
  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/logout') {
    const sessionCookie = cookies.get('admin_session');
    const isAuthed = await isValidAdminSession(sessionCookie, env);
    if (!isAuthed) {
      const safeRedirect = getSafeAdminRedirect(pathname);
      const redirectTarget = `/admin/login?redirect=${encodeURIComponent(safeRedirect)}`;
      if (typeof context.redirect === 'function') {
        return context.redirect(redirectTarget, 302);
      }
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectTarget,
          'Cache-Control': 'no-store, private'
        }
      });
    }
  }

  // 2. Admin API Protection & CSRF Guard
  if (pathname.startsWith('/api/admin')) {
    const sessionCookie = cookies.get('admin_session');
    const token = sessionCookie?.value || getAdminSessionFromRequest(request);
    const isAuthed = await isValidAdminSession(token, env);

    // Rule: Authentication is strictly evaluated before mutation or data processing
    if (!isAuthed) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Autentikasi admin diperlukan untuk mengakses endpoint ini.'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private',
            'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
          }
        }
      );
    }

    // Rule: Same-origin check for all mutating methods under /api/admin/*
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (!verifySameOrigin(request)) {
        return new Response(
          JSON.stringify({
            status: 'error',
            code: 'FORBIDDEN_CSRF',
            message: 'Permintaan lintas-origin (CSRF) ditolak.'
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, private',
              'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
            }
          }
        );
      }
    }
  }

  // 3. Internal Media API CORS Handling
  if (pathname.startsWith('/api/internal/v1/media')) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-RL-Device-Token, X-RL-Scope, X-RL-Media-Key',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
  }

  // 4. Process the request
  const response = await next();

  if (pathname.startsWith('/api/internal/v1/media')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-RL-Device-Token, X-RL-Scope, X-RL-Media-Key');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  }

  // 4. Inject Proprietary RancangLoka Headers & Security Standards
  response.headers.set('X-Powered-By', 'RancangLoka Editorial Engine');
  response.headers.set('Server', 'RancangLoka-Edge-Gateway');
  response.headers.set('X-Engine', 'RancangLoka Publishing Core');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 5. Cache-Control for Real-Time Freshness on HTML/Admin/API responses.
  // Preserve explicit public cache headers from XML/JSON routes such as search and sitemaps.
  const contentType = response.headers.get('Content-Type') || '';
  const hasExplicitCache = response.headers.has('Cache-Control');
  const shouldForceNoStore =
    !pathname.startsWith('/assets/') &&
    !pathname.startsWith('/_astro/') &&
    (contentType.includes('text/html') || pathname.startsWith('/admin') || pathname.startsWith('/api/admin'));

  if (shouldForceNoStore || !hasExplicitCache) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  // 6. Hide Admin and API from Search Engines entirely
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  return response;
};
