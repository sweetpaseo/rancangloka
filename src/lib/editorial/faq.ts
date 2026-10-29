/**
 * RancangLoka Magazine 2.1 — Editorial FAQ Module
 * MISSION: RANCANGLOKA_EDITORIAL_FAQ_1
 * 
 * Invariants:
 * - Zero client-side JavaScript dependency.
 * - Semantic native HTML (<details> and <summary>).
 * - Optional per article: renders strictly 0 markup if no approved FAQ is present.
 * - Adheres to Lemon Linen design tokens and Plus Jakarta Sans typography.
 */

export interface EditorialFaqItem {
  question: string;
  answer: string;
}

const FAQ_COMMENT_REGEX = /<!--\s*(?:EDITORIAL_FAQ_START|FAQ_START)\s*-->([\s\S]*?)<!--\s*(?:EDITORIAL_FAQ_END|FAQ_END)\s*-->/i;
const FAQ_COMMENT_REGEX_GLOBAL = /<!--\s*(?:EDITORIAL_FAQ_START|FAQ_START)\s*-->([\s\S]*?)<!--\s*(?:EDITORIAL_FAQ_END|FAQ_END)\s*-->/gi;
const FAQ_JSON_COMMENT_REGEX = /<!--\s*FAQ_JSON:\s*(\[[\s\S]*?\])\s*-->/i;
const FAQ_JSON_COMMENT_REGEX_GLOBAL = /<!--\s*FAQ_JSON:\s*(\[[\s\S]*?\])\s*-->/gi;

// Leaked HTML paragraphs containing raw FAQ JSON (e.g. from markdown parsed without stripping comments)
const LEAKED_RAW_FAQ_HTML_REGEX = /<p>\s*\[\s*\{\s*(?:&quot;|")question(?:&quot;|"):[\s\S]*?\]\s*<\/p>/gi;

// Standalone or orphan FAQ delimiters (e.g. if malformed/unpaired)
const ORPHAN_FAQ_DELIMITERS_REGEX = /<!--\s*(?:EDITORIAL_FAQ_START|FAQ_START|EDITORIAL_FAQ_END|FAQ_END)\s*-->/gi;

/**
 * Extracts and validates editorial FAQ items from an article object or raw markdown/data.
 */
export function extractEditorialFaqs(article: {
  faq?: unknown;
  faqs?: unknown;
  content_md?: string;
  content_html?: string;
} | null | undefined): EditorialFaqItem[] {
  if (!article) return [];

  // 1. Direct explicit faq/faqs property (object array or JSON string)
  const candidateDirect = article.faq ?? article.faqs;
  if (candidateDirect) {
    const parsed = parseFaqPayload(candidateDirect);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  // 2. Embedded comment block in content_md
  if (article.content_md) {
    const commentMatch = article.content_md.match(FAQ_COMMENT_REGEX);
    if (commentMatch && commentMatch[1]) {
      const parsed = parseFaqPayload(commentMatch[1].trim());
      if (parsed.length > 0) return parsed;
    }

    const jsonCommentMatch = article.content_md.match(FAQ_JSON_COMMENT_REGEX);
    if (jsonCommentMatch && jsonCommentMatch[1]) {
      const parsed = parseFaqPayload(jsonCommentMatch[1].trim());
      if (parsed.length > 0) return parsed;
    }
  }

  // 3. Embedded comment block or leaked JSON in content_html fallback
  if (article.content_html) {
    const commentMatch = article.content_html.match(FAQ_COMMENT_REGEX);
    if (commentMatch && commentMatch[1]) {
      const parsed = parseFaqPayload(commentMatch[1].trim());
      if (parsed.length > 0) return parsed;
    }

    const leakedHtmlMatch = article.content_html.match(/<p>\s*(\[\s*\{\s*(?:&quot;|")question(?:&quot;|"):[\s\S]*?\])\s*<\/p>/i);
    if (leakedHtmlMatch && leakedHtmlMatch[1]) {
      // Decode standard HTML entities before parsing
      const unescaped = leakedHtmlMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#10;/g, '\n')
        .replace(/&#13;/g, '\r');
      const parsed = parseFaqPayload(unescaped.trim());
      if (parsed.length > 0) return parsed;
    }
  }

  return [];
}

/**
 * Parses unknown payload into validated EditorialFaqItem[]
 */
export function parseFaqPayload(payload: unknown): EditorialFaqItem[] {
  if (!payload) return [];

  let rawList: unknown = payload;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return [];
    try {
      rawList = JSON.parse(trimmed);
    } catch {
      // Not valid JSON string
      return [];
    }
  }

  if (!Array.isArray(rawList)) {
    return [];
  }

  const items: EditorialFaqItem[] = [];

  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue;
    const q = typeof (entry as any).question === 'string' ? (entry as any).question.trim() : '';
    const a = typeof (entry as any).answer === 'string' ? (entry as any).answer.trim() : '';

    if (q.length > 0 && a.length > 0) {
      items.push({
        question: q,
        answer: a
      });
    }
  }

  return items;
}

/**
 * Strips raw FAQ comment markers and leaked raw FAQ JSON from markdown or HTML content
 * so it never leaks into the rendered body or creates duplicate output.
 */
export function stripFaqCommentMarkers(content: string): string {
  if (!content) return '';
  return content
    .replace(FAQ_COMMENT_REGEX_GLOBAL, '')
    .replace(FAQ_JSON_COMMENT_REGEX_GLOBAL, '')
    .replace(LEAKED_RAW_FAQ_HTML_REGEX, '')
    .replace(ORPHAN_FAQ_DELIMITERS_REGEX, '')
    .trim();
}

/**
 * Editorial Quality Validator for FAQs
 * - Verifies 3–5 recommended questions.
 * - Guards against generic AI filler and empty assertions.
 */
export function validateEditorialFaqQuality(items: EditorialFaqItem[]): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (items.length === 0) {
    return { valid: true, warnings: ['No FAQ items provided (FAQ section will be omitted)'], errors: [] };
  }

  if (items.length < 2) {
    warnings.push('Direkomendasikan minimal 2-3 pertanyaan untuk membentuk FAQ editorial yang komprehensif.');
  } else if (items.length > 6) {
    warnings.push(`Jumlah FAQ (${items.length}) melebihi rekomendasi 3–5 pertanyaan.`);
  }

  const AI_SLOP_PATTERNS = [
    /di era modern ini/i,
    /pada era digital/i,
    /tidak dapat dipungkiri/i,
    /tentu saja/i,
    /sebagai kesimpulan/i,
    /dalam artikel ini kita telah/i
  ];

  items.forEach((item, idx) => {
    if (item.question.length < 10) {
      errors.push(`Pertanyaan #${idx + 1} terlalu singkat ("${item.question}").`);
    }
    if (item.answer.length < 20) {
      errors.push(`Jawaban #${idx + 1} terlalu singkat untuk memberikan nilai editorial.`);
    }
    for (const pattern of AI_SLOP_PATTERNS) {
      if (pattern.test(item.answer) || pattern.test(item.question)) {
        warnings.push(`Pertanyaan/Jawaban #${idx + 1} mengandung indikasi frasa klise AI.`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}
