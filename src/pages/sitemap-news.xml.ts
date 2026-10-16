import type { APIRoute } from 'astro';
import { getDb, getAllArticles, getSiteSettings } from '../lib/db';
import { isNewsArticleEligible } from '../lib/seo';

export { isNewsArticleEligible };

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const [articles, settings] = await Promise.all([
    getAllArticles(db, 50, 0, 'published'),
    getSiteSettings(db)
  ]);

  const siteUrl = settings.site_url || 'https://rancangloka.com';
  const siteTitle = settings.site_title || 'RancangLoka';

  // Filter strictly eligible news articles published in the last 48 hours
  const fortyEightHoursAgo = Date.now() - 48 * 3600 * 1000;
  const targetArticles = articles.filter((a) => isNewsArticleEligible(a, fortyEightHoursAgo));

  const urls = targetArticles
    .map((a) => {
      const pubDate = new Date(a.published_at).toISOString();
      const lastMod = new Date(a.updated_at || a.published_at).toISOString();
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
<?xml-stylesheet type="text/xsl" href="/main-sitemap.xsl"?>
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
