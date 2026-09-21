import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import { isValidAdminSession, getAdminSessionFromRequest } from '../../../../../lib/auth.ts';
import { getPublicationOperationsStatus } from '../../../../../lib/publication/operations-status.ts';

/**
 * Operations Status API (Phase 5L10)
 *
 * GET /api/admin/publication/operations/status
 *
 * Provides a read-only snapshot of publication automation operations.
 *
 * Security:
 * - Admin authentication required.
 * - Anonymous forbidden (401).
 * - Media device credentials strictly forbidden (403).
 * - Responses are secret-firewalled (no tokens, passwords, or secrets).
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env;

    // 1. Firewall: Media device tokens strictly forbidden
    const authHeader = request.headers.get('Authorization') || '';
    if (
      authHeader.toLowerCase().includes('lkmd_') ||
      authHeader.toLowerCase().includes('media:device')
    ) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'MEDIA_DEVICE_FORBIDDEN',
          message: 'Media devices are strictly forbidden from accessing operations status.'
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private',
            'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
          }
        }
      );
    }

    // 2. Admin Authentication Check (Defense-in-depth)
    const token = getAdminSessionFromRequest(request);
    const isAdminAuthed = await isValidAdminSession(token, env);
    if (!isAdminAuthed) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required to access operations status.'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private',
            'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
          }
        }
      );
    }

    // 3. Database & Status Resolution
    const db = (await getDb(locals)) || (locals as any)?.db || (locals as any)?.runtime?.env?.DB;
    if (!db) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database binding unavailable.'
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

    const snapshot = await getPublicationOperationsStatus(db);

    return new Response(
      JSON.stringify({
        status: 'success',
        data: snapshot
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
        code: 'INTERNAL_ERROR',
        message: err?.message || 'Failed to retrieve operations status'
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
