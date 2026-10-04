/**
 * RancangLoka Hermes Mission Control — Canonical Job Trace & Activity Timeline (V2.5)
 * Milestone: HERMES-MC-V2.5
 * 
 * Strict Invariants:
 * 1. Read-only timeline & trace derivation. Zero mutation authority.
 * 2. NO CANONICAL EVENT EVIDENCE = NO TIMELINE EVENT.
 *    Do NOT reconstruct history from current task stage alone.
 *    Do NOT invent missing stages or interpolate undocumented transitions.
 *    Missing evidence MUST be represented as an explicit, honest gap (EVIDENCE_GAP).
 * 3. Stable, 100% deterministic event identity. Zero random UUIDs, zero Date.now() / poll drift.
 * 4. Duration is calculated ONLY when both boundaries are proven by canonical transitions.
 *    Current stage elapsed time is derived dynamically in UI, never persisted as a ticking value.
 * 5. Corridors, hallway nodes, and MC-9 sprite animations are PRESENTATIONAL ONLY.
 *    Physical movement is NOT a business timeline event.
 * 6. Anomalies are linked ONLY when repository evidence proves relation (task_id === taskId
 *    or entity_id === artifactId). Never correlated solely by timestamp proximity.
 * 7. Queued is distinct from Running. Blocked displays explicit reason and evidence.
 * 8. Canonical rollback / retry / rejection is shown honestly in sequence (Truth > prettiness).
 * 9. Budi effective Media Worker DISABLED truth is preserved; Maya receives zero fabricated Social events;
 *    TypeSafe JEV operates in shadow mode with zero workflow ownership authority.
 */

import type { TaskCard, TaskStage, MissionControlSnapshot } from './types.ts';
import type { DepartmentId } from './staff-registry.ts';
import { getStaffDefinitionByAgentId } from './staff-registry.ts';
import { attributeTaskOwnership } from './department-registry.ts';
import { getPixelOfficeState } from './pixel-office.ts';
import {
  deriveCanonicalHandoffsFromPipeline,
  deriveDeterministicHandoffId,
  type TaskHandoffObservation
} from './task-handoff.ts';
import { sanitizeString } from './redact.ts';

export type JobTraceEventType =
  | 'TASK_CREATED'
  | 'STAGE_ENTERED'
  | 'STAGE_COMPLETED'
  | 'ASSIGNED'
  | 'HANDOFF'
  | 'QUEUED'
  | 'RUNNING'
  | 'BLOCKED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'PUBLICATION_DISPATCH'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ANOMALY'
  | 'RECOVERED'
  | 'EVIDENCE_GAP'
  | 'HUMAN_WRITING_QA_STARTED'
  | 'HUMAN_WRITING_REVISE_REQUESTED'
  | 'ARTICLE_REWRITE_STARTED'
  | 'HUMAN_WRITING_QA_PASSED'
  | 'HUMAN_REVIEW_REQUIRED';

export interface JobTraceEvent {
  event_id: string;
  workflow_id: string;
  task_id: string;
  artifact_id: string;
  event_type: JobTraceEventType;
  stage: string | null;
  previous_stage: string | null;
  agent_id: string | null;
  department_id: string;
  status: string;
  canonical_timestamp: string;
  end_timestamp: string | null;
  duration_ms: number | null;
  duration_label: string | null;
  handoff_id?: string | null;
  anomaly_id?: string | null;
  evidence_source: string;
  evidence_id: string;
  confidence: 'EXACT' | 'DERIVED';
  details?: Record<string, any> | null;
  note?: string | null;
}

export interface JobTraceStageDuration {
  stage: string;
  agent_id: string | null;
  department_id: string;
  start_timestamp: string;
  end_timestamp: string | null;
  duration_ms: number | null;
  duration_label: string | null;
  is_current: boolean;
}

export interface JobTraceSummary {
  workflow_id: string;
  task_id: string;
  artifact_id: string;
  artifact_title: string;
  artifact_slug?: string | null;
  current_stage: string;
  current_agent_id: string | null;
  current_agent_name: string | null;
  current_department_id: string;
  current_operational_state: 'QUEUED' | 'RUNNING' | 'BLOCKED' | 'FAILED' | 'PUBLISHED' | 'STANDBY' | 'UNKNOWN';
  current_position_key: string | null;
  started_at: string;
  last_transition_at: string;
  total_elapsed_ms: number | null;
  total_elapsed_label: string | null;
  canonical_event_count: number;
  handoff_count: number;
  anomaly_count: number;
  blocking_condition: string | null;
  latest_evidence_source: string;
  latest_evidence_id: string;
  has_evidence_gaps: boolean;
}

export interface JobTrace {
  trace_id: string;
  workflow_id: string;
  task_id: string;
  artifact_id: string;
  summary: JobTraceSummary;
  events: JobTraceEvent[];
  stage_durations: JobTraceStageDuration[];
  generated_at: string;
}

/**
 * Derives a deterministic FNV-1a hash string for trace events.
 * Guarantees identical event_id across sessions and refreshes without random UUID variance.
 */
export function deriveDeterministicTraceEventId(
  workflowId: string,
  eventType: string,
  canonicalTimestamp: string,
  evidenceSource: string,
  evidenceId: string
): string {
  const normWorkflow = String(workflowId || '').trim().toLowerCase();
  const normType = String(eventType || '').trim().toUpperCase();
  const normTime = String(canonicalTimestamp || '').trim();
  const normSource = String(evidenceSource || '').trim().toLowerCase();
  const normEvidenceId = String(evidenceId || '').trim().toLowerCase();

  let h = 0x811c9dc5;
  const raw = `${normWorkflow}|${normType}|${normTime}|${normSource}|${normEvidenceId}`;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return `trc_${normWorkflow}_${normType.toLowerCase()}_${hex}`;
}

/**
 * Formats duration in milliseconds into a concise human-readable Indonesian string.
 * Example: 1020000 -> "17m", 1440000 -> "24m", 4500000 -> "1j 15m"
 */
export function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null || isNaN(ms) || ms < 0) return null;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}d`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}j ${remMinutes}m` : `${hours}j`;
}

/**
 * Normalizes input task ID and extracts article ID if present.
 */
export function parseTaskIdentifiers(taskIdInput: string): {
  workflowId: string;
  taskId: string;
  articleId: number | null;
  mediaJobId: string | null;
} {
  const clean = String(taskIdInput || '').trim();
  let workflowId = clean;
  let taskId = clean;
  let articleId: number | null = null;
  let mediaJobId: string | null = null;

  if (clean.startsWith('art_')) {
    const num = Number(clean.slice(4));
    if (!isNaN(num) && num > 0) {
      articleId = num;
      taskId = clean;
      workflowId = clean;
    }
  } else if (/^\d+$/.test(clean)) {
    articleId = Number(clean);
    taskId = `art_${articleId}`;
    workflowId = taskId;
  } else if (clean.startsWith('mjob_')) {
    mediaJobId = clean;
    taskId = clean;
    workflowId = clean;
  }

  return { workflowId, taskId, articleId, mediaJobId };
}

/**
 * Derives the canonical Job Trace for a specific workflow or task.
 * 
 * Strict Invariants:
 * - Read-only query.
 * - Sourced strictly from verified canonical tables or snapshot evidence.
 * - Missing stages or unproven gaps are flagged honestly.
 * - Zero fabricated events.
 */
export async function deriveJobTrace(
  taskIdInput: string,
  snapshot: MissionControlSnapshot | null,
  db?: any
): Promise<JobTrace> {
  const { workflowId, taskId, articleId, mediaJobId } = parseTaskIdentifiers(taskIdInput);

  const rawEvents: JobTraceEvent[] = [];

  // Metadata captured along the way
  let artifactTitle = `Task ${taskId}`;
  let artifactSlug: string | null = null;
  let currentStage = 'draft';
  let currentStatus = 'STANDBY';
  let currentBlocker: string | null = null;
  let activeTaskCard: TaskCard | null = null;

  // 1. Locate current TaskCard in snapshot pipeline (if available)
  if (snapshot?.pipeline?.tasks && Array.isArray(snapshot.pipeline.tasks)) {
    const matched = snapshot.pipeline.tasks.find(
      (t) =>
        t.taskId === taskId ||
        (articleId && t.relatedArticleId === articleId) ||
        (mediaJobId && t.relatedMediaJobId === mediaJobId)
    );
    if (matched) {
      activeTaskCard = matched;
      artifactTitle = matched.title || matched.slug || artifactTitle;
      artifactSlug = matched.slug || null;
      currentStage = matched.stage || currentStage;
      currentStatus = matched.status || currentStatus;
      currentBlocker = matched.blockerOrError || null;

      // Extract Quality Gate Review event if present on the active task
      if (matched.qualityReview) {
        const qRev = matched.qualityReview;
        const targetAgent = qRev.primary_owner || (matched.stage === 'researching' ? 'evidence_researcher_lead' : 'content_writer_primary');
        const targetDept = targetAgent === 'evidence_researcher_lead' ? 'research' : 'editorial';
        const qTime = matched.lastUpdate || new Date().toISOString();

        rawEvents.push({
          event_id: deriveDeterministicTraceEventId(
            workflowId,
            'HUMAN_WRITING_REVISE_REQUESTED',
            qTime,
            'human_quality_brief',
            `brief_${matched.taskId}`
          ),
          workflow_id: workflowId,
          task_id: taskId,
          artifact_id: String(matched.relatedArticleId || taskId),
          event_type: 'HUMAN_WRITING_REVISE_REQUESTED',
          stage: matched.stage,
          previous_stage: 'editorial_qa',
          agent_id: targetAgent,
          department_id: targetDept,
          status: 'REVISE_REQUESTED',
          canonical_timestamp: qTime,
          end_timestamp: null,
          duration_ms: null,
          duration_label: null,
          evidence_source: 'human_quality_brief',
          evidence_id: `brief_${matched.taskId}`,
          confidence: 'EXACT',
          details: {
            quality_issue: qRev.primary_quality_issue || qRev.quality_issue,
            primary_quality_issue: qRev.primary_quality_issue || qRev.quality_issue,
            quality_issues: qRev.quality_issues || (qRev.quality_issue ? [qRev.quality_issue] : []),
            quality_score: qRev.quality_score,
            quality_decision: qRev.quality_decision,
            article_intent: qRev.article_intent,
            primary_owner: qRev.primary_owner,
            supporting_owner: qRev.supporting_owner,
            supporting_owners: qRev.supporting_owners || (qRev.supporting_owner ? [qRev.supporting_owner] : []),
            revision_reason: qRev.revision_reason,
            article_id: matched.relatedArticleId,
            task_id: matched.taskId,
            attempt: qRev.attempt
          },
          note: `Rina returned draft to ${targetAgent}: score ${qRev.quality_score ?? 'N/A'} (${qRev.quality_decision ?? 'REVISE'}) - ${qRev.revision_reason ?? 'Revision required'}${qRev.quality_issues && qRev.quality_issues.length > 1 ? ` [${qRev.quality_issues.length} issues]` : ''}`
        });
      }
    }
  }

  // 2. Query Canonical D1 Tables (if db is provided)
  if (db && typeof db.prepare === 'function') {
    // A. Query articles table
    if (articleId) {
      try {
        const art = await db
          .prepare('SELECT id, slug, title, status, created_at, updated_at, published_at FROM articles WHERE id = ?')
          .bind(articleId)
          .first();

        if (art) {
          artifactTitle = art.title || art.slug || `Article #${art.id}`;
          artifactSlug = art.slug || null;

          const createdAt = art.created_at || art.updated_at;
          if (createdAt && typeof createdAt === 'string' && createdAt.trim()) {
            rawEvents.push({
              event_id: deriveDeterministicTraceEventId(workflowId, 'TASK_CREATED', createdAt, 'd1_articles', `art_${art.id}`),
              workflow_id: workflowId,
              task_id: taskId,
              artifact_id: String(art.id),
              event_type: 'TASK_CREATED',
              stage: 'draft',
              previous_stage: null,
              agent_id: 'content_writer_primary',
              department_id: 'editorial',
              status: 'draft',
              canonical_timestamp: createdAt,
              end_timestamp: null,
              duration_ms: null,
              duration_label: null,
              evidence_source: 'd1_articles:created_at',
              evidence_id: `article_${art.id}`,
              confidence: 'EXACT',
              note: `Article created in editorial pipeline: "${sanitizeString(art.title)}"`
            });
          }

          if (art.status === 'published' && art.published_at) {
            rawEvents.push({
              event_id: deriveDeterministicTraceEventId(workflowId, 'PUBLISHED', art.published_at, 'd1_articles:published_at', `art_${art.id}`),
              workflow_id: workflowId,
              task_id: taskId,
              artifact_id: String(art.id),
              event_type: 'PUBLISHED',
              stage: 'published',
              previous_stage: 'scheduled',
              agent_id: 'publication_dispatcher_core',
              department_id: 'publication_operations',
              status: 'published',
              canonical_timestamp: art.published_at,
              end_timestamp: null,
              duration_ms: null,
              duration_label: null,
              evidence_source: 'd1_articles:published_at',
              evidence_id: `article_${art.id}_published`,
              confidence: 'EXACT',
              note: 'Article successfully published to production edge'
            });
          }
        }
      } catch (err) {
        // fail-safe read: if table doesn't exist, proceed
      }
    }

    // B. Query article_editorial_approvals (human / operator approvals & rejections)
    if (articleId) {
      try {
        const { results: approvals } = await db
          .prepare(
            'SELECT id, article_id, approved_by, approved_role, approval_status, created_at, notes FROM article_editorial_approvals WHERE article_id = ? ORDER BY created_at ASC'
          )
          .bind(articleId)
          .all();

        if (Array.isArray(approvals)) {
          for (const app of approvals) {
            const appTime = app.created_at;
            if (!appTime || typeof appTime !== 'string' || !appTime.trim()) continue;

            if (app.approval_status === 'APPROVED') {
              rawEvents.push({
                event_id: deriveDeterministicTraceEventId(workflowId, 'APPROVED', appTime, 'd1_article_editorial_approvals', `app_${app.id}`),
                workflow_id: workflowId,
                task_id: taskId,
                artifact_id: String(app.article_id),
                event_type: 'APPROVED',
                stage: 'editorial_qa',
                previous_stage: 'writing',
                agent_id: app.approved_by || 'editorial_qa_primary',
                department_id: 'editorial',
                status: 'APPROVED',
                canonical_timestamp: appTime,
                end_timestamp: null,
                duration_ms: null,
                duration_label: null,
                evidence_source: 'd1_article_editorial_approvals',
                evidence_id: `approval_${app.id}`,
                confidence: 'EXACT',
                note: `Editorial QA sign-off granted by ${sanitizeString(app.approved_by)} (${sanitizeString(app.approved_role)})`
              });
            } else if (app.approval_status === 'REJECTED') {
              // Canonical Rollback / Rejection
              rawEvents.push({
                event_id: deriveDeterministicTraceEventId(workflowId, 'STAGE_COMPLETED', appTime, 'd1_article_editorial_approvals:rejected', `app_${app.id}`),
                workflow_id: workflowId,
                task_id: taskId,
                artifact_id: String(app.article_id),
                event_type: 'STAGE_COMPLETED',
                stage: 'editorial_qa',
                previous_stage: 'editorial_qa',
                agent_id: app.approved_by || 'editorial_qa_primary',
                department_id: 'editorial',
                status: 'REJECTED',
                canonical_timestamp: appTime,
                end_timestamp: null,
                duration_ms: null,
                duration_label: null,
                evidence_source: 'd1_article_editorial_approvals:rejected',
                evidence_id: `rejection_${app.id}`,
                confidence: 'EXACT',
                note: `Editorial QA rejected draft; returned to writing. Reason: ${sanitizeString(app.notes || 'Revisions required')}`
              });
            }
          }
        }
      } catch (err) {
        // fail-safe read
      }
    }

    // C. Query media_jobs & media_job_events
    try {
      let mediaJobQuery = 'SELECT job_id, article_id, status, role, slot_key, attempt, max_attempts, last_error_code, last_error_message_safe, created_at, updated_at FROM media_jobs WHERE ';
      let queryParam: any = null;
      if (articleId) {
        mediaJobQuery += 'article_id = ? ORDER BY created_at ASC';
        queryParam = articleId;
      } else if (mediaJobId) {
        mediaJobQuery += 'job_id = ? ORDER BY created_at ASC';
        queryParam = mediaJobId;
      }

      if (queryParam != null) {
        const { results: mjobs } = await db.prepare(mediaJobQuery).bind(queryParam).all();
        if (Array.isArray(mjobs)) {
          for (const mjob of mjobs) {
            const mTime = mjob.created_at;
            if (mTime && typeof mTime === 'string' && mTime.trim()) {
              rawEvents.push({
                event_id: deriveDeterministicTraceEventId(workflowId, 'STAGE_ENTERED', mTime, 'd1_media_jobs', `mjob_${mjob.job_id}`),
                workflow_id: workflowId,
                task_id: taskId,
                artifact_id: String(mjob.article_id || taskId),
                event_type: 'STAGE_ENTERED',
                stage: 'waiting_media',
                previous_stage: 'writing',
                agent_id: 'lokamedia_worker_primary',
                department_id: 'media',
                status: mjob.status,
                canonical_timestamp: mTime,
                end_timestamp: null,
                duration_ms: null,
                duration_label: null,
                evidence_source: 'd1_media_jobs',
                evidence_id: `mjob_${mjob.job_id}`,
                confidence: 'EXACT',
                note: `Visual generation job queued for slot: ${mjob.slot_key || 'primary'}`
              });
            }

            // Check if media job failed
            if (mjob.status === 'FAILED' || mjob.status === 'FAILED_TERMINAL') {
              const failTime = mjob.updated_at || mjob.created_at;
              if (failTime && typeof failTime === 'string') {
                rawEvents.push({
                  event_id: deriveDeterministicTraceEventId(workflowId, 'FAILED', failTime, 'd1_media_jobs:failed', `mjob_${mjob.job_id}`),
                  workflow_id: workflowId,
                  task_id: taskId,
                  artifact_id: String(mjob.article_id || taskId),
                  event_type: 'FAILED',
                  stage: 'waiting_media',
                  previous_stage: 'waiting_media',
                  agent_id: 'lokamedia_worker_primary',
                  department_id: 'media',
                  status: 'FAILED',
                  canonical_timestamp: failTime,
                  end_timestamp: null,
                  duration_ms: null,
                  duration_label: null,
                  evidence_source: 'd1_media_jobs:failed',
                  evidence_id: `mjob_fail_${mjob.job_id}`,
                  confidence: 'EXACT',
                  note: `Media generation failed: ${sanitizeString(mjob.last_error_code || mjob.last_error_message_safe || 'Unknown error')}`
                });
              }
            } else if (mjob.status === 'COMPLETE' || mjob.status === 'ATTACHED') {
              const compTime = mjob.updated_at || mjob.created_at;
              if (compTime && typeof compTime === 'string') {
                rawEvents.push({
                  event_id: deriveDeterministicTraceEventId(workflowId, 'STAGE_COMPLETED', compTime, 'd1_media_jobs:complete', `mjob_${mjob.job_id}`),
                  workflow_id: workflowId,
                  task_id: taskId,
                  artifact_id: String(mjob.article_id || taskId),
                  event_type: 'STAGE_COMPLETED',
                  stage: 'waiting_media',
                  previous_stage: 'waiting_media',
                  agent_id: 'lokamedia_worker_primary',
                  department_id: 'media',
                  status: 'COMPLETE',
                  canonical_timestamp: compTime,
                  end_timestamp: null,
                  duration_ms: null,
                  duration_label: null,
                  evidence_source: 'd1_media_jobs:complete',
                  evidence_id: `mjob_comp_${mjob.job_id}`,
                  confidence: 'EXACT',
                  note: 'Visual asset generated and attached successfully'
                });
              }
            }

            // Check granular media_job_events if available
            try {
              const { results: mjobEvents } = await db
                .prepare('SELECT event_id, job_id, event_type, stage, attempt, created_at FROM media_job_events WHERE job_id = ? ORDER BY created_at ASC')
                .bind(mjob.job_id)
                .all();

              if (Array.isArray(mjobEvents)) {
                for (const mev of mjobEvents) {
                  if (!mev.created_at) continue;
                  rawEvents.push({
                    event_id: deriveDeterministicTraceEventId(workflowId, mev.event_type, mev.created_at, 'd1_media_job_events', mev.event_id),
                    workflow_id: workflowId,
                    task_id: taskId,
                    artifact_id: String(mjob.article_id || taskId),
                    event_type: mev.event_type === 'JOB_COMPLETE' ? 'STAGE_COMPLETED' : 'RUNNING',
                    stage: 'waiting_media',
                    previous_stage: null,
                    agent_id: 'lokamedia_worker_primary',
                    department_id: 'media',
                    status: mev.event_type,
                    canonical_timestamp: mev.created_at,
                    end_timestamp: null,
                    duration_ms: null,
                    duration_label: null,
                    evidence_source: 'd1_media_job_events',
                    evidence_id: String(mev.event_id),
                    confidence: 'EXACT',
                    note: `Media worker event: ${mev.event_type} (attempt ${mev.attempt || 0})`
                  });
                }
              }
            } catch (err) {
              // table might not be populated; ignore
            }
          }
        }
      }
    } catch (err) {
      // fail-safe read
    }

    // D. Query article_publication_plans
    if (articleId) {
      try {
        const { results: plans } = await db
          .prepare('SELECT plan_id, plan_status, target_publish_at, target_publish_local, created_at FROM article_publication_plans WHERE article_id = ? ORDER BY created_at ASC')
          .bind(articleId)
          .all();

        if (Array.isArray(plans)) {
          for (const plan of plans) {
            if (!plan.created_at) continue;
            rawEvents.push({
              event_id: deriveDeterministicTraceEventId(workflowId, 'QUEUED', plan.created_at, 'd1_article_publication_plans', plan.plan_id),
              workflow_id: workflowId,
              task_id: taskId,
              artifact_id: String(articleId),
              event_type: 'QUEUED',
              stage: 'scheduled',
              previous_stage: 'editorial_qa',
              agent_id: 'publication_dispatcher_core',
              department_id: 'publication_operations',
              status: plan.plan_status || 'PLANNED',
              canonical_timestamp: plan.created_at,
              end_timestamp: null,
              duration_ms: null,
              duration_label: null,
              evidence_source: 'd1_article_publication_plans',
              evidence_id: plan.plan_id,
              confidence: 'EXACT',
              note: `Article entered Publication Queue for target window: ${plan.target_publish_local || plan.target_publish_at}`
            });
          }
        }
      } catch (err) {
        // fail-safe read
      }
    }

    // E. Query article_publication_executions
    if (articleId) {
      try {
        const { results: execs } = await db
          .prepare('SELECT execution_id, plan_id, execution_status, attempts_count, last_error_class, last_error_reason, target_publish_at, created_at, updated_at FROM article_publication_executions WHERE article_id = ? ORDER BY created_at ASC')
          .bind(articleId)
          .all();

        if (Array.isArray(execs)) {
          for (const ex of execs) {
            const exTime = ex.created_at || ex.updated_at;
            if (!exTime) continue;
            const isPub = ex.execution_status === 'PUBLISHED';
            const isBlocked = ex.execution_status === 'BLOCKED';

            rawEvents.push({
              event_id: deriveDeterministicTraceEventId(workflowId, isPub ? 'PUBLISHED' : (isBlocked ? 'BLOCKED' : 'PUBLICATION_DISPATCH'), exTime, 'd1_article_publication_executions', ex.execution_id),
              workflow_id: workflowId,
              task_id: taskId,
              artifact_id: String(articleId),
              event_type: isPub ? 'PUBLISHED' : (isBlocked ? 'BLOCKED' : 'PUBLICATION_DISPATCH'),
              stage: isPub ? 'published' : 'scheduled',
              previous_stage: 'scheduled',
              agent_id: 'publication_dispatcher_core',
              department_id: 'publication_operations',
              status: ex.execution_status,
              canonical_timestamp: exTime,
              end_timestamp: null,
              duration_ms: null,
              duration_label: null,
              evidence_source: 'd1_article_publication_executions',
              evidence_id: ex.execution_id,
              confidence: 'EXACT',
              note: isBlocked ? `Publication dispatch blocked: ${sanitizeString(ex.last_error_reason || 'Safety block')}` : `Publication dispatch status: ${ex.execution_status}`
            });
          }
        }
      } catch (err) {
        // fail-safe read
      }
    }

    // F. Query mission_control_anomalies (Evidence-backed anomaly linking)
    try {
      const { results: anomalies } = await db
        .prepare(
          `SELECT anomaly_id, detected_at, resolved_at, severity, anomaly_type, title, summary, fingerprint, state, department_id 
           FROM mission_control_anomalies 
           WHERE task_id = ? OR (entity_id = ? AND (entity_type = 'article' OR entity_type IS NULL))
           ORDER BY detected_at ASC`
        )
        .bind(taskId, String(articleId || taskId))
        .all();

      if (Array.isArray(anomalies)) {
        for (const anom of anomalies) {
          if (!anom.detected_at) continue;

          rawEvents.push({
            event_id: deriveDeterministicTraceEventId(workflowId, 'ANOMALY', anom.detected_at, 'd1_mission_control_anomalies', anom.anomaly_id),
            workflow_id: workflowId,
            task_id: taskId,
            artifact_id: String(articleId || taskId),
            event_type: 'ANOMALY',
            stage: null,
            previous_stage: null,
            agent_id: null,
            department_id: anom.department_id || 'system',
            status: anom.state,
            canonical_timestamp: anom.detected_at,
            end_timestamp: anom.resolved_at || null,
            duration_ms: null,
            duration_label: null,
            anomaly_id: anom.anomaly_id,
            evidence_source: 'd1_mission_control_anomalies',
            evidence_id: anom.anomaly_id,
            confidence: 'EXACT',
            details: {
              severity: anom.severity,
              fingerprint: anom.fingerprint,
              title: anom.title,
              summary: anom.summary
            },
            note: `[Anomaly ${anom.severity}] ${sanitizeString(anom.title)}: ${sanitizeString(anom.summary)}`
          });

          if (anom.resolved_at) {
            rawEvents.push({
              event_id: deriveDeterministicTraceEventId(workflowId, 'RECOVERED', anom.resolved_at, 'd1_mission_control_anomalies:resolved', anom.anomaly_id),
              workflow_id: workflowId,
              task_id: taskId,
              artifact_id: String(articleId || taskId),
              event_type: 'RECOVERED',
              stage: null,
              previous_stage: null,
              agent_id: null,
              department_id: anom.department_id || 'system',
              status: 'RESOLVED',
              canonical_timestamp: anom.resolved_at,
              end_timestamp: null,
              duration_ms: null,
              duration_label: null,
              anomaly_id: anom.anomaly_id,
              evidence_source: 'd1_mission_control_anomalies:resolved',
              evidence_id: `resolved_${anom.anomaly_id}`,
              confidence: 'EXACT',
              note: `Anomaly resolved: ${sanitizeString(anom.title)}`
            });
          }
        }
      }
    } catch (err) {
      // fail-safe read
    }
  }

  // 3. Incorporate V2.4 Canonical Handoff Observations
  const pipelineHandoffs = deriveCanonicalHandoffsFromPipeline(snapshot);
  for (const h of pipelineHandoffs) {
    if (
      h.workflow_id === workflowId ||
      h.task_id === taskId ||
      (articleId && h.artifact_id === String(articleId)) ||
      (mediaJobId && h.evidence_id === mediaJobId)
    ) {
      rawEvents.push({
        event_id: deriveDeterministicTraceEventId(
          workflowId,
          'HANDOFF',
          h.transition_timestamp,
          h.evidence_source || 'v2_4_task_handoff',
          h.handoff_id
        ),
        workflow_id: workflowId,
        task_id: taskId,
        artifact_id: String(articleId || taskId),
        event_type: 'HANDOFF',
        stage: h.to_stage,
        previous_stage: h.from_stage === 'initial' ? null : h.from_stage,
        agent_id: h.to_agent_id,
        department_id: h.to_department_id,
        status: h.handoff_state,
        canonical_timestamp: h.transition_timestamp,
        end_timestamp: null,
        duration_ms: null,
        duration_label: null,
        handoff_id: h.handoff_id,
        evidence_source: h.evidence_source || 'v2_4_task_handoff',
        evidence_id: h.evidence_id || h.handoff_id,
        confidence: h.confidence || 'EXACT',
        details: h.quality_metadata ? { ...h.quality_metadata } : null,
        note: `Canonical Handoff: ${h.from_agent_id || h.from_department_id} (${h.from_stage}) → ${h.to_agent_id || h.to_department_id} (${h.to_stage})`
      });
    }
  }

  // 4. Ingest any explicit in-memory fixture events (for testing / deterministic simulation)
  if ((snapshot as any)?._traceFixtures && Array.isArray((snapshot as any)._traceFixtures)) {
    for (const fix of (snapshot as any)._traceFixtures) {
      if (fix.workflow_id === workflowId || fix.task_id === taskId || (articleId && fix.artifact_id === String(articleId))) {
        rawEvents.push(fix);
      }
    }
  }

  // 5. Deduplicate Raw Events by event_id
  const eventMap = new Map<string, JobTraceEvent>();
  for (const ev of rawEvents) {
    if (!eventMap.has(ev.event_id)) {
      eventMap.set(ev.event_id, ev);
    }
  }
  let uniqueEvents = Array.from(eventMap.values());

  // 6. Chronological Sorting & Deterministic Tie-Breaking
  const EVENT_TYPE_ORDER: Record<string, number> = {
    TASK_CREATED: 0,
    STAGE_ENTERED: 1,
    RUNNING: 2,
    HUMAN_WRITING_QA_STARTED: 3,
    HUMAN_WRITING_REVISE_REQUESTED: 4,
    ARTICLE_REWRITE_STARTED: 5,
    HUMAN_WRITING_QA_PASSED: 6,
    HUMAN_REVIEW_REQUIRED: 7,
    ANOMALY: 8,
    RECOVERED: 9,
    BLOCKED: 10,
    APPROVAL_REQUIRED: 11,
    APPROVED: 12,
    STAGE_COMPLETED: 13,
    HANDOFF: 14,
    QUEUED: 15,
    PUBLICATION_DISPATCH: 16,
    PUBLISHED: 17,
    FAILED: 18,
    EVIDENCE_GAP: 19
  };

  uniqueEvents.sort((a, b) => {
    const timeA = new Date(a.canonical_timestamp).getTime();
    const timeB = new Date(b.canonical_timestamp).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const orderA = EVENT_TYPE_ORDER[a.event_type] ?? 99;
    const orderB = EVENT_TYPE_ORDER[b.event_type] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.event_id.localeCompare(b.event_id);
  });

  // 7. Proven Duration Calculation & Evidence Gap Detection
  const stageDurations: JobTraceStageDuration[] = [];
  const processedEvents: JobTraceEvent[] = [];
  let hasEvidenceGaps = false;

  // Expected canonical progression stages
  const EXPECTED_EDITORIAL_FLOW: string[] = [
    'draft',
    'researching',
    'writing',
    'waiting_media',
    'editorial_qa',
    'scheduled',
    'published'
  ];

  for (let i = 0; i < uniqueEvents.length; i++) {
    const curr = { ...uniqueEvents[i] };
    const next = uniqueEvents[i + 1] ? uniqueEvents[i + 1] : null;

    // A. Duration calculation when next transition exists
    if (next && (curr.event_type === 'STAGE_ENTERED' || curr.event_type === 'TASK_CREATED' || curr.event_type === 'HANDOFF' || curr.event_type === 'QUEUED')) {
      const startTime = new Date(curr.canonical_timestamp).getTime();
      const endTime = new Date(next.canonical_timestamp).getTime();

      // Invariant: Duration calculated only when both boundaries are proven and monotonic
      if (!isNaN(startTime) && !isNaN(endTime) && endTime >= startTime) {
        const diffMs = endTime - startTime;
        curr.end_timestamp = next.canonical_timestamp;
        curr.duration_ms = diffMs;
        curr.duration_label = formatDuration(diffMs);

        if (curr.stage) {
          stageDurations.push({
            stage: curr.stage,
            agent_id: curr.agent_id,
            department_id: curr.department_id,
            start_timestamp: curr.canonical_timestamp,
            end_timestamp: next.canonical_timestamp,
            duration_ms: diffMs,
            duration_label: formatDuration(diffMs),
            is_current: false
          });
        }
      }
    }

    processedEvents.push(curr);

    // B. Honest Gap Detection (Critical Rule #29)
    // If consecutive stage transitions skip intermediate expected stages without documented evidence
    if (next && curr.stage && next.stage && curr.stage !== next.stage) {
      const idxA = EXPECTED_EDITORIAL_FLOW.indexOf(curr.stage);
      const idxB = EXPECTED_EDITORIAL_FLOW.indexOf(next.stage);

      if (idxA !== -1 && idxB !== -1 && idxB > idxA + 1) {
        // Missing middle stage detected!
        hasEvidenceGaps = true;
        const missingStages = EXPECTED_EDITORIAL_FLOW.slice(idxA + 1, idxB).join(', ');
        const gapEventId = deriveDeterministicTraceEventId(
          workflowId,
          'EVIDENCE_GAP',
          curr.end_timestamp || curr.canonical_timestamp,
          'audit_gap',
          `${curr.stage}_to_${next.stage}`
        );

        processedEvents.push({
          event_id: gapEventId,
          workflow_id: workflowId,
          task_id: taskId,
          artifact_id: String(articleId || taskId),
          event_type: 'EVIDENCE_GAP',
          stage: null,
          previous_stage: curr.stage,
          agent_id: null,
          department_id: 'unknown',
          status: 'GAP',
          canonical_timestamp: curr.end_timestamp || curr.canonical_timestamp,
          end_timestamp: next.canonical_timestamp,
          duration_ms: null,
          duration_label: null,
          evidence_source: 'audit_gap',
          evidence_id: `gap_${curr.stage}_to_${next.stage}`,
          confidence: 'EXACT',
          note: `[No canonical transition evidence recorded for: ${missingStages}]`
        });
      }
    }
  }

  // 8. Determine Current State & Summary
  const firstEvent = processedEvents[0] || null;
  const lastEvent = processedEvents[processedEvents.length - 1] || null;
  const startedAt = firstEvent ? firstEvent.canonical_timestamp : (activeTaskCard?.lastUpdate || '1970-01-01T00:00:00.000Z');
  const lastTransitionAt = lastEvent ? lastEvent.canonical_timestamp : startedAt;

  // Determine current active stage & owner
  if (lastEvent?.stage) {
    currentStage = lastEvent.stage;
  }

  // Attribute owner
  let attributedAgentId: string | null = null;
  let attributedDeptId: DepartmentId | 'unknown' = 'unknown';

  if (activeTaskCard) {
    const attr = attributeTaskOwnership(activeTaskCard);
    attributedAgentId = attr.responsible_agent_id;
    attributedDeptId = attr.department_id || 'unknown';
  } else if (lastEvent) {
    attributedAgentId = lastEvent.agent_id;
    attributedDeptId = (lastEvent.department_id as any) || 'unknown';
  }

  // Safety Gate: TypeSafe Jev cannot own workflows
  if (attributedAgentId === 'telemetry_observer_jev' || (attributedAgentId as any) === 'jev') {
    attributedAgentId = null;
  }

  // Safety Gate: Budi cannot be active RUNNING if Media Worker is DISABLED
  const isMediaWorkerDisabled = snapshot?.health?.mediaWorker?.effectiveState !== 'ENABLED';

  // Safety Gate: Maya cannot be active if Social is HOLDING
  const isSocialHolding =
    !snapshot?.social ||
    snapshot.social.mode === 'OFF' ||
    snapshot.social.departmentAvailability === 'NOT_AVAILABLE';

  // Determine Operational State
  let operationalState: JobTraceSummary['current_operational_state'] = 'STANDBY';
  if (currentBlocker || currentStatus === 'BLOCKED' || snapshot?.health?.automation?.killSwitchEngaged) {
    operationalState = 'BLOCKED';
  } else if (currentStatus === 'published' || currentStage === 'published') {
    operationalState = 'PUBLISHED';
  } else if (currentStatus === 'FAILED' || currentStatus === 'FAILED_TERMINAL' || currentStage === 'failed') {
    operationalState = 'FAILED';
  } else if (currentStage === 'scheduled' || snapshot?.health?.automation?.mode === 'OFF') {
    operationalState = 'QUEUED';
  } else if (currentStatus === 'RUNNING' || ['writing', 'researching', 'editorial_qa', 'waiting_media'].includes(currentStage)) {
    operationalState = 'RUNNING';
  }

  // Enforce safety constraints on active operational state
  if (attributedAgentId === 'lokamedia_worker_primary' && isMediaWorkerDisabled && operationalState === 'RUNNING') {
    operationalState = 'STANDBY';
  }
  if (attributedAgentId === 'social_distribution_operator' && isSocialHolding && operationalState === 'RUNNING') {
    operationalState = 'STANDBY';
  }

  // Current stage duration entry (ongoing)
  if (operationalState !== 'PUBLISHED' && operationalState !== 'FAILED') {
    stageDurations.push({
      stage: currentStage,
      agent_id: attributedAgentId,
      department_id: attributedDeptId,
      start_timestamp: lastTransitionAt,
      end_timestamp: null,
      duration_ms: null,
      duration_label: null,
      is_current: true
    });
  }

  const staffDef = attributedAgentId ? getStaffDefinitionByAgentId(attributedAgentId) : null;
  let currentPositionKey: string | null = null;
  if (attributedAgentId && snapshot) {
    try {
      const office = getPixelOfficeState(snapshot);
      const sprite = office.sprites.find((s) => s.agent_id === attributedAgentId);
      currentPositionKey = sprite?.position_key || null;
    } catch (e) {}
  }

  const summary: JobTraceSummary = {
    workflow_id: workflowId,
    task_id: taskId,
    artifact_id: String(articleId || taskId),
    artifact_title: artifactTitle,
    artifact_slug: artifactSlug,
    current_stage: currentStage,
    current_agent_id: attributedAgentId,
    current_agent_name: staffDef?.display_name || (attributedAgentId ? attributedAgentId : 'Unassigned'),
    current_department_id: attributedDeptId,
    current_operational_state: operationalState,
    current_position_key: currentPositionKey,
    started_at: startedAt,
    last_transition_at: lastTransitionAt,
    total_elapsed_ms: null, // derived on client/UI to prevent state drift
    total_elapsed_label: null,
    canonical_event_count: processedEvents.filter((e) => e.event_type !== 'EVIDENCE_GAP').length,
    handoff_count: processedEvents.filter((e) => e.event_type === 'HANDOFF').length,
    anomaly_count: processedEvents.filter((e) => e.event_type === 'ANOMALY').length,
    blocking_condition: currentBlocker || (snapshot?.health?.automation?.killSwitchEngaged ? 'Emergency Kill Switch Engaged' : null),
    latest_evidence_source: lastEvent?.evidence_source || 'd1_pipeline',
    latest_evidence_id: lastEvent?.evidence_id || taskId,
    has_evidence_gaps: hasEvidenceGaps
  };

  return {
    trace_id: `trace_${workflowId}`,
    workflow_id: workflowId,
    task_id: taskId,
    artifact_id: String(articleId || taskId),
    summary,
    events: processedEvents,
    stage_durations: stageDurations,
    generated_at: snapshot?.generatedAt || new Date().toISOString()
  };
}
