import type { APIRoute } from 'astro';
import { getDb, getAllCategories, getSiteSettings, getCategorySitemapData } from '../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const [categories, settings, catData] = await Promise.all([
    getAllCategories(db),
    getSiteSettings(db),
    getCategorySitemapData(db)
  ]);

  const siteUrl = settings.site_url || 'https://rancangloka.com';
  const homepageMod = catData.latestOverallMod;
  const homepageModTag = homepageMod ? `\n    <lastmod>${homepageMod}</lastmod>` : '';

  const urls = categories
    .map((c) => {
      const catMod = catData.categoryMods.get(c.id);
      const lastmodTag = catMod ? `\n    <lastmod>${catMod}</lastmod>` : '';
      return `  <url>
    <loc>${siteUrl}/category/${c.slug}</loc>${lastmodTag}
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>${homepageModTag}
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=86400',
      'Cache-Tag': 'sitemap'
    }
  });
};
