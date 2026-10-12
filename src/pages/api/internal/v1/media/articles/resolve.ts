import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({ status: 'error', code, message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    }
  );
}

function successResponse(data: Record<string, any>, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    }
  );
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  // 1. Device authentication (least privilege media:device scope)
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return errorResponse(
      auth.statusCode || 401,
      auth.statusCode === 403 ? 'FORBIDDEN_SCOPE' : 'AUTHENTICATION_REQUIRED',
      auth.error || 'Kredensial autentikasi media device tidak valid atau tidak disertakan.'
    );
  }

  const clientDeviceId = new URL(request.url).searchParams.get('device_id') || request.headers.get('x-rl-device-id');
  if (clientDeviceId && clientDeviceId.trim() !== auth.deviceId) {
    return errorResponse(
      403,
      'DEVICE_IDENTITY_MISMATCH',
      `Identitas device client '${clientDeviceId}' tidak cocok dengan identitas terautentikasi '${auth.deviceId}'.`
    );
  }

  if (!db) {
    return errorResponse(500, 'DATABASE_UNAVAILABLE', 'Database tidak tersedia.');
  }

  // 2. Validate slug query parameter
  const url = new URL(request.url);
  const rawSlug = url.searchParams.get('slug');
  if (!rawSlug || !rawSlug.trim()) {
    return errorResponse(400, 'SLUG_REQUIRED', 'Parameter query slug wajib disertakan.');
  }
  const cleanSlug = rawSlug.trim();

  // 3. Query article strictly by canonical slug
  const article = await db
    .prepare(
      `SELECT id, slug, title, status, content_hash, featured_image, image_alt
       FROM articles
       WHERE slug = ?
       LIMIT 1`
    )
    .bind(cleanSlug)
    .first();

  if (!article) {
    return errorResponse(404, 'ARTICLE_NOT_FOUND', `Artikel dengan slug '${cleanSlug}' tidak ditemukan.`);
  }

  return successResponse({
    status: 'success',
    article: {
      id: Number(article.id),
      slug: article.slug,
      title: article.title,
      status: article.status,
      content_hash: article.content_hash || '',
      featured_image: article.featured_image || '',
      image_alt: article.image_alt || ''
    }
  });
};

export const ALL: APIRoute = async () => {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode HTTP GET yang diizinkan untuk endpoint resolve article.');
};
