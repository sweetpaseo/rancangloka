/**
 * RancangLoka Hermes Mission Control — Human Writing Quality Inspection API Endpoint
 * Milestone: EDITORIAL-HUMAN-QUALITY-1
 * 
 * Strict Invariants:
 * 1. Read-only query evaluation. GET requests only (405 on POST/PUT/DELETE).
 * 2. Protected by isValidAdminSession authentication (401 on unauthenticated).
 * 3. Media-device firewall enforced (403 on automated media worker tokens).
 * 4. Zero mutations, zero autonomous publishing authority.
 * 5. Returns deterministic Human Writing Quality evaluation and dimension breakdowns.
 */

import type { APIRoute } from 'astro';
import { getDb, getArticleById } from '../../../../lib/db.ts';
import { isValidAdminSession } from '../../../../lib/auth.ts';
import { evaluateHumanWritingQuality } from '../../../../lib/article/human-quality.ts';

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

export const GET: APIRoute = async ({ request, url, cookies, locals }) => {
  // 1. Authenticate Human Admin Session
  const sessionCookie = cookies?.get('admin_session')?.value || request.headers.get('cookie') || '';
  const env = (locals as any)?.runtime?.env || (globalThis as any).process?.env || {};
  const isAuth = await isValidAdminSession(sessionCookie, env);

  if (!isAuth) {
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

  // 2. Media Device Firewall
  if (isMediaDeviceRequest(request)) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'MEDIA_DEVICE_FIREWALL_BLOCKED',
        message: 'Perangkat ingest media dilarang mengakses gerbang mutu editorial human writing.'
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private'
        }
      }
    );
  }

  const db = (await getDb(locals)) || env.DB || (locals as any)?.db;
  const articleIdParam = url.searchParams.get('article_id') || url.searchParams.get('id');

  if (!articleIdParam || !articleIdParam.trim()) {
    return new Response(
      JSON.stringify({
        status: 'error',
        code: 'ARTICLE_ID_REQUIRED',
        message: 'Parameter article_id diperlukan untuk inspeksi mutu penulisan alami.'
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private'
        }
      }
    );
  }

  try {
    const articleId = parseInt(articleIdParam.trim(), 10);
    if (isNaN(articleId) || articleId <= 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'INVALID_ARTICLE_ID',
          message: 'Format article_id tidak valid.'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private'
          }
        }
      );
    }

    const article = await getArticleById(db, articleId);
    if (!article) {
      return new Response(
        JSON.stringify({
          status: 'error',
          code: 'ARTICLE_NOT_FOUND',
          message: `Artikel #${articleId} tidak ditemukan.`
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

    const attemptCount = parseInt(url.searchParams.get('attempt') || '0', 10) || 0;
    const evaluation = evaluateHumanWritingQuality(article.content_md || '', {
      attemptCount,
      focusKeyword: article.focus_keyword || undefined
    });

    return new Response(
      JSON.stringify({
        status: 'success',
        article_id: article.id,
        slug: article.slug,
        title: article.title,
        evaluation
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
        code: 'HUMAN_QUALITY_EVALUATION_FAILED',
        message: err?.message || 'Gagal mengevaluasi mutu penulisan alami artikel.'
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

export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: 'Endpoint inspeksi mutu bersifat strictly read-only (GET). Mutasi dilarang.'
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
