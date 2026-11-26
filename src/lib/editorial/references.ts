/**
 * RancangLoka Magazine 2.1 — Contextual Technical References Module
 * MISSION: RANCANGLOKA_EDITORIAL_REFERENCES_1
 *
 * Invariants:
 * - Extracts technical standards and references from article markdown
 * - Allows canonical sequence: Narrative -> Conclusion -> FAQ Accordion -> Technical References -> Author Box
 * - Zero client-side JavaScript dependency
 * - Preserves strict article allowlist and XSS protection
 */

import { renderArticleMarkdownSafely } from '../article/renderer.ts';

const REF_HEADING_REGEX = /(?:###|##)\s*(?:Referensi & Standar Teknis|Referensi Teknis|Daftar Referensi)[\s\S]*$/i;

export interface ExtractedTechnicalReferences {
  cleanContentMd: string;
  referencesHtml: string | null;
}

export async function extractTechnicalReferences(contentMd: string): Promise<ExtractedTechnicalReferences> {
  if (!contentMd || typeof contentMd !== 'string') {
    return { cleanContentMd: contentMd || '', referencesHtml: null };
  }

  const match = contentMd.match(REF_HEADING_REGEX);
  if (!match) {
    return { cleanContentMd: contentMd, referencesHtml: null };
  }

  const refBlock = match[0];
  // Remove the heading itself to leave just the list items
  const refBody = refBlock
    .replace(/^(?:###|##)\s*(?:Referensi & Standar Teknis|Referensi Teknis|Daftar Referensi)\s*/i, '')
    .trim();
  const cleanContentMd = contentMd.replace(REF_HEADING_REGEX, '').trim();

  let referencesHtml: string | null = null;
  if (refBody.length > 0) {
    referencesHtml = await renderArticleMarkdownSafely(refBody);
  }

  return { cleanContentMd, referencesHtml };
}
