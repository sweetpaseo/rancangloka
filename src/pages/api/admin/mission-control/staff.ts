/**
 * RancangLoka Hermes Mission Control — Staff Roster API Endpoint
 * Milestone: HERMES-MC-2
 * 
 * Strict Invariants:
 * 1. Read-only. GET requests only.
 * 2. Protected by admin_session middleware authentication.
 * 3. Machine IDs remain canonical; display names are presentation layer only.
 * 4. Zero mutations, zero execution authority.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { getMissionControlSnapshot, getStaffRoster } from '../../../../lib/mission-control/index.ts';

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const snapshot = await getMissionControlSnapshot(db, env);
    const staffRoster = getStaffRoster(snapshot);

    return new Response(JSON.stringify(staffRoster), {
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
        code: 'MISSION_CONTROL_STAFF_ROSTER_FAILED',
        message: err?.message || 'Failed to aggregate Mission Control staff roster'
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
