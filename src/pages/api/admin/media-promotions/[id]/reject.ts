import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import { adminRejectPromotionRequest } from '../../../../../lib/media/promotion-approval.ts';

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

export const POST: APIRoute = async ({ params, request, locals }) => {
  const adminActor = (locals as any)?.adminUser?.username || (locals as any)?.authActor;
  if (!adminActor && !(locals as any)?.adminUser) {
    return errorResponse(401, 'ADMIN_UNAUTHORIZED', 'Sesi admin autentik diperlukan.');
  }

  const requestId = params.id;
  if (!requestId) {
    return errorResponse(400, 'REQUEST_ID_REQUIRED', 'Parameter ID permintaan promosi wajib.');
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  let reason = 'Ditolak oleh admin operator';
  try {
    const bodyText = await request.text();
    if (bodyText && bodyText.trim()) {
      const parsed = JSON.parse(bodyText);
      if (parsed.reason) reason = String(parsed.reason).trim();
    }
  } catch (_) {}

  const result = await adminRejectPromotionRequest(db, requestId, adminActor, reason);

  if (!result.success) {
    return errorResponse(
      result.statusCode || 400,
      result.code || 'REJECTION_FAILED',
      result.error || 'Gagal menolak promosi.'
    );
  }

  return successResponse({
    status: 'success',
    state: 'REJECTED',
    request_id: requestId
  });
};

export const ALL: APIRoute = async () => {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode POST yang diizinkan.');
};
