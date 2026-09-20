import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../../lib/media/device-auth.ts';
import {
  processDerivativeUpload,
  getDerivativeUploadReceipt,
  ROLE_PUBLIC_DERIVATIVE_CANDIDATE
} from '../../../../../../../lib/media/derivative-upload.ts';
import { MediaRuntimeError } from '../../../../../../../lib/media/service.ts';

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

async function handleUpload(request: Request, params: Record<string, string | undefined>, locals: any): Promise<Response> {
  const derivativeId = params.derivative_id;
  if (!derivativeId) {
    return errorResponse(400, 'DERIVATIVE_ID_REQUIRED', 'Parameter derivative_id wajib disertakan.');
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
  const bucket = env.MEDIA_BUCKET;

  // 1. Device authentication
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return errorResponse(
      auth.statusCode || 401,
      auth.statusCode === 403 ? 'FORBIDDEN_SCOPE' : 'AUTHENTICATION_REQUIRED',
      auth.error || 'Kredensial upload media tidak valid atau tidak disertakan.'
    );
  }

  // 2. Parse body (multipart/form-data or binary)
  let transformId = '';
  let jobId: string | undefined;
  let slotKey: string | undefined;
  let role = ROLE_PUBLIC_DERIVATIVE_CANDIDATE;
  let clientMime: string | undefined;
  let clientWidth: number | undefined;
  let clientHeight: number | undefined;
  let clientByteSize: number | undefined;
  let clientSha256: string | undefined;
  let imageBuffer: ArrayBuffer;

  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return errorResponse(400, 'FILE_REQUIRED', 'File binary derivative wajib diunggah.');
      }

      transformId = String(formData.get('transform_id') || '').trim();
      const rawJobId = formData.get('job_id');
      if (rawJobId) jobId = String(rawJobId).trim();
      slotKey = String(formData.get('slot_key') || 'featured').trim();
      const rawRole = formData.get('role');
      if (rawRole) role = String(rawRole).trim();

      const rawMime = formData.get('mime');
      if (rawMime) clientMime = String(rawMime).trim();

      const rawWidth = formData.get('width');
      if (rawWidth) clientWidth = parseInt(String(rawWidth), 10);

      const rawHeight = formData.get('height');
      if (rawHeight) clientHeight = parseInt(String(rawHeight), 10);

      const rawSize = formData.get('byte_size') || formData.get('size');
      if (rawSize) clientByteSize = parseInt(String(rawSize), 10);

      clientSha256 = String(formData.get('sha256') || formData.get('client_sha256') || '').trim() || undefined;

      imageBuffer = await file.arrayBuffer();
    } else {
      // Direct binary payload with headers or query params
      const url = new URL(request.url);
      transformId = (request.headers.get('x-rl-transform-id') || url.searchParams.get('transform_id') || '').trim();
      jobId = (request.headers.get('x-rl-job-id') || url.searchParams.get('job_id') || '').trim() || undefined;
      slotKey = (request.headers.get('x-rl-slot-key') || url.searchParams.get('slot_key') || 'featured').trim();
      role = (request.headers.get('x-rl-role') || url.searchParams.get('role') || ROLE_PUBLIC_DERIVATIVE_CANDIDATE).trim();

      clientMime = request.headers.get('x-rl-mime') || url.searchParams.get('mime') || contentType.split(';')[0] || undefined;
      const rawWidth = request.headers.get('x-rl-width') || url.searchParams.get('width');
      if (rawWidth) clientWidth = parseInt(rawWidth, 10);

      const rawHeight = request.headers.get('x-rl-height') || url.searchParams.get('height');
      if (rawHeight) clientHeight = parseInt(rawHeight, 10);

      const rawSize = request.headers.get('x-rl-byte-size') || url.searchParams.get('byte_size');
      if (rawSize) clientByteSize = parseInt(rawSize, 10);

      clientSha256 = (request.headers.get('x-rl-sha256') || url.searchParams.get('sha256') || '').trim() || undefined;

      imageBuffer = await request.arrayBuffer();
    }
  } catch (parseErr: any) {
    return errorResponse(400, 'INVALID_REQUEST_BODY', `Gagal memproses body permintaan: ${parseErr.message}`);
  }

  // 3. Execute canonical derivative upload processing
  try {
    const result = await processDerivativeUpload(
      {
        derivativeId,
        transformId,
        jobId,
        slotKey,
        role,
        clientMime,
        clientWidth,
        clientHeight,
        clientByteSize,
        clientSha256,
        imageBuffer
      },
      bucket
    );

    return successResponse(result, 200);
  } catch (err: any) {
    if (err instanceof MediaRuntimeError) {
      return errorResponse(err.statusCode, err.code, err.message);
    }
    return errorResponse(500, 'INTERNAL_DERIVATIVE_UPLOAD_ERROR', err.message || 'Kesalahan internal server upload.');
  }
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  return handleUpload(request, params, locals);
};

export const PUT: APIRoute = async ({ request, params, locals }) => {
  return handleUpload(request, params, locals);
};

export const GET: APIRoute = async ({ request, params, locals }) => {
  const derivativeId = params.derivative_id;
  if (!derivativeId) {
    return errorResponse(400, 'DERIVATIVE_ID_REQUIRED', 'Parameter derivative_id wajib disertakan.');
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any)?.process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
  const bucket = env.MEDIA_BUCKET;

  // 1. Device authentication
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return errorResponse(
      auth.statusCode || 401,
      auth.statusCode === 403 ? 'FORBIDDEN_SCOPE' : 'AUTHENTICATION_REQUIRED',
      auth.error || 'Kredensial autentikasi tidak valid.'
    );
  }

  const url = new URL(request.url);
  const sha256 = (url.searchParams.get('sha256') || '').trim();
  const transformId = (url.searchParams.get('transform_id') || '').trim();
  const ext = (url.searchParams.get('extension') || 'png').trim();

  if (!sha256) {
    return errorResponse(400, 'SHA256_REQUIRED', 'Query parameter sha256 wajib disertakan.');
  }

  const receipt = await getDerivativeUploadReceipt(sha256, derivativeId, transformId, ext, bucket);
  if (!receipt) {
    return errorResponse(404, 'RECEIPT_NOT_FOUND', 'Upload receipt untuk derivative ini tidak ditemukan.');
  }

  return successResponse({ status: 'success', receipt });
};
