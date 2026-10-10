/**
 * RancangLoka — Media Upload Endpoint (MEDIA-0)
 * POST /api/internal/v1/media/upload
 *
 * Staging Astro APIRoute for Cloudflare Workers.
 *
 * Security & Reliability Contracts:
 * 1. Dedicated Least-Privilege Authentication:
 *    - Independent of Hermes Ingest and Inventory secrets.
 *    - Validates X-RL-Media-Key or Bearer token (scope: media:write:draft).
 *    - Zero capability to publish articles or modify article text.
 * 2. Strict Input Boundary:
 *    - POST only (other HTTP methods rejected with 405).
 *    - Payload size capped at 5 MiB.
 *    - Target article must exist and have status = 'draft'.
 * 3. Pure Content-Addressable Storage:
 *    - Global SHA-256 deduplication: media/images/<sha256>.<ext>.
 *    - Client-supplied storage_key strictly rejected.
 * 4. Non-destructive Replacement:
 *    - Sets previous binding is_active = 0, new binding is_active = 1.
 *    - Preserves old asset (media_assets.status remains VALIDATED).
 * 5. Fail Closed:
 *    - Any R2 or D1 failure leaves article draft 100% untouched.
 */

import type { APIRoute } from 'astro';
import {
  processMediaUpload,
  MediaRuntimeError,
  MAX_MEDIA_BYTES
} from '../../../../../lib/media/service.ts';
import { getDb } from '../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../lib/media/device-auth.ts';

const EXPECTED_MEDIA_SCOPE = 'media:write:draft';

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

export const POST: APIRoute = async ({ request, locals }) => {
  const startTime = Date.now();

  // 1. Enforce POST Method
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode POST yang diizinkan.', {
      Allow: 'POST'
    });
  }

  // 2. Separate Least-Privilege Media Authentication (Device Token or Media Key)
  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return errorResponse(
      auth.statusCode || 401,
      auth.statusCode === 403 ? 'FORBIDDEN_SCOPE' : 'AUTHENTICATION_REQUIRED',
      auth.error || 'Kredensial upload media tidak valid atau tidak disertakan.'
    );
  }

  // 3. Extract Cloudflare Runtime Bindings
  const bucket = env.MEDIA_BUCKET;

  if (!db) {
    return errorResponse(500, 'DATABASE_UNAVAILABLE', 'Koneksi D1 database tidak tersedia.');
  }

  // 4. Parse Request Body
  let articleId: number;
  let role: 'featured' | 'inline' = 'featured';
  let altText = '';
  let caption: string | undefined;
  let clientSuppliedKey: string | undefined;
  let jobId: string | undefined;
  let slotKey: string | undefined;
  let sourceType: string | undefined;
  let protocolVersion: number | undefined;
  let expectedJobRevision: number | undefined;
  let sequence: number | undefined;
  let promptVersion: number | undefined;
  let promptHash: string | undefined;
  let idempotencyKey: string | undefined;
  let clientSha256: string | undefined;
  let approvalRecordRaw: string | undefined;
  let imageBuffer: ArrayBuffer;

  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return errorResponse(400, 'FILE_REQUIRED', 'File gambar wajib diunggah.');
      }

      const rawArticleId = formData.get('article_id');
      if (!rawArticleId) {
        return errorResponse(400, 'ARTICLE_ID_REQUIRED', 'Parameter article_id wajib disertakan.');
      }
      articleId = parseInt(String(rawArticleId), 10);
      if (isNaN(articleId) || articleId <= 0) {
        return errorResponse(400, 'ARTICLE_ID_INVALID', 'Format article_id tidak valid.');
      }

      const rawRole = formData.get('role');
      if (rawRole && (rawRole === 'featured' || rawRole === 'inline')) {
        role = rawRole;
      }

      altText = String(formData.get('alt_text') || '').trim();
      const rawCaption = formData.get('caption');
      if (rawCaption) caption = String(rawCaption).trim();

      // Detect illegal client-supplied storage key
      const rawKey = formData.get('storage_key') || formData.get('key');
      if (rawKey) clientSuppliedKey = String(rawKey);

      const rawJobId = formData.get('job_id');
      if (rawJobId) jobId = String(rawJobId).trim();
      slotKey = String(formData.get('slot_key') || '').trim() || undefined;
      sourceType = String(formData.get('source_type') || '').trim() || undefined;
      const rawProtocolVersion = formData.get('protocol_version');
      if (rawProtocolVersion) protocolVersion = Number(rawProtocolVersion);
      const rawRevision = formData.get('expected_job_revision');
      if (rawRevision) expectedJobRevision = Number(rawRevision);
      const rawSequence = formData.get('sequence');
      if (rawSequence) sequence = Number(rawSequence);
      const rawPromptVersion = formData.get('prompt_version');
      if (rawPromptVersion) promptVersion = Number(rawPromptVersion);
      promptHash = String(formData.get('prompt_hash') || '').trim() || undefined;
      idempotencyKey = String(formData.get('idempotency_key') || '').trim() || undefined;
      clientSha256 = String(formData.get('client_sha256') || '').trim() || undefined;
      const rawApproval = formData.get('approval_record') || formData.get('human_approval');
      if (rawApproval) approvalRecordRaw = String(rawApproval).trim();

      imageBuffer = await file.arrayBuffer();
    } else {
      // Direct binary payload
      const url = new URL(request.url);
      const rawArticleId = url.searchParams.get('article_id');
      if (!rawArticleId) {
        return errorResponse(400, 'ARTICLE_ID_REQUIRED', 'Query parameter article_id wajib disertakan.');
      }
      articleId = parseInt(rawArticleId, 10);
      if (isNaN(articleId) || articleId <= 0) {
        return errorResponse(400, 'ARTICLE_ID_INVALID', 'Format article_id tidak valid.');
      }

      const rawRole = url.searchParams.get('role');
      if (rawRole && (rawRole === 'featured' || rawRole === 'inline')) {
        role = rawRole as 'featured' | 'inline';
      }

      altText = (url.searchParams.get('alt_text') || '').trim();
      caption = url.searchParams.get('caption') || undefined;
      clientSuppliedKey = url.searchParams.get('storage_key') || url.searchParams.get('key') || undefined;
      const rawJobId = url.searchParams.get('job_id');
      if (rawJobId) jobId = rawJobId.trim();
      slotKey = url.searchParams.get('slot_key') || undefined;
      sourceType = url.searchParams.get('source_type') || undefined;
      const rawProtocolVersion = url.searchParams.get('protocol_version');
      if (rawProtocolVersion) protocolVersion = Number(rawProtocolVersion);
      const rawRevision = url.searchParams.get('expected_job_revision');
      if (rawRevision) expectedJobRevision = Number(rawRevision);
      const rawSequence = url.searchParams.get('sequence');
      if (rawSequence) sequence = Number(rawSequence);
      const rawPromptVersion = url.searchParams.get('prompt_version');
      if (rawPromptVersion) promptVersion = Number(rawPromptVersion);
      promptHash = url.searchParams.get('prompt_hash') || undefined;
      idempotencyKey = url.searchParams.get('idempotency_key') || undefined;
      clientSha256 = url.searchParams.get('client_sha256') || undefined;
      approvalRecordRaw = url.searchParams.get('approval_record') || request.headers.get('x-human-approval') || undefined;

      imageBuffer = await request.arrayBuffer();
    }
  } catch (err: any) {
    return errorResponse(400, 'INVALID_REQUEST_BODY', `Gagal memproses body permintaan: ${err.message}`);
  }

  // 5. Check Alt Text for Featured Images
  if (role === 'featured' && !altText) {
    return errorResponse(422, 'ALT_TEXT_REQUIRED', 'Parameter alt_text wajib diisi untuk featured image.');
  }

  // 5.1 Enforce Human Approval Boundary for LokaMedia Extension
  let validatedApproval: {
    job_id: string;
    candidate_sha256: string;
    approved_at: string;
    approval_source: string;
  } | null = null;

  if (sourceType === 'lokamedia_extension' && jobId) {
    if (!approvalRecordRaw) {
      return errorResponse(403, 'HUMAN_APPROVAL_REQUIRED', 'Upload dari ekstensi LokaMedia memerlukan bukti persetujuan manusia eksplisit (Human Approval Record).');
    }

    try {
      validatedApproval = JSON.parse(approvalRecordRaw);
    } catch {
      return errorResponse(400, 'APPROVAL_RECORD_INVALID', 'Format approval_record tidak valid JSON.');
    }

    if (!validatedApproval || typeof validatedApproval !== 'object') {
      return errorResponse(400, 'APPROVAL_RECORD_INVALID', 'approval_record harus berupa object.');
    }

    if (validatedApproval.job_id !== jobId) {
      return errorResponse(422, 'APPROVAL_JOB_MISMATCH', 'Approval record job_id tidak cocok dengan target job_id.');
    }

    if (validatedApproval.approval_source !== 'operator_side_panel') {
      return errorResponse(403, 'APPROVAL_SOURCE_INVALID', 'Approval source harus operator_side_panel.');
    }

    if (!validatedApproval.approved_at || isNaN(Date.parse(validatedApproval.approved_at))) {
      return errorResponse(422, 'APPROVAL_TIMESTAMP_INVALID', 'Approval timestamp tidak valid.');
    }

    if (!validatedApproval.candidate_sha256) {
      return errorResponse(422, 'APPROVAL_SHA_MISSING', 'Approval record wajib menyertakan candidate_sha256.');
    }

    if (clientSha256 && validatedApproval.candidate_sha256.toLowerCase() !== clientSha256.toLowerCase()) {
      return errorResponse(422, 'APPROVAL_SHA_MISMATCH', 'Candidate SHA pada approval record tidak cocok dengan client_sha256.');
    }
  }

  // 6. Execute Safe Upload
  try {
    const result = await processMediaUpload(
      {
        articleId,
        role,
        slotKey,
        sequence,
        imageBuffer,
        altText,
        caption,
        clientSuppliedKey,
        sourceType,
        protocolVersion,
        jobId,
        expectedJobRevision,
        promptVersion,
        promptHash,
        idempotencyKey,
        clientSha256,
        approvalRecord: validatedApproval || undefined,
        deviceId: auth.deviceId || null
      },
      db,
      bucket
    );

    // Legacy MEDIA-1 compatibility: old clients supplied only job_id. Phase 2C
    // LokaMedia Extension uploads complete through processMediaUpload receipts.
    if (jobId && db && sourceType !== 'lokamedia_extension') {
      try {
        await db
          .prepare("UPDATE media_jobs SET status = 'COMPLETE', completed_at = CURRENT_TIMESTAMP, job_revision = job_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?")
          .bind(jobId)
          .run();
        (result as any).jobId = jobId;
        (result as any).jobStatus = 'COMPLETE';
      } catch (_) {
        // Table might not exist yet or job already attached; non-fatal
      }
    }

    return successResponse(result);
  } catch (err: any) {
    if (err instanceof MediaRuntimeError) {
      return errorResponse(err.statusCode, err.code, err.message);
    }
    return errorResponse(500, 'INTERNAL_MEDIA_ERROR', err.message || 'Kesalahan internal server media.');
  }
};
