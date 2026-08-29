import type { APIRoute } from 'astro';
import { getDb, getAllArticles } from '../../lib/db';

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').toLowerCase().trim();

  if (!query) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = await getDb(locals);
  const articles = await getAllArticles(db, 50, 0, 'published');

  const filtered = articles
    .filter((a) => {
      const titleMatch = a.title.toLowerCase().includes(query);
      const descMatch = (a.description || '').toLowerCase().includes(query);
      const catMatch = (a.category_name || '').toLowerCase().includes(query);
      return titleMatch || descMatch || catMatch;
    })
    .slice(0, 8);

  return new Response(JSON.stringify(filtered), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=300'
    }
  });
};
