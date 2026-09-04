/**
 * RancangLoka Canonical Article Contract Validator
 * Phase 1B Implementation
 *
 * Single source of truth for article validation across CLI, admin importer,
 * and future Hermes machine ingestion.
 */

import { parseArticleMarkdown } from './parser.ts';

export const BANNED_PLACEHOLDERS = [
  '[EVIDENCE NEEDED]',
  'TODO',
  '[INSERT IMAGE]',
  'Lorem ipsum',
  'Sebagai model AI'
];

export const WORD_COUNT_MIN = 300;
export const WORD_COUNT_MAX = 5000;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: {
    frontmatter: Record<string, any>;
    markdownBody: string;
    wordCount: number;
    bodyPreview: string;
  };
}

/**
 * Validates article content against the RancangLoka Canonical Production Contract.
 */
export function validateArticle(rawContent: string): ValidationResult {
  const errors: string[] = [];

  if (!rawContent || typeof rawContent !== 'string' || !rawContent.trim()) {
    return { isValid: false, errors: ['File artikel kosong atau tidak berisi konten'] };
  }

  // 1. Frontmatter parsing
  const parsed = parseArticleMarkdown(rawContent);
  if (!parsed.success) {
    return { isValid: false, errors: [parsed.error || 'Frontmatter tidak valid'] };
  }

  const { frontmatter, markdownBody } = parsed;

  // 2. Required scalar fields
  if (!frontmatter.title || typeof frontmatter.title !== 'string' || !frontmatter.title.trim()) {
    errors.push('Field frontmatter "title" wajib diisi (string tidak boleh kosong).');
  }

  if (!frontmatter.description || typeof frontmatter.description !== 'string' || !frontmatter.description.trim()) {
    errors.push('Field frontmatter "description" wajib diisi (string tidak boleh kosong).');
  }

  const categoryVal = frontmatter.category !== undefined && frontmatter.category !== null ? String(frontmatter.category).trim() : '';
  if (!categoryVal) {
    errors.push('Field frontmatter "category" wajib diisi (string nama kategori).');
  }

  const authorVal = frontmatter.author !== undefined && frontmatter.author !== null ? String(frontmatter.author).trim() : '';
  if (!authorVal) {
    errors.push('Field frontmatter "author" wajib diisi (string nama penulis/editorial desk).');
  }

  if (!frontmatter.focus_keyword || typeof frontmatter.focus_keyword !== 'string' || !frontmatter.focus_keyword.trim()) {
    errors.push('Field frontmatter "focus_keyword" wajib diisi (string kata kunci fokus).');
  }

  // 3. key_takeaways (must be list with 3 to 5 non-empty items)
  let takeaways = frontmatter.key_takeaways;
  if (typeof takeaways === 'string') {
    try {
      takeaways = JSON.parse(takeaways);
    } catch {
      // Keep as string if not JSON, will fail Array.isArray below
    }
  }

  if (!Array.isArray(takeaways)) {
    errors.push('Field frontmatter "key_takeaways" wajib berupa list/array dengan 3 hingga 5 butir.');
  } else {
    if (takeaways.length < 3 || takeaways.length > 5) {
      errors.push(`Field "key_takeaways" harus memiliki 3-5 butir ringkasan (saat ini: ${takeaways.length} butir).`);
    }
    takeaways.forEach((item, idx) => {
      if (typeof item !== 'string' || !item.trim()) {
        errors.push(`Butir key_takeaways ke-${idx + 1} tidak boleh kosong.`);
      }
    });
  }

  // 4. featured_image & image_alt
  const hasImage = frontmatter.featured_image && typeof frontmatter.featured_image === 'string' && frontmatter.featured_image.trim();
  if (hasImage) {
    if (!frontmatter.image_alt || typeof frontmatter.image_alt !== 'string' || !frontmatter.image_alt.trim()) {
      errors.push('Field frontmatter "image_alt" wajib diisi saat "featured_image" disediakan.');
    }
  }

  // 5. Markdown body checks
  if (!markdownBody || !markdownBody.trim()) {
    errors.push('Isi (body) artikel Markdown kosong.');
  } else {
    // Check at least one H2 heading
    const hasH2 = /^##\s+.+$/m.test(markdownBody);
    if (!hasH2) {
      errors.push('Isi artikel wajib memiliki minimal satu heading H2 ("## Nama Bagian").');
    }

    // Word count calculation (whitespace-separated words)
    const words = markdownBody.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    if (wordCount < WORD_COUNT_MIN || wordCount > WORD_COUNT_MAX) {
      errors.push(`Jumlah kata artikel (${wordCount} kata) di luar batas wajar (${WORD_COUNT_MIN} - ${WORD_COUNT_MAX} kata).`);
    }

    // Check for banned placeholders across full text
    const fullText = rawContent;
    for (const placeholder of BANNED_PLACEHOLDERS) {
      if (placeholder === 'Lorem ipsum' || placeholder === 'Sebagai model AI') {
        const regex = new RegExp(placeholder, 'i');
        if (regex.test(fullText)) {
          errors.push(`Artikel mengandung token/placeholder terlarang: "${placeholder}".`);
        }
      } else {
        if (fullText.includes(placeholder)) {
          errors.push(`Artikel mengandung token/placeholder terlarang: "${placeholder}".`);
        }
      }
    }

    // Early validation check for dangerous executable elements
    const dangerousPatterns = [
      /<script[\s>]/i,
      /<\/script>/i,
      /<iframe[\s>]/i,
      /javascript:\s*/i,
      /data:text\/html/i,
      /\bon(?:load|error|click|mouseover|mouseenter|focus)\s*=/i
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(rawContent)) {
        errors.push('Artikel mengandung elemen HTML/skrip berbahaya yang tidak diizinkan.');
        break;
      }
    }
  }

  const wordCount = markdownBody ? markdownBody.trim().split(/\s+/).filter(Boolean).length : 0;

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      frontmatter,
      markdownBody,
      bodyPreview: markdownBody ? markdownBody.slice(0, 150) + '...' : '',
      wordCount
    }
  };
}
