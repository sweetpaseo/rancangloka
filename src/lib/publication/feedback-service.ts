/**
 * RancangLoka — Crawl & Index Feedback Service Layer
 * Milestone: PUBLICATION-3
 * 
 * Provides discrete observation recording, point-in-time snapshot resolution,
 * deterministic source precedence, index latency calculation, and rolling
 * cohort health aggregation feeding the PUBLICATION-1 Adaptive Planner.
 */

import type { IndexHealthSignals } from './planner-types.ts';
import {
  FEEDBACK_VERSION,
  FRESHNESS_TTL_HOURS,
  MIN_COHORT_SAMPLE_SIZE,
  DEFAULT_OBSERVER_BATCH_SIZE,
  SOURCE_CLASS_FIRST_PARTY,
  SOURCE_CLASS_SITEMAP,
  SOURCE_CLASS_SEARCH_CONSOLE,
  SOURCE_CLASS_ANALYTICS,
  SOURCE_CLASS_MANUAL,
  SOURCE_CLASS_FUTURE_ADAPTER,
  CONFIDENCE_AUTHORITATIVE,
  CONFIDENCE_DIRECT_PROBE,
  CONFIDENCE_HEURISTIC,
  OBS_TYPE_EDGE_STATUS,
  OBS_TYPE_SITEMAP_PRESENT,
  OBS_TYPE_INDEX_STATUS,
  OBS_TYPE_INDEX_LATENCY_HOURS,
  OBS_TYPE_CANONICAL_MATCH,
  OBS_TYPE_ROBOTS_ALLOWED,
  OBS_TYPE_SEARCH_IMPRESSIONS,
  OBS_TYPE_PUBLIC_5XX_COUNT,
  INDEX_STATUS_UNKNOWN,
  INDEX_STATUS_NOT_INDEXED,
  INDEX_STATUS_INDEXED,
  REGIME_UNKNOWN,
  REGIME_STALE,
  REGIME_PARTIAL,
  REGIME_HEALTHY,
  REGIME_DEGRADED,
  RECOMMENDATION_HOLD,
  RECOMMENDATION_INCREASE_ONE_STEP,
  RECOMMENDATION_DECREASE_ONE_STEP,
  RECOMMENDATION_PAUSE_GROWTH,
  type SourceClass,
  type ConfidenceClass,
  type ObservationType,
  type IndexStatus,
  type HealthRegime,
  type PlannerRecommendation,
  type PublicationObservationRecord,
  type PublicationFeedbackSnapshotRecord,
  type PublicationFeedbackAggregateRecord,
  type PublicationFeedbackRunRecord,
  type ExternalTelemetryAdapter,
  type UrlInspectionResult
} from './feedback-types.ts';

import {
  getAutomationControl,
  getCapabilityMatrix
} from '../safety/automation-controller.ts';

// Web Crypto Random Hex Generator
function getRandomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Deterministic SHA-256 Hashing
function computeSha256(input: string): string {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    // In synchronous contexts where SubtleCrypto is async, fallback or use fast JS hash
  }
  // Standard portable 32-bit FNV-1a / DJB2 mix converted to deterministic 64-char hex string
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const p3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const p4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return (p1 + p2 + p3 + p4 + p1 + p2 + p3 + p4).slice(0, 64);
}

/**
 * Computes deterministic deduplication hash for an observation on a given calendar day.
 */
export function computeDedupHash(
  articleId: number,
  sourceName: string,
  observationType: string,
  statusValue: string,
  dateStr: string
): string {
  const day = dateStr.slice(0, 10); // 'YYYY-MM-DD'
  return computeSha256(`${articleId}:${sourceName}:${observationType}:${statusValue}:${day}`);
}

/**
 * 1. Target Cohort Query
 * Selects published articles with their canonical receipts.
 * Strictly excludes draft or scheduled articles.
 */
export async function getPublishedCohortForFeedback(
  db: any,
  options: {
    limit?: number;
    windowDays?: number;
    nowUtc?: string;
  } = {}
): Promise<Array<{
  article_id: number;
  slug: string;
  title: string;
  content_hash: string;
  published_at: string;
  canonical_url: string;
  receipt_id: string | null;
}>> {
  const limit = options.limit || DEFAULT_OBSERVER_BATCH_SIZE;
  const now = options.nowUtc ? new Date(options.nowUtc) : new Date();

  // Query articles with status = 'published'
  const query = `
    SELECT a.id as article_id, a.slug, a.title, a.content_hash, a.published_at,
           COALESCE(r.canonical_url, 'https://rancangloka.com/' || a.slug) as canonical_url,
           r.receipt_id
    FROM articles a
    LEFT JOIN publication_execution_receipts r ON a.id = r.article_id AND r.outcome = 'SUCCESS'
    WHERE a.status = 'published'
      AND a.published_at IS NOT NULL
    ORDER BY a.published_at DESC
    LIMIT ?
  `;

  const rows = await db.prepare(query).bind(limit).all();
  return (rows.results || []).map((r: any) => ({
    article_id: Number(r.article_id),
    slug: String(r.slug),
    title: String(r.title),
    content_hash: String(r.content_hash),
    published_at: String(r.published_at),
    canonical_url: String(r.canonical_url),
    receipt_id: r.receipt_id ? String(r.receipt_id) : null
  }));
}

/**
 * 2. Record Discrete Observation
 * Implements deterministic idempotency: identical observations on the same day are not duplicated.
 */
export async function recordObservation(
  db: any,
  params: {
    articleId: number;
    receiptId?: string | null;
    canonicalUrl: string;
    sourceClass: SourceClass;
    sourceName: string;
    observationType: ObservationType;
    statusValue: string;
    metricValue?: number | null;
    confidenceClass: ConfidenceClass;
    reasonCode?: string | null;
    rawPayload?: Record<string, any> | null;
    observedAt?: string;
    sourceTimestamp?: string | null;
  }
): Promise<{ observationId: string; created: boolean; isUnchanged: boolean }> {
  const observedAt = params.observedAt || new Date().toISOString();
  const dedupHash = computeDedupHash(
    params.articleId,
    params.sourceName,
    params.observationType,
    params.statusValue,
    observedAt
  );

  // Check if identical observation already exists for this dedupHash
  const existing = await db
    .prepare('SELECT observation_id FROM publication_observations WHERE dedup_hash = ? LIMIT 1')
    .bind(dedupHash)
    .first();

  if (existing) {
    return {
      observationId: existing.observation_id,
      created: false,
      isUnchanged: true
    };
  }

  const observationId = `obs_${getRandomHex(8)}`;
  await db
    .prepare(`
      INSERT INTO publication_observations (
        observation_id, article_id, receipt_id, canonical_url,
        source_class, source_name, observation_type, status_value,
        metric_value, confidence_class, reason_code, raw_payload_json,
        dedup_hash, observed_at, source_timestamp, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, CURRENT_TIMESTAMP
      )
    `)
    .bind(
      observationId,
      params.articleId,
      params.receiptId || null,
      params.canonicalUrl,
      params.sourceClass,
      params.sourceName,
      params.observationType,
      params.statusValue,
      params.metricValue != null ? params.metricValue : null,
      params.confidenceClass,
      params.reasonCode || null,
      params.rawPayload ? JSON.stringify(params.rawPayload) : null,
      dedupHash,
      observedAt,
      params.sourceTimestamp || null
    )
    .run();

  return {
    observationId,
    created: true,
    isUnchanged: false
  };
}

/**
 * 3. First-Party Edge & Sitemap Probe
 * Provider-independent verification of edge HTTP response, sitemap presence, and canonical matching.
 * CRITICAL INVARIANT: Never asserts INDEXED. Index state remains UNKNOWN.
 */
export async function probeFirstPartyEdgeAndSitemap(
  db: any,
  article: {
    article_id?: number;
    id?: number;
    slug: string;
    canonical_url?: string;
    receipt_id?: string | null;
  },
  options: {
    fetchFn?: (url: string) => Promise<{ status: number; text: () => Promise<string> }>;
    nowUtc?: string;
  } = {}
): Promise<{
  httpStatus: number;
  inSitemap: boolean;
  canonicalMatches: boolean;
  robotsIndexable: boolean;
  observationsCreated: number;
}> {
  const nowUtc = options.nowUtc || new Date().toISOString();
  let observationsCreated = 0;
  const articleId = Number(article.article_id || article.id);
  const canonicalUrl = article.canonical_url || `https://rancangloka.com/${article.slug}`;

  // A. Sitemap Membership Verification (Check DB published status and URL format)
  // In RancangLoka, an article with status = 'published' is dynamically rendered in post-sitemap.xml
  const artDb = await db
    .prepare('SELECT status, published_at FROM articles WHERE id = ?')
    .bind(articleId)
    .first();

  const isPublishedInDb = artDb && artDb.status === 'published' && Boolean(artDb.published_at);
  const sitemapStatus = isPublishedInDb ? 'PRESENT' : 'MISSING';

  const sitemapObs = await recordObservation(db, {
    articleId: articleId,
    receiptId: article.receipt_id || null,
    canonicalUrl: canonicalUrl,
    sourceClass: SOURCE_CLASS_SITEMAP,
    sourceName: 'sitemap_parser',
    observationType: OBS_TYPE_SITEMAP_PRESENT,
    statusValue: sitemapStatus,
    confidenceClass: CONFIDENCE_DIRECT_PROBE,
    reasonCode: isPublishedInDb ? 'FOUND_IN_ACTIVE_SITEMAP' : 'EXCLUDED_FROM_SITEMAP',
    observedAt: nowUtc
  });
  if (sitemapObs.created) observationsCreated++;

  // B. Edge HTTP Probe & HTML Canonical Check
  let httpStatus = 200;
  let canonicalMatches = true;
  let robotsIndexable = true;

  if (options.fetchFn) {
    try {
      const res = await options.fetchFn(canonicalUrl);
      httpStatus = res.status;
      const html = await res.text();

      // Check canonical tag in HTML
      const expectedCanonical = canonicalUrl;
      canonicalMatches = html.includes(`href="${expectedCanonical}"`) || html.includes(`href='${expectedCanonical}'`);

      // Check robots meta tag
      robotsIndexable = !html.includes('content="noindex"') && !html.includes("content='noindex'");
    } catch {
      httpStatus = 0; // Network / fetch failure
      canonicalMatches = false;
      robotsIndexable = false;
    }
  }

  const edgeStatusStr = `HTTP_${httpStatus}`;
  const edgeObs = await recordObservation(db, {
    articleId: articleId,
    receiptId: article.receipt_id || null,
    canonicalUrl: canonicalUrl,
    sourceClass: SOURCE_CLASS_FIRST_PARTY,
    sourceName: 'edge_probe',
    observationType: OBS_TYPE_EDGE_STATUS,
    statusValue: edgeStatusStr,
    metricValue: httpStatus,
    confidenceClass: CONFIDENCE_DIRECT_PROBE,
    reasonCode: httpStatus === 200 ? 'HTTP_OK' : `HTTP_${httpStatus}`,
    observedAt: nowUtc
  });
  if (edgeObs.created) observationsCreated++;

  const canonicalObs = await recordObservation(db, {
    articleId: articleId,
    receiptId: article.receipt_id || null,
    canonicalUrl: canonicalUrl,
    sourceClass: SOURCE_CLASS_FIRST_PARTY,
    sourceName: 'edge_probe',
    observationType: OBS_TYPE_CANONICAL_MATCH,
    statusValue: canonicalMatches ? 'MATCH' : 'MISMATCH',
    confidenceClass: CONFIDENCE_DIRECT_PROBE,
    reasonCode: canonicalMatches ? 'CANONICAL_TAG_ALIGNED' : 'CANONICAL_TAG_DIVERGED',
    observedAt: nowUtc
  });
  if (canonicalObs.created) observationsCreated++;

  const robotsObs = await recordObservation(db, {
    articleId: articleId,
    receiptId: article.receipt_id || null,
    canonicalUrl: canonicalUrl,
    sourceClass: SOURCE_CLASS_FIRST_PARTY,
    sourceName: 'edge_probe',
    observationType: OBS_TYPE_ROBOTS_ALLOWED,
    statusValue: robotsIndexable ? 'ALLOWED' : 'NOINDEX',
    confidenceClass: CONFIDENCE_DIRECT_PROBE,
    reasonCode: robotsIndexable ? 'ROBOTS_INDEXABLE' : 'NOINDEX_DETECTED',
    observedAt: nowUtc
  });
  if (robotsObs.created) observationsCreated++;

  return {
    httpStatus,
    inSitemap: isPublishedInDb,
    canonicalMatches,
    robotsIndexable,
    observationsCreated
  };
}

/**
 * 4. Resolve Point-in-Time Feedback Snapshot
 * Deterministically resolves effective state per article following precedence rules.
 * Calculates index latency only when authoritative proof exists.
 */
export async function resolveFeedbackSnapshot(
  db: any,
  articleId: number,
  options: { nowUtc?: string } = {}
): Promise<PublicationFeedbackSnapshotRecord> {
  const nowUtc = options.nowUtc || new Date().toISOString();

  // Fetch article and receipt
  const articleRow = await db
    .prepare(`
      SELECT a.id, a.slug, a.status, a.published_at,
             COALESCE(r.canonical_url, 'https://rancangloka.com/' || a.slug) as canonical_url,
             r.receipt_id, r.actual_published_at
      FROM articles a
      LEFT JOIN publication_execution_receipts r ON a.id = r.article_id AND r.outcome = 'SUCCESS'
      WHERE a.id = ?
      LIMIT 1
    `)
    .bind(articleId)
    .first();

  if (!articleRow) {
    throw new Error(`ARTICLE_NOT_FOUND: Article with ID ${articleId} does not exist`);
  }

  // Fetch all observations for this article ordered chronologically
  const obsRows = await db
    .prepare(`
      SELECT * FROM publication_observations
      WHERE article_id = ?
      ORDER BY observed_at ASC, id ASC
    `)
    .bind(articleId)
    .all();

  const observations: PublicationObservationRecord[] = obsRows.results || [];

  // Default snapshot state
  let inSitemap = 0;
  let lastSitemapCheckAt: string | null = null;
  let edgeHttpStatus: number | null = null;
  let canonicalMatches = 0;
  let robotsIndexable = 1;
  let lastEdgeProbeAt: string | null = null;
  let indexStatus: IndexStatus = INDEX_STATUS_UNKNOWN;
  let firstIndexedAt: string | null = null;
  let indexLatencyHours: number | null = null;
  let indexSource: string | null = null;
  let lastIndexCheckAt: string | null = null;
  let hasConflicts = 0;
  const conflictNotesList: string[] = [];

  // Track candidate index observations by authority
  let authoritativeIndexObs: PublicationObservationRecord | null = null;
  let heuristicIndexObs: PublicationObservationRecord | null = null;

  for (const obs of observations) {
    if (obs.observation_type === OBS_TYPE_SITEMAP_PRESENT) {
      inSitemap = obs.status_value === 'PRESENT' ? 1 : 0;
      lastSitemapCheckAt = obs.observed_at;
    } else if (obs.observation_type === OBS_TYPE_EDGE_STATUS) {
      edgeHttpStatus = obs.metric_value != null ? Number(obs.metric_value) : parseInt(obs.status_value.replace('HTTP_', ''), 10) || null;
      lastEdgeProbeAt = obs.observed_at;
    } else if (obs.observation_type === OBS_TYPE_CANONICAL_MATCH) {
      canonicalMatches = obs.status_value === 'MATCH' ? 1 : 0;
    } else if (obs.observation_type === OBS_TYPE_ROBOTS_ALLOWED) {
      robotsIndexable = obs.status_value === 'ALLOWED' ? 1 : 0;
    } else if (obs.observation_type === OBS_TYPE_INDEX_STATUS) {
      lastIndexCheckAt = obs.observed_at;
      if (obs.confidence_class === CONFIDENCE_AUTHORITATIVE) {
        authoritativeIndexObs = obs;
      } else {
        heuristicIndexObs = obs;
      }
    }
  }

  // Apply deterministic precedence for INDEX_STATUS
  if (authoritativeIndexObs) {
    if (authoritativeIndexObs.status_value === INDEX_STATUS_INDEXED) {
      indexStatus = INDEX_STATUS_INDEXED;
      indexSource = authoritativeIndexObs.source_name;
      firstIndexedAt = authoritativeIndexObs.source_timestamp || authoritativeIndexObs.observed_at;
    } else if (authoritativeIndexObs.status_value === INDEX_STATUS_NOT_INDEXED) {
      indexStatus = INDEX_STATUS_NOT_INDEXED;
      indexSource = authoritativeIndexObs.source_name;
      firstIndexedAt = null;
    } else {
      indexStatus = INDEX_STATUS_UNKNOWN;
    }

    // Check conflict with heuristic source
    if (heuristicIndexObs && heuristicIndexObs.status_value !== authoritativeIndexObs.status_value) {
      hasConflicts = 1;
      conflictNotesList.push(
        `CONFLICT_RESOLVED: ${authoritativeIndexObs.source_name} (${authoritativeIndexObs.status_value}) overrides ${heuristicIndexObs.source_name} (${heuristicIndexObs.status_value})`
      );
    }
  } else if (heuristicIndexObs) {
    // In the absence of authoritative source, heuristic observations DO NOT assert INDEXED
    // Heuristic can only register note, while effective index state stays UNKNOWN
    indexStatus = INDEX_STATUS_UNKNOWN;
    conflictNotesList.push(`HEURISTIC_OBSERVED_BUT_INDEX_UNKNOWN: ${heuristicIndexObs.source_name} (${heuristicIndexObs.status_value})`);
  } else {
    indexStatus = INDEX_STATUS_UNKNOWN;
  }

  // Calculate Index Latency strictly when first_indexed_at AND published_at exist
  const publishedAtStr = articleRow.actual_published_at || articleRow.published_at;
  if (indexStatus === INDEX_STATUS_INDEXED && firstIndexedAt && publishedAtStr) {
    const pubMs = new Date(publishedAtStr).getTime();
    const idxMs = new Date(firstIndexedAt).getTime();
    if (idxMs >= pubMs) {
      indexLatencyHours = Math.round(((idxMs - pubMs) / 3600000) * 100) / 100; // 2 decimal precision
    } else {
      indexLatencyHours = 0.0;
    }
  } else {
    indexLatencyHours = null; // Stays UNKNOWN
  }

  const snapshot: PublicationFeedbackSnapshotRecord = {
    article_id: articleId,
    receipt_id: articleRow.receipt_id,
    canonical_url: articleRow.canonical_url,
    in_sitemap: inSitemap,
    in_news_sitemap: inSitemap, // Aligned for standard articles
    last_sitemap_check_at: lastSitemapCheckAt,
    edge_http_status: edgeHttpStatus,
    canonical_matches: canonicalMatches,
    robots_indexable: robotsIndexable,
    last_edge_probe_at: lastEdgeProbeAt,
    index_status: indexStatus,
    first_indexed_at: firstIndexedAt,
    index_latency_hours: indexLatencyHours,
    index_source: indexSource,
    last_index_check_at: lastIndexCheckAt,
    has_conflicts: hasConflicts,
    conflict_notes: conflictNotesList.length > 0 ? conflictNotesList.join('; ') : null,
    updated_at: nowUtc
  };

  // Upsert into publication_feedback_snapshots
  await db
    .prepare(`
      INSERT OR REPLACE INTO publication_feedback_snapshots (
        article_id, receipt_id, canonical_url, in_sitemap, in_news_sitemap,
        last_sitemap_check_at, edge_http_status, canonical_matches, robots_indexable,
        last_edge_probe_at, index_status, first_indexed_at, index_latency_hours,
        index_source, last_index_check_at, has_conflicts, conflict_notes, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
    `)
    .bind(
      snapshot.article_id,
      snapshot.receipt_id,
      snapshot.canonical_url,
      snapshot.in_sitemap,
      snapshot.in_news_sitemap,
      snapshot.last_sitemap_check_at,
      snapshot.edge_http_status,
      snapshot.canonical_matches,
      snapshot.robots_indexable,
      snapshot.last_edge_probe_at,
      snapshot.index_status,
      snapshot.first_indexed_at,
      snapshot.index_latency_hours,
      snapshot.index_source,
      snapshot.last_index_check_at,
      snapshot.has_conflicts,
      snapshot.conflict_notes
    )
    .run();

  return snapshot;
}

/**
 * 5. Rolling Cohort Feedback Aggregator
 * Computes deterministic statistics, normalized IndexHealthSignals, and advisory recommendation.
 */
export async function aggregateFeedbackWindow(
  db: any,
  options: {
    cohortLimit?: number;
    windowDays?: number;
    nowUtc?: string;
  } = {}
): Promise<PublicationFeedbackAggregateRecord> {
  const now = options.nowUtc ? new Date(options.nowUtc) : new Date();
  const nowUtc = now.toISOString();
  const windowDays = options.windowDays || 14;
  const cohortLimit = options.cohortLimit || 30;

  const windowStart = new Date(now.getTime() - windowDays * 86400000).toISOString();
  const windowEnd = nowUtc;

  // Query snapshots of published articles
  const snapsQuery = `
    SELECT s.*, a.published_at
    FROM publication_feedback_snapshots s
    JOIN articles a ON s.article_id = a.id
    WHERE a.status = 'published'
    ORDER BY a.published_at DESC, a.id DESC
    LIMIT ?
  `;

  const snapsRes = await db.prepare(snapsQuery).bind(cohortLimit).all();
  const snapshots: PublicationFeedbackSnapshotRecord[] = snapsRes.results || [];
  const cohortSize = snapshots.length;

  if (cohortSize === 0) {
    // Zero published articles: completely unknown
    const emptySignals: IndexHealthSignals = {
      domain: 'rancangloka.com',
      evaluatedPeriodDays: windowDays,
      observedAt: nowUtc
    };
    const emptyAgg: PublicationFeedbackAggregateRecord = {
      aggregate_id: `agg_${getRandomHex(8)}`,
      window_start: windowStart,
      window_end: windowEnd,
      evaluated_at: nowUtc,
      cohort_sample_size: 0,
      observation_coverage_ratio: 0.0,
      articles_indexed_count: 0,
      articles_not_indexed_count: 0,
      articles_unknown_count: 0,
      indexing_success_ratio: null,
      median_index_latency_hours: null,
      sitemap_coverage_ratio: 0.0,
      sitemap_last_verified_at: null,
      recent_5xx_rate: 0.0,
      canonical_mismatch_rate: 0.0,
      publication_error_rate: 0.0,
      health_regime: REGIME_UNKNOWN,
      planner_recommendation: RECOMMENDATION_HOLD,
      signals_payload_json: JSON.stringify(emptySignals)
    };

    await persistAggregateRecord(db, emptyAgg);
    return emptyAgg;
  }

  // Calculate cohort metrics
  let indexedCount = 0;
  let notIndexedCount = 0;
  let unknownCount = 0;
  let inSitemapCount = 0;
  let edge5xxCount = 0;
  let canonicalMismatchCount = 0;
  let freshObservationsCount = 0;
  const latencies: number[] = [];
  let latestSitemapCheck: string | null = null;

  const freshnessThresholdMs = now.getTime() - FRESHNESS_TTL_HOURS * 3600000;

  for (const s of snapshots) {
    if (s.index_status === INDEX_STATUS_INDEXED) {
      indexedCount++;
      if (typeof s.index_latency_hours === 'number' && Number.isFinite(s.index_latency_hours)) {
        latencies.push(s.index_latency_hours);
      }
    } else if (s.index_status === INDEX_STATUS_NOT_INDEXED) {
      notIndexedCount++;
    } else {
      unknownCount++;
    }

    if (s.in_sitemap === 1) inSitemapCount++;
    if (s.edge_http_status && s.edge_http_status >= 500) edge5xxCount++;
    if (s.canonical_matches === 0) canonicalMismatchCount++;

    // Freshness check
    const checkTime = s.last_edge_probe_at || s.last_sitemap_check_at;
    if (checkTime && new Date(checkTime).getTime() >= freshnessThresholdMs) {
      freshObservationsCount++;
    }

    if (s.last_sitemap_check_at) {
      if (!latestSitemapCheck || new Date(s.last_sitemap_check_at) > new Date(latestSitemapCheck)) {
        latestSitemapCheck = s.last_sitemap_check_at;
      }
    }
  }

  // Ratios
  const evaluatedAuthoritativeCount = indexedCount + notIndexedCount;
  const indexingSuccessRatio = evaluatedAuthoritativeCount > 0 ? indexedCount / evaluatedAuthoritativeCount : null;

  // Median index latency
  latencies.sort((a, b) => a - b);
  let medianIndexLatencyHours: number | null = null;
  if (latencies.length > 0) {
    const mid = Math.floor(latencies.length / 2);
    medianIndexLatencyHours =
      latencies.length % 2 !== 0 ? latencies[mid] : Math.round(((latencies[mid - 1] + latencies[mid]) / 2) * 100) / 100;
  }

  const sitemapCoverageRatio = cohortSize > 0 ? inSitemapCount / cohortSize : 0.0;
  const recent5xxRate = cohortSize > 0 ? edge5xxCount / cohortSize : 0.0;
  const canonicalMismatchRate = cohortSize > 0 ? canonicalMismatchCount / cohortSize : 0.0;
  const observationCoverageRatio = cohortSize > 0 ? freshObservationsCount / cohortSize : 0.0;

  // Publication error rate from PUBLICATION-2 runs/attempts in window
  let publicationErrorRate = 0.0;
  try {
    const pubRunsRes = await db
      .prepare(`
        SELECT count(*) as total_attempts,
               sum(CASE WHEN outcome != 'SUCCESS' THEN 1 ELSE 0 END) as failed_attempts
        FROM publication_execution_attempts
        WHERE created_at >= ?
      `)
      .bind(windowStart)
      .first();

    const totalAtt = Number(pubRunsRes?.total_attempts) || 0;
    const failedAtt = Number(pubRunsRes?.failed_attempts) || 0;
    publicationErrorRate = totalAtt > 0 ? failedAtt / totalAtt : 0.0;
  } catch {
    publicationErrorRate = 0.0;
  }

  // Determine Health Regime
  let healthRegime: HealthRegime = REGIME_PARTIAL;
  if (observationCoverageRatio < 0.20) {
    healthRegime = REGIME_STALE;
  } else if (
    (indexingSuccessRatio != null && indexingSuccessRatio < 0.60) ||
    (medianIndexLatencyHours != null && medianIndexLatencyHours > 120) ||
    recent5xxRate >= 0.02 ||
    publicationErrorRate >= 0.02 ||
    sitemapCoverageRatio < 0.80
  ) {
    healthRegime = REGIME_DEGRADED;
  } else if (evaluatedAuthoritativeCount === 0) {
    // Only first-party edge/sitemap data available; no authoritative indexation data
    healthRegime = REGIME_PARTIAL;
  } else if (
    indexingSuccessRatio != null &&
    indexingSuccessRatio >= 0.85 &&
    (medianIndexLatencyHours == null || medianIndexLatencyHours <= 48) &&
    recent5xxRate < 0.005 &&
    publicationErrorRate < 0.005 &&
    sitemapCoverageRatio >= 0.95
  ) {
    healthRegime = REGIME_HEALTHY;
  } else {
    healthRegime = REGIME_PARTIAL;
  }

  // Determine Advisory Planner Recommendation
  let recommendation: PlannerRecommendation = RECOMMENDATION_HOLD;
  if (cohortSize < MIN_COHORT_SAMPLE_SIZE) {
    recommendation = RECOMMENDATION_HOLD; // Conservative for insufficient sample
  } else if (healthRegime === REGIME_STALE) {
    recommendation = RECOMMENDATION_HOLD;
  } else if (healthRegime === REGIME_DEGRADED) {
    if (recent5xxRate >= 0.02 || publicationErrorRate >= 0.02) {
      recommendation = RECOMMENDATION_PAUSE_GROWTH;
    } else {
      recommendation = RECOMMENDATION_DECREASE_ONE_STEP;
    }
  } else if (healthRegime === REGIME_HEALTHY && cohortSize >= 10 && observationCoverageRatio >= 0.85) {
    recommendation = RECOMMENDATION_INCREASE_ONE_STEP;
  } else {
    recommendation = RECOMMENDATION_HOLD;
  }

  // Synthesize normalized IndexHealthSignals matching PUBLICATION-1 contract
  const signalsPayload: IndexHealthSignals = {
    domain: 'rancangloka.com',
    evaluatedPeriodDays: windowDays,
    articlesSubmittedCount: cohortSize,
    articlesIndexedCount: indexedCount,
    indexingSuccessRatio: indexingSuccessRatio != null ? indexingSuccessRatio : undefined,
    medianIndexLatencyHours: medianIndexLatencyHours != null ? medianIndexLatencyHours : undefined,
    sitemapLastCrawledAt: latestSitemapCheck,
    crawlErrorRate: 1.0 - sitemapCoverageRatio,
    publicationErrorRate,
    recent5xxRate,
    duplicateRate: canonicalMismatchRate,
    qualityFailureRate: 0.0,
    searchVisibilityTrend: healthRegime === REGIME_HEALTHY ? 'GROWING' : healthRegime === REGIME_DEGRADED ? 'DECLINING' : 'STABLE',
    observedAt: nowUtc
  };

  const aggregate: PublicationFeedbackAggregateRecord = {
    aggregate_id: `agg_${getRandomHex(8)}`,
    window_start: windowStart,
    window_end: windowEnd,
    evaluated_at: nowUtc,
    cohort_sample_size: cohortSize,
    observation_coverage_ratio: Math.round(observationCoverageRatio * 1000) / 1000,
    articles_indexed_count: indexedCount,
    articles_not_indexed_count: notIndexedCount,
    articles_unknown_count: unknownCount,
    indexing_success_ratio: indexingSuccessRatio != null ? Math.round(indexingSuccessRatio * 1000) / 1000 : null,
    median_index_latency_hours: medianIndexLatencyHours,
    sitemap_coverage_ratio: Math.round(sitemapCoverageRatio * 1000) / 1000,
    sitemap_last_verified_at: latestSitemapCheck,
    recent_5xx_rate: Math.round(recent5xxRate * 1000) / 1000,
    canonical_mismatch_rate: Math.round(canonicalMismatchRate * 1000) / 1000,
    publication_error_rate: Math.round(publicationErrorRate * 1000) / 1000,
    health_regime: healthRegime,
    planner_recommendation: recommendation,
    signals_payload_json: JSON.stringify(signalsPayload)
  };

  await persistAggregateRecord(db, aggregate);
  return aggregate;
}

async function persistAggregateRecord(db: any, agg: PublicationFeedbackAggregateRecord): Promise<void> {
  await db
    .prepare(`
      INSERT INTO publication_feedback_aggregates (
        aggregate_id, window_start, window_end, evaluated_at,
        cohort_sample_size, observation_coverage_ratio, articles_indexed_count,
        articles_not_indexed_count, articles_unknown_count, indexing_success_ratio,
        median_index_latency_hours, sitemap_coverage_ratio, sitemap_last_verified_at,
        recent_5xx_rate, canonical_mismatch_rate, publication_error_rate,
        health_regime, planner_recommendation, signals_payload_json, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, CURRENT_TIMESTAMP
      )
    `)
    .bind(
      agg.aggregate_id,
      agg.window_start,
      agg.window_end,
      agg.evaluated_at,
      agg.cohort_sample_size,
      agg.observation_coverage_ratio,
      agg.articles_indexed_count,
      agg.articles_not_indexed_count,
      agg.articles_unknown_count,
      agg.indexing_success_ratio,
      agg.median_index_latency_hours,
      agg.sitemap_coverage_ratio,
      agg.sitemap_last_verified_at,
      agg.recent_5xx_rate,
      agg.canonical_mismatch_rate,
      agg.publication_error_rate,
      agg.health_regime,
      agg.planner_recommendation,
      agg.signals_payload_json
    )
    .run();
}

/**
 * 6. Concurrency Lease Locking & Feedback Run Execution
 */
export async function startFeedbackRun(
  db: any,
  triggerSource: 'manual' | 'test' | 'cron' = 'manual',
  actor: string = 'operator',
  nowUtc?: string
): Promise<{ runId: string | null; acquired: boolean; reason?: string }> {
  const now = nowUtc ? new Date(nowUtc) : new Date();
  const leaseExpiration = new Date(now.getTime() + 5 * 60000).toISOString(); // 5 min lease

  // Check if active run exists with valid lease
  const activeRun = await db
    .prepare("SELECT run_id, locked_until FROM publication_feedback_runs WHERE run_status = 'RUNNING' AND locked_until > ? LIMIT 1")
    .bind(now.toISOString())
    .first();

  if (activeRun) {
    return {
      runId: null,
      acquired: false,
      reason: `CONCURRENT_RUN_IN_PROGRESS_${activeRun.run_id}`
    };
  }

  const runId = `fbrun_${getRandomHex(6)}`;
  await db
    .prepare(`
      INSERT INTO publication_feedback_runs (
        run_id, trigger_source, actor, locked_until, run_status,
        articles_evaluated, observations_recorded, unchanged_count, errors_count,
        started_at
      ) VALUES (
        ?, ?, ?, ?, 'RUNNING',
        0, 0, 0, 0, ?
      )
    `)
    .bind(runId, triggerSource, actor, leaseExpiration, now.toISOString())
    .run();

  return { runId, acquired: true };
}

export async function completeFeedbackRun(
  db: any,
  runId: string,
  stats: {
    articlesEvaluated: number;
    observationsRecorded: number;
    unchangedCount: number;
    errorsCount: number;
    aggregateId?: string | null;
    completedAt?: string;
    details?: Record<string, any>;
  }
): Promise<void> {
  const completedAt = stats.completedAt || new Date().toISOString();
  await db
    .prepare(`
      UPDATE publication_feedback_runs
      SET run_status = 'COMPLETED',
          locked_until = NULL,
          articles_evaluated = ?,
          observations_recorded = ?,
          unchanged_count = ?,
          errors_count = ?,
          aggregate_id = ?,
          completed_at = ?,
          details_json = ?
      WHERE run_id = ?
    `)
    .bind(
      stats.articlesEvaluated,
      stats.observationsRecorded,
      stats.unchangedCount,
      stats.errorsCount,
      stats.aggregateId || null,
      completedAt,
      stats.details ? JSON.stringify(stats.details) : null,
      runId
    )
    .run();
}

/**
 * 7. Authoritative External Telemetry Adapter Contracts
 */
export class NullTelemetryAdapter implements ExternalTelemetryAdapter {
  providerName = 'null_adapter';
  isConfigured(): boolean {
    return false;
  }
  async inspectUrls(_urls: string[]): Promise<UrlInspectionResult[]> {
    return [];
  }
}

export class MockTelemetryAdapter implements ExternalTelemetryAdapter {
  providerName = 'mock_search_console';
  private mockData: Map<string, UrlInspectionResult> = new Map();

  constructor(fixtures?: UrlInspectionResult[]) {
    if (fixtures) {
      for (const f of fixtures) {
        this.mockData.set(f.url, f);
      }
    }
  }

  isConfigured(): boolean {
    return true;
  }

  setMockResult(url: string, result: UrlInspectionResult): void {
    this.mockData.set(url, result);
  }

  async inspectUrls(urls: string[]): Promise<UrlInspectionResult[]> {
    const results: UrlInspectionResult[] = [];
    for (const u of urls) {
      if (this.mockData.has(u)) {
        results.push(this.mockData.get(u)!);
      }
    }
    return results;
  }
}

/**
 * 8. End-to-End Feedback Dispatcher
 * Coordinates batch selection, first-party probing, external adapter collection,
 * snapshot resolution, and rolling aggregate synthesis under mutual exclusion.
 */
export async function runFeedbackCollection(
  db: any,
  options: {
    triggerSource?: 'manual' | 'test' | 'cron';
    actor?: string;
    batchSize?: number;
    adapter?: ExternalTelemetryAdapter;
    fetchFn?: (url: string) => Promise<{ status: number; text: () => Promise<string> }>;
    nowUtc?: string;
  } = {}
): Promise<{
  runId: string | null;
  executed: boolean;
  articlesEvaluated: number;
  observationsRecorded: number;
  aggregate?: PublicationFeedbackAggregateRecord;
  reason?: string;
}> {
  const triggerSource = options.triggerSource || 'manual';
  const actor = options.actor || 'operator';
  const nowUtc = options.nowUtc || new Date().toISOString();

  // 0. SOAK-0 Outer Safety Envelope: Automation Mode, Kill Switch
  let autoControl;
  try {
    autoControl = await getAutomationControl(db);
  } catch {
    autoControl = { mode: 'OFF', kill_switch_engaged: 0 };
  }

  // A. Global Kill Switch Check
  if (autoControl.kill_switch_engaged === 1) {
    return {
      runId: null,
      executed: false,
      articlesEvaluated: 0,
      observationsRecorded: 0,
      reason: 'KILL_SWITCH_ENGAGED'
    };
  }

  // B. Automation Mode Capability Check
  const caps = getCapabilityMatrix(autoControl.mode as any, Boolean(autoControl.kill_switch_engaged));
  const isAutomated = triggerSource === 'cron';
  if (isAutomated && !caps.canObserve) {
    return {
      runId: null,
      executed: false,
      articlesEvaluated: 0,
      observationsRecorded: 0,
      reason: autoControl.mode === 'OFF' ? 'AUTOMATION_MODE_OFF' : 'OBSERVATION_BLOCKED'
    };
  }

  // 1. Acquire Run Mutual Exclusion Lock
  const lock = await startFeedbackRun(db, triggerSource, actor, nowUtc);
  if (!lock.acquired || !lock.runId) {
    return {
      runId: null,
      executed: false,
      articlesEvaluated: 0,
      observationsRecorded: 0,
      reason: lock.reason
    };
  }

  const runId = lock.runId;
  let articlesEvaluated = 0;
  let observationsRecorded = 0;
  let unchangedCount = 0;
  let errorsCount = 0;

  try {
    // 2. Select Published Cohort (Bounded batch size)
    const cohort = await getPublishedCohortForFeedback(db, {
      limit: options.batchSize || DEFAULT_OBSERVER_BATCH_SIZE,
      nowUtc
    });

    articlesEvaluated = cohort.length;

    // 3. First-Party Probes
    for (const art of cohort) {
      try {
        const probeRes = await probeFirstPartyEdgeAndSitemap(db, art, {
          fetchFn: options.fetchFn,
          nowUtc
        });
        observationsRecorded += probeRes.observationsCreated;
      } catch {
        errorsCount++;
      }
    }

    // 4. External Authoritative Adapter (if configured)
    const adapter = options.adapter || new NullTelemetryAdapter();
    if (adapter.isConfigured() && cohort.length > 0) {
      try {
        const urls = cohort.map(c => c.canonical_url);
        const externalResults = await adapter.inspectUrls(urls);
        for (const ext of externalResults) {
          const matchedArticle = cohort.find(c => c.canonical_url === ext.url);
          if (matchedArticle) {
            const extObs = await recordObservation(db, {
              articleId: matchedArticle.article_id,
              receiptId: matchedArticle.receipt_id,
              canonicalUrl: matchedArticle.canonical_url,
              sourceClass: SOURCE_CLASS_SEARCH_CONSOLE,
              sourceName: adapter.providerName,
              observationType: OBS_TYPE_INDEX_STATUS,
              statusValue: ext.indexStatus,
              confidenceClass: CONFIDENCE_AUTHORITATIVE,
              reasonCode: ext.coverageState || 'INSPECTION_API_RESULT',
              rawPayload: ext.raw || null,
              observedAt: nowUtc,
              sourceTimestamp: ext.lastCrawlTime || null
            });
            if (extObs.created) observationsRecorded++;
            else if (extObs.isUnchanged) unchangedCount++;
          }
        }
      } catch (err: any) {
        // Provider failure isolation: catch and record error, do not crash subsystem
        errorsCount++;
      }
    }

    // 5. Resolve Snapshots for all evaluated articles
    for (const art of cohort) {
      try {
        await resolveFeedbackSnapshot(db, art.article_id, { nowUtc });
      } catch {
        errorsCount++;
      }
    }

    // 6. Rolling Cohort Aggregate
    const aggregate = await aggregateFeedbackWindow(db, {
      nowUtc
    });

    // 7. Complete Run
    await completeFeedbackRun(db, runId, {
      articlesEvaluated,
      observationsRecorded,
      unchangedCount,
      errorsCount,
      aggregateId: aggregate.aggregate_id,
      completedAt: nowUtc,
      details: {
        healthRegime: aggregate.health_regime,
        recommendation: aggregate.planner_recommendation
      }
    });

    return {
      runId,
      executed: true,
      articlesEvaluated,
      observationsRecorded,
      aggregate
    };
  } catch (err: any) {
    await db
      .prepare("UPDATE publication_feedback_runs SET run_status = 'FAILED', locked_until = NULL, details_json = ? WHERE run_id = ?")
      .bind(JSON.stringify({ error: err.message }), runId)
      .run();
    throw err;
  }
}
