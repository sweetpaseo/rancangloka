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

  // Map /media/images/<filename> or /media/<filename> to canonical /media/thumbnails/<filename>
  const mediaMatch = cleanUrl.match(/^(https?:\/\/[^\/]+)?\/media\/(?:images\/)?([^\/\?#]+)$/);
  if (mediaMatch) {
    const origin = mediaMatch[1] || '';
    const filename = mediaMatch[2];
    return `${origin}/media/thumbnails/${filename}`;
  }

  return cleanUrl;
}
