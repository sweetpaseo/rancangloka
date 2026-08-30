import type { APIRoute } from 'astro';
import { GET as newsGet } from './sitemap-news.xml';

export const GET: APIRoute = async (context) => {
  return newsGet(context);
};
