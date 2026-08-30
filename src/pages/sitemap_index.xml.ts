import type { APIRoute } from 'astro';
import { GET as sitemapGet } from './sitemap.xml';

export const GET: APIRoute = async (context) => {
  return sitemapGet(context);
};
