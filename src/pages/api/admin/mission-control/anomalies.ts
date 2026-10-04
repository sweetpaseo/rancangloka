/**
 * RancangLoka Hermes Mission Control — Anomaly Intelligence API Endpoint
 * Milestone: MC-INTEL-1
 * 
 * Strict Invariants:
 * 1. Read-only. GET requests only (405 on POST/PUT/DELETE).
 * 2. Protected by isValidAdminSession authentication (401 on unauthenticated).
 * 3. Media-device firewall enforced (403 on automated media worker tokens).
 * 4. Zero mutations, zero execution authority.
 * 5. Returns canonical anomalies with deterministic Anomaly Intelligence payloads.
 */

import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db.ts';
import { isValidAdminSession } from '../../../../lib/auth.ts';
import {
  getMissionControlSnapshot,
  getAnomaliesSnapshot,
  getAnomalyById,
  deriveAnomalyIntelligence
} from '../../../../lib/mission-control/index.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  // 1. Authenticate Human Admin Session
  if (!isValidAdminSession(request)) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Akses ditolak: Diperlukan sesi autentikasi admin yang valid.'
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      }
    );
  }

  // 2. Media Device Firewall (MC-V2-SEC-1)
  const authHeader = request.headers.get('Authorization') || '';
  const userAgent = request.headers.get('User-Agent') || '';
  if (
    authHeader.includes('MediaDevice') ||
    authHeader.includes('device_ingest') ||
    userAgent.includes('LokaMediaWorker')
  ) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'MEDIA_DEVICE_FIREWALL_BLOCKED',
        message: 'Perangkat ingest dilarang mengakses endpoint intelijen anomali Mission Control.'
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      }
    );
  }

  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;

  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');

    const snapshot = await getMissionControlSnapshot(db, env);

    // If specific anomaly requested by ID
    if (queryId) {
      let anom = await getAnomalyById(db, queryId);
      if (!anom) {
        // Check in active scanned anomalies
        const activeList = snapshot.anomalies?.active_anomalies || [];
        anom = activeList.find((a: any) => a.anomaly_id === queryId) || null;
      }

      if (!anom) {
        return new Response(
          JSON.stringify({
            status: 'error',
            code: 'ANOMALY_NOT_FOUND',
            message: `Anomali dengan ID '${queryId}' tidak ditemukan.`
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, private'
            }
          }
        );
      }

      const intelligence = deriveAnomalyIntelligence(anom, snapshot);
      return new Response(
        JSON.stringify({
          anomaly: anom,
          intelligence
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
    }

    // Default: return full anomalies snapshot with intelligence
    const anomalies = snapshot.anomalies || getAnomaliesSnapshot(snapshot);

    return new Response(JSON.stringify(anomalies), {
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
        code: 'MISSION_CONTROL_ANOMALY_INTELLIGENCE_FAILED',
        message: err?.message || 'Gagal memproses intelijen anomali Mission Control'
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

// Strict Read-Only Mutation Protection
export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: 'Endpoint intelijen anomali bersifat read-only (GET). Mutasi dilarang.'
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        Allow: 'GET'
      }
    }
  );
};

export const PUT = POST;
export const DELETE = POST;
