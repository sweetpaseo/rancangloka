import type { APIRoute } from 'astro';
import { getDb, getSiteSettings, getTotalArticlesCount } from '../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const [settings, totalArticles] = await Promise.all([
    getSiteSettings(db),
    getTotalArticlesCount(db, 'published')
  ]);

  const siteUrl = settings.site_url || 'https://rancangloka.com';
  const now = new Date().toISOString();
  const pageSize = 1000;
  const totalPostPages = Math.max(1, Math.ceil(totalArticles / pageSize));

  // Generate dynamic post sitemap entries (Rank Math pagination style)
  let postSitemapsXml = '';
  if (totalPostPages === 1) {
    postSitemapsXml = `  <sitemap>
    <loc>${siteUrl}/post-sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`;
  } else {
    for (let page = 1; page <= totalPostPages; page++) {
      postSitemapsXml += `  <sitemap>
    <loc>${siteUrl}/sitemap-posts-${page}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>\n`;
    }
  }

  // Generate Rank Math Style Master Sitemap Index with XSLT Stylesheet
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/main-sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${postSitemapsXml}
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
