/**
 * RancangLoka Hermes Mission Control — Department Operations API Endpoint
 * Milestone: HERMES-MC-3
 * 
 * Strict Invariants:
 * 1. Read-only. GET requests only.
 * 2. Protected by admin_session middleware authentication.
 * 3. Machine IDs remain authoritative.
 * 4. Zero mutations, zero execution authority.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { getMissionControlSnapshot, getOrganizationSnapshot } from '../../../../lib/mission-control/index.ts';

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const snapshot = await getMissionControlSnapshot(db, env);
    const org = getOrganizationSnapshot(snapshot);

    return new Response(JSON.stringify(org), {
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
        code: 'MISSION_CONTROL_DEPARTMENTS_FAILED',
        message: err?.message || 'Failed to aggregate department operations state'
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
