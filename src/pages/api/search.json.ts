import type { APIRoute } from 'astro';
import { getDb, getAllArticles } from '../../lib/db.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').toLowerCase().trim();

  if (!query) {
    return new Response(JSON.stringify([]), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        'Cloudflare-CDN-Cache-Control': 'public, max-age=300',
        'Cache-Tag': 'search'
      }
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

  // Content Protection 1A: Whitelist only fields consumed by public UI (SearchModal)
  // Purges internal fields: content_hash, views, key_takeaways, focus_keyword, etc.
  const safeResults = filtered.map((a) => ({
    title: a.title,
    slug: a.slug,
    description: a.description || '',
    category_name: a.category_name || 'Artikel',
    featured_image: a.featured_image || ''
  }));

  return new Response(JSON.stringify(safeResults), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=300',
      'Cache-Tag': 'search'
    }
  });
};
