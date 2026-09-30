/**
 * RancangLoka Hermes Mission Control — Canonical Organization API Endpoint
 * Milestone: HERMES-MC-7
 *
 * Strict Invariants:
 * 1. Read-only. GET requests only.
 * 2. Protected by admin session middleware.
 * 3. Returns canonical organization read model (departments, staff, capabilities, rooms, workload, alerts).
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import {
  getMissionControlSnapshot,
  getMissionControlOrganization
} from '../../../../lib/mission-control/index.ts';

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const snapshot = await getMissionControlSnapshot(db, env);
    const organization = getMissionControlOrganization(snapshot);

    return new Response(JSON.stringify(organization), {
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
        code: 'MISSION_CONTROL_ORGANIZATION_FAILED',
        message: err?.message || 'Failed to compile Mission Control organization model'
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
