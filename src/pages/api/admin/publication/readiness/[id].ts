import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db.ts';
import {
  evaluateArticleReadiness,
  getArticleReadiness,
  getArticleReadinessHistory
} from '../../../../../lib/publication/service.ts';

export const GET: APIRoute = async ({ params, locals, url }) => {
  try {
    const articleId = parseInt(params.id || '', 10);
    if (isNaN(articleId)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = (await getDb(locals)) || (locals as any)?.db;
    const viewHistory = url.searchParams.get('history') === 'true';

    if (viewHistory) {
      const history = await getArticleReadinessHistory(db, articleId);
      return new Response(JSON.stringify({ status: 'success', articleId, history }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const readiness = await getArticleReadiness(db, articleId);
    return new Response(JSON.stringify({ status: 'success', articleId, readiness }), {
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

export const POST: APIRoute = async ({ params, locals }) => {
  try {
    const articleId = parseInt(params.id || '', 10);
    if (isNaN(articleId)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = (await getDb(locals)) || (locals as any)?.db;
    const snapshot = await evaluateArticleReadiness(db, articleId, { skipCache: true });

    return new Response(JSON.stringify({ status: 'success', articleId, readiness: snapshot }), {
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
