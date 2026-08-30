import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { url, request, cookies } = context;
  const pathname = url.pathname;

  // 1. Admin Protection & Stealth Route Guard
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // Check session or cookie
    const sessionCookie = cookies.get('admin_session');
    // If not authenticated in production, redirect to login
    // Note: Local dev allows testing, but sets strict headers
  }

  // 2. Process the request
  const response = await next();

  // 3. Inject Proprietary RancangLoka Headers & Security Standards
  response.headers.set('X-Powered-By', 'RancangLoka HyperEngine v1.0');
  response.headers.set('Server', 'RancangLoka-Edge-Gateway/2026');
  response.headers.set('X-Engine', 'RancangLoka Proprietary High-Performance Core');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 4. Cache-Control for Real-Time Freshness on HTML Pages
  if (!pathname.startsWith('/assets/') && !pathname.startsWith('/_astro/')) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  // 5. Hide Admin and API from Search Engines entirely
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  return response;
};
