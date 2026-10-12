import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import { verifyAndConsumePromotionApproval } from '../../../../../../lib/media/promotion-approval.ts';
import {
  inspectImageBinary,
  computeBufferSha256,
  MediaRuntimeError,
  MAX_MEDIA_BYTES
} from '../../../../../../lib/media/service.ts';

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

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
  const bucket = env.MEDIA_BUCKET;

  // 1. Device authentication (least privilege media:device scope)
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return errorResponse(
      auth.statusCode || 401,
      auth.statusCode === 403 ? 'FORBIDDEN_SCOPE' : 'AUTHENTICATION_REQUIRED',
      auth.error || 'Kredensial autentikasi media device tidak valid atau tidak disertakan.'
    );
  }

  // 2. Validate Content-Type
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return errorResponse(415, 'UNSUPPORTED_MEDIA_TYPE', 'Endpoint upload media assets memerlukan form multipart/form-data.');
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err: any) {
    return errorResponse(400, 'INVALID_FORM_DATA', `Gagal membaca form data: ${err.message}`);
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return errorResponse(400, 'FILE_REQUIRED', 'File binary gambar wajib disertakan.');
  }

  const clientDeviceId = (formData.get('device_id') || formData.get('deviceId'))?.toString().trim();
  if (clientDeviceId && clientDeviceId !== auth.deviceId) {
    return errorResponse(
      403,
      'DEVICE_IDENTITY_MISMATCH',
      `Identitas device client '${clientDeviceId}' tidak cocok dengan identitas terautentikasi '${auth.deviceId}'.`
    );
  }

  const expectedSha256 = String(formData.get('expected_sha256') || '').trim();
  const humanApprovalRaw = String(formData.get('human_approval') || '').trim();

  if (!humanApprovalRaw) {
    return errorResponse(403, 'HUMAN_APPROVAL_REQUIRED', 'Upload standalone memerlukan metadata persetujuan manusia eksplisit (human_approval).');
  }

  let approval: any;
  try {
    approval = JSON.parse(humanApprovalRaw);
  } catch {
    return errorResponse(400, 'APPROVAL_INVALID_JSON', 'Format human_approval harus berupa JSON valid.');
  }

  if (!approval || typeof approval !== 'object') {
    return errorResponse(400, 'APPROVAL_INVALID_STRUCTURE', 'human_approval harus berupa JSON object.');
  }

  if (!approval.article_slug || typeof approval.article_slug !== 'string') {
    return errorResponse(422, 'APPROVAL_SLUG_REQUIRED', 'human_approval wajib menyertakan article_slug.');
  }

  if (!approval.candidate_sha256 || typeof approval.candidate_sha256 !== 'string') {
    return errorResponse(422, 'APPROVAL_SHA_REQUIRED', 'human_approval wajib menyertakan candidate_sha256.');
  }

  if (approval.slot_key !== 'featured') {
    return errorResponse(422, 'APPROVAL_SLOT_INVALID', 'Promosi media manual saat ini hanya diizinkan untuk slot_key "featured".');
  }

  // 3. Target Article & Hash Verification in D1
  if (db) {
    const article = await db
      .prepare('SELECT id, slug, status, content_hash FROM articles WHERE slug = ? LIMIT 1')
      .bind(approval.article_slug.trim())
      .first();

    if (!article) {
      return errorResponse(404, 'ARTICLE_NOT_FOUND', `Artikel target '${approval.article_slug}' tidak ditemukan.`);
    }

    if (approval.expected_content_hash && article.content_hash && approval.expected_content_hash !== article.content_hash) {
      return errorResponse(409, 'CONTENT_HASH_MISMATCH', 'expected_content_hash tidak cocok dengan content_hash artikel di server.');
    }
  }

  // 4. Binary Inspection & SHA-256 Computation
  const imageBuffer = await file.arrayBuffer();
  let meta: any;
  try {
    meta = inspectImageBinary(imageBuffer);
  } catch (err: any) {
    if (err instanceof MediaRuntimeError) {
      return errorResponse(err.statusCode, err.code, err.message);
    }
    return errorResponse(422, 'CORRUPT_IMAGE_PAYLOAD', err.message || 'File gambar tidak valid.');
  }

  const computedSha256 = await computeBufferSha256(imageBuffer);
  meta.sha256 = computedSha256;

  if (expectedSha256 && expectedSha256.toLowerCase() !== computedSha256.toLowerCase()) {
    return errorResponse(422, 'SHA256_MISMATCH', `SHA-256 yang dihitung (${computedSha256}) tidak cocok dengan expected_sha256 (${expectedSha256}).`);
  }

  if (approval.candidate_sha256.toLowerCase() !== computedSha256.toLowerCase()) {
    return errorResponse(422, 'APPROVAL_SHA_MISMATCH', `SHA-256 file (${computedSha256}) tidak cocok dengan hash persetujuan manusia (${approval.candidate_sha256}).`);
  }

  // 5. Content-Addressed Storage Key
  const storageKey = `media/images/${computedSha256}.${meta.extension}`;
  const publicUrl = `/${storageKey}`;
  const uploadId = `upl_standalone_${computedSha256.substring(0, 16)}`;

  // 6. Server-Side Approval Verification & Atomic Consumption
  const verifyResult = await verifyAndConsumePromotionApproval(
    db,
    approval,
    computedSha256,
    uploadId,
    env,
    auth.deviceId
  );

  if (!verifyResult.valid) {
    return errorResponse(
      verifyResult.statusCode || 403,
      verifyResult.code || 'APPROVAL_VERIFICATION_FAILED',
      verifyResult.error || 'Verifikasi server approval receipt gagal.'
    );
  }

  // 7. R2 Storage Write / Idempotent Reuse
  let alreadyExists = false;
  if (bucket && typeof bucket.head === 'function') {
    try {
      const existingHead = await bucket.head(storageKey);
      if (existingHead && existingHead.size === imageBuffer.byteLength) {
        alreadyExists = true;
      }
    } catch (_) {}

    if (!alreadyExists && typeof bucket.put === 'function') {
      try {
        await bucket.put(storageKey, imageBuffer, {
          httpMetadata: {
            contentType: meta.mimeType,
            cacheControl: 'public, max-age=31536000, immutable'
          },
          customMetadata: {
            sha256: computedSha256,
            width: String(meta.width),
            height: String(meta.height),
            uploadId,
            sourceType: 'manual_published_promotion'
          }
        });
      } catch (putErr: any) {
        return errorResponse(500, 'R2_PUT_FAILED', `Gagal menyimpan objek ke R2: ${putErr.message}`);
      }
    }
  }

  return successResponse({
    status: 'success',
    storage_key: storageKey,
    public_url: publicUrl,
    sha256: computedSha256,
    reused: alreadyExists,
    reused_existing: alreadyExists,
    upload: {
      upload_id: uploadId,
      storage_key: storageKey,
      public_url: publicUrl,
      sha256: computedSha256,
      mime: meta.mimeType,
      width: meta.width,
      height: meta.height,
      byte_size: imageBuffer.byteLength,
      reused_existing: alreadyExists
    }
  });
};

export const ALL: APIRoute = async () => {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode HTTP POST yang diizinkan untuk endpoint upload media assets.');
};
