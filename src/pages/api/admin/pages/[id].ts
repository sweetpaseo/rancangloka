import type { APIRoute } from 'astro';
import { marked } from 'marked';
import { getDb, updatePage, deletePage } from '../../../../lib/db';
import { slugifyText } from '../../../../lib/seo';

export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (!id || isNaN(id)) {
      return new Response(JSON.stringify({ status: 'error', message: 'ID Halaman tidak valid' }), { status: 400 });
    }

    const body = await request.json();
    const db = await getDb(locals);

    const title = (body.title || '').trim();
    if (!title) {
      return new Response(JSON.stringify({ status: 'error', message: 'Judul halaman wajib diisi' }), { status: 400 });
    }

    const slug = body.slug ? slugifyText(body.slug) : slugifyText(title);
    const contentMd = body.content_md || '';
    const contentHtml = await marked.parse(contentMd);

    const updated = await updatePage(db, id, {
      title,
      slug,
      description: body.description || title,
      content_md: contentMd,
      content_html: contentHtml,
      featured_image: body.featured_image || '',
      template: body.template || 'default',
      status: body.status || 'published'
    });

    if (!updated) {
      return new Response(JSON.stringify({ status: 'error', message: 'Halaman tidak ditemukan' }), { status: 404 });
    }

    return new Response(JSON.stringify({ status: 'success', page: updated }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (!id || isNaN(id)) {
      return new Response(JSON.stringify({ status: 'error', message: 'ID Halaman tidak valid' }), { status: 400 });
    }

    const db = await getDb(locals);
    const success = await deletePage(db, id);

    if (!success) {
      return new Response(JSON.stringify({ status: 'error', message: 'Gagal menghapus halaman' }), { status: 400 });
    }

    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};
