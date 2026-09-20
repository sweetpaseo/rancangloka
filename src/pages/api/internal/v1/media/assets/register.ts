import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import {
  registerMediaAsset,
  MediaRegistrationError,
  REGISTERED_MEDIA_ASSET_ROLE,
  type MediaAssetRegistrationParams
} from '../../../../../../lib/media/asset-registration.ts';

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
  const bucket = env.MEDIA_BUCKET;

  // 1. Device authentication (least privilege, independent of admin_session)
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return errorResponse(
      auth.statusCode || 401,
      auth.statusCode === 403 ? 'FORBIDDEN_SCOPE' : 'AUTHENTICATION_REQUIRED',
      auth.error || 'Kredensial autentikasi media device tidak valid atau tidak disertakan.'
    );
  }

  // 2. Binary Rejection Guard: Must NOT accept binary or multipart payload
  const contentType = request.headers.get('content-type') || '';
  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/octet-stream') ||
    contentType.startsWith('image/')
  ) {
    return errorResponse(
      415,
      'BINARY_PAYLOAD_NOT_ACCEPTED',
      'Endpoint registrasi media_assets tidak menerima binary payload atau multipart. ' +
      'Registrasi hanya mengonsumsi verified upload receipt dan verified canonical R2 metadata.'
    );
  }

  // 3. Parse JSON Body
  let body: any;
  try {
    const rawText = await request.text();
    if (!rawText || !rawText.trim()) {
      return errorResponse(400, 'REQUEST_BODY_REQUIRED', 'JSON body permintaan registrasi wajib disertakan.');
    }
    body = JSON.parse(rawText);
  } catch (parseErr: any) {
    return errorResponse(400, 'INVALID_JSON_BODY', `Gagal mem-parsing JSON body: ${parseErr.message}`);
  }

  // 4. Registration Params
  const registrationParams: MediaAssetRegistrationParams = {
    upload_id: String(body.upload_id || body.uploadId || '').trim(),
    derivative_id: String(body.derivative_id || body.derivativeId || '').trim(),
    transform_id: String(body.transform_id || body.transformId || '').trim(),
    r2_key: String(body.r2_key || body.r2Key || '').trim(),
    sha256: String(body.sha256 || '').trim(),
    mime: String(body.mime || body.mime_type || body.mimeType || '').trim(),
    width: Number(body.width),
    height: Number(body.height),
    byte_size: Number(body.byte_size || body.size || body.byteSize),
    role: body.role ? String(body.role).trim() : REGISTERED_MEDIA_ASSET_ROLE,
    watermark_settings_version: body.watermark_settings_version !== undefined ? Number(body.watermark_settings_version) : undefined,
    watermark_engine_version: body.watermark_engine_version ? String(body.watermark_engine_version).trim() : undefined,
    source_sha256: body.source_sha256 ? String(body.source_sha256).trim() : undefined,
    job_id: body.job_id ? String(body.job_id).trim() : undefined,
    slot_key: body.slot_key ? String(body.slot_key).trim() : undefined,
    article_id: body.article_id !== undefined ? Number(body.article_id) : undefined,
    upload_receipt: body.upload_receipt || (body.receipt ? body.receipt : undefined),
    upload_state: body.upload_state || (body.upload_receipt?.state ? body.upload_receipt.state : undefined)
  };

  // 5. Execute Canonical Media Asset Registration
  try {
    const result = await registerMediaAsset(registrationParams, db, bucket);
    return successResponse(result, 200);
  } catch (err: any) {
    if (err instanceof MediaRegistrationError) {
      return errorResponse(err.statusCode, err.code, err.message);
    }
    return errorResponse(500, 'INTERNAL_REGISTRATION_ERROR', err.message || 'Kesalahan internal server registrasi media.');
  }
};
