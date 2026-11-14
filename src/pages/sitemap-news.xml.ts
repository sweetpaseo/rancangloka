import type { APIRoute } from 'astro';
import { getDb, getEligibleNewsArticles, getSiteSettings } from '../lib/db';
import { isNewsArticleEligible } from '../lib/seo';

export { isNewsArticleEligible };

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const fortyEightHoursAgo = Date.now() - 48 * 3600 * 1000;

  const [targetArticles, settings] = await Promise.all([
    getEligibleNewsArticles(db, fortyEightHoursAgo),
    getSiteSettings(db)
  ]);

  const siteUrl = settings.site_url || 'https://rancangloka.com';
  const siteTitle = settings.site_title || 'RancangLoka';

  const urls = targetArticles
    .map((a) => {
      if (!a.published_at) return '';
      const pubDate = new Date(a.published_at).toISOString();
      const u = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const pub = a.published_at ? new Date(a.published_at).getTime() : 0;
      const lastMod = new Date(Math.max(u, pub)).toISOString();
      return `  <url>
    <loc>${siteUrl}/${a.slug}</loc>
    <lastmod>${lastMod}</lastmod>
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
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=3600',
      'Cache-Tag': 'sitemap'
    }
  });
};
