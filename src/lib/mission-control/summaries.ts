/**
 * RancangLoka Hermes Mission Control — Subsystem Summaries
 * Milestone: HERMES-MC-1
 * 
 * Strict Invariant: Read-only. Consolidates Outbox, Article, Media, and JEV summaries from real D1 data.
 */

import type {
  OutboxSummaryData,
  ArticleOperationsSummary,
  MediaOperationsSummary,
  JevObservabilitySummary
} from './types.ts';
import { sanitizeString } from './redact.ts';

export async function getOutboxSummary(db: any, _env?: any): Promise<OutboxSummaryData> {
  let acknowledged = 0;
  let queued = 0;
  let sending = 0;
  let deadLetter = 0;
  let lastIngestAt: string | null = null;
  let source: OutboxSummaryData['source'] = 'unknown';

  if (db && typeof db.prepare === 'function') {
    try {
      const countRow = await db
        .prepare('SELECT COUNT(*) as count, MAX(created_at) as latest FROM article_ingest_receipts')
        .first();

      if (countRow) {
        acknowledged = Number(countRow.count || 0);
        lastIngestAt = countRow.latest || null;
        source = 'd1_receipts';
      }
    } catch {
      // Table may be empty or unmigrated
    }
  }

  return {
    queued,
    sending,
    acknowledged,
    deadLetter,
    source,
    lastIngestAt
  };
}

export async function getArticleOperationsSummary(db: any): Promise<ArticleOperationsSummary> {
  let draftCount = 0;
  let awaitingReviewCount = 0;
  let approvedCount = 0;
  let publishedCount = 0;
  let quarantinedCount = 0;
  let latestPublished: ArticleOperationsSummary['latestPublished'] = null;
  let latestApproval: ArticleOperationsSummary['latestApproval'] = null;
  let latestReceipt: ArticleOperationsSummary['latestReceipt'] = null;

  if (db && typeof db.prepare === 'function') {
    try {
      // 1. Article Status Counts
      const { results: statusRows } = await db
        .prepare('SELECT status, COUNT(*) as count FROM articles GROUP BY status')
        .all();

      if (Array.isArray(statusRows)) {
        for (const r of statusRows) {
          if (r.status === 'published') publishedCount = Number(r.count || 0);
          else if (r.status === 'draft') draftCount = Number(r.count || 0);
        }
      }

      // 2. Approvals
      const approvalRow = await db
        .prepare("SELECT COUNT(*) as count FROM article_editorial_approvals WHERE approval_status = 'APPROVED'")
        .first();
      approvedCount = Number(approvalRow?.count || 0);
      awaitingReviewCount = Math.max(0, draftCount - approvedCount);

      // 3. Latest Published Article
      const pubRow = await db
        .prepare("SELECT id, title, slug, published_at FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 1")
        .first();
      if (pubRow) {
        latestPublished = {
          id: Number(pubRow.id),
          title: sanitizeString(pubRow.title),
          slug: sanitizeString(pubRow.slug),
          publishedAt: pubRow.published_at || null
        };
      }

      // 4. Latest Approval
      const latestAppRow = await db
        .prepare("SELECT article_id, approved_by, created_at FROM article_editorial_approvals WHERE approval_status = 'APPROVED' ORDER BY created_at DESC LIMIT 1")
        .first();
      if (latestAppRow) {
        latestApproval = {
          articleId: Number(latestAppRow.article_id),
          chiefEditor: sanitizeString(latestAppRow.approved_by),
          approvedAt: latestAppRow.created_at
        };
      }

      // 5. Latest Ingest Receipt
      const receiptRow = await db
        .prepare('SELECT job_id, article_id, created_at FROM article_ingest_receipts ORDER BY created_at DESC LIMIT 1')
        .first();
      if (receiptRow) {
        latestReceipt = {
          jobId: sanitizeString(receiptRow.job_id),
          articleId: receiptRow.article_id ? Number(receiptRow.article_id) : null,
          createdAt: receiptRow.created_at
        };
      }
    } catch {
      // Fallback
    }
  }

  return {
    draftCount,
    awaitingReviewCount,
    approvedCount,
    publishedCount,
    quarantinedCount,
    latestPublished,
    latestApproval,
    latestReceipt
  };
}

export async function getMediaOperationsSummary(db: any): Promise<MediaOperationsSummary> {
  let pendingJobsCount = 0;
  let inProgressJobsCount = 0;
  let failedJobsCount = 0;
  let attachedJobsCount = 0;
  let totalAssetsCount = 0;
  let activeDevicesCount = 0;
  let effectiveWorkerState: MediaOperationsSummary['effectiveWorkerState'] = 'DISABLED';
  let recentEvent: MediaOperationsSummary['recentEvent'] = null;

  if (db && typeof db.prepare === 'function') {
    try {
      // Media Job Counts by Status
      const { results: jobRows } = await db
        .prepare('SELECT status, COUNT(*) as count FROM media_jobs GROUP BY status')
        .all();

      if (Array.isArray(jobRows)) {
        for (const r of jobRows) {
          const s = String(r.status || '').toUpperCase();
          const count = Number(r.count || 0);
          if (['PENDING', 'QUEUED', 'LEASED'].includes(s)) {
            pendingJobsCount += count;
          } else if (['IN_PROGRESS', 'GENERATING', 'PROMPT_PREPARING', 'PROMPT_READY', 'PROMPT_SENDING', 'PROMPT_ACKNOWLEDGED'].includes(s)) {
            inProgressJobsCount += count;
          } else if (['FAILED', 'FAILED_TERMINAL'].includes(s)) {
            failedJobsCount += count;
          } else if (['ATTACHED', 'COMPLETE'].includes(s)) {
            attachedJobsCount += count;
          }
        }
      }

      // Media Assets Count
      const assetRow = await db
        .prepare('SELECT COUNT(*) as count FROM media_assets')
        .first();
      totalAssetsCount = Number(assetRow?.count || 0);

      // Active Devices Count
      const devRow = await db
        .prepare("SELECT COUNT(*) as count FROM media_devices WHERE status = 'ACTIVE'")
        .first();
      activeDevicesCount = Number(devRow?.count || 0);

      // Settings Gate
      const settingRow = await db
        .prepare("SELECT value FROM settings WHERE key = 'media_worker_enabled' LIMIT 1")
        .first();
      const val = String(settingRow?.value || '').toLowerCase();
      effectiveWorkerState = val === 'true' || val === '1' ? 'ENABLED' : 'DISABLED';

      // Recent Event
      const evtRow = await db
        .prepare('SELECT event_id, job_id, event_type, created_at FROM media_job_events ORDER BY created_at DESC LIMIT 1')
        .first();
      if (evtRow) {
        recentEvent = {
          eventId: sanitizeString(evtRow.event_id),
          jobId: sanitizeString(evtRow.job_id),
          eventType: sanitizeString(evtRow.event_type),
          createdAt: evtRow.created_at
        };
      }
    } catch {
      // Fallback
    }
  }

  return {
    effectiveWorkerState,
    pendingJobsCount,
    inProgressJobsCount,
    failedJobsCount,
    attachedJobsCount,
    totalAssetsCount,
    activeDevicesCount,
    recentEvent
  };
}

export async function getJevObservabilitySummary(db: any): Promise<JevObservabilitySummary> {
  let totalObservationsCount = 0;
  let agreementRatePercent: number | null = null;
  let latestObservation: JevObservabilitySummary['latestObservation'] = null;
  const recentObservations: JevObservabilitySummary['recentObservations'] = [];

  if (db && typeof db.prepare === 'function') {
    try {
      const countRow = await db
        .prepare('SELECT COUNT(*) as count FROM decision_observations')
        .first();
      totalObservationsCount = Number(countRow?.count || 0);

      // Agreement Rate
      const agreeRow = await db
        .prepare("SELECT COUNT(*) as count FROM decision_observations WHERE disagreement_classification LIKE 'AGREE%'")
        .first();
      if (totalObservationsCount > 0) {
        const agreeCount = Number(agreeRow?.count || 0);
        agreementRatePercent = Math.round((agreeCount / totalObservationsCount) * 100);
      }

      // Recent Observations
      const { results } = await db
        .prepare('SELECT observation_id, decision_point, authoritative_decision, jev_decision, disagreement_classification, provider_status, latency_ms, created_at FROM decision_observations ORDER BY created_at DESC LIMIT 5')
        .all();

      if (Array.isArray(results) && results.length > 0) {
        for (const row of results) {
          recentObservations.push({
            observationId: sanitizeString(row.observation_id),
            decisionPoint: sanitizeString(row.decision_point),
            authoritativeDecision: sanitizeString(row.authoritative_decision),
            jevDecision: sanitizeString(row.jev_decision || null),
            disagreementClassification: sanitizeString(row.disagreement_classification),
            providerStatus: sanitizeString(row.provider_status),
            latencyMs: Number(row.latency_ms || 0),
            createdAt: row.created_at
          });
        }
        latestObservation = recentObservations[0];
      }
    } catch {
      // Fallback
    }
  }

  return {
    mode: 'shadow',
    authority: 'none',
    totalObservationsCount,
    agreementRatePercent,
    latestObservation,
    recentObservations
  };
}
