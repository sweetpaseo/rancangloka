import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals, request }) => {
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

    // 3.1 Private namespace firewall - masters, site watermarks, and internal storage
    const normalizedLower = trimmedKey.toLowerCase().replace(/^media\//, '');
    const isPrivateNamespace =
      normalizedLower.startsWith('site/') ||
      normalizedLower.startsWith('originals/') ||
      normalizedLower.startsWith('masters/') ||
      normalizedLower.startsWith('private/');

    if (isPrivateNamespace) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store, private'
        }
      });
    }

    // 3.2 Hotlink protection & scraper defense
    const referer = request?.headers?.get('referer');
    if (referer) {
      try {
        const refUrl = new URL(referer);
        const refHost = refUrl.hostname.toLowerCase();
        const currentHost = request ? new URL(request.url).hostname.toLowerCase() : 'localhost';

        const isAllowedOrigin =
          refHost === currentHost ||
          refHost === 'localhost' ||
          refHost === '127.0.0.1' ||
          refHost.endsWith('.rancangloka.com') ||
          refHost === 'rancangloka.com' ||
          // Major search engines (Google Images, Bing, DuckDuckGo)
          refHost.endsWith('.google.com') ||
          refHost === 'google.com' ||
          refHost.endsWith('.googleusercontent.com') ||
          refHost.endsWith('.bing.com') ||
          refHost === 'bing.com' ||
          refHost.endsWith('.duckduckgo.com') ||
          refHost === 'duckduckgo.com' ||
          refHost.endsWith('.yandex.com') ||
          refHost === 'yandex.com' ||
          // Legitimate social & messaging platforms preview
          refHost.endsWith('.facebook.com') ||
          refHost.endsWith('.twitter.com') ||
          refHost === 't.co' ||
          refHost.endsWith('.x.com') ||
          refHost.endsWith('.pinterest.com') ||
          refHost.endsWith('.linkedin.com') ||
          refHost.endsWith('.whatsapp.com') ||
          refHost.endsWith('.telegram.org');

        if (!isAllowedOrigin) {
          return new Response('Forbidden - Hotlinking is not allowed', {
            status: 403,
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'no-store, private'
            }
          });
        }
      } catch {
        // Malformed referer - ignore and proceed
      }
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
    let isThumbnailFallback = false;
    if (!object && (exactKey.startsWith('thumbnails/') || exactKey.startsWith('media/thumbnails/'))) {
      const originalSubpath = exactKey.replace(/^(media\/)?thumbnails\//, '');
      const rawBase = originalSubpath.replace(/\.(jpe?g|png|webp)$/i, '');
      const candidateNames = Array.from(new Set([
        originalSubpath,
        `${rawBase}.webp`,
        `${rawBase}.jpg`,
        `${rawBase}.jpeg`,
        `${rawBase}.png`
      ]));

      const candidates: string[] = [];
      for (const name of candidateNames) {
        candidates.push(
          `images/${name}`,
          `media/images/${name}`,
          name,
          `media/${name}`
        );
      }

      for (const cand of candidates) {
        object = await bucket.get(cand);
        if (object) {
          exactKey = cand;
          isThumbnailFallback = true;
          break;
        }
      }
    }

    // Graceful fallback for responsive width derivatives: if specific *-480.webp, *-640.webp, *-960.webp
    // is requested on R2 but not yet present, fall back to the canonical full-size .webp image.
    let isDerivativeFallback = false;
    if (!object && /-(?:480|640|960)\.webp$/i.test(exactKey)) {
      const canonicalKey = exactKey.replace(/-(?:480|640|960)\.webp$/i, '.webp');
      object = await bucket.get(canonicalKey);
      if (object) {
        exactKey = canonicalKey;
        isDerivativeFallback = true;
      }
    }

    if (!object) {
      return new Response('Image not found', { status: 404 });
    }

    const headers = new Headers();
    try {
      if (typeof object.writeHttpMetadata === 'function') {
        object.writeHttpMetadata(headers);
      }
    } catch {
      // Miniflare RPC proxy throws DevalueError when passing Headers instances.
      // Fallback to reading object.httpMetadata directly.
      if (object.httpMetadata?.contentType) {
        headers.set('content-type', object.httpMetadata.contentType);
      }
    }
    if (object.httpEtag) {
      headers.set('etag', object.httpEtag);
    }
    if (isThumbnailFallback || isDerivativeFallback) {
      // DERIVATIVE MISS WITH ORIGINAL FALLBACK:
      // MUST NOT use one-year immutable caching under derivative URL to prevent cache poisoning.
      // Use no-cache, must-revalidate so clients revalidate once the derivative is uploaded.
      headers.set('Cache-Control', 'no-cache, must-revalidate');
      headers.set('X-RL-Derivative-Fallback', 'true');
    } else {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

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

export const HEAD: APIRoute = async (context) => {
  const res = await GET(context);
  return new Response(null, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers
  });
};

