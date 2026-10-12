import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { listPendingPromotionRequests } from '../../../../lib/media/promotion-approval.ts';

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

function successResponse(data: Record<string, any>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    }
  });
}

export const GET: APIRoute = async ({ locals }) => {
  const adminActor = (locals as any)?.adminUser?.username || (locals as any)?.authActor;
  if (!adminActor && !(locals as any)?.adminUser) {
    return errorResponse(401, 'ADMIN_UNAUTHORIZED', 'Sesi admin autentik diperlukan.');
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const requests = await listPendingPromotionRequests(db);
    return successResponse({
      status: 'success',
      requests,
      pending_promotions: requests
    });
  } catch (err: any) {
    return errorResponse(500, 'INTERNAL_ERROR', err.message || 'Gagal mengambil daftar promosi.');
  }
};

export const ALL: APIRoute = async () => {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode GET yang diizinkan.');
};
