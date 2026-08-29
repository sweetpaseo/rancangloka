import type { APIRoute } from 'astro';
import { getDb, getAllAuthors, insertAuthor, deleteAuthor } from '../../../lib/db';
import { slugifyText } from '../../../lib/seo';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const authors = await getAllAuthors(db);
  return new Response(JSON.stringify(authors), {
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
      await deleteAuthor(db, id);
      return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
    }

    const name = body.name || 'Penulis Baru';
    const slug = body.slug ? slugifyText(body.slug) : slugifyText(name);
    const role = body.role || 'Contributor';
    const bio = body.bio || '';
    const avatar = body.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
    const social_links = JSON.stringify({
      twitter: body.twitter || '',
      linkedin: body.linkedin || '',
      github: body.github || ''
    });

    const newAuthor = await insertAuthor(db, {
      name,
      slug,
      role,
      bio,
      avatar,
      social_links
    });

    return new Response(JSON.stringify({ status: 'success', author: newAuthor }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500 });
  }
};
