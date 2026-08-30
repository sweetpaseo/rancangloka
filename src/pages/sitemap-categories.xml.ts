import type { APIRoute } from 'astro';
import { getDb, getAllCategories, getSiteSettings } from '../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const [categories, settings] = await Promise.all([
    getAllCategories(db),
    getSiteSettings(db)
  ]);

  const siteUrl = settings.site_url || 'https://rancangloka.com';
  const now = new Date().toISOString();

  const urls = categories
    .map((c) => {
      return `  <url>
    <loc>${siteUrl}/category/${c.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/main-sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
