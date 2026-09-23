/**
 * RancangLoka — Autonomous Continuous Jev Shadow Collector
 * Milestone: JEV-7A
 *
 * Provides completely autonomous, continuous background shadow decision collection
 * in Cloudflare Workers edge runtime without requiring operator attendance, admin browser session,
 * or publication planner activation.
 *
 * Absolute Authority Firewall Invariants:
 * 1. ZERO PUBLICATION AUTHORITY: The collector NEVER creates publication plans, executions,
 *    or publications.
 * 2. ZERO ARTICLE/MEDIA MUTATION: The collector strictly performs READ-ONLY queries on editorial
 *    and media tables.
 * 3. INDEPENDENT OF AUTOMATION MODE: Can run continuously when publication automation mode = OFF
 *    and auto_schedule = false.
 * 4. DEDUPLICATION FIRST: Skips redundant provider calls if identical editorial state (input_hash)
 *    already has a SUCCESS decision observation.
 * 5. ERROR COOLDOWN: Enforces bounded cooldown (default 360 min) before retrying previously failed calls.
 * 6. DURABLE BUDGET GUARDS: Enforces per-run caps and 24-hour daily provider call limits.
 * 7. FAIL-SAFE ISOLATION: Any provider or network failure is recorded safely without throwing
 *    and without affecting any other system.
 */

import {
  type DecisionObservation,
  DECISION_SCHEMA_VERSION,
  DECISION_PROMPT_VERSION
} from './decision-types.ts';
import {
  observeCandidateShadowDecision,
  computeInputHash
} from './decision-observer.ts';

export interface ShadowCollectorConfig {
  enabled: boolean;
  maxSubjectsPerRun: number;
  maxCallsPerRun: number;
  maxCallsPerDay: number;
  errorRetryMinutes: number;
}

export interface ShadowCollectorRunOptions {
  triggerSource?: string;
  config?: Partial<ShadowCollectorConfig>;
  runId?: string;
}

export interface ProspectiveArticleSubject {
  id: number;
  slug: string;
  title: string;
  status: string;
  contentHash: string | null;
  readingTimeMinutes: number;
  isSponsored: boolean;
  featuredAssetId: string | null;
  readinessStatus: string;
  readinessEvaluatedAt: string | null;
}

export interface SubjectEvaluationSummary {
  articleId: number;
  slug: string;
  inputHash: string;
  action: 'DEDUPE_SKIPPED' | 'ERROR_COOLDOWN_SKIPPED' | 'BUDGET_SKIPPED' | 'OBSERVED';
  observationId?: string;
  providerStatus?: string;
  error?: string;
}

export interface ShadowCollectorRunResult {
  status: 'success' | 'blocked' | 'skipped';
  reason?: string;
  runId: string;
  processedCount: number;
  providerCallCount: number;
  dedupeSkippedCount: number;
  observationCreatedCount: number;
  providerErrorCount: number;
  durationMs: number;
  details: {
    collectorEnabled: boolean;
    subjects: SubjectEvaluationSummary[];
    dailyCallsUsed?: number;
    dailyCallsRemaining?: number;
  };
}

export const DEFAULT_SHADOW_COLLECTOR_CONFIG: ShadowCollectorConfig = {
  enabled: false,
  maxSubjectsPerRun: 3,
  maxCallsPerRun: 3,
  maxCallsPerDay: 25,
  errorRetryMinutes: 360
};

/**
 * Resolves Shadow Collector configuration from environment variables or settings table.
 */
export function getShadowCollectorConfig(env?: any): ShadowCollectorConfig {
  const procEnv = typeof process !== 'undefined' ? process.env || {} : {};
  const mergedEnv = env ? { ...procEnv, ...env } : procEnv;

  const isEnabled =
    mergedEnv.JEV_SHADOW_COLLECTOR_ENABLED === 'true' ||
    mergedEnv.JEV_SHADOW_COLLECTOR_ENABLED === true;

  const maxSubjects = Number(mergedEnv.JEV_SHADOW_MAX_SUBJECTS_PER_RUN);
  const maxCallsRun = Number(mergedEnv.JEV_SHADOW_MAX_CALLS_PER_RUN);
  const maxCallsDay = Number(mergedEnv.JEV_SHADOW_MAX_CALLS_PER_DAY);
  const retryMinutes = Number(mergedEnv.JEV_SHADOW_ERROR_RETRY_MINUTES);

  return {
    enabled: isEnabled,
    maxSubjectsPerRun: Number.isFinite(maxSubjects) && maxSubjects > 0 ? maxSubjects : DEFAULT_SHADOW_COLLECTOR_CONFIG.maxSubjectsPerRun,
    maxCallsPerRun: Number.isFinite(maxCallsRun) && maxCallsRun > 0 ? maxCallsRun : DEFAULT_SHADOW_COLLECTOR_CONFIG.maxCallsPerRun,
    maxCallsPerDay: Number.isFinite(maxCallsDay) && maxCallsDay > 0 ? maxCallsDay : DEFAULT_SHADOW_COLLECTOR_CONFIG.maxCallsPerDay,
    errorRetryMinutes: Number.isFinite(retryMinutes) && retryMinutes >= 0 ? retryMinutes : DEFAULT_SHADOW_COLLECTOR_CONFIG.errorRetryMinutes
  };
}

/**
 * Selects prospective draft articles for publication_preflight observation.
 * Strict READ-ONLY semantics: does not mutate readiness or article status.
 */
export async function selectProspectiveArticles(
  db: any,
  limit: number = 3
): Promise<ProspectiveArticleSubject[]> {
  const query = `
    SELECT a.id, a.slug, a.title, a.status, a.content_hash,
           a.reading_time_minutes, a.is_sponsored,
           am.asset_id AS featured_asset_id,
           COALESCE(r.overall_status, 'NOT_READY') AS readiness_status,
           r.is_ready, r.evaluated_at AS readiness_evaluated_at
    FROM articles a
    JOIN article_media am ON a.id = am.article_id AND am.role = 'featured' AND am.is_active = 1
    LEFT JOIN article_publication_readiness r ON a.id = r.article_id
      AND r.id = (
        SELECT id FROM article_publication_readiness
        WHERE article_id = a.id
        ORDER BY evaluated_at DESC, id DESC
        LIMIT 1
      )
    WHERE a.status = 'draft'
    ORDER BY a.id ASC
    LIMIT ?;
  `;

  try {
    const res = await db.prepare(query).bind(limit).all();
    const rows = res.results || res || [];
    return rows.map((r: any) => ({
      id: Number(r.id),
      slug: String(r.slug),
      title: String(r.title),
      status: String(r.status),
      contentHash: r.content_hash ? String(r.content_hash) : null,
      readingTimeMinutes: Number(r.reading_time_minutes) || 5,
      isSponsored: Boolean(r.is_sponsored),
      featuredAssetId: r.featured_asset_id ? String(r.featured_asset_id) : null,
      readinessStatus: r.is_ready ? 'READY_TO_SCHEDULE' : String(r.readiness_status || 'NOT_READY'),
      readinessEvaluatedAt: r.readiness_evaluated_at ? String(r.readiness_evaluated_at) : null
    }));
  } catch (err: any) {
    console.error('[ShadowCollector] Failed to query prospective articles:', err);
    return [];
  }
}

/**
 * Checks existing decision_observations to prevent redundant duplicate calls for identical state.
 */
export async function checkDeduplication(
  db: any,
  params: {
    decisionPoint: string;
    subjectType: string;
    subjectId: string;
    inputHash: string;
    errorRetryMinutes: number;
  }
): Promise<{
  shouldSkip: boolean;
  reason: 'DEDUPE_SUCCESS' | 'ERROR_COOLDOWN' | 'NONE';
  existingObservationId?: string;
}> {
  try {
    const row = await db
      .prepare(`
        SELECT observation_id, provider_status, created_at
        FROM decision_observations
        WHERE decision_point = ?
          AND subject_type = ?
          AND subject_id = ?
          AND input_hash = ?
        ORDER BY created_at DESC
        LIMIT 1;
      `)
      .bind(
        params.decisionPoint,
        params.subjectType,
        params.subjectId,
        params.inputHash
      )
      .first();

    if (!row) {
      return { shouldSkip: false, reason: 'NONE' };
    }

    if (row.provider_status === 'SUCCESS') {
      return {
        shouldSkip: true,
        reason: 'DEDUPE_SUCCESS',
        existingObservationId: row.observation_id
      };
    }

    if (row.provider_status === 'ERROR') {
      const dateStr = String(row.created_at);
      const normalizedIso = dateStr.includes('T') || dateStr.endsWith('Z')
        ? dateStr
        : dateStr.replace(' ', 'T') + 'Z';
      const createdAtMs = new Date(normalizedIso).getTime();
      const elapsedMinutes = (Date.now() - createdAtMs) / (60 * 1000);
      if (elapsedMinutes < params.errorRetryMinutes) {
        return {
          shouldSkip: true,
          reason: 'ERROR_COOLDOWN',
          existingObservationId: row.observation_id
        };
      }
    }

    return { shouldSkip: false, reason: 'NONE' };
  } catch (err: any) {
    console.warn('[ShadowCollector] Deduplication check fallback:', err);
    return { shouldSkip: false, reason: 'NONE' };
  }
}

/**
 * Checks durable 24-hour daily provider call usage from decision_observations.
 */
export async function getDailyProviderCallCount(db: any): Promise<number> {
  try {
    const row = await db
      .prepare(`
        SELECT COUNT(*) AS call_count
        FROM decision_observations
        WHERE provider_status IN ('SUCCESS', 'ERROR')
          AND created_at >= datetime('now', '-24 hours');
      `)
      .first();
    return Number(row?.call_count || 0);
  } catch (err: any) {
    console.warn('[ShadowCollector] Failed to query daily call count:', err);
    return 0;
  }
}

/**
 * Builds candidate decision state for publication_preflight.
 */
export function buildPublicationPreflightState(subject: ProspectiveArticleSubject) {
  return {
    project: 'RancangLoka' as const,
    articleId: subject.id,
    slug: subject.slug,
    articleGenerationCompleted: true,
    editorialValidationPassed: Boolean(subject.contentHash),
    referencesPresent: true,
    heroImagePresent: Boolean(subject.featuredAssetId),
    duplicateSlug: false,
    readinessStatus: subject.readinessStatus,
    readingTimeMinutes: subject.readingTimeMinutes,
    isSponsored: subject.isSponsored
  };
}

/**
 * Runs the autonomous decision shadow collector.
 *
 * Invariant: 100% fail-safe and publication-independent.
 * Never throws an unhandled error.
 */
export async function runDecisionShadowCollector(
  db: any,
  env?: any,
  options: ShadowCollectorRunOptions = {}
): Promise<ShadowCollectorRunResult> {
  const startTime = Date.now();
  const runId = options.runId || `crun_coll_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const config = {
    ...getShadowCollectorConfig(env),
    ...(options.config || {})
  };

  const subjectsSummary: SubjectEvaluationSummary[] = [];
  let providerCalls = 0;
  let dedupeSkipped = 0;
  let observationCreated = 0;
  let providerErrors = 0;

  // 1. Check feature enablement flag
  if (!config.enabled) {
    return {
      status: 'blocked',
      reason: 'SHADOW_COLLECTOR_DISABLED: JEV_SHADOW_COLLECTOR_ENABLED is false',
      runId,
      processedCount: 0,
      providerCallCount: 0,
      dedupeSkippedCount: 0,
      observationCreatedCount: 0,
      providerErrorCount: 0,
      durationMs: Date.now() - startTime,
      details: {
        collectorEnabled: false,
        subjects: []
      }
    };
  }

  // 2. Query 24h daily usage
  const dailyCallsUsed = await getDailyProviderCallCount(db);
  if (dailyCallsUsed >= config.maxCallsPerDay) {
    return {
      status: 'skipped',
      reason: `DAILY_BUDGET_EXHAUSTED: ${dailyCallsUsed}/${config.maxCallsPerDay} daily calls used`,
      runId,
      processedCount: 0,
      providerCallCount: 0,
      dedupeSkippedCount: 0,
      observationCreatedCount: 0,
      providerErrorCount: 0,
      durationMs: Date.now() - startTime,
      details: {
        collectorEnabled: true,
        subjects: [],
        dailyCallsUsed,
        dailyCallsRemaining: 0
      }
    };
  }

  // 3. Select prospective publication candidates
  const subjects = await selectProspectiveArticles(db, config.maxSubjectsPerRun);

  // 4. Process each prospective candidate with deduplication & budget guards
  for (const subject of subjects) {
    const candidateState = buildPublicationPreflightState(subject);
    const inputHash = computeInputHash(candidateState);

    // 4a. Deduplication check
    const dedupe = await checkDeduplication(db, {
      decisionPoint: 'publication_preflight',
      subjectType: 'article',
      subjectId: String(subject.id),
      inputHash,
      errorRetryMinutes: config.errorRetryMinutes
    });

    if (dedupe.shouldSkip) {
      dedupeSkipped++;
      subjectsSummary.push({
        articleId: subject.id,
        slug: subject.slug,
        inputHash,
        action: dedupe.reason === 'DEDUPE_SUCCESS' ? 'DEDUPE_SKIPPED' : 'ERROR_COOLDOWN_SKIPPED',
        observationId: dedupe.existingObservationId
      });
      continue;
    }

    // 4b. Enforce per-run call limit
    if (providerCalls >= config.maxCallsPerRun) {
      subjectsSummary.push({
        articleId: subject.id,
        slug: subject.slug,
        inputHash,
        action: 'BUDGET_SKIPPED'
      });
      continue;
    }

    // 4c. Enforce daily limit check inline
    if (dailyCallsUsed + providerCalls >= config.maxCallsPerDay) {
      subjectsSummary.push({
        articleId: subject.id,
        slug: subject.slug,
        inputHash,
        action: 'BUDGET_SKIPPED'
      });
      continue;
    }

    // 4d. Invoke Jev shadow observer
    try {
      providerCalls++;
      const observation = await observeCandidateShadowDecision(candidateState, {
        db,
        env,
        correlationId: runId,
        authoritativeDecision: 'continue',
        authoritativeReasons: ['DETERMINISTIC_ELIGIBILITY_PASSED']
      });

      if (observation.provider_status === 'SUCCESS') {
        observationCreated++;
        subjectsSummary.push({
          articleId: subject.id,
          slug: subject.slug,
          inputHash,
          action: 'OBSERVED',
          observationId: observation.observation_id,
          providerStatus: 'SUCCESS'
        });
      } else {
        providerErrors++;
        subjectsSummary.push({
          articleId: subject.id,
          slug: subject.slug,
          inputHash,
          action: 'OBSERVED',
          observationId: observation.observation_id,
          providerStatus: observation.provider_status,
          error: observation.provider_error_class || 'UNKNOWN_PROVIDER_ERROR'
        });
      }
    } catch (obsErr: any) {
      providerErrors++;
      subjectsSummary.push({
        articleId: subject.id,
        slug: subject.slug,
        inputHash,
        action: 'OBSERVED',
        providerStatus: 'ERROR',
        error: obsErr?.message || String(obsErr)
      });
    }
  }

  return {
    status: 'success',
    runId,
    processedCount: subjects.length,
    providerCallCount: providerCalls,
    dedupeSkippedCount: dedupeSkipped,
    observationCreatedCount: observationCreated,
    providerErrorCount: providerErrors,
    durationMs: Date.now() - startTime,
    details: {
      collectorEnabled: true,
      subjects: subjectsSummary,
      dailyCallsUsed: dailyCallsUsed + providerCalls,
      dailyCallsRemaining: Math.max(0, config.maxCallsPerDay - (dailyCallsUsed + providerCalls))
    }
  };
}
