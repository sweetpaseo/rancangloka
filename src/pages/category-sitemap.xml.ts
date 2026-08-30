import type { APIRoute } from 'astro';
import { GET as categoryGet } from './sitemap-categories.xml';

export const GET: APIRoute = async (context) => {
  return categoryGet(context);
};
