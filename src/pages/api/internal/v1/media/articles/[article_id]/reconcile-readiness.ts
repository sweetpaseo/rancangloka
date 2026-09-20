import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../../lib/media/device-auth.ts';
import {
  reconcileArticleMediaReadiness,
  evaluateArticleMediaReadiness,
  type ReconcileResult
} from '../../../../../../../lib/media/readiness-reconciler.ts';

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

export const POST: APIRoute = async ({ request, params, locals }) => {
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
      'Endpoint readiness reconciliation tidak menerima binary payload atau multipart.'
    );
  }

  // 3. Parse Article ID from params
  const articleId = parseInt(params.article_id || '', 10);
  if (isNaN(articleId) || articleId <= 0) {
    return errorResponse(400, 'INVALID_ARTICLE_ID', 'Parameter article_id tidak valid.');
  }

  // 4. Parse Options (dryRun defaults to true for safety)
  let isDryRun = true;
  const url = new URL(request.url);
  if (url.searchParams.has('dryRun')) {
    isDryRun = url.searchParams.get('dryRun') !== 'false';
  }

  // Also inspect body if JSON
  if (contentType.includes('application/json')) {
    try {
      const rawText = await request.text();
      if (rawText && rawText.trim()) {
        const body = JSON.parse(rawText);
        if (body.dryRun !== undefined) {
          isDryRun = Boolean(body.dryRun);
        }
      }
    } catch {
      // ignore parse error if URL parameter already present, else 400
    }
  }

  // 5. Execute Canonical Reconciliation
  try {
    const result: ReconcileResult = await reconcileArticleMediaReadiness(db, articleId, {
      dryRun: isDryRun,
      actor: auth.deviceId || 'device_reconciler'
    });

    return successResponse(
      {
        status: 'success',
        data: result
      },
      200
    );
  } catch (err: any) {
    return errorResponse(500, 'RECONCILIATION_ERROR', `Gagal menjalankan rekonsiliasi: ${err.message}`);
  }
};
