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
  square: { width: 400, height: 400, aspect: '1/1' }
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
