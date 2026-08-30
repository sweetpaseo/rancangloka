import type { APIRoute } from 'astro';
import { getDb, getAllPages, getSiteSettings } from '../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const [pages, settings] = await Promise.all([
    getAllPages(db, 'published'),
    getSiteSettings(db)
  ]);

  const siteUrl = settings.site_url || 'https://rancangloka.com';

  const urlsXml = pages
    .map((p) => {
      return `  <url>
    <loc>${siteUrl}/${p.slug}</loc>
    <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/main-sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
