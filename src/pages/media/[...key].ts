import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const rawKey = params.key;
    if (!rawKey || typeof rawKey !== 'string') {
      return new Response('Not Found', { status: 404 });
    }

    // 1. Single URL decode normalization
    let decodedKey: string;
    try {
      decodedKey = decodeURIComponent(rawKey);
    } catch {
      return new Response('Invalid media path', { status: 400 });
    }

    // 2. Strip any accidental leading or trailing slashes for clean R2 lookup
    const trimmedKey = decodedKey.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!trimmedKey) {
      return new Response('Not Found', { status: 404 });
    }

    // 3. Security firewall - path traversal and forbidden characters
    if (trimmedKey.includes('\0') || trimmedKey.includes('\\')) {
      return new Response('Invalid media path', { status: 400 });
    }

    // Check path segments for traversal
    const segments = trimmedKey.split('/');
    for (const seg of segments) {
      if (seg === '..' || seg === '.') {
        return new Response('Invalid media path', { status: 400 });
      }
    }

    // Double-decoding traversal prevention
    try {
      if (decodedKey.includes('%')) {
        const secondDecode = decodeURIComponent(decodedKey);
        if (secondDecode.includes('..') || secondDecode.includes('\\')) {
          return new Response('Invalid media path', { status: 400 });
        }
      }
    } catch {
      // not double-encoded, ignore
    }

    // Exact canonical key for R2 storage lookup
    let exactKey = trimmedKey;

    const env = (locals as any).runtime?.env || (globalThis as any).process?.env;
    const bucket = env?.MEDIA_BUCKET;

    if (!bucket || typeof bucket.get !== 'function') {
      return new Response('Media bucket not configured', { status: 500 });
    }

    let object = await bucket.get(exactKey);
    // If not found and key does not start with 'media/', also try with 'media/' prefix
    // (supports both /media/<storage_key> and /media/<subpath> style mounts)
    if (!object && !exactKey.startsWith('media/')) {
      const fallbackKey = `media/${exactKey}`;
      object = await bucket.get(fallbackKey);
      if (object) {
        exactKey = fallbackKey;
      }
    }

    // Graceful fallback for thumbnail derivatives: if specific thumbnail asset is not yet in R2,
    // seamlessly fall back to looking up the original cover asset so images never break during transition.
    if (!object && (exactKey.startsWith('thumbnails/') || exactKey.startsWith('media/thumbnails/'))) {
      const originalSubpath = exactKey.replace(/^(media\/)?thumbnails\//, '');
      const candidates = [
        `images/${originalSubpath}`,
        `media/images/${originalSubpath}`,
        originalSubpath,
        `media/${originalSubpath}`
      ];
      for (const cand of candidates) {
        object = await bucket.get(cand);
        if (object) {
          exactKey = cand;
          break;
        }
      }
    }

    if (!object) {
      return new Response('Image not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    // Content-Type fallback based on key extension if metadata is missing
    let contentType = object.httpMetadata?.contentType;
    if (!contentType) {
      const lower = exactKey.toLowerCase();
      if (lower.endsWith('.png')) {
        contentType = 'image/png';
      } else if (lower.endsWith('.webp')) {
        contentType = 'image/webp';
      } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else {
        contentType = 'image/webp';
      }
    }
    headers.set('Content-Type', contentType);

    return new Response(object.body, {
      status: 200,
      headers
    });
  } catch (err: any) {
    return new Response('Error retrieving media', { status: 500 });
  }
};
