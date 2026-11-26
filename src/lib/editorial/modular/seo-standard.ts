/**
 * RancangLoka — SEO Standard 3.0
 * Official Google Search Central Compliance Engine
 * 
 * Invariants & Official Google Guidelines:
 * 1. Title: Descriptive and concise (<title> element). Avoid keyword stuffing.
 *    (Advisory SERP range ~30–70 chars; not a rigid Google algorithmic penalty).
 * 2. Description: High-quality, accurate page summary.
 *    (Advisory SERP range ~80–160 chars; not a rigid Google algorithmic penalty).
 * 3. Structured Data: Valid Schema.org Article and BreadcrumbList JSON-LD.
 *    NOTE: Google discontinued FAQ rich results on May 7, 2026 (docs removed June 15, 2026).
 *    FAQ schema is optional; FAQ content is preserved as an editorial reader-facing accordion.
 * 4. Google Discover readiness: max-image-preview:large, high-resolution 16:9 responsive images (>= 1200px).
 * 5. Zero-JS performance: SSR semantic HTML only.
 * 6. Owner Editorial Preference: First & last sentence focus keyword placement is an
 *    Owner Editorial Preference, NOT an official Google ranking requirement or failure.
 */

import type {
  ArticleIdentityComponent,
  SeoComponent,
  NarrativeComponent,
  CoverHeroComponent,
  FaqComponent,
  MetadataComponent,
  PublicationScheduleComponent
} from './types.ts';

export interface SeoAuditReport {
  passed: boolean;
  /** Internal heuristic checklist score (0-100). NOTE: This is an internal QA checklist score, NOT an official Google ranking factor or algorithmic score. */
  score: number;
  internal_checklist_score: number;
  title_length: number;
  title_verdict: 'OPTIMAL' | 'TOO_SHORT' | 'TOO_LONG';
  description_length: number;
  description_verdict: 'OPTIMAL' | 'TOO_SHORT' | 'TOO_LONG';
  primary_keyword_in_title: boolean;
  primary_keyword_in_first_sentence: boolean;
  primary_keyword_in_closing: boolean;
  has_canonical_url: boolean;
  discover_ready: boolean;
  discover_details: {
    eligible_for_discover: boolean;
    large_image_recommended: boolean;
  };
  schema_validation: {
    has_article_schema: boolean;
    has_breadcrumb_schema: boolean;
    has_faq_content: boolean;
    has_faq_schema?: boolean;
  };
  owner_editorial_preferences: {
    keyword_in_first_sentence: boolean;
    keyword_in_closing: boolean;
  };
  violations: string[];
  recommendations: string[];
}

export interface StructuredDataBundle {
  article_json_ld: Record<string, any>;
  breadcrumb_json_ld: Record<string, any>;
  faq_json_ld?: Record<string, any>;
  raw_scripts_html: string;
}

/**
 * Audit SEO parameters against RancangLoka SEO Standard 3.0 & Google Search Central Guidelines.
 * 
 * IMPORTANT: Google does NOT prescribe fixed character limits for titles or meta descriptions.
 * This function enforces non-empty descriptive titles and accurate summaries per official Google documentation,
 * without artificial numeric cutoffs (no 40-65, 30-75, 25-90, 120-160, or 80-180 limits).
 */
export function auditSeoStandard3(params: {
  identity: ArticleIdentityComponent;
  seo: SeoComponent;
  narrative?: NarrativeComponent;
  coverHero?: CoverHeroComponent;
  faq?: FaqComponent;
}): SeoAuditReport {
  const violations: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // 1. Title Audit (Official Google Search Central: descriptive, concise, non-empty, avoid keyword stuffing)
  const title = (params.identity?.title || '').trim();
  const titleLen = title.length;
  let titleVerdict: 'OPTIMAL' | 'TOO_SHORT' | 'TOO_LONG' = 'OPTIMAL';

  if (titleLen === 0) {
    titleVerdict = 'TOO_SHORT';
    violations.push('Judul artikel tidak boleh kosong. Google mewajibkan setiap halaman memiliki elemen <title> yang deskriptif.');
    score -= 30;
  } else {
    titleVerdict = 'OPTIMAL';
  }

  // Keyword in title (informational note only, not a mandatory Google ranking factor)
  const kw = (params.seo?.primary_natural_keyword || '').toLowerCase().trim();
  const titleLower = title.toLowerCase();
  const kwInTitle = !kw || titleLower.includes(kw) || 
    kw.split(' ').every(word => word.length < 3 || titleLower.includes(word));

  if (!kwInTitle && kw) {
    recommendations.push(`Disarankan menyertakan primary keyword '${params.seo.primary_natural_keyword}' secara alami di dalam judul jika relevan dengan isi halaman.`);
  }

  // 2. Meta Description Audit (Official Google Search Central: informative, accurate summary, non-empty)
  const desc = (params.seo?.description || '').trim();
  const descLen = desc.length;
  let descVerdict: 'OPTIMAL' | 'TOO_SHORT' | 'TOO_LONG' = 'OPTIMAL';

  if (descLen === 0) {
    descVerdict = 'TOO_SHORT';
    violations.push('Meta deskripsi tidak boleh kosong. Google menyarankan ringkasan akurat yang membantu pencari memahami nilai halaman.');
    score -= 25;
  } else {
    descVerdict = 'OPTIMAL';
  }

  // 3. Owner Editorial Preference: Keyword in First Sentence and Closing Paragraph
  // NOTE: This is an explicit Owner Editorial Preference, NOT an official Google ranking requirement.
  let kwInFirstSentence = false;
  let kwInClosing = false;

  if (params.narrative && kw) {
    const firstP = params.narrative.opening?.paragraphs?.[0] || '';
    const lastP = params.narrative.closing?.paragraphs?.slice(-1)[0] || '';

    // Extract exact first sentence from opening paragraph
    const firstSentenceMatch = firstP.match(/^([^.?!]+[.?!]?)/);
    const firstSentence = (firstSentenceMatch ? firstSentenceMatch[1] : firstP).toLowerCase();

    // Extract exact last sentence from closing paragraph
    const sentences = lastP.split(/[.?!](?:\s+|$)/).map(s => s.trim()).filter(Boolean);
    const lastSentence = (sentences[sentences.length - 1] || lastP).toLowerCase();

    const kwTokens = kw
      .replace(/[()?,.:;"'–-]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2);

    kwInFirstSentence = firstSentence.includes(kw) ||
      (kwTokens.length > 0 && kwTokens.every(tok => firstSentence.includes(tok)));

    kwInClosing = lastSentence.includes(kw) ||
      (kwTokens.length > 0 && kwTokens.every(tok => lastSentence.includes(tok)));

    if (!kwInFirstSentence) {
      recommendations.push(`[Preferensi Editorial Redaksi] Pertimbangkan menyertakan focus keyword '${params.seo.primary_natural_keyword}' secara organik di kalimat pembuka jika sesuai konteks percakapan.`);
    }
    if (!kwInClosing) {
      recommendations.push(`[Preferensi Editorial Redaksi] Pertimbangkan menyebutkan kembali focus keyword secara wajar di kalimat penutup kesimpulan.`);
    }
  }

  // 4. Google Discover: Distinguish Basic Eligibility from Large Image Presentation Recommendation
  // Eligibility: Content is automatically eligible if indexed and compliant with Search Essentials & Discover policies.
  // Presentation Recommendation: Large image (>= 1200px width) with max-image-preview:large setting.
  const hasCoverHero = Boolean(params.coverHero && params.coverHero.public_url.length > 0);
  const largeImageRecommended = Boolean(params.coverHero && params.coverHero.width >= 1200);

  if (hasCoverHero && !largeImageRecommended) {
    recommendations.push(`Untuk tampilan cuplikan gambar besar di Google Discover, disarankan gambar sampul memiliki lebar minimal 1200px dengan deklarasi robots max-image-preview:large.`);
  }

  // 5. Canonical & Schema.org Validation (Google official requirements)
  const slug = params.identity?.canonical_slug || (params.identity as any)?.slug;
  const hasCanonical = Boolean(params.seo?.canonical_url || slug);
  const hasArticleSchema = Boolean(params.identity?.title && slug && params.seo?.description);
  const hasBreadcrumbSchema = Boolean(params.identity?.title && slug);
  const hasFaqContent = Boolean(params.faq && Array.isArray(params.faq.items) && params.faq.items.length >= 3);

  if (!hasCanonical) {
    violations.push('URL kanonikal wajib didefinisikan untuk menyatakan versi utama halaman menurut panduan Google.');
    score -= 20;
  }

  if (!hasArticleSchema) {
    violations.push('Schema.org Article structured data wajib tersedia (memerlukan title, canonical slug, dan description).');
    score -= 20;
  }

  const passed = violations.length === 0;

  return {
    passed,
    score: Math.max(0, score),
    internal_checklist_score: Math.max(0, score),
    title_length: titleLen,
    title_verdict: titleVerdict,
    description_length: descLen,
    description_verdict: descVerdict,
    primary_keyword_in_title: kwInTitle,
    primary_keyword_in_first_sentence: kwInFirstSentence,
    primary_keyword_in_closing: kwInClosing,
    has_canonical_url: hasCanonical,
    discover_ready: hasCoverHero,
    discover_details: {
      eligible_for_discover: true, // Eligible by default when indexed and policy-compliant
      large_image_recommended: largeImageRecommended
    },
    schema_validation: {
      has_article_schema: hasArticleSchema,
      has_breadcrumb_schema: hasBreadcrumbSchema,
      has_faq_content: hasFaqContent,
      has_faq_schema: hasFaqContent
    },
    owner_editorial_preferences: {
      keyword_in_first_sentence: kwInFirstSentence,
      keyword_in_closing: kwInClosing
    },
    violations,
    recommendations,
  };
}

/**
 * Generate Complete Schema.org Structured Data
 */
export function generateStructuredDataStandard3(params: {
  siteUrl: string;
  identity: ArticleIdentityComponent;
  seo: SeoComponent;
  coverHero?: CoverHeroComponent;
  faq?: FaqComponent;
  metadata?: MetadataComponent;
  schedule?: PublicationScheduleComponent;
  authorName?: string;
  authorUrl?: string;
  categorySlug?: string;
  categoryName?: string;
}): StructuredDataBundle {
  const canonicalUrl = `${params.siteUrl}/${params.identity.canonical_slug}`;
  const authorName = params.authorName || 'Tim Redaksi RancangLoka';
  const authorUrl = params.authorUrl || `${params.siteUrl}/author/tim-redaksi`;
  const datePublished = params.schedule?.published_at || new Date().toISOString();
  const dateModified = params.schedule?.published_at || new Date().toISOString();

  // 1. Article Schema
  const articleSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    headline: params.identity.title,
    description: params.seo.description,
    image: params.coverHero ? [
      params.coverHero.public_url,
      // Google recommends 16:9, 4:3, 1:1 image variants for rich snippets
    ] : [],
    datePublished,
    dateModified,
    author: {
      '@type': 'Person',
      name: authorName,
      url: authorUrl,
      jobTitle: 'Arsitek & Editor Spesialis Konstruksi',
    },
    publisher: {
      '@type': 'Organization',
      name: 'RancangLoka',
      url: params.siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${params.siteUrl}/images/rancangloka-logo.png`,
        width: 600,
        height: 60,
      },
    },
  };

  // 2. BreadcrumbList Schema
  const categoryName = params.categoryName || 'Material Bangunan';
  const categorySlug = params.categorySlug || 'material';

  const breadcrumbSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Beranda',
        item: params.siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: categoryName,
        item: `${params.siteUrl}/category/${categorySlug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: params.identity.title,
        item: canonicalUrl,
      },
    ],
  };

  // 3. FAQPage Schema (Supplementary Semantic Metadata)
  // NOTE: Google officially discontinued FAQ rich results on May 7, 2026 (documentation removed June 15, 2026).
  // This markup is retained solely as supplementary semantic metadata and is not an SEO rich result requirement.
  let faqSchema: Record<string, any> | undefined;
  if (params.faq && params.faq.items && params.faq.items.length > 0) {
    faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: params.faq.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    };
  }

  // Combine into raw script HTML tags for direct SSR insertion
  const scripts = [
    `<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`,
    faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : '',
  ].filter(Boolean).join('\n');

  return {
    article_json_ld: articleSchema,
    breadcrumb_json_ld: breadcrumbSchema,
    faq_json_ld: faqSchema,
    raw_scripts_html: scripts,
  };
}
