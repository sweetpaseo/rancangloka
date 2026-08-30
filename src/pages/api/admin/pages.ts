import type { APIRoute } from 'astro';
import { marked } from 'marked';
import { getDb, getAllPages, insertPage } from '../../../lib/db';
import { slugifyText } from '../../../lib/seo';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = await getDb(locals);
    const pages = await getAllPages(db);
    return new Response(JSON.stringify({ status: 'success', pages }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const db = await getDb(locals);

    const title = (body.title || '').trim();
    if (!title) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Judul halaman wajib diisi' }),
        { status: 400 }
      );
    }

    const slug = body.slug ? slugifyText(body.slug) : slugifyText(title);
    const contentMd = body.content_md || '';
    const contentHtml = await marked.parse(contentMd);

    const newPage = await insertPage(db, {
      title,
      slug,
      description: body.description || title,
      content_md: contentMd,
      content_html: contentHtml,
      featured_image: body.featured_image || '',
      template: body.template || 'default',
      status: body.status || 'published'
    });

    return new Response(JSON.stringify({ status: 'success', page: newPage }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};
