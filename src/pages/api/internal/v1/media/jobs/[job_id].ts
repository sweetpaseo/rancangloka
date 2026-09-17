/**
 * RancangLoka — Single Media Job Endpoint (MEDIA-1)
 * GET /api/internal/v1/media/jobs/[job_id]
 * PATCH /api/internal/v1/media/jobs/[job_id]
 */

import type { APIRoute } from 'astro';
import { getDb, getRuntimeEnv } from '../../../../../../lib/db.ts';
import { authenticateDeviceRequest } from '../../../../../../lib/media/device-auth.ts';
import {
  getMediaJobById,
  updateMediaJobStatus
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

export const GET: APIRoute = async ({ request, params, locals }) => {
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

  const jobId = params.job_id;
  if (!jobId) {
    return errorResponse(400, 'JOB_ID_REQUIRED', 'Parameter job_id wajib disertakan.');
  }

  try {
    const job = await getMediaJobById(db, jobId);
    if (!job) {
      return errorResponse(404, 'JOB_NOT_FOUND', `Pekerjaan media dengan ID '${jobId}' tidak ditemukan.`);
    }

    return successResponse({
      status: 'success',
      job
    });
  } catch (err: any) {
    return errorResponse(500, 'INTERNAL_ERROR', err.message || 'Gagal mengambil detail pekerjaan media.');
  }
};

export const PATCH: APIRoute = async ({ request, params, locals }) => {
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

  const jobId = params.job_id;
  if (!jobId) {
    return errorResponse(400, 'JOB_ID_REQUIRED', 'Parameter job_id wajib disertakan.');
  }

  try {
    const body = await request.json();
    const newStatus = body.status;
    const errorMessage = body.error_message;

    if (!newStatus) {
      return errorResponse(400, 'STATUS_REQUIRED', 'Field status wajib disertakan dalam request body.');
    }

    const updatedJob = await updateMediaJobStatus(db, jobId, newStatus, errorMessage);

    return successResponse({
      status: 'success',
      job: updatedJob
    });
  } catch (err: any) {
    if (err.message?.includes('tidak ditemukan')) {
      return errorResponse(404, 'JOB_NOT_FOUND', err.message);
    }
    return errorResponse(400, 'UPDATE_FAILED', err.message || 'Gagal memperbarui status pekerjaan media.');
  }
};
