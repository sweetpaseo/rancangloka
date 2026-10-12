import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import { getPromotionRequestStatus } from '../../../../../../lib/media/promotion-approval.ts';

function errorResponse(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      status: 'error',
      code,
      message
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        ...(headers || {})
      }
    }
  );
}

function successResponse(data: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    }
  });
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const requestId = params.id;
  if (!requestId) {
    return errorResponse(400, 'REQUEST_ID_REQUIRED', 'Parameter ID permintaan wajib.');
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  // Authenticate device
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated || !auth.deviceId) {
    return errorResponse(
      auth.statusCode || 401,
      auth.statusCode === 403 ? 'FORBIDDEN_SCOPE' : 'AUTHENTICATION_REQUIRED',
      auth.error || 'Kredensial device media tidak valid.'
    );
  }

  const result = await getPromotionRequestStatus(db, requestId, auth.deviceId);
  if (!result.success) {
    return errorResponse(result.statusCode || 400, result.code || 'LOOKUP_FAILED', result.error || 'Gagal mencari permintaan promosi.');
  }

  return successResponse({
    status: 'success',
    record: result.record,
    approval_receipt: result.approvalReceipt || null
  });
};

export const ALL: APIRoute = async () => {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode GET yang diizinkan.');
};
