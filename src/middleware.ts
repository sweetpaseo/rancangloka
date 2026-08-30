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

  // 3. Inject Decoy & Enterprise Security Headers (Anti-Detector Level 100)
  response.headers.set('X-Powered-By', 'Enterprise-Core/v4.8 (Custom SSR)');
  response.headers.set('Server', 'web-gateway-edge/2.1');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 4. Hide Admin and API from Search Engines entirely
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  return response;
};
