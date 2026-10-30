import type { APIRoute } from 'astro';
import { ADMIN_COOKIE_NAME, isValidAdminSession } from '../../../../lib/auth.ts';
import {
  loadCandidatesLedger
} from '../../../../lib/media/experimental-storage.ts';
import {
  recordSelectionDecision,
  evaluateSlot,
  evaluateArticleMedia,
  getPendingMediaDecisions,
  type SlotDecisionStatus
} from '../../../../lib/media/selection-service.ts';

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
  const wantSummary = url.searchParams.get('summary') === 'true';

  if (wantSummary && articleId) {
    const summary = evaluateArticleMedia(Number(articleId));
    return new Response(JSON.stringify({ status: 'success', summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const all = loadCandidatesLedger();
  const filtered = articleId ? all.filter((c) => c.article_id === Number(articleId)) : all;
  const pending = getPendingMediaDecisions();

  return new Response(JSON.stringify({ status: 'success', candidates: filtered, pending_decisions: pending }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const env = (locals as any)?.runtime?.env || (import.meta as any).env || {};
  const sessionCookie = cookies.get(ADMIN_COOKIE_NAME);
  const isAuthenticated = await isValidAdminSession(sessionCookie, env);

  if (!isAuthenticated) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized: Sesi admin tidak valid.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = await request.json().catch(() => ({}));
  const rawAction = body.action;
  const candidateId = body.candidateId || body.id;
  const articleId = body.articleId ? Number(body.articleId) : body.article_id ? Number(body.article_id) : undefined;
  const slotIdentifier = (body.slotIdentifier || body.slot_identifier || '').trim() as 'hero' | 'S1' | 'S2';
  const notes = body.review_notes || body.notes;

  // Map approve to select for unified semantics
  const action = rawAction === 'approve' ? 'select' : rawAction;

  const validActions = ['select', 'reject', 'reset', 'skip_slot', 'unskip_slot'];
  if (!validActions.includes(action)) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: `Aksi tidak valid: '${rawAction}'. Pilihan: ${validActions.join(', ')}`
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (action === 'skip_slot' || action === 'unskip_slot') {
      if (!articleId || !slotIdentifier) {
        return new Response(
          JSON.stringify({
            status: 'error',
            message: 'Parameter article_id dan slot_identifier wajib untuk aksi skip/unskip slot.'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const result = recordSelectionDecision({
        articleId,
        slotIdentifier,
        action,
        actor: 'Chief Editor',
        notes
      });

      const summary = evaluateArticleMedia(articleId);

      return new Response(
        JSON.stringify({
          status: 'success',
          message: action === 'skip_slot' ? `Slot ${slotIdentifier} berhasil dilewati (opsional).` : `Slot ${slotIdentifier} dikembalikan ke antrean keputusan.`,
          slot: result.slot,
          article_summary: summary
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Candidate-level actions: select, reject, reset
    if (!candidateId) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Parameter candidateId/id wajib.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = recordSelectionDecision({
      candidateId,
      action,
      actor: 'Chief Editor',
      notes
    });

    const candidates = loadCandidatesLedger();
    const updated = candidates.find((c) => c.id === candidateId);
    const targetArtId = updated?.article_id || articleId;
    const summary = targetArtId ? evaluateArticleMedia(targetArtId, candidates) : undefined;

    return new Response(
      JSON.stringify({
        status: 'success',
        message:
          action === 'select'
            ? 'Kandidat terpilih untuk slot artikel'
            : action === 'reject'
            ? 'Kandidat gambar ditolak'
            : 'Pilihan kandidat di-reset ke status tersedia',
        candidate: updated,
        article_summary: summary
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    const isClientError =
      err.message?.includes('CANNOT_SKIP_REQUIRED_SLOT') ||
      err.message?.includes('MISSING_') ||
      err.message?.includes('CANDIDATE_NOT_FOUND');

    return new Response(
      JSON.stringify({
        status: 'error',
        message: err.message || 'Terjadi kesalahan pemrosesan seleksi media.'
      }),
      { status: isClientError ? 400 : 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
