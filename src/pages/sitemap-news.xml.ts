import type { APIRoute } from 'astro';
import { getDb, getAllArticles, getSiteSettings } from '../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const [articles, settings] = await Promise.all([
    getAllArticles(db, 50, 0, 'published'),
    getSiteSettings(db)
  ]);

  const siteUrl = settings.site_url || 'https://magazine.pages.dev';
  const siteTitle = settings.site_title || 'Metro Magazine';

  // Filter articles published in the last 48 hours for Google News
  const fortyEightHoursAgo = Date.now() - 48 * 3600 * 1000;
  const recentArticles = articles.filter(
    (a) => new Date(a.published_at).getTime() >= fortyEightHoursAgo
  );

  const targetArticles = recentArticles.length > 0 ? recentArticles : articles.slice(0, 10);

  const urls = targetArticles
    .map((a) => {
      const pubDate = new Date(a.published_at).toISOString();
      return `  <url>
    <loc>${siteUrl}/${a.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>${siteTitle}</news:name>
        <news:language>id</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title><![CDATA[${a.title}]]></news:title>
    </news:news>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=600, s-maxage=3600'
    }
  });
};
