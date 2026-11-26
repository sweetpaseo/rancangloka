/**
 * RancangLoka — Canonical Topic Registry, Atomic Reservation & Inventory Reconciliation Service
 * Milestone: UTLIS-V1 (Phase 1 & Cross-Environment Identity Reconciliation)
 *
 * Strict Invariants:
 * 1. Persistent D1 Single Source of Truth (`editorial_topics`, `topic_decision_history`,
 *    `topic_reservations`, `global_article_identity_map`).
 * 2. Atomic Conditional Writes for Reservations (no unprotected read-then-write).
 * 3. Staging Article ID and Production Article ID are NEVER conflated as the same global identity.
 * 4. Test fixtures / smoke tests (`is_test_fixture = 1`) are isolated from operational inventory.
 * 5. Zero publication authority, zero auto-publish, zero paid LLM calls.
 */

import crypto from 'node:crypto';
import { slugifyText } from '../seo.ts';
import {
  DISPATCHABLE_STATUSES,
  isValidTopicTransition,
  mapArticleStatusToTopicStatus,
  type DuplicateScreeningResult,
  type EditorialTopicRecord,
  type EnvironmentScope,
  type GlobalArticleIdentityRecord,
  type ProductionChannel,
  type TopicDecisionHistoryRecord,
  type TopicLifecycleStatus,
  type TopicReservationRecord
} from './topic-lifecycle-contracts.ts';
import { screenTopicCandidateWithD1 } from './duplicate-prevention-service.ts';
import { indexResearchEvidencePack, type ResearchIndexInput } from './research-repository-service.ts';

export interface UpsertTopicInput {
  topic_id?: string;
  canonical_topic_key?: string;
  angle_key?: string;
  angle_index?: number;
  category_id: number;
  subcategory?: string | null;
  topic_family?: string | null;
  topic_cluster?: string | null;
  candidate_title: string;
  canonical_slug?: string | null;
  focus_keyword: string;
  supporting_keywords?: string[];
  search_intent?: string;
  content_angle?: string;
  reader_need?: string | null;
  archetype?: string | null;
  seasonality?: string;
  estimated_word_count?: number;
  discovery_source?: string;
  proposing_staff?: string;
  epis_score?: number;
  priority_rank?: number;
  priority_rationale?: string | null;
  lifecycle_status?: TopicLifecycleStatus;
  related_task_id?: string | null;
  related_research_id?: string | null;
  related_article_id?: number | null;
  canonical_article_uid?: string | null;
  published_url?: string | null;
  environment_scope?: EnvironmentScope;
  is_test_fixture?: boolean;
  override_duplicate_warning?: boolean;
  override_reason?: string;
}

export function isTestFixtureTitleOrSlug(title: string, slug?: string | null): boolean {
  const t = (title || '').toLowerCase();
  const s = (slug || '').toLowerCase();
  return (
    t.includes('smoke test') ||
    t.includes('sender smoke') ||
    t.includes('uji ingest') ||
    t.includes('uji coba') ||
    t.includes('canary #') ||
    t.includes('uji mandiri tona') ||
    s.includes('smoke-test') ||
    s.includes('sender-smoke') ||
    s.includes('uji-ingest') ||
    s.includes('uji-coba') ||
    s.includes('tona0y') ||
    s.includes('tona6d') ||
    s.includes('toncd0')
  );
}

function makeDecisionId(): string {
  return `tdec_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

export async function recordTopicDecision(
  db: any,
  params: {
    topic_id: string;
    previous_status: string | null;
    new_status: string;
    actor: string;
    reason: string;
    event_ref?: string | null;
    task_id?: string | null;
    override_flag?: boolean;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  if (!db || typeof db.prepare !== 'function') return;
  await db
    .prepare(`
      INSERT INTO topic_decision_history (
        decision_id, topic_id, previous_status, new_status, actor, reason,
        event_ref, task_id, override_flag, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      makeDecisionId(),
      params.topic_id,
      params.previous_status,
      params.new_status,
      params.actor,
      params.reason,
      params.event_ref || null,
      params.task_id || null,
      params.override_flag ? 1 : 0,
      params.metadata ? JSON.stringify(params.metadata) : null
    )
    .run();
}

/**
 * Creates or updates a topic/angle in `editorial_topics` after running 5-layer duplicate screening.
 */
export async function registerOrUpdateEditorialTopic(
  db: any,
  input: UpsertTopicInput,
  actor: string = 'maya',
  options?: { skipDuplicateScreening?: boolean }
): Promise<{
  success: boolean;
  topic_id: string;
  screening: DuplicateScreeningResult | null;
  blocked_by_duplicate?: boolean;
  message: string;
}> {
  const slug = input.canonical_slug ? slugifyText(input.canonical_slug) : slugifyText(input.candidate_title);
  const canonicalKey = input.canonical_topic_key || slugifyText(input.focus_keyword || input.candidate_title);
  const angleKey = input.angle_key || 'primary';
  const topicId = input.topic_id || `TOPIC-${canonicalKey.slice(0, 24).toUpperCase()}-${angleKey.slice(0, 12).toUpperCase()}`;
  const isFixture = input.is_test_fixture ?? isTestFixtureTitleOrSlug(input.candidate_title, slug);

  let screening: DuplicateScreeningResult | null = null;
  if (!options?.skipDuplicateScreening && !isFixture) {
    screening = await screenTopicCandidateWithD1(db, {
      topic_id: topicId,
      canonical_topic_key: canonicalKey,
      angle_key: angleKey,
      title: input.candidate_title,
      slug,
      focus_keyword: input.focus_keyword,
      supporting_keywords: input.supporting_keywords,
      search_intent: input.search_intent || 'Informational',
      content_angle: input.content_angle || 'Panduan Praktis Rumah Tropis',
      reader_need: input.reader_need || undefined,
      category_id: input.category_id,
      topic_family: input.topic_family || undefined,
      screening_stage: 'DISCOVERY'
    });

    if (screening.action === 'BLOCK' && !input.override_duplicate_warning) {
      return {
        success: false,
        topic_id: topicId,
        screening,
        blocked_by_duplicate: true,
        message: `Ditolak oleh Duplicate Prevention Gate: ${screening.decision_rationale}`
      };
    }
  }

  const initialStatus: TopicLifecycleStatus = input.lifecycle_status || 'DISCOVERED';

  if (db && typeof db.prepare === 'function') {
    const existing = await db
      .prepare('SELECT topic_id, lifecycle_status FROM editorial_topics WHERE topic_id = ? LIMIT 1')
      .bind(topicId)
      .first() as { topic_id: string; lifecycle_status: string } | null;

    await db
      .prepare(`
        INSERT INTO editorial_topics (
          topic_id, canonical_topic_key, angle_key, angle_index, category_id, subcategory,
          topic_family, topic_cluster, candidate_title, canonical_slug, focus_keyword,
          supporting_keywords_json, search_intent, content_angle, reader_need, archetype,
          seasonality, estimated_word_count, discovery_source, proposing_staff,
          epis_score, priority_rank, priority_rationale, lifecycle_status,
          related_task_id, related_research_id, related_article_id, canonical_article_uid,
          published_url, environment_scope, is_test_fixture, duplicate_screening_json,
          decision_summary, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(topic_id) DO UPDATE SET
          category_id = excluded.category_id,
          subcategory = COALESCE(excluded.subcategory, editorial_topics.subcategory),
          topic_family = COALESCE(excluded.topic_family, editorial_topics.topic_family),
          topic_cluster = COALESCE(excluded.topic_cluster, editorial_topics.topic_cluster),
          candidate_title = excluded.candidate_title,
          canonical_slug = COALESCE(excluded.canonical_slug, editorial_topics.canonical_slug),
          focus_keyword = excluded.focus_keyword,
          supporting_keywords_json = excluded.supporting_keywords_json,
          search_intent = excluded.search_intent,
          content_angle = excluded.content_angle,
          reader_need = COALESCE(excluded.reader_need, editorial_topics.reader_need),
          epis_score = CASE WHEN excluded.epis_score > 0 THEN excluded.epis_score ELSE editorial_topics.epis_score END,
          priority_rank = CASE WHEN excluded.priority_rank > 0 THEN excluded.priority_rank ELSE editorial_topics.priority_rank END,
          priority_rationale = COALESCE(excluded.priority_rationale, editorial_topics.priority_rationale),
          related_task_id = COALESCE(excluded.related_task_id, editorial_topics.related_task_id),
          related_research_id = COALESCE(excluded.related_research_id, editorial_topics.related_research_id),
          related_article_id = COALESCE(excluded.related_article_id, editorial_topics.related_article_id),
          canonical_article_uid = COALESCE(excluded.canonical_article_uid, editorial_topics.canonical_article_uid),
          published_url = COALESCE(excluded.published_url, editorial_topics.published_url),
          duplicate_screening_json = COALESCE(excluded.duplicate_screening_json, editorial_topics.duplicate_screening_json),
          decision_summary = COALESCE(excluded.decision_summary, editorial_topics.decision_summary),
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        topicId,
        canonicalKey,
        angleKey,
        input.angle_index ?? 1,
        input.category_id,
        input.subcategory || null,
        input.topic_family || null,
        input.topic_cluster || null,
        input.candidate_title,
        slug,
        input.focus_keyword,
        JSON.stringify(input.supporting_keywords || []),
        input.search_intent || 'Informational',
        input.content_angle || 'Panduan Praktis Rumah Tropis',
        input.reader_need || null,
        input.archetype || 'Spatial Planning',
        input.seasonality || 'EVERGREEN',
        input.estimated_word_count ?? 1350,
        input.discovery_source || 'MAYA_STRATEGY',
        input.proposing_staff || actor,
        input.epis_score ?? 0,
        input.priority_rank ?? 0,
        input.priority_rationale || null,
        initialStatus,
        input.related_task_id || null,
        input.related_research_id || null,
        input.related_article_id ?? null,
        input.canonical_article_uid || null,
        input.published_url || null,
        input.environment_scope || 'production',
        isFixture ? 1 : 0,
        screening ? JSON.stringify(screening) : null,
        input.override_reason || screening?.decision_rationale || null
      )
      .run();

    if (!existing) {
      await recordTopicDecision(db, {
        topic_id: topicId,
        previous_status: null,
        new_status: initialStatus,
        actor,
        reason: input.override_duplicate_warning
          ? `Registered with Owner override: ${input.override_reason || 'Editorial exception'}`
          : `Topic registered via ${input.discovery_source || 'MAYA_STRATEGY'}`,
        override_flag: Boolean(input.override_duplicate_warning),
        metadata: screening ? { action: screening.action, score: screening.highest_similarity_score } : undefined
      });
    }
  }

  return {
    success: true,
    topic_id: topicId,
    screening,
    message: `Topik ${topicId} terdaftar dalam Canonical Topic Registry.`
  };
}

/**
 * Transitions a topic's lifecycle state using the canonical state machine.
 */
export async function transitionTopicLifecycle(
  db: any,
  topicId: string,
  nextStatus: TopicLifecycleStatus,
  actor: string,
  reason: string,
  options?: {
    eventRef?: string;
    taskId?: string;
    researchId?: string;
    articleId?: number;
    canonicalArticleUid?: string;
    publishedUrl?: string;
    force?: boolean;
  }
): Promise<{ success: boolean; previous_status: TopicLifecycleStatus | null; new_status: TopicLifecycleStatus; message: string }> {
  if (!db || typeof db.prepare !== 'function') {
    return { success: false, previous_status: null, new_status: nextStatus, message: 'D1 unavailable' };
  }

  const row = await db
    .prepare('SELECT lifecycle_status FROM editorial_topics WHERE topic_id = ? LIMIT 1')
    .bind(topicId)
    .first() as { lifecycle_status: TopicLifecycleStatus } | null;

  if (!row) {
    return { success: false, previous_status: null, new_status: nextStatus, message: `Topic ${topicId} not found.` };
  }

  const prev = row.lifecycle_status;
  if (!options?.force && !isValidTopicTransition(prev, nextStatus)) {
    return {
      success: false,
      previous_status: prev,
      new_status: nextStatus,
      message: `Invalid topic lifecycle transition: ${prev} -> ${nextStatus}`
    };
  }

  await db
    .prepare(`
      UPDATE editorial_topics
      SET lifecycle_status = ?,
          related_task_id = COALESCE(?, related_task_id),
          related_research_id = COALESCE(?, related_research_id),
          related_article_id = COALESCE(?, related_article_id),
          canonical_article_uid = COALESCE(?, canonical_article_uid),
          published_url = COALESCE(?, published_url),
          decision_summary = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE topic_id = ?
    `)
    .bind(
      nextStatus,
      options?.taskId || null,
      options?.researchId || null,
      options?.articleId ?? null,
      options?.canonicalArticleUid || null,
      options?.publishedUrl || null,
      reason,
      topicId
    )
    .run();

  await recordTopicDecision(db, {
    topic_id: topicId,
    previous_status: prev,
    new_status: nextStatus,
    actor,
    reason,
    event_ref: options?.eventRef || null,
    task_id: options?.taskId || null
  });

  return {
    success: true,
    previous_status: prev,
    new_status: nextStatus,
    message: `Topic ${topicId} transitioned ${prev} -> ${nextStatus}`
  };
}

/**
 * ATOMIC TOPIC RESERVATION (Concurrency & Double-Dispatch Prevention)
 *
 * Uses:
 * 1. Idempotency key replay check.
 * 2. Atomic conditional UPDATE on `editorial_topics` (must be in dispatchable state).
 * 3. Unique partial index `idx_topic_res_active_unique` on `topic_reservations(topic_id) WHERE reservation_status = 'ACTIVE'`.
 * 4. Rollback of `editorial_topics` if `topic_reservations` insert fails.
 */
export async function reserveTopicAtomically(
  db: any,
  params: {
    topic_id: string;
    task_id: string;
    production_channel: ProductionChannel;
    lease_owner: string;
    idempotency_key: string;
    lease_ttl_minutes?: number;
  }
): Promise<{
  reserved: boolean;
  replayed?: boolean;
  reservation: TopicReservationRecord | null;
  reason: string;
}> {
  if (!db || typeof db.prepare !== 'function') {
    return { reserved: false, reservation: null, reason: 'DATABASE_UNAVAILABLE' };
  }

  // 1. Check idempotency replay first
  const existingIdemp = await db
    .prepare('SELECT * FROM topic_reservations WHERE idempotency_key = ? LIMIT 1')
    .bind(params.idempotency_key)
    .first() as TopicReservationRecord | null;

  if (existingIdemp) {
    return {
      reserved: existingIdemp.reservation_status === 'ACTIVE',
      replayed: true,
      reservation: existingIdemp,
      reason: `Idempotent replay for key ${params.idempotency_key} (status: ${existingIdemp.reservation_status}).`
    };
  }

  // 2. Load topic metadata for canonical_topic_key & angle_key
  const topic = await db
    .prepare('SELECT topic_id, canonical_topic_key, angle_key, lifecycle_status, is_test_fixture FROM editorial_topics WHERE topic_id = ? LIMIT 1')
    .bind(params.topic_id)
    .first() as Pick<EditorialTopicRecord, 'topic_id' | 'canonical_topic_key' | 'angle_key' | 'lifecycle_status' | 'is_test_fixture'> | null;

  if (!topic) {
    return { reserved: false, reservation: null, reason: `TOPIC_NOT_FOUND: ${params.topic_id}` };
  }

  if (topic.is_test_fixture === 1) {
    return { reserved: false, reservation: null, reason: `FIXTURE_ISOLATED: ${params.topic_id} adalah data uji.` };
  }

  if (!DISPATCHABLE_STATUSES.has(topic.lifecycle_status) && topic.lifecycle_status !== 'DISCOVERED') {
    const activeRes = await db
      .prepare(`SELECT * FROM topic_reservations WHERE topic_id = ? AND reservation_status = 'ACTIVE' LIMIT 1`)
      .bind(params.topic_id)
      .first() as TopicReservationRecord | null;

    return {
      reserved: false,
      reservation: activeRes,
      reason: `TOPIC_NOT_DISPATCHABLE: Topik ${params.topic_id} berada pada status ${topic.lifecycle_status}.`
    };
  }

  // 3. Atomic conditional UPDATE on editorial_topics
  const ttlMinutes = params.lease_ttl_minutes ?? 120;
  const leaseExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const reservationId = `res_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  const maxTokenRow = await db
    .prepare('SELECT COALESCE(MAX(fencing_token), 0) as max_tok FROM topic_reservations WHERE topic_id = ?')
    .bind(params.topic_id)
    .first() as { max_tok: number } | null;
  const nextFencingToken = Number(maxTokenRow?.max_tok || 0) + 1;

  const updateRes = await db
    .prepare(`
      UPDATE editorial_topics
      SET lifecycle_status = 'RESERVED',
          related_task_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE topic_id = ?
        AND lifecycle_status IN ('DISCOVERED', 'KEYWORD_VALIDATED', 'PRIORITIZED', 'READY_FOR_RESEARCH', 'RESEARCH_READY', 'READY_FOR_WRITING')
        AND is_test_fixture = 0
    `)
    .bind(params.task_id, params.topic_id)
    .run();

  const changes = Number(updateRes?.meta?.changes ?? 0);
  if (changes === 0) {
    const activeRes = await db
      .prepare(`SELECT * FROM topic_reservations WHERE topic_id = ? AND reservation_status = 'ACTIVE' LIMIT 1`)
      .bind(params.topic_id)
      .first() as TopicReservationRecord | null;

    return {
      reserved: false,
      reservation: activeRes,
      reason: `CONCURRENT_RESERVATION_CONFLICT: Topik ${params.topic_id} sudah direservasi atau diproses oleh worker lain.`
    };
  }

  // 4. Insert into topic_reservations (enforced by partial unique index idx_topic_res_active_unique)
  try {
    await db
      .prepare(`
        INSERT INTO topic_reservations (
          reservation_id, topic_id, canonical_topic_key, angle_key, task_id,
          production_channel, lease_owner, lease_expires_at, idempotency_key,
          fencing_token, reservation_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `)
      .bind(
        reservationId,
        params.topic_id,
        topic.canonical_topic_key,
        topic.angle_key,
        params.task_id,
        params.production_channel,
        params.lease_owner,
        leaseExpiresAt,
        params.idempotency_key,
        nextFencingToken
      )
      .run();
  } catch (err: any) {
    // Compensating rollback on editorial_topics if reservation insert collided
    await db
      .prepare(`UPDATE editorial_topics SET lifecycle_status = ?, updated_at = CURRENT_TIMESTAMP WHERE topic_id = ? AND related_task_id = ?`)
      .bind(topic.lifecycle_status, params.topic_id, params.task_id)
      .run();

    const activeRes = await db
      .prepare(`SELECT * FROM topic_reservations WHERE topic_id = ? AND reservation_status = 'ACTIVE' LIMIT 1`)
      .bind(params.topic_id)
      .first() as TopicReservationRecord | null;

    return {
      reserved: false,
      reservation: activeRes,
      reason: `RESERVATION_CONSTRAINT_BLOCKED: ${err?.message || 'Active reservation already exists.'}`
    };
  }

  await recordTopicDecision(db, {
    topic_id: params.topic_id,
    previous_status: topic.lifecycle_status,
    new_status: 'RESERVED',
    actor: params.lease_owner,
    reason: `Atomic reservation ${reservationId} via ${params.production_channel} (fencing_token=${nextFencingToken}).`,
    task_id: params.task_id,
    event_ref: reservationId
  });

  const created = await db
    .prepare('SELECT * FROM topic_reservations WHERE reservation_id = ? LIMIT 1')
    .bind(reservationId)
    .first() as TopicReservationRecord;

  return {
    reserved: true,
    reservation: created,
    reason: `Reserved ${params.topic_id} for ${params.production_channel} (${params.task_id}).`
  };
}

/**
 * Releases expired stale reservations ONLY when lease_expires_at < now.
 * Never releases an active unexpired reservation even if a worker is simply slow.
 */
export async function recoverExpiredReservations(
  db: any,
  actor: string = 'system_lease_recovery',
  nowIso: string = new Date().toISOString()
): Promise<{ recovered_count: number; recovered_topic_ids: string[] }> {
  if (!db || typeof db.prepare !== 'function') {
    return { recovered_count: 0, recovered_topic_ids: [] };
  }

  const expiredRows = await db
    .prepare(`
      SELECT * FROM topic_reservations
      WHERE reservation_status = 'ACTIVE' AND lease_expires_at < ?
    `)
    .bind(nowIso)
    .all();

  const expired = (expiredRows?.results || []) as TopicReservationRecord[];
  const recoveredIds: string[] = [];

  for (const res of expired) {
    const upd = await db
      .prepare(`
        UPDATE topic_reservations
        SET reservation_status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
        WHERE reservation_id = ? AND reservation_status = 'ACTIVE'
      `)
      .bind(res.reservation_id)
      .run();

    if (Number(upd?.meta?.changes ?? 0) > 0) {
      await db
        .prepare(`
          UPDATE editorial_topics
          SET lifecycle_status = 'READY_FOR_RESEARCH',
              updated_at = CURRENT_TIMESTAMP
          WHERE topic_id = ? AND lifecycle_status = 'RESERVED' AND related_task_id = ?
        `)
        .bind(res.topic_id, res.task_id)
        .run();

      await recordTopicDecision(db, {
        topic_id: res.topic_id,
        previous_status: 'RESERVED',
        new_status: 'READY_FOR_RESEARCH',
        actor,
        reason: `Stale lease ${res.reservation_id} expired at ${res.lease_expires_at}. Topic safely returned to READY_FOR_RESEARCH.`,
        task_id: res.task_id,
        event_ref: res.reservation_id
      });

      recoveredIds.push(res.topic_id);
    }
  }

  return { recovered_count: recoveredIds.length, recovered_topic_ids: recoveredIds };
}

export async function completeOrReleaseReservation(
  db: any,
  reservationId: string,
  finalResStatus: 'COMPLETED' | 'RELEASED' | 'CANCELLED',
  actor: string,
  reason: string
): Promise<boolean> {
  if (!db || typeof db.prepare !== 'function') return false;
  const upd = await db
    .prepare(`
      UPDATE topic_reservations
      SET reservation_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE reservation_id = ? AND reservation_status = 'ACTIVE'
    `)
    .bind(finalResStatus, reservationId)
    .run();
  return Number(upd?.meta?.changes ?? 0) > 0;
}

/**
 * Records an explicit Owner editorial override in `topic_decision_history`.
 * Never permits two active reservations for the same topic.
 */
export async function recordOwnerDuplicateOverride(
  db: any,
  topicId: string,
  actor: string,
  reason: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean }> {
  if (!db || typeof db.prepare !== 'function') return { success: false };

  const row = await db
    .prepare('SELECT lifecycle_status FROM editorial_topics WHERE topic_id = ? LIMIT 1')
    .bind(topicId)
    .first() as { lifecycle_status: string } | null;

  if (!row) return { success: false };

  await recordTopicDecision(db, {
    topic_id: topicId,
    previous_status: row.lifecycle_status,
    new_status: row.lifecycle_status,
    actor,
    reason: `OWNER_EDITORIAL_OVERRIDE: ${reason}`,
    override_flag: true,
    metadata
  });

  await db
    .prepare('UPDATE editorial_topics SET decision_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE topic_id = ?')
    .bind(`Owner Override: ${reason}`, topicId)
    .run();

  return { success: true };
}

export interface ReconciliationArticleSource {
  id: number;
  title: string;
  slug: string;
  focus_keyword?: string | null;
  category_id: number;
  topic_family?: string | null;
  status: string;
  manual_hold?: number;
  environment: 'production' | 'staging';
  published_url?: string | null;
  topic_id?: string | null;
}

export interface ReconciliationPreviewReport {
  generated_at: string;
  production_articles_scanned: number;
  staging_articles_scanned: number;
  backlog_topics_scanned: number;
  research_packs_scanned: number;
  fixtures_isolated_count: number;
  id_conflicts_resolved_by_slug: Array<{
    slug: string;
    staging_id: number | null;
    production_id: number | null;
  }>;
  proposed_staged_in_review: string[];
  proposed_published: string[];
  proposed_dispatchable: string[];
}

/**
 * Generates a read-only reconciliation preview before executing idempotent backfill.
 */
export function previewInventoryReconciliation(inputs: {
  productionArticles: ReconciliationArticleSource[];
  stagingArticles: ReconciliationArticleSource[];
  backlogTopics: Array<{ topicId: string; title: string; slug: string; focusKeyword: string; categoryId: number }>;
  researchPacksCount?: number;
}): ReconciliationPreviewReport {
  const bySlug = new Map<string, { prod?: ReconciliationArticleSource; staging?: ReconciliationArticleSource }>();
  let fixturesCount = 0;

  for (const a of inputs.productionArticles) {
    if (isTestFixtureTitleOrSlug(a.title, a.slug)) {
      fixturesCount++;
      continue;
    }
    const s = slugifyText(a.slug || a.title);
    bySlug.set(s, { ...(bySlug.get(s) || {}), prod: a });
  }

  for (const a of inputs.stagingArticles) {
    if (isTestFixtureTitleOrSlug(a.title, a.slug)) {
      fixturesCount++;
      continue;
    }
    const s = slugifyText(a.slug || a.title);
    bySlug.set(s, { ...(bySlug.get(s) || {}), staging: a });
  }

  const idConflicts: ReconciliationPreviewReport['id_conflicts_resolved_by_slug'] = [];
  const proposedStaged: string[] = [];
  const proposedPublished: string[] = [];

  for (const [slug, pair] of bySlug.entries()) {
    if (pair.staging && pair.prod && pair.staging.id !== pair.prod.id) {
      idConflicts.push({
        slug,
        staging_id: pair.staging.id,
        production_id: pair.prod.id
      });
    }
    if (pair.prod && pair.prod.status === 'published') {
      proposedPublished.push(slug);
    } else if (pair.staging) {
      proposedStaged.push(slug);
    }
  }

  const proposedDispatchable = inputs.backlogTopics
    .filter((b) => !proposedPublished.includes(slugifyText(b.slug)) && !proposedStaged.includes(slugifyText(b.slug)))
    .map((b) => b.topicId);

  return {
    generated_at: new Date().toISOString(),
    production_articles_scanned: inputs.productionArticles.length,
    staging_articles_scanned: inputs.stagingArticles.length,
    backlog_topics_scanned: inputs.backlogTopics.length,
    research_packs_scanned: inputs.researchPacksCount || 0,
    fixtures_isolated_count: fixturesCount,
    id_conflicts_resolved_by_slug: idConflicts,
    proposed_staged_in_review: proposedStaged,
    proposed_published: proposedPublished,
    proposed_dispatchable: proposedDispatchable
  };
}

/**
 * Idempotent backfill & cross-environment reconciliation into D1.
 * Preserves staging_article_id vs production_article_id separation and isolates test fixtures.
 */
export async function reconcileUnifiedInventoryToD1(
  db: any,
  inputs: {
    productionArticles: ReconciliationArticleSource[];
    stagingArticles: ReconciliationArticleSource[];
    backlogTopics: UpsertTopicInput[];
    researchPacks?: ResearchIndexInput[];
  },
  actor: string = 'utlis_reconciler'
): Promise<{
  topics_upserted: number;
  identity_maps_upserted: number;
  research_indexed: number;
  fixtures_isolated: number;
}> {
  if (!db || typeof db.prepare !== 'function') {
    return { topics_upserted: 0, identity_maps_upserted: 0, research_indexed: 0, fixtures_isolated: 0 };
  }

  let topicsUpserted = 0;
  let identityUpserted = 0;
  let researchIndexed = 0;
  let fixturesIsolated = 0;

  // Group prod & staging by canonical slug (never merging by ID!)
  const bySlug = new Map<string, { prod?: ReconciliationArticleSource; staging?: ReconciliationArticleSource }>();
  for (const a of inputs.productionArticles) {
    const s = slugifyText(a.slug || a.title);
    bySlug.set(s, { ...(bySlug.get(s) || {}), prod: a });
  }
  for (const a of inputs.stagingArticles) {
    const s = slugifyText(a.slug || a.title);
    bySlug.set(s, { ...(bySlug.get(s) || {}), staging: a });
  }

  // 1. Upsert Backlog Topics first, aligning status if already in staging/production
  for (const b of inputs.backlogTopics) {
    const slug = slugifyText(b.canonical_slug || b.candidate_title);
    const matchedEnv = bySlug.get(slug);
    let resolvedStatus: TopicLifecycleStatus = b.lifecycle_status || 'READY_FOR_RESEARCH';
    let envScope: EnvironmentScope = 'production';
    let relatedArtId: number | null = b.related_article_id ?? null;
    let publishedUrl: string | null = b.published_url || null;

    if (matchedEnv?.prod?.status === 'published') {
      resolvedStatus = 'PUBLISHED';
      envScope = 'production';
      relatedArtId = matchedEnv.prod.id;
      publishedUrl = matchedEnv.prod.published_url || `https://rancangloka.com/${slug}`;
    } else if (matchedEnv?.staging) {
      resolvedStatus = 'STAGED_IN_REVIEW';
      envScope = 'staging';
      relatedArtId = matchedEnv.staging.id;
    }

    await registerOrUpdateEditorialTopic(
      db,
      {
        ...b,
        canonical_slug: slug,
        lifecycle_status: resolvedStatus,
        environment_scope: envScope,
        related_article_id: relatedArtId,
        published_url: publishedUrl
      },
      actor,
      { skipDuplicateScreening: true }
    );
    topicsUpserted++;
  }

  // 2. Upsert Global Article Identity Map + Topics for all existing Prod/Staging articles
  const nowIso = new Date().toISOString();
  for (const [slug, pair] of bySlug.entries()) {
    const primary = pair.prod || pair.staging!;
    const isFixture = isTestFixtureTitleOrSlug(primary.title, slug) ? 1 : 0;
    if (isFixture) fixturesIsolated++;

    const uid = `artuid_${crypto.createHash('sha256').update(slug).digest('hex').slice(0, 16)}`;
    const matchedBacklog = inputs.backlogTopics.find((b) => slugifyText(b.canonical_slug || b.candidate_title) === slug);
    const topicId = primary.topic_id || matchedBacklog?.topic_id || `TOPIC-ART-${primary.id}`;

    const articleStatus: GlobalArticleIdentityRecord['article_status'] =
      pair.prod?.status === 'published'
        ? 'published'
        : pair.staging
        ? 'staged'
        : 'draft';

    const syncStatus: GlobalArticleIdentityRecord['sync_status'] =
      pair.prod && pair.staging
        ? 'SYNCED'
        : pair.prod
        ? 'PRODUCTION_ONLY'
        : 'STAGING_ONLY';

    const pubUrl = pair.prod?.status === 'published' ? (pair.prod.published_url || `https://rancangloka.com/${slug}`) : null;

    // Ensure topic row exists in editorial_topics
    await registerOrUpdateEditorialTopic(
      db,
      {
        topic_id: topicId,
        canonical_topic_key: slugifyText(primary.focus_keyword || slug),
        angle_key: matchedBacklog?.angle_key || 'primary',
        category_id: primary.category_id || 1,
        topic_family: primary.topic_family || matchedBacklog?.topic_family || null,
        candidate_title: primary.title,
        canonical_slug: slug,
        focus_keyword: primary.focus_keyword || slug.replace(/-/g, ' ').split(' ').slice(0, 4).join(' '),
        discovery_source: matchedBacklog ? 'MAYA_STRATEGY' : 'EXISTING_CORPUS_RECONCILIATION',
        proposing_staff: matchedBacklog?.proposing_staff || 'maya',
        lifecycle_status: mapArticleStatusToTopicStatus(articleStatus, pair.prod ? 'production' : 'staging', primary.manual_hold || 0),
        related_article_id: pair.prod?.id ?? pair.staging?.id ?? null,
        canonical_article_uid: uid,
        published_url: pubUrl,
        environment_scope: isFixture ? 'fixture' : pair.prod ? 'production' : 'staging',
        is_test_fixture: isFixture === 1
      },
      actor,
      { skipDuplicateScreening: true }
    );
    topicsUpserted++;

    await db
      .prepare(`
        INSERT INTO global_article_identity_map (
          canonical_article_uid, topic_id, angle_key, canonical_slug, title,
          focus_keyword, category_id, topic_family, staging_article_id,
          production_article_id, published_url, article_status, is_test_fixture,
          environment_freshness_at, sync_status, lineage_proof_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(canonical_slug) DO UPDATE SET
          topic_id = COALESCE(excluded.topic_id, global_article_identity_map.topic_id),
          staging_article_id = COALESCE(excluded.staging_article_id, global_article_identity_map.staging_article_id),
          production_article_id = COALESCE(excluded.production_article_id, global_article_identity_map.production_article_id),
          published_url = COALESCE(excluded.published_url, global_article_identity_map.published_url),
          article_status = excluded.article_status,
          environment_freshness_at = excluded.environment_freshness_at,
          sync_status = excluded.sync_status,
          lineage_proof_json = excluded.lineage_proof_json,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        uid,
        topicId,
        matchedBacklog?.angle_key || 'primary',
        slug,
        primary.title,
        primary.focus_keyword || null,
        primary.category_id || 1,
        primary.topic_family || matchedBacklog?.topic_family || null,
        pair.staging?.id ?? null,
        pair.prod?.id ?? null,
        pubUrl,
        articleStatus,
        isFixture,
        nowIso,
        syncStatus,
        JSON.stringify({
          reconciled_by: actor,
          staging_id: pair.staging?.id ?? null,
          production_id: pair.prod?.id ?? null,
          matched_by: 'canonical_slug'
        })
      )
      .run();
    identityUpserted++;
  }

  // 3. Index Research Evidence Packs
  for (const rp of inputs.researchPacks || []) {
    await indexResearchEvidencePack(db, rp);
    researchIndexed++;
  }

  return {
    topics_upserted: topicsUpserted,
    identity_maps_upserted: identityUpserted,
    research_indexed: researchIndexed,
    fixtures_isolated: fixturesIsolated
  };
}
