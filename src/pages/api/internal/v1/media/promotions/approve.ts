import type { APIRoute } from 'astro';

/**
 * Authority Separation Guard:
 * POST /api/internal/v1/media/promotions/approve
 *
 * Media-device credentials alone MUST NOT be able to self-approve promotion requests.
 * Approval authority is strictly reserved for authenticated Human Admin operators.
 * This endpoint fails closed with 403 HUMAN_ADMIN_APPROVAL_REQUIRED.
 */
export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'error',
      code: 'HUMAN_ADMIN_APPROVAL_REQUIRED',
      message: 'Media device credentials cannot self-approve promotions. Human Admin authority via RancangLoka Admin is strictly required.'
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    }
  );
};

export const ALL: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: 'Metode tidak diizinkan.'
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    }
  );
};
