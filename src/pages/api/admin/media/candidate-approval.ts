import type { APIRoute } from 'astro';
import { ADMIN_COOKIE_NAME, isValidAdminSession } from '../../../../lib/auth.ts';
import {
  updateCandidateStatus,
  loadCandidatesLedger
} from '../../../../lib/media/experimental-storage.ts';

export const GET: APIRoute = async ({ url, cookies, locals }) => {
  const env = (locals as any)?.runtime?.env || (import.meta as any).env || {};
  const sessionCookie = cookies.get(ADMIN_COOKIE_NAME);
  const isAuthenticated = await isValidAdminSession(sessionCookie, env);

  if (!isAuthenticated) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const articleId = url.searchParams.get('article_id');
  const all = loadCandidatesLedger();
  const filtered = articleId ? all.filter((c) => c.article_id === Number(articleId)) : all;

  return new Response(JSON.stringify({ status: 'success', candidates: filtered }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const env = (locals as any)?.runtime?.env || (import.meta as any).env || {};
  const sessionCookie = cookies.get(ADMIN_COOKIE_NAME);
  const isAuthenticated = await isValidAdminSession(sessionCookie, env);

  if (!isAuthenticated) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = await request.json().catch(() => ({}));
  const { id, action } = body;

  if (!id || !['approve', 'reject', 'reset'].includes(action)) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Invalid id or action (approve|reject|reset)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const targetStatus =
    action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'PENDING_REVIEW';
  const updated = updateCandidateStatus(id, targetStatus);

  if (!updated) {
    return new Response(JSON.stringify({ status: 'error', message: 'Candidate not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ status: 'success', candidate: updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
