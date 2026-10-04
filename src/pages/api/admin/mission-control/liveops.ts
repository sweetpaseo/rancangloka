/**
 * RancangLoka Hermes Mission Control — Live Operations Telemetry API Endpoint
 * Milestone: MC-LIVEOPS-1
 * 
 * Strict Invariants:
 * 1. Read-only. GET requests only. Non-GET methods return 405 Method Not Allowed.
 * 2. Protected by admin_session middleware authentication (401 for unauthenticated).
 * 3. Zero mutation authority, zero execution authority.
 * 4. Returns canonical normalized Live Operations state derived from observable truth.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { getMissionControlSnapshot, getLiveOperationsSnapshot } from '../../../../lib/mission-control/index.ts';

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

  try {
    const snapshot = await getMissionControlSnapshot(db, env);
    const liveOps = getLiveOperationsSnapshot(snapshot);

    const agentId = url.searchParams.get('agent_id') || url.searchParams.get('agentId');
    if (agentId && agentId.trim()) {
      const normalized = agentId.trim();
      const staffOp = liveOps.staff_operations[normalized];
      if (!staffOp) {
        return new Response(
          JSON.stringify({
            status: 'error',
            code: 'STAFF_NOT_FOUND',
            message: `Staff '${normalized}' tidak ditemukan dalam roster aktif.`
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, private',
              'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
            }
          }
        );
      }
      return new Response(JSON.stringify(staffOp), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      });
    }

    return new Response(JSON.stringify(liveOps), {
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
        code: 'MISSION_CONTROL_LIVEOPS_FAILED',
        message: err?.message || 'Gagal memproses snapshot Live Operations'
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
