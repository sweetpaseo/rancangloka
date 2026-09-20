import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import {
  attachArticleMedia,
  MediaAttachmentError,
  type ArticleMediaAttachParams
} from '../../../../../../lib/media/article-media.ts';

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
      'Endpoint attachment article_media tidak menerima binary payload atau multipart. ' +
      'Attachment hanya menerima relasi metadata (article_id, slot_key, asset_id).'
    );
  }

  // 3. Parse JSON Body
  let body: any;
  try {
    const rawText = await request.text();
    if (!rawText || !rawText.trim()) {
      return errorResponse(400, 'REQUEST_BODY_REQUIRED', 'JSON body permintaan attachment wajib disertakan.');
    }
    body = JSON.parse(rawText);
  } catch (parseErr: any) {
    return errorResponse(400, 'INVALID_JSON_BODY', `Gagal mem-parsing JSON body: ${parseErr.message}`);
  }

  // 4. Attachment Params
  const attachParams: ArticleMediaAttachParams = {
    article_id: Number(body.article_id || body.articleId),
    slot_key: String(body.slot_key || body.slotKey || '').trim(),
    asset_id: String(body.asset_id || body.assetId || '').trim(),
    caption: body.caption !== undefined ? String(body.caption).trim() : null,
    sort_order: body.sort_order !== undefined ? Number(body.sort_order) : 0,
    job_id: body.job_id ? String(body.job_id).trim() : null
  };

  // 5. Execute Canonical Article Media Attachment
  try {
    const result = await attachArticleMedia(attachParams, db);
    return successResponse(result, 200);
  } catch (err: any) {
    if (err instanceof MediaAttachmentError) {
      return errorResponse(err.statusCode, err.code, err.message);
    }
    return errorResponse(500, 'INTERNAL_ATTACHMENT_ERROR', err.message || 'Kesalahan internal server attachment media.');
  }
};

export const ALL: APIRoute = async () => {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Hanya metode HTTP POST yang diizinkan untuk endpoint attachment media.');
};
