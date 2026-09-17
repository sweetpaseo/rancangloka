import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import {
  recordEditorialApproval,
  revokeEditorialApproval,
  getArticleApprovalsHistory
} from '../../../../../lib/publication/service.ts';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const articleId = parseInt(params.id || '', 10);
    if (isNaN(articleId)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = (await getDb(locals)) || (locals as any)?.db;
    const history = await getArticleApprovalsHistory(db, articleId);

    return new Response(JSON.stringify({ status: 'success', articleId, history }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const articleId = parseInt(params.id || '', 10);
    if (isNaN(articleId)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed
    }

    const approvedBy = body.approved_by || 'editorial_operator';
    const approvedRole = body.approved_role || 'editor_in_chief';
    const notes = body.notes || null;

    const db = (await getDb(locals)) || (locals as any)?.db;

    const result = await recordEditorialApproval(db, {
      articleId,
      approvedBy,
      approvedRole,
      notes
    });

    return new Response(JSON.stringify({
      status: 'success',
      articleId,
      approval: result.approval,
      readiness: result.snapshot
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    const statusCode = err.message?.includes('ARTICLE_NOT_FOUND') ? 404 : 422;
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  try {
    const articleId = parseInt(params.id || '', 10);
    if (isNaN(articleId)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed
    }

    const revokedBy = body.revoked_by || 'editorial_operator';
    const notes = body.notes || 'Approval revoked';

    const db = (await getDb(locals)) || (locals as any)?.db;

    const result = await revokeEditorialApproval(db, {
      articleId,
      revokedBy,
      notes
    });

    return new Response(JSON.stringify({
      status: 'success',
      articleId,
      revoked: result.revoked,
      readiness: result.snapshot
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    const statusCode = err.message?.includes('ARTICLE_NOT_FOUND') ? 404 : 422;
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
