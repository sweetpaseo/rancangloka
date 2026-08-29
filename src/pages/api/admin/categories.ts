import type { APIRoute } from 'astro';
import { getDb, getAllCategories, insertCategory, deleteCategory, updateCategoryLayout } from '../../../lib/db';
import { slugifyText } from '../../../lib/seo';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const categories = await getAllCategories(db);
  return new Response(JSON.stringify(categories), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const db = await getDb(locals);

    if (body.action === 'delete') {
      const id = parseInt(body.id, 10);
      await deleteCategory(db, id);
      return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    }

    if (body.action === 'update_layout') {
      await updateCategoryLayout(db, body.updates);
      return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    }

    const name = body.name || 'Kategori Baru';
    const slug = body.slug ? slugifyText(body.slug) : slugifyText(name);
    const color_badge = body.color_badge || '#2563eb';
    const description = body.description || '';

    const newCategory = await insertCategory(db, {
      name,
      slug,
      color_badge,
      description
    });

    return new Response(JSON.stringify({ status: 'success', category: newCategory }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};
