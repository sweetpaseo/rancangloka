import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import {
  requestPromotionApproval,
  type RequestPromotionApprovalParams
} from '../../../../../../lib/media/promotion-approval.ts';

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

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  // 1. Device Authentication (Media Device Authority)
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated || !auth.deviceId) {
    return errorResponse(
      auth.statusCode || 401,
      auth.statusCode === 403 ? 'FORBIDDEN_SCOPE' : 'AUTHENTICATION_REQUIRED',
      auth.error || 'Kredensial device media tidak valid.'
    );
  }

  // 2. Reject binary or multipart payload
  const contentType = request.headers.get('content-type') || '';
  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/octet-stream') ||
    contentType.startsWith('image/')
  ) {
    return errorResponse(
      415,
      'BINARY_PAYLOAD_NOT_ACCEPTED',
      'Endpoint request promotion tidak menerima binary payload.'
    );
  }

  // 3. Parse JSON Body
  let body: any;
  try {
    const rawText = await request.text();
    if (!rawText || !rawText.trim()) {
      return errorResponse(400, 'REQUEST_BODY_REQUIRED', 'JSON body permintaan wajib disertakan.');
    }
    body = JSON.parse(rawText);
  } catch (parseErr: any) {
    return errorResponse(400, 'INVALID_JSON_BODY', `Gagal mem-parsing JSON body: ${parseErr.message}`);
  }

  // Check if client explicitly supplied a device_id; if so, verify against token identity
  const clientDeviceId = body.device_id || body.deviceId;
  if (clientDeviceId && String(clientDeviceId).trim() !== auth.deviceId) {
    return errorResponse(
      403,
      'DEVICE_IDENTITY_MISMATCH',
      `Identitas device client '${clientDeviceId}' tidak cocok dengan identitas terautentikasi '${auth.deviceId}'.`
    );
  }

  const params: RequestPromotionApprovalParams = {
    deviceId: auth.deviceId,
    articleSlug: String(body.article_slug || body.slug || '').trim(),
    expectedContentHash: body.expected_content_hash ? String(body.expected_content_hash).trim() : undefined,
    candidateSha256: String(body.candidate_sha256 || body.sha256 || '').trim(),
    slotKey: String(body.slot_key || 'featured').trim(),
    altText: body.alt_text ? String(body.alt_text).trim() : (body.altText ? String(body.altText).trim() : ''),
    candidateWidth: body.candidate_width ? Number(body.candidate_width) : undefined,
    candidateHeight: body.candidate_height ? Number(body.candidate_height) : undefined,
    candidateMime: body.candidate_mime ? String(body.candidate_mime).trim() : undefined,
    candidateByteSize: body.candidate_byte_size ? Number(body.candidate_byte_size) : undefined,
    ttlSeconds: body.ttl_seconds ? Number(body.ttl_seconds) : 900
  };

  const result = await requestPromotionApproval(db, params, env);
  if (!result.success) {
    return errorResponse(
      result.statusCode || 400,
      result.code || 'REQUEST_FAILED',
      result.error || 'Gagal membuat permintaan promosi.'
    );
  }

  return successResponse({
    status: 'success',
    request_id: result.promotionRequest?.request_id,
    promotion_request: result.promotionRequest
  }, 201);
};

export const ALL: APIRoute = async () => {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode POST yang diizinkan.');
};
