import type { APIRoute } from 'astro';
import {
  getDb,
  getSiteSettings,
  getTotalArticlesCount,
  getPostSitemapPageLastmods,
  getCategorySitemapData,
  getPageSitemapLatestMod,
  getEligibleNewsArticles
} from '../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = await getDb(locals);
  const pageSize = 1000;
  const fortyEightHoursAgo = Date.now() - 48 * 3600 * 1000;

  // Execute efficient parallel queries - zero N+1 database operations
  const [settings, totalArticles, postPages, pageLastmod, categoryData, newsArticles] = await Promise.all([
    getSiteSettings(db),
    getTotalArticlesCount(db, 'published'),
    getPostSitemapPageLastmods(db, pageSize),
    getPageSitemapLatestMod(db),
    getCategorySitemapData(db),
    getEligibleNewsArticles(db, fortyEightHoursAgo)
  ]);

  const siteUrl = settings.site_url || 'https://rancangloka.com';
  const totalPostPages = Math.max(1, Math.ceil(totalArticles / pageSize));

  // 1. Post Sitemaps: Scalable pagination where each page gets its exact chunk lastmod
  let postSitemapsXml = '';
  if (totalPostPages === 1) {
    const p1Mod = postPages[0]?.lastmod;
    const lastmodTag = p1Mod ? `\n    <lastmod>${p1Mod}</lastmod>` : '';
    postSitemapsXml = `  <sitemap>
    <loc>${siteUrl}/post-sitemap.xml</loc>${lastmodTag}
  </sitemap>`;
  } else {
    for (let page = 1; page <= totalPostPages; page++) {
      const pageInfo = postPages.find((p) => p.page === page);
      const pageMod = pageInfo?.lastmod;
      const lastmodTag = pageMod ? `\n    <lastmod>${pageMod}</lastmod>` : '';
      postSitemapsXml += `  <sitemap>
    <loc>${siteUrl}/sitemap-posts-${page}.xml</loc>${lastmodTag}
  </sitemap>\n`;
    }
  }

  // 2. Page Sitemap lastmod
  const pageLastmodTag = pageLastmod ? `\n    <lastmod>${pageLastmod}</lastmod>` : '';

  // 3. Category Sitemap lastmod: Reflects latest categorized content update
  const catLastmod = categoryData.latestOverallMod;
  const catLastmodTag = catLastmod ? `\n    <lastmod>${catLastmod}</lastmod>` : '';

  // 4. News Sitemap lastmod: Reflects active news articles within the 48h window
  const newsDates = newsArticles
    .map((a) => {
      const u = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const pub = a.published_at ? new Date(a.published_at).getTime() : 0;
      return Math.max(u, pub);
    })
    .filter((t) => t > 0 && !isNaN(t));
  const latestNewsMod = newsDates.length > 0 ? new Date(Math.max(...newsDates)).toISOString() : null;
  const newsLastmodTag = latestNewsMod ? `\n    <lastmod>${latestNewsMod}</lastmod>` : '';

  // Generate Master Sitemap Index (Clean Standard XML, Fully Scalable & Content-Driven)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${postSitemapsXml}
  <sitemap>
    <loc>${siteUrl}/page-sitemap.xml</loc>${pageLastmodTag}
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/category-sitemap.xml</loc>${catLastmodTag}
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-news.xml</loc>${newsLastmodTag}
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Cloudflare-CDN-Cache-Control': 'public, max-age=86400',
      'Cache-Tag': 'sitemap'
    }
  });
};
