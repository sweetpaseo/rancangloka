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
  const { id, action, review_notes } = body;

  if (!id || !['approve', 'reject', 'reset'].includes(action)) {
    return new Response(
      JSON.stringify({ status: 'error', message: 'Parameter tidak valid. Diperlukan id dan action (approve|reject|reset)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const targetStatus =
    action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'PENDING_REVIEW';
  
  const updated = updateCandidateStatus(id, targetStatus, {
    actor: 'Chief Editor',
    action,
    notes: review_notes || (action === 'approve' ? 'Disetujui via Inspeksi Visual Batch 1' : action === 'reject' ? 'Ditolak via Inspeksi Visual Batch 1' : 'Status di-reset ke PENDING_REVIEW')
  });

  if (!updated) {
    return new Response(JSON.stringify({ status: 'error', message: `Kandidat gambar dengan ID '${id}' tidak ditemukan` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    status: 'success',
    message: action === 'approve' ? 'Gambar berhasil disetujui' : action === 'reject' ? 'Kandidat gambar ditolak' : 'Status kandidat di-reset ke PENDING_REVIEW',
    candidate: updated
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
