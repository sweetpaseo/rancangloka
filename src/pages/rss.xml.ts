import type { APIRoute } from 'astro';
import { getDb, getAllArticles, getSiteSettings } from '../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const [articles, settings] = await Promise.all([
    getAllArticles(db, 30, 0, 'published'),
    getSiteSettings(db)
  ]);

  const siteUrl = settings.site_url || 'https://magazine.pages.dev';
  const siteTitle = settings.site_title || 'Metro Magazine';
  const siteDesc = settings.site_description || 'Platform media digital masa depan.';

  const items = articles
    .map((a) => {
      const pubDate = new Date(a.published_at).toUTCString();
      return `    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${siteUrl}/${a.slug}</link>
      <guid isPermaLink="true">${siteUrl}/${a.slug}</guid>
      <description><![CDATA[${a.description}]]></description>
      <category><![CDATA[${a.category_name || 'Berita'}]]></category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteTitle}</title>
    <link>${siteUrl}</link>
    <description>${siteDesc}</description>
    <language>id</language>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=1800, s-maxage=7200'
    }
  });
};
