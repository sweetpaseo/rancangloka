/**
 * RancangLoka Semantic Internal Link Service (INTERNAL-LINK-ENGINE-1)
 * 
 * "Internal link RancangLoka harus melanjutkan perjalanan berpikir pembaca,
 * bukan sekadar memindahkan PageRank."
 * 
 * Enforces:
 * - NO_MECHANICAL_INTERNAL_LINK_QUOTA
 * - INVARIANT_EXPLICIT_PILLAR_IDENTITY
 * - Two-Plane Architecture (Plane A Dynamic Safe vs Plane B Editorial Inline)
 * - Exact source_content_hash provenance for Plane B
 * - One primary relationship per (source, target, placement_plane)
 * - Zero published prose mutation
 */

import {
  RELATIONSHIP_TYPES,
  PLACEMENT_PLANES,
  LINK_STATUSES,
  PILLAR_ROLES,
  type RelationshipType,
  type PlacementPlane,
  type LinkStatus,
  type PillarRole,
  type ArticleInternalLink,
  type ResolvedPlaneALink,
  type OrphanDiagnosticResult,
  type DiscoveryCandidate,
  type InternalLinkActionableState
} from './types.ts';

export const VALID_PILLAR_ROLES = PILLAR_ROLES;

export interface PillarValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates pillar metadata integrity synchronously against an article lookup function.
 * Rules:
 * - pillar_role must be PILLAR, SUPPORTING, or STANDALONE
 * - PILLAR: parent_pillar_id must be NULL
 * - STANDALONE: parent_pillar_id must be NULL
 * - SUPPORTING: parent_pillar_id must reference an existing PILLAR article
 * - Self-parenting forbidden
 * - Circular pillar relationships forbidden
 */
export function validatePillarMetadataSync(
  article: { id?: number; pillar_role?: string; parent_pillar_id?: number | null },
  pillarLookup?: (id: number) => { id: number; pillar_role?: string; parent_pillar_id?: number | null } | undefined
): PillarValidationResult {
  const role = article.pillar_role || 'STANDALONE';
  if (!VALID_PILLAR_ROLES.includes(role as PillarRole)) {
    return { valid: false, error: `Invalid pillar_role: "${role}". Must be one of: ${VALID_PILLAR_ROLES.join(', ')}` };
  }

  const parentId = article.parent_pillar_id;

  if (role === 'PILLAR') {
    if (parentId !== null && parentId !== undefined) {
      return { valid: false, error: 'PILLAR article cannot have a parent_pillar_id (must be NULL)' };
    }
  } else if (role === 'STANDALONE') {
    if (parentId !== null && parentId !== undefined) {
      return { valid: false, error: 'STANDALONE article cannot have a parent_pillar_id (must be NULL)' };
    }
  } else if (role === 'SUPPORTING') {
    if (parentId === null || parentId === undefined) {
      return { valid: false, error: 'SUPPORTING article requires parent_pillar_id referencing an existing PILLAR article' };
    }

    if (article.id && parentId === article.id) {
      return { valid: false, error: 'Self-parenting is strictly prohibited (parent_pillar_id cannot equal article id)' };
    }

    if (pillarLookup) {
      const parent = pillarLookup(parentId);
      if (!parent) {
        return { valid: false, error: `Parent pillar article with id ${parentId} does not exist` };
      }
      if (parent.pillar_role !== 'PILLAR') {
        return { valid: false, error: `parent_pillar_id ${parentId} must reference an article with pillar_role="PILLAR" (found "${parent.pillar_role || 'STANDALONE'}")` };
      }
      // Circularity check
      const visited = new Set<number>();
      if (article.id) visited.add(article.id);
      let currId: number | null | undefined = parentId;
      while (currId) {
        if (visited.has(currId)) {
          return { valid: false, error: `Circular pillar hierarchy detected involving article id ${currId}` };
        }
        visited.add(currId);
        const currArt = pillarLookup(currId);
        currId = currArt?.parent_pillar_id;
      }
    }
  }

  return { valid: true };
}

/**
 * Validates pillar metadata integrity against the database.
 */
export async function validatePillarMetadata(
  db: any,
  article: { id?: number; pillar_role?: string; parent_pillar_id?: number | null }
): Promise<PillarValidationResult> {
  const role = article.pillar_role || 'STANDALONE';
  if (!VALID_PILLAR_ROLES.includes(role as PillarRole)) {
    return { valid: false, error: `Invalid pillar_role: "${role}". Must be one of: ${VALID_PILLAR_ROLES.join(', ')}` };
  }

  const parentId = article.parent_pillar_id;

  if (role === 'PILLAR') {
    if (parentId !== null && parentId !== undefined) {
      return { valid: false, error: 'PILLAR article cannot have a parent_pillar_id (must be NULL)' };
    }
    return { valid: true };
  }

  if (role === 'STANDALONE') {
    if (parentId !== null && parentId !== undefined) {
      return { valid: false, error: 'STANDALONE article cannot have a parent_pillar_id (must be NULL)' };
    }
    return { valid: true };
  }

  if (role === 'SUPPORTING') {
    if (parentId === null || parentId === undefined) {
      return { valid: false, error: 'SUPPORTING article requires parent_pillar_id referencing an existing PILLAR article' };
    }
    if (article.id && parentId === article.id) {
      return { valid: false, error: 'Self-parenting is strictly prohibited (parent_pillar_id cannot equal article id)' };
    }

    if (db && typeof db.prepare === 'function') {
      const parent = await db.prepare('SELECT id, pillar_role, parent_pillar_id FROM articles WHERE id = ?').bind(parentId).first();
      if (!parent) {
        return { valid: false, error: `Parent pillar article with id ${parentId} does not exist` };
      }
      if (parent.pillar_role !== 'PILLAR') {
        return { valid: false, error: `parent_pillar_id ${parentId} must reference an article with pillar_role="PILLAR" (found "${parent.pillar_role || 'STANDALONE'}")` };
      }
      // Circularity check
      const visited = new Set<number>();
      if (article.id) visited.add(article.id);
      let currId: number | null | undefined = parentId;
      while (currId) {
        if (visited.has(currId)) {
          return { valid: false, error: `Circular pillar hierarchy detected involving article id ${currId}` };
        }
        visited.add(currId);
        const currArt: any = await db.prepare('SELECT id, parent_pillar_id FROM articles WHERE id = ?').bind(currId).first();
        currId = currArt?.parent_pillar_id;
      }
    }
  }

  return { valid: true };
}

export interface LinkValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a candidate internal link relationship against core system invariants.
 */
export function validateLinkCandidate(
  link: Partial<ArticleInternalLink>,
  sourceArticle?: { id: number; pillar_role?: string; content_hash?: string; status?: string } | null,
  targetArticle?: { id: number; pillar_role?: string; status?: string } | null
): LinkValidationResult {
  if (!link.source_article_id || !link.target_article_id) {
    return { valid: false, error: 'source_article_id and target_article_id are required' };
  }

  // 1. Invariant: Prevent self-links
  if (link.source_article_id === link.target_article_id) {
    return { valid: false, error: 'Self-linking is strictly prohibited (source cannot equal target)' };
  }

  // 2. Validate relationship type
  if (!link.relationship_type || !RELATIONSHIP_TYPES.includes(link.relationship_type as RelationshipType)) {
    return { valid: false, error: `Invalid relationship_type: ${link.relationship_type}` };
  }

  // 3. Validate placement plane
  if (!link.placement_plane || !PLACEMENT_PLANES.includes(link.placement_plane as PlacementPlane)) {
    return { valid: false, error: `Invalid placement_plane: ${link.placement_plane}` };
  }

  // 4. Validate reader_reason
  if (!link.reader_reason || typeof link.reader_reason !== 'string' || link.reader_reason.trim().length === 0) {
    return { valid: false, error: 'reader_reason is required and cannot be empty' };
  }

  // 5. Invariant: Explicit Pillar Identity (INVARIANT_EXPLICIT_PILLAR_IDENTITY)
  // PARENT_PILLAR and CHILD_SUPPORTING strictly require explicit pillar metadata
  if (link.relationship_type === 'PARENT_PILLAR') {
    if (!targetArticle || targetArticle.pillar_role !== 'PILLAR') {
      return {
        valid: false,
        error: 'PARENT_PILLAR requires explicit pillar metadata (target article must have pillar_role="PILLAR")'
      };
    }
  }

  if (link.relationship_type === 'CHILD_SUPPORTING') {
    if (!sourceArticle || sourceArticle.pillar_role !== 'PILLAR') {
      return {
        valid: false,
        error: 'CHILD_SUPPORTING requires explicit pillar metadata (source article must have pillar_role="PILLAR")'
      };
    }
  }

  // 6. Invariant: Plane B source_content_hash binding
  if (link.placement_plane === 'PLANE_B_INLINE' && link.status === 'ACTIVE') {
    if (!link.source_content_hash || link.source_content_hash.trim().length === 0) {
      return {
        valid: false,
        error: 'source_content_hash is required for ACTIVE PLANE_B_INLINE links'
      };
    }
  }

  return { valid: true };
}

/**
 * Creates a link candidate in the database.
 */
export async function createLinkCandidate(
  db: any,
  link: ArticleInternalLink,
  sourceArticle?: any,
  targetArticle?: any
): Promise<{ success: boolean; id?: number; error?: string }> {
  const validation = validateLinkCandidate(link, sourceArticle, targetArticle);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const query = `
    INSERT INTO article_internal_links (
      source_article_id,
      target_article_id,
      relationship_type,
      reader_reason,
      placement_plane,
      anchor_text,
      confidence_score,
      status,
      source_content_hash,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  try {
    const res = await db.prepare(query).bind(
      link.source_article_id,
      link.target_article_id,
      link.relationship_type,
      link.reader_reason.trim(),
      link.placement_plane,
      link.anchor_text || null,
      link.confidence_score !== undefined ? link.confidence_score : 1.0,
      link.status || 'CANDIDATE',
      link.source_content_hash || null
    ).run();

    return {
      success: true,
      id: res.meta?.last_row_id || res.lastRowId || res.meta?.changes
    };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Approves a candidate relationship.
 */
export async function approveLink(
  db: any,
  linkId: number,
  reviewedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.prepare(`
      UPDATE article_internal_links
      SET status = 'APPROVED',
          reviewed_at = CURRENT_TIMESTAMP,
          reviewed_by = ?
      WHERE id = ?
    `).bind(reviewedBy, linkId).run();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Activates a link relationship.
 * For PLANE_B_INLINE, strictly binds to the source article's current approved content hash.
 */
export async function activateLink(
  db: any,
  linkId: number,
  reviewedBy?: string,
  approvedContentHash?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch current link
    const link = await db.prepare(`
      SELECT * FROM article_internal_links WHERE id = ?
    `).bind(linkId).first();

    if (!link) {
      return { success: false, error: `Link with id ${linkId} not found` };
    }

    let finalContentHash = link.source_content_hash;

    if (link.placement_plane === 'PLANE_B_INLINE') {
      if (approvedContentHash) {
        finalContentHash = approvedContentHash;
      } else {
        // Look up source article's content_hash
        const sourceArt = await db.prepare(`
          SELECT content_hash FROM articles WHERE id = ?
        `).bind(link.source_article_id).first();
        if (!sourceArt || !sourceArt.content_hash) {
          return {
            success: false,
            error: 'Cannot activate PLANE_B_INLINE link without source article content_hash'
          };
        }
        finalContentHash = sourceArt.content_hash;
      }
    }

    await db.prepare(`
      UPDATE article_internal_links
      SET status = 'ACTIVE',
          source_content_hash = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          reviewed_by = COALESCE(?, reviewed_by)
      WHERE id = ?
    `).bind(finalContentHash || null, reviewedBy || null, linkId).run();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Rejects a relationship candidate.
 */
export async function rejectLink(
  db: any,
  linkId: number,
  reviewedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.prepare(`
      UPDATE article_internal_links
      SET status = 'REJECTED',
          reviewed_at = CURRENT_TIMESTAMP,
          reviewed_by = ?
      WHERE id = ?
    `).bind(reviewedBy, linkId).run();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Marks a link as STALE (e.g. when source article content hash changes).
 */
export async function markLinkStale(
  db: any,
  linkId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.prepare(`
      UPDATE article_internal_links
      SET status = 'STALE'
      WHERE id = ?
    `).bind(linkId).run();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Evaluates whether an active PLANE_B_INLINE link has become stale based on hash comparison.
 */
export function evaluatePlaneBStaleness(
  link: ArticleInternalLink,
  currentSourceContentHash: string
): boolean {
  if (link.placement_plane !== 'PLANE_B_INLINE' || link.status !== 'ACTIVE') {
    return false;
  }
  if (!link.source_content_hash) {
    return true; // Missing hash on active inline link is stale/invalid
  }
  return link.source_content_hash !== currentSourceContentHash;
}

/**
 * Checks all active PLANE_B_INLINE links for a source article and marks any that differ from the current content hash as STALE.
 */
export async function checkAndReconcilePlaneBStaleness(
  db: any,
  sourceArticleId: number,
  currentContentHash: string
): Promise<number> {
  const activeInlineLinks = await db.prepare(`
    SELECT id, source_content_hash
    FROM article_internal_links
    WHERE source_article_id = ?
      AND placement_plane = 'PLANE_B_INLINE'
      AND status = 'ACTIVE'
  `).bind(sourceArticleId).all();

  const links = activeInlineLinks.results || activeInlineLinks || [];
  let staleCount = 0;

  for (const l of links) {
    if (l.source_content_hash !== currentContentHash) {
      await markLinkStale(db, l.id);
      staleCount++;
    }
  }

  return staleCount;
}

/**
 * Strips markdown and HTML formatting from prose for clean excerpt presentation.
 */
export function stripFormatting(text: string): string {
  if (!text) return '';
  return text
    // Remove markdown images
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // Remove markdown links keeping label text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove citation / footnote references like [^1], [1], [^ref]
    .replace(/\[\^?[a-zA-Z0-9_-]+\]/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove markdown headings
    .replace(/^#+\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove bold/italics
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove inline code ticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Collapse multi-spaces and newlines into single spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncates text cleanly at word boundaries up to maxChars, ending with an ellipsis.
 */
export function truncateAtWordBoundary(text: string, maxChars: number = 180): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxChars) {
    return cleaned;
  }
  const slice = cleaned.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.6) {
    return slice.slice(0, lastSpace).trim() + '…';
  }
  return slice.trim() + '…';
}

/**
 * Extracts a clean, concise excerpt (approx 100-180 chars) from canonical description or first prose paragraph.
 * Ensures:
 * - No headings
 * - Strips Markdown / HTML
 * - No citation markup leakage
 * - No raw HTML
 * - No reader_reason fallback unless unavoidable
 * - Deterministic SSR output
 */
export function extractArticleExcerpt(
  description?: string | null,
  contentMd?: string | null,
  contentHtml?: string | null,
  maxChars: number = 180
): string {
  if (description && description.trim().length > 0) {
    const stripped = stripFormatting(description);
    if (stripped.length > 0) {
      return truncateAtWordBoundary(stripped, maxChars);
    }
  }

  // Fallback: extract first meaningful prose paragraph from content_md
  if (contentMd && contentMd.trim().length > 0) {
    const paragraphs = contentMd.split(/\n\s*\n/);
    for (const rawPara of paragraphs) {
      const trimmed = rawPara.trim();
      if (
        trimmed.startsWith('#') ||
        trimmed.startsWith('>') ||
        trimmed.startsWith('|') ||
        trimmed.startsWith('---') ||
        trimmed.startsWith('***') ||
        trimmed.startsWith('![') ||
        trimmed.startsWith('<')
      ) {
        continue;
      }
      const stripped = stripFormatting(trimmed);
      if (stripped.length >= 20) {
        return truncateAtWordBoundary(stripped, maxChars);
      }
    }
  }

  // Fallback: extract from contentHtml if contentMd is absent
  if (contentHtml && contentHtml.trim().length > 0) {
    const pMatches = contentHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pMatches) {
      for (const p of pMatches) {
        const stripped = stripFormatting(p);
        if (stripped.length >= 20) {
          return truncateAtWordBoundary(stripped, maxChars);
        }
      }
    }
    const stripped = stripFormatting(contentHtml);
    if (stripped.length >= 20) {
      return truncateAtWordBoundary(stripped, maxChars);
    }
  }

  return '';
}

/**
 * Fetches active Plane A links for public rendering outside article body.
 * Enforces:
 * - status = 'ACTIVE'
 * - placement_plane = 'PLANE_A_DYNAMIC'
 * - target article MUST be published (omitted if draft, scheduled, or deleted)
 * - no self-links (source_article_id != target_article_id)
 * - deduplicates target articles (one primary card per unique destination)
 * - dynamically resolves target article current slug at runtime
 */
export async function getActivePlaneALinks(
  db: any,
  sourceArticleId: number
): Promise<ResolvedPlaneALink[]> {
  const query = `
    SELECT 
      l.id,
      l.source_article_id,
      l.target_article_id,
      l.relationship_type,
      l.reader_reason,
      l.placement_plane,
      l.confidence_score,
      a.title as target_title,
      a.slug as target_slug,
      a.description as target_description,
      a.content_md as target_content_md,
      a.content_html as target_content_html,
      a.status as target_status,
      a.reading_time_minutes as target_reading_time_minutes,
      a.featured_image as target_featured_image,
      a.image_alt as target_image_alt,
      c.name as target_category_name
    FROM article_internal_links l
    INNER JOIN articles a ON l.target_article_id = a.id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE l.source_article_id = ?
      AND l.placement_plane = 'PLANE_A_DYNAMIC'
      AND l.status = 'ACTIVE'
      AND a.status = 'published'
      AND l.target_article_id != ?
    ORDER BY l.confidence_score DESC, l.id ASC
  `;

  const rows = await db.prepare(query).bind(sourceArticleId, sourceArticleId).all();
  const rawResults = rows.results || rows || [];

  // Deduplicate target articles (ONE primary relationship per target destination)
  const seenTargets = new Set<number>();
  const deduplicated: ResolvedPlaneALink[] = [];

  for (const row of rawResults) {
    if (seenTargets.has(row.target_article_id)) {
      continue;
    }
    seenTargets.add(row.target_article_id);
    const target_excerpt = extractArticleExcerpt(
      row.target_description,
      row.target_content_md,
      row.target_content_html
    );

    deduplicated.push({
      id: row.id,
      source_article_id: row.source_article_id,
      target_article_id: row.target_article_id,
      relationship_type: row.relationship_type as RelationshipType,
      reader_reason: row.reader_reason,
      placement_plane: 'PLANE_A_DYNAMIC',
      confidence_score: row.confidence_score || 1.0,
      target_title: row.target_title,
      target_slug: row.target_slug,
      target_excerpt: target_excerpt || undefined,
      target_category_name: row.target_category_name || undefined,
      target_reading_time_minutes: row.target_reading_time_minutes || 3,
      target_featured_image: row.target_featured_image || undefined,
      target_image_alt: row.target_image_alt || undefined
    });
  }

  return deduplicated;
}

/**
 * Queries Plane B recommendations for editorial review.
 */
export async function getPlaneBRecommendations(
  db: any,
  sourceArticleId: number
): Promise<ArticleInternalLink[]> {
  const query = `
    SELECT *
    FROM article_internal_links
    WHERE source_article_id = ?
      AND placement_plane = 'PLANE_B_INLINE'
    ORDER BY confidence_score DESC, id ASC
  `;
  const rows = await db.prepare(query).bind(sourceArticleId).all();
  return (rows.results || rows || []) as ArticleInternalLink[];
}

/**
 * Diagnostic tool: Detects published articles that lack meaningful inbound semantic links.
 * Candidate orphan when:
 * - status = 'published'
 * - inbound active semantic links = 0
 * - parent_pillar_id IS NULL and pillar_role != 'PILLAR'
 * Returns structured findings. Zero fixed quota.
 */
export async function detectOrphans(db: any): Promise<OrphanDiagnosticResult[]> {
  const query = `
    SELECT 
      a.id as article_id,
      a.slug,
      a.title,
      a.status,
      COALESCE(a.pillar_role, 'STANDALONE') as pillar_role,
      a.parent_pillar_id,
      COUNT(l.id) as inbound_active_semantic_links_count
    FROM articles a
    LEFT JOIN article_internal_links l 
      ON l.target_article_id = a.id 
     AND l.status = 'ACTIVE'
    WHERE a.status = 'published'
    GROUP BY a.id
    ORDER BY a.id ASC
  `;

  const rows = await db.prepare(query).all();
  const articles = rows.results || rows || [];

  return articles.map((art: any) => {
    const linkCount = Number(art.inbound_active_semantic_links_count || 0);
    const pillarRole = art.pillar_role || 'STANDALONE';
    const parentPillarId = art.parent_pillar_id || null;

    // An article is an orphan candidate if it has 0 inbound active semantic links
    // and is not attached to an explicit parent pillar, and is not a pillar itself.
    const isOrphan = linkCount === 0 && parentPillarId === null && pillarRole !== 'PILLAR';

    let reason = 'Healthy contextual discovery path';
    if (isOrphan) {
      reason = 'Zero inbound active semantic links and no parent pillar attachment';
    } else if (linkCount === 0 && pillarRole === 'PILLAR') {
      reason = 'Root pillar hub (standalone discovery via topic navigation)';
    } else if (linkCount === 0 && parentPillarId !== null) {
      reason = 'Attached to parent pillar navigation path';
    }

    return {
      article_id: art.article_id,
      slug: art.slug,
      title: art.title,
      status: art.status,
      pillar_role: pillarRole,
      parent_pillar_id: parentPillarId,
      inbound_active_semantic_links_count: linkCount,
      is_orphan: isOrphan,
      reason
    };
  });
}

/**
 * Generic architectural concept dictionary for deterministic semantic discovery.
 * Spans core residential building physics, spatial assemblies, and material science.
 * Zero hardcoded article IDs, slugs, or article-specific branches.
 */
export const ARCHITECTURAL_TAXONOMY = {
  problems: [
    'bocor', 'rembes', 'pengap', 'lembab', 'lembap', 'bising', 'kebisingan',
    'panas', 'silau', 'retak', 'kondensasi', 'embun', 'jamur', 'tampias', 'tempias',
    'hawa panas', 'kurang angin', 'suhu tinggi', 'kelembapan'
  ],
  systems: [
    'atap', 'plafon', 'talang', 'ventilasi', 'fasad', 'dinding', 'kusen',
    'jendela', 'pintu', 'dak beton', 'dak', 'kanopi', 'skylight', 'peneduh',
    'shading', 'louver', 'secondary skin', 'overhang', 'exhaust', 'dapur',
    'kamar mandi', 'bovenly', 'roster', 'insulasi atap'
  ],
  materials: [
    'kaca', 'aluminium', 'upvc', 'kayu', 'beton', 'bata ringan', 'bata merah',
    'waterproofing', 'membran', 'sealant', 'insulasi', 'rockwool', 'glasswool',
    'genteng', 'galvalum', 'spandek', 'keramik', 'granit', 'baja ringan',
    'double glazed', 'laminated'
  ]
};

export const ARCHITECTURAL_SUBSYSTEMS: Record<string, string[]> = {
  envelope: [
    'fasad', 'dinding', 'kusen', 'jendela', 'pintu', 'peneduh',
    'shading', 'louver', 'secondary skin', 'overhang', 'kanopi',
    'kaca', 'aluminium', 'upvc', 'kayu', 'secondary facade', 'facade'
  ],
  roofing: [
    'atap', 'dak beton', 'dak', 'plafon', 'talang', 'waterproofing',
    'membran', 'genteng', 'galvalum', 'spandek', 'insulasi atap'
  ],
  air_and_moisture: [
    'ventilasi', 'exhaust', 'roster', 'bovenly', 'sirkulasi',
    'pengap', 'lembab', 'lembap', 'kelembapan', 'kondensasi', 'embun', 'jamur'
  ],
  thermal_acoustics: [
    'panas', 'suhu tinggi', 'suhu', 'bising', 'kebisingan', 'silau',
    'insulasi', 'rockwool', 'glasswool', 'thermal bridge', 'double glazed', 'laminated', 'kedap suara'
  ]
};

export interface ExtractedConcepts {
  problems: string[];
  systems: string[];
  materials: string[];
  all: string[];
}

export function extractArchitecturalConcepts(text: string): ExtractedConcepts {
  const lower = (text || '').toLowerCase();
  const problems = ARCHITECTURAL_TAXONOMY.problems.filter(p => lower.includes(p));
  const systems = ARCHITECTURAL_TAXONOMY.systems.filter(s => lower.includes(s));
  const materials = ARCHITECTURAL_TAXONOMY.materials.filter(m => lower.includes(m));
  const all = [...problems, ...systems, ...materials];
  return { problems, systems, materials, all };
}

/**
 * Deterministic candidate generation for bidirectional link discovery.
 * Identifies:
 * - FORWARD: new article -> candidate old articles
 * - BACKLINK: candidate old articles -> new article
 * Derives from generic article concepts (problems, materials, systems, title terms).
 * Strictly zero A/B/C hardcoding or fixed topic branches. No embeddings.
 */
export async function discoverBidirectionalCandidates(
  db: any,
  article: {
    id: number;
    title: string;
    focus_keyword?: string;
    category_id?: number;
    description?: string;
    pillar_role?: string;
  },
  candidatePool?: any[]
): Promise<DiscoveryCandidate[]> {
  let pool = candidatePool;
  if (!pool) {
    const res = await db.prepare(`
      SELECT id, title, slug, focus_keyword, category_id, description, pillar_role, published_at
      FROM articles
      WHERE id != ? AND status = 'published'
    `).bind(article.id).all();
    pool = res.results || res || [];
  }

  const candidates: DiscoveryCandidate[] = [];
  const artText = `${article.title} ${article.focus_keyword || ''} ${article.description || ''}`;
  const artConcepts = extractArchitecturalConcepts(artText);
  const artKeyword = (article.focus_keyword || '').toLowerCase().trim();

  // Extract significant non-stopword title tokens (>= 4 chars)
  const STOPWORDS = new Set(['yang', 'untuk', 'pada', 'dengan', 'dan', 'atau', 'dalam', 'dari', 'bisa', 'cara', 'tips', 'mana', 'lebih', 'tanpa', 'adalah', 'agar']);
  const artTitleTokens = (article.title || '').toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length >= 4 && !STOPWORDS.has(w));

  const candidateList = pool || [];
  for (const other of candidateList) {
    if (other.id === article.id) continue;

    const otherText = `${other.title} ${other.focus_keyword || ''} ${other.description || ''}`;
    const otherConcepts = extractArchitecturalConcepts(otherText);
    const otherKeyword = (other.focus_keyword || '').toLowerCase().trim();

    const otherTitleTokens = (other.title || '').toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length >= 4 && !STOPWORDS.has(w));

    // Shared concepts across taxonomy facets
    const sharedProblems = artConcepts.problems.filter(p => otherConcepts.problems.includes(p));
    const sharedSystems = artConcepts.systems.filter(s => otherConcepts.systems.includes(s));
    const sharedMaterials = artConcepts.materials.filter(m => otherConcepts.materials.includes(m));
    const sharedTokens = artTitleTokens.filter(t => otherTitleTokens.includes(t));

    // Shared architectural subsystems (envelope, roofing, air_and_moisture, thermal_acoustics)
    const sharedSubsystems = Object.entries(ARCHITECTURAL_SUBSYSTEMS).filter(([_, terms]) => {
      const artHas = terms.some(t => artText.toLowerCase().includes(t));
      const otherHas = terms.some(t => otherText.toLowerCase().includes(t));
      return artHas && otherHas;
    }).map(([name]) => name);

    // Direct keyword cross-containment
    const hasKeywordCrossMatch = Boolean(
      (otherKeyword && otherKeyword.length >= 4 && artText.toLowerCase().includes(otherKeyword)) ||
      (artKeyword && artKeyword.length >= 4 && otherText.toLowerCase().includes(artKeyword))
    );

    // Complementary problem-solution relations across building science:
    const artProblemMeetsOtherSolution =
      artConcepts.problems.length > 0 && (otherConcepts.systems.length > 0 || otherConcepts.materials.length > 0);
    const otherProblemMeetsArtSolution =
      otherConcepts.problems.length > 0 && (artConcepts.systems.length > 0 || artConcepts.materials.length > 0);

    const hasSemanticConnection =
      sharedSystems.length > 0 ||
      sharedMaterials.length > 0 ||
      sharedProblems.length > 0 ||
      sharedTokens.length >= 2 ||
      sharedSubsystems.length > 0 ||
      hasKeywordCrossMatch ||
      artProblemMeetsOtherSolution ||
      otherProblemMeetsArtSolution;

    if (hasSemanticConnection) {
      let forwardRel: RelationshipType = 'RELATED_SYSTEM';
      let backlinkRel: RelationshipType = 'RELATED_SYSTEM';
      let forwardReason = `Membantu pembaca memahami kaitan teknis antara ${article.title} dan ${other.title}`;
      let backlinkReason = `Melengkapi pertimbangan pada ${other.title} dengan panduan ${article.title}`;

      // Fine-tune relationship type dynamically based on architectural facets
      if (sharedMaterials.length > 0 && (artConcepts.systems.length > 0 || otherConcepts.systems.length > 0)) {
        forwardRel = 'RELATED_MATERIAL';
        forwardReason = `Pelajari karakteristik material ${sharedMaterials.join(', ')} dan kesesuaian instalasinya`;
        backlinkRel = 'RELATED_DECISION';
        backlinkReason = `Pertimbangkan konteks desain sistem sebelum memutuskan spesifikasi material ${sharedMaterials.join(', ')}`;
      } else if (sharedSubsystems.includes('envelope') && (artConcepts.systems.length > 0 || otherConcepts.systems.length > 0)) {
        const combined = (artText + ' ' + otherText).toLowerCase();
        const hasShading = combined.includes('shading') || combined.includes('peneduh') || combined.includes('louver') || combined.includes('overhang');
        const hasAperture = combined.includes('kusen') || combined.includes('jendela') || combined.includes('kaca') || combined.includes('aluminium');
        if (hasShading && hasAperture) {
          forwardRel = 'RELATED_MATERIAL';
          forwardReason = `Jika memilih kisi atau kusen aluminium, pahami karakteristik konduksi panas material kusen`;
          backlinkRel = 'RELATED_DECISION';
          backlinkReason = `Sebelum mengganti kusen jendela, pertimbangkan solusi peneduh luar fasad`;
        } else {
          forwardRel = 'RELATED_SYSTEM';
          forwardReason = `Ketahui bagaimana elemen selubung bukaan fasad saling mendukung fungsi proteksi ruang`;
          backlinkRel = 'RELATED_SYSTEM';
          backlinkReason = `Melengkapi panduan perancangan elemen selubung dan bukaan fasad`;
        }
      } else if (artConcepts.problems.length > 0 && otherConcepts.systems.length > 0) {
        forwardRel = 'RELATED_SYSTEM';
        forwardReason = `Ketahui bagaimana sistem ${otherConcepts.systems.join(', ')} mengatasi tantangan ${artConcepts.problems.join(', ')}`;
        backlinkRel = 'RELATED_PROBLEM';
        backlinkReason = `Identifikasi gejala awal ${artConcepts.problems.join(', ')} yang melatarbelakangi kebutuhan sistem ini`;
      } else if (otherConcepts.problems.length > 0 && artConcepts.systems.length > 0) {
        forwardRel = 'RELATED_PROBLEM';
        forwardReason = `Pahami potensi masalah ${otherConcepts.problems.join(', ')} jika sistem tidak dirancang dengan benar`;
        backlinkRel = 'RELATED_SYSTEM';
        backlinkReason = `Solusi desain sistem ${artConcepts.systems.join(', ')} untuk mencegah terjadinya masalah tersebut`;
      } else if (sharedProblems.length > 0) {
        forwardRel = 'RELATED_PROBLEM';
        forwardReason = `Bandingkan penanganan masalah ${sharedProblems.join(', ')} pada elemen bangunan terkait`;
        backlinkRel = 'BACKGROUND_EXPLAINER';
        backlinkReason = `Pahami prinsip dasar terjadinya masalah ${sharedProblems.join(', ')} pada hunian tropis`;
      } else if (sharedSystems.length > 0) {
        forwardRel = 'RELATED_SYSTEM';
        forwardReason = `Mempelajari subsistem ${sharedSystems.join(', ')} pendukung untuk keutuhan fungsi ruang`;
        backlinkRel = 'RELATED_SYSTEM';
        backlinkReason = `Melengkapi panduan perancangan elemen ${sharedSystems.join(', ')}`;
      }

      // Check pillar constraints: Never assign PARENT_PILLAR or CHILD_SUPPORTING unless explicitly marked
      if (other.pillar_role !== 'PILLAR' && (forwardRel as string) === 'PARENT_PILLAR') {
        forwardRel = 'RELATED_DECISION';
      }
      if (other.pillar_role !== 'PILLAR' && (backlinkRel as string) === 'CHILD_SUPPORTING') {
        backlinkRel = 'RELATED_SYSTEM';
      }

      const matchScore = Math.min(
        0.95,
        0.75 +
          (sharedSystems.length * 0.05) +
          (sharedMaterials.length * 0.05) +
          (sharedProblems.length * 0.05) +
          (sharedSubsystems.length * 0.04) +
          (hasKeywordCrossMatch ? 0.05 : 0)
      );

      // 1. FORWARD Candidate (Article -> Other)
      candidates.push({
        source_article_id: article.id,
        target_article_id: other.id,
        direction: 'FORWARD',
        relationship_type: forwardRel,
        reader_reason: forwardReason,
        confidence_score: Number(matchScore.toFixed(2)),
        recommended_plane: 'PLANE_A_DYNAMIC',
        status: 'CANDIDATE',
        match_rationale: `Shared taxonomy concepts (${[...sharedSystems, ...sharedMaterials, ...sharedProblems, ...sharedSubsystems].join(', ') || 'domain match'})`
      });

      // 2. BACKLINK Candidate (Other -> Article)
      candidates.push({
        source_article_id: other.id,
        target_article_id: article.id,
        direction: 'BACKLINK',
        relationship_type: backlinkRel,
        reader_reason: backlinkReason,
        confidence_score: Number((matchScore - 0.02).toFixed(2)),
        recommended_plane: 'PLANE_A_DYNAMIC',
        status: 'CANDIDATE',
        match_rationale: `Bidirectional decision support path from existing published article`
      });
    }
  }

  return candidates;
}

/**
 * Derives actionable operational states for Mission Control.
 * Only surfaces actionable states (no dashboard noise for healthy active links):
 * - ORPHAN_DETECTED: Published articles with zero inbound discovery paths and no parent pillar.
 * - BACKLINK_RECOMMENDED: Backlink opportunities connecting established articles to newly published articles.
 * - LINK_REVIEW_REQUIRED: Candidates awaiting human approval.
 * - LINK_REVISION_RECOMMENDED: Published inline links marked as STALE.
 */
export async function deriveInternalLinkActionableStates(
  db: any
): Promise<InternalLinkActionableState[]> {
  const actionableStates: InternalLinkActionableState[] = [];

  // 1. Detect Orphans
  const orphans = await detectOrphans(db);
  for (const o of orphans) {
    if (o.is_orphan) {
      actionableStates.push({
        type: 'ORPHAN_DETECTED',
        article_id: o.article_id,
        article_title: o.title,
        article_slug: o.slug,
        details: o.reason,
        severity: 'warning'
      });
    }
  }

  // 2. Pending Candidates (LINK_REVIEW_REQUIRED and BACKLINK_RECOMMENDED)
  const pendingLinks = await db.prepare(`
    SELECT l.id, l.source_article_id, l.target_article_id, l.relationship_type, l.placement_plane,
           l.reader_reason, l.anchor_text,
           s.title as source_title, s.slug as source_slug,
           t.title as target_title, t.slug as target_slug
    FROM article_internal_links l
    INNER JOIN articles s ON l.source_article_id = s.id
    INNER JOIN articles t ON l.target_article_id = t.id
    WHERE l.status = 'CANDIDATE'
    ORDER BY l.created_at ASC
  `).all();

  const candidates = pendingLinks.results || pendingLinks || [];
  for (const c of candidates) {
    const isBacklinkRecommendation =
      (c.reader_reason && (
        c.reader_reason.toLowerCase().includes('backlink') ||
        c.reader_reason.toLowerCase().includes('melengkapi pertimbangan') ||
        c.reader_reason.toLowerCase().includes('inbound')
      )) ||
      (c.anchor_text && c.anchor_text.toLowerCase().includes('backlink')) ||
      (orphans.some(o => o.article_id === c.target_article_id && o.is_orphan));

    if (isBacklinkRecommendation) {
      actionableStates.push({
        type: 'BACKLINK_RECOMMENDED',
        article_id: c.source_article_id,
        article_title: c.source_title,
        article_slug: c.source_slug,
        target_article_id: c.target_article_id,
        target_article_title: c.target_title,
        link_id: c.id,
        details: `Backlink opportunity: Connect established article "${c.source_title}" to newly added article "${c.target_title}"`,
        severity: 'info'
      });
    } else {
      actionableStates.push({
        type: 'LINK_REVIEW_REQUIRED',
        article_id: c.source_article_id,
        article_title: c.source_title,
        article_slug: c.source_slug,
        target_article_id: c.target_article_id,
        target_article_title: c.target_title,
        link_id: c.id,
        details: `Candidate ${c.relationship_type} (${c.placement_plane}) requires editorial review`,
        severity: 'action_required'
      });
    }
  }

  // 3. Stale Inline Links (LINK_REVISION_RECOMMENDED)
  const staleLinks = await db.prepare(`
    SELECT l.id, l.source_article_id, l.target_article_id, l.anchor_text,
           s.title as source_title, s.slug as source_slug,
           t.title as target_title
    FROM article_internal_links l
    INNER JOIN articles s ON l.source_article_id = s.id
    INNER JOIN articles t ON l.target_article_id = t.id
    WHERE l.status = 'STALE' AND l.placement_plane = 'PLANE_B_INLINE'
    ORDER BY l.id ASC
  `).all();

  const stales = staleLinks.results || staleLinks || [];
  for (const st of stales) {
    actionableStates.push({
      type: 'LINK_REVISION_RECOMMENDED',
      article_id: st.source_article_id,
      article_title: st.source_title,
      article_slug: st.source_slug,
      target_article_id: st.target_article_id,
      target_article_title: st.target_title,
      link_id: st.id,
      details: `Inline link to "${st.target_title}" became STALE due to source article content hash revision. Revalidation required.`,
      severity: 'action_required'
    });
  }

  return actionableStates;
}
