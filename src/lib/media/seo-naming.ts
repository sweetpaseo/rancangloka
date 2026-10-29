/**
 * RancangLoka Magazine 2.1 — Media SEO-Friendly Image Naming & Provenance
 * MISSION: RANCANGLOKA_MEDIA_SEO_NAMING_1
 * 
 * Objectives:
 * 1. Human-readable descriptive filenames for NEW editorial images:
 *    [article-topic]-[image-description]-[shortid](-[width])?.[ext]
 *    Example: kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-1200.webp
 * 2. Complete backward compatibility with existing SHA-256 hash filenames.
 * 3. Safe ASCII slugification, collision prevention, length limits.
 * 4. Image Provenance specification supporting third-party tools & manual workflows.
 */

export type ImagePlatform =
  | 'chatgpt'
  | 'gemini'
  | 'seedream'
  | 'qwen'
  | 'leonardo'
  | 'digen'
  | 'manual'
  | 'other';

export interface EditorialImageProvenance {
  readonly platform: ImagePlatform;
  readonly platform_display_name?: string;
  readonly model_name?: string;
  readonly prompt?: string;
  readonly prompt_reference?: string;
  readonly generation_date?: string;
  readonly reviewed_by_human: boolean;
  readonly reviewer?: string;
  readonly notes?: string;
}

export interface SeoImageFilenameOptions {
  articleSlug?: string;
  topic?: string;
  description?: string;
  sha256: string;
  width?: number;
  extension?: string;
  maxLength?: number;
}

export interface ParsedSeoImageFilename {
  readonly originalFilename: string;
  readonly isSeoFormat: boolean;
  readonly slugPart: string;
  readonly shortId: string;
  readonly width?: number;
  readonly extension: string;
  readonly baseWithoutWidth: string;
}

const DEFAULT_MAX_SLUG_LENGTH = 70;
const MAX_TOTAL_FILENAME_LENGTH = 120;

/**
 * Normalizes any text (Indonesian, Unicode, symbols) into a safe lowercase ASCII slug.
 * - Decomposes diacritics/accents
 * - Replaces non-alphanumeric chars with hyphens
 * - Collapses consecutive hyphens
 * - Trims hyphens from ends
 */
export function slugifyDescriptor(text: string, maxLen: number = DEFAULT_MAX_SLUG_LENGTH): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text
    .normalize('NFKD') // Normalize unicode
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace spaces & non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens

  if (cleaned.length > maxLen) {
    // Truncate at last hyphen before limit if possible
    const truncated = cleaned.slice(0, maxLen);
    const lastHyphen = truncated.lastIndexOf('-');
    if (lastHyphen > maxLen / 2) {
      cleaned = truncated.slice(0, lastHyphen);
    } else {
      cleaned = truncated.replace(/-+$/, '');
    }
  }

  return cleaned;
}

/**
 * Computes deterministic short identifier from SHA-256 (default 6 hex characters).
 */
export function computeShortId(sha256: string, length: number = 6): string {
  if (!sha256 || typeof sha256 !== 'string') {
    return '000000'.slice(0, length);
  }
  const clean = sha256.toLowerCase().replace(/[^a-f0-9]/g, '');
  return (clean.length >= length ? clean.slice(0, length) : clean.padEnd(length, '0'));
}

/**
 * Builds an SEO-friendly descriptive image filename:
 * [article-topic]-[image-description]-[shortid](-[width])?.[ext]
 * 
 * Example:
 * kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-1200.webp
 */
export function buildSeoImageFilename(options: SeoImageFilenameOptions): string {
  const ext = (options.extension || 'webp').replace(/^\./, '').toLowerCase();
  const shortId = computeShortId(options.sha256, 6);

  const topicSlug = slugifyDescriptor(options.topic || options.articleSlug || '', 35);
  const descSlug = slugifyDescriptor(options.description || '', 35);

  let slugPart = '';
  if (topicSlug && descSlug) {
    slugPart = `${topicSlug}-${descSlug}`;
  } else if (topicSlug) {
    slugPart = topicSlug;
  } else if (descSlug) {
    slugPart = descSlug;
  } else {
    slugPart = 'editorial-image';
  }

  // Ensure slugPart does not exceed max length
  const maxSlugLen = options.maxLength || DEFAULT_MAX_SLUG_LENGTH;
  if (slugPart.length > maxSlugLen) {
    slugPart = slugifyDescriptor(slugPart, maxSlugLen);
  }

  const widthSuffix = options.width && options.width > 0 ? `-${options.width}` : '';
  const filename = `${slugPart}-${shortId}${widthSuffix}.${ext}`;

  // Hard safety limit check for filesystem/R2
  if (filename.length > MAX_TOTAL_FILENAME_LENGTH) {
    const excess = filename.length - MAX_TOTAL_FILENAME_LENGTH;
    const trimmedSlug = slugifyDescriptor(slugPart, Math.max(10, slugPart.length - excess));
    return `${trimmedSlug}-${shortId}${widthSuffix}.${ext}`;
  }

  return filename;
}

/**
 * Builds responsive derivative filename for a given base SEO filename.
 * Example:
 * kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c.webp ->
 * kusen-aluminium-vs-upvc-jendela-ruang-tamu-a83f2c-480.webp
 */
export function buildResponsiveDerivativeFilename(baseFilename: string, width: number): string {
  if (!baseFilename || !width) return baseFilename;

  const parsed = parseSeoImageFilename(baseFilename);
  if (!parsed.isSeoFormat) {
    // Legacy format e.g. <sha256>.webp
    const extMatch = baseFilename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'webp';
    const baseWithoutExt = baseFilename.replace(/\.[a-zA-Z0-9]+$/, '').replace(/-\d+$/, '');
    return `${baseWithoutExt}-${width}.${ext}`;
  }

  return `${parsed.baseWithoutWidth}-${width}.${parsed.extension}`;
}

/**
 * Parses image filename to detect whether it follows the SEO format or legacy hash format.
 */
export function parseSeoImageFilename(filename: string): ParsedSeoImageFilename {
  const clean = (filename || '').trim();
  const extMatch = clean.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'webp';
  const nameOnly = clean.replace(/\.[a-zA-Z0-9]+$/, '');

  // Check if ending in -<width> where width is 3-4 digits (e.g. -480, -1200)
  const widthMatch = nameOnly.match(/-(\d{3,4})$/);
  let width: number | undefined = undefined;
  let withoutWidth = nameOnly;

  if (widthMatch) {
    width = parseInt(widthMatch[1], 10);
    withoutWidth = nameOnly.slice(0, -widthMatch[0].length);
  }

  // Check for shortId at the end of withoutWidth: -([a-f0-9]{6})$
  const shortIdMatch = withoutWidth.match(/-([a-f0-9]{6})$/i);
  if (shortIdMatch) {
    const shortId = shortIdMatch[1].toLowerCase();
    const slugPart = withoutWidth.slice(0, -shortIdMatch[0].length);
    return {
      originalFilename: clean,
      isSeoFormat: true,
      slugPart,
      shortId,
      width,
      extension: ext,
      baseWithoutWidth: withoutWidth
    };
  }

  // Legacy or non-SEO format (e.g. 64-char sha256 hash or simple name)
  return {
    originalFilename: clean,
    isSeoFormat: false,
    slugPart: withoutWidth,
    shortId: withoutWidth.length >= 6 ? withoutWidth.slice(0, 6) : withoutWidth,
    width,
    extension: ext,
    baseWithoutWidth: withoutWidth
  };
}

/**
 * Normalizes and validates Image Provenance metadata.
 * Does not invent provider provenance when unknown.
 */
export function normalizeImageProvenance(raw: unknown): EditorialImageProvenance {
  if (!raw || typeof raw !== 'object') {
    return {
      platform: 'manual',
      platform_display_name: 'Manual Upload',
      reviewed_by_human: true,
      reviewer: 'Editor'
    };
  }

  const obj = raw as Record<string, any>;

  let platform: ImagePlatform = 'manual';
  const rawPlatform = typeof obj.platform === 'string' ? obj.platform.toLowerCase().trim() : '';

  if (rawPlatform.includes('chatgpt') || rawPlatform.includes('openai') || rawPlatform.includes('dall-e')) {
    platform = 'chatgpt';
  } else if (rawPlatform.includes('gemini') || rawPlatform.includes('banana')) {
    platform = 'gemini';
  } else if (rawPlatform.includes('seedream')) {
    platform = 'seedream';
  } else if (rawPlatform.includes('qwen')) {
    platform = 'qwen';
  } else if (rawPlatform.includes('leonardo')) {
    platform = 'leonardo';
  } else if (rawPlatform.includes('digen')) {
    platform = 'digen';
  } else if (rawPlatform === 'manual') {
    platform = 'manual';
  } else if (rawPlatform.length > 0) {
    platform = 'other';
  }

  const platformDisplayNames: Record<ImagePlatform, string> = {
    chatgpt: 'ChatGPT (OpenAI)',
    gemini: 'Gemini (Google)',
    seedream: 'Seedream',
    qwen: 'Qwen (Alibaba)',
    leonardo: 'Leonardo.ai',
    digen: 'Digen.ai',
    manual: 'Manual Editorial Upload',
    other: obj.platform_display_name || 'Third-Party Provider'
  };

  const modelName = typeof obj.model_name === 'string' && obj.model_name.trim().length > 0
    ? obj.model_name.trim()
    : undefined;

  const prompt = typeof obj.prompt === 'string' && obj.prompt.trim().length > 0
    ? obj.prompt.trim()
    : undefined;

  const promptReference = typeof obj.prompt_reference === 'string' && obj.prompt_reference.trim().length > 0
    ? obj.prompt_reference.trim()
    : undefined;

  let generationDate: string | undefined = undefined;
  if (typeof obj.generation_date === 'string' && obj.generation_date.trim().length > 0) {
    const d = new Date(obj.generation_date);
    if (!isNaN(d.getTime())) {
      generationDate = d.toISOString();
    }
  }

  const reviewedByHuman = obj.reviewed_by_human !== false;
  const reviewer = typeof obj.reviewer === 'string' && obj.reviewer.trim().length > 0
    ? obj.reviewer.trim()
    : (reviewedByHuman ? 'Chief Editor' : undefined);

  return {
    platform,
    platform_display_name: obj.platform_display_name || platformDisplayNames[platform],
    model_name: modelName,
    prompt,
    prompt_reference: promptReference,
    generation_date: generationDate,
    reviewed_by_human: reviewedByHuman,
    reviewer,
    notes: typeof obj.notes === 'string' ? obj.notes.trim() : undefined
  };
}
