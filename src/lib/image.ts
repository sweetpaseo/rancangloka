/**
 * Image Processing & Aspect Ratio Utilities (Cover Image Auto-Dimension)
 */

export interface ImageDimension {
  width: number;
  height: number;
  aspectRatio: string;
}

export const MAGAZINE_IMAGE_PRESETS = {
  hero: { width: 1200, height: 675, aspect: '16/9' },
  card: { width: 800, height: 450, aspect: '16/9' },
  thumb: { width: 400, height: 225, aspect: '16/9' },
  square: { width: 400, height: 400, aspect: '1/1' },
  compactThumb: { width: 160, height: 160, aspect: '1/1' }
};

/**
 * Returns optimized image attributes to prevent Cumulative Layout Shift (CLS = 0)
 */
export function getOptimizedImageAttrs(
  src: string,
  alt: string,
  preset: keyof typeof MAGAZINE_IMAGE_PRESETS = 'card',
  isPriority: boolean = false
) {
  const { width, height, aspect } = MAGAZINE_IMAGE_PRESETS[preset];
  return {
    src,
    alt: alt || 'Artikel Magazine',
    width,
    height,
    loading: (isPriority ? 'eager' : 'lazy') as 'eager' | 'lazy',
    fetchpriority: (isPriority ? 'high' : 'auto') as 'high' | 'auto',
    decoding: 'async' as 'async',
    style: `aspect-ratio: ${aspect}; object-fit: cover; object-position: center;`
  };
}

/**
 * Resolves the canonical thumbnail derivative URL for an article featured image.
 * - External Unsplash assets: returns optimized 160x160 query string.
 * - Canonical R2 media assets (/media/images/... or /media/...): maps to canonical /media/thumbnails/...
 * - Fallback: preserves original URL if unmappable or already a thumbnail.
 */
export function getCanonicalThumbnailUrl(url?: string): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const cleanUrl = url.trim();

  // 1. External Unsplash dev/test assets: use 160x160 query transform
  if (cleanUrl.includes('images.unsplash.com')) {
    const base = cleanUrl.split('?')[0];
    return `${base}?w=160&h=160&auto=format&fit=crop&q=80&fm=webp`;
  }

  // 2. Canonical RancangLoka R2 media assets:
  // If already a thumbnail path, return as is
  if (cleanUrl.includes('/media/thumbnails/')) {
    return cleanUrl;
  }

  // Map /media/images/<filename> or /media/<filename> to canonical /media/thumbnails/<basename>.webp
  const mediaMatch = cleanUrl.match(/^(https?:\/\/[^\/]+)?\/media\/(?:images\/)?([^\/\?#]+)$/);
  if (mediaMatch) {
    const origin = mediaMatch[1] || '';
    const filename = mediaMatch[2];
    const canonicalThumbFilename = filename.replace(/\.(jpe?g|png|webp)$/i, '') + '.webp';
    return `${origin}/media/thumbnails/${canonicalThumbFilename}`;
  }

  return cleanUrl;
}

export interface ResponsiveImageAttrs {
  src: string;
  srcset?: string;
  sizes?: string;
  alt: string;
  width: number;
  height: number;
  loading: 'eager' | 'lazy';
  fetchpriority: 'high' | 'auto' | 'low';
  decoding: 'async' | 'sync' | 'auto';
  style: string;
}

/**
 * Set of known local responsive image hashes generated in public/media/images/.
 * Future articles uploaded to R2 without local variants will safely fall back to canonical original src.
 */
export const KNOWN_LOCAL_RESPONSIVE_HASHES = new Set<string>([
  '4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4', // Article C
  'ef702415bb6c84ebc26d9647a282385d241e161f45074287d46db6648bc1af79', // Article 4
  '249e45facdce285adeebabca57721a665d25304cc912217ac4a7d8b2e286a483', // Article 5
  '1f32a58df4c3f5509930920d3989c894811a2f913d3fa1fa9c5015b31f79f4a1', // Article 6
  'a169b140bb7327341e06fa66bc8d8c9735d88691563605a610ae4b22c8c4a93a', // Article 7
  '6bb6bc86a51d2f9d6c382bf24f8d55c709199a0d8e2ee2a4394086435c249a2a', // Article 8
  '445582f6e91cb4576392d47aa286699fb4eb207c2a71be9700eb89781cf1e171', // Article 9
  '132626e2e50f3914a5efb2bc7ecfa17436ea08aa3aa6bb02497fc471ec6b67fc', // Article 10
  '2e821e348c9d8e12996062169ed4f69cc0a6ab07ec142c0884c2a609bbbb42a9',
  '2f14cb3080995f6398c1121bc4b021b7f539f41be80a1f4d4dcdf67b289c6b54',
  '83951f20ef5db99e829378619fe4379ba92569527ec56fec9137d7c6792dc8d6'
]);

/**
 * Derives comprehensive responsive image attributes (srcset, sizes, explicit width/height, aspect-ratio)
 * to eliminate Cumulative Layout Shift (CLS = 0) and minimize mobile transfer payload.
 */
export function getResponsiveImageAttrs(
  url?: string | null,
  alt?: string,
  options: {
    slotType: 'hero-large' | 'hero-stacked' | 'card' | 'article-cover' | 'square' | 'room';
    isPriority?: boolean;
    aspectRatio?: string;
  } = { slotType: 'card' }
): ResponsiveImageAttrs | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const cleanUrl = url.trim();

  // Extract base filename without extension to link to verified local variants
  const mediaMatch = cleanUrl.match(/^\/media\/images\/([a-zA-Z0-9_\-]+)\.webp$/);
  const baseKey = (mediaMatch && KNOWN_LOCAL_RESPONSIVE_HASHES.has(mediaMatch[1])) ? mediaMatch[1] : null;

  let width = 1200;
  let height = 675;
  let aspect = options.aspectRatio || '16/9';
  let srcset: string | undefined = undefined;
  let sizes: string | undefined = undefined;

  if (options.slotType === 'hero-large') {
    aspect = '16/10';
    width = 1200;
    height = 750;
    sizes = '(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 60vw, 720px';
    if (baseKey) {
      srcset = `/media/images/${baseKey}-480.webp 480w, /media/images/${baseKey}-640.webp 640w, /media/images/${baseKey}-960.webp 960w, /media/images/${baseKey}.webp 1200w`;
    } else if (cleanUrl.includes('images.unsplash.com')) {
      const base = cleanUrl.split('?')[0];
      srcset = `${base}?w=480&auto=format&fit=crop&q=80&fm=webp 480w, ${base}?w=640&auto=format&fit=crop&q=80&fm=webp 640w, ${base}?w=960&auto=format&fit=crop&q=80&fm=webp 960w, ${base}?w=1200&auto=format&fit=crop&q=80&fm=webp 1200w`;
    }
  } else if (options.slotType === 'hero-stacked') {
    aspect = '16/9';
    width = 800;
    height = 450;
    sizes = '(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 40vw, 440px';
    if (baseKey) {
      srcset = `/media/images/${baseKey}-480.webp 480w, /media/images/${baseKey}-640.webp 640w, /media/images/${baseKey}-960.webp 960w, /media/images/${baseKey}.webp 1200w`;
    } else if (cleanUrl.includes('images.unsplash.com')) {
      const base = cleanUrl.split('?')[0];
      srcset = `${base}?w=480&auto=format&fit=crop&q=80&fm=webp 480w, ${base}?w=640&auto=format&fit=crop&q=80&fm=webp 640w, ${base}?w=800&auto=format&fit=crop&q=80&fm=webp 800w`;
    }
  } else if (options.slotType === 'article-cover') {
    aspect = '16/9';
    width = 1200;
    height = 675;
    sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1000px';
    if (baseKey) {
      srcset = `/media/images/${baseKey}-480.webp 480w, /media/images/${baseKey}-640.webp 640w, /media/images/${baseKey}-960.webp 960w, /media/images/${baseKey}.webp 1200w`;
    } else if (cleanUrl.includes('images.unsplash.com')) {
      const base = cleanUrl.split('?')[0];
      srcset = `${base}?w=480&auto=format&fit=crop&q=80&fm=webp 480w, ${base}?w=640&auto=format&fit=crop&q=80&fm=webp 640w, ${base}?w=960&auto=format&fit=crop&q=80&fm=webp 960w, ${base}?w=1200&auto=format&fit=crop&q=80&fm=webp 1200w`;
    }
  } else if (options.slotType === 'room') {
    aspect = '3/2';
    width = 480;
    height = 320;
    sizes = '(max-width: 640px) 50vw, 280px';
  } else {
    // Standard Card
    aspect = '16/9';
    width = 640;
    height = 360;
    sizes = '(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 50vw, 360px';
    if (baseKey) {
      srcset = `/media/images/${baseKey}-480.webp 480w, /media/images/${baseKey}-640.webp 640w, /media/images/${baseKey}.webp 1200w`;
    } else if (cleanUrl.includes('images.unsplash.com')) {
      const base = cleanUrl.split('?')[0];
      srcset = `${base}?w=480&auto=format&fit=crop&q=80&fm=webp 480w, ${base}?w=640&auto=format&fit=crop&q=80&fm=webp 640w, ${base}?w=800&auto=format&fit=crop&q=80&fm=webp 800w`;
    }
  }

  return {
    src: cleanUrl,
    srcset,
    sizes,
    alt: alt || 'Artikel RancangLoka',
    width,
    height,
    loading: (options.isPriority ? 'eager' : 'lazy'),
    fetchpriority: (options.isPriority ? 'high' : 'auto'),
    decoding: (options.isPriority ? 'sync' : 'async'),
    style: `aspect-ratio: ${aspect};`
  };
}

