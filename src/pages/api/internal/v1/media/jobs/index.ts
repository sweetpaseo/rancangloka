/**
 * RancangLoka — Media Jobs Listing Endpoint (MEDIA-1)
 * GET /api/internal/v1/media/jobs
 * POST /api/internal/v1/media/jobs (Staging queue helper)
 */

import type { APIRoute } from 'astro';
import { getDb, getRuntimeEnv } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import {
  listMediaJobs,
  createMediaJob
} from '../../../../../../lib/media/jobs-service.ts';

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

export const GET: APIRoute = async ({ request, url, locals }) => {
  const env = await getRuntimeEnv(locals);
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  if (!db) {
    return errorResponse(500, 'DATABASE_UNAVAILABLE', 'Koneksi database D1 tidak tersedia.');
  }

  // Authenticate device
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return errorResponse(auth.statusCode || 401, 'AUTHENTICATION_REQUIRED', auth.error || 'Autentikasi perangkat gagal.');
  }

  try {
    const status = url.searchParams.get('status') || undefined;
    const rawArticleId = url.searchParams.get('article_id');
    const articleId = rawArticleId ? parseInt(rawArticleId, 10) : undefined;
    const rawLimit = url.searchParams.get('limit');
    const limit = rawLimit ? parseInt(rawLimit, 10) : 20;

    const jobs = await listMediaJobs(db, { status, articleId, limit });

    return successResponse({
      status: 'success',
      count: jobs.length,
      jobs
    });
  } catch (err: any) {
    return errorResponse(500, 'INTERNAL_ERROR', err.message || 'Gagal mengambil daftar pekerjaan media.');
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = await getRuntimeEnv(locals);
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  if (!db) {
    return errorResponse(500, 'DATABASE_UNAVAILABLE', 'Koneksi database D1 tidak tersedia.');
  }

  // Authenticate device
  const auth = await authenticateDeviceRequest(request, db, env);
  if (!auth.authenticated) {
    return errorResponse(auth.statusCode || 401, 'AUTHENTICATION_REQUIRED', auth.error || 'Autentikasi perangkat gagal.');
  }

  try {
    const body = await request.json();
    if (!body.article_id || !body.article_slug || !body.article_title || !body.prompt || !body.alt_text) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Field article_id, article_slug, article_title, prompt, dan alt_text wajib diisi.');
    }

    const job = await createMediaJob(db, body);
    return successResponse({
      status: 'success',
      job
    });
  } catch (err: any) {
    return errorResponse(400, 'JOB_CREATION_FAILED', err.message || 'Gagal membuat pekerjaan media.');
  }
};
