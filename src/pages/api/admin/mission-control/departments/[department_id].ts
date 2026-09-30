/**
 * RancangLoka Hermes Mission Control — Single Department State API Endpoint
 * Milestone: HERMES-MC-3
 * 
 * Strict Invariants:
 * 1. Read-only. GET requests only.
 * 2. Protected by admin_session middleware authentication.
 * 3. 404 on invalid department ID.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import { getMissionControlSnapshot, getDepartmentById } from '../../../../../lib/mission-control/index.ts';

export const GET: APIRoute = async ({ params, locals }) => {
  const departmentId = params.department_id;
  if (!departmentId) {
    return new Response(JSON.stringify({ status: 'error', message: 'Missing department ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const snapshot = await getMissionControlSnapshot(db, env);
    const department = getDepartmentById(departmentId, snapshot);

    if (!department) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'DEPARTMENT_NOT_FOUND',
          message: `Department '${departmentId}' not found in registry`
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(JSON.stringify(department), {
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
        code: 'DEPARTMENT_STATE_FAILED',
        message: err?.message || 'Failed to aggregate department operational state'
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
