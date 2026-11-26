/**
 * RancangLoka — Modular Article Completeness Contract
 * Phase 3 Implementation (Single Source of Truth for Structural Completeness)
 * 
 * Invariants:
 * 1. ZERO SILENT FAILURE: Every expected visual asset MUST be bound and rendered in the assembled HTML.
 * 2. UNIQUE IDENTITY: Every inline figure must have a unique slot_key and unique image URL.
 * 3. NO DOWNGRADING: Structural completeness failure is a hard invariant (BLOCKED), never an advisory warning.
 * 4. DETERMINISTIC AUDIT: Validates both rendered HTML figures and editorial components against approved manifest.
 */

import { isSafeMediaUrl } from '../../media/renderer.ts';
import { extractEditorialFaqs, stripFaqCommentMarkers } from '../faq.ts';

export interface ExpectedMediaItem {
  slot_key: string;
  asset_id?: string | null;
  storage_key: string;
  public_url: string;
  alt_text: string;
  caption?: string;
  target_keywords?: string[];
  preferred_position?: 'after_heading' | 'before_heading' | 'after_paragraph_containing';
}

export interface ExpectedArticleManifest {
  article_id: number;
  canonical_slug: string;
  title: string;
  focus_keyword: string;
  category_id: number;
  cover_image: ExpectedMediaItem;
  inline_images: ExpectedMediaItem[];
  min_key_takeaways?: number; // default 3
  min_faq_items?: number; // default 3
  min_h2_count?: number; // default 3
  min_inline_count?: number; // default 3
}

export interface ArticleCompletenessValidationResult {
  is_complete: boolean;
  status: 'PASS' | 'STRUCTURAL_INTEGRITY_BLOCKED';
  expected_inline_count: number;
  actual_inline_count: number;
  found_slots: string[];
  missing_slots: string[];
  duplicate_slots: string[];
  duplicate_urls: string[];
  missing_components: string[];
  violations: string[];
}

export function validateArticleCompleteness(
  assembledMd: string,
  assembledHtml: string,
  manifest: ExpectedArticleManifest
): ArticleCompletenessValidationResult {
  const missingComponents: string[] = [];
  const violations: string[] = [];
  const minKeyTakeaways = manifest.min_key_takeaways ?? 3;
  const minFaqItems = manifest.min_faq_items ?? 3;
  const minH2Count = manifest.min_h2_count ?? 3;

  // 1. Title & Heading Structure
  const cleanMd = stripFaqCommentMarkers(assembledMd || '');
  const h1Matches = [...cleanMd.matchAll(/^#\s+([^\n]+)/gm)];
  const h2Matches = [...cleanMd.matchAll(/^##\s+([^\n]+)/gm)];

  if (h1Matches.length === 0) {
    missingComponents.push('H1_TITLE');
    violations.push('Heading H1 tidak ditemukan pada naskah terakit.');
  }
  if (h2Matches.length < minH2Count) {
    missingComponents.push('MINIMUM_H2_SECTIONS');
    violations.push(`Jumlah H2 (${h2Matches.length}) kurang dari syarat minimum (${minH2Count}).`);
  }

  // 2. Cover Image Presence
  if (!manifest.cover_image || !manifest.cover_image.public_url || !manifest.cover_image.storage_key) {
    missingComponents.push('COVER_HERO_SPEC');
    violations.push('Spesifikasi foto cover hero tidak lengkap dalam manifest.');
  }

  const minInlineCount = manifest.min_inline_count ?? 3;
  if ((manifest.inline_images || []).length < minInlineCount) {
    missingComponents.push('MINIMUM_INLINE_MEDIA');
    violations.push(`INLINE_MEDIA_COUNT_MISMATCH: Jumlah inline media pada manifest (${(manifest.inline_images || []).length}) kurang dari syarat minimum (${minInlineCount}).`);
  }

  // Check duplicate slot_keys and image URLs in manifest
  const manifestSlots = new Set<string>();
  const manifestDuplicateSlots: string[] = [];
  const manifestUrls = new Set<string>();
  const manifestDuplicateUrls: string[] = [];

  for (const item of (manifest.inline_images || [])) {
    const slot = (item.slot_key || '').trim().toLowerCase();
    if (manifestSlots.has(slot)) {
      manifestDuplicateSlots.push(slot);
    }
    manifestSlots.add(slot);

    const u = (item.public_url || '').trim().toLowerCase();
    if (u && manifestUrls.has(u)) {
      manifestDuplicateUrls.push(u);
    }
    if (u) manifestUrls.add(u);
  }

  if (manifestDuplicateSlots.length > 0) {
    violations.push(`DUPLICATE_MEDIA_SLOTS: Terdeteksi duplikasi slot_key pada manifest: [${manifestDuplicateSlots.join(', ')}].`);
  }
  if (manifestDuplicateUrls.length > 0) {
    violations.push(`DUPLICATE_IMAGE_URLS: Terdeteksi duplikasi URL gambar pada manifest: [${manifestDuplicateUrls.join(', ')}].`);
  }

  // 3. Scan Rendered Inline Figures in HTML
  // Match <figure ... data-media-slot="slot_key" ...> ... <img src="url" ...> ... </figure>
  const figureRegex = /<figure\b([^>]*)data-media-slot\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/figure>/gi;
  const foundSlots: string[] = [];
  const foundUrls: string[] = [];
  const seenSlots = new Set<string>();
  const seenUrls = new Set<string>();
  const duplicateSlots: string[] = [];
  const duplicateUrls: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = figureRegex.exec(assembledHtml)) !== null) {
    const slotKey = match[2].trim().toLowerCase();
    const innerHtml = match[4];
    foundSlots.push(slotKey);

    if (seenSlots.has(slotKey)) {
      duplicateSlots.push(slotKey);
    }
    seenSlots.add(slotKey);

    const srcMatch = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(innerHtml);
    if (srcMatch) {
      const src = srcMatch[1].trim();
      foundUrls.push(src);

      if (seenUrls.has(src)) {
        duplicateUrls.push(src);
      }
      seenUrls.add(src);

      if (!isSafeMediaUrl(src)) {
        violations.push(`URL media "${src}" pada slot "${slotKey}" tidak aman (unsafe URL).`);
      }
    } else {
      violations.push(`Elemen <figure> untuk slot "${slotKey}" tidak memiliki elemen <img> valid.`);
    }
  }

  // 4. Validate Expected Inlines vs Actual Found Slots
  const expectedSlots = (manifest.inline_images || []).map(i => i.slot_key.trim().toLowerCase());
  const missingSlots: string[] = [];

  for (const expected of expectedSlots) {
    if (!seenSlots.has(expected)) {
      missingSlots.push(expected);
    }
  }

  if (missingSlots.length > 0) {
    missingComponents.push('INLINE_MEDIA_FIGURES');
    violations.push(
      `Inline figure hilang dari assembled HTML: [${missingSlots.join(', ')}]. Ditemukan ${foundSlots.length} dari ${expectedSlots.length} yang diwajibkan.`
    );
  }

  if (duplicateSlots.length > 0) {
    violations.push(`Terdeteksi duplikasi slot_key pada HTML terakit: [${duplicateSlots.join(', ')}].`);
  }

  if (duplicateUrls.length > 0) {
    violations.push(`Terdeteksi duplikasi URL gambar pada HTML terakit: [${duplicateUrls.join(', ')}].`);
  }

  // 5. Editorial FAQ presence
  const faqs = extractEditorialFaqs({
    content_md: assembledMd,
    content_html: assembledHtml
  });
  if (faqs.length < minFaqItems) {
    missingComponents.push('EDITORIAL_FAQ');
    violations.push(`Butir FAQ (${faqs.length}) kurang dari syarat minimum (${minFaqItems}).`);
  }

  // 6. Focus Keyword Verification (First & Last Sentence)
  if (manifest.focus_keyword) {
    const kwTokens = manifest.focus_keyword
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3);

    const bodyParas = cleanMd
      .replace(/^#\s+[^\n]+\n+/, '')
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p && !p.startsWith('#') && !p.startsWith('<') && !p.startsWith('>'));

    if (bodyParas.length >= 2) {
      const firstSentence = (bodyParas[0].split(/(?<=[.?!])\s+/)[0] || bodyParas[0]).toLowerCase();
      const lastSentence = (bodyParas[bodyParas.length - 1].split(/(?<=[.?!])\s+/).pop() || bodyParas[bodyParas.length - 1]).toLowerCase();

      const exactKw = manifest.focus_keyword.toLowerCase();
      const firstMatch = firstSentence.includes(exactKw) || kwTokens.every(t => firstSentence.includes(t));
      const lastMatch = lastSentence.includes(exactKw) || kwTokens.every(t => lastSentence.includes(t));

      if (!firstMatch) {
        violations.push(`Focus keyword "${manifest.focus_keyword}" tidak ditemukan pada kalimat pembuka artikel.`);
      }
      if (!lastMatch) {
        violations.push(`Focus keyword "${manifest.focus_keyword}" tidak ditemukan pada kalimat penutup artikel.`);
      }
    }
  }

  const isComplete = missingComponents.length === 0 && violations.length === 0;

  return {
    is_complete: isComplete,
    status: isComplete ? 'PASS' : 'STRUCTURAL_INTEGRITY_BLOCKED',
    expected_inline_count: expectedSlots.length,
    actual_inline_count: foundSlots.length,
    found_slots: foundSlots,
    missing_slots: missingSlots,
    duplicate_slots: duplicateSlots,
    duplicate_urls: duplicateUrls,
    missing_components: missingComponents,
    violations: violations
  };
}
