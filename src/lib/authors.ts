/**
 * RancangLoka Author Taxonomy & Resolution Foundation
 * Phase 1B Implementation
 *
 * Provides deterministic resolution for article authors across CLI,
 * admin import, and future Hermes ingestion.
 */

import type { Author } from './db.ts';

/**
 * Normalized alias mapping for editorial desk and research desk authors.
 * Maps lowercase alias variants to canonical author slug.
 */
export const AUTHOR_ALIAS_MAP: Record<string, string> = {
  'rancangloka editorial desk': 'dewan-redaksi-spasial',
  'editorial desk': 'dewan-redaksi-spasial',
  'dewan redaksi spasial': 'dewan-redaksi-spasial',
  'dewan redaksi spasial rancangloka': 'dewan-redaksi-spasial',
  'dewan-redaksi-spasial': 'dewan-redaksi-spasial',
  'redaksi': 'dewan-redaksi-spasial',
  'rancangloka research desk': 'tim-riset-materialitas',
  'research desk': 'tim-riset-materialitas',
  'tim riset materialitas': 'tim-riset-materialitas',
  'tim riset materialitas rancangloka': 'tim-riset-materialitas',
  'tim-riset-materialitas': 'tim-riset-materialitas'
};

export interface ResolvedAuthorResult {
  author: Author;
  resolvedBy: 'id' | 'exact' | 'slug' | 'alias';
}

/**
 * Deterministically resolves an author identifier (name, slug, alias, or ID)
 * against the provided list of authors.
 */
export function resolveAuthor(
  input: string | number,
  authorsList: Author[]
): ResolvedAuthorResult | null {
  if (input === null || input === undefined) return null;

  // 1. Resolve by numeric ID
  const numericId = typeof input === 'number' ? input : (!isNaN(Number(input)) && input.toString().trim() !== '' ? Number(input) : null);
  if (numericId !== null) {
    const match = authorsList.find((a) => a.id === numericId);
    if (match) return { author: match, resolvedBy: 'id' };
  }

  const raw = input.toString().trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  const slugified = normalized.replace(/\s+/g, '-');

  // 2. Exact name match (case-insensitive)
  const byName = authorsList.find((a) => a.name.toLowerCase().trim() === normalized);
  if (byName) return { author: byName, resolvedBy: 'exact' };

  // 3. Exact slug match
  const bySlug = authorsList.find((a) => a.slug.toLowerCase().trim() === slugified);
  if (bySlug) return { author: bySlug, resolvedBy: 'slug' };

  // 4. Alias lookup
  const targetSlug = AUTHOR_ALIAS_MAP[normalized] || AUTHOR_ALIAS_MAP[slugified];
  if (targetSlug) {
    const byAlias = authorsList.find((a) => a.slug.toLowerCase().trim() === targetSlug);
    if (byAlias) return { author: byAlias, resolvedBy: 'alias' };
  }

  return null;
}
