import type { APIRoute } from 'astro';
import { GET as pageGet } from './sitemap-pages.xml';

export const GET: APIRoute = async (context) => {
  return pageGet(context);
};
