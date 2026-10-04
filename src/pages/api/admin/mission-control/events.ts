/**
 * RancangLoka Hermes Mission Control — Real-Time Operational Event Feed API
 * Milestone: MC-LIVEOPS-4
 * Route: /api/admin/mission-control/events
 * 
 * Strict Invariants:
 * 1. Read-only event feed. GET requests only (others rejected with 405).
 * 2. Protected by admin_session authentication & media-device firewall (401/403).
 * 3. Supports cursor/revision checks (`?since_revision=...`). Unchanged returns changed=false.
 * 4. Zero mutation authority, zero execution controls.
 * 5. Returns lightweight change envelopes to trigger canonical state reconciliation.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { isValidAdminSession } from '../../../../lib/auth.ts';
import { getRecentOperationalEvents } from '../../../../lib/mission-control/index.ts';

function isMediaDeviceRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization') || '';
  const deviceHeader = request.headers.get('x-lokamedia-device-id');
  const userAgent = request.headers.get('user-agent') || '';
  return Boolean(
    deviceHeader ||
    authHeader.toLowerCase().includes('lkmd_') ||
    authHeader.toLowerCase().includes('media:device') ||
    userAgent.includes('LokaMediaExtension') ||
    userAgent.includes('MediaDevice')
  );
}

export const GET: APIRoute = async ({ url, cookies, locals, request }) => {
  // 1. Media Device Firewall
  if (isMediaDeviceRequest(request)) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'FORBIDDEN_MEDIA_DEVICE',
        message: 'Media devices are strictly forbidden from accessing mission control telemetry.'
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Admin Authentication
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const sessionCookie = cookies.get('admin_session');
  const token = sessionCookie?.value;
  const isAuth = await isValidAdminSession(token, env);

  if (!isAuth) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Admin authentication required to access operational events.'
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const sinceRevision = url.searchParams.get('since_revision');
  const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Math.min(100, Math.max(1, isNaN(limitParam) ? 20 : limitParam));

  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const eventFeed = await getRecentOperationalEvents(db, sinceRevision, limit);

    return new Response(
      JSON.stringify({
        status: 'success',
        ...eventFeed
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'OPERATIONAL_EVENTS_FAILED',
        message: err?.message || 'Failed to aggregate operational events'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: 'Operational event feed is strictly read-only. POST mutations not allowed.'
    }),
    {
      status: 405,
      headers: {
        'Allow': 'GET',
        'Content-Type': 'application/json'
      }
    }
  );
};
