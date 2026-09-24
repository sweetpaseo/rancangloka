/**
 * RancangLoka — Canonical Publication Preflight Decision State Builder
 * Milestone: Phase JEV-7C
 *
 * Single authoritative source-of-truth for publication_preflight input state.
 * Consumed identically by:
 * - Publication Planner shadow observer (planner-service.ts)
 * - Autonomous Jev Shadow Collector (shadow-collector.ts)
 * - Future calibration & validation tooling
 *
 * Strict Rules:
 * 1. ONE FIELD = ONE SEMANTIC CONCEPT.
 *    persistedReadinessStatus: D1 database record from pre-publication checklist.
 *    plannerEligibilityStatus: Operational scheduling eligibility under publication policy.
 * 2. Deterministic & Normalized: All primitive types, strictly bounded string unions.
 * 3. Zero authority: Does not create plans, mutate articles, or publish.
 */

import { computeInputHash } from './decision-observer.ts';

export type PersistedReadinessStatus = 'READY_TO_SCHEDULE' | 'NOT_READY' | 'BLOCKED';
export type PlannerEligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE';

export interface CanonicalPublicationPreflightInput {
  project?: 'RancangLoka';
  articleId: number | string;
  slug: string;
  contentHash?: string | null;
  hasContent?: boolean;
  editorialValidationPassed?: boolean;
  referencesPresent?: boolean;
  featuredAssetId?: string | null;
  duplicateSlug?: boolean;
  persistedReadinessStatus?: string | null;
  isReady?: number | boolean | null;
  readingTimeMinutes?: number | null;
  isSponsored?: boolean | null;
  manualHold?: number | boolean | null;
  status?: string | null;
}

export interface CanonicalPreflightContext {
  plannerEligibility?: PlannerEligibilityStatus | boolean | string | null;
  duplicateSlug?: boolean;
}

export interface PublicationPreflightCanonicalState {
  project: 'RancangLoka';
  articleId: number;
  slug: string;
  articleGenerationCompleted: boolean;
  editorialValidationPassed: boolean;
  referencesPresent: boolean;
  heroImagePresent: boolean;
  duplicateSlug: boolean;
  persistedReadinessStatus: PersistedReadinessStatus;
  plannerEligibilityStatus: PlannerEligibilityStatus;
  readingTimeMinutes: number;
  isSponsored: boolean;
}

/**
 * Normalizes persisted editorial readiness status from database record.
 */
export function normalizePersistedReadiness(
  overallStatus?: string | null,
  isReady?: number | boolean | null
): PersistedReadinessStatus {
  if (overallStatus === 'BLOCKED') {
    return 'BLOCKED';
  }
  if (isReady === 1 || isReady === true || overallStatus === 'READY_TO_SCHEDULE') {
    return 'READY_TO_SCHEDULE';
  }
  return 'NOT_READY';
}

/**
 * Normalizes operational planner eligibility status under active publication policy.
 */
export function normalizePlannerEligibility(
  contextEligibility?: PlannerEligibilityStatus | boolean | string | null,
  fallbackInput?: {
    status?: string | null;
    contentHash?: string | null;
    featuredAssetId?: string | null;
    manualHold?: number | boolean | null;
    persistedReadiness?: PersistedReadinessStatus;
  }
): PlannerEligibilityStatus {
  if (contextEligibility !== undefined && contextEligibility !== null) {
    if (contextEligibility === 'ELIGIBLE' || contextEligibility === true) {
      return 'ELIGIBLE';
    }
    return 'NOT_ELIGIBLE';
  }

  // Autonomous derivation when context is omitted:
  // Requires: draft status, content hash present, featured media present, no manual hold, not blocked
  if (!fallbackInput) {
    return 'NOT_ELIGIBLE';
  }

  const isDraft = !fallbackInput.status || fallbackInput.status === 'draft';
  const hasContent = Boolean(fallbackInput.contentHash);
  const hasMedia = Boolean(fallbackInput.featuredAssetId);
  const isHeld = fallbackInput.manualHold === 1 || fallbackInput.manualHold === true;
  const isBlocked = fallbackInput.persistedReadiness === 'BLOCKED';

  if (isDraft && hasContent && hasMedia && !isHeld && !isBlocked) {
    return 'ELIGIBLE';
  }

  return 'NOT_ELIGIBLE';
}

/**
 * Builds the single canonical publication_preflight decision state.
 *
 * Guaranteed to produce identical key ordering, types, and values across
 * both planner and autonomous collector for identical article state.
 */
export function buildCanonicalPublicationPreflightState(
  input: CanonicalPublicationPreflightInput,
  context?: CanonicalPreflightContext
): PublicationPreflightCanonicalState {
  const articleId = Number(input.articleId);
  const slug = String(input.slug || '').trim().toLowerCase();
  const articleGenerationCompleted = input.hasContent !== undefined
    ? Boolean(input.hasContent)
    : Boolean(input.contentHash);
  const editorialValidationPassed = input.editorialValidationPassed !== undefined
    ? Boolean(input.editorialValidationPassed)
    : Boolean(input.contentHash);
  const referencesPresent = input.referencesPresent !== undefined
    ? Boolean(input.referencesPresent)
    : true;
  const heroImagePresent = Boolean(input.featuredAssetId);
  const duplicateSlug = Boolean(context?.duplicateSlug ?? input.duplicateSlug ?? false);

  const persistedReadinessStatus = normalizePersistedReadiness(
    input.persistedReadinessStatus,
    input.isReady
  );

  const plannerEligibilityStatus = normalizePlannerEligibility(
    context?.plannerEligibility,
    {
      status: input.status,
      contentHash: input.contentHash,
      featuredAssetId: input.featuredAssetId,
      manualHold: input.manualHold,
      persistedReadiness: persistedReadinessStatus
    }
  );

  const readingTimeMinutes = Math.max(1, Math.round(Number(input.readingTimeMinutes) || 5));
  const isSponsored = Boolean(input.isSponsored);

  return {
    project: 'RancangLoka',
    articleId,
    slug,
    articleGenerationCompleted,
    editorialValidationPassed,
    referencesPresent,
    heroImagePresent,
    duplicateSlug,
    persistedReadinessStatus,
    plannerEligibilityStatus,
    readingTimeMinutes,
    isSponsored
  };
}

/**
 * Computes deterministic input hash for the canonical preflight state.
 */
export function computeCanonicalPreflightHash(
  state: PublicationPreflightCanonicalState
): string {
  return computeInputHash(state);
}

/**
 * Authoritatively loads the canonical publication preflight input for an article from D1.
 *
 * Invariant: Active featured media is resolved strictly from `article_media`
 * (role = 'featured' AND is_active = 1). Legacy `articles.featured_image` is
 * treated as a non-authoritative presentation mirror and NEVER used as canonical featuredAssetId.
 */
export async function loadCanonicalPublicationPreflightInput(
  db: any,
  articleId: number | string,
  overrides?: Partial<CanonicalPublicationPreflightInput>
): Promise<CanonicalPublicationPreflightInput | null> {
  const numericId = Number(articleId);
  if (!numericId || !Number.isFinite(numericId)) {
    return null;
  }

  const query = `
    SELECT a.id, a.slug, a.status, a.content_hash, a.reading_time_minutes, a.is_sponsored,
           COALESCE(a.manual_hold, 0) AS manual_hold,
           ((a.content_md IS NOT NULL AND LENGTH(a.content_md) > 0) OR (a.content_html IS NOT NULL AND LENGTH(a.content_html) > 0)) AS has_content,
           am.asset_id AS featured_asset_id,
           COALESCE(r.overall_status, 'NOT_READY') AS readiness_status,
           r.is_ready
    FROM articles a
    LEFT JOIN article_media am ON a.id = am.article_id AND am.role = 'featured' AND am.is_active = 1
    LEFT JOIN article_publication_readiness r ON a.id = r.article_id
      AND r.id = (
        SELECT id FROM article_publication_readiness
        WHERE article_id = a.id
        ORDER BY evaluated_at DESC, id DESC
        LIMIT 1
      )
    WHERE a.id = ?
    LIMIT 1;
  `;

  let row: any = null;
  try {
    row = await db.prepare(query).bind(numericId).first();
  } catch {
    return null;
  }

  if (!row) {
    return null;
  }

  const baseInput: CanonicalPublicationPreflightInput = {
    project: 'RancangLoka',
    articleId: numericId,
    slug: String(row.slug || '').trim().toLowerCase(),
    contentHash: row.content_hash ? String(row.content_hash) : null,
    hasContent: Boolean(row.has_content),
    featuredAssetId: row.featured_asset_id ? String(row.featured_asset_id) : null,
    persistedReadinessStatus: String(row.readiness_status || 'NOT_READY'),
    isReady: row.is_ready !== undefined && row.is_ready !== null ? Number(row.is_ready) : null,
    readingTimeMinutes: Math.max(1, Math.round(Number(row.reading_time_minutes) || 5)),
    isSponsored: Boolean(row.is_sponsored),
    manualHold: Number(row.manual_hold) || 0,
    status: String(row.status || 'draft')
  };

  if (overrides) {
    return { ...baseInput, ...overrides };
  }

  return baseInput;
}
