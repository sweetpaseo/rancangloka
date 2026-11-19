import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, private'
    }
  });
};
