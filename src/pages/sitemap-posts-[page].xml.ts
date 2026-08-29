import type { APIRoute } from 'astro';
import { getDb, getAllArticles, getSiteSettings } from '../lib/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const pageNum = parseInt(params.page || '1', 10);
  const pageSize = 1000;
  const offset = (pageNum - 1) * pageSize;

  const db = await getDb(locals);
  const [articles, settings] = await Promise.all([
    getAllArticles(db, pageSize, offset, 'published'),
    getSiteSettings(db)
  ]);

  const siteUrl = settings.site_url || 'https://magazine.pages.dev';

  const urls = articles
    .map((a) => {
      const lastMod = new Date(a.updated_at || a.published_at || Date.now()).toISOString();
      return `  <url>
    <loc>${siteUrl}/${a.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
