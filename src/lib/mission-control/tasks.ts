/**
 * RancangLoka Hermes Mission Control — Pipeline / Task Board Reader
 * Milestone: HERMES-MC-1
 * 
 * Strict Invariant: Read-only. Represents real canonical workflow data without invented person entities.
 */

import type { PipelineBoardData, TaskCard, TaskStage } from './types.ts';
import { sanitizeString } from './redact.ts';

const ALL_STAGES: TaskStage[] = [
  'draft',
  'researching',
  'writing',
  'reader_voice_review',
  'validating',
  'editorial_qa',
  'ready_for_ingest',
  'ingesting',
  'waiting_media',
  'ready_for_review',
  'scheduled',
  'published',
  'failed'
];

export async function getPipelineBoard(db: any): Promise<PipelineBoardData> {
  const stageCounts: Record<TaskStage, number> = {
    draft: 0,
    researching: 0,
    writing: 0,
    reader_voice_review: 0,
    validating: 0,
    editorial_qa: 0,
    ready_for_ingest: 0,
    ingesting: 0,
    waiting_media: 0,
    ready_for_review: 0,
    scheduled: 0,
    published: 0,
    failed: 0
  };

  const tasks: TaskCard[] = [];

  if (!db || typeof db.prepare !== 'function') {
    return {
      tasks: [],
      stageCounts,
      totalActiveTasks: 0
    };
  }

  try {
    // 1. Fetch recent articles
    const { results: articleRows } = await db
      .prepare('SELECT id, slug, title, status, updated_at, published_at, featured_image FROM articles ORDER BY updated_at DESC LIMIT 50')
      .all();

    // 2. Fetch active/recent media jobs
    const { results: mediaJobRows } = await db
      .prepare('SELECT job_id, article_id, article_slug, article_title, status, attempt, max_attempts, last_error_code, last_error_message_safe, updated_at, created_at FROM media_jobs ORDER BY created_at DESC LIMIT 50')
      .all();

    // 3. Fetch editorial approvals
    const { results: approvalRows } = await db
      .prepare("SELECT article_id, approved_by, created_at FROM article_editorial_approvals WHERE approval_status = 'APPROVED'")
      .all();

    const approvalMap = new Map<number, { approved_by: string; created_at: string }>();
    if (Array.isArray(approvalRows)) {
      for (const a of approvalRows) {
        approvalMap.set(Number(a.article_id), {
          approved_by: sanitizeString(a.approved_by || 'editorial_qa_primary'),
          created_at: a.created_at || '1970-01-01T00:00:00.000Z'
        });
      }
    }

    // Index media jobs by article_id (prioritizing active jobs, then newest)
    const mediaJobByArticle = new Map<number, any>();
    if (Array.isArray(mediaJobRows)) {
      for (const mjob of mediaJobRows) {
        const artId = Number(mjob.article_id);
        const existing = mediaJobByArticle.get(artId);
        const isActive = ['QUEUED', 'LEASED', 'GENERATING', 'PROMPT_PREPARING', 'PROMPT_READY', 'PROMPT_SENDING', 'PROMPT_ACKNOWLEDGED', 'CAPTURING', 'CAPTURED', 'UPLOAD_QUEUED', 'UPLOADING'].includes(mjob.status);
        const existingIsActive = existing && ['QUEUED', 'LEASED', 'GENERATING', 'PROMPT_PREPARING', 'PROMPT_READY', 'PROMPT_SENDING', 'PROMPT_ACKNOWLEDGED', 'CAPTURING', 'CAPTURED', 'UPLOAD_QUEUED', 'UPLOADING'].includes(existing.status);

        if (!existing) {
          mediaJobByArticle.set(artId, mjob);
        } else if (isActive && !existingIsActive) {
          mediaJobByArticle.set(artId, mjob);
        }
      }
    }

    // Process Articles
    if (Array.isArray(articleRows)) {
      for (const art of articleRows) {
        const artId = Number(art.id);
        const mjob = mediaJobByArticle.get(artId);
        const approval = approvalMap.get(artId) || null;
        const hasApproval = Boolean(approval);

        let stage: TaskStage = 'draft';
        let blockerOrError: string | null = null;
        let retryCount = 0;

        if (art.status === 'published') {
          stage = 'published';
        } else if (art.status === 'scheduled') {
          stage = 'scheduled';
        } else if (art.status === 'draft') {
          if (mjob) {
            retryCount = Number(mjob.attempt || 0);
            if (mjob.status === 'FAILED' || mjob.status === 'FAILED_TERMINAL') {
              stage = 'failed';
              blockerOrError = sanitizeString(mjob.last_error_code || mjob.last_error_message_safe || 'Media generation failed');
            } else if (['QUEUED', 'LEASED', 'GENERATING', 'PROMPT_PREPARING', 'PROMPT_READY', 'PROMPT_SENDING', 'PROMPT_ACKNOWLEDGED'].includes(mjob.status)) {
              stage = 'waiting_media';
            } else if (['ATTACHED', 'COMPLETE'].includes(mjob.status)) {
              stage = hasApproval ? 'ready_for_review' : 'editorial_qa';
            } else {
              stage = 'waiting_media';
            }
          } else {
            // Draft without media job
            stage = hasApproval ? 'ready_for_review' : 'draft';
          }
        }

        stageCounts[stage] = (stageCounts[stage] || 0) + 1;

        tasks.push({
          taskId: `art_${artId}`,
          title: sanitizeString(art.title || art.slug || `Article #${artId}`),
          subsystem: 'editorial',
          status: sanitizeString(art.status),
          stage,
          retryCount,
          lastUpdate: sanitizeString(art.updated_at || art.published_at || art.created_at || '1970-01-01T00:00:00.000Z'),
          blockerOrError,
          relatedArticleId: artId,
          relatedMediaJobId: mjob?.job_id ? sanitizeString(mjob.job_id) : null,
          slug: sanitizeString(art.slug),
          approvalEvidence: approval ? {
            approvedBy: approval.approved_by,
            approvedAt: approval.created_at
          } : null
        });
      }
    }

    // Process Standalone Media Jobs (if not already represented by an article task)
    if (Array.isArray(mediaJobRows)) {
      for (const mjob of mediaJobRows) {
        const artId = Number(mjob.article_id);
        const alreadyCovered = tasks.some((t) => t.relatedMediaJobId === mjob.job_id);
        if (!alreadyCovered) {
          const isFailed = mjob.status === 'FAILED' || mjob.status === 'FAILED_TERMINAL';
          const stage: TaskStage = isFailed ? 'failed' : 'waiting_media';
          stageCounts[stage] = (stageCounts[stage] || 0) + 1;

          tasks.push({
            taskId: sanitizeString(mjob.job_id),
            title: sanitizeString(mjob.article_title || mjob.article_slug || `Media Job for Art #${artId}`),
            subsystem: 'media',
            status: sanitizeString(mjob.status),
            stage,
            retryCount: Number(mjob.attempt || 0),
            lastUpdate: sanitizeString(mjob.updated_at || mjob.created_at || '1970-01-01T00:00:00.000Z'),
            blockerOrError: isFailed ? sanitizeString(mjob.last_error_code || 'Media generation error') : null,
            relatedArticleId: artId,
            relatedMediaJobId: sanitizeString(mjob.job_id),
            slug: sanitizeString(mjob.article_slug),
            approvalEvidence: null
          });
        }
      }
    }

    // 4. Process Actionable Internal Link Items into Chief Editor task board
    try {
      const { deriveInternalLinkActionableStates } = await import('../internal-link/index.ts');
      const linkActions = await deriveInternalLinkActionableStates(db);
      for (const act of linkActions) {
        stageCounts['ready_for_review'] = (stageCounts['ready_for_review'] || 0) + 1;
        tasks.push({
          taskId: `link_action_${act.type.toLowerCase()}_${act.article_id}${act.link_id ? '_' + act.link_id : ''}`,
          title: `[${act.type}] ${sanitizeString(act.article_title)}`,
          subsystem: 'editorial',
          status: act.type,
          stage: 'ready_for_review',
          retryCount: 0,
          lastUpdate: new Date().toISOString(),
          blockerOrError: sanitizeString(act.details),
          relatedArticleId: act.article_id,
          slug: sanitizeString(act.article_slug),
          approvalEvidence: null
        });
      }
    } catch {
      // Internal links table might not be initialized yet
    }
  } catch (err: any) {
    // Return empty on error
  }

  // Calculate total active (non-published) tasks
  const totalActiveTasks = tasks.filter((t) => t.stage !== 'published').length;

  return {
    tasks,
    stageCounts,
    totalActiveTasks
  };
}
