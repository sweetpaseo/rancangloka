import type { APIRoute } from 'astro';
import { getDb, getAllArticles, getSiteSettings } from '../lib/db';

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export const GET: APIRoute = async ({ params, locals }) => {
  const pageNum = parseInt(params.page || '1', 10);
  const pageSize = 1000;
  const offset = (pageNum - 1) * pageSize;

  const db = await getDb(locals);
  const [articles, settings] = await Promise.all([
    getAllArticles(db, pageSize, offset, 'published'),
    getSiteSettings(db)
  ]);

  const siteUrl = settings.site_url || 'https://rancangloka.com';

  const urls = articles
    .map((a) => {
      const u = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const pub = a.published_at ? new Date(a.published_at).getTime() : 0;
      const effectiveTime = Math.max(u, pub);
      const lastmodTag = effectiveTime > 0 && !isNaN(effectiveTime)
        ? `\n    <lastmod>${new Date(effectiveTime).toISOString()}</lastmod>`
        : '';
      const imageTag = a.featured_image
        ? `\n    <image:image>
      <image:loc>${escapeXml(a.featured_image)}</image:loc>
      <image:title>${escapeXml(a.image_alt || a.title)}</image:title>
    </image:image>`
        : '';

      return `  <url>
    <loc>${siteUrl}/${a.slug}</loc>${lastmodTag}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageTag}
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
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
