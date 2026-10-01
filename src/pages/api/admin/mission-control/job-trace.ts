/**
 * RancangLoka Hermes Mission Control — Canonical Job Trace API Endpoint
 * Milestone: HERMES-MC-V2.5
 * 
 * Strict Invariants:
 * 1. Read-only. GET requests only. Non-GET methods return 405 Method Not Allowed.
 * 2. Protected by admin_session middleware authentication (401 Unauthorized for unauthed).
 * 3. Validates task identity: task_id parameter is mandatory.
 * 4. Zero mutation authority, zero execution authority.
 * 5. Returns deterministic chronological Job Trace & Activity Timeline.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { getMissionControlSnapshot } from '../../../../lib/mission-control/index.ts';
import { deriveJobTrace } from '../../../../lib/mission-control/job-trace.ts';

export const ALL: APIRoute = async ({ request, url, locals }) => {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'METHOD_NOT_ALLOWED',
        message: 'Metode HTTP tidak diizinkan. Endpoint ini strictly read-only (hanya GET).'
      }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Allow': 'GET',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      }
    );
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  const taskId = url.searchParams.get('task_id') || url.searchParams.get('taskId') || url.searchParams.get('article_id');

  if (!taskId || !taskId.trim()) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'TASK_ID_REQUIRED',
        message: 'Parameter task_id diperlukan untuk melacak job trace.'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      }
    );
  }

  try {
    const snapshot = await getMissionControlSnapshot(db, env);
    const trace = await deriveJobTrace(taskId.trim(), snapshot, db);

    return new Response(JSON.stringify(trace), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
      }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'MISSION_CONTROL_JOB_TRACE_FAILED',
        message: err?.message || 'Gagal menurunkan canonical job trace'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private'
        }
      }
    );
  }
};
