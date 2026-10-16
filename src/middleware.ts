import type { MiddlewareHandler } from 'astro';
import {
  isValidAdminSession,
  getAdminSessionFromRequest,
  getSafeAdminRedirect,
  verifySameOrigin,
  isCronServiceAuthenticated
} from './lib/auth.ts';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { url, request, cookies, locals } = context;
  const pathname = url.pathname;
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env;

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
    // A. Media Device Firewall: Media/LokaMedia credentials strictly forbidden from admin APIs
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.toLowerCase().includes('lkmd_') || authHeader.toLowerCase().includes('media:device')) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'MEDIA_DEVICE_FORBIDDEN',
          message: 'Media devices are strictly forbidden from accessing admin endpoints.'
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

    // B. Trigger Endpoint Service Authentication Support (Phase 5L9)
    const isTriggerRoute =
      pathname === '/api/admin/publication/plans' ||
      pathname === '/api/admin/publication/publish/reconcile' ||
      pathname === '/api/admin/publication/publish/due';

    let isServiceAuthed = false;
    if (isTriggerRoute) {
      isServiceAuthed = isCronServiceAuthenticated(request, env);
    }

    const sessionCookie = cookies.get('admin_session');
    const token = sessionCookie?.value || getAdminSessionFromRequest(request);
    const isAdminAuthed = await isValidAdminSession(token, env);

    // Rule: Authentication is strictly evaluated before mutation or data processing
    if (!isServiceAuthed && !isAdminAuthed) {
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

    // Annotate context for downstream routes
    if (isServiceAuthed) {
      (locals as any).authType = 'cron_service';
      (locals as any).authActor = 'cron_service';
    } else {
      (locals as any).authType = 'admin_session';
      (locals as any).authActor = 'admin_operator';
    }

    // Rule: Same-origin check for browser-authenticated mutating methods under /api/admin/*
    // Non-browser Cron secret-authenticated service calls safely bypass browser CSRF.
    if (!isServiceAuthed) {
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
  }


  // 3. Process the request
  const response = await next();

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

  // 5. Content Protection Safe Cache Architecture (CONTENT_PROTECTION-1A)
  // Assets and media retain their own immutable/static caching
  if (pathname.startsWith('/assets/') || pathname.startsWith('/_astro/') || pathname.startsWith('/media/')) {
    // Preserve existing asset and media cache headers
  } else {
    const method = request.method.toUpperCase();
    const hasAdminSession = cookies.has('admin_session');
    const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
    const isInternalPath = pathname.startsWith('/api/internal');
    const isErrorState = response.status >= 400;
    const isNonSafeMethod = method !== 'GET' && method !== 'HEAD';

    // Hard Safety Gate: Non-cacheable surfaces MUST be strictly no-store
    if (hasAdminSession || isAdminPath || isInternalPath || isErrorState || isNonSafeMethod) {
      response.headers.set('Cache-Control', 'no-store, private');
      response.headers.delete('Cloudflare-CDN-Cache-Control');
      response.headers.delete('Cache-Tag');
      response.headers.delete('Pragma');
      response.headers.delete('Expires');
    } else {
      // Clean up legacy HTTP/1.0 headers
      response.headers.delete('Pragma');
      response.headers.delete('Expires');

      // If the response already set explicit Cloudflare-CDN-Cache-Control (e.g. from page or API route), preserve it
      if (!response.headers.has('Cloudflare-CDN-Cache-Control')) {
        if (pathname === '/') {
          response.headers.set('Cache-Control', 'public, max-age=60');
          response.headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
          if (!response.headers.has('Cache-Tag')) {
            response.headers.set('Cache-Tag', 'homepage');
          }
        } else if (pathname === '/rss.xml') {
          response.headers.set('Cache-Control', 'public, max-age=1800');
          response.headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=7200');
          if (!response.headers.has('Cache-Tag')) {
            response.headers.set('Cache-Tag', 'rss');
          }
        } else if (pathname.startsWith('/sitemap') || pathname.endsWith('-sitemap.xml')) {
          response.headers.set('Cache-Control', 'public, max-age=3600');
          response.headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=86400');
          if (!response.headers.has('Cache-Tag')) {
            response.headers.set('Cache-Tag', 'sitemap');
          }
        } else if (pathname === '/api/search.json') {
          response.headers.set('Cache-Control', 'public, max-age=60');
          response.headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=300');
          if (!response.headers.has('Cache-Tag')) {
            response.headers.set('Cache-Tag', 'search');
          }
        } else if (!pathname.startsWith('/api/') && !pathname.includes('.')) {
          // Public content/article route: default safe policy
          response.headers.set('Cache-Control', 'public, max-age=60');
          response.headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        } else {
          // Conservative default for unknown/unclassified routes
          response.headers.set('Cache-Control', 'no-store, private');
          response.headers.delete('Cloudflare-CDN-Cache-Control');
          response.headers.delete('Cache-Tag');
        }
      }
    }
  }

  // 6. Hide Admin and API from Search Engines entirely
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  return response;
};
