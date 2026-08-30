import type { APIRoute } from 'astro';
import { GET as postPageGet } from './sitemap-posts-[page].xml';

export const GET: APIRoute = async (context) => {
  return postPageGet({
    ...context,
    params: { ...context.params, page: '1' }
  });
};
