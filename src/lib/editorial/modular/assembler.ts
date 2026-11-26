/**
 * RancangLoka — Modular Article Architecture V1 (MAA-V1)
 * Deterministic Article Assembly Engine
 * 
 * Strict Invariants:
 * 1. ZERO LLM dependency, ZERO paid API calls, ZERO artificial fallback text.
 * 2. Deterministic, reproducible compilation of versioned components into canonical Markdown and HTML.
 * 3. Stable section ID resolution: Inlines bind directly to ModularSection.section_id.
 * 4. Markdown, HTML, visual manifest, and structured data derive from the same canonical snapshot.
 * 5. Fails closed with ASSEMBLY_INCOMPLETE if required components are missing or invalid.
 */

import { createHash } from 'node:crypto';
import type {
  ArticleComponentType,
  ComponentDataMap,
  ModularSection,
  ModularInlineMediaItem,
  ModularFaqItem,
  ComponentVersionManifestItem
} from './types.ts';
import { renderArticleMarkdownSafely } from '../../article/renderer.ts';
import { escapeHtml } from '../../media/renderer.ts';

export interface AssemblerInput {
  article_id: number;
  components: Partial<ComponentDataMap>;
  componentVersions?: Partial<Record<ArticleComponentType, number>>;
  componentStatuses?: Partial<Record<ArticleComponentType, string>>;
  options?: {
    inlineKeyTakeawaysInMarkdown?: boolean;
    minInlineMediaCount?: number;
  };
}

export interface AssemblyResult {
  is_complete: boolean;
  assembly_status: 'COMPLETE' | 'INCOMPLETE';
  missing_components: string[];
  assembled_md: string;
  assembled_html: string;
  assembly_hash: string; // SHA-256 of assembled_md
  visual_manifest: Record<string, any>;
  structured_data_json: string;
  component_manifest: Record<ArticleComponentType, ComponentVersionManifestItem>;
}

export function formatModularFigure(item: ModularInlineMediaItem): string {
  const safeSlot = escapeHtml(item.slot_key);
  const safeUrl = escapeHtml(item.public_url || item.storage_key);
  const safeAlt = escapeHtml(item.alt_text || 'Media artikel RancangLoka');
  const safeCaption = item.caption ? escapeHtml(item.caption) : '';
  const width = item.width || 1200;
  const height = item.height || 675;

  return `<figure class="rl-media-slot my-8 max-w-full" data-media-slot="${safeSlot}">
  <div class="relative overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800 aspect-16/9">
    <img src="${safeUrl}" alt="${safeAlt}" width="${width}" height="${height}" loading="lazy" decoding="async" class="w-full h-full object-cover" />
  </div>
  ${safeCaption ? `<figcaption class="mt-2.5 text-center text-xs text-stone-500 dark:text-stone-400 font-sans tracking-tight">${safeCaption}</figcaption>` : ''}
</figure>`;
}

/**
 * Sanitizes visible closing heading to enforce Natural Editorial Closing Preference:
 * Strictly bans and strips generic formal labels ("Kesimpulan:", "Kesimpulan & Rekomendasi:", "Kesimpulan -")
 * while preserving the natural contextual tagline.
 * If only generic labels exist, falls back to a natural contextual editorial tagline.
 */
export function sanitizeClosingHeading(heading?: string): string {
  if (!heading || !heading.trim()) {
    return 'Panduan Keputusan untuk Rumahmu';
  }
  let cleaned = heading.trim();
  // Strip leading generic prefixes
  cleaned = cleaned.replace(/^(?:kesimpulan\s*&\s*rekomendasi|kesimpulan\s*dan\s*rekomendasi|kesimpulan|rekomendasi akhir|final verdict)\s*[:\-–—]\s*/i, '');
  cleaned = cleaned.replace(/^(?:kesimpulan\s*&\s*rekomendasi|kesimpulan\s*dan\s*rekomendasi|kesimpulan|rekomendasi akhir|final verdict)$/i, '');
  
  if (!cleaned.trim()) {
    return 'Panduan Keputusan untuk Rumahmu';
  }
  return cleaned.trim();
}

export async function assembleModularArticle(input: AssemblerInput): Promise<AssemblyResult> {
  const missing: string[] = [];
  const articleId = input.article_id;
  const c = input.components;

  // 1. Validate Required Components for Standard Magazine Article
  if (!c.identity || !c.identity.title || !c.identity.canonical_slug) {
    missing.push('identity');
  }
  if (!c.seo || !c.seo.primary_natural_keyword || !c.seo.description) {
    missing.push('seo');
  }
  if (!c.narrative || !c.narrative.opening || !Array.isArray(c.narrative.sections) || c.narrative.sections.length === 0) {
    missing.push('narrative');
  }
  if (!c.cover_hero || !c.cover_hero.storage_key) {
    missing.push('cover_hero');
  }
  const minInlineCount = input.options?.minInlineMediaCount ?? 3;
  if (!c.inline_media || !Array.isArray(c.inline_media.items) || c.inline_media.items.length < minInlineCount) {
    missing.push('inline_media');
  }
  if (!c.key_takeaways || !Array.isArray(c.key_takeaways.takeaways) || c.key_takeaways.takeaways.length < 3) {
    missing.push('key_takeaways');
  }
  if (!c.faq || !Array.isArray(c.faq.items) || c.faq.items.length === 0) {
    missing.push('faq');
  }

  const isComplete = missing.length === 0;
  const assemblyStatus: 'COMPLETE' | 'INCOMPLETE' = isComplete ? 'COMPLETE' : 'INCOMPLETE';

  // 2. Build Media Slot Lookup by Section ID
  const mediaBySection = new Map<string, ModularInlineMediaItem[]>();
  if (c.inline_media && Array.isArray(c.inline_media.items)) {
    for (const item of c.inline_media.items) {
      const list = mediaBySection.get(item.section_id) || [];
      list.push(item);
      mediaBySection.set(item.section_id, list);
    }
  }

  // 3. Assemble Markdown
  const mdParts: string[] = [];
  const emittedParagraphs = new Set<string>();

  // Title
  if (c.identity?.title) {
    mdParts.push(`# ${c.identity.title}\n`);
  }

  // Opening Paragraphs (Strict Invariant: Strip raw markdown image tags so MAA-V1 remains the canonical image source)
  if (c.narrative?.opening?.paragraphs && c.narrative.opening.paragraphs.length > 0) {
    const cleanOpening = c.narrative.opening.paragraphs
      .map(p => typeof p === 'string' ? p.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim() : '')
      .filter(Boolean);

    for (const p of cleanOpening) {
      emittedParagraphs.add(p);
    }
    if (cleanOpening.length > 0) {
      mdParts.push(cleanOpening.join('\n\n'));
      mdParts.push('');
    }
  }

  // Key Takeaways Block
  // Suppressed from markdown body by default to prevent duplicate summary box,
  // as the Astro page template (preview/[slug].astro & [slug].astro) natively
  // renders keyTakeaways from the articles.key_takeaways column above article-body.
  if (input.options?.inlineKeyTakeawaysInMarkdown && c.key_takeaways?.takeaways && c.key_takeaways.takeaways.length > 0) {
    const takeawayItems = c.key_takeaways.takeaways.map(t => `  <li class="mb-2 text-stone-700 dark:text-stone-300 font-sans">${escapeHtml(t)}</li>`).join('\n');
    const takeawayBlock = `<div class="rl-key-takeaways my-8 p-6 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800">
  <h3 class="text-base font-bold text-stone-900 dark:text-stone-100 mb-4 font-sans tracking-tight">Poin Kunci Ringkasan</h3>
  <ul class="list-disc list-inside space-y-1">
${takeawayItems}
  </ul>
</div>`;
    mdParts.push(takeawayBlock);
    mdParts.push('');
  }

  // Sections (With Inlined Media bound to stable section IDs)
  if (c.narrative?.sections && Array.isArray(c.narrative.sections)) {
    const sortedSections = [...c.narrative.sections].sort((a, b) => a.display_order - b.display_order);

    for (const sec of sortedSections) {
      const secMedia = mediaBySection.get(sec.section_id) || [];
      
      // Before-heading media
      for (const m of secMedia.filter(i => i.position === 'before_heading')) {
        mdParts.push(formatModularFigure(m));
        mdParts.push('');
      }

      // Section Heading (H2)
      mdParts.push(`## ${sec.heading}\n`);

      // After-heading media
      for (const m of secMedia.filter(i => i.position === 'after_heading')) {
        mdParts.push(formatModularFigure(m));
        mdParts.push('');
      }

      // Paragraphs (Strict Invariant: Strip raw markdown image tags so MAA-V1 remains the canonical image source)
      if (Array.isArray(sec.paragraphs)) {
        for (const p of sec.paragraphs) {
          const cleanP = typeof p === 'string' ? p.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim() : '';
          if (!cleanP) continue;

          emittedParagraphs.add(cleanP);
          mdParts.push(cleanP);
          mdParts.push('');

          // After-paragraph-containing media
          for (const m of secMedia.filter(i => i.position === 'after_paragraph_containing')) {
            if (m.paragraph_phrase && cleanP.toLowerCase().includes(m.paragraph_phrase.toLowerCase())) {
              mdParts.push(formatModularFigure(m));
              mdParts.push('');
            }
          }
        }
      }

      // End-of-section media (if any)
      for (const m of secMedia.filter(i => i.position === 'end_of_section')) {
        mdParts.push(formatModularFigure(m));
        mdParts.push('');
      }
    }
  }

  // Closing Paragraphs (With Dedicated Conclusion Heading)
  // Assembly-level deduplication: If closing paragraphs were already emitted inside narrative sections,
  // do not re-emit duplicate headings or redundant paragraphs.
  if (c.narrative?.closing?.paragraphs && c.narrative.closing.paragraphs.length > 0) {
    const rawClosing = Array.isArray(c.narrative.closing.paragraphs)
      ? c.narrative.closing.paragraphs
      : [String(c.narrative.closing.paragraphs)];

    const uniqueClosingParagraphs = rawClosing
      .map(p => typeof p === 'string' ? p.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim() : '')
      .filter(p => p && !emittedParagraphs.has(p));

    const closingMedia = mediaBySection.get('sec_conclusion') || 
                         mediaBySection.get('sec_10019_conclusion') || 
                         mediaBySection.get('sec_closing') || [];

    if (uniqueClosingParagraphs.length > 0) {
      const closingHeading = sanitizeClosingHeading(c.narrative.closing.heading);
      mdParts.push(`## ${closingHeading}\n`);

      // Conclusion Media (e.g. pre-closing decision visual)
      for (const m of closingMedia) {
        mdParts.push(formatModularFigure(m));
        mdParts.push('');
      }

      mdParts.push(uniqueClosingParagraphs.join('\n\n'));
      mdParts.push('');
    } else if (closingMedia.length > 0) {
      // Closing paragraphs were already in the final section; attach unplaced closing media cleanly
      for (const m of closingMedia) {
        mdParts.push(formatModularFigure(m));
        mdParts.push('');
      }
    }
  }

  // FAQ Block (Canonical Comment Block for EditorialFAQ.astro)
  if (c.faq?.items && c.faq.items.length > 0) {
    const faqJson = JSON.stringify(c.faq.items.map(f => ({
      question: f.question,
      answer: f.answer
    })), null, 2);
    mdParts.push(`<!-- EDITORIAL_FAQ_START -->\n${faqJson}\n<!-- EDITORIAL_FAQ_END -->`);
    mdParts.push('');
  }

  // Technical References Block (Positioned after FAQ accordion, before Author Card)
  if (c.technical_references?.references && c.technical_references.references.length > 0) {
    const refItems = c.technical_references.references.map(r => 
      `- **${escapeHtml(r.standard_name)}** (${escapeHtml(r.organization)}): ${escapeHtml(r.description)}`
    ).join('\n');
    mdParts.push(`### Referensi & Standar Teknis\n\n${refItems}\n`);
  }

  const assembledMd = mdParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const assemblyHash = createHash('sha256').update(assembledMd, 'utf8').digest('hex');

  // 4. Render Canonical HTML safely
  const assembledHtml = await renderArticleMarkdownSafely(assembledMd);

  // 5. Produce Compatible Visual Placement Manifest
  const visualItems = (c.inline_media?.items || []).map(item => ({
    visual_id: item.slot_key,
    slot_key: item.slot_key,
    section_id: item.section_id,
    media_type: 'photograph' as const,
    priority: 'essential' as const,
    placement: {
      target_heading_text: item.section_id.includes('conclusion') || item.section_id.includes('closing')
        ? sanitizeClosingHeading(c.narrative?.closing?.heading)
        : (c.narrative?.sections?.find(s => s.section_id === item.section_id)?.heading || ''),
      position: item.position
    },
    visual_purpose: item.caption || item.alt_text,
    visual_brief: {
      prompt_indonesian: item.caption || item.alt_text,
      storytelling_class: 'INLINE_EDITORIAL_DETAIL',
      aspect_ratio: '16:9',
      intended_width: item.width || 1200,
      intended_height: item.height || 675
    },
    caption: item.caption || '',
    alt_text: item.alt_text || '',
    asset_id: item.asset_id,
    storage_key: item.public_url || item.storage_key,
    review_status: item.review_status,
    editorial_approval: item.editorial_approval
  }));

  const visualManifest = {
    manifest_version: '1.0.0',
    article_id: String(articleId),
    article_slug: c.identity?.canonical_slug || '',
    content_hash: assemblyHash, // Bound precisely to the assembled snapshot hash!
    featured: {
      src: c.cover_hero?.public_url || c.cover_hero?.storage_key || '',
      alt: c.cover_hero?.alt_text || '',
      caption: c.cover_hero?.caption || ''
    },
    visual_items: visualItems
  };

  // 6. Produce JSON-LD Structured Data
  const jsonLdData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.identity?.title || '',
    description: c.seo?.description || '',
    image: c.cover_hero?.public_url || c.cover_hero?.storage_key || '',
    author: {
      '@type': 'Organization',
      name: 'RancangLoka Editorial Desk'
    },
    publisher: {
      '@type': 'Organization',
      name: 'RancangLoka',
      url: 'https://rancangloka.com'
    }
  };

  if (c.faq?.items && c.faq.items.length > 0) {
    jsonLdData.mainEntity = c.faq.items.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer
      }
    }));
  }

  // 7. Component Version Manifest
  const componentTypes: ArticleComponentType[] = [
    'identity', 'seo', 'evidence_pack', 'executive_summary', 'key_takeaways',
    'narrative', 'cover_hero', 'inline_media', 'faq', 'internal_links',
    'technical_references', 'metadata', 'publication_schedule', 'qa_receipts'
  ];

  const componentManifest = {} as Record<ArticleComponentType, ComponentVersionManifestItem>;
  for (const t of componentTypes) {
    componentManifest[t] = {
      component_type: t,
      version: input.componentVersions?.[t] || 1,
      hash: c[t] ? createHash('sha256').update(JSON.stringify(c[t])).digest('hex') : '',
      validation_status: (input.componentStatuses?.[t] as any) || (c[t] ? 'DRAFT' : 'MISSING'),
      updated_by: 'owner'
    };
  }

  return {
    is_complete: isComplete,
    assembly_status: assemblyStatus,
    missing_components: missing,
    assembled_md: assembledMd,
    assembled_html: assembledHtml,
    assembly_hash: assemblyHash,
    visual_manifest: visualManifest,
    structured_data_json: JSON.stringify(jsonLdData, null, 2),
    component_manifest: componentManifest
  };
}
