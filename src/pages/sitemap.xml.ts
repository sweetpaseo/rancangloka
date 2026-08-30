import type { APIRoute } from 'astro';
import { getDb, getSiteSettings } from '../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const settings = await getSiteSettings(db);
  const siteUrl = settings.site_url || 'https://rancangloka.com';
  const now = new Date().toISOString();

  // Generate Rank Math Style Sitemap Index with XSLT Stylesheet
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/main-sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/post-sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/page-sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/category-sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-news.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
