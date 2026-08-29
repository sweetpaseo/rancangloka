import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const key = params.key;
    if (!key) {
      return new Response('Not Found', { status: 404 });
    }

    const env = (locals as any).runtime?.env || (globalThis as any).process?.env;
    const bucket = env?.MEDIA_BUCKET;

    if (!bucket || typeof bucket.get !== 'function') {
      return new Response('Media bucket not configured', { status: 500 });
    }

    const object = await bucket.get(key);
    if (!object) {
      return new Response('Image not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/webp');

    return new Response(object.body, {
      status: 200,
      headers
    });
  } catch (err: any) {
    return new Response('Error retrieving media', { status: 500 });
  }
};
