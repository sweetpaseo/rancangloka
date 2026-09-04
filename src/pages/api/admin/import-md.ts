import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db.ts';
import { importArticleContent } from '../../../lib/article/pipeline.ts';
import { AppError } from '../../../lib/errors.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const filename = (formData.get('filename') as string) || 'untitled.md';
    const rawContent = (formData.get('content') as string) || '';
    const strategy = (formData.get('strategy') as string) || 'skip'; // 'skip' | 'overwrite' | 'rename'

    if (!rawContent.trim()) {
      return new Response(JSON.stringify({ status: 'error', error: 'File kosong' }), { status: 400 });
    }

    const db = await getDb(locals);

    const result = await importArticleContent(db, rawContent, {
      strategy: strategy as 'skip' | 'overwrite' | 'rename',
      filename
    });

    if (result.status === 'duplicate_skipped') {
      return new Response(
        JSON.stringify({
          status: 'duplicate_skipped',
          reason: result.reason,
          title: result.title,
          slug: result.slug,
          id: result.id
        }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        action: result.action,
        title: result.title,
        slug: result.slug,
        id: result.id,
        category: result.category,
        author: result.author
      }),
      { status: 200 }
    );
  } catch (err: any) {
    const statusCode = err instanceof AppError ? err.statusCode : (err?.statusCode || 500);
    const errorCode = err instanceof AppError ? err.code : (err?.code || 'DATABASE_ERROR');
    return new Response(
      JSON.stringify({
        status: 'error',
        code: errorCode,
        error: err.message || 'Gagal memproses markdown'
      }),
      { status: statusCode }
    );
  }
};
